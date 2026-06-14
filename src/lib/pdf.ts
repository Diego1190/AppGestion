// ============================================================
// pdf.ts — Generacion de PDFs
// Importa config desde lib/config (no desde pages)
// ============================================================
import jsPDF from 'jspdf'
import { MovimientoDepa, Cotizacion, CotizacionDetalle, CotizacionInsumo } from '../types/index'
import { getConfig } from './config'   // ← lib/config, no pages/

// ── Paleta de colores ────────────────────────────────────────
type Color = [number, number, number]
const C = {
  blue800:  [30, 64,175] as Color,  blue600:  [37, 99,235] as Color,
  blue50:   [239,246,255] as Color, blue200:  [191,219,254] as Color,
  teal700:  [15,118,110] as Color,  teal600:  [13,148,136] as Color,
  teal50:   [240,253,250] as Color, teal200:  [153,246,228] as Color,
  amber800: [146,64,14] as Color,   amber600: [217,119,6] as Color,
  amber50:  [255,251,235] as Color,
  gray50:   [249,250,251] as Color, gray100:  [243,244,246] as Color,
  gray200:  [229,231,235] as Color, gray400:  [156,163,175] as Color,
  gray500:  [107,114,128] as Color, gray600:  [75,85,99] as Color,
  gray700:  [55,65,81] as Color,    gray900:  [17,24,39] as Color,
  green600: [22,163,74] as Color,   green50:  [240,253,244] as Color,
  orange:   [249,115,22] as Color,  red600:   [220,38,38] as Color,
  red50:    [254,242,242] as Color, white:    [255,255,255] as Color,
}

// ── Constantes de layout ─────────────────────────────────────
const W  = 210   // ancho pagina mm
const M  = 14    // margen izquierdo/derecho mm
const RX = W - M // borde derecho absoluto = 196mm

// ── Meses ────────────────────────────────────────────────────
const MC = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const ML = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto',
            'Septiembre','Octubre','Noviembre','Diciembre']

// ── Helpers de bajo nivel ────────────────────────────────────
const fmt = (f: string): string => {
  const d = new Date(f + 'T00:00:00')
  return [d.getDate(), d.getMonth()+1, d.getFullYear()]
    .map((n, i) => i < 2 ? String(n).padStart(2,'0') : n)
    .join('/')
}
const mon = (n: number): string => `S/ ${Number(n).toFixed(2)}`

/** Fecha de hoy en formato YYYY-MM-DD usando hora local Peru (UTC-5)
 *  new Date().toISOString() retorna UTC — a las 8pm Peru ya seria manana */
const localDateStr = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

/** Rellena un rectangulo */
const fillRect = (doc: jsPDF, x: number, y: number, w: number, h: number, c: Color) => {
  doc.setFillColor(...c); doc.rect(x, y, w, h, 'F')
}

/** Rectangulo redondeado con fondo opcional y borde opcional */
const roundRect = (
  doc: jsPDF, x: number, y: number, w: number, h: number, r: number,
  bg: Color, border?: Color,
) => {
  doc.setFillColor(...bg)
  if (border) { doc.setDrawColor(...border); doc.roundedRect(x,y,w,h,r,r,'FD') }
  else doc.roundedRect(x,y,w,h,r,r,'F')
}

/**
 * Dibuja texto con opciones explicitas.
 * Usar objeto de opciones evita confusion de parametros posicionales
 * (causa original del bug de alineacion).
 */
interface TxOpts {
  sz: number
  color: Color
  bold?: boolean
  align?: 'left' | 'center' | 'right'
}
const txt = (doc: jsPDF, text: string, x: number, y: number, o: TxOpts) => {
  doc.setFontSize(o.sz)
  doc.setFont(undefined, o.bold ? 'bold' : 'normal')
  doc.setTextColor(...o.color)
  doc.text(text, x, y, { align: o.align ?? 'left' })
}

/** Linea horizontal de margen a margen */
const hline = (doc: jsPDF, y: number, c: Color, lw = 0.25) => {
  doc.setDrawColor(...c); doc.setLineWidth(lw); doc.line(M, y, RX, y)
}

// ── Helpers de nivel medio ───────────────────────────────────

