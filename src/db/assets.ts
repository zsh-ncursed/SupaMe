// Кэш ассетов (изображений): blob -> objectURL + размеры
import { useEffect, useState } from 'react';
import type { AssetRecord } from '../types';
import { getAsset, putAsset, deleteAsset } from './idb';
import { uid } from '../lib/utils';

export interface AssetEntry {
  id: string;
  name: string;
  mime: string;
  url: string;
  width: number;
  height: number;
  blob: Blob;
  /** Загруженный HTMLImageElement для Konva */
  el: HTMLImageElement;
}

const cache = new Map<string, AssetEntry>();
const pending = new Map<string, Promise<AssetEntry | null>>();

export function peekAsset(id: string): AssetEntry | undefined {
  return cache.get(id);
}

function loadEntry(rec: AssetRecord): Promise<AssetEntry> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(rec.blob);
    const img = new Image();
    img.onload = () => {
      const entry: AssetEntry = {
        id: rec.id,
        name: rec.name,
        mime: rec.mime,
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
        blob: rec.blob,
        el: img,
      };
      cache.set(rec.id, entry);
      resolve(entry);
    };
    img.onerror = () => reject(new Error(`Не удалось загрузить изображение: ${rec.name}`));
    img.src = url;
  });
}

export async function getAssetEntry(id: string): Promise<AssetEntry | null> {
  const cached = cache.get(id);
  if (cached) return cached;
  let p = pending.get(id);
  if (!p) {
    p = getAsset(id).then((rec) => (rec ? loadEntry(rec) : null));
    pending.set(id, p);
  }
  const entry = await p;
  pending.delete(id);
  return entry;
}

export async function addAsset(blob: Blob, name: string, mime?: string): Promise<string> {
  const id = uid();
  const rec: AssetRecord = {
    id,
    name,
    mime: mime || blob.type || 'image/png',
    blob,
    createdAt: Date.now(),
  };
  await putAsset(rec);
  await loadEntry(rec);
  return id;
}

export async function removeAsset(id: string): Promise<void> {
  revokeCacheAsset(id);
  await deleteAsset(id).catch(() => undefined);
}

/** Освободить objectURL и убрать ассет из кэша (без удаления из БД) */
export function revokeCacheAsset(id: string): void {
  const entry = cache.get(id);
  if (entry) {
    URL.revokeObjectURL(entry.url);
    cache.delete(id);
  }
  pending.delete(id);
}

/** Полностью очистить кэш ассетов (смена проекта): revoke всех objectURL */
export function clearAssetCache(): void {
  for (const entry of cache.values()) {
    URL.revokeObjectURL(entry.url);
  }
  cache.clear();
  pending.clear();
}

/** React-хук: возвращает entry ассета, когда он загружен */
export function useAsset(id: string | undefined): AssetEntry | null {
  const [entry, setEntry] = useState<AssetEntry | null>(() =>
    id ? (cache.get(id) ?? null) : null
  );
  useEffect(() => {
    let alive = true;
    if (!id) {
      setEntry(null);
      return;
    }
    const cached = cache.get(id);
    if (cached) {
      setEntry(cached);
      return;
    }
    getAssetEntry(id)
      .then((e) => {
        if (alive) setEntry(e);
      })
      .catch(() => {
        if (alive) setEntry(null);
      });
    return () => {
      alive = false;
    };
  }, [id]);
  return entry;
}
