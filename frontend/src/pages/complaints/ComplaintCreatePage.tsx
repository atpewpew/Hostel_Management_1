import { zodResolver } from "@hookform/resolvers/zod";
import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { ComplaintForm } from "@/components/complaints/ComplaintForm";
import type { ComplaintFormInput } from "@/components/complaints/types";
import { updateUser } from "@/features/auth/authSlice";
import type { Complaint } from "@/features/complaints/complaintsSlice";
import {
  createComplaint,
  selectComplaintsState,
} from "@/features/complaints/complaintsSlice";
import { useAppDispatch, useAppSelector } from "@/hooks";
import apiClient from "@/lib/api-client";

const COMPLAINT_IMAGE_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const COMPLAINT_IMAGE_ALLOWED_TYPES = ["image/jpeg", "image/png"];

const createComplaintSchema = z.object({
  problemTitle: z
    .string()
    .trim()
    .min(1, "Title cannot be blank or only spaces")
    .min(5, "Title must be at least 5 characters")
    .max(200, "Title must be under 200 characters")
    .refine((val) => val.trim().length > 0, {
      message: "Title cannot be blank or only spaces",
    }),
  problemDescription: z
    .string()
    .min(10, "Describe the issue so maintenance can act quickly")
    .max(5000, "Description is too long."),
  category: z
    .enum([
      "Electrical",
      "Plumbing",
      "Painting",
      "Carpentry",
      "Cleaning",
      "Internet",
      "Furniture",
      "Pest Control",
      "Student Misconduct",
      "Other",
    ])
    .optional()
    .refine((value) => Boolean(value), "Pick a category"),
  hostelId: z
    .string()
    .min(1, "Hostel is required")
    .optional()
    .refine((value) => Boolean(value), "Hostel is required"),
  roomNo: z
    .string()
    .min(1, "Room number is required")
    .max(10, "Room number seems too long"),
  problemImage: z
    .custom<FileList>((value) => value instanceof FileList, {
      message: "Attach an image to highlight the issue",
    })
    .refine(
      (value) => value instanceof FileList && value.length > 0,
      "Attach an image to highlight the issue"
    )
    .refine(
      (value) =>
        value instanceof FileList &&
        value.length > 0 &&
        COMPLAINT_IMAGE_ALLOWED_TYPES.includes(value.item(0)?.type ?? ""),
      "Only JPG and PNG images are allowed"
    )
    .refine(
      (value) =>
        value instanceof FileList &&
        value.length > 0 &&
        (value.item(0)?.size ?? 0) <= COMPLAINT_IMAGE_MAX_SIZE_BYTES,
      "Image size must be 10MB or smaller"
    ),
});

export type CreateComplaintFormValues = ComplaintFormInput;

function ComplaintCreatePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { createStatus, error } = useAppSelector(selectComplaintsState);
  const authUser = useAppSelector((state) => state.auth.user);

  const [preview, setPreview] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [hasHydratedProfile, setHasHydratedProfile] = useState(false);

  const form = useForm<CreateComplaintFormValues>({
    resolver: zodResolver(createComplaintSchema),
    defaultValues: {
      problemTitle: "",
      problemDescription: "",
      category: undefined,
      hostelId: undefined,
      roomNo: "",
    },
  });

  const { setValue, watch } = form;
  const hostelValue = watch("hostelId");
  const roomNoValue = watch("roomNo");
  const isProfileReady = Boolean(hostelValue && roomNoValue);

  useEffect(() => {
    let isMounted = true;

    const applyProfile = (
      hostelId?: string | null,
      room?: string | null,
      rollNo?: string | null,
      name?: string,
      email?: string,
      role?: string,
      userId?: string
    ) => {
      if (!isMounted) return;
      if (hostelId) {
        setValue("hostelId", hostelId, { shouldDirty: false });
      }
      if (room) {
        setValue("roomNo", room, { shouldDirty: false });
      }
      if (hostelId && room) {
        dispatch(
          updateUser({
            hostelId,
            roomNo: room,
            rollNo: rollNo ?? undefined,
            name: name ?? authUser?.name,
            email: email ?? authUser?.email,
            role: role ?? authUser?.role,
            id: userId ?? authUser?.id,
          })
        );
      }
      setHasHydratedProfile(true);
    };

    if (!hasHydratedProfile && authUser?.hostelId && authUser?.roomNo) {
      applyProfile(
        authUser.hostelId,
        authUser.roomNo,
        authUser.rollNo,
        authUser.name,
        authUser.email,
        authUser.role,
        authUser.id
      );
      return;
    }

    if (hasHydratedProfile) {
      return () => {
        isMounted = false;
      };
    }

    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        const response = await apiClient.get("/auth/me");
        if (!isMounted) return;
        if (response.data?.success) {
          const userData = response.data.user;
          applyProfile(
            userData.hostelId,
            userData.roomNo,
            userData.rollNo,
            userData.name,
            userData.email,
            userData.role,
            userData.userId ?? userData._id
          );
        }
      } catch (profileError) {
        console.error("Failed to load profile", profileError);
      } finally {
        if (isMounted) {
          setProfileLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [authUser, dispatch, hasHydratedProfile, setValue]);

  const handleFilePreview = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.item(0);
    if (file) {
      if (!COMPLAINT_IMAGE_ALLOWED_TYPES.includes(file.type)) {
        form.setError("problemImage", {
          message: "Only JPG and PNG images are allowed",
        });
        setPreview(null);
        toast.error("Only JPG and PNG images are allowed");
        return;
      }
      if (file.size > COMPLAINT_IMAGE_MAX_SIZE_BYTES) {
        form.setError("problemImage", {
          message: "Image size must be 10MB or smaller",
        });
        setPreview(null);
        toast.error("Image is too large. Please upload a file up to 10MB.");
        return;
      }
      form.clearErrors("problemImage");
      const reader = new FileReader();
      reader.onload = () =>
        setPreview(typeof reader.result === "string" ? reader.result : null);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const fileList = values.problemImage as FileList | undefined;
    const file = fileList?.item(0) ?? null;
    if (!file) {
      form.setError("problemImage", {
        message: "Attach an image to highlight the issue",
      });
      toast.error("Please attach an image to highlight the issue");
      return;
    }
    if (!COMPLAINT_IMAGE_ALLOWED_TYPES.includes(file.type)) {
      form.setError("problemImage", {
        message: "Only JPG and PNG images are allowed",
      });
      toast.error("Only JPG and PNG images are allowed");
      return;
    }
    if (file.size > COMPLAINT_IMAGE_MAX_SIZE_BYTES) {
      form.setError("problemImage", {
        message: "Image size must be 10MB or smaller",
      });
      toast.error("Image is too large. Please upload a file up to 10MB.");
      return;
    }

    const { category, hostelId, roomNo } = values;
    if (!category || !hostelId || !roomNo) {
      toast.error(
        "Hostel or category information is missing. Please contact the administrator."
      );
      return;
    }

    const categoryValue = category as Complaint["category"];
    const hostelValue = hostelId as string;
    const roomValue = roomNo as string;

    const resultAction = await dispatch(
      createComplaint({
        problemTitle: values.problemTitle.trim(),
        problemDescription: values.problemDescription.trim(),
        category: categoryValue,
        hostelId: hostelValue,
        roomNo: roomValue,
        file,
      })
    );

    if (createComplaint.fulfilled.match(resultAction)) {
      toast.success("Complaint submitted successfully");
      navigate(`/complaints/${resultAction.payload._id}`);
    } else if (createComplaint.rejected.match(resultAction)) {
      const message =
        resultAction.payload ?? "Failed to submit complaint. Please try again.";
      toast.error(message);
    }
  });

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Link
              to="/complaints"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to complaints
            </Link>
            <h1 className="text-3xl font-bold text-foreground mt-2">
              Submit a Complaint
            </h1>
            <p className="text-muted-foreground">
              Share actionable details and evidence to help wardens resolve your
              request quickly.
            </p>
          </div>
        </div>

        <ComplaintForm
          form={form}
          onSubmit={onSubmit}
          isSubmitting={createStatus === "loading"}
          error={error}
          preview={preview}
          profileLoading={profileLoading || !isProfileReady}
          hostelName={authUser?.hostelName}
          onFilePreview={handleFilePreview}
        />
      </div>
    </div>
  );
}

export default ComplaintCreatePage;
