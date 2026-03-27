import fs from "node:fs";
import path from "node:path";
import { SarvamAIClient } from "sarvamai";
import { env } from "../config/env.js";
import { cacheStore } from "../db/cache.js";
import { logger } from "../lib/logger.js";
class SarvamService {
    client = new SarvamAIClient({
        apiSubscriptionKey: env.SARVAM_API_KEY,
    });
    prepareTextForSpeech(text) {
        return text
            .replace(/[*_#`]/g, "")
            .replace(/\s+/g, " ")
            .replace(/\s+([,.!?])/g, "$1")
            .replace(/([.!?])(?!\s|$)/g, "$1 ")
            .trim();
    }
    async transcribeShortAudio(input) {
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
            return JSON.parse(cached);
        }
        const response = await this.client.speechToText.transcribe({
            file: fs.createReadStream(input.filePath),
            model: env.SARVAM_STT_MODEL,
            mode: input.mode,
            language_code: input.languageCode,
            with_diarization: input.withDiarization,
            num_speakers: input.numSpeakers,
        });
        await cacheStore.set(cacheKey, JSON.stringify(response), env.CACHE_TTL_STT_SECONDS);
        return response;
    }
    async synthesizeText(input) {
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
            return JSON.parse(cached);
        }
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
            audio: String(response.audio ?? response.audios?.[0] ?? ""),
            format: env.SARVAM_TTS_DEFAULT_FORMAT,
        };
        await cacheStore.set(cacheKey, JSON.stringify(payload), env.CACHE_TTL_TTS_SECONDS);
        return payload;
    }
}
export const sarvamService = new SarvamService();
logger.info("Sarvam speech client initialized");
