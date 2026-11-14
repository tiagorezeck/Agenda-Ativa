import React, { useState, useMemo } from 'react';
import { storage } from '../../services/storageService';
import { BookingSubmissionPayload, BookingSuccessResult } from '../../types/api';
import {
  formatarDataBR,
  formatarMoedaBRL,
  formatarTelefoneBR,
  gerarLinkWhatsApp,
  obterDiaSemanaAbrev,
  DIAS_SEMANA_MAP
} from '../../utils/formatters';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Share2,
  ArrowRight,
  ArrowLeft,
  Sun,
  Moon,
  RotateCcw,
  ChevronRight,
  Check,
  Mail,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Laptop,
  Tablet,
  Smartphone,
  Search,
  XCircle,
  CalendarClock,
  X,
  Tag
} from 'lucide-react';

interface PublicBookingViewProps {
  initialSlug?: string;
  onBackToAdmin?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const PublicBookingView: React.FC<PublicBookingViewProps> = ({
  initialSlug,
  onBackToAdmin,
  theme = 'dark',
  onToggleTheme
}) => {
  const db = storage.getDatabase();
  const eventos = db.eventos;

  // Seleção de Evento
  const [selectedSlug, setSelectedSlug] = useState<string>(
    initialSlug || eventos[0]?.slug || ''
  );

  const eventoAtual = useMemo(() => {
    return eventos.find(e => e.slug === selectedSlug || e.id_evento === selectedSlug) || eventos[0];
  }, [eventos, selectedSlug]);

  // Modo de visualização responsiva para testes rápidos (Notebook, Tablet, Mobile ou Auto)
  const [devicePreview, setDevicePreview] = useState<'auto' | 'notebook' | 'tablet' | 'mobile'>('auto');

  // Informações da Empresa (Cadastradas em Configurações)
  const empresaNome = db.config.find(c => c.chave === 'EMPRESA_NOME')?.valor || 'Instituto Comet';
  const empresaLogo = db.config.find(c => c.chave === 'EMPRESA_LOGO')?.valor || '';
  const empresaWhatsapp = db.config.find(c => c.chave === 'WHATSAPP_CONTATO')?.valor || '';
  const empresaEmail = db.config.find(c => c.chave === 'EMPRESA_EMAIL')?.valor || '';
  const empresaEndereco = db.config.find(c => c.chave === 'EMPRESA_ENDERECO')?.valor || '';
  const empresaCnpj = db.config.find(c => c.chave === 'EMPRESA_CNPJ')?.valor || '';
  const termosLgpd = db.config.find(c => c.chave === 'TERMOS_LGPD')?.valor || '';

  // Etapas do Agendamento: 1 (Dia) -> 2 (Horário) -> 3 (Perguntas)
  const [etapaAtual, setEtapaAtual] = useState<1 | 2 | 3>(1);
  const [dataSelecionada, setDataSelecionada] = useState<string>('');
  const [slotSelecionado, setSlotSelecionado] = useState<{ horaInicio: string; horaFim: string } | null>(null);

  // Campos do Formulário
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [localResposta, setLocalResposta] = useState('');
  const [localOutro, setLocalOutro] = useState('');
  const [respostasCustom, setRespostasCustom] = useState<Record<string, string>>({});
  const [lgpdAceito, setLgpdAceito] = useState(true);

  // Estado de Submissão e Resultado
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [resultadoSucesso, setResultadoSucesso] = useState<BookingSuccessResult | null>(null);

  // Autoatendimento por Protocolo (Consultar / Cancelar / Remarcar)
  const [selfServiceOpen, setSelfServiceOpen] = useState(false);
  const [ssProtocolo, setSsProtocolo] = useState('');
  const [ssContato, setSsContato] = useState('');
  const [ssResultado, setSsResultado] = useState<ReturnType<typeof storage.findBookingByProtocol> | null>(null);
  const [ssErro, setSsErro] = useState<string | null>(null);
  const [ssSucesso, setSsSucesso] = useState<string | null>(null);
  const [ssBusy, setSsBusy] = useState(false);
  const [ssRemarcarData, setSsRemarcarData] = useState('');
  const [ssRemarcarSlot, setSsRemarcarSlot] = useState<{ horaInicio: string; horaFim: string } | null>(null);

  // Campos Dinâmicos do Evento
  const camposDoEvento = useMemo(() => {
    if (!eventoAtual) return [];
    return db.campos_formulario
      .filter(c => c.id_evento === eventoAtual.id_evento && c.ativo)
      .sort((a, b) => a.ordem - b.ordem);
  }, [eventoAtual, db.campos_formulario]);

  // Helper de data local (evita desvio de fuso UTC em horários noturnos)
  const toLocalIsoDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Lista de datas disponíveis respeitando Recorrência Semanal, Datas Específicas ou Período Fechado
  const proximasDatas = useMemo(() => {
    if (!eventoAtual) return [];
    const list: { dataIso: string; diaSemana: string; rotulo: string }[] = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeIso = toLocalIsoDate(hoje);
    const amanha = new Date(hoje);
    amanha.setDate(hoje.getDate() + 1);
    const amanhaIso = toLocalIsoDate(amanha);

    const modo = eventoAtual.modo_datas || (eventoAtual.recorrencia_ativa ? 'TOTAL' : 'SEMANAL');
    const diasPermitidos = Array.isArray(eventoAtual.dias_semana) && eventoAtual.dias_semana.length > 0
      ? eventoAtual.dias_semana
      : ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'];

    const baseDateStr = eventoAtual.data_inicio || hojeIso;
    const baseDate = new Date(baseDateStr + 'T00:00:00');

    if (modo === 'DATAS_ESPECIFICAS') {
      const especificas = Array.isArray(eventoAtual.datas_especificas)
        ? [...eventoAtual.datas_especificas].filter(iso => iso >= hojeIso).sort()
        : [];
      for (const iso of especificas) {
        const abrev = obterDiaSemanaAbrev(iso);
        let rotulo = DIAS_SEMANA_MAP[abrev] || abrev;
        if (iso === hojeIso) rotulo = 'Hoje';
        else if (iso === amanhaIso) rotulo = 'Amanhã';
        list.push({ dataIso: iso, diaSemana: abrev, rotulo });
      }
      return list;
    }

    if (modo === 'SEMANAL') {
      const dayOfWeek = baseDate.getDay();
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(baseDate);
      monday.setDate(baseDate.getDate() + diffToMon);

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const iso = toLocalIsoDate(d);
        if (iso < hojeIso) continue;
        const abrev = obterDiaSemanaAbrev(iso);
        if (!diasPermitidos.includes(abrev)) continue;

        let rotulo = DIAS_SEMANA_MAP[abrev] || abrev;
        if (iso === hojeIso) rotulo = 'Hoje';
        else if (iso === amanhaIso) rotulo = 'Amanhã';

        list.push({ dataIso: iso, diaSemana: abrev, rotulo });
      }
      return list;
    }

    if (modo === 'MENSAL') {
      const year = baseDate.getFullYear();
      const month = baseDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      const curr = new Date(firstDay);
      while (curr <= lastDay && list.length < 35) {
        const iso = toLocalIsoDate(curr);
        if (iso >= hojeIso) {
          const abrev = obterDiaSemanaAbrev(iso);
          if (diasPermitidos.includes(abrev)) {
            let rotulo = DIAS_SEMANA_MAP[abrev] || abrev;
            if (iso === hojeIso) rotulo = 'Hoje';
            else if (iso === amanhaIso) rotulo = 'Amanhã';
            list.push({ dataIso: iso, diaSemana: abrev, rotulo });
          }
        }
        curr.setDate(curr.getDate() + 1);
      }
      return list;
    }

    // TOTAL, RECORRENTE ou PERIODO
    const inicioStr = eventoAtual.data_inicio && eventoAtual.data_inicio > hojeIso
      ? eventoAtual.data_inicio
      : hojeIso;
    const isPer = modo === 'PERIODO';
    const fimStr = isPer ? (eventoAtual.data_fim || '') : '';

    for (let i = 0; i < 120; i++) {
      const d = new Date(hoje);
      d.setDate(hoje.getDate() + i);
      const iso = toLocalIsoDate(d);

      if (iso < inicioStr) continue;
      if (fimStr && iso > fimStr) break;

      const abrev = obterDiaSemanaAbrev(iso);
      if (!diasPermitidos.includes(abrev)) continue;

      let rotulo = DIAS_SEMANA_MAP[abrev] || abrev;
      if (iso === hojeIso) rotulo = 'Hoje';
      else if (iso === amanhaIso) rotulo = 'Amanhã';

      list.push({ dataIso: iso, diaSemana: abrev, rotulo });
      if (list.length >= 28) break;
    }
    return list;
  }, [eventoAtual]);

