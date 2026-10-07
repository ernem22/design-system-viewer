import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import type { DesignSystem } from '../systems/store.ts';
import { download, systemToCss } from './export.ts';

describe('download', () => {
  beforeEach(() => {
    const window = new Window();
    vi.stubGlobal('window', window);
    vi.stubGlobal('document', window.document);
    vi.stubGlobal('Blob', window.Blob);
    vi.stubGlobal('HTMLAnchorElement', window.HTMLAnchorElement);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('appends the anchor to the body before clicking and removes it after', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    
    // Firefox requires the anchor to be in the DOM to trigger a download.
    let wasInDomDuringClick = false;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      wasInDomDuringClick = document.body.contains(this);
    });

    download('test.txt', 'hello', 'text/plain');

    expect(appendSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(wasInDomDuringClick).toBe(true);
    expect(removeSpy).toHaveBeenCalled();
    
    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(document.body.contains(anchor)).toBe(false);
    expect(anchor.download).toBe('test.txt');
    expect(anchor.href).toBe('blob:mock');
  });
});

// Issue #277: dark mode is retired — the CSS export carries the base (light)
// values only, even when the system stores a `themes.dark` block. A stored
// dark block is never emitted.
const darkSystem = {
  slug: 'wire-dark',
  name: 'Wire dark',
  css: ':root { --color-bg: #ffffff; --color-text: #111111; }',
  groups: [
    {
      id: 'color',
      label: 'Color',
      kind: 'color',
      tokens: [
        { name: '--color-bg', value: '#ffffff' },
        { name: '--color-text', value: '#111111' },
      ],
    },
  ],
  themes: { dark: [{ name: '--color-bg', value: '#0a0a0f' }] },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as unknown as DesignSystem;

describe('systemToCss base values (#277)', () => {
  it('emits :root only, never a [data-theme="dark"] block', () => {
    const css = systemToCss(darkSystem);
    expect(css).toContain(':root {');
    expect(css).toContain('--color-bg: #ffffff;');
    expect(css).not.toContain('[data-theme="dark"]');
    expect(css).not.toContain('--color-bg: #0a0a0f;');
  });

  it('omits the dark block for a system that ships no dark variant', () => {
    const lightOnly = { ...darkSystem, themes: undefined } as unknown as DesignSystem;
    expect(systemToCss(lightOnly)).not.toContain('data-theme');
  });
});

// Issue #125: `source` is additive metadata on the model. The JSON export is
// `JSON.stringify(system)`, so it must ride along unchanged, while the CSS
// export stays CSS and never leaks the field.
describe('source provenance round-trip', () => {
  const source = { kind: 'file', filename: 'wire.css', importedAt: '2026-09-30T00:00:00.000Z' };

  it('survives a JSON export and reparse', () => {
    const withSource = { ...darkSystem, source } as unknown as DesignSystem;
    const back = JSON.parse(JSON.stringify(withSource)) as DesignSystem;
    expect(back.source).toEqual(source);
  });

  it('never leaks into the CSS export', () => {
    const withSource = { ...darkSystem, source } as unknown as DesignSystem;
    const css = systemToCss(withSource);
    expect(css).not.toContain('importedAt');
    expect(css).not.toContain('wire.css');
  });
});
