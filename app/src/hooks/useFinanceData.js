import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { sortMonths } from '../utils/formatters';
import { DEF_BUDGET, CAT } from '../lib/constants';

const parseJ = (v, fallback) => { try { return v ? JSON.parse(v) : fallback; } catch { return fallback; } };

export function useFinanceData() {
    const { user } = useAuth();
    const uid = user?.id;

    const [months, setMonths] = useState([]);
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

        // Upsert transactions
        if (transacciones.length) {
            try {
                await supabase.from('transactions').delete().eq('month_id', saved.id);
                // Strip the fake local text ID so Supabase uses gen_random_uuid
                await supabase.from('transactions').insert(
                    transacciones.map(({ id, es_cuota, cuota_actual, total_cuotas, ...t }) => ({ ...t, user_id: uid, month_id: saved.id }))
                );
            } catch (err) {
                console.warn('⚠️ No se pudieron persistir transacciones en Supabase.', err);
            }
        }

        const full = { ...saved, categorias, cuotas_vigentes, transacciones };
        setMonths(prev => {
            const next = [full, ...prev.filter(m => !(m.account_id === mData.account_id && m.periodo === mData.periodo))].slice(0, 18);
            return sortMonths(next);
        });
    }, [uid]);

    const deleteMonth = useCallback(async (periodo) => {
        const toDelete = months.filter(x => x.periodo === periodo);
        for (const m of toDelete) {
            await supabase.from('transactions').delete().eq('month_id', m.id);
            await supabase.from('months').delete().eq('id', m.id);
        }
        setMonths(prev => prev.filter(x => x.periodo !== periodo));
    }, [months]);

    const saveFixedItems = useCallback(async (periodo, items) => {
        await supabase.from('fixed_expenses').delete().eq('user_id', uid).eq('periodo', periodo);
        if (items.length) {
            await supabase.from('fixed_expenses').insert(items.map(i => ({ ...i, user_id: uid, periodo })));
        }
        setFBM(prev => ({ ...prev, [periodo]: items }));
    }, [uid]);

    const saveIncome = useCallback(async (periodo, amount) => {
        await supabase.from('income')
            .upsert({ user_id: uid, periodo, amount }, { onConflict: 'user_id,periodo' });
        setIBM(prev => ({ ...prev, [periodo]: amount }));
    }, [uid]);

    const saveExtraItems = useCallback(async (periodo, items) => {
        await supabase.from('extra_income').delete().eq('user_id', uid).eq('periodo', periodo);
        if (items.length) {
            await supabase.from('extra_income').insert(items.map(i => ({ ...i, user_id: uid, periodo })));
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
            id: `inc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            user_id: uid,
            periodo,
            name: it.name,
            amount: it.amount,
            categoria_ingreso: it.categoria_ingreso || 'otros',
        }));
        const { error } = await supabase.from('extra_income').insert(rows);
        if (error) throw new Error(error.message);
        setEBM(prev => {
            const next = { ...prev };
            next[periodo] = [...(next[periodo] || []), ...rows];
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

    const saveCustomCat = useCallback(async (id, data) => {
        await supabase.from('custom_categories')
            .upsert({ user_id: uid, cat_id: id, ...data }, { onConflict: 'user_id,cat_id' });
        setCustomCats(prev => ({ ...prev, [id]: data }));
    }, [uid]);

    const deleteCustomCat = useCallback(async (id) => {
        await supabase.from('custom_categories').delete().eq('user_id', uid).eq('cat_id', id);
        setCustomCats(prev => { const n = { ...prev }; delete n[id]; return n; });
    }, [uid]);

    const recategorizeMonth = useCallback(async (periodo, txId, newCat) => {
        const m = months.find(x => x.periodo === periodo);
        if (!m) return;
        const tx = (m.transacciones || []).find(t => t.id === txId);
        if (!tx) return;
        const ruleKey = (tx.descripcion || '').toLowerCase().trim();

        await saveCatRule(tx.descripcion, newCat);

        const newMonths = months.map(mon => {
            const txs = mon.transacciones || [];
            const hasMatch = txs.some(t => (t.descripcion || '').toLowerCase().trim() === ruleKey && t.categoria !== newCat);
            if (!hasMatch) return mon;
            const updatedTxs = txs.map(t =>
                (t.descripcion || '').toLowerCase().trim() === ruleKey ? { ...t, categoria: newCat } : t
            );
            const cats = {}; let total = 0;
            updatedTxs.forEach(t => {
                const k = t.categoria || 'otros';
                cats[k] = (cats[k] || 0) + t.monto;
                if (t.tipo === 'cargo' && k !== 'traspaso_tc' && k !== 'cargos_banco') total += t.monto;
            });
            return { ...mon, transacciones: updatedTxs, categorias: cats, total_cargos: total };
        });
        setMonths(newMonths);

        // Persist categorias update for ALL affected months in Supabase
        await Promise.all(newMonths.map(mon => {
            const txs = mon.transacciones || [];
            const hasMatch = txs.some(t => (t.descripcion || '').toLowerCase().trim() === ruleKey);
            if (!hasMatch) return Promise.resolve();
            
            return supabase.from('months')
                .update({ categorias: JSON.stringify(mon.categorias), total_cargos: mon.total_cargos })
                .eq('id', mon.id);
        }));

        // Update all related transactions across all months
        const allTransactionsToUpdate = newMonths.flatMap(m => m.transacciones)
            .filter(t => (t.descripcion || '').toLowerCase().trim() === ruleKey);
            
        await Promise.all(allTransactionsToUpdate.map(t =>
            supabase.from('transactions').update({ categoria: newCat }).eq('id', t.id)
        ));
    }, [months, saveCatRule, uid]);

    return {
        months, sorted, uniqueSortedPeriods, accounts, incomeCategories,
        fixedByMonth, incomeByMonth, extraByMonth,
        budget, catRules, customCats, allCats, ready,
        setMonths,
        saveMonth, deleteMonth, saveAccount,
        saveFixedItems, saveIncome, saveExtraItems,
        saveIncomeCategory, deleteIncomeCategory, saveIncomeItems,
        saveBudget, saveCatRule, saveCustomCat, deleteCustomCat, recategorizeMonth,
    };
}
