"use client";

import React, { useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { uploadImage, type UploadPurpose } from '@/lib/uploadImage';

/** File picker styled like the site's outline buttons; uploads to Cloudinary and hands back the URL. */
export function ImageUploadButton({ purpose, onUploaded, label, className = '' }: {
  purpose: UploadPurpose;
  onUploaded: (url: string) => void | Promise<void>;
  label?: string;
  className?: string;
}) {
  const { t, addNotification } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await onUploaded(await uploadImage(file, purpose));
    } catch (err) {
      addNotification(err instanceof Error ? err.message : 'Upload fehlgeschlagen.', 'error');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className={`border border-zinc-700 px-4 py-3 text-sm uppercase tracking-widest hover:bg-zinc-900 transition-colors disabled:opacity-50 ${className}`}
      >
        {busy ? (t.admin?.dash?.uploading || 'Uploading…') : (label || t.admin?.dash?.uploadPhoto || 'Upload photo')}
      </button>
    </>
  );
}
