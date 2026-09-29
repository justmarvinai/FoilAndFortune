export class InvariantError extends Error {
  override name = 'InvariantError';
}

/** Throws if `condition` is falsy. For programmer errors, not player-facing validation. */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new InvariantError(message);
}

/** Exhaustiveness check for discriminated unions. */
export function assertNever(value: never, context = 'value'): never {
  throw new InvariantError(`Unexpected ${context}: ${JSON.stringify(value)}`);
}
