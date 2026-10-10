import { describe, expect, it } from 'vitest';
import {
  dataUrlToBlob,
  migrateProjectData,
  PROJECT_FILE_VERSION,
  SUPPORTED_DATA_VERSION,
} from './projectIO';

describe('project format constants', () => {
  it('declares the supported schema version', () => {
    expect(PROJECT_FILE_VERSION).toBe(1);
    expect(SUPPORTED_DATA_VERSION).toBe(1);
  });
});

describe('migrateProjectData', () => {
  it('is an identity while no migrations exist', () => {
    const data = { version: 1, canvas: { width: 10, height: 10 }, objects: [] } as never;
    expect(migrateProjectData(data, 0)).toBe(data);
  });
});

describe('dataUrlToBlob', () => {
  it('decodes a base64 data URL into a typed Blob', async () => {
    const b64 = btoa('supame');
    const blob = dataUrlToBlob(`data:text/plain;base64,${b64}`);
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
