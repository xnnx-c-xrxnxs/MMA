import * as React from 'react';
import { cn } from '../../../lib/utils';

const CardPanel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // TODO: add root Tailwind classes
      '',
      className,
    )}
    {...props}
  />
));
CardPanel.displayName = 'CardPanel';

const CardPanelHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // TODO: add header Tailwind classes
      '',
      className,
    )}
    {...props}
  />
));
CardPanelHeader.displayName = 'CardPanelHeader';

const CardPanelContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // TODO: add content Tailwind classes
      '',
      className,
    )}
    {...props}
  />
));
CardPanelContent.displayName = 'CardPanelContent';

export { CardPanel, CardPanelHeader, CardPanelContent };
