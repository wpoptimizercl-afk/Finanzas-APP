import { pct } from '../utils/calculations';
import { CLP } from '../utils/formatters';

export default function HealthSemaphore({ series, budget, isAverage }) {
    if (!series?.length) return null;

    const n = series.length;
    const avgIncome = series.reduce((s, r) => s + r.income, 0) / n;
    const avgAhorro = series.reduce((s, r) => s + r.ahorro, 0) / n;
    const savingsRate = pct(avgAhorro, avgIncome);
    const goal = budget.savingsGoal || 0;
    const budgetCats = budget.categories || {};

    const catAvg = {};
    series.forEach(r => Object.entries(r.categorias).forEach(([k, v]) => { catAvg[k] = (catAvg[k] || 0) + v; }));
    Object.keys(catAvg).forEach(k => { catAvg[k] = catAvg[k] / n; });
    const overCount = Object.entries(catAvg).filter(([k, v]) => budgetCats[k] > 0 && v > budgetCats[k]).length;
    const spendingUp = n >= 2 && series[n - 1].tc > series[n - 2].tc * 1.1;

    let score = 0;
    if (savingsRate >= 15 || (goal > 0 && avgAhorro >= goal)) { score += 2; } else if (savingsRate >= 5) { score += 1; }
    if (overCount === 0) { score += 2; } else if (overCount <= 2) { score += 1; }
    if (!spendingUp) { score += 1; }

    const status = score >= 4 ? 'green' : score >= 2 ? 'yellow' : 'red';
    const cfgMap = {
        green: { emoji: '🟢', label: 'Salud financiera buena', desc: 'Estás ahorrando bien y dentro del presupuesto.', bg: 'var(--success-light)', border: 'var(--success-border)', color: '#065F46' },
        yellow: { emoji: '🟡', label: 'Salud financiera moderada', desc: 'Hay aspectos a mejorar. Revisa tus categorías y ahorro.', bg: 'var(--warning-light)', border: '#FCD34D', color: '#78350F' },
        red: { emoji: '🔴', label: 'Salud financiera en riesgo', desc: 'Tu gasto supera lo ideal. Revisa el presupuesto.', bg: 'var(--danger-light)', border: 'var(--danger-border)', color: '#7F1D1D' },
    };
    const cfg = cfgMap[status];
    const avgLabel = isAverage ? ' (prom.)' : '';

    const details = [
        { ok: savingsRate >= 15, text: `Tasa de ahorro${avgLabel} ${savingsRate}% (meta ≥ 15%)` },
        ...(goal > 0 ? [{
            ok: avgAhorro >= goal,
            text: avgAhorro >= goal
                ? `Meta de ahorro cumplida (${CLP(avgAhorro)}${avgLabel} / ${CLP(goal)})`
                : `Meta de ahorro no cumplida (${CLP(avgAhorro)}${avgLabel} / ${CLP(goal)})`,
        }] : []),
        {
            ok: overCount === 0,
            text: overCount === 0
                ? `Todas las categorías dentro del tope${isAverage ? ' (en promedio)' : ''}`
                : `${overCount} categoría${overCount > 1 ? 's' : ''} sobre el tope${isAverage ? ' (en promedio)' : ''}`,
        },
        ...(n >= 2 ? [{ ok: !spendingUp, text: spendingUp ? 'Gasto TC subió más del 10% en el período' : 'Gasto TC estable en el período' }] : []),
    ];

    return (
        <div className="semaphore" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
            <div className="semaphore-header">
                <span className="semaphore-emoji">{cfg.emoji}</span>
                <div>
                    <div className="semaphore-title" style={{ color: cfg.color }}>{cfg.label}</div>
                    <div className="semaphore-desc" style={{ color: cfg.color }}>{cfg.desc}</div>
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {details.map((d, i) => (
                    <div key={i} className="semaphore-detail" style={{ color: cfg.color }}>
                        <span className="semaphore-check">{d.ok ? '✓' : '✗'}</span>
                        <span style={{ opacity: d.ok ? 0.8 : 1, fontWeight: d.ok ? 400 : 600 }}>{d.text}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
