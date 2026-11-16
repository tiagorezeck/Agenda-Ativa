import { GLOBAL_GAS_CONFIG } from '../config/gasConfig';

/**
 * Agenda Ativa — Serviço Cliente DADOS DRIVE v2.0
 * Comunicação via proxy reverso /api/drive-proxy (Anti-CORS / Anti-Iframe)
 * Sem armazenamento em localStorage: conexão global via GLOBAL_GAS_CONFIG,
 * variáveis de ambiente (GAS_WEBAPP_URL) ou configuração do servidor (/api/runtime-config).
 */

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline';

export interface DriveConfig {
  webappUrl: string;
  apiToken?: string;
  autoSync: boolean;
  syncStatus?: SyncStatus;
  lastSyncTimestamp?: number;
  spreadsheetUrl?: string;
  spreadsheetName?: string;
  exportXlsxUrl?: string;
  folderPath?: string;
}

export interface RuntimeConfig {
  cloudConfigured: boolean;
  engsegRequired: boolean;
  engsegEmail: string;
  loaded: boolean;
}

export interface DriveFileEntry {
  id: string;
  name: string;
  isRoot: boolean;
  size: number;
  lastUpdated: number;
  url: string;
}

export interface SavedDriveProfile {
  id: string;
  label: string;
  webappUrl: string;
  apiToken?: string;
  spreadsheetName?: string;
  savedAt: number;
}

const DRIVE_CONFIG_KEY = 'AGENDA_ATIVA_DRIVE_CONFIG_V2';
const LEGACY_GAS_URL_KEY = 'SISTEMA_AGENDAMENTO_GAS_WEBAPP_URL';
const SAVED_DRIVES_KEY = 'AGENDA_ATIVA_SAVED_DRIVES_V1';
const ACTIVE_DRIVE_PINNED_KEY = 'AGENDA_ATIVA_ACTIVE_DRIVE_URL_V1';

function isCurrentPathPublic(): boolean {
  if (typeof window === 'undefined') return false;
  const p = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
  return p === '/agendar' || p.startsWith('/agendar/') || p === '/obrigado' || p.endsWith('/obrigado');
}

export function normalizeGasUrl(rawUrl: string): string {
  return (rawUrl || '')
    .trim()
    .replace(/^(https:\/\/script\.google\.com\/macros)\/u\/\d+(\/s\/)/i, '$1$2');
}

export function validateGasUrlClient(rawUrl: string): { valid: boolean; normalizedUrl?: string; error?: string } {
  const normalized = normalizeGasUrl(rawUrl);
  if (!normalized) return { valid: false, error: 'Informe a URL do Web App.' };
  try {
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
      return { valid: false, error: 'URL inválida. Informe uma URL oficial do Google Apps Script (script.google.com).' };
    }
    const p = parsed.pathname.toLowerCase();
    if (p.includes('/library/')) {
      return {
        valid: false,
        error:
          'A URL informada é de Biblioteca (/macros/library/...). Use a "URL do aplicativo da Web" terminada em "/exec" em Implantar > Gerenciar implantações.'
      };
    }
    if (p.includes('/edit')) {
      return {
        valid: false,
        error:
          'A URL informada é do editor (/edit). Copie a "URL do aplicativo da Web" terminada em "/exec" em Implantar > Gerenciar implantações.'
      };
    }
    if (p.endsWith('/dev')) {
      return {
        valid: false,
        error:
          'A URL informada é de teste (/dev). Copie a URL de produção terminada em "/exec" em Implantar > Gerenciar implantações.'
      };
    }
    return { valid: true, normalizedUrl: normalized };
  } catch {
    return { valid: false, error: 'URL malformada.' };
  }
}

