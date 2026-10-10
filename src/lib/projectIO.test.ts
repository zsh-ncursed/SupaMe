import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildExportFile,
  dataUrlToBlob,
  migrateProjectData,
  parseImportFile,
  PROJECT_FILE_VERSION,
  SUPPORTED_DATA_VERSION,
} from './projectIO';
import type { AssetRecord } from '../types';
import type { EditorObject, ProjectData, ShapeObject } from '../types';
import * as idb from '../db/idb';
import { getAsset } from '../db/idb';

// fake-indexeddb в этой среде не сохраняет identity Blob (он приходит как {}),
// поэтому для buildExportFile подменяем только getAsset на spy, возвращающий
// настоящий Blob; все остальные операции idb остаются реальными.
vi.mock('../db/idb', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../db/idb')>();
  return { ...actual, getAsset: vi.fn(actual.getAsset) };
});

const mkData = (
  objects: EditorObject[] = [],
  bg: ProjectData['canvas']['background'] = { type: 'color', color: '#fff', transparent: false }
): ProjectData => ({
  version: 1,
  canvas: { width: 320, height: 480, background: bg },
  objects,
});

const mkImage = (id: string, assetId: string): EditorObject => ({
  id,
  kind: 'image',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  rotation: 0,
  opacity: 1,
  locked: false,
  visible: true,
  assetId,
  flipX: false,
  flipY: false,
  crop: null,
  filters: {
    brightness: 100,
    contrast: 0,
    saturation: 100,
    blur: 0,
    grayscale: false,
    sepia: false,
  },
});

const mkShape = (id: string): ShapeObject => ({
  id,
  kind: 'shape',
  x: 5,
  y: 5,
  width: 10,
  height: 10,
  rotation: 0,
  opacity: 1,
  locked: false,
  visible: true,
  shape: 'rect',
  fill: null,
  strokeColor: '#000',
  strokeWidth: 1,
  cornerRadius: 0,
  points: [],
  tension: 0,
});

const asset = (id: string, name: string, bytes = 'hello'): AssetRecord => ({
  id,
  name,
  mime: 'text/plain',
  blob: new Blob([bytes], { type: 'text/plain' }),
  createdAt: 1,
});

const getAssetSpy = vi.mocked(getAsset);

function supameFile(content: string, name = 'мем.json'): File {
  return new File([content], name, { type: 'application/json' });
}

describe('parseImportFile', () => {
  it('rejects non-JSON files', async () => {
    await expect(parseImportFile(supameFile('не JSON'))).rejects.toThrow('Файл не является JSON');
  });

  it('rejects JSON that is not a SupaMe project', async () => {
    await expect(parseImportFile(supameFile('{"app":"other","data":{}}'))).rejects.toThrow(
      'не файл проекта SupaMe'
    );
  });

  it('rejects projects from a newer file version', async () => {
    const body = JSON.stringify({
      app: 'SupaMe',
      version: PROJECT_FILE_VERSION + 1,
      data: mkData(),
    });
    await expect(parseImportFile(supameFile(body))).rejects.toThrow('более новой версией');
  });

  it('rejects projects with a newer data version', async () => {
    const body = JSON.stringify({
      app: 'SupaMe',
      version: 1,
      data: { ...mkData(), version: SUPPORTED_DATA_VERSION + 1 },
    });
    await expect(parseImportFile(supameFile(body))).rejects.toThrow('более новой версией');
  });

  it('rejects corrupted payloads without canvas/objects', async () => {
    const body = JSON.stringify({ app: 'SupaMe', version: 1, data: { version: 1 } });
    await expect(parseImportFile(supameFile(body))).rejects.toThrow('Повреждённый файл');
  });

  it('imports a minimal project and derives the name from the file', async () => {
    const body = JSON.stringify({ app: 'SupaMe', version: 1, data: mkData() });
    const rec = await parseImportFile(supameFile(body, 'безымянный.json'));
    expect(rec.id).toBeTruthy();
    expect(rec.name).toBe('безымянный');
    expect(rec.thumbnail).toBeNull();
    expect(rec.data.objects).toEqual([]);
    expect(rec.data.canvas.width).toBe(320);
  });

  it('imports embedded assets, storing them with the same id', async () => {
    const dataUrl = `data:image/png;base64,${btoa('bytes')}`;
    const body = JSON.stringify({
      app: 'SupaMe',
      version: 1,
      name: 'С мемами',
      data: mkData([mkImage('o1', 'a1')]),
      assets: [{ id: 'a1', name: 'pic', mime: 'image/png', dataUrl }],
    });
    const rec = await parseImportFile(supameFile(body));
    expect(rec.name).toBe('С мемами');
    expect(rec.data.objects[0].kind).toBe('image');
    const stored = await idb.getAsset('a1');
    expect(stored).toBeDefined();
    expect(stored?.name).toBe('pic');
    expect((rec.data.objects[0] as EditorObject & { assetId?: string }).assetId).toBe('a1');
  });

  it('remaps asset ids on collision with an existing stored asset', async () => {
    // в БД уже есть ассет a1 — импорт должен переименовать вложенный и поправить ссылки
    await idb.putAsset({
      id: 'a1',
      name: 'existing',
      mime: 'image/png',
      blob: new Blob(['old'], { type: 'image/png' }),
      createdAt: 1,
    });
    const dataUrl = `data:image/png;base64,${btoa('new')}`;
    const body = JSON.stringify({
      app: 'SupaMe',
      version: 1,
      data: {
        version: 1,
        canvas: {
          width: 10,
          height: 10,
          background: { type: 'color', color: '#fff', transparent: false },
        },
        objects: [mkImage('o1', 'a1')],
      },
      assets: [{ id: 'a1', name: 'imp', mime: 'image/png', dataUrl }],
    });
    const rec = await parseImportFile(supameFile(body));
    const remapped = (rec.data.objects[0] as EditorObject & { assetId: string }).assetId;
    expect(remapped).not.toBe('a1');
    // старый ассет не тронут, вложенный сохранён под новым id
    expect((await idb.getAsset('a1'))?.name).toBe('existing');
    expect((await idb.getAsset(remapped))?.name).toBe('imp');
  });
});

