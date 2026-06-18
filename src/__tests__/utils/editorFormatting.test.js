import {
  applyInlineFontSize,
  clearInlineFontFamilies,
  clearInlineFontSizes,
  clearInlineTextColors,
  getRangeBlockFormat,
  getRangeFontSize
} from '../../utils/editorFormatting';

describe('clearInlineTextColors', () => {
  test('removes nested colors while preserving font formatting', () => {
    const fragment = document.createDocumentFragment();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = [
      '<span style="color: red; font-family: Georgia;" data-note-color="#ff0000">red</span>',
      '<span style="color: blue;">blue</span>',
      '<span>black</span>'
    ].join('');
    while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild);

    clearInlineTextColors(fragment);

    const spans = fragment.querySelectorAll('span');
    expect(spans[0].style.color).toBe('');
    expect(spans[0].style.fontFamily).toBe('Georgia');
    expect(spans[0]).not.toHaveAttribute('data-note-color');
    expect(spans[1].style.color).toBe('');
    expect(spans[2].textContent).toBe('black');
  });
});

describe('clearInlineFontFamilies', () => {
  test('removes nested fonts while preserving colors', () => {
    const fragment = document.createDocumentFragment();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = [
      '<span style="font-family: Georgia; color: red;" data-note-font="Georgia">serif</span>',
      '<span style="font-family: Arial;">sans</span>',
      '<span>default</span>'
    ].join('');
    while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild);

    clearInlineFontFamilies(fragment);

    const spans = fragment.querySelectorAll('span');
    expect(spans[0].style.fontFamily).toBe('');
    expect(spans[0].style.color).toBe('red');
    expect(spans[0]).not.toHaveAttribute('data-note-font');
    expect(spans[1].style.fontFamily).toBe('');
    expect(spans[2].textContent).toBe('default');
  });
});

describe('clearInlineFontSizes', () => {
  test('removes nested font sizes while preserving other inline formatting', () => {
    const fragment = document.createDocumentFragment();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = [
      '<span style="font-size: 28px; color: red;" data-note-size="28px">large</span>',
      '<font size="5"><span style="font-size: 20px; font-family: Georgia;">nested</span></font>',
      '<span>default</span>'
    ].join('');
    while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild);

    clearInlineFontSizes(fragment);

    const spans = fragment.querySelectorAll('span');
    const legacyFont = fragment.querySelector('font');
    expect(spans[0].style.fontSize).toBe('');
    expect(spans[0].style.color).toBe('red');
    expect(spans[0]).not.toHaveAttribute('data-note-size');
    expect(spans[1].style.fontSize).toBe('');
    expect(spans[1].style.fontFamily).toBe('Georgia');
    expect(legacyFont).not.toHaveAttribute('size');
    expect(spans[2].textContent).toBe('default');
  });
});

describe('applyInlineFontSize', () => {
  test('applies a new size to selected text and removes older nested sizes', () => {
    const editable = document.createElement('div');
    editable.innerHTML = [
      '<span style="font-size: 12px; color: green;" data-note-size="12px">today is </span>',
      '<span style="font-size: 24px; font-family: Georgia;" data-note-size="24px">a good day</span>'
    ].join('');
    document.body.appendChild(editable);

    const range = document.createRange();
    range.selectNodeContents(editable);
    const appliedSpan = applyInlineFontSize(range, '32px');

    expect(appliedSpan).not.toBeNull();
    expect(appliedSpan.style.fontSize).toBe('32px');
    expect(appliedSpan.dataset.noteSize).toBe('32px');
    expect(appliedSpan.textContent).toBe('today is a good day');
    expect(appliedSpan.querySelectorAll('[style*="font-size"]').length).toBe(0);
    expect(appliedSpan.innerHTML).toContain('color: green');
    expect(appliedSpan.innerHTML).toContain('font-family: Georgia');
    expect(range.toString()).toBe('today is a good day');

    editable.remove();
  });
});

describe('getRangeFontSize', () => {
  const availableSizes = ['12px', '16px', '24px', '32px'];

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('returns the selected text size instead of the previous typing size', () => {
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    editable.innerHTML = [
      '<span style="font-size: 16px;" data-note-size="16px">normal text</span>',
      '<span style="font-size: 24px;" data-note-size="24px">large text</span>'
    ].join('');
    document.body.appendChild(editable);

    const largeText = editable.querySelector('[data-note-size="24px"]').firstChild;
    const range = document.createRange();
    range.selectNodeContents(largeText);

    expect(getRangeFontSize(range, availableSizes, '16px')).toBe('24px');
  });

  test('returns normal for unformatted paragraph text', () => {
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    editable.textContent = 'plain text';
    document.body.appendChild(editable);

    const range = document.createRange();
    range.selectNodeContents(editable.firstChild);

    expect(getRangeFontSize(range, availableSizes, '16px')).toBe('16px');
  });

  test('maps legacy font size markup to the current dropdown options', () => {
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    editable.innerHTML = '<font size="5">old large text</font>';
    document.body.appendChild(editable);

    const range = document.createRange();
    range.selectNodeContents(editable.querySelector('font').firstChild);

    expect(getRangeFontSize(range, availableSizes, '16px')).toBe('24px');
  });
});

describe('getRangeBlockFormat', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('returns the heading level containing the selection', () => {
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    editable.innerHTML = '<h4>Selected heading</h4>';
    document.body.appendChild(editable);

    const range = document.createRange();
    range.selectNodeContents(editable.querySelector('h4').firstChild);

    expect(getRangeBlockFormat(range)).toBe('h4');
  });

  test('recognizes heading block classes on the editable element', () => {
    const editable = document.createElement('h2');
    editable.contentEditable = 'true';
    editable.className = 'block-content block-heading2';
    editable.textContent = 'Block heading';
    document.body.appendChild(editable);

    const range = document.createRange();
    range.selectNodeContents(editable.firstChild);

    expect(getRangeBlockFormat(range)).toBe('h2');
  });

  test('returns normal for paragraph text', () => {
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    editable.textContent = 'Normal text';
    document.body.appendChild(editable);

    const range = document.createRange();
    range.selectNodeContents(editable.firstChild);

    expect(getRangeBlockFormat(range)).toBe('p');
  });
});
