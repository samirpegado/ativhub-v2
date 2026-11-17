"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";

type PhotoSource = {
  phone: boolean;
  openGallery: () => void;
  openCamera: () => void;
};

export function PhotoSourcePicker({
  accept = "image/png,image/jpeg,image/webp",
  disabled,
  onFile,
  children,
}: {
  accept?: string;
  disabled?: boolean;
  onFile: (file: File | null) => void;
  children: (source: PhotoSource) => ReactNode;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const phone = usePhone();

  function pick(event: ChangeEvent<HTMLInputElement>) {
    onFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  return (
    <>
      {children({
        phone,
        openGallery: () => galleryRef.current?.click(),
        openCamera: () => cameraRef.current?.click(),
      })}
      <input ref={galleryRef} type="file" accept={accept} disabled={disabled} className="sr-only" onChange={pick} />
      {phone ? (
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" disabled={disabled} className="sr-only" onChange={pick} />
      ) : null}
    </>
  );
}

function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const narrow = window.matchMedia("(max-width: 900px)").matches;
    setPhone(mobile || (coarse && narrow));
  }, []);
  return phone;
}
