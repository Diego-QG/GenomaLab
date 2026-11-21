// ─────────────────────────────────────────────────────────────────────────────
//  El puente con el motor en C++.
//
//  Toda la interfaz pasa por una sola función: ejecutarMotor(comando, args), que
//  ejecuta  ProyectoGenomico.exe --json <fasta> <comando> <args...>
//  y devuelve el JSON que el motor imprime por stdout.
//
//  El .exe se busca solo (ver rutas.ts). Si no está o no responde, la interfaz
//  lo dice; no hay ningún otro modo que conteste en su lugar.
//
//  Aquí no se calcula nada del dominio: solo se lanza el proceso y se lee su salida.
// ─────────────────────────────────────────────────────────────────────────────

import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { basename, delimiter, dirname, join, normalize } from 'node:path'
import { NOMBRES_COMANDOS } from '@compartido/contrato'
import { AVISO_SIN_MOTOR, type EstadoMotor } from '@compartido/puente'
import { buscarMotor, rutaFastaDelProyecto } from './rutas'

const TIEMPO_MAXIMO_MS = 120_000
const SALIDA_MAXIMA_BYTES = 512 * 1024 * 1024
/** Como mucho, estos procesos del motor a la vez (el resto espera su turno). */
const PROCESOS_A_LA_VEZ = 4

// Códigos con los que Windows cierra un programa que no pudo arrancar o se cayó
const FALTA_DLL = 0xc0000135
const VIOLACION_DE_ACCESO = 0xc0000005

interface RespuestaCruda {
  ok: boolean
  error?: string
  [campo: string]: unknown
}

interface Salida {
  stdout: string
  stderr: string
  fallo: (Error & { code?: number | string | null; killed?: boolean }) | null
}

// ── Estado ───────────────────────────────────────────────────────────────────

let exe: string | null = null
let buscadas: string[] = []
let fallo: string | null = null
let fasta: string | null = null
/** Las comprobaciones del motor se encadenan para que no se pisen entre sí. */
let comprobacion: Promise<void> = Promise.resolve()

const oyentesEstado = new Set<(estado: EstadoMotor) => void>()

// ── Cola: pocos procesos a la vez ────────────────────────────────────────────

let activos = 0
const enEspera: (() => void)[] = []

async function conTurno<T>(tarea: () => Promise<T>): Promise<T> {
  if (activos >= PROCESOS_A_LA_VEZ) {
    // El turno se hereda directamente de quien termina (ver `finally`).
    await new Promise<void>((seguir) => enEspera.push(seguir))
  } else {
    activos++
  }
  try {
    return await tarea()
  } finally {
    const siguiente = enEspera.shift()
    if (siguiente) siguiente()
    else activos--
  }
}

// ── Lanzar el motor ──────────────────────────────────────────────────────────

/** Carpeta del compilador con el que CLion construyó el motor (ahí están las DLL de MinGW). */
const carpetasDllConocidas = new Map<string, string[]>()

function carpetasDll(ruta: string): string[] {
  const conocidas = carpetasDllConocidas.get(ruta)
  if (conocidas) return conocidas
  const carpetas = [dirname(ruta)]
  try {
    const cache = readFileSync(join(dirname(ruta), 'CMakeCache.txt'), 'utf8')
    const compilador = /^CMAKE_CXX_COMPILER:[A-Z]+=(.+)$/m.exec(cache)?.[1]?.trim()
    if (compilador) carpetas.push(dirname(normalize(compilador)))
  } catch {
    // Sin CMakeCache.txt: el motor tendrá que encontrar sus DLL por su cuenta.
  }
  carpetasDllConocidas.set(ruta, carpetas)
  return carpetas
}

/**
 * Entorno para el motor: el .exe que compila CLion necesita las DLL de MinGW
 * (libstdc++-6.dll, etc.), que fuera de CLion no están en el PATH.
 */
