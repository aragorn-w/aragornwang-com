export type LigatureState = 'on' | 'off';

const STORAGE_KEY = 'ligatures';
const DEFAULT: LigatureState = 'on';

export function readStoredLigatures(): LigatureState | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'on' || v === 'off' ? v : null;
  } catch {
    return null;
  }
}

export function currentLigatures(): LigatureState {
  return readStoredLigatures() ?? DEFAULT;
}

export function applyLigatures(state: LigatureState) {
  document.documentElement.dataset.ligatures = state;
}

export function setLigatures(state: LigatureState) {
  try {
    localStorage.setItem(STORAGE_KEY, state);
  } catch {
    /* storage may be blocked — DOM still updates */
  }
  applyLigatures(state);
}

export function toggleLigatures(): LigatureState {
  const next: LigatureState = currentLigatures() === 'on' ? 'off' : 'on';
  setLigatures(next);
  return next;
}
