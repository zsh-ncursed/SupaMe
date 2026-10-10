import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addAsset, removeAsset, getAssetEntry, revokeCacheAsset, clearAssetCache } from './assets';
import { getAsset } from './idb';

/** jsdom не декодирует изображения — подменяем Image, которое «грузит» blob: */
class FakeImage {
  onload: (() => void) | null = null;
  onerror: ((e?: unknown) => void) | null = null;
  naturalWidth = 640;
  naturalHeight = 480;
  private _src = '';
  get src() {
    return this._src;
  }
  set src(v: string) {
    this._src = v;
    queueMicrotask(() => {
      if (v && v.startsWith('blob:')) this.onload?.();
      else this.onerror?.(new Error(`load failed: ${v}`));
    });
  }
}

beforeEach(() => {
  vi.stubGlobal('Image', FakeImage);
  // jsdom не реализует URL.createObjectURL/revokeObjectURL — доопределяем
  const urlNs = URL as unknown as {
    createObjectURL?: (blob: Blob) => string;
    revokeObjectURL?: (url: string) => void;
  };
  urlNs.createObjectURL ??= () => 'blob:mock-url';
  urlNs.revokeObjectURL ??= () => undefined;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:mock-url');
  // гарантируем чистый кэш между тестами
  clearAssetCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('addAsset / getAssetEntry', () => {
  it('stores an asset and resolves its entry', async () => {
    const id = await addAsset(new Blob(['x'], { type: 'image/png' }), 'pic');
    const entry = await getAssetEntry(id);
    expect(entry).not.toBeNull();
    expect(entry?.name).toBe('pic');
    expect(entry?.mime).toBe('image/png');
    expect(entry?.width).toBe(640);
    expect(entry?.height).toBe(480);
    expect(entry?.url.startsWith('blob:')).toBe(true);
  });

  it('falls back to the blob type and defaults mime when empty', async () => {
    const id1 = await addAsset(new Blob(['x']), 'no-type');
    const e1 = await getAssetEntry(id1);
    expect(e1?.mime).toBe('image/png'); // blob.type пустой -> image/png

    const id2 = await addAsset(new Blob(['x'], { type: '' }), 'explicit', 'image/webp');
    const e2 = await getAssetEntry(id2);
    expect(e2?.mime).toBe('image/webp');
  });
});

describe('getAssetEntry', () => {
  it('returns the cached entry on repeat calls', async () => {
    const id = await addAsset(new Blob(['x'], { type: 'image/png' }), 'pic');
    const e1 = await getAssetEntry(id);
    const e2 = await getAssetEntry(id);
    expect(e1).toBe(e2);
  });

  it('dedupes concurrent loads into a single createObjectURL', async () => {
    const id = await addAsset(new Blob(['x'], { type: 'image/png' }), 'pic');
    await getAssetEntry(id);
    // убираем из кэша, чтобы оба вызова пошли в общий pending
    revokeCacheAsset(id);
    const spy = vi.mocked(URL.createObjectURL).mockClear();
    const [a, b] = await Promise.all([getAssetEntry(id), getAssetEntry(id)]);
    expect([a, b].every((e) => e !== null)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('returns null for a missing asset', async () => {
    expect(await getAssetEntry('nope')).toBeNull();
  });
});

describe('cache eviction', () => {
  it('revokeCacheAsset revokes the objectURL and drops the entry', async () => {
    const id = await addAsset(new Blob(['x'], { type: 'image/png' }), 'pic');
    const entry = (await getAssetEntry(id))!;
    const spy = vi.spyOn(URL, 'revokeObjectURL');
    revokeCacheAsset(id);
    expect(spy).toHaveBeenCalledWith(entry.url);
    // после снятия можно снова загрузить из БД
    expect((await getAssetEntry(id))?.name).toBe('pic');
  });

  it('revokeCacheAsset tolerates an unknown id', () => {
    const spy = vi.spyOn(URL, 'revokeObjectURL');
    expect(() => revokeCacheAsset('missing')).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });

  it('clearAssetCache revokes every cached url', async () => {
    const id1 = await addAsset(new Blob(['a'], { type: 'image/png' }), 'one');
    const id2 = await addAsset(new Blob(['b'], { type: 'image/png' }), 'two');
    await Promise.all([getAssetEntry(id1), getAssetEntry(id2)]);
    const spy = vi.spyOn(URL, 'revokeObjectURL');
    clearAssetCache();
    expect(spy).toHaveBeenCalledTimes(2);
    // кэш опустошён, но из БД можно загрузить снова
    expect((await getAssetEntry(id1))?.name).toBe('one');
  });

  it('removeAsset revokes the url and deletes the record from idb', async () => {
    const id = await addAsset(new Blob(['x'], { type: 'image/png' }), 'pic');
    const entry = (await getAssetEntry(id))!;
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    await removeAsset(id);
    expect(revokeSpy).toHaveBeenCalledWith(entry.url);
    expect(await getAsset(id)).toBeUndefined();
    expect(await getAssetEntry(id)).toBeNull();
  });
});
