// MÓDULO 1: ALQUILERES
export interface Inquilino {
  id: string
  nombre_completo: string
  dni: string
  telefono: string
  num_depa: number
  created_at: string
}

export interface Contrato {
  id: string
  inquilino_id: string
  tipo_contrato: 'Inicial' | 'Renovación'
  fecha_inicio: string
  meses_alquiler: number
  fecha_final: string
  importe_alquiler: number
  garantia: number | null
  activo: boolean
  motivo_cierre?: string
  fecha_cierre?: string
}

export interface MovimientoDepa {
  id: string
  num_depa: number
  tipo_servicio: 'Alquiler' | 'Luz' | 'Agua' | 'Internet' | 'Gas' | 'Otro'
  fecha_vencimiento: string
  mes: number
  anio: number
  lectura_anterior: number | null
  lectura_actual: number | null
  consumo: number | null
  tarifa: number | null
  importe_pagar: number
  estado: 'Pendiente' | 'Pagado'
}

// MÓDULO 2: COTIZACIONES
export interface CatalogoServicio {
  id: string
  codigo: string
  categoria: 'Drywall' | 'Techo' | 'Melamina' | 'Pintura' | 'Electricidad' | 'Gasfiteria' | 'Enchape'
  detalle: string
  unidad_medida: string
  precio_base: number
}

export interface Cotizacion {
  id: string
  correlativo: string
  fecha_emision: string
  fecha_vencimiento: string
  cliente_nombre: string
  cliente_telefono: string
  cliente_empresa: string | null
  proyecto_nombre: string
  proyecto_direccion: string
  proyecto_distrito: string
  condiciones_pago: string
  garantia: string
  facilidades_cliente: string
  porcentaje_desgaste: number
  monto_subtotal: number
  monto_desgaste_total: number
  monto_total: number
  /** Costo aproximado de materiales calculado al crear la cotización (no se recalcula después) */
  monto_materiales?: number
  estado?: 'Activa' | 'Completada' | 'Cancelada'
}

export interface CotizacionDetalle {
  id: string
  cotizacion_id: string
  servicio_codigo: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  total_item: number
}

export interface CotizacionInsumo {
  id: string
  cotizacion_id: string
  material_nombre: string
  cantidad_estimada: number
  unidad: string
  comprado: boolean
}

// MÓDULO 3: FINANZAS
export interface GastoPersonal {
  id: string
  concepto: string
  fecha_vencimiento: string
  monto: number
  estado: 'Pendiente' | 'Pagado'
}

export interface ControlVentaCasa {
  id: string
  fecha_pago: string
  mes: number
  anio: number
  monto_pagado: number
  entregado_a: 'Gabriel' | 'Fernando' | 'Tú'
}

export interface HistorialConsumo {
  mes: number
  anio: number
  tipo_servicio: string
  consumo: number | null
  importe_pagar: number
}
