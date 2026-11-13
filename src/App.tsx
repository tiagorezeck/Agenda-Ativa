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
import { EngsegTwoFactorGate } from './components/security/EngsegTwoFactorGate';
import { storage } from './services/storageService';
import { getEngsegConfig, isEngsegSessionVerified, subscribeEngseg } from './services/engsegService';
import { EventoEntity } from './types/database';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isPublicView, setIsPublicView] = useState(false);
  const [publicSlug, setPublicSlug] = useState<string>('');

  // Tema Claro e Escuro
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('app_theme') as 'light' | 'dark') || 'dark';
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

  // Detectar rota na URL (ex: /agendar/slug-do-evento) e sincronizar da nuvem na abertura
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/agendar/')) {
      const slug = path.replace('/agendar/', '').trim();
      if (slug) {
        setPublicSlug(slug);
        setIsPublicView(true);
      }
    }

    storage.bootstrapFromCloud().then((updated) => {
      if (updated) {
        setRefreshCounter(c => c + 1);
      }
    });
  }, []);

  const handleRefresh = () => {
    setRefreshCounter(c => c + 1);
  };

  const handleOpenPublicForEvent = (slug: string) => {
    setPublicSlug(slug);
    setIsPublicView(true);
  };

  const handleOpenPublicGeneral = () => {
    const db = storage.getDatabase();
    const slug = db.eventos[0]?.slug || 'mentoria-comercial-estrategica';
    setPublicSlug(slug);
    setIsPublicView(true);
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

  // Se estiver na visualização pública do cliente (sempre aberta, sem exigir 2FA)
  if (isPublicView) {
    return (
      <PublicBookingView
        key={refreshCounter}
        initialSlug={publicSlug}
        theme={theme}
        onToggleTheme={toggleTheme}
        onBackToAdmin={() => {
          setIsPublicView(false);
          window.history.pushState({}, '', '/');
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
        />

        {/* Viewport dos Módulos com Rolagem */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
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

          {activeTab === 'configuracoes' && (
            <SettingsView key={refreshCounter} onDataSynced={handleRefresh} />
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
