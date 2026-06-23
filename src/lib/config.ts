// ============================================================
// lib/config.ts — configuracion de la app
// Extraido de pages/Configuracion.tsx para que pdf.ts
// pueda importarlo sin crear dependencia lib → page
// ============================================================

// ============================================================
// lib/config.ts — configuracion de la app
// Extraido de pages/Configuracion.tsx para que pdf.ts
// pueda importarlo sin crear dependencia lib → page
//
// Antes vivía en localStorage (por eso no sincronizaba entre
// dispositivos: cada navegador tiene su propio localStorage).
// Ahora vive en Supabase, en una tabla de una sola fila (singleton),
// igual que el resto de módulos — así PC y móvil ven lo mismo.
// ============================================================
import { supabase } from './supabase'

export interface ConfigApp {
  id?: string
  empresa_nombre:   string
  empresa_ruc:      string
  empresa_direccion:string
  empresa_telefono: string
  empresa_email:    string
  banco1_nombre:    string
  banco1_numero:    string
  banco2_nombre:    string
  banco2_numero:    string
  yape_numero:      string
}

/** Id fijo de la única fila de configuración (singleton) */
const CONFIG_ROW_ID = '00000000-0000-0000-0000-000000000001'

const DEFAULT_CONFIG: ConfigApp = {
  empresa_nombre: '', empresa_ruc: '', empresa_direccion: '',
  empresa_telefono: '', empresa_email: '',
  banco1_nombre: 'BCP',      banco1_numero: '',
  banco2_nombre: 'Interbank', banco2_numero: '',
  yape_numero: '',
}

/** Cache en memoria para que pdf.ts pueda seguir leyendo de forma sincrónica
 *  dentro de una misma sesión, una vez que la config ya se cargó al menos una vez. */
let cache: ConfigApp = DEFAULT_CONFIG

export const getConfig = async (): Promise<ConfigApp> => {
  const { data, error } = await supabase
    .from('configuracion_app')
    .select('*')
    .eq('id', CONFIG_ROW_ID)
    .maybeSingle()
  if (error) throw new Error(error.message)
  cache = data ? { ...DEFAULT_CONFIG, ...data } : DEFAULT_CONFIG
  return cache
}

/** Lectura sincrónica desde cache (último valor cargado con getConfig()).
 *  Usar solo donde no se puede await (p.ej. construcción de un PDF ya iniciado). */
export const getConfigCached = (): ConfigApp => cache

export const saveConfig = async (config: ConfigApp): Promise<ConfigApp> => {
  const { data, error } = await supabase
    .from('configuracion_app')
    .upsert([{ ...config, id: CONFIG_ROW_ID }])
    .select()
    .single()
  if (error) throw new Error(error.message)
  cache = data
  return data
}
