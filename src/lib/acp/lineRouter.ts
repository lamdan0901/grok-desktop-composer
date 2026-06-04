const handlersByTab = new Map<string, Set<(line: string) => void>>();

export function subscribeTabLines(
  tabId: string,
  handler: (line: string) => void,
): () => void {
  let handlers = handlersByTab.get(tabId);
  if (!handlers) {
    handlers = new Set();
    handlersByTab.set(tabId, handlers);
  }
  handlers.add(handler);
  return () => {
    handlers!.delete(handler);
    if (handlers!.size === 0) {
      handlersByTab.delete(tabId);
    }
  };
}

export function dispatchTabLine(tabId: string, line: string): void {
  handlersByTab.get(tabId)?.forEach((handler) => handler(line));
}

export function clearTabLineHandlers(tabId: string): void {
  handlersByTab.delete(tabId);
}