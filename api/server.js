const { calculateTax } = require("./taxTable");
// server.js - Express server with MongoDB for Payroll Tracker
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const connectDB = require("./config/db");
const mongoose = require("mongoose");
const moment = require("moment");

// MongoDB models
const User = require("./models/User");
const PayrollPeriod = require("./models/PayrollPeriod");
const WorkHour = require("./models/WorkHour");
const PublicHoliday = require("./models/PublicHoliday");
const RateSetting = require("./models/RateSetting");
const app = express();
const PORT = process.env.PORT || 3003;

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept"],
  })
);

// Database initialisation — only runs if the database is completely empty
async function initializeDatabase() {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log("Database already contains data, skipping initialisation.");
      return;
    }

    console.log("Initialising database with default data...");

    // Default user
    const defaultUser = new User({ username: "default_user" });
    const savedUser = await defaultUser.save();

    // Payroll periods 2026 (fortnightly)
    await PayrollPeriod.insertMany([
      {
        period_label: "Jan 2026 Payroll",
        start_date: "2025-12-22",
        end_date: "2026-01-23",
        year: 2026,
      },
      {
        period_label: "Feb 2026 Payroll",
        start_date: "2026-01-26",
        end_date: "2026-02-20",
        year: 2026,
      },
      {
        period_label: "Mar 2026 Payroll",
        start_date: "2026-02-23",
        end_date: "2026-03-20",
        year: 2026,
      },
      {
        period_label: "Apr 2026 Payroll",
        start_date: "2026-03-23",
        end_date: "2026-04-17",
        year: 2026,
      },
      {
        period_label: "May 2026 Payroll",
        start_date: "2026-04-20",
        end_date: "2026-05-22",
        year: 2026,
      },
      {
        period_label: "Jun 2026 Payroll",
        start_date: "2026-05-25",
        end_date: "2026-06-19",
        year: 2026,
      },
      {
        period_label: "Jul 2026 Payroll",
        start_date: "2026-06-22",
        end_date: "2026-07-24",
        year: 2026,
      },
      {
        period_label: "Aug 2026 Payroll",
        start_date: "2026-07-27",
        end_date: "2026-08-21",
        year: 2026,
      },
      {
        period_label: "Sep 2026 Payroll",
        start_date: "2026-08-24",
        end_date: "2026-09-18",
        year: 2026,
      },
      {
        period_label: "Oct 2026 Payroll",
        start_date: "2026-09-21",
        end_date: "2026-10-23",
        year: 2026,
      },
      {
        period_label: "Nov 2026 Payroll",
        start_date: "2026-10-26",
        end_date: "2026-11-20",
        year: 2026,
      },
      {
        period_label: "Dec 2026 Payroll",
        start_date: "2026-11-23",
        end_date: "2026-12-18",
        year: 2026,
      },
    ]);

    // NSW public holidays 2026
    // Source: https://www.nsw.gov.au/about-nsw/public-holidays
    await PublicHoliday.insertMany([
      {
        holiday_date: "2026-01-01",
        holiday_name: "New Year's Day",
        year: 2026,
      },
      { holiday_date: "2026-01-26", holiday_name: "Australia Day", year: 2026 },
      { holiday_date: "2026-04-03", holiday_name: "Good Friday", year: 2026 },
      {
        holiday_date: "2026-04-04",
        holiday_name: "Easter Saturday",
        year: 2026,
      },
      { holiday_date: "2026-04-05", holiday_name: "Easter Sunday", year: 2026 },
      { holiday_date: "2026-04-06", holiday_name: "Easter Monday", year: 2026 },
      {
        holiday_date: "2026-04-27",
        holiday_name: "ANZAC Day (Additional Day)",
        year: 2026,
      },
      {
        holiday_date: "2026-06-08",
        holiday_name: "King's Birthday",
        year: 2026,
      },
      { holiday_date: "2026-10-05", holiday_name: "Labour Day", year: 2026 },
      { holiday_date: "2026-12-25", holiday_name: "Christmas Day", year: 2026 },
      {
        holiday_date: "2026-12-28",
        holiday_name: "Boxing Day (Additional Day)",
        year: 2026,
      },
    ]);

    // Default hourly rate: AUD $30.00
    await new RateSetting({
      hourly_rate: 30.0,
      effective_from: "2026-01-01",
      user: savedUser._id,
    }).save();

    console.log("Database initialised successfully!");
  } catch (error) {
    console.error("Error initialising database:", error);
  }
}

