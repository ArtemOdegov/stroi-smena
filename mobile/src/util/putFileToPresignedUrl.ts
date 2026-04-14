import { readUriAsArrayBuffer } from './readUriAsArrayBuffer';

/**
 * PUT по presigned URL. URL не переписываем: SigV4 привязан к хосту и query.
 * Только тело + Content-Type (как при подписи на бэкенде).
 */
export async function putFileToPresignedUrl(
  localUri: string,
  uploadUrl: string,
  contentType: string,
): Promise<void> {
  const buf = await readUriAsArrayBuffer(localUri);
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: buf,
  });
  if (!put.ok) {
    throw new Error(`Загрузка в хранилище: HTTP ${put.status}`);
  }
}
