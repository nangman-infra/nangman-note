import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AUTH_USER_KEY } from './auth.constants';
import type { AuthUser } from './auth-user.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined => {
    const request = context
      .switchToHttp()
      .getRequest<Record<string, unknown>>();
    return (request?.[AUTH_USER_KEY] as AuthUser | undefined) ?? undefined;
  },
);
