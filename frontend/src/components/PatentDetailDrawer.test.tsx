import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PatentDetailDrawer from './PatentDetailDrawer';

// Mock the api module
vi.mock('../api', () => ({
  api: {
    patents: {
      getDetail: vi.fn(),
      getClaims: vi.fn(),
    },
  },
}));

import { api } from '../api';

const mockDetail = {
  patentNumber: 'US10234567B2',
  title: 'Method for Widget Processing',
  abstract: 'A method and system for processing widgets.',
  filingDate: '2021-03-15',
  grantDate: '2023-06-20',
  assignee: ['Acme Corp', 'Widget LLC'],
  inventors: ['John Smith', 'Jane Doe'],
  cpcClassifications: [
    { code: 'G06N3/08', title: 'Learning methods' },
    { code: 'G06F16/00', title: 'Information retrieval' },
  ],
  claimsText: '1. A method comprising: step a; step b.',
  claimCount: 12,
  patentType: 'utility',
};

describe('PatentDetailDrawer', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when patentNumber is null', () => {
    const { container } = render(
      <PatentDetailDrawer patentNumber={null} onClose={onClose} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows loading skeleton while fetching', () => {
    // Never resolve the promise — stays in loading state
    (api.patents.getDetail as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    render(<PatentDetailDrawer patentNumber="US10234567B2" onClose={onClose} />);

    // Should show the overlay backdrop
    expect(screen.getByText('Patent Detail')).toBeInTheDocument();
    // Loading skeleton has animated pulse divs — check the container has content
    expect(document.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('displays patent details after successful fetch', async () => {
    (api.patents.getDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockDetail);

    render(<PatentDetailDrawer patentNumber="US10234567B2" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Method for Widget Processing')).toBeInTheDocument();
    });

    expect(screen.getByText('2021-03-15')).toBeInTheDocument();
    expect(screen.getByText('2023-06-20')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Widget LLC')).toBeInTheDocument();
    expect(screen.getByText('John Smith, Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('utility')).toBeInTheDocument();
    expect(screen.getByText('G06N3/08')).toBeInTheDocument();
    expect(screen.getByText('Learning methods')).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    (api.patents.getDetail as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('PatentsView API shutdown')
    );

    render(<PatentDetailDrawer patentNumber="US10234567B2" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Patent detail unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText(/PatentsView API has been shut down/)).toBeInTheDocument();
  });

  it('shows Google Patents link in header', async () => {
    (api.patents.getDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockDetail);

    render(<PatentDetailDrawer patentNumber="US10234567B2" onClose={onClose} />);

    const link = screen.getByText(/Google Patents/);
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute(
      'href',
      'https://patents.google.com/patent/US10234567B2'
    );
  });

  it('toggles claims section on click', async () => {
    (api.patents.getDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockDetail);

    render(<PatentDetailDrawer patentNumber="US10234567B2" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText(/Claims/)).toBeInTheDocument();
    });

    // Claims text should not be visible initially
    expect(screen.queryByText('1. A method comprising: step a; step b.')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByText(/Claims/));

    expect(screen.getByText('1. A method comprising: step a; step b.')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(screen.getByText(/Claims/));

    expect(screen.queryByText('1. A method comprising: step a; step b.')).not.toBeInTheDocument();
  });

  it('closes on Escape key', async () => {
    (api.patents.getDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockDetail);

    render(<PatentDetailDrawer patentNumber="US10234567B2" onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when close button is clicked', async () => {
    (api.patents.getDetail as ReturnType<typeof vi.fn>).mockResolvedValue(mockDetail);

    render(<PatentDetailDrawer patentNumber="US10234567B2" onClose={onClose} />);

    // The close button contains the × character
    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('handles patent with no claims text gracefully', async () => {
    const noClaimsDetail = { ...mockDetail, claimsText: null, claimCount: null };
    (api.patents.getDetail as ReturnType<typeof vi.fn>).mockResolvedValue(noClaimsDetail);

    render(<PatentDetailDrawer patentNumber="US10234567B2" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText(/Claims/)).toBeInTheDocument();
    });

    // Expand claims
    fireEvent.click(screen.getByText(/Claims/));

    expect(screen.getByText(/Claims text not available/)).toBeInTheDocument();
    expect(screen.getByText(/View on Google Patents/)).toBeInTheDocument();
  });

  it('shows CPC overflow indicator when more than 8 classifications', async () => {
    const manyClassifications = Array.from({ length: 12 }, (_, i) => ({
      code: `G06N${i}/00`,
      title: `Classification ${i}`,
    }));
    const detailWithManyCPC = { ...mockDetail, cpcClassifications: manyClassifications };
    (api.patents.getDetail as ReturnType<typeof vi.fn>).mockResolvedValue(detailWithManyCPC);

    render(<PatentDetailDrawer patentNumber="US10234567B2" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('+4 more')).toBeInTheDocument();
    });
  });
});
