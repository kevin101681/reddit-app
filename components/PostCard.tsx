import React, { memo, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  Linking,
  StyleSheet,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { router } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { RedditPost } from "../utils/types";
import { Colors, Spacing, Typography, Radius } from "../constants/theme";
import { AppTheme, useTheme } from "../utils/ThemeContext";

const BRAND = "#7ba0b3";
const getTimeAgo = (timestamp: number): string => {
  if (!timestamp) return '';
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + 'y ago';
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + 'mo ago';
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + 'd ago';
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + 'h ago';
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + 'm ago';
  return 'just now';
};

const SENTINEL_THUMBNAILS = new Set(["self", "default", "nsfw", "spoiler", "image", ""]);

type ViewMode = "standard" | "compact";

interface PostCardProps {
  post: RedditPost;
  activePostId?: string | null;
  viewMode?: ViewMode;
  currentTheme?: AppTheme;
  /** Override navigation — used by split-screen to select a post without pushing a route */
  onPress?: () => void;
}

function PostCardInner({ post, activePostId, viewMode = "standard", currentTheme, onPress }: PostCardProps) {
  const { theme: hookTheme } = useTheme();
  const theme = currentTheme ?? hookTheme;

  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // HLS carries audio; prefer it over the silent fallback_url dash stream
  const nativeVideoUrl =
    post.secure_media?.reddit_video?.hls_url ??
    post.secure_media?.reddit_video?.fallback_url ??
    post.preview?.reddit_video_preview?.hls_url ??
    post.preview?.reddit_video_preview?.fallback_url ??
    null;

  const rawUrl = post.url ?? "";
  const isGif  = !post.is_video && /\.(gif|gifv)(\?.*)?$/i.test(rawUrl);
  const gifUrl = isGif ? rawUrl.replace(/\.gifv$/i, ".mp4") : null;

  const videoUrl  = nativeVideoUrl ?? gifUrl;
  const showVideo = !!videoUrl;

  // expo-video: hook must be called unconditionally; null source = idle player
  const player = useVideoPlayer(videoUrl ?? null, (p) => {
    p.loop   = true;
    p.muted  = true;
  });

  useEffect(() => {
    if (!videoUrl) return;
    if (activePostId === post.id) {
      player.play();
    } else {
      player.pause();
    }
  }, [activePostId, post.id, player, videoUrl]);

  const previewImageUrl =
    post.preview?.images?.[0]?.resolutions?.[2]?.url?.replace(/&amp;/g, "&") ??
    post.preview?.images?.[0]?.resolutions?.[1]?.url?.replace(/&amp;/g, "&") ??
    post.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, "&") ??
    null;

  const sourceImg = post.preview?.images?.[0]?.source;
  const imageAspectRatio =
    sourceImg?.width && sourceImg?.height
      ? sourceImg.width / sourceImg.height
      : 16 / 9;

  const isTypeA = showVideo || (!!previewImageUrl && !SENTINEL_THUMBNAILS.has(post.thumbnail));

  const hasThumbnail =
    !!post.thumbnail &&
    !SENTINEL_THUMBNAILS.has(post.thumbnail) &&
    post.thumbnail.startsWith("http");
  const isTypeB = !isTypeA && hasThumbnail;

  const isTypeC =
    !isTypeA &&
    !isTypeB &&
    post.is_self &&
    !!post.selftext &&
    post.selftext.trim().length > 0;

  const compactThumb = hasThumbnail
    ? post.thumbnail
    : (previewImageUrl ?? null);

  function openPostDetail() {
    if (onPress) { onPress(); return; }
    router.push({
      pathname: "/post/[id]",
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
        selftext: post.selftext ?? "",
        created_utc: String(post.created_utc),
        image_url: previewImageUrl ?? "",
        flair_text: post.flair_text ?? "",
        over_18: post.over_18 ? "1" : "0",
        is_video: post.is_video ? "1" : "0",
        url: post.url ?? "",
      },
    });
  }

  function openExternalLink() {
    if (post.url) Linking.openURL(post.url).catch(() => {});
  }

  function renderFooter() {
    return (
      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.subreddit, { color: theme.brand }]} numberOfLines={1}>
            {post.subreddit_name_prefixed}
          </Text>
          <Text style={[styles.postMeta, { color: theme.textMuted }]} numberOfLines={1}>
            {"u/" + post.author + " \u00b7 " + getTimeAgo(post.created_utc)}
          </Text>
        </View>

        {isTypeC && (
          <Pressable
            onPress={() => setIsTextExpanded((prev) => !prev)}
            hitSlop={10}
            style={styles.footerBtn}
            accessibilityLabel={isTextExpanded ? "Collapse text" : "Expand text"}
            accessibilityRole="button"
          >
            <MaterialIcons
              name={isTextExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
              size={20}
              color={BRAND}
            />
          </Pressable>
        )}

        <Pressable
          onPress={openPostDetail}
          hitSlop={10}
          style={styles.footerBtn}
          accessibilityLabel={"Open comments (" + post.num_comments + ")"}
          accessibilityRole="button"
        >
          <MaterialIcons name="chat-bubble-outline" size={20} color={BRAND} />
        </Pressable>
      </View>
    );
  }

  const cardStyle = [styles.card, { backgroundColor: theme.surface }];
  const titleEl = (
    <Text style={[styles.title, { color: theme.text }]} numberOfLines={viewMode === "compact" ? 3 : undefined}>
      {post.over_18 ? "[NSFW] " : ""}{post.title}
    </Text>
  );

  if (viewMode === "compact") {
    return (
      <View style={cardStyle}>
        <View style={styles.linkRow}>
          <View style={styles.linkTextArea}>{titleEl}</View>
          {compactThumb ? (
            <Image source={{ uri: compactThumb }} style={styles.thumbnail} resizeMode="cover" />
          ) : (
            <View style={[styles.thumbnail, { backgroundColor: theme.surfaceElevated }]} />
          )}
        </View>
        {renderFooter()}
      </View>
    );
  }

  if (isTypeA) {
    return (
      <View style={cardStyle}>
        {titleEl}
        {showVideo ? (
          <View style={styles.videoContainer}>
            <VideoView
              player={player}
              style={styles.video}
              contentFit="contain"
              nativeControls={false}
            />
            <Pressable
              style={styles.muteBtn}
              onPress={() => { player.muted = !isMuted; setIsMuted((prev) => !prev); }}
              accessibilityLabel={isMuted ? "Unmute video" : "Mute video"}
              accessibilityRole="button"
            >
              <MaterialIcons
                name={isMuted ? "volume-off" : "volume-up"}
                size={22}
                color="#fff"
              />
            </Pressable>
          </View>
        ) : (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: previewImageUrl! }}
              style={[styles.image, { aspectRatio: imageAspectRatio }]}
              resizeMode="contain"
            />
          </View>
        )}
        {renderFooter()}
      </View>
    );
  }

  if (isTypeB) {
    return (
      <View style={cardStyle}>
        <View style={styles.linkRow}>
          <Pressable style={styles.linkTextArea} onPress={openExternalLink}>
            {titleEl}
            <Text style={[styles.linkDomain, { color: theme.textMuted }]} numberOfLines={1}>
              {(() => { try { return new URL(post.url).hostname.replace(/^www\./, ""); } catch { return post.url; } })()}
            </Text>
          </Pressable>
          <Image source={{ uri: post.thumbnail }} style={styles.thumbnail} resizeMode="cover" />
        </View>
        {renderFooter()}
      </View>
    );
  }

  if (isTypeC) {
    return (
      <View style={cardStyle}>
        {titleEl}
        <Text style={[styles.selftext, { color: theme.textMuted }]} numberOfLines={isTextExpanded ? undefined : 3}>
          {post.selftext.trim()}
        </Text>
        {renderFooter()}
      </View>
    );
  }

  return (
    <View style={cardStyle}>
      {titleEl}
      {renderFooter()}
    </View>
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
    fontWeight: "600",
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  videoContainer: {
    width: "100%",
    height: 220,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  muteBtn: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 20,
    padding: 6,
  },
  imageContainer: {
    width: "100%",
    alignSelf: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  image: {
    width: "100%",
    alignSelf: "center",
    maxHeight: 400,
    borderRadius: Radius.md,
    backgroundColor: Colors.border,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  selftext: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    lineHeight: 19,
    marginBottom: Spacing.sm,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  subreddit: {
    color: Colors.brand,
    fontSize: Typography.xs,
    fontWeight: "700",
  },
  postMeta: { fontSize: 11, marginTop: 1 },
  footerBtn: {
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    marginLeft: Spacing.xs,
  },
});