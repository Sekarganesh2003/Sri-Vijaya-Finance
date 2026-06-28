export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

const DB_NAME = 'SriFinanceDB';
const DB_VERSION = 1;

export interface FinanceDBData {
  settings?: unknown;
  customers: unknown[];
  collections: unknown[];
  expenses: unknown[];
  employees: unknown[];
  collectionGroups: string[];
  usersList: unknown[];
  backupsList: unknown[];
}

export class FinanceDB {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  static getDb(): Promise<IDBDatabase> {
    if (!isBrowser()) {
      return Promise.reject(new Error('IndexedDB is only available in the browser'));
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
          console.warn('IndexedDB open error:', event);
          reject(new Error('Failed to open IndexedDB'));
        };

        request.onsuccess = (event) => {
          resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Create Object Stores
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('customers')) {
            db.createObjectStore('customers', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('collections')) {
            db.createObjectStore('collections', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('expenses')) {
            db.createObjectStore('expenses', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('employees')) {
            db.createObjectStore('employees', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('collectionGroups')) {
            db.createObjectStore('collectionGroups', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('usersList')) {
            db.createObjectStore('usersList', { keyPath: 'username' });
          }
          if (!db.objectStoreNames.contains('backupsList')) {
            db.createObjectStore('backupsList', { keyPath: 'id' });
          }
        };
      } catch (err) {
        console.warn('IndexedDB is blocked or unsupported in this context:', err);
        reject(new Error('IndexedDB is blocked or unsupported'));
      }
    });

    return this.dbPromise;
  }

  // Generic getter
  static async getAll(storeName: string): Promise<unknown[]> {
    try {
      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn(`Failed to read from store ${storeName}:`, e);
      return [];
    }
  }

  static async getById(storeName: string, id: string): Promise<unknown | null> {
    try {
      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn(`Failed to read ID ${id} from store ${storeName}:`, e);
      return null;
    }
  }

  // Generic put/save
  static async put(storeName: string, item: unknown): Promise<void> {
    try {
      const db = await this.getDb();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn(`Failed to put in store ${storeName}:`, e);
    }
  }

  // Generic delete
  static async delete(storeName: string, id: string): Promise<void> {
    try {
      const db = await this.getDb();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn(`Failed to delete ID ${id} from ${storeName}:`, e);
    }
  }

  // Clear a store
  static async clearStore(storeName: string): Promise<void> {
    try {
      const db = await this.getDb();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn(`Failed to clear store ${storeName}:`, e);
    }
  }

  // Bulk save store
  static async saveAll(storeName: string, items: unknown[]): Promise<void> {
    try {
      const db = await this.getDb();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        
        // Clear old first
        store.clear();

        let index = 0;
        function putNext() {
          if (index < items.length) {
            const req = store.put(items[index]);
            req.onsuccess = () => {
              index++;
              putNext();
            };
            req.onerror = () => reject(req.error);
          } else {
            resolve();
          }
        }
        putNext();
      });
    } catch (e) {
      console.warn(`Failed bulk save in store ${storeName}:`, e);
    }
  }

  // Complete database save / load helper matches active code
  static async loadAll(): Promise<FinanceDBData | null> {
    if (!isBrowser()) return null;
    try {
      const settingsArr = await this.getAll('settings');
      const settings = settingsArr.find(v => {
        const val = v as { id: string };
        return val && val.id === 'app';
      }) || null;

      const customers = await this.getAll('customers');
      const collections = await this.getAll('collections');
      const expenses = await this.getAll('expenses');
      const employees = await this.getAll('employees');

      const groupsArr = await this.getAll('collectionGroups');
      const groupsObj = groupsArr.find(v => {
        const val = v as { id: string };
        return val && val.id === 'groups';
      }) as { list: string[] } | undefined;
      const collectionGroups = groupsObj ? groupsObj.list : [];

      const usersList = await this.getAll('usersList');
      const backupsList = await this.getAll('backupsList');

      // Return null or fallback if there's absolutely no data
      if (
        customers.length === 0 &&
        collections.length === 0 &&
        expenses.length === 0 &&
        employees.length === 0 &&
        !settings
      ) {
        // Fallback to localStorage
        const stored = localStorage.getItem('smart_finance_db_v1.0');
        if (stored) {
          try {
            return JSON.parse(stored);
          } catch {
            // ignore
          }
        }
        return null;
      }

      return {
        settings,
        customers,
        collections,
        expenses,
        employees,
        collectionGroups,
        usersList,
        backupsList
      };
    } catch (e) {
      console.warn('Error loading complete database from IndexedDB, trying localStorage fallback:', e);
      // Fallback to localStorage
      const stored = localStorage.getItem('smart_finance_db_v1.0');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          // ignore
        }
      }
      return null;
    }
  }

  static async saveAllData(data: {
    settings?: unknown;
    customers: unknown[];
    collections: unknown[];
    expenses: unknown[];
    employees: unknown[];
    collectionGroups: string[];
    usersList: unknown[];
    backupsList: unknown[];
  }): Promise<void> {
    if (!isBrowser()) return;
    try {
      if (data.settings) {
        const sObj = data.settings as Record<string, unknown>;
        await this.put('settings', { id: 'app', ...sObj });
      }
      await this.saveAll('customers', data.customers);
      await this.saveAll('collections', data.collections);
      await this.saveAll('expenses', data.expenses);
      await this.saveAll('employees', data.employees);
      await this.put('collectionGroups', { id: 'groups', list: data.collectionGroups });
      await this.saveAll('usersList', data.usersList);
      await this.saveAll('backupsList', data.backupsList);
    } catch (e) {
      console.warn('Error saving complete database to IndexedDB:', e);
    }
  }
}
