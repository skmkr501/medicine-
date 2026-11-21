export type OutboxCollectionKey =
  | 'medicines'
  | 'patients'
  | 'doseLogs'
  | 'healthRecords'
  | 'appointments'
  | 'doctors'
  | 'phonebook';

export interface CloudSyncOutbox {
  upserts: Record<OutboxCollectionKey, string[]>;
  deletes: Record<OutboxCollectionKey, string[]>;
  settingsDirty: boolean;
}

export interface OutboxStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const OUTBOX_KEY_PREFIX = 'shasthobondhu_sync_outbox_v1_';

export function createEmptyOutbox(): CloudSyncOutbox {
  return {
    upserts: {
      medicines: [],
      patients: [],
      doseLogs: [],
      healthRecords: [],
      appointments: [],
      doctors: [],
      phonebook: [],
    },
    deletes: {
      medicines: [],
      patients: [],
      doseLogs: [],
      healthRecords: [],
      appointments: [],
      doctors: [],
      phonebook: [],
    },
    settingsDirty: false,
  };
}

function getSafeStorage(override?: OutboxStorageLike | null): OutboxStorageLike | null {
  if (override !== undefined) return override;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // ignore storage access failure
  }
  return null;
}

function getOutboxStorageKey(uid: string): string {
  return `${OUTBOX_KEY_PREFIX}${uid}`;
}

function normalizeIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      seen.add(item);
    }
  }
  return Array.from(seen);
}

export function loadCloudSyncOutbox(
  uid: string | null | undefined,
  storage?: OutboxStorageLike | null
): CloudSyncOutbox {
  if (!uid) return createEmptyOutbox();
  const store = getSafeStorage(storage);
  if (!store) return createEmptyOutbox();

  try {
    const raw = store.getItem(getOutboxStorageKey(uid));
    if (!raw) return createEmptyOutbox();
    const parsed = JSON.parse(raw) as Partial<CloudSyncOutbox>;
    const empty = createEmptyOutbox();
    const cols: OutboxCollectionKey[] = [
      'medicines',
      'patients',
      'doseLogs',
      'healthRecords',
      'appointments',
      'doctors',
      'phonebook',
    ];
    for (const col of cols) {
      empty.upserts[col] = normalizeIds(parsed?.upserts?.[col]);
      empty.deletes[col] = normalizeIds(parsed?.deletes?.[col]);
    }
    empty.settingsDirty = Boolean(parsed?.settingsDirty);
    return empty;
  } catch {
    return createEmptyOutbox();
  }
}

export function saveCloudSyncOutbox(
  uid: string | null | undefined,
  outbox: CloudSyncOutbox,
  storage?: OutboxStorageLike | null
): void {
  if (!uid) return;
  const store = getSafeStorage(storage);
  if (!store) return;

  try {
    if (countPendingOutboxChanges(outbox) === 0) {
      store.removeItem(getOutboxStorageKey(uid));
    } else {
      store.setItem(getOutboxStorageKey(uid), JSON.stringify(outbox));
    }
  } catch {
    // ignore storage write failure
  }
}

export function clearCloudSyncOutbox(
  uid: string | null | undefined,
  storage?: OutboxStorageLike | null
): void {
  if (!uid) return;
  const store = getSafeStorage(storage);
  if (!store) return;
  try {
    store.removeItem(getOutboxStorageKey(uid));
  } catch {
    // ignore storage delete failure
  }
}

export function countPendingOutboxChanges(outbox: CloudSyncOutbox): number {
  let count = outbox.settingsDirty ? 1 : 0;
  const cols: OutboxCollectionKey[] = [
    'medicines',
    'patients',
    'doseLogs',
    'healthRecords',
    'appointments',
    'doctors',
    'phonebook',
  ];
  for (const col of cols) {
    count += (outbox.upserts[col]?.length || 0) + (outbox.deletes[col]?.length || 0);
  }
  return count;
}

export function markOutboxUpsert(
  uid: string | null | undefined,
  collection: OutboxCollectionKey,
  idOrIds: string | string[],
  storage?: OutboxStorageLike | null
): CloudSyncOutbox {
  if (!uid) return createEmptyOutbox();
  const ids = (Array.isArray(idOrIds) ? idOrIds : [idOrIds]).filter(Boolean);
  const outbox = loadCloudSyncOutbox(uid, storage);
  if (ids.length === 0) return outbox;

  const upsertSet = new Set(outbox.upserts[collection]);
  const deleteSet = new Set(outbox.deletes[collection]);
  for (const id of ids) {
    upsertSet.add(id);
    deleteSet.delete(id);
  }
  outbox.upserts[collection] = Array.from(upsertSet);
  outbox.deletes[collection] = Array.from(deleteSet);
  saveCloudSyncOutbox(uid, outbox, storage);
  return outbox;
}

