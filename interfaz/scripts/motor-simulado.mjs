#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  motor-simulado.mjs — SOLO PARA SIMULAR. No reemplaza al motor en C++.
//
//  Imita, paso a paso, los algoritmos del motor (Fasta.cpp, TablaVirus.cpp,
//  TablaKmers.cpp, MaxHeap.cpp, GrafoPares.cpp) y responde con el mismo contrato
//  JSON de BRIEF-INTERFAZ.md (sección 5). Se usa de dos formas:
//
//    1) Como programa, igual que el .exe:
//         node scripts/motor-simulado.mjs --json <archivo.fasta> <comando> [args...]
//       Imprime UN solo objeto JSON por stdout.
//
//    2) Como módulo, desde scripts/generar-mocks.mjs:
//         import { cargar, ejecutar } from './motor-simulado.mjs'
//
//  La interfaz (renderer) nunca importa este archivo: solo lo ejecuta el proceso
//  principal de Electron cuando está en "🧪 Modo simulado".
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { pathToFileURL } from 'node:url'

const LETRAS = 'ACGT'
const MASCARA_64 = (1n << 64n) - 1n

// ── Fasta.cpp ────────────────────────────────────────────────────────────────

/** Igual que leerFasta(): quita '\r', salta líneas vacías, '>' abre un registro. */
export function leerFasta(ruta) {
  // latin1 = un carácter por byte, igual que los `char` de C++
  const texto = readFileSync(ruta, 'latin1')
  const lista = []
  let actual = null
  for (let linea of texto.split('\n')) {
    if (linea.endsWith('\r')) linea = linea.slice(0, -1)
    if (linea.length === 0) continue
    if (linea[0] === '>') {
      actual = { id: linea.slice(1), partes: [] }
      lista.push(actual)
    } else if (actual) {
      actual.partes.push(linea)
    }
  }
  return lista.map((v) => ({ id: v.id, sequence: v.partes.join('') }))
}

// ── TablaVirus.cpp ───────────────────────────────────────────────────────────

/** Código de un `char` de C++ (con signo): los bytes ≥ 128 son negativos. */
function codigoChar(texto, i) {
  const c = texto.charCodeAt(i) & 0xff
  return c >= 128 ? c - 256 : c
}

/** hashTexto(): h = h * 31 + c, en unsigned long long (se desborda en 64 bits). */
export function hashTexto(texto) {
  let h = 0n
  for (let i = 0; i < texto.length; i++) {
    h = (h * 31n + BigInt(codigoChar(texto, i))) & MASCARA_64
  }
  return h
}

/** Igual que hashTexto, pero devuelve el valor después de cada letra. */
function hashTextoConPasos(texto) {
  let h = 0n
  const pasos = []
  for (let i = 0; i < texto.length; i++) {
    h = (h * 31n + BigInt(codigoChar(texto, i))) & MASCARA_64
    pasos.push({ letra: texto[i], valor: h.toString() })
  }
  return { hash: h, pasos }
}

function esPrimo(n) {
  if (n < 2) return false
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false
  return true
}

function siguientePrimo(n) {
  while (!esPrimo(n)) n++
  return n
}

class TablaVirus {
  constructor() {
    this.casillas = new Array(10).fill(null) // null = casilla libre
    this.cantidad = 0
    this.colisiones = 0
    this.redimensiones = []
    this.insercionActual = 0 // número (desde 1) del virus que se está insertando
  }

  insertar(v) {
    if ((this.cantidad + 1) / this.casillas.length > 0.5) this.redimensionar()
    const tam = this.casillas.length
    let pos = Number(hashTexto(v.id) % BigInt(tam))
    while (this.casillas[pos] !== null) {
      this.colisiones++
      pos = (pos + 1) % tam
    }
    this.casillas[pos] = v
    this.cantidad++
  }

  redimensionar() {
    const viejas = this.casillas
    const nuevoTam = siguientePrimo(viejas.length * 2)
    this.redimensiones.push({ de: viejas.length, a: nuevoTam, enInsercion: this.insercionActual })
    this.casillas = new Array(nuevoTam).fill(null)
    this.cantidad = 0
    // Como en el C++: se reinsertan en el orden de las casillas viejas y las
    // colisiones del reacomodo también se suman al contador.
    for (const v of viejas) if (v !== null) this.insertar(v)
  }

