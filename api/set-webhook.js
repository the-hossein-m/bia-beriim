// TEMPORARY one-time utility: (re)point the Telegram webhook to THIS deployment.
// Safe by design — it can only ever set the webhook to this host's own
// /api/telegram-webhook, using the TELEGRAM_BOT_TOKEN already in the environment.
// The bot token is never exposed in the response. Remove this file after use.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const TG = process.env.TELEGRAM_BOT_TOKEN;
  if (!TG) {
    return res.status(500).json({
      error: 'TELEGRAM_BOT_TOKEN is not set on this deployment. Set it in Vercel → Environment Variables (Production) and redeploy.'
    });
  }

  const host    = req.headers['x-forwarded-host'] || req.headers.host;
  const hookUrl = `https://${host}/api/telegram-webhook`;

  const setRes = await fetch(
    `https://api.telegram.org/bot${TG}/setWebhook?url=${encodeURIComponent(hookUrl)}&drop_pending_updates=true`
  );
  const set = await setRes.json();

  const infoRes = await fetch(`https://api.telegram.org/bot${TG}/getWebhookInfo`);
  const info    = await infoRes.json();

  // Redact the token if Telegram ever echoes the URL back
  if (info?.result?.url) info.result.url = info.result.url.replace(TG, '<token>');

  return res.status(200).json({ pointed_to: hookUrl, set, webhook_info: info });
};
