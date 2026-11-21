// Tipos del puente entre la interfaz (renderer) y el proceso principal de Electron.

import type { NombreComando, Respuesta } from './contrato'

/** Lo que se le dice a quien abre la app sin el motor compilado. */
export const AVISO_SIN_MOTOR = 'No se encontró el motor. Compila el proyecto en CLion o Code::Blocks y vuelve a abrir la app.'

export interface EstadoMotor {
  /** Ruta del ejecutable del motor (null = no está en ninguna de las rutas buscadas). */
  exe: string | null
  /** Rutas donde se buscó el motor, en orden. */
  buscadas: string[]
  /** Si el motor existe pero no se pudo ejecutar (no arranca o no responde JSON), por qué. */
  fallo: string | null
  /** Archivo FASTA en uso (null = todavía no hay ninguno). */
  fasta: { ruta: string; nombre: string } | null
  /** FASTA del proyecto (`data/`), si existe, para ofrecerlo en Inicio. */
  fastaDelProyecto: { ruta: string; nombre: string } | null
}

/** true si el motor se encontró y responde. */
export function motorListo(estado: EstadoMotor): boolean {
  return estado.exe !== null && estado.fallo === null
}

export interface PuenteGenoma {
  /** La única puerta al motor: ejecuta un comando y devuelve su JSON. */
  ejecutar<C extends NombreComando>(comando: C, args?: string[]): Promise<Respuesta<C>>
  estado(): Promise<EstadoMotor>
  /** Vuelve a buscar el motor y a comprobar que responde. */
  buscarMotor(): Promise<EstadoMotor>
  /** Cambia el FASTA en uso. `null` = el FASTA del proyecto. */
  usarFasta(ruta: string | null): Promise<EstadoMotor>
  /** Usa un archivo soltado sobre la ventana (arrastrar y soltar). */
  usarArchivoSoltado(archivo: File): Promise<EstadoMotor>
  /** Abre el diálogo para elegir un FASTA. Devuelve null si se cancela. */
  elegirFasta(): Promise<EstadoMotor | null>
  pantallaCompleta(activa: boolean): Promise<boolean>
  alCambiarEstado(oyente: (estado: EstadoMotor) => void): () => void
  alCambiarPantallaCompleta(oyente: (activa: boolean) => void): () => void
}
