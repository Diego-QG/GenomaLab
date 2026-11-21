// Exportar la tabla y el gráfico de Experimentos como PNG, sin dependencias:
// se dibuja todo con la API Canvas 2D (con la misma geometría que el SVG de la
// pantalla) y se descarga con un <a download> temporal. En Electron eso abre el
// diálogo "Guardar como".

import { entero } from '@/lib/formato'
import {
  COLOR_METODO,
  METODOS,
  NOMBRE_METODO,
  casillasDe,
  conDecimales,
  esFinito,
  geometriaDePanel,
  vecesEntreKs,
  type PanelK,
} from './modelo'

// Colores del tema (los mismos de estilos/global.css), escritos aquí porque el
// lienzo no entiende las variables CSS.
const C = {
  fondo: '#0b0c14',
  superficie: '#12141f',
  linea: '#262a3c',
  lineaFuerte: '#3a3f58',
  tinta: '#eceef6',
  tinta2: '#a9aec4',
  tinta3: '#747a94',
  bien: '#31e4ac',
  mal: '#e5433d',
}

const SANS = '"Archivo Variable", "Segoe UI", system-ui, sans-serif'
const MONO = '"Martian Mono Variable", "Cascadia Mono", Consolas, monospace'

/** Tamaño de la imagen en píxeles lógicos; se dibuja al doble para que se vea nítida. */
const ANCHO = 1200
const ALTO = 780
const ESCALA = 2
const MARGEN = 40

export interface DatosLamina {
  paneles: PanelK[]
  /** Nombre del FASTA analizado, si se conoce. */
  archivo: string | null
}

type Ctx = CanvasRenderingContext2D

function fuente(ctx: Ctx, tamano: number, peso = 400, mono = false): void {
  ctx.font = `${peso} ${tamano}px ${mono ? MONO : SANS}`
}

function texto(ctx: Ctx, t: string, x: number, y: number, color: string, alineacion: CanvasTextAlign = 'left'): void {
  ctx.fillStyle = color
  ctx.textAlign = alineacion
  ctx.fillText(t, x, y)
}

function tarjeta(ctx: Ctx, x: number, y: number, ancho: number, alto: number): void {
  ctx.beginPath()
  ctx.roundRect(x + 0.5, y + 0.5, ancho - 1, alto - 1, 12)
  ctx.fillStyle = C.superficie
  ctx.fill()
  ctx.strokeStyle = C.linea
  ctx.lineWidth = 1
  ctx.stroke()
}

function linea(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, discontinua?: number[]): void {
  ctx.beginPath()
  ctx.setLineDash(discontinua ?? [])
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.setLineDash([])
}

function punto(ctx: Ctx, x: number, y: number, r: number, color: string, opacidad = 1): void {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.globalAlpha = opacidad
  ctx.fillStyle = color
  ctx.fill()
  ctx.globalAlpha = 1
}

// ── Tabla ────────────────────────────────────────────────────────────────────

/** Dibuja la tabla de resultados y devuelve dónde termina. */
function dibujarTabla(ctx: Ctx, paneles: PanelK[], x: number, y: number, ancho: number): number {
  const FILA = 36
  const CABEZA_1 = 28
  const CABEZA_2 = 26
  const alto = CABEZA_1 + CABEZA_2 + FILA * paneles.length + 6
  tarjeta(ctx, x, y, ancho, alto)

  // Columnas: k, virus, carga, lineal (total, promedio), doble (total, promedio), reducción
  const fijo = [70, 70, 120]
  const anchoReduccion = 150
  const resto = (ancho - fijo.reduce((a, b) => a + b, 0) - anchoReduccion) / 4
  const anchos = [...fijo, resto, resto, resto, resto, anchoReduccion]
  const bordes: number[] = [x]
  for (const a of anchos) bordes.push(bordes[bordes.length - 1] + a)
  const PAD = 16
  const derechaDe = (i: number): number => bordes[i + 1] - PAD

  // Primera fila de la cabecera: los dos métodos
  fuente(ctx, 12)
  METODOS.forEach((metodo, m) => {
    const col = 3 + m * 2
    punto(ctx, bordes[col] + PAD + 4, y + 19 - 4, 4, COLOR_METODO[metodo])
    texto(ctx, NOMBRE_METODO[metodo], bordes[col] + PAD + 14, y + 19, C.tinta2)
    linea(ctx, bordes[col], y + 8, bordes[col], y + alto - 8, C.linea)
  })
  linea(ctx, bordes[7], y + 8, bordes[7], y + alto - 8, C.linea)

  // Segunda fila de la cabecera
  const yCabeza = y + CABEZA_1 + 17
  fuente(ctx, 11.5)
  texto(ctx, 'k', bordes[0] + PAD, yCabeza, C.tinta3)
  texto(ctx, 'Virus', derechaDe(1), yCabeza, C.tinta3, 'right')
  texto(ctx, 'Factor de carga', derechaDe(2), yCabeza, C.tinta3, 'right')
  for (let m = 0; m < METODOS.length; m++) {
    texto(ctx, 'Colisiones totales', derechaDe(3 + m * 2), yCabeza, C.tinta3, 'right')
    texto(ctx, 'Promedio por virus', derechaDe(4 + m * 2), yCabeza, C.tinta3, 'right')
  }
  texto(ctx, 'Reducción', derechaDe(7), yCabeza, C.tinta3, 'right')
  linea(ctx, x, y + CABEZA_1 + CABEZA_2, x + ancho, y + CABEZA_1 + CABEZA_2, C.linea)

  paneles.forEach((p, i) => {
    const yFila = y + CABEZA_1 + CABEZA_2 + FILA * i + 23
    if (i > 0) linea(ctx, x + 8, yFila - 23, x + ancho - 8, yFila - 23, C.linea)
    fuente(ctx, 14, 640)
    texto(ctx, `k = ${p.k}`, bordes[0] + PAD, yFila, C.tinta)
    fuente(ctx, 12.5, 400, true)
    texto(ctx, p.virus > 0 ? entero(p.virus) : '—', derechaDe(1), yFila, C.tinta2, 'right')
    texto(ctx, esFinito(p.carga) ? p.carga.toFixed(4) : '—', derechaDe(2), yFila, C.tinta2, 'right')
    METODOS.forEach((metodo, m) => {
      texto(ctx, entero(p[metodo].total), derechaDe(3 + m * 2), yFila, C.tinta, 'right')
      texto(ctx, conDecimales(p[metodo].promedio), derechaDe(4 + m * 2), yFila, C.tinta2, 'right')
    })
    fuente(ctx, 12.5, 700, true)
    texto(ctx, esFinito(p.reduccion) ? `${conDecimales(p.reduccion)} %` : '—', derechaDe(7), yFila, !esFinito(p.reduccion) ? C.tinta3 : p.reduccion >= 0 ? C.bien : C.mal, 'right')
  })

  return y + alto
}

