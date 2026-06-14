// ============================================================
// lib/config.ts — configuracion de la app
// Extraido de pages/Configuracion.tsx para que pdf.ts
// pueda importarlo sin crear dependencia lib → page
// ============================================================

export interface ConfigApp {
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

const CONFIG_KEY = 'webapp_config'

const DEFAULT_CONFIG: ConfigApp = {
  empresa_nombre: '', empresa_ruc: '', empresa_direccion: '',
  empresa_telefono: '', empresa_email: '',
  banco1_nombre: 'BCP',      banco1_numero: '',
  banco2_nombre: 'Interbank', banco2_numero: '',
  yape_numero: '',
}

export const getConfig = (): ConfigApp => {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG
  } catch {
    return DEFAULT_CONFIG
  }
}

export const saveConfig = (config: ConfigApp): void => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}
