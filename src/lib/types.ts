export type Voice = 'adrien' | 'jef' | 'device';

export type Stage = 'A' | 'B1' | 'B2' | 'C';

export type DictaItem = { id: string; word: string; position: number };

export type DictaSentence = { id: string; position: number; text: string; parasites: string[]; itemId: string | null };

export type AttemptRow = {
  itemId: string; // vide pour une ligne de phrase
  sentenceId?: string | null;
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
  voice: Voice;
  options: SessionOptions;
  items: DictaItem[];
  sentences: DictaSentence[];
  attempts: AttemptRow[];
};

export type Pupil = { id: string; code: string };

export type Contents = 'words' | 'words+sentences' | 'sentences';

export type SessionInput = {
  title: string;
  level: 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';
  mode: 'autonomy' | 'class';
  words: string[];
  contents: Contents;
  voice: Voice;
  pupilIds: string[];
  options: SessionOptions;
};

export type SessionListItem = {
  id: string;
  title: string;
  level: string;
  mode: string;
  accessCode: string;
  published: boolean;
  wordCount: number;
  pupilCount: number;
  createdAt: string;
};

export type SaveJob =
  | { kind: 'attempt'; itemId: string; stage: Stage; answer: string; listens: number; screenshot: string | null }
  | { kind: 'sentence'; sentenceId: string; stage: 'B1' | 'B2'; answer: string; listens: number }
  | { kind: 'help'; itemId: string; stage: Stage };

export type CommentRow = { pupilId: string; body: string; visible: boolean };
