"use client";

import React, { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';

/**
 * Cookie Consent Management (TTDSG §25, Art. 7 DSGVO)
 * Granular consent for analytics cookies with proof of consent storage
 */

export type ConsentCategory = 'necessary' | 'analytics';

export interface ConsentState {
  necessary: boolean;  // Always true, cannot be disabled
  analytics: boolean;
  timestamp: string;   // ISO timestamp of consent
  version: string;     // Consent version for updates
}

const CONSENT_KEY = 'Dhurdur-consent';
const CONSENT_VERSION = '1.0';

// Default: only necessary cookies
const DEFAULT_CONSENT: ConsentState = {
  necessary: true,
  analytics: false,
  timestamp: new Date().toISOString(),
  version: CONSENT_VERSION,
};

interface CookieConsentContextType {
  consent: ConsentState;
  hasConsented: boolean;
  acceptAll: () => void;
  acceptNecessaryOnly: () => void;
  updateConsent: (category: ConsentCategory, value: boolean) => void;
  resetConsent: () => void;
  showBanner: boolean;
  setShowBanner: (show: boolean) => void;
}

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(undefined);

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  // Lazy initialization - read from localStorage during initial render
  const [consent, setConsent] = useState<ConsentState>(() => {
    if (typeof window === 'undefined') return DEFAULT_CONSENT;
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ConsentState;
        if (parsed.version === CONSENT_VERSION) {
          return parsed;
        }
      }
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_CONSENT;
  });
  
  const [showBanner, setShowBanner] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const initializedRef = useRef(false);

  // Check if we need to show banner (no consent stored or version mismatch)
  useEffect(() => {
    if (typeof window === 'undefined' || initializedRef.current) return;
    initializedRef.current = true;
    
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (!stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs with an external source (auth/Firestore/localStorage/clock/props), intentional
        setShowBanner(true);
      } else {
        const parsed = JSON.parse(stored) as ConsentState;
        if (parsed.version !== CONSENT_VERSION) {
          localStorage.removeItem(CONSENT_KEY);
          setShowBanner(true);
        }
      }
    } catch {
      setShowBanner(true);
    } finally {
      setHydrated(true);
    }
  }, []);

  // Save consent to localStorage
  const saveConsent = (newConsent: ConsentState) => {
    const consentWithMeta = {
      ...newConsent,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    setConsent(consentWithMeta);
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consentWithMeta));
    
    // Also log to Firestore for audit trail (optional)
    if (typeof window !== 'undefined' && window.navigator.onLine) {
      logConsentToServer(consentWithMeta).catch(console.warn);
    }
  };

  const acceptAll = () => {
    saveConsent({ necessary: true, analytics: true, timestamp: '', version: '' });
    setShowBanner(false);
  };

  const acceptNecessaryOnly = () => {
    saveConsent({ necessary: true, analytics: false, timestamp: '', version: '' });
    setShowBanner(false);
  };

  const updateConsent = (category: ConsentCategory, value: boolean) => {
    if (category === 'necessary') return; // Cannot disable necessary
    saveConsent({ ...consent, [category]: value });
  };

  const resetConsent = () => {
    localStorage.removeItem(CONSENT_KEY);
    setConsent(DEFAULT_CONSENT);
    setShowBanner(true);
  };

  return (
    <CookieConsentContext.Provider value={{
      consent,
      hasConsented: consent.analytics !== undefined, // Has made a choice
      acceptAll,
      acceptNecessaryOnly,
      updateConsent,
      resetConsent,
      showBanner: hydrated && showBanner,
      setShowBanner,
    }}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error('useCookieConsent must be used within CookieConsentProvider');
  }
  return context;
}

/**
 * Cookie Consent Banner Component (TTDSG §25 compliant)
 */
