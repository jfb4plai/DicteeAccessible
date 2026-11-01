import { supabase } from './supabase';
import { generateAccessCode } from './codes';
import { normalizeCode, toAttemptRow, toOpenedSession } from './apiMapping';
import type {
  AttemptRow, CommentRow, DictaItem, OpenedSession, Pupil, SessionInput, SessionListItem, SessionOptions, Stage,
} from './types';

const PAGE = 1000;

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Connexion requise.');
  return data.user.id;
}

function fail(message: string): never {
  throw new Error(message);
}

// ---------- Élève (aucun accès direct aux tables : fonctions SQL seulement) ----------

export async function openSession(accessCode: string, pupilCode: string): Promise<OpenedSession> {
  const { data, error } = await supabase.rpc('dicta_open_session', {
    p_access_code: normalizeCode(accessCode),
    p_pupil_code: normalizeCode(pupilCode),
  });
  if (error) fail(error.message.includes('invalid_access') ? 'Code inconnu' : 'Connexion impossible. Réessayer.');
  return toOpenedSession(data);
}

export async function recordAttempt(a: {
  accessCode: string; pupilCode: string; itemId: string; stage: Stage; answer: string; listens: number; screenshot: string | null;
}): Promise<{ correct: boolean; attemptNumber: number }> {
  const { data, error } = await supabase.rpc('dicta_record_attempt', {
    p_access_code: normalizeCode(a.accessCode),
    p_pupil_code: normalizeCode(a.pupilCode),
    p_item_id: a.itemId,
    p_stage: a.stage,
    p_answer: a.answer,
    p_listens: a.listens,
    p_screenshot: a.screenshot,
  });
  if (error) fail('Enregistrement impossible.');
  return { correct: data.correct, attemptNumber: data.attempt_number };
}

export async function recordSentenceAttempt(a: {
  accessCode: string; pupilCode: string; sentenceId: string; stage: 'B1' | 'B2'; answer: string; listens: number;
}): Promise<{ correct: boolean; attemptNumber: number }> {
  const { data, error } = await supabase.rpc('dicta_record_sentence_attempt', {
    p_access_code: normalizeCode(a.accessCode),
    p_pupil_code: normalizeCode(a.pupilCode),
    p_sentence_id: a.sentenceId,
    p_stage: a.stage,
    p_answer: a.answer,
    p_listens: a.listens,
  });
  if (error) fail('Enregistrement impossible.');
  return { correct: data.correct, attemptNumber: data.attempt_number };
}

export async function recordHelp(a: { accessCode: string; pupilCode: string; itemId: string; stage: Stage }): Promise<void> {
  const { error } = await supabase.rpc('dicta_record_help', {
    p_access_code: normalizeCode(a.accessCode),
    p_pupil_code: normalizeCode(a.pupilCode),
    p_item_id: a.itemId,
    p_stage: a.stage,
  });
  if (error) fail('Enregistrement impossible.');
}

// ---------- Enseignante (RLS : user_id = auth.uid()) ----------

const byCodeNumber = (a: Pupil, b: Pupil) =>
  Number(a.code.replace(/\D/g, '')) - Number(b.code.replace(/\D/g, ''));

export async function listPupils(): Promise<Pupil[]> {
  const { data, error } = await supabase.from('dicta_pupils').select('id, code');
  if (error) fail('Liste des élèves indisponible.');
  return (data as Pupil[]).sort(byCodeNumber);
}

export async function createPupils(codes: string[]): Promise<Pupil[]> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('dicta_pupils')
    .insert(codes.map(code => ({ user_id: userId, code })))
    .select('id, code');
  if (error) fail('Création des codes impossible.');
  return (data as Pupil[]).sort(byCodeNumber);
}