describe('buildExportFile', () => {
  it('embeds referenced assets and produces a JSON blob', async () => {
    getAssetSpy.mockResolvedValue(asset('a1', 'pic'));
    const data = mkData([mkImage('o1', 'a1')]);
    const { file, blob } = await buildExportFile(
      { id: 'p1', name: 'Проект', createdAt: 1, updatedAt: 2 },
      data
    );
    expect(file.version).toBe(1);
    expect(file.app).toBe('SupaMe');
    expect(file.name).toBe('Проект');
    expect(file.assets).toHaveLength(1);
    expect(file.assets[0].id).toBe('a1');
    expect(file.assets[0].name).toBe('pic');
    expect(file.assets[0].mime).toBe('text/plain');
    expect(file.assets[0].dataUrl).toContain('data:text/plain;base64');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/json');
    // можно прочитать результат обратно
    const parsed = JSON.parse(await blob.text());
    expect(parsed.data.objects).toHaveLength(1);
  });

  it('includes image-background assets and skips missing ones', async () => {
    getAssetSpy.mockImplementation(async (id: string) =>
      id === 'bg1' ? asset('bg1', 'bg') : undefined
    );
    const data = mkData([mkImage('o1', 'missing')], {
      type: 'image',
      assetId: 'bg1',
      color: '#fff',
      transparent: false,
    });
    const { file } = await buildExportFile(
      { id: 'p1', name: 'П', createdAt: 1, updatedAt: 2 },
      data
    );
    const ids = file.assets.map((a) => a.id);
    expect(ids).toEqual(['bg1']); // 'missing' отсутствует в БД и пропущен
  });

  it('produces an empty assets list when nothing references images', async () => {
    const data = mkData([mkShape('o1')]);
    const { file } = await buildExportFile(
      { id: 'p1', name: 'П', createdAt: 1, updatedAt: 2 },
      data
    );
    expect(file.assets).toEqual([]);
  });
});

describe('project format constants', () => {
  it('declares the supported schema version', () => {
    expect(PROJECT_FILE_VERSION).toBe(1);
    expect(SUPPORTED_DATA_VERSION).toBe(1);
  });
});

describe('migrateProjectData', () => {
  it('is an identity while no migrations exist', () => {
    const data = mkData();
    expect(migrateProjectData(data, 0)).toBe(data);
  });
});

describe('dataUrlToBlob', () => {
  it('decodes a base64 data URL into a typed Blob', async () => {
    const blob = dataUrlToBlob(`data:text/plain;base64,${btoa('supame')}`);
    expect(blob.type).toBe('text/plain');
    expect(await blob.text()).toBe('supame');
  });

  it('falls back to octet-stream when mime is missing', () => {
    const blob = dataUrlToBlob(`data:;base64,${btoa('x')}`);
    expect(blob.type).toBe('application/octet-stream');
  });

  it('throws on a malformed url without a comma', () => {
    expect(() => dataUrlToBlob('not-a-data-url')).toThrow();
  });
});