/** Header comun a todos los PDFs */
const drawHeader = (
  doc: jsPDF, bg: Color, accent: Color,
  title: string, subtitles: string[], rightLines: string[],
  h = 44,
) => {
  fillRect(doc, 0, 0, W, h, bg)
  doc.setFillColor(...accent); doc.triangle(0, 0, 80, 0, 0, h, 'F')
  txt(doc, title, M, 16, { sz: 19, color: C.white, bold: true })
  subtitles.forEach((s, i) => txt(doc, s, M, 25 + i * 7, { sz: 8.5, color: C.white }))
  rightLines.forEach((s, i) => txt(doc, s, RX, 18 + i * 8, { sz: i === 0 ? 11 : 7.5, color: C.white, bold: i === 0, align: 'right' }))
}

/** Fila de cabecera de tabla */
const tableHeader = (doc: jsPDF, y: number, cols: { label: string; x: number; align?: 'left'|'right' }[]) => {
  const TW = RX - M
  fillRect(doc, M, y, TW, 9, C.gray50)
  hline(doc, y, C.gray200)
  hline(doc, y + 9, C.gray200, 0.4)
  cols.forEach(col => txt(doc, col.label, col.x, y + 6, { sz: 7, color: C.gray500, bold: true, align: col.align ?? 'left' }))
}

/** Grafica de consumo historico */
const drawChart = (
  doc: jsPDF, ox: number, oy: number, cw: number, ch: number,
  series: { label: string; values: (number|null)[]; color: Color }[],
  labels: string[],
) => {
  const pl=28, pr=8, pt=16, pb=16
  const iw=cw-pl-pr, ih=ch-pt-pb, n=labels.length
  if (n < 2) return

  roundRect(doc, ox, oy, cw, ch, 2, C.gray50, C.gray200)
  const allV = series.flatMap(s => s.values).filter((v): v is number => v !== null && v > 0)
  const maxV = allV.length ? Math.max(...allV) * 1.2 : 10
  const px = (i: number) => ox + pl + (i / (n-1)) * iw
  const py = (v: number) => oy + pt + ih - (v / maxV) * ih

  // Grid
  for (let i=0; i<=3; i++) {
    const gy = py(maxV * i / 3)
    doc.setDrawColor(...C.gray200); doc.setLineWidth(0.2)
    doc.line(ox+pl, gy, ox+pl+iw, gy)
    txt(doc, maxV*i/3 > 0 ? (maxV*i/3).toFixed(0) : '0', ox+pl-3, gy+1.5, { sz: 5.5, color: C.gray400, align: 'right' })
  }
  labels.forEach((lb, i) => {
    txt(doc, lb, px(i), oy+pt+ih+8, { sz: 5.5, color: C.gray500, align: 'center' })
    doc.setDrawColor(...C.gray200); doc.setLineWidth(0.2)
    doc.line(px(i), oy+pt+ih, px(i), oy+pt+ih+2)
  })

  // Series
  series.forEach(s => {
    const hasData = s.values.some(v => v !== null && v > 0)
    if (!hasData) return
    doc.setDrawColor(...s.color); doc.setLineWidth(0.8)
    let prevI = -1
    s.values.forEach((v, i) => {
      if (v !== null && v > 0) {
        if (prevI >= 0 && (s.values[prevI] as number) > 0)
          doc.line(px(prevI), py(s.values[prevI] as number), px(i), py(v))
        prevI = i
      }
    })
    doc.setFillColor(...s.color)
    s.values.forEach((v, i) => { if (v !== null && v > 0) doc.circle(px(i), py(v), 1.2, 'F') })
  })

  // Leyenda
  let lx = ox + pl
  series.forEach(s => {
    if (!s.values.some(v => v !== null && v > 0)) return
    doc.setFillColor(...s.color); doc.rect(lx, oy+6, 7, 3, 'F')
    txt(doc, s.label, lx+9, oy+8.5, { sz: 6, color: C.gray600 })
    lx += 28
  })
  doc.setLineWidth(0.2)
}

