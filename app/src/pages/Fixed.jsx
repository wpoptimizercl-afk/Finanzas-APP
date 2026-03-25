import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Section from '../components/ui/Section';
import Tag from '../components/ui/Tag';
import Modal from '../components/ui/Modal';
import { CLP } from '../utils/formatters';
import { MONTH_NAMES, SOURCE_OPTS } from '../lib/constants';

const MONTHS_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const YEARS = [2024, 2025, 2026, 2027];

function MonthGrid({ value, onChange }) {
    const [year, setYear] = useState(value?.year || new Date().getFullYear());
    const mon = value?.month ?? -1;
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
                {YEARS.map(y => (
                    <button key={y} onClick={() => setYear(y)}
                        style={{
                            padding: '5px 12px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600,
                            background: y === year ? 'var(--primary)' : 'var(--bg-hover)',
                            color: y === year ? '#fff' : 'var(--text-secondary)',
                            border: 'none', cursor: 'pointer'
                        }}>
                        {y}
                    </button>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {MONTHS_ABBR.map((m, i) => (
                    <button key={i} onClick={() => onChange({ year, month: i })}
                        className={`month-cell${mon === i && (value?.year ?? year) === year ? ' selected' : ''}`}
                        style={{ background: mon === i && (value?.year ?? year) === year ? undefined : 'var(--bg-hover)', color: mon === i && (value?.year ?? year) === year ? undefined : 'var(--text-secondary)', border: '1.5px solid transparent', borderRadius: 'var(--radius-sm)', padding: '10px 4px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                        {m}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function FixedPage({ fixedByMonth, incomeByMonth, extraByMonth, defaultIncome, onSaveFixed, onSaveIncome, onSaveExtra, allCats, incomeCategories = [] }) {
    const [selPeriodo, setSelPeriodo] = useState(null);
    const [delId, setDelId] = useState(null);
    const [showPicker, setShowPicker] = useState(false);
    const [tempSel, setTempSel] = useState(null);

    // income / extra
    const [incomeVal, setIncomeVal] = useState('');
    const [extraItems, setExtraItems] = useState([]);
    const [newExtra, setNewExtra] = useState({ name: '', amount: '' });

    // fixed
    const [fixedItems, setFixedItems] = useState([]);
    const [newFixed, setNewFixed] = useState({ name: '', amount: '', source: 'fijo', recurring: false });

    const pickPeriod = (sel) => {
        setTempSel(sel);
    };

    const confirmPick = () => {
        if (!tempSel) return;
        const label = `${MONTH_NAMES[tempSel.month]} ${tempSel.year}`;
        setSelPeriodo(label);
        setFixedItems(fixedByMonth[label] || []);
        setIncomeVal(incomeByMonth[label] != null ? String(incomeByMonth[label]) : '');
        setExtraItems(extraByMonth[label] || []);
        setShowPicker(false);
        setTempSel(null);
    };

    const handleSaveFixed = async () => {
        if (!selPeriodo) return;
        await onSaveFixed(selPeriodo, fixedItems);
    };

    const handleSaveIncome = async () => {
        if (!selPeriodo) return;
        await onSaveIncome(selPeriodo, Number(incomeVal) || 0);
    };

    const handleSaveExtra = async () => {
        if (!selPeriodo) return;
        await onSaveExtra(selPeriodo, extraItems);
    };

    const deleteFixed = (id) => {
        setFixedItems(prev => prev.filter(x => x.id !== id));
    };

    const addFixed = () => {
        if (!newFixed.name.trim() || !newFixed.amount) return;
        const item = { id: Date.now(), name: newFixed.name.trim(), amount: Number(newFixed.amount), source: newFixed.source, recurring: newFixed.recurring };
        setFixedItems(prev => [...prev, item]);
        setNewFixed({ name: '', amount: '', source: 'fijo', recurring: false });
    };

    const addExtra = () => {
        if (!newExtra.name.trim() || !newExtra.amount) return;
        setExtraItems(prev => [...prev, { id: Date.now(), name: newExtra.name.trim(), amount: Number(newExtra.amount) }]);
        setNewExtra({ name: '', amount: '' });
    };

    const fixedTotal = fixedItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const extraTotal = extraItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const income = (Number(incomeVal) || defaultIncome) + extraTotal;

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <div className="page-title">Registro mensual</div>
                    <div className="page-subtitle">Ingreso, extras y gastos fijos por mes</div>
                </div>
            </div>

            {/* Period picker */}
            <div className="card card-hover" onClick={() => setShowPicker(true)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '1.5rem' }}>
                <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 3 }}>Período seleccionado</div>
                    <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.3px' }}>{selPeriodo || 'Elegir mes…'}</div>
                </div>
                <span style={{ fontSize: 18, color: 'var(--text-tertiary)' }}>📆</span>
            </div>

            {showPicker && (
                <div className="modal-backdrop" onClick={() => setShowPicker(false)}>
                    <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-title">Seleccionar período</div>
                        <div style={{ marginBottom: 20, marginTop: 4 }}>
                            <MonthGrid value={tempSel} onChange={pickPeriod} />
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmPick} disabled={!tempSel}>Confirmar</button>
                            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowPicker(false)}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            {!selPeriodo ? (
                <div className="empty-state" style={{ paddingTop: '2rem' }}>
                    <div style={{ fontSize: 36 }}>📆</div>
                    <div className="empty-state-title">Selecciona un mes para comenzar</div>
                    <div className="empty-state-desc">Ingresa el ingreso y gastos fijos de cada mes para cálculos precisos.</div>
                </div>
            ) : (
                <>
                    {/* Income */}
                    <Section mt="0">Ingreso del mes — {selPeriodo}</Section>
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>Sueldo líquido del mes</div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--text-tertiary)' }}>$</span>
                            <input
                                type="number"
                                placeholder={`${defaultIncome || 0} (por defecto)`}
                                value={incomeVal}
                                onChange={e => setIncomeVal(e.target.value)}
                                className="input"
                                style={{ flex: 1 }}
                            />
                        </div>
                        <button onClick={handleSaveIncome} className="btn btn-primary" style={{ marginTop: 14, width: '100%' }}>
                            Guardar ingreso
                        </button>
                    </div>

                    {/* Extra income */}
                    <Section mt="0">Ingresos extra</Section>
                    <div className="card" style={{ padding: '4px 0', marginBottom: '0.75rem' }}>
                        {extraItems.map((e) => {
                            const cat = incomeCategories.find(c => c.id === e.categoria_ingreso);
                            return (
                                <div key={e.id} className="list-row list-row-hover">
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 13, fontWeight: 500 }}>{e.name}</span>
                                        {cat && (
                                            <Tag label={cat.nombre} color={cat.color || '#6366F1'} bg={`${cat.color || '#6366F1'}18`} />
                                        )}
                                        {!cat && e.categoria_ingreso && e.categoria_ingreso !== 'otros' && (
                                            <Tag label={e.categoria_ingreso} color="#6366F1" bg="#EEF2FF" />
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>+{CLP(e.amount)}</span>
                                        <button onClick={() => setExtraItems(prev => prev.filter(x => x.id !== e.id))} className="btn-icon btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}><Trash2 size={12} /></button>
                                    </div>
                                </div>
                            );
                        })}
                        <div className="list-row">
                            <input placeholder="Descripción (bono, freelance…)" value={newExtra.name} onChange={e => setNewExtra(p => ({ ...p, name: e.target.value }))} className="input" style={{ flex: 1, marginRight: 8 }} />
                            <input type="number" placeholder="Monto" value={newExtra.amount} onChange={e => setNewExtra(p => ({ ...p, amount: e.target.value }))} className="input" style={{ width: 100 }} />
                            <button onClick={addExtra} className="btn btn-success btn-sm" style={{ marginLeft: 8 }}><Plus size={14} /></button>
                        </div>
                    </div>
                    {extraItems.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                            Total extra: <span style={{ color: 'var(--success)' }}>{CLP(extraTotal)}</span>
                        </div>
                    )}
                    <button onClick={handleSaveExtra} className="btn btn-ghost" style={{ width: '100%', marginBottom: '1.75rem' }}>
                        Guardar ingresos extra
                    </button>

                    {/* Fixed items */}
                    <Section mt="0">Gastos fijos del mes</Section>
                    <div className="card" style={{ padding: '4px 0', marginBottom: '0.75rem' }}>
                        {fixedItems.map((f) => {
                            const src = SOURCE_OPTS.find(s => s.id === (f.source || 'fijo')) || SOURCE_OPTS[0];
                            return (
                                <div key={f.id} className="list-row list-row-hover">
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 13, fontWeight: 500 }}>{f.name}</span>
                                        <Tag label={src.label} color={src.color} bg={src.bg} />
                                        {f.recurring && <Tag label="Recurrente" color="#6366F1" bg="#EEF2FF" />}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>{CLP(f.amount)}</span>
                                        <button onClick={() => setDelId(f.id)} className="btn-icon btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}><Trash2 size={12} /></button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Add row */}
                        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <input placeholder="Nombre del gasto" value={newFixed.name} onChange={e => setNewFixed(p => ({ ...p, name: e.target.value }))} className="input" />
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input type="number" placeholder="Monto" value={newFixed.amount} onChange={e => setNewFixed(p => ({ ...p, amount: e.target.value }))} className="input" style={{ flex: 1 }} />
                                <select value={newFixed.source} onChange={e => setNewFixed(p => ({ ...p, source: e.target.value }))} className="input" style={{ flex: 1 }}>
                                    {SOURCE_OPTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                </select>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                                <input type="checkbox" checked={newFixed.recurring} onChange={e => setNewFixed(p => ({ ...p, recurring: e.target.checked }))} />
                                Marcar como recurrente (se copiarà a meses futuros)
                            </label>
                            <button onClick={addFixed} className="btn btn-primary"><Plus size={16} /> Agregar gasto fijo</button>
                        </div>
                    </div>

                    {fixedItems.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, gap: 8, fontSize: 13, fontWeight: 600, alignItems: 'center' }}>
                            Total fijos: <span>{CLP(fixedTotal)}</span>
                        </div>
                    )}

                    <button onClick={handleSaveFixed} className="btn btn-primary" style={{ width: '100%', marginBottom: '1rem' }}>
                        Guardar gastos fijos
                    </button>

                    {/* Summary */}
                    <div className="card" style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                            ['Ingreso total', CLP(income), 'var(--primary)'],
                            ['Total fijos', CLP(fixedTotal), 'var(--warning)'],
                            ['Saldo disponible TC', CLP(income - fixedTotal), income - fixedTotal >= 0 ? 'var(--success)' : 'var(--danger)'],
                        ].map(([l, v, c]) => (
                            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{l}</span>
                                <span style={{ fontWeight: 700, color: c }}>{v}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {delId && (
                <Modal title="Eliminar gasto fijo" desc="¿Seguro que quieres eliminar este gasto fijo?" confirmLabel="Eliminar"
                    onConfirm={() => { deleteFixed(delId); setDelId(null); }} onCancel={() => setDelId(null)} />
            )}
        </div>
    );
}
