# Sudoku diario

Web estática en Vue 3 + TypeScript + Pinia + shadcn-vue + Tailwind CSS 4. No tiene backend, cuentas ni llamadas a una API para crear los sudokus.

Por defecto se abre en **difícil y sin ayudas**, con números en tinta neutra y únicamente un borde para identificar la casilla en la que escribes. No hay resaltado de números iguales, fila, columna o bloque; tampoco avisos rojos, contadores, porcentaje de avance ni eliminación automática de notas. Las notas se escriben a mano con el modo Notas.

El botón de configuración permite activar cada ayuda por separado y elegir el nivel que se abre al entrar. Las preferencias se guardan automáticamente y la configuración tiene su propia vista (`#configuracion`). Cambiar temporalmente el nivel de una partida no cambia el nivel predeterminado.

## Ejecutar y compilar

Necesitas Node.js 22.12+ o 24 LTS.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

`npm run build` comprueba TypeScript y crea `dist/`. Sube **el contenido de esa carpeta** a cualquier hosting estático (Cloudflare Pages, GitHub Pages o tu hosting con acceso SSH). La app usa una sola página y rutas relativas; también puede servirse dentro de una subcarpeta. Debes servirla por HTTP/HTTPS: abrir `index.html` con `file://` no permite cargar correctamente los módulos y el Web Worker. `node_modules` no se necesita en el servidor.

## La fórmula diaria

```ts
import { generateSudoku } from "./src/domain/sudoku";

const puzzle = generateSudoku("2026-10-02", "medium");
// puzzle.givens: 81 números; 0 representa una casilla vacía.
// puzzle.solution: los 81 números de su única solución.
// puzzle.clues, puzzle.rating, puzzle.date, puzzle.difficulty, puzzle.id.
```

La semilla se obtiene de:

```text
sudoku-diario:v1:2026-10-02:medium
```

1. Se valida la fecha ISO `AAAA-MM-DD`.
2. FNV-1a convierte esa cadena en una semilla de 32 bits.
3. Mulberry32 produce una secuencia pseudoaleatoria reproducible.
4. Un solucionador de restricciones con selección de la casilla más restringida crea una cuadrícula completa. El orden de sus candidatos se baraja con esa secuencia.
5. Se retiran números en un orden barajado. Solo se acepta una retirada cuando el tablero sigue teniendo exactamente **una** solución; la búsqueda se detiene al encontrar dos.
6. Un evaluador lógico clasifica el tablero y la generación se detiene al cumplir los requisitos del nivel.

No se usa `Math.random()` ni una fecha implícita dentro del motor. La misma versión, fecha y dificultad reconstruye los mismos números en todos los equipos. La dificultad forma parte de la semilla: cada nivel tiene su propio tablero y progreso.

### Dificultad

| Nivel   | Requisito lógico                                                                                                        | Condición adicional                 |
| ------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Fácil   | Se resuelve con candidatos únicos y únicos ocultos.                                                                     | Se detiene en 39 números iniciales. |
| Media   | Se resuelve incorporando candidatos bloqueados o pares desnudos, y el evaluador necesita al menos una de esas técnicas. | 33 números iniciales o menos.       |
| Difícil | El evaluador de esos métodos no puede completarlo; requiere otras técnicas o búsqueda.                                  | 28 números iniciales o menos.       |

La dificultad es una clasificación práctica, no una escala universal ni una garantía de una técnica avanzada concreta. **No depende únicamente del número de huecos.** En el nivel medio se rechazan retiradas que superen los métodos intermedios. Se permiten hasta 100 intentos deterministas para encontrar el nivel pedido; si se agotan, aparece un error recuperable, sin devolver un tablero de dificultad incorrecta.

El cálculo se ejecuta en un **Web Worker** para mantener la interfaz disponible. Cambiar de partida cancela el cálculo anterior. En Node, el mismo motor puro funciona sin Worker.

### Versionado: conservar tableros antiguos

`GENERATOR_VERSION = 'v1'` forma parte de la semilla, de cada ID y de la clave de guardado. **No cambies el algoritmo v1 una vez publicado.** Cualquier cambio que altere los tableros debe introducir una versión nueva y conservar el generador anterior para las partidas v1. Esta primera versión solo necesita v1; no incluye una migración a un motor futuro.

