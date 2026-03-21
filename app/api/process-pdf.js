// Vercel serverless function — /api/process-pdf
// Extracts text from PDF using pdf-parse, then calls OpenAI GPT-4o-mini
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import OpenAI from 'openai';

console.log('[API] process-pdf initialized with classic pdf-parse');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Bank-specific prompt builders ────────────────────────────────────
const VALID_CATS = [
    'supermercado', 'minimarket', 'delivery', 'transporte', 'mascotas', 'lavanderia',
    'ropa_moda', 'restaurantes', 'entretenimiento', 'servicios_hogar',
    'telefonia_internet', 'cuotas', 'cargos_banco', 'otros',
];

const SYSTEM_PROMPT = `Eres un extractor de datos financieros experto en estados de cuenta chilenos. 
Tu objetivo es extraer TODAS las transacciones y cuotas sin excepción. 

CATEGORÍAS Y KEYWORDS:
- supermercado: Jumbo, Lider, Ekono, Santa Isabel, Supervecino, Unimarc, HIP LIDER
- minimarket: Minimarket D Todo, Minimarket Leo, SUMUP*RODRIGO, Distribuidora Ramirez, AMAWA, SAVORY
- delivery: Uber Eats, Dominos, PedidosYa, KWA FOOD, CHICKEN FACTORY
- transporte: UBER TRIP, Uber Trip, Uber Rides, Cabify, MERPAGO*BIPQR, BIP, Metro
- mascotas: Club Animal, Bonne Sante, veterinaria, MAXIK, SUMUP*BONNE
- lavanderia: Spinokmp, MERPAGO*SPINOKMP
- ropa_moda: H&M, Zara, Falabella, Ripley, TRICOT, JYOTIS, SAN DIEGO LTDA, ROSARITO
- restaurantes: McDonalds, KFC, CASA VIEJA, DKF LIRA, LA DORITA, 2 ANIMALES, CAFETERIA
- entretenimiento: Cineplanet, Cinepolis, Cinemark, Fantasilandia, Punto Ticket, TICKETPLUS, WPAY PLUS, NETFLIX, SPOTIFY
- servicios_hogar: agua, luz, gas, electricidad, gastos comunes, condominio, seguros hogar, Enel, Metrogas, Aguas Andinas
- telefonia_internet: Entel, Movistar, WOM, Claro, VTR, streaming, Google Play, HBO, HELP.HBOMAX
- cuotas: CUOTA FIJA, N/CUOTAS PRECIO, TRES CUOTAS, CUOTA COMERCIO, DOS CUOTAS
- cargos_banco: COMISION TC, IMPTO DECRETO LEY, IVA USO INTERNACIONAL, SERVICIO COMPRA INTERNACIONAL
- otros: todo lo que no encaje arriba

REGLAS DE ORO ANTIFALLOS:
1. NO CONSOLIDAR: Si ves descripciones similares (ej: MercadoLibre vs Mercado Pago), NO las unas. Extrae CADA UNA como una fila separada siempre que tengan montos o números de cuota distintos.
2. NºCUOTA 00/NN: Solo en 'cuotas_vigentes' con cuota_actual=0.
3. NºCUOTA 01/NN o mayor: Agrégala a 'transacciones' Y a 'cuotas_vigentes'.
4. CRUCE DE TOTALES: Busca el "TOTAL CUOTAS DEL MES" en el PDF. La suma de tus extracciones en 'cuotas_vigentes' DEBE coincidir con ese total.
5. RAZONAMIENTO: En el campo 'razonamiento', lista el nombre de cada comercio que encontraste en la sección de cuotas.

Responde ÚNICAMENTE con este JSON:
{
  "razonamiento": "Lista de comercios detectados y suma total comprobada",
  "periodo": "Mes YYYY",
  "periodo_desde": "DD/MM/YYYY",
  "periodo_hasta": "DD/MM/YYYY",
  "total_facturado": 0,
  "transacciones": [{"fecha":"DD/MM/YYYY","descripcion":"NOMBRE","monto":0,"tipo":"cargo","categoria":"otros"}],
  "cuotas_vigentes": [{"descripcion":"nombre","cuota_actual":1,"total_cuotas":3,"monto_cuota":0}]
}`;

