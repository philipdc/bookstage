import Accounts from './Accounts.jsx';
import BankWorkbench from './BankWorkbench.jsx';
import OpenWorkbench from './OpenWorkbench.jsx';
import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import localLeverArchImage from '../../bin/images/levearchfiles.jpg';

const bookStageHomeUrl = 'https://www.turbocash.net/a/pages/bookstage/index.html';
const leverArchMessageImage = 'https://www.turbocash.net/a/pages/bookstage/images/leverarchfiles.jpg';

function Header({ route }) {
  const isOpenScreen = route.screen === 'openWorkbench';
  const isBankScreen = route.screen === 'bank';
  const isStartScreen = route.screen === 'start';

  return (
    <header className="page-header">
      <div>
        <p className="breadcrumbs">
          <NavLink to="/">BookStage</NavLink>
          <span> / {route.group} / {route.label}</span>
        </p>
        <h2>{route.label}</h2>
      </div>
      <div className="header-actions">
        {isStartScreen ? null : isOpenScreen ? (
          <>
            <button type="button" className="ghost-button" onClick={() => window.dispatchEvent(new Event('bookstage:open-help'))}>
              Help
            </button>
            <button type="button" className="primary-button" onClick={() => window.dispatchEvent(new Event('bookstage:open-chat'))}>
              Open Chat
            </button>
          </>
        ) : isBankScreen ? (
          <>
            <button type="button" className="ghost-button" onClick={() => window.dispatchEvent(new Event('bookstage:bank-help'))}>
              Help
            </button>
            <button type="button" className="primary-button" onClick={() => window.dispatchEvent(new Event('bookstage:bank-chat'))}>
              Chat
            </button>
          </>
        ) : (
          <>
            <button type="button" className="ghost-button">Preview</button>
            <button type="button" className="primary-button">New</button>
          </>
        )}
      </div>
    </header>
  );
}

function StartScreen() {
  const api = window.bookStageAPI || window.tcAPI;

  function openBookStageHome(event) {
    event.preventDefault();
    if (api?.openExternal) {
      api.openExternal(bookStageHomeUrl);
      return;
    }
    window.open(bookStageHomeUrl, '_blank', 'noopener');
  }

  return (
    <section className="start-message">
      <a href={bookStageHomeUrl} onClick={openBookStageHome} title="Open BookStage messages in your browser">
        <img src={leverArchMessageImage} alt="BookStage lever arch files" onError={(event) => { event.currentTarget.src = localLeverArchImage; }} />
      </a>
    </section>
  );
}

function DocumentScreen() {
  return (
    <section className="panel wide-panel">
      <div className="panel-heading">
        <h3>Document preparation</h3>
        <button type="button" className="primary-button">Add source</button>
      </div>
      <div className="kanban">
        {['Imported', 'Extracted', 'Needs review', 'Ready to post'].map((column) => (
          <div key={column} className="kanban-column">
            <strong>{column}</strong>
            <div className="stub-card"></div>
            <div className="stub-card short"></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BankScreen() {
  return (
    <section className="panel wide-panel">
      <div className="panel-heading">
        <h3>Bank reconciliation</h3>
        <div className="segmented">
          <button type="button">Import</button>
          <button type="button" className="active">Match</button>
          <button type="button">Export</button>
        </div>
      </div>
      <div className="reconcile-grid">
        <div className="bank-list">
          {['Bank feed row', 'Imported payment', 'Card settlement', 'Supplier debit'].map((label) => (
            <div key={label} className="list-row">
              <span>{label}</span>
              <strong>R 0.00</strong>
            </div>
          ))}
        </div>
        <div className="match-panel">
          <h3>Suggested match</h3>
          <p>Future matching logic will connect source rows to debtor, creditor, account, and batch entries.</p>
          <button type="button" className="primary-button full-width">Accept match</button>
        </div>
      </div>
    </section>
  );
}

function SettingsScreen() {
  return (
    <section className="settings-grid">
      {['Profile', 'Languages', 'Themes', 'Plugins'].map((title) => (
        <article key={title} className="panel">
          <h3>{title}</h3>
          <div className="form-line"></div>
          <div className="form-line medium"></div>
          <button type="button" className="ghost-button">Configure</button>
        </article>
      ))}
    </section>
  );
}

function PluginScreen() {
  return (
    <section className="panel wide-panel">
      <div className="panel-heading">
        <h3>Plugin library</h3>
        <button type="button" className="primary-button">Install plugin</button>
      </div>
      <div className="plugin-grid">
        {['ChatGPT assistant', 'TurboCASH ETL', 'Bookspace Web', 'OCR capture'].map((name) => (
          <article key={name} className="plugin-card">
            <strong>{name}</strong>
            <p>Under construction</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function HelpLibraryScreen() {
  const api = window.bookStageAPI || window.tcAPI;
  const [docs, setDocs] = useState([]);
  const [selected, setSelected] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('Loading help documents...');

  useEffect(() => {
    if (!api?.listHelpDocs) {
      setStatus('Help documents are available in Electron mode.');
      return;
    }

    api.listHelpDocs()
      .then((items) => {
        setDocs(items);
        setStatus(items.length ? 'Choose a help document.' : 'No Markdown help files were found.');
      })
      .catch((error) => setStatus(error.message));
  }, []);

  async function openDoc(name) {
    if (!api?.readHelpDoc) return;
    try {
      const text = await api.readHelpDoc(name);
      setSelected(name);
      setBody(text);
      setStatus(name);
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <section className="help-library">
      <aside className="panel help-doc-list">
        <h3>Help</h3>
        {docs.map((doc) => (
          <button key={doc.name} type="button" className={selected === doc.name ? 'active' : ''} onClick={() => openDoc(doc.name)}>
            {doc.title}
          </button>
        ))}
      </aside>
      <article className="panel help-doc-viewer">
        {body && (
          <button type="button" className="pane-close" onClick={() => { setSelected(''); setBody(''); setStatus('Choose a help document.'); }} aria-label="Close help document">
            X
          </button>
        )}
        <p className="muted-label">{status}</p>
        {body ? <pre className="help-markdown">{body}</pre> : <p className="empty-note">Select a Markdown help file from the list.</p>}
      </article>
    </section>
  );
}

function UnderConstruction({ route }) {
  return (
    <section className="panel under-construction">
      <h3>{route.label}</h3>
      <p>This screen is part of the BookStage framework and will be developed in a later functionality pass.</p>
      <div className="wireframe">
        <span></span><span></span><span></span>
      </div>
    </section>
  );
}

export default function ScreenPage({ route }) {
  let body;

  if (route.screen === 'openWorkbench') body = <OpenWorkbench />;
  else if (route.screen === 'helpLibrary') body = <HelpLibraryScreen />;
  else if (route.screen === 'start') body = <StartScreen />;
  else if (route.screen === 'accounts') body = <Accounts embedded />;
  else if (['documents', 'documentImport', 'batchEntry', 'batchLoad'].includes(route.screen)) body = <DocumentScreen />;
  else if (route.screen === 'bank') body = <BankWorkbench />;
  else if (['profile', 'languages', 'themes', 'pluginSettings'].includes(route.screen)) body = <SettingsScreen />;
  else if (route.screen === 'plugins') body = <PluginScreen />;
  else body = <UnderConstruction route={route} />;

  return (
    <>
      <Header route={route} />
      {body}
    </>
  );
}
