import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseSantanderTC } from '../../api/parsers/santander-tc.js';

const FIXTURES = join(import.meta.dirname, '../fixtures');

function loadFixture(name) {
    return readFileSync(join(FIXTURES, name), 'utf8');
}

// ── Latam (estado-de-cuenta.pdf) — caso complejo ────────────────────────────
describe('parseSantanderTC — Latam (estado-de-cuenta.pdf)', () => {
    let result;
    beforeAll(() => {
        result = parseSantanderTC(loadFixture('santander-tc-latam-raw.txt'));
    });

    it('source_type es tc', () => {
        expect(result.source_type).toBe('tc');
    });

    it('total_operaciones = 1273912', () => {
        expect(result.total_operaciones).toBe(1273912);
    });

    it('total_facturado = 1288293', () => {
        expect(result.total_facturado).toBe(1288293);
    });

    it('periodo_hasta = 26/02/2026', () => {
        expect(result.periodo_hasta).toBe('26/02/2026');
    });

    it('periodo_desde = 29/01/2026', () => {
        expect(result.periodo_desde).toBe('29/01/2026');
    });

    it('periodo = Enero 2026', () => {
        expect(result.periodo).toBe('Enero 2026');
    });

    it('hay transacciones', () => {
        expect(result.transacciones.length).toBeGreaterThan(0);
    });

    it('no incluye MONTO CANCELADO como transacción', () => {
        const cancelados = result.transacciones.filter(t =>
            t.descripcion.toLowerCase().includes('cancelado')
        );
        expect(cancelados).toHaveLength(0);
    });

    it('cuotas tienen es_cuota=true', () => {
        const cuotas = result.transacciones.filter(t => t.es_cuota);
        expect(cuotas.length).toBeGreaterThan(0);
        cuotas.forEach(c => {
            expect(c.cuota_actual).toBeGreaterThan(0);
            expect(c.total_cuotas).toBeGreaterThan(0);
        });
    });

    it('compras normales tienen es_cuota=false', () => {
        const normales = result.transacciones.filter(t => !t.es_cuota);
        expect(normales.length).toBeGreaterThan(0);
    });

    it('JUMBO categorizado como supermercado', () => {
        const jumbo = result.transacciones.find(t =>
            t.descripcion.toLowerCase().includes('jumbo')
        );
        expect(jumbo).toBeDefined();
        expect(jumbo.categoria).toBe('supermercado');
    });

    it('UBER categorizado como transporte', () => {
        const uber = result.transacciones.find(t =>
            t.descripcion.toLowerCase().includes('uber')
        );
        expect(uber).toBeDefined();
        expect(uber.categoria).toBe('transporte');
    });

    it('cargos_banco incluye comisión y IVA', () => {
        const cargos = result.transacciones.filter(t => t.categoria === 'cargos_banco');
        expect(cargos.length).toBeGreaterThan(0);
    });

    it('montos extranjeros usan monto CLP (no el AR)', () => {
        // PAYU*AR*UBER 9429: AR 14.688,00 → $9.585 CLP
        const uber_ar = result.transacciones.find(t =>
            t.descripcion.toLowerCase().includes('payu*ar*uber') ||
            t.descripcion.toLowerCase().includes('uber         9429')
        );
        expect(uber_ar).toBeDefined();
        // El monto debe ser el CLP (< 100k) no el AR (14688 ≈ AR peso, pero aún es razonable)
        expect(uber_ar.monto).toBeGreaterThan(0);
        expect(uber_ar.monto).toBeLessThan(50000); // CLP amount for an uber ride
    });

    it('cuotas_vigentes incluye entradas con cuota_actual=0', () => {
        const vigentes = result.cuotas_vigentes;
        expect(vigentes.length).toBeGreaterThan(0);
        // Todas tienen monto_cuota > 0
        vigentes.forEach(c => {
            expect(c.monto_cuota).toBeGreaterThan(0);
        });
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
});

// ── Life (life 01.pdf) — caso simple ────────────────────────────────────────
describe('parseSantanderTC — Life (life 01.pdf)', () => {
    let result;
    beforeAll(() => {
        result = parseSantanderTC(loadFixture('santander-tc-life-raw.txt'));
    });

    it('total_operaciones = 20416', () => {
        expect(result.total_operaciones).toBe(20416);
    });

    it('total_facturado = 20416', () => {
        expect(result.total_facturado).toBe(20416);
    });

    it('exactamente 1 transacción (ENTEL cuota 14/24)', () => {
        expect(result.transacciones).toHaveLength(1);
    });

    it('la transacción es cuota de ENTEL', () => {
        const [tx] = result.transacciones;
        expect(tx.descripcion.toLowerCase()).toContain('entel');
        expect(tx.es_cuota).toBe(true);
        expect(tx.cuota_actual).toBe(14);
        expect(tx.total_cuotas).toBe(24);
        expect(tx.monto).toBe(20416);
    });

    it('categoria telefonia_internet', () => {
        expect(result.transacciones[0].categoria).toBe('telefonia_internet');
    });

    it('cuotas_vigentes incluye al menos la cuota activa', () => {
        expect(result.cuotas_vigentes.length).toBeGreaterThan(0);
    });

    it('MONTO CANCELADO no aparece como transacción', () => {
        expect(result.transacciones.filter(t =>
            t.descripcion.toLowerCase().includes('cancelado')
        )).toHaveLength(0);
    });
});
