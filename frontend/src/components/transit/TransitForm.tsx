import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  CalendarIcon,
  LogIn,
  LogOut,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
} from "lucide-react";

// Helper functions for time selection
const generateHours = () => {
  return Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, "0");
    return { value: hour, label: hour };
  });
};

const generateMinutes = () => {
  return Array.from({ length: 60 }, (_, i) => {
    const minute = i.toString().padStart(2, "0");
    return { value: minute, label: minute };
  });
};

// Form validation schema
const entryExitSchema = z
  .object({
    transitStatus: z.enum(["ENTRY", "EXIT"], {
      required_error: "Please select entry or exit",
    }),
    date: z.date({
      required_error: "Date is required",
    }),
    hour: z.string().min(1, "Hour is required"),
    minute: z.string().min(1, "Minute is required"),
    purpose: z
      .string()
      .max(200, "Purpose cannot exceed 200 characters")
      .optional()
      .refine(
        (val) => !val || /\p{L}/u.test(val),
        "Purpose must contain alphabetic characters"
      ),
  })
  .superRefine((data, ctx) => {
    if (data.transitStatus !== "EXIT") {
      return;
    }

    const purpose = data.purpose?.trim() || "";
    if (purpose.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Purpose must be at least 3 characters for exit",
        path: ["purpose"],
      });
      return;
    }

    if (!/\p{L}/u.test(purpose)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Purpose must contain alphabetic characters",
        path: ["purpose"],
      });
    }
  })
  .refine(
    (data) => {
      const now = new Date();
      const selectedDateTime = new Date(data.date);
      const hours = parseInt(data.hour, 10);
      const minutes = parseInt(data.minute, 10);
      selectedDateTime.setHours(hours, minutes, 0, 0);
      return selectedDateTime >= now;
    },
    {
      message: "Cannot create entry for past date and time. Please select current or future time.",
      path: ["minute"],
    }
  );

type EntryExitFormData = z.infer<typeof entryExitSchema>;

const transitTypes = [
  { value: "EXIT", label: "Exit", icon: LogOut, color: "text-orange-600" },
  { value: "ENTRY", label: "Entry", icon: LogIn, color: "text-green-600" },
] as const;

interface TransitEntry {
  _id: string;
  studentId: {
    _id: string;
    name: string;
    rollNo: string;
    hostelId: string;
    roomNo: string;
  };
  purpose: string;
  transitStatus: "ENTRY" | "EXIT";
  date: string;
  time: string;
  createdAt: string;
  updatedAt: string;
}

interface TransitFormProps {
  onSubmit: (data: { transitStatus: string; date: Date; time: string; purpose?: string }) => Promise<void>;
  createStatus: "idle" | "loading" | "succeeded" | "failed";
  createError: string | null;
  entries?: TransitEntry[];
}


