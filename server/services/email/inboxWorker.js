import { isInboxSyncEnabled } from './userEmailConnections.js';
import { syncAllInboxes } from './inboxSync.js';

let timer = null;
let tickInFlight = false;

async function tick() {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    const result = await syncAllInboxes();
    if (result.inserted > 0) {
      console.log(`[InboxWorker] Pulled ${result.inserted} new repl${result.inserted === 1 ? 'y' : 'ies'} from ${result.users} mailbox(es)`);
    }
  } catch (err) {
    console.error('[InboxWorker] Tick error:', err.message);
  } finally {
    tickInFlight = false;
  }
}

export function startInboxWorker({ intervalMs = Number(process.env.EMAIL_INBOX_SYNC_INTERVAL_MS) || 300000 } = {}) {
  if (timer || !isInboxSyncEnabled()) return false;
  timer = setInterval(tick, intervalMs);
  setTimeout(tick, 20000);
  return true;
}

export function stopInboxWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
