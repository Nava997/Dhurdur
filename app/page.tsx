"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { NotificationBell } from '@/components/NotificationBell';
import { LanguageSelector } from '@/components/LanguageSelector';
import { ProfileView } from '@/components/ProfileView';
import { DataExportButton } from '@/components/DataExport';
import { DeleteAccountButton, AccountDeletionModal } from '@/components/AccountDeletion';
import { useCookieConsent } from '@/components/CookieConsent';

// --- Shared Animation Variants ---
const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.1 } }
};

const slideUpItem: Variants = {
  hidden: { opacity: 0, y: 50 },
  show: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4, duration: 1.2 } }
};

const popInItem: Variants = {
  hidden: { opacity: 0, scale: 0.5, rotate: -10 },
  show: { opacity: 1, scale: 1, rotate: 0, transition: { type: "spring", bounce: 0.6, duration: 1.5 } }
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.5 } }
};

// ==========================================
// 1. MAIN COMPONENT (ROUTER)
// ==========================================
export default function DhurdurApp() {
  const { isAdminAuth, logout, t } = useApp();
  // Whether an admin who is logged in is currently viewing the dashboard.
  // Defaults to false so admins land on the public site first, same as
  // any other visitor, instead of being dropped straight into the panel.
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);

  // Logging out (or losing admin rights) should never leave someone stuck
  // in the admin panel — always land back on the real public view.
  useEffect(() => {
    if (!isAdminAuth) setAdminPanelOpen(false);
  }, [isAdminAuth]);

  const showAdmin = isAdminAuth && adminPanelOpen;

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-zinc-800 overflow-x-hidden">
      {!showAdmin && <MainWebsite onEnterAdmin={() => setAdminPanelOpen(true)} />}
      {showAdmin && <AdminDashboard onLogout={() => { logout(); }} onPreviewSite={() => setAdminPanelOpen(false)} />}

      {isAdminAuth && !showAdmin && (
        <button
          onClick={() => setAdminPanelOpen(true)}
          className="fixed bottom-6 right-6 z-70 gold-shine-btn text-black px-5 py-3 text-sm uppercase tracking-widest shadow-2xl transition-colors flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          {t.admin?.backToAdmin || "Back to Admin"}
        </button>
      )}

      <ToastContainer />
    </div>
  );
}

// ==========================================
// TOAST NOTIFICATIONS (login/register/reset errors + successes surface here)
// ==========================================
function ToastContainer() {
  const { notifications } = useApp();
  return (
    <div className="fixed top-20 md:top-24 right-4 md:right-6 z-999 flex flex-col gap-2 pointer-events-none">
      {notifications.map(n => (
        <div key={n.id} className={`p-4 shadow-2xl pointer-events-auto border-l-4 text-xs md:text-sm bg-zinc-950 ${n.type === 'success' ? 'border-green-500 text-green-400' : n.type === 'error' ? 'border-red-500 text-red-400' : 'border-zinc-400 text-zinc-300'}`}>
          <p className="font-semibold">{n.message}</p>
        </div>
      ))}
    </div>
  );
}

