import { createContext } from "react";

export type OperationErrorContextValue = {
  error: string | null;
  reportError: (message: string, err?: unknown) => void;
  clearError: () => void;
};

export const OperationErrorContext =
  createContext<OperationErrorContextValue | null>(null);
