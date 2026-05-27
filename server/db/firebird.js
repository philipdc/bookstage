const Firebird = require('node-firebird');
const path = require('path');

const defaultDatabasePath = path.join(__dirname, '../../books/4-EN-UK-GENERIC/books.fdb');

// Default connection options — override per company database
const defaultOptions = {
  host:     process.env.FB_HOST     || 'localhost',
  port:     parseInt(process.env.FB_PORT || '3050'),
  database: process.env.FB_DATABASE || defaultDatabasePath,   // path to .fdb file
  user:     process.env.FB_USER     || 'SYSDBA',
  password: process.env.FB_PASSWORD || 'masterkey',
  lowercase_keys: true,
  role: null,
  pageSize: 4096,
};

/**
 * Run a single query against a Firebird database.
 * @param {string} sql
 * @param {any[]}  params
 * @param {object} options  - override defaultOptions (e.g. pass database path)
 */
function query(sql, params = [], options = {}) {
  return new Promise((resolve, reject) => {
    const opts = { ...defaultOptions, ...options };
    Firebird.attach(opts, (err, db) => {
      if (err) return reject(err);
      db.query(sql, params, (err, result) => {
        db.detach();
        if (err) return reject(err);
        resolve(result);
      });
    });
  });
}

/**
 * Fetch chart of accounts from a TurboCASH Firebird database.
 * Adjust the table/column names to match your actual schema.
 */
async function getAccounts(dbPath) {
  const options = dbPath ? { database: dbPath } : {};
  return query(
    `SELECT FIRST 500
        SACCOUNTCODE AS code,
        SDESCRIPTION AS name,
        WACCOUNTTYPEID AS type
     FROM ACCOUNT
     ORDER BY SACCOUNTCODE`,
    [],
    options
  );
}

async function getBankAccounts(dbPath) {
  return tryList(dbPath, [
    `SELECT
        A.SACCOUNTCODE AS code,
        A.SDESCRIPTION AS name,
        A.WACCOUNTTYPEID AS type,
        B.WRECEIPTSID AS receiptsBatchId,
        B.WPAYMENTSID AS paymentsBatchId,
        RB.SDESCRIPTION AS receiptsBatchName,
        PB.SDESCRIPTION AS paymentsBatchName
     FROM BANK B
     JOIN ACCOUNT A ON A.WACCOUNTID = B.WACCOUNTID
     LEFT JOIN BATTYPES RB ON RB.WBATCHTYPEID = B.WRECEIPTSID
     LEFT JOIN BATTYPES PB ON PB.WBATCHTYPEID = B.WPAYMENTSID
     ORDER BY A.SACCOUNTCODE`,
    `SELECT
        A.SACCOUNTCODE AS code,
        A.SDESCRIPTION AS name,
        A.WACCOUNTTYPEID AS type,
        B.WRECEIPTSID AS receiptsBatchId,
        B.WPAYMENTSID AS paymentsBatchId,
        RB.SUIDESCRIPTION AS receiptsBatchName,
        PB.SUIDESCRIPTION AS paymentsBatchName
     FROM BANK B
     JOIN ACCOUNT A ON A.WACCOUNTID = B.WACCOUNTID
     LEFT JOIN BATTYPES RB ON RB.WBATCHTYPEID = B.WRECEIPTSID
     LEFT JOIN BATTYPES PB ON PB.WBATCHTYPEID = B.WPAYMENTSID
     ORDER BY A.SACCOUNTCODE`,
  ]);
}

async function getTaxAccounts(dbPath) {
  return tryList(dbPath, [
    `SELECT FIRST 500
       A.SACCOUNTCODE AS code,
       A.SDESCRIPTION AS name,
       'Tax' AS type
     FROM TAX T
     JOIN ACCOUNT A ON A.WACCOUNTID = T.WACCOUNTID
     ORDER BY A.SACCOUNTCODE`,
    `SELECT FIRST 500
       SACCOUNTCODE AS code,
       SDESCRIPTION AS name,
       'Tax' AS type
     FROM ACCOUNT
     WHERE WACCOUNTTYPEID = 4
     ORDER BY SACCOUNTCODE`,
  ]);
}