// ── Paneles ──────────────────────────────────────────────────────────────────

function dibujarPanel(ctx: Ctx, panel: PanelK, x: number, y: number, ancho: number, alto: number): void {
  tarjeta(ctx, x, y, ancho, alto)
  const PAD = 18

  fuente(ctx, 16, 640)
  texto(ctx, `k = ${panel.k}`, x + PAD, y + 28, C.tinta)
  fuente(ctx, 11)
  texto(ctx, `Tablas de ${entero(casillasDe(panel.k))} casillas · escala propia`, x + PAD, y + 46, C.tinta3)
  if (esFinito(panel.reduccion)) {
    const menos = panel.reduccion >= 0
    fuente(ctx, 20, 700, true)
    texto(ctx, `${conDecimales(Math.abs(panel.reduccion), 1)} %`, x + ancho - PAD, y + 31, menos ? C.bien : C.mal, 'right')
    fuente(ctx, 11)
    texto(ctx, menos ? 'menos colisiones con doble hashing' : 'más colisiones con doble hashing', x + ancho - PAD, y + 47, C.tinta3, 'right')
  }

  const arriba = y + 62
  const g = geometriaDePanel(panel, ancho - 2 * PAD, alto - (arriba - y) - 10)
  ctx.save()
  ctx.translate(x + PAD, arriba)

  fuente(ctx, 10, 400, true)
  for (const m of g.marcas) {
    const esBase = Math.abs(m.y - g.base) < 0.5
    linea(ctx, g.izquierda, m.y, g.derecha, m.y, C.linea, esBase ? undefined : [2, 3])
    texto(ctx, m.texto, g.izquierda - 8, m.y + 3.5, C.tinta3, 'right')
  }
  linea(ctx, g.izquierda, g.base, g.derecha, g.base, C.lineaFuerte)

  if (g.fantasma) {
    const f = g.fantasma
    ctx.beginPath()
    ctx.roundRect(f.x + 0.5, f.y + 0.5, Math.max(0, f.ancho - 1), Math.max(0, f.alto - 1), 2)
    ctx.globalAlpha = 0.05
    ctx.fillStyle = COLOR_METODO.lineal
    ctx.fill()
    ctx.globalAlpha = 0.7
    ctx.setLineDash([3, 3])
    ctx.strokeStyle = COLOR_METODO.lineal
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1
  }

  for (const c of g.columnas) {
    if (c.barra) {
      ctx.beginPath()
      ctx.roundRect(c.barra.x, c.barra.y, c.barra.ancho, c.barra.alto, 2)
      ctx.fillStyle = c.color
      ctx.fill()
    }
    for (const p of c.puntos) punto(ctx, p.x, p.y, g.radioPunto, c.color, 0.55)
    if (c.etiqueta) {
      fuente(ctx, 11, 700, true)
      texto(ctx, c.etiqueta.texto, c.etiqueta.x, c.etiqueta.y, C.tinta, 'center')
    }
    fuente(ctx, 12)
    texto(ctx, c.nombre, c.centro, g.yNombre, C.tinta2, 'center')
  }

  if (g.reduccion) {
    fuente(ctx, 11, 700, true)
    texto(ctx, g.reduccion.texto, g.reduccion.x, g.reduccion.y, C.bien, 'center')
  }
  ctx.restore()
}

