import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search, Trash2 } from 'lucide-react';
import Section from '../components/ui/Section';
import Modal from '../components/ui/Modal';
import { ClickableTag } from '../components/CategoryPicker';
import { CLP } from '../utils/formatters';

export default function HistoryPage({ allMonths, uniqueSortedPeriods, accounts, allCats, deleteMonth, recategorizeMonth }) {
    const [selIdx, setSelIdx] = useState(0);
    const [query, setQuery] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [delModal, setDelModal] = useState(false);
    const [activeSourceId, setActiveSourceId] = useState(null); // null = todas

    const idx = uniqueSortedPeriods.length > 0 ? Math.min(selIdx, uniqueSortedPeriods.length - 1) : 0;
    const periodo = uniqueSortedPeriods[idx] || null;
    const sources = allMonths.filter(m => m.periodo === periodo);
    const primarySource = sources[0] || null;

    // Reset filters when changing period
    useEffect(() => {
        setDateRange({ start: '', end: '' });
        setActiveSourceId(null);
    }, [selIdx]);

    useEffect(() => {
        if (uniqueSortedPeriods.length > 0 && selIdx >= uniqueSortedPeriods.length) {
            setSelIdx(uniqueSortedPeriods.length - 1);
        }
    }, [uniqueSortedPeriods.length, selIdx]);

    const parseTxDate = (dStr) => {
        if (!dStr) return null;
        const [d, m, y] = dStr.split('/').map(Number);
        return new Date(y, m - 1, d);
    };

    const formatInputDate = (dStr) => {
        if (!dStr) return '';
        const parts = dStr.split('/');
        if (parts.length !== 3) return '';
        const [d, m, y] = parts;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    };

    // All transactions from all sources for this period, with account metadata
    const allTxs = useMemo(() => sources.flatMap(s => {
        const account = accounts.find(a => a.id === s.account_id);
        return (s.transacciones || []).map(t => ({
            ...t,
            _sourceId: s.id,
            _accountName: account?.name || (s.source_type === 'cc' ? 'Cuenta Corriente' : 'Tarjeta'),
            _accountColor: account?.color || (s.source_type === 'cc' ? '#0891B2' : '#E11D48'),
            _isCC: s.source_type === 'cc',
        }));
    }), [sources, accounts]);

    const txsForFilter = activeSourceId ? allTxs.filter(t => t._sourceId === activeSourceId) : allTxs;

    const filtered = useMemo(() => {
        let res = txsForFilter;
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
    }, [txsForFilter, query, dateRange]);

    const hasIngresos = useMemo(() => allTxs.some(t => t.tipo === 'abono' && t.tipo !== 'traspaso_tc' && t.categoria !== 'traspaso_tc'), [allTxs]);

    const byCategory = useMemo(() => {
        const sortEntries = (m) => Object.entries(m).sort(
            (a, b) => b[1].reduce((s, t) => s + t.monto, 0) - a[1].reduce((s, t) => s + t.monto, 0)
        );
        const eMap = {}, iMap = {}, tMap = {};
        filtered.forEach(t => {
            if (t.tipo === 'traspaso_tc' || t.categoria === 'traspaso_tc') {
                (tMap['traspaso_tc'] = tMap['traspaso_tc'] || []).push(t);
                return;
            }
            const k = t.categoria || 'otros';
            if (t.tipo === 'cargo') (eMap[k] = eMap[k] || []).push(t);
            else if (t.tipo === 'abono') (iMap[k] = iMap[k] || []).push(t);
        });
        if (!hasIngresos) return { egresos: sortEntries(eMap), ingresos: [], traspasos: sortEntries(tMap) };
        return { egresos: sortEntries(eMap), ingresos: sortEntries(iMap), traspasos: sortEntries(tMap) };
    }, [filtered, hasIngresos]);

    const totalEgresos = byCategory.egresos.reduce((s, [, l]) => s + l.reduce((a, t) => a + t.monto, 0), 0);
    const totalIngresos = byCategory.ingresos.reduce((s, [, l]) => s + l.reduce((a, t) => a + t.monto, 0), 0);

    if (!uniqueSortedPeriods.length) return (
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
            {/* Period nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => setSelIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
                        style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: idx === 0 ? 'var(--bg-input)' : 'var(--bg-card)', cursor: idx === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: idx === 0 ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                        <ChevronLeft size={16} />
                    </button>
                    <div style={{ minWidth: 140 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.3px' }}>{periodo}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{primarySource?.periodo_desde} — {primarySource?.periodo_hasta}</div>
                    </div>
                    <button onClick={() => setSelIdx(i => Math.min(uniqueSortedPeriods.length - 1, i + 1))} disabled={idx === uniqueSortedPeriods.length - 1}
                        style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)', background: idx === uniqueSortedPeriods.length - 1 ? 'var(--bg-input)' : 'var(--bg-card)', cursor: idx === uniqueSortedPeriods.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: idx === uniqueSortedPeriods.length - 1 ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                        <ChevronRight size={16} />
                    </button>
                </div>
                <div style={{ flex: 1 }} />
                <button onClick={() => setDelModal(true)} className="btn-icon btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)', flexShrink: 0 }}>
                    <Trash2 size={15} />
                </button>
            </div>

            {/* Account filter pills (multi-account) */}
            {sources.length > 1 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <button onClick={() => setActiveSourceId(null)}
                        style={{ fontSize: 12, padding: '4px 12px', borderRadius: 'var(--radius-full)', border: `1px solid ${activeSourceId === null ? 'var(--primary)' : 'var(--border-medium)'}`, background: activeSourceId === null ? 'var(--primary-light)' : 'var(--bg-card)', color: activeSourceId === null ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>
                        Todas
                    </button>
                    {sources.map(s => {
                        const acc = accounts.find(a => a.id === s.account_id);
                        const name = acc?.name || (s.source_type === 'cc' ? 'CC' : 'TC');
                        const color = acc?.color || (s.source_type === 'cc' ? '#0891B2' : '#E11D48');
                        const isActive = activeSourceId === s.id;
                        return (
                            <button key={s.id} onClick={() => setActiveSourceId(isActive ? null : s.id)}
                                style={{ fontSize: 12, padding: '4px 12px', borderRadius: 'var(--radius-full)', border: `1px solid ${isActive ? color : 'var(--border-medium)'}`, background: isActive ? `${color}18` : 'var(--bg-card)', color: isActive ? color : 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
                                {name}
                            </button>
                        );
                    })}
                </div>
            )}

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
                    <input type="date" value={dateRange.start}
                        min={formatInputDate(primarySource?.periodo_desde)}
                        max={formatInputDate(primarySource?.periodo_hasta)}
                        onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="input" style={{ width: 'auto', fontSize: 12, padding: '8px 10px' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>a</span>
                    <input type="date" value={dateRange.end}
                        min={formatInputDate(primarySource?.periodo_desde)}
                        max={formatInputDate(primarySource?.periodo_hasta)}
                        onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="input" style={{ width: 'auto', fontSize: 12, padding: '8px 10px' }} />
                    {(dateRange.start || dateRange.end) && (
                        <button onClick={() => setDateRange({ start: '', end: '' })} className="btn-icon btn-sm"
                            style={{ padding: 6, borderRadius: 'var(--radius-sm)' }} title="Limpiar fechas">✕</button>
                    )}
                </div>
            </div>

            {/* Summary chip */}
            <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                {hasIngresos ? (
                    <>
                        <span style={{ fontSize: 12, padding: '5px 12px', borderRadius: 'var(--radius-full)', background: 'var(--bg-hover)', fontWeight: 500, color: 'var(--danger)' }}>
                            ↓ {byCategory.egresos.reduce((s, [, l]) => s + l.length, 0)} egresos · {CLP(totalEgresos)}
                        </span>
                        <span style={{ fontSize: 12, padding: '5px 12px', borderRadius: 'var(--radius-full)', background: 'var(--bg-hover)', fontWeight: 500, color: 'var(--success, #059669)' }}>
                            ↑ {byCategory.ingresos.reduce((s, [, l]) => s + l.length, 0)} ingresos · {CLP(totalIngresos)}
                        </span>
                        {byCategory.traspasos?.length > 0 && (
                            <span style={{ fontSize: 12, padding: '5px 12px', borderRadius: 'var(--radius-full)', background: 'var(--bg-hover)', fontWeight: 500, color: 'var(--text-tertiary)' }}>
                                ⇄ {byCategory.traspasos.reduce((s, [, l]) => s + l.length, 0)} pago{byCategory.traspasos.reduce((s, [, l]) => s + l.length, 0) !== 1 ? 's' : ''} TC · {CLP(byCategory.traspasos.reduce((s, [, l]) => s + l.reduce((a, t) => a + t.monto, 0), 0))}
                            </span>
                        )}
                    </>
                ) : (
                    <span style={{ fontSize: 12, padding: '5px 12px', borderRadius: 'var(--radius-full)', background: 'var(--bg-hover)', fontWeight: 500, color: 'var(--text-secondary)' }}>
                        {filtered.filter(t => t.tipo === 'cargo').length} transacciones · {CLP(totalEgresos)}
                    </span>
                )}
                {query && (
                    <button onClick={() => setQuery('')} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 'var(--radius-full)', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                        ✕ {query}
                    </button>
                )}
            </div>

            {/* Transaction groups */}
            {(() => {
                const renderGroup = (entries) => entries.map(([cat, txList]) => {
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
                                            <div className="tx-date" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                                                <span>{t.fecha}</span>
                                                {/* Account badge (multi-account) */}
                                                {sources.length > 1 && (
                                                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 'var(--radius-full)', background: `${t._accountColor}18`, color: t._accountColor, fontWeight: 600, border: `1px solid ${t._accountColor}30` }}>
                                                        {t._accountName}
                                                    </span>
                                                )}
                                                <ClickableTag
                                                    label={catObj.label}
                                                    color={catObj.color}
                                                    bg={catObj.bg}
                                                    categoria={t.categoria}
                                                    txId={t.id}
                                                    periodo={periodo}
                                                    onRecategorize={recategorizeMonth}
                                                    allCats={allCats}
                                                />
                                            </div>
                                        </div>
                                        <div className="tx-amount">{CLP(t.monto)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                });

                if (!hasIngresos) return renderGroup(byCategory.egresos);

                return (
                    <>
                        {byCategory.egresos.length > 0 && (
                            <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
                                    ↓ Egresos
                                </div>
                                {renderGroup(byCategory.egresos)}
                            </>
                        )}
                        {byCategory.ingresos.length > 0 && (
                            <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--success, #059669)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, marginTop: byCategory.egresos.length > 0 ? 4 : 0 }}>
                                    ↑ Ingresos del período
                                </div>
                                {renderGroup(byCategory.ingresos)}
                            </>
                        )}
                        {byCategory.traspasos?.length > 0 && (
                            <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, marginTop: 4 }}>
                                    ⇄ Pagos tarjeta de crédito
                                </div>
                                {renderGroup(byCategory.traspasos)}
                            </>
                        )}
                    </>
                );
            })()}

            {allTxs.length > 0 && byCategory.egresos.length === 0 && byCategory.ingresos.length === 0 && !byCategory.traspasos?.length && query && (
                <div className="empty-state" style={{ paddingTop: '2rem' }}>
                    <div className="empty-state-title">Sin resultados</div>
                    <div className="empty-state-desc">"{query}" no coincide con ninguna transacción.</div>
                </div>
            )}
        </div>
        {delModal && (() => {
            const activeSource = sources.find(s => s.id === activeSourceId);
            const activeAcc = activeSource ? accounts.find(a => a.id === activeSource.account_id) : null;
            const activeName = activeAcc?.name || (activeSource?.source_type === 'cc' ? 'CC' : 'TC');
            const desc = activeSourceId
                ? `¿Seguro que quieres eliminar ${periodo} de "${activeName}"? Solo se borrará esa cuenta.`
                : `¿Seguro que quieres eliminar ${periodo}? Se borrará el historial de todas las cuentas de ese mes.`;
            return (
                <Modal title="Eliminar período" desc={desc}
                    confirmLabel="Eliminar"
                    onConfirm={async () => {
                        const p = periodo;
                        const mid = activeSourceId;
                        setDelModal(false);
                        if (p) await deleteMonth(p, mid);
                    }}
                    onCancel={() => setDelModal(false)} />
            );
        })()}
        </>
    );
}
