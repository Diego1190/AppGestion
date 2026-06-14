import React from 'react'
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import InquilinosTab  from '@/components/modules/alquileres/InquilinosTab'
import MovimientosTab from '@/components/modules/alquileres/MovimientosTab'
import CobranzaTab    from '@/components/modules/alquileres/CobranzaTab'

interface Props { onMenuOpen: () => void }

const TABS = [
  { path: '/alquileres/inquilinos',   label: 'Inquilinos y Contratos' },
  { path: '/alquileres/movimientos',  label: 'Movimientos y Servicios' },
  { path: '/alquileres/cobranza',     label: 'Panel de Cobranza' },
]

const Alquileres: React.FC<Props> = ({ onMenuOpen }) => {
  const location = useLocation()
  const isActive = (p: string) => location.pathname.includes(p)

  return (
    <Layout onMenuOpen={onMenuOpen}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-5 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gestión de Alquileres</h1>
          <p className="text-gray-600 mt-1 text-sm md:text-base">Administra inquilinos, contratos y cobros mensuales</p>
        </div>

        {/* Tabs — scroll horizontal en móvil */}
        <div className="flex gap-0 mb-5 border-b border-gray-200 overflow-x-auto scrollbar-hide">
          {TABS.map(({ path, label }) => (
            <Link key={path} to={path}
              className={`px-4 py-2.5 font-medium border-b-2 transition-colors whitespace-nowrap text-sm flex-shrink-0 ${
                isActive(path.split('/').pop()!)
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}>
              {label}
            </Link>
          ))}
        </div>

        <Routes>
          <Route path="/inquilinos"  element={<InquilinosTab />} />
          <Route path="/movimientos" element={<MovimientosTab />} />
          <Route path="/cobranza"    element={<CobranzaTab />} />
          <Route path="*"            element={<Navigate to="/alquileres/inquilinos" replace />} />
        </Routes>
      </div>
    </Layout>
  )
}

export default Alquileres
