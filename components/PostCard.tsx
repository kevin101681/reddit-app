import React, { memo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  Linking,
  StyleSheet,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { RedditPost } from '../utils/types';
import { Colors, Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';

const BRAND = '#7ba0b3';

// Thumbnails whose value is a sentinel string rather than a real URL
const SENTINEL_THUMBNAILS = new Set(['self', 'default', 'nsfw', 'spoiler', 'image', '']);

interface PostCardProps {
  post: RedditPost;
  activePostId?: string | null;
}

function PostCardInner({ post, activePostId }: PostCardProps) {
  const { theme } = useTheme();
  const [isMuted, setIsMuted] = useState(true);
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const videoRef = useRef<Video>(null);

  // ── Media URL resolution ────────────────────────────────────────────────────
  const nativeVideoUrl =
    post.secure_media?.reddit_video?.fallback_url ??
    post.preview?.reddit_video_preview?.fallback_url ??
    null;

  const rawUrl = post.url ?? '';
  const isGif  = !post.is_video && /\.(gif|gifv)(\?.*)?$/i.test(rawUrl);
  const gifUrl = isGif ? rawUrl.replace(/\.gifv$/i, '.mp4') : null;

  const videoUrl  = nativeVideoUrl ?? gifUrl;
  const showVideo = !!videoUrl;

  // Full-size preview image (Type A)
  const previewImageUrl =
    post.preview?.images?.[0]?.resolutions?.[2]?.url?.replace(/&amp;/g, '&') ??
    post.preview?.images?.[0]?.resolutions?.[1]?.url?.replace(/&amp;/g, '&') ??
    post.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') ??
    null;

  const sourceImg = post.preview?.images?.[0]?.source;
  const imageAspectRatio =
    sourceImg?.width && sourceImg?.height
      ? sourceImg.width / sourceImg.height
      : 16 / 9;

  // ── Post-type classification ───────────────────────────────────────────────
  // Type A: has a full preview image or is a native/gif video
  const isTypeA = showVideo || (!!previewImageUrl && !SENTINEL_THUMBNAILS.has(post.thumbnail));

  // Type B: external link post with a valid thumbnail but no full preview
  const hasThumbnail =
    !!post.thumbnail &&
    !SENTINEL_THUMBNAILS.has(post.thumbnail) &&
    post.thumbnail.startsWith('http');
  const isTypeB = !isTypeA && hasThumbnail;

  // Type C: selftext post (pure text — only when neither A nor B)
  const isTypeC =
    !isTypeA &&
    !isTypeB &&
    post.is_self &&
    !!post.selftext &&
    post.selftext.trim().length > 0;

  // ── Navigation ──────────────────────────────────────────────────────────────
  function openPostDetail() {
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
        image_url: previewImageUrl ?? '',
        flair_text: post.flair_text ?? '',
        over_18: post.over_18 ? '1' : '0',
        is_video: post.is_video ? '1' : '0',
        url: post.url ?? '',
      },
    });
  }

  function openExternalLink() {
    if (post.url) Linking.openURL(post.url).catch(() => {});
  }

  // ── Shared footer ──────────────────────────────────────────────────────────
  function renderFooter() {
    return (
      <View style={styles.footer}>
        <Text style={[styles.subreddit, { color: theme.brand }]} numberOfLines={1}>
          {post.subreddit_name_prefixed}
        </Text>

        {/* Mute toggle — video posts only */}
        {showVideo && (
          <Pressable
            onPress={() => setIsMuted((prev) => !prev)}
            hitSlop={10}
            style={styles.footerBtn}
            accessibilityLabel={isMuted ? 'Unmute video' : 'Mute video'}
            accessibilityRole="button"
          >
            <MaterialIcons
              name={isMuted ? 'volume-off' : 'volume-up'}
              size={20}
              color={BRAND}
            />
          </Pressable>
        )}

        {/* Expand/collapse chevron — text posts only */}
        {isTypeC && (
          <Pressable
            onPress={() => setIsTextExpanded((prev) => !prev)}
            hitSlop={10}
            style={styles.footerBtn}
            accessibilityLabel={isTextExpanded ? 'Collapse text' : 'Expand text'}
            accessibilityRole="button"
          >
            <MaterialIcons
              name={isTextExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={20}
              color={BRAND}
            />
          </Pressable>
        )}

        <Pressable
          onPress={openPostDetail}
          hitSlop={10}
          style={styles.footerBtn}
          accessibilityLabel={`Open comments (${post.num_comments})`}
          accessibilityRole="button"
        >
          <MaterialIcons name="chat-bubble-outline" size={20} color={BRAND} />
        </Pressable>
      </View>
    );
  }

  // ── Type A: standard media card ────────────────────────────────────────────
  if (isTypeA) {
    return (
      <Pressable
        onPress={openPostDetail}
        android_ripple={{ color: theme.primaryMuted }}
        style={[styles.card, { backgroundColor: theme.surface }]}
      >
        <Text style={[styles.title, { color: theme.text }]}>
          {post.over_18 ? '[NSFW] ' : ''}{post.title}
        </Text>

        {showVideo ? (
          <View style={styles.videoContainer}>
            <Video
              ref={videoRef}
              source={{ uri: videoUrl! }}
              style={styles.video}
              shouldPlay={activePostId === post.id}
              isLooping
              isMuted={isMuted}
              resizeMode={ResizeMode.CONTAIN}
            />
          </View>
        ) : (
          <Image
            source={{ uri: previewImageUrl! }}
            style={[styles.image, { aspectRatio: imageAspectRatio }]}
            resizeMode="contain"
          />
        )}

        {renderFooter()}
      </Pressable>
    );
  }

  // ── Type B: external link with thumbnail ───────────────────────────────────
  if (isTypeB) {
    return (
      <Pressable
        onPress={openPostDetail}
        android_ripple={{ color: theme.primaryMuted }}
        style={[styles.card, { backgroundColor: theme.surface }]}
      >
        <View style={styles.linkRow}>
          {/* Left: title + external link tap target */}
          <Pressable style={styles.linkTextArea} onPress={openExternalLink}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={4}>
              {post.over_18 ? '[NSFW] ' : ''}{post.title}
            </Text>
            <Text style={[styles.linkDomain, { color: theme.textMuted }]} numberOfLines={1}>
              {(() => { try { return new URL(post.url).hostname.replace(/^www\./, ''); } catch { return post.url; } })()}
            </Text>
          </Pressable>

          {/* Right: small thumbnail */}
          <Image
            source={{ uri: post.thumbnail }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        </View>

        {renderFooter()}
      </Pressable>
    );
  }

  // ── Type C: expandable selftext ────────────────────────────────────────────
  if (isTypeC) {
    return (
      <Pressable
        onPress={openPostDetail}
        android_ripple={{ color: theme.primaryMuted }}
        style={[styles.card, { backgroundColor: theme.surface }]}
      >
        <Text style={[styles.title, { color: theme.text }]}>
          {post.over_18 ? '[NSFW] ' : ''}{post.title}
        </Text>

        <Text
          style={[styles.selftext, { color: theme.textMuted }]}
          numberOfLines={isTextExpanded ? undefined : 3}
        >
          {post.selftext.trim()}
        </Text>

        {renderFooter()}
      </Pressable>
    );
  }

  // ── Fallback: title-only card ──────────────────────────────────────────────
  return (
    <Pressable
      onPress={openPostDetail}
      android_ripple={{ color: theme.primaryMuted }}
      style={[styles.card, { backgroundColor: theme.surface }]}
    >
      <Text style={[styles.title, { color: theme.text }]}>
        {post.over_18 ? '[NSFW] ' : ''}{post.title}
      </Text>
      {renderFooter()}
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

  // ── Type A ────────────────────────────────────────────────────────────────
  videoContainer: {
    width: '100%',
    height: 220,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    maxHeight: 400,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.border,
  },

  // ── Type B ────────────────────────────────────────────────────────────────
  linkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  linkTextArea: {
    flex: 1,
  },
  linkDomain: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    marginTop: 2,
    marginBottom: Spacing.xs,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: Colors.border,
    flexShrink: 0,
  },

  // ── Type C ────────────────────────────────────────────────────────────────
  selftext: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    lineHeight: 19,
    marginBottom: Spacing.sm,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
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
  footerBtn: {
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    marginLeft: Spacing.xs,
  },
});
