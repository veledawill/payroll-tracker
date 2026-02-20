import { v4 as uuidv4 } from 'uuid';
import apiService from './api';

// Chaves para armazenamento local
const PENDING_SYNC_KEY = 'lass_pending_sync';
const WORK_HOURS_KEY = 'lass_work_hours';
const LAST_SYNC_KEY = 'lass_last_sync';

class SyncService {
  // Salvar horas de trabalho (funciona tanto online quanto offline)
  async saveWorkHours(userId, workDate, hours) {
    // Gerar ID de sincronização único para este registro
    const syncId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Get existing clock-in time if available
    const existingData = this.getLocalWorkData(workDate);
    const clockInTime = existingData.clockIn || '';
    
    // Preparar dados
    const workHourData = {
      userId,
      workDate,
      hours,
      clockInTime,
      sync_id: syncId,
      updated_at: timestamp
    };
    
    // Salvar localmente primeiro (independente de estarmos online ou offline)
    this.saveToLocalStorage(workDate, hours, clockInTime, syncId, timestamp);
    
    try {
      // Tentar salvar no servidor
      const response = await apiService.saveWorkHours(workHourData);
      
      // Se bem-sucedido, atualizar status de sincronização local
      if (response.data.success) {
        this.markAsSynced(syncId, response.data.work_hour.updated_at);
      }
      
      return response.data;
    } catch (error) {
      // Se falhou, adicionar à fila de pendências para sincronização futura
      this.addToPendingSync(workHourData);
      
      // Retornar "sucesso" mesmo assim, já que salvamos localmente
      return { 
        success: true, 
        offline: true,
        local_sync_id: syncId,
        message: 'Salvo localmente. Será sincronizado quando houver conexão.'
      };
    }
  }

  // Salvar horário de entrada
  async saveClockInTime(userId, workDate, clockInTime) {
    // Gerar ID de sincronização único para este registro
    const syncId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Get existing hours if available
    const existingData = this.getLocalWorkData(workDate);
    const hours = existingData.hours || 0;
    
    // Preparar dados
    const workHourData = {
      userId,
      workDate,
      hours,
      clockInTime,
      sync_id: syncId,
      updated_at: timestamp
    };
    
    // Salvar localmente primeiro
    this.saveToLocalStorage(workDate, hours, clockInTime, syncId, timestamp);
    
    try {
      // Tentar salvar no servidor
      const response = await apiService.saveWorkHours(workHourData);
      
      // Se bem-sucedido, atualizar status de sincronização local
      if (response.data.success) {
        this.markAsSynced(syncId, response.data.work_hour.updated_at);
      }
      
      return response.data;
    } catch (error) {
      // Se falhou, adicionar à fila de pendências para sincronização futura
      this.addToPendingSync(workHourData);
      
      // Retornar "sucesso" mesmo assim, já que salvamos localmente
      return { 
        success: true, 
        offline: true,
        local_sync_id: syncId,
        message: 'Horário de entrada salvo localmente. Será sincronizado quando houver conexão.'
      };
    }
  }

  // Get existing work data for a date
  getLocalWorkData(workDate) {
    try {
      const storedData = localStorage.getItem(WORK_HOURS_KEY);
      if (storedData) {
        const workHours = JSON.parse(storedData);
        const data = workHours[workDate];
        
        if (typeof data === 'object') {
          return {
            hours: data.hours || 0,
            clockIn: data.clockIn || ''
          };
        } else {
          return {
            hours: data || 0,
            clockIn: ''
          };
        }
      }
    } catch (error) {
      console.error('Error getting local work data:', error);
    }
    
    return { hours: 0, clockIn: '' };
  }
  
  // Salvar no localStorage
  saveToLocalStorage(workDate, hours, clockInTime, syncId, timestamp) {
    // Obter dados existentes
    const storedData = localStorage.getItem(WORK_HOURS_KEY);
    let workHours = storedData ? JSON.parse(storedData) : {};
    
    // Atualizar com novos dados
    workHours[workDate] = {
      hours,
      clockIn: clockInTime || '',
      sync_id: syncId,
      updated_at: timestamp,
      synced: false
    };
    
    // Salvar de volta no localStorage
    localStorage.setItem(WORK_HOURS_KEY, JSON.stringify(workHours));
  }
  
