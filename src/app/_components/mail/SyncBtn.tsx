import { RefreshCw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

export default function SyncBtn({ isCollapsed }: { isCollapsed: boolean }) {
  const utils = api.useUtils();
  const sync = api.email.syncedHistoryAllUsers.useMutation({
    onSuccess: () => {
      void utils.email.invalidate();
    },
  });
  const backfill = api.email.backFillUpdatesAllUsers.useMutation({
    onSuccess: () => {
      void utils.email.invalidate();
    },
  });

  return (
    <Button
      className={isCollapsed ? "flex h-9 w-9" : `w-full`}
      disabled={sync.isPending || backfill.isPending}
      onClick={() => {
        backfill.mutate();
        sync.mutate();
      }}
    >
      {!isCollapsed ? "Sync" : ""}
      <div
        className={sync.isPending || backfill.isPending ? `animate-spin` : ""}
      >
        <RefreshCw />
      </div>
    </Button>
  );
}
