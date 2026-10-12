"use client";

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { auth, getGoogleProvider } from '../lib/firebase';
import { EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup } from 'firebase/auth';

/**
 * Account Deletion Component (Art. 17 DSGVO - Right to Erasure)
 * Allows users to permanently delete their account and all associated data
 */

interface DeletionStep {
  id: string;
  label: string;
  status: 'pending' | 'current' | 'completed' | 'error';
}

const DELETION_STEPS: DeletionStep[] = [
  { id: 'confirm', label: 'Confirmation', status: 'current' },
  { id: 'reauth', label: 'Identity Check', status: 'pending' },
  { id: 'firestore', label: 'Delete Firestore Data', status: 'pending' },
  { id: 'auth', label: 'Delete Firebase Auth', status: 'pending' },
  { id: 'complete', label: 'Complete', status: 'pending' },
];

export function AccountDeletionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { currentUser, addNotification, logout } = useApp();
  const [step, setStep] = useState(0);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const REQUIRED_CONFIRMATION = 'DELETE MY ACCOUNT PERMANENTLY';
  // Google accounts have no password; they re-confirm via their provider popup.
  const usesPassword = !!auth.currentUser?.providerData.some(p => p.providerId === 'password');

  const handleNext = async () => {
    if (step === 0) {
      // Step 1: Show final confirmation
      if (confirmText !== REQUIRED_CONFIRMATION) {
        setError(`Please type exactly: "${REQUIRED_CONFIRMATION}"`);
        return;
      }
      setError(null);
      setStep(1);
    } else if (step === 1) {
      // Step 2: Password verification
      if (usesPassword && !password) {
        setError('Please enter your password');
        return;
      }
      setError(null);
      setIsDeleting(true);
      await performDeletion();
    }
  };

  const performDeletion = async () => {
    if (!currentUser || !auth.currentUser) {
      setError('Nicht angemeldet');
      setIsDeleting(false);
      return;
    }

    try {
      // Update steps
      const updateStepStatus = (id: string, status: DeletionStep['status']) => {
        setStep(prev => {
          const steps = DELETION_STEPS.map(s =>
            s.id === id ? { ...s, status } :
            (prev > DELETION_STEPS.indexOf(s) ? { ...s, status: 'completed' } : s)
          );
          return steps.findIndex(s => s.id === id);
        });
      };

      // Step: Re-authenticate
      updateStepStatus('reauth', 'current');
      if (usesPassword) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email || currentUser.email, password);
        await reauthenticateWithCredential(auth.currentUser, credential);
      } else {
        await reauthenticateWithPopup(auth.currentUser, getGoogleProvider());
      }

      // Step: Delete all data + the auth account server-side. Customers can't
      // delete appointments via Firestore rules, and staff notes, waitlist
      // entries and uploaded photos aren't reachable from the client at all.
      updateStepStatus('reauth', 'completed');
      updateStepStatus('firestore', 'current');

      const token = await auth.currentUser.getIdToken(true);
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw Object.assign(new Error(data.error || 'Server error'), {
          code: data.error === 'requires-recent-login' ? 'auth/requires-recent-login' : undefined,
        });
      }

      updateStepStatus('firestore', 'completed');
      updateStepStatus('auth', 'current');

      // Complete
      updateStepStatus('auth', 'completed');
      updateStepStatus('complete', 'current');

      addNotification('Your account and all data have been permanently deleted.', 'info');
      logout();
      onClose();

    } catch (caught) { const err = caught as { code?: string; message: string };
      console.error('Deletion failed:', err);

      let errorMsg = 'Deletion failed. ';
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setError(null);
        setIsDeleting(false);
        return;
      }
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMsg += 'Incorrect password.';
      } else if (err.code === 'auth/requires-recent-login') {
        errorMsg += 'Please log in again and try again.';
      } else if (err.code === 'permission-denied') {
        errorMsg += 'No permission. Please contact support.';
      } else {
        errorMsg += err.message;
      }

      setError(errorMsg);
      setIsDeleting(false);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
      setError(null);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  const currentStepInfo = DELETION_STEPS[step];

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md animate-in zoom-in-95">
        <div className="bg-black/95 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-zinc-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Delete Account</h3>
                <p className="text-sm text-zinc-400">Art. 17 DSGVO – Recht auf Vergessenwerden</p>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="space-y-2">
              {DELETION_STEPS.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                    s.status === 'completed' ? 'bg-green-500 border-green-500 text-white' :
                    s.status === 'current' ? 'border-yellow-500 text-yellow-500' :
                    s.status === 'error' ? 'bg-red-500 border-red-500 text-white' :
                    'border-gray-600 text-zinc-500'
                  }`}>
                    {s.status === 'completed' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : s.status === 'error' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span className={`text-sm ${
                    s.status === 'current' ? 'text-yellow-500 font-medium' :
                    s.status === 'completed' ? 'text-green-500' :
                    s.status === 'error' ? 'text-red-500' :
                    'text-zinc-500'
                  }`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Step 0: Confirmation Text */}
            {step === 0 && (
              <div>
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-4">
                  <p className="text-sm text-yellow-400 mb-2">
                    <strong>WARNING:</strong> This action is <strong>irreversible</strong>.
                  </p>
                  <ul className="text-sm text-zinc-300 space-y-1">
                    <li>• All your data will be permanently deleted (profile, appointments, notifications, loyalty points)</li>
                    <li>• This <strong>cannot be undone</strong></li>
                    <li>• Records required by law (invoices) are archived separately per statutory retention requirements</li>
                  </ul>
                </div>

                <p className="text-sm text-zinc-400 mb-2">
                  Please type the following text exactly to continue:
                </p>
                <code className="block px-3 py-2 bg-black border border-white/20 rounded text-yellow-500 text-sm font-mono mb-4">
                  {REQUIRED_CONFIRMATION}
                </code>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type confirmation text..."
                  className="w-full px-4 py-3 bg-black border border-white/20 rounded-lg text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none"
                  autoComplete="off"
                />
              </div>
            )}

            {/* Step 1: Password Verification */}
            {step === 1 && !isDeleting && !usesPassword && (
              <div>
                <p className="text-sm text-zinc-400 mb-4">
                  For security, please confirm with your Google sign-in.
                </p>
              </div>
            )}
            {step === 1 && !isDeleting && usesPassword && (
              <div>
                <p className="text-sm text-zinc-400 mb-4">
                  For security, please re-enter your password.
                </p>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Current Password"
                  className="w-full px-4 py-3 bg-black border border-white/20 rounded-lg text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none"
                  autoComplete="current-password"
                />
              </div>
            )}

            {/* Step 2-4: Deleting */}
            {isDeleting && (
              <div className="text-center py-8">
                <svg className="animate-spin mx-auto h-12 w-12 text-yellow-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="mt-4 text-white font-medium">{currentStepInfo.label}...</p>
                <p className="mt-2 text-sm text-zinc-500">Please do not close this window.</p>
              </div>
            )}

            {/* Step 5: Complete */}
            {step === DELETION_STEPS.length - 1 && !isDeleting && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-green-500 mb-2">Account Deleted</h4>
                <p className="text-zinc-400 text-sm">
                  All your personal data has been permanently removed.
                  Thank you for visiting Dhurdur.
                </p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-zinc-800 flex gap-3">
            <button
              onClick={handleBack}
              disabled={isDeleting || step === DELETION_STEPS.length - 1}
              className="flex-1 py-3 border border-white/30 text-white font-bold uppercase tracking-widest text-sm rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {step === 0 ? 'Cancel' : 'Back'}
            </button>
            <button
              onClick={handleNext}
              disabled={isDeleting || (step === 0 && confirmText !== REQUIRED_CONFIRMATION) || (step === 1 && usesPassword && !password)}
              className={`flex-1 py-3 font-bold uppercase tracking-widest text-sm rounded-lg transition-colors disabled:opacity-50 ${
                step === DELETION_STEPS.length - 1
                  ? 'bg-gray-600 text-zinc-400 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-500'
              }`}
            >
              {isDeleting ? 'Deleting...' : step === 0 ? 'Continue' : step === 1 ? 'DELETE PERMANENTLY' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Simple Delete Account Button for Profile Settings
 */
export function DeleteAccountButton({ onOpenModal }: { onOpenModal: () => void }) {
  return (
    <button
      onClick={onOpenModal}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm font-medium transition-colors"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      <span>Permanently Delete Account</span>
    </button>
  );
}