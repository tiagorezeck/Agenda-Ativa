import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  Search,
  Shield,
  ShieldAlert,
  Briefcase,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Camera,
  X,
  Check,
  Edit3,
  Trash2,
  Power,
  KeyRound,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';
import { storage } from '../../services/storageService';
import {
  DEFAULT_USERS,
  getDefaultPermissoesForPerfil,
  getEffectivePermissoes,
  getLoggedInUser,
  isAdminUser,
  isGestorUser,
  podeCriarOuAprovarUsuarios,
  podeEditarUsuario
} from '../../services/authService';
import { PerfilUsuario, UsuarioEntity, UsuarioPermissoes } from '../../types/database';
import { compressImageFileToDataUrl } from '../../utils/imageCompressor';
import {
  aplicarMascaraTelefoneBR,
  isEmailValido,
  sanitizarEmailInput
} from '../../utils/formatters';

interface UsersViewProps {
  onDataSynced?: () => void;
  onlySelf?: boolean;
}

const PERMISSION_LABELS: {
  key: keyof UsuarioPermissoes;
  label: string;
  group: 'modulos' | 'escopo' | 'config';
}[] = [
  { key: 'dashboard', label: 'Dashboard Executivo', group: 'modulos' },
  { key: 'eventos', label: 'Gestão de Eventos', group: 'modulos' },
  { key: 'disponibilidade', label: 'Disponibilidade & Bloqueios', group: 'modulos' },
  { key: 'formularios', label: 'Formulários Dinâmicos', group: 'modulos' },
  { key: 'leads', label: 'Leads & Cadastros', group: 'modulos' },
  { key: 'crm', label: 'CRM Kanban Comercial', group: 'modulos' },
  { key: 'metas', label: 'Metas & Desempenho', group: 'modulos' },
  { key: 'qrcode', label: 'Links e QR Codes', group: 'modulos' },
  { key: 'apenas_proprios_eventos', label: 'Restringir Leads/CRM aos próprios eventos', group: 'escopo' },
  { key: 'config_empresa', label: 'Config: Dados da Empresa', group: 'config' },
  { key: 'config_usuarios', label: 'Config: Usuários & Permissões', group: 'config' },
  { key: 'config_banco', label: 'Config: Banco de Dados (Drive/Sheets)', group: 'config' },
  { key: 'config_engseg', label: 'Config: Segurança Engseg (2FA)', group: 'config' }
];

