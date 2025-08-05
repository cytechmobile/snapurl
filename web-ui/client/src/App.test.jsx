import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import './setupTests.js'; // Ensure mocks are loaded

describe('App component', () => {
  beforeEach(() => {
    // Reset mocks before each test to ensure isolation
    window.fetch.mockClear();

    // Mock the fetch function to return some initial data
    window.fetch.mockImplementation((url) => {
      if (url.includes('/mappings')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: [
                {
                  shortCode: 'test1',
                  longUrl: 'https://example.com/test1',
                  utm_source: 'google',
                  utm_medium: 'cpc',
                  utm_campaign: 'summer_sale',
                },
                {
                  shortCode: 'test2',
                  longUrl: 'https://example.com/test2',
                  utm_source: 'facebook',
                  utm_medium: 'social',
                  utm_campaign: 'winter_promo',
                },
              ],
            }),
        });
      }
      if (url.includes('/user')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ user: { id: 'test-user', displayName: 'Test User' } }),
        });
      }
      return Promise.reject(new Error(`Unhandled fetch request for url: ${url}`));
    });
  });

  it('should render the main application layout and fetch initial data', async () => {
    render(<App />);

    // Check for header
    expect(screen.getByText('🔗 SnapURL')).toBeInTheDocument();
    expect(await screen.findByText('Welcome, Test User!')).toBeInTheDocument();

    // Check for the main content sections
    expect(screen.getByText('Short URL Hostname:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create New/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search mappings.../i)).toBeInTheDocument();

    // Wait for the table to be populated
    const table = await screen.findByTestId('mappings-table');

    // Check if the initial mappings are rendered
    expect(within(table).getByText('test1')).toBeInTheDocument();
    expect(within(table).getByText('https://example.com/test1')).toBeInTheDocument();
    expect(within(table).getByText('test2')).toBeInTheDocument();
    expect(within(table).getByText('https://example.com/test2')).toBeInTheDocument();
  });
});
