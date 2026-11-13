import React, { useState } from 'react';
import { EventoEntity, HorarioEntity, CampoFormularioEntity } from '../../types/database';
import { storage } from '../../services/storageService';
import { X, Plus, Trash2, Clock, Calendar, Check, Image as ImageIcon } from 'lucide-react';
import { gerarCodigoAleatorio } from '../../utils/formatters';
import { compressImageFileToDataUrl } from '../../utils/imageCompressor';

interface EventModalProps {
  eventoParaEditar?: EventoEntity | null;
  onClose: () => void;
  onSaved: () => void;
}

const DIAS_SEMANA_OPCOES = [
  { id: 'SEG', label: 'Segunda' },
  { id: 'TER', label: 'Terça' },
  { id: 'QUA', label: 'Quarta' },
  { id: 'QUI', label: 'Quinta' },
  { id: 'SEX', label: 'Sexta' },
  { id: 'SAB', label: 'Sábado' },
  { id: 'DOM', label: 'Domingo' }
];

export const EventModal: React.FC<EventModalProps> = ({
  eventoParaEditar,
  onClose,
  onSaved
}) => {
  const db = storage.getDatabase();
  const isEditing = !!eventoParaEditar;

  // Estado do Evento
  const [nome, setNome] = useState(eventoParaEditar?.nome || '');
  const [slug, setSlug] = useState(eventoParaEditar?.slug || '');
  const [descricao, setDescricao] = useState(eventoParaEditar?.descricao || '');
  const [imagemUrl, setImagemUrl] = useState(eventoParaEditar?.imagem_url || '');
  const [dataInicio, setDataInicio] = useState(eventoParaEditar?.data_inicio || new Date().toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState(eventoParaEditar?.data_fim || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [diasSemana, setDiasSemana] = useState<string[]>(eventoParaEditar?.dias_semana || ['SEG', 'TER', 'QUA', 'QUI', 'SEX']);
  const [duracaoMinutos, setDuracaoMinutos] = useState(eventoParaEditar?.duracao_minutos || 60);
  const [intervaloMinutos, setIntervaloMinutos] = useState(eventoParaEditar?.intervalo_minutos || 15);
  const [capacidadePadrao, setCapacidadePadrao] = useState(eventoParaEditar?.capacidade_padrao || 5);
  const [responsavelId, setResponsavelId] = useState(eventoParaEditar?.responsavel_id || 'USR-001');
  const [status, setStatus] = useState(eventoParaEditar?.status || 'PUBLICADO');
  const [mensagemConfirmacao, setMensagemConfirmacao] = useState(
    eventoParaEditar?.mensagem_confirmacao || 'Seu agendamento foi confirmado com sucesso! Entraremos em contato para orientações.'
  );
  const [permiteCancelamento, setPermiteCancelamento] = useState(eventoParaEditar?.permite_cancelamento ?? true);
  const [horasAntecedencia, setHorasAntecedencia] = useState(eventoParaEditar?.horas_antecedencia_cancelamento || 24);

  // Horários
  const horariosIniciais = isEditing
    ? db.horarios.filter(h => h.id_evento === eventoParaEditar!.id_evento)
    : [
        { id_horario: 'SCH-TEMP-1', id_evento: '', hora_inicio: '09:00', hora_fim: '10:00', capacidade: 5, dias_aplicaveis: ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'], ativo: true },
        { id_horario: 'SCH-TEMP-2', id_evento: '', hora_inicio: '10:00', hora_fim: '11:00', capacidade: 5, dias_aplicaveis: ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'], ativo: true }
      ];

  const [horarios, setHorarios] = useState<HorarioEntity[]>(horariosIniciais);
  const [novoInicio, setNovoInicio] = useState('14:00');
  const [novoFim, setNovoFim] = useState('15:00');
  const [novaCapacidade, setNovaCapacidade] = useState(5);

  const handleNomeChange = (val: string) => {
    setNome(val);
    if (!isEditing || !slug) {
      const gerado = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setSlug(gerado);
    }
  };

  const toggleDiaSemana = (dia: string) => {
    if (diasSemana.includes(dia)) {
      setDiasSemana(diasSemana.filter(d => d !== dia));
    } else {
      setDiasSemana([...diasSemana, dia]);
    }
  };

  const handleAddHorario = () => {
    if (!novoInicio || !novoFim) return;
    const novoH: HorarioEntity = {
      id_horario: `SCH-${gerarCodigoAleatorio(4)}`,
      id_evento: eventoParaEditar?.id_evento || '',
      hora_inicio: novoInicio,
      hora_fim: novoFim,
      capacidade: novaCapacidade,
      dias_aplicaveis: diasSemana,
      ativo: true
    };
    setHorarios([...horarios, novoH]);
  };

  const handleRemoveHorario = (id: string) => {
    setHorarios(horarios.filter(h => h.id_horario !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !slug.trim()) return;

    const idEvento = eventoParaEditar?.id_evento || `EVT-${gerarCodigoAleatorio(4)}`;

    const eventoFinal: EventoEntity = {
      id_evento: idEvento,
      slug: slug.trim(),
      nome: nome.trim(),
      descricao: descricao.trim(),
      imagem_url: imagemUrl.trim() || undefined,
      data_inicio: dataInicio,
      data_fim: dataFim,
      dias_semana: diasSemana,
      duracao_minutos: Number(duracaoMinutos) || 60,
      intervalo_minutos: Number(intervaloMinutos) || 0,
      capacidade_padrao: Number(capacidadePadrao) || 5,
      responsavel_id: responsavelId,
      status: status as any,
      mensagem_confirmacao: mensagemConfirmacao.trim(),
      permite_cancelamento: permiteCancelamento,
      horas_antecedencia_cancelamento: Number(horasAntecedencia) || 24,
      criado_em: eventoParaEditar?.criado_em || new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    };

    const horariosFinais = horarios.map(h => ({
      ...h,
      id_evento: idEvento,
      dias_aplicaveis: diasSemana
    }));

    const camposAtuais = db.campos_formulario.filter(c => c.id_evento === idEvento);
    const camposFinais: CampoFormularioEntity[] = camposAtuais.length > 0
      ? camposAtuais
      : [
          {
            id_campo: `FLD-${gerarCodigoAleatorio(4)}`,
            id_evento: idEvento,
            nome_campo: 'cargo',
            label: 'Qual é o seu cargo ou empresa?',
            tipo: 'TEXTO_CURTO',
            obrigatorio: true,
            placeholder: 'Ex: Gerente Comercial',
            ordem: 1,
            ativo: true
          }
        ];

    storage.saveEvento(eventoFinal, horariosFinais, camposFinais);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-neutral-900 dark:text-neutral-100 transition-colors">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-500" />
            <h3 className="text-base font-semibold">
              {isEditing ? 'Editar Evento de Atendimento' : 'Criar Novo Evento'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Dados Principais */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Informações do Evento
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Nome do Evento *
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => handleNomeChange(e.target.value)}
                  placeholder="Ex: Sessão de Consultoria Estratégica"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Link Exclusivo (Slug URL) *
                </label>
                <div className="flex items-center bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg overflow-hidden focus-within:border-orange-500">
                  <span className="px-2.5 text-xs text-neutral-500 dark:text-neutral-400 font-mono">/agendar/</span>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="consultoria-estrategica"
                    className="w-full py-2 pr-3 bg-transparent text-sm text-neutral-900 dark:text-white focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Descrição do Atendimento
              </label>
              <textarea
                rows={2}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Explique o objetivo deste atendimento, tópicos abordados e orientações aos participantes."
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* Logo do Projeto / Evento (Aparece à frente do nome na página pública) */}
            <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-2.5">
              <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                Logo / Ícone do Projeto (fica à frente do nome na página pública)
              </label>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                {imagemUrl ? (
                  <div className="relative group shrink-0">
                    <img
                      src={imagemUrl}
                      alt="Logo do Evento"
                      className="w-14 h-14 rounded-xl object-cover border border-neutral-300 dark:border-neutral-700 shadow-xs bg-white dark:bg-neutral-800"
                    />
                    <button
                      type="button"
                      onClick={() => setImagemUrl('')}
                      className="absolute -top-1.5 -right-1.5 p-1 bg-rose-600 hover:bg-rose-500 text-white rounded-full shadow-xs"
                      title="Remover logo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 flex flex-col items-center justify-center text-neutral-400 shrink-0 bg-white dark:bg-neutral-900">
                    <ImageIcon className="w-5 h-5 opacity-60" />
                    <span className="text-[9px] mt-0.5">Sem logo</span>
                  </div>
                )}

                <div className="flex-1 space-y-2 w-full">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={imagemUrl}
                      onChange={(e) => setImagemUrl(e.target.value)}
                      placeholder="Cole a URL da imagem ou escolha um arquivo..."
                      className="flex-1 px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                    />
                    <label className="px-3 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors">
                      <span>Escolher Arquivo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const compressed = await compressImageFileToDataUrl(file, 256, 0.82);
                              setImagemUrl(compressed);
                            } catch (err) {
                              console.warn('Erro ao comprimir imagem:', err);
                            }
                          }
                        }}
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-neutral-400">Sugestões rápidas:</span>
                    <button
                      type="button"
                      onClick={() => setImagemUrl('https://images.unsplash.com/photo-1557804506-669a67965ba0?w=180&auto=format&fit=crop&q=80')}
                      className="px-2 py-0.5 bg-neutral-200/70 hover:bg-orange-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[10px] rounded text-neutral-700 dark:text-neutral-300 transition-colors"
                    >
                      🚀 Estratégia Comercial
                    </button>
                    <button
                      type="button"
                      onClick={() => setImagemUrl('https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=180&auto=format&fit=crop&q=80')}
                      className="px-2 py-0.5 bg-neutral-200/70 hover:bg-orange-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[10px] rounded text-neutral-700 dark:text-neutral-300 transition-colors"
                    >
                      💼 Consultoria Corporativa
                    </button>
                    <button
                      type="button"
                      onClick={() => setImagemUrl('https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=180&auto=format&fit=crop&q=80')}
                      className="px-2 py-0.5 bg-neutral-200/70 hover:bg-orange-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[10px] rounded text-neutral-700 dark:text-neutral-300 transition-colors"
                    >
                      📊 Aceleração de Vendas
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Responsável
                </label>
                <select
                  value={responsavelId}
                  onChange={(e) => setResponsavelId(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                >
                  {db.usuarios.map(u => (
                    <option key={u.id_usuario} value={u.id_usuario}>
                      {u.nome} ({u.perfil})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="PUBLICADO">Publicado (Aberto)</option>
                  <option value="PAUSADO">Pausado</option>
                  <option value="ENCERRADO">Encerrado</option>
                  <option value="RASCUNHO">Rascunho</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Capacidade Padrão por Slot *
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  required
                  value={capacidadePadrao}
                  onChange={(e) => setCapacidadePadrao(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Período e Dias da Semana */}
          <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Período e Dias Aplicáveis
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Data Inicial
                </label>
                <input
                  type="date"
                  required
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Data Final
                </label>
                <input
                  type="date"
                  required
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Dias da Semana Disponíveis
              </label>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA_OPCOES.map((d) => {
                  const sel = diasSemana.includes(d.id);
                  return (
                    <button
                      type="button"
                      key={d.id}
                      onClick={() => toggleDiaSemana(d.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        sel
                          ? 'bg-orange-600 text-white font-semibold'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Horários e Capacidade */}
          <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Horários Disponíveis e Vagas por Horário
              </h4>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {horarios.length} horário{horarios.length !== 1 ? 's' : ''} configurado{horarios.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-2">
              {horarios.map((h) => (
                <div
                  key={h.id_horario}
                  className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-mono font-medium text-neutral-900 dark:text-white">
                      {h.hora_inicio} às {h.hora_fim}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                      · {h.capacidade} vagas por horário
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveHorario(h.id_horario)}
                    className="p-1 text-neutral-400 hover:text-rose-500 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Adicionar Horário */}
            <div className="p-3 bg-neutral-50 dark:bg-neutral-950/60 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">De:</span>
                <input
                  type="time"
                  value={novoInicio}
                  onChange={(e) => setNovoInicio(e.target.value)}
                  className="px-2 py-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded text-xs text-neutral-900 dark:text-white font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Até:</span>
                <input
                  type="time"
                  value={novoFim}
                  onChange={(e) => setNovoFim(e.target.value)}
                  className="px-2 py-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded text-xs text-neutral-900 dark:text-white font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Vagas:</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={novaCapacidade}
                  onChange={(e) => setNovaCapacidade(Number(e.target.value))}
                  className="w-16 px-2 py-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded text-xs text-neutral-900 dark:text-white font-mono"
                />
              </div>

              <button
                type="button"
                onClick={handleAddHorario}
                className="px-3 py-1 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Horário</span>
              </button>
            </div>
          </div>

          {/* Confirmação e Cancelamento */}
          <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Confirmação e Cancelamento
            </h4>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Mensagem de Confirmação Exibida ao Cliente
              </label>
              <textarea
                rows={2}
                value={mensagemConfirmacao}
                onChange={(e) => setMensagemConfirmacao(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={permiteCancelamento}
                  onChange={(e) => setPermiteCancelamento(e.target.checked)}
                  className="rounded bg-neutral-100 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 text-orange-600 focus:ring-0"
                />
                <span>Permitir cancelamento/remarcação pelo cliente</span>
              </label>

              {permiteCancelamento && (
                <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                  <span>com até</span>
                  <input
                    type="number"
                    min={1}
                    max={72}
                    value={horasAntecedencia}
                    onChange={(e) => setHorasAntecedencia(Number(e.target.value))}
                    className="w-16 px-2 py-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded text-xs text-neutral-900 dark:text-white font-mono"
                  />
                  <span>horas de antecedência</span>
                </div>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg text-xs font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Salvar Alterações' : 'Criar Evento'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
