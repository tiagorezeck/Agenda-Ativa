import React, { useEffect } from 'react';

interface LogoAgendaAtivaProps {
  size?: 'sm' | 'md' | 'lg' | 'collapsed';
  showBadge?: boolean;
  theme?: 'light' | 'dark';
}

const LOGO_PATHS = {
  lightFull: '/assets/aistudio/image_5db5c7cd.png',
  darkFull: '/assets/aistudio/image_77c20e1a.png',
  lightCollapsed: '/assets/aistudio/calp_1df590ae.png',
  darkCollapsed: '/assets/aistudio/calb_a1a7f839.png'
} as const;

let logosPreloaded = false;

export const LogoAgendaAtiva: React.FC<LogoAgendaAtivaProps> = ({
  size = 'md',
  showBadge = false,
  theme
}) => {
  const isCollapsed = size === 'collapsed';

  useEffect(() => {
    if (logosPreloaded || typeof window === 'undefined') return;
    logosPreloaded = true;
    Object.values(LOGO_PATHS).forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Ícone compacto para o menu lateral recolhido (calp = Modo Claro, calb = Modo Escuro)
  // Logo completa para cabeçalho, menu expandido e landing page
  const lightSrc = isCollapsed ? LOGO_PATHS.lightCollapsed : LOGO_PATHS.lightFull;
  const darkSrc = isCollapsed ? LOGO_PATHS.darkCollapsed : LOGO_PATHS.darkFull;

  const lightDims = isCollapsed ? { width: 1536, height: 1024 } : { width: 814, height: 267 };
  const darkDims = isCollapsed ? { width: 1536, height: 1024 } : { width: 798, height: 225 };

  const sizeClass =
    isCollapsed
      ? 'h-9 w-auto max-w-full shrink-0'
      : size === 'sm'
      ? 'h-8 w-auto max-w-full shrink-0'
      : size === 'lg'
      ? 'h-12 w-auto max-w-full shrink-0'
      : 'h-9 w-auto max-w-full shrink-0';

  return (
    <div className="flex items-center justify-center gap-2 select-none max-w-full">
      {theme === 'light' && (
        <img
          src={lightSrc}
          alt="Agenda Ativa"
          width={lightDims.width}
          height={lightDims.height}
          className={`${sizeClass} object-contain block`}
        />
      )}

      {theme === 'dark' && (
        <img
          src={darkSrc}
          alt="Agenda Ativa"
          width={darkDims.width}
          height={darkDims.height}
          className={`${sizeClass} object-contain block`}
        />
      )}

      {!theme && (
        <>
          <img
            src={lightSrc}
            alt="Agenda Ativa"
            width={lightDims.width}
            height={lightDims.height}
            className={`${sizeClass} object-contain dark:hidden`}
          />
          <img
            src={darkSrc}
            alt="Agenda Ativa"
            width={darkDims.width}
            height={darkDims.height}
            className={`${sizeClass} object-contain hidden dark:block`}
          />
        </>
      )}

      {showBadge && !isCollapsed && (
        <span className="hidden sm:inline text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold tracking-wider shrink-0">
          Pro
        </span>
      )}
    </div>
  );
};
