import React, { useEffect, useState } from "react";
import apiService from "../services/api";
import syncService from "../services/syncService";
import { AlertCircle, WifiOff, RefreshCw, CheckCircle } from "lucide-react";

const OfflineManager = ({ onStatusChange }) => {
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  // Check connection status on mount and every 30 seconds
  useEffect(() => {
    checkConnectionStatus();

    const interval = setInterval(() => {
      checkConnectionStatus();
    }, 30000);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Update pending count periodically
  useEffect(() => {
    const updatePendingCount = () => {
      const count = syncService.getPendingSyncCount();
      setPendingCount(count);
      setLastSync(syncService.getLastSyncTime());
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 10000);
    return () => clearInterval(interval);
  }, []);

  // When connection status changes, try to sync
  useEffect(() => {
    if (!isOffline && pendingCount > 0) {
      syncPendingData();
    }

    if (onStatusChange) {
      onStatusChange(isOffline);
    }

    setShowBanner(isOffline || pendingCount > 0);
  }, [isOffline, pendingCount]);

  const handleOnline = () => {
    checkConnectionStatus();
  };

  const handleOffline = () => {
    setIsOffline(true);
    setShowBanner(true);
  };

  const checkConnectionStatus = async () => {
    try {
      await apiService.getStatus();
      if (isOffline) {
        setIsOffline(false);
        if (onStatusChange) onStatusChange(false);
        syncPendingData();
      }
    } catch (error) {
      setIsOffline(true);
      if (onStatusChange) onStatusChange(true);
    }
  };

  const syncPendingData = async () => {
    if (isSyncing || pendingCount === 0) return;

    try {
      setIsSyncing(true);
      const result = await syncService.syncPendingRecords(
        "69993e98685c417bb546fbd0"
      );

      setPendingCount(syncService.getPendingSyncCount());
      setLastSync(syncService.getLastSyncTime());

      if (onStatusChange) onStatusChange(false);

      if (syncService.getPendingSyncCount() === 0) {
        setTimeout(() => {
          setShowBanner(isOffline);
        }, 5000);
      }
    } catch (error) {
      console.error("Error syncing:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Format last sync date for display
  const formatLastSync = () => {
    if (!lastSync) return "Never"; // ← was: 'Nunca'

    const date = new Date(lastSync);
    return date.toLocaleString();
  };

  if (!showBanner) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 p-3 rounded-lg ${
        isOffline
          ? "bg-red-900"
          : pendingCount > 0
          ? "bg-yellow-900"
          : "bg-green-900"
      } text-white shadow-xl z-50 flex items-center gap-3 max-w-sm`}
    >
      {isOffline ? (
        <WifiOff size={18} className="shrink-0" />
      ) : pendingCount > 0 ? (
        <AlertCircle size={18} className="shrink-0" />
      ) : (
        <CheckCircle size={18} className="shrink-0" />
      )}

      <div className="text-sm">
        {isOffline ? (
          <span>Offline — Data saved locally</span>
        ) : pendingCount > 0 ? (
          <span>{pendingCount} record(s) pending sync</span>
        ) : (
          <span>All data synced</span>
        )}
        {lastSync && (
          <div className="text-xs opacity-70 mt-0.5">
            Last sync: {formatLastSync()}
          </div>
        )}
      </div>

      <button
        onClick={isOffline ? checkConnectionStatus : syncPendingData}
        disabled={isSyncing}
        className="bg-blue-700 hover:bg-blue-600 text-white py-1 px-2 rounded text-xs flex items-center shrink-0"
      >
        {isSyncing ? (
          <>
            <RefreshCw size={12} className="mr-1 animate-spin" /> Syncing...
          </>
        ) : isOffline ? (
          "Retry"
        ) : (
          "Sync"
        )}
      </button>
    </div>
  );
};

export default OfflineManager;
