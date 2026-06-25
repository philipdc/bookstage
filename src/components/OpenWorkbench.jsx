import { useEffect, useMemo, useState } from 'react';
import tcLogo from '../../bin/images/tclogo.png';
import openHelp from '../../bin/help/open.md?raw';
import MarkdownRenderer from './MarkdownRenderer.jsx';

const fallbackWorkbenches = [
  {
    id: 'demo-project',
    name: '4-EN-UK-GENERIC',
    path: 'D:\\dev2023\\bookstage\\books\\4-EN-UK-GENERIC',
    sourceType: 'project',
    turboBooksName: '4-EN-UK-GENERIC',
    turboPath: 'D:\\dev2023\\bookstage\\books\\4-EN-UK-GENERIC\\books.fdb',
    schemaPath: 'D:\\dev2023\\bookstage\\bin\\docs\\tcschema\\books-schema.md',
    hasTurboBooks: true,
  },
  {
    id: 'demo-local',
    name: 'HANDY-BANK',
    path: 'C:\\BookStage\\HANDY-BANK',
    sourceType: 'external',
    turboBooksName: 'HANDY-BANK',
    schemaPath: 'D:\\dev2023\\bookstage\\bin\\docs\\tcschema\\books-schema.md',
  },
  {
    id: 'demo-network',
    name: 'NETWORK-CLIENT',
    path: 'Z:\\BookStage\\NETWORK-CLIENT',
    sourceType: 'mapped',
    turboBooksName: 'NETWORK-CLIENT',
    schemaPath: 'D:\\dev2023\\bookstage\\bin\\docs\\tcschema\\books-schema.md',
  },
  {
    id: 'demo-internet',
    name: 'REMOTE-DEMO',
    path: 'https://bookstage.example.com/workbenches/remote-demo',
    sourceType: 'internet',
    turboBooksName: 'REMOTE-DEMO',
    schemaPath: 'Remote schema endpoint',
  },
];

const folders = [
  'Documents',
  'Documents\\invoices',
  'Documents\\credit notes',
  'Documents\\purchases',
  'Documents\\goods returned notes',
  'Documents\\quotes',
  'Documents\\orders',
  'Documents\\BankStatements',
  'Documents\\BankStatements\\{bank account}',
  'Documents\\Supplier statements',
  'Documents\\customer reconciliations',
];

function getDefaultName(folderPath) {
  if (!folderPath) return '';
  return folderPath.split(/[\\/]/).filter(Boolean).pop() || '';
}

function sourceLabel(sourceType) {
  if (sourceType === 'project') return 'books folder';
  if (sourceType === 'external') return 'local PC';
  if (sourceType === 'mapped') return 'network drive';
  if (sourceType === 'internet') return 'internet';
  return 'added';
}

function formatDate(value) {
  if (!value) return 'Not opened yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function CloseButton({ onClick, label }) {
  return (
    <button type="button" className="pane-close" onClick={onClick} aria-label={label}>
      X
    </button>
  );
}

function sortList(items, sortBy) {
  return [...items].sort((a, b) => String(a[sortBy] || '').localeCompare(String(b[sortBy] || ''), undefined, { numeric: true }));
}

function SearchableLookup({ title, items, emptyText }) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('code');
  const filtered = sortList(items || [], sortBy).filter((item) => {
    const term = query.trim().toLowerCase();
    if (!term) return true;
    if (/^\d/.test(term)) return String(item.code || '').toLowerCase().includes(term);
    return String(item.name || '').toLowerCase().includes(term);
  });

  return (
    <div className="lookup-panel">
      <h4>{title}</h4>
      <input
        className="lookup-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search code or description"
      />
      <div className="lookup-grid lookup-heading">
        <button type="button" onClick={() => setSortBy('code')}>Code</button>
        <button type="button" onClick={() => setSortBy('name')}>Description</button>
      </div>
      <div className="lookup-list">
        {filtered.map((item) => (
          <div key={`${item.type || title}-${item.code}-${item.name}`} className="lookup-grid">
            <span>{item.code}</span>
            <strong>{item.name}</strong>
          </div>
        ))}
        {filtered.length === 0 && <p className="empty-note">{emptyText}</p>}
      </div>
    </div>
  );
}

function PaneControls({ mode, setMode, onClose, closeLabel }) {
  return (
    <div className="pane-controls">
      <button type="button" onClick={() => setMode(mode === 'minimized' ? 'normal' : 'minimized')} aria-label="Minimise pane">
        _
      </button>
      <button type="button" onClick={() => setMode(mode === 'fullscreen' ? 'normal' : 'fullscreen')} aria-label="Full screen pane">
        [ ]
      </button>
      <button type="button" onClick={onClose} aria-label={closeLabel}>
        X
      </button>
    </div>
  );
}

