import { db, isFirebaseConfigured } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  deleteDoc, 
  writeBatch,
  getDoc,
  where,
  getDocs
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './firestoreUtils';
import { Item, Sale, Partner, DailyBlessing, Invoice, Settings, Store, SupplyOrder } from '../types';

// Local in-memory listeners to trigger callbacks when localStorage data changes
const localListeners = new Map<string, Set<(data: any[]) => void>>();
const docListeners = new Map<string, Set<(data: any) => void>>();

export const notifyLocalListeners = (collectionName: string) => {
  const listeners = localListeners.get(collectionName);
  if (listeners) {
    const key = `local_sunset_${collectionName}`;
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    listeners.forEach(cb => cb(data));
  }
};

export const notifyDocListener = (path: string) => {
  const listeners = docListeners.get(path);
  if (listeners) {
    const data = JSON.parse(localStorage.getItem(`local_sunset_doc_${path}`) || 'null');
    listeners.forEach(cb => cb(data));
  }
};

export const syncData = (
  userId: string,
  collectionName: string,
  callback: (data: any[]) => void,
  targetUserId?: string
) => {
  if (!isFirebaseConfigured) {
    if (!localListeners.has(collectionName)) {
      localListeners.set(collectionName, new Set());
    }
    localListeners.get(collectionName)!.add(callback);

    const key = `local_sunset_${collectionName}`;
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    callback(data);

    return () => {
      localListeners.get(collectionName)?.delete(callback);
    };
  }

  const path = `users/${targetUserId || userId}/${collectionName}`;
  const baseCol = collection(db, path);
  const q = (targetUserId && targetUserId !== userId && collectionName === 'sales')
    ? query(baseCol, where('customerId', '==', userId))
    : query(baseCol);
  
  return onSnapshot(q, (snapshot) => {
    const rawData = snapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));
    // Deduplicate by id if available
    const uniqueMap = new Map();
    rawData.forEach(item => {
      const idToKey = item.id || Math.random().toString();
      uniqueMap.set(idToKey, item);
    });
    callback(Array.from(uniqueMap.values()));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};

export const syncGlobalCollection = (
  collectionName: string,
  callback: (data: any[]) => void,
  filter?: { field: string, value: any }
) => {
  if (!isFirebaseConfigured) {
    if (!localListeners.has(collectionName)) {
      localListeners.set(collectionName, new Set());
    }
    localListeners.get(collectionName)!.add(callback);

    const key = `local_sunset_${collectionName}`;
    let data = JSON.parse(localStorage.getItem(key) || '[]');
    if (filter) {
      data = data.filter((item: any) => item[filter.field] === filter.value);
    }
    callback(data);

    return () => {
      localListeners.get(collectionName)?.delete(callback);
    };
  }

  const colRef = collection(db, collectionName);
  const q = filter 
    ? query(colRef, where(filter.field, '==', filter.value))
    : query(colRef);

  return onSnapshot(q, (snapshot) => {
    const rawData = snapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));
    const uniqueMap = new Map();
    rawData.forEach(item => {
      const idToKey = item.id || Math.random().toString();
      uniqueMap.set(idToKey, item);
    });
    callback(Array.from(uniqueMap.values()));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, collectionName);
  });
};