La aleatoriedad no es criptográfica. Existe un espacio finito de sudokus: la semilla no ofrece una prueba matemática de que nunca pueda repetirse un tablero en cualquier fecha imaginable. La generación produce tableros diferentes en el conjunto de fechas comprobado.

## Racha e historial

La fecha del dispositivo define hoy. Se obtiene con año, mes y día locales, evitando `toISOString().slice(0, 10)`, que puede cambiar el día al convertir a UTC. Para sumar o restar fechas civiles se usa aritmética UTC independiente del horario de verano.

- Resolver un sudoku de **hoy durante hoy** acredita ese día.
- Resolver varias dificultades el mismo día acredita **un solo día**.
- Resolver un sudoku antiguo se guarda como completado y aumenta el total de sudokus, pero **no suma, mantiene ni repara** días de racha.
- Si ayer está acreditado y hoy sigue pendiente, se muestra la racha de ayer mientras aún puedes continuarla.
- Al llegar la medianoche después de un día omitido, la racha actual pasa a cero. La mejor racha se conserva.
- Una partida terminada después de medianoche se registra en su fecha de finalización; si el tablero es del día anterior, no acredita racha.
- Se bloquean fechas futuras en el calendario y en la acción de apertura.

Ejemplo: completaste el 1 y el 3 de octubre en sus respectivos días. Resolver el sudoku del 2 de octubre el día 4 añade una partida al historial, pero no convierte aquellos días en una racha de tres.

El calendario distingue días completados, en curso y sin empezar. Permite elegir cualquier fecha anterior y saltar directamente con un campo de fecha. El listado de partidas permite volver al nivel exacto que jugaste.

## Pinia y localStorage

`src/stores/sudoku.ts` gestiona partidas, preferencias, selección, notas y deshacer. `persistSudoku()` usa `$subscribe()` para persistir **solo** datos duraderos: las partidas y todas las preferencias de configuración.

Clave: `sudoku-diario:v1:state`.

```ts
interface SavedGame {
  date: string;
  difficulty: "easy" | "medium" | "hard";
  values: number[]; // 81 casillas
  notes: number[]; // 81 máscaras de candidatos
  startedAt: string; // instante ISO
  completedAt: string | null;
  completedOn: string | null; // fecha civil del dispositivo al completar
}
```

La racha se calcula a partir de las partidas cuyo `completedOn === date`; nunca se incrementa un contador manual de racha. El guardado incluye una versión de esquema y validación de fechas, IDs, números y notas. Al abrir una partida se reconstruye el tablero, se protegen sus números iniciales y se comprueba su estado completado. La solución se regenera y no se persiste en el guardado.

El esquema de guardado es ahora `2`; se conserva la misma clave y el generador `v1`. Los guardados anteriores con esquema `1` se migran conservando todas las partidas, con difícil como nivel predeterminado y las ayudas desactivadas. No cambian los tableros diarios anteriores.

Un error de lectura, bloqueo o falta de espacio muestra un aviso y permite seguir jugando. No se sobrescribe un guardado corrupto o incompatible durante esa sesión, salvo que importes explícitamente una copia válida para recuperarlo. El progreso guardado es local al **navegador y origen**: para otro equipo o navegador utiliza la exportación/importación. No hay sincronización automática entre pestañas o dispositivos ni cuentas. El historial está pensado para uso personal, sin protección frente a edición de localStorage o cambios del reloj del dispositivo.

## Exportar e importar progreso

1. Abre **Configuración** en el dispositivo de origen y pulsa **Exportar progreso**.
2. Guarda el archivo `sudoku-diario-progreso-AAAA-MM-DD.json` y pásalo al otro dispositivo.
3. Allí, abre **Configuración**, pulsa **Elegir archivo** y selecciona esa exportación.
4. Se comprueba el formato y cada partida. Revisa el resumen y pulsa **Importar progreso**.

La copia incluye partidas en curso, notas manuales, historial, fechas de finalización y preferencias. La racha se reconstruye con las fechas originales: una importación no convierte un sudoku antiguo en uno resuelto hoy. Las partidas quedan disponibles en Historial y en el calendario.

Se combinan las partidas del archivo con las del navegador. Una partida completada se conserva frente a una versión en curso. Si una misma partida aparece completada en ambos dispositivos, se conserva su crédito de racha original si existe en cualquiera. Si ambas versiones están en curso, se usa la del archivo. También se restauran las preferencias del archivo.

