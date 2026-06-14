import React from 'react'
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import CrearCotizacionTab from '@/components/modules/cotizaciones/CrearCotizacionTab'
import ListadoTab         from '@/components/modules/cotizaciones/ListadoTab'

interface Props { onMenuOpen: () => void }

const Cotizaciones: React.FC<Props> = ({ onMenuOpen }) => {
  const location = useLocation()
  const isActive = (p: string) => location.pathname.includes(p)

  return (
    <Layout onMenuOpen={onMenuOpen}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gestión de Cotizaciones</h1>
          <p className="text-gray-500 mt-1 text-sm">Crea presupuestos con calculadora avanzada</p>
        </div>
        <div className="flex gap-0 mb-5 border-b border-gray-200">
          {[
            { path: 'crear',   label: 'Crear Cotización' },
            { path: 'listado', label: 'Historial' },
          ].map(({ path, label }) => (
            <Link key={path} to={`/cotizaciones/${path}`}
              className={`px-5 py-3 font-medium border-b-2 transition-colors text-sm ${
                isActive(path) ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}>
              {label}
            </Link>
          ))}
        </div>
        <Routes>
          <Route path="/"        element={<Navigate to="/cotizaciones/crear" replace />} />
          <Route path="/crear"   element={<CrearCotizacionTab />} />
          <Route path="/listado" element={<ListadoTab />} />
        </Routes>
      </div>
    </Layout>
  )
}

export default Cotizaciones
