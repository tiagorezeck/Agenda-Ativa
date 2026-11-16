/**
 * Utilitários de Formatação, Máscaras e Fuso Horário (America/Sao_Paulo)
 */

export function formatarDataBR(dataIsoOuDate?: string | Date): string {
  if (!dataIsoOuDate) return '-';
  try {
    const dataStr = typeof dataIsoOuDate === 'string' ? dataIsoOuDate : dataIsoOuDate.toISOString();
    // Se for formato simples YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
      const [ano, mes, dia] = dataStr.split('-');
      return `${dia}/${mes}/${ano}`;
    }
    const d = new Date(dataIsoOuDate);
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(d);
  } catch {
    return String(dataIsoOuDate);
  }
}

export function formatarDataHoraBR(dataIsoOuDate?: string | Date): string {
  if (!dataIsoOuDate) return '-';
  try {
    const d = new Date(dataIsoOuDate);
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch {
    return String(dataIsoOuDate);
  }
}

export function formatarMoedaBRL(valor: number = 0): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

export function aplicarMascaraTelefoneBR(tel: string = ''): string {
  let limpo = tel.replace(/\D/g, '');
  if (!limpo) return '';

  // Remove DDI 55 quando colado com 12+ dígitos para manter o padrão (XX) XXXXX-XXXX
  if (limpo.startsWith('55') && limpo.length >= 12) {
    limpo = limpo.slice(2);
  }

  limpo = limpo.slice(0, 11);

  if (limpo.length <= 2) {
    return `(${limpo}`;
  }
  if (limpo.length <= 6) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2)}`;
  }
  if (limpo.length <= 10) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
  }
  return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
}

export function isTelefoneBRValido(tel: string = ''): boolean {
  let limpo = tel.replace(/\D/g, '');
  if (limpo.startsWith('55') && limpo.length >= 12) {
    limpo = limpo.slice(2);
  }
  return limpo.length === 10 || limpo.length === 11;
}

export function sanitizarEmailInput(email: string = ''): string {
  return email.replace(/\s+/g, '');
}

export function isEmailValido(email: string = ''): boolean {
  const clean = email.trim();
  if (!clean) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
}

export function formatarTelefoneBR(tel: string = ''): string {
  const limpo = tel.replace(/\D/g, '');
  if (!limpo) return '';

  // Se tiver 55 no início e mais de 11 dígitos, remove para formatar exibição
  let semDdi = limpo;
  if (semDdi.startsWith('55') && semDdi.length >= 12) {
    semDdi = semDdi.substring(2);
  }

  if (semDdi.length === 11) {
    return `(${semDdi.slice(0, 2)}) ${semDdi.slice(2, 7)}-${semDdi.slice(7)}`;
  }
  if (semDdi.length === 10) {
    return `(${semDdi.slice(0, 2)}) ${semDdi.slice(2, 6)}-${semDdi.slice(6)}`;
  }
  return tel;
}

export function normalizarWhatsApp(tel: string = ''): string {
  const limpo = tel.replace(/\D/g, '');
  if (!limpo) return '';
  if (limpo.startsWith('55')) return limpo;
  if (limpo.length >= 10) return `55${limpo}`;
  return limpo;
}

export function gerarLinkWhatsApp(numero: string, mensagem: string): string {
  const norm = normalizarWhatsApp(numero);
  const msgEnc = encodeURIComponent(mensagem);
  return `https://wa.me/${norm}?text=${msgEnc}`;
}

export function gerarCodigoAleatorio(tamanho: number = 4): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let res = '';
  for (let i = 0; i < tamanho; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

export function obterDiaSemanaAbrev(diaStr: string): string {
  // Recebe 'YYYY-MM-DD' e retorna 'SEG', 'TER', etc.
  try {
    const [ano, mes, dia] = diaStr.split('-').map(Number);
    const d = new Date(ano, mes - 1, dia);
    const diaNum = d.getDay(); // 0 = DOM, 1 = SEG ...
    const mapa = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
    return mapa[diaNum];
  } catch {
    return '';
  }
}

export const DIAS_SEMANA_MAP: Record<string, string> = {
  SEG: 'Segunda-feira',
  TER: 'Terça-feira',
  QUA: 'Quarta-feira',
  QUI: 'Quinta-feira',
  SEX: 'Sexta-feira',
  SAB: 'Sábado',
  DOM: 'Domingo'
};
