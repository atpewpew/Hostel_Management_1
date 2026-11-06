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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import type { LostFoundItem } from "@/types/lostFound";
import { AlertCircle, HelpCircle } from "lucide-react";

interface ClaimModalProps {
  item: LostFoundItem | null;
  isOpen: boolean;
  onClose: () => void;
  onClaimSuccess: () => void;
}

export function ClaimModal({
  item,
  isOpen,
  onClose,
  onClaimSuccess,
}: ClaimModalProps) {
  const [proof, setProof] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [loading, setLoading] = useState(false);

  if (!item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (proof.trim().length < 5) {
      toast.error("Please provide at least 5 characters of proof/description.");
      return;
    }

    try {
      setLoading(true);
      await apiClient.post(`/lost-found/${item._id}/claim`, {
        proofDescription: proof.trim(),
        contactNumber: contactNumber.trim() || undefined,
      });

      toast.success(
        item.type === "FOUND"
          ? "Claim submitted! The finder has been notified."
          : "Information sent! The owner has been notified."
      );
      setProof("");
      setContactNumber("");
      onClaimSuccess();
      onClose();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Failed to submit claim. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {item.type === "FOUND" ? "Claim Found Item" : "Report Match / Found"}
          </DialogTitle>
          <DialogDescription>
            {item.type === "FOUND"
              ? `Provide proof that you are the rightful owner of "${item.title}".`
              : `Help the owner of "${item.title}" recover their item.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {item.verificationQuestion && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              <div className="flex items-center gap-2 font-semibold">
                <HelpCircle className="h-4 w-4" />
                <span>Verification Question from Finder:</span>
              </div>
              <p className="mt-1 text-xs italic">{item.verificationQuestion}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="proof">
              {item.type === "FOUND"
                ? "Ownership Proof / Distinguishing Details *"
                : "Where did you see or find it? *"}
            </Label>
            <Textarea
              id="proof"
              placeholder={
                item.type === "FOUND"
                  ? "Describe identifying features, colors, markings, or contents that prove it's yours..."
                  : "Let the owner know where it is, or how they can reach you..."
              }
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              rows={4}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactNumber">
              Your Phone Number (Optional)
            </Label>
            <Input
              id="contactNumber"
              placeholder="e.g. 9876543210"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
            />
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              Shared only with the person who posted this item upon request.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit Claim Proof"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

