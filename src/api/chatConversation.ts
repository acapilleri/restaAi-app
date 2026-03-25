export function getChatConversationId(userId: number | string | null | undefined): string | null {
  if (userId === null || userId === undefined) return null;
  return 'global';
}
