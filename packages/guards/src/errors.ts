export class GuardError extends Error {
  constructor(msg: string, public guard: string, public corrId: string) {
    super(msg);
    this.name = (this.constructor as any).name;
  }
}

export class GuardConfigError extends GuardError {}

export class GuardRuntimeError extends GuardError {} 