// ==========================================
// 3. MOCK ADMIN DASHBOARD
// ==========================================
function AdminDashboard({ onLogout, onPreviewSite }: { onLogout: () => void; onPreviewSite: () => void }) {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    appointments, usersDB, clientNotesDB, servicesDB, stylistsDB, waitlist, generalSettings, currentUser,
    updateAppointmentStatus, addAdminAppointment, addService, deleteService,
    addStylist, deleteStylist, updateGeneralSettings, notifyWaitlist, removeFromWaitlist, updateUserNotes, t, lang,
    getTranslatedServices, getTranslatedStylists
  } = useApp();

  const translatedServices = getTranslatedServices();
  const translatedStylists = getTranslatedStylists();

  const todayStr = new Date().toISOString().split('T')[0];
  const todaysAppts = appointments.filter(a => a.date === todayStr && a.status !== 'cancelled');
  const confirmedToday = todaysAppts.filter(a => a.status === 'confirmed').length;
  const pendingToday = todaysAppts.filter(a => a.status === 'pending').length;
  const newClientsThisWeek = usersDB.filter(u => {
    // haircutCount 0 is a rough "hasn't completed a visit yet" signal since we don't store a createdAt on the profile
    return u.haircutCount === 0 && u.role === 'user';
  }).length;

  const [newBooking, setNewBooking] = useState({ name: '', phone: '', service: '', stylist: '', date: todayStr, time: '10:00' });
  const [showBookingForm, setShowBookingForm] = useState(false);
  const submitWalkIn = async () => {
    if (!newBooking.name || !newBooking.service) return;
    const service = translatedServices.find(s => s.name === newBooking.service);
    await addAdminAppointment({
      userId: 'walk-in', name: newBooking.name, phone: newBooking.phone,
      services: [newBooking.service], totalDurationMins: service?.durationMins || 45,
      stylist: newBooking.stylist || (translatedStylists[0]?.name || 'Any'),
      date: newBooking.date, time: newBooking.time, status: 'confirmed', sendsms: false, usedReward: false,
    });
    setShowBookingForm(false);
    setNewBooking({ name: '', phone: '', service: '', stylist: '', date: todayStr, time: '10:00' });
  };

  const [newService, setNewService] = useState({ name: '', price: '', durationMins: 45 });
  const submitService = async () => {
    if (!newService.name || !newService.price) return;
    await addService({ name: newService.name, price: newService.price, durationMins: newService.durationMins });
    setNewService({ name: '', price: '', durationMins: 45 });
  };

  const [newStylist, setNewStylist] = useState({ name: '', services: '' });
  const submitStylist = async () => {
    if (!newStylist.name) return;
    await addStylist({ name: newStylist.name, services: newStylist.services.split(',').map(s => s.trim()).filter(Boolean) });
    setNewStylist({ name: '', services: '' });
  };

  const [walkinWait, setWalkinWait] = useState(generalSettings.walkinWaitTime);
  useEffect(() => setWalkinWait(generalSettings.walkinWaitTime), [generalSettings.walkinWaitTime]);

  const [apptSearch, setApptSearch] = useState('');
  const [apptFilter, setApptFilter] = useState('');
  const [editingClientNotes, setEditingClientNotes] = useState<Record<string, string>>({});

  const renderDashboard = () => (
    <motion.div key="dashboard" initial="hidden" animate="show" exit="hidden" variants={staggerContainer} className="space-y-12">
      <div className="flex justify-between items-end mb-8">
        <motion.div variants={slideUpItem}>
          <h1 className="text-4xl font-serif mb-2 gold-shine-text inline-block">{t.admin?.dashboardTabs?.dashboard || "Dashboard"}</h1>
          <p className="text-zinc-400">{t.admin?.dash?.welcomeBack || "Welcome back"}{currentUser?.name ? `, ${currentUser.name}` : ''}. {t.admin?.dash?.overviewToday || "Here is today's overview."}</p>
        </motion.div>
        <motion.div variants={slideUpItem} className="text-right">
          <p className="text-sm text-zinc-500">{new Date().toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </motion.div>
      </div>

      <motion.div variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: t.admin?.dash?.todaysAppts || "Today's Appointments", value: String(todaysAppts.length), trend: `${confirmedToday} ${t.admin?.dash?.confirmedSuffix || "confirmed"}` },
          { label: t.admin?.dash?.pendingRequests || "Pending Requests", value: String(pendingToday), trend: t.admin?.dash?.needsReview || "Needs review" },
          { label: t.admin?.dash?.newClients || "New Clients", value: String(newClientsThisWeek), trend: t.admin?.dash?.noVisitsYet || "No visits yet" }
        ].map((stat, i) => (
          <motion.div key={i} variants={slideUpItem} className="border border-zinc-900 bg-black p-6 hover:border-zinc-700 transition-colors">
            <p className="text-zinc-500 text-xs uppercase tracking-widest mb-4">{stat.label}</p>
            <p className="text-4xl font-serif mb-2 gold-shine-text inline-block">{stat.value}</p>
            <p className="text-zinc-400 text-sm">{stat.trend}</p>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={slideUpItem} className="border border-zinc-900 bg-black">
        <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
          <h3 className="text-xl font-serif">{t.admin?.dash?.todaysAppointments || "Today's Appointments"}</h3>
          <button onClick={() => setActiveTab('Appointments')} className="text-sm text-zinc-400 hover:text-white transition-colors">{t.admin?.dash?.viewAll || "View All"}</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-500 border-b border-zinc-900 bg-zinc-950/50">
              <tr>
                <th className="px-6 py-4 font-normal">{t.admin?.dash?.time || "Time"}</th>
                <th className="px-6 py-4 font-normal">{t.admin?.dash?.client || "Client"}</th>
                <th className="px-6 py-4 font-normal">{t.admin?.dash?.service || "Service"}</th>
                <th className="px-6 py-4 font-normal">{t.admin?.dash?.master || "Master"}</th>
                <th className="px-6 py-4 font-normal">{t.admin?.dash?.status || "Status"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {todaysAppts.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-600">{t.admin?.dash?.noAppointmentsToday || "No appointments today."}</td></tr>
              )}
              {todaysAppts.slice(0, 4).map((row) => (
                <tr key={row.id} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="px-6 py-4 text-zinc-300">{row.time}</td>
                  <td className="px-6 py-4">{row.name}</td>
                  <td className="px-6 py-4 text-zinc-400">{row.services.join(', ')}</td>
                  <td className="px-6 py-4 text-zinc-400">{row.stylist}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs border ${row.status === 'confirmed' ? 'border-green-900 text-green-500' : row.status === 'cancelled' ? 'border-red-900 text-red-500' : 'border-zinc-800 text-zinc-500'}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );

  const renderAppointments = () => {
    const filtered = appointments.filter(a => !apptFilter || a.stylist === apptFilter);
    const searched = filtered.filter(a =>
      !apptSearch || a.name.toLowerCase().includes(apptSearch.toLowerCase()) || a.id.toLowerCase().includes(apptSearch.toLowerCase())
    ).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    return (
    <motion.div key="appointments" initial="hidden" animate="show" exit="hidden" variants={staggerContainer} className="space-y-8">
      <motion.div variants={slideUpItem} className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-serif mb-2 gold-shine-text inline-block">{t.admin?.dash?.apptsTitle || "Appointments"}</h1>
          <p className="text-zinc-400">{t.admin?.dash?.apptsSubtitle || "Manage all bookings across the salon."}</p>
        </div>
        <button onClick={() => setShowBookingForm(true)} className="gold-shine-btn text-black px-6 py-2 uppercase tracking-widest text-sm transition-colors font-medium">
          {t.admin?.dash?.newBooking || "+ New Booking"}
        </button>
      </motion.div>

      {showBookingForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="border border-zinc-700 bg-zinc-950 p-6 space-y-4">
          <h3 className="text-lg font-serif">{t.admin?.dash?.walkinFormTitle || "Walk-In / Manual Booking"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <input placeholder={t.admin?.dash?.clientNamePh || "Client name"} value={newBooking.name} onChange={e => setNewBooking({ ...newBooking, name: e.target.value })} className="bg-black border border-zinc-800 p-3 text-sm focus:outline-none focus:border-gold-500" />
            <input placeholder={t.admin?.dash?.phonePh || "Phone"} value={newBooking.phone} onChange={e => setNewBooking({ ...newBooking, phone: e.target.value })} className="bg-black border border-zinc-800 p-3 text-sm focus:outline-none focus:border-gold-500" />
            <select value={newBooking.service} onChange={e => setNewBooking({ ...newBooking, service: e.target.value })} className="bg-black border border-zinc-800 p-3 text-sm text-zinc-300 focus:outline-none focus:border-gold-500">
              <option value="">{t.admin?.dash?.selectServicePh || "Select service…"}</option>
              {translatedServices.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select value={newBooking.stylist} onChange={e => setNewBooking({ ...newBooking, stylist: e.target.value })} className="bg-black border border-zinc-800 p-3 text-sm text-zinc-300 focus:outline-none focus:border-gold-500">
              <option value="">{t.admin?.dash?.anyMasterPh || "Any master"}</option>
              {translatedStylists.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <input type="date" value={newBooking.date} onChange={e => setNewBooking({ ...newBooking, date: e.target.value })} className="bg-black border border-zinc-800 p-3 text-sm focus:outline-none focus:border-gold-500" />
            <input type="time" value={newBooking.time} onChange={e => setNewBooking({ ...newBooking, time: e.target.value })} className="bg-black border border-zinc-800 p-3 text-sm focus:outline-none focus:border-gold-500" />
          </div>
          <div className="flex gap-3">
            <button onClick={submitWalkIn} className="gold-shine-btn text-black px-6 py-2 text-sm uppercase tracking-widest transition-colors">{t.admin?.dash?.save || "Save"}</button>
            <button onClick={() => setShowBookingForm(false)} className="border border-zinc-700 px-6 py-2 text-sm uppercase tracking-widest hover:bg-zinc-900 transition-colors">{t.admin?.dash?.cancel || "Cancel"}</button>
          </div>
        </motion.div>
      )}

      <motion.div variants={slideUpItem} className="border border-zinc-900 bg-black">
        <div className="p-4 border-b border-zinc-900 flex flex-col sm:flex-row gap-4 bg-zinc-950/50">
          <input type="text" value={apptSearch} onChange={e => setApptSearch(e.target.value)} placeholder={t.admin?.dash?.searchPh || "Search client or ID..."} className="bg-transparent border border-zinc-800 px-4 py-2 text-sm text-white focus:outline-none focus:border-gold-500 transition-colors w-full sm:w-64" />
          <select value={apptFilter} onChange={e => setApptFilter(e.target.value)} className="bg-transparent border border-zinc-800 px-4 py-2 text-sm text-zinc-400 focus:outline-none focus:text-white w-full sm:w-auto">
            <option value="">{t.admin?.dash?.allMasters || "All Masters"}</option>
            {translatedStylists.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-500 border-b border-zinc-900 bg-zinc-950/50">
              <tr>
                <th className="px-6 py-4 font-normal">{t.admin?.dash?.id || "ID"}</th>
                <th className="px-6 py-4 font-normal">{t.admin?.dash?.dateTime || "Date & Time"}</th>
                <th className="px-6 py-4 font-normal">{t.admin?.dash?.client || "Client"}</th>
                <th className="px-6 py-4 font-normal">{t.admin?.dash?.service || "Service"}</th>
                <th className="px-6 py-4 font-normal">{t.admin?.dash?.status || "Status"}</th>
                <th className="px-6 py-4 font-normal text-right">{t.admin?.dash?.actions || "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {searched.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-zinc-600">{t.admin?.dash?.noApptsFound || "No appointments found."}</td></tr>
              )}
              {searched.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="px-6 py-4 text-zinc-500">{row.id.slice(0, 6)}</td>
                  <td className="px-6 py-4 text-zinc-300">{row.date} • {row.time}</td>
                  <td className="px-6 py-4">{row.name}</td>
                  <td className="px-6 py-4 text-zinc-400">{row.services.join(', ')}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs border ${row.status === 'confirmed' ? 'border-green-900 text-green-500' : row.status === 'cancelled' ? 'border-red-900 text-red-500' : 'border-zinc-800 text-zinc-500'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    {row.status !== 'confirmed' && row.status !== 'cancelled' && (
                      <button onClick={() => updateAppointmentStatus(row.id, 'confirmed', true)} className="text-green-500 hover:text-green-400 transition-colors">{t.admin?.dash?.confirm || "Confirm"}</button>
                    )}
                    {row.status !== 'cancelled' && (
                      <button onClick={() => updateAppointmentStatus(row.id, 'cancelled', false)} className="text-red-500 hover:text-red-400 transition-colors">{t.admin?.dash?.cancel || "Cancel"}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
    );
  };

  const clientTier = (count: number) => count >= 10 ? (t.admin?.dash?.tierPlatinum || 'Platinum') : count >= 6 ? (t.admin?.dash?.tierGold || 'Gold') : count >= 3 ? (t.admin?.dash?.tierSilver || 'Silver') : (t.admin?.dash?.tierBronze || 'Bronze');
  const lastVisitFor = (userId: string) => {
    const past = appointments.filter(a => a.userId === userId && a.status === 'confirmed').sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    return past[0]?.date || (t.admin?.dash?.noVisitsYet || 'No visits yet');
  };

  const renderClients = () => (
    <motion.div key="clients" initial="hidden" animate="show" exit="hidden" variants={staggerContainer} className="space-y-8">
      <motion.div variants={slideUpItem} className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-serif mb-2 gold-shine-text inline-block">{t.admin?.dash?.clientsTitle || "Clients"}</h1>
          <p className="text-zinc-400">{t.admin?.dash?.clientsSubtitle || "Client database and history."}</p>
        </div>
      </motion.div>

      <motion.div variants={slideUpItem} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {usersDB.filter(u => u.role === 'user').length === 0 && (
          <p className="text-zinc-600 col-span-full">{t.admin?.dash?.noClientsYet || "No client accounts yet."}</p>
        )}
        {usersDB.filter(u => u.role === 'user').map((client) => (
          <div key={client.id} className="border border-zinc-900 bg-black p-6 hover:border-zinc-700 transition-colors">
            <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center text-xl font-serif mb-4">
              {client.name.charAt(0)}
            </div>
            <h3 className="text-lg font-serif mb-1">{client.name}</h3>
            <p className="text-zinc-500 text-sm mb-4">{client.phone || (t.admin?.dash?.noPhoneOnFile || 'No phone on file')}</p>
            <div className="space-y-2 border-t border-zinc-900 pt-4">
              <div className="flex justify-between text-sm"><span className="text-zinc-500">{t.admin?.dash?.tier || "Tier"}:</span> <span className="text-amber-500">{clientTier(client.haircutCount)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-zinc-500">{t.admin?.dash?.loyalty || "Loyalty"}:</span> <span>{client.haircutCount} {t.admin?.dash?.cuts || "cuts"}</span></div>
              <div className="flex justify-between text-sm"><span className="text-zinc-500">{t.admin?.dash?.lastVisitLbl || "Last Visit"}:</span> <span>{lastVisitFor(client.id)}</span></div>
            </div>
            <div className="mt-4 pt-4 border-t border-zinc-900 space-y-2">
              <label className="text-zinc-500 text-[10px] uppercase tracking-widest">{t.admin?.dash?.staffNotesLabel || "Staff Notes (private — never visible to client)"}</label>
              <textarea
                value={editingClientNotes[client.id] !== undefined ? editingClientNotes[client.id] : (clientNotesDB[client.id] || '')}
                onChange={(e) => setEditingClientNotes({ ...editingClientNotes, [client.id]: e.target.value })}
                placeholder={t.admin?.dash?.staffNotesPh || "e.g. preferred fade length, allergies, regular chair..."}
                rows={2}
                className="w-full bg-black border border-zinc-800 p-2 text-xs text-white focus:outline-none focus:border-zinc-500"
              />
              <button
                onClick={() => updateUserNotes(client.id, editingClientNotes[client.id] !== undefined ? editingClientNotes[client.id] : (clientNotesDB[client.id] || ''))}
                className="text-xs uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
              >
                {t.admin?.dash?.saveNote || "Save Note"}
              </button>
            </div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );

  const renderServices = () => (
    <motion.div key="services" initial="hidden" animate="show" exit="hidden" variants={staggerContainer} className="space-y-8">
      <motion.div variants={slideUpItem} className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-serif mb-2 gold-shine-text inline-block">{t.admin?.dash?.servicesTitle || "Services"}</h1>
          <p className="text-zinc-400">{t.admin?.dash?.servicesSubtitle || "Manage service offerings and pricing."}</p>
        </div>
      </motion.div>

      <motion.div variants={slideUpItem} className="border border-zinc-700 bg-zinc-950 p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
        <div className="sm:col-span-2">
          <label className="block text-zinc-400 text-xs uppercase tracking-widest mb-2">{t.admin?.dash?.serviceNameLbl || "Service Name"}</label>
          <input value={newService.name} onChange={e => setNewService({ ...newService, name: e.target.value })} className="w-full bg-black border border-zinc-800 p-3 text-sm focus:outline-none focus:border-gold-500" />
        </div>
        <div>
          <label className="block text-zinc-400 text-xs uppercase tracking-widest mb-2">{t.admin?.dash?.priceLbl || "Price"}</label>
          <input value={newService.price} onChange={e => setNewService({ ...newService, price: e.target.value })} placeholder="35" className="w-full bg-black border border-zinc-800 p-3 text-sm focus:outline-none focus:border-gold-500" />
        </div>
        <div>
          <label className="block text-zinc-400 text-xs uppercase tracking-widest mb-2">{t.admin?.dash?.durationMinLbl || "Duration (min)"}</label>
          <input type="number" value={newService.durationMins} onChange={e => setNewService({ ...newService, durationMins: Number(e.target.value) })} className="w-full bg-black border border-zinc-800 p-3 text-sm focus:outline-none focus:border-gold-500" />
        </div>
        <button onClick={submitService} className="sm:col-span-2 md:col-span-4 gold-shine-btn text-black px-6 py-3 uppercase tracking-widest text-sm transition-colors font-medium">
          {t.admin?.dash?.addServiceBtn || "Add Service"}
        </button>
      </motion.div>

      <motion.div variants={slideUpItem} className="border border-zinc-900 bg-black">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-500 border-b border-zinc-900 bg-zinc-950/50">
              <tr>
                <th className="px-6 py-4 font-normal">{t.admin?.dash?.serviceNameLbl || "Service Name"}</th>
                <th className="px-6 py-4 font-normal">{t.admin?.dash?.durationCol || "Duration"}</th>
                <th className="px-6 py-4 font-normal">{t.admin?.dash?.priceCol || "Price"}</th>
                <th className="px-6 py-4 font-normal text-right">{t.admin?.dash?.actionsCol || "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {translatedServices.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-zinc-600">{t.admin?.dash?.noServicesYet || "No services yet — add one above."}</td></tr>
              )}
              {translatedServices.map((service) => (
                <tr key={service.id} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="px-6 py-4 text-white font-medium">{service.name}</td>
                  <td className="px-6 py-4 text-zinc-400">{service.durationMins} {t.services?.min || "min"}</td>
                  <td className="px-6 py-4 text-zinc-300">€{service.price}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => deleteService(service.id)} className="text-zinc-500 hover:text-red-500 transition-colors">{t.admin?.dash?.deleteBtn || "Delete"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );

  const renderTeam = () => (
    <motion.div key="team" initial="hidden" animate="show" exit="hidden" variants={staggerContainer} className="space-y-8">
      <motion.div variants={slideUpItem}>
        <h1 className="text-4xl font-serif mb-2 gold-shine-text inline-block">{t.admin?.dash?.teamTitle || "Team"}</h1>
        <p className="text-zinc-400">{t.admin?.dash?.teamSubtitle || "Masters and barbers who take appointments."}</p>
      </motion.div>

      <motion.div variants={slideUpItem} className="border border-zinc-700 bg-zinc-950 p-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-zinc-400 text-xs uppercase tracking-widest mb-2">{t.admin?.dash?.nameLbl || "Name"}</label>
          <input value={newStylist.name} onChange={e => setNewStylist({ ...newStylist, name: e.target.value })} className="w-full bg-black border border-zinc-800 p-3 text-sm focus:outline-none focus:border-gold-500" />
        </div>
        <div>
          <label className="block text-zinc-400 text-xs uppercase tracking-widest mb-2">{t.admin?.dash?.specialtiesLbl || "Specialties (comma-separated)"}</label>
          <input value={newStylist.services} onChange={e => setNewStylist({ ...newStylist, services: e.target.value })} placeholder={t.admin?.dash?.specialtiesPh || "Skin Fade, Beard Trim"} className="w-full bg-black border border-zinc-800 p-3 text-sm focus:outline-none focus:border-gold-500" />
        </div>
        <button onClick={submitStylist} className="gold-shine-btn text-black px-6 py-3 uppercase tracking-widest text-sm transition-colors font-medium">
          {t.admin?.dash?.saveMasterBtn || "Save Master"}
        </button>
      </motion.div>

      <motion.div variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stylistsDB.length === 0 && <p className="text-zinc-600">{t.admin?.dash?.noTeamYet || "No team members yet — add one above."}</p>}
        {stylistsDB.map((s) => (
          <motion.div key={s.id} variants={slideUpItem} className="border border-zinc-900 bg-black p-6">
            <h3 className="text-lg font-serif mb-1">{s.name}</h3>
            <p className="text-zinc-500 text-sm mb-4">{s.services.join(', ') || (t.admin?.dash?.noSpecialties || 'No specialties listed')}</p>
            <button onClick={() => deleteStylist(s.id)} className="text-zinc-500 hover:text-red-500 text-sm transition-colors">{t.admin?.dash?.removeBtn || "Remove"}</button>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );

  const renderWaitlist = () => (
    <motion.div key="waitlist" initial="hidden" animate="show" exit="hidden" variants={staggerContainer} className="space-y-8">
      <motion.div variants={slideUpItem}>
        <h1 className="text-4xl font-serif mb-2 gold-shine-text inline-block">{t.admin?.dash?.waitlistTitle || "Waitlist"}</h1>
        <p className="text-zinc-400">{t.admin?.dash?.waitlistSubtitle || "Clients waiting for a slot to free up."}</p>
      </motion.div>

      <motion.div variants={slideUpItem} className="border border-zinc-900 bg-black">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-500 border-b border-zinc-900 bg-zinc-950/50">
              <tr>
                <th className="px-6 py-4 font-normal">{t.admin?.dash?.client || "Client"}</th>
                <th className="px-6 py-4 font-normal">{t.admin?.dash?.requestedDate || "Requested Date"}</th>
                <th className="px-6 py-4 font-normal">{t.admin?.dash?.master || "Master"}</th>
                <th className="px-6 py-4 font-normal text-right">{t.admin?.dash?.actions || "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {waitlist.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-zinc-600">{t.admin?.dash?.waitlistEmpty || "Waitlist is empty."}</td></tr>
              )}
              {waitlist.map((w) => (
                <tr key={w.id} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="px-6 py-4">{w.name}</td>
                  <td className="px-6 py-4 text-zinc-400">{w.date}</td>
                  <td className="px-6 py-4 text-zinc-400">{w.stylist}</td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <button onClick={() => notifyWaitlist(w)} className="text-green-500 hover:text-green-400 transition-colors">{t.admin?.dash?.notifyBtn || "Notify"}</button>
                    <button onClick={() => removeFromWaitlist(w.id)} className="text-red-500 hover:text-red-400 transition-colors">{t.admin?.dash?.removeBtn || "Remove"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );

  const renderSettings = () => (
    <motion.div key="settings" initial="hidden" animate="show" exit="hidden" variants={staggerContainer} className="space-y-8 max-w-3xl">
      <motion.div variants={slideUpItem}>
        <h1 className="text-4xl font-serif mb-2 gold-shine-text inline-block">{t.admin?.dash?.settingsTitle || "Settings"}</h1>
        <p className="text-zinc-400">{t.admin?.dash?.settingsSubtitle || "System configurations and business details."}</p>
      </motion.div>

      <motion.div variants={slideUpItem} className="border border-zinc-900 bg-black p-8 space-y-6">
        <h3 className="text-xl font-serif border-b border-zinc-900 pb-4">{t.admin?.dash?.walkinWaitTitle || "Walk-In Wait Time"}</h3>
        <p className="text-zinc-500 text-sm">{t.admin?.dash?.walkinWaitDesc || "Shown live to visitors on the public booking page."}</p>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-zinc-400 text-xs uppercase tracking-widest mb-2">{t.admin?.dash?.currentWaitLbl || "Current Wait"}</label>
            <input type="text" value={walkinWait} onChange={e => setWalkinWait(e.target.value)} placeholder={t.admin?.dash?.currentWaitPh || "e.g. 15 minutes, Fully Booked..."} className="w-full bg-zinc-950 border border-zinc-800 p-3 text-white focus:outline-none focus:border-zinc-500 transition-colors" />
          </div>
          <button onClick={() => updateGeneralSettings({ walkinWaitTime: walkinWait })} className="gold-shine-btn text-black px-8 py-3 uppercase tracking-widest text-sm transition-colors font-medium">
            {t.admin?.dash?.updateBtn || "Update"}
          </button>
        </div>
      </motion.div>

      <motion.div variants={slideUpItem} className="border border-zinc-900 bg-black p-8 space-y-4">
        <h3 className="text-xl font-serif border-b border-zinc-900 pb-4">{t.admin?.dash?.businessProfileTitle || "Business Profile"}</h3>
        <p className="text-zinc-500 text-sm">{t.admin?.dash?.businessProfileDesc || "Business name, contact email, and address are set in the site template itself (in the code) rather than here — let me know if you'd like these editable from this panel too."}</p>
      </motion.div>
    </motion.div>
  );

  const tabKeys = ['Dashboard', 'Appointments', 'Clients', 'Team', 'Waitlist', 'Services', 'Settings'];
  const tabLabels: Record<string, string> = {
    Dashboard: t.admin?.dashboardTabs?.dashboard || 'Dashboard',
    Appointments: t.admin?.dashboardTabs?.appointments || 'Appointments',
    Clients: t.admin?.dashboardTabs?.clients || 'Clients',
    Team: t.admin?.dashboardTabs?.team || 'Team',
    Waitlist: t.admin?.dashboardTabs?.waitlist || 'Waitlist',
    Services: t.admin?.dashboardTabs?.services || 'Services',
    Settings: t.admin?.dashboardTabs?.settings || 'Settings',
  };

  return (
    <motion.div 
      initial="hidden" animate="show" variants={fadeIn}
      className="min-h-screen bg-zinc-950 flex"
    >
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-black border-b border-zinc-900 px-4 py-4 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" className="w-9 h-9 flex items-center justify-center text-white">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
        </button>
        <span className="text-lg font-serif">{tabLabels[activeTab]}</span>
        <button onClick={onPreviewSite} aria-label={t.admin?.backToWebsite || "Back to website"} className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
        </button>
      </div>

      {/* Backdrop for mobile drawer */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/70 z-30" onClick={() => setSidebarOpen(false)}></div>
      )}

      <div className={`w-64 border-r border-zinc-900 bg-black flex flex-col z-40 fixed md:static inset-y-0 left-0 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="p-8 border-b border-zinc-900 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-serif gold-shine-text">Dhurdur</h2>
            <p className="text-zinc-500 text-xs mt-1 uppercase tracking-widest">{t.admin?.workspace || "Workspace"}</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-zinc-500 hover:text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {tabKeys.map((item) => (
            <button 
              key={item} 
              onClick={() => { setActiveTab(item); setSidebarOpen(false); }}
              className={`w-full text-left px-4 py-3 text-sm transition-colors border-l-2 ${activeTab === item ? 'bg-zinc-900 border-gold-500 text-gold-300' : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/50'}`}
            >
              {tabLabels[item]}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-zinc-900 space-y-1">
          <button onClick={onPreviewSite} className="w-full text-left px-4 py-3 text-sm text-zinc-400 hover:text-white hover:bg-zinc-900/50 transition-colors flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
            {t.admin?.backToWebsite || "Back to Website"}
          </button>
          <button onClick={onLogout} className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors">
            {t.admin?.logoutBtn || "Logout"}
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 pt-24 md:p-12 md:pt-12 overflow-y-auto relative w-full min-w-0">
        {activeTab === 'Dashboard' && renderDashboard()}
        {activeTab === 'Appointments' && renderAppointments()}
        {activeTab === 'Clients' && renderClients()}
        {activeTab === 'Team' && renderTeam()}
        {activeTab === 'Waitlist' && renderWaitlist()}
        {activeTab === 'Services' && renderServices()}
        {activeTab === 'Settings' && renderSettings()}
      </div>
    </motion.div>
  );
}

// ==========================================
// 4. MAIN WEBSITE
// ==========================================
function MainWebsite({ onEnterAdmin }: { onEnterAdmin: () => void }) {
  const { currentUser, isAdminAuth, loginEmail, registerEmail, loginOAuth, resetPassword, logout, servicesDB, stylistsDB, generalSettings, t, lang, getTranslatedServices, getTranslatedStylists } = useApp();
  const { resetConsent } = useCookieConsent();
  const [scrolled, setScrolled] = useState(false);

  const translatedServices = getTranslatedServices();
  const translatedStylists = getTranslatedStylists();
  const [activeSection, setActiveSection] = useState("");
  const [showClientAuth, setShowClientAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Business hours: Mon–Sat 9:00–18:00, closed Sunday.
  const BUSINESS_HOURS = { open: 9, close: 18 };
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const day = now?.getDay() ?? 1; // 0 = Sunday
  const hour = now ? now.getHours() + now.getMinutes() / 60 : 12;
  const isOpenNow = now !== null && day !== 0 && hour >= BUSINESS_HOURS.open && hour < BUSINESS_HOURS.close;
  const todaysHoursLabel = now === null
    ? ''
    : day === 0
      ? (t.hero?.closedToday || 'Closed today')
      : isOpenNow
        ? `${t.hero?.openUntil || 'Open until'} ${BUSINESS_HOURS.close}:00`
        : hour < BUSINESS_HOURS.open
          ? `${t.hero?.opensAt || 'Opens at'} ${BUSINESS_HOURS.open}:00`
          : (t.hero?.closedNow || 'Closed now');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);

      // Scroll Spy Logic
      const sections = ["services", "gallery", "team", "book", "contacts"];
      let current = "";

      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 200) {
            current = section;
          }
        }
      }

      // The footer ("contacts") is the last, shortest section — on most
      // viewports its top never crosses the 200px threshold because the
      // page runs out of scroll room first. Treat "scrolled to the bottom
      // of the document" as being in the contacts section too.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 10;
      if (atBottom) {
        current = "contacts";
      }

      setActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); 
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: t.nav?.services || "Services", id: "services" },
    { name: t.nav?.gallery || "Gallery", id: "gallery" },
    { name: t.nav?.team || "Team", id: "team" },
    { name: t.nav?.book || "Book", id: "book" },
    { name: t.nav?.contacts || "Contacts", id: "contacts" }
  ];

  return (
    <>
      {showClientAuth && !currentUser && <ClientAuthModal onClose={() => setShowClientAuth(false)} loginEmail={loginEmail} registerEmail={registerEmail} loginOAuth={loginOAuth} resetPassword={resetPassword} currentUser={currentUser} />}
      {showProfile && currentUser && <ClientProfileOverlay onClose={() => setShowProfile(false)} />}

      {/* STICKY NAVBAR WITH SCROLL SPY */}
      <motion.nav 
        initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.5, ease: "easeOut" }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-8 py-6 md:py-7 ${
          scrolled ? "bg-black/80 backdrop-blur-lg border-b border-zinc-800/50 shadow-2xl" : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between w-full gap-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span className="text-3xl md:text-4xl font-serif tracking-wide gold-shine-text transition-opacity hover:opacity-80">Dhurdur</span>
          </div>
          <nav className="hidden md:flex gap-8 text-sm font-light items-center flex-1 justify-center" aria-label="Main navigation">
            {navLinks.map((link) => (
              <a 
                key={link.name}
                href={`#${link.id}`} 
                className={`transition-all duration-300 ${activeSection === link.id ? "gold-shine-text font-medium" : "text-zinc-400 hover:text-white"}`}
              >
                {link.name}
              </a>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-4">
            <span className="w-px h-4 bg-zinc-800"></span>
            <LanguageSelector />

            {currentUser && isAdminAuth ? (
              <>
                <button onClick={onEnterAdmin} className="gold-shine-text font-medium text-xs uppercase tracking-widest">
                  {t.nav?.admin || "Admin Panel"}
                </button>
                <button onClick={logout} className="text-zinc-500 hover:text-white transition-colors">{t.nav?.logout || "Log Out"}</button>
              </>
            ) : currentUser ? (
              <>
                <NotificationBell />
                <button onClick={() => setShowProfile(true)} className="text-zinc-400 hover:text-white transition-colors text-xs">
                  Hi, {currentUser.name.split(' ')[0]}
                </button>
                <button onClick={logout} className="text-zinc-500 hover:text-white transition-colors">{t.nav?.logout || "Log Out"}</button>
              </>
            ) : (
              <button onClick={() => setShowClientAuth(true)} className="text-zinc-500 hover:text-white transition-colors">
                {t.nav?.login || "Login"}
              </button>
            )}
          </div>

          {/* Mobile hamburger toggle */}
          <button
            onClick={() => setMobileMenuOpen(o => !o)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            className="md:hidden w-10 h-10 flex items-center justify-center text-white"
          >
            {mobileMenuOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
            )}
          </button>
        </div>

        {/* Mobile slide-down menu */}
        <motion.div
          initial={false}
          animate={{ height: mobileMenuOpen ? 'auto' : 0, opacity: mobileMenuOpen ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          className="md:hidden overflow-hidden bg-black/95 backdrop-blur-lg border-t border-zinc-800/50 mt-5 -mx-8"
        >
          <div className="flex flex-col px-8 py-6 gap-1">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={`#${link.id}`}
                onClick={() => setMobileMenuOpen(false)}
                className={`py-3 text-base border-b border-zinc-900 transition-colors ${activeSection === link.id ? "gold-shine-text font-medium" : "text-zinc-400"}`}
              >
                {link.name}
              </a>
            ))}

            <div className="flex items-center justify-between py-4">
              <span className="text-zinc-500 text-xs uppercase tracking-widest">{t.nav?.language || "Language"}</span>
              <LanguageSelector />
            </div>

            {currentUser && isAdminAuth ? (
              <>
                <button
                  onClick={() => { onEnterAdmin(); setMobileMenuOpen(false); }}
                  className="text-left py-3 border-t border-zinc-900 gold-shine-text font-medium uppercase tracking-widest text-sm"
                >
                  {t.nav?.admin || "Admin Panel"}
                </button>
                <button
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="text-left py-3 text-zinc-500"
                >
                  {t.nav?.logout || "Log Out"}
                </button>
              </>
            ) : currentUser ? (
              <>
                <div className="flex items-center justify-between py-3 border-t border-zinc-900">
                  <span className="text-zinc-500 text-xs uppercase tracking-widest">{t.notifications?.title || "Notifications"}</span>
                  <NotificationBell />
                </div>
                <button
                  onClick={() => { setShowProfile(true); setMobileMenuOpen(false); }}
                  className="text-left py-3 border-t border-zinc-900 text-white"
                >
                  Hi, {currentUser.name.split(' ')[0]} — {t.nav?.myAccount || "My Account"}
                </button>
                <button
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="text-left py-3 text-zinc-500"
                >
                  {t.nav?.logout || "Log Out"}
                </button>
              </>
            ) : (
              <button
                onClick={() => { setShowClientAuth(true); setMobileMenuOpen(false); }}
                className="mt-4 gold-shine-btn text-black py-4 uppercase tracking-widest text-sm font-medium"
              >
                {t.nav?.login || "Login"}
              </button>
            )}
          </div>
        </motion.div>
      </motion.nav>

      {/* HERO SECTION */}
      <section className="relative min-h-screen flex items-center pt-24 pb-12 px-8 overflow-hidden">
        <motion.div
          className="absolute inset-0 z-0"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        >
          <img
            src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=3000&auto=format&fit=crop"
            alt="Background"
            className="w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-linear-to-r from-black via-black/80 to-transparent"></div>
          <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-black"></div>
        </motion.div>

        <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12 mt-16">
          <div className="flex flex-col items-start max-w-2xl w-full">
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "4rem" }}
              transition={{ duration: 1, delay: 0.2 }}
              className="h-px bg-zinc-500 mb-8"
            ></motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, type: "spring", bounce: 0.2, delay: 0.1 }}
              className="text-5xl sm:text-6xl md:text-8xl lg:text-[7rem] font-serif leading-[0.9] mb-8"
            >
              <span className="gold-shine-text">{t.hero?.titleLine1 || "Where"}</span> <br />
              <span className="italic text-zinc-400">{t.hero?.titleWordItalic || "Style"}</span> <span className="gold-shine-text">{t.hero?.titleLine2 || "Meets Craft."}</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.4 }}
              className="text-zinc-400 text-lg md:text-xl font-light mb-12 max-w-md border-l border-zinc-800 pl-6"
            >
              {t.hero?.sub || "Elevating the traditional grooming experience through precision, artistry, and an uncompromising attention to detail."}
            </motion.p>

            <motion.a
              href="#book"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.6 }}
              whileHover={{ scale: 1.05, gap: "1.5rem" }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-4 gold-shine-btn text-black px-8 py-5 uppercase tracking-widest text-sm font-medium transition-all rounded-sm"
            >
              <span>{t.hero?.bookBtn || "Book Appointment"}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </motion.a>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.5, delay: 0.8 }}
            className="hidden lg:flex flex-col items-end gap-6"
          >
            <div className="backdrop-blur-md bg-white/5 border border-white/10 p-6 rounded-sm text-right w-64">
              <p className="text-zinc-500 text-xs uppercase tracking-widest mb-2">{t.hero?.location || "Location"}</p>
              <a 
                href="https://maps.google.com/?q=Obere+Str.+30,+97421+Schweinfurt" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white text-sm hover:text-zinc-300 transition-colors inline-block"
              >
                Obere Str. 30<br/>97421 Schweinfurt
              </a>
            </div>
            <div className="backdrop-blur-md bg-white/5 border border-white/10 p-6 rounded-sm text-right w-64">
              <p className="text-zinc-500 text-xs uppercase tracking-widest mb-2">{t.hero?.todaysHours || "Today's Hours"}</p>
              <p className="text-white text-sm flex items-center justify-end gap-2">
                <span className={`w-2 h-2 rounded-full ${isOpenNow ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`}></span>
                {todaysHoursLabel}
              </p>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-zinc-600 text-xs uppercase tracking-widest rotate-90 mb-6">{lang === 'de' ? 'Scrollen' : 'Scroll'}</span>
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-px h-12 bg-linear-to-b from-zinc-500 to-transparent"
          ></motion.div>
        </motion.div>
      </section>

      {/* SERVICES SECTION */}
      <section id="services" className="relative py-24 overflow-hidden scroll-mt-24">
        <div className="absolute inset-0 -z-10">
          <img
            src="https://images.unsplash.com/photo-1702865272115-5afdbae975af?q=80&w=2400&auto=format&fit=crop"
            alt=""
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-linear-to-b from-black via-black/85 to-black"></div>
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-8">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, margin: "-100px" }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-5xl md:text-6xl font-serif mb-12 gold-shine-text inline-block">{t.services?.title || "Our Services"}</h2>
        </motion.div>
        
        <div className="flex flex-col gap-4">
          {(t.services?.items || [
            { title: "Classic Haircut", desc: "Precision cut tailored to your style and face shape.", price: "35" },
            { title: "Skin Fade", desc: "Clean fade with seamless blending and sharp detailing.", price: "40" },
            { title: "Beard Trim & Shape", desc: "Expert beard sculpting, lining, and finishing.", price: "25" },
            { title: "Hot Towel Shave", desc: "Traditional straight razor shave with hot towel treatment.", price: "30" },
            { title: "Haircut & Beard Combo", desc: "Complete grooming experience with haircut and beard styling.", price: "55" },
            { title: "Premium Grooming Package", desc: "Haircut, beard trim, hot towel shave, wash, and styling.", price: "75" },
          ]).map((service: { title: string; desc: string; price: string }, idx: number) => (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, x: idx % 2 === 0 ? -150 : 150 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
              whileHover={{ scale: 1.02, x: 10, borderColor: "#52525b" }}
              className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border border-zinc-900 p-6 md:p-8 cursor-pointer bg-black"
            >
              <div className="flex items-center gap-6">
                <span className="text-zinc-600 transition-colors">⟶</span>
                <div>
                  <h3 className="text-xl md:text-2xl font-serif mb-1 gold-shine-text inline-block">{service.title}</h3>
                  <p className="text-zinc-500 text-sm">{service.desc}</p>
                </div>
              </div>
              <div className="flex items-baseline gap-2 pl-12 sm:pl-0">
                <span className="text-zinc-500 text-sm">{t.services?.from || "From"}</span>
                <span className="text-3xl md:text-4xl font-serif text-white">€{service.price}</span>
              </div>
            </motion.div>
          ))}
        </div>
        </div>
      </section>

      {/* GALLERY SECTION */}
      <section id="gallery" className="py-24 px-8 max-w-screen-2xl mx-auto overflow-hidden scroll-mt-24">
        <motion.h2 
          initial={{ opacity: 0, scale: 0.8 }} 
          whileInView={{ opacity: 1, scale: 1 }} 
          viewport={{ once: false, margin: "-100px" }} 
          transition={{ duration: 1.5, type: "spring" }} 
          className="text-5xl md:text-6xl font-serif mb-12 gold-shine-text inline-block"
        >
          {t.gallery?.title || "Gallery"}
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1593702295094-aea22597af65?q=80&w=800&auto=format&fit=crop"
          ].map((src, idx) => (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, scale: 0.5, y: 50 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.8, type: "spring", bounce: 0.4, delay: idx * 0.1 }}
              className="overflow-hidden"
            >
              <motion.img whileHover={{ scale: 1.2, rotate: idx % 2 === 0 ? 3 : -3 }} transition={{ duration: 0.8, type: "spring" }} src={src} alt={`Dhurdur ${t.gallery?.title || "Gallery"} ${idx + 1}`} className="w-full h-64 object-cover" />
            </motion.div>
          ))}
        </div>
      </section>

      {/* THE TEAM SECTION */}
      <section id="team" className="py-24 px-8 max-w-7xl mx-auto overflow-hidden scroll-mt-24">
        <motion.h2 
          initial={{ opacity: 0, y: 100 }} 
          whileInView={{ opacity: 1, y: 0 }} 
          viewport={{ once: false, margin: "-100px" }} 
          transition={{ duration: 1.5, type: "spring" }} 
          className="text-5xl md:text-6xl font-serif mb-12 gold-shine-text inline-block"
        >
          {t.team?.title || "The Team"}
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {[
            { name: "Oliver Hayes", img: "https://images.unsplash.com/photo-1618077360395-f3068be8e001?q=80&w=800&auto=format&fit=crop" },
            { name: "Sophia Bennett", img: "https://images.unsplash.com/photo-1595959183082-7b570b7e08e2?q=80&w=800&auto=format&fit=crop" },
            { name: "Marcus Steele", img: "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=800&auto=format&fit=crop" },
          ].map((member, idx) => {
            const roleFallback = idx === 0 ? "Master" : idx === 1 ? "Master Barber" : "Senior Barber";
            const translatedMember = t.team?.members?.[idx];
            return (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, y: 100 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.8, type: "spring", bounce: 0.3, delay: idx * 0.15 }}
              whileHover={{ y: -15 }} 
              className="border border-zinc-900 overflow-hidden group"
            >
              <div className="h-96 w-full overflow-hidden">
                <motion.img whileHover={{ scale: 1.1 }} transition={{ duration: 0.5 }} src={member.img} alt={member.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
              </div>
              <div className="p-6 relative">
                <motion.div initial={{ width: 0 }} whileInView={{ width: "100%" }} viewport={{ once: false }} transition={{ duration: 1, delay: 0.5 }} className="absolute top-0 left-0 h-1 bg-zinc-800" />
                <h3 className="text-xl font-serif mb-1">{translatedMember?.name || member.name}</h3>
                <p className="text-zinc-500 text-sm">{translatedMember?.role || roleFallback}</p>
              </div>
            </motion.div>
            );
          })}
        </div>
      </section>

      {/* THE NUMBERS SECTION */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img
            src="https://images.unsplash.com/photo-1621645582931-d1d3e6564943?q=80&w=2400&auto=format&fit=crop"
            alt=""
            className="w-full h-full object-cover opacity-15"
          />
          <div className="absolute inset-0 bg-linear-to-b from-black via-black/90 to-black"></div>
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-8">
        <motion.h2 
          initial={{ opacity: 0 }} 
          whileInView={{ opacity: 1 }} 
          viewport={{ once: false, margin: "-100px" }} 
          className="text-5xl md:text-6xl font-serif mb-12 gold-shine-text inline-block"
        >
          {t.numbers?.title || "The Numbers"}
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { num: "15+", label: t.numbers?.years || "Years of experience" },
            { num: "12k", label: t.numbers?.clients || "Happy clients" },
            { num: "5.0", label: t.numbers?.rating || "Client rating" }
          ].map((stat, idx) => (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
              whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
              viewport={{ once: false, margin: "-50px" }}
              transition={{ duration: 0.6, type: "spring", bounce: 0.5, delay: idx * 0.1 }}
              whileHover={{ scale: 1.05, rotate: 2 }} 
              className="border border-zinc-900 flex flex-col items-center justify-center py-20 bg-zinc-950/80 backdrop-blur-sm"
            >
              <span className="text-6xl md:text-7xl font-serif mb-4 gold-shine-text inline-block">{stat.num}</span>
              <span className="text-zinc-400 text-sm">{stat.label}</span>
            </motion.div>
          ))}
        </div>
        </div>
      </section>

      {/* BOOKING SECTION */}
      <motion.section 
        id="book" 
        initial={{ opacity: 0, y: 150 }} 
        whileInView={{ opacity: 1, y: 0 }} 
        viewport={{ once: false, margin: "-100px" }} 
        transition={{ duration: 1.2, type: "spring" }} 
        className="relative py-24 w-full scroll-mt-24 overflow-hidden"
      >
        <div className="absolute inset-0 -z-10">
          <img
            src="https://images.unsplash.com/photo-1669568846636-00191bb5481a?q=80&w=2400&auto=format&fit=crop"
            alt=""
            className="w-full h-full object-cover opacity-15"
          />
          <div className="absolute inset-0 bg-linear-to-b from-black via-black/90 to-black"></div>
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-8">
        <h2 className="text-5xl md:text-6xl font-serif mb-2 gold-shine-text inline-block">{t.booking?.title || "Book Your Next Cut"}</h2>
        <p className="text-zinc-400 mb-2 border-b border-zinc-800 pb-8">{t.booking?.subtitle || "Choose a service, pick a time, and we'll confirm."}</p>
        {generalSettings.walkinWaitTime && (
          <p className="text-zinc-500 text-sm mb-8 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {t.booking?.walkinWaitLive || "Walk-in wait right now"}: {generalSettings.walkinWaitTime}
          </p>
        )}

        {!currentUser ? (
          <div className="border border-zinc-800 p-10 text-center space-y-4">
            <p className="text-zinc-300">{t.booking?.loginPrompt || "Please log in to request an appointment."}</p>
            <button onClick={() => setShowClientAuth(true)} className="gold-shine-btn text-black px-8 py-3 uppercase tracking-widest text-sm transition-colors font-medium">
              {t.nav?.login || "Login"}
            </button>
          </div>
        ) : (
          <BookingForm servicesDB={servicesDB} stylistsDB={stylistsDB} />
        )}
        </div>
      </motion.section>

      {/* FOOTER */}
      <footer id="contacts" className="relative mt-24 border-t border-zinc-900 pt-16 pb-8 px-8 overflow-hidden scroll-mt-24">
        <motion.div animate={{ x: [0, 100, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute inset-0 opacity-5 pointer-events-none w-[200%]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 10px)' }}></motion.div>
        <div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1 md:grid-cols-3 gap-12">
          <motion.div 
            initial={{ opacity: 0, x: -50 }} 
            whileInView={{ opacity: 1, x: 0 }} 
            viewport={{ once: false, margin: "-50px" }} 
            transition={{ duration: 1.2, type: "spring" }} 
          >
            <h2 className="text-5xl md:text-7xl font-serif mb-6 gold-shine-text">Dhurdur</h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-8">{t.footerSection?.tagline || <>At Dhurdur, every appointment is built around <strong className="text-white font-normal">precision, craftsmanship, and personal style</strong>.</>}</p>

            <div className="flex gap-4">
              <a href="https://www.instagram.com/Dhurdur_barber/" target="_blank" rel="noopener noreferrer" aria-label="Dhurdur on Instagram" className="w-10 h-10 border border-zinc-800 flex items-center justify-center hover:border-gold-500 hover:bg-gold-500 hover:text-black transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
              </a>
              <a href="https://www.tiktok.com/@Dhurdur.barber" target="_blank" rel="noopener noreferrer" aria-label="Dhurdur on TikTok" className="w-10 h-10 border border-zinc-800 flex items-center justify-center hover:border-gold-500 hover:bg-gold-500 hover:text-black transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z"/></svg>
              </a>
              <a href="https://www.facebook.com/profile.php?id=61591614046660" target="_blank" rel="noopener noreferrer" aria-label="Dhurdur on Facebook" className="w-10 h-10 border border-zinc-800 flex items-center justify-center hover:border-gold-500 hover:bg-gold-500 hover:text-black transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.95.93-1.95 1.89v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07z"/></svg>
              </a>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: false, margin: "-50px" }} 
            transition={{ duration: 1.2, type: "spring", delay: 0.1 }} 
          >
            <p className="text-zinc-500 text-xs uppercase tracking-widest mb-4">{t.footerSection?.visit || "Visit"}</p>
            <a 
              href="https://maps.google.com/?q=Obere+Str.+30,+97421+Schweinfurt" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-lg hover:text-zinc-300 transition-colors inline-block mb-4"
            >
              Obere Str. 30<br/>97421 Schweinfurt
            </a>
            <a href="tel:015232163823" className="text-lg hover:text-zinc-300 transition-colors block">01523 2163823</a>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: false, margin: "-50px" }} 
            transition={{ duration: 1.2, type: "spring", delay: 0.2 }} 
          >
            <p className="text-zinc-500 text-xs uppercase tracking-widest mb-4">{t.footerSection?.openingHours || "Opening Hours"}</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-8"><span className="text-zinc-400">{t.footerSection?.monToSat || "Monday – Saturday"}</span><span>9:00 – 18:00</span></div>
              <div className="flex justify-between gap-8"><span className="text-zinc-400">{t.footerSection?.sunday || "Sunday"}</span><span className="text-zinc-500">{t.footerSection?.closed || "Closed"}</span></div>
            </div>
          </motion.div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10 mt-16 pt-8 border-t border-zinc-900 text-xs text-zinc-600 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>© {new Date().getFullYear()} Dhurdur. {t.footerSection?.allRightsReserved || "All rights reserved."}</span>
          <div className="flex flex-wrap justify-center gap-4 uppercase tracking-widest">
            <Link href="/impressum" className="hover:text-gold-400 transition-colors">Impressum</Link>
            <Link href="/privacy" className="hover:text-gold-400 transition-colors">{lang === 'de' ? 'Datenschutz' : 'Privacy'}</Link>
            <button onClick={resetConsent} className="uppercase tracking-widest hover:text-gold-400 transition-colors">
              {lang === 'de' ? 'Cookie-Einstellungen' : 'Cookie Settings'}
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}

// ==========================================
// 7. CLIENT PROFILE OVERLAY (profile + GDPR tools)
// ==========================================
function ClientProfileOverlay({ onClose }: { onClose: () => void }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { t } = useApp();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-60 bg-black overflow-y-auto">
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-lg border-b border-zinc-800 px-8 py-5 flex justify-between items-center">
        <span className="text-2xl font-serif">{t.profile?.myAccount || "My Account"}</span>
        <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-sm">{t.profile?.close || "Close"}</button>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-12">
        <ProfileView />

        <div className="mt-16 border-t border-zinc-800 pt-10 space-y-6">
          <h3 className="text-xl font-serif">{t.profile?.dataPrivacyTitle || "Your Data & Privacy"}</h3>
          <p className="text-zinc-500 text-sm">{t.profile?.dataPrivacyDesc || "Under GDPR you can download a copy of everything we hold on you, or permanently delete your account."}</p>
          <div className="flex flex-wrap gap-4">
            <DataExportButton />
            <DeleteAccountButton onOpenModal={() => setShowDeleteModal(true)} />
          </div>
        </div>
      </div>

      <AccountDeletionModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} />
    </motion.div>
  );
}

