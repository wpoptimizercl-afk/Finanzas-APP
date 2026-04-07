import fs from 'fs';
import path from 'path';
import { parseSantanderCreditLine } from './app/api/parsers/santander-credit-line.js';

const fixturePath = path.join(process.cwd(), 'app/__tests__/fixtures/santander-cl-raw.txt');
const pdfText = fs.readFileSync(fixturePath, 'utf-8');

const result = parseSantanderCreditLine(pdfText);

console.log('=== TODAS LAS TRANSACCIONES ===\n');
result.transacciones.forEach((t, i) => {
    console.log(`${i+1}. ${t.fecha} - ${t.descripcion}`);
    console.log(`   Monto: $${t.monto} (${t.tipo})`);
    console.log(`   Categoría: ${t.categoria}`);
});

console.log('\n=== ANÁLISIS ===');
const cargos = result.transacciones.filter(t => t.tipo === 'cargo');
const abonos = result.transacciones.filter(t => t.tipo === 'abono');

console.log(`\nTotal de cargos: ${cargos.length}`);
console.log(`Total de abonos: ${abonos.length}`);

const totalCargos = cargos.reduce((sum, t) => sum + t.monto, 0);
const totalAbonos = abonos.reduce((sum, t) => sum + t.monto, 0);

console.log(`\nSuma de cargos: ${totalCargos} (esperado: 636038)`);
console.log(`Suma de abonos: ${totalAbonos} (esperado: 623932)`);

// Listar cargos con montos mayores a 10k
console.log('\n=== CARGOS SOSPECHOSAMENTE GRANDES (>500k) ===');
cargos.filter(t => t.monto > 500000).forEach(t => {
    console.log(`${t.fecha} - ${t.descripcion}: $${t.monto}`);
});
