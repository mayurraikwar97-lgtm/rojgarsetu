import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogIn,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import {
  addLiveCustomProfession,
  customProfessionToServiceCategoryV2,
  findDuplicateProfession,
  formatProfessionDisplayName,
  type AddLiveCustomProfessionResult,
} from '../lib/customProfessionService';
import { SERVICE_CATALOG_V2 } from '../data/serviceCatalogV2';
import { useAuth } from '../contexts/AuthContext';
import { formatUiError } from '../lib/firebase';
import type { CustomProfessionRecord, Language } from '../types/domain';
import type { User } from 'firebase/auth';

interface AddProfessionModalProps {
  open: boolean;
  onClose: () => void;
  lang: Language;
  user: User | null;
  existingProfessions: CustomProfessionRecord[];
  initialValue?: string;
  onAdded: (result: AddLiveCustomProfessionResult) => void;
}

const EXAMPLE_SKILLS = [
  'Cameraman',
  'Photographer',
  'Makeup Artist',
  'DJ Sound',
  'CCTV Technician',
  'Solar Technician',
];

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'hi' ? hi : lang === 'mr' ? mr : en;
}

export const AddProfessionModal: React.FC<AddProfessionModalProps> = ({
  open,
  onClose,
  lang,
  user,
  existingProfessions,
  initialValue = '',
  onAdded,
}) => {
  const { signInWithGoogle } = useAuth();
  const [name, setName] = useState(initialValue);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName(initialValue);
      setDescription('');
      setError('');
    }
  }, [open, initialValue]);

  const normalizedPreview = useMemo(() => formatProfessionDisplayName(name), [name]);

  const duplicateMatch = useMemo(() => {
    if (name.trim().length < 2) return null;
    return findDuplicateProfession({
      inputName: name,
      existingCustomProfessions: existingProfessions,
    });
  }, [name, existingProfessions]);

  if (!open) return null;

  const handleSignIn = async () => {
    setSigningIn(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : tr(lang, 'Google sign-in failed. Please try again.', 'गूगल लॉगिन विफल हुआ। पुनः प्रयास करें।', 'गूगल लॉगिन अयशस्वी झाले. पुन्हा प्रयत्न करा.')
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const formatted = formatProfessionDisplayName(name);
    if (formatted.length < 2) {
      setError(
        tr(
          lang,
          'Please enter a skill or profession name (at least 2 letters).',
          'कृपया कौशल या पेशे का नाम लिखें (कम से कम 2 अक्षर)।',
          'कृपया व्यवसाय किंवा कौशल्याचे नाव लिहा (किमान २ अक्षरे).'
        )
      );
      return;
    }

    // If it already exists as built-in or live custom profession, select it directly!
    if (duplicateMatch) {
      const matchedV2 =
        duplicateMatch.customRecord
          ? customProfessionToServiceCategoryV2(duplicateMatch.customRecord)
          : SERVICE_CATALOG_V2.find(
              (c) =>
                c.id === duplicateMatch.existingId ||
                c.canonicalCategory.toLowerCase() === duplicateMatch.existingName.toLowerCase() ||
                c.en.toLowerCase() === duplicateMatch.existingName.toLowerCase()
            );

      onAdded({
        professionId: duplicateMatch.existingId,
        canonicalName: duplicateMatch.existingName,
        status: duplicateMatch.source === 'custom_pending' ? 'pending' : 'approved',
        reusedExisting: true,
        categoryV2: matchedV2,
      });
      onClose();
      return;
    }

    if (!user?.uid) {
      setError(
        tr(
          lang,
          'Please sign in with Google once to add a new skill/category.',
          'नई श्रेणी जोड़ने के लिए कृपया एक बार Google से साइन-इन करें।',
          'नवीन व्यवसाय/श्रेणी जोडण्यासाठी कृपया एकदा Google ने साइन-इन करा.'
        )
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await addLiveCustomProfession({
        uid: user.uid,
        submittedByName: user.displayName || user.email || undefined,
        professionName: formatted,
        description: description.trim() || undefined,
        existingApprovedProfessions: existingProfessions,
      });
      onAdded(result);
      onClose();
    } catch (err) {
      setError(
        formatUiError(
          err,
          tr(
            lang,
            'Could not add profession right now. Please try again.',
            'अभी नया पेशा जोड़ा नहीं जा सका। कृपया पुनः प्रयास करें।',
            'सध्या नवीन व्यवसाय जोडता आला नाही. कृपया पुन्हा प्रयत्न करा.'
          ),
          lang
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/55 backdrop-blur-[2px] p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-profession-modal-title"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-[#0B3B75] to-[#124E96] px-5 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4 text-[#FDBA74]" />
            </span>
            <div className="min-w-0">
              <h3
                id="add-profession-modal-title"
                className="font-display text-base font-extrabold leading-tight truncate"
              >
                {tr(lang, 'Add New Skill / Category', 'नया काम / श्रेणी जोड़ें', 'नवीन काम / व्यवसाय जोडा')}
              </h3>
              <p className="text-[11px] text-blue-100 mt-0.5 truncate">
                {tr(
                  lang,
                  'Immediately live for customers & new workers · ₹0 extra fee',
                  'ग्राहकों व नए कामगारों के लिए तुरंत उपलब्ध · ₹0 अतिरिक्त शुल्क',
                  'ग्राहक व नवीन कामगारांसाठी लगेच उपलब्ध · ₹0 अतिरिक्त शुल्क'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr(lang, 'Close', 'बंद करें', 'बंद करा')}
            className="p-1.5 rounded-lg text-blue-100 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {!user && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <p className="text-xs font-medium text-amber-950">
                {tr(
                  lang,
                  'Sign in once with Google to publish a new service category.',
                  'नई सेवा श्रेणी जोड़ने के लिए Google से साइन-इन करें।',
                  'नवीन सेवा श्रेणी जोडण्यासाठी Google ने साइन-इन करा.'
                )}
              </p>
              <button
                type="button"
                onClick={handleSignIn}
                disabled={signingIn}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B3B75] hover:bg-[#072A54] text-white text-xs font-bold shrink-0 cursor-pointer disabled:opacity-60"
              >
                {signingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                <span>{tr(lang, 'Google Sign-In', 'Google साइन-इन', 'Google साइन-इन')}</span>
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              {tr(lang, 'Profession / Skill Name *', 'पेशा / काम का नाम *', 'व्यवसाय / कामाचे नाव *')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              maxLength={80}
              autoFocus
              placeholder={tr(
                lang,
                'e.g. Cameraman, Photographer, Makeup Artist, DJ...',
                'जैसे: Cameraman, Photographer, Makeup Artist, DJ...',
                'उदा. Cameraman, Photographer, Makeup Artist, DJ...'
              )}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3B75]/30 focus:border-[#0B3B75]"
            />

            {/* Quick suggestion chips */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLE_SKILLS.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setName(sample)}
                  className="px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 text-[11px] font-semibold text-slate-600 hover:text-[#0B3B75] cursor-pointer transition-colors"
                >
                  + {sample}
                </button>
              ))}
            </div>
          </div>

          {duplicateMatch && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 flex items-start gap-2 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">
                  {tr(lang, 'Already available:', 'पहले से उपलब्ध:', 'आधीपासून उपलब्ध:')}
                </span>{' '}
                <strong>{duplicateMatch.existingName}</strong>.{' '}
                {tr(
                  lang,
                  'Click below to select it immediately (no duplicate created).',
                  'इसे तुरंत चुनने के लिए नीचे क्लिक करें।',
                  'हे लगेच निवडण्यासाठी खाली क्लिक करा (डुप्लिकेट तयार होणार नाही).'
                )}
              </div>
            </div>
          )}

          {!duplicateMatch && normalizedPreview.length >= 2 && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2 flex items-center gap-2 text-xs text-[#0B3B75]">
              <Sparkles className="w-3.5 h-3.5 text-[#E06D1B] shrink-0" />
              <span>
                {tr(lang, 'Will be added as:', 'इस नाम से जुड़ेगा:', 'या नावाने जोडले जाईल:')}{' '}
                <strong>{normalizedPreview}</strong>
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {tr(
                lang,
                'Short Description (Optional)',
                'संक्षिप्त जानकारी (वैकल्पिक)',
                'थोडक्यात माहिती (ऐच्छिक)'
              )}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={160}
              placeholder={tr(
                lang,
                'e.g. Wedding photography, video shooting, drone shoots',
                'जैसे: शादी फोटोग्राफी, वीडियो शूटिंग, ड्रोन शूट',
                'उदा. लग्न फोटोग्राफी, व्हिडिओ शूटिंग, ड्रोन शूट'
              )}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3B75]/30 focus:border-[#0B3B75]"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 flex items-start gap-2 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              {tr(lang, 'Cancel', 'रद्द करें', 'रद्द करा')}
            </button>
            <button
              type="submit"
              disabled={submitting || name.trim().length < 2 || (!user && !duplicateMatch)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E06D1B] hover:bg-[#C65B12] text-white text-xs font-extrabold shadow-xs cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>
                {duplicateMatch
                  ? tr(lang, 'Select Existing', 'मौजूदा चुनें', 'उपलब्ध निवडा')
                  : tr(lang, 'Add & Make Live', 'जोड़ें व लाइव करें', 'जोडा व लगेच सुरू करा')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
