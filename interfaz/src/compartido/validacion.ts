// ─────────────────────────────────────────────────────────────────────────────
//  Validación de las respuestas del motor contra el contrato (BRIEF, sección 5).
//
//  El motor en C++ se va completando poco a poco, así que una respuesta puede
//  llegar con { ok: true } pero sin algún campo. En vez de dejar que una pantalla
//  se caiga al leerlo, aquí se revisa cada respuesta campo por campo:
//
//   · Campo IMPRESCINDIBLE: sin él no hay nada que dibujar. La respuesta entera
//     se trata como error, con un mensaje que dice qué comando y qué campo faltó.
//   · Campo SUPLIBLE: se pone un valor neutro que la interfaz sabe mostrar
//     ("—" para números, lista vacía, null) y se avisa de qué faltó.
//   · Campo OPCIONAL: el contrato permite que no venga; no se avisa.
//
//  Nunca se inventan datos del dominio: un número que falta queda como NaN (se
//  muestra "—"), no como 0. Las únicas excepciones toman el valor de lo que la
//  interfaz pidió (el id o el k de los argumentos) o de lo que sí llegó (cuántos
//  virus vinieron en la lista).
// ─────────────────────────────────────────────────────────────────────────────

import type { Comandos, NombreComando } from './contrato'

// ── Esquemas ─────────────────────────────────────────────────────────────────

type Esquema =
  | { tipo: 'numero' }
  | { tipo: 'texto' }
  | { tipo: 'logico' }
  | { tipo: 'opciones'; valores: readonly string[] }
  /** `siInvalido` = 'descartar' quita el elemento; si no, se pone ese valor en su lugar. */
  | { tipo: 'lista'; de: Esquema; siInvalido: 'descartar' | { valor: unknown } }
  | { tipo: 'tupla'; de: readonly Esquema[] }
  | { tipo: 'objeto'; campos: Readonly<Record<string, Campo>> }
  /** El contrato permite null en este campo. */
  | { tipo: 'nulable'; de: Esquema }

/** Qué hacer si el campo falta o no tiene la forma esperada. */
type SiFalta =
  | { como: 'imprescindible' }
  | { como: 'opcional' }
  | { como: 'suplir'; valor: (contexto: Contexto) => unknown; explicacion: string }

interface Campo {
  esquema: Esquema
  siFalta: SiFalta
}

interface Contexto {
  /** Argumentos con los que se pidió el comando (después del nombre). */
  args: readonly string[]
  /** La respuesta tal como llegó. */
  respuesta: Record<string, unknown>
}

// Constructores cortos para que los esquemas de abajo se lean como el contrato.
const num: Esquema = { tipo: 'numero' }
const txt: Esquema = { tipo: 'texto' }
const bool: Esquema = { tipo: 'logico' }
const opciones = (...valores: string[]): Esquema => ({ tipo: 'opciones', valores })
const nulable = (de: Esquema): Esquema => ({ tipo: 'nulable', de })
const tupla = (...de: Esquema[]): Esquema => ({ tipo: 'tupla', de })
/** Lista de objetos: un elemento mal formado se descarta. */
const lista = (de: Esquema): Esquema => ({ tipo: 'lista', de, siInvalido: 'descartar' })
/** Lista de números: un número que falta queda como NaN (no se puede quitar sin correr las posiciones). */
const numeros: Esquema = { tipo: 'lista', de: num, siInvalido: { valor: Number.NaN } }
const matriz: Esquema = { tipo: 'lista', de: numeros, siInvalido: 'descartar' }

/** Un objeto cuyos campos son imprescindibles salvo que se diga otra cosa. */
function obj(campos: Record<string, Esquema | Campo>): Esquema {
  const normalizados: Record<string, Campo> = {}
  for (const [nombre, c] of Object.entries(campos)) {
    normalizados[nombre] = 'esquema' in c ? c : { esquema: c, siFalta: { como: 'imprescindible' } }
  }
  return { tipo: 'objeto', campos: normalizados }
}

const opcional = (esquema: Esquema): Campo => ({ esquema, siFalta: { como: 'opcional' } })

function suplir(esquema: Esquema, valor: (contexto: Contexto) => unknown, explicacion: string): Campo {
  return { esquema, siFalta: { como: 'suplir', valor, explicacion } }
}

