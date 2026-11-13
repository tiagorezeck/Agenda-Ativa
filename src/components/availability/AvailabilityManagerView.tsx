import React, { useState } from 'react';
import { storage } from '../../services/storageService';
import { formatarDataBR } from '../../utils/formatters';
import {
  Calendar,
  Clock,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  XCircle,
  UserX,
  ShieldAlert
} from 'lucide-react';

interface AvailabilityManagerProps {
  initialEventoId?: string;
}

export const AvailabilityManagerView: React.FC<AvailabilityManagerProps> = ({ initialEventoId }) => {
  const db = storage.getDatabase();
  const eventos = db.eventos;

  const [eventoSelecionado, setEventoSelecionado] = useState<string>(
    initialEventoId || (eventos[0]?.id_evento || '')
  );

  const hoje = new Date().toISOString().slice(0, 10);
  const [dataSelecionada, setDataSelecionada] = useState<string>(hoje);
  const [motivoBloqueio, setMotivoBloqueio] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const eventoAtual = eventos.find(e => e.id_evento === eventoSelecionado);
  const slots = eventoAtual ? storage.getDisponibilidade(eventoAtual.id_evento, dataSelecionada) : [];
  const agendamentosDoDia = eventoAtual
    ? db.agendamentos.filter(
        (a) => a.id_evento === eventoAtual.id_evento && a.data_agendamento === dataSelecionada
      )
    : [];

  const handleToggleBlock = (horaInicio: string) => {
    if (!eventoAtual) return;
    storage.toggleSlotBlock(
      eventoAtual.id_evento,
      dataSelecionada,
      horaInicio,
      motivoBloqueio || 'Bloqueio administrativo'
    );
    setMotivoBloqueio('');
    setRefreshKey(k => k + 1);
  };

  const handleUpdateBookingStatus = (
    idAgendamento: string,
    novoStatus: 'CONFIRMADO' | 'REALIZADO' | 'CANCELADO' | 'NO_SHOW'
  ) => {
    storage.updateAgendamentoStatus(idAgendamento, novoStatus);
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm transition-colors">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
            Controle de Disponibilidade & Capacidade
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
            Monitore o preenchimento de vagas em tempo real para cada horário e realize bloqueios administrativos pontuais.
          </p>
        </div>

        {/* Seletor de Evento */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">Evento:</label>
          <select
            value={eventoSelecionado}
            onChange={(e) => setEventoSelecionado(e.target.value)}
            className="px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-800 dark:text-white focus:outline-none focus:border-orange-500 font-medium"
          >
            {eventos.map(ev => (
              <option key={ev.id_evento} value={ev.id_evento}>
                {ev.nome} ({ev.id_evento})
              </option>
            ))}
          </select>
        </div>
      </div>

      {eventoAtual ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna 1: Seletor de Data & Parâmetros */}
          <div className="space-y-4">
            <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Selecionar Data</h3>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Data de Atendimento
                </label>
                <input
                  type="date"
                  value={dataSelecionada}
                  onChange={(e) => setDataSelecionada(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-2 text-xs text-neutral-500 dark:text-neutral-400">
                <div className="flex items-center justify-between">
                  <span>Período do Evento:</span>
                  <span className="font-mono text-neutral-800 dark:text-neutral-300">
                    {formatarDataBR(eventoAtual.data_inicio)} até {formatarDataBR(eventoAtual.data_fim)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Capacidade Base por Slot:</span>
                  <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                    {eventoAtual.capacidade_padrao} vagas
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Duração da Sessão:</span>
                  <span className="font-mono text-neutral-800 dark:text-neutral-300">
                    {eventoAtual.duracao_minutos} min
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Status:</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {eventoAtual.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Motivo Opcional para Bloqueio */}
            <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-3 shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Motivo do Bloqueio</h3>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Informe a razão ao bloquear um horário (ex: Reunião de Diretoria, Feriado ou Ausência).
              </p>
              <input
                type="text"
                value={motivoBloqueio}
                onChange={(e) => setMotivoBloqueio(e.target.value)}
                placeholder="Ex: Reunião interna da equipe"
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Coluna 2 & 3: Horários e Vagas em Tempo Real */}
          <div className="lg:col-span-2 space-y-4">
            <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-500" />
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    Horários para {formatarDataBR(dataSelecionada)}
                  </h3>
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                  {slots.length} horário{slots.length !== 1 ? 's' : ''} cadastrado{slots.length !== 1 ? 's' : ''}
                </span>
              </div>

              {slots.length === 0 ? (
                <div className="p-8 text-center bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                  <Calendar className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                  <p className="text-xs text-neutral-700 dark:text-neutral-300 font-medium">
                    Nenhum horário cadastrado para este dia da semana.
                  </p>
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
                    Verifique os dias aplicáveis configurados na edição do evento.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {slots.map((slot) => {
                    const esgotado = slot.vagas_restantes === 0 && !slot.bloqueado;
                    const percentual = Math.round(
                      (slot.agendamentos_confirmados / slot.capacidade_total) * 100
                    );

                    return (
                      <div
                        key={slot.hora_inicio}
                        className={`p-4 rounded-xl border transition-all ${
                          slot.bloqueado
                            ? 'bg-neutral-100 dark:bg-neutral-950/80 border-neutral-200 dark:border-neutral-800/80 opacity-70'
                            : esgotado
                            ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                            : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          {/* Horário & Status */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-3">
                              <span className="text-base font-bold font-mono text-neutral-900 dark:text-white">
                                {slot.hora_inicio} às {slot.hora_fim}
                              </span>

                              {slot.bloqueado ? (
                                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                                  <Lock className="w-3.5 h-3.5" />
                                  Bloqueado Administrativamente
                                </span>
                              ) : esgotado ? (
                                <span className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Vagas Esgotadas (5/5)
                                </span>
                              ) : (
                                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Disponível ({slot.vagas_restantes} vaga{slot.vagas_restantes !== 1 ? 's' : ''} livre{slot.vagas_restantes !== 1 ? 's' : ''})
                                </span>
                              )}
                            </div>

                            {slot.bloqueado && slot.motivo_bloqueio && (
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 italic">
                                Motivo: {slot.motivo_bloqueio}
                              </p>
                            )}

                            {/* Barra de Progresso */}
                            <div className="flex items-center gap-3 pt-2">
                              <div className="w-36 h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    slot.bloqueado
                                      ? 'bg-neutral-400 dark:bg-neutral-600'
                                      : esgotado
                                      ? 'bg-rose-500'
                                      : 'bg-orange-500'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(10, percentual))}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
                                {slot.agendamentos_confirmados} de {slot.capacidade_total} vagas ocupadas ({percentual}%)
                              </span>
                            </div>
                          </div>

                          {/* Botão de Bloqueio */}
                          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                            <button
                              onClick={() => handleToggleBlock(slot.hora_inicio)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                                slot.bloqueado
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hover:bg-amber-200'
                                  : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                              }`}
                            >
                              {slot.bloqueado ? (
                                <>
                                  <Unlock className="w-3.5 h-3.5" />
                                  <span>Desbloquear Horário</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3.5 h-3.5 text-neutral-400" />
                                  <span>Bloquear Horário</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Agendamentos Confirmados do Dia (Controle de Presença / Cancelamento) */}
            <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Agendamentos em {formatarDataBR(dataSelecionada)}
                </h3>
                <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                  {agendamentosDoDia.length} registro{agendamentosDoDia.length !== 1 ? 's' : ''}
                </span>
              </div>

              {agendamentosDoDia.length === 0 ? (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Nenhum agendamento registrado para esta data.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {agendamentosDoDia.map((agd) => {
                    const lead = db.leads.find((l) => l.id_lead === agd.id_lead);
                    return (
                      <div
                        key={agd.id_agendamento}
                        className="p-3.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                              {agd.hora_inicio}
                            </span>
                            <span className="font-semibold text-neutral-900 dark:text-white truncate">
                              {lead?.nome || agd.id_lead}
                            </span>
                            <span className="font-mono text-[10px] text-neutral-500">
                              {agd.protocolo}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            Status atual: <strong className="font-mono">{agd.status}</strong>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleUpdateBookingStatus(agd.id_agendamento, 'REALIZADO')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 border cursor-pointer transition-colors ${
                              agd.status === 'REALIZADO'
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:border-emerald-500'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Realizado</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateBookingStatus(agd.id_agendamento, 'NO_SHOW')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 border cursor-pointer transition-colors ${
                              agd.status === 'NO_SHOW'
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:border-amber-500'
                            }`}
                          >
                            <UserX className="w-3 h-3" />
                            <span>Faltou</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateBookingStatus(
                                agd.id_agendamento,
                                agd.status === 'CANCELADO' ? 'CONFIRMADO' : 'CANCELADO'
                              )
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 border cursor-pointer transition-colors ${
                              agd.status === 'CANCELADO'
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:border-rose-500'
                            }`}
                          >
                            <XCircle className="w-3 h-3" />
                            <span>{agd.status === 'CANCELADO' ? 'Reativar' : 'Cancelar'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Nenhum evento encontrado.</p>
        </div>
      )}
    </div>
  );
};
