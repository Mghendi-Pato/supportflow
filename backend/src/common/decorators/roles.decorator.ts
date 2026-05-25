import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route to specific roles.
 *
 * @example
 * @Roles('WORKSPACE_ADMIN')
 * @Delete(':id')
 * deleteClient() { ... }
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
