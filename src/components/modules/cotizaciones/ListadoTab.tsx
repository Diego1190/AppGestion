import React, { useState, useEffect } from 'react'
import { Eye, Download, Trash2, Package, CheckCircle, Clock } from 'lucide-react'
import { getCotizaciones, deleteCotizacion, getCotizacionDetalles, getCotizacionInsumos, updateInsumo, updateCotizacionEstado } from '@/lib/cotizaciones'
import { generarPDFCotizacion, generarPDFInsumos } from '@/lib/pdf'
import { Cotizacion, CotizacionDetalle, CotizacionInsumo } from '@/types/index'
import { useToast, ToastContainer, ConfirmModal } from '@/components/Toast'

const BADGES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  Activa:     { bg: 'bg-blue-100',   text: 'text-blue-700',  icon: <Clock className="w-3 h-3"/> },
  Completada: { bg: 'bg-green-100',  text: 'text-green-700', icon: <CheckCircle className="w-3 h-3"/> },
  Cancelada:  { bg: 'bg-red-100',    text: 'text-red-700',   icon: null },
}

const ListadoTab: React.FC = () => {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [modalVer, setModalVer] = useState<{ cot: Cotizacion; detalles: CotizacionDetalle[]; insumos: CotizacionInsumo[] } | null>(null)
  const [modalInsumos, setModalInsumos] = useState<{ cot: Cotizacion; insumos: CotizacionInsumo[] } | null>(null)
  const [cargandoModal, setCargandoModal] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState<'Todas' | 'Activa' | 'Completada'>('Todas')
  const { toasts, addToast, removeToast } = useToast()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try { setLoading(true); setCotizaciones(await getCotizaciones()) }
    catch { addToast('Error cargando cotizaciones', 'error') }
    finally { setLoading(false) }
  }

  const abrirVer = async (cot: Cotizacion) => {
    setCargandoModal(true)
    try {
      const [detalles, insumos] = await Promise.all([getCotizacionDetalles(cot.id), getCotizacionInsumos(cot.id)])
      setModalVer({ cot, detalles, insumos })
    } catch { addToast('Error cargando detalle', 'error') }
    finally { setCargandoModal(false) }
  }

  const abrirInsumos = async (cot: Cotizacion) => {
    setCargandoModal(true)
    try {
      const insumos = await getCotizacionInsumos(cot.id)
      setModalInsumos({ cot, insumos })
    } catch { addToast('Error cargando insumos', 'error') }
    finally { setCargandoModal(false) }
  }

  const toggleComprado = async (insumo: CotizacionInsumo) => {
    try {
      await updateInsumo(insumo.id, { comprado: !insumo.comprado })
      const update = (prev: typeof modalInsumos) => prev ? { ...prev, insumos: prev.insumos.map(i => i.id === insumo.id ? { ...i, comprado: !i.comprado } : i) } : null
      setModalInsumos(update)
      setModalVer(prev => prev ? { ...prev, insumos: prev.insumos.map(i => i.id === insumo.id ? { ...i, comprado: !i.comprado } : i) } : null)
    } catch { addToast('Error actualizando', 'error') }
  }

  const handleEliminar = async () => {
    if (!confirmId) return
    try { await deleteCotizacion(confirmId); setConfirmId(null); addToast('Cotización eliminada', 'warning'); loadData() }
    catch { addToast('Error eliminando', 'error') }
  }

  const handleMarcarCompletada = async (cot: Cotizacion) => {
    const nuevoEstado = cot.estado === 'Completada' ? 'Activa' : 'Completada'
    try {
      await updateCotizacionEstado(cot.id, nuevoEstado)
      addToast(`Cotización marcada como ${nuevoEstado}`, 'success')
      loadData()
    } catch { addToast('Error actualizando estado', 'error') }
  }

  const isVigente = (f: string) => new Date(f) >= new Date()

  const filtradas = cotizaciones.filter(c =>
    filtroEstado === 'Todas' ? true : (c.estado || 'Activa') === filtroEstado
  )

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando...</div>

  return (
    <div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <ConfirmModal open={!!confirmId} titulo="Eliminar Cotización" mensaje="¿Eliminar esta cotización y todos sus detalles?" tipo="danger" onConfirm={handleEliminar} onCancel={() => setConfirmId(null)} />

      {/* Resumen rápido */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-xl border p-4"><p className="text-sm text-gray-500">Total</p><p className="text-2xl font-bold text-gray-900">{cotizaciones.length}</p></div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4"><p className="text-sm text-blue-700">Activas</p><p className="text-2xl font-bold text-blue-900">{cotizaciones.filter(c=>(c.estado||'Activa')==='Activa').length}</p></div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4"><p className="text-sm text-green-700">Completadas</p><p className="text-2xl font-bold text-green-900">{cotizaciones.filter(c=>c.estado==='Completada').length}</p></div>
      </div>

      {/* Filtro */}
      <div className="flex gap-2 mb-4">
        {(['Todas','Activa','Completada'] as const).map(f => (
          <button key={f} onClick={() => setFiltroEstado(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtroEstado===f?'bg-blue-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtradas.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No hay cotizaciones. Crea la primera.</div>
        ) : (
          <div className="overflow-x-auto -mx-1"><table className="w-full min-w-[600px]">
            <thead><tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Correlativo</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Cliente</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Proyecto</th>
              <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Vigencia</th>
              <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Estado</th>
              <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Total</th>
              <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Acciones</th>
            </tr></thead>
            <tbody>
              {filtradas.map(cot => {
                const estado = cot.estado || 'Activa'
                const badge = BADGES[estado] || BADGES.Activa
                return (
                  <tr key={cot.id} className={`border-b border-gray-100 hover:bg-gray-50 ${estado==='Completada'?'opacity-80':''}`}>
                    <td className="px-4 py-3 font-mono text-sm font-medium text-blue-700">{cot.correlativo}</td>
                    <td className="px-4 py-3"><p className="font-medium text-gray-900 text-sm">{cot.cliente_nombre}</p>{cot.cliente_empresa&&<p className="text-xs text-gray-500">{cot.cliente_empresa}</p>}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{cot.proyecto_nombre}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${isVigente(cot.fecha_vencimiento)?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>
                        {isVigente(cot.fecha_vencimiento)?'Vigente':'Expirada'}
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(cot.fecha_vencimiento+'T00:00:00').toLocaleDateString('es-PE')}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                        {badge.icon}{estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">S/ {cot.monto_total.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => abrirVer(cot)} title="Ver detalle" disabled={cargandoModal} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Eye className="w-4 h-4"/></button>
                        <button onClick={() => abrirInsumos(cot)} title="Ver insumos" disabled={cargandoModal} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg"><Package className="w-4 h-4"/></button>
                        <button
                          onClick={() => handleMarcarCompletada(cot)}
                          title={estado === 'Completada' ? 'Reactivar' : 'Marcar como completada'}
                          className={`p-1.5 rounded-lg transition-colors ${estado==='Completada'?'text-gray-400 hover:bg-gray-100':'text-green-600 hover:bg-green-50'}`}>
                          <CheckCircle className="w-4 h-4"/>
                        </button>
                        <button onClick={() => setConfirmId(cot.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        )}
      </div>

      {/* Modal Ver */}
      {modalVer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex justify-between items-start sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-semibold">Cotización {modalVer.cot.correlativo}</h2>
                <p className="text-sm text-gray-500">Emitida: {new Date(modalVer.cot.fecha_emision+'T00:00:00').toLocaleDateString('es-PE')} · Vigente hasta: {new Date(modalVer.cot.fecha_vencimiento+'T00:00:00').toLocaleDateString('es-PE')}</p>
              </div>
              <button onClick={() => setModalVer(null)} className="text-gray-400 text-xl ml-4">✕</button>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-2 gap-6 mb-5">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Cliente</p>
                  <p className="font-medium text-gray-900">{modalVer.cot.cliente_nombre}</p>
                  {modalVer.cot.cliente_empresa&&<p className="text-sm text-gray-600">{modalVer.cot.cliente_empresa}</p>}
                  <p className="text-sm text-gray-600">{modalVer.cot.cliente_telefono}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Proyecto</p>
                  <p className="font-medium text-gray-900">{modalVer.cot.proyecto_nombre}</p>
                  <p className="text-sm text-gray-600">{modalVer.cot.proyecto_direccion}</p>
                  <p className="text-sm text-gray-600">{modalVer.cot.proyecto_distrito}</p>
                </div>
              </div>

              <div className="overflow-x-auto -mx-1"><table className="w-full min-w-[600px] mb-4">
                <thead><tr className="bg-gray-50 border-b">
                  <th className="text-left px-3 py-2 text-sm font-semibold">Descripción</th>
                  <th className="text-center px-3 py-2 text-sm font-semibold">Cant.</th>
                  <th className="text-right px-3 py-2 text-sm font-semibold">P. Unit.</th>
                  <th className="text-right px-3 py-2 text-sm font-semibold">Total</th>
                </tr></thead>
                <tbody>
                  {modalVer.detalles.map(d => (
                    <tr key={d.id} className="border-b border-gray-100">
                      <td className="px-3 py-2 text-sm text-gray-800">{d.descripcion}</td>
                      <td className="px-3 py-2 text-center text-sm">{d.cantidad.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-sm">S/ {d.precio_unitario.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-sm">S/ {d.total_item.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>

              <div className="text-right space-y-1 border-t pt-3">
                <div className="flex justify-end gap-8 text-sm text-gray-600"><span>Total:</span><span className="font-bold text-lg">S/ {modalVer.cot.monto_total.toFixed(2)}</span></div>
              </div>

              {modalVer.insumos.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Insumos ({modalVer.insumos.length})</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {modalVer.insumos.map(ins => (
                      <div key={ins.id} onClick={() => toggleComprado(ins)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer text-sm ${ins.comprado?'bg-green-50 border-green-200':'bg-white border-gray-200'}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${ins.comprado?'bg-green-500 border-green-500 text-white':'border-gray-300'}`}>
                            {ins.comprado&&<span className="text-[10px] leading-none">✓</span>}
                          </div>
                          <span className={ins.comprado?'line-through text-gray-400':'text-gray-800'}>{ins.material_nombre}</span>
                        </div>
                        <span className="text-gray-600 font-medium">{ins.cantidad_estimada} {ins.unidad}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(modalVer.cot.condiciones_pago||modalVer.cot.garantia||modalVer.cot.facilidades_cliente) && (
                <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
                  {modalVer.cot.condiciones_pago&&<div><p className="font-semibold text-gray-700 mb-1">Condiciones de Pago</p><p className="text-gray-600">{modalVer.cot.condiciones_pago}</p></div>}
                  {modalVer.cot.garantia&&<div><p className="font-semibold text-gray-700 mb-1">Garantía</p><p className="text-gray-600">{modalVer.cot.garantia}</p></div>}
                  {modalVer.cot.facilidades_cliente&&<div className="col-span-2"><p className="font-semibold text-gray-700 mb-1">Facilidades / Tiempo</p><p className="text-gray-600">{modalVer.cot.facilidades_cliente}</p></div>}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white z-10">
              <button onClick={() => setModalVer(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm">Cerrar</button>
              <button onClick={() => { handleMarcarCompletada(modalVer.cot); setModalVer(null) }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm ${(modalVer.cot.estado||'Activa')==='Completada'?'bg-gray-200 text-gray-700':'bg-green-600 hover:bg-green-700 text-white'}`}>
                <CheckCircle className="w-4 h-4"/>
                {(modalVer.cot.estado||'Activa')==='Completada'?'Reactivar':'Marcar Completada'}
              </button>
              <button onClick={() => generarPDFCotizacion(modalVer.cot, modalVer.detalles).then(()=>addToast('PDF generado','success')).catch(()=>addToast('Error PDF','error'))}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm">
                <Package className="w-4 h-4"/>PDF Cliente
              </button>
              {modalVer.insumos.length>0&&(
                <button onClick={() => generarPDFInsumos(modalVer.cot, modalVer.insumos).then(()=>addToast('PDF insumos generado','success')).catch(()=>addToast('Error PDF','error'))}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm">
                  <Package className="w-4 h-4"/>PDF Insumos
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Insumos */}
      {modalInsumos && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex justify-between sticky top-0 bg-white">
              <div><h2 className="text-lg font-semibold">Lista de Insumos</h2><p className="text-sm text-gray-500">{modalInsumos.cot.correlativo}</p></div>
              <button onClick={() => setModalInsumos(null)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="px-6 py-4">
              <p className="text-xs text-gray-500 mb-3">{modalInsumos.insumos.filter(i=>i.comprado).length}/{modalInsumos.insumos.length} comprados — Click para marcar</p>
              <div className="space-y-2">
                {modalInsumos.insumos.map(ins => (
                  <div key={ins.id} onClick={() => toggleComprado(ins)}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border cursor-pointer transition-all ${ins.comprado?'bg-green-50 border-green-200':'bg-white border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${ins.comprado?'bg-green-500 border-green-500 text-white':'border-gray-300'}`}>
                        {ins.comprado&&<span className="text-xs">✓</span>}
                      </div>
                      <span className={`text-sm font-medium ${ins.comprado?'line-through text-gray-400':'text-gray-900'}`}>{ins.material_nombre}</span>
                    </div>
                    <span className="text-sm text-gray-600 font-medium">{ins.cantidad_estimada} {ins.unidad}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-2 justify-end sticky bottom-0 bg-white">
              <button onClick={() => setModalInsumos(null)} className="px-4 py-2 bg-gray-100 rounded-lg font-medium text-sm">Cerrar</button>
              <button onClick={() => generarPDFInsumos(modalInsumos.cot, modalInsumos.insumos).then(()=>addToast('PDF generado','success'))}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm">
                <Package className="w-4 h-4"/>Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default ListadoTab
