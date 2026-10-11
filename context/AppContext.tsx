"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, getGoogleProvider, getFacebookProvider } from '../lib/firebase';
import { fallbackTranslations, type TranslationData } from '../lib/translations';
export { fallbackTranslations };
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, verifyBeforeUpdateEmail, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, setDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, getDoc, DocumentReference, query, where } from 'firebase/firestore';

type Language = string;
type Page = 'home' | 'services' | 'gallery' | 'products' | 'contact' | 'booking' | 'admin' | 'auth' | 'profile';

export type UserProfile = { id: string; name: string; email: string; phone: string; haircutCount: number; role: 'user' | 'admin'; photoURL?: string; hasUpdatedPassword?: boolean; };

export type Appointment = {
  id: string; userId: string; name: string; phone: string;
  services: string[]; totalDurationMins: number; stylist: string;
  date: string; time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'proposed' | 'blocked';
  proposedDate?: string; proposedTime?: string;
  sendsms: boolean; usedReward: boolean; notes?: string; isEmergency?: boolean;
  referenceImage?: string;
  specialRequests?: string;
};

export type WaitlistItem = { id: string; userId: string; name: string; phone: string; date: string; stylist: string; createdAt: number; };

// Phase 4 Dynamic Management Types
export type StylistItem = { id: string; name: string; services: string[] };
export type GeneralSettings = { walkinWaitTime: string; holidays: string[] };

export type Alert = { id: string; userId: string; message: string; isRead: boolean; link: Page; createdAt: number };
export type ServiceItem = { id: string; name: string; price: string; oldPrice?: string; durationMins: number };
export type ProductItem = { id: string; name: string; price: string; desc: string; image: string; stockCount?: number; };
export type Notification = { id: number; message: string; type: 'success' | 'info' | 'error' };
export type TimeSlot = { id: string; time: string; isBooked: boolean };
export type { TranslationData } from "../lib/translations";

const initialSlots: TimeSlot[] = [
  { id: 't1', time: '09:00', isBooked: false }, { id: 't2', time: '10:00', isBooked: false },
  { id: 't3', time: '11:00', isBooked: false }, { id: 't4', time: '13:00', isBooked: false },
  { id: 't5', time: '14:00', isBooked: false }, { id: 't6', time: '15:30', isBooked: false },
];

export interface AppContextType {
  lang: Language; setLang: (lang: Language) => void;
  changeLanguage: (newLang: string) => Promise<void>;
  isTranslatingUI: boolean;
  page: Page; setPage: (page: Page) => void;
  t: any; updateTranslation: (lang: Language, section: string, key: string, val: string) => Promise<void>;
  isAdminAuth: boolean;
  currentUser: UserProfile | null;
  usersDB: UserProfile[]; clientNotesDB: Record<string, string>; updateUserNotes: (id: string, notes: string) => Promise<void>;
  loginOAuth: (provider: 'Google' | 'Facebook') => Promise<void>;
  loginEmail: (email: string, pass: string) => Promise<void>;
  registerEmail: (email: string, pass: string, name: string, phone?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  requestPasswordOtp: () => Promise<void>;
  updateUserPassword: (oldPass: string, newPass: string, code: string) => Promise<void>;
  logout: () => void;
  appointments: Appointment[];
  addAppointment: (appt: Omit<Appointment, 'id'>) => Promise<DocumentReference | undefined>;
  addAdminAppointment: (appt: Omit<Appointment, 'id'>) => Promise<void>;
  updateAppointmentStatus: (id: string, status: Appointment['status'], sendsms: boolean, notes?: string, proposedDate?: string, proposedTime?: string) => Promise<void>;
  servicesDB: ServiceItem[]; addService: (s: Omit<ServiceItem, 'id'>) => Promise<void>; deleteService: (id: string) => Promise<void>;
  productsDB: ProductItem[]; addProduct: (p: Omit<ProductItem, 'id'>) => Promise<void>; deleteProduct: (id: string) => Promise<void>;
  updateProductStock: (id: string, newStock: number) => Promise<void>;
  // Phase 4 Dynamic Actions
  stylistsDB: StylistItem[]; addStylist: (s: Omit<StylistItem, 'id'>) => Promise<void>; deleteStylist: (id: string) => Promise<void>;
  generalSettings: GeneralSettings; updateGeneralSettings: (settings: Partial<GeneralSettings>) => Promise<void>;
  waitlist: WaitlistItem[]; addToWaitlist: (item: Omit<WaitlistItem, 'id' | 'createdAt'>) => Promise<void>; removeFromWaitlist: (id: string) => Promise<void>; notifyWaitlist: (item: WaitlistItem) => Promise<void>; resendConfirmation: (id: string) => Promise<void>;
  notifications: Notification[]; addNotification: (msg: string, type?: 'success' | 'info' | 'error') => void;
  alerts: Alert[]; markAlertRead: (id: string) => Promise<void>; clearAlerts: () => Promise<void>;
  getAvailableSlots: (date: string, stylist: string, requiredDuration?: number) => TimeSlot[];
  getTranslatedServices: () => ServiceItem[];
  getTranslatedStylists: () => StylistItem[];
  getTranslatedGeneralSettings: () => GeneralSettings;
}


const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>('de');
  const [isTranslatingUI, setIsTranslatingUI] = useState(false);
  const [page, setPageState] = useState<Page>('home');
  const [translations, setTranslations] = useState<TranslationData>(fallbackTranslations);

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [usersDB, setUsersDB] = useState<UserProfile[]>([]);
  const [clientNotesDB, setClientNotesDB] = useState<Record<string, string>>({});

