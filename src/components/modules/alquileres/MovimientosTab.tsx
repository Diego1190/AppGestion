import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import React, { useState, useEffect } from 'react'
import { Plus, Zap, Droplets, Home, Wifi, Flame, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { getMovimientos, createMovimiento, updateMovimiento, deleteMovimiento, getLecturaAnterior, getInquilinos, getContratos } from '@/lib/alquileres'
import { MovimientoDepa, Inquilino, Contrato } from '@/types/index'
import { useToast, ToastContainer, ConfirmModal } from '@/components/Toast'

const SERVICIOS = ['Alquiler', 'Luz', 'Agua', 'Internet', 'Gas', 'Otro'] as const
type Servicio = typeof SERVICIOS[number]

const ICONOS: Record<Servicio, React.ElementType> = {
  Alquiler: Home, Luz: Zap, Agua: Droplets, Internet: Wifi, Gas: Flame, Otro: MoreHorizontal
}
const COLORES: Record<Servicio, string> = {
  Alquiler: 'bg-blue-100 text-blue-700', Luz: 'bg-yellow-100 text-yellow-700',
  Agua: 'bg-cyan-100 text-cyan-700', Internet: 'bg-purple-100 text-purple-700',
  Gas: 'bg-orange-100 text-orange-700', Otro: 'bg-gray-100 text-gray-700',
}
const MESES_N = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const MovimientosTab: React.FC = () => {
  const [movimientos, setMovimientos] = useState<MovimientoDepa[]>([])
  const [inquilinos, setInquilinos] = useState<Inquilino[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const { toasts, addToast, removeToast } = useToast()
  const [editMov, setEditMov] = useState<MovimientoDepa | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const hoy = new Date()
  const [filtroMes, setFiltroMes] = useState(hoy.getMonth() + 1)
  const [filtroAnio, setFiltroAnio] = useState(hoy.getFullYear())

  const [form, setForm] = useState({
    num_depa: '' as number | '',
    tipo_servicio: 'Alquiler' as Servicio,
    fecha_vencimiento: '',
    lectura_actual: '',
    tarifa: '',
    importe_pagar: '',
    estado: 'Pendiente' as 'Pendiente' | 'Pagado',
  })
  const [lecturaAnterior, setLecturaAnterior] = useState<number | null>(null)
  const [cargandoLectura, setCargandoLectura] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [movs, inqs, cons] = await Promise.all([
        getMovimientos(filtroMes, filtroAnio), getInquilinos(), getContratos()
      ])
      setMovimientos(movs); setInquilinos(inqs); setContratos(cons)
    } catch { addToast('Error cargando datos', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [filtroMes, filtroAnio])
  useRealtimeSync('movimientos_depa', loadData)

  const depasDisponibles = inquilinos
    .sort((a, b) => a.num_depa - b.num_depa)
    .map(i => ({ num_depa: i.num_depa, nombre: i.nombre_completo }))

  const getNombre = (n: number) => inquilinos.find(i => i.num_depa === n)?.nombre_completo || `Depa ${n}`

  useEffect(() => {
    if (form.tipo_servicio === 'Alquiler' && form.num_depa !== '') {
      const inq = inquilinos.find(i => i.num_depa === form.num_depa)
      const con = inq ? contratos.find(c => c.inquilino_id === inq.id && c.activo) : null
      setForm(f => ({ ...f, importe_pagar: con ? con.importe_alquiler.toString() : '' }))
    } else if (form.tipo_servicio !== 'Luz' && form.tipo_servicio !== 'Agua') {
      setForm(f => ({ ...f, importe_pagar: '' }))
    }
  }, [form.tipo_servicio, form.num_depa, contratos, inquilinos])

  useEffect(() => {
    if ((form.tipo_servicio === 'Luz' || form.tipo_servicio === 'Agua') && form.fecha_vencimiento && form.num_depa !== '') {
      const fecha = new Date(form.fecha_vencimiento)
      setCargandoLectura(true)
      getLecturaAnterior(form.num_depa as number, form.tipo_servicio, fecha.getMonth() + 1, fecha.getFullYear())
        .then(val => setLecturaAnterior(val))
        .finally(() => setCargandoLectura(false))
    } else { setLecturaAnterior(null) }
  }, [form.tipo_servicio, form.num_depa, form.fecha_vencimiento])

  useEffect(() => {
    if ((form.tipo_servicio === 'Luz' || form.tipo_servicio === 'Agua') && lecturaAnterior !== null && form.lectura_actual && form.tarifa) {
      const consumo = parseFloat(form.lectura_actual) - lecturaAnterior
      const importe = consumo * parseFloat(form.tarifa)
      setForm(f => ({ ...f, importe_pagar: importe > 0 ? importe.toFixed(2) : '0' }))
    }
  }, [form.lectura_actual, form.tarifa, lecturaAnterior])

  const resetForm = () => {
    setForm({ num_depa: '', tipo_servicio: 'Alquiler', fecha_vencimiento: '', lectura_actual: '', tarifa: '', importe_pagar: '', estado: 'Pendiente' })
    setLecturaAnterior(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.num_depa === '') { addToast('Selecciona un departamento', 'error'); return }
    if (!form.importe_pagar || parseFloat(form.importe_pagar) <= 0) { addToast('Ingresa un importe mayor a 0', 'error'); return }
    try {
      await createMovimiento({
        num_depa: form.num_depa as number,
        tipo_servicio: form.tipo_servicio,
        fecha_vencimiento: form.fecha_vencimiento,
        lectura_anterior: lecturaAnterior,
        lectura_actual: form.lectura_actual ? parseFloat(form.lectura_actual) : null,
        tarifa: form.tarifa ? parseFloat(form.tarifa) : null,
        importe_pagar: parseFloat(form.importe_pagar),
        estado: form.estado,
      })
      resetForm(); setShowModal(false)
      addToast('Movimiento registrado', 'success')
      loadData()
    } catch (err: any) { addToast(err.message || 'Error al guardar', 'error') }
  }

  const toggleEstado = async (mov: MovimientoDepa) => {
    try {
      await updateMovimiento(mov.id, { estado: mov.estado === 'Pendiente' ? 'Pagado' : 'Pendiente' })
      loadData()
    } catch { addToast('Error actualizando', 'error') }
  }

  const handleEditMov = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editMov) return
    try {
      await updateMovimiento(editMov.id, {
        estado: editMov.estado,
        importe_pagar: editMov.importe_pagar,
        fecha_vencimiento: editMov.fecha_vencimiento,
      })
      setEditMov(null); addToast('Movimiento actualizado', 'success'); loadData()
    } catch { addToast('Error actualizando', 'error') }
  }

  const handleDeleteMov = async () => {
    if (!confirmDeleteId) return
    try {
      await deleteMovimiento(confirmDeleteId)
      setConfirmDeleteId(null)
      addToast('Movimiento eliminado', 'warning')
      loadData()
    } catch { addToast('Error eliminando', 'error') }
  }

  const esLuzAgua = form.tipo_servicio === 'Luz' || form.tipo_servicio === 'Agua'
  const esAlquiler = form.tipo_servicio === 'Alquiler'
  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando...</div>

  return (
    <div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <ConfirmModal
        open={!!confirmDeleteId}
        titulo="Eliminar Movimiento"
        mensaje="¿Eliminar este movimiento? No se puede deshacer."
        tipo="danger"
        onConfirm={handleDeleteMov}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* Header filtros — apilado en móvil */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filtroMes} onChange={e => setFiltroMes(parseInt(e.target.value))}>
            {MESES_N.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filtroAnio} onChange={e => setFiltroAnio(parseInt(e.target.value))}>
            {[2023,2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-sm text-gray-500">{movimientos.length} registros</span>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true) }}
          disabled={depasDisponibles.length === 0}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nuevo Movimiento
        </button>
      </div>

      {depasDisponibles.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm mb-4">
          No hay inquilinos registrados. Agrega primero en "Inquilinos y Contratos".
        </div>
      )}

      {/* ── MÓVIL: cards ── */}
      <div className="md:hidden space-y-2">
        {movimientos.length === 0
          ? <div className="bg-white rounded-xl border p-10 text-center text-gray-400">No hay movimientos en {MESES_N[filtroMes-1]} {filtroAnio}</div>
          : movimientos.map(mov => {
            const Icono = ICONOS[mov.tipo_servicio as Servicio] || MoreHorizontal
            return (
              <div key={mov.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">Depa {mov.num_depa}</p>
                    <p className="text-xs text-gray-500 truncate">{getNombre(mov.num_depa)}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${COLORES[mov.tipo_servicio as Servicio] || 'bg-gray-100 text-gray-700'}`}>
                    <Icono className="w-3 h-3"/>{mov.tipo_servicio}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>{new Date(mov.fecha_vencimiento+'T00:00:00').toLocaleDateString('es-PE')}</span>
                  {mov.consumo != null && <span>{Number(mov.consumo).toFixed(2)} {mov.tipo_servicio==='Luz'?'kWh':'m³'}</span>}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="font-bold text-gray-900 text-lg">S/ {Number(mov.importe_pagar).toFixed(2)}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleEstado(mov)}>
                      {mov.estado === 'Pagado'
                        ? <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">✓ Pagado</span>
                        : <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">⏳ Pendiente</span>}
                    </button>
                    <button onClick={() => setEditMov({ ...mov })} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Editar">
                      <Pencil className="w-4 h-4"/>
                    </button>
                    <button onClick={() => setConfirmDeleteId(mov.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Eliminar">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        }
      </div>

      {/* ── DESKTOP: tabla ── */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        {movimientos.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No hay movimientos en {MESES_N[filtroMes-1]} {filtroAnio}</div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[700px]">
            <thead><tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Depa / Inquilino</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Servicio</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Vencimiento</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Consumo</th>
              <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Importe</th>
              <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Estado</th>
              <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Acción</th>
            </tr></thead>
            <tbody>
              {movimientos.map(mov => {
                const Icono = ICONOS[mov.tipo_servicio as Servicio] || MoreHorizontal
                return (
                  <tr key={mov.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">Depa {mov.num_depa}</p>
                      <p className="text-xs text-gray-500">{getNombre(mov.num_depa)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${COLORES[mov.tipo_servicio as Servicio] || 'bg-gray-100 text-gray-700'}`}>
                        <Icono className="w-3 h-3"/>{mov.tipo_servicio}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(mov.fecha_vencimiento+'T00:00:00').toLocaleDateString('es-PE')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {mov.consumo != null ? `${Number(mov.consumo).toFixed(2)} ${mov.tipo_servicio==='Luz'?'kWh':'m³'}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">S/ {Number(mov.importe_pagar).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleEstado(mov)}>
                        {mov.estado === 'Pagado'
                          ? <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">✓ Pagado</span>
                          : <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">⏳ Pendiente</span>}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setEditMov({ ...mov })} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Editar movimiento">
                          <Pencil className="w-4 h-4"/>
                        </button>
                        <button onClick={() => setConfirmDeleteId(mov.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar movimiento">
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        )}
      </div>

      {/* MODAL NUEVO MOVIMIENTO */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">
            <div className="px-5 py-4 border-b flex justify-between">
              <h2 className="text-base font-semibold">Nuevo Movimiento</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-xl leading-none">✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Tipo de Servicio</label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {SERVICIOS.map(s => {
                      const Icono = ICONOS[s]
                      const active = form.tipo_servicio === s
                      return (
                        <button key={s} type="button"
                          onClick={() => setForm(f => ({ ...f, tipo_servicio: s, importe_pagar: '', lectura_actual: '', tarifa: '' }))}
                          className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border transition-all ${active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300 text-gray-500'}`}>
                          <Icono className="w-4 h-4"/>
                          <span className="text-[10px] font-medium leading-none mt-0.5">{s}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                  <select className={inp} value={form.num_depa}
                    onChange={e => setForm(f => ({ ...f, num_depa: e.target.value === '' ? '' : parseInt(e.target.value) }))} required>
                    <option value="">— Seleccionar departamento —</option>
                    {depasDisponibles.map(d => (
                      <option key={d.num_depa} value={d.num_depa}>Depa {d.num_depa} — {d.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Vencimiento</label>
                    <input type="date" className={inp} value={form.fecha_vencimiento}
                      onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} required/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Importe (S/)
                      {esAlquiler && <span className="text-gray-400 font-normal text-xs ml-1">del contrato</span>}
                    </label>
                    <input type="number" step="0.01" min="0.01" className={`${inp} ${(esAlquiler) ? 'bg-gray-50' : ''}`}
                      value={form.importe_pagar}
                      onChange={e => setForm(f => ({ ...f, importe_pagar: e.target.value }))}
                      readOnly={esAlquiler} required placeholder="0.00"/>
                  </div>
                </div>

                {esLuzAgua && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-blue-700 uppercase">Medidor — {form.tipo_servicio}</p>
                    <div className="text-xs bg-white border border-blue-200 rounded px-2 py-1.5 text-gray-600">
                      Lectura anterior:{' '}
                      <strong>{cargandoLectura ? 'Buscando...' : lecturaAnterior !== null ? lecturaAnterior : 'No encontrada'}</strong>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium mb-1">Lectura Actual</label>
                        <input type="number" step="0.01" className={inp} value={form.lectura_actual}
                          onChange={e => setForm(f => ({ ...f, lectura_actual: e.target.value }))} required/>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Tarifa (S/)</label>
                        <input type="number" step="0.001" className={inp} value={form.tarifa}
                          onChange={e => setForm(f => ({ ...f, tarifa: e.target.value }))} required/>
                      </div>
                    </div>
                    {lecturaAnterior !== null && form.lectura_actual && form.tarifa && (
                      <div className="flex justify-between text-xs text-blue-700 bg-blue-100 rounded px-2 py-1.5">
                        <span>Consumo: <strong>{(parseFloat(form.lectura_actual) - lecturaAnterior).toFixed(2)} {form.tipo_servicio==='Luz'?'kWh':'m³'}</strong></span>
                        <span>Total: <strong>S/ {form.importe_pagar}</strong></span>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select className={inp} value={form.estado}
                    onChange={e => setForm(f => ({ ...f, estado: e.target.value as any }))}>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Pagado">Pagado</option>
                  </select>
                </div>
              </div>
              <div className="px-5 py-3 border-t flex gap-2 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR MOVIMIENTO */}
      {editMov && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">
            <div className="px-5 py-4 border-b flex justify-between items-center">
              <h2 className="text-base font-semibold">Editar Movimiento</h2>
              <button onClick={() => setEditMov(null)} className="text-gray-400 text-xl leading-none">✕</button>
            </div>
            <form onSubmit={handleEditMov}>
              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Servicio</label>
                  <p className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium">
                    Depa {editMov.num_depa} — {editMov.tipo_servicio}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Vencimiento</label>
                    <input type="date" className={inp} value={editMov.fecha_vencimiento}
                      onChange={e => setEditMov({ ...editMov, fecha_vencimiento: e.target.value })}/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Importe (S/)</label>
                    <input type="number" step="0.01" min="0" className={inp} value={editMov.importe_pagar}
                      onChange={e => setEditMov({ ...editMov, importe_pagar: parseFloat(e.target.value) || 0 })}/>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select className={inp} value={editMov.estado}
                    onChange={e => setEditMov({ ...editMov, estado: e.target.value as any })}>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Pagado">Pagado</option>
                  </select>
                </div>
              </div>
              <div className="px-5 py-4 border-t grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setEditMov(null)}
                  className="py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm">Cancelar</button>
                <button type="submit"
                  className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default MovimientosTab
