import {
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  FileCode,
  FileSpreadsheet,
  File as FileGeneric,
} from "lucide-react";

export function FileIcon({ mimeType, className = "size-6" }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith("image/")) return <ImageIcon className={`${className} text-pink-400`} />;
  if (mimeType.startsWith("video/")) return <Film className={`${className} text-violet-400`} />;
  if (mimeType.startsWith("audio/")) return <Music className={`${className} text-amber-400`} />;
  if (mimeType.includes("zip") || mimeType.includes("compressed") || mimeType.includes("tar"))
    return <Archive className={`${className} text-yellow-400`} />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return <FileSpreadsheet className={`${className} text-emerald-400`} />;
  if (mimeType.includes("javascript") || mimeType.includes("json") || mimeType.includes("html") || mimeType.includes("xml"))
    return <FileCode className={`${className} text-cyan-400`} />;
  if (mimeType.includes("pdf") || mimeType.startsWith("text/") || mimeType.includes("document"))
    return <FileText className={`${className} text-blue-400`} />;
  return <FileGeneric className={`${className} text-[var(--foreground-muted)]`} />;
}