export function markOutboxDelete(
  uid: string | null | undefined,
  collection: OutboxCollectionKey,
  idOrIds: string | string[],
  storage?: OutboxStorageLike | null
): CloudSyncOutbox {
  if (!uid) return createEmptyOutbox();
  const ids = (Array.isArray(idOrIds) ? idOrIds : [idOrIds]).filter(Boolean);
  const outbox = loadCloudSyncOutbox(uid, storage);
  if (ids.length === 0) return outbox;

  const upsertSet = new Set(outbox.upserts[collection]);
  const deleteSet = new Set(outbox.deletes[collection]);
  for (const id of ids) {
    deleteSet.add(id);
    upsertSet.delete(id);
  }
  outbox.upserts[collection] = Array.from(upsertSet);
  outbox.deletes[collection] = Array.from(deleteSet);
  saveCloudSyncOutbox(uid, outbox, storage);
  return outbox;
}

export function markOutboxSettingsDirty(
  uid: string | null | undefined,
  dirty: boolean,
  storage?: OutboxStorageLike | null
): CloudSyncOutbox {
  if (!uid) return createEmptyOutbox();
  const outbox = loadCloudSyncOutbox(uid, storage);
  outbox.settingsDirty = dirty;
  saveCloudSyncOutbox(uid, outbox, storage);
  return outbox;
}

export function clearOutboxEntry(
  uid: string | null | undefined,
  kind: 'upsert' | 'delete',
  collection: OutboxCollectionKey,
  idOrIds: string | string[],
  storage?: OutboxStorageLike | null
): CloudSyncOutbox {
  if (!uid) return createEmptyOutbox();
  const ids = new Set((Array.isArray(idOrIds) ? idOrIds : [idOrIds]).filter(Boolean));
  const outbox = loadCloudSyncOutbox(uid, storage);
  if (ids.size === 0) return outbox;

  if (kind === 'upsert') {
    outbox.upserts[collection] = outbox.upserts[collection].filter((id) => !ids.has(id));
  } else {
    outbox.deletes[collection] = outbox.deletes[collection].filter((id) => !ids.has(id));
  }
  saveCloudSyncOutbox(uid, outbox, storage);
  return outbox;
}

const LAST_SYNC_MS_PREFIX = 'shasthobondhu_last_sync_ms_v1_';