/** Leyenda de una línea: cuadro de color + texto, uno tras otro. */
function dibujarLeyenda(ctx: Ctx, datos: DatosLamina, x: number, y: number): void {
  fuente(ctx, 12)
  let cursor = x
  const anotar = (dibujo: () => void, t: string): void => {
    dibujo()
    texto(ctx, t, cursor + 16, y, C.tinta2)
    cursor += 16 + ctx.measureText(t).width + 22
  }
  anotar(() => {
    ctx.fillStyle = COLOR_METODO.lineal
    ctx.fillRect(cursor, y - 10, 5, 11)
    ctx.fillStyle = COLOR_METODO.doble
    ctx.fillRect(cursor + 6, y - 10, 5, 11)
  }, 'barra: promedio de colisiones por virus')
  const virus = Math.max(0, ...datos.paneles.map((p) => p.virus))
  if (virus > 0) {
    anotar(() => {
      punto(ctx, cursor + 3, y - 4, 2.4, C.tinta2, 0.8)
      punto(ctx, cursor + 9, y - 6, 2.4, C.tinta2, 0.8)
    }, `punto: cada uno de los ${entero(virus)} virus`)
  }
  anotar(() => {
    ctx.setLineDash([3, 2])
    ctx.strokeStyle = COLOR_METODO.lineal
    ctx.strokeRect(cursor + 0.5, y - 10.5, 11, 11)
    ctx.setLineDash([])
  }, 'punteado: hasta dónde llegaba el sondeo lineal')

  const veces = vecesEntreKs(datos.paneles)
  if (esFinito(veces) && veces > 1 && datos.paneles.length >= 2) {
    const primero = datos.paneles[0].k
    const ultimo = datos.paneles[datos.paneles.length - 1].k
    texto(
      ctx,
      `Cada panel tiene su propia escala: con k = ${primero} el sondeo lineal choca ${veces.toFixed(1)} veces más que con k = ${ultimo}.`,
      x,
      y + 22,
      C.tinta3,
    )
  }
}

async function cargarFuentes(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`640 24px ${SANS}`),
      document.fonts.load(`400 12px ${SANS}`),
      document.fonts.load(`700 12px ${MONO}`),
      document.fonts.load(`400 12px ${MONO}`),
    ])
  } catch {
    // Si una fuente no carga, se dibuja con la de reserva
  }
}

/** Dibuja la lámina completa en un lienzo nuevo. */
export async function dibujarLamina(datos: DatosLamina): Promise<HTMLCanvasElement> {
  await cargarFuentes()
  const lienzo = document.createElement('canvas')
  lienzo.width = ANCHO * ESCALA
  lienzo.height = ALTO * ESCALA
  const ctx = lienzo.getContext('2d')
  if (!ctx) throw new Error('El lienzo no está disponible.')
  ctx.scale(ESCALA, ESCALA)
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = C.fondo
  ctx.fillRect(0, 0, ANCHO, ALTO)

  const ancho = ANCHO - 2 * MARGEN
  fuente(ctx, 11.5, 500)
  texto(ctx, 'GENOMA LAB · EXPERIMENTOS', MARGEN, 40, C.tinta3)
  fuente(ctx, 24, 640)
  texto(ctx, 'Colisiones: sondeo lineal vs doble hashing', MARGEN, 70, C.tinta)
  fuente(ctx, 13)
  const virus = Math.max(0, ...datos.paneles.map((p) => p.virus))
  const partes = [
    datos.archivo,
    virus > 0 ? `${entero(virus)} virus` : null,
    'colisiones al contar los k-mers de cada virus con los dos métodos',
  ].filter((p): p is string => Boolean(p))
  texto(ctx, partes.join(' · '), MARGEN, 94, C.tinta2)

  const finTabla = dibujarTabla(ctx, datos.paneles, MARGEN, 114, ancho)

  const arribaPaneles = finTabla + 20
  const abajoPaneles = ALTO - 66
  const n = Math.max(1, datos.paneles.length)
  const separacion = 20
  const anchoPanel = (ancho - separacion * (n - 1)) / n
  datos.paneles.forEach((p, i) => {
    dibujarPanel(ctx, p, MARGEN + i * (anchoPanel + separacion), arribaPaneles, anchoPanel, abajoPaneles - arribaPaneles)
  })

  dibujarLeyenda(ctx, datos, MARGEN, ALTO - 40)
  return lienzo
}

/** Dibuja la lámina y la descarga como experimentos.png. */
export async function exportarPng(datos: DatosLamina): Promise<void> {
  const lienzo = await dibujarLamina(datos)
  const imagen = await new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, 'image/png'))
  if (!imagen) throw new Error('No se pudo crear la imagen PNG.')

  const url = URL.createObjectURL(imagen)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = 'experimentos.png'
  enlace.style.display = 'none'
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  // El diálogo "Guardar como" puede quedar abierto un rato: se libera la URL mucho después
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
}
