import { useState } from 'react';
import { Plus, Trash2, Edit2, X, Pencil } from 'lucide-react';
import Section from '../components/ui/Section';
import Modal from '../components/ui/Modal';
import Tag from '../components/ui/Tag';
import { CAT, CAT_PALETTE, INCOME_CATS_BUILTIN, INCOME_CAT_COLORS } from '../lib/constants';
import { hexBg } from '../utils/formatters';

const ACCOUNT_TYPE_COLOR = { tc: '#C43A2F', cc: '#8A8B3A' };

const ACCOUNT_TYPE_LABEL = { tc: 'Tarjeta crédito', cc: 'Cuenta corriente', lc: 'Línea de crédito', credit_line: 'Línea de crédito', savings: 'Ahorro', cash: 'Efectivo' };
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

export default function ConfigPage({ customCats, catRules, accounts, incomeCategories, onSaveCat, onDeleteCat, onSaveAccount, onUpdateAccount, onSaveIncomeCategory, onDeleteIncomeCategory, onDeleteCatRule }) {
    const [mode, setMode] = useState('list'); // 'list' | 'create' | 'edit'
    const [editId, setEditId] = useState(null);
    const [label, setLabel] = useState('');
    const [color, setColor] = useState(CAT_PALETTE[0]);
    const [delId, setDelId] = useState(null);
    // Rules
    const [ruleSearch, setRuleSearch] = useState('');
    const [delRuleKey, setDelRuleKey] = useState(null);
    const [rulesCollapsed, setRulesCollapsed] = useState(true);
    // Income categories form
    const [showNewIncomeCat, setShowNewIncomeCat] = useState(false);
    const [newIncCatName, setNewIncCatName] = useState('');
    const [newIncCatColorIdx, setNewIncCatColorIdx] = useState(0);
    const [savingIncCat, setSavingIncCat] = useState(false);
    const [delIncCatId, setDelIncCatId] = useState(null);

    const handleCreateIncomeCat = async () => {
        if (!newIncCatName.trim()) return;
        setSavingIncCat(true);
        try {
            await onSaveIncomeCategory({ nombre: newIncCatName.trim(), color: INCOME_CAT_COLORS[newIncCatColorIdx] });
            setNewIncCatName('');
            setShowNewIncomeCat(false);
        } finally { setSavingIncCat(false); }
    };

    // Edit account
    const [editingAccount, setEditingAccount] = useState(null);
    const [editAccName, setEditAccName] = useState('');
    const [editAccColor, setEditAccColor] = useState('#888');
    const [editAccType, setEditAccType] = useState('tc');
    const [editAccBank, setEditAccBank] = useState('otro');
    const [savingEditAcc, setSavingEditAcc] = useState(false);

    const handleSaveEditAccount = async () => {
        if (!editAccName.trim() || !editingAccount) return;
        const duplicate = accounts.some(
            a => a.id !== editingAccount.id &&
            a.name.toLowerCase() === editAccName.trim().toLowerCase()
        );
        if (duplicate) return;
        setSavingEditAcc(true);
        try {
            await onUpdateAccount(editingAccount.id, {
                name: editAccName.trim(),
                color: editAccColor,
                type: editAccType,
                bank: editAccBank,
                icon: editAccType === 'cc' ? 'bank' : 'card',
            });
            setEditingAccount(null);
        } finally {
            setSavingEditAcc(false);
        }
    };

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
                color: ACCOUNT_TYPE_COLOR[newAccType] || '#54514A',
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
    const allRuleEntries = Object.entries(catRules);
    const ruleEntries = ruleSearch.trim()
        ? allRuleEntries.filter(([k]) => k.includes(ruleSearch.toLowerCase().trim()))
        : allRuleEntries;

    if (mode === 'create' || mode === 'edit') {
        return (
            <div className="animate-fadeIn">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem' }}>
                    <button onClick={() => setMode('list')} className="btn-icon"><X size={16} /></button>
                    <div className="page-title">{mode === 'create' ? 'Nueva categoría' : 'Editar categoría'}</div>
                </div>

                <div className="list-section" style={{ marginBottom: '1.25rem', padding: '16px' }}>
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
                    <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 'var(--radius-sm)', padding: '1px 7px', fontSize: 10, marginLeft: 6 }}>
                        {accounts.length}
                    </span>
                </div>
                <button onClick={() => setShowNewAcc(v => !v)} className="btn btn-primary btn-sm">
                    {showNewAcc ? 'Cancelar' : '+ Nueva'}
                </button>
            </div>

            {showNewAcc && (
                <div className="list-section" style={{ marginBottom: '1rem', padding: '14px 16px', border: '1px solid var(--primary-light)' }}>
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
                <div className="list-section" style={{ marginBottom: '1.75rem' }}>
                    {accounts.map((a, i) => (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < accounts.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color || '#888', display: 'inline-block', flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{a.name}</span>
                            <button
                                onClick={() => {
                                    setEditingAccount(a);
                                    setEditAccName(a.name);
                                    setEditAccColor(a.color || '#888');
                                    setEditAccType(a.type || 'tc');
                                    setEditAccBank(a.bank || 'otro');
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, margin: -4, borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', transition: 'color 0.15s, background 0.15s', flexShrink: 0 }}
                                title="Editar cuenta"
                                aria-label={`Editar cuenta ${a.name}`}
                            >
                                <Pencil size={13} />
                            </button>
                            <Tag variant={a.type === 'cc' ? 'olive' : (a.type === 'lc' || a.type === 'credit_line') ? 'amber' : 'red'} label={ACCOUNT_TYPE_LABEL[a.type] || a.type} />
                        </div>
                    ))}
                </div>
            )}

            {/* Income categories */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div className="section-label" style={{ marginTop: 0 }}>
                    Categorías de ingresos
                    {(incomeCategories || []).length > 0 && (
                        <span style={{ background: 'var(--success-light, #ECFDF5)', color: 'var(--success, #059669)', borderRadius: 'var(--radius-sm)', padding: '1px 7px', fontSize: 10, marginLeft: 6 }}>
                            {(incomeCategories || []).length}
                        </span>
                    )}
                </div>
                <button onClick={() => setShowNewIncomeCat(v => !v)} className="btn btn-primary btn-sm">
                    {showNewIncomeCat ? 'Cancelar' : '+ Nueva'}
                </button>
            </div>

            {/* Built-in income cats */}
            <div className="list-section" style={{ marginBottom: (incomeCategories || []).length > 0 || showNewIncomeCat ? '0.5rem' : '1.75rem' }}>
                {INCOME_CATS_BUILTIN.map((cat, i) => (
                    <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < INCOME_CATS_BUILTIN.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{cat.nombre}</span>
                        <span className="tag">predeterminada</span>
                    </div>
                ))}
            </div>

            {/* Custom income cats */}
            {(incomeCategories || []).length > 0 && (
                <div className="list-section" style={{ marginBottom: showNewIncomeCat ? '0.5rem' : '1.75rem' }}>
                    {incomeCategories.map((cat, i) => (
                        <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < incomeCategories.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, display: 'inline-block', flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{cat.nombre}</span>
                            {onDeleteIncomeCategory && (
                                <button onClick={() => setDelIncCatId(cat.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showNewIncomeCat && (
                <div className="list-section" style={{ marginBottom: '1.75rem', padding: '12px 14px', border: '1px solid var(--olive-border, var(--olive))' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                            value={newIncCatName}
                            onChange={e => setNewIncCatName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateIncomeCat()}
                            placeholder="Nombre (ej: Arriendo recibido)"
                            className="input" style={{ flex: 1 }}
                            autoFocus
                        />
                        <button
                            onClick={() => setNewIncCatColorIdx(i => (i + 1) % INCOME_CAT_COLORS.length)}
                            style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--border)', background: INCOME_CAT_COLORS[newIncCatColorIdx], cursor: 'pointer', flexShrink: 0 }}
                            title="Cambiar color"
                        />
                        <button onClick={handleCreateIncomeCat} disabled={savingIncCat || !newIncCatName.trim()} className="btn btn-primary">
                            {savingIncCat ? '…' : 'Crear'}
                        </button>
                    </div>
                </div>
            )}

            {delIncCatId && (
                <Modal
                    title="Eliminar categoría"
                    desc={`¿Eliminar categoría de ingreso? Los ingresos ya guardados mantendrán su etiqueta.`}
                    confirmLabel="Eliminar"
                    confirmClass="btn btn-danger"
                    onConfirm={async () => { await onDeleteIncomeCategory(delIncCatId); setDelIncCatId(null); }}
                    onCancel={() => setDelIncCatId(null)}
                />
            )}

            {/* Default cats */}
            <Section mt="0">Categorías predeterminadas</Section>
            <div className="list-section" style={{ marginBottom: '1.5rem' }}>
                {Object.entries(CAT).map(([k, v], i, arr) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{v.label}</span>
                        <span className="tag">predeterminada</span>
                    </div>
                ))}
            </div>

            {/* Custom cats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div className="section-label" style={{ marginTop: 0 }}>
                    Categorías personalizadas
                    {customEntries.length > 0 && (
                        <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 'var(--radius-sm)', padding: '1px 7px', fontSize: 10, marginLeft: 6 }}>
                            {customEntries.length}
                        </span>
                    )}
                </div>
                <button onClick={startCreate} className="btn btn-primary btn-sm">+ Nueva</button>
            </div>

            {customEntries.length === 0 ? (
                <div className="list-section" style={{ padding: '28px 20px', textAlign: 'center', marginBottom: '1.75rem' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🏷️</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Sin categorías personalizadas</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16, lineHeight: 1.5 }}>
                        Crea categorías propias para gastos que no encajan en las predeterminadas
                    </div>
                    <button onClick={startCreate} className="btn btn-primary">+ Nueva categoría</button>
                </div>
            ) : (
                <div className="list-section" style={{ marginBottom: '1.75rem' }}>
                    {customEntries.map(([k, v], i) => (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < customEntries.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, display: 'inline-block', flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{v.label}</span>
                            <button onClick={() => startEdit(k)} className="btn-icon btn-sm" title="Editar"><Edit2 size={12} /></button>
                            <button onClick={() => setDelId(k)} className="btn-icon btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }} title="Eliminar"><Trash2 size={12} /></button>
                        </div>
                    ))}
                </div>
            )}

            {/* Rules */}
            {allRuleEntries.length > 0 && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div className="section-label" style={{ marginTop: 0 }}>
                            Reglas aprendidas
                            <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 'var(--radius-sm)', padding: '1px 7px', fontSize: 10, marginLeft: 6 }}>
                                {allRuleEntries.length}
                            </span>
                        </div>
                        <button onClick={() => setRulesCollapsed(v => !v)} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
                            {rulesCollapsed ? 'Expandir' : 'Colapsar'}
                        </button>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8, marginTop: -2 }}>
                        Reglas guardadas al recategorizar en Historial.
                    </div>
                    {!rulesCollapsed && (
                        <>
                            <div style={{ marginBottom: 8 }}>
                                <input
                                    value={ruleSearch}
                                    onChange={e => setRuleSearch(e.target.value)}
                                    placeholder="Buscar regla…"
                                    className="input"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div className="list-section" style={{ marginBottom: '2rem' }}>
                                {ruleEntries.length === 0 ? (
                                    <div style={{ padding: '16px', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                                        Sin resultados para "{ruleSearch}"
                                    </div>
                                ) : ruleEntries.map(([desc, cat], i) => {
                                    const catObj = { label: cat, color: '#888', bg: '#F3F4F6', ...(CAT[cat] || {}) };
                                    return (
                                        <div key={desc} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: i < ruleEntries.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                                            <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</span>
                                            <span className="tag" style={{ background: catObj.bg, color: catObj.color, flexShrink: 0 }}>→ {catObj.label}</span>
                                            <button onClick={() => setDelRuleKey(desc)} className="btn-icon btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)', flexShrink: 0 }} title="Eliminar regla"><Trash2 size={12} /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                    {rulesCollapsed && <div style={{ marginBottom: '2rem' }} />}
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
            {delRuleKey && (
                <Modal
                    title="Eliminar regla"
                    desc={`¿Eliminar la regla para "${delRuleKey}"? Las transacciones existentes no cambiarán.`}
                    confirmLabel="Eliminar"
                    onConfirm={async () => { await onDeleteCatRule?.(delRuleKey); setDelRuleKey(null); }}
                    onCancel={() => setDelRuleKey(null)}
                />
            )}

            {editingAccount && (
                <Modal
                    title="Editar cuenta"
                    confirmLabel={savingEditAcc ? 'Guardando…' : 'Guardar'}
                    confirmClass="btn-primary"
                    onConfirm={handleSaveEditAccount}
                    onCancel={() => setEditingAccount(null)}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                                Nombre de la cuenta
                            </label>
                            <input
                                value={editAccName}
                                onChange={e => setEditAccName(e.target.value)}
                                placeholder="ej: Mi Visa, Cuenta principal…"
                                maxLength={40}
                                autoFocus
                                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                            />
                            {accounts.some(a => a.id !== editingAccount.id && a.name.toLowerCase() === editAccName.trim().toLowerCase()) && (
                                <span style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4, display: 'block' }}>
                                    Ya tienes una cuenta con ese nombre
                                </span>
                            )}
                        </div>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                                Tipo
                            </label>
                            <select
                                value={editAccType}
                                onChange={e => setEditAccType(e.target.value)}
                                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14 }}
                            >
                                {Object.entries(ACCOUNT_TYPE_LABEL).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                                Banco
                            </label>
                            <select
                                value={editAccBank}
                                onChange={e => setEditAccBank(e.target.value)}
                                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-medium)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14 }}
                            >
                                {ACCOUNT_BANKS.map(b => (
                                    <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                                Color
                            </label>
                            <ColorPicker value={editAccColor} onChange={setEditAccColor} />
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