function gerarSenhaForte(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let out = '';
  for (let i = 0; i < 10; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export const UsersView: React.FC<UsersViewProps> = ({ onDataSynced, onlySelf = false }) => {
  const [currentUser, setCurrentUser] = useState<UsuarioEntity>(() => getLoggedInUser());
  const [usuarios, setUsuarios] = useState<UsuarioEntity[]>(() => {
    const db = storage.getDatabase();
    return db.usuarios && db.usuarios.length > 0 ? db.usuarios : DEFAULT_USERS;
  });

  const [busca, setBusca] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState<'TODOS' | 'ADMIN' | 'GESTOR' | 'AGENTE'>('TODOS');
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | 'ATIVOS' | 'PENDENTES'>('TODOS');

  // Modal Criar / Editar Usuário
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSenha, setFormSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [formFotoUrl, setFormFotoUrl] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [formCargo, setFormCargo] = useState('');
  const [formDepartamento, setFormDepartamento] = useState('');
  const [formObservacoes, setFormObservacoes] = useState('');
  const [formPerfil, setFormPerfil] = useState<PerfilUsuario>('AGENTE');
  const [formAtivo, setFormAtivo] = useState(true);
  const [formPermissoes, setFormPermissoes] = useState<UsuarioPermissoes>(() =>
    getDefaultPermissoesForPerfil('AGENTE')
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    const syncUsers = () => {
      const db = storage.getDatabase();
      setUsuarios([...(db.usuarios && db.usuarios.length > 0 ? db.usuarios : DEFAULT_USERS)]);
    };
    const handleAuth = () => setCurrentUser(getLoggedInUser());

    const unsub = storage.subscribe(syncUsers);
    window.addEventListener('auth_user_changed', handleAuth);
    return () => {
      unsub();
      window.removeEventListener('auth_user_changed', handleAuth);
    };
  }, []);

  const isAdmin = isAdminUser(currentUser);
  const isGestor = isGestorUser(currentUser);
  const canCreateOrApprove = !onlySelf && podeCriarOuAprovarUsuarios(currentUser);
  const pendentes = canCreateOrApprove ? usuarios.filter(u => u.ativo === false) : [];
  const ativos = usuarios.filter(u => u.ativo !== false);

  const showSuccessToast = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const openCreateModal = () => {
    if (!canCreateOrApprove) return;
    setEditingUserId(null);
    setFormNome('');
    setFormEmail('');
    setFormSenha('');
    setShowSenha(false);
    setFormFotoUrl('');
    setFormTelefone('');
    setFormCargo('');
    setFormDepartamento('');
    setFormObservacoes('');
    setFormPerfil('AGENTE');
    setFormAtivo(true);
    setFormPermissoes(getDefaultPermissoesForPerfil('AGENTE'));
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (u: UsuarioEntity) => {
    if (!podeEditarUsuario(currentUser, u)) {
      showSuccessToast(
        isGestor
          ? 'Gestores não podem editar perfis de Administrador.'
          : 'Agentes podem editar apenas o próprio perfil.'
      );
      return;
    }
    setEditingUserId(u.id_usuario);
    setFormNome(u.nome);
    setFormEmail(u.email);
    setFormSenha('');
    setShowSenha(false);
    setFormFotoUrl(u.foto_url || '');
    setFormTelefone(u.telefone ? aplicarMascaraTelefoneBR(u.telefone) : '');
    setFormCargo(u.cargo || '');
    setFormDepartamento(u.departamento || '');
    setFormObservacoes(u.observacoes || '');
    setFormPerfil(u.perfil);
    setFormAtivo(u.ativo !== false);
    setFormPermissoes(getEffectivePermissoes(u));
    setFormError(null);
    setModalOpen(true);
  };

  const handlePerfilChangeInModal = (novoPerfil: PerfilUsuario) => {
    if (!canCreateOrApprove) return;
    setFormPerfil(novoPerfil);
    if (!editingUserId) {
      setFormPermissoes(getDefaultPermissoesForPerfil(novoPerfil));
    }
  };

  const handleAplicarPadraoPerfil = () => {
    if (!canCreateOrApprove) return;
    setFormPermissoes(getDefaultPermissoesForPerfil(formPerfil));
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const existingTarget = editingUserId
      ? usuarios.find(u => u.id_usuario === editingUserId) ||
        (editingUserId === currentUser.id_usuario ? currentUser : undefined)
      : undefined;

    if (editingUserId) {
      if (!existingTarget || !podeEditarUsuario(currentUser, existingTarget)) {
        setFormError('Você não tem permissão para editar este perfil.');
        return;
      }
    } else if (!canCreateOrApprove) {
      setFormError('Apenas Admin ou Gestor podem cadastrar novos usuários.');
      return;
    }

    if (!formNome.trim()) {
      setFormError('Informe o nome completo do usuário.');
      return;
    }
    const loginClean = formEmail.trim();
    const isSimpleLogin = /^[a-zA-Z0-9._-]{3,}$/.test(loginClean);
    if (!loginClean || (!isEmailValido(loginClean) && !isSimpleLogin)) {
      setFormError('Informe um login válido (ex: admin) ou e-mail corporativo contendo @.');
      return;
    }
    if (!editingUserId && !formSenha.trim()) {
      setFormError('Defina uma senha inicial para o novo usuário.');
      return;
    }
    if (formSenha.trim() && formSenha.trim().length < 4) {
      setFormError('A senha deve ter no mínimo 4 caracteres.');
      return;
    }
    const telDigits = formTelefone.replace(/\D/g, '');
    if (formTelefone.trim() && telDigits.length < 8) {
      setFormError('WhatsApp/Telefone inválido. Informe ao menos 8 dígitos com DDD (ex: (11) 99999-9999).');
      return;
    }

    // Regras rígidas por nível:
    // - Admin: edita todos os perfis
    // - Gestor: edita todos menos Admin (não pode promover a Admin)
    // - Agente: edita apenas os próprios dados pessoais (sem alterar perfil, status ou permissões)
    const isSelfEdit = editingUserId === currentUser.id_usuario;
    let finalPerfil: PerfilUsuario = !isAdmin && formPerfil === 'ADMIN' ? 'GESTOR' : formPerfil;
    let finalAtivo: boolean = editingUserId === 'USR-001' ? true : formAtivo;
    let finalPermissoes: UsuarioPermissoes = formPermissoes;

    if (existingTarget) {
      if (!canCreateOrApprove) {
        finalPerfil = existingTarget.perfil;
        finalAtivo = existingTarget.ativo;
        finalPermissoes = existingTarget.permissoes || getEffectivePermissoes(existingTarget);
      } else {
        if (editingUserId === 'USR-001') {
          finalPerfil = 'ADMIN';
          finalAtivo = true;
        } else if (isSelfEdit) {
          finalAtivo = existingTarget.ativo !== false;
        }
        if (!isAdmin && isGestor) {
          finalPermissoes = {
            ...formPermissoes,
            config_banco: existingTarget.permissoes?.config_banco ?? false,
            config_engseg: existingTarget.permissoes?.config_engseg ?? false
          };
        }
      }
    }

    try {
      storage.saveUsuario({
        id_usuario: editingUserId || `USR-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        nome: formNome.trim(),
        email: formEmail.trim().toLowerCase(),
        senha: formSenha.trim() || undefined,
        foto_url: formFotoUrl.trim() || undefined,
        telefone: formTelefone.trim() || undefined,
        cargo: formCargo.trim() || undefined,
        departamento: formDepartamento.trim() || undefined,
        observacoes: formObservacoes.trim() || undefined,
        perfil: finalPerfil,
        permissoes: finalPermissoes,
        ativo: finalAtivo,
        criado_em: existingTarget?.criado_em || new Date().toISOString()
      });

      setModalOpen(false);
      showSuccessToast(
        editingUserId ? 'Perfil atualizado com sucesso!' : 'Novo usuário cadastrado com sucesso!'
      );
      onDataSynced?.();
    } catch (err: any) {
      setFormError(err?.message || 'Erro ao salvar usuário.');
    }
  };

  const handleDeleteUser = (idUsuario: string) => {
    const target = usuarios.find(u => u.id_usuario === idUsuario);
    if (!canCreateOrApprove || !target || !podeEditarUsuario(currentUser, target)) {
      showSuccessToast('Você não tem permissão para excluir este usuário.');
      setConfirmDeleteId(null);
      return;
    }
    try {
      storage.deleteUsuario(idUsuario);
      setConfirmDeleteId(null);
      showSuccessToast('Usuário removido do sistema.');
      onDataSynced?.();
    } catch (err: any) {
      showSuccessToast(err?.message || 'Não foi possível excluir este usuário.');
    }
  };

  const baseList = onlySelf
    ? usuarios.filter(u => u.id_usuario === currentUser.id_usuario)
    : usuarios;

  const usuariosFiltrados = baseList.filter(u => {
    const q = busca.trim().toLowerCase();
    const matchBusca =
      !q ||
      u.nome.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.cargo || '').toLowerCase().includes(q) ||
      (u.departamento || '').toLowerCase().includes(q);

    const perfilNorm = u.perfil === 'COMERCIAL' ? 'GESTOR' : u.perfil === 'ATENDENTE' ? 'AGENTE' : u.perfil;
    const matchPerfil = filtroPerfil === 'TODOS' || perfilNorm === filtroPerfil;
    const matchStatus =
      filtroStatus === 'TODOS' ||
      (filtroStatus === 'ATIVOS' && u.ativo !== false) ||
      (filtroStatus === 'PENDENTES' && u.ativo === false);

    return matchBusca && matchPerfil && matchStatus;
  });

  const badgePerfil = (perfil: PerfilUsuario) => {
    if (perfil === 'ADMIN') {
      return 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800';
    }
    if (perfil === 'GESTOR' || perfil === 'COMERCIAL') {
      return 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
    }
    return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
  };

  return (
    <div className="space-y-6">
      {/* Banner Topo */}
      <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
              Gestão de Usuários, Senhas e Permissões (RBAC)
            </h2>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-2xl">
            Cadastre colaboradores, gerencie fotos de perfil, defina senhas de acesso, autorize novos cadastros e personalize quais módulos cada usuário pode acessar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {(() => {
            const selfUser = usuarios.find(u => u.id_usuario === currentUser.id_usuario) || currentUser;
            return (
              <button
                type="button"
                onClick={() => openEditModal(selfUser)}
                className="px-3.5 py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-orange-500" />
                <span>Editar Meu Perfil</span>
              </button>
            );
          })()}

          {canCreateOrApprove && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-sm shadow-orange-600/25 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Novo Usuário</span>
            </button>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Métricas de Usuários */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm">
          <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Total Cadastrados</p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1 tabular-nums">{usuarios.length}</p>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm">
          <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Usuários Ativos</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">{ativos.length}</p>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm">
          <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Pendentes de Aprovação</p>
          <p className={`text-2xl font-bold mt-1 tabular-nums ${pendentes.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-400'}`}>
            {pendentes.length}
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm">
          <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Admins / Gestores / Agentes</p>
          <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mt-2 font-mono">
            {usuarios.filter(u => u.perfil === 'ADMIN').length} / {usuarios.filter(u => u.perfil === 'GESTOR' || u.perfil === 'COMERCIAL').length} / {usuarios.filter(u => u.perfil === 'AGENTE' || u.perfil === 'ATENDENTE').length}
          </p>
        </div>
      </div>

      {/* Aprovações Pendentes */}
      {pendentes.length > 0 && (
        <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <UserCheck className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                Cadastros Aguardando Autorização ({pendentes.length})
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendentes.map(u => (
              <div
                key={u.id_usuario}
                className="p-3.5 rounded-xl bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-800/50 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {u.foto_url ? (
                    <img
                      src={u.foto_url}
                      alt={u.nome}
                      className="w-10 h-10 rounded-full object-cover border border-neutral-200 dark:border-neutral-700 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-sm shrink-0">
                      {u.nome.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">{u.nome}</p>
                    <p className="text-[11px] text-neutral-500 truncate">{u.email}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-500">
                      <span className="font-bold text-amber-700 dark:text-amber-400">{u.perfil}</span>
                      {u.cargo && <span>· {u.cargo}</span>}
                      {u.telefone && <span>· {aplicarMascaraTelefoneBR(u.telefone)}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      storage.approveUser(u.id_usuario);
                      showSuccessToast(`Acesso de ${u.nome} autorizado!`);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Autorizar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      storage.rejectUser(u.id_usuario);
                      showSuccessToast(`Solicitação de ${u.nome} recusada.`);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Recusar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Barra de Busca e Filtros */}
      <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, e-mail, cargo ou departamento..."
            className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={filtroPerfil}
            onChange={(e) => setFiltroPerfil(e.target.value as any)}
            className="px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-medium text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-orange-500"
          >
            <option value="TODOS">Todos os Níveis</option>
            <option value="ADMIN">Admin</option>
            <option value="GESTOR">Gestor</option>
            <option value="AGENTE">Agente</option>
          </select>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as any)}
            className="px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-medium text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-orange-500"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="ATIVOS">Apenas Ativos</option>
            <option value="PENDENTES">Inativos / Pendentes</option>
          </select>
        </div>
      </div>

      {/* Grade de Usuários */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {usuariosFiltrados.map(u => {
          const isRootAdmin = u.id_usuario === 'USR-001';
          const isSelf = u.id_usuario === currentUser.id_usuario;
          const canModifyTarget = podeEditarUsuario(currentUser, u);
          const effPerms = getEffectivePermissoes(u);
          const modulosAtivosCount = PERMISSION_LABELS.filter(
            p => p.group !== 'escopo' && effPerms[p.key]
          ).length;

          return (
            <div
              key={u.id_usuario}
              className={`p-5 bg-white dark:bg-neutral-900 border rounded-2xl shadow-sm flex flex-col justify-between gap-4 transition-colors ${
                u.ativo === false
                  ? 'border-amber-300 dark:border-amber-800/70 opacity-90'
                  : 'border-neutral-200 dark:border-neutral-800'
              }`}
            >
              <div className="space-y-3">
                {/* Header do Card */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {u.foto_url ? (
                      <img
                        src={u.foto_url}
                        alt={u.nome}
                        className="w-12 h-12 rounded-2xl object-cover border border-neutral-200 dark:border-neutral-700 shrink-0 shadow-xs"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                        {u.nome.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                          {u.nome}
                        </h3>
                        {isSelf && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 font-semibold">
                            Você
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                        {u.cargo || 'Sem cargo definido'}
                        {u.departamento ? ` · ${u.departamento}` : ''}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${badgePerfil(
                      u.perfil
                    )}`}
                  >
                    {u.perfil}
                  </span>
                </div>

                {/* Dados de Contato e Segurança */}
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-1.5 text-[11px] text-neutral-600 dark:text-neutral-300">
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="font-mono truncate">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="font-mono">
                      {u.telefone ? aplicarMascaraTelefoneBR(u.telefone) : 'Telefone não informado'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-200/70 dark:border-neutral-800">
                    <span className="flex items-center gap-1.5 text-neutral-500">
                      <KeyRound className="w-3.5 h-3.5 text-orange-500" />
                      <span>{u.senha || isRootAdmin ? 'Senha configurada' : 'Sem senha'}</span>
                    </span>
                    <span
                      className={`font-semibold ${
                        u.ativo !== false
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {u.ativo !== false ? 'Ativo' : 'Inativo / Pendente'}
                    </span>
                  </div>
                </div>

                {/* Resumo de Permissões */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium inline-flex items-center gap-1">
                    <SlidersHorizontal className="w-3 h-3 text-orange-500" />
                    <span>{modulosAtivosCount} módulos liberados</span>
                  </span>
                  {effPerms.apenas_proprios_eventos && u.perfil !== 'ADMIN' && (
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-medium">
                      Somente próprios eventos
                    </span>
                  )}
                </div>
              </div>

              {/* Ações */}
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2">
                {canModifyTarget ? (
                  <>
                    <button
                      type="button"
                      onClick={() => openEditModal(u)}
                      className="flex-1 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-100 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-orange-500" />
                      <span>{isSelf && !canCreateOrApprove ? 'Editar Meu Perfil' : 'Editar Dados'}</span>
                    </button>

                    {canCreateOrApprove && !isRootAdmin && !isSelf && (
                      <button
                        type="button"
                        onClick={() => storage.toggleUserActive(u.id_usuario)}
                        title={u.ativo !== false ? 'Desativar usuário' : 'Ativar usuário'}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          u.ativo !== false
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-amber-50 hover:text-amber-600'
                            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-emerald-50 hover:text-emerald-600'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {canCreateOrApprove && !isRootAdmin && !isSelf && (
                      confirmDeleteId === u.id_usuario ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.id_usuario)}
                            className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            Excluir
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg text-[10px] cursor-pointer"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(u.id_usuario)}
                          title="Excluir usuário"
                          className="p-1.5 rounded-lg bg-neutral-100 hover:bg-rose-50 dark:bg-neutral-800 dark:hover:bg-rose-950/50 border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </>
                ) : (
                  <span className="text-[11px] text-neutral-400 italic">
                    {!canCreateOrApprove
                      ? 'Agentes podem editar apenas o próprio perfil.'
                      : 'Somente Admin geral pode editar este usuário.'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Criar / Editar Usuário */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-500" />
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  {editingUserId ? 'Editar Usuário e Permissões' : 'Cadastrar Novo Usuário'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-5 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 font-medium flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Foto de Perfil */}
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative shrink-0">
                  {formFotoUrl ? (
                    <>
                      <img
                        src={formFotoUrl}
                        alt="Foto de perfil"
                        className="w-16 h-16 rounded-2xl object-cover border border-neutral-300 dark:border-neutral-700"
                      />
                      <button
                        type="button"
                        onClick={() => setFormFotoUrl('')}
                        className="absolute -top-1.5 -right-1.5 p-0.5 bg-rose-600 text-white rounded-full shadow-xs cursor-pointer"
                        title="Remover foto"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <div className="w-16 h-16 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex flex-col items-center justify-center text-neutral-400">
                      <Camera className="w-5 h-5" />
                      <span className="text-[9px] mt-0.5">Foto</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 w-full space-y-2">
                  <label className="block font-semibold text-neutral-800 dark:text-neutral-200">
                    Foto do Colaborador (Upload ou URL)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={formFotoUrl}
                      onChange={(e) => setFormFotoUrl(e.target.value)}
                      placeholder="Cole a URL da imagem ou envie um arquivo..."
                      className="flex-1 px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                    />
                    <label className="px-3 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg font-semibold cursor-pointer shrink-0 transition-colors">
                      <span>Enviar Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const compressed = await compressImageFileToDataUrl(file, 256, 0.82);
                              setFormFotoUrl(compressed);
                            } catch (err) {
                              console.warn('Erro ao comprimir foto:', err);
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Dados Principais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    placeholder="Ex: Ana Paula Silva"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Login ou E-mail de Acesso *
                  </label>
                  <input
                    type="text"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(sanitizarEmailInput(e.target.value))}
                    placeholder="admin ou ana@empresa.com.br"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    {editingUserId ? 'Nova Senha (deixe vazio para manter)' : 'Senha de Acesso *'}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <Lock className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showSenha ? 'text' : 'password'}
                        value={formSenha}
                        onChange={(e) => setFormSenha(e.target.value)}
                        placeholder={editingUserId ? '••••••••' : 'Mínimo 4 caracteres'}
                        className="w-full pl-8 pr-8 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-orange-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSenha(s => !s)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                      >
                        {showSenha ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormSenha(gerarSenhaForte());
                        setShowSenha(true);
                      }}
                      title="Gerar senha segura"
                      className="px-2.5 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <RefreshCw className="w-3 h-3 text-orange-500" />
                      <span>Gerar</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    WhatsApp / Telefone
                  </label>
                  <input
                    type="tel"
                    maxLength={15}
                    value={formTelefone}
                    onChange={(e) => setFormTelefone(aplicarMascaraTelefoneBR(e.target.value))}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Cargo / Função
                  </label>
                  <div className="relative">
                    <Briefcase className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={formCargo}
                      onChange={(e) => setFormCargo(e.target.value)}
                      placeholder="Ex: Consultor de Vendas, SDR..."
                      className="w-full pl-8 pr-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Departamento / Equipe
                  </label>
                  <input
                    type="text"
                    value={formDepartamento}
                    onChange={(e) => setFormDepartamento(e.target.value)}
                    placeholder="Ex: Comercial, Marketing, Administrativo"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Nível de Acesso & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Nível de Acesso (Perfil)
                  </label>
                  <select
                    disabled={!canCreateOrApprove || editingUserId === 'USR-001'}
                    value={formPerfil}
                    onChange={(e) => handlePerfilChangeInModal(e.target.value as PerfilUsuario)}
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white font-semibold focus:outline-none focus:border-orange-500 disabled:opacity-60"
                  >
                    {isAdmin && <option value="ADMIN">ADMIN (Acesso Total)</option>}
                    <option value="GESTOR">GESTOR (Resultados e Processos)</option>
                    <option value="AGENTE">AGENTE (Vendedor / Administrativo / Mkt)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Status da Conta
                  </label>
                  <button
                    type="button"
                    disabled={!canCreateOrApprove || editingUserId === 'USR-001' || editingUserId === currentUser.id_usuario}
                    onClick={() => setFormAtivo(v => !v)}
                    className={`w-full px-3 py-2 rounded-lg font-semibold border flex items-center justify-between transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                      formAtivo
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    <span>{formAtivo ? 'Conta Ativa (Liberada)' : 'Bloqueada / Aguardando Aprovação'}</span>
                    <Power className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Permissões Granulares */}
              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-orange-500" />
                      <span>Permissões Granulares de Acesso</span>
                    </h4>
                    <p className="text-[11px] text-neutral-500">
                      {canCreateOrApprove
                        ? 'Determine exatamente o que este usuário pode visualizar e alterar.'
                        : 'Somente Admin ou Gestor pode alterar o nível de acesso e as permissões.'}
                    </p>
                  </div>
                  {canCreateOrApprove && formPerfil !== 'ADMIN' && (
                    <button
                      type="button"
                      onClick={handleAplicarPadraoPerfil}
                      className="text-[11px] text-orange-600 dark:text-orange-400 font-semibold hover:underline cursor-pointer"
                    >
                      Restaurar padrão do perfil
                    </button>
                  )}
                </div>

                {formPerfil === 'ADMIN' ? (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2.5">
                    O perfil <strong>ADMIN</strong> possui acesso irrestrito a todos os módulos e configurações do sistema.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PERMISSION_LABELS.filter(p => p.group === 'modulos').map(perm => (
                        <label
                          key={perm.key}
                          className={`flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 ${
                            !canCreateOrApprove ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-orange-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={!canCreateOrApprove}
                            checked={Boolean(formPermissoes[perm.key])}
                            onChange={(e) =>
                              setFormPermissoes(prev => ({ ...prev, [perm.key]: e.target.checked }))
                            }
                            className="accent-orange-600 rounded"
                          />
                          <span className="text-[11px] font-medium text-neutral-800 dark:text-neutral-200">
                            {perm.label}
                          </span>
                        </label>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        Escopo &amp; Configurações Permitidas
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {PERMISSION_LABELS.filter(p => p.group !== 'modulos').map(perm => {
                          const disabledByRole =
                            !canCreateOrApprove ||
                            (!isAdmin && (perm.key === 'config_banco' || perm.key === 'config_engseg'));
                          return (
                            <label
                              key={perm.key}
                              className={`flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 ${
                                disabledByRole ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-orange-400'
                              }`}
                            >
                              <input
                                type="checkbox"
                                disabled={disabledByRole}
                                checked={Boolean(formPermissoes[perm.key])}
                                onChange={(e) =>
                                  setFormPermissoes(prev => ({ ...prev, [perm.key]: e.target.checked }))
                                }
                                className="accent-orange-600 rounded"
                              />
                              <span className="text-[11px] font-medium text-neutral-800 dark:text-neutral-200">
                                {perm.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Observações Internas
                </label>
                <textarea
                  rows={2}
                  value={formObservacoes}
                  onChange={(e) => setFormObservacoes(e.target.value)}
                  placeholder="Anotações sobre escala, metas ou responsabilidades do colaborador..."
                  className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold shadow-sm cursor-pointer"
                >
                  {editingUserId ? 'Salvar Alterações' : 'Cadastrar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
