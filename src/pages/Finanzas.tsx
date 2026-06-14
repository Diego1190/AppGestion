import React from 'react'
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import GastosTab     from '@/components/modules/finanzas/GastosTab'
import VentaCasaTab  from '@/components/modules/finanzas/VentaCasaTab'

interface Props { onMenuOpen: () => void }

const Finanzas: React.FC<Props> = ({ onMenuOpen }) => {
  const location = useLocation()
  const isActive = (p: string) => location.pathname.includes(p)

  return (
    <Layout onMenuOpen={onMenuOpen}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Finanzas Personales</h1>
          <p className="text-gray-500 mt-1 text-sm">Control de gastos y seguimiento de metas</p>
        </div>
        <div className="flex gap-0 mb-5 border-b border-gray-200">
          {[
            { path: 'gastos',     label: 'Gastos' },
            { path: 'venta-casa', label: 'Control Venta Casa' },
          ].map(({ path, label }) => (
            <Link key={path} to={`/finanzas/${path}`}
              className={`px-5 py-3 font-medium border-b-2 transition-colors text-sm ${
                isActive(path) ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}>
              {label}
            </Link>
          ))}
        </div>
        <Routes>
          <Route path="/"            element={<Navigate to="/finanzas/gastos" replace />} />
          <Route path="/gastos"      element={<GastosTab />} />
          <Route path="/venta-casa"  element={<VentaCasaTab />} />
        </Routes>
      </div>
    </Layout>
  )
}

export default Finanzas
