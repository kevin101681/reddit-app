import { ProxyPostsResponse, ProxyCommentsResponse } from './types';

const PROXY_URL = process.env.EXPO_PUBLIC_NETLIFY_PROXY_URL;
const COMMENTS_URL = process.env.EXPO_PUBLIC_NETLIFY_PROXY_URL_COMMENTS;

if (__DEV__) {
  if (!PROXY_URL) console.warn('[api] EXPO_PUBLIC_NETLIFY_PROXY_URL is not set.');
  if (!COMMENTS_URL) console.warn('[api] EXPO_PUBLIC_NETLIFY_PROXY_URL_COMMENTS is not set.');
}

function requireEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not configured. Set it in your .env.local file.`);
  return value.replace(/\/$/, '');
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
 * Fetch a page of posts.
 * GET {PROXY_URL}?subreddit=<sub>&sort=<sort>[&after=<cursor>]
 * Response: { posts: RedditPost[], after: string | null }
 */
export async function getPosts(
  subreddit: string,
  sort: string,
  after?: string,
  signal?: AbortSignal
): Promise<ProxyPostsResponse> {
  const base = requireEnv(PROXY_URL, 'EXPO_PUBLIC_NETLIFY_PROXY_URL');
  const params = new URLSearchParams({ subreddit, sort });
  if (after) params.set('after', after);
  return apiFetch<ProxyPostsResponse>(`${base}?${params.toString()}`, signal);
}

/**
 * Fetch the comment tree for a post.
 * GET {COMMENTS_URL}?subreddit=<sub>&id=<postId>
 * Response: { comments: RedditComment[] }
 */
export async function getComments(
  subreddit: string,
  postId: string,
  signal?: AbortSignal
): Promise<ProxyCommentsResponse> {
  const base = requireEnv(COMMENTS_URL, 'EXPO_PUBLIC_NETLIFY_PROXY_URL_COMMENTS');
  const params = new URLSearchParams({ subreddit, id: postId });
  return apiFetch<ProxyCommentsResponse>(`${base}?${params.toString()}`, signal);
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
