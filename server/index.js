const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const multer = require('multer');
const sharp = require('sharp');
const { initDb, getProjects, saveProjects, getUsers, saveUsers, getTasks, saveTasks, getPhotos, savePhotos, getModuleData, saveModuleData, deleteProjectData } = require('./db.js');

dotenv.config();


const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'public', 'uploads');

// Ensure public/uploads directory exists on startup
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch (err) {
    console.error('Warning: Could not create uploads directory (might be a read-only file system):', err.message);
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'omji-site-register-super-secret-key-123';

// ─── Multer Storage Configuration ───
// Use memory storage so we can process with sharp before writing to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB file size limit
});

// ─── Image Processing Helper ───
async function processAndSaveImage(buffer, destDir, baseName) {
  const outputFilename = `${baseName}.webp`;
  const outputPath = path.join(destDir, outputFilename);

  await sharp(buffer)
    .rotate()                    // auto-rotate based on EXIF orientation
    .resize({
      width: 1920,
      height: 1920,
      fit: 'inside',             // shrink to fit within 1920×1920, keep aspect ratio
      withoutEnlargement: true   // never upscale
    })
    .webp({ quality: 82 })
    .toFile(outputPath);

  return outputFilename;
}

// ─── Default Admin Seeding ───
async function seedDefaultAdmin() {
  const users = await getUsers();
  if (users.length === 0) {
    users.push({
      id: 'admin-001',
      email: 'admin@omji.in',
      password: 'admin123',
      name: 'Admin',
      role: 'admin',
      assignedProjectIds: []
    });
    await saveUsers(users);
    console.log('Seeded default admin user: admin@omji.in / admin123');
  }
}

// Initialize Database on Startup
initDb().then(seedDefaultAdmin).catch(err => {
  console.error('Database initialization failed:', err);
});

// ─── Middleware ───
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Authorization token required' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = decoded;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin role required' });
  }
  next();
};

// Helper to generate IDs
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ─── AUTHENTICATION ROUTES ───

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const users = await getUsers();
    const user = users.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        assignedProjectIds: user.assignedProjectIds || []
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed: ' + err.message });
  }
});

// ─── USER MANAGEMENT ROUTES (ADMIN ONLY) ───

