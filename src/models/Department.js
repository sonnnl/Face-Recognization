import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    default: "",
  },
  adminClassCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Phương thức tĩnh để cập nhật số lượng lớp trong khoa
departmentSchema.statics.updateAdminClassCount = async function (departmentId) {
  try {
    const AdminClass = mongoose.model("AdminClass");
    const count = await AdminClass.countDocuments({ department: departmentId });

    await this.findByIdAndUpdate(departmentId, { adminClassCount: count });
    return count;
  } catch (error) {
    console.error("Error updating admin class count for Department:", error);
    throw error;
  }
};

export default mongoose.model("Department", departmentSchema);
