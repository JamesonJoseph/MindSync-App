import { Stack } from "expo-router";
import { VaultProvider } from "./contexts/VaultContext";

export default function RootLayout() {
  return (
    <VaultProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </VaultProvider>
  );
}
