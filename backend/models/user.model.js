import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: [ 'student', 'collegeAdmin', 'warden', 'manager' ],
        default: 'student',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    rollNo: {
        type: String,
        unique: true,
        sparse: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    hostelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hostel'
    },
    messId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Mess'
    },
    collegeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'College',
        index: true
    },
    roomNo: String,
    password: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

userSchema.index({ collegeId: 1, role: 1 });
userSchema.index({ name: "text", rollNo: "text" });

export default mongoose.model('User', userSchema);
