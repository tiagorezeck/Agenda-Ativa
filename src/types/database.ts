/**
 * Definições de Tipos para as 13 Abas do Google Sheets
 * Sistema de Agendamento, Captação de Leads e CRM
 */

export interface ConfigEntity {
  chave: string;
  valor: string;
  descricao: string;
  atualizado_em: string;
}

export type PerfilUsuario = 'ADMIN' | 'ATENDENTE' | 'COMERCIAL';

export interface UsuarioEntity {
  id_usuario: string; // ex: USR-001
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  ativo: boolean;
  criado_em: string;
}

export type StatusEvento = 'PUBLICADO' | 'PAUSADO' | 'ENCERRADO' | 'RASCUNHO';

export type ModoDatasEvento = 'RECORRENTE' | 'PERIODO' | 'DATAS_ESPECIFICAS';

export interface EventoEntity {
  id_evento: string; // ex: EVT-001
  slug: string; // ex: mentoria-comercial
  nome: string;
  descricao: string;
  imagem_url?: string;
  produto_nome?: string; // Produto ou serviço atrelado ao evento
  produto_valor_mensal?: number; // Valor mensal / por parcela (R$)
  produto_parcelas?: number; // Quantidade de parcelas / meses
  produto_valor?: number; // Valor total final do produto (valor_mensal * parcelas)
  exibir_produto_publico?: boolean; // Se exibe o produto/valor na página pública
  solicitar_local?: boolean; // Ativa pergunta obrigatória de Local (Escola, Bairro, etc.) no agendamento
  label_local?: string; // Rótulo da pergunta de local (ex: "De qual escola você veio?")
  local_opcoes?: string[]; // Opções pré-cadastradas (ex: Lista de escolas ou bairros); vazio = texto livre
  modo_datas?: ModoDatasEvento; // Recorrente semanal, período fechado ou datas específicas
  recorrencia_ativa?: boolean; // Repete toda semana nos dias marcados até desativar
  datas_especificas?: string[]; // Lista de datas distintas ['YYYY-MM-DD', ...]
  data_inicio: string; // YYYY-MM-DD
  data_fim: string; // YYYY-MM-DD (vazio se recorrente contínuo)
  dias_semana: string[]; // ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM']
  duracao_minutos: number; // ex: 45
  intervalo_minutos: number; // ex: 15
  capacidade_padrao: number; // ex: 5
  responsavel_id: string; // FK -> Usuario
  status: StatusEvento;
  mensagem_confirmacao: string;
  permite_cancelamento: boolean;
  horas_antecedencia_cancelamento: number;
  criado_em: string;
  atualizado_em: string;
}

export interface HorarioEntity {
  id_horario: string; // ex: SCH-001
  id_evento: string; // FK -> Evento
  hora_inicio: string; // HH:mm (ex: 09:00)
  hora_fim: string; // HH:mm (ex: 10:00)
  capacidade: number; // ex: 5
  dias_aplicaveis: string[]; // ['SEG', 'TER', ...]
  ativo: boolean;
}

export interface BloqueioEntity {
  id_bloqueio: string; // ex: BLK-001
  id_evento: string; // '*' para todos ou id específico
  data: string; // YYYY-MM-DD
  hora_inicio: string; // HH:mm ou 'ALL_DAY'
  hora_fim: string; // HH:mm
  motivo: string;
  criado_por: string; // FK -> Usuario
  criado_em: string;
}

export type StatusAgendamento = 'CONFIRMADO' | 'REALIZADO' | 'CANCELADO' | 'NO_SHOW';

export interface AgendamentoEntity {
  id_agendamento: string; // ex: AGD-202611-0001
  protocolo: string; // ex: PROT-202611-X7K9
  id_evento: string; // FK -> Evento
  id_lead: string; // FK -> Lead
  data_agendamento: string; // YYYY-MM-DD
  hora_inicio: string; // HH:mm
  hora_fim: string; // HH:mm
  status: StatusAgendamento;
  motivo_cancelamento?: string;
  cancelado_em?: string;
  criado_em: string;
}

export type StatusClienteLead = 'LEAD' | 'CLIENTE';

export interface LeadEntity {
  id_lead: string; // ex: LED-0001
  nome: string;
  whatsapp: string; // ex: 5511999998888
  email: string;
  empresa?: string;
  cargo?: string;
  local?: string; // Local / Campanha específica (ex: Escola, Bairro, Unidade)
  status_cliente?: StatusClienteLead; // 'LEAD' ou 'CLIENTE' (promovido automaticamente ao fechar venda)
  origem_primeiro_evento: string; // FK -> Evento
  total_agendamentos: number;
  data_ultimo_agendamento: string;
  responsavel_id: string; // FK -> Usuario
  observacoes?: string;
  excluido?: boolean; // Encaminhado para Lixeira
  excluido_em?: string; // Data/hora em que foi movido para Lixeira
  criado_em: string;
  atualizado_em: string;
}

