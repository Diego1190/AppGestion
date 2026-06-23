import React from 'react'

interface ModalProps {
  /** Controla si el modal se muestra. El padre sigue manejando su propio estado (abierto/cerrado). */
  open: boolean
  /** Ancho máximo en desktop. Por defecto 'md', igual al usado en la mayoría de modales del proyecto. */
  maxWidth?: 'sm' | 'md' | 'lg' | '2xl'
  /** Contenido del modal (header, body, footer) */
  children: React.ReactNode
}

const MAX_WIDTH: Record<NonNullable<ModalProps['maxWidth']>, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  '2xl': 'sm:max-w-2xl',
}

/**
 * Wrapper de modal reutilizable.
 * Antes este mismo overlay + contenedor estaba copiado manualmente en 11 lugares
 * (InquilinosTab, MovimientosTab, CobranzaTab, GastosTab, VentaCasaTab, ListadoTab).
 * Mismo comportamiento visual: hoja completa desde abajo en móvil, modal centrado en desktop.
 */
export const Modal: React.FC<ModalProps> = ({ open, maxWidth = 'md', children }) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className={`bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full ${MAX_WIDTH[maxWidth]} max-h-[90vh] overflow-y-auto`}>
        {children}
      </div>
    </div>
  )
}

interface ModalHeaderProps {
  title: string
  subtitle?: React.ReactNode
  onClose: () => void
  /** Variante visual del header. 'default' = blanco, 'warning' = naranja (cierres/acciones delicadas) */
  variant?: 'default' | 'warning'
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({ title, subtitle, onClose, variant = 'default' }) => (
  <div className={`px-5 sm:px-6 py-4 border-b flex justify-between items-start sticky top-0 ${variant === 'warning' ? 'bg-orange-50' : 'bg-white'}`}>
    <div>
      <h2 className={`text-base sm:text-lg font-semibold ${variant === 'warning' ? 'text-orange-800' : 'text-gray-900'}`}>{title}</h2>
      {subtitle && <div className="text-sm text-gray-500 mt-0.5">{subtitle}</div>}
    </div>
    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-4 flex-shrink-0">✕</button>
  </div>
)

export const ModalBody: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`px-5 sm:px-6 py-4 space-y-4 ${className}`}>{children}</div>
)

export const ModalFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`px-5 sm:px-6 py-4 border-t sticky bottom-0 bg-white flex gap-2 justify-end ${className}`}>{children}</div>
)
