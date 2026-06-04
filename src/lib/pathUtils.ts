/** Normalize folder paths for stable comparison (Windows-friendly). */
export function normalizeProjectPath(path: string): string {
  return path.replace(/[/\\]+$/, "").toLowerCase();
}

export function pathsEqual(a: string, b: string): boolean {
  return normalizeProjectPath(a) === normalizeProjectPath(b);
}