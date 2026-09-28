import type { PluginTheme } from "@getpaseo/plugin";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { doneStageOf } from "../shared/board-model";
import type { Task } from "../shared/board-model";

export interface TaskAgentInfo {
  agentId: string;
  status: "running" | "idle";
}

interface TaskCardProps {
  task: Task;
  projectName: string;
  stages: string[];
  theme: PluginTheme;
  compact: boolean;
  agent?: TaskAgentInfo;
  busy?: boolean;
  statusMessage?: string | null;
  errorMessage?: string | null;
  canOpenAgent?: boolean;
  onToggleDone: (task: Task) => void;
  onAdvanceStage: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onToggleArchive: (task: Task) => void;
  onLaunchAgent: (task: Task) => void;
  onOpenAgent?: (task: Task) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}

export function TaskCard({
  task,
  projectName,
  stages,
  theme,
  compact,
  agent,
  busy = false,
  statusMessage = null,
  errorMessage = null,
  canOpenAgent = false,
  onToggleDone,
  onAdvanceStage,
  onEdit,
  onDelete,
  onToggleArchive,
  onLaunchAgent,
  onOpenAgent,
  onLayout,
}: TaskCardProps) {
  const done = task.stage === doneStageOf(stages);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flexBasis: compact ? "100%" : "32%",
          flexGrow: 1,
          minWidth: compact ? "100%" : 260,
          maxWidth: compact ? "100%" : "33.33%",
          marginBottom: compact ? 8 : 10,
          padding: 12,
          borderRadius: 8,
          borderWidth: task.prominent && !done ? 1.5 : 1,
          borderColor: done
            ? theme.colors.border
            : task.prominent
              ? theme.colors.statusDanger
              : theme.colors.border,
          backgroundColor: theme.colors.surface0,
        },
        headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
        checkbox: {
          width: 18,
          height: 18,
          marginTop: 2,
          borderRadius: 4,
          borderWidth: 1.5,
          borderColor: done ? theme.colors.accent : theme.colors.foregroundMuted,
          backgroundColor: done ? theme.colors.accent : "transparent",
          alignItems: "center",
          justifyContent: "center",
        },
        checkboxMark: {
          fontSize: 11,
          lineHeight: 13,
          fontWeight: "700",
          color: theme.colors.accentForeground,
        },
        title: {
          flex: 1,
          fontSize: 13,
          fontWeight: "600",
          color: done ? theme.colors.foregroundMuted : theme.colors.foreground,
          textDecorationLine: done ? "line-through" : "none",
        },
        badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
        badge: {
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface1,
        },
        badgeText: { fontSize: 10, color: theme.colors.foregroundMuted },
        stageBadge: {
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: done ? theme.colors.border : theme.colors.accent,
          backgroundColor: done ? theme.colors.surface1 : theme.colors.accent + "22",
        },
        stageBadgeText: {
          fontSize: 10,
          fontWeight: "700",
          color: done ? theme.colors.foregroundMuted : theme.colors.accent,
        },
        prominentBadge: {
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: theme.colors.statusDanger,
        },
        prominentText: {
          fontSize: 9,
          fontWeight: "700",
          color: theme.colors.statusDanger,
        },
        body: {
          fontSize: 11,
          color: theme.colors.foregroundMuted,
          marginTop: 6,
          lineHeight: 15,
        },
        footer: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          marginTop: 10,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        },
        meta: { flex: 1, fontSize: 10, color: theme.colors.foregroundMuted },
        actions: { flexDirection: "row", alignItems: "center", gap: 6 },
        button: {
          paddingHorizontal: 8,
          paddingVertical: compact ? 6 : 4,
          borderRadius: 5,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        buttonText: { fontSize: 10, fontWeight: "600", color: theme.colors.foregroundMuted },
        primaryButton: {
          paddingHorizontal: 8,
          paddingVertical: compact ? 6 : 4,
          borderRadius: 5,
          backgroundColor: theme.colors.accent,
        },
        primaryButtonText: {
          fontSize: 10,
          fontWeight: "700",
          color: theme.colors.accentForeground,
        },
        dangerButtonText: { fontSize: 10, fontWeight: "600", color: theme.colors.statusDanger },
        status: { marginTop: 6, fontSize: 10, color: theme.colors.accent },
        error: { marginTop: 6, fontSize: 10, color: theme.colors.statusDanger },
      }),
    [theme, compact, done, task.prominent],
  );

  return (
    <View style={styles.card} onLayout={onLayout}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="checkbox"
          aria-checked={done}
          aria-disabled={busy}
          accessibilityLabel={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
          style={styles.checkbox}
          onPress={() => onToggleDone(task)}
          disabled={busy}
          hitSlop={8}
        >
          {done ? <Text style={styles.checkboxMark}>✓</Text> : null}
        </Pressable>
        <Text style={styles.title}>{task.title}</Text>
      </View>

      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{projectName}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{task.category}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Advance ${task.title} to the next stage`}
          accessibilityState={{ disabled: busy }}
          style={styles.stageBadge}
          onPress={() => onAdvanceStage(task)}
          disabled={busy}
        >
          <Text style={styles.stageBadgeText}>{task.stage}</Text>
        </Pressable>
        {task.prominent && !done ? (
          <View style={styles.prominentBadge}>
            <Text style={styles.prominentText}>PROMINENT</Text>
          </View>
        ) : null}
        {task.archived ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Archived</Text>
          </View>
        ) : null}
      </View>

      {task.spec ? (
        <Text style={styles.body} numberOfLines={2}>
          {task.spec}
        </Text>
      ) : null}
      {task.notes ? (
        <Text style={styles.body} numberOfLines={compact ? 3 : 2}>
          {task.notes}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.meta} numberOfLines={1}>
          {task.owner || "Unassigned"}
          {task.due ? ` · Due ${task.due}` : ""}
          {agent ? ` · Agent ${agent.status}` : ""}
        </Text>
        <View style={styles.actions}>
          {agent && canOpenAgent && onOpenAgent ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open the agent for ${task.title}`}
              style={styles.button}
              onPress={() => onOpenAgent(task)}
            >
              <Text style={styles.buttonText}>Open</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${task.title}`}
            style={styles.button}
            onPress={() => onEdit(task)}
            disabled={busy}
          >
            <Text style={styles.buttonText}>Edit</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={task.archived ? `Restore ${task.title}` : `Archive ${task.title}`}
            style={styles.button}
            onPress={() => onToggleArchive(task)}
            disabled={busy}
          >
            <Text style={styles.buttonText}>{task.archived ? "Restore" : "Archive"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${task.title}`}
            style={styles.button}
            onPress={() => onDelete(task)}
            disabled={busy}
          >
            <Text style={styles.dangerButtonText}>Delete</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Start an agent for ${task.title}`}
            accessibilityState={{ disabled: busy, busy }}
            style={styles.primaryButton}
            onPress={() => onLaunchAgent(task)}
            disabled={busy}
          >
            <Text style={styles.primaryButtonText}>{busy ? "Working..." : "Agent"}</Text>
          </Pressable>
        </View>
      </View>

      {statusMessage ? <Text style={styles.status}>{statusMessage}</Text> : null}
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
    </View>
  );
}
