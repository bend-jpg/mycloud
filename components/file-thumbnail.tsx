"use client";

import { useState } from "react";
import { FileIcon } from "./file-icon";
import { isImageFile } from "@/lib/file-kinds";

/**
 * Affiche une vignette pour un fichier :
 *   - si c'est une image et qu'on n'a pas eu d'erreur de chargement → <img>
 *   - sinon → icône du type MIME
 */
export function FileThumbnail({
  fileId,
  mimeType,
  fileName = "",
  alt,
  className = "",
  iconClassName = "size-12",
}: {
  fileId: string;
  mimeType: string;
  /** Nom du fichier — sert à reconnaître une image quand le type MIME ne
   *  le dit pas (une photo peut arriver en application/octet-stream). */
  fileName?: string;
  alt?: string;
  className?: string;
  iconClassName?: string;
}) {
  const [errored, setErrored] = useState(false);
  const isImage = isImageFile(mimeType, fileName || alt || "") && !errored;

  if (!isImage) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <FileIcon mimeType={mimeType} className={iconClassName} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/files/${fileId}/preview?thumb=1`}
      alt={alt ?? ""}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`${className} object-cover pointer-events-none`}
      onError={() => setErrored(true)}
    />
  );
}
