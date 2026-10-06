# Contribuir a Sudoku diario

Este es un proyecto personal de [Crazyjmb](https://crazyjmb.com/). Puedes abrir una incidencia para comunicar un error o proponer una mejora. Para cambios amplios, describe primero el problema y la solución propuesta.

## Desarrollo

1. Crea un fork y una rama para tu cambio.
2. Usa Node.js 24 (consulta `.nvmrc`) e instala con `npm ci`.
3. Ejecuta `npm run dev` y reproduce el comportamiento que quieres modificar.
4. Haz un cambio centrado en el problema. Mantén TypeScript estricto y el estilo del código existente.
5. Ejecuta `npm test` y `npm run build`. Si cambias interacción, estilos, navegación, OCR o SEO, ejecuta también `npm run test:e2e` tras instalar Chromium con `npx playwright install chromium`.
6. Abre una pull request explicando el problema, el comportamiento final y las comprobaciones realizadas. Incluye capturas cuando cambie la interfaz.

La prueba de OCR real necesita internet. Las trazas pueden contener datos de las páginas visitadas: usa tableros y archivos de prueba, sin información personal.

## Compatibilidad que debemos conservar

- No alteres los tableros del generador `v1`: la fecha y dificultad deben seguir reconstruyendo el mismo sudoku. Un algoritmo nuevo requiere otra versión y conservar el anterior.
- Los números iniciales son inmutables. Una partida solo se completa con la solución correcta.
- Las pistas explican deducciones desde el tablero visible; no consultan la solución oculta ni rellenan casillas automáticamente.
- El diario y el tablero externo mantienen guardados independientes.
- Los guardados y copias de progreso existentes deben seguir funcionando. Documenta y prueba las migraciones.
- Las ayudas siguen siendo opcionales. Conserva los controles por teclado y el diseño móvil.

Consulta [la documentación técnica](docs/TECHNICAL.md) y [SEO.md](SEO.md) antes de modificar estas áreas.

## Archivos y licencia

Versiona el código y `package-lock.json`; excluye dependencias instaladas, `dist/`, informes de pruebas, secretos y exportaciones personales. No añadas dependencias sin explicar su utilidad.

Las contribuciones al código propio se ofrecen bajo la misma licencia [PolyForm Noncommercial 1.0.0](LICENSE), manteniendo [NOTICE](NOTICE). Solo aporta código y recursos que tengas derecho a distribuir bajo esos términos. Los componentes de terceros conservan sus licencias y atribuciones.
