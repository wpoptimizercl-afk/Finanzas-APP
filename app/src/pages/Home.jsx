import { useState } from 'react';
import { ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import Metric from '../components/ui/Metric';
import Section from '../components/ui/Section';
import Tag from '../components/ui/Tag';
import { CLP, pct, shortLabel } from '../utils/formatters';
import { getMonthFixed, getMonthFixedTotal, getMonthSalary, getMonthExtraItems, getMonthExtraTotal } from '../utils/calculations';
import { SOURCE_OPTS } from '../lib/constants';

export default function HomePage({ allMonths, fixedByMonth, incomeByMonth, extraByMonth, defaultIncome, budget, allCats, onGoUpload }) {
    const defaultIdx = useMemo(() => {
        if (!allMonths.length) return 0;
        // Find last month with data, otherwise last month in general
        const lastWithData = [...allMonths].reverse().findIndex(m => (m.total_cargos || 0) > 0 || Object.keys(m.categorias || {}).length > 0);
        if (lastWithData === -1) return allMonths.length - 1;
        return allMonths.length - 1 - lastWithData;
    }, [allMonths]);

    const [selIdx, setSelIdx] = useState(defaultIdx);

    const clampedIdx = allMonths.length > 0 ? Math.min(selIdx, allMonths.length - 1) : 0;
    const latest = allMonths[clampedIdx] || null;
    const prevMonth = clampedIdx > 0 ? allMonths[clampedIdx - 1] : null;

    if (!latest) return (
        <div className="empty-state animate-fadeIn">
            <div className="empty-state-icon"><Upload size={26} /></div>
            <div className="empty-state-title">Sin datos todavía</div>
            <div className="empty-state-desc">Sube tu primer estado de cuenta para comenzar a visualizar tus finanzas.</div>
            <button className="btn btn-primary btn-lg" onClick={onGoUpload}>📄 Subir estado de cuenta</button>
        </div>
    );

    const fixedItems = getMonthFixed(latest.periodo, fixedByMonth);
    const fixedTotal = getMonthFixedTotal(latest.periodo, fixedByMonth);
    const salary = getMonthSalary(latest.periodo, incomeByMonth, defaultIncome);
    const extraItems = getMonthExtraItems(latest.periodo, extraByMonth);
    const extraTotal = getMonthExtraTotal(latest.periodo, extraByMonth);
    const income = salary + extraTotal;
    const incomeIsDefault = incomeByMonth[latest.periodo] == null && extraItems.length === 0;
    const tcTotal = latest.total_cargos || 0;
    const totalGasto = tcTotal + fixedTotal;
    const ahorro = income - totalGasto;
    const aRate = pct(ahorro, income);
    const aColor = ahorro >= income * .15 ? 'var(--success)' : ahorro >= 0 ? 'var(--warning)' : 'var(--danger)';
    const budgetCats = budget.categories || {};
    const savingsGoal = budget.savingsGoal || 0;
    const prevCats = prevMonth ? (prevMonth.categorias || {}) : {};
    const totalDeuda = (latest.cuotas_vigentes || []).reduce((s, c) => s + (c.monto_cuota || 0) * Math.max(0, (c.total_cuotas || 0) - (c.cuota_actual || 0)), 0);
    const goalMet = ahorro >= savingsGoal;
    const goalColor = goalMet ? 'var(--success)' : ahorro > 0 ? 'var(--warning)' : 'var(--danger)';
    const goalPct = pct(ahorro, savingsGoal);
    const canPrev = clampedIdx > 0;
    const canNext = clampedIdx < allMonths.length - 1;
    const isLatest = clampedIdx === allMonths.length - 1;
    const prevLabel = prevMonth ? shortLabel(prevMonth.periodo) : null;

    const catRows = Object.entries(latest.categorias || {}).map(([k, v]) => {
        const prevVal = prevCats[k] || 0;
        const delta = prevVal > 0 ? Math.round(((v - prevVal) / prevVal) * 100) : null;
        return { key: k, value: v, label: allCats[k]?.label || k, color: allCats[k]?.color || '#888', tope: budgetCats[k] || 0, delta };
    }).sort((a, b) => b.value - a.value);

    const navBtn = (enabled) => ({
        width: 32, height: 32, borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-medium)',
        background: enabled ? 'var(--bg-card)' : 'var(--bg-input)',
        color: enabled ? 'var(--text-primary)' : 'var(--text-tertiary)',
        cursor: enabled ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    });

    return (
        <div className="animate-fadeIn">
            {/* Month selector */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button style={navBtn(canPrev)} onClick={() => canPrev && setSelIdx(clampedIdx - 1)} disabled={!canPrev}><ChevronLeft size={16} /></button>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.3px' }}>{latest.periodo}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{latest.periodo_desde} — {latest.periodo_hasta}</div>
                    </div>
                    <button style={navBtn(canNext)} onClick={() => canNext && setSelIdx(clampedIdx + 1)} disabled={!canNext}><ChevronRight size={16} /></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {incomeIsDefault && <Tag label="Ingreso estimado" color="var(--warning)" bg="var(--warning-light)" />}
                    {!isLatest && <Tag label="Mes anterior" color="var(--text-tertiary)" bg="var(--bg-hover)" />}
                </div>
            </div>

            {/* Metrics grid */}
            <div className="dashboard-grid" style={{ marginBottom: 10 }}>
                <Metric label="Ingreso" value={CLP(income)} color="var(--primary)" />
                <Metric label="Gasto del mes" value={CLP(totalGasto)} color="var(--danger)" />
                <Metric label="Saldo Tarjeta" value={CLP(latest.total_facturado || tcTotal)} color="var(--text-secondary)" />
                <Metric label="Ahorro" value={CLP(ahorro)} color={aColor} />
            </div>

            {/* Savings rate bar */}
            <div className="card" style={{ padding: '14px 16px', marginBottom: savingsGoal > 0 ? 10 : '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Tasa de ahorro</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: aColor, letterSpacing: '-.5px' }}>{aRate}%</span>
                </div>
                <div className="progress-track">
                    <div className="progress-bar" style={{ width: Math.max(0, aRate) + '%', background: aColor }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 7 }}>
                    <span>Gasto total {CLP(totalGasto)}</span>
                    <span>{CLP(ahorro)} disponible</span>
                </div>
            </div>

            {/* Savings goal */}
            {savingsGoal > 0 && (
                <div className="card" style={{ padding: '14px 16px', marginBottom: '1.5rem', border: `1px solid ${goalMet ? 'var(--success-border)' : 'var(--border-medium)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Meta de ahorro mensual</span>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 16, fontWeight: 700, color: goalColor, letterSpacing: '-.3px' }}>{CLP(ahorro)}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 4 }}>/ {CLP(savingsGoal)}</span>
                        </div>
                    </div>
                    <div className="progress-track">
                        <div className="progress-bar" style={{ width: Math.min(100, Math.max(0, goalPct)) + '%', background: goalColor }} />
                    </div>
                    <div style={{ fontSize: 11, color: goalColor, marginTop: 7, fontWeight: 500 }}>
                        {goalMet ? `✓ Meta cumplida · superaste la meta por ${CLP(ahorro - savingsGoal)}` : `Te faltan ${CLP(savingsGoal - ahorro)} para alcanzar tu meta`}
                    </div>
                </div>
            )}

            {/* Cuotas */}
            {(() => {
                const currentCuotas = (latest.cuotas_vigentes || []).filter(c => (c.cuota_actual || 0) > 0);
                if (currentCuotas.length === 0) return null;

                return (
                    <div>
                        <Section mt="0">Cuotas del mes</Section>
                        <div className="card" style={{ padding: '4px 0', marginBottom: '1.5rem' }}>
                            {currentCuotas.map((c, i) => {
                                const restantes = c.total_cuotas - c.cuota_actual;
                                const isLast = restantes === 0;
                                return (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: i < currentCuotas.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{c.descripcion}</span>
                                                {isLast && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', background: 'var(--success-light)', border: '1px solid var(--success-border, var(--success))', padding: '1px 6px', borderRadius: 20 }}>✓ Última cuota</span>}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                                Cuota {c.cuota_actual} de {c.total_cuotas}{isLast ? ' · ¡se termina este mes!' : ` · ${restantes} restante${restantes !== 1 ? 's' : ''}`}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {CLP(c.monto_cuota)}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>/mes</span>
                                        </div>
                                    </div>
                                );
                            })}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderTop: '2px solid var(--border-medium)', background: 'var(--bg-input)' }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Total cuotas del mes</span>
                                <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.4px' }}>{CLP(currentCuotas.reduce((s, c) => s + (c.monto_cuota || 0), 0))}</span>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Cuotas futuras */}
            {totalDeuda > 0 && (
                <div>
                    <Section mt="0">Deuda futura en cuotas</Section>
                    <div className="card" style={{ padding: '4px 0', overflow: 'hidden', marginBottom: '1.5rem' }}>
                        {(latest.cuotas_vigentes || [])
                            .map(c => ({ ...c, restantes: Math.max(0, c.total_cuotas - c.cuota_actual) }))
                            .filter(c => c.restantes > 0)
                            .map((c, i, arr) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{c.descripcion}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{c.restantes} cuota{c.restantes !== 1 ? 's' : ''} × {CLP(c.monto_cuota)}</div>
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{CLP(c.monto_cuota * c.restantes)}</div>
                                </div>
                            ))
                        }
                        {/* Next month subtotal */}
                        {(() => {
                            const nextMonthItems = (latest.cuotas_vigentes || []).filter(c => Math.max(0, c.total_cuotas - c.cuota_actual) > 0);
                            const nextMonthTotal = nextMonthItems.reduce((s, c) => s + (c.monto_cuota || 0), 0);
                            return (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderTop: '1px solid var(--border-medium)', background: 'var(--bg-input)' }}>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Pago el próximo mes</div>
                                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{nextMonthItems.length} cuota{nextMonthItems.length !== 1 ? 's' : ''} activa{nextMonthItems.length !== 1 ? 's' : ''}</div>
                                    </div>
                                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.3px' }}>{CLP(nextMonthTotal)}</div>
                                </div>
                            );
                        })()}
                        {/* Grand total */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderTop: '2px solid var(--border-medium)', background: 'var(--bg-input)' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Total deuda futura</span>
                            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)', letterSpacing: '-.4px' }}>{CLP(totalDeuda)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Category breakdown */}
            <Section mt="0">Tarjeta por categoría</Section>
            {prevLabel && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 10, marginTop: -6 }}>
                    Las variaciones <strong style={{ color: 'var(--text-secondary)' }}>↑↓%</strong> comparan con <strong style={{ color: 'var(--text-secondary)' }}>{prevLabel}</strong>
                </div>
            )}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.5rem' }}>
                {catRows.map((c, i) => {
                    const over = c.tope > 0 && c.value > c.tope;
                    const barPct = c.tope > 0 ? Math.min(pct(c.value, c.tope), 100) : 0;
                    const dColor = c.delta === null ? null : c.delta <= 0 ? '#065F46' : '#fff';
                    const dBg = c.delta === null ? null : c.delta <= 0 ? '#D1FAE5' : c.delta > 20 ? '#B91C1C' : '#B45309';
                    return (
                        <div key={c.key} style={{ padding: '12px 16px', borderBottom: i < catRows.length - 1 ? '1px solid var(--border-light)' : 'none', background: over ? 'var(--danger-light)' : 'transparent' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: c.tope > 0 ? 8 : 0 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0, display: 'block' }} />
                                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{c.label}</span>
                                {dColor && (
                                    <span style={{ fontSize: 10, fontWeight: 700, color: dColor, background: dBg, border: `1px solid ${dBg}`, padding: '2px 7px', borderRadius: 6 }}>
                                        {c.delta > 0 ? '↑' : '↓'}{Math.abs(c.delta)}% vs {prevLabel}
                                    </span>
                                )}
                                <div style={{ width: 90, textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: over ? 'var(--danger)' : 'var(--text-primary)' }}>{CLP(c.value)}</div>
                                    {over && <div style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 500 }}>+{CLP(c.value - c.tope)} sobre tope</div>}
                                </div>
                            </div>
                            {c.tope > 0 && (
                                <div style={{ paddingLeft: 18 }}>
                                    <div style={{ height: 4, borderRadius: 4, background: over ? 'var(--danger-border)' : 'var(--bg-hover)', overflow: 'hidden' }}>
                                        <div style={{ width: barPct + '%', height: 4, borderRadius: 4, background: over ? 'var(--danger)' : barPct > 80 ? 'var(--warning)' : 'var(--success)', transition: 'width .5s ease' }} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                        <span style={{ fontSize: 10, color: over ? 'var(--danger)' : 'var(--text-tertiary)', fontWeight: 500 }}>{barPct}% del tope</span>
                                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>tope {CLP(c.tope)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Fixed items */}
            {fixedItems.length > 0 && (
                <div>
                    <Section mt="0">Gastos fijos del mes</Section>
                    <div className="card" style={{ padding: '4px 0', marginBottom: '1.5rem' }}>
                        {fixedItems.map((f, i) => {
                            const src = SOURCE_OPTS.find(s => s.id === (f.source || 'fijo')) || SOURCE_OPTS[0];
                            return (
                                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: i < fixedItems.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: 13, fontWeight: 500 }}>{f.name}</span>
                                        <Tag label={src.label} color={src.color} bg={src.bg} />
                                    </div>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{CLP(f.amount)}</span>
                                </div>
                            );
                        })}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 16px', fontSize: 13, fontWeight: 600, borderTop: '1px solid var(--border-medium)' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Total fijos</span>
                            <span>{CLP(fixedTotal)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
