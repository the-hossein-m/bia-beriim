const SUPABASE_URL = 'https://hplromejpkrrdaigmzkf.supabase.co';
const SMS_SENDER = '+18018949161';

function supabaseHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };
}

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7978787976:AAGs17IM3YSaTU9FHFgC6hU2uwT_TvFKgUA';

async function sendTelegram(chatId, text) {
  const res = await fetch(
    `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    }
  );
  return res.json();
}

async function sendSMS(phone, message) {
  const res = await fetch(
    `https://api.kavenegar.com/v1/${process.env.KAVENEGAR_API_KEY}/sms/send.json`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ receptor: phone, sender: SMS_SENDER, message }).toString()
    }
  );
  return res.json();
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
    `<b>${sender.to_name}</b> جواب داد! 🎉`,
    `📍 قرار: ${vibe || '—'}`,
    `✨ حال‌وهوا: ${mood || '—'}`,
    proposed_date ? `📅 تاریخ: ${proposed_date}` : null,
    proposed_time ? `🕐 وقت: ${proposed_time}` : null,
    ``,
    `اگه بیا بریم به کارت اومد، یه چایی برامون بخر ☕`,
    `https://daramet.com/bia_beriim?webintent&donate=50000`
  ].filter(l => l !== null);

  const richMessage  = lines.join('\n');
  const plainMessage = lines.map(l => l.replace(/<[^>]+>/g, '')).join('\n');

  // Try Telegram first, fall back to SMS
  if (sender.telegram_chat_id) {
    const tgRes = await sendTelegram(sender.telegram_chat_id, richMessage);
    if (tgRes.ok) return res.status(200).json({ success: true, channel: 'telegram' });
    console.error('Telegram send failed:', tgRes);
  }

  if (sender.phone) {
    const kavData = await sendSMS(sender.phone, plainMessage);
    if (kavData.return?.status === 200)
      return res.status(200).json({ success: true, channel: 'sms' });
    return res.status(500).json({ error: 'خطا در ارسال', detail: kavData.return });
  }

  return res.status(500).json({ error: 'No delivery channel available' });
};
