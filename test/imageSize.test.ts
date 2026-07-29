/**
 * Reading image dimensions off the files in public/assets.
 *
 * These run against the real assets rather than fixtures — the point of the
 * helper is that photos arriving through the /admin editor get correct
 * dimensions with nobody typing them, so the useful question is whether it
 * copes with what's actually in the repository.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageSize } from '../src/lib/imageSize.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'public/assets');

describe('imageSize', () => {
  test('reads an SVG that declares width and height', () => {
    assert.deepEqual(imageSize('/assets/works.svg'), { width: 800, height: 600 });
    assert.deepEqual(imageSize('/assets/coverage.svg'), { width: 700, height: 520 });
  });

  test('reads a PNG from its IHDR chunk', () => {
    const card = imageSize('/assets/share-card.png');
    assert.deepEqual(card, { width: 1200, height: 630 }, 'the share card must be 1200×630 for link previews');
  });

  test('reads a JPEG from its start-of-frame marker', () => {
    const photo = imageSize('/assets/installation.jpg');
    assert.ok(photo, 'installation.jpg was not read');
    assert.ok(photo!.width > 0 && photo!.height > 0);
  });

  test('accepts every spelling of the same path', () => {
    const expected = { width: 800, height: 600 };
    assert.deepEqual(imageSize('/assets/works.svg'), expected);
    assert.deepEqual(imageSize('./assets/works.svg'), expected);
    assert.deepEqual(imageSize('assets/works.svg'), expected);
  });

  test('returns null for a file that is not there, rather than throwing', () => {
    assert.equal(imageSize('/assets/not-a-real-file.png'), null);
  });

  test('returns null for something that is not an image', () => {
    assert.equal(imageSize('/styles.css'), null);
  });

  test('every image in public/assets can be measured', () => {
    // If this fails, a new asset is in a format the helper doesn't know and
    // its <img> will ship without dimensions.
    const unreadable = readdirSync(ASSETS)
      .filter((f) => /\.(png|jpe?g|gif|webp|svg)$/i.test(f))
      .filter((f) => !imageSize(`/assets/${f}`));
    assert.deepEqual(unreadable, [], `could not read dimensions: ${unreadable.join(', ')}`);
  });

  test('all dimensions are positive whole numbers', () => {
    for (const f of readdirSync(ASSETS).filter((f) => /\.(png|jpe?g|gif|webp|svg)$/i.test(f))) {
      const size = imageSize(`/assets/${f}`)!;
      assert.ok(Number.isInteger(size.width) && size.width > 0, `${f} width: ${size.width}`);
      assert.ok(Number.isInteger(size.height) && size.height > 0, `${f} height: ${size.height}`);
    }
  });
});
