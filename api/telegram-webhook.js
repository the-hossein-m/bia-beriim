const SUPABASE_URL = 'https://hplromejpkrrdaigmzkf.supabase.co';

function supabaseHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };
}

async function sendMessage(chatId, text) {
  return fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });
}

module.exports = async (req, res) => {
  // Always return 200 so Telegram doesn't retry
  res.status(200).end();

  if (req.method !== 'POST') return;

  let update = req.body;
  if (typeof update === 'string') {
    try { update = JSON.parse(update); } catch { return; }
  }
  if (!update) return;

  const message = update?.message;
  if (!message?.text) return;

  const chatId = String(message.chat.id);
  const text   = message.text.trim().toUpperCase();

  // Handle /start — greet user and ask for code
  if (text === '/START' || text.startsWith('/START ')) {
    await sendMessage(chatId,
      '👋 سلام!\n\nبرای اتصال، کد ۴ رقمی که روی سایت نشون داده شده رو اینجا بفرست.\n\nمثلاً: <code>BIA-4829</code>'
    );
    return;
  }

  // Check if message matches a pending short code
  if (!text.startsWith('BIA-')) return;

  try {
    const sessionRes = await fetch(
      `${SUPABASE_URL}/rest/v1/telegram_sessions?short_code=eq.${text}&status=eq.pending&limit=1`,
      { headers: supabaseHeaders() }
    );
    const sessions = await sessionRes.json();

    if (!sessions.length) {
      await sendMessage(chatId, '❌ کد نامعتبر یا منقضی شده. دوباره از سایت کد بگیر.');
      return;
    }

    const session = sessions[0];

    if (new Date(session.expires_at) < new Date()) {
      await sendMessage(chatId, '⏰ کد منقضی شده. دوباره از سایت کد بگیر.');
      return;
    }

    // Create sender record
    const senderRes = await fetch(`${SUPABASE_URL}/rest/v1/senders`, {
      method: 'POST',
      headers: { ...supabaseHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({
        from_name: session.from_name,
        to_name:   session.to_name,
        telegram_chat_id: chatId,
        verified: true
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

    await sendMessage(chatId,
      `✅ <b>متصل شدی!</b>\n\n${session.from_name} عزیز، منتظر جواب <b>${session.to_name}</b> باش 💘\n\nوقتی فرم رو پر کنه، اینجا بهت خبر می‌دم!`
    );

  } catch (err) {
    console.error('Webhook error:', err.message);
    await sendMessage(chatId, '⚠️ یه خطایی پیش اومد. دوباره امتحان کن.');
  }
};
