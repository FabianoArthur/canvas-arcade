type Attrs = Record<string, string | boolean | undefined>;

/** Minimal element factory — text children are escaped by the DOM, never parsed as HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string | null)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children) {
    if (child !== null) el.append(child);
  }
  return el;
}

export function announce(message: string): void {
  const region = document.getElementById('announce');
  if (!region) return;
  region.textContent = '';
  // A fresh text node is what screen readers pick up reliably.
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

export const formatScore = (n: number): string => n.toLocaleString('en-US');
