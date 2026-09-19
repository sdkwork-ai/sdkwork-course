/**
 * Application upload declaration conformance (`DRIVE_SPEC.md` §18).
 *
 * The declaration file is the authority; the constants module carries its values into code so
 * call sites do not repeat literals. This test keeps the two from drifting: a change to one
 * without the other fails here rather than producing an upload statistic whose declared value
 * and sent value disagree.
 *
 * Runner: Node's built-in test runner, invoked via `tsx` for TypeScript:
 *   pnpm exec tsx --test src/__tests__/upload-declaration.node-test.ts
 * This repository declares neither `jest` nor `ts-jest` nor `vitest`, so its configured jest
 * suite cannot start at all; using `node:test` keeps this gate runnable with no new dependency.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import {
  COURSE_PC_APP_ID,
  COURSE_PC_MEDIA_ASSET_UPLOAD,
  COURSE_PC_UPLOAD_DECLARATIONS,
} from '../uploadDeclaration';

interface DeclarationEntry {
  appResourceIdKind: string;
  appResourceType: string;
  purpose: string;
  retention: string;
  retentionTtlSeconds?: number;
  scene: string;
  source: string;
  uploadProfileCode: string;
}

interface Declaration {
  schemaVersion: number;
  appId: string;
  declarations: DeclarationEntry[];
}

/** §8.1 standard upload profiles. A profile outside this set is a contract violation. */
const STANDARD_UPLOAD_PROFILES = [
  'generic',
  'video',
  'image',
  'audio',
  'document',
  'archive',
  'text',
  'dataset',
  'attachment',
  'avatar',
  'thumbnail',
];

/** `__tests__/` -> package -> packages -> app root. */
const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const DECLARATION_PATH = resolve(APP_ROOT, 'specs/upload.declaration.json');
/**
 * The canonical `appId` authority (`DRIVE_SPEC.md` §18.1 field rules). This application root has
 * no `sdkwork.app.config.json` of its own, so the authority is the repository-level config's
 * `app.key`. Asserting against that file rather than against the constant alone keeps the check
 * independent of the value under test: a wrong literal on both sides of the
 * declaration/constant pair still fails here.
 */
const REPO_CONFIG_PATH = resolve(APP_ROOT, '../../sdkwork.app.config.json');
/** §9.4 reserves `im` for Drive; an application must not declare or send it. */
const RESERVED_SCENES = ['im'];

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const APP_RESOURCE_TYPE = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_]*)+$/;

function loadDeclaration(): Declaration {
  return JSON.parse(readFileSync(DECLARATION_PATH, 'utf8')) as Declaration;
}

function loadCanonicalAppId(): string {
  const config = JSON.parse(readFileSync(REPO_CONFIG_PATH, 'utf8')) as {
    backend?: { appId?: string };
    app?: { key?: string };
  };
  const appId = config.backend?.appId ?? config.app?.key;
  assert.ok(appId, 'sdkwork.app.config.json does not declare an app identity.');
  return appId;
}

