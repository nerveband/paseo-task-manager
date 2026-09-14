import type { PluginTheme } from "@getpaseo/plugin";
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Project } from "../shared/board-model";
import type { SourceState } from "../shared/board-rpc";

interface SettingsPanelProps {
  visible: boolean;
  theme: PluginTheme;
  compact: boolean;
  stages: string[];
  projects: Project[];
  source: SourceState;
  saving?: boolean;
  errorMessage?: string | null;
  notice?: string | null;
  onClose: () => void;
  onSaveStages: (stages: string[]) => void;
  onSaveSource: (url: string | null, projectId: string | null) => void;
}

export function SettingsPanel({
  visible,
  theme,
  compact,
  stages,
  projects,
  source,
  saving = false,
  errorMessage = null,
  notice = null,
  onClose,
  onSaveStages,
  onSaveSource,
}: SettingsPanelProps) {
  const [draftStages, setDraftStages] = useState<string[]>(stages);
  const [newStage, setNewStage] = useState("");
  const [sourceUrl, setSourceUrl] = useState(source.url ?? "");
  const [sourceProjectId, setSourceProjectId] = useState<string>(
    source.projectId ?? projects[0]?.id ?? "",
  );

  useEffect(() => {
    if (!visible) return;
    setDraftStages(stages);
    setNewStage("");
    setSourceUrl(source.url ?? "");
    setSourceProjectId(source.projectId ?? projects[0]?.id ?? "");
  }, [visible, stages, source.url, source.projectId, projects]);

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
          maxWidth: 560,
          maxHeight: "90%",
          borderRadius: 10,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface0,
          padding: compact ? 14 : 18,
        },
        heading: { fontSize: 17, fontWeight: "700", color: theme.colors.foreground },
        sectionTitle: {
          fontSize: 12,
          fontWeight: "700",
          color: theme.colors.foreground,
          marginTop: 16,
          marginBottom: 6,
          textTransform: "uppercase",
        },
        help: { fontSize: 11, color: theme.colors.foregroundMuted, lineHeight: 15, marginBottom: 8 },
        stageRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
        input: {
          flex: 1,
          minHeight: 34,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: theme.colors.border,
          paddingHorizontal: 8,
          paddingVertical: 6,
          color: theme.colors.foreground,
          fontSize: 12,
          backgroundColor: theme.colors.surface0,
        },
        small: {
          paddingHorizontal: 8,
          paddingVertical: 6,
          borderRadius: 5,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        smallText: { fontSize: 11, color: theme.colors.foregroundMuted, fontWeight: "600" },
        row: { flexDirection: "row", gap: 8, alignItems: "center" },
        chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
        chip: {
          paddingHorizontal: 9,
          paddingVertical: 5,
          borderRadius: 5,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
        chipText: { fontSize: 12, color: theme.colors.foregroundMuted },
        chipTextActive: { color: theme.colors.accentForeground, fontWeight: "700" },
        error: { marginTop: 10, fontSize: 12, color: theme.colors.statusDanger },
        notice: { marginTop: 10, fontSize: 12, color: theme.colors.foregroundMuted },
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
      }),
    [theme, compact],
  );

  const moveStage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draftStages.length) return;
    const next = [...draftStages];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setDraftStages(next);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.heading}>Task Manager Settings</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Stages</Text>
            <Text style={styles.help}>
              Stages belong to this board. The last stage counts as done. Removing a stage moves its
              tasks to the nearest remaining stage.
            </Text>
            {draftStages.map((stage, index) => (
              <View style={styles.stageRow} key={`stage-${index}`}>
                <TextInput
                  style={styles.input}
                  value={stage}
                  onChangeText={(value) => {
                    const next = [...draftStages];
                    next[index] = value;
                    setDraftStages(next);
                  }}
                  accessibilityLabel={`Stage ${index + 1} name`}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Move ${stage} earlier`}
                  style={styles.small}
                  onPress={() => moveStage(index, -1)}
                >
                  <Text style={styles.smallText}>Up</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Move ${stage} later`}
                  style={styles.small}
                  onPress={() => moveStage(index, 1)}
                >
                  <Text style={styles.smallText}>Down</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove stage ${stage}`}
                  style={styles.small}
                  onPress={() => setDraftStages(draftStages.filter((_, i) => i !== index))}
                  disabled={draftStages.length <= 1}
                >
                  <Text style={styles.smallText}>Remove</Text>
                </Pressable>
              </View>
            ))}
            <View style={styles.row}>
              <TextInput
                style={styles.input}
                value={newStage}
                onChangeText={setNewStage}
                placeholder="Add a stage"
                placeholderTextColor={theme.colors.foregroundMuted}
                accessibilityLabel="New stage name"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add stage"
                style={styles.small}
                onPress={() => {
                  const value = newStage.trim();
                  if (!value) return;
                  setDraftStages([...draftStages, value]);
                  setNewStage("");
                }}
              >
                <Text style={styles.smallText}>Add</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save stages"
                style={styles.primaryButton}
                onPress={() => onSaveStages(draftStages)}
                disabled={saving}
              >
                <Text style={styles.primaryText}>Save Stages</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>External source</Text>
            <Text style={styles.help}>
              Optional. The board never contacts a remote endpoint unless a URL is stored here.
              Records are read-only on this board and need a project to hold them. The endpoint must
              return {"{ records: [...] }"} with an id and title per record.
            </Text>
            <TextInput
              style={[styles.input, { marginBottom: 8 }]}
              value={sourceUrl}
              onChangeText={setSourceUrl}
              placeholder="https://example.com/tasks.json"
              placeholderTextColor={theme.colors.foregroundMuted}
              accessibilityLabel="External source URL"
            />
            <View style={styles.chipRow}>
              {projects.map((project) => (
                <Pressable
                  key={project.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: project.id === sourceProjectId }}
                  accessibilityLabel={`Store external tasks in ${project.name}`}
                  style={[styles.chip, project.id === sourceProjectId && styles.chipActive]}
                  onPress={() => setSourceProjectId(project.id)}
                >
                  <Text
                    style={[styles.chipText, project.id === sourceProjectId && styles.chipTextActive]}
                  >
                    {project.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save external source"
                style={styles.primaryButton}
                onPress={() => onSaveSource(sourceUrl.trim() || null, sourceProjectId || null)}
                disabled={saving}
              >
                <Text style={styles.primaryText}>Save Source</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear external source"
                style={styles.secondaryButton}
                onPress={() => {
                  setSourceUrl("");
                  onSaveSource(null, null);
                }}
                disabled={saving}
              >
                <Text style={styles.secondaryText}>Use Local Only</Text>
              </Pressable>
            </View>

            {source.warnings.length > 0 ? (
              <Text style={styles.notice}>{source.warnings.join(" ")}</Text>
            ) : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

            <View style={styles.footer}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close settings"
                style={styles.secondaryButton}
                onPress={onClose}
              >
                <Text style={styles.secondaryText}>Close</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
