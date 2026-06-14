-- =============================================
-- SCRIPT SQL CORREGIDO PARA SUPABASE
-- =============================================
-- Este script NO usa GENERATED ALWAYS (que causa errores)
-- En su lugar usa TRIGGERS para cálculos automáticos

-- =============================================
-- MÓDULO 1: ALQUILERES
-- =============================================

CREATE TABLE IF NOT EXISTS inquilinos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo TEXT NOT NULL,
  dni TEXT UNIQUE NOT NULL,
  telefono TEXT,
  num_depa INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id UUID NOT NULL REFERENCES inquilinos(id) ON DELETE CASCADE,
  tipo_contrato TEXT NOT NULL CHECK (tipo_contrato IN ('Inicial', 'Renovación')),
  fecha_inicio DATE NOT NULL,
  meses_alquiler INTEGER NOT NULL,
  fecha_final DATE,
  importe_alquiler NUMERIC(10,2) NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- TRIGGER para calcular fecha_final automáticamente
CREATE OR REPLACE FUNCTION calcular_fecha_final()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_final := NEW.fecha_inicio + (NEW.meses_alquiler || ' months')::interval;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_fecha_final
BEFORE INSERT OR UPDATE ON contratos
FOR EACH ROW
EXECUTE FUNCTION calcular_fecha_final();

CREATE TABLE IF NOT EXISTS movimientos_depa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  num_depa INTEGER NOT NULL,
  tipo_servicio TEXT NOT NULL CHECK (tipo_servicio IN ('Alquiler', 'Luz', 'Agua', 'Internet', 'Cable', 'Otro')),
  fecha_vencimiento DATE NOT NULL,
  mes INTEGER,
  anio INTEGER,
  lectura_anterior NUMERIC(10,2),
  lectura_actual NUMERIC(10,2),
  consumo NUMERIC(10,2),
  tarifa NUMERIC(10,2),
  importe_pagar NUMERIC(10,2) NOT NULL,
  estado TEXT DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Pagado')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- TRIGGER para calcular mes y año
CREATE OR REPLACE FUNCTION calcular_mes_anio()
RETURNS TRIGGER AS $$
BEGIN
  NEW.mes := EXTRACT(MONTH FROM NEW.fecha_vencimiento)::INTEGER;
  NEW.anio := EXTRACT(YEAR FROM NEW.fecha_vencimiento)::INTEGER;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mes_anio
BEFORE INSERT OR UPDATE ON movimientos_depa
FOR EACH ROW
EXECUTE FUNCTION calcular_mes_anio();

-- TRIGGER para calcular consumo
CREATE OR REPLACE FUNCTION calcular_consumo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lectura_actual IS NOT NULL AND NEW.lectura_anterior IS NOT NULL THEN
    NEW.consumo := NEW.lectura_actual - NEW.lectura_anterior;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_consumo
BEFORE INSERT OR UPDATE ON movimientos_depa
FOR EACH ROW
EXECUTE FUNCTION calcular_consumo();

-- Índices para Alquileres
CREATE INDEX IF NOT EXISTS idx_contratos_inquilino ON contratos(inquilino_id);
CREATE INDEX IF NOT EXISTS idx_contratos_activo ON contratos(activo);
CREATE INDEX IF NOT EXISTS idx_movimientos_depa ON movimientos_depa(num_depa);
CREATE INDEX IF NOT EXISTS idx_movimientos_mes_anio ON movimientos_depa(mes, anio);
CREATE INDEX IF NOT EXISTS idx_movimientos_estado ON movimientos_depa(estado);

-- =============================================
-- MÓDULO 2: COTIZACIONES
-- =============================================

CREATE TABLE IF NOT EXISTS catalogo_servicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('Drywall', 'Techo', 'Melamina', 'Pintura', 'Electricidad', 'Gasfiteria', 'Enchape')),
  detalle TEXT NOT NULL,
  unidad_medida TEXT NOT NULL,
  precio_base NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cotizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlativo TEXT UNIQUE NOT NULL,
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE NOT NULL,
  cliente_nombre TEXT NOT NULL,
  cliente_telefono TEXT,
  cliente_empresa TEXT,
  proyecto_nombre TEXT NOT NULL,
  proyecto_direccion TEXT,
  proyecto_distrito TEXT,
  condiciones_pago TEXT,
  garantia TEXT,
  facilidades_cliente TEXT,
  porcentaje_desgaste NUMERIC(3,2) DEFAULT 0.05,
  monto_subtotal NUMERIC(10,2),
  monto_desgaste_total NUMERIC(10,2),
  monto_total NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- TRIGGER para calcular desgaste y total
CREATE OR REPLACE FUNCTION calcular_montos_cotizacion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.monto_subtotal IS NOT NULL THEN
    NEW.monto_desgaste_total := (NEW.monto_subtotal * NEW.porcentaje_desgaste) / 100;
    NEW.monto_total := NEW.monto_subtotal + NEW.monto_desgaste_total;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_montos_cotizacion
BEFORE INSERT OR UPDATE ON cotizaciones
FOR EACH ROW
EXECUTE FUNCTION calcular_montos_cotizacion();

