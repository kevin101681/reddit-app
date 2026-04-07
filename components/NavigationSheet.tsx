import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  Alert,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getFavorites, removeFavorite } from "../utils/storage";
import { Spacing, Typography, Radius } from "../constants/theme";
import { useTheme } from "../utils/ThemeContext";

const BRAND    = "#7ba0b3";

const SORT_OPTIONS = [
  { label: "Hot",           value: "hot" },
  { label: "New",           value: "new" },
  { label: "Top",           value: "top" },
  { label: "Controversial", value: "controversial" },
] as const;

interface NavigationSheetProps {
  sort?: string;
  onSortSelect?: (sort: string) => void;
  viewMode?: "standard" | "compact";
  onViewModeToggle?: () => void;
  /** Controlled open state — when provided the parent drives open/close */
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function NavigationSheet({
  sort,
  onSortSelect,
  viewMode,
  onViewModeToggle,
  isOpen,
  onOpenChange,
}: NavigationSheetProps) {
  const insets  = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 850;
  const { theme, themeName, toggleTheme } = useTheme();

  const [internalOpen, setInternalOpen] = useState(false);
  // Controlled when isOpen prop is provided; otherwise self-managed
  const isMenuOpen = isOpen !== undefined ? isOpen : internalOpen;
  function setIsMenuOpen(val: boolean) {
    setInternalOpen(val);
    onOpenChange?.(val);
  }
  const [menuInput,      setMenuInput]      = useState("");
  const [favorites,      setFavorites]      = useState<string[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // ── Manual keyboard height tracking ────────────────────────────────────────
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showListener = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideListener = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => { showListener.remove(); hideListener.remove(); };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getFavorites().then((favs) => { if (active) setFavorites(favs); });
      return () => { active = false; };
    }, [])
  );

  async function handleDeleteFavorite(subreddit: string) {
    Alert.alert(
      "Remove Favourite",
      "Remove r/" + subreddit + " from your favourites?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove", style: "destructive",
          onPress: async () => {
            await removeFavorite(subreddit);
            setFavorites((prev) => prev.filter((s) => s !== subreddit));
          },
        },
      ]
    );
  }

  function navigateToSubreddit(subreddit: string) {
    const sub = subreddit.trim().replace(/^r\//i, "");
    if (!sub) return;
    setIsMenuOpen(false);
    setMenuInput("");
    setTimeout(() => router.push({ pathname: "/feed", params: { subreddit: sub } }), 50);
  }

  function handleSortChip(value: string) {
    onSortSelect?.(value);
    setIsMenuOpen(false);
  }

  const showSort  = !!sort && !!onSortSelect;

  // ── Dynamic panel style — bottom sheet on mobile, side drawer on desktop ──
  const panelStyle = isDesktop
    ? {
        position:        "absolute" as const,
        top:             0,
        bottom:          0,
        right:           0,
        width:           320,
        zIndex:          100,
        borderLeftWidth: 1,
        borderColor:     theme.border,
        backgroundColor: theme.surface,
      }
    : {
        position:              "absolute" as const,
        bottom:                keyboardHeight > 0 ? keyboardHeight : 0,
        left:                  0,
        right:                 0,
        maxHeight:             "80%" as any,
        zIndex:                100,
        borderTopLeftRadius:   24,
        borderTopRightRadius:  24,
        paddingTop:            12,
        backgroundColor:       theme.surface,
      };

  // ── Menu inner content (shared between mobile sheet and desktop drawer) ────
  function renderMenuContent() {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: isDesktop ? 24 : insets.bottom + 16,
          paddingTop: isDesktop ? 16 : 0,
        }}
      >
        {/* ── Theme & View Mode toggles ─────────────────────────────────── */}
        <View style={styles.controlRow}>
          <Pressable
            style={[styles.controlBtn, { borderColor: theme.border, backgroundColor: theme.background }]}
            onPress={toggleTheme}
            accessibilityRole="button"
            accessibilityLabel={themeName === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <MaterialIcons name={themeName === "dark" ? "light-mode" : "dark-mode"} size={20} color={BRAND} />
            <Text style={[styles.controlLabel, { color: theme.textMuted }]}>
              {themeName === "dark" ? "Light" : "Dark"}
            </Text>
          </Pressable>

          {onViewModeToggle && (
            <Pressable
              style={[styles.controlBtn, { borderColor: theme.border, backgroundColor: theme.background }]}
              onPress={() => { onViewModeToggle(); setIsMenuOpen(false); }}
              accessibilityRole="button"
              accessibilityLabel={viewMode === "standard" ? "Switch to compact view" : "Switch to standard view"}
            >
              <MaterialIcons
                name={viewMode === "standard" ? "view-list" : "view-agenda"}
                size={20} color={BRAND}
              />
              <Text style={[styles.controlLabel, { color: theme.textMuted }]}>
                {viewMode === "standard" ? "Compact" : "Standard"}
              </Text>
            </Pressable>
          )}
        </View>

        {/* ── Sort chips ────────────────────────────────────────────────── */}
        {showSort && (
          <View style={styles.sortChips}>
            {SORT_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.sortChip,
                  { borderColor: theme.border, backgroundColor: theme.background },
                  sort === option.value && styles.sortChipActive,
                ]}
                onPress={() => handleSortChip(option.value)}
                accessibilityRole="button"
                accessibilityLabel={"Sort by " + option.label}
                accessibilityState={{ selected: sort === option.value }}
              >
                <Text style={[
                  styles.sortChipText, { color: theme.textMuted },
                  sort === option.value && styles.sortChipTextActive,
                ]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* ── Subreddit search ──────────────────────────────────────────── */}
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.searchInput, {
              backgroundColor: theme.background,
              color: theme.text,
              borderColor: theme.border,
            }]}
            placeholderTextColor={theme.textMuted}
            value={menuInput}
            onChangeText={setMenuInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => navigateToSubreddit(menuInput)}
          />
          <Pressable
            style={({ pressed }) => [styles.goBtn, pressed && styles.goBtnPressed]}
            onPress={() => navigateToSubreddit(menuInput)}
          >
            <Text style={styles.goBtnText}>Go</Text>
          </Pressable>
        </View>

        {/* ── Favourites ────────────────────────────────────────────────── */}
        {favorites.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStar, { color: theme.textMuted }]}>{"☆"}</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No saved subreddits</Text>
            <Text style={[styles.emptyHint, { color: theme.textMuted }]}>
              Browse any subreddit and tap the {"★"} star in the header to save it here.
            </Text>
          </View>
        ) : (
          <View style={[styles.favList, { backgroundColor: theme.surfaceElevated }]}>
            {favorites.map((fav, index) => (
              <React.Fragment key={fav}>
                <View style={[styles.favRow, { backgroundColor: theme.surfaceElevated }]}>
                  <Pressable
                    style={({ pressed }) => [styles.favMain, pressed && { backgroundColor: theme.border }]}
                    onPress={() => navigateToSubreddit(fav)}
                  >
                    <Text style={[styles.favName, { color: theme.text }]}>{"r/" + fav}</Text>
                    <Text style={[styles.favChevron, { color: theme.textMuted }]}>{">"}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.favDelete, pressed && styles.favDeletePressed]}
                    onPress={() => handleDeleteFavorite(fav)}
                    hitSlop={8}
                    accessibilityLabel={"Remove r/" + fav + " from favourites"}
                    accessibilityRole="button"
                  >
                    <MaterialIcons name="delete-outline" size={24} color="#888" />
                  </Pressable>
                </View>
                {index < favorites.length - 1 && (
                  <View style={[styles.favSeparator, { backgroundColor: theme.border }]} />
                )}
              </React.Fragment>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <>
      {isMenuOpen && (
        <>
          {/* Scrim — closes menu; transparent on desktop so content stays interactive */}
          <Pressable
            style={[styles.menuScrim, isDesktop && { backgroundColor: "transparent" }]}
            onPress={() => setIsMenuOpen(false)}
          />

          <Animated.View style={panelStyle}>
            {/* Drag handle — mobile only */}
            {!isDesktop && (
              <View style={[styles.menuHandle, { backgroundColor: theme.border }]} />
            )}

            {/* Header row — close button */}
            <View style={[styles.menuHeader, isDesktop && styles.menuHeaderDesktop]}>
              {isDesktop && (
                <Text style={[styles.desktopTitle, { color: theme.text }]}>Menu</Text>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.menuClose,
                  { backgroundColor: theme.surfaceElevated },
                  pressed && styles.menuClosePressed,
                ]}
                onPress={() => setIsMenuOpen(false)}
                hitSlop={8}
                accessibilityLabel="Close menu"
                accessibilityRole="button"
              >
                <Text style={[styles.menuCloseText, { color: theme.textMuted }]}>{"✕"}</Text>
              </Pressable>
            </View>

            {renderMenuContent()}
          </Animated.View>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  menuScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 99,
  },
  menuHandle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: "center", marginBottom: Spacing.sm,
  },
  menuHeader: {
    alignItems: "flex-end",
    paddingHorizontal: 20,
    marginBottom: Spacing.xs,
  },
  menuHeaderDesktop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.sm,
  },
  desktopTitle: { fontSize: Typography.lg, fontWeight: "700" },
  menuClose: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
  },
  menuClosePressed: { opacity: 0.6 },
  menuCloseText: { fontSize: Typography.md, lineHeight: 18 },

  controlRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg },
  controlBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: Spacing.xs, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1,
  },
  controlLabel: { fontSize: Typography.sm, fontWeight: "600" },

  sortChips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.lg },
  sortChip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1 },
  sortChipActive: { backgroundColor: BRAND, borderColor: BRAND },
  sortChipText: { fontSize: Typography.sm, fontWeight: "600" },
  sortChipTextActive: { color: "#fff" },

  searchRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm, gap: Spacing.sm },
  searchInput: {
    flex: 1, fontSize: Typography.md, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1,
  },
  goBtn: { backgroundColor: BRAND, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  goBtnPressed: { opacity: 0.8 },
  goBtnText: { color: "#fff", fontWeight: "700", fontSize: Typography.md },

  emptyState: { alignItems: "center", paddingVertical: Spacing.xxl },
  emptyStar:  { fontSize: 40, marginBottom: Spacing.md },
  emptyTitle: { fontSize: Typography.lg, fontWeight: "700", marginBottom: Spacing.sm },
  emptyHint:  { fontSize: Typography.sm, textAlign: "center", lineHeight: 20 },
  favList:    { borderRadius: Radius.lg, overflow: "hidden" },
  favRow:     { flexDirection: "row", alignItems: "center" },
  favMain: {
    flex: 1, flexDirection: "row", alignItems: "center",
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  favName:    { flex: 1, fontSize: Typography.md, fontWeight: "600" },
  favChevron: { fontSize: Typography.xl, fontWeight: "300", marginRight: Spacing.sm },
  favDelete:  { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  favDeletePressed: { opacity: 0.4 },
  favSeparator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.lg },
});