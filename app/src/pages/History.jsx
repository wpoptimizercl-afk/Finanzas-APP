import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search, Trash2 } from 'lucide-react';
import Section from '../components/ui/Section';
import Modal from '../components/ui/Modal';
import { ClickableTag } from '../components/CategoryPicker';
import { CLP } from '../utils/formatters';

export default function HistoryPage({ sorted, allCats, deleteMonth, recategorizeMonth }) {
    const [selIdx, setSelIdx] = useState(0);
    const [query, setQuery] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [delModal, setDelModal] = useState(false);

    const idx = sorted.length > 0 ? Math.min(selIdx, sorted.length - 1) : 0;
    const month = sorted[idx] || null;

    // Helper to parse DD/MM/YYYY into Date
    const parseTxDate = (dStr) => {
        if (!dStr) return null;
        const [d, m, y] = dStr.split('/').map(Number);
        return new Date(y, m - 1, d);
    };

    // Helper to format DD/MM/YYYY into YYYY-MM-DD for <input type="date">
    const formatInputDate = (dStr) => {
        if (!dStr) return '';
        const parts = dStr.split('/');
        if (parts.length !== 3) return '';
        const [d, m, y] = parts;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    };

    useEffect(() => {
        if (sorted.length > 0 && selIdx >= sorted.length) {
            setSelIdx(sorted.length - 1);
        }
    }, [sorted.length, selIdx]);

    // Reset date filter when changing month
    useEffect(() => {
        setDateRange({ start: '', end: '' });
    }, [selIdx]);

    const isCC = month?.source_type === 'cc';
    const txs = month?.transacciones || [];
    const filtered = useMemo(() => {
        let res = txs;
        if (query.trim()) {
            const q = query.toLowerCase();
            res = res.filter(t => (t.descripcion || '').toLowerCase().includes(q) || (t.categoria || '').toLowerCase().includes(q));
        }
        if (dateRange.start) {
            const s = new Date(dateRange.start + 'T00:00:00');
            res = res.filter(t => parseTxDate(t.fecha) >= s);
        }
        if (dateRange.end) {
            const e = new Date(dateRange.end + 'T23:59:59');
            res = res.filter(t => parseTxDate(t.fecha) <= e);
        }
        return res;
    }, [txs, query, dateRange]);

    const byCategory = useMemo(() => {
        const map = {};
        filtered.filter(t => t.tipo === 'cargo').forEach(t => {
            const k = t.categoria || 'otros';
            (map[k] = map[k] || []).push(t);
        });
        return Object.entries(map).sort((a, b) => b[1].reduce((s, t) => s + t.monto, 0) - a[1].reduce((s, t) => s + t.monto, 0));
    }, [filtered]);

    // CC: abonos separados para mostrarlos en su propia sección
    const abonosCC = useMemo(() =>
        isCC ? filtered.filter(t => t.tipo === 'abono').sort((a, b) => b.monto - a.monto) : []
    , [filtered, isCC]);

    const totalTx = filtered.filter(t => t.tipo === 'cargo').reduce((s, t) => s + t.monto, 0);
    const totalAbonos = abonosCC.reduce((s, t) => s + t.monto, 0);

    if (!sorted.length) return (
        <div className="animate-fadeIn">
            <div className="empty-state">
                <div className="empty-state-icon">📈</div>
                <div className="empty-state-title">Sin historial</div>
                <div className="empty-state-desc">Sube estados de cuenta para ver el historial de tus transacciones.</div>
            </div>
        </div>
    );

    return (
        <>
        <div className="animate-fadeIn">
            {/* Month nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => setSelIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
                        style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: idx === 0 ? 'var(--bg-input)' : 'var(--bg-card)', cursor: idx === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: idx === 0 ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                        <ChevronLeft size={16} />
                    </button>
                    <div style={{ minWidth: 140 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.3px' }}>{month?.periodo}</div>
                            {month && (
                                <span style={{
                                    fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                                    padding: '2px 7px', borderRadius: 'var(--radius-full)',
                                    background: isCC ? 'var(--success-light)' : 'var(--primary-light)',
                                    color: isCC ? 'var(--success)' : 'var(--primary)',
                                    border: `1px solid ${isCC ? 'var(--success-border)' : 'var(--primary-border)'}`,
                                }}>
                                    {isCC ? 'CC' : 'TC'}
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{month?.periodo_desde} — {month?.periodo_hasta}</div>
                    </div>
                    <button onClick={() => setSelIdx(i => Math.min(sorted.length - 1, i + 1))} disabled={idx === sorted.length - 1}
                        style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: idx === sorted.length - 1 ? 'var(--bg-input)' : 'var(--bg-card)', cursor: idx === sorted.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: idx === sorted.length - 1 ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                        <ChevronRight size={16} />
                    </button>
                </div>
                <div style={{ flex: 1 }} />
                <button onClick={() => setDelModal(true)} className="btn-icon btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)', flexShrink: 0 }}>
                    <Trash2 size={15} />
                </button>
            </div>

            {/* Filters bar */}
            <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr auto', gap: 10, marginBottom: '1.25rem' }}>
                <div style={{ position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input
                        placeholder="Buscar transacciones…"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        className="input"
                        style={{ paddingLeft: 34 }}
                    />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                        type="date"
                        value={dateRange.start}
                        min={formatInputDate(month?.periodo_desde)}
                        max={formatInputDate(month?.periodo_hasta)}
                        onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="input"
                        style={{ width: 'auto', fontSize: 12, padding: '8px 10px' }}
                    />
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>a</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        min={formatInputDate(month?.periodo_desde)}
                        max={formatInputDate(month?.periodo_hasta)}
                        onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="input"
                        style={{ width: 'auto', fontSize: 12, padding: '8px 10px' }}
                    />
                    {(dateRange.start || dateRange.end) && (
                        <button 
                            onClick={() => setDateRange({ start: '', end: '' })}
                            className="btn-icon btn-sm"
                            style={{ padding: 6, borderRadius: 'var(--radius-sm)' }}
                            title="Limpiar fechas"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Summary chips */}
            <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, padding: '5px 12px', borderRadius: 'var(--radius-full)', background: 'var(--bg-hover)', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    {filtered.filter(t => t.tipo === 'cargo').length} gastos · {CLP(totalTx)}
                </span>
                {isCC && totalAbonos > 0 && (
                    <span style={{ fontSize: 12, padding: '5px 12px', borderRadius: 'var(--radius-full)', background: 'var(--success-light)', fontWeight: 500, color: 'var(--success)', border: '1px solid var(--success-border)' }}>
                        {abonosCC.length} ingresos · +{CLP(totalAbonos)}
                    </span>
                )}
                {query && (
                    <button onClick={() => setQuery('')} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 'var(--radius-full)', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                        ✕ {query}
                    </button>
                )}
            </div>

            {/* By category */}
            {byCategory.map(([cat, txList]) => {
                const catObj = allCats[cat] || { label: cat, color: '#888', bg: '#F3F4F6' };
                const catTotal = txList.reduce((s, t) => s + t.monto, 0);
                return (
                    <div key={cat} style={{ marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: catObj.color, display: 'block' }} />
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{catObj.label}</span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{CLP(catTotal)}</span>
                        </div>
                        <div className="card" style={{ padding: 0, overflow: 'visible' }}>
                            {txList.sort((a, b) => b.monto - a.monto).map((t) => (
                                <div key={t.id} className="tx-row">
                                    <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                                        <div className="tx-desc">{t.descripcion}</div>
                                        <div className="tx-date" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                                            <span>{t.fecha}</span>
                                            <ClickableTag
                                                label={catObj.label}
                                                color={catObj.color}
                                                bg={catObj.bg}
                                                categoria={t.categoria}
                                                txId={t.id}
                                                periodo={month.periodo}
                                                onRecategorize={recategorizeMonth}
                                                allCats={allCats}
                                            />
                                        </div>
                                    </div>
                                    <div className="tx-amount" style={{ color: 'var(--danger)' }}>{CLP(t.monto)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* CC: sección de ingresos (abonos) */}
            {isCC && abonosCC.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'block' }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Ingresos recibidos</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>+{CLP(totalAbonos)}</span>
                    </div>
                    <div className="card" style={{ padding: 0, overflow: 'visible' }}>
                        {abonosCC.map((t, i) => {
                            const catObj = allCats[t.categoria] || { label: t.categoria, color: '#059669', bg: '#ECFDF5' };
                            return (
                                <div key={t.id || i} className="tx-row">
                                    <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                                        <div className="tx-desc">{t.descripcion}</div>
                                        <div className="tx-date" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                                            <span>{t.fecha}</span>
                                            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 'var(--radius-full)', background: catObj.bg, color: catObj.color }}>
                                                {catObj.label}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="tx-amount" style={{ color: 'var(--success)' }}>+{CLP(t.monto)}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {txs.length > 0 && !byCategory.length && !abonosCC.length && query && (
                <div className="empty-state" style={{ paddingTop: '2rem' }}>
                    <div className="empty-state-title">Sin resultados</div>
                    <div className="empty-state-desc">"{query}" no coincide con ninguna transacción.</div>
                </div>
            )}
        </div>
        {delModal && (
            <Modal title="Eliminar mes" desc={`¿Seguro que quieres eliminar ${month?.periodo}? Se borrará todo el historial de ese mes.`}
                confirmLabel="Eliminar"
                onConfirm={async () => { 
                    const p = month?.periodo;
                    setDelModal(false); 
                    if (p) await deleteMonth(p);
                }}
                onCancel={() => setDelModal(false)} />
        )}
        </>
    );
}
