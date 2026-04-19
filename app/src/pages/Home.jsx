import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import CategoryRow from '../components/CategoryRow';
import Tag from '../components/ui/Tag';
import FinancingSummary from '../components/FinancingSummary';
import { CLP, pct, shortLabel, isCurrentMonth } from '../utils/formatters';
import { getMonthFixed, getMonthFixedTotal, getMonthIncome, getMonthExtraItems, getMonthExtraTotal, getExpenseTotal } from '../utils/calculations';
import { SOURCE_OPTS, VIEW_MODE } from '../lib/constants';

export default function HomePage({ allMonths, uniqueSortedPeriods, accounts, fixedByMonth, incomeByMonth, extraByMonth, defaultIncome, budget, allCats, onGoUpload }) {
    const defaultIdx = useMemo(() => {
        if (!uniqueSortedPeriods.length) return 0;
        for (let i = uniqueSortedPeriods.length - 1; i >= 0; i--) {
            const srcs = allMonths.filter(m => m.periodo === uniqueSortedPeriods[i]);
            if (srcs.some(m => (m.total_cargos || 0) > 0 || Object.keys(m.categorias || {}).length > 0)) return i;
        }
        return uniqueSortedPeriods.length - 1;
    }, [uniqueSortedPeriods, allMonths]);

    const [selIdx, setSelIdx] = useState(defaultIdx);

    const clampedIdx = uniqueSortedPeriods.length > 0 ? Math.min(selIdx, uniqueSortedPeriods.length - 1) : 0;
    const periodo = uniqueSortedPeriods[clampedIdx] || null;
    const sources = allMonths.filter(m => m.periodo === periodo);
    const tcSources = sources.filter(m => m.source_type !== 'cc');
    const ccSources = sources.filter(m => m.source_type === 'cc');
    const primarySource = tcSources[0] || ccSources[0] || null;

    if (!periodo || sources.length === 0) return (
        <div className="empty-state animate-fadeIn">
            <div className="empty-state-icon"><Upload size={26} /></div>
            <div className="empty-state-title">Sin datos todavía</div>
            <div className="empty-state-desc">Sube tu primer estado de cuenta para comenzar a visualizar tus finanzas.</div>
            <button className="btn btn-primary btn-lg" onClick={onGoUpload}>Subir estado de cuenta</button>
        </div>
    );

    const fixedItems = getMonthFixed(periodo, fixedByMonth);
    const fixedTotal = getMonthFixedTotal(periodo, fixedByMonth);
    const extraItems = getMonthExtraItems(periodo, extraByMonth);
    const extraTotal = getMonthExtraTotal(periodo, extraByMonth);
    const income = getMonthIncome(periodo, incomeByMonth, extraByMonth, defaultIncome);
    const incomeIsDefault = incomeByMonth[periodo] == null && extraTotal === 0;
    const tempCount = sources.reduce((sum, m) => sum + (m.transacciones || []).filter(t => t.is_temporary).length, 0);

    // VIEW_MODE.ALL: excluye traspaso_tc en CC para evitar doble conteo con TC
    const totalGasto = getExpenseTotal(periodo, allMonths, fixedByMonth, VIEW_MODE.ALL);
    const ahorro = income - totalGasto;
    const aRate = pct(ahorro, income);
    const aColor = ahorro >= income * .15 ? 'var(--success)' : ahorro >= 0 ? 'var(--warning)' : 'var(--danger)';

    const budgetCats = budget.categories || {};
    const savingsGoal = budget.savingsGoal || 0;
    const goalMet = ahorro >= savingsGoal;
    const goalColor = goalMet ? 'var(--success)' : ahorro > 0 ? 'var(--warning)' : 'var(--danger)';
    const goalPct = pct(ahorro, savingsGoal);

    // Previous period for comparison
    const prevPeriodo = clampedIdx > 0 ? uniqueSortedPeriods[clampedIdx - 1] : null;
    const prevSources = prevPeriodo ? allMonths.filter(m => m.periodo === prevPeriodo) : [];
    const prevCats = prevSources.reduce((acc, m) => {
        Object.entries(m.categorias || {}).forEach(([k, v]) => { acc[k] = (acc[k] || 0) + v; });
        return acc;
    }, {});
    const prevLabel = prevPeriodo ? shortLabel(prevPeriodo) : null;

    // TC combined data
    const tcCats = tcSources.reduce((acc, m) => {
        Object.entries(m.categorias || {}).filter(([k]) => k !== 'traspaso_tc').forEach(([k, v]) => { acc[k] = (acc[k] || 0) + v; });
        return acc;
    }, {});
    const allCuotas = tcSources.flatMap(m => m.cuotas_vigentes || []);

    // CC expense categories (computed at top level for merging)
    const ccEgCats = ccSources.length > 0 ? (() => {
        const cats = {};
        (ccSources[0].transacciones || []).forEach(t => {
            if (t.tipo === 'traspaso_tc' || t.categoria === 'traspaso_tc') return;
            if (t.tipo === 'cargo') cats[t.categoria || 'otros'] = (cats[t.categoria || 'otros'] || 0) + t.monto;
        });
        return cats;
    })() : {};

    // Merged categories (TC + CC) for unified breakdown
    const mergedCats = { ...tcCats };
    Object.entries(ccEgCats).forEach(([k, v]) => { mergedCats[k] = (mergedCats[k] || 0) + v; });
    const mergedCatRows = Object.entries(mergedCats).map(([k, v]) => {
        const prevVal = prevCats[k] || 0;
        const delta = prevVal > 0 ? Math.round(((v - prevVal) / prevVal) * 100) : null;
        return { key: k, value: v, label: allCats[k]?.label || k, color: allCats[k]?.color || '#888', tope: budgetCats[k] || 0, delta };
    }).sort((a, b) => b.value - a.value);
    const totalDeuda = allCuotas.reduce((s, c) => s + (c.monto_cuota || 0) * Math.max(0, (c.total_cuotas || 0) - (c.cuota_actual || 0)), 0);
    const tcSaldoTotal = tcSources.reduce((s, m) => s + (m.total_facturado || m.total_cargos || 0), 0);

    const canPrev = clampedIdx > 0;
    const canNext = clampedIdx < uniqueSortedPeriods.length - 1;
    const isLatest = clampedIdx === uniqueSortedPeriods.length - 1;

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
            {/* Period nav */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button style={navBtn(canPrev)} onClick={() => canPrev && setSelIdx(clampedIdx - 1)} disabled={!canPrev}><ChevronLeft size={16} /></button>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-.3px', fontFamily: 'var(--font-mono)' }}>{periodo}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{primarySource?.periodo_desde} — {primarySource?.periodo_hasta}</div>
                    </div>
                    <button style={navBtn(canNext)} onClick={() => canNext && setSelIdx(clampedIdx + 1)} disabled={!canNext}><ChevronRight size={16} /></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {incomeIsDefault && <Tag label="Ingreso estimado" color="var(--amber)" bg="var(--amber-soft)" />}
                    {!isLatest && <Tag label="Mes anterior" color="var(--text-tertiary)" bg="var(--bg-hover)" />}
                    {tcSources.length > 0 && ccSources.length > 0 && <Tag label="TC + CC" color="var(--ink-3)" bg="var(--rule)" />}
                    {tempCount > 0 && (
                        <span style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                            background: 'var(--amber-soft)', color: 'var(--amber)', fontWeight: 600,
                        }}>
                            {tempCount} gasto{tempCount > 1 ? 's' : ''} temporal{tempCount > 1 ? 'es' : ''}
                        </span>
                    )}
                </div>
            </div>

            {/* Unified Hero */}
            <div className="ph-hero">
                <div className="eyebrow">{ahorro >= 0 ? 'EXCEDENTE DEL MES' : 'DÉFICIT DEL MES'}</div>
                <div className="amt">
                    <span className="sg">{ahorro >= 0 ? '+' : '-'}</span>
                    {CLP(Math.abs(ahorro))}
                </div>
                <div className="sub">
                    <span><i style={{background: 'var(--ink)'}}></i>Ingreso {CLP(income)}</span>
                    <span><i style={{background: 'var(--red)'}}></i>Gasto {CLP(totalGasto)}</span>
                    <span style={{color: 'var(--text-tertiary)'}}>Tasa {aRate}%</span>
                </div>
            </div>

            <section className="ph-section">
                <h4>GASTOS DEL MES</h4>
                <div className="ph-kpi">
                    <div className="c"><div className="l">TARJETA</div><div className="v">{CLP(tcSaldoTotal)}</div></div>
                    <div className="c"><div className="l">FIJOS</div><div className="v">{CLP(fixedTotal)}</div></div>
                    <div className="c"><div className="l">CUOTAS</div><div className="v">{CLP(allCuotas.reduce((s, c) => s + ((c.cuota_actual > 0) ? c.monto_cuota : 0), 0))}</div></div>
                </div>
            </section>

            {/* ── Total Financiamiento (TC + Línea de crédito) ─────────────── */}
            <FinancingSummary periodo={periodo} months={allMonths} />

            {/* ── Unified category breakdown ───────────────────────────────── */}
            {mergedCatRows.length > 0 && (
                <section className="ph-section">
                    <h4>CATEGORÍAS <em>{mergedCatRows.length} de {Object.keys(allCats).length}</em></h4>
                    {mergedCatRows.map((c) => (
                        <CategoryRow key={c.key} color={c.color} label={c.label}
                            amount={c.value} delta={c.delta} formatCLP={CLP} />
                    ))}
                </section>
            )}

            {/* ── TC section ───────────────────────────────────────────────── */}
            {tcSources.length > 0 && (() => {
                const currentCuotas = allCuotas.filter(c => (c.cuota_actual || 0) > 0);
                const cuotasMesTotal = currentCuotas.reduce((s, c) => s + (c.monto_cuota || 0), 0);

                return (
                    <section className="ph-section">
                        <h4>TARJETA DE CRÉDITO <em>{CLP(tcSaldoTotal)}</em></h4>
                        {(cuotasMesTotal > 0 || totalDeuda > 0) && (
                            <div className="ph-kpi" style={{ marginBottom: currentCuotas.length > 0 ? 14 : 0 }}>
                                {cuotasMesTotal > 0 && <div className="c"><div className="l">Cuotas del mes</div><div className="v">{CLP(cuotasMesTotal)}</div></div>}
                                {totalDeuda > 0 && <div className="c"><div className="l">Deuda futura</div><div className="v">{CLP(totalDeuda)}</div></div>}
                            </div>
                        )}
                        {currentCuotas.map((c, i) => {
                            const restantes = c.total_cuotas - c.cuota_actual;
                            const isLast = restantes === 0;
                            return (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < currentCuotas.length - 1 ? '1px dashed var(--rule)' : 'none' }}>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 500 }}>{c.descripcion}</div>
                                        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                                            {c.cuota_actual} de {c.total_cuotas}{isLast ? (isCurrentMonth(periodo) ? ' · ¡última cuota!' : ' · última cuota') : ` · ${restantes} restante${restantes !== 1 ? 's' : ''}`}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        {isLast && <div style={{ fontSize: 10, color: 'var(--olive)', marginBottom: 2 }}>✓ Última</div>}
                                        <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                                            {CLP(c.monto_cuota)}<span style={{ fontSize: 11, color: 'var(--ink-3)' }}>/mes</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </section>
                );
            })()}

            {/* ── CC section ───────────────────────────────────────────────── */}
            {ccSources.length > 0 && (() => {
                const ccSource = ccSources[0];
                const ccIngTotal = (ccSource.transacciones || [])
                    .filter(t => t.tipo === 'abono' && t.tipo !== 'traspaso_tc' && t.categoria !== 'traspaso_tc')
                    .reduce((s, t) => s + t.monto, 0);

                return (
                    <section className="ph-section">
                        <h4>CUENTA CORRIENTE <em>{CLP(ccSource.saldo_final || 0)}</em></h4>
                        <div className="ph-kpi">
                            <div className="c"><div className="l">Saldo final</div><div className="v">{CLP(ccSource.saldo_final || 0)}</div></div>
                            <div className="c"><div className="l">Ingresos</div><div className="v">{CLP(ccIngTotal)}</div></div>
                        </div>
                    </section>
                );
            })()}

            {/* Fixed items */}
            {fixedItems.length > 0 && (
                <section className="ph-section">
                    <h4>GASTOS FIJOS <em>{CLP(fixedTotal)}</em></h4>
                    {fixedItems.map((f, i) => {
                        const src = SOURCE_OPTS.find(s => s.id === (f.source || 'fijo')) || SOURCE_OPTS[0];
                        return (
                            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < fixedItems.length - 1 ? '1px dashed var(--rule)' : 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>{f.name}</span>
                                    <Tag label={src.label} color={src.color} bg={src.bg} />
                                </div>
                                <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{CLP(f.amount)}</span>
                            </div>
                        );
                    })}
                </section>
            )}
        </div>
    );
}
