// Estado global de la interfaz: el motor, qué archivo hay cargado, en qué pantalla
// estamos y qué virus se está estudiando.

import { create } from 'zustand'
import type { RespuestaResumen } from '@compartido/contrato'
import { motorListo, type EstadoMotor } from '@compartido/puente'
import { pedir, vaciarGuardadas } from '@/motor/cliente'

export type Pantalla =
  | 'inicio'
  | 'explorador'
  | 'detalle'
  | 'buscar'
  | 'kmers'
  | 'heap'
  | 'grafo'
  | 'comparar'
  | 'parecidos'
  | 'galaxia'
  | 'experimentos'

export type OrigenFasta =
  | { tipo: 'proyecto' }
  | { tipo: 'dialogo' }
  | { tipo: 'archivo'; archivo: File }
  | { tipo: 'ruta'; ruta: string }

interface EstadoApp {
  motor: EstadoMotor | null
  resumen: RespuestaResumen | null
  cargando: boolean
  errorDeCarga: string | null

  pantalla: Pantalla
  /** true mientras el Explorador hace su entrada animada al llegar desde Inicio. */
  entradaPendiente: boolean
  virusActual: string | null
  virusComparado: string | null

  presentacion: boolean
  /** true mientras se vuelve a buscar el motor (botón del aviso). */
  buscandoMotor: boolean

  iniciar: () => Promise<void>
  cargarFasta: (origen: OrigenFasta) => Promise<boolean>
  ir: (pantalla: Pantalla, opciones?: { desdeInicio?: boolean }) => void
  terminarEntrada: () => void
  abrirVirus: (id: string, pantalla?: Pantalla) => void
  elegirVirus: (id: string) => void
  elegirComparado: (id: string) => void
  fijarPresentacion: (activa: boolean) => void
  buscarMotor: () => Promise<void>
}

let suscrito = false

function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Virus por defecto para comparar: el primero de otro grupo (o, si no hay, el siguiente). */
function otroVirus(resumen: RespuestaResumen, id: string | null): string | null {
  const actual = resumen.virus.find((v) => v.id === id)
  const deOtroGrupo = resumen.virus.find((v) => v.id !== id && v.grupo !== actual?.grupo)
  return (deOtroGrupo ?? resumen.virus.find((v) => v.id !== id))?.id ?? null
}

export const useApp = create<EstadoApp>((set, get) => ({
  motor: null,
  resumen: null,
  cargando: false,
  errorDeCarga: null,

  pantalla: 'inicio',
  entradaPendiente: false,
  virusActual: null,
  virusComparado: null,

  presentacion: false,
  buscandoMotor: false,

  async iniciar() {
    if (suscrito) return
    suscrito = true
    const puente = window.genoma

    puente.alCambiarEstado(aplicarEstado)

    // El modo presentación sigue a la ventana: da igual si se entró con el botón o con F11
    puente.alCambiarPantallaCompleta((activa) => {
      if (get().presentacion !== activa) set({ presentacion: activa })
    })

    aplicarEstado(await puente.estado())
  },

  async cargarFasta(origen) {
    const puente = window.genoma
    set({ cargando: true, errorDeCarga: null })
    try {
      let motor: EstadoMotor | null
      if (origen.tipo === 'dialogo') {
        motor = await puente.elegirFasta()
        if (motor === null) {
          set({ cargando: false }) // se canceló el diálogo
          return false
        }
      } else if (origen.tipo === 'archivo') {
        motor = await puente.usarArchivoSoltado(origen.archivo)
      } else {
        motor = await puente.usarFasta(origen.tipo === 'ruta' ? origen.ruta : null)
      }
      vaciarGuardadas()
      const resumen = await pedir('resumen', [], { fresco: true })
      const primero = resumen.virus[0]?.id ?? null
      set({
        motor,
        resumen,
        cargando: false,
        virusActual: primero,
        virusComparado: otroVirus(resumen, primero),
      })
      return true
    } catch (e) {
      set({ cargando: false, errorDeCarga: mensajeDe(e) })
      return false
    }
  },

  ir(pantalla, opciones) {
    if (pantalla !== 'inicio' && get().resumen === null) return // sin archivo cargado solo existe Inicio
    set({ pantalla, entradaPendiente: opciones?.desdeInicio === true })
  },

  terminarEntrada() {
    set({ entradaPendiente: false })
  },

  abrirVirus(id, pantalla = 'detalle') {
    get().elegirVirus(id)
    get().ir(pantalla)
  },

  elegirVirus(id) {
    const { resumen, virusComparado } = get()
    if (!resumen) return
    set({
      virusActual: id,
      virusComparado: virusComparado === id || virusComparado === null ? otroVirus(resumen, id) : virusComparado,
    })
  },

  elegirComparado(id) {
    set({ virusComparado: id })
  },

  fijarPresentacion(activa) {
    set({ presentacion: activa })
    void window.genoma.pantallaCompleta(activa)
  },

  async buscarMotor() {
    set({ buscandoMotor: true })
    try {
      aplicarEstado(await window.genoma.buscarMotor())
    } finally {
      set({ buscandoMotor: false })
    }
  },
}))

/**
 * Guarda el estado del motor que llega del proceso principal. Llega por dos vías
 * (el aviso de cambio y la respuesta a una acción) y en cualquier orden; la primera
 * que trae un cambio de fuente hace que los datos se vuelvan a pedir.
 */
function aplicarEstado(nuevo: EstadoMotor): void {
  const { motor: previo, resumen, cargando } = useApp.getState()
  useApp.setState({ motor: nuevo })
  if (previo === null) return
  const mismoArchivo = previo.fasta?.ruta === nuevo.fasta?.ruta
  if (previo.exe === nuevo.exe && mismoArchivo) return
  vaciarGuardadas() // todas las consultas en pantalla se repiten con la nueva fuente
  if (resumen !== null && mismoArchivo && !cargando && motorListo(nuevo)) {
    pedir('resumen', [], { fresco: true }).then(
      (datos) => useApp.setState({ resumen: datos, errorDeCarga: null }),
      // El motor nuevo no pudo responder: los datos del anterior no pueden quedarse en
      // pantalla. Se vuelve a Inicio con el error a la vista.
      (e: unknown) =>
        useApp.setState({
          resumen: null,
          virusActual: null,
          virusComparado: null,
          pantalla: 'inicio',
          errorDeCarga: mensajeDe(e),
        }),
    )
  }
}

/**
 * Nombre del FASTA en uso: el que dice el motor en `resumen.archivo` o, si no lo
 * envió, el del archivo que se cargó.
 */
export function useNombreArchivo(): string | null {
  return useApp((s) => s.resumen?.archivo ?? s.motor?.fasta?.nombre ?? null)
}

/** Datos del virus en estudio, tomados del resumen. */
export function useVirusActual() {
  return useApp((s) => s.resumen?.virus.find((v) => v.id === s.virusActual) ?? null)
}
