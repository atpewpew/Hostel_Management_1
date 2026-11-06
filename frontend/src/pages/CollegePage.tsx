import { useEffect, useState } from "react";
import { Building2, Plus, UtensilsCrossed, Shield, Loader2, Trash2, UserPlus } from "lucide-react";
import { useAppSelector } from "@/hooks";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WardenCreateDialog } from "@/components/dashboard/detailed-views/UsersDetailedView/components/dialogs/WardenCreateDialog";
import type { WardenCreateData } from "@/types/users";
import { cn } from "@/lib/utils";

// Types
interface HostelWarden {
  _id: string;
  name: string;
  email: string;
}

interface Hostel {
  _id: string;
  name: string;
  capacity?: number;
  wardens: HostelWarden[];
}

interface Mess {
  _id: string;
  name: string;
  capacity?: number;
}

export default function CollegePage() {
  const { user } = useAppSelector((state) => state.auth);
  const isAdmin = user?.role === "collegeAdmin";

  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [messes, setMesses] = useState<Mess[]>([]);
  const [loading, setLoading] = useState(true);

  // Add hostel dialog
  const [showAddHostel, setShowAddHostel] = useState(false);
  const [newHostelName, setNewHostelName] = useState("");
  const [addingHostel, setAddingHostel] = useState(false);

  // Add mess dialog
  const [showAddMess, setShowAddMess] = useState(false);
  const [newMessName, setNewMessName] = useState("");
  const [addingMess, setAddingMess] = useState(false);

  // Assign warden dialog
  const [assignWardenHostelId, setAssignWardenHostelId] = useState<
    string | null
  >(null);
  const [creatingWarden, setCreatingWarden] = useState(false);

  // Removing warden
  const [removingWardenId, setRemovingWardenId] = useState<string | null>(null);

  // Deleting mess
  const [deletingMessId, setDeletingMessId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [hostelsRes, messesRes] = await Promise.all([
        apiClient.get("/hostel/list"),
        apiClient.get("/mess/list"),
      ]);
      if (hostelsRes.data?.success) setHostels(hostelsRes.data.hostels);
      if (messesRes.data?.success) setMesses(messesRes.data.messes);
    } catch {
      toast.error("Failed to load college data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Add hostel
  const handleAddHostel = async () => {
    if (!newHostelName.trim()) return;
    setAddingHostel(true);
    try {
      const res = await apiClient.post("/hostel/create", {
        name: newHostelName.trim(),
      });
      if (res.data?.success) {
        toast.success("Hostel added successfully");
        setShowAddHostel(false);
        setNewHostelName("");
        fetchData();
      }
    } catch (error: unknown) {
      const msg =
        error &&
        typeof error === "object" &&
        "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : "Failed to add hostel";
      toast.error(msg || "Failed to add hostel");
    } finally {
      setAddingHostel(false);
    }
  };

  // Add mess
  const handleAddMess = async () => {
    if (!newMessName.trim()) return;
    setAddingMess(true);
    try {
      const res = await apiClient.post("/mess/create", {
        name: newMessName.trim(),
      });
      if (res.data?.success) {
        toast.success("Mess added successfully");
        setShowAddMess(false);
        setNewMessName("");
        fetchData();
      }
    } catch (error: unknown) {
      const msg =
        error &&
        typeof error === "object" &&
        "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : "Failed to add mess";
      toast.error(msg || "Failed to add mess");
    } finally {
      setAddingMess(false);
    }
  };

  // Assign warden
  const handleCreateWarden = async (data: WardenCreateData) => {
    setCreatingWarden(true);
    try {
      const res = await apiClient.post("/warden/create", data);
      if (res.data?.success) {
        toast.success("Warden assigned successfully");
        setAssignWardenHostelId(null);
        fetchData();
      }
    } catch (error: unknown) {
      const msg =
        error &&
        typeof error === "object" &&
        "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : "Failed to assign warden";
      toast.error(msg || "Failed to assign warden");
    } finally {
      setCreatingWarden(false);
    }
  };

  // Remove warden
  const handleRemoveWarden = async (wardenId: string) => {
    setRemovingWardenId(wardenId);
    try {
      const res = await apiClient.delete(`/user/${wardenId}`);
      if (res.data?.success) {
        toast.success("Warden removed successfully");
        fetchData();
      }
    } catch (error: unknown) {
      const msg =
        error &&
        typeof error === "object" &&
        "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : "Failed to remove warden";
      toast.error(msg || "Failed to remove warden");
    } finally {
      setRemovingWardenId(null);
    }
  };

  // Delete mess
  const handleDeleteMess = async (messId: string) => {
    setDeletingMessId(messId);
    try {
      const res = await apiClient.delete(`/mess/${messId}`);
      if (res.data?.success) {
        toast.success("Mess deleted successfully");
        fetchData();
      }
    } catch (error: unknown) {
      const msg =
        error &&
        typeof error === "object" &&
        "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : "Failed to delete mess";
      toast.error(msg || "Failed to delete mess");
    } finally {
      setDeletingMessId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">College</h1>
        <p className="text-muted-foreground">
          View all hostels and messes in your college
        </p>
      </div>

      {/* ───────── Hostels ───────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Hostels</h2>
            <Badge variant="secondary" className="ml-1">
              {hostels.length}
            </Badge>
          </div>
          {isAdmin && (
            <Button
              size="sm"
              onClick={() => setShowAddHostel(true)}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add Hostel
            </Button>
          )}
        </div>

        {hostels.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No hostels registered yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hostels.map((hostel) => {
              const isUserHostel = user?.hostelId === hostel._id;
              return (
                <Card
                  key={hostel._id}
                  className={cn(
                    "transition-all",
                    isUserHostel &&
                      "ring-2 ring-primary/60 border-primary/40 shadow-md"
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {hostel.name}
                      </CardTitle>
                      {isUserHostel && (
                        <Badge className="text-xs">Your Hostel</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Wardens */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                        <Shield className="h-3.5 w-3.5" />
                        Wardens
                      </div>
                      {hostel.wardens.length === 0 ? (
                        <p className="text-sm text-muted-foreground/70 italic pl-5">
                          No wardens assigned
                        </p>
                      ) : (
                        <ul className="space-y-1.5 pl-5">
                          {hostel.wardens.map((w) => (
                            <li
                              key={w._id}
                              className="flex items-center justify-between text-sm"
                            >
                              <div>
                                <span className="font-medium">{w.name}</span>
                                <span className="text-muted-foreground ml-2 text-xs">
                                  {w.email}
                                </span>
                              </div>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  disabled={
                                    removingWardenId === w._id ||
                                    hostel.wardens.length <= 1
                                  }
                                  title={
                                    hostel.wardens.length <= 1
                                      ? "Cannot remove the only warden"
                                      : "Remove warden"
                                  }
                                  onClick={() => handleRemoveWarden(w._id)}
                                >
                                  {removingWardenId === w._id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Admin: Assign warden */}
                    {isAdmin && hostel.wardens.length < 2 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5"
                        onClick={() => setAssignWardenHostelId(hostel._id)}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Assign Warden
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ───────── Messes ───────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Messes</h2>
            <Badge variant="secondary" className="ml-1">
              {messes.length}
            </Badge>
          </div>
          {isAdmin && (
            <Button
              size="sm"
              onClick={() => setShowAddMess(true)}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add Mess
            </Button>
          )}
        </div>

        {messes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No messes registered yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {messes.map((mess) => {
              const isUserMess = user?.messId === mess._id;
              return (
                <Card
                  key={mess._id}
                  className={cn(
                    "transition-all",
                    isUserMess &&
                      "ring-2 ring-primary/60 border-primary/40 shadow-md"
                  )}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                        {mess.name}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {isUserMess && (
                          <Badge className="text-xs">Your Mess</Badge>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            disabled={deletingMessId === mess._id}
                            title="Delete mess"
                            onClick={() => handleDeleteMess(mess._id)}
                          >
                            {deletingMessId === mess._id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ───── Add Hostel Dialog ───── */}
      <Dialog open={showAddHostel} onOpenChange={setShowAddHostel}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Hostel</DialogTitle>
            <DialogDescription>
              Create a new hostel for your college.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="hostel-name">Hostel Name</Label>
            <Input
              id="hostel-name"
              value={newHostelName}
              onChange={(e) => setNewHostelName(e.target.value)}
              placeholder="e.g. BH-5"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddHostel();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddHostel(false)}
              disabled={addingHostel}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddHostel}
              disabled={addingHostel || !newHostelName.trim()}
            >
              {addingHostel ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...
                </>
              ) : (
                "Add Hostel"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───── Add Mess Dialog ───── */}
      <Dialog open={showAddMess} onOpenChange={setShowAddMess}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Mess</DialogTitle>
            <DialogDescription>
              Create a new mess for your college.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="mess-name">Mess Name</Label>
            <Input
              id="mess-name"
              value={newMessName}
              onChange={(e) => setNewMessName(e.target.value)}
              placeholder="e.g. Mess C"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddMess();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddMess(false)}
              disabled={addingMess}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddMess}
              disabled={addingMess || !newMessName.trim()}
            >
              {addingMess ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...
                </>
              ) : (
                "Add Mess"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───── Assign Warden Dialog (reuses existing component) ───── */}
      <WardenCreateDialog
        open={!!assignWardenHostelId}
        onClose={() => setAssignWardenHostelId(null)}
        onCreate={handleCreateWarden}
        isLoading={creatingWarden}
        preselectedHostelId={assignWardenHostelId || undefined}
      />
    </div>
  );
}