export const saveGlobalDoc = async (collectionName: string, item: any) => {
  if (!isFirebaseConfigured) {
    const key = `local_sunset_${collectionName}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const index = existing.findIndex((i: any) => i.id === item.id);
    if (index >= 0) {
      existing[index] = item;
    } else {
      existing.push(item);
    }
    localStorage.setItem(key, JSON.stringify(existing));
    notifyLocalListeners(collectionName);
    return;
  }

  const path = `${collectionName}/${item.id}`;
  try {
    await setDoc(doc(db, path), item);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const fetchUsersByRole = async (role: string) => {
  if (!isFirebaseConfigured) {
    const accounts = JSON.parse(localStorage.getItem('local_sunset_accounts') || '[]');
    const mapped = accounts.map((a: any) => {
      const settingsKey = `local_sunset_doc_users/${a.uid}`;
      const savedDoc = JSON.parse(localStorage.getItem(settingsKey) || '{}');
      return {
        id: a.uid,
        uid: a.uid,
        email: a.email,
        displayName: a.name,
        role: savedDoc.role || 'customer',
        ...savedDoc
      };
    });
    return mapped.filter((m: any) => m.role === role);
  }

  const q = query(collection(db, 'users'), where('role', '==', role));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));
};

export const syncDoc = (
  path: string,
  callback: (data: any) => void
) => {
  if (!isFirebaseConfigured) {
    if (!docListeners.has(path)) {
      docListeners.set(path, new Set());
    }
    docListeners.get(path)!.add(callback);

    const data = JSON.parse(localStorage.getItem(`local_sunset_doc_${path}`) || 'null');
    callback(data);

    return () => {
      docListeners.get(path)?.delete(callback);
    };
  }

  return onSnapshot(doc(db, path), (snapshot) => {
    callback(snapshot.data());
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};

export const saveData = async (userId: string, collectionName: string, item: any) => {
  if (!isFirebaseConfigured) {
    const key = `local_sunset_${collectionName}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const index = existing.findIndex((i: any) => i.id === item.id);
    if (index >= 0) {
      existing[index] = item;
    } else {
      existing.push(item);
    }
    localStorage.setItem(key, JSON.stringify(existing));
    notifyLocalListeners(collectionName);
    return;
  }

  const path = `users/${userId}/${collectionName}/${item.id}`;
  try {
    await setDoc(doc(db, path), item);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteData = async (userId: string, collectionName: string, id: string) => {
  if (!isFirebaseConfigured) {
    const key = `local_sunset_${collectionName}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const filtered = existing.filter((i: any) => i.id !== id);
    localStorage.setItem(key, JSON.stringify(filtered));
    notifyLocalListeners(collectionName);
    return;
  }

  const path = `users/${userId}/${collectionName}/${id}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const clearShopRecords = async (userId: string) => {
  if (!isFirebaseConfigured) {
    const collections = ['items', 'sales', 'partners', 'credits', 'blessings', 'invoices', 'salaries'];
    collections.forEach(colName => {
      localStorage.removeItem(`local_sunset_${colName}`);
      notifyLocalListeners(colName);
    });
    return;
  }

  const collections = ['items', 'sales', 'partners', 'credits', 'blessings', 'invoices', 'salaries'];
  let batch = writeBatch(db);
  let operationCount = 0;

  for (const colName of collections) {
    const path = `users/${userId}/${colName}`;
    const colRef = collection(db, path);
    try {
      const snapshot = await getDocs(colRef);
      for (const docSnap of snapshot.docs) {
        batch.delete(docSnap.ref);
        operationCount++;
        if (operationCount === 500) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  if (operationCount > 0) {
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}/[batch_commit]`);
    }
  }
};

export const updateSettings = async (userId: string, settings: Settings) => {
  const path = `users/${userId}`;
  if (!isFirebaseConfigured) {
    localStorage.setItem(`local_sunset_doc_${path}`, JSON.stringify(settings));
    notifyDocListener(path);
    return;
  }

  try {
    await setDoc(doc(db, path), settings);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const migrateFromLocalStorage = async (userId: string) => {
  const batch = writeBatch(db);
  let hasData = false;

  const collections = [
    { key: 'sunset_inventory', name: 'items' },
    { key: 'sunset_sales', name: 'sales' },
    { key: 'sunset_partners', name: 'partners' },
    { key: 'sunset_blessings', name: 'blessings' },
    { key: 'sunset_invoices', name: 'invoices' }
  ];

  for (const col of collections) {
    const saved = localStorage.getItem(col.key);
    if (saved) {
      const data = JSON.parse(saved);
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          const ref = doc(db, `users/${userId}/${col.name}/${item.id}`);
          batch.set(ref, item);
          hasData = true;
        });
      }
    }
  }

  const savedSettings = localStorage.getItem('sunset_settings');
  if (savedSettings) {
    const settings = JSON.parse(savedSettings);
    const ref = doc(db, `users/${userId}`);
    batch.set(ref, settings);
    hasData = true;
  }

  if (hasData) {
    await batch.commit();
    // Clear local storage after successful migration
    collections.forEach(col => localStorage.removeItem(col.key));
    localStorage.removeItem('sunset_settings');
  }
};

export const createDatabaseBackup = async (userId: string) => {
  const itemsRef = collection(db, `users/${userId}/items`);
  const salesRef = collection(db, `users/${userId}/sales`);
  const partnersRef = collection(db, `users/${userId}/partners`);

  const [itemsSnap, salesSnap, partnersSnap] = await Promise.all([
    getDocs(itemsRef),
    getDocs(salesRef),
    getDocs(partnersRef)
  ]);

  const items = itemsSnap.docs.map(doc => doc.data());
  const sales = salesSnap.docs.map(doc => doc.data());
  const partners = partnersSnap.docs.map(doc => doc.data());

  const backupId = `backup_${Date.now()}`;
  const timestamp = new Date().toISOString();

  const backupDoc = {
    id: backupId,
    timestamp,
    items,
    sales,
    partners,
    itemsCount: items.length,
    salesCount: sales.length,
    partnersCount: partners.length
  };

  const path = `users/${userId}/backups/${backupId}`;
  try {
    await setDoc(doc(db, path), backupDoc);
    return backupDoc;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
};

export const fetchDatabaseBackups = async (userId: string) => {
  const path = `users/${userId}/backups`;
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(doc => doc.data()).sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    throw error;
  }
};

export const deleteDatabaseBackup = async (userId: string, backupId: string) => {
  const path = `users/${userId}/backups/${backupId}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
};

export const restoreDatabaseFromBackup = async (userId: string, backup: any) => {
  const collections = ['items', 'sales', 'partners'];
  
  // Clear existing items, sales, and partners
  for (const colName of collections) {
    const path = `users/${userId}/${colName}`;
    const colRef = collection(db, path);
    try {
      const snapshot = await getDocs(colRef);
      let batch = writeBatch(db);
      let count = 0;
      for (const docSnap of snapshot.docs) {
        batch.delete(docSnap.ref);
        count++;
        if (count === 500) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
      throw error;
    }
  }

  // Write new items
  if (Array.isArray(backup.items) && backup.items.length > 0) {
    let batch = writeBatch(db);
    let count = 0;
    for (const item of backup.items) {
      const path = `users/${userId}/items/${item.id}`;
      const ref = doc(db, path);
      batch.set(ref, item);
      count++;
      if (count === 500) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  }

  // Write new sales
  if (Array.isArray(backup.sales) && backup.sales.length > 0) {
    let batch = writeBatch(db);
    let count = 0;
    for (const sale of backup.sales) {
      const path = `users/${userId}/sales/${sale.id}`;
      const ref = doc(db, path);
      batch.set(ref, sale);
      count++;
      if (count === 500) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  }

  // Write new partners
  if (Array.isArray(backup.partners) && backup.partners.length > 0) {
    let batch = writeBatch(db);
    let count = 0;
    for (const partner of backup.partners) {
      const path = `users/${userId}/partners/${partner.id}`;
      const ref = doc(db, path);
      batch.set(ref, partner);
      count++;
      if (count === 500) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  }
};
