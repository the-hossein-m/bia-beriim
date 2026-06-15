const SUPABASE_URL = 'https://hplromejpkrrdaigmzkf.supabase.co';
// MeliPayamak new console API (console.melipayamak.com) — auth via API key, not username/password.
const MP_APIKEY = process.env.MELIPAYAMAK_APIKEY || '7aa0f507d2db469ca18a1565b4c3e9e1';

function normalizePhone(phone) {
  return phone.replace(/\D/g, '').replace(/^0/, '98');
}

function generateOTP() {
  // 5 digits, to match MeliPayamak's OTP code length
  return Math.floor(10000 + Math.random() * 90000).toString();
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

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  // Delete old OTPs for this phone
  await fetch(`${SUPABASE_URL}/rest/v1/otp_sessions?phone=eq.${normalizedPhone}&used=eq.false`, {
    method: 'DELETE',
    headers: supabaseHeaders()
  });

  // Vercel always sets NODE_ENV=production, so gate dev mode on VERCEL_ENV instead.
  // 'production' = main deployment (send real SMS); preview/local = return code on-screen.
  const isDev = process.env.VERCEL_ENV !== 'production';

  // Determine the code:
  //  - dev/preview: generate locally and return it on-screen (no SMS)
  //  - production:  MeliPayamak's OTP service generates the code, sends it, and returns it
  let code;

  if (isDev) {
    code = generateOTP();
    console.log(`[DEV] OTP for ${normalizedPhone}: ${code}`);
  } else {
    const mpPhone = '0' + normalizedPhone.replace(/^98/, ''); // recipient as 09XXXXXXXXX
    console.log('[MP] otp to=' + mpPhone);

    const mpRes = await fetch(`https://console.melipayamak.com/api/send/otp/${MP_APIKEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: mpPhone })
    });

    const mpRaw = await mpRes.text();
    console.log('[MP] status=' + mpRes.status + ' body=' + mpRaw);

    let mpData;
    try { mpData = JSON.parse(mpRaw); }
    catch (e) { return res.status(500).json({ error: 'خطا در ارسال پیامک', raw: mpRaw }); }

    // Success: OTP service returns the generated code and status 'عملیات موفق'
    if (!mpData.code)
      return res.status(500).json({ error: 'خطا در ارسال پیامک', detail: mpData });

    code = String(mpData.code);
  }

  // Store the code (the one we'll verify against in verify-otp.js)
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

  if (isDev)
    return res.status(200).json({ success: true, dev_code: code });

  return res.status(200).json({ success: true });
};
