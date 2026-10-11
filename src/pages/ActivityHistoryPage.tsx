import React, { useState } from 'react';
import {
  Clock,
  Download,
  Filter,
  History,
  Search,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Alert } from '../types';

export const ActivityHistoryPage: React.FC = () => {
  const { alerts, notifications, conditions } = useApp();
  const [filterType, setFilterType] = useState<'all' | 'incidents' | 'system'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const exportAuditLog = () => {
    const data = {
      system: 'AuraVision AI',
      exportedAt: new Date().toISOString(),
      alerts: alerts,
      recentAuditLogs: notifications,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auravision-audit-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const combinedEvents = [
    ...alerts.map((a) => ({
      id: a.id,
      type: 'incident' as const,
      timestamp: a.timestamp,
      title: `[${a.severity.toUpperCase()}] ${a.conditionTitle}`,
      detail: a.description,
      status: a.status,
      notes: a.operatorNotes,
    })),
    ...notifications.map((n, i) => ({
      id: `sys-${i}`,
      type: 'system' as const,
      timestamp: 'Today',
      title: 'System Event Log',
      detail: n,
      status: 'logged',
      notes: undefined,
    })),
  ].filter((item) => {
    if (filterType === 'incidents' && item.type !== 'incident') return false;
    if (filterType === 'system' && item.type !== 'system') return false;
    if (searchQuery) {
      return (
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.detail.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-100 flex items-center gap-2">
            <History className="w-6 h-6 text-cyan-400" />
            Audit Trail & Event History
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable log of operator actions, sensor telemetries, and simulated incident lifecycles
          </p>
        </div>

        <button
          onClick={exportAuditLog}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-slate-950 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Audit Log (JSON)</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0b1221] p-3 rounded-xl border border-slate-800 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search audit trail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded p-0.5">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded font-hud text-[11px] transition-colors ${
              filterType === 'all' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Logs
          </button>
          <button
            onClick={() => setFilterType('incidents')}
            className={`px-3 py-1 rounded font-hud text-[11px] transition-colors ${
              filterType === 'incidents' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Incidents Only
          </button>
          <button
            onClick={() => setFilterType('system')}
            className={`px-3 py-1 rounded font-hud text-[11px] transition-colors ${
              filterType === 'system' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            System Telemetry
          </button>
        </div>
      </div>

      {/* Log list */}
      <div className="bg-[#0b1221] border border-cyan-500/20 rounded-xl p-4 divide-y divide-slate-800/60">
        {combinedEvents.map((ev, i) => (
          <div key={ev.id || i} className="py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-hud text-[11px]">
                <span className={`px-2 py-0.5 rounded uppercase ${
                  ev.type === 'incident' ? 'bg-rose-950/80 text-rose-300 border border-rose-800' : 'bg-slate-900 text-cyan-300 border border-slate-700'
                }`}>
                  {ev.type}
                </span>
                <span className="text-slate-400">{ev.timestamp}</span>
              </div>
              <h4 className="font-semibold text-slate-100">{ev.title}</h4>
              <p className="text-slate-400 leading-relaxed">{ev.detail}</p>
              {ev.notes && (
                <p className="text-cyan-400 font-hud text-[11px] mt-1">
                  ↳ Operator Note: {ev.notes}
                </p>
              )}
            </div>

            <span className="font-hud uppercase text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 shrink-0">
              {ev.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
