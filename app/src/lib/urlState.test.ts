import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  initialSectionHash,
  readViewUrl,
  scrollToSection,
  writeSectionHash,
  writeViewUrl,
} from './urlState.ts';

// writeViewUrl/writeSectionHash talk to window.history directly, so tests
// fake just enough of window to observe the resulting URL instead of
// pulling in a DOM environment for a querystring-only module.
interface StubLocation {
  pathname: string;
  search: string;
  hash: string;
}

function installWindowStub(
  initialSearch = '',
  initialHash = '',
): StubLocation {
  const location: StubLocation = {
    pathname: '/',
    search: initialSearch,
    hash: initialHash,
  };
  vi.stubGlobal('window', {
    location,
    history: {
      replaceState(_state: unknown, _title: string, url: string): void {
        const queryAt = url.indexOf('?');
        const hashAt = url.indexOf('#');
        location.search =
          queryAt === -1
            ? ''
            : url.slice(queryAt, hashAt === -1 ? undefined : hashAt);
        location.hash = hashAt === -1 ? '' : url.slice(hashAt);
      },
    },
  });
  return location;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readViewUrl', () => {
  it('restores the tab, defaulting to null for the bare root', () => {
    expect(readViewUrl('').tab).toBeNull();
    expect(readViewUrl('?tab=preview').tab).toBe('preview');
    expect(readViewUrl('?tab=compare').tab).toBe('compare');
    expect(readViewUrl('?tab=tokens').tab).toBe('tokens');
  });

  it('falls back to null for unknown tabs instead of breaking', () => {
    expect(readViewUrl('?tab=bogus').tab).toBeNull();
  });

  it('maps the legacy ?tab=system deep link onto the tokens tab', () => {
    expect(readViewUrl('?tab=system').tab).toBe('tokens');
    expect(readViewUrl('?tab=system&sys=carbon').sys).toBe('carbon');
  });

  it('still prefers a canonical tab over the mode alias beside ?tab=system', () => {
    expect(readViewUrl('?tab=system&mode=compare').tab).toBe('tokens');
  });

  it('restores the active system, raw for the caller to validate', () => {
    expect(readViewUrl('').sys).toBeNull();
    expect(readViewUrl('?sys=carbon').sys).toBe('carbon');
  });

  it('restores compare picks, trimming and dropping empties', () => {
    expect(readViewUrl('').cmp).toEqual([]);
    expect(readViewUrl('?cmp=a,b').cmp).toEqual(['a', 'b']);
    expect(readViewUrl('?cmp=a,,%20b%20').cmp).toEqual(['a', 'b']);
  });

  it('restores compare mode and component', () => {
    expect(readViewUrl('').view).toBeNull();
    expect(readViewUrl('?cv=diff').view).toBe('diff');
    expect(readViewUrl('').component).toBeNull();
    expect(readViewUrl('?cc=button').component).toBe('button');
  });

  it('honors legacy aliases for links shared from the old viewer', () => {
    expect(readViewUrl('?mode=compare').tab).toBe('compare');
    expect(readViewUrl('?v=diff').view).toBe('diff');
    expect(readViewUrl('?c=button').component).toBe('button');
  });

  it('prefers canonical params over legacy aliases when both exist', () => {
    expect(readViewUrl('?tab=preview&mode=compare').tab).toBe('preview');
    expect(readViewUrl('?cv=a&v=b').view).toBe('a');
    expect(readViewUrl('?cc=a&c=b').component).toBe('a');
  });
});

