const crypto = require('crypto');

const SUPABASE_URL = 'https://hplromejpkrrdaigmzkf.supabase.co';

function generateShortCode() {
  // e.g. "BIA-4829"
  const num = Math.floor(1000 + Math.random() * 9000);
  return `BIA-${num}`;
}

function supabaseHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { from_name, to_name } = req.body;
  if (!from_name || !to_name)
    return res.status(400).json({ error: 'Missing names' });

  // Affection level (0=friendly, 1=flirty default, 2=romantic)
  const tone = [0, 1, 2].includes(Number(req.body.tone)) ? Number(req.body.tone) : 1;

  const token     = crypto.randomBytes(16).toString('hex');
  const shortCode = generateShortCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/telegram_sessions`, {
    method: 'POST',
    headers: { ...supabaseHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify({ token, short_code: shortCode, from_name, to_name, tone, status: 'pending', expires_at: expiresAt })
  });

  if (!insertRes.ok) {
    const err = await insertRes.text();
    return res.status(500).json({ error: 'Failed to create session', detail: err });
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'BiaBeriimbot';
  return res.status(200).json({
    token,
    short_code: shortCode,
    bot_url: `https://t.me/${botUsername}`,
    // one-tap deep link: opens the bot and auto-sends "/start <token>"
    deep_link: `https://t.me/${botUsername}?start=${token}`
  });
};
