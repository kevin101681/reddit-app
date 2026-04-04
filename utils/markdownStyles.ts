/**
 * Shared dark-theme style factory for react-native-markdown-display.
 *
 * Call buildMarkdownStyles() for post body text.
 * Pass a smaller fontSize for comment bodies to handle tight nesting.
 *
 * Inline images are intentionally omitted here — callers should pass the
 * `imageRules` export as the `rules` prop to suppress them entirely and
 * prevent pixel-tracker requests from embedded Reddit markdown.
 */
import { Platform } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';

const MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export interface MarkdownStyleOptions {
  fontSize?: number;
  lineHeight?: number;
}

export function buildMarkdownStyles({
  fontSize = Typography.sm,
  lineHeight = 20,
}: MarkdownStyleOptions = {}) {
  return {
    // Root view wrapping all rendered output
    body: {
      color: Colors.text,
      backgroundColor: 'transparent',
    },

    // Block-level elements
    paragraph: {
      color: Colors.text,
      fontSize,
      lineHeight,
      marginTop: 0,
      marginBottom: Spacing.xs,
      flexShrink: 1,
    },
    heading1: { color: Colors.text, fontSize: Typography.xxl, fontWeight: '700' as const, marginBottom: Spacing.sm, marginTop: Spacing.sm },
    heading2: { color: Colors.text, fontSize: Typography.xl,  fontWeight: '700' as const, marginBottom: Spacing.sm, marginTop: Spacing.sm },
    heading3: { color: Colors.text, fontSize: Typography.lg,  fontWeight: '700' as const, marginBottom: Spacing.xs, marginTop: Spacing.xs },
    heading4: { color: Colors.text, fontSize: Typography.md,  fontWeight: '700' as const },
    heading5: { color: Colors.text, fontSize,                 fontWeight: '700' as const },
    heading6: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: '700' as const },

    // Horizontal rule
    hr: { backgroundColor: Colors.border, height: 1, marginVertical: Spacing.sm },

    // Blockquote
    blockquote: {
      backgroundColor: Colors.surfaceElevated,
      borderLeftColor: Colors.border,
      borderLeftWidth: 3,
      paddingLeft: Spacing.sm,
      paddingVertical: Spacing.xs,
      marginVertical: Spacing.xs,
      borderRadius: Radius.sm,
    },

    // Inline code
    code_inline: {
      backgroundColor: Colors.surfaceElevated,
      color: '#46d160',
      fontFamily: MONO,
      fontSize: fontSize - 1,
      borderRadius: Radius.sm,
      paddingHorizontal: 4,
    },

    // Fenced / block code
    fence: {
      backgroundColor: Colors.surfaceElevated,
      color: '#46d160',
      fontFamily: MONO,
      fontSize: fontSize - 1,
      borderRadius: Radius.md,
      padding: Spacing.md,
      marginVertical: Spacing.sm,
    },
    code_block: {
      backgroundColor: Colors.surfaceElevated,
      color: '#46d160',
      fontFamily: MONO,
      fontSize: fontSize - 1,
      borderRadius: Radius.md,
      padding: Spacing.md,
      marginVertical: Spacing.sm,
    },

    // Lists
    bullet_list:  { color: Colors.text, marginBottom: Spacing.xs },
    ordered_list: { color: Colors.text, marginBottom: Spacing.xs },
    list_item:    { color: Colors.text, fontSize, flexDirection: 'row' as const },
    bullet_list_icon:  { color: Colors.primary, fontSize, marginRight: Spacing.xs },
    ordered_list_icon: { color: Colors.primary, fontSize, marginRight: Spacing.xs },
    list_item_content: { flex: 1, flexShrink: 1 },

    // Inline styles
    link:   { color: Colors.primary },
    strong: { color: Colors.text, fontWeight: '700' as const },
    em:     { color: Colors.text, fontStyle: 'italic' as const },
    s:      { color: Colors.textMuted, textDecorationLine: 'line-through' as const },

    // Tables (basic support)
    table:       { borderWidth: 1, borderColor: Colors.border, marginVertical: Spacing.sm },
    thead:       { backgroundColor: Colors.surfaceElevated },
    th:          { color: Colors.text, fontWeight: '700' as const, padding: Spacing.xs, fontSize },
    td:          { color: Colors.text, padding: Spacing.xs, fontSize, borderTopWidth: 1, borderTopColor: Colors.border },
    tr:          { flexDirection: 'row' as const },
  };
}

/**
 * Pass this as the `rules` prop to suppress inline images.
 * This prevents pixel-tracker URLs embedded in markdown from firing.
 */
export const suppressImageRule = {
  image: () => null as any,
};