describe('writeViewUrl', () => {
  it('keeps the default view on the bare-root URL', () => {
    const location = installWindowStub('?tab=preview&sys=a');
    writeViewUrl({ tab: null, sys: null, cmp: null });
    expect(location.search).toBe('');
    expect(readViewUrl(location.search)).toEqual({
      tab: null,
      sys: null,
      cmp: [],
      view: null,
      component: null,
      dark: false,
    });
  });

  it('round-trips tab + system through the live URL', () => {
    const location = installWindowStub();
    writeViewUrl({ tab: 'preview', sys: 'carbon' });
    expect(readViewUrl().tab).toBe('preview');
    expect(readViewUrl().sys).toBe('carbon');
    expect(location.search).toContain('tab=preview');
    expect(location.search).toContain('sys=carbon');
  });

  it('round-trips compare picks, mode, and component', () => {
    const location = installWindowStub();
    writeViewUrl({
      tab: 'compare',
      sys: 'a',
      cmp: ['a', 'b'],
      view: 'diff',
      component: 'button',
    });
    expect(readViewUrl(location.search)).toEqual({
      tab: 'compare',
      sys: 'a',
      cmp: ['a', 'b'],
      view: 'diff',
      component: 'button',
      dark: false,
    });
  });

  it('omits the default compare mode so it stays the default on read', () => {
    const location = installWindowStub();
    writeViewUrl({ view: 'component', component: null });
    expect(location.search).not.toContain('cv=');
    expect(location.search).not.toContain('cc=');
    expect(readViewUrl(location.search).view).toBeNull();
  });

  it('canonicalizes legacy aliases away on write', () => {
    const location = installWindowStub('?mode=compare&v=diff&c=button');
    writeViewUrl({ tab: 'compare', view: 'diff', component: 'button' });
    const params = new URLSearchParams(location.search);
    expect(params.has('mode')).toBe(false);
    expect(params.has('v')).toBe(false);
    expect(params.has('c')).toBe(false);
    expect(readViewUrl(location.search)).toEqual({
      tab: 'compare',
      sys: null,
      cmp: [],
      view: 'diff',
      component: 'button',
      dark: false,
    });
  });

  it('canonicalizes a legacy ?tab=system deep link away on write', () => {
    const location = installWindowStub('?tab=system&sys=a');
    writeViewUrl({ tab: 'tokens', sys: 'a' });
    expect(location.search).toBe('?sys=a');
    expect(readViewUrl(location.search).tab).toBeNull();
  });

  it('leaves unrelated params untouched', () => {
    const location = installWindowStub('?foo=bar');
    writeViewUrl({ sys: 'carbon' });
    expect(location.search).toContain('foo=bar');
    expect(readViewUrl(location.search).sys).toBe('carbon');
  });
});

describe('dark flag (#110)', () => {
  it('reads dark=false from the bare root', () => {
    expect(readViewUrl('').dark).toBe(false);
  });

  it('round-trips dark through the live URL (write then read)', () => {
    const location = installWindowStub();
    writeViewUrl({ sys: 'aurora', dark: true });
    expect(location.search).toContain('dark=1');
    expect(readViewUrl(location.search).dark).toBe(true);
  });

  it('drops the dark flag on write when dark is off', () => {
    const location = installWindowStub('?sys=a&dark=1');
    writeViewUrl({ sys: 'a', dark: false });
    expect(location.search).not.toContain('dark');
    expect(readViewUrl(location.search).dark).toBe(false);
  });
});

describe('section hash', () => {
  it('mirrors the section into the hash while preserving the querystring', () => {
    const location = installWindowStub('?tab=preview&sys=a');
    writeSectionHash('button');
    expect(location.hash).toBe('#button');
    expect(location.search).toBe('?tab=preview&sys=a');
  });

  it('decodes the hash for the post-mount restore', () => {
    installWindowStub('', '#my%20section');
    expect(initialSectionHash()).toBe('my section');
    installWindowStub('', '');
    expect(initialSectionHash()).toBeNull();
  });

  it('scrolls only when the section exists in the DOM', () => {
    installWindowStub();
    vi.stubGlobal('document', { getElementById: (_id: string) => null });
    expect(scrollToSection('missing')).toBe(false);

    let scrolled = false;
    vi.stubGlobal('document', {
      getElementById: (_id: string) => ({
        scrollIntoView: (_opts?: unknown): void => {
          scrolled = true;
        },
      }),
    });
    expect(scrollToSection('button')).toBe(true);
    expect(scrolled).toBe(true);
  });
});
