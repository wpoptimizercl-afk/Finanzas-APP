import { describe, it, expect } from 'vitest';
import { categorizeTCTransaction, categorizeCCTransaction } from '../../api/parsers/category-rules.js';

describe('categorizeTCTransaction', () => {
    it.each([
        ['JUMBO PENALOLEN',               'supermercado'],
        ['LIDER.CL MALL ONECLICK',        'supermercado'],
        ['EKONO SANTA ISABEL II',         'supermercado'],
        ['SUPERMERCADO SUPERVECINO',       'supermercado'],
        ['MINIMARKET D TODO',             'minimarket'],
        ['MINIMARKET EL SIMMENTAL S',     'minimarket'],
        ['AMAWA',                         'minimarket'],
        ['TD05 58 MARKET',                'minimarket'],
        ['PAYU   *UBER TRIP',             'transporte'],
        ['MERPAGO*JETSMARTAIRLINESS',     'transporte'],
        ['MERPAGO*BIPQR',                 'transporte'],
        ['NUITEE* DIRECTO TECH I',        'transporte'],
        ['CLUB ANIMAL SPA',               'mascotas'],
        ['SUMUP * BONNE SANTE',           'mascotas'],
        ['MERPAGO*SPINOKMP',              'lavanderia'],
        ['H&M VIVO GALERIA IMPERIO',      'ropa_moda'],
        ['JYOTIS',                        'ropa_moda'],
        ['MERCADOPAGO*REEBOKCHILE',       'ropa_moda'],
        ['CANNON VIVO IMPERIO',           'ropa_moda'],
        ['SAN DIEGO LTDA',                'ropa_moda'],
        ['RESTAURANTE MAN JI SPA',        'restaurantes'],
        ['DKF LIRA',                      'restaurantes'],
        ['DOMINOS PIZZA PENALOLEN',       'restaurantes'],
        ['KWA FOOD WEB PAY',              'restaurantes'],
        ['MC DONALDS COSTANERA CENT',     'restaurantes'],
        ['2 ANIMALES CATERING  1745',     'restaurantes'],
        ['LA DORITA            4308',     'restaurantes'],
        ['CINEPLANET COSTANERA',          'entretenimiento'],
        ['CINEMARK',                      'entretenimiento'],
        ['HELP.HBOMAX.COM HEL',           'entretenimiento'],
        ['COMMERCIAL HOME STORE LTDA',    'pago_servicios'],
        ['PETROBRAS BILBAO/VARAS',        'pago_servicios'],
        ['ENTEL ONECLICK PCS PAGO C',     'pago_servicios'],
        ['ENTEL VENTAS DE EQUIPOS',       'telefonia_internet'],
        ['ENTEL PCS PAGO EN LINEA',       'pago_servicios'],
        ['COMISION TC FUERA DE PLAN',     'cargos_banco'],
        ['IVA USO INTERNACIONAL',         'cargos_banco'],
        ['IMPTO. DECRETO LEY 3475',       'cargos_banco'],
        ['SERVICIO COMPRA INTERNACIONA',  'cargos_banco'],
        ['DISTRIBUIDORA RAMIREZ',         'otros'],
        ['MARIA ALMIRON',                 'restaurantes'],
        ['MERPAGO*OSCAROSWALDOM',         'otros'],
    ])('%s → %s', (desc, expected) => {
        expect(categorizeTCTransaction(desc)).toBe(expected);
    });

    it('uber trip no es delivery', () => {
        expect(categorizeTCTransaction('PAYU *UBER TRIP')).toBe('transporte');
    });

    it('uber eats sería delivery', () => {
        expect(categorizeTCTransaction('UBER EATS')).toBe('delivery');
    });

    it('string vacío → otros', () => {
        expect(categorizeTCTransaction('')).toBe('otros');
    });

    it('null → otros', () => {
        expect(categorizeTCTransaction(null)).toBe('otros');
    });
});

describe('categorizeCCTransaction', () => {
    it.each([
        ['Transf. COMERCIALIZADORA', 'abono', 'transferencia_recibida'],
        ['Transf de CONSTANZA ANDREA', 'abono', 'transferencia_recibida'],
        ['Transf a khipu CLBS E', 'cargo', 'transferencia_enviada'],
        ['Transf a Edgar Eduardo Urbina', 'cargo', 'transferencia_enviada'],
        ['Traspaso Internet a T. Crédito', 'cargo', 'traspaso_tc'],
        ['PAGO EN LINEA SERVIPAG', 'cargo', 'pago_servicios'],
        ['COM.MANTENCION PLAN', 'cargo', 'cargos_banco'],
        ['RECUP COM PLAN MES ANT 2025-11-26', 'abono', 'cargos_banco'],
        ['Transf. KHIPU SPA', 'abono', 'transferencia_recibida'],
    ])('%s (%s) → %s', (desc, tipo, expected) => {
        expect(categorizeCCTransaction(desc, tipo)).toBe(expected);
    });
});
