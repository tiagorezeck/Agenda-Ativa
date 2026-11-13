import React, { useState, useMemo } from 'react';
import { storage } from '../../services/storageService';
import { CrmOportunidadeEntity, EstagioCrm, TipoHistoricoCrm } from '../../types/database';
import { formatarMoedaBRL, formatarDataBR, formatarDataHoraBR, gerarCodigoAleatorio } from '../../utils/formatters';
import {
  Plus,
  Search,
  DollarSign,
  Clock,
  X,
  AlertOctagon,
  Zap,
  PauseCircle,
  ArrowRightLeft
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

  const [busca, setBusca] = useState('');
  const [responsavelFiltro, setResponsavelFiltro] = useState('todos');
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);

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
  const [novoLeadId, setNovoLeadId] = useState(db.leads[0]?.id_lead || '');
  const [novoValorEstimado, setNovoValorEstimado] = useState(5000);
  const [novoResponsavel, setNovoResponsavel] = useState('USR-001');

  const [refreshKey, setRefreshKey] = useState(0);

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

  // Cards Filtrados
  const cardsFiltrados = useMemo(() => {
    return crmCards.filter((card) => {
      if (responsavelFiltro !== 'todos' && card.responsavel_id !== responsavelFiltro) return false;
      if (!busca.trim()) return true;

      const termo = busca.toLowerCase();
      const lead = db.leads.find(l => l.id_lead === card.id_lead);
      return (
        card.titulo.toLowerCase().includes(termo) ||
        (lead && lead.nome.toLowerCase().includes(termo))
      );
    });
  }, [crmCards, busca, responsavelFiltro, db.leads, refreshKey]);

  // Totalizador de Vendas Conquistadas
  const valorTotalGanho = useMemo(() => {
    return crmCards
      .filter(c => c.estagio === 'GANHO')
      .reduce((acc, c) => acc + (c.valor_fechado || c.valor_estimado || 0), 0);
  }, [crmCards, refreshKey]);

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

  return (
    <div className="space-y-6">
      {/* Top Banner & Ações */}
      <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm transition-colors">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
            CRM Kanban Comercial
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
            Todo agendamento gera automaticamente uma oportunidade na coluna <strong>Entrada</strong>. Arraste entre as 6 colunas para gerenciar o funil.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right px-3 py-1.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl">
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-semibold">Total Ganho:</span>
            <p className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatarMoedaBRL(valorTotalGanho)}
            </p>
          </div>

          <button
            onClick={() => setModalNovoCard(true)}
            className="px-3.5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-orange-600/30 flex items-center gap-1.5 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Oportunidade</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-wrap items-center justify-between gap-4 shadow-sm transition-colors">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar oportunidades ou nomes de leads..."
            className="w-full pl-9 pr-4 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Responsável:</span>
          <select
            value={responsavelFiltro}
            onChange={(e) => setResponsavelFiltro(e.target.value)}
            className="px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-800 dark:text-white focus:outline-none focus:border-orange-500"
          >
            <option value="todos">Todos os Responsáveis</option>
            {db.usuarios.map(u => (
              <option key={u.id_usuario} value={u.id_usuario}>
                {u.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 6 Colunas do Kanban ajustadas para caber na página (com rolagem se telas menores ou colunas adicionais) */}
      <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 min-w-[980px] xl:min-w-0 w-full">
          {COLUNAS_CRM.map((coluna) => {
            const cardsDaColuna = cardsFiltrados.filter(c => isCardInColumn(c, coluna.id));
            const totalValorColuna = cardsDaColuna.reduce(
              (acc, c) => acc + (c.valor_fechado || c.valor_estimado || 0),
              0
            );

            return (
              <div
                key={coluna.id}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(coluna.id)}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-2.5 flex flex-col min-h-[480px] max-h-[78vh] shadow-sm transition-colors"
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
                      const lead = db.leads.find(l => l.id_lead === card.id_lead);
                      const resp = db.usuarios.find(u => u.id_usuario === card.responsavel_id);
                      const subStatus = getCardSubStatus(card);
                      const isFollowUpCol = coluna.id === 'FOLLOW_UP_STAND_BY';

                      // Definição visual conforme instrução do usuário:
                      // "mudando o card de cor, follow fica amarelo e stand fica cinza"
                      let cardStyle = 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100';

                      if (isFollowUpCol || card.sub_status) {
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
                          className={`p-2.5 border rounded-lg cursor-grab active:cursor-grabbing shadow-xs hover:shadow-md transition-all space-y-2 select-none ${cardStyle}`}
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

                          {/* Lead */}
                          {lead && (
                            <p className="text-[11px] font-medium truncate text-orange-600 dark:text-orange-400">
                              {lead.nome} {lead.empresa ? `· ${lead.empresa}` : ''}
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

                          {/* Data de Follow-up */}
                          {card.data_proximo_followup && (
                            <div className="flex items-center gap-1 text-[10px] opacity-70 font-mono">
                              <Clock className="w-3 h-3 shrink-0" />
                              <span className="truncate">Prev: {formatarDataBR(card.data_proximo_followup)}</span>
                            </div>
                          )}

                          {/* Botão de Alternância Follow / Stand By (Destaque conforme solicitação do usuário) */}
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
                  {db.leads.map(l => (
                    <option key={l.id_lead} value={l.id_lead}>
                      {l.nome} ({l.empresa || 'Sem empresa'})
                    </option>
                  ))}
                </select>
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

      {/* Modal 4: Detalhes, Anotações e Histórico */}
      {cardEmEdicao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-neutral-900 dark:text-neutral-100 transition-colors">
            {/* Header */}
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold">{cardEmEdicao.titulo}</h3>
                <p className="text-xs text-neutral-400 font-mono">
                  ID: {cardEmEdicao.id_oportunidade} · Estágio: {cardEmEdicao.estagio}
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
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              {/* Botão de Toggle Follow / Stand dentro do Modal também */}
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs">
                <div>
                  <span className="text-neutral-500 dark:text-neutral-400">Valor Estimado:</span>
                  <p className="font-mono text-base font-bold text-neutral-900 dark:text-white mt-0.5">
                    {formatarMoedaBRL(cardEmEdicao.valor_estimado)}
                  </p>
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
      )}
    </div>
  );
};