describe('upload declaration file', () => {
  it('exists, parses, and uses the supported schema', () => {
    const declaration = loadDeclaration();
    assert.equal(declaration.schemaVersion, 1);
    assert.ok(Array.isArray(declaration.declarations));
    assert.ok(declaration.declarations.length > 0);
  });

  it("declares this application's canonical appId", () => {
    assert.equal(loadDeclaration().appId, COURSE_PC_APP_ID);
  });

  it('sources its declared appId from sdkwork.app.config.json', () => {
    assert.equal(loadDeclaration().appId, loadCanonicalAppId());
    assert.equal(COURSE_PC_APP_ID, loadCanonicalAppId());
  });

  it('declares every required field on every entry', () => {
    const required: Array<keyof DeclarationEntry> = [
      'appResourceType',
      'appResourceIdKind',
      'scene',
      'source',
      'uploadProfileCode',
      'retention',
      'purpose',
    ];
    for (const entry of loadDeclaration().declarations) {
      for (const field of required) {
        assert.ok(entry[field], `entry ${entry.appResourceType} is missing ${field}`);
      }
    }
  });

  it('uses standard upload profiles only', () => {
    for (const entry of loadDeclaration().declarations) {
      assert.ok(
        STANDARD_UPLOAD_PROFILES.includes(entry.uploadProfileCode),
        `${entry.appResourceType} declares a non-standard profile ${entry.uploadProfileCode}`,
      );
    }
  });

  it('names appResourceType as a dotted lowercase business type', () => {
    for (const entry of loadDeclaration().declarations) {
      assert.match(entry.appResourceType, APP_RESOURCE_TYPE);
    }
  });

  it('names source and scene as stable lowercase kebab-case labels', () => {
    for (const entry of loadDeclaration().declarations) {
      // A package name, npm specifier, or import path is forbidden as `source`.
      assert.match(entry.source, KEBAB_CASE);
      assert.ok(!entry.source.includes('/'), `${entry.source} contains a path separator`);
      assert.ok(!entry.source.includes('@'), `${entry.source} contains an npm scope`);
      assert.match(entry.scene, KEBAB_CASE);
      assert.ok(!RESERVED_SCENES.includes(entry.scene), `${entry.scene} is a reserved scene`);
    }
  });

  it('declares temporary retention with an explicit TTL', () => {
    for (const entry of loadDeclaration().declarations) {
      assert.ok(['long_term', 'temporary'].includes(entry.retention));
      if (entry.retention === 'temporary') {
        assert.ok(
          (entry.retentionTtlSeconds ?? 0) > 0,
          `${entry.appResourceType} is temporary without retentionTtlSeconds`,
        );
      }
    }
  });

  it('declares a distinct (appResourceType, scene, uploadProfileCode) triple per entry', () => {
    const keys = loadDeclaration().declarations.map(
      (entry) => `${entry.appResourceType}|${entry.scene}|${entry.uploadProfileCode}`,
    );
    assert.equal(new Set(keys).size, keys.length);
  });
});

describe('upload declaration constants', () => {
  it('mirrors the declaration file entry for entry', () => {
    const declared = loadDeclaration().declarations;
    assert.equal(COURSE_PC_UPLOAD_DECLARATIONS.length, declared.length);

    for (const declaredEntry of declared) {
      const constant = COURSE_PC_UPLOAD_DECLARATIONS.find(
        (entry) => entry.appResourceType === declaredEntry.appResourceType,
      );
      assert.ok(constant, `no constant carries ${declaredEntry.appResourceType}`);
      assert.deepEqual(
        {
          appResourceIdKind: constant.appResourceIdKind,
          appResourceType: constant.appResourceType,
          purpose: constant.purpose,
          retention: constant.retention,
          scene: constant.scene,
          source: constant.source,
          uploadProfileCode: constant.uploadProfileCode,
        },
        {
          appResourceIdKind: declaredEntry.appResourceIdKind,
          appResourceType: declaredEntry.appResourceType,
          purpose: declaredEntry.purpose,
          retention: declaredEntry.retention,
          scene: declaredEntry.scene,
          source: declaredEntry.source,
          uploadProfileCode: declaredEntry.uploadProfileCode,
        },
      );
    }
  });

  it('retires the legacy course_media label', () => {
    // The upload shipped `course_media`, which is not kebab-case and therefore could never have
    // been declared. §18.5 step 4: keep it gone.
    assert.ok(!JSON.stringify(COURSE_PC_UPLOAD_DECLARATIONS).includes('course_media'));
  });

  it('agrees across every declared upload entry on one source label', () => {
    // §18.2: one application must not ship two `source` styles for its own uploads.
    const sources = [...new Set(COURSE_PC_UPLOAD_DECLARATIONS.map((entry) => entry.source))];
    assert.deepEqual(sources, [COURSE_PC_MEDIA_ASSET_UPLOAD.source]);
  });
});
