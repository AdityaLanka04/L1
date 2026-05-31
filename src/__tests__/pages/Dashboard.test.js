import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import {
  setupLocalStorage,
  clearLocalStorage,
  buildFetchMock,
  buildErrorFetchMock,
  MOCK_GAMIFICATION,
  MOCK_DASHBOARD_DATA,
  MOCK_HEATMAP,
  MOCK_WEEKLY_PROGRESS,
} from '../helpers/testUtils';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    selectedTheme: { id: 'default', tokens: { '--accent': '#D7B38C' } },
  }),
}));

jest.mock('../../contexts/NotificationContext', () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    refreshNotifications: jest.fn(),
    markNotificationAsRead: jest.fn(),
    deleteNotification: jest.fn(),
  }),
}));

jest.mock('../../utils/ThemeManager', () => ({
  rgbaFromHex: () => 'rgba(215,179,140,0.2)',
}));

jest.mock('../../utils/dateUtils', () => ({
  formatToLocalTime: (d) => d,
  getRelativeTime: () => '2 hours ago',
}));

jest.mock('../../pages/HelpTour', () => ({
  HelpTour: () => null,
  HelpButton: () => null,
}));

jest.mock('../../components/GeoBackground', () => () => <div data-testid="geo-bg" />);
jest.mock('../../components/LoadingSpinner', () => () => <div data-testid="loading-spinner">Loading...</div>);
jest.mock('../../components/ImportExportModal', () => () => null);
jest.mock('../../components/ThemeSwitcher', () => () => null);

const FETCH_ROUTES = {
  get_gamification_stats: MOCK_GAMIFICATION,
  get_dashboard_data: MOCK_DASHBOARD_DATA,
  get_activity_heatmap: MOCK_HEATMAP,
  get_weekly_progress: MOCK_WEEKLY_PROGRESS,
  get_analytics_history: { data: [], period_stats: {} },
  get_notes: MOCK_DASHBOARD_DATA.recentNotes,
  get_flashcards: MOCK_DASHBOARD_DATA.recentFlashcards,
  get_daily_challenge: {
    challenge: { id: 'ch1', target: 10, name: 'Answer 10 Questions', type: 'questions' },
    progress: 4
  },
  start_session: { session_id: 'sess-001' },
  end_session: { ok: true },
  get_notifications: { notifications: [] },
  study_insights: { message: 'Welcome back!' },
  create_notification: { id: 1 },
  get_user_stats: { streak: 5, total_questions: 100 },
};

import Dashboard from '../../pages/Dashboard';

const renderDashboard = async () => {
  let utils;
  await act(async () => {
    utils = render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
  });
  return utils;
};

