/**
 * Utilidades compartidas para parsers determinísticos de PDFs Santander Chile.
 */

/**
 * Convierte un monto en formato chileno (punto = separador de miles) a entero.
 * "1.525.025" → 1525025, "18.994" → 18994, 44333 → 44333, null/"" → 0
 */
export function parseChileanAmount(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return Math.round(value);
    const cleaned = String(value).replace(/\./g, '').replace(/,.*$/, '');
    const result = parseInt(cleaned, 10);
    return isNaN(result) ? 0 : result;
}

/**
 * Convierte texto en MAYÚSCULAS a Title Case.
 * Preserva: H&M, siglas cortas, *, puntos en abreviaciones.
 * "JUMBO PENALOLEN" → "Jumbo Penalolen"
 * "H&M VIVO" → "H&M Vivo"
 */
export function toTitleCase(str) {
    if (!str) return '';
    return str.trim().replace(/\S+/g, word => {
        // Preserve all-caps siglas (2-3 chars all uppercase without lowercase)
        if (/^[A-Z&]{1,3}$/.test(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
}

/**
 * Convierte fecha DD/MM/YY a DD/MM/YYYY.
 * "21/08/25" → "21/08/2025"
 * Si ya tiene 4 dígitos de año, la devuelve sin cambios.
 */
export function parseDateDDMMYY(str) {
    if (!str) return str;
    const m = str.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (!m) return str; // already 4-digit year or invalid
    const year = parseInt(m[3], 10) + 2000;
    return `${m[1]}/${m[2]}/${year}`;
}

export const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/**
 * Convierte una fecha DD/MM/YYYY en "Mes YYYY".
 * Usa periodo_hasta si está disponible (convención Santander: el extracto se nombra
 * por el mes de cierre, no de inicio).
 * "26/02/2026" → "Febrero 2026", "" → ""
 */
export function formatPeriodo(periodoHasta, periodoDesde = '') {
    const date = periodoHasta || periodoDesde;
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return '';
    const [, m, y] = date.split('/').map(Number);
    return (m >= 1 && m <= 12) ? `${MONTH_NAMES[m - 1]} ${y}` : '';
}

/**
 * Patrón válido de monto chileno: 1-3 dígitos seguidos de grupos .NNN.
 * Mínimo un grupo (ej: "1.234"), máximo sin límite (ej: "1.234.567.890").
 */
export const CHILE_AMT_PATTERN = /\d{1,3}(?:\.\d{3})+/;

/**
 * Busca el monto chileno más largo que termine al final del string `s`.
 * Útil cuando el monto tiene dígitos previos pegados (ej: de un número de documento).
 *
 * "40.500"  → { amount: 40500, start: 0 }
 * "2.280"   → { amount: 2280, start: 0 }
 * "283.194" → { amount: 283194, start: 0 }
 * Retorna null si no encuentra ningún monto.
 */
export function findRightmostChileanAmount(s) {
    // Greedy regex finds matches left-to-right; the first one ending at s.length is the longest
    const regex = /\d{1,3}(?:\.\d{3})+/g;
    let m;
    while ((m = regex.exec(s)) !== null) {
        if (m.index + m[0].length === s.length) {
            return { amount: parseChileanAmount(m[0]), start: m.index };
        }
    }
    return null;
}

/**
 * Extrae todos los montos (y posible DCTO56) de un sufijo numérico concatenado.
 * Maneja casos como:
 *   "6001339129.743" → [912, 9743]   (DCTO600133 + monto912 + saldo9743)
 *   "6002151.515.070" → [1515070]    (DCTO600215 + monto1515070)
 *   "280.383283.194"  → [280383, 283194] (monto + saldo)
 *   "688.690"         → [688690]
 *
 * @param {string} numStr - Cadena con dígitos y puntos (sin letras)
 * @returns {number[]} Array de montos en pesos (enteros). [monto, saldo?] o [monto].
 */
export function extractTrailingAmounts(numStr) {
    if (!numStr) return [];
    const amounts = [];
    let s = numStr;

    // Paso 1: extraer montos chilenos de derecha a izquierda (rightmost-start)
    let found;
    while ((found = findRightmostChileanAmount(s)) !== null) {
        amounts.unshift(found.amount);
        s = s.slice(0, found.start);
    }

    // Paso 2: lo que queda son dígitos sin puntos → DCTO o monto pequeño
    const rem = s.replace(/\D/g, '');
    if (rem.length === 0) return amounts;

    if (rem.length <= 4) {
        // Monto pequeño (< 10.000 pesos sin punto separador)
        const v = parseInt(rem, 10);
        if (v > 0) amounts.unshift(v);
    } else if (rem.length <= 6) {
        // DCTO56 — ignorar
    } else if (rem.length === 7) {
        // DCTO56(6) + monto(1) — el de 1 dígito es insignificante, ignorar
    } else if (rem.length === 8) {
        // DCTO56(6) + monto(2)
        const v = parseInt(rem.slice(6), 10);
        if (v > 0) amounts.unshift(v);
    } else if (rem.length === 9) {
        // DCTO56(6) + monto(3) — ej: "600133912" → monto = 912
        const v = parseInt(rem.slice(6), 10);
        if (v > 0) amounts.unshift(v);
    } else {
        // 10+ dígitos: DCTO10 u otro identificador — ignorar
    }

    return amounts;
}
