import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import { clearLocalStorage } from '../../testUtils';
import QuizHub from '../../pages/QuizHub';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));


jest.mock('../../components/ImportExportModal', () => ({ isOpen, onClose }) =>
  isOpen ? <div data-testid="import-export-modal"><button onClick={onClose}>Close</button></div> : null
);




const renderQuizHub = async () => {
  let utils;
  await act(async () => {
    utils = render(
      <MemoryRouter>
        <QuizHub />
      </MemoryRouter>
    );
  });
  return utils;
};

describe('QuizHub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearLocalStorage();

  });

  afterEach(() => clearLocalStorage());

  
  describe('Rendering', () => {
    it('renders without crashing', async () => {
      await expect(renderQuizHub()).resolves.not.toThrow();
    });

    it('renders the Solo Quiz card with its description', async () => {
      await renderQuizHub();
      const solo = screen.getByRole('button', { name: /solo quiz/i });
      expect(solo).toHaveTextContent(/at your own pace/i);
    });

    it('renders the Quiz Battles card with its description', async () => {
      await renderQuizHub();
      const battle = screen.getByRole('button', { name: /quiz battles/i });
      expect(battle).toHaveTextContent(/1v1/i);
    });

    it('does not show import/export modal by default', async () => {
      await renderQuizHub();
      expect(screen.queryByTestId('import-export-modal')).not.toBeInTheDocument();
    });
  });

  
  describe('Navigation', () => {
    it('navigates to /solo-quiz when the Solo Quiz card is clicked', async () => {
      await renderQuizHub();
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /solo quiz/i })); });
      expect(mockNavigate).toHaveBeenCalledWith('/solo-quiz');
    });

    it('navigates to /quiz-battles when the Quiz Battles card is clicked', async () => {
      await renderQuizHub();
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /quiz battles/i })); });
      expect(mockNavigate).toHaveBeenCalledWith('/quiz-battles');
    });
  });

  
  describe('Body Overflow', () => {
    it('sets body overflow hidden on mount', async () => {
      await renderQuizHub();
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body overflow on unmount', async () => {
      const { unmount } = await renderQuizHub();
      unmount();
      expect(document.body.style.overflow).toBe('');
    });
  });

  
  describe('Latency', () => {
    it('renders in under 100ms', async () => {
      // Warm-up render so the timing measures the page, not first-run JIT cost.
      (await renderQuizHub()).unmount();
      const start = performance.now();
      await renderQuizHub();
      expect(performance.now() - start).toBeLessThan(100);
    });

  });
});
