import React, { useEffect, useState } from 'react';
import {
  fetchAcceptedCustomerPhotoData,
  fetchProfilePhotoData,
  subscribePhotoCacheUpdates,
} from '../lib/photoStorageService';

interface SecureAvatarProps {
  name: string;
  photoDocId?: string;
  acceptedGrantId?: string;
  sizeClass?: string;
  textSizeClass?: string;
  accentClass?: string;
}

function getInitials(name: string): string {
  const parts = (name || 'RS').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'RS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export const SecureAvatar: React.FC<SecureAvatarProps> = ({
  name,
  photoDocId,
  acceptedGrantId,
  sizeClass = 'w-11 h-11',
  textSizeClass = 'text-xs',
  accentClass = 'bg-[#0B3B75] text-white',
}) => {
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    return subscribePhotoCacheUpdates((updatedId) => {
      if (updatedId === photoDocId || updatedId === acceptedGrantId) {
        setRefreshTick((t) => t + 1);
      }
    });
  }, [photoDocId, acceptedGrantId]);

  useEffect(() => {
    let cancelled = false;
    if (!photoDocId && !acceptedGrantId) {
      setPhotoSrc(null);
      return;
    }

    const loader = acceptedGrantId
      ? fetchAcceptedCustomerPhotoData(acceptedGrantId)
      : fetchProfilePhotoData(photoDocId as string);

    loader.then((dataUrl) => {
      if (!cancelled) setPhotoSrc(dataUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [photoDocId, acceptedGrantId, refreshTick]);

  return (
    <div
      className={`${sizeClass} rounded-full overflow-hidden shrink-0 border border-slate-300 flex items-center justify-center font-bold ${
        photoSrc ? 'bg-slate-100' : accentClass
      }`}
    >
      {photoSrc ? (
        <img src={photoSrc} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className={textSizeClass}>{getInitials(name)}</span>
      )}
    </div>
  );
};
