# Repository Image Prompt Support

**Date:** 2026-07-16  
**Status:** Design  
**Scope:** Make explicit image paths in composer prompts readable by Grok, while keeping duplicate image-file tool calls harmless.

## Goal

When a user asks Grok to read an image that exists in the selected project, the app should load that image and send it as an ACP image block. The user can keep writing a relative path, absolute path under the project, or a path selected through the existing `@` file mention picker.

The existing `fs/read_text_file` contract remains text-only. If Grok redundantly requests that method for the same image, the client returns a short success message instead of attempting UTF-8 decoding and surfacing a binary-file error.

## Current flow and gap

- Clipboard/file-picker images are converted to base64 and sent as ACP `ContentBlock` images by `composerAttachments.ts`.
- File mentions currently insert only a path string into the prompt.
- ACP `fs/read_text_file` delegates to Rust `fs::read_to_string`, which cannot read PNG/JPEG bytes as text.
- ACP supports base64 `ImageContent` blocks for visual context, provided the agent advertises image prompt support.

## Design

### 1. Detect explicit project image paths

At send time, inspect the prompt text for existing image paths. Support:

- relative paths under the active project (`src/assets/logo.png`);
- absolute paths that resolve inside the active project;
- paths inserted by the existing `@` file mention picker.

Recognize common raster/vector extensions (`png`, `jpg`, `jpeg`, `gif`, `webp`, `bmp`, `svg`). Do not scan the repository or guess arbitrary filenames. Non-image text remains a normal prompt. An image-looking path that cannot be resolved is a send error, so a requested image is never silently omitted.

### 2. Load and encode the image

Add one Tauri read command dedicated to images. It resolves the path under the active project root, reads bytes, determines the MIME type from the extension, and returns `{ mimeType, data }`, where `data` is base64. Reject paths outside the project and return a clear error for missing or unreadable files.

The existing text read command is unchanged and remains UTF-8-only.

### 3. Build the prompt

Before clearing composer state or adding the user message, resolve all detected image paths. Append one ACP image block per successfully resolved path to the existing text prompt blocks. Preserve the original path text so the agent and transcript retain the user’s wording.

If an explicitly referenced image cannot be loaded, stop the send and show the load error; do not send a partial prompt that silently omits the requested image.

### 4. Handle duplicate agent reads

In the ACP client `readTextFile` handler, detect image paths by extension before invoking the Rust text command. Return a short text result such as `Image already attached in the prompt; do not read it as text.` This prevents the current binary decoding error. The model may still emit the request; suppressing the request itself is agent-controlled and is not guaranteed by ACP.

### 5. Shared composer behavior

Use the same prompt-building helper for the normal thread composer and the home composer. Clipboard attachments and repository image paths must produce the same ACP image block shape.

## Testing

- Unit test image-path extraction for relative, absolute-in-project, `@`-selected, quoted, nonexistent, and non-image paths.
- Unit test MIME mapping and base64 result handling at the Tauri bridge seam.
- Unit test prompt construction with text plus one or more repository images.
- Unit test `readTextFile` short-circuiting image paths without calling the Rust text command.
- Keep existing text-file reads and clipboard attachment behavior unchanged.

## Non-goals

- No repository-wide image indexing or automatic attachment of every image mentioned in code.
- No change to the ACP `fs/read_text_file` schema.
- No custom agent extension or model-specific tool protocol.
- No guarantee that Grok will never emit a redundant image-file read request.

## Success criteria

1. `Read src/assets/example.png` sends the image bytes to Grok as an ACP image block.
2. The same works for an image selected through `@` file mentions.
3. A duplicate `fs/read_text_file` request for that image produces no binary-read error.
4. Normal text files and clipboard images continue to work.
