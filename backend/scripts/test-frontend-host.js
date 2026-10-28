const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// The hosting tests do not connect to SQL Server. These values only allow the
// Express/session middleware to be constructed; no credential is used or logged.
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'frontend-host-test-secret-not-for-use';
process.env.DB_SERVER = '127.0.0.1';
process.env.DB_NAME = 'job_viet_test';
process.env.DB_USER = 'frontend_host_test';
process.env.DB_PASSWORD = 'frontend-host-test-password';
process.env.DB_PORT = '1433';
process.env.DB_ENCRYPT = 'false';
process.env.DB_TRUST_CERT = 'true';

const app = require('../src/app');
const frontendRoot = path.resolve(__dirname, '..', '..');

function walkHtml(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkHtml(absolutePath);
    return entry.isFile() && entry.name.toLowerCase().endsWith('.html') ? [absolutePath] : [];
  });
}

function collectLocalReferences(html, pagePath) {
  const references = [];
  const attributePattern = /\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi;
  let match;
  while ((match = attributePattern.exec(html))) {
    const reference = match[2].trim();
    if (!reference || reference.startsWith('#') || reference.includes('${')) continue;
    if (/^(?:https?:|data:|mailto:|tel:|javascript:|blob:)/i.test(reference)) continue;
    const target = new URL(reference, `http://127.0.0.1/${pagePath.replace(/\\/g, '/')}`);
    references.push(`${target.pathname}${target.search}`);
  }
  return references;
}

async function main() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let passed = 0;

  async function expectStatus(pathname, status, contentType = null) {
    let response;
    try {
      response = await fetch(`${baseUrl}${pathname}`);
    } catch (error) {
      throw new Error(`Request ${pathname} failed: ${error.cause?.message || error.message}`);
    }
    assert.equal(response.status, status, `${pathname} should return ${status}`);
    if (contentType) assert.match(response.headers.get('content-type') || '', contentType, `${pathname} content type`);
    return response;
  }

  try {
    for (const page of [
      '/', '/index.html', '/about.html', '/about', '/contact.html', '/auth.html',
      '/jobs', '/job-list.html', '/job-detail.html', '/LabThucHanh.html',
      '/candidate/dashboard.html', '/employer/dashboard.html',
    ]) {
      await expectStatus(page, 200, /text\/html/);
      passed += 1;
    }

    for (const asset of [
      '/css/styles.css', '/css/pages/home.css', '/js/api.js', '/js/db.js',
      '/ico/manifest.json', '/ico/favicon-32x32.png',
    ]) {
      await expectStatus(asset, 200);
      passed += 1;
    }

    const health = await expectStatus('/api/health', 200, /application\/json/);
    assert.deepEqual(await health.json(), { status: 'ok' });
    passed += 1;

    const htmlFiles = [
      ...fs.readdirSync(frontendRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
        .map((entry) => path.join(frontendRoot, entry.name)),
      ...walkHtml(path.join(frontendRoot, 'candidate')),
      ...walkHtml(path.join(frontendRoot, 'employer')),
    ];
    const assetReferences = new Set();
    for (const file of htmlFiles) {
      const relativePage = path.relative(frontendRoot, file);
      const html = fs.readFileSync(file, 'utf8');
      for (const reference of collectLocalReferences(html, relativePage)) assetReferences.add(reference);
    }
    for (const reference of assetReferences) {
      let response;
      try {
        response = await fetch(`${baseUrl}${reference}`);
      } catch (error) {
        throw new Error(`Request local reference ${reference} failed: ${error.cause?.message || error.message}`);
      }
      assert.equal(response.status, 200, `Local frontend link/resource ${reference} should load`);
      passed += 1;
    }

    const privatePaths = [
      '/.env', '/.git/config', '/.vscode/settings.json',
      '/backend/src/server.js', '/backend/src/config/database.js',
      '/backend/sql/001_create_sessions.sql', '/docs/project-audit/README.md',
      '/reports/project_analysis_for_diagrams.md',
      '/node_modules/express/package.json', '/backend/node_modules/express/package.json',
    ];
    for (const privatePath of privatePaths) {
      await expectStatus(privatePath, 404, /application\/json/);
      passed += 1;
    }

    const traversal = await expectStatus('/css/%2e%2e/backend/src/app.js', 404, /application\/json/);
    assert.equal(typeof (await traversal.json()).error, 'string');
    passed += 1;

    console.log(`[frontend-host] PASS: ${passed} checks; ${htmlFiles.length} HTML files and ${assetReferences.size} local references checked.`);
    console.log('[frontend-host] SQL Server was not connected; business API/database integration is outside this test.');
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error('[frontend-host] FAIL:', error.stack || error.message);
  process.exitCode = 1;
});
