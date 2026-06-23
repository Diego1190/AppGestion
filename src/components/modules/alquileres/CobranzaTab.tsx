import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import React, { useState, useEffect } from 'react'
import { Eye, Download, MessageCircle, CheckCircle, Loader2 } from 'lucide-react'
import { getInquilinos, getMovimientos, updateMovimiento, getHistorialConsumo } from '@/lib/alquileres'
import { generarPDFRecibo } from '@/lib/pdf'
import { uploadPDFToStorage } from '@/lib/supabaseStorage'
import { Inquilino, MovimientoDepa } from '@/types/index'
import { useToast, ToastContainer } from '@/components/Toast'
import { Modal } from '@/components/ui/Modal'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

/** Nombre de archivo consistente — usado tanto al subir a Storage como al generar el PDF local */
const nombreArchivo = (numDepa: number, mes: number, anio: number) =>
  `recibo-dpto${numDepa}-${MESES[mes - 1]}-${anio}.pdf`

const CobranzaTab: React.FC = () => {
  const [inquilinos, setInquilinos] = useState<Inquilino[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoDepa[]>([])
  const [loading, setLoading] = useState(true)
  const [reciboModal, setReciboModal] = useState<{ inq: Inquilino; movs: MovimientoDepa[] } | null>(null)
  const [generandoPDF, setGenerandoPDF] = useState<string | null>(null)
  const [enviandoWA, setEnviandoWA] = useState<string | null>(null)
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
  useRealtimeSync('movimientos_depa', loadData)

  const getMovsInq = (n: number) => movimientos.filter(m => m.num_depa === n)
  const getTotal = (n: number) => getMovsInq(n).reduce((s, m) => s + Number(m.importe_pagar), 0)
  const getPendiente = (n: number) => getMovsInq(n).filter(m => m.estado === 'Pendiente').reduce((s, m) => s + Number(m.importe_pagar), 0)

  /**
   * Genera el PDF, lo descarga localmente Y lo sube a Supabase Storage.
   * Retorna la URL firmada del Storage (o null si la subida falla,
   * en cuyo caso el PDF local ya se descargó igual).
   */
  const generarYSubirPDF = async (inq: Inquilino): Promise<string | null> => {
    const historial = await getHistorialConsumo(inq.num_depa)
    const blob = await generarPDFRecibo(
      inq.num_depa, inq.nombre_completo, inq.telefono,
      mes, anio, getMovsInq(inq.num_depa), historial
    )
    try {
      const filename = nombreArchivo(inq.num_depa, mes, anio)
      const url = await uploadPDFToStorage(blob, filename, 'recibos')
      return url || null
    } catch (err) {
      console.error('Error subiendo a Storage:', err)
      return null   // el PDF local ya se descargó vía generarPDFRecibo, no se pierde el trabajo
    }
  }

  const handlePDF = async (inq: Inquilino) => {
    setGenerandoPDF(inq.id)
    try {
      const url = await generarYSubirPDF(inq)
      addToast(url ? 'PDF generado y guardado en la nube' : 'PDF generado (no se pudo respaldar en la nube)', url ? 'success' : 'warning')
    } catch { addToast('Error generando PDF', 'error') }
    finally { setGenerandoPDF(null) }
  }

  /**
   * Genera el PDF (si aún no existe una copia reciente), lo sube a Storage,
   * y abre WhatsApp con el resumen + enlace de descarga del recibo.
   */
  const enviarPorWhatsApp = async (inq: Inquilino) => {
    setEnviandoWA(inq.id)
    try {
      const total = getTotal(inq.num_depa)
      const pendiente = getPendiente(inq.num_depa)
      const url = await generarYSubirPDF(inq)

      const tel = inq.telefono.replace(/\D/g, '')
      const detalle = getMovsInq(inq.num_depa).map(m =>
        `• ${m.tipo_servicio}: S/ ${Number(m.importe_pagar).toFixed(2)}${m.consumo ? ` (${Number(m.consumo).toFixed(2)} ${m.tipo_servicio==='Luz'?'kWh':'m³'})` : ''}`
      ).join('\n')

      const lineaPdf = url ? `\n📄 Descarga tu recibo PDF aquí:\n${url}\n` : ''

      const msg = encodeURIComponent(
        `Estimado/a ${inq.nombre_completo.split(' ')[0]}, le envío el resumen de *${MESES[mes-1]} ${anio}*:\n\n` +
        `🏠 *Depa ${inq.num_depa}*\n${detalle}\n\n` +
        `💰 Total: *S/ ${total.toFixed(2)}*\n` +
        `${pendiente > 0 ? `⏳ Pendiente: *S/ ${pendiente.toFixed(2)}*` : '✅ Todo pagado'}\n` +
        lineaPdf +
        `\nGracias 🙏`
      )
      window.open(`https://wa.me/51${tel}?text=${msg}`, '_blank')

      if (!url) addToast('Mensaje enviado, pero no se pudo adjuntar el link del PDF', 'warning')
    } catch {
      addToast('Error preparando el envío', 'error')
    } finally {
      setEnviandoWA(null)
    }
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

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={mes} onChange={e => setMes(parseInt(e.target.value))}>
          {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={anio} onChange={e => setAnio(parseInt(e.target.value))}>
          {[2023,2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-sm text-gray-500">Panel — {MESES[mes-1]} {anio}</span>
      </div>

      {/* Cards resumen — apiladas en móvil */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Total Facturado</p>
          <p className="text-xl sm:text-2xl font-bold">S/ {movimientos.reduce((s,m)=>s+Number(m.importe_pagar),0).toFixed(2)}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
          <p className="text-sm text-yellow-700">Pendiente</p>
          <p className="text-xl sm:text-2xl font-bold text-yellow-900">S/ {movimientos.filter(m=>m.estado==='Pendiente').reduce((s,m)=>s+Number(m.importe_pagar),0).toFixed(2)}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <p className="text-sm text-green-700">Cobrado</p>
          <p className="text-xl sm:text-2xl font-bold text-green-900">S/ {movimientos.filter(m=>m.estado==='Pagado').reduce((s,m)=>s+Number(m.importe_pagar),0).toFixed(2)}</p>
        </div>
      </div>

      {/* ── MÓVIL: cards de inquilino ── */}
      <div className="md:hidden space-y-3">
        {inquilinos.length === 0 ? (
          <div className="bg-white rounded-xl border p-10 text-center text-gray-400">No hay inquilinos registrados</div>
        ) : inquilinos.map(inq => {
          const movs = getMovsInq(inq.num_depa)
          const total = getTotal(inq.num_depa)
          const pendiente = getPendiente(inq.num_depa)
          const todoPagado = movs.length > 0 && movs.every(m => m.estado === 'Pagado')
          const generando = generandoPDF === inq.id
          const enviando = enviandoWA === inq.id
          return (
            <div key={inq.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">D{inq.num_depa}</div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{inq.nombre_completo}</p>
                    <p className="text-xs text-gray-500">{inq.telefono}</p>
                  </div>
                </div>
                {movs.length > 0 && (
                  todoPagado
                    ? <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs flex-shrink-0"><CheckCircle className="w-3 h-3"/>Al día</span>
                    : <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs flex-shrink-0">⏳ Pendiente</span>
                )}
              </div>

              <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-gray-500">{movs.length === 0 ? 'Sin servicios' : `${movs.length} servicio${movs.length!==1?'s':''}`}</span>
                <div className="text-right">
                  <span className="font-bold text-gray-900">{total>0?`S/ ${total.toFixed(2)}`:'—'}</span>
                  {pendiente > 0 && <span className="ml-2 text-red-600 font-medium">(S/ {pendiente.toFixed(2)} pend.)</span>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                <button onClick={() => setReciboModal({ inq, movs })} disabled={movs.length===0}
                  className="flex items-center justify-center gap-1.5 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg disabled:opacity-30 text-xs font-medium">
                  <Eye className="w-4 h-4"/>Ver
                </button>
                <button onClick={() => handlePDF(inq)} disabled={movs.length===0 || generando}
                  className="flex items-center justify-center gap-1.5 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-30 text-xs font-medium">
                  {generando ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>}PDF
                </button>
                <button onClick={() => enviarPorWhatsApp(inq)} disabled={movs.length===0 || enviando}
                  className="flex items-center justify-center gap-1.5 py-2 text-green-700 bg-green-50 hover:bg-green-100 rounded-lg disabled:opacity-30 text-xs font-medium">
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin"/> : <MessageCircle className="w-4 h-4"/>}Enviar
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── DESKTOP: tabla ── */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
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
                const generando = generandoPDF === inq.id
                const enviando = enviandoWA === inq.id
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
                        <button onClick={() => handlePDF(inq)} title="Descargar y respaldar PDF" disabled={movs.length===0||generando} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30">
                          {generando ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>}
                        </button>
                        <button onClick={() => enviarPorWhatsApp(inq)} title="Enviar por WhatsApp con link de PDF" disabled={movs.length===0||enviando} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-30">
                          {enviando ? <Loader2 className="w-4 h-4 animate-spin"/> : <MessageCircle className="w-4 h-4"/>}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Ver Recibo */}
      <Modal open={!!reciboModal} maxWidth="lg">
        {reciboModal && (
          <>
            <div className="px-5 sm:px-6 py-4 border-b flex justify-between items-start sticky top-0 bg-white">
              <div>
                <h2 className="text-base sm:text-lg font-semibold">Recibo — {MESES[mes-1]} {anio}</h2>
                <p className="text-sm text-gray-500">Depa {reciboModal.inq.num_depa} · {reciboModal.inq.nombre_completo}</p>
              </div>
              <button onClick={() => setReciboModal(null)} className="text-gray-400 text-xl ml-4 flex-shrink-0">✕</button>
            </div>
            {/* ── MÓVIL: lista de conceptos en cards ── */}
            <div className="sm:hidden px-5 py-4 space-y-2">
              {reciboModal.movs.map(m => (
                <div key={m.id} className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      {m.tipo_servicio}
                      {m.consumo!=null && <span className="text-xs text-gray-400 ml-1">({Number(m.consumo).toFixed(2)} {m.tipo_servicio==='Luz'?'kWh':'m³'})</span>}
                    </p>
                    <p className="text-xs text-gray-500">{new Date(m.fecha_vencimiento+'T00:00:00').toLocaleDateString('es-PE')}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-medium">S/ {Number(m.importe_pagar).toFixed(2)}</span>
                    <button onClick={() => toggleEstado(m)} className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer ${m.estado==='Pagado'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}`}>{m.estado}</button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-gray-900">TOTAL</span>
                <span className="font-bold text-gray-900 text-lg">S/ {reciboModal.movs.reduce((s,m)=>s+Number(m.importe_pagar),0).toFixed(2)}</span>
              </div>
            </div>

            {/* ── DESKTOP: tabla con columnas fijas (no se desborda) ── */}
            <div className="hidden sm:block px-5 sm:px-6 py-4">
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '34%' }}/>
                  <col style={{ width: '22%' }}/>
                  <col style={{ width: '22%' }}/>
                  <col style={{ width: '22%' }}/>
                </colgroup>
                <thead><tr className="border-b">
                  <th className="text-left py-2 text-sm font-semibold text-gray-700">Concepto</th>
                  <th className="text-left py-2 text-sm font-semibold text-gray-700">Vcto</th>
                  <th className="text-right py-2 text-sm font-semibold text-gray-700">Monto</th>
                  <th className="text-center py-2 text-sm font-semibold text-gray-700">Estado</th>
                </tr></thead>
                <tbody>
                  {reciboModal.movs.map(m => (
                    <tr key={m.id} className="border-b border-gray-100">
                      <td className="py-2 text-sm text-gray-900 truncate">{m.tipo_servicio}{m.consumo!=null&&<span className="text-xs text-gray-400 ml-1">({Number(m.consumo).toFixed(2)} {m.tipo_servicio==='Luz'?'kWh':'m³'})</span>}</td>
                      <td className="py-2 text-sm text-gray-600">{new Date(m.fecha_vencimiento+'T00:00:00').toLocaleDateString('es-PE')}</td>
                      <td className="py-2 text-sm text-right font-medium">S/ {Number(m.importe_pagar).toFixed(2)}</td>
                      <td className="py-2 text-center"><button onClick={() => toggleEstado(m)} className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer ${m.estado==='Pagado'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700'}`}>{m.estado}</button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t-2 border-gray-300">
                  <td colSpan={2} className="pt-3 font-bold text-gray-900">TOTAL</td>
                  <td className="pt-3 text-right font-bold text-gray-900 text-lg">S/ {reciboModal.movs.reduce((s,m)=>s+Number(m.importe_pagar),0).toFixed(2)}</td>
                  <td></td>
                </tr></tfoot>
              </table>
            </div>

            <div className="px-5 sm:px-6 py-4 border-t flex flex-col sm:flex-row gap-2 sm:justify-end sticky bottom-0 bg-white">
              <button onClick={() => setReciboModal(null)} className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm order-3 sm:order-1">Cerrar</button>
              <button onClick={() => handlePDF(reciboModal.inq)} disabled={generandoPDF===reciboModal.inq.id}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium text-sm order-2">
                {generandoPDF===reciboModal.inq.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>}
                {generandoPDF===reciboModal.inq.id?'Generando...':'PDF'}
              </button>
              <button onClick={() => enviarPorWhatsApp(reciboModal.inq)} disabled={enviandoWA===reciboModal.inq.id}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium text-sm order-1 sm:order-3">
                {enviandoWA===reciboModal.inq.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <MessageCircle className="w-4 h-4"/>}
                WhatsApp
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
export default CobranzaTab
