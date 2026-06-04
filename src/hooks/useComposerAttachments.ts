import { useCallback, useEffect, useRef, useState } from "react";
import {
  attachmentsFromClipboard,
  filesToComposerAttachments,
  MAX_COMPOSER_ATTACHMENTS,
  type ComposerAttachment,
} from "@/lib/composerAttachments";

export function useComposerAttachments() {
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef(attachments);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const addFiles = useCallback(async (files: Iterable<File>) => {
    setError(null);
    try {
      const added = await filesToComposerAttachments(
        files,
        attachmentsRef.current.length,
      );
      if (!added.length) return;
      setAttachments((prev) => [...prev, ...added].slice(0, MAX_COMPOSER_ATTACHMENTS));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach image");
    }
  }, []);

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const files = attachmentsFromClipboard(e.clipboardData);
      if (!files.length) return false;
      e.preventDefault();
      await addFiles(files);
      return true;
    },
    [addFiles],
  );

  const remove = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    setError(null);
  }, []);

  const clear = useCallback(() => {
    setAttachments([]);
    setError(null);
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      if (list?.length) await addFiles(list);
      e.target.value = "";
    },
    [addFiles],
  );

  const atLimit = attachments.length >= MAX_COMPOSER_ATTACHMENTS;

  return {
    attachments,
    error,
    atLimit,
    fileInputRef,
    addFiles,
    handlePaste,
    remove,
    clear,
    openFilePicker,
    handleFileInputChange,
  };
}