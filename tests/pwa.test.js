const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.webmanifest'), 'utf8'));

test('PWA manifest includes install metadata and valid raster icons', () => {
  assert.equal(manifest.name, 'Daymark | Family tasks');
  assert.equal(manifest.short_name, 'Daymark');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');

  for (const size of [192, 512]) {
    const icon = manifest.icons.find(item => item.sizes === `${size}x${size}`);
    assert.ok(icon, `manifest should include a ${size}x${size} icon`);
    const image = fs.readFileSync(path.join(__dirname, '..', icon.src));
    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(image.readUInt32BE(16), size);
    assert.equal(image.readUInt32BE(20), size);
  }
});
