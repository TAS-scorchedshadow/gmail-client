import {
  useState,
  createContext,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { type DBThread } from "~/server/types";

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
  });
  return (
    <ThreadContext.Provider value={{ activeThread, setActiveThread }}>
      {children}
    </ThreadContext.Provider>
  );
};

export { ThreadContext };