CREATE TABLE IF NOT EXISTS cotizacion_detalles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id UUID NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  servicio_codigo TEXT,
  descripcion TEXT NOT NULL,
  cantidad NUMERIC(10,2) NOT NULL,
  precio_unitario NUMERIC(10,2) NOT NULL,
  total_item NUMERIC(10,2)
);

-- TRIGGER para calcular total_item
CREATE OR REPLACE FUNCTION calcular_total_item()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_item := NEW.cantidad * NEW.precio_unitario;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_total_item
BEFORE INSERT OR UPDATE ON cotizacion_detalles
FOR EACH ROW
EXECUTE FUNCTION calcular_total_item();

CREATE TABLE IF NOT EXISTS cotizacion_insumos_internos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id UUID NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  material_nombre TEXT NOT NULL,
  cantidad_estimada NUMERIC(10,2) NOT NULL,
  unidad TEXT NOT NULL,
  comprado BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para Cotizaciones
CREATE INDEX IF NOT EXISTS idx_cotizaciones_correlativo ON cotizaciones(correlativo);
CREATE INDEX IF NOT EXISTS idx_cotizacion_detalles_cotizacion ON cotizacion_detalles(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_cotizacion_insumos_cotizacion ON cotizacion_insumos_internos(cotizacion_id);

-- =============================================
-- MÓDULO 3: FINANZAS PERSONALES
-- =============================================

CREATE TABLE IF NOT EXISTS gastos_personales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concepto TEXT NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  monto NUMERIC(10,2) NOT NULL,
  estado TEXT DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Pagado')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS control_venta_casa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_pago DATE NOT NULL,
  mes INTEGER,
  anio INTEGER,
  monto_pagado NUMERIC(10,2) NOT NULL CHECK (monto_pagado >= 200),
  entregado_a TEXT NOT NULL CHECK (entregado_a IN ('Gabriel', 'Fernando', 'Tú')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- TRIGGER para calcular mes y año en venta de casa
CREATE OR REPLACE FUNCTION calcular_mes_anio_venta()
RETURNS TRIGGER AS $$
BEGIN
  NEW.mes := EXTRACT(MONTH FROM NEW.fecha_pago)::INTEGER;
  NEW.anio := EXTRACT(YEAR FROM NEW.fecha_pago)::INTEGER;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mes_anio_venta
BEFORE INSERT OR UPDATE ON control_venta_casa
FOR EACH ROW
EXECUTE FUNCTION calcular_mes_anio_venta();

-- Índices para Finanzas
CREATE INDEX IF NOT EXISTS idx_gastos_estado ON gastos_personales(estado);
CREATE INDEX IF NOT EXISTS idx_gastos_vencimiento ON gastos_personales(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_control_venta_mes_anio ON control_venta_casa(mes, anio);
CREATE INDEX IF NOT EXISTS idx_control_venta_hermano ON control_venta_casa(entregado_a);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
-- Habilita RLS en todas las tablas

ALTER TABLE inquilinos ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_depa ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo_servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizacion_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizacion_insumos_internos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_personales ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_venta_casa ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para usuarios autenticados
CREATE POLICY "Allow authenticated - inquilinos"
  ON inquilinos FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated - contratos"
  ON contratos FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated - movimientos"
  ON movimientos_depa FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated - catalogo"
  ON catalogo_servicios FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated - cotizaciones"
  ON cotizaciones FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated - cotizacion_detalles"
  ON cotizacion_detalles FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated - cotizacion_insumos"
  ON cotizacion_insumos_internos FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated - gastos"
  ON gastos_personales FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated - control_venta"
  ON control_venta_casa FOR ALL
  USING (auth.role() = 'authenticated');

-- =============================================
-- DATOS DE PRUEBA (OPCIONAL)
-- =============================================

INSERT INTO inquilinos (nombre_completo, dni, telefono, num_depa) VALUES
('Juan Pérez García', '12345678', '987654321', 1),
('María López Rodríguez', '87654321', '912345678', 2),
('Carlos Martínez Silva', '11223344', '998765432', 3)
ON CONFLICT (dni) DO NOTHING;

INSERT INTO catalogo_servicios (codigo, categoria, detalle, unidad_medida, precio_base) VALUES
('DRW01', 'Drywall', 'Tabiquería Drywall', 'm2', 45.00),
('TEJ01', 'Techo', 'Techo Falso', 'm2', 55.00),
('MEL01', 'Melamina', 'Melamina Blanca', 'Plancha', 85.00),
('PIN01', 'Pintura', 'Pintura Latex', 'm2', 15.00),
('ELE01', 'Electricidad', 'Punto Eléctrico', 'Punto', 80.00),
('GAS01', 'Gasfiteria', 'Punto Gasfitería', 'Punto', 100.00),
('ENC01', 'Enchape', 'Enchape Cerámico', 'm2', 35.00)
ON CONFLICT (codigo) DO NOTHING;

-- =============================================
-- FIN DEL SCRIPT SQL
-- =============================================
