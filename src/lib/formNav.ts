import type { KeyboardEvent } from 'react';

// Shared "Enter jumps to next field" behaviour for forms and modals.
//
// Attach to the outer wrapper of a modal/form:
//   <div onKeyDown={handleEnterAsTab} ...>
//
// Pressing Enter inside any <input> or <select> in that wrapper moves focus
// to the next focusable field in the DOM (instead of doing nothing, or
// submitting). Enter still works normally inside <textarea> (new line) and
// on <button>/<a> (activates them), and is ignored on the last field in a
// section so a trailing Enter can reach a submit button naturally.
export function handleEnterAsTab(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Enter' || e.shiftKey) return;
  if (e.defaultPrevented) return; // a field already handled Enter itself (e.g. a bespoke row-navigation input)
  const target = e.target as HTMLElement;
  const tag = target.tagName;
  // Let these behave normally: textareas (newline), buttons/links (activate).
  if (tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A') return;
  // Don't hijack Enter while a <select>'s own dropdown/datalist is open via keyboard-only browsers.
  const container = e.currentTarget as HTMLElement;
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(
      'input:not([disabled]):not([type=hidden]):not([readonly]), select:not([disabled]), textarea:not([disabled])'
    )
  ).filter(el => el.offsetParent !== null);
  const idx = focusable.indexOf(target);
  if (idx === -1) return;
  e.preventDefault();
  const next = focusable[idx + 1];
  if (next) {
    next.focus();
    if (next instanceof HTMLInputElement && next.type !== 'checkbox' && next.type !== 'radio') {
      next.select();
    }
  }
}
