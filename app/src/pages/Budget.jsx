import { useState } from 'react';
import Section from '../components/ui/Section';
import { CLP } from '../utils/formatters';
import { DEF_BUDGET } from '../lib/constants';

export default function BudgetPage({ budget, allCats, months, fixedByMonth, incomeByMonth, extraByMonth, defaultIncome, onSaveBudget }) {
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState(() => ({
        income: budget.income || defaultIncome || 0,
        savingsGoal: budget.savingsGoal || 0,
        categories: { ...DEF_BUDGET.categories, ...budget.categories },
    }));

    const handleSave = async () => {
        await onSaveBudget(form);
        setEditing(false);
    };

    // Agregar categorías de TODOS los months del período más reciente (TC + CC)
    const latestPeriodo = months.length > 0 ? months[months.length - 1].periodo : null;
    const catActual = latestPeriodo
        ? months
            .filter(m => m.periodo === latestPeriodo)
            .reduce((acc, m) => {
                Object.entries(m.categorias || {}).forEach(([k, v]) => { acc[k] = (acc[k] || 0) + v; });
                return acc;
            }, {})
        : {};

    const allCatKeys = Object.keys(form.categories);
    const budgetTotal = allCatKeys.reduce((s, k) => s + (form.categories[k] || 0), 0);
    const goalPct = form.income > 0 ? Math.round((form.savingsGoal / form.income) * 100) : 0;
    const remainingForCats = form.income - form.savingsGoal - budgetTotal;

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <div className="page-title">Presupuesto</div>
                    <div className="page-subtitle">Define topes por categoría</div>
                </div>
                <button onClick={() => editing ? handleSave() : setEditing(true)} className={`btn ${editing ? 'btn-primary' : 'btn-ghost'}`}>
                    {editing ? 'Guardar' : 'Editar'}
                </button>
            </div>

            {/* Defaults */}
            <Section mt="0">Ingreso y metas</Section>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[
                        { label: 'Ingreso mensual base', key: 'income', note: 'Se usa cuando no hay ingreso registrado para el mes' },
                        { label: 'Meta de ahorro mensual', key: 'savingsGoal', note: `${goalPct}% del ingreso base` },
                    ].map(({ label, key, note }) => (
                        <div key={key}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</label>
                                {editing ? (
                                    <input type="number" value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: Number(e.target.value) || 0 }))}
                                        className="input" style={{ width: 130, textAlign: 'right' }} placeholder="0" />
                                ) : (
                                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>{CLP(form[key])}</span>
                                )}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{note}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Cat budgets */}
            <Section mt="0">Tope por categoría</Section>
            {!editing && budgetTotal === 0 && (
                <div style={{ background: 'var(--warning-light)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)' }}>Sin topes definidos</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Define cuánto quieres gastar por categoría para controlar tu presupuesto.</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>Definir →</button>
                </div>
            )}
            <div className="card" style={{ padding: '4px 0', marginBottom: '1.5rem' }}>
                {allCatKeys.map((k, i) => {
                    const catInfo = allCats[k] || { label: k, color: '#888' };
                    const tope = form.categories[k] || 0;
                    const actual = catActual[k] || 0;
                    const over = tope > 0 && actual > tope;
                    return (
                        <div key={k} className="budget-row">
                            <div className="budget-row-header">
                                <span className="budget-cat-dot" style={{ background: catInfo.color }} />
                                <span className="budget-cat-label">{catInfo.label}</span>
                                {editing ? (
                                    <input type="number" value={form.categories[k] || ''} placeholder="Sin tope"
                                        onChange={e => setForm(f => ({ ...f, categories: { ...f.categories, [k]: Number(e.target.value) || 0 } }))}
                                        className="input" style={{ width: 110, textAlign: 'right', fontSize: 13 }} />
                                ) : (
                                    <div style={{ textAlign: 'right' }}>
                                        <div className={`budget-amount${over ? ' budget-over' : ''}`}>{CLP(actual)}</div>
                                        {tope > 0 && <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>tope {CLP(tope)}</div>}
                                        {tope === 0 && !editing && <button onClick={() => setEditing(true)} style={{ fontSize: 10, color: 'var(--primary)', fontStyle: 'normal', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>+ tope</button>}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                {!editing && (
                    <div style={{ padding: '13px 16px', borderTop: '2px solid var(--border-medium)', display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Total presupuestado</span>
                        <span>{CLP(budgetTotal)}</span>
                    </div>
                )}
            </div>

            {/* Distribution summary */}
            {!editing && form.income > 0 && (
                <div>
                    <Section mt="0">Distribución del ingreso</Section>
                    <div className="card" style={{ marginBottom: '2rem' }}>
                        {[
                            ['Meta de ahorro', form.savingsGoal, 'var(--success)'],
                            ['Presupuesto categorías', budgetTotal, 'var(--primary)'],
                            ['Margen libre', Math.max(0, remainingForCats), remainingForCats >= 0 ? 'var(--text-tertiary)' : 'var(--danger)'],
                        ].map(([l, v, c]) => (
                            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{l}</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: String(c) }}>{CLP(v)}</span>
                            </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 13, fontWeight: 700 }}>
                            <span>Ingreso total</span>
                            <span style={{ color: 'var(--primary)' }}>{CLP(form.income)}</span>
                        </div>
                    </div>
                </div>
            )}

            {editing && (
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={handleSave} className="btn btn-primary" style={{ flex: 1 }}>Guardar presupuesto</button>
                    <button onClick={() => { setForm({ income: budget.income || defaultIncome || 0, savingsGoal: budget.savingsGoal || 0, categories: { ...DEF_BUDGET.categories, ...budget.categories } }); setEditing(false); }} className="btn btn-ghost">Cancelar</button>
                </div>
            )}
        </div>
    );
}
