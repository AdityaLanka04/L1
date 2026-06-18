export const clearInlineTextColors = (fragment) => {
  const coloredElements = fragment?.querySelectorAll?.('[style], [data-note-color]') || [];

  coloredElements.forEach((node) => {
    node.style?.removeProperty('color');
    node.removeAttribute?.('data-note-color');
    if (node.getAttribute?.('style') === '') {
      node.removeAttribute('style');
    }
  });

  return fragment;
};

export const clearInlineFontFamilies = (fragment) => {
  const fontElements = fragment?.querySelectorAll?.('[style], [data-note-font]') || [];

  fontElements.forEach((node) => {
    node.style?.removeProperty('font-family');
    node.removeAttribute?.('data-note-font');
    if (node.getAttribute?.('style') === '') {
      node.removeAttribute('style');
    }
  });

  return fragment;
};
