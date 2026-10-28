import { IsString, MaxLength } from 'class-validator';

/** The signed-in user's own profile (PLN-261028 D5). */
export class UpdateMyProfileRequest {
  /** The name customers see beside this person's replies; empty clears it. */
  @IsString()
  @MaxLength(60)
  display_name: string;
}
