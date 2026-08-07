/**
 * Background drip worker — processes due enrollments every ~60s.
 */
import { processDueEnrollments } from './dripEngine.js';

let dripTimer = null;
let tickInFlight = false;

async function dripTick() {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    const result = await processDueEnrollments();
    if (result.processedCount > 0) {
      console.log(`[DripWorker] Processed ${result.processedCount} due enrollment(s)`);
    }
  } catch (err) {
    console.error('[DripWorker] Tick error:', err.message);
  } finally {
    tickInFlight = false;
  }
}

export function startDripWorker({ intervalMs = 60000 } = {}) {
  if (dripTimer) return;
  console.log(`[DripWorker] Starting drip worker (every ${intervalMs}ms)`);
  dripTimer = setInterval(dripTick, intervalMs);
  setTimeout(dripTick, 5000);
}

export function stopDripWorker() {
  if (dripTimer) {
    clearInterval(dripTimer);
    dripTimer = null;
  }
}

export async function runDripOnce(userId = null) {
  return processDueEnrollments({ userId });
}
