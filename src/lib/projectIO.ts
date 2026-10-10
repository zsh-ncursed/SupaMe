// Экспорт / импорт проекта в файл (JSON с изображениями в base64)
import type { ExportedProjectFile, ProjectData, ProjectRecord } from '../types';
import { getAsset } from '../db/idb';
import { uid, safeFileName } from './utils';

export const PROJECT_FILE_VERSION = 1; // версия формата *.supame.json
export const SUPPORTED_DATA_VERSION = 1; // поддерживаемая версия схемы data

/**
 * Миграция данных проекта с более старой версии схемы на текущую.
 * Сейчас версий миграции нет — возвращаем данные как есть (место для step-функций).
 * Более новую версию (fileVersion/dataVersion > SUPPORTED) reject'ит parseImportFile.
 */
export function migrateProjectData(data: ProjectData, fromVersion: number): ProjectData {
  void fromVersion;
  return data;
}

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
  let parsed: ExportedProjectFile;
  try {
    parsed = JSON.parse(text) as ExportedProjectFile;
  } catch {
    throw new Error('Файл не является JSON и не похож на проект SupaMe');
  }
  if (!parsed || parsed.app !== 'SupaMe') {
    throw new Error('Это не файл проекта SupaMe');
  }
  const fileVersion = parsed.version ?? 1;
  const dataVersion = parsed.data?.version ?? 1;
  if (fileVersion > PROJECT_FILE_VERSION || dataVersion > SUPPORTED_DATA_VERSION) {
    throw new Error('Файл создан более новой версией SupaMe — обновите приложение');
  }
  if (!parsed.data || !parsed.data.canvas || !Array.isArray(parsed.data.objects)) {
    throw new Error('Повреждённый файл проекта: отсутствуют данные холста/объектов');
  }
  const data = migrateProjectData(parsed.data, dataVersion);

  const id = uid();
  const now = Date.now();
  // Сохраняем вложенные изображения как ассеты с теми же id (или новыми при конфликте)
  for (const a of parsed.assets ?? []) {
    if (!a?.dataUrl) continue;
    const blob = dataUrlToBlob(a.dataUrl);
    const { putAsset, getAsset } = await import('../db/idb');
    let assetId = a.id;
    const existing = await getAsset(assetId).catch(() => undefined);
    if (existing) {
      assetId = uid();
    }
    await putAsset({ id: assetId, name: a.name, mime: a.mime, blob, createdAt: now });
    if (assetId !== a.id) remapAssetId(data, a.id, assetId);
  }
  return {
    id,
    name: parsed.name || safeFileName(file.name.replace(/\.[^.]+$/, ''), 'Проект'),
    createdAt: now,
    updatedAt: now,
    thumbnail: null,
    data,
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

export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) {
    throw new Error('Некорректный dataURL в файле проекта');
  }
  const meta = dataUrl.slice(0, comma);
  const mime = /^data:([^;,]*)/.exec(meta)?.[1] || 'application/octet-stream';
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
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
