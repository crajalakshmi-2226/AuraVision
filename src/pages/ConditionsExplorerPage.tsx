import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Dog,
  Flame,
  Home,
  Layers,
  Microscope,
  Radio,
  Search,
  Server,
  Shield,
  Sliders,
  Wind,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ConditionId, MonitoringCondition } from '../types';

export const ConditionsExplorerPage: React.FC = () => {
  const { conditions, setSelectedConditionId, setActiveNav } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    'all',
    'Commercial & Campus',
    'Restricted Facilities',
    'Residential & Perimeter',
    'Hazard & Safety',
  ];

  const getConditionIcon = (id: ConditionId) => {
    switch (id) {
      case 'c1_library_occupancy':
        return BookOpen;
      case 'c2_server_room_presence':
        return Server;
      case 'c3_lab_animal_detection':
        return Microscope;
      case 'c4_lift_entrapment':
        return Radio;
      case 'c5_campus_holiday_entry':
        return Calendar;
      case 'c6_home_intrusion':
        return Home;
      case 'c7_compound_animal_intrusion':
        return Dog;
      case 'c8_home_gas_leak':
        return Wind;
      case 'c9_chemical_lab_gas':
        return Shield;
      case 'c10_device_thermal_fire':
        return Flame;
      default:
        return Activity;
    }
  };

  const filteredConditions = conditions.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.shortDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || c.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleOpenDetail = (id: ConditionId) => {
    setSelectedConditionId(id);
    setActiveNav('condition-detail');
  };

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-cyan-400" />
            Ten Safety Condition Modules
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configurable surveillance rules, occupancy limits, environmental sensors, and hazard protection
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search conditions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            {cat === 'all' ? 'All Conditions (10)' : cat}
          </button>
        ))}
      </div>

      {/* Grid of 10 Condition Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredConditions.map((cond, index) => {
          const Icon = getConditionIcon(cond.id);
          const isAlert = cond.activeAlertCount > 0;

          return (
            <div
              key={cond.id}
              onClick={() => handleOpenDetail(cond.id)}
              className={`p-5 rounded-xl border bg-[#0b1221] hover:border-cyan-500/50 cursor-pointer transition-all hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] flex flex-col justify-between group ${
                isAlert ? 'border-amber-500/40' : 'border-slate-800'
              }`}
            >
              <div>
                {/* Card Top Strip */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                        isAlert
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-600/50'
                          : 'bg-slate-900 text-cyan-400 border border-slate-800 group-hover:border-cyan-500/30'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-hud text-slate-400 uppercase tracking-wider">
                        Condition 0{index + 1} · {cond.category}
                      </div>
                      <h3 className="font-heading font-bold text-sm text-slate-100 group-hover:text-cyan-300 transition-colors">
                        {cond.title}
                      </h3>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <span
                    className={`text-[10px] font-hud uppercase px-2 py-0.5 rounded ${
                      isAlert
                        ? 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                        : cond.status === 'active'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {isAlert ? 'ALERT ACTIVE' : cond.status.toUpperCase()}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                  {cond.shortDescription}
                </p>
              </div>

              {/* Telemetry Strip & Threshold */}
              <div className="space-y-3 pt-3 border-t border-slate-800/80 text-xs font-hud">
                <div className="flex items-center justify-between text-slate-400">
                  <span>{cond.thresholdLabel}:</span>
                  <span className="text-slate-200 font-semibold">
                    {cond.thresholdValue} {cond.thresholdUnit || ''}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-400">
                  <span>CURRENT TELEMETRY:</span>
                  <span className="text-cyan-300 font-medium">
                    {cond.currentReading || 'Normal telemetry'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 group-hover:text-cyan-400 transition-colors">
                  <span>Open Configuration & History</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
