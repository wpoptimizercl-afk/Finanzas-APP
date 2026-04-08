/**
 * Parser determinístico para "Cartola de Línea de Crédito" (CTA CTE CREDITO)
 * de Santander Chile.
 *
 * Formato PDF concatenado por pdf-parse (sin información de columnas):
 *   CARGO:  DD/MM SUCURSAL DESCRIPCION [N° DOCNUM] CARGO_AMOUNT-SALDO_DIARIO
 *   ABONO:  DD/MM SUCURSAL DESCRIPCION [N° DOCNUM] ABONO_AMOUNT
 *
 * La distinción CARGO vs ABONO se basa en el signo: dos montos chilenos
 * separados por `-` al final = CARGO (primer monto); un único monto = ABONO.
 */

import { parseChileanAmount, toTitleCase, findRightmostChileanAmount, formatPeriodo } from './chilean-amount.js';
import { categorizeCCTransaction } from './category-rules.js';

// ── Regex ────────────────────────────────────────────────────────────────────

const TX_LINE_RE = /^(\d{2}\/\d{2})(Agustinas|O\.Gerencia|OPER\.|Sucursal\s+\w+)(.+)$/;
const DCTO10_RE  = /^(\d{10})\s*/;
const RESUMEN_LABEL_RE = /SALDO INICIALDEPOSITOSOTROS ABONOSCHEQUESOTROS CARGOSIMPUESTOSSALDO FINAL/;
const RESUMEN_NUM_RE   = /^[-\d.]+$/;
const HEADER_RE  = /\d+(\d{2}\/\d{2}\/\d{4})(\d{2}\/\d{2}\/\d{4})\d+/;
const CL_SECTION_RE    = /INFORMACION DE LINEA DE/i;
const CL_LABELS_RE     = /CUPO APROBADOFECHA VENCIMIENTOMONTO UTILIZADOSALDO DISPONIBLE/i;
const CHILEAN_AMT_RE   = /\d{1,3}(?:\.\d{3})+/g;

// ── Extraer monto y tipo desde el cuerpo de la línea ─────────────────────────
//
// El PDF concatena todas las columnas. El patrón al final de cada línea es:
//   CARGO: ...CARGO_AMOUNT-SALDO_DIARIO   (dos montos chilenos separados por -)
//   ABONO: ...ABONO_AMOUNT               (un único monto chileno al final)

function extractCLAmount(body) {
    // Documentos Santander CL tienen 12 o 18 dígitos pegados sin separador al monto.
    // Encontrar la longitud correcta del doc para dejar 1-3 dígitos del monto.
    let cleanBody = body;
    const nIdx = body.indexOf('N°');
    if (nIdx >= 0) {
        const afterN = body.slice(nIdx + 2).trim();
        const firstPointIdx = afterN.indexOf('.');
        if (firstPointIdx > 0) {
            const docLen = [12, 18].find(d => {
                const digits = firstPointIdx - d;
                return digits >= 1 && digits <= 3;
            });
            // Fallback: máximo 3 dígitos antes del punto
            cleanBody = afterN.slice(docLen ?? Math.max(0, firstPointIdx - 3));
        }
    }

    // Usar el último '-' como separador: puede haber '-' en la descripción
    const lastDashIdx = cleanBody.lastIndexOf('-');
    if (lastDashIdx > 0) {
        const afterDash = cleanBody.slice(lastDashIdx + 1);
        const saldoMatch = afterDash.match(/^(\d{1,3}(?:\.\d{3})+)$/);
        if (saldoMatch) {
            const montoResult = findRightmostChileanAmount(cleanBody.slice(0, lastDashIdx));
            if (montoResult) {
                return {
                    monto: montoResult.amount,
                    tipo: 'cargo',
                    dailyBalance: parseChileanAmount(saldoMatch[1]),
                };
            }
        }
    }

    const montoResult = findRightmostChileanAmount(cleanBody);
    if (montoResult) {
        return {
            monto: montoResult.amount,
            tipo: 'abono',
            dailyBalance: null,
        };
    }
    return null;
}

