import { In, Repository } from 'typeorm';
import { SENDER_TYPE } from '@sharptalk/types';
import { User } from './entity/user.entity';
import { AvatarRef } from './dto/response/user-profile.response';

/**
 * A profile icon as a public asset reference. A new upload is a new uuid, so
 * the version never moves — the uuid alone is the cache key of the public URL.
 */
export function avatarRef(uuid: string | null | undefined): AvatarRef | null {
  return uuid ? { uuid, version: 1 } : null;
}

/**
 * Profile icons of the staff who wrote these messages (PLN-261028), one query
 * per page like the sender names. Staff without an icon are simply absent.
 */
export async function staffAvatars(
  userRepo: Repository<User>,
  messages: Array<{ senderType: string; senderId: number | null }>,
): Promise<Map<string, AvatarRef>> {
  const map = new Map<string, AvatarRef>();
  const ids = [
    ...new Set(
      messages.filter((m) => m.senderType === SENDER_TYPE.AGENT && m.senderId != null).map((m) => m.senderId as number),
    ),
  ];
  if (ids.length === 0) return map;
  const users = await userRepo.find({ where: { id: In(ids) }, select: ['id', 'avatarAssetUuid'] });
  for (const u of users) {
    const ref = avatarRef(u.avatarAssetUuid);
    if (ref) map.set(String(u.id), ref);
  }
  return map;
}
