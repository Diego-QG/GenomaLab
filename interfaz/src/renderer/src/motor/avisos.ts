// Avisos de respuestas del motor que no cumplen el contrato (les falta algún campo).
// Los anota el cliente del motor al validar cada respuesta (ver validacion.ts) y los
// muestra el marco de la app, para que se sepa qué comando y qué campo faltó.

import { create } from 'zustand'
import type { NombreComando } from '@compartido/contrato'
import type { ProblemaDeCampo } from '@compartido/validacion'

export interface AvisoDeContrato {
  comando: NombreComando
  /** Argumentos del último pedido de este comando que llegó con problemas. */
  args: string[]
  /** Campos con problemas (sin repetir) en las respuestas de este comando. */
  problemas: ProblemaDeCampo[]
  /** true si alguna respuesta no se pudo usar porque faltó algo imprescindible. */
  bloqueante: boolean
  /** Cuántas respuestas de este comando llegaron con problemas. */
  veces: number
  hora: number
}

interface EstadoAvisos {
  avisos: AvisoDeContrato[]
  /** El panel con el detalle está desplegado. */
  abierto: boolean
  anotar: (comando: NombreComando, args: readonly string[], problemas: readonly ProblemaDeCampo[], bloqueante: boolean) => void
  vaciar: () => void
  abrir: (abierto: boolean) => void
}

const claveDe = (p: ProblemaDeCampo): string => `${p.ruta}|${p.consecuencia}|${p.motivo}`

export const useAvisos = create<EstadoAvisos>((set) => ({
  avisos: [],
  abierto: false,

  anotar(comando, args, problemas, bloqueante) {
    set((s) => {
      const previo = s.avisos.find((a) => a.comando === comando)
      const porClave = new Map((previo?.problemas ?? []).map((p) => [claveDe(p), p]))
      const habiaNuevos = problemas.some((p) => !porClave.has(claveDe(p)))
      for (const p of problemas) porClave.set(claveDe(p), p)
      const aviso: AvisoDeContrato = {
        comando,
        args: [...args],
        problemas: [...porClave.values()],
        bloqueante: (previo?.bloqueante ?? false) || bloqueante,
        veces: (previo?.veces ?? 0) + 1,
        hora: Date.now(),
      }
      return {
        // El más reciente, arriba
        avisos: [aviso, ...s.avisos.filter((a) => a.comando !== comando)],
        // Algo nuevo que contar: se despliega solo. Si es lo mismo de antes, no molesta.
        abierto: s.abierto || habiaNuevos || previo === undefined,
      }
    })
  },

  vaciar() {
    set({ avisos: [], abierto: false })
  },

  abrir(abierto) {
    set({ abierto })
  },
}))
