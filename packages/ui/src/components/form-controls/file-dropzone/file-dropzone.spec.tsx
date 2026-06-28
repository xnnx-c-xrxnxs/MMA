import { fireEvent, render, screen } from '@testing-library/react';
import { FileDropzone } from './file-dropzone';

function makeFile(name: string, type: string, size = 100): File {
  const file = new File(['x'.repeat(size)], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('FileDropzone', () => {
  it('renders the label and hint', () => {
    render(<FileDropzone onFileSelected={() => undefined} hint="Up to 5MB" />);
    expect(screen.getByText('Drop a file here, or click to browse')).toBeInTheDocument();
    expect(screen.getByText('Up to 5MB')).toBeInTheDocument();
  });

  it('marks the dropzone as button with correct tabindex', () => {
    render(<FileDropzone onFileSelected={() => undefined} />);
    const dz = screen.getByRole('button');
    expect(dz).toHaveAttribute('tabindex', '0');
  });

  it('disables interaction when disabled', () => {
    render(<FileDropzone onFileSelected={() => undefined} disabled />);
    const dz = screen.getByRole('button');
    expect(dz).toHaveAttribute('aria-disabled', 'true');
    expect(dz).toHaveAttribute('tabindex', '-1');
  });

  it('calls onFileSelected when a valid file is picked', () => {
    const onFileSelected = jest.fn();
    const { container } = render(
      <FileDropzone onFileSelected={onFileSelected} accept="image/png" />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('a.png', 'image/png');
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it('rejects files with the wrong MIME type via onValidationError', () => {
    const onFileSelected = jest.fn();
    const onValidationError = jest.fn();
    const { container } = render(
      <FileDropzone
        onFileSelected={onFileSelected}
        accept="image/png"
        onValidationError={onValidationError}
      />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('a.txt', 'text/plain');
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFileSelected).not.toHaveBeenCalled();
    expect(onValidationError).toHaveBeenCalled();
  });
});
