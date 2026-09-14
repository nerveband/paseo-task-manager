import type { PluginTheme } from "@getpaseo/plugin";
import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

interface ConfirmDialogProps {
  visible: boolean;
  theme: PluginTheme;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  visible,
  theme,
  title,
  message,
  confirmLabel,
  destructive = false,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        },
        box: {
          width: "100%",
          maxWidth: 420,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface0,
          padding: 18,
        },
        title: { fontSize: 15, fontWeight: "700", color: theme.colors.foreground },
        message: { fontSize: 12, color: theme.colors.foregroundMuted, marginTop: 8, lineHeight: 17 },
        footer: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 18 },
        secondaryButton: {
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        secondaryText: { fontSize: 12, color: theme.colors.foregroundMuted, fontWeight: "600" },
        primaryButton: {
          paddingHorizontal: 16,
          paddingVertical: 9,
          borderRadius: 6,
          backgroundColor: destructive ? theme.colors.statusDanger : theme.colors.accent,
        },
        primaryText: { fontSize: 12, fontWeight: "700", color: theme.colors.accentForeground },
      }),
    [theme, destructive],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={styles.secondaryButton}
              onPress={onCancel}
              disabled={busy}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              style={styles.primaryButton}
              onPress={onConfirm}
              disabled={busy}
            >
              <Text style={styles.primaryText}>{busy ? "Working..." : confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
