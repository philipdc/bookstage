/**
 * shared/accounting/ledger.js
 * Pure business logic — no database, no UI dependencies.
 * Used by both the Electron main process and the web server.
 */

/**
 * Double-entry validation: debits must equal credits.
 * @param {Array<{accountCode: string, debit: number, credit: number}>} lines
 * @returns {{ valid: boolean, difference: number }}
 */
function validateJournalEntry(lines) {
  const totalDebit  = lines.reduce((sum, l) => sum + (l.debit  || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
  const difference  = Math.round((totalDebit - totalCredit) * 100) / 100;
  return { valid: difference === 0, difference };
}

/**
 * Calculate the running balance for a list of transactions.
 * @param {Array<{debit: number, credit: number}>} transactions
 * @param {number} openingBalance
 * @returns {number}
 */
function runningBalance(transactions, openingBalance = 0) {
  return transactions.reduce((bal, tx) => bal + (tx.debit || 0) - (tx.credit || 0), openingBalance);
}

module.exports = { validateJournalEntry, runningBalance };
