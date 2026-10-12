"use client";

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { auth } from '../lib/firebase';

/**
 * Data Export (Art. 15 / Art. 20 DSGVO). The server builds the file so it
 * includes everything held about the customer — staff notes, account
 * metadata and Cloudinary photos too, which the browser can't read itself.
 * Admins pass a uid to answer a request that arrived by email or phone.
 */
export async function downloadDataExport(uid?: string): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Nicht angemeldet');
  const res = await fetch('/api/account/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(uid ? { uid } : {}),
  });
  if (!res.ok) throw new Error(res.status === 429 ? 'Zu viele Anfragen — bitte später erneut versuchen' : `Fehler ${res.status}`);
  const data = await res.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Dhurdur-datenexport-${uid ?? auth.currentUser?.uid}-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function DataExportButton() {
  const { currentUser, addNotification, lang } = useApp();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!currentUser) return;
    setIsExporting(true);
    try {
      await downloadDataExport();
      addNotification(lang === 'de' ? 'Datenexport erfolgreich heruntergeladen!' : 'Data export downloaded!', 'success');
    } catch (caught) {
      const error = caught as Error;
      console.error('Export failed:', error);
      addNotification(`Export fehlgeschlagen: ${error.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting || !currentUser}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-zinc-800 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isExporting ? (
        <>
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Export wird vorbereitet...</span>
        </>
      ) : (
        <>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Meine Daten herunterladen (JSON)</span>
        </>
      )}
    </button>
  );
}
