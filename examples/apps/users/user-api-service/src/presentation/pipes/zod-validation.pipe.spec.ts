import { ZodValidationPipe } from './zod-validation.pipe';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

describe('ZodValidationPipe', () => {
  let pipe: ZodValidationPipe;

  beforeEach(() => {
    pipe = new ZodValidationPipe(testSchema);
  });

  it('passes through valid data', () => {
    const result = pipe.transform({ name: 'Alice', age: 30 });
    expect(result).toEqual({ name: 'Alice', age: 30 });
  });

  it('throws BadRequestException for invalid data', () => {
    expect(() => pipe.transform({ name: '', age: -1 })).toThrow(BadRequestException);
  });

  it('includes Zod issues in the exception', () => {
    try {
      pipe.transform({ name: '', age: 0 });
      fail('Expected BadRequestException');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const response = (e as BadRequestException).getResponse() as { message: unknown[] };
      expect(Array.isArray(response.message)).toBe(true);
      expect(response.message.length).toBeGreaterThan(0);
    }
  });

  it('throws for missing required fields', () => {
    expect(() => pipe.transform({})).toThrow(BadRequestException);
  });

  it('throws BadRequestException when value is not an object', () => {
    expect(() => pipe.transform('invalid')).toThrow(BadRequestException);
  });

  it('returns parsed and coerced data from schema defaults', () => {
    const schema = z.object({ status: z.string().default('ACTIVE') });
    const pipWithDefault = new ZodValidationPipe(schema);
    const result = pipWithDefault.transform({});
    expect(result).toEqual({ status: 'ACTIVE' });
  });
});