export function extractGasDeploymentId(rawUrl: string): string {
  const normalized = normalizeGasUrl(rawUrl);
  if (!normalized) return '';
  const match = normalized.match(/^https:\/\/script\.google\.com\/macros\/s\/([A-Za-z0-9_-]{20,})\/exec(?:[/?#].*)?$/i);
  return match ? match[1] : '';
}

export function buildGasUrlFromId(deploymentId: string): string {
  const clean = (deploymentId || '').trim();
  if (!/^[A-Za-z0-9_-]{20,}$/.test(clean)) return '';
  return `https://script.google.com/macros/s/${clean}/exec`;
}

// Limpa chaves antigas do localStorage para garantir 100% de dependência apenas do servidor/Sheets
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(DRIVE_CONFIG_KEY);
    localStorage.removeItem(LEGACY_GAS_URL_KEY);
  } catch {
    // ignore
  }
}

const listeners = new Set<(cfg: DriveConfig) => void>();
const runtimeListeners = new Set<(rt: RuntimeConfig) => void>();
const savedDrivesListeners = new Set<(drives: SavedDriveProfile[]) => void>();

const initialGlobalUrl = (() => {
  const raw = (import.meta.env.VITE_GAS_WEBAPP_URL || GLOBAL_GAS_CONFIG.WEBAPP_URL || '').trim();
  const check = raw ? validateGasUrlClient(raw) : { valid: false };
  return check.valid ? (check.normalizedUrl || raw) : '';
})();

const initialGlobalToken = (GLOBAL_GAS_CONFIG.API_TOKEN || '').trim();

let inMemoryDriveConfig: DriveConfig = {
  webappUrl: initialGlobalUrl,
  apiToken: initialGlobalToken,
  autoSync: true,
  syncStatus: initialGlobalUrl ? 'synced' : 'offline',
  folderPath: 'Agenda Ativa/AppDatabase_Data'
};

let runtimeConfigCache: RuntimeConfig = {
  cloudConfigured: Boolean(initialGlobalUrl),
  engsegRequired: String(import.meta.env.VITE_ENGSEG_REQUIRED || '').toLowerCase() === 'true',
  engsegEmail: '',
  loaded: false
};

let hasUrlDriveOverride = false;
let hasPinnedAdminDrive = false;

function readSavedDrivesStorage(): SavedDriveProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SAVED_DRIVES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.webappUrl === 'string' && validateGasUrlClient(item.webappUrl).valid);
  } catch {
    return [];
  }
}

function writeSavedDrivesStorage(drives: SavedDriveProfile[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SAVED_DRIVES_KEY, JSON.stringify(drives));
  } catch {
    // ignore
  }
}

let savedDrivesCache: SavedDriveProfile[] = readSavedDrivesStorage();

function hydratePinnedAdminDrive() {
  if (typeof window === 'undefined' || hasUrlDriveOverride || isCurrentPathPublic()) return;
  try {
    const rawPinned = localStorage.getItem(ACTIVE_DRIVE_PINNED_KEY);
    if (!rawPinned) return;
    let pinnedUrl = '';
    let pinnedToken = '';
    try {
      const parsed = JSON.parse(rawPinned);
      pinnedUrl = (parsed?.webappUrl || '').trim();
      pinnedToken = (parsed?.apiToken || '').trim();
    } catch {
      pinnedUrl = rawPinned.trim();
    }
    const check = pinnedUrl ? validateGasUrlClient(pinnedUrl) : { valid: false };
    if (!check.valid) return;
    const validUrl = check.normalizedUrl || pinnedUrl;
    hasPinnedAdminDrive = true;
    inMemoryDriveConfig = {
      ...inMemoryDriveConfig,
      webappUrl: validUrl,
      apiToken: pinnedToken || inMemoryDriveConfig.apiToken,
      syncStatus: 'synced'
    };
    runtimeConfigCache = {
      ...runtimeConfigCache,
      cloudConfigured: true
    };
  } catch {
    // ignore
  }
}

