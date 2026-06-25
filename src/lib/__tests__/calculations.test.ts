import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  calcularPared, calcularTecho, validarDNI, validarTelefono,
  precioRef, armarInsumosPared, armarInsumosTecho, armarInsumosMelamina,
  generarCorrelativo, MAX_DIMENSION_M,
} from '../calculations'

// ============================================================
// calcularPared — fórmulas de drywall
//
// Los valores esperados se obtuvieron ejecutando la función real
// con estos mismos parámetros (no calculados a mano), por eso son
// "snapshots" de comportamiento conocido: si una refactorización futura
// cambia el resultado sin querer, este test debe fallar.
// ============================================================
describe('calcularPared', () => {
  it('pared simple 3m x 2.5m, 1 cara, 64mm, sin esquineros', () => {
    const r = calcularPared(3, 2.5, 1, 0, '64mm')
    expect(r.area).toBe(7.5)
    expect(r.placas).toBe(3)
    expect(r.parantes).toBe(16)
    expect(r.rieles).toBe(2)
    expect(r.esquineros).toBe(0)
    expect(r.cinta).toBe(1)
    expect(r.masilla).toBe(1)
    expect(r.tornillosPuntaFina).toBe(1)
    expect(r.tornillosPuntaBroca).toBe(32)
    expect(r.anclajes).toBe(10)
    expect(r.rielMedida).toBe('65mm')
  })

  it('pared grande 5m x 3m, 2 caras, 38mm, con 2 esquineros', () => {
    const r = calcularPared(5, 3, 2, 2, '38mm')
    expect(r.area).toBe(30)
    expect(r.placas).toBe(12)
    expect(r.parantes).toBe(26)
    expect(r.rieles).toBe(4)
    expect(r.esquineros).toBe(4)
    expect(r.cinta).toBe(2)
    expect(r.masilla).toBe(3)
    expect(r.tornillosPuntaBroca).toBe(52)
    expect(r.anclajes).toBe(17)
    expect(r.rielMedida).toBe('39mm')
  })

  it('usa el doble de parantes cuando el alto supera 2.44m (altura máxima de una sola placa)', () => {
    const bajo = calcularPared(3, 2.4, 1)   // ≤ 2.44m → 1x parantes
    const alto = calcularPared(3, 2.5, 1)   // > 2.44m → 2x parantes
    expect(alto.parantes).toBe(bajo.parantes * 2)
  })

  it.each([
    [0, 2.5, 1],   // largo inválido
    [3, 0, 1],     // alto inválido
    [3, 2.5, 0],   // caras inválidas
    [-1, 2.5, 1],  // largo negativo
  ])('rechaza dimensiones inválidas (largo=%s, alto=%s, caras=%s)', (largo, alto, caras) => {
    expect(() => calcularPared(largo, alto, caras)).toThrow('Dimensiones invalidas')
  })

  it('nunca redondea hacia abajo (siempre Math.ceil) para no faltar material en obra', () => {
    // area pequeña: debe seguir pidiendo al menos 1 plancha, no 0
    const r = calcularPared(0.5, 0.5, 1)
    expect(r.placas).toBeGreaterThanOrEqual(1)
    expect(r.masilla).toBeGreaterThanOrEqual(1)
    expect(r.tornillosPuntaFina).toBeGreaterThanOrEqual(1)
  })

  it('rechaza dimensiones que exceden el límite razonable (probable error de tecleo)', () => {
    expect(() => calcularPared(MAX_DIMENSION_M + 1, 2.5, 1)).toThrow('fuera de rango')
    expect(() => calcularPared(3, MAX_DIMENSION_M + 1, 1)).toThrow('fuera de rango')
  })

  it('acepta exactamente el límite máximo de dimensión', () => {
    expect(() => calcularPared(MAX_DIMENSION_M, 2.5, 1)).not.toThrow()
  })
})

