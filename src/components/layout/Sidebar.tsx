import React, { useState } from 'react';
import {
  LayoutDashboard,
  CalendarCheck,
  Clock,
  FileSpreadsheet,
  Users,
  Kanban,
  QrCode,
  Settings,
  ExternalLink,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Pin,
  PinOff
} from 'lucide-react';
import { storage } from '../../services/storageService';
import { isCloudActive } from '../../services/driveSyncService';

export type ActiveTab =
  | 'dashboard'
  | 'eventos'
  | 'disponibilidade'
  | 'formularios'
  | 'leads'
  | 'crm'
  | 'qrcode'
  | 'configuracoes';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenPublicView: () => void;
  onRefresh: () => void;
  isPinned: boolean;
  onTogglePin: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onOpenPublicView,
  onRefresh,
  isPinned,
  onTogglePin
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const db = storage.getDatabase();
  const gasConfigured = isCloudActive();

  // A barra fica expandida se estiver fixada (pinned) OU quando o usuário passa o mouse por cima
  const isExpanded = isPinned || isHovered;

  const navItems: { id: ActiveTab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'eventos', label: 'Eventos', icon: CalendarCheck, count: db.eventos.length },
    { id: 'disponibilidade', label: 'Disponibilidade', icon: Clock },
    { id: 'formularios', label: 'Formulários', icon: FileSpreadsheet },
    { id: 'leads', label: 'Leads & Cadastros', icon: Users, count: db.leads.length },
    { id: 'crm', label: 'CRM Kanban', icon: Kanban, count: db.crm.filter(c => c.estagio !== 'GANHO' && c.estagio !== 'PERDIDO').length },
    { id: 'qrcode', label: 'Links e QR Codes', icon: QrCode },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  return (
    <aside
      onMouseEnter={() => !isPinned && setIsHovered(true)}
      onMouseLeave={() => !isPinned && setIsHovered(false)}
      className={`bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800 flex flex-col shrink-0 select-none transition-all duration-300 ease-in-out relative z-30 ${
        isExpanded ? 'w-64' : 'w-18'
      }`}
    >
      {/* Brand & Botão de Fixar / Desafixar */}
      <div className={`p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center ${
        isExpanded ? 'justify-between' : 'justify-center'
      }`}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-lg bg-orange-600 flex items-center justify-center text-white font-bold shadow-md shadow-orange-600/20 shrink-0">
            <Calendar className="w-5 h-5 text-white" />
          </div>

          {isExpanded && (
            <div className="overflow-hidden leading-tight transition-opacity duration-200">
              <h1 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 tracking-tight truncate">
                Agenda Ativa
              </h1>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                Motor Drive v2.0
              </p>
            </div>
          )}
        </div>

        {/* Botão de Fixar (Pin) */}
        {isExpanded && (
          <button
            onClick={onTogglePin}
            title={isPinned ? 'Desafixar menu (tornar retrátil ao sair com o mouse)' : 'Fixar menu lateral aberto'}
            className={`p-1.5 rounded-lg text-xs transition-colors shrink-0 ${
              isPinned
                ? 'bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800'
                : 'text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900'
            }`}
          >
            {isPinned ? (
              <PinOff className="w-4 h-4 fill-current" />
            ) : (
              <Pin className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Botão de Fixar quando recolhido (mini) */}
      {!isExpanded && (
        <div className="pt-2 flex justify-center">
          <button
            onClick={onTogglePin}
            title="Fixar menu lateral"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-orange-500 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
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

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              title={!isExpanded ? item.label : undefined}
              className={`w-full flex items-center rounded-lg text-sm font-medium transition-all ${
                isExpanded ? 'justify-between px-3 py-2.5' : 'justify-center p-2.5'
              } ${
                isActive
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-neutral-400 dark:text-neutral-500'}`} />
                {isExpanded && <span className="truncate">{item.label}</span>}
              </div>

              {isExpanded && item.count !== undefined && item.count > 0 && (
                <span
                  className={`text-xs font-mono tabular-nums px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-orange-700 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / Página Pública / Status */}
      <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
        <a
          href={db.eventos[0]?.slug ? `/agendar/${db.eventos[0].slug}` : '/agendar'}
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
        <div className={`pt-1 flex items-center text-[11px] text-neutral-500 dark:text-neutral-400 ${
          isExpanded ? 'justify-between px-1' : 'justify-center'
        }`}>
          {isExpanded ? (
            <div className="flex items-center gap-1.5 truncate">
              <CheckCircle2 className={`w-3.5 h-3.5 ${gasConfigured ? 'text-emerald-500 dark:text-emerald-400' : 'text-neutral-400 dark:text-neutral-500'}`} />
              <span className="truncate">
                {gasConfigured ? 'Drive v2.0 Ativo' : 'Drive + Sheets (13 abas)'}
              </span>
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
            className="p-1 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
