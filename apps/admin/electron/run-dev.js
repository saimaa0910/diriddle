const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 3001;
const TARGET_URL = `http://127.0.0.1:${PORT}`;

function isReady() {
  return new Promise((resolve) => {
    const req = http.get(TARGET_URL, (res) => resolve(res.statusCode < 500));
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function start() {
  console.log('[desktop:dev] Starting Next.js dev server on port', PORT);

  const nextProcess = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['next', 'dev', '-p', String(PORT)],
    {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, PORT: String(PORT) },
    }
  );

  console.log('[desktop:dev] Waiting for Next.js server to be reachable...');
  while (!(await isReady())) {
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log('[desktop:dev] Next.js ready! Launching Electron...');
  const electronProcess = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['electron', 'electron/main.js'],
    {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, NODE_ENV: 'development', ELECTRON_START_URL: TARGET_URL },
    }
  );

  electronProcess.on('close', () => {
    console.log('[desktop:dev] Electron closed. Shutting down dev server.');
    nextProcess.kill();
    process.exit(0);
  });
}

start().catch((err) => {
  console.error('[desktop:dev] Failed to start:', err);
  process.exit(1);
});
