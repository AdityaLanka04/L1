import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SlideExplorer from '../../pages/SlideExplorer';
import slideExplorerAgentService from '../../services/slideExplorerAgentService';

jest.mock('../../services/slideExplorerAgentService', () => ({
  __esModule: true,
  default: { analyzeSlide: jest.fn() },
}));

const jsonResponse = (body) => ({
  ok: true,
  json: async () => body,
});

describe('SlideExplorer', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user_id', 'test-user');
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: { randomUUID: jest.fn(() => 'test-session') },
    });
    slideExplorerAgentService.analyzeSlide.mockResolvedValue({});
    global.fetch = jest.fn((url) => {
      if (String(url).includes('/get_uploaded_slides')) {
        return Promise.resolve(jsonResponse({
          slides: [{
            id: 'deck-1',
            filename: 'Biology.pptx',
            page_count: 2,
            extracted_text: 'Cell biology',
            uploaded_at: '2026-08-05T00:00:00Z',
          }],
        }));
      }
      if (String(url).includes('/analyze_slide/deck-1')) {
        return Promise.resolve(jsonResponse({
          slides: [{
            slide_number: 1,
            title: 'Cell structure',
            explanation: 'An introduction to the cell.',
            key_points: ['Cells are the basic unit of life.'],
          }],
        }));
      }
      return Promise.resolve(jsonResponse({}));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('fully hides and restores the presentation sidebar', async () => {
    render(
      <MemoryRouter>
        <SlideExplorer />
      </MemoryRouter>
    );

    await userEvent.click(await screen.findByRole('button', { name: /open deck/i }));
    const hideButton = await screen.findByRole('button', { name: /hide presentation sidebar/i });

    expect(document.querySelector('.shc-sidebar')).toBeInTheDocument();
    await userEvent.click(hideButton);

    await waitFor(() => {
      expect(document.querySelector('.shc-sidebar')).not.toBeInTheDocument();
      expect(document.querySelector('.shc-body')).toHaveClass('shc-body--no-sidebar');
      expect(document.querySelector('.se-analysis-page')).toHaveClass('se-sidebar-hidden');
    });

    await userEvent.click(screen.getByRole('button', { name: /show presentation sidebar/i }));

    await waitFor(() => {
      expect(document.querySelector('.shc-sidebar')).toBeInTheDocument();
      expect(document.querySelector('.shc-body')).not.toHaveClass('shc-body--no-sidebar');
      expect(document.querySelector('.se-analysis-page')).not.toHaveClass('se-sidebar-hidden');
    });
  });

  it('shows an inline upload error and lets the user retry the same file', async () => {
    const originalFetch = global.fetch;
    let attempts = 0;
    global.fetch = jest.fn((url, options) => {
      if (String(url).includes('/upload_slides')) {
        attempts += 1;
        return Promise.resolve(attempts === 1
          ? { ok: false, json: async () => ({ detail: 'Upload unavailable' }) }
          : jsonResponse({}));
      }
      return originalFetch(url, options);
    });
    render(<MemoryRouter><SlideExplorer /></MemoryRouter>);
    await screen.findByRole('button', { name: /open deck/i });
    await userEvent.click(screen.getAllByRole('button', { name: /upload slides/i })[0]);
    const input = screen.getByLabelText('Choose presentations');
    const file = new File(['presentation'], 'Biology.pdf', { type: 'application/pdf' });
    await userEvent.upload(input, file);
    expect(await screen.findByRole('alert')).toHaveTextContent('Upload unavailable');
    expect(input.value).toBe('');
    await waitFor(() => expect(input).not.toBeDisabled());
    await userEvent.upload(input, new File(['presentation'], 'Biology.pdf', { type: 'application/pdf' }));
    expect(await screen.findByRole('heading', { name: 'Slides', exact: true })).toBeInTheDocument();
    expect(attempts).toBe(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('rejects a mixed file drop without uploading a partial selection', async () => {
    render(<MemoryRouter><SlideExplorer /></MemoryRouter>);
    await screen.findByRole('button', { name: /open deck/i });
    await userEvent.click(screen.getAllByRole('button', { name: /upload slides/i })[0]);
    fireEvent.drop(screen.getByRole('button', { name: /drop your presentations/i }), {
      dataTransfer: { files: [
        new File(['slides'], 'Biology.pdf', { type: 'application/pdf' }),
        new File(['notes'], 'Notes.txt', { type: 'text/plain' }),
      ] },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Remove unsupported files');
    expect(global.fetch.mock.calls.some(([url]) => String(url).includes('/upload_slides'))).toBe(false);
  });

});
