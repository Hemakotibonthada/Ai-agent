/* ===================================================================
   Nexus AI OS — useVoice Hook
   Web Speech API: recognition, synthesis, voice-activity detection
   =================================================================== */

import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';

// Browser Speech API typings
type SpeechRecognitionType = typeof window extends { SpeechRecognition: infer T } ? T : unknown;

function getRecognitionCtor(): (new () => SpeechRecognition) | null {
  return (
    (window as unknown as Record<string, unknown>).SpeechRecognition ??
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition ??
    null
  ) as (new () => SpeechRecognition) | null;
}

export function useVoice() {
  const {
    isListening, isSpeaking, transcript,
    setListening, setSpeaking, setTranscript, voiceEnabled,
  } = useStore();

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef(window.speechSynthesis);

  /* ---------------------------------------------------------------- */
  /*  Start Listening                                                  */
  /* ---------------------------------------------------------------- */
  const startListening = useCallback((opts?: { continuous?: boolean; lang?: string }) => {
    if (!voiceEnabled) return;
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      console.warn('[Nexus Voice] SpeechRecognition not supported');
      return;
    }

    // Stop any existing session
    recognitionRef.current?.abort();

    const recognition = new Ctor();
    recognition.continuous = opts?.continuous ?? false;
    recognition.interimResults = true;
    recognition.lang = opts?.lang ?? 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      const text = final || interim;
      const confidence = event.results[event.results.length - 1]?.[0]?.confidence ?? 0;
      setTranscript(text, confidence);
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      console.error('[Nexus Voice] recognition error', e.error);
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognition.start();
    recognitionRef.current = recognition;
  }, [voiceEnabled, setListening, setTranscript]);

  /* ---------------------------------------------------------------- */
  /*  Stop Listening                                                   */
  /* ---------------------------------------------------------------- */
  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, [setListening]);

  /* ---------------------------------------------------------------- */
  /*  Speak (text-to-speech)                                           */
  /* ---------------------------------------------------------------- */
  const speak = useCallback((text: string, opts?: { voice?: SpeechSynthesisVoice; rate?: number; pitch?: number }) => {
    if (!voiceEnabled || !text) return;

    synthRef.current.cancel(); // stop anything currently playing
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = opts?.rate ?? 1;
    utterance.pitch = opts?.pitch ?? 1;
    if (opts?.voice) utterance.voice = opts.voice;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    synthRef.current.speak(utterance);
  }, [voiceEnabled, setSpeaking]);

  /* ---------------------------------------------------------------- */
  /*  Stop Speaking                                                    */
  /* ---------------------------------------------------------------- */
  const stopSpeaking = useCallback(() => {
    synthRef.current.cancel();
    setSpeaking(false);
  }, [setSpeaking]);

  /* ---- Cleanup on unmount ---- */
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      synthRef.current.cancel();
    };
  }, []);

  return {
    isListening,
    isSpeaking,
    transcript,
    voiceEnabled,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    isSupported: !!getRecognitionCtor(),
  } as const;
}

export default useVoice;
