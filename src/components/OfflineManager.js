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
        // Connection restored
        setIsOffline(false);
        syncPendingData();
      }
    } catch (error) {
      setIsOffline(true);
    }
  };

  // Sync pending records
  const syncPendingData = async () => {
    if (isSyncing || pendingCount === 0) return;

    try {
      setIsSyncing(true);
      // Using ID 1 as default (in a real implementation, use the logged-in user's ID)
      const result = await syncService.syncPendingRecords("1");

      setPendingCount(syncService.getPendingSyncCount());
      setLastSync(syncService.getLastSyncTime());

      // If no more pending records, hide banner after 5 seconds
      if (syncService.getPendingSyncCount() === 0) {
        setTimeout(() => {
          setShowBanner(isOffline); // Keep visible only if offline
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
      className={`fixed bottom-0 left-0 right-0 p-3 ${
        isOffline
          ? "bg-red-900"
          : pendingCount > 0
          ? "bg-yellow-900"
          : "bg-green-900"
      } text-white shadow-lg z-50 flex items-center justify-between`}
    >
      <div className="flex items-center">
        {isOffline ? (
          <WifiOff size={20} className="mr-2" />
        ) : pendingCount > 0 ? (
          <AlertCircle size={20} className="mr-2" />
        ) : (
          <CheckCircle size={20} className="mr-2" />
        )}

        <div>
          {isOffline ? (
            <span>Offline Mode — Data will be saved locally</span> // ← was: 'Modo Offline - Os dados serão salvos localmente'
          ) : pendingCount > 0 ? (
            <span>{pendingCount} record(s) pending synchronization</span> // ← was: 'registro(s) pendente(s) de sincronização'
          ) : (
            <span>All data is synced</span> // ← was: 'Todos os dados estão sincronizados'
          )}

          {lastSync && (
            <div className="text-xs opacity-80">
              Last sync: {formatLastSync()}{" "}
              {/* ← was: 'Última sincronização:' */}
            </div>
          )}
        </div>
      </div>

      <div>
        <button
          onClick={isOffline ? checkConnectionStatus : syncPendingData}
          disabled={isSyncing}
          className="bg-blue-700 hover:bg-blue-600 text-white py-1 px-3 rounded text-sm flex items-center"
        >
          {isSyncing ? (
            <>
              <RefreshCw size={14} className="mr-1 animate-spin" /> Syncing...{" "}
              {/* ← was: 'Sincronizando...' */}
            </>
          ) : isOffline ? (
            "Check connection" // ← was: 'Verificar conexão'
          ) : (
            "Sync now" // ← was: 'Sincronizar agora'
          )}
        </button>
      </div>
    </div>
  );
};

export default OfflineManager;
