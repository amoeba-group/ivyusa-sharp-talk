import { apiBaseUrl, apiDelete, apiGet, apiPatch, apiPostForm } from '@/lib/api-client';

/** A staff profile icon — a public asset (PLN-261028). */
export interface AvatarRef {
  uuid: string;
  version: number;
}

export interface MyProfile {
  email: string;
  /** Shown to customers beside this person's replies; null = the tenant's generic label. */
  displayName: string | null;
  avatar: AvatarRef | null;
}

/** Same public route the widget uses for design icons. */
export const avatarUrl = (ref: AvatarRef): string =>
  `${apiBaseUrl()}/public/widget/asset/${encodeURIComponent(ref.uuid)}?v=${encodeURIComponent(String(ref.version))}`;

/** Server limit for the original image (it is stored as a 256px square). */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const profileService = {
  get: () => apiGet<MyProfile>('/users/me/profile'),
  updateName: (displayName: string) => apiPatch<MyProfile>('/users/me/profile', { display_name: displayName }),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiPostForm<MyProfile>('/users/me/avatar', form);
  },
  removeAvatar: () => apiDelete<MyProfile>('/users/me/avatar'),
};
