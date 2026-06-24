import { describe, it, expect } from 'vitest'
import {
  calcularFechaFinalContrato, mesAnioAnterior, calcularConsumo,
  validarPagoVentaCasa, TOPE_VENTA_CASA, MONTO_MINIMO_VENTA_CASA,
} from '../calculations'

// ============================================================
// calcularFechaFinalContrato
// ============================================================
describe('calcularFechaFinalContrato', () => {
  it('suma los meses correctamente cruzando de año', () => {
    expect(calcularFechaFinalContrato('2026-01-01', 12)).toBe('2027-01-01')
  })
  it('suma meses dentro del mismo año', () => {
    expect(calcularFechaFinalContrato('2026-06-15', 6)).toBe('2026-12-15')
  })
  it('un contrato de 1 mes que empieza en diciembre termina en enero del año siguiente', () => {
    expect(calcularFechaFinalContrato('2025-12-01', 1)).toBe('2026-01-01')
  })
})

// ============================================================
// mesAnioAnterior — para buscar la lectura del medidor del mes pasado
// ============================================================
describe('mesAnioAnterior', () => {
  it('retrocede un mes dentro del mismo año', () => {
    expect(mesAnioAnterior(6, 2026)).toEqual({ mes: 5, anio: 2026 })
  })
  it('cruza de enero a diciembre del año anterior', () => {
    expect(mesAnioAnterior(1, 2026)).toEqual({ mes: 12, anio: 2025 })
  })
})

// ============================================================
// calcularConsumo — diferencia de lecturas de Luz/Agua
// ============================================================
describe('calcularConsumo', () => {
  it('calcula la diferencia cuando ambas lecturas existen', () => {
    expect(calcularConsumo(120.5, 95.7)).toBeCloseTo(24.8)
  })
  it('devuelve null si falta la lectura actual', () => {
    expect(calcularConsumo(null, 95.7)).toBeNull()
    expect(calcularConsumo(undefined, 95.7)).toBeNull()
  })
  it('devuelve null si falta la lectura anterior (primer mes del medidor, sin historial)', () => {
    expect(calcularConsumo(120.5, null)).toBeNull()
    expect(calcularConsumo(120.5, undefined)).toBeNull()
  })
})

// ============================================================
// validarPagoVentaCasa — tope de S/6666.66 por hermano
// ============================================================
describe('validarPagoVentaCasa', () => {
  it('rechaza un monto menor al mínimo permitido', () => {
    const r = validarPagoVentaCasa(MONTO_MINIMO_VENTA_CASA - 1, 0, 'Gabriel')
    expect(r.valido).toBe(false)
    if (!r.valido) expect(r.mensaje).toContain('monto minimo')
  })

  it('acepta exactamente el monto mínimo', () => {
    const r = validarPagoVentaCasa(MONTO_MINIMO_VENTA_CASA, 0, 'Gabriel')
    expect(r.valido).toBe(true)
  })

  it('rechaza cuando el nuevo total supera el tope, indicando cuánto queda disponible', () => {
    const r = validarPagoVentaCasa(6500, 200, 'Gabriel')
    expect(r.valido).toBe(false)
    if (!r.valido) expect(r.mensaje).toBe('Tope excedido. Solo disponible S/ 6466.66 para Gabriel')
  })

  it('acepta exactamente hasta llegar al tope (sin pasarlo)', () => {
    const disponible = TOPE_VENTA_CASA - 200
    const r = validarPagoVentaCasa(disponible, 200, 'Gabriel')
    expect(r.valido).toBe(true)
  })

  it('rechaza un centavo más allá del tope', () => {
    const disponible = TOPE_VENTA_CASA - 200
    const r = validarPagoVentaCasa(disponible + 0.01, 200, 'Gabriel')
    expect(r.valido).toBe(false)
  })

  it('el tope se evalúa por hermano de forma independiente (mismo monto, distinto acumulado)', () => {
    const gabrielLleno   = validarPagoVentaCasa(500, TOPE_VENTA_CASA - 100, 'Gabriel')
    const fernandoVacio  = validarPagoVentaCasa(500, 0, 'Fernando')
    expect(gabrielLleno.valido).toBe(false)
    expect(fernandoVacio.valido).toBe(true)
  })
})
