import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, CheckCircle, Clock } from 'lucide-react'
import { getGastos, createGasto, updateGasto, deleteGasto } from '@/lib/finanzas'
import { GastoPersonal } from '@/types/index'
import { useToast, ToastContainer, ConfirmModal } from '@/components/Toast'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const localDate = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-PE')

const GastosTab: React.FC = () => {
  const [gastos, setGastos]       = useState<GastoPersonal[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const { toasts, addToast, removeToast } = useToast()

  const hoy = new Date()
  const [filtroMes,    setFiltroMes]    = useState(hoy.getMonth() + 1)
  const [filtroAnio,   setFiltroAnio]   = useState(hoy.getFullYear())
  const [filtroEstado, setFiltroEstado] = useState<'Todos'|'Pendiente'|'Pagado'>('Todos')
  const [form, setForm] = useState({ concepto:'', fecha_vencimiento:'', monto:'', estado:'Pendiente' as 'Pendiente'|'Pagado' })

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

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editItem) return
    try {
      await updateGasto(editItem.id, { concepto: editItem.concepto, fecha_vencimiento: editItem.fecha_vencimiento, monto: editItem.monto, estado: editItem.estado })
      setEditItem(null); addToast('Gasto actualizado','success'); loadGastos()
    } catch { addToast('Error actualizando','error') }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.monto || parseFloat(form.monto) <= 0) { addToast('Ingresa un monto válido','error'); return }
    try {
      await createGasto({ concepto:form.concepto, fecha_vencimiento:form.fecha_vencimiento, monto:parseFloat(form.monto), estado:form.estado })
      setForm({ concepto:'', fecha_vencimiento:'', monto:'', estado:'Pendiente' })
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
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border p-3 md:p-4">
          <p className="text-xs md:text-sm text-gray-500">Gastos</p>
          <p className="text-xl md:text-2xl font-bold text-gray-900">{gastosFiltrados.length}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-3 md:p-4">
          <p className="text-xs text-yellow-700">Pendiente</p>
          <p className="text-base md:text-2xl font-bold text-yellow-800">S/ {totalPendiente.toFixed(2)}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-3 md:p-4">
          <p className="text-xs text-green-700">Pagado</p>
          <p className="text-base md:text-2xl font-bold text-green-800">S/ {totalPagado.toFixed(2)}</p>
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
                  <p className="font-semibold text-gray-900">{g.concepto}</p>
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
                <button onClick={()=>setEditItem({...g})} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
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
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Vencimiento</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Monto</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Estado</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Acción</th>
              </tr></thead>
              <tbody>{gastosFiltrados.map(g=>(
                <tr key={g.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 text-sm">{g.concepto}</td>
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
                      <button onClick={()=>setEditItem({...g})} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                      <button onClick={()=>setConfirmId(g.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
        }
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">
            <div className="px-5 py-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Nuevo Gasto</h2>
              <button onClick={()=>setShowModal(false)} className="text-gray-400 text-2xl leading-none">✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Concepto</label>
                  <input type="text" className={inp} placeholder="Ej: Internet, Colegio..."
                    value={form.concepto} onChange={e=>setForm({...form,concepto:e.target.value})} required/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Fecha Vencimiento</label>
                    <input type="date" className={inp} value={form.fecha_vencimiento}
                      onChange={e=>setForm({...form,fecha_vencimiento:e.target.value})} required/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Monto (S/)</label>
                    <input type="number" step="0.01" min="0.01" className={inp} placeholder="0.00"
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
              </div>
              <div className="px-5 py-4 border-t grid grid-cols-2 gap-3">
                <button type="button" onClick={()=>setShowModal(false)}
                  className="py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium text-sm">Cancelar</button>
                <button type="submit"
                  className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Editar */}
      {editItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Fecha Vencimiento</label>
                    <input type="date" className={inp} value={editItem.fecha_vencimiento}
                      onChange={e=>setEditItem({...editItem,fecha_vencimiento:e.target.value})} required/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Monto (S/)</label>
                    <input type="number" step="0.01" min="0.01" className={inp} value={editItem.monto}
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
              </div>
              <div className="px-5 py-4 border-t grid grid-cols-2 gap-3">
                <button type="button" onClick={()=>setEditItem(null)}
                  className="py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium text-sm">Cancelar</button>
                <button type="submit"
                  className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default GastosTab
