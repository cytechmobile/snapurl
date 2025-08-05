import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LinkModal from './LinkModal';
import './setupTests.js'; // Ensure mocks are loaded

describe('LinkModal component', () => {
  const onSave = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    onSave.mockClear();
    onClose.mockClear();
    window.fetch.mockClear();

    window.fetch.mockImplementation((url) => {
      if (url.includes('/validate-url')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ isValid: true, message: '' }),
        });
      }
      return Promise.reject(new Error(`Unhandled fetch request for url: ${url}`));
    });
  });

  it('should render without crashing', () => {
    render(
      <LinkModal
        initialData={{}}
        onClose={onClose}
        onSave={onSave}
        existingShortCodes={[]}
      />
    );
    expect(screen.getByText(/Create New Short URL/i)).toBeInTheDocument();
  });

  it('should call onSave with the correct data when creating a new link', async () => {
    render(
      <LinkModal
        initialData={{}}
        onClose={onClose}
        onSave={onSave}
        existingShortCodes={[]}
      />
    );

    // Fill out the form
    const longUrlInput = screen.getByLabelText(/Long URL/i);
    const customShortCodeInput = screen.getByLabelText(/Custom Short Code/i);
    const utmSourceInput = screen.getByLabelText(/UTM Source/i);

    fireEvent.change(longUrlInput, { target: { value: 'https://example.com/new-link' } });
    fireEvent.change(customShortCodeInput, { target: { value: 'new-link' } });
    fireEvent.change(utmSourceInput, { target: { value: 'test-source' } });

    // Trigger blur to initiate validation and advance timers
    fireEvent.blur(longUrlInput);
    vi.advanceTimersByTime(500); // Advance by debounce delay

    // Wait for URL validation message to appear and button to be enabled
    await waitFor(() => {
      expect(screen.getByText('URL is reachable.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create/i })).not.toBeDisabled();
    });

    // Submit the form
    const saveButton = screen.getByRole('button', { name: /Create/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        longUrl: 'https://example.com/new-link',
        customShortCode: 'new-link',
        utm_source: 'test-source',
        utm_medium: '',
        utm_campaign: '',
      });
    });
  });

  it('should call onSave with the correct data when updating an existing link', async () => {
    const initialData = {
      shortCode: 'existing-code',
      longUrl: 'https://example.com/old-link',
      utm_source: 'old-source',
      utm_medium: 'old-medium',
      utm_campaign: 'old-campaign',
    };

    render(
      <LinkModal
        initialData={initialData}
        onClose={onClose}
        onSave={onSave}
        existingShortCodes={['existing-code']}
      />
    );

    // Check if fields are pre-filled
    expect(screen.getByLabelText(/Long URL/i)).toHaveValue('https://example.com/old-link');
    expect(screen.getByLabelText(/Short Code/i)).toHaveValue('existing-code');
    expect(screen.getByLabelText(/UTM Source/i)).toHaveValue('old-source');

    // Change a value
    fireEvent.change(screen.getByLabelText(/Long URL/i), { target: { value: 'https://example.com/updated-link' } });

    // Trigger blur to initiate validation
    fireEvent.blur(screen.getByLabelText(/Long URL/i));

    // Wait for URL validation to complete and message to appear
    await waitFor(() => {
      expect(screen.getByText('URL is reachable.')).toBeInTheDocument();
    });

    // Submit the form
    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    }, { timeout: 2000 });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        shortCode: 'existing-code',
        longUrl: 'https://example.com/updated-link',
        utm_source: 'old-source',
        utm_medium: 'old-medium',
        utm_campaign: 'old-campaign',
      });
    });
  });

  it('should call onClose when the Cancel button is clicked', async () => {
    render(
      <LinkModal
        initialData={{}}
        onClose={onClose}
        onSave={onSave}
        existingShortCodes={[]}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('should show an error if Long URL is invalid', async () => {
    window.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ isValid: false, message: 'URL is not reachable.' }),
      })
    );

    render(
      <LinkModal
        initialData={{}}
        onClose={onClose}
        onSave={onSave}
        existingShortCodes={[]}
      />
    );

    const longUrlInput = screen.getByLabelText(/Long URL/i);
    fireEvent.change(longUrlInput, { target: { value: 'invalid-url' } });

    fireEvent.blur(longUrlInput);

    await waitFor(() => {
      expect(screen.getByText('URL is not reachable.')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /Create/i });
    fireEvent.click(saveButton);

    expect(onSave).not.toHaveBeenCalled();
  });

  it('should show an error if Custom Short Code is empty for a new link', async () => {
    render(
      <LinkModal
        initialData={{}}
        onClose={onClose}
        onSave={onSave}
        existingShortCodes={[]}
      />
    );

    const longUrlInput = screen.getByLabelText(/Long URL/i);
    fireEvent.change(longUrlInput, { target: { value: 'https://example.com' } });

    const customShortCodeInput = screen.getByLabelText(/Custom Short Code/i);
    fireEvent.change(customShortCodeInput, { target: { value: '' } });

    fireEvent.blur(longUrlInput);

    await waitFor(() => {
      expect(screen.getByText('URL is reachable.')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /Create/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Short code cannot be empty.')).toBeInTheDocument();
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('should show an error if Custom Short Code already exists', async () => {
    render(
      <LinkModal
        initialData={{}}
        onClose={onClose}
        onSave={onSave}
        existingShortCodes={['existing-code']}
      />
    );

    const longUrlInput = screen.getByLabelText(/Long URL/i);
    fireEvent.change(longUrlInput, { target: { value: 'https://example.com' } });

    const customShortCodeInput = screen.getByLabelText(/Custom Short Code/i);
    fireEvent.change(customShortCodeInput, { target: { value: 'existing-code' } });

    fireEvent.blur(longUrlInput);

    await waitFor(() => {
      expect(screen.getByText('URL is reachable.')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /Create/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Short code already exists.')).toBeInTheDocument();
    });
    expect(onSave).not.toHaveBeenCalled();
  });
});