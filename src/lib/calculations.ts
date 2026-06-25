// ============================================================
// CONSTANTES TECNICAS — fuente unica de verdad
// ============================================================
const PLANCHA_AREA_M2         = 2.977   // 1.22m x 2.44m
const SEPARACION_PARANTE_M    = 0.406   // 16"
const ALTURA_MAX_PARANTE_M    = 2.44
const LARGO_PIEZA_M           = 3.0
const DESPERDICIO_PLANCHAS    = 0.15
const TORNILLOS_FINOS_POR_M2  = 20
const METROS_CINTA_ROLLO      = 75
const M2_POR_BALDE_MASILLA    = 10
const ESPACIADO_ANCLAJE_M     = 0.60
const SEPARACION_OMEGA_M      = 1.2
const ANCHO_EFECT_CALAMINA    = 0.75    // 0.85 - 0.10 traslape lateral
const LARGO_EFECT_CALAMINA    = 3.40    // 3.60 - 0.20 traslape longitudinal
const TORNILLOS_POR_HOJA      = 8
const HOJAS_POR_TUBO_MASILLA  = 8
const METROS_POR_ROLLO_CINTA  = 15     // cinta aluminio 50mm x 25m

export type MedidaParante = '38mm' | '64mm' | '89mm'

/** Límite superior razonable para una sola dimensión (largo/alto/ancho) en metros.
 *  No es una limitación física real, es una red de seguridad contra errores de
 *  tecleo (ej. escribir "300" en vez de "3.00"), que de otro modo generarían una
 *  cotización con cientos de planchas sin que nadie lo note hasta después. */
export const MAX_DIMENSION_M = 50

const RIEL_COMPAT: Record<MedidaParante, string> = {
  '38mm': '39mm', '64mm': '65mm', '89mm': '90mm',
}

// ============================================================
// PARED DRYWALL
// ============================================================
export interface CalculoPared {
  area: number; placas: number; parantes: number; rieles: number
  esquineros: number; cinta: number; masilla: number
  tornillosPuntaFina: number   // millares
  tornillosPuntaBroca: number  // unidades
  anclajes: number             // fulminante+clavo riel a losa
  medida: MedidaParante; rielMedida: string
}

export const calcularPared = (
  largo: number, alto: number, caras: number,
  esquinerosExpuestos = 0, medida: MedidaParante = '64mm',
  desperdicio = DESPERDICIO_PLANCHAS,
): CalculoPared => {
  if (largo <= 0 || alto <= 0 || caras < 1)
    throw new Error('Dimensiones invalidas')
  if (largo > MAX_DIMENSION_M || alto > MAX_DIMENSION_M)
    throw new Error(`Dimension fuera de rango (maximo ${MAX_DIMENSION_M}m). Verifica que no sea un error de tecleo.`)

  const area          = largo * alto * caras
  const placas        = Math.ceil((area / PLANCHA_AREA_M2) * (1 + desperdicio))
  const posParantes   = Math.floor(largo / SEPARACION_PARANTE_M) + 1
  const parantes      = posParantes * (alto > ALTURA_MAX_PARANTE_M ? 2 : 1)
  const rieles        = Math.ceil((largo * 2) / LARGO_PIEZA_M)
  const esquineros    = Math.ceil(alto / ALTURA_MAX_PARANTE_M) * esquinerosExpuestos
  const cinta         = Math.max(1, Math.ceil(((posParantes - 1) * alto * caras * 1.1) / METROS_CINTA_ROLLO))
  const masilla       = Math.max(1, Math.ceil(area / M2_POR_BALDE_MASILLA))
  const tornillosPuntaFina   = Math.max(1, Math.ceil((area * TORNILLOS_FINOS_POR_M2) / 1000))
  const tornillosPuntaBroca  = posParantes * 4
  const anclajes      = Math.ceil((largo * 2) / ESPACIADO_ANCLAJE_M)

  return { area, placas, parantes, rieles, esquineros, cinta, masilla,
    tornillosPuntaFina, tornillosPuntaBroca, anclajes,
    medida, rielMedida: RIEL_COMPAT[medida] }
}

// ============================================================
// TECHO / COBERTURA
// ============================================================
export interface CalculoTecho {
  area: number; perfilesOmega: number; parantesT: number
  rielestTecho: number; calaminas: number; canaletas: number
  anclajesEstructura: number  // fulminante+clavo cada 60cm de riel perimetral
  tornillosAutoPerf: number   // tornillo 2" con arandela neoprene, hoja a omega
  tornillosHex: number        // tornillo hex 5/16", omega a estructura
  masillaSelladora: number    // tubo 300ml, crestas y bordes
  cintaAluminio: number       // rollo 50mm x 25m, perimetro y cumbrera
}

