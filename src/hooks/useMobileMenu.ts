import { useState, useCallback, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Centraliza el estado open/close del menú lateral en móvil.
 * Se cierra automáticamente al cambiar de ruta.
 */
export const useMobileMenu = () => {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()

  // Cierra el menú al navegar
  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname])

  // Bloquea el scroll del body cuando el menú está abierto en móvil
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const open  = useCallback(() => setIsOpen(true),  [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(p => !p), [])

  return { isOpen, open, close, toggle }
}
