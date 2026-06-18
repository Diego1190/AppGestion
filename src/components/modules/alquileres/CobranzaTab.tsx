import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import React, { useState, useEffect } from 'react'
import { Eye, Download, MessageCircle, CheckCircle } from 'lucide-react'
import { getInquilinos, getMovimientos, updateMovimiento, getHistorialConsumo } from '@/lib/alquileres'
import { generarPDFRecibo } from '@/lib/pdf'
import { uploadPDFToStorage } from '@/lib/supabaseStorage'
import { Inquilino, MovimientoDepa } from '@/types/index'
import { useToast, ToastContainer } from '@/components/Toast'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const CobranzaTab: React.FC = () => {
  const [inquilinos, setInquilinos] = useState<Inquilino[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoDepa[]>([])
  const [loading, setLoading] = useState(true)
  const [reciboModal, setReciboModal] = useState<{ inq: Inquilino; movs: MovimientoDepa[] } | null>(null)
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)
  const { toasts, addToast, removeToast } = useToast()
    const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())

  const loadData = async () => {
    try {
      setLoading(true)
      const [inqs, movs] = await Promise.all([getInquilinos(), getMovimientos(mes, anio)])
      setInquilinos(inqs); setMovimientos(movs)
    } catch { addToast('Error cargando datos', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [mes, anio])


  const getMovsInq = (n: number) => movimientos.filter(m => m.num_depa === n)
  const getTotal = (n: number) => getMovsInq(n).reduce((s, m) => s + Number(m.importe_pagar), 0)
  const getPendiente = (n: number) => getMovsInq(n).filter(m => m.estado === 'Pendiente').reduce((s, m) => s + Number(m.importe_pagar), 0)

  const handlePDF = async (inq: Inquilino) => {
    setGenerandoPDF(inq.id)
    try {
      const historial = await getHistorialConsumo(inq.num_depa)
      const blob = await generarPDFRecibo(
        inq.num_depa, inq.nombre_completo, inq.telefono,
        mes, anio, getMovsInq(inq.num_depa), historial
      )
      addToast('PDF generado correctamente', 'success')
    } catch { addToast('Error generando PDF', 'error') }
    finally { setGenerandoPDF(null) }
  }

  const abrirWhatsApp = (inq: Inquilino, total: number, pendiente: number) => {
    const tel = inq.telefono.replace(/\D/g, '')
    const detalle = getMovsInq(inq.num_depa).map(m =>
      `• ${m.tipo_servicio}: S/ ${Number(m.importe_pagar).toFixed(2)}${m.consumo ? ` (${Number(m.consumo).toFixed(2)} ${m.tipo_servicio==='Luz'?'kWh':'m³'})` : ''}`
    ).join('\n')
    const msg = encodeURIComponent(
      `Estimado/a ${inq.nombre_completo.split(' ')[0]}, le envío el resumen de *${MESES[mes-1]} ${anio}*:\n\n` +
      `🏠 *Depa ${inq.num_depa}*\n${detalle}\n\n` +
      `💰 Total: *S/ ${total.toFixed(2)}*\n` +
      `${pendiente > 0 ? `⏳ Pendiente: *S/ ${pendiente.toFixed(2)}*` : '✅ Todo pagado'}\n\nGracias 🙏`
    )
    window.open(`https://wa.me/51${tel}?text=${msg}`, '_blank')
  }

  const toggleEstado = async (mov: MovimientoDepa) => {
    try {
      await updateMovimiento(mov.id, { estado: mov.estado === 'Pendiente' ? 'Pagado' : 'Pendiente' })
      loadData()
      if (reciboModal) {
        setReciboModal(prev => prev ? {
          ...prev, movs: prev.movs.map(m => m.id === mov.id ? { ...m, estado: mov.estado === 'Pendiente' ? 'Pagado' : 'Pendiente' } : m)
        } : null)
      }
    } catch { addToast('Error actualizando estado', 'error') }
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando...</div>

  return (
    <div>
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="flex items-center gap-3 mb-6">
        <select className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={mes} onChange={e => setMes(parseInt(e.target.value))}>
          {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={anio} onChange={e => setAnio(parseInt(e.target.value))}>
          {[2023,2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-sm text-gray-500 ml-2">Panel — {MESES[mes-1]} {anio}</span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4"><p className="text-sm text-gray-500">Total Facturado</p><p className="text-2xl font-bold">S/ {movimientos.reduce((s,m)=>s+Number(m.importe_pagar),0).toFixed(2)}</p></div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4"><p className="text-sm text-yellow-700">Pendiente</p><p className="text-2xl font-bold text-yellow-900">S/ {movimientos.filter(m=>m.estado==='Pendiente').reduce((s,m)=>s+Number(m.importe_pagar),0).toFixed(2)}</p></div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4"><p className="text-sm text-green-700">Cobrado</p><p className="text-2xl font-bold text-green-900">S/ {movimientos.filter(m=>m.estado==='Pagado').reduce((s,m)=>s+Number(m.importe_pagar),0).toFixed(2)}</p></div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {inquilinos.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No hay inquilinos registrados</div>
        ) : (
          <table className="w-full min-w-[580px]">
            <thead><tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Depa</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Inquilino</th>
              <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Servicios</th>
              <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Total</th>
              <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Pendiente</th>
              <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Estado</th>
              <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Acciones</th>
            </tr></thead>
            <tbody>
              {inquilinos.map(inq => {
                const movs = getMovsInq(inq.num_depa)
                const total = getTotal(inq.num_depa)
                const pendiente = getPendiente(inq.num_depa)
                const todoPagado = movs.length > 0 && movs.every(m => m.estado === 'Pagado')
                return (
                  <tr key={inq.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3"><div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">D{inq.num_depa}</div></td>
                    <td className="px-4 py-3"><p className="font-medium text-gray-900 text-sm">{inq.nombre_completo}</p><p className="text-xs text-gray-500">{inq.telefono}</p></td>
                    <td className="px-4 py-3 text-center"><span className="text-sm text-gray-700">{movs.length === 0 ? '—' : `${movs.length} servicio${movs.length!==1?'s':''}`}</span></td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 text-sm">{total>0?`S/ ${total.toFixed(2)}`:'—'}</td>
                    <td className="px-4 py-3 text-right text-sm">{pendiente>0?<span className="font-bold text-red-600">S/ {pendiente.toFixed(2)}</span>:<span className="text-green-600">—</span>}</td>
                    <td className="px-4 py-3 text-center">
                      {movs.length===0?<span className="text-xs text-gray-400">—</span>
                        :todoPagado?<span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs"><CheckCircle className="w-3 h-3"/>Al día</span>
                        :<span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">⏳ Pendiente</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setReciboModal({ inq, movs })} title="Ver Recibo" disabled={movs.length===0} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-30"><Eye className="w-4 h-4"/></button>
                        <button onClick={() => handlePDF(inq)} title="PDF" disabled={movs.length===0||generandoPDF===inq.id} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30">
                          {generandoPDF===inq.id ? <span className="text-xs">...</span> : <Download className="w-4 h-4"/>}
                        </button>
                        <button onClick={() => abrirWhatsApp(inq,total,pendiente)} title="WhatsApp" disabled={movs.length===0} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-30"><MessageCircle className="w-4 h-4"/></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {reciboModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b flex justify-between items-start">
              <div><h2 className="text-lg font-semibold">Recibo — {MESES[mes-1]} {anio}</h2><p className="text-sm text-gray-500">Depa {reciboModal.inq.num_depa} · {reciboModal.inq.nombre_completo}</p></div>
              <button onClick={() => setReciboModal(null)} className="text-gray-400 text-xl ml-4">✕</button>
            </div>
            <div className="px-6 py-4">
              <table className="w-full min-w-[580px]">
                <thead><tr className="border-b"><th className="text-left py-2 text-sm font-semibold text-gray-700">Concepto</th><th className="text-left py-2 text-sm font-semibold text-gray-700">Vcto</th><th className="text-right py-2 text-sm font-semibold text-gray-700">Monto</th><th className="text-center py-2 text-sm font-semibold text-gray-700">Estado</th></tr></thead>
                <tbody>
                  {reciboModal.movs.map(m => (
                    <tr key={m.id} className="border-b border-gray-100">
                      <td className="py-2 text-sm text-gray-900">{m.tipo_servicio}{m.consumo!=null&&<span className="text-xs text-gray-400 ml-1">({Number(m.consumo).toFixed(2)} {m.tipo_servicio==='Luz'?'kWh':'m³'})</span>}</td>
                      <td className="py-2 text-sm text-gray-600">{new Date(m.fecha_vencimiento+'T00:00:00').toLocaleDateString('es-PE')}</td>
                      <td className="py-2 text-sm text-right font-medium">S/ {Number(m.importe_pagar).toFixed(2)}</td>
                      <td className="py-2 text-center"><button onClick={() => toggleEstado(m)} className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer ${m.estado==='Pagado'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}`}>{m.estado}</button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t-2 border-gray-300"><td colSpan={2} className="pt-3 font-bold text-gray-900">TOTAL</td><td className="pt-3 text-right font-bold text-gray-900 text-lg">S/ {reciboModal.movs.reduce((s,m)=>s+Number(m.importe_pagar),0).toFixed(2)}</td><td></td></tr></tfoot>
              </table>
            </div>
            <div className="px-6 py-4 border-t flex gap-2 justify-end">
              <button onClick={() => setReciboModal(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm">Cerrar</button>
              <button onClick={() => handlePDF(reciboModal.inq)} disabled={generandoPDF===reciboModal.inq.id}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium text-sm">
                <Download className="w-4 h-4"/>{generandoPDF===reciboModal.inq.id?'Generando...':'PDF'}
              </button>
              <button onClick={() => { abrirWhatsApp(reciboModal.inq,getTotal(reciboModal.inq.num_depa),getPendiente(reciboModal.inq.num_depa)); setReciboModal(null) }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm">
                <MessageCircle className="w-4 h-4"/>WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default CobranzaTab