export function applyDriveOverrideFromLocation(search?: string): string | null {
  if (typeof window === 'undefined' && search === undefined) return null;
  try {
    const rawSearch = search !== undefined ? search : window.location.search;
    const params = new URLSearchParams(rawSearch || '');
    const dParam = (params.get('d') || '').trim();
    const gasParam = (params.get('gas') || '').trim();

    let resolvedUrl = '';
    if (dParam) {
      resolvedUrl = buildGasUrlFromId(dParam);
    }
    if (!resolvedUrl && gasParam) {
      const asId = buildGasUrlFromId(gasParam);
      if (asId) {
        resolvedUrl = asId;
      } else {
        const check = validateGasUrlClient(gasParam);
        if (check.valid) {
          resolvedUrl = check.normalizedUrl || gasParam;
        }
      }
    }

    if (!resolvedUrl) return null;

    hasUrlDriveOverride = true;
    inMemoryDriveConfig = {
      ...inMemoryDriveConfig,
      webappUrl: resolvedUrl,
      syncStatus: 'synced'
    };
    runtimeConfigCache = {
      ...runtimeConfigCache,
      cloudConfigured: true
    };
    listeners.forEach((fn) => fn(getDriveConfig()));
    runtimeListeners.forEach((fn) => fn(runtimeConfigCache));
    return resolvedUrl;
  } catch {
    return null;
  }
}

// Aplica imediatamente na inicialização: prioridade 1 = ?d= da URL pública; prioridade 2 = Drive fixado no painel admin
applyDriveOverrideFromLocation();
hydratePinnedAdminDrive();

export function getSavedDrives(): SavedDriveProfile[] {
  return [...savedDrivesCache];
}

export function subscribeSavedDrives(listener: (drives: SavedDriveProfile[]) => void): () => void {
  savedDrivesListeners.add(listener);
  return () => savedDrivesListeners.delete(listener);
}

export function saveAndPinDriveProfile(params: {
  webappUrl: string;
  apiToken?: string;
  label?: string;
  spreadsheetName?: string;
}): SavedDriveProfile {
  const check = validateGasUrlClient(params.webappUrl);
  if (!check.valid) {
    throw new Error(check.error || 'URL do Google Apps Script inválida.');
  }
  const normalizedUrl = check.normalizedUrl || normalizeGasUrl(params.webappUrl);
  const deploymentId = extractGasDeploymentId(normalizedUrl);
  const id = deploymentId || normalizedUrl;
  const token = (params.apiToken || '').trim();

  const existing = savedDrivesCache.find((d) => d.id === id || normalizeGasUrl(d.webappUrl) === normalizedUrl);
  const shortSuffix = deploymentId ? deploymentId.slice(-6) : 'Drive';
  const resolvedLabel =
    (params.label || '').trim() ||
    (params.spreadsheetName || '').trim() ||
    existing?.label ||
    `Drive ${shortSuffix}`;

  const profile: SavedDriveProfile = {
    id,
    label: resolvedLabel,
    webappUrl: normalizedUrl,
    apiToken: token || undefined,
    spreadsheetName: (params.spreadsheetName || '').trim() || existing?.spreadsheetName,
    savedAt: Date.now()
  };

  const nextList = [profile, ...savedDrivesCache.filter((d) => d.id !== id && normalizeGasUrl(d.webappUrl) !== normalizedUrl)];
  savedDrivesCache = nextList;
  writeSavedDrivesStorage(nextList);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(
        ACTIVE_DRIVE_PINNED_KEY,
        JSON.stringify({ webappUrl: normalizedUrl, apiToken: token })
      );
    } catch {
      // ignore
    }
  }

  hasPinnedAdminDrive = true;
  saveDriveConfig(
    {
      webappUrl: normalizedUrl,
      apiToken: token,
      spreadsheetName: profile.spreadsheetName,
      syncStatus: 'synced'
    },
    true
  );

  savedDrivesListeners.forEach((fn) => fn(getSavedDrives()));
  return profile;
}

export function selectSavedDriveProfile(id: string): SavedDriveProfile | null {
  const found = savedDrivesCache.find((d) => d.id === id);
  if (!found) return null;

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(
        ACTIVE_DRIVE_PINNED_KEY,
        JSON.stringify({ webappUrl: found.webappUrl, apiToken: found.apiToken || '' })
      );
    } catch {
      // ignore
    }
  }

  hasPinnedAdminDrive = true;
  saveDriveConfig(
    {
      webappUrl: found.webappUrl,
      apiToken: found.apiToken || '',
      spreadsheetName: found.spreadsheetName,
      syncStatus: 'synced'
    },
    true
  );
  return found;
}

