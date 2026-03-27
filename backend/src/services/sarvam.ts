import fs from "node:fs";
import path from "node:path";
import { SarvamAIClient } from "sarvamai";
import { env } from "../config/env.js";
import { cacheStore } from "../db/cache.js";
import { logger } from "../lib/logger.js";

class SarvamService {
  private readonly client = new SarvamAIClient({
    apiSubscriptionKey: env.SARVAM_API_KEY,
  }) as any;

  private prepareTextForSpeech(text: string): string {
    return text
      .replace(/[*_#`]/g, "")
      .replace(/\s+/g, " ")
      .replace(/\s+([,.!?])/g, "$1")
      .replace(/([.!?])(?!\s|$)/g, "$1 ")
      .trim();
  }

  async transcribeShortAudio(input: {
    filePath: string;
    mode: string;
    languageCode?: string;
    withDiarization?: boolean;
    numSpeakers?: number;
  }): Promise<Record<string, unknown>> {
    const stats = fs.statSync(input.filePath);
    const cacheKey = cacheStore.buildKey("stt-short", {
      filePath: path.basename(input.filePath),
      fileSize: stats.size,
      mtimeMs: stats.mtimeMs,
      mode: input.mode,
      languageCode: input.languageCode,
      withDiarization: input.withDiarization,
      numSpeakers: input.numSpeakers,
    });

    const cached = await cacheStore.get(cacheKey);
    if (cached) {
      logger.info("Sarvam STT cache hit", {
        model: env.SARVAM_STT_MODEL,
        filePath: path.basename(input.filePath),
        languageCode: input.languageCode ?? "auto",
      });
      return JSON.parse(cached) as Record<string, unknown>;
    }

    logger.info("Sarvam STT request", {
      model: env.SARVAM_STT_MODEL,
      filePath: path.basename(input.filePath),
      fileSize: stats.size,
      languageCode: input.languageCode ?? "auto",
      mode: input.mode,
    });

    const response = await this.client.speechToText.transcribe({
      file: fs.createReadStream(input.filePath),
      model: env.SARVAM_STT_MODEL,
      mode: input.mode,
      language_code: input.languageCode,
      with_diarization: input.withDiarization,
      num_speakers: input.numSpeakers,
    });

    await cacheStore.set(cacheKey, JSON.stringify(response), env.CACHE_TTL_STT_SECONDS);
    logger.info("Sarvam STT response", {
      model: env.SARVAM_STT_MODEL,
      filePath: path.basename(input.filePath),
      hasTranscript: Boolean(
        (response as { transcript?: unknown; text?: unknown; transcript_text?: unknown }).transcript
          ?? (response as { text?: unknown }).text
          ?? (response as { transcript_text?: unknown }).transcript_text,
      ),
    });
    return response as Record<string, unknown>;
  }

  async synthesizeText(input: {
    text: string;
    speaker?: string;
    languageCode?: string;
    pace?: number;
  }): Promise<{ audio: string; format: string }> {
    const preparedText = this.prepareTextForSpeech(input.text);
    const cacheKey = cacheStore.buildKey("tts", {
      model: env.SARVAM_TTS_MODEL,
      text: preparedText,
      speaker: input.speaker ?? env.SARVAM_TTS_DEFAULT_SPEAKER,
      languageCode: input.languageCode ?? env.SARVAM_TTS_DEFAULT_LANGUAGE,
      pace: input.pace ?? env.SARVAM_TTS_DEFAULT_PACE,
      format: env.SARVAM_TTS_DEFAULT_FORMAT,
      temperature: env.SARVAM_TTS_TEMPERATURE,
      speechSampleRate: env.SARVAM_TTS_SAMPLE_RATE,
    });

    const cached = await cacheStore.get(cacheKey);
    if (cached) {
      logger.info("Sarvam TTS cache hit", {
        model: env.SARVAM_TTS_MODEL,
        languageCode: input.languageCode ?? env.SARVAM_TTS_DEFAULT_LANGUAGE,
        speaker: input.speaker ?? env.SARVAM_TTS_DEFAULT_SPEAKER,
      });
      return JSON.parse(cached) as { audio: string; format: string };
    }

    logger.info("Sarvam TTS request", {
      model: env.SARVAM_TTS_MODEL,
      textLength: preparedText.length,
      languageCode: input.languageCode ?? env.SARVAM_TTS_DEFAULT_LANGUAGE,
      speaker: input.speaker ?? env.SARVAM_TTS_DEFAULT_SPEAKER,
    });

    const response = await this.client.textToSpeech.convert({
      model: env.SARVAM_TTS_MODEL,
      text: preparedText,
      speaker: input.speaker ?? env.SARVAM_TTS_DEFAULT_SPEAKER,
      target_language_code: input.languageCode ?? env.SARVAM_TTS_DEFAULT_LANGUAGE,
      pace: input.pace ?? env.SARVAM_TTS_DEFAULT_PACE,
      temperature: env.SARVAM_TTS_TEMPERATURE,
      speech_sample_rate: env.SARVAM_TTS_SAMPLE_RATE,
      output_audio_codec: env.SARVAM_TTS_DEFAULT_FORMAT,
    });

    const payload = {
      audio: String((response as { audios?: string[]; audio?: string }).audio ?? (response as { audios?: string[] }).audios?.[0] ?? ""),
      format: env.SARVAM_TTS_DEFAULT_FORMAT,
    };

    await cacheStore.set(cacheKey, JSON.stringify(payload), env.CACHE_TTL_TTS_SECONDS);
    logger.info("Sarvam TTS response", {
      model: env.SARVAM_TTS_MODEL,
      textLength: preparedText.length,
      audioLength: payload.audio.length,
      format: payload.format,
    });
    return payload;
  }
}

export const sarvamService = new SarvamService();

logger.info("Sarvam speech client initialized");
