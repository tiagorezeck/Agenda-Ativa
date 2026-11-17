import { UsuarioEntity, PerfilUsuario, UsuarioPermissoes } from '../types/database';

const CURRENT_USER_KEY = 'agenda_ativa_current_user';

export function getDefaultPermissoesForPerfil(perfil: PerfilUsuario): UsuarioPermissoes {
  if (perfil === 'ADMIN') {
    return {
      dashboard: true,
      eventos: true,
      disponibilidade: true,
      formularios: true,
      leads: true,
      crm: true,
      metas: true,
      qrcode: true,
      config_empresa: true,
      config_usuarios: true,
      config_banco: true,
      config_engseg: true,
      apenas_proprios_eventos: false
    };
  }

  if (perfil === 'GESTOR' || perfil === 'COMERCIAL') {
    return {
      dashboard: true,
      eventos: true,
      disponibilidade: true,
      formularios: true,
      leads: true,
      crm: true,
      metas: true,
      qrcode: true,
      config_empresa: true,
      config_usuarios: true,
      config_banco: false,
      config_engseg: false,
      apenas_proprios_eventos: false
    };
  }

  // Padrão para AGENTE / ATENDENTE: acessar apenas leads e agenda dos próprios eventos
  return {
    dashboard: true,
    eventos: true,
    disponibilidade: true,
    formularios: false,
    leads: true,
    crm: true,
    metas: true,
    qrcode: true,
    config_empresa: false,
    config_usuarios: true,
    config_banco: false,
    config_engseg: false,
    apenas_proprios_eventos: true
  };
}

export const DEFAULT_USERS: UsuarioEntity[] = [
  {
    id_usuario: 'USR-001',
    nome: 'Administrador',
    email: 'admin',
    senha: 'admin',
    cargo: 'Administrador',
    departamento: 'Administração',
    perfil: 'ADMIN',
    permissoes: getDefaultPermissoesForPerfil('ADMIN'),
    ativo: true,
    criado_em: '2026-01-01T00:00:00.000Z'
  }
];

export function getEffectivePermissoes(user: UsuarioEntity): Required<UsuarioPermissoes> {
  const base = getDefaultPermissoesForPerfil(user.perfil);
  const custom = user.permissoes || {};
  if (user.perfil === 'ADMIN') {
    return getDefaultPermissoesForPerfil('ADMIN') as Required<UsuarioPermissoes>;
  }
  return {
    dashboard: custom.dashboard ?? base.dashboard ?? true,
    eventos: custom.eventos ?? base.eventos ?? true,
    disponibilidade: custom.disponibilidade ?? base.disponibilidade ?? true,
    formularios: custom.formularios ?? base.formularios ?? false,
    leads: custom.leads ?? base.leads ?? true,
    crm: custom.crm ?? base.crm ?? true,
    metas: custom.metas ?? base.metas ?? true,
    qrcode: custom.qrcode ?? base.qrcode ?? true,
    config_empresa: custom.config_empresa ?? base.config_empresa ?? false,
    config_usuarios: custom.config_usuarios ?? base.config_usuarios ?? false,
    config_banco: custom.config_banco ?? base.config_banco ?? false,
    config_engseg: custom.config_engseg ?? base.config_engseg ?? false,
    apenas_proprios_eventos: custom.apenas_proprios_eventos ?? base.apenas_proprios_eventos ?? true
  };
}

export function authenticateUser(
  email: string,
  senha: string,
  dbUsers: UsuarioEntity[] = []
): { ok: true; user: UsuarioEntity } | { ok: false; error: string } {
  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm) {
    return { ok: false, error: 'Informe seu login ou e-mail de acesso.' };
  }

  const combined = [...(dbUsers || [])];
  for (const def of DEFAULT_USERS) {
    if (!combined.some(u => u.id_usuario === def.id_usuario || u.email.toLowerCase() === def.email.toLowerCase())) {
      combined.push(def);
    }
  }

  const found = combined.find(u => u.email.trim().toLowerCase() === emailNorm);
  if (!found) {
    return { ok: false, error: 'Login ou e-mail não encontrado. Verifique ou solicite um novo cadastro.' };
  }

  if (found.ativo === false) {
    return { ok: false, error: 'Sua conta aguarda autorização do Administrador ou Gestor.' };
  }

  const fallbackDefault = DEFAULT_USERS.find(
    d => d.id_usuario === found.id_usuario || d.email.toLowerCase() === emailNorm
  );
  const expectedPassword = found.senha !== undefined && found.senha !== ''
    ? found.senha
    : (fallbackDefault?.senha || '');

  if (expectedPassword) {
    if (!senha) {
      return { ok: false, error: 'Informe sua senha de acesso.' };
    }
    if (senha !== expectedPassword) {
      return { ok: false, error: 'Senha incorreta. Tente novamente.' };
    }
  }

  return { ok: true, user: found };
}

