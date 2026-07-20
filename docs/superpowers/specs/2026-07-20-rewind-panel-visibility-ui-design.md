# Rewind Panel Visibility and UI Design

## Goal

Show Rewind only when the current thread has at least one rewind point, keep its collapsed control compact and aligned, and use the existing Todo panel styling for expanded content.

## Behavior

- Query `x.ai/rewind/points` when the active thread's `RewindPanel` mounts.
- Render nothing while the current thread has no rewind points or rewind is unsupported.
- When points exist, render a compact Rewind button with vertically aligned icons, label, and count.
- Clicking the button expands the current thread's rewind points using the existing Todo card/header visual pattern.
- Keep the existing refresh after each completed turn and after a restore.
- If a refresh leaves the current thread with no rewind points, hide the button again.
- Preserve the existing restore confirmation and operational error handling.

## Architecture

Reuse `useRewindStore`, `listRewindPoints`, and the existing per-thread state. `RewindPanel` performs the mount-time external synchronization with `useEffect`; no polling or new store is needed. Reuse Todo panel CSS where it fits and add only the compact trigger styling that does not already exist.

## Testing

- Verify an empty rewind response leaves the button hidden.
- Verify a non-empty response shows the compact button and count.
- Keep the existing unsupported, confirmed restore, and restore-error coverage.
- Run the focused Rewind tests and `npx tsc --noEmit`; do not run a build.
