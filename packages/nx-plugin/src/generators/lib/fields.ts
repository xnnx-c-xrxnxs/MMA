/**
 * Field-spec parsing — converts a CLI string `--fields="name:string,weight:number?"`
 * into a typed structure that templates can iterate over.
 */

export type FieldType = 'string' | 'number' | 'boolean' | 'date';

export interface FieldSpec {
  /** camelCase name as it appears in the entity (e.g. `trackingNumber`). */
  name: string;
  /** Primitive type. */
  type: FieldType;
  /** True when the field was suffixed with `?` in the input. */
  optional: boolean;
  /** TypeScript type literal — `'string'`, `'number'`, `'boolean'`, `'Date'`. */
  tsType: string;
  /** Zod method — `z.string()`, `z.number()`, `z.boolean()`, `z.iso.datetime()`. */
  zod: string;
}

const ALLOWED_TYPES: ReadonlyArray<FieldType> = ['string', 'number', 'boolean', 'date'];

const TS_TYPE_MAP: Record<FieldType, string> = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  date: 'Date',
};

const ZOD_MAP: Record<FieldType, string> = {
  string: 'z.string()',
  number: 'z.number()',
  boolean: 'z.boolean()',
  date: 'z.iso.datetime()',
};

/**
 * Parse `name:type[?]` pairs. Comma-separated. Whitespace is tolerated.
 *
 * Examples:
 *   "name:string,weight:number?" → 2 fields
 *   ""                           → []
 */
export const parseFieldsSpec = (spec: string | undefined): FieldSpec[] => {
  if (!spec || !spec.trim()) return [];

  return spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry, idx) => {
      const [rawName, rawType] = entry.split(':').map((s) => s.trim());
      if (!rawName || !rawType) {
        throw new Error(
          `parseFieldsSpec: invalid entry at index ${idx}: '${entry}'. Expected 'name:type' or 'name:type?'.`,
        );
      }
      const optional = rawType.endsWith('?');
      const baseType = (optional ? rawType.slice(0, -1) : rawType).toLowerCase() as FieldType;
      if (!ALLOWED_TYPES.includes(baseType)) {
        throw new Error(
          `parseFieldsSpec: unsupported type '${baseType}' for field '${rawName}'. Allowed: ${ALLOWED_TYPES.join(', ')}.`,
        );
      }
      if (!/^[a-z][a-zA-Z0-9]*$/.test(rawName)) {
        throw new Error(
          `parseFieldsSpec: field name '${rawName}' must be camelCase starting with a lowercase letter.`,
        );
      }
      return {
        name: rawName,
        type: baseType,
        optional,
        tsType: TS_TYPE_MAP[baseType],
        zod: ZOD_MAP[baseType],
      } satisfies FieldSpec;
    });
};

/**
 * Parse a comma-separated status list, e.g. "PENDING,IN_TRANSIT,DELIVERED".
 * Each value is upper-snake-case and unique. Returns [] for empty input.
 */
export const parseStatusesSpec = (spec: string | undefined): string[] => {
  if (!spec || !spec.trim()) return [];
  const values = spec
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  for (const v of values) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(v)) {
      throw new Error(
        `parseStatusesSpec: status '${v}' must be SCREAMING_SNAKE_CASE.`,
      );
    }
  }
  const unique = new Set(values);
  if (unique.size !== values.length) {
    throw new Error('parseStatusesSpec: duplicate status values.');
  }
  return values;
};
