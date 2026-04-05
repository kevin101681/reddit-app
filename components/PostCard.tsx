import React, { memo } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { RedditPost } from '../utils/types';
import { Colors, Spacing, Typography, Radius } from '../constants/theme';

const BRAND = '#7ba0b3';

interface PostCardProps {
  post: RedditPost;
  activePostId?: string | null;
}

function PostCardInner({ post, activePostId }: PostCardProps) {
  // ── Media URL resolution ────────────────────────────────────────────────────
  // Priority 1: Reddit native video (is_video posts and cross-post previews)
  const nativeVideoUrl =
    post.secure_media?.reddit_video?.fallback_url ??
    post.preview?.reddit_video_preview?.fallback_url ??
    null;

  // Priority 2: GIF/GIFV link posts (.gifv → .mp4 for Imgur's container format)
  const rawUrl = post.url ?? '';
  const isGif  = !post.is_video && /\.(gif|gifv)(\?.*)?$/i.test(rawUrl);
  const gifUrl = isGif ? rawUrl.replace(/\.gifv$/i, '.mp4') : null;

  const videoUrl  = nativeVideoUrl ?? gifUrl;
  const showVideo = !!videoUrl;

  // Prefer a mid-res preview image; fall back down the resolution chain
  const imageUrl =
    post.preview?.images?.[0]?.resolutions?.[2]?.url?.replace(/&amp;/g, '&') ??
    post.preview?.images?.[0]?.resolutions?.[1]?.url?.replace(/&amp;/g, '&') ??
    post.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') ??
    null;

  const showImage =
    !showVideo &&
    !!imageUrl &&
    post.thumbnail !== 'self' &&
    post.thumbnail !== 'default' &&
    post.thumbnail !== 'nsfw';

  const showSelftext =
    !showVideo &&
    !showImage &&
    !!post.selftext &&
    post.selftext.trim().length > 0;

  // ── Navigation ──────────────────────────────────────────────────────────────
  function handlePress() {
    router.push({
      pathname: '/post/[id]',
      params: {
        id: post.id,
        subreddit: post.subreddit,
        subreddit_name_prefixed: post.subreddit_name_prefixed,
        title: post.title,
        author: post.author,
        score: String(post.score),
        num_comments: String(post.num_comments),
        upvote_ratio: String(post.upvote_ratio),
        permalink: post.permalink,
        selftext: post.selftext ?? '',
        created_utc: String(post.created_utc),
        image_url: imageUrl ?? '',
        flair_text: post.flair_text ?? '',
        over_18: post.over_18 ? '1' : '0',
        is_video: post.is_video ? '1' : '0',
        url: post.url ?? '',
      },
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Pressable
      onPress={handlePress}
      // delayPressIn prevents the press state flickering during fast scrolls.
      // No opacity change on press — visual feedback comes from android_ripple only.
      android_ripple={{ color: Colors.primaryMuted }}
      style={styles.card}
    >
      {/* Title */}
      <Text style={styles.title}>
        {post.over_18 ? '[NSFW] ' : ''}{post.title}
      </Text>

      {/* Main content: native video > GIF video > image > selftext */}
      {showVideo ? (
        <Video
          source={{ uri: videoUrl! }}
          style={styles.media}
          shouldPlay={activePostId === post.id}
          isLooping
          isMuted
          resizeMode={ResizeMode.COVER}
        />
      ) : showImage ? (
        <Image
          source={{ uri: imageUrl! }}
          style={styles.media}
          resizeMode="cover"
        />
      ) : showSelftext ? (
        <Text style={styles.selftext} numberOfLines={3}>
          {post.selftext.trim()}
        </Text>
      ) : null}

      {/* Footer: subreddit left, comment icon right */}
      <View style={styles.footer}>
        <Text style={styles.subreddit} numberOfLines={1}>
          {post.subreddit_name_prefixed}
        </Text>
        <Pressable
          onPress={handlePress}
          hitSlop={10}
          style={styles.commentBtn}
          accessibilityLabel={`Open comments (${post.num_comments})`}
          accessibilityRole="button"
        >
          <MaterialIcons name="chat-bubble-outline" size={20} color={BRAND} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export const PostCard = memo(PostCardInner);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  title: {
    color: Colors.text,
    fontSize: Typography.md,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  media: {
    width: '100%',
    height: 220,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.border,
  },
  selftext: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    lineHeight: 19,
    marginBottom: Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  subreddit: {
    flex: 1,
    color: Colors.brand,
    fontSize: Typography.xs,
    fontWeight: '700',
  },
  commentBtn: {
    padding: Spacing.xs,
    borderRadius: Radius.sm,
  },
});