'use client';

import React, { useState, useEffect } from 'react';
import { useTenant } from '@/lib/context/AuthContext.tsx';
import { useWorkspace } from '@/lib/context/WorkspaceContext.tsx';
import { 
  Users, 
  Search, 
  ShieldCheck, 
  Mail, 
  Building2, 
  Sparkles,
  UserCheck
} from 'lucide-react';

interface MemberItem {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: 'active' | 'invited';
}

export default function MembersPage() {
  const { activeTenant } = useTenant();
  const { activeCommunity } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const tenantName = activeTenant?.name || activeCommunity?.name || 'Acme Corporation';

  // Canonical workspace team members
  const members: MemberItem[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Elena Rostova',
      email: 'elena.rostova@acmecorp.com',
      role: 'Owner / Admin',
      department: 'Executive Leadership',
      status: 'active',
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Marcus Vance',
      email: 'marcus.vance@acmecorp.com',
      role: 'Manager',
      department: 'Product Operations',
      status: 'active',
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      name: 'Devon Thorne',
      email: 'devon.thorne@globextech.com',
      role: 'Admin',
      department: 'Autonomous Engineering',
      status: 'active',
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      name: 'Maya Lin',
      email: 'maya.lin@globextech.com',
      role: 'Member',
      department: 'Robotics Software',
      status: 'active',
    },
  ];

  const getRoleBadgeStyle = (role: string) => {
    const r = role.toLowerCase();
    if (r.includes('owner')) return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
    if (r.includes('admin')) return 'bg-purple-500/10 text-purple-300 border-purple-500/30';
    if (r.includes('manager')) return 'bg-blue-500/10 text-blue-300 border-blue-500/30';
    return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole =
      roleFilter === 'all' ||
      m.role.toLowerCase().includes(roleFilter.toLowerCase());
    return matchesSearch && matchesRole;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>Workspace Directory</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Team Members
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Active verified colleagues within <span className="text-slate-200 font-medium">{tenantName}</span>
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, corporate email, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 p-1 rounded-xl shrink-0 overflow-x-auto">
          {['all', 'admin', 'manager', 'member'].map((rf) => (
            <button
              key={rf}
              type="button"
              onClick={() => setRoleFilter(rf)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${
                roleFilter === rf
                  ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {rf}
            </button>
          ))}
        </div>
      </div>

      {/* Member Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredMembers.map((member) => (
          <div
            key={member.id}
            className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700/80 transition-all flex items-start gap-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
              {member.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-100 truncate">
                  {member.name}
                </h3>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${getRoleBadgeStyle(member.role)}`}>
                  {member.role}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1 truncate">
                <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">{member.email}</span>
              </p>
              <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                <span>{member.department}</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
