/**
 * Unit tests para buildMonthData() — lógica de categorización post-AI
 *
 * Regressions que estos tests previenen:
 *   BUG-01: comision_banco se suma a totalCargos (debe excluirse igual que traspaso_tc)
 *   BUG-02: abonos CC se acumulan en categorias mezclados con gastos (distorsiona el desglose)
 *   BUG-03: catRules sobreescribe categorías protegidas (traspaso_tc, comision_banco)
 */

import { describe, it, expect } from 'vitest';
import { buildMonthData } from '../src/utils/buildMonthData.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_PARSED_TC = {
  periodo: 'Febrero 2026',
  periodo_desde: '01/02/2026',
  periodo_hasta: '28/02/2026',
  source_type: 'tc',
  total_operaciones: 50000,
  total_facturado: 52000,
  cuotas_vigentes: [],
  transacciones: [
    { id: 'tx_1', fecha: '05/02/2026', descripcion: 'Jumbo Peñalolén', monto: 30000, tipo: 'cargo', categoria: 'supermercado', es_cuota: false, cuota_actual: null, total_cuotas: null },
    { id: 'tx_2', fecha: '10/02/2026', descripcion: 'COMISION TC', monto: 2000, tipo: 'cargo', categoria: 'cargos_banco', es_cuota: false, cuota_actual: null, total_cuotas: null },
    { id: 'tx_3', fecha: '15/02/2026', descripcion: 'Uber', monto: 8000, tipo: 'cargo', categoria: 'transporte', es_cuota: false, cuota_actual: null, total_cuotas: null },
  ],
};

const BASE_PARSED_CC = {
  periodo: 'Febrero 2026',
  periodo_desde: '01/02/2026',
  periodo_hasta: '28/02/2026',
  source_type: 'cc',
  saldo_inicial: 500000,
  saldo_final: 300000,
  total_operaciones: 0,
  total_facturado: 0,
  cuotas_vigentes: [],
  transacciones: [
    { id: 'tx_1', fecha: '02/02/2026', descripcion: 'Transf. Comercializadora', monto: 1449274, tipo: 'abono', categoria: 'transferencia_recibida', es_cuota: false, cuota_actual: null, total_cuotas: null },
    { id: 'tx_2', fecha: '02/02/2026', descripcion: 'Traspaso a Tarjeta de Crédito', monto: 580291, tipo: 'traspaso_tc', categoria: 'traspaso_tc', es_cuota: false, cuota_actual: null, total_cuotas: null },
    { id: 'tx_3', fecha: '03/02/2026', descripcion: 'Pago Servipag', monto: 62143, tipo: 'cargo', categoria: 'pago_servicios', es_cuota: false, cuota_actual: null, total_cuotas: null },
    { id: 'tx_4', fecha: '25/02/2026', descripcion: 'Comisión Mantención Plan', monto: 7942, tipo: 'cargo', categoria: 'comision_banco', es_cuota: false, cuota_actual: null, total_cuotas: null },
  ],
};

const NO_RULES = {};

// ── BUG-01: comision_banco debe excluirse de totalCargos en CC ────────────────

describe('BUG-01 — CC: comision_banco excluida de totalCargos', () => {
  it('no suma comision_banco al totalCargos', () => {
    const result = buildMonthData(BASE_PARSED_CC, NO_RULES);
    // pago_servicios = 62143, comision_banco = 7942 → totalCargos debe ser solo 62143
    expect(result.total_cargos).toBe(62143);
  });

  it('TC: cargos_banco tampoco se suma al totalCargos', () => {
    const result = buildMonthData(BASE_PARSED_TC, NO_RULES);
    // supermercado(30000) + transporte(8000) = 38000, cargos_banco(2000) excluido
    expect(result.total_cargos).toBe(38000);
  });
});

// ── BUG-02: abonos CC no deben aparecer en categorias de gastos ──────────────

describe('BUG-02 — CC: abonos separados del desglose de gastos', () => {
  it('no incluye transferencia_recibida en categorias', () => {
    const result = buildMonthData(BASE_PARSED_CC, NO_RULES);
    expect(result.categorias).not.toHaveProperty('transferencia_recibida');
  });

  it('no incluye traspaso_tc en categorias', () => {
    const result = buildMonthData(BASE_PARSED_CC, NO_RULES);
    expect(result.categorias).not.toHaveProperty('traspaso_tc');
  });

  it('solo incluye gastos reales en categorias', () => {
    const result = buildMonthData(BASE_PARSED_CC, NO_RULES);
    expect(Object.keys(result.categorias)).toEqual(['pago_servicios', 'comision_banco']);
  });

  it('expone abonos por separado en ingresos_cc', () => {
    const result = buildMonthData(BASE_PARSED_CC, NO_RULES);
    expect(result.ingresos_cc).toBe(1449274);
  });
});

