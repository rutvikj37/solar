import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBiddingWindow,
  DEFAULT_BID_WINDOW_HOURS,
  DEFAULT_MIN_BID,
  resolveBidWindowSettings,
} from '../services/marketplace/bidWindow.js';

test('resolveBidWindowSettings uses admin values when valid', () => {
  assert.deepEqual(
    resolveBidWindowSettings({ default_bid_window_hours: 72, default_min_bid: 40 }),
    { windowHours: 72, minBid: 40 },
  );
});

test('resolveBidWindowSettings falls back to 48h and $25 defaults', () => {
  assert.deepEqual(resolveBidWindowSettings({}), {
    windowHours: DEFAULT_BID_WINDOW_HOURS,
    minBid: DEFAULT_MIN_BID,
  });
  assert.deepEqual(resolveBidWindowSettings({ default_bid_window_hours: 0 }), {
    windowHours: DEFAULT_BID_WINDOW_HOURS,
    minBid: DEFAULT_MIN_BID,
  });
});

test('computeBiddingWindow applies window hours from settings', () => {
  const now = new Date('2026-08-22T12:00:00.000Z');
  const { opens, closes, windowHours, minBid } = computeBiddingWindow(
    { default_bid_window_hours: 48, default_min_bid: 30 },
    now,
  );
  assert.equal(windowHours, 48);
  assert.equal(minBid, 30);
  assert.equal(opens.toISOString(), now.toISOString());
  assert.equal(closes.toISOString(), '2026-08-24T12:00:00.000Z');
});
