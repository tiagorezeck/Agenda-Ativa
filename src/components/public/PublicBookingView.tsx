import React, { useState, useMemo, useEffect, useRef } from 'react';
import { storage } from '../../services/storageService';
import { isCloudActive } from '../../services/driveSyncService';
import { BookingSubmissionPayload, BookingSuccessResult, WaitlistSuccessResult } from '../../types/api';
import { EventoEntity } from '../../types/database';
import {
  formatarDataBR,
  formatarMoedaBRL,
  formatarTelefoneBR,
  aplicarMascaraTelefoneBR,
  isTelefoneBRValido,
  sanitizarEmailInput,
  isEmailValido,
  gerarLinkWhatsApp
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
  Loader2,
  BellRing,
  LayoutGrid,
  PauseCircle
} from 'lucide-react';

interface PublicBookingViewProps {
  initialSlug?: string;
  initialThankYouClosed?: boolean;
  onSelectSlug?: (slug: string) => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

interface SavedPublicBooking {
  protocolo: string;
  contato: string;
  nome: string;
  email: string;
  whatsapp: string;
  local?: string;
  evento_nome: string;
  slug_evento: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  criado_em: string;
}

const SAVED_BOOKINGS_KEY = 'agenda_ativa_public_bookings_v1';
const SAVED_LEAD_PROFILE_KEY = 'agenda_ativa_public_lead_profile_v1';

const recentEventVisitTimestamps = new Map<string, number>();

function readSavedPublicBookings(): SavedPublicBooking[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SAVED_BOOKINGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSavedPublicBookings(list: SavedPublicBooking[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SAVED_BOOKINGS_KEY, JSON.stringify(list.slice(0, 12)));
  } catch {
    // ignore
  }
}

function readSavedLeadProfile(): { nome: string; whatsapp: string; email: string; local: string } {
  if (typeof window === 'undefined') return { nome: '', whatsapp: '', email: '', local: '' };
  try {
    const raw = localStorage.getItem(SAVED_LEAD_PROFILE_KEY);
    if (!raw) return { nome: '', whatsapp: '', email: '', local: '' };
    const p = JSON.parse(raw);
    return {
      nome: typeof p?.nome === 'string' ? p.nome : '',
      whatsapp: typeof p?.whatsapp === 'string' ? p.whatsapp : '',
      email: typeof p?.email === 'string' ? p.email : '',
      local: typeof p?.local === 'string' ? p.local : ''
    };
  } catch {
    return { nome: '', whatsapp: '', email: '', local: '' };
  }
}

function writeSavedLeadProfile(profile: { nome: string; whatsapp: string; email: string; local: string }) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SAVED_LEAD_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

export const PublicBookingView: React.FC<PublicBookingViewProps> = ({
  initialSlug,
  initialThankYouClosed = false,
  onSelectSlug,
  theme = 'dark',
  onToggleTheme
}) => {
  const [, setSyncTick] = useState(0);
  const trackedVisitsInMountRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsub = storage.subscribe(() => setSyncTick((t) => t + 1));
    return unsub;
  }, []);

  const db = storage.getDatabase();
  const cloudState = storage.getCloudState();
  const cloudConnected = isCloudActive();
  const eventos = db.eventos;

  const [selectedSlug, setSelectedSlug] = useState<string>(initialSlug || '');
  const [viewMode, setViewMode] = useState<'landing' | 'booking'>(() => {
    if (initialThankYouClosed) return 'landing';
    return initialSlug ? 'booking' : 'landing';
  });

  useEffect(() => {
    if (initialThankYouClosed) {
      setViewMode('landing');
      setSelectedSlug('');
      return;
    }
    if (initialSlug) {
      setSelectedSlug(initialSlug);
      setViewMode('booking');
    } else if (initialSlug === '') {
      setSelectedSlug('');
      setViewMode('landing');
    }
  }, [initialSlug, initialThankYouClosed]);

  // Meus Agendamentos salvos localmente (para acompanhamento automático na Landing Page)
  const [savedBookings, setSavedBookings] = useState<SavedPublicBooking[]>(() => readSavedPublicBookings());

  const initialLeadProfile = useMemo(() => readSavedLeadProfile(), []);

  // Etapas do Agendamento: 1 (Dia) -> 2 (Horário) -> 3 (Perguntas)
  const [etapaAtual, setEtapaAtual] = useState<1 | 2 | 3>(1);
  const [dataSelecionada, setDataSelecionada] = useState<string>('');
  const [slotSelecionado, setSlotSelecionado] = useState<{ horaInicio: string; horaFim: string } | null>(null);

  // Campos do Formulário de Agendamento
  const [nome, setNome] = useState(initialLeadProfile.nome);
  const [whatsapp, setWhatsapp] = useState(initialLeadProfile.whatsapp);
  const [email, setEmail] = useState(initialLeadProfile.email);
  const [localResposta, setLocalResposta] = useState('');
  const [localOutro, setLocalOutro] = useState('');
  const [respostasCustom, setRespostasCustom] = useState<Record<string, string>>({});
  const [lgpdAceito, setLgpdAceito] = useState(true);

  // Submissão & Página de Agradecimento (transição automática para a Landing Page)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [resultadoSucesso, setResultadoSucesso] = useState<BookingSuccessResult | null>(null);
  const [thankYouSecondsLeft, setThankYouSecondsLeft] = useState<number>(8);

  // Filtro da Landing Page Pública
  const [landingFilter, setLandingFilter] = useState<'TODOS' | 'DISPONIVEIS' | 'INDISPONIVEIS'>('TODOS');
  const [catalogImgErrors, setCatalogImgErrors] = useState<Record<string, boolean>>({});

  // Modal de Evento Indisponível + Cadastro na Lista de Espera
  const [waitlistEvent, setWaitlistEvent] = useState<EventoEntity | null>(null);
  const [wlNome, setWlNome] = useState(initialLeadProfile.nome);
  const [wlWhatsapp, setWlWhatsapp] = useState(initialLeadProfile.whatsapp);
  const [wlEmail, setWlEmail] = useState(initialLeadProfile.email);
  const [wlLocal, setWlLocal] = useState(initialLeadProfile.local);
  const [wlObservacao, setWlObservacao] = useState('');
  const [wlSubmitting, setWlSubmitting] = useState(false);
  const [wlErro, setWlErro] = useState<string | null>(null);
  const [wlSucesso, setWlSucesso] = useState<WaitlistSuccessResult | null>(null);

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

  const eventoAtual = useMemo(() => {
    if (!selectedSlug) return null;
    const normalizedSlug = selectedSlug.trim().toLowerCase();
    return (
      eventos.find(
        (e) => e.slug.toLowerCase() === normalizedSlug || e.id_evento.toLowerCase() === normalizedSlug
      ) || null
    );
  }, [eventos, selectedSlug]);

  const resumoEventoAtual = useMemo(() => {
    if (!eventoAtual) return null;
    return storage.getEventoDisponibilidadeResumo(eventoAtual);
  }, [eventoAtual, db.agendamentos, db.horarios, db.bloqueios]);

  // Contabiliza visita no link público quando abre diretamente um evento em modo booking
  useEffect(() => {
    if (cloudState.bootstrapping || viewMode !== 'booking' || !eventoAtual?.id_evento) return;
    const evId = eventoAtual.id_evento;
    if (trackedVisitsInMountRef.current.has(evId)) return;

    const now = Date.now();
    const lastTs = recentEventVisitTimestamps.get(evId) || 0;
    trackedVisitsInMountRef.current.add(evId);
    if (now - lastTs < 2500) return;

    recentEventVisitTimestamps.set(evId, now);
    storage.incrementEventoVisita(evId);
  }, [cloudState.bootstrapping, viewMode, eventoAtual?.id_evento]);

  // Informações da Empresa
  const empresaNome = db.config.find((c) => c.chave === 'EMPRESA_NOME')?.valor || 'Agenda Ativa';
  const empresaLogo = db.config.find((c) => c.chave === 'EMPRESA_LOGO')?.valor || '';
  const empresaWhatsapp = db.config.find((c) => c.chave === 'WHATSAPP_CONTATO')?.valor || '';
  const empresaEmail = db.config.find((c) => c.chave === 'EMPRESA_EMAIL')?.valor || '';
  const empresaEndereco = db.config.find((c) => c.chave === 'EMPRESA_ENDERECO')?.valor || '';
  const empresaCnpj = db.config.find((c) => c.chave === 'EMPRESA_CNPJ')?.valor || '';
  const termosLgpd = db.config.find((c) => c.chave === 'TERMOS_LGPD')?.valor || '';

  const [logoErro, setLogoErro] = useState(false);
  const [eventoImgErro, setEventoImgErro] = useState(false);

  useEffect(() => {
    setLogoErro(false);
  }, [empresaLogo]);

  useEffect(() => {
    setEventoImgErro(false);
  }, [eventoAtual?.imagem_url]);

  const handleOpenEventBooking = (slug: string) => {
    const targetEv = eventos.find((e) => e.slug === slug || e.id_evento === slug);
    if (targetEv) {
      const res = storage.getEventoDisponibilidadeResumo(targetEv);
      if (!res.disponivel && viewMode === 'landing') {
        handleOpenUnavailableModal(targetEv);
        return;
      }
    }
    setSelectedSlug(slug);
    setViewMode('booking');
    setEtapaAtual(1);
    setDataSelecionada('');
    setSlotSelecionado(null);
    setLocalResposta('');
    setLocalOutro('');
    setErroMsg(null);
    onSelectSlug?.(slug);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleEnterLandingPage = () => {
    setResultadoSucesso(null);
    setDataSelecionada('');
    setSlotSelecionado(null);
    setEtapaAtual(1);
    setLocalResposta('');
    setLocalOutro('');
    setRespostasCustom({});
    setErroMsg(null);
    setSelectedSlug('');
    setViewMode('landing');
    onSelectSlug?.('');
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', `/agendar${window.location.search}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenUnavailableModal = (ev: EventoEntity) => {
    const profile = readSavedLeadProfile();
    setWlNome((prev) => prev || nome || profile.nome);
    setWlWhatsapp((prev) => prev || whatsapp || profile.whatsapp);
    setWlEmail((prev) => prev || email || profile.email);
    setWlLocal((prev) => prev || profile.local);
    setWlObservacao('');
    setWlErro(null);
    setWlSucesso(null);
    setWaitlistEvent(ev);
  };

  // Campos Dinâmicos do Evento
  const camposDoEvento = useMemo(() => {
    if (!eventoAtual) return [];
    return db.campos_formulario
      .filter((c) => c.id_evento === eventoAtual.id_evento && c.ativo)
      .sort((a, b) => a.ordem - b.ordem);
  }, [eventoAtual, db.campos_formulario]);

  const proximasDatas = useMemo(() => {
    if (!eventoAtual) return [];
    return storage.getEventoProximasDatas(eventoAtual);
  }, [eventoAtual]);

  const slotsDaData = useMemo(() => {
    if (!eventoAtual || !dataSelecionada) return [];
    return storage.getDisponibilidade(eventoAtual.id_evento, dataSelecionada);
  }, [eventoAtual, dataSelecionada, resultadoSucesso, ssSucesso, db.agendamentos, db.bloqueios]);

  const ssDatasRemarcacao = useMemo(() => {
    if (!ssResultado) return [];
    return storage.getEventoProximasDatas(ssResultado.evento);
  }, [ssResultado]);

  const ssSlotsRemarcacao = useMemo(() => {
    if (!ssResultado || !ssRemarcarData) return [];
    return storage.getDisponibilidade(ssResultado.evento.id_evento, ssRemarcarData);
  }, [ssResultado, ssRemarcarData, ssSucesso]);

  const handleSelectData = (iso: string) => {
    setDataSelecionada(iso);
    setSlotSelecionado(null);
    setEtapaAtual(2);
    setErroMsg(null);
  };

  const handleSelectSlot = (slot: { horaInicio: string; horaFim: string }) => {
    setSlotSelecionado(slot);
    setEtapaAtual(3);
    setErroMsg(null);
  };

  const handleCustomChange = (campoId: string, val: string) => {
    setRespostasCustom((prev) => ({ ...prev, [campoId]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventoAtual || !dataSelecionada || !slotSelecionado) return;
    if (!nome.trim() || !whatsapp.trim()) {
      setErroMsg('Por favor, preencha o Nome e WhatsApp.');
      return;
    }

    if (!isTelefoneBRValido(whatsapp)) {
      setErroMsg('Informe um WhatsApp válido com DDD no padrão (XX) XXXXX-XXXX.');
      return;
    }

    if (email.trim() && !isEmailValido(email)) {
      setErroMsg('Informe um e-mail válido contendo @ (ex: seuemail@exemplo.com).');
      return;
    }

    const temOpcoesLocal = Boolean(
      Array.isArray(eventoAtual.local_opcoes) && eventoAtual.local_opcoes.length > 0
    );
    const valorLocalFinal =
      temOpcoesLocal && localResposta === '__OUTRO__' ? localOutro.trim() : localResposta.trim();
    const localLabelDisplay = eventoAtual.label_local?.trim() || 'Local (Escola, Bairro, etc.)';

    if (!valorLocalFinal) {
      setErroMsg(`Por favor, informe: ${localLabelDisplay}.`);
      return;
    }

    for (const campo of camposDoEvento) {
      const val = (respostasCustom[campo.id_campo] || '').trim();
      if (campo.obrigatorio && !val) {
        setErroMsg(`Por favor, preencha: ${campo.label}.`);
        return;
      }
      if (val && campo.tipo === 'TELEFONE' && !isTelefoneBRValido(val)) {
        setErroMsg(`Informe um telefone válido no padrão (XX) XXXXX-XXXX para "${campo.label}".`);
        return;
      }
      if (val && campo.tipo === 'EMAIL' && !isEmailValido(val)) {
        setErroMsg(`Informe um e-mail válido contendo @ para "${campo.label}".`);
        return;
      }
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
        email: email.trim().toLowerCase(),
        local: valorLocalFinal,
        respostas_customizadas: respostasCustom
      };

      const result = await storage.createBookingWithCloud(payload);

      const newSavedItem: SavedPublicBooking = {
        protocolo: result.protocolo,
        contato: whatsapp.trim(),
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        whatsapp: whatsapp.trim(),
        local: valorLocalFinal,
        evento_nome: result.evento_nome,
        slug_evento: eventoAtual.slug,
        data: result.data,
        hora_inicio: result.hora_inicio,
        hora_fim: result.hora_fim,
        criado_em: new Date().toISOString()
      };
      const updatedBookings = [
        newSavedItem,
        ...savedBookings.filter((b) => b.protocolo !== newSavedItem.protocolo)
      ];
      setSavedBookings(updatedBookings);
      writeSavedPublicBookings(updatedBookings);

      const profileToSave = {
        nome: nome.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim().toLowerCase(),
        local: valorLocalFinal
      };
      writeSavedLeadProfile(profileToSave);
      setWlNome(profileToSave.nome);
      setWlWhatsapp(profileToSave.whatsapp);
      setWlEmail(profileToSave.email);
      setWlLocal(profileToSave.local);

      setThankYouSecondsLeft(8);
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

  // Transição automática da tela de agradecimento para a Landing Page Pública
  useEffect(() => {
    if (!resultadoSucesso) return;
    if (thankYouSecondsLeft <= 0) {
      handleEnterLandingPage();
      return;
    }
    const timer = window.setTimeout(() => {
      setThankYouSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resultadoSucesso, thankYouSecondsLeft]);

  const handleSubmitWaitlist = async (e: React.FormEvent, targetEvento: EventoEntity) => {
    e.preventDefault();
    if (!wlNome.trim() || !wlWhatsapp.trim()) {
      setWlErro('Preencha seu Nome Completo e WhatsApp com DDD.');
      return;
    }
    if (!isTelefoneBRValido(wlWhatsapp)) {
      setWlErro('Informe um WhatsApp válido com DDD no padrão (XX) XXXXX-XXXX.');
      return;
    }
    if (wlEmail.trim() && !isEmailValido(wlEmail)) {
      setWlErro('Informe um e-mail válido contendo @.');
      return;
    }

    setWlErro(null);
    setWlSubmitting(true);
    try {
      const targetResumo = storage.getEventoDisponibilidadeResumo(targetEvento);
      const res = await storage.createWaitlistWithCloud({
        slug_evento: targetEvento.slug || targetEvento.id_evento,
        nome: wlNome.trim(),
        whatsapp: wlWhatsapp.trim(),
        email: wlEmail.trim().toLowerCase(),
        local: wlLocal.trim() || undefined,
        motivo: targetResumo.tituloStatus,
        observacoes: wlObservacao.trim() || undefined
      });
      writeSavedLeadProfile({
        nome: wlNome.trim(),
        whatsapp: wlWhatsapp.trim(),
        email: wlEmail.trim().toLowerCase(),
        local: wlLocal.trim()
      });
      setWlSucesso(res);
    } catch (err: any) {
      setWlErro(err.message || 'Não foi possível registrar seu interesse no momento.');
    } finally {
      setWlSubmitting(false);
    }
  };

  const openTrackingForSavedBooking = (item: SavedPublicBooking) => {
    setSsProtocolo(item.protocolo);
    setSsContato(item.contato || item.whatsapp || item.email);
    setSsErro(null);
    setSsSucesso(null);
    setSsRemarcarData('');
    setSsRemarcarSlot(null);
    setSelfServiceOpen(true);
    try {
      const found = storage.findBookingByProtocol(item.protocolo, item.contato || item.whatsapp || item.email);
      setSsResultado(found);
    } catch (err: any) {
      setSsResultado(null);
      setSsErro(err.message || 'Não foi possível localizar nos dados atuais.');
    }
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
      const savedEntry: SavedPublicBooking = {
        protocolo: found.agendamento.protocolo,
        contato: ssContato,
        nome: found.lead.nome,
        email: found.lead.email || '',
        whatsapp: found.lead.whatsapp || '',
        local: found.lead.local,
        evento_nome: found.evento.nome,
        slug_evento: found.evento.slug,
        data: found.agendamento.data_agendamento,
        hora_inicio: found.agendamento.hora_inicio,
        hora_fim: found.agendamento.hora_fim,
        criado_em: found.agendamento.criado_em
      };
      const updated = [
        savedEntry,
        ...savedBookings.filter((b) => b.protocolo !== savedEntry.protocolo)
      ];
      setSavedBookings(updated);
      writeSavedPublicBookings(updated);
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
      const nextSaved = savedBookings.map((b) =>
        b.protocolo === updated.agendamento.protocolo
          ? {
              ...b,
              data: updated.agendamento.data_agendamento,
              hora_inicio: updated.agendamento.hora_inicio,
              hora_fim: updated.agendamento.hora_fim
            }
          : b
      );
      setSavedBookings(nextSaved);
      writeSavedPublicBookings(nextSaved);
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

  // --- CATÁLOGO DE EVENTOS PARA A LANDING PAGE ---
  const eventosCatalogo = useMemo(() => {
    return eventos
      .filter((ev) => ev.status !== 'RASCUNHO')
      .map((ev) => ({
        evento: ev,
        resumo: storage.getEventoDisponibilidadeResumo(ev)
      }));
  }, [eventos, db.agendamentos, db.horarios, db.bloqueios]);

  const eventosFiltrados = useMemo(() => {
    if (landingFilter === 'DISPONIVEIS') {
      return eventosCatalogo.filter((item) => item.resumo.disponivel);
    }
    if (landingFilter === 'INDISPONIVEIS') {
      return eventosCatalogo.filter((item) => !item.resumo.disponivel);
    }
    return eventosCatalogo;
  }, [eventosCatalogo, landingFilter]);

  const countDisponiveis = eventosCatalogo.filter((i) => i.resumo.disponivel).length;
  const countIndisponiveis = eventosCatalogo.length - countDisponiveis;

  // --- PÁGINA DE AGRADECIMENTO & PROTOCOLO -> ENTRA NA LANDING PAGE ---
  if (resultadoSucesso) {
    const primeiroNome = nome.trim().split(/\s+/)[0] || 'Cliente';
    const progressPercent = Math.max(0, Math.min(100, (thankYouSecondsLeft / 8) * 100));
    const linkWhatsAppConfirmacao = gerarLinkWhatsApp(
      empresaWhatsapp || '5511999998888',
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
              Sua vaga foi reservada com sucesso. Guarde o protocolo abaixo para acompanhar ou alterar seu atendimento na Landing Page.
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
              <span className="font-mono tabular-nums text-neutral-900 dark:text-white">
                {formatarTelefoneBR(whatsapp)}
              </span>
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
                Entrando no portal de eventos e acompanhamentos em:
              </span>
              <span className="font-mono tabular-nums font-bold text-orange-600 dark:text-orange-400">
                {thankYouSecondsLeft}s
              </span>
            </div>
            <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all duration-1000 ease-linear"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleEnterLandingPage}
              className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <span>Acompanhar Meu Agendamento e Ver Eventos</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {empresaWhatsapp && (
              <a
                href={linkWhatsAppConfirmacao}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Enviar Comprovante pelo WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- TELA INICIAL DE CARREGAMENTO ---
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
              Carregando portal de eventos
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Buscando agendas, vagas e eventos disponíveis em tempo real...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDERIZAÇÃO DO TOPO COMUM (3 ZONAS LIMPAS) ---
  const renderTopBar = () => (
    <header className="w-full bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 sticky top-0 z-30 shrink-0">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        {/* Marca */}
        <button
          type="button"
          onClick={handleEnterLandingPage}
          className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
        >
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
        </button>

        {/* Navegação Central */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-neutral-600 dark:text-neutral-300">
          <button
            type="button"
            onClick={handleEnterLandingPage}
            className={`whitespace-nowrap transition-colors cursor-pointer ${
              viewMode === 'landing'
                ? 'text-orange-600 dark:text-orange-400 font-semibold'
                : 'hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Eventos Abertos
          </button>
          <a
            href="#meus-agendamentos"
            onClick={(e) => {
              if (viewMode !== 'landing') {
                e.preventDefault();
                setSelfServiceOpen(true);
              }
            }}
            className="whitespace-nowrap hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            Acompanhar Protocolo
          </a>
        </nav>

        {/* Ações */}
        <div className="flex items-center gap-2 shrink-0">
          {viewMode === 'booking' && (
            <button
              type="button"
              onClick={handleEnterLandingPage}
              className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span className="hidden sm:inline">Todos os Eventos</span>
            </button>
          )}

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
      </div>
    </header>
  );

  // =========================================================================
  // MODO 1: LANDING PAGE PÚBLICA (ACOMPANHAMENTO + EVENTOS DISPONÍVEIS / ESPERA)
  // =========================================================================
  if (viewMode === 'landing') {
    return (
      <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col transition-colors">
        {renderTopBar()}

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
          {/* Hero Editorial Compacto */}
          <section className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                Portal Público de Atendimentos · {empresaNome}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white text-balance">
                Acompanhe seu agendamento e escolha novos eventos
              </h1>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Consulte o status do seu protocolo em tempo real, remarque ou cancele quando precisar e inscreva-se nos demais eventos abertos ou na lista de espera.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelfServiceOpen(true);
                  setSsErro(null);
                  setSsSucesso(null);
                }}
                className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Search className="w-3.5 h-3.5 text-orange-400" />
                <span>Consultar Protocolo</span>
              </button>

              {empresaWhatsapp && (
                <a
                  href={gerarLinkWhatsApp(empresaWhatsapp, `Olá! Preciso de atendimento sobre um evento (${empresaNome}).`)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Falar no WhatsApp</span>
                </a>
              )}
            </div>
          </section>

          {/* Seção: Meus Agendamentos (Acompanhamento Automático + Busca por Protocolo) */}
          <section id="meus-agendamentos" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
                  Meus Agendamentos
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Acompanhe suas reservas realizadas neste dispositivo ou consulte outro código de protocolo.
                </p>
              </div>
            </div>

            {savedBookings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedBookings.map((item) => {
                  const liveAgd = db.agendamentos.find(
                    (a) => a.protocolo.toUpperCase() === item.protocolo.toUpperCase()
                  );
                  const liveStatus = liveAgd?.status || 'CONFIRMADO';
                  const dataExibida = liveAgd?.data_agendamento || item.data;
                  const horaExibida = liveAgd?.hora_inicio || item.hora_inicio;

                  const statusLabel =
                    liveStatus === 'CANCELADO'
                      ? 'Cancelado'
                      : liveStatus === 'REALIZADO'
                      ? 'Realizado'
                      : liveStatus === 'NO_SHOW'
                      ? 'Não compareceu'
                      : 'Confirmado';

                  const statusColor =
                    liveStatus === 'CANCELADO'
                      ? 'text-rose-600 dark:text-rose-400'
                      : liveStatus === 'REALIZADO'
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-emerald-600 dark:text-emerald-400';

                  return (
                    <div
                      key={item.protocolo}
                      className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                            {item.protocolo}
                          </span>
                          <span aria-hidden="true" className="text-neutral-400">·</span>
                          <span className={`font-semibold ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white truncate">
                          {item.evento_nome}
                        </h3>

                        <p className="text-xs text-neutral-600 dark:text-neutral-400 font-mono tabular-nums">
                          {formatarDataBR(dataExibida)} às {horaExibida}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => openTrackingForSavedBooking(item)}
                        className="px-3.5 py-2 bg-neutral-100 hover:bg-orange-600 text-neutral-800 hover:text-white dark:bg-neutral-800 dark:hover:bg-orange-600 dark:text-neutral-200 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Acompanhar / Alterar
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                    <CalendarClock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white">
                      Você ainda não possui agendamentos recentes salvos neste navegador
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Se já fez um agendamento em outro dispositivo, consulte usando seu código de protocolo.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelfServiceOpen(true);
                    setSsErro(null);
                    setSsSucesso(null);
                  }}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Buscar por Protocolo
                </button>
              </div>
            )}
          </section>

          {/* Seção: Catálogo de Eventos Abertos e Indisponíveis */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
                  Eventos Disponíveis &amp; Próximas Turmas
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Inscreva-se nos eventos com agenda aberta ou deixe seu contato na lista de espera dos encerrados e pausados.
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-1 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setLandingFilter('TODOS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    landingFilter === 'TODOS'
                      ? 'bg-orange-600 text-white font-semibold'
                      : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  Todos ({eventosCatalogo.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLandingFilter('DISPONIVEIS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    landingFilter === 'DISPONIVEIS'
                      ? 'bg-orange-600 text-white font-semibold'
                      : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  Abertos ({countDisponiveis})
                </button>
                <button
                  type="button"
                  onClick={() => setLandingFilter('INDISPONIVEIS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    landingFilter === 'INDISPONIVEIS'
                      ? 'bg-orange-600 text-white font-semibold'
                      : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  Lista de Espera ({countIndisponiveis})
                </button>
              </div>
            </div>

            {eventosFiltrados.length === 0 ? (
              <div className="p-10 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-center space-y-2">
                <Calendar className="w-8 h-8 text-neutral-400 mx-auto" />
                <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  Nenhum evento encontrado neste filtro
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Alterne para &quot;Todos&quot; ou entre em contato pelos nossos canais de atendimento.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {eventosFiltrados.map(({ evento: ev, resumo }) => {
                  const hasImg = Boolean(ev.imagem_url) && !catalogImgErrors[ev.id_evento];

                  return (
                    <article
                      key={ev.id_evento}
                      className="p-5 sm:p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm flex flex-col justify-between gap-5"
                    >
                      <div className="space-y-3.5">
                        {/* Identidade */}
                        <div className="flex items-start gap-3.5">
                          {hasImg ? (
                            <img
                              src={ev.imagem_url}
                              alt={ev.nome}
                              referrerPolicy="no-referrer"
                              onError={() => setCatalogImgErrors((p) => ({ ...p, [ev.id_evento]: true }))}
                              className="w-12 h-12 rounded-xl object-cover border border-neutral-200 dark:border-neutral-800 shrink-0 bg-neutral-50 dark:bg-neutral-950"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-orange-600 text-white font-bold text-lg flex items-center justify-center shrink-0">
                              {ev.nome.charAt(0).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                              <span
                                className={
                                  resumo.disponivel
                                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                    : resumo.estado === 'ENCERRADO'
                                    ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                    : 'text-amber-600 dark:text-amber-400 font-semibold'
                                }
                              >
                                {resumo.tituloStatus}
                              </span>
                              <span aria-hidden="true"> · </span>
                              <span className="font-mono tabular-nums">{ev.duracao_minutos} min</span>
                            </p>
                            <h3 className="text-base font-bold tracking-tight text-neutral-900 dark:text-white leading-snug">
                              {ev.nome}
                            </h3>
                          </div>
                        </div>

                        <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed line-clamp-3">
                          {ev.descricao || 'Atendimento programado com agendamento online de data e horário.'}
                        </p>

                        {ev.exibir_produto_publico && (ev.produto_nome || (ev.produto_valor && ev.produto_valor > 0)) && (
                          <div className="pt-2.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2 text-xs">
                            <span className="text-neutral-600 dark:text-neutral-300 font-medium truncate">
                              {ev.produto_nome || ev.nome}
                            </span>
                            {ev.produto_valor && ev.produto_valor > 0 ? (
                              <span className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                                {ev.produto_parcelas && ev.produto_parcelas > 1 && ev.produto_valor_mensal && ev.produto_valor_mensal > 0
                                  ? `${ev.produto_parcelas}x ${formatarMoedaBRL(ev.produto_valor_mensal)}`
                                  : formatarMoedaBRL(ev.produto_valor)}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                          {resumo.disponivel ? (
                            <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold">
                              {resumo.vagasTotais} vaga{resumo.vagasTotais !== 1 ? 's' : ''} em {resumo.datasComVaga} dia{resumo.datasComVaga !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-neutral-500 dark:text-neutral-400">
                              {resumo.permitirListaEspera
                                ? 'Cadastre-se para ser avisado na reabertura'
                                : 'Indisponível no momento'}
                            </span>
                          )}
                        </div>

                        {resumo.disponivel ? (
                          <button
                            type="button"
                            onClick={() => handleOpenEventBooking(ev.slug)}
                            className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                          >
                            <span>Agendar neste Evento</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenUnavailableModal(ev)}
                            className="w-full py-2.5 px-4 bg-neutral-100 hover:bg-amber-50 dark:bg-neutral-800 dark:hover:bg-amber-950/40 border border-neutral-200 dark:border-neutral-700 hover:border-amber-400 text-neutral-800 dark:text-neutral-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                          >
                            {resumo.estado === 'ENCERRADO' ? (
                              <PauseCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            ) : (
                              <BellRing className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            )}
                            <span>
                              {resumo.estado === 'ENCERRADO'
                                ? 'Encerrado · Ver Aviso / Lista de Espera'
                                : resumo.estado === 'ESGOTADO'
                                ? 'Vagas Esgotadas · Avise-me'
                                : 'Agenda Fechada · Lista de Espera'}
                            </span>
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        <footer className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
          <span>
            © {new Date().getFullYear()} {empresaNome}
            {empresaEndereco ? ` · ${empresaEndereco}` : ''}
            {empresaCnpj ? ` · CNPJ ${empresaCnpj}` : ''}
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500 shrink-0" />
            <span>Agendamento oficial e acompanhamentos</span>
          </span>
        </footer>

        {/* MODAL: EVENTO INDISPONÍVEL + LISTA DE ESPERA */}
        {waitlistEvent && (() => {
          const wResumo = storage.getEventoDisponibilidadeResumo(waitlistEvent);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-2xl">
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/70 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        {wResumo.tituloStatus}
                      </p>
                      <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white truncate">
                        {waitlistEvent.nome}
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWaitlistEvent(null)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Mensagem configurada no admin */}
                <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs sm:text-sm text-amber-950 dark:text-amber-100 leading-relaxed">
                  {wResumo.mensagem}
                </div>

                {wlSucesso ? (
                  <div className="p-5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-center space-y-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                        Interesse registrado com sucesso!
                      </h4>
                      <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                        {wlSucesso.mensagem}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWaitlistEvent(null)}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Voltar para os Eventos
                    </button>
                  </div>
                ) : wResumo.permitirListaEspera ? (
                  <form onSubmit={(e) => handleSubmitWaitlist(e, waitlistEvent)} className="space-y-3 text-xs">
                    <div className="flex items-center gap-1.5 text-neutral-800 dark:text-neutral-200 font-semibold">
                      <BellRing className="w-3.5 h-3.5 text-orange-500" />
                      <span>Cadastre-se para nossa equipe avisar quando a agenda abrir:</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                          Nome Completo *
                        </label>
                        <input
                          type="text"
                          required
                          value={wlNome}
                          onChange={(e) => setWlNome(e.target.value)}
                          placeholder="Seu nome completo"
                          className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                          WhatsApp com DDD *
                        </label>
                        <input
                          type="tel"
                          inputMode="tel"
                          required
                          maxLength={15}
                          value={wlWhatsapp}
                          onChange={(e) => setWlWhatsapp(aplicarMascaraTelefoneBR(e.target.value))}
                          placeholder="(11) 99999-9999"
                          className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                          E-mail
                        </label>
                        <input
                          type="email"
                          value={wlEmail}
                          onChange={(e) => setWlEmail(sanitizarEmailInput(e.target.value))}
                          placeholder="seuemail@exemplo.com"
                          className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                          {waitlistEvent.label_local?.trim() || 'Escola / Bairro / Local'}
                        </label>
                        <input
                          type="text"
                          value={wlLocal}
                          onChange={(e) => setWlLocal(e.target.value)}
                          placeholder="Onde você prefere ou estuda"
                          className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Observação (opcional)
                      </label>
                      <input
                        type="text"
                        value={wlObservacao}
                        onChange={(e) => setWlObservacao(e.target.value)}
                        placeholder="Ex: Prefiro atendimento no período da manhã"
                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    {wlErro && (
                      <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs">
                        {wlErro}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={wlSubmitting}
                      className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      {wlSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Registrando interesse...</span>
                        </>
                      ) : (
                        <>
                          <BellRing className="w-4 h-4" />
                          <span>Avise-me Quando a Agenda Abrir</span>
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    {empresaWhatsapp && (
                      <a
                        href={gerarLinkWhatsApp(empresaWhatsapp, `Olá! Vi que o evento "${waitlistEvent.nome}" está indisponível. Gostaria de informações.`)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Falar com o Atendimento</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setWaitlistEvent(null)}
                      className="px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Modal Autoatendimento */}
        {renderSelfServiceModal()}
      </div>
    );
  }

  // Helper de renderização do modal de Autoatendimento por Protocolo
  function renderSelfServiceModal() {
    if (!selfServiceOpen) return null;
    return (
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
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && !/[a-zA-Z@]/.test(val)) {
                    setSsContato(aplicarMascaraTelefoneBR(val));
                  } else {
                    setSsContato(sanitizarEmailInput(val));
                  }
                }}
                placeholder="Ex: (11) 99999-8888 ou seu@email.com"
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
                        {ssDatasRemarcacao.map((d) => (
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
    );
  }

  // =========================================================================
  // MODO 2: AGENDAMENTO DIRETO NO EVENTO SELECIONADO
  // =========================================================================
  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col transition-colors">
      {renderTopBar()}

      {/* Área Central Principal */}
      <main className="flex-1 min-h-0 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4 flex flex-col">
        {!eventoAtual ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="max-w-lg w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 sm:p-10 text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 mx-auto flex items-center justify-center">
                <Calendar className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                  {selectedSlug ? `Evento "${selectedSlug}" não encontrado` : 'Nenhum evento selecionado'}
                </h2>
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                  {cloudState.lastError
                    ? `Falha ao consultar a agenda: ${cloudState.lastError}`
                    : 'Você pode visualizar todos os eventos disponíveis e acompanhar agendamentos na Landing Page.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleEnterLandingPage}
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Ver Todos os Eventos</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm grid grid-cols-1 md:grid-cols-12 overflow-hidden">
            {/* COLUNA ESQUERDA: Identidade do Evento + Resumo + Contatos */}
            <aside className="md:col-span-5 lg:col-span-4 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800 p-5 sm:p-6 lg:p-7 flex flex-col justify-between gap-4 md:overflow-y-auto bg-neutral-50/70 dark:bg-neutral-950/30">
              <div className="space-y-4">
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

                <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  {eventoAtual.descricao || 'Selecione a data e o horário desejado para confirmar seu atendimento.'}
                </p>

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

            {/* COLUNA DIREITA: Fluxo Interativo ou Aviso de Indisponibilidade + Lista de Espera */}
            <section className="md:col-span-7 lg:col-span-8 p-5 sm:p-6 lg:p-8 flex flex-col min-h-0">
              {resumoEventoAtual && !resumoEventoAtual.disponivel ? (
                <div className="flex-1 min-h-0 md:overflow-y-auto flex flex-col justify-center py-2">
                  <div className="max-w-lg mx-auto w-full space-y-5">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                          {resumoEventoAtual.tituloStatus}
                        </p>
                        <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                          Novas reservas temporariamente indisponíveis
                        </h2>
                        <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                          {resumoEventoAtual.mensagem}
                        </p>
                      </div>
                    </div>

                    {wlSucesso ? (
                      <div className="p-5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-center space-y-3">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                        <p className="text-xs sm:text-sm font-medium text-emerald-900 dark:text-emerald-200">
                          {wlSucesso.mensagem}
                        </p>
                        <button
                          type="button"
                          onClick={handleEnterLandingPage}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
                        >
                          Explorar Outros Eventos Abertos
                        </button>
                      </div>
                    ) : resumoEventoAtual.permitirListaEspera ? (
                      <form
                        onSubmit={(e) => handleSubmitWaitlist(e, eventoAtual)}
                        className="p-5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3 text-xs"
                      >
                        <div className="flex items-center gap-2 font-semibold text-neutral-800 dark:text-neutral-200">
                          <BellRing className="w-4 h-4 text-orange-500" />
                          <span>Entrar na Lista de Espera</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                              Nome Completo *
                            </label>
                            <input
                              type="text"
                              required
                              value={wlNome}
                              onChange={(e) => setWlNome(e.target.value)}
                              placeholder="Seu nome completo"
                              className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                              WhatsApp com DDD *
                            </label>
                            <input
                              type="tel"
                              required
                              maxLength={15}
                              value={wlWhatsapp}
                              onChange={(e) => setWlWhatsapp(aplicarMascaraTelefoneBR(e.target.value))}
                              placeholder="(11) 99999-9999"
                              className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl font-mono text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                              E-mail
                            </label>
                            <input
                              type="email"
                              value={wlEmail}
                              onChange={(e) => setWlEmail(sanitizarEmailInput(e.target.value))}
                              placeholder="seuemail@exemplo.com"
                              className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                              {eventoAtual.label_local?.trim() || 'Escola / Bairro / Local'}
                            </label>
                            <input
                              type="text"
                              value={wlLocal}
                              onChange={(e) => setWlLocal(e.target.value)}
                              placeholder="Local de preferência"
                              className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                            />
                          </div>
                        </div>

                        {wlErro && (
                          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl">
                            {wlErro}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="submit"
                            disabled={wlSubmitting}
                            className="flex-1 py-2.5 px-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {wlSubmitting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Enviando...</span>
                              </>
                            ) : (
                              <>
                                <BellRing className="w-4 h-4" />
                                <span>Avise-me Quando Abrir</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={handleEnterLandingPage}
                            className="py-2.5 px-4 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-xl font-semibold cursor-pointer"
                          >
                            Ver Outros Eventos
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={handleEnterLandingPage}
                        className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <LayoutGrid className="w-4 h-4" />
                        <span>Explorar Outros Eventos Disponíveis</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
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
                                Nome Completo <span className="text-rose-500">*</span>
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
                                WhatsApp com DDD <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="tel"
                                inputMode="tel"
                                required
                                maxLength={15}
                                pattern="\(\d{2}\)\s?\d{4,5}-\d{4}"
                                title="Informe o WhatsApp no padrão (XX) XXXXX-XXXX"
                                value={whatsapp}
                                onChange={(e) => setWhatsapp(aplicarMascaraTelefoneBR(e.target.value))}
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
                                inputMode="email"
                                pattern="[^@\s]+@[^@\s]+\.[^@\s]+"
                                title="Informe um e-mail válido contendo @ (ex: seuemail@exemplo.com)"
                                value={email}
                                onChange={(e) => setEmail(sanitizarEmailInput(e.target.value))}
                                placeholder="seuemail@exemplo.com"
                                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                              />
                            </div>

                            <div>
                              {(() => {
                                const labelLocalCampo = eventoAtual.label_local?.trim() || 'Local (Escola, Bairro, etc.)';
                                const temOpcoesLocal = Array.isArray(eventoAtual.local_opcoes) && eventoAtual.local_opcoes.length > 0;
                                return (
                                  <>
                                    <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                                      {labelLocalCampo} <span className="text-rose-500">*</span>
                                    </label>
                                    {temOpcoesLocal ? (
                                      <div className="space-y-2">
                                        <select
                                          required
                                          value={localResposta}
                                          onChange={(e) => setLocalResposta(e.target.value)}
                                          className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                                        >
                                          <option value="">Selecione...</option>
                                          {eventoAtual.local_opcoes!.map((op) => (
                                            <option key={op} value={op}>
                                              {op}
                                            </option>
                                          ))}
                                          <option value="__OUTRO__">Outro (digitar)...</option>
                                        </select>
                                        {localResposta === '__OUTRO__' && (
                                          <input
                                            type="text"
                                            required
                                            value={localOutro}
                                            onChange={(e) => setLocalOutro(e.target.value)}
                                            placeholder={`Informe: ${labelLocalCampo}`}
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
                                        placeholder={`Informe: ${labelLocalCampo}`}
                                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                                      />
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>

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

                                    {campo.tipo === 'TELEFONE' && (
                                      <input
                                        type="tel"
                                        inputMode="tel"
                                        required={campo.obrigatorio}
                                        maxLength={15}
                                        pattern="\(\d{2}\)\s?\d{4,5}-\d{4}"
                                        title="Informe o telefone no padrão (XX) XXXXX-XXXX"
                                        placeholder={campo.placeholder || '(11) 99999-9999'}
                                        value={respostasCustom[campo.id_campo] || ''}
                                        onChange={(e) =>
                                          handleCustomChange(campo.id_campo, aplicarMascaraTelefoneBR(e.target.value))
                                        }
                                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-orange-500"
                                      />
                                    )}

                                    {campo.tipo === 'EMAIL' && (
                                      <input
                                        type="email"
                                        inputMode="email"
                                        required={campo.obrigatorio}
                                        pattern="[^@\s]+@[^@\s]+\.[^@\s]+"
                                        title="Informe um e-mail válido contendo @"
                                        placeholder={campo.placeholder || 'seuemail@exemplo.com'}
                                        value={respostasCustom[campo.id_campo] || ''}
                                        onChange={(e) =>
                                          handleCustomChange(campo.id_campo, sanitizarEmailInput(e.target.value))
                                        }
                                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                                      />
                                    )}

                                    {campo.tipo === 'NUMERO' && (
                                      <input
                                        type="number"
                                        required={campo.obrigatorio}
                                        placeholder={campo.placeholder}
                                        value={respostasCustom[campo.id_campo] || ''}
                                        onChange={(e) => handleCustomChange(campo.id_campo, e.target.value)}
                                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-orange-500"
                                      />
                                    )}

                                    {campo.tipo === 'DATA' && (
                                      <input
                                        type="date"
                                        required={campo.obrigatorio}
                                        value={respostasCustom[campo.id_campo] || ''}
                                        onChange={(e) => handleCustomChange(campo.id_campo, e.target.value)}
                                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm sm:text-xs text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-orange-500"
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
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </main>

      <footer className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-3 pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400 dark:text-neutral-500 shrink-0">
        <span>
          © {new Date().getFullYear()} {empresaNome}
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500 shrink-0" />
          <span>Agendamento seguro</span>
        </span>
      </footer>

      {renderSelfServiceModal()}
    </div>
  );
};
