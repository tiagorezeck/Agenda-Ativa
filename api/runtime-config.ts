export default function handler(_req: any, res: any) {
  const hasServerGasUrl = Boolean(
    (process.env.GAS_WEBAPP_URL || process.env.VITE_GAS_WEBAPP_URL || '').trim()
  );
  const engsegRequired =
    String(process.env.ENGSEG_REQUIRED || process.env.VITE_ENGSEG_REQUIRED || '').toLowerCase() === 'true';
  const engsegEmail = (process.env.ENGSEG_ADMIN_EMAIL || '').trim();

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    cloudConfigured: hasServerGasUrl,
    engsegRequired,
    engsegEmail
  });
}
