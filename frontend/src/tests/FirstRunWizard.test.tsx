import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FirstRunWizard from '../components/FirstRunWizard';

vi.mock('../api', () => ({
  api: {
    settings: {
      get: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { api } from '../api';

describe('FirstRunWizard', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders welcome message and key input', () => {
    render(<FirstRunWizard onComplete={mockOnComplete} />);
    expect(screen.getByText(/Welcome to PatentForge/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/sk-ant-/i)).toBeTruthy();
    expect(screen.getByText(/Validate Key/i)).toBeTruthy();
    expect(screen.getByText(/Skip for Now/i)).toBeTruthy();
  });

  it('calls onComplete when Skip is clicked', async () => {
    render(<FirstRunWizard onComplete={mockOnComplete} />);
    fireEvent.click(screen.getByText(/Skip for Now/i));
    expect(mockOnComplete).toHaveBeenCalledWith(false);
  });

  it('shows error for empty key on validate', async () => {
    render(<FirstRunWizard onComplete={mockOnComplete} />);
    fireEvent.click(screen.getByText(/Validate Key/i));
    await waitFor(() => {
      expect(screen.getByText(/Please enter an API key/i)).toBeTruthy();
    });
  });

  it('validates and saves a valid key', async () => {
    vi.useFakeTimers();
    (api.settings.update as any).mockResolvedValue({});
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ type: 'message' }),
    }) as any;

    render(<FirstRunWizard onComplete={mockOnComplete} />);
    const input = screen.getByPlaceholderText(/sk-ant-/i);
    fireEvent.change(input, { target: { value: 'sk-ant-test-key-123' } });
    fireEvent.click(screen.getByText(/Validate Key/i));

    // Wait for the async validation to complete
    await vi.waitFor(() => {
      expect(screen.getByText(/validated and saved/i)).toBeTruthy();
    });

    // Advance past the 1200ms delay
    await vi.advanceTimersByTimeAsync(1500);

    expect(mockOnComplete).toHaveBeenCalledWith(true);
    vi.useRealTimers();
  });

  it('shows error for invalid key', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { message: 'invalid x-api-key' } }),
    }) as any;

    render(<FirstRunWizard onComplete={mockOnComplete} />);
    const input = screen.getByPlaceholderText(/sk-ant-/i);
    fireEvent.change(input, { target: { value: 'bad-key' } });
    fireEvent.click(screen.getByText(/Validate Key/i));

    await waitFor(() => {
      expect(screen.getByText(/Invalid API key/i)).toBeTruthy();
    });
    expect(mockOnComplete).not.toHaveBeenCalled();
  });
});
