/**
 * TaskUpdate Pro - Database & Sync Service
 * Handles localStorage operations and secure, CORS-free sync with Google Sheets Apps Script Web App.
 */

const LOCAL_STORAGE_KEY = 'taskupdate_pro_tasks';
const CLOUD_URL_KEY = 'taskupdate_pro_sheet_url';

/**
 * Get tasks stored locally
 */
export const getLocalTasks = () => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to read local tasks:", error);
    return [];
  }
};

/**
 * Save tasks locally
 */
export const saveLocalTasks = (tasks) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error("Failed to save tasks locally:", error);
  }
};

/**
 * Get Google Apps Script URL
 */
export const getCloudUrl = () => {
  return localStorage.getItem(CLOUD_URL_KEY) || '';
};

/**
 * Save Google Apps Script URL
 */
export const saveCloudUrl = (url) => {
  if (url) {
    localStorage.setItem(CLOUD_URL_KEY, url.trim());
  } else {
    localStorage.removeItem(CLOUD_URL_KEY);
  }
};

/**
 * Verify if Google Apps Script URL is valid and reachable
 */
export const verifyCloudConnection = async (url) => {
  if (!url) return { success: false, message: 'URL is required' };
  try {
    // Append dummy timestamp to avoid cached results
    const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
    const response = await fetch(fetchUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit'
    });
    
    if (!response.ok) {
      return { success: false, message: `Server returned status ${response.status}` };
    }
    
    const result = await response.json();
    if (result && result.status === 'success') {
      return { success: true, data: result.data || [] };
    } else {
      return { success: false, message: result.message || 'Invalid sheet response' };
    }
  } catch (error) {
    console.error("Connection verification failed:", error);
    return { success: false, message: 'Reachable check failed. Please check the Web App URL and deployment authorization (Ensure "Execute as: Me" and "Who has access: Anyone").' };
  }
};

/**
 * Fetch tasks from Google Sheet
 */
export const fetchCloudTasks = async (url) => {
  if (!url) throw new Error("Cloud database URL not configured");
  
  const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const response = await fetch(fetchUrl, {
    method: 'GET',
    mode: 'cors'
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const result = await response.json();
  if (result.status !== 'success') {
    throw new Error(result.message || "Failed to fetch cloud tasks");
  }
  
  const isIsoDateLike = (value) => {
    if (!value) return false;
    const parsed = Date.parse(value);
    return !Number.isNaN(parsed);
  };

  // Format dates and prioritize clean data types; ensure userName exists for legacy rows.
  // Some older Sheets had userName appended after date columns. In that case Apps Script
  // could return userName as a timestamp and createdAt as the author, so repair it here.
  return (result.data || []).map(task => ({
    id: task.id,
    projectName: task.projectName || task.project || '',
    heading: task.heading || '',
    details: task.details || '',
    timeTaken: parseFloat(task.timeTaken) || 0,
    importLevel: task.importLevel || 'Medium',
    status: task.status || 'Pending',
    dueDate: task.dueDate || '',
    attachmentUrl: task.attachmentUrl || task.link || '',
    userName: isIsoDateLike(task.userName) && task.createdAt && !isIsoDateLike(task.createdAt)
      ? task.createdAt
      : task.userName || task.user || 'System/Legacy',
    createdAt: isIsoDateLike(task.userName) && task.createdAt && !isIsoDateLike(task.createdAt)
      ? task.userName
      : task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || task.createdAt || new Date().toISOString()
  }));
};

/**
 * Send POST operations to Google Sheet Web App
 * CRITICAL CORS DESIGN: We send payload using 'text/plain' to make this a "Simple Request".
 * This prevents the browser from firing an OPTIONS preflight request, which Google Apps Script doesn't support.
 */
export const sendCloudRequest = async (url, action, taskData) => {
  if (!url) throw new Error("Cloud database URL not configured");
  
  const payload = {
    action,
    ...taskData
  };
  
  const response = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    headers: {
      // Must be plain text to avoid triggering CORS OPTIONS preflight
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`Cloud transaction failed with status ${response.status}`);
  }
  
  const result = await response.json();
  if (result.status !== 'success') {
    throw new Error(result.message || 'Cloud write transaction rejected');
  }
  
  return result.data;
};

/**
 * Register a user account in Google Sheets.
 * Password verification is handled by Apps Script; the password is not stored in localStorage.
 */
export const registerCloudUser = async (url, userData) => {
  if (!url) throw new Error("Cloud database URL not configured");

  const response = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action: 'registerUser',
      ...userData
    })
  });

  if (!response.ok) {
    throw new Error(`Registration failed with status ${response.status}`);
  }

  const result = await response.json();
  if (result.status !== 'success') {
    throw new Error(result.message || 'Registration rejected');
  }

  return result.data;
};

/**
 * Login with a user account stored in Google Sheets.
 */
export const loginCloudUser = async (url, credentials) => {
  if (!url) throw new Error("Cloud database URL not configured");

  const response = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action: 'loginUser',
      ...credentials
    })
  });

  if (!response.ok) {
    throw new Error(`Login failed with status ${response.status}`);
  }

  const result = await response.json();
  if (result.status !== 'success') {
    throw new Error(result.message || 'Invalid username or password');
  }

  return result.data;
};
