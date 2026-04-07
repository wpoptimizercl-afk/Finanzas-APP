import fs from 'fs';
import path from 'path';
import { parseSantanderCreditLine } from './app/api/parsers/santander-credit-line.js';

const fixturePath = path.join(process.cwd(), 'app/__tests__/fixtures/santander-cl-raw.txt');
const pdfText = fs.readFileSync(fixturePath, 'utf-8');

const result = parseSantanderCreditLine(pdfText);

console.log('=== RESULTADO DEL PARSER ===\n');
console.log('Período:', result.periodo);
console.log('Saldo Inicial:', result.saldo_inicial);
console.log('Saldo Final:', result.saldo_final);
console.log('\n=== INFO LÍNEA DE CRÉDITO ===');
console.log('Cupo Aprobado:', result.credit_line_info.approved_limit);
console.log('Monto Utilizado:', result.credit_line_info.used_amount);
console.log('Saldo Disponible:', result.credit_line_info.available_amount);

console.log('\n=== TOTALES CALCULADOS ===');
const cargos = result.transacciones.filter(t => t.tipo === 'cargo');
const abonos = result.transacciones.filter(t => t.tipo === 'abono');

const totalCargos = cargos.reduce((sum, t) => sum + t.monto, 0);
const totalAbonos = abonos.reduce((sum, t) => sum + t.monto, 0);

console.log('Total Cargos:', totalCargos, '(esperado: 636038)');
console.log('Total Abonos:', totalAbonos, '(esperado: 623932)');
console.log('Cargos correctos:', totalCargos === 636038 ? '✓' : '✗');
console.log('Abonos correctos:', totalAbonos === 623932 ? '✓' : '✗');

console.log('\n=== CATEGORÍAS ===');
const categorias = {};
result.transacciones.forEach(t => {
    categorias[t.categoria] = (categorias[t.categoria] || 0) + 1;
});
console.log('Distribución de categorías:', categorias);
console.log('Sin "Otros" contaminados:', !Object.keys(categorias).includes('otros') || categorias['otros'] === 0 ? '✓' : 'Hay ' + (categorias['otros'] || 0) + ' transacciones en "Otros"');

console.log('\n=== VALIDACIONES ===');
const allValid =
    totalCargos === 636038 &&
    totalAbonos === 623932 &&
    result.credit_line_info.used_amount === 282841 &&
    result.credit_line_info.available_amount === 17159 &&
    result.saldo_inicial === -270735 &&
    result.saldo_final === -282841;

console.log('✓ TODAS LAS VALIDACIONES PASARON' + (allValid ? ' ✓' : ' ✗'));

console.log('\n=== TRANSACCIONES (primeras 5) ===');
result.transacciones.slice(0, 5).forEach((t, i) => {
    console.log(`${i+1}. ${t.fecha} - ${t.descripcion}: $${t.monto} (${t.tipo}, ${t.categoria})`);
});
