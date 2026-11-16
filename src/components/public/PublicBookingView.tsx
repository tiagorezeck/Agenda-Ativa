import React, { useState, useMemo, useEffect } from 'react';
import { storage } from '../../services/storageService';
import { isCloudActive } from '../../services/driveSyncService';
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
  ChevronRight,
  Check,
  Mail,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Search,
  XCircle,
  CalendarClock,
  X,
  Tag,
  LogOut,
  Loader2
} from 'lucide-react';

interface PublicBookingViewProps {
  initialSlug?: string;
  initialThankYouClosed?: boolean;
  onSelectSlug?: (slug: string) => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const PublicBookingView: React.FC<PublicBookingViewProps> = ({
  initialSlug,
  initialThankYouClosed = false,
  onSelectSlug,
  theme = 'dark',
  onToggleTheme
}) => {
  const [, setSyncTick] = useState(0);

  useEffect(() => {
    const unsub = storage.subscribe(() => setSyncTick((t) => t + 1));
    return unsub;
  }, []);

  const db = storage.getDatabase();
  const cloudState = storage.getCloudState();
  const cloudConnected = isCloudActive();
  const eventos = db.eventos;

  // Seleção de Evento
  const [selectedSlug, setSelectedSlug] = useState<string>(
    initialSlug || eventos[0]?.slug || ''
  );

  useEffect(() => {
    if (initialSlug !== undefined && initialSlug !== '' && initialSlug !== selectedSlug) {
      setSelectedSlug(initialSlug);
    } else if (!selectedSlug && !initialSlug && eventos.length > 0) {
      setSelectedSlug(eventos[0].slug);
    }
  }, [initialSlug, eventos, selectedSlug]);

  const handleChangeSelectedSlug = (nextSlug: string) => {
    setSelectedSlug(nextSlug);
    setEtapaAtual(1);
    setDataSelecionada('');
    setSlotSelecionado(null);
    setLocalResposta('');
    setLocalOutro('');
    onSelectSlug?.(nextSlug);
  };

  const eventoAtual = useMemo(() => {
    if (selectedSlug) {
      const normalizedSlug = selectedSlug.trim().toLowerCase();
      const match = eventos.find(
        e => e.slug.toLowerCase() === normalizedSlug || e.id_evento.toLowerCase() === normalizedSlug
      );
      if (match) return match;
    }
    if (initialSlug) {
      return null;
    }
    return eventos[0] || null;
  }, [eventos, selectedSlug, initialSlug]);

  // Informações da Empresa (Cadastradas em Configurações)
  const empresaNome = db.config.find(c => c.chave === 'EMPRESA_NOME')?.valor || 'Agenda Ativa';
  const empresaLogo = db.config.find(c => c.chave === 'EMPRESA_LOGO')?.valor || '';
  const empresaWhatsapp = db.config.find(c => c.chave === 'WHATSAPP_CONTATO')?.valor || '';
  const empresaEmail = db.config.find(c => c.chave === 'EMPRESA_EMAIL')?.valor || '';
  const empresaEndereco = db.config.find(c => c.chave === 'EMPRESA_ENDERECO')?.valor || '';
  const empresaCnpj = db.config.find(c => c.chave === 'EMPRESA_CNPJ')?.valor || '';
  const termosLgpd = db.config.find(c => c.chave === 'TERMOS_LGPD')?.valor || '';

  const [logoErro, setLogoErro] = useState(false);
  const [eventoImgErro, setEventoImgErro] = useState(false);

  useEffect(() => {
    setLogoErro(false);
  }, [empresaLogo]);

  useEffect(() => {
    setEventoImgErro(false);
  }, [eventoAtual?.imagem_url]);

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

  // Estado de Submissão, Agradecimento (5s) e Encerramento
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [resultadoSucesso, setResultadoSucesso] = useState<BookingSuccessResult | null>(null);
  const [thankYouSecondsLeft, setThankYouSecondsLeft] = useState<number>(5);
  const [thankYouExited, setThankYouExited] = useState<boolean>(initialThankYouClosed);

  useEffect(() => {
    if (initialThankYouClosed) {
      setThankYouExited(true);
    }
  }, [initialThankYouClosed]);

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

  // Handler ao selecionar dia: salva e abre horários
  const handleSelectData = (iso: string) => {
    setDataSelecionada(iso);
    setSlotSelecionado(null);
    setEtapaAtual(2);
    setErroMsg(null);
  };

  // Handler ao selecionar horário: salva e abre formulário
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
      setThankYouExited(false);
      setThankYouSecondsLeft(5);
      setResultadoSucesso(result);
      window.history.replaceState(
        {},
        '',
        `/agendar/${encodeURIComponent(eventoAtual.slug)}/obrigado${window.location.search}`
      );
    } catch (err: any) {
      setErroMsg(err.message || 'Erro ao realizar agendamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConcluirESair = () => {
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
    setThankYouExited(true);
    window.history.replaceState({}, '', '/obrigado');
    try {
      window.close();
    } catch {
      // Navegadores podem bloquear window.close() se a aba não foi aberta externamente
    }
  };

  useEffect(() => {
    if (!resultadoSucesso || thankYouExited) return;
    if (thankYouSecondsLeft <= 0) {
      handleConcluirESair();
      return;
    }
    const timer = window.setTimeout(() => {
      setThankYouSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resultadoSucesso, thankYouExited, thankYouSecondsLeft]);

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

  // --- TELA FINAL APÓS SAIR (SESSÃO ENCERRADA, SEM ACESSO AO SISTEMA) ---
  if (thankYouExited) {
    return (
      <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 py-6 sm:py-12 px-4 sm:px-6 flex items-center justify-center text-neutral-900 dark:text-neutral-100 transition-colors">
        <div className="max-w-md w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Obrigado pelo seu agendamento!
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Seu atendimento foi registrado com sucesso e esta página foi encerrada com segurança. Você já pode fechar esta guia.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              try {
                window.close();
              } catch {
                // Sem ação adicional se navegador bloquear fechamento automático
              }
            }}
            className="w-full py-3 px-4 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Fechar esta página</span>
          </button>

          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 leading-relaxed">
            {empresaNome} · Sessão independente encerrada. Caso o navegador não feche a guia automaticamente, basta fechá-la manualmente.
          </p>
        </div>
      </div>
    );
  }

  // --- PÁGINA DE AGRADECIMENTO COM SAÍDA AUTOMÁTICA EM 5 SEGUNDOS ---
  if (resultadoSucesso) {
    const primeiroNome = nome.trim().split(/\s+/)[0] || 'Cliente';
    const progressPercent = Math.max(0, Math.min(100, (thankYouSecondsLeft / 5) * 100));
    const linkWhatsAppConfirmacao = gerarLinkWhatsApp(
      db.config.find(c => c.chave === 'WHATSAPP_CONTATO')?.valor || '5511999998888',
      `Olá! Meu nome é *${nome}* e acabei de confirmar meu agendamento para o evento *${resultadoSucesso.evento_nome}* no dia *${formatarDataBR(resultadoSucesso.data)}* às *${resultadoSucesso.hora_inicio}*.\n\nMeu Protocolo é: *${resultadoSucesso.protocolo}*.`
    );

    return (
      <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 py-6 sm:py-10 px-4 sm:px-6 flex items-center justify-center text-neutral-900 dark:text-neutral-100 transition-colors">
        <div className="max-w-lg w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Obrigado pelo seu agendamento, {primeiroNome}!
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Sua vaga foi reservada com sucesso. Guarde o protocolo abaixo para referência.
            </p>
          </div>

          <div className="py-3 px-4 border-y border-neutral-200 dark:border-neutral-800 space-y-1">
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium block">
              Número do Protocolo
            </span>
            <p className="text-lg font-bold font-mono tabular-nums text-orange-600 dark:text-orange-400 tracking-wider">
              {resultadoSucesso.protocolo}
            </p>
          </div>

          <div className="text-left text-xs space-y-2 text-neutral-700 dark:text-neutral-300">
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-500 dark:text-neutral-400 shrink-0">Evento:</span>
              <strong className="text-neutral-900 dark:text-white text-right truncate">
                {resultadoSucesso.evento_nome}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-500 dark:text-neutral-400 shrink-0">Data e Horário:</span>
              <strong className="font-mono tabular-nums text-neutral-900 dark:text-white text-right">
                {formatarDataBR(resultadoSucesso.data)} às {resultadoSucesso.hora_inicio}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-500 dark:text-neutral-400 shrink-0">Participante:</span>
              <span className="text-neutral-900 dark:text-white text-right truncate">{nome}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-500 dark:text-neutral-400 shrink-0">WhatsApp:</span>
              <span className="font-mono tabular-nums text-neutral-900 dark:text-white">{formatarTelefoneBR(whatsapp)}</span>
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

          <div className="p-3.5 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 rounded-xl text-left text-xs text-orange-900 dark:text-orange-200">
            <p className="font-semibold mb-1">Orientações do Atendimento</p>
            <p className="leading-relaxed">{resultadoSucesso.mensagem_confirmacao}</p>
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-600 dark:text-neutral-400">
                Saindo automaticamente em:
              </span>
              <span className="font-mono tabular-nums font-bold text-orange-600 dark:text-orange-400">
                {thankYouSecondsLeft}s
              </span>
            </div>
            <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-1000 ease-linear"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            {empresaWhatsapp && (
              <a
                href={linkWhatsAppConfirmacao}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Enviar Comprovante pelo WhatsApp</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleConcluirESair}
              className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Concluir e Sair Agora</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- TELA INICIAL DE CARREGAMENTO (ANTES DE EXIBIR OS DADOS DO EVENTO) ---
  const isInitialLoading =
    cloudState.bootstrapping ||
    (cloudConnected && !cloudState.loadedFromCloud && !cloudState.lastError);

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 px-4 flex items-center justify-center text-neutral-900 dark:text-neutral-100 transition-colors">
        <div className="max-w-sm w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/60 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
              Carregando agenda do evento
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Buscando datas, horários e vagas disponíveis em tempo real...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- FLUXO PRINCIPAL: TELA ÚNICA SEM ROLAGEM NO NOTEBOOK E TABLET, RESPONSIVO NO MOBILE ---
  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col transition-colors">
      {/* Top Bar Limpa e Compacta (3 zonas: Marca / Ações) */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {empresaLogo && !logoErro ? (
            <img
              src={empresaLogo}
              alt={empresaNome}
              referrerPolicy="no-referrer"
              onError={() => setLogoErro(true)}
              className="w-8 h-8 rounded-lg object-cover border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-orange-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {empresaNome.charAt(0).toUpperCase()}
            </div>
          )}

          <span className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white whitespace-nowrap truncate">
            {empresaNome}
          </span>

          {!initialSlug && eventos.length > 1 && (
            <select
              value={selectedSlug}
              onChange={(e) => handleChangeSelectedSlug(e.target.value)}
              className="ml-2 px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-lg text-xs text-neutral-800 dark:text-neutral-200 max-w-[160px] sm:max-w-[220px] truncate focus:outline-none focus:border-orange-500"
            >
              {eventos.map(ev => (
                <option key={ev.slug} value={ev.slug}>
                  {ev.nome}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setSelfServiceOpen(true);
              setSsErro(null);
              setSsSucesso(null);
            }}
            className="px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:border-orange-500 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CalendarClock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span>Meus Agendamentos</span>
          </button>

          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
              className="px-2.5 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="hidden sm:inline">Escuro</span>
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Área Central Principal (Largura Ampla Notebook + Tablet em Tela Única) */}
      <main className="flex-1 min-h-0 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-3 md:pb-4 flex flex-col">
        {!eventoAtual ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="max-w-lg w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 sm:p-10 text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 mx-auto flex items-center justify-center">
                <Calendar className="w-6 h-6" />
              </div>

              {!cloudConnected ? (
                <div className="space-y-1.5">
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                    Agendamento temporariamente indisponível
                  </h2>
                  <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Não foi possível carregar a agenda no momento. Por favor, tente novamente em instantes ou entre em contato pelos canais da empresa.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                    {selectedSlug ? `Evento "${selectedSlug}" não encontrado` : 'Nenhum evento publicado no momento'}
                  </h2>
                  <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                    {cloudState.lastError
                      ? `Falha ao consultar a agenda: ${cloudState.lastError}`
                      : 'Verifique se o link está correto ou entre em contato com o atendimento.'}
                  </p>
                </div>
              )}

              {!initialSlug && eventos.length > 0 && (
                <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 font-medium">
                    Eventos disponíveis no momento:
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {eventos.map((ev) => (
                      <button
                        key={ev.id_evento}
                        type="button"
                        onClick={() => handleChangeSelectedSlug(ev.slug)}
                        className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-orange-50 dark:hover:bg-orange-950 border border-neutral-200 dark:border-neutral-700 text-xs rounded-lg font-medium text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer"
                      >
                        {ev.nome}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm grid grid-cols-1 md:grid-cols-12 overflow-hidden">
            {/* COLUNA ESQUERDA: Identidade do Evento + Resumo + Contatos */}
            <aside className="md:col-span-5 lg:col-span-4 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800 p-5 sm:p-6 lg:p-7 flex flex-col justify-between gap-4 md:overflow-y-auto bg-neutral-50/70 dark:bg-neutral-950/30">
              <div className="space-y-4">
                {/* Bloco Logo + Título do Evento */}
                <div className="flex items-center gap-3.5">
                  {eventoAtual.imagem_url && !eventoImgErro ? (
                    <img
                      src={eventoAtual.imagem_url}
                      alt={eventoAtual.nome}
                      referrerPolicy="no-referrer"
                      onError={() => setEventoImgErro(true)}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border border-neutral-200 dark:border-neutral-800 shrink-0 bg-white dark:bg-neutral-900"
                    />
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-orange-600 text-white font-bold text-xl flex items-center justify-center shrink-0">
                      {eventoAtual.nome.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                      <span>Agendamento Online</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{eventoAtual.duracao_minutos} min</span>
                    </div>
                    <h1 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white leading-snug text-balance">
                      {eventoAtual.nome}
                    </h1>
                  </div>
                </div>

                {/* Descrição */}
                <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  {eventoAtual.descricao || 'Selecione a data e o horário desejado para confirmar seu atendimento.'}
                </p>

                {/* Produto / Valor Atrelado (se habilitado) */}
                {eventoAtual.exibir_produto_publico && (eventoAtual.produto_nome || (eventoAtual.produto_valor && eventoAtual.produto_valor > 0)) && (
                  <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-200 font-medium min-w-0">
                      <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">{eventoAtual.produto_nome || eventoAtual.nome}</span>
                    </div>
                    {eventoAtual.produto_valor && eventoAtual.produto_valor > 0 ? (
                      <div className="text-right font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                        {eventoAtual.produto_parcelas && eventoAtual.produto_parcelas > 1 && eventoAtual.produto_valor_mensal && eventoAtual.produto_valor_mensal > 0
                          ? `${eventoAtual.produto_parcelas}x ${formatarMoedaBRL(eventoAtual.produto_valor_mensal)}`
                          : formatarMoedaBRL(eventoAtual.produto_valor)}
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Resumo Dinâmico da Escolha do Cliente */}
                {(dataSelecionada || slotSelecionado) && (
                  <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2 text-xs">
                    <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                      Resumo da seleção
                    </p>
                    {dataSelecionada && (
                      <div className="flex items-center justify-between gap-2 text-neutral-600 dark:text-neutral-300">
                        <span className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
                          <Calendar className="w-3.5 h-3.5 text-orange-500" />
                          <span>Data:</span>
                        </span>
                        <strong className="font-mono tabular-nums text-neutral-900 dark:text-white">
                          {formatarDataBR(dataSelecionada)}
                        </strong>
                      </div>
                    )}
                    {slotSelecionado && (
                      <div className="flex items-center justify-between gap-2 text-neutral-600 dark:text-neutral-300">
                        <span className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
                          <Clock className="w-3.5 h-3.5 text-orange-500" />
                          <span>Horário:</span>
                        </span>
                        <strong className="font-mono tabular-nums text-neutral-900 dark:text-white">
                          {slotSelecionado.horaInicio} às {slotSelecionado.horaFim}
                        </strong>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Informações da Empresa (Compactas na Barra Lateral) */}
              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-2.5 text-xs">
                <div className="flex flex-wrap gap-2">
                  {empresaWhatsapp && (
                    <a
                      href={gerarLinkWhatsApp(empresaWhatsapp, `Olá! Gostaria de informações sobre ${eventoAtual.nome} (${empresaNome}).`)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/80 rounded-lg text-emerald-700 dark:text-emerald-300 font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-mono tabular-nums">{formatarTelefoneBR(empresaWhatsapp)}</span>
                    </a>
                  )}

                  {empresaEmail && (
                    <a
                      href={`mailto:${empresaEmail}`}
                      className="px-3 py-1.5 bg-white hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-1.5 transition-colors truncate max-w-full"
                    >
                      <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span className="truncate">{empresaEmail}</span>
                    </a>
                  )}
                </div>

                {(empresaEndereco || empresaCnpj) && (
                  <div className="space-y-1 text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug">
                    {empresaEndereco && (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                        <span>{empresaEndereco}</span>
                      </div>
                    )}
                    {empresaCnpj && (
                      <p className="font-mono tabular-nums text-neutral-400 dark:text-neutral-500">
                        CNPJ: {empresaCnpj}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </aside>

            {/* COLUNA DIREITA: Fluxo Interativo de Agendamento */}
            <section className="md:col-span-7 lg:col-span-8 p-5 sm:p-6 lg:p-8 flex flex-col min-h-0">
              {/* Stepper Horizontal em Linha Única */}
              <div className="pb-4 mb-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEtapaAtual(1)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                    etapaAtual === 1
                      ? 'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 font-semibold border border-orange-200 dark:border-orange-800/70'
                      : dataSelecionada
                      ? 'bg-neutral-50 dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-transparent'
                      : 'text-neutral-400 dark:text-neutral-500 border border-transparent'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      dataSelecionada ? 'bg-emerald-600 text-white' : 'bg-orange-600 text-white'
                    }`}
                  >
                    {dataSelecionada ? <Check className="w-3 h-3" /> : '1'}
                  </span>
                  <span>1. Data</span>
                </button>

                <button
                  type="button"
                  disabled={!dataSelecionada}
                  onClick={() => setEtapaAtual(2)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                    etapaAtual === 2
                      ? 'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 font-semibold border border-orange-200 dark:border-orange-800/70 cursor-pointer'
                      : slotSelecionado
                      ? 'bg-neutral-50 dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-transparent cursor-pointer'
                      : 'text-neutral-400 dark:text-neutral-600 opacity-60 cursor-not-allowed border border-transparent'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      slotSelecionado
                        ? 'bg-emerald-600 text-white'
                        : etapaAtual === 2
                        ? 'bg-orange-600 text-white'
                        : 'bg-neutral-300 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-300'
                    }`}
                  >
                    {slotSelecionado ? <Check className="w-3 h-3" /> : '2'}
                  </span>
                  <span>2. Horário</span>
                </button>

                <button
                  type="button"
                  disabled={!slotSelecionado}
                  onClick={() => setEtapaAtual(3)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                    etapaAtual === 3
                      ? 'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 font-semibold border border-orange-200 dark:border-orange-800/70 cursor-pointer'
                      : 'text-neutral-400 dark:text-neutral-600 opacity-60 cursor-not-allowed border border-transparent'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      etapaAtual === 3
                        ? 'bg-orange-600 text-white'
                        : 'bg-neutral-300 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-300'
                    }`}
                  >
                    3
                  </span>
                  <span>3. Dados</span>
                </button>
              </div>

              {/* Conteúdo da Etapa Ativa */}
              <div className="flex-1 min-h-0 md:overflow-y-auto pr-0.5">
                {eventoAtual.status !== 'PUBLICADO' ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-8 space-y-3">
                    <AlertCircle className="w-10 h-10 text-amber-500" />
                    <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
                      Agendamentos temporariamente indisponíveis
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-md">
                      Este evento está com status <strong>{eventoAtual.status}</strong> no momento. Entre em contato pelos canais ao lado para mais informações.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* ETAPA 1: DATA */}
                    {etapaAtual === 1 && (
                      <div className="space-y-4">
                        <div>
                          <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                            Selecione o Dia do Atendimento
                          </h2>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                            Clique na data desejada para ver os horários disponíveis.
                          </p>
                        </div>

                        {proximasDatas.length === 0 ? (
                          <div className="p-6 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-center space-y-1.5">
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
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {proximasDatas.map((item) => {
                              const isSelected = dataSelecionada === item.dataIso;
                              return (
                                <button
                                  type="button"
                                  key={item.dataIso}
                                  onClick={() => handleSelectData(item.dataIso)}
                                  className={`p-3.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center min-h-[84px] cursor-pointer ${
                                    isSelected
                                      ? 'bg-orange-600 border-orange-600 text-white shadow-sm'
                                      : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:border-orange-500 hover:bg-orange-50/60 dark:hover:bg-neutral-900'
                                  }`}
                                >
                                  <span className="text-[11px] font-medium opacity-80">
                                    {item.rotulo}
                                  </span>
                                  <span className="text-lg font-bold font-mono tabular-nums mt-0.5">
                                    {formatarDataBR(item.dataIso).slice(0, 5)}
                                  </span>
                                  <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-white/80' : 'text-neutral-500 dark:text-neutral-400'}`}>
                                    {item.diaSemana}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ETAPA 2: HORÁRIO */}
                    {etapaAtual === 2 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white tracking-tight truncate">
                              Horários para {formatarDataBR(dataSelecionada)}
                            </h2>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                              Escolha o melhor horário com vagas livres.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setEtapaAtual(1)}
                            className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Trocar Dia</span>
                          </button>
                        </div>

                        {slotsDaData.length === 0 ? (
                          <div className="p-6 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-center space-y-2">
                            <Calendar className="w-8 h-8 text-neutral-400 mx-auto" />
                            <p className="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                              Nenhum horário disponível para esta data.
                            </p>
                            <button
                              type="button"
                              onClick={() => setEtapaAtual(1)}
                              className="mt-1 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Escolher Outro Dia
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                                  className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between min-h-[68px] ${
                                    esgotado
                                      ? 'bg-neutral-100 dark:bg-neutral-950/40 border-neutral-200 dark:border-neutral-800/40 opacity-45 cursor-not-allowed'
                                      : isSelected
                                      ? 'bg-orange-600 border-orange-600 text-white shadow-sm cursor-pointer'
                                      : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-neutral-900 cursor-pointer'
                                  }`}
                                >
                                  <div className="space-y-0.5">
                                    <span className="text-sm font-bold font-mono tabular-nums block">
                                      {slot.hora_inicio} – {slot.hora_fim}
                                    </span>
                                    <span className="text-[11px] block">
                                      {esgotado ? (
                                        <span className="text-rose-500 font-semibold">
                                          {slot.bloqueado ? 'Bloqueado' : 'Esgotado'}
                                        </span>
                                      ) : (
                                        <span className={isSelected ? 'text-white/90 font-mono tabular-nums' : 'text-emerald-600 dark:text-emerald-400 font-mono tabular-nums'}>
                                          {slot.vagas_restantes} vaga{slot.vagas_restantes !== 1 ? 's' : ''}
                                        </span>
                                      )}
                                    </span>
                                  </div>

                                  {!esgotado && (
                                    <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-orange-500'}`} />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ETAPA 3: FORMULÁRIO */}
                    {etapaAtual === 3 && slotSelecionado && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                              Complete seus Dados
                            </h2>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono tabular-nums mt-0.5">
                              {formatarDataBR(dataSelecionada)} · {slotSelecionado.horaInicio} às {slotSelecionado.horaFim}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setEtapaAtual(2)}
                            className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Trocar Horário</span>
                          </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-3.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
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
                                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-orange-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                                E-mail
                              </label>
                              <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="seuemail@exemplo.com"
                                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
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
                                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                              />
                            </div>
                          </div>

                          {/* Pergunta de Local / Campanha */}
                          {eventoAtual.solicitar_local && (
                            <div className="space-y-2 pt-1">
                              <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                                <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                <span>{eventoAtual.label_local || 'De qual escola, bairro ou local você veio?'}</span>
                                <span className="text-rose-500">*</span>
                              </label>

                              {Array.isArray(eventoAtual.local_opcoes) && eventoAtual.local_opcoes.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <select
                                    required
                                    value={localResposta}
                                    onChange={(e) => setLocalResposta(e.target.value)}
                                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
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
                                      placeholder="Digite o nome do local..."
                                      className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
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
                                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                                />
                              )}
                            </div>
                          )}

                          {/* Perguntas Dinâmicas */}
                          {camposDoEvento.length > 0 && (
                            <div className="space-y-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                              <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                                Informações adicionais
                              </p>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {camposDoEvento.map((campo) => (
                                  <div
                                    key={campo.id_campo}
                                    className={`space-y-1 ${campo.tipo === 'TEXTO_LONGO' ? 'sm:col-span-2' : ''}`}
                                  >
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
                                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                                      />
                                    )}

                                    {campo.tipo === 'TEXTO_LONGO' && (
                                      <textarea
                                        rows={2}
                                        required={campo.obrigatorio}
                                        placeholder={campo.placeholder}
                                        value={respostasCustom[campo.id_campo] || ''}
                                        onChange={(e) => handleCustomChange(campo.id_campo, e.target.value)}
                                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                                      />
                                    )}

                                    {campo.tipo === 'SELECAO_UNICA' && (
                                      <select
                                        required={campo.obrigatorio}
                                        value={respostasCustom[campo.id_campo] || ''}
                                        onChange={(e) => handleCustomChange(campo.id_campo, e.target.value)}
                                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
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
                                      <div className="flex items-center gap-4 pt-1.5">
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
                            </div>
                          )}

                          {/* LGPD */}
                          <div className="flex items-start gap-2 pt-1">
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

                          {erroMsg && (
                            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0" />
                              <span>{erroMsg}</span>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3 px-6 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Verificando Vagas e Confirmando...</span>
                              </>
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
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Rodapé Discreto em 1 Linha */}
      <footer className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-3 pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400 dark:text-neutral-500 shrink-0">
        <span>
          © {new Date().getFullYear()} {empresaNome}
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500 shrink-0" />
          <span>Agendamento seguro</span>
        </span>
      </footer>

      {/* Modal Autoatendimento: Consultar / Cancelar / Remarcar Agendamento por Protocolo */}
      {selfServiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
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
                  <span className="font-mono text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                    {ssResultado.agendamento.status}
                  </span>
                </div>
                <p className="text-neutral-600 dark:text-neutral-400">
                  Participante: <strong>{ssResultado.lead.nome}</strong> · Data atual:{' '}
                  <strong className="font-mono tabular-nums">
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
