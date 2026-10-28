import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth-store';
import { useTenantKey } from '@/lib/use-tenant-key';
import { toast } from '@/store/toast-store';
import { profileService, type MyProfile } from './profile.service';

/** The signed-in staff member's own profile; system admins have none. */
export function useMyProfile() {
  const tenantKey = useTenantKey();
  const principal = useAuthStore((s) => s.principal);
  return useQuery({
    queryKey: ['my-profile', tenantKey, principal?.actorType === 'user' ? principal.id : null],
    queryFn: () => profileService.get(),
    enabled: principal?.actorType === 'user',
    staleTime: 5 * 60_000,
  });
}

/** Upload errors by code (E5081 unsupported, E5082 too large, E5083 pixels). */
function avatarError(t: (k: string) => string, e: Error & { code?: string; status?: number }): string {
  if (e.code === 'E5082' || e.status === 413) return t('avatarTooLarge');
  if (e.code === 'E5081' || e.code === 'E5083' || e.code === 'E5085') return t('avatarUnsupported');
  return e.message || t('saveError');
}

export function useProfileMutations() {
  const { t } = useTranslation('mypage');
  const qc = useQueryClient();
  const tenantKey = useTenantKey();
  const principal = useAuthStore((s) => s.principal);
  const key = ['my-profile', tenantKey, principal?.actorType === 'user' ? principal.id : null];
  const done = (msg: string) => (p: MyProfile) => {
    qc.setQueryData(key, p);
    // The live chat shows the new face on the next poll.
    toast.success(msg);
  };
  const fail = (e: Error) => toast.error(avatarError(t, e), { sticky: true });
  return {
    updateName: useMutation({
      mutationFn: (name: string) => profileService.updateName(name),
      onSuccess: done(t('nameSaved')),
      onError: fail,
    }),
    uploadAvatar: useMutation({
      mutationFn: (file: File) => profileService.uploadAvatar(file),
      onSuccess: done(t('avatarSaved')),
      onError: fail,
    }),
    removeAvatar: useMutation({
      mutationFn: () => profileService.removeAvatar(),
      onSuccess: done(t('avatarRemoved')),
      onError: fail,
    }),
  };
}
