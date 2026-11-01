import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Session {
  id: string;
  title: string;
  teacher_name: string;
  word_list: any[];
  access_code: string;
  created_at: string;
  keyboard_mode: boolean;
  pronunciation_mode?: boolean;
  enable_parasite_letters?: boolean;
  parasite_letters_count?: number;
}

export interface WordAttempt {
  word: string;
  correct_word: string;
  attempt_number: number;
  is_correct: boolean;
  screenshot?: string;
  points: number;
}

export interface StudentResult {
  id: string;
  session_id: string;
  student_name: string;
  attempts: WordAttempt[];
  final_score: number;
  completed_at: string;
  duration_seconds: number;
  challenge_mode: boolean;
}
