import { ThemeToggle } from '../theme-toggle';

export function Header({ title }: { title: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      <ThemeToggle />
    </header>
  );
}
