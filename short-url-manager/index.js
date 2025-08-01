#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import 'dotenv/config'; // Load environment variables from .env file

// Configuration - can be overridden via environment variables
const CONFIG = {
  workerUrl: process.env.RACKET_WORKER_URL || 'https://your-worker.workers.dev',
  csvFile: process.env.RACKET_CSV_FILE || './url-mappings.csv'
};

class URLShortenerTUI {
  constructor() {
    this.mappings = new Map();
  }

  async start() {
    console.clear();
    console.log(chalk.blue.bold('🔗 URL Shortener Manager v1.0.0\n'));
    console.log(chalk.gray(`Worker URL: ${CONFIG.workerUrl}`));
    console.log(chalk.gray(`CSV File: ${path.resolve(CONFIG.csvFile)}\n`));
    console.log(chalk.yellow('Mappings are not loaded automatically. Use "Refresh mappings from KV" to load them.\n'));
    await this.showMainMenu();
  }

  async loadExistingMappings() {
    try {
      console.log(chalk.yellow('⏳ Loading URL mappings from Cloudflare KV...'));
      
      // Get list of keys from KV using wrangler
      const keysOutput = execSync('wrangler kv key list --namespace-id=bb0b757c25914a818f3d0c146371d780 --remote', {
        encoding: 'utf8',
        cwd: process.cwd()
      });
      
      const keys = JSON.parse(keysOutput);
      this.mappings.clear();
      
      // Fetch each key's value
      for (const keyObj of keys) {
        try {
          const valueOutput = execSync(`wrangler kv key get "${keyObj.name}" --namespace-id=bb0b757c25914a818f3d0c146371d780 --remote`, {
            encoding: 'utf8',
            cwd: process.cwd()
          });
          
          if (valueOutput.trim()) {
            this.mappings.set(keyObj.name, valueOutput.trim());
          }
        } catch (keyError) {
          console.log(chalk.yellow(`⚠ Could not fetch value for key: ${keyObj.name}`));
        }
      }
      
      console.log(chalk.green(`✓ Loaded ${this.mappings.size} URL mappings from Cloudflare KV\n`));
    } catch (error) {
      console.log(chalk.yellow(`⚠ Error loading from Cloudflare KV: ${error.message}\n`));
      console.log(chalk.gray('Make sure wrangler is installed and you\'re in the correct directory\n'));
      console.log(chalk.gray('Falling back to CSV file...\n'));
      await this.loadFromCSV();
    }
  }

