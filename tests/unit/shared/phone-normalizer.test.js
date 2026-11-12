import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeWhatsAppNumber,
  extractWhatsAppDigits,
} from '../../../src/shared/utils/phone-normalizer.js';

describe('phone-normalizer', () => {
  it('normalizes local 08, +62, 620, 0062, and 8-prefixed numbers into JIDs', () => {
    assert.equal(normalizeWhatsAppNumber('0812-3456-7890'), '6281234567890@s.whatsapp.net');
    assert.equal(normalizeWhatsAppNumber('+62 812 3456 7890'), '6281234567890@s.whatsapp.net');
    assert.equal(normalizeWhatsAppNumber('62081234567890'), '6281234567890@s.whatsapp.net');
    assert.equal(normalizeWhatsAppNumber('006281234567890'), '6281234567890@s.whatsapp.net');
    assert.equal(normalizeWhatsAppNumber('81234567890'), '6281234567890@s.whatsapp.net');
  });

  it('uses the first valid segment when multiple numbers are separated by /, comma, or semicolon', () => {
    assert.equal(
      normalizeWhatsAppNumber('0811111111 / 0822222222'),
      '62811111111@s.whatsapp.net'
    );
    assert.equal(
      normalizeWhatsAppNumber('n/a ; 085712345678'),
      '6285712345678@s.whatsapp.net'
    );
    assert.equal(
      normalizeWhatsAppNumber('0812999888, 0813777666'),
      '62812999888@s.whatsapp.net'
    );
  });

  it('returns empty string for empty or too-short inputs and strips non-digits cleanly', () => {
    assert.equal(normalizeWhatsAppNumber(''), '');
    assert.equal(normalizeWhatsAppNumber(null), '');
    assert.equal(normalizeWhatsAppNumber('12345'), '');
    assert.equal(extractWhatsAppDigits('+62 812-3456-7890'), '6281234567890');
    assert.equal(extractWhatsAppDigits('abc'), '');
  });
});

