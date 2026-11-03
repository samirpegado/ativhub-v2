export function asaasConfig() {
  const isProd = Deno.env.get("ASAAS_IS_PROD") === "true";
  const apiKey = Deno.env.get(isProd ? "ASAAS_API_KEY_PROD" : "ASAAS_API_KEY_SANDBOX");
  const baseUrl = isProd ? "https://api.asaas.com" : "https://api-sandbox.asaas.com";
  return { isProd, apiKey, baseUrl, env: isProd ? "prod" : "sandbox" };
}
