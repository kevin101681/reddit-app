import React, { memo, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, LayoutAnimation } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { RedditComment } from '../utils/types';
import { buildMarkdownStyles, suppressImageRule } from '../utils/markdownStyles';
import { Colors, Spacing, Typography } from '../constants/theme';

const BRAND = '#7ba0b3';

// Cold-theme depth palette — cycles seamlessly via modulo for deeper nesting.
const DEPTH_COLORS = [
  '#7ba0b3', // 0 — brand / lightest
  '#5a879d', // 1
  '#457287', // 2
  '#345e72', // 3
  '#264a5c', // 4
  '#1b3847', // 5 — deepest oceanic
];

function depthColor(depth: number): string {
  return DEPTH_COLORS[depth % DEPTH_COLORS.length];
}

/** All tapped links open externally in the device browser. */
function openLink(url: string): boolean {
  Linking.openURL(url).catch(() => {});
  return true;
}

/**
 * Memoised markdown styles per nesting depth.
 * Font size shrinks slightly at deeper levels so text stays readable
 * inside narrow indented columns.
 */
function useCommentMdStyles(depth: number) {
  return useMemo(() => {
    const fontSize   = Math.max(Typography.xs, Typography.sm - Math.floor(depth / 3));
    const lineHeight = fontSize + 7;
    return buildMarkdownStyles({ fontSize, lineHeight });
  }, [depth]);
}

interface CommentThreadProps {
  comment: RedditComment;
  depth?: number;
}

export const CommentThread = memo(function CommentThread({
  comment,
  depth = 0,
}: CommentThreadProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const mdStyles = useCommentMdStyles(depth);

  // Skip deleted / removed bodies entirely
  if (
    !comment.body ||
    comment.body === '[deleted]' ||
    comment.body === '[removed]'
  ) {
    return null;
  }

  const color      = depthColor(depth);
  const replyCount = comment.replies?.length ?? 0;

  // Each nesting level adds a coloured left border + a single paddingLeft step.
  // No marginLeft stacking — cumulative indent stays proportional and never
  // pushes deeply-nested text off-screen.
  const nestedStyle = depth > 0
    ? { borderLeftWidth: 3, borderLeftColor: color, paddingLeft: Spacing.sm }
    : undefined;

  return (
    <View style={[styles.container, nestedStyle]}>

      {isCollapsed ? (
        // ── Collapsed: tap the placeholder to expand ──────────────────────────
        <Pressable
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setIsCollapsed(false);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Expand comment"
        >
          <Text style={styles.collapsedPlaceholder}>[+]</Text>
        </Pressable>
      ) : (
        // ── Expanded: tap the card to collapse ───────────────────────────────
        <>
          <Pressable
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setIsCollapsed(true);
            }}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Collapse comment"
          >
            {/*
              Material 3 card wraps the text content; the depth border
              stays on the outer container so cards visually step inward.
            */}
            <View style={styles.card}>
              <View style={styles.bodyWrap}>
                <Markdown
                  style={mdStyles}
                  onLinkPress={openLink}
                  rules={suppressImageRule}
                >
                  {comment.body}
                </Markdown>
              </View>
            </View>
          </Pressable>

          {replyCount > 0 && (
            <View style={styles.replies}>
              {comment.replies!.map((reply) => (
                <CommentThread
                  key={reply.id}
                  comment={reply}
                  depth={depth + 1}
                />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  // Tiny tappable target shown when the thread is collapsed
  collapsedPlaceholder: {
    color: BRAND,
    fontSize: Typography.xs,
    fontWeight: '700',
    paddingVertical: 8,
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  bodyWrap: {
    flex: 1,
    flexShrink: 1,
  },
  replies: {
    marginTop: Spacing.xs,
  },
});