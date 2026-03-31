/**
 * Parser determinístico para "Cartola de Cuenta Corriente" (CTA CTE LIFE)
 * de Santander Chile.
 *
 * Formato del texto extraído por pdf-parse:
 *   DD/MM SUCURSAL [DCTO10] DESCRIPCION [DCTO56] AMOUNTS SALDO?
 *
 * Ejemplos reales (santander-cc-raw.txt):
 *   02/12Agustinas0779537005 Transf. COMERCIALIZADORA6002151.515.070
 *   02/12AgustinasTraspaso Internet a T. Crédito688.690
 *   02/12O.Gerencia0262646203 Transf a Edgar Eduardo Urbina325.00010.194
 *   03/12OPER.RECUP COM PLAN MES ANT 2025-11-267.9192.811
 *   26/12AgustinasCOM.MANTENCION PLAN7.92932.265
 *
 * Discriminación DCTO vs MONTO:
 *   - DCTO10: exactamente 10 dígitos sin puntos al inicio de descripción → ignorar
 *   - DCTO56: 5-6 dígitos sin puntos intercalados → ignorar
 *   - MONTO:  tiene puntos de miles (ej: 1.515.070, 688.690, 7.929)
 *
 * Resumen de validación (línea después de "SALDO INICIAL...SALDO FINAL"):
 *   7.64101.847.61401.822.990032.265
 *   → saldo_inicial=7.641, depositos=0, otros_abonos=1.847.614, cheques=0,
 *     otros_cargos=1.822.990, impuestos=0, saldo_final=32.265
 */

import { parseChileanAmount, toTitleCase } from './chilean-amount.js';
import { categorizeCCTransaction } from './category-rules.js';

/**
 * Extrae montos chilenos de un sufijo numérico de línea CC.
 * Maneja el DCTO56 (6 dígitos sin punto) que precede al monto.
 *
 * Casos:
 *   "6002151.515.070"  → [1515070]         (DCTO56=600215, monto=1.515.070)
 *   "600130280.383283.194" → [280383, 283194] (DCTO56=600130, monto=280.383, saldo=283.194)
 *   "7.9192.811"       → [7919, 2811]      (monto=7.919, saldo=2.811)
 *   "20.41610.730"     → [20416, 10730]    (cargo=20.416, saldo=10.730)
 *   "9000042.460"      → [2460]            (DCTO56=900004, monto=2.460)
 *   "688.690"          → [688690]
 */
function parseCCNumSuffix(numStr) {
    if (!numStr) return [];
    // Strip leading DCTO56: 5-6 digits without dots followed by a Chilean amount start
    const stripped = numStr.replace(/^\d{5,6}(?=\d{1,3}\.)/, '');
    // Extract all Chilean amounts (\d{1,3}(?:\.\d{3})+) left to right
    const AMT_RE = /\d{1,3}(?:\.\d{3})+/g;
    const results = [];
    let m;
    while ((m = AMT_RE.exec(stripped)) !== null) {
        results.push(parseChileanAmount(m[0]));
    }
    return results;
}

// ── Regex ────────────────────────────────────────────────────────────────────

// Línea de transacción: DD/MM + (sucursal o OPER.) + descripción + números al final
const TX_LINE_RE = /^(\d{2}\/\d{2})(Agustinas|O\.Gerencia|OPER\.|Sucursal\s+\w+)(.+)$/;

// Número de documento de 10 dígitos al inicio del texto de descripción
const DCTO10_RE = /^(\d{10})\s*/;

// SALDO INICIAL label
const RESUMEN_LABEL_RE = /SALDO INICIALDEPOSITOSOTROS ABONOSCHEQUESOTROS CARGOSIMPUESTOSSALDO FINAL/;

// Línea de resumen numérico (viene justo después del label)
// Ej: "7.64101.847.61401.822.990032.265"
const RESUMEN_NUM_RE = /^[\d.]+$/;

// Cartola header con fechas: "7128/11/202530/12/20251" → desde=28/11/2025, hasta=30/12/2025
const HEADER_RE = /\d+(\d{2}\/\d{2}\/\d{4})(\d{2}\/\d{2}\/\d{4})\d+/;

