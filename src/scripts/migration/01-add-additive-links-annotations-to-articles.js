#!/usr/bin/env node

/**
 * Migration script to add {.additive} annotations to additive links in markdown articles
 *
 * This script scans all article.md files in data/additive/ and adds {.additive} annotation
 * to links that point to other additive pages (format: /eNNN-name or /eNNNa-name, etc.)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pattern to match additive links that don't already have {.additive}
// Matches: [text](/e123-name) but NOT [text](/e123-name){.additive}
const ADDITIVE_LINK_PATTERN = /\[([^\]]+)\]\((\/e\d+[a-z]*-[^)]+)\)(?!\{\.additive\})/g;

// Pattern to check if link is to an additive page
const ADDITIVE_PATH_PATTERN = /^\/e\d+[a-z]*-/;

function isAdditiveLink(href) {
  return ADDITIVE_PATH_PATTERN.test(href);
}

function migrateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let matchCount = 0;

  const newContent = content.replace(ADDITIVE_LINK_PATTERN, (match, text, href) => {
    if (isAdditiveLink(href)) {
      matchCount++;
      modified = true;
      return `[${text}](${href}){.additive}`;
    }
    return match;
  });

  if (modified) {
    fs.writeFileSync(filePath, newContent, 'utf8');
  }

  return { modified, matchCount };
}

function findArticleFiles(dir) {
  const files = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name === 'article.md') {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

function main() {
  const dataDir = path.resolve(__dirname, '../../../data/additive');

  if (!fs.existsSync(dataDir)) {
    console.error(`Error: Directory not found: ${dataDir}`);
    process.exit(1);
  }

  console.log('🔍 Scanning for article files...\n');

  const articleFiles = findArticleFiles(dataDir);

  console.log(`Found ${articleFiles.length} article files\n`);
  console.log('📝 Processing articles...\n');

  let totalProcessed = 0;
  let totalModified = 0;
  let totalLinksAdded = 0;

  for (const filePath of articleFiles) {
    const relativePath = path.relative(dataDir, filePath);
    const { modified, matchCount } = migrateFile(filePath);

    totalProcessed++;

    if (modified) {
      totalModified++;
      totalLinksAdded += matchCount;
      console.log(`✅ ${relativePath} - Added {.additive} to ${matchCount} link(s)`);
    } else {
      console.log(`⏭️  ${relativePath} - No changes needed`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:');
  console.log('='.repeat(60));
  console.log(`Total articles processed: ${totalProcessed}`);
  console.log(`Articles modified: ${totalModified}`);
  console.log(`Total {.additive} annotations added: ${totalLinksAdded}`);
  console.log('='.repeat(60));

  if (totalModified > 0) {
    console.log('\n✨ Migration completed successfully!');
  } else {
    console.log('\n✨ All articles already have {.additive} annotations!');
  }
}

main();
