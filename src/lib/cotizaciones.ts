import { supabase } from './supabase'
import { Cotizacion, CotizacionDetalle, CotizacionInsumo, CatalogoServicio } from '../types/index'

// CATÁLOGO
export const getCatalogo = async (): Promise<CatalogoServicio[]> => {
  const { data, error } = await supabase.from('catalogo_servicios').select('*')
  if (error) throw error
  return data || []
}

export const getCatalogoPorCategoria = async (categoria: string): Promise<CatalogoServicio[]> => {
  const { data, error } = await supabase.from('catalogo_servicios').select('*').eq('categoria', categoria)
  if (error) throw error
  return data || []
}

export const createServicio = async (servicio: Omit<CatalogoServicio, 'id'>): Promise<CatalogoServicio> => {
  const { data, error } = await supabase.from('catalogo_servicios').insert([servicio]).select().single()
  if (error) throw error
  return data
}

export const updateServicio = async (id: string, updates: Partial<CatalogoServicio>): Promise<CatalogoServicio> => {
  const { data, error } = await supabase.from('catalogo_servicios').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export const deleteServicio = async (id: string): Promise<void> => {
  const { error } = await supabase.from('catalogo_servicios').delete().eq('id', id)
  if (error) throw error
}

// COTIZACIONES
export const getCotizaciones = async (): Promise<Cotizacion[]> => {
  const { data, error } = await supabase.from('cotizaciones').select('*')
  if (error) throw error
  return data || []
}

export const getCotizacionPorId = async (id: string): Promise<Cotizacion | null> => {
  const { data, error } = await supabase.from('cotizaciones').select('*').eq('id', id).single()
  if (error) return null
  return data
}

export const createCotizacion = async (cotizacion: Omit<Cotizacion, 'id'>): Promise<Cotizacion> => {
  const { data, error } = await supabase.from('cotizaciones').insert([cotizacion]).select().single()
  if (error) throw error
  return data
}

export const updateCotizacion = async (id: string, updates: Partial<Cotizacion>): Promise<Cotizacion> => {
  const { data, error } = await supabase.from('cotizaciones').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export const deleteCotizacion = async (id: string): Promise<void> => {
  const { error } = await supabase.from('cotizaciones').delete().eq('id', id)
  if (error) throw error
}

// DETALLES DE COTIZACIÓN
export const getCotizacionDetalles = async (cotizacionId: string): Promise<CotizacionDetalle[]> => {
  const { data, error } = await supabase.from('cotizacion_detalles').select('*').eq('cotizacion_id', cotizacionId)
  if (error) throw error
  return data || []
}

export const createDetalle = async (detalle: Omit<CotizacionDetalle, 'id'>): Promise<CotizacionDetalle> => {
  const { data, error } = await supabase.from('cotizacion_detalles').insert([detalle]).select().single()
  if (error) throw error
  return data
}

export const createDetalles = async (detalles: Omit<CotizacionDetalle, 'id'>[]): Promise<CotizacionDetalle[]> => {
  const { data, error } = await supabase.from('cotizacion_detalles').insert(detalles).select()
  if (error) throw error
  return data || []
}

export const updateDetalle = async (id: string, updates: Partial<CotizacionDetalle>): Promise<CotizacionDetalle> => {
  const { data, error } = await supabase.from('cotizacion_detalles').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export const deleteDetalle = async (id: string): Promise<void> => {
  const { error } = await supabase.from('cotizacion_detalles').delete().eq('id', id)
  if (error) throw error
}

// INSUMOS INTERNOS
export const getCotizacionInsumos = async (cotizacionId: string): Promise<CotizacionInsumo[]> => {
  const { data, error } = await supabase.from('cotizacion_insumos_internos').select('*').eq('cotizacion_id', cotizacionId)
  if (error) throw error
  return data || []
}

export const createInsumo = async (insumo: Omit<CotizacionInsumo, 'id'>): Promise<CotizacionInsumo> => {
  const { data, error } = await supabase.from('cotizacion_insumos_internos').insert([insumo]).select().single()
  if (error) throw error
  return data
}

export const createInsumos = async (insumos: Omit<CotizacionInsumo, 'id'>[]): Promise<CotizacionInsumo[]> => {
  const { data, error } = await supabase.from('cotizacion_insumos_internos').insert(insumos).select()
  if (error) throw error
  return data || []
}

export const updateInsumo = async (id: string, updates: Partial<CotizacionInsumo>): Promise<CotizacionInsumo> => {
  const { data, error } = await supabase.from('cotizacion_insumos_internos').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export const deleteInsumo = async (id: string): Promise<void> => {
  const { error } = await supabase.from('cotizacion_insumos_internos').delete().eq('id', id)
  if (error) throw error
}

// ACTUALIZAR ESTADO COTIZACIÓN
export const updateCotizacionEstado = async (id: string, estado: 'Activa' | 'Completada' | 'Cancelada'): Promise<void> => {
  const { error } = await supabase.from('cotizaciones').update({ estado }).eq('id', id)
  if (error) throw new Error(error.message)
}
