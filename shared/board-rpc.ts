import { defineAttachmentSource, defineRpc } from "@getpaseo/plugin";
import { z } from "zod";
import { ProjectSchema, PrioritySchema, TaskSchema } from "./board-model";

/**
 * Contract between the plugin subprocess and every Paseo client. Only plain
 * data crosses this boundary: no filesystem handles, no credentials, no
 * functions. Every field a client needs must be declared here, because Zod
 * strips undeclared fields.
 */

export const SourceStateSchema = z.object({
  mode: z.enum(["local", "external"]),
  url: z.string().nullable(),
  projectId: z.string().nullable(),
  warnings: z.array(z.string()),
});

export type SourceState = z.infer<typeof SourceStateSchema>;

export const BoardSummarySchema = z.object({
  total: z.number(),
  open: z.number(),
  done: z.number(),
  archived: z.number(),
  byStage: z.array(z.object({ stage: z.string(), count: z.number() })),
  byProject: z.array(
    z.object({ projectId: z.string(), total: z.number(), open: z.number() }),
  ),
});

export const BoardSnapshotSchema = z.object({
  tasks: z.array(TaskSchema),
  agents: z.array(
    z.object({
      taskId: z.string(),
      agentId: z.string(),
      status: z.enum(["running", "idle"]),
    }),
  ),
  projects: z.array(ProjectSchema),
  stages: z.array(z.string()),
  summary: BoardSummarySchema,
  source: SourceStateSchema,
  fetchedAt: z.string(),
});

export type BoardSnapshot = z.infer<typeof BoardSnapshotSchema>;

export const MutationResultSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  snapshot: BoardSnapshotSchema.optional(),
});

export type MutationResult = z.infer<typeof MutationResultSchema>;

const taskFields = {
  title: z.string().min(1).max(200),
  category: z.string().min(1).max(60),
  stage: z.string().min(1).max(40).optional(),
  owner: z.string().max(120).optional(),
  due: z.string().max(40).optional(),
  spec: z.string().max(4000).optional(),
  notes: z.string().max(4000).optional(),
  link: z.string().max(2048).optional(),
  priority: PrioritySchema.optional(),
  prominent: z.boolean().optional(),
};

export const getBoardRpc = defineRpc({
  name: "taskManager.getBoard",
  input: z.object({
    projectId: z.string().optional(),
    includeArchived: z.boolean().optional().default(false),
  }),
  output: BoardSnapshotSchema,
});

export const createTaskRpc = defineRpc({
  name: "taskManager.createTask",
  input: z.object({
    projectId: z.string().min(1),
    ...taskFields,
  }),
  output: MutationResultSchema,
});

export const updateTaskRpc = defineRpc({
  name: "taskManager.updateTask",
  input: z.object({
    taskId: z.string().min(1),
    ...taskFields,
    title: taskFields.title.optional(),
    category: taskFields.category.optional(),
    stage: taskFields.stage.optional(),
    archived: z.boolean().optional(),
  }),
  output: MutationResultSchema,
});

export const deleteTaskRpc = defineRpc({
  name: "taskManager.deleteTask",
  input: z.object({ taskId: z.string().min(1) }),
  output: MutationResultSchema,
});

export const searchTasksRpc = defineRpc({
  name: "taskManager.searchTasks",
  input: z.object({ query: z.string() }),
  output: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        identifier: z.string(),
        title: z.string(),
        subtitle: z.string().optional(),
        url: z.string(),
        text: z.string(),
        resourceType: z.string(),
      }),
    ),
  }),
});

export const createProjectRpc = defineRpc({
  name: "taskManager.createProject",
  input: z.object({ name: z.string().min(1).max(60) }),
  output: MutationResultSchema,
});

export const renameProjectRpc = defineRpc({
  name: "taskManager.renameProject",
  input: z.object({ projectId: z.string().min(1), name: z.string().min(1).max(60) }),
  output: MutationResultSchema,
});

export const deleteProjectRpc = defineRpc({
  name: "taskManager.deleteProject",
  input: z.object({
    projectId: z.string().min(1),
    /** Deleting a project that still holds tasks requires this explicit choice. */
    deleteTasks: z.boolean().default(false),
  }),
  output: MutationResultSchema,
});

export const setStagesRpc = defineRpc({
  name: "taskManager.setStages",
  input: z.object({ stages: z.array(z.string()) }),
  output: MutationResultSchema,
});

export const setSourceRpc = defineRpc({
  name: "taskManager.setSource",
  input: z.object({
    /** null clears the external source and returns the board to local-only. */
    url: z.string().max(2048).nullable(),
    /** Required whenever a URL is set: the project that receives its tasks. */
    projectId: z.string().nullable().default(null),
  }),
  output: MutationResultSchema,
});

export const getPreferencesRpc = defineRpc({
  name: "taskManager.getPreferences",
  input: z.object({}),
  output: z.object({
    workspaceId: z.string().nullable(),
    provider: z.string().nullable(),
  }),
});

export const setPreferencesRpc = defineRpc({
  name: "taskManager.setPreferences",
  input: z.object({
    workspaceId: z.string().nullable().optional(),
    provider: z.string().nullable().optional(),
  }),
  output: z.object({
    workspaceId: z.string().nullable(),
    provider: z.string().nullable(),
  }),
});

export const boardAttachmentSource = defineAttachmentSource({
  id: "task-manager-tasks",
  title: "Task",
  icon: "ListTodo",
  pickerTitle: "Attach Task",
  searchPlaceholder: "Search tasks by title, category, stage, or owner...",
  search: searchTasksRpc,
});