function HelpPane({ mode, setMode, onClose }) {
  return (
    <aside className={`side-pane ${mode}`}>
      <PaneControls mode={mode} setMode={setMode} onClose={onClose} closeLabel="Close help" />
      <h3>Open Help</h3>
      {mode !== 'minimized' && (
        <MarkdownRenderer className="help-text">{openHelp}</MarkdownRenderer>
      )}
    </aside>
  );
}

function ChatPane({ selected, mode, setMode, onClose }) {
  return (
    <aside className={`side-pane chat-pane ${mode}`}>
      <PaneControls mode={mode} setMode={setMode} onClose={onClose} closeLabel="Close chat" />
      <h3>Open Chat</h3>
      {mode !== 'minimized' && (
        <>
          <p className="chat-preamble">
            Chat preamble: review this workbench profile and help prepare the opening
            checklist.
          </p>
          <pre>{JSON.stringify(selected, null, 2)}</pre>
          <div className="chat-input">Ask about this workbench...</div>
        </>
      )}
    </aside>
  );
}

function WorkbenchProperties({ workbench, onClose }) {
  if (!workbench) return null;

  return (
    <section className="properties-pane">
      <CloseButton onClick={onClose} label="Close properties" />
      <h3>Workbench properties</h3>
      <dl>
        <dt>Name</dt>
        <dd>{workbench.name}</dd>
        <dt>Source</dt>
        <dd>{sourceLabel(workbench.sourceType)}</dd>
        <dt>Workbench path</dt>
        <dd>{workbench.path}</dd>
        <dt>TurboCASH books</dt>
        <dd>{workbench.turboPath || 'Not linked'}</dd>
        <dt>Schema</dt>
        <dd>{workbench.schemaPath}</dd>
      </dl>
    </section>
  );
}

