import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@personal_reddit:favorites';

/**
 * Return the persisted list of favourite subreddit names (lowercase, no r/ prefix).
 * Returns an empty array on any storage or parse error.
 */
export async function getFavorites(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Add a subreddit to the persisted favourites list (idempotent).
 * Normalises to lowercase and strips a leading "r/" if present.
 */
export async function addFavorite(subreddit: string): Promise<void> {
  try {
    const normalized = subreddit.toLowerCase().trim().replace(/^r\//i, '');
    const current = await getFavorites();
    if (current.includes(normalized)) return;
    await AsyncStorage.setItem(KEY, JSON.stringify([...current, normalized]));
  } catch {
    // Storage errors are non-fatal; silently ignore
  }
}

/**
 * Remove a subreddit from the persisted favourites list.
 * No-ops if the subreddit is not present.
 */
export async function removeFavorite(subreddit: string): Promise<void> {
  try {
    const normalized = subreddit.toLowerCase().trim().replace(/^r\//i, '');
    const current = await getFavorites();
    const updated = current.filter((s) => s !== normalized);
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // Storage errors are non-fatal; silently ignore
  }
}
