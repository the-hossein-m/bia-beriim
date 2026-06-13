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
  if (req.method !== 'POST') return res.status(200).end(); // Telegram retries on non-200

  // Parse body if not already parsed
  let update = req.body;
  if (typeof update === 'string') {
    try { update = JSON.parse(update); } catch { return res.status(200).end(); }
  }
  if (!update) return res.status(200).end();

  const message = update?.message;

  // Log all incoming updates for debugging
  console.log('TG update:', JSON.stringify(update).slice(0, 300));

  // Only handle /start commands
  if (!message?.text?.startsWith('/start')) return res.status(200).end();

  try {

  const chatId = String(message.chat.id);
  const parts = message.text.split(' ');
  const token = parts[1];

  if (!token) {
    await sendMessage(chatId, '👋 سلام! برای استفاده از ربات، لینک دعوت رو از bia-beriim.vercel.app بساز.');
    return res.status(200).end();
  }

  // Find pending session
  const sessionRes = await fetch(
    `${SUPABASE_URL}/rest/v1/telegram_sessions?token=eq.${token}&status=eq.pending&limit=1`,
    { headers: supabaseHeaders() }
  );
  const sessions = await sessionRes.json();

  if (!sessions.length) {
    await sendMessage(chatId, '❌ لینک نامعتبر یا منقضی شده. دوباره از سایت لینک بگیر.');
    return res.status(200).end();
  }

  const session = sessions[0];

  // Check expiry
  if (new Date(session.expires_at) < new Date()) {
    await sendMessage(chatId, '⏰ لینک منقضی شده. دوباره از سایت لینک بگیر.');
    return res.status(200).end();
  }

  // Create sender record
  const senderRes = await fetch(`${SUPABASE_URL}/rest/v1/senders`, {
    method: 'POST',
    headers: { ...supabaseHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify({
      from_name: session.from_name,
      to_name: session.to_name,
      telegram_chat_id: chatId,
      verified: true
    })
  });
  const senders = await senderRes.json();
  const sender = senders[0];

  // Mark session verified
  await fetch(`${SUPABASE_URL}/rest/v1/telegram_sessions?token=eq.${token}`, {
    method: 'PATCH',
    headers: supabaseHeaders(),
    body: JSON.stringify({ status: 'verified', chat_id: chatId, sender_id: sender.id })
  });

  // Confirm to user
  await sendMessage(
    chatId,
    `✅ <b>تأیید شد!</b>\n\n${session.from_name} عزیز، منتظر جواب <b>${session.to_name}</b> باش 💘\n\nوقتی فرم رو پر کنه، اینجا بهت خبر می‌دم!`
  );

    return res.status(200).end();
  } catch (err) {
    console.error('Webhook error:', err.message, err.stack);
    return res.status(200).end(); // Always 200 so Telegram doesn't retry
  }
};