La importación admite archivos JSON de hasta **10 MB**. Verifica formato y versiones, IDs, fechas, los 81 números y máscaras de notas, los números iniciales de cada tablero y las soluciones declaradas como completadas. Esa última comprobación se ejecuta en un Web Worker para mantener la interfaz disponible. Un archivo inválido se rechaza completo, sin cambiar el progreso. Antes de aplicar una copia validada, se comprueba que el navegador puede guardarla; si no puede, la importación no cambia el estado existente. La copia no incluye soluciones ni el historial temporal para deshacer.

## Controles

- Selecciona una casilla y usa los botones del 1 al 9, o el teclado.
- Flechas: moverse por el tablero.
- `N`: activar/desactivar notas. El mismo número alterna su nota.
- `Supr`, `Retroceso` o `0`: borrar.
- `Ctrl+Z` o `Cmd+Z`: deshacer hasta 100 movimientos de la partida abierta.
- Las casillas iniciales son inmutables. Si activas los avisos en configuración, las rojas indican repeticiones visibles, no una comparación secreta con la solución.
- La partida se completa automáticamente solo cuando todos los números coinciden con la solución única.
- No hay penalizaciones por errores ni pistas que resuelvan automáticamente casillas.

Las notas se conservan tal como las escribes. Solo se retiran notas incompatibles de otras casillas si activas **Borrar notas automáticamente**. Deshacer restaura tanto números como notas. Los movimientos para deshacer no se conservan al recargar, cambiar de partida o importar progreso.

## Pistas explicadas

El botón **Pedir una pista** analiza los números visibles sin consultar la solución ni las notas manuales. Calcula la intersección de los números disponibles en fila, columna y bloque, y encadena candidatos únicos, únicos ocultos, candidatos bloqueados, parejas desnudas, parejas ocultas y X-Wing. Cada eliminación indica las casillas y los números afectados. F1 C1 es la primera fila y primera columna; los bloques se numeran de izquierda a derecha y de arriba abajo.

Las pistas señalan dónde mirar y explican el razonamiento; no escriben números, cambian preferencias ni borran notas. Se cierran automáticamente si cambia el tablero. El motor avisa de repeticiones y contradicciones deducibles. No usa búsqueda, adivinación ni una IA generativa: cuando estas técnicas no bastan, lo indica. Parte de que los números introducidos son correctos; no certifica que un tablero externo tenga solución única ni detecta necesariamente todas las contradicciones globales.

## Resolver sudokus externos y leer fotos

Abre **Resolver otro sudoku** (icono de escáner en la cabecera o enlace bajo el tablero). La página `#resolver` ofrece un tablero vacío: todas sus casillas se pueden editar con teclado, teclado numérico móvil o los botones. Usa **Pedir una pista** para obtener las mismas explicaciones que en el sudoku diario.

El tablero externo se guarda aparte con la clave `sudoku-diario:external:v1`. No altera partidas, rachas ni exportaciones del juego diario. **Deshacer** permite recuperar cambios, borrados e importaciones durante la sesión.

Para importar una foto:

1. Pulsa **Hacer foto** en un móvil con cámara o **Elegir imagen** para abrir una foto. En equipos sin captura de cámara, el navegador ofrece un selector de archivos.
2. Si hace falta, gira la imagen. Marca las esquinas exteriores en este orden: superior izquierda, superior derecha, inferior derecha, inferior izquierda. También puedes usar las flechas y Enter.
3. Revisa la cuadrícula recortada y pulsa **Leer números**. Puedes cancelar sin cambiar el tablero.
4. Pulsa **Usar lectura y revisar** para sustituir el tablero externo. Compara todas las casillas con la foto, incluidas las vacías; corrige errores y confirma **He revisado los números** para habilitar las pistas. Las casillas ámbar son dudosas y las rojas tienen números repetidos.

