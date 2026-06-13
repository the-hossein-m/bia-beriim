const SUPABASE_URL = 'https://hplromejpkrrdaigmzkf.supabase.co';
const SENDER = '0018018949161';

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

  const { sender_id, vibe, mood, proposed_date, proposed_time } = req.body;
  if (!sender_id) return res.status(400).json({ error: 'اطلاعات ناقص است' });

  // Get sender
  const senderRes = await fetch(
    `${SUPABASE_URL}/rest/v1/senders?id=eq.${sender_id}&limit=1`,
    { headers: supabaseHeaders() }
  );
  const senders = await senderRes.json();
  if (!senders.length) return res.status(404).json({ error: 'فرستنده یافت نشد' });

  const sender = senders[0];

  // Compose message
  const lines = [
    `${sender.to_name} جواب داد! 🎉`,
    `قرار: ${vibe || '—'}`,
    `حال‌وهوا: ${mood || '—'}`,
    proposed_date ? `تاریخ: ${proposed_date}` : null,
    proposed_time ? `وقت: ${proposed_time}` : null
  ].filter(Boolean);

  const message = lines.join('\n');

  // Send SMS
  const kavRes = await fetch(
    `https://api.kavenegar.com/v1/${process.env.KAVENEGAR_API_KEY}/sms/send.json`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        receptor: sender.phone,
        sender: SENDER,
        message
      }).toString()
    }
  );

  const kavData = await kavRes.json();
  if (kavData.return?.status !== 200)
    return res.status(500).json({ error: 'خطا در ارسال پیامک', detail: kavData.return });

  return res.status(200).json({ success: true });
};
