// The session cookie is httpOnly, so the landing page cannot see it. This keeps
// the shop name from the last visit so the page can show the right button on the
// first frame. It is only a hint: the server check always has the final word.
const KEY = "pakka-shop";

export function readHint(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveHint(name: string): void {
  try {
    window.localStorage.setItem(KEY, name);
  } catch {
    // storage blocked: the page just waits for the server check
  }
}

export function clearHint(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