  // Slots em tempo real para a data selecionada
  const slotsDaData = useMemo(() => {
    if (!eventoAtual || !dataSelecionada) return [];
    return storage.getDisponibilidade(eventoAtual.id_evento, dataSelecionada);
  }, [eventoAtual, dataSelecionada, resultadoSucesso, ssSucesso]);

  // Slots disponíveis para remarcação por protocolo
  const ssSlotsRemarcacao = useMemo(() => {
    if (!ssResultado || !ssRemarcarData) return [];
    return storage.getDisponibilidade(ssResultado.evento.id_evento, ssRemarcarData);
  }, [ssResultado, ssRemarcarData, ssSucesso]);

  // Handler ao selecionar dia: salva e abre card de horários
  const handleSelectData = (iso: string) => {
    setDataSelecionada(iso);
    setSlotSelecionado(null);
    setEtapaAtual(2);
    setErroMsg(null);
  };

  // Handler ao selecionar horário: salva e abre card com perguntas
  const handleSelectSlot = (slot: { horaInicio: string; horaFim: string }) => {
    setSlotSelecionado(slot);
    setEtapaAtual(3);
    setErroMsg(null);
  };

  const handleCustomChange = (campoId: string, val: string) => {
    setRespostasCustom(prev => ({ ...prev, [campoId]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventoAtual || !dataSelecionada || !slotSelecionado) return;
    if (!nome.trim() || !whatsapp.trim()) {
      setErroMsg('Por favor, preencha o Nome e WhatsApp.');
      return;
    }

    const temOpcoesLocal = Boolean(
      eventoAtual.solicitar_local && Array.isArray(eventoAtual.local_opcoes) && eventoAtual.local_opcoes.length > 0
    );
    const valorLocalFinal = eventoAtual.solicitar_local
      ? (temOpcoesLocal && localResposta === '__OUTRO__' ? localOutro.trim() : localResposta.trim())
      : '';

    if (eventoAtual.solicitar_local && !valorLocalFinal) {
      setErroMsg(`Por favor, responda: ${eventoAtual.label_local || 'Local / Campanha de Origem'}.`);
      return;
    }

    setErroMsg(null);
    setIsSubmitting(true);

    try {
      const payload: BookingSubmissionPayload = {
        slug_evento: eventoAtual.slug,
        data: dataSelecionada,
        hora_inicio: slotSelecionado.horaInicio,
        hora_fim: slotSelecionado.horaFim,
        nome: nome.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim(),
        empresa: empresa.trim(),
        local: valorLocalFinal || undefined,
        respostas_customizadas: respostasCustom
      };

      const result = await storage.createBookingWithCloud(payload);
      setResultadoSucesso(result);
    } catch (err: any) {
      setErroMsg(err.message || 'Erro ao realizar agendamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNovoAgendamento = () => {
    setResultadoSucesso(null);
    setDataSelecionada('');
    setSlotSelecionado(null);
    setEtapaAtual(1);
    setNome('');
    setWhatsapp('');
    setEmail('');
    setEmpresa('');
    setLocalResposta('');
    setLocalOutro('');
    setRespostasCustom({});
    setErroMsg(null);
  };

  const handleBuscarProtocolo = (e: React.FormEvent) => {
    e.preventDefault();
    setSsErro(null);
    setSsSucesso(null);
    setSsRemarcarData('');
    setSsRemarcarSlot(null);
    try {
      const found = storage.findBookingByProtocol(ssProtocolo, ssContato);
      setSsResultado(found);
    } catch (err: any) {
      setSsResultado(null);
      setSsErro(err.message || 'Agendamento não encontrado.');
    }
  };

  const handleCancelarProtocolo = async () => {
    if (!ssResultado) return;
    setSsErro(null);
    setSsSucesso(null);
    setSsBusy(true);
    try {
      await storage.cancelBookingByProtocol(ssProtocolo, ssContato);
      const updated = storage.findBookingByProtocol(ssProtocolo, ssContato);
      setSsResultado(updated);
      setSsSucesso('Agendamento cancelado com sucesso! A vaga foi liberada automaticamente.');
    } catch (err: any) {
      setSsErro(err.message || 'Não foi possível cancelar.');
    } finally {
      setSsBusy(false);
    }
  };

  const handleRemarcarProtocolo = async () => {
    if (!ssResultado || !ssRemarcarData || !ssRemarcarSlot) return;
    setSsErro(null);
    setSsSucesso(null);
    setSsBusy(true);
    try {
      await storage.rescheduleBookingByProtocol(
        ssProtocolo,
        ssContato,
        ssRemarcarData,
        ssRemarcarSlot.horaInicio,
        ssRemarcarSlot.horaFim
      );
      const updated = storage.findBookingByProtocol(ssProtocolo, ssContato);
      setSsResultado(updated);
      setSsRemarcarData('');
      setSsRemarcarSlot(null);
      setSsSucesso(
        `Agendamento remarcado para ${formatarDataBR(updated.agendamento.data_agendamento)} às ${updated.agendamento.hora_inicio}!`
      );
    } catch (err: any) {
      setSsErro(err.message || 'Não foi possível remarcar.');
    } finally {
      setSsBusy(false);
    }
  };

  // Classes do container principal conforme modo de pré-visualização ou tela física
  const containerWidthClass = useMemo(() => {
    switch (devicePreview) {
      case 'notebook':
        return 'max-w-4xl w-full';
      case 'tablet':
        return 'max-w-2xl w-full';
      case 'mobile':
        return 'max-w-sm w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-3xl p-3 sm:p-5 shadow-2xl my-2';
      default:
        return 'max-w-3xl w-full';
    }
  }, [devicePreview]);

  // --- TELA DE SUCESSO E PROTOCOLO ---
  if (resultadoSucesso) {
    const linkWhatsAppConfirmacao = gerarLinkWhatsApp(
      db.config.find(c => c.chave === 'WHATSAPP_CONTATO')?.valor || '5511999998888',
      `Olá! Meu nome é *${nome}* e acabei de confirmar meu agendamento para o evento *${resultadoSucesso.evento_nome}* no dia *${formatarDataBR(resultadoSucesso.data)}* às *${resultadoSucesso.hora_inicio}*.\n\nMeu Protocolo é: *${resultadoSucesso.protocolo}*.`
    );

    return (
      <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 py-6 sm:py-12 px-3 sm:px-6 flex items-center justify-center text-neutral-900 dark:text-neutral-100 transition-colors">
        <div className="max-w-lg w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-xl space-y-5 sm:space-y-6 text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">
              Agendamento Confirmado!
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Sua vaga foi reservada com sucesso no sistema.
            </p>
          </div>

          {/* Protocolo */}
          <div className="p-3.5 sm:p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl sm:rounded-2xl space-y-1">
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-widest font-semibold">
              Número do Protocolo
            </span>
            <p className="text-base sm:text-lg font-bold font-mono text-orange-600 dark:text-orange-400 tracking-wider">
              {resultadoSucesso.protocolo}
            </p>
          </div>

          {/* Resumo */}
          <div className="p-3.5 sm:p-4 bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800/80 rounded-xl sm:rounded-2xl text-left text-xs space-y-2 text-neutral-700 dark:text-neutral-300">
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-500 dark:text-neutral-400 shrink-0">Evento:</span>
              <strong className="text-neutral-900 dark:text-white text-right truncate">
                {resultadoSucesso.evento_nome}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-500 dark:text-neutral-400 shrink-0">Data &amp; Horário:</span>
              <strong className="font-mono text-neutral-900 dark:text-white text-right">
                {formatarDataBR(resultadoSucesso.data)} às {resultadoSucesso.hora_inicio}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-500 dark:text-neutral-400 shrink-0">Participante:</span>
              <span className="text-neutral-900 dark:text-white text-right truncate">{nome}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-500 dark:text-neutral-400 shrink-0">WhatsApp:</span>
              <span className="font-mono text-neutral-900 dark:text-white">{formatarTelefoneBR(whatsapp)}</span>
            </div>
            {(localResposta === '__OUTRO__' ? localOutro.trim() : localResposta.trim()) && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-500 dark:text-neutral-400 shrink-0">Local / Origem:</span>
                <span className="text-neutral-900 dark:text-white font-medium text-right truncate">
                  {localResposta === '__OUTRO__' ? localOutro.trim() : localResposta.trim()}
                </span>
              </div>
            )}
          </div>

          {/* Mensagem Personalizada */}
          <div className="p-3.5 sm:p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 rounded-xl text-left text-xs text-orange-900 dark:text-orange-200">
            <p className="font-semibold mb-1">Orientações do Atendimento:</p>
            <p className="leading-relaxed">{resultadoSucesso.mensagem_confirmacao}</p>
          </div>

          {/* Ações */}
          <div className="space-y-2.5 pt-2">
            <a
              href={linkWhatsAppConfirmacao}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <Share2 className="w-4 h-4" />
              <span>Confirmar pelo WhatsApp</span>
            </a>

            <button
              onClick={handleNovoAgendamento}
              className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5 active:scale-[0.99]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Realizar Outro Agendamento</span>
            </button>

            {onBackToAdmin && (
              <button
                onClick={onBackToAdmin}
                className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white pt-2 block mx-auto underline transition-colors"
              >
                Voltar ao Painel Administrativo
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- FLUXO PRINCIPAL: PROGRESSIVE CARD WORKFLOW ---
  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 py-4 sm:py-8 px-3 sm:px-6 flex flex-col items-center justify-start text-neutral-900 dark:text-neutral-100 transition-colors">
      {/* Barra Superior com Controles e Alternador de Modos (Notebook / Tablet / Mobile) */}
      <div className="w-full max-w-4xl mb-4 sm:mb-6 flex flex-wrap items-center justify-between gap-2.5 text-xs text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center gap-2">
          {onBackToAdmin && (
            <button
              onClick={onBackToAdmin}
              className="px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1.5 transition-colors font-medium shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Painel</span>
            </button>
          )}

          {/* Seletor de Evento */}
          {eventos.length > 1 && (
            <select
              value={selectedSlug}
              onChange={(e) => {
                setSelectedSlug(e.target.value);
                setEtapaAtual(1);
                setDataSelecionada('');
                setSlotSelecionado(null);
                setLocalResposta('');
                setLocalOutro('');
              }}
              className="px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-lg text-xs text-neutral-800 dark:text-neutral-200 max-w-[130px] sm:max-w-[200px] truncate shadow-xs focus:outline-none"
            >
              {eventos.map(ev => (
                <option key={ev.slug} value={ev.slug}>
                  {ev.nome}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Botão Autoatendimento (Cancelar / Remarcar por Protocolo) */}
          <button
            type="button"
            onClick={() => {
              setSelfServiceOpen(true);
              setSsErro(null);
              setSsSucesso(null);
            }}
            className="px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 hover:border-orange-500 flex items-center gap-1.5 transition-colors font-medium shadow-xs cursor-pointer"
          >
            <CalendarClock className="w-3.5 h-3.5 text-orange-500" />
            <span>Meus Agendamentos</span>
          </button>

          {/* Seletor de Dispositivo Responsivo */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-lg p-0.5 flex items-center gap-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setDevicePreview('notebook')}
              title="Modo Notebook (Largura desktop)"
              className={`p-1.5 rounded-md transition-colors ${
                devicePreview === 'notebook'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDevicePreview('tablet')}
              title="Modo Tablet (Largura média)"
              className={`p-1.5 rounded-md transition-colors ${
                devicePreview === 'tablet'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDevicePreview('mobile')}
              title="Modo Mobile (Celular smartphone)"
              className={`p-1.5 rounded-md transition-colors ${
                devicePreview === 'mobile'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDevicePreview('auto')}
              title="Modo Fluido Automático (100% da tela)"
              className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                devicePreview === 'auto'
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white'
                  : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              Auto
            </button>
          </div>

          {/* Alternador de Tema Claro / Escuro */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
              className="p-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors flex items-center gap-1 text-xs shadow-xs"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden md:inline">Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="hidden md:inline">Escuro</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Container Adaptável: Notebook / Tablet / Mobile */}
      <div className={`space-y-4 sm:space-y-6 transition-all duration-300 ${containerWidthClass}`}>
        {/* Header do Evento com Logo do Projeto à Frente do Nome */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 shadow-sm space-y-4 transition-colors">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] sm:text-[11px] font-semibold tracking-wider text-orange-600 dark:text-orange-400 uppercase bg-orange-100 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-900/60 px-2.5 py-0.5 rounded-full">
              Agendamento Online
            </span>
            <span className="text-neutral-400 dark:text-neutral-600">·</span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{eventoAtual.duracao_minutos} min por atendimento</span>
            </span>
          </div>

          {/* Logo do projeto ficando à frente do nome (mentoria comercial estratégica) */}
          <div className="flex flex-row items-center gap-3 sm:gap-4 pt-1">
            {eventoAtual.imagem_url ? (
              <img
                src={eventoAtual.imagem_url}
                alt={`Logo ${eventoAtual.nome}`}
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl object-cover border border-neutral-200 dark:border-neutral-700 shadow-sm shrink-0 bg-neutral-100 dark:bg-neutral-800"
              />
            ) : (
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white font-bold text-lg sm:text-2xl flex items-center justify-center shadow-sm shrink-0 border border-orange-400/30">
                {eventoAtual.nome.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white leading-tight">
                {eventoAtual.nome}
              </h1>
              <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 sm:mt-1 truncate">
                Atendimento Oficial · {empresaNome}
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
            {eventoAtual.descricao || 'Selecione uma data para começar seu agendamento.'}
          </p>

          {eventoAtual.exibir_produto_publico && (eventoAtual.produto_nome || (eventoAtual.produto_valor && eventoAtual.produto_valor > 0)) && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs">
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold">{eventoAtual.produto_nome || eventoAtual.nome}</span>
              </div>
              {eventoAtual.produto_valor && eventoAtual.produto_valor > 0 ? (
                <div className="text-right font-mono font-bold text-emerald-700 dark:text-emerald-300">
                  {eventoAtual.produto_parcelas && eventoAtual.produto_parcelas > 1 && eventoAtual.produto_valor_mensal && eventoAtual.produto_valor_mensal > 0 ? (
                    <span>
                      {eventoAtual.produto_parcelas}x de {formatarMoedaBRL(eventoAtual.produto_valor_mensal)}{' '}
                      <span className="text-[11px] font-normal opacity-80">
                        (Total: {formatarMoedaBRL(eventoAtual.produto_valor)})
                      </span>
                    </span>
                  ) : (
                    <span>{formatarMoedaBRL(eventoAtual.produto_valor)}</span>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Stepper Visual Responsivo */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-xs">
            <button
              onClick={() => setEtapaAtual(1)}
              className={`p-2 sm:p-2.5 rounded-xl text-left transition-all flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 ${
                etapaAtual === 1
                  ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-semibold border border-orange-200 dark:border-orange-800/60'
                  : dataSelecionada
                  ? 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  : 'text-neutral-400 dark:text-neutral-600'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                dataSelecionada ? 'bg-emerald-600 text-white' : 'bg-orange-600 text-white'
              }`}>
                {dataSelecionada ? <Check className="w-3 h-3" /> : '1'}
              </div>
              <span className="truncate text-[11px] sm:text-xs">1. Data</span>
            </button>

            <button
              disabled={!dataSelecionada}
              onClick={() => setEtapaAtual(2)}
              className={`p-2 sm:p-2.5 rounded-xl text-left transition-all flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 ${
                etapaAtual === 2
                  ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-semibold border border-orange-200 dark:border-orange-800/60'
                  : slotSelecionado
                  ? 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  : 'text-neutral-400 dark:text-neutral-600 opacity-60'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                slotSelecionado ? 'bg-emerald-600 text-white' : 'bg-neutral-300 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-300'
              }`}>
                {slotSelecionado ? <Check className="w-3 h-3" /> : '2'}
              </div>
              <span className="truncate text-[11px] sm:text-xs">2. Horário</span>
            </button>

            <button
              disabled={!slotSelecionado}
              onClick={() => setEtapaAtual(3)}
              className={`p-2 sm:p-2.5 rounded-xl text-left transition-all flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 ${
                etapaAtual === 3
                  ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-semibold border border-orange-200 dark:border-orange-800/60'
                  : 'text-neutral-400 dark:text-neutral-600 opacity-60'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                etapaAtual === 3 ? 'bg-orange-600 text-white' : 'bg-neutral-300 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-300'
              }`}>
                3
              </div>
              <span className="truncate text-[11px] sm:text-xs">3. Dados</span>
            </button>
          </div>
        </div>

        {/* EVENTO PAUSADO / ENCERRADO */}
        {eventoAtual && eventoAtual.status !== 'PUBLICADO' ? (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl sm:rounded-3xl p-6 sm:p-10 text-center space-y-3 shadow-sm">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
            <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
              Agendamentos temporariamente indisponíveis
            </h3>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
              Este evento está com status <strong>{eventoAtual.status}</strong> no momento. Entre em contato com a equipe pelos canais abaixo para mais informações.
            </p>
          </div>
        ) : (
        <>
        {/* CARD 1: ESCOLHA O DIA (Responsivo: 2 colunas mobile, 4 tablet, 7 notebook) */}
        {etapaAtual === 1 && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 shadow-sm space-y-4 animate-in fade-in duration-200 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">
                    Selecione o Dia do Atendimento
                  </h3>
                  <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400">
                    Clique na data desejada para abrir os horários disponíveis
                  </p>
                </div>
              </div>
            </div>

            {proximasDatas.length === 0 ? (
              <div className="p-6 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-center space-y-1.5">
                <Calendar className="w-8 h-8 text-neutral-400 mx-auto" />
                <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Nenhuma data disponível dentro da programação deste evento.
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {eventoAtual.modo_datas === 'DATAS_ESPECIFICAS'
                    ? 'Aguardando novas datas específicas serem liberadas pela equipe.'
                    : eventoAtual.recorrencia_ativa || eventoAtual.modo_datas === 'RECORRENTE'
                    ? `Início programado a partir de ${formatarDataBR(eventoAtual.data_inicio)}.`
                    : `Período do evento: ${formatarDataBR(eventoAtual.data_inicio)} até ${formatarDataBR(eventoAtual.data_fim)}.`}
                </p>
              </div>
            ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-2.5 pt-2">
              {proximasDatas.map((item) => {
                const isSelected = dataSelecionada === item.dataIso;
                return (
                  <button
                    type="button"
                    key={item.dataIso}
                    onClick={() => handleSelectData(item.dataIso)}
                    className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border text-center transition-all flex flex-col items-center justify-center min-h-[70px] sm:min-h-[82px] active:scale-[0.98] cursor-pointer ${
                      isSelected
                        ? 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-600/30'
                        : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:border-orange-400 hover:bg-orange-50/50 dark:hover:bg-neutral-900'
                    }`}
                  >
                    <span className="text-[10px] sm:text-[11px] font-medium opacity-80 uppercase tracking-wider">
                      {item.rotulo}
                    </span>
                    <span className="text-sm sm:text-base font-bold font-mono mt-0.5 sm:mt-1">
                      {formatarDataBR(item.dataIso).slice(0, 5)}
                    </span>
                    <span className={`text-[9px] sm:text-[10px] mt-0.5 ${isSelected ? 'text-white/80' : 'text-neutral-500 dark:text-neutral-400'}`}>
                      {item.diaSemana}
                    </span>
                  </button>
                );
              })}
            </div>
            )}
          </div>
        )}

        {/* CARD 2: ESCOLHA O HORÁRIO (Responsivo: 1 col mobile, 2 col tablet, 3 col notebook) */}
        {etapaAtual === 2 && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 shadow-sm space-y-4 animate-in fade-in duration-200 transition-colors">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white truncate">
                    Horários para {formatarDataBR(dataSelecionada)}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    Selecione o horário desejado
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEtapaAtual(1)}
                className="px-2.5 sm:px-3 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Trocar Dia</span>
              </button>
            </div>

            {slotsDaData.length === 0 ? (
              <div className="p-6 sm:p-8 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl sm:rounded-2xl text-center space-y-2">
                <Calendar className="w-8 h-8 text-neutral-400 mx-auto" />
                <p className="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  Nenhum horário disponível para esta data.
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Por favor, escolha outro dia com vagas livres.
                </p>
                <button
                  onClick={() => setEtapaAtual(1)}
                  className="mt-2 px-4 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-semibold"
                >
                  Voltar para Datas
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 pt-2">
                {slotsDaData.map((slot) => {
                  const isSelected = slotSelecionado?.horaInicio === slot.hora_inicio;
                  const esgotado = !slot.disponivel;

                  return (
                    <button
                      type="button"
                      key={slot.hora_inicio}
                      disabled={esgotado}
                      onClick={() =>
                        handleSelectSlot({
                          horaInicio: slot.hora_inicio,
                          horaFim: slot.hora_fim
                        })
                      }
                      className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer active:scale-[0.99] ${
                        esgotado
                          ? 'bg-neutral-100 dark:bg-neutral-950/40 border-neutral-200 dark:border-neutral-800/40 opacity-40 cursor-not-allowed'
                          : isSelected
                          ? 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-600/30'
                          : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 hover:border-orange-500 hover:bg-orange-50/40 dark:hover:bg-neutral-900'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <span className="text-sm sm:text-base font-bold font-mono">
                          {slot.hora_inicio} às {slot.hora_fim}
                        </span>
                        <div className="text-[11px]">
                          {esgotado ? (
                            <span className="text-rose-500 font-semibold uppercase text-[10px]">
                              {slot.bloqueado ? 'Bloqueado' : 'Esgotado'}
                            </span>
                          ) : (
                            <span className={isSelected ? 'text-white/90 font-mono text-[10px] sm:text-xs' : 'text-emerald-600 dark:text-emerald-400 font-mono text-[10px] sm:text-xs'}>
                              {slot.vagas_restantes} vaga{slot.vagas_restantes !== 1 ? 's' : ''} restante{slot.vagas_restantes !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {!esgotado && (
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                        }`}>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CARD 3: PERGUNTAS E DADOS DE CONTATO (Responsivo em formulários) */}
        {etapaAtual === 3 && slotSelecionado && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 shadow-sm space-y-5 sm:space-y-6 animate-in fade-in duration-200 transition-colors">
            {/* Header do Card 3 */}
            <div className="pb-3 sm:pb-4 border-b border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white truncate">
                    Preencha seus Dados
                  </h3>
                  <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 font-mono truncate">
                    {formatarDataBR(dataSelecionada)} às {slotSelecionado.horaInicio}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEtapaAtual(2)}
                className="px-2.5 sm:px-3 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Trocar Horário</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {/* Campos Principais: 1 coluna no mobile, 2 no tablet e notebook */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full px-3.5 py-2.5 sm:py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                    WhatsApp com DDD *
                  </label>
                  <input
                    type="tel"
                    required
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3.5 py-2.5 sm:py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full px-3.5 py-2.5 sm:py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                    Empresa (Opcional)
                  </label>
                  <input
                    type="text"
                    value={empresa}
                    onChange={(e) => setEmpresa(e.target.value)}
                    placeholder="Nome da sua empresa"
                    className="w-full px-3.5 py-2.5 sm:py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
              </div>

              {/* Pergunta de Local / Campanha (Escola, Bairro, Unidade...) */}
              {eventoAtual.solicitar_local && (
                <div className="p-3.5 bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 rounded-xl space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <span>{eventoAtual.label_local || 'De qual escola, bairro ou local você veio?'}</span>
                    <span className="text-rose-500">*</span>
                  </label>

                  {Array.isArray(eventoAtual.local_opcoes) && eventoAtual.local_opcoes.length > 0 ? (
                    <div className="space-y-2">
                      <select
                        required
                        value={localResposta}
                        onChange={(e) => setLocalResposta(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                      >
                        <option value="">Selecione uma opção...</option>
                        {eventoAtual.local_opcoes.map((op) => (
                          <option key={op} value={op}>
                            {op}
                          </option>
                        ))}
                        <option value="__OUTRO__">Outro local (digitar)...</option>
                      </select>

                      {localResposta === '__OUTRO__' && (
                        <input
                          type="text"
                          required
                          value={localOutro}
                          onChange={(e) => setLocalOutro(e.target.value)}
                          placeholder="Digite o nome do local, escola ou bairro..."
                          className="w-full px-3.5 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                        />
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      required
                      value={localResposta}
                      onChange={(e) => setLocalResposta(e.target.value)}
                      placeholder="Ex: Escola Estadual Centro, Bairro Jardins..."
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                    />
                  )}
                </div>
              )}

              {/* Perguntas Dinâmicas do Evento */}
              {camposDoEvento.length > 0 && (
                <div className="space-y-3.5 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <p className="text-[11px] sm:text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Perguntas de Qualificação
                  </p>

                  {camposDoEvento.map((campo) => (
                    <div key={campo.id_campo} className="space-y-1">
                      <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                        {campo.label} {campo.obrigatorio && <span className="text-rose-500">*</span>}
                      </label>

                      {campo.tipo === 'TEXTO_CURTO' && (
                        <input
                          type="text"
                          required={campo.obrigatorio}
                          placeholder={campo.placeholder}
                          value={respostasCustom[campo.id_campo] || ''}
                          onChange={(e) => handleCustomChange(campo.id_campo, e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                        />
                      )}

                      {campo.tipo === 'TEXTO_LONGO' && (
                        <textarea
                          rows={2}
                          required={campo.obrigatorio}
                          placeholder={campo.placeholder}
                          value={respostasCustom[campo.id_campo] || ''}
                          onChange={(e) => handleCustomChange(campo.id_campo, e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                        />
                      )}

                      {campo.tipo === 'SELECAO_UNICA' && (
                        <select
                          required={campo.obrigatorio}
                          value={respostasCustom[campo.id_campo] || ''}
                          onChange={(e) => handleCustomChange(campo.id_campo, e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                        >
                          <option value="">Selecione uma opção...</option>
                          {campo.opcoes?.map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                      )}

                      {campo.tipo === 'SIM_NAO' && (
                        <div className="flex items-center gap-4 pt-1">
                          <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                            <input
                              type="radio"
                              name={campo.id_campo}
                              value="SIM"
                              checked={respostasCustom[campo.id_campo] === 'SIM'}
                              onChange={() => handleCustomChange(campo.id_campo, 'SIM')}
                              className="text-orange-600 focus:ring-0"
                            />
                            <span>Sim</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                            <input
                              type="radio"
                              name={campo.id_campo}
                              value="NAO"
                              checked={respostasCustom[campo.id_campo] === 'NAO'}
                              onChange={() => handleCustomChange(campo.id_campo, 'NAO')}
                              className="text-orange-600 focus:ring-0"
                            />
                            <span>Não</span>
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Consentimento LGPD */}
              <div className="flex items-start gap-2 pt-2">
                <input
                  type="checkbox"
                  id="chk-lgpd"
                  required
                  checked={lgpdAceito}
                  onChange={(e) => setLgpdAceito(e.target.checked)}
                  className="rounded bg-neutral-100 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 text-orange-600 focus:ring-0 mt-0.5"
                />
                <label htmlFor="chk-lgpd" className="text-[11px] text-neutral-500 dark:text-neutral-400 cursor-pointer leading-tight">
                  {termosLgpd ||
                    'Autorizo a coleta e tratamento dos meus dados para fins de confirmação e realização deste atendimento.'}
                </label>
              </div>

              {/* Mensagem de Erro se houver */}
              {erroMsg && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{erroMsg}</span>
                </div>
              )}

              {/* Botão de Confirmação Responsivo */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 sm:py-4 px-6 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold shadow-lg shadow-orange-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Verificando Vagas e Gravando...</span>
                ) : (
                  <>
                    <span>Confirmar Agendamento</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
        </>
        )}

        {/* Rodapé da Página Pública — Dados da Empresa (Cadastrados em Configurações) */}
        <footer className="w-full pt-4 pb-8 sm:pb-12 text-neutral-600 dark:text-neutral-400 text-xs">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 shadow-xs space-y-4 sm:space-y-5 transition-colors">
            {/* Top: Logo da Empresa, Nome e Contatos */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 sm:gap-4">
              <div className="flex items-center gap-3">
                {empresaLogo ? (
                  <img
                    src={empresaLogo}
                    alt={empresaNome}
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl object-cover border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xs shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-orange-600 text-white font-bold text-sm sm:text-base flex items-center justify-center shadow-xs shrink-0">
                    {empresaNome.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white truncate">
                    {empresaNome}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-neutral-500 dark:text-neutral-400">
                    Atendimento Oficial &amp; Agendamento
                  </p>
                </div>
              </div>

              {/* Contatos Responsivos: full-width no mobile, inline no tablet/notebook */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                {empresaWhatsapp && (
                  <a
                    href={gerarLinkWhatsApp(empresaWhatsapp, `Olá! Gostaria de informações sobre os atendimentos do ${empresaNome}.`)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 sm:py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-emerald-700 dark:text-emerald-300 font-semibold flex items-center justify-center gap-1.5 transition-colors text-xs active:scale-[0.99]"
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span>WhatsApp: {formatarTelefoneBR(empresaWhatsapp)}</span>
                  </a>
                )}

                {empresaEmail && (
                  <a
                    href={`mailto:${empresaEmail}`}
                    className="px-3 py-2 sm:py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-xl text-neutral-700 dark:text-neutral-300 flex items-center justify-center gap-1.5 transition-colors font-medium text-xs active:scale-[0.99]"
                  >
                    <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="truncate">{empresaEmail}</span>
                  </a>
                )}
              </div>
            </div>

            {/* Endereço / CNPJ */}
            {(empresaEndereco || empresaCnpj) && (
              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                {empresaEndereco && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span>{empresaEndereco}</span>
                  </div>
                )}
                {empresaCnpj && (
                  <span className="font-mono text-neutral-400">
                    CNPJ: {empresaCnpj}
                  </span>
                )}
              </div>
            )}

            {/* Termos & Selo Seguro */}
            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10px] text-neutral-400 dark:text-neutral-500">
              <p>
                © {new Date().getFullYear()} {empresaNome}. Todos os direitos reservados.
              </p>
              <div className="flex items-center gap-1.5 text-neutral-500 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Ambiente Seguro · Agenda Ativa</span>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Modal Autoatendimento: Consultar / Cancelar / Remarcar Agendamento por Protocolo */}
      {selfServiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-orange-500" />
                <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">
                  Consultar, Cancelar ou Remarcar
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelfServiceOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBuscarProtocolo} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Número do Protocolo *
                </label>
                <input
                  type="text"
                  required
                  value={ssProtocolo}
                  onChange={(e) => setSsProtocolo(e.target.value.toUpperCase())}
                  placeholder="Ex: PROT-20261113-ABCD"
                  className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  WhatsApp ou E-mail cadastrado *
                </label>
                <input
                  type="text"
                  required
                  value={ssContato}
                  onChange={(e) => setSsContato(e.target.value)}
                  placeholder="Ex: 11999998888 ou seu@email.com"
                  className="w-full px-3 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Localizar Agendamento</span>
              </button>
            </form>

            {ssErro && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{ssErro}</span>
              </div>
            )}

            {ssSucesso && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{ssSucesso}</span>
              </div>
            )}

            {ssResultado && (
              <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-neutral-900 dark:text-white">{ssResultado.evento.nome}</strong>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
                    {ssResultado.agendamento.status}
                  </span>
                </div>
                <p className="text-neutral-600 dark:text-neutral-400">
                  Participante: <strong>{ssResultado.lead.nome}</strong> · Data atual:{' '}
                  <strong className="font-mono">
                    {formatarDataBR(ssResultado.agendamento.data_agendamento)} às {ssResultado.agendamento.hora_inicio}
                  </strong>
                </p>

                {ssResultado.agendamento.status !== 'CANCELADO' && ssResultado.evento.permite_cancelamento && (
                  <div className="space-y-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="space-y-2">
                      <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                        Remarcar para nova data e horário:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={ssRemarcarData}
                          onChange={(e) => {
                            setSsRemarcarData(e.target.value);
                            setSsRemarcarSlot(null);
                          }}
                          className="px-2.5 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                        >
                          <option value="">Nova data...</option>
                          {proximasDatas.map((d) => (
                            <option key={d.dataIso} value={d.dataIso}>
                              {formatarDataBR(d.dataIso)} ({d.rotulo})
                            </option>
                          ))}
                        </select>

                        <select
                          disabled={!ssRemarcarData}
                          value={ssRemarcarSlot ? `${ssRemarcarSlot.horaInicio}|${ssRemarcarSlot.horaFim}` : ''}
                          onChange={(e) => {
                            const [hi, hf] = e.target.value.split('|');
                            setSsRemarcarSlot(hi ? { horaInicio: hi, horaFim: hf || hi } : null);
                          }}
                          className="px-2.5 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                        >
                          <option value="">Novo horário...</option>
                          {ssSlotsRemarcacao
                            .filter((s) => s.disponivel)
                            .map((s) => (
                              <option key={s.hora_inicio} value={`${s.hora_inicio}|${s.hora_fim}`}>
                                {s.hora_inicio} ({s.vagas_restantes} vagas)
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={ssBusy || !ssRemarcarData || !ssRemarcarSlot}
                        onClick={handleRemarcarProtocolo}
                        className="flex-1 py-2 px-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl font-semibold cursor-pointer"
                      >
                        {ssBusy ? 'Processando...' : 'Confirmar Remarcação'}
                      </button>

                      <button
                        type="button"
                        disabled={ssBusy}
                        onClick={handleCancelarProtocolo}
                        className="py-2 px-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancelar Vaga</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
