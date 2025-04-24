import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  number: {
    type: String,
    required: true,
  },
  floor: {
    type: String,
    required: true,
  },
  building: {
    type: String,
    required: true,
  },
  campus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Campus",
    required: true,
  },
  capacity: {
    type: Number,
    required: true,
  },
  features: {
    hasProjector: {
      type: Boolean,
      default: false,
    },
    hasAirConditioner: {
      type: Boolean,
      default: false,
    },
    hasComputers: {
      type: Boolean,
      default: false,
    },
  },
  description: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Creating a compound index for uniqueness constraint
roomSchema.index(
  { number: 1, floor: 1, building: 1, campus: 1 },
  { unique: true }
);

export default mongoose.model("Room", roomSchema);
