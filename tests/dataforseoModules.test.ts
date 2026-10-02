import { describe, it, expect } from 'vitest';
import { DataForSEOClient } from '../src/services/dataforseo';
import { asRecord, nullableNumber, text, intent } from '../src/services/dataforseo/dataforseoHelpers';
import { resolveDataForSeoMarket } from '../src/services/dataforseo/dataforseoMarkets';

describe('DataForSEO Modules', () => {
  describe('Facade', () => {
    it('should initialize DataForSEOClient', () => {
      const client = new DataForSEOClient('user', 'pass');
      expect(client).toBeInstanceOf(DataForSEOClient);
      expect(typeof client.getBacklinksSummary).toBe('function');
      expect(typeof client.getKeywordIdeas).toBe('function');
    });
  });

  describe('Helpers', () => {
    it('asRecord returns an object', () => {
      expect(asRecord({ a: 1 })).toEqual({ a: 1 });
      expect(asRecord(null)).toEqual({});
      expect(asRecord('string')).toEqual({});
    });

    it('nullableNumber returns valid numbers or null', () => {
      expect(nullableNumber('123')).toBe(123);
      expect(nullableNumber('')).toBeNull();
      expect(nullableNumber(null)).toBeNull();
      expect(nullableNumber('abc')).toBeNull();
    });

    it('text returns string', () => {
      expect(text('abc')).toBe('abc');
      expect(text(123)).toBe('');
      expect(text(null)).toBe('');
    });

    it('intent identifies search intent correctly', () => {
      expect(intent('transactional')).toBe('Transactional');
      expect(intent('informational query')).toBe('Informational');
      expect(intent('buy product commercial')).toBe('Commercial');
      expect(intent('other')).toBe('Navigational');
    });
  });

  describe('Markets', () => {
    it('resolves market by country code or legacy names', () => {
      const usMarket = resolveDataForSeoMarket('US');
      expect(usMarket?.code).toBe('US');

      const legacyMarket = resolveDataForSeoMarket('united kingdom');
      expect(legacyMarket?.code).toBe('GB');
    });
  });
});
