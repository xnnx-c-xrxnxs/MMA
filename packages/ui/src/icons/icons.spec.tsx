import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import * as Icons from './icons';
import type { IIcon } from './icon.types';

type IconComponent = (props: IIcon) => ReactElement;

// ---------------------------------------------------------------------------
// Complete icon catalogue — must stay in sync with index.ts
// ---------------------------------------------------------------------------
const allIconNames = [
  'AiIcon', 'AddIcon', 'ArrowDownIcon', 'ArrowLeftIcon', 'ArrowRightIcon', 'ArrowUpIcon',
  'CalendarIcon', 'CheckIcon', 'CheckboxIndeterminateIcon', 'CheckboxOffIcon', 'CheckboxOnIcon',
  'ChevronDownIcon', 'ChevronLeftIcon', 'ChevronRightIcon', 'ChevronUpIcon', 'CloseIcon',
  'CriteriaIcon', 'DbIcon', 'DotIcon', 'DownloadIcon', 'ErrorIcon', 'FileIcon', 'HelpIcon',
  'InfoIcon', 'KeyboardIcon', 'LoadingIcon', 'LogoutIcon', 'MenuIcon', 'MoreHorizIcon',
  'MoreIcon', 'NotificationIcon', 'OpenInTabIcon', 'RadioOffIcon', 'RadioOnIcon',
  'RecordsIcon', 'RefreshIcon', 'SearchIcon', 'SetupIcon', 'SortIcon', 'SuccessIcon',
  'SummaryIcon', 'TrashIcon', 'UploadIcon', 'WarningIcon',
] as const;

type IconName = (typeof allIconNames)[number];

// ---------------------------------------------------------------------------
// All icons in this set are single-color filled icons.
// They use fill="currentColor" and inherit their color from parent text color.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const icon = (name: IconName): IconComponent => Icons[name] as unknown as IconComponent;

// ---------------------------------------------------------------------------
// 1. Universal tests — every icon, every time
// ---------------------------------------------------------------------------
describe('All icons', () => {
  it.each(allIconNames)('%s — renders without throwing', (name) => {
    render(icon(name)({}));
  });

  it.each(allIconNames)('%s — uses viewBox="0 0 24 24"', (name) => {
    const { container } = render(icon(name)({}));
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 24 24');
  });

  it.each(allIconNames)('%s — defaults to size 24', (name) => {
    const { container } = render(icon(name)({}));
    expect(container.querySelector('svg')).toHaveAttribute('width', '24');
    expect(container.querySelector('svg')).toHaveAttribute('height', '24');
  });

  it.each(allIconNames)('%s — respects custom size prop', (name) => {
    const { container } = render(icon(name)({ size: 32 }));
    expect(container.querySelector('svg')).toHaveAttribute('width', '32');
    expect(container.querySelector('svg')).toHaveAttribute('height', '32');
  });

  it.each(allIconNames)('%s — forwards className to svg', (name) => {
    const { container } = render(icon(name)({ className: 'test-sentinel' }));
    expect(container.querySelector('svg')).toHaveClass('test-sentinel');
  });

  it.each(allIconNames)('%s — stroke defaults to currentColor', (name) => {
    const { container } = render(icon(name)({}));
    expect(container.querySelector('svg')).toHaveAttribute('stroke', 'currentColor');
  });

  it.each(allIconNames)('%s — color prop overrides stroke', (name) => {
    const { container } = render(icon(name)({ color: '#ff0000' }));
    expect(container.querySelector('svg')).toHaveAttribute('stroke', '#ff0000');
  });

  it.each(allIconNames)('%s — has at least one path with fill="currentColor"', (name) => {
    const { container } = render(icon(name)({}));
    const filled = container.querySelectorAll('[fill="currentColor"]');
    expect(filled.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Individual icon smoke tests
// ---------------------------------------------------------------------------
describe('AddIcon', () => {
  it('renders a path', () => {
    const { container } = render(<Icons.AddIcon />);
    expect(container.querySelector('path')).not.toBeNull();
  });
});

describe('CloseIcon', () => {
  it('renders path elements', () => {
    const { container } = render(<Icons.CloseIcon />);
    expect(container.querySelector('path')).not.toBeNull();
  });
});

describe('CheckboxOnIcon', () => {
  it('renders a path with fill="currentColor"', () => {
    const { container } = render(<Icons.CheckboxOnIcon />);
    const filled = container.querySelectorAll('[fill="currentColor"]');
    expect(filled.length).toBeGreaterThan(0);
  });
});

describe('LoadingIcon', () => {
  it('renders inside a 24×24 svg', () => {
    const { container } = render(<Icons.LoadingIcon size={24} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '24');
    expect(container.querySelector('svg')).toHaveAttribute('height', '24');
  });
});
