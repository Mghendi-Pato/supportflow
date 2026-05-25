import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as public — bypasses JWT authentication.
 * Use for login, register, invite-accept endpoints.
 *
 * @example
 * @Public()
 * @Post('login')
 * login(@Body() dto: LoginDto) { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
