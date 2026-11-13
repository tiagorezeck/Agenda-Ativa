/**
 * Comprime imagens selecionadas por upload para Data URL compacto (< 25 KB),
 * mantendo o database_root.json leve e dentro do limite de 50.000 caracteres/célula do Google Sheets.
 */
export function compressImageFileToDataUrl(
  file: File,
  maxDimension: number = 256,
  quality: number = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo de imagem.'));
    reader.onload = (ev) => {
      const dataUrl = typeof ev.target?.result === 'string' ? ev.target.result : '';
      if (!dataUrl) {
        reject(new Error('Arquivo de imagem inválido.'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem não suportado pelo navegador.'));
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Tenta WebP primeiro, com fallback para JPEG se necessário
          let compressed = canvas.toDataURL('image/webp', quality);
          if (!compressed.startsWith('data:image/webp')) {
            compressed = canvas.toDataURL('image/jpeg', quality);
          }
          resolve(compressed);
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
