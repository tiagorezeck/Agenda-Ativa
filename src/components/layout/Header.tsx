import React, { useState, useEffect, useRef } from 'react';
import { ActiveTab } from './Sidebar';
import { 
  Plus, Clock, Sun, Moon, 
  PanelLeftClose, PanelLeft, Maximize, Minimize, Bell, 
  User, LogOut, Check, X, CheckCheck, AlertCircle, Calendar, Zap, UserCheck 
} from 'lucide-react';
import { storage } from '../../services/storageService';
import { getLoggedInUser, logoutUser, DEFAULT_USERS, setLoggedInUser } from '../../services/authService';
import { UsuarioEntity, NotificacaoEntity } from '../../types/database';

interface HeaderProps {
  activeTab: ActiveTab;
  onNewEvent: () => void;
  onOpenPublic: () => void;
  onResetDemo: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  isPinned: boolean;
  onTogglePin: () => void;
  onLogout?: () => void;
  onOpenProfile?: () => void;
}

const TAB_TITLES: Record<ActiveTab, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard Executivo', subtitle: 'Métricas de atendimento, ocupação e conversão' },
  eventos: { title: 'Gestão de Eventos', subtitle: 'Configuração de capacidade, horários e links' },
  disponibilidade: { title: 'Controle de Disponibilidade', subtitle: 'Vagas em tempo real e bloqueios administrativos' },
  formularios: { title: 'Formulários Dinâmicos', subtitle: 'Personalização dos campos de qualificação' },
  leads: { title: 'Base Central de Leads', subtitle: 'Contatos desduplicados e histórico consolidado' },
  crm: { title: 'CRM Kanban Comercial', subtitle: '6 estágios do funil com Follow-up / Stand By' },
  metas: { title: 'Metas & Desempenho', subtitle: 'Acompanhamento de metas financeiras, numéricas e personalizadas' },
  qrcode: { title: 'Links e QR Codes', subtitle: 'Divulgação, WhatsApp e download de QR Code' },
  config_empresa: { title: 'Dados da Empresa', subtitle: 'Identidade institucional, logotipo, contato e LGPD' },
  config_banco: { title: 'Banco de Dados', subtitle: 'Motor DADOS DRIVE v2.0, multi-drive e Google Sheets' },
  config_usuarios: { title: 'Usuários & Permissões', subtitle: 'Cadastro de colaboradores, senhas, fotos e níveis de acesso' },
  config_engseg: { title: 'Engseg 2FA', subtitle: 'Segurança e autenticação em duas etapas por e-mail' },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onNewEvent,
  onOpenPublic,
  onResetDemo,
  theme,
  onToggleTheme,
  isPinned,
  onTogglePin,
  onLogout,
  onOpenProfile
}) => {
  const current = TAB_TITLES[activeTab] || { title: 'Painel', subtitle: '' };
  const db = storage.getDatabase();
  const empresaNome = db.config.find(c => c.chave === 'EMPRESA_NOME')?.valor || 'Agenda Ativa';

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UsuarioEntity>(getLoggedInUser());
  const [notificacoes, setNotificacoes] = useState<NotificacaoEntity[]>([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNotificacoes(storage.getNotificacoes());
    const unsub = storage.subscribe(() => {
      setNotificacoes([...storage.getNotificacoes()]);
    });

    const handleAuthChange = () => {
      setCurrentUser(getLoggedInUser());
    };
    window.addEventListener('auth_user_changed', handleAuthChange);

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotificationsDropdown(false);
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      unsub();
      window.removeEventListener('auth_user_changed', handleAuthChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const unreadCount = notificacoes.filter(n => !n.lida).length;
  const canApproveUsers = currentUser.perfil === 'ADMIN' || currentUser.perfil === 'GESTOR';
  const allDbUsers = (db.usuarios && db.usuarios.length > 0) ? db.usuarios : DEFAULT_USERS;
  const pendingUsers = allDbUsers.filter(u => u.ativo === false);
  const activeUsers = allDbUsers.filter(u => u.ativo !== false);
  const totalBellBadge = unreadCount + (canApproveUsers ? pendingUsers.length : 0);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Erro ao alternar tela cheia:', err);
    }
  };

  const handleSwitchUser = (user: UsuarioEntity) => {
    setLoggedInUser(user);
    setCurrentUser(user);
    setShowUserDropdown(false);
  };

  return (
    <header className="h-16 px-6 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-6 shrink-0 transition-colors relative z-30">
      {/* Zone 1: Toggle Pin / Breadcrumb & View Title */}
      <div className="flex items-center gap-3 truncate">
        <button
          onClick={onTogglePin}
          title={isPinned ? 'Desafixar menu lateral (tornar retrátil)' : 'Fixar menu lateral aberto'}
          className={`p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 shrink-0 ${
            isPinned
              ? 'bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-transparent'
          }`}
        >
          {isPinned ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          <span className="hidden md:inline text-[11px] font-medium">
            {isPinned ? 'Fixado' : 'Retrátil'}
          </span>
        </button>

        <span className="text-neutral-300 dark:text-neutral-700" aria-hidden="true">·</span>

        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 whitespace-nowrap shrink-0">
          {empresaNome}
        </span>
        <span className="text-neutral-400 dark:text-neutral-600 text-xs shrink-0" aria-hidden="true">/</span>
        <div className="truncate">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 whitespace-nowrap truncate">
            {current.title}
          </h2>
        </div>
      </div>

      {/* Zone 2: Timezone & System Info */}
      <div className="hidden xl:flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0 font-mono">
          <Clock className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
          <span>America/Sao_Paulo (GMT-3)</span>
        </div>
        <span className="text-neutral-300 dark:text-neutral-700" aria-hidden="true">·</span>
        <span className="whitespace-nowrap shrink-0">
          13 Abas Ativas
        </span>
      </div>

      {/* Zone 3: Primary Action Controls & Notifications & User Profile */}
      <div className="flex items-center gap-2 shrink-0" ref={dropdownRef}>
        {/* Sininho de Notificações */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotificationsDropdown(prev => !prev);
              setShowUserDropdown(false);
            }}
            title="Notificações em tempo real"
            className="p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 transition-colors relative cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {totalBellBadge > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm animate-pulse">
                {totalBellBadge}
              </span>
            )}
          </button>

          {/* Dropdown de Notificações */}
          {showNotificationsDropdown && (
            <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-950">
                <div className="flex items-center gap-2">
                  <Bell size={15} className="text-orange-500" />
                  <h3 className="text-xs font-bold text-neutral-900 dark:text-white">Notificações</h3>
                  {totalBellBadge > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-semibold">
                      {totalBellBadge} pendente(s)
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={() => storage.marcarTodasNotificacoesLidas()}
                    className="text-[11px] text-orange-600 dark:text-orange-400 hover:underline font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck size={13} />
                    <span>Marcar lidas</span>
                  </button>
                )}
              </div>

              {/* Aprovações Pendentes para Admin e Gestor */}
              {canApproveUsers && pendingUsers.length > 0 && (
                <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/60 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                    <UserCheck size={14} />
                    <span>Cadastros Aguardando Autorização ({pendingUsers.length})</span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {pendingUsers.map((pu) => (
                      <div
                        key={pu.id_usuario}
                        className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-amber-200/80 dark:border-amber-800/50 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">{pu.nome}</p>
                          <p className="text-[10px] text-neutral-500 truncate">{pu.email} · {pu.perfil}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => storage.approveUser(pu.id_usuario)}
                            title="Autorizar entrada"
                            className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={() => storage.rejectUser(pu.id_usuario)}
                            title="Recusar solicitação"
                            className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
                {notificacoes.length === 0 ? (
                  <div className="p-6 text-center text-xs text-neutral-500">
                    Nenhuma notificação no momento.
                  </div>
                ) : (
                  notificacoes.map((notif) => (
                    <div
                      key={notif.id_notificacao}
                      onClick={() => storage.marcarNotificacaoLida(notif.id_notificacao)}
                      className={`p-3.5 transition-colors cursor-pointer flex gap-3 ${
                        notif.lida 
                          ? 'bg-white dark:bg-neutral-900 opacity-75' 
                          : 'bg-orange-50/40 dark:bg-orange-950/20'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {notif.tipo === 'AGENDAMENTO' && <Calendar size={16} className="text-orange-500" />}
                        {notif.tipo === 'CRM_GANHO' && <Zap size={16} className="text-emerald-500" />}
                        {notif.tipo === 'LEAD' && <User size={16} className="text-blue-500" />}
                        {notif.tipo === 'SISTEMA' && <AlertCircle size={16} className="text-amber-500" />}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-neutral-900 dark:text-white">{notif.titulo}</h4>
                          <span className="text-[10px] text-neutral-400">
                            {new Date(notif.criado_em).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                          {notif.mensagem}
                        </p>
                      </div>
                      {!notif.lida && (
                        <span className="w-2 h-2 rounded-full bg-orange-500 self-center shrink-0" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Alternador de Tema Claro / Escuro */}
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
          className="p-2 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-500" />
          )}
        </button>

        {/* Botão Tela Cheia */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Recolher Tela Cheia' : 'Expandir Tela Cheia'}
          className="p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
        >
          {isFullscreen ? <Minimize className="w-4 h-4 text-orange-500" /> : <Maximize className="w-4 h-4" />}
        </button>

        {/* Perfil de Usuário & Menu de Troca */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserDropdown(prev => !prev);
              setShowNotificationsDropdown(false);
            }}
            className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 flex items-center gap-2 text-xs font-medium text-neutral-800 dark:text-neutral-200 cursor-pointer transition-colors"
          >
            {currentUser.foto_url ? (
              <img
                src={currentUser.foto_url}
                alt={currentUser.nome}
                className="w-5 h-5 rounded-full object-cover border border-neutral-300 dark:border-neutral-700"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center text-[10px] font-bold">
                {currentUser.nome.charAt(0)}
              </div>
            )}
            <span className="hidden md:inline">{currentUser.nome.split(' ')[0]}</span>
            <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-bold">
              {currentUser.perfil}
            </span>
          </button>

          {/* Dropdown de Usuário */}
          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl z-50 overflow-hidden p-2 space-y-2">
              <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800">
                <p className="text-xs font-bold text-neutral-900 dark:text-white">{currentUser.nome}</p>
                <p className="text-[11px] text-neutral-500 font-mono">{currentUser.email}</p>
              </div>

              <div className="space-y-1 max-h-48 overflow-y-auto">
                <p className="px-3 py-1 text-[10px] uppercase font-semibold text-neutral-400">Alternar Perfil (RBAC):</p>
                {activeUsers.map(usr => (
                  <button
                    key={usr.id_usuario}
                    onClick={() => handleSwitchUser(usr)}
                    className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      currentUser.id_usuario === usr.id_usuario
                        ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 font-bold'
                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <span className="truncate">{usr.nome}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-mono shrink-0">
                      {usr.perfil}
                    </span>
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-1">
                {onOpenProfile && (
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      onOpenProfile();
                    }}
                    className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <User size={14} className="text-orange-500" />
                    <span>Editar Meu Perfil</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    logoutUser();
                    if (onLogout) onLogout();
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut size={14} />
                  <span>Sair / Voltar à Landing Page</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {activeTab === 'eventos' && (
          <button
            onClick={onNewEvent}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 shadow-sm shadow-orange-600/30 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Evento</span>
          </button>
        )}
      </div>
    </header>
  );
};
