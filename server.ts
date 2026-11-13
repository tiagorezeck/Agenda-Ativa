import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const GET_ACTIONS = new Set([
  'ping',
  'test',
  'get',
  'GET_DATABASE',
  'GET_EVENT_BY_SLUG',
  'list_files',
  'get_file'
]);

function isAllowedGasUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'script.google.com' ||
      host.endsWith('.script.google.com') ||
      host === 'script.googleusercontent.com' ||
      host.endsWith('.googleusercontent.com')
    );
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Healthcheck
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'Agenda Ativa — Motor DADOS DRIVE v2.0',
      timestamp: new Date().toISOString()
    });
  });

  // Configuração segura de runtime (não expõe URLs nem segredos sensíveis)
  app.get('/api/runtime-config', (_req: Request, res: Response) => {
    const hasServerGasUrl = Boolean(
      (process.env.GAS_WEBAPP_URL || process.env.VITE_GAS_WEBAPP_URL || '').trim()
    );
    const engsegRequired =
      String(process.env.ENGSEG_REQUIRED || process.env.VITE_ENGSEG_REQUIRED || '').toLowerCase() === 'true';
    const engsegEmail = (process.env.ENGSEG_ADMIN_EMAIL || '').trim();

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      cloudConfigured: hasServerGasUrl,
      engsegRequired,
      engsegEmail
    });
  });

  // Proxy Anti-CORS / Anti-Iframe para Google Apps Script (DADOS DRIVE v2.0)
  app.all('/api/drive-proxy', async (req: Request, res: Response) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);

    try {
      const queryParams = (req.query || {}) as Record<string, unknown>;
      const bodyParams = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const params = { ...queryParams, ...bodyParams };

      const envTargetUrl = (process.env.GAS_WEBAPP_URL || process.env.VITE_GAS_WEBAPP_URL || '').trim();
      const targetUrl = String(params.targetUrl || envTargetUrl || '').trim();
      const action = typeof params.action === 'string' && params.action.trim()
        ? params.action.trim()
        : 'save';

      if (!targetUrl) {
        clearTimeout(timeout);
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: 'URL do Web App ausente.'
        });
      }

      if (!isAllowedGasUrl(targetUrl)) {
        clearTimeout(timeout);
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: 'URL inválida. Informe uma URL oficial HTTPS do Google Apps Script (script.google.com).'
        });
      }

      const authHeader = typeof req.headers.authorization === 'string'
        ? req.headers.authorization.replace(/^Bearer\s+/i, '').trim()
        : '';

      const effectiveToken = String(
        params.apiToken ||
        params.token ||
        authHeader ||
        process.env.DRIVE_API_SECRET ||
        ''
      ).trim();

      let fetchUrl = targetUrl;
      const fetchOptions: RequestInit = {
        redirect: 'follow',
        signal: controller.signal
      };

      if (GET_ACTIONS.has(action)) {
        const urlObj = new URL(targetUrl);
        urlObj.searchParams.set('action', action);
        if (effectiveToken) {
          urlObj.searchParams.set('token', effectiveToken);
        }
        if (typeof params.fileName === 'string' && params.fileName) {
          urlObj.searchParams.set('fileName', params.fileName);
        }
        if (typeof params.slug === 'string' && params.slug) {
          urlObj.searchParams.set('slug', params.slug);
        }
        if (params.nocache) {
          urlObj.searchParams.set('nocache', '1');
        }
        urlObj.searchParams.set('t', Date.now().toString());

        fetchUrl = urlObj.toString();
        fetchOptions.method = 'GET';
        fetchOptions.headers = {
          Accept: 'application/json, text/plain, */*',
          ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {})
        };
      } else {
        fetchOptions.method = 'POST';
        fetchOptions.headers = {
          'Content-Type': 'text/plain;charset=utf-8',
          Accept: 'application/json, text/plain, */*',
          ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {})
        };

        const forwardPayload: Record<string, unknown> = {
          ...bodyParams,
          action
        };
        delete forwardPayload.targetUrl;
        delete forwardPayload.apiToken;
        if (effectiveToken && !forwardPayload.token) {
          forwardPayload.token = effectiveToken;
        }

        fetchOptions.body = JSON.stringify(forwardPayload);
      }

      const response = await fetch(fetchUrl, fetchOptions);
      clearTimeout(timeout);

      const text = await response.text();
      const trimmed = text.trim();

      // Detecta resposta HTML (comum quando o Web App não está publicado como "Qualquer pessoa")
      if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML')) {
        return res.status(502).json({
          status: 'error',
          statusCode: 502,
          message: 'O Google Apps Script retornou uma página HTML em vez de JSON. Verifique se a implantação está como "App da Web", executando como "Eu" e acesso para "Qualquer pessoa".'
        });
      }

      try {
        const parsed = JSON.parse(text);
        const httpStatus =
          typeof parsed.statusCode === 'number' && parsed.statusCode >= 400 && parsed.statusCode < 600
            ? parsed.statusCode
            : response.ok
              ? 200
              : response.status;

        return res.status(httpStatus).json(parsed);
      } catch {
        return res.status(response.ok ? 200 : response.status).json({
          status: response.ok ? 'success' : 'error',
          raw: text
        });
      }
    } catch (err: any) {
      clearTimeout(timeout);
      const isTimeout = err?.name === 'AbortError';
      return res.status(isTimeout ? 504 : 500).json({
        status: 'error',
        statusCode: isTimeout ? 504 : 500,
        message: isTimeout
          ? 'Tempo limite excedido (35s) ao aguardar resposta do Google Apps Script.'
          : err?.message || 'Erro interno no proxy do Google Drive.'
      });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Agenda Ativa] Servidor ativo em http://0.0.0.0:${PORT} (${IS_PROD ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar o servidor Agenda Ativa:', err);
  process.exit(1);
});
