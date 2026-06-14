import React from 'react'
import { Menu } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
  onMenuOpen: () => void
}

/**
 * Contenedor principal de cada página.
 * - Desktop (md+): deja espacio para el sidebar fijo (ml-64)
 * - Móvil: ocupa todo el ancho, muestra botón hamburguesa arriba
 * 
 * Reemplaza el patrón repetido <div className="p-8 ml-64"> en cada página.
 */
const Layout: React.FC<LayoutProps> = ({ children, onMenuOpen }) => {
  return (
    <div className="md:ml-64 min-h-screen bg-gray-100">
      {/* Barra superior solo en móvil */}
      <div className="md:hidden flex items-center gap-3 bg-gray-900 text-white px-4 py-3 sticky top-0 z-30">
        <button
          onClick={onMenuOpen}
          className="p-1.5 rounded-lg hover:bg-gray-700 transition-colors"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-semibold text-sm">WebApp Gestión Integral</span>
      </div>

      {/* Contenido de la página */}
      <div className="p-4 md:p-8">
        {children}
      </div>
    </div>
  )
}

export default Layout
