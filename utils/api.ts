import { Platform } from "react-native";
import { RedditPost, RedditComment, PostsResponse, CommentsResponse } from "./types";

const REDDIT_BASE = "https://www.reddit.com";

// Mobile User-Agent reduces Reddit rate-limiting on native.
// Browsers block spoofed User-Agent headers outright, so we only send it on native.
const USER_AGENT = "android:com.personal.redditapp:v1.0.0 (by /u/kevin101681)";

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function redditFetch<T>(url: string, signal?: AbortSignal): Promise<T> {
  console.log("[API START] Fetching " + Platform.OS + ":", url);

  // Browsers silently drop (or hard-block) a spoofed User-Agent, so we omit it
  // on web and only attach it for native builds where it reduces rate-limiting.
  const headers: Record<string, string> = { "Accept": "application/json" };
  if (Platform.OS !== "web") {
    headers["User-Agent"] = USER_AGENT;
  }

  const response = await fetch(url, { headers, signal });

  if (!response.ok) {
    console.error("[API ERROR] " + response.status + " on " + Platform.OS + ":", url);
    throw new Error("API Error: " + response.status);
  }

  // allorigins /get always returns a JSON envelope:
  //   { contents: "<raw response body>", status: { http_code: 200, ... } }
  // Unwrap it on web so the rest of the code sees plain Reddit JSON.
  // On native we hit Reddit directly and parse the response as-is.
  if (Platform.OS === "web") {
    const wrapper = await response.json() as { contents: string; status: { http_code: number } };
    if (wrapper.status.http_code !== 200) {
      console.error("[API ERROR] allorigins upstream " + wrapper.status.http_code + ":", url);
      throw new Error("API Error: " + wrapper.status.http_code);
    }
    return JSON.parse(wrapper.contents) as T;
  }

  return response.json() as Promise<T>;
}

// ─── Filters ──────────────────────────────────────────────────────────────────

function isBotChild(child: any): boolean {
  const author: string = child?.data?.author ?? "";
  return author.toLowerCase() === "automoderator";
}

// ─── Post normalizer ──────────────────────────────────────────────────────────

function normalizePost(child: any): RedditPost | null {
  if (child.kind !== "t3") return null;
  const d = child.data;
  return {
    id:                      d.id,
    name:                    d.name,
    title:                   d.title      ?? "",
    author:                  d.author     ?? "[deleted]",
    subreddit:               d.subreddit  ?? "",
    subreddit_name_prefixed: d.subreddit_name_prefixed ?? ("r/" + d.subreddit),
    score:                   d.score ?? d.ups ?? 0,
    num_comments:            d.num_comments ?? 0,
    url:                     d.url        ?? "",
    permalink:               d.permalink  ?? "",
    thumbnail:               d.thumbnail  ?? "",
    preview:                 d.preview,
    secure_media:            d.secure_media ?? null,
    selftext:                d.selftext   ?? "",
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
  if (!child || child.kind === "more" || child.kind !== "t1") return null;
  if (!child.data?.author) return null;
  if (isBotChild(child)) return null;

  const d = child.data;

  let replies: RedditComment[] = [];
  if (d.replies && typeof d.replies === "object") {
    const replyChildren: any[] = d.replies?.data?.children ?? [];
    replies = replyChildren
      .filter((c: any) => c?.kind !== "more" && c?.data?.author && !isBotChild(c))
      .map((c: any) => normalizeComment(c, depth + 1))
      .filter((c): c is RedditComment => c !== null);
  }

  return {
    id:          d.id         ?? "",
    author:      d.author     ?? "[deleted]",
    body:        d.body       ?? "",
    score:       d.score      ?? 0,
    created_utc: d.created_utc ?? 0,
    depth,
    replies:     replies.length > 0 ? replies : undefined,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a page of posts.
 *
 * Native (iOS/Android): hits reddit.com directly.
 * Web: routes through allorigins.win/raw to bypass CORS and datacenter IP blocks.
 */
export async function getPosts(
  subreddit: string,
  sort: string,
  after?: string,
  signal?: AbortSignal
): Promise<PostsResponse> {
  const params = new URLSearchParams({ limit: "25", raw_json: "1" });
  if (after) params.set("after", after);

  // 1. Always build the canonical Reddit URL first
  let endpoint = REDDIT_BASE + "/r/" + encodeURIComponent(subreddit) + "/" + encodeURIComponent(sort) + ".json?" + params.toString();

  // 2. On web only: route through allorigins.win to bypass CORS and datacenter IP blocks
  if (Platform.OS === "web") {
    endpoint = "https://api.allorigins.win/get?url=" + encodeURIComponent(endpoint);
  }

  const raw = await redditFetch<any>(endpoint, signal);

  const posts = (raw?.data?.children ?? [])
    .filter((c: any) => !isBotChild(c))
    .map(normalizePost)
    .filter((p: RedditPost | null): p is RedditPost => p !== null);

  return { posts, after: raw?.data?.after ?? null };
}

/**
 * Fetch the comment tree for a post.
 *
 * Native (iOS/Android): hits reddit.com directly.
 * Web: routes through allorigins.win/raw to bypass CORS and datacenter IP blocks.
 *
 * Reddit returns a two-element array: [postListing, commentsListing].
 */
export async function getComments(
  subreddit: string | undefined,
  postId: string,
  signal?: AbortSignal
): Promise<CommentsResponse> {
  // 1. Always build the canonical Reddit URL first
  // Subreddit is optional: omitting it uses Reddit's global /comments/{id} endpoint
  let endpoint = subreddit
    ? REDDIT_BASE + "/r/" + encodeURIComponent(subreddit) + "/comments/" + encodeURIComponent(postId) + ".json?raw_json=1&limit=200"
    : REDDIT_BASE + "/comments/" + encodeURIComponent(postId) + ".json?raw_json=1&limit=200";

  // 2. On web only: route through allorigins.win to bypass CORS and datacenter IP blocks
  if (Platform.OS === "web") {
    endpoint = "https://api.allorigins.win/get?url=" + encodeURIComponent(endpoint);
  }

  const raw = await redditFetch<any[]>(endpoint, signal);

  const commentChildren: any[] = raw?.[1]?.data?.children ?? [];

  const comments = commentChildren
    .filter((c: any) => c?.kind !== "more" && c?.data?.author && !isBotChild(c))
    .map((c: any) => normalizeComment(c, 0))
    .filter((c): c is RedditComment => c !== null);

  return { comments };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function formatRelativeTime(utc: number): string {
  const diff = Math.floor(Date.now() / 1000) - utc;
  if (diff < 60)     return diff + "s";
  if (diff < 3600)   return Math.floor(diff / 60) + "m";
  if (diff < 86400)  return Math.floor(diff / 3600) + "h";
  if (diff < 604800) return Math.floor(diff / 86400) + "d";
  return Math.floor(diff / 604800) + "w";
}

export function formatScore(score: number): string {
  if (score >= 1_000_000) return (score / 1_000_000).toFixed(1) + "m";
  if (score >= 1_000)     return (score / 1_000).toFixed(1) + "k";
  return String(score);
}