// ── Discriminar cargo/abono desde la descripción ─────────────────────────────

function determinarTipo(desc) {
    const d = desc.toLowerCase();
    if (d.includes('transf a '))                     return 'cargo';
    if (d.includes('traspaso internet a t. crédito')) return 'cargo';
    if (d.includes('traspaso internet a t. credito')) return 'cargo';
    if (d.includes('pago en linea servipag'))         return 'cargo';
    if (d.includes('com.mantencion'))                 return 'cargo';
    if (d.includes('com. mantencion'))                return 'cargo';
    if (d.includes('transf.') || d.includes('transf de ') || d.includes('transf. ')) return 'abono';
    if (d.includes('recup com plan'))                 return 'abono';
    return null; // desconocido
}

// ── Parser del resumen de validación ─────────────────────────────────────────

/**
 * Parsea la línea concatenada del resumen CC.
 * "7.64101.847.61401.822.990032.265"
 * Columnas: saldo_inicial, depositos(0), otros_abonos, cheques(0), otros_cargos, impuestos(0), saldo_final
 * Los ceros aparecen como el dígito "0" sin puntos.
 */
function parseResumenCC(numLine) {
    // Extraer los 4 montos chilenos (los 3 ceros colapsan): saldo_inicial, otros_abonos, otros_cargos, saldo_final
    const tokens = [];
    let s = numLine;
    const AMT_RE = /\d{1,3}(?:\.\d{3})+/g;
    let m;
    while ((m = AMT_RE.exec(numLine)) !== null) {
        tokens.push(parseChileanAmount(m[0]));
    }
    // Esperar: [saldo_inicial, otros_abonos, otros_cargos, saldo_final]
    if (tokens.length === 4) {
        return { saldo_inicial: tokens[0], otros_abonos: tokens[1], otros_cargos: tokens[2], saldo_final: tokens[3] };
    }
    // Puede haber solo 3 si algún valor es 0 en ambas (ej: saldo_final podría ser pequeño)
    // En ese caso, intentar extraer los zeros también
    // Simplificación: usar los primeros 4 (o lo que haya)
    return {
        saldo_inicial: tokens[0] ?? 0,
        otros_abonos:  tokens[1] ?? 0,
        otros_cargos:  tokens[2] ?? 0,
        saldo_final:   tokens[3] ?? 0,
    };
}

// ── Parser principal ─────────────────────────────────────────────────────────

/**
 * Parsea el texto plano de una cartola de Santander Chile.
 * @param {string} pdfText - Texto extraído con pdf-parse
 * @returns {{transacciones: object[], total_operaciones: number, total_facturado: number,
 *            saldo_inicial: number, saldo_final: number, periodo: string,
 *            periodo_desde: string, periodo_hasta: string, source_type: string}}
 */