// Reemplazos de uso común
const sinNumero = (esquema: Esquema = num): Campo => suplir(esquema, () => Number.NaN, 'se muestra «—»')
const listaVacia = (esquema: Esquema, explicacion = 'se muestra vacía'): Campo => suplir(esquema, () => [], explicacion)
const delArgumento = (indice: number, esquema: Esquema = txt): Campo =>
  suplir(
    esquema,
    ({ args }) => (esquema.tipo === 'numero' ? Number(args[indice]) : args[indice]),
    'se usa el valor que pidió la interfaz',
  )

const parKmer = obj({ kmer: txt, conteo: num })

/**
 * Forma de cada respuesta. El tipo `Record<NombreComando, …>` obliga a escribir
 * el esquema de cualquier comando nuevo que se agregue al contrato.
 */
const ESQUEMAS: Readonly<Record<NombreComando, Esquema>> = {
  resumen: obj({
    archivo: suplir(nulable(txt), () => null, 'se muestra el nombre del archivo cargado'),
    total: suplir(num, ({ respuesta }) => (Array.isArray(respuesta.virus) ? respuesta.virus.length : Number.NaN), 'se cuentan los virus que llegaron en «virus»'),
    tabla: suplir(
      nulable(
        obj({
          tamano: num,
          cantidad: sinNumero(),
          colisiones: sinNumero(),
          factorCarga: sinNumero(),
          redimensiones: listaVacia(lista(obj({ de: num, a: num, enInsercion: num })), 'no se dibuja la línea de redimensionamientos'),
          ocupadas: listaVacia(lista(obj({ pos: num, id: txt })), 'la tabla de Buscar se ve sin casillas ocupadas'),
        }),
      ),
      () => null,
      'no se muestra el resumen de la TablaVirus',
    ),
    virus: lista(
      obj({
        id: txt,
        grupo: suplir(txt, () => '?', 'se muestra «?»'),
        longitud: sinNumero(),
        gc: sinNumero(),
        ambiguas: sinNumero(),
      }),
    ),
  }),

  virus: obj({
    id: delArgumento(0),
    grupo: suplir(txt, () => '?', 'se muestra «?»'),
    longitud: sinNumero(),
    gc: sinNumero(),
    ambiguas: listaVacia(lista(obj({ pos: num, letra: txt })), 'no se marcan las bases ambiguas'),
    secuencia: txt,
  }),

  buscar: obj({
    id: delArgumento(0),
    hashPasos: lista(obj({ letra: txt, valor: txt })),
    hash: txt,
    tamano: num,
    inicio: num,
    pasos: lista(
      obj({
        pos: num,
        ocupada: bool,
        idEnCasilla: opcional(nulable(txt)),
        igual: opcional(bool),
      }),
    ),
    encontrado: bool,
    posFinal: num,
  }),

  kmers: obj({
    id: delArgumento(0),
    k: delArgumento(1, num),
    tamanoTabla: num,
    ventanas: sinNumero(),
    descartadas: sinNumero(),
    distintos: sinNumero(),
    colisiones: suplir(obj({ lineal: sinNumero(), doble: sinNumero() }), () => ({ lineal: Number.NaN, doble: Number.NaN }), 'se muestra «—»'),
    casillas: lista(obj({ pos: num, kmer: txt, conteo: num })),
    top: listaVacia(lista(parKmer)),
  }),

  trazakmers: obj({
    id: delArgumento(0),
    k: delArgumento(1, num),
    metodo: delArgumento(2, opciones('lineal', 'doble')),
    tamanoTabla: num,
    inserciones: lista(
      obj({
        ventana: sinNumero(),
        kmer: txt,
        // Una ventana descartada (k-mer con base ambigua) no trae hash, inicio ni paso
        hash: opcional(txt),
        inicio: opcional(num),
        paso: opcional(num),
        saltos: lista(
          obj({
            pos: num,
            kmerEnCasilla: suplir(nulable(txt), () => null, 'la casilla se dibuja vacía'),
            resultado: opciones('colision', 'nuevo', 'sumado', 'descartado'),
          }),
        ),
        conteoFinal: sinNumero(),
      }),
    ),
  }),

  heap: obj({
    id: delArgumento(0),
    k: delArgumento(1, num),
    n: delArgumento(2, num),
    operaciones: lista(
      obj({
        op: opciones('insertar', 'extraer'),
        par: parKmer,
        intercambios: lista(tupla(num, num)),
      }),
    ),
    top: listaVacia(lista(parKmer)),
  }),

  grafo: obj({
    id: delArgumento(0),
    nombres: lista(txt),
    parejas: sinNumero(),
    parejasInvalidas: sinNumero(),
    matriz: matriz,
    arcosEjemplo: listaVacia(
      lista(obj({ a: num, b: num, desde: txt, hasta: txt, distancia: num, peso: num })),
      'no se anima la construcción del grafo',
    ),
  }),

  comparar: obj({
    id1: delArgumento(0),
    id2: delArgumento(1),
    simKmers3: sinNumero(),
    simKmers6: sinNumero(),
    simGrafo: sinNumero(),
    diferenciaGrafo: listaVacia(matriz, 'no se dibuja la matriz de diferencias'),
  }),

  parecidos: obj({
    id: delArgumento(0),
    k: delArgumento(1, num),
    ranking: lista(obj({ id: txt, grupo: suplir(txt, () => '?', 'se muestra «?»'), simKmers: sinNumero(), simGrafo: sinNumero() })),
  }),

  similitudes: obj({
    k: delArgumento(0, num),
    ids: lista(txt),
    grupos: listaVacia(lista(txt), 'los puntos van sin color de grupo'),
    matriz: matriz,
  }),

  experimento: obj({
    resultados: lista(
      obj({
        k: num,
        metodo: opciones('lineal', 'doble'),
        colisionesTotal: sinNumero(),
        colisionesPromedio: sinNumero(),
        factorCargaPromedio: sinNumero(),
      }),
    ),
    porVirus: listaVacia(lista(obj({ id: txt, k: num, lineal: sinNumero(), doble: sinNumero() }))),
  }),
}

