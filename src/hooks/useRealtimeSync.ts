import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type TablaDB =
  | 'movimientos_depa'
  | 'inquilinos'
  | 'contratos'
  | 'cotizaciones'
  | 'gastos_personales'
  | 'control_venta_casa'
  | 'configuracion_app'

/**
 * Suscribe un componente a cambios en tiempo real de una o más tablas.
 * Cuando otro dispositivo hace INSERT/UPDATE/DELETE, onUpdate() se ejecuta
 * automáticamente, actualizando la vista sin necesidad de recargar.
 *
 * Reconexión automática: si el canal se cae (señal de celular intermitente,
 * WebSocket cerrado por el servidor, etc.) se reintenta la suscripción con
 * backoff exponencial (1s, 2s, 4s... hasta un máximo de 30s entre intentos).
 * También se reconecta de inmediato cuando el navegador detecta que volvió
 * la conexión a internet (evento 'online').
 *
 * Requiere: Supabase Realtime habilitado en las tablas (ver instrucciones).
 */
export const useRealtimeSync = (
  tablas: TablaDB | TablaDB[],
  onUpdate: () => void,
) => {
  // Ref para evitar que el useEffect se re-ejecute si onUpdate cambia
  const callbackRef = useRef(onUpdate)
  callbackRef.current = onUpdate

  useEffect(() => {
    const lista  = Array.isArray(tablas) ? tablas : [tablas]
    const nombre = `realtime:${lista.join('_')}`

    let channel: ReturnType<typeof supabase.channel> | null = null
    let retryTimeout: ReturnType<typeof setTimeout> | null = null
    let retryCount = 0
    let cancelado = false

    const limpiarRetry = () => {
      if (retryTimeout) { clearTimeout(retryTimeout); retryTimeout = null }
    }

    const conectar = () => {
      if (cancelado) return
      channel = supabase.channel(`${nombre}_${Date.now()}`) // nombre único por intento, evita colisión con el canal caído anterior

      lista.forEach(tabla => {
        channel!.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tabla },
          () => {
            // Pequeño delay para que Supabase termine de confirmar el cambio
            setTimeout(() => callbackRef.current(), 100)
          },
        )
      })

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          retryCount = 0 // conexión sana, resetea el backoff
          limpiarRetry()
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (cancelado) return
          // Backoff exponencial acotado: 1s, 2s, 4s, 8s, 16s, 30s, 30s...
          const espera = Math.min(1000 * 2 ** retryCount, 30000)
          retryCount++
          limpiarRetry()
          retryTimeout = setTimeout(() => {
            if (channel) supabase.removeChannel(channel)
            conectar()
          }, espera)
        }
      })
    }

    conectar()

    // Si el dispositivo recupera la señal (móvil saliendo de un túnel, wifi que vuelve),
    // reconectamos de inmediato sin esperar al backoff.
    const handleOnline = () => {
      retryCount = 0
      limpiarRetry()
      if (channel) supabase.removeChannel(channel)
      conectar()
    }
    window.addEventListener('online', handleOnline)

    return () => {
      cancelado = true
      limpiarRetry()
      window.removeEventListener('online', handleOnline)
      if (channel) supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(Array.isArray(tablas) ? tablas : [tablas])])
}
