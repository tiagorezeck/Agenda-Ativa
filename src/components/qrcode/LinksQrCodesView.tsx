import React, { useState, useEffect } from 'react';
import { EventoEntity, MotivoIndisponivelEvento } from '../../types/database';
import { storage } from '../../services/storageService';
import { buildPublicEventPath, getDriveConfig, subscribeDriveConfig } from '../../services/driveSyncService';
import {
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Globe,
  PauseCircle,
  XCircle,
  CheckCircle2,
  Save,
  BellRing,
  Link2
} from 'lucide-react';

interface LinksQrCodesViewProps {
  onOpenQrCode: (evento: EventoEntity) => void;
  onOpenPublicEvent: (slug: string) => void;
  onOpenPublicPortal: () => void;
  onUpdated?: () => void;
}

interface EventDraftConfig {
  status: EventoEntity['status'];
  agenda_publica_ativa: boolean;
  motivo_indisponivel: MotivoIndisponivelEvento;
  mensagem_indisponivel: string;
  permitir_lista_espera: boolean;
}

const buildDraftFromEvento = (ev: EventoEntity): EventDraftConfig => {
  const isAtivo = ev.status === 'PUBLICADO' && ev.agenda_publica_ativa !== false;
  return {
    status: ev.status,
    agenda_publica_ativa: isAtivo,
    motivo_indisponivel:
      ev.motivo_indisponivel ||
      (ev.status === 'ENCERRADO' ? 'ENCERRADO' : 'AGENDA_FECHADA'),
    mensagem_indisponivel: ev.mensagem_indisponivel || '',
    permitir_lista_espera: ev.permitir_lista_espera !== false
  };
};

