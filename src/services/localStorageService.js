/**
 * API-based data service — drop-in replacement for localStorageService.js
 * All operations call the Express.js backend.
 * "subscribe" functions use polling to mimic real-time updates.
 */

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? `http://${window.location.hostname}:5000/api` : '/api');

function getHeaders() {
  const token = localStorage.getItem('osr_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

async function apiRequest(path, options = {}) {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers
    }
  });

  if (!res.ok) {
    let errMsg = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const errBody = await res.json();
      if (errBody && errBody.message) errMsg = errBody.message;
    } catch {}
    if (res.status === 401 || errMsg === 'Invalid or expired token') {
      localStorage.removeItem('osr_token');
      localStorage.removeItem('osr_auth');
      window.location.href = '/login';
    }
    
    throw new Error(errMsg);
  }
  return res.json();
}

// ─── Projects ───
export async function createProject(data) {
  return apiRequest('/projects', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function getProject(projectId) {
  return apiRequest(`/projects/${projectId}`);
}

export async function getProjectBySlug(slug) {
  // Public route, no Auth required
  const res = await fetch(`${API_URL}/public/projects/slug/${slug}`);
  if (!res.ok) return null;
  return res.json();
}

export async function getAllProjects() {
  return apiRequest('/projects');
}

export async function getUserProjects(projectIds) {
  // Server-side GET /projects already handles user assignment filters for editors
  return apiRequest('/projects');
}

export async function updateProject(projectId, data) {
  return apiRequest(`/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function deleteProject(projectId) {
  return apiRequest(`/projects/${projectId}`, {
    method: 'DELETE'
  });
}

export function subscribeToProject(projectId, callback) {
  let active = true;
  const poll = async () => {
    try {
      const proj = await getProject(projectId);
      if (active) callback(proj);
    } catch (err) {
      console.error('Error fetching project:', err);
      if (active) callback(null);
    }
  };
  poll();
  const interval = setInterval(poll, 4000);
  return () => {
    active = false;
    clearInterval(interval);
  };
}

// ─── Tasks ───
export async function addTask(projectId, taskData) {
  return apiRequest(`/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(taskData)
  });
}

export async function addTasksBatch(projectId, tasksList) {
  return apiRequest(`/projects/${projectId}/tasks/batch`, {
    method: 'POST',
    body: JSON.stringify(tasksList)
  });
}

export async function updateTask(projectId, taskId, data) {
  return apiRequest(`/projects/${projectId}/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function deleteTask(projectId, taskId) {
  return apiRequest(`/projects/${projectId}/tasks/${taskId}`, {
    method: 'DELETE'
  });
}

export function subscribeToTasks(projectId, callback) {
  let active = true;
  const poll = async () => {
    try {
      let tasks = await apiRequest(`/projects/${projectId}/tasks`);
      
      // Filter out metadata rows and header rows dynamically for UI compatibility
      tasks = tasks.filter(t => {
        if (!t.taskNo) return true;
        const no = String(t.taskNo).trim();
        const noLower = no.toLowerCase();
        
        return !(
          no.endsWith(':') ||
          noLower.includes('client') ||
          noLower.includes('location') ||
          noLower.includes('architect') ||
          noLower.includes('building type') ||
          noLower.includes('footprint') ||
          noLower.includes('project start') ||
          noLower.includes('target handover') ||
          noLower === 'task no.' ||
          noLower === 'task no' ||
          noLower === 'activity description' ||
          (t.phase && t.phase.includes('|'))
        );
      });

      // Sort by order ascending
      tasks.sort((a, b) => (a.order || 0) - (b.order || 0));
      if (active) callback(tasks);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  };
  poll();
  const interval = setInterval(poll, 3000);
  return () => {
    active = false;
    clearInterval(interval);
  };
}

// ─── Photos ───
export async function uploadPhoto(projectId, taskId, file, onProgress) {
  if (onProgress) onProgress(10);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('projectId', projectId);
  formData.append('taskId', taskId || 'general');

  if (onProgress) onProgress(30);

  const token = localStorage.getItem('osr_token');
  const res = await fetch(`${API_URL}/storage/upload`, {
    method: 'POST',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: formData
  });

  if (!res.ok) {
    let errMsg = 'Upload failed';
    try {
      const errBody = await res.json();
      if (errBody && errBody.message) errMsg = errBody.message;
    } catch {}
    if (res.status === 401 || errMsg === 'Invalid or expired token') {
      localStorage.removeItem('osr_token');
      localStorage.removeItem('osr_auth');
      window.location.href = '/login';
    }
    
    throw new Error(errMsg);
  }

  if (onProgress) onProgress(100);

  const data = await res.json();
  return { url: data.url, path: data.filename, timestamp: Date.now() };
}

export async function addPhotoRecord(projectId, taskId, photoData) {
  return apiRequest(`/projects/${projectId}/photos`, {
    method: 'POST',
    body: JSON.stringify({ taskId, ...photoData })
  });
}

export function subscribeToPhotos(projectId, callback) {
  let active = true;
  const poll = async () => {
    try {
      const photos = await apiRequest(`/projects/${projectId}/photos`);
      photos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      if (active) callback(photos);
    } catch (err) {
      console.error('Error fetching photos:', err);
    }
  };
  poll();
  const interval = setInterval(poll, 4000);
  return () => {
    active = false;
    clearInterval(interval);
  };
}

export function subscribeToTaskPhotos(projectId, taskId, callback) {
  return subscribeToPhotos(projectId, (photos) => {
    callback(photos.filter(p => p.taskId === taskId));
  });
}

// ─── Generic CRUD Factory for sub-modules ───
function createModuleCRUD(prefix) {
  const add = async (projectId, data) => {
    return apiRequest(`/projects/${projectId}/modules/${prefix}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  };

  const update = async (projectId, itemId, data) => {
    return apiRequest(`/projects/${projectId}/modules/${prefix}/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  };

  const remove = async (projectId, itemId) => {
    return apiRequest(`/projects/${projectId}/modules/${prefix}/${itemId}`, {
      method: 'DELETE'
    });
  };

  const subscribe = (projectId, callback, sortFn) => {
    let active = true;
    const poll = async () => {
      try {
        const items = await apiRequest(`/projects/${projectId}/modules/${prefix}`);
        if (sortFn) items.sort(sortFn);
        if (active) callback(items);
      } catch (err) {
        console.error(`Error fetching module ${prefix}:`, err);
      }
    };
    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  };

  return { add, update, remove, subscribe };
}

// Site Log
const siteLogModule = createModuleCRUD('sitelog');
export const addSiteLog = siteLogModule.add;
export const updateSiteLog = siteLogModule.update;
export const deleteSiteLog = siteLogModule.remove;
export const subscribeToSiteLogs = (pid, cb) => siteLogModule.subscribe(pid, cb, (a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

// Materials
const materialModule = createModuleCRUD('materials');
export const addMaterial = materialModule.add;
export const updateMaterial = materialModule.update;
export const deleteMaterial = materialModule.remove;
export const subscribeToMaterials = (pid, cb) => materialModule.subscribe(pid, cb);

// Labour
const labourModule = createModuleCRUD('labour');
export const addLabour = labourModule.add;
export const updateLabour = labourModule.update;
export const deleteLabour = labourModule.remove;
export const subscribeToLabour = (pid, cb) => labourModule.subscribe(pid, cb, (a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

// Payments
const paymentModule = createModuleCRUD('payments');
export const addPayment = paymentModule.add;
export const updatePayment = paymentModule.update;
export const deletePayment = paymentModule.remove;
export const subscribeToPayments = (pid, cb) => paymentModule.subscribe(pid, cb, (a, b) => (a.order || 0) - (b.order || 0));

// Drawings
const drawingModule = createModuleCRUD('drawings');
export const addDrawing = drawingModule.add;
export const updateDrawing = drawingModule.update;
export const deleteDrawing = drawingModule.remove;
export const subscribeToDrawings = (pid, cb) => drawingModule.subscribe(pid, cb, (a, b) => new Date(b.createdAt) - new Date(a.createdAt));

// Checklists
const checklistModule = createModuleCRUD('checklists');
export const addChecklist = checklistModule.add;
export const updateChecklist = checklistModule.update;
export const deleteChecklist = checklistModule.remove;
export const subscribeToChecklists = (pid, cb) => checklistModule.subscribe(pid, cb);

// Issues
const issueModule = createModuleCRUD('issues');
export const addIssue = issueModule.add;
export const updateIssue = issueModule.update;
export const deleteIssue = issueModule.remove;
export const subscribeToIssues = (pid, cb) => issueModule.subscribe(pid, cb, (a, b) => new Date(b.createdAt) - new Date(a.createdAt));

// Contacts
const contactModule = createModuleCRUD('contacts');
export const addContact = contactModule.add;
export const updateContact = contactModule.update;
export const deleteContact = contactModule.remove;
export const subscribeToContacts = (pid, cb) => contactModule.subscribe(pid, cb);

// Meetings
const meetingModule = createModuleCRUD('meetings');
export const addMeeting = meetingModule.add;
export const updateMeeting = meetingModule.update;
export const deleteMeeting = meetingModule.remove;
export const subscribeToMeetings = (pid, cb) => meetingModule.subscribe(pid, cb, (a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

// Curing Log
const curingModule = createModuleCRUD('curing');
export const addCuringRecord = curingModule.add;
export const updateCuringRecord = curingModule.update;
export const deleteCuringRecord = curingModule.remove;
export const subscribeToCuringRecords = (pid, cb) => curingModule.subscribe(pid, cb, (a, b) => new Date(b.createdAt) - new Date(a.createdAt));

// Expenses
const expenseModule = createModuleCRUD('expenses');
export const addExpense = expenseModule.add;
export const updateExpense = expenseModule.update;
export const deleteExpense = expenseModule.remove;
export const subscribeToExpenses = (pid, cb) => expenseModule.subscribe(pid, cb, (a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));


// ─── Data Import/Export Backup ───
export async function exportBackupData() {
  return apiRequest('/backup/export');
}

export async function importBackupData(backup) {
  return apiRequest('/backup/import', {
    method: 'POST',
    body: JSON.stringify(backup)
  });
}

// ─── User Management & Auth Actions ───
export async function getAllUsers() {
  return apiRequest('/users');
}

export function subscribeToUsers(callback) {
  let active = true;
  const poll = async () => {
    try {
      const users = await getAllUsers();
      if (active) callback(users);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };
  poll();
  const interval = setInterval(poll, 4000);
  return () => {
    active = false;
    clearInterval(interval);
  };
}

export async function createUser(userData) {
  return apiRequest('/users', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
}

export async function updateUser(userId, data) {
  const updatedUser = await apiRequest(`/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });

  // If we just updated ourselves, trigger the custom event so AuthContext updates its profile
  const authSession = localStorage.getItem('osr_auth');
  if (authSession) {
    const parsed = JSON.parse(authSession);
    if (parsed.id === userId) {
      localStorage.setItem('osr_auth', JSON.stringify(updatedUser));
      window.dispatchEvent(new CustomEvent('ls-auth-update', { detail: { profile: updatedUser } }));
    }
  }

  return updatedUser;
}

export async function deleteUser(userId) {
  return apiRequest(`/users/${userId}`, {
    method: 'DELETE'
  });
}

export async function changeUserPassword(userId, currentPassword, newPassword) {
  return apiRequest(`/users/${userId}/change-password`, {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword })
  });
}
