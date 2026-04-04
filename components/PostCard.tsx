import React from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { RedditPost } from '../utils/types';
import { formatRelativeTime, formatScore } from '../utils/api';
import { Colors, Spacing, Typography, Radius } from '../constants/theme';

interface PostCardProps {
  post: RedditPost;
}

export function PostCard({ post }: PostCardProps) {
  // Prefer a mid-res preview; fall back to source; null if none available
  const imageUrl =
    post.preview?.images?.[0]?.resolutions?.[2]?.url?.replace(/&amp;/g, '&') ??
    post.preview?.images?.[0]?.resolutions?.[1]?.url?.replace(/&amp;/g, '&') ??
    post.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') ??
    null;

  const showImage =
    !!imageUrl &&
    post.thumbnail !== 'self' &&
    post.thumbnail !== 'default' &&
    post.thumbnail !== 'nsfw';

  function handlePress() {
    // Forward the full post payload as string params so [id].tsx can
    // render the post header instantly, before the comments fetch resolves.
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
      },
    });
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      android_ripple={{ color: Colors.primaryMuted }}
    >
      {/* Subreddit + meta */}
      <View style={styles.metaRow}>
        <Text style={styles.subreddit} numberOfLines={1}>
          {post.subreddit_name_prefixed}
        </Text>
        <Text style={styles.dot}> · </Text>
        <Text style={styles.meta}>{formatRelativeTime(post.created_utc)}</Text>
        <Text style={styles.dot}> · </Text>
        <Text style={styles.meta} numberOfLines={1}>u/{post.author}</Text>
      </View>

      {/* Flair */}
      {post.flair_text ? (
        <View style={styles.flairBadge}>
          <Text style={styles.flairText} numberOfLines={1}>{post.flair_text}</Text>
        </View>
      ) : null}

      {/* Title */}
      <Text style={styles.title} numberOfLines={4}>
        {post.over_18 ? '?? ' : ''}{post.title}
      </Text>

      {/* Preview image */}
      {showImage ? (
        <Image
          source={{ uri: imageUrl! }}
          style={styles.previewImage}
          resizeMode="cover"
        />
      ) : null}

      {/* Read-only stats */}
      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statChipText}>{formatScore(post.score)} pts</Text>
        </View>
        <View style={[styles.statChip, styles.statChipSecondary]}>
          <Text style={styles.statChipSecondaryText}>
            {formatScore(post.num_comments)} comments
          </Text>
        </View>
        {post.is_video ? (
          <View style={[styles.statChip, styles.tagChip]}>
            <Text style={styles.tagText}>VIDEO</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  cardPressed: { opacity: 0.85, backgroundColor: Colors.surfaceElevated },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: Spacing.xs,
  },
  subreddit: { color: Colors.primary, fontSize: Typography.xs, fontWeight: '700' },
  dot: { color: Colors.textDisabled, fontSize: Typography.xs },
  meta: { color: Colors.textMuted, fontSize: Typography.xs, flexShrink: 1 },
  flairBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginBottom: Spacing.xs,
  },
  flairText: { color: Colors.primary, fontSize: Typography.xs, fontWeight: '600' },
  title: {
    color: Colors.text,
    fontSize: Typography.md,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.border,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  statChip: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  statChipText: { color: Colors.primary, fontSize: Typography.xs, fontWeight: '700' },
  statChipSecondary: { backgroundColor: Colors.surfaceElevated },
  statChipSecondaryText: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: '600' },
  tagChip: { backgroundColor: Colors.border, marginLeft: 'auto' },
  tagText: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: '700', letterSpacing: 0.5 },
});
