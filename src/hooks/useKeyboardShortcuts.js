import { useEffect } from 'react';

const useKeyboardShortcuts = (handlers) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      const { key, altKey, shiftKey } = e;

      // Helper to check if a specific shortcut matches
      const matches = (targetKey, needsMod = false, needsAlt = false, needsShift = false) => {
        return (
          key.toLowerCase() === targetKey.toLowerCase() &&
          modKey === needsMod &&
          altKey === needsAlt &&
          shiftKey === needsShift
        );
      };

      // General shortcuts
      if (matches('s', true) && handlers.onSave) {
        e.preventDefault();
        handlers.onSave();
      }
      else if (matches('p', true) && handlers.onPrint) {
        e.preventDefault();
        handlers.onPrint();
      }
      else if (matches('k', true) && handlers.onQuickSearch) {
        e.preventDefault();
        handlers.onQuickSearch();
      }
      else if (matches('n', true) && handlers.onNewNote) {
        e.preventDefault();
        handlers.onNewNote();
      }
      else if (matches('d', true) && handlers.onDuplicate) {
        e.preventDefault();
        handlers.onDuplicate();
      }
      else if (matches('e', true) && handlers.onExport) {
        e.preventDefault();
        handlers.onExport();
      }
      else if (matches('f', true) && handlers.onFind) {
        e.preventDefault();
        handlers.onFind();
      }
      else if (matches('h', true) && handlers.onFindReplace) {
        e.preventDefault();
        handlers.onFindReplace();
      }
      else if (matches('/', true) && handlers.onShowShortcuts) {
        e.preventDefault();
        handlers.onShowShortcuts();
      }
      else if (key === 'Escape' && handlers.onEscape) {
        handlers.onEscape();
      }

      // Navigation shortcuts
      else if (matches('ArrowLeft', true) && handlers.onPreviousNote) {
        e.preventDefault();
        handlers.onPreviousNote();
      }
      else if (matches('ArrowRight', true) && handlers.onNextNote) {
        e.preventDefault();
        handlers.onNextNote();
      }
      else if (matches('ArrowUp', true) && handlers.onScrollTop) {
        e.preventDefault();
        handlers.onScrollTop();
      }
      else if (matches('ArrowDown', true) && handlers.onScrollBottom) {
        e.preventDefault();
        handlers.onScrollBottom();
      }
      else if (matches('b', true) && handlers.onToggleSidebar) {
        e.preventDefault();
        handlers.onToggleSidebar();
      }
      else if (matches('\\', true) && handlers.onToggleFocusMode) {
        e.preventDefault();
        handlers.onToggleFocusMode();
      }
      else if (matches('1', false, true) && handlers.onGoToDashboard) {
        e.preventDefault();
        handlers.onGoToDashboard();
      }
      else if (matches('2', false, true) && handlers.onGoToAIChat) {
        e.preventDefault();
        handlers.onGoToAIChat();
      }
      else if (matches('3', false, true) && handlers.onGoToNotes) {
        e.preventDefault();
        handlers.onGoToNotes();
      }

      // Heading shortcuts
      else if (matches('1', true, true) && handlers.onHeading1) {
        e.preventDefault();
        handlers.onHeading1();
      }
      else if (matches('2', true, true) && handlers.onHeading2) {
        e.preventDefault();
        handlers.onHeading2();
      }
      else if (matches('3', true, true) && handlers.onHeading3) {
        e.preventDefault();
        handlers.onHeading3();
      }
      else if (matches('0', true, true) && handlers.onNormalText) {
        e.preventDefault();
        handlers.onNormalText();
      }

      // View shortcuts
      else if (matches('f', true, false, true) && handlers.onFullscreen) {
        e.preventDefault();
        handlers.onFullscreen();
      }
      else if (matches('p', true, false, true) && handlers.onPreviewMode) {
        e.preventDefault();
        handlers.onPreviewMode();
      }
      else if (matches('e', true, false, true) && handlers.onEditMode) {
        e.preventDefault();
        handlers.onEditMode();
      }
      else if (matches('d', true, false, true) && handlers.onToggleDarkEditor) {
        e.preventDefault();
        handlers.onToggleDarkEditor();
      }
      else if (matches('l', true, false, true) && handlers.onToggleLightEditor) {
        e.preventDefault();
        handlers.onToggleLightEditor();
      }
      else if (matches('=', true) && handlers.onZoomIn) {
        e.preventDefault();
        handlers.onZoomIn();
      }
      else if (matches('-', true) && handlers.onZoomOut) {
        e.preventDefault();
        handlers.onZoomOut();
      }
      else if (matches('0', true) && handlers.onResetZoom) {
        e.preventDefault();
        handlers.onResetZoom();
      }

      // Organization shortcuts
      else if (matches('t', true, false, true) && handlers.onAddTag) {
        e.preventDefault();
        handlers.onAddTag();
      }
      else if (matches('f', true, false, true) && handlers.onToggleFavorite) {
        e.preventDefault();
        handlers.onToggleFavorite();
      }
      else if (matches('m', true, false, true) && handlers.onMoveToFolder) {
        e.preventDefault();
        handlers.onMoveToFolder();
      }
      else if (matches('a', true, false, true) && handlers.onArchive) {
        e.preventDefault();
        handlers.onArchive();
      }
      else if (matches('Delete', true, false, true) && handlers.onDelete) {
        e.preventDefault();
        handlers.onDelete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
};

export default useKeyboardShortcuts;
