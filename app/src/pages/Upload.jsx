import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Plus, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { BANKS, MONTH_NAMES } from '../lib/constants';
import IncomeCategorizationPanel from '../components/IncomeCategorizationPanel';

const STATUS = { idle: 'idle', drag: 'drag', queue: 'queue', done: 'done' };
const ACCOUNT_TYPE_COLORS = {
    tc: { bg: 'rgba(225,29,72,.12)', color: '#E11D48', label: 'TC' },
    cc: { bg: 'rgba(8,145,178,.15)', color: '#0891B2', label: 'CC' },
};

function StepIndicator({ step }) {
    const steps = ['Cuenta', 'PDF', 'Revisión'];
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '1.75rem' }}>
            {steps.map((label, i) => {
                const n = i + 1;
                const done = step > n;
                const active = step === n;
                return (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{
                                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 12, fontWeight: 700, flexShrink: 0,
                                background: done ? 'var(--success)' : active ? 'var(--primary)' : 'var(--bg-hover)',
                                color: done || active ? '#fff' : 'var(--text-tertiary)',
                                transition: 'all var(--transition-base)',
                            }}>
                                {done ? '✓' : n}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? 'var(--primary)' : done ? 'var(--success)' : 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                                {label}
                            </span>
                        </div>
                        {i < steps.length - 1 && (
                            <div style={{
                                flex: 1, height: 2, margin: '0 8px', marginBottom: 18,
                                background: done ? 'var(--success)' : 'var(--border-medium)',
                                transition: 'background var(--transition-base)',
                            }} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default function UploadPage({ months, catRules, allCats, accounts, incomeCategories, accessToken, onSaveMonth, onSaveAccount, onSaveIncome, onSaveIncomeItems, onSaveIncomeCategory, onGoManual }) {
    const [step, setStep] = useState(1);
    const [status, setStatus] = useState(STATUS.idle);
    const [accountId, setAccountId] = useState('');
    const [queue, setQueue] = useState([]);
    const [overridePeriod, setOverride] = useState(null);
    const [showOverride, setShowOverride] = useState(false);
    const [suggestIncome, setSuggestIncome] = useState(null);
    // New account form
    const [showNewAcc, setShowNewAcc] = useState(false);
    const [newAccName, setNewAccName] = useState('');
    const [newAccBank, setNewAccBank] = useState('santander');
    const [newAccType, setNewAccType] = useState('tc');
    const [savingAcc, setSavingAcc] = useState(false);
    const [mismatchInfo, setMismatchInfo] = useState({});
    const [pendingRetry, setPendingRetry] = useState(null);

    const inputRef = useRef();
    const abortMap = useRef({});
    const timerMap = useRef({});

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

    const processFiles = useCallback(async (files, retryItemId = null) => {
        if (!accountId) return;
        const items = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
        if (!items.length) return;

        const bankForAPI = selectedAccount ? `${selectedAccount.bank}_${selectedAccount.type}` : 'santander_tc';

        let initial;
        if (retryItemId) {
            initial = [{ id: retryItemId, file: items[0], status: 'pending', msg: '', progress: 0 }];
            setQueue(q => q.map(x => x.id === retryItemId ? { ...x, status: 'pending', progress: 0, msg: '' } : x));
        } else {
            initial = items.map(f => ({ id: f.name + Date.now(), file: f, status: 'pending', msg: '', progress: 0 }));
            setQueue(initial);
            setStatus(STATUS.queue);
            setStep(3); // auto-advance to results
        }

        for (const item of initial) {
            const ctrl = new AbortController();
            abortMap.current[item.id] = ctrl;
            setQueue(q => q.map(x => x.id === item.id ? { ...x, status: 'processing', msg: 'Leyendo PDF…', progress: 0 } : x));
            startProgress(item.id);

            try {
                const b64 = await toBase64(item.file);
                const res = await fetch('/api/process-pdf', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
                    },
                    body: JSON.stringify({ pdfBase64: b64, bank: bankForAPI }),
                    signal: ctrl.signal,
                });
                if (!res.ok) {
                    if (res.status === 422) {
                        const errBody = await res.json().catch(() => ({}));
                        if (errBody.error === 'ACCOUNT_TYPE_MISMATCH') {
                            stopProgress(item.id);
                            const detectedType = errBody.detected;
                            const msg = detectedType === 'cc'
                                ? 'Este PDF es de Cuenta Corriente'
                                : 'Este PDF es de Tarjeta de Crédito';
                            setMismatchInfo(prev => ({ ...prev, [item.id]: { bank: selectedAccount?.bank, detectedType } }));
                            setQueue(q => q.map(x => x.id === item.id
                                ? { ...x, status: 'mismatch', progress: 0, msg }
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

                const protectedCats = isCC ? ['traspaso_tc', 'cargos_banco'] : ['cargos_banco'];
                const txs = (parsed.transacciones || []).map(t => {
                    if (protectedCats.includes(t.categoria)) return t;
                    if (t.tipo === 'abono') return t;
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
                    setQueue(q => q.map(x => x.id === item.id ? { ...x, status: 'error', progress: 0, msg: 'La IA no pudo detectar el período. Fuerza el período con la opción avanzada.' } : x));
                    continue;
                }

                await onSaveMonth({ ...monthData, account_id: accountId, periodo: saveKey });
                stopProgress(item.id);

                if (isCC) {
                    const abonos = txs.filter(t => t.tipo === 'abono' && t.categoria === 'transferencia_recibida');
                    if (abonos.length > 0) {
                        try {
                            await onSaveIncomeItems(saveKey, abonos.map(t => ({
                                name: t.descripcion, amount: t.monto, categoria_ingreso: 'otros',
                            })));
                        } catch (e) {
                            console.warn('[Upload] Auto-save ingresos CC falló:', e);
                        }
                        setSuggestIncome({
                            items: abonos.map(t => ({ id: t.id, descripcion: t.descripcion, monto: t.monto, fecha: t.fecha })),
                            periodo: saveKey,
                        });
                    }
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
    }, [accessToken, accountId, accounts, catRules, months, onSaveMonth, onSaveIncomeItems, overridePeriod, selectedAccount]);

    useEffect(() => {
        if (pendingRetry) {
            setPendingRetry(null);
            processFiles([pendingRetry.file], pendingRetry.itemId);
        }
    }, [pendingRetry, processFiles]);

    const handleFixMismatch = useCallback((itemId) => {
        const info = mismatchInfo[itemId];
        if (!info) return;
        const targetType = info.detectedType;
        const matchAccount = accounts.find(a => a.bank === info.bank && a.type === targetType);
        if (matchAccount) {
            setAccountId(matchAccount.id);
            setMismatchInfo(prev => { const n = { ...prev }; delete n[itemId]; return n; });
            const qItem = queue.find(x => x.id === itemId);
            if (qItem) setPendingRetry({ file: qItem.file, itemId });
        } else {
            setNewAccBank(info.bank);
            setNewAccType(targetType);
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

    // ── STEP 1: Account selection ────────────────────
    const renderStep1 = () => (
        <div className="animate-fadeIn">
            <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                <div>
                    <div className="page-title">Subir estado de cuenta</div>
                    <div className="page-subtitle">Procesamos el PDF automáticamente con IA</div>
                </div>
            </div>
            <StepIndicator step={1} />

            <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Selecciona la cuenta bancaria
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1.25rem' }}>
                {accounts.map(a => {
                    const tc = ACCOUNT_TYPE_COLORS[a.type] || ACCOUNT_TYPE_COLORS.tc;
                    const isSelected = accountId === a.id;
                    return (
                        <button key={a.id} onClick={() => { setAccountId(a.id); setShowNewAcc(false); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                                borderRadius: 'var(--radius-md)',
                                background: isSelected ? 'var(--primary-light)' : 'var(--bg-card)',
                                border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border-medium)'}`,
                                cursor: 'pointer', textAlign: 'left', transition: 'all var(--transition-fast)',
                            }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                                background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0, fontSize: 11, fontWeight: 700, color: tc.color,
                            }}>
                                {tc.label}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{a.name}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{a.bank}</div>
                            </div>
                            {isSelected && (
                                <CheckCircle size={18} color="var(--primary)" />
                            )}
                        </button>
                    );
                })}

                {/* New account card */}
                {!showNewAcc && (
                    <button onClick={() => setShowNewAcc(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-card)',
                            border: '1.5px dashed var(--border-strong)',
                            cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500,
                        }}>
                        <Plus size={16} />
                        Agregar nueva cuenta
                    </button>
                )}
            </div>

            {/* New account inline form */}
            {showNewAcc && (
                <div className="card" style={{ marginBottom: '1.25rem', padding: '14px 16px', border: '1px solid var(--primary-border)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        Nueva cuenta
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <input
                            autoFocus
                            value={newAccName} onChange={e => setNewAccName(e.target.value)}
                            placeholder="Ej: Santander TC"
                            className="input"
                            onKeyDown={e => e.key === 'Enter' && handleCreateAccount()}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <select value={newAccBank} onChange={e => setNewAccBank(e.target.value)} className="input" style={{ flex: 1 }}>
                                <option value="santander">Santander</option>
                                <option value="bci">BCI</option>
                                <option value="chile">Banco de Chile</option>
                                <option value="scotiabank">Scotiabank</option>
                                <option value="otro">Otro</option>
                            </select>
                            <select value={newAccType} onChange={e => setNewAccType(e.target.value)} className="input" style={{ flex: 1 }}>
                                <option value="tc">Tarjeta crédito</option>
                                <option value="cc">Cuenta corriente</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={handleCreateAccount} disabled={!newAccName.trim() || savingAcc} className="btn btn-primary" style={{ flex: 1 }}>
                                {savingAcc ? 'Guardando…' : 'Crear cuenta'}
                            </button>
                            <button onClick={() => { setShowNewAcc(false); setNewAccName(''); }} className="btn btn-ghost">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            <button
                onClick={() => setStep(2)}
                disabled={!accountId}
                className="btn btn-primary"
                style={{ width: '100%' }}>
                Continuar →
            </button>
        </div>
    );

    // ── STEP 2: Upload PDF ───────────────────────────
    const renderStep2 = () => {
        const acc = selectedAccount;
        const tc = acc ? (ACCOUNT_TYPE_COLORS[acc.type] || ACCOUNT_TYPE_COLORS.tc) : null;
        return (
            <div className="animate-fadeIn">
                <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                    <div>
                        <div className="page-title">Subir estado de cuenta</div>
                        <div className="page-subtitle">Procesamos el PDF automáticamente con IA</div>
                    </div>
                </div>
                <StepIndicator step={2} />

                {/* Selected account chip */}
                {acc && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.5rem' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Cuenta:</span>
                        <span style={{ fontSize: 13, fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: tc?.bg, color: tc?.color }}>
                            {tc?.label}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{acc.name}</span>
                        <button onClick={() => setStep(1)} style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 4 }}>
                            Cambiar
                        </button>
                    </div>
                )}

                {/* Drop zone */}
                <div
                    className={`dropzone${status === STATUS.drag ? ' drag-over' : ''}`}
                    onDragOver={e => { e.preventDefault(); setStatus(STATUS.drag); }}
                    onDragLeave={() => setStatus(STATUS.idle)}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    style={{ marginBottom: '1rem' }}
                >
                    <input ref={inputRef} type="file" multiple accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={e => processFiles(e.target.files)} />
                    <Upload size={32} style={{ color: 'var(--primary)', marginBottom: 12 }} />
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                        {status === STATUS.drag ? 'Suelta los archivos aquí' : 'Arrastra o selecciona PDF(s)'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        Puedes subir varios meses de una vez
                    </div>
                </div>

                {/* Period override (advanced, collapsible) */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <button
                        onClick={() => setShowOverride(v => !v)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        {showOverride ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        Opciones avanzadas
                    </button>
                    {showOverride && (
                        <div style={{ marginTop: 10 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 7 }}>
                                Forzar período (si la IA no lo detecta)
                            </label>
                            <select value={overridePeriod || ''} onChange={e => setOverride(e.target.value || null)} className="input">
                                <option value="">Detectar automáticamente</option>
                                {[2024, 2025, 2026].flatMap(y => MONTH_NAMES.map(m => `${m} ${y}`)).map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <button onClick={() => setStep(1)} className="btn btn-ghost" style={{ width: '100%' }}>
                    <ArrowLeft size={14} /> Volver
                </button>
            </div>
        );
    };

    // ── STEP 3: Results ──────────────────────────────
    const renderStep3 = () => {
        const acc = selectedAccount;
        const tc = acc ? (ACCOUNT_TYPE_COLORS[acc.type] || ACCOUNT_TYPE_COLORS.tc) : null;
        return (
            <div className="animate-fadeIn">
                <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                    <div>
                        <div className="page-title">Subir estado de cuenta</div>
                        <div className="page-subtitle">Procesamos el PDF automáticamente con IA</div>
                    </div>
                </div>
                <StepIndicator step={3} />

                {/* Account chip */}
                {acc && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Cuenta:</span>
                        <span style={{ fontSize: 13, fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: tc?.bg, color: tc?.color }}>
                            {tc?.label}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{acc.name}</span>
                    </div>
                )}

                {/* Queue */}
                {queue.length > 0 && (
                    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.25rem' }}>
                        {queue.map((item) => {
                            const isDone = item.status === 'done';
                            const isWarn = item.status === 'warn';
                            const isErr = item.status === 'error';
                            const isMismatch = item.status === 'mismatch';
                            const isProc = item.status === 'processing';
                            const isFinished = isDone || isWarn;
                            const mismatch = mismatchInfo[item.id];
                            const matchAccount = mismatch ? accounts.find(a => a.bank === mismatch.bank && a.type === mismatch.detectedType) : null;
                            return (
                                <div key={item.id} className={`queue-item${isProc ? ' active' : ''}`}>
                                    <div className="queue-status-dot" style={{
                                        background: isFinished ? 'var(--success-light)' : isWarn ? 'var(--warning-light)' : (isErr || isMismatch) ? 'var(--warning-light)' : isProc ? 'var(--primary-light)' : 'var(--bg-hover)',
                                    }}>
                                        {isFinished ? <CheckCircle size={16} color="var(--success)" /> : isWarn ? <AlertCircle size={16} color="var(--warning)" /> : (isErr || isMismatch) ? <AlertCircle size={16} color="var(--warning)" /> : <FileText size={16} color={isProc ? 'var(--primary)' : 'var(--text-tertiary)'} />}
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
                                        <div style={{ fontSize: 11, color: isFinished ? 'var(--success)' : isWarn ? 'var(--warning)' : isErr ? 'var(--danger)' : isMismatch ? 'var(--warning)' : 'var(--text-tertiary)', marginTop: 2 }}>{item.msg}</div>
                                        {isMismatch && (
                                            <div style={{ marginTop: 6 }}>
                                                <button onClick={() => handleFixMismatch(item.id)} className="btn btn-primary btn-sm" style={{ fontSize: 11 }}>
                                                    {matchAccount
                                                        ? `Usar "${matchAccount.name}" y reprocesar`
                                                        : `Crear cuenta ${mismatch?.detectedType?.toUpperCase() ?? ''} y reintentar`}
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

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10, marginTop: '0.5rem' }}>
                    <button
                        onClick={() => { setQueue([]); setStatus(STATUS.idle); setStep(2); }}
                        className="btn btn-ghost"
                        style={{ flex: 1 }}>
                        Subir otro PDF
                    </button>
                    <button
                        onClick={() => { setQueue([]); setStatus(STATUS.idle); setSuggestIncome(null); setStep(1); }}
                        className="btn btn-ghost"
                        style={{ flex: 1 }}>
                        Cambiar cuenta
                    </button>
                </div>

                {/* Manual entry shortcut */}
                <div style={{ textAlign: 'center', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>¿No tienes el PDF o prefieres ingresar manualmente?</div>
                    <button onClick={onGoManual} className="btn btn-ghost">✏️ Entrada manual</button>
                </div>
            </div>
        );
    };

    // ── Render by step ───────────────────────────────
    if (step === 1) return renderStep1();
    if (step === 2) return renderStep2();
    return renderStep3();
}