initializeDatabase();

// ─── API Routes ───────────────────────────────────────────────────────────────

// Get all payroll periods
app.get("/api/payroll-periods", async (req, res) => {
  try {
    const periods = await PayrollPeriod.find().sort({ start_date: 1 });
    res.json(periods);
  } catch (error) {
    console.error("Error fetching payroll periods:", error);
    res.status(500).json({ error: "Error fetching payroll periods" });
  }
});

// Get current payroll period
app.get("/api/current-payroll-period", async (req, res) => {
  try {
    const today = new Date();
    const currentPeriod = await PayrollPeriod.findOne({
      start_date: { $lte: today },
      end_date: { $gte: today },
    });
    // Fallback: return the first available period
    const result =
      currentPeriod || (await PayrollPeriod.findOne().sort({ start_date: 1 }));
    res.json(result || null);
  } catch (error) {
    console.error("Error fetching current payroll period:", error);
    res.status(500).json({ error: "Error fetching current payroll period" });
  }
});

// Get work hours for a specific period
app.get("/api/work-hours/:userId/:periodId", async (req, res) => {
  try {
    const { userId, periodId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const period = await PayrollPeriod.findById(periodId);
    if (!period) return res.status(404).json({ error: "Period not found" });

    const holidays = await PublicHoliday.find({
      holiday_date: { $gte: period.start_date, $lte: period.end_date },
    });
    const holidayDates = holidays.map(
      (h) => h.holiday_date.toISOString().split("T")[0]
    );

    // Generate all dates in the period, including Sundays
    const days = [];
    for (
      let day = new Date(period.start_date);
      day <= new Date(period.end_date);
      day.setDate(day.getDate() + 1)
    ) {
      days.push(day.toISOString().split("T")[0]);
    }

    const workHours = await WorkHour.find({
      user: userId,
      work_date: { $gte: period.start_date, $lte: period.end_date },
    });

    const workHoursMap = {};
    workHours.forEach((wh) => {
      workHoursMap[wh.work_date.toISOString().split("T")[0]] = wh;
    });

    const formattedWorkHours = days.map((dateStr) => {
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      const wh = workHoursMap[dateStr];
      return {
        date: dateStr,
        dayOfWeek,
        isHoliday: holidayDates.includes(dateStr),
        isSaturday: dayOfWeek === 6,
        isSunday: dayOfWeek === 0, // ← NOVO
        dayName: date.toLocaleDateString("en-US", { weekday: "long" }),
        formattedDate: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        hours: wh ? wh.hours_worked : 0,
        clock_in_time: wh?.clock_in_time || "",
        clock_out_time: wh?.clock_out_time || "", // ← NOVO
        sync_id: wh?.sync_id || null,
      };
    });

    res.json(formattedWorkHours);
  } catch (error) {
    console.error("Error fetching work hours:", error);
    res.status(500).json({ error: "Error fetching work hours" });
  }
});

// Save or update work hours for a specific date
app.post("/api/work-hours", async (req, res) => {
  try {
    const { userId, workDate, hours, clockInTime, clockOutTime, sync_id } =
      req.body;

    if (!userId || !workDate || hours === undefined) {
      return res.status(400).json({ error: "Incomplete data" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    let workHour = await WorkHour.findOne({
      user: userId,
      work_date: new Date(workDate),
    });

    if (workHour) {
      workHour.hours_worked = hours;
      workHour.clock_in_time = clockInTime || workHour.clock_in_time;
      workHour.clock_out_time =
        clockOutTime !== undefined ? clockOutTime : workHour.clock_out_time; // ← NOVO
      workHour.updated_at = new Date();
      workHour.last_synced = new Date();
      if (sync_id) workHour.sync_id = sync_id;
      await workHour.save();
    } else {
      workHour = await new WorkHour({
        user: userId,
        work_date: workDate,
        hours_worked: hours,
        clock_in_time: clockInTime || "",
        clock_out_time: clockOutTime || "", // ← NOVO
        last_synced: new Date(),
        sync_id: sync_id || undefined,
      }).save();
    }

    res.json({
      success: true,
      work_hour: {
        ...workHour.toObject(),
        date: workHour.work_date.toISOString().split("T")[0],
      },
    });
  } catch (error) {
    console.error("Error saving work hours:", error);
    res.status(500).json({ error: "Error saving work hours" });
  }
});

// Sync multiple work hours records (offline support)
app.post("/api/sync-work-hours", async (req, res) => {
  try {
    const { userId, hours } = req.body;

    if (!userId || !Array.isArray(hours)) {
      return res.status(400).json({ error: "Incomplete data" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const results = [];

    for (const hourData of hours) {
      const {
        workDate,
        hours: hoursWorked,
        clockInTime,
        clockOutTime,
        sync_id,
      } = hourData;

      if (!workDate || hoursWorked === undefined || !sync_id) {
        results.push({
          success: false,
          sync_id,
          error: "Incomplete data for this record",
        });
        continue;
      }

      try {
        let workHour = await WorkHour.findOne({
          user: userId,
          work_date: new Date(workDate),
        });

        if (workHour) {
          // Only update if client record is newer
          const clientUpdatedAt = new Date(hourData.updated_at || 0);
          if (clientUpdatedAt > new Date(workHour.updated_at || 0)) {
            workHour.hours_worked = hoursWorked;
            workHour.clock_in_time = clockInTime || workHour.clock_in_time;
            workHour.clock_out_time =
              clockOutTime !== undefined
                ? clockOutTime
                : workHour.clock_out_time;
            workHour.updated_at = new Date();
            workHour.last_synced = new Date();
            workHour.sync_id = sync_id;
            await workHour.save();
          }
        } else {
          workHour = await new WorkHour({
            user: userId,
            work_date: workDate,
            hours_worked: hoursWorked,
            clock_in_time: clockInTime || "",
            clock_out_time: clockOutTime || "", // ← NOVO
            last_synced: new Date(),
            sync_id,
          }).save();
        }

        results.push({
          success: true,
          sync_id,
          date: workDate,
          server_updated_at: workHour.updated_at,
        });
      } catch (err) {
        results.push({ success: false, sync_id, error: err.message });
      }
    }

    res.json({ results });
  } catch (error) {
    console.error("Error syncing work hours:", error);
    res.status(500).json({ error: "Error syncing work hours" });
  }
});

// Calculate weekly statistics for a payroll period
app.get("/api/weekly-stats/:userId/:periodId", async (req, res) => {
  try {
    const { userId, periodId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const period = await PayrollPeriod.findById(periodId);
    if (!period) return res.status(404).json({ error: "Period not found" });

    // Fetch the user's hourly rate, fallback to $30.00
    const rateSetting = await RateSetting.findOne({ user: userId }).sort({
      effective_from: -1,
    });
    const hourlyRate = rateSetting ? rateSetting.hourly_rate : 30.0;

    const workHours = await WorkHour.find({
      user: userId,
      work_date: { $gte: period.start_date, $lte: period.end_date },
    });

    const holidays = await PublicHoliday.find({
      holiday_date: { $gte: period.start_date, $lte: period.end_date },
    });
    const holidayDates = holidays.map(
      (h) => h.holiday_date.toISOString().split("T")[0]
    );

    const weekMap = new Map();
    let currentDate = new Date(period.start_date);
    const endDate = new Date(period.end_date);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split("T")[0];
      const dayOfWeek = currentDate.getUTCDay();

      const isHoliday = holidayDates.includes(dateStr);
      const isSaturday = dayOfWeek === 6;
      const isSunday = dayOfWeek === 0;

      const monday = new Date(currentDate);
      monday.setUTCHours(0, 0, 0, 0);
      monday.setUTCDate(monday.getUTCDate() - ((dayOfWeek + 6) % 7));
      const mondayStr = monday.toISOString().split("T")[0];

      // Week ends on Sunday (Monday + 6), was Saturday (Monday + 5)
      const sunday = new Date(monday);
      sunday.setUTCDate(sunday.getUTCDate() + 6);
      const sundayStr = sunday.toISOString().split("T")[0];

      if (!weekMap.has(mondayStr)) {
        weekMap.set(mondayStr, {
          start: mondayStr,
          end: sundayStr,
          days: [],
          totalHours: 0,
          grossSalary: 0,
        });
      }

      const week = weekMap.get(mondayStr);
      const wh = workHours.find(
        (w) => w.work_date.toISOString().split("T")[0] === dateStr
      );
      const hours = wh ? wh.hours_worked : 0;

      week.days.push({
        date: dateStr,
        dayOfWeek,
        isHoliday,
        isSaturday,
        isSunday,
        hours,
      });
      week.totalHours += hours;
      week.grossSalary += hours * hourlyRate;

      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    const weeklyStats = Array.from(weekMap.values()).sort(
      (a, b) => new Date(a.start) - new Date(b.start)
    );
    const totalGrossSalary = weeklyStats.reduce(
      (sum, w) => sum + w.grossSalary,
      0
    );

    const totalTax = calculateTax(totalGrossSalary);

    // Distribute tax proportionally across weeks
    weeklyStats.forEach((week) => {
      week.tax =
        totalGrossSalary > 0
          ? (week.grossSalary / totalGrossSalary) * totalTax
          : 0;
      week.totalSalary = week.grossSalary - week.tax;
    });

    res.json(weeklyStats);
  } catch (error) {
    console.error("Error calculating weekly statistics:", error);
    res.status(500).json({ error: "Error calculating weekly statistics" });
  }
});

// Reset all work hours for a period
app.post("/api/reset-period/:userId/:periodId", async (req, res) => {
  try {
    const { userId, periodId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const period = await PayrollPeriod.findById(periodId);
    if (!period) return res.status(404).json({ error: "Period not found" });

    await WorkHour.deleteMany({
      user: userId,
      work_date: { $gte: period.start_date, $lte: period.end_date },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error resetting period hours:", error);
    res.status(500).json({ error: "Error resetting period hours" });
  }
});

// Set standard hours for all working days in a period
app.post("/api/set-standard-hours/:userId/:periodId", async (req, res) => {
  try {
    const { userId, periodId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const period = await PayrollPeriod.findById(periodId);
    if (!period) return res.status(404).json({ error: "Period not found" });

    // Standard hours per day of week (0 = Sunday, 6 = Saturday)
    const standardHours = { 0: 0, 1: 10, 2: 4.5, 3: 8, 4: 10, 5: 4.5, 6: 0 };

    const holidays = await PublicHoliday.find({
      holiday_date: { $gte: period.start_date, $lte: period.end_date },
    });
    const holidayDates = holidays.map(
      (h) => h.holiday_date.toISOString().split("T")[0]
    );

    const bulkOps = [];
    for (
      let day = new Date(period.start_date);
      day <= new Date(period.end_date);
      day.setDate(day.getDate() + 1)
    ) {
      const dateStr = day.toISOString().split("T")[0];
      const dayOfWeek = day.getDay();
      // Skip Sundays and public holidays
      if (dayOfWeek !== 0 && !holidayDates.includes(dateStr)) {
        bulkOps.push({
          updateOne: {
            filter: { user: userId, work_date: new Date(dateStr) },
            update: {
              $set: {
                hours_worked: standardHours[dayOfWeek] || 0,
                updated_at: new Date(),
                last_synced: new Date(),
              },
            },
            upsert: true,
          },
        });
      }
    }

    if (bulkOps.length > 0) await WorkHour.bulkWrite(bulkOps);

    res.json({ success: true });
  } catch (error) {
    console.error("Error setting standard hours:", error);
    res.status(500).json({ error: "Error setting standard hours" });
  }
});

// Get public holidays by year
app.get("/api/public-holidays/:year", async (req, res) => {
  try {
    const holidays = await PublicHoliday.find({
      year: parseInt(req.params.year),
    });
    res.json(holidays);
  } catch (error) {
    console.error("Error fetching public holidays:", error);
    res.status(500).json({ error: "Error fetching public holidays" });
  }
});

// Get hourly rate for a user
app.get("/api/hourly-rate/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const rateSetting = await RateSetting.findOne({ user: userId }).sort({
      effective_from: -1,
    });
    res.json({ hourly_rate: rateSetting ? rateSetting.hourly_rate : 30.0 });
  } catch (error) {
    console.error("Error fetching hourly rate:", error);
    res.status(500).json({ error: "Error fetching hourly rate" });
  }
});

// Connection test
app.get("/api/test", (req, res) => {
  res.json({
    message: "Payroll Tracker API is running correctly",
    timestamp: new Date().toISOString(),
  });
});

// Server status
app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    timestamp: new Date(),
    mongo_status:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running at: http://localhost:${PORT}`);
  console.log(`For external access, use your local IP on port ${PORT}`);
  console.log(
    "MongoDB status:",
    mongoose.connection.readyState === 1
      ? "Connected"
      : "Waiting for connection..."
  );
});
