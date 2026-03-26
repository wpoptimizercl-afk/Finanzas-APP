import { useMemo } from 'react';
import {
    BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine,
} from 'recharts';
import { Upload } from 'lucide-react';
import Metric from '../components/ui/Metric';
import Section from '../components/ui/Section';
import ChartTooltip from '../components/charts/ChartTooltip';
import HealthSemaphore from '../components/HealthSemaphore';
import EndingInstallmentsWidget from '../components/EndingInstallmentsWidget';
import { CLP, CLPk, pct, shortLabel } from '../utils/formatters';
import { getMonthIncome, getMonthFixedTotal, getTCExpenses, getCCExpenses, getSavingsTransfers } from '../utils/calculations';

export default DashboardInner;

import { useState, useEffect } from 'react';

export function DashboardInner({ months, accounts = [], fixedByMonth, incomeByMonth, extraByMonth, defaultIncome, budget, allCats, onGoUpload, onGoHistory }) {
    const defaultWindow = useMemo(() => {
        if (!months?.length) return 1;
        // Find last month with data
        const lastWithData = [...months].reverse().findIndex(m => (m.total_cargos || 0) > 0 || Object.keys(m.categorias || {}).length > 0);
        if (lastWithData === -1) return 1;
        // We want to skip the empty months at the end
        return lastWithData + 1;
    }, [months]);

    const [windowSize, setWindowSize] = useState(1);
    const [skipEnd, setSkipEnd] = useState(() => {
        if (!months?.length) return 0;
        const lastWithData = [...months].reverse().findIndex(m => (m.total_cargos || 0) > 0 || Object.keys(m.categorias || {}).length > 0);
        return Math.max(0, lastWithData);
    });

    const [viewFilter, setViewFilter] = useState('all');

    const filterOptions = useMemo(() => {
        const opts = [{ id: 'all', label: 'Todas' }];
        const sourceTypes = new Set(months.map(m => m.source_type).filter(Boolean));
        const uniqueAccountIds = [...new Set(months.map(m => m.account_id).filter(Boolean))];
        const tcAccounts = uniqueAccountIds.filter(aid => months.some(m => m.account_id === aid && m.source_type === 'tc'));
        const ccAccounts = uniqueAccountIds.filter(aid => months.some(m => m.account_id === aid && m.source_type === 'cc'));
        // "Solo TC/CC" solo es útil si hay múltiples cuentas de ese tipo
        if (sourceTypes.size > 1) {
            if (sourceTypes.has('tc') && tcAccounts.length > 1) opts.push({ id: 'tc', label: 'Solo TC' });
            if (sourceTypes.has('cc') && ccAccounts.length > 1) opts.push({ id: 'cc', label: 'Solo CC' });
        }
        if (uniqueAccountIds.length > 1) {
            uniqueAccountIds.forEach(aid => {
                const acc = accounts.find(a => a.id === aid);
                opts.push({ id: aid, label: acc?.name || acc?.nombre || acc?.alias || 'Cuenta' });
            });
        }
        return opts;
    }, [months, accounts]);

    const filteredMonths = useMemo(() => {
        if (viewFilter === 'all') return months;
        if (viewFilter === 'tc') return months.filter(m => m.source_type === 'tc');
        if (viewFilter === 'cc') return months.filter(m => m.source_type === 'cc');
        return months.filter(m => m.account_id === viewFilter);
    }, [months, viewFilter]);

    useEffect(() => { setSkipEnd(0); }, [viewFilter]);

    if (!months?.length) return (
        <div className="empty-state animate-fadeIn">
            <div className="empty-state-icon"><Upload size={26} /></div>
            <div className="empty-state-title">Sin datos para mostrar</div>
            <div className="empty-state-desc">Sube tu primer estado de cuenta para comenzar a visualizar tus finanzas.</div>
            <button className="btn btn-primary btn-lg" onClick={onGoUpload}>📄 Subir mes</button>
        </div>
    );

    const allSeries = useMemo(() => {
        const seen = new Set();
        const uniquePeriods = [];
        filteredMonths.forEach(m => { if (!seen.has(m.periodo)) { seen.add(m.periodo); uniquePeriods.push(m.periodo); } });
        return uniquePeriods.map(periodo => {
            const sources = filteredMonths.filter(m => m.periodo === periodo);
            const income = getMonthIncome(periodo, incomeByMonth, extraByMonth, defaultIncome);
            const fixedTotal = getMonthFixedTotal(periodo, fixedByMonth);
            const tc = viewFilter === 'cc' ? 0 : getTCExpenses(periodo, sources);
            const cc = getCCExpenses(periodo, sources, viewFilter === 'cc');
            const savings = getSavingsTransfers(periodo, sources);
            const gasto = tc + cc + fixedTotal;
            const ahorro = income - gasto;
            const categorias = sources.reduce((acc, m) => {
                Object.entries(m.categorias || {}).forEach(([k, v]) => { acc[k] = (acc[k] || 0) + v; });
                return acc;
            }, {});
            return { periodo, label: shortLabel(periodo), income, fixedTotal, tc, cc, savings, gasto, ahorro, categorias };
        });
    }, [filteredMonths, incomeByMonth, extraByMonth, fixedByMonth, defaultIncome, viewFilter]);

    const totalMonths = allSeries.length;
    const windowOptions = [
        { value: 1, label: 'Último mes' },
        ...Array.from({ length: 11 }, (_, i) => i + 2)
            .filter(n => n <= totalMonths)
            .map(n => ({ value: n, label: `Prom. ${n} meses` })),
    ];

    const effectiveWindow = Math.min(windowSize, totalMonths - skipEnd);
    const endIdx = allSeries.length - skipEnd;
    const series = allSeries.slice(Math.max(0, endIdx - effectiveWindow), endIdx);
    const n = series.length;
    const isLastOnly = n === 1;

    const avgIncome = Math.round(series.reduce((s, r) => s + r.income, 0) / n);
    const avgGasto = Math.round(series.reduce((s, r) => s + r.gasto, 0) / n);
    const avgAhorro = Math.round(series.reduce((s, r) => s + r.ahorro, 0) / n);
    const avgRate = pct(avgAhorro, avgIncome);
    const rateColor = avgRate >= 15 ? 'var(--success)' : avgRate >= 0 ? 'var(--warning)' : 'var(--danger)';
    const momDelta = n >= 2 ? series[n - 1].gasto - series[n - 2].gasto : null;
    const bestMonth = [...series].sort((a, b) => b.ahorro - a.ahorro)[0];
    const worstMonth = n > 1 ? [...series].sort((a, b) => a.ahorro - b.ahorro)[0] : null;
    const totalSavings = series.reduce((s, r) => s + (r.savings || 0), 0);

    const catAgg = {};
    series.forEach(r => Object.entries(r.categorias).forEach(([k, v]) => { catAgg[k] = (catAgg[k] || 0) + v; }));
    const topCats = Object.entries(catAgg)
        .map(([k, v]) => ({ key: k, label: allCats[k]?.label || k, color: allCats[k]?.color || '#888', total: v, avg: Math.round(v / (n || 1)) }))
        .sort((a, b) => b.total - a.total).slice(0, 8);

    const rateLine = series.map(r => ({ label: r.label, tasa: pct(r.ahorro, r.income) }));
    const latest = series[series.length - 1];
    const donutData = topCats.slice(0, 6)
        .map(c => ({ name: c.label, value: latest?.categorias[c.key] || 0, color: c.color }))
        .filter(d => d.value > 0);

    const savingsGoal = budget.savingsGoal || 0;
    const metricLabel = isLastOnly ? '' : 'prom.';

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <div className="page-title">Dashboard</div>
                    <div className="page-subtitle">{isLastOnly ? latest?.label : `${series[0]?.label} → ${series[n - 1]?.label}`}</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={onGoUpload}>📄 + Subir</button>
            </div>

            {filterOptions.length > 1 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {filterOptions.map(opt => (
                        <button key={opt.id} onClick={() => setViewFilter(opt.id)} style={{
                            padding: '5px 12px', borderRadius: 'var(--radius-full)',
                            fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                            background: viewFilter === opt.id ? 'var(--primary)' : 'var(--bg-hover)',
                            color: viewFilter === opt.id ? '#fff' : 'var(--text-secondary)',
                            transition: 'background .15s, color .15s',
                        }}>
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
            <div style={{ marginBottom: 16 }}>
                <select
                    value={effectiveWindow}
                    onChange={e => setWindowSize(Number(e.target.value))}
                    className="input"
                    style={{ width: 'auto', paddingRight: 36 }}
                >
                    {windowOptions.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>
            </div>

            <div className="dashboard-grid">
                <Metric label={`Ahorro ${metricLabel}`} value={CLP(avgAhorro)} color={rateColor}
                    note="ingreso − gasto" />
                <Metric label="Tasa ahorro" value={avgRate + '%'} color={rateColor}
                    note={savingsGoal > 0 ? `meta ${pct(savingsGoal, avgIncome)}%` : 'meta mín. 15%'} />
                <Metric label={`Ingreso ${metricLabel}`} value={CLP(avgIncome)} color="var(--primary)"
                    note={viewFilter === 'all' ? 'sueldo + extras + abonos CC' : viewFilter === 'tc' ? 'solo tarjeta' : viewFilter === 'cc' ? 'solo cuenta corriente' : 'cuenta seleccionada'} />
                <Metric label={`Gasto ${metricLabel}`} value={CLP(avgGasto)} color="var(--danger)"
                    note={viewFilter === 'cc' ? 'CC + fijos' : viewFilter === 'tc' ? 'TC + fijos' : 'TC + CC + fijos'} />
            </div>

            <HealthSemaphore series={series} budget={budget} isAverage={!isLastOnly} />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: '1.5rem' }}>
                {momDelta !== null && (
                    <span style={{
                        fontSize: 12, padding: '5px 12px', borderRadius: 'var(--radius-full)',
                        background: momDelta <= 0 ? 'var(--success-light)' : 'var(--danger-light)',
                        color: momDelta <= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 500
                    }}>
                        {momDelta <= 0 ? '↓' : '↑'} Gasto {momDelta <= 0 ? 'bajó' : 'subió'} {CLP(Math.abs(momDelta))}
                    </span>
                )}
                {bestMonth && (
                    <span style={{ fontSize: 12, padding: '5px 12px', borderRadius: 'var(--radius-full)', background: 'var(--success-light)', color: 'var(--success)', fontWeight: 500 }}>
                        🏆 Mayor ahorro: {bestMonth.label} · {CLP(bestMonth.ahorro)}
                    </span>
                )}
                {worstMonth && (
                    <span style={{ fontSize: 12, padding: '5px 12px', borderRadius: 'var(--radius-full)', background: 'var(--danger-light)', color: 'var(--danger)', fontWeight: 500 }}>
                        ↓ Menor ahorro: {worstMonth.label} · {CLP(worstMonth.ahorro)}
                    </span>
                )}
                {totalSavings > 0 && (
                    <span style={{ fontSize: 12, padding: '5px 12px', borderRadius: 'var(--radius-full)', background: 'var(--success-light)', color: 'var(--success)', fontWeight: 500 }}>
                        💰 Ahorro efectivo: {CLP(totalSavings)}
                    </span>
                )}
            </div>

            <EndingInstallmentsWidget months={months} />

            {series.length === 1 && (
                <div style={{ background: "var(--primary-light, #ecfdf5)", border: "1px solid var(--primary-border, #6ee7b7)", borderRadius: "var(--radius-md)", padding: "12px 16px", marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)" }}>Sube más meses para ver tendencias</div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>Con 2+ meses podrás ver tu evolución, promedios y comparativas.</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={onGoUpload} style={{ whiteSpace: "nowrap" }}>📄 + Subir</button>
                </div>
            )}
            <Section mt="0">Ingresos vs gastos por mes</Section>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={series} barGap={2} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={CLPk} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} width={40} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--border-light)', opacity: .6 }} />
                        <Bar dataKey="income" name="Ingreso" fill="var(--primary-border)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="tc" name="Tarjeta" stackId="g" fill="#FCA5A5" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="fixedTotal" name="Fijos" stackId="g" fill="var(--warning-border)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                    {[['var(--primary-border)', 'Ingreso'], ['#FCA5A5', 'Tarjeta'], ['var(--warning-border)', 'Fijos']].map(([c, l]) => (
                        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)' }}>
                            <span style={{ width: 9, height: 9, borderRadius: 3, background: c, display: 'inline-block' }} />{l}
                        </div>
                    ))}
                </div>
            </div>

            <Section mt="0">Tasa de ahorro mensual</Section>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={rateLine}>
                        <defs>
                            <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={rateColor} stopOpacity={.2} />
                                <stop offset="95%" stopColor={rateColor} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={v => v + '%'} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} width={34} />
                        <Tooltip formatter={v => [v + '%', 'Tasa']} contentStyle={{ fontSize: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)' }} />
                        <ReferenceLine y={15} stroke="var(--success)" strokeDasharray="4 4" strokeWidth={1.5} />
                        {savingsGoal > 0 && <ReferenceLine y={pct(savingsGoal, avgIncome)} stroke="var(--primary)" strokeDasharray="4 4" strokeWidth={1.5} />}
                        <Area type="monotone" dataKey="tasa" stroke={rateColor} strokeWidth={2.5} fill="url(#rateGrad)" dot={{ r: 3.5, fill: rateColor, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                    </AreaChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>— — Meta mín. 15%</div>
                    {savingsGoal > 0 && <div style={{ fontSize: 10, color: 'var(--primary)' }}>— — Tu meta {CLP(savingsGoal)}</div>}
                </div>
            </div>

            <Section mt="0">Categorías — acumulado</Section>
            <div className="card" style={{ padding: '4px 16px 12px', marginBottom: '1.5rem' }}>
                {topCats.map(c => (
                    <div key={c.key} style={{ paddingTop: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, display: 'inline-block' }} />
                                <span style={{ fontWeight: 500 }}>{c.label}</span>
                            </div>
                            <div>
                                <span style={{ fontWeight: 600 }}>{CLP(c.total)}</span>
                                <span style={{ color: 'var(--text-tertiary)', marginLeft: 8 }}>prom {CLP(c.avg)}/mes</span>
                            </div>
                        </div>
                        <div style={{ background: 'var(--bg-hover)', borderRadius: 4, height: 4 }}>
                            <div style={{ width: pct(c.total, topCats[0].total) + '%', height: 4, borderRadius: 4, background: c.color, transition: 'width .6s ease' }} />
                        </div>
                    </div>
                ))}
            </div>

            {donutData.length > 0 && (
                <>
                    <Section mt="0">Distribución — {latest?.periodo}</Section>
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                                <Pie data={donutData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={2}>
                                    {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                </Pie>
                                <Tooltip formatter={(v, nm) => [CLP(v), nm]} contentStyle={{ fontSize: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', background: 'var(--bg-card)' }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {donutData.map(d => (
                                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0, display: 'inline-block' }} />
                                    <span style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                                    <span style={{ fontWeight: 600 }}>{CLP(d.value)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {n >= 2 && (
                <>
                    <Section mt="0">Resumen por mes</Section>
                    <div className="card" style={{ padding: 0, overflowX: 'auto', marginBottom: '2rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-medium)' }}>
                                    {['Mes', 'Ingreso', 'Tarjeta', 'Fijos', 'Total', 'Ahorro', 'Tasa'].map(h => (
                                        <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Mes' ? 'left' : 'right', color: 'var(--text-tertiary)', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {[...series].reverse().map((r, i) => {
                                    const rate = pct(r.ahorro, r.income);
                                    const rc = r.ahorro >= 0 ? 'var(--success)' : 'var(--danger)';
                                    return (
                                        <tr key={r.periodo}
                                            onClick={() => onGoHistory && onGoHistory(r.periodo)}
                                            style={{ borderBottom: '1px solid var(--border-light)', cursor: 'pointer', transition: 'background .12s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = i % 2 !== 0 ? 'var(--bg-input)' : 'transparent'}
                                        >
                                            <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{r.label} <span style={{ fontSize: 10, opacity: .6 }}>›</span></td>
                                            <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--primary)', fontWeight: 500 }}>{CLP(r.income)}</td>
                                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>{CLP(r.tc)}</td>
                                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>{CLP(r.fixedTotal)}</td>
                                            <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--danger)', fontWeight: 600 }}>{CLP(r.gasto)}</td>
                                            <td style={{ padding: '10px 14px', textAlign: 'right', color: rc, fontWeight: 600 }}>{CLP(r.ahorro)}</td>
                                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                                <span style={{ background: rate >= 15 ? 'var(--success-light)' : rate >= 0 ? 'var(--warning-light)' : 'var(--danger-light)', color: rc, padding: '3px 8px', borderRadius: 'var(--radius-full)', fontWeight: 600, fontSize: 11 }}>{rate}%</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