async function getCompanyDetails(dbPath) {
  const options = dbPath ? { database: dbPath } : {};
  const rows = await query(
    `SELECT FIRST 1
       SCOMPANYNAME AS name,
       SCOMPANYREGNO AS registrationNumber,
       SADDRESS1 AS address1,
       SADDRESS2 AS address2,
       SADDRESS3 AS address3,
       SPOSTCODE AS postcode,
       SPHONENUMBER AS phone,
       SFAXNUMBER AS fax,
       WNOOFPERIODS AS numberOfPeriods
     FROM SYSVARS`,
    [],
    options
  );

  return rows[0] || {};
}

async function getReportingDates(dbPath) {
  const options = dbPath ? { database: dbPath } : {};
  const rows = await query(
    `SELECT
       MIN(DSTARTDATE) AS startDate,
       MAX(DENDDATE) AS endDate
     FROM PERIODS`,
    [],
    options
  );

  return rows[0] || {};
}

async function tryList(dbPath, queries) {
  const options = dbPath ? { database: dbPath } : {};
  let lastError;

  for (const sql of queries) {
    try {
      return await query(sql, [], options);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('No matching query was available.');
}

async function getDebtors(dbPath) {
  return tryList(dbPath, [
    `SELECT FIRST 1000
       DC.SCODE AS code,
       DC.SDESCRIPTION AS name,
       'Debtor' AS type
     FROM DEBTOR DC
     ORDER BY DC.SCODE`,
    `SELECT FIRST 1000
       SACCOUNTCODE AS code,
       SDESCRIPTION AS name,
       'Debtor' AS type
     FROM ACCOUNT
     WHERE WACCOUNTTYPEID = 1
     ORDER BY SACCOUNTCODE`,
  ]);
}

async function getCreditors(dbPath) {
  return tryList(dbPath, [
    `SELECT FIRST 1000
       CR.SCODE AS code,
       CR.SDESCRIPTION AS name,
       'Creditor' AS type
     FROM CREDITOR CR
     ORDER BY CR.SCODE`,
    `SELECT FIRST 1000
       SACCOUNTCODE AS code,
       SDESCRIPTION AS name,
       'Creditor' AS type
     FROM ACCOUNT
     WHERE WACCOUNTTYPEID = 2
     ORDER BY SACCOUNTCODE`,
  ]);
}

async function getStockItems(dbPath) {
  return tryList(dbPath, [
    `SELECT FIRST 1000
       SSTOCKCODE AS code,
       SDESCRIPTION AS name,
       'Stock' AS type
     FROM STOCK
     ORDER BY SSTOCKCODE`,
  ]);
}

async function getBatchTypes(dbPath) {
  return tryList(dbPath, [
    `SELECT FIRST 200
       WBATCHTYPEID AS id,
       SUIDESCRIPTION AS name
     FROM BATTYPES
     ORDER BY SUIDESCRIPTION`,
    `SELECT FIRST 200
       WBATCHTYPEID AS id,
       SDESCRIPTION AS name
     FROM BATTYPES
     ORDER BY SDESCRIPTION`,
    `SELECT FIRST 200
       WBATCHTYPEID AS id,
       SDESCRIPTION AS name
     FROM BATCHTYPES
     ORDER BY SDESCRIPTION`,
  ]);
}

async function getCompanyName(dbPath) {
  const options = dbPath ? { database: dbPath } : {};
  const queries = [
    `SELECT FIRST 1 SCOMPANYNAME AS name FROM SYSVARS`,
    `SELECT FIRST 1 COMPANYNAME AS name FROM SYSVARS`,
    `SELECT FIRST 1 SCOMPANY AS name FROM SYSVARS`,
    `SELECT FIRST 1 NAME AS name FROM COMPANY`
  ];

  let lastError;

  for (const sql of queries) {
    try {
      const rows = await query(sql, [], options);
      const firstRow = rows && rows[0];
      const name = firstRow && (firstRow.name || firstRow.NAME);

      if (name) {
        return String(name).trim();
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    `Could not read the company name from ${options.database || defaultOptions.database}. ` +
      (lastError ? lastError.message : 'No matching company-name row was found.')
  );
}

module.exports = {
  query,
  getAccounts,
  getBankAccounts,
  getTaxAccounts,
  getCompanyName,
  getCompanyDetails,
  getReportingDates,
  getDebtors,
  getCreditors,
  getStockItems,
  getBatchTypes,
};
