const SUPABASE_URL = 'https://hplromejpkrrdaigmzkf.supabase.co';
const SENDER = '0018018949161';

function normalizePhone(phone) {
  return phone.replace(/\D/g, '').replace(/^0/, '98');
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'شماره موبایل الزامی است' });

  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone.length < 11)
    return res.status(400).json({ error: 'شماره موبایل نامعتبر است' });

  const code = generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  // Delete old OTPs for this phone
  await fetch(`${SUPABASE_URL}/rest/v1/otp_sessions?phone=eq.${normalizedPhone}&used=eq.false`, {
    method: 'DELETE',
    headers: supabaseHeaders()
  });

  // Insert new OTP
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/otp_sessions`, {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify({ phone: normalizedPhone, code, expires_at: expiresAt, used: false })
  });

  if (!insertRes.ok) {
    const errBody = await insertRes.text();
    console.error('Supabase insert error:', insertRes.status, errBody);
    return res.status(500).json({ error: 'خطا در ذخیره کد', detail: errBody });
  }

  // Send SMS via Kavenegar
  const kavRes = await fetch(
    `https://api.kavenegar.com/v1/${process.env.KAVENEGAR_API_KEY}/sms/send.json`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        receptor: normalizedPhone,
        sender: SENDER,
        message: `کد تایید بیا بریم: ${code}`
      }).toString()
    }
  );

  const kavData = await kavRes.json();
  if (kavData.return?.status !== 200)
    return res.status(500).json({ error: 'خطا در ارسال پیامک', detail: kavData.return });

  return res.status(200).json({ success: true });
};
