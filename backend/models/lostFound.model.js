import mongoose from "mongoose";

const claimSubSchema = new mongoose.Schema(
  {
    claimantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    claimantName: {
      type: String,
      required: true,
    },
    claimantEmail: {
      type: String,
      required: true,
    },
    claimantRoom: {
      type: String,
      default: null,
    },
    claimantHostel: {
      type: String,
      default: null,
    },
    proofDescription: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    contactNumber: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED"],
      default: "PENDING",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const lostFoundSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    type: {
      type: String,
      enum: ["LOST", "FOUND"],
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        "Keys",
        "Electronics",
        "Documents/ID",
        "Wallets/Bags",
        "Clothing",
        "Books/Stationery",
        "Accessories",
        "Other",
      ],
      required: true,
      index: true,
    },
    itemImage: {
      type: String,
      default: null,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "College",
      required: true,
      index: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      default: null,
      index: true,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    contactPreferences: {
      allowEmail: { type: Boolean, default: true },
      allowPhone: { type: Boolean, default: false },
      phoneNumber: { type: String, default: null },
      pickupLocation: { type: String, default: null },
    },
    verificationQuestion: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["OPEN", "CLAIMED", "RESOLVED", "EXPIRED"],
      default: "OPEN",
      index: true,
    },
    claims: [claimSubSchema],
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

lostFoundSchema.index({ collegeId: 1, type: 1, status: 1, createdAt: -1 });
lostFoundSchema.index({ title: "text", description: "text", location: "text" });

export default mongoose.model("LostFound", lostFoundSchema);

