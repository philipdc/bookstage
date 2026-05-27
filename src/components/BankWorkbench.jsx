import { useEffect, useMemo, useRef, useState } from 'react';
import absaLogo from '../../bin/images/banklogos/absa.png';
import capitecLogo from '../../bin/images/banklogos/Capitec.png';
import fnbLogo from '../../bin/images/banklogos/fnb-logo-black-border-1500.jpg';
import investecLogo from '../../bin/images/banklogos/investec.png';
import nedbankLogo from '../../bin/images/banklogos/nedbank-logo-clipart.png';
import otherBankLogo from '../../bin/images/banklogos/otherbank.png';
import paypalLogo from '../../bin/images/banklogos/PayPal-Logo-PNG-Free-Image.png';
import standardBankLogo from '../../bin/images/banklogos/standard-bank-logo-standard-bank-logo.png';
import bankHelp from '../../bin/help/bank.odt?url';

const api = window.bookStageAPI || window.tcAPI;

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

const bankLogos = [
  { id: 'standard', label: 'Standard Bank', src: standardBankLogo },
  { id: 'fnb', label: 'FNB', src: fnbLogo },
  { id: 'absa', label: 'ABSA', src: absaLogo },
  { id: 'capitec', label: 'Capitec', src: capitecLogo },
  { id: 'nedbank', label: 'Nedbank', src: nedbankLogo },
  { id: 'investec', label: 'Investec', src: investecLogo },
  { id: 'paypal', label: 'PayPal', src: paypalLogo },
  { id: 'other', label: 'Other bank', src: otherBankLogo },
];

const fallbackBanks = [
  { code: '810000', name: 'Current account', type: 'Bank' },
  { code: '820000', name: 'Cash', type: 'Bank' },
  { code: '830000', name: 'PayPal', type: 'Bank' },
  { code: '840000', name: 'Credit card', type: 'Bank' },
];

const fallbackAllocationAccounts = [
  { code: '200000', name: 'Sales', type: 'Account' },
  { code: '305000', name: 'Bank charges', type: 'Account' },
  { code: '400000', name: 'Rent expense', type: 'Account' },
  { code: '500100', name: 'Office supplies', type: 'Account' },
  { code: 'D0001', name: 'Demo debtor', type: 'Debtor' },
  { code: 'C0001', name: 'Demo creditor', type: 'Creditor' },
];

const openingTransactions = [
  { id: 'hist-1', importRef: 'A00001', date: '2026-05-09', description: 'Monthly bank fee', amount: -89.5, balance: 12450.72, accountCode: '305000', status: 'allocated' },
  { id: 'hist-2', importRef: 'A00002', date: '2026-05-10', description: 'Client receipt ACME', amount: 2400, balance: 14850.72, accountCode: 'D0001', status: 'allocated' },
  { id: 'hist-3', importRef: 'A00003', date: '2026-05-11', description: 'Office supplies card', amount: -312.45, balance: 14538.27, accountCode: '500100', status: 'allocated' },
  { id: 'hist-4', importRef: 'A00004', date: '2026-05-12', description: 'Unknown EFT payment', amount: -750, balance: 13788.27, accountCode: '', status: 'needs review' },
];

function readActiveWorkbench() {
  const active = readJsonStorage('bookstage:active-workbench', null);
  if (active?.path) return active;
  return { name: 'No workbench opened', path: '', turboPath: '' };
}

function money(value) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(Number(value || 0));
}

function bankFolderName(bankName) {
  const lowerName = String(bankName || '').toLowerCase();
  if (lowerName.includes('paypal')) return 'paypal';
  if (lowerName.includes('absa')) return 'absa';
  if (lowerName.includes('nedbank')) return 'nedbank';
  if (lowerName.includes('fnb') || lowerName.includes('first national')) return 'firstnational';
  if (lowerName.includes('cash')) return 'cash';
  if (lowerName.includes('credit')) return 'creditcard';
  return lowerName.replace(/[^a-z0-9]+/g, '').slice(0, 32) || 'current';
}

function makeSetup(bankCode, bankName, workbenchPath = '') {
  return {
    batchType: 'BANK-CB',
    startDate: '2026-05-01',
    openingBalance: '0.00',
    icon: bankName.toLowerCase().includes('paypal') ? 'paypal' : 'standard',
    incomingFolder: workbenchPath ? `${workbenchPath}\\Bank Statements\\${bankFolderName(bankName)}` : `..\\Bank Statements\\${bankFolderName(bankName)}`,
    bankCode,
  };
}

function transactionKey(transaction) {
  return [
    transaction.date,
    String(transaction.description || '').trim().toLowerCase(),
    Number(transaction.amount || 0).toFixed(2),
    Number(transaction.balance || 0).toFixed(2),
  ].join('|');
}

function makeImportPrefix(importIndex) {
  const zeroBased = Math.max(0, importIndex - 1);
  const letter = String.fromCharCode(65 + Math.floor(zeroBased / 99));
  const number = String((zeroBased % 99) + 1).padStart(2, '0');
  return `${letter}${number}`;
}

function applyImportRefs(transactions, prefix) {
  return transactions.map((transaction, index) => ({
    ...transaction,
    importRef: `${prefix}${String(index + 1).padStart(3, '0')}`,
  }));
}