  // Adicionar à fila de pendências para sincronização futura
  addToPendingSync(workHourData) {
    // Obter fila atual
    const storedQueue = localStorage.getItem(PENDING_SYNC_KEY);
    let pendingQueue = storedQueue ? JSON.parse(storedQueue) : [];
    
    // Verificar se já existe um item para esta data
    const existingIndex = pendingQueue.findIndex(item => 
      item.workDate === workHourData.workDate && item.userId === workHourData.userId
    );
    
    if (existingIndex >= 0) {
      // Atualizar existente
      pendingQueue[existingIndex] = workHourData;
    } else {
      // Adicionar novo
      pendingQueue.push(workHourData);
    }
    
    // Salvar fila atualizada
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pendingQueue));
  }
  
  // Marcar um registro como sincronizado
  markAsSynced(syncId, serverTimestamp) {
    // Atualizar no workHours
    const storedData = localStorage.getItem(WORK_HOURS_KEY);
    if (storedData) {
      let workHours = JSON.parse(storedData);
      
      // Encontrar a data que corresponde a este syncId
      Object.keys(workHours).forEach(date => {
        if (workHours[date].sync_id === syncId) {
          workHours[date].synced = true;
          workHours[date].server_updated_at = serverTimestamp || new Date().toISOString();
        }
      });
      
      localStorage.setItem(WORK_HOURS_KEY, JSON.stringify(workHours));
    }
    
    // Remover da fila de pendências
    const storedQueue = localStorage.getItem(PENDING_SYNC_KEY);
    if (storedQueue) {
      let pendingQueue = JSON.parse(storedQueue);
      pendingQueue = pendingQueue.filter(item => item.sync_id !== syncId);
      localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pendingQueue));
    }
  }
  
  // Sincronizar todos os registros pendentes
  async syncPendingRecords(userId) {
    const storedQueue = localStorage.getItem(PENDING_SYNC_KEY);
    if (!storedQueue) return { success: true, count: 0 };
    
    const pendingQueue = JSON.parse(storedQueue);
    if (pendingQueue.length === 0) return { success: true, count: 0 };
    
    try {
      // Enviar todos os registros pendentes de uma vez
      const response = await apiService.syncWorkHours(userId, pendingQueue);
      
      // Processar resultados
      if (response.data.results) {
        const results = response.data.results;
        let successCount = 0;
        
        results.forEach(result => {
          if (result.success) {
            this.markAsSynced(result.sync_id, result.server_updated_at);
            successCount++;
          }
        });
        
        // Atualizar timestamp da última sincronização
        localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
        
        return {
          success: true,
          count: successCount,
          total: pendingQueue.length,
          remaining: pendingQueue.length - successCount
        };
      }
      
      return { success: false, error: 'Formato de resposta inválido' };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        count: 0,
        total: pendingQueue.length
      };
    }
  }
  
  // Verificar se há registros pendentes de sincronização
  hasPendingSync() {
    const storedQueue = localStorage.getItem(PENDING_SYNC_KEY);
    if (!storedQueue) return false;
    
    const pendingQueue = JSON.parse(storedQueue);
    return pendingQueue.length > 0;
  }
  
  // Obter contagem de registros pendentes
  getPendingSyncCount() {
    const storedQueue = localStorage.getItem(PENDING_SYNC_KEY);
    if (!storedQueue) return 0;
    
    const pendingQueue = JSON.parse(storedQueue);
    return pendingQueue.length;
  }
  
  // Limpar todos os dados locais (útil para logout ou reset)
  clearAllLocalData() {
    localStorage.removeItem(PENDING_SYNC_KEY);
    localStorage.removeItem(WORK_HOURS_KEY);
    localStorage.removeItem(LAST_SYNC_KEY);
  }
  
  // Obter a data da última sincronização
  getLastSyncTime() {
    return localStorage.getItem(LAST_SYNC_KEY);
  }
}

export default new SyncService();