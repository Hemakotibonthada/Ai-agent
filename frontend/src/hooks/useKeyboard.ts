/* ===================================================================
   Nexus AI OS — useKeyboard Hook
   Global keyboard shortcuts
   =================================================================== */

import { useEffect } from 'react';
import { useStore } from '@/lib/store';

export function useKeyboard() {
  const {
    openCommandPalette, closeCommandPalette, commandPaletteOpen,
    openHelp, closeHelp, helpOpen,
    modalStack, popModal,
    toggleSidebar,
  } = useStore();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      /* Ctrl+K  → Command palette */
      if (ctrl && key === 'k') {
        e.preventDefault();
        commandPaletteOpen ? closeCommandPalette() : openCommandPalette();
        return;
      }

      /* Ctrl+/  → Help panel */
      if (ctrl && key === '/') {
        e.preventDefault();
        helpOpen ? closeHelp() : openHelp();
        return;
      }

      /* Ctrl+B  → Toggle sidebar */
      if (ctrl && key === 'b') {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      /* Escape  → Close topmost modal / palette / help */
      if (key === 'escape') {
        if (commandPaletteOpen) { closeCommandPalette(); return; }
        if (helpOpen) { closeHelp(); return; }
        if (modalStack.length > 0) { popModal(); return; }
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    commandPaletteOpen, helpOpen, modalStack,
    openCommandPalette, closeCommandPalette,
    openHelp, closeHelp,
    toggleSidebar, popModal,
  ]);
}

export default useKeyboard;
