import { configureApi, getApiConfig } from './config';

describe('configureApi / getApiConfig', () => {
  beforeEach(() => {
    // Reset to defaults
    configureApi({
      userApiUrl: 'http://localhost:3000/api',
      productApiUrl: 'http://localhost:3001/api',
      orderApiUrl: 'http://localhost:3002/api',
      authApiUrl: 'http://localhost:3003/api',
      fileApiUrl: 'http://localhost:3004/api',
      mockApiUrl: 'http://localhost:4200',
    });
  });

  it('should return defaults', () => {
    expect(getApiConfig()).toEqual({
      userApiUrl: 'http://localhost:3000/api',
      productApiUrl: 'http://localhost:3001/api',
      orderApiUrl: 'http://localhost:3002/api',
      authApiUrl: 'http://localhost:3003/api',
      fileApiUrl: 'http://localhost:3004/api',
      mockApiUrl: 'http://localhost:4200',
    });
  });

  it('should override specific URLs', () => {
    configureApi({ userApiUrl: 'http://custom:9000/api' });
    const config = getApiConfig();
    expect(config.userApiUrl).toBe('http://custom:9000/api');
    expect(config.productApiUrl).toBe('http://localhost:3001/api');
  });

  it('should merge multiple calls', () => {
    configureApi({ orderApiUrl: 'http://order:5000/api' });
    configureApi({ productApiUrl: 'http://product:6000/api' });
    const config = getApiConfig();
    expect(config.orderApiUrl).toBe('http://order:5000/api');
    expect(config.productApiUrl).toBe('http://product:6000/api');
  });
});
