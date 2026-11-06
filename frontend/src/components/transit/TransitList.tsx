import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { useState } from "react";

interface TransitEntry {
  _id: string;
  studentId: {
    _id: string;
    name: string;
    rollNo: string;
    hostelId: string;
    hostelName?: string | null;
    roomNo: string;
  };
  purpose: string;
  transitStatus: "ENTRY" | "EXIT";
  date: string;
  time: string;
  createdAt: string;
  updatedAt: string;
}

interface TransitListProps {
  entries: TransitEntry[];
  listStatus: "idle" | "loading" | "succeeded" | "failed";
  listError: string | null;
  onRefresh: () => void;
}

export function TransitList({
  entries,
  listStatus,
  listError,
  onRefresh,
}: TransitListProps) {
  const user = useAppSelector((s) => s.auth.user);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ENTRY" | "EXIT">(
    "ALL"
  );
  const [hostelFilter, setHostelFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Build unique hostel options using readable hostel names.
  const uniqueHostels = Array.from(
    new Map(
      entries.map((entry) => [
        entry.studentId.hostelId,
        {
          value: entry.studentId.hostelId,
          label: entry.studentId.hostelName ?? entry.studentId.hostelId,
        },
      ])
    ).values()
  ).sort((a, b) => a.label.localeCompare(b.label));

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  };

  const formatTime = (timeStr: string) => {
    return timeStr.slice(0, 5); // HH:MM
  };

  // Filter entries based on search and filters
  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.studentId.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.studentId.rollNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.studentId.hostelName ?? "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      entry.studentId.hostelId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.purpose.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || entry.transitStatus === statusFilter;

    const matchesHostel =
      hostelFilter === "ALL" || entry.studentId.hostelId === hostelFilter;

    const matchesDate =
      !dateFilter ||
      new Date(entry.date).toDateString() === dateFilter.toDateString();

    return matchesSearch && matchesStatus && matchesHostel && matchesDate;
  });

  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setHostelFilter("ALL");
    setDateFilter(undefined);
  };

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEntries.length / ITEMS_PER_PAGE)
  );
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedEntries = filteredEntries.slice(startIndex, endIndex);

  return (
    <Card className="border-0 overflow-visible bg-card shadow-xl">
      <CardHeader className="bg-muted/50 text-foreground space-y-4 pb-6 px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2.5 rounded-xl bg-primary/10 shadow-lg">
                <Users className="size-6 text-primary" />
              </div>
              <span className="font-bold">Transit Register</span>
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              Complete record of all student entry and exit transactions
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={listStatus === "loading"}
            className="shadow-sm"
          >
            <RefreshCw
              className={cn(
                "mr-2 h-4 w-4",
                listStatus === "loading" && "animate-spin"
              )}
            />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search name, roll, hostel..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 border"
            />
          </div>

          {/* Date Filter */}
          <div className="relative">
            <Button
              variant="outline"
              className="w-full h-11 justify-start text-left font-normal"
              onClick={() => setShowCalendar(!showCalendar)}
            >
              <CalendarIcon className="mr-2 size-4" />
              {dateFilter ? (
                new Intl.DateTimeFormat("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }).format(dateFilter)
              ) : (
                <span>Filter by date</span>
              )}
            </Button>
            {showCalendar && (
              <div className="absolute left-0 z-50 mt-2 bg-background border rounded-lg shadow-lg w-72 sm:w-80">
                <Calendar
                  className="w-full"
                  selected={dateFilter}
                  onSelect={(date) => {
                    setDateFilter(date);
                    setShowCalendar(false);
                  }}
                />
              </div>
            )}
          </div>

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onValueChange={(value: "ALL" | "ENTRY" | "EXIT") =>
              setStatusFilter(value)
            }
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ENTRY">Entry Only</SelectItem>
              <SelectItem value="EXIT">Exit Only</SelectItem>
            </SelectContent>
          </Select>

          {/* Hostel Filter (hide for warden) */}
          {user?.role !== "warden" && (
            <Select value={hostelFilter} onValueChange={setHostelFilter}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Filter by hostel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Hostels</SelectItem>
                {uniqueHostels.map((hostel) => (
                  <SelectItem key={hostel.value} value={hostel.value}>
                    {hostel.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Active Filters Display */}
        {(searchTerm ||
          statusFilter !== "ALL" ||
          hostelFilter !== "ALL" ||
          dateFilter) && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-border/30">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Filter className="size-4" />
              <span>
                Showing {filteredEntries.length} of {entries.length} records
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-9 px-4 text-sm font-semibold"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {listStatus === "loading" ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 border-t-gray-900 dark:border-t-white rounded-full animate-spin"></div>
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Loading transit records...
            </p>
          </div>
        ) : listError ? (
          <div className="m-6">
            <div className="flex items-start gap-3 p-5 rounded-xl bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-900">
              <AlertCircle className="size-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                  Error loading records
                </p>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                  {listError}
                </p>
              </div>
            </div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-20 px-4 space-y-4">
            {entries.length === 0 ? (
              <>
                <div className="mx-auto w-20 h-20 bg-linear-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-2xl flex items-center justify-center shadow-lg">
                  <Users className="size-10 text-gray-400 dark:text-gray-600" />
                </div>
                <div className="space-y-2 max-w-md mx-auto">
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    No Transit Records Yet
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Student entry and exit records will appear here once they
                    start logging their transit movements
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto w-20 h-20 bg-linear-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-2xl flex items-center justify-center shadow-lg">
                  <Search className="size-10 text-gray-400 dark:text-gray-600" />
                </div>
                <div className="space-y-2 max-w-md mx-auto">
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    No Matching Records Found
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Try adjusting your search terms or filters to find what
                    you're looking for
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View - Hidden on Mobile */}
            <div className="hidden lg:block overflow-hidden">
              <div className="overflow-x-auto">
                <div className="max-h-[650px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-gray-100 dark:bg-gray-900 z-10 shadow-sm">
                      <TableRow className="border-b-2 border-gray-300 dark:border-gray-700">
                        <TableHead className="w-14 font-bold text-gray-900 dark:text-white">
                          #
                        </TableHead>
                        <TableHead className="font-bold text-gray-900 dark:text-white min-w-[150px]">
                          Student
                        </TableHead>
                        <TableHead className="font-bold text-gray-900 dark:text-white">
                          Roll No
                        </TableHead>
                        <TableHead className="font-bold text-gray-900 dark:text-white">
                          Hostel
                        </TableHead>
                        <TableHead className="font-bold text-gray-900 dark:text-white">
                          Room
                        </TableHead>
                        <TableHead className="font-bold text-gray-900 dark:text-white">
                          Date
                        </TableHead>
                        <TableHead className="font-bold text-gray-900 dark:text-white">
                          Time
                        </TableHead>
                        <TableHead className="font-bold text-gray-900 dark:text-white">
                          Type
                        </TableHead>
                        <TableHead className="font-bold text-gray-900 dark:text-white min-w-[200px]">
                          Purpose
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEntries.map((entry, index) => {
                        const isEntry = entry.transitStatus === "ENTRY";
                        return (
                          <TableRow
                            key={entry._id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-200 dark:border-gray-800"
                          >
                            <TableCell className="font-bold text-gray-500 dark:text-gray-500">
                              {String(startIndex + index + 1).padStart(2, "0")}
                            </TableCell>
                            <TableCell className="font-semibold text-gray-900 dark:text-gray-100">
                              <div className="max-w-[180px] truncate">
                                {entry.studentId.name}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium text-gray-800 dark:text-gray-200">
                              {entry.studentId.rollNo}
                            </TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300">
                              {(entry.studentId.hostelName ?? entry.studentId.hostelId) || 'N/A'}
                            </TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300 text-center">
                              {entry.studentId.roomNo}
                            </TableCell>
                            <TableCell className="font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                              {formatDate(entry.date)}
                            </TableCell>
                            <TableCell className="font-mono text-sm font-semibold text-gray-800 dark:text-gray-200">
                              {formatTime(entry.time)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  isEntry
                                    ? "border-2 border-green-600 text-green-700 dark:border-green-500 dark:text-green-400 font-semibold px-2.5 py-1 text-xs"
                                    : "border-2 border-orange-600 text-orange-700 dark:border-orange-500 dark:text-orange-400 font-semibold px-2.5 py-1 text-xs"
                                }
                              >
                                {entry.transitStatus}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-gray-700 dark:text-gray-300">
                              <div className="text-sm leading-relaxed max-w-md wrap-break-word whitespace-normal">
                                {entry.purpose}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            {/* Mobile Card View - Hidden on Desktop */}
            <div className="lg:hidden p-4 space-y-4 max-h-[650px] overflow-y-auto">
              {paginatedEntries.map((entry, index) => {
                const isEntry = entry.transitStatus === "ENTRY";
                return (
                  <Card
                    key={entry._id}
                    className="border-2 border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-lg transition-all duration-200"
                  >
                    <CardContent className="p-4 space-y-3">
                      {/* Header Row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-linear-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center font-bold text-gray-700 dark:text-gray-300 text-sm shadow-sm">
                            {String(startIndex + index + 1).padStart(2, "0")}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-gray-100 text-base">
                              {entry.studentId.name}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                              {entry.studentId.rollNo}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            isEntry
                              ? "border-2 border-green-600 text-green-700 dark:border-green-500 dark:text-green-400 font-semibold px-2.5 py-1 text-xs"
                              : "border-2 border-orange-600 text-orange-700 dark:border-orange-500 dark:text-orange-400 font-semibold px-2.5 py-1 text-xs"
                          }
                        >
                          {entry.transitStatus}
                        </Badge>
                      </div>

                      {/* Info Grid */}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-gray-800">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">
                            Hostel
                          </p>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                            {(entry.studentId.hostelName ?? entry.studentId.hostelId) || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">
                            Room
                          </p>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                            {entry.studentId.roomNo}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">
                            Date
                          </p>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                            {formatDate(entry.date)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">
                            Time
                          </p>
                          <p className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                            {formatTime(entry.time)}
                          </p>
                        </div>
                      </div>

                      {/* Purpose */}
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-1.5">
                          Purpose
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed wrap-break-word whitespace-normal">
                          {entry.purpose}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
        {/* Pagination Controls */}
        {filteredEntries.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border/30">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to{" "}
              {Math.min(endIndex, filteredEntries.length)} of{" "}
              {filteredEntries.length} records
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
      </CardContent>
    </Card>
  );
}
