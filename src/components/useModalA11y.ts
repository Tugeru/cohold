"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Gives a mounted modal an initial focus target, a keyboard focus trap, and
 * focus restoration. The hook is intentionally DOM-local so financial dialogs
 * do not depend on a UI framework or leak focus into the page underneath.
 */
export function useModalA11y(onClose: () => void, disabled = false, active = true) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const disabledRef = useRef(disabled);
  useEffect(() => {
    onCloseRef.current = onClose;
    disabledRef.current = disabled;
  }, [onClose, disabled]);

  useEffect(() => {
    if (!active) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const firstFocusable = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? dialog).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!disabledRef.current) {
          event.preventDefault();
          onCloseRef.current();
        }
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      const activeIndex = focusable.indexOf(activeElement as HTMLElement);
      if (
        !dialog.contains(activeElement) ||
        activeIndex === -1 ||
        (!event.shiftKey && activeElement === last) ||
        (event.shiftKey && activeElement === first)
      ) {
        event.preventDefault();
        (event.shiftKey && (activeIndex === 0 || activeIndex === -1) ? last : first).focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [active]);

  return dialogRef;
}
