import {
  correlationMiddleware,
  getAuthHeader,
  getCorrelationHeaders,
  getCorrelationId,
  getOutboundHeaders,
  runWithCorrelationId,
  runWithRequestContext,
} from './correlation';

describe('correlation context', () => {
  describe('runWithCorrelationId (legacy)', () => {
    it('makes the correlationId visible inside the callback', () => {
      runWithCorrelationId('id-1', () => {
        expect(getCorrelationId()).toBe('id-1');
        expect(getAuthHeader()).toBeUndefined();
      });
    });

    it('returns undefined outside any context', () => {
      expect(getCorrelationId()).toBeUndefined();
      expect(getAuthHeader()).toBeUndefined();
    });
  });

  describe('runWithRequestContext', () => {
    it('exposes both correlationId and authHeader', () => {
      runWithRequestContext({ correlationId: 'id-2', authHeader: 'Bearer abc' }, () => {
        expect(getCorrelationId()).toBe('id-2');
        expect(getAuthHeader()).toBe('Bearer abc');
      });
    });

    it('treats authHeader as optional', () => {
      runWithRequestContext({ correlationId: 'id-3' }, () => {
        expect(getCorrelationId()).toBe('id-3');
        expect(getAuthHeader()).toBeUndefined();
      });
    });
  });

  describe('getCorrelationHeaders (legacy)', () => {
    it('returns x-correlation-id only — never Authorization', () => {
      runWithRequestContext({ correlationId: 'id-4', authHeader: 'Bearer xyz' }, () => {
        expect(getCorrelationHeaders()).toEqual({ 'x-correlation-id': 'id-4' });
      });
    });

    it('returns empty object outside a context', () => {
      expect(getCorrelationHeaders()).toEqual({});
    });
  });

  describe('getOutboundHeaders', () => {
    it('returns both correlationId and Authorization when both are set', () => {
      runWithRequestContext({ correlationId: 'id-5', authHeader: 'Bearer tok' }, () => {
        expect(getOutboundHeaders()).toEqual({
          'x-correlation-id': 'id-5',
          Authorization: 'Bearer tok',
        });
      });
    });

    it('returns only correlationId when authHeader is absent', () => {
      runWithRequestContext({ correlationId: 'id-6' }, () => {
        expect(getOutboundHeaders()).toEqual({ 'x-correlation-id': 'id-6' });
      });
    });

    it('returns empty object outside a context', () => {
      expect(getOutboundHeaders()).toEqual({});
    });
  });

  describe('correlationMiddleware', () => {
    it('reuses incoming x-correlation-id header', () => {
      const middleware = correlationMiddleware();
      let captured: string | undefined;
      middleware(
        { headers: { 'x-correlation-id': 'inbound-id', authorization: 'Bearer t' } },
        {},
        () => {
          captured = getCorrelationId();
          expect(getAuthHeader()).toBe('Bearer t');
        },
      );
      expect(captured).toBe('inbound-id');
    });

    it('generates a new UUID when no x-correlation-id header is present', () => {
      const middleware = correlationMiddleware();
      let captured: string | undefined;
      middleware({ headers: { authorization: 'Bearer u' } }, {}, () => {
        captured = getCorrelationId();
      });
      expect(captured).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('captures Authorization header into the context', () => {
      const middleware = correlationMiddleware();
      let captured: string | undefined;
      middleware({ headers: { authorization: 'Bearer my-token' } }, {}, () => {
        captured = getAuthHeader();
      });
      expect(captured).toBe('Bearer my-token');
    });

    it('handles missing Authorization header gracefully', () => {
      const middleware = correlationMiddleware();
      let captured: string | undefined;
      middleware({ headers: {} }, {}, () => {
        captured = getAuthHeader();
      });
      expect(captured).toBeUndefined();
    });

    it('handles missing headers object gracefully', () => {
      const middleware = correlationMiddleware();
      let captured: string | undefined;
      middleware({}, {}, () => {
        captured = getCorrelationId();
      });
      expect(captured).toMatch(/^[0-9a-f-]{36}$/);
    });
  });
});