const BANK_HINTS = {
    santander_tc: 'Santander Chile tarjeta de crédito. Fecha en formato DD-MM-YYYY. Los cargos aparecen en la columna "Cargos".',
    bci_tc: 'BCI tarjeta de crédito. Los montos en la columna "Monto" con signo positivo son cargos.',
    chile_tc: 'Banco de Chile tarjeta de crédito. Columna "Cargo" contiene los gastos.',
    bci_cc: 'BCI cuenta corriente. Los cargos son los débitos de la cuenta.',
    otro: 'Estado de cuenta bancario chileno genérico.',
};

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Check API Key
    if (!process.env.OPENAI_API_KEY) {
        console.error('[process-pdf] MISSING OPENAI_API_KEY');
        return res.status(500).json({ error: 'Falta la API Key de OpenAI en Vercel.' });
    }

    try {
        const { pdfBase64, bank = 'santander_tc' } = req.body;
        if (!pdfBase64) return res.status(400).json({ error: 'pdfBase64 es requerido' });

        console.log('[process-pdf] Iniciando extraccion de PDF (v1.1.1)...');

        // 1. Extract text from PDF
        const buffer = Buffer.from(pdfBase64, 'base64');

        let pdfText = '';
        try {
            const data = await pdf(buffer);
            pdfText = data.text;
            console.log(`[process-pdf] Texto extraído (${pdfText?.length || 0} caracteres)`);
        } catch (error) {
            console.error('[process-pdf] Error en pdf-parse:', error);
            throw new Error(`Error al leer el PDF: ${error.message}`);
        }

        if (!pdfText || pdfText.trim().length < 50) {
            return res.status(422).json({ error: 'No se pudo extraer suficiente texto del PDF. Verifica que no sea una imagen escaneada.' });
        }

        // 2. Call OpenAI
        console.log('[process-pdf] Llamando a OpenAI...');
        const bankHint = BANK_HINTS[bank] || BANK_HINTS.otro;
        const userMsg = `Banco/Producto: ${bankHint}\n\nTexto del estado de cuenta:\n\n${pdfText}`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userMsg },
            ],
            response_format: { type: "json_object" }, // Simple JSON mode for reliability
            temperature: 0,
        });

        const msg = completion.choices[0];
        const content = msg?.message?.content;

        if (!content) throw new Error('OpenAI no devolvió respuesta');

        let data;
        try {
            data = JSON.parse(content);
        } catch (e) {
            console.error('[process-pdf] JSON Error:', content);
            throw new Error('La IA no devolvió un formato válido');
        }

        // 3. Normalize for frontend
        const output = {
            id: `month_${Date.now()}`,
            periodo: data.periodo || 'Desconocido',
            periodo_desde: data.periodo_desde || '',
            periodo_hasta: data.periodo_hasta || '',
            total_facturado: Number(data.total_facturado) || 0,
            transacciones: (data.transacciones || []).map((t, i) => ({
                id: `tx_${i + 1}`,
                fecha: t.fecha,
                descripcion: t.descripcion,
                monto: Math.abs(t.monto),
                tipo: t.tipo || 'cargo',
                categoria: VALID_CATS.includes(t.categoria) ? t.categoria : 'otros'
            })),
            cuotas_vigentes: (data.cuotas_vigentes || []).map(c => ({
                descripcion: c.descripcion,
                cuota_actual: Number(c.cuota_actual),
                total_cuotas: Number(c.total_cuotas),
                monto_cuota: Number(c.monto_cuota)
            }))
        };

        return res.status(200).json(output);

    } catch (err) {
        console.error('[process-pdf] ERROR FATAL:', err);
        return res.status(500).json({ error: err.message || 'Error interno del servidor al procesar el PDF' });
    }
};
