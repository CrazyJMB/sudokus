# shadcn-vue

Los archivos de `src/components/ui` provienen del registro oficial de shadcn-vue (estilo new-york-v4): https://v3.shadcn-vue.com/r/styles/new-york-v4/.
Se incluyen Button, Badge, Dialog, Select, Tabs, Progress y Switch. Se conservan los componentes originales; el tema se aplica en `src/style.css`.

https://github.com/unovue/shadcn-vue — MIT License

Copyright (c) 2023 unovue

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

# Tesseract.js

El reconocimiento óptico de las fotos utiliza Tesseract.js 7 y tesseract.js-core, bajo licencia Apache-2.0:

- https://github.com/naptha/tesseract.js
- https://github.com/naptha/tesseract.js-core
- https://www.apache.org/licenses/LICENSE-2.0

Se incluyen copias de la licencia en `public/licenses/tesseract-js.txt` y `public/licenses/tesseract-js-core.txt`, que se distribuyen junto a la web compilada.

El código del proyecto importa la biblioteca sin modificarla. El worker, el motor y los datos de idioma se descargan desde jsDelivr cuando se solicita la lectura de una foto. La imagen se procesa en el navegador.
