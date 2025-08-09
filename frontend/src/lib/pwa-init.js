export async function initPWA() {
  let manifest = undefined;
  const { pwaInfo } = await import("virtual:pwa-info");
  if (pwaInfo) {
    manifest = pwaInfo.webManifest;
  }
  const { useRegisterSW } = await import("virtual:pwa-register/svelte");
  useRegisterSW();
  return manifest;
}
