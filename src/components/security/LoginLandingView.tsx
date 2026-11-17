import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Lock,
  ExternalLink,
  X,
  UserPlus,
  LogIn,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Camera
} from 'lucide-react';
import { LogoAgendaAtiva } from '../common/LogoAgendaAtiva';
import {
  authenticateUser,
  DEFAULT_USERS,
  setLoggedInUser
} from '../../services/authService';
import { UsuarioEntity, PerfilUsuario } from '../../types/database';
import { storage } from '../../services/storageService';
import { aplicarMascaraTelefoneBR, isEmailValido } from '../../utils/formatters';
import { compressImageFileToDataUrl } from '../../utils/imageCompressor';

interface LoginLandingViewProps {
  onLoginSuccess: (user: UsuarioEntity) => void;
  onOpenPublicBooking: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const LoginLandingView: React.FC<LoginLandingViewProps> = ({
  onLoginSuccess,
  onOpenPublicBooking,
  theme,
  onToggleTheme
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Form de Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginSenha, setLoginSenha] = useState('');
  const [showLoginSenha, setShowLoginSenha] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginHint, setLoginHint] = useState('');
  const senhaInputRef = useRef<HTMLInputElement>(null);

  // Form de Registro
  const [regNome, setRegNome] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regSenha, setRegSenha] = useState('');
  const [showRegSenha, setShowRegSenha] = useState(false);
  const [regTelefone, setRegTelefone] = useState('');
  const [regCargo, setRegCargo] = useState('');
  const [regFotoUrl, setRegFotoUrl] = useState('');
  const [regPerfil, setRegPerfil] = useState<PerfilUsuario>('AGENTE');
  const [regSuccess, setRegSuccess] = useState('');
  const [regError, setRegError] = useState('');

  const [activeUsers, setActiveUsers] = useState<UsuarioEntity[]>(() => {
    const db = storage.getDatabase();
    const list = db.usuarios && db.usuarios.length > 0 ? db.usuarios : DEFAULT_USERS;
    return list.filter(u => u.ativo !== false);
  });

  useEffect(() => {
    const sync = () => {
      const db = storage.getDatabase();
      const list = db.usuarios && db.usuarios.length > 0 ? db.usuarios : DEFAULT_USERS;
      setActiveUsers(list.filter(u => u.ativo !== false));
    };
    return storage.subscribe(sync);
  }, []);

  const isDark = theme === 'dark';

  const handleQuickSelectProfile = (user: UsuarioEntity) => {
    setLoginError('');
    setLoginHint('');
    if (user.ativo === false) {
      setLoginError('Este usuário aguarda aprovação do Admin/Gestor.');
      return;
    }
    if (user.perfil === 'ADMIN' || Boolean(user.senha)) {
      setLoginEmail(user.email);
      setLoginSenha('');
      setLoginHint(`Login "${user.email}" preenchido. Digite sua senha para entrar.`);
      setTimeout(() => senhaInputRef.current?.focus(), 50);
      return;
    }
    setLoggedInUser(user);
    onLoginSuccess(user);
  };

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginHint('');
    const db = storage.getDatabase();
    const res = authenticateUser(loginEmail, loginSenha, db.usuarios);
    if (res.ok) {
      setLoggedInUser(res.user);
      onLoginSuccess(res.user);
    } else {
      setLoginError(res.error);
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    if (!regNome.trim() || !regEmail.trim() || !regSenha.trim()) {
      setRegError('Preencha nome completo, e-mail corporativo e senha.');
      return;
    }
    if (!isEmailValido(regEmail)) {
      setRegError('Informe um e-mail válido contendo @.');
      return;
    }
    if (regSenha.trim().length < 6) {
      setRegError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    try {
      storage.registerPendingUser(regNome.trim(), regEmail.trim(), regPerfil, {
        senha: regSenha.trim(),
        telefone: regTelefone.trim() || undefined,
        cargo: regCargo.trim() || undefined,
        foto_url: regFotoUrl.trim() || undefined
      });
      setRegSuccess('Cadastro realizado com sucesso! Aguarde a autorização do Administrador ou Gestor para acessar o painel.');
      setRegNome('');
      setRegEmail('');
      setRegSenha('');
      setRegTelefone('');
      setRegCargo('');
      setRegFotoUrl('');
    } catch (err: any) {
      setRegError(err?.message || 'Erro ao solicitar cadastro.');
    }
  };

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex flex-col justify-between p-6 select-none transition-colors ${
        isDark ? 'bg-neutral-950 text-neutral-100' : 'bg-neutral-100 text-neutral-900'
      }`}
    >
      {/* Top Navbar */}
      <header className="flex items-center justify-between shrink-0">
        <LogoAgendaAtiva size="md" showBadge={true} />

        <div className="flex items-center gap-3">
          <button
            onClick={onToggleTheme}
            title={isDark ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
            className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center transition-colors border cursor-pointer ${
              isDark
                ? 'bg-neutral-900 hover:bg-neutral-800 text-amber-400 border-neutral-800'
                : 'bg-white hover:bg-neutral-200 text-indigo-600 border-neutral-300 shadow-sm'
            }`}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            onClick={onOpenPublicBooking}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border cursor-pointer ${
              isDark
                ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
                : 'bg-white hover:bg-neutral-200 text-neutral-700 border-neutral-300 shadow-sm'
            }`}
          >
            <span>Página Pública</span>
            <ExternalLink size={13} />
          </button>

          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-600/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Lock size={14} />
            <span>Acessar / Criar Conta</span>
          </button>
        </div>
      </header>

      {/* Hero Content (Single Page No Scroll) */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 max-w-7xl mx-auto w-full my-auto">
        <div className="flex-1 space-y-6 text-left max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-600 dark:text-orange-400 text-xs font-medium">
            <Sparkles size={14} />
            <span>Sistema Definitivo de Agendamentos, Leads &amp; CRM</span>
          </div>

          <h1
            className={`text-3xl md:text-5xl font-extrabold tracking-tight leading-tight ${
              isDark ? 'text-white' : 'text-neutral-900'
            }`}
          >
            Simplifique seus{' '}
            <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
              Agendamentos
            </span>{' '}
            e Acelere Vendas
          </h1>

          <p className={`text-sm md:text-base leading-relaxed ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Gestão completa com Google Sheets e Drive. Anti-overbooking rigoroso, CRM Kanban de arrastar e soltar, metas por agente e 3 níveis de acesso corporativo.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={() => {
                setAuthMode('login');
                setModalOpen(true);
              }}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-xl shadow-orange-600/30 flex items-center gap-2 transition-all cursor-pointer"
            >
              <LogIn size={15} />
              <span>Entrar no Sistema</span>
            </button>

            <button
              onClick={() => {
                setAuthMode('register');
                setModalOpen(true);
              }}
              className={`px-6 py-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors border cursor-pointer ${
                isDark
                  ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-neutral-800'
                  : 'bg-white hover:bg-neutral-200 text-neutral-800 border-neutral-300 shadow-sm'
              }`}
            >
              <UserPlus size={15} />
              <span>Solicitar Novo Cadastro</span>
            </button>
          </div>
        </div>

        {/* Hero Visual Mockup Image */}
        <div className="flex-1 max-w-lg w-full hidden lg:block">
          <div
            className={`relative rounded-3xl overflow-hidden border shadow-2xl ${
              isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-300 shadow-xl'
            }`}
          >
            <img
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80"
              alt="Dashboard Preview"
              className="w-full h-80 object-cover opacity-85 hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent flex items-end p-6">
              <div className="space-y-1">
                <span className="text-xs font-bold text-orange-400">Agenda Ativa Pro</span>
                <p className="text-xs text-neutral-300">
                  Controle total de horários, CRM e faturamento em tempo real.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Features Bar */}
      <footer
        className={`shrink-0 pt-4 border-t flex flex-wrap items-center justify-between text-xs gap-4 ${
          isDark ? 'border-neutral-900 text-neutral-500' : 'border-neutral-300 text-neutral-600'
        }`}
      >
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-orange-500" /> Anti-Overbooking
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-orange-500" /> CRM Kanban
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-orange-500" /> Google Sheets &amp; Drive
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-orange-500" /> Controle de Metas
          </span>
        </div>
        <p>Agenda Ativa &copy; {new Date().getFullYear()}</p>
      </footer>

      {/* Auth Modal (Login / Register) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div
            className={`border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 relative max-h-[92vh] overflow-y-auto ${
              isDark
                ? 'bg-neutral-900 border-neutral-800 text-white'
                : 'bg-white border-neutral-300 text-neutral-900 shadow-2xl'
            }`}
          >
            <button
              onClick={() => setModalOpen(false)}
              className={`absolute top-5 right-5 p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? 'text-neutral-400 hover:text-white bg-neutral-800/60'
                  : 'text-neutral-500 hover:text-neutral-900 bg-neutral-100'
              }`}
            >
              <X size={16} />
            </button>

            {/* Modal Tabs */}
            <div className={`flex items-center gap-2 border-b pb-3 ${isDark ? 'border-neutral-800' : 'border-neutral-200'}`}>
              <button
                onClick={() => setAuthMode('login')}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer ${
                  authMode === 'login'
                    ? 'bg-orange-600 text-white'
                    : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-white'
                }`}
              >
                Entrar
              </button>
              <button
                onClick={() => setAuthMode('register')}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-orange-600 text-white'
                    : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-white'
                }`}
              >
                Solicitar Cadastro
              </button>
            </div>

            {authMode === 'login' ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                    Acessar Painel
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    Entre com seu e-mail e senha cadastrados ou teste um perfil operacional.
                  </p>
                </div>

                {/* Perfis Cadastrados */}
                {activeUsers.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-semibold text-neutral-500">
                      Acessos Disponíveis:
                    </span>
                    <div
                      className={`grid gap-2 ${
                        activeUsers.length === 1
                          ? 'grid-cols-1'
                          : activeUsers.length === 2
                          ? 'grid-cols-2'
                          : 'grid-cols-3'
                      }`}
                    >
                      {activeUsers.map((usr) => (
                        <button
                          key={usr.id_usuario}
                          type="button"
                          onClick={() => handleQuickSelectProfile(usr)}
                          className={`p-2.5 rounded-xl border text-left text-xs cursor-pointer transition-colors ${
                            isDark
                              ? 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-white'
                              : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-300 text-neutral-900'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-bold">{usr.perfil}</p>
                            <Lock size={10} className="text-orange-500 shrink-0" />
                          </div>
                          <p className={`text-[10px] truncate ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                            {usr.nome} ({usr.email})
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="relative flex py-1 items-center">
                  <div className={`flex-grow border-t ${isDark ? 'border-neutral-800' : 'border-neutral-200'}`}></div>
                  <span className="flex-shrink mx-3 text-[10px] text-neutral-500 uppercase">login com senha</span>
                  <div className={`flex-grow border-t ${isDark ? 'border-neutral-800' : 'border-neutral-200'}`}></div>
                </div>

                <form onSubmit={handleCustomLogin} className="space-y-3.5">
                  {loginError && (
                    <div className="p-3 bg-rose-50 dark:bg-red-950/60 border border-rose-200 dark:border-red-900 rounded-xl text-xs text-rose-700 dark:text-red-200">
                      {loginError}
                    </div>
                  )}
                  {loginHint && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200">
                      {loginHint}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className={`text-xs font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                      Login ou E-mail
                    </label>
                    <input
                      type="text"
                      autoCapitalize="none"
                      autoCorrect="off"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="ex: admin ou seu@email.com.br"
                      className={`w-full px-4 py-2.5 border rounded-xl text-xs focus:outline-none focus:border-orange-500 ${
                        isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={`text-xs font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                      Senha de Acesso
                    </label>
                    <div className="relative">
                      <input
                        ref={senhaInputRef}
                        type={showLoginSenha ? 'text' : 'password'}
                        value={loginSenha}
                        onChange={(e) => setLoginSenha(e.target.value)}
                        placeholder="Digite sua senha..."
                        className={`w-full px-4 pr-10 py-2.5 border rounded-xl text-xs focus:outline-none focus:border-orange-500 ${
                          isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginSenha(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                      >
                        {showLoginSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer"
                  >
                    Entrar no Sistema
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                    Solicitar Novo Cadastro
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    O acesso será liberado após autorização do Admin ou Gestor.
                  </p>
                </div>

                <form onSubmit={handleRegister} className="space-y-3">
                  {regError && (
                    <div className="p-3 bg-rose-50 dark:bg-red-950/60 border border-rose-200 dark:border-red-900 rounded-xl text-xs text-rose-700 dark:text-red-200">
                      {regError}
                    </div>
                  )}
                  {regSuccess && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs text-emerald-700 dark:text-emerald-200 leading-relaxed">
                      {regSuccess}
                    </div>
                  )}

                  {/* Foto Opcional */}
                  <div className="flex items-center gap-3 p-2.5 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700">
                    {regFotoUrl ? (
                      <img src={regFotoUrl} alt="Avatar" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 shrink-0">
                        <Camera size={16} />
                      </div>
                    )}
                    <div className="flex-1 text-[11px]">
                      <p className="font-semibold">Foto de Perfil (opcional)</p>
                      <label className="text-orange-500 hover:underline font-semibold cursor-pointer">
                        <span>{regFotoUrl ? 'Alterar imagem' : 'Escolher arquivo'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const compressed = await compressImageFileToDataUrl(file, 256, 0.8);
                                setRegFotoUrl(compressed);
                              } catch {}
                            }
                          }}
                        />
                      </label>
                    </div>
                    {regFotoUrl && (
                      <button
                        type="button"
                        onClick={() => setRegFotoUrl('')}
                        className="text-neutral-400 hover:text-rose-500 p-1"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className={`text-xs font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      value={regNome}
                      onChange={(e) => setRegNome(e.target.value)}
                      placeholder="ex: Roberto Souza"
                      className={`w-full px-4 py-2.5 border rounded-xl text-xs focus:outline-none focus:border-orange-500 ${
                        isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={`text-xs font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                        E-mail Corporativo *
                      </label>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="roberto@empresa.com.br"
                        className={`w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-none focus:border-orange-500 ${
                          isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                        }`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={`text-xs font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                        Senha Desejada *
                      </label>
                      <div className="relative">
                        <input
                          type={showRegSenha ? 'text' : 'password'}
                          value={regSenha}
                          onChange={(e) => setRegSenha(e.target.value)}
                          placeholder="Mín. 6 caracteres"
                          className={`w-full px-3.5 pr-9 py-2.5 border rounded-xl text-xs focus:outline-none focus:border-orange-500 ${
                            isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegSenha(s => !s)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                        >
                          {showRegSenha ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={`text-xs font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                        WhatsApp
                      </label>
                      <input
                        type="tel"
                        maxLength={15}
                        value={regTelefone}
                        onChange={(e) => setRegTelefone(aplicarMascaraTelefoneBR(e.target.value))}
                        placeholder="(11) 99999-9999"
                        className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-mono focus:outline-none focus:border-orange-500 ${
                          isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                        }`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={`text-xs font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                        Cargo / Área
                      </label>
                      <input
                        type="text"
                        value={regCargo}
                        onChange={(e) => setRegCargo(e.target.value)}
                        placeholder="Ex: Vendedor, Marketing"
                        className={`w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-none focus:border-orange-500 ${
                          isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className={`text-xs font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                      Perfil Desejado
                    </label>
                    <select
                      value={regPerfil}
                      onChange={(e) => setRegPerfil(e.target.value as PerfilUsuario)}
                      className={`w-full px-4 py-2.5 border rounded-xl text-xs focus:outline-none focus:border-orange-500 ${
                        isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                      }`}
                    >
                      <option value="AGENTE">Agente (Vendas / Atendimento / Marketing)</option>
                      <option value="GESTOR">Gestor (Resultados e Processos)</option>
                      <option value="ADMIN">Administrador (Controle Total)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer"
                  >
                    Enviar Solicitação de Cadastro
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