export function getLastSuccessfulSyncMs(
  uid: string | null | undefined,
  storage?: OutboxStorageLike | null
): number {
  if (!uid) return 0;
  const store = getSafeStorage(storage);
  if (!store) return 0;
  try {
    const raw = store.getItem(`${LAST_SYNC_MS_PREFIX}${uid}`);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function setLastSuccessfulSyncMs(
  uid: string | null | undefined,
  ms: number,
  storage?: OutboxStorageLike | null
): void {
  if (!uid || !Number.isFinite(ms) || ms <= 0) return;
  const store = getSafeStorage(storage);
  if (!store) return;
  try {
    store.setItem(`${LAST_SYNC_MS_PREFIX}${uid}`, String(Math.floor(ms)));
  } catch {
    // ignore storage write failure
  }
}

export function isRecordModifiedSinceSync(
  record: { id: string; updatedAtMs?: number },
  lastSyncMs: number,
  outboxIdSet: Set<string>
): boolean {
  if (outboxIdSet.has(record.id)) return true;
  return typeof record.updatedAtMs === 'number' && record.updatedAtMs > lastSyncMs;
}

export interface SyncableSnapshotInput {
  medicines: Array<{ id: string; updatedAtMs?: number }>;
  patients: Array<{ id: string; updatedAtMs?: number }>;
  doseLogs: Array<{ id: string; updatedAtMs?: number }>;
  healthRecords: Array<{ id: string; updatedAtMs?: number }>;
  appointments: Array<{ id: string; updatedAtMs?: number }>;
  doctors?: Array<{ id: string }>;
  phonebook?: Array<{ id: string; updatedAtMs?: number }>;
}

export interface DocSyncQueueLike {
  upsertDocIds: string[];
  deleteDocIds: string[];
  uploadFiles: Array<{ fileId: string; docId: string }>;
  deleteFileIds: string[];
}

export interface DirtySyncPlan {
  outboxToFlush: CloudSyncOutbox;
  docOpsCount: number;
  collectionCounts: {
    medicines: number;
    patients: number;
    doseLogs: number;
    healthRecords: number;
    appointments: number;
    doctors: number;
    phonebook: number;
    settings: number;
    documents: number;
  };
  breakdownLabels: string[];
  totalWrites: number;
}

export function collectDirtySyncPlan(
  outbox: CloudSyncOutbox,
  snapshot: SyncableSnapshotInput,
  docQueue?: DocSyncQueueLike | null,
  lastSyncMs: number = 0
): DirtySyncPlan {
  const merged = createEmptyOutbox();
  merged.settingsDirty = outbox.settingsDirty;

  const mergeCollection = (
    key: 'medicines' | 'patients' | 'doseLogs' | 'healthRecords' | 'appointments' | 'phonebook',
    records: Array<{ id: string; updatedAtMs?: number }>
  ): number => {
    const deleteSet = new Set(outbox.deletes[key]);
    const outboxUpsertSet = new Set(outbox.upserts[key]);
    const upsertSet = new Set<string>();

    for (const rec of records) {
      if (deleteSet.has(rec.id)) continue;
      if (isRecordModifiedSinceSync(rec, lastSyncMs, outboxUpsertSet)) {
        upsertSet.add(rec.id);
      }
    }

    merged.upserts[key] = Array.from(upsertSet);
    merged.deletes[key] = Array.from(deleteSet);
    return merged.upserts[key].length + merged.deletes[key].length;
  };

  const medCount = mergeCollection('medicines', snapshot.medicines);
  const patCount = mergeCollection('patients', snapshot.patients);
  const logCount = mergeCollection('doseLogs', snapshot.doseLogs);
  const hrCount = mergeCollection('healthRecords', snapshot.healthRecords);
  const aptCount = mergeCollection('appointments', snapshot.appointments);
  const phonebookCount = mergeCollection('phonebook', snapshot.phonebook || []);

  const doctorMap = new Set((snapshot.doctors || []).map((d) => d.id));
  const doctorDeletes = new Set(outbox.deletes.doctors);
  merged.upserts.doctors = outbox.upserts.doctors.filter(
    (id) => doctorMap.has(id) && !doctorDeletes.has(id)
  );
  merged.deletes.doctors = Array.from(doctorDeletes);
  const doctorCount = merged.upserts.doctors.length + merged.deletes.doctors.length;

  const settingsCount = merged.settingsDirty ? 1 : 0;
  const docOpsCount = docQueue
    ? docQueue.upsertDocIds.length +
      docQueue.deleteDocIds.length +
      docQueue.uploadFiles.length +
      docQueue.deleteFileIds.length
    : 0;

  const totalWrites =
    medCount +
    patCount +
    logCount +
    hrCount +
    aptCount +
    doctorCount +
    phonebookCount +
    settingsCount +
    docOpsCount;

  const toBn = (n: number) =>
    String(n).replace(/[0-9]/g, (d) => ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'][Number(d)]);

  const breakdownLabels: string[] = [];
  if (medCount > 0) breakdownLabels.push(`ওষুধ (${toBn(medCount)}টি)`);
  if (logCount > 0) breakdownLabels.push(`ডোজ লগ (${toBn(logCount)}টি)`);
  if (patCount > 0) breakdownLabels.push(`প্রোফাইল (${toBn(patCount)}টি)`);
  if (hrCount > 0) breakdownLabels.push(`স্বাস্থ্য রেকর্ড (${toBn(hrCount)}টি)`);
  if (aptCount > 0) breakdownLabels.push(`অ্যাপয়েন্টমেন্ট (${toBn(aptCount)}টি)`);
  if (doctorCount > 0) breakdownLabels.push(`ডাক্তার (${toBn(doctorCount)}টি)`);
  if (phonebookCount > 0) breakdownLabels.push(`ফোনবুক (${toBn(phonebookCount)}টি)`);
  if (settingsCount > 0) breakdownLabels.push('সেটিংস (১টি)');
  if (docOpsCount > 0) breakdownLabels.push(`প্রেসক্রিপশন ও রিপোর্ট (${toBn(docOpsCount)}টি)`);

  return {
    outboxToFlush: merged,
    docOpsCount,
    collectionCounts: {
      medicines: medCount,
      patients: patCount,
      doseLogs: logCount,
      healthRecords: hrCount,
      appointments: aptCount,
      doctors: doctorCount,
      phonebook: phonebookCount,
      settings: settingsCount,
      documents: docOpsCount,
    },
    breakdownLabels,
    totalWrites,
  };
}
