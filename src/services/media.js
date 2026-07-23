export async function compressImage(file, { maxDimension = 1600, quality = 0.82, outputType = "image/jpeg" } = {}) {
  if (!file?.type?.startsWith("image/")) throw new Error("Please select an image file.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, outputType, quality));
  if (!blob) throw new Error("The image could not be processed.");
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "evidence"}.jpg`, { type: outputType, lastModified: Date.now() });
}
