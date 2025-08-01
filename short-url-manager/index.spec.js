import { describe, it, expect, vi, beforeEach } from 'vitest';
import URLShortenerTUI from './index.js';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import fs from 'fs';

// Mock external dependencies
vi.mock('inquirer');
vi.mock('child_process');
vi.mock('fs');
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'mockid'),
}));

// Mock console.log to prevent clutter during tests
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('URLShortenerTUI', () => {
  let tui;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'exit').mockImplementation(() => {});
    execSync.mockReturnValue('');
    fs.existsSync.mockReturnValue(false);
    tui = new URLShortenerTUI();
    consoleSpy.mockClear();
    inquirer.prompt.mockClear();
  });

  it('should start and display the main menu, then list mappings and exit', async () => {
    inquirer.prompt
      .mockResolvedValueOnce({ action: 'list' })
      .mockResolvedValueOnce({ continue: '' })
      .mockResolvedValueOnce({ action: 'exit' });

    await tui.start();

    const consoleOutput = consoleSpy.mock.calls.flat().join('\n');
    expect(consoleOutput).toContain('SnapURL');
    expect(inquirer.prompt).toHaveBeenCalledTimes(3);
    expect(consoleOutput).toContain('📋 Current URL Mappings:');
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  describe('loadExistingMappings', () => {
    it('should load mappings from Cloudflare KV', async () => {
      execSync.mockReturnValueOnce(JSON.stringify([{ name: 'test1' }, { name: 'test2' }]));
      execSync.mockReturnValueOnce('https://longurl1.com');
      execSync.mockReturnValueOnce('https://longurl2.com');

      await tui.loadExistingMappings();

      expect(tui.mappings.get('test1')).toBe('https://longurl1.com');
      expect(tui.mappings.get('test2')).toBe('https://longurl2.com');
      expect(consoleSpy.mock.calls.flat().join('\n')).toContain('✓ Loaded 2 URL mappings from Cloudflare KV');
    });

    it('should handle error when listing KV keys and fall back to CSV', async () => {
      execSync.mockImplementationOnce(() => {
        throw new Error('Wrangler error');
      });
      fs.existsSync.mockReturnValueOnce(true);
      fs.readFileSync.mockReturnValueOnce('Short URL,Long URL\ncsv1,https://csvurl1.com');

      await tui.loadExistingMappings();

      expect(consoleSpy.mock.calls.flat().join('\n')).toContain('⚠ Error loading from Cloudflare KV: Wrangler error');
      expect(consoleSpy.mock.calls.flat().join('\n')).toContain('Falling back to CSV file...');
      expect(tui.mappings.get('csv1')).toBe('https://csvurl1.com');
    });

    it('should handle error when fetching a single KV key', async () => {
      execSync.mockReturnValueOnce(JSON.stringify([{ name: 'test1' }, { name: 'test2' }]));
      execSync.mockImplementationOnce(() => {
        throw new Error('Key fetch error');
      });
      execSync.mockReturnValueOnce('https://longurl2.com');

      await tui.loadExistingMappings();

      expect(consoleSpy.mock.calls.flat().join('\n')).toContain('⚠ Could not fetch value for key: test1');
      expect(tui.mappings.has('test1')).toBe(false);
      expect(tui.mappings.get('test2')).toBe('https://longurl2.com');
    });
  });

  describe('listMappings', () => {
    it('should display a message when no mappings are found', async () => {
      inquirer.prompt.mockResolvedValueOnce({ continue: '' });

      await tui.listMappings();

      const consoleOutput = consoleSpy.mock.calls.flat().join('\n');
      expect(consoleOutput).toContain('No mappings found.');
      expect(consoleOutput).toContain('📋 Current URL Mappings:');
      expect(inquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'input',
          name: 'continue',
          message: expect.any(String),
        },
      ]);
    });

    it('should display existing mappings', async () => {
      tui.mappings.set('test1', 'https://longurl1.com');
      tui.mappings.set('test2', 'https://longurl2.com');
      inquirer.prompt.mockResolvedValueOnce({ continue: '' });

      await tui.listMappings();

      const consoleOutput = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(consoleOutput).toContain('📋 Current URL Mappings:');
      expect(consoleOutput).toContain('test1                     → https://longurl1.com');
      expect(consoleOutput).toContain('test2                     → https://longurl2.com');
      expect(consoleOutput).toContain('✓ Total: 2 mappings');
      expect(inquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'input',
          name: 'continue',
          message: expect.any(String),
        },
      ]);
    });
  });

  describe('createMapping', () => {
    it('should create a new mapping with a custom short code', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({ longUrl: 'https://example.com', shortCode: 'custom' })
        .mockResolvedValueOnce({ continue: '' });
      execSync.mockReturnValueOnce(''); // For the KV get check
      execSync.mockReturnValueOnce(''); // For the KV put

      await tui.createMapping();

      expect(execSync).toHaveBeenCalledWith('wrangler kv key get "custom" --namespace-id=bb0b757c25914a818f3d0c146371d780 --remote', { encoding: 'utf8', stdio: 'pipe' });
      expect(execSync).toHaveBeenCalledWith('wrangler kv key put "custom" "https://example.com" --namespace-id=bb0b757c25914a818f3d0c146371d780 --remote', { encoding: 'utf8', stdio: 'pipe' });
      expect(tui.mappings.get('custom')).toBe('https://example.com');
    });

    it('should create a new mapping with an auto-generated short code', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({ longUrl: 'https://example.com', shortCode: '' })
        .mockResolvedValueOnce({ continue: '' });
      execSync.mockReturnValueOnce(''); // For the KV get check
      execSync.mockReturnValueOnce(''); // For the KV put

      await tui.createMapping();

      expect(execSync).toHaveBeenCalledWith('wrangler kv key get "mockid" --namespace-id=bb0b757c25914a818f3d0c146371d780 --remote', { encoding: 'utf8', stdio: 'pipe' });
      expect(execSync).toHaveBeenCalledWith('wrangler kv key put "mockid" "https://example.com" --namespace-id=bb0b757c25914a818f3d0c146371d780 --remote', { encoding: 'utf8', stdio: 'pipe' });
      expect(tui.mappings.get('mockid')).toBe('https://example.com');
    });

    it('should not create a mapping if custom short code already exists', async () => {
      tui.mappings.set('existing', 'https://existing.com');
      inquirer.prompt
        .mockResolvedValueOnce({ longUrl: 'https://new.com', shortCode: 'existing' })
        .mockResolvedValueOnce({ continue: '' });
      execSync.mockReturnValueOnce('https://existing.com'); // Simulate existing key in KV

      await tui.createMapping();

      expect(execSync).toHaveBeenCalledWith('wrangler kv key get "existing" --namespace-id=bb0b757c25914a818f3d0c146371d780 --remote', { encoding: 'utf8', stdio: 'pipe' });
      expect(execSync).not.toHaveBeenCalledWith(expect.stringContaining('wrangler kv key put'));
      expect(consoleSpy.mock.calls.flat().join('\n')).toContain(`❌ Error: Short code 'existing' already exists`);
    });

    it('should handle invalid long URL input', async () => {
      inquirer.prompt.mockResolvedValueOnce({ longUrl: 'invalid-url', shortCode: 'test' });
            await tui.createMapping();
      const consoleOutput = consoleSpy.mock.calls.flat().join('\n');
      expect(consoleOutput).toContain('URL must start with http:// or https://');
      expect(execSync).not.toHaveBeenCalled();
    });

    it('should handle invalid short code input', async () => {
      inquirer.prompt.mockResolvedValueOnce({ longUrl: 'https://example.com', shortCode: 'invalid code!' });
            await tui.createMapping();
      const consoleOutput = consoleSpy.mock.calls.flat().join('\n');
      expect(consoleOutput).toContain('Short code can only contain letters, numbers, hyphens, and underscores');
      expect(execSync).not.toHaveBeenCalled();
    });
  });

  describe('deleteMapping', () => {
    it('should delete a mapping', async () => {
      tui.mappings.set('test1', 'https://longurl1.com');
      inquirer.prompt
        .mockResolvedValueOnce({ shortCodeToDelete: 'test1' })
        .mockResolvedValueOnce({ confirmDelete: true })
        .mockResolvedValueOnce({ continue: '' });
      execSync.mockReturnValueOnce(''); // For the KV delete

      await tui.deleteMapping();

      expect(execSync).toHaveBeenCalledWith('wrangler kv key delete "test1" --namespace-id=bb0b757c25914a818f3d0c146371d780 --remote', { encoding: 'utf8', stdio: 'pipe' });
      expect(tui.mappings.has('test1')).toBe(false);
      expect(consoleSpy.mock.calls.flat().join('\n')).toContain('✅ Short URL deleted successfully!');
    });

    it('should not delete if no mappings exist', async () => {
      inquirer.prompt.mockResolvedValueOnce({ continue: '' });

      await tui.deleteMapping();

      expect(consoleSpy.mock.calls.flat().join('\n')).toContain('No mappings found to delete.');
      expect(execSync).not.toHaveBeenCalled();
    });

    it('should not delete if deletion is cancelled', async () => {
      tui.mappings.set('test1', 'https://longurl1.com');
      inquirer.prompt
        .mockResolvedValueOnce({ shortCodeToDelete: 'test1' })
        .mockResolvedValueOnce({ confirmDelete: false })
        .mockResolvedValueOnce({ continue: '' });

      await tui.deleteMapping();

      expect(consoleSpy.mock.calls.flat().join('\n')).toContain('Deletion cancelled.');
      expect(execSync).not.toHaveBeenCalled();
      expect(tui.mappings.has('test1')).toBe(true);
    });

    it('should handle error during deletion', async () => {
      tui.mappings.set('test1', 'https://longurl1.com');
      inquirer.prompt
        .mockResolvedValueOnce({ shortCodeToDelete: 'test1' })
        .mockResolvedValueOnce({ confirmDelete: true })
        .mockResolvedValueOnce({ continue: '' });
      execSync.mockImplementationOnce(() => {
        throw new Error('Delete error');
      });

      await tui.deleteMapping();

      expect(consoleSpy.mock.calls.flat().join('\n')).toContain('❌ Error deleting short URL: Delete error');
      expect(tui.mappings.has('test1')).toBe(true); // Should not be deleted locally on error
    });
  });

  describe('searchMappings', () => {
    beforeEach(() => {
      tui.mappings.set('apple', 'https://fruit.com/apple');
      tui.mappings.set('banana', 'https://fruit.com/banana');
      tui.mappings.set('orange', 'https://citrus.com/orange');
    });

    it('should find mappings by short code', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({ searchTerm: 'apple' })
        .mockResolvedValueOnce({ continue: '' });

      await tui.searchMappings();

      const consoleOutput = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(consoleOutput).toContain('apple                     → https://fruit.com/apple');
      expect(consoleOutput).not.toContain('banana');
      expect(consoleOutput).not.toContain('orange');
      expect(consoleOutput).toContain('✓ Found 1 matches');
    });

    it('should find mappings by long URL', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({ searchTerm: 'fruit' })
        .mockResolvedValueOnce({ continue: '' });

      await tui.searchMappings();

      const consoleOutput = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(consoleOutput).toContain('apple                     → https://fruit.com/apple');
      expect(consoleOutput).toContain('banana                    → https://fruit.com/banana');
      expect(consoleOutput).not.toContain('orange');
      expect(consoleOutput).toContain('✓ Found 2 matches');
    });

    it('should display a message when no matches are found', async () => {
      inquirer.prompt
        .mockResolvedValueOnce({ searchTerm: 'xyz' })
        .mockResolvedValueOnce({ continue: '' });

      await tui.searchMappings();

      const consoleOutput = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(consoleOutput).toContain('No matches found.');
      expect(consoleOutput).not.toContain('✓ Found');
    });

    it('should handle empty search term input', async () => {
      inquirer.prompt.mockResolvedValueOnce({ searchTerm: '' });
            await tui.searchMappings();
      const consoleOutput = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(consoleOutput).toContain('Search Results for "":');
      expect(consoleOutput).toContain('✓ Found 3 matches');
    });
  });

  describe('exportToCSV', () => {
    it('should export mappings to a CSV file', async () => {
      tui.mappings.set('test1', 'https://longurl1.com');
      tui.mappings.set('test2', 'https://longurl2.com');
      inquirer.prompt.mockResolvedValueOnce({ continue: '' });

      await tui.exportToCSV();

      expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), 'Short URL,Long URL\ntest1,https://longurl1.com\ntest2,https://longurl2.com');
      expect(consoleSpy.mock.calls.flat().join('\n')).toContain('✅ Exported 2 mappings to');
    });

    it('should handle error during CSV export', async () => {
      fs.writeFileSync.mockImplementationOnce(() => {
        throw new Error('Write error');
      });
      inquirer.prompt.mockResolvedValueOnce({ continue: '' });

      await tui.exportToCSV();

      expect(consoleSpy.mock.calls.flat().join('\n')).toContain('❌ Export error: Write error');
    });
  });

  describe('loadFromCSV', () => {
    it('should load mappings from a CSV file', async () => {
      fs.existsSync.mockReturnValueOnce(true);
      fs.readFileSync.mockReturnValueOnce('Short URL,Long URL\ncsv1,https://csvurl1.com\ncsv2,https://csvurl2.com');

      await tui.loadFromCSV();

      expect(tui.mappings.get('csv1')).toBe('https://csvurl1.com');
      expect(tui.mappings.get('csv2')).toBe('https://csvurl2.com');
      expect(consoleSpy.mock.calls.flat().join('\n')).toContain('✓ Loaded 2 existing URL mappings from CSV');
    });

    it('should display a warning if CSV file does not exist', async () => {
      fs.existsSync.mockReturnValueOnce(false);

      await tui.loadFromCSV();

      expect(consoleSpy.mock.calls.flat().join('\n')).toContain('⚠ CSV file not found at');
    });

    it('should handle error during CSV load', async () => {
      fs.existsSync.mockReturnValueOnce(true);
      fs.readFileSync.mockImplementationOnce(() => {
        throw new Error('Read error');
      });

      await tui.loadFromCSV();

      expect(consoleSpy.mock.calls.flat().join('\n')).toContain('⚠ Could not load CSV mappings: Read error');
    });
  });

  describe('showSettings', () => {
    it('should display the current settings', async () => {
      inquirer.prompt.mockResolvedValueOnce({ continue: '' });

      await tui.showSettings();

      const consoleOutput = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(consoleOutput).toContain('Worker URL:');
      expect(consoleOutput).toContain('CSV File:');
    });
  });
});