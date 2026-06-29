const fs = require('fs/promises');
const path = require('path');



const DATA_DIR = path.join(__dirname, 'data');

// Ensure directory exists
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

// Ensure all subdirectories exist on startup
async function initDb() {
  await ensureDir(DATA_DIR);
  await ensureDir(path.join(DATA_DIR, 'tasks'));
  await ensureDir(path.join(DATA_DIR, 'photos'));
  await ensureDir(path.join(DATA_DIR, 'modules'));

  // Create empty projects and users files if they don't exist
  await writeJsonFile(path.join(DATA_DIR, 'projects.json'), [], { overwrite: false });
  await writeJsonFile(path.join(DATA_DIR, 'users.json'), [], { overwrite: false });
}

// Atomic JSON write helper
async function writeJsonFile(filePath, data, options = { overwrite: true }) {
  await ensureDir(path.dirname(filePath));
  if (options.overwrite === false) {
    try {
      await fs.access(filePath);
      return; // Already exists, skip
    } catch {
      // Doesn't exist, proceed
    }
  }
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tempPath, filePath);
}

// Read JSON helper
async function readJsonFile(filePath, defaultValue = []) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return defaultValue;
  }
}

// ─── Projects CRUD ───
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

async function getProjects() {
  return readJsonFile(PROJECTS_FILE, []);
}

async function saveProjects(projects) {
  await writeJsonFile(PROJECTS_FILE, projects);
}

// ─── Users CRUD ───
const USERS_FILE = path.join(DATA_DIR, 'users.json');

async function getUsers() {
  return readJsonFile(USERS_FILE, []);
}

async function saveUsers(users) {
  await writeJsonFile(USERS_FILE, users);
}

// ─── Tasks CRUD ───
function getTasksFilePath(projectId) {
  return path.join(DATA_DIR, 'tasks', `tasks_${projectId}.json`);
}

async function getTasks(projectId) {
  return readJsonFile(getTasksFilePath(projectId), []);
}

async function saveTasks(projectId, tasks) {
  await writeJsonFile(getTasksFilePath(projectId), tasks);
}

// ─── Photos CRUD ───
function getPhotosFilePath(projectId) {
  return path.join(DATA_DIR, 'photos', `photos_${projectId}.json`);
}

async function getPhotos(projectId) {
  return readJsonFile(getPhotosFilePath(projectId), []);
}

async function savePhotos(projectId, photos) {
  await writeJsonFile(getPhotosFilePath(projectId), photos);
}

// ─── Generic Modules CRUD ───
function getModuleFilePath(moduleName, projectId) {
  return path.join(DATA_DIR, 'modules', `module_${moduleName}_${projectId}.json`);
}

async function getModuleData(moduleName, projectId) {
  return readJsonFile(getModuleFilePath(moduleName, projectId), []);
}

async function saveModuleData(moduleName, projectId, data) {
  await writeJsonFile(getModuleFilePath(moduleName, projectId), data);
}

// Clean up all data associated with a project when deleted
async function deleteProjectData(projectId) {
  try {
    await fs.unlink(getTasksFilePath(projectId));
  } catch { }
  try {
    await fs.unlink(getPhotosFilePath(projectId));
  } catch { }

  // Clean up modules files for this project
  try {
    const modulesDir = path.join(DATA_DIR, 'modules');
    const files = await fs.readdir(modulesDir);
    for (const file of files) {
      if (file.endsWith(`_${projectId}.json`)) {
        await fs.unlink(path.join(modulesDir, file));
      }
    }
  } catch { }
}

module.exports = { initDb, getProjects, saveProjects, getUsers, saveUsers, getTasks, saveTasks, getPhotos, savePhotos, getModuleData, saveModuleData, deleteProjectData };
