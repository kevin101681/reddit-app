// Type definitions for Reddit API responses

export interface RedditPost {
  id: string;
  name: string;              // Reddit fullname, e.g. "t3_abc123" — pagination cursor
  title: string;
  author: string;
  subreddit: string;
  subreddit_name_prefixed: string;
  score: number;
  num_comments: number;
  url: string;
  permalink: string;
  thumbnail: string;
  preview?: {
    images: Array<{
      source: { url: string; width: number; height: number };
      resolutions: Array<{ url: string; width: number; height: number }>;
      /** Reddit's server-side GIF→MP4 conversion, present on animated preview images */
      variants?: {
        mp4?: { source?: { url: string; width: number; height: number } };
      };
    }>;
    /** Reddit-hosted GIF-to-video preview (cross-post / preview fallback) */
    reddit_video_preview?: {
      hls_url?: string;
      fallback_url: string;
      height?: number;
      width?: number;
      is_gif?: boolean;
    };
  };
  /** Present on native Reddit video posts (is_video === true) */
  secure_media?: {
    reddit_video?: {
      hls_url?: string;
      fallback_url: string;
      height?: number;
      width?: number;
      is_gif?: boolean;
    };
  } | null;
  selftext: string;
  is_self: boolean;
  is_video: boolean;
  created_utc: number;
  upvote_ratio: number;
  stickied: boolean;
  over_18: boolean;
  flair_text: string | null;
}

export interface RedditComment {
  id: string;
  author: string;
  body: string;
  score: number;
  created_utc: number;
  depth: number;
  replies?: RedditComment[];
  /** Reddit-hosted images embedded in the comment (%%imageId%% syntax in body) */
  media_metadata?: Record<string, { e: string; s?: { u: string; x: number; y: number } }>;
}

/** Normalised posts page returned by getPosts() */
export interface PostsResponse {
  posts: RedditPost[];
  after: string | null;
}

/** Normalised comments list returned by getComments() */
export interface CommentsResponse {
  comments: RedditComment[];
}

/** Raw Reddit listing wrapper (used internally by normalizers) */
export interface RedditListingChild<T> {
  kind: string;
  data: T;
}

export interface RedditListing<T> {
  kind: string;
  data: {
    after: string | null;
    before: string | null;
    children: RedditListingChild<T>[];
    dist: number;
  };
}
