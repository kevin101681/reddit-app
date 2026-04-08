import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewToken,
  ActivityIndicator,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { getPosts } from "../utils/api";
import { RedditPost } from "../utils/types";
import { PostCard } from "../components/PostCard";
import PostDetail from "../components/PostDetail";
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

const BRAND    = "#7ba0b3";

export default function FeedScreen() {
  const { subreddit } = useLocalSearchParams<{ subreddit: string }>();
  const sub = (Array.isArray(subreddit) ? subreddit[0] : subreddit) ?? "popular";
  const { theme, themeName } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 850;

  // -- Preferences -------------------------------------------------------------
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

  // -- Viewability -------------------------------------------------------------
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const [activePostId, setActivePostId]   = useState<string | null>(null);
  const [selectedPost, setSelectedPost]   = useState<RedditPost | null>(null);
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      setActivePostId(viewableItems[0]?.item?.id ?? null);
    }
  ).current;

  // -- Feed state --------------------------------------------------------------
  const [posts, setPosts]           = useState<RedditPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [after, setAfter]           = useState<string | undefined>(undefined);
  const [hasMore, setHasMore]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // -- Favourite state ---------------------------------------------------------
  const [isFavorited, setIsFavorited] = useState(false);
  const [isMenuOpen, setIsMenuOpen]   = useState(false);
  const [isFabVisible, setIsFabVisible] = useState(true);
  const lastScrollY = useRef(0);

  const handleScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    if (currentY > lastScrollY.current + 15 && isFabVisible) setIsFabVisible(false);
    else if (currentY < lastScrollY.current - 15 && !isFabVisible) setIsFabVisible(true);
    lastScrollY.current = currentY;
  };

  useEffect(() => {
    let cancelled = false;
    getFavorites().then((favs) => { if (!cancelled) setIsFavorited(favs.includes(sub.toLowerCase())); });
    return () => { cancelled = true; };
  }, [sub]);

  async function toggleFavorite() {
    if (isFavorited) { await removeFavorite(sub); setIsFavorited(false); }
    else             { await addFavorite(sub);    setIsFavorited(true); }
  }

  // -- Data fetching -----------------------------------------------------------
  const fetchPosts = useCallback(
    async (reset: boolean, cursor?: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        setError(null);
        const data = await getPosts(sub, sort, cursor, controller.signal);
        setPosts((prev) => (reset ? data.posts : [...prev, ...data.posts]));
        const nextCursor = data.after ?? (data.posts.length ? data.posts[data.posts.length - 1].name : undefined);
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
    setSelectedPost(null);
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
      <PostCard
        post={item}
        activePostId={activePostId}
        viewMode={viewMode}
        currentTheme={theme}
        onPress={isDesktop ? () => setSelectedPost(item) : undefined}
      />
    ),
    [activePostId, viewMode, theme, isDesktop]
  );

  // -- Feed column -------------------------------------------------------------
  const renderFeed = () => {
    if (loading) {
      return (
        <View style={[styles.fillContainer, { backgroundColor: theme.background }]}>
          <FeedSkeleton />
        </View>
      );
    }
    if (error && posts.length === 0) {
      return (
        <View style={[styles.center, { backgroundColor: theme.background }]}>
          <Text style={styles.errorIcon}>{"??"}</Text>
          <Text style={[styles.errorTitle, { color: theme.text }]}>{"Could not load r/" + sub}</Text>
          <Text style={[styles.errorMessage, { color: theme.textMuted }]}>{error}</Text>
          <Text style={[styles.retryHint, { color: theme.textMuted }]}>Pull down to retry</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        extraData={themeName}
        style={[styles.fillContainer, { backgroundColor: theme.background }]}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Spacing.xl * 3 },
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
        onScroll={handleScroll}
        removeClippedSubviews
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={11}
        ListHeaderComponent={
          error ? (
            <View style={[styles.errorBanner, { backgroundColor: theme.surface }]}>
              <Text style={[styles.errorBannerText, { color: theme.textMuted }]}>{"?? " + error}</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={BRAND} style={styles.loadingMore} /> : null
        }
      />
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: "r/" + sub,
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: "700", color: theme.text },
          headerBackVisible: false,
          headerLeft: () => null,
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
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
              {isDesktop && (
                <Pressable
                  onPress={() => setIsMenuOpen(true)}
                  style={{ marginRight: 16, padding: 8 }}
                  accessibilityLabel="Open menu"
                  accessibilityRole="button"
                >
                  <MaterialIcons name="menu" size={28} color={theme.text} />
                </Pressable>
              )}
            </View>
          ),
        }}
      />

      {/* Split-screen row on desktop; single column on mobile */}
      <View style={[styles.fillContainer, isDesktop && styles.row]}>

        {/* Left: feed column */}
        <View style={[
          styles.fillContainer,
          isDesktop && { maxWidth: 450 },
        ]}>
          {renderFeed()}
        </View>

        {/* Right: post detail pane � desktop only */}
        {isDesktop && (
          <View style={[styles.fillContainer, { backgroundColor: theme.background }]}>
            {selectedPost ? (
              <PostDetail
                postId={selectedPost.id}
                subreddit={selectedPost.subreddit}
                subredditNamePrefixed={selectedPost.subreddit_name_prefixed}
                url={selectedPost.url}
                embedded
              />
            ) : (
              <View style={styles.emptyPane}>
                <Text style={[styles.emptyPaneText, { color: theme.textMuted }]}>
                  Select a post to read comments
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {isFabVisible && !isDesktop && (
        <Pressable
          onPress={() => setIsMenuOpen(true)}
          style={{ position: "absolute", bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: themeName === "dark" ? "#fff" : "#333", justifyContent: "center", alignItems: "center", elevation: 4 }}
          accessibilityLabel="Open menu"
          accessibilityRole="button"
        >
          <MaterialIcons name="menu" size={24} color={themeName === "dark" ? "#000" : "#fff"} />
        </Pressable>
      )}

      <NavigationSheet
        sort={sort}
        onSortSelect={handleSortSelect}
        viewMode={viewMode}
        onViewModeToggle={handleViewModeToggle}
        isOpen={isMenuOpen}
        onOpenChange={setIsMenuOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:        { flex: 1 },
  fillContainer: { flex: 1 },
  row:           { flexDirection: "row" },
  listContent:   { paddingTop: Spacing.sm },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  errorIcon:    { fontSize: 40, marginBottom: Spacing.md },
  errorTitle:   { color: Colors.text, fontSize: Typography.lg, fontWeight: "700", marginBottom: Spacing.sm },
  errorMessage: { color: Colors.textMuted, fontSize: Typography.sm, textAlign: "center", marginBottom: Spacing.md },
  retryHint:    { color: Colors.textDisabled, fontSize: Typography.sm },
  errorBanner: { marginHorizontal: Spacing.md, marginBottom: Spacing.sm, padding: Spacing.md, borderRadius: 8 },
  errorBannerText: { fontSize: Typography.sm },
  loadingMore:  { paddingVertical: Spacing.xl },
  emptyPane:    { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  emptyPaneText: { fontSize: Typography.md },
  starBtn:        { paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  starBtnPressed: { opacity: 0.5 },
  starIcon:       { fontSize: 24, color: Colors.textMuted },
  starIconFilled: { color: BRAND },
});