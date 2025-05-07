import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import { NextResponse, type NextRequest } from "next/server";

import { createCaller } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a HTTP request (e.g. when you make requests from Client Components).
 */
const createContext = async (req: NextRequest) => {
  return createTRPCContext({
    headers: req.headers,
  });
};

const handler = async (req: NextRequest) => {
  // Create context and caller
  const ctx = await createContext(req);
  const caller = createCaller(ctx);
  try {
    const syncedResponse = await caller.email.syncedHistoryAllUsers();
    return NextResponse.json(syncedResponse, { status: 200 });
  } catch (cause) {
    if (cause instanceof TRPCError) {
      // An error from tRPC occurred
      const httpCode = getHTTPStatusCodeFromError(cause);
      return NextResponse.json(cause.message, { status: httpCode });
    }
    // Another error occurred
    console.error(cause);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
};

export { handler as GET };
