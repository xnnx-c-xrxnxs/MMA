// Utilities
export { cn } from './lib/utils';

// Icons (shared icon set — see ./icons/README.md)
export * from './icons';

// ────────────────────────────────────────────────────────────────────────────
// Components — organized by semantic category. Internally each component
// lives at `components/{category}/{name}/{name}.tsx` with an index.ts barrel.
// The public surface below is intentionally flat so consumers don't care
// about category boundaries.
// ────────────────────────────────────────────────────────────────────────────

// form-controls
export {
  Button,
  buttonVariants,
  type ButtonProps
} from './components/form-controls/button';
export {
  FileDropzone,
  type FileDropzoneProps
} from './components/form-controls/file-dropzone';
export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  ManagedForm,
  StructuredForm,
  useFormField,
  type FormStructure,
  type ManagedFormProps,
  type StructuredFormField,
  type StructuredFormProps,
  type StructuredFormSection
} from './components/form-controls/form';
export { Input, type InputProps } from './components/form-controls/input';
export { Label } from './components/form-controls/label';
export { Select } from './components/form-controls/select';

// data-display
export {
  Avatar,
  avatarVariants,
  type AvatarProps
} from './components/data-display/avatar';
export {
  Badge,
  badgeVariants,
  type BadgeProps
} from './components/data-display/badge';
export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardIcon,
  CardKeycap,
  CardRow,
  CardSection,
  CardShortcutRow,
  CardTitle,
  cardKeycapVariants,
  type CardKeycapProps
} from './components/data-display/card';
export {
  CardPanel,
  CardPanelContent,
  CardPanelHeader
} from './components/data-display/card-panel';
export {
  DataTable,
  type ColumnDef,
  type DataTableColumn,
  type DataTablePaginationProps,
  type DataTableProps
} from './components/data-display/data-table';
export {
  EmptyState,
  EmptyStateAction,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle
} from './components/data-display/empty-state';
export {
  Skeleton,
  skeletonVariants,
  type SkeletonProps
} from './components/data-display/skeleton';
export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
  TableSortButton,
  type TableHeadProps,
  type TablePaginationProps,
  type TableSortButtonProps,
  type TableSortDirection
} from './components/data-display/table';

// feedback
export {
  Modal,
  ModalBody,
  ModalClose,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalPortal,
  ModalTitle,
  ModalTrigger,
  modalContentVariants
} from './components/feedback/modal';
export type { ModalContentProps } from './components/feedback/modal';
export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger
} from './components/feedback/popover';
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger
} from './components/feedback/sheet';
export {
  Spinner,
  spinnerVariants,
  type SpinnerProps
} from './components/feedback/spinner';
export { Toaster, toast } from './components/feedback/toast';
export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from './components/feedback/tooltip';

// navigation
export {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionTrigger
} from './components/data-display/accordion';
export {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut
} from './components/navigation/command';
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from './components/navigation/dropdown-menu';
export {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from './components/navigation/tabs';

// layout
export { Separator } from './components/layout/separator';
