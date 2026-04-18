import { useState } from 'react';
import { Plus, Trash2, Calendar } from 'lucide-react';
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
                            border: 'none', cursor: 'pointer',
                        }}>
                        {y}
                    </button>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {MONTHS_ABBR.map((m, i) => (
                    <button key={i} onClick={() => onChange({ year, month: i })}
                        className={`month-cell${mon === i && (value?.year ?? year) === year ? ' selected' : ''}`}
                        style={{
                            background: mon === i && (value?.year ?? year) === year ? undefined : 'var(--bg-hover)',
                            color: mon === i && (value?.year ?? year) === year ? undefined : 'var(--text-secondary)',
                            border: '1.5px solid transparent', borderRadius: 'var(--radius-sm)',
                            padding: '10px 4px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        }}>
                        {m}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function ManualAdjustmentsPage({
    fixedByMonth, extraByMonth, allCats, incomeCategories = [],
    onSaveFixed, onSaveExtra,
}) {
    const [selPeriodo, setSelPeriodo] = useState(null);
    const [showPicker, setShowPicker] = useState(false);
    const [tempSel, setTempSel] = useState(null);
    const [delFixedId, setDelFixedId] = useState(null);

    // Ingresos extra
    const [extraItems, setExtraItems] = useState([]);
    const [newExtra, setNewExtra] = useState({ name: '', amount: '' });

    // Gastos no bancarios
    const [fixedItems, setFixedItems] = useState([]);
    const [newFixed, setNewFixed] = useState({ name: '', amount: '', source: 'fijo', recurring: false });

    const confirmPick = () => {
        if (!tempSel) return;
        const label = `${MONTH_NAMES[tempSel.month]} ${tempSel.year}`;
        setSelPeriodo(label);
        setFixedItems(fixedByMonth[label] || []);
        setExtraItems(extraByMonth[label] || []);
        setShowPicker(false);
        setTempSel(null);
    };

    const addExtra = () => {
        if (!newExtra.name.trim() || !newExtra.amount) return;
        setExtraItems(prev => [...prev, { id: Date.now(), name: newExtra.name.trim(), amount: Number(newExtra.amount) }]);
        setNewExtra({ name: '', amount: '' });
    };

    const addFixed = () => {
        if (!newFixed.name.trim() || !newFixed.amount) return;
        const item = { id: Date.now(), name: newFixed.name.trim(), amount: Number(newFixed.amount), source: newFixed.source, recurring: newFixed.recurring };
        setFixedItems(prev => [...prev, item]);
        setNewFixed({ name: '', amount: '', source: 'fijo', recurring: false });
    };

    const fixedTotal = fixedItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const extraTotal = extraItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <div className="page-title">Registros manuales</div>
                    <div className="page-subtitle">Ingresos extra y gastos no bancarios por mes</div>
                </div>
            </div>

            {/* Period picker */}
            <div className="card card-hover" onClick={() => setShowPicker(true)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '1.5rem' }}>
                <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 3 }}>Período seleccionado</div>
                    <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.3px' }}>{selPeriodo || 'Elegir mes…'}</div>
                </div>
                <Calendar size={20} color="var(--text-tertiary)" />
            </div>

            {showPicker && (
                <div className="modal-backdrop" onClick={() => setShowPicker(false)}>
                    <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-title">Seleccionar período</div>
                        <div style={{ marginBottom: 20, marginTop: 4 }}>
                            <MonthGrid value={tempSel} onChange={setTempSel} />
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
                    <Calendar size={36} color="var(--text-tertiary)" />
                    <div className="empty-state-title">Selecciona un mes para comenzar</div>
                    <div className="empty-state-desc">Registra ingresos extra y gastos no bancarios de cada mes.</div>
                </div>
            ) : (
                <>
                    {/* ── Ingresos extra ────────────────────────── */}
                    <Section mt="0">Ingresos extra — {selPeriodo}</Section>
                    <div className="card" style={{ padding: '4px 0', marginBottom: '0.75rem' }}>
                        {extraItems.length === 0 && (
                            <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-tertiary)' }}>
                                Sin ingresos extra registrados
                            </div>
                        )}
                        {extraItems.map((e) => {
                            const cat = incomeCategories.find(c => c.id === e.categoria_ingreso);
                            return (
                                <div key={e.id} className="list-row list-row-hover">
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 13, fontWeight: 500 }}>{e.name}</span>
                                        {cat && <Tag label={cat.nombre} color={cat.color || 'var(--ink-3)'} bg={`${cat.color || 'var(--ink-3)'}18`} />}
                                        {!cat && e.categoria_ingreso && e.categoria_ingreso !== 'otros' && (
                                            <Tag label={e.categoria_ingreso} color="var(--ink-3)" bg="var(--rule)" />
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>+{CLP(e.amount)}</span>
                                        <button
                                            onClick={() => setExtraItems(prev => prev.filter(x => x.id !== e.id))}
                                            className="btn-icon btn-sm"
                                            style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                                            aria-label="Eliminar ingreso">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Add row */}
                        <div className="list-row">
                            <input
                                placeholder="Descripción (bono, freelance…)"
                                value={newExtra.name}
                                onChange={e => setNewExtra(p => ({ ...p, name: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && addExtra()}
                                className="input"
                                style={{ flex: 1, marginRight: 8 }}
                            />
                            <input
                                type="number"
                                placeholder="Monto"
                                value={newExtra.amount}
                                onChange={e => setNewExtra(p => ({ ...p, amount: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && addExtra()}
                                className="input"
                                style={{ width: 100 }}
                            />
                            <button onClick={addExtra} className="btn btn-success btn-sm" style={{ marginLeft: 8 }} aria-label="Agregar ingreso">
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>

                    {extraItems.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                            Total extra: <span style={{ color: 'var(--success)' }}>{CLP(extraTotal)}</span>
                        </div>
                    )}
                    <button onClick={() => onSaveExtra(selPeriodo, extraItems)} className="btn btn-ghost" style={{ width: '100%', marginBottom: '1.75rem' }}>
                        Guardar ingresos extra
                    </button>

                    {/* ── Gastos no bancarios ────────────────────── */}
                    <Section mt="0">Gastos no bancarios — {selPeriodo}</Section>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>
                        Arriendo en efectivo, suscripciones externas y otros gastos fuera de TC/CC
                    </div>
                    <div className="card" style={{ padding: '4px 0', marginBottom: '0.75rem' }}>
                        {fixedItems.length === 0 && (
                            <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-tertiary)' }}>
                                Sin gastos no bancarios registrados
                            </div>
                        )}
                        {fixedItems.map((f) => {
                            const src = SOURCE_OPTS.find(s => s.id === (f.source || 'fijo')) || SOURCE_OPTS[0];
                            return (
                                <div key={f.id} className="list-row list-row-hover">
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 13, fontWeight: 500 }}>{f.name}</span>
                                        <Tag label={src.label} color={src.color} bg={src.bg} />
                                        {f.recurring && <Tag label="Recurrente" color="var(--ink-3)" bg="var(--rule)" />}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>{CLP(f.amount)}</span>
                                        <button
                                            onClick={() => setDelFixedId(f.id)}
                                            className="btn-icon btn-sm"
                                            style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                                            aria-label="Eliminar gasto">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Add row */}
                        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <input
                                placeholder="Nombre del gasto"
                                value={newFixed.name}
                                onChange={e => setNewFixed(p => ({ ...p, name: e.target.value }))}
                                className="input"
                            />
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    type="number"
                                    placeholder="Monto"
                                    value={newFixed.amount}
                                    onChange={e => setNewFixed(p => ({ ...p, amount: e.target.value }))}
                                    className="input"
                                    style={{ flex: 1 }}
                                />
                                <select
                                    value={newFixed.source}
                                    onChange={e => setNewFixed(p => ({ ...p, source: e.target.value }))}
                                    className="input"
                                    style={{ flex: 1 }}>
                                    {SOURCE_OPTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                </select>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={newFixed.recurring}
                                    onChange={e => setNewFixed(p => ({ ...p, recurring: e.target.checked }))}
                                />
                                Marcar como recurrente (se copiará a meses futuros)
                            </label>
                            <button onClick={addFixed} className="btn btn-primary">
                                <Plus size={16} /> Agregar gasto
                            </button>
                        </div>
                    </div>

                    {fixedItems.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, gap: 8, fontSize: 13, fontWeight: 600, alignItems: 'center' }}>
                            Total gastos: <span>{CLP(fixedTotal)}</span>
                        </div>
                    )}
                    <button onClick={() => onSaveFixed(selPeriodo, fixedItems)} className="btn btn-primary" style={{ width: '100%', marginBottom: '1rem' }}>
                        Guardar gastos no bancarios
                    </button>

                    {/* ── Resumen ajustes ───────────────────────── */}
                    {(extraTotal > 0 || fixedTotal > 0) && (
                        <div className="card" style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 2 }}>
                                Resumen del mes
                            </div>
                            {[
                                ['Ingresos extra', `+${CLP(extraTotal)}`, 'var(--success)'],
                                ['Gastos no bancarios', CLP(fixedTotal), 'var(--warning)'],
                                ['Balance neto', CLP(extraTotal - fixedTotal), extraTotal - fixedTotal >= 0 ? 'var(--success)' : 'var(--danger)'],
                            ].map(([l, v, c]) => (
                                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{l}</span>
                                    <span style={{ fontWeight: 700, color: c }}>{v}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {delFixedId && (
                <Modal title="Eliminar gasto" desc="¿Seguro que quieres eliminar este gasto?" confirmLabel="Eliminar"
                    onConfirm={() => { setFixedItems(prev => prev.filter(x => x.id !== delFixedId)); setDelFixedId(null); }}
                    onCancel={() => setDelFixedId(null)} />
            )}
        </div>
    );
}
