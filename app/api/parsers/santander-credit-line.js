/**
 * Parser determinístico para "Cartola de Línea de Crédito" (CTA CTE CREDITO)
 * de Santander Chile.
 *
 * Formato casi idéntico al de CTA CTE LIFE, con diferencias:
 *   - Header: "CTA CTE CREDITO" en vez de "CTA CTE LIFE"
 *   - Sección extra: "INFORMACION DE LINEA DE" con cupo, utilizado, disponible
 *   - Todos los saldos son negativos (representan deuda utilizada)
 *
 * Reutiliza parseCCNumSuffix (duplicada) y chilean-amount.js
 */

import { parseChileanAmount, toTitleCase } from './chilean-amount.js';
import { categorizeCCTransaction } from './category-rules.js';

// ── parseCCNumSuffix (duplicada de santander-cc.js) ──────────────────────────
function parseCCNumSuffix(numStr) {
    if (!numStr) return [];
    const stripped = numStr.replace(/^\d{5,6}(?=\d)/, '');
    const AMT_RE = /\d{1,3}(?:\.\d{3})+/g;
    if (/^\d{1,3}(?:\.\d{3})+$/.test(stripped)) {
        return [parseChileanAmount(stripped)];
    }
    const allAmts = [];
    let m;
    while ((m = AMT_RE.exec(stripped)) !== null) allAmts.push(m);
    if (allAmts.length >= 2 &&
        allAmts[0].index + allAmts[0][0].length === allAmts[1].index) {
        return allAmts.map(a => parseChileanAmount(a[0]));
    }
    const bareAndSaldo = stripped.match(/^(\d{1,3})(\d{1,3}(?:\.\d{3})+)$/);
    if (bareAndSaldo) {
        return [parseInt(bareAndSaldo[1], 10), parseChileanAmount(bareAndSaldo[2])];
    }
    return allAmts.map(a => parseChileanAmount(a[0]));
}

// ── Regex ────────────────────────────────────────────────────────────────────

const TX_LINE_RE = /^(\d{2}\/\d{2})(Agustinas|O\.Gerencia|OPER\.|Sucursal\s+\w+)(.+)$/;
const DCTO10_RE = /^(\d{10})\s*/;
const RESUMEN_LABEL_RE = /SALDO INICIALDEPOSITOSOTROS ABONOSCHEQUESOTROS CARGOSIMPUESTOSSALDO FINAL/;
const RESUMEN_NUM_RE = /^[\d.]+$/;
const HEADER_RE = /\d+(\d{2}\/\d{2}\/\d{4})(\d{2}\/\d{2}\/\d{4})\d+/;

// Sección de información de línea de crédito
const CL_SECTION_RE = /INFORMACION DE LINEA DE/i;
const CL_CUPO_RE = /CUPO APROBADO[:\s]*([\d.]+)/i;
const CL_UTILIZADO_RE = /MONTO UTILIZADO[:\s]*([\d.]+)/i;
const CL_DISPONIBLE_RE = /SALDO DISPONIBLE[:\s]*([\d.]+)/i;
const CL_VENCIMIENTO_RE = /FECHA VENCIMIENTO[:\s]*(\d{2}\/\d{2}\/\d{4})/i;

// ── Discriminar tipo desde descripción ───────────────────────────────────────

function determinarTipoCL(desc) {
    const d = desc.toLowerCase();
    // Pagos a la línea (abonos que reducen deuda)
    if (d.includes('traspaso fondo internet'))       return 'payment';
    if (d.includes('amortizacion periodica lca'))    return 'payment';
    if (d.includes('amortización periódica lca'))    return 'payment';
    if (d.includes('pago en linea servipag'))        return 'payment';
    // Retiros / uso de la línea (aumentan deuda)
    if (d.includes('traspaso con la cuenta n°') || d.includes('traspaso con la cuenta n'))
        return null; // se determina por el signo (cargo/abono)
    if (d.includes('transf a '))   return 'withdrawal';
    if (d.includes('transf.') || d.includes('transf de ')) return 'payment';
    return null;
}

function determinarTipoCC(desc, tipo_cl) {
    // Mapear tipo_cl a tipo CC compatible con la app
    if (tipo_cl === 'payment') return 'abono';
    if (tipo_cl === 'withdrawal') return 'cargo';
    // Fallback basado en descripción
    const d = desc.toLowerCase();
    if (d.includes('transf a '))                            return 'cargo';
    if (d.includes('traspaso internet a t. crédito') ||
        d.includes('traspaso internet a t. credito'))       return 'cargo';
    if (d.includes('pago en linea servipag'))               return 'cargo';
    if (d.includes('com.mantencion') ||
        d.includes('com. mantencion'))                      return 'cargo';
    if (d.includes('transf.') || d.includes('transf de ')) return 'abono';
    return 'cargo'; // conservador: deuda de línea de crédito = cargo
}

// ── Categorías para línea de crédito ─────────────────────────────────────────

function categorizarCL(desc, tipo) {
    const d = desc.toLowerCase();
    if (tipo === 'abono') return 'transferencia_recibida';
    if (d.includes('traspaso fondo internet'))    return 'transferencia_recibida';
    if (d.includes('amortizacion') || d.includes('amortización')) return 'transferencia_recibida';
    if (d.includes('pago en linea'))              return 'pago_servicios';
    if (d.includes('com.mantencion') ||
        d.includes('com. mantencion'))            return 'cargos_banco';
    if (d.includes('interes') || d.includes('interés') ||
        d.includes('cargo interes'))              return 'cargos_banco';
    if (d.includes('transf a '))                  return 'transferencia_enviada';
    if (d.includes('traspaso con la cuenta'))     return 'transferencia_enviada';
    return categorizeCCTransaction(desc, tipo);
}

