import React, { useState } from 'react';
import { storage } from '../../services/storageService';
import { CampoFormularioEntity, TipoCampoFormulario } from '../../types/database';
import { gerarCodigoAleatorio } from '../../utils/formatters';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface FormBuilderViewProps {
  initialEventoId?: string;
}

const TIPOS_CAMPOS: { id: TipoCampoFormulario; label: string; desc: string }[] = [
  { id: 'TEXTO_CURTO', label: 'Texto Curto', desc: 'Respostas de 1 linha (ex: Cargo, Empresa)' },
  { id: 'TEXTO_LONGO', label: 'Texto Longo', desc: 'Respostas descritivas (ex: Expectativas)' },
  { id: 'TELEFONE', label: 'Telefone / WhatsApp', desc: 'Com máscara (XX) XXXXX-XXXX' },
  { id: 'EMAIL', label: 'E-mail', desc: 'Validação de formato de e-mail' },
  { id: 'NUMERO', label: 'Número', desc: 'Valores numéricos (ex: Quantidade de consultores)' },
  { id: 'DATA', label: 'Data', desc: 'Seletor de data' },
  { id: 'SELECAO_UNICA', label: 'Seleção Única', desc: 'Menu suspenso ou botões de rádio' },
  { id: 'SELECAO_MULTIPLA', label: 'Seleção Múltipla', desc: 'Múltiplas opções com checkboxes' },
  { id: 'SIM_NAO', label: 'Sim / Não', desc: 'Interruptor ou caixa de seleção binária' },
];

