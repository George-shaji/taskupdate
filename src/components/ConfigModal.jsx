import { useState } from 'react';
import { verifyCloudConnection } from '../db/sheetDb';

const APPS_SCRIPT_CODE = `// Google Apps Script - TaskUpdate Pro Backend (v3 with Login Users)
const TASK_HEADERS = ['id', 'projectName', 'heading', 'details', 'timeTaken', 'importLevel', 'status', 'dueDate', 'attachmentUrl', 'userName', 'createdAt', 'updatedAt'];
const USER_HEADERS = ['id', 'userName', 'passwordHash', 'salt', 'role', 'createdAt', 'updatedAt'];
const ELEVATED_ROLE_SECRET = 'blackvenom';

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getTaskSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const namedSheet = ss.getSheetByName('Tasks');
  if (namedSheet) return namedSheet;

  const fallback = ss.getSheets().find(sheet => sheet.getName() !== 'Users');
  return fallback || ss.insertSheet('Tasks');
}

function getUserSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName('Users') || ss.insertSheet('Users');
}

function ensureHeaders(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return headers;
  }

  const width = Math.max(sheet.getLastColumn(), headers.length);
  const currentHeaders = sheet.getRange(1, 1, 1, width).getValues()[0].filter(String);
  headers.forEach(header => {
    if (currentHeaders.indexOf(header) === -1) {
      sheet.getRange(1, currentHeaders.length + 1).setValue(header);
      currentHeaders.push(header);
    }
  });
  return currentHeaders;
}

function rowsToObjects(sheet, headers) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return rows.map(row => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });
    return item;
  });
}

function appendObjectRow(sheet, headers, data) {
  const rowData = headers.map(header => data[header] !== undefined ? data[header] : '');
  sheet.appendRow(rowData);
}

function hashPassword(password, salt) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + ':' + salt,
    Utilities.Charset.UTF_8
  );
  return digest.map(byte => {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function publicUser(row, headers) {
  return {
    id: row[headers.indexOf('id')],
    userName: row[headers.indexOf('userName')],
    role: row[headers.indexOf('role')] || 'Standard'
  };
}

function doGet(e) {
  try {
    const sheet = getTaskSheet();
    const headers = ensureHeaders(sheet, TASK_HEADERS);
    const data = rowsToObjects(sheet, headers);
    return jsonResponse({ status: "success", data: data });
  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;

    if (action === 'registerUser') {
      const userSheet = getUserSheet();
      const userHeaders = ensureHeaders(userSheet, USER_HEADERS);
      const userName = String(postData.userName || '').trim();
      const password = String(postData.password || '');
      const role = ['Standard', 'Manager', 'Supreme'].indexOf(postData.role) >= 0 ? postData.role : 'Standard';
      const roleSecret = String(postData.roleSecret || '');

      if (!userName || password.length < 6) {
        return jsonResponse({ status: "error", message: "Username and a 6+ character password are required" });
      }

      if ((role === 'Manager' || role === 'Supreme') && roleSecret !== ELEVATED_ROLE_SECRET) {
        return jsonResponse({ status: "error", message: "Invalid secret key for elevated account role" });
      }

      const users = userSheet.getLastRow() > 1
        ? userSheet.getRange(2, 1, userSheet.getLastRow() - 1, userHeaders.length).getValues()
        : [];
      const exists = users.some(row => String(row[userHeaders.indexOf('userName')]).toLowerCase() === userName.toLowerCase());
      if (exists) {
        return jsonResponse({ status: "error", message: "Username already exists" });
      }

      const id = 'user_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 9);
      const salt = Utilities.getUuid();
      const passwordHash = hashPassword(password, salt);
      const now = new Date().toISOString();
      const rowData = [id, userName, passwordHash, salt, role, now, now];
      userSheet.appendRow(rowData);

      return jsonResponse({ status: "success", data: { id: id, userName: userName, role: role } });
    }

    if (action === 'loginUser') {
      const userSheet = getUserSheet();
      const userHeaders = ensureHeaders(userSheet, USER_HEADERS);
      const userName = String(postData.userName || '').trim();
      const password = String(postData.password || '');

      if (!userName || !password) {
        return jsonResponse({ status: "error", message: "Username and password are required" });
      }

      const users = userSheet.getLastRow() > 1
        ? userSheet.getRange(2, 1, userSheet.getLastRow() - 1, userHeaders.length).getValues()
        : [];
      const row = users.find(item => String(item[userHeaders.indexOf('userName')]).toLowerCase() === userName.toLowerCase());
      if (!row) {
        return jsonResponse({ status: "error", message: "Invalid username or password" });
      }

      const salt = row[userHeaders.indexOf('salt')];
      const expectedHash = row[userHeaders.indexOf('passwordHash')];
      if (hashPassword(password, salt) !== expectedHash) {
        return jsonResponse({ status: "error", message: "Invalid username or password" });
      }

      return jsonResponse({ status: "success", data: publicUser(row, userHeaders) });
    }

    const sheet = getTaskSheet();
    const headers = ensureHeaders(sheet, TASK_HEADERS);

    if (action === 'create') {
      const id = 'task_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 9);
      const now = new Date().toISOString();
      const taskData = {
        id: id,
        projectName: postData.projectName || '',
        heading: postData.heading || '',
        details: postData.details || '',
        timeTaken: parseFloat(postData.timeTaken) || 0,
        importLevel: postData.importLevel || 'Medium',
        status: postData.status || 'Pending',
        dueDate: postData.dueDate || '',
        attachmentUrl: postData.attachmentUrl || '',
        userName: postData.userName || 'Anonymous',
        createdAt: now,
        updatedAt: now
      };
      appendObjectRow(sheet, headers, taskData);
      return jsonResponse({ status: "success", data: taskData });
        
    } else if (action === 'update') {
      const id = postData.id;
      const rows = sheet.getDataRange().getValues();
      let foundIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === id) {
          foundIndex = i + 1;
          break;
        }
      }
      if (foundIndex === -1) {
        return jsonResponse({ status: "error", message: "Task not found" });
      }
      
      const sheetHeaders = rows[0];
      const fields = ['projectName', 'heading', 'details', 'timeTaken', 'importLevel', 'status', 'dueDate', 'attachmentUrl', 'userName'];
      fields.forEach(field => {
        if (postData[field] !== undefined) {
          const colIndex = sheetHeaders.indexOf(field) + 1;
          if (colIndex > 0) {
            let val = postData[field];
            if (field === 'timeTaken') val = parseFloat(val) || 0;
            sheet.getRange(foundIndex, colIndex).setValue(val);
          }
        }
      });
      sheet.getRange(foundIndex, sheetHeaders.indexOf('updatedAt') + 1).setValue(new Date().toISOString());
      
      return jsonResponse({ status: "success" });
        
    } else if (action === 'delete') {
      const id = postData.id;
      const rows = sheet.getDataRange().getValues();
      let foundIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === id) {
          foundIndex = i + 1;
          break;
        }
      }
      if (foundIndex === -1) {
        return jsonResponse({ status: "error", message: "Task not found" });
      }
      sheet.deleteRow(foundIndex);
      return jsonResponse({ status: "success" });
    }
    
    return jsonResponse({ status: "error", message: "Invalid action" });
  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  }
}
`;

