# SEO y publicación

La URL oficial es **https://sudokus.crazyjmb.com/**. El creador es **Crazyjmb**, con portfolio en **https://crazyjmb.com/**.

## Qué incluye el proyecto

- Título, descripción, idioma, autor y enlace canónico en `index.html`.
- Open Graph y Twitter Cards con imagen PNG de 1200 × 630 en `public/social-card.png`.
- Datos estructurados JSON-LD de la persona creadora, el sitio, la página y la aplicación, con referencias a Crazyjmb y su portfolio.
- Contenido visible sobre el juego, sus reglas, las pistas, el historial y el autor, disponible en el HTML inicial incluso sin JavaScript. Vue conserva ese contenido al montar la aplicación porque está fuera de `#app`.
- `public/robots.txt` permite rastrear y anuncia `https://sudokus.crazyjmb.com/sitemap.xml`.
- `public/sitemap.xml` contiene la portada canónica. `#resolver` y `#configuracion` son vistas de la misma página, no URLs independientes para indexar. Las partidas locales tampoco se publican en el sitemap.

La imagen social está incluida en el repositorio. Para modificarla, edita `scripts/render-social-card.mjs` y ejecuta `npm run seo:image` (requiere el Chromium de Playwright). La compilación normal no necesita ejecutar ese script ni instalar un navegador.

No se incluyen valoraciones inventadas ni promesas de resultados enriquecidos. El sitemap no usa fechas de modificación automáticas: regenerar un tablero para cada visitante no equivale a actualizar el contenido público de la página.

## Publicar y dar de alta en Google

1. Ejecuta `npm run build` y publica todo el contenido de `dist/` en la raíz de `https://sudokus.crazyjmb.com/`, incluidos `robots.txt`, `sitemap.xml` y `social-card.png`.
2. Comprueba que esas cuatro URLs devuelven HTTP 200 y su contenido real, sin autenticación, bloqueos para bots ni cabeceras `X-Robots-Tag: noindex`. Configura en el hosting la redirección permanente de HTTP a HTTPS y de `/index.html` a `/`. Las rutas inexistentes deben devolver 404; la navegación con fragmentos no necesita reenviar todas las rutas a `index.html`.
3. Abre [Google Search Console](https://search.google.com/search-console/) y añade la propiedad de prefijo `https://sudokus.crazyjmb.com/`. Si ya tienes verificado el dominio `crazyjmb.com`, comprueba su cobertura antes de hacer una nueva verificación.
4. Verifica la propiedad con el método que te ofrezca Google. Si eliges el archivo HTML, descarga el archivo exacto de tu cuenta, colócalo en `public/`, vuelve a compilar y publica. Si eliges DNS, añade el registro TXT proporcionado por Google en tu proveedor. No se puede crear un token válido de antemano.
5. En **Sitemaps**, envía `https://sudokus.crazyjmb.com/sitemap.xml`.
6. Usa **Inspección de URLs** para comprobar la portada publicada y solicitar su indexación. Revisa el HTML renderizado y vuelve más adelante para consultar cobertura y rendimiento.
7. Añade desde el portfolio `crazyjmb.com` un enlace visible a `https://sudokus.crazyjmb.com/`, por ejemplo «Sudoku diario — proyecto personal». Ese cambio se hace en el portfolio, que no pertenece a este repositorio.

Los archivos facilitan el descubrimiento, pero Google decide cuándo rastrear e indexar y no garantiza posiciones. Esta implementación local no realiza la publicación, la verificación de propiedad ni el envío del sitemap en tu cuenta.

## ¿Hace falta Google Analytics?

Para comenzar, **Search Console** permite comprobar búsquedas, impresiones, clics y problemas de indexación sin añadir un script de seguimiento al juego. Es la primera herramienta recomendada para este objetivo.

**Google Analytics 4** puede añadirse más adelante si necesitas medir visitas y eventos del juego, como empezar una partida, terminarla o pedir una pista. Actualmente no se instala ni se envían esos eventos. Para incorporarlo habría que configurar la propiedad y su ID de medición, decidir qué eventos son útiles y cómo gestionar privacidad y consentimiento.

## Verificación local

`npm run test:e2e` incluye pruebas que comprueban la autoría y los metadatos sin JavaScript, la coherencia del canónico y los datos estructurados, los archivos públicos, las dimensiones de la imagen social y la navegación desde los enlaces informativos en móvil. Estas comprobaciones no sustituyen la inspección de la URL ya publicada en Search Console.

Si cambia el dominio, actualiza `index.html`, `public/robots.txt`, `public/sitemap.xml`, `scripts/render-social-card.mjs` y `e2e/seo.e2e.ts`; regenera la imagen y recompila.

Referencias oficiales: [sitemaps de Google](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [SEO con JavaScript](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [verificación de propiedad](https://support.google.com/webmasters/answer/9008080), [Search Console](https://support.google.com/webmasters/answer/9128668) y [Google Analytics](https://support.google.com/analytics/answer/10089681).
