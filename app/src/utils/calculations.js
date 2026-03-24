export const getMonthSalary = (p, ibm, def) => ibm[p] != null ? ibm[p] : def;
export const getMonthExtraItems = (p, ebm) => ebm[p] || [];
export const getMonthExtraTotal = (p, ebm) => getMonthExtraItems(p, ebm).reduce((s, i) => s + (Number(i.amount) || 0), 0);
export const getCCAbonos = (p, months) =>
    months
        .filter(m => m.periodo === p)
        .flatMap(m => m.transacciones || [])
        .filter(t => t.tipo === 'abono' && t.categoria === 'transferencia_recibida')
        .reduce((s, t) => s + (Number(t.monto) || 0), 0);
export const getMonthIncome = (p, ibm, ebm, def, months = []) => {
    const extraTotal = getMonthExtraTotal(p, ebm);
    const hasSalary = ibm[p] != null;
    if (hasSalary) return ibm[p] + extraTotal;
    if (extraTotal > 0) return extraTotal;
    const ccIncome = getCCAbonos(p, months);
    if (ccIncome > 0) return ccIncome;
    return def;
};
export const getMonthFixed = (p, fbm) => fbm[p] || [];
export const getMonthFixedTotal = (p, fbm) => getMonthFixed(p, fbm).reduce((s, i) => s + (Number(i.amount) || 0), 0);
export const pct = (a, b) => b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0;
