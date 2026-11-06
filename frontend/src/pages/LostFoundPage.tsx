import { useState, useEffect, useCallback } from "react";
import { useAppSelector } from "@/hooks";
import apiClient from "@/lib/api-client";
import type { LostFoundItem, ItemType, ItemCategory, ItemStatus } from "@/types/lostFound";
import { LostFoundCard } from "@/components/lostfound/LostFoundCard";
import { CreateLostFoundModal } from "@/components/lostfound/CreateLostFoundModal";
import { ClaimModal } from "@/components/lostfound/ClaimModal";
import { ManageClaimsModal } from "@/components/lostfound/ManageClaimsModal";
import { ItemDetailsModal } from "@/components/lostfound/ItemDetailsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  PackageSearch,
  Search,
  PlusCircle,
  HelpCircle,
  RefreshCw,
  SlidersHorizontal,
  X,
} from "lucide-react";

const CATEGORIES: ItemCategory[] = [
  "Keys",
  "Electronics",
  "Documents/ID",
  "Wallets/Bags",
  "Clothing",
  "Books/Stationery",
  "Accessories",
  "Other",
];

export default function LostFoundPage() {
  const { user } = useAppSelector((state) => state.auth);
  const currentUserId = user?.id || (user?._id as string | undefined);

  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ALL" | "LOST" | "FOUND" | "MY">("ALL");

  // Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("ALL");

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createInitialType, setCreateInitialType] = useState<ItemType>("LOST");
  const [detailsItem, setDetailsItem] = useState<LostFoundItem | null>(null);
  const [claimItem, setClaimItem] = useState<LostFoundItem | null>(null);
  const [manageClaimsItem, setManageClaimsItem] = useState<LostFoundItem | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);

      if (activeTab === "MY") {
        const res = await apiClient.get("/lost-found/my");
        setItems(res.data?.data || []);
      } else {
        const params: Record<string, string> = {};
        if (activeTab === "LOST" || activeTab === "FOUND") {
          params.type = activeTab;
        }
        if (category !== "ALL") {
          params.category = category;
        }
        if (status !== "ALL") {
          params.status = status;
        }
        if (search.trim()) {
          params.search = search.trim();
        }

        const res = await apiClient.get("/lost-found", { params });
        setItems(res.data?.data || []);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load Lost & Found items.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, category, status, search]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleOpenCreate = (type: ItemType) => {
    setCreateInitialType(type);
    setCreateModalOpen(true);
  };

  const handleToggleStatus = async (item: LostFoundItem, newStatus: string) => {
    try {
      await apiClient.patch(`/lost-found/${item._id}/status`, { status: newStatus });
      toast.success(`Item status updated to ${newStatus}`);
      if (detailsItem && detailsItem._id === item._id) {
        setDetailsItem({ ...detailsItem, status: newStatus as ItemStatus });
      }
      fetchItems();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update item status.");
    }
  };

  const handleDeleteItem = async (item: LostFoundItem) => {
    if (!confirm(`Are you sure you want to delete "${item.title}"?`)) return;

    try {
      await apiClient.delete(`/lost-found/${item._id}`);
      toast.success("Post deleted successfully.");
      if (detailsItem?._id === item._id) {
        setDetailsItem(null);
      }
      fetchItems();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete post.");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("ALL");
    setStatus("ALL");
  };

  const hasActiveFilters = search.trim() !== "" || category !== "ALL" || status !== "ALL";

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-8">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-background border p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <PackageSearch className="h-6 w-6 text-primary" />
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Lost & Found Hub
              </h1>
            </div>
            <p className="text-sm text-muted-foreground max-w-xl">
              Lost keys, earphones, or your campus ID? Found something in the mess or library?
              Report it here to quickly connect and safely recover items.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white flex-1 sm:flex-none shadow-sm"
              onClick={() => handleOpenCreate("LOST")}
            >
              <PlusCircle className="h-4 w-4 mr-1.5" />
              Report Lost Item
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-none shadow-sm"
              onClick={() => handleOpenCreate("FOUND")}
            >
              <PlusCircle className="h-4 w-4 mr-1.5" />
              Report Found Item
            </Button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-border/60">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all ${
              activeTab === "ALL"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            All Items
          </button>
          <button
            onClick={() => setActiveTab("LOST")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all ${
              activeTab === "LOST"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            Lost (Looking For)
          </button>
          <button
            onClick={() => setActiveTab("FOUND")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all ${
              activeTab === "FOUND"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            Found (Awaiting Owner)
          </button>
          <button
            onClick={() => setActiveTab("MY")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all ${
              activeTab === "MY"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            My Reported Items
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      {activeTab !== "MY" && (
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by item title, location, or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full md:w-[170px] text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full md:w-[140px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="CLAIMED">Claimed</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                Reset
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={fetchItems}
              title="Refresh feed"
              className="shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      )}

      {/* Items Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-72 rounded-xl bg-muted/40 animate-pulse border border-border/50"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center space-y-3 bg-muted/10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HelpCircle className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold">No items found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {hasActiveFilters
              ? "No items match your active filters. Try adjusting or clearing search terms."
              : activeTab === "MY"
              ? "You haven't reported any lost or found items yet."
              : "No items currently reported in this category. Be the first to post!"}
          </p>
          <div className="pt-2 flex justify-center gap-3">
            {hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear All Filters
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  onClick={() => handleOpenCreate("LOST")}
                >
                  Report Lost
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleOpenCreate("FOUND")}
                >
                  Report Found
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {items.map((item) => (
            <LostFoundCard
              key={item._id}
              item={item}
              currentUserId={currentUserId}
              currentUserRole={user?.role}
              onViewDetails={(it) => setDetailsItem(it)}
              onOpenClaim={(it) => setClaimItem(it)}
              onOpenManageClaims={(it) => setManageClaimsItem(it)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateLostFoundModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={fetchItems}
        initialType={createInitialType}
      />

      <ItemDetailsModal
        item={detailsItem}
        isOpen={Boolean(detailsItem)}
        onClose={() => setDetailsItem(null)}
        currentUserId={currentUserId}
        currentUserRole={user?.role}
        onOpenClaim={(it) => setClaimItem(it)}
        onOpenManageClaims={(it) => setManageClaimsItem(it)}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDeleteItem}
      />

      <ClaimModal
        item={claimItem}
        isOpen={Boolean(claimItem)}
        onClose={() => setClaimItem(null)}
        onClaimSuccess={fetchItems}
      />

      <ManageClaimsModal
        item={manageClaimsItem}
        isOpen={Boolean(manageClaimsItem)}
        onClose={() => setManageClaimsItem(null)}
        onUpdated={() => {
          fetchItems();
          // Update details modal if open
          if (detailsItem && manageClaimsItem && detailsItem._id === manageClaimsItem._id) {
            setDetailsItem(null);
          }
        }}
      />
    </div>
  );
}