// ── Problemas encontrados ────────────────────────────────────────────────────

export type ConsecuenciaProblema = 'imprescindible' | 'suplido' | 'descartado'

/** Un campo que no llegó como dice el contrato (agrupado: `virus[].gc` cuenta una vez). */
export interface ProblemaDeCampo {
  /** Ruta del campo, con [] por cada lista: "tabla", "virus[].gc", "pasos[]". */
  ruta: string
  /**
   * 'falta' = no vino (o vino null donde no se permite); 'forma' = vino con otro tipo;
   * 'incompleto' = es el objeto o la lista esperada, pero le falta algo por dentro.
   */
  motivo: 'falta' | 'forma' | 'incompleto'
  /** Qué se esperaba, en palabras ("número", "lista", …). */
  esperado: string
  /** Qué llegó, si llegó algo ("texto", "null", …). */
  recibido?: string
  consecuencia: ConsecuenciaProblema
  /** Qué hace la interfaz al respecto ("se muestra «—»"). */
  explicacion?: string
  /** En cuántos elementos pasó (para rutas dentro de listas). */
  veces: number
  /** Para 'descartado': de cuántos elementos que tenía la lista. */
  deTotal?: number
}

export type ResultadoValidacion<C extends NombreComando> =
  | { valida: true; datos: Comandos[C]; problemas: ProblemaDeCampo[] }
  | { valida: false; mensaje: string; problemas: ProblemaDeCampo[] }

class Registro {
  private porClave = new Map<string, ProblemaDeCampo>()

  anotar(p: Omit<ProblemaDeCampo, 'veces'>, veces = 1): void {
    const clave = `${p.ruta}|${p.consecuencia}|${p.motivo}`
    const previo = this.porClave.get(clave)
    if (previo) {
      previo.veces += veces
      if (p.deTotal !== undefined) previo.deTotal = (previo.deTotal ?? 0) + p.deTotal
    } else {
      this.porClave.set(clave, { ...p, veces })
    }
  }

  lista(): ProblemaDeCampo[] {
    return [...this.porClave.values()]
  }
}

/** Lo que se esperaba, en palabras. */
function nombreDe(esquema: Esquema): string {
  switch (esquema.tipo) {
    case 'numero':
      return 'número'
    case 'texto':
      return 'texto'
    case 'logico':
      return 'true / false'
    case 'opciones':
      return esquema.valores.map((v) => `"${v}"`).join(' | ')
    case 'lista':
      return 'lista'
    case 'tupla':
      return `par [${esquema.de.map(nombreDe).join(', ')}]`
    case 'objeto':
      return 'objeto { … }'
    case 'nulable':
      return `${nombreDe(esquema.de)} o null`
  }
}

