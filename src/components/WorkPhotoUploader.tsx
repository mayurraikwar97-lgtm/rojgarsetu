import React, { useRef, useState } from 'react';
import { AlertCircle, Camera, ImagePlus, RefreshCw, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { MAX_WORK_PHOTOS, uploadCustomerWorkPhoto } from '../lib/workPhotoService';
import type { Language } from '../types/domain';

function tr(lang: Language, en: string, hi: string, mr: string): string {
  return lang === 'hi' ? hi : lang === 'mr' ? mr : en;
}

interface WorkPhotoUploaderProps {
  photos: string[];
  onChange: (nextPhotos: string[]) => void;
  ownerUid: string;
  folder?: 'work' | 'goods';
  disabled?: boolean;
  onUploadingChange?: (isUploading: boolean) => void;
}

export const WorkPhotoUploader: React.FC<WorkPhotoUploaderProps> = ({
  photos,
  onChange,
  ownerUid,
  folder = 'work',
  disabled = false,
  onUploadingChange,
}) => {
  const { lang } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  const setBusy = (next: boolean) => {
    setUploading(next);
    onUploadingChange?.(next);
  };

  const handleAddFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMsg('');
    const remaining = Math.max(0, MAX_WORK_PHOTOS - photos.length);
    if (remaining === 0) {
      setErrorMsg(
        tr(
          lang,
          `Maximum ${MAX_WORK_PHOTOS} photos allowed. Remove or replace a photo to add another.`,
          `अधिकतम ${MAX_WORK_PHOTOS} फोटो अपलोड किए जा सकते हैं। नया जोड़ने के लिए कोई फोटो हटाएं या बदलें।`,
          `कमाल ${MAX_WORK_PHOTOS} फोटो अपलोड करता येतात. नवीन जोडण्यासाठी एखादा फोटो काढा किंवा बदला.`
        )
      );
      return;
    }

    const files = Array.from(fileList).slice(0, remaining);
    setBusy(true);
    setUploadProgress(5);
    const uploadedUrls: string[] = [];
    const failedMessages: string[] = [];

    try {
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        setUploadStatusText(
          tr(
            lang,
            `Uploading photo ${i + 1} of ${files.length}...`,
            `फोटो ${i + 1} / ${files.length} अपलोड हो रहा है...`,
            `फोटो ${i + 1} / ${files.length} अपलोड होत आहे...`
          )
        );
        try {
          const uploaded = await uploadCustomerWorkPhoto({
            file,
            ownerUid: ownerUid || 'customer',
            folder,
            onProgress: (filePct) => {
              const overall = Math.round(((i + filePct / 100) / files.length) * 100);
              setUploadProgress(overall);
            },
          });
          uploadedUrls.push(uploaded.url);
        } catch (err) {
          failedMessages.push(err instanceof Error ? err.message : 'Photo upload failed.');
        }
      }

      if (uploadedUrls.length > 0) {
        onChange([...photos, ...uploadedUrls].slice(0, MAX_WORK_PHOTOS));
      }
      if (failedMessages.length > 0) {
        setErrorMsg(failedMessages[0]);
      }
    } finally {
      setBusy(false);
      setUploadProgress(0);
      setUploadStatusText('');
    }
  };

  const handleReplaceFile = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || replaceIndex === null) return;
    const targetIdx = replaceIndex;
    setReplaceIndex(null);
    setErrorMsg('');
    setBusy(true);
    setUploadProgress(10);
    setUploadStatusText(
      tr(lang, 'Replacing photo...', 'फोटो बदला जा रहा है...', 'फोटो बदलत आहे...')
    );

    try {
      const uploaded = await uploadCustomerWorkPhoto({
        file: fileList[0],
        ownerUid: ownerUid || 'customer',
        folder,
        onProgress: (pct) => setUploadProgress(pct),
      });
      const updated = [...photos];
      updated[targetIdx] = uploaded.url;
      onChange(updated);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to replace photo. Please try again.');
    } finally {
      setBusy(false);
      setUploadProgress(0);
      setUploadStatusText('');
    }
  };

  const handleRemove = (index: number) => {
    setErrorMsg('');
    onChange(photos.filter((_, i) => i !== index));
  };

  const triggerReplace = (index: number) => {
    setReplaceIndex(index);
    replaceInputRef.current?.click();
  };

  const isLimitReached = photos.length >= MAX_WORK_PHOTOS;

  return (
    <div className="rounded-lg border-2 border-dashed border-[#0B3B75]/35 bg-blue-50/40 p-3.5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-[#0B3B75] flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-[#E06D1B]" />
            <span>
              {tr(
                lang,
                'UPLOAD WORK PHOTOS',
                'काम के फोटो अपलोड करें (UPLOAD WORK PHOTOS)',
                'कामाचे फोटो अपलोड करा (UPLOAD WORK PHOTOS)'
              )}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 mt-0.5">
            {tr(
              lang,
              'Optional — upload photos of the work site or item so workers can give an accurate offer. You can also submit without photos.',
              'वैकल्पिक — काम की जगह या सामान की फोटो जोड़ें ताकि कारीगर सही दर बता सकें। बिना फोटो के भी अनुरोध भेज सकते हैं।',
              'ऐच्छिक — कामाच्या जागेचे किंवा वस्तूचे फोटो जोडा म्हणजे कामगार अचूक दर देऊ शकतील. फोटोशिवायही विनंती पाठवता येते.'
            )}
          </p>
        </div>
        <span className="px-2 py-0.5 rounded bg-white border border-slate-300 font-mono-tabular text-[11px] font-bold text-[#0B3B75]">
          {photos.length} / {MAX_WORK_PHOTOS}
        </span>
      </div>

      {/* Hidden inputs: Gallery (multiple), Camera (rear), Replace (single) */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        disabled={disabled || uploading || isLimitReached}
        onChange={(e) => {
          void handleAddFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled || uploading || isLimitReached}
        onChange={(e) => {
          void handleAddFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        disabled={disabled || uploading}
        onChange={(e) => {
          void handleReplaceFile(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Action Buttons: Gallery + Camera */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || uploading || isLimitReached}
          onClick={() => galleryInputRef.current?.click()}
          className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-[#0B3B75] bg-white text-[#0B3B75] text-xs font-bold hover:bg-blue-50 disabled:opacity-50 cursor-pointer"
        >
          <ImagePlus className="w-4 h-4 text-[#E06D1B]" />
          <span>
            {tr(
              lang,
              'Select Photos (Gallery)',
              'गैलरी से फोटो चुनें',
              'गॅलरीतून फोटो निवडा'
            )}
          </span>
        </button>

        <button
          type="button"
          disabled={disabled || uploading || isLimitReached}
          onClick={() => cameraInputRef.current?.click()}
          className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#0B3B75] text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
        >
          <Camera className="w-4 h-4 text-amber-300" />
          <span>
            {tr(
              lang,
              'Take Photo (Camera)',
              'कैमरे से फोटो लें',
              'कॅमेऱ्याने फोटो काढा'
            )}
          </span>
        </button>
      </div>

      {/* Upload Progress Indicator */}
      {uploading && (
        <div className="bg-white border border-blue-200 rounded-md p-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#0B3B75]">
            <span>{uploadStatusText || tr(lang, 'Uploading photo...', 'अपलोड हो रहा है...', 'अपलोड होत आहे...')}</span>
            <span className="font-mono-tabular">{uploadProgress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-[#15803D] transition-all duration-200"
              style={{ width: `${Math.max(8, uploadProgress)}%` }}
            />
          </div>
        </div>
      )}

      {/* Clear Error Message */}
      {errorMsg && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Photo Preview Grid with Remove & Replace */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-1">
          {photos.map((url, idx) => (
            <div
              key={`work-upload-thumb-${idx}`}
              className="rounded-md border border-slate-300 bg-white overflow-hidden shadow-xs flex flex-col"
            >
              <button
                type="button"
                onClick={() => setPreviewUrl(url)}
                className="relative w-full aspect-square bg-slate-100 overflow-hidden cursor-pointer"
                title={tr(lang, 'Tap to preview photo', 'बड़ा देखने हेतु टैप करें', 'मोठा पाहण्यासाठी टॅप करा')}
              >
                <img
                  src={url}
                  alt={`Uploaded work photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-slate-900/75 text-white text-[10px] font-mono-tabular font-bold">
                  #{idx + 1}
                </span>
              </button>
              <div className="grid grid-cols-2 divide-x divide-slate-200 border-t border-slate-200 text-[10px] font-bold">
                <button
                  type="button"
                  disabled={disabled || uploading}
                  onClick={() => triggerReplace(idx)}
                  className="py-1.5 inline-flex items-center justify-center gap-0.5 text-[#0B3B75] hover:bg-blue-50 disabled:opacity-50 cursor-pointer"
                  title={tr(lang, 'Replace photo', 'फोटो बदलें', 'फोटो बदला')}
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>{tr(lang, 'Replace', 'बदलें', 'बदला')}</span>
                </button>
                <button
                  type="button"
                  disabled={disabled || uploading}
                  onClick={() => handleRemove(idx)}
                  className="py-1.5 inline-flex items-center justify-center gap-0.5 text-red-700 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                  title={tr(lang, 'Remove photo', 'फोटो हटाएं', 'फोटो काढा')}
                >
                  <X className="w-3 h-3" />
                  <span>{tr(lang, 'Remove', 'हटाएं', 'काढा')}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen Lightbox Preview */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="relative max-w-3xl max-h-[88vh] bg-white rounded-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              className="absolute top-2.5 right-2.5 z-10 w-9 h-9 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-slate-900 cursor-pointer"
              aria-label="Close photo preview"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewUrl}
              alt="Work photo preview"
              className="max-w-full max-h-[85vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};
