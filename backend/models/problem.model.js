import mongoose from "mongoose";

const commentSubSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: [ "student", "warden", "collegeAdmin" ],
      required: true,
    },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const problemSchema = new mongoose.Schema(
  {
    problemTitle: {
      type: String,
      required: true,
    },
    problemDescription: {
      type: String,
      required: true,
    },
    problemImage: {
      type: String,
      required: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
      index: true,
    },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "College",
      required: true,
      index: true,
    },
    roomNo: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: [
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
      ],
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [ "Pending", "Resolved", "Rejected", "ToBeConfirmed" ],
      default: "Pending",
    },
    studentStatus: {
      type: String,
      enum: [ "NotResolved", "Resolved", "Rejected" ],
      default: "NotResolved",
    },
    studentVerifiedAt: {
      type: Date,
      default: null,
    },
    comments: {
      type: [ commentSubSchema ],
      default: [],
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

problemSchema.index({ collegeId: 1, hostelId: 1, status: 1, createdAt: -1 });
problemSchema.index({ problemTitle: "text", problemDescription: "text" });

export default mongoose.model("Problem", problemSchema);
