import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StudyQueuePanel from '../../components/StudyQueuePanel';

const base = {
  dueStatus: 'ready',
  srStats: null,
  onStart: jest.fn(),
  onRetry: jest.fn(),
  onGenerate: jest.fn(),
  onBrowse: jest.fn(),
  onNeedsReview: jest.fn(),
  onLoadSuggestions: jest.fn(),
};

describe('StudyQueuePanel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('explains itself and offers a first step when the user has no cards', () => {
    render(<StudyQueuePanel {...base} dueCards={{ cards: [], total_cards: 0 }} />);
    expect(screen.getByText(/starts with your first cards/i)).toBeInTheDocument();
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /generate cards/i }));
    expect(base.onGenerate).toHaveBeenCalled();
  });

  it('says caught up only when cards exist, and shows when the next one is due', () => {
    const next = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
    render(<StudyQueuePanel {...base} dueCards={{ cards: [], due_count: 0, total_cards: 12, next_due_date: next }} />);
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
    expect(screen.getByText(/due in 3 hours/i)).toBeInTheDocument();
  });

  it('starts the whole queue, or a single set, from the due list', () => {
    const dueCards = {
      due_count: 7,
      new_count: 3,
      review_count: 4,
      total_cards: 20,
      cards: new Array(7).fill({ id: 1 }),
      set_breakdown: [{ set_id: 5, title: 'Cell biology', due_count: 7, new_count: 3 }],
    };
    render(<StudyQueuePanel {...base} dueCards={dueCards} />);
    fireEvent.click(screen.getByRole('button', { name: /start review/i }));
    expect(base.onStart).toHaveBeenLastCalledWith();
    fireEvent.click(screen.getByRole('button', { name: /study/i, exact: false, hidden: false }));
    expect(base.onStart).toHaveBeenLastCalledWith(5);
  });

  it('reports a load failure instead of pretending the queue is empty', () => {
    render(<StudyQueuePanel {...base} dueStatus="error" dueCards={{ cards: [] }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be loaded/i);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(base.onRetry).toHaveBeenCalled();
  });
});
