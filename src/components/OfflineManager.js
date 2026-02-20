import React, { useEffect, useState } from 'react';
import apiService from '../services/api';
import syncService from '../services/syncService';
import { AlertCircle, WifiOff, RefreshCw, CheckCircle } from 'lucide-react';

const OfflineManager = ({ onStatusChange }) => {
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  
  // Verificar status da conexão ao montar o componente e a cada 30 segundos
  useEffect(() => {
    checkConnectionStatus();
    
    // Configurar verificações periódicas
    const interval = setInterval(() => {
      checkConnectionStatus();
    }, 30000); // A cada 30 segundos
    
    // Configurar listeners de eventos de online/offline
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Limpar ao desmontar
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Atualizar contagem de pendências periodicamente
  useEffect(() => {
    const updatePendingCount = () => {
      const count = syncService.getPendingSyncCount();
      setPendingCount(count);
      setLastSync(syncService.getLastSyncTime());
    };
    
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 10000); // A cada 10 segundos
    
    return () => clearInterval(interval);
  }, []);
  
  // Quando detectamos mudança no status de conexão, tentar sincronizar
  useEffect(() => {
    if (!isOffline && pendingCount > 0) {
      syncPendingData();
    }
    
    // Propagar mudança de status para o componente pai
    if (onStatusChange) {
      onStatusChange(isOffline);
    }
    
    // Mostrar banner se offline ou se tiver pendências
    setShowBanner(isOffline || pendingCount > 0);
  }, [isOffline, pendingCount]);
  
  // Handler para evento 'online'
  const handleOnline = () => {
    checkConnectionStatus();
  };
  
  // Handler para evento 'offline'
  const handleOffline = () => {
    setIsOffline(true);
    setShowBanner(true);
  };
  
  // Verificar se estamos online/offline tentando acessar a API
  const checkConnectionStatus = async () => {
    try {
      await apiService.getStatus();
      if (isOffline) {
        // Acabamos de recuperar a conexão
        setIsOffline(false);
        syncPendingData();
      }
    } catch (error) {
      setIsOffline(true);
    }
  };
  
  // Sincronizar dados pendentes
  const syncPendingData = async () => {
    if (isSyncing || pendingCount === 0) return;
    
    try {
      setIsSyncing(true);
      // Usamos ID 1 como padrão (em uma implementação real, usaríamos o ID do usuário logado)
      const result = await syncService.syncPendingRecords('1');
      
      // Atualizar contagem
      setPendingCount(syncService.getPendingSyncCount());
      setLastSync(syncService.getLastSyncTime());
      
      // Se não há mais pendências, esconder banner após 5 segundos
      if (syncService.getPendingSyncCount() === 0) {
        setTimeout(() => {
          setShowBanner(isOffline); // Manter visível apenas se offline
        }, 5000);
      }
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
    } finally {
      setIsSyncing(false);
    }
  };
  
  // Formatar data para exibição
  const formatLastSync = () => {
    if (!lastSync) return 'Nunca';
    
    const date = new Date(lastSync);
    return date.toLocaleString();
  };
  
  if (!showBanner) return null;
  
  return (
    <div className={`fixed bottom-0 left-0 right-0 p-3 ${isOffline ? 'bg-red-900' : pendingCount > 0 ? 'bg-yellow-900' : 'bg-green-900'} text-white shadow-lg z-50 flex items-center justify-between`}>
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
            <span>Modo Offline - Os dados serão salvos localmente</span>
          ) : pendingCount > 0 ? (
            <span>{pendingCount} registro(s) pendente(s) de sincronização</span>
          ) : (
            <span>Todos os dados estão sincronizados</span>
          )}
          
          {lastSync && (
            <div className="text-xs opacity-80">
              Última sincronização: {formatLastSync()}
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
              <RefreshCw size={14} className="mr-1 animate-spin" /> Sincronizando...
            </>
          ) : isOffline ? (
            'Verificar conexão'
          ) : (
            'Sincronizar agora'
          )}
        </button>
      </div>
    </div>
  );
}

export default OfflineManager;