import { describe, it, expect } from 'vitest';
import {
    getMonthSalary,
    getMonthExtraTotal,
    getMonthIncome,
    getMonthFixedTotal,
    getCCAbonos,
    pct,
} from '../src/utils/calculations.js';

// ── getMonthIncome — lógica de fallback ────────────────────────────────────
describe('getMonthIncome', () => {
    const DEF = 3_257_347; // defaultIncome del budget

    it('usa defaultIncome cuando no hay salary ni extras', () => {
        expect(getMonthIncome('2026-02', {}, {}, DEF)).toBe(DEF);
    });

    it('NO usa defaultIncome cuando hay items en extraByMonth (abonos CC)', () => {
        const ebm = { '2026-02': [{ amount: 1_564_258, categoria_ingreso: 'sueldo' }] };
        expect(getMonthIncome('2026-02', {}, ebm, DEF)).toBe(1_564_258);
    });

    it('NO duplica defaultIncome + extras — bug original', () => {
        // Bug anterior: 3_257_347 + 1_564_258 = 4_821_605
        const ebm = { '2026-02': [{ amount: 1_564_258, categoria_ingreso: 'sueldo' }] };
        expect(getMonthIncome('2026-02', {}, ebm, DEF)).not.toBe(DEF + 1_564_258);
    });

    it('usa salary explícito cuando está seteado en incomeByMonth', () => {
        const ibm = { '2026-02': 2_000_000 };
        expect(getMonthIncome('2026-02', ibm, {}, DEF)).toBe(2_000_000);
    });

    it('suma salary explícito + extras correctamente', () => {
        const ibm = { '2026-02': 2_000_000 };
        const ebm = { '2026-02': [{ amount: 500_000, categoria_ingreso: 'freelance' }] };
        expect(getMonthIncome('2026-02', ibm, ebm, DEF)).toBe(2_500_000);
    });

    it('suma múltiples extras del mismo período', () => {
        const ebm = {
            '2026-02': [
                { amount: 1_000_000, categoria_ingreso: 'sueldo' },
                { amount: 200_000, categoria_ingreso: 'freelance' },
            ],
        };
        expect(getMonthIncome('2026-02', {}, ebm, DEF)).toBe(1_200_000);
    });

    it('devuelve 0 si salary explícito es 0 y sin extras', () => {
        const ibm = { '2026-02': 0 };
        expect(getMonthIncome('2026-02', ibm, {}, DEF)).toBe(0);
    });

    it('período diferente no interfiere', () => {
        const ebm = { '2026-01': [{ amount: 999_999, categoria_ingreso: 'sueldo' }] };
        // 2026-02 no tiene extras → debe usar defaultIncome
        expect(getMonthIncome('2026-02', {}, ebm, DEF)).toBe(DEF);
    });
});

// ── getMonthSalary ─────────────────────────────────────────────────────────
describe('getMonthSalary', () => {
    it('retorna el valor de incomeByMonth si existe', () => {
        expect(getMonthSalary('2026-02', { '2026-02': 1_500_000 }, 999)).toBe(1_500_000);
    });

    it('retorna defaultIncome si el período no está en incomeByMonth', () => {
        expect(getMonthSalary('2026-02', {}, 999)).toBe(999);
    });

    it('retorna el valor aunque sea 0 (no cae a default)', () => {
        expect(getMonthSalary('2026-02', { '2026-02': 0 }, 999)).toBe(0);
    });
});

// ── getMonthExtraTotal ─────────────────────────────────────────────────────
describe('getMonthExtraTotal', () => {
    it('suma los montos de los extras', () => {
        const ebm = { '2026-02': [{ amount: 100 }, { amount: 200 }] };
        expect(getMonthExtraTotal('2026-02', ebm)).toBe(300);
    });

    it('retorna 0 si no hay extras para el período', () => {
        expect(getMonthExtraTotal('2026-02', {})).toBe(0);
    });

    it('ignora valores no numéricos', () => {
        const ebm = { '2026-02': [{ amount: '100' }, { amount: null }, { amount: 50 }] };
        expect(getMonthExtraTotal('2026-02', ebm)).toBe(150);
    });

    it('no duplica al subir 2 períodos distintos', () => {
        const ebm = {
            '2026-01': [{ amount: 500_000 }],
            '2026-02': [{ amount: 1_000_000 }],
        };
        expect(getMonthExtraTotal('2026-02', ebm)).toBe(1_000_000);
    });
});

