# WebApp - Gestión de Alquileres, Cotizaciones y Finanzas

## 📋 Descripción

Web App completa para gestionar:
- **Módulo 1**: Alquileres (inquilinos, contratos, movimientos, cobranza)
- **Módulo 2**: Cotizaciones (calculadora avanzada Drywall, melamina, especialidades)
- **Módulo 3**: Finanzas Personales (gastos, control venta de casa)

Stack: React + TypeScript + Supabase + Tailwind CSS

---

## 🚀 INSTALACIÓN

### 1. Requisitos
- Node.js 16+ 
- npm o yarn
- Cuenta Supabase (gratis)

### 2. Setup del Proyecto

```bash
# Clonar o descargar el proyecto
cd web-app-proyecto

# Instalar dependencias
npm install

# Crear archivo .env con tus credenciales Supabase
cp .env.example .env.local
```

Edita `.env.local`:
```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

### 3. Setup Supabase

#### A. Crear tablas en Supabase SQL Editor:

```sql
-- MÓDULO 1: ALQUILERES
CREATE TABLE inquilinos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo TEXT NOT NULL,
  dni TEXT UNIQUE NOT NULL,
  telefono TEXT,
  num_depa INTEGER,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id UUID REFERENCES inquilinos(id) ON DELETE CASCADE,
  tipo_contrato TEXT CHECK (tipo_contrato IN ('Inicial', 'Renovación')),
  fecha_inicio DATE NOT NULL,
  meses_alquiler INTEGER NOT NULL,
  fecha_final DATE,
  importe_alquiler NUMERIC(10,2),
  activo BOOLEAN DEFAULT true
);

CREATE TABLE movimientos_depa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  num_depa INTEGER,
  tipo_servicio TEXT CHECK (tipo_servicio IN ('Alquiler', 'Luz', 'Agua', 'Internet', 'Cable', 'Otro')),
  fecha_vencimiento DATE,
  mes INTEGER,
  anio INTEGER,
  lectura_anterior NUMERIC(10,2),
  lectura_actual NUMERIC(10,2),
  consumo NUMERIC(10,2),
  tarifa NUMERIC(10,2),
  importe_pagar NUMERIC(10,2),
  estado TEXT CHECK (estado IN ('Pendiente', 'Pagado')) DEFAULT 'Pendiente'
);

-- MÓDULO 2: COTIZACIONES
CREATE TABLE catalogo_servicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  categoria TEXT CHECK (categoria IN ('Drywall', 'Techo', 'Melamina', 'Pintura', 'Electricidad', 'Gasfiteria', 'Enchape')),
  detalle TEXT,
  unidad_medida TEXT,
  precio_base NUMERIC(10,2)
);

CREATE TABLE cotizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlativo TEXT UNIQUE NOT NULL,
  fecha_emision DATE DEFAULT now(),
  fecha_vencimiento DATE,
  cliente_nombre TEXT,
  cliente_telefono TEXT,
  cliente_empresa TEXT,
  proyecto_nombre TEXT,
  proyecto_direccion TEXT,
  proyecto_distrito TEXT,
  condiciones_pago TEXT,
  garantia TEXT,
  facilidades_cliente TEXT,
  porcentaje_desgaste NUMERIC(3,2) DEFAULT 0.05,
  monto_subtotal NUMERIC(10,2),
  monto_desgaste_total NUMERIC(10,2),
  monto_total NUMERIC(10,2)
);

CREATE TABLE cotizacion_detalles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id UUID REFERENCES cotizaciones(id) ON DELETE CASCADE,
  servicio_codigo TEXT,
  descripcion TEXT,
  cantidad NUMERIC(10,2),
  precio_unitario NUMERIC(10,2),
  total_item NUMERIC(10,2)
);

CREATE TABLE cotizacion_insumos_internos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id UUID REFERENCES cotizaciones(id) ON DELETE CASCADE,
  material_nombre TEXT,
  cantidad_estimada NUMERIC(10,2),
  unidad TEXT,
  comprado BOOLEAN DEFAULT false
);

-- MÓDULO 3: FINANZAS
CREATE TABLE gastos_personales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concepto TEXT,
  fecha_vencimiento DATE,
  monto NUMERIC(10,2),
  estado TEXT CHECK (estado IN ('Pendiente', 'Pagado')) DEFAULT 'Pendiente'
);

