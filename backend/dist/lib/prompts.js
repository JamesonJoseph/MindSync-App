import { readFileSync } from "node:fs";
import path from "node:path";
import { appPaths } from "../config/env.js";
const promptCache = new Map();
export function loadPrompt(name) {
    const promptPath = path.join(appPaths.promptsDir, name);
    const cached = promptCache.get(promptPath);
    if (cached) {
        return cached;
    }
    const prompt = readFileSync(promptPath, "utf8").trim();
    promptCache.set(promptPath, prompt);
    return prompt;
}
export function renderPrompt(template, variables) {
    return Object.entries(variables).reduce((output, [key, value]) => {
        return output.replaceAll(`{{${key}}}`, value);
    }, template);
}
