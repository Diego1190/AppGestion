import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useMobileMenu } from '@/hooks/useMobileMenu'
import './App.css'

const Login         = lazy(() => import('@/pages/Login'))
const Alquileres    = lazy(() => import('@/pages/Alquileres'))
const Cotizaciones  = lazy(() => import('@/pages/Cotizaciones'))
const Finanzas      = lazy(() => import('@/pages/Finanzas'))
const Configuracion = lazy(() => import('@/pages/Configuracion'))

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      <p className="mt-3 text-sm text-gray-500">Cargando...</p>
    </div>
  </div>
)

const AppContent: React.FC<{ user: any; onLogout: () => void }> = ({ user, onLogout }) => {
  const { isOpen, open, close } = useMobileMenu()
  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar user={user} onLogout={onLogout} isOpen={isOpen} onClose={close} />
      <div className="flex-1 min-w-0">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"                element={<Navigate to="/alquileres" replace />} />
            <Route path="/alquileres/*"    element={<Alquileres    onMenuOpen={open} />} />
            <Route path="/cotizaciones/*"  element={<Cotizaciones  onMenuOpen={open} />} />
            <Route path="/finanzas/*"      element={<Finanzas      onMenuOpen={open} />} />
            <Route path="/configuracion"   element={<Configuracion onMenuOpen={open} />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  )
}

function App() {
  const [user, setUser]       = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data?.session?.user ?? null)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener?.subscription?.unsubscribe()
  }, [])

  const handleLogout = useCallback(() => setUser(null), [])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        <p className="mt-4 text-gray-600">Cargando...</p>
      </div>
    </div>
  )

  if (!user) return (
    <Suspense fallback={<PageLoader />}>
      <Login />
    </Suspense>
  )

  return (
    <Router>
      <AppContent user={user} onLogout={handleLogout} />
    </Router>
  )
}

export default App