  /** buscar() con la traza de cada casilla revisada. */
  buscarConTraza(id) {
    const tam = this.casillas.length
    const { hash, pasos: hashPasos } = hashTextoConPasos(id)
    const inicio = Number(hash % BigInt(tam))
    const pasos = []
    let pos = inicio
    let revisados = 0
    let posFinal = -1
    while (revisados < tam) {
      const v = this.casillas[pos]
      if (v === null) {
        pasos.push({ pos, ocupada: false, idEnCasilla: null, igual: false })
        break
      }
      const igual = v.id === id
      pasos.push({ pos, ocupada: true, idEnCasilla: v.id, igual })
      if (igual) {
        posFinal = pos
        break
      }
      pos = (pos + 1) % tam
      revisados++
    }
    return { hashPasos, hash: hash.toString(), tamano: tam, inicio, pasos, encontrado: posFinal >= 0, posFinal }
  }

  buscar(id) {
    const tam = this.casillas.length
    let pos = Number(hashTexto(id) % BigInt(tam))
    let revisados = 0
    while (this.casillas[pos] !== null && revisados < tam) {
      if (this.casillas[pos].id === id) return pos
      pos = (pos + 1) % tam
      revisados++
    }
    return -1
  }
}

// ── TablaKmers.cpp ───────────────────────────────────────────────────────────

function esValido(kmer) {
  for (let i = 0; i < kmer.length; i++) {
    const c = kmer[i]
    if (c !== 'A' && c !== 'C' && c !== 'G' && c !== 'T') return false
  }
  return true
}

const HASHES_KMER = new Map() // k-mer → { hash, inicio, pasoDoble }

/**
 * Tabla de k-mers de tamaño fijo 4^k.
 *   metodo 'doble'  → paso = (h / tam) % tam, y si es par se le suma 1 (lo que hace hoy el C++)
 *   metodo 'lineal' → paso = 1 (variante para comparar; todavía no existe en el C++)
 */
class TablaKmers {
  constructor(k, metodo = 'doble') {
    this.k = k
    this.metodo = metodo
    this.tam = 4 ** k
    this.kmers = new Array(this.tam).fill(null)
    this.conteos = new Int32Array(this.tam)
    this.distintos = 0
    this.colisiones = 0
  }

  inicioYPaso(kmer) {
    // El hash de un k-mer no cambia: se guarda para no recalcularlo en cada ventana
    // (el largo del k-mer fija el tamaño 4^k, así que el k-mer basta como clave).
    let base = HASHES_KMER.get(kmer)
    if (!base) {
      const h = hashTexto(kmer)
      const tam = BigInt(this.tam)
      let pasoDoble = Number((h / tam) % tam)
      if (pasoDoble % 2 === 0) pasoDoble++
      base = { hash: h, inicio: Number(h % tam), pasoDoble }
      HASHES_KMER.set(kmer, base)
    }
    return { hash: base.hash, inicio: base.inicio, paso: this.metodo === 'doble' ? base.pasoDoble : 1 }
  }

  /** insertar(); si `saltos` es un arreglo, anota cada casilla visitada. */
  insertar(kmer, saltos = null) {
    const { hash, inicio, paso } = this.inicioYPaso(kmer)
    let pos = inicio
    while (this.kmers[pos] !== null && this.kmers[pos] !== kmer) {
      this.colisiones++
      if (saltos) saltos.push({ pos, kmerEnCasilla: this.kmers[pos], resultado: 'colision' })
      pos = (pos + paso) % this.tam
    }
    if (this.kmers[pos] !== null) {
      this.conteos[pos]++
      if (saltos) saltos.push({ pos, kmerEnCasilla: kmer, resultado: 'sumado' })
    } else {
      this.kmers[pos] = kmer
      this.conteos[pos] = 1
      this.distintos++
      if (saltos) saltos.push({ pos, kmerEnCasilla: null, resultado: 'nuevo' })
    }
    return { hash, inicio, paso, conteoFinal: this.conteos[pos] }
  }

  contarDe(adn) {
    let ventanas = 0
    let descartadas = 0
    for (let i = 0; i + this.k <= adn.length; i++) {
      const pedazo = adn.substr(i, this.k)
      ventanas++
      if (esValido(pedazo)) this.insertar(pedazo)
      else descartadas++
    }
    return { ventanas, descartadas }
  }

  /** obtenerPares(): las casillas ocupadas, en el orden de la tabla. */
  obtenerPares() {
    const pares = []
    for (let i = 0; i < this.tam; i++) {
      if (this.kmers[i] !== null) pares.push({ kmer: this.kmers[i], conteo: this.conteos[i] })
    }
    return pares
  }