export const FormBuilderView: React.FC<FormBuilderViewProps> = ({ initialEventoId }) => {
  const db = storage.getDatabase();
  const eventos = db.eventos;

  const [eventoSelecionado, setEventoSelecionado] = useState<string>(
    initialEventoId || (eventos[0]?.id_evento || '')
  );

  const [novoLabel, setNovoLabel] = useState('');
  const [novoTipo, setNovoTipo] = useState<TipoCampoFormulario>('TEXTO_CURTO');
  const [novoObrigatorio, setNovoObrigatorio] = useState(false);
  const [novoPlaceholder, setNovoPlaceholder] = useState('');
  const [novasOpcoes, setNovasOpcoes] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const eventoAtual = eventos.find(e => e.id_evento === eventoSelecionado);
  const campos = db.campos_formulario
    .filter(c => c.id_evento === eventoSelecionado)
    .sort((a, b) => a.ordem - b.ordem);

  const handleAddCampo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoLabel.trim() || !eventoAtual) return;

    const nomeCampo = novoLabel
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const opcoesArr = (novoTipo === 'SELECAO_UNICA' || novoTipo === 'SELECAO_MULTIPLA')
      ? novasOpcoes.split('\n').map(s => s.trim()).filter(Boolean)
      : undefined;

    const novoCampo: CampoFormularioEntity = {
      id_campo: `FLD-${gerarCodigoAleatorio(4)}`,
      id_evento: eventoAtual.id_evento,
      nome_campo: nomeCampo,
      label: novoLabel.trim(),
      tipo: novoTipo,
      obrigatorio: novoObrigatorio,
      placeholder: novoPlaceholder.trim() || undefined,
      opcoes: opcoesArr,
      ordem: campos.length + 1,
      ativo: true
    };

    db.campos_formulario.push(novoCampo);
    storage.saveEvento(
      eventoAtual,
      db.horarios.filter(h => h.id_evento === eventoAtual.id_evento),
      db.campos_formulario.filter(c => c.id_evento === eventoAtual.id_evento)
    );

    setNovoLabel('');
    setNovoPlaceholder('');
    setNovasOpcoes('');
    setNovoObrigatorio(false);
    setRefreshKey(k => k + 1);
  };

  const handleDeleteCampo = (idCampo: string) => {
    if (!eventoAtual) return;
    db.campos_formulario = db.campos_formulario.filter(c => c.id_campo !== idCampo);
    storage.saveEvento(
      eventoAtual,
      db.horarios.filter(h => h.id_evento === eventoAtual.id_evento),
      db.campos_formulario.filter(c => c.id_evento === eventoAtual.id_evento)
    );
    setRefreshKey(k => k + 1);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (!eventoAtual) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= campos.length) return;

    const itemA = campos[index];
    const itemB = campos[targetIndex];

    const tempOrdem = itemA.ordem;
    itemA.ordem = itemB.ordem;
    itemB.ordem = tempOrdem;

    storage.saveEvento(
      eventoAtual,
      db.horarios.filter(h => h.id_evento === eventoAtual.id_evento),
      db.campos_formulario.filter(c => c.id_evento === eventoAtual.id_evento)
    );
    setRefreshKey(k => k + 1);
  };

  const handleToggleAtivo = (idCampo: string) => {
    if (!eventoAtual) return;
    const campo = db.campos_formulario.find(c => c.id_campo === idCampo);
    if (campo) {
      campo.ativo = !campo.ativo;
      storage.saveEvento(
        eventoAtual,
        db.horarios.filter(h => h.id_evento === eventoAtual.id_evento),
        db.campos_formulario.filter(c => c.id_evento === eventoAtual.id_evento)
      );
      setRefreshKey(k => k + 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm transition-colors">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
            Construtor de Formulários de Qualificação
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
            Configure perguntas adicionais personalizadas para cada evento. Os campos Nome e WhatsApp são coletados obrigatoriamente por padrão.
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
                {ev.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Adicionar Novo Campo */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-orange-500" />
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Adicionar Novo Campo</h3>
            </div>

            <form onSubmit={handleAddCampo} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Pergunta ou Rótulo do Campo *
                </label>
                <input
                  type="text"
                  required
                  value={novoLabel}
                  onChange={(e) => setNovoLabel(e.target.value)}
                  placeholder="Ex: Qual é o faturamento da sua empresa?"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Tipo de Resposta *
                </label>
                <select
                  value={novoTipo}
                  onChange={(e) => setNovoTipo(e.target.value as any)}
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                >
                  {TIPOS_CAMPOS.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.label} ({t.desc})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Texto de Orientação (Placeholder)
                </label>
                <input
                  type="text"
                  value={novoPlaceholder}
                  onChange={(e) => setNovoPlaceholder(e.target.value)}
                  placeholder="Ex: Digite seu cargo ou selecione uma opção"
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              {(novoTipo === 'SELECAO_UNICA' || novoTipo === 'SELECAO_MULTIPLA') && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Opções de Resposta (Uma por linha) *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={novasOpcoes}
                    onChange={(e) => setNovasOpcoes(e.target.value)}
                    placeholder="Opção A&#10;Opção B&#10;Opção C"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500 font-mono"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-obrigatorio"
                  checked={novoObrigatorio}
                  onChange={(e) => setNovoObrigatorio(e.target.checked)}
                  className="rounded bg-neutral-100 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 text-orange-600 focus:ring-0"
                />
                <label htmlFor="chk-obrigatorio" className="text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                  Campo de preenchimento obrigatório
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Incluir Campo no Formulário</span>
              </button>
            </form>
          </div>
        </div>

        {/* Campos Cadastrados */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Campos Ativos do Evento
                </h3>
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                {campos.length} campo{campos.length !== 1 ? 's' : ''} customizado{campos.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Campos Base Fixos */}
            <div className="p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">Nome Completo</span>
                  <span className="text-rose-500 text-[10px]">* Obrigatório</span>
                </div>
                <span className="text-[11px] text-neutral-400 font-mono">Padrão do Sistema</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-200 dark:border-neutral-800/80">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">WhatsApp / Telefone</span>
                  <span className="text-rose-500 text-[10px]">* Obrigatório</span>
                </div>
                <span className="text-[11px] text-neutral-400 font-mono">Padrão do Sistema</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-200 dark:border-neutral-800/80">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">E-mail</span>
                  <span className="text-neutral-500 dark:text-neutral-400 text-[10px]">Opcional</span>
                </div>
                <span className="text-[11px] text-neutral-400 font-mono">Padrão do Sistema</span>
              </div>
            </div>

            {/* Lista dos Campos Customizados */}
            {campos.length === 0 ? (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 py-6 text-center">
                Nenhum campo adicional configurado. Adicione perguntas ao lado para qualificar melhor os clientes antes do atendimento.
              </p>
            ) : (
              <div className="space-y-2">
                {campos.map((campo, idx) => (
                  <div
                    key={campo.id_campo}
                    className={`p-3 rounded-lg border transition-all ${
                      campo.ativo
                        ? 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800'
                        : 'bg-neutral-50/50 dark:bg-neutral-950/50 border-neutral-200 dark:border-neutral-800/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-neutral-400">{idx + 1}.</span>
                          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                            {campo.label}
                          </span>
                          {campo.obrigatorio && (
                            <span className="text-[10px] text-rose-500 font-medium">* Obrigatório</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                          <span className="font-mono text-orange-600 dark:text-orange-400">{campo.tipo}</span>
                          {campo.opcoes && campo.opcoes.length > 0 && (
                            <>
                              <span>·</span>
                              <span>{campo.opcoes.length} opções</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMove(idx, 'up')}
                          className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white disabled:opacity-30 rounded"
                          title="Mover para cima"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === campos.length - 1}
                          onClick={() => handleMove(idx, 'down')}
                          className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white disabled:opacity-30 rounded"
                          title="Mover para baixo"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleAtivo(campo.id_campo)}
                          className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded"
                          title={campo.ativo ? 'Desativar campo' : 'Ativar campo'}
                        >
                          {campo.ativo ? (
                            <ToggleRight className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-neutral-400" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCampo(campo.id_campo)}
                          className="p-1 text-neutral-400 hover:text-rose-500 rounded"
                          title="Excluir campo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
