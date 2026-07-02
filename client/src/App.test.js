import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login title', async () => {
  localStorage.clear();
  render(<App />);
  const titleElement = await screen.findByText(/Login/i);
  expect(titleElement).toBeInTheDocument();
});
