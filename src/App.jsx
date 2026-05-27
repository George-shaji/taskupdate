import { useState, useEffect, useCallback } from 'react';
import AppHeader from './components/AppHeader';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';
import DashboardStats from './components/DashboardStats';
import ConfigModal from './components/ConfigModal';
import LoginPage from './components/LoginPage';
import ApiDocumentation from './components/ApiDocumentation';
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
const TASK_OWNERS_KEY = 'taskupdate_pro_task_owners';
const TASK_PROJECTS_KEY = 'taskupdate_pro_task_projects';
const USER_TASKS_KEY_PREFIX = 'taskupdate_pro_user_tasks_';
const TASK_UPDATE_WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAQAgnFAlOs/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=OV0Rys9E_nFJAKrIOdZf3AXPlLfn6hhNVJMLR5FbpTw';

const getStoredTaskOwners = () => {
  try {
    const raw = localStorage.getItem(TASK_OWNERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const getStoredTaskProjects = () => {
  try {
    const raw = localStorage.getItem(TASK_PROJECTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const taskFingerprint = (task) => {
  if (!task) return '';

  return [
    task.projectName || '',
    task.heading || '',
    task.details || '',
    parseFloat(task.timeTaken) || 0,
    task.importLevel || 'Medium'
  ].map(value => String(value).trim().toLowerCase()).join('|');
};

const taskIdentity = (task) => {
  return task?.id || `fp:${taskFingerprint(task)}`;
};

const mergeTaskLists = (...taskLists) => {
  const merged = [];
  const seen = new Set();

  taskLists.flat().filter(Boolean).forEach(task => {
    const identity = taskIdentity(task);
    if (!identity || seen.has(identity)) return;

    seen.add(identity);
    merged.push(task);
  });

  return merged;
};

const userTasksKey = (userName) => {
  return `${USER_TASKS_KEY_PREFIX}${(userName || '').trim().toLowerCase()}`;
};

const getStoredUserTasks = (userName) => {
  if (!userName) return [];

  try {
    const raw = localStorage.getItem(userTasksKey(userName));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStoredUserTasks = (userName, userTasks) => {
  if (!userName) return;

  try {
    localStorage.setItem(userTasksKey(userName), JSON.stringify(userTasks));
  } catch (e) {
    console.warn('Could not persist user tasks', e);
  }
};

const upsertStoredUserTask = (userName, task) => {
  if (!userName || !task) return;

  const ownedTask = {
    ...task,
    userName
  };
  const existingTasks = getStoredUserTasks(userName);
  const nextTasks = mergeTaskLists(
    [ownedTask],
    existingTasks.filter(existingTask => {
      return existingTask.id !== task.id && taskFingerprint(existingTask) !== taskFingerprint(task);
    })
  );
  saveStoredUserTasks(userName, nextTasks);
};

const removeStoredUserTask = (userName, taskId) => {
  if (!userName || !taskId) return;

  const nextTasks = getStoredUserTasks(userName).filter(task => task.id !== taskId);
  saveStoredUserTasks(userName, nextTasks);
};

const getRememberedTaskOwner = (task, owners) => {
  if (!task) return '';

  return owners[task.id] || owners[`id:${task.id}`] || owners[`fp:${taskFingerprint(task)}`] || '';
};

const getRememberedTaskProject = (task, projects) => {
  if (!task) return '';

  return projects[task.id] || projects[`id:${task.id}`] || projects[`fp:${taskFingerprint(task)}`] || '';
};

const saveTaskOwner = (taskId, userName, task) => {
  if ((!taskId && !task) || !userName) return;

  try {
    const owners = getStoredTaskOwners();
    if (taskId) {
      owners[taskId] = userName;
      owners[`id:${taskId}`] = userName;
    }
    if (task) {
      owners[`fp:${taskFingerprint(task)}`] = userName;
    }
    localStorage.setItem(TASK_OWNERS_KEY, JSON.stringify(owners));
  } catch (e) {
    console.warn('Could not persist task owner', e);
  }
};

const saveTaskProject = (taskId, projectName, task) => {
  if ((!taskId && !task) || !projectName) return;

  try {
    const projects = getStoredTaskProjects();
    if (taskId) {
      projects[taskId] = projectName;
      projects[`id:${taskId}`] = projectName;
    }
    if (task) {
      projects[`fp:${taskFingerprint(task)}`] = projectName;
    }
    localStorage.setItem(TASK_PROJECTS_KEY, JSON.stringify(projects));
  } catch (e) {
    console.warn('Could not persist task project', e);
  }
};

const namesMatch = (left, right) => {
  return (left || '').trim().toLowerCase() === (right || '').trim().toLowerCase();
};

const isDateLike = (value) => {
  if (!value) return false;
  return !Number.isNaN(Date.parse(value));
};

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
  const [activePage, setActivePage] = useState('tasks');

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
    return (rawTasks || []).map(t => {
      const hasShiftedOwner = isDateLike(t.userName) && t.createdAt && !isDateLike(t.createdAt);
      const createdAt = hasShiftedOwner ? t.userName : t.createdAt;

      return {
        id: t.id,
        projectName: t.projectName || t.project || '',
        heading: t.heading || '',
        details: t.details || '',
        timeTaken: parseFloat(t.timeTaken) || 0,
        importLevel: t.importLevel || 'Medium',
        userName: hasShiftedOwner ? t.createdAt : t.userName || t.user || 'System/Legacy',
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: t.updatedAt || createdAt || new Date().toISOString()
      };
    });
  }, []);

  const applyRememberedOwners = useCallback((sourceTasks, fallbackTasks = []) => {
    const rememberedOwners = getStoredTaskOwners();
    const rememberedProjects = getStoredTaskProjects();
    const fallbackOwners = fallbackTasks.reduce((owners, task) => {
      if (task.id && task.userName && task.userName !== 'System/Legacy') {
        owners[task.id] = task.userName;
      }
      return owners;
    }, {});

    return sourceTasks.map(task => {
      const rememberedOwner = getRememberedTaskOwner(task, rememberedOwners) || fallbackOwners[task.id];
      const rememberedProject = task.projectName || getRememberedTaskProject(task, rememberedProjects);
      if (!rememberedOwner && !rememberedProject) return task;

      return {
        ...task,
        projectName: rememberedProject || task.projectName || '',
        userName: rememberedOwner || task.userName
      };
    });
  }, []);

  const preserveCurrentUserTasks = useCallback((cloudTasks, previousTasks) => {
    if (!currentUser || currentUser.role === 'Supreme') return cloudTasks;

    const rememberedOwners = getStoredTaskOwners();
    const storedUserTasks = getStoredUserTasks(currentUser.name).map(task => ({
      ...task,
      userName: currentUser.name
    }));
    const mergedTasks = mergeTaskLists(cloudTasks, storedUserTasks);

    previousTasks.forEach(previousTask => {
      const owner = getRememberedTaskOwner(previousTask, rememberedOwners) || previousTask.userName;
      if (!namesMatch(owner, currentUser.name)) return;

      const matchingIndex = mergedTasks.findIndex(task => {
        return task.id === previousTask.id || taskFingerprint(task) === taskFingerprint(previousTask);
      });

      if (matchingIndex >= 0) {
        const cloudTask = mergedTasks[matchingIndex];
        const ownedTask = {
          ...cloudTask,
          userName: currentUser.name
        };
        mergedTasks[matchingIndex] = ownedTask;
        saveTaskOwner(ownedTask.id, currentUser.name, ownedTask);
        upsertStoredUserTask(currentUser.name, ownedTask);
        return;
      }

      const ownedTask = {
        ...previousTask,
        userName: currentUser.name
      };
      mergedTasks.unshift(ownedTask);
      upsertStoredUserTask(currentUser.name, ownedTask);
    });

    return mergedTasks;
  }, [currentUser]);

  // Sync routine (Pull latest from Sheets)
  const syncWithCloud = useCallback(async (urlToUse) => {
    const url = urlToUse || cloudUrl;
    if (!url) return;

    setIsSyncing(true);
    setErrorMessage(null);
    try {
      const cloudTasks = await fetchCloudTasks(url);
      const normalized = normalizeTasks(cloudTasks);
      setTasks(prevTasks => {
        const withRememberedOwners = applyRememberedOwners(normalized, prevTasks);
        const reconciled = preserveCurrentUserTasks(withRememberedOwners, prevTasks);
        saveLocalTasks(reconciled);
        return reconciled;
      });
      setLastSync(new Date().toISOString());
    } catch (err) {
      console.error("Sync pull failed:", err);
      setErrorMessage("Background sync pull failed. Using local cached tasks.");
      // Fallback to local cache in state (already loaded)
    } finally {
      setIsSyncing(false);
    }
  }, [applyRememberedOwners, cloudUrl, normalizeTasks, preserveCurrentUserTasks]);

  // Load initial settings and local cache
  useEffect(() => {
    const cachedTasks = normalizeTasks(getLocalTasks());
    const userTasks = currentUser && currentUser.role !== 'Supreme'
      ? getStoredUserTasks(currentUser.name).map(task => ({ ...task, userName: currentUser.name }))
      : [];

    const initialTasks = mergeTaskLists(userTasks, cachedTasks);
    setTasks(initialTasks);

    const savedUrl = getCloudUrl();
    if (savedUrl) {
      setCloudUrl(savedUrl);
      syncWithCloud(savedUrl);
    }
  }, [currentUser, normalizeTasks, syncWithCloud]);

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

    const storedUserTasks = getStoredUserTasks(currentUser.name).map(task => ({
      ...task,
      userName: currentUser.name
    }));
    const matchingCloudTasks = sourceTasks.filter(task => {
      const rememberedOwner = getRememberedTaskOwner(task, getStoredTaskOwners());
      return namesMatch(task.userName, currentUser.name) || namesMatch(rememberedOwner, currentUser.name);
    }).map(task => ({
      ...task,
      userName: currentUser.name
    }));

    return mergeTaskLists(storedUserTasks, matchingCloudTasks);
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
    saveTaskOwner(tempId, currentUser.name, newTask);
    saveTaskProject(tempId, newTask.projectName, newTask);
    upsertStoredUserTask(currentUser.name, newTask);
    const updatedTasks = [newTask, ...tasks];
    setTasks(updatedTasks);
    saveLocalTasks(updatedTasks);

    if (cloudUrl) {
      try {
        const result = await sendCloudRequest(cloudUrl, 'create', stamped);
        // Replace tempId with the verified Sheets task while keeping it visible immediately.
        if (result && result.id) {
          const savedTask = normalizeTasks([{ ...newTask, ...result }])[0];
          saveTaskOwner(savedTask.id, currentUser.name, savedTask);
          saveTaskProject(savedTask.id, savedTask.projectName, savedTask);
          upsertStoredUserTask(currentUser.name, savedTask);
          setTasks(prev => {
            const nextTasks = prev.map(t => t.id === tempId ? savedTask : t);
            saveLocalTasks(nextTasks);
            return nextTasks;
          });
        }

        // Refresh in the background after Sheets has a moment to expose the appended row.
        window.setTimeout(() => syncWithCloud(cloudUrl), 1000);
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
    const isAuthor = namesMatch(originalTask?.userName, currentUser.name);

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
    const updatedLocalTask = updatedTasks.find(task => task.id === updatedTask.id);
    saveTaskProject(updatedTask.id, updatedLocalTask?.projectName, updatedLocalTask);
    if (currentUser.role !== 'Supreme') {
      const ownedUpdate = updatedLocalTask;
      upsertStoredUserTask(currentUser.name, ownedUpdate);
    }

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
    const isAuthor = namesMatch(originalTask?.userName, currentUser.name);

    if (!originalTask || (currentUser.role !== 'Supreme' && !isAuthor)) {
      setErrorMessage('You can only delete task entries that belong to your login.');
      return;
    }

    // Optimistic UI update
    const updatedTasks = tasks.filter(t => t.id !== id);
    setTasks(updatedTasks);
    saveLocalTasks(updatedTasks);
    if (currentUser.role !== 'Supreme') {
      removeStoredUserTask(currentUser.name, id);
    }

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

  const handleSendTaskUpdate = async (task, codeLocation) => {
    if (!task) return;

    const projectName = (task.projectName || '').trim();
    if (!projectName) {
      throw new Error('Project name is required before sending the task update.');
    }

    const storedTask = tasks.find(item => item.id === task.id);
    const shouldPersistProject = storedTask && storedTask.projectName !== projectName;
    if (shouldPersistProject) {
      const taskWithProject = {
        ...storedTask,
        projectName,
        updatedAt: new Date().toISOString()
      };
      const nextTasks = tasks.map(item => item.id === task.id ? taskWithProject : item);
      setTasks(nextTasks);
      saveLocalTasks(nextTasks);
      saveTaskProject(task.id, projectName, taskWithProject);
      if (taskWithProject.userName && taskWithProject.userName !== 'System/Legacy') {
        upsertStoredUserTask(taskWithProject.userName, taskWithProject);
      }

      if (cloudUrl) {
        await sendCloudRequest(cloudUrl, 'update', {
          id: task.id,
          projectName,
          heading: taskWithProject.heading,
          details: taskWithProject.details,
          timeTaken: taskWithProject.timeTaken,
          importLevel: taskWithProject.importLevel,
          userName: taskWithProject.userName
        });
      }
    } else {
      saveTaskProject(task.id, projectName, task);
    }

    const text = [
      `Name : ${task.userName || currentUser?.name || ''}`,
      `Project : ${projectName}`,
      `Task     : ${task.heading || ''}`,
      `Status  : Pushed to ${codeLocation}`
    ].join('\n');

    const response = await fetch(TASK_UPDATE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}`);
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
        activePage={activePage}
        onNavigate={setActivePage}
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

      {activePage === 'docs' ? (
        <ApiDocumentation onBack={() => setActivePage('tasks')} />
      ) : (
        <>
          {/* Metrics Dashboard */}
          <DashboardStats tasks={visibleTasks} />

          {/* Main Form + Grid Layout */}
          <main className="dashboard-grid">
            <section>
              <TaskForm onAddTask={handleAddTask} isSubmitting={isSubmitting} currentUser={currentUser} />
            </section>

            <section>
              <TaskList 
                tasks={visibleTasks} 
                onUpdateTask={handleUpdateTask} 
                onDeleteTask={handleDeleteTask} 
                onSendTaskUpdate={handleSendTaskUpdate}
                currentUser={currentUser}
              />
            </section>
          </main>
        </>
      )}

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
