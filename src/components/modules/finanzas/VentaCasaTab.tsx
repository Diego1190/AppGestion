import React, { useState, useEffect } from 'react'
import { Plus, Trash2, AlertCircle, TrendingUp, Lock, Pencil } from 'lucide-react'
import { getControlVenta, createControlVenta, updateControlVenta, deleteControlVenta, getTotalPorHermano } from '@/lib/finanzas'
import { ControlVentaCasa } from '@/types/index'
import { inputClass } from '@/components/ui/inputStyles'
import { Modal } from '@/components/ui/Modal'
import { useToast, ToastContainer, ConfirmModal } from '@/components/Toast'

const TOPE = 6660
const TOTAL_VENTA = 20000

type Hermano = 'Gabriel' | 'Fernando' | 'Tu'
const HERMANOS: Hermano[] = ['Gabriel', 'Fernando', 'Tu']
const LABEL: Record<Hermano, string> = { Gabriel: 'Gabriel', Fernando: 'Fernando', Tu: 'Tú' }

const COLORES: Record<Hermano, { bg: string; bar: string; text: string; badge: string }> = {
  Gabriel:  { bg: 'bg-blue-50',   bar: 'bg-blue-500',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-800' },
  Fernando: { bg: 'bg-purple-50', bar: 'bg-purple-500', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-800' },
  Tu:       { bg: 'bg-green-50',  bar: 'bg-green-500',  text: 'text-green-700',  badge: 'bg-green-100 text-green-800' },
}

const VentaCasaTab: React.FC = () => {
  const [pagos, setPagos] = useState<ControlVentaCasa[]>([])
  const [totales, setTotales] = useState<Record<string, number>>({ Gabriel: 0, Fernando: 0, Tu: 0 })
  const [loading, setLoading] = useState(true)
  const [showModal,  setShowModal]  = useState(false)
  const [editPago,   setEditPago]   = useState<any | null>(null)
  const [error, setError] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const { toasts, addToast, removeToast } = useToast()
  const [formData, setFormData] = useState({
    fecha_pago: '',
    monto_pagado: '',
    entregado_a: '' as Hermano | '',
  })

  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  const loadData = async () => {
    try {
      setLoading(true)
      const [pagosData, totalesData] = await Promise.all([
        getControlVenta(),
        getTotalPorHermano(),
      ])
      setPagos(pagosData)
      setTotales(totalesData)
    } catch (e: any) {
      addToast(e.message || 'No se pudieron cargar los datos', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const hermanosBloqueados = HERMANOS.filter(h => (totales[h] || 0) >= TOPE)
  const hermanosDisponibles = HERMANOS.filter(h => (totales[h] || 0) < TOPE)

  const handleEditPago = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editPago) return
    try {
      await updateControlVenta(editPago.id, {
        monto_pagado: editPago.monto_pagado,
        entregado_a: editPago.entregado_a,
        fecha_pago: editPago.fecha_pago,
      })
      setEditPago(null); loadData()
    } catch (e: any) { addToast(e.message || 'Error actualizando el pago', 'error') }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!formData.entregado_a) { setError('Selecciona un hermano'); return }
    const monto = parseFloat(formData.monto_pagado)
    if (isNaN(monto) || monto < 200) { setError('El monto mínimo es $ 200'); return }
    try {
      const entregadoReal: 'Gabriel' | 'Fernando' | 'Tú' =
        formData.entregado_a === 'Tu' ? 'Tú' : (formData.entregado_a as 'Gabriel' | 'Fernando')
      await createControlVenta({
        fecha_pago: formData.fecha_pago,
        monto_pagado: monto,
        entregado_a: entregadoReal,
      })
      setFormData({ fecha_pago: '', monto_pagado: '', entregado_a: '' })
      setShowModal(false)
      loadData()
    } catch (e: any) {
      setError(e.message || 'Error al guardar')
    }
  }

  const handleDelete = async (id: string) => {
    try { await deleteControlVenta(id); setConfirmId(null); loadData() }
    catch (e: any) { addToast(e.message || 'Error eliminando', 'error') }
  }

  const getHermanoKey = (entregado: string): Hermano => {
    if (entregado === 'Tú' || entregado === 'Tu') return 'Tu'
    return entregado as Hermano
  }

  const totalDistribuido = Object.values(totales).reduce((s, v) => s + v, 0)
  const pctGeneral = Math.min((totalDistribuido / TOTAL_VENTA) * 100, 100)

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando...</div>

  return (
    <div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <ConfirmModal open={!!confirmId} titulo="Eliminar Pago" mensaje="¿Eliminar este pago registrado? Esta acción no se puede deshacer." tipo="danger"
        onConfirm={() => confirmId && handleDelete(confirmId)} onCancel={() => setConfirmId(null)} />
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 flex-shrink-0">✕</button>
        </div>
      )}

      {/* Progreso general */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div>
            <h3 className="font-semibold text-gray-900">Progreso Total de la Venta</h3>
            <p className="text-sm text-gray-500">Distribucion de $ 20,000 total</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">$ {totalDistribuido.toFixed(2)}</p>
            <p className="text-sm text-gray-500">de $ {TOTAL_VENTA.toLocaleString()}</p>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div className="bg-blue-600 h-3 rounded-full transition-all duration-500" style={{ width: `${pctGeneral}%` }} />
        </div>
        <p className="text-right text-sm text-gray-500 mt-1">{pctGeneral.toFixed(1)}%</p>
      </div>

      {/* Barras por hermano */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {HERMANOS.map(h => {
          const total = totales[h] || 0
          const pct = Math.min((total / TOPE) * 100, 100)
          const bloqueado = total >= TOPE
          const c = COLORES[h]
          return (
            <div key={h} className={`${c.bg} rounded-xl border p-4`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900">{LABEL[h]}</span>
                {bloqueado && (
                  <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    <Lock className="w-3 h-3" /> Tope
                  </span>
                )}
              </div>
              <p className={`text-xl font-bold ${c.text}`}>$ {total.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mb-2">de $ {TOPE.toFixed(2)}</p>
              <div className="w-full bg-white rounded-full h-2">
                <div className={`${c.bar} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-right">{pct.toFixed(1)}%</p>
            </div>
          )
        })}
      </div>

      {hermanosBloqueados.length > 0 && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 text-sm">
          <strong>{hermanosBloqueados.map(h => LABEL[h]).join(' y ')}</strong> ha alcanzado el tope de $ 6,660.
        </div>
      )}

      <div className="flex justify-end mb-4">
        <button onClick={() => { setError(''); setShowModal(true) }}
          disabled={hermanosDisponibles.length === 0}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2.5 rounded-lg font-medium transition-colors">
          <Plus className="w-4 h-4" /> Registrar Pago
        </button>
      </div>

      {/* ── MÓVIL: cards ── */}
      <div className="md:hidden space-y-2">
        {pagos.length === 0
          ? <div className="bg-white rounded-xl border p-10 text-center text-gray-400">No hay pagos registrados</div>
          : pagos.map(pago => {
            const hKey = getHermanoKey(pago.entregado_a)
            const c = COLORES[hKey] || COLORES.Gabriel
            return (
              <div key={pago.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${c.badge}`}>
                      <TrendingUp className="w-3 h-3" />{pago.entregado_a}
                    </span>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(pago.fecha_pago + 'T00:00:00').toLocaleDateString('es-PE')}
                      {pago.mes && <span className="ml-2">· {MESES[pago.mes - 1]} {pago.anio}</span>}
                    </p>
                  </div>
                  <span className="font-bold text-gray-900 text-lg flex-shrink-0">$ {Number(pago.monto_pagado).toFixed(2)}</span>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button onClick={() => setEditPago({ ...pago, fecha_pago: pago.fecha_pago || new Date().toISOString().split('T')[0] })}
                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setConfirmId(pago.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Eliminar">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })
        }
      </div>

      {/* ── DESKTOP: tabla ── */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        {pagos.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No hay pagos registrados</div>
        ) : (
          <table className="w-full">
            <thead><tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Fecha</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Periodo</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Para</th>
              <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Monto</th>
              <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Accion</th>
            </tr></thead>
            <tbody>
              {pagos.map(pago => {
                const hKey = getHermanoKey(pago.entregado_a)
                const c = COLORES[hKey] || COLORES.Gabriel
                return (
                  <tr key={pago.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(pago.fecha_pago + 'T00:00:00').toLocaleDateString('es-PE')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {pago.mes ? `${MESES[pago.mes - 1]} ${pago.anio}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${c.badge}`}>
                        <TrendingUp className="w-3 h-3" />
                        {pago.entregado_a}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      $ {Number(pago.monto_pagado).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setEditPago({ ...pago, fecha_pago: pago.fecha_pago || new Date().toISOString().split('T')[0] })}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setConfirmId(pago.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
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

      {/* Modal Registrar Pago */}
      <Modal open={showModal}>
          <div className="px-5 sm:px-6 py-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold">Registrar Pago</h2>
            <button onClick={() => setShowModal(false)} className="text-gray-400 text-xl">✕</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="px-5 sm:px-6 py-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Fecha de Pago</label>
                <input type="date" className={inputClass}
                  value={formData.fecha_pago}
                  onChange={e => setFormData({...formData, fecha_pago: e.target.value})} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Monto ($) <span className="text-gray-400 font-normal">— mínimo $ 200</span>
                </label>
                <input type="number" step="0.01" min="200"
                  className={inputClass}
                  placeholder="200.00"
                  value={formData.monto_pagado}
                  onChange={e => setFormData({...formData, monto_pagado: e.target.value})} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Entregado a</label>
                <div className="grid grid-cols-3 gap-2">
                  {HERMANOS.map(h => {
                    const bloqueado = (totales[h] || 0) >= TOPE
                    const c = COLORES[h]
                    const sel = formData.entregado_a === h
                    const disponible = Math.max(0, TOPE - (totales[h] || 0))
                    return (
                      <button key={h} type="button"
                        disabled={bloqueado}
                        onClick={() => !bloqueado && setFormData({...formData, entregado_a: h})}
                        className={`relative p-3 rounded-lg border-2 transition-all text-center ${
                          bloqueado ? 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-200'
                            : sel ? `${c.bg} border-blue-500 ${c.text} font-semibold`
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}>
                        {bloqueado && <Lock className="w-3 h-3 absolute top-1 right-1 text-gray-400" />}
                        <span className="block font-medium text-sm">{LABEL[h]}</span>
                        <span className="block text-xs text-gray-500 mt-0.5">$ {disponible.toFixed(0)} disp.</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="px-5 sm:px-6 py-4 border-t grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setShowModal(false)}
                className="py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm">Cancelar</button>
              <button type="submit"
                className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm">Guardar</button>
            </div>
          </form>
      </Modal>

      {/* Modal Editar Pago */}
      <Modal open={!!editPago}>
        {editPago && (
          <>
            <div className="px-5 py-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Editar Pago</h2>
              <button onClick={()=>setEditPago(null)} className="text-gray-400 text-2xl leading-none">✕</button>
            </div>
            <form onSubmit={handleEditPago}>
              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Para</label>
                  <select className={inputClass}
                    value={editPago.entregado_a}
                    onChange={e=>setEditPago({...editPago,entregado_a:e.target.value})}>
                    <option value="Gabriel">Gabriel</option>
                    <option value="Fernando">Fernando</option>
                    <option value="Tu">Tú</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Fecha</label>
                    <input type="date" className={inputClass}
                      value={editPago.fecha_pago}
                      onChange={e=>setEditPago({...editPago,fecha_pago:e.target.value})}/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Monto ($)</label>
                    <input type="number" step="0.01" min="0" className={inputClass}
                      value={editPago.monto_pagado}
                      onChange={e=>setEditPago({...editPago,monto_pagado:parseFloat(e.target.value)||0})}/>
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 border-t grid grid-cols-2 gap-3">
                <button type="button" onClick={()=>setEditPago(null)}
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

export default VentaCasaTab
