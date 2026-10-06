import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SlideDeckCard from '../../components/SlideDeckCard';

const props = {
  slide: { id: 'deck-1', filename: 'Biology.pdf', page_count: 3 },
  token: 'test-token', title: 'Biology', addedDate: 'Oct 7, 2026',
  onOpen: jest.fn(), onDelete: jest.fn(),
};

it('previews and navigates slides without starting analysis, then dismisses with Escape', async () => {
  render(<SlideDeckCard {...props} />);
  const preview = screen.getByRole('button', { name: 'Preview slides: Biology' });
  expect(screen.queryByRole('img', { name: 'Slide 1 of Biology' })).not.toBeInTheDocument();
  await userEvent.click(preview);
  expect(screen.getByRole('img', { name: 'Slide 1 of Biology' })).toHaveAttribute('src', expect.stringContaining('/slide_image/deck-1/1'));
  expect(screen.getByRole('button', { name: 'Previous preview slide' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Next preview slide' }));
  expect(screen.getByRole('img', { name: 'Slide 2 of Biology' })).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole('region', { name: 'Slide preview: Biology' }), { key: 'ArrowRight' });
  expect(screen.getByRole('img', { name: 'Slide 3 of Biology' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next preview slide' })).toBeDisabled();
  expect(props.onOpen).not.toHaveBeenCalled();
  fireEvent.keyDown(preview, { key: 'Escape' });
  expect(preview).toHaveAttribute('aria-expanded', 'false');
  expect(preview).toHaveFocus();
  expect(screen.queryByRole('button', { name: 'Next preview slide' })).not.toBeInTheDocument();
});

it('recovers from a failed slide preview by navigating to another slide', async () => {
  render(<SlideDeckCard {...props} />);
  await userEvent.click(screen.getByRole('button', { name: 'Preview slides: Biology' }));
  fireEvent.error(screen.getByRole('img', { name: 'Slide 1 of Biology' }));
  expect(screen.getByText('Preview unavailable')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Next preview slide' }));
  const image = screen.getByRole('img', { name: 'Slide 2 of Biology' });
  fireEvent.load(image);
  expect(image).toHaveClass('is-ready');
  expect(screen.queryByText('Preview unavailable')).not.toBeInTheDocument();
});

it('opens from the card body, cover, and large preview while keeping utility actions separate', async () => {
  const onOpen = jest.fn();
  const onDelete = jest.fn();
  render(<SlideDeckCard {...props} onOpen={onOpen} onDelete={onDelete} />);
  await userEvent.click(screen.getByText('Biology.pdf'));
  expect(onOpen).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole('button', { name: 'Open presentation: Biology' }));
  expect(onOpen).toHaveBeenCalledTimes(2);
  await userEvent.click(screen.getByRole('button', { name: 'Preview slides: Biology' }));
  await userEvent.click(screen.getByRole('button', { name: 'Next preview slide' }));
  expect(onOpen).toHaveBeenCalledTimes(2);
  await userEvent.click(screen.getByRole('img', { name: 'Slide 2 of Biology' }));
  expect(onOpen).toHaveBeenCalledTimes(3);
  await userEvent.click(screen.getByRole('button', { name: 'Close preview: Biology' }));
  await userEvent.click(screen.getByRole('button', { name: 'Delete Biology' }));
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onOpen).toHaveBeenCalledTimes(3);
});

it('keeps the previous slide visible while loading the next slide', async () => {
  render(<SlideDeckCard {...props} />);
  await userEvent.click(screen.getByRole('button', { name: 'Preview slides: Biology' }));
  fireEvent.load(screen.getByRole('img', { name: 'Slide 1 of Biology' }));
  await userEvent.click(screen.getByRole('button', { name: 'Next preview slide' }));
  expect(within(screen.getByRole('region', { name: 'Slide preview: Biology' })).getByAltText('')).toHaveAttribute('src', expect.stringContaining('/slide_image/deck-1/1'));
  expect(within(screen.getByRole('region', { name: 'Slide preview: Biology' })).getByAltText('')).not.toHaveClass('is-leaving');
  fireEvent.load(screen.getByRole('img', { name: 'Slide 2 of Biology' }));
  expect(within(screen.getByRole('region', { name: 'Slide preview: Biology' })).getByAltText('')).toHaveClass('is-leaving');
});

it('ignores card clicks while the deck is busy', async () => {
  const onOpen = jest.fn();
  render(<SlideDeckCard {...props} analyzing onOpen={onOpen} />);
  await userEvent.click(screen.getByText('Biology.pdf'));
  expect(onOpen).not.toHaveBeenCalled();
});
