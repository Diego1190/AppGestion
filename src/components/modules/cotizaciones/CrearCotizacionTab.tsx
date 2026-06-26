import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, ToggleLeft, ToggleRight, Calculator, Package, Lock, Star, X } from 'lucide-react'
import { getCatalogo, createCotizacion, createDetalles, createInsumos } from '@/lib/cotizaciones'
import { getMaterialesExtra, createMaterialExtra, deleteMaterialExtra } from '@/lib/materialesExtra'
import {
  generarCorrelativo, calcularPared, calcularTecho, validarTelefono, MedidaParante, TipoPlaca, Vano,
  armarInsumosPared, armarInsumosTecho, armarInsumosMelamina,
} from '@/lib/calculations'
import { CatalogoServicio, MaterialExtraServicio } from '@/types/index'
import { useToast, ToastContainer, FieldError } from '@/components/Toast'
import { inputClass } from '@/components/ui/inputStyles'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'

// ── Tipos ────────────────────────────────────────────────────
interface LineaServicio {
  id: string; descripcion: string; cantidad: number
  unidad: string; precio_unitario: number; total_item: number
}

// Insumo interno: cada linea genera sus propios insumos (permite borrado limpio)
interface InsumoInterno {
  id: string
  linea_id: string       // 'manual' para items manuales
  material_nombre: string
  cantidad: number
  unidad: string
  precio_unitario: number
  es_manual: boolean
}

// Insumo agrupado: vista consolidada para mostrar y guardar
interface InsumoAgrupado {
  /** Solo presente en manuales: permite distinguir filas con el mismo nombre (o sin nombre) */
  id?: string
  material_nombre: string
  cantidad: number
  unidad: string
  precio_unitario: number
  es_manual: boolean
}

interface Condicion { id: string; texto: string; activa: boolean; editando: boolean }

const CONDICIONES_DEFAULT: Condicion[] = [
  { id:'1', texto:'60% de adelanto al inicio, 40% contra entrega.', activa:true, editando:false },
  { id:'2', texto:'6 meses de garantia por vicios ocultos.', activa:true, editando:false },
  { id:'3', texto:'Los materiales descritos estan incluidos en el presupuesto.', activa:false, editando:false },
  { id:'4', texto:'Cualquier trabajo adicional sera cotizado por separado.', activa:true, editando:false },
  { id:'5', texto:'El cliente debera proveer acceso libre al area de trabajo.', activa:false, editando:false },
]

const ACABADOS = ['Blanco','Blanco Brillante','Crema','Cerezo','Nogal','Wengue','Negro','Roble','Personalizado']

