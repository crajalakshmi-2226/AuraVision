import React, { useState } from 'react';
import { Download, CheckCircle2, Share, PlusSquare, HelpCircle, X, WifiOff } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isOnline, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [showOfflineNotice, setShowOfflineNotice] = useState(false);

  // If already installed and running standalone, display a clean status badge
  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>PWA ACTIVE</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {!isOnline && (
          <button
            onClick={() => setShowOfflineNotice(true)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs hover:bg-amber-500/20 transition"
            title="Offline mode active - local features available"
          >
            <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Offline Mode</span>
          </button>
        )}

        {isInstallable ? (
          <button
            onClick={install}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-medium shadow-md shadow-cyan-900/30 border border-cyan-400/30 transition-all active:scale-95 cursor-pointer animate-pulse"
            title="Install AuraVision AI as native application"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install App</span>
          </button>
        ) : isIOS ? (
          <button
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Install App</span>
          </button>
        ) : (
          <button
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-xs border border-slate-800 hover:border-slate-700 transition cursor-pointer"
            title="How to install AuraVision on desktop or mobile"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Install</span>
            <HelpCircle className="w-3 h-3 text-slate-400" />
          </button>
        )}
      </div>

      {/* Installation Instructions Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-xl p-5 max-w-md w-full shadow-2xl relative text-slate-200">
            <button
              onClick={() => setShowGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                <Download className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white font-mono tracking-wide">
                  Install AuraVision AI
                </h3>
                <p className="text-xs text-slate-400">Desktop & Mobile Standalone App</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300">
              {isIOS ? (
                <>
                  <p className="text-slate-400">
                    To install on iOS Safari (iPhone / iPad):
                  </p>
                  <ol className="space-y-2 list-decimal list-inside pl-1">
                    <li className="leading-relaxed">
                      Tap the <strong className="text-cyan-400 inline-flex items-center gap-1"><Share className="w-3.5 h-3.5 inline" /> Share</strong> icon at the bottom of Safari.
                    </li>
                    <li className="leading-relaxed">
                      Scroll down and tap <strong className="text-cyan-400 inline-flex items-center gap-1"><PlusSquare className="w-3.5 h-3.5 inline" /> Add to Home Screen</strong>.
                    </li>
                    <li className="leading-relaxed">
                      Tap <strong className="text-cyan-400">Add</strong> in the top-right corner to launch AuraVision from your home screen.
                    </li>
                  </ol>
                </>
              ) : (
                <>
                  <p className="text-slate-400">
                    AuraVision AI can be installed as a standalone desktop or Android application:
                  </p>
                  <div className="space-y-2.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800 font-mono text-[11px]">
                    <div className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">1.</span>
                      <span>Chrome / Edge Desktop: Look for the install icon in the URL bar (top right) or open menu (⋮) → <strong className="text-cyan-300">"Install AuraVision AI..."</strong></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">2.</span>
                      <span>Android: Open browser menu (⋮) → tap <strong className="text-cyan-300">"Add to Home screen"</strong> or <strong className="text-cyan-300">"Install app"</strong>.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">3.</span>
                      <span>Enjoy zero browser chrome, fullscreen gesture exploration, and fast offline shell caching!</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>Security verified • Safe caching</span>
              <button
                onClick={() => setShowGuide(false)}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline Notice Modal */}
      {showOfflineNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-5 max-w-md w-full shadow-2xl relative text-slate-200">
            <button
              onClick={() => setShowOfflineNotice(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <WifiOff className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="text-sm font-semibold text-white font-mono">
                Network Status: Offline
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              AuraVision PWA shell and local gesture recognition remain operational offline. 
              Live CCTV streams, cloud AI inferences, and new satellite tiles require an internet connection.
            </p>
            <button
              onClick={() => setShowOfflineNotice(false)}
              className="w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 border border-slate-700 transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </>
  );
};
