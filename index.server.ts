import type { PluginServerContext } from "@getpaseo/plugin/server";
import {
  archiveDoneRpc,
  createProjectRpc,
  createTaskRpc,
  deleteProjectRpc,
  deleteTaskRpc,
  getBoardRpc,
  getPreferencesRpc,
  renameProjectRpc,
  searchTasksRpc,
  setPreferencesRpc,
  setSourceRpc,
  setStagesRpc,
  updateTaskRpc,
} from "./shared/board-rpc";
import {
  archiveDoneHandler,
  createProjectHandler,
  createTaskHandler,
  deleteProjectHandler,
  deleteTaskHandler,
  getBoardHandler,
  getPreferencesHandler,
  renameProjectHandler,
  searchTasksHandler,
  setPreferencesHandler,
  setSourceHandler,
  setStagesHandler,
  updateTaskHandler,
} from "./server/board-service";

/**
 * Registers the daemon-side half of the plugin. All handlers are stateless
 * functions over the plugin data directory; the client talks to them only
 * through the contracts in shared/board-rpc.ts.
 */
export default function contribute(server: PluginServerContext): () => void {
  server.handle(getBoardRpc, getBoardHandler);
  server.handle(createTaskRpc, createTaskHandler);
  server.handle(updateTaskRpc, updateTaskHandler);
  server.handle(deleteTaskRpc, deleteTaskHandler);
  server.handle(archiveDoneRpc, archiveDoneHandler);
  server.handle(searchTasksRpc, searchTasksHandler);
  server.handle(createProjectRpc, createProjectHandler);
  server.handle(renameProjectRpc, renameProjectHandler);
  server.handle(deleteProjectRpc, deleteProjectHandler);
  server.handle(setStagesRpc, setStagesHandler);
  server.handle(setSourceRpc, setSourceHandler);
  server.handle(getPreferencesRpc, getPreferencesHandler);
  server.handle(setPreferencesRpc, setPreferencesHandler);

  return () => {};
}
