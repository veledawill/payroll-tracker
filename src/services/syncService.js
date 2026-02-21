import { v4 as uuidv4 } from "uuid";
import apiService from "./api";

// Local storage keys
const PENDING_SYNC_KEY = "lass_pending_sync";
const WORK_HOURS_KEY = "lass_work_hours";
const LAST_SYNC_KEY = "lass_last_sync";

class SyncService {
  // ── Save work hours (online + offline) ──────────────────────────────────────
  async saveWorkHours(userId, workDate, hours) {
    const syncId = uuidv4();
    const timestamp = new Date().toISOString();

    const existingData = this.getLocalWorkData(workDate);
    const clockInTime = existingData.clockIn || "";
    const clockOutTime = existingData.clockOut || ""; // ← NEW: preserve clockOut

    const workHourData = {
      userId,
      workDate,
      hours,
      clockInTime,
      clockOutTime, // ← NEW
      sync_id: syncId,
      updated_at: timestamp,
    };

    this.saveToLocalStorage(
      workDate,
      hours,
      clockInTime,
      clockOutTime,
      syncId,
      timestamp
    ); // ← updated signature

    try {
      const response = await apiService.saveWorkHours(workHourData);
      if (response.data.success) {
        this.markAsSynced(syncId, response.data.work_hour.updated_at);
      }
      return response.data;
    } catch (error) {
      this.addToPendingSync(workHourData);
      return {
        success: true,
        offline: true,
        local_sync_id: syncId,
        message: "Saved locally. Will sync when connection is restored.",
      };
    }
  }

  // ── Save clock-in time ───────────────────────────────────────────────────────
  async saveClockInTime(userId, workDate, clockInTime) {
    const syncId = uuidv4();
    const timestamp = new Date().toISOString();

    const existingData = this.getLocalWorkData(workDate);
    const hours = existingData.hours || 0;
    const clockOutTime = existingData.clockOut || ""; // ← NEW: preserve clockOut

    const workHourData = {
      userId,
      workDate,
      hours,
      clockInTime,
      clockOutTime, // ← NEW
      sync_id: syncId,
      updated_at: timestamp,
    };

    this.saveToLocalStorage(
      workDate,
      hours,
      clockInTime,
      clockOutTime,
      syncId,
      timestamp
    );

    try {
      const response = await apiService.saveWorkHours(workHourData);
      if (response.data.success) {
        this.markAsSynced(syncId, response.data.work_hour.updated_at);
      }
      return response.data;
    } catch (error) {
      this.addToPendingSync(workHourData);
      return {
        success: true,
        offline: true,
        local_sync_id: syncId,
        message:
          "Clock-in time saved locally. Will sync when connection is restored.",
      };
    }
  }

  // ── NEW: Save clock-out time ─────────────────────────────────────────────────
  async saveClockOutTime(userId, workDate, clockOutTime) {
    const syncId = uuidv4();
    const timestamp = new Date().toISOString();

    const existingData = this.getLocalWorkData(workDate);
    const hours = existingData.hours || 0;
    const clockInTime = existingData.clockIn || "";

    const workHourData = {
      userId,
      workDate,
      hours,
      clockInTime,
      clockOutTime,
      sync_id: syncId,
      updated_at: timestamp,
    };

    this.saveToLocalStorage(
      workDate,
      hours,
      clockInTime,
      clockOutTime,
      syncId,
      timestamp
    );

    try {
      const response = await apiService.saveWorkHours(workHourData);
      if (response.data.success) {
        this.markAsSynced(syncId, response.data.work_hour.updated_at);
      }
      return response.data;
    } catch (error) {
      this.addToPendingSync(workHourData);
      return {
        success: true,
        offline: true,
        local_sync_id: syncId,
        message:
          "Clock-out time saved locally. Will sync when connection is restored.",
      };
    }
  }

  // ── Get existing work data from localStorage ─────────────────────────────────
  getLocalWorkData(workDate) {
    try {
      const storedData = localStorage.getItem(WORK_HOURS_KEY);
      if (storedData) {
        const workHours = JSON.parse(storedData);
        const data = workHours[workDate];

        if (typeof data === "object") {
          return {
            hours: data.hours || 0,
            clockIn: data.clockIn || "",
            clockOut: data.clockOut || "", // ← NEW
          };
        } else {
          return { hours: data || 0, clockIn: "", clockOut: "" };
        }
      }
    } catch (error) {
      console.error("Error getting local work data:", error);
    }
    return { hours: 0, clockIn: "", clockOut: "" };
  }

