import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.sgapps.ativhub",
  appName: "AtivHub",
  webDir: "www",
  server: {
    url: "https://ativhub.sgapps.org",
    errorPath: "offline.html",
    cleartext: false,
    androidScheme: "https",
  },
};

export default config;