export type TipoCampoFormulario =
  | 'TEXTO_CURTO'
  | 'TEXTO_LONGO'
  | 'TELEFONE'
  | 'EMAIL'
  | 'NUMERO'
  | 'DATA'
  | 'SELECAO_UNICA'
  | 'SELECAO_MULTIPLA'
  | 'SIM_NAO';

export interface CampoFormularioEntity {
  id_campo: string; // ex: FLD-001
  id_evento: string; // FK -> Evento
  nome_campo: string; // identificador (ex: cargo_atual)
  label: string; // visual (ex: Qual é o seu cargo atual?)
  tipo: TipoCampoFormulario;
  obrigatorio: boolean;
  placeholder?: string;
  opcoes?: string[]; // lista para SELECAO_UNICA e SELECAO_MULTIPLA
  ordem: number;
  ativo: boolean;
}

export interface RespostaEntity {
  id_resposta: string; // ex: RSP-0001
  id_agendamento: string; // FK -> Agendamento
  id_lead: string; // FK -> Lead
  id_campo: string; // FK -> CampoFormulario
  valor: string;
  criado_em: string;
}

export type EstagioCrm =
  | 'ENTRADA'
  | 'REUNIAO'
  | 'FOLLOW_UP'
  | 'STAND_BY'
  | 'FOLLOW_UP_STAND_BY'
  | 'GANHO'
  | 'PERDIDO'
  | 'CANCELADO';

export interface CrmOportunidadeEntity {
  id_oportunidade: string; // ex: CRM-0001
  id_lead: string; // FK -> Lead
  id_agendamento_origem?: string; // FK -> Agendamento
  titulo: string;
  produto_nome?: string; // Produto atrelado do evento
  produto_valor_mensal?: number; // Valor mensal / parcela
  produto_parcelas?: number; // Número de parcelas
  estagio: EstagioCrm;
  sub_status?: 'FOLLOW' | 'STAND'; // 'FOLLOW' (amarelo) ou 'STAND' (cinza)
  valor_estimado: number;
  valor_fechado?: number;
  responsavel_id: string; // FK -> Usuario
  data_proximo_followup?: string; // YYYY-MM-DD
  motivo_perda?: string;
  data_fechamento?: string;
  ordem_coluna: number;
  criado_em: string;
  atualizado_em: string;
}

export type TipoHistoricoCrm =
  | 'MUDANCA_ESTAGIO'
  | 'NOTA'
  | 'LIGACAO'
  | 'REUNIAO'
  | 'PROPOSTA';

export interface HistoricoCrmEntity {
  id_historico: string; // ex: HCRM-0001
  id_oportunidade: string; // FK -> CrmOportunidade
  tipo: TipoHistoricoCrm;
  estagio_anterior?: string;
  estagio_novo?: string;
  descricao: string;
  usuario_id: string; // FK -> Usuario
  criado_em: string;
}

export interface TarefaEntity {
  id_tarefa: string; // ex: TSK-0001
  id_oportunidade?: string; // FK -> CrmOportunidade
  id_lead?: string; // FK -> Lead
  titulo: string;
  descricao?: string;
  data_vencimento: string; // YYYY-MM-DD
  concluida: boolean;
  responsavel_id: string; // FK -> Usuario
  criada_em: string;
  concluida_em?: string;
}

export type NivelLog = 'INFO' | 'WARN' | 'ERROR' | 'AUDIT';

export interface LogEntity {
  id_log: string; // ex: LOG-0001
  nivel: NivelLog;
  origem: string; // ex: WEBAPP, PUBLIC_BOOKING
  acao: string; // ex: LOCK_ACQUIRED, BOOKING_CONFIRMED
  detalhes: string;
  ip_ou_user_agent?: string;
  timestamp: string;
}

/**
 * Estado Consolidado do Banco de Dados no Google Sheets (13 Abas)
 */
export interface SheetDatabase {
  config: ConfigEntity[];
  usuarios: UsuarioEntity[];
  eventos: EventoEntity[];
  horarios: HorarioEntity[];
  bloqueios: BloqueioEntity[];
  agendamentos: AgendamentoEntity[];
  leads: LeadEntity[];
  campos_formulario: CampoFormularioEntity[];
  respostas: RespostaEntity[];
  crm: CrmOportunidadeEntity[];
  historico_crm: HistoricoCrmEntity[];
  tarefas: TarefaEntity[];
  logs: LogEntity[];
}

/**
 * Informações de Slot com Cálculo em Tempo Real de Vagas Restantes
 */
export interface SlotDisponibilidade {
  id_horario: string;
  data: string; // YYYY-MM-DD
  hora_inicio: string; // HH:mm
  hora_fim: string; // HH:mm
  capacidade_total: number;
  agendamentos_confirmados: number;
  bloqueado: boolean;
  motivo_bloqueio?: string;
  vagas_restantes: number;
  disponivel: boolean;
}
