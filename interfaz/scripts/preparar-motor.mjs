#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  preparar-motor.mjs — copia el motor compilado a interfaz/motor/ para que
//  viaje dentro de la app empaquetada.
//
//  Copia (sin tocar nada fuera de interfaz/):
//    · el motor compilado: el primero que exista de ../cmake-build-debug,
//      ../cmake-build-release, ../bin/Debug, ../bin/Release o .. (o la ruta que se pase)
//    · las DLL de MinGW que el .exe necesita fuera de CLion
//      (se buscan en la carpeta del compilador que figura en CMakeCache.txt)
//
//  Uso:   npm run preparar-motor            (o: node scripts/preparar-motor.mjs <ruta\al\motor.exe>)
// ─────────────────────────────────────────────────────────────────────────────

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const destino = resolve(aqui, '..', 'motor')
const CARPETAS = ['cmake-build-debug', 'cmake-build-release', join('bin', 'Debug'), join('bin', 'Release'), '.']
const candidatos = CARPETAS.map((carpeta) => resolve(aqui, '..', '..', carpeta, 'ProyectoGenomico.exe'))
const exe = process.argv[2] ? resolve(process.argv[2]) : (candidatos.find((ruta) => existsSync(ruta)) ?? candidatos[0])

const DLL_DE_MINGW = ['libstdc++-6.dll', 'libgcc_s_seh-1.dll', 'libwinpthread-1.dll']

if (!existsSync(exe)) {
  console.log(`No se encontró el motor en ${exe}.`)
  console.log('La app se empaquetará sin motor: al abrirla mostrará "No se encontró el motor".')
  process.exit(0)
}

mkdirSync(destino, { recursive: true })
copyFileSync(exe, join(destino, 'ProyectoGenomico.exe'))
console.log(`Motor copiado: ${basename(exe)} → ${join(destino, 'ProyectoGenomico.exe')}`)

// Las DLL están junto al compilador con el que CLion construyó el .exe
let carpetaCompilador = null
try {
  const cache = readFileSync(join(dirname(exe), 'CMakeCache.txt'), 'utf8')
  const compilador = /^CMAKE_CXX_COMPILER:[A-Z]+=(.+)$/m.exec(cache)?.[1]?.trim()
  if (compilador) carpetaCompilador = dirname(normalize(compilador))
} catch {
  // sin CMakeCache.txt no se sabe dónde está MinGW
}

if (!carpetaCompilador) {
  console.log('No se encontró CMakeCache.txt junto al .exe: copia a mano las DLL de MinGW a interfaz/motor/ si el motor no arranca.')
} else {
  for (const dll of DLL_DE_MINGW) {
    const origen = join(carpetaCompilador, dll)
    if (existsSync(origen)) {
      copyFileSync(origen, join(destino, dll))
      console.log(`DLL copiada: ${dll}`)
    } else {
      console.log(`(no está ${dll} en ${carpetaCompilador})`)
    }
  }
}
