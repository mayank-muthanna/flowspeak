import type { CanvasElement } from "~/types/canvas";

export type AgentChange =
  | { action: "create"; element: CanvasElement }
  | { action: "update"; element: CanvasElement }
  | { action: "delete"; id: string };

export function useAgentBridge(
  getElements: () => CanvasElement[],
  actions: {
    createElementFromAgent: (element: CanvasElement) => Promise<void>;
    updateElementFromAgent: (element: CanvasElement) => Promise<void>;
    deleteElementFromAgent: (id: string) => Promise<void>;
  },
) {
  const getCanvasGraph = () => {
    const elements = getElements();
    return {
      nodes: elements.filter((el) => el.type !== "arrow" && el.type !== "connector"),
      edges: elements
        .filter((el) => el.type === "arrow" || el.type === "connector")
        .map((el) => ({
          id: el.id,
          fromId: String(el.content.fromId ?? ""),
          toId: String(el.content.toId ?? ""),
          anchorPoints: (el.content.anchorPoints as Record<string, unknown>) ?? {},
        })),
    };
  };

  const applyAgentChanges = async (changes: AgentChange[]) => {
    for (const change of changes) {
      if (change.action === "create") {
        await actions.createElementFromAgent(change.element);
      } else if (change.action === "update") {
        await actions.updateElementFromAgent(change.element);
      } else {
        await actions.deleteElementFromAgent(change.id);
      }
    }
  };

  const suggestLayout = () => {
    return {
      recommendation: "No suggestions yet.",
      confidence: 0,
    };
  };

  const analyzeStructure = () => {
    const graph = getCanvasGraph();
    return {
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      disconnectedNodes: graph.nodes.filter((node) =>
        !graph.edges.some((edge) => edge.fromId === node.id || edge.toId === node.id),
      ),
    };
  };

  return {
    getCanvasGraph,
    applyAgentChanges,
    suggestLayout,
    analyzeStructure,
  };
}
