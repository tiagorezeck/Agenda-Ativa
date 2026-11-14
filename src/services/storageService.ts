/**
 * Motor de Persistência, Regras de Negócio e Sincronização Google Sheets
 * Sistema de Agendamento, Captação de Leads e CRM
 */

import {
  SheetDatabase,
  EventoEntity,
  HorarioEntity,
  BloqueioEntity,
  AgendamentoEntity,
  LeadEntity,
  CampoFormularioEntity,
  RespostaEntity,
  CrmOportunidadeEntity,
  HistoricoCrmEntity,
  LogEntity,
  SlotDisponibilidade,
  EstagioCrm,
  StatusClienteLead
} from '../types/database';
import { BookingSubmissionPayload, BookingSuccessResult } from '../types/api';
import { gerarCodigoAleatorio, normalizarWhatsApp, obterDiaSemanaAbrev } from '../utils/formatters';
import {
  executeDriveRequest,
  fetchFromGoogleDrive,
  getDriveConfig,
  hydrateRuntimeConfig,
  isCloudActive,
  pushToGoogleDrive,
  saveDriveConfig
} from './driveSyncService';
import { notifyEngsegListeners } from './engsegService';

const STORAGE_KEY = 'SISTEMA_AGENDAMENTO_SHEETS_DB_V1';

