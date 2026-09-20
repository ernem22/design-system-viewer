import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import { parseThemes } from '../../../src/core/parse.js';
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

// Issue #110: the viewer displays a system's dark variant, but the CSS export
// emitted `:root` only — the exported file could not reproduce what the viewer
// showed. The dark tokens now ride in a `[data-theme="dark"]` block, which is
// the same selector shape parse.js reads back (`DARK_SEL`), so the export
// round-trips through the import path instead of being light-only.
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

describe('systemToCss dark variant', () => {
  it('emits a [data-theme="dark"] block carrying every dark token', () => {
    const css = systemToCss(darkSystem);
    expect(css).toContain(':root {');
    expect(css).toContain('--color-bg: #ffffff;');
    expect(css).toContain('[data-theme="dark"] {');
    expect(css).toContain('--color-bg: #0a0a0f;');
  });

  it('round-trips back through parseThemes as the system dark set', () => {
    const { dark } = parseThemes(systemToCss(darkSystem)) as {
      dark: { name: string; value: string }[];
    };
    expect(dark).toContainEqual({ name: '--color-bg', value: '#0a0a0f' });
  });

  it('omits the dark block for a system that ships no dark variant', () => {
    const lightOnly = { ...darkSystem, themes: undefined } as unknown as DesignSystem;
    expect(systemToCss(lightOnly)).not.toContain('data-theme');
  });
});
