import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPanelOpen, writePanelOpen } from './panelStorage.ts';

// The panel ports renamed the legacy storage keys (`dsv.rail`/`dsv.props`)
// to the app-scoped `dsv.app.rail`/`dsv.app.props`. A returning user's
// persisted choice must survive that rename, so readPanelOpen falls back to
// the legacy key once and migrates the value forward. Stub just enough of
// localStorage to observe both sides of the rename.
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

let storage: MemoryStorage;

function installStorage(): MemoryStorage {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  return storage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readPanelOpen', () => {
  it('returns the default when nothing is stored', () => {
    installStorage();
    expect(readPanelOpen('dsv.app.rail', true)).toBe(true);
    expect(readPanelOpen('dsv.app.props', false)).toBe(false);
  });

  it('reads the app-scoped key once it exists', () => {
    const s = installStorage();
    s.setItem('dsv.app.rail', 'closed');
    s.setItem('dsv.app.props', 'open');
    expect(readPanelOpen('dsv.app.rail', true)).toBe(false);
    expect(readPanelOpen('dsv.app.props', false)).toBe(true);
  });

  it('migrates a legacy rail key forward to the app-scoped key', () => {
    const s = installStorage();
    s.setItem('dsv.rail', 'closed');
    expect(readPanelOpen('dsv.app.rail', true)).toBe(false);
    expect(s.getItem('dsv.app.rail')).toBe('closed');
    expect(s.getItem('dsv.rail')).toBeNull();
  });

  it('migrates a legacy props key forward to the app-scoped key', () => {
    const s = installStorage();
    s.setItem('dsv.props', 'closed');
    expect(readPanelOpen('dsv.app.props', true)).toBe(false);
    expect(s.getItem('dsv.app.props')).toBe('closed');
    expect(s.getItem('dsv.props')).toBeNull();
  });

  it('prefers the app-scoped key when both are present', () => {
    const s = installStorage();
    s.setItem('dsv.rail', 'closed');
    s.setItem('dsv.app.rail', 'open');
    expect(readPanelOpen('dsv.app.rail', false)).toBe(true);
    expect(s.getItem('dsv.rail')).toBe('closed');
  });

  it('falls back to the default when storage is unreachable', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('blocked');
      },
    });
    expect(readPanelOpen('dsv.app.rail', true)).toBe(true);
  });
});

describe('writePanelOpen', () => {
  it('persists to the app-scoped key', () => {
    const s = installStorage();
    writePanelOpen('dsv.app.rail', false);
    expect(s.getItem('dsv.app.rail')).toBe('closed');
    writePanelOpen('dsv.app.rail', true);
    expect(s.getItem('dsv.app.rail')).toBe('open');
  });

  it('silently no-ops when storage is unreachable', () => {
    vi.stubGlobal('localStorage', {
      setItem() {
        throw new Error('blocked');
      },
    });
    expect(() => writePanelOpen('dsv.app.props', true)).not.toThrow();
  });
});
