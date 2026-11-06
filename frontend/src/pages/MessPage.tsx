import { FeedbackDashboard } from "@/components/mess/FeedbackDashboard";
import { FeedbackForm } from "@/components/mess/FeedbackForm";
import { MenuEditor } from "@/components/mess/MenuEditor";
import { TodayMenu } from "@/components/mess/TodayMenu";
import { WeeklyMenu } from "@/components/mess/WeeklyMenu";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppSelector } from "@/hooks";
import apiClient from "@/lib/api-client";
import { AxiosError } from "axios";
import { AlertCircle, BarChart3, Edit, Plus, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface MenuData {
  [day: string]: {
    [mealType: string]: string[];
  };
}

interface FeedbackFormData {
  date: Date;
  mealType: "Breakfast" | "Lunch" | "Snacks" | "Dinner";
  rating: number;
  comment?: string;
}

interface Mess {
  _id: string;
  name: string;
  capacity?: number;
}

function MessPage() {
  const user = useAppSelector((s) => s.auth.user);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

  // Mess list state
  const [messes, setMesses] = useState<Mess[]>([]);
  const [selectedMessId, setSelectedMessId] = useState<string | null>(null);
  const [messListLoading, setMessListLoading] = useState(false);

  const [menu, setMenu] = useState<MenuData | null>(null);
  const [menuStatus, setMenuStatus] = useState<
    "idle" | "loading" | "succeeded" | "failed"
  >("idle");
  const [feedbackStatus, setFeedbackStatus] = useState<
    "idle" | "loading" | "succeeded" | "failed"
  >("idle");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  // Admin/Warden dashboard state
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardView, setDashboardView] = useState<"feedback" | "menu">(
    "feedback"
  );

  // Only students can submit feedback
  const canSubmitFeedback = user?.role === "student";
  const studentAssignedMessId = user?.role === "student" ? user?.messId ?? null : null;
  const studentCanAccessAssignedMess =
    !canSubmitFeedback ||
    (Boolean(studentAssignedMessId) && selectedMessId === studentAssignedMessId);

  // Admins and wardens can view dashboard
  const canViewDashboard =
    user?.role === "collegeAdmin" || user?.role === "warden";

  // Fetch messes for the college
  const fetchMesses = async () => {
    try {
      setMessListLoading(true);
      const response = await apiClient.get("/mess/list");
      const list: Mess[] = response.data.messes || [];
      if (canSubmitFeedback) {
        if (!studentAssignedMessId) {
          setMesses([]);
          setSelectedMessId(null);
          return;
        }

        const assignedMess = list.find((mess) => mess._id === studentAssignedMessId);
        if (assignedMess) {
          setMesses([assignedMess]);
          setSelectedMessId(assignedMess._id);
        } else {
          setMesses([]);
          setSelectedMessId(null);
        }
        return;
      }

      setMesses(list);
      if (list.length > 0 && !selectedMessId) {
        setSelectedMessId(list[0]._id);
      }
    } catch {
      setMesses([]);
      setSelectedMessId(null);
    } finally {
      setMessListLoading(false);
    }
  };

  // Fetch menu for selected mess
  const fetchMenu = async (messId?: string) => {
    const id = messId || selectedMessId;
    if (!id) {
      setMenu(null);
      setMenuStatus("succeeded");
      return;
    }
    try {
      setMenuStatus("loading");
      const response = await apiClient.get(`/mess/menu?messId=${id}`);
      setMenu(response.data.menu || {});
      setMenuStatus("succeeded");
    } catch {
      setMenu(null);
      setMenuStatus("failed");
    }
  };

  // Initial load — fetch messes
  useEffect(() => {
    if (isAuthenticated) {
      fetchMesses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, canSubmitFeedback, studentAssignedMessId]);

  // Fetch menu when selected mess changes
  useEffect(() => {
    if (selectedMessId) {
      fetchMenu(selectedMessId);
    } else {
      setMenu(null);
      setMenuStatus("succeeded");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMessId]);

  useEffect(() => {
    if (feedbackStatus === "succeeded") {
      const timer = setTimeout(() => {
        setFeedbackStatus("idle");
        setFeedbackError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [feedbackStatus]);

  const handleFeedbackSubmit = async (data: FeedbackFormData) => {
    try {
      setFeedbackStatus("loading");
      setFeedbackError(null);

      if (canSubmitFeedback && !studentCanAccessAssignedMess) {
        setFeedbackStatus("failed");
        setFeedbackError(
          "You can submit feedback only for your assigned mess."
        );
        return;
      }

      await apiClient.post("/mess/feedback", {
        date: data.date.toISOString(),
        mealType: data.mealType,
        rating: data.rating,
        comment: data.comment?.trim() || "",
      });

      setFeedbackStatus("succeeded");
    } catch (error) {
      setFeedbackStatus("failed");
      const axiosError = error as AxiosError<{ message?: string }>;
      setFeedbackError(
        axiosError.response?.data?.message || "Failed to submit feedback"
      );
    }
  };

  const handleMessChange = (messId: string) => {
    if (canSubmitFeedback) {
      return;
    }
    setSelectedMessId(messId);
  };

  // Mess selector dropdown
  const MessSelector = () => {
    if (messListLoading) {
      return (
        <div className="text-sm text-muted-foreground animate-pulse">
          Loading messes...
        </div>
      );
    }

    if (messes.length === 0) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg border border-dashed">
          <Store className="size-4" />
          <span>
            {canSubmitFeedback
              ? "No assigned mess found for your account"
              : "No messes registered yet"}
          </span>
        </div>
      );
    }

    if (canSubmitFeedback) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg border border-dashed">
          <Store className="size-4" />
          <span>Assigned mess: {messes[0]?.name || user?.messName || "N/A"}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Store className="size-4 text-muted-foreground shrink-0" />
        <Select value={selectedMessId || ""} onValueChange={handleMessChange}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="Select a mess" />
          </SelectTrigger>
          <SelectContent>
            {messes.map((mess) => (
              <SelectItem key={mess._id} value={mess._id}>
                {mess.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-linear-to-b from-background to-muted/20 flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="size-16 mx-auto text-muted-foreground/50" />
          <div className="space-y-2">
            <p className="text-xl font-semibold text-foreground">
              Authentication Required
            </p>
            <p className="text-sm text-muted-foreground">
              Please login to view the mess menu
              {canSubmitFeedback && " and submit feedback"}
            </p>
          </div>
          <Link to="/login">
            <Button size="lg" className="shadow-lg">
              Login to View Menu
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-muted/5 to-muted/20">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="text-center lg:text-left">
              <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Mess Menu & Feedback
              </h1>
              <p className="text-muted-foreground text-sm">
                {canSubmitFeedback
                  ? "Explore your assigned mess menu and share your dining experience"
                  : canViewDashboard
                  ? "Manage mess menu and view student feedback"
                  : "Explore today's meals and browse the weekly menu schedule"}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Mess Selector */}
              <MessSelector />

              {canSubmitFeedback && studentCanAccessAssignedMess && !showFeedbackForm && (
                <Button
                  onClick={() => setShowFeedbackForm(true)}
                  className="shadow-lg"
                >
                  <Plus className="size-4 mr-2" />
                  Give Feedback
                </Button>
              )}
              {canViewDashboard && !showDashboard && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setShowDashboard(true);
                      setDashboardView("feedback");
                    }}
                    className="shadow-lg"
                  >
                    <BarChart3 className="size-4 mr-2" />
                    View Feedback
                  </Button>
                  <Button
                    onClick={() => {
                      setShowDashboard(true);
                      setDashboardView("menu");
                    }}
                    variant="outline"
                    className="shadow-lg"
                  >
                    <Edit className="size-4 mr-2" />
                    Edit Menu
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Admin/Warden Dashboard View */}
        {canViewDashboard && showDashboard ? (
          <div className="space-y-6">
            {/* Dashboard Toggle */}
            <div className="flex items-center justify-between bg-card border rounded-lg px-4 py-3 shadow-sm">
              <div className="flex gap-2">
                <Button
                  variant={dashboardView === "feedback" ? "default" : "outline"}
                  onClick={() => setDashboardView("feedback")}
                  className="shadow-sm"
                >
                  <BarChart3 className="size-4 mr-2" />
                  Feedback Dashboard
                </Button>
                <Button
                  variant={dashboardView === "menu" ? "default" : "outline"}
                  onClick={() => setDashboardView("menu")}
                  className="shadow-sm"
                >
                  <Edit className="size-4 mr-2" />
                  Menu Editor
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={() => setShowDashboard(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                Back to Menu View
              </Button>
            </div>

            {/* Dashboard Content */}
            {dashboardView === "feedback" ? (
              <FeedbackDashboard selectedMessId={selectedMessId} />
            ) : selectedMessId ? (
              <MenuEditor
                currentMenu={menu}
                messId={selectedMessId}
                onMenuUpdate={() => fetchMenu(selectedMessId)}
              />
            ) : (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <div className="text-center space-y-2">
                  <Store className="size-10 mx-auto opacity-50" />
                  <p className="font-medium">No mess selected</p>
                  <p className="text-sm">
                    {messes.length === 0
                      ? "No messes have been registered yet. Create a mess first."
                      : "Select a mess from the dropdown above to edit its menu."}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : canSubmitFeedback && studentCanAccessAssignedMess && showFeedbackForm ? (
          // Student Layout with Feedback: TodayMenu | WeeklyMenu | FeedbackForm
          <div className="grid gap-6 lg:grid-cols-12 xl:gap-8">
            {/* Today's Menu - Takes 4 columns */}
            <div className="lg:col-span-4">
              <TodayMenu
                selectedDate={selectedDate}
                menu={menu}
                menuStatus={menuStatus}
              />
            </div>

            {/* Weekly Menu - Takes 5 columns */}
            <div className="lg:col-span-5">
              <WeeklyMenu menu={menu} menuStatus={menuStatus} />
            </div>

            {/* Feedback Form - Takes 3 columns, sticky */}
            <div className="lg:col-span-3">
              <div className="sticky top-6">
                <FeedbackForm
                  onSubmit={handleFeedbackSubmit}
                  feedbackStatus={feedbackStatus}
                  feedbackError={feedbackError}
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                  onClose={() => setShowFeedbackForm(false)}
                />
              </div>
            </div>
          </div>
        ) : (
          // Layout without Feedback: TodayMenu | WeeklyMenu
          <div className="grid gap-8 lg:grid-cols-2 max-w-6xl mx-auto">
            <div>
              <TodayMenu
                selectedDate={selectedDate}
                menu={menu}
                menuStatus={menuStatus}
              />
            </div>
            <div>
              <WeeklyMenu menu={menu} menuStatus={menuStatus} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MessPage;
