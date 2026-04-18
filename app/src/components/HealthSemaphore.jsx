import { CLP, pct } from '../utils/formatters';

const CIRCUMFERENCE = 2 * Math.PI * 22; // r=22

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

    const savingsPts = Math.min(40, Math.max(0, (savingsRate / 15) * 40));
    const catPts = Math.max(0, 30 - overCount * 10);
    const goalPts = goal > 0 ? Math.min(30, Math.max(0, (avgAhorro / goal) * 30)) : 15;
    const score = Math.round(savingsPts + catPts + goalPts);

    const scoreColor = score >= 70 ? 'var(--olive)' : score >= 40 ? 'var(--amber)' : 'var(--red)';
    const status = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red';
    const cfgMap = {
        green:  { label: 'Salud financiera buena',     desc: 'Ahorrando bien y dentro del presupuesto.',      bg: 'var(--success-light)', border: 'var(--success-border)', color: 'var(--success-text)' },
        yellow: { label: 'Salud financiera moderada',  desc: 'Hay aspectos a mejorar en categorías y ahorro.', bg: 'var(--warning-light)', border: 'var(--warning-border)', color: 'var(--warning-text)' },
        red:    { label: 'Salud financiera en riesgo', desc: 'Gasto supera lo ideal. Revisa el presupuesto.',  bg: 'var(--danger-light)',   border: 'var(--danger-border)',   color: 'var(--danger-text)'   },
    };
    const cfg = cfgMap[status];
    const avgLabel = isAverage ? ' (prom.)' : '';

    const dashOffset = CIRCUMFERENCE * (1 - score / 100);

    const details = [
        { ok: savingsRate >= 15, text: `Tasa excedente${avgLabel} ${savingsRate}% (meta ≥ 15%)` },
        ...(goal > 0 ? [{
            ok: avgAhorro >= goal,
            text: avgAhorro >= goal
                ? `Meta cumplida (${CLP(avgAhorro)}${avgLabel} / ${CLP(goal)})`
                : `Meta no cumplida (${CLP(avgAhorro)}${avgLabel} / ${CLP(goal)})`,
        }] : []),
        {
            ok: overCount === 0,
            text: overCount === 0
                ? `Categorías dentro del tope${isAverage ? ' (prom.)' : ''}`
                : `${overCount} categoría${overCount > 1 ? 's' : ''} sobre el tope${isAverage ? ' (prom.)' : ''}`,
        },
        ...(n >= 2 ? [{ ok: !spendingUp, text: spendingUp ? 'Gasto TC subió >10% en el período' : 'Gasto TC estable' }] : []),
    ];

    return (
        <div className="semaphore" style={{ borderLeft: `3px solid ${scoreColor}` }}>
            <div className="semaphore-header">
                <svg
                    width="52" height="52" viewBox="0 0 52 52"
                    style={{ flexShrink: 0 }}
                    role="img"
                    aria-label={`Score salud financiera: ${score} de 100`}
                >
                    <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="5" />
                    <circle
                        cx="26" cy="26" r="22" fill="none"
                        stroke={scoreColor} strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        strokeDashoffset={dashOffset}
                        transform="rotate(-90 26 26)"
                        style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
                    />
                    <text
                        x="26" y="26"
                        textAnchor="middle" dominantBaseline="central"
                        fill={scoreColor} fontSize="15" fontWeight="700" fontFamily="inherit"
                    >
                        {score}
                    </text>
                </svg>
                <div style={{ minWidth: 0 }}>
                    <div className="semaphore-title" style={{ color: cfg.color }}>{cfg.label}</div>
                    <div className="semaphore-desc" style={{ color: cfg.color }}>{cfg.desc}</div>
                </div>
            </div>
            <div className="semaphore-details-grid">
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
