import { useEffect, useState } from 'react';

// In Electron, window.tcAPI is injected by preload.js
// In web mode, this falls back to a REST fetch
async function fetchAccounts() {
  if (window.bookStageAPI) {
    return window.bookStageAPI.getAccounts();
  }
  if (window.tcAPI) {
    return window.tcAPI.getAccounts();
  }
  const res = await fetch('/api/accounts');
  return res.json();
}

export default function Accounts({ embedded = false }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetchAccounts()
      .then(setAccounts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className={embedded ? 'panel wide-panel' : ''}>
      {!embedded && <h2>Chart of Accounts</h2>}
      {loading ? (
        <p className="empty-note">Loading accounts from Firebird...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Type</th>
              <th className="align-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acc) => (
              <tr key={acc.code}>
                <td className="mono">{acc.code}</td>
                <td>{acc.name}</td>
                <td>{acc.type}</td>
                <td className="align-right">{acc.balance ?? '0.00'}</td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-note">
                  No accounts found. Connect a company database to begin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}