  casillasOcupadas() {
    const lista = []
    for (let i = 0; i < this.tam; i++) {
      if (this.kmers[i] !== null) lista.push({ pos: i, kmer: this.kmers[i], conteo: this.conteos[i] })
    }
    return lista
  }
}

// ── MaxHeap.cpp ──────────────────────────────────────────────────────────────

class MaxHeap {
  constructor() {
    this.datos = []
  }

  cambiar(i, j, intercambios) {
    const t = this.datos[i]
    this.datos[i] = this.datos[j]
    this.datos[j] = t
    if (intercambios) intercambios.push([i, j])
  }

  subir(i, intercambios) {
    let padre = Math.trunc((i - 1) / 2)
    while (i > 0 && this.datos[i].conteo > this.datos[padre].conteo) {
      this.cambiar(i, padre, intercambios)
      i = padre
      padre = Math.trunc((i - 1) / 2)
    }
  }

  bajar(i, intercambios) {
    let mayor = i
    for (;;) {
      const izq = i * 2 + 1
      const der = i * 2 + 2
      if (izq < this.datos.length && this.datos[izq].conteo > this.datos[mayor].conteo) mayor = izq
      if (der < this.datos.length && this.datos[der].conteo > this.datos[mayor].conteo) mayor = der
      if (mayor !== i) {
        this.cambiar(i, mayor, intercambios)
        i = mayor
      } else {
        return
      }
    }
  }

  insertar(par, intercambios = null) {
    this.datos.push(par)
    this.subir(this.datos.length - 1, intercambios)
  }

  extraerMax(intercambios = null) {
    const max = this.datos[0]
    // swap(datos[0], datos[último]) — con un solo elemento queda [0, 0]
    this.cambiar(0, this.datos.length - 1, intercambios)
    this.datos.pop()
    if (this.datos.length > 0) this.bajar(0, intercambios)
    return max
  }

  vacio() {
    return this.datos.length === 0
  }
}

// ── GrafoPares.cpp ───────────────────────────────────────────────────────────

function valorLetra(c) {
  if (c === 'A') return 0
  if (c === 'C') return 1
  if (c === 'G') return 2
  if (c === 'T') return 3
  return -1
}

function indicePareja(a, b) {
  const valA = valorLetra(a)
  const valB = valorLetra(b)
  if (valA >= 0 && valB >= 0) return valA * 4 + valB
  return -1
}

const NOMBRES_PAREJAS = Array.from({ length: 16 }, (_, i) => LETRAS[i >> 2] + LETRAS[i & 3])

/** construirDe(): parejas sin solapamiento; arco a → b con peso 1 / (b − a). */
function construirGrafo(adn) {
  const pares = []
  for (let i = 0; i + 1 < adn.length; i += 2) pares.push(indicePareja(adn[i], adn[i + 1]))
  const matriz = new Float64Array(256)
  const n = pares.length
  for (let a = 0; a < n; a++) {
    const pa = pares[a]
    if (pa < 0) continue
    const fila = pa * 16
    for (let b = a + 1; b < n; b++) {
      const pb = pares[b]
      if (pb >= 0) matriz[fila + pb] += 1.0 / (b - a)
    }
  }
  return { pares, matriz }
}

// ── Utilidades de los comandos ───────────────────────────────────────────────

function redondear(x, decimales) {
  const f = 10 ** decimales
  const r = Math.round(x * f) / f
  return Object.is(r, -0) ? 0 : r
}

function grupoDe(id) {
  const punto = id.indexOf('.')
  return punto < 0 ? id : id.slice(0, punto)
}

function estadisticas(sequence) {
  let gc = 0
  let validas = 0
  const ambiguas = []
  for (let i = 0; i < sequence.length; i++) {
    const c = sequence[i]
    if (c === 'G' || c === 'C') {
      gc++
      validas++
    } else if (c === 'A' || c === 'T') {
      validas++
    } else {
      ambiguas.push({ pos: i, letra: c })
    }
  }
  return { gc: validas > 0 ? redondear((100 * gc) / validas, 2) : 0, ambiguas }
}

/** Índice del k-mer dentro del vector de 4^k (solo para el coseno). */
function indiceKmer(kmer) {
  let idx = 0
  for (let i = 0; i < kmer.length; i++) idx = idx * 4 + valorLetra(kmer[i])
  return idx
}

