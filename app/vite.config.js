import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);

// Plugin para simular las serverless functions de Vercel de forma local
const vercelApiMockPlugin = () => ({
  name: 'vercel-api-mock',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url.startsWith('/api/')) {
        let body = '';
        req.on('data', chunk => { body += chunk.toString() });
        req.on('end', async () => {
          try {
            if (body) req.body = JSON.parse(body);
            // Cargar env local (.env.local, .env) a process.env para que el handler lo pueda leer
            const env = loadEnv(server.config.mode, process.cwd(), '');
            Object.assign(process.env, env);

            // Determinar ruta (Asegurar que funcione bien en Windows con ES Modules)
            const routePath = path.resolve(process.cwd(), `.${req.url}.js`);
            const fileUrl = new URL(`file:///${routePath.replace(/\\/g, '/')}`).href;
            const handlerModule = await import(`${fileUrl}?t=${Date.now()}`); // cache busting
            const handler = handlerModule.default || handlerModule;

            // Mock de res.status() y res.json() (típicos de express/vercel)
            res.status = (code) => { res.statusCode = code; return res; };
            res.json = (data) => {
              if (!res.headersSent) res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            };

            await handler(req, res);
          } catch (e) {
            console.error('[Mock API Error]:', e);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          }
        });
      } else {
        next();
      }
    });
  }
});

export default defineConfig({
  plugins: [react(), vercelApiMockPlugin()],
  server: {
    port: 5173,
  },
});
