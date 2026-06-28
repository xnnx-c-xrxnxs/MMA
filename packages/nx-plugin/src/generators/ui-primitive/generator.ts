import type { Tree } from '@nx/devkit';
import { formatFiles, logger } from '@nx/devkit';
import type { UiPrimitiveGeneratorSchema, UiCategory, UiPattern } from './schema';
import { buildDomainNames } from '../lib';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const CATEGORY_TITLES: Record<UiCategory, string> = {
  'form-controls': 'Form Controls',
  'data-display': 'Data Display',
  feedback: 'Feedback',
  navigation: 'Navigation',
  layout: 'Layout',
};

interface Ctx {
  pascal: string;      // e.g. "Switch"
  camel: string;       // e.g. "switch"
  kebab: string;       // e.g. "switch" | "progress-bar"
  category: UiCategory;
  pattern: UiPattern;
  storyTitle: string;  // e.g. "Form Controls/Switch"
}

const buildCtx = (schema: UiPrimitiveGeneratorSchema): Ctx => {
  const names = buildDomainNames(schema.name);
  return {
    pascal: names.pascal,
    camel: names.camel,
    kebab: names.kebab,
    category: schema.category,
    pattern: schema.pattern,
    storyTitle: `${CATEGORY_TITLES[schema.category]}/${names.pascal}`,
  };
};

// ---------------------------------------------------------------------------
// Component template
// ---------------------------------------------------------------------------

const renderComponent = (ctx: Ctx): string => {
  const { pascal, camel, pattern } = ctx;

  switch (pattern) {
    case 'simple-variants':
      return `import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

const ${camel}Variants = cva(
  // TODO: add base Tailwind classes (always applied)
  '',
  {
    variants: {
      variant: {
        default: '',
        secondary: '',
        outline: '',
        destructive: '',
      },
      size: {
        default: '',
        sm: '',
        lg: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ${pascal}Props
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof ${camel}Variants> {}

const ${pascal} = React.forwardRef<HTMLDivElement, ${pascal}Props>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <div
        className={cn(${camel}Variants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
${pascal}.displayName = '${pascal}';

export { ${pascal}, ${camel}Variants };
`;

    case 'simple-no-variants':
      return `import * as React from 'react';
import { cn } from '../../../lib/utils';

export interface ${pascal}Props extends React.HTMLAttributes<HTMLDivElement> {}

const ${pascal} = React.forwardRef<HTMLDivElement, ${pascal}Props>(
  ({ className, ...props }, ref) => {
    return (
      <div
        className={cn(
          // TODO: add Tailwind classes
          '',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
${pascal}.displayName = '${pascal}';

export { ${pascal} };
export type { ${pascal}Props };
`;

    case 'compound':
      return `import * as React from 'react';
import { cn } from '../../../lib/utils';

const ${pascal} = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // TODO: add root Tailwind classes
        '',
        className,
      )}
      {...props}
    />
  ),
);
${pascal}.displayName = '${pascal}';

const ${pascal}Header = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // TODO: add header Tailwind classes
        '',
        className,
      )}
      {...props}
    />
  ),
);
${pascal}Header.displayName = '${pascal}Header';

const ${pascal}Content = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // TODO: add content Tailwind classes
        '',
        className,
      )}
      {...props}
    />
  ),
);
${pascal}Content.displayName = '${pascal}Content';

export { ${pascal}, ${pascal}Header, ${pascal}Content };
`;
  }
};

// ---------------------------------------------------------------------------
// index.ts barrel for the component folder
// ---------------------------------------------------------------------------

const renderIndex = (ctx: Ctx): string => `export * from './${ctx.kebab}';\n`;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

