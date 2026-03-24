import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Plus } from 'lucide-react';
import { BANKS, MONTH_NAMES } from '../lib/constants';
import IncomeCategorizationPanel from '../components/IncomeCategorizationPanel';

const STATUS = { idle: 'idle', drag: 'drag', queue: 'queue', done: 'done' };

export default function UploadPage({ months, catRules, allCats, accounts, incomeCategories, onSaveMonth, onSaveAccount, onSaveIncome, onSaveIncomeItems, onSaveIncomeCategory, onGoManual }) {
    const [status, setStatus] = useState(STATUS.idle);
    const [accountId, setAccountId] = useState('');
    const [queue, setQueue] = useState([]);
    const [overridePeriod, setOverride] = useState(null);
    const [suggestIncome, setSuggestIncome] = useState(null); // { items: [...], periodo }
    // New account form
    const [showNewAcc, setShowNewAcc] = useState(false);
    const [newAccName, setNewAccName] = useState('');
    const [newAccBank, setNewAccBank] = useState('santander');
    const [newAccType, setNewAccType] = useState('tc');
    const [savingAcc, setSavingAcc] = useState(false);
    const [mismatchInfo, setMismatchInfo] = useState({}); // { [itemId]: { bank } }
    const [pendingRetry, setPendingRetry] = useState(null); // { file } — retry tras cambio de cuenta

    const inputRef = useRef();
    const abortMap = useRef({});
    const timerMap = useRef({});

    // Auto-select first account when accounts load
    useEffect(() => {
        if (!accountId && accounts.length > 0) setAccountId(accounts[0].id);
    }, [accounts, accountId]);

    const PHASES = [
        { until: 12, step: 3,   label: 'Leyendo PDF…' },
        { until: 22, step: 2,   label: 'Enviando a IA…' },
        { until: 84, step: 0.5, label: 'Analizando transacciones…' },
    ];

    const startProgress = (id) => {
        let prog = 0;
        timerMap.current[id] = setInterval(() => {
            const phase = PHASES.find(p => prog < p.until) || PHASES.at(-1);
            prog = Math.min(prog + phase.step, 84);
            const label = PHASES.find(p => prog < p.until)?.label ?? 'Analizando transacciones…';
            setQueue(q => q.map(x => x.id === id ? { ...x, progress: Math.round(prog), msg: label } : x));
        }, 350);
    };

    const stopProgress = (id) => {
        clearInterval(timerMap.current[id]);
        delete timerMap.current[id];
    };

    const handleCreateAccount = async () => {
        if (!newAccName.trim()) return;
        setSavingAcc(true);
        try {
            const saved = await onSaveAccount({
                name: newAccName.trim(),
                bank: newAccBank,
                type: newAccType,
                color: newAccType === 'cc' ? '#0891B2' : '#E11D48',
                icon: newAccType === 'cc' ? 'bank' : 'card',
            });
            setAccountId(saved.id);
            setShowNewAcc(false);
            setNewAccName('');
        } finally {
            setSavingAcc(false);
        }
    };

    const selectedAccount = accounts.find(a => a.id === accountId) ?? null;

    const processFiles = useCallback(async (files) => {
        if (!accountId) return;
        const items = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
        if (!items.length) return;

        const bankForAPI = selectedAccount ? `${selectedAccount.bank}_${selectedAccount.type}` : 'santander_tc';

        const initial = items.map(f => ({ id: f.name + Date.now(), file: f, status: 'pending', msg: '', progress: 0 }));
        setQueue(initial);
        setStatus(STATUS.queue);

        for (const item of initial) {
            const ctrl = new AbortController();
            abortMap.current[item.id] = ctrl;
            setQueue(q => q.map(x => x.id === item.id ? { ...x, status: 'processing', msg: 'Leyendo PDF…', progress: 0 } : x));
            startProgress(item.id);

            try {
                const b64 = await toBase64(item.file);
                const res = await fetch('/api/process-pdf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pdfBase64: b64, bank: bankForAPI }),
                    signal: ctrl.signal,
                });
                if (!res.ok) {
                    if (res.status === 422) {
                        const errBody = await res.json().catch(() => ({}));
                        if (errBody.error === 'ACCOUNT_TYPE_MISMATCH') {
                            stopProgress(item.id);
                            setMismatchInfo(prev => ({ ...prev, [item.id]: { bank: selectedAccount?.bank } }));
                            setQueue(q => q.map(x => x.id === item.id
                                ? { ...x, status: 'mismatch', progress: 0, msg: 'Este PDF es de Cuenta Corriente' }
                                : x
                            ));
                            continue;
                        }
                    }
                    throw new Error(`HTTP ${res.status}`);
                }
                const data = await res.json();
                if (data.error) throw new Error(data.error);

                const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                const isCC = parsed.source_type === 'cc';

                const protectedCats = isCC ? ['traspaso_tc', 'comision_banco'] : ['cargos_banco'];
                const txs = (parsed.transacciones || []).map(t => {
                    if (protectedCats.includes(t.categoria)) return t;
                    const key = (t.descripcion || '').toLowerCase().trim();
                    return catRules[key] ? { ...t, categoria: catRules[key] } : t;
                });

                const cats = {};
                let totalCargos = 0;
                txs.forEach(t => {
                    if (t.tipo === 'abono' || t.tipo === 'traspaso_tc') {
                        cats[t.categoria] = (cats[t.categoria] || 0) + t.monto;
                        return;
                    }
                    if (t.tipo === 'cargo') {
                        cats[t.categoria] = (cats[t.categoria] || 0) + t.monto;
                        if (isCC) {
                            if (t.categoria !== 'traspaso_tc') totalCargos += t.monto;
                        } else {
                            if (t.categoria !== 'cargos_banco') totalCargos += t.monto;
                        }
                    }
                });

                const monthData = { ...parsed, transacciones: txs, categorias: cats, total_cargos: totalCargos };
                const totalOps = parsed.total_operaciones || 0;
                const mismatch = !isCC && totalOps > 0 && Math.abs(totalOps - totalCargos) > 100;

                const existing = months.find(m => m.periodo === parsed.periodo && m.account_id === accountId);
                const saveKey = overridePeriod || parsed.periodo;

                if (saveKey === 'Desconocido') {
                    stopProgress(item.id);
                    setQueue(q => q.map(x => x.id === item.id ? { ...x, status: 'error', progress: 0, msg: 'La IA no pudo detectar el período. Selecciona el período manualmente arriba y vuelve a subir.' } : x));
                    continue;
                }

                await onSaveMonth({ ...monthData, account_id: accountId, periodo: saveKey });
                stopProgress(item.id);

                // CC income suggestion — lista individual de abonos
                if (isCC) {
                    const abonoItems = txs
                        .filter(t => t.tipo === 'abono' && t.categoria === 'transferencia_recibida')
                        .map(t => ({ id: t.id, descripcion: t.descripcion, monto: t.monto, fecha: t.fecha }));
                    if (abonoItems.length > 0) setSuggestIncome({ items: abonoItems, periodo: saveKey });
                }

                const doneMsg = mismatch
                    ? `Guardado — faltan ~$${(totalOps - totalCargos).toLocaleString('es-CL')} según PDF`
                    : existing && !overridePeriod ? 'Actualizado ✓' : 'Guardado ✓';
                setQueue(q => q.map(x => x.id === item.id ? { ...x, status: mismatch ? 'warn' : 'done', progress: 100, msg: doneMsg, result: monthData } : x));
            } catch (e) {
                stopProgress(item.id);
                if (e.name === 'AbortError') {
                    setQueue(q => q.map(x => x.id === item.id ? { ...x, status: 'cancelled', msg: 'Cancelado' } : x));
                } else {
                    setQueue(q => q.map(x => x.id === item.id ? { ...x, status: 'error', msg: e.message || 'Error procesando PDF' } : x));
                }
            }
            delete abortMap.current[item.id];
        }
    }, [accountId, accounts, catRules, months, onSaveMonth, overridePeriod, selectedAccount]);

    // Ejecutar retry DESPUÉS de que React re-renderice con el nuevo accountId
    useEffect(() => {
        if (pendingRetry) {
            setPendingRetry(null);
            processFiles([pendingRetry.file]);
        }
    }, [pendingRetry, processFiles]);

    const handleFixMismatch = useCallback((itemId) => {
        const info = mismatchInfo[itemId];
        if (!info) return;
        const ccAccount = accounts.find(a => a.bank === info.bank && a.type === 'cc');
        if (ccAccount) {
            setAccountId(ccAccount.id);
            setMismatchInfo(prev => { const n = { ...prev }; delete n[itemId]; return n; });
            const qItem = queue.find(x => x.id === itemId);
            if (qItem) setPendingRetry({ file: qItem.file }); // defer hasta re-render con nueva cuenta
        } else {
            setNewAccBank(info.bank);
            setNewAccType('cc');
            setShowNewAcc(true);
        }
    }, [mismatchInfo, accounts, queue]);

    const toBase64 = (file) => new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
    });

    const handleDrop = e => {
        e.preventDefault(); setStatus(STATUS.idle);
        processFiles(e.dataTransfer.files);
    };

    const hasDone = queue.some(q => q.status === 'done' || q.status === 'warn');
    const hasErrors = queue.some(q => q.status === 'error');

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <div className="page-title">Subir estado de cuenta</div>
                    <div className="page-subtitle">Procesamos el PDF automáticamente con IA</div>
                </div>
            </div>

            {/* Account selector */}
            <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>Cuenta bancaria</label>
                {accounts.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)' }}>
                        No tienes cuentas registradas. Crea una abajo.
                    </div>
                ) : (
                    <select value={accountId} onChange={e => {
                        if (e.target.value === '__new__') { setShowNewAcc(true); return; }
                        setAccountId(e.target.value);
                        setShowNewAcc(false);
                    }} className="input">
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        <option value="__new__">+ Nueva cuenta…</option>
                    </select>
                )}
            </div>

            {/* New account inline form */}
            {(showNewAcc || accounts.length === 0) && (
                <div className="card" style={{ marginBottom: '1.25rem', padding: '14px 16px', border: '1px solid var(--primary-light)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        <Plus size={12} style={{ display: 'inline', marginRight: 5 }} />Nueva cuenta
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <input
                            value={newAccName} onChange={e => setNewAccName(e.target.value)}
                            placeholder="Ej: Santander TC"
                            className="input" style={{ flex: 2, minWidth: 140 }}
                        />
                        <select value={newAccBank} onChange={e => setNewAccBank(e.target.value)} className="input" style={{ flex: 1, minWidth: 110 }}>
                            <option value="santander">Santander</option>
                            <option value="bci">BCI</option>
                            <option value="chile">Banco de Chile</option>
                            <option value="scotiabank">Scotiabank</option>
                            <option value="otro">Otro</option>
                        </select>
                        <select value={newAccType} onChange={e => setNewAccType(e.target.value)} className="input" style={{ flex: 1, minWidth: 90 }}>
                            <option value="tc">Tarjeta crédito</option>
                            <option value="cc">Cuenta corriente</option>
                        </select>
                        <button onClick={handleCreateAccount} disabled={!newAccName.trim() || savingAcc} className="btn btn-primary">
                            {savingAcc ? '…' : 'Crear'}
                        </button>
                        {accounts.length > 0 && (
                            <button onClick={() => { setShowNewAcc(false); setNewAccName(''); }} className="btn btn-ghost">Cancelar</button>
                        )}
                    </div>
                </div>
            )}

            {/* Manual period override */}
            <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>Período (opcional, si quieres forzar uno)</label>
                <select value={overridePeriod || ''} onChange={e => setOverride(e.target.value || null)} className="input">
                    <option value="">Detectar automáticamente</option>
                    {[2024, 2025, 2026].flatMap(y => MONTH_NAMES.map(m => `${m} ${y}`)).map(p => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>
            </div>

            {/* Drop zone */}
            <div
                className={`dropzone${status === STATUS.drag ? ' drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setStatus(STATUS.drag); }}
                onDragLeave={() => setStatus(STATUS.idle)}
                onDrop={handleDrop}
                onClick={() => status !== STATUS.queue && accounts.length > 0 && !showNewAcc && inputRef.current?.click()}
            >
                <input ref={inputRef} type="file" multiple accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={e => processFiles(e.target.files)} />
                <Upload size={32} style={{ color: 'var(--primary)', marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                    {status === STATUS.drag ? 'Suelta los archivos aquí' : 'Arrastra o selecciona PDF(s)'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {accounts.length === 0 ? 'Primero crea una cuenta arriba' : 'Puedes subir varios meses de una vez'}
                    {selectedAccount && (
                        <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, letterSpacing: '.04em',
                            background: selectedAccount.type === 'cc' ? 'var(--primary-light)' : '#FFE4E6',
                            color: selectedAccount.type === 'cc' ? 'var(--primary)' : '#BE123C',
                        }}>
                            {selectedAccount.type === 'cc' ? 'CC' : 'TC'}
                        </span>
                    )}
                </div>
            </div>

            {/* Queue */}
            {queue.length > 0 && (
                <div className="card" style={{ padding: 0, marginTop: '1.5rem', overflow: 'hidden' }}>
                    {queue.map((item) => {
                        const isDone = item.status === 'done';
                        const isWarn = item.status === 'warn';
                        const isErr = item.status === 'error';
                        const isMismatch = item.status === 'mismatch';
                        const isPending = item.status === 'pending';
                        const isProc = item.status === 'processing';
                        const isFinished = isDone || isWarn;
                        const mismatch = mismatchInfo[item.id];
                        const ccAccount = mismatch ? accounts.find(a => a.bank === mismatch.bank && a.type === 'cc') : null;
                        return (
                            <div key={item.id} className={`queue-item${isProc ? ' active' : ''}`}>
                                <div className="queue-status-dot" style={{
                                    background: isFinished ? 'var(--success-light)' : isWarn ? 'var(--warning-light, #FEF3C7)' : (isErr || isMismatch) ? 'var(--warning-light, #FEF3C7)' : isProc ? 'var(--primary-light)' : 'var(--bg-hover)',
                                }}>
                                    {isFinished ? <CheckCircle size={16} color="var(--success)" /> : isWarn ? <AlertCircle size={16} color="var(--warning, #D97706)" /> : (isErr || isMismatch) ? <AlertCircle size={16} color="var(--warning, #D97706)" /> : <FileText size={16} color={isProc ? 'var(--primary)' : 'var(--text-tertiary)'} />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.file.name}</div>
                                    {isProc && (
                                        <div className="queue-progress-wrap">
                                            <div className="queue-progress-bar">
                                                <div className="queue-progress-fill" style={{ width: `${item.progress ?? 0}%` }} />
                                            </div>
                                            <span className="queue-progress-pct">{item.progress ?? 0}%</span>
                                        </div>
                                    )}
                                    <div style={{ fontSize: 11, color: isFinished ? 'var(--success)' : isWarn ? 'var(--warning, #D97706)' : isErr ? 'var(--danger)' : isMismatch ? 'var(--warning, #D97706)' : 'var(--text-tertiary)', marginTop: 2 }}>{item.msg}</div>
                                    {isMismatch && (
                                        <div style={{ marginTop: 6 }}>
                                            <button onClick={() => handleFixMismatch(item.id)} className="btn btn-primary btn-sm" style={{ fontSize: 11 }}>
                                                {ccAccount ? `Usar "${ccAccount.name}" y reprocesar` : 'Crear cuenta CC y reintentar'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {isProc && abortMap.current[item.id] && (
                                    <button onClick={() => abortMap.current[item.id]?.abort()} className="btn-icon btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }}>
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {(hasDone || hasErrors) && (
                <div style={{ display: 'flex', gap: 10, marginTop: '1.25rem' }}>
                    <button onClick={() => { setQueue([]); setStatus(STATUS.idle); }} className="btn btn-ghost" style={{ flex: 1 }}>
                        Subir más archivos
                    </button>
                </div>
            )}

            {/* CC income categorization panel */}
            {suggestIncome && (
                <IncomeCategorizationPanel
                    items={suggestIncome.items}
                    periodo={suggestIncome.periodo}
                    incomeCategories={incomeCategories}
                    onSaveItems={async (periodo, items) => {
                        await onSaveIncomeItems(periodo, items);
                        setSuggestIncome(null);
                    }}
                    onSaveCategory={onSaveIncomeCategory}
                    onDismiss={() => setSuggestIncome(null)}
                />
            )}

            {/* Manual entry shortcut */}
            <div style={{ textAlign: 'center', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>¿No tienes el PDF o prefieres ingresar manualmente?</div>
                <button onClick={onGoManual} className="btn btn-ghost">✏️ Entrada manual</button>
            </div>
        </div>
    );
}