function entornoDelMotor(ruta: string): NodeJS.ProcessEnv {
  const entorno: NodeJS.ProcessEnv = { ...process.env }
  let pathActual = ''
  for (const clave of Object.keys(entorno)) {
    if (clave.toUpperCase() === 'PATH') {
      pathActual = entorno[clave] ?? ''
      delete entorno[clave]
    }
  }
  entorno.PATH = [...carpetasDll(ruta), pathActual].filter(Boolean).join(delimiter)
  return entorno
}

function lanzarMotor(ruta: string, argv: string[]): Promise<Salida> {
  return conTurno(
    () =>
      new Promise((resolver) => {
        // execFile con arreglo de argumentos: sin shell, así los espacios de las rutas no molestan.
        execFile(
          ruta,
          argv,
          {
            cwd: dirname(ruta),
            env: entornoDelMotor(ruta),
            encoding: 'utf8',
            timeout: TIEMPO_MAXIMO_MS,
            maxBuffer: SALIDA_MAXIMA_BYTES,
            windowsHide: true,
          },
          (error, stdout, stderr) => resolver({ stdout, stderr, fallo: error }),
        )
      }),
  )
}

/** true si el proceso ni siquiera pudo arrancar (el archivo ya no está, no se puede abrir o le faltan DLL). */
function noArranco(salida: Salida): boolean {
  const codigo = salida.fallo?.code
  if (codigo === 'ENOENT' || codigo === 'EACCES' || codigo === 'EPERM' || codigo === 'UNKNOWN') return true
  return typeof codigo === 'number' && codigo >>> 0 === FALTA_DLL
}

