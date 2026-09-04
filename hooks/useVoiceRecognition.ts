"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { correctOffshoreTerminology } from "@/utils/offshore-spellcheck";

export interface UseVoiceRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

export function useVoiceRecognition(options: UseVoiceRecognitionOptions = {}) {
  const {
    continuous = true,
    interimResults = true,
    lang = "en-US",
    onResult,
    onError,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<any>(null);
  const isManuallyStoppedRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      setIsSupported(Boolean(SpeechRecognition));
    }
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    isManuallyStoppedRef.current = false;

    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      const err = "Voice Recognition is not supported by this browser. Please use Google Chrome, Microsoft Edge, or Safari.";
      setError(err);
      onError?.(err);
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = lang;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = "";
        let finalChunk = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0]?.transcript || "";
          if (res.isFinal) {
            finalChunk += text + " ";
          } else {
            currentInterim += text;
          }
        }

        if (finalChunk) {
          const cleanedFinal = correctOffshoreTerminology(finalChunk);
          setTranscript((prev) => {
            const raw = (prev ? prev.trim() + " " : "") + cleanedFinal.trim();
            const updated = correctOffshoreTerminology(raw);
            onResult?.(updated, true);
            return updated;
          });
        }

        if (currentInterim) {
          const cleanedInterim = correctOffshoreTerminology(currentInterim);
          setInterimTranscript(cleanedInterim);
          onResult?.(cleanedInterim, false);
        } else {
          setInterimTranscript("");
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === "no-speech") {
          return;
        }
        console.warn("Speech recognition error:", event.error);
        const errMsg = event.error || "Speech recognition error";
        setError(errMsg);
        onError?.(errMsg);
      };

      recognition.onend = () => {
        // Auto-restart if continuous mode is enabled and wasn't explicitly stopped
        if (continuous && !isManuallyStoppedRef.current && recognitionRef.current) {
          try {
            recognition.start();
            return;
          } catch (e) {
            // ignore
          }
        }
        setIsListening(false);
        setInterimTranscript("");
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error("Failed to start speech recognition:", err);
      setError(err?.message || "Failed to start speech recognition");
      setIsListening(false);
    }
  }, [continuous, interimResults, lang, onResult, onError]);

  const stopListening = useCallback(() => {
    isManuallyStoppedRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    fullTranscript: (transcript + (interimTranscript ? " " + interimTranscript : "")).trim(),
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
  };
}
