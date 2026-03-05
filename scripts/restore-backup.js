#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Restore backup script
 * 
 * This script:
 * 1. Copies the content of example/backup.js to example/index.js
 * 2. Removes all files in example/ except backup.js and index.js
 */

const EXAMPLE_DIR = path.join(__dirname, '..', 'example');
const BACKUP_FILE = path.join(EXAMPLE_DIR, 'backup.js');
const INDEX_FILE = path.join(EXAMPLE_DIR, 'index.js');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function restoreBackup() {
  console.log('\n📦 Restoring backup...\n');

  // Check if example directory exists
  if (!fs.existsSync(EXAMPLE_DIR)) {
    log('✗ Example directory does not exist', 'red');
    process.exit(1);
  }

  // Check if backup.js exists
  if (!fs.existsSync(BACKUP_FILE)) {
    log('✗ backup.js file does not exist in example/', 'red');
    process.exit(1);
  }

  // Read backup content
  const backupContent = fs.readFileSync(BACKUP_FILE, 'utf8');
  log('✓ Read backup.js content', 'green');

  // Get all files in example directory
  const files = fs.readdirSync(EXAMPLE_DIR);
  log(`\n📁 Files in example/: ${files.join(', ')}`, 'cyan');

  // Delete all files except backup.js and index.js
  const filesToKeep = ['backup.js', 'index.js'];
  const filesToDelete = files.filter(file => !filesToKeep.includes(file));

  if (filesToDelete.length > 0) {
    log('\n🗑️  Deleting files:', 'yellow');
    for (const file of filesToDelete) {
      const filePath = path.join(EXAMPLE_DIR, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
        log(`  ✓ Removed directory: ${file}`, 'green');
      } else {
        fs.unlinkSync(filePath);
        log(`  ✓ Deleted: ${file}`, 'green');
      }
    }
  }

  // Write backup content to index.js
  fs.writeFileSync(INDEX_FILE, backupContent, 'utf8');
  log('\n✓ Restored index.js from backup.js', 'green');

  // Final state
  const remainingFiles = fs.readdirSync(EXAMPLE_DIR);
  log(`\n📋 Final files in example/: ${remainingFiles.join(', ')}`, 'cyan');
  
  console.log('\n✅ Backup restored successfully!\n');
}

// Run the restore
restoreBackup();
