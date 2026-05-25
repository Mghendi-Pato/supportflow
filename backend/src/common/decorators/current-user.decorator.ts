import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the authenticated user from the request.
 *
 * @example
 * @Get('me')
 * getProfile(@CurrentUser() user: JwtPayload) { ... }
 *
 * // Or extract a single field:
 * @Get('me')
 * getProfile(@CurrentUser('tenantId') tenantId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
