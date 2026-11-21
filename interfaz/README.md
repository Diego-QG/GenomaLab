# Genoma Lab — interfaz

Interfaz de escritorio (Electron) del proyecto de análisis genómico con k-mers. No analiza nada por
su cuenta: le pide cada resultado al **motor en C++** y lo convierte en animaciones para ver, paso
a paso, cómo trabajan la tabla hash, el heap y el grafo.

Todo lo de esta carpeta es la interfaz. El motor (los `.cpp` y `.h` de la carpeta de arriba) no se
modifica desde aquí.

## Requisitos

- Windows 10 u 11.
- [Node.js](https://nodejs.org/) 22.12 o posterior (probado con 22.18) y npm.
- Conexión a internet la primera vez: `npm install` baja las dependencias y, al terminar, el
  binario de Electron (unos 130 MB).

## Instalar y ejecutar

Desde una terminal en esta carpeta (`interfaz/`):

```
npm install
npm run dev
```

Se abre la ventana de Genoma Lab. En **Inicio**, pulsa **Usar este archivo** para cargar el FASTA
del proyecto (`../data/HIV2_ALL_2021_env_DNA.2000.fasta`), o arrastra cualquier otro FASTA.

Si algo falla al arrancar:

- **PowerShell dice que *la ejecución de scripts está deshabilitada*:** usa `npm.cmd install` y
  `npm.cmd run dev`, o abre el Símbolo del sistema (cmd) en lugar de PowerShell.
- **`Error: Electron uninstall`:** falta el binario de Electron (Electron 45 ya no lo descarga
  solo; lo hace el paso `postinstall` de este proyecto). Ejecuta
  `node node_modules/electron/install.js` y vuelve a probar.
- **No aparece una ventana nueva:** solo puede haber una copia de Genoma Lab abierta a la vez; si
  ya hay una (por ejemplo, la app empaquetada), se enfoca esa.

## El motor C++

La app siempre ejecuta el motor del proyecto (`ProyectoGenomico.exe --json <fasta> <comando> …`) y
lee el JSON que imprime. No hay modo simulado ni ajustes: el ejecutable se busca solo, en este
orden, desde esta carpeta (`interfaz/`):

1. `../cmake-build-debug/ProyectoGenomico.exe` (CLion, Debug)
2. `../cmake-build-release/ProyectoGenomico.exe` (CLion, Release)
3. `../bin/Debug/ProyectoGenomico.exe` (Code::Blocks, Debug)
4. `../bin/Release/ProyectoGenomico.exe` (Code::Blocks, Release)
5. `../ProyectoGenomico.exe`

(En Linux y Mac, los mismos nombres sin `.exe`.) Al encontrarlo, la app comprueba que responda
JSON a `resumen`. Si no está en ninguna de esas rutas, o no arranca (por ejemplo, le faltan las
DLL de MinGW), en lugar de las pantallas aparece **"No se encontró el motor. Compila el proyecto
en CLion o Code::Blocks y vuelve a abrir la app"** con las rutas revisadas, y un botón **Buscar de
nuevo**. Si un comando concreto falla, esa vista muestra el error del motor y la ruta del `.exe`.

Las DLL de MinGW se buscan junto al `.exe` y en la carpeta del compilador que figura en
`CMakeCache.txt`, así que el motor compilado con CLion funciona aunque la app se abra fuera de CLion.

### Respuestas incompletas del motor

Cada respuesta se revisa contra el contrato antes de llegar a las pantallas
(`src/compartido/validacion.ts`). Mientras el motor se va completando, puede responder
`{ "ok": true, … }` sin algún campo; en ese caso:

- Arriba aparece **⚠ Incompleta**. Al hacer clic se ve, por comando, qué campo faltó o vino con
  otro tipo (por ejemplo `resumen` → `falta «tabla»`) y qué hace la interfaz al respecto.
- Si el campo se puede suplir, la pantalla sigue con lo que sí llegó: un número que falta se
  muestra como **—** (nunca como 0), una lista que falta queda vacía, y lo que no hay se explica
  en su lugar (por ejemplo, el recuadro de la TablaVirus cuando falta `tabla`).
- Si falta algo imprescindible (por ejemplo `operaciones` en `heap`), esa vista muestra
  "La respuesta del motor llegó incompleta" con el campo, y el resto de la app sigue funcionando.
  `resumen` sin `virus` no deja cargar el archivo y lo explica en Inicio.

Además, cada pantalla está protegida por una barrera de errores: si algo se cae al dibujarse, se
ve un mensaje con **Volver a intentar** en esa pantalla, en vez de una ventana en negro. La
navegación y el resto de pantallas siguen funcionando.

### Herramientas de desarrollo (no las usa la app)

`mock/` y `scripts/motor-simulado.mjs` quedaron de la etapa en que el motor todavía no respondía
JSON. La app ya no los lee; solo sirven para `npm run comparar-motor`, que ejecuta el `.exe` con
cada pedido de `mock/` y lista las diferencias (`npm run comparar-motor -- --solo resumen,buscar`
lo limita a algunos comandos), y para regenerarlos con `npm run mocks`.

## Pantallas

| Pantalla | Qué se ve | Comandos del motor |
|---|---|---|
| Inicio | Hélice 3D y carga del FASTA (botón o arrastrar) | `resumen` |
| Explorador | Los virus como tarjetas, buscador, filtro por grupo, resumen de la tabla hash y sus redimensionamientos | `resumen`, `virus` |
| Detalle | Secuencia completa coloreada, bases ambiguas, composición | `virus`, `kmers` (k = 1) |
| Buscar | El hash letra por letra, la casilla inicial y cada comparación | `buscar` |
| K-mers | Ventana deslizante y las dos tablas (sondeo lineal y doble hashing) a la vez; tabla final y top n | `trazakmers`, `kmers`, `virus` |
| Heap | Árbol binario y arreglo: inserciones, intercambios y extracciones | `heap` |
| Grafo | Parejas y arcos 1/distancia, matriz 16 × 16 y red de 16 nodos | `grafo`, `virus` |
| Comparar | Tres similitudes, las dos matrices y su diferencia | `comparar`, `grafo` |
| ¿A quién se parece? | Un virus contra todos los demás: ranking top 10 por similitud k = 6, con k = 3 y grafo | `comparar` (uno por virus) |
| Galaxia | Mapa 2D de todos los virus, coloreado por grupo; clic en un punto abre su Detalle | `kmers` con k = 3 (uno por virus) |
| Experimentos | Colisiones totales y promedio de sondeo lineal vs doble hashing (k = 3 y k = 6), % de reducción, exportar PNG | `experimento` |

Las vistas de **Análisis** que piden un comando por virus lo hacen con como mucho 4 procesos del
motor a la vez, muestran una barra de progreso y guardan lo que calculan mientras la app siga
abierta (al volver a la vista no se repite). No hay modo claro.

### Controles de las animaciones

| Tecla | Acción |
|---|---|
| Espacio | Reproducir / pausa |
| → y ← | Paso siguiente / anterior |
| Inicio | Volver al principio |
| + y − | Más rápido / más lento (de 0,25× a 64×) |
| F11 | Modo presentación: pantalla completa y todo un 20 % más grande |
| Esc | Salir del modo presentación |

La barra de avance también se puede arrastrar para ir a cualquier paso.

## Empaquetar a `.exe`

```
npm run empaquetar
```

Deja en `dist/` un ejecutable portable (`Genoma-Lab-0.1.0-portable.exe`) que no necesita instalación.
Dentro van la interfaz, el FASTA del proyecto y —si se encuentra en alguna de las rutas de arriba—
el motor con las DLL de MinGW que necesita fuera de CLion (las copia `npm run preparar-motor`, que
forma parte de `empaquetar`). La app empaquetada busca primero el motor junto a su ejecutable y,
si no, usa esa copia.

`npm run empaquetar:carpeta` hace lo mismo pero deja la app sin comprimir en `dist/win-unpacked/`
(más rápido para probar).

La primera vez, electron-builder descarga sus herramientas. Como el ejecutable no está firmado,
Windows puede mostrar el aviso *Windows protegió su PC*: **Más información → Ejecutar de todas formas**.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Abre la app en modo desarrollo (se recarga al guardar cambios) |
| `npm run build` | Compila la app a `out/` |
| `npm start` | Compila y abre la versión compilada |
| `npm run typecheck` | Revisa los tipos de TypeScript |
| `npm run mocks` | Regenera `mock/` con el simulador (solo desarrollo) |
| `npm run comparar-motor` | Compara la salida del `.exe` con `mock/` (solo desarrollo) |
| `npm run preparar-motor` | Copia el `.exe` y sus DLL a `motor/` para empaquetar |
| `npm run empaquetar` | Genera el `.exe` portable en `dist/` |

## Estado actual

- **Hecho:** el puente con el motor C++ (sin modo simulado), las pantallas 1 a 8 y las tres vistas
  de Análisis (¿A quién se parece?, Galaxia, Experimentos).
- **Pendiente:** el modo claro.
- **Transición Inicio → Explorador:** la hélice se deshace en piezas y las tarjetas entran volando
  desde ese punto. Es una aproximación de "las partículas se convierten en tarjetas": las piezas
  no se transforman una a una en tarjetas.
- **Tamaño de ventana:** pensada para 1440 × 800 o más. En modo presentación (pantalla completa,
  zoom 120 %) todo cabe a partir de 1536 × 864. Con la ventana al mínimo (1100 × 700), Buscar,
  K-mers y Comparar necesitan desplazamiento vertical.

## Carpetas

```
interfaz/
├─ src/
│  ├─ main/            proceso principal de Electron
│  │  ├─ index.ts      ventana y canales IPC
│  │  ├─ motor.ts      ejecutarMotor(): el puente con el .exe
│  │  └─ rutas.ts      dónde está cada cosa; búsqueda del motor
│  ├─ preload/         expone window.genoma a la pantalla (sin acceso a Node)
│  ├─ compartido/      tipos del contrato JSON y del puente; validacion.ts revisa cada respuesta
│  └─ renderer/        la interfaz (React)
│     └─ src/
│        ├─ pantallas/     una carpeta por pantalla
│        ├─ componentes/   piezas comunes (reproductor, bases, gráficos, marco)
│        ├─ motor/         cliente: pedir() y useMotor(); lote.ts (pedidos por virus, 4 a la vez); avisos
│        ├─ estado/        estado global (zustand)
│        └─ lib/           colores, formato
├─ mock/               respuestas de prueba (solo desarrollo; la app no las usa)
├─ scripts/            preparar-motor; simulador, generador de mocks y comparador (desarrollo)
├─ motor/              copia del motor para empaquetar (generada)
├─ PENDIENTES-CPP.md   lo que falta en el motor
└─ electron-builder.yml
```

## Cómo está hecha

- **Electron 45 + Vite 8 + React 19 + TypeScript 7**, con electron-vite. **Tailwind CSS 4** para
  estilos, **Motion** para animaciones, **D3** para escalas de color y **react-three-fiber** para
  la hélice.
- **Un solo puente.** La pantalla llama a `window.genoma.ejecutar(comando, args)`; en el proceso
  principal, `ejecutarMotor` lanza `ProyectoGenomico.exe --json <fasta> <comando> <args…>` y parsea
  el JSON de `stdout`.
- **La interfaz no calcula nada del dominio**: ni hashes, ni conteos, ni colisiones. Lo que hace
  con los datos es dibujar: ordenar y filtrar tarjetas, convertir conteos en porcentajes o anchos
  de barra, y "rebobinar" una traza hasta el paso que se está mostrando. La única excepción es
  **Galaxia**: con los conteos de 3-mers que da el motor, calcula en JavaScript la similitud coseno
  entre todos los virus y los proyecta en 2D con MDS clásico (hecho a mano, sin librerías).
- **Un reproductor común.** Cada animación es una lista de pasos, y lo que se ve es función de
  (traza, paso). Por eso reproducir, pausar, avanzar de a uno o arrastrar la barra funcionan igual
  en Buscar, K-mers, Heap y Grafo.
- **Colores de las bases**: A verde, C azul, G amarillo, T rojo, ambiguas en gris con trama. Los
  tonos están elegidos para distinguirse también con daltonismo.
