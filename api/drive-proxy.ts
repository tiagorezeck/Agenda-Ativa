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

export default async function handler(req: any, res: any) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);

  try {
    const queryParams = (req.query || {}) as Record<string, unknown>;
    let bodyParams: Record<string, unknown> = {};
    if (req.body && typeof req.body === 'object') {
      bodyParams = req.body as Record<string, unknown>;
    } else if (typeof req.body === 'string' && req.body.trim()) {
      try {
        bodyParams = JSON.parse(req.body);
      } catch {
        bodyParams = {};
      }
    }

    const params = { ...queryParams, ...bodyParams };
    const envTargetUrl = (process.env.GAS_WEBAPP_URL || process.env.VITE_GAS_WEBAPP_URL || '').trim();
    const targetUrl = String(params.targetUrl || envTargetUrl || '').trim();
    const action =
      typeof params.action === 'string' && params.action.trim()
        ? params.action.trim()
        : 'save';

    if (!targetUrl) {
      clearTimeout(timeout);
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'URL do Web App ausente. Configure em Configurações ou defina GAS_WEBAPP_URL no Vercel.'
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

    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML')) {
      return res.status(502).json({
        status: 'error',
        statusCode: 502,
        message:
          'O Google Apps Script retornou uma página HTML em vez de JSON. Verifique se a implantação está como "App da Web", executando como "Eu" e acesso para "Qualquer pessoa".'
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
