import { db } from './firebase';
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

export const syncData = (
  userId: string,
  collectionName: string,
  callback: (data: any[]) => void,
  targetUserId?: string
) => {
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
  const path = `${collectionName}/${item.id}`;
  try {
    await setDoc(doc(db, path), item);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const fetchUsersByRole = async (role: string) => {
  const q = query(collection(db, 'users'), where('role', '==', role));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));
};

export const syncDoc = (
  path: string,
  callback: (data: any) => void
) => {
  return onSnapshot(doc(db, path), (snapshot) => {
    callback(snapshot.data());
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};

export const saveData = async (userId: string, collectionName: string, item: any) => {
  const path = `users/${userId}/${collectionName}/${item.id}`;
  try {
    await setDoc(doc(db, path), item);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteData = async (userId: string, collectionName: string, id: string) => {
  const path = `users/${userId}/${collectionName}/${id}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const clearShopRecords = async (userId: string) => {
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
