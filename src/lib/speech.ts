export class SpeechService {
  private synthesis: SpeechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    this.synthesis = window.speechSynthesis;
    this.loadVoices();
  }

  private loadVoices() {
    this.voices = this.synthesis.getVoices();

    if (this.voices.length === 0) {
      this.synthesis.addEventListener('voiceschanged', () => {
        this.voices = this.synthesis.getVoices();
      });
    }
  }

  private getFrenchVoice(): SpeechSynthesisVoice | null {
    const frenchVoices = this.voices.filter(voice =>
      voice.lang.startsWith('fr-BE') || voice.lang.startsWith('fr-FR') || voice.lang.startsWith('fr')
    );

    return frenchVoices[0] || this.voices[0] || null;
  }

  speak(text: string, rate: number = 0.9): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synthesis) {
        resolve();
        return;
      }

      this.synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const voice = this.getFrenchVoice();

      if (voice) {
        utterance.voice = voice;
      }

      utterance.lang = 'fr-FR';
      utterance.rate = rate;
      utterance.volume = 1;

      // A TTS failure or interruption (e.g. cancel() from a fast follow-up
      // click) must never block the pedagogical flow, so this always
      // resolves instead of rejecting.
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      this.synthesis.speak(utterance);
    });
  }

  cancel() {
    this.synthesis.cancel();
  }

  isSupported(): boolean {
    return 'speechSynthesis' in window;
  }
}

export const speechService = new SpeechService();
