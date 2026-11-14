const EDGE = 512;
const JPEG_QUALITY = 0.6;
const MAX_BYTES = 2 * 1024 * 1024;

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

export const WORK_ORDER_PHOTO_LIMIT = 3;

export function isWorkOrderPhotoName(name: string) {
  return /\.(png|jpe?g|webp|gif)$/i.test(name);
}

export async function compressWorkOrderPhoto(file: File): Promise<File> {
  if (!ACCEPTED.has(file.type)) {
    throw new Error("Envie uma imagem PNG, JPG ou WebP.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("A imagem deve ter no máximo 2 MB.");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível processar a imagem.");
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => {
          if (value) resolve(value);
          else reject(new Error("Não foi possível processar a imagem."));
        },
        "image/jpeg",
        JPEG_QUALITY,
      );
    });

    const base = file.name.replace(/\.[^.]+$/, "").trim() || "foto";
    return new File([blob], `${base.slice(0, 176)}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
