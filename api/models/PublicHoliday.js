const mongoose = require('mongoose');

const PublicHolidaySchema = new mongoose.Schema({
  holiday_date: {
    type: Date,
    required: true
  },
  holiday_name: {
    type: String,
    default: null
  },
  year: {
    type: Number,
    required: true
  }
});

module.exports = mongoose.model('PublicHoliday', PublicHolidaySchema);