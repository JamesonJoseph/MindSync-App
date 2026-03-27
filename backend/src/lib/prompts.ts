import { readFileSync } from "node:fs";
import path from "node:path";
import { appPaths } from "../config/env.js";

const promptCache = new Map<string, string>();

export function loadPrompt(name: string): string {
  const promptPath = path.join(appPaths.promptsDir, name);
  const cached = promptCache.get(promptPath);
  if (cached) {
    return cached;
  }

  const prompt = readFileSync(promptPath, "utf8").trim();
  promptCache.set(promptPath, prompt);
  return prompt;
}

export function renderPrompt(template: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce((output, [key, value]) => {
    return output.replaceAll(`{{${key}}}`, value);
  }, template);
}