// ==========================================
// 8. CLIENT AUTH MODAL (login / register)
// ==========================================
function ClientAuthModal({ onClose, loginEmail, registerEmail, loginOAuth, resetPassword, currentUser }: {
  onClose: () => void;
  loginEmail: (email: string, pass: string) => Promise<void>;
  registerEmail: (email: string, pass: string, name: string, phone?: string) => Promise<void>;
  loginOAuth: (provider: 'Google') => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  currentUser: any;
}) {
  const { t } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // loginEmail/registerEmail/loginOAuth report errors via the app-wide toast
  // (see ToastContainer) rather than throwing, so we can't rely on try/catch
  // to know whether it worked. Instead: close automatically the moment
  // Firebase actually confirms a signed-in user.
  useEffect(() => {
    if (currentUser) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'register' && !name) return;
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await loginEmail(email, password);
      } else {
        await registerEmail(email, password, name, phone);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOAuth = async (provider: 'Google') => {
    setSubmitting(true);
    try {
      await loginOAuth(provider);
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) return;
    await resetPassword(email);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-60 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}></div>
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', duration: 0.8 }} className="relative z-10 w-full max-w-md border border-zinc-800 bg-black p-6 sm:p-10">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-serif">{mode === 'login' ? (t.auth?.loginTitle || 'Login') : (t.auth?.registerTitle || 'Create Account')}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-sm">{t.auth?.cancel || 'Cancel'}</button>
        </div>

        <div className="space-y-3 mb-6">
          <button type="button" onClick={() => handleOAuth('Google')} disabled={submitting} className="w-full border border-zinc-700 py-3 text-sm hover:bg-zinc-900 transition-colors flex items-center justify-center gap-3 disabled:opacity-50">
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {t.auth?.continueGoogle || 'Continue with Google'}
          </button>
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-px flex-1 bg-zinc-800"></div>
          <span className="text-zinc-600 text-xs uppercase tracking-widest">{t.auth?.or || 'or'}</span>
          <div className="h-px flex-1 bg-zinc-800"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-zinc-400 text-xs uppercase tracking-widest mb-2">{t.auth?.fullName || 'Full Name'}</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-transparent border-b border-zinc-800 py-2 text-white focus:outline-none focus:border-gold-500" />
              </div>
              <div>
                <label className="block text-zinc-400 text-xs uppercase tracking-widest mb-2">{t.booking?.phone || 'Phone'}</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+49 176 12345678" className="w-full bg-transparent border-b border-zinc-800 py-2 text-white focus:outline-none focus:border-gold-500" />
              </div>
            </>
          )}
          <div>
            <label className="block text-zinc-400 text-xs uppercase tracking-widest mb-2">{t.auth?.email || 'Email Address'}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-transparent border-b border-zinc-800 py-2 text-white focus:outline-none focus:border-gold-500" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-zinc-400 text-xs uppercase tracking-widest">{t.auth?.pass || 'Password'}</label>
              {mode === 'login' && (
                <button type="button" onClick={handleForgotPassword} className="text-zinc-500 hover:text-white text-xs transition-colors">
                  {t.auth?.resetPassBtn || 'Forgot password?'}
                </button>
              )}
            </div>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-transparent border-b border-zinc-800 py-2 text-white focus:outline-none focus:border-gold-500" />
          </div>

          <button type="submit" disabled={submitting} className="w-full gold-shine-btn text-black py-4 mt-4 uppercase tracking-widest text-sm transition-colors font-medium disabled:opacity-50">
            {submitting ? (t.auth?.pleaseWait || 'Please wait…') : mode === 'login' ? (t.auth?.loginBtn || 'Sign In') : (t.auth?.registerTitle || 'Create Account')}
          </button>

          <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="w-full text-center text-zinc-500 hover:text-white text-xs transition-colors pt-2">
            {mode === 'login' ? (t.auth?.noAccount || "Don't have an account? Register") : (t.auth?.haveAccount || 'Already have an account? Sign in')}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ==========================================
