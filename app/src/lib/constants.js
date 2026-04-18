export const CAT = {
    supermercado: { label: 'Supermercado', color: 'var(--ink)', bg: 'var(--rule)' },
    minimarket: { label: 'Minimarket', color: 'var(--ink-2)', bg: 'var(--rule)' },
    delivery: { label: 'Delivery', color: 'var(--ink-3)', bg: 'var(--rule)' },
    transporte: { label: 'Transporte', color: 'var(--lime)', bg: 'var(--rule-2)' },
    mascotas: { label: 'Mascotas', color: 'var(--ink-4)', bg: 'var(--rule)' },
    lavanderia: { label: 'Lavandería', color: 'var(--sky)', bg: 'var(--rule)' },
    ropa_moda: { label: 'Ropa y moda', color: 'var(--violet)', bg: 'var(--rule)' },
    restaurantes: { label: 'Restaurantes', color: '#3D3B34', bg: 'var(--rule)' },
    entretenimiento: { label: 'Entretenimiento', color: 'var(--mint)', bg: 'var(--rule)' },
    telefonia_internet: { label: 'Telefonía e internet', color: 'var(--ink-2)', bg: 'var(--rule)' },
    cuotas: { label: 'Cuotas', color: 'var(--red)', bg: 'var(--red-soft)' },
    cargos_banco: { label: 'Cargos bancarios', color: 'var(--ink-3)', bg: 'var(--rule)' },
    interes_credito: { label: 'Intereses línea de crédito', color: 'var(--red)', bg: 'var(--red-soft)' },
    // CC (cuenta corriente) categories
    transferencia_recibida: { label: 'Ingresos', color: 'var(--olive)', bg: 'var(--olive-soft)' },
    transferencia_enviada: { label: 'Transferencia enviada', color: 'var(--ink-2)', bg: 'var(--rule)' },
    pago_servicios: { label: 'Pago de servicios', color: 'var(--ink-3)', bg: 'var(--rule)' },
    traspaso_tc: { label: 'Pago tarjeta de crédito', color: 'var(--ink-4)', bg: 'var(--rule)' },
    uso_lc:       { label: 'Uso línea de crédito',  color: 'var(--red)', bg: 'var(--red-soft)' },
    pago_credito: { label: 'Pago línea de crédito', color: 'var(--ink)', bg: 'var(--rule)' },
    ahorro: { label: 'Ahorro / inversión', color: 'var(--olive)', bg: 'var(--olive-soft)' },
    otros: { label: 'Otros', color: 'var(--ink-4)', bg: 'var(--rule)' },
};

export const FIXED_CATS = [
    { id: 'arriendo', label: 'Arriendo' },
    { id: 'servicios_basicos', label: 'Agua / luz / gas' },
    { id: 'internet', label: 'Internet / cable / TV' },
    { id: 'salud', label: 'Salud / seguros' },
    { id: 'transporte_fijo', label: 'Transporte mensual' },
    { id: 'otro_fijo', label: 'Otro fijo' },
];

export const SOURCE_OPTS = [
    { id: 'fijo', label: 'Recurrente', color: 'var(--ink-2)', bg: 'var(--rule)' },
    { id: 'efectivo', label: 'Efectivo', color: 'var(--olive)', bg: 'var(--olive-soft)' },
    { id: 'debito', label: 'Débito', color: 'var(--ink-4)', bg: 'var(--rule)' },
];

export const INCOME_CATS_BUILTIN = [
    { id: 'sueldo',    nombre: 'Sueldo Mensual', color: 'var(--ink-2)' },
    { id: 'freelance', nombre: 'Freelance',       color: 'var(--ink-3)' },
    { id: 'otros',     nombre: 'Otros',           color: 'var(--ink-4)' },
];

export const INCOME_CAT_COLORS = ['var(--ink)', 'var(--ink-2)', 'var(--ink-3)', 'var(--ink-4)', 'var(--olive)', 'var(--mint)'];

export const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const BANKS = [
    { id: 'santander_tc', label: 'Santander — Tarjeta de crédito' },
    { id: 'santander_cc', label: 'Santander — Cuenta corriente' },
    { id: 'santander_cl', label: 'Santander — Línea de crédito' },
    { id: 'bci_tc', label: 'BCI — Tarjeta de crédito' },
    { id: 'chile_tc', label: 'Banco de Chile — Tarjeta de crédito' },
    { id: 'bci_cc', label: 'BCI — Cuenta corriente' },
    { id: 'otro', label: 'Otro banco' },
];

export const CAT_PALETTE = [
    'var(--ink)', 'var(--ink-2)', 'var(--ink-3)', 'var(--ink-4)',
    'var(--olive)', 'var(--red)', 'var(--amber)', 'var(--mint)',
    'var(--violet)', 'var(--sky)', 'var(--sand)'
];

// ─── Modos de vista para cálculo de egresos ───────────────────────────────────
// ALL: CC+TC combinados → traspaso_tc excluido (evita doble conteo)
// TC:  solo tarjeta de crédito
// CC:  solo cuenta corriente → traspaso_tc incluido (es egreso real de caja)
export const ACCOUNT_TYPES = [
    { id: 'tc',          label: 'Tarjeta de crédito' },
    { id: 'cc',          label: 'Cuenta corriente' },
    { id: 'credit_line', label: 'Línea de crédito' },
];

export const VIEW_MODE = {
    ALL: 'all',
    TC:  'tc',
    CC:  'cc',
};

// Categorías CC que NO son gastos reales:
// - traspaso_tc: pago de TC (el detalle ya está en los cargos TC)
// - ahorro: transferencia a cuenta de ahorro/inversión
// Se excluyen de egresos CC en la vista combinada.
export const INTERNAL_TRANSFER_CATS = ['traspaso_tc', 'ahorro'];

export const DEF_BUDGET = {
    income: 0, savingsGoal: 0,
    categories: {
        supermercado: 0, minimarket: 0, delivery: 0, transporte: 0,
        mascotas: 0, lavanderia: 0, ropa_moda: 0, restaurantes: 0,
        entretenimiento: 0, telefonia_internet: 0,
        cuotas: 0, cargos_banco: 0,
        // CC categories
        transferencia_recibida: 0, transferencia_enviada: 0,
        pago_servicios: 0, traspaso_tc: 0,
        uso_lc: 0,
        pago_credito: 0,
        otros: 0,
    },
};
