import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../../services/storageService';
import { GasApiClient } from '../../services/gasApiClient';
import {
  getDriveConfig,
  saveDriveConfig,
  subscribeDriveConfig,
  getRuntimeConfig,
  subscribeRuntimeConfig,
  isCloudActive,
  listDriveFiles,
  createDriveCheckpoint,
  restoreDriveCheckpoint,
  configureDriveApiSecret,
  validateGasUrlClient,
  normalizeGasUrl,
  extractGasDeploymentId,
  getSavedDrives,
  subscribeSavedDrives,
  saveAndPinDriveProfile,
  selectSavedDriveProfile,
  removeSavedDriveProfile,
  DriveConfig,
  RuntimeConfig,
  DriveFileEntry,
  SavedDriveProfile
} from '../../services/driveSyncService';
import { compressImageFileToDataUrl } from '../../utils/imageCompressor';
import {
  aplicarMascaraTelefoneBR,
  isTelefoneBRValido,
  normalizarWhatsApp,
  sanitizarEmailInput,
  isEmailValido
} from '../../utils/formatters';
import {
  getEngsegConfig,
  saveEngsegConfig,
  toggleEngseg2FA,
  clearEngsegSession,
  subscribeEngseg,
  isEngsegSessionVerified,
  EngsegConfig
} from '../../services/engsegService';
import codeGsRaw from '../../gas/Code.gs?raw';
import {
  Database,
  Building,
  Copy,
  Check,
  RotateCcw,
  Clock,
  Image as ImageIcon,
  X,
  CloudUpload,
  CloudDownload,
  ShieldCheck,
  KeyRound,
  History,
  FolderOpen,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Lock,
  Unlock,
  Loader2,
  AlertCircle,
  BookmarkCheck,
  Plus,
  Trash2,
  ExternalLink,
  Mail,
  Phone,
  MapPin
} from 'lucide-react';
import {
  getLoggedInUser,
  podeAcessarConfigBanco,
  podeAcessarConfigEngseg
} from '../../services/authService';

export type SettingsSection = 'empresa' | 'banco' | 'engseg';

