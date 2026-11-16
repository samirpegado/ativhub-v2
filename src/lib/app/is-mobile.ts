/**
 * Casca do app nativo. Permanece false no site publicado.
 * A WebView do Capacitor também liga a barra de baixo, sem outro deploy.
 */
export const isMobile = false;

type CapacitorWindow = Window & {
  Capacitor?: { isNativePlatform?: () => boolean };
};

export function isNativeShell() {
  if (isMobile) return true;
  if (typeof window === "undefined") return false;
  return (window as CapacitorWindow).Capacitor?.isNativePlatform?.() === true;
}
