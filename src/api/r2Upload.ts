import client from './client';

export type R2UploadAsset = {
  uri: string;
  fileName?: string | null;
  type?: string | null;
};

type PresignedUrlResponse = {
  upload_url?: unknown;
  uploadUrl?: unknown;
  public_url?: unknown;
  publicUrl?: unknown;
  key?: unknown;
  signed_url?: unknown;
  signedUrl?: unknown;
  presigned_url?: unknown;
  presignedUrl?: unknown;
  data?: unknown;
  result?: unknown;
  presign?: unknown;
  upload?: unknown;
};

export type PresignedUploadTarget = {
  upload_url: string;
  public_url: string;
  key?: string;
};

function toSafeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function pickFirstString(source: Record<string, unknown>[], keys: string[]): string {
  for (const entry of source) {
    for (const key of keys) {
      const value = toSafeString(entry[key]).trim();
      if (value) return value;
    }
  }
  return '';
}

function derivePublicUrl(uploadUrl: string, key: string): string {
  const normalizedUploadUrl = uploadUrl.trim();
  const normalizedKey = key.trim();
  if (!normalizedUploadUrl || !normalizedKey) return '';

  const withoutQuery = normalizedUploadUrl.split('?')[0]?.trim() ?? '';
  return withoutQuery;
}

function normalizePresignedUrlResponse(value: unknown): PresignedUploadTarget {
  const root = toRecord(value) ?? {};
  const nestedCandidates = [
    toRecord(root.data),
    toRecord(root.result),
    toRecord(root.presign),
    toRecord(root.upload),
  ].filter((entry): entry is Record<string, unknown> => Boolean(entry));
  const candidates = [root, ...nestedCandidates];

  const upload_url = pickFirstString(candidates, [
    'upload_url',
    'uploadUrl',
    'signed_url',
    'signedUrl',
    'presigned_url',
    'presignedUrl',
    'url',
  ]);
  const key = pickFirstString(candidates, ['key', 'object_key', 'objectKey']);
  const public_url =
    pickFirstString(candidates, ['public_url', 'publicUrl', 'file_url', 'fileUrl']) ||
    derivePublicUrl(upload_url, key);

  if (!upload_url || !public_url) {
    throw new Error('Presigned URL non valida');
  }

  return key ? { upload_url, public_url, key } : { upload_url, public_url };
}

export function resolveUploadFilename(fileName: string | null | undefined, fallback: string): string {
  const normalized = typeof fileName === 'string' ? fileName.trim() : '';
  return normalized || fallback;
}

export function resolveUploadContentType(
  contentType: string | null | undefined,
  fallback = 'image/jpeg',
): string {
  const normalized = typeof contentType === 'string' ? contentType.trim() : '';
  return normalized || fallback;
}

export async function getPresignedUploadUrl(
  path: string,
  filename: string,
  contentType: string,
): Promise<PresignedUploadTarget> {
  const res = await client.get<PresignedUrlResponse>(path, {
    params: { filename, content_type: contentType },
  });
  return normalizePresignedUrlResponse(res.data);
}

export async function uploadToR2(
  uploadUrl: string,
  fileUri: string,
  contentType: string,
): Promise<void> {
  const fileResponse = await fetch(fileUri);
  if ('ok' in fileResponse && fileResponse.ok === false) {
    throw new Error('Impossibile leggere il file selezionato');
  }

  const blob = await fileResponse.blob();
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload R2 fallito: ${uploadResponse.status}`);
  }
}
