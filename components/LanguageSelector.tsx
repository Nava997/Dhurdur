"use client";
import { useState } from 'react';
import { useApp } from '@/context/AppContext';

export function LanguageSelector() {
  const { lang, changeLanguage, isTranslatingUI, t } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const languages = [
    { code: 'de', name: 'Deutsch' }, { code: 'en', name: 'English' }, { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' }, { code: 'it', name: 'Italiano' }, { code: 'nl', name: 'Nederlands' },
    { code: 'tr', name: 'Türkçe' }, { code: 'pl', name: 'Polski' }, { code: 'ru', name: 'Русский' },
    { code: 'ar', name: 'العربية' }, { code: 'zh', name: '中文' }, { code: 'ja', name: '日本語' }
  ];

  const filteredLangs = languages.filter(l => l.name.toLowerCase().includes(search.toLowerCase()) || l.code.toLowerCase().includes(search.toLowerCase()));
  const currentLangName = languages.find(l => l.code === lang)?.name || lang.toUpperCase();

  return (
    <div className="relative z-50 ml-2">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        disabled={isTranslatingUI}
        className="flex items-center gap-2 px-3 py-1.5 border rounded-full text-xs font-bold transition-colors border-zinc-700 text-zinc-300 hover:text-white"
      >
        {isTranslatingUI ? (
          <span className="animate-pulse">{t.common?.loading || 'Lädt...'}</span>
        ) : (
          <>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {currentLangName}
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 border  shadow-2xl p-2 animate-in fade-in zoom-in-95 bg-black border-zinc-800">
          <input 
            type="text" 
            placeholder={t.common?.searchLang || "Sprache suchen..."} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black border p-2  text-xs text-white outline-none mb-2 border-white/20 focus:border-gold-500"
          />
          <div className="max-h-48 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
            {filteredLangs.map(l => (
              <button 
                key={l.code}
                onClick={() => { changeLanguage(l.code); setIsOpen(false); setSearch(''); }}
                className={`w-full text-left px-2 py-1.5 text-xs  transition-colors ${lang === l.code ? 'bg-gold-500 text-black font-bold' : 'text-zinc-400 hover:bg-white/10 hover:text-white'}`}
              >
                {l.name}
              </button>
            ))}
            {filteredLangs.length === 0 && <p className="text-zinc-500 text-[10px] p-2">{t.common?.noResults || "Keine gefunden."}</p>}
          </div>
        </div>
      )}
    </div>
  );
}