export default function handler(_req: any, res: any) {
  res.status(200).json({
    status: 'ok',
    service: 'Agenda Ativa — Motor DADOS DRIVE v2.0 (Vercel Serverless)',
    timestamp: new Date().toISOString()
  });
}
