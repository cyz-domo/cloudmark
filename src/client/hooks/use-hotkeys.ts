import { useEffect } from "react";

export type HotkeyHandler = (event: KeyboardEvent) => void;

export interface HotkeyBinding {
  /** Key from KeyboardEvent.key (case-insensitive for letters) */
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** When true, fire even if focus is in input/textarea/contenteditable */
  allowInInput?: boolean;
  handler: HotkeyHandler;
  /** Description for help panel */
  description?: string;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("[role='textbox'], [contenteditable='true']"));
}

function matchMod(
  event: KeyboardEvent,
  binding: HotkeyBinding,
): boolean {
  const meta = Boolean(binding.meta);
  const ctrl = Boolean(binding.ctrl);
  const shift = Boolean(binding.shift);
  const alt = Boolean(binding.alt);

  // Treat Meta (mac) and Ctrl (win/linux) as interchangeable when meta OR ctrl requested
  if (meta || ctrl) {
    const mod = event.metaKey || event.ctrlKey;
    if (!mod) return false;
  } else if (event.metaKey || event.ctrlKey) {
    return false;
  }

  if (shift !== event.shiftKey) return false;
  if (alt !== event.altKey) return false;
  return true;
}

/**
 * Register global keyboard shortcuts. Handlers run in registration order;
 * first matching binding that does not call preventDefault still stops further matches.
 */
export function useHotkeys(
  bindings: HotkeyBinding[],
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      for (const binding of bindings) {
        if (!binding.allowInInput && isTypingTarget(event.target)) {
          // Allow Escape even in inputs when explicitly bound with allowInInput
          continue;
        }

        const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
        const expected =
          binding.key.length === 1 ? binding.key.toLowerCase() : binding.key;

        if (key !== expected) continue;
        if (!matchMod(event, binding)) continue;

        event.preventDefault();
        binding.handler(event);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bindings, enabled]);
}

export function isModKey(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey;
}
