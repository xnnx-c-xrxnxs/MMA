// Level 1 — pure data, no business rules beyond required-field guards.
export default {
  id: '01-category',
  level: 1,
  complexityLabel: 'L1 · Pure Data',
  domain: 'Catalog',
  title: 'Category',
  introShort: 'A name and an optional description. The simplest possible entity.',
  intro: 'A Category is a label used to group products. It has a name and an optional description — that is the entire model. The point of this example is to introduce the entity skeleton: private constructor, two factories (create / reconstitute), getters.',
  specTitle: 'Catalog · Category',
  specBodyHtml: `
    <p>A <strong>Category</strong> is used to group products in the catalog.</p>
    <ul>
      <li>It has a <em>name</em> (required, non-blank, ≤ 60 chars).</li>
      <li>It has an optional <em>description</em>.</li>
      <li>Once created, the name and description can be edited.</li>
      <li>Every category records when it was created and when it was last updated.</li>
    </ul>
    <p>That's it — no statuses, no transitions, no relationships.</p>
  `,
  entityFilename: 'category.entity.ts',
  entityCode: `import { CategoryNameRequiredError, CategoryNameTooLongError } from '../exceptions';

export class Category {
  private constructor(
    private readonly categoryId: string | null,
    private name: string,
    private description: string | null,
    private readonly dateCreated: string,
    private updatedAt: string
  ) {}

  static create(props: { name: string; description?: string }): Category {
    const name = props.name.trim();
    if (name.length === 0) throw new CategoryNameRequiredError();
    if (name.length > 60) throw new CategoryNameTooLongError();

    const now = new Date().toISOString();
    return new Category(null, name, props.description?.trim() ?? null, now, now);
  }

  static reconstitute(props: {
    categoryId: string;
    name: string;
    description: string | null;
    dateCreated: string;
    updatedAt: string;
  }): Category {
    return new Category(props.categoryId, props.name, props.description, props.dateCreated, props.updatedAt);
  }

  rename(newName: string): void {
    const name = newName.trim();
    if (name.length === 0) throw new CategoryNameRequiredError();
    if (name.length > 60) throw new CategoryNameTooLongError();
    this.name = name;
    this.updatedAt = new Date().toISOString();
  }

  updateDescription(description: string | null): void {
    this.description = description?.trim() ?? null;
    this.updatedAt = new Date().toISOString();
  }

  // Getters
  getCategoryId(): string | null { return this.categoryId; }
  getName(): string { return this.name; }
  getDescription(): string | null { return this.description; }
  getDateCreated(): string { return this.dateCreated; }
  getUpdatedAt(): string { return this.updatedAt; }
}`,
  concepts: [
    'Private constructor',
    'create() factory for new entities',
    'reconstitute() factory for DB hydration',
    'Getters only — no public setters',
    'updatedAt managed by the entity itself',
  ],
  exceptionsFilename: 'category-exceptions.ts',
  exceptionsCode: `export class CategoryNameRequiredError extends Error {
  constructor() {
    super('Category name is required');
    this.name = 'CategoryNameRequiredError';
  }
}

export class CategoryNameTooLongError extends Error {
  constructor() {
    super('Category name cannot exceed 60 characters');
    this.name = 'CategoryNameTooLongError';
  }
}`,
  pitfalls: [
    'Don\'t add a public constructor "for convenience" — every instance must come from <code>create()</code> or <code>reconstitute()</code>.',
    'Don\'t expose <code>updatedAt</code> as a setter; the entity is the only thing allowed to bump it.',
    'Don\'t add <code>toObject()</code> here — serialization is the application-service\'s job (Golden Rule #13).',
  ],
};