export const LinksQrCodesView: React.FC<LinksQrCodesViewProps> = ({
  onOpenQrCode,
  onOpenPublicEvent,
  onOpenPublicPortal,
  onUpdated
}) => {
  const db = storage.getDatabase();
  const eventos = db.eventos;

  const [activeWebappUrl, setActiveWebappUrl] = useState<string>(() => getDriveConfig().webappUrl);
  const [drafts, setDrafts] = useState<Record<string, EventDraftConfig>>(() => {
    const initial: Record<string, EventDraftConfig> = {};
    eventos.forEach((ev) => {
      initial[ev.id_evento] = buildDraftFromEvento(ev);
    });
    return initial;
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    return subscribeDriveConfig((cfg) => setActiveWebappUrl(cfg.webappUrl));
  }, []);

  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, EventDraftConfig> = {};
      eventos.forEach((ev) => {
        next[ev.id_evento] = prev[ev.id_evento] || buildDraftFromEvento(ev);
      });
      return next;
    });
  }, [eventos]);

  const portalPath = buildPublicEventPath(undefined, activeWebappUrl);
  const portalUrl = `${window.location.origin}${portalPath}`;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 2000);
  };

  const updateDraft = (idEvento: string, patch: Partial<EventDraftConfig>) => {
    setDrafts((prev) => {
      const current = prev[idEvento] || {
        status: 'PUBLICADO',
        agenda_publica_ativa: true,
        motivo_indisponivel: 'AGENDA_FECHADA',
        mensagem_indisponivel: '',
        permitir_lista_espera: true
      };
      return {
        ...prev,
        [idEvento]: { ...current, ...patch }
      };
    });
  };

  const applyQuickMode = (ev: EventoEntity, mode: 'ATIVO' | 'PAUSADO' | 'ENCERRADO') => {
    const current = drafts[ev.id_evento] || buildDraftFromEvento(ev);
    if (mode === 'ATIVO') {
      updateDraft(ev.id_evento, {
        status: 'PUBLICADO',
        agenda_publica_ativa: true
      });
    } else if (mode === 'PAUSADO') {
      const nextMotivo: MotivoIndisponivelEvento =
        current.motivo_indisponivel === 'ENCERRADO' ? 'AGENDA_FECHADA' : current.motivo_indisponivel;
      updateDraft(ev.id_evento, {
        status: 'PAUSADO',
        agenda_publica_ativa: false,
        motivo_indisponivel: nextMotivo
      });
    } else {
      updateDraft(ev.id_evento, {
        status: 'ENCERRADO',
        agenda_publica_ativa: false,
        motivo_indisponivel: 'ENCERRADO'
      });
    }
  };

  const applyMessagePreset = (idEvento: string, motivo: MotivoIndisponivelEvento) => {
    updateDraft(idEvento, {
      motivo_indisponivel: motivo,
      mensagem_indisponivel: storage.getDefaultMensagemIndisponivel(motivo)
    });
  };

  const handleSaveEventoConfig = (ev: EventoEntity) => {
    const draft = drafts[ev.id_evento] || buildDraftFromEvento(ev);
    storage.updateEventoPublicConfig(ev.id_evento, {
      status: draft.status,
      agenda_publica_ativa: draft.status === 'PUBLICADO' && draft.agenda_publica_ativa,
      motivo_indisponivel: draft.motivo_indisponivel,
      mensagem_indisponivel: draft.mensagem_indisponivel.trim() || undefined,
      permitir_lista_espera: draft.permitir_lista_espera
    });
    setSavedId(ev.id_evento);
    onUpdated?.();
    setTimeout(() => setSavedId((curr) => (curr === ev.id_evento ? null : curr)), 2200);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho + Link da Landing Page Pública */}
      <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
              Links, QR Codes &amp; Controle da Landing Page Pública
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-2xl">
              Controle quais eventos estão abertos na Landing Page, personalize mensagens para agendas fechadas, lotadas ou finalizadas e ative a lista de espera automática.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleCopy('portal', portalUrl)}
              className="px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              {copiedId === 'portal' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Link Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Link da Landing Page</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenPublicPortal}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Abrir Landing Page</span>
            </button>
          </div>
        </div>

        <div className="px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Link2 className="w-4 h-4 text-orange-500 shrink-0" />
            <span className="font-mono text-neutral-600 dark:text-neutral-300 truncate select-all">
              {portalUrl}
            </span>
          </div>
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 whitespace-nowrap hidden sm:inline">
            Portal com meus agendamentos + catálogo de eventos
          </span>
        </div>
      </div>

      {/* Lista de Eventos e Configurações Públicas */}
      {eventos.length === 0 ? (
        <div className="p-10 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-center space-y-2">
          <QrCode className="w-8 h-8 text-neutral-400 mx-auto" />
          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            Nenhum evento cadastrado ainda
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Crie um evento na aba &quot;Eventos&quot; para configurar seu link público, disponibilidade e QR Code.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {eventos.map((ev) => {
            const draft = drafts[ev.id_evento] || buildDraftFromEvento(ev);
            const isAtivo = draft.status === 'PUBLICADO' && draft.agenda_publica_ativa;
            const isEncerrado = draft.status === 'ENCERRADO';
            const isPausado = !isAtivo && !isEncerrado;

            const resumo = storage.getEventoDisponibilidadeResumo(ev);
            const eventPath = buildPublicEventPath(ev.slug, activeWebappUrl);
            const eventFullUrl = `${window.location.origin}${eventPath}`;

            const storedDraft = buildDraftFromEvento(ev);
            const hasChanges =
              draft.status !== storedDraft.status ||
              draft.agenda_publica_ativa !== storedDraft.agenda_publica_ativa ||
              draft.motivo_indisponivel !== storedDraft.motivo_indisponivel ||
              draft.mensagem_indisponivel !== storedDraft.mensagem_indisponivel ||
              draft.permitir_lista_espera !== storedDraft.permitir_lista_espera;

            return (
              <div
                key={ev.id_evento}
                className="p-5 sm:p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm flex flex-col justify-between gap-4"
              >
                <div className="space-y-4">
                  {/* Topo do Card: Identidade + Link */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {ev.imagem_url && !imgErrors[ev.id_evento] ? (
                        <img
                          src={ev.imagem_url}
                          alt={ev.nome}
                          referrerPolicy="no-referrer"
                          onError={() => setImgErrors((prev) => ({ ...prev, [ev.id_evento]: true }))}
                          className="w-11 h-11 rounded-xl object-cover border border-neutral-200 dark:border-neutral-800 shrink-0 bg-neutral-50 dark:bg-neutral-950"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-orange-600 text-white font-bold text-base flex items-center justify-center shrink-0">
                          {ev.nome.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white truncate">
                          {ev.nome}
                        </h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono truncate">
                          /agendar/{ev.slug}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-semibold ${
                          resumo.disponivel
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : resumo.estado === 'ENCERRADO'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {resumo.tituloStatus}
                      </span>
                      <p className="text-[11px] font-mono tabular-nums text-neutral-400 dark:text-neutral-500">
                        {resumo.disponivel
                          ? `${resumo.vagasTotais} vagas · ${resumo.datasComVaga} dia(s)`
                          : `${Number(ev.visitas) || 0} visitas`}
                      </p>
                    </div>
                  </div>

                  {/* Seletor de Estado Público (Ativo / Agenda Fechada / Finalizado) */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Situação do Evento na Página Pública
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => applyQuickMode(ev, 'ATIVO')}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                          isAtivo
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                            : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Ativo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => applyQuickMode(ev, 'PAUSADO')}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                          isPausado
                            ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-700 dark:text-amber-300'
                            : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'
                        }`}
                      >
                        <PauseCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Agenda Fechada</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => applyQuickMode(ev, 'ENCERRADO')}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                          isEncerrado
                            ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-500 text-rose-700 dark:text-rose-300'
                            : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Finalizado</span>
                      </button>
                    </div>
                  </div>

                  {/* Motivo + Mensagem Personalizada + Presets */}
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Mensagem caso indisponível ou esgotado
                      </label>
                      <select
                        value={draft.motivo_indisponivel}
                        onChange={(e) =>
                          updateDraft(ev.id_evento, {
                            motivo_indisponivel: e.target.value as MotivoIndisponivelEvento
                          })
                        }
                        className="px-2.5 py-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-[11px] text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-orange-500"
                      >
                        <option value="AGENDA_FECHADA">Agenda Fechada</option>
                        <option value="ENCERRADO">Evento Finalizado</option>
                        <option value="SEM_VAGAS">Acabaram as Vagas</option>
                        <option value="PERSONALIZADO">Mensagem Personalizada</option>
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-neutral-400">Modelos rápidos:</span>
                      <button
                        type="button"
                        onClick={() => applyMessagePreset(ev.id_evento, 'AGENDA_FECHADA')}
                        className="px-2 py-0.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:border-orange-500 rounded text-[10px] text-neutral-700 dark:text-neutral-300 cursor-pointer"
                      >
                        Agenda fechada
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMessagePreset(ev.id_evento, 'SEM_VAGAS')}
                        className="px-2 py-0.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:border-orange-500 rounded text-[10px] text-neutral-700 dark:text-neutral-300 cursor-pointer"
                      >
                        Acabaram as vagas
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMessagePreset(ev.id_evento, 'ENCERRADO')}
                        className="px-2 py-0.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:border-orange-500 rounded text-[10px] text-neutral-700 dark:text-neutral-300 cursor-pointer"
                      >
                        Finalizado / nova turma
                      </button>
                    </div>

                    <textarea
                      rows={2}
                      value={draft.mensagem_indisponivel}
                      onChange={(e) =>
                        updateDraft(ev.id_evento, { mensagem_indisponivel: e.target.value })
                      }
                      placeholder={storage.getDefaultMensagemIndisponivel(draft.motivo_indisponivel)}
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                    />

                    <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.permitir_lista_espera}
                        onChange={(e) =>
                          updateDraft(ev.id_evento, { permitir_lista_espera: e.target.checked })
                        }
                        className="rounded bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-orange-600 focus:ring-0"
                      />
                      <BellRing className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <span>Exibir cadastro na Lista de Espera (time entra em contato quando abrir)</span>
                    </label>
                  </div>
                </div>

                {/* Rodapé de Ações */}
                <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveEventoConfig(ev)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                      savedId === ev.id_evento
                        ? 'bg-emerald-600 text-white'
                        : hasChanges
                        ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-sm'
                        : 'bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-white'
                    }`}
                  >
                    {savedId === ev.id_evento ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Configuração Salva!</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>{hasChanges ? 'Salvar Alterações' : 'Salvar'}</span>
                      </>
                    )}
                  </button>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopy(ev.id_evento, eventFullUrl)}
                      className="px-2.5 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      title="Copiar link direto do evento"
                    >
                      {copiedId === ev.id_evento ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Link</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenPublicEvent(ev.slug)}
                      className="px-2.5 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      title="Visualizar página pública deste evento"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenQrCode(ev)}
                      className="px-3 py-2 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/60 dark:hover:bg-orange-900/60 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>QR Code</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