// ── Extraer descripción limpia ────────────────────────────────────────────────

function extractDescripcionCL(body) {
    // Si hay "N°" en el texto, la descripción termina antes del número de cuenta
    const nIdx = body.indexOf('N°');
    if (nIdx > 0) return body.slice(0, nIdx).trim();
    // Sin "N°": quitar los montos al final
    const stripped = body
        .replace(/\s*\d{1,3}(?:\.\d{3})+-\d{1,3}(?:\.\d{3})+$/, '')
        .replace(/\s*\d{1,3}(?:\.\d{3})+$/, '');
    return stripped.trim();
}

// ── Categorías para línea de crédito ─────────────────────────────────────────

function categorizarCL(desc, tipo) {
    const d = desc.toLowerCase();
    // Pagos que reducen deuda de la LC (ABONO)
    if (d.includes('traspaso fondo internet'))                        return 'pago_credito';
    if (d.includes('amortizacion') || d.includes('amortización'))    return 'pago_credito';
    // Uso de la LC para pagar algo (CARGO — genera deuda)
    if (d.includes('traspaso con la cuenta'))                        return 'uso_lc';
    if (d.includes('pago en linea'))                                  return 'pago_servicios';
    if (d.includes('com.mantencion') || d.includes('com. mantencion')) return 'cargos_banco';
    if (d.includes('interes') || d.includes('interés') ||
        d.includes('cargo interes'))                                  return 'interes_credito';
    if (d.includes('transf a '))                                      return 'transferencia_enviada';
    return categorizeCCTransaction(desc, tipo);
}

// ── Parser del resumen ────────────────────────────────────────────────────────

function parseResumenCC(numLine) {
    const tokens = [];
    const re = /-?\d{1,3}(?:\.\d{3})+/g;
    let m;
    while ((m = re.exec(numLine)) !== null) tokens.push(parseChileanAmount(m[0]));
    return {
        saldo_inicial: tokens[0] ?? 0,
        otros_abonos:  tokens[1] ?? 0,
        otros_cargos:  tokens[2] ?? 0,
        saldo_final:   tokens[3] ?? 0,
    };
}

