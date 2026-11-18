const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MOBILE_DIST = path.join(PROJECT_ROOT, 'apps', 'mobile', 'dist');
const ADMIN_OUT = path.join(PROJECT_ROOT, 'apps', 'admin', 'out');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function createStaticServer(rootDir, port, name, isSpa = false) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(rootDir)) {
      console.warn(`[WARN] Directory ${rootDir} not found for ${name}`);
      return resolve(null);
    }

    const server = http.createServer((req, res) => {
      let reqPath = decodeURI(req.url.split('?')[0]);
      if (reqPath === '/') reqPath = '/index.html';

      let filePath = path.join(rootDir, reqPath);

      if (!fs.existsSync(filePath)) {
        if (fs.existsSync(filePath + '.html')) {
          filePath = filePath + '.html';
        } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
          filePath = path.join(filePath, 'index.html');
        } else if (isSpa) {
          filePath = path.join(rootDir, 'index.html');
        } else {
          filePath = path.join(rootDir, '404.html');
        }
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
        res.end(data);
      });
    });

    server.listen(port, '0.0.0.0', () => {
      resolve(server);
    });

    server.on('error', (err) => {
      console.error(`[ERROR] Failed to bind ${name} to port ${port}:`, err.message);
      resolve(null);
    });
  });
}

function startBackendApi() {
  const apiDir = path.join(PROJECT_ROOT, 'apps', 'api');
  const mainJs = path.join(apiDir, 'dist', 'main.js');

  if (fs.existsSync(mainJs)) {
    console.log('[API] Starting NestJS backend from dist/main.js...');
    const proc = spawn('node', ['dist/main.js'], {
      cwd: apiDir,
      stdio: 'inherit',
      env: { ...process.env, PORT: '3000', NODE_ENV: 'production' },
    });
    return proc;
  } else {
    console.log('[API] Starting NestJS backend via pnpm dev...');
    const cmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    const proc = spawn(cmd, ['--filter', '@diriddle/api', 'dev'], {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, PORT: '3000' },
    });
    return proc;
  }
}

async function main() {
  console.log('\n==========================================================');
  console.log('       Hosting diriddle Full Stack Locally for Testing    ');
  console.log('==========================================================\n');

  // 1. Host Mobile Web App on Port 8081
  await createStaticServer(MOBILE_DIST, 8081, 'Mobile App', true);

  // 2. Host Admin Web Portal on Port 3001
  await createStaticServer(ADMIN_OUT, 3001, 'Admin Portal', false);

  console.log('==========================================================');
  console.log('  SERVICES READY:');
  console.log('  • Mobile App Website:     http://localhost:8081');
  console.log('  • Admin Command Center:   http://localhost:3001');
  console.log('  • Backend API & Docs:     http://localhost:3000/v1');
  console.log('==========================================================');
  console.log('  Press Ctrl+C to stop all servers.\n');

  // 3. Start Backend API
  const apiProc = startBackendApi();

  const shutdown = () => {
    console.log('\nShutting down servers...');
    if (apiProc) apiProc.kill();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
