import { supabase } from './supabase'
import { GastoPersonal, ControlVentaCasa } from '../types/index'

// GASTOS PERSONALES
export const getGastos = async (): Promise<GastoPersonal[]> => {
  const { data, error } = await supabase
    .from('gastos_personales')
    .select('*')
    .order('fecha_vencimiento', { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}

export const createGasto = async (gasto: Omit<GastoPersonal, 'id'>): Promise<GastoPersonal> => {
  const { data, error } = await supabase.from('gastos_personales').insert([gasto]).select().single()
  if (error) throw new Error(error.message)
  return data
}

export const updateGasto = async (id: string, updates: Partial<GastoPersonal>): Promise<GastoPersonal> => {
  const { data, error } = await supabase.from('gastos_personales').update(updates).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data
}

export const deleteGasto = async (id: string): Promise<void> => {
  const { error } = await supabase.from('gastos_personales').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// CONTROL VENTA DE CASA
export const getControlVenta = async (): Promise<ControlVentaCasa[]> => {
  const { data, error } = await supabase
    .from('control_venta_casa')
    .select('id, fecha_pago, mes, anio, monto_pagado, entregado_a')
    .order('fecha_pago', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export const createControlVenta = async (
  control: Omit<ControlVentaCasa, 'id' | 'mes' | 'anio'>
): Promise<ControlVentaCasa> => {
  if (control.monto_pagado < 200) throw new Error('El monto minimo es $ 200')

  const { data: pagosExistentes, error: errPagos } = await supabase
    .from('control_venta_casa')
    .select('monto_pagado')
    .eq('entregado_a', control.entregado_a)

  if (errPagos) throw new Error(errPagos.message)

  const totalActual = (pagosExistentes || []).reduce((s, p) => s + Number(p.monto_pagado), 0)
  const nuevoTotal = totalActual + control.monto_pagado

  if (nuevoTotal > 6660) {
    const disponible = (6660 - totalActual).toFixed(2)
    throw new Error(`Tope excedido. Solo disponible $ ${disponible} para ${control.entregado_a}`)
  }

  const fecha = new Date(control.fecha_pago)
  const mes = fecha.getMonth() + 1
  const anio = fecha.getFullYear()

  const { data, error } = await supabase
    .from('control_venta_casa')
    .insert([{ ...control, mes, anio }])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const deleteControlVenta = async (id: string): Promise<void> => {
  const { error } = await supabase.from('control_venta_casa').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export const getTotalPorHermano = async (): Promise<{ [key: string]: number }> => {
  const { data, error } = await supabase
    .from('control_venta_casa')
    .select('entregado_a, monto_pagado')

  if (error) throw new Error(error.message)

  const totales: { [key: string]: number } = { Gabriel: 0, Fernando: 0, 'Tu': 0 }

  ;(data || []).forEach((item) => {
    const key = item.entregado_a === 'Tú' ? 'Tu' : item.entregado_a
    if (totales[key] !== undefined) {
      totales[key] += Number(item.monto_pagado)
    } else {
      totales[item.entregado_a] = Number(item.monto_pagado)
    }
  })

  return totales
}