// _tipoCubierta recibido del formulario, no altera cantidades de estructura
export const calcularTecho = (
  ancho: number, largo: number, _tipoCubierta: string,
  caida = 15, canaletasMetros = 0,
): CalculoTecho => {
  if (ancho <= 0 || largo <= 0)
    throw new Error('Dimensiones invalidas')
  if (ancho > MAX_DIMENSION_M || largo > MAX_DIMENSION_M)
    throw new Error(`Dimension fuera de rango (maximo ${MAX_DIMENSION_M}m). Verifica que no sea un error de tecleo.`)

  const perimetro       = 2 * (ancho + largo)
  const area            = ancho * largo
  const filas           = Math.ceil(ancho / SEPARACION_OMEGA_M) + 1
  const perfilesOmega   = filas * Math.ceil(largo / LARGO_PIEZA_M)
  const parantesT       = Math.ceil(ancho / SEPARACION_OMEGA_M) * Math.ceil(largo / SEPARACION_OMEGA_M)
  const rielestTecho    = Math.ceil(perimetro / LARGO_PIEZA_M)
  const angRad          = Math.atan(caida / 100)
  const calaminas       = Math.ceil(ancho / ANCHO_EFECT_CALAMINA) *
                          Math.ceil((largo / Math.cos(angRad)) / LARGO_EFECT_CALAMINA)

  return {
    area, perfilesOmega, parantesT, rielestTecho, calaminas,
    canaletas: canaletasMetros,
    anclajesEstructura: Math.ceil(perimetro / ESPACIADO_ANCLAJE_M),
    tornillosAutoPerf:  calaminas * TORNILLOS_POR_HOJA,
    tornillosHex:       perfilesOmega * 2,
    masillaSelladora:   Math.max(1, Math.ceil(calaminas / HOJAS_POR_TUBO_MASILLA)),
    cintaAluminio:      Math.max(1, Math.ceil((perimetro + ancho) / METROS_POR_ROLLO_CINTA)),
  }
}

// ============================================================
// UTILIDADES
// ============================================================
export const generarCorrelativo = (): string => {
  const d = new Date()
  const yy   = d.getFullYear().toString().slice(-2)
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const dd   = String(d.getDate()).padStart(2, '0')
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  return `${yy}${mm}${dd}-${rand}`
}

/** Tope máximo razonable para un monto individual (alquiler, gasto, importe de movimiento).
 *  No es un límite legal ni de negocio real, es una red de seguridad contra errores de
 *  tecleo (ej. escribir "120000" en vez de "1200"), que de otro modo aparecerían
 *  directamente en un recibo o cotización sin que nadie los note a tiempo. */
export const MONTO_MAXIMO_RAZONABLE = 50000

export const validarDNI = (dni: string): string | null =>
  /^\d{8}$/.test(dni) ? null : 'El DNI debe tener exactamente 8 digitos numericos'

export const validarTelefono = (tel: string): string | null =>
  /^\d{9}$/.test(tel) ? null : 'El telefono debe tener exactamente 9 digitos numericos'

// ============================================================
// REGLAS DE NEGOCIO DE ALQUILERES — funciones puras (sin Supabase)
// Antes vivían embebidas dentro de las funciones async de
// lib/alquileres.ts, mezclando cálculo con I/O. Al separarlas,
// se pueden testear directamente sin mockear la base de datos.
// ============================================================

/** Fecha final de un contrato, dada la fecha de inicio y la duración en meses.
 *  Devuelve el string en formato YYYY-MM-DD (mismo formato que usa la BD). */
export const calcularFechaFinalContrato = (fechaInicio: string, mesesAlquiler: number): string => {
  const fecha = new Date(fechaInicio)
  fecha.setMonth(fecha.getMonth() + mesesAlquiler)
  return fecha.toISOString().split('T')[0]
}

/** Mes y año anteriores al dado, manejando el cruce de año (enero → diciembre del año previo) */
export const mesAnioAnterior = (mes: number, anio: number): { mes: number; anio: number } =>
  mes === 1 ? { mes: 12, anio: anio - 1 } : { mes: mes - 1, anio }

/** Consumo de un servicio medido (Luz/Agua), o null si falta alguna lectura */
export const calcularConsumo = (
  lecturaActual: number | null | undefined,
  lecturaAnterior: number | null | undefined,
): number | null =>
  (lecturaActual != null && lecturaAnterior != null) ? lecturaActual - lecturaAnterior : null

// ============================================================
// REGLAS DE NEGOCIO DE CONTROL VENTA DE CASA — funciones puras
// ============================================================

/** Tope máximo que puede recibir cada hermano en el control de venta de casa */
export const TOPE_VENTA_CASA = 6666.66
/** Monto mínimo permitido por cada pago registrado */
export const MONTO_MINIMO_VENTA_CASA = 200

