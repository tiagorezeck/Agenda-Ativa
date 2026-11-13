/**
 * Contratos de API para interação com Google Apps Script Web App
 */

import {
  EventoEntity,
  HorarioEntity,
  BloqueioEntity,
  AgendamentoEntity,
  LeadEntity,
  CampoFormularioEntity,
  CrmOportunidadeEntity,
  SlotDisponibilidade,
  SheetDatabase,
} from './database';

export type GasAction =
  | 'GET_DATABASE'
  | 'GET_EVENT_BY_SLUG'
  | 'GET_SLOTS_AVAILABILITY'
  | 'CREATE_BOOKING'
  | 'SAVE_EVENT'
  | 'DELETE_EVENT'
  | 'DUPLICATE_EVENT'
  | 'TOGGLE_SLOT_BLOCK'
  | 'UPDATE_CRM_STAGE'
  | 'SAVE_CRM_OPPORTUNITY'
  | 'ADD_CRM_HISTORY'
  | 'SAVE_LEAD'
  | 'UPDATE_CONFIG';

export interface GasBaseResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface BookingSubmissionPayload {
  slug_evento: string;
  data: string; // YYYY-MM-DD
  hora_inicio: string; // HH:mm
  hora_fim: string; // HH:mm
  nome: string;
  whatsapp: string;
  email: string;
  empresa?: string;
  respostas_customizadas: Record<string, string>; // campo_id -> valor
}

export interface BookingSuccessResult {
  protocolo: string;
  id_agendamento: string;
  id_lead: string;
  id_oportunidade_crm: string;
  evento_nome: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  mensagem_confirmacao: string;
}

export interface GasApiPayload {
  action: GasAction;
  payload?: any;
}
