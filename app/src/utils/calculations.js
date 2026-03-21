export const getMonthSalary = (p, ibm, def) => ibm[p] != null ? ibm[p] : def;
export const getMonthExtraItems = (p, ebm) => ebm[p] || [];
export const getMonthExtraTotal = (p, ebm) => getMonthExtraItems(p, ebm).reduce((s, i) => s + (Number(i.amount) || 0), 0);
export const getMonthIncome = (p, ibm, ebm, def) => getMonthSalary(p, ibm, def) + getMonthExtraTotal(p, ebm);
export const getMonthFixed = (p, fbm) => fbm[p] || [];
export const getMonthFixedTotal = (p, fbm) => getMonthFixed(p, fbm).reduce((s, i) => s + (Number(i.amount) || 0), 0);
export const pct = (a, b) => b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0;