Se admiten imágenes de hasta 20 MB que el navegador pueda decodificar (por ejemplo JPG, PNG y WebP). El procesamiento corrige la perspectiva, recorta las 81 casillas y reconoce sus cifras con [Tesseract.js](https://github.com/naptha/tesseract.js). Las fotos se procesan localmente y no se guardan; solo se guardan los números y el estado de revisión. El lector se carga al usar OCR y descarga su worker, motor WebAssembly y modelo de idioma desde jsDelivr. La primera lectura requiere internet; la disponibilidad posterior depende de la caché del navegador. El resto de la aplicación no depende del OCR ni de esas descargas.

El OCR funciona mejor con cifras impresas, una cuadrícula completa, buena luz y una foto nítida. Las cifras manuscritas, notas pequeñas, sombras o bordes mal marcados pueden producir errores. La lectura siempre pasa por revisión humana y nunca rellena cifras mediante la solución del sudoku. Se ha probado en Chromium con una imagen de sudoku impreso; falta comprobar una variedad de fotografías y cámaras físicas.

## Estructura

| Archivo                                      | Responsabilidad                                                       |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `src/domain/utils/random.ts`                 | Hash, PRNG y barajado determinista.                                   |
| `src/domain/sudoku/index.ts`                 | Generación, solución, unicidad, evaluación y conflictos.              |
| `src/domain/sudoku/hints.ts`                 | Deducciones puras y explicaciones de pistas, sin acceder a la solución. |
| `src/composables/useLogicalHints.ts`         | Petición, resaltado y descarte de pistas cuando cambia el tablero. |
| `src/infrastructure/ocr/`                   | Lectura de imágenes, corrección de perspectiva y OCR cancelable. |
| `src/stores/external-sudoku.ts`              | Tablero externo, revisión de OCR, deshacer y guardado independiente. |
| `src/views/ExternalSolverView.vue`          | Página para resolver un sudoku externo. |
| `src/components/hints/`, `src/components/solver/` | Explicaciones, tablero editable y flujo de importación por foto. |
| `src/domain/dates/index.ts`                  | Fechas civiles y formato.                                             |
| `src/domain/history/index.ts`                | Historial y reglas puras de racha.                                    |
| `src/domain/storage/index.ts`                | Preferencias, migración, formato de copias y combinación de partidas. |
| `src/infrastructure/async/backup-async.ts`   | Comprobación de importaciones fuera del hilo de interfaz.             |
| `src/workers/sudoku.worker.ts`               | Generación y validación de partidas fuera del hilo de interfaz.       |
| `src/infrastructure/async/generate-async.ts` | Worker, cancelación y errores.                                        |
| `src/stores/sudoku.ts`                       | Pinia, partidas y persistencia.                                       |
| `src/components/SudokuBoard.vue`             | Tablero accesible y teclado.                                          |
| `src/components/DigitPad.vue`                | Números y herramientas.                                               |
| `src/components/HistoryCalendar.vue`         | Navegación por fechas y estados.                                      |
| `src/components/HistoryList.vue`             | Partidas por fecha y dificultad.                                      |
| `src/components/SettingsPanel.vue`           | Configuración y exportación/importación de progreso.                  |
| `src/components/ui/`                         | Componentes oficiales de shadcn-vue.                                  |
| `src/App.vue`, `src/style.css`               | Composición y tema adaptable a móvil.                                 |

## Comprobaciones

Las pruebas de `npm test` verifican reproducción por semilla, 36 combinaciones de fecha y nivel, soluciones únicas, clasificación lógica, cambios de año y horario de verano, rachas sin crédito retroactivo, completado al cruzar medianoche, protección de números iniciales, deshacer y persistencia tras recarga. También comprueban las ayudas desactivadas por defecto y activables, la conservación de notas manuales, la migración de guardados antiguos, el traslado completo entre dispositivos, la protección de partidas completadas y el rechazo de importaciones inválidas o sin espacio. Las nuevas pruebas cubren deducciones y eliminaciones frente a soluciones conocidas, pares ocultos, X-Wing, contradicciones, invalidación de pistas, aislamiento del tablero externo y geometría de las fotos. `npm run build` verifica los tipos de todos los componentes.

`npm run test:e2e` comprueba en Chromium las pistas del diario, la edición y persistencia externas, navegación y anchura móvil, OCR real de un sudoku impreso y cancelación. Requiere tener Chromium instalado (`npx playwright install chromium`); la prueba de OCR necesita conexión para cargar el lector. Playwright inicia el servidor en el puerto 4174. Las capturas y trazas quedan en `test-results/`.

Referencias del stack: [Pinia: estado y suscripciones](https://pinia.vuejs.org/core-concepts/state.html), [shadcn-vue](https://www.shadcn-vue.com/), [Reka UI](https://reka-ui.com/) y [Vite](https://vite.dev/). La atribución de los componentes se incluye en `THIRD_PARTY_NOTICES.md`.
