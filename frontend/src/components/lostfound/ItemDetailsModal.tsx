import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LostFoundItem } from "@/types/lostFound";
import {
  MapPin,
  Calendar,
  User,
  Mail,
  Phone,
  HelpCircle,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Inbox,
} from "lucide-react";

interface ItemDetailsModalProps {
  item: LostFoundItem | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
  currentUserRole?: string;
  onOpenClaim: (item: LostFoundItem) => void;
  onOpenManageClaims: (item: LostFoundItem) => void;
  onToggleStatus: (item: LostFoundItem, newStatus: string) => void;
  onDelete: (item: LostFoundItem) => void;
}

export function ItemDetailsModal({
  item,
  isOpen,
  onClose,
  currentUserId,
  currentUserRole,
  onOpenClaim,
  onOpenManageClaims,
  onToggleStatus,
  onDelete,
}: ItemDetailsModalProps) {
  if (!item) return null;

  const isOwner =
    currentUserId &&
    (item.reportedBy._id === currentUserId ||
      ["warden", "collegeAdmin", "manager"].includes(currentUserRole || ""));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header photo or category placeholder */}
        {item.itemImage ? (
          <div className="relative h-56 w-full bg-muted overflow-hidden">
            <img
              src={item.itemImage}
              alt={item.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute top-3 left-3 flex gap-2">
              <Badge
                className={
                  item.type === "LOST"
                    ? "bg-rose-500 hover:bg-rose-600 text-white"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }
              >
                {item.type === "LOST" ? "LOST" : "FOUND"}
              </Badge>
              <Badge variant="secondary">{item.category}</Badge>
            </div>
            <div className="absolute top-3 right-3">
              <Badge
                variant={
                  item.status === "OPEN"
                    ? "outline"
                    : item.status === "CLAIMED"
                    ? "default"
                    : "secondary"
                }
                className="bg-background/90 backdrop-blur font-semibold"
              >
                {item.status}
              </Badge>
            </div>
            <div className="absolute bottom-3 left-3 right-3 text-white">
              <h2 className="text-xl font-bold leading-tight">{item.title}</h2>
              <div className="flex items-center gap-3 text-xs text-white/80 mt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {item.location}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(item.date).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 border-b pb-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex gap-2">
                <Badge
                  className={
                    item.type === "LOST"
                      ? "bg-rose-500 hover:bg-rose-600 text-white"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }
                >
                  {item.type === "LOST" ? "LOST" : "FOUND"}
                </Badge>
                <Badge variant="secondary">{item.category}</Badge>
              </div>
              <Badge
                variant={
                  item.status === "OPEN"
                    ? "outline"
                    : item.status === "CLAIMED"
                    ? "default"
                    : "secondary"
                }
              >
                {item.status}
              </Badge>
            </div>
            <DialogTitle className="text-xl font-bold">{item.title}</DialogTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {item.location}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(item.date).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Description
            </h4>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {item.description}
            </p>
          </div>

          {/* Verification question if found */}
          {item.verificationQuestion && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <HelpCircle className="h-4 w-4" />
                <span>Verification Question from Finder:</span>
              </div>
              <p className="text-xs italic text-foreground/90">
                "{item.verificationQuestion}"
              </p>
            </div>
          )}

          {/* Current Custody / Drop-off location */}
          {item.contactPreferences.pickupLocation && (
            <div className="rounded-lg border p-3.5 bg-muted/30">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Current Custody / Pickup Point:</span>
              </div>
              <p className="text-xs font-medium text-foreground">
                {item.contactPreferences.pickupLocation}
              </p>
            </div>
          )}

          {/* Contact Details */}
          <div className="rounded-lg border p-3.5 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Reported By
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 text-foreground/90">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{item.reportedBy.name}</span>
                {item.reportedBy.roomNo && (
                  <span className="text-muted-foreground">
                    (Room {item.reportedBy.roomNo})
                  </span>
                )}
              </div>
              {item.contactPreferences.allowEmail && (
                <div className="flex items-center gap-2 text-foreground/90">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <a
                    href={`mailto:${item.reportedBy.email}`}
                    className="hover:underline text-primary"
                  >
                    {item.reportedBy.email}
                  </a>
                </div>
              )}
              {item.contactPreferences.allowPhone && item.contactPreferences.phoneNumber && (
                <div className="flex items-center gap-2 text-foreground/90">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <a
                    href={`tel:${item.contactPreferences.phoneNumber}`}
                    className="hover:underline font-medium text-primary"
                  >
                    {item.contactPreferences.phoneNumber}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* User's own claim status indicator */}
          {item.hasUserClaimed && (
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-4 w-4" />
              <span>You have submitted a claim proof for this item. Check back soon for status!</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-muted/20 flex flex-wrap items-center justify-between gap-2">
          {isOwner ? (
            <div className="flex flex-wrap items-center gap-2 w-full justify-between">
              <div className="flex gap-2">
                {(item.claimCount || 0) > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onClose();
                      onOpenManageClaims(item);
                    }}
                  >
                    <Inbox className="h-3.5 w-3.5 mr-1" />
                    Review Claims ({item.claimCount})
                  </Button>
                )}
                {item.status === "OPEN" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    onClick={() => onToggleStatus(item, "RESOLVED")}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Mark Resolved
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onToggleStatus(item, "OPEN")}
                  >
                    Reopen Item
                  </Button>
                )}
              </div>

              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(item)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>

              {item.status === "OPEN" && !item.hasUserClaimed && (
                <Button
                  size="sm"
                  className={
                    item.type === "FOUND"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-rose-600 hover:bg-rose-700 text-white"
                  }
                  onClick={() => {
                    onClose();
                    onOpenClaim(item);
                  }}
                >
                  {item.type === "FOUND" ? "This is Mine (Claim)" : "I Found This!"}
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
