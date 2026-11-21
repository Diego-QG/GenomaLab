# Pendientes en el motor C++

Lo que la interfaz necesita del motor y **todavía no existe en el C++**. Aquí solo hay propuestas:
el código C++ no se tocó y lo implementa el estudiante. El formato JSON de cada comando está en
`BRIEF-INTERFAZ.md` (en la raíz del proyecto), sección 5; este documento no lo repite, solo dice
qué falta y aclara los casos que el brief dejaba abiertos.

> **Estado al 2026-11-20: documento histórico.** El motor ya responde con `--json` todos los
> comandos que usa la interfaz (`resumen`, `virus`, `kmers`, `trazakmers`, `buscar`, `grafo`,
> `heap`, `comparar`, `experimento`), y la interfaz ya no tiene modo simulado ni Ajustes: siempre
> ejecuta el `.exe` (ver README, "El motor C++"). Lo que sigue se conserva como registro de lo que
> se pidió. Única diferencia con la sección 4.1: una ventana descartada en `trazakmers` no trae
> `hash`, `inicio` ni `paso`, y la interfaz lo acepta así.

---

## 1. Lo principal: el modo `--json`

Hoy `main()` no recibe argumentos: carga un FASTA con ruta fija y muestra una demo del grafo.
La interfaz invoca al motor así, una vez por cada cosa que necesita:

```
ProyectoGenomico.exe --json <ruta\al\archivo.fasta> <comando> [args...]
```

Hace falta que `main` reciba `argc`/`argv` y, cuando el primer argumento sea `--json`:

1. lea el FASTA de la ruta que llega (absoluta, puede tener espacios);
2. ejecute el comando pedido;
3. imprima por `stdout` **un solo objeto JSON y nada más**.

Sin `--json`, `main` puede seguir haciendo lo que hace hoy.

Reglas de la salida (la interfaz las comprueba):