  const [servicesDB, setServicesDB] = useState<ServiceItem[]>([]);
  const [productsDB, setProductsDB] = useState<ProductItem[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [publicAppointments, setPublicAppointments] = useState<
    Pick<Appointment, "date" | "time" | "stylist" | "totalDurationMins" | "status" | "proposedTime">[]
  >([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistItem[]>([]);

  // Phase 4 Dynamic State
  const [stylistsDB, setStylistsDB] = useState<StylistItem[]>([]);
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({ walkinWaitTime: 'ca. 30 Minuten', holidays: [] });

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@Dhurdur.com';

  const getAuthHeaders = async () => {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const addNotification = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
  };

  const markAlertRead = async (id: string) => {
    await updateDoc(doc(db, 'alerts', id), { isRead: true });
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
  };

  const clearAlerts = async () => {
    if (!currentUser) return;
    const userAlerts = alerts.filter(a => a.userId === currentUser.id);
    for (const a of userAlerts) {
      await deleteDoc(doc(db, 'alerts', a.id));
    }
    setAlerts(prev => prev.filter(a => a.userId !== currentUser.id));
  };

  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash.replace('#', '') as Page;
      if (['home', 'services', 'gallery', 'products', 'contact', 'booking', 'admin', 'auth', 'profile'].includes(hash)) {
        setPageState(hash);
      } else {
        setPageState('home');
      }
    };
    handlePopState();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setPageRouter = (newPage: Page) => {
    if (newPage !== page) {
      if ((newPage === 'booking' || newPage === 'profile') && !currentUser) {
        window.history.pushState(null, '', '#auth');
        setPageState('auth');
        return;
      }
      if (newPage === 'admin' && (!currentUser || currentUser.role !== 'admin')) {
        addNotification("Admin access required.", 'error');
        return;
      }
      const newUrl = newPage === 'home' ? window.location.pathname : `#${newPage}`;
      window.history.pushState(null, '', newUrl);
      setPageState(newPage);
      window.scrollTo(0, 0);
    }
  };

  useEffect(() => {
    if (currentUser && page === 'auth') {
      setPageRouter('profile');
    }
  }, [currentUser, page, setPageRouter]);

  // Auth state + own profile only. Appointments/alerts moved to their own
  // effect below, scoped by role, so a regular customer never subscribes to
  // the full collection (see firestore.rules — read is owner-or-admin only).
  useEffect(() => {
    let unsubUser: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const profile = docSnap.data() as UserProfile;
            setCurrentUser(profile);
            setIsAdminAuth(profile.role === 'admin');
          } else {
            const newProfile: UserProfile = { id: user.uid, name: user.displayName || 'Client', email: user.email || '', phone: '', haircutCount: 0, role: 'user' };
            setDoc(doc(db, 'users', user.uid), newProfile);
            setCurrentUser(newProfile);
            setIsAdminAuth(false);
          }
        }, (error) => console.error("🚨 CRASH ON COLLECTION 'users' (Individual Doc):", error.message));
      } else {
        setCurrentUser(null);
        setIsAdminAuth(false);
        if (unsubUser) { unsubUser(); unsubUser = null; }
      }
    });

    const unsubTrans = onSnapshot(doc(db, 'settings', 'translations'), (snap) => {
      if (snap.exists()) setTranslations({ ...fallbackTranslations, ...(snap.data() as TranslationData) });
    }, (error) => console.error("🚨 CRASH ON 'settings/translations':", error.message));

    const unsubSrv = onSnapshot(collection(db, 'services'), (snap) => {
      setServicesDB(snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceItem)));
    }, (error) => console.error("🚨 CRASH ON COLLECTION 'services':", error.message));

    const unsubProd = onSnapshot(collection(db, 'products'), (snap) => {
      setProductsDB(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductItem)));
    }, (error) => console.error("🚨 CRASH ON COLLECTION 'products':", error.message));

    const unsubStylists = onSnapshot(collection(db, 'stylists'), (snap) => {
      setStylistsDB(snap.docs.map(d => ({ id: d.id, ...d.data() } as StylistItem)));
    }, (error) => console.error("🚨 CRASH ON COLLECTION 'stylists':", error.message));

    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) setGeneralSettings({ walkinWaitTime: 'ca. 30 Minuten', holidays: [], ...snap.data() });
    }, (error) => console.error("🚨 CRASH ON 'settings/general':", error.message));

    return () => {
      unsubAuth(); unsubTrans(); unsubSrv(); unsubProd(); unsubStylists(); unsubSettings();
      if (unsubUser) unsubUser();
    };
  }, []);

  // Appointments & alerts, scoped by role: admins see everything (needed for
  // the dashboard), regular customers only ever query their OWN records —
  // matching the owner-or-admin read rule in firestore.rules. Re-subscribes
  // whenever the logged-in user or their admin status changes.
  useEffect(() => {
    let unsubAppts: (() => void) | null = null;
    let unsubAlerts: (() => void) | null = null;

    if (currentUser) {
      const apptsRef = isAdminAuth
        ? collection(db, 'appointments')
        : query(collection(db, 'appointments'), where('userId', '==', currentUser.id));
      unsubAppts = onSnapshot(apptsRef, (snap) => {
        setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
      }, (error) => console.error("🚨 CRASH ON COLLECTION 'appointments':", error.message));

      const alertsRef = isAdminAuth
        ? collection(db, 'alerts')
        : query(collection(db, 'alerts'), where('userId', '==', currentUser.id));
      unsubAlerts = onSnapshot(alertsRef, (snap) => {
        setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Alert)));
      }, (error) => console.error("🚨 CRASH ON COLLECTION 'alerts':", error.message));
    } else {
      setAppointments([]);
      setAlerts([]);
    }

    return () => {
      if (unsubAppts) unsubAppts();
      if (unsubAlerts) unsubAlerts();
    };
  }, [currentUser, isAdminAuth]);

  useEffect(() => {
    let unsubUsersDB: (() => void) | null = null;
    let unsubWaitlist: (() => void) | null = null;
    let unsubClientNotes: (() => void) | null = null;

    if (isAdminAuth) {
      unsubUsersDB = onSnapshot(collection(db, 'users'), (snap) => {
        setUsersDB(snap.docs.map(d => ({ ...d.data() } as UserProfile)));
      }, (error) => console.error("🚨 CRASH ON COLLECTION 'users' (Admin List):", error.message));

      unsubWaitlist = onSnapshot(collection(db, 'waitlist'), (snap) => {
        setWaitlist(snap.docs.map(d => ({ id: d.id, ...d.data() } as WaitlistItem)));
      }, (error) => console.error("🚨 CRASH ON COLLECTION 'waitlist':", error.message));

      unsubClientNotes = onSnapshot(collection(db, 'clientNotes'), (snap) => {
        const notesMap: Record<string, string> = {};
        snap.docs.forEach(d => { notesMap[d.id] = (d.data() as any).notes || ''; });
        setClientNotesDB(notesMap);
      }, (error) => console.error("🚨 CRASH ON COLLECTION 'clientNotes':", error.message));
    } else {
      setUsersDB([]);
      setWaitlist([]);
      setClientNotesDB({});
    }

    return () => {
      if (unsubUsersDB) unsubUsersDB();
      if (unsubWaitlist) unsubWaitlist();
      if (unsubClientNotes) unsubClientNotes();
    };
  }, [isAdminAuth]);

  // PII-free availability data for slot checking (works for guests + customers)
  useEffect(() => {
    let cancelled = false;
    const fetchSlots = async () => {
      try {
        const res = await fetch("/api/available-slots", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) setPublicAppointments(data.slots || []);
      } catch (e) {
        console.error("🚨 Failed to load availability:", e);
      }
    };
    fetchSlots();
    const interval = setInterval(fetchSlots, 30000); // keep availability fresh while the app is open
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const changeLanguage = async (newLang: string) => {
    if (newLang === lang) return;
    if (newLang === 'de' || translations[newLang]) {
      setLang(newLang);
      return;
    }

    setIsTranslatingUI(true);
    try {
      const res = await fetch('/api/translate-ui', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ targetLang: newLang })
      });
      const data = await res.json();
      if (data.translatedDict) {
        setTranslations(prev => ({ ...prev, [newLang]: data.translatedDict }));
        setLang(newLang);
        addNotification(`Interface in neuer Sprache geladen!`, 'success');
      } else {
        addNotification(data.error || 'Übersetzung fehlgeschlagen.', 'error');
        setLang('de');
      }
    } catch (e) {
      addNotification('Übersetzung fehlgeschlagen.', 'error');
      setLang('de');
    } finally {
      setIsTranslatingUI(false);
    }
  };

  const timeToMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const getAvailableSlots = (date: string, stylist: string, requiredDuration: number = 60) => {
    if (!date) return initialSlots.map(s => ({ ...s, isBooked: false }));

    // Phase 4: Block Global Holidays Automatically
    if (generalSettings.holidays && generalSettings.holidays.includes(date)) {
        return initialSlots.map(s => ({ ...s, isBooked: true }));
    }

    // Closed on Sundays
    const [y, m, d] = date.split('-').map(Number);
    if (new Date(y, m - 1, d).getDay() === 0) {
        return initialSlots.map(s => ({ ...s, isBooked: true }));
    }

    // Slots earlier today can't be booked anymore
    const nowDate = new Date();
    const todayStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;
    const nowMins = date === todayStr ? nowDate.getHours() * 60 + nowDate.getMinutes() : -1;

    const realStylists = stylistsDB.length > 0 ? stylistsDB.map(s => s.name) : ["Oliver Hayes", "Sophia Bennett", "Marcus Steele"];

    return initialSlots.map(slot => {
      const slotMins = timeToMins(slot.time);

      let isBooked = false;
      if (stylist && stylist !== 'Egal (Wer frei ist)' && stylist !== 'Any' && stylist !== translations[lang]?.booking?.stylistAny) {
        isBooked = publicAppointments.some(a => {
          if (a.date !== date || (a.status !== 'confirmed' && a.status !== 'pending' && a.status !== 'proposed' && a.status !== 'blocked')) return false;
          if (a.stylist !== stylist && a.stylist !== 'Egal (Wer frei ist)' && a.stylist !== 'Any' && a.stylist !== translations[lang]?.booking?.stylistAny) return false;

          const aStart = (a.status === 'proposed' && a.proposedTime) ? timeToMins(a.proposedTime) : timeToMins(a.time);
          const aEnd = aStart + (a.totalDurationMins || 60);

          const newStart = slotMins;
          const newEnd = slotMins + requiredDuration;

          return newStart < aEnd && newEnd > aStart;
        });
      } else {
        let overlaps = 0;
        realStylists.forEach(sName => {
          const sBooked = publicAppointments.some(a => {
            if (a.date !== date || (a.status !== 'confirmed' && a.status !== 'pending' && a.status !== 'proposed' && a.status !== 'blocked')) return false;
            if (a.stylist !== sName && a.stylist !== 'Egal (Wer frei ist)' && a.stylist !== 'Any' && a.stylist !== translations[lang]?.booking?.stylistAny) return false;

            const aStart = (a.status === 'proposed' && a.proposedTime) ? timeToMins(a.proposedTime) : timeToMins(a.time);
            const aEnd = aStart + (a.totalDurationMins || 60);
            return slotMins < aEnd && (slotMins + requiredDuration) > aStart;
          });
          if (sBooked) overlaps++;
        });
        isBooked = overlaps >= realStylists.length;
      }

      return { ...slot, isBooked: isBooked || slotMins <= nowMins };
    });
  };

  const loginOAuth = async (providerName: 'Google' | 'Facebook') => {
    try {
      const provider = providerName === 'Google' ? getGoogleProvider() : getFacebookProvider();
      await signInWithPopup(auth, provider);
      setPageRouter('profile');
      addNotification(`Logged in with ${providerName}`, 'success');
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') return;
      addNotification(error.message, 'error');
    }
  };

  const loginEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      setPageRouter('profile');
      addNotification("Login successful", 'success');
    } catch (error: any) { addNotification(error.message, 'error'); }
  };

  const registerEmail = async (email: string, pass: string, name: string, phone?: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      const cleanPhone = phone ? phone.replace(/\s+/g, '') : '';
      await setDoc(doc(db, 'users', cred.user.uid), {
        id: cred.user.uid, name, email, phone: cleanPhone, haircutCount: 0, role: 'user'
      });
      setPageRouter('profile');
      addNotification("Account created and verified successfully!", 'success');
    } catch (error: any) {
      addNotification(error.message, 'error');
    }
  };

  const resetPassword = async (email: string) => {
    if (!email) return addNotification("Please enter your email address first.", 'error');
    try {
      await sendPasswordResetEmail(auth, email);
      addNotification("Password reset email sent! Check your inbox.", 'success');
    } catch (error: any) { addNotification(error.message, 'error'); }
  };

  const logout = () => { signOut(auth); setPageRouter('home'); };

  // Server generates, stores (hashed) and e-mails the confirmation code.
  const requestPasswordOtp = async () => {
    const res = await fetch('/api/password/otp', { method: 'POST', headers: await getAuthHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Error sending code.');
    }
  };

  // Re-authenticate with the current password, then let the server verify the
  // e-mailed code and set the new password — the code check can't be bypassed
  // from the browser.
  const updateUserPassword = async (oldPass: string, newPass: string, code: string) => {
    if (!auth.currentUser || !currentUser) throw new Error("Nicht angemeldet.");
    const email = auth.currentUser.email || currentUser.email;
    const credential = EmailAuthProvider.credential(email, oldPass);
    await reauthenticateWithCredential(auth.currentUser, credential);

    const token = await auth.currentUser.getIdToken(true);
    const res = await fetch('/api/password/change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ code, newPassword: newPass }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Passwortänderung fehlgeschlagen.');
    }

    // A password change revokes existing sessions; sign straight back in.
    await signInWithEmailAndPassword(auth, email, newPass);
    addNotification("Passwort erfolgreich aktualisiert!", "success");
  };

  const updateUserNotes = async (id: string, notes: string) => {
    if (!isAdminAuth) return;
    await setDoc(doc(db, 'clientNotes', id), { notes, updatedAt: Date.now() }, { merge: true });
    addNotification("Stylisten-Notizen gespeichert!", "success");
  };

  const updateTranslation = async (l: Language, section: string, key: string, val: string) => {
    if (!isAdminAuth) return;
    await updateDoc(doc(db, 'settings', 'translations'), { [`${l}.${section}.${key}`]: val });
    addNotification("Translation saved via Cloud!", 'success');
  };

  const sendDualEmail = async (uEmail: string | null, uSubj: string, uMsg: string, aSubj: string, aMsg: string) => {
    try {
      const headers = await getAuthHeaders();
      if (uEmail) {
        fetch('/api/email', { method: 'POST', headers, body: JSON.stringify({ email: uEmail, subject: uSubj, message: uMsg }) }).catch(()=>{});
      }
      if (aSubj && aMsg) {
        fetch('/api/email', { method: 'POST', headers, body: JSON.stringify({ email: adminEmail, subject: aSubj, message: aMsg }) }).catch(()=>{});
      }
    } catch (e) {
      console.error("Dual Email Execution Failed", e);
    }
  };

  const addToWaitlist = async (item: Omit<WaitlistItem, 'id' | 'createdAt'>) => {
    await addDoc(collection(db, 'waitlist'), { ...item, createdAt: Date.now() });
    addNotification("Auf die Warteliste gesetzt!", 'success');
  };

  const removeFromWaitlist = async (id: string) => {
    await deleteDoc(doc(db, 'waitlist', id));
    addNotification("Von Warteliste entfernt.", 'info');
  };

  const notifyWaitlist = async (item: WaitlistItem) => {
    if (item.phone) {
      const cleanPhone = item.phone.replace(/\s+/g, '');
      fetch('/api/sms', { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify({ phone: cleanPhone, message: `Dhurdur: Ein Termin am ${item.date} bei ${item.stylist} ist freigeworden! Buche jetzt online.` }) }).catch(()=>{});
    }
    const userDoc = await getDoc(doc(db, 'users', item.userId));
    const userEmail = userDoc.exists() ? userDoc.data().email : null;
    if (userEmail) {
      await sendDualEmail(
        userEmail,
        "Dhurdur: Warteliste Update - Freier Termin!",
        `Hallo ${item.name},\n\nGute Neuigkeiten! Ein Termin am ${item.date} bei ${item.stylist} ist gerade freigeworden.\n\nBitte besuche unsere Webseite, um ihn direkt zu buchen, bevor er weg ist!\n\nDein Dhurdur Team`,
        "", ""
      );
    }
    addNotification("Kunde benachrichtigt!", 'success');
  };

  const resendConfirmation = async (id: string) => {
    const appt = appointments.find(a => a.id === id);
    if (!appt || appt.status !== 'confirmed') return;
    const userDoc = await getDoc(doc(db, 'users', appt.userId));
    const userEmail = userDoc.exists() ? userDoc.data().email : null;

    if (appt.sendsms && appt.phone) {
      const cleanPhone = appt.phone.replace(/\s+/g, '');
      fetch('/api/sms', { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify({ phone: cleanPhone, message: `Dhurdur (Erinnerung): Dein Termin am ${appt.date} um ${appt.time} Uhr ist bestätigt!` }) }).catch(()=>{});
    }

    await sendDualEmail(
      userEmail,
      "Dhurdur: Terminbestätigung (Erneut gesendet)",
      `Hallo ${appt.name},\n\nDies ist eine Erinnerung an deinen bestätigten Termin am ${appt.date} um ${appt.time} Uhr bei ${appt.stylist}.\n\nWir freuen uns auf dich.\nDhurdur`,
      "", ""
    );
    addNotification("Bestätigung erfolgreich erneut gesendet!", 'success');
  };

  const addAdminAppointment = async (appt: Omit<Appointment, 'id'>) => {
    if (!isAdminAuth) return;
    const cleanAppt = Object.fromEntries(Object.entries(appt).filter(([, v]) => v !== undefined));
    await addDoc(collection(db, 'appointments'), cleanAppt);
    addNotification("Gespeichert!", 'success');
  };

  const addAppointment = async (appt: Omit<Appointment, 'id'>): Promise<DocumentReference | undefined> => {
    if (!currentUser) return;

    // Firestore rejects `undefined` field values (e.g. empty specialRequests),
    // which made every booking without notes fail — drop them before writing.
    const cleanAppt = Object.fromEntries(Object.entries(appt).filter(([, v]) => v !== undefined));
    const docRef = await addDoc(collection(db, 'appointments'), cleanAppt);
    const userRef = doc(db, 'users', currentUser.id);

    if (appt.usedReward) await updateDoc(userRef, { haircutCount: Math.max(0, currentUser.haircutCount - 10) });
    else await updateDoc(userRef, { haircutCount: currentUser.haircutCount + 1 });

    await sendDualEmail(
      currentUser.email,
      "Dhurdur: Buchungsanfrage erhalten",
      `Hallo ${appt.name},\n\nDeine Anfrage für ${appt.services.join(', ')} am ${appt.date} um ${appt.time} Uhr wurde an den Salon übermittelt.\n\nWir prüfen derzeit die Verfügbarkeit und werden deinen Termin in Kürze bestätigen.\n\nDein Dhurdur Team`,
      "🚨 Neuer Termin eingegangen!",
      `Hallo Admin,\n\nEs gibt eine neue Buchung:\nKunde: ${appt.name} (${appt.phone})\nLeistungen: ${appt.services.join(', ')} (${appt.totalDurationMins} Min)\nDatum: ${appt.date} um ${appt.time} Uhr\nStylist: ${appt.stylist}\nWünsche: ${appt.specialRequests || '-'}\n\nBitte logge dich im Admin-Panel ein, um den Termin zu bestätigen, abzulehnen oder zu verschieben.`
    );

    addNotification("Appointment request sent!", 'success');
    return docRef;
  };

  const updateAppointmentStatus = async (id: string, status: Appointment['status'], sendsms: boolean, notes?: string, proposedDate?: string, proposedTime?: string) => {
    const appt = appointments.find(a => a.id === id);
    if (!appt) return;

    const updates: any = { status };
    if (notes !== undefined) updates.notes = notes;

    if (status === 'confirmed' && proposedDate && proposedTime) {
      updates.date = proposedDate;
      updates.time = proposedTime;
      updates.proposedDate = null;
      updates.proposedTime = null;
    } else {
      if (proposedDate) updates.proposedDate = proposedDate;
      if (proposedTime) updates.proposedTime = proposedTime;
    }

    await updateDoc(doc(db, 'appointments', id), updates);

    if (appt.status === 'blocked' || status === 'blocked' || appt.userId === 'walk-in' || appt.userId === 'block') {
      addNotification("Status aktualisiert (Gesperrt/Walk-In).", 'success');
      return;
    }

    if (status === 'cancelled' && appt.status !== 'cancelled') {
      const userRef = doc(db, 'users', appt.userId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const uData = userDoc.data();
        if (appt.usedReward) await updateDoc(userRef, { haircutCount: uData.haircutCount + 10 });
        else await updateDoc(userRef, { haircutCount: Math.max(0, uData.haircutCount - 1) });
      }
    }

    const userDoc = await getDoc(doc(db, 'users', appt.userId));
    const userEmail = userDoc.exists() ? userDoc.data().email : null;

    const finalDate = (status === 'confirmed' && proposedDate) ? proposedDate : (proposedDate || appt.date);
    const finalTime = (status === 'confirmed' && proposedTime) ? proposedTime : (proposedTime || appt.time);

    const tAlert = translations[lang]?.alertsMsg || fallbackTranslations[lang]?.alertsMsg || fallbackTranslations.de.alertsMsg;
    const tCommon = translations[lang]?.common || fallbackTranslations[lang]?.common || fallbackTranslations.de.common;

    if (status === 'confirmed' && appt.status !== 'confirmed') {
        if (sendsms && appt.phone) {
          const cleanPhone = appt.phone.replace(/\s+/g, '');
          fetch('/api/sms', { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify({ phone: cleanPhone, message: `Dhurdur: Dein Termin am ${finalDate} um ${finalTime} Uhr ist bestätigt!` }) }).catch(()=>{});
        }

        await addDoc(collection(db, 'alerts'), { userId: appt.userId, message: `${tAlert.confirmed1} ${finalDate} ${tCommon.at} ${finalTime} ${tAlert.confirmed2}`, isRead: false, link: 'profile', createdAt: Date.now() });
        await sendDualEmail(
          userEmail,
          "Dhurdur: Terminbestätigung",
          `Hallo ${appt.name},\n\nDein Termin am ${finalDate} um ${finalTime} Uhr bei ${appt.stylist} ist offiziell bestätigt!\n\nWir freuen uns auf dich.\nDhurdur`,
          "Admin Info: Termin Bestätigt",
          `Der Termin für ${appt.name} am ${finalDate} um ${finalTime} Uhr wurde erfolgreich bestätigt.`
        );
        addNotification("Status aktualisiert & Bestätigungs-E-Mails gesendet!", 'success');

    } else if (status === 'cancelled' && appt.status !== 'cancelled') {
        await addDoc(collection(db, 'alerts'), { userId: appt.userId, message: `${tAlert.cancelled1} ${appt.date} ${tAlert.cancelled2}`, isRead: false, link: 'profile', createdAt: Date.now() });
        await sendDualEmail(
          userEmail,
          "Dhurdur: Terminabsage",
          `Hallo ${appt.name},\n\nLeider mussten wir deine Terminanfrage für den ${appt.date} um ${appt.time} Uhr stornieren (z.B. aufgrund von Überbuchungen oder Überschneidungen).\n\nBitte buche einen neuen Termin auf unserer Webseite.\n\nDein Dhurdur Team`,
          "Admin Info: Termin Storniert",
          `Der Termin für ${appt.name} am ${appt.date} um ${appt.time} Uhr wurde storniert.`
        );
        addNotification("Termin abgelehnt & Absage-E-Mail gesendet!", 'info');

    } else if (status === 'proposed' && appt.status !== 'proposed') {
        await addDoc(collection(db, 'alerts'), { userId: appt.userId, message: `${tAlert.proposed1} ${proposedDate} ${tCommon.at} ${proposedTime}. ${tAlert.proposed2}`, isRead: false, link: 'profile', createdAt: Date.now() });
        await sendDualEmail(
          userEmail,
          "Dhurdur: Terminvorschlag / Bitte bestätigen",
          `Hallo ${appt.name},\n\nWir mussten deinen Termin am ${appt.date} um ${appt.time} leider verschieben.\n\nWir schlagen stattdessen vor:\nNeues Datum: ${proposedDate}\nNeue Uhrzeit: ${proposedTime}\n\nBitte logge dich auf unserer Webseite in dein Profil ein, um diesen neuen Termin zu akzeptieren oder abzulehnen.\n\nDein Dhurdur Team`,
          "Admin Info: Termin verschoben (Kunde muss bestätigen)",
          `Du hast einen neuen Terminvorschlag an ${appt.name} gesendet. Neues Datum: ${proposedDate} um ${proposedTime} Uhr. Wartet auf Kundenbestätigung.`
        );
        addNotification("Neuer Termin vorgeschlagen & E-Mail an Kunden gesendet!", 'info');

    } else if (notes !== undefined) {
      addNotification("Notizen gespeichert.", 'success');
    }
  };

  const addService = async (s: Omit<ServiceItem, 'id'>) => { await addDoc(collection(db, 'services'), s); addNotification("Added!", 'success'); };
  const deleteService = async (id: string) => { await deleteDoc(doc(db, 'services', id)); addNotification("Deleted.", 'info'); };

  const addProduct = async (p: Omit<ProductItem, 'id'>) => { await addDoc(collection(db, 'products'), p); addNotification("Added!", 'success'); };
  const deleteProduct = async (id: string) => { await deleteDoc(doc(db, 'products', id)); addNotification("Deleted.", 'info'); };

  const updateProductStock = async (id: string, newStock: number) => {
    if (!isAdminAuth) return;
    await updateDoc(doc(db, 'products', id), { stockCount: newStock });
  };

  // Phase 4 Stylist & Settings Updates
  const addStylist = async (s: Omit<StylistItem, 'id'>) => { await addDoc(collection(db, 'stylists'), s); addNotification("Stylist gespeichert!", 'success'); };
  const deleteStylist = async (id: string) => { await deleteDoc(doc(db, 'stylists', id)); addNotification("Stylist entfernt.", 'info'); };
  const updateGeneralSettings = async (settings: Partial<GeneralSettings>) => {
    if (!isAdminAuth) return;
    await updateDoc(doc(db, 'settings', 'general'), settings);
    addNotification("Einstellungen gespeichert!", 'success');
  };

  const t = translations[lang] || fallbackTranslations[lang] || fallbackTranslations.de;

  // Translated admin-managed content. The server (/api/translate-ui) builds
  // these from Firestore itself; entries are matched by id so adding or
  // removing a service never shifts names onto the wrong item, and anything
  // not yet translated falls back to the German original.
  const getTranslatedServices = () => {
    const list: any[] = Array.isArray(translations[lang]?.dynamicServices) ? translations[lang].dynamicServices : [];
    if (lang === 'de' || list.length === 0) return servicesDB;
    return servicesDB.map(s => {
      const ts = list.find(x => x?.id === s.id);
      return ts?.name ? { ...s, name: ts.name } : s;
    });
  };

  // Stylist names are never translated (they're stored on bookings and used
  // for availability matching); only their specialties are.
  const getTranslatedStylists = () => {
    const list: any[] = Array.isArray(translations[lang]?.dynamicStylists) ? translations[lang].dynamicStylists : [];
    if (lang === 'de' || list.length === 0) return stylistsDB;
    return stylistsDB.map(s => {
      const ts = list.find(x => x?.id === s.id);
      return Array.isArray(ts?.services) ? { ...s, services: ts.services } : s;
    });
  };

  const getTranslatedGeneralSettings = () => {
    const walkin = translations[lang]?.generalSettings?.walkinWaitTime;
    return lang !== 'de' && typeof walkin === 'string' && walkin
      ? { ...generalSettings, walkinWaitTime: walkin }
      : generalSettings;
  };

  return (
    <AppContext.Provider value={{
      lang, setLang, changeLanguage, isTranslatingUI, page, setPage: setPageRouter, t, updateTranslation,
      isAdminAuth, currentUser, usersDB, clientNotesDB, updateUserNotes, loginOAuth, loginEmail, registerEmail, resetPassword, requestPasswordOtp, updateUserPassword, logout,
      servicesDB, addService, deleteService, productsDB, addProduct, deleteProduct, updateProductStock,
      appointments, addAppointment, addAdminAppointment, updateAppointmentStatus, notifications, addNotification, getAvailableSlots,
      waitlist, addToWaitlist, removeFromWaitlist, notifyWaitlist, resendConfirmation,
      stylistsDB, addStylist, deleteStylist, generalSettings, updateGeneralSettings,
      alerts, markAlertRead, clearAlerts,
      getTranslatedServices, getTranslatedStylists, getTranslatedGeneralSettings
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}