// ── getMonthFixedTotal ────────────────────────────────────────────────────
describe('getMonthFixedTotal', () => {
    it('suma los montos fijos', () => {
        const fbm = { '2026-02': [{ amount: 50_000 }, { amount: 30_000 }] };
        expect(getMonthFixedTotal('2026-02', fbm)).toBe(80_000);
    });

    it('retorna 0 si no hay fijos', () => {
        expect(getMonthFixedTotal('2026-02', {})).toBe(0);
    });
});

// ── pct ───────────────────────────────────────────────────────────────────
describe('pct', () => {
    it('calcula porcentaje correctamente', () => {
        expect(pct(25, 100)).toBe(25);
    });

    it('limita a 100', () => {
        expect(pct(200, 100)).toBe(100);
    });

    it('retorna 0 si base es 0', () => {
        expect(pct(50, 0)).toBe(0);
    });
});

// ── Escenario de regresión: bug $6.385.863 ────────────────────────────────
describe('Regresión: INGRESO inflado con 2 PDFs del mismo período', () => {
    const DEF = 3_257_347;

    it('TC + CC mismo período: income = solo extras CC (sin defaultIncome encima)', () => {
        // CC abonos guardados
        const ebm = { '2026-02': [{ amount: 1_564_258, categoria_ingreso: 'sueldo' }] };
        // No hay salary explícito
        const ibm = {};
        const income = getMonthIncome('2026-02', ibm, ebm, DEF);
        expect(income).toBe(1_564_258);
        expect(income).not.toBe(DEF + 1_564_258); // 4_821_605 — bug original
        expect(income).not.toBe(DEF + 1_564_258 * 2); // 6_385_863 — bug duplicado
    });

    it('extras duplicados (subido 2 veces) deben ser imposibles tras fix de saveIncomeItems', () => {
        const ebm = { '2026-02': [{ amount: 1_564_258, categoria_ingreso: 'sueldo' }] };
        expect(getMonthExtraTotal('2026-02', ebm)).toBe(1_564_258);
    });
});

// ── Regresión: bug $3.257.347 (defaultIncome fallback por falta de auto-save) ─
describe('Regresión: auto-save CC abonos con categoria_ingreso "otros"', () => {
    const DEF = 3_257_347;

    it('abonos auto-guardados con categoria "otros" producen income correcto', () => {
        // Simulando auto-save: items con categoria_ingreso = 'otros'
        const ebm = {
            '2026-02': [
                { amount: 800_000, categoria_ingreso: 'otros' },
                { amount: 764_258, categoria_ingreso: 'otros' },
            ],
        };
        expect(getMonthIncome('2026-02', {}, ebm, DEF)).toBe(1_564_258);
    });

    it('abonos auto-guardados evitan caer a defaultIncome', () => {
        const ebm = { '2026-02': [{ amount: 100, categoria_ingreso: 'otros' }] };
        expect(getMonthIncome('2026-02', {}, ebm, DEF)).toBe(100);
        expect(getMonthIncome('2026-02', {}, ebm, DEF)).not.toBe(DEF);
    });

    it('re-categorización reemplaza "otros" — income sigue correcto', () => {
        // Después de que el usuario re-categoriza, los items tienen categorías reales
        const ebm = {
            '2026-02': [
                { amount: 800_000, categoria_ingreso: 'sueldo' },
                { amount: 764_258, categoria_ingreso: 'freelance' },
            ],
        };
        expect(getMonthIncome('2026-02', {}, ebm, DEF)).toBe(1_564_258);
    });

    it('mezcla de extras manuales (sin cat) + CC auto-saved (con cat) suman correctamente', () => {
        const ebm = {
            '2026-02': [
                { amount: 100_000 },                                    // manual (Fixed page)
                { amount: 1_564_258, categoria_ingreso: 'sueldo' },     // CC auto-saved
            ],
        };
        expect(getMonthIncome('2026-02', {}, ebm, DEF)).toBe(1_664_258);
    });
});

