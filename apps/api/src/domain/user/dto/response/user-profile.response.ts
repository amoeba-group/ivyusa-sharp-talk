/** A public asset reference — `GET /public/widget/asset/:uuid?v=`. */
export interface AvatarRef {
  uuid: string;
  version: number;
}

export interface MyProfileResponse {
  email: string;
  /** Shown to customers beside this person's replies; null = the tenant's generic label. */
  displayName: string | null;
  avatar: AvatarRef | null;
}
