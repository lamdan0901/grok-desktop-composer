import type { AnyMessage } from "@agentclientprotocol/sdk";
import type { Stream } from "@agentclientprotocol/sdk";
import { acpWrite } from "@/lib/grok";
import {
  parseAcpLine,
  shouldDeliverAcpMessageToClient,
} from "./acpStreamFilter";
import { subscribeTabLines } from "./lineRouter";

export function createTauriAcpStream(
  tabId: string,
  onClose?: () => void,
): Stream {
  let closed = false;
  let unsubscribe: (() => void) | undefined;

  const readable = new ReadableStream<AnyMessage>({
    start(controller) {
      unsubscribe = subscribeTabLines(tabId, (line) => {
        if (closed) return;
        const message = parseAcpLine(line);
        if (message && shouldDeliverAcpMessageToClient(message)) {
          controller.enqueue(message);
        }
      });
    },
    cancel() {
      closed = true;
      unsubscribe?.();
      onClose?.();
    },
  });

  const writable = new WritableStream<AnyMessage>({
    async write(message) {
      if (closed) return;
      await acpWrite(tabId, JSON.stringify(message));
    },
    close() {
      closed = true;
    },
    abort() {
      closed = true;
      unsubscribe?.();
      onClose?.();
    },
  });

  return { readable, writable };
}