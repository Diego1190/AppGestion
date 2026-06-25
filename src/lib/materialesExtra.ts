import { supabase } from './supabase'
import { MaterialExtraServicio } from '../types/index'

/** Trae los materiales extra guardados para un tipo de servicio específico,
 *  o todos si no se especifica tipo (útil para el panel de gestión). */
export const getMaterialesExtra = async (tipoServicio?: string): Promise<MaterialExtraServicio[]> => {
  let query = supabase.from('materiales_extra_servicio').select('*').order('material_nombre', { ascending: true })
  if (tipoServicio) query = query.eq('tipo_servicio', tipoServicio)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data || []
}

export const createMaterialExtra = async (
  material: Omit<MaterialExtraServicio, 'id'>
): Promise<MaterialExtraServicio> => {
  const { data, error } = await supabase
    .from('materiales_extra_servicio')
    .insert([material])
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export const deleteMaterialExtra = async (id: string): Promise<void> => {
  const { error } = await supabase.from('materiales_extra_servicio').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
