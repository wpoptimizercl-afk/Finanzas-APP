// Script temporal para extraer texto crudo de PDFs de Santander.
// Genera fixtures .txt usados por los parsers determinísticos.
// Ejecutar: node app/extract-text.js (desde raíz del proyecto)

import pdf from 'pdf-parse/lib/pdf-parse.js';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '__tests__/fixtures');

const FILES = [
    { pdf: 'estado-de-cuenta.pdf',          txt: 'santander-tc-latam-raw.txt',      label: 'TC Latampass (complejo)' },
    { pdf: 'life 01.pdf',                   txt: 'santander-tc-life-raw.txt',        label: 'TC Life (mínimo)' },
    { pdf: 'cartola-71.pdf',                txt: 'santander-cc-raw.txt',             label: 'CC cartola-71' },
    { pdf: 'estado-de-cuenta (7).pdf',      txt: 'santander-tc-latam-7-raw.txt',    label: 'TC Latampass (7)' },
    { pdf: 'estado-de-cuenta (8).pdf',      txt: 'santander-tc-latam-8-raw.txt',    label: 'TC Latampass (8)' },
    { pdf: 'cartola-72.pdf',                txt: 'santander-cc-72-raw.txt',          label: 'CC cartola-72' },
    { pdf: 'cartola-73.pdf',                txt: 'santander-cc-73-raw.txt',          label: 'CC cartola-73' },
    { pdf: 'cartola-linea de credito.pdf',  txt: 'santander-cl-raw.txt',             label: 'Línea de Crédito' },
];

for (const { pdf: pdfFile, txt, label } of FILES) {
    try {
        const buffer = readFileSync(resolve(FIXTURES, pdfFile));
        const data = await pdf(buffer);
        writeFileSync(resolve(FIXTURES, txt), data.text, 'utf8');
        console.log(`✓ ${label} → ${txt} (${data.numpages} páginas, ${data.text.length} chars)`);
    } catch (err) {
        console.error(`✗ ${label}: ${err.message}`);
    }
}
