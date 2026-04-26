export type SpeechReaderState = "idle" | "speaking" | "paused";

type SpeechReaderListener = (state: SpeechReaderState) => void;
type VoiceAvailabilityListener = (available: boolean) => void;

function cleanSpeechText(text: string): string {
  return text
    .replace(/💡/g, "Fun fact: ")
    .replace(/\s+/g, " ")
    .trim();
}

export class TextToSpeechReader {
  private synth: SpeechSynthesis | null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private listeners = new Set<SpeechReaderListener>();
  private voiceAvailabilityListeners = new Set<VoiceAvailabilityListener>();
  private state: SpeechReaderState = "idle";
  private language: string;
  private matchingVoice: SpeechSynthesisVoice | null = null;
  private voiceAvailable = false;

  constructor(language: string) {
    this.language = language;
    this.synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
    this.refreshVoiceAvailability();

    if (this.synth && "onvoiceschanged" in this.synth) {
      this.synth.addEventListener("voiceschanged", () => this.refreshVoiceAvailability());
    }
  }

  get isSupported(): boolean {
    return this.synth !== null && typeof SpeechSynthesisUtterance !== "undefined";
  }

  get hasVoiceForLanguage(): boolean {
    return this.voiceAvailable;
  }

  get currentState(): SpeechReaderState {
    return this.state;
  }

  setLanguage(language: string): void {
    this.language = language;
    this.refreshVoiceAvailability();
  }

  onChange(listener: SpeechReaderListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onVoiceAvailabilityChange(listener: VoiceAvailabilityListener): () => void {
    this.voiceAvailabilityListeners.add(listener);
    return () => this.voiceAvailabilityListeners.delete(listener);
  }

  speak(text: string): void {
    if (!this.isSupported || !this.synth || !this.matchingVoice) return;

    const speechText = cleanSpeechText(text);
    if (!speechText) return;

    this.stop();

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = this.language;
    utterance.rate = 0.95;
    utterance.pitch = 1;

    utterance.voice = this.matchingVoice;

    utterance.onend = () => {
      if (this.currentUtterance === utterance) {
        this.currentUtterance = null;
        this.setState("idle");
      }
    };

    utterance.onerror = () => {
      if (this.currentUtterance === utterance) {
        this.currentUtterance = null;
        this.setState("idle");
      }
    };

    this.currentUtterance = utterance;
    this.setState("speaking");
    this.synth.speak(utterance);
  }

  pause(): void {
    if (!this.synth || this.state !== "speaking") return;
    this.synth.pause();
    this.setState("paused");
  }

  resume(): void {
    if (!this.synth || this.state !== "paused") return;
    this.synth.resume();
    this.setState("speaking");
  }

  stop(): void {
    if (!this.synth) return;
    this.currentUtterance = null;
    this.synth.cancel();
    this.setState("idle");
  }

  private refreshVoiceAvailability(): void {
    this.matchingVoice = this.findPreferredVoice();
    const nextAvailable = this.matchingVoice !== null;
    if (this.voiceAvailable === nextAvailable) return;

    this.voiceAvailable = nextAvailable;
    for (const listener of this.voiceAvailabilityListeners) {
      listener(this.voiceAvailable);
    }
  }

  private findPreferredVoice(): SpeechSynthesisVoice | null {
    if (!this.synth) return null;

    const voices = this.synth.getVoices();
    const target = this.language.toLowerCase();
    const languageRoot = target.split("-")[0] ?? target;

    return (
      voices.find((voice) => voice.lang.toLowerCase() === target) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith(`${languageRoot}-`)) ??
      null
    );
  }

  private setState(nextState: SpeechReaderState): void {
    if (this.state === nextState) return;
    this.state = nextState;
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
