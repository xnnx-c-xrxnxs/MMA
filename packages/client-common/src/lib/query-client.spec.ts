import { makeQueryClient, getQueryClient } from './query-client';

describe('query-client', () => {
  it('makeQueryClient should return a QueryClient with configured defaults', () => {
    const client = makeQueryClient();
    const defaults = client.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(30_000);
    expect(defaults.queries?.retry).toBe(1);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  });

  it('getQueryClient should return the same instance on repeated calls', () => {
    const a = getQueryClient();
    const b = getQueryClient();
    expect(a).toBe(b);
  });
});
