import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  Info,
  MessageSquare,
  Radio,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Alert, AlertStatus, Severity } from '../types';

export const AlertsCenterPage: React.FC = () => {
  const {
    alerts,
    acknowledgeAlert,
    resolveAlert,
    clearResolvedAlerts,
    injectSimulatedIncident,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | Severity>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | AlertStatus>('all');
  const [selectedAlertForDetail, setSelectedAlertForDetail] = useState<Alert | null>(null);
  const [operatorNotesInput, setOperatorNotesInput] = useState('');

  const filteredAlerts = alerts.filter((alert) => {
    const matchesSearch =
      alert.conditionTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.source.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || alert.status === statusFilter;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const getSeverityBadge = (sev: Severity) => {
    switch (sev) {
      case 'critical':
        return 'bg-rose-950/80 text-rose-300 border border-rose-700 shadow-[0_0_10px_rgba(244,63,94,0.3)]';
      case 'high':
        return 'bg-amber-950/80 text-amber-300 border border-amber-700 shadow-[0_0_10px_rgba(245,158,11,0.2)]';
      case 'medium':
        return 'bg-indigo-950/80 text-indigo-300 border border-indigo-700';
      case 'low':
        return 'bg-slate-900 text-slate-300 border border-slate-700';
    }
  };

  const getStatusBadge = (status: AlertStatus) => {
    switch (status) {
      case 'new':
        return 'bg-rose-950/50 text-rose-400 border border-rose-800/80 font-bold animate-pulse';
      case 'acknowledged':
        return 'bg-amber-950/50 text-amber-300 border border-amber-800/80 font-medium';
      case 'resolved':
        return 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/80 font-medium';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            Alerts & Incident Management Centre
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit trail, operator acknowledgment workflows, severity prioritization, and resolution tracking
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={injectSimulatedIncident}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border border-indigo-500/40 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Inject Test Incident</span>
          </button>

          <button
            onClick={clearResolvedAlerts}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Clear Resolved</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0b1221] p-3 rounded-xl border border-slate-800">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search incident logs, zones, sensors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Severity selector */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded p-0.5">
            {(['all', 'critical', 'high', 'medium'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2 py-1 rounded capitalize font-hud text-[11px] transition-colors ${
                  severityFilter === sev
                    ? 'bg-slate-800 text-cyan-300 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* Status selector */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded p-0.5">
            {(['all', 'new', 'acknowledged', 'resolved'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-1 rounded capitalize font-hud text-[11px] transition-colors ${
                  statusFilter === st
                    ? 'bg-slate-800 text-cyan-300 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Alerts Table / Card View */}
      <div className="space-y-3">
        {filteredAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-4 rounded-xl border bg-[#0b1221] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              alert.status === 'new'
                ? alert.severity === 'critical'
                  ? 'border-rose-600/50 shadow-[0_0_20px_rgba(244,63,94,0.1)]'
                  : 'border-amber-500/40'
                : 'border-slate-800 opacity-85'
            }`}
          >
            {/* Left Info Column */}
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs font-hud">
                {/* Severity Badge */}
                <span className={`px-2 py-0.5 rounded uppercase font-semibold text-[10px] ${getSeverityBadge(alert.severity)}`}>
                  {alert.severity}
                </span>

                {/* Status Badge */}
                <span className={`px-2 py-0.5 rounded uppercase text-[10px] ${getStatusBadge(alert.status)}`}>
                  {alert.status}
                </span>

                {/* Honest Simulated Badge */}
                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-700 text-cyan-400 font-hud">
                  Simulated Event
                </span>

                <span className="text-slate-400 text-[11px]">·</span>
                <span className="text-slate-400 text-[11px]">{alert.timestamp}</span>
              </div>

              <div>
                <h4 className="font-heading font-semibold text-sm text-slate-100">{alert.conditionTitle}</h4>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{alert.description}</p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-[11px] font-hud text-slate-400">
                <span>Location: <strong className="text-slate-300 font-normal">{alert.location}</strong></span>
                <span>Source: <strong className="text-slate-300 font-normal">{alert.source}</strong></span>
                {alert.metricValue && (
                  <span>Telemetry: <strong className="text-cyan-400 font-normal">{alert.metricValue}</strong></span>
                )}
              </div>

              {alert.operatorNotes && (
                <div className="text-[11px] font-hud text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800 flex items-start gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span><strong>Operator Notes:</strong> {alert.operatorNotes}</span>
                </div>
              )}
            </div>

            {/* Right Action Buttons */}
            <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
              {alert.status === 'new' && (
                <button
                  onClick={() => {
                    setSelectedAlertForDetail(alert);
                    setOperatorNotesInput('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-700 text-xs font-semibold transition-colors"
                >
                  Acknowledge...
                </button>
              )}

              {alert.status !== 'resolved' && (
                <button
                  onClick={() => resolveAlert(alert.id)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Resolve</span>
                </button>
              )}

              <button
                onClick={() => setSelectedAlertForDetail(alert)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs transition-colors"
              >
                Inspect
              </button>
            </div>
          </div>
        ))}

        {filteredAlerts.length === 0 && (
          <div className="bg-[#0b1221] border border-slate-800 rounded-xl p-12 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <div className="font-heading font-semibold text-slate-200">No Incidents Matching Filter</div>
            <p className="text-xs text-slate-400">
              All monitored conditions and optical zones are operating within calibrated safety limits.
            </p>
          </div>
        )}
      </div>

      {/* Operator Acknowledge & Detail Inspection Modal */}
      {selectedAlertForDetail && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1221] border border-cyan-500/30 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <span className={`px-2 py-0.5 rounded uppercase text-[10px] font-hud ${getSeverityBadge(selectedAlertForDetail.severity)}`}>
                  {selectedAlertForDetail.severity} INCIDENT
                </span>
                <h3 className="font-heading font-bold text-lg text-slate-100 mt-1">
                  {selectedAlertForDetail.conditionTitle}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAlertForDetail(null)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-hud space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">INCIDENT ID:</span>
                <span className="text-slate-200">{selectedAlertForDetail.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">TIMESTAMP:</span>
                <span className="text-slate-200">{selectedAlertForDetail.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">LOCATION:</span>
                <span className="text-slate-200">{selectedAlertForDetail.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">SOURCE SENSOR:</span>
                <span className="text-cyan-400">{selectedAlertForDetail.source}</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {selectedAlertForDetail.description}
            </p>

            {/* Operator Notes Input */}
            <div>
              <label className="block text-xs font-hud text-slate-400 mb-1">
                OPERATOR AUDIT NOTES (DISPATCH / ACTION LOG)
              </label>
              <textarea
                value={operatorNotesInput}
                onChange={(e) => setOperatorNotesInput(e.target.value)}
                placeholder="e.g. Guard dispatched to Sector 4. Visual contact established..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-400 resize-none h-20 font-sans"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedAlertForDetail(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-slate-300 text-xs font-semibold hover:bg-slate-800"
              >
                Close
              </button>

              <button
                onClick={() => {
                  acknowledgeAlert(selectedAlertForDetail.id, operatorNotesInput);
                  setSelectedAlertForDetail(null);
                }}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-semibold transition-colors"
              >
                Save & Acknowledge
              </button>

              <button
                onClick={() => {
                  resolveAlert(selectedAlertForDetail.id);
                  setSelectedAlertForDetail(null);
                }}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-semibold transition-colors"
              >
                Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