function autoAllocate(transaction, allocationAccounts, history) {
  const text = transaction.description.toLowerCase();
  const learned = history.find((item) => item.accountCode && text.includes(item.description.toLowerCase().split(' ')[0]));
  if (learned) return learned.accountCode;
  if (text.includes('fee') || text.includes('charge')) return '305000';
  if (text.includes('supplies') || text.includes('stationery')) return '500100';
  if (text.includes('rent')) return '400000';
  if (text.includes('receipt') || text.includes('client')) return 'D0001';
  return allocationAccounts.some((account) => account.code === transaction.accountCode) ? transaction.accountCode : '';
}

function accountTitle(code, accounts) {
  const account = accounts.find((item) => item.code === code);
  return account ? `${account.code} - ${account.name} (${account.type})` : 'Empty';
}

function sortAccounts(accounts, sort) {
  const direction = sort.direction === 'desc' ? -1 : 1;
  return [...accounts].sort((left, right) => {
    const leftValue = String(left[sort.field] || '').toLowerCase();
    const rightValue = String(right[sort.field] || '').toLowerCase();
    return leftValue.localeCompare(rightValue, undefined, { numeric: true }) * direction;
  });
}

function AccountLookup({ value, accounts, onChange, placeholder = 'Empty', storageKey = 'bookstage:account-lookup-sort' }) {
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState(() => readJsonStorage(storageKey, { field: 'code', direction: 'asc' }));
  const [activeIndex, setActiveIndex] = useState(0);
  const bodyRef = useRef(null);
  const emptyRow = { code: '', name: placeholder, type: 'Empty' };
  const rows = useMemo(() => [emptyRow, ...sortAccounts(accounts, sort)], [accounts, sort, placeholder]);
  const selected = accounts.find((account) => account.code === value);
  const activeRow = rows[activeIndex] || rows[0];

  useEffect(() => {
    if (!open || !bodyRef.current) return;
    const activeElement = bodyRef.current.querySelector(`[data-lookup-index="${activeIndex}"]`);
    activeElement?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function toggleSort(field) {
    setSort((current) => ({
      field,
      direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(sort));
  }, [sort, storageKey]);

  function moveToMatch(key) {
    const field = /^[0-9]$/.test(key) ? 'code' : /^[a-z]$/i.test(key) ? 'name' : '';
    if (!field) return false;
    const index = rows.findIndex((row, rowIndex) => rowIndex > 0 && String(row[field] || '').toLowerCase().startsWith(key.toLowerCase()));
    if (index >= 0) {
      setActiveIndex(index);
      setOpen(true);
      return true;
    }
    return false;
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.max(0, Math.min(rows.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (open) {
        onChange(activeRow.code);
        setOpen(false);
      } else {
        setOpen(true);
      }
      return;
    }
    if (event.key.length === 1 && moveToMatch(event.key)) {
      event.preventDefault();
    }
  }

  return (
    <div className="account-lookup" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <button
        type="button"
        className="lookup-trigger"
        title={accountTitle(value, accounts)}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
      >
        <span>{selected ? selected.code : 'Empty'}</span>
        <small>{selected ? selected.name : placeholder}</small>
      </button>
      {open && (
        <div className="account-lookup-popup" tabIndex={-1}>
          <div className="lookup-table-head">
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => toggleSort('code')}>
              Code <span className="sort-triangle">{sort.field === 'code' && sort.direction === 'desc' ? '▲' : '▼'}</span>
            </button>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => toggleSort('name')}>
              Description <span className="sort-triangle">{sort.field === 'name' && sort.direction === 'desc' ? '▲' : '▼'}</span>
            </button>
          </div>
          <div className="lookup-table-body" ref={bodyRef}>
            {rows.map((row, index) => (
              <button
                key={`${row.type}-${row.code || 'empty'}-${index}`}
                type="button"
                data-lookup-index={index}
                className={`lookup-table-row ${index === activeIndex ? 'active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { onChange(row.code); setOpen(false); }}
              >
                <span>{row.code || 'T'}</span>
                <span>{row.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function normaliseBatchId(value) {
  return value === undefined || value === null ? '' : String(value);
}

function formatTurboDate(dateText) {
  if (!dateText || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return dateText || '';
  const [year, month, day] = dateText.split('-');
  return `${day}/${month}/${year}`;
}

function parentDirectory(filePath) {
  const parts = String(filePath || '').replace(/\//g, '\\').split('\\');
  parts.pop();
  return parts.join('\\');
}

function sameDirectory(left, right) {
  const clean = (value) => String(value || '').replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
  return clean(left) === clean(right);
}

function makeTurboCashImportText(transactions, bankCode) {
  return transactions.map((transaction) => {
    const amount = Number(transaction.amount || 0);
    const allocatedAccount = transaction.accountCode || '';
    const debitAccount = amount >= 0 ? bankCode || '' : allocatedAccount;
    const creditAccount = amount >= 0 ? allocatedAccount : bankCode || '';
    const exportAmount = amount >= 0 ? -Math.abs(amount) : Math.abs(amount);

    return [
      transaction.importRef || '',
      formatTurboDate(transaction.date),
      transaction.description || '',
      debitAccount,
      creditAccount,
      transaction.taxCode || 'T',
      exportAmount.toFixed(2),
      'False',
      'Empty',
      'Empty',
    ].join('\t');
  }).join('\r\n');
}

function Pane({ title, onClose, children }) {
  const [minimized, setMinimized] = useState(false);
  return (
    <aside className={`panel bank-side-pane ${minimized ? 'minimized' : ''}`}>
      <div className="pane-controls">
        <button type="button" onClick={() => setMinimized((value) => !value)} aria-label="Minimise pane">-</button>
        <button type="button" onClick={onClose} aria-label="Close pane">X</button>
      </div>
      <h3>{title}</h3>
      {!minimized && children}
    </aside>
  );
}

function SetupModal({ setup, selectedBank, batchChoices, onChooseFolder, onSave, onCancel }) {
  const [draft, setDraft] = useState(setup);
  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    if (batchChoices.length === 0) return;
    if (batchChoices.some((batch) => batch.name === draft.batchType)) return;
    setDraft((current) => ({ ...current, batchType: batchChoices[0].name }));
  }, [batchChoices, draft.batchType]);

  return (
    <section className="modal-backdrop">
      <div className="bank-modal">
        <h3>Bank setup</h3>
        <p className="modal-subtitle">{selectedBank.code} - {selectedBank.name}</p>
        <div className="bank-form-grid">
          <label>Bank account<input value={`${selectedBank.code} - ${selectedBank.name}`} readOnly /></label>
          <label>Input Batch
            <select value={draft.batchType} onChange={(event) => update('batchType', event.target.value)}>
              {batchChoices.map((batch) => <option key={`${batch.id}-${batch.name}`} value={batch.name}>{batch.name}</option>)}
            </select>
          </label>
          <label>Starting date<input type="date" value={draft.startDate} onChange={(event) => update('startDate', event.target.value)} /></label>
          <label>Opening balance<input value={draft.openingBalance} onChange={(event) => update('openingBalance', event.target.value)} /></label>
          <label>Incoming statements folder
            <div className="input-with-button">
              <input value={draft.incomingFolder} onChange={(event) => update('incomingFolder', event.target.value)} />
              <button
                type="button"
                className="ghost-button"
                onClick={async () => {
                  const folder = await onChooseFolder(draft.incomingFolder);
                  if (folder) update('incomingFolder', folder);
                }}
              >
                Browse
              </button>
            </div>
          </label>
        </div>
        <h4>Bank icon</h4>
        <div className="bank-logo-picker">
          {bankLogos.map((logo) => (
            <button key={logo.id} type="button" className={draft.icon === logo.id ? 'selected' : ''} onClick={() => update('icon', logo.id)} title={logo.label}>
              <img src={logo.src} alt="" />
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={() => onSave(draft)}>Save setup</button>
          <button type="button" className="ghost-button" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </section>
  );
}

function ImportModal({ setup, parsed, filePath, status, importPrefix, duplicateCount, onPrefixChange, onBrowse, onParse, onImport, onImportNewOnly, onCancel }) {
  return (
    <section className="modal-backdrop">
      <div className="bank-modal import-modal">
        <h3>Import bank statement</h3>
        <p className="modal-subtitle">Default folder: {setup.incomingFolder}</p>
        <div className="bank-form-grid">
          <label>Import reference prefix<input value={importPrefix} onChange={(event) => onPrefixChange(event.target.value.toUpperCase().slice(0, 3))} /></label>
          <label>File<div className="input-with-button"><input value={filePath} readOnly placeholder="Choose a bank statement file" /><button type="button" className="ghost-button" onClick={onBrowse}>Browse</button></div></label>
        </div>
        <div className="modal-actions left-actions">
          <button type="button" className="primary-button" onClick={onParse} disabled={!filePath}>Open</button>
          <button type="button" className="ghost-button" onClick={onCancel}>Cancel</button>
        </div>
        {status && <p className="open-status-line">{status}</p>}
        {duplicateCount > 0 && (
          <p className="warning-note">{duplicateCount} duplicate transaction(s) detected. You can import only new rows.</p>
        )}
        {parsed && (
          <>
            {parsed.warning && <p className="warning-note">{parsed.warning}</p>}
            <div className="bank-preview-wrap">
              <table className="bank-grid">
                <thead><tr><th>Ref</th><th>Date</th><th>Description</th><th>Amount</th><th>Balance</th></tr></thead>
                <tbody>
                  {parsed.transactions.map((transaction) => (
                    <tr key={transaction.id} className={transaction.isDuplicate ? 'duplicate-row' : ''}>
                      <td><input className="ref-input" value={transaction.importRef} onChange={(event) => { transaction.importRef = event.target.value; onPrefixChange(importPrefix); }} /></td>
                      <td>{transaction.date}</td>
                      <td>{transaction.description}</td>
                      <td className="align-right">{money(transaction.amount)}</td>
                      <td className="align-right">{money(transaction.balance)}</td>
                    </tr>
                  ))}
                  {parsed.transactions.length === 0 && <tr><td colSpan={5} className="empty-note">No preview rows available yet.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <button type="button" className="safe-button" onClick={() => onImport(false)} disabled={parsed.transactions.length === 0}>Import all</button>
              {duplicateCount > 0 && <button type="button" className="safe-button" onClick={onImportNewOnly}>Import new only</button>}
              <button type="button" className="danger-button" onClick={onCancel}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function ConfirmModal({ title, message, yesLabel = 'Yes', noLabel = 'No', yesClass = 'safe-button', noClass = 'danger-button', onYes, onNo }) {
  return (
    <section className="modal-backdrop">
      <div className="workbench-modal delete-modal">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className={yesClass} onClick={onYes}>{yesLabel}</button>
          <button type="button" className={noClass} onClick={onNo}>{noLabel}</button>
        </div>
      </div>
    </section>
  );
}

function NoticeModal({ title, message, onClose }) {
  return (
    <section className="modal-backdrop">
      <div className="workbench-modal">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onClose}>OK</button>
        </div>
      </div>
    </section>
  );
}

function LoadModal({ count, batchTypes, selectedBatch, onSelectBatch, onExport, onDirect, onNo }) {
  return (
    <section className="modal-backdrop">
      <div className="workbench-modal">
        <h3>Load bank batch</h3>
        <p>Do you want to load {count} transactions into TurboCASH?</p>
        <label className="bank-select-label">
          Input Batch
          <select value={selectedBatch} onChange={(event) => onSelectBatch(event.target.value)}>
            {batchTypes.map((batch) => <option key={`${batch.id}-${batch.name}`} value={batch.name}>{batch.name}</option>)}
          </select>
        </label>
        <div className="modal-actions">
          <button type="button" className="safe-button" onClick={onExport}>Save tab file</button>
          <button type="button" className="primary-button" onClick={onDirect}>Direct to Input Batch</button>
          <button type="button" className="danger-button" onClick={onNo}>No</button>
        </div>
      </div>
    </section>
  );
}

export default function BankWorkbench() {
  const [workbench, setWorkbench] = useState(() => readActiveWorkbench());
  const [bankAccounts, setBankAccounts] = useState([]);
  const [allocationAccounts, setAllocationAccounts] = useState(fallbackAllocationAccounts);
  const [taxAccounts, setTaxAccounts] = useState([]);
  const [selectedBankCode, setSelectedBankCode] = useState(() => localStorage.getItem('bookstage:last-bank-code') || '');
  const [setupByBank, setSetupByBank] = useState(() => readJsonStorage('bookstage:bank-setup:v2', {}));
  const [filters, setFilters] = useState(() => readJsonStorage('bookstage:bank-filters', { begin: '', end: '' }));
  const [transactions, setTransactions] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [balanceErrors, setBalanceErrors] = useState([]);
  const [showSetup, setShowSetup] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showDeleteFinalAll, setShowDeleteFinalAll] = useState(false);
  const [showLoadConfirm, setShowLoadConfirm] = useState(false);
  const [loadResultMessage, setLoadResultMessage] = useState('');
  const [dragging, setDragging] = useState(false);
  const [importFile, setImportFile] = useState('');
  const [parsedImport, setParsedImport] = useState(null);
  const [importPrefix, setImportPrefix] = useState(() => makeImportPrefix(Number(localStorage.getItem('bookstage:bank-import-index') || '1')));
  const [batchTypes, setBatchTypes] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [status, setStatus] = useState('Bank workbench ready');

  useEffect(() => {
    const active = readActiveWorkbench();
    if (active?.path) setWorkbench(active);
  }, []);

  useEffect(() => {
    localStorage.setItem('bookstage:bank-filters', JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    localStorage.setItem('bookstage:bank-setup:v2', JSON.stringify(setupByBank));
  }, [setupByBank]);

  useEffect(() => {
    function openHelpPane() { setShowHelp(true); }
    function openChatPane() { setShowChat(true); }
    window.addEventListener('bookstage:bank-help', openHelpPane);
    window.addEventListener('bookstage:bank-chat', openChatPane);
    return () => {
      window.removeEventListener('bookstage:bank-help', openHelpPane);
      window.removeEventListener('bookstage:bank-chat', openChatPane);
    };
  }, []);

  useEffect(() => {
    if (!workbench?.turboPath && !workbench?.packet?.turboBooksPath) {
      setBankAccounts([]);
      setTransactions([]);
      setStatus('Open a workbench first, then return to Bank.');
      return;
    }

    const turboPath = workbench.turboPath || workbench.packet?.turboBooksPath;
    setTransactions([]);
    setSelectedRows([]);
    setBalanceErrors([]);

    if (!api?.getAccounts) return;
    api.getAccounts(turboPath)
      .then((accounts) => {
        if (!Array.isArray(accounts) || accounts.length === 0) return;
        const normalised = accounts.map((account) => ({ code: account.code, name: account.name, type: account.type || 'Account' }));
        setAllocationAccounts([...normalised, ...fallbackAllocationAccounts]);
      })
      .catch(() => setStatus('Using prototype account lists until the TurboCASH account query is finalised.'));

    if (api?.getBankAccounts) {
      api.getBankAccounts(turboPath)
        .then((banks) => {
          const normalisedBanks = Array.isArray(banks) ? banks.map((bank) => ({
            code: bank.code,
            name: bank.name,
            type: 'Bank',
            receiptsBatchId: bank.receiptsbatchid || bank.receiptsBatchId,
            paymentsBatchId: bank.paymentsbatchid || bank.paymentsBatchId,
            receiptsBatchName: bank.receiptsbatchname || bank.receiptsBatchName,
            paymentsBatchName: bank.paymentsbatchname || bank.paymentsBatchName,
          })) : [];
          setBankAccounts(normalisedBanks);
          if (normalisedBanks.length > 0 && !normalisedBanks.some((bank) => bank.code === selectedBankCode)) {
            setSelectedBankCode(normalisedBanks[0].code);
            localStorage.setItem('bookstage:last-bank-code', normalisedBanks[0].code);
          }
          if (normalisedBanks.length === 0) setStatus('No TurboCASH BANK accounts were found for this workbench.');
        })
        .catch((error) => {
          setBankAccounts([]);
          setStatus(`Could not load BANK accounts from TurboCASH: ${error.message}`);
        });
    } else {
      setBankAccounts(fallbackBanks);
    }

    if (api?.getTaxAccounts) {
      api.getTaxAccounts(turboPath)
        .then((accounts) => {
          const normalised = Array.isArray(accounts)
            ? accounts.map((account) => ({ code: account.code, name: account.name, type: 'Tax' })).filter((account) => account.code)
            : [];
          setTaxAccounts(normalised);
        })
        .catch(() => setTaxAccounts([]));
    }

    if (api?.getBatchTypes) {
      api.getBatchTypes(turboPath)
        .then((items) => {
          if (items?.length) {
            const normalisedItems = items.map((item) => ({ id: item.id, name: item.name }));
            setBatchTypes(normalisedItems);
            setSelectedBatch(items[0].name);
          }
        })
        .catch(() => {});
    }
  }, [workbench.path, workbench.turboPath, workbench.packet?.turboBooksPath]);

  const selectedBank = useMemo(() => bankAccounts.find((bank) => bank.code === selectedBankCode) || bankAccounts[0] || { code: '', name: 'No bank account', type: 'Bank' }, [bankAccounts, selectedBankCode]);
  const orderedBanks = useMemo(() => {
    const last = bankAccounts.find((bank) => bank.code === selectedBankCode);
    return last ? [last, ...bankAccounts.filter((bank) => bank.code !== selectedBankCode)] : bankAccounts;
  }, [bankAccounts, selectedBankCode]);
  const setupKey = `${workbench.path}|${selectedBank.code}`;
  const setup = setupByBank[setupKey] || makeSetup(selectedBank.code, selectedBank.name, workbench.path);
  const selectedLogo = bankLogos.find((logo) => logo.id === setup.icon) || bankLogos[0];
  const effectiveBatchTypes = useMemo(
    () => batchTypes.length ? batchTypes : [{ id: '1', name: setup.batchType }, { id: '2', name: `${setup.batchType}-ALT` }],
    [batchTypes, setup.batchType]
  );
  const bankBatchChoices = useMemo(() => {
    const bankBatchIds = [selectedBank.receiptsBatchId, selectedBank.paymentsBatchId].map(normaliseBatchId).filter(Boolean);
    const bankSpecific = effectiveBatchTypes.filter((batch) => bankBatchIds.includes(normaliseBatchId(batch.id)));
    const namedBankBatches = [
      { id: selectedBank.receiptsBatchId || 'receipts', name: selectedBank.receiptsBatchName },
      { id: selectedBank.paymentsBatchId || 'payments', name: selectedBank.paymentsBatchName },
    ].filter((batch, index, list) => batch.name && list.findIndex((item) => item.name === batch.name) === index);
    return namedBankBatches.length ? namedBankBatches : bankSpecific.length ? bankSpecific : effectiveBatchTypes;
  }, [effectiveBatchTypes, selectedBank.receiptsBatchId, selectedBank.receiptsBatchName, selectedBank.paymentsBatchId, selectedBank.paymentsBatchName]);
  const loadBatch = selectedBatch || setup.batchType || bankBatchChoices[0]?.name || '';

  useEffect(() => {
    if (bankBatchChoices.length === 0) return;
    if (bankBatchChoices.some((batch) => batch.name === selectedBatch)) return;
    const savedBatch = bankBatchChoices.find((batch) => batch.name === setup.batchType);
    setSelectedBatch((savedBatch || bankBatchChoices[0]).name);
  }, [bankBatchChoices, selectedBatch, setup.batchType]);

  useEffect(() => {
    setTransactions([]);
    setSelectedRows([]);
    setLastSelectedIndex(null);
    setBalanceErrors([]);

    if (!api?.listBankTransactions || !workbench.path || !selectedBank.code) {
      return;
    }

    api.listBankTransactions(workbench.path, selectedBank.code)
      .then((rows) => {
        const savedRows = Array.isArray(rows) ? rows : [];
        setTransactions(savedRows);
        setStatus(savedRows.length
          ? `${savedRows.length} saved transaction(s) loaded for ${selectedBank.name}.`
          : `${selectedBank.name} is ready. No saved transactions for this bank yet.`);
      })
      .catch((error) => {
        setStatus(`Could not refresh transactions for ${selectedBank.name}: ${error.message}`);
      });
  }, [workbench.path, selectedBank.code]);

  const filteredTransactions = transactions.filter((transaction) => {
    if (filters.begin && transaction.date < filters.begin) return false;
    if (filters.end && transaction.date > filters.end) return false;
    return true;
  });
  const duplicateCount = parsedImport?.transactions.filter((transaction) => transaction.isDuplicate).length || 0;
  const loadRows = useMemo(() => {
    const selected = new Set(selectedRows);
    return selected.size
      ? transactions.filter((transaction) => selected.has(transaction.id))
      : filteredTransactions;
  }, [filteredTransactions, selectedRows, transactions]);

  function selectBank(code) {
    setSelectedBankCode(code);
    localStorage.setItem('bookstage:last-bank-code', code);
    setTransactions([]);
    setSelectedRows([]);
    setParsedImport(null);
    setImportFile('');
    setStatus('Refreshing bank transactions...');
  }

  function selectRow(id, index, event = {}) {
    if (event.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      setSelectedRows(filteredTransactions.slice(start, end + 1).map((row) => row.id));
    } else if (event.ctrlKey) {
      setSelectedRows((current) => current.includes(id) ? current.filter((rowId) => rowId !== id) : [...current, id]);
      setLastSelectedIndex(index);
    } else {
      setSelectedRows([id]);
      setLastSelectedIndex(index);
    }
  }

  function handleGridKey(event) {
    if (filteredTransactions.length === 0) return;
    const currentIndex = Math.max(0, filteredTransactions.findIndex((row) => row.id === selectedRows[selectedRows.length - 1]));
    const keyMoves = { Home: 0, End: filteredTransactions.length - 1, PageUp: Math.max(0, currentIndex - 20), PageDown: Math.min(filteredTransactions.length - 1, currentIndex + 20) };
    if (event.key in keyMoves) {
      event.preventDefault();
      const row = filteredTransactions[keyMoves[event.key]];
      selectRow(row.id, keyMoves[event.key], { shiftKey: event.shiftKey });
    }
    if (event.key === 'Delete') {
      setShowDeleteConfirm(true);
    }
  }

  function addTransaction() {
    const last = transactions[transactions.length - 1];
    const next = {
      id: `manual-${Date.now()}`,
      importRef: 'MANUAL',
      date: last?.date || setup.startDate,
      description: 'Manual bank transaction',
      amount: 0,
      balance: last?.balance || Number(setup.openingBalance || 0),
      accountCode: '',
      taxCode: '',
      status: 'manual',
    };
    setTransactions((current) => [...current, next]);
    setStatus('Manual transaction added.');
  }

  function deleteSelected() {
    setTransactions((current) => current.filter((transaction) => !selectedRows.includes(transaction.id)));
    setSelectedRows([]);
    setShowDeleteConfirm(false);
    setStatus('Selected transactions deleted from the staging list.');
  }

  function requestDelete() {
    if (selectedRows.length === 0) {
      setShowDeleteAllConfirm(true);
      return;
    }
    setShowDeleteConfirm(true);
  }

  function deleteAllVisible() {
    const visibleIds = new Set(filteredTransactions.map((transaction) => transaction.id));
    setTransactions((current) => current.filter((transaction) => !visibleIds.has(transaction.id)));
    setSelectedRows([]);
    setShowDeleteAllConfirm(false);
    setShowDeleteFinalAll(false);
    setStatus('All visible transactions were deleted from the staging list.');
  }

  function checkBalances() {
    let previous = Number(setup.openingBalance || 0);
    const errors = [];
    for (const transaction of transactions) {
      const expected = Number((previous + Number(transaction.amount || 0)).toFixed(2));
      const actual = Number(Number(transaction.balance || 0).toFixed(2));
      if (Math.abs(expected - actual) > 0.01) errors.push(transaction.id);
      previous = actual;
    }
    setBalanceErrors(errors);
    setStatus(errors.length ? `${errors.length} balance mismatch row(s) highlighted.` : 'Balance check passed.');
  }

  async function browseStatement() {
    if (!api?.selectBankStatement) {
      setStatus('File picker is available in Electron mode.');
      return;
    }
    const selected = await api.selectBankStatement(setup.incomingFolder);
    if (selected) {
      setImportFile(selected);
      setParsedImport(null);
      const selectedFolder = parentDirectory(selected);
      if (setup.incomingFolder && !sameDirectory(selectedFolder, setup.incomingFolder)) {
        setStatus(`Warning: this file is from ${selectedFolder}, not the default import folder ${setup.incomingFolder}.`);
      }
    }
  }

  async function chooseImportFolder() {
    if (!api?.selectDirectory) {
      setStatus('Folder picker is available in Electron mode.');
      return '';
    }
    const folder = await api.selectDirectory();
    return folder || '';
  }

  async function parseStatement() {
    if (!api?.parseBankStatement) {
      setStatus('Statement parsing is available in Electron mode.');
      return;
    }
    try {
      const parsed = await api.parseBankStatement(importFile);
      const existing = new Set(transactions.map(transactionKey));
      const referenced = applyImportRefs(parsed.transactions, importPrefix).map((transaction) => ({
        ...transaction,
        isDuplicate: existing.has(transactionKey(transaction)),
      }));
      setParsedImport({ ...parsed, transactions: referenced });
      setStatus(`${referenced.length} transaction rows parsed from ${parsed.sourceName}`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function importTransactions(newOnly) {
    if (!parsedImport) return;
    const sourceRows = newOnly ? parsedImport.transactions.filter((transaction) => !transaction.isDuplicate) : parsedImport.transactions;
    const imported = sourceRows.map((transaction, index) => {
      const accountCode = autoAllocate(transaction, allocationAccounts, transactions);
      return {
        ...transaction,
        id: `${Date.now()}-${index}`,
        source: parsedImport.sourceName,
        accountCode,
        taxCode: transaction.taxCode || '',
        status: accountCode ? 'auto allocated' : 'needs review',
      };
    });

    if (api?.saveBankImport) {
      try {
        await api.saveBankImport({ workbenchPath: workbench.path, bankCode: selectedBank.code, bankName: selectedBank.name, parsed: parsedImport, transactions: imported });
      } catch (error) {
        setStatus(`Imported into the grid, but SQLite save failed: ${error.message}`);
      }
    }

    const nextIndex = Number(localStorage.getItem('bookstage:bank-import-index') || '1') + 1;
    localStorage.setItem('bookstage:bank-import-index', String(nextIndex));
    setImportPrefix(makeImportPrefix(nextIndex));
    setTransactions((current) => [...current, ...imported]);
    setShowImport(false);
    setParsedImport(null);
    setImportFile('');
    setStatus(`${imported.length} transaction(s) imported.`);
  }

  function updateTransaction(id, field, value) {
    setTransactions((current) => current.map((transaction) => transaction.id === id ? { ...transaction, [field]: value } : transaction));
  }

  function toggleAllVisible(checked) {
    setSelectedRows(checked ? filteredTransactions.map((transaction) => transaction.id) : []);
  }

  function toggleOne(id, checked) {
    setSelectedRows((current) => checked ? [...new Set([...current, id])] : current.filter((rowId) => rowId !== id));
  }

  function updateTransactionAccount(id, accountCode) {
    setTransactions((current) => current.map((transaction) => (
      transaction.id === id ? { ...transaction, accountCode, status: accountCode ? 'manual allocation' : 'needs review' } : transaction
    )));
  }

  function updateTransactionTax(id, taxCode) {
    setTransactions((current) => current.map((transaction) => (
      transaction.id === id ? { ...transaction, taxCode } : transaction
    )));
  }

  function loadToBatch() {
    setShowLoadConfirm(true);
    setStatus(`${loadRows.length} transaction(s) selected for TurboCASH batch confirmation.`);
  }

  async function exportTabDelimitedBatch() {
    const rows = loadRows;
    const exportText = makeTurboCashImportText(rows, selectedBank.code);
    const defaultName = `${workbench.name || 'bookstage'}-${selectedBank.code || 'bank'}-import.csv`.replace(/[\\/:*?"<>|]/g, '-');

    if (!api?.saveBankExport) {
      setStatus('Save dialog is available in Electron mode.');
      return;
    }

    try {
      const filePath = await api.saveBankExport(defaultName, exportText);
      setShowLoadConfirm(false);
      setStatus(filePath ? `${rows.length} transaction(s) saved to ${filePath}.` : 'Bank export cancelled.');
    } catch (error) {
      setStatus(`Bank export failed: ${error.message}`);
    }
  }

  function loadDirectToInputBatch() {
    setShowLoadConfirm(false);
    const message = `${loadRows.length} transaction(s) queued for TurboCASH Input Batch "${loadBatch}". Direct Firebird insertion is staged for validation and will not post transactions directly.`;
    setStatus(message);
    setLoadResultMessage(message);
  }

  const readyCount = loadRows.length;

  return (
    <section className="bank-workbench">
      <div className="bank-toolbar panel">
        <div className="bank-title-block">
          <img src={selectedLogo.src} alt="" />
          <div>
            <p className="muted-label">Current workbench</p>
            <h3>{workbench.name}</h3>
            <span>{workbench.path}</span>
          </div>
        </div>
        <label className="bank-select-label">
          Bank account
          <select value={selectedBank.code} onChange={(event) => selectBank(event.target.value)}>
            {orderedBanks.map((bank) => <option key={bank.code} value={bank.code}>{bank.code} - {bank.name}</option>)}
          </select>
        </label>
        <div className="bank-command-strip">
          <button type="button" className="ghost-button" onClick={() => setShowSetup(true)}>Setup</button>
          <button type="button" className="primary-button" onClick={() => setShowImport(true)}>Import</button>
          <button type="button" className="ghost-button" onClick={addTransaction}>Add</button>
          <button type="button" className="danger-button" onClick={requestDelete}>Delete</button>
          <button type="button" className="ghost-button" onClick={checkBalances}>Check</button>
          <button type="button" className="safe-button" onClick={loadToBatch}>Load</button>
        </div>
      </div>

      <section className="panel bank-filter-strip">
        <strong>Opening balance {money(setup.openingBalance)} on {setup.startDate}</strong>
        <label>Begin date<input type="date" value={filters.begin} onChange={(event) => setFilters((current) => ({ ...current, begin: event.target.value }))} /></label>
        <label>End date<input type="date" value={filters.end} onChange={(event) => setFilters((current) => ({ ...current, end: event.target.value }))} /></label>
      </section>

      <div className="bank-layout">
        <section className="panel bank-main-panel">
          <div className="panel-heading">
            <div>
              <h3>{selectedBank.name} bank statement replication</h3>
              <p className="muted-label">Input Batch: {loadBatch} | Incoming: {setup.incomingFolder}</p>
            </div>
            <span className="status-pill">{filteredTransactions.length} visible / {transactions.length} rows</span>
          </div>
          <div className="bank-grid-wrap" tabIndex={0} onKeyDown={handleGridKey}>
            <table className="bank-grid">
              <thead>
                <tr>
                  <th className="select-square-cell">
                    <input
                      type="checkbox"
                      aria-label="Select all visible transactions"
                      checked={filteredTransactions.length > 0 && filteredTransactions.every((transaction) => selectedRows.includes(transaction.id))}
                      onChange={(event) => toggleAllVisible(event.target.checked)}
                    />
                  </th>
                  <th>Ref</th><th>Date</th><th>Description</th><th>Amount</th><th>Balance</th><th>Account allocation</th><th>Tax</th><th>Status</th>
                </tr>
              </thead>
              <tbody onMouseLeave={() => setDragging(false)}>
                {filteredTransactions.map((transaction, index) => (
                  <tr
                    key={transaction.id}
                    className={`${selectedRows.includes(transaction.id) ? 'selected-bank-row' : ''} ${balanceErrors.includes(transaction.id) ? 'balance-error-row' : ''}`}
                    onMouseDown={(event) => { setDragging(true); selectRow(transaction.id, index, event); }}
                    onMouseEnter={() => { if (dragging) setSelectedRows((current) => current.includes(transaction.id) ? current : [...current, transaction.id]); }}
                    onMouseUp={() => setDragging(false)}
                    onContextMenu={(event) => { event.preventDefault(); setSelectedRows([transaction.id]); setLastSelectedIndex(index); setShowDeleteConfirm(true); }}
                  >
                    <td className="select-square-cell">
                      <input
                        type="checkbox"
                        aria-label={`Select ${transaction.description}`}
                        checked={selectedRows.includes(transaction.id)}
                        onChange={(event) => toggleOne(transaction.id, event.target.checked)}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </td>
                    <td><input className="ref-input" value={transaction.importRef || ''} onChange={(event) => updateTransaction(transaction.id, 'importRef', event.target.value)} /></td>
                    <td><input className="date-cell-input" type="date" value={transaction.date} onChange={(event) => updateTransaction(transaction.id, 'date', event.target.value)} /></td>
                    <td>{transaction.description}</td>
                    <td className="align-right">{money(transaction.amount)}</td>
                    <td className="align-right">{money(transaction.balance)}</td>
                    <td>
                      <AccountLookup value={transaction.accountCode} accounts={allocationAccounts} storageKey="bookstage:allocation-lookup-sort" onChange={(accountCode) => updateTransactionAccount(transaction.id, accountCode)} />
                    </td>
                    <td>
                      <AccountLookup value={transaction.taxCode || ''} accounts={taxAccounts} storageKey="bookstage:tax-lookup-sort" onChange={(taxCode) => updateTransactionTax(transaction.id, taxCode)} />
                    </td>
                    <td><span className={`allocation-status ${transaction.accountCode ? 'ok' : 'empty'}`}>{transaction.status}</span></td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={9} className="empty-note">
                      No bank transactions are loaded for this workbench and filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {(showHelp || showChat) && (
          <div className="bank-side-stack">
            {showHelp && (
              <Pane title="Bank Help" onClose={() => setShowHelp(false)}>
                <p>Bank processing manages imported statement rows before they are loaded into TurboCASH cash book batches.</p>
                <p><a href={bankHelp}>Open bank help document</a></p>
              </Pane>
            )}
            {showChat && (
              <Pane title="Bank Chat" onClose={() => setShowChat(false)}>
                <p>Chat context: review this bank account, imported rows, allocation confidence, and batch loading readiness.</p>
                <pre>{JSON.stringify({ workbench: workbench.name, bank: selectedBank, rows: transactions.length, selectedRows }, null, 2)}</pre>
              </Pane>
            )}
          </div>
        )}
      </div>

      <p className="open-status-line">{status}</p>

      {showSetup && <SetupModal setup={setup} selectedBank={selectedBank} batchChoices={bankBatchChoices} onChooseFolder={chooseImportFolder} onCancel={() => setShowSetup(false)} onSave={(draft) => { setSetupByBank((current) => ({ ...current, [setupKey]: draft })); setSelectedBatch(draft.batchType); setShowSetup(false); setStatus(`${selectedBank.name} setup saved.`); }} />}
      {showImport && <ImportModal setup={setup} filePath={importFile} parsed={parsedImport} status={status} importPrefix={importPrefix} duplicateCount={duplicateCount} onPrefixChange={setImportPrefix} onBrowse={browseStatement} onParse={parseStatement} onImport={importTransactions} onImportNewOnly={() => importTransactions(true)} onCancel={() => { setShowImport(false); setParsedImport(null); setImportFile(''); }} />}
      {showDeleteConfirm && <ConfirmModal title="Delete transactions?" message={`Do you want to delete ${selectedRows.length} selected transaction(s)?`} onYes={deleteSelected} onNo={() => setShowDeleteConfirm(false)} />}
      {showDeleteAllConfirm && <ConfirmModal title="Delete all visible transactions?" message={`No transactions are selected. Do you want to delete all ${filteredTransactions.length} visible transaction(s)?`} onYes={() => { setShowDeleteAllConfirm(false); setShowDeleteFinalAll(true); setSelectedRows(filteredTransactions.map((transaction) => transaction.id)); }} onNo={() => setShowDeleteAllConfirm(false)} />}
      {showDeleteFinalAll && <ConfirmModal title="Are you sure?" message="This will delete every transaction currently visible in the filter." yesClass="danger-button" noClass="safe-button" onYes={deleteAllVisible} onNo={() => setShowDeleteFinalAll(false)} />}
      {showLoadConfirm && <LoadModal count={readyCount} batchTypes={bankBatchChoices} selectedBatch={loadBatch} onSelectBatch={setSelectedBatch} onExport={exportTabDelimitedBatch} onDirect={loadDirectToInputBatch} onNo={() => setShowLoadConfirm(false)} />}
      {loadResultMessage && <NoticeModal title="Input Batch load" message={loadResultMessage} onClose={() => setLoadResultMessage('')} />}
    </section>
  );
}
