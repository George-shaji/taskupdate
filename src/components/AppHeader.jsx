export default function AppHeader({ cloudUrl, isSyncing, lastSync, onOpenConfig, onManualSync, currentUser, onLogout }) {
  const getFormattedTime = (dateStr) => {
    if (!dateStr) return 'Never';
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return 'Never';
    }
  };

  return (
    <header className="header-wrapper">
      <div className="logo-section">
        <h1>TaskUpdate Pro</h1>
        <p>Premium Collaborative Task Engine & Synchronizer</p>
      </div>

      <div className="header-actions">
        {/* Dynamic Database Mode Badge */}
        <div className="glass-badge" onClick={onOpenConfig} title="Click to manage database connection">
          <span className={`badge-dot ${cloudUrl ? 'cloud' : 'local'}`}></span>
          <span>{cloudUrl ? 'Sheet Sync: Connected' : 'Database: Local Demo'}</span>
        </div>

        {cloudUrl && (
          <button 
            className="glass-badge" 
            onClick={onManualSync} 
            disabled={isSyncing}
            style={{ cursor: isSyncing ? 'not-allowed' : 'pointer' }}
            title="Trigger real-time cloud database fetch"
          >
            <svg 
              className={isSyncing ? 'sync-spin' : ''} 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            <span>{isSyncing ? 'Syncing...' : `Synced: ${getFormattedTime(lastSync)}`}</span>
          </button>
        )}

        <div className="session-actions">
          <div className="session-chip" title={`${currentUser.role} workspace`}>
            <span className={`role-badge ${currentUser.role === 'Supreme' ? 'supreme' : 'standard'}`}></span>
            <span className="session-copy">
              <strong>{currentUser.name}</strong>
              <small>{currentUser.role} User</small>
            </span>
          </div>

          <button className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={onOpenConfig}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.25rem' }}>
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            Setup Sync
          </button>

          <button className="btn-secondary logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
