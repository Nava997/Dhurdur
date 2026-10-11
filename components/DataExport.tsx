"use client";

import React, { useState, useCallback } from 'react';
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

/**
 * Full Data Export Modal with preview
 */
export function DataExportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { currentUser, addNotification } = useApp();
  const [isExporting, setIsExporting] = useState(false);
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [previewJson, setPreviewJson] = useState<string>('');

  const loadData = useCallback(async () => {
    if (!currentUser) return;

    setIsExporting(true);
    try {
      const userRef = doc(db, 'users', currentUser.id);
      const userSnap = await getDoc(userRef);
      const profile = userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;

      const apptsQuery = query(collection(db, 'appointments'), where('userId', '==', currentUser.id));
      const apptsSnap = await getDocs(apptsQuery);
      const appointments = apptsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const alertsQuery = query(collection(db, 'alerts'), where('userId', '==', currentUser.id));
      const alertsSnap = await getDocs(alertsQuery);
      const alerts = alertsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const waitlistSnap = await getDocs(query(collection(db, 'waitlist'), where('userId', '==', currentUser.id)));
      const waitlist = waitlistSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const data: ExportData = {
        profile,
        appointments,
        alerts,
        waitlist,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      };

      setExportData(data);
      setPreviewJson(JSON.stringify(data, null, 2));
    } catch (caught) { const error = caught as { code?: string; message: string };
      addNotification(`Fehler beim Laden: ${error.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  }, [currentUser, addNotification]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs with an external source (auth/Firestore/localStorage/clock/props), intentional
    if (isOpen) loadData();
  }, [isOpen, loadData]);

  const handleDownload = () => {
    if (!exportData) return;

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `Dhurdur-datenexport-${currentUser?.id}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addNotification('Datenexport heruntergeladen!', 'success');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-3xl max-h-[90vh] bg-black border border-zinc-800 rounded-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="text-lg font-bold text-white">Datenexport (Art. 20 DSGVO)</h3>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[70vh]">
          <div className="mb-4">
            <p className="text-sm text-zinc-300 mb-2">
              Here you can download all your personal data in a machine-readable format (JSON).
              The export includes: profile, appointment history, notifications.
            </p>
            <p className="text-xs text-zinc-500">
              Legal basis: Art. 20 GDPR (Right to Data Portability)
            </p>
          </div>

          {isExporting ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-8 w-8 text-yellow-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="ml-3 text-white">Daten werden geladen...</span>
            </div>
          ) : exportData ? (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-white/5 rounded-lg border border-zinc-800 text-center">
                  <p className="text-2xl font-bold text-yellow-500">{exportData.profile ? 1 : 0}</p>
                  <p className="text-xs text-zinc-400">Profil</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg border border-zinc-800 text-center">
                  <p className="text-2xl font-bold text-yellow-500">{exportData.appointments.length}</p>
                  <p className="text-xs text-zinc-400">Termine</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg border border-zinc-800 text-center">
                  <p className="text-2xl font-bold text-yellow-500">{exportData.alerts.length}</p>
                  <p className="text-xs text-zinc-400">Benachrichtigungen</p>
                </div>
              </div>

              {/* JSON Preview */}
              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-white/5 border-b border-zinc-800">
                  <span className="text-sm font-medium text-white">JSON-Vorschau</span>
                  <span className="text-xs text-zinc-500">
                    {Math.round(new Blob([previewJson]).size / 1024)} KB
                  </span>
                </div>
                <pre className="p-4 max-h-96 overflow-auto text-xs text-zinc-300 font-mono bg-black">
                  {previewJson}
                </pre>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleDownload}
                  className="flex-1 py-3 bg-yellow-500 text-black font-bold uppercase tracking-widest text-sm rounded-lg hover:bg-yellow-400 transition-colors"
                >
                  JSON herunterladen
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-3 border border-white/30 text-white font-bold uppercase tracking-widest text-sm rounded-lg hover:bg-white/10 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-400">
              No data available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}