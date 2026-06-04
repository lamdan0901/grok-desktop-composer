import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import {
  extractTurnAssistantRawText,
  isTurnAgentActive,
  isTurnResponseStreaming,
  splitMessagesIntoTurns,
} from "@/lib/chatTurns";
import { coalesceAssistantStreamFragments } from "@/lib/streamChunkMerge";
import {
  groupMessagesForDisplay,
  isActivityLive,
  type DisplayListItem,
} from "@/lib/groupTurnActivity";
import type { ChatMessage, SessionStatus } from "@/lib/types";
import { MessageBubble } from "./MessageBubble";
import { TurnActivitySection } from "./TurnActivitySection";
import { TurnResponseCopy } from "./TurnResponseCopy";

const STICK_TO_BOTTOM_THRESHOLD_PX = 96;

interface MessageListProps {
  messages: ChatMessage[];
  sessionId: string;
  sessionStatus?: SessionStatus;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

function isNearBottom(container: HTMLElement): boolean {
  const distance =
    container.scrollHeight - container.scrollTop - container.clientHeight;
  return distance <= STICK_TO_BOTTOM_THRESHOLD_PX;
}

function scrollContainerToBottom(container: HTMLElement): void {
  container.scrollTop = container.scrollHeight;
}

/** Run scroll after layout; extra frames catch markdown / highlight reflow. */
function scrollAfterLayout(container: HTMLElement, frames = 2): void {
  scrollContainerToBottom(container);
  if (frames <= 0) return;
  let remaining = frames;
  const step = () => {
    scrollContainerToBottom(container);
    remaining -= 1;
    if (remaining > 0) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function isDisplayItemStreaming(
  item: ReturnType<typeof groupMessagesForDisplay>[number],
): boolean {
  if (item.kind === "message") {
    const { message } = item;
    return (
      (message.role === "assistant" || message.role === "thought") &&
      Boolean(message.streaming)
    );
  }
  return isActivityLive(item.items);
}

function isConversationStreaming(items: DisplayListItem[]): boolean {
  const last = items[items.length - 1];
  return last != null && isDisplayItemStreaming(last);
}

function renderDisplayItem(
  item: DisplayListItem,
  turnActive: boolean,
) {
  if (item.kind === "activity") {
    return (
      <div key={item.id} className="message message--activity">
        <TurnActivitySection items={item.items} turnActive={turnActive} />
      </div>
    );
  }
  return <MessageBubble key={item.message.id} message={item.message} />;
}

export function MessageList({
  messages,
  sessionId,
  sessionStatus,
  scrollContainerRef,
}: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const scrollToBottomOnOpenRef = useRef(false);
  const initialScrollPendingRef = useRef(false);

  const markScrollToBottomOnOpen = () => {
    stickToBottomRef.current = true;
    scrollToBottomOnOpenRef.current = true;
    initialScrollPendingRef.current = true;
  };

  const displayMessages = useMemo(
    () => coalesceAssistantStreamFragments(messages),
    [messages],
  );
  const turns = useMemo(
    () => splitMessagesIntoTurns(displayMessages),
    [displayMessages],
  );
  const displayItems = useMemo(
    () => groupMessagesForDisplay(displayMessages),
    [displayMessages],
  );
  const isStreaming = useMemo(
    () => isConversationStreaming(displayItems),
    [displayItems],
  );

  // Layout phase so the scroll effect below sees openScroll=true on first paint.
  useLayoutEffect(() => {
    markScrollToBottomOnOpen();
  }, [sessionId]);

  // Home → chat can keep the same sessionId (first send); session effect alone skips.
  useLayoutEffect(() => {
    markScrollToBottomOnOpen();
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onScroll = () => {
      stickToBottomRef.current = isNearBottom(container);
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [scrollContainerRef, sessionId]);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const openScroll = scrollToBottomOnOpenRef.current;
    if (openScroll && displayItems.length === 0) return;

    if (!openScroll && !stickToBottomRef.current) return;

    if (openScroll) {
      scrollToBottomOnOpenRef.current = false;
      stickToBottomRef.current = true;
      scrollAfterLayout(container, 4);
      return;
    }

    if (isStreaming) {
      scrollAfterLayout(container, 1);
    } else {
      scrollContainerToBottom(container);
    }
  }, [displayItems, isStreaming, scrollContainerRef, sessionId]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const list = listRef.current;
    if (!container || !list) return;
    if (!isStreaming && !initialScrollPendingRef.current) return;

    const ro = new ResizeObserver(() => {
      if (stickToBottomRef.current) {
        scrollContainerToBottom(container);
      }
    });
    ro.observe(list);

    let clearTimer: ReturnType<typeof setTimeout> | undefined;
    if (initialScrollPendingRef.current) {
      clearTimer = setTimeout(() => {
        initialScrollPendingRef.current = false;
      }, 600);
    }

    return () => {
      ro.disconnect();
      if (clearTimer !== undefined) clearTimeout(clearTimer);
    };
  }, [isStreaming, scrollContainerRef, sessionId]);

  return (
    <div className="message-list" ref={listRef}>
      {turns.map((turn, turnIndex) => {
        const isLastTurn = turnIndex === turns.length - 1;
        const turnActive = isTurnAgentActive(turn.messages, {
          sessionStatus: isLastTurn ? sessionStatus : undefined,
        });
        const turnItems = groupMessagesForDisplay(turn.messages);
        const responseText = extractTurnAssistantRawText(turn.messages);
        const showResponseCopy =
          responseText.trim().length > 0 &&
          !isTurnResponseStreaming(turn.messages);

        return (
          <section
            key={turn.id}
            className="chat-turn"
            aria-label={`Turn ${turnIndex + 1}`}
          >
            {turnIndex > 0 && <hr className="chat-turn__divider" />}
            {turnItems.map((item) => renderDisplayItem(item, turnActive))}
            {showResponseCopy && <TurnResponseCopy text={responseText} />}
          </section>
        );
      })}
    </div>
  );
}