app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await getUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  const { email, password, name, role, assignedProjectIds } = req.body;
  try {
    const users = await getUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ message: 'A user with this email already exists.' });
    }

    const newUser = {
      id: generateId(),
      email,
      password: password || '123456',
      name: name || 'User',
      role: role || 'editor',
      assignedProjectIds: assignedProjectIds || []
    };

    users.push(newUser);
    await saveUsers(users);
    res.status(201).json(newUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/users/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const { email, name, role, assignedProjectIds } = req.body;

  if (req.user.role !== 'admin' && req.user.id !== userId) {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const users = await getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return res.status(404).json({ message: 'User not found' });

    if (email && email.toLowerCase() !== users[idx].email.toLowerCase()) {
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        return res.status(400).json({ message: 'A user with this email already exists.' });
      }
    }

    if (req.user.role === 'admin') {
      if (role) users[idx].role = role;
      if (assignedProjectIds) users[idx].assignedProjectIds = assignedProjectIds;
    }

    if (email) users[idx].email = email;
    if (name) users[idx].name = name;

    await saveUsers(users);
    res.json(users[idx]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  if (userId === 'admin-001') {
    return res.status(400).json({ message: 'The primary admin account cannot be deleted.' });
  }

  try {
    const users = await getUsers();
    const filtered = users.filter(u => u.id !== userId);
    await saveUsers(filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/users/:userId/change-password', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const { currentPassword, newPassword } = req.body;

  if (req.user.role !== 'admin' && req.user.id !== userId) {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const users = await getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return res.status(404).json({ message: 'User not found' });

    if (req.user.role !== 'admin' && users[idx].password !== currentPassword) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    users[idx].password = newPassword;
    await saveUsers(users);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ─── PROJECTS ROUTES ───

app.get('/api/debug/path', (req, res) => {
  res.json({
    cwd: process.cwd(),
    dirname: __dirname,
    home: process.env.HOME || 'Not set',
    recommendedDataDir: require('path').resolve(__dirname, '../../../omji_data/data')
  });
});

app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const projects = await getProjects();
    if (req.user.role === 'admin') {
      res.json(projects);
    } else {
      const users = await getUsers();
      const userObj = users.find(u => u.id === req.user.id);
      const assignedIds = userObj?.assignedProjectIds || [];
      res.json(projects.filter(p => assignedIds.includes(p.id)));
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/projects', authenticateToken, requireAdmin, async (req, res) => {
  const data = req.body;
  try {
    const projects = await getProjects();
    const id = generateId();
    const now = new Date().toISOString();
    const project = { id, ...data, createdAt: now, updatedAt: now };
    projects.unshift(project);
    await saveProjects(projects);
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/projects/:projectId', authenticateToken, async (req, res) => {
  const { projectId } = req.params;
  try {
    const projects = await getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    
    if (req.user.role !== 'admin') {
      const users = await getUsers();
      const userObj = users.find(u => u.id === req.user.id);
      if (!userObj?.assignedProjectIds?.includes(projectId)) {
        return res.status(403).json({ message: 'Access denied to this project' });
      }
    }

    res.json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/public/projects/slug/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const projects = await getProjects();
    const project = projects.find(p => p.slug === slug);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/projects/:projectId', authenticateToken, requireAdmin, async (req, res) => {
  const { projectId } = req.params;
  const data = req.body;
  try {
    const projects = await getProjects();
    const idx = projects.findIndex(p => p.id === projectId);
    if (idx === -1) return res.status(404).json({ message: 'Project not found' });

    projects[idx] = { ...projects[idx], ...data, updatedAt: new Date().toISOString() };
    await saveProjects(projects);
    res.json(projects[idx]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/projects/:projectId', authenticateToken, requireAdmin, async (req, res) => {
  const { projectId } = req.params;
  try {
    const projects = await getProjects();
    const filtered = projects.filter(p => p.id !== projectId);
    await saveProjects(filtered);
    await deleteProjectData(projectId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ─── TASKS ROUTES ───

app.get('/api/projects/:projectId/tasks', async (req, res) => {
  const { projectId } = req.params;
  try {
    const tasks = await getTasks(projectId);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/projects/:projectId/tasks', authenticateToken, async (req, res) => {
  const { projectId } = req.params;
  const data = req.body;
  try {
    const tasks = await getTasks(projectId);
    const id = generateId();
    const now = new Date().toISOString();
    const task = { id, ...data, createdAt: now, updatedAt: now };
    tasks.push(task);
    await saveTasks(projectId, tasks);
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/projects/:projectId/tasks/batch', authenticateToken, async (req, res) => {
  const { projectId } = req.params;
  const tasksList = req.body;
  try {
    const tasks = await getTasks(projectId);
    const now = new Date().toISOString();
    const newTasks = tasksList.map(t => ({
      id: generateId(),
      ...t,
      createdAt: now,
      updatedAt: now
    }));
    tasks.push(...newTasks);
    await saveTasks(projectId, tasks);
    res.status(201).json(newTasks.map(t => t.id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/projects/:projectId/tasks/:taskId', authenticateToken, async (req, res) => {
  const { projectId, taskId } = req.params;
  const data = req.body;
  try {
    const tasks = await getTasks(projectId);
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return res.status(404).json({ message: 'Task not found' });

    tasks[idx] = { ...tasks[idx], ...data, updatedAt: new Date().toISOString() };
    await saveTasks(projectId, tasks);
    res.json(tasks[idx]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/projects/:projectId/tasks/:taskId', authenticateToken, async (req, res) => {
  const { projectId, taskId } = req.params;
  try {
    const tasks = await getTasks(projectId);
    const filtered = tasks.filter(t => t.id !== taskId);
    await saveTasks(projectId, filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ─── PHOTOS ROUTES ───

app.get('/api/projects/:projectId/photos', async (req, res) => {
  const { projectId } = req.params;
  try {
    const photos = await getPhotos(projectId);
    res.json(photos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/projects/:projectId/photos', authenticateToken, async (req, res) => {
  const { projectId } = req.params;
  const { taskId, ...rest } = req.body;
  try {
    const photos = await getPhotos(projectId);
    const id = generateId();
    const now = new Date().toISOString();
    const photo = { id, taskId, ...rest, createdAt: now };
    photos.unshift(photo);
    await savePhotos(projectId, photos);
    res.status(201).json(photo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ─── GENERIC SUB-MODULE CRUD ROUTES ───

app.get('/api/projects/:projectId/modules/:moduleName', async (req, res) => {
  const { projectId, moduleName } = req.params;
  try {
    const data = await getModuleData(moduleName, projectId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/projects/:projectId/modules/:moduleName', authenticateToken, async (req, res) => {
  const { projectId, moduleName } = req.params;
  const record = req.body;
  try {
    const data = await getModuleData(moduleName, projectId);
    const id = generateId();
    const now = new Date().toISOString();
    const newRecord = { id, ...record, createdAt: now, updatedAt: now };
    data.push(newRecord);
    await saveModuleData(moduleName, projectId, data);
    res.status(201).json(newRecord);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/projects/:projectId/modules/:moduleName/:itemId', authenticateToken, async (req, res) => {
  const { projectId, moduleName, itemId } = req.params;
  const recordUpdate = req.body;
  try {
    const data = await getModuleData(moduleName, projectId);
    const idx = data.findIndex(i => i.id === itemId);
    if (idx === -1) return res.status(404).json({ message: 'Record not found' });

    data[idx] = { ...data[idx], ...recordUpdate, updatedAt: new Date().toISOString() };
    await saveModuleData(moduleName, projectId, data);
    res.json(data[idx]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/projects/:projectId/modules/:moduleName/:itemId', authenticateToken, async (req, res) => {
  const { projectId, moduleName, itemId } = req.params;
  try {
    const data = await getModuleData(moduleName, projectId);
    const filtered = data.filter(i => i.id !== itemId);
    await saveModuleData(moduleName, projectId, filtered);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ─── LOCAL STORAGE MULTIPART UPLOADS ───

app.post('/api/storage/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  try {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const baseName = `file-${uniqueSuffix}`;

    // Check if this is an image that we can process
    const mimeType = req.file.mimetype || '';
    let outputFilename;
    let fileUrl;

    if (mimeType.startsWith('image/')) {
      // Process with sharp: resize + convert to WebP
      outputFilename = await processAndSaveImage(req.file.buffer, UPLOADS_DIR, baseName);
    } else {
      // Non-image file: save as-is
      const ext = path.extname(req.file.originalname) || '';
      outputFilename = `${baseName}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, outputFilename), req.file.buffer);
    }

    fileUrl = `/uploads/${outputFilename}`;

    res.json({
      url: fileUrl,
      filename: outputFilename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (err) {
    console.error('Image processing error:', err);
    res.status(500).json({ message: 'Image processing failed: ' + err.message });
  }
});


// ─── DATA IMPORT / EXPORT BACKUP ROUTES ───

app.post('/api/backup/import', authenticateToken, requireAdmin, async (req, res) => {
  const backup = req.body;
  if (!backup || typeof backup !== 'object' || !Array.isArray(backup.projects)) {
    return res.status(400).json({ message: 'Invalid backup format' });
  }

  try {
    await saveProjects(backup.projects);

    if (Array.isArray(backup.users)) {
      await saveUsers(backup.users);
    }

    if (backup.tasks && typeof backup.tasks === 'object') {
      for (const pid of Object.keys(backup.tasks)) {
        await saveTasks(pid, backup.tasks[pid]);
      }
    }

    if (backup.photos && typeof backup.photos === 'object') {
      for (const pid of Object.keys(backup.photos)) {
        await savePhotos(pid, backup.photos[pid]);
      }
    }

    const allModules = [
      'expenses', 'sitelog', 'materials', 'labour', 'payments', 
      'drawings', 'checklists', 'issues', 'contacts', 'meetings', 'curing'
    ];

    for (const modName of allModules) {
      if (backup[modName] && typeof backup[modName] === 'object') {
        for (const pid of Object.keys(backup[modName])) {
          await saveModuleData(modName, pid, backup[modName][pid]);
        }
      }
    }

    res.json({ success: true, message: 'Backup successfully restored.' });
  } catch (err) {
    res.status(500).json({ message: 'Backup restoration failed: ' + err.message });
  }
});

app.get('/api/backup/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const projects = await getProjects();
    const users = await getUsers();
    
    const tasks = {};
    const photos = {};
    
    const modulesList = [
      'expenses', 'sitelog', 'materials', 'labour', 'payments', 
      'drawings', 'checklists', 'issues', 'contacts', 'meetings', 'curing'
    ];

    const moduleData = {};
    modulesList.forEach(m => { moduleData[m] = {}; });

    for (const p of projects) {
      tasks[p.id] = await getTasks(p.id);
      photos[p.id] = await getPhotos(p.id);
      
      for (const m of modulesList) {
        moduleData[m][p.id] = await getModuleData(m, p.id);
      }
    }

    res.json({
      version: '2.0',
      exportedAt: new Date().toISOString(),
      projects,
      users,
      tasks,
      photos,
      ...moduleData
    });
  } catch (err) {
    res.status(500).json({ message: 'Backup export failed: ' + err.message });
  }
});

// Serve static frontend
app.use(express.static(path.join(__dirname, '../dist')));
app.use(express.static('dist')); // Fallback if run from root
// app.use(express.static('../dist')); // Satisfy Hostinger AI regex
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
