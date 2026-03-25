export const CAT = {
    supermercado: { label: 'Supermercado', color: '#3B82F6', bg: '#EFF6FF' },
    minimarket: { label: 'Minimarket', color: '#6B7280', bg: '#F9FAFB' },
    delivery: { label: 'Delivery', color: '#EF4444', bg: '#FEF2F2' },
    transporte: { label: 'Transporte', color: '#F59E0B', bg: '#FFFBEB' },
    mascotas: { label: 'Mascotas', color: '#8B5CF6', bg: '#F5F3FF' },
    lavanderia: { label: 'Lavandería', color: '#6366F1', bg: '#EEF2FF' },
    ropa_moda: { label: 'Ropa y moda', color: '#EC4899', bg: '#FDF2F8' },
    restaurantes: { label: 'Restaurantes', color: '#D97706', bg: '#FFFBEB' },
    entretenimiento: { label: 'Entretenimiento', color: '#10B981', bg: '#ECFDF5' },
    servicios_hogar: { label: 'Servicios del hogar', color: '#0EA5E9', bg: '#F0F9FF' },
    telefonia_internet: { label: 'Telefonía e internet', color: '#2563EB', bg: '#EFF6FF' },
    cuotas: { label: 'Cuotas', color: '#DC2626', bg: '#FEF2F2' },
    cargos_banco: { label: 'Cargos bancarios', color: '#9CA3AF', bg: '#F9FAFB' },
    // CC (cuenta corriente) categories
    transferencia_recibida: { label: 'Ingresos', color: '#059669', bg: '#ECFDF5' },
    transferencia_enviada: { label: 'Transferencia enviada', color: '#7C3AED', bg: '#F5F3FF' },
    pago_servicios: { label: 'Pago de servicios', color: '#0891B2', bg: '#ECFEFF' },
    traspaso_tc: { label: 'Traspaso a TC', color: '#6B7280', bg: '#F3F4F6' },
    ahorro: { label: 'Ahorro / inversión', color: '#059669', bg: '#ECFDF5' },
    comision_banco: { label: 'Comisión bancaria', color: '#9CA3AF', bg: '#F9FAFB' },
    otros: { label: 'Otros', color: '#4B5563', bg: '#F9FAFB' },
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
    { id: 'fijo', label: 'Recurrente', color: '#2563EB', bg: '#EFF6FF' },
    { id: 'efectivo', label: 'Efectivo', color: '#059669', bg: '#ECFDF5' },
    { id: 'debito', label: 'Débito', color: '#D97706', bg: '#FFFBEB' },
];

export const INCOME_CATS_BUILTIN = [
    { id: 'sueldo',    nombre: 'Sueldo Mensual', color: '#2563EB' },
    { id: 'freelance', nombre: 'Freelance',       color: '#7C3AED' },
    { id: 'otros',     nombre: 'Otros',           color: '#6B7280' },
];

export const INCOME_CAT_COLORS = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2'];

export const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const BANKS = [
    { id: 'santander_tc', label: 'Santander — Tarjeta de crédito' },
    { id: 'santander_cc', label: 'Santander — Cuenta corriente' },
    { id: 'bci_tc', label: 'BCI — Tarjeta de crédito' },
    { id: 'chile_tc', label: 'Banco de Chile — Tarjeta de crédito' },
    { id: 'bci_cc', label: 'BCI — Cuenta corriente' },
    { id: 'otro', label: 'Otro banco' },
];

export const CAT_PALETTE = [
    '#E11D48', '#BE185D', '#7C3AED', '#4F46E5', '#0891B2',
    '#0D9488', '#16A34A', '#65A30D', '#CA8A04', '#EA580C',
    '#B45309', '#78716C', '#1D4ED8', '#0369A1', '#047857', '#15803D'
];

// ─── Modos de vista para cálculo de egresos ───────────────────────────────────
// ALL: CC+TC combinados → traspaso_tc excluido (evita doble conteo)
// TC:  solo tarjeta de crédito
// CC:  solo cuenta corriente → traspaso_tc incluido (es egreso real de caja)
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
        entretenimiento: 0, servicios_hogar: 0, telefonia_internet: 0,
        cuotas: 0, cargos_banco: 0,
        // CC categories
        transferencia_recibida: 0, transferencia_enviada: 0,
        pago_servicios: 0, traspaso_tc: 0, comision_banco: 0,
        otros: 0,
    },
};
