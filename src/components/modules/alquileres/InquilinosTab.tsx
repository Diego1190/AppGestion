import React, { useState, useEffect } from 'react'
import { Plus, Trash2, FileText, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { getInquilinos, createInquilino, deleteInquilino, getContratos, createContrato, updateContrato } from '@/lib/alquileres'
import { Inquilino, Contrato } from '@/types/index'
import { useToast, ToastContainer, ConfirmModal, FieldError } from '@/components/Toast'
import { validarDNI, validarTelefono } from '@/lib/calculations'

const InquilinosTab: React.FC = () => {
  const [inquilinos, setInquilinos] = useState<Inquilino[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [modalInq, setModalInq] = useState(false)
  const [modalCon, setModalCon] = useState(false)
  const [modalCerrar, setModalCerrar] = useState<{ contratoId: string; inquilinoNombre: string } | null>(null)
  const [motivoCierre, setMotivoCierre] = useState('')
  const [confirmEliminar, setConfirmEliminar] = useState<string | null>(null)
  const { toasts, addToast, removeToast } = useToast()
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [formInq, setFormInq] = useState({ nombre_completo: '', dni: '', telefono: '', num_depa: '' as number | '' })
  const [formCon, setFormCon] = useState({ inquilino_id: '', tipo_contrato: 'Inicial' as 'Inicial' | 'Renovación', fecha_inicio: '', meses_alquiler: 12, importe_alquiler: '' })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [inqs, cons] = await Promise.all([getInquilinos(), getContratos()])
      setInquilinos(inqs); setContratos(cons)
    } catch { addToast('Error cargando datos', 'error') }
    finally { setLoading(false) }
  }

  const contratoActivoPorInquilino = (inqId: string) => contratos.find(c => c.inquilino_id === inqId && c.activo)
  const contratoActivoPorDepa = (numDepa: number) => {
    const inq = inquilinos.find(i => i.num_depa === numDepa)
    return inq ? contratoActivoPorInquilino(inq.id) : undefined
  }
  const contratoExpirado = (c: Contrato) => new Date(c.fecha_final) < new Date()
  const diasRestantes = (f: string) => Math.ceil((new Date(f).getTime() - new Date().getTime()) / 86400000)

  const validarFormInq = () => {
    const e: Record<string, string> = {}
    if (!formInq.nombre_completo.trim()) e.nombre = 'El nombre es obligatorio'
    const eDNI = validarDNI(formInq.dni); if (eDNI) e.dni = eDNI
    const eTel = validarTelefono(formInq.telefono); if (eTel) e.telefono = eTel
    if (formInq.num_depa === '') { e.num_depa = 'Ingresa el número de departamento' }
    else {
      const conActivo = contratoActivoPorDepa(formInq.num_depa as number)
      if (conActivo && !contratoExpirado(conActivo)) {
        e.num_depa = `Depa ${formInq.num_depa} tiene contrato activo hasta ${new Date(conActivo.fecha_final+'T00:00:00').toLocaleDateString('es-PE')}. Ciérralo primero.`
      }
    }
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const handleCrearInq = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validarFormInq()) return
    try {
      await createInquilino({ nombre_completo: formInq.nombre_completo, dni: formInq.dni, telefono: formInq.telefono, num_depa: formInq.num_depa as number })
      setFormInq({ nombre_completo: '', dni: '', telefono: '', num_depa: '' }); setErrores({}); setModalInq(false)
      addToast('Inquilino creado', 'success'); loadData()
    } catch (err: any) { addToast(err.message || 'Error al crear', 'error') }
  }

  const handleCrearCon = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formCon.importe_alquiler || parseFloat(formCon.importe_alquiler) <= 0) { addToast('El importe debe ser mayor a 0', 'error'); return }

    // Validar: no permitir nuevo contrato si hay uno activo y no expirado
    const conActivo = contratoActivoPorInquilino(formCon.inquilino_id)
    if (conActivo && !contratoExpirado(conActivo)) {
      addToast(`Este inquilino tiene contrato activo hasta ${new Date(conActivo.fecha_final+'T00:00:00').toLocaleDateString('es-PE')}. Debe completar o cerrar el contrato vigente primero.`, 'error'); return
    }

    try {
      await createContrato({ inquilino_id: formCon.inquilino_id, tipo_contrato: formCon.tipo_contrato, fecha_inicio: formCon.fecha_inicio, meses_alquiler: formCon.meses_alquiler, importe_alquiler: parseFloat(formCon.importe_alquiler), activo: true })
      setFormCon({ inquilino_id: '', tipo_contrato: 'Inicial', fecha_inicio: '', meses_alquiler: 12, importe_alquiler: '' }); setModalCon(false)
      addToast('Contrato creado', 'success'); loadData()
    } catch (err: any) { addToast(err.message || 'Error al crear contrato', 'error') }
  }

  const handleCerrarContrato = async () => {
    if (!modalCerrar) return
    if (!motivoCierre.trim()) { addToast('Ingresa el motivo de cierre', 'error'); return }
    try {
      await updateContrato(modalCerrar.contratoId, { activo: false, motivo_cierre: motivoCierre, fecha_cierre: new Date().toISOString().split('T')[0] })
      setModalCerrar(null); setMotivoCierre('')
      addToast('Contrato cerrado. El depa está disponible para un nuevo inquilino.', 'warning'); loadData()
    } catch { addToast('Error al cerrar contrato', 'error') }
  }

  const handleEliminar = async () => {
    if (!confirmEliminar) return
    try { await deleteInquilino(confirmEliminar); setConfirmEliminar(null); addToast('Inquilino eliminado', 'warning'); loadData() }
    catch { addToast('Error eliminando', 'error') }
  }

  const getContratos_ = (id: string) => contratos.filter(c => c.inquilino_id === id)
  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando...</div>

  return (
    <div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <ConfirmModal open={!!confirmEliminar} titulo="Eliminar Inquilino" mensaje="¿Eliminar inquilino y todos sus contratos? No se puede deshacer." tipo="danger" onConfirm={handleEliminar} onCancel={() => setConfirmEliminar(null)} />

      {/* Modal Cerrar Contrato con motivo */}
      {modalCerrar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b bg-orange-50 rounded-t-xl">
              <h2 className="text-lg font-semibold text-orange-800">Cerrar Contrato</h2>
              <p className="text-sm text-orange-600 mt-1">Inquilino: <strong>{modalCerrar.inquilinoNombre}</strong></p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-gray-600">Este cierre puede darse por <strong>fin de contrato, desalojo, acuerdo mutuo</strong> u otro motivo. El historial se conservará.</p>
              <div>
                <label className="block text-sm font-medium mb-1">Motivo de Cierre *</label>
                <select className={inp} value={motivoCierre} onChange={e => setMotivoCierre(e.target.value)}>
                  <option value="">— Seleccionar motivo —</option>
                  <option value="Fin de contrato, no renueva">Fin de contrato, no renueva</option>
                  <option value="Acuerdo mutuo anticipado">Acuerdo mutuo anticipado</option>
                  <option value="Desalojo por incumplimiento">Desalojo por incumplimiento</option>
                  <option value="Inquilino se mudó">Inquilino se mudó</option>
                  <option value="Venta del inmueble">Venta del inmueble</option>
                  <option value="Otro motivo">Otro motivo</option>
                </select>
              </div>
              {motivoCierre === 'Otro motivo' && (
                <div><label className="block text-sm font-medium mb-1">Especifica el motivo</label>
                  <textarea className={`${inp} resize-none`} rows={2} placeholder="Describe el motivo..." onChange={e => setMotivoCierre(e.target.value)} /></div>
              )}
            </div>
            <div className="px-6 py-4 border-t flex gap-2 justify-end">
              <button onClick={() => { setModalCerrar(null); setMotivoCierre('') }} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm">Cancelar</button>
              <button onClick={handleCerrarContrato} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium text-sm">Confirmar Cierre</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700"><strong>Flujo:</strong> El contrato debe completar su período para renovar. Para liberar un depa antes de tiempo, usa "Cerrar Contrato" indicando el motivo. El historial siempre se conserva.</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4"><p className="text-sm text-gray-500">Inquilinos</p><p className="text-2xl font-bold">{inquilinos.length}</p></div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4"><p className="text-sm text-blue-700">Contratos Activos</p><p className="text-2xl font-bold text-blue-900">{contratos.filter(c=>c.activo).length}</p></div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4"><p className="text-sm text-yellow-700">Por Vencer (30d)</p><p className="text-2xl font-bold text-yellow-900">{contratos.filter(c=>c.activo&&diasRestantes(c.fecha_final)<=30&&diasRestantes(c.fecha_final)>0).length}</p></div>
      </div>

      <div className="flex justify-end mb-4">
        <button onClick={() => { setErrores({}); setFormInq({ nombre_completo:'',dni:'',telefono:'',num_depa:'' }); setModalInq(true) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm">
          <Plus className="w-4 h-4"/>Nuevo Inquilino
        </button>
      </div>

      <div className="space-y-3">
        {inquilinos.length === 0 ? <div className="bg-white rounded-xl border p-12 text-center text-gray-400">No hay inquilinos.</div>
        : inquilinos.map(inq => {
          const activo = contratoActivoPorInquilino(inq.id)
          const hist = getContratos_(inq.id)
          const abierto = expandido === inq.id
          const dias = activo ? diasRestantes(activo.fecha_final) : null
          const expirado = activo ? contratoExpirado(activo) : false
          return (
            <div key={inq.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">D{inq.num_depa}</div>
                  <div>
                    <p className="font-semibold text-gray-900">{inq.nombre_completo}</p>
                    <p className="text-sm text-gray-500">DNI: {inq.dni} · Tel: {inq.telefono}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {activo ? (
                    <div className="text-right mr-2">
                      <p className="text-sm font-semibold text-gray-900">S/ {activo.importe_alquiler.toFixed(2)}/mes</p>
                      <p className={`text-xs ${expirado?'text-red-600 font-bold':dias!<=30?'text-orange-600 font-medium':'text-gray-500'}`}>
                        Vence: {new Date(activo.fecha_final+'T00:00:00').toLocaleDateString('es-PE')}
                        {expirado?' ⚠️ VENCIDO':dias!<=30?` (${dias}d)`:''}
                      </p>
                    </div>
                  ) : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">Sin contrato activo</span>}

                  {activo ? (
                    <>
                      {expirado && (
                        <button onClick={() => { setFormCon(f=>({...f,inquilino_id:inq.id})); setModalCon(true) }}
                          className="flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg">
                          <FileText className="w-3 h-3"/>Renovar
                        </button>
                      )}
                      <button onClick={() => setModalCerrar({ contratoId: activo.id, inquilinoNombre: inq.nombre_completo })}
                        className="text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg border border-orange-200">
                        Cerrar Contrato
                      </button>
                    </>
                  ) : (
                    <button onClick={() => { setFormCon(f=>({...f,inquilino_id:inq.id})); setModalCon(true) }}
                      className="flex items-center gap-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg">
                      <FileText className="w-3 h-3"/>Añadir Contrato
                    </button>
                  )}

                  <button onClick={() => setExpandido(abierto?null:inq.id)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                    {abierto?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}
                  </button>
                  <button onClick={() => setConfirmEliminar(inq.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>

              {abierto && (
                <div className="border-t bg-gray-50 px-5 py-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Historial ({hist.length})</p>
                  {hist.length === 0 ? <p className="text-sm text-gray-400">Sin contratos</p> : (
                    <div className="space-y-2">
                      {hist.map(c => (
                        <div key={c.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-gray-200">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.tipo_contrato==='Inicial'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}`}>{c.tipo_contrato}</span>
                            <span className="text-sm text-gray-700">{new Date(c.fecha_inicio+'T00:00:00').toLocaleDateString('es-PE')} → {new Date(c.fecha_final+'T00:00:00').toLocaleDateString('es-PE')} ({c.meses_alquiler}m)</span>
                            {c.motivo_cierre && <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">Cierre: {c.motivo_cierre}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 text-sm">S/ {c.importe_alquiler.toFixed(2)}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${c.activo?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{c.activo?'Activo':'Cerrado'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal Inquilino */}
      {modalInq && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b flex justify-between"><h2 className="text-lg font-semibold">Nuevo Inquilino</h2><button onClick={()=>setModalInq(false)} className="text-gray-400 text-xl">✕</button></div>
            <form onSubmit={handleCrearInq}>
              <div className="px-6 py-4 space-y-4">
                <div><label className="block text-sm font-medium mb-1">Nombre Completo</label><input type="text" className={`${inp} ${errores.nombre?'border-red-400':''}`} value={formInq.nombre_completo} onChange={e=>setFormInq({...formInq,nombre_completo:e.target.value})}/><FieldError error={errores.nombre}/></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium mb-1">DNI <span className="text-gray-400 font-normal">(8 dígitos)</span></label><input type="text" maxLength={8} className={`${inp} ${errores.dni?'border-red-400':''}`} value={formInq.dni} onChange={e=>setFormInq({...formInq,dni:e.target.value.replace(/\D/g,'')})}/><FieldError error={errores.dni}/></div>
                  <div><label className="block text-sm font-medium mb-1">N° Depa</label><input type="number" min={1} className={`${inp} ${errores.num_depa?'border-red-400':''}`} value={formInq.num_depa} onChange={e=>setFormInq({...formInq,num_depa:e.target.value===''?'':parseInt(e.target.value)})}/><FieldError error={errores.num_depa}/></div>
                </div>
                <div><label className="block text-sm font-medium mb-1">Teléfono <span className="text-gray-400 font-normal">(9 dígitos)</span></label><input type="text" maxLength={9} className={`${inp} ${errores.telefono?'border-red-400':''}`} value={formInq.telefono} onChange={e=>setFormInq({...formInq,telefono:e.target.value.replace(/\D/g,'')})}/><FieldError error={errores.telefono}/></div>
              </div>
              <div className="px-6 py-4 border-t flex gap-2 justify-end"><button type="button" onClick={()=>setModalInq(false)} className="px-4 py-2 bg-gray-100 rounded-lg font-medium text-sm">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm">Guardar</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Contrato */}
      {modalCon && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b flex justify-between"><h2 className="text-lg font-semibold">Nuevo Contrato</h2><button onClick={()=>setModalCon(false)} className="text-gray-400 text-xl">✕</button></div>
            <form onSubmit={handleCrearCon}>
              <div className="px-6 py-4 space-y-4">
                <div><label className="block text-sm font-medium mb-1">Inquilino</label>
                  <select className={inp} value={formCon.inquilino_id} onChange={e=>setFormCon({...formCon,inquilino_id:e.target.value})} required>
                    <option value="">Seleccionar...</option>
                    {inquilinos.map(i=><option key={i.id} value={i.id}>{i.nombre_completo} (D{i.num_depa})</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium mb-1">Tipo</label>
                  <select className={inp} value={formCon.tipo_contrato} onChange={e=>setFormCon({...formCon,tipo_contrato:e.target.value as any})}>
                    <option value="Inicial">Inicial</option><option value="Renovación">Renovación</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium mb-1">Fecha Inicio</label><input type="date" className={inp} value={formCon.fecha_inicio} onChange={e=>setFormCon({...formCon,fecha_inicio:e.target.value})} required/></div>
                  <div><label className="block text-sm font-medium mb-1">Meses</label><input type="number" min={1} className={inp} value={formCon.meses_alquiler} onChange={e=>setFormCon({...formCon,meses_alquiler:parseInt(e.target.value)})} required/></div>
                </div>
                <div><label className="block text-sm font-medium mb-1">Importe Mensual (S/)</label><input type="number" step="0.01" min="0.01" className={inp} placeholder="0.00" value={formCon.importe_alquiler} onChange={e=>setFormCon({...formCon,importe_alquiler:e.target.value})} required/></div>
              </div>
              <div className="px-6 py-4 border-t flex gap-2 justify-end"><button type="button" onClick={()=>setModalCon(false)} className="px-4 py-2 bg-gray-100 rounded-lg font-medium text-sm">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm">Guardar</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default InquilinosTab
