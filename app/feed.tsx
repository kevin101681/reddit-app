import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ViewToken,
  ActivityIndicator,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { getPosts } from "../utils/api";
import { RedditPost } from "../utils/types";
import { PostCard } from "../components/PostCard";
import { FeedSkeleton } from "../components/SkeletonLoader";
import {
  getFavorites,
  addFavorite,
  removeFavorite,
  getSortPreference,
  setSortPreference,
  getViewModePreference,
  setViewModePreference,
} from "../utils/storage";
import { Colors, Spacing, Typography } from "../constants/theme";
import { useTheme } from "../utils/ThemeContext";
import { NavigationSheet } from "../components/NavigationSheet";

const BRAND   = "#7ba0b3";
const FAB_SIZE = 56;

export default function FeedScreen() {
  const { subreddit } = useLocalSearchParams<{ subreddit: string }>();
  const sub = (Array.isArray(subreddit) ? subreddit[0] : subreddit) ?? "popular";
  const { theme, themeName } = useTheme();

  // ── Preferences ─────────────────────────────────────────────────────────────
  const [sort, setSort]         = useState("hot");
  const [viewMode, setViewMode] = useState<"standard" | "compact">("standard");

  useEffect(() => {
    let active = true;
    Promise.all([getSortPreference(sub), getViewModePreference(sub)]).then(([s, v]) => {
      if (!active) return;
      setSort(s);
      setViewMode(v as "standard" | "compact");
    });
    return () => { active = false; };
  }, [sub]);

  const handleSortSelect = useCallback((newSort: string) => {
    setSortPreference(newSort, sub);
    setSort(newSort);
  }, [sub]);

  const handleViewModeToggle = useCallback(() => {
    setViewMode((prev) => {
      const next = prev === "standard" ? "compact" : "standard";
      setViewModePreference(next, sub);
      return next;
    });
  }, [sub]);

  // ── Viewability ───────────────────────────────────────────────────────────────
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      setActivePostId(viewableItems[0]?.item?.id ?? null);
    }
  ).current;

  // ── Feed state ──────────────────────────────────────────────────────────────
  const [posts, setPosts]           = useState<RedditPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [after, setAfter]           = useState<string | undefined>(undefined);
  const [hasMore, setHasMore]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Favourite state ─────────────────────────────────────────────────────────
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getFavorites().then((favs) => {
      if (!cancelled) setIsFavorited(favs.includes(sub.toLowerCase()));
    });
    return () => { cancelled = true; };
  }, [sub]);

  async function toggleFavorite() {
    if (isFavorited) {
      await removeFavorite(sub);
      setIsFavorited(false);
    } else {
      await addFavorite(sub);
      setIsFavorited(true);
    }
  }

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchPosts = useCallback(
    async (reset: boolean, cursor?: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setError(null);
        const data = await getPosts(sub, sort, cursor, controller.signal);
        setPosts((prev) => (reset ? data.posts : [...prev, ...data.posts]));
        const nextCursor =
          data.after ?? (data.posts.length ? data.posts[data.posts.length - 1].name : undefined);
        setAfter(nextCursor ?? undefined);
        setHasMore(!!nextCursor && data.posts.length > 0);
      } catch (err: any) {
        if (err?.name !== "AbortError") setError(err?.message ?? "Failed to load posts");
      }
    },
    [sub, sort]
  );

  useEffect(() => {
    setLoading(true);
    setPosts([]);
    setAfter(undefined);
    setHasMore(true);
    setActivePostId(null);
    fetchPosts(true).finally(() => setLoading(false));
    return () => abortRef.current?.abort();
  }, [fetchPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setAfter(undefined);
    setHasMore(true);
    await fetchPosts(true);
    setRefreshing(false);
  }, [fetchPosts]);

  const onEndReached = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchPosts(false, after);
    setLoadingMore(false);
  }, [loadingMore, hasMore, after, fetchPosts]);

  const renderItem = useCallback(
    ({ item }: { item: RedditPost }) => (
      <PostCard post={item} activePostId={activePostId} viewMode={viewMode} currentTheme={theme} />
    ),
    [activePostId, viewMode, theme]
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Clean header — only the subreddit title and favourite star */}
      <Stack.Screen
        options={{
          title: "r/" + sub,
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: "700", color: theme.text },
          headerRight: () => (
            <Pressable
              onPress={toggleFavorite}
              style={({ pressed }) => [styles.starBtn, pressed && styles.starBtnPressed]}
              hitSlop={8}
              accessibilityLabel={isFavorited ? "Remove from favourites" : "Add to favourites"}
              accessibilityRole="button"
            >
              <Text style={[styles.starIcon, isFavorited && styles.starIconFilled]}>
                {isFavorited ? "\u2605" : "\u2606"}
              </Text>
            </Pressable>
          ),
        }}
      />

      {loading ? (
        <View style={[styles.fillContainer, { backgroundColor: theme.background }]}>
          <FeedSkeleton />
        </View>
      ) : error && posts.length === 0 ? (
        <View style={[styles.center, { backgroundColor: theme.background }]}>
          <Text style={styles.errorIcon}>{"⚠️"}</Text>
          <Text style={[styles.errorTitle, { color: theme.text }]}>{"Could not load r/" + sub}</Text>
          <Text style={[styles.errorMessage, { color: theme.textMuted }]}>{error}</Text>
          <Text style={[styles.retryHint, { color: theme.textMuted }]}>Pull down to retry</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          extraData={themeName}
          style={[styles.fillContainer, { backgroundColor: theme.background }]}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: FAB_SIZE + 80 + Spacing.xl },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={BRAND}
              colors={[BRAND]}
              progressBackgroundColor={theme.surface}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          scrollEventThrottle={16}
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={11}
          ListHeaderComponent={
            error ? (
              <View style={[styles.errorBanner, { backgroundColor: theme.surface }]}>
                <Text style={[styles.errorBannerText, { color: theme.textMuted }]}>{"⚠️ " + error}</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={BRAND} style={styles.loadingMore} />
            ) : null
          }
        />
      )}

      {/* FAB + slide-up menu with sort, view mode, theme, and subreddit nav */}
      <NavigationSheet
        sort={sort}
        onSortSelect={handleSortSelect}
        viewMode={viewMode}
        onViewModeToggle={handleViewModeToggle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:        { flex: 1 },
  fillContainer: { flex: 1 },
  listContent:   { paddingTop: Spacing.sm },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  errorIcon: { fontSize: 40, marginBottom: Spacing.md },
  errorTitle: {
    color: Colors.text,
    fontSize: Typography.lg,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  errorMessage: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  retryHint: { color: Colors.textDisabled, fontSize: Typography.sm },
  errorBanner: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 8,
  },
  errorBannerText: { fontSize: Typography.sm },
  loadingMore: { paddingVertical: Spacing.xl },
  starBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  starBtnPressed: { opacity: 0.5 },
  starIcon: {
    fontSize: 24,
    color: Colors.textMuted,
  },
  starIconFilled: {
    color: BRAND,
  },
});