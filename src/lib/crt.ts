export type CrtState = 'on' | 'off';

const STORAGE_KEY = 'crt';
const DEFAULT: CrtState = 'on';

export function readStoredCrt(): CrtState | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'on' || v === 'off' ? v : null;
  } catch {
    return null;
  }
}

export function currentCrt(): CrtState {
  return readStoredCrt() ?? DEFAULT;
}

export function applyCrt(state: CrtState) {
  document.documentElement.dataset.crt = state;
}

export function setCrt(state: CrtState) {
  try {
    localStorage.setItem(STORAGE_KEY, state);
  } catch {
    /* storage may be blocked — DOM still updates */
  }
  applyCrt(state);
}

export function toggleCrt(): CrtState {
  const next: CrtState = currentCrt() === 'on' ? 'off' : 'on';
  setCrt(next);
  return next;
}