// ============================================================
// calcularTecho — fórmulas de techo/cobertura
// ============================================================
describe('calcularTecho', () => {
  it('techo 4m x 6m, 15% de caída, sin canaletas', () => {
    const r = calcularTecho(4, 6, 'Calamina', 15, 0)
    expect(r.area).toBe(24)
    expect(r.perfilesOmega).toBe(10)
    expect(r.parantesT).toBe(20)
    expect(r.rielestTecho).toBe(7)
    expect(r.calaminas).toBe(12)
    expect(r.anclajesEstructura).toBe(34)
    expect(r.tornillosAutoPerf).toBe(96)
    expect(r.tornillosHex).toBe(20)
    expect(r.masillaSelladora).toBe(2)
    expect(r.cintaAluminio).toBe(2)
    expect(r.canaletas).toBe(0)
  })

  it('techo 5m x 8m, 10% de caída, con 12m de canaletas', () => {
    const r = calcularTecho(5, 8, 'Eternit', 10, 12)
    expect(r.area).toBe(40)
    expect(r.perfilesOmega).toBe(18)
    expect(r.parantesT).toBe(35)
    expect(r.calaminas).toBe(21)
    expect(r.canaletas).toBe(12)
  })

  it('a mayor caída (más pendiente), pide más calaminas para el mismo ancho/largo', () => {
    const pocaCaida = calcularTecho(5, 8, 'Calamina', 5)
    const muchaCaida = calcularTecho(5, 8, 'Calamina', 40)
    expect(muchaCaida.calaminas).toBeGreaterThanOrEqual(pocaCaida.calaminas)
  })

  it.each([
    [0, 6],
    [4, 0],
    [-1, 6],
  ])('rechaza dimensiones inválidas (ancho=%s, largo=%s)', (ancho, largo) => {
    expect(() => calcularTecho(ancho, largo, 'Calamina')).toThrow('Dimensiones invalidas')
  })

  it('rechaza dimensiones que exceden el límite razonable (probable error de tecleo)', () => {
    expect(() => calcularTecho(MAX_DIMENSION_M + 1, 6, 'Calamina')).toThrow('fuera de rango')
    expect(() => calcularTecho(4, MAX_DIMENSION_M + 1, 'Calamina')).toThrow('fuera de rango')
  })
})

// ============================================================
// Validaciones de formato — DNI y teléfono peruanos
// ============================================================
describe('validarDNI', () => {
  it('acepta exactamente 8 dígitos', () => {
    expect(validarDNI('41200966')).toBeNull()
  })
  it.each(['4120096', '412009661', 'abcd1234', '4120096a', ''])(
    'rechaza %s (no son 8 dígitos numéricos)', (dni) => {
      expect(validarDNI(dni)).not.toBeNull()
    }
  )
})

describe('validarTelefono', () => {
  it('acepta exactamente 9 dígitos', () => {
    expect(validarTelefono('992308983')).toBeNull()
  })
  it.each(['99230898', '9923089831', 'abcdefghi', ''])(
    'rechaza %s (no son 9 dígitos numéricos)', (tel) => {
      expect(validarTelefono(tel)).not.toBeNull()
    }
  )
})

// ============================================================
// precioRef — catálogo de precios de referencia
// ============================================================
describe('precioRef', () => {
  it('devuelve el precio conocido de un material del catálogo', () => {
    expect(precioRef('Plancha Drywall 1/2"')).toBe(28.5)
  })
  it('devuelve 10 (precio por defecto) para un material que no está en el catálogo', () => {
    expect(precioRef('Material que no existe')).toBe(10)
  })
})