export function getLoggedInUser(): UsuarioEntity {
  if (typeof window === 'undefined') return DEFAULT_USERS[0];
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id_usuario) return parsed;
    }
  } catch (e) {
    console.warn('Erro ao ler usuário logado:', e);
  }
  return DEFAULT_USERS[0];
}

export function setLoggedInUser(user: UsuarioEntity): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event('auth_user_changed'));
}

export function logoutUser(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CURRENT_USER_KEY);
  window.dispatchEvent(new Event('auth_user_changed'));
}

/**
 * Regras de Permissão RBAC (Admin, Gestor, Agente + permissões granulares)
 */
export function podeAcessarModulo(
  user: UsuarioEntity,
  modulo: keyof Omit<UsuarioPermissoes, 'apenas_proprios_eventos'>
): boolean {
  const perms = getEffectivePermissoes(user);
  return Boolean(perms[modulo]);
}

export function podeAcessarConfigEmpresa(user: UsuarioEntity): boolean {
  return podeAcessarModulo(user, 'config_empresa');
}

export function podeAcessarConfigUsuarios(user: UsuarioEntity): boolean {
  return podeAcessarModulo(user, 'config_usuarios');
}

export function podeAcessarConfigBanco(user: UsuarioEntity): boolean {
  return podeAcessarModulo(user, 'config_banco');
}

export function podeAcessarConfigEngseg(user: UsuarioEntity): boolean {
  return podeAcessarModulo(user, 'config_engseg');
}

export function podeAcessarConfiguracoes(user: UsuarioEntity): boolean {
  return (
    podeAcessarConfigEmpresa(user) ||
    podeAcessarConfigUsuarios(user) ||
    podeAcessarConfigBanco(user) ||
    podeAcessarConfigEngseg(user)
  );
}

export function podeGerenciarSegurancaESync(user: UsuarioEntity): boolean {
  return user.perfil === 'ADMIN' || podeAcessarConfigBanco(user) || podeAcessarConfigEngseg(user);
}

export function podeGerenciarUsuarios(user: UsuarioEntity): boolean {
  return user.perfil === 'ADMIN' || podeAcessarConfigUsuarios(user);
}

export function podeGerenciarEventos(user: UsuarioEntity): boolean {
  return user.perfil === 'ADMIN' || user.perfil === 'GESTOR' || user.perfil === 'COMERCIAL' || podeAcessarModulo(user, 'eventos');
}

export function isAdminUser(user: UsuarioEntity): boolean {
  return user.perfil === 'ADMIN';
}

export function isGestorUser(user: UsuarioEntity): boolean {
  return user.perfil === 'GESTOR' || user.perfil === 'COMERCIAL';
}

export function podeCriarOuAprovarUsuarios(user: UsuarioEntity): boolean {
  return isAdminUser(user) || isGestorUser(user);
}

/**
 * Regras de edição de perfis:
 * - Admin: pode editar todos os perfis
 * - Gestor: pode editar todos, menos Admin
 * - Agente: só pode editar o próprio perfil
 */
export function podeEditarUsuario(actor: UsuarioEntity, target: UsuarioEntity): boolean {
  if (isAdminUser(actor)) return true;
  if (isGestorUser(actor)) {
    return target.perfil !== 'ADMIN' && target.id_usuario !== 'USR-001';
  }
  return actor.id_usuario === target.id_usuario;
}

export function podeAcessarTodoCrm(user: UsuarioEntity): boolean {
  const perms = getEffectivePermissoes(user);
  if (user.perfil === 'ADMIN' || user.perfil === 'GESTOR' || user.perfil === 'COMERCIAL') {
    return !user.permissoes?.apenas_proprios_eventos;
  }
  return !perms.apenas_proprios_eventos;
}
