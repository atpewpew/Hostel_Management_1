import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";

import apiClient from "@/lib/api-client";
import type { RootState } from "@/store";

export interface ComplaintComment {
  user: string;
  role: "student" | "warden" | "collegeAdmin";
  message: string;
  createdAt: string;
}

export interface Complaint {
  _id: string;
  problemTitle: string;
  problemDescription: string;
  problemImage: string;
  hostelId: string;
  hostelName?: string | null;
  roomNo: string;
  category:
    | "Electrical"
    | "Plumbing"
    | "Painting"
    | "Carpentry"
    | "Cleaning"
    | "Internet"
    | "Furniture"
    | "Pest Control"
    | "Other";
  studentId: string;
  status: "Pending" | "Resolved" | "Rejected" | "ToBeConfirmed";
  studentStatus: "NotResolved" | "Resolved" | "Rejected";
  studentVerifiedAt: string | null;
  resolvedAt: string | null;
  comments: ComplaintComment[];
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintsFilters {
  query?: string;
  status?: string;
  category?: string;
  hostel?: string;
  from?: string;
  to?: string;
}

interface ComplaintsState {
  items: Complaint[];
  filters: ComplaintsFilters;
  listStatus: "idle" | "loading" | "succeeded" | "failed";
  createStatus: "idle" | "loading" | "succeeded" | "failed";
  detailStatus: "idle" | "loading" | "succeeded" | "failed";
  commentStatus: "idle" | "loading" | "succeeded" | "failed";
  error: string | null;
  selected: Complaint | null;
}

const initialState: ComplaintsState = {
  items: [],
  filters: {},
  listStatus: "idle",
  createStatus: "idle",
  detailStatus: "idle",
  commentStatus: "idle",
  error: null,
  selected: null,
};

const extractErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null) {
    const maybeError = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    return maybeError.response?.data?.message ?? maybeError.message ?? fallback;
  }
  if (typeof error === "string") {
    return error;
  }
  return fallback;
};

const serializeFilters = (filters?: ComplaintsFilters) => {
  if (!filters) return undefined;
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.append(key, value);
    }
  });
  return params.toString() ? params : undefined;
};

export const fetchComplaints = createAsyncThunk<
  Complaint[],
  ComplaintsFilters | undefined,
  { rejectValue: string }
>("complaints/fetchComplaints", async (filters, { rejectWithValue }) => {
  try {
    const params = serializeFilters(filters);
    const response = await apiClient.get("/problem", {
      params,
    });
    if (!response.data?.success) {
      return rejectWithValue(
        response.data?.message ?? "Failed to load complaints"
      );
    }
    return response.data.problems as Complaint[];
  } catch (error: unknown) {
    const message = extractErrorMessage(error, "Failed to load complaints");
    return rejectWithValue(message);
  }
});

export const fetchComplaintById = createAsyncThunk<
  Complaint,
  string,
  { state: RootState; rejectValue: string }
>(
  "complaints/fetchComplaintById",
  async (complaintId, { getState, rejectWithValue }) => {
    const existing = getState().complaints.items.find(
      (complaint) => complaint._id === complaintId
    );
    if (existing) {
      return existing;
    }

    try {
      const response = await apiClient.get("/problem");
      if (!response.data?.success) {
        return rejectWithValue(
          response.data?.message ?? "Failed to load complaint"
        );
      }
      const problem = (response.data.problems as Complaint[]).find(
        (item) => item._id === complaintId
      );
      if (!problem) {
        return rejectWithValue("Complaint not found");
      }
      return problem;
    } catch (error: unknown) {
      const message = extractErrorMessage(error, "Failed to load complaint");
      return rejectWithValue(message);
    }
  }
);

export interface CreateComplaintPayload {
  problemTitle: string;
  problemDescription: string;
  category: Complaint["category"];
  hostelId: string;
  roomNo: string;
  file: File;
}

export const createComplaint = createAsyncThunk<
  Complaint,
  CreateComplaintPayload,
  { rejectValue: string }
