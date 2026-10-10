const REMINDERS_EVENT = 'ams:reminders-changed';

/** Lets the top bar bell refresh its count after an action clears a reminder. */
export function notifyRemindersChanged(): void {
  window.dispatchEvent(new CustomEvent(REMINDERS_EVENT));
}

export function onRemindersChanged(handler: () => void): () => void {
  window.addEventListener(REMINDERS_EVENT, handler);
  return () => window.removeEventListener(REMINDERS_EVENT, handler);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}