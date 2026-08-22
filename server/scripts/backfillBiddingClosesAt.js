/**
 * Backfill missing bidding_opens_at / bidding_closes_at for open marketplace leads.
 * Run: node server/scripts/backfillBiddingClosesAt.js
 */
import db from '../db.js';
import { ensureLeadsBiddingTimes } from '../services/marketplace/bidWindow.js';

async function main() {
  const [rows] = await db.query(
    `SELECT * FROM marketplace_leads
     WHERE status IN ('bidding', 'no_bid_expanding')
       AND (bidding_closes_at IS NULL OR bidding_opens_at IS NULL)`,
  );

  if (!rows.length) {
    console.log('No open bidding leads need backfill.');
    process.exit(0);
  }

  await ensureLeadsBiddingTimes(rows);
  console.log(`Backfilled bidding window timestamps for ${rows.length} lead(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
