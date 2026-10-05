// Экспорт / импорт проекта в файл (JSON с изображениями в base64)
import type { ExportedProjectFile, ProjectData, ProjectRecord } from '../types';
import { getAsset } from '../db/idb';
import { uid, safeFileName } from './utils';

export async function buildExportFile(
  meta: Pick<ProjectRecord, 'id' | 'name' | 'createdAt' | 'updatedAt'>,
  data: ProjectData
): Promise<{ file: ExportedProjectFile; blob: Blob }> {
  const assetIds = new Set<string>();
  for (const obj of data.objects) {
    if (obj.kind === 'image') assetIds.add(obj.assetId);
  }
  if (data.canvas.background.type === 'image' && data.canvas.background.assetId) {
    assetIds.add(data.canvas.background.assetId);
  }
  const assets: ExportedProjectFile['assets'] = [];
  for (const id of assetIds) {
    const rec = await getAsset(id);
    if (!rec) continue;
    const dataUrl = await blobToDataUrl(rec.blob);
    assets.push({ id: rec.id, name: rec.name, mime: rec.mime, dataUrl });
  }
  const file: ExportedProjectFile = {
    version: 1,
    app: 'SupaMe',
    name: meta.name,
    data,
    assets,
  };
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
  return { file, blob };
}

export async function parseImportFile(file: File): Promise<ProjectRecord> {
  const text = await file.text();
  const parsed = JSON.parse(text) as ExportedProjectFile;
  if (!parsed || parsed.app !== 'SupaMe' || !parsed.data) {
    throw new Error('Это не файл проекта SupaMe');
  }
  const id = uid();
  const now = Date.now();
  // Сохраняем вложенные изображения как ассеты с теми же id (или новыми при конфликте)
  for (const a of parsed.assets ?? []) {
    const blob = await dataUrlToBlob(a.dataUrl);
    const { putAsset, getAsset } = await import('../db/idb');
    let assetId = a.id;
    const existing = await getAsset(assetId).catch(() => undefined);
    if (existing) {
      assetId = uid();
    }
    await putAsset({ id: assetId, name: a.name, mime: a.mime, blob, createdAt: now });
    if (assetId !== a.id) remapAssetId(parsed.data, a.id, assetId);
  }
  return {
    id,
    name: parsed.name || safeFileName(file.name.replace(/\.[^.]+$/, ''), 'Проект'),
    createdAt: now,
    updatedAt: now,
    thumbnail: null,
    data: parsed.data,
  };
}

function remapAssetId(data: ProjectData, from: string, to: string) {
  for (const obj of data.objects) {
    if (obj.kind === 'image' && obj.assetId === from) obj.assetId = to;
  }
  if (data.canvas.background.assetId === from) data.canvas.background.assetId = to;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((r) => r.blob());
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
