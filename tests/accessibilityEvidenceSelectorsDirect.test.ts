import { describe, expect, it } from 'vitest';
import { accessibilityEvidenceLabelKey, accessibilitySelectorForCode } from '@/components/Results/overview/overviewTypes';

const elements = `<html><body><main></main><div role="main"></div><img id="photo"><img alt="named">
  <button>OK</button><a href="/">Link</a><input><input type="hidden"><select></select><textarea></textarea>
  <div tabindex="0"></div><p aria-labelledby="missing"></p><div role="switch"></div></body></html>`;

describe('public accessibility evidence selectors', () => {
  it.each([
    ['accessibility-interactive-name-missing', 'accessibility.interactiveElement', ['BUTTON', 'A']],
    ['accessibility-focusable-aria-hidden', 'accessibility.focusableAriaHidden', ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'DIV', 'DIV']],
    ['accessibility-image-alt-missing', 'accessibility.image', ['IMG']],
    ['accessibility-duplicate-id', 'accessibility.duplicateId', ['IMG']],
    ['accessibility-aria-reference-unresolved', 'accessibility.ariaReference', ['P']],
    ['accessibility-document-language-invalid', 'accessibility.htmlLanguageElement', ['HTML']],
    ['accessibility-multiple-main-landmarks', 'accessibility.mainLandmark', ['MAIN', 'DIV']],
    ['accessibility-form-controls-unlabeled', 'accessibility.formControl', ['INPUT', 'INPUT', 'SELECT', 'TEXTAREA']],
    ['accessibility-antispam-control-not-text', 'accessibility.formControl', ['INPUT', 'INPUT', 'SELECT', 'TEXTAREA']],
    ['unrecognized', 'accessibility.formControl', ['INPUT', 'INPUT', 'SELECT', 'TEXTAREA']],
  ])('maps %s to concrete evidence elements', (code, label, expected) => {
    const document = new DOMParser().parseFromString(elements, 'text/html');
    expect([...document.querySelectorAll(accessibilitySelectorForCode(code))].map((element) => element.tagName)).toEqual(expected);
    expect(accessibilityEvidenceLabelKey(code)).toBe(label);
  });
  it('keeps absent legacy codes usable with the form-control fallback', () => {
    expect(accessibilitySelectorForCode()).toBe('input, select, textarea');
    expect(accessibilityEvidenceLabelKey()).toBe('accessibility.formControl');
  });
});
