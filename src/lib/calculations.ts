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

export const validarDNI = (dni: string): string | null =>
  /^\d{8}$/.test(dni) ? null : 'El DNI debe tener exactamente 8 digitos numericos'

export const validarTelefono = (tel: string): string | null =>
  /^\d{9}$/.test(tel) ? null : 'El telefono debe tener exactamente 9 digitos numericos'