function coseno(a, b) {
  let punto = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    punto += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return punto / (Math.sqrt(na) * Math.sqrt(nb))
}

function enteroDe(texto, nombre, minimo, maximo) {
  const n = Number(texto)
  if (texto === undefined || texto === '' || !Number.isInteger(n) || n < minimo || n > maximo) {
    throw new Error(`"${nombre}" tiene que ser un entero entre ${minimo} y ${maximo}`)
  }
  return n
}

// ── Estado cargado ───────────────────────────────────────────────────────────

/** Carga el FASTA y construye la TablaVirus (lo que hace el motor al arrancar). */
export function cargar(rutaFasta) {
  let virus
  try {
    virus = leerFasta(rutaFasta)
  } catch {
    throw new Error(`No se pudo abrir: ${rutaFasta}`)
  }
  if (virus.length === 0) throw new Error(`El archivo no tiene secuencias FASTA: ${rutaFasta}`)

  const tabla = new TablaVirus()
  for (let i = 0; i < virus.length; i++) {
    tabla.insercionActual = i + 1
    tabla.insertar(virus[i])
  }

  const cacheVectores = new Map() // `${indice}|${k}` → Float64Array(4^k)
  const cacheGrafos = new Map() // indice → { pares, matriz }

  const motor = {
    ruta: rutaFasta,
    virus,
    tabla,

    virusPorId(id) {
      const pos = tabla.buscar(id ?? '')
      if (pos < 0) throw new Error(`No existe un virus con el ID "${id ?? ''}"`)
      return tabla.casillas[pos]
    },

    indiceDe(id) {
      const v = motor.virusPorId(id)
      return virus.indexOf(v)
    },

    vectorKmers(indice, k) {
      const clave = `${indice}|${k}`
      let vec = cacheVectores.get(clave)
      if (!vec) {
        const t = new TablaKmers(k, 'doble')
        t.contarDe(virus[indice].sequence)
        vec = new Float64Array(4 ** k)
        for (const c of t.casillasOcupadas()) vec[indiceKmer(c.kmer)] = c.conteo
        cacheVectores.set(clave, vec)
      }
      return vec
    },

    grafo(indice) {
      let g = cacheGrafos.get(indice)
      if (!g) {
        g = construirGrafo(virus[indice].sequence)
        cacheGrafos.set(indice, g)
      }
      return g
    },
  }
  return motor
}

// ── Comandos (sección 5 del brief) ───────────────────────────────────────────

