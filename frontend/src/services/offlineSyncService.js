import { openDB } from 'idb';
import api from './api';

const DB_NAME = 'AttendanceOfflineDB';
const STORE_NAME = 'punches';

class OfflineSyncService {
  constructor() {
    this.dbPromise = this.initDB();
    this.setupNetworkListeners();
  }

  async initDB() {
    return openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('sync_status', 'sync_status');
        }
      },
    });
  }

  setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('Online: Syncing offline punches...');
      this.syncOfflinePunches();
    });
  }

  async savePunchLocally(punchData) {
    const db = await this.dbPromise;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    await store.add({
      ...punchData,
      source: 'OFFLINE',
      client_timestamp: new Date().toISOString(),
      sync_status: 'PENDING'
    });
    
    await tx.done;
    console.log('Punch saved locally for offline mode.');
  }

  async syncOfflinePunches() {
    const db = await this.dbPromise;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('sync_status');
    const pendingPunches = await index.getAll('PENDING');

    for (const punch of pendingPunches) {
      try {
        await api.post('/attendance/punch', punch);
        // Mark as synced
        punch.sync_status = 'SYNCED';
        await store.put(punch);
      } catch (error) {
        console.error('Failed to sync punch:', error);
      }
    }
  }

  async getPendingCount() {
    const db = await this.dbPromise;
    const count = await db.countFromIndex(STORE_NAME, 'sync_status', 'PENDING');
    return count;
  }
}

export default new OfflineSyncService();
