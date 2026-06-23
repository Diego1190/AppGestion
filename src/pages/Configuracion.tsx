import Layout from '@/components/Layout'
import React, { useState, useEffect, useCallback } from 'react'
import { Save, Building2, CreditCard, CheckCircle } from 'lucide-react'
import { getConfig, saveConfig, ConfigApp } from '@/lib/config'
import { inputClass } from '@/components/ui/inputStyles'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import { useToast, ToastContainer } from '@/components/Toast'

interface Props { onMenuOpen: () => void }

const DEFAULT_CONFIG: ConfigApp = {
  empresa_nombre: '', empresa_ruc: '', empresa_direccion: '',
  empresa_telefono: '', empresa_email: '',
  banco1_nombre: 'BCP', banco1_numero: '',
  banco2_nombre: 'Interbank', banco2_numero: '',
  yape_numero: '',
}

const Configuracion: React.FC<Props> = ({ onMenuOpen }) => {
  const [config, setConfig] = useState<ConfigApp>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { toasts, addToast, removeToast } = useToast()

  const loadConfig = useCallback(async () => {
    try { setConfig(await getConfig()) }
    catch { addToast('Error cargando configuración', 'error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])
  // Si se guarda desde otro dispositivo (PC/móvil), esta pantalla se actualiza sola
  useRealtimeSync('configuracion_app', loadConfig)

  const handleSave = async () => {
    setSaving(true)
    try {
      const guardada = await saveConfig(config)
      setConfig(guardada)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      addToast('Error guardando configuración', 'error')
    } finally {
      setSaving(false)
    }
  }

  const inp = inputClass

  const field = (label: string, key: keyof ConfigApp, placeholder = '') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        className={inp}
        placeholder={placeholder}
        value={config[key] as string}
        onChange={e => setConfig({ ...config, [key]: e.target.value })}
      />
    </div>
  )

  if (loading) return <Layout onMenuOpen={onMenuOpen}><div className="text-center py-12 text-gray-500">Cargando...</div></Layout>

  return (
    <Layout onMenuOpen={onMenuOpen}>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Configuración</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Datos de tu empresa y cuentas bancarias para recibos y cotizaciones</p>
        </div>

        {saved && (
          <div className="mb-4 p-3 bg-green-50 border border-green-300 rounded-lg flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">Configuración guardada correctamente</span>
          </div>
        )}

        {/* Datos de Empresa */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <h2 className="font-semibold text-gray-900">Datos de la Empresa</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">Aparecen en el encabezado de tus cotizaciones y recibos</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Nombre / Razón Social', 'empresa_nombre', 'Ej: Servicios Globales SAC')}
            {field('RUC', 'empresa_ruc', 'Ej: 20123456789')}
            {field('Dirección', 'empresa_direccion', 'Av. Principal 123, Lima')}
            {field('Teléfono', 'empresa_telefono', '987654321')}
            {field('Email', 'empresa_email', 'contacto@empresa.com')}
          </div>
        </div>

        {/* Cuentas Bancarias */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-green-600 flex-shrink-0" />
            <h2 className="font-semibold text-gray-900">Cuentas para Cobro</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">Aparecen al pie de los recibos de alquiler</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banco 1</label>
              <select
                className={`${inp} mb-2`}
                value={config.banco1_nombre}
                onChange={e => setConfig({ ...config, banco1_nombre: e.target.value })}>
                <option>BCP</option><option>Interbank</option><option>BBVA</option>
                <option>Scotiabank</option><option>Banbif</option><option>Otro</option>
              </select>
              <input type="text" className={inp}
                placeholder="Número de cuenta" value={config.banco1_numero}
                onChange={e => setConfig({ ...config, banco1_numero: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banco 2</label>
              <select className={`${inp} mb-2`}
                value={config.banco2_nombre}
                onChange={e => setConfig({ ...config, banco2_nombre: e.target.value })}>
                <option>BCP</option><option>Interbank</option><option>BBVA</option>
                <option>Scotiabank</option><option>Banbif</option><option>Otro</option>
              </select>
              <input type="text" className={inp}
                placeholder="Número de cuenta" value={config.banco2_numero}
                onChange={e => setConfig({ ...config, banco2_numero: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yape / Plin</label>
              <input type="text" className={inp}
                placeholder="Número de celular" value={config.yape_numero}
                onChange={e => setConfig({ ...config, yape_numero: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="flex justify-end pb-4">
          <button onClick={handleSave} disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
            <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </div>
    </Layout>
  )
}

export default Configuracion