// Gera datas dinâmicas para hoje e amanhã no fuso de São Paulo
function getFormattedDate(offsetDays: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

const DATA_HOJE = getFormattedDate(0);
const DATA_AMANHA = getFormattedDate(1);
const DATA_DEPOIS = getFormattedDate(2);

const INITIAL_DATABASE: SheetDatabase = {
  config: [
    {
      chave: 'EMPRESA_NOME',
      valor: 'Instituto Comet Atendimentos',
      descricao: 'Nome fantasia da empresa',
      atualizado_em: new Date().toISOString()
    },
    {
      chave: 'EMPRESA_LOGO',
      valor: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=160&auto=format&fit=crop&q=80',
      descricao: 'URL ou Data URI da logo da empresa',
      atualizado_em: new Date().toISOString()
    },
    {
      chave: 'EMPRESA_EMAIL',
      valor: 'contato@institutocomet.com.br',
      descricao: 'E-mail de suporte e atendimento',
      atualizado_em: new Date().toISOString()
    },
    {
      chave: 'EMPRESA_ENDERECO',
      valor: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
      descricao: 'Endereço físico e cidade da empresa',
      atualizado_em: new Date().toISOString()
    },
    {
      chave: 'EMPRESA_CNPJ',
      valor: '42.123.456/0001-89',
      descricao: 'CNPJ da empresa',
      atualizado_em: new Date().toISOString()
    },
    {
      chave: 'FUSO_HORARIO',
      valor: 'America/Sao_Paulo',
      descricao: 'Fuso horário oficial',
      atualizado_em: new Date().toISOString()
    },
    {
      chave: 'WHATSAPP_CONTATO',
      valor: '5511999998888',
      descricao: 'WhatsApp comercial para suporte e avisos',
      atualizado_em: new Date().toISOString()
    },
    {
      chave: 'TERMOS_LGPD',
      valor: 'Autorizo a coleta e tratamento dos meus dados para fins de confirmação e realização deste atendimento.',
      descricao: 'Consentimento de dados LGPD',
      atualizado_em: new Date().toISOString()
    }
  ],
  usuarios: [
    {
      id_usuario: 'USR-001',
      nome: 'Diretor Comercial',
      email: 'comercial@empresa.com.br',
      perfil: 'ADMIN',
      ativo: true,
      criado_em: new Date().toISOString()
    },
    {
      id_usuario: 'USR-002',
      nome: 'Consultora de Vendas',
      email: 'consultoria@empresa.com.br',
      perfil: 'COMERCIAL',
      ativo: true,
      criado_em: new Date().toISOString()
    }
  ],
  eventos: [
    {
      id_evento: 'EVT-001',
      slug: 'mentoria-comercial-estrategica',
      nome: 'Mentoria Comercial Estratégica',
      descricao: 'Sessão de diagnóstico e planejamento para aceleração de vendas e captação de clientes.',
      imagem_url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=180&auto=format&fit=crop&q=80',
      produto_nome: 'Mentoria Comercial Estratégica (Pacote 90 dias)',
      produto_valor_mensal: 1000,
      produto_parcelas: 5,
      produto_valor: 5000,
      exibir_produto_publico: true,
      modo_datas: 'RECORRENTE',
      recorrencia_ativa: true,
      datas_especificas: [],
      data_inicio: DATA_HOJE,
      data_fim: DATA_DEPOIS,
      dias_semana: ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'],
      duracao_minutos: 60,
      intervalo_minutos: 15,
      capacidade_padrao: 5, // Exatamente 5 vagas por horário conforme o Teste de Aceitação!
      responsavel_id: 'USR-001',
      status: 'PUBLICADO',
      mensagem_confirmacao: 'Parabéns! Sua sessão estratégica está confirmada. Em breve entraremos em contato via WhatsApp com o link da sala virtual.',
      permite_cancelamento: true,
      horas_antecedencia_cancelamento: 24,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    }
  ],
  horarios: [
    // 2 horários por dia, 5 vagas por horário
    {
      id_horario: 'SCH-001',
      id_evento: 'EVT-001',
      hora_inicio: '09:00',
      hora_fim: '10:00',
      capacidade: 5,
      dias_aplicaveis: ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'],
      ativo: true
    },
    {
      id_horario: 'SCH-002',
      id_evento: 'EVT-001',
      hora_inicio: '10:00',
      hora_fim: '11:00',
      capacidade: 5,
      dias_aplicaveis: ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'],
      ativo: true
    }
  ],
  bloqueios: [],
  agendamentos: [
    // 2 agendamentos pré-cadastrados para demonstrar ocupação inicial
    {
      id_agendamento: 'AGD-202611-0001',
      protocolo: 'PROT-202611-DEMO1',
      id_evento: 'EVT-001',
      id_lead: 'LED-0001',
      data_agendamento: DATA_HOJE,
      hora_inicio: '09:00',
      hora_fim: '10:00',
      status: 'CONFIRMADO',
      criado_em: new Date().toISOString()
    },
    {
      id_agendamento: 'AGD-202611-0002',
      protocolo: 'PROT-202611-DEMO2',
      id_evento: 'EVT-001',
      id_lead: 'LED-0002',
      data_agendamento: DATA_HOJE,
      hora_inicio: '09:00',
      hora_fim: '10:00',
      status: 'CONFIRMADO',
      criado_em: new Date().toISOString()
    }
  ],
  leads: [
    {
      id_lead: 'LED-0001',
      nome: 'Carlos Eduardo Mendes',
      whatsapp: '5511988887777',
      email: 'carlos.mendes@techsolucoes.com',
      empresa: 'Tech Soluções Inovadoras',
      cargo: 'CEO & Fundador',
      status_cliente: 'LEAD',
      origem_primeiro_evento: 'EVT-001',
      total_agendamentos: 1,
      data_ultimo_agendamento: new Date().toISOString(),
      responsavel_id: 'USR-001',
      observacoes: 'Interessado em consultoria para estruturação de pré-vendas SDR.',
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    },
    {
      id_lead: 'LED-0002',
      nome: 'Juliana Barros Rocha',
      whatsapp: '5521977776666',
      email: 'juliana.rocha@nexuscorp.com.br',
      empresa: 'Nexus Corp',
      cargo: 'Diretora de Operações',
      status_cliente: 'LEAD',
      origem_primeiro_evento: 'EVT-001',
      total_agendamentos: 1,
      data_ultimo_agendamento: new Date().toISOString(),
      responsavel_id: 'USR-002',
      observacoes: 'Busca treinamento para 12 consultores comerciais.',
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    }
  ],
  campos_formulario: [
    {
      id_campo: 'FLD-001',
      id_evento: 'EVT-001',
      nome_campo: 'cargo_ou_funcao',
      label: 'Qual é o seu cargo ou função atual?',
      tipo: 'TEXTO_CURTO',
      obrigatorio: true,
      placeholder: 'Ex: Gerente Comercial, Fundador, Diretor',
      ordem: 1,
      ativo: true
    },
    {
      id_campo: 'FLD-002',
      id_evento: 'EVT-001',
      nome_campo: 'faturamento_mensal',
      label: 'Qual é a faixa de faturamento médio mensal da sua empresa?',
      tipo: 'SELECAO_UNICA',
      obrigatorio: true,
      opcoes: ['Até R$ 50 mil', 'De R$ 50 mil a R$ 150 mil', 'De R$ 150 mil a R$ 500 mil', 'Acima de R$ 500 mil'],
      ordem: 2,
      ativo: true
    },
    {
      id_campo: 'FLD-003',
      id_evento: 'EVT-001',
      nome_campo: 'equipe_comercial',
      label: 'Você já possui equipe de vendas ativa?',
      tipo: 'SIM_NAO',
      obrigatorio: false,
      ordem: 3,
      ativo: true
    }
  ],
  respostas: [
    {
      id_resposta: 'RSP-0001',
      id_agendamento: 'AGD-202611-0001',
      id_lead: 'LED-0001',
      id_campo: 'FLD-001',
      valor: 'CEO & Fundador',
      criado_em: new Date().toISOString()
    },
    {
      id_resposta: 'RSP-0002',
      id_agendamento: 'AGD-202611-0001',
      id_lead: 'LED-0001',
      id_campo: 'FLD-002',
      valor: 'De R$ 150 mil a R$ 500 mil',
      criado_em: new Date().toISOString()
    }
  ],
  crm: [
    {
      id_oportunidade: 'CRM-0001',
      id_lead: 'LED-0001',
      id_agendamento_origem: 'AGD-202611-0001',
      titulo: 'Atendimento: Carlos Eduardo Mendes (Mentoria Comercial)',
      produto_nome: 'Mentoria Comercial Estratégica (Pacote 90 dias)',
      produto_valor_mensal: 1000,
      produto_parcelas: 5,
      estagio: 'ENTRADA',
      valor_estimado: 5000,
      valor_fechado: 0,
      responsavel_id: 'USR-001',
      data_proximo_followup: DATA_HOJE,
      ordem_coluna: 1,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    },
    {
      id_oportunidade: 'CRM-0002',
      id_lead: 'LED-0002',
      id_agendamento_origem: 'AGD-202611-0002',
      titulo: 'Atendimento: Juliana Barros Rocha (Mentoria Comercial)',
      estagio: 'REUNIAO',
      sub_status: 'FOLLOW',
      valor_estimado: 8500,
      valor_fechado: 0,
      responsavel_id: 'USR-002',
      data_proximo_followup: DATA_AMANHA,
      ordem_coluna: 1,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    },
    {
      id_oportunidade: 'CRM-0003',
      id_lead: 'LED-0001',
      titulo: 'Proposta de Treinamento Comercial SDR',
      estagio: 'FOLLOW_UP_STAND_BY',
      sub_status: 'FOLLOW', // Amarelo
      valor_estimado: 12000,
      valor_fechado: 0,
      responsavel_id: 'USR-001',
      data_proximo_followup: DATA_AMANHA,
      ordem_coluna: 1,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    },
    {
      id_oportunidade: 'CRM-0004',
      id_lead: 'LED-0002',
      titulo: 'Diagnóstico de Processos (Aguardando Aprovação)',
      estagio: 'FOLLOW_UP_STAND_BY',
      sub_status: 'STAND', // Cinza
      valor_estimado: 7500,
      valor_fechado: 0,
      responsavel_id: 'USR-002',
      data_proximo_followup: DATA_DEPOIS,
      ordem_coluna: 2,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    }
  ],
  historico_crm: [
    {
      id_historico: 'HCRM-0001',
      id_oportunidade: 'CRM-0001',
      tipo: 'MUDANCA_ESTAGIO',
      estagio_novo: 'ENTRADA',
      descricao: 'Oportunidade gerada automaticamente a partir do agendamento PROT-202611-DEMO1',
      usuario_id: 'SISTEMA',
      criado_em: new Date().toISOString()
    },
    {
      id_historico: 'HCRM-0002',
      id_oportunidade: 'CRM-0002',
      tipo: 'MUDANCA_ESTAGIO',
      estagio_anterior: 'ENTRADA',
      estagio_novo: 'REUNIAO',
      descricao: 'Contato estabelecido via WhatsApp, alinhamento preliminar concluído.',
      usuario_id: 'USR-002',
      criado_em: new Date().toISOString()
    }
  ],
  tarefas: [
    {
      id_tarefa: 'TSK-0001',
      id_oportunidade: 'CRM-0001',
      id_lead: 'LED-0001',
      titulo: 'Enviar link da sala virtual para Carlos Eduardo',
      data_vencimento: DATA_HOJE,
      concluida: false,
      responsavel_id: 'USR-001',
      criada_em: new Date().toISOString()
    }
  ],
  logs: [
    {
      id_log: 'LOG-0001',
      nivel: 'INFO',
      origem: 'SYSTEM',
      acao: 'SYSTEM_BOOT',
      detalhes: 'Base de dados inicializada com as 13 abas do Google Sheets.',
      timestamp: new Date().toISOString()
    }
  ]
};

class StorageService {
  private db: SheetDatabase;

  constructor() {
    this.db = this.carregar();
  }

  private carregar(): SheetDatabase {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed: SheetDatabase = JSON.parse(data);
        // Migração suave de estágios do CRM (Follow-up / Stand By consolidado)
        let alterado = false;
        if (parsed.crm) {
          parsed.crm.forEach(c => {
            if (c.estagio === 'STAND_BY') {
              c.estagio = 'FOLLOW_UP_STAND_BY';
              c.sub_status = 'STAND';
              alterado = true;
            } else if (c.estagio === 'FOLLOW_UP') {
              c.estagio = 'FOLLOW_UP_STAND_BY';
              c.sub_status = 'FOLLOW';
              alterado = true;
            }
          });

          // Se não houver nenhum card em Follow-up/Stand By, adicione para demonstração
          const hasFollowCard = parsed.crm.some(c => c.estagio === 'FOLLOW_UP_STAND_BY');
          if (!hasFollowCard && INITIAL_DATABASE.crm.length > 2) {
            parsed.crm.push(INITIAL_DATABASE.crm[2], INITIAL_DATABASE.crm[3]);
            alterado = true;
          }
        }

        // Garante que o evento inicial tenha imagem_url
        if (parsed.eventos && parsed.eventos[0] && !parsed.eventos[0].imagem_url) {
          parsed.eventos[0].imagem_url = 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=180&auto=format&fit=crop&q=80';
          alterado = true;
        }

        // Garante que as configurações da empresa incluam logo e contatos
        if (parsed.config) {
          INITIAL_DATABASE.config.forEach(initConf => {
            const existe = parsed.config.find(c => c.chave === initConf.chave);
            if (!existe) {
              parsed.config.push({ ...initConf });
              alterado = true;
            }
          });
        }

        if (alterado) {
          this.salvar(parsed, true);
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Erro ao carregar do localStorage:', e);
    }
    this.salvar(INITIAL_DATABASE, true);
    return JSON.parse(JSON.stringify(INITIAL_DATABASE));
  }

  private autoSyncTimer: ReturnType<typeof setTimeout> | null = null;

  private scheduleAutoSync() {
    const cfg = getDriveConfig();
    if (!isCloudActive() || !cfg.autoSync) return;
    if (this.autoSyncTimer) {
      clearTimeout(this.autoSyncTimer);
    }
    this.autoSyncTimer = setTimeout(() => {
      pushToGoogleDrive(cfg.webappUrl || undefined, this.db, cfg.apiToken).catch((err) => {
        console.warn('Auto-sync DADOS DRIVE v2.0 falhou:', err);
      });
    }, 1200);
  }

  private salvar(db: SheetDatabase, skipAutoSync: boolean = false) {
    this.db = db;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      console.error('Erro ao salvar no localStorage:', e);
    }
    if (!skipAutoSync) {
      this.scheduleAutoSync();
    }
  }

  public getDatabase(): SheetDatabase {
    return this.db;
  }

  public replaceDatabase(newDb: SheetDatabase): SheetDatabase {
    const merged: SheetDatabase = {
      ...JSON.parse(JSON.stringify(INITIAL_DATABASE)),
      ...newDb
    };
    this.salvar(merged, true);
    return this.db;
  }

  public async bootstrapFromCloud(): Promise<boolean> {
    await hydrateRuntimeConfig();
    notifyEngsegListeners();
    if (!isCloudActive()) return false;
    try {
      await this.pullFromCloud(false);
      return true;
    } catch (err) {
      console.warn('Bootstrap da nuvem ignorado (usando cache local):', err);
      return false;
    }
  }

  public async pushToCloud(): Promise<any> {
    const cfg = getDriveConfig();
    if (!isCloudActive()) {
      throw new Error('URL do Motor DADOS DRIVE v2.0 não configurada.');
    }
    return pushToGoogleDrive(cfg.webappUrl || undefined, this.db, cfg.apiToken);
  }

  public async pullFromCloud(nocache: boolean = false): Promise<SheetDatabase> {
    const cfg = getDriveConfig();
    if (!isCloudActive()) {
      throw new Error('URL do Motor DADOS DRIVE v2.0 não configurada.');
    }
    const res = await fetchFromGoogleDrive(cfg.webappUrl || undefined, cfg.apiToken, nocache);
    const cloudDb = (res && res.data && typeof res.data === 'object' && Array.isArray(res.data.eventos))
      ? res.data
      : res;

    if (cloudDb && Array.isArray(cloudDb.eventos)) {
      return this.replaceDatabase(cloudDb as SheetDatabase);
    }
    return this.db;
  }

  public resetToDemo(): SheetDatabase {
    this.salvar(JSON.parse(JSON.stringify(INITIAL_DATABASE)));
    return this.db;
  }

  public getGasWebAppUrl(): string {
    return getDriveConfig().webappUrl;
  }

  public setGasWebAppUrl(url: string): void {
    saveDriveConfig({ webappUrl: url.trim() });
  }

  // --- Disponibilidade e Cálculo de Vagas em Tempo Real ---
  public getDisponibilidade(idEvento: string, data: string): SlotDisponibilidade[] {
    const evento = this.db.eventos.find(e => e.id_evento === idEvento);
    if (!evento) return [];

    const isDatasEspecificas = evento.modo_datas === 'DATAS_ESPECIFICAS';
    const isRecorrente = Boolean(evento.recorrencia_ativa) || evento.modo_datas === 'RECORRENTE';

    if (isDatasEspecificas) {
      const listaDatas = Array.isArray(evento.datas_especificas) ? evento.datas_especificas : [];
      if (!listaDatas.includes(data)) return [];
    } else {
      if (evento.data_inicio && data < evento.data_inicio) return [];
      if (!isRecorrente && evento.data_fim && data > evento.data_fim) return [];
    }

    const diaSemanaAbrev = obterDiaSemanaAbrev(data);
    if (!isDatasEspecificas && Array.isArray(evento.dias_semana) && evento.dias_semana.length > 0) {
      if (!evento.dias_semana.includes(diaSemanaAbrev)) return [];
    }

    const slotsDoEvento = this.db.horarios.filter((h) => {
      if (h.id_evento !== idEvento || !h.ativo) return false;
      if (isDatasEspecificas) return true;
      return !Array.isArray(h.dias_aplicaveis) || h.dias_aplicaveis.length === 0 || h.dias_aplicaveis.includes(diaSemanaAbrev);
    });

    return slotsDoEvento.map(slot => {
      // Bloqueios administrativos
      const bloqueio = this.db.bloqueios.find(
        b => (b.id_evento === '*' || b.id_evento === idEvento) &&
             b.data === data &&
             (b.hora_inicio === 'ALL_DAY' || b.hora_inicio === slot.hora_inicio)
      );

      // Agendamentos confirmados
      const confirmados = this.db.agendamentos.filter(
        a => a.id_evento === idEvento &&
             a.data_agendamento === data &&
             a.hora_inicio === slot.hora_inicio &&
             a.status === 'CONFIRMADO'
      ).length;

      const capacidade = slot.capacidade || evento.capacidade_padrao || 1;
      const vagasRestantes = Math.max(0, capacidade - confirmados);
      const isBloqueado = !!bloqueio;
      const disponivel = !isBloqueado && vagasRestantes > 0;

      return {
        id_horario: slot.id_horario,
        data,
        hora_inicio: slot.hora_inicio,
        hora_fim: slot.hora_fim,
        capacidade_total: capacidade,
        agendamentos_confirmados: confirmados,
        bloqueado: isBloqueado,
        motivo_bloqueio: bloqueio?.motivo,
        vagas_restantes: isBloqueado ? 0 : vagasRestantes,
        disponivel
      };
    });
  }

  // --- Validação Atômica e Criação de Agendamento (Anti-Overbooking) ---
  public createBooking(payload: BookingSubmissionPayload): BookingSuccessResult {
    const evento = this.db.eventos.find(
      e => e.slug === payload.slug_evento || e.id_evento === payload.slug_evento
    );

    if (!evento) {
      throw new Error('Evento não encontrado.');
    }

    if (evento.status !== 'PUBLICADO') {
      throw new Error('Este evento não está aberto para novos agendamentos no momento.');
    }

    // Identificar capacidade do slot
    const slot = this.db.horarios.find(
      h => h.id_evento === evento.id_evento && h.hora_inicio === payload.hora_inicio && h.ativo
    );
    const capacidadeSlot = slot ? slot.capacidade : (evento.capacidade_padrao || 1);

    // Verificar bloqueios
    const bloqueio = this.db.bloqueios.find(
      b => (b.id_evento === '*' || b.id_evento === evento.id_evento) &&
           b.data === payload.data &&
           (b.hora_inicio === 'ALL_DAY' || b.hora_inicio === payload.hora_inicio)
    );
    if (bloqueio) {
      throw new Error(`Este horário foi bloqueado administrativamente: ${bloqueio.motivo || 'Indisponível'}`);
    }

    // CONTAGEM RÍGIDA DE AGENDAMENTOS EXISTENTES
    const confirmados = this.db.agendamentos.filter(
      a => a.id_evento === evento.id_evento &&
           a.data_agendamento === payload.data &&
           a.hora_inicio === payload.hora_inicio &&
           a.status === 'CONFIRMADO'
    ).length;

    if (confirmados >= capacidadeSlot) {
      this.log('WARN', 'OVERBOOKING_PREVENTED', `Tentativa bloqueada no evento ${evento.nome} em ${payload.data} às ${payload.hora_inicio}`);
      throw new Error(`Vagas esgotadas para este horário (${confirmados}/${capacidadeSlot} vagas preenchidas). Por favor, selecione outro horário disponível.`);
    }

    const nowIso = new Date().toISOString();
    const whatsappNorm = normalizarWhatsApp(payload.whatsapp);
    const emailNorm = (payload.email || '').trim().toLowerCase();
    let localNorm = (payload.local || '').trim();
    if (!localNorm && payload.respostas_customizadas) {
      const camposEvento = this.db.campos_formulario.filter(c => c.id_evento === evento.id_evento);
      for (const [cid, val] of Object.entries(payload.respostas_customizadas)) {
        if (!val || !String(val).trim()) continue;
        const campo = camposEvento.find(c => c.id_campo === cid);
        const refTxt = `${campo?.nome_campo || ''} ${campo?.label || ''}`.toLowerCase();
        if (refTxt.includes('local') || refTxt.includes('escola') || refTxt.includes('bairro')) {
          localNorm = String(val).trim();
          break;
        }
      }
    }

    // Desduplicação do Lead (ignora leads que estejam na lixeira)
    let lead = this.db.leads.find(
      l => !l.excluido && (
           (whatsappNorm && normalizarWhatsApp(l.whatsapp) === whatsappNorm) ||
           (emailNorm && (l.email || '').trim().toLowerCase() === emailNorm)
      )
    );

    let idLead = '';
    if (lead) {
      idLead = lead.id_lead;
      lead.nome = payload.nome || lead.nome;
      if (payload.empresa) lead.empresa = payload.empresa;
      if (localNorm) lead.local = localNorm;
      lead.total_agendamentos += 1;
      lead.data_ultimo_agendamento = nowIso;
      lead.atualizado_em = nowIso;
    } else {
      idLead = `LED-${gerarCodigoAleatorio(6)}`;
      const novoLead: LeadEntity = {
        id_lead: idLead,
        nome: payload.nome,
        whatsapp: whatsappNorm,
        email: emailNorm,
        empresa: payload.empresa || '',
        local: localNorm || undefined,
        status_cliente: 'LEAD',
        origem_primeiro_evento: evento.id_evento,
        total_agendamentos: 1,
        data_ultimo_agendamento: nowIso,
        responsavel_id: evento.responsavel_id || 'USR-001',
        observacoes: `Lead captado automaticamente pelo evento ${evento.nome}`,
        criado_em: nowIso,
        atualizado_em: nowIso
      };
      this.db.leads.unshift(novoLead);
    }

    // Gravar Agendamento
    const dataFmt = payload.data.replace(/-/g, '');
    const protocolo = `PROT-${dataFmt}-${gerarCodigoAleatorio(4)}`;
    const idAgendamento = `AGD-${dataFmt}-${gerarCodigoAleatorio(6)}`;

    const novoAgendamento: AgendamentoEntity = {
      id_agendamento: idAgendamento,
      protocolo,
      id_evento: evento.id_evento,
      id_lead: idLead,
      data_agendamento: payload.data,
      hora_inicio: payload.hora_inicio,
      hora_fim: payload.hora_fim || payload.hora_inicio,
      status: 'CONFIRMADO',
      criado_em: nowIso
    };
    this.db.agendamentos.unshift(novoAgendamento);

    // Gravar Respostas do Formulário Dinâmico
    if (payload.respostas_customizadas) {
      for (const [campoId, valor] of Object.entries(payload.respostas_customizadas)) {
        if (valor !== undefined && valor !== null && valor !== '') {
          this.db.respostas.push({
            id_resposta: `RSP-${gerarCodigoAleatorio(6)}`,
            id_agendamento: idAgendamento,
            id_lead: idLead,
            id_campo: campoId,
            valor: String(valor),
            criado_em: nowIso
          });
        }
      }
    }

    // Criação Automática da Oportunidade no CRM (Coluna ENTRADA) com Produto, Parcelas & Valor do Evento
    const idOportunidade = `CRM-${gerarCodigoAleatorio(6)}`;
    const valorMensal = Number(evento.produto_valor_mensal) || 0;
    const parcelas = Math.max(1, Number(evento.produto_parcelas) || 1);
    const valorProduto = Number(evento.produto_valor) || (valorMensal > 0 ? valorMensal * parcelas : 0);
    const nomeProduto = (evento.produto_nome || '').trim();
    const novaOportunidade: CrmOportunidadeEntity = {
      id_oportunidade: idOportunidade,
      id_lead: idLead,
      id_agendamento_origem: idAgendamento,
      titulo: `Atendimento: ${payload.nome} (${nomeProduto || evento.nome})`,
      produto_nome: nomeProduto || undefined,
      produto_valor_mensal: valorMensal > 0 ? valorMensal : undefined,
      produto_parcelas: valorMensal > 0 ? parcelas : undefined,
      estagio: 'ENTRADA',
      valor_estimado: valorProduto,
      valor_fechado: 0,
      responsavel_id: evento.responsavel_id || 'USR-001',
      data_proximo_followup: payload.data,
      ordem_coluna: 1,
      criado_em: nowIso,
      atualizado_em: nowIso
    };
    this.db.crm.unshift(novaOportunidade);

    // Histórico de CRM
    const parcelaTxt = valorMensal > 0 && parcelas > 1
      ? `${parcelas}x de ${valorMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} = `
      : '';
    const produtoInfo = nomeProduto || valorProduto > 0
      ? ` · Produto: ${nomeProduto || evento.nome} (${parcelaTxt}${valorProduto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`
      : '';
    this.db.historico_crm.unshift({
      id_historico: `HCRM-${gerarCodigoAleatorio(6)}`,
      id_oportunidade: idOportunidade,
      tipo: 'MUDANCA_ESTAGIO',
      estagio_novo: 'ENTRADA',
      descricao: `Oportunidade gerada automaticamente a partir do agendamento ${protocolo}${produtoInfo}`,
      usuario_id: 'SISTEMA',
      criado_em: nowIso
    });

    this.log('INFO', 'BOOKING_CONFIRMED', `Agendamento ${protocolo} criado para ${payload.nome}`);
    this.salvar(this.db);

    return {
      protocolo,
      id_agendamento: idAgendamento,
      id_lead: idLead,
      id_oportunidade_crm: idOportunidade,
      evento_nome: evento.nome,
      data: payload.data,
      hora_inicio: payload.hora_inicio,
      hora_fim: payload.hora_fim || payload.hora_inicio,
      mensagem_confirmacao: evento.mensagem_confirmacao || 'Seu agendamento foi confirmado com sucesso!'
    };
  }

  // --- Execução Atômica na Nuvem (LockService) quando WebApp URL ou GAS_WEBAPP_URL está ativa ---
  public async createBookingWithCloud(payload: BookingSubmissionPayload): Promise<BookingSuccessResult> {
    const cfg = getDriveConfig();
    if (!isCloudActive()) {
      return this.createBooking(payload);
    }

    const res = await executeDriveRequest<{
      status: string;
      data: BookingSuccessResult;
      database?: SheetDatabase;
    }>({
      targetUrl: cfg.webappUrl || undefined,
      action: 'CREATE_BOOKING',
      data: payload,
      apiToken: cfg.apiToken
    });

    if (res.database && Array.isArray(res.database.eventos)) {
      this.replaceDatabase(res.database);
    } else {
      try {
        this.createBooking(payload);
      } catch {
        // já gravado na nuvem
      }
    }

    saveDriveConfig({ syncStatus: 'synced', lastSyncTimestamp: Date.now() });
    return res.data;
  }

  // --- Atualização de Status do Agendamento (Admin: Realizado / Cancelado / Não Compareceu) ---
  public updateAgendamentoStatus(
    idAgendamento: string,
    novoStatus: AgendamentoEntity['status'],
    motivo?: string
  ) {
    const agd = this.db.agendamentos.find(a => a.id_agendamento === idAgendamento);
    if (!agd) return;

    const nowIso = new Date().toISOString();
    agd.status = novoStatus;
    if (novoStatus === 'CANCELADO') {
      agd.motivo_cancelamento = motivo || 'Cancelado administrativamente';
      agd.cancelado_em = nowIso;
    } else {
      agd.motivo_cancelamento = undefined;
      agd.cancelado_em = undefined;
    }

    this.log('INFO', 'BOOKING_STATUS_UPDATED', `Agendamento ${agd.protocolo} marcado como ${novoStatus}.`);
    this.salvar(this.db);
  }

  // --- Consulta / Cancelamento / Remarcação pelo Cliente (Autoatendimento por Protocolo) ---
  public findBookingByProtocol(protocolo: string, contatoVerificacao: string) {
    const protClean = protocolo.trim().toUpperCase();
    const contatoClean = contatoVerificacao.trim().toLowerCase();
    const contatoDigits = normalizarWhatsApp(contatoClean);

    const agd = this.db.agendamentos.find(a => a.protocolo.toUpperCase() === protClean);
    if (!agd) {
      throw new Error('Protocolo não encontrado. Verifique o código informado.');
    }

    const lead = this.db.leads.find(l => l.id_lead === agd.id_lead);
    const evento = this.db.eventos.find(e => e.id_evento === agd.id_evento);
    if (!lead || !evento) {
      throw new Error('Dados do agendamento não encontrados.');
    }

    const leadDigits = normalizarWhatsApp(lead.whatsapp);
    const leadEmail = (lead.email || '').trim().toLowerCase();
    const matchZap =
      Boolean(contatoDigits && leadDigits) &&
      (leadDigits === contatoDigits || leadDigits.slice(-8) === contatoDigits.slice(-8));
    const matchEmail = Boolean(contatoClean && leadEmail) && leadEmail === contatoClean;

    if (!matchZap && !matchEmail) {
      throw new Error('WhatsApp ou e-mail não confere com o cadastro deste protocolo.');
    }

    return { agendamento: agd, lead, evento };
  }

  private assertCancellationWindow(evento: EventoEntity, data: string, horaInicio: string) {
    if (!evento.permite_cancelamento) {
      throw new Error('Este evento não permite cancelamento ou remarcação online.');
    }
    const targetMs = new Date(`${data}T${horaInicio}:00`).getTime();
    if (!Number.isNaN(targetMs)) {
      const diffHours = (targetMs - Date.now()) / (1000 * 60 * 60);
      const minHours = evento.horas_antecedencia_cancelamento || 0;
      if (diffHours < minHours && diffHours > -24) {
        // Permite se falta >= minHours, bloqueia se já está muito próximo
        if (minHours > 0) {
          throw new Error(`Alterações online são permitidas somente com ${minHours}h de antecedência.`);
        }
      }
    }
  }

  public async cancelBookingByProtocol(
    protocolo: string,
    contatoVerificacao: string,
    motivo: string = 'Cancelado pelo cliente na página pública'
  ): Promise<AgendamentoEntity> {
    const { agendamento, evento } = this.findBookingByProtocol(protocolo, contatoVerificacao);
    if (agendamento.status === 'CANCELADO') {
      throw new Error('Este agendamento já foi cancelado.');
    }
    this.assertCancellationWindow(evento, agendamento.data_agendamento, agendamento.hora_inicio);

    if (isCloudActive()) {
      const cfg = getDriveConfig();
      const res = await executeDriveRequest<{ data: AgendamentoEntity; database?: SheetDatabase }>({
        targetUrl: cfg.webappUrl || undefined,
        action: 'CANCEL_BOOKING',
        data: { protocolo, contato: contatoVerificacao, motivo },
        apiToken: cfg.apiToken
      });
      if (res.database && Array.isArray(res.database.eventos)) {
        this.replaceDatabase(res.database);
      }
      return res.data;
    }

    const nowIso = new Date().toISOString();
    agendamento.status = 'CANCELADO';
    agendamento.motivo_cancelamento = motivo;
    agendamento.cancelado_em = nowIso;

    const crmCard = this.db.crm.find(c => c.id_agendamento_origem === agendamento.id_agendamento);
    if (crmCard) {
      const prev = crmCard.estagio;
      crmCard.estagio = 'CANCELADO';
      crmCard.atualizado_em = nowIso;
      this.db.historico_crm.unshift({
        id_historico: `HCRM-${gerarCodigoAleatorio(6)}`,
        id_oportunidade: crmCard.id_oportunidade,
        tipo: 'MUDANCA_ESTAGIO',
        estagio_anterior: prev,
        estagio_novo: 'CANCELADO',
        descricao: `Cancelamento online pelo cliente (${agendamento.protocolo}): ${motivo}`,
        usuario_id: 'CLIENTE',
        criado_em: nowIso
      });
    }

    this.log('INFO', 'BOOKING_CANCELLED', `Protocolo ${agendamento.protocolo} cancelado pelo cliente.`);
    this.salvar(this.db);
    return agendamento;
  }

  public async rescheduleBookingByProtocol(
    protocolo: string,
    contatoVerificacao: string,
    novaData: string,
    novaHoraInicio: string,
    novaHoraFim: string
  ): Promise<AgendamentoEntity> {
    const { agendamento, evento } = this.findBookingByProtocol(protocolo, contatoVerificacao);
    if (agendamento.status === 'CANCELADO') {
      throw new Error('Não é possível remarcar um agendamento cancelado.');
    }
    this.assertCancellationWindow(evento, agendamento.data_agendamento, agendamento.hora_inicio);

    if (isCloudActive()) {
      const cfg = getDriveConfig();
      const res = await executeDriveRequest<{ data: AgendamentoEntity; database?: SheetDatabase }>({
        targetUrl: cfg.webappUrl || undefined,
        action: 'RESCHEDULE_BOOKING',
        data: {
          protocolo,
          contato: contatoVerificacao,
          nova_data: novaData,
          nova_hora_inicio: novaHoraInicio,
          nova_hora_fim: novaHoraFim
        },
        apiToken: cfg.apiToken
      });
      if (res.database && Array.isArray(res.database.eventos)) {
        this.replaceDatabase(res.database);
      }
      return res.data;
    }

    const slots = this.getDisponibilidade(evento.id_evento, novaData);
    const targetSlot = slots.find(s => s.hora_inicio === novaHoraInicio);
    if (!targetSlot || !targetSlot.disponivel) {
      throw new Error('O novo horário selecionado não possui mais vagas disponíveis.');
    }

    const oldDate = `${agendamento.data_agendamento} ${agendamento.hora_inicio}`;
    agendamento.data_agendamento = novaData;
    agendamento.hora_inicio = novaHoraInicio;
    agendamento.hora_fim = novaHoraFim;
    agendamento.status = 'CONFIRMADO';

    this.log('INFO', 'BOOKING_RESCHEDULED', `Protocolo ${agendamento.protocolo} remarcado de ${oldDate} para ${novaData} ${novaHoraInicio}.`);
    this.salvar(this.db);
    return agendamento;
  }

  // --- Operações de Eventos ---
  public saveEvento(evento: EventoEntity, horarios: HorarioEntity[], campos: CampoFormularioEntity[]) {
    const index = this.db.eventos.findIndex(e => e.id_evento === evento.id_evento);
    const nowIso = new Date().toISOString();

    if (index >= 0) {
      this.db.eventos[index] = { ...evento, atualizado_em: nowIso };
    } else {
      this.db.eventos.unshift({ ...evento, criado_em: nowIso, atualizado_em: nowIso });
    }

    // Atualizar horários do evento
    this.db.horarios = this.db.horarios.filter(h => h.id_evento !== evento.id_evento);
    this.db.horarios.push(...horarios);

    // Atualizar campos do formulário
    this.db.campos_formulario = this.db.campos_formulario.filter(c => c.id_evento !== evento.id_evento);
    this.db.campos_formulario.push(...campos);

    this.log('INFO', 'EVENT_SAVED', `Evento ${evento.nome} (${evento.id_evento}) salvo.`);
    this.salvar(this.db);
  }

  public deleteEvento(idEvento: string) {
    this.db.eventos = this.db.eventos.filter(e => e.id_evento !== idEvento);
    this.db.horarios = this.db.horarios.filter(h => h.id_evento !== idEvento);
    this.db.campos_formulario = this.db.campos_formulario.filter(c => c.id_evento !== idEvento);
    this.log('INFO', 'EVENT_DELETED', `Evento ${idEvento} excluído.`);
    this.salvar(this.db);
  }

  public duplicateEvento(idEvento: string): EventoEntity | null {
    const original = this.db.eventos.find(e => e.id_evento === idEvento);
    if (!original) return null;

    const novoId = `EVT-${gerarCodigoAleatorio(4)}`;
    const novoSlug = `${original.slug}-copia-${Date.now().toString().slice(-4)}`;
    const nowIso = new Date().toISOString();

    const novoEvento: EventoEntity = {
      ...original,
      id_evento: novoId,
      slug: novoSlug,
      nome: `${original.nome} (Cópia)`,
      status: 'RASCUNHO',
      criado_em: nowIso,
      atualizado_em: nowIso
    };

    // Duplicar horários
    const novosHorarios = this.db.horarios
      .filter(h => h.id_evento === idEvento)
      .map(h => ({
        ...h,
        id_horario: `SCH-${gerarCodigoAleatorio(4)}`,
        id_evento: novoId
      }));

    // Duplicar campos
    const novosCampos = this.db.campos_formulario
      .filter(c => c.id_evento === idEvento)
      .map(c => ({
        ...c,
        id_campo: `FLD-${gerarCodigoAleatorio(4)}`,
        id_evento: novoId
      }));

    this.db.eventos.unshift(novoEvento);
    this.db.horarios.push(...novosHorarios);
    this.db.campos_formulario.push(...novosCampos);

    this.log('INFO', 'EVENT_DUPLICATED', `Evento ${idEvento} duplicado para ${novoId}`);
    this.salvar(this.db);
    return novoEvento;
  }

  // --- Operações de Bloqueio ---
  public toggleSlotBlock(idEvento: string, data: string, horaInicio: string, motivo?: string) {
    const existingIndex = this.db.bloqueios.findIndex(
      b => (b.id_evento === idEvento || b.id_evento === '*') &&
           b.data === data &&
           b.hora_inicio === horaInicio
    );

    if (existingIndex >= 0) {
      this.db.bloqueios.splice(existingIndex, 1);
      this.log('INFO', 'BLOCK_REMOVED', `Bloqueio removido para ${data} às ${horaInicio}`);
    } else {
      this.db.bloqueios.push({
        id_bloqueio: `BLK-${gerarCodigoAleatorio(6)}`,
        id_evento: idEvento,
        data,
        hora_inicio: horaInicio,
        hora_fim: horaInicio,
        motivo: motivo || 'Bloqueio administrativo',
        criado_por: 'USR-001',
        criado_em: new Date().toISOString()
      });
      this.log('INFO', 'BLOCK_ADDED', `Bloqueio adicionado para ${data} às ${horaInicio}`);
    }
    this.salvar(this.db);
  }

  // --- Operações de CRM Kanban ---
  private syncLeadClientStatusFromCrm(idLead: string, estagioAnterior?: EstagioCrm, novoEstagio?: EstagioCrm) {
    const lead = this.db.leads.find(l => l.id_lead === idLead);
    if (!lead) return;
    const temCompraGanha = this.db.crm.some(c => c.id_lead === idLead && c.estagio === 'GANHO');
    if (temCompraGanha || novoEstagio === 'GANHO') {
      if (lead.status_cliente !== 'CLIENTE') {
        lead.status_cliente = 'CLIENTE';
        lead.atualizado_em = new Date().toISOString();
        this.log('INFO', 'LEAD_CONVERTED_CLIENT', `Lead ${lead.nome} (${idLead}) promovido automaticamente para CLIENTE.`);
      }
    } else if (estagioAnterior === 'GANHO' && novoEstagio) {
      lead.status_cliente = 'LEAD';
      lead.atualizado_em = new Date().toISOString();
    }
  }

  public updateCrmStage(
    idOportunidade: string,
    novoEstagio: EstagioCrm,
    extra?: { valorFechado?: number; motivoPerda?: string; descricao?: string; usuarioId?: string }
  ) {
    const op = this.db.crm.find(c => c.id_oportunidade === idOportunidade);
    if (!op) return;

    const estagioAnt = op.estagio;
    op.estagio = novoEstagio;
    op.atualizado_em = new Date().toISOString();

    if (extra?.valorFechado !== undefined) {
      op.valor_fechado = extra.valorFechado;
    }
    if (extra?.motivoPerda) {
      op.motivo_perda = extra.motivoPerda;
    }
    if (novoEstagio === 'GANHO' || novoEstagio === 'PERDIDO') {
      op.data_fechamento = new Date().toISOString();
    }

    this.syncLeadClientStatusFromCrm(op.id_lead, estagioAnt, novoEstagio);

    this.db.historico_crm.unshift({
      id_historico: `HCRM-${gerarCodigoAleatorio(6)}`,
      id_oportunidade: idOportunidade,
      tipo: 'MUDANCA_ESTAGIO',
      estagio_anterior: estagioAnt,
      estagio_novo: novoEstagio,
      descricao: extra?.descricao || `Estágio movido de ${estagioAnt} para ${novoEstagio}`,
      usuario_id: extra?.usuarioId || 'USR-001',
      criado_em: new Date().toISOString()
    });

    this.log('INFO', 'CRM_STAGE_UPDATED', `Oportunidade ${idOportunidade} movida para ${novoEstagio}`);
    this.salvar(this.db);
  }

  public saveCrmOpportunity(oportunidade: CrmOportunidadeEntity) {
    const index = this.db.crm.findIndex(c => c.id_oportunidade === oportunidade.id_oportunidade);
    const nowIso = new Date().toISOString();
    const estagioAnt = index >= 0 ? this.db.crm[index].estagio : undefined;

    if (index >= 0) {
      this.db.crm[index] = { ...oportunidade, atualizado_em: nowIso };
    } else {
      this.db.crm.unshift({ ...oportunidade, criado_em: nowIso, atualizado_em: nowIso });
    }
    this.syncLeadClientStatusFromCrm(oportunidade.id_lead, estagioAnt, oportunidade.estagio);
    this.salvar(this.db);
  }

  public addCrmHistory(idOportunidade: string, tipo: any, descricao: string, usuarioId: string = 'USR-001') {
    this.db.historico_crm.unshift({
      id_historico: `HCRM-${gerarCodigoAleatorio(6)}`,
      id_oportunidade: idOportunidade,
      tipo,
      descricao,
      usuario_id: usuarioId,
      criado_em: new Date().toISOString()
    });
    this.salvar(this.db);
  }

  public toggleCardFollowStand(idOportunidade: string, modoForcado?: 'FOLLOW' | 'STAND'): 'FOLLOW' | 'STAND' {
    const op = this.db.crm.find(c => c.id_oportunidade === idOportunidade);
    if (!op) return 'FOLLOW';

    const modoAtual: 'FOLLOW' | 'STAND' = op.sub_status || (op.estagio === 'STAND_BY' ? 'STAND' : 'FOLLOW');
    const proximoModo: 'FOLLOW' | 'STAND' = modoForcado || (modoAtual === 'FOLLOW' ? 'STAND' : 'FOLLOW');

    op.sub_status = proximoModo;
    op.atualizado_em = new Date().toISOString();

    this.addCrmHistory(
      idOportunidade,
      'MUDANCA_ESTAGIO',
      `Status do card alternado para ${proximoModo === 'FOLLOW' ? '⚡ Follow-up (Amarelo)' : '⏸ Stand By (Cinza)'}`
    );
    this.salvar(this.db);
    return proximoModo;
  }

  // --- Operações de Lead & Lixeira ---
  public updateLead(lead: LeadEntity) {
    const index = this.db.leads.findIndex(l => l.id_lead === lead.id_lead);
    if (index >= 0) {
      this.db.leads[index] = { ...lead, atualizado_em: new Date().toISOString() };
      this.salvar(this.db);
    }
  }

  public updateLeadClientStatus(idLead: string, novoStatus: StatusClienteLead) {
    const lead = this.db.leads.find(l => l.id_lead === idLead);
    if (!lead) return;
    lead.status_cliente = novoStatus;
    lead.atualizado_em = new Date().toISOString();
    this.log('INFO', 'LEAD_STATUS_UPDATED', `Status comercial de ${lead.nome} (${idLead}) alterado para ${novoStatus}.`);
    this.salvar(this.db);
  }

  public moveLeadToTrash(idLead: string) {
    const lead = this.db.leads.find(l => l.id_lead === idLead);
    if (!lead) return;
    lead.excluido = true;
    lead.excluido_em = new Date().toISOString();
    lead.atualizado_em = new Date().toISOString();
    this.log('INFO', 'LEAD_MOVED_TO_TRASH', `Lead ${lead.nome} (${idLead}) movido para a lixeira.`);
    this.salvar(this.db);
  }

  public restoreLeadFromTrash(idLead: string) {
    const lead = this.db.leads.find(l => l.id_lead === idLead);
    if (!lead) return;
    lead.excluido = false;
    lead.excluido_em = undefined;
    lead.atualizado_em = new Date().toISOString();
    this.log('INFO', 'LEAD_RESTORED', `Lead ${lead.nome} (${idLead}) restaurado da lixeira.`);
    this.salvar(this.db);
  }

  private purgeLeadsByIds(idsToPurge: Set<string>) {
    if (idsToPurge.size === 0) return;
    const crmIdsToPurge = new Set(
      this.db.crm.filter(c => idsToPurge.has(c.id_lead)).map(c => c.id_oportunidade)
    );
    this.db.leads = this.db.leads.filter(l => !idsToPurge.has(l.id_lead));
    this.db.agendamentos = this.db.agendamentos.filter(a => !idsToPurge.has(a.id_lead));
    this.db.respostas = this.db.respostas.filter(r => !idsToPurge.has(r.id_lead));
    this.db.crm = this.db.crm.filter(c => !idsToPurge.has(c.id_lead));
    this.db.historico_crm = this.db.historico_crm.filter(h => !crmIdsToPurge.has(h.id_oportunidade));
    this.db.tarefas = this.db.tarefas.filter(t => !t.id_lead || !idsToPurge.has(t.id_lead));
  }

  public permanentlyDeleteLead(idLead: string) {
    const lead = this.db.leads.find(l => l.id_lead === idLead);
    this.purgeLeadsByIds(new Set([idLead]));
    this.log('AUDIT', 'LEAD_DELETED_PERMANENT', `Lead ${lead?.nome || idLead} (${idLead}) excluído definitivamente.`);
    this.salvar(this.db);
  }

  public emptyLeadsTrash() {
    const trashedIds = new Set(this.db.leads.filter(l => l.excluido).map(l => l.id_lead));
    const count = trashedIds.size;
    if (count === 0) return;
    this.purgeLeadsByIds(trashedIds);
    this.log('AUDIT', 'LEADS_TRASH_EMPTIED', `${count} lead(s) removido(s) definitivamente ao limpar a lixeira.`);
    this.salvar(this.db);
  }

  public updateConfig(chave: string, valor: string) {
    const item = this.db.config.find(c => c.chave === chave);
    if (item) {
      item.valor = valor;
      item.atualizado_em = new Date().toISOString();
    } else {
      this.db.config.push({
        chave,
        valor,
        descricao: '',
        atualizado_em: new Date().toISOString()
      });
    }
    this.salvar(this.db);
  }

  private log(nivel: LogEntity['nivel'], acao: string, detalhes: string) {
    this.db.logs.unshift({
      id_log: `LOG-${gerarCodigoAleatorio(6)}`,
      nivel,
      origem: 'WEBAPP',
      acao,
      detalhes,
      timestamp: new Date().toISOString()
    });
    // Manter últimos 500 logs
    if (this.db.logs.length > 500) {
      this.db.logs = this.db.logs.slice(0, 500);
    }
  }
}

export const storage = new StorageService();