>("complaints/createComplaint", async (payload, { rejectWithValue }) => {
  try {
    const formData = new FormData();
    formData.append("problemTitle", payload.problemTitle);
    formData.append("problemDescription", payload.problemDescription);
    formData.append("category", payload.category);
    formData.append("hostelId", payload.hostelId);
    formData.append("roomNo", payload.roomNo);
    formData.append("problemImage", payload.file);

    const response = await apiClient.post("/problem", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (!response.data?.success) {
      return rejectWithValue(
        response.data?.message ?? "Failed to submit complaint"
      );
    }
    return response.data.problem as Complaint;
  } catch (error: unknown) {
    let message = extractErrorMessage(error, "Failed to submit complaint");
    if (message === "Network Error") {
      message =
        "Upload failed. Please check your internet connection, use a JPG/PNG image, and keep file size within 10MB.";
    }
    return rejectWithValue(message);
  }
});

export const addComplaintComment = createAsyncThunk<
  Complaint,
  { complaintId: string; message: string },
  { rejectValue: string }
>(
  "complaints/addComplaintComment",
  async ({ complaintId, message }, { rejectWithValue }) => {
    try {
      const response = await apiClient.post(
        `/problem/${complaintId}/comments`,
        { message }
      );
      if (!response.data?.success) {
        return rejectWithValue(
          response.data?.message ?? "Failed to add comment"
        );
      }
      return response.data.problem as Complaint;
    } catch (error: unknown) {
      const message = extractErrorMessage(error, "Failed to add comment");
      return rejectWithValue(message);
    }
  }
);

export const updateComplaintStatus = createAsyncThunk<
  Complaint,
  { complaintId: string; status: Complaint["status"] },
  { rejectValue: string }
>(
  "complaints/updateComplaintStatus",
  async ({ complaintId, status }, { rejectWithValue }) => {
    try {
      const response = await apiClient.patch(`/problem/${complaintId}/status`, {
        status,
      });
      if (!response.data?.success) {
        return rejectWithValue(
          response.data?.message ?? "Failed to update status"
        );
      }
      return response.data.problem as Complaint;
    } catch (error: unknown) {
      const message = extractErrorMessage(error, "Failed to update status");
      return rejectWithValue(message);
    }
  }
);

export const verifyComplaintResolution = createAsyncThunk<
  Complaint,
  { complaintId: string; studentStatus: Complaint["studentStatus"] },
  { rejectValue: string }
>(
  "complaints/verifyComplaintResolution",
  async ({ complaintId, studentStatus }, { rejectWithValue }) => {
    try {
      const response = await apiClient.patch(`/problem/${complaintId}/verify`, {
        studentStatus,
      });
      if (!response.data?.success) {
        return rejectWithValue(
          response.data?.message ?? "Failed to update verification"
        );
      }
      return response.data.problem as Complaint;
    } catch (error: unknown) {
      const message = extractErrorMessage(
        error,
        "Failed to update verification"
      );
      return rejectWithValue(message);
    }
  }
);

const complaintsSlice = createSlice({
  name: "complaints",
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<ComplaintsFilters>) {
      state.filters = action.payload;
    },
    clearSelected(state) {
      state.selected = null;
      state.detailStatus = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchComplaints.pending, (state) => {
        state.listStatus = "loading";
        state.error = null;
      })
      .addCase(fetchComplaints.fulfilled, (state, action) => {
        state.listStatus = "succeeded";
        state.items = action.payload;
      })
      .addCase(fetchComplaints.rejected, (state, action) => {
        state.listStatus = "failed";
        state.error = action.payload ?? "Unable to load complaints";
      })
      .addCase(fetchComplaintById.pending, (state) => {
        state.detailStatus = "loading";
        state.error = null;
      })
      .addCase(fetchComplaintById.fulfilled, (state, action) => {
        state.detailStatus = "succeeded";
        state.selected = action.payload;
        const index = state.items.findIndex(
          (item) => item._id === action.payload._id
        );
        if (index >= 0) {
          state.items[index] = action.payload;
        } else {
          state.items = [action.payload, ...state.items];
        }
      })
      .addCase(fetchComplaintById.rejected, (state, action) => {
        state.detailStatus = "failed";
        state.error = action.payload ?? "Unable to load complaint";
      })
      .addCase(createComplaint.pending, (state) => {
        state.createStatus = "loading";
        state.error = null;
      })
      .addCase(createComplaint.fulfilled, (state, action) => {
        state.createStatus = "succeeded";
        state.items = [action.payload, ...state.items];
        state.selected = action.payload;
      })
      .addCase(createComplaint.rejected, (state, action) => {
        state.createStatus = "failed";
        state.error = action.payload ?? "Unable to submit complaint";
      })
      .addCase(addComplaintComment.pending, (state) => {
        state.commentStatus = "loading";
        state.error = null;
      })
      .addCase(addComplaintComment.fulfilled, (state, action) => {
        state.commentStatus = "succeeded";
        const updated = action.payload;
        state.selected = updated;
        const index = state.items.findIndex((item) => item._id === updated._id);
        if (index >= 0) {
          state.items[index] = updated;
        }
      })
      .addCase(addComplaintComment.rejected, (state, action) => {
        state.commentStatus = "failed";
        state.error = action.payload ?? "Unable to add comment";
      })
      .addCase(updateComplaintStatus.fulfilled, (state, action) => {
        const updated = action.payload;
        const index = state.items.findIndex((item) => item._id === updated._id);
        if (index >= 0) {
          state.items[index] = updated;
        }
        if (state.selected?._id === updated._id) {
          state.selected = updated;
        }
        state.error = null;
      })
      .addCase(updateComplaintStatus.rejected, (state, action) => {
        state.error = action.payload ?? "Unable to update status";
      })
      .addCase(verifyComplaintResolution.fulfilled, (state, action) => {
        const updated = action.payload;
        state.selected = updated;
        const index = state.items.findIndex((item) => item._id === updated._id);
        if (index >= 0) {
          state.items[index] = updated;
        }
      })
      .addCase(verifyComplaintResolution.rejected, (state, action) => {
        state.error = action.payload ?? "Unable to update verification";
      });
  },
});

export const { setFilters, clearSelected } = complaintsSlice.actions;

export const selectComplaintsState = (state: RootState) => state.complaints;
export const selectComplaints = (state: RootState) => state.complaints.items;
export const selectComplaintById = (state: RootState, id: string) =>
  state.complaints.items.find((complaint) => complaint._id === id) ?? null;

export default complaintsSlice.reducer;
