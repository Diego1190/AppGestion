import { supabase } from '@/lib/supabase'

const BUCKET = 'pdfs'

/**
 * Sube un PDF a Supabase Storage en la carpeta correspondiente.
 * Bucket: pdfs (privado)
 * Estructura: pdfs/recibos/ o pdfs/cotizaciones/
 */
export const uploadPDFToStorage = async (
  blob: Blob,
  filename: string,
  tipo: 'recibos' | 'cotizaciones'
): Promise<string> => {
  const path = `${tipo}/${filename}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: 'application/pdf',
      upsert: true,   // sobreescribe si ya existe el mismo nombre
    })

  if (error) throw new Error(`Error guardando PDF: ${error.message}`)

  // URL firmada válida por 1 hora (privado)
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600)

  return data?.signedUrl ?? ''
}