// ── getCCAbonos — extraer ingreso desde transacciones CC ──────────────────
describe('getCCAbonos', () => {
    const ccMonth = (periodo, txs) => ({
        periodo,
        source_type: 'cc',
        transacciones: txs,
    });

    it('suma abonos CC del período', () => {
        const months = [ccMonth('2026-02', [
            { tipo: 'abono', categoria: 'transferencia_recibida', monto: 800_000 },
            { tipo: 'abono', categoria: 'transferencia_recibida', monto: 764_258 },
        ])];
        expect(getCCAbonos('2026-02', months)).toBe(1_564_258);
    });

    it('excluye traspaso_tc de los abonos', () => {
        const months = [ccMonth('2026-02', [
            { tipo: 'abono', categoria: 'transferencia_recibida', monto: 1_000_000 },
            { tipo: 'abono', categoria: 'traspaso_tc', monto: 500_000 },
        ])];
        expect(getCCAbonos('2026-02', months)).toBe(1_000_000);
    });

    it('excluye cargos', () => {
        const months = [ccMonth('2026-02', [
            { tipo: 'abono', categoria: 'transferencia_recibida', monto: 1_000_000 },
            { tipo: 'cargo', categoria: 'alimentacion', monto: 200_000 },
        ])];
        expect(getCCAbonos('2026-02', months)).toBe(1_000_000);
    });

    it('funciona sin source_type (meses legacy sin multi-account)', () => {
        const months = [{
            periodo: '2026-02',
            transacciones: [{ tipo: 'abono', categoria: 'transferencia_recibida', monto: 999 }],
        }];
        expect(getCCAbonos('2026-02', months)).toBe(999);
    });

    it('ignora abonos que no son transferencia_recibida', () => {
        const months = [{
            periodo: '2026-02',
            source_type: 'tc',
            transacciones: [{ tipo: 'abono', categoria: 'pago_cuota', monto: 500_000 }],
        }];
        expect(getCCAbonos('2026-02', months)).toBe(0);
    });

    it('retorna 0 si no hay meses CC para el período', () => {
        expect(getCCAbonos('2026-02', [])).toBe(0);
    });

    it('retorna 0 si no hay transacciones', () => {
        const months = [ccMonth('2026-02', [])];
        expect(getCCAbonos('2026-02', months)).toBe(0);
    });

    it('solo considera el período solicitado', () => {
        const months = [
            ccMonth('2026-01', [{ tipo: 'abono', categoria: 'transferencia_recibida', monto: 500_000 }]),
            ccMonth('2026-02', [{ tipo: 'abono', categoria: 'transferencia_recibida', monto: 1_000_000 }]),
        ];
        expect(getCCAbonos('2026-02', months)).toBe(1_000_000);
    });
});

