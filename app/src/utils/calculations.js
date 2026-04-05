import { VIEW_MODE, INTERNAL_TRANSFER_CATS } from '../lib/constants';

// ─── Ingreso ──────────────────────────────────────────────────────────────────
export const getMonthSalary     = (p, ibm, def) => ibm[p] != null ? ibm[p] : def;
export const getMonthExtraItems = (p, ebm) => ebm[p] || [];
export const getMonthExtraTotal = (p, ebm) =>
    getMonthExtraItems(p, ebm).reduce((s, i) => s + (Number(i.amount) || 0), 0);

// Abonos CC categorizados — usado exclusivamente por IncomeCategorizationPanel.
// NO se usa como fallback de ingreso (era la causa del bug del 1.6M).
export const getCCAbonos = (p, months) =>
    months
        .filter(m => m.periodo === p)
        .flatMap(m => m.transacciones || [])
        .filter(t => t.tipo === 'abono' && t.categoria === 'transferencia_recibida')
        .reduce((s, t) => s + (Number(t.monto) || 0), 0);

// Ingreso = sueldo manual + extra_income guardados.
// Si ninguno está definido se usa el ingreso por defecto (defaultIncome).
export const getMonthIncome = (p, ibm, ebm, def) => {
    const salary = ibm[p] ?? 0;
    const extra  = getMonthExtraTotal(p, ebm);
    return salary > 0 || extra > 0 ? salary + extra : def;
};

// ─── Egresos ──────────────────────────────────────────────────────────────────
export const getMonthFixed      = (p, fbm) => fbm[p] || [];
export const getMonthFixedTotal = (p, fbm) =>
    getMonthFixed(p, fbm).reduce((s, i) => s + (Number(i.amount) || 0), 0);

// Egresos TC: usa total_cargos precalculado al subir el PDF.
export const getTCExpenses = (p, months) =>
    months
        .filter(m => m.periodo === p && m.source_type === 'tc')
        .reduce((s, m) => s + (Number(m.total_cargos) || 0), 0);

// Egresos CC: transacciones tipo=cargo de cuentas corrientes.
// includeTraspaso=true solo en vista CC pura (el pago de TC es egreso real de caja).
// En vista combinada se excluyen INTERNAL_TRANSFER_CATS (traspaso_tc, ahorro).
export const getCCExpenses = (p, months, includeTraspaso = false) =>
    months
        .filter(m => m.periodo === p && m.source_type === 'cc')
        .flatMap(m => m.transacciones || [])
        .filter(t => {
            if (t.tipo !== 'cargo') return false;
            if (includeTraspaso) return t.categoria !== 'ahorro'; // ahorro nunca es "gasto"
            return !INTERNAL_TRANSFER_CATS.includes(t.categoria);
        })
        .reduce((s, t) => s + (Number(t.monto) || 0), 0);

// Transferencias a ahorro/inversión — excluidas de gastos, se muestran como ahorro efectivo.
export const getSavingsTransfers = (p, months) =>
    months
        .filter(m => m.periodo === p && m.source_type === 'cc')
        .flatMap(m => m.transacciones || [])
        .filter(t => t.tipo === 'cargo' && t.categoria === 'ahorro')
        .reduce((s, t) => s + (Number(t.monto) || 0), 0);

// Egreso total con tratamiento contextual de traspaso_tc según viewMode:
//   ALL → CC (sin traspaso_tc) + TC + fijos
//   TC  → solo TC + fijos
//   CC  → solo CC (con traspaso_tc) + fijos
export const getExpenseTotal = (p, months, fbm, viewMode = VIEW_MODE.ALL) => {
    const includeTraspaso = viewMode === VIEW_MODE.CC;
    const ccExp   = viewMode === VIEW_MODE.TC ? 0 : getCCExpenses(p, months, includeTraspaso);
    const tcExp   = viewMode === VIEW_MODE.CC ? 0 : getTCExpenses(p, months);
    const fixedExp = getMonthFixedTotal(p, fbm);
    return ccExp + tcExp + fixedExp;
};

// ─── Línea de crédito ─────────────────────────────────────────────────────────

// Datos de línea de crédito para un período dado
export const getCreditLineData = (p, months) =>
    months
        .filter(m => m.periodo === p && m.source_type === 'credit_line')
        .map(m => ({
            approved_limit:   m.approved_limit   || 0,
            used_amount:      m.used_amount      || 0,
            available_amount: m.available_amount || 0,
            expiry_date:      m.expiry_date      || '',
            account_id:       m.account_id,
        }));

// Total financiamiento = deuda TC facturada + monto utilizado de línea de crédito
export const getTotalFinancing = (p, months) => {
    const tcDebt = months
        .filter(m => m.periodo === p && m.source_type === 'tc')
        .reduce((s, m) => s + (m.total_facturado || m.total_cargos || 0), 0);
    const clDebt = months
        .filter(m => m.periodo === p && m.source_type === 'credit_line')
        .reduce((s, m) => s + (m.used_amount || 0), 0);
    return { tcDebt, clDebt, total: tcDebt + clDebt };
};

// Utilización del cupo de la línea de crédito con indicador de riesgo
export const getFinancingUtilization = (p, months) => {
    const clData = getCreditLineData(p, months);
    const clLimit = clData.reduce((s, d) => s + d.approved_limit, 0);
    const clUsed  = clData.reduce((s, d) => s + d.used_amount,    0);
    const utilizationPct = clLimit > 0 ? Math.round((clUsed / clLimit) * 100) : 0;
    const riskLevel = clLimit > 0
        ? utilizationPct > 80 ? 'high' : utilizationPct > 50 ? 'medium' : 'low'
        : 'none';
    return { clLimit, clUsed, utilizationPct, riskLevel };
};

// pct consolidado en formatters.js — importar desde allí
