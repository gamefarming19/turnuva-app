// app/components/ResultModal.js
"use client";
import { X } from "lucide-react";

export default function ResultModal({ 
  match, 
  customFields, 
  onClose, 
  onSubmit, 
  details, 
  setDetails 
}) {
  if (!match) return null;

  const isBye = match.p2_id === "BYE";

  return (
    <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-xl z-[1000] flex items-center justify-center p-4">
      <div className="bg-[#0f172a] w-full max-w-lg rounded-[4rem] p-10 shadow-2xl border border-white/5 flex flex-col text-center relative">
        
        <button onClick={onClose} className="absolute top-8 right-10 text-slate-500 hover:text-white transition-colors">
          <X size={24} />
        </button>

        <h3 className="text-indigo-500 text-[10px] font-black uppercase mb-12 tracking-[0.2em] italic border-b border-white/5 pb-4 w-fit mx-auto">
          Teknik Veri Kaydı
        </h3>

        {!isBye && customFields?.length > 0 && (
          <div className="grid grid-cols-2 gap-10 mb-12">
            {['p1', 'p2'].map((playerKey) => (
              <div key={playerKey} className="space-y-6">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-tighter truncate px-2">
                  {playerKey === 'p1' ? match.p1 : match.p2}
                </p>
                <div className="space-y-4">
                  {customFields.map((field, idx) => (
                    <div key={idx} className="text-left">
                      <label className="text-[8px] font-black text-slate-500 ml-3 mb-1 block uppercase tracking-widest">
                        {field.label}
                      </label>
                      <input 
                        type="number" 
                        className="w-full bg-slate-900/50 border border-white/5 p-4 rounded-2xl font-black text-white outline-none focus:border-indigo-500 transition-all text-center"
                        placeholder="0"
                        value={details[`${playerKey}_${field.label}`] || ""}
                        onChange={(e) => setDetails(prev => ({...prev, [`${playerKey}_${field.label}`]: e.target.value}))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4">
          <button 
            onClick={() => onSubmit(match, "1-0", match.p1)} 
            className="w-full bg-indigo-600 hover:bg-indigo-50 text-white py-6 rounded-[2.5rem] font-black text-sm uppercase shadow-xl transition-all active:scale-95"
          >
            {match.p1.split(' ')[0]} KAZANDI
          </button>

          <button 
            disabled={isBye}
            onClick={() => onSubmit(match, "0.5-0.5", "")} 
            className={`w-full py-6 rounded-[2.5rem] font-black text-[11px] uppercase transition-all
              ${isBye ? "opacity-20 cursor-not-allowed bg-slate-800 text-slate-600" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
          >
            BERABERE
          </button>

          <button 
            disabled={isBye}
            onClick={() => onSubmit(match, "0-1", match.p2)} 
            className={`w-full py-6 rounded-[2.5rem] font-black text-sm uppercase shadow-xl transition-all
              ${isBye ? "opacity-20 cursor-not-allowed bg-rose-900/20 text-slate-600" : "bg-rose-600 hover:bg-rose-500 text-white"}`}
          >
            {isBye ? "BYE" : `${match.p2.split(' ')[0]} KAZANDI`}
          </button>

          <button onClick={onClose} className="w-full pt-8 text-slate-500 font-black text-[10px] uppercase tracking-[0.3em] hover:text-slate-300 transition-colors underline underline-offset-8 decoration-white/10">
            VAZGEÇ
          </button>
        </div>
      </div>
    </div>
  );
}