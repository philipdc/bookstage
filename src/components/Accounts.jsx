import { useEffect, useMemo, useState } from 'react';

function getActiveWorkbench() {
  try {
    return JSON.parse(localStorage.getItem('bookstage:active-workbench') || 'null');
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function ActionTile({ title, body, button, disabled, onClick }) {
  return (
    <article className="account-action-tile">
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
      <button type="button" className="primary-button" disabled={disabled} onClick={onClick}>
        {button}
      </button>
    </article>
  );
}

export default function Accounts() {
  const api = window.bookStageAPI || window.tcAPI;
  const [activeWorkbench, setActiveWorkbench] = useState(() => getActiveWorkbench());
  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [status, setStatus] = useState('Open a workbench before importing accounts.');
  const [busy, setBusy] = useState(false);

  const workbenchPath = activeWorkbench?.path || activeWorkbench?.workbenchPath || '';
  const turboPath = activeWorkbench?.turboPath || activeWorkbench?.packet?.turboBooksPath || '';
  const displayName = activeWorkbench?.name || activeWorkbench?.workbench || 'BookStage workbench';
  const hasWorkbench = Boolean(workbenchPath);

  const counts = summary?.counts || {
    total: 0,
    mapped: 0,
    accepted: 0,
    needsReview: 0,
    synced: 0,
  };

  const canUseAccounts = hasWorkbench && api?.initialiseAccountsStore;

  useEffect(() => {
    const latest = getActiveWorkbench();
    setActiveWorkbench(latest);
  }, []);

  useEffect(() => {
    if (!canUseAccounts) return;
    initialise();
  }, [workbenchPath]);

  const recentBatches = useMemo(() => summary?.batches || [], [summary]);

  async function refresh() {
    if (!canUseAccounts) return;
    const [nextSummary, staged] = await Promise.all([
      api.getAccountsSummary(workbenchPath),
      api.listStagedAccounts(workbenchPath),
    ]);
    setSummary(nextSummary);
    setAccounts(staged);
  }

  async function runAction(label, action) {
    if (!canUseAccounts) {
      setStatus('Open a workbench first. Use Open > Open, then return to Edit > Accounts.');
      return;
    }

    setBusy(true);
    setStatus(`${label}...`);
    try {
      const result = await action();
      await refresh();
      setStatus(result?.message || `${label} complete.`);
    } catch (error) {
      setStatus(error.message || String(error));
    } finally {
      setBusy(false);
    }
  }

  async function initialise() {
    await runAction('Preparing accounts database', async () => {
      const nextSummary = await api.initialiseAccountsStore(workbenchPath);
      setSummary(nextSummary);
      const staged = await api.listStagedAccounts(workbenchPath);
      setAccounts(staged);
      return { message: `Accounts database ready: ${nextSummary.dbPath}` };
    });
  }

  async function importTurboCash() {
    await runAction('Importing TurboCASH accounts', async () => {
      const nextSummary = await api.importTurboCashAccounts({
        workbenchPath,
        turboPath,
        displayName,
      });
      setSummary(nextSummary);
      return { message: `Imported ${nextSummary.counts.total} accounts into ${nextSummary.dbPath}` };
    });
  }

  async function exportCsv() {
    await runAction('Exporting account CSV', async () => {
      const result = await api.exportAccountsCsv(workbenchPath);
      return { message: `Exported ${result.rowCount} accounts to ${result.filePath}` };
    });
  }

  async function prepareSync() {
    await runAction('Preparing TurboCASH sync preview', async () => {
      const result = await api.prepareTurboCashSync(workbenchPath);
      return { message: `Prepared ${result.rowCount} account mappings at ${result.filePath}` };
    });
  }

  return (
    <section className="accounts-workbench">
      <div className="accounts-hero panel">
        <div>
          <p className="muted-label">Active workbench</p>
          <h3>{displayName}</h3>
          <p>{workbenchPath || 'No active workbench selected.'}</p>
          <p>TurboCASH source: {turboPath || 'No books.fdb linked.'}</p>
        </div>
        <div className="accounts-db-card">
          <span>SQLite store</span>
          <strong>{summary?.dbPath || 'Not created yet'}</strong>
        </div>
      </div>

      <div className="account-action-grid">
        <ActionTile
          title="Prepare SQLite"
          body="Create the accounts directory, imports, exports, mappings folders, and the BookStage accounts.sqlite schema."
          button="Prepare"
          disabled={busy || !hasWorkbench}
          onClick={initialise}
        />
        <ActionTile
          title="Import"
          body="Read the linked TurboCASH ACCOUNT table and stage it in the readable BookStage accounts schema."
          button="Import TurboCASH"
          disabled={busy || !hasWorkbench || !turboPath}
          onClick={importTurboCash}
        />
        <ActionTile
          title="Export"
          body="Export the staged BookStage accounts to CSV for review or use by another accounting package."
          button="Export CSV"
          disabled={busy || counts.total === 0}
          onClick={exportCsv}
        />
        <ActionTile
          title="Sync"
          body="Create a TurboCASH sync preview. Write-back is disabled until the sync rules are reviewed."
          button="Sync Preview"
          disabled={busy || counts.total === 0}
          onClick={prepareSync}
        />
      </div>

      <section className="account-summary-grid">
        <article className="panel">
          <span>Total accounts</span>
          <strong>{counts.total}</strong>
        </article>
        <article className="panel">
          <span>Mapped to TurboCASH</span>
          <strong>{counts.mapped}</strong>
        </article>
        <article className="panel">
          <span>Needs review</span>
          <strong>{counts.needsReview}</strong>
        </article>
        <article className="panel">
          <span>Synced</span>
          <strong>{counts.synced}</strong>
        </article>
      </section>

      <section className="accounts-main-grid">
        <article className="panel">
          <div className="panel-heading">
            <h3>Staged accounts</h3>
            <button type="button" className="ghost-button" onClick={refresh} disabled={!canUseAccounts || busy}>
              Refresh
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Review</th>
                <th>Sync</th>
              </tr>
            </thead>
            <tbody>
              {accounts.slice(0, 60).map((account) => (
                <tr key={account.id}>
                  <td className="mono">{account.code}</td>
                  <td>{account.name}</td>
                  <td>{account.type}</td>
                  <td>{account.reviewStatus}</td>
                  <td>{account.syncStatus}</td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-note">No staged accounts yet. Use Import to load the current TurboCASH chart of accounts.</td>
                </tr>
              )}
            </tbody>
          </table>
        </article>

        <aside className="panel account-batches">
          <h3>Import batches</h3>
          {recentBatches.map((batch) => (
            <div key={batch.id} className="batch-row">
              <strong>{batch.sourceSystem}</strong>
              <span>{batch.rowCount} rows</span>
              <small>{formatDate(batch.importedAt)}</small>
            </div>
          ))}
          {recentBatches.length === 0 && <p className="empty-note">No import batches recorded.</p>}
          <div className="account-status-line">{status}</div>
        </aside>
      </section>
    </section>
  );
}
