import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { sortMonths } from '../utils/formatters';
import { DEF_BUDGET, CAT, MONTH_NAMES } from '../lib/constants';

const parseJ = (v, fallback) => { try { return v ? JSON.parse(v) : fallback; } catch { return fallback; } };

export function useFinanceData() {
    const { user } = useAuth();
    const uid = user?.id;

    const [months, setMonths] = useState([]);
    const monthsRef = useRef([]);
    useEffect(() => { monthsRef.current = months; }, [months]);
    const [fixedByMonth, setFBM] = useState({});
    const [incomeByMonth, setIBM] = useState({});
    const [extraByMonth, setEBM] = useState({});
    const [budget, setBudget] = useState(DEF_BUDGET);
    const [catRules, setCatRules] = useState({});
    const [customCats, setCustomCats] = useState({});
    const [accounts, setAccounts] = useState([]);
    const [incomeCategories, setIncomeCategories] = useState([]);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!uid) return;
        setReady(false);

        (async () => {
            try {
                const [mR, fR, iR, eR, bR, crR, ccR, txR, acR, icR] = await Promise.all([
                    supabase.from('months').select('*').eq('user_id', uid).order('periodo'),
                    supabase.from('fixed_expenses').select('*').eq('user_id', uid),
                    supabase.from('income').select('*').eq('user_id', uid),
                    supabase.from('extra_income').select('*').eq('user_id', uid),
                    supabase.from('budgets').select('*').eq('user_id', uid).maybeSingle(),
                    supabase.from('category_rules').select('*').eq('user_id', uid),
                    supabase.from('custom_categories').select('*').eq('user_id', uid),
                    supabase.from('transactions').select('*').eq('user_id', uid),
                    supabase.from('accounts').select('*').eq('user_id', uid).eq('active', true).order('created_at'),
                    supabase.from('income_categories').select('*').eq('user_id', uid).order('created_at'),
                ]);

                const txMap = {};
                (txR.data || []).forEach(t => { (txMap[t.month_id] = txMap[t.month_id] || []).push(t); });

                setMonths(
                    (mR.data || []).map(row => ({
                        ...row,
                        categorias: parseJ(row.categorias, {}),
                        cuotas_vigentes: parseJ(row.cuotas_vigentes, []),
                        transacciones: txMap[row.id] || [],
                    }))
                );

                const fbm = {};
                (fR.data || []).forEach(r => { (fbm[r.periodo] = fbm[r.periodo] || []).push(r); });
                setFBM(fbm);

                const ibm = {};
                (iR.data || []).forEach(r => { ibm[r.periodo] = r.amount; });
                setIBM(ibm);

                const ebm = {};
                (eR.data || []).forEach(r => { (ebm[r.periodo] = ebm[r.periodo] || []).push(r); });
                setEBM(ebm);

                if (bR.data) {
                    setBudget({ ...DEF_BUDGET, ...bR.data, categories: parseJ(bR.data.categories, DEF_BUDGET.categories) });
                }

                const rules = {};
                (crR.data || []).forEach(r => { rules[r.description_key] = r.categoria; });
                setCatRules(rules);

                const cats = {};
                (ccR.data || []).forEach(r => { cats[r.cat_id] = { label: r.label, color: r.color, bg: r.bg }; });
                setCustomCats(cats);

                setAccounts(acR.data || []);
                setIncomeCategories(icR.data || []);
            } catch (err) {
                console.warn('⚠️ Fallo en carga de datos (App en modo local sin backend conectado)');
            } finally {
                setReady(true);
            }
        })();
    }, [uid]);

    const sorted = useMemo(() => sortMonths(months), [months]);
    const allCats = useMemo(() => ({ ...CAT, ...customCats }), [customCats]);

    const uniqueSortedPeriods = useMemo(() => {
        const seen = new Set();
        return sortMonths(months).filter(m => {
            if (seen.has(m.periodo)) return false;
            seen.add(m.periodo);
            return true;
        }).map(m => m.periodo);
    }, [months]);

    // ── Savers ─────────────────────────────────────────────────────────
    const saveMonth = useCallback(async (mData) => {
        const { transacciones = [], categorias = {}, cuotas_vigentes = [], id: _id, total_facturado, total_operaciones: _totalOps, ...rest } = mData;
        const payload = {
            ...rest,
            total_facturado, // CRÍTICO: Asegurarse de que total_facturado viaja a Supabase
            user_id: uid,
            categorias: JSON.stringify(categorias),
            cuotas_vigentes: JSON.stringify(cuotas_vigentes),
        };
        
        const { data: saved, error } = await supabase
            .from('months')
            .upsert(payload, { onConflict: 'account_id,periodo' })
            .select()
            .single();
        
        if (error || !saved) { 
            console.error('Error guardando mes en Supabase:', error);
            throw new Error(error?.message || 'Error guardando en base de datos. Operación abortada.');
        }

        // Contar temporales antes de eliminar
        const { count: tempCount = 0 } = await supabase.from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('month_id', saved.id)
            .eq('is_temporary', true);

        // Upsert transactions
        if (transacciones.length) {
            const { error: delTxErr } = await supabase.from('transactions').delete().eq('month_id', saved.id);
            if (delTxErr) {
                console.error('Error eliminando transacciones previas:', delTxErr);
                throw new Error('Error eliminando transacciones previas. El mes se guardó pero las transacciones no se actualizaron.');
            }
            const { error: insTxErr } = await supabase.from('transactions').insert(
                transacciones.map(({ id, es_cuota, cuota_actual, total_cuotas, ...t }) => ({ ...t, user_id: uid, month_id: saved.id }))
            );
            if (insTxErr) {
                console.error('Error insertando transacciones:', insTxErr);
                throw new Error('Error guardando transacciones. El mes se guardó pero las transacciones no.');
            }
        }

        const full = { ...saved, categorias, cuotas_vigentes, transacciones };
        setMonths(prev => {
            const next = [full, ...prev.filter(m => !(m.account_id === mData.account_id && m.periodo === mData.periodo))].slice(0, 18);
            return sortMonths(next);
        });
        return { tempCount: tempCount || 0 };
    }, [uid]);

    const saveTemporaryTransaction = useCallback(async ({ monto, account_id, categoria, descripcion }) => {
        const now = new Date();
        const periodo = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const fecha = `${dd}/${mm}/${now.getFullYear()}`;

        let month = monthsRef.current.find(m => m.account_id === account_id && m.periodo === periodo);

        if (!month) {
            const { data: saved, error } = await supabase.from('months')
                .upsert({
                    user_id: uid,
                    account_id,
                    periodo,
                    total_cargos: 0,
                    categorias: JSON.stringify({}),
                    cuotas_vigentes: JSON.stringify([]),
                }, { onConflict: 'account_id,periodo' })
                .select().single();
            if (error || !saved) throw new Error(error?.message || 'Error creando mes placeholder');
            month = { ...saved, categorias: {}, cuotas_vigentes: [], transacciones: [] };
            setMonths(prev => sortMonths([month, ...prev]));
        }

        const { data: tx, error: txErr } = await supabase.from('transactions').insert({
            user_id: uid,
            month_id: month.id,
            account_id,
            fecha,
            descripcion: descripcion || '',
            monto,
            categoria,
            tipo: 'cargo',
            is_temporary: true,
        }).select().single();
        if (txErr || !tx) throw new Error(txErr?.message || 'Error guardando transacción temporal');

        setMonths(prev => prev.map(m => {
            if (m.id !== month.id) return m;
            const transacciones = [...(m.transacciones || []), tx];
            const cats = { ...m.categorias };
            cats[categoria] = (cats[categoria] || 0) + monto;
            return { ...m, transacciones, categorias: cats, total_cargos: (m.total_cargos || 0) + monto };
        }));
    }, [uid]);

    const deleteTransaction = useCallback(async (txId, monthId) => {
        const { error } = await supabase.from('transactions').delete().eq('id', txId);
        if (error) throw new Error(error.message);

        setMonths(prev => prev.map(m => {
            if (m.id !== monthId) return m;
            const tx = (m.transacciones || []).find(t => t.id === txId);
            if (!tx) return m;
            const transacciones = m.transacciones.filter(t => t.id !== txId);
            const cats = { ...m.categorias };
            const cat = tx.categoria || 'otros';
            cats[cat] = Math.max(0, (cats[cat] || 0) - tx.monto);
            if (cats[cat] === 0) delete cats[cat];
            const total_cargos = Math.max(0, (m.total_cargos || 0) - tx.monto);
            return { ...m, transacciones, categorias: cats, total_cargos };
        }));
    }, []);

    const deleteMonth = useCallback(async (periodo, monthId = null) => {
        const toDelete = monthId
            ? months.filter(x => x.id === monthId)
            : months.filter(x => x.periodo === periodo);
        for (const m of toDelete) {
            const { error: txErr } = await supabase.from('transactions').delete().eq('month_id', m.id);
            if (txErr) throw new Error(`Error eliminando transacciones del mes: ${txErr.message}`);
            const { error: mErr } = await supabase.from('months').delete().eq('id', m.id);
            if (mErr) throw new Error(`Error eliminando mes: ${mErr.message}`);
        }

        // Limpiar filas CC de extra_income si ya no quedan meses para ese período
        const remainingMonths = monthId
            ? months.filter(x => x.id !== monthId)
            : months.filter(x => x.periodo !== periodo);
        const affectedPeriods = [...new Set(toDelete.map(m => m.periodo))];
        for (const p of affectedPeriods) {
            if (!remainingMonths.some(m => m.periodo === p)) {
                await supabase.from('extra_income')
                    .delete()
                    .eq('user_id', uid)
                    .eq('periodo', p)
                    .not('categoria_ingreso', 'is', null);
            }
        }

        setMonths(prev => monthId
            ? prev.filter(x => x.id !== monthId)
            : prev.filter(x => x.periodo !== periodo)
        );
        setEBM(prev => {
            const next = { ...prev };
            for (const p of affectedPeriods) {
                if (!remainingMonths.some(m => m.periodo === p) && next[p]) {
                    const manualOnly = next[p].filter(i => i.categoria_ingreso == null);
                    if (manualOnly.length === 0) delete next[p];
                    else next[p] = manualOnly;
                }
            }
            return next;
        });
    }, [months, uid]);

    const saveFixedItems = useCallback(async (periodo, items) => {
        const { error: delErr } = await supabase.from('fixed_expenses').delete().eq('user_id', uid).eq('periodo', periodo);
        if (delErr) throw new Error(`Error eliminando gastos fijos: ${delErr.message}`);
        if (items.length) {
            const { error: insErr } = await supabase.from('fixed_expenses').insert(items.map(i => ({ ...i, user_id: uid, periodo })));
            if (insErr) throw new Error(`Error guardando gastos fijos: ${insErr.message}`);
        }
        setFBM(prev => ({ ...prev, [periodo]: items }));
    }, [uid]);

    const saveIncome = useCallback(async (periodo, amount) => {
        const { error } = await supabase.from('income')
            .upsert({ user_id: uid, periodo, amount }, { onConflict: 'user_id,periodo' });
        if (error) throw new Error(`Error guardando ingreso: ${error.message}`);
        setIBM(prev => ({ ...prev, [periodo]: amount }));
    }, [uid]);

    const saveExtraItems = useCallback(async (periodo, items) => {
        const { error: delErr } = await supabase.from('extra_income').delete().eq('user_id', uid).eq('periodo', periodo);
        if (delErr) throw new Error(`Error eliminando ingresos extra: ${delErr.message}`);
        if (items.length) {
            const { error: insErr } = await supabase.from('extra_income').insert(items.map(i => ({ ...i, user_id: uid, periodo })));
            if (insErr) throw new Error(`Error guardando ingresos extra: ${insErr.message}`);
        }
        setEBM(prev => ({ ...prev, [periodo]: items }));
    }, [uid]);

    const saveBudget = useCallback(async (data) => {
        await supabase.from('budgets')
            .upsert({ ...data, user_id: uid, categories: JSON.stringify(data.categories) }, { onConflict: 'user_id' });
        setBudget(data);
    }, [uid]);

    const saveAccount = useCallback(async (data) => {
        const { data: saved, error } = await supabase
            .from('accounts')
            .upsert({ ...data, user_id: uid }, { onConflict: 'user_id,name' })
            .select().single();
        if (error) throw new Error(error.message);
        setAccounts(prev => [saved, ...prev.filter(a => a.id !== saved.id)]);
        return saved;
    }, [uid]);

    const updateAccount = useCallback(async (id, data) => {
        const { data: updated, error } = await supabase
            .from('accounts')
            .update(data)
            .eq('id', id)
            .eq('user_id', uid)
            .select().single();
        if (error) throw new Error(error.message);
        setAccounts(prev => prev.map(a => a.id === id ? updated : a));
        return updated;
    }, [uid]);

    const deleteIncomeCategory = useCallback(async (id) => {
        await supabase.from('income_categories').delete().eq('id', id).eq('user_id', uid);
        setIncomeCategories(prev => prev.filter(c => c.id !== id));
    }, [uid]);

    const saveIncomeCategory = useCallback(async ({ nombre, color }) => {
        const { data, error } = await supabase
            .from('income_categories')
            .upsert({ user_id: uid, nombre, color }, { onConflict: 'user_id,nombre' })
            .select().single();
        if (error) throw new Error(error.message);
        setIncomeCategories(prev => [data, ...prev.filter(c => c.id !== data.id)]);
        return data;
    }, [uid]);

    const saveIncomeItems = useCallback(async (periodo, items) => {
        // items: [{ name, amount, categoria_ingreso }]
        const rows = items.map(it => ({
            user_id: uid,
            periodo,
            name: it.name,
            amount: it.amount,
            categoria_ingreso: it.categoria_ingreso || 'otros',
        }));
        // Eliminar filas CC previas (tienen categoria_ingreso) antes de re-insertar
        // para evitar acumulación al subir el mismo período varias veces.
        // Las filas manuales (sin categoria_ingreso, del Fixed page) se preservan.
        await supabase.from('extra_income')
            .delete()
            .eq('user_id', uid)
            .eq('periodo', periodo)
            .not('categoria_ingreso', 'is', null);
        const { data, error } = await supabase.from('extra_income').insert(rows).select();
        if (error) throw new Error(error.message);
        setEBM(prev => {
            const next = { ...prev };
            const manualItems = (next[periodo] || []).filter(i => i.categoria_ingreso == null);
            next[periodo] = [...manualItems, ...(data || rows)];
            return next;
        });
    }, [uid]);

    const saveCatRule = useCallback(async (desc, cat) => {
        const key = (desc || '').toLowerCase().trim();
        if (!key) return;
        await supabase.from('category_rules')
            .upsert({ user_id: uid, description_key: key, categoria: cat }, { onConflict: 'user_id,description_key' });
        setCatRules(prev => ({ ...prev, [key]: cat }));
    }, [uid]);

    const deleteCatRule = useCallback(async (key) => {
        await supabase.from('category_rules').delete().eq('user_id', uid).eq('description_key', key);
        setCatRules(prev => { const n = { ...prev }; delete n[key]; return n; });
    }, [uid]);

    const saveCustomCat = useCallback(async (id, data) => {
        await supabase.from('custom_categories')
            .upsert({ user_id: uid, cat_id: id, ...data }, { onConflict: 'user_id,cat_id' });
        setCustomCats(prev => ({ ...prev, [id]: data }));
    }, [uid]);

    const deleteCustomCat = useCallback(async (id) => {
        await supabase.from('custom_categories').delete().eq('user_id', uid).eq('cat_id', id);
        setCustomCats(prev => { const n = { ...prev }; delete n[id]; return n; });
    }, [uid]);

    const recategorizeMonth = useCallback(async (periodo, txId, newCat, txDesc) => {
        const current = monthsRef.current;
        const ruleKey = (txDesc || '').toLowerCase().trim();
        if (!ruleKey) return;

        await saveCatRule(txDesc, newCat);

        const newMonths = current.map(mon => {
            const txs = mon.transacciones || [];
            // Solo aplica la regla a cargos: los abonos no son gastos y no deben recategorizarse
            const hasMatch = txs.some(t =>
                (t.descripcion || '').toLowerCase().trim() === ruleKey &&
                t.tipo === 'cargo' &&
                t.categoria !== newCat
            );
            if (!hasMatch) return mon;
            const updatedTxs = txs.map(t =>
                (t.descripcion || '').toLowerCase().trim() === ruleKey && t.tipo === 'cargo'
                    ? { ...t, categoria: newCat } : t
            );
            const cats = {}; let total = 0;
            updatedTxs.forEach(t => {
                const k = t.categoria || 'otros';
                cats[k] = (cats[k] || 0) + t.monto;
                if (t.tipo === 'cargo' && k !== 'traspaso_tc') total += t.monto;
            });
            return { ...mon, transacciones: updatedTxs, categorias: cats, total_cargos: total };
        });
        setMonths(newMonths);

        // Persist categorias update solo en meses que realmente cambiaron
        await Promise.all(newMonths.map(mon => {
            const txs = mon.transacciones || [];
            const hasMatch = txs.some(t =>
                (t.descripcion || '').toLowerCase().trim() === ruleKey && t.tipo === 'cargo'
            );
            if (!hasMatch) return Promise.resolve();
            return supabase.from('months')
                .update({ categorias: JSON.stringify(mon.categorias), total_cargos: mon.total_cargos })
                .eq('id', mon.id);
        }));

        // Batch update de transacciones: una sola llamada en vez de N
        const txIdsToUpdate = newMonths
            .flatMap(m => m.transacciones)
            .filter(t =>
                (t.descripcion || '').toLowerCase().trim() === ruleKey &&
                t.tipo === 'cargo' &&
                t.id
            )
            .map(t => t.id);

        if (txIdsToUpdate.length) {
            await supabase.from('transactions')
                .update({ categoria: newCat })
                .in('id', txIdsToUpdate);
        }
    }, [saveCatRule, uid]);

    return {
        months, sorted, uniqueSortedPeriods, accounts, incomeCategories,
        fixedByMonth, incomeByMonth, extraByMonth,
        budget, catRules, customCats, allCats, ready,
        setMonths,
        saveMonth, deleteMonth, saveAccount, updateAccount,
        saveFixedItems, saveIncome, saveExtraItems,
        saveIncomeCategory, deleteIncomeCategory, saveIncomeItems,
        saveBudget, saveCatRule, deleteCatRule, saveCustomCat, deleteCustomCat, recategorizeMonth,
        saveTemporaryTransaction, deleteTransaction,
    };
}
