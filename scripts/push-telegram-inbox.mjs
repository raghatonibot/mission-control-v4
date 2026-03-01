import 'dotenv/config';

const url = process.env.MC_INBOX_URL || 'http://127.0.0.1:3004/api/inbox/telegram';
const token = process.env.INBOX_TOKEN;
const chatId = process.env.TELEGRAM_NOTIFY_TARGET || 'telegram:5273431160';

const text = process.argv.slice(2).join(' ').trim();
if (!token) {
  console.error('INBOX_TOKEN not set');
  process.exit(2);
}
if (!text) {
  console.error('Usage: node push-telegram-inbox.mjs <text...>');
  process.exit(2);
}

const body = {
  chatId,
  messageId: String(Date.now()),
  text,
};

const resp = await fetch(url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-inbox-token': token,
  },
  body: JSON.stringify(body),
});

const out = await resp.text();
if (!resp.ok) {
  console.error('HTTP', resp.status, out);
  process.exit(1);
}

console.log(out);
