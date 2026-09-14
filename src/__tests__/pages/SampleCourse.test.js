import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SampleCourse from '../../pages/SampleCourse';

const mockGenerateSampleQuiz = jest.fn();
jest.mock('../../services/productService', () => ({
  sampleEvent: jest.fn(),
  generateSampleQuiz: (...args) => mockGenerateSampleQuiz(...args),
}));

const QUESTIONS = [
  { question: 'What pigment absorbs light in photosynthesis?', options: ['Chlorophyll', 'Keratin', 'Melanin', 'Insulin'], correct: 'Chlorophyll', explanation: 'Chlorophyll absorbs light energy inside chloroplasts.' },
  { question: 'What gas do plants release during photosynthesis?', options: ['Oxygen', 'Nitrogen', 'Helium', 'Argon'], correct: 'Oxygen', explanation: 'Splitting water releases oxygen as a byproduct.' },
];

beforeEach(() => { mockGenerateSampleQuiz.mockReset(); });

it('lets an anonymous learner try any topic and get corrective feedback', async () => {
  mockGenerateSampleQuiz.mockResolvedValue({ topic: 'Photosynthesis', questions: QUESTIONS });
  render(<MemoryRouter><SampleCourse /></MemoryRouter>);

  expect(screen.getByText(/No account needed/)).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'Photosynthesis' } });
  fireEvent.click(screen.getByRole('button', { name: 'Generate my sample' }));

  await waitFor(() => expect(mockGenerateSampleQuiz).toHaveBeenCalledWith('Photosynthesis'));
  expect(await screen.findByRole('button', { name: 'Check my answer' })).toBeDisabled();

  fireEvent.click(screen.getByRole('radio', { name: 'Chlorophyll' }));
  fireEvent.click(screen.getByRole('button', { name: 'Check my answer' }));
  expect(screen.getByText('Correct.')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Next question' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Nitrogen' }));
  fireEvent.click(screen.getByRole('button', { name: 'Check my answer' }));
  fireEvent.click(screen.getByRole('button', { name: 'See my results' }));

  expect(screen.getByRole('heading', { name: '1 of 2 correct' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Create my workspace' })).toHaveAttribute('href', '/register');
});

it('shows an error and lets the learner retry when generation fails', async () => {
  mockGenerateSampleQuiz.mockRejectedValue(new Error('Enter a real subject or topic to try, not a greeting or single word.'));
  render(<MemoryRouter><SampleCourse /></MemoryRouter>);

  fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'hi' } });
  fireEvent.click(screen.getByRole('button', { name: 'Generate my sample' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/not a greeting/);
  expect(screen.getByRole('button', { name: 'Generate my sample' })).toBeInTheDocument();
});
