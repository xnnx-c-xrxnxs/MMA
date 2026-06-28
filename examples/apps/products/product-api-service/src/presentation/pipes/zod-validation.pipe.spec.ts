import { ZodValidationPipe } from './zod-validation.pipe';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const testSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
});

describe('ZodValidationPipe', () => {
  let pipe: ZodValidationPipe;

  beforeEach(() => {
    pipe = new ZodValidationPipe(testSchema);
  });

  it('passes through valid data', () => {
    const result = pipe.transform({ name: 'Widget', price: 9.99 });
    expect(result).toEqual({ name: 'Widget', price: 9.99 });
  });

  it('throws BadRequestException for invalid data', () => {
    expect(() => pipe.transform({ name: '', price: -1 })).toThrow(BadRequestException);
  });

  it('includes Zod issues in the exception', () => {
    try {
      pipe.transform({ name: '', price: 0 });
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
    expect(() => pipe.transform(null)).toThrow(BadRequestException);
  });

  it('returns schema defaults when field is absent', () => {
    const schema = z.object({ status: z.string().default('ACTIVE') });
    const pipeWithDefault = new ZodValidationPipe(schema);
    const result = pipeWithDefault.transform({});
    expect(result).toEqual({ status: 'ACTIVE' });
  });
});