// ── getMonthIncome con CC fallback (5to parámetro) ────────────────────────
describe('getMonthIncome con CC abonos como fallback', () => {
    const DEF = 3_257_347;
    const ccMonth = (periodo, txs) => ({
        periodo,
        source_type: 'cc',
        transacciones: txs,
    });

    it('usa CC abonos cuando no hay salary ni extras', () => {
        const months = [ccMonth('2026-02', [
            { tipo: 'abono', categoria: 'transferencia_recibida', monto: 800_000 },
            { tipo: 'abono', categoria: 'transferencia_recibida', monto: 764_258 },
        ])];
        expect(getMonthIncome('2026-02', {}, {}, DEF, months)).toBe(1_564_258);
    });

    it('NO cae a defaultIncome cuando hay CC abonos', () => {
        const months = [ccMonth('2026-02', [
            { tipo: 'abono', categoria: 'transferencia_recibida', monto: 1_564_258 },
        ])];
        const income = getMonthIncome('2026-02', {}, {}, DEF, months);
        expect(income).toBe(1_564_258);
        expect(income).not.toBe(DEF);
    });

    it('prioriza salary explícito sobre CC abonos', () => {
        const months = [ccMonth('2026-02', [
            { tipo: 'abono', categoria: 'transferencia_recibida', monto: 1_564_258 },
        ])];
        const ibm = { '2026-02': 2_000_000 };
        expect(getMonthIncome('2026-02', ibm, {}, DEF, months)).toBe(2_000_000);
    });

    it('prioriza extra_income sobre CC abonos', () => {
        const months = [ccMonth('2026-02', [
            { tipo: 'abono', categoria: 'transferencia_recibida', monto: 1_564_258 },
        ])];
        const ebm = { '2026-02': [{ amount: 900_000, categoria_ingreso: 'sueldo' }] };
        expect(getMonthIncome('2026-02', {}, ebm, DEF, months)).toBe(900_000);
    });

    it('salary + extras tiene prioridad sobre CC abonos', () => {
        const months = [ccMonth('2026-02', [
            { tipo: 'abono', categoria: 'transferencia_recibida', monto: 1_564_258 },
        ])];
        const ibm = { '2026-02': 1_000_000 };
        const ebm = { '2026-02': [{ amount: 200_000, categoria_ingreso: 'bonus' }] };
        expect(getMonthIncome('2026-02', ibm, ebm, DEF, months)).toBe(1_200_000);
    });

    it('cae a defaultIncome si no hay CC abonos ni extras ni salary', () => {
        expect(getMonthIncome('2026-02', {}, {}, DEF, [])).toBe(DEF);
    });

    it('backward compatible: sin 5to parámetro cae a defaultIncome', () => {
        expect(getMonthIncome('2026-02', {}, {}, DEF)).toBe(DEF);
    });
});

// ── Regresión FINAL: bug $3.257.347 (datos existentes sin extra_income) ───
describe('Regresión: $3.257.347 — CC abonos en transactions resuelven el fallback', () => {
    const DEF = 3_257_347;

    it('escenario exacto del bug: extra_income vacío + CC transactions con abonos', () => {
        const months = [{
            periodo: '2026-02',
            source_type: 'cc',
            transacciones: [
                { tipo: 'abono', categoria: 'transferencia_recibida', monto: 800_000 },
                { tipo: 'abono', categoria: 'transferencia_recibida', monto: 764_258 },
                { tipo: 'cargo', categoria: 'alimentacion', monto: 150_000 },
            ],
        }];
        const ibm = {};
        const ebm = {};
        const income = getMonthIncome('2026-02', ibm, ebm, DEF, months);
        expect(income).toBe(1_564_258);
        expect(income).not.toBe(DEF); // NO debe mostrar $3,257,347
    });

    it('BUG REAL: mes con source_type="tc" (default DB) pero CON transferencias_recibidas', () => {
        const months = [{
            periodo: '2026-02',
            source_type: 'tc',  // ← default de Supabase, incluso para CC legacy
            transacciones: [
                { tipo: 'abono', categoria: 'transferencia_recibida', monto: 800_000 },
                { tipo: 'abono', categoria: 'transferencia_recibida', monto: 764_258 },
                { tipo: 'cargo', categoria: 'alimentacion', monto: 150_000 },
            ],
        }];
        const income = getMonthIncome('2026-02', {}, {}, DEF, months);
        expect(income).toBe(1_564_258);
        expect(income).not.toBe(DEF);
    });

    it('BUG REAL: mes SIN source_type (undefined) pero CON transferencias_recibidas', () => {
        const months = [{
            periodo: '2026-02',
            // sin source_type — simula mes legacy
            transacciones: [
                { tipo: 'abono', categoria: 'transferencia_recibida', monto: 1_564_258 },
            ],
        }];
        const income = getMonthIncome('2026-02', {}, {}, DEF, months);
        expect(income).toBe(1_564_258);
        expect(income).not.toBe(DEF);
    });
});
