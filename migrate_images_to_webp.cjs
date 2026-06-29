/**
 * migrate_images_to_webp.cjs
 * -----------------------------------------------------------
 * One-time script: converts all existing JPEG/PNG/GIF/TIFF
 * images in server/public/uploads to WebP (max 1920px, q=82)
 * and patches every photo JSON file so the stored URLs
 * point to the new .webp files.
 *
 * Run from the project root:
 *   node migrate_images_to_webp.cjs
 * -----------------------------------------------------------
 */

const fs   = require('fs');
const path = require('path');
const sharp = require('./server/node_modules/sharp');

const UPLOADS_DIR = path.join(__dirname, 'server', 'public', 'uploads');
const DATA_DIR    = path.join(__dirname, 'server', 'data');
const PHOTOS_DIR  = path.join(DATA_DIR, 'photos');
const MODULES_DIR = path.join(DATA_DIR, 'modules');  // curing, drawings, etc.

// Extensions we want to convert
const CONVERT_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.tiff', '.tif', '.bmp', '.avif']);

async function convertFile(srcPath) {
  const ext  = path.extname(srcPath).toLowerCase();
  const base = path.basename(srcPath, ext);
  const destPath = path.join(UPLOADS_DIR, base + '.webp');

  if (fs.existsSync(destPath)) {
    console.log(`  ⏩ already converted: ${path.basename(destPath)}`);
    return path.basename(destPath);
  }

  await sharp(srcPath)
    .rotate()
    .resize({
      width: 1920,
      height: 1920,
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: 82 })
    .toFile(destPath);

  const srcSize  = fs.statSync(srcPath).size;
  const destSize = fs.statSync(destPath).size;
  const saved    = ((1 - destSize / srcSize) * 100).toFixed(1);
  console.log(`  ✅ ${path.basename(srcPath)} → ${path.basename(destPath)} (${(srcSize/1024).toFixed(0)} KB → ${(destSize/1024).toFixed(0)} KB, saved ${saved}%)`);

  return path.basename(destPath);
}

function patchUrl(url, renamedMap) {
  if (!url || typeof url !== 'string') return url;
  // url looks like "/uploads/file-xyz.jpg"
  const filename = url.replace('/uploads/', '');
  const newName  = renamedMap[filename];
  return newName ? `/uploads/${newName}` : url;
}

function patchRecords(records, renamedMap) {
  let changed = false;
  for (const rec of records) {
    // Photo records
    if (rec.url) {
      const newUrl = patchUrl(rec.url, renamedMap);
      if (newUrl !== rec.url) { rec.url = newUrl; changed = true; }
    }
    // Arrays of URLs (curing photos, etc.)
    if (Array.isArray(rec.photoUrls)) {
      rec.photoUrls = rec.photoUrls.map(u => {
        const nu = patchUrl(u, renamedMap);
        if (nu !== u) changed = true;
        return nu;
      });
    }
    // Drawing fileUrl
    if (rec.fileUrl) {
      const nu = patchUrl(rec.fileUrl, renamedMap);
      if (nu !== rec.fileUrl) { rec.fileUrl = nu; changed = true; }
    }
  }
  return changed;
}

async function main() {
  console.log('\n🔍 Scanning uploads directory:', UPLOADS_DIR, '\n');

  const allFiles = fs.readdirSync(UPLOADS_DIR).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return CONVERT_EXTS.has(ext);
  });

  if (allFiles.length === 0) {
    console.log('✨ No images to convert — all done!\n');
    return;
  }

  console.log(`Found ${allFiles.length} image(s) to process:\n`);

  const renamedMap = {}; // oldFilename -> newFilename

  for (const filename of allFiles) {
    const srcPath = path.join(UPLOADS_DIR, filename);
    const newName = await convertFile(srcPath);
    if (newName !== filename) {
      renamedMap[filename] = newName;
    }
  }

  const converted = Object.keys(renamedMap).length;
  console.log(`\n✅ Converted ${converted} image(s) to WebP.\n`);

  if (converted === 0) {
    console.log('No DB updates needed.\n');
    return;
  }

  // ── Patch photo JSON files ──
  console.log('📝 Patching database records...\n');

  // photos/photos_<projectId>.json
  if (fs.existsSync(PHOTOS_DIR)) {
    for (const file of fs.readdirSync(PHOTOS_DIR)) {
      if (!file.endsWith('.json')) continue;
      const fp = path.join(PHOTOS_DIR, file);
      const records = JSON.parse(fs.readFileSync(fp, 'utf-8'));
      if (patchRecords(records, renamedMap)) {
        fs.writeFileSync(fp, JSON.stringify(records, null, 2), 'utf-8');
        console.log(`  📄 Updated: photos/${file}`);
      }
    }
  }

  // modules/module_curing_<pid>.json, module_drawings_<pid>.json, etc.
  if (fs.existsSync(MODULES_DIR)) {
    for (const file of fs.readdirSync(MODULES_DIR)) {
      if (!file.endsWith('.json')) continue;
      const fp = path.join(MODULES_DIR, file);
      const records = JSON.parse(fs.readFileSync(fp, 'utf-8'));
      if (patchRecords(records, renamedMap)) {
        fs.writeFileSync(fp, JSON.stringify(records, null, 2), 'utf-8');
        console.log(`  📄 Updated: modules/${file}`);
      }
    }
  }

  console.log('\n🎉 Migration complete! Old files kept alongside new .webp files.');
  console.log('   You can delete the old originals once you have verified everything looks correct.\n');

  // Print a summary of old files to delete
  console.log('🗑️  Old files to delete (after verification):');
  for (const old of Object.keys(renamedMap)) {
    console.log(`   rm "${path.join(UPLOADS_DIR, old)}"`);
  }
  console.log('');
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