/** Fecha local Peru (UTC-5) — evita bug de toISOString que retorna UTC */
const localDateStr = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ── Componente ───────────────────────────────────────────────
const CrearCotizacionTab: React.FC = () => {
  const [catalogo, setCatalogo]             = useState<CatalogoServicio[]>([])
  const [loading, setLoading]               = useState(false)
  const [lineas, setLineas]                 = useState<LineaServicio[]>([])
  const [insumos, setInsumos]               = useState<InsumoInterno[]>([])
  const [preciosEditables, setPreciosEdit]  = useState(false)
  const [condiciones, setCondiciones]       = useState<Condicion[]>(CONDICIONES_DEFAULT)
  const [tiempoEstimado, setTiempoEstimado] = useState('')
  const [nuevaCondicion, setNuevaCondicion] = useState('')
  const [errores, setErrores]               = useState<Record<string,string>>({})
  const { toasts, addToast, removeToast }   = useToast()

  const [mParedes,  setMParedes]  = useState(false)
  const [mTechos,   setMTechos]   = useState(false)
  const [mMelamina, setMMelamina] = useState(false)
  const [mEsp,      setMEsp]      = useState(false)

  const [cliente, setCliente] = useState({
    nombre:'', telefono:'', empresa:'', proyecto:'', direccion:'', distrito:'', desgaste:0,
    incluye_materiales: true,
  })

  const [fPared, setFPared] = useState({
    largo:'', alto:'', caras:1, esquineros:0, medida:'64mm' as MedidaParante, tipoPlaca:'ST' as TipoPlaca, precio:45,
    puertas: [] as Vano[], ventanas: [] as Vano[],
  })
  const [fTecho, setFTecho] = useState({ ancho:'', largo:'', cobertura:'Calamina', caida:15, canaletas:0, precio:55 })
  const [fMel,   setFMel]   = useState({ planchas:'', grosor:'18mm', acabado:'Blanco', acabadoCustom:'', cantosD:'', cantosG:'', correderas:0, bisagras:0, jaladores:0, precio:85 })
  const [fEsp,   setFEsp]   = useState({ tipo:'Pintura', m2:'', puntos:'', precio:15 })

  // Materiales extra guardados por tipo de servicio: se auto-incluyen cada vez
  // que se agrega ese servicio a la cotización, sin tener que volver a escribirlos.
  const [materialesExtra, setMaterialesExtra] = useState<MaterialExtraServicio[]>([])
  const [panelExtraAbierto, setPanelExtraAbierto] = useState<string | null>(null) // tipo_servicio del panel abierto, o null

  const cargarMaterialesExtra = () => { getMaterialesExtra().then(setMaterialesExtra).catch(() => {}) }
  useEffect(() => { cargarMaterialesExtra() }, [])
  useRealtimeSync('materiales_extra_servicio', cargarMaterialesExtra)

  /** Extras guardados para un tipo de servicio, ya en formato InsumoCalculado para sumar a agregarServicio */
  const extrasDe = (tipoServicio: string): Omit<InsumoInterno, 'id'|'linea_id'>[] =>
    materialesExtra
      .filter(m => m.tipo_servicio === tipoServicio)
      .map(m => ({
        material_nombre: m.material_nombre, cantidad: m.cantidad_sugerida,
        unidad: m.unidad, precio_unitario: m.precio_unitario, es_manual: false,
      }))

  useEffect(() => {
    getCatalogo().then(data => {
      setCatalogo(data)
      const p = (cat: string) => data.find(c => c.categoria === cat)?.precio_base
      if (p('Drywall'))   setFPared(f => ({ ...f, precio: p('Drywall')! }))
      if (p('Techo'))     setFTecho(f => ({ ...f, precio: p('Techo')! }))
      if (p('Melamina'))  setFMel(f => ({ ...f, precio: p('Melamina')! }))
    }).catch(() => {})
  }, [])

  // ── INSUMOS AGRUPADOS (vista consolidada) ──────────────────
  // Los insumos internos se mantienen separados por linea para borrado limpio.
  // Para mostrar y guardar, se agrupan por material_nombre sumando cantidades.
  const insumosAgrupados = useMemo((): InsumoAgrupado[] => {
    const map = new Map<string, InsumoAgrupado>()
    insumos.forEach(ins => {
      // Los manuales aún sin nombre (o repetidos) se agrupan por su id único, para que
      // cada fila sea independiente y editable (antes se descartaban o se mezclaban).
      const key = ins.es_manual ? ins.id : ins.material_nombre.trim()
      if (!key) return
      if (map.has(key)) {
        const prev = map.get(key)!
        map.set(key, { ...prev, cantidad: prev.cantidad + ins.cantidad })
      } else {
        map.set(key, {
          id:              ins.es_manual ? ins.id : undefined,
          material_nombre: ins.material_nombre,
          cantidad:        ins.cantidad,
          unidad:          ins.unidad,
          precio_unitario: ins.precio_unitario,
          es_manual:       ins.es_manual,
        })
      }
    })
    return Array.from(map.values())
  }, [insumos])

  // ── Helpers de estado ────────────────────────────────────────
  const eliminarLinea = (id: string) => {
    setLineas(p => p.filter(l => l.id !== id))
    setInsumos(p => p.filter(i => i.linea_id !== id))
  }

  // Al agregar material manual
  const agregarInsumoManual = () => {
    const id = `manual_${Date.now()}`
    setInsumos(p => [...p, { id, linea_id:'manual', material_nombre:'', cantidad:1, unidad:'Unid', precio_unitario:0, es_manual:true }])
    setPreciosEdit(true)
  }

  // Eliminar todos los internos de un material agrupado (automáticos, por nombre)
  const eliminarMaterial = (nombreMaterial: string) => {
    setInsumos(p => p.filter(i => i.material_nombre !== nombreMaterial))
  }

  // Eliminar un insumo manual específico por id (evita borrar otros con el mismo nombre o vacíos)
  const eliminarInsumoManual = (id: string) => {
    setInsumos(p => p.filter(i => i.id !== id))
  }

  /** Guarda un material manual como extra recurrente: la próxima vez que se
   *  agregue ese tipo de servicio, este material se incluirá automáticamente. */
  const guardarComoRecurrente = async (ins: InsumoAgrupado, tipoServicio: MaterialExtraServicio['tipo_servicio']) => {
    if (!ins.material_nombre.trim()) { addToast('Escribe un nombre antes de guardarlo como recurrente','error'); return }
    try {
      await createMaterialExtra({
        tipo_servicio: tipoServicio, material_nombre: ins.material_nombre,
        unidad: ins.unidad, precio_unitario: ins.precio_unitario, cantidad_sugerida: ins.cantidad,
      })
      addToast(`"${ins.material_nombre}" se incluirá automáticamente en ${tipoServicio} de ahora en adelante`,'success')
      setPanelExtraAbierto(null)
    } catch { addToast('Error guardando como recurrente','error') }
  }

  // Actualizar precio en todos los internos con mismo nombre
  const actualizarPrecio = (nombreMaterial: string, nuevoPrecio: number) => {
    setInsumos(p => p.map(i => i.material_nombre === nombreMaterial ? { ...i, precio_unitario: nuevoPrecio } : i))
  }

  // Actualizar campo de insumo manual
  const actualizarManual = (id: string, campo: keyof InsumoInterno, valor: string | number) => {
    setInsumos(p => p.map(i => i.id === id ? { ...i, [campo]: valor } : i))
  }

  // Agregar linea de servicio + sus insumos
  const agregarServicio = (
    desc: string, cant: number, unidad: string, precio: number,
    nuevosInsumos: Omit<InsumoInterno, 'id'|'linea_id'>[]
  ) => {
    const id = Date.now().toString()
    setLineas(p => [...p, { id, descripcion:desc, cantidad:cant, unidad, precio_unitario:precio, total_item:cant*precio }])
    setInsumos(p => [...p, ...nuevosInsumos.map((ins, i) => ({ ...ins, id:`${id}_${i}`, linea_id:id }))])
  }

  // ── Calculadoras ─────────────────────────────────────────────
  const calcParedes = () => {
    if (!fPared.largo || !fPared.alto) { addToast('Ingresa largo y alto','error'); return }
    try {
      const vanos = [...fPared.puertas, ...fPared.ventanas]
      const r = calcularPared(parseFloat(fPared.largo), parseFloat(fPared.alto), fPared.caras, fPared.esquineros, fPared.medida, undefined, fPared.tipoPlaca, vanos)
      const area = parseFloat(r.area.toFixed(2))
      const vanosTxt = vanos.length > 0 ? ` − ${vanos.length} vano(s)` : ''
      agregarServicio(
        `Tabiqueria Drywall ${fPared.tipoPlaca} ${fPared.medida} — ${fPared.largo}m x ${fPared.alto}m x ${fPared.caras} cara(s)${vanosTxt}`,
        area, 'm2', fPared.precio,
        [...armarInsumosPared(r), ...extrasDe('Pared')],
      )
      addToast(`Area neta: ${area} m2 → ${r.placas} planchas, ${r.parantes} parantes, ${r.rieles} rieles`,'success')
      setFPared(f => ({ ...f, largo:'', alto:'', caras:1, esquineros:0, puertas:[], ventanas:[] }))
    } catch (err: any) { addToast(err.message,'error') }
  }

  const calcTechos = () => {
    if (!fTecho.ancho || !fTecho.largo) { addToast('Ingresa ancho y largo','error'); return }
    try {
      const r = calcularTecho(parseFloat(fTecho.ancho), parseFloat(fTecho.largo), fTecho.cobertura, fTecho.caida, fTecho.canaletas)
      const area = parseFloat(r.area.toFixed(2))
      agregarServicio(
        `Techo ${fTecho.cobertura} — ${fTecho.ancho}m x ${fTecho.largo}m (${fTecho.caida}% pendiente)`,
        area, 'm2', fTecho.precio,
        [...armarInsumosTecho(r, fTecho.cobertura, fTecho.canaletas), ...extrasDe('Techo')],
      )
      addToast(`Area: ${area} m2 → ${r.calaminas} calaminas, ${r.perfilesOmega} omegas`,'success')
      setFTecho(f => ({ ...f, ancho:'', largo:'', caida:15, canaletas:0 }))
    } catch (err: any) { addToast(err.message,'error') }
  }

  const calcMelamina = () => {
    const pl = parseFloat(fMel.planchas)
    if (!pl || pl <= 0) { addToast('Ingresa cantidad de planchas','error'); return }
    const acabado = fMel.acabado === 'Personalizado' ? fMel.acabadoCustom || 'Personalizado' : fMel.acabado
    agregarServicio(
      `Melamina ${fMel.grosor} ${acabado} — ${pl.toFixed(2)} plancha(s)`,
      pl, 'Plancha', fMel.precio,
      [
        ...armarInsumosMelamina({
          grosor: fMel.grosor, acabado, planchas: pl, precioPlancha: fMel.precio,
          cantosD: parseFloat(fMel.cantosD||'0'), cantosG: parseFloat(fMel.cantosG||'0'),
          correderas: fMel.correderas, bisagras: fMel.bisagras, jaladores: fMel.jaladores,
        }),
        ...extrasDe('Melamina'),
      ],
    )
    addToast(`Melamina: ${pl.toFixed(2)} planchas agregadas`,'success')
    setFMel(f => ({ ...f, planchas:'', cantosD:'', cantosG:'', correderas:0, bisagras:0, jaladores:0 }))
  }

  const calcEsp = () => {
    const esConteo = fEsp.tipo==='Electricidad'||fEsp.tipo==='Gasfiteria'
    if (esConteo && !fEsp.puntos) { addToast('Ingresa puntos','error'); return }
    if (!esConteo && !fEsp.m2)    { addToast('Ingresa m2','error'); return }
    const cant = esConteo ? parseInt(fEsp.puntos) : parseFloat(fEsp.m2)
    const unid = esConteo ? 'Punto' : 'm2'
    agregarServicio(`${fEsp.tipo} — ${cant} ${unid}`, cant, unid, fEsp.precio, extrasDe(fEsp.tipo))
    addToast('Especialidad agregada','success')
    setFEsp(f => ({ ...f, m2:'', puntos:'' }))
  }

  // ── Totales ──────────────────────────────────────────────────
  const totalManoObra    = lineas.reduce((s,l) => s + l.total_item, 0)
  const totalMateriales  = insumosAgrupados.reduce((s,i) => s + i.cantidad * i.precio_unitario, 0)
  const desgaste         = totalManoObra * (cliente.desgaste / 100)
  const costoMat         = cliente.incluye_materiales ? totalMateriales : 0
  const totalGeneral     = totalManoObra + costoMat + desgaste

  // ── Condiciones ──────────────────────────────────────────────
  const toggleCond   = (id: string) => setCondiciones(p => p.map(c => c.id===id ? {...c,activa:!c.activa} : c))
  const editarCond   = (id: string, t: string) => setCondiciones(p => p.map(c => c.id===id ? {...c,texto:t} : c))
  const toggleEdit   = (id: string) => setCondiciones(p => p.map(c => c.id===id ? {...c,editando:!c.editando} : c))
  const eliminarCond = (id: string) => setCondiciones(p => p.filter(c => c.id!==id))
  const agregarCond  = () => {
    if (!nuevaCondicion.trim()) return
    setCondiciones(p => [...p, { id:Date.now().toString(), texto:nuevaCondicion.trim(), activa:true, editando:false }])
    setNuevaCondicion('')
  }

  // ── Validar ──────────────────────────────────────────────────
  const validar = (): boolean => {
    const e: Record<string,string> = {}
    if (!cliente.nombre.trim()) e.nombre = 'El nombre es obligatorio'
    if (!cliente.telefono.trim()) e.telefono = 'El telefono es obligatorio'
    else { const et = validarTelefono(cliente.telefono); if (et) e.telefono = et }
    if (!cliente.direccion.trim()) e.direccion = 'La direccion es obligatoria'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  // ── Guardar ──────────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!validar()) { addToast('Corrige los campos requeridos','error'); return }
    if (lineas.length === 0 && insumosAgrupados.filter(i=>i.es_manual).length === 0) {
      addToast('Agrega al menos un servicio o material','error'); return
    }
    setLoading(true)
    try {
      const correlativo = generarCorrelativo()
      const hoy  = localDateStr()          // ← hora local Peru, no UTC
      const venc = new Date(); venc.setDate(venc.getDate() + 5)
      const vencStr = `${venc.getFullYear()}-${String(venc.getMonth()+1).padStart(2,'0')}-${String(venc.getDate()).padStart(2,'0')}`

      const condText = condiciones.filter(c=>c.activa).map(c=>`- ${c.texto}`).join('\n')
      const facilidades = [
        tiempoEstimado ? `Tiempo estimado: ${tiempoEstimado}` : '',
        !cliente.incluye_materiales ? 'No incluye costo de materiales.' : '',
      ].filter(Boolean).join(' | ')

      const cot = await createCotizacion({
        correlativo, fecha_emision:hoy, fecha_vencimiento:vencStr,
        cliente_nombre:cliente.nombre, cliente_telefono:cliente.telefono,
        cliente_empresa:cliente.empresa,
        proyecto_nombre:cliente.proyecto||cliente.nombre,
        proyecto_direccion:cliente.direccion, proyecto_distrito:cliente.distrito,
        condiciones_pago:condText, garantia:'', facilidades_cliente:facilidades,
        porcentaje_desgaste:cliente.desgaste,
        monto_subtotal:totalManoObra+costoMat,
        monto_desgaste_total:desgaste,
        monto_total:totalGeneral,
        monto_materiales:totalMateriales,
        estado:'Activa',
      })

      if (lineas.length > 0) {
        await createDetalles(lineas.map(l => ({
          cotizacion_id:cot.id, servicio_codigo:'',
          descripcion:l.descripcion, cantidad:l.cantidad,
          precio_unitario:l.precio_unitario, total_item:l.total_item,
        })))
      }

      // Guardar insumos AGRUPADOS (sin duplicados)
      const insumosValidos = insumosAgrupados.filter(i => i.material_nombre.trim() && i.cantidad > 0)
      if (insumosValidos.length > 0) {
        await createInsumos(insumosValidos.map(i => ({
          cotizacion_id:cot.id, material_nombre:i.material_nombre,
          cantidad_estimada:i.cantidad, unidad:i.unidad, comprado:false,
        })))
      }

      addToast(`Cotizacion ${correlativo} guardada en Historial`,'success')
      // Reset
      setLineas([]); setInsumos([]); setPreciosEdit(false)
      setCliente({ nombre:'',telefono:'',empresa:'',proyecto:'',direccion:'',distrito:'',desgaste:0,incluye_materiales:true })
      setCondiciones(CONDICIONES_DEFAULT); setTiempoEstimado('')
      setMParedes(false); setMTechos(false); setMMelamina(false); setMEsp(false)
    } catch (err:any) { addToast(err.message||'Error guardando','error') }
    finally { setLoading(false) }
  }

  // ── Render helpers ───────────────────────────────────────────
  const inp = inputClass
  const Toggle = ({ active, onChange, label }: { active:boolean; onChange:()=>void; label:string }) => (
    <button type="button" onClick={onChange}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all
        ${active ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
      {active ? <ToggleRight className="w-4 h-4"/> : <ToggleLeft className="w-4 h-4"/>}
      {label}
    </button>
  )

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toasts} onClose={removeToast}/>

      {/* 1. DATOS CLIENTE */}
      <section className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4 text-sm flex items-center gap-2">
          <span className="w-5 h-5 bg-blue-100 rounded text-blue-700 flex items-center justify-center text-xs font-bold">1</span>
          Datos del Cliente
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Cliente *</label>
            <input type="text" className={`${inp} ${errores.nombre?'border-red-400':''}`} value={cliente.nombre} onChange={e=>setCliente({...cliente,nombre:e.target.value})} placeholder="Nombre completo"/>
            {errores.nombre && <p className="text-xs text-red-500 mt-1">⚠ {errores.nombre}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Telefono * <span className="text-gray-400">(9 digitos)</span></label>
            <input type="text" maxLength={9} className={`${inp} ${errores.telefono?'border-red-400':''}`} value={cliente.telefono} onChange={e=>setCliente({...cliente,telefono:e.target.value.replace(/\D/g,'')})}/>
            {errores.telefono && <p className="text-xs text-red-500 mt-1">⚠ {errores.telefono}</p>}
          </div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Empresa</label><input type="text" className={inp} value={cliente.empresa} onChange={e=>setCliente({...cliente,empresa:e.target.value})}/></div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Nombre del Proyecto</label><input type="text" className={inp} value={cliente.proyecto} onChange={e=>setCliente({...cliente,proyecto:e.target.value})} placeholder="Opcional"/></div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Direccion *</label>
            <input type="text" className={`${inp} ${errores.direccion?'border-red-400':''}`} value={cliente.direccion} onChange={e=>setCliente({...cliente,direccion:e.target.value})}/>
            {errores.direccion && <p className="text-xs text-red-500 mt-1">⚠ {errores.direccion}</p>}
          </div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Distrito</label><input type="text" className={inp} value={cliente.distrito} onChange={e=>setCliente({...cliente,distrito:e.target.value})}/></div>
        </div>
      </section>

      {/* 2. CALCULADORA MODULAR */}
      <section className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4 text-sm flex items-center gap-2">
          <span className="w-5 h-5 bg-indigo-100 rounded text-indigo-700 flex items-center justify-center text-xs font-bold">2</span>
          Calculadora Modular
        </h3>
        <div className="flex flex-wrap gap-2 mb-5">
          <Toggle active={mParedes}  onChange={()=>setMParedes(!mParedes)}   label="🧱 Paredes"/>
          <Toggle active={mTechos}   onChange={()=>setMTechos(!mTechos)}     label="📐 Techos"/>
          <Toggle active={mMelamina} onChange={()=>setMMelamina(!mMelamina)} label="🍽️ Melamina"/>
          <Toggle active={mEsp}      onChange={()=>setMEsp(!mEsp)}           label="🔌 Especialidades"/>
        </div>

        {mParedes && (
          <div className="bg-indigo-50 rounded-xl p-4 mb-3 border border-indigo-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-indigo-800">🧱 Paredes Drywall</span>
              <span className="text-xs text-indigo-500 bg-indigo-100 px-2 py-0.5 rounded">2 caras = doble placa, misma estructura</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2 mb-3">
              <div><label className="block text-[11px] font-medium mb-1">Largo (m)</label><input type="number" step="0.01" min="0.1" max="50" className={inp} value={fPared.largo} onChange={e=>setFPared({...fPared,largo:e.target.value})}/></div>
              <div><label className="block text-[11px] font-medium mb-1">Alto (m)</label><input type="number" step="0.01" min="0.1" max="50" className={inp} value={fPared.alto} onChange={e=>setFPared({...fPared,alto:e.target.value})}/></div>
              <div><label className="block text-[11px] font-medium mb-1">Medida</label><select className={inp} value={fPared.medida} onChange={e=>setFPared({...fPared,medida:e.target.value as MedidaParante})}><option value="38mm">38mm</option><option value="64mm">64mm</option><option value="89mm">89mm</option></select></div>
              <div><label className="block text-[11px] font-medium mb-1">Tipo Placa</label><select className={inp} value={fPared.tipoPlaca} onChange={e=>setFPared({...fPared,tipoPlaca:e.target.value as TipoPlaca})}><option value="ST">ST (Standard)</option><option value="RH">RH (Resist. Humedad)</option></select></div>
              <div><label className="block text-[11px] font-medium mb-1">Caras</label><select className={inp} value={fPared.caras} onChange={e=>setFPared({...fPared,caras:parseInt(e.target.value)})}><option value={1}>1 cara</option><option value={2}>2 caras</option></select></div>
              <div><label className="block text-[11px] font-medium mb-1">Esquineros</label><input type="number" min="0" className={inp} value={fPared.esquineros||''} placeholder="0" onChange={e=>setFPared({...fPared,esquineros:parseInt(e.target.value)||0})}/></div>
              <div><label className="block text-[11px] font-medium mb-1 text-indigo-600">Precio m2</label><input type="number" step="0.01" className={inp} value={fPared.precio} onChange={e=>setFPared({...fPared,precio:parseFloat(e.target.value)||0})}/></div>
            </div>

            {/* Vanos: puertas y ventanas, restan área y suman refuerzo de marco */}
            <div className="bg-white rounded-lg border border-indigo-200 p-3 mb-3">
              <p className="text-xs font-semibold text-indigo-700 mb-2">Vanos (puertas / ventanas) — opcional</p>
              <div className="flex gap-2 mb-2">
                <button onClick={()=>setFPared(f=>({...f, puertas:[...f.puertas, {tipo:'Puerta', ancho:0.9, alto:2.1, cantidad:1}]}))}
                  className="text-xs px-2.5 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg font-medium flex items-center gap-1"><Plus className="w-3 h-3"/>Puerta</button>
                <button onClick={()=>setFPared(f=>({...f, ventanas:[...f.ventanas, {tipo:'Ventana', ancho:1.2, alto:1.0, cantidad:1}]}))}
                  className="text-xs px-2.5 py-1.5 bg-sky-100 hover:bg-sky-200 text-sky-700 rounded-lg font-medium flex items-center gap-1"><Plus className="w-3 h-3"/>Ventana</button>
              </div>
              {[...fPared.puertas.map((v,i)=>({v,i,grupo:'puertas' as const})), ...fPared.ventanas.map((v,i)=>({v,i,grupo:'ventanas' as const}))].map(({v,i,grupo}) => (
                <div key={`${grupo}-${i}`} className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[11px] text-gray-500 w-14">{v.tipo}</span>
                  <input type="number" step="0.01" min="0.1" className="w-16 px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Ancho" value={v.ancho}
                    onChange={e=>setFPared(f=>({...f, [grupo]: f[grupo].map((x,xi)=>xi===i?{...x,ancho:parseFloat(e.target.value)||0}:x)}))}/>
                  <span className="text-[10px] text-gray-400">x</span>
                  <input type="number" step="0.01" min="0.1" className="w-16 px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Alto" value={v.alto}
                    onChange={e=>setFPared(f=>({...f, [grupo]: f[grupo].map((x,xi)=>xi===i?{...x,alto:parseFloat(e.target.value)||0}:x)}))}/>
                  <span className="text-[10px] text-gray-400">m ×</span>
                  <input type="number" min="1" className="w-12 px-2 py-1 border border-gray-300 rounded text-xs" value={v.cantidad}
                    onChange={e=>setFPared(f=>({...f, [grupo]: f[grupo].map((x,xi)=>xi===i?{...x,cantidad:parseInt(e.target.value)||1}:x)}))}/>
                  <button onClick={()=>setFPared(f=>({...f, [grupo]: f[grupo].filter((_,xi)=>xi!==i)}))} className="p-1 text-red-400 hover:bg-red-50 rounded ml-auto"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
              ))}
              {fPared.puertas.length===0 && fPared.ventanas.length===0 && <p className="text-[11px] text-gray-400">Sin vanos agregados.</p>}
            </div>

            {fPared.largo&&fPared.alto&&(()=>{try{const r=calcularPared(parseFloat(fPared.largo),parseFloat(fPared.alto),fPared.caras,fPared.esquineros,fPared.medida,undefined,fPared.tipoPlaca,[...fPared.puertas,...fPared.ventanas]);return(<p className="text-xs text-indigo-700 bg-indigo-100 rounded px-3 py-1.5 mb-3">Area neta: <strong>{r.area.toFixed(2)} m2</strong>{r.areaVanos>0&&<> (−{r.areaVanos.toFixed(2)} m2 de vanos)</>} → {r.placas} planchas · {r.parantes} parantes · {r.rieles} rieles</p>)}catch{return null}})()}
            <button onClick={calcParedes} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5"><Calculator className="w-4 h-4"/>Agregar Servicio</button>
          </div>
        )}

        {mTechos && (
          <div className="bg-sky-50 rounded-xl p-4 mb-3 border border-sky-100">
            <span className="text-sm font-semibold text-sky-800 block mb-3">📐 Techos y Coberturas</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-3">
              <div><label className="block text-[11px] font-medium mb-1">Ancho (m)</label><input type="number" step="0.01" min="0.1" max="50" className={inp} value={fTecho.ancho} onChange={e=>setFTecho({...fTecho,ancho:e.target.value})}/></div>
              <div><label className="block text-[11px] font-medium mb-1">Largo (m)</label><input type="number" step="0.01" min="0.1" max="50" className={inp} value={fTecho.largo} onChange={e=>setFTecho({...fTecho,largo:e.target.value})}/></div>
              <div><label className="block text-[11px] font-medium mb-1">Cobertura</label><select className={inp} value={fTecho.cobertura} onChange={e=>setFTecho({...fTecho,cobertura:e.target.value})}><option>Calamina</option><option>Eternit</option><option>Polipropileno</option></select></div>
              <div><label className="block text-[11px] font-medium mb-1">Pendiente %</label><input type="number" min="0" max="100" className={inp} value={fTecho.caida} onChange={e=>setFTecho({...fTecho,caida:parseInt(e.target.value)||0})}/></div>
              <div><label className="block text-[11px] font-medium mb-1">Canaletas ml</label><input type="number" min="0" className={inp} value={fTecho.canaletas||''} placeholder="0" onChange={e=>setFTecho({...fTecho,canaletas:parseInt(e.target.value)||0})}/></div>
              <div><label className="block text-[11px] font-medium mb-1 text-sky-600">Precio m2</label><input type="number" step="0.01" className={inp} value={fTecho.precio} onChange={e=>setFTecho({...fTecho,precio:parseFloat(e.target.value)||0})}/></div>
            </div>
            <button onClick={calcTechos} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5"><Calculator className="w-4 h-4"/>Agregar Servicio</button>
          </div>
        )}

        {mMelamina && (
          <div className="bg-amber-50 rounded-xl p-4 mb-3 border border-amber-100">
            <span className="text-sm font-semibold text-amber-800 block mb-3">🍽️ Melamina / Muebles</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-3">
              <div><label className="block text-[11px] font-medium mb-1">Planchas</label><input type="number" step="0.25" min="0.25" className={inp} value={fMel.planchas} onChange={e=>setFMel({...fMel,planchas:e.target.value})}/></div>
              <div><label className="block text-[11px] font-medium mb-1">Grosor</label><select className={inp} value={fMel.grosor} onChange={e=>setFMel({...fMel,grosor:e.target.value})}><option>15mm</option><option>18mm</option><option>25mm</option></select></div>
              <div><label className="block text-[11px] font-medium mb-1">Acabado</label><select className={inp} value={fMel.acabado} onChange={e=>setFMel({...fMel,acabado:e.target.value})}>{ACABADOS.map(a=><option key={a}>{a}</option>)}</select></div>
              {fMel.acabado==='Personalizado'&&<div><label className="block text-[11px] font-medium mb-1">Especifica</label><input type="text" className={inp} value={fMel.acabadoCustom} onChange={e=>setFMel({...fMel,acabadoCustom:e.target.value})}/></div>}
              <div><label className="block text-[11px] font-medium mb-1">Canto Delgado ml</label><input type="number" step="0.1" min="0" className={inp} value={fMel.cantosD} onChange={e=>setFMel({...fMel,cantosD:e.target.value})}/></div>
              <div><label className="block text-[11px] font-medium mb-1">Canto Grueso ml</label><input type="number" step="0.1" min="0" className={inp} value={fMel.cantosG} onChange={e=>setFMel({...fMel,cantosG:e.target.value})}/></div>
              <div><label className="block text-[11px] font-medium mb-1">Correderas</label><input type="number" min="0" className={inp} value={fMel.correderas||''} placeholder="0" onChange={e=>setFMel({...fMel,correderas:parseInt(e.target.value)||0})}/></div>
              <div><label className="block text-[11px] font-medium mb-1">Bisagras</label><input type="number" min="0" className={inp} value={fMel.bisagras||''} placeholder="0" onChange={e=>setFMel({...fMel,bisagras:parseInt(e.target.value)||0})}/></div>
              <div><label className="block text-[11px] font-medium mb-1">Jaladores</label><input type="number" min="0" className={inp} value={fMel.jaladores||''} placeholder="0" onChange={e=>setFMel({...fMel,jaladores:parseInt(e.target.value)||0})}/></div>
              <div><label className="block text-[11px] font-medium mb-1 text-amber-600">Precio plancha</label><input type="number" step="0.01" className={inp} value={fMel.precio} onChange={e=>setFMel({...fMel,precio:parseFloat(e.target.value)||0})}/></div>
            </div>
            <button onClick={calcMelamina} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5"><Calculator className="w-4 h-4"/>Agregar Servicio</button>
          </div>
        )}

        {mEsp && (
          <div className="bg-purple-50 rounded-xl p-4 mb-3 border border-purple-100">
            <span className="text-sm font-semibold text-purple-800 block mb-3">🔌 Especialidades</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <div><label className="block text-[11px] font-medium mb-1">Tipo</label><select className={inp} value={fEsp.tipo} onChange={e=>{
                const nuevoTipo = e.target.value
                const precioSugerido = catalogo.find(c => c.categoria === nuevoTipo)?.precio_base
                setFEsp({...fEsp, tipo:nuevoTipo, m2:'', puntos:'', precio: precioSugerido ?? fEsp.precio})
              }}><option>Pintura</option><option>Enchape</option><option>Electricidad</option><option>Gasfiteria</option></select></div>
              {(fEsp.tipo==='Pintura'||fEsp.tipo==='Enchape')&&<div><label className="block text-[11px] font-medium mb-1">m2</label><input type="number" step="0.01" className={inp} value={fEsp.m2} onChange={e=>setFEsp({...fEsp,m2:e.target.value})}/></div>}
              {(fEsp.tipo==='Electricidad'||fEsp.tipo==='Gasfiteria')&&<div><label className="block text-[11px] font-medium mb-1">Puntos</label><input type="number" min="1" className={inp} value={fEsp.puntos} onChange={e=>setFEsp({...fEsp,puntos:e.target.value})}/></div>}
              <div><label className="block text-[11px] font-medium mb-1 text-purple-600">Precio unit.</label><input type="number" step="0.01" className={inp} value={fEsp.precio} onChange={e=>setFEsp({...fEsp,precio:parseFloat(e.target.value)||0})}/></div>
            </div>
            <button onClick={calcEsp} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5"><Plus className="w-4 h-4"/>Anadir</button>
          </div>
        )}

        {/* Resumen servicios */}
        {lineas.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Servicios Agregados</p>
            <div className="space-y-1.5">
              {lineas.map(l => (
                <div key={l.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                  <span className="text-sm text-gray-800 flex-1">{l.descripcion}</span>
                  <div className="flex items-center gap-4 ml-4">
                    <span className="text-xs text-gray-500">{l.cantidad.toFixed(2)} {l.unidad} x S/ {l.precio_unitario.toFixed(2)}</span>
                    <span className="text-sm font-semibold text-gray-900">S/ {l.total_item.toFixed(2)}</span>
                    <button onClick={() => eliminarLinea(l.id)} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-2">
              <span className="text-sm text-gray-500">Total mano de obra: <strong className="text-gray-900">S/ {totalManoObra.toFixed(2)}</strong></span>
            </div>
          </div>
        )}
      </section>

      {/* PANEL: Materiales recurrentes guardados */}
      {materialesExtra.length > 0 && (
        <section className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm mb-1">
          <button onClick={() => setPanelExtraAbierto(panelExtraAbierto === 'gestion' ? null : 'gestion')}
            className="w-full flex items-center justify-between text-sm font-medium text-amber-700">
            <span className="flex items-center gap-2"><Star className="w-4 h-4"/>Materiales recurrentes ({materialesExtra.length})</span>
            <span className="text-xs text-gray-400">{panelExtraAbierto === 'gestion' ? 'Ocultar' : 'Ver / quitar'}</span>
          </button>
          {panelExtraAbierto === 'gestion' && (
            <div className="mt-3 space-y-1.5">
              {materialesExtra.map(m => (
                <div key={m.id} className="flex items-center justify-between gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-gray-700"><strong className="text-amber-700">{m.tipo_servicio}</strong> — {m.material_nombre} ({m.cantidad_sugerida} {m.unidad} · S/{m.precio_unitario})</span>
                  <button onClick={async () => { try { await deleteMaterialExtra(m.id); addToast('Quitado de recurrentes','success') } catch { addToast('Error al quitar','error') } }}
                    className="p-1 text-red-400 hover:bg-red-50 rounded flex-shrink-0"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 3. LISTA DE PRECIOS E INSUMOS */}
      <section className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            <span className="w-5 h-5 bg-amber-100 rounded text-amber-700 flex items-center justify-center text-xs font-bold">3</span>
            <Package className="w-4 h-4 text-amber-600"/>
            Lista de Precios e Insumos
            {insumosAgrupados.length > 0 && <span className="text-xs text-gray-400 font-normal">({insumosAgrupados.length} materiales)</span>}
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setPreciosEdit(!preciosEditables)}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${preciosEditables ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
              {preciosEditables ? '🔓 Precios Editables' : '🔒 Precios Editables'}
            </button>
            <button onClick={agregarInsumoManual}
              className="w-8 h-8 bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center justify-center font-bold text-lg">
              +
            </button>
          </div>
        </div>

        {insumosAgrupados.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            Los materiales se calculan automaticamente con la Calculadora Modular.<br/>
            Presiona <strong>+</strong> para agregar manualmente.
          </div>
        ) : (
          <>
            {/* MÓVIL: cards de insumos */}
            <div className="md:hidden space-y-2 mb-4">
              {insumosAgrupados.map(ins => {
                const interno = ins.es_manual ? insumos.find(i => i.id === ins.id) : undefined
                const editable = ins.es_manual && preciosEditables && interno
                return (
                  <div key={ins.id ?? ins.material_nombre} className="bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      {editable ? (
                        <input type="text" className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-amber-400 focus:outline-none"
                          value={interno.material_nombre} placeholder="Nombre del material" autoFocus
                          onChange={e => actualizarManual(interno.id, 'material_nombre', e.target.value)}/>
                      ) : (
                        <p className="font-medium text-sm text-gray-800 truncate">{ins.material_nombre || <span className="text-gray-400 italic">Sin nombre</span>}</p>
                      )}
                      <div className="flex items-center gap-1 flex-shrink-0 relative">
                        {ins.es_manual && ins.material_nombre.trim() && (
                          <button onClick={() => setPanelExtraAbierto(panelExtraAbierto === ins.id ? null : (ins.id || null))}
                            title="Guardar como material recurrente" className="p-1 text-amber-400 hover:bg-amber-50 rounded"><Star className="w-3.5 h-3.5"/></button>
                        )}
                        <button onClick={() => ins.es_manual && ins.id ? eliminarInsumoManual(ins.id) : eliminarMaterial(ins.material_nombre)}
                          className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                        {panelExtraAbierto === ins.id && (
                          <div className="absolute right-0 top-7 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2 w-44">
                            <p className="text-[11px] text-gray-500 mb-1.5 px-1">Auto-incluir en futuras:</p>
                            {(['Pared','Techo','Melamina','Pintura','Enchape','Electricidad','Gasfiteria'] as const).map(tipo => (
                              <button key={tipo} onClick={() => guardarComoRecurrente(ins, tipo)}
                                className="block w-full text-left text-xs px-2 py-1.5 hover:bg-amber-50 rounded">{tipo}</button>
                            ))}
                            <button onClick={() => setPanelExtraAbierto(null)} className="flex items-center gap-1 text-[11px] text-gray-400 px-2 py-1 mt-1 hover:text-gray-600"><X className="w-3 h-3"/>Cancelar</button>
                          </div>
                        )}
                      </div>
                    </div>
                    {editable ? (
                      <div className="flex items-center gap-2">
                        <input type="number" step="0.01" min="0.01" className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center focus:ring-1 focus:ring-amber-400 focus:outline-none"
                          value={interno.cantidad} onChange={e => actualizarManual(interno.id, 'cantidad', parseFloat(e.target.value)||0)}/>
                        <input type="text" className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-amber-400 focus:outline-none"
                          value={interno.unidad} onChange={e => actualizarManual(interno.id, 'unidad', e.target.value)}/>
                        <span className="text-gray-400 text-xs">S/</span>
                        <input type="number" step="0.01" min="0" className="w-20 px-2 py-1 border border-amber-300 bg-amber-50 rounded text-sm text-right focus:ring-1 focus:ring-amber-400 focus:outline-none"
                          value={interno.precio_unitario} onChange={e => actualizarManual(interno.id, 'precio_unitario', parseFloat(e.target.value)||0)}/>
                        <span className="font-semibold text-sm text-gray-900 ml-auto">S/{(interno.cantidad*interno.precio_unitario).toFixed(2)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">{ins.cantidad.toFixed(2)} {ins.unidad} × S/{ins.precio_unitario.toFixed(2)}</p>
                        <span className="font-semibold text-sm text-gray-900">S/{(ins.cantidad*ins.precio_unitario).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {/* DESKTOP: tabla */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Material</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Cant.</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">P. Unit (S/)</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Subtotal</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {insumosAgrupados.map(ins => {
                  // Para edicion manual, encontrar el interno correspondiente por id (nombre puede repetirse o estar vacío)
                  const interno = ins.es_manual ? insumos.find(i => i.id === ins.id) : undefined
                  return (
                    <tr key={ins.id ?? ins.material_nombre} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3">
                        {ins.es_manual && preciosEditables && interno ? (
                          <input type="text" className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-amber-400 focus:outline-none"
                            value={interno.material_nombre} placeholder="Nombre del material" autoFocus
                            onChange={e => actualizarManual(interno.id, 'material_nombre', e.target.value)}/>
                        ) : (
                          <span className="font-medium text-gray-800">{ins.material_nombre || <span className="text-gray-400 italic">Sin nombre</span>}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {ins.es_manual && preciosEditables && interno ? (
                          <div className="flex items-center gap-1 justify-center">
                            <input type="number" step="0.01" min="0.01" className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center focus:ring-1 focus:ring-amber-400 focus:outline-none"
                              value={interno.cantidad} onChange={e => actualizarManual(interno.id, 'cantidad', parseFloat(e.target.value)||0)}/>
                            <input type="text" className="w-14 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-amber-400 focus:outline-none"
                              value={interno.unidad} onChange={e => actualizarManual(interno.id, 'unidad', e.target.value)}/>
                          </div>
                        ) : (
                          <span className="text-gray-700">{ins.cantidad.toFixed(2)}<br/><span className="text-xs text-gray-400">{ins.unidad}</span></span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-gray-400 text-xs">S/</span>
                          <input type="number" step="0.01" min="0"
                            className={`w-20 px-2 py-1 border rounded text-sm text-right focus:ring-1 focus:ring-amber-400 focus:outline-none transition-colors
                              ${preciosEditables ? 'border-amber-300 bg-amber-50' : 'border-transparent bg-transparent cursor-default'}`}
                            value={ins.precio_unitario}
                            readOnly={!preciosEditables}
                            onChange={e => ins.es_manual && interno ? actualizarManual(interno.id, 'precio_unitario', parseFloat(e.target.value)||0) : actualizarPrecio(ins.material_nombre, parseFloat(e.target.value)||0)}/>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-gray-900">
                        S/ {(ins.cantidad * ins.precio_unitario).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-1 relative">
                          {ins.es_manual && ins.material_nombre.trim() && (
                            <button onClick={() => setPanelExtraAbierto(panelExtraAbierto === ins.id ? null : (ins.id || null))}
                              title="Guardar como material recurrente" className="p-1 text-amber-400 hover:bg-amber-50 rounded"><Star className="w-3.5 h-3.5"/></button>
                          )}
                          <button onClick={() => ins.es_manual && ins.id ? eliminarInsumoManual(ins.id) : eliminarMaterial(ins.material_nombre)}
                            className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                          {panelExtraAbierto === ins.id && (
                            <div className="absolute right-0 top-7 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2 w-48">
                              <p className="text-[11px] text-gray-500 mb-1.5 px-1">Auto-incluir en futuras:</p>
                              {(['Pared','Techo','Melamina','Pintura','Enchape','Electricidad','Gasfiteria'] as const).map(tipo => (
                                <button key={tipo} onClick={() => guardarComoRecurrente(ins, tipo)}
                                  className="block w-full text-left text-xs px-2 py-1.5 hover:bg-amber-50 rounded">{tipo}</button>
                              ))}
                              <button onClick={() => setPanelExtraAbierto(null)} className="flex items-center gap-1 text-[11px] text-gray-400 px-2 py-1 mt-1 hover:text-gray-600"><X className="w-3 h-3"/>Cancelar</button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table> {/* fin desktop table */}

            {/* Totales */}
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Total Mano de Obra:</span>
                <span className="font-medium">S/ {totalManoObra.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Materiales:</span>
                <span className="font-semibold text-amber-600">S/ {totalMateriales.toFixed(2)}</span>
              </div>

              {/* Toggle materiales */}
              <div className={`rounded-lg border p-3 ${cliente.incluye_materiales ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Incluir materiales en total</span>
                  <button type="button" onClick={() => setCliente(c => ({...c,incluye_materiales:!c.incluye_materiales}))}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all
                      ${cliente.incluye_materiales ? 'bg-green-100 border-green-300 text-green-700' : 'bg-gray-100 border-gray-300 text-gray-500'}`}>
                    {cliente.incluye_materiales ? <><ToggleRight className="w-4 h-4"/>Incluye materiales</> : <><Lock className="w-3 h-3"/><ToggleLeft className="w-4 h-4"/>No incluye materiales</>}
                  </button>
                </div>
                {!cliente.incluye_materiales && <p className="text-xs text-orange-600 mt-1">La cotizacion no incluye el costo de materiales</p>}
              </div>

              {/* Factor desgaste */}
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span>Desgaste / Herramientas</span>
                  <input type="number" min="0" max="20" className="w-14 px-2 py-0.5 border rounded text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
                    value={cliente.desgaste} onChange={e=>setCliente({...cliente,desgaste:parseInt(e.target.value)||0})}/>
                  <span className="text-xs">%</span>
                </div>
                <span>S/ {desgaste.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="font-semibold text-gray-800">Costo Total Estimado:</span>
                <span className="text-xl font-bold text-gray-900">S/ {totalGeneral.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}
      </section>

      {/* 4. CONDICIONES */}
      <section className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-4 text-sm flex items-center gap-2">
          <span className="w-5 h-5 bg-green-100 rounded text-green-700 flex items-center justify-center text-xs font-bold">4</span>
          Condiciones del Servicio
        </h3>
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Tiempo Estimado de Obra</label>
          <input type="text" className={`${inp} max-w-sm`} value={tiempoEstimado} onChange={e=>setTiempoEstimado(e.target.value)} placeholder="Ej: 5 dias habiles, 2 semanas"/>
        </div>
        <div className="space-y-2 mb-4">
          {condiciones.map(c => (
            <div key={c.id} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${c.activa ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'}`}>
              <button onClick={() => toggleCond(c.id)} className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${c.activa ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                {c.activa && <span className="text-white text-[10px] leading-none">✓</span>}
              </button>
              {c.editando ? (
                <div className="flex-1 flex items-center gap-2">
                  <input type="text" className={`${inp} flex-1`} value={c.texto} onChange={e=>editarCond(c.id,e.target.value)} onKeyDown={e=>e.key==='Enter'&&toggleEdit(c.id)} autoFocus/>
                  <button onClick={()=>toggleEdit(c.id)} className="p-1 text-green-600 hover:bg-green-50 rounded">✓</button>
                </div>
              ) : (
                <span className={`flex-1 text-sm ${c.activa ? 'text-gray-700' : 'text-gray-400'}`}>{c.texto}</span>
              )}
              {!c.editando && (
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={()=>toggleEdit(c.id)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded text-xs">✏️</button>
                  <button onClick={()=>eliminarCond(c.id)} className="p-1 text-red-300 hover:text-red-500 hover:bg-red-50 rounded text-xs">✕</button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" className={`${inp} flex-1`} value={nuevaCondicion} onChange={e=>setNuevaCondicion(e.target.value)} onKeyDown={e=>e.key==='Enter'&&agregarCond()} placeholder="Escribe una condicion y presiona Enter o '+'"/>
          <button onClick={agregarCond} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold text-lg">+</button>
        </div>
      </section>

      {/* GUARDAR */}
      <div className="flex items-center justify-between pb-6">
        <p className="text-sm text-gray-500">
          {lineas.length > 0 ? `${lineas.length} servicio(s) · ${insumosAgrupados.length} material(es)` : 'Sin servicios'}
        </p>
        <button onClick={handleGuardar} disabled={loading}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
          {loading ? 'Guardando...' : '💾 Guardar Cotizacion → Historial'}
        </button>
      </div>
    </div>
  )
}

export default CrearCotizacionTab
