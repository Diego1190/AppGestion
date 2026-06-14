import React, { useEffect } from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning'

export interface ToastMsg {
  id: string
  type: ToastType
  message: string
}

interface ToastProps {
  toasts: ToastMsg[]
  onClose: (id: string) => void
}

const STYLES: Record<ToastType, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  success: {
    bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-800',
    icon: <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
  },
  error: {
    bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-800',
    icon: <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
  },
  warning: {
    bg: 'bg-yellow-50', border: 'border-yellow-400', text: 'text-yellow-800',
    icon: <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
  },
}

const ToastItem: React.FC<{ toast: ToastMsg; onClose: (id: string) => void }> = ({ toast, onClose }) => {
  const s = STYLES[toast.type]
  useEffect(() => {
    const t = setTimeout(() => onClose(toast.id), 4000)
    return () => clearTimeout(t)
  }, [toast.id, onClose])

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border-l-4 shadow-lg ${s.bg} ${s.border} animate-slide-in`}>
      {s.icon}
      <p className={`text-sm font-medium flex-1 ${s.text}`}>{toast.message}</p>
      <button onClick={() => onClose(toast.id)} className={`${s.text} opacity-60 hover:opacity-100 ml-2`}>
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onClose }) => (
  <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-80">
    {toasts.map(t => <ToastItem key={t.id} toast={t} onClose={onClose} />)}
  </div>
)

// Hook para usar toasts
export const useToast = () => {
  const [toasts, setToasts] = React.useState<ToastMsg[]>([])

  const addToast = React.useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, type, message }])
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, removeToast }
}

// Modal de confirmación con color según tipo
interface ConfirmModalProps {
  open: boolean
  titulo: string
  mensaje: string
  tipo?: 'danger' | 'warning'
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open, titulo, mensaje, tipo = 'danger', onConfirm, onCancel
}) => {
  if (!open) return null
  const isDanger = tipo === 'danger'
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div className={`px-6 py-4 rounded-t-xl ${isDanger ? 'bg-red-50' : 'bg-yellow-50'}`}>
          <div className="flex items-center gap-3">
            {isDanger
              ? <AlertCircle className="w-6 h-6 text-red-500" />
              : <AlertTriangle className="w-6 h-6 text-yellow-500" />}
            <h3 className={`font-semibold ${isDanger ? 'text-red-800' : 'text-yellow-800'}`}>{titulo}</h3>
          </div>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600">{mensaje}</p>
        </div>
        <div className="px-6 py-4 flex gap-2 justify-end border-t">
          <button onClick={onCancel}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-500 hover:bg-yellow-600'}`}>
            {isDanger ? 'Eliminar' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Componente de campo con error
interface FieldErrorProps {
  error?: string | null
}

export const FieldError: React.FC<FieldErrorProps> = ({ error }) => {
  if (!error) return null
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
      <p className="text-xs text-red-600">{error}</p>
    </div>
  )
}
