import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom';
import SimpleBlockEditor from '../../components/SimpleBlockEditor';

jest.mock('../../components/CodeBlock', () => () => null);
jest.mock('../../components/TableBlock', () => () => null);
jest.mock('../../components/FileViewer', () => () => null);
jest.mock('../../components/MathRenderer', () => ({ content }) => <>{content}</>);

const makeBlocks = () => [{
  id: 1,
  type: 'paragraph',
  content: '',
  properties: {}
}];

describe('SimpleBlockEditor typing', () => {
  test('preserves spaces in normal text input', () => {
    const onChange = jest.fn();
    const { container } = render(
      <SimpleBlockEditor blocks={makeBlocks()} onChange={onChange} />
    );
    const editable = container.querySelector('[contenteditable="true"]');

    editable.innerHTML = 'hello world';
    fireEvent.input(editable);

    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ content: 'hello world' })
    ]);
  });

  test('Enter creates and focuses a new text block', () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    const blocks = makeBlocks();
    const { container } = render(
      <SimpleBlockEditor blocks={blocks} onChange={onChange} />
    );
    const editable = container.querySelector('[contenteditable="true"]');

    fireEvent.keyDown(editable, { key: 'Enter', code: 'Enter' });
    jest.runOnlyPendingTimers();

    expect(onChange).toHaveBeenCalledWith([
      blocks[0],
      expect.objectContaining({
        type: 'paragraph',
        content: '',
        properties: {
          style: {
            fontFamily: "'Inter', sans-serif"
          }
        }
      })
    ]);
    jest.useRealTimers();
  });

  test('preserves mixed inline fonts while editing', () => {
    const onChange = jest.fn();
    const blocks = [{
      id: 1,
      type: 'paragraph',
      content: 'Old text <span style="font-family: Roboto, Arial, sans-serif;">new text</span>',
      properties: {}
    }];
    const { container } = render(
      <SimpleBlockEditor blocks={blocks} onChange={onChange} />
    );
    const editable = container.querySelector('[contenteditable="true"]');

    editable.innerHTML = 'Old text <span style="font-family: Roboto, Arial, sans-serif;">new text here</span>';
    fireEvent.input(editable);

    const savedContent = onChange.mock.calls.at(-1)[0][0].content;
    expect(savedContent).toContain('Old text ');
    expect(savedContent).toContain('font-family: Roboto');
    expect(savedContent).toContain('new text here');
  });

  test('applies the selected font only to newly typed text', () => {
    const onChange = jest.fn();
    const initialBlocks = [{
      id: 1,
      type: 'paragraph',
      content: 'Old text ',
      properties: {}
    }];
    const ControlledEditor = () => {
      const [blocks, setBlocks] = React.useState(initialBlocks);
      return (
        <SimpleBlockEditor
          blocks={blocks}
          onChange={(nextBlocks) => {
            onChange(nextBlocks);
            setBlocks(nextBlocks);
          }}
          typingFontFamily="'Roboto', Arial, sans-serif"
        />
      );
    };
    const { container } = render(
      <ControlledEditor />
    );
    const editable = container.querySelector('[contenteditable="true"]');
    editable.focus();
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(editable);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    const moveCaretToEnd = () => {
      const nextRange = document.createRange();
      nextRange.selectNodeContents(editable);
      nextRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(nextRange);
    };

    ['N', ' ', 'X'].forEach((data) => {
      moveCaretToEnd();
      if (data === ' ') {
        fireEvent.keyDown(editable, { key: ' ', code: 'Space' });
      } else {
        act(() => {
          editable.onbeforeinput(new InputEvent('beforeinput', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data
          }));
        });
      }
    });

    expect(editable.innerHTML).toContain('Old text ');
    expect(editable.innerHTML).toContain("font-family: 'Roboto'");
    expect(editable.textContent).toBe('Old text N X');

    const savedContent = onChange.mock.calls.at(-1)[0][0].content;
    expect(savedContent).toContain('Old text ');
    expect(savedContent).toContain("font-family: 'Roboto'");
  });

  test('applies the selected color only to newly typed text', () => {
    const onChange = jest.fn();
    const initialBlocks = [{
      id: 1,
      type: 'paragraph',
      content: 'Old text ',
      properties: {}
    }];
    const ControlledEditor = () => {
      const [blocks, setBlocks] = React.useState(initialBlocks);
      return (
        <SimpleBlockEditor
          blocks={blocks}
          onChange={(nextBlocks) => {
            onChange(nextBlocks);
            setBlocks(nextBlocks);
          }}
          typingTextColor="#e11d48"
        />
      );
    };
    const { container } = render(<ControlledEditor />);
    const editable = container.querySelector('[contenteditable="true"]');
    editable.focus();

    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(editable);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    act(() => {
      editable.onbeforeinput(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: 'R'
      }));
    });

    expect(editable.textContent).toBe('Old text R');
    expect(editable.innerHTML).toContain('color: rgb(225, 29, 72)');
    expect(editable.innerHTML.startsWith('Old text ')).toBe(true);

    const savedContent = onChange.mock.calls.at(-1)[0][0].content;
    expect(savedContent).toContain('Old text ');
    expect(savedContent).toContain('color: rgb(225, 29, 72)');
  });

  test('opens a clicked note link in a new tab', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const blocks = [{
      id: 1,
      type: 'paragraph',
      content: '<a href="https://example.com/path">Example</a>',
      properties: {}
    }];
    const { container } = render(
      <SimpleBlockEditor blocks={blocks} onChange={jest.fn()} />
    );

    fireEvent.click(container.querySelector('a'));

    expect(openSpy).toHaveBeenCalledWith(
      'https://example.com/path',
      '_blank',
      'noopener,noreferrer'
    );
    openSpy.mockRestore();
  });

  test('does not open unsafe note links', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const blocks = [{
      id: 1,
      type: 'paragraph',
      content: '<a href="javascript:alert(1)">Unsafe</a>',
      properties: {}
    }];
    const { container } = render(
      <SimpleBlockEditor blocks={blocks} onChange={jest.fn()} />
    );

    const anchor = container.querySelector('a');
    if (anchor) fireEvent.click(anchor);

    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });
});
