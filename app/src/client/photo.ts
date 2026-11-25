// Photo resize (on the phone) and upload. Drawing to a canvas drops EXIF, including location.
import { api } from "./api";
import type { Photo } from "../shared/types";

export async function resizeImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("encode"))), "image/jpeg", 0.8));
}

export const OFFLINE_MSG = "تحتاجين اتصال بالإنترنت لرفع الصور";

export async function uploadPhoto(p: { file: File; date: string; caption: string; customer_id?: string; recipe_id?: string }): Promise<Photo> {
  if (!navigator.onLine) throw new Error(OFFLINE_MSG);
  const fd = new FormData();
  fd.append("file", await resizeImage(p.file), "photo.jpg");
  fd.append("date", p.date);
  fd.append("caption", p.caption);
  if (p.customer_id) fd.append("customer_id", p.customer_id);
  if (p.recipe_id) fd.append("recipe_id", p.recipe_id);
  return api.post<Photo>("/api/photos", fd);
}