| Regla | Detalle |
|---|---|
| Solo JSON en `stdout` | Ni líneas de depuración ni mensajes sueltos. Hoy `leerFasta` imprime `No se pudo abrir: …` con `cout`; en modo `--json` eso rompería la respuesta. Lo que no sea JSON puede ir a `cerr` (la interfaz lo ignora). |
| Errores | `{ "ok": false, "error": "mensaje" }` cuando el archivo no abre, el ID no existe, el comando es desconocido o faltan argumentos. |
| Hashes como texto | `hash`, `hashPasos[].valor` y el `hash` de `trazakmers` van entre comillas: son `unsigned long long` y no caben en un número de JavaScript. |
| Decimales con punto | `43.11`, nunca `43,11`. |
| Textos escapados | Si un ID tuviera `"` o `\`, hay que escaparlos dentro del string JSON. |
| Código de salida | Da igual: la interfaz solo mira lo que se imprimió. |

---

## 2. Qué le falta a cada comando

Lo que ya existe sirve de base; la columna de la derecha es lo que habría que añadir.

| Comando | Ya existe en el C++ | Falta |
|---|---|---|
| `resumen` | `leerFasta`, `TablaVirus::insertar`, `getTamano`, `getColisiones` | Saber cuántos virus hay guardados (`cantidad` es privado). Recorrer las casillas ocupadas con su posición e ID (`ocupadas`). Recordar cada redimensionamiento: tamaño anterior, tamaño nuevo y número de inserción (desde 1) que lo provocó. Por cada virus: grupo (texto antes del primer punto), longitud, % GC sobre bases válidas y cantidad de ambiguas. |
| `virus <id>` | `TablaVirus::buscar` devuelve la posición | Poder leer el virus guardado en esa posición (hoy no hay forma de obtener la secuencia desde fuera de la clase). Lista de ambiguas con posición y letra. |
| `buscar <id>` | `hashTexto`, `TablaVirus::buscar` | Una versión que vaya anotando la traza: el valor de `h` después de cada letra, la casilla inicial, y cada casilla revisada (ocupada o no, qué ID tenía, si era igual). |
| `kmers <id> <k> <n>` | `TablaKmers` (doble hashing), `obtenerPares`, `MaxHeap` | **Variante con sondeo lineal** (paso = 1) para poder dar `colisiones.lineal`. Contar ventanas y descartadas. Leer `distintos` y las casillas ocupadas con su posición. |
| `trazakmers <id> <k> <metodo> <limite>` | `TablaKmers::insertar` | Una inserción que anote cada salto (casilla, qué k-mer había, resultado) para los dos métodos. |
| `heap <id> <k> <n>` | `MaxHeap::insertar`, `extraerMax` | Anotar los intercambios de `subir` y `bajar` (pares de índices, en orden) en cada operación. |
| `grafo <id> [limiteArcos]` | `GrafoPares::construirDe`, `getPeso` | Cantidad de parejas y de parejas inválidas. Los `arcosEjemplo` de las primeras `limiteArcos` parejas. |
| `comparar <id1> <id2>` | — | Similitud coseno (sobre los conteos de k-mers con k = 3 y k = 6, y sobre los 256 valores de la matriz) y la resta de las dos matrices. |
| `parecidos <id> <k>` | — | El coseno contra los otros virus, ordenado de mayor a menor. *(Prioridad 2.)* |
| `similitudes <k>` | — | La matriz completa de cosenos. *(Prioridad 2.)* |
| `experimento` | — | Colisiones de los dos métodos para todos los virus, con k = 3 y k = 6. *(Prioridad 2.)* |

Para la prioridad 1 de la interfaz bastan los ocho primeros.

---

## 3. Cosas encontradas al integrar

1. **`TablaKmers::getColisiones()` está declarada en `TablaKmers.h` pero no definida en
   `TablaKmers.cpp`.** Hoy no da error porque nadie la llama; en cuanto se use para `kmers`,
   el enlazador va a fallar con *undefined reference*.
2. **El `.exe` no arranca fuera de CLion** (código `0xC0000135`): le faltan las DLL de MinGW
   (`libstdc++-6.dll`, `libgcc_s_seh-1.dll`, `libwinpthread-1.dll`). No hace falta cambiar nada
   en el C++: la interfaz busca la carpeta del compilador en `cmake-build-debug/CMakeCache.txt`
   y la añade al `PATH` al lanzar el motor, y `npm run preparar-motor` copia esas DLL junto al
   `.exe` para la app empaquetada. Solo es bueno saberlo si se quiere correr el `.exe` a mano
   desde una terminal.
3. **`colisiones` de `TablaVirus` incluye las reinserciones.** `redimensionar()` vuelve a
   insertar todo y el contador no se reinicia, así que las 284 colisiones del archivo del proyecto
   suman las de cada crecimiento. No es un error; el modo simulado hace lo mismo para que el
   número coincida.
4. **La ruta del FASTA está fija en `main.cpp`** (`data/HIV2_…fasta`, relativa a la carpeta desde
   donde se ejecute). En modo `--json` la ruta llega como argumento.
5. **`resumen` todavía no trae todos los campos del contrato** (BRIEF, sección 5.1).
   - El `.exe` compilado en `cmake-build-debug/` (2026-11-13, 20:18) responde solo `ok`, `total`
     y `virus`; los 218 `virus` llegan con la forma correcta.
   - El `main.cpp` actual (más nuevo que ese `.exe`) ya agrega `tabla` con `tamano`, `cantidad`,
     `colisiones` y `factorCarga`.
   - Siguen faltando:
     - `archivo`: el nombre del FASTA (solo el nombre, sin carpetas);
     - `tabla.redimensiones`: cada crecimiento, con `de`, `a` y `enInsercion` (desde 1);
     - `tabla.ocupadas`: cada casilla ocupada, con `pos` e `id`.

   Antes, la falta de `tabla` dejaba la app en negro. Ahora la interfaz lo tolera: muestra el aviso
   **⚠ Incompleta** arriba (con el comando y los campos que faltan) y usa el nombre del archivo
   cargado en lugar de `archivo`. Sin `tabla`, el Explorador muestra un recuadro que lo explica en
   lugar del resumen de la TablaVirus. Sin `redimensiones`, ese resumen sale sin la línea de
   crecimientos. Sin `ocupadas`, Buscar funciona pero sin marcar las casillas ocupadas. Cuando el
   motor envíe esos campos, todo vuelve a verse completo sin tocar la interfaz.

---

## 4. Casos que el brief no definía

Así los resolvió la interfaz (y así responde el modo simulado). Si en el C++ resulta más natural
otra forma, se cambia la interfaz: avisar.

1. **`trazakmers`, k-mer descartado** (tiene una base ambigua). La inserción aparece igual, con
   esta forma:
   ```json
   { "ventana": 76, "kmer": "ARA", "hash": "0", "inicio": -1, "paso": 0,
     "saltos": [ { "pos": -1, "kmerEnCasilla": null, "resultado": "descartado" } ],
     "conteoFinal": 0 }
   ```
   También se acepta `"saltos": []`.
2. **`trazakmers`, `limite`** cuenta ventanas (posiciones de la secuencia), incluidas las descartadas.
   `ventana` es la posición donde empieza el k-mer, desde 0.
3. **`trazakmers`, último salto.** Cada inserción termina con un salto `nuevo` (casilla libre,
   `kmerEnCasilla: null`) o `sumado` (ya estaba, `kmerEnCasilla` = el mismo k-mer). Todos los
   anteriores son `colision`. `conteoFinal` es el conteo de ese k-mer después de insertar.
4. **`buscar`, casilla vacía.** El último paso de una búsqueda fallida es
   `{ "pos": 459, "ocupada": false, "idEnCasilla": null, "igual": false }`.
5. **`heap`, orden de inserción.** Los pares entran en el orden de `obtenerPares()` (el de las
   casillas de la tabla con doble hashing).
6. **`heap`, extraer con un solo elemento.** `swap(datos[0], datos[0])` puede anotarse como
   `[0, 0]` o no anotarse: la interfaz acepta las dos formas.
7. **`kmers`.** `casillas` va en orden de posición; `top` tiene `min(n, distintos)` elementos.
8. **`kmers` con k = 1.** La pantalla Detalle pide `kmers <id> 1 4` para dibujar la composición
   por base (cuántas A, C, G y T). Con `TablaKmers(1)` sale solo (tabla de 4 casillas). Si el
   motor rechaza k = 1, esa barra simplemente no se muestra.
9. **`grafo`.** `parejas` es el total (válidas e inválidas). En `arcosEjemplo`, `a` y `b` son las
   posiciones de las parejas en la secuencia cortada (una pareja inválida conserva su posición,
   así que sí cuenta para la distancia) y van en el orden de los dos `for`: `a` creciente y,
   dentro, `b` creciente.
10. **Decimales.** La interfaz muestra 2 (pesos, GC) o 4 (similitudes). Conviene imprimir al
    menos 4 decimales en similitudes y pesos.

---

## 5. Cómo comprobar el motor contra el contrato

Los archivos de `interfaz/mock/` son exactamente lo que debería imprimir el motor para el FASTA
del proyecto. Cada uno se llama `<comando>__<arg1>__<arg2>.json`; por ejemplo
`mock/buscar__HOLA.json` es la respuesta esperada de:

```
ProyectoGenomico.exe --json data\HIV2_ALL_2021_env_DNA.2000.fasta buscar HOLA
```

Para comparar todo de una vez, desde `interfaz/`:

```
npm run comparar-motor
```

Ejecuta el `.exe` con cada pedido que hay en `mock/` y lista las diferencias. Los decimales se
comparan con tolerancia, y si el motor imprime menos decimales que el mock (dos o más, por ejemplo
`0.27` en vez de `0.2735`) se da por bueno el redondeo.

Hasta dónde se puede confiar en los mocks como referencia:

- **Contrastado con las clases reales del proyecto** (compilándolas aparte, sin modificarlas):
  posiciones de los 218 virus en `TablaVirus`, tamaño y colisiones de la tabla, hashes, tablas de
  k-mers con doble hashing y sus colisiones, orden de salida del heap y matrices del grafo.
  Coincide en todo.
- **Sin nada con qué contrastar todavía** (no existe en el C++): el sondeo lineal, la forma de las
  trazas, el coseno y el experimento. Siguen la descripción del brief. El sondeo lineal reproduce
  el `25198` del ejemplo del brief (primer virus, k = 3), que es buena señal; lo demás es la
  lectura que se hizo del brief y puede necesitar ajustes cuando exista la versión en C++.

---

## 6. Opcional (no bloquea nada)

- **Secuencias para las tarjetas del Explorador.** El "código de barras" de cada tarjeta sale de
  `virus <id>`, así que el Explorador lanza el motor una vez por tarjeta visible (unas 30 al
  abrir, las 218 si se recorre todo). Funciona bien; si se quisiera una sola llamada, podría
  añadirse un comando `secuencias` → `{ "ok": true, "secuencias": [ { "id": "...", "secuencia": "..." } ] }`.
