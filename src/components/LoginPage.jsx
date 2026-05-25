import { useState } from 'react';
import { verifyCloudConnection } from '../db/sheetDb';

export default function LoginPage({ cloudUrl, onSaveUrl, onLogin, onRegister, isAuthenticating, authMessage }) {
  const [mode, setMode] = useState('login');
  const [urlInput, setUrlInput] = useState(cloudUrl || '');
  const [testing, setTesting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState(null);
  const [form, setForm] = useState({
    userName: '',
    password: '',
    confirmPassword: '',
    role: 'Standard'
  });

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleConnect = async () => {
    const nextUrl = urlInput.trim();
    if (!nextUrl) {
      setConnectionMessage({ type: 'error', text: 'Paste your Google Apps Script Web App URL first.' });
      return;
    }

    setTesting(true);
    setConnectionMessage(null);
    const result = await verifyCloudConnection(nextUrl);
    setTesting(false);

    if (result.success) {
      onSaveUrl(nextUrl);
      setConnectionMessage({ type: 'success', text: 'Connected. You can now login or register.' });
    } else {
      setConnectionMessage({ type: 'error', text: result.message || 'Connection failed.' });
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const userName = form.userName.trim();
    const password = form.password;

    if (!userName || !password) return;

    if (mode === 'register') {
      if (password.length < 6) {
        setConnectionMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
        return;
      }

      if (password !== form.confirmPassword) {
        setConnectionMessage({ type: 'error', text: 'Passwords do not match.' });
        return;
      }

      onRegister({ userName, password, role: form.role });
      return;
    }

    onLogin({ userName, password });
  };

  return (
    <main className="login-page">
      <section className="login-shell glass-card">
        <div className="login-brand">
          <span className="login-kicker">Role Based Access</span>
          <h1>TaskUpdate Pro</h1>
          <p>
            Login with a saved account, or register a new team member. Accounts and task updates are stored in your connected Google Sheet.
          </p>
        </div>

        <div className="login-panel">
          <div className="login-section">
            <h2>Google Sheet Connection</h2>
            <div className="url-connect-row">
              <input
                className="input-style"
                type="text"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
              />
              <button className="btn-secondary" type="button" onClick={handleConnect} disabled={testing}>
                {testing ? 'Testing...' : cloudUrl ? 'Reconnect' : 'Connect'}
              </button>
            </div>
            {(connectionMessage || authMessage) && (
              <div className={`login-message ${(authMessage || connectionMessage).type}`}>
                {(authMessage || connectionMessage).text}
              </div>
            )}
          </div>

          <form className="login-section custom-login-form" onSubmit={handleSubmit}>
            <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
              {['login', 'register'].map(nextMode => (
                <button
                  key={nextMode}
                  type="button"
                  className={`auth-tab ${mode === nextMode ? 'active' : ''}`}
                  onClick={() => setMode(nextMode)}
                >
                  {nextMode === 'login' ? 'Login' : 'Register'}
                </button>
              ))}
            </div>

            <div className="form-group">
              <label htmlFor="login-username">USERNAME</label>
              <input
                id="login-username"
                className="input-style"
                type="text"
                placeholder="Enter username"
                value={form.userName}
                onChange={(event) => updateField('userName', event.target.value)}
                maxLength={40}
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">PASSWORD</label>
              <input
                id="login-password"
                className="input-style"
                type="password"
                placeholder="Enter password"
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
            </div>

            {mode === 'register' && (
              <>
                <div className="form-group">
                  <label htmlFor="confirm-password">CONFIRM PASSWORD</label>
                  <input
                    id="confirm-password"
                    className="input-style"
                    type="password"
                    placeholder="Re-enter password"
                    value={form.confirmPassword}
                    onChange={(event) => updateField('confirmPassword', event.target.value)}
                    autoComplete="new-password"
                  />
                </div>

                <div className="role-picker" role="group" aria-label="Choose account role">
                  {['Standard', 'Supreme'].map(role => (
                    <button
                      key={role}
                      type="button"
                      className={`role-choice ${form.role === role ? 'active' : ''} ${role.toLowerCase()}`}
                      onClick={() => updateField('role', role)}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </>
            )}

            <button
              className="btn-primary"
              type="submit"
              disabled={!cloudUrl || !form.userName.trim() || !form.password || isAuthenticating}
            >
              {isAuthenticating ? 'Please wait...' : mode === 'login' ? 'Login to Workspace' : 'Create Account'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
