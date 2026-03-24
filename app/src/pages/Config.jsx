import { useState } from 'react';
import { Plus, Trash2, Edit2, X } from 'lucide-react';
import Section from '../components/ui/Section';
import Modal from '../components/ui/Modal';
import { CAT, CAT_PALETTE } from '../lib/constants';
import { hexBg } from '../utils/formatters';

const ACCOUNT_TYPE_LABEL = { tc: 'Tarjeta crédito', cc: 'Cuenta corriente', savings: 'Ahorro', cash: 'Efectivo' };
const ACCOUNT_BANKS = ['santander', 'bci', 'chile', 'scotiabank', 'otro'];

function ColorPicker({ value, onChange }) {
    return (
        <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {CAT_PALETTE.map(c => (
                    <button key={c} onClick={() => onChange(c)} style={{
                        width: 28, height: 28, borderRadius: '50%', background: c, border: value === c ? '3px solid var(--text-primary)' : '2px solid transparent',
                        cursor: 'pointer', outline: 'none', flexShrink: 0,
                    }} />
                ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: value, border: !CAT_PALETTE.includes(value) ? '3px solid var(--text-primary)' : '2px solid var(--border-medium)', display: 'inline-block', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                    <input type="color" value={value} onChange={e => onChange(e.target.value)}
                        style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none' }} />
                </span>
                Color personalizado
            </label>
        </div>
    );
}

export default function ConfigPage({ customCats, catRules, accounts, onSaveCat, onDeleteCat, onSaveAccount }) {
    const [mode, setMode] = useState('list'); // 'list' | 'create' | 'edit'
    const [editId, setEditId] = useState(null);
    const [label, setLabel] = useState('');
    const [color, setColor] = useState(CAT_PALETTE[0]);
    const [delId, setDelId] = useState(null);
    // Accounts form
    const [showNewAcc, setShowNewAcc] = useState(false);
    const [newAccName, setNewAccName] = useState('');
    const [newAccBank, setNewAccBank] = useState('santander');
    const [newAccType, setNewAccType] = useState('tc');
    const [savingAcc, setSavingAcc] = useState(false);

    const handleCreateAccount = async () => {
        if (!newAccName.trim()) return;
        setSavingAcc(true);
        try {
            await onSaveAccount({
                name: newAccName.trim(),
                bank: newAccBank,
                type: newAccType,
                color: newAccType === 'cc' ? '#0891B2' : '#E11D48',
                icon: newAccType === 'cc' ? 'bank' : 'card',
            });
            setShowNewAcc(false);
            setNewAccName('');
        } finally {
            setSavingAcc(false);
        }
    };

    const resetForm = () => { setLabel(''); setColor(CAT_PALETTE[0]); setEditId(null); };

    const startCreate = () => { resetForm(); setMode('create'); };
    const startEdit = (id) => {
        const cat = customCats[id];
        if (!cat) return;
        setEditId(id);
        setLabel(cat.label);
        setColor(cat.color);
        setMode('edit');
    };

    const handleSave = async () => {
        if (!label.trim()) return;
        const id = editId || label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '');
        await onSaveCat(id, { label: label.trim(), color, bg: hexBg(color) });
        resetForm();
        setMode('list');
    };

    const customEntries = Object.entries(customCats);
    const ruleEntries = Object.entries(catRules).slice(0, 20);

    if (mode === 'create' || mode === 'edit') {
        return (
            <div className="animate-fadeIn">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem' }}>
                    <button onClick={() => setMode('list')} className="btn-icon"><X size={16} /></button>
                    <div className="page-title">{mode === 'create' ? 'Nueva categoría' : 'Editar categoría'}</div>
                </div>

                <div className="card" style={{ marginBottom: '1.25rem' }}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>Nombre</label>
                        <input autoFocus value={label} onChange={e => setLabel(e.target.value)}
                            placeholder="Ej: Gimnasio, Farmacia…"
                            className="input" />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>Color</label>
                        <ColorPicker value={color} onChange={setColor} />
                    </div>

                    {label.trim() && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>Vista previa:</div>
                            <span className="tag" style={{ background: hexBg(color), color }}>{label.trim()}</span>
                        </div>
                    )}

                    <button onClick={handleSave} disabled={!label.trim()} className="btn btn-primary" style={{ width: '100%' }}>
                        {mode === 'create' ? 'Crear categoría' : 'Guardar cambios'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <div className="page-title">Configuración</div>
                    <div className="page-subtitle">Categorías y reglas de clasificación</div>
                </div>
            </div>

            {/* Accounts section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div className="section-label" style={{ marginTop: 0 }}>
                    Mis cuentas
                    <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 'var(--radius-full)', padding: '1px 7px', fontSize: 10, marginLeft: 6 }}>
                        {accounts.length}
                    </span>
                </div>
                <button onClick={() => setShowNewAcc(v => !v)} className="btn btn-primary btn-sm">
                    {showNewAcc ? 'Cancelar' : '+ Nueva'}
                </button>
            </div>

            {showNewAcc && (
                <div className="card" style={{ marginBottom: '1rem', padding: '14px 16px', border: '1px solid var(--primary-light)' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <input value={newAccName} onChange={e => setNewAccName(e.target.value)}
                            placeholder="Nombre (ej: Santander TC)" className="input" style={{ flex: 2, minWidth: 130 }} />
                        <select value={newAccBank} onChange={e => setNewAccBank(e.target.value)} className="input" style={{ flex: 1, minWidth: 110 }}>
                            {ACCOUNT_BANKS.map(b => <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
                        </select>
                        <select value={newAccType} onChange={e => setNewAccType(e.target.value)} className="input" style={{ flex: 1, minWidth: 90 }}>
                            <option value="tc">TC</option>
                            <option value="cc">CC</option>
                        </select>
                        <button onClick={handleCreateAccount} disabled={!newAccName.trim() || savingAcc} className="btn btn-primary">
                            {savingAcc ? '…' : 'Crear'}
                        </button>
                    </div>
                </div>
            )}

            {accounts.length > 0 && (
                <div className="card" style={{ padding: '4px 0', marginBottom: '1.75rem' }}>
                    {accounts.map((a, i) => (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < accounts.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: a.color || '#888', display: 'inline-block', flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{a.name}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, background: a.type === 'cc' ? '#ECFEFF' : '#FFF1F2', color: a.type === 'cc' ? '#0891B2' : '#E11D48', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                                {ACCOUNT_TYPE_LABEL[a.type] || a.type}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Default cats */}
            <Section mt="0">Categorías predeterminadas</Section>
            <div className="card" style={{ padding: '4px 0', marginBottom: '1.5rem' }}>
                {Object.entries(CAT).map(([k, v], i, arr) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{v.label}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, background: v.bg, color: v.color, padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>predeterminada</span>
                    </div>
                ))}
            </div>

            {/* Custom cats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div className="section-label" style={{ marginTop: 0 }}>
                    Categorías personalizadas
                    {customEntries.length > 0 && (
                        <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 'var(--radius-full)', padding: '1px 7px', fontSize: 10, marginLeft: 6 }}>
                            {customEntries.length}
                        </span>
                    )}
                </div>
                <button onClick={startCreate} className="btn btn-primary btn-sm">+ Nueva</button>
            </div>

            {customEntries.length === 0 ? (
                <div className="card" style={{ padding: '28px 20px', textAlign: 'center', marginBottom: '1.75rem' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🏷️</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Sin categorías personalizadas</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16, lineHeight: 1.5 }}>
                        Crea categorías propias para gastos que no encajan en las predeterminadas
                    </div>
                    <button onClick={startCreate} className="btn btn-primary">+ Nueva categoría</button>
                </div>
            ) : (
                <div className="card" style={{ padding: '4px 0', marginBottom: '1.75rem' }}>
                    {customEntries.map(([k, v], i) => (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < customEntries.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: v.color, display: 'inline-block', flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{v.label}</span>
                            <button onClick={() => startEdit(k)} className="btn-icon btn-sm" title="Editar"><Edit2 size={12} /></button>
                            <button onClick={() => setDelId(k)} className="btn-icon btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }} title="Eliminar"><Trash2 size={12} /></button>
                        </div>
                    ))}
                </div>
            )}

            {/* Rules */}
            {ruleEntries.length > 0 && (
                <>
                    <Section mt="0">Reglas aprendidas</Section>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10, marginTop: -6 }}>
                        Cuando recategorizas una transacción en Historial, la regla se guarda aquí.
                    </div>
                    <div className="card" style={{ padding: '4px 0', marginBottom: '2rem' }}>
                        {ruleEntries.map(([desc, cat], i) => {
                            const catObj = { label: cat, color: '#888', bg: '#F3F4F6', ...(CAT[cat] || {}) };
                            return (
                                <div key={desc} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', borderBottom: i < ruleEntries.length - 1 ? '1px solid var(--border-light)' : 'none', flexWrap: 'wrap' }}>
                                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</span>
                                    <span className="tag" style={{ background: catObj.bg, color: catObj.color }}>→ {catObj.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {delId && (
                <Modal
                    title="Eliminar categoría"
                    desc={`¿Eliminar "${customCats[delId]?.label}"? Las transacciones mantendrán su etiqueta.`}
                    confirmLabel="Eliminar"
                    onConfirm={async () => { await onDeleteCat(delId); setDelId(null); }}
                    onCancel={() => setDelId(null)}
                />
            )}
        </div>
    );
}
