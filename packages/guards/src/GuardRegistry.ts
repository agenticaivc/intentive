import { Guard } from './GuardABI';

type GuardConstructor = new (...args: any[]) => Guard;

export class GuardRegistry {
  private static guards = new Map<string, GuardConstructor>();

  static register(name: string, guardClass: GuardConstructor): void {
    if (this.guards.has(name)) {
      throw new Error(`Guard '${name}' is already registered`);
    }
    this.guards.set(name, guardClass);
  }

  static get(name: string): GuardConstructor | undefined {
    return this.guards.get(name);
  }

  static clear(): void {
    this.guards.clear();
  }
} 