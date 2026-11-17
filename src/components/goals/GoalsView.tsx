import React, { useState, useEffect, useMemo } from 'react';
import {
  Target,
  Plus,
  Users,
  Trash2,
  Check,
  X,
  Edit3,
  Calendar,
  Eye,
  UserCheck,
  TrendingUp,
  Copy,
  AlertCircle,
  BarChart3
} from 'lucide-react';
import { storage } from '../../services/storageService';
import { buildPublicEventPath } from '../../services/driveSyncService';
import { MetaEntity, UsuarioEntity } from '../../types/database';
import { DEFAULT_USERS, getLoggedInUser, podeAcessarTodoCrm } from '../../services/authService';

type GoalsTab = 'TODAS' | 'EVENTOS' | 'GERAIS';
type MetaTipo = MetaEntity['tipo'];

interface EventGoalMetrics {
  visitas: number;
  leadsCount: number;
  agendamentosCount: number;
  totalFunil: number;
  ganhosFunil: number;
  conversaoPct: number;
  taxaVisitaLeadPct: number;
}

export const GoalsView: React.FC = () => {
  const db = storage.getDatabase();
  const [currentUser, setCurrentUser] = useState<UsuarioEntity>(() => getLoggedInUser());
  const [, setRefreshCounter] = useState(0);
  const [activeTab, setActiveTab] = useState<GoalsTab>('TODAS');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<MetaEntity | null>(null);
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);

  // Edição inline de meta manual e confirmação de exclusão
  const [editingMetaId, setEditingMetaId] = useState<string | null>(null);
  const [editingValor, setEditingValor] = useState<number>(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form State
  const [titulo, setTitulo] = useState('');
  const [responsavelId, setResponsavelId] = useState(currentUser.id_usuario);
  const [tipo, setTipo] = useState<MetaTipo>('DINHEIRO');
  const [metaAlvo, setMetaAlvo] = useState<number>(10000);
  const [valorManual, setValorManual] = useState<number>(0);
  const [periodo, setPeriodo] = useState(() => new Date().toISOString().slice(0, 7));

  // Form State específico para Meta de Evento
  const [idEvento, setIdEvento] = useState<string>('');
  const [metaVisitas, setMetaVisitas] = useState<number>(500);
  const [metaLeads, setMetaLeads] = useState<number>(50);
  const [metaConversao, setMetaConversao] = useState<number>(20);
  const [formErro, setFormErro] = useState<string | null>(null);

  useEffect(() => {
    const handleAuth = () => setCurrentUser(getLoggedInUser());
    window.addEventListener('auth_user_changed', handleAuth);
    const unsub = storage.subscribe(() => setRefreshCounter(c => c + 1));
    return () => {
      window.removeEventListener('auth_user_changed', handleAuth);
      unsub();
    };
  }, []);

  const canManageAll = podeAcessarTodoCrm(currentUser);
  const usuarios: UsuarioEntity[] = (db.usuarios && db.usuarios.length > 0) ? db.usuarios : DEFAULT_USERS;
  const eventos = db.eventos || [];
  const allMetas = db.metas || [];

  const metasVisiveis = useMemo(() => {
    if (canManageAll) return allMetas;
    return allMetas.filter(m => {
      if (m.responsavel_id === 'GERAL' || m.responsavel_id === currentUser.id_usuario) return true;
      if (m.tipo === 'EVENTO' && m.id_evento) {
        const ev = eventos.find(e => e.id_evento === m.id_evento);
        return ev?.responsavel_id === currentUser.id_usuario;
      }
      return false;
    });
  }, [allMetas, canManageAll, currentUser.id_usuario, eventos]);

  const metasEventos = useMemo(() => metasVisiveis.filter(m => m.tipo === 'EVENTO'), [metasVisiveis]);
  const metasGerais = useMemo(() => metasVisiveis.filter(m => m.tipo !== 'EVENTO'), [metasVisiveis]);

  const metasFiltradas = useMemo(() => {
    if (activeTab === 'EVENTOS') return metasEventos;
    if (activeTab === 'GERAIS') return metasGerais;
    return metasVisiveis;
  }, [activeTab, metasEventos, metasGerais, metasVisiveis]);

  // Calcula métricas em tempo real para metas gerais
  const calcularValorAtual = (meta: MetaEntity): number => {
    if (meta.tipo === 'DINHEIRO') {
      return db.crm
        .filter(c => c.estagio === 'GANHO' && (meta.responsavel_id === 'GERAL' || c.responsavel_id === meta.responsavel_id))
        .reduce((acc, c) => acc + (c.valor_fechado || c.valor_estimado || 0), 0);
    }
    if (meta.tipo === 'NUMERO') {
      return db.agendamentos.filter(a => {
        if (meta.responsavel_id === 'GERAL') return true;
        const lead = db.leads.find(l => l.id_lead === a.id_lead);
        const evento = db.eventos.find(e => e.id_evento === a.id_evento);
        return lead?.responsavel_id === meta.responsavel_id || evento?.responsavel_id === meta.responsavel_id;
      }).length;
    }
    return meta.valor_manual || 0;
  };

  // Calcula Visitas, Leads Cadastrados (preencheram e agendaram) e Conversão (%) no Kanban para o Evento
  const calcularMetricasEvento = (eventoId?: string): EventGoalMetrics => {
    if (!eventoId) {
      return {
        visitas: 0,
        leadsCount: 0,
        agendamentosCount: 0,
        totalFunil: 0,
        ganhosFunil: 0,
        conversaoPct: 0,
        taxaVisitaLeadPct: 0
      };
    }

    const evento = eventos.find(e => e.id_evento === eventoId);
    const visitas = Number(evento?.visitas) || 0;

    const activeLeadIds = new Set(
      (db.leads || []).filter(l => !l.excluido).map(l => l.id_lead)
    );

    const agdsDoEvento = (db.agendamentos || []).filter(
      a => a.id_evento === eventoId && activeLeadIds.has(a.id_lead)
    );
    const agdIdsDoEvento = new Set(agdsDoEvento.map(a => a.id_agendamento));

    const leadsDoEventoIds = new Set<string>();
    agdsDoEvento.forEach(a => leadsDoEventoIds.add(a.id_lead));
    (db.leads || []).forEach(l => {
      if (!l.excluido && l.origem_primeiro_evento === eventoId) {
        leadsDoEventoIds.add(l.id_lead);
      }
    });

    const leadsCount = leadsDoEventoIds.size;
    const agendamentosCount = agdsDoEvento.length;

    const crmDoEvento = (db.crm || []).filter(c => {
      if (!activeLeadIds.has(c.id_lead)) return false;
      if (c.id_agendamento_origem) {
        return agdIdsDoEvento.has(c.id_agendamento_origem);
      }
      const leadObj = db.leads.find(l => l.id_lead === c.id_lead);
      return leadObj?.origem_primeiro_evento === eventoId;
    });

    const totalFunil = crmDoEvento.length;
    const ganhosFunil = crmDoEvento.filter(c => c.estagio === 'GANHO').length;
    const conversaoPct = totalFunil > 0 ? Math.round((ganhosFunil / totalFunil) * 1000) / 10 : 0;
    const taxaVisitaLeadPct = visitas > 0 ? Math.round((leadsCount / visitas) * 1000) / 10 : 0;

    return {
      visitas,
      leadsCount,
      agendamentosCount,
      totalFunil,
      ganhosFunil,
      conversaoPct,
      taxaVisitaLeadPct
    };
  };

  const openCreateModal = (presetTipo: MetaTipo) => {
    setEditingGoal(null);
    setFormErro(null);
    setTipo(presetTipo);
    setPeriodo(new Date().toISOString().slice(0, 7));

    if (presetTipo === 'EVENTO') {
      const primeiroEvento = eventos[0];
      setIdEvento(primeiroEvento?.id_evento || '');
      setTitulo(primeiroEvento ? `Meta · ${primeiroEvento.nome}` : '');
      setResponsavelId(primeiroEvento?.responsavel_id || currentUser.id_usuario);
      setMetaVisitas(500);
      setMetaLeads(50);
      setMetaConversao(20);
    } else {
      setIdEvento('');
      setTitulo('');
      setResponsavelId(currentUser.id_usuario);
      setMetaAlvo(10000);
      setValorManual(0);
    }

    setModalOpen(true);
  };

  const openEditModal = (meta: MetaEntity) => {
    setEditingGoal(meta);
    setFormErro(null);
    setTipo(meta.tipo);
    setTitulo(meta.titulo);
    setResponsavelId(meta.responsavel_id);
    setPeriodo(meta.periodo || new Date().toISOString().slice(0, 7));
    setMetaAlvo(meta.meta_alvo);
    setValorManual(meta.valor_manual || 0);
    setIdEvento(meta.id_evento || '');
    setMetaVisitas(meta.meta_visitas ?? 0);
    setMetaLeads(meta.meta_leads ?? 0);
    setMetaConversao(meta.meta_conversao ?? 0);
    setModalOpen(true);
  };

  const handleSelectEventInModal = (nextEventId: string) => {
    const prevEvent = eventos.find(e => e.id_evento === idEvento);
    const nextEvent = eventos.find(e => e.id_evento === nextEventId);
    setIdEvento(nextEventId);
    setFormErro(null);

    if (nextEvent) {
      const expectedPrevTitle = prevEvent ? `Meta · ${prevEvent.nome}` : '';
      if (!titulo.trim() || titulo === expectedPrevTitle) {
        setTitulo(`Meta · ${nextEvent.nome}`);
      }
      if (!editingGoal && nextEvent.responsavel_id) {
        setResponsavelId(nextEvent.responsavel_id);
      }
    }
  };

  const handleSaveMeta = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErro(null);

    if (tipo === 'EVENTO') {
      if (!idEvento) {
        setFormErro('Selecione um evento para definir as metas.');
        return;
      }
      const ev = eventos.find(item => item.id_evento === idEvento);
      const resolvedTitulo = titulo.trim() || (ev ? `Meta · ${ev.nome}` : 'Meta de Evento');
      const vTarget = Math.max(0, Number(metaVisitas) || 0);
      const lTarget = Math.max(0, Number(metaLeads) || 0);
      const cTarget = Math.max(0, Math.min(100, Number(metaConversao) || 0));

      const metaObj: MetaEntity = {
        id_meta: editingGoal?.id_meta || `MET-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        responsavel_id: canManageAll ? responsavelId : currentUser.id_usuario,
        titulo: resolvedTitulo,
        tipo: 'EVENTO',
        meta_alvo: lTarget,
        periodo,
        criado_em: editingGoal?.criado_em || new Date().toISOString(),
        id_evento: idEvento,
        meta_visitas: vTarget,
        meta_leads: lTarget,
        meta_conversao: cTarget
      };

      storage.saveMeta(metaObj);
      setModalOpen(false);
      setEditingGoal(null);
      return;
    }

    if (!titulo.trim()) {
      setFormErro('Informe o título da meta.');
      return;
    }

    const metaObj: MetaEntity = {
      id_meta: editingGoal?.id_meta || `MET-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      responsavel_id: canManageAll ? responsavelId : currentUser.id_usuario,
      titulo: titulo.trim(),
      tipo,
      meta_alvo: Number(metaAlvo) || 0,
      valor_manual: tipo === 'CUSTOM' ? Number(valorManual) || 0 : undefined,
      periodo,
      criado_em: editingGoal?.criado_em || new Date().toISOString()
    };

    storage.saveMeta(metaObj);
    setTitulo('');
    setValorManual(0);
    setEditingGoal(null);
    setModalOpen(false);
  };

  const handleSaveInlineManual = (idMeta: string) => {
    storage.updateMetaManualValue(idMeta, Number(editingValor) || 0);
    setEditingMetaId(null);
  };

  const handleDeleteMeta = (idMeta: string) => {
    storage.deleteMeta(idMeta);
    setConfirmDeleteId(null);
  };

  const handleCopyEventLink = (evId: string, slug: string) => {
    if (typeof window === 'undefined' || !navigator?.clipboard) return;
    const path = buildPublicEventPath(slug);
    const fullUrl = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedEventId(evId);
      setTimeout(() => setCopiedEventId(prev => (prev === evId ? null : prev)), 2000);
    }).catch(() => {});
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
              Central de Metas &amp; Desempenho
            </h2>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Acompanhe metas de eventos (visitas ao link, leads cadastrados e conversão no Kanban), metas financeiras e individuais.
          </p>
        </div>

        {canManageAll && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => openCreateModal('EVENTO')}
              className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm shadow-orange-600/30 transition-colors cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              <span>Nova Meta de Evento</span>
            </button>
            <button
              onClick={() => openCreateModal('DINHEIRO')}
              className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-100 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Meta Geral</span>
            </button>
          </div>
        )}
      </div>

      {/* Sub-abas */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-fit shadow-sm">
        <button
          onClick={() => setActiveTab('TODAS')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'TODAS'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <span>Todas</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
            activeTab === 'TODAS' ? 'bg-white/20 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
          }`}>
            {metasVisiveis.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('EVENTOS')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'EVENTOS'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Metas de Eventos</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
            activeTab === 'EVENTOS' ? 'bg-white/20 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
          }`}>
            {metasEventos.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('GERAIS')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'GERAIS'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Metas Gerais &amp; Equipe</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
            activeTab === 'GERAIS' ? 'bg-white/20 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
          }`}>
            {metasGerais.length}
          </span>
        </button>
      </div>

      {/* Grid de Metas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {metasFiltradas.length === 0 ? (
          <div className="col-span-full p-12 text-center space-y-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
            <div className="w-11 h-11 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto">
              {activeTab === 'EVENTOS' ? <Calendar className="w-5 h-5" /> : <Target className="w-5 h-5" />}
            </div>
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              {activeTab === 'EVENTOS'
                ? 'Nenhuma Meta de Evento cadastrada ainda.'
                : activeTab === 'GERAIS'
                  ? 'Nenhuma Meta Geral cadastrada.'
                  : 'Nenhuma meta cadastrada.'}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
              {activeTab === 'EVENTOS'
                ? 'Selecione um evento e defina metas prévias de Visitas ao link, Leads que agendaram e Conversão (%) no Kanban.'
                : 'Crie metas de eventos ou metas financeiras/numéricas para acompanhar o desempenho em tempo real.'}
            </p>
            {canManageAll && (
              <div className="pt-1 flex items-center justify-center gap-2">
                <button
                  onClick={() => openCreateModal(activeTab === 'GERAIS' ? 'DINHEIRO' : 'EVENTO')}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{activeTab === 'GERAIS' ? 'Criar Meta Geral' : 'Criar Meta de Evento'}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          metasFiltradas.map((meta) => {
            const responsavel = usuarios.find(u => u.id_usuario === meta.responsavel_id);
            const isConfirmingDelete = confirmDeleteId === meta.id_meta;

            if (meta.tipo === 'EVENTO') {
              const evento = eventos.find(e => e.id_evento === meta.id_evento);
              const metrics = calcularMetricasEvento(meta.id_evento);

              const alvoVisitas = Number(meta.meta_visitas) || 0;
              const alvoLeads = Number(meta.meta_leads) || 0;
              const alvoConversao = Number(meta.meta_conversao) || 0;

              const pctVisitas = alvoVisitas > 0
                ? Math.min(100, Math.round((metrics.visitas / alvoVisitas) * 100))
                : (metrics.visitas > 0 ? 100 : 0);
              const pctLeads = alvoLeads > 0
                ? Math.min(100, Math.round((metrics.leadsCount / alvoLeads) * 100))
                : (metrics.leadsCount > 0 ? 100 : 0);
              const pctConversao = alvoConversao > 0
                ? Math.min(100, Math.round((metrics.conversaoPct / alvoConversao) * 100))
                : (metrics.conversaoPct > 0 ? 100 : 0);

              const todasAtingidas =
                (alvoVisitas === 0 || metrics.visitas >= alvoVisitas) &&
                (alvoLeads === 0 || metrics.leadsCount >= alvoLeads) &&
                (alvoConversao === 0 || metrics.conversaoPct >= alvoConversao) &&
                (alvoVisitas > 0 || alvoLeads > 0 || alvoConversao > 0);

              return (
                <div
                  key={meta.id_meta}
                  className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    {/* Badges + Ações */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-bold uppercase flex items-center gap-1">
                          <Calendar size={10} />
                          Meta de Evento
                        </span>
                        {evento ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              evento.status === 'PUBLICADO'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                            }`}
                          >
                            {evento.status}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold uppercase">
                            Evento Removido
                          </span>
                        )}
                        {meta.periodo && (
                          <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-[10px] font-mono">
                            {meta.periodo}
                          </span>
                        )}
                      </div>

                      {canManageAll && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEditModal(meta)}
                            className="p-1 text-neutral-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer"
                            title="Editar metas do evento"
                          >
                            <Edit3 size={14} />
                          </button>
                          {isConfirmingDelete ? (
                            <>
                              <button
                                onClick={() => handleDeleteMeta(meta.id_meta)}
                                className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                                title="Confirmar exclusão"
                              >
                                Excluir
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="p-0.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                                title="Cancelar"
                              >
                                <X size={13} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(meta.id_meta)}
                              className="p-1 text-neutral-400 hover:text-red-600 transition-colors cursor-pointer"
                              title="Excluir meta"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Título & Evento */}
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-white leading-tight">
                        {meta.titulo}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          <strong className="text-neutral-700 dark:text-neutral-200">{responsavel?.nome || 'Geral (Equipe)'}</strong>
                        </span>
                        {evento?.slug && (
                          <button
                            type="button"
                            onClick={() => handleCopyEventLink(evento.id_evento, evento.slug)}
                            className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 hover:underline font-mono cursor-pointer"
                            title="Copiar link público do evento"
                          >
                            {copiedEventId === evento.id_evento ? (
                              <>
                                <Check size={11} />
                                <span>Link copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
                                <span>/agendar/{evento.slug}</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 3 Indicadores do Evento */}
                  <div className="space-y-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                    {/* 1. Visitas ao Link */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300">
                          <Eye size={13} className="text-blue-500" />
                          <span>Visitas ao Link</span>
                        </span>
                        <span className="font-mono font-bold text-neutral-900 dark:text-white">
                          {metrics.visitas} <span className="text-neutral-400 font-normal">/ {alvoVisitas}</span>
                          <span className="ml-1.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                            ({pctVisitas}%)
                          </span>
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            alvoVisitas > 0 && metrics.visitas >= alvoVisitas ? 'bg-emerald-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${pctVisitas}%` }}
                        />
                      </div>
                    </div>

                    {/* 2. Leads Cadastrados (preencheram e agendaram) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300">
                          <UserCheck size={13} className="text-orange-500" />
                          <span>Leads Cadastrados</span>
                        </span>
                        <span className="font-mono font-bold text-neutral-900 dark:text-white">
                          {metrics.leadsCount} <span className="text-neutral-400 font-normal">/ {alvoLeads}</span>
                          <span className="ml-1.5 text-[10px] font-semibold text-orange-600 dark:text-orange-400">
                            ({pctLeads}%)
                          </span>
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            alvoLeads > 0 && metrics.leadsCount >= alvoLeads ? 'bg-emerald-500' : 'bg-orange-500'
                          }`}
                          style={{ width: `${pctLeads}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400">
                        <span>Preencheram e agendaram: {metrics.agendamentosCount} agend.</span>
                        <span className="font-mono">Visita→Lead: {metrics.taxaVisitaLeadPct}%</span>
                      </div>
                    </div>

                    {/* 3. Conversão no Kanban (%) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300">
                          <TrendingUp size={13} className="text-emerald-500" />
                          <span>Conversão Kanban</span>
                        </span>
                        <span className="font-mono font-bold text-neutral-900 dark:text-white">
                          {metrics.conversaoPct}% <span className="text-neutral-400 font-normal">/ {alvoConversao}%</span>
                          <span className="ml-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            ({pctConversao}%)
                          </span>
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            alvoConversao > 0 && metrics.conversaoPct >= alvoConversao ? 'bg-emerald-500' : 'bg-emerald-600/80'
                          }`}
                          style={{ width: `${pctConversao}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400">
                        <span>{metrics.ganhosFunil} ganho(s) de {metrics.totalFunil} card(s) no Kanban</span>
                        {todasAtingidas && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            Metas Atingidas
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Card padrão para metas Financeira, Numérica e Manual
            const atual = calcularValorAtual(meta);
            const progresso = Math.min(100, Math.round((atual / (meta.meta_alvo || 1)) * 100));
            const isEditingInline = editingMetaId === meta.id_meta;

            return (
              <div
                key={meta.id_meta}
                className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-bold uppercase">
                        {meta.tipo === 'DINHEIRO' ? 'Financeiro (Auto)' : meta.tipo === 'NUMERO' ? 'Numérico (Auto)' : 'Manual (Custom)'}
                      </span>
                      {meta.periodo && (
                        <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-[10px] font-mono">
                          {meta.periodo}
                        </span>
                      )}
                    </div>

                    {canManageAll && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEditModal(meta)}
                          className="p-1 text-neutral-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer"
                          title="Editar meta"
                        >
                          <Edit3 size={14} />
                        </button>
                        {isConfirmingDelete ? (
                          <>
                            <button
                              onClick={() => handleDeleteMeta(meta.id_meta)}
                              className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                              title="Confirmar exclusão"
                            >
                              Excluir
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="p-0.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                              title="Cancelar"
                            >
                              <X size={13} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(meta.id_meta)}
                            className="p-1 text-neutral-400 hover:text-red-600 transition-colors cursor-pointer"
                            title="Excluir meta"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white leading-tight">
                    {meta.titulo}
                  </h3>

                  <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                    <Users size={13} />
                    <span>Responsável: <strong className="text-neutral-800 dark:text-neutral-200">{responsavel?.nome || 'Geral (Equipe)'}</strong></span>
                  </p>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-baseline justify-between text-xs gap-2">
                    <span className="text-neutral-500">Progresso ({progresso}%)</span>
                    <span className="font-bold text-neutral-900 dark:text-white font-mono text-right">
                      {meta.tipo === 'DINHEIRO'
                        ? `${atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / ${meta.meta_alvo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                        : `${atual} / ${meta.meta_alvo}`}
                    </span>
                  </div>

                  <div className="w-full h-2.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        progresso >= 100 ? 'bg-emerald-500' : 'bg-orange-600'
                      }`}
                      style={{ width: `${progresso}%` }}
                    />
                  </div>

                  {meta.tipo === 'CUSTOM' && (
                    <div className="pt-1 flex items-center justify-between gap-2">
                      {isEditingInline ? (
                        <div className="flex items-center gap-1.5 w-full">
                          <input
                            type="number"
                            value={editingValor}
                            onChange={(e) => setEditingValor(Number(e.target.value))}
                            className="flex-1 px-2.5 py-1 bg-neutral-50 dark:bg-neutral-950 border border-orange-500 rounded-lg text-xs font-mono text-neutral-900 dark:text-white focus:outline-none"
                          />
                          <button
                            onClick={() => handleSaveInlineManual(meta.id_meta)}
                            className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                            title="Salvar valor"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={() => setEditingMetaId(null)}
                            className="p-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 cursor-pointer"
                            title="Cancelar"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingMetaId(meta.id_meta);
                            setEditingValor(meta.valor_manual || 0);
                          }}
                          className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 size={12} />
                          <span>Atualizar valor manualmente</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Cadastrar / Editar Meta */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                {tipo === 'EVENTO' ? (
                  <Calendar className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                ) : (
                  <Target className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                )}
                <span>
                  {editingGoal
                    ? (tipo === 'EVENTO' ? 'Editar Meta de Evento' : 'Editar Meta')
                    : (tipo === 'EVENTO' ? 'Nova Meta de Evento' : 'Cadastrar Nova Meta')}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setEditingGoal(null);
                }}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {formErro && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{formErro}</span>
              </div>
            )}

            <form onSubmit={handleSaveMeta} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Tipo de Meta</label>
                <select
                  value={tipo}
                  onChange={(e) => {
                    const nextTipo = e.target.value as MetaTipo;
                    setTipo(nextTipo);
                    setFormErro(null);
                    if (nextTipo === 'EVENTO' && !idEvento && eventos.length > 0) {
                      handleSelectEventInModal(eventos[0].id_evento);
                    }
                  }}
                  className="w-full px-3.5 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="EVENTO">Meta de Evento (Visitas, Leads e Conversão %)</option>
                  <option value="DINHEIRO">Financeiro (R$ Automático do CRM Ganho)</option>
                  <option value="NUMERO">Numérico (Automático de Agendamentos)</option>
                  <option value="CUSTOM">Manual (Outras metas preenchidas manualmente)</option>
                </select>
              </div>

              {tipo === 'EVENTO' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Selecionar Evento
                  </label>
                  {eventos.length === 0 ? (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
                      Nenhum evento cadastrado. Crie um evento na aba Eventos primeiro para vincular metas.
                    </div>
                  ) : (
                    <select
                      value={idEvento}
                      onChange={(e) => handleSelectEventInModal(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                    >
                      <option value="">Selecione um evento...</option>
                      {eventos.map(ev => (
                        <option key={ev.id_evento} value={ev.id_evento}>
                          {ev.nome} ({ev.status})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Título da Meta</label>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder={tipo === 'EVENTO' ? 'ex: Meta · Workshop Comercial' : 'ex: Fechamento de Vendas Novembro'}
                  required
                  className="w-full px-3.5 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Responsável</label>
                  <select
                    value={responsavelId}
                    onChange={(e) => setResponsavelId(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="GERAL">Geral (Equipe)</option>
                    {usuarios.filter(u => u.ativo !== false).map(u => (
                      <option key={u.id_usuario} value={u.id_usuario}>{u.nome} ({u.perfil})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Período (Mês)</label>
                  <input
                    type="month"
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500 font-mono"
                  />
                </div>
              </div>

              {tipo === 'EVENTO' ? (
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Metas Pré-definidas do Evento
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                        <Eye size={12} className="text-blue-500" />
                        <span>Meta de Visitas</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={metaVisitas}
                        onChange={(e) => setMetaVisitas(Number(e.target.value))}
                        required
                        className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                        <UserCheck size={12} className="text-orange-500" />
                        <span>Meta de Leads</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={metaLeads}
                        onChange={(e) => setMetaLeads(Number(e.target.value))}
                        required
                        className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                        <TrendingUp size={12} className="text-emerald-500" />
                        <span>Conversão (%)</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        value={metaConversao}
                        onChange={(e) => setMetaConversao(Number(e.target.value))}
                        required
                        className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500 font-mono"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    O card contabilizará automaticamente cada acesso ao link do evento, os leads que preencheram e agendaram, e os fechamentos (Ganho) no Kanban.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Meta Alvo (Valor numérico)</label>
                    <input
                      type="number"
                      value={metaAlvo}
                      onChange={(e) => setMetaAlvo(Number(e.target.value))}
                      required
                      className="w-full px-3.5 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500 font-mono"
                    />
                  </div>

                  {tipo === 'CUSTOM' && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Valor Atual Alcançado (Manual)</label>
                      <input
                        type="number"
                        value={valorManual}
                        onChange={(e) => setValorManual(Number(e.target.value))}
                        className="w-full px-3.5 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500 font-mono"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setEditingGoal(null);
                  }}
                  className="px-3.5 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={tipo === 'EVENTO' && eventos.length === 0}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
                >
                  {editingGoal ? 'Salvar Alterações' : 'Salvar Meta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
