import { formatStatus } from './format-status';

describe('formatStatus', () => {
  describe('default Title Case formatting', () => {
    it.each([
      ['ACTIVE', 'Active'],
      ['PENDING', 'Pending'],
      ['PAST_DUE', 'Past Due'],
      ['VALIDATION_FAILED', 'Validation Failed'],
      ['IN_TRANSIT', 'In Transit'],
      ['ALREADY_TITLE_CASE', 'Already Title Case'],
    ])('formats "%s" as "%s"', (input, expected) => {
      expect(formatStatus(input)).toBe(expected);
    });

    it('handles single word', () => {
      expect(formatStatus('DRAFT')).toBe('Draft');
    });

    it('handles empty string', () => {
      expect(formatStatus('')).toBe('');
    });

    it('handles consecutive underscores gracefully', () => {
      expect(formatStatus('A__B')).toBe('A  B');
    });
  });

  describe('with override labels', () => {
    const labels = {
      API_KEY: 'API Key',
      VALIDATION_FAILED: 'Failed Validation',
    };

    it('uses the override when present', () => {
      expect(formatStatus('API_KEY', labels)).toBe('API Key');
      expect(formatStatus('VALIDATION_FAILED', labels)).toBe('Failed Validation');
    });

    it('falls back to default formatting when key is absent', () => {
      expect(formatStatus('PAST_DUE', labels)).toBe('Past Due');
    });

    it('does not pick up inherited prototype properties', () => {
      const proto = { toString: 'should be ignored' };
      const labelsWithProto = Object.create(proto);
      labelsWithProto.PAST_DUE = 'Overdue';
      expect(formatStatus('toString', labelsWithProto)).toBe('Tostring');
      expect(formatStatus('PAST_DUE', labelsWithProto)).toBe('Overdue');
    });
  });
});
