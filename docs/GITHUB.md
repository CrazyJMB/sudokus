# Publicar el repositorio en GitHub

Esta guía prepara la publicación del código. La web se despliega por separado, según [SEO.md](../SEO.md).

## Presentación del repositorio

- Nombre sugerido: `sudokus`.
- Descripción: `Sudoku diario con pistas razonadas, historial y lectura de fotos. Un proyecto personal de Crazyjmb.`
- Website: `https://sudokus.crazyjmb.com/`.
- Topics sugeridos: `sudoku`, `vue3`, `typescript`, `vite`, `pinia`, `tesseract`, `puzzle`, `noncommercial`.
- Imagen social: `public/social-card.png`, disponible para cargar en la configuración de Social preview de GitHub.
- Licencia: PolyForm Noncommercial 1.0.0. El código es público y permite reutilización no comercial; conserva `LICENSE`, `NOTICE` y las atribuciones de terceros.

`private: true` en `package.json` evita publicar accidentalmente el paquete en npm. No impide que el repositorio de GitHub sea público.

## Primera subida

1. Crea en GitHub un repositorio **público y vacío**, sin generar README, `.gitignore` ni licencia: ya están incluidos aquí.
2. Revisa los archivos y prepara el commit desde la carpeta del proyecto:

   ```sh
   git status --short
   git diff --check
   git add .
   git diff --cached --stat
   git commit -m "docs: prepare public repository"
   ```

3. Copia la URL real del repositorio creado y configura el remoto. Sustituye `TU_USUARIO` y `TU_REPOSITORIO` en este ejemplo:

   ```sh
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git push -u origin main
   ```

   Si ya existe `origin`, revisa `git remote -v` y utiliza el remoto correcto. No sobrescribas una configuración existente sin comprobarla. Esta guía asume la rama `main`.

La subida incluye el historial de commits, con sus nombres y correos de autor. Revísalos antes de publicar. `.gitignore` excluye archivos locales nuevos, pero no elimina información que ya estuviera en el historial.

No subas `node_modules/`, `dist/`, `.env`, credenciales, informes de pruebas ni exportaciones personales. Conserva `package-lock.json`, los archivos de `public/` y los avisos de licencia.

## Después de subirlo

1. Completa la descripción, Website, topics y Social preview.
2. Comprueba la primera ejecución de **Actions → CI**. Ejecuta tests y build en Node 22/24 y las pruebas de navegador en Node 24; necesita acceso a npm, los navegadores de Playwright y jsDelivr para OCR.
3. Habilita los reportes privados de vulnerabilidades para ofrecer el canal descrito en [SECURITY.md](../SECURITY.md).
4. Activa las alertas de dependencias y la protección contra subida de secretos disponibles para el repositorio.
5. Si vas a aceptar contribuciones, puedes proteger `main` y exigir los checks de CI antes de fusionar cambios.

El workflow usa permisos de lectura y no necesita secretos de despliegue. En pull requests de forks, GitHub puede pedir al mantenedor que apruebe la ejecución de Actions. Las trazas e informes se conservan durante siete días.

La automatización está configurada en [ci.yml](../.github/workflows/ci.yml). Se basa en las guías oficiales de [GitHub Actions para Node.js](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs) y [Playwright en CI](https://playwright.dev/docs/ci-intro).
