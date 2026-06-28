import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { CardPanel, CardPanelHeader, CardPanelContent } from './card-panel';

describe('CardPanel', () => {
  it('renders without crashing', () => {
    render(<CardPanel data-testid="card-panel" />);
    expect(screen.getByTestId('card-panel')).toBeInTheDocument();
  });

  it('renders sub-components', () => {
    render(
      <CardPanel>
        <CardPanelHeader data-testid="card-panel-header">
          Header
        </CardPanelHeader>
        <CardPanelContent data-testid="card-panel-content">
          Content
        </CardPanelContent>
      </CardPanel>,
    );
    expect(screen.getByTestId('card-panel-header')).toBeInTheDocument();
    expect(screen.getByTestId('card-panel-content')).toBeInTheDocument();
  });

  it('forwards ref to the underlying element', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<CardPanel ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('merges additional className', () => {
    render(<CardPanel className="custom-class" data-testid="card-panel" />);
    expect(screen.getByTestId('card-panel').className).toContain(
      'custom-class',
    );
  });
});