export function removeSavedDriveProfile(id: string): void {
  const removed = savedDrivesCache.find((d) => d.id === id);
  savedDrivesCache = savedDrivesCache.filter((d) => d.id !== id);
  writeSavedDrivesStorage(savedDrivesCache);

  if (removed && normalizeGasUrl(inMemoryDriveConfig.webappUrl) === normalizeGasUrl(removed.webappUrl)) {
    const fallback = savedDrivesCache[0];
    if (fallback) {
      selectSavedDriveProfile(fallback.id);
    } else {
      clearPinnedDrive();
    }
  }

  savedDrivesListeners.forEach((fn) => fn(getSavedDrives()));
}

export function clearPinnedDrive(): void {
  hasPinnedAdminDrive = false;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(ACTIVE_DRIVE_PINNED_KEY);
    } catch {
      // ignore
    }
  }
  saveDriveConfig({
    webappUrl: initialGlobalUrl,
    apiToken: initialGlobalToken,
    syncStatus: initialGlobalUrl ? 'synced' : 'offline'
  });
}

export function buildPublicEventPath(slug?: string, explicitWebappUrl?: string): string {
  const basePath = slug ? `/agendar/${encodeURIComponent(slug)}` : '/agendar';
  const activeUrl = (explicitWebappUrl || inMemoryDriveConfig.webappUrl || initialGlobalUrl || '').trim();
  if (!activeUrl) return basePath;

  const deploymentId = extractGasDeploymentId(activeUrl);
  if (deploymentId) {
    return `${basePath}?d=${encodeURIComponent(deploymentId)}`;
  }

  const check = validateGasUrlClient(activeUrl);
  if (check.valid) {
    return `${basePath}?gas=${encodeURIComponent(check.normalizedUrl || activeUrl)}`;
  }

  return basePath;
}

export function getRuntimeConfig(): RuntimeConfig {
  return runtimeConfigCache;
}

export function subscribeRuntimeConfig(listener: (rt: RuntimeConfig) => void): () => void {
  runtimeListeners.add(listener);
  return () => runtimeListeners.delete(listener);
}

let runtimeFetchPromise: Promise<RuntimeConfig> | null = null;

export async function hydrateRuntimeConfig(): Promise<RuntimeConfig> {
  if (runtimeConfigCache.loaded) return runtimeConfigCache;
  if (runtimeFetchPromise) return runtimeFetchPromise;

  runtimeFetchPromise = (async () => {
    try {
      const res = await fetch('/api/runtime-config', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        const serverWebappUrl = typeof json.webappUrl === 'string' ? json.webappUrl.trim() : '';
        const serverApiToken = typeof json.apiToken === 'string' ? json.apiToken.trim() : '';

        const candidateUrl = serverWebappUrl || initialGlobalUrl;
        const urlCheck = candidateUrl ? validateGasUrlClient(candidateUrl) : { valid: false };
        const validUrl = urlCheck.valid ? (urlCheck.normalizedUrl || candidateUrl) : '';
        const effectiveToken = serverApiToken || initialGlobalToken;

        runtimeConfigCache = {
          cloudConfigured:
            hasUrlDriveOverride ||
            hasPinnedAdminDrive ||
            Boolean(json.cloudConfigured && validUrl) ||
            Boolean(validUrl),
          engsegRequired:
            Boolean(json.engsegRequired) ||
            String(import.meta.env.VITE_ENGSEG_REQUIRED || '').toLowerCase() === 'true',
          engsegEmail: typeof json.engsegEmail === 'string' ? json.engsegEmail.trim() : '',
          loaded: true
        };

        if (!hasUrlDriveOverride && !hasPinnedAdminDrive && validUrl && !inMemoryDriveConfig.webappUrl) {
          inMemoryDriveConfig = {
            ...inMemoryDriveConfig,
            webappUrl: validUrl,
            apiToken: effectiveToken || inMemoryDriveConfig.apiToken,
            syncStatus: 'synced'
          };
        }
      } else {
        runtimeConfigCache = { ...runtimeConfigCache, loaded: true };
      }
    } catch {
      runtimeConfigCache = { ...runtimeConfigCache, loaded: true };
    }
    runtimeListeners.forEach((fn) => fn(runtimeConfigCache));
    listeners.forEach((fn) => fn(getDriveConfig()));
    return runtimeConfigCache;
  })();

  return runtimeFetchPromise;
}

