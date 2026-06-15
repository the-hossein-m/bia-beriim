const SUPABASE_URL = 'https://hplromejpkrrdaigmzkf.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbHJvbWVqcGtycmRhaWdtemtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMTUzODIsImV4cCI6MjA5Njg5MTM4Mn0.guKWuD3x3c595ZApqMMB_Zu-vQbxAArDGo86GO41YEQ';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const key = process.env.SUPABASE_SERVICE_KEY || ANON_KEY;
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/senders?invite_token=eq.${token}&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  const rows = await r.json();
  if (!rows.length) return res.status(404).json({ error: 'Invalid invite link' });

  const { id, from_name, to_name, tone } = rows[0];
  return res.status(200).json({ sender_id: id, from_name, to_name, tone: tone ?? 1 });
};
