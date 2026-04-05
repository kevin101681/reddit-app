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
  // Prefer a mid-res preview image; fall back down the resolution chain
  const imageUrl =
    post.preview?.images?.[0]?.resolutions?.[2]?.url?.replace(/&amp;/g, '&') ??
    post.preview?.images?.[0]?.resolutions?.[1]?.url?.replace(/&amp;/g, '&') ??
    post.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') ??
    null;

  // Detect GIF/GIFV posts by URL extension
  const rawUrl = post.url ?? '';
  const isGif =
    !post.is_video &&
    (/\.(gif|gifv)(\?.*)?$/i.test(rawUrl));

  // Imgur's .gifv container → serve the .mp4 equivalent directly
  const videoUrl = isGif ? rawUrl.replace(/\.gifv$/i, '.mp4') : null;

  const showVideo = !!videoUrl;
  const showImage =
    !showVideo &&
    !!imageUrl &&
    post.thumbnail !== 'self' &&
    post.thumbnail !== 'default' &&
    post.thumbnail !== 'nsfw';

  // Selftext preview for link-free text posts with no media
  const showSelftext =
    !showVideo &&
    !showImage &&
    !!post.selftext &&
    post.selftext.trim().length > 0;

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
      },
    });
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      android_ripple={{ color: Colors.primaryMuted }}
    >
      {/* Title */}
      <Text style={styles.title}>
        {post.over_18 ? '[NSFW] ' : ''}{post.title}
      </Text>

      {/* Main content: video > image > selftext excerpt */}
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
          style={({ pressed }) => [styles.commentBtn, pressed && styles.commentBtnPressed]}
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
  cardPressed: {
    opacity: 0.85,
    backgroundColor: Colors.surfaceElevated,
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
  commentBtnPressed: {
    opacity: 0.5,
  },
});