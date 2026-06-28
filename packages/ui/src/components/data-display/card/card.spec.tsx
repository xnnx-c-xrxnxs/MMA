import { render, screen } from '@testing-library/react';
import {
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
} from './card';

describe('Card', () => {
  it('renders all sub-parts together', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Subtitle</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>,
    );
    expect(screen.getByRole('heading', { name: 'Title', level: 3 })).toBeInTheDocument();
    expect(screen.getByText('Subtitle')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('forwards className to the outer card', () => {
    const { container } = render(<Card className="custom" data-testid="c" />);
    expect(container.firstChild).toHaveClass('custom');
    expect(container.firstChild).toHaveClass('rounded-lg');
  });

  it('renders metric row label/value pairs', () => {
    render(<CardRow label="Total Included" value="186" />);
    expect(screen.getByText('Total Included')).toBeInTheDocument();
    expect(screen.getByText('186')).toBeInTheDocument();
  });

  it('renders shortcut keys content', () => {
    render(
      <CardShortcutRow
        keys={
          <>
            <CardKeycap>Ctrl/Cmd</CardKeycap>
            <CardKeycap>A</CardKeycap>
          </>
        }
        label="Select all"
      />,
    );

    expect(screen.getByText('Select all')).toBeInTheDocument();
    expect(screen.getByText('Ctrl/Cmd')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('applies semantic tone styles to keycaps', () => {
    render(<CardKeycap tone="success">I</CardKeycap>);
    const keycap = screen.getByText('I');
    expect(keycap).toHaveClass('bg-success-bg');
    expect(keycap).toHaveClass('text-success-text');
  });

  it('renders the leading icon in a CardRow when provided', () => {
    render(<CardRow label="With icon" value="42" icon={<span data-testid="row-icon">★</span>} />);
    expect(screen.getByTestId('row-icon')).toBeInTheDocument();
    expect(screen.getByText('With icon')).toBeInTheDocument();
  });

  it('renders CardAction as a button with a default type', () => {
    render(<CardAction>Save</CardAction>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  it('honors an explicit CardAction type', () => {
    render(<CardAction type="submit">Submit</CardAction>);
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('type', 'submit');
  });

  it('renders CardSection and CardIcon', () => {
    render(
      <CardSection data-testid="section">
        <CardIcon data-testid="icon">★</CardIcon>
      </CardSection>,
    );
    expect(screen.getByTestId('section')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });
});
