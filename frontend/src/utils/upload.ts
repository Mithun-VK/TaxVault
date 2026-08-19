/**
 * Is this a same-origin (local blob) upload URL rather than a cross-origin
 * R2/S3 presigned URL? Local blob URLs are relative ("/api/v1/documents/blob/…")
 * or point at our own origin; presigned URLs are absolute and cross-origin.
 */
function isSameOriginUrl(url: string): boolean {
  try {
    return new URL(url, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Upload a file to a presigned R2/S3 URL using XMLHttpRequest so we can report
 * upload progress (the fetch API does not expose upload progress events).
 *
 * The local-storage fallback ("/api/v1/documents/blob/…") is an authenticated,
 * same-origin endpoint, so we attach the bearer token for those. We must NOT
 * attach it to cross-origin R2 presigned URLs - that would leak the token to
 * the storage provider and break the presigned signature.
 */
export function uploadToR2(
  presignedUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    if (isSameOriginUrl(presignedUrl)) {
      const token = localStorage.getItem('access_token');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload aborted'));

    xhr.send(file);
  });
}

export function validateFile(
  file: File,
  acceptedTypes: string[],
  maxSize: number,
): string | null {
  if (acceptedTypes.length && !acceptedTypes.includes(file.type)) {
    return 'Unsupported file type. Please upload a PDF or image.';
  }
  if (file.size > maxSize) {
    return `File is too large. Maximum size is ${Math.round(maxSize / (1024 * 1024))} MB.`;
  }
  return null;
}
