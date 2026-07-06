import { useRef, useState } from "react";
import { uploadToCloudinary, isCloudinaryConfigured, type CloudinaryUploadResult } from "../lib/cloudinary";

interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
}

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
}

export default function ImageDropzone({ value, onChange, maxImages = 6 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState<UploadingFile[]>([]);

  const cloudinaryReady = isCloudinaryConfigured();

  async function processFiles(files: FileList | File[]) {
    setError("");

    if (!cloudinaryReady) {
      setError(
        "Cloudinary no está configurado. Edita frontend/.env y agrega VITE_CLOUDINARY_CLOUD_NAME + VITE_CLOUDINARY_UPLOAD_PRESET, luego reinicia el servidor."
      );
      return;
    }

    const fileArr = Array.from(files);
    const valid = fileArr.filter((f) => f.type.startsWith("image/"));
    if (valid.length === 0) {
      setError("Solo se permiten archivos de imagen.");
      return;
    }
    const oversized = valid.find((f) => f.size > 10 * 1024 * 1024);
    if (oversized) {
      setError(`La imagen "${oversized.name}" supera 10MB.`);
      return;
    }
    const remaining = maxImages - value.length;
    const toProcess = valid.slice(0, remaining);
    if (valid.length > remaining) {
      setError(`Máximo ${maxImages} imágenes. Se agregaron solo las primeras ${remaining}.`);
    }

    // Track uploads
    const uploads: UploadingFile[] = toProcess.map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      name: f.name,
      progress: 0,
    }));
    setUploading((prev) => [...prev, ...uploads]);

    // Upload in parallel
    const results = await Promise.allSettled(
      toProcess.map((file, i) =>
        uploadToCloudinary(file, (pct) => {
          setUploading((prev) =>
            prev.map((u) => (u.id === uploads[i].id ? { ...u, progress: pct } : u))
          );
        })
      )
    );

    // Remove from uploading list
    setUploading((prev) => prev.filter((u) => !uploads.some((up) => up.id === u.id)));

    const succeeded = results
      .filter((r): r is PromiseFulfilledResult<CloudinaryUploadResult> => r.status === "fulfilled")
      .map((r) => r.value.secure_url);

    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      const reason = (failures[0] as PromiseRejectedResult).reason;
      setError(`Error al subir ${failures.length} imagen(es): ${reason?.message || reason}`);
    }

    if (succeeded.length > 0) {
      onChange([...value, ...succeeded]);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) processFiles(e.target.files);
    e.target.value = "";
  }

  function removeImage(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function moveImage(from: number, to: number) {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <label style={{
        fontSize: "var(--t-xs)",
        fontWeight: 600,
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}>
        Imágenes del vehículo ({value.length}/{maxImages})
      </label>

      {!cloudinaryReady && (
        <div style={{
          padding: "10px 14px",
          background: "var(--warning-soft)",
          color: "var(--warning)",
          borderRadius: "var(--radius-sm)",
          fontSize: "var(--t-xs)",
          fontWeight: 500,
        }}>
          ⚠ Cloudinary no configurado. Define <code>VITE_CLOUDINARY_CLOUD_NAME</code> y <code>VITE_CLOUDINARY_UPLOAD_PRESET</code> en <code>frontend/.env</code>.
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); if (cloudinaryReady) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => cloudinaryReady && inputRef.current?.click()}
        style={{
          background: "var(--surface)",
          boxShadow: dragOver ? "var(--nm-out-md)" : "var(--nm-in-sm)",
          borderRadius: "var(--radius-md)",
          padding: "var(--sp-5) var(--sp-4)",
          textAlign: "center",
          cursor: cloudinaryReady ? "pointer" : "not-allowed",
          opacity: cloudinaryReady ? 1 : 0.55,
          transition: "box-shadow 0.2s",
          border: dragOver ? "2px dashed var(--primary)" : "2px dashed transparent",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleSelect}
          style={{ display: "none" }}
        />
        <div style={{
          width: 48, height: 48,
          margin: "0 auto var(--sp-3)",
          borderRadius: "50%",
          background: "var(--surface)",
          boxShadow: "var(--nm-out-sm)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.4rem",
          color: "var(--primary)",
        }}>
          ⬆
        </div>
        <p style={{ fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text)" }}>
          {dragOver ? "Suelta para subir a Cloudinary" : "Arrastra imágenes aquí o haz clic para seleccionar"}
        </p>
        <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)", marginTop: 4 }}>
          PNG, JPG, WEBP · máx. 10MB por imagen · hasta {maxImages} imágenes · subida a Cloudinary
        </p>
      </div>

      {/* Uploads in progress */}
      {uploading.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {uploading.map((u) => (
            <div key={u.id} style={{
              padding: "8px 12px",
              background: "var(--surface)",
              boxShadow: "var(--nm-in-sm)",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--t-xs)" }}>
                <span style={{ color: "var(--text-muted)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
                  ⬆ {u.name}
                </span>
                <span style={{ color: "var(--primary)", fontWeight: 600 }}>{u.progress}%</span>
              </div>
              <div style={{ height: 4, background: "var(--bg-deep)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${u.progress}%`,
                  background: "var(--primary)",
                  transition: "width 0.2s",
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{
          padding: "8px 12px",
          background: "var(--danger-soft)",
          color: "var(--danger)",
          borderRadius: "var(--radius-sm)",
          fontSize: "var(--t-xs)",
          fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      {value.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
          gap: "10px",
        }}>
          {value.map((url, i) => (
            <div
              key={i}
              style={{
                position: "relative",
                aspectRatio: "1",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                background: "var(--bg-deep)",
                boxShadow: i === 0 ? "var(--nm-out-md)" : "var(--nm-out-sm)",
              }}
            >
              <img src={url} alt={`img-${i}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {i === 0 && (
                <span style={{
                  position: "absolute",
                  top: 6, left: 6,
                  background: "var(--accent)",
                  color: "white",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "var(--radius-pill)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}>
                  Principal
                </span>
              )}
              <div style={{
                position: "absolute",
                bottom: 4, left: 4, right: 4,
                display: "flex",
                gap: 4,
                justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); moveImage(i, i - 1); }}
                      title="Mover a anterior"
                      style={{
                        width: 24, height: 24,
                        background: "rgba(255,255,255,0.92)",
                        color: "var(--text)",
                        border: "none",
                        borderRadius: "50%",
                        cursor: "pointer",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                      }}
                    >←</button>
                  )}
                  {i < value.length - 1 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); moveImage(i, i + 1); }}
                      title="Mover a siguiente"
                      style={{
                        width: 24, height: 24,
                        background: "rgba(255,255,255,0.92)",
                        color: "var(--text)",
                        border: "none",
                        borderRadius: "50%",
                        cursor: "pointer",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                      }}
                    >→</button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                  title="Eliminar"
                  style={{
                    width: 24, height: 24,
                    background: "var(--danger)",
                    color: "white",
                    border: "none",
                    borderRadius: "50%",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}
                >×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
