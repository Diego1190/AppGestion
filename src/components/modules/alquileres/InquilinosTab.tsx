import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import React, { useState, useEffect } from 'react'
import { Plus, Trash2, FileText, ChevronDown, ChevronUp, Info, AlertTriangle, Lock } from 'lucide-react'
import { getInquilinos, createInquilino, deleteInquilino, getContratos, createContrato, updateContrato } from '@/lib/alquileres'
import { Inquilino, Contrato } from '@/types/index'
import { useToast, ToastContainer, ConfirmModal, FieldError } from '@/components/Toast'
import { inputClass } from '@/components/ui/inputStyles'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { validarDNI, validarTelefono, MONTO_MAXIMO_RAZONABLE } from '@/lib/calculations'

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
  const [formCon, setFormCon] = useState({ inquilino_id: '', tipo_contrato: 'Inicial' as 'Inicial' | 'Renovación', fecha_inicio: '', meses_alquiler: 12, importe_alquiler: '', garantia: '' })

  const loadData = async () => {
    try {
      setLoading(true)
      const [inqs, cons] = await Promise.all([getInquilinos(), getContratos()])
      setInquilinos(inqs); setContratos(cons)
    } catch { addToast('Error cargando datos', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [])
  useRealtimeSync(['inquilinos', 'contratos'], loadData)

  const contratoActivoPorInquilino = (inqId: string) => contratos.find(c => c.inquilino_id === inqId && c.activo)

  /** Última garantía registrada para este inquilino (el contrato más reciente que tenga garantía
   *  guardada, activo o cerrado). La garantía es del inquilino, no de cada renovación individual:
   *  si ya pagó S/1200 al inicio, esa garantía sigue vigente en renovaciones futuras. */
  const ultimaGarantiaPorInquilino = (inqId: string): number | null => {
    const delInquilino = contratos
      .filter(c => c.inquilino_id === inqId && c.garantia != null)
      .sort((a, b) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime())
    return delInquilino[0]?.garantia ?? null
  }
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
    if (parseFloat(formCon.importe_alquiler) > MONTO_MAXIMO_RAZONABLE) { addToast(`El importe parece demasiado alto (más de S/ ${MONTO_MAXIMO_RAZONABLE}). Verifica que no sea un error de tecleo.`, 'error'); return }

    const conActivo = contratoActivoPorInquilino(formCon.inquilino_id)
    if (conActivo && !contratoExpirado(conActivo)) {
      addToast(`Este inquilino tiene contrato activo hasta ${new Date(conActivo.fecha_final+'T00:00:00').toLocaleDateString('es-PE')}. Debe completar o cerrar el contrato vigente primero.`, 'error'); return
    }

    try {
      await createContrato({
        inquilino_id: formCon.inquilino_id,
        tipo_contrato: formCon.tipo_contrato,
        fecha_inicio: formCon.fecha_inicio,
        meses_alquiler: formCon.meses_alquiler,
        importe_alquiler: parseFloat(formCon.importe_alquiler),
        garantia: formCon.garantia ? parseFloat(formCon.garantia) : null,
        activo: true,
      })
      setFormCon({ inquilino_id: '', tipo_contrato: 'Inicial', fecha_inicio: '', meses_alquiler: 12, importe_alquiler: '', garantia: '' }); setModalCon(false)
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
  const inp = inputClass

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando...</div>

  return (
    <div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <ConfirmModal open={!!confirmEliminar} titulo="Eliminar Inquilino" mensaje="¿Eliminar inquilino y todos sus contratos? No se puede deshacer." tipo="danger" onConfirm={handleEliminar} onCancel={() => setConfirmEliminar(null)} />

      {/* Modal Cerrar Contrato con motivo */}
      <Modal open={!!modalCerrar}>
        {modalCerrar && (
          <>
            <div className="px-6 py-4 border-b">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <h2 className="text-lg font-semibold text-gray-900">Cerrar contrato</h2>
              </div>
            </div>
            <ModalBody>
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs flex items-center justify-center flex-shrink-0">
                  {modalCerrar.inquilinoNombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()}
                </div>
                <p className="text-sm font-semibold text-gray-900 truncate">{modalCerrar.inquilinoNombre}</p>
              </div>

              <p className="text-xs text-gray-500">El historial se conserva. Esta acción no se puede deshacer.</p>

              <div>
                <label className="block text-sm font-medium mb-2">Motivo *</label>
                <div className="space-y-1.5">
                  {[
                    'Fin de contrato, no renueva',
                    'Acuerdo mutuo anticipado',
                    'Desalojo por incumplimiento',
                    'Inquilino se mudó',
                    'Venta del inmueble',
                    'Otro motivo',
                  ].map(opcion => (
                    <label key={opcion} className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors ${motivoCierre === opcion ? 'border-orange-400 bg-orange-50 text-orange-800 font-medium' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                      <input
                        type="radio"
                        name="motivoCierre"
                        className="accent-orange-500"
                        checked={motivoCierre === opcion}
                        onChange={() => setMotivoCierre(opcion)}
                      />
                      {opcion}
                    </label>
                  ))}
                </div>
              </div>

              {motivoCierre === 'Otro motivo' && (
                <div><label className="block text-sm font-medium mb-1">Especifica el motivo</label>
                  <textarea className={`${inp} resize-none`} rows={2} placeholder="Describe el motivo..." onChange={e => setMotivoCierre(e.target.value)} /></div>
              )}
            </ModalBody>
            <ModalFooter>
              <button onClick={() => { setModalCerrar(null); setMotivoCierre('') }} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm">Cancelar</button>
              <button onClick={handleCerrarContrato} className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium text-sm">
                <Lock className="w-3.5 h-3.5" />Confirmar cierre
              </button>
            </ModalFooter>
          </>
        )}
      </Modal>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700"><strong>Flujo:</strong> El contrato debe completar su período para renovar. Para liberar un depa antes de tiempo, usa "Cerrar Contrato" indicando el motivo. El historial siempre se conserva.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
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
              {/* MÓVIL: layout vertical apilado / DESKTOP: una fila */}
              <div className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {/* Bloque identidad */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">D{inq.num_depa}</div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{inq.nombre_completo}</p>
                    <p className="text-sm text-gray-500 truncate">DNI: {inq.dni} · Tel: {inq.telefono}</p>
                  </div>
                </div>

                {/* Bloque centro: garantía — visible cuando hay contrato activo */}
                {activo && (
                  <div className="flex sm:flex-1 sm:justify-center">
                    <div className="text-center bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-100">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-none">Garantía</p>
                      <p className="text-sm font-semibold text-gray-700">
                        {activo.garantia != null ? `S/ ${activo.garantia.toFixed(2)}` : '—'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Bloque acciones */}
                <div className="flex items-center gap-2 flex-wrap">
                  {activo ? (
                    <div className="text-right mr-1">
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
                <div className="border-t bg-gray-50 px-4 sm:px-5 py-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Historial ({hist.length})</p>
                  {hist.length === 0 ? <p className="text-sm text-gray-400">Sin contratos</p> : (
                    <div className="space-y-2">
                      {hist.map(c => (
                        <div key={c.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white rounded-lg px-4 py-2 border border-gray-200">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.tipo_contrato==='Inicial'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}`}>{c.tipo_contrato}</span>
                            <span className="text-sm text-gray-700">{new Date(c.fecha_inicio+'T00:00:00').toLocaleDateString('es-PE')} → {new Date(c.fecha_final+'T00:00:00').toLocaleDateString('es-PE')} ({c.meses_alquiler}m)</span>
                            {c.garantia != null && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Garantía: S/ {c.garantia.toFixed(2)}</span>}
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
      <Modal open={modalInq}>
        <div className="px-6 py-4 border-b flex justify-between"><h2 className="text-lg font-semibold">Nuevo Inquilino</h2><button onClick={()=>setModalInq(false)} className="text-gray-400 text-xl">✕</button></div>
        <form onSubmit={handleCrearInq}>
          <div className="px-6 py-4 space-y-4">
            <div><label className="block text-sm font-medium mb-1">Nombre Completo</label><input type="text" className={`${inp} ${errores.nombre?'border-red-400':''}`} value={formInq.nombre_completo} onChange={e=>setFormInq({...formInq,nombre_completo:e.target.value})}/><FieldError error={errores.nombre}/></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium mb-1">DNI <span className="text-gray-400 font-normal">(8 dígitos)</span></label><input type="text" maxLength={8} className={`${inp} ${errores.dni?'border-red-400':''}`} value={formInq.dni} onChange={e=>setFormInq({...formInq,dni:e.target.value.replace(/\D/g,'')})}/><FieldError error={errores.dni}/></div>
              <div><label className="block text-sm font-medium mb-1">N° Depa</label><input type="number" min={1} className={`${inp} ${errores.num_depa?'border-red-400':''}`} value={formInq.num_depa} onChange={e=>setFormInq({...formInq,num_depa:e.target.value===''?'':parseInt(e.target.value)})}/><FieldError error={errores.num_depa}/></div>
            </div>
            <div><label className="block text-sm font-medium mb-1">Teléfono <span className="text-gray-400 font-normal">(9 dígitos)</span></label><input type="text" maxLength={9} className={`${inp} ${errores.telefono?'border-red-400':''}`} value={formInq.telefono} onChange={e=>setFormInq({...formInq,telefono:e.target.value.replace(/\D/g,'')})}/><FieldError error={errores.telefono}/></div>
          </div>
          <div className="px-6 py-4 border-t flex gap-2 justify-end"><button type="button" onClick={()=>setModalInq(false)} className="px-4 py-2 bg-gray-100 rounded-lg font-medium text-sm">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm">Guardar</button></div>
        </form>
      </Modal>

      {/* Modal Contrato — con campo Garantía */}
      <Modal open={modalCon}>
        <div className="px-6 py-4 border-b flex justify-between"><h2 className="text-lg font-semibold">Nuevo Contrato</h2><button onClick={()=>setModalCon(false)} className="text-gray-400 text-xl">✕</button></div>
        <form onSubmit={handleCrearCon}>
          <div className="px-6 py-4 space-y-4">
            <div><label className="block text-sm font-medium mb-1">Inquilino</label>
              <select className={inp} value={formCon.inquilino_id}
                onChange={e=>{
                  const garantiaPrevia = ultimaGarantiaPorInquilino(e.target.value)
                  setFormCon({...formCon, inquilino_id:e.target.value, garantia: garantiaPrevia != null ? String(garantiaPrevia) : formCon.garantia})
                }} required>
                <option value="">Seleccionar...</option>
                {inquilinos.map(i=><option key={i.id} value={i.id}>{i.nombre_completo} (D{i.num_depa})</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium mb-1">Tipo</label>
              <select className={inp} value={formCon.tipo_contrato} onChange={e=>setFormCon({...formCon,tipo_contrato:e.target.value as any})}>
                <option value="Inicial">Inicial</option><option value="Renovación">Renovación</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium mb-1">Fecha Inicio</label><input type="date" className={inp} value={formCon.fecha_inicio} onChange={e=>setFormCon({...formCon,fecha_inicio:e.target.value})} required/></div>
              <div><label className="block text-sm font-medium mb-1">Meses</label><input type="number" min={1} className={inp} value={formCon.meses_alquiler} onChange={e=>setFormCon({...formCon,meses_alquiler:parseInt(e.target.value)})} required/></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium mb-1">Importe Mensual (S/)</label><input type="number" step="0.01" min="0.01" max="50000" className={inp} placeholder="0.00" value={formCon.importe_alquiler} onChange={e=>setFormCon({...formCon,importe_alquiler:e.target.value})} required/></div>
              <div><label className="block text-sm font-medium mb-1">Garantía (S/) <span className="text-gray-400 font-normal">se mantiene del contrato anterior si existe</span></label><input type="number" step="0.01" min="0" className={inp} placeholder="0.00" value={formCon.garantia} onChange={e=>setFormCon({...formCon,garantia:e.target.value})}/></div>
            </div>
          </div>
          <div className="px-6 py-4 border-t flex gap-2 justify-end"><button type="button" onClick={()=>setModalCon(false)} className="px-4 py-2 bg-gray-100 rounded-lg font-medium text-sm">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm">Guardar</button></div>
        </form>
      </Modal>
    </div>
  )
}
export default InquilinosTab