  // ── Save to localStorage ─────────────────────────────────────────────────────
  // Updated signature: added clockOutTime parameter
  saveToLocalStorage(
    workDate,
    hours,
    clockInTime,
    clockOutTime,
    syncId,
    timestamp
  ) {
    const storedData = localStorage.getItem(WORK_HOURS_KEY);
    let workHours = storedData ? JSON.parse(storedData) : {};

    workHours[workDate] = {
      hours,
      clockIn: clockInTime || "",
      clockOut: clockOutTime || "", // ← NEW
      sync_id: syncId,
      updated_at: timestamp,
      synced: false,
    };

    localStorage.setItem(WORK_HOURS_KEY, JSON.stringify(workHours));
  }

  // ── Add record to the pending sync queue ─────────────────────────────────────
  addToPendingSync(workHourData) {
    const storedQueue = localStorage.getItem(PENDING_SYNC_KEY);
    let pendingQueue = storedQueue ? JSON.parse(storedQueue) : [];

    const existingIndex = pendingQueue.findIndex(
      (item) =>
        item.workDate === workHourData.workDate &&
        item.userId === workHourData.userId
    );

    if (existingIndex >= 0) {
      pendingQueue[existingIndex] = workHourData;
    } else {
      pendingQueue.push(workHourData);
    }

    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pendingQueue));
  }

  // ── Mark a record as synced ──────────────────────────────────────────────────
  markAsSynced(syncId, serverTimestamp) {
    const storedData = localStorage.getItem(WORK_HOURS_KEY);
    if (storedData) {
      let workHours = JSON.parse(storedData);
      Object.keys(workHours).forEach((date) => {
        if (workHours[date].sync_id === syncId) {
          workHours[date].synced = true;
          workHours[date].server_updated_at =
            serverTimestamp || new Date().toISOString();
        }
      });
      localStorage.setItem(WORK_HOURS_KEY, JSON.stringify(workHours));
    }

    const storedQueue = localStorage.getItem(PENDING_SYNC_KEY);
    if (storedQueue) {
      let pendingQueue = JSON.parse(storedQueue);
      pendingQueue = pendingQueue.filter((item) => item.sync_id !== syncId);
      localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pendingQueue));
    }
  }

  // ── Sync all pending records with the server ─────────────────────────────────
  async syncPendingRecords(userId) {
    const storedQueue = localStorage.getItem(PENDING_SYNC_KEY);
    if (!storedQueue) return { success: true, count: 0 };

    const pendingQueue = JSON.parse(storedQueue);
    if (pendingQueue.length === 0) return { success: true, count: 0 };

    try {
      // clockOutTime is already part of each queued record (added above)
      const response = await apiService.syncWorkHours(userId, pendingQueue);

      if (response.data.results) {
        const results = response.data.results;
        let successCount = 0;

        results.forEach((result) => {
          if (result.success) {
            this.markAsSynced(result.sync_id, result.server_updated_at);
            successCount++;
          }
        });

        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

        return {
          success: true,
          count: successCount,
          total: pendingQueue.length,
          remaining: pendingQueue.length - successCount,
        };
      }

      return { success: false, error: "Invalid response format" };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        count: 0,
        total: pendingQueue.length,
      };
    }
  }

  hasPendingSync() {
    const storedQueue = localStorage.getItem(PENDING_SYNC_KEY);
    if (!storedQueue) return false;
    return JSON.parse(storedQueue).length > 0;
  }

  getPendingSyncCount() {
    const storedQueue = localStorage.getItem(PENDING_SYNC_KEY);
    if (!storedQueue) return 0;
    return JSON.parse(storedQueue).length;
  }

  clearAllLocalData() {
    localStorage.removeItem(PENDING_SYNC_KEY);
    localStorage.removeItem(WORK_HOURS_KEY);
    localStorage.removeItem(LAST_SYNC_KEY);
  }

  getLastSyncTime() {
    return localStorage.getItem(LAST_SYNC_KEY);
  }
}

export default new SyncService();
