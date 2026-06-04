import { pathsEqual } from "@/lib/pathUtils";

export const SIDEBAR_THREADS_PREVIEW = 5;

export function isProjectCwdInList(paths: string[], cwd: string): boolean {
  return paths.some((p) => pathsEqual(p, cwd));
}

export function toggleProjectCwdInList(paths: string[], cwd: string): string[] {
  return isProjectCwdInList(paths, cwd)
    ? paths.filter((p) => !pathsEqual(p, cwd))
    : [...paths, cwd];
}

export function addProjectCwd(paths: string[], cwd: string): string[] {
  return isProjectCwdInList(paths, cwd) ? paths : [...paths, cwd];
}

export function removeProjectCwd(paths: string[], cwd: string): string[] {
  return paths.filter((p) => !pathsEqual(p, cwd));
}