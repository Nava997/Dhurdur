"use client";

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

/**
 * Data Export Component (Art. 20 DSGVO - Right to Data Portability)
 * Allows users to download all their personal data in JSON format
 */

interface ExportData {
  profile: Record<string, unknown> | null;
  appointments: Record<string, unknown>[];
  alerts: Record<string, unknown>[];
  waitlist: Record<string, unknown>[];
  exportedAt: string;
  version: string;
}

export function DataExportButton() {
  const { currentUser, addNotification } = useApp();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string>('');

  const handleExport = async () => {
    if (!currentUser) return;

    setIsExporting(true);
    setExportProgress('Loading profile...');

    try {
      // 1. Get user profile
      const userRef = doc(db, 'users', currentUser.id);
      const userSnap = await getDoc(userRef);
      const profile = userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;

      setExportProgress('Loading appointments...');

      // 2. Get appointments
      const apptsQuery = query(collection(db, 'appointments'), where('userId', '==', currentUser.id));
      const apptsSnap = await getDocs(apptsQuery);
      const appointments = apptsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setExportProgress('Loading notifications...');

      // 3. Get alerts
      const alertsQuery = query(collection(db, 'alerts'), where('userId', '==', currentUser.id));
      const alertsSnap = await getDocs(alertsQuery);
      const alerts = alertsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const waitlistSnap = await getDocs(query(collection(db, 'waitlist'), where('userId', '==', currentUser.id)));
      const waitlist = waitlistSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setExportProgress('Export vorbereiten...');

      // 4. Compile export data
      const exportData: ExportData = {
        profile,
        appointments,
        alerts,
        waitlist,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      };

      // 5. Create download
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `Dhurdur-datenexport-${currentUser.id}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportProgress('');
      addNotification('Datenexport erfolgreich heruntergeladen!', 'success');

    } catch (caught) { const error = caught as { code?: string; message: string };
      console.error('Export failed:', error);
      addNotification(`Export fehlgeschlagen: ${error.message}`, 'error');
      setExportProgress('');
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
          <span>{exportProgress || 'Export wird vorbereitet...'}</span>
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
