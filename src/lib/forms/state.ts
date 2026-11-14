export type MutationState =
  | { error: string; success?: never }
  | { success: true; id?: string; error?: never }
  | undefined;
