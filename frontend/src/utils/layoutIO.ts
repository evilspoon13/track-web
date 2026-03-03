import type { SavedLayout } from "../types";

const STORAGE_KEY = "fsae_screens";

interface StorageData {
  screens: Record<string, SavedLayout>;
}

function getStorage(): StorageData {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : { screens: {} };
  } catch {
    return { screens: {} };
  }
}

function setStorage(data: StorageData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function listScreens(): string[] {
  const storage = getStorage();
  return Object.keys(storage.screens);
}

export function loadScreen(name: string): SavedLayout | null {
  const storage = getStorage();
  return storage.screens[name] ?? null;
}

export function saveScreen(screen: SavedLayout): void {
  const storage = getStorage();
  storage.screens[screen.name] = screen;
  setStorage(storage);
}

export function deleteScreen(name: string): void {
  const storage = getStorage();
  delete storage.screens[name];
  setStorage(storage);
}
