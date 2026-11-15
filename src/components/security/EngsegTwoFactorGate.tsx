import React, { useState } from 'react';
import {
  ShieldCheck,
  Mail,
  KeyRound,
  ArrowRight,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock
} from 'lucide-react';
import {
  getEngsegConfig,
  saveEngsegConfig,
  sendEngseg2FACode,
  verifyEngseg2FACode
} from '../../services/engsegService';
import { isCloudActive } from '../../services/driveSyncService';

interface EngsegTwoFactorGateProps {
  onVerified: () => void;
  onOpenPublic: () => void;
}

export const EngsegTwoFactorGate: React.FC<EngsegTwoFactorGateProps> = ({
  onVerified,
  onOpenPublic
}) => {
  const initialCfg = getEngsegConfig();
  const cloudActive = isCloudActive();

  const [email, setEmail] = useState(initialCfg.email);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [localTestCode, setLocalTestCode] = useState<string | null>(null);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLocalTestCode(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Informe um e-mail válido para receber o código de verificação.');
      return;
    }

    saveEngsegConfig({ email: cleanEmail });
    setIsSending(true);
    try {
      const res = await sendEngseg2FACode(cleanEmail);
      setCodeSent(true);
      setInfoMsg(res.message);
      if (res.mode === 'local_test' && res.testCode) {
        setLocalTestCode(res.testCode);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível enviar o código 2FA.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsVerifying(true);
    try {
      await verifyEngseg2FACode(email, code);
      onVerified();
    } catch (err: any) {
      setErrorMsg(err.message || 'Código inválido ou expirado.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex items-center justify-center p-4 sm:p-6 transition-colors">
      <div className="max-w-md w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        {/* Brand & Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-600/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-neutral-900 dark:text-white">
                Agenda Ativa
              </h1>
              <p className="text-[11px] font-mono text-orange-600 dark:text-orange-400">
                Módulo ENGSEG · Proteção 2FA
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            <Lock className="w-3 h-3" />
            Painel Bloqueado
          </span>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
            Verificação em Duas Etapas
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            O acesso administrativo está protegido pelo módulo <strong>ENGSEG 2FA</strong>. Solicite o código de 6 dígitos para liberar sua sessão.
          </p>
        </div>

        {/* Canal de Envio Ativo */}
        <div className="px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-[11px]">
          <span className="text-neutral-500 dark:text-neutral-400">Canal de Autenticação:</span>
          <span className={`font-semibold ${cloudActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {cloudActive ? 'E-mail Real (Apps Script MailApp)' : 'Modo Teste Local (Offline)'}
          </span>
        </div>

        {/* Etapa 1: E-mail e Envio */}
        <form onSubmit={handleSendCode} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              E-mail do Administrador
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@empresa.com.br"
                className="w-full pl-9 pr-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSending}
            className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Enviando código...</span>
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 text-orange-400" />
                <span>{codeSent ? 'Reenviar Código 2FA' : 'Enviar Código 2FA por E-mail'}</span>
              </>
            )}
          </button>
        </form>

        {/* Feedback de Envio / Código de Teste Local */}
        {infoMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 space-y-1.5">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
            {localTestCode && (
              <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
                <span className="text-[11px] font-medium">Código de Teste Gerado:</span>
                <button
                  type="button"
                  onClick={() => setCode(localTestCode)}
                  title="Clique para preencher automaticamente"
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-sm rounded-lg tracking-widest cursor-pointer"
                >
                  {localTestCode}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Etapa 2: Digitar e Validar OTP */}
        <form onSubmit={handleVerifyCode} className="space-y-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Código de Verificação (6 dígitos)
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full pl-9 pr-3.5 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-base font-mono font-bold tracking-[0.35em] text-center text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isVerifying || code.length < 6}
            className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Validando Código...</span>
              </>
            ) : (
              <>
                <span>Validar Código e Acessar Painel</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Link para Página Pública sempre acessível em aba independente */}
        <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
          <span>Clientes podem agendar livremente</span>
          <a
            href="/agendar"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 hover:underline font-semibold cursor-pointer"
          >
            <span>Página Pública</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
