import React, { useState, useMemo, useEffect } from 'react';
import { storage } from '../../services/storageService';
import { getLoggedInUser, podeAcessarTodoCrm } from '../../services/authService';
import { LeadEntity, StatusClienteLead, UsuarioEntity } from '../../types/database';
import {
  formatarDataBR,
  formatarDataHoraBR,
  formatarTelefoneBR,
  formatarMoedaBRL,
  aplicarMascaraTelefoneBR,
  isTelefoneBRValido,
  sanitizarEmailInput,
  isEmailValido
} from '../../utils/formatters';
import {
  Users,
  Search,
  Filter,
  Calendar,
  FileSpreadsheet,
  Edit,
  X,
  Phone,
  Mail,
  Building,
  Check,
  Trash2,
  RotateCcw,
  AlertTriangle,
  ShoppingBag,
  Award,
  Tag,
  UserCheck,
  MapPin
} from 'lucide-react';

export const LeadsView: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentUser, setCurrentUser] = useState<UsuarioEntity>(() => getLoggedInUser());
  const db = storage.getDatabase();

  useEffect(() => {
    const handleAuth = () => setCurrentUser(getLoggedInUser());
    window.addEventListener('auth_user_changed', handleAuth);
    return () => window.removeEventListener('auth_user_changed', handleAuth);
  }, []);

  const canAccessAll = podeAcessarTodoCrm(currentUser);

  const isLeadVisibleForUser = (l: LeadEntity) => {
    if (canAccessAll) return true;
    if (l.responsavel_id === currentUser.id_usuario) return true;
    const ev = db.eventos.find(e => e.id_evento === l.origem_primeiro_evento);
    return ev?.responsavel_id === currentUser.id_usuario;
  };

  const leadsAtivos = useMemo(
    () => db.leads.filter(l => !l.excluido && isLeadVisibleForUser(l)),
    [db.leads, db.eventos, refreshKey, canAccessAll, currentUser.id_usuario]
  );
  const leadsLixeira = useMemo(
    () =>
      db.leads
        .filter(l => l.excluido && isLeadVisibleForUser(l))
        .sort((a, b) => (b.excluido_em || '').localeCompare(a.excluido_em || '')),
    [db.leads, db.eventos, refreshKey, canAccessAll, currentUser.id_usuario]
  );

  const [abaAtiva, setAbaAtiva] = useState<'ATIVOS' | 'LIXEIRA'>('ATIVOS');
  const [busca, setBusca] = useState('');
  const [eventoFiltro, setEventoFiltro] = useState('todos');
  const [statusFiltro, setStatusFiltro] = useState<'todos' | StatusClienteLead>('todos');
  const [localFiltro, setLocalFiltro] = useState('todos');
  const [leadSelecionado, setLeadSelecionado] = useState<LeadEntity | null>(null);
  const [modalEdicaoOpen, setModalEdicaoOpen] = useState(false);

  // Confirmações inline e feedback (sem window.alert / confirm)
  const [confirmPurgeId, setConfirmPurgeId] = useState<string | null>(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [ultimoMovidoLixeira, setUltimoMovidoLixeira] = useState<LeadEntity | null>(null);

  // Estados de Edição do Lead
  const [editNome, setEditNome] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editEmpresa, setEditEmpresa] = useState('');
  const [editCargo, setEditCargo] = useState('');
  const [editLocal, setEditLocal] = useState('');
  const [editStatusCliente, setEditStatusCliente] = useState<StatusClienteLead>('LEAD');
  const [editObservacoes, setEditObservacoes] = useState('');
  const [editErro, setEditErro] = useState<string | null>(null);

  const getResumoFinanceiroLead = (lead: LeadEntity) => {
    const crmDoLead = db.crm.filter(c => c.id_lead === lead.id_lead);
    const comprasGanhas = crmDoLead.filter(c => c.estagio === 'GANHO');
    const totalInvestido = comprasGanhas.reduce(
      (acc, c) => acc + (Number(c.valor_fechado) || Number(c.valor_estimado) || 0),
      0
    );
    const oportunidadesAbertas = crmDoLead.filter(
      c => c.estagio !== 'GANHO' && c.estagio !== 'PERDIDO' && c.estagio !== 'CANCELADO'
    );
    const potencialAberto = oportunidadesAbertas.reduce(
      (acc, c) => acc + (Number(c.valor_estimado) || 0),
      0
    );

    const cardRef = oportunidadesAbertas[0] || comprasGanhas[0] || crmDoLead[0];
    const eventoOrigem = db.eventos.find(e => e.id_evento === lead.origem_primeiro_evento);
    const produtoNome = cardRef?.produto_nome || eventoOrigem?.produto_nome || eventoOrigem?.nome || '';
    const produtoValorMensal = cardRef?.produto_valor_mensal ?? eventoOrigem?.produto_valor_mensal ?? 0;
    const produtoParcelas = cardRef?.produto_parcelas ?? eventoOrigem?.produto_parcelas ?? 1;
    const produtoValorTotal = cardRef
      ? (Number(cardRef.valor_fechado) || Number(cardRef.valor_estimado) || 0)
      : (Number(eventoOrigem?.produto_valor) || 0);

    const isCliente = lead.status_cliente === 'CLIENTE' || comprasGanhas.length > 0;
    const statusComercial: StatusClienteLead = isCliente ? 'CLIENTE' : 'LEAD';

    return {
      crmDoLead,
      comprasGanhas,
      totalInvestido,
      oportunidadesAbertas,
      potencialAberto,
      produtoNome,
      produtoValorMensal,
      produtoParcelas,
      produtoValorTotal,
      statusComercial
    };
  };

  const baseLista = abaAtiva === 'ATIVOS' ? leadsAtivos : leadsLixeira;

  const locaisDisponiveis = useMemo(() => {
    const setLocais = new Set<string>();
    baseLista.forEach((l) => {
      if (l.local && l.local.trim()) {
        setLocais.add(l.local.trim());
      }
    });
    return Array.from(setLocais).sort((a, b) => a.localeCompare(b));
  }, [baseLista]);

  const leadsFiltrados = useMemo(() => {
    return baseLista.filter((lead) => {
      if (eventoFiltro !== 'todos' && lead.origem_primeiro_evento !== eventoFiltro) return false;
      if (localFiltro !== 'todos' && (lead.local || '').trim() !== localFiltro) return false;
      if (statusFiltro !== 'todos') {
        const resumo = getResumoFinanceiroLead(lead);
        if (resumo.statusComercial !== statusFiltro) return false;
      }
      if (!busca.trim()) return true;

      const termo = busca.toLowerCase();
      return (
        lead.nome.toLowerCase().includes(termo) ||
        lead.whatsapp.includes(termo) ||
        (lead.email && lead.email.toLowerCase().includes(termo)) ||
        (lead.empresa && lead.empresa.toLowerCase().includes(termo)) ||
        (lead.local && lead.local.toLowerCase().includes(termo))
      );
    });
  }, [baseLista, busca, eventoFiltro, localFiltro, statusFiltro, db.crm, db.eventos]);

  const handleMoveToTrash = (lead: LeadEntity) => {
    storage.moveLeadToTrash(lead.id_lead);
    setUltimoMovidoLixeira(lead);
    if (leadSelecionado?.id_lead === lead.id_lead) {
      setLeadSelecionado(null);
      setModalEdicaoOpen(false);
    }
    setRefreshKey(k => k + 1);
  };

  const handleRestoreLead = (idLead: string) => {
    storage.restoreLeadFromTrash(idLead);
    if (ultimoMovidoLixeira?.id_lead === idLead) {
      setUltimoMovidoLixeira(null);
    }
    setConfirmPurgeId(null);
    setRefreshKey(k => k + 1);
  };

  const handlePermanentDelete = (idLead: string) => {
    storage.permanentlyDeleteLead(idLead);
    setConfirmPurgeId(null);
    setRefreshKey(k => k + 1);
  };

  const handleEmptyTrash = () => {
    storage.emptyLeadsTrash();
    setConfirmEmptyTrash(false);
    setConfirmPurgeId(null);
    setUltimoMovidoLixeira(null);
    setRefreshKey(k => k + 1);
  };

  const handleOpenDetalhes = (lead: LeadEntity) => {
    const resumo = getResumoFinanceiroLead(lead);
    setLeadSelecionado(lead);
    setEditNome(lead.nome);
    setEditWhatsapp(aplicarMascaraTelefoneBR(lead.whatsapp));
    setEditEmail(lead.email);
    setEditEmpresa(lead.empresa || '');
    setEditCargo(lead.cargo || '');
    setEditLocal(lead.local || '');
    setEditStatusCliente(resumo.statusComercial);
    setEditObservacoes(lead.observacoes || '');
    setEditErro(null);
  };

  const handleToggleClientStatus = (lead: LeadEntity, novoStatus: StatusClienteLead) => {
    storage.updateLeadClientStatus(lead.id_lead, novoStatus);
    const updatedLead: LeadEntity = { ...lead, status_cliente: novoStatus, atualizado_em: new Date().toISOString() };
    setLeadSelecionado(updatedLead);
    setEditStatusCliente(novoStatus);
    setRefreshKey(k => k + 1);
  };

  const handleSalvarEdicao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadSelecionado) return;
    setEditErro(null);

    if (!isTelefoneBRValido(editWhatsapp)) {
      setEditErro('Informe um WhatsApp válido no padrão (XX) XXXXX-XXXX.');
      return;
    }

    if (editEmail.trim() && !isEmailValido(editEmail)) {
      setEditErro('Informe um e-mail válido contendo @ (ex: seuemail@exemplo.com).');
      return;
    }

    const leadAtualizado: LeadEntity = {
      ...leadSelecionado,
      nome: editNome.trim(),
      whatsapp: editWhatsapp.replace(/\D/g, ''),
      email: editEmail.trim().toLowerCase(),
      empresa: editEmpresa.trim(),
      cargo: editCargo.trim(),
      local: editLocal.trim() || undefined,
      status_cliente: editStatusCliente,
      observacoes: editObservacoes.trim(),
      atualizado_em: new Date().toISOString()
    };

    storage.updateLead(leadAtualizado);
    setLeadSelecionado(leadAtualizado);
    setModalEdicaoOpen(false);
    setRefreshKey(k => k + 1);
  };

  const agendamentosDoLead = useMemo(() => {
    if (!leadSelecionado) return [];
    return db.agendamentos.filter(a => a.id_lead === leadSelecionado.id_lead);
  }, [leadSelecionado, db.agendamentos]);

  const respostasDoLead = useMemo(() => {
    if (!leadSelecionado) return [];
    return db.respostas.filter(r => r.id_lead === leadSelecionado.id_lead);
  }, [leadSelecionado, db.respostas]);

  return (
    <div className="space-y-6">
      {/* Top Banner com Abas Ativos / Lixeira */}
      <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm transition-colors">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
            Base Centralizada de Leads
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
            Todos os clientes captados através das páginas públicas de agendamento, com desduplicação automática, histórico consolidado e lixeira segura.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setAbaAtiva('ATIVOS');
              setConfirmEmptyTrash(false);
              setConfirmPurgeId(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors cursor-pointer ${
              abaAtiva === 'ATIVOS'
                ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                : 'bg-neutral-50 dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:border-orange-500'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Leads Ativos</span>
            <span className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] ${
              abaAtiva === 'ATIVOS' ? 'bg-white/20 text-white' : 'bg-neutral-200 dark:bg-neutral-800'
            }`}>
              {leadsAtivos.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAbaAtiva('LIXEIRA');
              setUltimoMovidoLixeira(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors cursor-pointer ${
              abaAtiva === 'LIXEIRA'
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : 'bg-neutral-50 dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:border-rose-500'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Lixeira</span>
            <span className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] ${
              abaAtiva === 'LIXEIRA' ? 'bg-white/20 text-white' : 'bg-neutral-200 dark:bg-neutral-800'
            }`}>
              {leadsLixeira.length}
            </span>
          </button>
        </div>
      </div>

      {/* Feedback ao mover lead para Lixeira (com desfazer rápido) */}
      {ultimoMovidoLixeira && abaAtiva === 'ATIVOS' && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
            <Trash2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>{ultimoMovidoLixeira.nome}</strong> foi movido para a Lixeira.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleRestoreLead(ultimoMovidoLixeira.id_lead)}
              className="px-2.5 py-1 bg-white dark:bg-neutral-900 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 rounded-lg font-semibold flex items-center gap-1 hover:bg-amber-100 dark:hover:bg-neutral-800 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Desfazer</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAbaAtiva('LIXEIRA');
                setUltimoMovidoLixeira(null);
              }}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold cursor-pointer"
            >
              Abrir Lixeira
            </button>
            <button
              type="button"
              onClick={() => setUltimoMovidoLixeira(null)}
              className="p-1 text-amber-700 dark:text-amber-300 hover:opacity-75 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Alerta & Botão Limpar Lixeira */}
      {abaAtiva === 'LIXEIRA' && (
        <div className="p-4 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5 text-rose-900 dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Lixeira de Leads ({leadsLixeira.length})</p>
              <p className="text-[11px] opacity-80">
                Você pode restaurar leads para a base ativa ou apagá-los definitivamente (isso remove também agendamentos e cards vinculados a eles).
              </p>
            </div>
          </div>

          {leadsLixeira.length > 0 && (
            confirmEmptyTrash ? (
              <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 border border-rose-300 dark:border-rose-800 rounded-xl px-3 py-1.5 shrink-0">
                <span className="text-rose-700 dark:text-rose-300 font-semibold">
                  Apagar todos os {leadsLixeira.length}?
                </span>
                <button
                  type="button"
                  onClick={handleEmptyTrash}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Sim, Limpar Tudo
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmEmptyTrash(false)}
                  className="px-2.5 py-1 bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-lg font-medium cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmEmptyTrash(true)}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Lixeira (Apagar Tudo)</span>
              </button>
            )
          )}
        </div>
      )}

      {/* Barra de Busca e Filtros */}
      <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-wrap items-center justify-between gap-4 shadow-sm transition-colors">
        <div className="flex-1 min-w-[260px] relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={
              abaAtiva === 'ATIVOS'
                ? 'Buscar por nome, WhatsApp, e-mail, empresa ou local...'
                : 'Buscar na lixeira por nome, WhatsApp, e-mail, empresa ou local...'
            }
            className="w-full pl-9 pr-4 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-neutral-400" />
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value as any)}
            className="px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-800 dark:text-white focus:outline-none focus:border-orange-500"
          >
            <option value="todos">Status: Todos (Leads + Clientes)</option>
            <option value="LEAD">Somente Leads</option>
            <option value="CLIENTE">Somente Clientes (Compraram)</option>
          </select>

          <select
            value={localFiltro}
            onChange={(e) => setLocalFiltro(e.target.value)}
            className="px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-800 dark:text-white focus:outline-none focus:border-orange-500"
          >
            <option value="todos">Local: Todos os Locais</option>
            {locaisDisponiveis.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>

          <select
            value={eventoFiltro}
            onChange={(e) => setEventoFiltro(e.target.value)}
            className="px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-800 dark:text-white focus:outline-none focus:border-orange-500"
          >
            <option value="todos">Todos os Eventos de Origem</option>
            {db.eventos.map(ev => (
              <option key={ev.id_evento} value={ev.id_evento}>
                {ev.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela de Leads */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/60 text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Nome / Empresa</th>
                <th className="py-3 px-4">Contato</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Produto / Valor</th>
                <th className="py-3 px-4">Já Investido</th>
                <th className="py-3 px-4 text-center">Agend.</th>
                <th className="py-3 px-4">
                  {abaAtiva === 'ATIVOS' ? 'Última Interação' : 'Excluído em'}
                </th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {leadsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-neutral-400">
                    {abaAtiva === 'LIXEIRA'
                      ? 'A lixeira de leads está vazia.'
                      : 'Nenhum contato encontrado para os filtros aplicados.'}
                  </td>
                </tr>
              ) : (
                leadsFiltrados.map((lead) => {
                  const resumo = getResumoFinanceiroLead(lead);
                  return (
                  <tr
                    key={lead.id_lead}
                    className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-medium text-neutral-900 dark:text-white">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-neutral-900 dark:text-neutral-100">{lead.nome}</p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {lead.empresa || lead.id_lead}
                          {lead.cargo ? ` · ${lead.cargo}` : ''}
                        </p>
                        {lead.local && (
                          <p className="inline-flex items-center gap-1 text-[10px] font-medium text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/50 px-1.5 py-0.5 rounded mt-0.5">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span>{lead.local}</span>
                          </p>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <p className="font-mono text-neutral-800 dark:text-neutral-200">{formatarTelefoneBR(lead.whatsapp)}</p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate max-w-[180px]">
                          {lead.email || '-'}
                        </p>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {resumo.statusComercial === 'CLIENTE' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold text-[10px]">
                          <UserCheck className="w-3 h-3" />
                          <span>CLIENTE</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-semibold text-[10px]">
                          <span>LEAD</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {resumo.produtoValorTotal > 0 || resumo.produtoNome ? (
                        <div className="space-y-0.5">
                          <p className="text-neutral-800 dark:text-neutral-200 font-medium truncate max-w-[170px]" title={resumo.produtoNome}>
                            {resumo.produtoNome || 'Produto'}
                          </p>
                          <p className="font-mono font-bold text-neutral-900 dark:text-white text-[11px]">
                            {formatarMoedaBRL(resumo.potencialAberto > 0 ? resumo.potencialAberto : resumo.produtoValorTotal)}
                            {resumo.produtoParcelas > 1 && resumo.produtoValorMensal > 0 && (
                              <span className="text-[10px] font-normal text-neutral-500 dark:text-neutral-400 ml-1">
                                ({resumo.produtoParcelas}x {formatarMoedaBRL(resumo.produtoValorMensal)})
                              </span>
                            )}
                          </p>
                        </div>
                      ) : (
                        <span className="text-neutral-400">-</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {resumo.totalInvestido > 0 ? (
                        <div className="space-y-0.5">
                          <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatarMoedaBRL(resumo.totalInvestido)}
                          </p>
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                            {resumo.comprasGanhas.length} produto{resumo.comprasGanhas.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      ) : (
                        <span className="font-mono text-neutral-400">R$ 0,00</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono tabular-nums font-bold text-orange-600 dark:text-orange-400">
                      {lead.total_agendamentos}
                    </td>

                    <td className="py-3.5 px-4 text-neutral-500 dark:text-neutral-400">
                      {abaAtiva === 'ATIVOS'
                        ? formatarDataBR(lead.data_ultimo_agendamento)
                        : formatarDataHoraBR(lead.excluido_em)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {abaAtiva === 'ATIVOS' ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetalhes(lead)}
                            className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-950 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          >
                            Ver Cadastro
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveToTrash(lead)}
                            title="Enviar lead para a Lixeira"
                            className="p-1.5 bg-neutral-50 hover:bg-rose-50 dark:bg-neutral-950 dark:hover:bg-rose-950/60 border border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRestoreLead(lead.id_lead)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restaurar</span>
                          </button>

                          {confirmPurgeId === lead.id_lead ? (
                            <div className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 rounded-lg px-2 py-1 text-[11px]">
                              <span className="text-rose-700 dark:text-rose-300 font-semibold">Apagar?</span>
                              <button
                                type="button"
                                onClick={() => handlePermanentDelete(lead.id_lead)}
                                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-semibold cursor-pointer"
                              >
                                Sim
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmPurgeId(null)}
                                className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded cursor-pointer"
                              >
                                Não
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmPurgeId(lead.id_lead)}
                              title="Apagar definitivamente"
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Apagar</span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhes do Lead */}
      {leadSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-neutral-900 dark:text-neutral-100 transition-colors">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-500" />
                <h3 className="text-base font-semibold">
                  Cadastro Completo do Lead
                </h3>
              </div>
              <button
                onClick={() => setLeadSelecionado(null)}
                className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo */}
            {(() => {
              const resumoLead = getResumoFinanceiroLead(leadSelecionado);
              return (
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-bold text-neutral-900 dark:text-white">{leadSelecionado.nome}</h4>
                    {resumoLead.statusComercial === 'CLIENTE' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold text-[10px]">
                        <Award className="w-3 h-3" />
                        <span>CLIENTE</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-semibold text-[10px]">
                        <span>LEAD</span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-orange-500" />
                      {formatarTelefoneBR(leadSelecionado.whatsapp)}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-blue-500" />
                      {leadSelecionado.email || 'Sem e-mail'}
                    </span>
                    {leadSelecionado.empresa && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-neutral-400" />
                          {leadSelecionado.empresa} {leadSelecionado.cargo ? `(${leadSelecionado.cargo})` : ''}
                        </span>
                      </>
                    )}
                    {leadSelecionado.local && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/50 text-orange-800 dark:text-orange-300 font-medium">
                          <MapPin className="w-3 h-3 text-orange-500 shrink-0" />
                          <span>Local: {leadSelecionado.local}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleClientStatus(
                        leadSelecionado,
                        resumoLead.statusComercial === 'CLIENTE' ? 'LEAD' : 'CLIENTE'
                      )
                    }
                    className={`px-3 py-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      resumoLead.statusComercial === 'CLIENTE'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100'
                        : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>
                      {resumoLead.statusComercial === 'CLIENTE' ? 'Voltar para Lead' : 'Marcar como Cliente'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalEdicaoOpen(true)}
                    className="px-3 py-1.5 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-300 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                  {!leadSelecionado.excluido && (
                    <button
                      type="button"
                      onClick={() => handleMoveToTrash(leadSelecionado)}
                      className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Resumo Comercial & Financeiro do Lead */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl">
                  <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                    Total Já Investido
                  </span>
                  <p className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {formatarMoedaBRL(resumoLead.totalInvestido)}
                  </p>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                    {resumoLead.comprasGanhas.length} produto{resumoLead.comprasGanhas.length !== 1 ? 's' : ''} comprado{resumoLead.comprasGanhas.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                  <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Potencial / Produto
                  </span>
                  <p className="text-lg font-bold font-mono text-neutral-900 dark:text-white mt-0.5">
                    {formatarMoedaBRL(resumoLead.potencialAberto > 0 ? resumoLead.potencialAberto : resumoLead.produtoValorTotal)}
                  </p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate" title={resumoLead.produtoNome}>
                    {resumoLead.produtoNome || 'Sem produto atrelado'}
                    {resumoLead.produtoParcelas > 1 && resumoLead.produtoValorMensal > 0
                      ? ` (${resumoLead.produtoParcelas}x ${formatarMoedaBRL(resumoLead.produtoValorMensal)})`
                      : ''}
                  </p>
                </div>

                <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                  <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Status Comercial
                  </span>
                  <p className="text-lg font-bold text-neutral-900 dark:text-white mt-0.5">
                    {resumoLead.statusComercial === 'CLIENTE' ? 'Cliente Ativo' : 'Lead em Funil'}
                  </p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {resumoLead.oportunidadesAbertas.length} oportunidade(s) em aberto no CRM
                  </p>
                </div>
              </div>

              {/* Produtos Comprados & Histórico de Investimentos */}
              <div className="space-y-3">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-500" />
                  <span>Produtos Comprados &amp; Investimentos ({resumoLead.comprasGanhas.length})</span>
                </h5>

                {resumoLead.comprasGanhas.length === 0 ? (
                  <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl text-xs text-neutral-500 dark:text-neutral-400">
                    Nenhuma compra concluída ainda. Quando uma oportunidade deste lead for movida para <strong>4. Ganho</strong> no CRM Kanban, o status mudará automaticamente para <strong>Cliente</strong> e o produto aparecerá aqui.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {resumoLead.comprasGanhas.map((compra) => {
                      const valorPago = Number(compra.valor_fechado) || Number(compra.valor_estimado) || 0;
                      return (
                        <div
                          key={compra.id_oportunidade}
                          className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-neutral-900 dark:text-white truncate">
                              {compra.produto_nome || compra.titulo}
                            </p>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                              {compra.id_oportunidade}
                              {compra.data_fechamento ? ` · Fechado em ${formatarDataBR(compra.data_fechamento)}` : ''}
                              {compra.produto_parcelas && compra.produto_parcelas > 1 && compra.produto_valor_mensal
                                ? ` · ${compra.produto_parcelas}x de ${formatarMoedaBRL(compra.produto_valor_mensal)}`
                                : ''}
                            </p>
                          </div>
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm shrink-0">
                            {formatarMoedaBRL(valorPago)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Histórico de Agendamentos */}
              <div className="space-y-3">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  <span>Histórico de Agendamentos ({agendamentosDoLead.length})</span>
                </h5>

                {agendamentosDoLead.length === 0 ? (
                  <p className="text-xs text-neutral-400">Nenhum agendamento registrado.</p>
                ) : (
                  <div className="space-y-2">
                    {agendamentosDoLead.map((agd) => {
                      const ev = db.eventos.find(e => e.id_evento === agd.id_evento);
                      const crmOrigem = db.crm.find(c => c.id_agendamento_origem === agd.id_agendamento);
                      const valEvento = crmOrigem?.valor_estimado ?? ev?.produto_valor ?? 0;
                      const prodNomeEv = crmOrigem?.produto_nome || ev?.produto_nome;
                      const parcEv = crmOrigem?.produto_parcelas || ev?.produto_parcelas || 1;
                      const mensEv = crmOrigem?.produto_valor_mensal || ev?.produto_valor_mensal || 0;
                      return (
                        <div
                          key={agd.id_agendamento}
                          className="p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-neutral-900 dark:text-white">{ev?.nome || agd.id_evento}</p>
                            <p className="text-neutral-400 font-mono mt-0.5">
                              Protocolo: {agd.protocolo}
                            </p>
                            {(prodNomeEv || valEvento > 0) && (
                              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
                                <Tag className="w-3 h-3 shrink-0" />
                                <span>
                                  {prodNomeEv || 'Produto'}:{' '}
                                  <strong className="font-mono">{formatarMoedaBRL(valEvento)}</strong>
                                  {parcEv > 1 && mensEv > 0 ? ` (${parcEv}x de ${formatarMoedaBRL(mensEv)})` : ''}
                                </span>
                              </p>
                            )}
                          </div>
                          <div className="text-right space-y-1 shrink-0">
                            <p className="font-mono text-neutral-800 dark:text-neutral-200">
                              {formatarDataBR(agd.data_agendamento)} às {agd.hora_inicio}
                            </p>
                            <select
                              value={agd.status}
                              onChange={(e) => {
                                storage.updateAgendamentoStatus(agd.id_agendamento, e.target.value as any);
                                setRefreshKey((k) => k + 1);
                              }}
                              className="px-2 py-0.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded text-[10px] font-mono font-semibold text-neutral-800 dark:text-neutral-200"
                            >
                              <option value="CONFIRMADO">CONFIRMADO</option>
                              <option value="REALIZADO">REALIZADO</option>
                              <option value="NO_SHOW">NO_SHOW</option>
                              <option value="CANCELADO">CANCELADO</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Respostas do Formulário */}
              <div className="space-y-3">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-orange-500" />
                  <span>Respostas Submetidas nos Formulários</span>
                </h5>

                {respostasDoLead.length === 0 ? (
                  <p className="text-xs text-neutral-400">Nenhuma resposta adicional registrada.</p>
                ) : (
                  <div className="space-y-2">
                    {respostasDoLead.map((resp) => {
                      const campo = db.campos_formulario.find(c => c.id_campo === resp.id_campo);
                      return (
                        <div
                          key={resp.id_resposta}
                          className="p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs space-y-1"
                        >
                          <p className="text-neutral-500 dark:text-neutral-400 font-medium">
                            {campo?.label || resp.id_campo}
                          </p>
                          <p className="text-neutral-900 dark:text-white font-semibold">
                            {resp.valor}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Observações */}
              {leadSelecionado.observacoes && (
                <div className="p-3 bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs space-y-1">
                  <p className="text-neutral-500 dark:text-neutral-400 font-semibold">Anotações Internas:</p>
                  <p className="text-neutral-800 dark:text-neutral-200">{leadSelecionado.observacoes}</p>
                </div>
              )}
            </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Sub-modal de Edição */}
      {modalEdicaoOpen && leadSelecionado && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl text-neutral-900 dark:text-neutral-100">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
              <h4 className="text-sm font-bold">Editar Dados do Lead</h4>
              <button
                onClick={() => setModalEdicaoOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarEdicao} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">WhatsApp *</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    maxLength={15}
                    pattern="\(\d{2}\)\s?\d{4,5}-\d{4}"
                    title="Informe o WhatsApp no padrão (XX) XXXXX-XXXX"
                    placeholder="(11) 99999-9999"
                    value={editWhatsapp}
                    onChange={(e) => setEditWhatsapp(aplicarMascaraTelefoneBR(e.target.value))}
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">E-mail</label>
                  <input
                    type="email"
                    inputMode="email"
                    pattern="[^@\s]+@[^@\s]+\.[^@\s]+"
                    title="Informe um e-mail válido contendo @"
                    placeholder="seuemail@exemplo.com"
                    value={editEmail}
                    onChange={(e) => setEditEmail(sanitizarEmailInput(e.target.value))}
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">Empresa</label>
                  <input
                    type="text"
                    value={editEmpresa}
                    onChange={(e) => setEditEmpresa(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">Cargo</label>
                  <input
                    type="text"
                    value={editCargo}
                    onChange={(e) => setEditCargo(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Local / Campanha (Escola, Bairro, Unidade)
                  </label>
                  <input
                    type="text"
                    value={editLocal}
                    onChange={(e) => setEditLocal(e.target.value)}
                    placeholder="Ex: Escola Estadual Centro, Bairro Jardins"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">Status Comercial</label>
                  <select
                    value={editStatusCliente}
                    onChange={(e) => setEditStatusCliente(e.target.value as StatusClienteLead)}
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white"
                  >
                    <option value="LEAD">Lead (Em Prospecção / Funil)</option>
                    <option value="CLIENTE">Cliente (Já Comprou)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">Observações Comerciais</label>
                <textarea
                  rows={2}
                  value={editObservacoes}
                  onChange={(e) => setEditObservacoes(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white"
                />
              </div>

              {editErro && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                  {editErro}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setModalEdicaoOpen(false)}
                  className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-lg flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvar Dados</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
