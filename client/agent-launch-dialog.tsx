import type { PluginTheme } from "@getpaseo/plugin";
import { usePaseo } from "@getpaseo/plugin/client";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Task } from "../shared/board-model";
import {
  listProviderOptions,
  listWorkspaceOptions,
  type ProviderOption,
  type WorkspaceOption,
} from "./agent-launch";

interface AgentLaunchDialogProps {
  visible: boolean;
  theme: PluginTheme;
  compact: boolean;
  task: Task | null;
  projectName: string;
  defaultWorkspaceId: string | null;
  defaultProvider: string | null;
  currentWorkspaceId?: string;
  launching?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onLaunch: (choice: { workspaceId: string; provider: string }) => void;
}

export function AgentLaunchDialog({
  visible,
  theme,
  compact,
  task,
  projectName,
  defaultWorkspaceId,
  defaultProvider,
  currentWorkspaceId,
  launching = false,
  errorMessage = null,
  onClose,
  onLaunch,
}: AgentLaunchDialogProps) {
  const paseo = usePaseo();
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [provider, setProvider] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const [workspaceOptions, providerOptions] = await Promise.all([
          listWorkspaceOptions(paseo),
          listProviderOptions(paseo),
        ]);
        if (cancelled) return;
        setWorkspaces(workspaceOptions);
        setProviders(providerOptions);
        setWorkspaceId(
          defaultWorkspaceId && workspaceOptions.some((option) => option.id === defaultWorkspaceId)
            ? defaultWorkspaceId
            : currentWorkspaceId && workspaceOptions.some((option) => option.id === currentWorkspaceId)
              ? currentWorkspaceId
              : (workspaceOptions[0]?.id ?? ""),
        );
        setProvider(
          defaultProvider && providerOptions.some((option) => option.value === defaultProvider)
            ? defaultProvider
            : (providerOptions[0]?.value ?? ""),
        );
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, paseo, defaultWorkspaceId, defaultProvider, currentWorkspaceId]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          alignItems: "center",
          justifyContent: "center",
          padding: compact ? 12 : 24,
        },
        box: {
          width: "100%",
          maxWidth: 520,
          maxHeight: "90%",
          borderRadius: 10,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface0,
          padding: compact ? 14 : 18,
        },
        heading: { fontSize: 17, fontWeight: "700", color: theme.colors.foreground },
        subheading: { fontSize: 12, color: theme.colors.foregroundMuted, marginTop: 4 },
        label: {
          fontSize: 11,
          fontWeight: "700",
          color: theme.colors.foregroundMuted,
          marginTop: 14,
          marginBottom: 6,
          textTransform: "uppercase",
        },
        option: {
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: theme.colors.border,
          marginBottom: 6,
        },
        optionActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent + "22" },
        optionText: { fontSize: 12, fontWeight: "600", color: theme.colors.foreground },
        optionMeta: { fontSize: 10, color: theme.colors.foregroundMuted, marginTop: 2 },
        error: { marginTop: 10, fontSize: 12, color: theme.colors.statusDanger },
        footer: {
          flexDirection: "row",
          justifyContent: "flex-end",
          gap: 8,
          marginTop: 18,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        },
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
          backgroundColor: theme.colors.accent,
        },
        primaryText: { fontSize: 12, fontWeight: "700", color: theme.colors.accentForeground },
        center: { alignItems: "center", paddingVertical: 24 },
      }),
    [theme, compact],
  );

  const ready = Boolean(workspaceId) && Boolean(provider) && !launching;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.heading}>Start an Agent</Text>
          <Text style={styles.subheading}>
            {task ? `${task.title} · ${projectName}` : "Choose a task first."}
          </Text>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.colors.accent} />
              <Text style={styles.subheading}>Reading workspaces and providers from Paseo...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Workspace</Text>
              {workspaces.length === 0 ? (
                <Text style={styles.subheading}>
                  No workspace is open on this daemon. Open one in Paseo and try again.
                </Text>
              ) : (
                workspaces.map((option) => (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: option.id === workspaceId }}
                    accessibilityLabel={`Start in workspace ${option.label}`}
                    style={[styles.option, option.id === workspaceId && styles.optionActive]}
                    onPress={() => setWorkspaceId(option.id)}
                  >
                    <Text style={styles.optionText}>{option.label}</Text>
                    {option.directory ? (
                      <Text style={styles.optionMeta}>{option.directory}</Text>
                    ) : null}
                  </Pressable>
                ))
              )}

              <Text style={styles.label}>Provider and Model</Text>
              {providers.length === 0 ? (
                <Text style={styles.subheading}>
                  No provider models are configured for this daemon. Configure a provider in Paseo
                  and try again.
                </Text>
              ) : (
                providers.map((option) => (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: option.value === provider }}
                    accessibilityLabel={`Use ${option.label}`}
                    style={[styles.option, option.value === provider && styles.optionActive]}
                    onPress={() => setProvider(option.value)}
                  >
                    <Text style={styles.optionText}>{option.label}</Text>
                    <Text style={styles.optionMeta}>{option.value}</Text>
                  </Pressable>
                ))
              )}

              {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
              {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

              <View style={styles.footer}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancel agent launch"
                  style={styles.secondaryButton}
                  onPress={onClose}
                >
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Start agent now"
                  accessibilityState={{ disabled: !ready }}
                  style={[styles.primaryButton, !ready && { opacity: 0.5 }]}
                  onPress={() => onLaunch({ workspaceId, provider })}
                  disabled={!ready}
                >
                  <Text style={styles.primaryText}>{launching ? "Starting..." : "Start Agent"}</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
