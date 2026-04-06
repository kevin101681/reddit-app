import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getComments } from "../utils/api";
import { RedditComment } from "../utils/types";
import { CommentThread } from "./CommentThread";
import { SkeletonBox } from "./SkeletonLoader";
import { Colors, Spacing, Typography, Radius } from "../constants/theme";
import { NavigationSheet } from "./NavigationSheet";

const BRAND    = "#7ba0b3";
const FAB_SIZE = 56;

// ── Props ─────────────────────────────────────────────────────────────────────

interface PostDetailProps {
  postId: string;
  /** Optional — omitting uses Reddit global /comments/{postId} endpoint */
  subreddit?: string;
  /** Display title for the nav header */
  subredditNamePrefixed?: string;
  /** When present and non-Reddit, renders an open-in-browser FAB */
  url?: string;
  /** Set true when rendered inside a split-screen pane; hides Stack.Screen
      header and the NavigationSheet FAB to prevent duplicates. */
  embedded?: boolean;
}

// ── Comment skeleton ───────────────────────────────────────────────────────────

function CommentSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={[styles.skeletonBlock, { marginLeft: (i % 3) * Spacing.lg }]}>
          <SkeletonBox width={120 + (i % 2) * 40} height={11} />
          <SkeletonBox width="90%" height={14} style={{ marginTop: Spacing.xs }} />
          <SkeletonBox width="65%" height={14} style={{ marginTop: 4 }} />
        </View>
      ))}
    </View>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PostDetail({
  postId,
  subreddit,
  subredditNamePrefixed,
  url,
  embedded = false,
}: PostDetailProps) {
  const insets = useSafeAreaInsets();

  const isExternalLink = !!url && url.length > 0 && !/reddit\.com/i.test(url);

  // ── Comments state ─────────────────────────────────────────────────────────
  const [comments, setComments]               = useState<RedditComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError]     = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!postId) return;

    // Reset state when the selected post changes (desktop split-screen)
    setComments([]);
    setCommentsLoading(true);
    setCommentsError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    getComments(subreddit, postId, controller.signal)
      .then((data) => setComments(data.comments))
      .catch((err) => {
        if (err?.name !== "AbortError") {
          setCommentsError(err?.message ?? "Failed to load comments");
        }
      })
      .finally(() => setCommentsLoading(false));

    return () => abortRef.current?.abort();
  }, [postId, subreddit]);

  const topLevelComments = comments.filter((c) => c.depth === 0 || c.depth === undefined);

  // ── FAB hide-on-scroll animation ──────────────────────────────────────────
  const fabTranslateY = useRef(new Animated.Value(0)).current;
  const isFabHidden   = useRef(false);
  const lastScrollY   = useRef(0);

  function handleScroll(e: { nativeEvent: { contentOffset: { y: number } } }) {
    const y  = e.nativeEvent.contentOffset.y;
    const dy = y - lastScrollY.current;
    lastScrollY.current = y;
    if (Math.abs(dy) < 4) return;

    if (dy > 0 && !isFabHidden.current) {
      isFabHidden.current = true;
      Animated.spring(fabTranslateY, {
        toValue: FAB_SIZE + 32 + insets.bottom,
        useNativeDriver: Platform.OS !== "web", damping: 20, stiffness: 200,
      }).start();
    } else if (dy < 0 && isFabHidden.current) {
      isFabHidden.current = false;
      Animated.spring(fabTranslateY, {
        toValue: 0,
        useNativeDriver: Platform.OS !== "web", damping: 20, stiffness: 200,
      }).start();
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  function renderComment({ item }: { item: RedditComment }) {
    return (
      <View style={styles.commentWrap}>
        <CommentThread comment={item} depth={0} />
        <View style={styles.commentDivider} />
      </View>
    );
  }

  const fabPaddingBottom = insets.bottom > 0 ? insets.bottom : Spacing.lg;

  function renderListFooter() {
    if (commentsError) {
      return (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{"⚠️ " + commentsError}</Text>
        </View>
      );
    }
    if (topLevelComments.length === 0 && !commentsLoading) {
      return (
        <View style={styles.noComments}>
          <Text style={styles.noCommentsText}>No comments yet.</Text>
        </View>
      );
    }
    if (commentsLoading && topLevelComments.length > 0) {
      return <ActivityIndicator color={BRAND} style={styles.loadingMore} />;
    }
    return <View style={{ height: isExternalLink ? FAB_SIZE + fabPaddingBottom + 24 : Spacing.xxl }} />;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      {/* Stack.Screen header — omit when embedded in a split pane */}
      {!embedded && (
        <Stack.Screen options={{ title: subredditNamePrefixed ?? (subreddit ? ("r/" + subreddit) : "Comments") }} />
      )}

      {commentsLoading && topLevelComments.length === 0 ? (
        <CommentSkeleton />
      ) : (
        <FlatList
          style={styles.list}
          data={topLevelComments}
          keyExtractor={(item, index) => (item?.id ? String(item.id) : String(index))}
          renderItem={renderComment}
          ListFooterComponent={renderListFooter}
          onScroll={isExternalLink ? handleScroll : undefined}
          scrollEventThrottle={16}
          removeClippedSubviews={false}
          initialNumToRender={10}
          maxToRenderPerBatch={15}
          windowSize={10}
        />
      )}

      {/* External-link FAB */}
      {isExternalLink && (
        <Animated.View
          style={[
            styles.fab,
            { bottom: fabPaddingBottom + Spacing.lg, transform: [{ translateY: fabTranslateY }] },
          ]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() => Linking.openURL(url!).catch(() => {})}
            style={({ pressed }) => [styles.fabBtn, pressed && styles.fabBtnPressed]}
            accessibilityLabel="Open link in browser"
            accessibilityRole="button"
          >
            <MaterialIcons name="open-in-browser" size={26} color="#fff" />
          </Pressable>
        </Animated.View>
      )}

      {/* NavigationSheet FAB — omit when embedded (parent screen already has one) */}
      {!embedded && <NavigationSheet />}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.background },
  list:    { flex: 1, backgroundColor: Colors.background },
  commentWrap: { paddingHorizontal: Spacing.lg },
  commentDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  skeletonWrap:  { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  skeletonBlock: { marginBottom: Spacing.lg },
  errorBox: {
    margin: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  errorText:       { color: Colors.textMuted, fontSize: Typography.sm },
  noComments:      { alignItems: "center", padding: Spacing.xxl },
  noCommentsText:  { color: Colors.textMuted, fontSize: Typography.sm },
  loadingMore:     { paddingVertical: Spacing.xl },
  fab: {
    position: "absolute",
    right: Spacing.lg,
  },
  fabBtn: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: BRAND,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
  },
  fabBtnPressed: { opacity: 0.85 },
});