import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { EventoEntity } from '../../types/database';
import { X, Copy, Check, Download, Share2, ExternalLink, QrCode as QrIcon } from 'lucide-react';

interface QRCodeModalProps {
  evento: EventoEntity;
  onClose: () => void;
  onOpenPublic: (slug: string) => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  evento,
  onClose,
  onOpenPublic
}) => {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const currentOrigin = window.location.origin;
  const publicUrl = `${currentOrigin}/agendar/${evento.slug}`;
  const mensagemWhatsApp = `Olá! Gostaria de convidar você para o evento *${evento.nome}*.\n\nEscolha o melhor dia e horário disponível através do link abaixo:\n${publicUrl}`;

  useEffect(() => {
    QRCode.toDataURL(
      publicUrl,
      {
        width: 320,
        margin: 2,
        color: {
          dark: '#121316',
          light: '#FFFFFF'
        }
      },
      (err, url) => {
        if (!err && url) {
          setQrDataUrl(url);
        }
      }
    );
  }, [publicUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `qrcode-${evento.slug}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensagemWhatsApp)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-neutral-900 dark:text-neutral-100 transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrIcon className="w-5 h-5 text-orange-500" />
            <h3 className="text-base font-semibold">
              Link Exclusivo &amp; QR Code
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          <div className="text-center space-y-1">
            <h4 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight">
              {evento.nome}
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
              /agendar/{evento.slug}
            </p>
          </div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-4 bg-neutral-50 dark:bg-white border border-neutral-200 dark:border-transparent rounded-2xl max-w-[240px] mx-auto shadow-sm">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Code para ${evento.nome}`}
                className="w-48 h-48 object-contain"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-xs text-neutral-400">
                Gerando QR Code...
              </div>
            )}
            <p className="text-[10px] text-neutral-500 mt-1 font-mono uppercase tracking-wider">
              Aponte a câmera para agendar
            </p>
          </div>

          {/* Link Copiável */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Link Direto de Agendamento
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={publicUrl}
                className="flex-1 px-3 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-neutral-200 font-mono select-all focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
            <button
              onClick={handleDownloadPng}
              className="px-3 py-2 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-orange-500" />
              <span>Baixar PNG</span>
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>WhatsApp</span>
            </a>

            <button
              onClick={() => {
                onClose();
                onOpenPublic(evento.slug);
              }}
              className="px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir Página</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