interface SettingsViewProps {
  section: SettingsSection;
  onDataSynced?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ section, onDataSynced }) => {
  const db = storage.getDatabase();
  const [currentUser, setCurrentUser] = useState(() => getLoggedInUser());

  useEffect(() => {
    const handleAuth = () => setCurrentUser(getLoggedInUser());
    window.addEventListener('auth_user_changed', handleAuth);
    return () => {
      window.removeEventListener('auth_user_changed', handleAuth);
    };
  }, []);

  const canAccessBanco = podeAcessarConfigBanco(currentUser);
  const canAccessEngseg = podeAcessarConfigEngseg(currentUser);

  const [empresaNome, setEmpresaNome] = useState(
    db.config.find(c => c.chave === 'EMPRESA_NOME')?.valor || 'Agenda Ativa'
  );
  const [empresaLogo, setEmpresaLogo] = useState(
    db.config.find(c => c.chave === 'EMPRESA_LOGO')?.valor || ''
  );
  const [whatsappContato, setWhatsappContato] = useState(() =>
    aplicarMascaraTelefoneBR(db.config.find(c => c.chave === 'WHATSAPP_CONTATO')?.valor || '')
  );
  const [empresaEmail, setEmpresaEmail] = useState(
    db.config.find(c => c.chave === 'EMPRESA_EMAIL')?.valor || ''
  );
  const [empresaEndereco, setEmpresaEndereco] = useState(
    db.config.find(c => c.chave === 'EMPRESA_ENDERECO')?.valor || ''
  );
  const [empresaCnpj, setEmpresaCnpj] = useState(
    db.config.find(c => c.chave === 'EMPRESA_CNPJ')?.valor || ''
  );
  const [termosLgpd, setTermosLgpd] = useState(
    db.config.find(c => c.chave === 'TERMOS_LGPD')?.valor || ''
  );

  // Motor DADOS DRIVE v2.0
  const [driveCfg, setDriveCfg] = useState<DriveConfig>(() => getDriveConfig());
  const [runtimeCfg, setRuntimeCfg] = useState<RuntimeConfig>(() => getRuntimeConfig());
  const [savedDrives, setSavedDrives] = useState<SavedDriveProfile[]>(() => getSavedDrives());
  const [gasUrl, setGasUrl] = useState(driveCfg.webappUrl);
  const [driveLabel, setDriveLabel] = useState(() => {
    const match = getSavedDrives().find(
      (d) => normalizeGasUrl(d.webappUrl) === normalizeGasUrl(driveCfg.webappUrl)
    );
    return match?.label || '';
  });
  const [apiToken, setApiToken] = useState(driveCfg.apiToken || '');

  const [testandoConexao, setTestandoConexao] = useState(false);
  const [salvandoDrive, setSalvandoDrive] = useState(false);
  const [syncBusy, setSyncBusy] = useState<'push' | 'pull' | 'secret' | 'checkpoint' | 'list' | 'restore' | null>(null);
  const [resultadoTeste, setResultadoTeste] = useState<{ success: boolean; message: string } | null>(null);
  const lastAutoConnectedUrlRef = useRef<string>(driveCfg.webappUrl || '');

  const [driveFiles, setDriveFiles] = useState<DriveFileEntry[]>([]);
  const [copiadoCodeGs, setCopiadoCodeGs] = useState(false);
  const [copiadoGasConfig, setCopiadoGasConfig] = useState(false);
  const [salvoMsg, setSalvoMsg] = useState(false);
  const [empresaErroMsg, setEmpresaErroMsg] = useState<string | null>(null);
  const [engsegErroMsg, setEngsegErroMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmResetZero, setConfirmResetZero] = useState(false);
  const [resettingZero, setResettingZero] = useState(false);

  // Módulo ENGSEG 2FA
  const [engsegCfg, setEngsegCfg] = useState<EngsegConfig>(() => getEngsegConfig());
  const [engsegVerified, setEngsegVerified] = useState<boolean>(() => isEngsegSessionVerified());

  useEffect(() => {
    const unsubDrive = subscribeDriveConfig((cfg) => {
      setDriveCfg(cfg);
    });
    const unsubSaved = subscribeSavedDrives((drives) => {
      setSavedDrives(drives);
    });
    const unsubRuntime = subscribeRuntimeConfig((rt) => {
      setRuntimeCfg(rt);
    });
    const unsubEngseg = subscribeEngseg(() => {
      setEngsegCfg(getEngsegConfig());
      setEngsegVerified(isEngsegSessionVerified());
    });
    const unsubStorage = storage.subscribe(() => {
      const latestDb = storage.getDatabase();
      setEmpresaNome(latestDb.config.find(c => c.chave === 'EMPRESA_NOME')?.valor || '');
      setEmpresaLogo(latestDb.config.find(c => c.chave === 'EMPRESA_LOGO')?.valor || '');
      setWhatsappContato(
        aplicarMascaraTelefoneBR(latestDb.config.find(c => c.chave === 'WHATSAPP_CONTATO')?.valor || '')
      );
      setEmpresaEmail(latestDb.config.find(c => c.chave === 'EMPRESA_EMAIL')?.valor || '');
      setEmpresaEndereco(latestDb.config.find(c => c.chave === 'EMPRESA_ENDERECO')?.valor || '');
      setEmpresaCnpj(latestDb.config.find(c => c.chave === 'EMPRESA_CNPJ')?.valor || '');
      setTermosLgpd(latestDb.config.find(c => c.chave === 'TERMOS_LGPD')?.valor || '');
    });
    return () => {
      unsubDrive();
      unsubSaved();
      unsubRuntime();
      unsubEngseg();
      unsubStorage();
    };
  }, []);

  const handleSalvarEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmpresaErroMsg(null);

    if (whatsappContato.trim() && !isTelefoneBRValido(whatsappContato)) {
      setEmpresaErroMsg('Informe um WhatsApp válido no padrão (XX) XXXXX-XXXX.');
      return;
    }

    if (empresaEmail.trim() && !isEmailValido(empresaEmail)) {
      setEmpresaErroMsg('Informe um e-mail oficial válido contendo @ (ex: contato@empresa.com.br).');
      return;
    }

    if (gasUrl.trim()) {
      const check = validateGasUrlClient(gasUrl);
      if (!check.valid) {
        setResultadoTeste({ success: false, message: check.error || 'URL do Google Apps Script inválida.' });
        return;
      }
      saveDriveConfig({ webappUrl: check.normalizedUrl || gasUrl.trim(), apiToken: apiToken.trim() }, true);
    }

    storage.updateConfig('EMPRESA_NOME', empresaNome.trim());
    storage.updateConfig('EMPRESA_LOGO', empresaLogo.trim());
    storage.updateConfig(
      'WHATSAPP_CONTATO',
      whatsappContato.trim() ? normalizarWhatsApp(whatsappContato) : ''
    );
    storage.updateConfig('EMPRESA_EMAIL', empresaEmail.trim().toLowerCase());
    storage.updateConfig('EMPRESA_ENDERECO', empresaEndereco.trim());
    storage.updateConfig('EMPRESA_CNPJ', empresaCnpj.trim());
    storage.updateConfig('TERMOS_LGPD', termosLgpd.trim());

    setSalvoMsg(true);
    setTimeout(() => setSalvoMsg(false), 3000);
    onDataSynced?.();
  };

  const hasAnyCloudUrl = () => Boolean(gasUrl.trim() || isCloudActive());

  const executarConexaoDrive = async (explicitUrl?: string) => {
    const rawUrl = (explicitUrl !== undefined ? explicitUrl : gasUrl).trim();
    if (!rawUrl && !isCloudActive()) {
      setResultadoTeste({
        success: false,
        message: 'Informe a URL da implantação do Apps Script para testar (ou defina GAS_WEBAPP_URL no Vercel).'
      });
      return;
    }

    let normalizedTarget = rawUrl;
    if (rawUrl) {
      const check = validateGasUrlClient(rawUrl);
      if (!check.valid) {
        setResultadoTeste({
          success: false,
          message: check.error || 'URL do Google Apps Script inválida.'
        });
        return;
      }
      normalizedTarget = check.normalizedUrl || normalizeGasUrl(rawUrl);
      if (normalizedTarget !== rawUrl) {
        setGasUrl(normalizedTarget);
      }
      lastAutoConnectedUrlRef.current = normalizedTarget;
    }

    setTestandoConexao(true);
    setResultadoTeste(null);

    const res = await GasApiClient.testConnection(
      normalizedTarget || undefined,
      apiToken.trim() || undefined
    );

    if (res.success) {
      try {
        const isBrandNewDrive = res.details?.hasDatabase === false;
        if (isBrandNewDrive) {
          storage.resetSystemToZero(true);
          await storage.pushToCloud();
          setResultadoTeste({
            success: true,
            message: `${res.message} Novo Drive conectado e inicializado do zero (sem nenhum dado · apenas login "admin" e senha "admin").`
          });
        } else {
          await storage.pullFromCloud(true);
          const updatedDb = storage.getDatabase();
          setResultadoTeste({
            success: true,
            message: `${res.message} Drive conectado automaticamente! Base carregada: ${updatedDb.eventos.length} evento(s), ${updatedDb.leads.length} lead(s) e ${updatedDb.agendamentos.length} agendamento(s).`
          });
        }
        onDataSynced?.();
      } catch (pullErr: any) {
        setResultadoTeste({
          success: true,
          message: `${res.message} (Aviso ao inicializar/puxar dados: ${pullErr.message})`
        });
      }
    } else {
      setResultadoTeste(res);
    }
    setTestandoConexao(false);
  };

  const handleTestarConexao = () => executarConexaoDrive();

  const handleSalvarEPinarDrive = async () => {
    const rawUrl = gasUrl.trim();
    const check = validateGasUrlClient(rawUrl);
    if (!check.valid) {
      setResultadoTeste({
        success: false,
        message: check.error || 'Informe uma URL /exec válida do Google Apps Script antes de salvar.'
      });
      return;
    }

    const normalizedUrl = check.normalizedUrl || normalizeGasUrl(rawUrl);
    setGasUrl(normalizedUrl);
    lastAutoConnectedUrlRef.current = normalizedUrl;
    setSalvandoDrive(true);
    setResultadoTeste(null);

    const res = await GasApiClient.testConnection(normalizedUrl, apiToken.trim() || undefined);
    if (!res.success) {
      setResultadoTeste(res);
      setSalvandoDrive(false);
      return;
    }

    const isBrandNewDrive = res.details?.hasDatabase === false;
    const sheetName = typeof res.details?.spreadsheetName === 'string' ? res.details.spreadsheetName : undefined;

    try {
      if (isBrandNewDrive) {
        storage.resetSystemToZero(true);
        const savedProfile = saveAndPinDriveProfile({
          webappUrl: normalizedUrl,
          apiToken: apiToken.trim(),
          label: driveLabel.trim() || sheetName || undefined,
          spreadsheetName: sheetName || undefined
        });
        await storage.pushToCloud();
        setDriveLabel(savedProfile.label);
        setResultadoTeste({
          success: true,
          message: `Novo Drive salvo e fixado (${savedProfile.label})! Inicializado do zero sem dados falsos (apenas login "admin" e senha "admin").`
        });
      } else {
        await storage.pullFromCloud(true);
        const updatedDb = storage.getDatabase();
        const nomeEmpresaSheet = updatedDb.config.find((c) => c.chave === 'EMPRESA_NOME')?.valor?.trim() || '';
        const savedProfile = saveAndPinDriveProfile({
          webappUrl: normalizedUrl,
          apiToken: apiToken.trim(),
          label: driveLabel.trim() || nomeEmpresaSheet || sheetName || undefined,
          spreadsheetName: sheetName || nomeEmpresaSheet || undefined
        });
        setDriveLabel(savedProfile.label);
        setResultadoTeste({
          success: true,
          message: `URL salva e fixada (${savedProfile.label})! Ela permanecerá ativa mesmo após atualizar a página até você trocar manualmente. Carregados: ${updatedDb.eventos.length} evento(s), ${updatedDb.leads.length} lead(s) e ${updatedDb.agendamentos.length} agendamento(s).`
        });
      }
      onDataSynced?.();
    } catch (pullErr: any) {
      const savedProfile = saveAndPinDriveProfile({
        webappUrl: normalizedUrl,
        apiToken: apiToken.trim(),
        label: driveLabel.trim() || sheetName || undefined,
        spreadsheetName: sheetName
      });
      setDriveLabel(savedProfile.label);
      setResultadoTeste({
        success: true,
        message: `URL salva e fixada (${savedProfile.label}), mas houve aviso ao sincronizar dados: ${pullErr.message}`
      });
    } finally {
      setSalvandoDrive(false);
    }
  };

  const handleSelecionarDriveSalvo = async (driveId: string) => {
    if (!driveId) return;
    const selected = selectSavedDriveProfile(driveId);
    if (!selected) return;

    setGasUrl(selected.webappUrl);
    setDriveLabel(selected.label);
    setApiToken(selected.apiToken || '');
    lastAutoConnectedUrlRef.current = selected.webappUrl;
    setTestandoConexao(true);
    setResultadoTeste(null);

    try {
      const res = await GasApiClient.testConnection(selected.webappUrl, selected.apiToken || undefined);
      if (res.success) {
        if (res.details?.hasDatabase === false) {
          storage.resetSystemToZero(true);
          await storage.pushToCloud();
          setResultadoTeste({
            success: true,
            message: `Novo Drive "${selected.label}" inicializado do zero (sem dados · apenas login "admin" / senha "admin").`
          });
        } else {
          await storage.pullFromCloud(true);
          const updatedDb = storage.getDatabase();
          setResultadoTeste({
            success: true,
            message: `Drive alternado para "${selected.label}"! Carregados: ${updatedDb.eventos.length} evento(s), ${updatedDb.leads.length} lead(s) e ${updatedDb.agendamentos.length} agendamento(s).`
          });
        }
        onDataSynced?.();
      } else {
        setResultadoTeste(res);
      }
    } catch (err: any) {
      setResultadoTeste({
        success: false,
        message: err?.message || `Falha ao carregar dados do Drive "${selected.label}".`
      });
    } finally {
      setTestandoConexao(false);
    }
  };

  const handlePrepararNovaUrl = () => {
    setGasUrl('');
    setDriveLabel('');
    setApiToken('');
    setResultadoTeste(null);
    lastAutoConnectedUrlRef.current = '';
  };

  const handleRemoverDriveSalvo = (driveId: string) => {
    removeSavedDriveProfile(driveId);
    const remaining = getSavedDrives();
    if (remaining.length > 0) {
      const next = remaining[0];
      setGasUrl(next.webappUrl);
      setDriveLabel(next.label);
      setApiToken(next.apiToken || '');
      lastAutoConnectedUrlRef.current = next.webappUrl;
      storage.pullFromCloud(true).then(() => onDataSynced?.()).catch(() => {});
    } else {
      setGasUrl('');
      setDriveLabel('');
      setApiToken('');
      lastAutoConnectedUrlRef.current = '';
    }
    setResultadoTeste({
      success: true,
      message: 'URL removida da lista de Drives salvos.'
    });
  };

  // Reconhecimento automático ao colar/digitar uma URL /exec válida diferente da atual
  useEffect(() => {
    const trimmed = gasUrl.trim();
    if (!trimmed) return;
    const check = validateGasUrlClient(trimmed);
    if (!check.valid) return;
    const normalized = check.normalizedUrl || normalizeGasUrl(trimmed);
    if (!normalized.toLowerCase().endsWith('/exec')) return;
    if (normalized === lastAutoConnectedUrlRef.current || normalized === driveCfg.webappUrl) {
      return;
    }

    const timer = window.setTimeout(() => {
      executarConexaoDrive(normalized);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [gasUrl, driveCfg.webappUrl]);

  const handlePushCloud = async () => {
    if (!hasAnyCloudUrl()) {
      setResultadoTeste({ success: false, message: 'Configure a URL do Web App antes de enviar para o Drive.' });
      return;
    }
    if (gasUrl.trim()) {
      const check = validateGasUrlClient(gasUrl);
      if (!check.valid) {
        setResultadoTeste({ success: false, message: check.error || 'URL do Web App inválida.' });
        return;
      }
      saveDriveConfig({ webappUrl: check.normalizedUrl || gasUrl.trim(), apiToken: apiToken.trim() }, true);
    }
    setSyncBusy('push');
    setResultadoTeste(null);
    try {
      const res = await storage.pushToCloud();
      setResultadoTeste({
        success: true,
        message: res?.message || 'Base completa salva no Drive (database_root.json) e espelhada nas 13 abas do Sheets.'
      });
    } catch (err: any) {
      setResultadoTeste({ success: false, message: err.message || 'Erro ao enviar para o Drive.' });
    } finally {
      setSyncBusy(null);
    }
  };

  const handlePullCloud = async () => {
    if (!hasAnyCloudUrl()) {
      setResultadoTeste({ success: false, message: 'Configure a URL do Web App antes de puxar da nuvem.' });
      return;
    }
    if (gasUrl.trim()) {
      const check = validateGasUrlClient(gasUrl);
      if (!check.valid) {
        setResultadoTeste({ success: false, message: check.error || 'URL do Web App inválida.' });
        return;
      }
      saveDriveConfig({ webappUrl: check.normalizedUrl || gasUrl.trim(), apiToken: apiToken.trim() }, true);
    }
    setSyncBusy('pull');
    setResultadoTeste(null);
    try {
      await storage.pullFromCloud(true);
      const updatedDb = storage.getDatabase();
      setResultadoTeste({
        success: true,
        message: `Dados carregados direto do Sheets (sem cache): ${updatedDb.eventos.length} evento(s), ${updatedDb.leads.length} lead(s) e ${updatedDb.agendamentos.length} agendamento(s).`
      });
      onDataSynced?.();
    } catch (err: any) {
      setResultadoTeste({ success: false, message: err.message || 'Erro ao puxar dados do Drive.' });
    } finally {
      setSyncBusy(null);
    }
  };

  const handleApplySecret = async () => {
    if (!hasAnyCloudUrl()) {
      setResultadoTeste({ success: false, message: 'Informe a URL do Web App para aplicar o API_SECRET.' });
      return;
    }
    setSyncBusy('secret');
    setResultadoTeste(null);
    try {
      const currentSavedToken = driveCfg.apiToken || '';
      const res = await configureDriveApiSecret(gasUrl.trim() || undefined, apiToken.trim(), currentSavedToken);
      saveDriveConfig({ ...(gasUrl.trim() ? { webappUrl: gasUrl.trim() } : {}), apiToken: apiToken.trim() });
      setResultadoTeste({
        success: true,
        message: res?.message || 'API_SECRET atualizado com segurança nas PropertiesService do GAS.'
      });
    } catch (err: any) {
      setResultadoTeste({ success: false, message: err.message || 'Falha ao atualizar API_SECRET.' });
    } finally {
      setSyncBusy(null);
    }
  };

  const handleCreateCheckpoint = async () => {
    if (!hasAnyCloudUrl()) {
      setResultadoTeste({ success: false, message: 'Configure a URL do Web App para criar checkpoints no Drive.' });
      return;
    }
    setSyncBusy('checkpoint');
    setResultadoTeste(null);
    try {
      const res = await createDriveCheckpoint(gasUrl.trim() || undefined, storage.getDatabase(), apiToken.trim() || undefined);
      setResultadoTeste({
        success: true,
        message: `Checkpoint criado no Drive: ${res.fileName || 'database_checkpoint.json'}`
      });
      await handleListFiles(true);
    } catch (err: any) {
      setResultadoTeste({ success: false, message: err.message || 'Erro ao criar checkpoint.' });
    } finally {
      setSyncBusy(null);
    }
  };

  const handleListFiles = async (silent: boolean = false) => {
    if (!hasAnyCloudUrl()) {
      if (!silent) {
        setResultadoTeste({ success: false, message: 'Configure a URL do Web App para listar arquivos.' });
      }
      return;
    }
    if (!silent) setSyncBusy('list');
    try {
      const files = await listDriveFiles(gasUrl.trim() || undefined, apiToken.trim() || undefined);
      setDriveFiles(files);
      if (!silent) {
        setResultadoTeste({
          success: true,
          message: `${files.length} arquivo(s) encontrado(s) na pasta Agenda Ativa/AppDatabase_Data.`
        });
      }
    } catch (err: any) {
      if (!silent) {
        setResultadoTeste({ success: false, message: err.message || 'Erro ao listar arquivos no Drive.' });
      }
    } finally {
      if (!silent) setSyncBusy(null);
    }
  };

  const handleRestoreCheckpoint = async (fileName: string) => {
    if (!hasAnyCloudUrl()) return;
    setSyncBusy('restore');
    setResultadoTeste(null);
    try {
      await restoreDriveCheckpoint(gasUrl.trim() || undefined, fileName, apiToken.trim() || undefined);
      await storage.pullFromCloud(true);
      setResultadoTeste({
        success: true,
        message: `Checkpoint "${fileName}" restaurado como database_root.json e aplicado localmente.`
      });
      onDataSynced?.();
    } catch (err: any) {
      setResultadoTeste({ success: false, message: err.message || 'Erro ao restaurar checkpoint.' });
    } finally {
      setSyncBusy(null);
    }
  };

  const handleCopiarScript = async () => {
    try {
      await navigator.clipboard.writeText(codeGsRaw);
      setCopiadoCodeGs(true);
      setTimeout(() => setCopiadoCodeGs(false), 2000);
    } catch {
      setResultadoTeste({
        success: false,
        message: 'Não foi possível acessar a área de transferência automaticamente para copiar o Code.gs.'
      });
    }
  };

  const handleResetarCenarioAceitacao = () => {
    storage.resetToDemo();
    setConfirmReset(false);
    setResultadoTeste({
      success: true,
      message: 'Cenário de Aceitação restaurado com sucesso.'
    });
    onDataSynced?.();
  };

  const handleResetarSistemaZero = async () => {
    setResettingZero(true);
    try {
      await storage.resetSystemAndSyncCloud();
      setConfirmResetZero(false);
      setResultadoTeste({
        success: true,
        message: 'Sistema resetado com sucesso! Todos os dados falsos foram excluídos. Apenas login "admin" / senha "admin" mantido.'
      });
      onDataSynced?.();
    } catch (err: any) {
      setResultadoTeste({
        success: false,
        message: err?.message || 'Sistema zerado localmente, mas houve erro ao limpar a nuvem.'
      });
    } finally {
      setResettingZero(false);
    }
  };

  const handleToggleEngsegSingleButton = () => {
    setEngsegErroMsg(null);
    const cleanEmail = engsegCfg.email.trim();
    if (!engsegCfg.enabled && !isEmailValido(cleanEmail)) {
      setEngsegErroMsg('Informe um e-mail autorizado válido contendo @ antes de ativar o 2FA.');
      return;
    }
    // Garante que o e-mail digitado esteja salvo antes de ativar o bloqueio 2FA
    saveEngsegConfig({ email: cleanEmail.toLowerCase() });
    toggleEngseg2FA(true);
  };

  const syncBadge = {
    synced: { label: 'Sincronizado', cls: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
    syncing: { label: 'Sincronizando...', cls: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
    error: { label: 'Erro de Sinc.', cls: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' },
    offline: { label: 'Modo Local', cls: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700' }
  }[driveCfg.syncStatus || 'offline'];

  const sectionHeader = {
    empresa: {
      title: 'Dados da Empresa & Atendimento',
      desc: 'Identidade institucional, logotipo exibido na página pública de agendamento, canais de contato e texto LGPD.',
      icon: Building
    },
    banco: {
      title: 'Banco de Dados — Motor DADOS DRIVE v2.0',
      desc: 'Conexão multi-drive com Google Apps Script, espelhamento em 13 abas no Google Sheets, checkpoints e sincronização.',
      icon: Database
    },
    engseg: {
      title: 'Engseg — Segurança 2FA por E-mail',
      desc: 'Proteja o painel administrativo do Agenda Ativa com código OTP de 6 dígitos enviado por e-mail via Apps Script.',
      icon: ShieldCheck
    }
  }[section];

  const SectionIcon = sectionHeader.icon;

  return (
    <div className="space-y-6">
      {/* Top Banner Contextual da Página */}
      <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm transition-colors">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 shrink-0">
            <SectionIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
              {sectionHeader.title}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-2xl">
              {sectionHeader.desc}
            </p>
          </div>
        </div>

        {section === 'banco' && canAccessBanco && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!confirmResetZero ? (
              <button
                type="button"
                onClick={() => {
                  setConfirmResetZero(true);
                  setConfirmReset(false);
                }}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-sm shadow-rose-600/20 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Resetar Sistema</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-xl px-3 py-1.5 text-xs">
                <span className="font-semibold text-rose-900 dark:text-rose-200">
                  Zerar tudo e manter só admin/admin?
                </span>
                <button
                  type="button"
                  disabled={resettingZero}
                  onClick={handleResetarSistemaZero}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white rounded-lg font-bold cursor-pointer inline-flex items-center gap-1"
                >
                  {resettingZero && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>Confirmar Reset</span>
                </button>
                <button
                  type="button"
                  disabled={resettingZero}
                  onClick={() => setConfirmResetZero(false)}
                  className="px-2 py-1 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            )}

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => {
                  setConfirmReset(true);
                  setConfirmResetZero(false);
                }}
                className="px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-950 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-300 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-orange-500" />
                <span>Carregar Dados Demo</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-xl px-3 py-1.5 text-xs">
                <span className="font-medium text-amber-900 dark:text-amber-200">Carregar demo?</span>
                <button
                  type="button"
                  onClick={handleResetarCenarioAceitacao}
                  className="px-2.5 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-2 py-1 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PÁGINA 1: DADOS DA EMPRESA */}
      {section === 'empresa' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
          {/* Formulário de Dados da Empresa */}
          <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-4 shadow-sm transition-colors">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-orange-500" />
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Dados da Empresa &amp; Atendimento
              </h3>
            </div>

            <form onSubmit={handleSalvarEmpresa} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Nome da Empresa / Projeto *
                </label>
                <input
                  type="text"
                  required
                  value={empresaNome}
                  onChange={(e) => setEmpresaNome(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Logo da Empresa */}
              <div className="p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-2">
                <label className="block font-semibold text-neutral-800 dark:text-neutral-200">
                  Logo da Empresa (exibida no rodapé da página pública)
                </label>
                <div className="flex items-center gap-3">
                  {empresaLogo ? (
                    <div className="relative group shrink-0">
                      <img
                        src={empresaLogo}
                        alt="Logo Empresa"
                        className="w-12 h-12 rounded-xl object-cover border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setEmpresaLogo('')}
                        className="absolute -top-1 -right-1 p-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full shadow-xs"
                        title="Remover logo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 flex flex-col items-center justify-center text-neutral-400 shrink-0 bg-white dark:bg-neutral-900">
                      <ImageIcon className="w-4 h-4 opacity-60" />
                      <span className="text-[8px] mt-0.5">Sem logo</span>
                    </div>
                  )}

                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={empresaLogo}
                      onChange={(e) => setEmpresaLogo(e.target.value)}
                      placeholder="URL da logo da empresa ou escolha um arquivo..."
                      className="flex-1 px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white text-xs focus:outline-none focus:border-orange-500"
                    />
                    <label className="px-3 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors">
                      <span>Arquivo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const compressed = await compressImageFileToDataUrl(file, 256, 0.82);
                              setEmpresaLogo(compressed);
                            } catch (err) {
                              console.warn('Erro ao comprimir logo:', err);
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    WhatsApp de Suporte / Confirmação
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    maxLength={15}
                    pattern="\(\d{2}\)\s?\d{4,5}-\d{4}"
                    title="Informe o WhatsApp no padrão (XX) XXXXX-XXXX"
                    value={whatsappContato}
                    onChange={(e) => setWhatsappContato(aplicarMascaraTelefoneBR(e.target.value))}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white font-mono text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    E-mail Oficial de Atendimento
                  </label>
                  <input
                    type="email"
                    inputMode="email"
                    pattern="[^@\s]+@[^@\s]+\.[^@\s]+"
                    title="Informe um e-mail válido contendo @"
                    value={empresaEmail}
                    onChange={(e) => setEmpresaEmail(sanitizarEmailInput(e.target.value))}
                    placeholder="contato@empresa.com.br"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Endereço / Sede
                  </label>
                  <input
                    type="text"
                    value={empresaEndereco}
                    onChange={(e) => setEmpresaEndereco(e.target.value)}
                    placeholder="Av. Paulista, 1000 - São Paulo, SP"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    CNPJ (opcional)
                  </label>
                  <input
                    type="text"
                    value={empresaCnpj}
                    onChange={(e) => setEmpresaCnpj(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white font-mono text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Fuso Horário Padrão
                </label>
                <div className="flex items-center gap-2 px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-600 dark:text-neutral-400 font-mono">
                  <Clock className="w-3.5 h-3.5 text-orange-500" />
                  <span>America/Sao_Paulo (GMT-3) — Fixado</span>
                </div>
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Texto de Consentimento LGPD
                </label>
                <textarea
                  rows={2}
                  value={termosLgpd}
                  onChange={(e) => setTermosLgpd(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              {empresaErroMsg && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                  {empresaErroMsg}
                </p>
              )}

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Salvar Configurações
                </button>
                {salvoMsg && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Configurações salvas com sucesso!
                  </span>
                )}
              </div>
            </form>
          </div>
          </div>

          {/* Card Lateral: Pré-visualização Institucional */}
          <div className="space-y-4">
            <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Pré-visualização na Página Pública
              </h3>
              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center gap-3">
                  {empresaLogo ? (
                    <img
                      src={empresaLogo}
                      alt={empresaNome}
                      className="w-12 h-12 rounded-xl object-cover border border-neutral-200 dark:border-neutral-700 bg-white"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-orange-500/15 text-orange-600 flex items-center justify-center font-bold text-base">
                      {(empresaNome || 'A').charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                      {empresaNome || 'Nome da Empresa'}
                    </p>
                    {empresaCnpj && (
                      <p className="text-[11px] font-mono text-neutral-500 truncate">CNPJ: {empresaCnpj}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] text-neutral-600 dark:text-neutral-400 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                  {whatsappContato && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <span className="font-mono">{whatsappContato}</span>
                    </div>
                  )}
                  {empresaEmail && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <span className="truncate">{empresaEmail}</span>
                    </div>
                  )}
                  {empresaEndereco && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                      <span>{empresaEndereco}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PÁGINA 2: ENGSEG 2FA */}
      {section === 'engseg' && (
        <div className="max-w-3xl">
          {!canAccessEngseg ? (
            <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Lock className="w-4 h-4" />
                <h3 className="text-sm font-semibold">Segurança ENGSEG (Acesso Restrito)</h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Seu perfil atual (<strong>{currentUser.perfil}</strong>) não possui permissão para alterar a configuração de 2FA ENGSEG. Solicite liberação ao Administrador.
              </p>
            </div>
          ) : (
            <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-4 shadow-sm transition-colors">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-orange-500" />
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    Módulo ENGSEG — Segurança 2FA por E-mail
                  </h3>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                    engsegCfg.enabled
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  {engsegCfg.enabled ? '2FA Ativo' : '2FA Desativado'}
                </span>
              </div>

              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Protege o painel administrativo do <strong>Agenda Ativa</strong> com código OTP de 6 dígitos enviado por e-mail via Apps Script (ou código de teste local quando offline). A página pública de agendamento continua livre para clientes.
              </p>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    E-mail Autorizado para Receber Códigos 2FA
                  </label>
                  <input
                    type="email"
                    inputMode="email"
                    pattern="[^@\s]+@[^@\s]+\.[^@\s]+"
                    title="Informe um e-mail válido contendo @"
                    value={engsegCfg.email}
                    onChange={(e) => {
                      setEngsegErroMsg(null);
                      saveEngsegConfig({ email: sanitizarEmailInput(e.target.value) });
                    }}
                    placeholder="admin@empresa.com.br"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white text-xs focus:outline-none focus:border-orange-500"
                  />
                  {engsegErroMsg && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-1">
                      {engsegErroMsg}
                    </p>
                  )}
                </div>

                {/* Botão Único de Ativação / Desativação para Testes */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={engsegCfg.enforcedByServer}
                    onClick={handleToggleEngsegSingleButton}
                    className={`flex-1 min-w-[210px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      engsegCfg.enforcedByServer
                        ? 'bg-emerald-600/80 text-white cursor-not-allowed'
                        : engsegCfg.enabled
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm cursor-pointer'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer'
                    }`}
                  >
                    {engsegCfg.enforcedByServer ? (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>2FA Obrigatório via Servidor (ENGSEG_REQUIRED=true)</span>
                      </>
                    ) : engsegCfg.enabled ? (
                      <>
                        <Unlock className="w-4 h-4" />
                        <span>Desativar 2FA (Botão Único de Teste)</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Ativar 2FA Agora (Botão Único de Teste)</span>
                      </>
                    )}
                  </button>

                  {engsegCfg.enabled && engsegVerified && (
                    <button
                      type="button"
                      onClick={() => clearEngsegSession()}
                      className="px-3.5 py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-orange-500" />
                      <span>Bloquear Agora</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PÁGINA 3: BANCO DE DADOS (MOTOR DADOS DRIVE v2.0) */}
      {section === 'banco' && (
        <div className="max-w-4xl space-y-6">
          {!canAccessBanco ? (
            <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Lock className="w-4 h-4" />
                <h3 className="text-sm font-semibold">Banco de Dados (Acesso Restrito)</h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Seu perfil atual (<strong>{currentUser.perfil}</strong>) possui acesso restrito às integrações de banco de dados. A gestão do Motor Google Drive e URLs de Apps Script é controlada pelo Administrador.
              </p>
            </div>
          ) : (
          <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-4 shadow-sm transition-colors">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Motor DADOS DRIVE v2.0 (Proxy + Batch Sheets)
                </h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${syncBadge.cls}`}>
                {syncBadge.label}
              </span>
            </div>

            <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-600 dark:text-neutral-400">
              <div className="flex items-center gap-1.5 font-mono">
                <FolderOpen className="w-3.5 h-3.5 text-orange-500" />
                <span>{driveCfg.folderPath || 'Agenda Ativa/AppDatabase_Data'}</span>
              </div>
              {driveCfg.lastSyncTimestamp && (
                <span className="font-mono text-[10px]">
                  Última sinc.: {new Date(driveCfg.lastSyncTimestamp).toLocaleTimeString('pt-BR')}
                </span>
              )}
            </div>

            <div className="space-y-3 text-xs">
              {runtimeCfg.cloudConfigured && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 rounded-lg text-[11px] text-emerald-800 dark:text-emerald-200">
                  <strong>Conexão Ativa:</strong> Os dados carregam direto do Google Sheets. Clique em <strong>Salvar URL</strong> abaixo para manter esta URL fixa mesmo após atualizar a página.
                </div>
              )}

              {/* Seletor em Lista Suspensa quando houver mais de 1 URL salva */}
              {savedDrives.length > 1 && (
                <div className="p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="font-semibold text-neutral-800 dark:text-neutral-200">
                      Alternar Drive Salvo ({savedDrives.length} URLs cadastradas)
                    </label>
                    <button
                      type="button"
                      onClick={handlePrepararNovaUrl}
                      className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Adicionar Nova URL</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={
                        savedDrives.find(
                          (d) => normalizeGasUrl(d.webappUrl) === normalizeGasUrl(driveCfg.webappUrl)
                        )?.id || ''
                      }
                      onChange={(e) => handleSelecionarDriveSalvo(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-medium text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                    >
                      <option value="" disabled>
                        Selecione um Drive salvo...
                      </option>
                      {savedDrives.map((d) => {
                        const suffix = (extractGasDeploymentId(d.webappUrl) || d.id).slice(-6);
                        return (
                          <option key={d.id} value={d.id}>
                            {d.label} (ID ...{suffix})
                          </option>
                        );
                      })}
                    </select>
                    {(() => {
                      const activeSaved = savedDrives.find(
                        (d) => normalizeGasUrl(d.webappUrl) === normalizeGasUrl(driveCfg.webappUrl)
                      );
                      return activeSaved ? (
                        <button
                          type="button"
                          onClick={() => handleRemoverDriveSalvo(activeSaved.id)}
                          title="Remover este Drive da lista salva"
                          className="p-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 hover:border-rose-500 text-neutral-500 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : null;
                    })()}
                  </div>
                </div>
              )}

              {/* Status quando há exatamente 1 URL salva */}
              {savedDrives.length === 1 && (
                <div className="p-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                    <BookmarkCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>
                      Drive fixado: <strong>{savedDrives[0].label}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrepararNovaUrl}
                      className="text-orange-600 dark:text-orange-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Adicionar Outro Drive</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoverDriveSalvo(savedDrives[0].id)}
                      className="text-neutral-400 hover:text-rose-500 transition-colors cursor-pointer"
                      title="Remover URL salva"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Nome / Identificação do Drive (Opcional)
                </label>
                <input
                  type="text"
                  value={driveLabel}
                  onChange={(e) => setDriveLabel(e.target.value)}
                  placeholder="Ex: Escola People, Unidade Centro, Evento Principal..."
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  URL da Implantação do Web App (Google Apps Script)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={gasUrl}
                    onChange={(e) => setGasUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    className="flex-1 px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white font-mono text-xs focus:outline-none focus:border-orange-500"
                  />
                  <button
                    type="button"
                    disabled={salvandoDrive || !gasUrl.trim()}
                    onClick={handleSalvarEPinarDrive}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {salvandoDrive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkCheck className="w-3.5 h-3.5" />}
                    <span>{salvandoDrive ? 'Salvando...' : 'Salvar URL'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                  Ao clicar em <strong>Salvar URL</strong>, ela fica fixada neste painel mesmo se você atualizar a página, e é adicionada na lista para troca rápida.
                </p>

                {gasUrl.includes('/library/') && (
                  <div className="mt-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-200">
                    <strong>⚠️ URL de Biblioteca detectada:</strong> Você colou um link de biblioteca (<code>/macros/library/...</code>). No Apps Script, clique no botão azul <strong>Implantar &gt; Gerenciar implantações</strong> e copie a <strong>URL do aplicativo da Web</strong> (que termina com <code>/exec</code>).
                  </div>
                )}
                {gasUrl.includes('/edit') && (
                  <div className="mt-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200">
                    <strong>⚠️ URL do Editor detectada:</strong> Você colou o link da tela de edição (<code>/edit</code>). No Apps Script, clique em <strong>Implantar &gt; Gerenciar implantações</strong> e copie a <strong>URL do aplicativo da Web</strong> (que termina com <code>/exec</code>).
                  </div>
                )}
                {gasUrl.trim().toLowerCase().endsWith('/dev') && (
                  <div className="mt-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200">
                    <strong>⚠️ URL de Teste (/dev) detectada:</strong> Links <code>/dev</code> exigem login no editor. Copie a URL de produção terminada em <code>/exec</code> em <strong>Implantar &gt; Gerenciar implantações</strong>.
                  </div>
                )}

                {gasUrl.trim() && validateGasUrlClient(gasUrl).valid && (
                  <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-200 space-y-2">
                    <p>
                      <strong>Modo Multi-Drive Automático Ativo:</strong> Todos os links públicos e QR Codes gerados saem vinculados automaticamente ao Drive selecionado (<code>?d=...</code>), funcionando em qualquer celular ou navegador na Vercel.
                    </p>
                    {!runtimeCfg.cloudConfigured && (
                      <button
                        type="button"
                        onClick={async () => {
                          const clean = normalizeGasUrl(gasUrl);
                          const snippet = `export const GLOBAL_GAS_CONFIG = {\n  WEBAPP_URL: '${clean}',\n  API_TOKEN: '${apiToken.trim()}'\n};\n`;
                          try {
                            await navigator.clipboard.writeText(snippet);
                            setCopiadoGasConfig(true);
                            setTimeout(() => setCopiadoGasConfig(false), 2000);
                          } catch {}
                        }}
                        className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiadoGasConfig ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiadoGasConfig ? 'Copiado!' : 'Opcional: copiar Drive padrão para gasConfig.ts'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* API Secret Opcional */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Chave Secreta API_SECRET (Opcional)
                  </label>
                  <input
                    type="password"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    placeholder="Token secreto compartilhado com o GAS"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white font-mono text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>
                <button
                  type="button"
                  disabled={syncBusy === 'secret'}
                  onClick={handleApplySecret}
                  className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {syncBusy === 'secret' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5 text-orange-500" />}
                  <span>Aplicar Secret</span>
                </button>
              </div>

              {/* Auto-Sync Toggle */}
              <div className="flex items-center justify-between p-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                <div>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200 block">
                    Auto-Sync em Segundo Plano (1.2s debounce)
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Espelha automaticamente alterações no Drive JSON + Sheets Batch
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => saveDriveConfig({ autoSync: !driveCfg.autoSync })}
                  className={`px-3 py-1 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer ${
                    driveCfg.autoSync
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {driveCfg.autoSync ? 'Ativado' : 'Pausado'}
                </button>
              </div>

              {/* Botões de Ação do Motor v2.0 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={testandoConexao}
                  onClick={handleTestarConexao}
                  className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {testandoConexao ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-orange-500" />}
                  <span>{testandoConexao ? 'Testando...' : 'Testar (Ping)'}</span>
                </button>

                <button
                  type="button"
                  disabled={syncBusy === 'push'}
                  onClick={handlePushCloud}
                  className="px-3 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {syncBusy === 'push' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
                  <span>Enviar (Push)</span>
                </button>

                <button
                  type="button"
                  disabled={syncBusy === 'pull'}
                  onClick={handlePullCloud}
                  className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {syncBusy === 'pull' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudDownload className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>Puxar (Pull)</span>
                </button>
              </div>

              {/* Links diretos da Planilha Espelhada */}
              {(driveCfg.spreadsheetUrl || driveCfg.exportXlsxUrl) && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {driveCfg.spreadsheetUrl && (
                    <a
                      href={driveCfg.spreadsheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 hover:underline"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Abrir Planilha ({driveCfg.spreadsheetName || 'Sheets'})</span>
                    </a>
                  )}
                  {driveCfg.exportXlsxUrl && (
                    <a
                      href={driveCfg.exportXlsxUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 hover:underline"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar .XLSX</span>
                    </a>
                  )}
                </div>
              )}

              {resultadoTeste && (
                <div
                  className={`p-3 rounded-lg border flex items-start gap-2 ${
                    resultadoTeste.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{resultadoTeste.message}</span>
                </div>
              )}

              {/* Checkpoints e Arquivos no Drive */}
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-orange-500" />
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      Checkpoints &amp; Snapshots no Drive
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={syncBusy === 'checkpoint'}
                      onClick={handleCreateCheckpoint}
                      className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 rounded-lg text-[11px] font-medium cursor-pointer"
                    >
                      {syncBusy === 'checkpoint' ? 'Criando...' : 'Criar Checkpoint'}
                    </button>
                    <button
                      type="button"
                      disabled={syncBusy === 'list'}
                      onClick={() => handleListFiles(false)}
                      className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 rounded-lg text-[11px] font-medium cursor-pointer"
                    >
                      {syncBusy === 'list' ? 'Listando...' : 'Listar Arquivos'}
                    </button>
                  </div>
                </div>

                {driveFiles.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {driveFiles.map((f) => (
                      <div
                        key={f.id}
                        className="p-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg flex items-center justify-between gap-2 text-[11px]"
                      >
                        <div className="min-w-0">
                          <p className="font-mono font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                            {f.name} {f.isRoot ? '(Mestre)' : ''}
                          </p>
                          <p className="text-[10px] text-neutral-500">
                            {(f.size / 1024).toFixed(1)} KB · {new Date(f.lastUpdated).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        {!f.isRoot && (
                          <button
                            type="button"
                            disabled={syncBusy === 'restore'}
                            onClick={() => handleRestoreCheckpoint(f.name)}
                            className="px-2 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded text-[10px] font-semibold shrink-0 cursor-pointer"
                          >
                            Restaurar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Código Fonte Único Pronto para Deploy */}
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-neutral-800 dark:text-neutral-300">
                    Script Único do Motor v2.1 para Google Apps Script:
                  </p>
                  <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md">
                    Code.gs + SetupSheet unificados
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCopiarScript}
                    className="px-3 py-2 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiadoCodeGs ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Código Completo Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-orange-500" />
                        <span>Copiar Código Completo (Code.gs)</span>
                      </>
                    )}
                  </button>

                  <a
                    href="https://script.google.com/home"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-950/70 border border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir Apps Script</span>
                  </a>
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 rounded-lg text-[11px] text-neutral-600 dark:text-neutral-400 space-y-1">
                  <p className="font-semibold text-neutral-800 dark:text-neutral-300">Instruções de Deploy (Código Único — Agenda Ativa):</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>
                      Clique em <strong>Abrir Apps Script</strong> acima (ou{' '}
                      <a href="https://script.new" target="_blank" rel="noreferrer" className="text-orange-600 dark:text-orange-400 underline font-semibold">
                        criar novo em script.new
                      </a>
                      ).
                    </li>
                    <li>Cole todo o código copiado dentro de <code>Code.gs</code> e salve (<strong>Ctrl + S</strong>) — o instalador das 13 abas já está incluso nele.</li>
                    <li><em>(Opcional)</em> Execute <code>inicializarPlanilha</code> ou <code>testConnection</code> no editor para criar/formatar as 13 abas na hora.</li>
                    <li>Clique em <strong>Implantar &gt; Nova Implantação &gt; App da Web</strong> (Executar como: <em>Eu</em> · Acesso: <em>Qualquer pessoa</em>). Se já existe, use <strong>Gerenciar implantações &gt; Editar &gt; Nova versão</strong>.</li>
                    <li>Cole a URL <code>/exec</code> gerada acima e clique em <strong>Salvar URL</strong>.</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
};
