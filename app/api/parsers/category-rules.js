/**
 * Reglas de categorización para transacciones de PDFs Santander Chile.
 * Basadas en comercios reales observados en los PDFs de Edgar.
 */

// ── TC — 14 categorías ───────────────────────────────────────────────────────

const TC_RULES = [
    // Orden importa: el primer match gana
    { cat: 'delivery',            kw: ['uber eats', 'pedidosya', 'rappi', 'cornershop'] },
    { cat: 'supermercado',        kw: ['jumbo', 'lider', 'ekono', 'santa isabel', 'supervecino', 'unimarc', 'santa isa'] },
    { cat: 'minimarket',          kw: ['minimarket', 'amawa', 'simmental', 'd todo', 'td05', 'mini market'] },
    { cat: 'transporte',          kw: ['uber', 'cabify', 'jetsmart', 'jetset', 'latam pass', 'nuitee', 'bip ', 'merpago*bip', 'merpago*jet'] },
    { cat: 'mascotas',            kw: ['club animal', 'bonne sant', 'veterinari', 'sumup * rodrigo', 'sumup * bonne'] },
    { cat: 'lavanderia',          kw: ['spinokmp', 'merpago*spinok'] },
    { cat: 'ropa_moda',           kw: ['h&m', 'hym', 'zara', 'falabella', 'jyotis', 'san diego ltda', 'reebok', 'tricot', 'cannon vivo'] },
    { cat: 'restaurantes',        kw: ['man ji', 'italian', 'dorita', 'animales catering', 'almiron', 'dkf', 'restaurante', 'casa vieja', 'isabella', 'chicken factory', 'dominos', 'kwa food', 'mc donald', 'mcdonald', 'barberia kairos', 'la dorita', '2 animales'] },
    { cat: 'entretenimiento',     kw: ['cinemark', 'cineplanet', 'cinepolis', 'netflix', 'spotify', 'hbomax', 'help.hbomax'] },
    { cat: 'pago_servicios',      kw: ['enel', 'metrogas', 'aguas andinas', 'home store', 'servipag', 'petrobras', 'entel pcs pago', 'entel oneclick'] },
    { cat: 'telefonia_internet',  kw: ['entel', 'movistar', 'wom', 'google play', 'payu *entel'] },
    { cat: 'cargos_banco',        kw: ['comision', 'impto.', 'iva uso', 'decreto ley', 'servicio compra internac', 'servicio compra'] },
    // 'otros' es el fallback, no necesita keywords
];

/**
 * Categoriza una transacción de tarjeta de crédito (TC Life o Latampass).
 * @param {string} descripcion - Nombre del comercio (puede estar en mayúsculas o Title Case)
 * @returns {string} Una de las 14 categorías TC válidas
 */
export function categorizeTCTransaction(descripcion) {
    if (!descripcion) return 'otros';
    const d = descripcion.toLowerCase();
    for (const { cat, kw } of TC_RULES) {
        if (kw.some(k => d.includes(k))) return cat;
    }
    return 'otros';
}

// ── CC — 7 categorías ────────────────────────────────────────────────────────

const CC_RULES = [
    // Abonos
    { cat: 'transferencia_recibida', kw: ['transf. ', 'transf de ', 'transf.komercializadora'] },
    // Cargos específicos
    { cat: 'traspaso_tc',            kw: ['traspaso internet a t. crédito', 'traspaso internet a t. credito'] },
    { cat: 'pago_servicios',         kw: ['pago en linea servipag'] },
    { cat: 'cargos_banco',           kw: ['com.mantencion', 'com. mantencion', 'recup com plan'] },
    // Transferencias salientes (luego de recibidas para no confundir)
    { cat: 'transferencia_enviada',  kw: ['transf a '] },
];

/**
 * Categoriza una transacción de cuenta corriente (CC / cartola).
 * @param {string} descripcion - Descripción del movimiento
 * @param {'cargo'|'abono'} tipo - Tipo de movimiento ya determinado
 * @returns {string} Una de las 7 categorías CC válidas
 */
export function categorizeCCTransaction(descripcion, tipo) {
    if (!descripcion) return 'otros';
    const d = descripcion.toLowerCase();
    for (const { cat, kw } of CC_RULES) {
        if (kw.some(k => d.includes(k))) return cat;
    }
    // Fallback por tipo
    if (tipo === 'abono') return 'transferencia_recibida';
    return 'otros';
}
