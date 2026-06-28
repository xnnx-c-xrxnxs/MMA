import { ZodValidationPipe } from './zod-validation.pipe';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const testSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
});

describe('ZodValidationPipe', () => {
  let pipe: ZodValidationPipe;

  beforeEach(() => {
    pipe = new ZodValidationPipe(testSchema);
  });

  it('passes through valid data', () => {
    const result = pipe.transform({ filename: 'photo.png', contentType: 'image/png' });
    expect(result).toEqual({ filename: 'photo.png', contentType: 'image/png' });
  });

  it('throws BadRequestException for invalid data', () => {
    expect(() => pipe.transform({ filename: '', contentType: '' })).toThrow(BadRequestException);
  });

  it('includes Zod issues in the exception', () => {
    try {
      pipe.transform({ filename: '', contentType: '' });
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

  it('returns parsed data with schema defaults applied', () => {
    const schema = z.object({ tag: z.string().default('uploads') });
    const pipeWithDefault = new ZodValidationPipe(schema);
    const result = pipeWithDefault.transform({});
    expect(result).toEqual({ tag: 'uploads' });
  });
});
