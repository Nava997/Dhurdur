"use client";
import React, { useState, useEffect } from 'react';
import { useApp, Appointment, fallbackTranslations } from '@/context/AppContext';
import { auth, db } from '@/lib/firebase';
import { verifyBeforeUpdateEmail } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

const countryCodes = [
  { code: '+49', label: 'Deutschland 🇩🇪' }, { code: '+43', label: 'Österreich 🇦🇹' }, { code: '+41', label: 'Schweiz 🇨🇭' },
  { code: '+1', label: 'USA/Kanada 🇺🇸' }, { code: '+44', label: 'UK 🇬🇧' }, { code: '+33', label: 'Frankreich 🇫🇷' },
  { code: '+39', label: 'Italien 🇮🇹' }, { code: '+34', label: 'Spanien 🇪🇸' }, { code: '+31', label: 'Niederlande 🇳🇱' },
  { code: '+32', label: 'Belgien 🇧🇪' }, { code: '+48', label: 'Polen 🇵🇱' }, { code: '+46', label: 'Schweden 🇸🇪' },
];

export function ProfileView() {
  const { t, currentUser, appointments, addNotification, requestPasswordOtp, updateUserPassword, updateAppointmentStatus } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');

  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCountryCode, setEditCountryCode] = useState('+49');
  const [editPhone, setEditPhone] = useState('');

  // Password Update State
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [inputPassOTP, setInputPassOTP] = useState('');
  const [isVerifyingPassOTP, setIsVerifyingPassOTP] = useState(false);

  const primaryColor = 'text-[white]';
  const bgBorder = 'border-zinc-800 bg-black';

  const secTrans = t.security || fallbackTranslations.de.security;
  const authTrans = t.auth || fallbackTranslations.de.auth;

  const isEmailProvider = auth.currentUser?.providerData.some(p => p.providerId === 'password');
  const [showForcePasswordModal, setShowForcePasswordModal] = useState(false);

  useEffect(() => {
    if (currentUser && isEmailProvider && currentUser.hasUpdatedPassword !== true) {
      setShowForcePasswordModal(true);
    }
  }, [currentUser, isEmailProvider]);

  useEffect(() => {
    if (currentUser) {
      setEditName(currentUser.name);
      setEditEmail(currentUser.email);
      let pNum = currentUser.phone || "";
      let cCode = "+49";
      for (let c of countryCodes) {
        if (pNum.startsWith(c.code)) { cCode = c.code; pNum = pNum.replace(c.code, "").trim(); break; }
      }
      setEditCountryCode(cCode);
      setEditPhone(pNum);
    }
  }, [currentUser]);

  if (!currentUser) return null;

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editEmail !== currentUser.email && auth.currentUser) {
        await verifyBeforeUpdateEmail(auth.currentUser, editEmail);
        addNotification("Confirmation email sent! Please check your inbox.", "info");
      }
      const fullPhone = `${editCountryCode}${editPhone}`.replace(/\s+/g, '');
      await updateDoc(doc(db, 'users', currentUser.id), { name: editName, phone: fullPhone });
      addNotification("Profil erfolgreich aktualisiert!", "success");
      setActiveTab('overview');
    } catch (err: any) { addNotification(err.message, "error"); }
  };

  const handleSendPassOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) return addNotification("Passwords do not match.", "error");
    if (newPass.length < 8) return addNotification("Password must be at least 8 characters long.", "error");
    if (!/[A-Z]/.test(newPass) || !/[a-z]/.test(newPass) || !/[0-9]/.test(newPass) || !/[^A-Za-z0-9]/.test(newPass)) {
      return addNotification("Password needs an uppercase letter, a lowercase letter, a number and a special character.", "error");
    }

    try {
      await requestPasswordOtp();
      setIsVerifyingPassOTP(true);
      addNotification("Confirmation code sent to your email!", "info");
    } catch (err: any) { addNotification(err.message || "Error sending code.", "error"); }
  };

  const handleVerifyPassOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(inputPassOTP)) return addNotification("Invalid code. Please try again.", "error");
    try {
      await updateUserPassword(oldPass, newPass, inputPassOTP);
      setOldPass(''); setNewPass(''); setConfirmPass(''); setInputPassOTP(''); setIsVerifyingPassOTP(false);
      setShowForcePasswordModal(false);
    } catch (err: any) {
      addNotification(err.message, "error");
    }
  };

  const hasLength = newPass.length >= 8;
  const hasUpper = /[A-Z]/.test(newPass);
  const hasLower = /[a-z]/.test(newPass);
  const hasNum = /[0-9]/.test(newPass);
  const hasSpec = /[^A-Za-z0-9]/.test(newPass);
  const passScore = [hasLength, hasUpper, hasLower, hasNum, hasSpec].filter(Boolean).length;
  const passWidth = `${(passScore / 5) * 100}%`;
  const passColor = passScore <= 2 ? 'bg-red-500' : passScore <= 4 ? 'bg-yellow-500' : 'bg-green-500';
  const passLabel = passScore <= 2 ? (authTrans.weak || 'Schwach') : passScore <= 4 ? (authTrans.medium || 'Mittel') : (authTrans.strong || 'Stark');

  const userAppts = appointments.filter((a: Appointment) => a.userId === currentUser.id).sort((a: Appointment, b: Appointment) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const upcoming = userAppts.filter((a: Appointment) => a.status === 'pending' || a.status === 'proposed');
  const past = userAppts.filter((a: Appointment) => a.status === 'confirmed');

  return (
    <div className="min-h-screen pt-28 md:pt-32 px-4 md:px-6 max-w-4xl mx-auto animate-in fade-in duration-500 pb-20 relative">

      {showForcePasswordModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="p-8 md:p-10 border  shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-300 bg-black border-white/20">
            <h3 className="text-2xl font-bold mb-2 uppercase text-red-400">{secTrans.title}</h3>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">{secTrans.desc}</p>

            {!isVerifyingPassOTP ? (
              <form onSubmit={handleSendPassOTP} className="space-y-4">
                 <div>
                   <label className="block text-xs uppercase text-zinc-400 mb-2">{secTrans.currentPass}</label>
                   <input required type="password" value={oldPass} onChange={e=>setOldPass(e.target.value)} className="w-full bg-black border border-white/20 p-4  text-white" />
                 </div>
                 <div>
                   <label className="block text-xs uppercase text-zinc-400 mb-2">{secTrans.newPass}</label>
                   <input required type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} className="w-full bg-black border border-white/20 p-4  text-white mb-2" />
                   {newPass.length > 0 && (
                      <div className="mb-4">
                        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden mb-2"><div className={`h-full transition-all duration-300 ${passColor}`} style={{ width: passWidth }} /></div>
                      </div>
                   )}
                 </div>
                 <div>
                   <label className="block text-xs uppercase text-zinc-400 mb-2">{secTrans.confirmPass}</label>
                   <input required type="password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} className="w-full bg-black border border-white/20 p-4  text-white" />
                 </div>
                 <button type="submit" disabled={!hasLength} className="w-full py-4 font-bold uppercase text-xs  mt-4 disabled:opacity-50 bg-[white] text-black">{secTrans.sendCode}</button>
              </form>
            ) : (
              <form onSubmit={handleVerifyPassOTP} className="space-y-5">
                <div>
                  <label className="block text-xs uppercase text-zinc-400 mb-2">{secTrans.enterCode}</label>
                  <input required type="text" maxLength={6} value={inputPassOTP} onChange={e => setInputPassOTP(e.target.value)} placeholder="------" className="w-full border border-white/20  p-4 outline-none text-2xl tracking-[0.5em] text-center font-mono bg-black text-white" />
                </div>
                <div className="flex gap-4 mt-8">
                  <button type="button" onClick={() => setIsVerifyingPassOTP(false)} className="flex-1 py-4 uppercase text-xs font-bold text-zinc-400 border border-zinc-700 hover:text-white  transition-colors">{secTrans.cancel}</button>
                  <button type="submit" className="flex-1 py-4 uppercase text-xs font-bold text-black  transition-colors gold-shine-btn">{secTrans.confirmBtn}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-zinc-800 pb-4 gap-4">
         <div>
           <h2 className="text-3xl md:text-5xl font-bold mb-2 uppercase tracking-tight">{t.profile.title}</h2>
           <p className="text-zinc-400 text-sm md:text-base">{t.profile?.welcome || "Welcome back"}, {currentUser.name}</p>
         </div>
         <div className="flex gap-2 bg-black border border-zinc-800 p-1 ">
            <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 text-xs uppercase font-bold tracking-widest transition-colors ${activeTab === 'overview' ? 'bg-[white] text-black' : 'text-zinc-400 hover:text-white'}`}>{t.profile?.overview || "Overview"}</button>
            <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 text-xs uppercase font-bold tracking-widest transition-colors ${activeTab === 'settings' ? 'bg-[white] text-black' : 'text-zinc-400 hover:text-white'}`}>{t.profile?.settings || "Settings"}</button>
         </div>
      </div>

      {activeTab === 'settings' ? (
        <div className={`p-6 md:p-10 border  shadow-xl space-y-10 ${bgBorder}`}>
           <form onSubmit={handleUpdateSettings} className="space-y-6">
             <h3 className="text-xl font-bold mb-4">{t.profile?.editProfile || "Profil bearbeiten"}</h3>
             <div>
               <label className="block text-xs uppercase text-zinc-400 mb-2">Full Name</label>
               <input required value={editName} onChange={e=>setEditName(e.target.value)} type="text" className="w-full bg-black border border-white/20 p-4  text-white" />
             </div>
             <div>
               <label className="block text-xs uppercase text-zinc-400 mb-2">Email Address (change requires confirmation)</label>
               <input required value={editEmail} onChange={e=>setEditEmail(e.target.value)} type="email" className="w-full bg-black border border-white/20 p-4  text-white" />
             </div>
             <div>
               <label className="block text-xs uppercase text-zinc-400 mb-2">Telefonnummer</label>
               <div className="flex gap-2">
                  <select value={editCountryCode} onChange={e=>setEditCountryCode(e.target.value)} className="w-[30%] bg-black border border-white/20 p-4  text-white">
                    {countryCodes.map(c => <option key={c.code} value={c.code}>{c.code} {c.label}</option>)}
                  </select>
                  <input required value={editPhone} onChange={e=>setEditPhone(e.target.value)} type="tel" className="w-[70%] bg-black border border-white/20 p-4  text-white" />
               </div>
             </div>
             <button type="submit" className="w-full py-4 font-bold uppercase text-xs  bg-[white] text-black">Einstellungen speichern</button>
           </form>

           <div className="border-t border-zinc-800 pt-8">
              <h3 className="text-xl font-bold mb-4 text-red-400">{secTrans.secTitle}</h3>
              {!isEmailProvider ? (
                <p className="text-sm text-zinc-500 italic">{secTrans.oauthMsg}</p>
              ) : !isVerifyingPassOTP ? (
                <form onSubmit={handleSendPassOTP} className="space-y-4">
                   <div>
                     <label className="block text-xs uppercase text-zinc-400 mb-2">{secTrans.currentPass}</label>
                     <input required type="password" value={oldPass} onChange={e=>setOldPass(e.target.value)} className="w-full bg-black border border-white/20 p-4  text-white" />
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                       <label className="block text-xs uppercase text-zinc-400 mb-2">{secTrans.newPass}</label>
                       <input required type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} className="w-full bg-black border border-white/20 p-4  text-white mb-2" />
                       {newPass.length > 0 && (
                          <div className="mt-2 p-3 bg-black/40 border border-white/5 ">
                            <div className="flex justify-between items-center text-[10px] mb-2 uppercase tracking-widest"><span className="text-zinc-500">{authTrans.passStrength || 'Strength:'}</span><span className={passColor.replace('bg-', 'text-')}>{passLabel}</span></div>
                            <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden mb-2"><div className={`h-full transition-all duration-300 ${passColor}`} style={{ width: passWidth }} /></div>
                            <ul className="text-[9px] text-zinc-500 grid grid-cols-2 gap-1">
                              <li className={hasLength ? 'text-green-400' : ''}>{hasLength ? '✓' : '○'} {authTrans.ruleLength || '8+ characters'}</li>
                              <li className={hasUpper ? 'text-green-400' : ''}>{hasUpper ? '✓' : '○'} {authTrans.ruleUpper || 'Uppercase letter'}</li>
                              <li className={hasLower ? 'text-green-400' : ''}>{hasLower ? '✓' : '○'} {authTrans.ruleLower || 'Lowercase letter'}</li>
                              <li className={hasNum ? 'text-green-400' : ''}>{hasNum ? '✓' : '○'} {authTrans.ruleNum || 'Number'}</li>
                              <li className={hasSpec ? 'text-green-400' : ''}>{hasSpec ? '✓' : '○'} {authTrans.ruleSpec || 'Special character'}</li>
                            </ul>
                          </div>
                       )}
                     </div>
                     <div>
                       <label className="block text-xs uppercase text-zinc-400 mb-2">{secTrans.confirmPass}</label>
                       <input required type="password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} className="w-full bg-black border border-white/20 p-4  text-white" />
                     </div>
                   </div>
                   <button type="submit" disabled={!hasLength} className="w-full md:w-auto px-8 py-3 bg-red-600/20 text-red-400 border border-red-600 font-bold uppercase text-xs  mt-4 hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50">{secTrans.sendOtpBtn}</button>
                </form>
              ) : (
                <form onSubmit={handleVerifyPassOTP} className="space-y-4 max-w-sm">
                  <div>
                    <label className="block text-xs uppercase text-zinc-400 mb-2">{secTrans.enterCode}</label>
                    <input required type="text" maxLength={6} value={inputPassOTP} onChange={e => setInputPassOTP(e.target.value)} placeholder="------" className="w-full border border-white/20  p-4 outline-none text-2xl tracking-[0.5em] text-center font-mono bg-black text-white" />
                  </div>
                  <div className="flex gap-4 mt-4">
                    <button type="button" onClick={() => setIsVerifyingPassOTP(false)} className="flex-1 py-3 uppercase text-xs font-bold text-zinc-400 border border-zinc-700 hover:text-white  transition-colors">{secTrans.cancel}</button>
                    <button type="submit" className="flex-1 py-3 uppercase text-xs font-bold text-black  transition-colors gold-shine-btn">{secTrans.confirmBtn}</button>
                  </div>
                </form>
              )}
           </div>
        </div>
      ) : (
        <>
          <div className={`p-6 md:p-8 mb-6 border  flex items-center justify-between shadow-xl ${bgBorder}`}>
            <div>
              <p className="text-zinc-400 text-xs uppercase tracking-widest mb-1">{t.profile?.contactData || "Kontaktdaten"}</p>
              <p className="text-lg font-bold">{currentUser.email}</p>
              <p className="text-zinc-300 mt-1">{currentUser.phone || t.profile?.noPhone || "No phone number on file. Please add one in settings."}</p>
            </div>
            <button onClick={() => setActiveTab('settings')} className="p-3 border border-white/20  hover:bg-white/5 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
          </div>

          <div className={`p-6 md:p-8 mb-10 border  shadow-xl ${bgBorder}`}>
            <h3 className="text-lg md:text-xl font-bold mb-2">{t.profile.pointsTitle}</h3>
            <p className="text-xs md:text-sm text-zinc-400 mb-6">{t.profile.pointsDesc}</p>
            <div className="w-full h-4 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
              <div className="h-full transition-all duration-1000 bg-[white]" style={{ width: `${(currentUser.haircutCount / 10) * 100}%` }} />
            </div>
            <p className={`text-right mt-2 text-sm font-bold ${primaryColor}`}>{currentUser.haircutCount} / 10</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg md:text-xl font-bold mb-6">{t.profile.upcomingTitle}</h3>
              <div className="space-y-4">
                {upcoming.map((a: Appointment) => {
                  const sList = Array.isArray(a.services) ? a.services.join(', ') : (a as any).service || 'Leistung';
                  return (
                    <div key={a.id} className={`p-5 border  ${bgBorder}`}>
                      <p className="font-bold text-base">{sList}</p>
                      <p className="text-xs text-zinc-400 mb-3">{a.date} {t.common?.at || 'um'} {a.time} {t.common?.by || 'bei'} {a.stylist} ({a.totalDurationMins || 60} {t.services?.min || 'Minuten'})</p>

                      {a.status === 'proposed' ? (
                        <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 ">
                          <p className="text-blue-400 text-xs font-bold mb-2">⚠️ {t.profile?.newProposal || "Neuer Terminvorschlag vom Salon:"}</p>
                          <p className="text-white text-sm mb-3">{a.proposedDate} um {a.proposedTime} Uhr</p>
                          <div className="flex gap-2">
                            <button onClick={() => updateAppointmentStatus(a.id, 'confirmed', true, undefined, a.proposedDate, a.proposedTime)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-xs font-bold uppercase ">{t.profile?.acceptTime || "Zeit Akzeptieren"}</button>
                            <button onClick={() => updateAppointmentStatus(a.id, 'cancelled', false)} className="border border-red-500/50 text-red-400 hover:bg-red-500/10 px-3 py-1.5 text-xs font-bold uppercase ">{t.profile?.cancel || "Stornieren"}</button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] uppercase bg-yellow-600/20 text-yellow-400 border border-yellow-600 px-3 py-1 ">{t.profile?.pending || "Ausstehend"}</span>
                      )}
                    </div>
                  );
                })}
                {upcoming.length === 0 && <p className="text-zinc-500 text-sm">{t.profile.noHistory}</p>}
              </div>
            </div>

            <div>
              <h3 className="text-lg md:text-xl font-bold mb-6">{t.profile.historyTitle}</h3>
              <div className="space-y-4">
                {past.map((a: Appointment) => {
                  const sList = Array.isArray(a.services) ? a.services.join(', ') : (a as any).service || 'Leistung';
                  return (
                    <div key={a.id} className={`p-5 border  ${bgBorder}`}>
                      <p className="font-bold text-base">{sList}</p>
                      <p className="text-xs text-zinc-400 mb-3">{a.date} {t.common?.by || 'bei'} {a.stylist}</p>
                      <span className="text-[10px] uppercase bg-green-600/20 text-green-400 border border-green-600 px-3 py-1 ">{t.profile?.completed || "Abgeschlossen"}</span>
                    </div>
                  );
                })}
                {past.length === 0 && <p className="text-zinc-500 text-sm">{t.profile.noHistory}</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}