// ── BUG-03: catRules no sobreescribe categorías protegidas ───────────────────

describe('BUG-03 — catRules respeta categorías protegidas', () => {
  const rules = {
    'traspaso a tarjeta de crédito': 'pago_servicios', // intento de sobreescribir
    'comisión mantención plan': 'otros',               // intento de sobreescribir
  };

  it('traspaso_tc mantiene su categoría a pesar de catRules', () => {
    const result = buildMonthData(BASE_PARSED_CC, rules);
    const tx = result.transacciones.find(t => t.descripcion === 'Traspaso a Tarjeta de Crédito');
    expect(tx.categoria).toBe('traspaso_tc');
  });

  it('comision_banco mantiene su categoría a pesar de catRules', () => {
    const result = buildMonthData(BASE_PARSED_CC, rules);
    const tx = result.transacciones.find(t => t.descripcion === 'Comisión Mantención Plan');
    expect(tx.categoria).toBe('comision_banco');
  });

  it('TC: cargos_banco tampoco puede ser sobreescrito', () => {
    const tcRules = { 'comision tc': 'otros' };
    const result = buildMonthData(BASE_PARSED_TC, tcRules);
    const tx = result.transacciones.find(t => t.descripcion === 'COMISION TC');
    expect(tx.categoria).toBe('cargos_banco');
  });

  it('catRules sí aplica a categorías no protegidas', () => {
    const tcRules = { 'jumbo peñalolén': 'minimarket' };
    const result = buildMonthData(BASE_PARSED_TC, tcRules);
    const tx = result.transacciones.find(t => t.descripcion === 'Jumbo Peñalolén');
    expect(tx.categoria).toBe('minimarket');
  });
});

// ── HIGH: montos negativos no contaminan totales ──────────────────────────────

describe('HIGH — montos negativos no contaminan totales', () => {
  it('abono con monto negativo (error IA) no resta de ingresos_cc', () => {
    const parsed = {
      ...BASE_PARSED_CC,
      transacciones: [
        { ...BASE_PARSED_CC.transacciones[0], monto: -500000 }, // negativo por error IA
      ],
    };
    const result = buildMonthData(parsed, NO_RULES);
    expect(result.ingresos_cc).toBeGreaterThanOrEqual(0);
  });

  it('cargo con monto negativo no resta de totalCargos', () => {
    const parsed = {
      ...BASE_PARSED_TC,
      transacciones: [
        { ...BASE_PARSED_TC.transacciones[0], monto: -30000 }, // negativo por error IA
      ],
    };
    const result = buildMonthData(parsed, NO_RULES);
    expect(result.total_cargos).toBeGreaterThanOrEqual(0);
  });
});

// ── HIGH: traspaso_tc excluido de totalCargos sin importar el campo tipo ──────

describe('HIGH — traspaso_tc excluido de totalCargos independiente del campo tipo', () => {
  it('tipo=traspaso_tc → excluido de totalCargos', () => {
    const result = buildMonthData(BASE_PARSED_CC, NO_RULES);
    // pago_servicios(62143) es el único cargo real — traspaso_tc(580291) excluido
    expect(result.total_cargos).toBe(62143);
  });

  it('tipo=cargo + categoria=traspaso_tc → también excluido de totalCargos', () => {
    const parsed = {
      ...BASE_PARSED_CC,
      transacciones: [
        { id: 'tx_1', fecha: '02/02/2026', descripcion: 'Traspaso a TC', monto: 580291,
          tipo: 'cargo', categoria: 'traspaso_tc', es_cuota: false, cuota_actual: null, total_cuotas: null },
        { id: 'tx_2', fecha: '03/02/2026', descripcion: 'Pago Servipag', monto: 62143,
          tipo: 'cargo', categoria: 'pago_servicios', es_cuota: false, cuota_actual: null, total_cuotas: null },
      ],
    };
    const result = buildMonthData(parsed, NO_RULES);
    expect(result.total_cargos).toBe(62143);
  });
});

// ── Contrato de respuesta ─────────────────────────────────────────────────────

describe('buildMonthData — contrato de respuesta', () => {
  it('TC: devuelve campos requeridos', () => {
    const result = buildMonthData(BASE_PARSED_TC, NO_RULES);
    expect(result).toHaveProperty('transacciones');
    expect(result).toHaveProperty('categorias');
    expect(result).toHaveProperty('total_cargos');
    expect(result).not.toHaveProperty('ingresos_cc'); // TC no tiene ingresos_cc
  });

  it('CC: devuelve campos requeridos incluyendo ingresos_cc', () => {
    const result = buildMonthData(BASE_PARSED_CC, NO_RULES);
    expect(result).toHaveProperty('transacciones');
    expect(result).toHaveProperty('categorias');
    expect(result).toHaveProperty('total_cargos');
    expect(result).toHaveProperty('ingresos_cc');
  });
});
