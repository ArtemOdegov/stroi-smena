import * as SQLite from 'expo-sqlite';
import { randomUUID } from '../util/uuid';
import { putFileToPresignedUrl } from '../util/putFileToPresignedUrl';
import * as Location from 'expo-location';
import { presignUpload, upsertDayEntry } from '../api/dayEntries';

export type PendingDayPayload = {
  companyId: string;
  date: string;
  notes: string;
  /** Уже сохранённые на сервере ключи S3 — не перезагружать */
  remoteStorageKeys: string[];
  /** Локальные file:// — загрузить при синхронизации */
  localPhotoUris: string[];
  lat?: number | null;
  lng?: number | null;
  geoSource?: 'MANUAL' | 'AUTO' | null;
  geoAccuracy?: number | null;
  geoCapturedAt?: string | null;
  autoGeoOnSave?: boolean;
  clientMutationId: string;
  expectedVersion?: number | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('corp.db');
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS pending_ops (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          retryCount INTEGER NOT NULL DEFAULT 0,
          createdAt INTEGER NOT NULL
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

export async function enqueueDaySave(payload: PendingDayPayload) {
  const db = await getDb();
  const id = randomUUID();
  await db.runAsync(
    `INSERT INTO pending_ops (id, type, payload, status, retryCount, createdAt) VALUES (?, 'day_save', ?, 'pending', 0, ?)`,
    [id, JSON.stringify(payload), Date.now()],
  );
  return id;
}

export async function pendingCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM pending_ops WHERE status = 'pending'`,
  );
  return row?.c ?? 0;
}

async function uploadLocalToS3(localUri: string): Promise<string> {
  const extMatch = localUri.split('.').pop();
  const ext = extMatch && extMatch.length < 6 ? extMatch : 'jpg';
  const isPng = ext.toLowerCase() === 'png';
  const contentType = isPng ? 'image/png' : 'image/jpeg';
  const { uploadUrl, storageKey } = await presignUpload(contentType, ext);
  await putFileToPresignedUrl(localUri, uploadUrl, contentType);
  return storageKey;
}

export async function flushPendingQueue(): Promise<number> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    payload: string;
    retryCount: number;
  }>(
    `SELECT id, payload, retryCount FROM pending_ops WHERE status = 'pending' ORDER BY createdAt ASC LIMIT 10`,
  );

  let done = 0;
  for (const row of rows) {
    try {
      const p = JSON.parse(row.payload) as PendingDayPayload;
      let lat = p.lat ?? null;
      let lng = p.lng ?? null;
      let geoSource = p.geoSource ?? null;
      let geoAccuracy = p.geoAccuracy ?? null;
      let geoCapturedAt = p.geoCapturedAt ?? null;
      if (p.autoGeoOnSave) {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          geoSource = 'AUTO';
          geoAccuracy = pos.coords.accuracy ?? null;
          geoCapturedAt = new Date().toISOString();
        }
      }
      const uploaded: string[] = [];
      for (const uri of p.localPhotoUris) {
        uploaded.push(await uploadLocalToS3(uri));
      }
      const photos = [
        ...p.remoteStorageKeys.map((storageKey) => ({ storageKey })),
        ...uploaded.map((storageKey) => ({ storageKey })),
      ];
      await upsertDayEntry(p.companyId, p.date, {
        notes: p.notes,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        geoSource: geoSource ?? undefined,
        geoAccuracy: geoAccuracy ?? undefined,
        geoCapturedAt: geoCapturedAt ?? undefined,
        clientMutationId: p.clientMutationId,
        expectedVersion: p.expectedVersion ?? undefined,
        photos,
      });
      await db.runAsync(`DELETE FROM pending_ops WHERE id = ?`, [row.id]);
      done++;
    } catch {
      await db.runAsync(
        `UPDATE pending_ops SET retryCount = retryCount + 1 WHERE id = ?`,
        [row.id],
      );
    }
  }
  return done;
}