export function parseSantanderCC(pdfText) {
    const lines = pdfText.split('\n').map(l => l.trim()).filter(Boolean);

    // ── Metadata ──────────────────────────────────────────────────────────────
    let periodo_desde = '';
    let periodo_hasta = '';
    let saldo_inicial = 0;
    let saldo_final = 0;
    let otros_abonos = 0;
    let otros_cargos = 0;

    // Extraer fechas desde el header de la cartola
    for (const line of lines) {
        const m = line.match(HEADER_RE);
        if (m && !periodo_desde) {
            periodo_desde = m[1];
            periodo_hasta = m[2];
            break;
        }
    }

    // ── Secciones ─────────────────────────────────────────────────────────────
    let inTransactions = false;
    let inResumen = false;
    const txLines = [];

    for (const line of lines) {
        if (/DETALLE DE MOVIMIENTOS/.test(line)) { inTransactions = true; continue; }
        if (/Resumen de Comisiones/.test(line))  { inTransactions = false; continue; }
        if (RESUMEN_LABEL_RE.test(line))          { inResumen = true; continue; }
        if (inResumen && RESUMEN_NUM_RE.test(line)) {
            const r = parseResumenCC(line);
            saldo_inicial = r.saldo_inicial;
            otros_abonos  = r.otros_abonos;
            otros_cargos  = r.otros_cargos;
            saldo_final   = r.saldo_final;
            inResumen = false;
            continue;
        }
        if (inTransactions) txLines.push(line);
    }

    // ── Parsear líneas de transacción ─────────────────────────────────────────
    const transacciones = [];

    for (const line of txLines) {
        const mLine = line.match(TX_LINE_RE);
        if (!mLine) continue;

        const [, fecha_raw, , rest] = mLine;
        // rest = [DCTO10?] DESCRIPCION [DCTO56?] AMOUNTS [SALDO?]
        // El año se obtiene del periodo
        // periodo_hasta = "30/12/2025" → slice(6) = "2025"
        const year = periodo_hasta
            ? periodo_hasta.slice(6)
            : new Date().getFullYear().toString();
        const fecha = `${fecha_raw}/${year.length === 4 ? year : '20' + year}`;

        // Remover DCTO10 al inicio
        let body = rest;
        const dMatch = body.match(DCTO10_RE);
        if (dMatch) body = body.slice(dMatch[0].length);

        // Separar texto de números al final
        // Los números (con o sin puntos de miles) siempre van al final de la línea
        // Texto de descripción = todo hasta el primer dígito del bloque final de números
        const numSuffixMatch = body.match(/^(.*?\D)([\d.]+(?:[\d.]+)*)$/);

        let descripcion = body.trim();
        let numSuffix = '';

        if (numSuffixMatch) {
            descripcion = numSuffixMatch[1].trim();
            numSuffix   = numSuffixMatch[2];
        } else {
            // Si toda la línea son números (raro), saltar
            continue;
        }

        if (!descripcion) continue;

        // Extraer montos del sufijo numérico (maneja DCTO56 concatenado)
        const amounts = parseCCNumSuffix(numSuffix);
        if (amounts.length === 0) continue;

        // El primer monto es la transacción, el segundo (si existe) es el saldo
        const monto = amounts[0];
        if (!monto) continue;

        // Determinar tipo
        let tipo = determinarTipo(descripcion);
        if (!tipo) {
            // Fallback: si no podemos determinar, usar 'cargo' (conservador)
            tipo = 'cargo';
        }

        const categoria = categorizeCCTransaction(descripcion, tipo);

        transacciones.push({
            fecha: fecha.length === 10 ? fecha : `${fecha_raw}/${year}`,
            descripcion: toTitleCase(descripcion),
            monto,
            tipo,
            categoria,
            es_cuota: false,
            cuota_actual: null,
            total_cuotas: null,
        });
    }

    // ── Derivar periodo ───────────────────────────────────────────────────────
    const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    let periodo = '';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(periodo_desde)) {
        const [, m, y] = periodo_desde.split('/').map(Number);
        if (m >= 1 && m <= 12) periodo = `${MONTH_NAMES[m - 1]} ${y}`;
    }

    // ── Totales para compatibilidad con normalizeAIResponse ──────────────────
    const sumCargos = transacciones.filter(t => t.tipo === 'cargo').reduce((s, t) => s + t.monto, 0);
    const sumAbonos = transacciones.filter(t => t.tipo === 'abono').reduce((s, t) => s + t.monto, 0);

    // Validación contra resumen (no bloquea)
    if (otros_cargos && Math.abs(sumCargos - otros_cargos) > 50) {
        console.warn(`[santander-cc] Validación cargos: suma=${sumCargos} ≠ resumen=${otros_cargos}`);
    }
    if (otros_abonos && Math.abs(sumAbonos - otros_abonos) > 50) {
        console.warn(`[santander-cc] Validación abonos: suma=${sumAbonos} ≠ resumen=${otros_abonos}`);
    }

    return {
        source_type: 'cc',
        periodo,
        periodo_desde,
        periodo_hasta,
        total_operaciones: sumCargos,
        total_facturado: sumCargos,
        saldo_inicial,
        saldo_final,
        transacciones,
        cuotas_vigentes: [],
    };
}
