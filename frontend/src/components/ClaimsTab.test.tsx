import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ClaimsTab from './ClaimsTab';

vi.mock('../api', () => ({
  api: {
    claimDraft: {
      getLatest: vi.fn(),
      start: vi.fn(),
      updateClaim: vi.fn(),
      regenerateClaim: vi.fn(),
    },
  },
}));

vi.mock('./ClaimTree', () => ({
  default: () => <div data-testid="claim-tree">ClaimTree Mock</div>,
}));

const mockDraft = {
  id: 'draft-1',
  version: 1,
  status: 'COMPLETE',
  claims: [
    { id: 'c1', claimNumber: 1, claimType: 'INDEPENDENT', scopeLevel: 'BROAD', statutoryType: 'method', parentClaimNumber: null, text: 'A neural network method comprising training a model on patent data.', examinerNotes: '' },
    { id: 'c2', claimNumber: 2, claimType: 'DEPENDENT', scopeLevel: null, statutoryType: null, parentClaimNumber: 1, text: 'The method of claim 1, wherein the model uses transformer architecture.', examinerNotes: '' },
  ],
  specLanguage: null,
  plannerStrategy: null,
  examinerFeedback: null,
  revisionNotes: null,
};

describe('ClaimsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findOverlaps returns empty when no prior art — no warning icons', async () => {
    const { api } = await import('../api');
    (api.claimDraft.getLatest as any).mockResolvedValue(mockDraft);
    render(<ClaimsTab projectId="proj-1" hasFeasibility={true} priorArtTitles={[]} />);
    await waitFor(() => {
      expect(screen.getByText(/A neural network method/)).toBeTruthy();
    });
    expect(screen.queryByText('Potential prior art overlap')).toBeNull();
  });

  it('findOverlaps shows warning when overlap detected', async () => {
    const { api } = await import('../api');
    (api.claimDraft.getLatest as any).mockResolvedValue(mockDraft);
    render(
      <ClaimsTab
        projectId="proj-1"
        hasFeasibility={true}
        priorArtTitles={[{ patentNumber: 'US12345', title: 'Neural Network Processing System' }]}
      />
    );
    await waitFor(() => {
      expect(screen.getByText(/A neural network method/)).toBeTruthy();
    });
    // "neural" (6 chars, not a stop word) appears in claim text and prior art title
    expect(screen.getAllByText('Potential prior art overlap').length).toBeGreaterThan(0);
  });

  it('findOverlaps ignores stop words — method in claim and title produces no warning', async () => {
    const { api } = await import('../api');
    // Claim text has "method" and "comprising" — both stop words
    // Prior art title has "Method" and "Using" — both stop words; "the" is < 4 chars
    const draftStopOnly = {
      ...mockDraft,
      claims: [
        { id: 'c1', claimNumber: 1, claimType: 'INDEPENDENT', scopeLevel: 'BROAD', statutoryType: 'method', parentClaimNumber: null, text: 'A method comprising using a device.', examinerNotes: '' },
      ],
    };
    (api.claimDraft.getLatest as any).mockResolvedValue(draftStopOnly);
    render(
      <ClaimsTab
        projectId="proj-1"
        hasFeasibility={true}
        priorArtTitles={[{ patentNumber: 'US88888', title: 'Method Using the Apparatus' }]}
      />
    );
    await waitFor(() => {
      expect(screen.getByText(/A method comprising using a device/)).toBeTruthy();
    });
    // "method" and "using" are stop words, "apparatus" is a stop word, "the" is < 4 chars
    expect(screen.queryByText('Potential prior art overlap')).toBeNull();
  });

  it('findOverlaps ignores stop words — no overlap when title has only stop words and short words', async () => {
    const { api } = await import('../api');
    const draftWithMethodOnly = {
      ...mockDraft,
      claims: [
        { id: 'c1', claimNumber: 1, claimType: 'INDEPENDENT', scopeLevel: 'BROAD', statutoryType: 'method', parentClaimNumber: null, text: 'A method for processing data in a system.', examinerNotes: '' },
      ],
    };
    (api.claimDraft.getLatest as any).mockResolvedValue(draftWithMethodOnly);
    render(
      <ClaimsTab
        projectId="proj-1"
        hasFeasibility={true}
        priorArtTitles={[{ patentNumber: 'US99999', title: 'Method System Device Apparatus' }]}
      />
    );
    await waitFor(() => {
      expect(screen.getByText(/A method for processing data/)).toBeTruthy();
    });
    // All title words are stop words: method, system, device, apparatus
    expect(screen.queryByText('Potential prior art overlap')).toBeNull();
  });

  it('Regenerate button visible on each claim', async () => {
    const { api } = await import('../api');
    (api.claimDraft.getLatest as any).mockResolvedValue(mockDraft);
    render(<ClaimsTab projectId="proj-1" hasFeasibility={true} />);
    await waitFor(() => {
      expect(screen.getByText(/A neural network method/)).toBeTruthy();
    });
    // Should have Regenerate for independent claim 1 and dependent claim 2
    const regenerateButtons = screen.getAllByText('Regenerate');
    expect(regenerateButtons.length).toBe(2);
  });

  it('handleRegenerate calls API and reloads', async () => {
    const { api } = await import('../api');
    (api.claimDraft.getLatest as any).mockResolvedValue(mockDraft);
    (api.claimDraft.regenerateClaim as any).mockResolvedValue({});
    render(<ClaimsTab projectId="proj-1" hasFeasibility={true} />);
    await waitFor(() => {
      expect(screen.getByText(/A neural network method/)).toBeTruthy();
    });
    // Click the first Regenerate button (claim 1)
    const regenerateButtons = screen.getAllByText('Regenerate');
    fireEvent.click(regenerateButtons[0]);
    await waitFor(() => {
      expect(api.claimDraft.regenerateClaim).toHaveBeenCalledWith('proj-1', 1);
    });
    // After regenerate completes, loadDraft is called again (getLatest called twice: initial + reload)
    expect((api.claimDraft.getLatest as any).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('handleRegenerate shows error on failure', async () => {
    const { api } = await import('../api');
    (api.claimDraft.getLatest as any).mockResolvedValue(mockDraft);
    (api.claimDraft.regenerateClaim as any).mockRejectedValue(new Error('Server error'));
    render(<ClaimsTab projectId="proj-1" hasFeasibility={true} />);
    await waitFor(() => {
      expect(screen.getByText(/A neural network method/)).toBeTruthy();
    });
    const regenerateButtons = screen.getAllByText('Regenerate');
    fireEvent.click(regenerateButtons[0]);
    await waitFor(() => {
      expect(screen.getByText(/Failed to regenerate claim 1: Server error/)).toBeTruthy();
    });
  });

  it('shows spinner when generating is true and draft is null', async () => {
    const { api } = await import('../api');
    // Initial load returns NONE → draft stays null
    (api.claimDraft.getLatest as any).mockResolvedValue({ status: 'NONE', claims: [] });
    (api.claimDraft.start as any).mockResolvedValue({});
    render(<ClaimsTab projectId="proj-1" hasFeasibility={true} />);
    // Wait for initial load to finish — should show generate button
    await waitFor(() => {
      expect(screen.getByText('Generate Draft Claims')).toBeTruthy();
    });
    // Click generate → opens UPL modal
    fireEvent.click(screen.getByText('Generate Draft Claims'));
    await waitFor(() => {
      expect(screen.getByText(/This is a research tool, not a legal service/i)).toBeTruthy();
    });
    // Check the acknowledgment checkbox
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    // Click the modal's generate button — sets generating=true, draft is still null
    const modalGenerateBtn = screen.getAllByText('Generate Draft Claims').find(
      btn => btn.closest('.fixed') !== null
    )!;
    fireEvent.click(modalGenerateBtn);
    // Spinner should appear (generating=true, draft=null)
    await waitFor(() => {
      expect(screen.getByText('Generating claim drafts...')).toBeTruthy();
    });
  });

  it('shows spinner when draft status is RUNNING', async () => {
    const { api } = await import('../api');
    // API returns status RUNNING — loadDraft sets draft to the response AND sets generating=true
    (api.claimDraft.getLatest as any).mockResolvedValue({
      id: 'draft-running',
      version: 1,
      status: 'RUNNING',
      claims: [],
      specLanguage: null,
      plannerStrategy: null,
      examinerFeedback: null,
      revisionNotes: null,
    });
    render(<ClaimsTab projectId="proj-1" hasFeasibility={true} />);
    await waitFor(() => {
      expect(screen.getByText('Generating claim drafts...')).toBeTruthy();
    });
  });

  it('renders no-feasibility state correctly', async () => {
    const { api } = await import('../api');
    (api.claimDraft.getLatest as any).mockResolvedValue({ status: 'NONE' });
    render(<ClaimsTab projectId="proj-1" hasFeasibility={false} />);
    // hasFeasibility check happens after loading completes
    await waitFor(() => {
      expect(screen.getByText(/Run a feasibility analysis first/)).toBeTruthy();
    });
    expect(screen.getByText(/Claim drafting requires a completed 6-stage analysis/)).toBeTruthy();
  });

  it('no-draft state shows generate button', async () => {
    const { api } = await import('../api');
    (api.claimDraft.getLatest as any).mockResolvedValue({ status: 'NONE' });
    render(<ClaimsTab projectId="proj-1" hasFeasibility={true} />);
    await waitFor(() => {
      expect(screen.getByText('Generate Draft Claims')).toBeTruthy();
    });
    expect(screen.getByText(/No claim draft yet/)).toBeTruthy();
  });
});
