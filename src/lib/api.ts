import { supabase } from './supabase';
import { generateAccessCode } from './codes';
import { normalizeCode, toAttemptRow, toOpenedSession } from './apiMapping';
import type { GenerateInput, GeneratedSentence } from './sentenceGeneration.js';
import type {
  AttemptRow, DictaSentence, CommentRow, DictaItem, OpenedSession, Pupil, SessionInput, SessionListItem, SessionOptions, Stage,
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
        published: input.contents === 'words', // avec des phrases : brouillon jusqu'à la validation
      })
      .select('id, access_code')
      .single();
    if (!error) session = data;
    else if (error.code !== '23505') fail('Création de la dictée impossible.');
  }
  if (!session) fail('Création de la dictée impossible.');

  const items = input.words.length === 0
    ? { error: null }
    : await supabase
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
    .select('id, title, level, mode, access_code, published, created_at, dicta_items(count), dicta_session_pupils(count)')
    .order('created_at', { ascending: false });
  if (error) fail('Liste des dictées indisponible.');
  return (data as any[]).map(r => ({
    id: r.id,
    title: r.title,
    level: r.level,
    mode: r.mode,
    accessCode: r.access_code,
    published: r.published,
    wordCount: r.dicta_items?.[0]?.count ?? 0,
    pupilCount: r.dicta_session_pupils?.[0]?.count ?? 0,
    createdAt: r.created_at,
  }));
}

async function fetchAttempts(sessionId: string, pupilId: string | null, withScreenshot: boolean) {
  const columns = 'pupil_id, item_id, sentence_id, stage, kind, attempt_number, answer, correct, listens' + (withScreenshot ? ', screenshot' : '');
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
  title: string; mode: 'autonomy' | 'class'; options: SessionOptions; items: DictaItem[]; sentences: DictaSentence[]; pupils: Pupil[];
  attempts: (AttemptRow & { pupilId: string })[]; comments: CommentRow[];
}> {
  const [session, items, links, comments, attempts, sentences] = await Promise.all([
    supabase.from('dicta_sessions').select('title, mode, show_correct, read_aloud, final_round').eq('id', sessionId).single(),
    supabase.from('dicta_items').select('id, word, position').eq('session_id', sessionId).order('position'),
    supabase.from('dicta_session_pupils').select('dicta_pupils(id, code)').eq('session_id', sessionId),
    supabase.from('dicta_comments').select('pupil_id, body, visible').eq('session_id', sessionId),
    fetchAttempts(sessionId, null, false),
    supabase.from('dicta_sentences').select('id, position, text, parasites, item_id').eq('session_id', sessionId).order('position'),
  ]);
  if (session.error || items.error || links.error || comments.error || sentences.error) fail('Résultats indisponibles.');
  return {
    title: session.data.title,
    mode: session.data.mode,
    sentences: (sentences.data as any[]).map(r => ({ id: r.id, position: r.position, text: r.text, parasites: r.parasites ?? [], itemId: r.item_id })),
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

// ---------- Phrases (enseignant(e)) ----------

export async function generateSentences(input: GenerateInput): Promise<{ sentences: GeneratedSentence[]; missing: string[] }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) fail('Connexion requise.');
  let response: Response;
  try {
    response = await fetch('/api/generate-sentences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });
  } catch {
    fail("La proposition automatique n'est pas disponible. Écris tes phrases toi-même.");
  }
  if (response.status === 429) fail('Plafond du jour atteint. Écris tes phrases toi-même ou reviens demain.');
  if (!response.ok) fail("La proposition automatique n'est pas disponible. Écris tes phrases toi-même.");
  return response.json();
}

export async function getSessionForEdit(sessionId: string): Promise<{
  title: string; level: string; mode: 'autonomy' | 'class'; published: boolean; accessCode: string;
  items: DictaItem[]; pupils: Pupil[];
}> {
  const [session, items, links] = await Promise.all([
    supabase.from('dicta_sessions').select('title, level, mode, published, access_code').eq('id', sessionId).single(),
    supabase.from('dicta_items').select('id, word, position').eq('session_id', sessionId).order('position'),
    supabase.from('dicta_session_pupils').select('dicta_pupils(id, code)').eq('session_id', sessionId),
  ]);
  if (session.error || items.error || links.error) fail('Dictée introuvable.');
  return {
    title: session.data.title,
    level: session.data.level,
    mode: session.data.mode,
    published: session.data.published,
    accessCode: session.data.access_code,
    items: items.data as DictaItem[],
    pupils: (links.data as any[]).map(l => l.dicta_pupils as Pupil).sort(byCodeNumber),
  };
}

export async function listSentences(sessionId: string): Promise<(DictaSentence & { validated: boolean })[]> {
  const { data, error } = await supabase
    .from('dicta_sentences')
    .select('id, position, text, parasites, item_id, validated')
    .eq('session_id', sessionId)
    .order('position');
  if (error) fail('Phrases indisponibles.');
  return (data as any[]).map(r => ({
    id: r.id, position: r.position, text: r.text, parasites: r.parasites ?? [], itemId: r.item_id, validated: r.validated,
  }));
}

// Enregistre d'abord (mise à jour et ajouts), supprime ensuite les phrases retirées : rien n'est perdu si une étape échoue.
export async function saveSentences(
  sessionId: string,
  sentences: { id?: string; text: string; parasites: string[]; itemId: string | null; validated: boolean }[],
): Promise<void> {
  const existing = await listSentences(sessionId);
  const rows = sentences.map((s, position) => ({
    ...(s.id && { id: s.id }),
    session_id: sessionId, position, text: s.text, parasites: s.parasites, item_id: s.itemId, validated: s.validated,
  }));
  const updated = rows.filter(r => 'id' in r);
  const added = rows.filter(r => !('id' in r));
  if (updated.length > 0) {
    const { error } = await supabase.from('dicta_sentences').upsert(updated);
    if (error) fail('Phrases non enregistrées.');
  }
  if (added.length > 0) {
    const { error } = await supabase.from('dicta_sentences').insert(added);
    if (error) fail('Phrases non enregistrées.');
  }
  const keep = new Set(sentences.map(s => s.id).filter(Boolean));
  const removed = existing.filter(e => !keep.has(e.id)).map(e => e.id);
  if (removed.length > 0) {
    const { error } = await supabase.from('dicta_sentences').delete().in('id', removed);
    if (error) fail('Phrases non enregistrées.');
  }
}

export async function publishSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from('dicta_sessions').update({ published: true }).eq('id', sessionId);
  if (error) fail(error.message.includes('sentences_not_validated') ? 'Valide toutes les phrases avant de publier.' : 'Publication impossible.');
}
