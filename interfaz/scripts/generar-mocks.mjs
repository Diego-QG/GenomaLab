#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  generar-mocks.mjs — crea las respuestas de prueba de interfaz/mock/.
//
//  Lee el FASTA real de ../data/ y usa scripts/motor-simulado.mjs (que imita los
//  algoritmos del motor) para escribir respuestas con el contrato exacto de la
//  sección 5 del brief. SOLO sirve para el "Modo simulado": no reemplaza al motor.
//
//  Uso:   npm run mocks            (o: node scripts/generar-mocks.mjs [archivo.fasta])
//
//  Cada archivo se llama  <comando>__<arg1>__<arg2>.json  y contiene lo mismo que
//  imprimiría:  genomico.exe --json <fasta> <comando> <arg1> <arg2>
//  (sirven también para comparar con la salida del motor en C++).
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cargar, ejecutar } from './motor-simulado.mjs'

const aqui = dirname(fileURLToPath(import.meta.url))
const carpetaMock = resolve(aqui, '..', 'mock')
const rutaFasta = resolve(process.argv[2] ?? join(aqui, '..', '..', 'data', 'HIV2_ALL_2021_env_DNA.2000.fasta'))

const motor = cargar(rutaFasta)
const ids = motor.virus.map((v) => v.id)

// Virus de demostración: el primero del archivo, uno humano del ejemplo del brief y uno de mono.
const preferidos = ['MAC.US.x.239.M33262', 'A.FR.02.LA36GomM.KU168287', 'SMM.US.x.SME543.U72748']
const demo = preferidos.filter((id) => ids.includes(id))
for (const id of ids) {
  if (demo.length >= Math.min(3, ids.length)) break
  if (!demo.includes(id)) demo.push(id)
}

/** Lista de pedidos [comando, ...args] que se dejan generados. */
const pedidos = [['resumen'], ['experimento'], ['similitudes', '3'], ['similitudes', '6']]
for (const id of ids) pedidos.push(['virus', id])
pedidos.push(['buscar', 'HOLA']) // un ID que no existe
for (const id of demo) {
  pedidos.push(['buscar', id])
  pedidos.push(['kmers', id, '1', '4']) // composición por base (k = 1)
  for (const k of ['3', '6']) {
    pedidos.push(['kmers', id, k, '10'])
    pedidos.push(['heap', id, k, '5'])
    pedidos.push(['parecidos', id, k])
  }
  for (const metodo of ['lineal', 'doble']) {
    pedidos.push(['trazakmers', id, '3', metodo, '400'])
    pedidos.push(['trazakmers', id, '6', metodo, '400'])
  }
  pedidos.push(['grafo', id])
  pedidos.push(['grafo', id, '8'])
}
for (let i = 0; i < demo.length; i++) {
  for (let j = 0; j < demo.length; j++) {
    if (i !== j) pedidos.push(['comparar', demo[i], demo[j]])
  }
}

// Carpeta limpia (solo se borran los .json generados antes)
mkdirSync(carpetaMock, { recursive: true })
for (const archivo of readdirSync(carpetaMock)) {
  if (archivo.endsWith('.json')) rmSync(join(carpetaMock, archivo))
}

const claves = []
const generados = []
let bytes = 0
for (const [comando, ...args] of pedidos) {
  const partes = [comando, ...args]
  if (!partes.every((p) => /^[A-Za-z0-9._-]+$/.test(p))) {
    console.warn(`  (omitido: "${partes.join(' ')}" no sirve como nombre de archivo)`)
    continue
  }
  const clave = partes.join('__')
  const respuesta = ejecutar(motor, comando, args)
  const texto = JSON.stringify(respuesta)
  writeFileSync(join(carpetaMock, `${clave}.json`), texto, 'utf8')
  claves.push(clave)
  generados.push(partes)
  bytes += texto.length
}

// Índice: para qué FASTA valen estos mocks y qué pedidos hay
const contenido = readFileSync(rutaFasta)
const indice = {
  nota: 'Generado por scripts/generar-mocks.mjs. Solo para el modo simulado.',
  fasta: {
    archivo: basename(rutaFasta),
    bytes: statSync(rutaFasta).size,
    sha256: createHash('sha256').update(contenido).digest('hex'),
  },
  claves,
  // Lo mismo, como listas [comando, ...args] (lo usa scripts/comparar-con-motor.mjs)
  pedidos: generados,
}
writeFileSync(join(carpetaMock, '_indice.json'), JSON.stringify(indice, null, 1), 'utf8')

console.log(`FASTA: ${rutaFasta}`)
console.log(`${motor.virus.length} virus · ${claves.length} respuestas · ${(bytes / 1024 / 1024).toFixed(1)} MB en ${carpetaMock}`)
