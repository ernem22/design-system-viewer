import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import { copyLinkToView } from './copyLink.ts';
import {
  initialSectionHash,
  readViewUrl,
  writeSectionHash,
  writeViewUrl,
} from './urlState.ts';
import type { ViewUrlState, WriteViewUrlParams } from './urlState.ts';

// copyLinkToView copies window.location.href verbatim, so its contract is
// really "the URL the app writes round-trips through the load decoder". A
// happy-dom Window gives the module a live location whose search and hash the
// urlState writers actually move, plus a clipboard to read back -- the same
// self-built DOM the other lib suites use (toasts.test.ts), minus React.
let copied: string | null = null;

function installWindow(url = 'https://design.test/'): Window {
  const window = new Window({ url });
  vi.stubGlobal('window', window);
  vi.stubGlobal('document', window.document);
  vi.stubGlobal('navigator', window.navigator);
  // happy-dom ships no clipboard; capture whatever the copy writes instead.
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async (text: string): Promise<void> => {
        copied = text;
      },
    },
  });
  return window;
}

/** Write a view into a live URL, run Copy Link, and hand back what it copied. */
async function copyView(
  params: WriteViewUrlParams,
  section?: string,
): Promise<string> {
  installWindow();
  writeViewUrl(params);
  if (section) writeSectionHash(section);
  await copyLinkToView();
  if (copied === null) throw new Error('Copy Link did not write to the clipboard');
  return copied;
}

/** Open a copied URL and decode it the way the app does on boot. */
function restore(url: string): { state: ViewUrlState; hash: string | null } {
  installWindow(url);
  return { state: readViewUrl(), hash: initialSectionHash() };
}

beforeEach(() => {
  copied = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Copy Link round-trip', () => {
  it('copies a URL that restores the tab, system, section and compare state', async () => {
    const url = await copyView(
      {
        tab: 'compare',
        sys: 'carbon',
        cmp: ['aurora', 'carbon'],
        view: 'diff',
        component: 'button',
      },
      'compare-section',
    );

    const { state, hash } = restore(url);

    expect(state.tab).toBe('compare');
    expect(state.sys).toBe('carbon');
    expect(hash).toBe('compare-section');
    expect(state.cmp).toEqual(['aurora', 'carbon']);
    expect(state.view).toBe('diff');
    expect(state.component).toBe('button');
  });

  it('restores the tab', async () => {
    const url = await copyView({ tab: 'preview', sys: 'carbon' });
    expect(restore(url).state.tab).toBe('preview');
  });

  it('restores the active system', async () => {
    const url = await copyView({ tab: 'preview', sys: 'aurora' });
    expect(restore(url).state.sys).toBe('aurora');
  });

  it('restores the section hash', async () => {
    const url = await copyView({ tab: 'preview', sys: 'carbon' }, 'buttons');
    expect(restore(url).hash).toBe('buttons');
  });

  it('restores the compare picks', async () => {
    const url = await copyView({
      tab: 'compare',
      sys: 'carbon',
      cmp: ['aurora', 'carbon'],
    });
    expect(restore(url).state.cmp).toEqual(['aurora', 'carbon']);
  });

  it('restores the compare mode', async () => {
    const url = await copyView({ tab: 'compare', sys: 'carbon', view: 'diff' });
    expect(restore(url).state.view).toBe('diff');
  });

  it('restores the compare component', async () => {
    const url = await copyView({ tab: 'compare', sys: 'carbon', component: 'tabs' });
    expect(restore(url).state.component).toBe('tabs');
  });
});
