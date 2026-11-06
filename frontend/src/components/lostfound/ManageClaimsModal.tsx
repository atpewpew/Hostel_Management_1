import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import type { LostFoundItem, ItemClaim } from "@/types/lostFound";
import { Check, X, Mail, Phone, Home, Clock } from "lucide-react";

interface ManageClaimsModalProps {
  item: LostFoundItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function ManageClaimsModal({
  item,
  isOpen,
  onClose,
  onUpdated,
}: ManageClaimsModalProps) {
  const [loadingClaimId, setLoadingClaimId] = useState<string | null>(null);

  if (!item) return null;

  const handleAction = async (claimId: string, action: "ACCEPT" | "REJECT") => {
    try {
      setLoadingClaimId(claimId);
      await apiClient.patch(`/lost-found/${item._id}/claim/${claimId}`, {
        action,
      });

      toast.success(
        action === "ACCEPT"
          ? "Claim accepted! Item marked as CLAIMED."
          : "Claim rejected."
      );
      onUpdated();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Failed to update claim response."
      );
    } finally {
      setLoadingClaimId(null);
    }
  };

  const claims: ItemClaim[] = item.claims || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Claims for "{item.title}"</DialogTitle>
          <DialogDescription>
            Verify proof from students claiming this item before approving the handover.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 py-2 space-y-3">
          {claims.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No claims submitted yet for this item.
            </div>
          ) : (
            claims.map((claim) => (
              <div
                key={claim._id}
                className="rounded-lg border p-4 space-y-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-sm">{claim.claimantName}</h4>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {claim.claimantEmail}
                      </span>
                      {claim.claimantRoom && (
                        <span className="flex items-center gap-1">
                          <Home className="h-3 w-3" />
                          Room {claim.claimantRoom}
                          {claim.claimantHostel ? ` (${claim.claimantHostel})` : ""}
                        </span>
                      )}
                      {claim.contactNumber && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {claim.contactNumber}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(claim.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant={
                      claim.status === "ACCEPTED"
                        ? "default"
                        : claim.status === "REJECTED"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {claim.status}
                  </Badge>
                </div>

                <div className="rounded bg-muted/60 p-2.5 text-xs text-foreground/90">
                  <span className="font-medium text-foreground block mb-0.5">
                    Proof / Description:
                  </span>
                  {claim.proofDescription}
                </div>

                {claim.status === "PENDING" && (
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleAction(claim._id, "REJECT")}
                      disabled={loadingClaimId === claim._id}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleAction(claim._id, "ACCEPT")}
                      disabled={loadingClaimId === claim._id}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Accept & Confirm Owner
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <DialogFooter className="pt-2 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

