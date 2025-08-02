import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';

// Mock global fetch
beforeEach(() => {
  window.fetch = vi.fn((url) => {
    if (url.includes('/mappings')) {
      // Generate 25 dummy mappings for pagination tests
      const dummyMappings = Array.from({ length: 25 }, (_, i) => ({
        shortCode: `code${String(i + 1).padStart(2, '0')}`,
        longUrl: `https://example.com/longurl${i + 1}`,
        utm_source: '',
        utm_medium: '',
        utm_campaign: '',
      }));
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: dummyMappings }),
      });
    }
    return Promise.reject(new Error('Unhandled fetch request'));
  });
});

describe('App Pagination', () => {
  it('should display the correct number of items per page initially (10)', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('code01')); // Wait for data to load

    const rows = screen.getAllByRole('row');
    // +1 for the header row
    expect(rows.length - 1).toBe(10); // Default items per page is 10
    expect(screen.getByText('code01')).toBeInTheDocument();
    expect(screen.getByText('code10')).toBeInTheDocument();
    expect(screen.queryByText('code11')).not.toBeInTheDocument();
  });

  it('should navigate to the next page', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('code01'));

    const nextPageButton = screen.getByLabelText('Next');
    fireEvent.click(nextPageButton);

    await waitFor(() => screen.getByText('code11'));
    expect(screen.getByText('code11')).toBeInTheDocument();
    expect(screen.getByText('code20')).toBeInTheDocument();
    expect(screen.queryByText('code01')).not.toBeInTheDocument();
  });

  it('should navigate to the previous page', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('code01'));

    const nextPageButton = screen.getByLabelText('Next');
    fireEvent.click(nextPageButton); // Go to page 2
    await waitFor(() => screen.getByText('code11'));

    const prevPageButton = screen.getByLabelText('Previous');
    fireEvent.click(prevPageButton); // Go back to page 1

    await waitFor(() => screen.getByText('code01'));
    expect(screen.getByText('code01')).toBeInTheDocument();
    expect(screen.queryByText('code11')).not.toBeInTheDocument();
  });

  it('should navigate to a specific page number', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('code01'));

    const page3Button = screen.getByRole('button', { name: '3' });
    fireEvent.click(page3Button);

    await waitFor(() => screen.getByText('code21'));
    expect(screen.getByText('code21')).toBeInTheDocument();
    expect(screen.getByText('code25')).toBeInTheDocument();
    expect(screen.queryByText('code01')).not.toBeInTheDocument();
    expect(screen.queryByText('code11')).not.toBeInTheDocument();
  });

  it('should hide pagination controls if there is only one page', async () => {
    // Mock fetch to return fewer items (e.g., 5 items, less than default 10 per page)
    window.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: Array.from({ length: 5 }, (_, i) => ({ shortCode: `single${i + 1}`, longUrl: `https://single.com/${i + 1}` })) }),
      })
    );

    render(<App />);
    await waitFor(() => screen.getByText('single1'));

    expect(screen.queryByLabelText('Page navigation')).not.toBeInTheDocument();
  });

  it('should change items per page and reset to the first page', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('code01'));

    // Go to page 2 first
    fireEvent.click(screen.getByLabelText('Next'));
    await waitFor(() => screen.getByText('code11'));

    // Change items per page to 5
    const itemsPerPageSelect = screen.getByLabelText('Show:');
    fireEvent.change(itemsPerPageSelect, { target: { value: '5' } });

    await waitFor(() => screen.getByText('code01')); // Should be back on page 1
    expect(screen.getAllByRole('row').length - 1).toBe(5); // Now 5 items per page
    expect(screen.getByText('code01')).toBeInTheDocument();
    expect(screen.getByText('code05')).toBeInTheDocument();
    expect(screen.queryByText('code06')).not.toBeInTheDocument();
  });

  it('should reset to the first page when search term changes', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('code01'));

    // Search for something that would be on page 1
    const searchInput = screen.getByPlaceholderText('Search mappings...');
    fireEvent.change(searchInput, { target: { value: 'code15' } });

    // Wait for the table to update to show only the search result
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // Expect 1 data row (code15) + 1 header row = 2 rows total
      expect(rows.length).toBe(2);
      expect(screen.getByText('code15')).toBeInTheDocument();
      expect(screen.queryByText('code01')).not.toBeInTheDocument(); // code01 should not be visible
      expect(screen.queryByText('code11')).not.toBeInTheDocument(); // code11 should not be visible
    });
  });
});
