import Layout from '@/components/Layout'
import React, { useState, useEffect } from 'react'
import { Save, Building2, CreditCard, CheckCircle } from 'lucide-react'

export interface ConfigApp {
  empresa_nombre: string
  empresa_ruc: string
  empresa_direccion: string
  empresa_telefono: string
  empresa_email: string
  banco1_nombre: string
  banco1_numero: string
  banco2_nombre: string
  banco2_numero: string
  yape_numero: string
}

const CONFIG_KEY = 'webapp_config'

export const getConfig = (): ConfigApp => {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {
    empresa_nombre: '', empresa_ruc: '', empresa_direccion: '',
    empresa_telefono: '', empresa_email: '',
    banco1_nombre: 'BCP', banco1_numero: '',
    banco2_nombre: 'Interbank', banco2_numero: '',
    yape_numero: '',
  }
}

export const saveConfig = (config: ConfigApp) => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}

interface Props { onMenuOpen: () => void }
const Configuracion: React.FC<Props> = ({ onMenuOpen }) => {
  const [config, setConfig] = useState<ConfigApp>(getConfig())
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    saveConfig(config)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const field = (label: string, key: keyof ConfigApp, placeholder = '') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
        placeholder={placeholder}
        value={config[key]}
        onChange={e => setConfig({ ...config, [key]: e.target.value })}
      />
    </div>
  )

  return (
    <Layout onMenuOpen={onMenuOpen}>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Configuración</h1>
          <p className="text-gray-500 mt-1">Datos de tu empresa y cuentas bancarias para recibos y cotizaciones</p>
        </div>

        {saved && (
          <div className="mb-4 p-3 bg-green-50 border border-green-300 rounded-lg flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Configuración guardada correctamente</span>
          </div>
        )}

        {/* Datos de Empresa */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">Datos de la Empresa</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">Aparecen en el encabezado de tus cotizaciones y recibos</p>
          <div className="grid grid-cols-2 gap-4">
            {field('Nombre / Razón Social', 'empresa_nombre', 'Ej: Servicios Globales SAC')}
            {field('RUC', 'empresa_ruc', 'Ej: 20123456789')}
            {field('Dirección', 'empresa_direccion', 'Av. Principal 123, Lima')}
            {field('Teléfono', 'empresa_telefono', '987654321')}
            {field('Email', 'empresa_email', 'contacto@empresa.com')}
          </div>
        </div>

        {/* Cuentas Bancarias */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold text-gray-900">Cuentas para Cobro</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">Aparecen al pie de los recibos de alquiler</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banco 1</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm mb-2"
                value={config.banco1_nombre}
                onChange={e => setConfig({ ...config, banco1_nombre: e.target.value })}>
                <option>BCP</option><option>Interbank</option><option>BBVA</option>
                <option>Scotiabank</option><option>Banbif</option><option>Otro</option>
              </select>
              <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                placeholder="Número de cuenta" value={config.banco1_numero}
                onChange={e => setConfig({ ...config, banco1_numero: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banco 2</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm mb-2"
                value={config.banco2_nombre}
                onChange={e => setConfig({ ...config, banco2_nombre: e.target.value })}>
                <option>BCP</option><option>Interbank</option><option>BBVA</option>
                <option>Scotiabank</option><option>Banbif</option><option>Otro</option>
              </select>
              <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                placeholder="Número de cuenta" value={config.banco2_numero}
                onChange={e => setConfig({ ...config, banco2_numero: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yape / Plin</label>
              <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                placeholder="Número de celular" value={config.yape_numero}
                onChange={e => setConfig({ ...config, yape_numero: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={handleSave}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
            <Save className="w-4 h-4" /> Guardar Configuración
          </button>
        </div>
      </div>
    </Layout>
  )
}

export default Configuracion
