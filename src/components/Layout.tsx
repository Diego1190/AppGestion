import React from 'react'

interface LayoutProps {
  children: React.ReactNode
  onMenuOpen?: () => void
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    // Desktop: ml-16 (sidebar colapsado 64px)
    // Móvil: sin margen izquierdo, padding-bottom para no tapar bottom nav
    <div className="md:ml-16 min-h-screen bg-gray-100 pb-16 md:pb-0">
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        {children}
      </div>
    </div>
  )
}

export default Layout
