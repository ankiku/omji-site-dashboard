const fs = require('fs');

let db = fs.readFileSync('server/db.js', 'utf8');
db = db.replace(/import fs from 'fs\/promises';/, "const fs = require('fs/promises');");
db = db.replace(/import path from 'path';/, "const path = require('path');");
db = db.replace(/import \{ fileURLToPath \} from 'url';/, "");
db = db.replace(/const __dirname = path.dirname\(fileURLToPath\(import\.meta\.url\)\);/, "");
db = db.replace(/export async function/g, 'async function');
if (!db.includes("module.exports")) {
  db += "\nmodule.exports = { initDb, getProjects, saveProjects, getUsers, saveUsers, getTasks, saveTasks, getPhotos, savePhotos, getModuleData, saveModuleData, deleteProjectData };\n";
}
fs.writeFileSync('server/db.js', db);

let idx = fs.readFileSync('server/index.js', 'utf8');
idx = idx.replace(/import express from 'express';/, "const express = require('express');");
idx = idx.replace(/import cors from 'cors';/, "const cors = require('cors');");
idx = idx.replace(/import dotenv from 'dotenv';/, "const dotenv = require('dotenv');");
idx = idx.replace(/import jwt from 'jsonwebtoken';/, "const jwt = require('jsonwebtoken');");
idx = idx.replace(/import path from 'path';/, "const path = require('path');");
idx = idx.replace(/import fs from 'fs';/, "const fs = require('fs');");
idx = idx.replace(/import \{ fileURLToPath \} from 'url';/, "");
idx = idx.replace(/import multer from 'multer';/, "const multer = require('multer');");
idx = idx.replace(/import \{[\s\S]*?\} from '\.\/db\.js';/, "const { initDb, getProjects, saveProjects, getUsers, saveUsers, getTasks, saveTasks, getPhotos, savePhotos, getModuleData, saveModuleData, deleteProjectData } = require('./db.js');");
idx = idx.replace(/const __dirname = path.dirname\(fileURLToPath\(import\.meta\.url\)\);/, "");
fs.writeFileSync('server/index.js', idx);

let pkg = fs.readFileSync('server/package.json', 'utf8');
pkg = pkg.replace(/\s*"type"\s*:\s*"module"\s*,/, "");
fs.writeFileSync('server/package.json', pkg);
console.log("Conversion complete.");
