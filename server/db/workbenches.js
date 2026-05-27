const fs = require('fs');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');
const { getDb } = require('./sqlite');
const { getAccounts, getCompanyDetails, getCompanyName, getReportingDates, getDebtors, getCreditors, getStockItems } = require('./firebird');

function getRuntimeRoot() {
  if (process.versions.electron && process.defaultApp !== true) {
    return process.resourcesPath;
  }

  return path.resolve(__dirname, '../..');
}

const projectRoot = path.resolve(__dirname, '../..');
const runtimeRoot = getRuntimeRoot();
const booksRoot = path.join(runtimeRoot, 'books');
const schemaPath = path.join(runtimeRoot, 'bin', 'docs', 'schema', 'books-schema.md');
const defaultWorkbenchFolders = [
  'Documents',
  path.join('Documents', 'Invoices'),
  path.join('Documents', 'Credit Notes'),
  path.join('Documents', 'Purchases'),
  path.join('Documents', 'Goods Returned Notes'),
  path.join('Documents', 'Quotes'),
  path.join('Documents', 'Orders'),
  'Bank Statements',
  'Tax Returns',
  'Debtors Reconciliations',
  'Creditors Reconciliations',
  'Supporting Documents',
];

function ensureWorkbenchSchema() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS workbench_profiles (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      path          TEXT NOT NULL UNIQUE,
      source_type   TEXT NOT NULL DEFAULT 'local',
      turbo_path    TEXT,
      schema_path   TEXT,
      last_opened_at TEXT
    );

    CREATE TABLE IF NOT EXISTS workbench_open_audit (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      workbench_path  TEXT NOT NULL,
      workbench_name  TEXT NOT NULL,
      user_name       TEXT NOT NULL,
      opened_at       TEXT NOT NULL DEFAULT (datetime('now')),
      turbo_path      TEXT,
      packet_id       INTEGER
    );

    CREATE TABLE IF NOT EXISTS workbench_open_archive (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      workbench_path  TEXT NOT NULL,
      workbench_name  TEXT NOT NULL,
      user_name       TEXT NOT NULL,
      opened_at       TEXT NOT NULL,
      turbo_path      TEXT,
      archived_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workbench_packets (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      workbench_path TEXT NOT NULL,
      packet_type    TEXT NOT NULL,
      packet_json    TEXT NOT NULL,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workbench_purged (
      path       TEXT PRIMARY KEY,
      purged_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function classifyWorkbench(workbenchPath, isAdded = false) {
  if (/^https?:\/\//i.test(workbenchPath)) return 'internet';

  const root = path.parse(workbenchPath).root.toUpperCase();
  const fixedDrive = root === path.parse(projectRoot).root.toUpperCase();

  if (isAdded && !fixedDrive) return 'mapped';
  if (isAdded) return 'external';
  return 'project';
}

function makeWorkbench(directoryPath, isAdded = false, stored = {}) {
  const name = stored.name || path.basename(directoryPath);
  const turboPath = stored.turbo_path || path.join(directoryPath, 'books.fdb');
  const hasTurboBooks = fs.existsSync(turboPath);

  return {
    id: directoryPath,
    name,
    path: directoryPath,
    sourceType: stored.source_type || classifyWorkbench(directoryPath, isAdded),
    turboBooksName: hasTurboBooks ? name : 'No books.fdb linked',
    turboPath: hasTurboBooks ? turboPath : '',
    schemaPath: stored.schema_path || schemaPath,
    hasTurboBooks,
    lastOpenedAt: stored.last_opened_at || '',
  };
}

function listProjectWorkbenches() {
  if (!fs.existsSync(booksRoot)) return [];

  return fs.readdirSync(booksRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => makeWorkbench(path.join(booksRoot, entry.name)));
}

function listAddedWorkbenches() {
  ensureWorkbenchSchema();
  return getDb()
    .prepare('SELECT * FROM workbench_profiles ORDER BY name')
    .all()
    .map((row) => makeWorkbench(row.path, true, row));
}

function getPurgedPaths() {
  ensureWorkbenchSchema();
  return new Set(getDb().prepare('SELECT lower(path) AS path FROM workbench_purged').all().map((row) => row.path));
}

function listWorkbenches() {
  const byPath = new Map();
  const purged = getPurgedPaths();

  for (const workbench of listProjectWorkbenches()) {
    if (!purged.has(workbench.path.toLowerCase())) byPath.set(workbench.path.toLowerCase(), workbench);
  }

  for (const workbench of listAddedWorkbenches()) {
    if (!purged.has(workbench.path.toLowerCase())) byPath.set(workbench.path.toLowerCase(), workbench);
  }

  return Array.from(byPath.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function getRecentWorkbenches() {
  ensureWorkbenchSchema();
  return getDb()
    .prepare('SELECT * FROM workbench_profiles WHERE last_opened_at IS NOT NULL ORDER BY last_opened_at DESC LIMIT 10')
    .all()
    .map((row) => makeWorkbench(row.path, true, row));
}

function archiveOlderAuditRows() {
  ensureWorkbenchSchema();
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM workbench_open_audit ORDER BY opened_at DESC, id DESC LIMIT -1 OFFSET 10')
    .all();

  const archive = db.prepare(`
    INSERT INTO workbench_open_archive (workbench_path, workbench_name, user_name, opened_at, turbo_path)
    VALUES (?, ?, ?, ?, ?)
  `);
  const remove = db.prepare('DELETE FROM workbench_open_audit WHERE id = ?');

  const moveRows = db.transaction((items) => {
    for (const row of items) {
      archive.run(row.workbench_path, row.workbench_name, row.user_name, row.opened_at, row.turbo_path);
      remove.run(row.id);
    }
  });

  if (rows.length > 0) moveRows(rows);
}

function saveProfile(workbench) {
  ensureWorkbenchSchema();
  getDb()
    .prepare(`
      INSERT INTO workbench_profiles (name, path, source_type, turbo_path, schema_path, last_opened_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(path) DO UPDATE SET
        name = excluded.name,
        source_type = excluded.source_type,
        turbo_path = excluded.turbo_path,
        schema_path = excluded.schema_path,
        last_opened_at = datetime('now')
    `)
    .run(
      workbench.name,
      workbench.path,
      workbench.sourceType,
      workbench.turboPath,
      workbench.schemaPath
    );
}

function savePacket(workbenchPath, packetType, packet) {
  ensureWorkbenchSchema();
  const result = getDb()
    .prepare('INSERT INTO workbench_packets (workbench_path, packet_type, packet_json) VALUES (?, ?, ?)')
    .run(workbenchPath, packetType, JSON.stringify(packet));

  return result.lastInsertRowid;
}

function saveAudit(workbench, userName, packetId) {
  ensureWorkbenchSchema();
  getDb()
    .prepare(`
      INSERT INTO workbench_open_audit (workbench_path, workbench_name, user_name, turbo_path, packet_id)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(workbench.path, workbench.name, userName, workbench.turboPath, packetId);
  archiveOlderAuditRows();
}

async function openWorkbench(workbenchPath) {
  const existing = listWorkbenches().find((item) => item.path === workbenchPath);
  const workbench = existing || makeWorkbench(workbenchPath, true);
  const openedAt = new Date().toISOString();
  const currentUser = os.userInfo().username;

  let companyName = 'No TurboCASH books.fdb linked';
  let companyDetails = {};
  let reportingDates = {
    from: 'Not available',
    to: 'Not available',
  };
  let accounts = [];
  let debtors = [];
  let creditors = [];
  let stock = [];
  let warnings = [];
  let openError = '';

  if (workbench.turboPath) {
    try {
      companyName = await getCompanyName(workbench.turboPath);
    } catch (error) {
      openError = `TurboCASH data could not be read from ${workbench.turboPath}. If TurboCASH has the book open exclusively, close it or open it in multi-user/server mode.`;
      warnings.push(`${openError} ${error.message}`);
    }

    try {
      companyDetails = await getCompanyDetails(workbench.turboPath);
      companyName = companyDetails.name || companyName;
    } catch (error) {
      warnings.push(`Company details are not available yet: ${error.message}`);
    }

    try {
      const dates = await getReportingDates(workbench.turboPath);
      reportingDates = {
        from: dates.startdate || dates.startDate || 'Not available',
        to: dates.enddate || dates.endDate || 'Not available',
      };
    } catch (error) {
      warnings.push(`Reporting dates are not available yet: ${error.message}`);
    }

    try {
      accounts = await getAccounts(workbench.turboPath);
    } catch (error) {
      openError ||= `TurboCASH account data could not be retrieved from ${workbench.turboPath}.`;
      warnings.push(`Accounts list is not available yet: ${error.message}`);
    }

    try {
      debtors = await getDebtors(workbench.turboPath);
    } catch (error) {
      warnings.push(`Debtors list is not available yet: ${error.message}`);
    }

    try {
      creditors = await getCreditors(workbench.turboPath);
    } catch (error) {
      warnings.push(`Creditors list is not available yet: ${error.message}`);
    }

    try {
      stock = await getStockItems(workbench.turboPath);
    } catch (error) {
      warnings.push(`Stock list is not available yet: ${error.message}`);
    }
  }

  const packet = {
    workbench: workbench.name,
    workbenchPath: workbench.path,
    turboBooksPath: workbench.turboPath,
    schemaPath: workbench.schemaPath,
    user: currentUser,
    company: {
      name: companyName,
      details: companyDetails,
      reportingDates,
    },
    lists: {
      accounts,
      debtors,
      creditors,
      stock,
    },
    openedAt,
    warnings,
    openError,
  };

  saveProfile({ ...workbench, lastOpenedAt: openedAt });
  const packetId = savePacket(workbench.path, 'open-summary', packet);
  saveAudit(workbench, currentUser, packetId);

  return {
    ...workbench,
    lastOpenedAt: openedAt,
    packet,
  };
}

function purgeWorkbench(workbenchPath) {
  ensureWorkbenchSchema();
  getDb().prepare('INSERT OR REPLACE INTO workbench_purged (path) VALUES (?)').run(workbenchPath);
  getDb().prepare('DELETE FROM workbench_profiles WHERE path = ?').run(workbenchPath);
  return listWorkbenches();
}

function addWorkbenchProfile(workbenchPath) {
  ensureWorkbenchSchema();
  if (!workbenchPath || !fs.existsSync(workbenchPath)) {
    throw new Error('Workbench folder was not found.');
  }

  const workbench = makeWorkbench(workbenchPath, true);
  getDb().prepare('DELETE FROM workbench_purged WHERE path = ?').run(workbenchPath);
  saveProfile(workbench);
  return {
    ...workbench,
    lastOpenedAt: new Date().toISOString(),
  };
}

function createWorkbench({ parentPath, name, turboPath = '' }) {
  ensureWorkbenchSchema();
  const safeName = String(name || '').trim();
  if (!parentPath || !safeName) {
    throw new Error('A parent directory and workbench name are required.');
  }

  const workbenchPath = path.join(parentPath, safeName);
  if (fs.existsSync(workbenchPath)) {
    throw new Error(`Workbench already exists: ${workbenchPath}`);
  }

  fs.mkdirSync(workbenchPath, { recursive: true });
  for (const folder of defaultWorkbenchFolders) {
    fs.mkdirSync(path.join(workbenchPath, folder), { recursive: true });
  }

  const workbenchDb = path.join(workbenchPath, 'workbench.sqlite');
  const db = new Database(workbenchDb);
  db.exec(`
    CREATE TABLE IF NOT EXISTS packets (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      packet_type  TEXT NOT NULL,
      source_path  TEXT,
      json_body    TEXT NOT NULL,
      sha256_hash  TEXT,
      status       TEXT NOT NULL DEFAULT 'new',
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS folders (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_path  TEXT NOT NULL UNIQUE,
      folder_type  TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const insertFolder = db.prepare('INSERT OR IGNORE INTO folders (folder_path, folder_type) VALUES (?, ?)');
  for (const folder of defaultWorkbenchFolders) {
    insertFolder.run(folder, folder.split(path.sep)[0]);
  }
  db.close();

  const workbench = makeWorkbench(workbenchPath, true, {
    name: safeName,
    turbo_path: turboPath,
    schema_path: schemaPath,
  });
  saveProfile(workbench);
  return workbench;
}

function isPathInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function getPreservedBooksPath(workbenchPath) {
  const parent = path.dirname(workbenchPath);
  const baseName = path.basename(workbenchPath);
  let candidate = path.join(parent, `${baseName}-books.fdb`);
  let counter = 2;

  while (fs.existsSync(candidate)) {
    candidate = path.join(parent, `${baseName}-books-${counter}.fdb`);
    counter += 1;
  }

  return candidate;
}

function deleteWorkbench(workbenchPath, options = {}) {
  ensureWorkbenchSchema();
  if (!workbenchPath || !fs.existsSync(workbenchPath)) {
    throw new Error('Workbench folder was not found.');
  }

  const workbench = makeWorkbench(workbenchPath, true);
  const deleteTurboBooks = options.deleteTurboBooks !== false;

  if (!deleteTurboBooks && workbench.turboPath && fs.existsSync(workbench.turboPath) && isPathInside(workbenchPath, workbench.turboPath)) {
    fs.renameSync(workbench.turboPath, getPreservedBooksPath(workbenchPath));
  }

  fs.rmSync(workbenchPath, { recursive: true, force: false });
  getDb().prepare('DELETE FROM workbench_profiles WHERE path = ?').run(workbenchPath);
  return getRecentWorkbenches();
}

module.exports = {
  booksRoot,
  listWorkbenches,
  getRecentWorkbenches,
  openWorkbench,
  purgeWorkbench,
  addWorkbenchProfile,
  createWorkbench,
  deleteWorkbench,
};