export function CookieConsentBanner() {
  const { consent, showBanner, acceptAll, acceptNecessaryOnly, updateConsent } = useCookieConsent();
  const [showDetails, setShowDetails] = useState(false);

  if (!showBanner) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-4 duration-300"
      role="dialog"
      aria-label="Cookie Settings"
      aria-describedby="cookie-consent-description"
    >
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="bg-black/95 backdrop-blur-sm border border-zinc-800 rounded-lg shadow-2xl overflow-hidden">
          {/* Main Banner */}
          <div className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1">
                <h3 id="cookie-consent-description" className="text-lg font-bold text-white mb-2">
                  We Respect Your Privacy
                </h3>
                <p className="text-sm text-zinc-300 mb-4">
                  We use cookies and similar technologies to make the website function
                  (necessary) and to analyze usage (analytics – <strong>only with your consent</strong>).
                  See our <a href="/privacy" className="underline hover:text-gold-400">Privacy Policy</a> for details.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <button
                  onClick={acceptAll}
                  className="flex-1 py-3 px-6 bg-yellow-500 text-black font-bold uppercase tracking-widest text-sm rounded-lg hover:bg-yellow-400 transition-colors"
                >
                  Accept All
                </button>
                <button
                  onClick={acceptNecessaryOnly}
                  className="flex-1 py-3 px-6 border border-white/30 text-white font-bold uppercase tracking-widest text-sm rounded-lg hover:bg-white/10 transition-colors"
                >
                  Necessary Only
                </button>
                <button
                  onClick={() => setShowDetails(true)}
                  className="flex-1 py-3 px-6 text-white/70 font-medium text-sm underline hover:text-white transition-colors"
                >
                  Customize Settings
                </button>
              </div>
            </div>
          </div>

          {/* Detailed Settings Modal */}
          {showDetails && (
            <div className="border-t border-zinc-800 p-4 md:p-6 bg-black/50">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-bold text-white">Cookie Settings</h4>
                <button
                  onClick={() => setShowDetails(false)}
                  className="p-2 text-zinc-400 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Necessary - Always enabled */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-zinc-800">
                  <div>
                    <label className="font-medium text-white">Necessary Cookies</label>
                    <p className="text-sm text-zinc-400 mt-1">
                      Enable core website functions (session, security, language settings).
                      These cookies cannot be disabled.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                    className="w-5 h-5 accent-yellow-500 cursor-not-allowed"
                    aria-disabled="true"
                  />
                </div>

                {/* Analytics - User choice */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-zinc-800">
                  <div>
                    <label className="font-medium text-white">Analytics Cookies (Firebase Analytics)</label>
                    <p className="text-sm text-zinc-400 mt-1">
                      Help us understand how visitors interact with the website (page views, clicks, devices).
                      Data is pseudonymized, IP addresses are anonymized. Retention period: 14 months.
                      <br />
                      <span className="text-xs text-zinc-500">Provider: Google (Firebase Analytics) – Standard Contractual Clauses</span>
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consent.analytics}
                      onChange={(e) => updateConsent('analytics', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:inset-s-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                  </label>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-800">
                <p className="text-xs text-zinc-500 text-center mb-4">
                  You can withdraw or change your consent at any time via the &quot;Cookie Settings&quot; link in the footer
                  or by deleting cookies in your browser.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={acceptAll}
                    className="flex-1 py-3 bg-yellow-500 text-black font-bold uppercase tracking-widest text-sm rounded-lg hover:bg-yellow-400 transition-colors"
                  >
                    Accept All & speichern
                  </button>
                  <button
                    onClick={acceptNecessaryOnly}
                    className="flex-1 py-3 border border-white/30 text-white font-bold uppercase tracking-widest text-sm rounded-lg hover:bg-white/10 transition-colors"
                  >
                    Necessary Only & speichern
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Server-side consent logging (optional)
 */
async function logConsentToServer(consent: ConsentState): Promise<void> {
  try {
    await fetch('/api/consent-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...consent,
        userAgent: navigator.userAgent,
        url: window.location.href,
      }),
      // Fire and forget - don't block UI
      keepalive: true,
    });
  } catch {
    // Silently fail - consent still stored locally
  }
}
