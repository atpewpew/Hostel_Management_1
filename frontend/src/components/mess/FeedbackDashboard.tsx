import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppSelector } from "@/hooks";
import apiClient from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { AxiosError } from "axios";
import {
  AlertCircle,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Cookie,
  Filter,
  Loader2,
  MessageSquare,
  Moon,
  RefreshCw,
  Star,
  TrendingUp,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
// pagination component removed — using TransitHistory-style footer instead

interface Feedback {
  _id: string;
  messId?: string | null;
  date: string;
  day: string;
  mealType: string;
  rating: number;
  comment?: string;
  user: {
    name: string;
    email: string;
    rollNo: string;
    hostelId: string;
    hostelName?: string | null;
    roomNo: string;
  };
  createdAt: string;
}

const mealIcons = {
  Breakfast: Coffee,
  Lunch: UtensilsCrossed,
  Snacks: Cookie,
  Dinner: Moon,
};

const mealTypes = ["All", "Breakfast", "Lunch", "Snacks", "Dinner"];
const ratingFilters = ["All", "5", "4", "3", "2", "1"];
const dayOptions = [
  "All",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

interface FeedbackDashboardProps {
  selectedMessId?: string | null;
}

export function FeedbackDashboard({
  selectedMessId,
}: FeedbackDashboardProps) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [filteredFeedbacks, setFilteredFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mealFilter, setMealFilter] = useState("All");
  const [ratingFilter, setRatingFilter] = useState("All");
  const [dayFilter, setDayFilter] = useState("All");
  const [hostelFilter, setHostelFilter] = useState("All");

  const user = useAppSelector((s) => s.auth.user);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [showFromCalendar, setShowFromCalendar] = useState(false);
  const [showToCalendar, setShowToCalendar] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  // Fetch feedbacks (exposed for refresh)
  const fetchFeedbacks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/mess/feedback");
      // Handle both response formats: { feedbacks: [] } or direct array
      const feedbackData = response.data?.feedbacks || response.data || [];
      setFeedbacks(feedbackData);
      setFilteredFeedbacks(feedbackData);
      setError(null);
    } catch (err) {
      console.error("Feedback fetch error:", err);
      const axiosError = err as AxiosError<{ message?: string }>;
      setError(
        axiosError.response?.data?.message || "Failed to load feedbacks"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  // Apply filters
  useEffect(() => {
    let filtered = [...feedbacks];

    if (selectedMessId) {
      filtered = filtered.filter((f) => String(f.messId || "") === selectedMessId);
    }

    if (mealFilter !== "All") {
      filtered = filtered.filter((f) => f.mealType === mealFilter);
    }

    if (dayFilter !== "All") {
      filtered = filtered.filter((f) => f.day === dayFilter);
    }

    // Wardens only see feedback for their assigned hostel
    if (user?.role === "warden" && user.hostelId) {
      filtered = filtered.filter((f) => f.user.hostelId === user.hostelId);
    }

    if (ratingFilter !== "All") {
      filtered = filtered.filter((f) => f.rating === parseInt(ratingFilter));
    }

    if (hostelFilter !== "All") {
      filtered = filtered.filter((f) => f.user.hostelId === hostelFilter);
    }

    if (dateFrom) {
      filtered = filtered.filter((f) => {
        const feedbackDate = new Date(f.date);
        feedbackDate.setHours(0, 0, 0, 0);
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);

        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          return feedbackDate >= fromDate && feedbackDate <= toDate;
        }
        return feedbackDate >= fromDate;
      });
    }

    setFilteredFeedbacks(filtered);
  }, [
    selectedMessId,
    mealFilter,
    ratingFilter,
    hostelFilter,
    dateFrom,
    dateTo,
    dayFilter,
    feedbacks,
    user?.role,
    user?.hostelId,
  ]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMessId, mealFilter, ratingFilter, hostelFilter, dateFrom, dateTo, dayFilter]);

  // Calculate stats
  const calculateStats = () => {
    if (filteredFeedbacks.length === 0) {
      return {
        avgRating: 0,
        totalFeedbacks: 0,
        withComments: 0,
        mealRatings: {} as Record<string, number>,
      };
    }

    const avgRating =
      filteredFeedbacks.reduce((sum, f) => sum + f.rating, 0) /
      filteredFeedbacks.length;

    const withComments = filteredFeedbacks.filter((f) => f.comment).length;

    const mealRatings: Record<string, number> = {};
    mealTypes.slice(1).forEach((meal) => {
      const mealFeedbacks = filteredFeedbacks.filter(
        (f) => f.mealType === meal
      );
      if (mealFeedbacks.length > 0) {
        mealRatings[meal] =
          mealFeedbacks.reduce((sum, f) => sum + f.rating, 0) /
          mealFeedbacks.length;
      }
    });

    return {
      avgRating: parseFloat(avgRating.toFixed(1)),
      totalFeedbacks: filteredFeedbacks.length,
      withComments,
      mealRatings,
    };
  };

  const stats = calculateStats();

  // Pagination derived values
  const totalPages = Math.ceil(filteredFeedbacks.length / ITEMS_PER_PAGE);
  const paginatedFeedbacks = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredFeedbacks.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredFeedbacks, currentPage]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;

  // numbered pagination helper removed — using simple anchored footer for consistency

  // Build unique hostel options using readable names.
  const hostelOptions = [
    { value: "All", label: "All" },
    ...Array.from(
      new Map(
        feedbacks.map((f) => [
          f.user.hostelId,
          {
            value: f.user.hostelId,
            label: f.user.hostelName ?? f.user.hostelId,
          },
        ])
      ).values()
    ).sort((a, b) => a.label.localeCompare(b.label)),
  ];

  // If current user is a warden, force hostel filter to their hostel and don't show the select
  useEffect(() => {
    if (user?.role === "warden" && user.hostelId) {
      setHostelFilter(user.hostelId);
    }
  }, [user]);

  // Clear filters
  const clearFilters = () => {
    setMealFilter("All");
    setRatingFilter("All");
    setDayFilter("All");
    setHostelFilter("All");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasActiveFilters =
    mealFilter !== "All" ||
    ratingFilter !== "All" ||
    hostelFilter !== "All" ||
    dayFilter !== "All" ||
    dateFrom !== undefined ||
    dateTo !== undefined;

  // Format date
  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(dateString));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading feedbacks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md border-destructive/50">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="size-6 text-destructive" />
            </div>
            <div className="text-center space-y-2">
              <p className="font-semibold text-foreground">
                Failed to Load Feedbacks
              </p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards - unified style with TransitStats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Build metrics same pattern as TransitStats */}
        {(
          [
            {
              label: "Average Rating",
              value: stats.avgRating.toFixed(1),
              helper: "Avg across meals",
              icon: TrendingUp,
              tone: "bg-blue-500/10 text-blue-600",
            },
            {
              label: "Total Feedbacks",
              value: stats.totalFeedbacks,
              helper: "All submissions",
              icon: Users,
              tone: "bg-emerald-500/10 text-emerald-600",
            },
            {
              label: "With Comments",
              value: stats.withComments,
              helper: "Contains message",
              icon: MessageSquare,
              tone: "bg-orange-500/10 text-orange-600",
            },
            {
              label: "Meal Ratings",
              value:
                Object.keys(stats.mealRatings).length > 0
                  ? Object.values(stats.mealRatings)[0].toFixed(1)
                  : "-",
              helper: "Example meal avg",
              icon: UtensilsCrossed,
              tone: "bg-purple-500/10 text-purple-600",
            },
          ] as const
        ).map((m) => (
          <Card key={m.label} className="border-border/60">
            <CardContent className="flex items-center justify-between py-6">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  {m.helper}
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {m.value}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{m.label}</p>
              </div>
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full",
                  m.tone
                )}
              >
                <m.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/30 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-primary" />
              <CardTitle className="text-base">Filters</CardTitle>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 text-xs"
              >
                <X className="size-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">From Date</label>
              <div className="relative">
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  onClick={() => setShowFromCalendar(!showFromCalendar)}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {dateFrom ? (
                    new Intl.DateTimeFormat("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }).format(dateFrom)
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
                {showFromCalendar && (
                  <div className="absolute left-0 z-50 mt-2 bg-background border rounded-lg shadow-lg w-72 sm:w-80">
                    <Calendar
                      className="w-full"
                      selected={dateFrom}
                      onSelect={(date) => {
                        setDateFrom(date);
                        setShowFromCalendar(false);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">To Date</label>
              <div className="relative">
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  onClick={() => setShowToCalendar(!showToCalendar)}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {dateTo ? (
                    new Intl.DateTimeFormat("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }).format(dateTo)
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
                {showToCalendar && (
                  <div className="absolute left-0 z-50 mt-2 bg-background border rounded-lg shadow-lg w-72 sm:w-80">
                    <Calendar
                      className="w-full"
                      selected={dateTo}
                      onSelect={(date) => {
                        setDateTo(date);
                        setShowToCalendar(false);
                      }}
                      disabled={(date) => (dateFrom ? date < dateFrom : false)}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Meal Type</label>
              <Select value={mealFilter} onValueChange={setMealFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mealTypes.map((meal) => (
                    <SelectItem key={meal} value={meal}>
                      {meal}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Day</label>
              <Select value={dayFilter} onValueChange={setDayFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dayOptions.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Rating</label>
              <Select value={ratingFilter} onValueChange={setRatingFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ratingFilters.map((rating) => (
                    <SelectItem key={rating} value={rating}>
                      {rating === "All" ? "All Ratings" : `${rating} Stars`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {user?.role !== "warden" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Hostel</label>
                <Select value={hostelFilter} onValueChange={setHostelFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hostelOptions.map((hostel) => (
                      <SelectItem key={hostel.value} value={hostel.value}>
                        {hostel.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Feedback Table */}
      <Card className="shadow-sm relative flex flex-col h-full">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Feedback Submissions</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchFeedbacks}
              disabled={loading}
              className="shadow-sm"
            >
              <RefreshCw
                className={cn("mr-2 h-4 w-4", loading && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent
          className={cn(
            "p-0 flex-1",
            filteredFeedbacks.length > 0 && totalPages > 1 && "pb-0"
          )}
        >
          {filteredFeedbacks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="size-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No feedbacks found
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasActiveFilters
                  ? "Try adjusting your filters"
                  : "Feedbacks will appear here once submitted"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1 pb-16">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Day</TableHead>
                    <TableHead className="font-semibold">Meal</TableHead>
                    <TableHead className="font-semibold">Rating</TableHead>
                    <TableHead className="font-semibold">Student</TableHead>
                    <TableHead className="font-semibold">Hostel</TableHead>
                    <TableHead className="font-semibold">Comment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedFeedbacks.map((feedback) => {
                    const MealIcon =
                      mealIcons[feedback.mealType as keyof typeof mealIcons];
                    return (
                      <TableRow
                        key={feedback._id}
                        className="hover:bg-muted/30"
                      >
                        <TableCell className="text-sm">
                          {formatDate(feedback.date)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {feedback.day}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MealIcon className="size-4 text-muted-foreground" />
                            <span className="text-sm">{feedback.mealType}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star
                                key={i}
                                className={cn(
                                  "size-3.5",
                                  i <= feedback.rating
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground/30"
                                )}
                              />
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">
                              {feedback.user.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {feedback.user.rollNo}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {(feedback.user.hostelName ?? feedback.user.hostelId) || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md">
                          {feedback.comment ? (
                            <p className="text-sm text-muted-foreground wrap-break-word whitespace-normal">
                              {feedback.comment}
                            </p>
                          ) : (
                            <span className="text-xs text-muted-foreground/50 italic">
                              No comment
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>

        {/* Pagination Controls - positioned at bottom of the card */}
        {filteredFeedbacks.length > 0 && totalPages > 1 && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-6 py-3 border-t border-border/30 bg-card">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to{" "}
              {Math.min(endIndex, filteredFeedbacks.length)} of{" "}
              {filteredFeedbacks.length} records
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <div className="text-sm">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage >= totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
