import {
  useState,
  createContext,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";

// Step 1: Create a Context
const SendModalContext = createContext<
  | {
      open: boolean;
      setOpen: Dispatch<SetStateAction<boolean>>;
    }
  | undefined
>(undefined);

// Step 2: Create a Provider Component
export const SendModalProvider = ({ children }: { children: ReactNode }) => {
  const [activeThread, setActiveThread] = useState<boolean>(false);
  return (
    <SendModalContext value={{ open: activeThread, setOpen: setActiveThread }}>
      {children}
    </SendModalContext>
  );
};

export { SendModalContext };
