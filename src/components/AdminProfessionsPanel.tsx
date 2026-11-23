import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Clock,
  Edit3,
  Image as ImageIcon,
  Loader2,
  PlusCircle,
  Search,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  SUGGESTED_DYNAMIC_PROFESSIONS,
  adminApproveOrEditCustomProfession,
  adminCreateDynamicProfession,
  adminDeleteCustomProfession,
  adminRejectCustomProfession,
  findDuplicateProfession,
  subscribeAllProfessionsAdmin,
} from '../lib/customProfessionService';
import type { CustomProfessionGroup, CustomProfessionRecord } from '../types/domain';

const GROUP_OPTIONS: Array<{ value: CustomProfessionGroup; label: string }> = [
  { value: 'trades', label: 'Trades & Technical' },
  { value: 'industrial', label: 'Industrial & Equipment' },
  { value: 'services', label: 'Local & Personal Services' },
  { value: 'enterprise', label: 'Creative & Self-Employed' },
  { value: 'hospitality', label: 'Events & Hospitality' },
  { value: 'office', label: 'Digital, Media & Office' },
  { value: 'agriculture', label: 'Agriculture & Rural' },
  { value: 'transport', label: 'Transport & Logistics' },
];

export const AdminProfessionsPanel: React.FC = () => {
  const { user } = useAuth();
  const [professions, setProfessions] = useState<CustomProfessionRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add new dynamic profession form
  const [newNameEn, setNewNameEn] = useState('');
  const [newNameHi, setNewNameHi] = useState('');
  const [newNameMr, setNewNameMr] = useState('');
  const [newGroup, setNewGroup] = useState<CustomProfessionGroup>('services');
  const [newKeywordsInput, setNewKeywordsInput] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Inline review / edit drawer
  const [editingProf, setEditingProf] = useState<CustomProfessionRecord | null>(null);
  const [editNameEn, setEditNameEn] = useState('');
  const [editNameHi, setEditNameHi] = useState('');
  const [editNameMr, setEditNameMr] = useState('');
  const [editGroup, setEditGroup] = useState<CustomProfessionGroup>('services');
  const [editKeywordsInput, setEditKeywordsInput] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const [rejectingId, setRejectingId] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const [busyId, setBusyId] = useState('');
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    return subscribeAllProfessionsAdmin(setProfessions);
  }, []);

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const p of professions) {
      if (p.status === 'pending') pending += 1;
      else if (p.status === 'approved') approved += 1;
      else if (p.status === 'rejected') rejected += 1;
    }
    return { pending, approved, rejected, total: professions.length };
  }, [professions]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return professions.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.nameEn.toLowerCase().includes(q) ||
        (p.nameHi || '').toLowerCase().includes(q) ||
        (p.nameMr || '').toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        (p.submittedByWorkerName || '').toLowerCase().includes(q) ||
        (p.keywords || []).some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [professions, statusFilter, searchQuery]);

  const liveCreateDup = useMemo(() => {
    if (newNameEn.trim().length < 2) return null;
    return findDuplicateProfession({
      inputName: newNameEn,
      existingCustomProfessions: professions,
    });
  }, [newNameEn, professions]);

  const openEditor = (p: CustomProfessionRecord) => {
    setEditingProf(p);
    setEditNameEn(p.nameEn);
    setEditNameHi(p.nameHi || '');
    setEditNameMr(p.nameMr || '');
    setEditGroup(p.group || 'services');
    setEditKeywordsInput((p.keywords || []).join(', '));
    setEditDescription(p.description || '');
    setEditNotes(p.adminNotes || '');
    setRejectingId('');
    setErrorMsg('');
    setFeedback('');
  };

  const handleCreateDynamicProfession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    setErrorMsg('');
    setFeedback('');
    setCreating(true);
    try {
      const keywords = newKeywordsInput
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      await adminCreateDynamicProfession({
        nameEn: newNameEn,
        nameHi: newNameHi,
        nameMr: newNameMr,
        description: newDescription,
        group: newGroup,
        keywords,
        adminUid: user.uid,
        adminEmail: user.email,
        allExistingProfessions: professions,
      });
      setFeedback(
        `Published new dynamic profession "${newNameEn.trim()}"! It is now immediately live in Worker Registration, Customer Search, Location Matching, and Advertisement Targeting.`
      );
      setNewNameEn('');
      setNewNameHi('');
      setNewNameMr('');
      setNewKeywordsInput('');
      setNewDescription('');
      setNewGroup('services');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to add profession.');
    } finally {
      setCreating(false);
    }
  };

  const handleApproveSave = async () => {
    if (!user?.email || !editingProf) return;
    setBusyId(editingProf.id);
    setErrorMsg('');
    setFeedback('');
    try {
      const keywords = editKeywordsInput
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      const res = await adminApproveOrEditCustomProfession({
        profession: editingProf,
        nameEn: editNameEn,
        nameHi: editNameHi,
        nameMr: editNameMr,
        description: editDescription,
        group: editGroup,
        keywords,
        adminNotes: editNotes,
        adminUid: user.uid,
        adminEmail: user.email,
        allExistingProfessions: professions,
      });
      setFeedback(
        `Approved & published "${editNameEn.trim()}"! Synced ${res.syncedWorkers} worker profile(s) and enabled Customer Search, Location Matching & Ad Targeting.`
      );
      setEditingProf(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to approve profession.');
    } finally {
      setBusyId('');
    }
  };

  const handleConfirmReject = async (p: CustomProfessionRecord) => {
    if (!user?.email) return;
    setBusyId(p.id);
    setErrorMsg('');
    setFeedback('');
    try {
      await adminRejectCustomProfession({
        profession: p,
        reason: rejectReason.trim() || 'Duplicate or invalid profession entry.',
        adminUid: user.uid,
        adminEmail: user.email,
      });
      setFeedback(`Rejected custom profession "${p.nameEn}". It will NOT be published as a public category.`);
      setRejectingId('');
      setRejectReason('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to reject profession.');
    } finally {
      setBusyId('');
    }
  };

  const handleDelete = async (p: CustomProfessionRecord) => {
    if (!user?.email) return;
    setBusyId(p.id);
    setErrorMsg('');
    setFeedback('');
    try {
      await adminDeleteCustomProfession({
        profession: p,
        adminUid: user.uid,
        adminEmail: user.email,
      });
      setFeedback(`Removed profession "${p.nameEn}" from dynamic catalog.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to delete profession.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-[#C25E00]">
            A-to-Z Inclusive Dynamic Profession Engine
          </p>
          <h2 className="font-display text-lg font-extrabold text-[#0B3B75]">
            Custom Professions &amp; Dynamic Job Categories
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Review worker-submitted custom skills or publish new professions directly without changing code. Unverified professions are never publicly listed until approved.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-mono-tabular">
          <span className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[#C25E00] font-bold">
            Pending Review: {counts.pending}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[#15803D] font-bold">
            Approved Live: {counts.approved}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-bold">
            Rejected: {counts.rejected}
          </span>
        </div>
      </div>

      {feedback && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-3.5 text-xs font-semibold text-[#15803D] flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{feedback}</span>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl bg-red-50 border border-red-300 p-3.5 text-xs font-semibold text-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ADD NEW DYNAMIC PROFESSION (NO CODE CHANGES) */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-[#15803D]" />
            <h3 className="font-display text-base font-extrabold text-[#0B3B75]">
              Add New Dynamic Profession (Instant Publish — Zero Code Changes)
            </h3>
          </div>
        </div>

        {/* One-Click Quick-Fill Suggestion Chips */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#E06D1B]" />
            Quick-Fill Popular Inclusive Professions:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_DYNAMIC_PROFESSIONS.map((tpl) => {
              const alreadyExists = Boolean(
                findDuplicateProfession({
                  inputName: tpl.nameEn,
                  existingCustomProfessions: professions,
                })
              );
              return (
                <button
                  key={tpl.nameEn}
                  type="button"
                  disabled={alreadyExists}
                  onClick={() => {
                    setNewNameEn(tpl.nameEn);
                    setNewNameHi(tpl.nameHi);
                    setNewNameMr(tpl.nameMr);
                    setNewGroup(tpl.group);
                    setNewKeywordsInput(tpl.keywords.join(', '));
                    setNewDescription(tpl.description);
                    setErrorMsg('');
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors ${
                    alreadyExists
                      ? 'bg-emerald-50 border-emerald-200 text-[#15803D] opacity-70 cursor-default'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-300 hover:text-[#0B3B75] cursor-pointer'
                  }`}
                >
                  {alreadyExists ? `✓ ${tpl.nameEn}` : `+ ${tpl.nameEn}`}
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleCreateDynamicProfession} className="space-y-3 pt-2 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Profession Name (English) *
              </label>
              <input
                type="text"
                required
                value={newNameEn}
                onChange={(e) => setNewNameEn(e.target.value)}
                placeholder="e.g., CCTV Installer"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Hindi Label (हिंदी — optional)
              </label>
              <input
                type="text"
                value={newNameHi}
                onChange={(e) => setNewNameHi(e.target.value)}
                placeholder="उदा. सीसीटीवी इंस्टॉलर"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Marathi Label (मराठी — optional)
              </label>
              <input
                type="text"
                value={newNameMr}
                onChange={(e) => setNewNameMr(e.target.value)}
                placeholder="उदा. सीसीटीव्ही इंस्टॉलर"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          {liveCreateDup && (
            <div className="rounded-lg bg-amber-50 border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-900">
              Duplicate prevented: &ldquo;{liveCreateDup.existingName}&rdquo; already exists (
              {liveCreateDup.source.replace(/_/g, ' ')}).
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Category Group</label>
              <select
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value as CustomProfessionGroup)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
              >
                {GROUP_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Searchable Keywords (comma-separated)
              </label>
              <input
                type="text"
                value={newKeywordsInput}
                onChange={(e) => setNewKeywordsInput(e.target.value)}
                placeholder="e.g., Security Camera, DVR Setup, Wiring, Surveillance"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Short Work Description (optional)
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Briefly describe the services under this profession..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={creating || Boolean(liveCreateDup) || newNameEn.trim().length < 2}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#15803D] hover:bg-[#116830] disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
            Publish New Profession Category
          </button>
        </form>
      </section>

      {/* SUBMISSIONS & APPROVED CATALOG */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(
              [
                { id: 'all', label: `All (${counts.total})` },
                { id: 'pending', label: `Pending (${counts.pending})` },
                { id: 'approved', label: `Approved (${counts.approved})` },
                { id: 'rejected', label: `Rejected (${counts.rejected})` },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-md font-bold cursor-pointer ${
                  statusFilter === f.id
                    ? 'bg-[#0B3B75] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search profession or worker..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            <Briefcase className="w-7 h-7 text-slate-300 mx-auto mb-2" />
            No custom professions found in this filter yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((p) => {
              const isEditing = editingProf?.id === p.id;
              const isRejecting = rejectingId === p.id;
              return (
                <div key={p.id} className="py-4 space-y-3 text-xs">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-extrabold text-[#0B3B75]">
                          {p.nameEn}
                        </span>
                        {p.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-[#9A3412] border border-amber-300 text-[10px] font-extrabold uppercase">
                            <Clock className="w-3 h-3" /> Pending Approval
                          </span>
                        )}
                        {p.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-[#15803D] border border-emerald-300 text-[10px] font-extrabold uppercase">
                            <CheckCircle2 className="w-3 h-3" /> Approved &amp; Searchable
                          </span>
                        )}
                        {p.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-300 text-[10px] font-extrabold uppercase">
                            <XCircle className="w-3 h-3" /> Rejected
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono-tabular text-[10px]">
                          slug: {p.slug}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-[#0B3B75] text-[10px] font-semibold">
                          {p.source === 'worker_submission' ? 'Worker Submitted' : 'Admin Created'}
                        </span>
                      </div>

                      {(p.nameHi || p.nameMr) && (
                        <div className="text-slate-600">
                          {p.nameMr ? `मराठी: ${p.nameMr}` : ''}
                          {p.nameMr && p.nameHi ? ' · ' : ''}
                          {p.nameHi ? `हिंदी: ${p.nameHi}` : ''}
                        </div>
                      )}

                      {p.description && <p className="text-slate-700 leading-relaxed">{p.description}</p>}

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                        {p.submittedByWorkerName && (
                          <span>
                            Submitted by: <strong>{p.submittedByWorkerName}</strong>
                            {p.submittedByWorkerRegistrationId ? ` (${p.submittedByWorkerRegistrationId})` : ''}
                          </span>
                        )}
                        {p.submittedLocation && <span>Location: {p.submittedLocation}</span>}
                        {typeof p.experienceYears === 'number' && <span>Exp: {p.experienceYears} yrs</span>}
                        {typeof p.expectedWage === 'number' && p.expectedWage > 0 && (
                          <span className="font-mono-tabular">
                            Expected: ₹{p.expectedWage.toLocaleString('en-IN')} / {p.wageUnit || 'daily'}
                          </span>
                        )}
                      </div>

                      {p.keywords && p.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {p.keywords.map((kw) => (
                            <span
                              key={kw}
                              className="px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-[10px] text-slate-700"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}

                      {p.sampleWorkPhotoUrls && p.sampleWorkPhotoUrls.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                            <ImageIcon className="w-3.5 h-3.5" /> Work Photos:
                          </span>
                          {p.sampleWorkPhotoUrls.map((url, idx) => (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="block w-12 h-12 rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-[#0B3B75]"
                            >
                              <img src={url} alt={`Work sample ${idx + 1}`} className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}

                      {p.adminNotes && (
                        <div className="text-[11px] text-amber-800 font-semibold">Admin Note: {p.adminNotes}</div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => openEditor(p)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#15803D] hover:bg-[#116830] text-white font-bold cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        {p.status === 'approved' ? 'Edit Category' : 'Review & Approve'}
                      </button>
                      {p.status !== 'rejected' && (
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => {
                            setRejectingId(p.id);
                            setRejectReason('');
                            setEditingProf(null);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 font-bold cursor-pointer"
                        >
                          Reject
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => void handleDelete(p)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                        title="Delete profession"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Edit & Approve Drawer */}
                  {isEditing && (
                    <div className="rounded-xl bg-slate-50 border border-slate-300 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-[#0B3B75]">
                          Edit &amp; Approve &ldquo;{p.nameEn}&rdquo; as Searchable Category
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingProf(null)}
                          className="text-slate-500 hover:underline font-bold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">English Name *</label>
                          <input
                            type="text"
                            value={editNameEn}
                            onChange={(e) => setEditNameEn(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Hindi Name (हिंदी)</label>
                          <input
                            type="text"
                            value={editNameHi}
                            onChange={(e) => setEditNameHi(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Marathi Name (मराठी)</label>
                          <input
                            type="text"
                            value={editNameMr}
                            onChange={(e) => setEditNameMr(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Group</label>
                          <select
                            value={editGroup}
                            onChange={(e) => setEditGroup(e.target.value as CustomProfessionGroup)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                          >
                            {GROUP_OPTIONS.map((g) => (
                              <option key={g.value} value={g.value}>
                                {g.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Searchable Keywords (comma-separated)
                          </label>
                          <input
                            type="text"
                            value={editKeywordsInput}
                            onChange={(e) => setEditKeywordsInput(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Category work description"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                        />
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Admin review notes (optional)"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => void handleApproveSave()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#15803D] hover:bg-[#116830] text-white font-extrabold cursor-pointer"
                      >
                        {busyId === p.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Approve &amp; Publish to Search, Matching &amp; Ads
                      </button>
                    </div>
                  )}

                  {/* Inline Reject Drawer */}
                  {isRejecting && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-red-900">
                          Reject &ldquo;{p.nameEn}&rdquo; (Will NOT be published)
                        </span>
                        <button
                          type="button"
                          onClick={() => setRejectingId('')}
                          className="text-slate-600 hover:underline font-bold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection (e.g., duplicate of existing Electrician category)"
                        className="w-full px-3 py-1.5 rounded-lg border border-red-300 bg-white"
                      />
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => void handleConfirmReject(p)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white font-extrabold cursor-pointer"
                      >
                        {busyId === p.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Confirm Rejection
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
