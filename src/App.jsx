import { Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import ScreenPage from './components/ScreenPage.jsx';
import { routes } from './navigation.js';
import filesSplash from '../bin/images/files.png';

export default function App() {
  const [menuHidden, setMenuHidden] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 1600);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      {showSplash && (
        <div className="app-splash" aria-label="BookStage starting">
          <img src={filesSplash} alt="" />
        </div>
      )}
      <div className={`app-shell ${menuHidden ? 'menu-hidden' : ''}`}>
        <Sidebar hidden={menuHidden} onToggle={() => setMenuHidden((value) => !value)} />
        <main className="content-area">
          <Routes>
            {routes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={<ScreenPage route={route} />}
              />
            ))}
          </Routes>
        </main>
      </div>
    </>
  );
}
