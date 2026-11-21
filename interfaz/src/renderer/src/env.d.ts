/// <reference types="vite/client" />

import type { PuenteGenoma } from '@compartido/puente'

declare global {
  interface Window {
    /** Puente con el proceso principal (definido en src/preload/index.ts). */
    genoma: PuenteGenoma
  }
}

export {}
