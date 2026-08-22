import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { maskLeadContactForPublic } from '../utils/leadAccess.js';

describe('maskLeadContactForPublic', () => {
  it('masks phone and email on public proposal views', () => {
    const masked = maskLeadContactForPublic({
      id: 1,
      owner_name: 'Jane',
      phone: '5551234567',
      email: 'jane@example.com',
      address: '123 Main',
    });
    assert.match(masked.phone, /\*\*\*-\*\*\*-4567/);
    assert.equal(masked.email, 'j***@example.com');
    assert.equal(masked.address, '123 Main');
  });
});