export default function ConfigModal({ isOpen, onClose, cloudUrl, onSaveUrl }) {
  const [urlInput, setUrlInput] = useState(cloudUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestConnection = async () => {
    if (!urlInput) {
      setTestResult({ success: false, message: 'Please provide a Web App URL first.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    
    const result = await verifyCloudConnection(urlInput);
    setTesting(false);
    setTestResult(result);
    
    if (result.success) {
      onSaveUrl(urlInput);
    }
  };

  const handleClearUrl = () => {
    setUrlInput('');
    onSaveUrl('');
    setTestResult(null);
  };

  if (!isOpen) return null;

  return (
    <div className={`modal-overlay ${isOpen ? 'active' : ''}`} onClick={onClose}>
      <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Close settings">&times;</button>
        
        <h2 className="modal-title">Cloud Database Setup Guide</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>
          Connect TaskUpdate Pro to Google Sheets so registered users, passwords, roles, and live task updates sync through one Apps Script backend.
        </p>

        <div className="step-container">
          <div className="step-card">
            <div className="step-header">
              <span className="step-number">1</span>
              <span>Create Google Sheet & Open Script Editor</span>
            </div>
            <p className="step-desc">
              Go to <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary-hover)' }}>sheets.new</a>, rename it, and go to the top menu: select <strong>Extensions &gt; Apps Script</strong>.
            </p>
          </div>

          <div className="step-card">
            <div className="step-header">
              <span className="step-number">2</span>
              <span>Paste Apps Script Code With Login Support</span>
            </div>
            <p className="step-desc">
              Delete any default code in the editor, and copy-paste the code snippet below. It creates a <strong>Users</strong> sheet for accounts and uses the active sheet or <strong>Tasks</strong> sheet for task updates.
            </p>
            <div className="code-box-wrapper">
              <button className="copy-btn" onClick={handleCopy}>
                {copied ? 'Copied ✓' : 'Copy Script Code'}
              </button>
              <pre className="code-box"><code>{APPS_SCRIPT_CODE}</code></pre>
            </div>
          </div>

          <div className="step-card">
            <div className="step-header">
              <span className="step-number">3</span>
              <span>Deploy as Web App</span>
            </div>
            <p className="step-desc" style={{ marginBottom: '0.5rem' }}>
              In Apps Script editor, click <strong>Deploy &gt; New deployment</strong>.
            </p>
            <ul style={{ color: '#94a3b8', fontSize: '0.82rem', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <li>Select gear icon next to <code>Select type</code> and choose <strong>Web app</strong>.</li>
              <li>Set <strong>Execute as:</strong> <code>Me (your Google email)</code></li>
              <li>Set <strong>Who has access:</strong> <code>Anyone</code> (This is safe, no individual Google sign-in needed).</li>
              <li>Click <strong>Deploy</strong>, authorize Google permissions, and copy the <strong>Web App URL</strong>.</li>
            </ul>
          </div>

          <div className="step-card">
            <div className="step-header">
              <span className="step-number">4</span>
              <span>Connect & Validate URL</span>
            </div>
            <p className="step-desc" style={{ marginBottom: '0.75rem' }}>
              Paste your Web App URL below and click test. Upon success, database sync triggers automatically.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="input-style"
                  style={{ flex: 1, fontSize: '0.85rem' }}
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
                {cloudUrl && (
                  <button className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={handleClearUrl}>
                    Disconnect
                  </button>
                )}
              </div>

              <button
                className="btn-primary"
                style={{ width: '100%', padding: '0.75rem' }}
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? (
                  <>
                    <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></span>
                    Testing Connection...
                  </>
                ) : (
                  'Validate & Connect Database'
                )}
              </button>

              {testResult && (
                <div
                  style={{
                    padding: '0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    lineHeight: '1.4',
                    border: '1px solid',
                    background: testResult.success ? 'var(--color-emerald-glow)' : 'var(--color-crimson-glow)',
                    borderColor: testResult.success ? 'var(--color-emerald)' : 'var(--color-crimson)',
                    color: testResult.success ? 'var(--color-emerald)' : '#fda4af'
                  }}
                >
                  <strong>{testResult.success ? 'Success! ✓' : 'Error ✗'}</strong> {testResult.message || (testResult.success ? 'Connected to Google Sheet database. Syncing tasks...' : '')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
