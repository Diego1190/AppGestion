import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, CheckCircle, Clock, Pencil, Repeat, Sparkles } from 'lucide-react'
import { getGastos, createGasto, updateGasto, deleteGasto } from '@/lib/finanzas'
import { GastoPersonal } from '@/types/index'
import { useToast, ToastContainer, ConfirmModal } from '@/components/Toast'
import { Modal } from '@/components/ui/Modal'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import { MONTO_MAXIMO_RAZONABLE, mesAnioAnterior } from '@/lib/calculations'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const localDate = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-PE')

const GastosTab: React.FC = () => {
  const [gastos, setGastos]       = useState<GastoPersonal[]>([])
  const [editItem, setEditItem]   = useState<GastoPersonal | null>(null)
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const { toasts, addToast, removeToast } = useToast()

  const hoy = new Date()
  const [filtroMes,    setFiltroMes]    = useState(hoy.getMonth() + 1)
  const [filtroAnio,   setFiltroAnio]   = useState(hoy.getFullYear())
  const [filtroEstado, setFiltroEstado] = useState<'Todos'|'Pendiente'|'Pagado'>('Todos')
  const [form, setForm] = useState({ concepto:'', detalle:'', fecha_vencimiento:'', monto:'', estado:'Pendiente' as 'Pendiente'|'Pagado', es_fijo:false })

  const loadGastos = async () => {
    try { setLoading(true); setGastos(await getGastos()) }
    catch { addToast('Error cargando gastos','error') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadGastos() }, [])
  useRealtimeSync('gastos_personales', loadGastos)

  const gastosFiltrados = useMemo(() => gastos.filter(g => {
    const f = new Date(g.fecha_vencimiento + 'T00:00:00')
    return f.getMonth()+1 === filtroMes && f.getFullYear() === filtroAnio &&
      (filtroEstado === 'Todos' || g.estado === filtroEstado)
  }), [gastos, filtroMes, filtroAnio, filtroEstado])

  const totalPendiente = gastosFiltrados.filter(g=>g.estado==='Pendiente').reduce((s,g)=>s+g.monto,0)
  const totalPagado    = gastosFiltrados.filter(g=>g.estado==='Pagado').reduce((s,g)=>s+g.monto,0)
  const isVencido = (f: string) => new Date(f+'T00:00:00') < new Date()

  // Gastos marcados como fijos en el mes anterior, que todavía no se agregaron al mes/año
  // actualmente filtrado. Solo se sugieren — el usuario decide si los agrega o no.
  const fijosSugeridos = useMemo(() => {
    const { mes: mesAnt, anio: anioAnt } = mesAnioAnterior(filtroMes, filtroAnio)
    const fijosMesAnterior = gastos.filter(g => {
      const f = new Date(g.fecha_vencimiento + 'T00:00:00')
      return g.es_fijo && f.getMonth()+1 === mesAnt && f.getFullYear() === anioAnt
    })
    const conceptosEsteMes = new Set(gastosFiltrados.map(g => g.concepto.trim().toLowerCase()))
    return fijosMesAnterior.filter(g => !conceptosEsteMes.has(g.concepto.trim().toLowerCase()))
  }, [gastos, gastosFiltrados, filtroMes, filtroAnio])

  const agregarFijoSugerido = async (g: GastoPersonal) => {
    try {
      const fechaSugerida = new Date(g.fecha_vencimiento + 'T00:00:00')
      fechaSugerida.setMonth(fechaSugerida.getMonth() + 1) // mismo día, mes actual filtrado
      await createGasto({
        concepto: g.concepto, detalle: g.detalle, monto: g.monto, estado: 'Pendiente',
        fecha_vencimiento: fechaSugerida.toISOString().split('T')[0],
        es_fijo: true,
      })
      addToast(`"${g.concepto}" agregado a ${MESES[filtroMes-1]}`, 'success')
      loadGastos()
    } catch { addToast('Error agregando gasto fijo', 'error') }
  }

  /** Último detalle usado para un concepto ya existente, ordenado por fecha más reciente.
   *  Permite sugerir "Plan 100MB" automáticamente al volver a escribir "Celular". */
  const ultimoDetallePorConcepto = (concepto: string): string | undefined => {
    const coincidencias = gastos
      .filter(g => g.concepto.trim().toLowerCase() === concepto.trim().toLowerCase() && g.detalle)
      .sort((a, b) => new Date(b.fecha_vencimiento).getTime() - new Date(a.fecha_vencimiento).getTime())
    return coincidencias[0]?.detalle
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editItem) return
    if (editItem.monto > MONTO_MAXIMO_RAZONABLE) { addToast(`El monto parece demasiado alto (más de S/ ${MONTO_MAXIMO_RAZONABLE}). Verifica que no sea un error de tecleo.`,'error'); return }
    try {
      await updateGasto(editItem.id, { concepto: editItem.concepto, detalle: editItem.detalle, fecha_vencimiento: editItem.fecha_vencimiento, monto: editItem.monto, estado: editItem.estado, es_fijo: editItem.es_fijo })
      setEditItem(null); addToast('Gasto actualizado','success'); loadGastos()
    } catch { addToast('Error actualizando','error') }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.monto || parseFloat(form.monto) <= 0) { addToast('Ingresa un monto válido','error'); return }
    if (parseFloat(form.monto) > MONTO_MAXIMO_RAZONABLE) { addToast(`El monto parece demasiado alto (más de S/ ${MONTO_MAXIMO_RAZONABLE}). Verifica que no sea un error de tecleo.`,'error'); return }
    try {
      await createGasto({ concepto:form.concepto, detalle:form.detalle||undefined, fecha_vencimiento:form.fecha_vencimiento, monto:parseFloat(form.monto), estado:form.estado, es_fijo:form.es_fijo })
      setForm({ concepto:'', detalle:'', fecha_vencimiento:'', monto:'', estado:'Pendiente', es_fijo:false })
      setShowModal(false); addToast('Gasto registrado','success'); loadGastos()
    } catch (err: any) { addToast(err.message||'Error guardando','error') }
  }

  const toggleEstado = async (g: GastoPersonal) => {
    try { await updateGasto(g.id, { estado: g.estado==='Pendiente'?'Pagado':'Pendiente' }); loadGastos() }
    catch { addToast('Error actualizando','error') }
  }

  const handleEliminar = async () => {
    if (!confirmId) return
    try { await deleteGasto(confirmId); setConfirmId(null); addToast('Gasto eliminado','warning'); loadGastos() }
    catch { addToast('Error eliminando','error') }
  }

  const inp = "w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando...</div>

  return (
    <div>
      <ToastContainer toasts={toasts} onClose={removeToast}/>
      <ConfirmModal open={!!confirmId} titulo="Eliminar Gasto" mensaje="¿Eliminar este gasto?" tipo="danger" onConfirm={handleEliminar} onCancel={()=>setConfirmId(null)}/>

      {/* Resumen */}
      <div className="bg-white rounded-xl border p-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-gray-500">{gastosFiltrados.length} gasto{gastosFiltrados.length!==1?'s':''} este mes</p>
          <p className="text-lg font-bold text-gray-900">S/ {(totalPendiente+totalPagado).toFixed(2)}</p>
        </div>
        <div className="h-2 rounded-full bg-yellow-100 overflow-hidden mb-2">
          <div className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${(totalPendiente+totalPagado) > 0 ? (totalPagado/(totalPendiente+totalPagado))*100 : 0}%` }}/>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-green-700 font-medium">Pagado S/ {totalPagado.toFixed(2)}</span>
          <span className="text-yellow-700 font-medium">Pendiente S/ {totalPendiente.toFixed(2)}</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-2">
          <select className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filtroMes} onChange={e=>setFiltroMes(parseInt(e.target.value))}>
            {MESES.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
          </select>
          <select className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filtroAnio} onChange={e=>setFiltroAnio(parseInt(e.target.value))}>
            {[2023,2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex gap-1">
          {(['Todos','Pendiente','Pagado'] as const).map(f=>(
            <button key={f} onClick={()=>setFiltroEstado(f)}
              className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-sm font-medium transition-colors ${filtroEstado===f?'bg-blue-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f}
            </button>
          ))}
        </div>
        <button onClick={()=>setShowModal(true)}
          className="sm:ml-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium text-sm">
          <Plus className="w-4 h-4"/>Nuevo Gasto
        </button>
      </div>

      {/* Sugerencia: gastos fijos del mes anterior que aún no están en el mes filtrado */}
      {fijosSugeridos.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <p className="text-sm font-medium text-amber-800 flex items-center gap-1.5 mb-2">
            <Sparkles className="w-4 h-4"/>Tienes {fijosSugeridos.length} gasto{fijosSugeridos.length!==1?'s':''} fijo{fijosSugeridos.length!==1?'s':''} pendiente{fijosSugeridos.length!==1?'s':''} de agregar a {MESES[filtroMes-1]}
          </p>
          <div className="space-y-1.5">
            {fijosSugeridos.map(g => (
              <div key={g.id} className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 border border-amber-100">
                <span className="text-sm text-gray-700">{g.concepto} <span className="text-gray-400">— S/ {g.monto.toFixed(2)}</span></span>
                <button onClick={()=>agregarFijoSugerido(g)}
                  className="text-xs px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium flex items-center gap-1 flex-shrink-0">
                  <Plus className="w-3 h-3"/>Agregar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MÓVIL: cards ── */}
      <div className="md:hidden space-y-2">
        {gastosFiltrados.length === 0
          ? <div className="bg-white rounded-xl border p-10 text-center text-gray-400">
              No hay gastos en {MESES[filtroMes-1]} {filtroAnio}
            </div>
          : gastosFiltrados.map(g=>(
            <div key={g.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 flex items-center gap-1.5">
                    {g.concepto}
                    {g.es_fijo && <Repeat className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" aria-label="Gasto fijo mensual"/>}
                  </p>
                  {g.detalle && <p className="text-xs text-gray-400 mt-0.5">{g.detalle}</p>}
                  <p className={`text-sm mt-0.5 ${isVencido(g.fecha_vencimiento)&&g.estado==='Pendiente'?'text-red-600 font-medium':'text-gray-500'}`}>
                    Vence: {localDate(g.fecha_vencimiento)}
                    {isVencido(g.fecha_vencimiento)&&g.estado==='Pendiente'&&
                      <span className="ml-1.5 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">VENCIDO</span>}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-gray-900 text-xl">S/ {g.monto.toFixed(2)}</p>
                  <button onClick={()=>toggleEstado(g)} className="mt-1.5">
                    {g.estado==='Pagado'
                      ? <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium"><CheckCircle className="w-3 h-3"/>Pagado</span>
                      : <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium"><Clock className="w-3 h-3"/>Pendiente</span>}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-gray-100">
                <button onClick={()=>setEditItem({...g})} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Editar"><Pencil className="w-4 h-4"/></button>
                <button onClick={()=>setConfirmId(g.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
              </div>
            </div>
          ))
        }
      </div>

      {/* ── DESKTOP: tabla ── */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        {gastosFiltrados.length === 0
          ? <div className="text-center py-12 text-gray-400">No hay gastos en {MESES[filtroMes-1]} {filtroAnio}</div>
          : <table className="w-full">
              <thead><tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Concepto</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Detalle</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Vencimiento</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Monto</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Estado</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Acción</th>
              </tr></thead>
              <tbody>{gastosFiltrados.map(g=>(
                <tr key={g.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 text-sm">
                    <span className="flex items-center gap-1.5">
                      {g.concepto}
                      {g.es_fijo && <Repeat className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" aria-label="Gasto fijo mensual"/>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{g.detalle || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={isVencido(g.fecha_vencimiento)&&g.estado==='Pendiente'?'text-red-600 font-medium':'text-gray-600'}>
                      {localDate(g.fecha_vencimiento)}
                    </span>
                    {isVencido(g.fecha_vencimiento)&&g.estado==='Pendiente'&&
                      <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">VENCIDO</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 text-sm">S/ {g.monto.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={()=>toggleEstado(g)}>
                      {g.estado==='Pagado'
                        ? <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium"><CheckCircle className="w-3 h-3"/>Pagado</span>
                        : <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium"><Clock className="w-3 h-3"/>Pendiente</span>}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={()=>setEditItem({...g})} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Editar"><Pencil className="w-4 h-4"/></button>
                      <button onClick={()=>setConfirmId(g.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
        }
      </div>

      {/* Modal */}
      <Modal open={showModal}>
          <div className="px-5 py-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold">Nuevo Gasto</h2>
            <button onClick={()=>setShowModal(false)} className="text-gray-400 text-2xl leading-none">✕</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Concepto</label>
                <input type="text" className={inp} placeholder="Ej: Internet, Colegio..."
                  value={form.concepto}
                  onChange={e=>{
                    const nuevoConcepto = e.target.value
                    const sugerido = ultimoDetallePorConcepto(nuevoConcepto)
                    setForm(f => ({ ...f, concepto: nuevoConcepto, detalle: sugerido ?? f.detalle }))
                  }} required/>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Detalle <span className="text-gray-400 font-normal">opcional</span></label>
                <input type="text" className={inp} placeholder="Ej: Plan 100MB, N° de medidor..."
                  value={form.detalle} onChange={e=>setForm({...form,detalle:e.target.value})}/>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Fecha Vencimiento</label>
                  <input type="date" className={inp} value={form.fecha_vencimiento}
                    onChange={e=>setForm({...form,fecha_vencimiento:e.target.value})} required/>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Monto (S/)</label>
                  <input type="number" step="0.01" min="0.01" max="50000" className={inp} placeholder="0.00"
                    value={form.monto} onChange={e=>setForm({...form,monto:e.target.value})} required/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Estado</label>
                <select className={inp} value={form.estado} onChange={e=>setForm({...form,estado:e.target.value as any})}>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Pagado">Pagado</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer bg-gray-50 rounded-lg px-3 py-2.5">
                <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={form.es_fijo}
                  onChange={e=>setForm({...form, es_fijo:e.target.checked})}/>
                <span className="text-sm text-gray-700">Es un gasto fijo mensual (Internet, Colegio, etc.)</span>
              </label>
            </div>
            <div className="px-5 py-4 border-t grid grid-cols-2 gap-3">
              <button type="button" onClick={()=>setShowModal(false)}
                className="py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium text-sm">Cancelar</button>
              <button type="submit"
                className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm">Guardar</button>
            </div>
          </form>
      </Modal>
      {/* Modal Editar */}
      <Modal open={!!editItem}>
        {editItem && (
          <>
            <div className="px-5 py-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Editar Gasto</h2>
              <button onClick={()=>setEditItem(null)} className="text-gray-400 text-2xl leading-none">✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Concepto</label>
                  <input type="text" className={inp} value={editItem.concepto}
                    onChange={e=>setEditItem({...editItem,concepto:e.target.value})} required/>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Detalle <span className="text-gray-400 font-normal">opcional</span></label>
                  <input type="text" className={inp} placeholder="Ej: Plan 100MB, N° de medidor..."
                    value={editItem.detalle||''} onChange={e=>setEditItem({...editItem,detalle:e.target.value})}/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Fecha Vencimiento</label>
                    <input type="date" className={inp} value={editItem.fecha_vencimiento}
                      onChange={e=>setEditItem({...editItem,fecha_vencimiento:e.target.value})} required/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Monto (S/)</label>
                    <input type="number" step="0.01" min="0.01" max="50000" className={inp} value={editItem.monto}
                      onChange={e=>setEditItem({...editItem,monto:parseFloat(e.target.value)||0})} required/>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Estado</label>
                  <select className={inp} value={editItem.estado}
                    onChange={e=>setEditItem({...editItem,estado:e.target.value as any})}>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Pagado">Pagado</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer bg-gray-50 rounded-lg px-3 py-2.5">
                  <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={!!editItem.es_fijo}
                    onChange={e=>setEditItem({...editItem, es_fijo:e.target.checked})}/>
                  <span className="text-sm text-gray-700">Es un gasto fijo mensual</span>
                </label>
              </div>
              <div className="px-5 py-4 border-t grid grid-cols-2 gap-3">
                <button type="button" onClick={()=>setEditItem(null)}
                  className="py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium text-sm">Cancelar</button>
                <button type="submit"
                  className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm">Guardar</button>
              </div>
            </form>
          </>
        )}
      </Modal>
    </div>
  )
}

export default GastosTab
