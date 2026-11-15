const GET_ACTIONS = new Set([
  'ping',
  'test',
  'get',
  'GET_DATABASE',
  'GET_EVENT_BY_SLUG',
  'list_files',
  'get_file'
]);

function normalizeGasUrl(rawUrl: string): string {
  return rawUrl.trim().replace(/^(https:\/\/script\.google\.com\/macros)\/u\/\d+(\/s\/)/i, '$1$2');
}

function validateGasUrl(rawUrl: string): { valid: boolean; normalizedUrl?: string; error?: string } {
  try {
    const normalized = normalizeGasUrl(rawUrl);
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'A URL deve usar HTTPS.' };
    }
    const host = parsed.hostname.toLowerCase();
    const isGasHost =
      host === 'script.google.com' ||
      host.endsWith('.script.google.com') ||
      host === 'script.googleusercontent.com' ||
      host.endsWith('.googleusercontent.com');

    if (!isGasHost) {
      return {
        valid: false,
        error: 'URL inválida. Informe uma URL oficial do Google Apps Script (script.google.com).'
      };
    }

    const urlPath = parsed.pathname.toLowerCase();
    if (urlPath.includes('/library/')) {
      return {
        valid: false,
        error:
          'Atenção: A URL informada é uma Biblioteca (/macros/library/...). Para conectar, use a "URL do aplicativo da Web" obtida em Implantar > Gerenciar implantações, que termina com "/exec" (exemplo: https://script.google.com/macros/s/AKfycb.../exec).'
      };
    }
    if (urlPath.includes('/edit')) {
      return {
        valid: false,
        error:
          'Atenção: A URL informada é do editor (/edit). No Apps Script, clique em "Implantar" > "Gerenciar implantações" e copie a "URL do aplicativo da Web", que termina com "/exec".'
      };
    }
    if (urlPath.endsWith('/dev')) {
      return {
        valid: false,
        error:
          'Atenção: A URL informada é de teste (/dev), que só funciona logado no editor. Em "Implantar > Gerenciar implantações", copie a URL de produção terminada em "/exec".'
      };
    }

    return { valid: true, normalizedUrl: normalized };
  } catch {
    return { valid: false, error: 'URL malformada.' };
  }
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);

  try {
    const queryParams = (req.query || {}) as Record<string, unknown>;
    let bodyParams: Record<string, unknown> = {};
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      bodyParams = req.body as Record<string, unknown>;
    } else if (Buffer.isBuffer(req.body)) {
      try {
        bodyParams = JSON.parse(req.body.toString('utf-8'));
      } catch {
        bodyParams = {};
      }
    } else if (typeof req.body === 'string' && req.body.trim()) {
      try {
        bodyParams = JSON.parse(req.body);
      } catch {
        bodyParams = {};
      }
    }

    const params = { ...queryParams, ...bodyParams };
    const envTargetUrl = (
      process.env.GAS_WEBAPP_URL ||
      process.env.VITE_GAS_WEBAPP_URL ||
      ''
    ).trim();
    const rawTargetUrl = String(params.targetUrl || envTargetUrl || '').trim();
    const action =
      typeof params.action === 'string' && params.action.trim()
        ? params.action.trim()
        : 'save';

    if (!rawTargetUrl) {
      clearTimeout(timeout);
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'URL do Web App ausente. Configure em Configurações, em src/config/gasConfig.ts ou defina GAS_WEBAPP_URL no Vercel.'
      });
    }

    const gasValidation = validateGasUrl(rawTargetUrl);
    if (!gasValidation.valid) {
      clearTimeout(timeout);
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: gasValidation.error
      });
    }
    const targetUrl = gasValidation.normalizedUrl || rawTargetUrl;

    const authHeader =
      typeof req.headers?.authorization === 'string'
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
        Accept: 'application/json, text/plain, */*'
      };
    } else {
      fetchOptions.method = 'POST';
      fetchOptions.headers = {
        'Content-Type': 'text/plain;charset=utf-8',
        Accept: 'application/json, text/plain, */*'
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

    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML')) {
      return res.status(502).json({
        status: 'error',
        statusCode: 502,
        message:
          'O Google Apps Script retornou uma página HTML em vez de JSON. Verifique em "Implantar > Gerenciar implantações" se está publicado como "App da Web", Executar como: "Eu" e Quem tem acesso: "Qualquer pessoa".'
      });
    }

    if (trimmed.includes('A server error has occurred') || trimmed.includes('server error')) {
      return res.status(502).json({
        status: 'error',
        statusCode: 502,
        message:
          'O Google Apps Script retornou "A server error has occurred". Causas mais comuns: (1) Após colar/editar o Code.gs, você precisa publicar uma NOVA VERSÃO em Implantar > Gerenciar implantações > Editar > Versão: Nova versão > Implantar; (2) Confirme "Executar como: Eu" e "Quem tem acesso: Qualquer pessoa"; (3) Confirme se a URL termina em "/exec" e não possui "/u/1/" ou "/dev".'
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
}
