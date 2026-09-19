import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import { download } from './export.ts';

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
