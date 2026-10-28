import { User } from 'lucide-react';
import { cn } from '@/lib/cn';
import { avatarUrl, type AvatarRef } from '@/domain/my-page/profile.service';

/** A staff member's round profile icon, or a person glyph when none is set (PLN-261028). */
export function StaffAvatar({ avatar, className }: { avatar?: AvatarRef | null; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-400',
        className,
      )}
      aria-hidden="true"
    >
      {avatar ? (
        <img src={avatarUrl(avatar)} alt="" className="h-full w-full object-cover" />
      ) : (
        <User className="h-3/5 w-3/5" />
      )}
    </span>
  );
}
