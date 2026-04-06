import React, { memo, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { RedditComment } from '../utils/types';
import { buildMarkdownStyles, suppressImageRule } from '../utils/markdownStyles';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';

const BRAND = '#7ba0b3';

// Cold-tone depth palette — cycles via modulo for deeper nesting
const DEPTH_COLORS = [
  '#7ba0b3', // 0
  '#5a879d', // 1
  '#457287', // 2
  '#345e72', // 3
  '#264a5c', // 4
  '#1b3847', // 5+
];

function depthColor(depth: number): string {
  return DEPTH_COLORS[depth % DEPTH_COLORS.length];
}

function openLink(url: string): boolean {
  Linking.openURL(url).catch(() => {});
  return true;
}

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
  const { theme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const mdStyles = useCommentMdStyles(depth);

  if (!comment.body || comment.body === '[deleted]' || comment.body === '[removed]') {
    return null;
  }

  const color      = depthColor(depth);
  const replyCount = comment.replies?.length ?? 0;

  // Left border encodes nesting depth; no margin stacking keeps deep nesting readable
  const nestedStyle = depth > 0
    ? { borderLeftWidth: 3, borderLeftColor: color, paddingLeft: Spacing.sm }
    : undefined;

  return (
    <View style={[styles.container, nestedStyle]}>

      {/* Card surface — background from theme */}
      <View style={[styles.card, { backgroundColor: theme.surface }]}>

        {/* Toggle header — the ONLY tappable surface */}
        <Pressable
          onPress={() => setIsCollapsed((c) => !c)}
          accessibilityRole="button"
          accessibilityLabel={isCollapsed ? 'Expand comment' : 'Collapse comment'}
          hitSlop={4}
        >
          <Text style={[styles.header, { color: isCollapsed ? theme.textMuted : theme.brand }]}>
            {isCollapsed ? '[+]' : '[-]'} {comment.author}
          </Text>
        </Pressable>

        {/* Comment body — Markdown text color driven by theme */}
        {!isCollapsed && (
          <Markdown
            style={mdStyles}
            onLinkPress={openLink}
            rules={suppressImageRule}
          >
            {comment.body}
          </Markdown>
        )}

      </View>

      {/* Recursive replies */}
      {!isCollapsed && replyCount > 0 && (
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

    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.sm,
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  header: {
    color: BRAND,
    fontWeight: 'bold',
    marginBottom: 4,
    paddingVertical: 4,
  },
  replies: {
    marginTop: Spacing.xs,
  },
});