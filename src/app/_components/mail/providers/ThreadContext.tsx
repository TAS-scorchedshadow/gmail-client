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

// Step 1: Create a Context
const ThreadContext = createContext<
  | {
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
  return (
    // @ts-ignore
    <ThreadContext.Provider value={{ activeThread, setActiveThread }}>
      {children}
    </ThreadContext.Provider>
  );
};

export { ThreadContext };
