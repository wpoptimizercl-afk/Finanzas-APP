import fs from 'fs';
import path from 'path';

// Manually trace the balance tracking logic
const fixturePath = path.join(process.cwd(), 'app/__tests__/fixtures/santander-cl-raw.txt');
const pdfText = fs.readFileSync(fixturePath, 'utf-8');
const lines = pdfText.split('\n').map(l => l.trim()).filter(Boolean);

// Extract relevant lines
const txLines = [];
let inTransactions = false;
for (const line of lines) {
    if (/DETALLE DE MOVIMIENTOS/.test(line)) { inTransactions = true; continue; }
    if (/Resumen de Comisiones/.test(line)) { inTransactions = false; continue; }
    if (inTransactions && line.match(/^(\d{2}\/\d{2})/)) txLines.push(line);
}

console.log(`Found ${txLines.length} transaction lines\n`);

// Show each transaction line
txLines.forEach((line, i) => {
    console.log(`${i+1}. ${line}`);
});

// Now manually extract the amounts and dailyBalance
const TX_LINE_RE = /^(\d{2}\/\d{2})(Agustinas|O\.Gerencia|OPER\.|Sucursal\s+\w+)(.+)$/;

console.log('\n=== EXTRACTED AMOUNTS ===\n');

txLines.forEach((line, i) => {
    const mLine = line.match(TX_LINE_RE);
    if (!mLine) return;

    const rest = mLine[3];
    let body = rest;

    // Remove doc number if present
    const DCTO10_RE = /^(\d{10})\s*/;
    const dMatch = body.match(DCTO10_RE);
    if (dMatch) body = body.slice(dMatch[0].length);

    // Extract amounts using the same regex
    const cargoMatch = body.match(/(\d{1,3}(?:\.\d{3})+)-(\d{1,3}(?:\.\d{3})+)$/);
    const abonoMatch = body.match(/(\d{1,3}(?:\.\d{3})+)$/);

    let monto, tipo, dailyBalance;
    if (cargoMatch) {
        monto = parseInt(cargoMatch[1].replace(/\./g, ''));
        dailyBalance = parseInt(cargoMatch[2].replace(/\./g, ''));
        tipo = 'cargo';
    } else if (abonoMatch) {
        monto = parseInt(abonoMatch[1].replace(/\./g, ''));
        dailyBalance = null;
        tipo = 'abono';
    }

    console.log(`${i+1}. Monto: ${monto}, Tipo: ${tipo}, DailyBalance: ${dailyBalance}`);
});