const renderStories = (ctx: Ctx): string => {
  const { pascal, kebab, storyTitle, pattern, camel } = ctx;

  if (pattern === 'compound') {
    return `import type { Meta, StoryObj } from '@storybook/react';
import { ${pascal}, ${pascal}Header, ${pascal}Content } from './${kebab}';

const meta: Meta<typeof ${pascal}> = {
  title: '${storyTitle}',
  component: ${pascal},
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ${pascal}>;

export const Default: Story = {
  render: () => (
    <${pascal}>
      <${pascal}Header>${pascal} header</${pascal}Header>
      <${pascal}Content>${pascal} content</${pascal}Content>
    </${pascal}>
  ),
};
`;
  }

  if (pattern === 'simple-variants') {
    return `import type { Meta, StoryObj } from '@storybook/react';
import { ${pascal} } from './${kebab}';

const meta: Meta<typeof ${pascal}> = {
  title: '${storyTitle}',
  component: ${pascal},
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'outline', 'destructive'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ${pascal}>;

export const Default: Story = {};

export const Secondary: Story = { args: { variant: 'secondary' } };

export const Outline: Story = { args: { variant: 'outline' } };

export const Destructive: Story = { args: { variant: 'destructive' } };
`;
  }

  // simple-no-variants
  return `import type { Meta, StoryObj } from '@storybook/react';
import { ${pascal} } from './${kebab}';

const meta: Meta<typeof ${pascal}> = {
  title: '${storyTitle}',
  component: ${pascal},
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ${pascal}>;

export const Default: Story = {};
`;
};

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

const renderSpec = (ctx: Ctx): string => {
  const { pascal, kebab, pattern } = ctx;

  if (pattern === 'compound') {
    return `import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { ${pascal}, ${pascal}Header, ${pascal}Content } from './${kebab}';

describe('${pascal}', () => {
  it('renders without crashing', () => {
    render(<${pascal} data-testid="${kebab}" />);
    expect(screen.getByTestId('${kebab}')).toBeInTheDocument();
  });

  it('renders sub-components', () => {
    render(
      <${pascal}>
        <${pascal}Header data-testid="${kebab}-header">Header</${pascal}Header>
        <${pascal}Content data-testid="${kebab}-content">Content</${pascal}Content>
      </${pascal}>,
    );
    expect(screen.getByTestId('${kebab}-header')).toBeInTheDocument();
    expect(screen.getByTestId('${kebab}-content')).toBeInTheDocument();
  });

  it('forwards ref to the underlying element', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<${pascal} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('merges additional className', () => {
    render(<${pascal} className="custom-class" data-testid="${kebab}" />);
    expect(screen.getByTestId('${kebab}').className).toContain('custom-class');
  });
});
`;
  }

  if (pattern === 'simple-variants') {
    return `import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { ${pascal} } from './${kebab}';

describe('${pascal}', () => {
  it('renders without crashing', () => {
    render(<${pascal} data-testid="${kebab}" />);
    expect(screen.getByTestId('${kebab}')).toBeInTheDocument();
  });

  it('forwards ref to the underlying element', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<${pascal} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('merges additional className', () => {
    render(<${pascal} className="custom-class" data-testid="${kebab}" />);
    expect(screen.getByTestId('${kebab}').className).toContain('custom-class');
  });

  // TODO: add variant-class assertions once Tailwind classes are filled in
  // e.g. expect(screen.getByTestId('${kebab}').className).toContain('bg-primary');
});
`;
  }

  // simple-no-variants
  return `import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { ${pascal} } from './${kebab}';

describe('${pascal}', () => {
  it('renders without crashing', () => {
    render(<${pascal} data-testid="${kebab}" />);
    expect(screen.getByTestId('${kebab}')).toBeInTheDocument();
  });

  it('forwards ref to the underlying element', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<${pascal} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('merges additional className', () => {
    render(<${pascal} className="custom-class" data-testid="${kebab}" />);
    expect(screen.getByTestId('${kebab}').className).toContain('custom-class');
  });
});
`;
};

// ---------------------------------------------------------------------------
// Barrel update — packages/ui/src/index.ts
// ---------------------------------------------------------------------------

