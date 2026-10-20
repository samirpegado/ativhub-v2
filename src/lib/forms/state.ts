export type MutationState =
  | { error: string; success?: never }
  | { success: true; error?: never }
  | undefined;