/** Pie de pagina estandar */
const drawFooter = (doc: jsPDF) => {
  txt(doc, 'Documento generado por WebApp Gestion Integral', W/2, 289,
    { sz: 6.5, color: C.gray400, align: 'center' })
}

// ============================================================
// RECIBO DE ALQUILER
// ============================================================
export const generarPDFRecibo = async (
  departamento: number, inquilino: string, telefono: string,
  mes: number, anio: number,
  movimientos: MovimientoDepa[],
  historial: { mes: number; anio: number; tipo_servicio: string; consumo: number|null; importe_pagar: number }[],
): Promise<void> => {
  const cfg = getConfig()
  const doc = new jsPDF()
  const TW  = RX - M

  const total     = movimientos.reduce((s, m) => s + Number(m.importe_pagar), 0)
  const pagadoAmt = movimientos.filter(m => m.estado === 'Pagado').reduce((s, m) => s + Number(m.importe_pagar), 0)
  const pendiente = total - pagadoAmt

  // Header — altura 38mm
  fillRect(doc, 0, 0, W, 38, C.blue800)
  doc.setFillColor(...C.blue600); doc.triangle(0, 0, 75, 0, 0, 38, 'F')
  txt(doc, 'RECIBO DE SERVICIOS', M, 14, { sz: 20, color: C.white, bold: true })
  txt(doc, `${ML[mes-1]} ${anio}`,  M, 24, { sz: 13, color: C.white, bold: true })
  txt(doc, `Emitido: ${fmt(localDateStr())}`, M, 31, { sz: 8, color: C.blue200 })
  if (cfg.empresa_nombre)   txt(doc, cfg.empresa_nombre,           RX, 15, { sz: 8,   color: C.blue200, align: 'right' })
  if (cfg.empresa_ruc)      txt(doc, `RUC: ${cfg.empresa_ruc}`,    RX, 22, { sz: 7.5, color: C.blue200, align: 'right' })
  if (cfg.empresa_telefono) txt(doc, cfg.empresa_telefono,         RX, 29, { sz: 7.5, color: C.blue200, align: 'right' })

  // Cards info
  let y = 44
  const cW = Math.floor((TW - 6) / 2)

  // Misma altura maxima que card Total para alinear correctamente
  roundRect(doc, M, y, cW, 34, 3, C.blue50, C.blue200)
  txt(doc, 'INQUILINO', M+5, y+7, { sz: 7, color: C.blue800, bold: true })
  txt(doc, inquilino,   M+5, y+15, { sz: 10, color: C.gray900, bold: true })
  txt(doc, `Depa. ${departamento}${telefono ? ` · Tel: ${telefono}` : ''}`, M+5, y+22, { sz: 8, color: C.gray500 })

  // Card Total — altura dinamica: mayor cuando hay pendiente
  const cardH  = pendiente > 0 ? 34 : 28
  const cardX  = M + cW + 6
  const cardCX = cardX + cW / 2   // centro horizontal del card

  roundRect(doc, cardX, y, cW, cardH, 3, C.white, C.gray200)

  // Label centrado
  txt(doc, 'TOTAL A PAGAR', cardCX, y+8, { sz: 7, color: C.gray500, bold: true, align: 'center' })

  // Monto centrado y grande
  txt(doc, mon(total), cardCX, y+20, { sz: 18, color: C.blue800, bold: true, align: 'center' })

  if (pendiente > 0) {
    // Linea divisora sutil
    doc.setDrawColor(...C.gray200); doc.setLineWidth(0.2)
    doc.line(cardX+6, y+24, cardX+cW-6, y+24)
    // Pagado (gris) | Pendiente (rojo) — sin recuadro
    txt(doc, 'Pagado ' + mon(pagadoAmt),      cardCX-2, y+30, { sz: 7, color: C.gray400, align: 'right' })
    txt(doc, '  Pendiente ' + mon(pendiente), cardCX+2, y+30, { sz: 7, color: C.red600,  bold: true })
  } else {
    txt(doc, 'Todo pagado', cardCX, y+26, { sz: 7.5, color: C.green600, bold: true, align: 'center' })
  }

  // Tabla de movimientos
  y += cardH + 6
  const CX = { concept: M+4, vcto: 64, consumo: 119, tarifa: 149, monto: 174, estado: RX }
  tableHeader(doc, y, [
    { label: 'CONCEPTO',    x: CX.concept },
    { label: 'VENCIMIENTO', x: CX.vcto    },
    { label: 'CONSUMO',     x: CX.consumo, align: 'right' },
    { label: 'TARIFA',      x: CX.tarifa,  align: 'right' },
    { label: 'MONTO',       x: CX.monto,   align: 'right' },
    { label: 'ESTADO',      x: CX.estado,  align: 'right' },
  ])
  y += 9

  movimientos.forEach((mov, idx) => {
    const rh  = 10
    const esM = ['Luz','Agua','Gas'].includes(mov.tipo_servicio)
    const pag = mov.estado === 'Pagado'
    if (idx % 2 === 1) fillRect(doc, M, y, TW, rh, C.gray50)

    txt(doc, mov.tipo_servicio,          CX.concept, y+6.8, { sz: 9,   color: C.gray700, bold: true })
    txt(doc, fmt(mov.fecha_vencimiento), CX.vcto,    y+6.8, { sz: 8.5, color: C.gray600 })

    if (esM && mov.consumo != null) {
      const u = mov.tipo_servicio === 'Luz' ? 'kWh' : 'm3'
      txt(doc, `${Number(mov.consumo).toFixed(2)} ${u}`, CX.consumo, y+6.8, { sz: 8, color: C.gray700, align: 'right' })
    } else {
      txt(doc, '--', CX.consumo, y+6.8, { sz: 8, color: C.gray400, align: 'right' })
    }

    if (esM && mov.tarifa != null) {
      txt(doc, mon(mov.tarifa), CX.tarifa, y+6.8, { sz: 8, color: C.gray700, align: 'right' })
    } else {
      txt(doc, '--', CX.tarifa, y+6.8, { sz: 8, color: C.gray400, align: 'right' })
    }

    txt(doc, mon(mov.importe_pagar),          CX.monto,  y+6.8, { sz: 9,   color: C.gray900, bold: true,  align: 'right' })
    txt(doc, pag ? 'PAGADO' : 'PENDIENTE',    CX.estado, y+6.8, { sz: 7,   color: pag ? C.green600 : C.orange, bold: true, align: 'right' })

    y += rh; hline(doc, y, C.gray100)
  })

  // Fila total — "Total:" right-aligned en CX.tarifa, monto right-aligned en RX
  // Separacion garantizada: tarifa=149 (fin) vs monto inicio ~166 = 17mm de margen
  fillRect(doc, M, y, TW, 10, C.gray50); hline(doc, y, C.gray200)
  txt(doc, 'Total:', CX.tarifa, y+7, { sz: 8.5, color: C.gray600, bold: true, align: 'right' })
  txt(doc, mon(total), RX,      y+7, { sz: 12,  color: C.blue800, bold: true, align: 'right' })
  hline(doc, y+10, C.gray200); y += 15

  // Historial de consumo — 6 meses relativos al recibo
  // Ej: recibo Enero 2026 → Ago 2025, Sep 2025, Oct 2025, Nov 2025, Dic 2025, Ene 2026
  //     recibo Junio 2026 → Ene 2026, Feb 2026, Mar 2026, Abr 2026, May 2026, Jun 2026
  // DEPENDENCIA: getHistorialConsumo en alquileres.ts debe usar order DESCENDING
  // para retornar los registros mas recientes (ver fix en alquileres.ts)
  const CSERV: Record<string, Color> = { Luz: [234,179,8], Agua: [6,182,212], Gas: [249,115,22] }

  // Calcular los 6 meses objetivo del recibo (el propio mes + 5 anteriores)
  const targets: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(anio, mes - 1 - i, 1)
    targets.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
  }
  const labels6 = targets.map(k => {
    const [yr, mo] = k.split('-')
    return `${MC[parseInt(mo)-1]} ${yr.slice(-2)}`
  })

  // Solo incluir servicios que tienen datos reales en ese periodo
  const serviciosConDatos = ['Luz','Agua','Gas'].filter(s =>
    targets.some(k => {
      const [yr, mo] = k.split('-')
      return historial.some(h =>
        h.tipo_servicio === s &&
        h.anio === parseInt(yr) &&
        h.mes === parseInt(mo) &&
        h.consumo != null &&
        Number(h.consumo) > 0
      )
    })
  )

  if (serviciosConDatos.length > 0) {
    txt(doc, 'Historial de Consumo', M, y+6, { sz: 9, color: C.gray700, bold: true }); y += 11
    drawChart(doc, M, y, TW, 52, serviciosConDatos.map(s => ({
      label:  s,
      color:  CSERV[s],
      values: targets.map(k => {
        const [yr, mo] = k.split('-')
        const h = historial.find(h =>
          h.tipo_servicio === s &&
          h.anio === parseInt(yr) &&
          h.mes === parseInt(mo)
        )
        return h?.consumo != null && Number(h.consumo) > 0 ? Number(h.consumo) : null
      }),
    })), labels6)
    y += 58
  }

  // Cuentas bancarias
  const cuentas = [
    cfg.banco1_numero ? `${cfg.banco1_nombre}: ${cfg.banco1_numero}` : null,
    cfg.banco2_numero ? `${cfg.banco2_nombre}: ${cfg.banco2_numero}` : null,
    cfg.yape_numero   ? `Yape / Plin: ${cfg.yape_numero}`           : null,
  ].filter(Boolean) as string[]

  if (cuentas.length) {
    y += 4
    roundRect(doc, M, y, TW, 10 + cuentas.length * 7, 2, C.gray50, C.gray200)
    txt(doc, 'Cuentas para deposito:', M+4, y+7, { sz: 8, color: C.gray700, bold: true })
    cuentas.forEach((c, i) => txt(doc, `- ${c}`, M+4, y+14+i*7, { sz: 8.5, color: C.gray600 }))
  }

  drawFooter(doc)
  doc.save(`recibo-dpto${departamento}-${ML[mes-1]}-${anio}.pdf`)
}