CREATE TABLE control_venta_casa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_pago DATE,
  mes INTEGER,
  anio INTEGER,
  monto_pagado NUMERIC(10,2),
  entregado_a TEXT CHECK (entregado_a IN ('Gabriel', 'Fernando', 'Tú'))
);
```

#### B. Configurar Row Level Security (RLS)

En Supabase, ve a **Authentication** > **Policies** y habilita RLS en todas las tablas. Para pruebas rápidas, puedes permitir acceso público:

```sql
CREATE POLICY "Enable insert for authenticated users only" 
ON inquilinos FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" 
ON inquilinos FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Repite para otras tablas
```

---

## 🏃 EJECUTAR EN DESARROLLO

```bash
npm run dev
```

Abre `http://localhost:3000` en tu navegador.

### Credenciales de Prueba
1. Ve a Supabase > **Authentication** > **Users**
2. Crea un usuario de prueba (email y contraseña)
3. Usa esas credenciales para login en la app

---

## 📁 ESTRUCTURA DEL PROYECTO

```
web-app-proyecto/
├── src/
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   └── modules/
│   │       └── alquileres/
│   │           ├── InquilinosTab.tsx
│   │           ├── MovimientosTab.tsx
│   │           └── CobranzaTab.tsx
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Alquileres.tsx
│   │   ├── Cotizaciones.tsx
│   │   └── Finanzas.tsx
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── calculations.ts
│   │   ├── alquileres.ts
│   │   ├── cotizaciones.ts
│   │   ├── finanzas.ts
│   │   └── pdf.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── App.css
│   ├── index.css
│   └── main.tsx
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── .env.example
```

---

## 🎯 PRÓXIMOS PASOS / TODO

### Implementar Componentes
- [ ] **MovimientosTab**: Formulario inteligente (Alquiler/Luz/Agua/Internet)
- [ ] **CobranzaTab**: Panel mensual con generación de PDF y WhatsApp
- [ ] **Cotizaciones**: Calculadora Drywall (Paredes, Techos, Melamina)
- [ ] **Especialidades**: Pintura, Electricidad, Gasfitería, Enchape
- [ ] **Finanzas**: Gastos personales y control venta de casa

### Funcionalidades Avanzadas
- [ ] Búsqueda de lectura anterior automática en movimientos
- [ ] Validación: Monto mínimo $200, tope $6,666.66 por hermano
- [ ] Bloqueo automático en dropdown cuando se alcanza tope
- [ ] Generación de PDF con encabezados y pies personalizados
- [ ] Integración WhatsApp (wa.me URL)
- [ ] Reportes y exportación a Excel
- [ ] Gráficos de consumo (Luz/Agua) con Chart.js

---

## 🔧 COMANDOS ÚTILES

```bash
# Desarrollo
npm run dev

# Build para producción
npm run build

# Preview del build
npm run preview

# Linting
npm run lint
```

---

## 🛠️ STACK TECNOLÓGICO

| Librería | Versión | Propósito |
|----------|---------|----------|
| React | 18.2.0 | Framework UI |
| TypeScript | 5.3 | Tipado estático |
| Vite | 5.0 | Build tool |
| Tailwind CSS | 3.3 | Estilos |
| Supabase | 2.38 | Backend/BD |
| jsPDF | 2.5 | Generación PDF |
| html2canvas | 1.4 | Captura de HTML a imagen |
| Lucide React | 0.292 | Iconos |
| React Router | 6.20 | Navegación |

---

## 📊 VARIABLES DE ENTORNO

Crea `.env.local`:
```
VITE_SUPABASE_URL=tu_url_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

---

## 🚀 DESPLIEGUE EN PRODUCCIÓN

### Opción 1: Vercel (Recomendado)
```bash
npm install -g vercel
vercel
```

### Opción 2: Netlify
```bash
npm run build
# Sube la carpeta 'dist' a Netlify
```

### Opción 3: Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

---

## 💡 CONSEJOS

1. **Validaciones**: Agrega validaciones en formularios antes de enviar a BD
2. **Error Handling**: Envuelve todas las operaciones DB en try-catch
3. **Cargadores**: Usa estados `loading` para mejor UX
4. **Modales**: Usa componentes reutilizables para modales
5. **Permisos**: Configura RLS en Supabase para seguridad
6. **Testing**: Usa datos de prueba antes de usar en producción

---

## 📞 SOPORTE

- Supabase Docs: https://supabase.com/docs
- React Docs: https://react.dev
- Tailwind Docs: https://tailwindcss.com/docs
- Vite Docs: https://vitejs.dev

---

## 📝 LICENCIA

Proyecto personal - Uso libre

---

**Versión**: 1.0.0  
**Última actualización**: Mayo 2026  
**Autor**: Tu nombre
