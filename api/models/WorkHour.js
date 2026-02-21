const mongoose = require("mongoose");

const timeValidator = {
  validator: function (v) {
    return v === "" || /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
  },
  message: "Time must be in HH:MM format",
};

const WorkHourSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  work_date: {
    type: Date,
    required: true,
  },
  hours_worked: {
    type: Number,
    required: true,
    default: 0,
  },
  clock_in_time: {
    type: String,
    default: "",
    validate: timeValidator,
  },
  // ── NEW FIELD ──────────────────────────────────────────────
  clock_out_time: {
    type: String,
    default: "",
    validate: timeValidator,
  },
  // ──────────────────────────────────────────────────────────
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
  sync_id: {
    type: String,
    default: function () {
      return this._id.toString();
    },
  },
  last_synced: {
    type: Date,
    default: null,
  },
});

// Prevent duplicate records for the same user + date
WorkHourSchema.index({ user: 1, work_date: 1 }, { unique: true });

// Auto-update updated_at on save
WorkHourSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model("WorkHour", WorkHourSchema);
