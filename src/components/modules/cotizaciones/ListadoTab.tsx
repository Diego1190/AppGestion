import React, { useState, useEffect } from 'react'
import { Eye, Trash2, Package, CheckCircle, FileText, MessageCircle, Loader2 } from 'lucide-react'
import { getCotizaciones, deleteCotizacion, getCotizacionDetalles, getCotizacionInsumos, updateInsumo, updateCotizacionEstado } from '@/lib/cotizaciones'
import { generarPDFCotizacion, generarPDFInsumos } from '@/lib/pdf'
import { uploadPDFToStorage } from '@/lib/supabaseStorage'
import { Cotizacion, CotizacionDetalle, CotizacionInsumo } from '@/types/index'
import { useToast, ToastContainer, ConfirmModal } from '@/components/Toast'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'

const ListadoTab: React.FC = () => {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [loading, setLoading]           = useState(true)
  const [confirmId, setConfirmId]       = useState<string | null>(null)
  const [modalVer, setModalVer]         = useState<{cot:Cotizacion;detalles:CotizacionDetalle[];insumos:CotizacionInsumo[]}|null>(null)
  const [cargando, setCargando]         = useState(false)
  const [enviandoWA, setEnviandoWA]     = useState<string | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<'Todas'|'Activa'|'Completada'>('Todas')
  const { toasts, addToast, removeToast } = useToast()

  const loadData = async () => {
    try { setLoading(true); setCotizaciones(await getCotizaciones()) }
    catch { addToast('Error cargando','error') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [])
  useRealtimeSync('cotizaciones', loadData)

  const abrirVer = async (cot: Cotizacion) => {
    setCargando(true)
    try {
      const [detalles, insumos] = await Promise.all([getCotizacionDetalles(cot.id), getCotizacionInsumos(cot.id)])
      setModalVer({ cot, detalles, insumos })
    } catch { addToast('Error cargando detalle','error') }
    finally { setCargando(false) }
  }

  const toggleComprado = async (ins: CotizacionInsumo) => {
    await updateInsumo(ins.id, { comprado: !ins.comprado })
    setModalVer(p => p ? { ...p, insumos: p.insumos.map(i => i.id===ins.id ? {...i,comprado:!i.comprado} : i) } : null)
  }

  const handleEliminar = async () => {
    if (!confirmId) return
    try { await deleteCotizacion(confirmId); setConfirmId(null); addToast('Eliminada','warning'); loadData() }
    catch { addToast('Error eliminando','error') }
  }

  const handleMarcarCompletada = async (cot: Cotizacion) => {
    const nuevo = cot.estado==='Completada'?'Activa':'Completada'
    try { await updateCotizacionEstado(cot.id, nuevo); addToast(`Marcada como ${nuevo}`,'success'); loadData() }
    catch { addToast('Error','error') }
  }

  /**
   * Genera el PDF de cotizacion, lo descarga local y lo sube a Storage.
   * Retorna la URL firmada (o null si la subida falla — el PDF local ya se descargo igual).
   */
  const generarYSubirPDFCotizacion = async (cot: Cotizacion, detalles: CotizacionDetalle[]): Promise<string | null> => {
    const blob = await generarPDFCotizacion(cot, detalles)
    try {
      return await uploadPDFToStorage(blob, `cotizacion-${cot.correlativo}.pdf`, 'cotizaciones')
    } catch (e) {
      console.error('Error subiendo a Storage:', e)
      return null
    }
  }

  /** PDF de la cotización (para el cliente) — descarga local + respaldo en Storage */
  const handlePDFCotizacion = async (cot: Cotizacion, detalles: CotizacionDetalle[]) => {
    try {
      const url = await generarYSubirPDFCotizacion(cot, detalles)
      addToast(url ? 'PDF generado y guardado en la nube' : 'PDF generado (no se pudo respaldar en la nube)', url ? 'success' : 'warning')
    } catch { addToast('Error generando PDF','error') }
  }

  /** PDF de la lista de materiales/insumos (para compras) */
  const handlePDFInsumos = async (cot: Cotizacion, insumos: CotizacionInsumo[]) => {
    if (insumos.length === 0) { addToast('Esta cotización no tiene insumos registrados','warning'); return }
    try {
      await generarPDFInsumos(cot, insumos)
      addToast('PDF de insumos generado','success')
    } catch { addToast('Error generando PDF de insumos','error') }
  }

  /** Para los botones de la lista, donde solo tenemos la cotización (sin detalles/insumos cargados aun) */
  const handlePDFInsumosDesdeListado = async (cot: Cotizacion) => {
    try {
      const insumos = await getCotizacionInsumos(cot.id)
      await handlePDFInsumos(cot, insumos)
    } catch { addToast('Error cargando insumos','error') }
  }

  /**
   * Genera el PDF de cotizacion, lo sube a Storage, y abre WhatsApp
   * con el resumen de la cotizacion + el link de descarga del PDF.
   */
  const enviarPorWhatsApp = async (cot: Cotizacion, detalles: CotizacionDetalle[]) => {
    if (!cot.cliente_telefono) { addToast('Esta cotización no tiene teléfono de cliente registrado','error'); return }
    setEnviandoWA(cot.id)
    try {
      const url = await generarYSubirPDFCotizacion(cot, detalles)

      const tel = cot.cliente_telefono.replace(/\D/g, '')
      const lineaPdf = url ? `\n📄 Descarga tu cotización en PDF aquí:\n${url}\n` : ''

      const msg = encodeURIComponent(
        `Estimado/a ${cot.cliente_nombre.split(' ')[0]}, le envío la cotización *${cot.correlativo}*` +
        `${cot.proyecto_nombre ? ` para *${cot.proyecto_nombre}*` : ''}:\n\n` +
        `💰 Total: *S/ ${cot.monto_total.toFixed(2)}*\n` +
        lineaPdf +
        `\nQuedo atento/a a cualquier consulta. Gracias 🙏`
      )
      window.open(`https://wa.me/51${tel}?text=${msg}`, '_blank')

      if (!url) addToast('Mensaje enviado, pero no se pudo adjuntar el link del PDF', 'warning')
    } catch {
      addToast('Error preparando el envío', 'error')
    } finally {
      setEnviandoWA(null)
    }
  }

  /** Para los botones de la lista, donde aun no tenemos los detalles cargados */
  const enviarPorWhatsAppDesdeListado = async (cot: Cotizacion) => {
    try {
      const detalles = await getCotizacionDetalles(cot.id)
      await enviarPorWhatsApp(cot, detalles)
    } catch { addToast('Error cargando detalle','error') }
  }

  const isVigente = (f: string) => new Date(f) >= new Date()
  const filtradas = cotizaciones.filter(c => filtroEstado==='Todas' || (c.estado||'Activa')===filtroEstado)

  const total     = cotizaciones.length
  const activas   = cotizaciones.filter(c=>(c.estado||'Activa')==='Activa').length
  const completas = cotizaciones.filter(c=>c.estado==='Completada').length

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando...</div>

  return (
    <div>
      <ToastContainer toasts={toasts} onClose={removeToast}/>
      <ConfirmModal open={!!confirmId} titulo="Eliminar Cotización" mensaje="¿Eliminar esta cotización?" tipo="danger" onConfirm={handleEliminar} onCancel={()=>setConfirmId(null)}/>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border p-3 md:p-4"><p className="text-xs text-gray-500">Total</p><p className="text-xl md:text-2xl font-bold text-gray-900">{total}</p></div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-3 md:p-4"><p className="text-xs text-blue-700">Activas</p><p className="text-xl md:text-2xl font-bold text-blue-900">{activas}</p></div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-3 md:p-4"><p className="text-xs text-green-700">Completadas</p><p className="text-xl md:text-2xl font-bold text-green-900">{completas}</p></div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        {(['Todas','Activa','Completada'] as const).map(f=>(
          <button key={f} onClick={()=>setFiltroEstado(f)}
            className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-sm font-medium transition-colors ${filtroEstado===f?'bg-blue-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* ── MÓVIL: cards ── */}
      <div className="md:hidden space-y-3">
        {filtradas.length === 0
          ? <div className="bg-white rounded-xl border p-10 text-center text-gray-400">No hay cotizaciones</div>
          : filtradas.map(cot => {
            const estado = cot.estado || 'Activa'
            const vigente = isVigente(cot.fecha_vencimiento)
            const enviando = enviandoWA === cot.id
            return (
              <div key={cot.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-mono text-sm font-bold text-blue-700">{cot.correlativo}</p>
                    <p className="font-semibold text-gray-900 mt-0.5">{cot.cliente_nombre}</p>
                    <p className="text-sm text-gray-500">{cot.proyecto_nombre}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900 text-lg">S/ {cot.monto_total.toFixed(2)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${vigente?'bg-green-100 text-green-700':'bg-red-100 text-red-600'}`}>
                      {vigente?'Vigente':'Expirada'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100">
                  <span className={`flex-1 text-xs px-2 py-1 rounded-full font-medium text-center ${estado==='Completada'?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>
                    {estado}
                  </span>
                  <button onClick={()=>abrirVer(cot)} disabled={cargando} title="Ver detalle" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Eye className="w-4 h-4"/></button>
                  <button onClick={()=>handlePDFInsumosDesdeListado(cot)} title="PDF de insumos" className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg"><Package className="w-4 h-4"/></button>
                  <button onClick={()=>enviarPorWhatsAppDesdeListado(cot)} disabled={enviando} title="Enviar por WhatsApp" className="p-2 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-40">
                    {enviando ? <Loader2 className="w-4 h-4 animate-spin"/> : <MessageCircle className="w-4 h-4"/>}
                  </button>
                  <button onClick={()=>handleMarcarCompletada(cot)} title="Marcar completada" className={`p-2 rounded-lg ${estado==='Completada'?'text-gray-400 hover:bg-gray-100':'text-green-600 hover:bg-green-50'}`}><CheckCircle className="w-4 h-4"/></button>
                  <button onClick={()=>setConfirmId(cot.id)} title="Eliminar" className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
            )
          })
        }
      </div>

      {/* ── DESKTOP: tabla ── */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtradas.length === 0
          ? <div className="text-center py-12 text-gray-400">No hay cotizaciones</div>
          : <table className="w-full">
              <thead><tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Correlativo</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Cliente</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Proyecto</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Vigencia</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Estado</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Total</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Acciones</th>
              </tr></thead>
              <tbody>{filtradas.map(cot=>{
                const estado = cot.estado||'Activa'
                const vigente = isVigente(cot.fecha_vencimiento)
                const enviando = enviandoWA === cot.id
                return (
                  <tr key={cot.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm font-medium text-blue-700">{cot.correlativo}</td>
                    <td className="px-4 py-3"><p className="font-medium text-sm text-gray-900">{cot.cliente_nombre}</p></td>
                    <td className="px-4 py-3 text-sm text-gray-700">{cot.proyecto_nombre}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${vigente?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>
                        {vigente?'Vigente':'Expirada'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${estado==='Completada'?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>{estado}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">S/ {cot.monto_total.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={()=>abrirVer(cot)} disabled={cargando} title="Ver detalle" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Eye className="w-4 h-4"/></button>
                        <button onClick={()=>handlePDFInsumosDesdeListado(cot)} title="PDF de insumos" className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg"><Package className="w-4 h-4"/></button>
                        <button onClick={()=>enviarPorWhatsAppDesdeListado(cot)} disabled={enviando} title="Enviar por WhatsApp" className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-40">
                          {enviando ? <Loader2 className="w-4 h-4 animate-spin"/> : <MessageCircle className="w-4 h-4"/>}
                        </button>
                        <button onClick={()=>handleMarcarCompletada(cot)} title="Marcar completada" className={`p-1.5 rounded-lg ${estado==='Completada'?'text-gray-400 hover:bg-gray-100':'text-green-600 hover:bg-green-50'}`}><CheckCircle className="w-4 h-4"/></button>
                        <button onClick={()=>setConfirmId(cot.id)} title="Eliminar" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </td>
                  </tr>
                )
              })}</tbody>
            </table>
        }
      </div>

      {/* Modal detalle */}
      {modalVer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b flex justify-between items-start sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-base font-semibold">{modalVer.cot.correlativo}</h2>
                <p className="text-sm text-gray-500">{modalVer.cot.cliente_nombre} · S/ {modalVer.cot.monto_total.toFixed(2)}</p>
              </div>
              <button onClick={()=>setModalVer(null)} className="text-gray-400 text-2xl leading-none ml-4">✕</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {modalVer.detalles.map(d=>(
                <div key={d.id} className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
                  <p className="text-sm text-gray-800 flex-1">{d.descripcion}</p>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-500">{d.cantidad.toFixed(2)} × S/{d.precio_unitario.toFixed(2)}</p>
                    <p className="font-semibold text-sm">S/ {d.total_item.toFixed(2)}</p>
                  </div>
                </div>
              ))}
              {modalVer.insumos.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Insumos ({modalVer.insumos.length})</p>
                  <div className="space-y-1.5">
                    {modalVer.insumos.map(ins=>(
                      <div key={ins.id} onClick={()=>toggleComprado(ins)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl border cursor-pointer text-sm ${ins.comprado?'bg-green-50 border-green-200':'bg-white border-gray-200'}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${ins.comprado?'bg-green-500 border-green-500 text-white':'border-gray-300'}`}>
                            {ins.comprado&&<span className="text-[10px]">✓</span>}
                          </div>
                          <span className={ins.comprado?'line-through text-gray-400':'text-gray-800'}>{ins.material_nombre}</span>
                        </div>
                        <span className="text-gray-600 font-medium">{ins.cantidad_estimada} {ins.unidad}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t sticky bottom-0 bg-white grid grid-cols-2 gap-2 sm:gap-3">
              <button onClick={()=>handleMarcarCompletada(modalVer.cot)}
                className={`py-2.5 rounded-xl font-medium text-sm ${(modalVer.cot.estado||'Activa')==='Completada'?'bg-gray-100 text-gray-700':'bg-green-600 hover:bg-green-700 text-white'}`}>
                {(modalVer.cot.estado||'Activa')==='Completada'?'Reactivar':'Completada'}
              </button>
              <button onClick={()=>handlePDFCotizacion(modalVer.cot, modalVer.detalles)}
                className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                <FileText className="w-4 h-4"/>PDF Cliente
              </button>
              <button onClick={()=>handlePDFInsumos(modalVer.cot, modalVer.insumos)}
                className="py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                <Package className="w-4 h-4"/>PDF Insumos
              </button>
              <button onClick={()=>enviarPorWhatsApp(modalVer.cot, modalVer.detalles)} disabled={enviandoWA===modalVer.cot.id}
                className="py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                {enviandoWA===modalVer.cot.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <MessageCircle className="w-4 h-4"/>}
                WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default ListadoTab
