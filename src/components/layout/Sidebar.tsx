import React from 'react';
import {
  Activity,
  AlertTriangle,
  Camera,
  Cpu,
  FileText,
  Globe,
  Hand,
  History,
  LayoutDashboard,
  MapPin,
  Menu,
  Shield,
  Sliders,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ActiveNav } from '../../types';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const { activeNav, setActiveNav, alerts, gestureState } = useApp();

  const newAlertsCount = alerts.filter((a) => a.status === 'new').length;

  const navItems: Array<{
    id: ActiveNav;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
    badgeColor?: string;
  }> = [
    {
      id: 'dashboard',
      label: 'Main Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'pilot',
      label: 'Satellite & Gesture Pilot',
      icon: Globe,
      badge: 'DUAL VIEW',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold',
    },
    {
      id: 'map',
      label: 'Tactical Map & Zones',
      icon: MapPin,
    },
    {
      id: 'camera',
      label: 'CCTV & Optical Feed Explorer',
      icon: Camera,
      badge: 'DUAL VIEW',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold',
    },
    {
      id: 'conditions',
      label: '10 Monitoring Conditions',
      icon: Shield,
      badge: '10',
    },
    {
      id: 'alerts',
      label: 'Alert & Incident Centre',
      icon: AlertTriangle,
      badge: newAlertsCount > 0 ? newAlertsCount : undefined,
      badgeColor: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
    },
    {
      id: 'gestures',
      label: 'Gesture Control Studio',
      icon: Hand,
      badge: gestureState.isActive ? 'ACTIVE' : undefined,
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40',
    },
    {
      id: 'hardware',
      label: 'Hardware & Sensor Setup',
      icon: Cpu,
    },
    {
      id: 'history',
      label: 'Event History & Audit',
      icon: History,
    },
    {
      id: 'guide',
      label: 'RTSP & NVR Guide',
      icon: FileText,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-30 lg:hidden"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 lg:top-[57px] left-0 h-screen lg:h-[calc(100vh-57px)] w-64 bg-[#070b14] border-r border-cyan-500/15 flex flex-col z-40 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Mobile Header in drawer */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 lg:hidden">
          <span className="font-heading font-bold text-slate-200">AuraVision Menu</span>
          <button
            onClick={onToggle}
            className="p-1 rounded text-slate-400 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-hud uppercase tracking-widest text-slate-400">
            Operations & Control
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveNav(item.id);
                  if (window.innerWidth < 1024) {
                    onToggle();
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-950/80 to-indigo-950/40 text-cyan-300 border-l-2 border-cyan-400 font-semibold shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-300'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-hud px-1.5 py-0.5 rounded ${
                      item.badgeColor || 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer — Status & Integrity Info */}
        <div className="p-3 border-t border-slate-900 bg-slate-950/60">
          <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800 text-[11px] font-hud space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">MAP ENGINE:</span>
              <span className="text-cyan-400">Leaflet / OSM</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">CREDENTIALS:</span>
              <span className="text-emerald-400">Zero-Key Demo</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">GESTURE TARGET:</span>
              <span className="text-indigo-300 uppercase">{gestureState.target}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
