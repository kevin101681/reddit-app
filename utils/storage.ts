import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_FAVORITES = '@personal_reddit:favorites';
const KEY_SORT      = '@personal_reddit:sort';

// ─── Favourites ───────────────────────────────────────────────────────────────

/**
 * Return the persisted list of favourite subreddit names (lowercase, no r/ prefix).
 * Returns an empty array on any storage or parse error.
 */
export async function getFavorites(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_FAVORITES);
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
    await AsyncStorage.setItem(KEY_FAVORITES, JSON.stringify([...current, normalized]));
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
    await AsyncStorage.setItem(KEY_FAVORITES, JSON.stringify(updated));
  } catch {
    // Storage errors are non-fatal; silently ignore
  }
}

// ─── Sort preference ──────────────────────────────────────────────────────────

const VALID_SORTS = ['hot', 'new', 'top', 'controversial'];

function sortKey(subreddit: string): string {
  const normalized = subreddit.toLowerCase().trim().replace(/^r\//i, '') || 'all';
  return `@personal_reddit:sort:${normalized}`;
}

/**
 * Return the persisted sort preference for a specific subreddit.
 * Defaults to "hot" if nothing is stored or the stored value is invalid.
 */
export async function getSortPreference(subreddit = 'all'): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(sortKey(subreddit));
    if (raw && VALID_SORTS.includes(raw)) return raw;
    return 'hot';
  } catch {
    return 'hot';
  }
}

/**
 * Persist the sort preference for a specific subreddit.
 */
export async function setSortPreference(sort: string, subreddit = 'all'): Promise<void> {
  try {
    await AsyncStorage.setItem(sortKey(subreddit), sort);
  } catch {
    // Storage errors are non-fatal; silently ignore
  }
}