import { GLOBAL_GAS_CONFIG } from '../config/gasConfig';

/**
 * Agenda Ativa — Serviço Cliente DADOS DRIVE v2.0
 * Comunicação via proxy reverso /api/drive-proxy (Anti-CORS / Anti-Iframe)
 * Suporta URL configurada no painel (localStorage), GLOBAL_GAS_CONFIG ou variáveis de ambiente.
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

const DRIVE_CONFIG_KEY = 'AGENDA_ATIVA_DRIVE_CONFIG_V2';
const LEGACY_GAS_URL_KEY = 'SISTEMA_AGENDAMENTO_GAS_WEBAPP_URL';

const listeners = new Set<(cfg: DriveConfig) => void>();
const runtimeListeners = new Set<(rt: RuntimeConfig) => void>();

let runtimeConfigCache: RuntimeConfig = {
  cloudConfigured: Boolean((import.meta.env.VITE_GAS_WEBAPP_URL || GLOBAL_GAS_CONFIG.WEBAPP_URL || '').trim()),
  engsegRequired: String(import.meta.env.VITE_ENGSEG_REQUIRED || '').toLowerCase() === 'true',
  engsegEmail: '',
  loaded: false
};

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
        runtimeConfigCache = {
          cloudConfigured:
            Boolean(json.cloudConfigured) ||
            Boolean((import.meta.env.VITE_GAS_WEBAPP_URL || GLOBAL_GAS_CONFIG.WEBAPP_URL || '').trim()),
          engsegRequired:
            Boolean(json.engsegRequired) ||
            String(import.meta.env.VITE_ENGSEG_REQUIRED || '').toLowerCase() === 'true',
          engsegEmail: typeof json.engsegEmail === 'string' ? json.engsegEmail.trim() : '',
          loaded: true
        };

        const serverWebappUrl = typeof json.webappUrl === 'string' ? json.webappUrl.trim() : '';
        const serverApiToken = typeof json.apiToken === 'string' ? json.apiToken.trim() : '';
        const effectiveServerUrl = serverWebappUrl || GLOBAL_GAS_CONFIG.WEBAPP_URL.trim();
        const effectiveServerToken = serverApiToken || GLOBAL_GAS_CONFIG.API_TOKEN.trim();

        if (effectiveServerUrl) {
          const currentLocal = getDriveConfig();
          if (!currentLocal.webappUrl.trim()) {
            saveDriveConfig({ webappUrl: effectiveServerUrl, ...(effectiveServerToken ? { apiToken: effectiveServerToken } : {}) });
          }
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
  const cfg = getDriveConfig();
  return Boolean(
    cfg.webappUrl.trim() ||
      GLOBAL_GAS_CONFIG.WEBAPP_URL.trim() ||
      (import.meta.env.VITE_GAS_WEBAPP_URL || '').trim() ||
      runtimeConfigCache.cloudConfigured
  );
}

export function getDriveConfig(): DriveConfig {
  const globalGasUrl = (import.meta.env.VITE_GAS_WEBAPP_URL || GLOBAL_GAS_CONFIG.WEBAPP_URL || '').trim();
  const globalToken = (GLOBAL_GAS_CONFIG.API_TOKEN || '').trim();

  try {
    const raw = localStorage.getItem(DRIVE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DriveConfig;
      const effectiveUrl =
        parsed.webappUrl || localStorage.getItem(LEGACY_GAS_URL_KEY) || globalGasUrl || '';
      const effectiveToken = parsed.apiToken || globalToken || '';
      const active = Boolean(effectiveUrl || runtimeConfigCache.cloudConfigured);
      return {
        webappUrl: effectiveUrl,
        apiToken: effectiveToken,
        autoSync: parsed.autoSync ?? true,
        syncStatus: active ? (parsed.syncStatus && parsed.syncStatus !== 'offline' ? parsed.syncStatus : 'synced') : 'offline',
        lastSyncTimestamp: parsed.lastSyncTimestamp,
        spreadsheetUrl: parsed.spreadsheetUrl,
        spreadsheetName: parsed.spreadsheetName,
        exportXlsxUrl: parsed.exportXlsxUrl,
        folderPath: parsed.folderPath || 'Agenda Ativa/AppDatabase_Data'
      };
    }
  } catch (e) {
    console.warn('Erro ao ler DriveConfig:', e);
  }

  const legacyUrl = localStorage.getItem(LEGACY_GAS_URL_KEY) || globalGasUrl || '';
  const active = Boolean(legacyUrl || runtimeConfigCache.cloudConfigured);
  return {
    webappUrl: legacyUrl,
    apiToken: globalToken,
    autoSync: true,
    syncStatus: active ? 'synced' : 'offline',
    folderPath: 'Agenda Ativa/AppDatabase_Data'
  };
}

export function saveDriveConfig(partial: Partial<DriveConfig>): DriveConfig {
  const current = getDriveConfig();
  const next: DriveConfig = {
    ...current,
    ...partial
  };
  if (partial.webappUrl !== undefined) {
    localStorage.setItem(LEGACY_GAS_URL_KEY, partial.webappUrl.trim());
    next.webappUrl = partial.webappUrl.trim();
    if (!next.webappUrl && !runtimeConfigCache.cloudConfigured) {
      next.syncStatus = 'offline';
    }
  }
  try {
    localStorage.setItem(DRIVE_CONFIG_KEY, JSON.stringify(next));
  } catch (e) {
    console.error('Erro ao salvar DriveConfig:', e);
  }

  fetch('/api/server-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webappUrl: next.webappUrl,
      apiToken: next.apiToken || ''
    })
  }).catch(() => {});

  listeners.forEach((fn) => fn(next));
  return next;
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === DRIVE_CONFIG_KEY || e.key === LEGACY_GAS_URL_KEY) {
      const updatedCfg = getDriveConfig();
      listeners.forEach((fn) => fn(updatedCfg));
    }
  });
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
  const res = await fetch('/api/drive-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok || data.status === 'error' || data.status === 'unauthorized' || data.success === false) {
    throw new Error(data.message || data.error || `Falha na sincronização (HTTP ${res.status}).`);
  }
  return data;
};

/**
 * Testar Conexão / Ping (Motor DADOS DRIVE v2.0)
 */
export const testDriveConnection = async (url?: string, token?: string) => {
  const res = await executeDriveRequest({
    targetUrl: url || undefined,
    action: 'ping',
    apiToken: token
  });

  saveDriveConfig({
    ...(url ? { webappUrl: url } : {}),
    ...(token !== undefined ? { apiToken: token } : {}),
    syncStatus: 'synced',
    spreadsheetUrl: res.spreadsheetUrl,
    spreadsheetName: res.spreadsheetName,
    exportXlsxUrl: res.exportXlsxUrl,
    folderPath: res.folder || 'Agenda Ativa/AppDatabase_Data'
  });

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
 * Puxar dados da Nuvem (Cache <100ms ou Drive JSON)
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