/** 'objeto' o 'lista' si el esquema espera uno de esos (para distinguir "incompleto" de "otra forma"). */
function claseEsperada(esquema: Esquema): string | null {
  if (esquema.tipo === 'nulable') return claseEsperada(esquema.de)
  if (esquema.tipo === 'objeto') return 'objeto'
  if (esquema.tipo === 'lista' || esquema.tipo === 'tupla') return 'lista'
  return null
}

function motivoDe(crudo: unknown, esquema: Esquema): ProblemaDeCampo['motivo'] {
  if (crudo === undefined || crudo === null) return 'falta'
  const clase = Array.isArray(crudo) ? 'lista' : typeof crudo === 'object' ? 'objeto' : null
  return clase !== null && clase === claseEsperada(esquema) ? 'incompleto' : 'forma'
}

function tipoDe(valor: unknown): string {
  if (valor === null) return 'null'
  if (Array.isArray(valor)) return 'lista'
  if (typeof valor === 'number') return Number.isFinite(valor) ? 'número' : 'número no finito'
  if (typeof valor === 'string') return valor.length > 24 ? 'texto' : `"${valor}"`
  if (typeof valor === 'boolean') return String(valor)
  if (typeof valor === 'object') return 'objeto'
  return typeof valor
}

/** Señal interna: el valor no sirve y hay que subir hasta un campo que se pueda suplir. */
const INVALIDO = Symbol('invalido')

/**
 * Revisa `valor` contra `esquema`. Devuelve el valor (reparado si hizo falta) o
 * INVALIDO. Los problemas de los campos de adentro se anotan en `registro`.
 */
function revisar(valor: unknown, esquema: Esquema, ruta: string, contexto: Contexto, registro: Registro): unknown {
  switch (esquema.tipo) {
    case 'numero':
      return typeof valor === 'number' && Number.isFinite(valor) ? valor : INVALIDO
    case 'texto':
      return typeof valor === 'string' ? valor : INVALIDO
    case 'logico':
      return typeof valor === 'boolean' ? valor : INVALIDO
    case 'opciones':
      return typeof valor === 'string' && esquema.valores.includes(valor) ? valor : INVALIDO
    case 'nulable':
      return valor === null ? null : revisar(valor, esquema.de, ruta, contexto, registro)

    case 'tupla': {
      if (!Array.isArray(valor) || valor.length !== esquema.de.length) return INVALIDO
      const salida: unknown[] = []
      for (let i = 0; i < esquema.de.length; i++) {
        const v = revisar(valor[i], esquema.de[i], `${ruta}[${i}]`, contexto, registro)
        if (v === INVALIDO) return INVALIDO
        salida.push(v)
      }
      return salida
    }

    case 'lista': {
      if (!Array.isArray(valor)) return INVALIDO
      const salida: unknown[] = []
      const rutaElemento = `${ruta}[]`
      let descartados = 0
      for (const elemento of valor) {
        const v = revisar(elemento, esquema.de, rutaElemento, contexto, registro)
        if (v !== INVALIDO) {
          salida.push(v)
        } else if (esquema.siInvalido === 'descartar') {
          descartados++
        } else {
          salida.push(esquema.siInvalido.valor)
          registro.anotar({
            ruta: rutaElemento,
            motivo: motivoDe(elemento, esquema.de),
            esperado: nombreDe(esquema.de),
            recibido: tipoDe(elemento),
            consecuencia: 'suplido',
            explicacion: 'se muestra «—»',
          })
        }
      }
      if (descartados > 0) {
        registro.anotar(
          {
            ruta: rutaElemento,
            motivo: 'incompleto',
            esperado: nombreDe(esquema.de),
            consecuencia: 'descartado',
            explicacion: 'se dejan fuera',
            deTotal: valor.length,
          },
          descartados,
        )
      }
      // Una lista que traía elementos y se quedó sin ninguno válido no sirve para nada.
      if (valor.length > 0 && salida.length === 0) return INVALIDO
      return salida
    }

    case 'objeto': {
      if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return INVALIDO
      const origen = valor as Record<string, unknown>
      const salida: Record<string, unknown> = { ...origen }
      let invalido = false
      for (const [nombre, campo] of Object.entries(esquema.campos)) {
        const rutaCampo = ruta ? `${ruta}.${nombre}` : nombre
        const crudo = origen[nombre]
        const revisado = crudo === undefined ? INVALIDO : revisar(crudo, campo.esquema, rutaCampo, contexto, registro)
        if (revisado !== INVALIDO) {
          salida[nombre] = revisado
          continue
        }
        if (crudo === undefined && campo.siFalta.como === 'opcional') continue
        const base = {
          ruta: rutaCampo,
          motivo: motivoDe(crudo, campo.esquema),
          esperado: nombreDe(campo.esquema),
          recibido: crudo === undefined ? undefined : tipoDe(crudo),
        }
        if (campo.siFalta.como === 'suplir') {
          salida[nombre] = campo.siFalta.valor(contexto)
          registro.anotar({ ...base, consecuencia: 'suplido', explicacion: campo.siFalta.explicacion })
        } else if (campo.siFalta.como === 'opcional') {
          // Un campo opcional que llegó con otra forma se ignora, como si no hubiera venido.
          delete salida[nombre]
          registro.anotar({ ...base, consecuencia: 'suplido', explicacion: 'se ignora' })
        } else {
          // Imprescindible: el objeto entero no sirve.
          registro.anotar({ ...base, consecuencia: 'imprescindible' })
          invalido = true
        }
      }
      return invalido ? INVALIDO : salida
    }
  }
}

