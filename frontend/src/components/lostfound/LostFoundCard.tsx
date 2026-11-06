import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LostFoundItem } from "@/types/lostFound";
import {
  MapPin,
  Clock,
  Key,
  Laptop,
  FileText,
  Wallet,
  Shirt,
  BookOpen,
  Watch,
  HelpCircle,
  Inbox,
  CheckCircle2,
} from "lucide-react";

interface LostFoundCardProps {
  item: LostFoundItem;
  currentUserId?: string;
  currentUserRole?: string;
  onViewDetails: (item: LostFoundItem) => void;
  onOpenClaim: (item: LostFoundItem) => void;
  onOpenManageClaims: (item: LostFoundItem) => void;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "Keys":
      return Key;
    case "Electronics":
      return Laptop;
    case "Documents/ID":
      return FileText;
    case "Wallets/Bags":
      return Wallet;
    case "Clothing":
      return Shirt;
    case "Books/Stationery":
      return BookOpen;
    case "Accessories":
      return Watch;
    default:
      return HelpCircle;
  }
};

export function LostFoundCard({
  item,
  currentUserId,
  currentUserRole,
  onViewDetails,
  onOpenClaim,
  onOpenManageClaims,
}: LostFoundCardProps) {
  const Icon = getCategoryIcon(item.category);
  const isOwner =
    currentUserId &&
    (item.reportedBy._id === currentUserId ||
      ["warden", "collegeAdmin", "manager"].includes(currentUserRole || ""));

  return (
    <Card className="group flex flex-col overflow-hidden transition-all duration-200 hover:shadow-md border-border/80">
      {/* Photo or Icon Header */}
      <div
        className="relative h-44 w-full bg-muted/40 cursor-pointer overflow-hidden flex items-center justify-center"
        onClick={() => onViewDetails(item)}
      >
        {item.itemImage ? (
          <img
            src={item.itemImage}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground/50">
            <Icon className="h-12 w-12 stroke-[1.25]" />
            <span className="text-xs mt-1 font-medium text-muted-foreground/70">
              {item.category}
            </span>
          </div>
        )}

        {/* Type Badge */}
        <div className="absolute top-2.5 left-2.5">
          <Badge
            className={
              item.type === "LOST"
                ? "bg-rose-500 hover:bg-rose-600 text-white font-semibold shadow-sm"
                : "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
            }
          >
            {item.type}
          </Badge>
        </div>

        {/* Status Badge */}
        <div className="absolute top-2.5 right-2.5">
          <Badge
            variant={
              item.status === "OPEN"
                ? "outline"
                : item.status === "CLAIMED"
                ? "default"
                : "secondary"
            }
            className="backdrop-blur bg-background/90 font-medium text-xs shadow-sm"
          >
            {item.status}
          </Badge>
        </div>
      </div>

      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span className="flex items-center gap-1 font-medium">
            <Icon className="h-3 w-3" />
            {item.category}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(item.date).toLocaleDateString()}
          </span>
        </div>
        <h3
          className="font-semibold text-base leading-snug line-clamp-1 hover:text-primary cursor-pointer transition-colors"
          onClick={() => onViewDetails(item)}
        >
          {item.title}
        </h3>
      </CardHeader>

      <CardContent className="p-4 pt-0 flex-1 flex flex-col justify-between">
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {item.description}
        </p>

        <div className="space-y-1.5 pt-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 text-foreground/80 line-clamp-1">
            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>{item.location}</span>
          </div>
          {item.contactPreferences.pickupLocation && (
            <div className="text-[11px] text-muted-foreground italic line-clamp-1">
              Custody: {item.contactPreferences.pickupLocation}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 gap-2 border-t bg-muted/10">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={() => onViewDetails(item)}
        >
          Details
        </Button>

        {isOwner ? (
          (item.claimCount || 0) > 0 ? (
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 text-xs"
              onClick={() => onOpenManageClaims(item)}
            >
              <Inbox className="h-3.5 w-3.5 mr-1" />
              Claims ({item.claimCount})
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground"
              onClick={() => onViewDetails(item)}
            >
              My Post
            </Button>
          )
        ) : item.status === "OPEN" ? (
          item.hasUserClaimed ? (
            <Button
              size="sm"
              variant="outline"
              disabled
              className="flex-1 text-xs text-emerald-600 border-emerald-500/40"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Claimed
            </Button>
          ) : (
            <Button
              size="sm"
              className={`flex-1 text-xs ${
                item.type === "FOUND"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-rose-600 hover:bg-rose-700 text-white"
              }`}
              onClick={() => onOpenClaim(item)}
            >
              {item.type === "FOUND" ? "Claim Item" : "Found This!"}
            </Button>
          )
        ) : null}
      </CardFooter>
    </Card>
  );
}

