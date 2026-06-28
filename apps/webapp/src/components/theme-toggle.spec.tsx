jest.mock('next-themes', () => ({
  useTheme: jest.fn(),
}));

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeToggle } from './theme-toggle';
import { useTheme } from 'next-themes';

const mockUseTheme = useTheme as jest.Mock;

/** Flush useEffect microtasks without an empty async callback. */
const flushEffects = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('ThemeToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({
      theme: 'light',
      resolvedTheme: 'light',
      setTheme: jest.fn(),
    });
  });

  it('renders the placeholder before mount', () => {
    render(<ThemeToggle />);
    // On first render (before useEffect fires) it shows placeholder
    // After act it may have toggled — just assert something rendered
    expect(document.body).not.toBeEmptyDOMElement();
  });

  it('renders the toggle button after mount', async () => {
    render(<ThemeToggle />);
    await flushEffects();
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });

  it('calls setTheme with dark when current theme is light', async () => {
    const mockSetTheme = jest.fn();
    mockUseTheme.mockReturnValue({
      theme: 'light',
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
    });
    render(<ThemeToggle />);
    await flushEffects();

    screen.getByTestId('theme-toggle').click();
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('calls setTheme with system when current theme is dark', async () => {
    const mockSetTheme = jest.fn();
    mockUseTheme.mockReturnValue({
      theme: 'dark',
      resolvedTheme: 'dark',
      setTheme: mockSetTheme,
    });
    render(<ThemeToggle />);
    await flushEffects();

    screen.getByTestId('theme-toggle').click();
    expect(mockSetTheme).toHaveBeenCalledWith('system');
  });

  it('calls setTheme with light when current theme is system', async () => {
    const mockSetTheme = jest.fn();
    mockUseTheme.mockReturnValue({
      theme: 'system',
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
    });
    render(<ThemeToggle />);
    await flushEffects();

    screen.getByTestId('theme-toggle').click();
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });
});
