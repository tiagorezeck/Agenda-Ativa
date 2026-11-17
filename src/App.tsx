import React, { useState, useEffect } from 'react';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './components/dashboard/DashboardView';
import { EventListView } from './components/events/EventListView';
import { EventModal } from './components/events/EventModal';
import { AvailabilityManagerView } from './components/availability/AvailabilityManagerView';
import { FormBuilderView } from './components/forms/FormBuilderView';
import { LeadsView } from './components/leads/LeadsView';
import { CrmKanbanView } from './components/crm/CrmKanbanView';
import { QRCodeModal } from './components/qrcode/QRCodeModal';
import { PublicBookingView } from './components/public/PublicBookingView';
import { SettingsView } from './components/settings/SettingsView';
import { UsersView } from './components/settings/UsersView';
import { EngsegTwoFactorGate } from './components/security/EngsegTwoFactorGate';
import { LoginLandingView } from './components/security/LoginLandingView';
import { GoalsView } from './components/goals/GoalsView';
import { storage } from './services/storageService';
import { applyDriveOverrideFromLocation, isCloudActive } from './services/driveSyncService';
import { getEngsegConfig, isEngsegSessionVerified, subscribeEngseg } from './services/engsegService';
import {
  getLoggedInUser,
  podeAcessarModulo,
  podeAcessarConfigEmpresa,
  podeAcessarConfigBanco,
  podeAcessarConfigUsuarios,
  podeAcessarConfigEngseg
} from './services/authService';
import { EventoEntity } from './types/database';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isPublicView, setIsPublicView] = useState(false);
  const [publicSlug, setPublicSlug] = useState<string>('');
  const [isThankYouClosedRoute, setIsThankYouClosedRoute] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('agenda_ativa_current_user'));
  });

  useEffect(() => {
    const canViewTab = (tab: ActiveTab): boolean => {
      const usr = getLoggedInUser();
      if (tab === 'config_empresa') return podeAcessarConfigEmpresa(usr);
      if (tab === 'config_banco') return podeAcessarConfigBanco(usr);
      if (tab === 'config_usuarios') return podeAcessarConfigUsuarios(usr);
      if (tab === 'config_engseg') return podeAcessarConfigEngseg(usr);
      return podeAcessarModulo(usr, tab);
    };

    const handleAuthChange = () => {
      const logged = Boolean(localStorage.getItem('agenda_ativa_current_user'));
      setIsLoggedIn(logged);
      if (logged) {
        setActiveTab(prev => (canViewTab(prev) ? prev : 'dashboard'));
      }
    };
    window.addEventListener('auth_user_changed', handleAuthChange);
    return () => window.removeEventListener('auth_user_changed', handleAuthChange);
  }, []);

  // Tema Claro e Escuro (com detecção do navegador no primeiro acesso)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('app_theme');
    let initial: 'light' | 'dark' = 'light';
    if (saved === 'light' || saved === 'dark') {
      initial = saved;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      initial = 'dark';
    }
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', initial === 'dark');
    }
    return initial;
  });

  // Menu Lateral Retrátil com Fixação por Botão
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    return localStorage.getItem('sidebar_pinned') === 'true';
  });

  // Módulo ENGSEG — Estado 2FA
  const [engsegEnabled, setEngsegEnabled] = useState<boolean>(() => getEngsegConfig().enabled);
  const [engsegVerified, setEngsegVerified] = useState<boolean>(() => isEngsegSessionVerified());

  useEffect(() => {
    return subscribeEngseg(() => {
      setEngsegEnabled(getEngsegConfig().enabled);
      setEngsegVerified(isEngsegSessionVerified());
    });
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleTogglePin = () => {
    setIsPinned(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_pinned', String(next));
      return next;
    });
  };

  // Modais Globais
  const [modalNewEventOpen, setModalNewEventOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [qrCodeModalEvento, setQrCodeModalEvento] = useState<EventoEntity | null>(null);
  const [targetEventoId, setTargetEventoId] = useState<string | undefined>(undefined);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [cloudBootstrapping, setCloudBootstrapping] = useState<boolean>(() => storage.getCloudState().bootstrapping);

  const syncRouteFromLocation = () => {
    applyDriveOverrideFromLocation(window.location.search);
    const rawPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    if (rawPath === '/obrigado' || rawPath.endsWith('/obrigado')) {
      const cleanSlug = rawPath
        .replace(/^\/agendar\/?/, '')
        .replace(/\/obrigado$/, '')
        .replace(/^\/+/, '')
        .trim();
      setPublicSlug(cleanSlug ? decodeURIComponent(cleanSlug) : '');
      setIsThankYouClosedRoute(true);
      setIsPublicView(true);
      return;
    }

    if (rawPath === '/agendar' || rawPath.startsWith('/agendar/')) {
      const cleanSlug = rawPath
        .replace(/^\/agendar\/?/, '')
        .trim();
      setPublicSlug(decodeURIComponent(cleanSlug));
      setIsThankYouClosedRoute(false);
      setIsPublicView(true);
    } else {
      setIsThankYouClosedRoute(false);
      setIsPublicView(false);
    }
  };

  // Detectar rota na URL (ex: /agendar/slug-do-evento), assinar atualizações em tempo real do Sheets e escutar popstate
  useEffect(() => {
    syncRouteFromLocation();

    const unsubStorage = storage.subscribe(() => {
      setCloudBootstrapping(storage.getCloudState().bootstrapping);
      setRefreshCounter((c) => c + 1);
    });

    const handlePopState = () => {
      syncRouteFromLocation();
    };
    window.addEventListener('popstate', handlePopState);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isCloudActive()) {
        storage.pullFromCloud(true).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    storage.bootstrapFromCloud();

    return () => {
      unsubStorage();
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const handleRefresh = async () => {
    if (isCloudActive()) {
      try {
        await storage.pullFromCloud(true);
      } catch (e) {
        console.warn('Falha ao atualizar do Sheets:', e);
      }
    }
    setRefreshCounter((c) => c + 1);
  };

  const handleOpenPublicForEvent = (slug: string) => {
    setPublicSlug(slug);
    setIsThankYouClosedRoute(false);
    setIsPublicView(true);
    if (slug && window.location.pathname !== `/agendar/${slug}`) {
      window.history.pushState({}, '', `/agendar/${slug}`);
    }
  };

  const handleOpenPublicGeneral = () => {
    const db = storage.getDatabase();
    const slug = db.eventos[0]?.slug || '';
    setPublicSlug(slug);
    setIsThankYouClosedRoute(false);
    setIsPublicView(true);
    const targetPath = slug ? `/agendar/${slug}` : '/agendar';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const handleOpenFormBuilder = (eventoId: string) => {
    setTargetEventoId(eventoId);
    setActiveTab('formularios');
  };

  const handleOpenAvailability = (eventoId: string) => {
    setTargetEventoId(eventoId);
    setActiveTab('disponibilidade');
  };

  const handleResetDemo = () => {
    setResetConfirmOpen(true);
  };

  const confirmResetDemo = () => {
    storage.resetToDemo();
    setResetConfirmOpen(false);
    setRefreshCounter(c => c + 1);
  };

  // Se não estiver logado e não for visualização pública, exibe a Mini Landing Page de Login
  if (!isLoggedIn && !isPublicView) {
    return (
      <LoginLandingView
        onLoginSuccess={() => setIsLoggedIn(true)}
        onOpenPublicBooking={handleOpenPublicGeneral}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  // Visualização pública 100% independente (sem acesso ao painel administrativo)
  if (isPublicView) {
    return (
      <PublicBookingView
        initialSlug={publicSlug}
        initialThankYouClosed={isThankYouClosedRoute}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSelectSlug={(newSlug) => {
          setPublicSlug(newSlug);
          if (newSlug && window.location.pathname !== `/agendar/${newSlug}`) {
            window.history.pushState({}, '', `/agendar/${encodeURIComponent(newSlug)}${window.location.search}`);
          }
        }}
      />
    );
  }

  // Se o Módulo ENGSEG 2FA estiver ativo e a sessão ainda não verificada
  if (engsegEnabled && !engsegVerified) {
    return (
      <EngsegTwoFactorGate
        onVerified={() => setEngsegVerified(true)}
        onOpenPublic={handleOpenPublicGeneral}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors">
      {/* Sidebar Lateral Retrátil com Fixação */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setTargetEventoId(undefined);
        }}
        onOpenPublicView={handleOpenPublicGeneral}
        onRefresh={handleRefresh}
        isPinned={isPinned}
        onTogglePin={handleTogglePin}
        theme={theme}
      />

      {/* Área de Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar Contextual com Alternador de Tema e Controle de Fixação */}
        <Header
          activeTab={activeTab}
          theme={theme}
          onToggleTheme={toggleTheme}
          isPinned={isPinned}
          onTogglePin={handleTogglePin}
          onNewEvent={() => setModalNewEventOpen(true)}
          onOpenPublic={handleOpenPublicGeneral}
          onResetDemo={handleResetDemo}
          onLogout={() => setIsLoggedIn(false)}
          onOpenProfile={() => setActiveTab('config_usuarios')}
        />

        {/* Viewport dos Módulos com Rolagem */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {cloudBootstrapping && (
            <div className="px-4 py-2.5 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/60 rounded-xl text-xs text-orange-800 dark:text-orange-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
              <span>Sincronizando dados em tempo real diretamente do Google Sheets...</span>
            </div>
          )}

          {activeTab === 'dashboard' && <DashboardView key={refreshCounter} />}

          {activeTab === 'eventos' && (
            <EventListView
              key={refreshCounter}
              onOpenPublicEvent={handleOpenPublicForEvent}
              onOpenQrCode={(ev) => setQrCodeModalEvento(ev)}
              onOpenFormBuilder={handleOpenFormBuilder}
              onOpenAvailability={handleOpenAvailability}
            />
          )}

          {activeTab === 'disponibilidade' && (
            <AvailabilityManagerView
              key={refreshCounter}
              initialEventoId={targetEventoId}
            />
          )}

          {activeTab === 'formularios' && (
            <FormBuilderView
              key={refreshCounter}
              initialEventoId={targetEventoId}
            />
          )}

          {activeTab === 'leads' && <LeadsView key={refreshCounter} />}

          {activeTab === 'crm' && <CrmKanbanView key={refreshCounter} />}

          {activeTab === 'metas' && <GoalsView key={refreshCounter} />}

          {activeTab === 'qrcode' && (
            <div className="space-y-6">
              <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                  Central de Divulgação: Links e QR Codes
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Selecione um evento abaixo para gerar e visualizar o QR Code em alta definição, copiar link de agendamento ou compartilhar no WhatsApp.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {storage.getDatabase().eventos.map((ev) => (
                  <div
                    key={ev.id_evento}
                    className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-3 shadow-sm"
                  >
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-white">{ev.nome}</h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">/agendar/{ev.slug}</p>
                    </div>

                    <button
                      onClick={() => setQrCodeModalEvento(ev)}
                      className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                    >
                      Abrir QR Code &amp; Compartilhar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'config_empresa' && podeAcessarConfigEmpresa(getLoggedInUser()) && (
            <SettingsView key="empresa" section="empresa" onDataSynced={() => setRefreshCounter((c) => c + 1)} />
          )}

          {activeTab === 'config_banco' && podeAcessarConfigBanco(getLoggedInUser()) && (
            <SettingsView key="banco" section="banco" onDataSynced={() => setRefreshCounter((c) => c + 1)} />
          )}

          {activeTab === 'config_usuarios' && (
            <UsersView
              key="usuarios"
              onlySelf={!podeAcessarConfigUsuarios(getLoggedInUser())}
              onDataSynced={() => setRefreshCounter((c) => c + 1)}
            />
          )}

          {activeTab === 'config_engseg' && podeAcessarConfigEngseg(getLoggedInUser()) && (
            <SettingsView key="engseg" section="engseg" onDataSynced={() => setRefreshCounter((c) => c + 1)} />
          )}
        </main>
      </div>

      {/* Modal de Criação de Evento */}
      {modalNewEventOpen && (
        <EventModal
          onClose={() => setModalNewEventOpen(false)}
          onSaved={() => {
            setModalNewEventOpen(false);
            setRefreshCounter(c => c + 1);
            setActiveTab('eventos');
          }}
        />
      )}

      {/* Modal de QR Code */}
      {qrCodeModalEvento && (
        <QRCodeModal
          evento={qrCodeModalEvento}
          onClose={() => setQrCodeModalEvento(null)}
          onOpenPublic={(slug) => {
            setQrCodeModalEvento(null);
            handleOpenPublicForEvent(slug);
          }}
        />
      )}

      {/* Modal de Confirmação para Restaurar Teste */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              Restaurar Cenário de Teste?
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Isso restaurará os dados de demonstração padrão (evento com 2 horários e 5 vagas por horário) e sincronizará com a nuvem se ativa.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className="px-3.5 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmResetDemo}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Confirmar Restauração
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