// ── Parser del resumen ────────────────────────────────────────────────────────

function parseResumenCC(numLine) {
    const tokens = [];
    const AMT_RE = /\d{1,3}(?:\.\d{3})+/g;
    let m;
    while ((m = AMT_RE.exec(numLine)) !== null) tokens.push(parseChileanAmount(m[0]));
    return {
        saldo_inicial: tokens[0] ?? 0,
        otros_abonos:  tokens[1] ?? 0,
        otros_cargos:  tokens[2] ?? 0,
        saldo_final:   tokens[3] ?? 0,
    };
}

// ── Parser principal ─────────────────────────────────────────────────────────

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/**
 * Parsea el texto plano de una cartola de Línea de Crédito Santander Chile.
 * @param {string} pdfText - Texto extraído con pdf-parse
 * @returns {object} Compatible con normalizeAIResponse
 */
export function parseSantanderCreditLine(pdfText) {
    const lines = pdfText.split('\n').map(l => l.trim()).filter(Boolean);

    // ── Metadata ──────────────────────────────────────────────────────────────
    let periodo_desde = '';
    let periodo_hasta = '';
    let saldo_inicial = 0;
    let saldo_final   = 0;

    // Extraer fechas desde el header
    for (const line of lines) {
        const m = line.match(HEADER_RE);
        if (m && !periodo_desde) {
            periodo_desde = m[1];
            periodo_hasta = m[2];
            break;
        }
    }

    // ── Sección de información de línea de crédito ────────────────────────────
    let approved_limit    = 0;
    let used_amount       = 0;
    let available_amount  = 0;
    let expiry_date       = '';

    const fullText = pdfText;
    const cupoMatch = fullText.match(CL_CUPO_RE);
    const utilizadoMatch = fullText.match(CL_UTILIZADO_RE);
    const disponibleMatch = fullText.match(CL_DISPONIBLE_RE);
    const vencimientoMatch = fullText.match(CL_VENCIMIENTO_RE);

    if (cupoMatch)       approved_limit   = parseChileanAmount(cupoMatch[1]);
    if (utilizadoMatch)  used_amount      = parseChileanAmount(utilizadoMatch[1]);
    if (disponibleMatch) available_amount = parseChileanAmount(disponibleMatch[1]);
    if (vencimientoMatch) expiry_date     = vencimientoMatch[1];

    // ── Parsear secciones ─────────────────────────────────────────────────────
    let inTransactions = false;
    let inResumen = false;
    const txLines = [];

    for (const line of lines) {
        if (/DETALLE DE MOVIMIENTOS/.test(line)) { inTransactions = true; continue; }
        if (/Resumen de Comisiones/.test(line))  { inTransactions = false; continue; }
        if (CL_SECTION_RE.test(line))            { inTransactions = false; continue; }
        if (RESUMEN_LABEL_RE.test(line))          { inResumen = true; continue; }
        if (inResumen && RESUMEN_NUM_RE.test(line)) {
            const r = parseResumenCC(line);
            saldo_inicial = r.saldo_inicial;
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
        const year = periodo_hasta
            ? periodo_hasta.slice(6)
            : new Date().getFullYear().toString();
        const fecha = `${fecha_raw}/${year}`;

        let body = rest;
        const dMatch = body.match(DCTO10_RE);
        if (dMatch) body = body.slice(dMatch[0].length);

        const numSuffixMatch = body.match(/^(.*?\D)([\d.]+(?:[\d.]+)*)$/);
        if (!numSuffixMatch) continue;

        let descripcion = numSuffixMatch[1].trim();
        const numSuffix = numSuffixMatch[2];

        if (!descripcion) continue;
        if (descripcion.toLowerCase().includes('recup com plan')) continue;

        const amounts = parseCCNumSuffix(numSuffix);
        if (amounts.length === 0) continue;

        const monto = amounts[0];
        if (!monto) continue;

        const tipo_cl = determinarTipoCL(descripcion);
        const tipo = determinarTipoCC(descripcion, tipo_cl);
        const categoria = categorizarCL(descripcion, tipo);

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
    let periodo = '';
    const dateForPeriodo = periodo_hasta || periodo_desde;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateForPeriodo)) {
        const [, m, y] = dateForPeriodo.split('/').map(Number);
        if (m >= 1 && m <= 12) periodo = `${MONTH_NAMES[m - 1]} ${y}`;
    }

    // ── Totales ───────────────────────────────────────────────────────────────
    const sumCargos = transacciones.filter(t => t.tipo === 'cargo').reduce((s, t) => s + t.monto, 0);

    return {
        source_type: 'credit_line',
        periodo,
        periodo_desde,
        periodo_hasta,
        total_operaciones: sumCargos,
        total_facturado: sumCargos,
        // Saldos negativos representan deuda
        saldo_inicial: saldo_inicial > 0 ? -saldo_inicial : saldo_inicial,
        saldo_final:   saldo_final   > 0 ? -saldo_final   : saldo_final,
        // Campos específicos de línea de crédito
        credit_line_info: {
            approved_limit,
            used_amount,
            available_amount,
            expiry_date,
        },
        transacciones,
        cuotas_vigentes: [],
    };
}
