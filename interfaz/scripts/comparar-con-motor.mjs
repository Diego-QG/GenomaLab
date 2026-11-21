#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  comparar-con-motor.mjs — ¿el motor en C++ cumple el contrato JSON?
//
//  Ejecuta el .exe con cada pedido que hay en interfaz/mock/ y compara su
//  respuesta con el archivo de mock correspondiente (los números decimales, con
//  tolerancia). Sirve mientras se programa el modo --json del motor.
//
//  Uso:   npm run comparar-motor
//         npm run comparar-motor -- --solo resumen,buscar
//         npm run comparar-motor -- --exe ..\cmake-build-release\ProyectoGenomico.exe
// ─────────────────────────────────────────────────────────────────────────────

import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { delimiter, dirname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const carpetaMock = resolve(aqui, '..', 'mock')

function opcion(nombre) {
  const i = process.argv.indexOf(nombre)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const exe = resolve(opcion('--exe') ?? join(aqui, '..', '..', 'cmake-build-debug', 'ProyectoGenomico.exe'))
const fasta = resolve(opcion('--fasta') ?? join(aqui, '..', '..', 'data', 'HIV2_ALL_2021_env_DNA.2000.fasta'))
const solo = opcion('--solo')?.split(',')
const MAXIMO_POR_PEDIDO = 4

if (!existsSync(exe)) {
  console.error(`No existe el motor: ${exe}`)
  process.exit(1)
}
if (!existsSync(join(carpetaMock, '_indice.json'))) {
  console.error('No hay mocks generados. Ejecuta primero:  npm run mocks')
  process.exit(1)
}

const indice = JSON.parse(readFileSync(join(carpetaMock, '_indice.json'), 'utf8'))
const pedidos = indice.pedidos.filter((p) => !solo || solo.includes(p[0]))

// El .exe de CLion necesita las DLL de MinGW: se añade la carpeta del compilador al PATH
const entorno = { ...process.env }
try {
  const cache = readFileSync(join(dirname(exe), 'CMakeCache.txt'), 'utf8')
  const compilador = /^CMAKE_CXX_COMPILER:[A-Z]+=(.+)$/m.exec(cache)?.[1]?.trim()
  if (compilador) {
    const clave = Object.keys(entorno).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH'
    entorno[clave] = [dirname(exe), dirname(normalize(compilador)), entorno[clave] ?? ''].join(delimiter)
  }
} catch {
  // sin CMakeCache.txt se usa el PATH tal cual
}

// Si en --exe se pasa un .mjs (el simulador), se ejecuta con Node: sirve para probar este comparador.
const [programa, previos] = exe.endsWith('.mjs') ? [process.execPath, [exe]] : [exe, []]

function ejecutar(args) {
  return new Promise((resolver) => {
    execFile(programa, [...previos, '--json', fasta, ...args], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, timeout: 120000, windowsHide: true, env: entorno }, (error, stdout) => {
      resolver({ stdout, error })
    })
  })
}

function decimalesDe(numero) {
  const texto = String(numero)
  const punto = texto.indexOf('.')
  return punto < 0 || texto.includes('e') ? 0 : texto.length - punto - 1
}

/** Dos decimales son iguales si coinciden con tolerancia, o si el motor imprimió menos decimales (2 o más) y el redondeo coincide. */
function mismoNumero(esperado, obtenido) {
  const tolerancia = 1e-3 + 1e-4 * Math.abs(esperado)
  if (Math.abs(esperado - obtenido) <= tolerancia) return true
  const d = decimalesDe(obtenido)
  return d >= 2 && Math.abs(Math.round(esperado * 10 ** d) / 10 ** d - obtenido) < 1e-9
}

/** Lista las diferencias entre lo esperado (mock) y lo obtenido (motor). */
function comparar(esperado, obtenido, ruta, diferencias) {
  if (diferencias.length >= MAXIMO_POR_PEDIDO) return
  if (typeof esperado === 'number' && typeof obtenido === 'number') {
    if (!mismoNumero(esperado, obtenido)) diferencias.push(`${ruta}: se esperaba ${esperado} y llegó ${obtenido}`)
    return
  }
  if (esperado === null || obtenido === null || typeof esperado !== 'object' || typeof obtenido !== 'object') {
    if (esperado !== obtenido) diferencias.push(`${ruta}: se esperaba ${JSON.stringify(esperado)} y llegó ${JSON.stringify(obtenido)}`)
    return
  }
  if (Array.isArray(esperado) !== Array.isArray(obtenido)) {
    diferencias.push(`${ruta}: uno es una lista y el otro no`)
    return
  }
  if (Array.isArray(esperado)) {
    if (esperado.length !== obtenido.length) diferencias.push(`${ruta}: se esperaban ${esperado.length} elementos y llegaron ${obtenido.length}`)
    for (let i = 0; i < Math.min(esperado.length, obtenido.length); i++) comparar(esperado[i], obtenido[i], `${ruta}[${i}]`, diferencias)
    return
  }
  for (const clave of Object.keys(esperado)) {
    if (!(clave in obtenido)) diferencias.push(`${ruta}.${clave}: falta este campo`)
    else comparar(esperado[clave], obtenido[clave], `${ruta}.${clave}`, diferencias)
  }
}

console.log(`Motor: ${exe}`)
console.log(`FASTA: ${fasta}`)
console.log(`${pedidos.length} pedidos a comprobar\n`)

let bien = 0
const fallos = []
for (const pedido of pedidos) {
  const clave = pedido.join('__')
  const esperado = JSON.parse(readFileSync(join(carpetaMock, `${clave}.json`), 'utf8'))
  const { stdout, error } = await ejecutar(pedido)
  let obtenido
  try {
    obtenido = JSON.parse(stdout.replace(/^﻿/, '').trim())
  } catch {
    const comienzo = stdout.trim().slice(0, 80).replace(/\s+/g, ' ')
    fallos.push({ pedido, motivos: [comienzo ? `no imprimió JSON; empieza con: "${comienzo}"` : `no imprimió nada (${error?.code ?? 'sin código de error'})`] })
    continue
  }
  const diferencias = []
  comparar(esperado, obtenido, 'respuesta', diferencias)
  if (diferencias.length === 0) bien++
  else fallos.push({ pedido, motivos: diferencias })
}

// Los que fallan igual se agrupan para no repetir 218 veces el mismo motivo
const grupos = new Map()
for (const fallo of fallos) {
  const firma = `${fallo.pedido[0]}|${fallo.motivos[0].replace(/"[^"]*"/g, '"…"').replace(/\d+(\.\d+)?/g, 'N')}`
  if (!grupos.has(firma)) grupos.set(firma, [])
  grupos.get(firma).push(fallo)
}
for (const lista of grupos.values()) {
  const ejemplo = lista[0]
  console.log(`✗ ${ejemplo.pedido.join(' ')}${lista.length > 1 ? `   (y ${lista.length - 1} pedidos más de "${ejemplo.pedido[0]}" con el mismo problema)` : ''}`)
  for (const motivo of ejemplo.motivos) console.log(`    ${motivo}`)
}

console.log(`\n${bien} de ${pedidos.length} pedidos coinciden con el contrato.`)
process.exit(bien === pedidos.length ? 0 : 1)
