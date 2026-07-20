# Conversation Finish Notification Design

## Goal

Notify the user when a conversation response finishes while the application window is unfocused or minimized.

## Behavior

- After a prompt finishes successfully, check the main window focus state.
- When the window is not focused, show a native desktop notification titled `Grok finished responding`.
- Use the conversation title as the notification body.
- Allow the operating system to play its standard notification sound.
- Do nothing while the window is focused.
- Do not notify after cancellation, prompt failure, session-history replay, or internal stream cleanup.

## Architecture

Add one frontend helper that:

1. Reads the current Tauri window focus state.
2. Returns immediately when focused.
3. Checks notification permission and requests it when needed.
4. Sends a native Tauri notification when permission is granted.
5. Silently ignores notification failures so a completed response remains successful.

Call the helper only from the successful `sendPrompt` paths in `Composer` and `HomeView`, after stream finalization. Do not attach notification behavior to `workspaceStore.finalizeAssistantStream`; that shared finalizer is also used by cancellation, errors, replay, and cleanup.

## Native Integration

Install and register Tauri's official notification plugin in the JavaScript and Rust projects. Add its default capability permission for the main window. Reuse `getCurrentWindow().isFocused()` from the already-installed `@tauri-apps/api` package.

No custom sound asset, audio player, settings toggle, notification click handler, or in-app toast is included.

## Error Handling

Notification permission denial, unsupported development behavior, or plugin errors must not change conversation state or surface as a chat error. The notification helper returns without throwing to its callers.

## Testing

Use Vitest to verify the helper:

- sends a notification for an unfocused window with granted permission;
- does nothing for a focused window;
- requests permission when needed and sends only when granted;
- absorbs native notification errors.

Run the focused test, then TypeScript type-check and lint if a lint command exists. Do not use the production build as routine verification.
