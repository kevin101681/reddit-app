import { RedditListing, RedditPost, RedditComment } from './types';

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

async function apiFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/** Fetch the front page (r/all or home) with optional pagination cursor */
export async function getFrontpage(
  after?: string,
  signal?: AbortSignal
): Promise<RedditListing<RedditPost>> {
  const query = after ? `?after=${after}&limit=25` : '?limit=25';
  return apiFetch<RedditListing<RedditPost>>(`/api/frontpage${query}`, signal);
}

/** Fetch posts from a specific subreddit */
export async function getSubreddit(
  subreddit: string,
  after?: string,
  signal?: AbortSignal
): Promise<RedditListing<RedditPost>> {
  const query = after ? `?after=${after}&limit=25` : '?limit=25';
  return apiFetch<RedditListing<RedditPost>>(
    `/api/r/${subreddit}${query}`,
    signal
  );
}

/** Fetch post detail + top-level comments */
export async function getPostDetail(
  subreddit: string,
  postId: string,
  signal?: AbortSignal
): Promise<[RedditListing<RedditPost>, RedditListing<RedditComment>]> {
  return apiFetch<[RedditListing<RedditPost>, RedditListing<RedditComment>]>(
    `/api/r/${subreddit}/comments/${postId}`,
    signal
  );
}

/** Search for subreddits by name */
export async function searchSubreddits(
  query: string,
  signal?: AbortSignal
): Promise<RedditListing<{ display_name: string; title: string; subscribers: number; public_description: string }>> {
  return apiFetch(`/api/subreddits/search?q=${encodeURIComponent(query)}`, signal);
}

/** Utility: format a Unix timestamp into a relative time string */
export function formatRelativeTime(utc: number): string {
  const diff = Math.floor(Date.now() / 1000) - utc;
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
}

/** Utility: compact number formatting (1.2k, 3.4m) */
export function formatScore(score: number): string {
  if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(1)}m`;
  if (score >= 1_000) return `${(score / 1_000).toFixed(1)}k`;
  return String(score);
}
