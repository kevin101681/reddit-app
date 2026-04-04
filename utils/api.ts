import { ProxyPostsResponse, RedditListing, RedditPost, RedditComment } from './types';

const PROXY_URL = process.env.EXPO_PUBLIC_NETLIFY_PROXY_URL;

if (!PROXY_URL && __DEV__) {
  console.warn(
    '[api] EXPO_PUBLIC_NETLIFY_PROXY_URL is not set. ' +
    'Copy .env.example to .env.local and fill in your Netlify proxy URL.'
  );
}

function getBaseUrl(): string {
  if (!PROXY_URL) {
    throw new Error(
      'EXPO_PUBLIC_NETLIFY_PROXY_URL is not configured. ' +
      'Set it in your .env.local file.'
    );
  }
  return PROXY_URL.replace(/\/$/, '');
}

async function apiFetch<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

/**
 * Fetch posts from the Netlify proxy.
 * Maps to: GET {PROXY_URL}?subreddit=<sub>&sort=<sort>[&after=<cursor>]
 * Response: { posts: RedditPost[], after: string | null }
 */
export async function getPosts(
  subreddit: string,
  sort: string,
  after?: string,
  signal?: AbortSignal
): Promise<ProxyPostsResponse> {
  const params = new URLSearchParams({ subreddit, sort });
  if (after) params.set('after', after);
  const url = `${getBaseUrl()}?${params.toString()}`;
  return apiFetch<ProxyPostsResponse>(url, signal);
}

/** Fetch post detail + top-level comments (still uses Reddit listing shape) */
export async function getPostDetail(
  subreddit: string,
  postId: string,
  signal?: AbortSignal
): Promise<[RedditListing<RedditPost>, RedditListing<RedditComment>]> {
  const url = `${getBaseUrl()}/comments/${postId}?subreddit=${subreddit}`;
  return apiFetch<[RedditListing<RedditPost>, RedditListing<RedditComment>]>(url, signal);
}

/** Format a Unix timestamp into a relative time string */
export function formatRelativeTime(utc: number): string {
  const diff = Math.floor(Date.now() / 1000) - utc;
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
}

/** Compact number formatting: 1200 ? "1.2k" */
export function formatScore(score: number): string {
  if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(1)}m`;
  if (score >= 1_000) return `${(score / 1_000).toFixed(1)}k`;
  return String(score);
}
