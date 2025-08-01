import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

describe('App component', () => {
  it('should open the edit modal with pre-filled data when edit button is clicked', async () => {
    // Mock the fetch function to return some initial data
    window.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [{ shortCode: 'test', longUrl: 'https://example.com' }] }),
      })
    );

    render(<App />);

    // Wait for the mappings to be loaded and displayed
    await waitFor(() => screen.getByText('test'));

    // Find and click the edit button
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    // The modal should now be open
    await waitFor(() => screen.getByRole('dialog'));

    // Check if the modal is pre-filled with the correct data
    expect(screen.getByRole('textbox', { name: /Long URL/i }).value).toBe('https://example.com');
    expect(screen.getByRole('textbox', { name: /Short Code/i }).value).toBe('test');
  });
});
