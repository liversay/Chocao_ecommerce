/**
 * Unsigned upload to Cloudinary.
 * Requires:
 *   VITE_CLOUDINARY_CLOUD_NAME  — your account's cloud name
 *   VITE_CLOUDINARY_UPLOAD_PRESET — an unsigned preset (Settings → Upload → Add upload preset → Signing Mode: Unsigned)
 *
 * The unsigned preset keeps API key + secret on Cloudinary's side; only the
 * cloud_name and preset name are public, which is safe to ship in the client.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET);
}

export async function uploadToCloudinary(
  file: File,
  onProgress?: (pct: number) => void
): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary no está configurado. Define VITE_CLOUDINARY_CLOUD_NAME y VITE_CLOUDINARY_UPLOAD_PRESET en frontend/.env"
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "chocao/vehicles");

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Respuesta inválida de Cloudinary"));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error?.message || "Error subiendo a Cloudinary"));
        } catch {
          reject(new Error(`Cloudinary respondió ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Error de red al subir a Cloudinary"));
    xhr.send(formData);
  });
}
