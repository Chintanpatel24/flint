import { useStore } from '../../store';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, Type, Eye, Save, Globe, Brain, Palette, Monitor } from 'lucide-react';

export function SettingsPanel() {
  const { t, i18n } = useTranslation();
  const { state, dispatch } = useStore();
  const { appSettings } = state;

  const updateSetting = (key: string, value: any) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: { [key]: value } });
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    updateSetting('language', lng);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center backdrop-blur-sm"
      onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })}>
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl w-[600px] max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>

        <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SettingsIcon size={18} className="text-[#4a9eff]" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#888]">{t('settings.title')}</h2>
          </div>
          <button onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })} className="text-[#333] hover:text-white transition-colors">{t('common.close')}</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          <section className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#222] flex items-center gap-2">
              <Globe size={12}/> {t('settings.language')}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => changeLanguage('en')} className={`px-4 py-2 rounded-lg border text-xs font-bold transition-all ${i18n.language === 'en' ? 'bg-[#111] border-[#4a9eff] text-[#4a9eff]' : 'bg-transparent border-[#111] text-[#333] hover:border-[#222]'}`}>English</button>
              <button onClick={() => changeLanguage('ru')} className={`px-4 py-2 rounded-lg border text-xs font-bold transition-all ${i18n.language === 'ru' ? 'bg-[#111] border-[#4a9eff] text-[#4a9eff]' : 'bg-transparent border-[#111] text-[#333] hover:border-[#222]'}`}>Русский</button>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#222] flex items-center gap-2">
              <Palette size={12}/> {t('settings.appearance')}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#555]">{t('settings.theme')}</span>
                <select value={appSettings.theme} onChange={e => updateSetting('theme', e.target.value)} className="bg-[#111] border border-[#1a1a1a] rounded px-2 py-1 text-xs text-[#888] outline-none">
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="sepia">Sepia</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#555]">{t('settings.fontSize')}</span>
                <input type="range" min="10" max="24" value={appSettings.fontSize} onChange={e => updateSetting('fontSize', parseInt(e.target.value))} className="w-32 accent-[#4a9eff]" />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#222] flex items-center gap-2">
              <Monitor size={12}/> {t('settings.editor')}
            </h3>
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                <span className="text-xs text-[#555]">{t('settings.dailyNoteTemplate')}</span>
               </div>
               <textarea
                value={appSettings.dailyNoteTemplate || ''}
                onChange={e => updateSetting('dailyNoteTemplate', e.target.value)}
                className="w-full h-32 bg-[#050505] border border-[#1a1a1a] rounded-lg p-3 text-[11px] text-[#888] outline-none focus:border-[#222] transition-colors font-mono"
                placeholder="# {{date}}..."
               />
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
