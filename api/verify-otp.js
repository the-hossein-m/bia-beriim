const crypto = require('crypto');
const SUPABASE_URL = 'https://hplromejpkrrdaigmzkf.supabase.co';

function normalizePhone(phone) {
  return phone.replace(/\D/g, '').replace(/^0/, '98');
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { phone, code, from_name, to_name } = req.body;
  if (!phone || !code || !from_name || !to_name)
    return res.status(400).json({ error: 'اطلاعات ناقص است' });

  // Affection level (0=friendly, 1=flirty default, 2=romantic)
  const tone = [0, 1, 2].includes(Number(req.body.tone)) ? Number(req.body.tone) : 1;

  const normalizedPhone = normalizePhone(phone);

  // Find valid OTP
  const otpRes = await fetch(
    `${SUPABASE_URL}/rest/v1/otp_sessions?phone=eq.${normalizedPhone}&code=eq.${code}&used=eq.false&order=created_at.desc&limit=1`,
    { headers: supabaseHeaders() }
  );
  const otps = await otpRes.json();

  if (!otps.length)
    return res.status(400).json({ error: 'کد وارد شده اشتباه است' });

  const otp = otps[0];

  if (new Date(otp.expires_at) < new Date())
    return res.status(400).json({ error: 'کد منقضی شده. دوباره درخواست کن' });

  // Mark OTP as used
  await fetch(`${SUPABASE_URL}/rest/v1/otp_sessions?id=eq.${otp.id}`, {
    method: 'PATCH',
    headers: supabaseHeaders(),
    body: JSON.stringify({ used: true })
  });

  // Create sender record
  const inviteToken = crypto.randomBytes(5).toString('hex');

  const senderRes = await fetch(`${SUPABASE_URL}/rest/v1/senders`, {
    method: 'POST',
    headers: { ...supabaseHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify({ from_name, to_name, phone: normalizedPhone, verified: true, invite_token: inviteToken, tone })
  });

  const senders = await senderRes.json();
  if (!senders.length)
    return res.status(500).json({ error: 'خطا در ایجاد حساب' });

  // Use the request host so dev-created links stay on dev (and prod on prod)
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'bia-beriim.vercel.app';
  const inviteUrl = `https://${host}/i/${inviteToken}`;
  return res.status(200).json({ success: true, sender_id: senders[0].id, invite_url: inviteUrl });
};
