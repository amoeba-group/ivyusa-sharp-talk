/** A public asset reference — `GET /public/widget/asset/:uuid?v=`. */
export interface AvatarRef {
  uuid: string;
  version: number;
}

/** Team and job labels assigned by a master (PLN-261028-MyPage-Team-Labels). */
export interface MyOrg {
  unit: { id: string; name: string } | null;
  labels: Array<{ code: string; name: string }>;
}

export interface MyProfileResponse extends MyOrg {
  email: string;
  /** Shown to customers beside this person's replies; null = the tenant's generic label. */
  displayName: string | null;
  avatar: AvatarRef | null;
}
