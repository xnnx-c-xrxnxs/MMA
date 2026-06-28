/**
 * @old-st/ui — icon set
 *
 * Every icon implements the shared `IIcon` interface (size, color, className).
 * Strokes/fills default to `currentColor` so an icon inherits the surrounding
 * text color via Tailwind utilities (`text-primary`, `text-muted-foreground`,
 * `text-destructive`, etc.). Dark mode is automatic.
 *
 * Usage:
 *   import { ClockIcon, PlayIcon } from '@old-st/ui';
 *   <button className="text-brand"><ClockIcon size={20} /></button>
 *
 * Adding an icon:
 *   1. Add a new forwardRef component to ./icons.tsx using `iconAttrs(props)`
 *   2. Always render `viewBox="0 0 24 24"` and use `currentColor`
 *   3. Re-export below from the barrel
 */

export { type IIcon } from './icon.types';
export {
  AiIcon,
  AddIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CalendarIcon,
  CheckIcon,
  CheckboxIndeterminateIcon,
  CheckboxOffIcon,
  CheckboxOnIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CloseIcon,
  CriteriaIcon,
  DbIcon,
  DotIcon,
  DownloadIcon,
  ErrorIcon,
  FileIcon,
  HelpIcon,
  InfoIcon,
  KeyboardIcon,
  LoadingIcon,
  LogoutIcon,
  MenuIcon,
  MoreHorizIcon,
  MoreIcon,
  NotificationIcon,
  OpenInTabIcon,
  RadioOffIcon,
  RadioOnIcon,
  RecordsIcon,
  RefreshIcon,
  SearchIcon,
  SetupIcon,
  SortIcon,
  SuccessIcon,
  SummaryIcon,
  TrashIcon,
  UploadIcon,
  WarningIcon,
} from './icons';
