"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

interface UseKeyboardShortcutsOptions {
  onEscape?: () => void;
}

function closeOpenDialogs() {
  const openDialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"]');

  openDialogs.forEach((dialog) => {
    const closeButton = dialog.querySelector<HTMLElement>("[data-dialog-close], button[aria-label='Close']");
    closeButton?.click();
  });
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const onEscape = options.onEscape;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMetaOrCtrl = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (isMetaOrCtrl && key === "k" && pathname === "/nodes") {
        event.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          '[data-search-input="nodes"]'
        );
        searchInput?.focus();
        searchInput?.select();
        return;
      }

      if (event.ctrlKey && key === "n") {
        event.preventDefault();
        router.push("/nodes/new");
        return;
      }

      if (event.key === "Escape") {
        onEscape?.();
        closeOpenDialogs();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onEscape, pathname, router]);
}
