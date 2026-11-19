import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Star, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ProfilePhoto, VisibilityLevel } from '../../types/nearme';
import { useApp } from '../../contexts/AppContext';
import { AppShell } from '../../components/AppShell';
import {
  deleteProfilePhoto,
  getUserPhotos,
  reorderProfilePhotos,
  setMainProfilePhoto,
  updatePhotoMetadata,
  uploadProfilePhoto,
} from '../../services/profileService';

export const PhotoGalleryPage: React.FC = () => {
  const { t } = useTranslation();
  const { firebaseUser, refreshUserData } = useApp();

  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadVisibility, setUploadVisibility] = useState<VisibilityLevel>('public');
  const [error, setError] = useState('');

  const loadPhotos = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const list = await getUserPhotos(firebaseUser.uid, firebaseUser.uid);
      setPhotos(list);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;
    setError('');
    setUploadProgress(0);
    try {
      await uploadProfilePhoto({
        uid: firebaseUser.uid,
        file,
        visibility: uploadVisibility,
        onProgress: setUploadProgress,
      });
      await loadPhotos();
      await refreshUserData();
    } catch (err) {
      setError(err instanceof Error ? t(err.message, { defaultValue: err.message }) : t('errors.generic'));
    } finally {
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  const handleSetMain = async (photoId: string) => {
    if (!firebaseUser) return;
    await setMainProfilePhoto(firebaseUser.uid, photoId);
    await loadPhotos();
    await refreshUserData();
  };

  const handleVisibilityChange = async (photo: ProfilePhoto, visibility: VisibilityLevel) => {
    if (!firebaseUser) return;
    await updatePhotoMetadata(firebaseUser.uid, photo, { visibility });
    await loadPhotos();
    await refreshUserData();
  };

  const handleCropChange = async (photo: ProfilePhoto, cropY: number) => {
    if (!firebaseUser) return;
    await updatePhotoMetadata(firebaseUser.uid, photo, { cropY });
    await loadPhotos();
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    if (!firebaseUser) return;
    const nextIdx = index + direction;
    if (nextIdx < 0 || nextIdx >= photos.length) return;
    const copy = [...photos];
    const [moved] = copy.splice(index, 1);
    copy.splice(nextIdx, 0, moved);
    setPhotos(copy);
    await reorderProfilePhotos(
      firebaseUser.uid,
      copy.map((p) => p.photoId)
    );
  };

  const handleDelete = async (photo: ProfilePhoto) => {
    if (!firebaseUser) return;
    await deleteProfilePhoto(firebaseUser.uid, photo);
    await loadPhotos();
    await refreshUserData();
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">{t('photos.title')}</h1>
            <p className="text-xs text-slate-500 dark:text-[#A7AFBF] mt-1">{t('photos.subtitle')}</p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={uploadVisibility}
              onChange={(e) => setUploadVisibility(e.target.value as VisibilityLevel)}
              aria-label={t('photos.visibility')}
              className="px-3 py-2 rounded-xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 text-xs"
            >
              <option value="public">{t('contacts.visibilityPublic')}</option>
              <option value="matches">{t('contacts.visibilityMatches')}</option>
              <option value="private">{t('contacts.visibilityPrivate')}</option>
            </select>

            <label
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF5277] text-white text-xs font-semibold cursor-pointer hover:bg-[#FF5277]/90 ${
                photos.length >= 10 ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>{t('photos.uploadBtn')} ({photos.length}/10)</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={photos.length >= 10 || uploadProgress !== null}
                onChange={handleUpload}
              />
            </label>
          </div>
        </div>

        {uploadProgress !== null && (
          <div className="rounded-xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-3 space-y-1.5">
            <div className="flex justify-between text-xs tabular-nums">
              <span>{t('photos.uploadBtn')}</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-[#202737] overflow-hidden">
              <div className="h-full bg-[#FF5277]" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-[#F05265]/15 border border-[#F05265]/30 text-xs text-[#F05265]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-72 rounded-3xl bg-white dark:bg-[#171C28] animate-pulse" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <div className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 p-10 text-center text-sm text-slate-500 dark:text-[#A7AFBF]">
            {t('photos.empty')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {photos.map((photo, index) => (
              <div
                key={photo.photoId}
                className="rounded-3xl bg-white dark:bg-[#171C28] border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col"
              >
                <div className="relative aspect-[4/4] bg-[#202737]">
                  <img
                    src={photo.thumbnailUrl || photo.url}
                    alt={`Profile ${index + 1}`}
                    style={{ objectPosition: `${photo.cropX ?? 50}% ${photo.cropY ?? 50}%` }}
                    className="w-full h-full object-cover"
                  />
                  {photo.isMain && (
                    <span className="absolute top-3 start-3 px-2.5 py-1 rounded-lg bg-[#FF5277] text-white text-[11px] font-semibold">
                      {t('photos.mainBadge')}
                    </span>
                  )}
                  <span className="absolute top-3 end-3 px-2.5 py-1 rounded-lg bg-[#0D1018]/80 text-white text-[11px]">
                    {t(`photos.moderation.${photo.moderationStatus}`)}
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 dark:text-[#A7AFBF] mb-1">
                      {t('photos.visibility')}
                    </label>
                    <select
                      value={photo.visibility}
                      onChange={(e) => handleVisibilityChange(photo, e.target.value as VisibilityLevel)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#202737] border border-slate-200 dark:border-white/10 text-xs"
                    >
                      <option value="public">{t('contacts.visibilityPublic')}</option>
                      <option value="matches">{t('contacts.visibilityMatches')}</option>
                      <option value="private">{t('contacts.visibilityPrivate')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 dark:text-[#A7AFBF] mb-1">
                      {t('photos.cropPosition')} ({photo.cropY ?? 50}%)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={photo.cropY ?? 50}
                      onChange={(e) => handleCropChange(photo, Number(e.target.value))}
                      className="w-full accent-[#9B7BFF]"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                    {!photo.isMain && (
                      <button
                        type="button"
                        onClick={() => handleSetMain(photo.photoId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#202737] text-xs font-medium hover:text-[#FF5277]"
                      >
                        <Star className="w-3.5 h-3.5" />
                        <span>{t('photos.setMain')}</span>
                      </button>
                    )}

                    <div className="flex items-center gap-1 ms-auto">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMove(index, -1)}
                        aria-label={t('photos.moveUp')}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#202737] disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === photos.length - 1}
                        onClick={() => handleMove(index, 1)}
                        aria-label={t('photos.moveDown')}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#202737] disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(photo)}
                        aria-label={t('photos.delete')}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#202737] text-[#F05265]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};
