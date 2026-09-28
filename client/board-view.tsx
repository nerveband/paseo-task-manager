import type {
  PluginSurfaceProps,
  PluginWorkspacePanelProps,
} from "@getpaseo/plugin/client";
import { usePaseo, useRpc } from "@getpaseo/plugin/client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Task } from "../shared/board-model";
import { doneStageOf, filterTasks } from "../shared/board-model";
import type { BoardSnapshot, MutationResult } from "../shared/board-rpc";
import {
  archiveDoneRpc,
  createProjectRpc,
  createTaskRpc,
  deleteProjectRpc,
  deleteTaskRpc,
  getBoardRpc,
  getPreferencesRpc,
  renameProjectRpc,
  setPreferencesRpc,
  setSourceRpc,
  setStagesRpc,
  updateTaskRpc,
} from "../shared/board-rpc";
import { AgentLaunchDialog } from "./agent-launch-dialog";
import { launchAgentForTask } from "./agent-launch";
import { ConfirmDialog } from "./confirm-dialog";
import { SettingsPanel } from "./settings-panel";
import { TaskCard } from "./task-card";
import { TaskForm, type TaskFormValues } from "./task-form";

interface BoardViewProps {
  theme: PluginSurfaceProps["theme"];
  layout: PluginSurfaceProps["layout"];
  navigation?: PluginSurfaceProps["navigation"];
  /** Present when the board renders inside one workspace. */
  workspaceId?: string;
}

interface PendingDelete {
  kind: "task" | "project";
  id: string;
  title: string;
  message: string;
  deleteTasks?: boolean;
}

