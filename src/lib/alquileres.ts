import { supabase } from './supabase'
import { Inquilino, Contrato, MovimientoDepa } from '../types/index'

// INQUILINOS
export const getInquilinos = async (): Promise<Inquilino[]> => {
  const { data, error } = await supabase.from('inquilinos').select('*')
  if (error) throw error
  return data || []
}

export const createInquilino = async (inquilino: Omit<Inquilino, 'id' | 'created_at'>): Promise<Inquilino> => {
  const { data, error } = await supabase.from('inquilinos').insert([inquilino]).select().single()
  if (error) throw error
  return data
}

export const updateInquilino = async (id: string, updates: Partial<Inquilino>): Promise<Inquilino> => {
  const { data, error } = await supabase.from('inquilinos').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export const deleteInquilino = async (id: string): Promise<void> => {
  const { error } = await supabase.from('inquilinos').delete().eq('id', id)
  if (error) throw error
}

// CONTRATOS
export const getContratos = async (): Promise<Contrato[]> => {
  const { data, error } = await supabase.from('contratos').select('*')
  if (error) throw error
  return data || []
}

export const getContratosPorInquilino = async (inquilinoId: string): Promise<Contrato[]> => {
  const { data, error } = await supabase.from('contratos').select('*').eq('inquilino_id', inquilinoId)
  if (error) throw error
  return data || []
}

export const createContrato = async (contrato: Omit<Contrato, 'id' | 'fecha_final'>): Promise<Contrato> => {
  // Calcular fecha final
  const fechaInicio = new Date(contrato.fecha_inicio)
  fechaInicio.setMonth(fechaInicio.getMonth() + contrato.meses_alquiler)
  const fechaFinal = fechaInicio.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('contratos')
    .insert([{ ...contrato, fecha_final: fechaFinal }])
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateContrato = async (id: string, updates: Partial<Contrato>): Promise<Contrato> => {
  const { data, error } = await supabase.from('contratos').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

// MOVIMIENTOS
export const getMovimientos = async (mes?: number, anio?: number): Promise<MovimientoDepa[]> => {
  let query = supabase.from('movimientos_depa').select('*')
  
  if (mes) query = query.eq('mes', mes)
  if (anio) query = query.eq('anio', anio)
  
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export const getMovimientosDepa = async (numDepa: number, mes?: number, anio?: number): Promise<MovimientoDepa[]> => {
  let query = supabase.from('movimientos_depa').select('*').eq('num_depa', numDepa)
  
  if (mes) query = query.eq('mes', mes)
  if (anio) query = query.eq('anio', anio)
  
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export const getLecturaAnterior = async (numDepa: number, tipo: string, mes: number, anio: number): Promise<number | null> => {
  // Obtener del mes anterior
  let mesAnterior = mes - 1
  let anioAnterior = anio
  if (mesAnterior === 0) {
    mesAnterior = 12
    anioAnterior -= 1
  }

  const { data, error } = await supabase
    .from('movimientos_depa')
    .select('lectura_actual')
    .eq('num_depa', numDepa)
    .eq('tipo_servicio', tipo)
    .eq('mes', mesAnterior)
    .eq('anio', anioAnterior)
    .single()

  if (error) return null
  return data?.lectura_actual || null
}

export const createMovimiento = async (
  movimiento: Omit<MovimientoDepa, 'id' | 'mes' | 'anio' | 'consumo'> & { importe_pagar: number }
): Promise<MovimientoDepa> => {
  const fecha = new Date(movimiento.fecha_vencimiento)
  const mes = fecha.getMonth() + 1
  const anio = fecha.getFullYear()

  // Calcular consumo para Luz/Agua/Gas si tienen lecturas
  let consumo: number | null = null
  if (
    movimiento.lectura_actual !== null && movimiento.lectura_actual !== undefined &&
    movimiento.lectura_anterior !== null && movimiento.lectura_anterior !== undefined
  ) {
    consumo = movimiento.lectura_actual - movimiento.lectura_anterior
  }

  // El importe SIEMPRE viene del formulario (ya calculado correctamente):
  // - Alquiler: jalado del contrato en el componente
  // - Luz/Agua: consumo × tarifa calculado en el componente
  // - Gas/Internet/Otro: ingresado manualmente por el usuario
  const importePagar = movimiento.importe_pagar

  const { data, error } = await supabase
    .from('movimientos_depa')
    .insert([{ ...movimiento, mes, anio, consumo, importe_pagar: importePagar }])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const updateMovimiento = async (id: string, updates: Partial<MovimientoDepa>): Promise<MovimientoDepa> => {
  const { data, error } = await supabase.from('movimientos_depa').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export const deleteMovimiento = async (id: string): Promise<void> => {
  const { error } = await supabase.from('movimientos_depa').delete().eq('id', id)
  if (error) throw error
}

// HISTORIAL DE CONSUMO PARA GRÁFICA
export const getHistorialConsumo = async (numDepa: number): Promise<{ mes: number; anio: number; tipo_servicio: string; consumo: number | null; importe_pagar: number }[]> => {
  const { data, error } = await supabase
    .from('movimientos_depa')
    .select('mes, anio, tipo_servicio, consumo, importe_pagar')
    .eq('num_depa', numDepa)
    .in('tipo_servicio', ['Luz', 'Agua', 'Gas'])
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })
    .limit(36)
  if (error) throw new Error(error.message)
  return data || []
}
