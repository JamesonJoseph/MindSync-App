export function getApiBaseUrl(): string {
  const rawValue = (process.env.EXPO_PUBLIC_API_URL || "").trim();
  if (!rawValue) {
    throw new Error(
      "EXPO_PUBLIC_API_URL is missing. Set MindSync_frontend/.env, e.g. EXPO_PUBLIC_API_URL=http://192.168.1.7:5000"
    );
  }
  return rawValue.replace(/\/+$/, "");
}
