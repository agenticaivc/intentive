export class JwtGuardError extends Error {
  constructor(
    message: string,
    public code: string,
    public httpStatus: number = 500,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'JwtGuardError';
  }
}

export class JwtVerificationError extends JwtGuardError {
  constructor(message: string, originalError?: Error) {
    super(message, 'INTENTIVE_JWT_INVALID', 401, originalError);
  }
}

export class InsufficientPermissionsError extends JwtGuardError {
  constructor(message: string, public missingRoles: string[]) {
    super(message, 'INTENTIVE_INSUFFICIENT_PERMISSIONS', 403);
  }
} 