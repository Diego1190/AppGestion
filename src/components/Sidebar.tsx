import React, { memo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Building2, FileText, Wallet, LogOut, Home, Settings, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface SidebarProps {
  user: any
  onLogout: () => void
  isOpen: boolean    // móvil: sidebar abierto
  onClose: () => void
}

const NAV = [
  { path: '/alquileres',    label: 'Alquileres',    icon: Building2 },
  { path: '/cotizaciones',  label: 'Cotizaciones',  icon: FileText  },
  { path: '/finanzas',      label: 'Finanzas',      icon: Wallet    },
  { path: '/configuracion', label: 'Configuración', icon: Settings  },
]

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout, isOpen, onClose }) => {
  const location = useLocation()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    onLogout()
  }

  const sidebarContent = (
    <div className="w-64 bg-gray-900 text-white flex flex-col h-full">
      {/* Logo + botón cerrar en móvil */}
      <div className="p-5 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Home className="w-7 h-7 text-blue-400 flex-shrink-0" />
          <div>
            <h1 className="text-lg font-bold leading-tight">WebApp</h1>
            <p className="text-xs text-gray-400">Gestión Integral</p>
          </div>
        </div>
        {/* Solo visible en móvil */}
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg hover:bg-gray-700 transition-colors ml-2"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV.map(({ path, label, icon: Icon }) => {
          const active = location.pathname.startsWith(path)
          return (
            <Link
              key={path}
              to={path}
              onClick={onClose}   // cierra en móvil al navegar
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Usuario + logout */}
      <div className="border-t border-gray-700 p-4">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Usuario</p>
        <p className="text-sm font-medium truncate mb-3 text-gray-200">{user?.email}</p>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Desktop: sidebar fijo ── */}
      <aside className="hidden md:flex w-64 bg-gray-900 flex-col h-screen fixed left-0 top-0 z-40 shadow-lg">
        {sidebarContent}
      </aside>

      {/* ── Móvil: overlay + sidebar deslizante ── */}
      {/* Overlay oscuro */}
      <div
        className={`md:hidden fixed inset-0 bg-black z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-50 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sidebar deslizante */}
      <aside
        className={`md:hidden fixed left-0 top-0 h-full z-50 shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  )
}

// memo: evita re-render si las props no cambian
export default memo(Sidebar)
