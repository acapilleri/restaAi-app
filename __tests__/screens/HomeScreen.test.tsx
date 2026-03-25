/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomeScreen } from '../../src/screens/HomeScreen';
import type { DashboardResponse } from '../../src/api/dashboard';

const defaultDashboard: DashboardResponse = {
  user: {
    first_name: 'Mario',
    current_weight: 72,
    target_weight: 70,
    weight_lost: 2,
  },
  today: {
    date: '2025-03-17',
    has_diet: true,
    plan_summary: { calories: 1800, day: 'Lunedì' },
    weighed_today: true,
  },
  stats: { memories_count: 0, photos_count: 0, days_on_diet: 5 },
  briefing: {
    message: 'Ciao!',
    highlight: '',
    suggestion_today: 'Bevi più acqua oggi.',
    quick_chips: ['Registra peso', 'Cosa mangiare?'],
    generated_at: new Date().toISOString(),
    context: { weight: 72, target: 70, progress: 50, plan_day: '' },
  },
  today_meals: [],
};

const mockGetDashboard = jest.fn();

const mockAuth = {
  user: { id: '1', email: 'test@test.com', first_name: 'Mario' },
  token: 'fake-token',
  refreshUser: jest.fn(),
};

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    // run callback after mount (like real useFocusEffect when screen is focused)
    useFocusEffect: (cb: () => void | (() => void)) => {
      React.useEffect(() => {
        cb();
        return () => {};
      }, []);
    },
  };
});

jest.mock('../../src/api/dashboard', () => ({
  getDashboard: (...args: unknown[]) => mockGetDashboard(...args),
}));

jest.mock('../../src/api/recipes', () => ({
  fetchRecipeAlternatives: jest.fn(() => Promise.resolve({ recipes: [] })),
}));

jest.mock('../../src/api/profile', () => ({
  getProfile: () => Promise.resolve({ profile: { id: 1, email: 'test@test.com', name: 'Mario' } }),
}));

jest.mock('../../src/api/weights', () => ({
  createWeight: jest.fn(),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDashboard.mockResolvedValue(defaultDashboard);
});

async function renderHomeScreenAndWait() {
  let tree: ReactTestRenderer.ReactTestRenderer;
  const queryClient = createTestQueryClient();
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <QueryClientProvider client={queryClient}>
        <HomeScreen />
      </QueryClientProvider>,
    );
  });
  await new Promise((r) => setTimeout(r, 50));
  await ReactTestRenderer.act(async () => {});
  return tree!;
}

describe('HomeScreen', () => {
  it('shows loading then content after API resolve', async () => {
    const tree = await renderHomeScreenAndWait();
    expect(mockGetDashboard).toHaveBeenCalled();
    const scrollView = tree.root.findAllByType(require('react-native').ScrollView);
    expect(scrollView.length).toBeGreaterThanOrEqual(1);
  });

  it('displays user name and date', async () => {
    const tree = await renderHomeScreenAndWait();
    const texts = tree.root.findAllByType(require('react-native').Text);
    const content = texts.map((t) => {
      const c = t.props.children;
      return Array.isArray(c) ? c.join('') : String(c ?? '');
    }).join(' ');
    expect(content).toMatch(/Mario|Ciao/);
    expect(content).toMatch(/Lunedì|piano|1800/);
  });

  it('displays plan summary when has_diet is true', async () => {
    const tree = await renderHomeScreenAndWait();
    const texts = tree.root.findAllByType(require('react-native').Text);
    const content = texts.map((t) => {
      const c = t.props.children;
      return Array.isArray(c) ? c.join('') : String(c ?? '');
    }).join(' ');
    expect(content).toContain('1800');
    expect(content).toContain('Lunedì');
  });

  it('shows suggestion_today from briefing', async () => {
    const tree = await renderHomeScreenAndWait();
    const texts = tree.root.findAllByType(require('react-native').Text);
    const content = texts.map((t) => {
      const c = t.props.children;
      return Array.isArray(c) ? c.join('') : String(c ?? '');
    }).join(' ');
    expect(content).toContain('Bevi più acqua oggi');
  });

  it('shows error and retry on API failure', async () => {
    mockGetDashboard.mockRejectedValue(new Error('Network error'));
    const tree = await renderHomeScreenAndWait();
    const texts = tree.root.findAllByType(require('react-native').Text);
    const content = texts.map((t) => {
      const c = t.props.children;
      return Array.isArray(c) ? c.join('') : String(c ?? '');
    }).join(' ');
    expect(content).toMatch(/Network error|Riprova|Errore/);
  });
});
