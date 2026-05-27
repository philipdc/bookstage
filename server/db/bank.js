const fs = require('fs');
const path = require('path');
const { getDb } = require('./sqlite');

function ensureBankSchema() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS bank_imports (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      workbench_path  TEXT,
      bank_code       TEXT NOT NULL,
      bank_name       TEXT NOT NULL,
      source_path     TEXT NOT NULL,
      source_name     TEXT NOT NULL,
      format          TEXT NOT NULL,
      imported_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bank_import_transactions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      import_id       INTEGER NOT NULL,
      txn_date        TEXT,
      description     TEXT NOT NULL,
      amount          REAL NOT NULL DEFAULT 0,
      balance         REAL NOT NULL DEFAULT 0,
      account_code    TEXT,
      allocation_status TEXT NOT NULL DEFAULT 'needs review',
      FOREIGN KEY (import_id) REFERENCES bank_imports(id)
    );
  `);
}

function splitDelimited(line, delimiter) {
  const cells = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function detectDelimiter(line) {
  const choices = [',', ';', '\t', '|'];
  return choices
    .map((delimiter) => ({ delimiter, count: line.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function parseAmount(value) {
  const cleaned = String(value || '')
    .replace(/[^\d.,()-]/g, '')
    .replace(/\((.*)\)/, '-$1')
    .replace(/,/g, '');

  const number = Number.parseFloat(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function parseOptionalAmount(value) {
  const raw = String(value || '');
  if (!/\d/.test(raw)) return null;
  return parseAmount(raw);
}

function normaliseDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const [, year, month, day] = compact;
    return `${year}-${month}-${day}`;
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);

  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return raw;

  const [, day, month, year] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function getColumnIndex(headers, names, fallback) {
  const lowered = headers.map((header) => header.toLowerCase());
  for (const name of names) {
    const index = lowered.findIndex((header) => header === name || header.includes(name));
    if (index >= 0) return index;
  }
  return fallback;
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  const firstRow = splitDelimited(lines[0], delimiter);
  const hasHeader = firstRow.some((cell) => /date|description|amount|balance|debit|credit/i.test(cell));
  const headers = hasHeader ? firstRow : ['date', 'description', 'amount', 'balance'];
  const rows = hasHeader ? lines.slice(1) : lines;

  const dateIndex = getColumnIndex(headers, ['date', 'posted'], 0);
  const descriptionIndex = getColumnIndex(headers, ['description', 'details', 'memo', 'reference', 'narrative', 'name', 'item title', 'type'], 1);
  const amountIndex = getColumnIndex(headers, ['amount', 'value', 'net', 'gross'], 2);
  const balanceIndex = getColumnIndex(headers, ['balance'], 3);
  const debitIndex = getColumnIndex(headers, ['debit', 'withdrawal'], -1);
  const creditIndex = getColumnIndex(headers, ['credit', 'deposit', 'paid in'], -1);
  const feeIndex = getColumnIndex(headers, ['fee'], -1);
  const paypalNetIndex = getColumnIndex(headers, ['net'], -1);
  const paypalGrossIndex = getColumnIndex(headers, ['gross'], -1);

  let runningBalance = 0;

  return rows.map((line, index) => {
    const cells = splitDelimited(line, delimiter);
    let amount = parseAmount(cells[amountIndex]);

    if (!amount && paypalNetIndex >= 0) amount = parseAmount(cells[paypalNetIndex]);
    if (!amount && paypalGrossIndex >= 0) {
      amount = parseAmount(cells[paypalGrossIndex]) + parseAmount(cells[feeIndex]);
    }
    if (!amount && (debitIndex >= 0 || creditIndex >= 0)) {
      amount = parseAmount(cells[creditIndex]) - parseAmount(cells[debitIndex]);
    }

    const parsedBalance = balanceIndex >= 0 ? parseOptionalAmount(cells[balanceIndex]) : null;
    runningBalance = parsedBalance !== null ? parsedBalance : Number((runningBalance + amount).toFixed(2));

    return {
      id: `import-${index + 1}`,
      date: normaliseDate(cells[dateIndex]),
      description: cells[descriptionIndex] || 'Imported bank transaction',
      amount,
      balance: runningBalance,
    };
  });
}

function getTagValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i'));
  return match ? match[1].trim() : '';
}

function parseOfx(text) {
  return text
    .split(/<STMTTRN>/i)
    .slice(1)
    .map((block, index) => ({
      id: `ofx-${index + 1}`,
      date: normaliseDate(getTagValue(block, 'DTPOSTED').slice(0, 8).replace(/^(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3')),
      description: getTagValue(block, 'NAME') || getTagValue(block, 'MEMO') || 'OFX transaction',
      amount: parseAmount(getTagValue(block, 'TRNAMT')),
      balance: 0,
    }));
}

function parseQif(text) {
  return text
    .split('^')
    .map((block, index) => {
      const lines = block.split(/\r?\n/);
      const getLine = (prefix) => (lines.find((line) => line.startsWith(prefix)) || '').slice(1).trim();
      return {
        id: `qif-${index + 1}`,
        date: normaliseDate(getLine('D')),
        description: getLine('P') || getLine('M') || 'QIF transaction',
        amount: parseAmount(getLine('T')),
        balance: 0,
      };
    })
    .filter((row) => row.date || row.description || row.amount);
}

function parseBankStatement(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('Bank statement file was not found.');
  }

  const extension = path.extname(filePath).toLowerCase();
  const sourceName = path.basename(filePath);

  if (['.pdf', '.png', '.jpg', '.jpeg'].includes(extension)) {
    return {
      sourcePath: filePath,
      sourceName,
      format: extension.slice(1).toUpperCase(),
      warning: 'This file was accepted, but OCR/PDF parsing will be added in a later pass.',
      transactions: [],
    };
  }

  const text = fs.readFileSync(filePath, 'utf8');
  let transactions = [];

  if (['.ofx', '.ofc', '.omc'].includes(extension) || /<OFX|<OFC/i.test(text)) {
    transactions = parseOfx(text);
  } else if (extension === '.qif' || /^!Type:/i.test(text)) {
    transactions = parseQif(text);
  } else {
    transactions = parseCsv(text);
  }

  return {
    sourcePath: filePath,
    sourceName,
    format: extension.slice(1).toUpperCase() || 'TEXT',
    warning: transactions.length === 0 ? 'No transactions were detected in this file.' : '',
    transactions,
  };
}

function listBankTransactions(workbenchPath, bankCode) {
  ensureBankSchema();
  return getDb()
    .prepare(`
      SELECT
        T.id,
        I.source_name AS source,
        T.txn_date AS date,
        T.description,
        T.amount,
        T.balance,
        T.account_code AS accountCode,
        T.allocation_status AS status
      FROM bank_import_transactions T
      JOIN bank_imports I ON I.id = T.import_id
      WHERE I.workbench_path = ? AND I.bank_code = ?
      ORDER BY T.txn_date, T.id
    `)
    .all(workbenchPath || '', bankCode || '')
    .map((transaction) => ({
      ...transaction,
      id: `saved-${transaction.id}`,
      importRef: '',
      taxCode: '',
    }));
}

function saveBankImport(details) {
  ensureBankSchema();
  const db = getDb();
  const parsed = details.parsed || {};
  const transactions = Array.isArray(details.transactions) ? details.transactions : parsed.transactions || [];

  const insertImport = db.prepare(`
    INSERT INTO bank_imports (workbench_path, bank_code, bank_name, source_path, source_name, format)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertTransaction = db.prepare(`
    INSERT INTO bank_import_transactions
      (import_id, txn_date, description, amount, balance, account_code, allocation_status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const save = db.transaction(() => {
    const result = insertImport.run(
      details.workbenchPath || '',
      details.bankCode || '',
      details.bankName || '',
      parsed.sourcePath || details.sourcePath || '',
      parsed.sourceName || path.basename(details.sourcePath || ''),
      parsed.format || 'UNKNOWN'
    );

    for (const transaction of transactions) {
      insertTransaction.run(
        result.lastInsertRowid,
        transaction.date || '',
        transaction.description || 'Imported bank transaction',
        Number(transaction.amount || 0),
        Number(transaction.balance || 0),
        transaction.accountCode || '',
        transaction.status || 'needs review'
      );
    }

    return result.lastInsertRowid;
  });

  return { importId: save(), rowCount: transactions.length };
}

module.exports = { parseBankStatement, saveBankImport, listBankTransactions };