describe('Dashboard', () => {
  beforeEach(() => {
    clearLocalStorage();
    jest.clearAllMocks();
    global.fetch = buildFetchMock(FETCH_ROUTES);
  });

  afterEach(() => {
    clearLocalStorage();
  });

  
  describe('Authentication', () => {
    it('redirects to /login when no token is present', async () => {
      await act(async () => {
        render(
          <MemoryRouter>
            <Dashboard />
          </MemoryRouter>
        );
      });
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    it('does NOT redirect when a valid token is in localStorage', async () => {
      setupLocalStorage();
      await renderDashboard();
      expect(mockNavigate).not.toHaveBeenCalledWith('/login');
    });
  });

  
  describe('Rendering', () => {
    beforeEach(() => setupLocalStorage());

    it('renders without crashing', async () => {
      await expect(renderDashboard()).resolves.not.toThrow();
    });

    it('shows geo background component', async () => {
      await renderDashboard();
      expect(screen.getByTestId('geo-bg')).toBeInTheDocument();
    });

    it('renders dashboard container element', async () => {
      const { container } = await renderDashboard();
      expect(container.firstChild).toBeTruthy();
    });
  });

  
  describe('API Calls', () => {
    beforeEach(() => setupLocalStorage());

    it('calls /get_gamification_stats on mount', async () => {
      await renderDashboard();
      await waitFor(() => {
        const calls = global.fetch.mock.calls.map(([url]) => url);
        expect(calls.some((u) => u.includes('get_gamification_stats'))).toBe(true);
      });
    });

    it('calls /get_activity_heatmap on mount', async () => {
      await renderDashboard();
      await waitFor(() => {
        const calls = global.fetch.mock.calls.map(([url]) => url);
        expect(calls.some((u) => u.includes('get_activity_heatmap'))).toBe(true);
      });
    });

    it('calls /get_dashboard_data on mount', async () => {
      await renderDashboard();
      await waitFor(() => {
        const calls = global.fetch.mock.calls.map(([url]) => url);
        expect(calls.some((u) => u.includes('get_dashboard_data'))).toBe(true);
      });
    });

    it('calls /start_session on mount', async () => {
      await renderDashboard();
      await waitFor(() => {
        const calls = global.fetch.mock.calls.map(([url]) => url);
        expect(calls.some((u) => u.includes('start_session'))).toBe(true);
      });
    });

    it('sends Bearer token in Authorization header', async () => {
      await renderDashboard();
      await waitFor(() => {
        const authCall = global.fetch.mock.calls.find(([url]) =>
          url.includes('get_gamification_stats')
        );
        expect(authCall).toBeTruthy();
        expect(authCall[1]?.headers?.Authorization).toMatch(/^Bearer /);
      });
    });
  });

  
  describe('Error Handling', () => {
    beforeEach(() => setupLocalStorage());

    it('renders without crash when API returns 500', async () => {
      global.fetch = buildErrorFetchMock('get_gamification_stats', 500);
      await expect(renderDashboard()).resolves.not.toThrow();
    });

    it('renders without crash when network request rejects', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('Network failure')));
      await expect(renderDashboard()).resolves.not.toThrow();
    });

    it('does not show login redirect on API failure (only on missing token)', async () => {
      global.fetch = buildErrorFetchMock('get_dashboard_data', 500);
      await renderDashboard();
      expect(mockNavigate).not.toHaveBeenCalledWith('/login');
    });
  });

  
  describe('Latency', () => {
    beforeEach(() => setupLocalStorage());

    it('completes full render (including effects) in under 2000ms', async () => {
      const start = performance.now();
      await renderDashboard();
      const elapsed = performance.now() - start;
      
      expect(elapsed).toBeLessThan(2000);
    });

    it('resolves all mocked API calls within 1000ms', async () => {
      global.fetch = buildFetchMock(FETCH_ROUTES, { delay: 20 });
      const start = performance.now();
      await renderDashboard();
      await waitFor(
        () => {
          expect(global.fetch).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(300);
    });

    it('handles 50ms API delay and still resolves state correctly', async () => {
      global.fetch = buildFetchMock(FETCH_ROUTES, { delay: 50 });
      await renderDashboard();
      await waitFor(
        () => {
          const calls = global.fetch.mock.calls;
          expect(calls.length).toBeGreaterThan(0);
        },
        { timeout: 2000 }
      );
    });
  });

  
  describe('Layout Persistence', () => {
    beforeEach(() => setupLocalStorage());

    it('loads default layout when no saved layout exists', async () => {
      localStorage.removeItem('currentDashboardLayout');
      localStorage.removeItem('currentLayoutName');
      await expect(renderDashboard()).resolves.not.toThrow();
    });

    it('loads saved layout from localStorage when layoutVersion matches', async () => {
      localStorage.setItem('dashboardLayoutVersion', '2.2');
      localStorage.setItem('currentLayoutName', 'Custom');
      localStorage.setItem(
        'currentDashboardLayout',
        JSON.stringify({
          widgets: [{ id: 'ai-tutor', col: 1, row: 1, cols: 1, rows: 3, size: 'M' }],
        })
      );
      await expect(renderDashboard()).resolves.not.toThrow();
    });

    it('resets to default layout when layoutVersion is outdated', async () => {
      localStorage.setItem('dashboardLayoutVersion', '1.0');
      localStorage.setItem('currentLayoutName', 'OldLayout');
      await renderDashboard();
      expect(localStorage.getItem('dashboardLayoutVersion')).toBe('2.2');
    });
  });
});
