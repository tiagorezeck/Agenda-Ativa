import React, { useState, useMemo } from 'react';
import { storage } from '../../services/storageService';
import { formatarDataBR, formatarMoedaBRL } from '../../utils/formatters';
import {
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  TrendingUp,
  Percent,
  Clock,
  Filter,
  BarChart3
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const db = storage.getDatabase();

  // Filtros
  const [periodo, setPeriodo] = useState<'todos' | 'hoje' | '7dias' | '30dias'>('todos');
  const [eventoFiltro, setEventoFiltro] = useState<string>('todos');
  const [responsavelFiltro, setResponsavelFiltro] = useState<string>('todos');
  const [statusFiltro, setStatusFiltro] = useState<string>('todos');

  // Filtragem dos Agendamentos
  const agendamentosFiltrados = useMemo(() => {
    const hojeStr = new Date().toISOString().slice(0, 10);
    const seteDiasAtras = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const trintaDiasAtras = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    return db.agendamentos.filter((agd) => {
      // Evento
      if (eventoFiltro !== 'todos' && agd.id_evento !== eventoFiltro) return false;
      // Status
      if (statusFiltro !== 'todos' && agd.status !== statusFiltro) return false;
      // Período
      if (periodo === 'hoje' && agd.data_agendamento !== hojeStr) return false;
      if (periodo === '7dias' && agd.data_agendamento < seteDiasAtras) return false;
      if (periodo === '30dias' && agd.data_agendamento < trintaDiasAtras) return false;

      return true;
    });
  }, [db.agendamentos, periodo, eventoFiltro, statusFiltro]);

  // Cálculos de Indicadores Oficiais
  const totalAgendamentos = agendamentosFiltrados.length;
  const totalLeads = db.leads.filter((l) => !l.excluido).length;

  const vagasPreenchidas = agendamentosFiltrados.filter(
    (a) => a.status === 'CONFIRMADO' || a.status === 'REALIZADO'
  ).length;

  // Capacidade total dos horários cadastrados
  const capacidadeTotalSlots = db.horarios.reduce((acc, h) => acc + (h.capacidade || 1), 0);
  const taxaOcupacao = capacidadeTotalSlots > 0
    ? Math.min(100, Math.round((vagasPreenchidas / capacidadeTotalSlots) * 100))
    : 0;

  const atendimentosRealizados = agendamentosFiltrados.filter((a) => a.status === 'REALIZADO').length;
  const cancelamentos = agendamentosFiltrados.filter((a) => a.status === 'CANCELADO').length;
  const noShows = agendamentosFiltrados.filter((a) => a.status === 'NO_SHOW').length;

  // Métricas do CRM
  const vendasConquistadas = db.crm
    .filter((c) => c.estagio === 'GANHO')
    .reduce((acc, c) => acc + (c.valor_fechado || c.valor_estimado || 0), 0);

  const totalOportunidadesCrm = db.crm.length;
  const totalGanhas = db.crm.filter((c) => c.estagio === 'GANHO').length;
  const taxaConversao = totalOportunidadesCrm > 0
    ? Math.round((totalGanhas / totalOportunidadesCrm) * 100)
    : 0;

  // Agrupamento por Dia
  const agendamentosPorDia = useMemo(() => {
    const map: Record<string, number> = {};
    agendamentosFiltrados.forEach((a) => {
      map[a.data_agendamento] = (map[a.data_agendamento] || 0) + 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [agendamentosFiltrados]);

  // Agrupamento por Horário
  const agendamentosPorHorario = useMemo(() => {
    const map: Record<string, number> = {};
    agendamentosFiltrados.forEach((a) => {
      map[a.hora_inicio] = (map[a.hora_inicio] || 0) + 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [agendamentosFiltrados]);

  // Agrupamento por Etapas do CRM (6 Etapas com Follow-up / Stand By consolidado)
  const crmPorEtapa = useMemo(() => {
    const etapas = [
      { id: 'ENTRADA', label: 'Entrada' },
      { id: 'REUNIAO', label: 'Reunião' },
      { id: 'FOLLOW_UP_STAND_BY', label: 'Follow-up / Stand By' },
      { id: 'GANHO', label: 'Ganho' },
      { id: 'PERDIDO', label: 'Perdido' },
      { id: 'CANCELADO', label: 'Cancelado' }
    ] as const;

    return etapas.map((etapa) => {
      const cards = db.crm.filter((c) => {
        if (etapa.id === 'FOLLOW_UP_STAND_BY') {
          return c.estagio === 'FOLLOW_UP_STAND_BY' || c.estagio === 'FOLLOW_UP' || c.estagio === 'STAND_BY';
        }
        return c.estagio === etapa.id;
      });
      const totalValor = cards.reduce((acc, c) => acc + (c.valor_fechado || c.valor_estimado || 0), 0);
      return {
        etapa: etapa.label,
        quantidade: cards.length,
        valor: totalValor
      };
    });
  }, [db.crm]);

  return (
    <div className="space-y-6">
      {/* Barra de Filtros */}
      <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-wrap items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
          <Filter className="w-4 h-4 text-orange-500" />
          <span>Filtros do Painel:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Período */}
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as any)}
            className="px-3 py-1.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-orange-500"
          >
            <option value="todos">Todo o Período</option>
            <option value="hoje">Hoje</option>
            <option value="7dias">Últimos 7 dias</option>
            <option value="30dias">Últimos 30 dias</option>
          </select>

          {/* Evento */}
          <select
            value={eventoFiltro}
            onChange={(e) => setEventoFiltro(e.target.value)}
            className="px-3 py-1.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-orange-500 max-w-[200px] truncate"
          >
            <option value="todos">Todos os Eventos</option>
            {db.eventos.map((ev) => (
              <option key={ev.id_evento} value={ev.id_evento}>
                {ev.nome}
              </option>
            ))}
          </select>

          {/* Status */}
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
            className="px-3 py-1.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-orange-500"
          >
            <option value="todos">Todos os Status</option>
            <option value="CONFIRMADO">Confirmado</option>
            <option value="REALIZADO">Realizado</option>
            <option value="CANCELADO">Cancelado</option>
            <option value="NO_SHOW">Não Compareceu</option>
          </select>

          {/* Responsável */}
          <select
            value={responsavelFiltro}
            onChange={(e) => setResponsavelFiltro(e.target.value)}
            className="px-3 py-1.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-orange-500"
          >
            <option value="todos">Todos os Responsáveis</option>
            {db.usuarios.map((u) => (
              <option key={u.id_usuario} value={u.id_usuario}>
                {u.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid com os 9 Indicadores Oficiais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
        {/* 1. Total Agendamentos */}
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-start justify-between shadow-sm transition-colors">
          <div>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Total de Agendamentos</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1 font-mono tabular-nums">
              {totalAgendamentos}
            </p>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">Registros na base</p>
          </div>
          <div className="p-2 rounded-lg bg-orange-50 dark:bg-neutral-800 text-orange-600 dark:text-orange-400">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* 2. Total Leads */}
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-start justify-between shadow-sm transition-colors">
          <div>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Leads Captados</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1 font-mono tabular-nums">
              {totalLeads}
            </p>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">Contatos desduplicados</p>
          </div>
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-neutral-800 text-blue-600 dark:text-blue-400">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* 3. Vagas Preenchidas */}
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-start justify-between shadow-sm transition-colors">
          <div>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Vagas Preenchidas</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1 font-mono tabular-nums">
              {vagasPreenchidas}
            </p>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
              De {capacidadeTotalSlots} vagas totais
            </p>
          </div>
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-neutral-800 text-amber-600 dark:text-amber-400">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        {/* 4. Taxa de Ocupação */}
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-start justify-between shadow-sm transition-colors">
          <div>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Taxa de Ocupação</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1 font-mono tabular-nums">
              {taxaOcupacao}%
            </p>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">Lotação dos horários</p>
          </div>
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400">
            <Percent className="w-5 h-5" />
          </div>
        </div>

        {/* 5. Atendimentos Realizados */}
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-start justify-between shadow-sm transition-colors">
          <div>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Atendimentos Realizados</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1 font-mono tabular-nums">
              {atendimentosRealizados}
            </p>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">Sessões concluídas</p>
          </div>
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        {/* 6. Cancelamentos */}
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-start justify-between shadow-sm transition-colors">
          <div>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Cancelamentos</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1 font-mono tabular-nums">
              {cancelamentos}
            </p>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">Vagas liberadas</p>
          </div>
          <div className="p-2 rounded-lg bg-rose-50 dark:bg-neutral-800 text-rose-600 dark:text-rose-400">
            <XCircle className="w-5 h-5" />
          </div>
        </div>

        {/* 7. Não comparecimentos (No-show) */}
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-start justify-between shadow-sm transition-colors">
          <div>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Não Comparecimentos</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1 font-mono tabular-nums">
              {noShows}
            </p>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">Ausências registradas</p>
          </div>
          <div className="p-2 rounded-lg bg-yellow-50 dark:bg-neutral-800 text-yellow-600 dark:text-yellow-400">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        {/* 8. Vendas Conquistadas */}
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-start justify-between shadow-sm transition-colors">
          <div>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Vendas Conquistadas</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono tabular-nums">
              {formatarMoedaBRL(vendasConquistadas)}
            </p>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">Etapa Ganho do CRM</p>
          </div>
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* 9. Taxa de Conversão */}
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-start justify-between shadow-sm transition-colors">
          <div>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Taxa de Conversão Comercial</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1 font-mono tabular-nums">
              {taxaConversao}%
            </p>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">Lead ➔ Venda fechada</p>
          </div>
          <div className="p-2 rounded-lg bg-orange-50 dark:bg-neutral-800 text-orange-600 dark:text-orange-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Gráficos e Distribuições Visuais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Agendamentos por Horário */}
        <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">
                Distribuição de Agendamentos por Horário
              </h3>
            </div>
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
              Capacidade por Slot: 5 vagas
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {agendamentosPorHorario.length === 0 ? (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 py-6 text-center">Nenhum agendamento para o filtro selecionado.</p>
            ) : (
              agendamentosPorHorario.map(([hora, total]) => {
                const perc = Math.min(100, Math.round((total / 5) * 100));
                return (
                  <div key={hora} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-medium text-neutral-800 dark:text-neutral-300">{hora}</span>
                      <span className="font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
                        {total} agendamento{total !== 1 ? 's' : ''} ({perc}% ocupado)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all rounded-full ${
                          perc >= 100 ? 'bg-rose-500' : perc >= 60 ? 'bg-orange-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.max(8, perc)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Gráfico 2: Agendamentos por Dia */}
        <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-orange-500" />
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">
                Agendamentos por Data
              </h3>
            </div>
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">Datas ativas</span>
          </div>

          <div className="space-y-3 pt-2">
            {agendamentosPorDia.length === 0 ? (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 py-6 text-center">Nenhum agendamento registrado.</p>
            ) : (
              agendamentosPorDia.map(([data, total]) => (
                <div key={data} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-neutral-800 dark:text-neutral-300">{formatarDataBR(data)}</span>
                    <span className="font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
                      {total} agendamento{total !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(12, total * 20))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Gráfico 3: Funil de Leads por Etapa do CRM */}
      <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">
              Funil Comercial — Oportunidades por Etapa do CRM
            </h3>
          </div>
          <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
            {totalOportunidadesCrm} Oportunidades Totais
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          {crmPorEtapa.map((item) => (
            <div
              key={item.etapa}
              className="p-3 bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200 dark:border-neutral-800 rounded-lg text-center"
            >
              <p className="text-[10px] font-semibold tracking-wider text-neutral-500 dark:text-neutral-400 uppercase truncate">
                {item.etapa}
              </p>
              <p className="text-xl font-bold text-neutral-900 dark:text-white mt-1 font-mono tabular-nums">
                {item.quantidade}
              </p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 truncate font-medium">
                {formatarMoedaBRL(item.valor)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
