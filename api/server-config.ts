export default function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const webappUrl = (
      process.env.GAS_WEBAPP_URL ||
      process.env.VITE_GAS_WEBAPP_URL ||
      ''
    ).trim();

    return res.status(200).json({
      webappUrl,
      apiToken: process.env.DRIVE_API_SECRET || ''
    });
  }

  if (req.method === 'POST') {
    return res.status(200).json({
      status: 'success',
      message: 'Configuração recebida. Em produção no Vercel, defina a variável GAS_WEBAPP_URL no painel da Vercel ou no src/config/gasConfig.ts.'
    });
  }

  return res.status(405).json({ status: 'error', message: 'Método não permitido.' });
}
