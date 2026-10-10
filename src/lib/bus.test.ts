import { describe, expect, it, vi } from 'vitest';
import { emit, on } from './bus';

describe('bus', () => {
  it('delivers events to subscribed handlers and unsubscribes', () => {
    const h = vi.fn();
    const off = on('open-file-dialog', h);
    emit('open-file-dialog');
    expect(h).toHaveBeenCalledTimes(1);
    off();
    emit('open-file-dialog');
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('supports multiple subscribers; removing one keeps the rest', () => {
    const a = vi.fn();
    const b = vi.fn();
    on('assets-changed', a);
    const offB = on('assets-changed', b);
    emit('assets-changed');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    offB();
    emit('assets-changed');
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('does not throw when emitting with no listeners', () => {
    expect(() => emit('open-file-dialog')).not.toThrow();
  });

  it('does not invoke a subscriber added during dispatch in the same round', () => {
    let inner = 0;
    const outer = vi.fn(() => {
      on('assets-changed', () => {
        inner += 1;
      });
    });
    on('assets-changed', outer);
    emit('assets-changed');
    expect(outer).toHaveBeenCalledTimes(1);
    expect(inner).toBe(0);
    emit('assets-changed');
    expect(inner).toBe(1);
    expect(outer).toHaveBeenCalledTimes(2);
  });

  it('deduplicates the same handler subscribed twice (listeners — это Set)', () => {
    const h = vi.fn();
    const off = on('open-file-dialog', h);
    on('open-file-dialog', h);
    emit('open-file-dialog');
    expect(h).toHaveBeenCalledTimes(1);
    off();
    emit('open-file-dialog');
    expect(h).toHaveBeenCalledTimes(1); // обе подписки — одна и та же функция
  });
});