export function isCloudActive(): boolean {
  return Boolean(
    hasUrlDriveOverride ||
      hasPinnedAdminDrive ||
      inMemoryDriveConfig.webappUrl.trim() ||
      initialGlobalUrl ||
      runtimeConfigCache.cloudConfigured
  );
}

export function getDriveConfig(): DriveConfig {
  return { ...inMemoryDriveConfig };
}

export function saveDriveConfig(
  partial: Partial<DriveConfig>,
  persistToServer: boolean = false
): DriveConfig {
  const next: DriveConfig = {
    ...inMemoryDriveConfig,
    ...partial
  };

  if (partial.webappUrl !== undefined) {
    const clean = normalizeGasUrl(partial.webappUrl);
    next.webappUrl = clean;
    if (!clean && !runtimeConfigCache.cloudConfigured) {
      next.syncStatus = 'offline';
    }
  }

  inMemoryDriveConfig = next;

  if (persistToServer) {
    const urlValid = !next.webappUrl || validateGasUrlClient(next.webappUrl).valid;
    if (urlValid) {
      if (next.webappUrl) {
        runtimeConfigCache = { ...runtimeConfigCache, cloudConfigured: true };
        runtimeListeners.forEach((fn) => fn(runtimeConfigCache));
      }
      fetch('/api/server-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webappUrl: next.webappUrl,
          apiToken: next.apiToken || ''
        })
      }).catch(() => {});
    }
  }

  listeners.forEach((fn) => fn(getDriveConfig()));
  return getDriveConfig();
}

