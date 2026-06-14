const SUPABASE_URL = 'https://hplromejpkrrdaigmzkf.supabase.co';
const MP_USERNAME = process.env.MELIPAYAMAK_USERNAME || '989128401729';
const MP_PASSWORD = process.env.MELIPAYAMAK_PASSWORD || '05FPDBT28';
const MP_FROM     = process.env.MELIPAYAMAK_FROM     || '50004001891284';

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

  const isDev = process.env.NODE_ENV !== 'production';

  // In dev mode: skip SMS and return the code directly for testing
  if (isDev) {
    console.log(`[DEV] OTP for ${normalizedPhone}: ${code}`);
    return res.status(200).json({ success: true, dev_code: code });
  }

  // MeliPayamak expects 09XXXXXXXXX format for both to and username
  const mpPhone    = '0' + normalizedPhone.replace(/^98/, '');
  const mpUsername = MP_USERNAME.startsWith('98') ? '0' + MP_USERNAME.slice(2) : MP_USERNAME;

  const mpBody = {
    username: mpUsername,
    password: MP_PASSWORD,
    to:       mpPhone,
    from:     MP_FROM,
    text:     `کد تایید بیا بریم: ${code}`,
    isflash:  false
  };
  console.log('[MP] sending:', JSON.stringify(mpBody));

  const mpRes  = await fetch('https://rest.payamak-panel.com/api/SendSMS/SendSMS', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mpBody)
  });

  const mpData = await mpRes.json();
  console.log('[MP] response:', JSON.stringify(mpData));
  if (mpData.RetStatus !== 1)
    return res.status(500).json({ error: 'خطا در ارسال پیامک', detail: mpData });

  return res.status(200).json({ success: true });
};
