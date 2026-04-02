/** Id generati lato client in useChat (`makeId`): `prefix-timestamp-rand`. */
export function isClientGeneratedMessageId(id: string): boolean {
  return /^(assistant|system-log|user)-\d+-/.test(id);
}
