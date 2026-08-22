#!/usr/bin/env node
/**
 * One-off purge of seeded marketplace demo leads (and related bids/disputes).
 *
 * Usage: node scripts/clearMarketplaceDemos.js
 *    or: npm run marketplace:clear-demos
 */
import { clearMarketplaceDemos } from '../services/marketplace/seedDemo.js';

try {
  const summary = await clearMarketplaceDemos();
  console.log('[Marketplace] Demo purge complete:', summary);
  process.exit(0);
} catch (err) {
  console.error('[Marketplace] Demo purge failed:', err);
  process.exit(1);
}
