import React, { useState } from 'react';
import { EventoEntity, HorarioEntity, CampoFormularioEntity, ModoDatasEvento } from '../../types/database';
import { storage } from '../../services/storageService';
import { X, Plus, Trash2, Clock, Calendar, Check, Image as ImageIcon, Tag, Repeat, CalendarDays, MapPin } from 'lucide-react';
import { gerarCodigoAleatorio, formatarDataBR, formatarMoedaBRL, obterDiaSemanaAbrev, DIAS_SEMANA_MAP } from '../../utils/formatters';
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

  // Produto & Valor Mensal + Parcelas para CRM / Página Pública
  const [produtoNome, setProdutoNome] = useState(eventoParaEditar?.produto_nome || '');
  const [produtoValorMensal, setProdutoValorMensal] = useState<string>(() => {
    if (eventoParaEditar?.produto_valor_mensal !== undefined && eventoParaEditar.produto_valor_mensal > 0) {
      return String(eventoParaEditar.produto_valor_mensal);
    }
    if (eventoParaEditar?.produto_valor !== undefined && eventoParaEditar.produto_valor > 0) {
      const p = Math.max(1, eventoParaEditar.produto_parcelas || 1);
      return String(Number((eventoParaEditar.produto_valor / p).toFixed(2)));
    }
    return '';
  });
  const [produtoParcelas, setProdutoParcelas] = useState<number>(
    eventoParaEditar?.produto_parcelas && eventoParaEditar.produto_parcelas > 0
      ? eventoParaEditar.produto_parcelas
      : 1
  );
  const [exibirProdutoPublico, setExibirProdutoPublico] = useState<boolean>(
    eventoParaEditar?.exibir_produto_publico ?? false
  );

  const valorMensalNum = Math.max(0, Number(String(produtoValorMensal).replace(',', '.')) || 0);
  const parcelasNum = Math.max(1, Math.floor(Number(produtoParcelas) || 1));
  const valorTotalCalculado = Number((valorMensalNum * parcelasNum).toFixed(2));

  // Campo obrigatório de Local / Direcionamento (Escola, Bairro, Unidade...) no formulário público
  const [labelLocal, setLabelLocal] = useState<string>(
    eventoParaEditar?.label_local?.trim() || 'Bairro / Escola / Local'
  );
  const [localOpcoesText, setLocalOpcoesText] = useState<string>(
    Array.isArray(eventoParaEditar?.local_opcoes) ? eventoParaEditar!.local_opcoes!.join(', ') : ''
  );

  const initialModoDatas: ModoDatasEvento = eventoParaEditar?.modo_datas
    || (eventoParaEditar?.recorrencia_ativa ? 'TOTAL' : 'SEMANAL');
  const [modoDatas, setModoDatas] = useState<ModoDatasEvento>(initialModoDatas);
  const [datasEspecificas, setDatasEspecificas] = useState<string[]>(
    Array.isArray(eventoParaEditar?.datas_especificas) ? [...eventoParaEditar!.datas_especificas!].sort() : []
  );
  const [novaDataEspecifica, setNovaDataEspecifica] = useState(new Date().toISOString().slice(0, 10));

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
  const [formErro, setFormErro] = useState<string | null>(null);

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

  const handleAddDataEspecifica = () => {
    if (!novaDataEspecifica) return;
    if (!datasEspecificas.includes(novaDataEspecifica)) {
      setDatasEspecificas([...datasEspecificas, novaDataEspecifica].sort());
    }
    setFormErro(null);
  };

  const handleRemoveDataEspecifica = (iso: string) => {
    setDatasEspecificas(datasEspecificas.filter(d => d !== iso));
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
    setFormErro(null);
    if (!nome.trim() || !slug.trim()) return;

    if (modoDatas !== 'DATAS_ESPECIFICAS' && diasSemana.length === 0) {
      setFormErro('Selecione pelo menos 1 dia da semana para este evento.');
      return;
    }
    if (modoDatas === 'DATAS_ESPECIFICAS' && datasEspecificas.length === 0) {
      setFormErro('Adicione pelo menos 1 data específica para este evento.');
      return;
    }

    const idEvento = eventoParaEditar?.id_evento || `EVT-${gerarCodigoAleatorio(4)}`;
    const isRecorrente = modoDatas === 'SEMANAL' || modoDatas === 'MENSAL' || modoDatas === 'TOTAL';
    const isDatasEspecificas = modoDatas === 'DATAS_ESPECIFICAS';

    const localOpcoesArray = localOpcoesText
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const eventoFinal: EventoEntity = {
      id_evento: idEvento,
      slug: slug.trim(),
      nome: nome.trim(),
      descricao: descricao.trim(),
      imagem_url: imagemUrl.trim() || undefined,
      produto_nome: produtoNome.trim() || undefined,
      produto_valor_mensal: valorMensalNum,
      produto_parcelas: parcelasNum,
      produto_valor: valorTotalCalculado,
      exibir_produto_publico: exibirProdutoPublico,
      solicitar_local: true,
      label_local: labelLocal.trim() || 'Local (Escola, Bairro, etc.)',
      local_opcoes: localOpcoesArray,
      modo_datas: modoDatas,
      recorrencia_ativa: isRecorrente,
      datas_especificas: isDatasEspecificas ? [...datasEspecificas].sort() : [],
      data_inicio: isDatasEspecificas ? (datasEspecificas[0] || dataInicio) : dataInicio,
      data_fim: isRecorrente ? '' : isDatasEspecificas ? (datasEspecificas[datasEspecificas.length - 1] || dataFim) : dataFim,
      dias_semana: isDatasEspecificas ? ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'] : diasSemana,
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
      dias_aplicaveis: isDatasEspecificas ? ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'] : diasSemana
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

          {/* Produto & Valor Mensal + Parcelas Atrelado (CRM / Comercial) */}
          <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-500" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Produto, Parcelamento &amp; Valor Final (CRM)
                </h4>
              </div>
              {valorTotalCalculado > 0 && (
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {parcelasNum > 1
                    ? `${parcelasNum}x de ${formatarMoedaBRL(valorMensalNum)} = Total ${formatarMoedaBRL(valorTotalCalculado)}`
                    : `Valor Final: ${formatarMoedaBRL(valorTotalCalculado)}`}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-5">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Produto / Serviço Atrelado
                </label>
                <input
                  type="text"
                  value={produtoNome}
                  onChange={(e) => setProdutoNome(e.target.value)}
                  placeholder="Ex: Mentoria Comercial 90 Dias"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Valor Mensal / Parcela (R$)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={produtoValorMensal}
                  onChange={(e) => setProdutoValorMensal(e.target.value)}
                  placeholder="1000.00"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Parcelas (x)
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={produtoParcelas}
                  onChange={(e) => setProdutoParcelas(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Valor Final
                </label>
                <div className="w-full px-2.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg text-sm font-mono font-bold text-emerald-700 dark:text-emerald-300 truncate">
                  {formatarMoedaBRL(valorTotalCalculado)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl">
              <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exibirProdutoPublico}
                  onChange={(e) => setExibirProdutoPublico(e.target.checked)}
                  className="rounded bg-white dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 text-orange-600 focus:ring-0"
                />
                <span>Exibir produto, parcelas e valor total na página pública do agendamento</span>
              </label>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                Valor final (mensal × parcelas) vai direto para o Lead e CRM
              </span>
            </div>
          </div>

          {/* Campo Obrigatório de Local / Direcionamento (Substitui Empresa no formulário público) */}
          <div className="space-y-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-orange-500" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Campo de Local / Direcionamento (Escola, Bairro, Unidade...)
                </h4>
              </div>
              <span className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/50 px-2 py-0.5 rounded-md">
                Sempre obrigatório no agendamento
              </span>
            </div>

            <div className="p-4 bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 rounded-xl space-y-3">
              <p className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
                O título definido abaixo aparece diretamente ao lado de E-mail (junto com Nome e WhatsApp) como campo obrigatório na página pública, e a resposta fica salva no cadastro do Lead.
              </p>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Nome do campo exibido ao participante *
                  </label>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-neutral-400">Atalhos:</span>
                    <button
                      type="button"
                      onClick={() => setLabelLocal('Bairro')}
                      className="px-2 py-0.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:border-orange-500 rounded text-[10px] font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer"
                    >
                      Bairro
                    </button>
                    <button
                      type="button"
                      onClick={() => setLabelLocal('Escola')}
                      className="px-2 py-0.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:border-orange-500 rounded text-[10px] font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer"
                    >
                      Escola
                    </button>
                    <button
                      type="button"
                      onClick={() => setLabelLocal('Unidade')}
                      className="px-2 py-0.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:border-orange-500 rounded text-[10px] font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer"
                    >
                      Unidade
                    </button>
                    <button
                      type="button"
                      onClick={() => setLabelLocal('Cidade')}
                      className="px-2 py-0.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:border-orange-500 rounded text-[10px] font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer"
                    >
                      Cidade
                    </button>
                    <button
                      type="button"
                      onClick={() => setLabelLocal('Empresa')}
                      className="px-2 py-0.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:border-orange-500 rounded text-[10px] font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer"
                    >
                      Empresa
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  required
                  value={labelLocal}
                  onChange={(e) => setLabelLocal(e.target.value)}
                  placeholder="Ex: Bairro, Escola, Unidade ou Local de Origem"
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Opções pré-definidas (opcional — separe por vírgula)
                </label>
                <input
                  type="text"
                  value={localOpcoesText}
                  onChange={(e) => setLocalOpcoesText(e.target.value)}
                  placeholder="Ex: Centro, Jardins, Vila Nova (ou deixe vazio para o cliente digitar livremente)"
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                />
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1">
                  Se preencher opções, o participante escolhe na lista (com opção &quot;Outro&quot;). Se deixar vazio, o participante digita livremente.
                </p>
              </div>
            </div>
          </div>

          {/* Período, Recorrência Semanal e Datas Distintas */}
          <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Recorrência, Período &amp; Datas Distintas
            </h4>

            {/* Seletor de Modo de Datas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  setModoDatas('SEMANAL');
                  setFormErro(null);
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  modoDatas === 'SEMANAL'
                    ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-500 text-orange-900 dark:text-orange-100 shadow-xs'
                    : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Repeat className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <span>Semanal</span>
                </div>
                <p className="text-[11px] opacity-75 mt-1 leading-snug">
                  Aparece só as datas daquela semana.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModoDatas('MENSAL');
                  setFormErro(null);
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  modoDatas === 'MENSAL'
                    ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-500 text-orange-900 dark:text-orange-100 shadow-xs'
                    : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Calendar className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <span>Mensal</span>
                </div>
                <p className="text-[11px] opacity-75 mt-1 leading-snug">
                  Datas do mês inteiro separadas por semana.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModoDatas('TOTAL');
                  setFormErro(null);
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  modoDatas === 'TOTAL'
                    ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-500 text-orange-900 dark:text-orange-100 shadow-xs'
                    : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Repeat className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <span>Total (Anual)</span>
                </div>
                <p className="text-[11px] opacity-75 mt-1 leading-snug">
                  Todas as datas do ano separadas por meses.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModoDatas('DATAS_ESPECIFICAS');
                  setFormErro(null);
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  modoDatas === 'DATAS_ESPECIFICAS'
                    ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-500 text-orange-900 dark:text-orange-100 shadow-xs'
                    : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <CalendarDays className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <span>Datas Específicas</span>
                </div>
                <p className="text-[11px] opacity-75 mt-1 leading-snug">
                  Datas avulsas no calendário.
                </p>
              </button>
            </div>

            {modoDatas === 'DATAS_ESPECIFICAS' ? (
              <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[180px]">
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Adicionar Data Distinta
                    </label>
                    <input
                      type="date"
                      value={novaDataEspecifica}
                      onChange={(e) => setNovaDataEspecifica(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500 font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddDataEspecifica}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar Data</span>
                  </button>
                </div>

                {datasEspecificas.length === 0 ? (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Nenhuma data adicionada ainda. Escolha uma data acima e clique em Adicionar Data.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {datasEspecificas.map((iso) => {
                      const abrev = obterDiaSemanaAbrev(iso);
                      return (
                        <span
                          key={iso}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-mono text-neutral-800 dark:text-neutral-200"
                        >
                          <span>{formatarDataBR(iso)}</span>
                          <span className="text-[10px] text-orange-600 dark:text-orange-400 font-sans font-semibold">
                            {DIAS_SEMANA_MAP[abrev]?.split('-')[0] || abrev}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDataEspecifica(iso)}
                            className="text-neutral-400 hover:text-rose-500 cursor-pointer"
                            title="Remover data"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Data Inicial (a partir de)
                    </label>
                    <input
                      type="date"
                      required
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500 font-mono"
                    />
                  </div>

                  {modoDatas === 'PERIODO' ? (
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
                  ) : (
                    <div className="flex flex-col justify-end">
                      <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                        <Repeat className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>Sem data final — ativo todas as semanas até você desativar</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Dias da Semana Disponíveis (clique para marcar/desmarcar)
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDiasSemana(['TER', 'QUI'])}
                        className="px-2 py-0.5 bg-neutral-100 hover:bg-orange-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[10px] rounded text-neutral-700 dark:text-neutral-300 cursor-pointer"
                      >
                        Ter e Qui
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiasSemana(['SEG', 'QUA', 'SEX'])}
                        className="px-2 py-0.5 bg-neutral-100 hover:bg-orange-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[10px] rounded text-neutral-700 dark:text-neutral-300 cursor-pointer"
                      >
                        Seg, Qua e Sex
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiasSemana(['SEG', 'TER', 'QUA', 'QUI', 'SEX'])}
                        className="px-2 py-0.5 bg-neutral-100 hover:bg-orange-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-[10px] rounded text-neutral-700 dark:text-neutral-300 cursor-pointer"
                      >
                        Seg a Sex
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiasSemana([])}
                        className="px-2 py-0.5 bg-neutral-100 hover:bg-rose-100 dark:bg-neutral-800 dark:hover:bg-rose-950 text-[10px] rounded text-neutral-600 dark:text-neutral-400 cursor-pointer"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {DIAS_SEMANA_OPCOES.map((d) => {
                      const sel = diasSemana.includes(d.id);
                      return (
                        <button
                          type="button"
                          key={d.id}
                          onClick={() => toggleDiaSemana(d.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
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
              </>
            )}
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

          {formErro && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
              {formErro}
            </div>
          )}

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
