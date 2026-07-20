# Image Read Failure Instruction

## Goal

Tell Grok on every prompt that a failed image-file read is expected and that it should inspect the image content already included in the prompt.

## Design

Add one private instruction text block in `TabAcpSession.sendPrompt` before the existing user content blocks. This shared boundary covers the home composer, thread composer, plan revisions, and other callers without changing each caller.

ACP `session/prompt` accepts user content blocks but has no system-role field. The instruction is therefore request-level context: hidden from the app transcript but sent to Grok before the user's text and images.

Keep the existing image-path `readTextFile` fallback. If Grok still attempts the tool call, it continues receiving a benign response rather than a filesystem error.

## Verification

Add one focused test proving `sendPrompt` sends the instruction before the original prompt blocks. Run the focused test and lint/type-check only; do not run a build.

## Scope

No settings UI, configurable prompt, new abstraction, or changes to visible user messages.
