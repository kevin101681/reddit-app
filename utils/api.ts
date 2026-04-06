import { RedditPost, RedditComment, PostsResponse, CommentsResponse } from './types';

const REDDIT_BASE = 'https://www.reddit.com';

/**
 * Mobile-formatted User-Agent required by Reddit to avoid rate-limiting.
 * Format: platform:appID:version (by /u/username)
 */
const USER_AGENT = 'android:com.personal.redditapp:v1.0.0 (by /u/kevin101681)';

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function redditFetch<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Accept':     'application/json',
      'User-Agent': USER_AGENT,
    },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Reddit API error ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

// ─── Filters ──────────────────────────────────────────────────────────────────

/** Returns true for children that should be silently dropped from any listing. */
function isBotChild(child: any): boolean {
  const author: string = child?.data?.author ?? '';
  return author.toLowerCase() === 'automoderator';
}

// ─── Post normalizer ──────────────────────────────────────────────────────────

function normalizePost(child: any): RedditPost | null {
  if (child.kind !== 't3') return null;
  const d = child.data;
  return {
    id:                      d.id,
    name:                    d.name,
    title:                   d.title      ?? '',
    author:                  d.author     ?? '[deleted]',
    subreddit:               d.subreddit  ?? '',
    subreddit_name_prefixed: d.subreddit_name_prefixed ?? `r/${d.subreddit}`,
    score:                   d.score ?? d.ups ?? 0,
    num_comments:            d.num_comments ?? 0,
    url:                     d.url        ?? '',
    permalink:               d.permalink  ?? '',
    thumbnail:               d.thumbnail  ?? '',
    preview:                 d.preview,
    secure_media:            d.secure_media ?? null,
    selftext:                d.selftext   ?? '',
    is_self:                 d.is_self    ?? false,
    is_video:                d.is_video   ?? false,
    created_utc:             d.created_utc ?? 0,
    upvote_ratio:            d.upvote_ratio ?? 0,
    stickied:                d.stickied  ?? false,
    over_18:                 d.over_18   ?? false,
    flair_text:              d.link_flair_text ?? d.flair_text ?? null,
  };
}

// ─── Comment normalizer (recursive) ──────────────────────────────────────────

function normalizeComment(child: any, depth = 0): RedditComment | null {
  // Strict guard: drop "more" sentinel nodes, non-comments, bots, and
  // anything missing an author (deleted/removed stubs that slipped through).
  if (!child || child.kind === 'more' || child.kind !== 't1') return null;
  if (!child.data?.author) return null;
  if (isBotChild(child)) return null;

  const d = child.data;

  // Recurse into nested replies — apply the same strict filter before mapping
  // so "more" sentinels and authorless stubs never reach normalizeComment.
  let replies: RedditComment[] = [];
  if (d.replies && typeof d.replies === 'object') {
    const replyChildren: any[] = d.replies?.data?.children ?? [];
    replies = replyChildren
      .filter((c: any) => c?.kind !== 'more' && c?.data?.author && !isBotChild(c))
      .map((c: any) => normalizeComment(c, depth + 1))
      .filter((c): c is RedditComment => c !== null);
  }

  return {
    id:          d.id         ?? '',
    author:      d.author     ?? '[deleted]',
    body:        d.body       ?? '',
    score:       d.score      ?? 0,
    created_utc: d.created_utc ?? 0,
    depth,
    replies:     replies.length > 0 ? replies : undefined,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a page of posts directly from Reddit.
 * GET https://www.reddit.com/r/{subreddit}/{sort}.json?limit=25[&after=cursor]
 */
export async function getPosts(
  subreddit: string,
  sort: string,
  after?: string,
  signal?: AbortSignal
): Promise<PostsResponse> {
  const params = new URLSearchParams({ limit: '25', raw_json: '1' });
  if (after) params.set('after', after);

  const url = `${REDDIT_BASE}/r/${encodeURIComponent(subreddit)}/${encodeURIComponent(sort)}.json?${params}`;
  const raw = await redditFetch<any>(url, signal);

  const posts = (raw?.data?.children ?? [])
    .filter((c: any) => !isBotChild(c))
    .map(normalizePost)
    .filter((p: RedditPost | null): p is RedditPost => p !== null);

  return { posts, after: raw?.data?.after ?? null };
}

/**
 * Fetch the comment tree for a post directly from Reddit.
 * GET https://www.reddit.com/r/{subreddit}/comments/{postId}.json
 * Reddit returns a two-element array: [postListing, commentsListing].
 */
export async function getComments(
  subreddit: string,
  postId: string,
  signal?: AbortSignal
): Promise<CommentsResponse> {
  const url = `${REDDIT_BASE}/r/${encodeURIComponent(subreddit)}/comments/${encodeURIComponent(postId)}.json?raw_json=1&limit=200`;
  const raw = await redditFetch<any[]>(url, signal);

  // raw[0] = post listing, raw[1] = comments listing
  const commentChildren: any[] = raw?.[1]?.data?.children ?? [];

  const comments = commentChildren
    .filter((c: any) => c?.kind !== 'more' && c?.data?.author && !isBotChild(c))
    .map((c: any) => normalizeComment(c, 0))
    .filter((c): c is RedditComment => c !== null);

  return { comments };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Format a Unix timestamp into a relative time string */
export function formatRelativeTime(utc: number): string {
  const diff = Math.floor(Date.now() / 1000) - utc;
  if (diff < 60)     return `${diff}s`;
  if (diff < 3600)   return `${Math.floor(diff / 60)}m`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
}

/** Compact number formatting: 1200 → "1.2k" */
export function formatScore(score: number): string {
  if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(1)}m`;
  if (score >= 1_000)     return `${(score / 1_000).toFixed(1)}k`;
  return String(score);
}