// ── Parser principal ─────────────────────────────────────────────────────────


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
    let resumen_abonos = 0;
    let resumen_cargos = 0;

    for (const line of lines) {
        const m = line.match(HEADER_RE);
        if (m && !periodo_desde) {
            periodo_desde = m[1];
            periodo_hasta = m[2];
            break;
        }
    }

    // ── Estado del loop ───────────────────────────────────────────────────────
    let inTransactions    = false;
    let inResumen         = false;
    let nextIsCLValues    = false;
    const txLines         = [];

    // Campos de línea de crédito
    let approved_limit   = 0;
    let used_amount      = 0;
    let available_amount = 0;
    let expiry_date      = '';

    for (const line of lines) {
        // ── Sección de línea de crédito (Bug 2 fix: parseo posicional) ────────
        if (nextIsCLValues) {
            nextIsCLValues = false;
            const amounts = [];
            const re = /\d{1,3}(?:\.\d{3})+/g;
            let m;
            while ((m = re.exec(line)) !== null) amounts.push(parseChileanAmount(m[0]));
            const dateMatch = line.match(/\d{2}\/\d{2}\/\d{4}/);
            approved_limit   = amounts[0] ?? 0;
            used_amount      = amounts[2] ?? 0;
            available_amount = amounts[1] ?? 0;
            expiry_date      = dateMatch ? dateMatch[0] : '';
            continue;
        }

        if (CL_LABELS_RE.test(line))             { nextIsCLValues = true; continue; }
        if (/DETALLE DE MOVIMIENTOS/.test(line))  { inTransactions = true; continue; }
        if (/Resumen de Comisiones/.test(line))   { inTransactions = false; continue; }
        if (CL_SECTION_RE.test(line))             { inTransactions = false; continue; }
        if (RESUMEN_LABEL_RE.test(line))          { inResumen = true; continue; }

        if (inResumen && RESUMEN_NUM_RE.test(line)) {
            const r = parseResumenCC(line);
            saldo_inicial  = r.saldo_inicial;
            saldo_final    = r.saldo_final;
            resumen_abonos = r.otros_abonos;
            resumen_cargos = r.otros_cargos;
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

        let body = rest;
        const dMatch = body.match(DCTO10_RE);
        if (dMatch) body = body.slice(dMatch[0].length);

        // Extraer monto del patrón en el texto concatenado
        const extracted = extractCLAmount(body);
        if (!extracted) continue;

        const descripcion = extractDescripcionCL(body);
        if (!descripcion) continue;
        if (descripcion.toLowerCase().includes('recup com plan')) continue;

        const monto = extracted.monto;
        if (!monto) continue;

        // Determinar tipo por descripción (más fiable que el patrón de montos).
        // El PDF no siempre muestra el saldo diario en transacciones de LC,
        // por lo que el patrón single/double-amount no es determinístico.
        // Ground truth (resumen del PDF):
        //   otros_cargos = suma exacta de "Traspaso con la Cuenta"
        //   otros_abonos = suma exacta de "Traspaso Fondo Internet" + "Amortización"
        const d_lower = descripcion.toLowerCase();
        let tipo = extracted.tipo; // fallback al patrón
        if (d_lower.includes('traspaso fondo internet') ||
            d_lower.includes('amortizacion') || d_lower.includes('amortización')) {
            tipo = 'abono';
        } else if (d_lower.includes('traspaso con la cuenta')) {
            tipo = 'cargo';
        }

        const categoria = categorizarCL(descripcion, tipo);

        transacciones.push({
            fecha: `${fecha_raw}/${year}`,
            descripcion: toTitleCase(descripcion),
            monto,
            tipo,
            categoria,
            es_cuota: false,
            cuota_actual: null,
            total_cuotas: null,
        });
    }

    // ── Segundo pass: Solo validación (los montos ya son correctos desde extractCLAmount) ────
    // El balance tracking ya no es necesario como corrección; solo verificar contra resumen
    // Los montos se extraen correctamente con findRightmostChileanAmount en el primer paso.

    // Remover dailyBalance del objeto final (es solo para procesamiento interno)
    for (const tx of transacciones) {
        delete tx.dailyBalance;
    }

    // ── Validación contra resumen (Bug 5: advertir si hay diferencia) ─────────
    if (resumen_cargos > 0 || resumen_abonos > 0) {
        const computedCargos = transacciones
            .filter(t => t.tipo === 'cargo')
            .reduce((s, t) => s + t.monto, 0);
        const computedAbonos = transacciones
            .filter(t => t.tipo === 'abono')
            .reduce((s, t) => s + t.monto, 0);
        if (Math.abs(computedCargos - resumen_cargos) > 1) {
            console.warn(`[CL parser] cargos calculados ${computedCargos} ≠ resumen ${resumen_cargos}`);
        }
        if (Math.abs(computedAbonos - resumen_abonos) > 1) {
            console.warn(`[CL parser] abonos calculados ${computedAbonos} ≠ resumen ${resumen_abonos}`);
        }
    }

    // ── Derivar periodo ───────────────────────────────────────────────────────
    const periodo = formatPeriodo(periodo_hasta, periodo_desde);

    // ── Totales ───────────────────────────────────────────────────────────────
    const sumCargos = transacciones
        .filter(t => t.tipo === 'cargo')
        .reduce((s, t) => s + t.monto, 0);

    return {
        source_type: 'credit_line',
        periodo,
        periodo_desde,
        periodo_hasta,
        total_operaciones: sumCargos,
        total_facturado:   sumCargos,
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
