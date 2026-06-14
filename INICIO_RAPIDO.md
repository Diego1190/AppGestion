# 🚀 GUÍA RÁPIDA DE INICIO

## Paso 1: Descargar el proyecto
Extrae el archivo ZIP en tu carpeta de proyectos.

## Paso 2: Instalar Node.js
Si no lo tienes, descarga desde: https://nodejs.org/

## Paso 3: Instalar dependencias
```bash
cd web-app-proyecto
npm install
```

## Paso 4: Crear proyecto Supabase
1. Ve a https://app.supabase.com
2. Crea un nuevo proyecto (usa plan gratuito)
3. Espera a que se cree
4. Ve a **SQL Editor**
5. Copia el contenido de `SETUP_SQL.sql`
6. Pégalo en el editor SQL de Supabase
7. Ejecuta el script

## Paso 5: Obtener credenciales Supabase
1. Ve a **Project Settings** (engrane inferior izquierda)
2. En **API**, copia:
   - **Project URL** → VITE_SUPABASE_URL
   - **anon public** → VITE_SUPABASE_ANON_KEY

## Paso 6: Configurar .env.local
Abre `.env.local` y pega:
```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=ey...
```

## Paso 7: Crear usuario de prueba
1. En Supabase, ve a **Authentication** > **Users**
2. Haz clic en **Add user**
3. Email: `test@example.com`
4. Contraseña: `123456789`
5. Confirma

## Paso 8: Ejecutar el proyecto
```bash
npm run dev
```

Abre tu navegador en `http://localhost:3000`

## Paso 9: Login
- Email: `test@example.com`
- Contraseña: `123456789`

---

## 📝 Notas Importantes

- Cambia `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` por tus valores reales
- No commits `.env.local` a Git
- En producción, usa variables de entorno seguras
- Los componentes tienen estructura base, personalízalos según tus necesidades

---

## 🎯 Próximos Pasos

1. Completa los componentes de **Movimientos** y **Cobranza**
2. Implementa la **Calculadora de Cotizaciones**
3. Agrega **validaciones** en formularios
4. Configura **email/WhatsApp** para notificaciones
5. Despliega en **Vercel** o **Netlify**

¡Éxito! 🎉
