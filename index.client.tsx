import type { PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { BoardPanel, BoardSurface } from "./client/board-view";
import { boardAttachmentSource } from "./shared/board-rpc";

const BOARD_SCREEN_ID = "task-manager-board";

function TaskManagerItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="CheckSquare"
      active={currentScreen?.screenId === BOARD_SCREEN_ID}
      onPress={() => openScreen({ screenId: BOARD_SCREEN_ID })}
    />
  );
}

/**
 * Registers the client half of the plugin: one board screen, one workspace
 * panel, one command center entry, and a task attachment source for the
 * message composer.
 */
export default function contribute(client: PluginClientContext): () => void {
  client.addScreen({ id: BOARD_SCREEN_ID, title: "Task Manager", Component: BoardSurface });

  client.addSidebarHeaderItem({
    id: "task-manager",
    title: "Task Manager",
    Component: TaskManagerItem,
  });

  client.addWorkspacePanel({
    id: "task-manager",
    title: "Tasks",
    icon: "ListTodo",
    Component: BoardPanel,
  });

  client.addCommandCenterItem({
    id: "task-manager-open-board",
    title: "Task Manager: Open Board",
    icon: "LayoutDashboard",
    keywords: ["tasks", "board", "projects", "todo"],
    context: "global",
    onSelect({ openScreen }) {
      openScreen({ screenId: BOARD_SCREEN_ID });
    },
  });

  client.addAttachmentSource(boardAttachmentSource);

  return () => {};
}