/**
 * Revisa una respuesta { ok: true, … } del motor contra el contrato.
 * - `valida: true`  → `datos` ya se puede usar (con lo que faltaba suplido); `problemas` dice qué faltó.
 * - `valida: false` → faltó algo imprescindible; `mensaje` lo explica en una frase.
 */
export function validarRespuesta<C extends NombreComando>(comando: C, respuesta: unknown, args: readonly string[] = []): ResultadoValidacion<C> {
  const registro = new Registro()
  const contexto: Contexto = {
    args,
    respuesta: respuesta !== null && typeof respuesta === 'object' ? (respuesta as Record<string, unknown>) : {},
  }
  const datos = revisar(respuesta, ESQUEMAS[comando], '', contexto, registro)
  const problemas = registro.lista()
  if (datos === INVALIDO) {
    const imprescindibles = problemas.filter((p) => p.consecuencia === 'imprescindible' && p.motivo !== 'incompleto')
    const campos = imprescindibles.length > 0 ? imprescindibles.map((p) => `«${p.ruta}»`).join(', ') : 'su contenido'
    return {
      valida: false,
      problemas,
      mensaje: `La respuesta del motor a «${comando}» ${FRASE_INCOMPLETA}: falta o no tiene la forma del contrato ${campos}. Sin eso esta vista no se puede dibujar.`,
    }
  }
  return { valida: true, datos: datos as Comandos[C], problemas }
}

/** Frase con la que empiezan los errores por respuesta incompleta (la interfaz la reconoce). */
export const FRASE_INCOMPLETA = 'llegó incompleta'

export function esErrorDeRespuestaIncompleta(mensaje: string): boolean {
  return mensaje.includes(FRASE_INCOMPLETA)
}

/** Una línea por problema, para un aviso. */
export function describirProblema(p: ProblemaDeCampo): string {
  if (p.consecuencia === 'descartado') {
    const lista = p.ruta.slice(0, -2)
    const de = p.deTotal !== undefined ? ` de ${p.deTotal}` : ''
    return `${p.veces}${de} elementos de «${lista}» llegaron incompletos → ${p.explicacion ?? 'se dejan fuera'}`
  }
  const donde = p.veces > 1 ? ` (en ${p.veces} elementos)` : ''
  let explicacion = p.explicacion
  if (explicacion === undefined && p.consecuencia === 'imprescindible') {
    // De qué depende: el elemento de la lista, el objeto que lo contiene o la respuesta entera
    const corte = p.ruta.lastIndexOf('.')
    const padre = corte === -1 ? null : p.ruta.slice(0, corte)
    explicacion =
      padre === null ? 'es imprescindible' : padre.endsWith('[]') ? 'ese elemento se deja fuera' : `sin él no se puede usar «${padre}»`
  }
  let que: string
  if (p.motivo === 'falta') que = `falta «${p.ruta}»`
  else if (p.motivo === 'incompleto') que = `«${p.ruta}» llegó incompleto`
  else que = `«${p.ruta}» llegó como ${p.recibido ?? '?'} (se esperaba ${p.esperado})`
  return `${que}${donde}${explicacion ? ` → ${explicacion}` : ''}`
}

/** Rutas de los campos que faltan o vienen mal (sin los contenedores "incompletos"), para resúmenes cortos. */
export function camposConProblemas(problemas: readonly ProblemaDeCampo[]): string[] {
  return problemas.filter((p) => p.motivo !== 'incompleto').map((p) => p.ruta)
}