const COMANDOS = {
  // 5.1
  resumen(m) {
    const t = m.tabla
    const ocupadas = []
    for (let pos = 0; pos < t.casillas.length; pos++) {
      if (t.casillas[pos] !== null) ocupadas.push({ pos, id: t.casillas[pos].id })
    }
    return {
      archivo: basename(m.ruta),
      total: m.virus.length,
      tabla: {
        tamano: t.casillas.length,
        cantidad: t.cantidad,
        colisiones: t.colisiones,
        factorCarga: redondear(t.cantidad / t.casillas.length, 4),
        redimensiones: t.redimensiones,
        ocupadas,
      },
      virus: m.virus.map((v) => {
        const e = estadisticas(v.sequence)
        return { id: v.id, grupo: grupoDe(v.id), longitud: v.sequence.length, gc: e.gc, ambiguas: e.ambiguas.length }
      }),
    }
  },

  // 5.2
  virus(m, [id]) {
    const v = m.virusPorId(id)
    const e = estadisticas(v.sequence)
    return { id: v.id, grupo: grupoDe(v.id), longitud: v.sequence.length, gc: e.gc, ambiguas: e.ambiguas, secuencia: v.sequence }
  },

  // 5.3
  buscar(m, [id]) {
    if (id === undefined || id === '') throw new Error('Falta el ID a buscar')
    return { id, ...m.tabla.buscarConTraza(id) }
  },

  // 5.4
  kmers(m, [id, kTxt, nTxt]) {
    const v = m.virusPorId(id)
    const k = enteroDe(kTxt, 'k', 1, 8)
    const n = enteroDe(nTxt, 'n', 0, 1_000_000)

    const doble = new TablaKmers(k, 'doble')
    const { ventanas, descartadas } = doble.contarDe(v.sequence)
    const lineal = new TablaKmers(k, 'lineal')
    lineal.contarDe(v.sequence)

    const heap = new MaxHeap()
    for (const par of doble.obtenerPares()) heap.insertar(par)
    const top = []
    for (let i = 0; i < n && !heap.vacio(); i++) top.push(heap.extraerMax())

    return {
      id: v.id,
      k,
      tamanoTabla: doble.tam,
      ventanas,
      descartadas,
      distintos: doble.distintos,
      colisiones: { lineal: lineal.colisiones, doble: doble.colisiones },
      casillas: doble.casillasOcupadas(),
      top,
    }
  },

  // 5.5
  trazakmers(m, [id, kTxt, metodo, limiteTxt]) {
    const v = m.virusPorId(id)
    const k = enteroDe(kTxt, 'k', 1, 8)
    if (metodo !== 'lineal' && metodo !== 'doble') throw new Error('"metodo" tiene que ser lineal o doble')
    const limite = enteroDe(limiteTxt, 'limite', 0, 1_000_000)

    const tabla = new TablaKmers(k, metodo)
    const inserciones = []
    for (let i = 0; i + k <= v.sequence.length && i < limite; i++) {
      const kmer = v.sequence.substr(i, k)
      if (!esValido(kmer)) {
        // k-mer con letra ambigua: el motor no lo inserta
        inserciones.push({
          ventana: i,
          kmer,
          hash: '0',
          inicio: -1,
          paso: 0,
          saltos: [{ pos: -1, kmerEnCasilla: null, resultado: 'descartado' }],
          conteoFinal: 0,
        })
        continue
      }
      const saltos = []
      const r = tabla.insertar(kmer, saltos)
      inserciones.push({ ventana: i, kmer, hash: r.hash.toString(), inicio: r.inicio, paso: r.paso, saltos, conteoFinal: r.conteoFinal })
    }
    return { id: v.id, k, metodo, tamanoTabla: tabla.tam, inserciones }
  },

  // 5.6
  heap(m, [id, kTxt, nTxt]) {
    const v = m.virusPorId(id)
    const k = enteroDe(kTxt, 'k', 1, 8)
    const n = enteroDe(nTxt, 'n', 0, 1_000_000)

    const tabla = new TablaKmers(k, 'doble')
    tabla.contarDe(v.sequence)

    const heap = new MaxHeap()
    const operaciones = []
    for (const par of tabla.obtenerPares()) {
      const intercambios = []
      heap.insertar(par, intercambios)
      operaciones.push({ op: 'insertar', par, intercambios })
    }
    const top = []
    for (let i = 0; i < n && !heap.vacio(); i++) {
      const intercambios = []
      const par = heap.extraerMax(intercambios)
      operaciones.push({ op: 'extraer', par, intercambios })
      top.push(par)
    }
    return { id: v.id, k, n, operaciones, top }
  },

  // 5.7
  grafo(m, [id, limiteTxt]) {
    const indice = m.indiceDe(id)
    const v = m.virus[indice]
    const limite = limiteTxt === undefined ? 8 : enteroDe(limiteTxt, 'limiteArcos', 0, 64)
    const { pares, matriz } = m.grafo(indice)

    const matrizJson = []
    for (let i = 0; i < 16; i++) {
      const fila = []
      for (let j = 0; j < 16; j++) fila.push(redondear(matriz[i * 16 + j], 4))
      matrizJson.push(fila)
    }

    const arcosEjemplo = []
    const tope = Math.min(limite, pares.length)
    for (let a = 0; a < tope; a++) {
      for (let b = a + 1; b < tope; b++) {
        if (pares[a] >= 0 && pares[b] >= 0) {
          arcosEjemplo.push({
            a,
            b,
            desde: NOMBRES_PAREJAS[pares[a]],
            hasta: NOMBRES_PAREJAS[pares[b]],
            distancia: b - a,
            peso: redondear(1 / (b - a), 4),
          })
        }
      }
    }

    return {
      id: v.id,
      nombres: NOMBRES_PAREJAS,
      parejas: pares.length,
      parejasInvalidas: pares.filter((p) => p < 0).length,
      matriz: matrizJson,
      arcosEjemplo,
    }
  },

  // 5.8
  comparar(m, [id1, id2]) {
    const i1 = m.indiceDe(id1)
    const i2 = m.indiceDe(id2)
    const g1 = m.grafo(i1).matriz
    const g2 = m.grafo(i2).matriz
    const diferenciaGrafo = []
    for (let i = 0; i < 16; i++) {
      const fila = []
      for (let j = 0; j < 16; j++) fila.push(redondear(g1[i * 16 + j] - g2[i * 16 + j], 4))
      diferenciaGrafo.push(fila)
    }
    return {
      id1: m.virus[i1].id,
      id2: m.virus[i2].id,
      simKmers3: redondear(coseno(m.vectorKmers(i1, 3), m.vectorKmers(i2, 3)), 6),
      simKmers6: redondear(coseno(m.vectorKmers(i1, 6), m.vectorKmers(i2, 6)), 6),
      simGrafo: redondear(coseno(g1, g2), 6),
      diferenciaGrafo,
    }
  },

  // 5.9
  parecidos(m, [id, kTxt]) {
    const indice = m.indiceDe(id)
    const k = enteroDe(kTxt, 'k', 1, 8)
    const base = m.vectorKmers(indice, k)
    const grafoBase = m.grafo(indice).matriz
    const ranking = []
    for (let j = 0; j < m.virus.length; j++) {
      if (j === indice) continue
      ranking.push({
        id: m.virus[j].id,
        grupo: grupoDe(m.virus[j].id),
        simKmers: redondear(coseno(base, m.vectorKmers(j, k)), 6),
        simGrafo: redondear(coseno(grafoBase, m.grafo(j).matriz), 6),
      })
    }
    ranking.sort((a, b) => b.simKmers - a.simKmers) // estable: los empates quedan en el orden del archivo
    return { id: m.virus[indice].id, k, ranking }
  },

  // 5.10
  similitudes(m, [kTxt]) {
    const k = enteroDe(kTxt, 'k', 1, 8)
    const n = m.virus.length
    const vectores = m.virus.map((_, i) => m.vectorKmers(i, k))
    const matriz = Array.from({ length: n }, () => new Array(n).fill(0))
    for (let i = 0; i < n; i++) {
      matriz[i][i] = 1
      for (let j = i + 1; j < n; j++) {
        const s = redondear(coseno(vectores[i], vectores[j]), 4)
        matriz[i][j] = s
        matriz[j][i] = s
      }
    }
    return { k, ids: m.virus.map((v) => v.id), grupos: m.virus.map((v) => grupoDe(v.id)), matriz }
  },

  // 5.11
  experimento(m) {
    const resultados = []
    const porVirus = []
    for (const k of [3, 6]) {
      const totales = { lineal: 0, doble: 0 }
      let sumaCarga = 0
      for (const v of m.virus) {
        const lineal = new TablaKmers(k, 'lineal')
        lineal.contarDe(v.sequence)
        const doble = new TablaKmers(k, 'doble')
        doble.contarDe(v.sequence)
        totales.lineal += lineal.colisiones
        totales.doble += doble.colisiones
        sumaCarga += doble.distintos / doble.tam
        porVirus.push({ id: v.id, k, lineal: lineal.colisiones, doble: doble.colisiones })
      }
      for (const metodo of ['lineal', 'doble']) {
        resultados.push({
          k,
          metodo,
          colisionesTotal: totales[metodo],
          colisionesPromedio: redondear(totales[metodo] / m.virus.length, 2),
          factorCargaPromedio: redondear(sumaCarga / m.virus.length, 4),
        })
      }
    }
    return { resultados, porVirus }
  },
}

export const NOMBRES_COMANDOS = Object.keys(COMANDOS)

/** Ejecuta un comando sobre un motor ya cargado. Siempre devuelve { ok, ... }. */
export function ejecutar(motor, comando, args = []) {
  const fn = Object.hasOwn(COMANDOS, comando) ? COMANDOS[comando] : null
  if (!fn) return { ok: false, error: `Comando desconocido: "${comando}". Disponibles: ${NOMBRES_COMANDOS.join(', ')}` }
  try {
    return { ok: true, ...fn(motor, args) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Modo programa (misma forma de uso que el .exe) ───────────────────────────

function principal(argv) {
  const [bandera, rutaFasta, comando, ...args] = argv
  let respuesta
  if (bandera !== '--json' || !rutaFasta || !comando) {
    respuesta = { ok: false, error: 'Uso: motor-simulado --json <archivo.fasta> <comando> [args...]' }
  } else {
    try {
      respuesta = ejecutar(cargar(rutaFasta), comando, args)
    } catch (e) {
      respuesta = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }
  process.stdout.write(JSON.stringify(respuesta))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal(process.argv.slice(2))
}
