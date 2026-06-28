export type UiCategory =
  | 'form-controls'
  | 'data-display'
  | 'feedback'
  | 'navigation'
  | 'layout';

export type UiPattern = 'simple-variants' | 'simple-no-variants' | 'compound';

export interface UiPrimitiveGeneratorSchema {
  /** Component name — PascalCase or kebab-case. Converted internally. */
  name: string;
  category: UiCategory;
  pattern: UiPattern;
}
