// Screenshot-only host adapter. Production imports never resolve this module.
import { useCallback } from "react";
export function useRpc(contract: { name: string }) {
  return useCallback(async (input: unknown) => {
    const response = await fetch("/rpc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: contract.name, input }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return result;
  }, [contract.name]);
}
const samplePaseo = {
  workspaces: {
    list: async () => ({ entries: [{ id: "wks_sample", name: "Sample workspace", directory: "/example/project" }] }),
    ref: () => ({ agents: { create: async () => { throw new Error("Agent creation is disabled in the screenshot preview."); } } })
  },
  providers: { snapshot: async () => ({ entries: [{ provider: "sample", label: "Sample provider", enabled: true, models: [{ id: "sample", label: "Sample model", isSelectable: true }] }] }) }
};
export const usePaseo = () => samplePaseo;