  async showMainMenu() {
    const choices = [
      { name: '📋 List all URL mappings', value: 'list' },
      { name: '➕ Create new short URL', value: 'create' },
      { name: '❌ Delete short URL', value: 'delete' },
      { name: '🔍 Search mappings', value: 'search' },
      { name: '🔄 Refresh mappings from KV', value: 'refresh' },
      { name: '💾 Export to CSV', value: 'export' },
      { name: '⚙️ Settings', value: 'settings' },
      { name: '🚪 Exit', value: 'exit' }
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices,
        pageSize: 10
      }
    ]);

    switch (action) {
      case 'list':
        await this.listMappings();
        break;
      case 'create':
        await this.createMapping();
        break;
      case 'delete':
        await this.deleteMapping();
        break;
      case 'search':
        await this.searchMappings();
        break;
      case 'refresh':
        await this.refreshMappings();
        break;
      case 'export':
        await this.exportToCSV();
        break;
      case 'settings':
        await this.showSettings();
        break;
      case 'exit':
        console.log(chalk.blue('\n👋 Goodbye!'));
        process.exit(0);
        break;
    }

    if (action !== 'exit') {
      await this.showMainMenu();
    }
  }

  async listMappings() {
    console.log(chalk.blue.bold('\n📋 Current URL Mappings:\n'));
    
    if (this.mappings.size === 0) {
      console.log(chalk.gray('No mappings found.\n'));
    } else {
      const sortedMappings = Array.from(this.mappings.entries()).sort();
      
      for (const [shortCode, longUrl] of sortedMappings) {
        const shortUrl = `${CONFIG.workerUrl}/${shortCode}`;
        console.log(chalk.cyan(`${shortCode.padEnd(25)}`), '→', chalk.gray(longUrl));
      }
      
      console.log(chalk.green(`\n✓ Total: ${this.mappings.size} mappings\n`));
    }
    
    await this.pressEnterToContinue();
  }

  async createMapping() {
    console.log(chalk.blue.bold('\n➕ Create New Short URL\n'));

    const questions = [
      {
        type: 'input',
        name: 'longUrl',
        message: 'Enter the long URL to shorten:',
        validate: (input) => {
          if (!input.trim()) return 'URL cannot be empty';
          if (!input.startsWith('http://') && !input.startsWith('https://')) {
            return 'URL must start with http:// or https://';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'shortCode',
        message: 'Enter custom short code (leave empty for auto-generated):',
        validate: (input) => {
          if (input.trim() && this.mappings.has(input.trim())) {
            return 'This short code already exists';
          }
          if (input.trim() && !/^[a-zA-Z0-9_-]+$/.test(input.trim())) {
            return 'Short code can only contain letters, numbers, hyphens, and underscores';
          }
          return true;
        }
      }
    ];

    const answers = await inquirer.prompt(questions);
    
    try {
      // Validation happens implicitly through inquirer.prompt's validate functions
      // If validation passes, proceed to create the short URL
      console.log(chalk.yellow('\n⏳ Creating short URL...'));
      
      let shortCode = answers.shortCode.trim();
      const longUrl = answers.longUrl.trim();
      
      // Generate short code if not provided
      if (!shortCode) {
        const { nanoid } = await import('nanoid');
        
        // Generate unique short code
        do {
          shortCode = nanoid(6);
          // Check if already exists
          try {
            const existingValue = execSync(`wrangler kv key get "${shortCode}" --namespace-id=bb0b757c25914a818f3d0c146371d780 --remote`, {
              encoding: 'utf8',
              stdio: 'pipe'
            });
            if (existingValue.trim()) {
              continue; // Try another code
            }
            break; // This code is available
          } catch {
            break; // Key doesn't exist, so it's available
          }
        } while (true);
      } else {
        // Check if custom short code already exists
        try {
          const existingValue = execSync(`wrangler kv key get "${shortCode}" --namespace-id=bb0b757c25914a818f3d0c146371d780 --remote`, {
            encoding: 'utf8',
            stdio: 'pipe'
          });
          if (existingValue.trim()) {
            console.log(chalk.red(`\n❌ Error: Short code '${shortCode}' already exists\n`));
            await this.pressEnterToContinue();
            return;
          }
        } catch {
          // Key doesn't exist, so it's available
        }
      }
      
      // Create the short URL using wrangler
      execSync(`wrangler kv key put "${shortCode}" "${longUrl}" --namespace-id=bb0b757c25914a818f3d0c146371d780 --remote`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      // Update local mappings
      this.mappings.set(shortCode, longUrl);
      
      const shortUrl = `${CONFIG.workerUrl}/${shortCode}`;
      
      console.log(chalk.green('\n✅ Short URL created successfully!'));
      console.log(chalk.cyan(`Short URL: ${shortUrl}`));
      console.log(chalk.gray(`Long URL:  ${longUrl}\n`));
      
      // Auto-export to CSV
      await this.exportToCSV(false);
    } catch (error) {
      console.log(chalk.red(`\n❌ Error creating short URL: ${error.message}\n`));
      console.log(chalk.yellow('Make sure wrangler is installed and you\'re authenticated\n'));
    }

    await this.pressEnterToContinue();
  }

  async deleteMapping() {
    console.log(chalk.blue.bold('\n❌ Delete Short URL\n'));

    if (this.mappings.size === 0) {
      console.log(chalk.gray('No mappings found to delete.\n'));
      await this.pressEnterToContinue();
      return;
    }

    const sortedMappings = Array.from(this.mappings.entries()).sort();
    
    const { shortCodeToDelete } = await inquirer.prompt([
      {
        type: 'list',
        name: 'shortCodeToDelete',
        message: 'Which short URL would you like to delete?',
        choices: [
          ...sortedMappings.map(([shortCode, longUrl]) => ({
            name: `${shortCode.padEnd(25)} → ${chalk.gray(longUrl)}`,
            value: shortCode
          })),
          new inquirer.Separator(),
          { name: 'Cancel', value: null }
        ],
        pageSize: 15
      }
    ]);

    if (!shortCodeToDelete) {
      console.log(chalk.yellow('\nDeletion cancelled.\n'));
      await this.pressEnterToContinue();
      return;
    }

    const { confirmDelete } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmDelete',
        message: `Are you sure you want to delete the short URL '${chalk.cyan(shortCodeToDelete)}'? This cannot be undone.`,
        default: false
      }
    ]);

    if (confirmDelete) {
      try {
        console.log(chalk.yellow(`\n⏳ Deleting short URL '${shortCodeToDelete}'...`));

        // Delete from Cloudflare KV
        execSync(`wrangler kv key delete "${shortCodeToDelete}" --namespace-id=bb0b757c25914a818f3d0c146371d780 --remote`, {
          encoding: 'utf8',
          stdio: 'pipe'
        });

        // Delete from local mappings
        this.mappings.delete(shortCodeToDelete);

        console.log(chalk.green('\n✅ Short URL deleted successfully!\n'));
        
        // Auto-export to CSV
        await this.exportToCSV(false);

      } catch (error) {
        console.log(chalk.red(`\n❌ Error deleting short URL: ${error.message}\n`));
        console.log(chalk.yellow('Make sure wrangler is installed and you\'re authenticated\n'));
      }
    } else {
      console.log(chalk.yellow('\nDeletion cancelled.\n'));
    }

    await this.pressEnterToContinue();
  }

  async searchMappings() {
    console.log(chalk.blue.bold('\n🔍 Search URL Mappings\n'));

    const { searchTerm } = await inquirer.prompt([
      {
        type: 'input',
        name: 'searchTerm',
        message: 'Enter search term (searches both short codes and long URLs):',
        validate: (input) => input.trim() ? true : 'Search term cannot be empty'
      }
    ]);

    const term = searchTerm.toLowerCase().trim();
    const results = [];

    for (const [shortCode, longUrl] of this.mappings.entries()) {
      if (shortCode.toLowerCase().includes(term) || longUrl.toLowerCase().includes(term)) {
        results.push([shortCode, longUrl]);
      }
    }

    console.log(chalk.blue(`\n📋 Search Results for "${searchTerm}":\n`));

    if (results.length === 0) {
      console.log(chalk.gray('No matches found.\n'));
    } else {
      for (const [shortCode, longUrl] of results) {
        console.log(chalk.cyan(`${shortCode.padEnd(25)}`), '→', chalk.gray(longUrl));
      }
      console.log(chalk.green(`\n✓ Found ${results.length} matches\n`));
    }

    await this.pressEnterToContinue();
  }

  async exportToCSV(showMessage = true) {
    try {
      const csvContent = ['Short URL,Long URL'];
      
      const sortedMappings = Array.from(this.mappings.entries()).sort();
      for (const [shortCode, longUrl] of sortedMappings) {
        csvContent.push(`${shortCode},${longUrl}`);
      }

      fs.writeFileSync(CONFIG.csvFile, csvContent.join('\n'));
      
      if (showMessage) {
        console.log(chalk.green(`\n✅ Exported ${this.mappings.size} mappings to ${CONFIG.csvFile}\n`));
      }
    } catch (error) {
      console.log(chalk.red(`\n❌ Export error: ${error.message}\n`));
    }

    if (showMessage) {
      await this.pressEnterToContinue();
    }
  }

  async loadFromCSV() {
    try {
      if (fs.existsSync(CONFIG.csvFile)) {
        const csvContent = fs.readFileSync(CONFIG.csvFile, 'utf8');
        const lines = csvContent.split('\n').slice(1); // Skip header
        
        for (const line of lines) {
          if (line.trim()) {
            const [shortCode, longUrl] = line.split(',');
            if (shortCode && longUrl) {
              this.mappings.set(shortCode.trim(), longUrl.trim());
            }
          }
        }
        console.log(chalk.green(`✓ Loaded ${this.mappings.size} existing URL mappings from CSV\n`));
      } else {
        console.log(chalk.yellow(`⚠ CSV file not found at ${CONFIG.csvFile}\n`));
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠ Could not load CSV mappings: ${error.message}\n`));
    }
  }

  async refreshMappings() {
    console.log(chalk.yellow('\n⏳ Refreshing mappings from Cloudflare KV...'));
    await this.loadExistingMappings();
  }

  async showSettings() {
    console.log(chalk.blue.bold('\n⚙️  Current Settings:\n'));
    console.log(chalk.cyan('Worker URL:'), chalk.gray(CONFIG.workerUrl));
    console.log(chalk.cyan('CSV File:  '), chalk.gray(path.resolve(CONFIG.csvFile)));
    
    console.log(chalk.yellow('\n💡 To change settings, use environment variables:'));
    console.log(chalk.gray('   RACKET_WORKER_URL=https://your-worker.workers.dev'));
    console.log(chalk.gray('   RACKET_CSV_FILE=./my-mappings.csv\n'));
    
    await this.pressEnterToContinue();
  }

  async pressEnterToContinue() {
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: chalk.gray('Press Enter to continue...')
      }
    ]);
  }
}

export default URLShortenerTUI;