const buildExportLine = (ctx: Ctx): string => {
  const { pascal, camel, kebab, category, pattern } = ctx;
  const from = `'./components/${category}/${kebab}'`;

  switch (pattern) {
    case 'simple-variants':
      return `export { ${pascal}, ${camel}Variants, type ${pascal}Props } from ${from};`;
    case 'simple-no-variants':
      return `export { ${pascal}, type ${pascal}Props } from ${from};`;
    case 'compound':
      return `export { ${pascal}, ${pascal}Header, ${pascal}Content } from ${from};`;
  }
};

const insertIntoBarrel = (tree: Tree, ctx: Ctx): void => {
  const barrelPath = 'packages/ui/src/index.ts';
  const existing = tree.read(barrelPath, 'utf-8') ?? '';
  const exportLine = buildExportLine(ctx);

  if (existing.includes(exportLine)) return;

  const categoryComment = `// ${ctx.category}`;
  const categoryIdx = existing.indexOf(categoryComment);

  if (categoryIdx !== -1) {
    // Find the next `// ` section comment after this category block (or EOF).
    // We use `\n// ` so we don't accidentally match within export lines.
    const afterCategory = existing.indexOf('\n// ', categoryIdx + 1);
    const insertionPoint = afterCategory === -1 ? existing.length : afterCategory;

    const before = existing.slice(0, insertionPoint);
    const after = existing.slice(insertionPoint);
    const sep = before.endsWith('\n') ? '' : '\n';
    tree.write(barrelPath, `${before}${sep}${exportLine}\n${after}`);
  } else {
    // Category not found — append a new section at the end.
    const sep = existing.endsWith('\n') ? '' : '\n';
    tree.write(barrelPath, `${existing}${sep}\n// ${ctx.category}\n${exportLine}\n`);
  }
};

// ---------------------------------------------------------------------------
// Generator entry point
// ---------------------------------------------------------------------------

export default async function uiPrimitiveGenerator(
  tree: Tree,
  schema: UiPrimitiveGeneratorSchema,
): Promise<void> {
  const ctx = buildCtx(schema);
  const componentDir = `packages/ui/src/components/${ctx.category}/${ctx.kebab}`;
  const componentPath = `${componentDir}/${ctx.kebab}.tsx`;

  if (tree.exists(componentPath)) {
    throw new Error(
      `ui-primitive generator: ${componentPath} already exists. Aborting to avoid overwriting custom code.`,
    );
  }

  tree.write(componentPath, renderComponent(ctx));
  tree.write(`${componentDir}/index.ts`, renderIndex(ctx));
  tree.write(`${componentDir}/${ctx.kebab}.stories.tsx`, renderStories(ctx));
  tree.write(`${componentDir}/${ctx.kebab}.spec.tsx`, renderSpec(ctx));

  insertIntoBarrel(tree, ctx);

  // formatFiles uses dynamic import for Prettier which fails under Jest's CJS
  // VM. Skip it in tests; the CLI runs it normally.
  if (!process.env.JEST_WORKER_ID) {
    await formatFiles(tree);
  }

  logger.info(
    `\n[@mma/nx-plugin:ui-primitive] Generated ${ctx.pascal} (${ctx.pattern})\n` +
      `  → ${componentPath}\n` +
      `  → ${componentDir}/index.ts\n` +
      `  → ${componentDir}/${ctx.kebab}.stories.tsx\n` +
      `  → ${componentDir}/${ctx.kebab}.spec.tsx\n\n` +
      `Next steps:\n` +
      `  1. Open ${ctx.kebab}.tsx and fill in the TODO Tailwind classes.\n` +
      `  2. If it wraps a Radix primitive, replace the <div> with the Radix root.\n` +
      `  3. Verify the barrel export in packages/ui/src/index.ts looks correct.\n` +
      `  4. Run: pnpm nx test ui --skip-nx-cache\n` +
      `  5. Run: pnpm nx run ui:storybook  (http://localhost:4400)\n`,
  );
}
