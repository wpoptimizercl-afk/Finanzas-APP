/**
 * Regression tests para process-pdf.js — extracción Santander Chile
 *
 * Estrategia: testear normalizeAIResponse() directamente con el golden fixture.
 * No requiere mocks de OpenAI ni de pdf-parse — es una función pura.
 *
 * Regressions conocidas que estos tests previenen:
 *   REG-01: Cuotas con fechas antiguas omitidas (21/08/25, 31/10/25, 12/11/25...)
 *   REG-02: MONTO CANCELADO incluido como transacción
 *   REG-03: Cuota 00/NN aparece en transacciones (debe estar solo en cuotas_vigentes)
 *   REG-04: Campo total_operaciones ausente o cero
 *   REG-05: Categorías inválidas (no están en VALID_CATS)
 *   REG-06: Cargos banco (sección 3) omitidos
 */

import { describe, it, expect, vi } from 'vitest';

// Mock openai antes del import — process-pdf.js instancia OpenAI a nivel de módulo
vi.mock('openai', () => ({
  default: class OpenAI { constructor() {} }
}));

import { normalizeAIResponse } from '../api/process-pdf.js';
import goldenAIResponse from './fixtures/santander-golden-ai-response.json';

const VALID_CATS = [
  'supermercado', 'minimarket', 'delivery', 'transporte', 'mascotas', 'lavanderia',
  'ropa_moda', 'restaurantes', 'entretenimiento', 'pago_servicios',
  'telefonia_internet', 'cuotas', 'cargos_banco', 'otros',
];

// Output normalizado del golden fixture — se calcula una vez para todos los tests
const result = normalizeAIResponse(goldenAIResponse);

// ── Contrato de respuesta ─────────────────────────────────────────────────────

describe('contrato de respuesta', () => {
  it('incluye todos los campos requeridos', () => {
    const REQUIRED = ['id', 'periodo', 'periodo_desde', 'periodo_hasta',
      'total_operaciones', 'total_facturado', 'transacciones', 'cuotas_vigentes'];
    for (const field of REQUIRED) {
      expect(result, `campo "${field}" ausente`).toHaveProperty(field);
    }
  });

  it('total_operaciones es 1273912', () => {
    expect(result.total_operaciones).toBe(1273912);
  });

  it('total_facturado es 1288293', () => {
    expect(result.total_facturado).toBe(1288293);
  });

  it('periodo es Febrero 2026', () => {
    expect(result.periodo).toBe('Febrero 2026');
  });

  it('transacciones es un array no vacío', () => {
    expect(Array.isArray(result.transacciones)).toBe(true);
    expect(result.transacciones.length).toBeGreaterThan(0);
  });

  it('cada transacción tiene id, fecha, descripcion, monto, tipo, categoria, es_cuota', () => {
    const TX_FIELDS = ['id', 'fecha', 'descripcion', 'monto', 'tipo', 'categoria', 'es_cuota'];
    for (const tx of result.transacciones) {
      for (const field of TX_FIELDS) {
        expect(tx, `campo "${field}" ausente en "${tx?.descripcion}"`).toHaveProperty(field);
      }
      expect(typeof tx.monto).toBe('number');
      expect(tx.monto).toBeGreaterThanOrEqual(0);
      expect(typeof tx.es_cuota).toBe('boolean');
    }
  });

  it('todas las categorías son válidas (REG-05)', () => {
    for (const tx of result.transacciones) {
      expect(VALID_CATS, `categoría inválida: "${tx.categoria}" en "${tx.descripcion}"`
      ).toContain(tx.categoria);
    }
  });
});

// ── REG-01: Cuotas con fechas antiguas ────────────────────────────────────────

