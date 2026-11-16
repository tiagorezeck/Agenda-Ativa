import React, { useState, useEffect } from 'react';
import { ActiveTab } from './Sidebar';
import { Plus, RotateCcw, Clock, ExternalLink, Sun, Moon, PanelLeftClose, PanelLeft, Maximize, Minimize } from 'lucide-react';
import { storage } from '../../services/storageService';
import { buildPublicEventPath } from '../../services/driveSyncService';

interface HeaderProps {
  activeTab: ActiveTab;
  onNewEvent: () => void;
  onOpenPublic: () => void;
  onResetDemo: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  isPinned: boolean;
  onTogglePin: () => void;
}

const TAB_TITLES: Record<ActiveTab, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard Executivo', subtitle: 'Métricas de atendimento, ocupação e conversão' },
  eventos: { title: 'Gestão de Eventos', subtitle: 'Configuração de capacidade, horários e links' },
  disponibilidade: { title: 'Controle de Disponibilidade', subtitle: 'Vagas em tempo real e bloqueios administrativos' },
  formularios: { title: 'Formulários Dinâmicos', subtitle: 'Personalização dos campos de qualificação' },
  leads: { title: 'Base Central de Leads', subtitle: 'Contatos desduplicados e histórico consolidado' },
  crm: { title: 'CRM Kanban Comercial', subtitle: '6 estágios do funil com Follow-up / Stand By' },
  qrcode: { title: 'Links e QR Codes', subtitle: 'Divulgação, WhatsApp e download de QR Code' },
  configuracoes: { title: 'Configurações do Sistema', subtitle: 'Motor DADOS DRIVE v2.0, ENGSEG 2FA e dados da empresa' },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onNewEvent,
  onOpenPublic,
  onResetDemo,
  theme,
  onToggleTheme,
  isPinned,
  onTogglePin
}) => {
  const current = TAB_TITLES[activeTab] || { title: 'Painel', subtitle: '' };
  const db = storage.getDatabase();
  const empresaNome = db.config.find(c => c.chave === 'EMPRESA_NOME')?.valor || 'Instituto Comet';

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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

  return (
    <header className="h-16 px-6 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-6 shrink-0 transition-colors">
      {/* Zone 1: Toggle Pin / Breadcrumb & View Title */}
      <div className="flex items-center gap-3 truncate">
        {/* Botão de Fixar/Desafixar no topo */}
        <button
          onClick={onTogglePin}
          title={isPinned ? 'Desafixar menu lateral (tornar retrátil)' : 'Fixar menu lateral aberto'}
          className={`p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 shrink-0 ${
            isPinned
              ? 'bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-transparent'
          }`}
        >
          {isPinned ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeft className="w-4 h-4" />
          )}
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
      <div className="hidden lg:flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0 font-mono">
          <Clock className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
          <span>America/Sao_Paulo (GMT-3)</span>
        </div>
        <span className="text-neutral-300 dark:text-neutral-700" aria-hidden="true">·</span>
        <span className="whitespace-nowrap shrink-0">
          13 Abas Ativas
        </span>
      </div>

      {/* Zone 3: Primary Action Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Alternador de Tema Claro / Escuro */}
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
          className="p-2 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Modo Claro</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-500" />
              <span className="hidden sm:inline">Modo Escuro</span>
            </>
          )}
        </button>

        {/* Botão Expandir / Recolher Tela Cheia (Só o Ícone) */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Recolher Tela Cheia' : 'Expandir Tela Cheia'}
          className="p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
          aria-label={isFullscreen ? 'Recolher Tela Cheia' : 'Expandir Tela Cheia'}
        >
          {isFullscreen ? (
            <Minimize className="w-4 h-4 text-orange-500" />
          ) : (
            <Maximize className="w-4 h-4" />
          )}
        </button>

        <button
          onClick={onResetDemo}
          title="Restaurar dados de teste padrão (Cenário de Aceitação: 2 dias, 2 horários, 5 vagas)"
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Restaurar Teste</span>
        </button>

        <a
          href={buildPublicEventPath(db.eventos[0]?.slug)}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir página pública independente em nova aba"
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
          <span>Ver Agendamento</span>
        </a>

        {activeTab === 'eventos' && (
          <button
            onClick={onNewEvent}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 shadow-sm shadow-orange-600/30 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Evento</span>
          </button>
        )}
      </div>
    </header>
  );
};
