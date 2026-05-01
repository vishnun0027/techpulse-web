#!/usr/bin/env node

/**
 * Deploy Supabase Functions using Management API
 * Usage: node deploy-functions.js <project-id> <access-token>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectId = process.argv[2] || 'dhnujdduifibmalkyzhi';
const accessToken = process.argv[3] || process.env.SUPABASE_ACCESS_TOKEN;

if (!accessToken) {
  console.error('Error: No access token provided');
  console.error('Usage: node deploy-functions.js <project-id> <access-token>');
  process.exit(1);
}

const functions = [
  {
    name: 'admin-get-platform-intelligence',
    path: './supabase/functions/admin-get-platform-intelligence/index.ts',
  },
  {
    name: 'admin-get-brief-report',
    path: './supabase/functions/admin-get-brief-report/index.ts',
  },
];

async function deployFunction(name, filePath) {
  const code = fs.readFileSync(filePath, 'utf-8');
  
  try {
    // Try creating the function first (POST)
    let response = await fetch(
      `https://api.supabase.com/v1/projects/${projectId}/functions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name,
          slug: name,
          body: code,
        }),
      }
    );

    // If 409 (conflict), try updating instead (PATCH)
    if (response.status === 409) {
      response = await fetch(
        `https://api.supabase.com/v1/projects/${projectId}/functions/${name}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            slug: name,
            body: code,
          }),
        }
      );
    }

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Failed to deploy ${name}:`, response.status, error);
      return false;
    }

    const result = await response.json();
    console.log(`✅ Successfully deployed ${name}`);
    console.log(`   URL: https://${projectId}.supabase.co/functions/v1/${name}`);
    return true;
  } catch (error) {
    console.error(`❌ Error deploying ${name}:`, error.message);
    return false;
  }
}

async function main() {
  console.log(`🚀 Deploying functions to project ${projectId}...\n`);
  
  const results = [];
  for (const func of functions) {
    const fullPath = path.join(__dirname, func.path);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ File not found: ${fullPath}`);
      results.push(false);
      continue;
    }
    const result = await deployFunction(func.name, fullPath);
    results.push(result);
  }

  console.log('\n' + '='.repeat(50));
  const successful = results.filter(Boolean).length;
  console.log(`${successful}/${results.length} functions deployed successfully`);
  
  if (successful === results.length) {
    console.log('\n✅ Deployment complete!');
    console.log('\nNext steps:');
    console.log('1. Start dev server: npm run dev');
    console.log('2. Log in as an operator');
    console.log('3. Test AdminView and MorningBriefView');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main();
