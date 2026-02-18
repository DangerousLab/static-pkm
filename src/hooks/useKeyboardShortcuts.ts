import { useEffect, useCallback, useRef } from 'react';
import { useSidebarStore } from '@core/state/sidebarStore';
import { useSearchStore } from '@core/state/searchStore';

/**
 * Check if running on Mac
 */
function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

/**
 * Hook to handle global keyboard shortcuts
 */
export function useKeyboardShortcuts(): void {
  const closeSidebar = useSidebarStore((state) => state.close);
  const openSidebar = useSidebarStore((state) => state.open);
  const sidebarIsOpen = useSidebarStore((state) => state.isOpen);

  const clearSearch = useSearchStore((state) => state.clearSearch);
  const searchQuery = useSearchStore((state) => state.query);

  // Use refs to avoid stale closures in event handler
  const sidebarIsOpenRef = useRef(sidebarIsOpen);
  const searchQueryRef = useRef(searchQuery);

  // Keep refs up to date
  useEffect(() => {
    sidebarIsOpenRef.current = sidebarIsOpen;
  }, [sidebarIsOpen]);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  /**
   * Focus the search input, or toggle sidebar if already focused
   * Ctrl+K / Cmd+K acts as a toggle for sidebar+search
   */
  const handleSearchShortcut = useCallback(() => {
    const searchInput = document.querySelector<HTMLInputElement>('.search-input');
    console.log('[DEBUG] [useKeyboardShortcuts] handleSearchShortcut called');
    console.log('[DEBUG] [useKeyboardShortcuts] searchInput found:', !!searchInput);
    console.log('[DEBUG] [useKeyboardShortcuts] activeElement:', document.activeElement?.className);
    console.log('[DEBUG] [useKeyboardShortcuts] sidebarIsOpen:', sidebarIsOpenRef.current);

    // If search is already focused, close sidebar (toggle behavior)
    if (searchInput && document.activeElement === searchInput) {
      console.log('[DEBUG] [useKeyboardShortcuts] Search focused, closing sidebar');
      searchInput.blur();
      closeSidebar();
      return;
    }

    // If sidebar is open but search not focused, close sidebar
    if (sidebarIsOpenRef.current) {
      console.log('[DEBUG] [useKeyboardShortcuts] Sidebar open, closing it');
      closeSidebar();
      return;
    }

    // Otherwise, open sidebar and focus search
    console.log('[DEBUG] [useKeyboardShortcuts] Opening sidebar and focusing search');
    openSidebar();

    // Wait for sidebar transition to complete (~220ms in CSS), then focus search
    // Use multiple rAFs to ensure DOM is fully painted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const input = document.querySelector<HTMLInputElement>('.search-input');
        console.log('[DEBUG] [useKeyboardShortcuts] Looking for search input:', !!input);
        if (input) {
          input.focus();
          input.select();
          console.log('[DEBUG] [useKeyboardShortcuts] Search input focused');
        }
      });
    });
  }, [openSidebar, closeSidebar]);

  /**
   * Handle Escape key
   */
  const handleEscape = useCallback(() => {
    // Clear search if has query
    if (searchQueryRef.current) {
      clearSearch();
      const searchInput = document.querySelector<HTMLInputElement>('.search-input');
      searchInput?.blur();
      return;
    }

    // Close sidebar if open
    if (sidebarIsOpenRef.current) {
      closeSidebar();
      return;
    }

    // Blur active element
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [clearSearch, closeSidebar]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const { key, ctrlKey, metaKey } = event;
      const ctrlOrCmd = isMac() ? metaKey : ctrlKey;

      // Get target element info
      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' ||
                      target.tagName === 'TEXTAREA' ||
                      target.isContentEditable;
      const isSearchInput = target.classList.contains('search-input');

      // Cmd/Ctrl + K - Toggle sidebar with search focus
      if (ctrlOrCmd && key.toLowerCase() === 'k') {
        console.log('[DEBUG] [useKeyboardShortcuts] Ctrl+K pressed');
        event.preventDefault();
        event.stopPropagation();
        handleSearchShortcut();
        return;
      }

      // Escape - Clear/close
      if (key === 'Escape') {
        event.preventDefault();
        handleEscape();
        return;
      }

      // Don't handle remaining shortcuts when in non-search inputs
      if (isInput && !isSearchInput) {
        return;
      }

      // / - Focus search (vim-style) - only when not in any input
      if (key === '/' && !isInput) {
        console.log('[DEBUG] [useKeyboardShortcuts] / pressed');
        event.preventDefault();
        handleSearchShortcut();
        return;
      }
    };

    // Use capture phase to ensure we get the event before other handlers
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handleSearchShortcut, handleEscape]);
}

/**
 * Get list of available shortcuts for help display
 */
export function getShortcutsList(): Array<{ keys: string; description: string }> {
  const cmdKey = isMac() ? '⌘' : 'Ctrl';

  return [
    { keys: `${cmdKey} + K`, description: 'Toggle sidebar (opens search)' },
    { keys: '/', description: 'Open sidebar & focus search (vim-style)' },
    { keys: 'Escape', description: 'Clear search / Close sidebar' },
    { keys: '↑ / ↓', description: 'Navigate search results' },
    { keys: 'Enter', description: 'Open selected result' },
  ];
}
