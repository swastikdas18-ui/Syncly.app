import React, { useState, useEffect } from 'react';
import { 
  Users, 
  X, 
  Check, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Building2, 
  RefreshCw,
  Mail,
  MessageSquareQuote,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { Tenant } from '../types.ts';
import { api } from '../lib/api.ts';

interface JoinRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTenant: Tenant;
  onRequestReviewed?: () => void;
}

export const JoinRequestsModal: React.FC<JoinRequestsModalProps> = ({
  isOpen,
  onClose,
  activeTenant,
  onRequestReviewed,
}) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const loadRequests = async () => {
    if (!activeTenant?.id) return;
    setIsLoading(true);
    const res = await api.getCommunityRequests(activeTenant.id);
    setRequests(res.data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadRequests();
    }
  }, [isOpen, activeTenant?.id]);

  if (!isOpen) return null;

  const handleReview = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessingId(requestId);
    const res = await api.reviewCommunityRequest(activeTenant.id, requestId, action);
    setProcessingId(null);
    if (res.success) {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' }
            : r
        )
      );
      onRequestReviewed?.();
    } else {
      alert(res.message || 'Failed to process request');
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (filter === 'pending') return r.status === 'pending';
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  Membership Join Queue
                </h2>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    {pendingCount} Pending
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{activeTenant.name}</span>
                <span>·</span>
                <span>Admin Review Console</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadRequests}
              disabled={isLoading}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
              title="Refresh requests"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-2.5 bg-white border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilter('pending')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                filter === 'pending'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Requests ({requests.length})
            </button>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Approving grants employee role and channel access
          </span>
        </div>

        {/* List of Requests */}
        <div className="p-5 sm:p-6 max-h-[calc(80vh-140px)] overflow-y-auto divide-y divide-slate-100">
          {isLoading && requests.length === 0 ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs">Loading pending membership requests...</span>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {filter === 'pending' ? 'No Pending Join Requests' : 'No Join Requests Found'}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  {filter === 'pending'
                    ? 'All applicant requests for this workspace have been reviewed. New domain matches or external access requests will appear here.'
                    : 'No requests have been submitted to this community yet.'}
                </p>
              </div>
            </div>
          ) : (
            filteredRequests.map((req) => {
              const isProcessing = processingId === req.id;
              const isPending = req.status === 'pending';
              const reqDomain = req.userEmail.includes('@') ? req.userEmail.split('@')[1] : '';

              return (
                <div key={req.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <img
                      src={req.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(req.userEmail)}`}
                      alt={req.userName}
                      className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 leading-tight">
                          {req.userName}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200">
                          @{reqDomain}
                        </span>
                        {req.status === 'approved' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Approved
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                            <X className="w-3 h-3" /> Rejected
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{req.userEmail}</span>
                      </div>

                      {req.message && (
                        <div className="flex items-start gap-1.5 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200/60 mt-1">
                          <MessageSquareQuote className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="italic leading-relaxed">{req.message}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1 text-[11px] text-slate-400 pt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>Submitted {new Date(req.createdAt).toLocaleDateString()} at {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {isPending && (
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-2 sm:pt-0">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleReview(req.id, 'reject')}
                        className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Decline</span>
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleReview(req.id, 'approve')}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs hover:shadow transition-all flex items-center gap-1"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        )}
                        <span>Approve Access</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Postgres RLS Policy: Only workspace owners and admins can review join requests</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
