import type { UseInfiniteQueryResult } from "@tanstack/react-query";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { TRPCHookResult } from "@trpc/react-query/shared";
import {
  useState,
  useContext,
  createContext,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { type DBThread } from "~/server/types";
import { api } from "~/trpc/react";

type queryType = TRPCHookResult &
  UseInfiniteQueryResult<
    {
      pages: {
        data: DBThread[];
        cursor: string;
      }[];
      pageParams: (string | null | undefined)[];
    },
    TRPCClientErrorLike<{
      input: {
        maxResults: number;
        cursor?: string | null | undefined;
        q?: string | null | undefined;
      };
      output: {
        data: DBThread[];
        cursor: string;
      };
      transformer: true;
      errorShape: {};
    }>
  >;

// Step 1: Create a Context
const ThreadContext = createContext<
  | {
      query: queryType;
      activeThread: DBThread;
      setActiveThread: Dispatch<SetStateAction<DBThread>>;
    }
  | undefined
>(undefined);

// Step 2: Create a Provider Component
export const ThreadProvider = ({ children }: { children: ReactNode }) => {
  const [activeThread, setActiveThread] = useState<DBThread>({
    id: "default",
    messages: [],
    snippet: "",
  });
  const query = api.email.getThreadsPaginated.useInfiniteQuery(
    {
      maxResults: 25,
    },
    {
      getNextPageParam: (lastPage) => lastPage.cursor,
    },
  );
  return (
    // @ts-ignore
    <ThreadContext.Provider value={{ query, activeThread, setActiveThread }}>
      {children}
    </ThreadContext.Provider>
  );
};

export { ThreadContext };
