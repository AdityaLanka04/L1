import { clearInlineFontFamilies, clearInlineTextColors } from '../../utils/editorFormatting';

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