// ============================================================
// COTIZACION
// ============================================================
export const generarPDFCotizacion = async (
  cotizacion: Cotizacion, detalles: CotizacionDetalle[],
): Promise<void> => {
  const cfg = getConfig()
  const doc = new jsPDF()
  const TW  = RX - M

  // ── HEADER personalizado (no usa drawHeader generico) ──────
  // Estructura: titulo + empresa izquierda | N°COTIZACION label arriba + numero abajo
  const headerH = 50
  fillRect(doc, 0, 0, W, headerH, C.teal700)
  doc.setFillColor(...C.teal600); doc.triangle(0, 0, 80, 0, 0, headerH, 'F')

  // Izquierda: titulo, empresa, RUC, telefono
  txt(doc, 'COTIZACION DE SERVICIOS', M, 16, { sz: 19, color: C.white, bold: true })
  let subY = 25
  if (cfg.empresa_nombre)   { txt(doc, cfg.empresa_nombre,              M, subY, { sz: 8.5, color: C.white }); subY += 7 }
  if (cfg.empresa_ruc)      { txt(doc, `RUC: ${cfg.empresa_ruc}`,       M, subY, { sz: 8,   color: C.white }); subY += 7 }
  if (cfg.empresa_telefono) { txt(doc, `Tel: ${cfg.empresa_telefono}`,  M, subY, { sz: 8,   color: C.white }) }

  // Derecha: label "N° COTIZACION" arriba, numero abajo (INTERCAMBIADO)
  txt(doc, 'N COTIZACION',           RX, 18, { sz: 7.5, color: C.teal200, align: 'right' })
  txt(doc, cotizacion.correlativo,   RX, 27, { sz: 13,  color: C.white, bold: true, align: 'right' })

  // Emitida/Vigente debajo del correlativo (dentro del header)
  txt(doc,
    `Emitida: ${fmt(cotizacion.fecha_emision)}   Vigente: ${fmt(cotizacion.fecha_vencimiento)}`,
    RX, 37, { sz: 7.5, color: C.teal200, align: 'right' }
  )

  // ── CARDS CLIENTE / PROYECTO ───────────────────────────────
  let y = headerH + 8
  const cW = Math.floor((TW - 6) / 2)
  const cliLines = [cotizacion.cliente_nombre, cotizacion.cliente_empresa, cotizacion.cliente_telefono].filter(Boolean)
  const proLines = [cotizacion.proyecto_nombre, cotizacion.proyecto_direccion, cotizacion.proyecto_distrito].filter(Boolean)
  const cardH    = Math.max(28, 16 + Math.max(cliLines.length, proLines.length) * 7)

  roundRect(doc, M, y, cW, cardH, 3, C.teal50, C.teal200)
  txt(doc, 'CLIENTE', M+5, y+7, { sz: 7, color: C.teal700, bold: true })
  let cyL = y + 15
  cliLines.forEach((line, i) => {
    txt(doc, line!, M+5, cyL, { sz: i === 0 ? 10 : 8, color: i === 0 ? C.gray900 : C.gray500, bold: i === 0 })
    cyL += i === 0 ? 7 : 6
  })

  roundRect(doc, M+cW+6, y, cW, cardH, 3, C.white, C.gray200)
  txt(doc, 'PROYECTO', M+cW+11, y+7, { sz: 7, color: C.gray500, bold: true })
  let cyR = y + 15
  proLines.forEach((line, i) => {
    txt(doc, line!, M+cW+11, cyR, { sz: i === 0 ? 10 : 8, color: i === 0 ? C.gray900 : C.gray500, bold: i === 0 })
    cyR += i === 0 ? 7 : 6
  })

  y += cardH + 6

  // ── TABLA DETALLES ─────────────────────────────────────────
  const CC = { desc: M+4, cant: 124, punit: 152, total: RX-4 }
  tableHeader(doc, y, [
    { label: 'DESCRIPCION', x: CC.desc },
    { label: 'CANT.',       x: CC.cant,  align: 'right' },
    { label: 'P. UNIT.',    x: CC.punit, align: 'right' },
    { label: 'TOTAL',       x: CC.total, align: 'right' },
  ])
  y += 9

  detalles.forEach((d, idx) => {
    if (y > 250) { doc.addPage(); y = 20 }
    if (idx % 2 === 1) fillRect(doc, M, y, TW, 10, C.gray50)
    const desc = doc.splitTextToSize(d.descripcion, 104)
    doc.setFontSize(9); doc.setFont(undefined,'normal'); doc.setTextColor(...C.gray700)
    doc.text(desc, CC.desc, y+6.5)
    txt(doc, d.cantidad.toFixed(2),   CC.cant,  y+6.5, { sz: 9,   color: C.gray600, align: 'right' })
    txt(doc, mon(d.precio_unitario),  CC.punit, y+6.5, { sz: 9,   color: C.gray600, align: 'right' })
    txt(doc, mon(d.total_item),       CC.total, y+6.5, { sz: 9.5, color: C.gray900, bold: true, align: 'right' })
    if (desc.length > 1) y += (desc.length - 1) * 5
    hline(doc, y+10, C.gray100); y += 10
  })

  // Fila total
  fillRect(doc, M, y, TW, 10, C.gray50); hline(doc, y, C.gray200)
  txt(doc, 'Total:',                    CC.punit-4, y+7, { sz: 8.5, color: C.gray600, bold: true, align: 'right' })
  txt(doc, mon(cotizacion.monto_total), CC.total,   y+7, { sz: 12,  color: C.teal700, bold: true, align: 'right' })
  hline(doc, y+10, C.gray200); y += 16

  // ── SECCIONES INFERIORES: tiempo, condiciones, cuentas ─────
  // Helper para dibujar un card de seccion
  const drawSectionCard = (
    label: string, lines: string[], accentColor: Color = C.gray700,
  ) => {
    const cardLines = lines.flatMap(l => doc.splitTextToSize(l, TW - 10) as string[])
    const cardHeight = 10 + cardLines.length * 6 + 4
    if (y + cardHeight > 285) { doc.addPage(); y = 14 }
    roundRect(doc, M, y, TW, cardHeight, 2, C.gray50, C.gray200)
    txt(doc, label, M+5, y+8, { sz: 8, color: accentColor, bold: true })
    cardLines.forEach((line, i) => {
      txt(doc, line, M+5, y+15+i*6, { sz: 8.5, color: C.gray600 })
    })
    y += cardHeight + 5
  }

  // 1. Tiempo estimado (de facilidades_cliente) — PRIMERO
  if (cotizacion.facilidades_cliente?.trim()) {
    drawSectionCard('Tiempo Estimado / Notas', [cotizacion.facilidades_cliente], C.teal700)
  }

  // 2. Condiciones del Servicio — SEGUNDO
  if (cotizacion.condiciones_pago?.trim()) {
    const condLines = cotizacion.condiciones_pago.split('\n').filter(Boolean)
    drawSectionCard('Condiciones del Servicio', condLines, C.gray700)
  }

  // 3. Cuentas bancarias — AL FINAL
  const cuentas = [
    cfg.banco1_numero ? `${cfg.banco1_nombre}: ${cfg.banco1_numero}` : null,
    cfg.banco2_numero ? `${cfg.banco2_nombre}: ${cfg.banco2_numero}` : null,
    cfg.yape_numero   ? `Yape / Plin: ${cfg.yape_numero}`           : null,
  ].filter(Boolean) as string[]

  if (cuentas.length) {
    drawSectionCard('Cuentas para deposito', cuentas.map(c => `- ${c}`), C.blue800)
  }

  drawFooter(doc)
  doc.save(`cotizacion-${cotizacion.correlativo}.pdf`)
}

