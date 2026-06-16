import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type TablaDB =
  | 'movimientos_depa'
  | 'inquilinos'
  | 'contratos'
  | 'cotizaciones'
  | 'gastos_personales'
  | 'control_venta_casa'

/**
 * Suscribe un componente a cambios en tiempo real de una o más tablas.
 * Cuando otro dispositivo hace INSERT/UPDATE/DELETE, onUpdate() se ejecuta
 * automáticamente, actualizando la vista sin necesidad de recargar.
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

    const channel = supabase.channel(nombre)

    lista.forEach(tabla => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tabla },
        () => {
          // Pequeño delay para que Supabase termine de confirmar el cambio
          setTimeout(() => callbackRef.current(), 100)
        },
      )
    })

    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(Array.isArray(tablas) ? tablas : [tablas])])
}
