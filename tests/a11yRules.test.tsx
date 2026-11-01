import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { a11yViolations } from './helpers/a11yRules';

describe('a11yViolations', () => {
  it('passes accessible markup', () => {
    const { container } = render(<div><label htmlFor="a">Name</label><input id="a" /><button aria-label="Go">x</button><label><input type="checkbox" />Opt</label><img alt="" src="x.png" /><span id="t">T</span><section aria-labelledby="t"><ul><li>1</li></ul></section><a href="/x">Link</a></div>);
    expect(a11yViolations(container)).toEqual([]);
  });
  it('reports each violation kind', () => {
    const { container } = render(<div><button /><img src="x.png" /><span id="d" /><span id="d" /><section aria-labelledby="nope"><ul><div /></ul></section><section aria-label="  " /><input aria-label="named" /></div>);
    expect(a11yViolations(container)).toContain('no accessible name: button');
    expect(a11yViolations(container)).toContain('img without alt');
    expect(a11yViolations(container)).toContain('duplicate id: d');
    expect(a11yViolations(container)).toContain('aria-labelledby target missing: nope');
    expect(a11yViolations(container)).toContain('list with non-li child');
  });
  it('resolves aria-labelledby names', () => {
    const { container } = render(<div><span id="n">Name</span><button aria-labelledby="n" /></div>);
    expect(a11yViolations(container)).toEqual([]);
  });
});
