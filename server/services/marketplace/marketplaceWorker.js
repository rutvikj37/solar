import { processExpiredBiddingWindows } from './bidClose.js';

let timer = null;

async function tick() {
  try {
    const results = await processExpiredBiddingWindows();
    if (results.length) {
      console.log(`[Marketplace] Processed ${results.length} expired bidding window(s)`);
    }
  } catch (err) {
    console.error('[Marketplace] Worker tick failed:', err.message);
  }
}

export function startMarketplaceWorker({ intervalMs = 30000 } = {}) {
  if (timer) return;
  console.log(`[Marketplace] Starting bidding worker (every ${intervalMs}ms)`);
  timer = setInterval(tick, intervalMs);
  // Run once shortly after boot
  setTimeout(tick, 5000).unref?.();
}

export function stopMarketplaceWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