export function BoardView({ theme, layout, navigation, workspaceId }: BoardViewProps) {
  const compact = layout.compact;
  const paseo = usePaseo();

  const getBoard = useRpc(getBoardRpc);
  const createTask = useRpc(createTaskRpc);
  const updateTask = useRpc(updateTaskRpc);
  const deleteTask = useRpc(deleteTaskRpc);
  const archiveDone = useRpc(archiveDoneRpc);
  const createProject = useRpc(createProjectRpc);
  const renameProject = useRpc(renameProjectRpc);
  const deleteProject = useRpc(deleteProjectRpc);
  const setStages = useRpc(setStagesRpc);
  const setSource = useRpc(setSourceRpc);
  const getPreferences = useRpc(getPreferencesRpc);
  const setPreferences = useRpc(setPreferencesRpc);

  const [snapshot, setSnapshot] = useState<BoardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeProjectId, setActiveProjectId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);

  const [taskFormVisible, setTaskFormVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [projectForm, setProjectForm] = useState<{ visible: boolean; projectId: string | null }>({
    visible: false,
    projectId: null,
  });
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [launchTask, setLaunchTask] = useState<Task | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [boardNotice, setBoardNotice] = useState<string | null>(null);
  const [revealTaskId, setRevealTaskId] = useState<string | null>(null);
  const listRef = useRef<ScrollView>(null);
  const [cardMessages, setCardMessages] = useState<Record<string, string>>({});
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  const [preferences, setLocalPreferences] = useState<{ workspaceId: string | null; provider: string | null }>({
    workspaceId: null,
    provider: null,
  });

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getBoard({ includeArchived: true });
      setSnapshot(result);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [getBoard]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    void (async () => {
      try {
        setLocalPreferences(await getPreferences({}));
      } catch {
        // Preferences are optional; the launch dialog still works without them.
      }
    })();
  }, [getPreferences]);

  const applyResult = useCallback((result: MutationResult): string | null => {
    if (result.success && result.snapshot) {
      setSnapshot(result.snapshot);
      setBoardNotice(null);
      return null;
    }
    return result.error ?? "The change was rejected.";
  }, []);

  const projects = snapshot?.projects ?? [];
  const stages = snapshot?.stages ?? [];
  const doneStage = doneStageOf(stages);
  const tasks = snapshot?.tasks ?? [];

  const projectNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const project of projects) map[project.id] = project.name;
    return map;
  }, [projects]);

  const agentByTaskId = useMemo(() => {
    const map: Record<string, { agentId: string; status: "running" | "idle" }> = {};
    for (const entry of snapshot?.agents ?? []) map[entry.taskId] = entry;
    return map;
  }, [snapshot?.agents]);

  const visibleTasks = useMemo(() => {
    if (activeProjectId === "overview") return tasks;
    return filterTasks(tasks, {
      projectId: activeProjectId,
      stage: stageFilter,
      includeArchived: showArchived,
      query: searchQuery,
    });
  }, [tasks, activeProjectId, stageFilter, showArchived, searchQuery]);

  const stagesInView = useMemo(() => {
    const relevant =
      activeProjectId === "all" || activeProjectId === "overview"
        ? tasks
        : tasks.filter((task) => task.projectId === activeProjectId);
    const done = doneStageOf(stages);
    return {
      total: relevant.filter((task) => !task.archived).length,
      open: relevant.filter((task) => !task.archived && task.stage !== done).length,
      done: relevant.filter((task) => !task.archived && task.stage === done).length,
    };
  }, [tasks, activeProjectId, stages]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stage of stages) counts[stage] = 0;
    for (const task of tasks) {
      if (task.archived) continue;
      if (activeProjectId !== "all" && activeProjectId !== "overview" && task.projectId !== activeProjectId) {
        continue;
      }
      counts[task.stage] = (counts[task.stage] ?? 0) + 1;
    }
    return counts;
  }, [tasks, stages, activeProjectId]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          padding: compact ? 10 : 14,
          backgroundColor: theme.colors.surface0,
        },
        titleRow: {
          flexDirection: compact ? "column" : "row",
          alignItems: compact ? "stretch" : "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        },
        title: { fontSize: compact ? 16 : 18, fontWeight: "700", color: theme.colors.foreground },
        subtitle: { fontSize: 11, color: theme.colors.foregroundMuted, marginTop: 2 },
        buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
        button: {
          paddingHorizontal: 9,
          paddingVertical: compact ? 7 : 5,
          borderRadius: 5,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        buttonText: { fontSize: 11, fontWeight: "600", color: theme.colors.foregroundMuted },
        primaryButton: {
          paddingHorizontal: 10,
          paddingVertical: compact ? 7 : 5,
          borderRadius: 5,
          backgroundColor: theme.colors.accent,
        },
        primaryButtonText: { fontSize: 11, fontWeight: "700", color: theme.colors.accentForeground },
        tabRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
        tab: {
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          paddingHorizontal: 9,
          paddingVertical: 5,
          borderRadius: 5,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        tabActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent + "22" },
        tabText: { fontSize: 12, color: theme.colors.foregroundMuted, fontWeight: "600" },
        tabTextActive: { color: theme.colors.foreground, fontWeight: "700" },
        toolbar: {
          flexDirection: compact ? "column" : "row",
          gap: 8,
          marginBottom: 8,
          alignItems: compact ? "stretch" : "center",
        },
        search: {
          flex: compact ? undefined : 1,
          minWidth: compact ? undefined : 180,
          minHeight: 34,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: theme.colors.border,
          paddingHorizontal: 10,
          paddingVertical: 6,
          color: theme.colors.foreground,
          fontSize: 12,
          backgroundColor: theme.colors.surface0,
        },
        chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, flexShrink: 1 },
        chip: {
          paddingHorizontal: 8,
          paddingVertical: 5,
          borderRadius: 5,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
        chipText: { fontSize: 11, color: theme.colors.foregroundMuted },
        chipTextActive: { color: theme.colors.accentForeground, fontWeight: "700" },
        grid: { flexDirection: "row", flexWrap: "wrap", gap: compact ? 8 : 10, paddingBottom: 24 },
        center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
        emptyTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.foreground },
        emptyBody: {
          fontSize: 12,
          color: theme.colors.foregroundMuted,
          textAlign: "center",
          marginTop: 6,
          lineHeight: 17,
          maxWidth: 420,
        },
        errorTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.statusDanger },
        warning: {
          fontSize: 11,
          color: theme.colors.foregroundMuted,
          marginBottom: 8,
          lineHeight: 15,
        },
        sectionTitle: {
          fontSize: 12,
          fontWeight: "700",
          color: theme.colors.foreground,
          marginTop: 12,
          marginBottom: 6,
          textTransform: "uppercase",
        },
        kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
        kpi: {
          flexBasis: compact ? "47%" : "23%",
          flexGrow: 1,
          padding: 10,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        kpiValue: { fontSize: 20, fontWeight: "700", color: theme.colors.foreground },
        kpiLabel: { fontSize: 10, color: theme.colors.foregroundMuted, marginTop: 2 },
        projectRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 6,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        projectName: { flex: 1, fontSize: 12, fontWeight: "600", color: theme.colors.foreground },
        projectMeta: { fontSize: 10, color: theme.colors.foregroundMuted },
      }),
    [theme, compact],
  );

  const openCreateTask = () => {
    setEditingTask(null);
    setFormError(null);
    setTaskFormVisible(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setFormError(null);
    setTaskFormVisible(true);
  };

  const submitTaskForm = async (values: TaskFormValues) => {
    setSubmitting(true);
    setFormError(null);
    try {
      const result = editingTask
        ? await updateTask({
            taskId: editingTask.id,
            title: values.title,
            category: values.category,
            stage: values.stage,
            owner: values.owner,
            due: values.due,
            spec: values.spec,
            notes: values.notes,
            link: values.link,
            priority: values.priority,
            prominent: values.prominent,
          })
        : await createTask({
            projectId: values.projectId,
            title: values.title,
            category: values.category,
            stage: values.stage,
            owner: values.owner,
            due: values.due,
            spec: values.spec,
            notes: values.notes,
            link: values.link,
            priority: values.priority,
            prominent: values.prominent,
          });
      const error = applyResult(result);
      if (error) {
        setFormError(error);
        return;
      }
      if (!editingTask && result.snapshot) {
        // A new task sorts among many others; clear filters that would hide it and scroll to it.
        const knownIds = new Set(tasks.map((task) => task.id));
        const added = result.snapshot.tasks.find((task) => !knownIds.has(task.id));
        if (added) {
          setSearchQuery("");
          setStageFilter("all");
          if (activeProjectId !== "all" && activeProjectId !== added.projectId) {
            setActiveProjectId(added.projectId);
          }
          setCardMessages((prev) => ({ ...prev, [added.id]: "Just added" }));
          setRevealTaskId(added.id);
        }
      }
      setTaskFormVisible(false);
      setEditingTask(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const cycleStage = async (task: Task) => {
    const index = stages.indexOf(task.stage);
    const nextStage = stages[(index + 1) % stages.length];
    setCardErrors((prev) => ({ ...prev, [task.id]: "" }));
    try {
      const result = await updateTask({ taskId: task.id, stage: nextStage });
      const error = applyResult(result);
      if (error) setCardErrors((prev) => ({ ...prev, [task.id]: error }));
    } catch (error) {
      setCardErrors((prev) => ({
        ...prev,
        [task.id]: error instanceof Error ? error.message : String(error),
      }));
    }
  };

  const toggleDone = async (task: Task) => {
    const nextStage = task.stage === doneStage ? stages[0] : doneStage;
    setCardErrors((prev) => ({ ...prev, [task.id]: "" }));
    try {
      const result = await updateTask({ taskId: task.id, stage: nextStage });
      const error = applyResult(result);
      if (error) setCardErrors((prev) => ({ ...prev, [task.id]: error }));
    } catch (error) {
      setCardErrors((prev) => ({
        ...prev,
        [task.id]: error instanceof Error ? error.message : String(error),
      }));
    }
  };

  const toggleArchive = async (task: Task) => {
    setCardErrors((prev) => ({ ...prev, [task.id]: "" }));
    try {
      const result = await updateTask({ taskId: task.id, archived: !task.archived });
      const error = applyResult(result);
      if (error) {
        setCardErrors((prev) => ({ ...prev, [task.id]: error }));
      } else if (!task.archived) {
        setBoardNotice(`Archived "${task.title}". Turn on the Archived filter to restore it.`);
      }
    } catch (error) {
      setCardErrors((prev) => ({
        ...prev,
        [task.id]: error instanceof Error ? error.message : String(error),
      }));
    }
  };

  const archiveCompleted = async () => {
    const count = stagesInView.done;
    setSubmitting(true);
    try {
      const result = await archiveDone({
        projectId: activeProjectId === "all" || activeProjectId === "overview" ? undefined : activeProjectId,
      });
      const error = applyResult(result);
      if (error) {
        setActionNotice(error);
      } else {
        setActionNotice(null);
        setBoardNotice(
          `Archived ${count} completed task${count === 1 ? "" : "s"}. Turn on the Archived filter to restore them.`,
        );
      }
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setSubmitting(true);
    try {
      const result =
        pendingDelete.kind === "task"
          ? await deleteTask({ taskId: pendingDelete.id })
          : await deleteProject({
              projectId: pendingDelete.id,
              deleteTasks: pendingDelete.deleteTasks === true,
            });
      const error = applyResult(result);
      if (error) {
        setActionNotice(error);
      } else {
        setActionNotice(null);
      }
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
      setPendingDelete(null);
    }
  };

  const submitProjectForm = async () => {
    const name = projectNameDraft.trim();
    if (!name) {
      setFormError("A project name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const result = projectForm.projectId
        ? await renameProject({ projectId: projectForm.projectId, name })
        : await createProject({ name });
      const error = applyResult(result);
      if (error) {
        setFormError(error);
        return;
      }
      setProjectForm({ visible: false, projectId: null });
      setProjectNameDraft("");
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const launchAgent = async (choice: { workspaceId: string; provider: string }) => {
    if (!launchTask) return;
    const task = launchTask;
    setSubmitting(true);
    setCardErrors((prev) => ({ ...prev, [task.id]: "" }));
    try {
      const launched = await launchAgentForTask(paseo, {
        task,
        projectName: projectNameById[task.projectId] ?? "Unassigned",
        workspaceId: choice.workspaceId,
        provider: choice.provider,
      });
      setCardMessages((prev) => ({ ...prev, [task.id]: `Agent started (${launched.agentId.slice(0, 8)})` }));
      const updated = await setPreferences({
        workspaceId: choice.workspaceId,
        provider: choice.provider,
      });
      setLocalPreferences(updated);
      setLaunchTask(null);
      await loadBoard();
    } catch (error) {
      setCardErrors((prev) => ({
        ...prev,
        [task.id]: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !snapshot) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={theme.colors.accent} />
        <Text style={styles.emptyBody}>Loading tasks...</Text>
      </View>
    );
  }

  if (!snapshot) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.errorTitle}>The board could not be loaded</Text>
        <Text style={styles.emptyBody}>{loadError ?? "Unknown error."}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try loading the board again"
          style={[styles.primaryButton, { marginTop: 12 }]}
          onPress={() => void loadBoard()}
        >
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const showEmptyState = projects.length === 0;

  return (
    <View style={styles.screen}>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>Task Manager</Text>
          <Text style={styles.subtitle}>
            {stagesInView.total} total · {stagesInView.open} open · {stagesInView.done} done
          </Text>
        </View>
        <View style={styles.buttonRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a task"
            style={styles.primaryButton}
            onPress={openCreateTask}
            disabled={projects.length === 0}
          >
            <Text style={styles.primaryButtonText}>New Task</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a project"
            style={styles.button}
            onPress={() => {
              setProjectForm({ visible: true, projectId: null });
              setProjectNameDraft("");
              setFormError(null);
            }}
          >
            <Text style={styles.buttonText}>New Project</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            style={styles.button}
            onPress={() => setSettingsVisible(true)}
          >
            <Text style={styles.buttonText}>Settings</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reload the board"
            style={styles.button}
            onPress={() => void loadBoard()}
          >
            <Text style={styles.buttonText}>Reload</Text>
          </Pressable>
        </View>
      </View>

      {snapshot.source.warnings.length > 0 ? (
        <Text style={styles.warning}>{snapshot.source.warnings.join(" ")}</Text>
      ) : null}
      {actionNotice ? <Text style={styles.warning}>{actionNotice}</Text> : null}
      {boardNotice ? <Text style={styles.warning}>{boardNotice}</Text> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6, flexGrow: 0, flexShrink: 0 }}>
        <View style={styles.tabRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: activeProjectId === "overview" }}
            accessibilityLabel="Show the overview"
            style={[styles.tab, activeProjectId === "overview" && styles.tabActive]}
            onPress={() => setActiveProjectId("overview")}
          >
            <Text style={[styles.tabText, activeProjectId === "overview" && styles.tabTextActive]}>
              Overview
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: activeProjectId === "all" }}
            accessibilityLabel="Show every task"
            style={[styles.tab, activeProjectId === "all" && styles.tabActive]}
            onPress={() => setActiveProjectId("all")}
          >
            <Text style={[styles.tabText, activeProjectId === "all" && styles.tabTextActive]}>
              All Tasks
            </Text>
          </Pressable>
          {projects.map((project) => (
            <Pressable
              key={project.id}
              accessibilityRole="button"
              accessibilityState={{ selected: activeProjectId === project.id }}
              accessibilityLabel={`Show tasks for ${project.name}`}
              style={[styles.tab, activeProjectId === project.id && styles.tabActive]}
              onPress={() => setActiveProjectId(project.id)}
            >
              <Text style={[styles.tabText, activeProjectId === project.id && styles.tabTextActive]}>
                {project.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {projects.length > 0 && activeProjectId === "overview" ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <Text style={styles.kpiValue}>{snapshot.summary.open}</Text>
              <Text style={styles.kpiLabel}>Open</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiValue}>{snapshot.summary.done}</Text>
              <Text style={styles.kpiLabel}>Done</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiValue}>{projects.length}</Text>
              <Text style={styles.kpiLabel}>Projects</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiValue}>{snapshot.summary.archived}</Text>
              <Text style={styles.kpiLabel}>Archived</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Stages</Text>
          <View style={styles.chipRow}>
            {snapshot.summary.byStage.map((entry) => (
              <View key={entry.stage} style={styles.chip}>
                <Text style={styles.chipText}>
                  {entry.stage} · {entry.count}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Projects</Text>
          {projects.map((project) => {
            const summary = snapshot.summary.byProject.find((entry) => entry.projectId === project.id);
            return (
              <View style={styles.projectRow} key={project.id}>
                <Text style={styles.projectName}>{project.name}</Text>
                <Text style={styles.projectMeta}>
                  {summary ? `${summary.open} open · ${summary.total} total` : "0 tasks"}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Rename ${project.name}`}
                  style={styles.button}
                  onPress={() => {
                    setProjectForm({ visible: true, projectId: project.id });
                    setProjectNameDraft(project.name);
                    setFormError(null);
                  }}
                >
                  <Text style={styles.buttonText}>Rename</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${project.name}`}
                  style={styles.button}
                  onPress={() =>
                    setPendingDelete({
                      kind: "project",
                      id: project.id,
                      title: `Delete "${project.name}"?`,
                      message:
                        (summary?.total ?? 0) > 0
                          ? `${summary?.total} task${summary?.total === 1 ? "" : "s"} in this project will be deleted as well.`
                          : "This project has no tasks.",
                      deleteTasks: (summary?.total ?? 0) > 0,
                    })
                  }
                >
                  <Text style={styles.buttonText}>Delete</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      ) : showEmptyState ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>This board is empty</Text>
          <Text style={styles.emptyBody}>
            Create a project, then add tasks to it. Projects and stages are yours to define: nothing
            is stored in this plugin until you add it.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create the first project"
            style={[styles.primaryButton, { marginTop: 12 }]}
            onPress={() => {
              setProjectForm({ visible: true, projectId: null });
              setProjectNameDraft("");
              setFormError(null);
            }}
          >
            <Text style={styles.primaryButtonText}>Create a Project</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.toolbar}>
            <TextInput
              style={styles.search}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Filter tasks"
              placeholderTextColor={theme.colors.foregroundMuted}
              accessibilityLabel="Filter tasks"
            />
            <View style={styles.chipRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: stageFilter === "all" }}
                accessibilityLabel="Show every stage"
                style={[styles.chip, stageFilter === "all" && styles.chipActive]}
                onPress={() => setStageFilter("all")}
              >
                <Text style={[styles.chipText, stageFilter === "all" && styles.chipTextActive]}>
                  All ({stagesInView.total})
                </Text>
              </Pressable>
              {stages.map((stage) => (
                <Pressable
                  key={stage}
                  accessibilityRole="button"
                  accessibilityState={{ selected: stageFilter === stage }}
                  accessibilityLabel={`Filter by stage ${stage}`}
                  style={[styles.chip, stageFilter === stage && styles.chipActive]}
                  onPress={() => setStageFilter(stage)}
                >
                  <Text style={[styles.chipText, stageFilter === stage && styles.chipTextActive]}>
                    {stage} ({stageCounts[stage] ?? 0})
                  </Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="checkbox"
                aria-checked={showArchived}
                accessibilityLabel="Include archived tasks"
                style={[styles.chip, showArchived && styles.chipActive]}
                onPress={() => setShowArchived((value) => !value)}
              >
                <Text style={[styles.chipText, showArchived && styles.chipTextActive]}>
                  Archived
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Archive every completed task in this view"
                accessibilityState={{ disabled: stagesInView.done === 0 || submitting }}
                style={[styles.chip, (stagesInView.done === 0 || submitting) && { opacity: 0.5 }]}
                onPress={() => void archiveCompleted()}
                disabled={stagesInView.done === 0 || submitting}
              >
                <Text style={styles.chipText}>Archive done ({stagesInView.done})</Text>
              </Pressable>
            </View>
          </View>

          {visibleTasks.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>No matching tasks</Text>
              <Text style={styles.emptyBody}>
                Change the filter, or add a task to this project.
              </Text>
            </View>
          ) : (
            <ScrollView ref={listRef} showsVerticalScrollIndicator={false}>
              <View style={styles.grid}>
                {visibleTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    projectName={projectNameById[task.projectId] ?? "Unassigned"}
                    stages={stages}
                    theme={theme}
                    compact={compact}
                    agent={agentByTaskId[task.id]}
                    canOpenAgent={Boolean(navigation?.openAgent)}
                    statusMessage={cardMessages[task.id] ?? null}
                    errorMessage={cardErrors[task.id] ?? null}
                    onToggleDone={(target) => void toggleDone(target)}
                    onAdvanceStage={(target) => void cycleStage(target)}
                    onEdit={openEditTask}
                    onDelete={(target) =>
                      setPendingDelete({
                        kind: "task",
                        id: target.id,
                        title: `Delete "${target.title}"?`,
                        message: "The task is removed from this board permanently.",
                      })
                    }
                    onToggleArchive={(target) => void toggleArchive(target)}
                    onLayout={
                      task.id === revealTaskId
                        ? (event) => {
                            listRef.current?.scrollTo({
                              y: Math.max(0, event.nativeEvent.layout.y - 8),
                              animated: true,
                            });
                            setRevealTaskId(null);
                          }
                        : undefined
                    }
                    onLaunchAgent={(target) => {
                      setLaunchTask(target);
                      setCardErrors((prev) => ({ ...prev, [target.id]: "" }));
                    }}
                    onOpenAgent={(target) => {
                      const info = agentByTaskId[target.id];
                      if (info) navigation?.openAgent?.({ agentId: info.agentId });
                    }}
                  />
                ))}
              </View>
            </ScrollView>
          )}
        </>
      )}

      <TaskForm
        visible={taskFormVisible}
        theme={theme}
        compact={compact}
        projects={projects}
        stages={stages}
        initialTask={editingTask}
        defaultProjectId={
          activeProjectId !== "all" && activeProjectId !== "overview" ? activeProjectId : null
        }
        submitting={submitting}
        errorMessage={formError}
        onClose={() => {
          setTaskFormVisible(false);
          setEditingTask(null);
        }}
        onSubmit={(values) => void submitTaskForm(values)}
      />

      {projectForm.visible ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setProjectForm({ visible: false, projectId: null })}>
          <ProjectFormModal
            theme={theme}
            compact={compact}
            title={projectForm.projectId ? "Rename Project" : "Create Project"}
            value={projectNameDraft}
            submitting={submitting}
            errorMessage={formError}
            onChange={setProjectNameDraft}
            onCancel={() => setProjectForm({ visible: false, projectId: null })}
            onSubmit={() => void submitProjectForm()}
          />
        </Modal>
      ) : null}

      <SettingsPanel
        visible={settingsVisible}
        theme={theme}
        compact={compact}
        stages={stages}
        projects={projects}
        source={snapshot.source}
        saving={submitting}
        errorMessage={formError}
        notice={actionNotice}
        onClose={() => setSettingsVisible(false)}
        onSaveStages={(nextStages) => {
          setSubmitting(true);
          void (async () => {
            try {
              const result = await setStages({ stages: nextStages });
              const error = applyResult(result);
              setFormError(error);
              if (!error && result.error) setActionNotice(result.error);
            } catch (error) {
              setFormError(error instanceof Error ? error.message : String(error));
            } finally {
              setSubmitting(false);
            }
          })();
        }}
        onSaveSource={(url, projectId) => {
          setSubmitting(true);
          void (async () => {
            try {
              const result = await setSource({ url, projectId });
              const error = applyResult(result);
              setFormError(error);
            } catch (error) {
              setFormError(error instanceof Error ? error.message : String(error));
            } finally {
              setSubmitting(false);
            }
          })();
        }}
      />

      <AgentLaunchDialog
        visible={launchTask !== null}
        theme={theme}
        compact={compact}
        task={launchTask}
        projectName={launchTask ? projectNameById[launchTask.projectId] ?? "Unassigned" : ""}
        defaultWorkspaceId={preferences.workspaceId}
        defaultProvider={preferences.provider}
        currentWorkspaceId={workspaceId}
        launching={submitting}
        errorMessage={launchTask ? cardErrors[launchTask.id] ?? null : null}
        onClose={() => setLaunchTask(null)}
        onLaunch={(choice) => void launchAgent(choice)}
      />

      <ConfirmDialog
        visible={pendingDelete !== null}
        theme={theme}
        title={pendingDelete?.title ?? ""}
        message={pendingDelete?.message ?? ""}
        confirmLabel="Delete"
        destructive
        busy={submitting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </View>
  );
}

function ProjectFormModal({
  theme,
  compact,
  title,
  value,
  submitting,
  errorMessage,
  onChange,
  onCancel,
  onSubmit,
}: {
  theme: PluginSurfaceProps["theme"];
  compact: boolean;
  title: string;
  value: string;
  submitting: boolean;
  errorMessage: string | null;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
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
          maxWidth: 420,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface0,
          padding: 18,
        },
        heading: { fontSize: 15, fontWeight: "700", color: theme.colors.foreground },
        input: {
          marginTop: 12,
          minHeight: 36,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: theme.colors.border,
          paddingHorizontal: 10,
          paddingVertical: 8,
          color: theme.colors.foreground,
          fontSize: 13,
          backgroundColor: theme.colors.surface0,
        },
        footer: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 16 },
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
        error: { marginTop: 8, fontSize: 12, color: theme.colors.statusDanger },
      }),
    [theme, compact],
  );

  return (
    <View style={styles.overlay}>
      <View style={styles.box}>
        <Text style={styles.heading}>{title}</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder="Project name"
          placeholderTextColor={theme.colors.foregroundMuted}
          accessibilityLabel="Project name"
        />
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel project form"
            style={styles.secondaryButton}
            onPress={onCancel}
            disabled={submitting}
          >
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save project"
            style={styles.primaryButton}
            onPress={onSubmit}
            disabled={submitting}
          >
            <Text style={styles.primaryText}>{submitting ? "Saving..." : "Save"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function BoardSurface(props: PluginSurfaceProps) {
  return (
    <BoardView
      theme={props.theme}
      layout={props.layout}
      navigation={props.navigation}
    />
  );
}

export function BoardPanel(props: PluginWorkspacePanelProps) {
  return (
    <BoardView
      theme={props.theme}
      layout={props.layout}
      navigation={props.navigation}
      workspaceId={props.workspaceId}
    />
  );
}
