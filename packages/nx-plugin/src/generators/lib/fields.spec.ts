import { parseFieldsSpec, parseStatusesSpec } from './fields';

describe('parseFieldsSpec', () => {
  it('returns [] for empty input', () => {
    expect(parseFieldsSpec(undefined)).toEqual([]);
    expect(parseFieldsSpec('')).toEqual([]);
    expect(parseFieldsSpec('   ')).toEqual([]);
  });

  it('parses a single required string field', () => {
    expect(parseFieldsSpec('name:string')).toEqual([
      { name: 'name', type: 'string', optional: false, tsType: 'string', zod: 'z.string()' },
    ]);
  });

  it('parses an optional field with ?', () => {
    const fs = parseFieldsSpec('weight:number?');
    expect(fs[0].optional).toBe(true);
    expect(fs[0].tsType).toBe('number');
  });

  it('parses multiple fields', () => {
    const fs = parseFieldsSpec('name:string, weight:number?, active:boolean');
    expect(fs).toHaveLength(3);
    expect(fs.map((f) => f.name)).toEqual(['name', 'weight', 'active']);
  });

  it('maps date → Date / z.iso.datetime()', () => {
    const fs = parseFieldsSpec('estimatedDelivery:date?');
    expect(fs[0].tsType).toBe('Date');
    expect(fs[0].zod).toBe('z.iso.datetime()');
  });

  it('rejects unsupported types', () => {
    expect(() => parseFieldsSpec('foo:bigint')).toThrow(/unsupported type/);
  });

  it('rejects malformed entries', () => {
    expect(() => parseFieldsSpec('name')).toThrow(/invalid entry/);
    expect(() => parseFieldsSpec(':string')).toThrow(/invalid entry/);
  });

  it('rejects non-camelCase field names', () => {
    expect(() => parseFieldsSpec('Tracking_Number:string')).toThrow(/camelCase/);
  });
});

describe('parseStatusesSpec', () => {
  it('returns [] for empty input', () => {
    expect(parseStatusesSpec(undefined)).toEqual([]);
    expect(parseStatusesSpec('')).toEqual([]);
  });

  it('uppercases and trims values', () => {
    expect(parseStatusesSpec('pending, in_transit ,delivered')).toEqual([
      'PENDING',
      'IN_TRANSIT',
      'DELIVERED',
    ]);
  });

  it('rejects non-SCREAMING_SNAKE_CASE values', () => {
    expect(() => parseStatusesSpec('PENDING,1ACTIVE')).toThrow();
  });

  it('rejects duplicates', () => {
    expect(() => parseStatusesSpec('A,B,A')).toThrow(/duplicate/);
  });
});
