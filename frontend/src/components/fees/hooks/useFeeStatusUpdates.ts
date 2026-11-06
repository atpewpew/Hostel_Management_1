import { updateFeeStatus } from "@/features/fees/feesSlice";
import { useAppDispatch, useAppSelector } from "@/hooks";
import { toast } from "sonner";

export function useFeeStatusUpdates() {
  const dispatch = useAppDispatch();
  const { updateLoading } = useAppSelector((state) => state.fees);

  const handleStatusUpdate = async (
    studentId: string,
    feeType: "hostel" | "mess",
    newStatus: "approved" | "rejected"
  ) => {
    try {
      const updateData: {
        studentId: string;
        hostelFeeStatus?:
          | "documentNotSubmitted"
          | "pending"
          | "approved"
          | "rejected";
        messFeeStatus?:
          | "documentNotSubmitted"
          | "pending"
          | "approved"
          | "rejected";
      } = { studentId };
      
      if (feeType === "hostel") {
        updateData.hostelFeeStatus = newStatus;
      } else {
        updateData.messFeeStatus = newStatus;
      }

      const result = await dispatch(updateFeeStatus(updateData));

      if (updateFeeStatus.fulfilled.match(result)) {
        const feeLabel = feeType === "hostel" ? "Hostel" : "Mess";
        if (newStatus === "rejected") {
          toast.error(`${feeLabel} fee rejected`);
        } else {
          toast.success(`${feeLabel} fee approved successfully`);
        }
      } else {
        const errorMessage = result.payload as string;
        if (
          errorMessage.includes("Forbidden") ||
          errorMessage.includes("403")
        ) {
          toast.error(
            "Only admins can update fee status. Please contact an admin."
          );
        } else {
          toast.error(errorMessage || "Failed to update fee status");
        }
      }
    } catch {
      toast.error("Failed to update fee status");
    }
  };

  const handleApprove = (studentId: string, feeType: "hostel" | "mess") => {
    handleStatusUpdate(studentId, feeType, "approved");
  };

  const handleReject = (studentId: string, feeType: "hostel" | "mess") => {
    handleStatusUpdate(studentId, feeType, "rejected");
  };

  return {
    handleApprove,
    handleReject,
    updateLoading,
  };
}

