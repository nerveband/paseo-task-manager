import type { PluginClientContext } from "@getpaseo/plugin/client";
import { BoardPanel, BoardSurface } from "./client/board-view";
import { boardAttachmentSource } from "./shared/board-rpc";

/**
 * Registers the client half of the plugin: one board surface, one workspace
 * panel, one command center entry, and a task attachment source for the
 * message composer.
 */
export default function contribute(client: PluginClientContext): () => void {
  client.addSurface("task-manager-board", BoardSurface);

  client.addSidebarItem({
    id: "task-manager",
    title: "Task Manager",
    icon: "CheckSquare",
    surface: "task-manager-board",
  });

  client.addWorkspacePanel({
    id: "task-manager",
    title: "Tasks",
    icon: "ListTodo",
    context: "workspace",
    Component: BoardPanel,
  });

  client.addCommandCenterItem({
    id: "task-manager-open-board",
    title: "Task Manager: Open Board",
    icon: "LayoutDashboard",
    keywords: ["tasks", "board", "projects", "todo"],
    context: "global",
    onSelect({ openSurface }) {
      openSurface("task-manager-board");
    },
  });

  client.addAttachmentSource(boardAttachmentSource);

  return () => {};
}
