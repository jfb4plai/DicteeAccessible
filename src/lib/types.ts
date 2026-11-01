export type Stage = 'A' | 'B1' | 'B2' | 'C';

export type DictaItem = { id: string; word: string; position: number };

export type AttemptRow = {
  itemId: string;
  stage: Stage;
  kind: 'attempt' | 'help';
  attemptNumber: number;
  correct: boolean | null;
  answer?: string | null;
  listens?: number;
  screenshot?: string | null;
};

export type SessionOptions = { showCorrect: boolean; readAloud: boolean; finalRound: boolean };

export type OpenedSession = {
  sessionId: string;
  mode: 'autonomy' | 'class';
  options: SessionOptions;
  items: DictaItem[];
  attempts: AttemptRow[];
};

export type Pupil = { id: string; code: string };

export type SessionInput = {
  title: string;
  level: 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';
  mode: 'autonomy' | 'class';
  words: string[];
  pupilIds: string[];
  options: SessionOptions;
};

export type SessionListItem = {
  id: string;
  title: string;
  level: string;
  mode: string;
  accessCode: string;
  wordCount: number;
  pupilCount: number;
  createdAt: string;
};

export type SaveJob =
  | { kind: 'attempt'; itemId: string; stage: Stage; answer: string; listens: number; screenshot: string | null }
  | { kind: 'help'; itemId: string; stage: Stage };

export type CommentRow = { pupilId: string; body: string; visible: boolean };
