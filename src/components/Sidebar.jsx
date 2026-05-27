import { NavLink } from 'react-router-dom';
import { navigationGroups } from '../navigation.js';
import bsLogo from '../../bin/images/BSlogo.jpg';

export default function Sidebar({ hidden, onToggle }) {
  return (
    <aside className={`sidebar ${hidden ? 'collapsed' : ''}`}>
      <div className="brand-block">
        <div className="brand-lockup">
          <img src={bsLogo} alt="BookStage logo" />
          {!hidden && (
            <div>
              <h1>BookStage</h1>
              <p>Pre-accounting workbench</p>
            </div>
          )}
        </div>
        <button type="button" className="menu-toggle" onClick={onToggle} aria-label="Hide menu pane">
          {hidden ? '>' : '<'}
        </button>
      </div>
      <nav className="nav-groups" aria-hidden={hidden}>
        {navigationGroups.map((group) => (
          <section key={group.id} className="nav-group">
            <h2>{group.label}</h2>
            {group.items.map(({ path, label }) => (
              <NavLink
                key={path}
                to={path}
                end
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                {label}
              </NavLink>
            ))}
          </section>
        ))}
      </nav>
    </aside>
  );
}