export type ValidacionPago = { valido: true } | { valido: false; mensaje: string }

/**
 * Valida si un nuevo pago puede registrarse para un hermano, dado lo que
 * ya recibió antes. Devuelve el motivo exacto del rechazo si no es válido,
 * para mostrarlo tal cual al usuario.
 */
export const validarPagoVentaCasa = (
  montoNuevo: number,
  totalActualDelHermano: number,
  nombreHermano: string,
): ValidacionPago => {
  if (montoNuevo < MONTO_MINIMO_VENTA_CASA) {
    return { valido: false, mensaje: `El monto minimo es S/ ${MONTO_MINIMO_VENTA_CASA}` }
  }
  const nuevoTotal = totalActualDelHermano + montoNuevo
  if (nuevoTotal > TOPE_VENTA_CASA) {
    const disponible = (TOPE_VENTA_CASA - totalActualDelHermano).toFixed(2)
    return { valido: false, mensaje: `Tope excedido. Solo disponible S/ ${disponible} para ${nombreHermano}` }
  }
  return { valido: true }
}

// ============================================================
// INSUMOS POR SERVICIO — traduce un cálculo técnico (pared, techo,
// melamina) en la lista de materiales que debe llevar la cotización.
// Antes vivía embebido en CrearCotizacionTab.tsx, mezclado con estado
// de React; al ser lógica pura (sin hooks, sin DOM) se puede testear
// y reusar fuera de ese componente (por ejemplo en un reporte futuro).
// ============================================================

/** Forma mínima de un insumo, sin id ni linea_id (eso lo asigna quien lo use en UI) */
export interface InsumoCalculado {
  material_nombre: string
  cantidad: number
  unidad: string
  precio_unitario: number
  es_manual: false
}

// Precios referenciales de materiales (fuente única de verdad de precios sugeridos)
export const PRECIOS_REF: Record<string, number> = {
  'Plancha Drywall 1/2"':28.5, 'Parante 64mm (3m)':6, 'Riel 65mm (3m)':5.5,
  'Parante 38mm (3m)':5, 'Riel 39mm (3m)':4.5, 'Parante 89mm (3m)':8, 'Riel 90mm (3m)':7.5,
  'Esquinero Metalico 2.44m':3.5, 'Cinta de Papel 75m':8, 'Masilla Drywall 5kg':18,
  'Tornillos Punta Fina 1"':12, 'Tornillos Punta Broca 1/2"':0.05,
  'Anclajes (fulminante+clavo)':0.8,
  'Perfil Omega 3m':8.5, 'Parante/Colgante Techo':4, 'Riel Perimetral 3m':5,
  'Calamina 3.60m':20, 'Eternit 3.60m':48, 'Polipropileno 3.60m':55,
  'Tornillo Autoperforante 2"':0.25, 'Tornillo Hex 5/16"':0.30,
  'Masilla Selladora 300ml':12, 'Cinta Aluminio 50mmx25m':18,
  'Canaleta Metalica':12, 'Canto Delgado (ml)':3.5, 'Canto Grueso (ml)':5.5,
  'Corredera Aluminio':18, 'Bisagra 35mm':3, 'Jalador metalico':4,
}

export const precioRef = (nombre: string): number => PRECIOS_REF[nombre] ?? 10

/** Insumos para una pared de drywall, a partir del resultado de calcularPared() */
export const armarInsumosPared = (r: CalculoPared): InsumoCalculado[] => [
  { material_nombre:`Plancha Drywall 1/2"`, cantidad:r.placas, unidad:'Unid', precio_unitario:precioRef('Plancha Drywall 1/2"'), es_manual:false },
  { material_nombre:`Parante ${r.medida} (3m)`, cantidad:r.parantes, unidad:'Unid', precio_unitario:precioRef(`Parante ${r.medida} (3m)`), es_manual:false },
  { material_nombre:`Riel ${r.rielMedida} (3m)`, cantidad:r.rieles, unidad:'Unid', precio_unitario:precioRef(`Riel ${r.rielMedida} (3m)`), es_manual:false },
  ...(r.esquineros>0?[{ material_nombre:'Esquinero Metalico 2.44m', cantidad:r.esquineros, unidad:'Unid', precio_unitario:precioRef('Esquinero Metalico 2.44m'), es_manual:false as const }]:[]),
  { material_nombre:'Cinta de Papel 75m', cantidad:r.cinta, unidad:'Rollo', precio_unitario:precioRef('Cinta de Papel 75m'), es_manual:false },
  { material_nombre:'Masilla Drywall 5kg', cantidad:r.masilla, unidad:'Balde', precio_unitario:precioRef('Masilla Drywall 5kg'), es_manual:false },
  { material_nombre:'Tornillos Punta Fina 1"', cantidad:r.tornillosPuntaFina, unidad:'Millar', precio_unitario:precioRef('Tornillos Punta Fina 1"'), es_manual:false },
  { material_nombre:'Tornillos Punta Broca 1/2"', cantidad:r.tornillosPuntaBroca, unidad:'Unid', precio_unitario:precioRef('Tornillos Punta Broca 1/2"'), es_manual:false },
  { material_nombre:'Anclajes (fulminante+clavo)', cantidad:r.anclajes, unidad:'Unid', precio_unitario:precioRef('Anclajes (fulminante+clavo)'), es_manual:false },
]