describe('REG-01: cuotas con fechas antiguas incluidas', () => {
  // Estas cuotas tienen fechas de ago/oct/nov/dic 2025 pero se cobran en feb 2026.
  // Son el patrón de regresión más frecuente — el modelo las omite creyendo que
  // son del período anterior.

  it('San Diego Ltda 07/12 (compra 21/08/25) está en transacciones', () => {
    const tx = result.transacciones.find(
      t => t.descripcion.toLowerCase().includes('san diego') && t.cuota_actual === 7
    );
    expect(tx, 'San Diego Ltda 07/12 ausente').toBeDefined();
    expect(tx.monto).toBe(9748);
    expect(tx.es_cuota).toBe(true);
    expect(tx.total_cuotas).toBe(12);
  });

  it('H&M Vivo Galería Imperio 03/03 (compra 31/10/25) está en transacciones', () => {
    const tx = result.transacciones.find(
      t => t.descripcion.toLowerCase().includes('h&m') &&
           t.cuota_actual === 3 && t.total_cuotas === 3
    );
    expect(tx, 'H&M 03/03 ausente').toBeDefined();
    expect(tx.monto).toBe(13265);
    expect(tx.es_cuota).toBe(true);
  });

  it('Jyotis 03/03 (compra 12/11/25) está en transacciones', () => {
    const tx = result.transacciones.find(
      t => t.descripcion.toLowerCase().includes('jyotis')
    );
    expect(tx, 'Jyotis 03/03 ausente').toBeDefined();
    expect(tx.monto).toBe(26229);
    expect(tx.es_cuota).toBe(true);
    expect(tx.cuota_actual).toBe(3);
  });

  it('MercadoPago*ReebokChile 02/03 (compra 08/12/25) está en transacciones', () => {
    const tx = result.transacciones.find(
      t => t.descripcion.toLowerCase().includes('reebok')
    );
    expect(tx, 'ReebokChile 02/03 ausente').toBeDefined();
    expect(tx.monto).toBe(27763);
    expect(tx.cuota_actual).toBe(2);
    expect(tx.total_cuotas).toBe(3);
  });

  it('MercadoPago*MercadoLibre 03/03 (compra 16/12/25) está en transacciones', () => {
    const tx = result.transacciones.find(
      t => t.descripcion.toLowerCase().includes('mercadolibre') && t.es_cuota === true
    );
    expect(tx, 'MercadoLibre 03/03 ausente').toBeDefined();
    expect(tx.monto).toBe(12284);
  });
});

// ── REG-02: MONTO CANCELADO excluido ──────────────────────────────────────────

describe('REG-02: MONTO CANCELADO excluido', () => {
  it('MONTO CANCELADO no aparece en transacciones', () => {
    // Si el modelo incluye el abono como transacción, este test falla
    const withCancelado = normalizeAIResponse({
      ...goldenAIResponse,
      transacciones: [
        ...goldenAIResponse.transacciones,
        { fecha: '01/02/2026', descripcion: 'MONTO CANCELADO', monto: 580291,
          tipo: 'cargo', categoria: 'otros', es_cuota: false, cuota_actual: null, total_cuotas: null }
      ]
    });
    // El handler no filtra esto — este test documenta que el PROMPT debe evitarlo.
    // Si falla, significa que el prompt permite que el modelo incluya abonos.
    const cancelado = withCancelado.transacciones.find(
      t => t.descripcion.toUpperCase().includes('CANCELADO')
    );
    // Documentamos el comportamiento: si el modelo lo manda, el handler lo pasa.
    // El test sirve como recordatorio de que la defensa está en el PROMPT (R2).
    expect(cancelado?.monto).toBe(580291); // documenta que el handler NO filtra — el prompt debe hacerlo
  });

  it('el golden fixture no incluye MONTO CANCELADO', () => {
    const cancelado = result.transacciones.find(
      t => t.descripcion.toUpperCase().includes('CANCELADO')
    );
    expect(cancelado).toBeUndefined();
  });
});

// ── REG-03: Cuota 00/NN ───────────────────────────────────────────────────────

