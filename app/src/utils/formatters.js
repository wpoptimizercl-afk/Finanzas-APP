export const CLP = (n) => '$' + Math.round(n || 0).toLocaleString('es-CL');
export const CLPk = (n) => { const v = Math.round((n || 0) / 1000); return (v >= 0 ? '' : '-') + '$' + Math.abs(v) + 'k'; };
export const pct = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);
export const hexBg = (hex) => hex + '22';

const MONTH_IDX = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
};

export const shortLabel = (p = '') => p
    .replace('Enero', 'Ene').replace('Febrero', 'Feb').replace('Marzo', 'Mar')
    .replace('Abril', 'Abr').replace('Mayo', 'May').replace('Junio', 'Jun')
    .replace('Julio', 'Jul').replace('Agosto', 'Ago').replace('Septiembre', 'Sep')
    .replace('Octubre', 'Oct').replace('Noviembre', 'Nov').replace('Diciembre', 'Dic')
    .replace(/^(\w{3})\w*\s(\d{4})$/, '$1 $2');

export const sortMonths = (arr) => [...arr].sort((a, b) => {
    const pa = (a.periodo || '').toLowerCase().split(' ');
    const pb = (b.periodo || '').toLowerCase().split(' ');
    const ya = parseInt(pa[1] || '0'), yb = parseInt(pb[1] || '0');
    if (ya !== yb) return ya - yb;
    return (MONTH_IDX[pa[0]] || 0) - (MONTH_IDX[pb[0]] || 0);
});
