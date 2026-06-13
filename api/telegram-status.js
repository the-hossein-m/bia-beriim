const SUPABASE_URL = 'https://hplromejpkrrdaigmzkf.supabase.co';

function supabaseHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const sessionRes = await fetch(
    `${SUPABASE_URL}/rest/v1/telegram_sessions?token=eq.${token}&limit=1`,
    { headers: supabaseHeaders() }
  );
  const sessions = await sessionRes.json();

  if (!sessions.length) return res.status(404).json({ error: 'Session not found' });

  const session = sessions[0];

  if (session.status === 'verified') {
    return res.status(200).json({ verified: true, sender_id: session.sender_id });
  }

  if (new Date(session.expires_at) < new Date()) {
    return res.status(200).json({ verified: false, expired: true });
  }

  return res.status(200).json({ verified: false });
};
