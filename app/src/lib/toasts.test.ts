import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import type { Root } from 'react-dom/client';
import { Window } from 'happy-dom';
import { useToasts, type PushToast, type Toast } from './toasts.ts';

// useToasts is a hook, so the suite mounts a tiny probe component even though
// vitest runs in the configured node environment — happy-dom (already a
// devDependency) provides just enough DOM for react-dom's client root, with
// no need for React Testing Library or react-test-renderer.
interface ToastProbe {
  toasts: Toast[];
  push: PushToast;
}

let latest: ToastProbe | null = null;

function Probe() {
  const [toasts, push] = useToasts();
  latest = { toasts, push };
  return createElement('div');
}

function current(): ToastProbe {
  if (!latest) throw new Error('toast probe did not render');
  return latest;
}

let root: Root | null = null;

async function mountProbe(): Promise<void> {
  const window = new Window();
  vi.stubGlobal('window', window);
  vi.stubGlobal('document', window.document);
  vi.stubGlobal('navigator', window.navigator);
  vi.stubGlobal('HTMLElement', window.HTMLElement);
  vi.stubGlobal('Node', window.Node);
  // Imported lazily so react-dom never observes a document-less environment
  // at module scope under the node test environment.
  const { createRoot } = await import('react-dom/client');
  const container = window.document.createElement('div');
  window.document.body.appendChild(container);
  const mounted = createRoot(container);
  act(() => {
    mounted.render(createElement(Probe));
  });
  root = mounted;
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  latest = null;
  root = null;
  await mountProbe();
});

afterEach(() => {
  const mounted = root;
  if (mounted) {
    act(() => {
      mounted.unmount();
    });
  }
  root = null;
  latest = null;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useToasts', () => {
  it('starts with an empty queue', () => {
    expect(current().toasts).toEqual([]);
  });

  it('adds a pushed toast with its id, message, and tone', () => {
    act(() => {
      current().push('Copied link', 'err');
    });

    const toasts = current().toasts;
    expect(toasts).toHaveLength(1);
    const [toast] = toasts;
    expect(toast).toMatchObject({ msg: 'Copied link', tone: 'err' });
    expect(typeof toast?.id).toBe('number');
  });

  it('defaults the tone to "ok" when none is given', () => {
    act(() => {
      current().push('Saved');
    });

    expect(current().toasts).toHaveLength(1);
    expect(current().toasts[0]).toMatchObject({ msg: 'Saved', tone: 'ok' });
  });

  it('accumulates multiple toasts in push order', () => {
    act(() => {
      current().push('First');
    });
    act(() => {
      current().push('Second', 'err');
    });
    act(() => {
      current().push('Third');
    });

    expect(current().toasts.map((toast) => toast.msg)).toEqual([
      'First',
      'Second',
      'Third',
    ]);
  });

  it('assigns unique, incrementing ids', () => {
    act(() => {
      const { push } = current();
      push('First');
      push('Second');
      push('Third');
    });

    const ids = current().toasts.map((toast) => toast.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < ids.length; i += 1) {
      expect(ids[i]).toBe(ids[i - 1] + 1);
    }
  });

  it('applies synchronous pushes as one batched update', () => {
    const { push } = current();
    act(() => {
      push('First');
      push('Second');
    });

    // Both pushes land in the same update — never an intermediate
    // single-toast state.
    expect(current().toasts.map((toast) => toast.msg)).toEqual([
      'First',
      'Second',
    ]);
  });

  it('keeps a stable push callback across updates', () => {
    const push = current().push;
    act(() => {
      push('First');
    });
    act(() => {
      vi.advanceTimersByTime(2600);
    });

    expect(current().toasts).toEqual([]);
    expect(current().push).toBe(push);
  });

  it('auto-dismisses a toast after 2600ms', () => {
    act(() => {
      current().push('Saved');
    });
    expect(current().toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(2599);
    });
    expect(current().toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(current().toasts).toEqual([]);
  });

  it('dismisses each toast on its own schedule', () => {
    act(() => {
      current().push('First');
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      current().push('Second');
    });

    // The first toast's timer fires while the second is still fresh.
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(current().toasts.map((toast) => toast.msg)).toEqual(['Second']);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(current().toasts).toEqual([]);
  });
});