export function TransitForm({ onSubmit, createStatus, createError, entries = [] }: TransitFormProps) {
  const [showCalendar, setShowCalendar] = useState(false);

  const now = new Date();
  const currentHour = now.getHours().toString().padStart(2, "0");
  const currentMinute = now.getMinutes().toString().padStart(2, "0");

  // Get last transit status for the current user
  const lastEntry = entries.length > 0 ? entries[0] : null;
  const lastTransitStatus = lastEntry?.transitStatus;
  const requiredTransitStatus: "ENTRY" | "EXIT" =
    lastTransitStatus === "EXIT" ? "ENTRY" : "EXIT";

  const {
    control,
    handleSubmit: handleFormSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<EntryExitFormData>({
    resolver: zodResolver(entryExitSchema),
    defaultValues: {
      transitStatus: requiredTransitStatus,
      date: new Date(),
      hour: currentHour,
      minute: currentMinute,
      purpose: "",
    },
  });

  const transitStatus = watch("transitStatus");
  const selectedDate = watch("date");
  const selectedHour = watch("hour");
  const selectedMinute = watch("minute");

  useEffect(() => {
    setValue("transitStatus", requiredTransitStatus, {
      shouldValidate: true,
    });
  }, [requiredTransitStatus, setValue]);

  useEffect(() => {
    if (selectedDate) {
      const selected = new Date(selectedDate);
      const today = new Date();
      
      selected.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      
      if (selected.getTime() === today.getTime()) {
        const now = new Date();
        const currentH = now.getHours();
        const currentM = now.getMinutes();
        const selectedH = parseInt(selectedHour || "0", 10);
        const selectedM = parseInt(selectedMinute || "0", 10);
        
        if (selectedH < currentH || (selectedH === currentH && selectedM < currentM)) {
          setValue("hour", currentH.toString().padStart(2, "0"));
          setValue("minute", currentM.toString().padStart(2, "0"));
        }
      }
    }
  }, [selectedDate, selectedHour, selectedMinute, setValue]);

  useEffect(() => {
    if (createStatus === "succeeded") {
      const now = new Date();
      const currentH = now.getHours().toString().padStart(2, "0");
      const currentM = now.getMinutes().toString().padStart(2, "0");
      reset({
        transitStatus: requiredTransitStatus,
        date: now,
        hour: currentH,
        minute: currentM,
        purpose: "",
      });
    }
  }, [createStatus, requiredTransitStatus, reset]);

  const getMinHour = () => {
    const selected = new Date(selectedDate);
    const today = new Date();
    selected.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    if (selected.getTime() === today.getTime()) {
      return new Date().getHours();
    }
    return 0;
  };

  const getMinMinute = () => {
    const selected = new Date(selectedDate);
    const today = new Date();
    selected.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    const currentH = now.getHours();
    const selectedH = parseInt(selectedHour || "0", 10);
    if (selected.getTime() === today.getTime() && selectedH === currentH) {
      return now.getMinutes();
    }
    return 0;
  };

  const isHourDisabled = (hour: number) => hour < getMinHour();
  const isMinuteDisabled = (minute: number) => minute < getMinMinute();

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date < today;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  const handleSubmitForm = async (data: EntryExitFormData) => {
    const timeWithSeconds = `${data.hour}:${data.minute}:00`;
    const normalizedPurpose = data.purpose?.trim();
    await onSubmit({
      transitStatus: data.transitStatus,
      date: data.date,
      time: timeWithSeconds,
      purpose:
        data.transitStatus === "EXIT"
          ? normalizedPurpose
          : normalizedPurpose || undefined,
    });
  };

  return (
    <Card className="border shadow-lg bg-card overflow-hidden hover:shadow-xl transition-all duration-300">
      <CardHeader className="bg-muted/50 text-foreground pb-3 px-4 py-3">
        <div className="flex items-center gap-2">
          {transitStatus === "ENTRY" ? (
            <div className="p-1.5 bg-green-500/10 rounded-lg">
              <LogIn className="h-4 w-4 text-green-600" />
            </div>
          ) : (
            <div className="p-1.5 bg-orange-500/10 rounded-lg">
              <LogOut className="h-4 w-4 text-orange-600" />
            </div>
          )}
          <div>
            <CardTitle className="text-lg font-semibold">
              {transitStatus === "ENTRY" ? "Entry" : "Exit"} Record
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm mt-0.5">
              Submit your {transitStatus.toLowerCase()} details
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-3">
        <form onSubmit={handleFormSubmit(handleSubmitForm)} className="space-y-3">
          {/* Transit Type Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-foreground flex items-center gap-1">
              Type <span className="text-red-500">*</span>
            </Label>
            <Controller
              name="transitStatus"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className="h-9 border focus:border-primary/50 transition-colors text-sm">
                    <SelectValue placeholder="Select entry or exit" />
                  </SelectTrigger>
                  <SelectContent>
                    {transitTypes
                      .filter((type) => type.value === requiredTransitStatus)
                      .map((type) => {
                      const Icon = type.icon;
                      return (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-1.5">
                            <Icon className={cn("size-3", type.color)} />
                            <span className="font-medium text-xs">{type.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              Sequence is enforced automatically: first EXIT, then ENTRY.
            </p>
            {errors.transitStatus && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-2 w-2" />
                {errors.transitStatus.message}
              </p>
            )}
          </div>

          {/* Date Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground flex items-center gap-1">
              <CalendarIcon className="h-2.5 w-2.5" />
              Date <span className="text-red-500">*</span>
            </Label>
            <Controller
              name="date"
              control={control}
              render={({ field }) => (
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full h-7 justify-start text-left font-normal border hover:border-primary/50 transition-colors text-xs",
                      !field.value && "text-muted-foreground"
                    )}
                    onClick={() => setShowCalendar(!showCalendar)}
                  >
                    <CalendarIcon className="mr-2 h-2.5 w-2.5" />
                    {field.value ? formatDate(field.value) : <span>Pick a date</span>}
                  </Button>
                  {showCalendar && (
                    <div className="absolute top-full mt-2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-1 max-w-xs w-full max-h-68 overflow-y-auto">
                      <Calendar
                        selected={field.value}
                        onSelect={(date) => {
                          field.onChange(date);
                          setShowCalendar(false);
                        }}
                        disabled={isDateDisabled}
                        className="rounded-lg text-xs p-0"
                      />
                    </div>
                  )}
                </div>
              )}
            />
            {errors.date && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-2 w-2" />
                {errors.date.message}
              </p>
            )}
          </div>

          {/* Time Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              Time <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="space-y-0.5">
                <Label className="text-xs text-muted-foreground">Hour</Label>
                <Controller
                  name="hour"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="h-7 border focus:border-primary/50 transition-colors text-xs">
                        <SelectValue placeholder="Hour" />
                      </SelectTrigger>
                      <SelectContent className="max-h-40 overflow-y-auto">
                        {generateHours().map((hour) => (
                          <SelectItem 
                            key={hour.value} 
                            value={hour.value}
                            disabled={isHourDisabled(parseInt(hour.value, 10))}
                          >
                            {hour.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.hour && (
                  <p className="text-xs text-red-600">{errors.hour.message}</p>
                )}
              </div>
              <div className="space-y-0.5">
                <Label className="text-xs text-muted-foreground">Minute</Label>
                <Controller
                  name="minute"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="h-7 border focus:border-primary/50 transition-colors text-xs">
                        <SelectValue placeholder="Minute" />
                      </SelectTrigger>
                      <SelectContent className="max-h-40 overflow-y-auto">
                        {generateMinutes().map((minute) => (
                          <SelectItem 
                            key={minute.value} 
                            value={minute.value}
                            disabled={isMinuteDisabled(parseInt(minute.value, 10))}
                          >
                            {minute.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.minute && (
                  <p className="text-xs text-red-600">{errors.minute.message}</p>
                )}
              </div>
            </div>
            {selectedHour && selectedMinute && (
              <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded border">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Selected time: <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedHour}:{selectedMinute}</span>
                </p>
              </div>
            )}
          </div>

          {/* Purpose */}
          {transitStatus === "EXIT" ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Purpose <span className="text-red-500">*</span>
              </Label>
              <Controller
                name="purpose"
                control={control}
                render={({ field }) => {
                  const charCount = field.value?.length || 0;
                  const maxChars = 200;
                  const percentage = (charCount / maxChars) * 100;
                  const counterColor = percentage >= 90 ? 'text-destructive' 
                    : percentage >= 75 ? 'text-yellow-600 dark:text-yellow-500'
                    : 'text-muted-foreground';

                  return (
                    <div className="relative">
                      <Textarea
                        {...field}
                        placeholder="Describe the reason for your exit briefly..."
                        className="min-h-10 max-h-20 border focus:border-primary/50 transition-colors resize-none text-xs pr-16"
                        maxLength={maxChars}
                      />
                      <div className={cn(
                        "absolute bottom-1.5 right-2 text-xs font-medium",
                        counterColor
                      )}>
                        {charCount}/{maxChars}
                      </div>
                    </div>
                  );
                }}
              />
              {errors.purpose && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-2 w-2" />
                  {errors.purpose.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Purpose is required when creating an exit record.
              </p>
            </div>
          ) : (
            <div className="rounded border border-border/60 bg-muted/40 p-2">
              <p className="text-xs text-muted-foreground">
                Purpose is auto-filled from your latest exit record.
              </p>
            </div>
          )}

          {/* Error Display */}
          {createError && (
            <div className="flex items-center gap-1.5 p-1.5 rounded bg-destructive/10 border border-destructive/20">
              <AlertCircle className="size-2.5 text-destructive shrink-0" />
              <p className="text-xs font-medium text-destructive">{createError}</p>
            </div>
          )}

          {/* Success Display */}
          {createStatus === "succeeded" && (
            <div className="flex items-center gap-1.5 p-1.5 rounded bg-green-500/10 border border-green-500/20">
              <CheckCircle className="size-2.5 text-green-600 shrink-0" />
              <p className="text-xs font-medium text-green-600">Record created successfully!</p>
            </div>
          )}

          {/* Submit Button */}
          <Button 
            type="submit" 
            disabled={createStatus === "loading"}
            className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow transition-all duration-200 text-xs"
          >
            {createStatus === "loading" ? (
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                <span className="text-xs">Submitting...</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-2.5 w-2.5" />
                <span className="text-xs">Submit {transitStatus === "ENTRY" ? "Entry" : "Exit"}</span>
              </div>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
