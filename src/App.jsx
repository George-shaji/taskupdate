import { useState, useEffect, useCallback } from 'react';
import AppHeader from './components/AppHeader';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';
import DashboardStats from './components/DashboardStats';
import ConfigModal from './components/ConfigModal';
import LoginPage from './components/LoginPage';
import { 
  getLocalTasks, 
  saveLocalTasks, 
  getCloudUrl, 
  saveCloudUrl, 
  fetchCloudTasks, 
  sendCloudRequest,
  registerCloudUser,
  loginCloudUser
} from './db/sheetDb';

const USER_KEY = 'taskupdate_pro_user';

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [cloudUrl, setCloudUrl] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [authMessage, setAuthMessage] = useState(null);

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(USER_KEY);
      }
    } catch (e) {
      console.warn('Could not persist user session', e);
    }
  }, [currentUser]);

  // Normalize tasks to ensure a userName present for legacy records
  const normalizeTasks = useCallback((rawTasks) => {
    return (rawTasks || []).map(t => ({
      id: t.id,
      heading: t.heading || '',
      details: t.details || '',
      timeTaken: parseFloat(t.timeTaken) || 0,
      importLevel: t.importLevel || 'Medium',
      userName: t.userName || t.user || 'System/Legacy',
      createdAt: t.createdAt || new Date().toISOString(),
      updatedAt: t.updatedAt || t.createdAt || new Date().toISOString()
    }));
  }, []);

  // Sync routine (Pull latest from Sheets)
  const syncWithCloud = useCallback(async (urlToUse) => {
    const url = urlToUse || cloudUrl;
    if (!url) return;

    setIsSyncing(true);
    setErrorMessage(null);
    try {
      const cloudTasks = await fetchCloudTasks(url);
      const normalized = normalizeTasks(cloudTasks);
      setTasks(normalized);
      saveLocalTasks(normalized);
      setLastSync(new Date().toISOString());
    } catch (err) {
      console.error("Sync pull failed:", err);
      setErrorMessage("Background sync pull failed. Using local cached tasks.");
      // Fallback to local cache in state (already loaded)
    } finally {
      setIsSyncing(false);
    }
  }, [cloudUrl, normalizeTasks]);

  // Load initial settings and local cache
  useEffect(() => {
    const cachedTasks = normalizeTasks(getLocalTasks());
    setTasks(cachedTasks);

    const savedUrl = getCloudUrl();
    if (savedUrl) {
      setCloudUrl(savedUrl);
      syncWithCloud(savedUrl);
    }
  }, [normalizeTasks, syncWithCloud]);

  // Background Polling (Refreshes sheet every 30 seconds for multi-user coordination)
  useEffect(() => {
    if (!cloudUrl) return;

    const interval = setInterval(() => {
      syncWithCloud(cloudUrl);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [cloudUrl, syncWithCloud]);

  // Save new URL configuration from modal
  const handleSaveUrl = (url) => {
    saveCloudUrl(url);
    setCloudUrl(url);
    if (url) {
      syncWithCloud(url);
    } else {
      // Clear database to local state
      setLastSync(null);
      setErrorMessage(null);
      const localData = normalizeTasks(getLocalTasks());
      setTasks(localData);
    }
  };

  const getVisibleTasks = useCallback((sourceTasks = tasks) => {
    if (!currentUser) return [];
    if (currentUser.role === 'Supreme') return sourceTasks;

    return sourceTasks.filter(task => {
      return (task.userName || '').toLowerCase() === (currentUser.name || '').toLowerCase();
    });
  }, [currentUser, tasks]);

  // Add Task
  const handleAddTask = async (newTaskData) => {
    if (!currentUser) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const tempId = 'temp_' + Date.now();
    // Stamp with current userName
    const stamped = { ...newTaskData, userName: currentUser.name };

    const newTask = {
      id: tempId,
      ...stamped,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Optimistic UI Update: show locally immediately
    const updatedTasks = [newTask, ...tasks];
    setTasks(updatedTasks);
    saveLocalTasks(updatedTasks);

    if (cloudUrl) {
      try {
        const result = await sendCloudRequest(cloudUrl, 'create', stamped);
        // Replace tempId with the verified sheets unique ID
        if (result && result.id) {
          setTasks(prev => prev.map(t => t.id === tempId ? { ...t, id: result.id } : t));
          // Refresh list to pull final cloud ordering
          syncWithCloud(cloudUrl);
        }
      } catch (err) {
        console.error("Cloud insert transaction failed:", err);
        setErrorMessage("Could not save to Google Sheet. Task saved locally.");
        // Rollback or mark as unsynced could go here. For simplicity, it stays local.
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // No cloud database, save is complete locally
      setIsSubmitting(false);
    }
  };

  // Update Task (Inline modification)
  const handleUpdateTask = async (updatedTask) => {
    if (!currentUser) return;

    setErrorMessage(null);
    // Save current state for rollback
    const originalTasks = [...tasks];
    const originalTask = originalTasks.find(t => t.id === updatedTask.id);
    const isAuthor = (originalTask?.userName || '').toLowerCase() === (currentUser.name || '').toLowerCase();

    if (!originalTask || (currentUser.role !== 'Supreme' && !isAuthor)) {
      setErrorMessage('You can only update task entries that belong to your login.');
      return;
    }

    // Optimistic UI update
    const updatedTasks = tasks.map(t => {
      if (t.id === updatedTask.id) {
        return {
          ...t,
          ...updatedTask,
          // Preserve original author unless explicitly provided
          userName: updatedTask.userName || t.userName,
          updatedAt: new Date().toISOString()
        };
      }
      return t;
    });
    setTasks(updatedTasks);
    saveLocalTasks(updatedTasks);

    if (cloudUrl) {
      try {
        const payload = { ...updatedTask, userName: updatedTask.userName || originalTask.userName || currentUser.name };
        await sendCloudRequest(cloudUrl, 'update', payload);
        syncWithCloud(cloudUrl);
      } catch (err) {
        console.error("Cloud update transaction failed:", err);
        setErrorMessage("Failed to sync update to Google Sheet. Restoring previous state.");
        // Rollback state on cloud failure to keep in perfect synchronization
        setTasks(originalTasks);
        saveLocalTasks(originalTasks);
      }
    }
  };

  // Delete Task
  const handleDeleteTask = async (id) => {
    if (!currentUser) return;

    setErrorMessage(null);
    
    // Save current state for rollback
    const originalTasks = [...tasks];
    const originalTask = originalTasks.find(t => t.id === id);
    const isAuthor = (originalTask?.userName || '').toLowerCase() === (currentUser.name || '').toLowerCase();

    if (!originalTask || (currentUser.role !== 'Supreme' && !isAuthor)) {
      setErrorMessage('You can only delete task entries that belong to your login.');
      return;
    }

    // Optimistic UI update
    const updatedTasks = tasks.filter(t => t.id !== id);
    setTasks(updatedTasks);
    saveLocalTasks(updatedTasks);

    if (cloudUrl) {
      try {
        await sendCloudRequest(cloudUrl, 'delete', { id });
        syncWithCloud(cloudUrl);
      } catch (err) {
        console.error("Cloud delete transaction failed:", err);
        setErrorMessage("Failed to delete task from Google Sheet. Restoring previous state.");
        // Rollback state on cloud failure
        setTasks(originalTasks);
        saveLocalTasks(originalTasks);
      }
    }
  };

  const handleLoginSuccess = (user) => {
    const normalizedUser = {
      name: (user.userName || user.name || '').trim(),
      role: user.role === 'Supreme' ? 'Supreme' : 'Standard'
    };

    if (!normalizedUser.name) return;
    setCurrentUser(normalizedUser);
  };

  const handleLogin = async ({ userName, password }) => {
    if (!cloudUrl) {
      setAuthMessage({ type: 'error', text: 'Connect your Google Sheet Web App URL before logging in.' });
      return;
    }

    setIsAuthenticating(true);
    setAuthMessage(null);
    try {
      const user = await loginCloudUser(cloudUrl, { userName, password });
      handleLoginSuccess(user);
    } catch (err) {
      setAuthMessage({ type: 'error', text: err.message || 'Login failed.' });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleRegister = async ({ userName, password, role }) => {
    if (!cloudUrl) {
      setAuthMessage({ type: 'error', text: 'Connect your Google Sheet Web App URL before registering.' });
      return;
    }

    setIsAuthenticating(true);
    setAuthMessage(null);
    try {
      const user = await registerCloudUser(cloudUrl, { userName, password, role });
      handleLoginSuccess(user);
    } catch (err) {
      setAuthMessage({ type: 'error', text: err.message || 'Registration failed.' });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  if (!currentUser) {
    return (
      <LoginPage
        cloudUrl={cloudUrl}
        onSaveUrl={handleSaveUrl}
        onLogin={handleLogin}
        onRegister={handleRegister}
        isAuthenticating={isAuthenticating}
        authMessage={authMessage}
      />
    );
  }

  const visibleTasks = getVisibleTasks(tasks);

  return (
    <div className="app-container">
      {/* App Header & Connection Indicators */}
      <AppHeader 
        cloudUrl={cloudUrl} 
        isSyncing={isSyncing} 
        lastSync={lastSync}
        onOpenConfig={() => setIsConfigOpen(true)}
        onManualSync={() => syncWithCloud(cloudUrl)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Network Alert Notification */}
      {errorMessage && (
        <div 
          style={{
            padding: '1rem 1.5rem',
            borderRadius: '12px',
            background: 'var(--color-crimson-glow)',
            border: '1px solid var(--color-crimson)',
            color: '#fca5a5',
            fontSize: '0.9rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
          }}
        >
          <span>⚠️ {errorMessage}</span>
          <button 
            onClick={() => setErrorMessage(null)} 
            style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Metrics Dashboard */}
      <DashboardStats tasks={visibleTasks} />

      {/* Main Form + Grid Layout */}
      <main className="dashboard-grid">
        <section>
          <TaskForm onAddTask={handleAddTask} isSubmitting={isSubmitting} currentUser={currentUser} />
        </section>

        <section>
          <TaskList 
            tasks={tasks} 
            onUpdateTask={handleUpdateTask} 
            onDeleteTask={handleDeleteTask} 
            currentUser={currentUser}
          />
        </section>
      </main>

      {/* Setup configuration panel */}
      <ConfigModal 
        isOpen={isConfigOpen} 
        onClose={() => setIsConfigOpen(false)} 
        cloudUrl={cloudUrl} 
        onSaveUrl={handleSaveUrl}
      />
    </div>
  );
}