function explicarFallo(salida: Salida): string {
  const { fallo: error } = salida
  const texto = salida.stdout.trim()
  const codigo = typeof error?.code === 'number' ? error.code >>> 0 : null
  if (error?.code === 'ENOENT') return 'No se pudo ejecutar el motor: el archivo ya no existe.'
  if (error?.code === 'EACCES' || error?.code === 'EPERM') return 'No se pudo ejecutar el motor: Windows no permite abrir el archivo.'
  if (error?.killed) return `El motor no respondió en ${TIEMPO_MAXIMO_MS / 1000} s y se detuvo.`
  if (error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return 'El motor imprimió más datos de los que se pueden leer.'
  if (codigo === FALTA_DLL) {
    return 'El motor no pudo arrancar: le faltan DLL (por ejemplo libstdc++-6.dll de MinGW). Compílalo desde CLion o copia las DLL junto al .exe.'
  }
  if (codigo === VIOLACION_DE_ACCESO) return 'El motor se cerró por un error de memoria (violación de acceso).'
  if (texto.length === 0) {
    const detalle = salida.stderr.trim().slice(0, 200)
    return `El motor terminó sin imprimir nada${codigo === null ? '' : ` (código de salida ${codigo})`}${detalle ? `: ${detalle}` : '.'}`
  }
  const comienzo = texto.slice(0, 120).replace(/\s+/g, ' ')
  return `El motor no devolvió JSON válido (¿se compiló con el modo --json?). Su salida empieza con: "${comienzo}${texto.length > 120 ? '…' : ''}"`
}

/** Convierte la salida del motor en la respuesta del contrato. */
function interpretar(salida: Salida): { respuesta: RespuestaCruda; esJson: boolean } {
  const texto = salida.stdout.replace(/^﻿/, '').trim()
  if (texto.startsWith('{')) {
    try {
      const objeto = JSON.parse(texto) as RespuestaCruda
      if (objeto !== null && typeof objeto === 'object' && typeof objeto.ok === 'boolean') {
        if (!objeto.ok && typeof objeto.error !== 'string') objeto.error = 'El motor respondió "ok": false sin mensaje de error.'
        return { respuesta: objeto, esJson: true }
      }
    } catch {
      // No era JSON: se explica abajo.
    }
  }
  return { respuesta: { ok: false, error: explicarFallo(salida) }, esJson: false }
}

// ── Estado del motor ─────────────────────────────────────────────────────────

export function estadoMotor(): EstadoMotor {
  const delProyecto = rutaFastaDelProyecto()
  return {
    exe,
    buscadas: [...buscadas],
    fallo,
    fasta: fasta ? { ruta: fasta, nombre: basename(fasta) } : null,
    fastaDelProyecto: delProyecto ? { ruta: delProyecto, nombre: basename(delProyecto) } : null,
  }
}

export function alCambiarEstado(oyente: (estado: EstadoMotor) => void): () => void {
  oyentesEstado.add(oyente)
  return () => oyentesEstado.delete(oyente)
}

function avisarEstado(): void {
  const estado = estadoMotor()
  for (const oyente of oyentesEstado) oyente(estado)
}

/**
 * Busca el motor y comprueba que responda JSON a `resumen` (con el FASTA del
 * proyecto, o con el que esté en uso si el del proyecto no está).
 */
async function comprobarMotor(): Promise<void> {
  const encontrado = buscarMotor()
  exe = encontrado.exe
  buscadas = encontrado.buscadas
  fallo = null
  const fastaDePrueba = rutaFastaDelProyecto() ?? fasta
  if (exe && fastaDePrueba) {
    const { respuesta, esJson } = interpretar(await lanzarMotor(exe, ['--json', fastaDePrueba, 'resumen']))
    if (!esJson) fallo = respuesta.error ?? 'El motor no respondió.'
  }
  avisarEstado()
}

function encolarComprobacion(): Promise<void> {
  comprobacion = comprobacion.then(comprobarMotor, comprobarMotor)
  return comprobacion
}

export async function iniciarMotor(): Promise<void> {
  fasta = rutaFastaDelProyecto()
  await encolarComprobacion()
}

/** Vuelve a buscar el motor (botón "Buscar de nuevo" del aviso). */
export async function buscarDeNuevo(): Promise<EstadoMotor> {
  await encolarComprobacion()
  return estadoMotor()
}

/** Cambia el FASTA en uso (null = el del proyecto). */
export async function usarFasta(ruta: unknown): Promise<EstadoMotor> {
  if (ruta !== null && (typeof ruta !== 'string' || ruta.length === 0 || ruta.length > 2048)) {
    throw new Error('La ruta del archivo FASTA no es válida.')
  }
  const nueva = ruta ?? rutaFastaDelProyecto()
  if (nueva && nueva !== fasta) {
    fasta = nueva
    avisarEstado()
  }
  return estadoMotor()
}

// ── ejecutarMotor ────────────────────────────────────────────────────────────

function validarPedido(comando: unknown, args: unknown): { comando: string; args: string[] } | { error: string } {
  if (typeof comando !== 'string' || !(NOMBRES_COMANDOS as readonly string[]).includes(comando)) {
    return { error: `Comando desconocido: ${String(comando)}` }
  }
  const lista = args === undefined ? [] : args
  if (!Array.isArray(lista) || lista.length > 8) return { error: 'Los argumentos tienen que ser una lista corta de textos.' }
  for (const arg of lista) {
    if (typeof arg !== 'string' || arg.length === 0 || arg.length > 512 || arg.includes('\0')) {
      return { error: 'Cada argumento tiene que ser un texto no vacío.' }
    }
  }
  return { comando, args: lista as string[] }
}

/**
 * La única puerta al motor. Devuelve siempre un objeto del contrato:
 * { ok: true, ... } o { ok: false, error }.
 */
export async function ejecutarMotor(comando: unknown, args: unknown): Promise<RespuestaCruda> {
  const pedido = validarPedido(comando, args)
  if ('error' in pedido) return { ok: false, error: pedido.error }
  await comprobacion // si se está buscando el motor, se espera el resultado
  if (!exe) return { ok: false, error: AVISO_SIN_MOTOR }
  if (fallo) return { ok: false, error: fallo }
  if (!fasta) return { ok: false, error: 'Todavía no hay ningún archivo FASTA cargado.' }
  const motor = exe
  try {
    const salida = await lanzarMotor(motor, ['--json', fasta, pedido.comando, ...pedido.args])
    const { respuesta, esJson } = interpretar(salida)
    // Si el motor dejó de arrancar (se borró, se está recompilando…), toda la app lo avisa
    if (!esJson && noArranco(salida) && exe === motor) {
      fallo = respuesta.error ?? 'El motor no pudo arrancar.'
      avisarEstado()
    }
    return respuesta
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
