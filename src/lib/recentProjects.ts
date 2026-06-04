export function pushRecentProject(
  paths: string[],
  cwd: string,
  max = 10,
): string[] {
  return [cwd, ...paths.filter((p) => p !== cwd)].slice(0, max);
}