/** Insumos para un techo/cobertura, a partir del resultado de calcularTecho() */
export const armarInsumosTecho = (r: CalculoTecho, cobertura: string, canaletasMetros: number): InsumoCalculado[] => [
  { material_nombre:'Perfil Omega 3m', cantidad:r.perfilesOmega, unidad:'Unid', precio_unitario:precioRef('Perfil Omega 3m'), es_manual:false },
  { material_nombre:'Parante/Colgante Techo', cantidad:r.parantesT, unidad:'Unid', precio_unitario:precioRef('Parante/Colgante Techo'), es_manual:false },
  { material_nombre:'Riel Perimetral 3m', cantidad:r.rielestTecho, unidad:'Unid', precio_unitario:precioRef('Riel Perimetral 3m'), es_manual:false },
  { material_nombre:`${cobertura} 3.60m`, cantidad:r.calaminas, unidad:'Unid', precio_unitario:precioRef(`${cobertura} 3.60m`), es_manual:false },
  { material_nombre:'Tornillo Autoperforante 2"', cantidad:r.tornillosAutoPerf, unidad:'Unid', precio_unitario:precioRef('Tornillo Autoperforante 2"'), es_manual:false },
  { material_nombre:'Tornillo Hex 5/16"', cantidad:r.tornillosHex, unidad:'Unid', precio_unitario:precioRef('Tornillo Hex 5/16"'), es_manual:false },
  { material_nombre:'Masilla Selladora 300ml', cantidad:r.masillaSelladora, unidad:'Tubo', precio_unitario:precioRef('Masilla Selladora 300ml'), es_manual:false },
  { material_nombre:'Cinta Aluminio 50mmx25m', cantidad:r.cintaAluminio, unidad:'Rollo', precio_unitario:precioRef('Cinta Aluminio 50mmx25m'), es_manual:false },
  { material_nombre:'Anclajes (fulminante+clavo)', cantidad:r.anclajesEstructura, unidad:'Unid', precio_unitario:precioRef('Anclajes (fulminante+clavo)'), es_manual:false },
  ...(canaletasMetros>0?[{ material_nombre:'Canaleta Metalica', cantidad:canaletasMetros, unidad:'ml', precio_unitario:precioRef('Canaleta Metalica'), es_manual:false as const }]:[]),
]

/** Datos del formulario de melamina necesarios para armar sus insumos */
export interface MelaminaForm {
  grosor: string
  acabado: string
  planchas: number
  precioPlancha: number
  cantosD: number
  cantosG: number
  correderas: number
  bisagras: number
  jaladores: number
}

/** Insumos para un mueble de melamina, a partir de los datos ya parseados del formulario */
export const armarInsumosMelamina = (f: MelaminaForm): InsumoCalculado[] => [
  { material_nombre:`Plancha Melamina ${f.grosor} ${f.acabado}`, cantidad:Math.ceil(f.planchas), unidad:'Unid', precio_unitario:f.precioPlancha, es_manual:false },
  ...(f.cantosD>0?[{ material_nombre:'Canto Delgado (ml)', cantidad:f.cantosD, unidad:'Metros', precio_unitario:precioRef('Canto Delgado (ml)'), es_manual:false as const }]:[]),
  ...(f.cantosG>0?[{ material_nombre:'Canto Grueso (ml)', cantidad:f.cantosG, unidad:'Metros', precio_unitario:precioRef('Canto Grueso (ml)'), es_manual:false as const }]:[]),
  ...(f.correderas>0?[{ material_nombre:'Corredera Aluminio', cantidad:f.correderas, unidad:'Unid', precio_unitario:precioRef('Corredera Aluminio'), es_manual:false as const }]:[]),
  ...(f.bisagras>0?[{ material_nombre:'Bisagra 35mm', cantidad:f.bisagras, unidad:'Unid', precio_unitario:precioRef('Bisagra 35mm'), es_manual:false as const }]:[]),
  ...(f.jaladores>0?[{ material_nombre:'Jalador metalico', cantidad:f.jaladores, unidad:'Unid', precio_unitario:precioRef('Jalador metalico'), es_manual:false as const }]:[]),
]
