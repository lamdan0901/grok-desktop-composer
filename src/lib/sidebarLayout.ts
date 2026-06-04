export const SIDEBAR_WIDTH_DEFAULT = 232;
export const SIDEBAR_WIDTH_MIN = 200;
export const SIDEBAR_WIDTH_MAX = 520;

export function clampSidebarWidth(width: number): number {
  return Math.round(
    Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, width)),
  );
}