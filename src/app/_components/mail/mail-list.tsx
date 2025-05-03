import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import {
  useState,
  type ComponentProps,
  useRef,
  useCallback,
  useEffect,
  type SetStateAction,
  type Dispatch,
  useContext,
} from "react";
import { cn } from "~/lib/utils";
import { mails, type Mail } from "./data";
import { api } from "~/trpc/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import ThreadPreview from "./mail /ThreadPreview";
import { ThreadContext } from "./providers/ThreadContext";
import { useSafeContext } from "./providers/useSafeContext";

interface MailListProps {
  items: Mail[];
}

export function MailList() {
  const { query } = useSafeContext(ThreadContext);
  const {
    status,
    data,
    error,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = query;

  const allRows = data ? data.pages.flatMap((d) => d.data) : [];

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? allRows.length + 1 : allRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  //called on scroll and possibly on mount to fetch more data as the user scrolls and reaches bottom of table
  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        //once the user has scrolled within 500px of the bottom of the table, fetch more data if we can
        if (
          scrollHeight - scrollTop - clientHeight < 200 &&
          !isFetching &&
          hasNextPage
        ) {
          console.log("Fetching More");
          fetchNextPage();
        }
      }
    },
    [fetchNextPage, isFetching, hasNextPage],
  );

  //a check on mount and after a fetch to see if the table is already scrolled to the bottom and immediately needs to fetch more data
  useEffect(() => {
    fetchMoreOnBottomReached(parentRef.current);
  }, [fetchMoreOnBottomReached]);

  if (status === "pending") {
    return <p>Loading...</p>;
  }

  if (status == "error") {
    return <p>Error: {error.message}</p>;
  }

  return (
    <div className="h-full">
      <div
        ref={parentRef}
        onScroll={(e) => fetchMoreOnBottomReached(e.currentTarget)}
        style={{
          height: `500px`,
          width: `100%`,
          overflow: "auto",
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
          }}
          className="relative w-full flex-col"
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const isLoaderRow = virtualRow.index > allRows.length - 1;
            const thread = allRows[virtualRow.index]!;

            return (
              <div
                key={virtualRow.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {isLoaderRow ? (
                  hasNextPage ? (
                    "Loading more..."
                  ) : (
                    "Nothing more to load"
                  )
                ) : (
                  <ThreadPreview thread={thread} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div>
        {isFetching && !isFetchingNextPage ? "Background Updating..." : null}
      </div>
    </div>
  );
}
