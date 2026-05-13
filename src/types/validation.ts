export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string }
