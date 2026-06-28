jest.mock('@tanstack/react-query', () => ({
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('./query-client', () => ({
  getQueryClient: jest.fn(() => ({ type: 'mock-query-client' })),
}));

jest.mock('../infrastructure/config', () => ({
  configureApi: jest.fn(),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Providers } from './providers';
import { configureApi } from '../infrastructure/config';

describe('Providers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders children', () => {
    render(
      <Providers>
        <span>hello</span>
      </Providers>,
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('calls configureApi when apiConfig is provided', () => {
    const apiConfig = {
      userApiUrl: 'http://user:3000/api',
      productApiUrl: 'http://product:3001/api',
      orderApiUrl: 'http://order:3002/api',
    };
    render(<Providers apiConfig={apiConfig}><span /></Providers>);
    expect(configureApi).toHaveBeenCalledWith(apiConfig);
  });

  it('does not call configureApi when apiConfig is omitted', () => {
    render(<Providers><span /></Providers>);
    expect(configureApi).not.toHaveBeenCalled();
  });
});
