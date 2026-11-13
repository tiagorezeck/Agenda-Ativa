import React, { useState, useMemo } from 'react';
import { storage } from '../../services/storageService';
import { LeadEntity } from '../../types/database';
import { formatarDataBR, formatarDataHoraBR, formatarTelefoneBR } from '../../utils/formatters';
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
  Check
} from 'lucide-react';

export const LeadsView: React.FC = () => {
  const db = storage.getDatabase();
  const leads = db.leads;

  const [busca, setBusca] = useState('');
  const [eventoFiltro, setEventoFiltro] = useState('todos');
  const [leadSelecionado, setLeadSelecionado] = useState<LeadEntity | null>(null);
  const [modalEdicaoOpen, setModalEdicaoOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Estados de Edição do Lead
  const [editNome, setEditNome] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editEmpresa, setEditEmpresa] = useState('');
  const [editCargo, setEditCargo] = useState('');
  const [editObservacoes, setEditObservacoes] = useState('');

  const leadsFiltrados = useMemo(() => {
    return leads.filter((lead) => {
      if (eventoFiltro !== 'todos' && lead.origem_primeiro_evento !== eventoFiltro) return false;
      if (!busca.trim()) return true;

      const termo = busca.toLowerCase();
      return (
        lead.nome.toLowerCase().includes(termo) ||
        lead.whatsapp.includes(termo) ||
        (lead.email && lead.email.toLowerCase().includes(termo)) ||
        (lead.empresa && lead.empresa.toLowerCase().includes(termo))
      );
    });
  }, [leads, busca, eventoFiltro]);

  const handleOpenDetalhes = (lead: LeadEntity) => {
    setLeadSelecionado(lead);
    setEditNome(lead.nome);
    setEditWhatsapp(lead.whatsapp);
    setEditEmail(lead.email);
    setEditEmpresa(lead.empresa || '');
    setEditCargo(lead.cargo || '');
    setEditObservacoes(lead.observacoes || '');
  };

  const handleSalvarEdicao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadSelecionado) return;

    const leadAtualizado: LeadEntity = {
      ...leadSelecionado,
      nome: editNome.trim(),
      whatsapp: editWhatsapp.replace(/\D/g, ''),
      email: editEmail.trim().toLowerCase(),
      empresa: editEmpresa.trim(),
      cargo: editCargo.trim(),
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
      {/* Top Banner */}
      <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm transition-colors">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
            Base Centralizada de Leads
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
            Todos os clientes captados através das páginas públicas de agendamento, com desduplicação automática e histórico consolidado.
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Total de Contatos:</span>
          <p className="text-xl font-bold font-mono text-neutral-900 dark:text-white tabular-nums">
            {leads.length}
          </p>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-wrap items-center justify-between gap-4 shadow-sm transition-colors">
        <div className="flex-1 min-w-[260px] relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, WhatsApp, e-mail ou empresa..."
            className="w-full pl-9 pr-4 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-neutral-400" />
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
                <th className="py-3 px-4">Nome do Lead</th>
                <th className="py-3 px-4">WhatsApp</th>
                <th className="py-3 px-4">E-mail</th>
                <th className="py-3 px-4">Empresa / Cargo</th>
                <th className="py-3 px-4 text-center">Agendamentos</th>
                <th className="py-3 px-4">Última Interação</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {leadsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-400">
                    Nenhum contato encontrado para a busca especificada.
                  </td>
                </tr>
              ) : (
                leadsFiltrados.map((lead) => (
                  <tr
                    key={lead.id_lead}
                    className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-medium text-neutral-900 dark:text-white">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-neutral-900 dark:text-neutral-100">{lead.nome}</p>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {lead.id_lead}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-neutral-700 dark:text-neutral-300">
                      {formatarTelefoneBR(lead.whatsapp)}
                    </td>

                    <td className="py-3.5 px-4 text-neutral-500 dark:text-neutral-400">
                      {lead.email || '-'}
                    </td>

                    <td className="py-3.5 px-4 text-neutral-700 dark:text-neutral-300">
                      {lead.empresa || lead.cargo ? (
                        <div className="space-y-0.5">
                          <p className="text-neutral-900 dark:text-white">{lead.empresa || '-'}</p>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{lead.cargo || ''}</p>
                        </div>
                      ) : (
                        <span className="text-neutral-400">-</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono tabular-nums font-bold text-orange-600 dark:text-orange-400">
                      {lead.total_agendamentos}
                    </td>

                    <td className="py-3.5 px-4 text-neutral-500 dark:text-neutral-400">
                      {formatarDataBR(lead.data_ultimo_agendamento)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenDetalhes(lead)}
                        className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-950 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg text-xs font-medium transition-colors"
                      >
                        Ver Cadastro
                      </button>
                    </td>
                  </tr>
                ))
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
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-neutral-900 dark:text-white">{leadSelecionado.nome}</h4>
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
                  </div>
                </div>

                <button
                  onClick={() => setModalEdicaoOpen(true)}
                  className="px-3 py-1.5 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-300 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
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
                      return (
                        <div
                          key={agd.id_agendamento}
                          className="p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-semibold text-neutral-900 dark:text-white">{ev?.nome || agd.id_evento}</p>
                            <p className="text-neutral-400 font-mono mt-0.5">
                              Protocolo: {agd.protocolo}
                            </p>
                          </div>
                          <div className="text-right space-y-1">
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
                    type="text"
                    required
                    value={editWhatsapp}
                    onChange={(e) => setEditWhatsapp(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
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

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">Observações Comerciais</label>
                <textarea
                  rows={2}
                  value={editObservacoes}
                  onChange={(e) => setEditObservacoes(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white"
                />
              </div>

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
