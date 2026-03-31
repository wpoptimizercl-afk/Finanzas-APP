/**
 * Parser determinístico para "Estado de Cuenta en Moneda Nacional de Tarjeta de Crédito"
 * de Santander Chile. Sirve para Visa Life (XXXX-6733) y Visa Platinum Latam (XXXX-2901),
 * ya que ambas comparten el mismo formato de texto.
 *
 * Formato del texto extraído por pdf-parse (observable en fixtures *-raw.txt):
 *
 * TIPO A — cuota (empieza con fecha inmediatamente seguida de $):
 *   DD/MM/YY$ AMOUNT1$ AMOUNT2RATE%TYPE$CHARGENN/TTMERCHANT
 *   Ej: 21/08/25$ 116.980$ 116.9800,00 %N/CUOTAS PRECIO$9.74807/12SAN DIEGO LTDA
 *
 * TIPO B — compra normal (fecha seguida de letra de ubicación):
 *   DD/MM/YYLOCATION$MONTO MERCHANT
 *   Ej: 29/01/26SANTIAGO$5.290JUMBO PENALOLEN
 *
 * TIPO B moneda extranjera:
 *   DD/MM/YYCOUNTRY_CODELOCATION FOREIGN_AMOUNT,DECIMALS$CLP_MONTO MERCHANT
 *   Ej: 10/02/26ARUSPALLATA     5.000,00$3.247KM1151 APIES 2697 TIEN
 *
 * MONTO CANCELADO (ignorar):
 *   DD/MM/YY$ -AMOUNTMONTO CANCELADO
 */

import { parseChileanAmount, parseDateDDMMYY, toTitleCase } from './chilean-amount.js';
import { categorizeTCTransaction } from './category-rules.js';

// ── Regex ────────────────────────────────────────────────────────────────────

// Fecha al inicio de línea (DD/MM/YY o DD/MM/YYYY)
const DATE_PREFIX = /^\d{2}\/\d{2}\/\d{2,4}/;

// TIPO A: fecha$ amount$ amount rate% type $charge nn/tt merchant
const TIPO_A_RE = /^(\d{2}\/\d{2}\/\d{2,4})\$ (\d{1,3}(?:\.\d{3})*)\$ (\d{1,3}(?:\.\d{3})*)(\d+,\d+ %)(.*?)\$(\d{1,3}(?:\.\d{3})*)(\d{2}\/\d{2})(.+)$/;

// TIPO B: fecha + (todo menos $) + $ + monto_chileno + merchant
const TIPO_B_RE = /^(\d{2}\/\d{2}\/\d{2,4})[^$]*\$(\d{1,3}(?:\.\d{3})*)(.+)$/;

// Total operaciones: "1. TOTAL OPERACIONES$ 1.273.912"
const TOTAL_OPS_RE = /1\. TOTAL OPERACIONES\$? ?([\d.]+)/;

// Total facturado: label en una línea, el $ en la siguiente (regex multilinea)
const TOTAL_FACT_RE = /MONTO TOTAL FACTURADO A PAGAR[\s\S]{1,60}?\$\s*([\d.]+)/;

// Periodo: en header "DD/MM/YYYYFECHA ESTADO DE CUENTA" → periodo_hasta
const HASTA_RE = /(\d{2}\/\d{2}\/\d{4})FECHA ESTADO DE CUENTA/;

// Page break markers: "DE15", "DE25", etc. (dígitos + DE + dígito)
const PAGE_BREAK_RE = /^DE\d+\d$/;

// Sección 3: "3. CARGOS, COMISIONES, IMPUESTOS Y ABONOS$ N"
const SEC3_RE = /^3\. CARGOS, COMISIONES/;

// Sección 4: "4. INFORMACION COMPRAS EN CUOTAS EN EL PERIODO$ N"
const SEC4_RE = /^4\. INFORMACION COMPRAS EN CUOTAS/;

// Inicio de transacciones
const MOVIMIENTOS_RE = /^MOVIMIENTOS TARJETA XXXX-\d{4}/;

// Fin sección 1
const SEC2_RE = /^2\. PRODUCTOS O SERVICIOS/;

// ── Utilidades ───────────────────────────────────────────────────────────────

