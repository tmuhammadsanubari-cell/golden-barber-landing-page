// Unggah gambar dari browser (PRD F-21): minta URL bertanda tangan ke server, lalu PUT berkas
// langsung ke storage dengan progres. Hanya untuk kode client (island admin).
import { checkUploadFile, type UploadFolder } from '@/lib/media';
import { callApi } from './client';

export interface UploadedImage {
  /** Path di bucket: simpan ke `image_path` / `photo_path`. */
  path: string;
  /** URL publik untuk pratinjau. */
  publicUrl: string;
}

export type UploadOutcome = { ok: true; image: UploadedImage } | { ok: false; message: string };

interface SignedUpload {
  upload_url: string;
  path: string;
  public_url: string;
}

function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<string | null> {
  return new Promise((resolve) => {
    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', file); // bentuk yang diminta storage untuk unggah bertanda tangan
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => resolve('Koneksi bermasalah. Coba lagi.');
    request.onload = () =>
      resolve(
        request.status >= 200 && request.status < 300
          ? null
          : 'Unggah ditolak server. Pastikan file JPG, PNG, atau WebP di bawah 3 MB.',
      );
    request.send(body);
  });
}

/** Periksa berkas di sisi client, lalu unggah. Pesan galat sudah Bahasa Indonesia. */
export async function uploadImage(
  file: File,
  folder: UploadFolder,
  onProgress: (percent: number) => void = () => {},
): Promise<UploadOutcome> {
  const problem = checkUploadFile(file);
  if (problem) return { ok: false, message: problem };

  const signed = await callApi<SignedUpload>('POST', '/api/admin/uploads', {
    folder,
    content_type: file.type,
    size: file.size,
  });
  if (!signed.success) return { ok: false, message: signed.error.message };

  const failure = await putWithProgress(signed.data.upload_url, file, onProgress);
  if (failure) return { ok: false, message: failure };
  return { ok: true, image: { path: signed.data.path, publicUrl: signed.data.public_url } };
}
