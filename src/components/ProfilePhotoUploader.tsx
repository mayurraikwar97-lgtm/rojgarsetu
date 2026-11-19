import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, RefreshCw, Trash2, User } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  fetchProfilePhotoData,
  processProfilePhotoFile,
  type AllowedPhotoMimeType,
} from '../lib/photoStorageService';

export interface SelectedProfilePhoto {
  photoData: string;
  mimeType: AllowedPhotoMimeType;
  sizeBytes: number;
}

interface ProfilePhotoUploaderProps {
  existingPhotoDocId?: string;
  selectedPhoto: SelectedProfilePhoto | null;
  removedExisting?: boolean;
  onSelectPhoto: (photo: SelectedProfilePhoto) => void;
  onRemovePhoto: () => void;
  roleLabel?: string;
  privacyNote?: string;
  compact?: boolean;
}

const COPY = {
  en: {
    title: 'Profile Photo (Optional)',
    hint: 'JPG, JPEG, PNG or WEBP · Maximum 5 MB',
    uploadBtn: 'Upload Photo',
    cameraBtn: 'Use Camera',
    changeBtn: 'Change',
    removeBtn: 'Remove',
    processing: 'Preparing photo...',
    errInvalidType: 'Please upload a valid JPG, JPEG, PNG, or WEBP image only.',
    errTooLarge: 'Photo exceeds the 5 MB limit. Please choose a smaller image.',
    errFailed: 'Could not read that image. Please try another photo.',
    readyBadge: 'Ready to save',
  },
  hi: {
    title: 'प्रोफ़ाइल फ़ोटो (वैकल्पिक)',
    hint: 'JPG, JPEG, PNG या WEBP · अधिकतम 5 MB',
    uploadBtn: 'फ़ोटो अपलोड करें',
    cameraBtn: 'कैमरा उपयोग करें',
    changeBtn: 'बदलें',
    removeBtn: 'हटाएँ',
    processing: 'फ़ोटो तैयार हो रही है...',
    errInvalidType: 'कृपया केवल JPG, JPEG, PNG या WEBP फ़ॉर्मेट की फ़ोटो चुनें।',
    errTooLarge: 'फ़ोटो 5 MB से अधिक है। कृपया छोटी फ़ोटो चुनें।',
    errFailed: 'फ़ोटो पढ़ने में समस्या आई। कृपया दूसरी फ़ोटो चुनें।',
    readyBadge: 'सेव के लिए तैयार',
  },
  mr: {
    title: 'प्रोफाइल फोटो (ऐच्छिक)',
    hint: 'JPG, JPEG, PNG किंवा WEBP · कमाल 5 MB',
    uploadBtn: 'फोटो अपलोड करा',
    cameraBtn: 'कॅमेरा वापरा',
    changeBtn: 'बदला',
    removeBtn: 'काढून टाका',
    processing: 'फोटो तयार होत आहे...',
    errInvalidType: 'कृपया फक्त JPG, JPEG, PNG किंवा WEBP स्वरूपातील फोटो निवडा.',
    errTooLarge: 'फोटो 5 MB पेक्षा मोठा आहे. कृपया लहान फोटो निवडा.',
    errFailed: 'फोटो वाचता आला नाही. कृपया दुसरा फोटो निवडा.',
    readyBadge: 'सेव्ह करण्यासाठी तयार',
  },
} as const;

export const ProfilePhotoUploader: React.FC<ProfilePhotoUploaderProps> = ({
  existingPhotoDocId,
  selectedPhoto,
  removedExisting = false,
  onSelectPhoto,
  onRemovePhoto,
  roleLabel,
  privacyNote,
  compact = false,
}) => {
  const { lang } = useLanguage();
  const copy = COPY[lang];

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [existingDataUrl, setExistingDataUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!existingPhotoDocId || removedExisting) {
      setExistingDataUrl(null);
      return;
    }
    fetchProfilePhotoData(existingPhotoDocId).then((url) => {
      if (!cancelled) setExistingDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [existingPhotoDocId, removedExisting]);

  const previewSrc = selectedPhoto?.photoData || (!removedExisting ? existingDataUrl : null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg('');
    setProcessing(true);
    try {
      const processed = await processProfilePhotoFile(file);
      onSelectPhoto(processed);
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'FILE_TOO_LARGE' || code === 'COMPRESSED_PHOTO_TOO_LARGE') {
        setErrorMsg(copy.errTooLarge);
      } else if (code === 'INVALID_TYPE' || code === 'INVALID_IMAGE_DATA') {
        setErrorMsg(copy.errInvalidType);
      } else {
        setErrorMsg(copy.errFailed);
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      className={`border border-slate-200 rounded-lg bg-slate-50 ${
        compact ? 'p-3' : 'p-4'
      } space-y-2.5`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold text-[#0B3B75]">
            {roleLabel || copy.title}
          </div>
          <div className="text-[11px] text-slate-600">{copy.hint}</div>
        </div>
        {selectedPhoto && (
          <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
            {copy.readyBadge}
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3.5">
        <div
          className={`${
            compact ? 'w-16 h-16' : 'w-20 h-20'
          } rounded-full border-2 border-slate-300 bg-white overflow-hidden shrink-0 flex items-center justify-center shadow-xs`}
        >
          {previewSrc ? (
            <img
              src={previewSrc}
              alt="Profile preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-8 h-8 text-slate-400" />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="user"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            disabled={processing}
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded bg-[#0B3B75] text-white text-xs font-semibold hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {previewSrc ? <RefreshCw className="w-3.5 h-3.5" /> : <ImagePlus className="w-3.5 h-3.5" />}
            <span>{previewSrc ? copy.changeBtn : copy.uploadBtn}</span>
          </button>

          <button
            type="button"
            disabled={processing}
            onClick={() => cameraInputRef.current?.click()}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <Camera className="w-3.5 h-3.5 text-[#E06D1B]" />
            <span>{copy.cameraBtn}</span>
          </button>

          {previewSrc && (
            <button
              type="button"
              disabled={processing}
              onClick={() => {
                setErrorMsg('');
                onRemovePhoto();
              }}
              className="px-3 py-1.5 rounded border border-red-200 bg-white text-red-700 text-xs font-semibold hover:bg-red-50 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{copy.removeBtn}</span>
            </button>
          )}
        </div>
      </div>

      {processing && (
        <p className="text-[11px] font-semibold text-[#0B3B75]">{copy.processing}</p>
      )}
      {errorMsg && (
        <p className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-1.5">
          {errorMsg}
        </p>
      )}
      {privacyNote && (
        <p className="text-[11px] text-slate-500">{privacyNote}</p>
      )}
    </div>
  );
};
