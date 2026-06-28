/**
 * Naming helpers — every generator needs to convert a domain name into
 * different cases (kebab, pascal, camel, snake, screaming-snake, plural).
 * No external dependencies — keeps the plugin pure and fast.
 */

export interface DomainNames {
  /** kebab-case singular: `shipping`, `order-item` */
  kebab: string;
  /** kebab-case plural: `shippings`, `order-items` */
  kebabPlural: string;
  /** PascalCase singular: `Shipping`, `OrderItem` */
  pascal: string;
  /** PascalCase plural: `Shippings`, `OrderItems` */
  pascalPlural: string;
  /** camelCase singular: `shipping`, `orderItem` */
  camel: string;
  /** camelCase plural: `shippings`, `orderItems` */
  camelPlural: string;
  /** SCREAMING_SNAKE_CASE singular: `SHIPPING`, `ORDER_ITEM` */
  constant: string;
  /** SCREAMING_SNAKE_CASE plural: `SHIPPINGS`, `ORDER_ITEMS` */
  constantPlural: string;
}

const splitWords = (name: string): string[] => {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
};

const toKebab = (words: string[]): string => words.join('-');
const toPascal = (words: string[]): string =>
  words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
const toCamel = (words: string[]): string => {
  if (words.length === 0) return '';
  const [first, ...rest] = words;
  return first + rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
};
const toConstant = (words: string[]): string => words.join('_').toUpperCase();

/**
 * Naive English pluralization — sufficient for domain names.
 * Handles: simple +s, words ending in y → ies, words ending in s/x/z/ch/sh → +es.
 */
const pluralize = (singular: string): string => {
  const lower = singular.toLowerCase();
  if (/(?:s|x|z|ch|sh)$/.test(lower)) return singular + 'es';
  if (/[^aeiou]y$/.test(lower)) return singular.slice(0, -1) + 'ies';
  return singular + 's';
};

export const buildDomainNames = (
  rawName: string,
  rawPlural?: string,
): DomainNames => {
  const words = splitWords(rawName);
  if (words.length === 0) {
    throw new Error(`buildDomainNames: name '${rawName}' produced no words`);
  }
  const last = words[words.length - 1];
  const pluralLast = rawPlural ? splitWords(rawPlural).slice(-1)[0] : pluralize(last);
  const pluralWords = [...words.slice(0, -1), pluralLast];

  return {
    kebab: toKebab(words),
    kebabPlural: toKebab(pluralWords),
    pascal: toPascal(words),
    pascalPlural: toPascal(pluralWords),
    camel: toCamel(words),
    camelPlural: toCamel(pluralWords),
    constant: toConstant(words),
    constantPlural: toConstant(pluralWords),
  };
};

/** Validate that a raw name is acceptable for use as a domain identifier. */
export const validateDomainName = (name: string): void => {
  if (!name || !name.trim()) {
    throw new Error('Domain name cannot be empty.');
  }
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new Error(
      `Domain name '${name}' must be lowercase, kebab-case, and start with a letter (e.g. 'shipping', 'order-item').`,
    );
  }
};
