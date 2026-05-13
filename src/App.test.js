import { render, screen } from '@testing-library/react';
import App from './App';

test('renders search input', () => {

  render(<App />);

  const inputElement = screen.getByPlaceholderText(
    /search for restaurant, cuisine or a dish/i
  );

  expect(inputElement).toBeInTheDocument();
});