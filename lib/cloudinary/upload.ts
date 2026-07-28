export type UploadResult = {
  secureUrl: string;
  publicId: string;
};

type SignResponse = {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
  transformation: string;
};

/**
 * Client-side signed upload: fetches a signature from /api/uploads/sign,
 * then POSTs the file directly to Cloudinary (the binary never touches our
 * server). Uses XMLHttpRequest because fetch has no upload progress events.
 */
export async function uploadToCloudinary(
  file: File | Blob,
  folder: string,
  onProgress?: (fraction: number) => void
): Promise<UploadResult> {
  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder }),
  });
  if (!signRes.ok) {
    throw new Error("Could not prepare the upload. Please try again.");
  }
  const sign = (await signRes.json()) as SignResponse;

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sign.apiKey);
  form.append("timestamp", String(sign.timestamp));
  form.append("signature", sign.signature);
  form.append("folder", sign.folder);
  form.append("transformation", sign.transformation);

  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`
    );

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded / event.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({ secureUrl: data.secure_url, publicId: data.public_id });
        } catch {
          reject(new Error("Upload succeeded but the response was invalid."));
        }
      } else {
        let message = `Upload failed (${xhr.status}).`;
        try {
          const data = JSON.parse(xhr.responseText);
          if (data?.error?.message) message = `Upload failed: ${data.error.message}`;
        } catch {
          // keep generic message
        }
        reject(new Error(message));
      }
    };

    xhr.onerror = () =>
      reject(new Error("Network error during upload. Check your connection."));

    xhr.send(form);
  });
}
