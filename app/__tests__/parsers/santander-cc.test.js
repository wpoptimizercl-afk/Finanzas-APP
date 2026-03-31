import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseSantanderCC } from '../../api/parsers/santander-cc.js';

const FIXTURES = join(import.meta.dirname, '../fixtures');

function loadFixture(name) {
    return readFileSync(join(FIXTURES, name), 'utf8');
}

// ── Cartola-71 (28/11/2025 → 30/12/2025) ────────────────────────────────────
describe('parseSantanderCC — cartola-71', () => {
    let result;
    beforeAll(() => {
        result = parseSantanderCC(loadFixture('santander-cc-raw.txt'));
    });

    it('source_type es cc', () => {
        expect(result.source_type).toBe('cc');
    });

    it('periodo_desde = 28/11/2025', () => {
        expect(result.periodo_desde).toBe('28/11/2025');
    });

    it('periodo_hasta = 30/12/2025', () => {
        expect(result.periodo_hasta).toBe('30/12/2025');
    });

    it('saldo_inicial = 7641', () => {
        expect(result.saldo_inicial).toBe(7641);
    });

    it('saldo_final = 32265', () => {
        expect(result.saldo_final).toBe(32265);
    });

    it('hay transacciones', () => {
        expect(result.transacciones.length).toBeGreaterThan(0);
    });

    it('todos los montos son positivos', () => {
        result.transacciones.forEach(t => {
            expect(t.monto).toBeGreaterThan(0);
        });
    });

    it('todas las fechas tienen formato DD/MM/YYYY', () => {
        result.transacciones.forEach(t => {
            expect(t.fecha).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
        });
    });

    it('Traspaso a T. Crédito es cargo y traspaso_tc', () => {
        const traspaso = result.transacciones.find(t =>
            t.descripcion.toLowerCase().includes('traspaso')
        );
        expect(traspaso).toBeDefined();
        expect(traspaso.tipo).toBe('cargo');
        expect(traspaso.categoria).toBe('traspaso_tc');
    });

    it('Transf. COMERCIALIZADORA es abono y transferencia_recibida', () => {
        const tf = result.transacciones.find(t =>
            t.descripcion.toLowerCase().includes('comercializadora')
        );
        expect(tf).toBeDefined();
        expect(tf.tipo).toBe('abono');
        expect(tf.categoria).toBe('transferencia_recibida');
    });

    it('Transf a KHIPU es cargo y transferencia_enviada', () => {
        const tf = result.transacciones.find(t =>
            t.descripcion.toLowerCase().includes('transf a khipu')
        );
        expect(tf).toBeDefined();
        expect(tf.tipo).toBe('cargo');
        expect(tf.categoria).toBe('transferencia_enviada');
    });

    it('COM.MANTENCION PLAN es cargo y cargos_banco', () => {
        const com = result.transacciones.find(t =>
            t.descripcion.toLowerCase().includes('mantencion') ||
            t.descripcion.toLowerCase().includes('mantención')
        );
        expect(com).toBeDefined();
        expect(com.tipo).toBe('cargo');
        expect(com.categoria).toBe('cargos_banco');
    });

    it('PAGO EN LINEA SERVIPAG es cargo y pago_servicios', () => {
        const pago = result.transacciones.find(t =>
            t.descripcion.toLowerCase().includes('servipag')
        );
        expect(pago).toBeDefined();
        expect(pago.tipo).toBe('cargo');
        expect(pago.categoria).toBe('pago_servicios');
    });

    it('RECUP COM PLAN es abono', () => {
        const recup = result.transacciones.find(t =>
            t.descripcion.toLowerCase().includes('recup com')
        );
        expect(recup).toBeDefined();
        expect(recup.tipo).toBe('abono');
    });

    it('DCTO10 (0779537005) no aparece como descripción', () => {
        result.transacciones.forEach(t => {
            expect(t.descripcion).not.toMatch(/^\d{10}/);
        });
    });

    it('DCTO56 (600215) no aparece como descripción independiente', () => {
        result.transacciones.forEach(t => {
            expect(t.descripcion).not.toMatch(/^\d{5,6}$/);
        });
    });

    it('cuotas_vigentes está vacío (CC no tiene cuotas)', () => {
        expect(result.cuotas_vigentes).toHaveLength(0);
    });
});

// ── Cartola-72 (30/12/2025 → 30/01/2026) ────────────────────────────────────
describe('parseSantanderCC — cartola-72', () => {
    let result;
    beforeAll(() => {
        result = parseSantanderCC(loadFixture('santander-cc-72-raw.txt'));
    });

    it('saldo_inicial = 32265 (= saldo_final de cartola-71)', () => {
        expect(result.saldo_inicial).toBe(32265);
    });

    it('saldo_final = 1404', () => {
        expect(result.saldo_final).toBe(1404);
    });

    it('periodo_desde = 30/12/2025', () => {
        expect(result.periodo_desde).toBe('30/12/2025');
    });
});

// ── Cartola-73 (30/01/2026 → 27/02/2026) ────────────────────────────────────
describe('parseSantanderCC — cartola-73', () => {
    let result;
    beforeAll(() => {
        result = parseSantanderCC(loadFixture('santander-cc-73-raw.txt'));
    });

    it('saldo_inicial = 1404 (= saldo_final de cartola-72)', () => {
        expect(result.saldo_inicial).toBe(1404);
    });

    it('saldo_final = 1801', () => {
        expect(result.saldo_final).toBe(1801);
    });
});