function AddWorkbenchDialog({ api, onCancel, onCreated, setStatus }) {
  const [parentPath, setParentPath] = useState('');
  const [name, setName] = useState('');
  const [turboPath, setTurboPath] = useState('');

  async function chooseParent() {
    if (!api?.selectDirectory) {
      setStatus('Directory picker is available in Electron mode.');
      return;
    }

    const selected = await api.selectDirectory();
    if (!selected) return;
    setParentPath(selected);
    if (!name) setName(getDefaultName(selected));
  }

  async function chooseTurboBooks() {
    if (!api?.selectDirectory) {
      setStatus('Directory picker is available in Electron mode.');
      return;
    }

    const selected = await api.selectDirectory();
    if (selected) setTurboPath(`${selected}\\books.fdb`);
  }

  async function create() {
    if (!api?.createWorkbench) {
      setStatus('Create workbench is available in Electron mode.');
      return;
    }

    try {
      const workbench = await api.createWorkbench({ parentPath, name, turboPath });
      onCreated(workbench);
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <section className="modal-backdrop">
      <div className="workbench-modal">
        <h3>Add workbench</h3>
        <label>
          Workbench parent folder
          <div className="input-with-button">
            <input value={parentPath} onChange={(event) => setParentPath(event.target.value)} />
            <button type="button" className="ghost-button" onClick={chooseParent}>Browse</button>
          </div>
        </label>
        <label>
          Workbench name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Defaults to the folder name" />
        </label>
        <label>
          TurboCASH books directory
          <div className="input-with-button">
            <input value={turboPath} onChange={(event) => setTurboPath(event.target.value)} placeholder="Optional path to books.fdb" />
            <button type="button" className="ghost-button" onClick={chooseTurboBooks}>Browse</button>
          </div>
        </label>
        <div className="modal-actions">
          <button type="button" className="open-action-button" onClick={create}>Create</button>
          <button type="button" className="ghost-button" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </section>
  );
}

function DeleteWorkbenchDialog({ workbench, onCancel, onConfirmWorkbench, onConfirmTurboBooks }) {
  const [step, setStep] = useState('workbench');
  const hasTurboBooks = Boolean(workbench?.turboPath);

  if (!workbench) return null;

  function confirmWorkbench() {
    if (hasTurboBooks) {
      setStep('turboBooks');
      return;
    }

    onConfirmWorkbench({ deleteTurboBooks: true });
  }

  return (
    <section className="modal-backdrop">
      <div className="workbench-modal delete-modal">
        {step === 'workbench' ? (
          <>
            <h3>Delete workbench?</h3>
            <p>
              This is final. BookStage will delete the workbench folder and its subdirectories.
            </p>
            <p className="delete-target">{workbench.path}</p>
            {hasTurboBooks && (
              <p>
                This workbench is associated with a TurboCASH books.fdb. You will be asked separately whether to delete that file.
              </p>
            )}
            <div className="modal-actions">
              <button type="button" className="danger-button" onClick={confirmWorkbench}>Yes, delete workbench</button>
              <button type="button" className="safe-button" onClick={onCancel}>No, keep it</button>
            </div>
          </>
        ) : (
          <>
            <h3>Delete TurboCASH books.fdb?</h3>
            <p>
              The workbench can be deleted while preserving the TurboCASH books file.
            </p>
            <p className="delete-target">{workbench.turboPath}</p>
            <div className="modal-actions">
              <button type="button" className="danger-button" onClick={() => onConfirmTurboBooks({ deleteTurboBooks: true })}>Yes, delete books.fdb</button>
              <button type="button" className="safe-button" onClick={() => onConfirmTurboBooks({ deleteTurboBooks: false })}>No, keep books.fdb</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function PurgeWorkbenchDialog({ workbench, onCancel, onConfirm }) {
  if (!workbench) return null;

  return (
    <section className="modal-backdrop">
      <div className="workbench-modal delete-modal">
        <h3>Purge workbench?</h3>
        <p>This will only remove the workbench from the active list, files will remain on disk.</p>
        <p className="delete-target">{workbench.path}</p>
        <div className="modal-actions">
          <button type="button" className="safe-button" onClick={onConfirm}>Yes</button>
          <button type="button" className="danger-button" onClick={onCancel}>No</button>
        </div>
      </div>
    </section>
  );
}

function OpenSummary({ opened, onClose }) {
  if (!opened) {
    return (
      <section className="open-main-pane empty-open-pane">
        <h3>Select a workbench</h3>
        <p>Choose a workbench from the list, then click Open or double-click the row.</p>
      </section>
    );
  }

  const packet = opened.packet;

  return (
    <section className="open-main-pane">
      <CloseButton onClick={onClose} label="Close open summary" />
      <div className="panel-heading">
        <div>
          <p className="muted-label">Opened workbench</p>
          <h3>{opened.name}</h3>
        </div>
        <div className="turbocash-badge">
          <img src={tcLogo} alt="TurboCASH logo" />
          <span>TurboCASH books loaded</span>
        </div>
      </div>
      <section className="open-summary-grid">
        <article>
          <span>Company name</span>
          <strong>{packet.company.name}</strong>
        </article>
        <article>
          <span>Reporting dates</span>
          <strong>{formatDate(packet.company.reportingDates.from)} - {formatDate(packet.company.reportingDates.to)}</strong>
        </article>
        <article>
          <span>Last opened</span>
          <strong>{formatDate(packet.openedAt)}</strong>
        </article>
      </section>
      <section className="company-detail-grid">
        <span>Registration: {packet.company.details?.registrationnumber || packet.company.details?.registrationNumber || 'Not set'}</span>
        <span>Phone: {packet.company.details?.phone || 'Not set'}</span>
        <span>Address: {[packet.company.details?.address1, packet.company.details?.address2, packet.company.details?.address3].filter(Boolean).join(', ') || 'Not set'}</span>
      </section>
      <section className="open-list-grid full-lists">
        <SearchableLookup title="Chart of accounts" items={packet.lists.accounts} emptyText="Accounts will appear here." />
        <SearchableLookup title="Debtors" items={packet.lists.debtors} emptyText="Debtors will appear here." />
        <SearchableLookup title="Creditors" items={packet.lists.creditors} emptyText="Creditors will appear here." />
        <SearchableLookup title="Stock" items={packet.lists.stock} emptyText="Stock items will appear here." />
      </section>
      {packet.openError && (
        <div className="warning-box error-box">
          <p>{packet.openError}</p>
        </div>
      )}
      {packet.warnings.length > 0 && (
        <div className="warning-box">
          {packet.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      )}
    </section>
  );
}

export default function OpenWorkbench() {
  const [workbenches, setWorkbenches] = useState(fallbackWorkbenches);
  const [recent, setRecent] = useState([]);
  const [selectedId, setSelectedId] = useState(fallbackWorkbenches[0].id);
  const [opened, setOpened] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [purgeTarget, setPurgeTarget] = useState(null);
  const [helpMode, setHelpMode] = useState('normal');
  const [chatMode, setChatMode] = useState('normal');
  const [status, setStatus] = useState('Ready');

  const api = window.bookStageAPI || window.tcAPI;

  useEffect(() => {
    if (!api?.listWorkbenches) return;

    Promise.all([api.listWorkbenches(), api.getRecentWorkbenches()])
      .then(([items, recentItems]) => {
        if (items.length > 0) {
          setWorkbenches(items);
          setSelectedId(items[0].id);
        }
        setRecent(recentItems);
      })
      .catch((error) => setStatus(error.message));
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
      if (event.key.toLowerCase() === 'o') handleOpen();
      if (event.key.toLowerCase() === 'b') handleBrowse();
      if (event.key.toLowerCase() === 'p') setShowProperties(true);
      if (event.key.toLowerCase() === 'u') setPurgeTarget(selected);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, workbenches, recent]);

  useEffect(() => {
    function openHelpPane() {
      setShowHelp(true);
      setHelpMode('normal');
    }

    function openChatPane() {
      setShowChat(true);
      setChatMode('normal');
    }

    window.addEventListener('bookstage:open-help', openHelpPane);
    window.addEventListener('bookstage:open-chat', openChatPane);

    return () => {
      window.removeEventListener('bookstage:open-help', openHelpPane);
      window.removeEventListener('bookstage:open-chat', openChatPane);
    };
  }, []);

  const selected = useMemo(
    () => workbenches.find((workbench) => workbench.id === selectedId) || recent.find((workbench) => workbench.id === selectedId) || workbenches[0] || recent[0],
    [selectedId, workbenches, recent]
  );

  const visibleWorkbenches = recent.length > 0 ? recent : workbenches;

  async function handleOpen(workbench = selected) {
    if (!workbench) return;
    setStatus(`Opening ${workbench.name}...`);

    if (!api?.openWorkbench) {
      const prototypeResult = {
        ...workbench,
        packet: {
          company: { name: workbench.turboBooksName, reportingDates: { from: 'Prototype', to: 'Prototype' } },
          lists: { accounts: [], debtors: [], creditors: [], stock: [] },
          openedAt: new Date().toISOString(),
          warnings: [],
          user: 'Current Windows user',
        },
      };
      localStorage.setItem('bookstage:active-workbench', JSON.stringify(prototypeResult));
      setOpened(prototypeResult);
      setStatus('Prototype data loaded');
      return;
    }

    try {
      const result = await api.openWorkbench(workbench.path);
      localStorage.setItem('bookstage:active-workbench', JSON.stringify(result));
      setOpened(result);
      const recentItems = await api.getRecentWorkbenches();
      setRecent(recentItems);
      setWorkbenches((items) => [result, ...items.filter((item) => item.id !== result.id)]);
      setStatus(result.packet?.openError || `${result.name} opened`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleBrowse() {
    if (!api?.selectDirectory || !api?.addExistingWorkbench) {
      setStatus('Browse is available in Electron mode.');
      return;
    }

    const selectedPath = await api.selectDirectory();
    if (!selectedPath) return;

    try {
      const existing = [...workbenches, ...recent].find((item) => item.path.toLowerCase() === selectedPath.toLowerCase());
      if (existing) {
        setWorkbenches((items) => [existing, ...items.filter((item) => item.id !== existing.id)]);
        setRecent((items) => [existing, ...items.filter((item) => item.id !== existing.id)].slice(0, 10));
        setSelectedId(existing.id);
        setStatus(`${existing.name} is already active and was moved to the top of the list.`);
        return;
      }

      const workbench = await api.addExistingWorkbench(selectedPath);
      setWorkbenches((items) => [workbench, ...items.filter((item) => item.id !== workbench.id)]);
      setRecent((items) => [workbench, ...items.filter((item) => item.id !== workbench.id)].slice(0, 10));
      setSelectedId(workbench.id);
      setStatus(`${workbench.name} added to the top of the workbench list`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function performPurge() {
    if (!purgeTarget || !api?.purgeWorkbench) return;

    try {
      const items = await api.purgeWorkbench(purgeTarget.path);
      setWorkbenches(items);
      setRecent((current) => current.filter((item) => item.id !== purgeTarget.id));
      setSelectedId((items[0] || fallbackWorkbenches[0]).id);
      setPurgeTarget(null);
      setStatus(`${purgeTarget.name} removed from the active list. Files remain on disk.`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function performDelete(options) {
    if (!selected || !api?.deleteWorkbench) return;

    try {
      const items = await api.deleteWorkbench(selected.path, options);
      setRecent(items);
      setWorkbenches((existing) => existing.filter((item) => item.id !== selected.id));
      setSelectedId((items[0] || workbenches[0] || fallbackWorkbenches[0]).id);
      setDeleteTarget(null);
      setStatus(options.deleteTurboBooks === false ? `${selected.name} deleted; books.fdb preserved` : `${selected.name} deleted`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <div className="open-screen">
      <section className="open-list-panel">
        <div className="open-actions">
          <button type="button" onClick={handleBrowse}>
            <span className="action-icon">B</span>
            Browse
          </button>
          <button type="button" onClick={() => setShowProperties(true)}>
            <span className="action-icon">P</span>
            Properties
          </button>
          <button type="button" onClick={() => setShowAdd(true)}>
            <span className="action-icon">+</span>
            Add
          </button>
          <button type="button" onClick={() => setDeleteTarget(selected)}>
            <span className="action-icon">-</span>
            Delete
          </button>
          <button type="button" onClick={() => setPurgeTarget(selected)}>
            <span className="action-icon">U</span>
            Purge
          </button>
        </div>
        <div className="workbench-table-wrap">
          <table className="workbench-table">
            <thead>
              <tr>
                <th>Name of Workbench</th>
                <th>TurboCASH books</th>
                <th>Last opened</th>
              </tr>
            </thead>
            <tbody>
              {visibleWorkbenches.map((workbench) => (
                <tr
                  key={workbench.id}
                  className={selectedId === workbench.id ? 'selected' : ''}
                  onClick={() => setSelectedId(workbench.id)}
                  onDoubleClick={() => handleOpen(workbench)}
                >
                  <td className={`workbench-name ${workbench.sourceType}`}>
                    {workbench.name}
                  </td>
                  <td>{workbench.turboBooksName}</td>
                  <td>{formatDate(workbench.lastOpenedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label className="auto-open">
          <input type="checkbox" />
          Auto-open when starting BookStage
        </label>
        <div className="open-footer-actions">
          <button type="button" className="open-action-button" onClick={() => handleOpen()}>
            Open (O)
          </button>
          <button type="button" className="ghost-button" onClick={() => setStatus('Open cancelled')}>
            Cancel
          </button>
        </div>
      </section>

      <section className="open-detail-area">
        <div className="recent-strip">
          <strong>Recent workbenches</strong>
          {(recent.length ? recent : workbenches).slice(0, 10).map((item) => (
            <button key={item.id} type="button" onClick={() => setSelectedId(item.id)}>
              {item.name}
            </button>
          ))}
        </div>
        <div className="open-pane-grid">
          <div>
            <OpenSummary opened={opened} onClose={() => setOpened(null)} />
            {showProperties && <WorkbenchProperties workbench={selected} onClose={() => setShowProperties(false)} />}
            <section className="structure-panel">
              <h3>Workbench folder structure</h3>
              <div className="folder-grid">
                {folders.map((folder) => <span key={folder}>{folder}</span>)}
              </div>
            </section>
          </div>
          {showHelp && <HelpPane mode={helpMode} setMode={setHelpMode} onClose={() => setShowHelp(false)} />}
          {showChat && <ChatPane selected={selected} mode={chatMode} setMode={setChatMode} onClose={() => setShowChat(false)} />}
        </div>
        <footer className="persistent-open-status">
          <span>User: {opened?.packet?.user || 'Current Windows user'}</span>
          <span>Workbench: {opened?.name || selected?.name}</span>
          <span>TurboCASH books: {opened?.turboPath || selected?.turboPath || 'Not linked'}</span>
        </footer>
        <p className="open-status-line">{status}</p>
      </section>
      {showAdd && (
        <AddWorkbenchDialog
          api={api}
          setStatus={setStatus}
          onCancel={() => setShowAdd(false)}
          onCreated={(workbench) => {
            setShowAdd(false);
            setWorkbenches((items) => [workbench, ...items.filter((item) => item.id !== workbench.id)]);
            setRecent((items) => [workbench, ...items.filter((item) => item.id !== workbench.id)].slice(0, 10));
            setSelectedId(workbench.id);
            setStatus(`${workbench.name} created`);
          }}
        />
      )}
      {deleteTarget && (
        <DeleteWorkbenchDialog
          workbench={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirmWorkbench={performDelete}
          onConfirmTurboBooks={performDelete}
        />
      )}
      {purgeTarget && (
        <PurgeWorkbenchDialog
          workbench={purgeTarget}
          onCancel={() => setPurgeTarget(null)}
          onConfirm={performPurge}
        />
      )}
    </div>
  );
}
