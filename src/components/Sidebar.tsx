import React, { memo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Building2, FileText, Wallet, Settings, LogOut, Home } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface SidebarProps {
  user: any
  onLogout: () => void
  isOpen: boolean
  onClose: () => void
}

const NAV = [
  { path: '/alquileres',    label: 'Alquileres',    icon: Building2 },
  { path: '/cotizaciones',  label: 'Cotizaciones',  icon: FileText  },
  { path: '/finanzas',      label: 'Finanzas',      icon: Wallet    },
  { path: '/configuracion', label: 'Configuración', icon: Settings  },
]

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout }) => {
  const location = useLocation()
  const [expanded, setExpanded] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    onLogout()
  }

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <>
      {/* ── DESKTOP: sidebar colapsado → expandido al hover ── */}
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className={`hidden md:flex flex-col fixed left-0 top-0 h-screen z-40 bg-gray-900 text-white shadow-xl transition-all duration-200 ease-in-out ${expanded ? 'w-56' : 'w-16'}`}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-3 border-b border-gray-700 overflow-hidden">
          <Home className="w-6 h-6 text-blue-400 flex-shrink-0" />
          {expanded && <span className="ml-3 font-bold text-sm whitespace-nowrap">WebApp Gestión</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-1 px-2">
          {NAV.map(({ path, label, icon: Icon }) => {
            const active = isActive(path)
            return (
              <Link key={path} to={path}
                title={!expanded ? label : undefined}
                className={`flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors text-sm font-medium overflow-hidden ${
                  active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}>
                <Icon className="w-5 h-5 flex-shrink-0" />
                {expanded && <span className="whitespace-nowrap">{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="p-2 border-t border-gray-700">
          {expanded && (
            <p className="text-xs text-gray-500 truncate px-2 mb-2">{user?.email}</p>
          )}
          <button onClick={handleLogout}
            title={!expanded ? 'Cerrar sesión' : undefined}
            className="flex items-center gap-3 w-full px-2 py-2.5 rounded-lg text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors">
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {expanded && <span className="text-sm whitespace-nowrap">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* ── MÓVIL: bottom navigation bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-700 flex">
        {NAV.map(({ path, label, icon: Icon }) => {
          const active = isActive(path)
          return (
            <Link key={path} to={path}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                active ? 'text-blue-400' : 'text-gray-500'
              }`}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-tight">{label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}

export default memo(Sidebar)