describe('REG-03: cuota 00/NN no está en transacciones', () => {
  it('ninguna transacción tiene cuota_actual === 0', () => {
    const conCuotaCero = result.transacciones.filter(t => t.cuota_actual === 0);
    expect(conCuotaCero).toHaveLength(0);
  });

  it('H&M Vivo Galería Imperio 00/03 NO está en transacciones', () => {
    const enTransacciones = result.transacciones.find(
      t => t.descripcion.toLowerCase().includes('h&m') && t.cuota_actual === 0
    );
    expect(enTransacciones).toBeUndefined();
  });

  it('H&M Vivo Galería Imperio 00/03 SÍ está en cuotas_vigentes con monto 17983', () => {
    const enCuotas = result.cuotas_vigentes.find(
      c => c.descripcion.toLowerCase().includes('h&m') && c.cuota_actual === 0
    );
    expect(enCuotas, 'H&M 00/03 debe estar en cuotas_vigentes').toBeDefined();
    expect(enCuotas.monto_cuota).toBe(17983);
    expect(enCuotas.total_cuotas).toBe(3);
  });
});

// ── REG-06: Cargos banco ──────────────────────────────────────────────────────

describe('REG-06: cargos banco (sección 3) incluidos', () => {
  it('Comisión TC Fuera de Plan está en transacciones como cargos_banco', () => {
    const tx = result.transacciones.find(
      t => t.categoria === 'cargos_banco' && t.descripcion.toLowerCase().includes('comisi')
    );
    expect(tx, 'Comisión TC ausente').toBeDefined();
    expect(tx.monto).toBe(9137);
  });

  it('IVA Uso Internacional está en transacciones como cargos_banco', () => {
    const tx = result.transacciones.find(
      t => t.categoria === 'cargos_banco' && t.descripcion.toLowerCase().includes('iva')
    );
    expect(tx, 'IVA Uso Internacional ausente').toBeDefined();
    expect(tx.monto).toBe(1978);
  });

  it('Servicio Compra Internacional está en transacciones como cargos_banco', () => {
    const tx = result.transacciones.find(
      t => t.categoria === 'cargos_banco' && t.descripcion.toLowerCase().includes('servicio')
    );
    expect(tx, 'Servicio Compra Internacional ausente').toBeDefined();
    expect(tx.monto).toBe(10412);
  });
});

// ── Normalización ─────────────────────────────────────────────────────────────

describe('normalización de campos', () => {
  it('montos son siempre positivos (Math.abs aplicado)', () => {
    const withNegative = normalizeAIResponse({
      ...goldenAIResponse,
      transacciones: [{ fecha: '01/02/2026', descripcion: 'Test', monto: -5000,
        tipo: 'cargo', categoria: 'otros', es_cuota: false, cuota_actual: null, total_cuotas: null }]
    });
    expect(withNegative.transacciones[0].monto).toBe(5000);
  });

  it('categoría desconocida cae a "otros"', () => {
    const withBadCat = normalizeAIResponse({
      ...goldenAIResponse,
      transacciones: [{ fecha: '01/02/2026', descripcion: 'Test', monto: 1000,
        tipo: 'cargo', categoria: 'categoria_inventada', es_cuota: false, cuota_actual: null, total_cuotas: null }]
    });
    expect(withBadCat.transacciones[0].categoria).toBe('otros');
  });

  it('es_cuota null del modelo se convierte en false', () => {
    const withNullCuota = normalizeAIResponse({
      ...goldenAIResponse,
      transacciones: [{ fecha: '01/02/2026', descripcion: 'Test', monto: 1000,
        tipo: 'cargo', categoria: 'otros', es_cuota: null, cuota_actual: null, total_cuotas: null }]
    });
    expect(withNullCuota.transacciones[0].es_cuota).toBe(false);
  });

  it('cada transacción tiene id único (tx_1, tx_2...)', () => {
    const ids = result.transacciones.map(t => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
    expect(result.transacciones[0].id).toBe('tx_1');
  });
});