// ============================================================
// armarInsumos* — traducción de un cálculo técnico a lista de materiales
// ============================================================
describe('armarInsumosPared', () => {
  it('incluye los materiales base sin esquineros cuando esquineros=0', () => {
    const r = calcularPared(3, 2.5, 1, 0, '64mm')
    const insumos = armarInsumosPared(r)
    const nombres = insumos.map(i => i.material_nombre)
    expect(nombres).not.toContain('Esquinero Metalico 2.44m')
    expect(nombres).toContain('Parante 64mm (3m)')
    expect(nombres).toContain('Riel 65mm (3m)')
  })

  it('incluye esquineros solo cuando esquinerosExpuestos > 0', () => {
    const r = calcularPared(5, 3, 2, 2, '38mm')
    const insumos = armarInsumosPared(r)
    const esquinero = insumos.find(i => i.material_nombre === 'Esquinero Metalico 2.44m')
    expect(esquinero).toBeDefined()
    expect(esquinero?.cantidad).toBe(r.esquineros)
  })

  it('cada insumo generado trae es_manual=false (son automáticos, no editados a mano)', () => {
    const r = calcularPared(3, 2.5, 1)
    const insumos = armarInsumosPared(r)
    expect(insumos.every(i => i.es_manual === false)).toBe(true)
  })
})

describe('armarInsumosTecho', () => {
  it('usa el nombre de cobertura elegido para el material principal', () => {
    const r = calcularTecho(4, 6, 'Eternit', 15, 0)
    const insumos = armarInsumosTecho(r, 'Eternit', 0)
    expect(insumos.some(i => i.material_nombre === 'Eternit 3.60m')).toBe(true)
  })

  it('incluye canaletas solo cuando canaletasMetros > 0', () => {
    const r = calcularTecho(4, 6, 'Calamina', 15, 0)
    const sinCanaletas = armarInsumosTecho(r, 'Calamina', 0)
    const conCanaletas = armarInsumosTecho(r, 'Calamina', 12)
    expect(sinCanaletas.some(i => i.material_nombre === 'Canaleta Metalica')).toBe(false)
    expect(conCanaletas.some(i => i.material_nombre === 'Canaleta Metalica')).toBe(true)
  })
})

describe('armarInsumosMelamina', () => {
  const base = {
    grosor: '18mm', acabado: 'Blanco', planchas: 2.5, precioPlancha: 120,
    cantosD: 0, cantosG: 0, correderas: 0, bisagras: 0, jaladores: 0,
  }

  it('redondea hacia arriba la cantidad de planchas (no se compran planchas fraccionadas)', () => {
    const insumos = armarInsumosMelamina(base)
    const plancha = insumos.find(i => i.material_nombre.startsWith('Plancha Melamina'))
    expect(plancha?.cantidad).toBe(3) // ceil(2.5) = 3
  })

  it('solo incluye accesorios opcionales cuando su cantidad es mayor a 0', () => {
    const sinAccesorios = armarInsumosMelamina(base)
    expect(sinAccesorios).toHaveLength(1) // solo la plancha

    const conAccesorios = armarInsumosMelamina({
      ...base, cantosD: 5, correderas: 2, bisagras: 4, jaladores: 2,
    })
    const nombres = conAccesorios.map(i => i.material_nombre)
    expect(nombres).toContain('Canto Delgado (ml)')
    expect(nombres).toContain('Corredera Aluminio')
    expect(nombres).toContain('Bisagra 35mm')
    expect(nombres).toContain('Jalador metalico')
    expect(nombres).not.toContain('Canto Grueso (ml)') // este sigue en 0
  })
})

// ============================================================
// generarCorrelativo — código único de cotización (YYMMDD-NNN)
// Depende de Date y Math.random, por eso se mockean ambos para
// poder afirmar el formato exacto de salida de forma determinística.
// ============================================================
describe('generarCorrelativo', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('genera el formato YYMMDD-NNN con la fecha actual', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-24T10:00:00'))
    vi.spyOn(Math, 'random').mockReturnValue(0.226) // → 226

    expect(generarCorrelativo()).toBe('260624-226')
  })

  it('rellena con ceros mes, día y la parte aleatoria cuando son de un solo dígito', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-05T10:00:00'))
    vi.spyOn(Math, 'random').mockReturnValue(0.002) // → 002

    expect(generarCorrelativo()).toBe('260105-002')
  })

  it('siempre devuelve un string que respeta el patrón YYMMDD-NNN', () => {
    const correlativo = generarCorrelativo()
    expect(correlativo).toMatch(/^\d{6}-\d{3}$/)
  })
})
