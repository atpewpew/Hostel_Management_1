import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ChangeEvent, FormEvent } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { complaintCategoryOptions } from "./complaintConstants";
import type { ComplaintFormInput } from "./types";

type ComplaintFormProps = {
  form: UseFormReturn<ComplaintFormInput>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  error?: string | null;
  preview: string | null;
  profileLoading: boolean;
  hostelName?: string | null;
  onFilePreview: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function ComplaintForm({
  form,
  onSubmit,
  isSubmitting,
  error,
  preview,
  profileLoading,
  hostelName,
  onFilePreview,
}: ComplaintFormProps) {
  const {
    control,
    register,
    formState: { errors },
  } = form;

  const problemImageRegister = register("problemImage");

  return (
    <Card className="mt-10">
      <CardHeader>
        <CardTitle>Issue details</CardTitle>
        <CardDescription>
          Provide as much context as possible for faster follow-up.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="problemTitle">Title</Label>
            <Input
              id="problemTitle"
              placeholder="Give the issue a concise title"
              {...register("problemTitle")}
            />
            {errors.problemTitle && (
              <p className="text-sm text-destructive">
                {errors.problemTitle.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="problemDescription">Description</Label>
            <Textarea
              id="problemDescription"
              placeholder="Explain the issue, steps to reproduce, and any additional details."
              rows={5}
              {...register("problemDescription")}
            />
            {errors.problemDescription && (
              <p className="text-sm text-destructive">
                {errors.problemDescription.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(value) =>
                      field.onChange(value || undefined)
                    }
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {complaintCategoryOptions
                        .filter((option) => option.value !== "all")
                        .map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.category && (
                <p className="text-sm text-destructive">
                  {errors.category.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Hostel</Label>
              <Controller
                control={control}
                name="hostelId"
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    readOnly
                    className="hidden"
                  />
                )}
              />
              <Input
                value={
                  profileLoading
                    ? "Fetching hostel details…"
                    : hostelName || form.getValues("hostelId") || "Hostel not available"
                }
                readOnly
                placeholder="Hostel"
              />
              {errors.hostelId && (
                <p className="text-sm text-destructive">
                  {errors.hostelId.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Hostel is synced from your profile. Contact administrators if it
                looks incorrect.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="roomNo">Room number</Label>
            <Controller
              control={control}
              name="roomNo"
              render={({ field }) => (
                <Input
                  id="roomNo"
                  {...field}
                  value={field.value ?? ""}
                  readOnly
                  placeholder={
                    profileLoading
                      ? "Fetching room number…"
                      : "Room number not available"
                  }
                />
              )}
            />
            {errors.roomNo && (
              <p className="text-sm text-destructive">
                {errors.roomNo.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Room number comes from your registered profile.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="problemImage">Upload supporting image</Label>
            <Input
              id="problemImage"
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              {...problemImageRegister}
              onChange={(event) => {
                problemImageRegister.onChange(event);
                onFilePreview(event);
              }}
            />
            {errors.problemImage && (
              <p className="text-sm text-destructive">
                {errors.problemImage.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Allowed formats: JPG, JPEG, PNG. Maximum size: 10MB.
            </p>
            {preview && (
              <div className="overflow-hidden rounded-md border border-border/60">
                <img
                  src={preview}
                  alt="Complaint preview"
                  className="max-h-64 w-full object-cover"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} size="lg">
              {isSubmitting ? "Submitting…" : "Submit Complaint"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
