export default function handler(_req: any, res: any) {
  const effectiveUrl = (
    process.env.GAS_WEBAPP_URL ||
    process.env.VITE_GAS_WEBAPP_URL ||
    ''
  ).trim();
  const hasServerGasUrl = Boolean(effectiveUrl);
  const engsegRequired =
    String(process.env.ENGSEG_REQUIRED || process.env.VITE_ENGSEG_REQUIRED || '').toLowerCase() === 'true';
  const engsegEmail = (process.env.ENGSEG_ADMIN_EMAIL || '').trim();

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    cloudConfigured: hasServerGasUrl,
    webappUrl: effectiveUrl,
    apiToken: process.env.DRIVE_API_SECRET || '',
    engsegRequired,
    engsegEmail
  });
}
