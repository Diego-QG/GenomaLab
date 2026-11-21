// Dónde está cada cosa, en desarrollo (`npm run dev`) y en la app empaquetada.

import { app } from 'electron'
import { existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const NOMBRE_FASTA_PROYECTO = 'HIV2_ALL_2021_env_DNA.2000.fasta'

/** Dónde deja el ejecutable cada IDE, relativo a la carpeta `interfaz/`, en el orden en que se busca. */
const CARPETAS_DEL_MOTOR = ['../cmake-build-debug', '../cmake-build-release', '../bin/Debug', '../bin/Release', '..']

/**
 * Carpeta base de la interfaz:
 *  - en desarrollo, la carpeta `interfaz/`
 *  - empaquetada, la carpeta `resources/` junto al ejecutable
 */
export function carpetaBase(): string {
  return app.isPackaged ? process.resourcesPath : app.getAppPath()
}

/** FASTA del proyecto: `../data/` en desarrollo, `resources/data/` empaquetada. */
export function rutaFastaDelProyecto(): string | null {
  const candidatos = app.isPackaged
    ? [join(carpetaBase(), 'data', NOMBRE_FASTA_PROYECTO)]
    : [join(carpetaBase(), '..', 'data', NOMBRE_FASTA_PROYECTO)]
  return candidatos.find((ruta) => existsSync(ruta)) ?? null
}

/** Rutas donde puede estar el motor, en orden. */
export function rutasDelMotor(): string[] {
  const archivo = process.platform === 'win32' ? 'ProyectoGenomico.exe' : 'ProyectoGenomico'
  // Empaquetada, "interfaz/" es la carpeta donde está el .exe de la app (o el portable)
  const interfaz = app.isPackaged ? (process.env.PORTABLE_EXECUTABLE_DIR ?? dirname(process.execPath)) : carpetaBase()
  const rutas = CARPETAS_DEL_MOTOR.map((carpeta) => resolve(interfaz, carpeta, archivo))
  // La app empaquetada puede traer su propia copia en resources/motor/ (npm run preparar-motor)
  if (app.isPackaged) rutas.push(join(carpetaBase(), 'motor', archivo))
  return rutas
}

function esArchivo(ruta: string): boolean {
  try {
    return statSync(ruta).isFile()
  } catch {
    return false
  }
}

/** Busca el motor en las rutas conocidas. */
export function buscarMotor(): { exe: string | null; buscadas: string[] } {
  const buscadas = rutasDelMotor()
  return { exe: buscadas.find(esArchivo) ?? null, buscadas }
}
