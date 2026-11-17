import React, { useState } from 'react';
import {
  LayoutDashboard,
  CalendarCheck,
  Clock,
  FileSpreadsheet,
  Users,
  Kanban,
  Target,
  QrCode,
  Building,
  Database,
  UserCog,
  ShieldCheck,
  Settings,
  ChevronDown,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  Pin,
  PinOff
} from 'lucide-react';
import { storage } from '../../services/storageService';
import { buildPublicEventPath, isCloudActive } from '../../services/driveSyncService';
import {
  getLoggedInUser,
  podeAcessarModulo,
  podeAcessarConfigEmpresa,
  podeAcessarConfigBanco,
  podeAcessarConfigUsuarios,
  podeAcessarConfigEngseg,
  podeCriarOuAprovarUsuarios
} from '../../services/authService';
import { LogoAgendaAtiva } from '../common/LogoAgendaAtiva';

export type ActiveTab =
  | 'dashboard'
  | 'eventos'
  | 'disponibilidade'
  | 'formularios'
  | 'leads'
  | 'crm'
  | 'metas'
  | 'qrcode'
  | 'config_empresa'
  | 'config_banco'
  | 'config_usuarios'
  | 'config_engseg';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenPublicView: () => void;
  onRefresh: () => void;
  isPinned: boolean;
  onTogglePin: () => void;
  theme?: 'light' | 'dark';
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onRefresh,
  isPinned,
  onTogglePin,
  theme
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isConfigHovered, setIsConfigHovered] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => getLoggedInUser());
  const db = storage.getDatabase();
  const gasConfigured = isCloudActive();

  React.useEffect(() => {
    const handleAuthChange = () => setCurrentUser(getLoggedInUser());
    window.addEventListener('auth_user_changed', handleAuthChange);
    return () => window.removeEventListener('auth_user_changed', handleAuthChange);
  }, []);

  // A barra fica expandida se estiver fixada (pinned) OU quando o usuário passa o mouse por cima
  const isExpanded = isPinned || isHovered;
  const isConfigTabActive =
    activeTab === 'config_empresa' ||
    activeTab === 'config_banco' ||
    activeTab === 'config_usuarios' ||
    activeTab === 'config_engseg';
  const isConfigExpanded = isExpanded && isConfigHovered;

  const mainNavItems: {
    id: Exclude<ActiveTab, 'config_empresa' | 'config_banco' | 'config_usuarios' | 'config_engseg'>;
    label: string;
    icon: React.ElementType;
    count?: number;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'eventos', label: 'Eventos', icon: CalendarCheck, count: db.eventos.length },
    { id: 'disponibilidade', label: 'Disponibilidade', icon: Clock },
    { id: 'formularios', label: 'Formulários', icon: FileSpreadsheet },
    { id: 'leads', label: 'Leads & Cadastros', icon: Users, count: db.leads.length },
    {
      id: 'crm',
      label: 'CRM Kanban',
      icon: Kanban,
      count: db.crm.filter(c => c.estagio !== 'GANHO' && c.estagio !== 'PERDIDO').length
    },
    { id: 'metas', label: 'Metas & Desempenho', icon: Target, count: (db.metas || []).length },
    { id: 'qrcode', label: 'Links e QR Codes', icon: QrCode }
  ];

  const canManageUsers = podeCriarOuAprovarUsuarios(currentUser);
  const pendingUsersCount = canManageUsers ? (db.usuarios || []).filter(u => u.ativo === false).length : 0;

  const configNavItems: {
    id: Extract<ActiveTab, 'config_empresa' | 'config_banco' | 'config_usuarios' | 'config_engseg'>;
    label: string;
    icon: React.ElementType;
    badge?: number;
    allowed: boolean;
  }[] = [
    {
      id: 'config_empresa',
      label: 'Dados da Empresa',
      icon: Building,
      allowed: podeAcessarConfigEmpresa(currentUser)
    },
    {
      id: 'config_banco',
      label: 'Banco de Dados',
      icon: Database,
      allowed: podeAcessarConfigBanco(currentUser)
    },
    {
      id: 'config_usuarios',
      label: canManageUsers ? 'Usuários' : 'Meu Perfil',
      icon: UserCog,
      badge: pendingUsersCount > 0 ? pendingUsersCount : undefined,
      allowed: podeAcessarConfigUsuarios(currentUser)
    },
    {
      id: 'config_engseg',
      label: 'Engseg',
      icon: ShieldCheck,
      allowed: podeAcessarConfigEngseg(currentUser)
    }
  ];

  const visibleMainItems = mainNavItems.filter(item => podeAcessarModulo(currentUser, item.id));
  const visibleConfigItems = configNavItems.filter(item => item.allowed);

  return (
    <aside
      onMouseEnter={() => !isPinned && setIsHovered(true)}
      onMouseLeave={() => {
        if (!isPinned) setIsHovered(false);
        setIsConfigHovered(false);
      }}
      className={`bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800 flex flex-col shrink-0 select-none transition-all duration-300 ease-in-out relative z-30 ${
        isExpanded ? 'w-64' : 'w-18'
      }`}
    >
      {/* Brand & Botão de Fixar / Desafixar */}
      <div
        className={`border-b border-neutral-200 dark:border-neutral-800 flex items-center min-h-16 ${
          isExpanded ? 'px-4 py-3 justify-between gap-2' : 'px-2 py-3 justify-center'
        }`}
      >
        <div className={`flex items-center ${isExpanded ? 'min-w-0 flex-1 justify-start' : 'justify-center'}`}>
          {isExpanded ? (
            <LogoAgendaAtiva key="sidebar-full" size="sm" theme={theme} showBadge={false} />
          ) : (
            <LogoAgendaAtiva key="sidebar-collapsed" size="collapsed" theme={theme} showBadge={false} />
          )}
        </div>

        {isExpanded && (
          <button
            onClick={onTogglePin}
            title={isPinned ? 'Desafixar menu (tornar retrátil ao sair com o mouse)' : 'Fixar menu lateral aberto'}
            className={`p-1.5 rounded-lg text-xs transition-colors shrink-0 cursor-pointer ${
              isPinned
                ? 'bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800'
                : 'text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900'
            }`}
          >
            {isPinned ? <PinOff className="w-4 h-4 fill-current" /> : <Pin className="w-4 h-4" />}
          </button>
        )}
      </div>

      {!isExpanded && (
        <div className="pt-2 flex justify-center">
          <button
            onClick={onTogglePin}
            title="Fixar menu lateral"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-orange-500 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Items */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden">
        {isExpanded && (
          <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase truncate">
            Módulos do Sistema
          </div>
        )}

        {visibleMainItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              title={!isExpanded ? item.label : undefined}
              className={`w-full flex items-center rounded-lg text-sm font-medium transition-all cursor-pointer ${
                isExpanded ? 'justify-between px-3 py-2.5' : 'justify-center p-2.5'
              } ${
                isActive
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-neutral-400 dark:text-neutral-500'
                  }`}
                />
                {isExpanded && <span className="truncate">{item.label}</span>}
              </div>

              {isExpanded && item.count !== undefined && item.count > 0 && (
                <span
                  className={`text-xs font-mono tabular-nums px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-orange-700 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}

        {/* Grupo Retrátil de Configurações (Expande ao passar o mouse, recolhe ao sair) */}
        {visibleConfigItems.length > 0 && (
          <div
            onMouseEnter={() => setIsConfigHovered(true)}
            onMouseLeave={() => setIsConfigHovered(false)}
            className="pt-2 mt-2 border-t border-neutral-200 dark:border-neutral-800"
          >
            <button
              type="button"
              onClick={() => {
                if (!isConfigHovered) {
                  setIsConfigHovered(true);
                } else if (visibleConfigItems[0]) {
                  onTabChange(visibleConfigItems[0].id);
                }
              }}
              title={!isExpanded ? 'Configurações' : undefined}
              className={`w-full flex items-center rounded-lg text-sm font-medium transition-all cursor-pointer relative ${
                isExpanded ? 'justify-between px-3 py-2.5' : 'justify-center p-2.5'
              } ${
                isConfigTabActive
                  ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/25'
                  : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Settings
                  className={`w-4 h-4 shrink-0 ${
                    isConfigTabActive ? 'text-orange-500' : 'text-neutral-400 dark:text-neutral-500'
                  }`}
                />
                {isExpanded && <span className="truncate">Configurações</span>}
              </div>

              {isExpanded && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {pendingUsersCount > 0 && !isConfigExpanded && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white">
                      {pendingUsersCount}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${
                      isConfigExpanded ? 'rotate-180 text-orange-500' : ''
                    }`}
                  />
                </div>
              )}

              {!isExpanded && pendingUsersCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500" />
              )}
            </button>

            {/* Subitens expansíveis no hover */}
            <div
              className={`grid transition-all duration-200 ease-in-out ${
                isConfigExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
              }`}
            >
              <div className="overflow-hidden">
                <div className="pt-1 pl-3 space-y-1">
                  {visibleConfigItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onTabChange(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          isActive
                            ? 'bg-orange-600 text-white shadow-sm'
                            : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Icon
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isActive ? 'text-white' : 'text-neutral-400 dark:text-neutral-500'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>

                        {item.badge !== undefined && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              isActive ? 'bg-orange-700 text-white' : 'bg-amber-500 text-white'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Footer / Página Pública / Status */}
      <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
        <a
          href={buildPublicEventPath(db.eventos[0]?.slug)}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir página pública independente em nova aba"
          className={`w-full flex items-center rounded-lg text-xs font-medium bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700/80 transition-colors ${
            isExpanded ? 'justify-between px-3 py-2.5' : 'justify-center p-2.5'
          }`}
        >
          <span className="flex items-center gap-2 truncate">
            <ExternalLink className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
            {isExpanded && <span className="truncate">Página Pública</span>}
          </span>
          {isExpanded && <span className="text-[10px] text-neutral-400 font-mono">Nova Aba</span>}
        </a>

        {/* Database Status & Refresh */}
        <div
          className={`pt-1 flex items-center text-[11px] text-neutral-500 dark:text-neutral-400 ${
            isExpanded ? 'justify-between px-1' : 'justify-center'
          }`}
        >
          {isExpanded ? (
            <div className="flex items-center gap-1.5 truncate">
              <CheckCircle2
                className={`w-3.5 h-3.5 ${
                  gasConfigured ? 'text-emerald-500 dark:text-emerald-400' : 'text-neutral-400 dark:text-neutral-500'
                }`}
              />
              <span className="truncate">{gasConfigured ? 'Drive v2.0 Ativo' : 'Drive + Sheets (13 abas)'}</span>
            </div>
          ) : (
            <div
              title={gasConfigured ? 'Motor Drive v2.0 Ativo' : 'Agenda Ativa · Drive + Sheets'}
              className={`w-2 h-2 rounded-full ${gasConfigured ? 'bg-emerald-500' : 'bg-orange-500'}`}
            />
          )}

          <button
            onClick={onRefresh}
            title="Atualizar dados"
            className="p-1 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
