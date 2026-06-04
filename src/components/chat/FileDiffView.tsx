import { useMemo } from "react";
import { FileDiff } from "@pierre/diffs/react";
import { resolveFileDiffMetadata } from "@/lib/fileDiff";
import type { FileDiffSource } from "@/lib/types";
import { useSettingsStore } from "@/stores/settingsStore";

interface FileDiffViewProps {
  source: FileDiffSource;
}

export function FileDiffView({ source }: FileDiffViewProps) {
  const theme = useSettingsStore((s) => s.settings.theme);
  const fileDiff = useMemo(
    () => resolveFileDiffMetadata(source),
    [source.file, source.before, source.after, source.patch],
  );

  return (
    <div className="file-diff-view" data-color-scheme={theme}>
      <FileDiff
        fileDiff={fileDiff}
        disableWorkerPool
        options={{
          theme: theme === "dark" ? "pierre-dark" : "pierre-light",
          themeType: theme,
          diffStyle: "unified",
          disableFileHeader: true,
          overflow: "wrap",
          diffIndicators: "bars",
          lineHoverHighlight: "line",
          hunkSeparators: "line-info-basic",
        }}
        className="file-diff-view__surface"
      />
    </div>
  );
}