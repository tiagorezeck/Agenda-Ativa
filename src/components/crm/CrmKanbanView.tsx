import React, { useState, useMemo, useEffect } from 'react';
import { storage } from '../../services/storageService';
import { getLoggedInUser, podeAcessarTodoCrm } from '../../services/authService';
import {
  AgendamentoEntity,
  CrmOportunidadeEntity,
  EstagioCrm,
  EventoEntity,
  LeadEntity,
  StatusAgendamento,
  TipoHistoricoCrm,
  UsuarioEntity
} from '../../types/database';
import { formatarMoedaBRL, formatarDataBR, formatarDataHoraBR, formatarTelefoneBR, gerarCodigoAleatorio } from '../../utils/formatters';
import {
  Plus,
  Search,
  DollarSign,
  Clock,
  Calendar,
  X,
  AlertOctagon,
  Zap,
  PauseCircle,
  ArrowRightLeft,
  Filter,
  RotateCcw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export type ColunaCrmId = 'ENTRADA' | 'REUNIAO' | 'FOLLOW_UP_STAND_BY' | 'GANHO' | 'PERDIDO' | 'CANCELADO';

interface ColunaDef {
  id: ColunaCrmId;
  label: string;
  cor: string;
  descricao?: string;
}

const COLUNAS_CRM: ColunaDef[] = [
  { id: 'ENTRADA', label: '1. Entrada', cor: 'border-blue-500' },
  { id: 'REUNIAO', label: '2. Reunião', cor: 'border-indigo-500' },
  { id: 'FOLLOW_UP_STAND_BY', label: '3. Follow-up / Stand By', cor: 'border-amber-500' },
  { id: 'GANHO', label: '4. Ganho', cor: 'border-emerald-500' },
  { id: 'PERDIDO', label: '5. Perdido', cor: 'border-rose-500' },
  { id: 'CANCELADO', label: '6. Cancelado', cor: 'border-neutral-400 dark:border-neutral-600' },
];

export const CrmKanbanView: React.FC = () => {
  const db = storage.getDatabase();
  const crmCards = db.crm;
  const [currentUser, setCurrentUser] = useState<UsuarioEntity>(() => getLoggedInUser());

  useEffect(() => {
    const handleAuth = () => setCurrentUser(getLoggedInUser());
    window.addEventListener('auth_user_changed', handleAuth);
    return () => window.removeEventListener('auth_user_changed', handleAuth);
  }, []);

  const canAccessAllCrm = podeAcessarTodoCrm(currentUser);

  const [busca, setBusca] = useState('');
  const [eventoFiltro, setEventoFiltro] = useState('todos');
  const [dataFiltro, setDataFiltro] = useState('todas');
  const [horarioFiltro, setHorarioFiltro] = useState('todos');
  const [responsavelFiltro, setResponsavelFiltro] = useState('todos');
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});

  const toggleExpandCard = (idOportunidade: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCardIds((prev) => ({
      ...prev,
      [idOportunidade]: !prev[idOportunidade]
    }));
  };

  // Modais
  const [cardEmEdicao, setCardEmEdicao] = useState<CrmOportunidadeEntity | null>(null);
  const [modalNovoCard, setModalNovoCard] = useState(false);
  const [modalPerda, setModalPerda] = useState<{ idOportunidade: string; estagio: EstagioCrm } | null>(null);
  const [motivoPerdaInput, setMotivoPerdaInput] = useState('');
  const [modalGanho, setModalGanho] = useState<{ idOportunidade: string; estagio: EstagioCrm } | null>(null);
  const [valorFechadoInput, setValorFechadoInput] = useState<number>(0);

  // Submissão de anotação
  const [novaNota, setNovaNota] = useState('');
  const [tipoNota, setTipoNota] = useState<TipoHistoricoCrm>('NOTA');

  // Nova Oportunidade Manual
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoProdutoNome, setNovoProdutoNome] = useState('');
  const [novoValorMensal, setNovoValorMensal] = useState<number>(0);
  const [novoParcelas, setNovoParcelas] = useState<number>(1);
  const [novoLeadId, setNovoLeadId] = useState(db.leads.find(l => !l.excluido)?.id_lead || '');
  const [novoValorEstimado, setNovoValorEstimado] = useState(5000);
  const [novoResponsavel, setNovoResponsavel] = useState('USR-001');

  const [refreshKey, setRefreshKey] = useState(0);

  // Mapas de acesso rápido para relacionar Agendamento, Evento, Lead e Responsável
  const agendamentosById = useMemo(() => {
    const map = new Map<string, AgendamentoEntity>();
    db.agendamentos.forEach((a) => map.set(a.id_agendamento, a));
    return map;
  }, [db.agendamentos, refreshKey]);

  const eventosById = useMemo(() => {
    const map = new Map<string, EventoEntity>();
    db.eventos.forEach((ev) => map.set(ev.id_evento, ev));
    return map;
  }, [db.eventos, refreshKey]);

  const leadsById = useMemo(() => {
    const map = new Map<string, LeadEntity>();
    db.leads.forEach((l) => map.set(l.id_lead, l));
    return map;
  }, [db.leads, refreshKey]);

  const usuariosById = useMemo(() => {
    const map = new Map<string, UsuarioEntity>();
    db.usuarios.forEach((u) => map.set(u.id_usuario, u));
    return map;
  }, [db.usuarios, refreshKey]);

  const getCardContext = (card: CrmOportunidadeEntity) => {
    const lead = leadsById.get(card.id_lead);
    const agendamento = card.id_agendamento_origem
      ? agendamentosById.get(card.id_agendamento_origem)
      : undefined;

    let evento: EventoEntity | undefined = agendamento?.id_evento
      ? eventosById.get(agendamento.id_evento)
      : undefined;

    if (!evento && card.produto_nome) {
      evento = db.eventos.find(
        (ev) => ev.produto_nome === card.produto_nome || ev.nome === card.produto_nome
      );
    }
    if (!evento && !agendamento && lead?.origem_primeiro_evento) {
      evento = eventosById.get(lead.origem_primeiro_evento);
    }

    return { lead, agendamento, evento };
  };

  // Helper para verificar se o card pertence à coluna
  const isCardInColumn = (card: CrmOportunidadeEntity, colunaId: ColunaCrmId): boolean => {
    if (colunaId === 'FOLLOW_UP_STAND_BY') {
      return (
        card.estagio === 'FOLLOW_UP_STAND_BY' ||
        card.estagio === 'FOLLOW_UP' ||
        card.estagio === 'STAND_BY'
      );
    }
    return card.estagio === colunaId;
  };

  // Helper para obter se o card é Follow ou Stand
  const getCardSubStatus = (card: CrmOportunidadeEntity): 'FOLLOW' | 'STAND' => {
    if (card.sub_status) return card.sub_status;
    if (card.estagio === 'STAND_BY') return 'STAND';
    return 'FOLLOW';
  };

  const handleSelectEventoFiltro = (nextEventoId: string) => {
    setEventoFiltro(nextEventoId);
    setDataFiltro('todas');
    setHorarioFiltro('todos');
  };

  const handleLimparFiltros = () => {
    setBusca('');
    setEventoFiltro('todos');
    setDataFiltro('todas');
    setHorarioFiltro('todos');
    setResponsavelFiltro('todos');
  };

  const temFiltroAtivo =
    Boolean(busca.trim()) ||
    eventoFiltro !== 'todos' ||
    dataFiltro !== 'todas' ||
    horarioFiltro !== 'todos' ||
    responsavelFiltro !== 'todos';

  // Contagem de cards por Evento para o seletor
  const contagemPorEvento = useMemo(() => {
    const counts = new Map<string, number>();
    crmCards.forEach((card) => {
      const { evento } = getCardContext(card);
      if (evento) {
        counts.set(evento.id_evento, (counts.get(evento.id_evento) || 0) + 1);
      }
    });
    return counts;
  }, [crmCards, agendamentosById, eventosById, leadsById, db.eventos]);

  // Cards pré-filtrados por Evento, Responsável e Busca (base para listar Datas e Horários disponíveis)
  const cardsBaseEventoBusca = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return crmCards.filter((card) => {
      if (responsavelFiltro !== 'todos' && card.responsavel_id !== responsavelFiltro) return false;
      const { lead, agendamento, evento } = getCardContext(card);
      if (!canAccessAllCrm) {
        const isOwner =
          card.responsavel_id === currentUser.id_usuario ||
          evento?.responsavel_id === currentUser.id_usuario ||
          lead?.responsavel_id === currentUser.id_usuario;
        if (!isOwner) return false;
      }
      if (eventoFiltro !== 'todos' && evento?.id_evento !== eventoFiltro) return false;
      if (!termo) return true;
      return (
        card.titulo.toLowerCase().includes(termo) ||
        (lead && (
          lead.nome.toLowerCase().includes(termo) ||
          (lead.local || '').toLowerCase().includes(termo) ||
          (lead.whatsapp || '').includes(termo)
        )) ||
        (agendamento && agendamento.protocolo.toLowerCase().includes(termo)) ||
        (evento && evento.nome.toLowerCase().includes(termo))
      );
    });
  }, [crmCards, busca, responsavelFiltro, eventoFiltro, agendamentosById, eventosById, leadsById, db.eventos, canAccessAllCrm, currentUser.id_usuario]);

  // Datas disponíveis nos cards do filtro atual
  const datasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    cardsBaseEventoBusca.forEach((card) => {
      const agd = card.id_agendamento_origem ? agendamentosById.get(card.id_agendamento_origem) : undefined;
      if (agd?.data_agendamento) {
        set.add(agd.data_agendamento);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cardsBaseEventoBusca, agendamentosById]);

  // Lista de Horários da Agenda (combina slots configurados do Evento + horários com agendamentos no CRM)
  const horariosAgendaFiltro = useMemo(() => {
    const slotMap = new Map<string, { hora_inicio: string; hora_fim: string; count: number }>();

    if (eventoFiltro !== 'todos') {
      db.horarios
        .filter((h) => h.id_evento === eventoFiltro && h.ativo)
        .forEach((h) => {
          if (h.hora_inicio && !slotMap.has(h.hora_inicio)) {
            slotMap.set(h.hora_inicio, {
              hora_inicio: h.hora_inicio,
              hora_fim: h.hora_fim || h.hora_inicio,
              count: 0
            });
          }
        });
    } else {
      db.horarios
        .filter((h) => h.ativo)
        .forEach((h) => {
          if (h.hora_inicio && !slotMap.has(h.hora_inicio)) {
            slotMap.set(h.hora_inicio, {
              hora_inicio: h.hora_inicio,
              hora_fim: h.hora_fim || h.hora_inicio,
              count: 0
            });
          }
        });
    }

    cardsBaseEventoBusca.forEach((card) => {
      const agd = card.id_agendamento_origem ? agendamentosById.get(card.id_agendamento_origem) : undefined;
      if (!agd || !agd.hora_inicio) return;
      if (dataFiltro !== 'todas' && agd.data_agendamento !== dataFiltro) return;

      const existing = slotMap.get(agd.hora_inicio);
      if (existing) {
        existing.count += 1;
      } else {
        slotMap.set(agd.hora_inicio, {
          hora_inicio: agd.hora_inicio,
          hora_fim: agd.hora_fim || agd.hora_inicio,
          count: 1
        });
      }
    });

    const list = Array.from(slotMap.values());
    // Quando nenhum evento específico estiver selecionado, prioriza horários configurados ou com leads
    return list.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  }, [eventoFiltro, dataFiltro, db.horarios, cardsBaseEventoBusca, agendamentosById]);

  // Cards Filtrados finais (Evento + Data + Horário + Responsável + Busca)
  const cardsFiltrados = useMemo(() => {
    return cardsBaseEventoBusca.filter((card) => {
      if (dataFiltro === 'todas' && horarioFiltro === 'todos') return true;
      const agd = card.id_agendamento_origem ? agendamentosById.get(card.id_agendamento_origem) : undefined;
      if (!agd) return false;
      if (dataFiltro !== 'todas' && agd.data_agendamento !== dataFiltro) return false;
      if (horarioFiltro !== 'todos' && agd.hora_inicio !== horarioFiltro) return false;
      return true;
    });
  }, [cardsBaseEventoBusca, dataFiltro, horarioFiltro, agendamentosById]);

  // Totalizador de Vendas Conquistadas (reflete o filtro ativo, ex: só o evento selecionado)
  const valorTotalGanho = useMemo(() => {
    return cardsFiltrados
      .filter(c => c.estagio === 'GANHO')
      .reduce((acc, c) => acc + (c.valor_fechado || c.valor_estimado || 0), 0);
  }, [cardsFiltrados]);

  const valorTotalAberto = useMemo(() => {
    return cardsFiltrados
      .filter(c => c.estagio !== 'GANHO' && c.estagio !== 'PERDIDO' && c.estagio !== 'CANCELADO')
      .reduce((acc, c) => acc + (c.valor_estimado || 0), 0);
  }, [cardsFiltrados]);

  const handleDragStart = (idOportunidade: string) => {
    setDraggedCardId(idOportunidade);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (colunaDestino: ColunaCrmId) => {
    if (!draggedCardId) return;

    const card = crmCards.find(c => c.id_oportunidade === draggedCardId);
    if (!card) {
      setDraggedCardId(null);
      return;
    }

    if (isCardInColumn(card, colunaDestino)) {
      setDraggedCardId(null);
      return;
    }

    if (colunaDestino === 'PERDIDO') {
      setModalPerda({ idOportunidade: draggedCardId, estagio: 'PERDIDO' });
      setDraggedCardId(null);
      return;
    }

    if (colunaDestino === 'GANHO') {
      setValorFechadoInput(card.valor_estimado || 5000);
      setModalGanho({ idOportunidade: draggedCardId, estagio: 'GANHO' });
      setDraggedCardId(null);
      return;
    }

    const novoEstagio: EstagioCrm = colunaDestino;
    storage.updateCrmStage(draggedCardId, novoEstagio);
    setDraggedCardId(null);
    setRefreshKey(k => k + 1);
  };

  const handleToggleFollowStand = (idOportunidade: string) => {
    storage.toggleCardFollowStand(idOportunidade);
    // Atualizar card em edição se for o mesmo
    if (cardEmEdicao && cardEmEdicao.id_oportunidade === idOportunidade) {
      const atualizado = storage.getDatabase().crm.find(c => c.id_oportunidade === idOportunidade);
      if (atualizado) setCardEmEdicao({ ...atualizado });
    }
    setRefreshKey(k => k + 1);
  };

  const handleConfirmarPerda = () => {
    if (!modalPerda) return;
    storage.updateCrmStage(modalPerda.idOportunidade, 'PERDIDO', {
      motivoPerda: motivoPerdaInput.trim() || 'Sem motivo detalhado informado',
      descricao: `Oportunidade dada como perdida. Motivo: ${motivoPerdaInput}`
    });
    setModalPerda(null);
    setMotivoPerdaInput('');
    setRefreshKey(k => k + 1);
  };

  const handleConfirmarGanho = () => {
    if (!modalGanho) return;
    storage.updateCrmStage(modalGanho.idOportunidade, 'GANHO', {
      valorFechado: Number(valorFechadoInput) || 0,
      descricao: `Venda conquistada no valor de ${formatarMoedaBRL(Number(valorFechadoInput) || 0)}`
    });
    setModalGanho(null);
    setRefreshKey(k => k + 1);
  };

  const handleCriarCardManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTitulo.trim() || !novoLeadId) return;

    const idOp = `CRM-${gerarCodigoAleatorio(6)}`;
    const nowIso = new Date().toISOString();

    const novoCard: CrmOportunidadeEntity = {
      id_oportunidade: idOp,
      id_lead: novoLeadId,
      titulo: novoTitulo.trim(),
      produto_nome: novoProdutoNome.trim() || undefined,
      produto_valor_mensal: novoValorMensal > 0 ? novoValorMensal : undefined,
      produto_parcelas: novoValorMensal > 0 ? Math.max(1, novoParcelas) : undefined,
      estagio: 'ENTRADA',
      sub_status: 'FOLLOW',
      valor_estimado: Number(novoValorEstimado) || 0,
      valor_fechado: 0,
      responsavel_id: novoResponsavel,
      data_proximo_followup: new Date().toISOString().slice(0, 10),
      ordem_coluna: 1,
      criado_em: nowIso,
      atualizado_em: nowIso
    };

    storage.saveCrmOpportunity(novoCard);
    storage.addCrmHistory(idOp, 'MUDANCA_ESTAGIO', 'Oportunidade criada manualmente no CRM');

    setModalNovoCard(false);
    setNovoTitulo('');
    setNovoProdutoNome('');
    setNovoValorMensal(0);
    setNovoParcelas(1);
    setRefreshKey(k => k + 1);
  };

  const handleAddAnotacao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardEmEdicao || !novaNota.trim()) return;

    storage.addCrmHistory(cardEmEdicao.id_oportunidade, tipoNota, novaNota.trim());
    setNovaNota('');
    setRefreshKey(k => k + 1);
  };

  const historicoDoCard = useMemo(() => {
    if (!cardEmEdicao) return [];
    return db.historico_crm.filter(h => h.id_oportunidade === cardEmEdicao.id_oportunidade);
  }, [cardEmEdicao, db.historico_crm, refreshKey]);

  const handleAlterarStatusAgendamento = (idAgendamento: string, novoStatus: StatusAgendamento) => {
    storage.updateAgendamentoStatus(
      idAgendamento,
      novoStatus,
      novoStatus === 'CANCELADO' ? 'Cancelado pelo operador no CRM Kanban' : undefined
    );
    setRefreshKey(k => k + 1);
  };

  const eventoSelecionadoObj = eventoFiltro !== 'todos' ? eventosById.get(eventoFiltro) : undefined;

  const formatStatusAgendamentoLabel = (status?: StatusAgendamento) => {
    switch (status) {
      case 'REALIZADO':
        return { label: 'Realizado', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300 border-sky-300/70 dark:border-sky-700/60' };
      case 'CANCELADO':
        return { label: 'Cancelado', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border-rose-300/70 dark:border-rose-700/60' };
      case 'NO_SHOW':
        return { label: 'Não compareceu', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-amber-300/70 dark:border-amber-700/60' };
      default:
        return { label: 'Confirmado', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300/70 dark:border-emerald-700/60' };
    }
  };

  return (
    <div className="space-y-2">
      {/* Card Unificado Otimizado */}
      <div className="p-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-2 shadow-sm transition-colors">
        {/* Linha Principal: Título, Filtros Expandidos e Totais */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[300px]">
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight shrink-0">
              CRM Kanban
            </h2>
            {eventoSelecionadoObj && (
              <span className="px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/30 text-orange-600 dark:text-orange-400 text-[10px] font-semibold truncate max-w-[120px]">
                {eventoSelecionadoObj.nome}
              </span>
            )}
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 shrink-0">
              ({cardsFiltrados.length})
            </span>

            {/* Filtros ocupando o espaço disponível entre o título e os totais */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0 ml-1">
              <div className="relative flex-1 min-w-[130px] max-w-[200px]">
                <Search className="w-3 h-3 text-neutral-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Pesquisar..."
                  className="w-full pl-7 pr-2 py-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded text-[11px] text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-orange-500"
                />
              </div>

              <select
                value={eventoFiltro}
                onChange={(e) => handleSelectEventoFiltro(e.target.value)}
                aria-label="Filtrar por Evento"
                className="flex-1 min-w-[110px] max-w-[160px] px-2 py-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded text-[11px] text-neutral-800 dark:text-white focus:outline-none focus:border-orange-500 truncate"
              >
                <option value="todos">Todos Eventos</option>
                {db.eventos.map(ev => (
                  <option key={ev.id_evento} value={ev.id_evento}>
                    {ev.nome}
                  </option>
                ))}
              </select>

              <select
                value={dataFiltro}
                onChange={(e) => setDataFiltro(e.target.value)}
                aria-label="Filtrar por Data"
                className="w-28 px-2 py-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded text-[11px] text-neutral-800 dark:text-white focus:outline-none focus:border-orange-500 truncate"
              >
                <option value="todas">Todas Datas</option>
                {datasDisponiveis.map(dt => (
                  <option key={dt} value={dt}>
                    {formatarDataBR(dt)}
                  </option>
                ))}
              </select>

              <select
                value={horarioFiltro}
                onChange={(e) => setHorarioFiltro(e.target.value)}
                aria-label="Filtrar por Horário"
                className="w-28 px-2 py-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded text-[11px] text-neutral-800 dark:text-white focus:outline-none focus:border-orange-500 truncate"
              >
                <option value="todos">Todos Horários</option>
                {horariosAgendaFiltro.map(slot => (
                  <option key={slot.hora_inicio} value={slot.hora_inicio}>
                    {slot.hora_inicio} ({slot.count})
                  </option>
                ))}
              </select>

              <select
                value={responsavelFiltro}
                onChange={(e) => setResponsavelFiltro(e.target.value)}
                aria-label="Filtrar por Responsável"
                className="w-24 px-1.5 py-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded text-[11px] text-neutral-800 dark:text-white focus:outline-none focus:border-orange-500 truncate"
              >
                <option value="todos">Resp.</option>
                {db.usuarios.map(u => (
                  <option key={u.id_usuario} value={u.id_usuario}>
                    {u.nome.split(' ')[0]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Lado Direito: Ganho, Aberto e Botão + Novo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="px-2 py-0.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded text-[10px] flex items-center gap-1 font-mono">
              <span className="text-neutral-500 font-semibold">Ganho:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {formatarMoedaBRL(valorTotalGanho)}
              </span>
            </div>

            <div className="px-2 py-0.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded text-[10px] flex items-center gap-1 font-mono">
              <span className="text-neutral-500 font-semibold">Aberto:</span>
              <span className="font-bold text-orange-600 dark:text-orange-400">
                {formatarMoedaBRL(valorTotalAberto)}
              </span>
            </div>

            <button
              onClick={() => setModalNovoCard(true)}
              className="px-2.5 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded text-[11px] font-semibold shadow-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Novo</span>
            </button>
          </div>
        </div>

        {/* Linha 2: Horários da Agenda (Chips em 1 clique) */}
        {horariosAgendaFiltro.length > 0 && (
          <div className="pt-1.5 border-t border-neutral-200/70 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 mr-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-orange-500" />
                Horários:
              </span>
              <button
                type="button"
                onClick={() => setHorarioFiltro('todos')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                  horarioFiltro === 'todos'
                    ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                    : 'bg-neutral-50 dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:border-orange-400'
                }`}
              >
                Todos ({cardsBaseEventoBusca.filter(c => {
                  if (dataFiltro === 'todas') return true;
                  const ag = c.id_agendamento_origem ? agendamentosById.get(c.id_agendamento_origem) : undefined;
                  return ag?.data_agendamento === dataFiltro;
                }).length})
              </button>
              {horariosAgendaFiltro.map((slot) => {
                const isSelected = horarioFiltro === slot.hora_inicio;
                return (
                  <button
                    key={slot.hora_inicio}
                    type="button"
                    onClick={() => setHorarioFiltro(isSelected ? 'todos' : slot.hora_inicio)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors flex items-center gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                        : slot.count > 0
                          ? 'bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700 hover:border-orange-400'
                          : 'bg-neutral-50/50 dark:bg-neutral-950/40 text-neutral-400 dark:text-neutral-500 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400'
                    }`}
                  >
                    <span>{slot.hora_inicio}</span>
                    <span className={`px-1 rounded text-[9px] ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                    }`}>
                      {slot.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {temFiltroAtivo && (
              <button
                type="button"
                onClick={handleLimparFiltros}
                className="px-2 py-0.5 rounded text-[10px] font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Limpar filtros</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 6 Colunas do Kanban com altura responsiva preenchendo até o final da tela */}
      <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 min-w-[980px] xl:min-w-0 w-full">
          {COLUNAS_CRM.map((coluna) => {
            const cardsDaColuna = cardsFiltrados
              .filter(c => isCardInColumn(c, coluna.id))
              .sort((a, b) => {
                const agA = a.id_agendamento_origem ? agendamentosById.get(a.id_agendamento_origem) : undefined;
                const agB = b.id_agendamento_origem ? agendamentosById.get(b.id_agendamento_origem) : undefined;
                if (agA && agB) {
                  return `${agA.data_agendamento} ${agA.hora_inicio}`.localeCompare(`${agB.data_agendamento} ${agB.hora_inicio}`);
                }
                if (agA) return -1;
                if (agB) return 1;
                return (a.ordem_coluna || 0) - (b.ordem_coluna || 0);
              });
            const totalValorColuna = cardsDaColuna.reduce(
              (acc, c) => acc + (c.valor_fechado || c.valor_estimado || 0),
              0
            );

            return (
              <div
                key={coluna.id}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(coluna.id)}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-2.5 flex flex-col h-[calc(100vh-215px)] min-h-[500px] shadow-sm transition-colors"
              >
                {/* Header da Coluna */}
                <div className={`pb-2 mb-2 border-b-2 ${coluna.cor} flex items-center justify-between`}>
                  <div className="min-w-0 pr-1">
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-white tracking-tight truncate" title={coluna.label}>
                      {coluna.label}
                    </h3>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5 truncate">
                      {formatarMoedaBRL(totalValorColuna)}
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-950 px-2 py-0.5 rounded-full tabular-nums shrink-0">
                    {cardsDaColuna.length}
                  </span>
                </div>

                {/* Lista de Cards */}
                <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                  {cardsDaColuna.length === 0 ? (
                    <div className="h-28 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg flex items-center justify-center text-[11px] text-neutral-400 text-center p-2">
                      Arraste cards para cá
                    </div>
                  ) : (
                    cardsDaColuna.map((card) => {
                      const { lead, agendamento, evento } = getCardContext(card);
                      const resp = usuariosById.get(card.responsavel_id);
                      const subStatus = getCardSubStatus(card);
                      const isFollowUpCol = coluna.id === 'FOLLOW_UP_STAND_BY';
                      const isCardExpanded = Boolean(expandedCardIds[card.id_oportunidade]);
                      const agStatusInfo = agendamento ? formatStatusAgendamentoLabel(agendamento.status) : null;

                      // Cor amarela (Follow-up) / cinza (Stand By) aplicada somente na coluna correspondente
                      let cardStyle = 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100';

                      if (isFollowUpCol) {
                        if (subStatus === 'FOLLOW') {
                          cardStyle = 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/80 text-amber-950 dark:text-amber-100 shadow-amber-500/5 hover:border-amber-400 dark:hover:border-amber-600';
                        } else {
                          cardStyle = 'bg-neutral-100 dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 shadow-neutral-500/5 hover:border-neutral-400 dark:hover:border-neutral-600';
                        }
                      }

                      return (
                        <div
                          key={card.id_oportunidade}
                          draggable
                          onDragStart={() => handleDragStart(card.id_oportunidade)}
                          onClick={() => setCardEmEdicao(card)}
                          className={`p-2.5 border rounded-lg cursor-grab active:cursor-grabbing shadow-xs hover:shadow-md transition-all space-y-1.5 select-none ${cardStyle}`}
                        >
                          {/* Título e ID */}
                          <div className="flex items-start justify-between gap-1.5">
                            <h4 className="text-xs font-semibold line-clamp-2 leading-tight">
                              {card.titulo}
                            </h4>
                            <span className="text-[9px] opacity-60 font-mono shrink-0">
                              {card.id_oportunidade}
                            </span>
                          </div>

                          {/* Lead & Local */}
                          {lead && (
                            <p className="text-[11px] font-medium truncate text-orange-600 dark:text-orange-400">
                              {lead.nome} {(lead.local || lead.empresa) ? `· ${lead.local || lead.empresa}` : ''}
                            </p>
                          )}

                          {/* Evento + Seta de Expandir / Recolher informações */}
                          <div className="flex items-center justify-between gap-1.5 pt-0.5">
                            <p className="text-[10px] font-medium text-neutral-600 dark:text-neutral-400 truncate flex-1">
                              {evento ? `Evento: ${evento.nome}` : 'Detalhes do agendamento'}
                            </p>
                            <button
                              type="button"
                              onClick={(e) => toggleExpandCard(card.id_oportunidade, e)}
                              aria-label={isCardExpanded ? 'Recolher informações' : 'Expandir informações'}
                              title={isCardExpanded ? 'Recolher informações' : 'Expandir informações'}
                              className="p-0.5 rounded hover:bg-neutral-200/80 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors shrink-0 cursor-pointer"
                            >
                              {isCardExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {/* Bloco Expansível: Data/Hora do Agendamento, Produto, Valor e Responsável */}
                          {isCardExpanded && (
                            <div className="space-y-1.5 pt-1">
                              {agendamento ? (
                                <div className="p-1.5 rounded-md bg-white/80 dark:bg-neutral-900/90 border border-neutral-200/90 dark:border-neutral-800 space-y-1">
                                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                                    <span className="flex items-center gap-1 truncate">
                                      <Calendar className="w-3 h-3 text-orange-500 shrink-0" />
                                      <span>{formatarDataBR(agendamento.data_agendamento)}</span>
                                    </span>
                                    <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 shrink-0">
                                      <Clock className="w-3 h-3 shrink-0" />
                                      <span>
                                        {agendamento.hora_inicio}
                                        {agendamento.hora_fim && agendamento.hora_fim !== agendamento.hora_inicio
                                          ? `–${agendamento.hora_fim}`
                                          : ''}
                                      </span>
                                    </span>
                                  </div>
                                  {agStatusInfo && (
                                    <div className="flex items-center justify-between gap-1">
                                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${agStatusInfo.cls}`}>
                                        {agStatusInfo.label}
                                      </span>
                                      <span className="text-[9px] font-mono opacity-60 truncate">
                                        {agendamento.protocolo}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                card.data_proximo_followup && (
                                  <div className="flex items-center gap-1 text-[10px] opacity-70 font-mono">
                                    <Clock className="w-3 h-3 shrink-0" />
                                    <span className="truncate">Prev: {formatarDataBR(card.data_proximo_followup)}</span>
                                  </div>
                                )
                              )}

                              {card.produto_nome && (
                                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                                  Produto: {card.produto_nome}
                                  {card.produto_parcelas && card.produto_parcelas > 1 && card.produto_valor_mensal
                                    ? ` · ${card.produto_parcelas}x ${formatarMoedaBRL(card.produto_valor_mensal)}`
                                    : ''}
                                </p>
                              )}

                              {/* Valor e Responsável */}
                              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-current/10 opacity-90">
                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                  {formatarMoedaBRL(card.valor_fechado || card.valor_estimado)}
                                </span>

                                <span className="text-[10px] opacity-70 truncate max-w-[70px]">
                                  {resp?.nome ? resp.nome.split(' ')[0] : 'Admin'}
                                </span>
                              </div>

                              {/* Data de Follow-up separada apenas se diferente do dia agendado */}
                              {agendamento && card.data_proximo_followup && card.data_proximo_followup !== agendamento.data_agendamento && (
                                <div className="flex items-center gap-1 text-[10px] opacity-70 font-mono">
                                  <Clock className="w-3 h-3 shrink-0" />
                                  <span className="truncate">Follow-up: {formatarDataBR(card.data_proximo_followup)}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Botão de Alternância Follow / Stand By apenas na coluna correspondente */}
                          {isFollowUpCol && (
                            <div className="pt-1 border-t border-current/10 flex items-center justify-between gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleFollowStand(card.id_oportunidade);
                                }}
                                title={`Status: ${subStatus === 'FOLLOW' ? 'Follow-up (Amarelo)' : 'Stand By (Cinza)'}. Clique para alternar.`}
                                className={`w-full py-1 px-2 rounded text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                                  subStatus === 'FOLLOW'
                                    ? 'bg-amber-200 hover:bg-amber-300 text-amber-950 dark:bg-amber-900/80 dark:hover:bg-amber-800 dark:text-amber-100 border border-amber-300 dark:border-amber-700'
                                    : 'bg-neutral-200 hover:bg-neutral-300 text-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-600'
                                }`}
                              >
                                {subStatus === 'FOLLOW' ? (
                                  <>
                                    <Zap className="w-3 h-3 text-amber-600 dark:text-amber-300 fill-amber-500/20" />
                                    <span>Follow-up</span>
                                    <ArrowRightLeft className="w-2.5 h-2.5 opacity-50 ml-0.5" />
                                  </>
                                ) : (
                                  <>
                                    <PauseCircle className="w-3 h-3 text-neutral-500 dark:text-neutral-400" />
                                    <span>Stand By</span>
                                    <ArrowRightLeft className="w-2.5 h-2.5 opacity-50 ml-0.5" />
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal 1: Criar Oportunidade Manualmente */}
      {modalNovoCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl text-neutral-900 dark:text-neutral-100">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-sm font-bold">Criar Nova Oportunidade no CRM</h3>
              <button onClick={() => setModalNovoCard(false)} className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCriarCardManual} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">Título da Oportunidade *</label>
                <input
                  type="text"
                  required
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  placeholder="Ex: Proposta de Consultoria Trimestral"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">Lead Vinculado *</label>
                <select
                  value={novoLeadId}
                  onChange={(e) => setNovoLeadId(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white"
                >
                  {db.leads.filter(l => !l.excluido).map(l => (
                    <option key={l.id_lead} value={l.id_lead}>
                      {l.nome} ({l.local || l.empresa || 'Sem local'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">Produto do Evento (Opcional — preenche valor automaticamente)</label>
                <select
                  value=""
                  onChange={(e) => {
                    const ev = db.eventos.find(item => item.id_evento === e.target.value);
                    if (ev) {
                      setNovoProdutoNome(ev.produto_nome || ev.nome);
                      const vMensal = Number(ev.produto_valor_mensal) || 0;
                      const parc = Math.max(1, Number(ev.produto_parcelas) || 1);
                      const vTotal = Number(ev.produto_valor) || (vMensal * parc);
                      setNovoValorMensal(vMensal);
                      setNovoParcelas(parc);
                      if (vTotal > 0) {
                        setNovoValorEstimado(vTotal);
                      }
                    }
                  }}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white"
                >
                  <option value="">Selecionar produto de um evento...</option>
                  {db.eventos.map(ev => (
                    <option key={ev.id_evento} value={ev.id_evento}>
                      {ev.produto_nome || ev.nome}{' '}
                      {ev.produto_valor
                        ? ev.produto_parcelas && ev.produto_parcelas > 1 && ev.produto_valor_mensal
                          ? `(${ev.produto_parcelas}x ${formatarMoedaBRL(ev.produto_valor_mensal)} = ${formatarMoedaBRL(ev.produto_valor)})`
                          : `(${formatarMoedaBRL(ev.produto_valor)})`
                        : ''}
                    </option>
                  ))}
                </select>
                {novoProdutoNome && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                    Produto selecionado: <strong>{novoProdutoNome}</strong>
                    {novoParcelas > 1 && novoValorMensal > 0
                      ? ` · ${novoParcelas}x de ${formatarMoedaBRL(novoValorMensal)}`
                      : ''}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">Valor Estimado (R$)</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={novoValorEstimado}
                    onChange={(e) => setNovoValorEstimado(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">Responsável</label>
                  <select
                    value={novoResponsavel}
                    onChange={(e) => setNovoResponsavel(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white"
                  >
                    {db.usuarios.map(u => (
                      <option key={u.id_usuario} value={u.id_usuario}>
                        {u.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setModalNovoCard(false)}
                  className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-lg"
                >
                  Criar na Entrada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Confirmação de Perda Obrigatória */}
      {modalPerda && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 border border-rose-200 dark:border-rose-900/60 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl text-neutral-900 dark:text-neutral-100">
            <div className="flex items-center gap-2 text-rose-500">
              <AlertOctagon className="w-5 h-5" />
              <h3 className="text-sm font-bold">Registrar Motivo da Perda</h3>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Para preservar a rastreabilidade do CRM, informe por que esta oportunidade não avançou.
            </p>

            <textarea
              rows={3}
              required
              value={motivoPerdaInput}
              onChange={(e) => setMotivoPerdaInput(e.target.value)}
              placeholder="Ex: Preço fora do orçamento, optou pelo concorrente ou sem timing no momento."
              className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-rose-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setModalPerda(null)}
                className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarPerda}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg text-xs"
              >
                Confirmar Perda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Confirmação de Ganho */}
      {modalGanho && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl text-neutral-900 dark:text-neutral-100">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-5 h-5" />
              <h3 className="text-sm font-bold">Parabéns pela Venda Conquistada!</h3>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Confirme o valor final fechado para contabilização nos relatórios e Dashboard.
            </p>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Valor Fechado (R$)
              </label>
              <input
                type="number"
                min={0}
                step={50}
                value={valorFechadoInput}
                onChange={(e) => setValorFechadoInput(Number(e.target.value))}
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setModalGanho(null)}
                className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarGanho}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs"
              >
                Confirmar Venda Conquistada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Detalhes, Controle do Agendamento, Anotações e Histórico */}
      {cardEmEdicao && (() => {
        const modalCtx = getCardContext(cardEmEdicao);
        const modalAgd = modalCtx.agendamento;
        const modalLead = modalCtx.lead;
        const modalEvt = modalCtx.evento;
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-neutral-900 dark:text-neutral-100 transition-colors">
            {/* Header */}
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold">{cardEmEdicao.titulo}</h3>
                <p className="text-xs text-neutral-400 font-mono">
                  ID: {cardEmEdicao.id_oportunidade} · Estágio: {cardEmEdicao.estagio}
                  {modalEvt ? ` · Evento: ${modalEvt.nome}` : ''}
                </p>
              </div>
              <button
                onClick={() => setCardEmEdicao(null)}
                className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 flex-1 overflow-y-auto">
              {/* Controle de Data, Hora e Status do Agendamento */}
              {modalAgd && (
                <div className="p-4 bg-orange-50/70 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-bold text-neutral-900 dark:text-white font-mono">
                        <Calendar className="w-4 h-4 text-orange-500" />
                        {formatarDataBR(modalAgd.data_agendamento)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-bold text-orange-600 dark:text-orange-400 font-mono">
                        <Clock className="w-4 h-4" />
                        {modalAgd.hora_inicio}{modalAgd.hora_fim && modalAgd.hora_fim !== modalAgd.hora_inicio ? ` às ${modalAgd.hora_fim}` : ''}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                        {modalAgd.protocolo}
                      </span>
                    </div>

                    {modalLead && (
                      <span className="text-[11px] text-neutral-600 dark:text-neutral-300 font-medium">
                        {modalLead.whatsapp ? formatarTelefoneBR(modalLead.whatsapp) : ''}
                        {(modalLead.local || modalLead.empresa) ? ` · ${modalLead.local || modalLead.empresa}` : ''}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-orange-200/70 dark:border-orange-900/40">
                    <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                      Status do Atendimento:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(['CONFIRMADO', 'REALIZADO', 'NO_SHOW', 'CANCELADO'] as StatusAgendamento[]).map((st) => {
                        const ativo = modalAgd.status === st;
                        const labelMap: Record<StatusAgendamento, string> = {
                          CONFIRMADO: 'Confirmado',
                          REALIZADO: 'Realizado',
                          NO_SHOW: 'Não compareceu',
                          CANCELADO: 'Cancelado'
                        };
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleAlterarStatusAgendamento(modalAgd.id_agendamento, st)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                              ativo
                                ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                                : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-orange-400'
                            }`}
                          >
                            {labelMap[st]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Botão de Toggle Follow / Stand dentro do Modal (apenas para coluna Follow-up / Stand By) */}
              {isCardInColumn(cardEmEdicao, 'FOLLOW_UP_STAND_BY') && (
              <div className="p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Modo da Oportunidade:</span>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Defina se o card está ativo em Follow-up (Amarelo) ou pausado em Stand By (Cinza)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFollowStand(cardEmEdicao.id_oportunidade)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                    getCardSubStatus(cardEmEdicao) === 'FOLLOW'
                      ? 'bg-amber-200 hover:bg-amber-300 text-amber-950 dark:bg-amber-900 dark:hover:bg-amber-800 dark:text-amber-100 border border-amber-300 dark:border-amber-700'
                      : 'bg-neutral-200 hover:bg-neutral-300 text-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-600'
                  }`}
                >
                  {getCardSubStatus(cardEmEdicao) === 'FOLLOW' ? (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300 fill-amber-500/20" />
                      <span>Follow-up (Amarelo)</span>
                      <ArrowRightLeft className="w-3 h-3 opacity-60 ml-1" />
                    </>
                  ) : (
                    <>
                      <PauseCircle className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                      <span>Stand By (Cinza)</span>
                      <ArrowRightLeft className="w-3 h-3 opacity-60 ml-1" />
                    </>
                  )}
                </button>
              </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs">
                <div>
                  <span className="text-neutral-500 dark:text-neutral-400">Valor Estimado:</span>
                  <p className="font-mono text-base font-bold text-neutral-900 dark:text-white mt-0.5">
                    {formatarMoedaBRL(cardEmEdicao.valor_estimado)}
                  </p>
                  {cardEmEdicao.produto_nome && (
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {cardEmEdicao.produto_nome}
                      {cardEmEdicao.produto_parcelas && cardEmEdicao.produto_parcelas > 1 && cardEmEdicao.produto_valor_mensal
                        ? ` (${cardEmEdicao.produto_parcelas}x ${formatarMoedaBRL(cardEmEdicao.produto_valor_mensal)})`
                        : ''}
                    </p>
                  )}
                </div>
                <div>
                  <span className="text-neutral-500 dark:text-neutral-400">Valor Fechado:</span>
                  <p className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatarMoedaBRL(cardEmEdicao.valor_fechado)}
                  </p>
                </div>
                <div>
                  <span className="text-neutral-500 dark:text-neutral-400">Follow-up:</span>
                  <p className="font-mono text-neutral-800 dark:text-neutral-200 mt-0.5">
                    {formatarDataBR(cardEmEdicao.data_proximo_followup)}
                  </p>
                </div>
              </div>

              {/* Registro de Nova Interação */}
              <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Registrar Nova Interação Comercial
                </h4>
                <form onSubmit={handleAddAnotacao} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTipoNota('NOTA')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                        tipoNota === 'NOTA'
                          ? 'bg-orange-600 text-white'
                          : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-400'
                      }`}
                    >
                      Anotação
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoNota('LIGACAO')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                        tipoNota === 'LIGACAO'
                          ? 'bg-orange-600 text-white'
                          : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-400'
                      }`}
                    >
                      Ligação
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoNota('REUNIAO')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                        tipoNota === 'REUNIAO'
                          ? 'bg-orange-600 text-white'
                          : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-400'
                      }`}
                    >
                      Reunião Realizada
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoNota('PROPOSTA')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                        tipoNota === 'PROPOSTA'
                          ? 'bg-orange-600 text-white'
                          : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-400'
                      }`}
                    >
                      Proposta Enviada
                    </button>
                  </div>

                  <textarea
                    rows={2}
                    required
                    value={novaNota}
                    onChange={(e) => setNovaNota(e.target.value)}
                    placeholder="Descreva o que foi conversado ou acordado..."
                    className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                  />

                  <div className="text-right">
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg"
                    >
                      Registrar no Histórico
                    </button>
                  </div>
                </form>
              </div>

              {/* Linha do Tempo */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Trilha de Auditoria e Histórico ({historicoDoCard.length})
                </h4>

                <div className="space-y-2">
                  {historicoDoCard.map((item) => (
                    <div
                      key={item.id_historico}
                      className="p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                        <span className="font-mono text-orange-600 dark:text-orange-400 font-semibold">{item.tipo}</span>
                        <span className="font-mono text-[10px]">{formatarDataHoraBR(item.criado_em)}</span>
                      </div>
                      <p className="text-neutral-800 dark:text-neutral-200">{item.descricao}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};
