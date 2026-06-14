const SUPABASE_URL = 'https://hplromejpkrrdaigmzkf.supabase.co';
// anon key is public — safe to hardcode as fallback
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbHJvbWVqcGtycmRhaWdtemtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMTUzODIsImV4cCI6MjA5Njg5MTM4Mn0.guKWuD3x3c595ZApqMMB_Zu-vQbxAArDGo86GO41YEQ';

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY || ANON_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json'
  };
}

const crypto = require('crypto');
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7978787976:AAGs17IM3YSaTU9FHFgC6hU2uwT_TvFKgUA';

function generateInviteToken() {
  return crypto.randomBytes(5).toString('hex'); // 10-char hex, e.g. "a3f9c12b7e"
}

async function sendMessage(chatId, text) {
  return fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).end();

  let update = req.body;
  if (typeof update === 'string') {
    try { update = JSON.parse(update); } catch { return res.status(200).end(); }
  }
  if (!update) return res.status(200).end();

  const message = update?.message;
  if (!message?.text) return res.status(200).end();

  const chatId = String(message.chat.id);
  const text   = message.text.trim().toUpperCase();

  // Handle /start — greet user and ask for code
  if (text === '/START' || text.startsWith('/START ')) {
    await sendMessage(chatId,
      `💘 <b>خوش اومدی به بیا بریم!</b>\n\n` +
      `این ربات بهت کمک می‌کنه که از کسی که دوستش داری دعوت کنی — و وقتی جواب داد، مستقیم اینجا بهت خبر می‌دم.\n\n` +
      `<b>چطور استفاده کنم؟</b>\n` +
      `۱. برو به سایت: bia-beriim.vercel.app\n` +
      `۲. اسم خودت و اون کسی که می‌خوای دعوتش کنی رو وارد کن\n` +
      `۳. تلگرام رو انتخاب کن — یه کد بهت نشون می‌ده\n` +
      `۴. اون کد رو اینجا برای من بفرست\n` +
      `۵. لینک دعوتت آماده‌ست — بفرستش!\n\n` +
      `وقتی اون کسی فرم رو پر کنه، اینجا بهت پیام می‌دم 🎉`
    );
    return res.status(200).end();
  }

  // Check if message matches a pending short code
  if (!text.startsWith('BIA-')) return res.status(200).end();

  try {
    console.log(`[webhook] looking up short_code=${text} chat_id=${chatId}`);
    const sessionRes = await fetch(
      `${SUPABASE_URL}/rest/v1/telegram_sessions?short_code=eq.${text}&status=eq.pending&limit=1`,
      { headers: supabaseHeaders() }
    );
    const sessions = await sessionRes.json();
    console.log(`[webhook] session lookup result:`, JSON.stringify(sessions).slice(0, 200));

    if (!sessions.length) {
      await sendMessage(chatId, '❌ کد نامعتبر یا منقضی شده. دوباره از سایت کد بگیر.');
      return;
    }

    const session = sessions[0];

    if (new Date(session.expires_at) < new Date()) {
      await sendMessage(chatId, '⏰ کد منقضی شده. دوباره از سایت کد بگیر.');
      return;
    }

    // Create sender record with invite token
    const inviteToken = generateInviteToken();
    const senderRes = await fetch(`${SUPABASE_URL}/rest/v1/senders`, {
      method: 'POST',
      headers: { ...supabaseHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({
        from_name:        session.from_name,
        to_name:          session.to_name,
        telegram_chat_id: chatId,
        verified:         true,
        invite_token:     inviteToken
      })
    });
    const senders = await senderRes.json();
    const sender  = senders[0];

    // Mark session verified
    await fetch(`${SUPABASE_URL}/rest/v1/telegram_sessions?short_code=eq.${text}`, {
      method: 'PATCH',
      headers: supabaseHeaders(),
      body: JSON.stringify({ status: 'verified', chat_id: chatId, sender_id: sender.id })
    });

    const inviteUrl = `https://bia-beriim.vercel.app/i/${inviteToken}`;
    await sendMessage(chatId,
      `✅ <b>متصل شدی!</b>\n\n` +
      `${session.from_name} عزیز، لینک دعوت آماده‌ست 👇\n\n` +
      `<code>${inviteUrl}</code>\n\n` +
      `این رو برای <b>${session.to_name}</b> بفرست — وقتی جواب داد اینجا بهت خبر می‌دم 💘`
    );

    return res.status(200).end();

  } catch (err) {
    console.error('Webhook error:', err.message, err.stack);
    await sendMessage(chatId, '⚠️ یه خطایی پیش اومد. دوباره امتحان کن.').catch(() => {});
    return res.status(200).end();
  }
};
