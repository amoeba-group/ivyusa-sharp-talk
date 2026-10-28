import { useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Input } from '@/components/Field';
import { StaffAvatar } from '@/components/StaffAvatar';
import { toast } from '@/store/toast-store';
import { useMyProfile, useProfileMutations } from './profile.hooks';
import { AVATAR_MAX_BYTES } from './profile.service';

/**
 * Profile icon + the name customers see (PLN-261028 W1). Both appear beside
 * this person's replies in the storefront widget and the live chat.
 */
export function ProfileEditor() {
  const { t } = useTranslation('mypage');
  const { data: profile, isLoading } = useMyProfile();
  const { updateName, uploadAvatar, removeAvatar } = useProfileMutations();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const name = nameDraft ?? profile?.displayName ?? '';
  const nameChanged = nameDraft != null && nameDraft.trim() !== (profile?.displayName ?? '');
  const busy = uploadAvatar.isPending || removeAvatar.isPending;

  const pick = (file: File | undefined) => {
    if (!file) return;
    // Same limit as the server — refuse early instead of uploading 20MB to hear no.
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error(t('avatarTooLarge'), { sticky: true });
      return;
    }
    uploadAvatar.mutate(file);
  };

  return (
    <div className="space-y-4 border-b border-gray-100 pb-4">
      <div className="flex items-center gap-4">
        <StaffAvatar avatar={profile?.avatar} className="h-16 w-16" />
        <div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={isLoading || busy} onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1.5 h-4 w-4" />
              {t('avatarUpload')}
            </Button>
            {profile?.avatar && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => removeAvatar.mutate()}>
                <Trash2 className="mr-1.5 h-4 w-4" />
                {t('avatarRemove')}
              </Button>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-400">{t('avatarHint')}</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = ''; // the same file again is a new pick
            }}
          />
        </div>
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nameChanged) return;
          updateName.mutate(name, { onSuccess: () => setNameDraft(null) });
        }}
      >
        <label htmlFor="profile-display-name" className="w-24 shrink-0 text-sm text-gray-500">
          {t('displayName')}
        </label>
        <Input
          id="profile-display-name"
          className="max-w-xs flex-1"
          maxLength={60}
          value={name}
          disabled={isLoading}
          placeholder={t('displayNamePlaceholder')}
          onChange={(e) => setNameDraft(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={!nameChanged || updateName.isPending}>
          {t('save')}
        </Button>
        <p className="w-full text-xs text-gray-400 sm:pl-[6.5rem]">{t('displayNameHint')}</p>
      </form>
    </div>
  );
}
