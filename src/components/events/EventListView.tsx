import React, { useState } from 'react';
import { EventoEntity } from '../../types/database';
import { storage } from '../../services/storageService';
import { formatarDataBR, formatarMoedaBRL } from '../../utils/formatters';
import { EventModal } from './EventModal';
import {
  Calendar,
  Clock,
  Users,
  Copy,
  Edit,
  Trash2,
  QrCode,
  ExternalLink,
  Plus,
  Play,
  Pause,
  FileSpreadsheet,
  Tag,
  Repeat,
  MapPin
} from 'lucide-react';

interface EventListViewProps {
  onOpenPublicEvent: (slug: string) => void;
  onOpenQrCode: (evento: EventoEntity) => void;
  onOpenFormBuilder: (eventoId: string) => void;
  onOpenAvailability: (eventoId: string) => void;
}

export const EventListView: React.FC<EventListViewProps> = ({
  onOpenPublicEvent,
  onOpenQrCode,
  onOpenFormBuilder,
  onOpenAvailability
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventoEntity | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const db = storage.getDatabase();
  const eventos = db.eventos;

  const handleEdit = (ev: EventoEntity) => {
    setEditingEvent(ev);
    setModalOpen(true);
  };

  const handleDuplicate = (id: string) => {
    storage.duplicateEvento(id);
    setRefreshKey(k => k + 1);
  };

  const handleDeleteConfirm = (id: string) => {
    storage.deleteEvento(id);
    setConfirmDeleteId(null);
    setRefreshKey(k => k + 1);
  };

  const handleStatusChange = (ev: EventoEntity, newStatus: EventoEntity['status']) => {
    const updated: EventoEntity = { ...ev, status: newStatus, atualizado_em: new Date().toISOString() };
    const horarios = db.horarios.filter(h => h.id_evento === ev.id_evento);
    const campos = db.campos_formulario.filter(c => c.id_evento === ev.id_evento);
    storage.saveEvento(updated, horarios, campos);
    setRefreshKey(k => k + 1);
  };

  const getStatusBadge = (status: EventoEntity['status']) => {
    switch (status) {
      case 'PUBLICADO':
        return (
          <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Publicado (Aberto)
          </span>
        );
      case 'PAUSADO':
        return (
          <span className="text-amber-600 dark:text-amber-400 text-xs font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Pausado
          </span>
        );
      case 'ENCERRADO':
        return (
          <span className="text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Encerrado
          </span>
        );
      default:
        return (
          <span className="text-neutral-500 dark:text-neutral-400 text-xs font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
            Rascunho
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm transition-colors">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
            Eventos de Atendimento
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
            Cada evento possui sua própria página pública, agenda de horários e capacidade de vagas por horário com controle atômico contra overbooking.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingEvent(null);
            setModalOpen(true);
          }}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-orange-600/30 transition-all flex items-center gap-2 self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Novo Evento</span>
        </button>
      </div>

      {/* Lista de Eventos */}
      {eventos.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
          <Calendar className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Nenhum evento criado ainda</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 mb-4">
            Crie o primeiro evento para começar a gerar links públicos e captar agendamentos.
          </p>
          <button
            onClick={() => {
              setEditingEvent(null);
              setModalOpen(true);
            }}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-semibold"
          >
            Criar Primeiro Evento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {eventos.map((ev) => {
            const horariosDoEvento = db.horarios.filter(h => h.id_evento === ev.id_evento && h.ativo);
            const totalAgendamentos = db.agendamentos.filter(
              a => a.id_evento === ev.id_evento && a.status === 'CONFIRMADO'
            ).length;
            const camposCount = db.campos_formulario.filter(c => c.id_evento === ev.id_evento && c.ativo).length;

            return (
              <div
                key={ev.id_evento}
                className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:border-neutral-300 dark:hover:border-neutral-700 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-sm"
              >
                {/* Lado Esquerdo: Dados do Evento */}
                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight">
                      {ev.nome}
                    </h3>
                    <div className="flex items-center gap-2 text-xs">
                      {getStatusBadge(ev.status)}
                      <span className="text-neutral-300 dark:text-neutral-600">·</span>
                      <span className="font-mono text-neutral-500 dark:text-neutral-400">
                        {ev.id_evento}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 max-w-2xl">
                    {ev.descricao || 'Sem descrição cadastrada.'}
                  </p>

                  {/* Produto & Valor Atrelado + Local da Campanha */}
                  {(ev.produto_nome || (ev.produto_valor && ev.produto_valor > 0) || ev.solicitar_local) && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {(ev.produto_nome || (ev.produto_valor && ev.produto_valor > 0)) && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-medium">
                          <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{ev.produto_nome || 'Produto atrelado'}</span>
                          {ev.produto_valor && ev.produto_valor > 0 ? (
                            <strong className="font-mono ml-1">
                              {ev.produto_parcelas && ev.produto_parcelas > 1 && ev.produto_valor_mensal && ev.produto_valor_mensal > 0
                                ? `· ${ev.produto_parcelas}x de ${formatarMoedaBRL(ev.produto_valor_mensal)} (Total ${formatarMoedaBRL(ev.produto_valor)})`
                                : `· ${formatarMoedaBRL(ev.produto_valor)}`}
                            </strong>
                          ) : null}
                        </span>
                      )}
                      {ev.solicitar_local && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/60 text-orange-800 dark:text-orange-300 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                          <span>Local no formulário: {ev.label_local || 'Local / Campanha'}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Metadados */}
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-2 text-xs text-neutral-500 dark:text-neutral-400">
                    {ev.modo_datas === 'DATAS_ESPECIFICAS' ? (
                      <span className="flex items-center gap-1 text-neutral-700 dark:text-neutral-300">
                        <Calendar className="w-3.5 h-3.5 text-orange-500" />
                        {(ev.datas_especificas?.length || 0)} data(s) específica(s)
                      </span>
                    ) : ev.recorrencia_ativa || ev.modo_datas === 'RECORRENTE' ? (
                      <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                        <Repeat className="w-3.5 h-3.5" />
                        Recorrente ({(ev.dias_semana || []).join(', ')}) · Contínuo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-neutral-700 dark:text-neutral-300">
                        <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                        {formatarDataBR(ev.data_inicio)} até {formatarDataBR(ev.data_fim)} ({(ev.dias_semana || []).join(', ')})
                      </span>
                    )}
                    <span className="text-neutral-300 dark:text-neutral-700" aria-hidden="true">·</span>
                    <span className="flex items-center gap-1 text-neutral-700 dark:text-neutral-300">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      {ev.duracao_minutos} min por atendimento
                    </span>
                    <span className="text-neutral-300 dark:text-neutral-700" aria-hidden="true">·</span>
                    <span className="flex items-center gap-1 text-neutral-700 dark:text-neutral-300">
                      <Users className="w-3.5 h-3.5 text-neutral-400" />
                      <strong className="text-orange-600 dark:text-orange-400 font-mono tabular-nums">{ev.capacidade_padrao} vagas</strong> por horário
                    </span>
                    <span className="text-neutral-300 dark:text-neutral-700" aria-hidden="true">·</span>
                    <span className="font-mono text-neutral-500 dark:text-neutral-400">
                      {horariosDoEvento.length} horário{horariosDoEvento.length !== 1 ? 's' : ''} ativo{horariosDoEvento.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-neutral-300 dark:text-neutral-700" aria-hidden="true">·</span>
                    <span className="font-mono text-neutral-500 dark:text-neutral-400">
                      {totalAgendamentos} agendamento{totalAgendamentos !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Lado Direito: Ações */}
                <div className="flex flex-wrap items-center gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-neutral-100 dark:border-neutral-800">
                  {/* Status Toggle */}
                  {ev.status === 'PUBLICADO' ? (
                    <button
                      onClick={() => handleStatusChange(ev, 'PAUSADO')}
                      title="Pausar agendamentos"
                      className="p-2 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-amber-500 transition-colors"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatusChange(ev, 'PUBLICADO')}
                      title="Publicar e abrir agendamentos"
                      className="p-2 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-emerald-500 transition-colors"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}

                  {/* QR Code & Link */}
                  <button
                    onClick={() => onOpenQrCode(ev)}
                    title="Ver QR Code e Compartilhar Link"
                    className="px-3 py-2 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5 text-orange-500" />
                    <span className="hidden sm:inline">QR Code</span>
                  </button>

                  {/* Abrir Página Pública */}
                  <a
                    href={`/agendar/${ev.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir página pública independente em nova aba"
                    className="px-3 py-2 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                    <span className="hidden sm:inline">Página Pública</span>
                  </a>

                  {/* Disponibilidade */}
                  <button
                    onClick={() => onOpenAvailability(ev.id_evento)}
                    title="Gerenciar Vagas e Bloqueios"
                    className="p-2 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                  >
                    <Clock className="w-4 h-4" />
                  </button>

                  {/* Formulário Dinâmico */}
                  <button
                    onClick={() => onOpenFormBuilder(ev.id_evento)}
                    title={`Editar formulário de captação (${camposCount} campos)`}
                    className="p-2 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                  </button>

                  {/* Duplicar */}
                  <button
                    onClick={() => handleDuplicate(ev.id_evento)}
                    title="Duplicar Evento"
                    className="p-2 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  {/* Editar */}
                  <button
                    onClick={() => handleEdit(ev)}
                    title="Editar Evento"
                    className="p-2 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  {/* Excluir (Confirmação inline) */}
                  {confirmDeleteId === ev.id_evento ? (
                    <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-lg px-2 py-1 text-[11px]">
                      <span className="text-rose-700 dark:text-rose-300 font-semibold">Excluir?</span>
                      <button
                        onClick={() => handleDeleteConfirm(ev.id_evento)}
                        className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-semibold cursor-pointer"
                      >
                        Sim
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded cursor-pointer"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(ev.id_evento)}
                      title="Excluir Evento"
                      className="p-2 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-rose-500 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação / Edição */}
      {modalOpen && (
        <EventModal
          eventoParaEditar={editingEvent}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            setRefreshKey(k => k + 1);
          }}
        />
      )}
    </div>
  );
};