// 6. BOOKING FORM (real slots + submission)
// ==========================================
function BookingForm({ servicesDB, stylistsDB }: { servicesDB: any[]; stylistsDB: any[] }) {
  const { currentUser, getAvailableSlots, addAppointment, addNotification, t, lang } = useApp();
  const [service, setService] = useState('');
  const [stylist, setStylist] = useState('Any');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const chosenService = servicesDB.find(s => s.name === service);
  const duration = chosenService?.durationMins || 45;
  const slots = date ? getAvailableSlots(date, stylist, duration) : [];

  const handleSubmit = async () => {
    if (!currentUser || !service || !date || !time) return;
    await addAppointment({
      userId: currentUser.id, name: currentUser.name, phone: currentUser.phone,
      services: [service], totalDurationMins: duration, stylist,
      date, time, status: 'pending', sendsms: true, usedReward: false,
      specialRequests: notes || undefined,
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="border border-zinc-800 p-10 text-center space-y-2">
        <p className="text-xl font-serif">{t.booking?.success?.split('!')[0] ? `${t.booking.success.split('!')[0]}!` : 'Request sent!'}</p>
        <p className="text-zinc-400 text-sm">{t.booking?.success || "We'll email you a confirmation once the salon approves your slot."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-zinc-400 text-sm mb-4">{t.booking?.chooseService || "Choose a service"}</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {servicesDB.length === 0 && <p className="text-zinc-600 text-sm">{t.booking?.noServicesYet || "No services published yet — check back soon."}</p>}
          {servicesDB.map(s => (
            <button key={s.id} onClick={() => setService(s.name)} className={`border p-4 text-left transition-colors ${service === s.name ? 'border-gold-500 bg-zinc-900 gold-glow-ring' : 'border-zinc-800 hover:border-zinc-500'}`}>
              <p className="text-white text-sm">{s.name}</p>
              <p className="text-zinc-500 text-xs mt-1">{s.durationMins} {t.services?.min || "min"} · €{s.price}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-zinc-400 text-sm mb-4">{t.booking?.chooseMaster || "Choose your master"}</label>
        <select value={stylist} onChange={e => setStylist(e.target.value)} className="w-full bg-black border border-zinc-800 p-4 text-white focus:outline-none focus:border-gold-500">
          <option value="Any">{t.booking?.stylistAny || "Any (First Available)"}</option>
          {stylistsDB.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-zinc-400 text-sm mb-4">{t.booking?.date || "Date"}</label>
          <input type="date" value={date} onChange={e => { setDate(e.target.value); setTime(''); }} min={new Date().toISOString().split('T')[0]} className="w-full bg-black border border-zinc-800 p-4 text-white focus:outline-none focus:border-gold-500" />
        </div>
        <div>
          <label className="block text-zinc-400 text-sm mb-4">{t.booking?.time || "Time"}</label>
          <select value={time} onChange={e => setTime(e.target.value)} disabled={!date} className="w-full bg-black border border-zinc-800 p-4 text-white focus:outline-none focus:border-gold-500 disabled:opacity-40">
            <option value="">{date ? (t.common?.selectTime || 'Select a time') : (t.booking?.pickDateFirst || 'Pick a date first')}</option>
            {slots.map(s => <option key={s.id} value={s.time} disabled={s.isBooked}>{s.time}{s.isBooked ? (lang === 'de' ? ' (belegt)' : ' (booked)') : ''}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-zinc-400 text-sm mb-4">{t.booking?.requestsLabel || "Special Requests / Notes (Optional)"}</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full bg-black border border-zinc-800 p-4 text-white focus:outline-none focus:border-gold-500" />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!service || !date || !time}
        className="w-full gold-shine-btn text-black py-4 uppercase tracking-widest text-sm transition-colors font-medium disabled:opacity-40"
      >
        {t.booking?.confirmBooking || "Confirm Booking"}
      </button>
    </div>
  );
}