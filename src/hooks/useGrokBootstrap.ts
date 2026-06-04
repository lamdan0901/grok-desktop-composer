import { useEffect } from "react";
import { useGrokStore } from "@/stores/grokStore";

export function useGrokBootstrap() {
  const loaded = useGrokStore((s) => s.loaded);
  const refresh = useGrokStore((s) => s.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return loaded;
}