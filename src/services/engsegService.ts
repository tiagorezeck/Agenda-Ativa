/**
 * Módulo ENGSEG — Autenticação 2FA por E-mail com Botão Único de Ativação/Desativação
 * Protege o painel administrativo quando ativo (localmente ou via ENGSEG_REQUIRED no servidor);
 * A página pública permanece sempre aberta aos clientes.
 */

import {
  executeDriveRequest,
  getDriveConfig,
  getRuntimeConfig,
  isCloudActive
} from './driveSyncService';
import { storage } from './storageService';

const ENGSEG_CONFIG_KEY = 'AGENDA_ATIVA_ENGSEG_2FA_CONFIG';
const ENGSEG_SESSION_KEY = 'AGENDA_ATIVA_ENGSEG_2FA_VERIFIED';
const ENGSEG_LOCAL_OTP_KEY = 'AGENDA_ATIVA_ENGSEG_LOCAL_OTP';

export interface EngsegConfig {
  enabled: boolean;
  email: string;
  sessionMinutes: number;
  enforcedByServer?: boolean;
}

const listeners = new Set<() => void>();

export function notifyEngsegListeners() {
  listeners.forEach((fn) => fn());
}

export function subscribeEngseg(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getEngsegConfig(): EngsegConfig {
  const db = storage.getDatabase();
  const runtime = getRuntimeConfig();

  const defaultEmail =
    runtime.engsegEmail ||
    db.config.find((c) => c.chave === 'EMPRESA_EMAIL')?.valor ||
    db.usuarios.find((u) => u.perfil === 'ADMIN')?.email ||
    'comercial@empresa.com.br';

  let localEnabled = false;
  let localEmail = defaultEmail;
  let sessionMinutes = 120;

  try {
    const raw = localStorage.getItem(ENGSEG_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<EngsegConfig>;
      localEnabled = Boolean(parsed.enabled);
      localEmail = parsed.email || defaultEmail;
      sessionMinutes = parsed.sessionMinutes || 120;
    }
  } catch (e) {
    console.warn('Erro ao ler config ENGSEG:', e);
  }

  return {
    enabled: runtime.engsegRequired || localEnabled,
    email: runtime.engsegEmail || localEmail,
    sessionMinutes,
    enforcedByServer: runtime.engsegRequired
  };
}

export function saveEngsegConfig(partial: Partial<EngsegConfig>): EngsegConfig {
  const current = getEngsegConfig();
  const next: EngsegConfig = {
    ...current,
    ...partial
  };
  localStorage.setItem(
    ENGSEG_CONFIG_KEY,
    JSON.stringify({
      enabled: next.enabled,
      email: next.email,
      sessionMinutes: next.sessionMinutes
    })
  );
  notifyEngsegListeners();
  return next;
}

/**
 * Botão Único de Ativação / Desativação para Testes
 */
export function toggleEngseg2FA(lockImmediatelyOnEnable: boolean = true): EngsegConfig {
  const current = getEngsegConfig();
  if (current.enforcedByServer) {
    return current;
  }

  const nextEnabled = !current.enabled;

  if (!nextEnabled) {
    clearEngsegSession();
  } else if (lockImmediatelyOnEnable) {
    clearEngsegSession();
  }

  return saveEngsegConfig({ enabled: nextEnabled });
}

export function isEngsegSessionVerified(): boolean {
  const cfg = getEngsegConfig();
  if (!cfg.enabled) return true;

  try {
    const raw = sessionStorage.getItem(ENGSEG_SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { email: string; expiresAt: number };
    if (Date.now() > parsed.expiresAt) {
      sessionStorage.removeItem(ENGSEG_SESSION_KEY);
      return false;
    }
    return parsed.email.toLowerCase() === cfg.email.toLowerCase();
  } catch {
    return false;
  }
}

export function markEngsegSessionVerified(email: string) {
  const cfg = getEngsegConfig();
  const expiresAt = Date.now() + cfg.sessionMinutes * 60 * 1000;
  sessionStorage.setItem(
    ENGSEG_SESSION_KEY,
    JSON.stringify({ email: email.toLowerCase(), expiresAt })
  );
  notifyEngsegListeners();
}

export function clearEngsegSession() {
  sessionStorage.removeItem(ENGSEG_SESSION_KEY);
  sessionStorage.removeItem(ENGSEG_LOCAL_OTP_KEY);
  notifyEngsegListeners();
}

export interface Send2FAResult {
  mode: 'gas_email' | 'local_test';
  message: string;
  testCode?: string;
}

export async function sendEngseg2FACode(targetEmail: string): Promise<Send2FAResult> {
  const email = targetEmail.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Informe um e-mail válido para receber o código 2FA.');
  }

  const drive = getDriveConfig();

  // Se houver nuvem ativa (WebApp URL no painel ou GAS_WEBAPP_URL no servidor), envia e-mail real via MailApp
  if (isCloudActive()) {
    const res = await executeDriveRequest({
      targetUrl: drive.webappUrl || undefined,
      action: 'SEND_2FA_CODE',
      data: { email },
      apiToken: drive.apiToken
    });
    return {
      mode: 'gas_email',
      message: res.message || `Código enviado para ${email} via Google Apps Script.`
    };
  }

  // Modo Teste Local (Offline / Sem Web App URL configurada)
  const code = String(Math.floor(100000 + Math.random() * 900000));
  sessionStorage.setItem(
    ENGSEG_LOCAL_OTP_KEY,
    JSON.stringify({
      email,
      code,
      expiresAt: Date.now() + 5 * 60 * 1000
    })
  );

  return {
    mode: 'local_test',
    message: `Modo Teste Offline ativo (sem Web App URL). Código gerado para ${email}.`,
    testCode: code
  };
}

export async function verifyEngseg2FACode(targetEmail: string, code: string): Promise<boolean> {
  const email = targetEmail.trim().toLowerCase();
  const cleanCode = code.trim();

  if (!cleanCode || cleanCode.length < 6) {
    throw new Error('Digite o código completo de 6 dígitos.');
  }

  const drive = getDriveConfig();

  if (isCloudActive()) {
    await executeDriveRequest({
      targetUrl: drive.webappUrl || undefined,
      action: 'VERIFY_2FA_CODE',
      data: { email, code: cleanCode },
      apiToken: drive.apiToken
    });
    markEngsegSessionVerified(email);
    return true;
  }

  // Validação em Modo Teste Local
  const raw = sessionStorage.getItem(ENGSEG_LOCAL_OTP_KEY);
  if (!raw) {
    throw new Error('Nenhum código ativo encontrado. Clique em "Enviar Código 2FA" primeiro.');
  }
  const stored = JSON.parse(raw) as { email: string; code: string; expiresAt: number };
  if (Date.now() > stored.expiresAt) {
    sessionStorage.removeItem(ENGSEG_LOCAL_OTP_KEY);
    throw new Error('Código expirado. Solicite um novo código.');
  }
  if (stored.email !== email || stored.code !== cleanCode) {
    throw new Error('Código 2FA inválido. Verifique os 6 dígitos e tente novamente.');
  }

  sessionStorage.removeItem(ENGSEG_LOCAL_OTP_KEY);
  markEngsegSessionVerified(email);
  return true;
}
