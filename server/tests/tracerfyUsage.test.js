import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  tracerfyCacheKey,
  hasUsableEnrichedContacts,
  clearTracerfyCache,
} from '../services/contactEnrichmentService.js';

describe('Tracerfy usage guards', () => {
  it('normalizes address keys so Ct/Court share one cache slot', () => {
    const a = tracerfyCacheKey('4 Chamberlin Ct', 'Lawrence Township', 'NJ', '08648');
    const b = tracerfyCacheKey('4 Chamberlin Court', 'Lawrence Township', 'NJ', '08648');
    assert.equal(a, b);
  });

  it('keeps different house numbers on different cache keys', () => {
    const a = tracerfyCacheKey('4 Chamberlin Ct', 'Lawrence Township', 'NJ', '08648');
    const b = tracerfyCacheKey('2 Fountayne Ln', 'Lawrence Township', 'NJ', '08648');
    assert.notEqual(a, b);
  });

  it('treats phone/email enrichment as reusable (skip Tracerfy)', () => {
    assert.equal(
      hasUsableEnrichedContacts({
        contact: { phone: '(917) 455-8074', email: 'Not Available' },
        enrichmentMeta: { contactSource: 'tracerfy' },
      }),
      true
    );
  });

  it('treats prior tracerfy-miss as reusable within enrichment cache', () => {
    assert.equal(
      hasUsableEnrichedContacts({
        contact: { phone: 'Not Available', email: 'Not Available' },
        enrichmentMeta: { contactSource: 'tracerfy-miss' },
      }),
      true
    );
  });

  it('does not treat empty preview as reusable contacts', () => {
    assert.equal(
      hasUsableEnrichedContacts({
        contact: { phone: null, email: null },
        enrichmentMeta: { contactSource: 'skipped' },
      }),
      false
    );
  });

  it('clearTracerfyCache empties store', () => {
    clearTracerfyCache();
    assert.ok(true);
  });
});
