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
import type { Project, Task } from "../shared/board-model";

export interface TaskFormValues {
  projectId: string;
  title: string;
  category: string;
  stage: string;
  owner: string;
  due: string;
  spec: string;
  notes: string;
  link: string;
  priority: 0 | 1 | 2 | 3;
  prominent: boolean;
}

interface TaskFormProps {
  visible: boolean;
  theme: PluginTheme;
  compact: boolean;
  projects: Project[];
  stages: string[];
  initialTask?: Task | null;
  defaultProjectId?: string | null;
  submitting?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => void;
}

const PRIORITY_LABELS: Array<{ value: 0 | 1 | 2 | 3; label: string }> = [
  { value: 0, label: "None" },
  { value: 1, label: "Normal" },
  { value: 2, label: "High" },
  { value: 3, label: "Critical" },
];

export function TaskForm({
  visible,
  theme,
  compact,
  projects,
  stages,
  initialTask = null,
  defaultProjectId = null,
  submitting = false,
  errorMessage = null,
  onClose,
  onSubmit,
}: TaskFormProps) {
  const [projectId, setProjectId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [stage, setStage] = useState(stages[0] ?? "Todo");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");
  const [spec, setSpec] = useState("");
  const [notes, setNotes] = useState("");
  const [link, setLink] = useState("");
  const [priority, setPriority] = useState<0 | 1 | 2 | 3>(1);
  const [prominent, setProminent] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (initialTask) {
      setProjectId(initialTask.projectId);
      setTitle(initialTask.title);
      setCategory(initialTask.category);
      setStage(initialTask.stage);
      setOwner(initialTask.owner ?? "");
      setDue(initialTask.due ?? "");
      setSpec(initialTask.spec ?? "");
      setNotes(initialTask.notes ?? "");
      setLink(initialTask.link ?? "");
      setPriority(initialTask.priority);
      setProminent(initialTask.prominent);
    } else {
      setProjectId(defaultProjectId ?? projects[0]?.id ?? "");
      setTitle("");
      setCategory("General");
      setStage(stages[0] ?? "Todo");
      setOwner("");
      setDue("");
      setSpec("");
      setNotes("");
      setLink("");
      setPriority(1);
      setProminent(false);
    }
    setValidationError(null);
  }, [visible, initialTask, defaultProjectId, projects, stages]);

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
        heading: {
          fontSize: 17,
          fontWeight: "700",
          color: theme.colors.foreground,
          marginBottom: 10,
        },
        label: {
          fontSize: 11,
          fontWeight: "600",
          color: theme.colors.foregroundMuted,
          marginTop: 10,
          marginBottom: 4,
          textTransform: "uppercase",
        },
        input: {
          minHeight: 36,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface0,
          paddingHorizontal: 10,
          paddingVertical: 8,
          color: theme.colors.foreground,
          fontSize: 13,
        },
        multiLine: {
          minHeight: 64,
          textAlignVertical: "top",
        },
        chipRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
        },
        chip: {
          paddingHorizontal: 9,
          paddingVertical: 5,
          borderRadius: 5,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        chipActive: {
          backgroundColor: theme.colors.accent,
          borderColor: theme.colors.accent,
        },
        chipText: {
          fontSize: 12,
          color: theme.colors.foregroundMuted,
        },
        chipTextActive: {
          color: theme.colors.accentForeground,
          fontWeight: "700",
        },
        row: { flexDirection: "row", gap: 10 },
        column: { flex: 1 },
        error: {
          marginTop: 10,
          fontSize: 12,
          color: theme.colors.statusDanger,
        },
        footer: {
          flexDirection: "row",
          justifyContent: "flex-end",
          gap: 8,
          marginTop: 16,
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
        primaryText: {
          fontSize: 12,
          fontWeight: "700",
          color: theme.colors.accentForeground,
        },
      }),
    [theme, compact],
  );

  const submit = () => {
    if (!projectId) {
      setValidationError("Choose a project first.");
      return;
    }
    if (!title.trim()) {
      setValidationError("A task title is required.");
      return;
    }
    if (!category.trim()) {
      setValidationError("A category is required.");
      return;
    }
    if (link.trim()) {
      try {
        const parsed = new URL(link.trim());
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new Error("unsupported protocol");
        }
      } catch {
        setValidationError("The link must be an http or https URL.");
        return;
      }
    }
    setValidationError(null);
    onSubmit({
      projectId,
      title: title.trim(),
      category: category.trim(),
      stage,
      owner: owner.trim(),
      due: due.trim(),
      spec: spec.trim(),
      notes: notes.trim(),
      link: link.trim(),
      priority,
      prominent,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.heading}>{initialTask ? "Edit Task" : "Create Task"}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Project</Text>
            <View style={styles.chipRow}>
              {projects.map((project) => (
                <Pressable
                  key={project.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: project.id === projectId }}
                  accessibilityLabel={`Assign to project ${project.name}`}
                  style={[styles.chip, project.id === projectId && styles.chipActive]}
                  onPress={() => setProjectId(project.id)}
                >
                  <Text style={[styles.chipText, project.id === projectId && styles.chipTextActive]}>
                    {project.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="What needs to be done"
              placeholderTextColor={theme.colors.foregroundMuted}
              accessibilityLabel="Task title"
            />

            <View style={styles.row}>
              <View style={styles.column}>
                <Text style={styles.label}>Category</Text>
                <TextInput
                  style={styles.input}
                  value={category}
                  onChangeText={setCategory}
                  placeholder="General"
                  placeholderTextColor={theme.colors.foregroundMuted}
                  accessibilityLabel="Task category"
                />
              </View>
              <View style={styles.column}>
                <Text style={styles.label}>Owner</Text>
                <TextInput
                  style={styles.input}
                  value={owner}
                  onChangeText={setOwner}
                  placeholder="Optional"
                  placeholderTextColor={theme.colors.foregroundMuted}
                  accessibilityLabel="Task owner"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.column}>
                <Text style={styles.label}>Due date</Text>
                <TextInput
                  style={styles.input}
                  value={due}
                  onChangeText={setDue}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.colors.foregroundMuted}
                  accessibilityLabel="Task due date"
                />
              </View>
              <View style={styles.column}>
                <Text style={styles.label}>Link</Text>
                <TextInput
                  style={styles.input}
                  value={link}
                  onChangeText={setLink}
                  placeholder="Optional http(s) URL"
                  placeholderTextColor={theme.colors.foregroundMuted}
                  accessibilityLabel="Task link"
                />
              </View>
            </View>

            <Text style={styles.label}>Stage</Text>
            <View style={styles.chipRow}>
              {stages.map((candidate) => (
                <Pressable
                  key={candidate}
                  accessibilityRole="button"
                  accessibilityState={{ selected: candidate === stage }}
                  accessibilityLabel={`Set stage ${candidate}`}
                  style={[styles.chip, candidate === stage && styles.chipActive]}
                  onPress={() => setStage(candidate)}
                >
                  <Text style={[styles.chipText, candidate === stage && styles.chipTextActive]}>
                    {candidate}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Priority</Text>
            <View style={styles.chipRow}>
              {PRIORITY_LABELS.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: option.value === priority }}
                  accessibilityLabel={`Set priority ${option.label}`}
                  style={[styles.chip, option.value === priority && styles.chipActive]}
                  onPress={() => setPriority(option.value)}
                >
                  <Text style={[styles.chipText, option.value === priority && styles.chipTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              accessibilityRole="checkbox"
              aria-checked={prominent}
              accessibilityLabel="Mark task as prominent"
              style={[styles.chip, prominent && styles.chipActive, { marginTop: 10 }]}
              onPress={() => setProminent((value) => !value)}
            >
              <Text style={[styles.chipText, prominent && styles.chipTextActive]}>
                {prominent ? "Prominent" : "Mark prominent"}
              </Text>
            </Pressable>

            <Text style={styles.label}>Specification</Text>
            <TextInput
              style={[styles.input, styles.multiLine]}
              value={spec}
              onChangeText={setSpec}
              multiline
              placeholder="Acceptance criteria, format, or deliverable spec"
              placeholderTextColor={theme.colors.foregroundMuted}
              accessibilityLabel="Task specification"
            />

            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.multiLine]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Context and background"
              placeholderTextColor={theme.colors.foregroundMuted}
              accessibilityLabel="Task notes"
            />

            {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

            <View style={styles.footer}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={styles.secondaryButton}
                onPress={onClose}
                disabled={submitting}
              >
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={initialTask ? "Save task" : "Create task"}
                style={styles.primaryButton}
                onPress={submit}
                disabled={submitting}
              >
                <Text style={styles.primaryText}>
                  {submitting ? "Saving..." : initialTask ? "Save Task" : "Create Task"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
