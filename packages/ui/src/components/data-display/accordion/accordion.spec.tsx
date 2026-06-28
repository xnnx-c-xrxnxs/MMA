import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './accordion';

describe('Accordion', () => {
  it('renders trigger and toggles item state', async () => {
    const user = userEvent.setup();

    render(
      <Accordion collapsible type="single">
        <AccordionItem value="item-1">
          <AccordionTrigger>FAQ</AccordionTrigger>
          <AccordionContent>Answer content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    const trigger = screen.getByRole('button', { name: 'FAQ' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Answer content')).toBeInTheDocument();
  });

  it('renders subtitle and addon slots', () => {
    render(
      <Accordion collapsible type="single">
        <AccordionItem value="item-1">
          <AccordionTrigger
            leftAddon={<span data-testid="left-addon">L</span>}
            rightAddon={<span data-testid="right-addon">R</span>}
            subtitle="Subtext"
          >
            Header
          </AccordionTrigger>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    expect(screen.getByText('Subtext')).toBeInTheDocument();
    expect(screen.getByTestId('left-addon')).toBeInTheDocument();
    expect(screen.getByTestId('right-addon')).toBeInTheDocument();
  });

  it('forwards ref to trigger button element', () => {
    const ref = React.createRef<HTMLButtonElement>();

    render(
      <Accordion collapsible type="single">
        <AccordionItem value="item-1">
          <AccordionTrigger ref={ref}>Header</AccordionTrigger>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('merges custom className values', () => {
    render(
      <Accordion collapsible type="single">
        <AccordionItem className="custom-item" data-testid="item" value="item-1">
          <AccordionTrigger className="custom-trigger">Header</AccordionTrigger>
          <AccordionContent className="custom-content">Content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    expect(screen.getByTestId('item').className).toContain('custom-item');
    expect(screen.getByRole('button', { name: 'Header' }).className).toContain(
      'custom-trigger',
    );
    expect(screen.getByRole('region', { hidden: true }).className).toContain(
      'custom-content',
    );
  });
});
