import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Converts any stored date (e.g. "2024-09-25" from a date input, or a full
// ISO timestamp like "2024-09-25T10:30:00Z" from created_at) into India's
// standard DD/MM/YYYY display format. Used everywhere a date is shown as
// text — never affects what's actually stored in the database.
export function formatDate(value?: string | null): string {
  if (!value) return '-';
  const datePart = value.split('T')[0]; // strip time if it's a full timestamp
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value; // not a recognizable date — show as-is rather than guessing
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

// Like formatDate, but keeps the time portion for full timestamps
// (e.g. created_at columns) so backups don't lose useful detail.
export function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const [datePart, timePart] = value.split('T');
  const match = datePart?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  const dateStr = `${day}/${month}/${year}`;
  if (!timePart) return dateStr;
  const time = timePart.slice(0,5); // HH:MM
  return `${dateStr} ${time}`;
}