export function subscribeDriveConfig(listener: (cfg: DriveConfig) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const executeDriveRequest = async <T = any>(payload: {
  targetUrl?: string;
  action: string;
  data?: any;
  apiToken?: string;
  fileName?: string;
  slug?: string;
  nocache?: boolean;
}): Promise<T> => {
  const resolvedTarget = (payload.targetUrl || inMemoryDriveConfig.webappUrl || initialGlobalUrl || '').trim();
  const resolvedToken = (payload.apiToken ?? inMemoryDriveConfig.apiToken ?? initialGlobalToken ?? '').trim();

  const cleanPayload = {
    ...payload,
    ...(resolvedTarget ? { targetUrl: resolvedTarget } : {}),
    ...(resolvedToken ? { apiToken: resolvedToken } : {})
  };

  if (cleanPayload.targetUrl) {
    const check = validateGasUrlClient(cleanPayload.targetUrl);
    if (!check.valid) {
      throw new Error(check.error || 'URL do Google Apps Script inválida.');
    }
    cleanPayload.targetUrl = check.normalizedUrl || cleanPayload.targetUrl.trim();
  }

  const res = await fetch('/api/drive-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cleanPayload)
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    if (text.includes('A server error has occurred') || text.includes('server error')) {
      throw new Error(
        'O servidor proxy ou o Google Apps Script retornou "A server error has occurred". Se estiver na Vercel, faça o Redeploy com a versão atualizada do projeto e verifique se a URL do Apps Script termina em "/exec", com "Executar como: Eu" e "Quem tem acesso: Qualquer pessoa".'
      );
    }
    throw new Error(text || `Falha na sincronização (HTTP ${res.status}).`);
  }

  if (!res.ok || data.status === 'error' || data.status === 'unauthorized' || data.success === false) {
    throw new Error(data.message || data.error || `Falha na sincronização (HTTP ${res.status}).`);
  }
  return data;
};

/**
 * Testar Conexão / Ping (Motor DADOS DRIVE v2.0)
 * Só persiste a URL no servidor após o Ping confirmar sucesso!
 */
export const testDriveConnection = async (url?: string, token?: string) => {
  const normalizedUrl = url ? normalizeGasUrl(url) : undefined;
  const res = await executeDriveRequest({
    targetUrl: normalizedUrl || undefined,
    action: 'ping',
    apiToken: token
  });

  saveDriveConfig(
    {
      ...(normalizedUrl ? { webappUrl: normalizedUrl } : {}),
      ...(token !== undefined ? { apiToken: token } : {}),
      syncStatus: 'synced',
      spreadsheetUrl: res.spreadsheetUrl,
      spreadsheetName: res.spreadsheetName,
      exportXlsxUrl: res.exportXlsxUrl,
      folderPath: res.folder || 'Agenda Ativa/AppDatabase_Data'
    },
    Boolean(normalizedUrl)
  );

  return res;
};

/**
 * Sincronizar / Salvar no Google Drive + Batch Sheets
 */
export const pushToGoogleDrive = async (url: string | undefined, dbData: any, token?: string) => {
  saveDriveConfig({ syncStatus: 'syncing' });
  try {
    const res = await executeDriveRequest({
      targetUrl: url || undefined,
      action: 'save',
      data: dbData,
      apiToken: token
    });
    saveDriveConfig({
      syncStatus: 'synced',
      lastSyncTimestamp: Date.now(),
      spreadsheetUrl: res.spreadsheetUrl || getDriveConfig().spreadsheetUrl,
      spreadsheetName: res.spreadsheetName || getDriveConfig().spreadsheetName,
      exportXlsxUrl: res.exportXlsxUrl || getDriveConfig().exportXlsxUrl
    });
    return res;
  } catch (err) {
    saveDriveConfig({ syncStatus: 'error' });
    throw err;
  }
};

/**
 * Puxar dados da Nuvem (Cache <100ms ou Drive JSON / Sheets)
 */
export const fetchFromGoogleDrive = async (
  url: string | undefined,
  token?: string,
  nocache: boolean = false
) => {
  saveDriveConfig({ syncStatus: 'syncing' });
  try {
    const res = await executeDriveRequest({
      targetUrl: url || undefined,
      action: 'get',
      apiToken: token,
      nocache
    });
    saveDriveConfig({
      syncStatus: 'synced',
      lastSyncTimestamp: Date.now()
    });
    return res;
  } catch (err) {
    saveDriveConfig({ syncStatus: 'error' });
    throw err;
  }
};

/**
 * Listar arquivos e checkpoints na pasta Agenda Ativa/AppDatabase_Data
 */
export const listDriveFiles = async (url?: string, token?: string): Promise<DriveFileEntry[]> => {
  const res = await executeDriveRequest<{ files: DriveFileEntry[] }>({
    targetUrl: url || undefined,
    action: 'list_files',
    apiToken: token
  });
  return res.files || [];
};

/**
 * Criar Checkpoint manual no Google Drive
 */
export const createDriveCheckpoint = async (url: string | undefined, dbData: any, token?: string) => {
  return executeDriveRequest({
    targetUrl: url || undefined,
    action: 'create_checkpoint',
    data: dbData,
    apiToken: token
  });
};

/**
 * Restaurar Checkpoint como database_root.json
 */
export const restoreDriveCheckpoint = async (
  url: string | undefined,
  fileName: string,
  token?: string
) => {
  return executeDriveRequest({
    targetUrl: url || undefined,
    action: 'set_as_root',
    fileName,
    apiToken: token
  });
};

/**
 * Configurar ou remover API_SECRET no Apps Script
 */
export const configureDriveApiSecret = async (
  url: string | undefined,
  newSecret: string,
  currentToken?: string
) => {
  return executeDriveRequest({
    targetUrl: url || undefined,
    action: 'SET_API_SECRET',
    data: { newSecret },
    apiToken: currentToken
  });
};