export async function createSession(input: SessionInput): Promise<{ id: string; accessCode: string }> {
  const userId = await currentUserId();
  let session: { id: string; access_code: string } | null = null;

  for (let attempt = 0; attempt < 3 && !session; attempt++) {
    const { data, error } = await supabase
      .from('dicta_sessions')
      .insert({
        user_id: userId,
        title: input.title,
        level: input.level,
        mode: input.mode,
        access_code: generateAccessCode(),
        show_correct: input.options.showCorrect,
        read_aloud: input.options.readAloud,
        final_round: input.options.finalRound,
      })
      .select('id, access_code')
      .single();
    if (!error) session = data;
    else if (error.code !== '23505') fail('Création de la dictée impossible.');
  }
  if (!session) fail('Création de la dictée impossible.');

  const items = await supabase
    .from('dicta_items')
    .insert(input.words.map((word, position) => ({ session_id: session!.id, word, position })));
  const pupils = await supabase
    .from('dicta_session_pupils')
    .insert(input.pupilIds.map(pupil_id => ({ session_id: session!.id, pupil_id })));

  if (items.error || pupils.error) {
    await supabase.from('dicta_sessions').delete().eq('id', session.id); // cascade : rien de partiel ne reste
    fail('Création de la dictée impossible.');
  }
  return { id: session.id, accessCode: session.access_code };
}

export async function listSessions(): Promise<SessionListItem[]> {
  const { data, error } = await supabase
    .from('dicta_sessions')
    .select('id, title, level, mode, access_code, created_at, dicta_items(count), dicta_session_pupils(count)')
    .order('created_at', { ascending: false });
  if (error) fail('Liste des dictées indisponible.');
  return (data as any[]).map(r => ({
    id: r.id,
    title: r.title,
    level: r.level,
    mode: r.mode,
    accessCode: r.access_code,
    wordCount: r.dicta_items?.[0]?.count ?? 0,
    pupilCount: r.dicta_session_pupils?.[0]?.count ?? 0,
    createdAt: r.created_at,
  }));
}

async function fetchAttempts(sessionId: string, pupilId: string | null, withScreenshot: boolean) {
  const columns = 'pupil_id, item_id, stage, kind, attempt_number, answer, correct, listens' + (withScreenshot ? ', screenshot' : '');
  const rows: (AttemptRow & { pupilId: string })[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from('dicta_attempts').select(columns).eq('session_id', sessionId);
    if (pupilId) query = query.eq('pupil_id', pupilId);
    const { data, error } = await query.order('created_at').range(from, from + PAGE - 1);
    if (error) fail('Résultats indisponibles.');
    rows.push(...(data as any[]).map(r => ({ ...toAttemptRow(r), pupilId: r.pupil_id })));
    if ((data as any[]).length < PAGE) return rows;
  }
}

export async function getResults(sessionId: string): Promise<{
  title: string; options: SessionOptions; items: DictaItem[]; pupils: Pupil[];
  attempts: (AttemptRow & { pupilId: string })[]; comments: CommentRow[];
}> {
  const [session, items, links, comments, attempts] = await Promise.all([
    supabase.from('dicta_sessions').select('title, show_correct, read_aloud, final_round').eq('id', sessionId).single(),
    supabase.from('dicta_items').select('id, word, position').eq('session_id', sessionId).order('position'),
    supabase.from('dicta_session_pupils').select('dicta_pupils(id, code)').eq('session_id', sessionId),
    supabase.from('dicta_comments').select('pupil_id, body, visible').eq('session_id', sessionId),
    fetchAttempts(sessionId, null, false),
  ]);
  if (session.error || items.error || links.error || comments.error) fail('Résultats indisponibles.');
  return {
    title: session.data.title,
    options: { showCorrect: session.data.show_correct, readAloud: session.data.read_aloud, finalRound: session.data.final_round },
    items: items.data as DictaItem[],
    pupils: (links.data as any[]).map(l => l.dicta_pupils as Pupil).sort(byCodeNumber),
    attempts,
    comments: (comments.data as any[]).map(c => ({ pupilId: c.pupil_id, body: c.body, visible: c.visible })),
  };
}

// Captures d'erreur : chargées seulement pour l'élève ouvert (les images alourdissent la requête).
export async function getPupilAttempts(sessionId: string, pupilId: string): Promise<AttemptRow[]> {
  return fetchAttempts(sessionId, pupilId, true);
}

export async function saveComment(sessionId: string, c: CommentRow): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase.from('dicta_comments').upsert(
    { user_id: userId, session_id: sessionId, pupil_id: c.pupilId, body: c.body, visible: c.visible, updated_at: new Date().toISOString() },
    { onConflict: 'session_id,pupil_id' },
  );
  if (error) fail('Commentaire non enregistré.');
}