// ============================================================
// LISTA DE INSUMOS
// ============================================================
export const generarPDFInsumos = async (
  cotizacion: Cotizacion, insumos: CotizacionInsumo[],
): Promise<void> => {
  const doc  = new jsPDF()
  const TW   = RX - M
  const comp = insumos.filter(i => i.comprado).length
  const pct  = insumos.length ? Math.round((comp / insumos.length) * 100) : 0

  drawHeader(doc, C.amber800, C.amber600,
    'LISTA DE MATERIALES',
    [`Cot: ${cotizacion.correlativo}`,
     `Proyecto: ${cotizacion.proyecto_nombre || cotizacion.cliente_nombre}`,
     `Cliente: ${cotizacion.cliente_nombre}${cotizacion.cliente_telefono ? '  Tel: '+cotizacion.cliente_telefono : ''}`],
    [`${comp}/${insumos.length} items`, `${pct}% comprado`],
  )

  let y = 52
  const CI = { mat: M+4, cant: 126, unid: 150, estado: RX-4 }
  tableHeader(doc, y, [
    { label: 'MATERIAL',  x: CI.mat },
    { label: 'CANTIDAD',  x: CI.cant,   align: 'right' },
    { label: 'UNIDAD',    x: CI.unid },
    { label: 'ESTADO',    x: CI.estado, align: 'right' },
  ])
  y += 9

  insumos.forEach((ins, idx) => {
    if (y > 270) { doc.addPage(); y = 20 }
    if (idx % 2 === 1) fillRect(doc, M, y, TW, 10, C.amber50)
    txt(doc, ins.material_nombre,              CI.mat,    y+7, { sz: 9,   color: C.gray700, bold: true })
    txt(doc, ins.cantidad_estimada.toString(), CI.cant,   y+7, { sz: 8.5, color: C.gray600, align: 'right' })
    txt(doc, ins.unidad,                       CI.unid,   y+7, { sz: 8.5, color: C.gray500 })
    txt(doc, ins.comprado ? 'COMPRADO' : 'PENDIENTE', CI.estado, y+7,
      { sz: 7, color: ins.comprado ? C.green600 : C.orange, bold: true, align: 'right' })
    hline(doc, y+10, C.gray100); y += 10
  })

  // Resumen
  y += 6
  fillRect(doc, M, y, TW, 10, C.gray50); hline(doc, y, C.gray200)
  txt(doc, `Total: ${insumos.length} items   Comprados: ${comp}   Pendientes: ${insumos.length - comp}`,
    M+4, y+7, { sz: 8.5, color: C.gray600, bold: true })
  hline(doc, y+10, C.gray200)

  drawFooter(doc)
  doc.save(`insumos-${cotizacion.correlativo}.pdf`)
}