function normDate(raw) {
    // DD/MM/YY → DD/MM/YYYY, DD/MM/YYYY → igual
    return parseDateDDMMYY(raw.length === 8 ? raw : raw);
}

function cleanMerchant(raw) {
    // Eliminar espacios múltiples internos, luego Title Case
    return toTitleCase(raw.replace(/\s{2,}/g, ' ').trim());
}

// ── Parser principal ─────────────────────────────────────────────────────────

/**
 * Parsea el texto plano de un estado de cuenta TC Santander Chile.
 * @param {string} pdfText - Texto extraído con pdf-parse
 * @returns {{transacciones: object[], cuotas_vigentes: object[], total_operaciones: number,
 *            total_facturado: number, periodo: string, periodo_desde: string, periodo_hasta: string,
 *            source_type: string}}
 */
export function parseSantanderTC(pdfText) {
    const lines = pdfText.split('\n').map(l => l.trim()).filter(Boolean);

    // ── Metadata ──────────────────────────────────────────────────────────────
    let total_operaciones = 0;
    let total_facturado = 0;
    let periodo_hasta = '';
    let periodo_desde = '';

    // total_facturado: usar regex multilinea directamente en el texto original
    const factMatch = pdfText.match(TOTAL_FACT_RE);
    if (factMatch) total_facturado = parseChileanAmount(factMatch[1]);

    for (const line of lines) {
        if (!total_operaciones) {
            const m = line.match(TOTAL_OPS_RE);
            if (m) total_operaciones = parseChileanAmount(m[1]);
        }
        if (!periodo_hasta) {
            const m = line.match(HASTA_RE);
            if (m) periodo_hasta = m[1]; // DD/MM/YYYY
        }
    }

    // periodo_desde: buscar el bloque header. Aparece después de "II.     DETALLE"
    // como una fecha sola en su propia línea, inmediatamente después del bloque de info general.
    let foundDetalle = false;
    for (const line of lines) {
        if (/II\.\s+DETALLE/.test(line)) { foundDetalle = true; continue; }
        if (foundDetalle && /^\d{2}\/\d{2}\/\d{4}$/.test(line)) {
            periodo_desde = line;
            break;
        }
    }

    // ── Secciones ─────────────────────────────────────────────────────────────
    // Estados: 'before' | 'sec1' | 'sec3' | 'sec4' | 'after'
    let state = 'before';
    const sec1Lines = [];
    const sec3Lines = [];
    const sec4Lines = [];

    for (const line of lines) {
        // Detectar transición de estado
        if (MOVIMIENTOS_RE.test(line)) { state = 'sec1'; continue; }
        if (SEC2_RE.test(line))         { if (state === 'sec1') state = 'between12'; continue; }
        if (SEC3_RE.test(line))         { state = 'sec3'; continue; }
        if (SEC4_RE.test(line))         { state = 'sec4'; continue; }

        // Ignorar headers de página repetidos
        if (PAGE_BREAK_RE.test(line)) continue;
        if (/^(MONTO|ORIGEN|OPERACIÓN|FECHA DE|LUGAR DE|TOTAL A|PAGAR|NºCUOTA|DESCRIPCIÓN|VALOR CUOTA|MENSUAL|CARGO DEL MES|2\.PERÍODO ACTUAL)$/.test(line)) continue;
        if (line === '$ 1.273.912' || /^\$ [\d.]+$/.test(line)) continue; // subtotal repetido

        // Clasificar en sección correspondiente
        if (state === 'sec1' && DATE_PREFIX.test(line)) sec1Lines.push(line);
        if (state === 'sec3' && DATE_PREFIX.test(line)) sec3Lines.push(line);
        if (state === 'sec4' && DATE_PREFIX.test(line)) sec4Lines.push(line);
    }

    // ── Parsear sección 1 ─────────────────────────────────────────────────────
    const transacciones = [];
    const cuotas_vigentes = [];

    for (const line of sec1Lines) {
        if (line.includes('MONTO CANCELADO')) continue;

        const mA = line.match(TIPO_A_RE);
        if (mA) {
            const [, rawDate, , , , rawType, rawCharge, rawCuota, rawMerchant] = mA;
            const [cuotaStr, totalStr] = rawCuota.split('/');
            const cuota_actual = parseInt(cuotaStr, 10);
            const total_cuotas = parseInt(totalStr, 10);
            const fecha = normDate(rawDate);
            const descripcion = cleanMerchant(rawMerchant.trim());
            const monto = parseChileanAmount(rawCharge);
            const tipo_cuota = rawType.trim();
            const categoria = categorizeTCTransaction(rawMerchant);

            const cuota_entry = { descripcion, cuota_actual, total_cuotas, monto_cuota: monto };

            // Cuotas con cuota_actual=0 van solo a cuotas_vigentes (todavía no facturadas)
            if (cuota_actual === 0) {
                cuotas_vigentes.push(cuota_entry);
                continue;
            }

            // Cuotas activas: van a transacciones Y cuotas_vigentes
            transacciones.push({
                fecha,
                descripcion,
                monto,
                tipo: 'cargo',
                categoria,
                es_cuota: true,
                cuota_actual,
                total_cuotas,
                tipo_cuota,
            });
            cuotas_vigentes.push(cuota_entry);
            continue;
        }

        const mB = line.match(TIPO_B_RE);
        if (mB) {
            const [, rawDate, rawMonto, rawMerchant] = mB;
            transacciones.push({
                fecha: normDate(rawDate),
                descripcion: cleanMerchant(rawMerchant.trim()),
                monto: parseChileanAmount(rawMonto),
                tipo: 'cargo',
                categoria: categorizeTCTransaction(rawMerchant),
                es_cuota: false,
                cuota_actual: null,
                total_cuotas: null,
            });
        }
    }

    // ── Parsear sección 3 (cargos banco) ──────────────────────────────────────
    for (const line of sec3Lines) {
        // TIPO B sirve también para sección 3 (el $amount está presente)
        const mB = line.match(TIPO_B_RE);
        if (mB) {
            const [, rawDate, rawMonto, rawDesc] = mB;
            // Descripcion: el texto después del $monto es la descripción principal
            const desc = rawDesc.trim() || line.slice(8).replace(/\$[\d.]+/, '').trim();
            transacciones.push({
                fecha: normDate(rawDate),
                descripcion: toTitleCase(desc),
                monto: parseChileanAmount(rawMonto),
                tipo: 'cargo',
                categoria: 'cargos_banco',
                es_cuota: false,
                cuota_actual: null,
                total_cuotas: null,
            });
        }
    }

    // ── Parsear sección 4 (cuotas_vigentes con cuota_actual=0) ────────────────
    for (const line of sec4Lines) {
        if (line.includes('MONTO CANCELADO')) continue;
        const mA = line.match(TIPO_A_RE);
        if (mA) {
            const [, , , , , , rawCharge, rawCuota, rawMerchant] = mA;
            const [, totalStr] = rawCuota.split('/');
            cuotas_vigentes.push({
                descripcion: cleanMerchant(rawMerchant.trim()),
                cuota_actual: 0,
                total_cuotas: parseInt(totalStr, 10),
                monto_cuota: parseChileanAmount(rawCharge),
            });
        }
    }

    // ── Derivar periodo ───────────────────────────────────────────────────────
    const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    let periodo = '';
    const dateForPeriodo = periodo_desde || periodo_hasta;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateForPeriodo)) {
        const [, m, y] = dateForPeriodo.split('/').map(Number);
        if (m >= 1 && m <= 12) periodo = `${MONTH_NAMES[m - 1]} ${y}`;
    }

    // ── Validación (no bloquea) ───────────────────────────────────────────────
    const sumTx = transacciones
        .filter(t => t.categoria !== 'cargos_banco')
        .reduce((s, t) => s + t.monto, 0);
    if (total_operaciones && Math.abs(sumTx - total_operaciones) > 10) {
        console.warn(`[santander-tc] Validación: suma=${sumTx} ≠ total_operaciones=${total_operaciones}`);
    }

    return {
        source_type: 'tc',
        periodo,
        periodo_desde,
        periodo_hasta,
        total_operaciones,
        total_facturado,
        transacciones,
        cuotas_vigentes,
    };
}
