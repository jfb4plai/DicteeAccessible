import type { CommentRow } from './types';

export function upsertComment(list: CommentRow[], c: CommentRow): CommentRow[] {
  const exists = list.some(x => x.pupilId === c.pupilId);
  return exists ? list.map(x => (x.pupilId === c.pupilId ? c : x)) : [...list, c];
}
