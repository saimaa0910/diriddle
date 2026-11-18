import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adminRoot = path.resolve(__dirname, '..', '..');

describe('Admin Desktop Configuration & Architecture', () => {
  it('has valid Electron preload script with expected IPC endpoints', () => {
    const preloadPath = path.join(adminRoot, 'electron', 'preload.js');
    assert.ok(fs.existsSync(preloadPath), 'preload.js must exist');

    const content = fs.readFileSync(preloadPath, 'utf8');
    assert.match(content, /contextBridge\.exposeInMainWorld\('desktopApi'/);
    assert.match(content, /desktop:notify/);
    assert.match(content, /desktop:setBadge/);
    assert.match(content, /desktop:openExternal/);
    assert.match(content, /desktop:minimize/);
    assert.match(content, /desktop:maximize/);
    assert.match(content, /desktop:close/);
  });

  it('has Electron main process with security hardening', () => {
    const mainPath = path.join(adminRoot, 'electron', 'main.js');
    assert.ok(fs.existsSync(mainPath), 'main.js must exist');

    const content = fs.readFileSync(mainPath, 'utf8');
    assert.match(content, /contextIsolation:\s*true/);
    assert.match(content, /nodeIntegration:\s*false/);
    assert.match(content, /createApplicationMenu/);
    assert.match(content, /createTray/);
    assert.match(content, /setWindowOpenHandler/);
  });

  it('has native application menu with moderation shortcuts', () => {
    const menuPath = path.join(adminRoot, 'electron', 'menu.js');
    assert.ok(fs.existsSync(menuPath), 'menu.js must exist');

    const content = fs.readFileSync(menuPath, 'utf8');
    assert.match(content, /Moderation Reports/);
    assert.match(content, /CmdOrCtrl\+1/);
    assert.match(content, /Pseudonymous Users/);
    assert.match(content, /Staff Audit Logs/);
  });

  it('has desktop scripts configured in package.json', () => {
    const pkgPath = path.join(adminRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    assert.strictEqual(pkg.main, 'electron/main.js');
    assert.ok(pkg.scripts.desktop, 'desktop script must exist');
    assert.ok(pkg.scripts['desktop:dev'], 'desktop:dev script must exist');
    assert.ok(pkg.scripts['desktop:start'], 'desktop:start script must exist');
  });
});
