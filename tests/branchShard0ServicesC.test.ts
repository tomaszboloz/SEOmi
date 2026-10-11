import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { DiagnosisVerdict } from '@/services/topicalDiagnosis';
import { cruxCategory } from '@/components/Performance/cruxEvidence';
import { pickerSort, useDismiss } from '@/components/DataForSEO/pickers/pickerPrimitives';
import { shortPath, verdictText } from '@/components/Charts/crawlArchitecture/topicalDiagnosis/verdictText';
import i18n, { setLanguageDirection } from '@/i18n';

describe('branch shard 0 services', () => {
  it('leaves a CrUX metric without a name unrated', () => {
    expect(cruxCategory({ percentiles: { p75: 100 } } as never, (key: string) => key)).toBe('pageSpeedUi.crux.unrated');
  });

  describe('pickerPrimitives', () => {
    it('ranks an exact match on the right side first', () => {
      expect(pickerSort('beta', ['alpha'], ['beta'])).toBeGreaterThan(0);
      expect(pickerSort('beta', ['beta'], ['alpha'])).toBeLessThan(0);
    });
    describe('useDismiss', () => {
      afterEach(() => { document.body.innerHTML = ''; });
      it('ignores pointer presses inside the root but closes for outside presses', () => {
        const root = document.createElement('div');
        const inside = document.createElement('button');
        root.appendChild(inside);
        document.body.appendChild(root);
        const outside = document.createElement('p');
        document.body.appendChild(outside);
        const close = vi.fn();
        renderHook(() => useDismiss(true, close, { current: root }));
        inside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(close).not.toHaveBeenCalled();
        outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(close).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('verdictText helpers', () => {
    it('handles evidence entries without params and non-http urls', () => {
      const verdict = { code: 'document-isolated', severity: 'warning', scope: 'document', confidence: 'limited', evidence: [{ key: 'x' }] } as unknown as DiagnosisVerdict;
      const copy = verdictText((key) => key, verdict);
      expect(copy.scope).toBe('topicalDiagnosis.scope.document');
      const nearest = { ...verdict, evidence: [{ key: 'nearest', params: { url: '/a' } }] } as unknown as DiagnosisVerdict;
      expect(verdictText((key) => key, verdict).action).toBe('topicalDiagnosis.verdict.document-isolated.actionNoNearest');
      expect(verdictText((key) => key, nearest).action).toBe('topicalDiagnosis.verdict.document-isolated.action');
      expect(shortPath('foo://host')).toBe('/');
      expect(shortPath('not a url')).toBe('not a url');
    });
  });

  describe('i18n language switching', () => {
    beforeEach(() => { localStorage.clear(); });
    afterEach(async () => { await i18n.changeLanguage('en'); document.documentElement.dir = 'ltr'; });
    it('keeps the current language when changeLanguage is called without one', async () => {
      await i18n.changeLanguage();
      expect(i18n.language).toBe('en');
    });
    it('defaults the direction to ltr for an unknown language code', async () => {
      await setLanguageDirection('zz');
      expect(document.documentElement.dir).toBe('ltr');
      expect(document.documentElement.lang).toBe('zz');
    });
  });
});
