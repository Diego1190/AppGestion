import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, CheckCircle, Clock } from 'lucide-react'
import { getGastos, createGasto, updateGasto, deleteGasto } from '@/lib/finanzas'
import { GastoPersonal } from '@/types/index'
import { useToast, ToastContainer, ConfirmModal } from '@/components/Toast'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// Fecha local en Peru (UTC-5) — evita el problema de fecha UTC
const hoyLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const GastosTab: React.FC = () => {
  const [gastos, setGastos]       = useState<GastoPersonal[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const { toasts, addToast, removeToast } = useToast()

  // Filtros
  const hoy = new Date()
  const [filtroMes,    setFiltroMes]    = useState(hoy.getMonth() + 1)
  const [filtroAnio,   setFiltroAnio]   = useState(hoy.getFullYear())
  const [filtroEstado, setFiltroEstado] = useState<'Todos' | 'Pendiente' | 'Pagado'>('Todos')

  const [form, setForm] = useState({
    concepto: '', fecha_vencimiento: '', monto: '', estado: 'Pendiente' as 'Pendiente' | 'Pagado',
  })

  useEffect(() => { loadGastos() }, [])

  const loadGastos = async () => {
    try {
      setLoading(true)
      setGastos(await getGastos())
    } catch { addToast('Error cargando gastos', 'error') }
    finally { setLoading(false) }
  }

  // Filtrado client-side: mes, año y estado
  const gastosFiltrados = useMemo(() => {
    return gastos.filter(g => {
      const fecha = new Date(g.fecha_vencimiento + 'T00:00:00')
      const mismoMes  = fecha.getMonth() + 1 === filtroMes
      const mismoAnio = fecha.getFullYear()   === filtroAnio
      const mismoEstado = filtroEstado === 'Todos' || g.estado === filtroEstado
      return mismoMes && mismoAnio && mismoEstado
    })
  }, [gastos, filtroMes, filtroAnio, filtroEstado])

  const totalPendiente = gastosFiltrados.filter(g => g.estado === 'Pendiente').reduce((s, g) => s + g.monto, 0)
  const totalPagado    = gastosFiltrados.filter(g => g.estado === 'Pagado').reduce((s, g) => s + g.monto, 0)

  const isVencido = (fecha: string) => new Date(fecha + 'T00:00:00') < new Date()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.monto || parseFloat(form.monto) <= 0) { addToast('Ingresa un monto válido', 'error'); return }
    try {
      await createGasto({ concepto: form.concepto, fecha_vencimiento: form.fecha_vencimiento, monto: parseFloat(form.monto), estado: form.estado })
      setForm({ concepto: '', fecha_vencimiento: '', monto: '', estado: 'Pendiente' })
      setShowModal(false)
      addToast('Gasto registrado', 'success')
      loadGastos()
    } catch (err: any) { addToast(err.message || 'Error guardando', 'error') }
  }

  const toggleEstado = async (g: GastoPersonal) => {
    try {
      await updateGasto(g.id, { estado: g.estado === 'Pendiente' ? 'Pagado' : 'Pendiente' })
      loadGastos()
    } catch { addToast('Error actualizando', 'error') }
  }

  const handleEliminar = async () => {
    if (!confirmId) return
    try { await deleteGasto(confirmId); setConfirmId(null); addToast('Gasto eliminado', 'warning'); loadGastos() }
    catch { addToast('Error eliminando', 'error') }
  }

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando...</div>

  return (
    <div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <ConfirmModal open={!!confirmId} titulo="Eliminar Gasto"
        mensaje="¿Eliminar este gasto? No se puede deshacer."
        tipo="danger" onConfirm={handleEliminar} onCancel={() => setConfirmId(null)} />

      {/* Resumen del mes */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Gastos en el mes</p>
          <p className="text-2xl font-bold text-gray-900">{gastosFiltrados.length}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
          <p className="text-sm text-yellow-700">Pendiente</p>
          <p className="text-2xl font-bold text-yellow-800">S/ {totalPendiente.toFixed(2)}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <p className="text-sm text-green-700">Pagado</p>
          <p className="text-2xl font-bold text-green-800">S/ {totalPagado.toFixed(2)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro mes/año */}
          <select className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filtroMes} onChange={e => setFiltroMes(parseInt(e.target.value))}>
            {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filtroAnio} onChange={e => setFiltroAnio(parseInt(e.target.value))}>
            {[2023,2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {/* Filtro estado */}
          <div className="flex gap-1">
            {(['Todos','Pendiente','Pagado'] as const).map(f => (
              <button key={f} onClick={() => setFiltroEstado(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtroEstado === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm">
          <Plus className="w-4 h-4" /> Nuevo Gasto
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {gastosFiltrados.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No hay gastos en {MESES[filtroMes-1]} {filtroAnio}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Concepto</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Vencimiento</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Monto</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Estado</th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Acción</th>
              </tr>
            </thead>
            <tbody>
              {gastosFiltrados.map(g => (
                <tr key={g.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 text-sm">{g.concepto}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={isVencido(g.fecha_vencimiento) && g.estado === 'Pendiente' ? 'text-red-600 font-medium' : 'text-gray-600'}>
                      {new Date(g.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-PE')}
                    </span>
                    {isVencido(g.fecha_vencimiento) && g.estado === 'Pendiente' && (
                      <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">VENCIDO</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 text-sm">S/ {g.monto.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleEstado(g)}>
                      {g.estado === 'Pagado'
                        ? <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium"><CheckCircle className="w-3 h-3"/>Pagado</span>
                        : <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium"><Clock className="w-3 h-3"/>Pendiente</span>}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setConfirmId(g.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b flex justify-between">
              <h2 className="text-lg font-semibold">Nuevo Gasto</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Concepto</label>
                  <input type="text" className={inp} placeholder="Ej: Internet, Colegio..."
                    value={form.concepto} onChange={e => setForm({...form, concepto: e.target.value})} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Fecha Vencimiento</label>
                    <input type="date" className={inp}
                      value={form.fecha_vencimiento} onChange={e => setForm({...form, fecha_vencimiento: e.target.value})} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Monto (S/)</label>
                    <input type="number" step="0.01" min="0.01" className={inp} placeholder="0.00"
                      value={form.monto} onChange={e => setForm({...form, monto: e.target.value})} required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Estado</label>
                  <select className={inp} value={form.estado} onChange={e => setForm({...form, estado: e.target.value as any})}>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Pagado">Pagado</option>
                  </select>
                </div>
              </div>
              <div className="px-6 py-4 border-t flex gap-2 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default GastosTab
