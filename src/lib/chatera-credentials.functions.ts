import { createServerFn } from "@tanstack/react-start";

/**
 * Hanya melaporkan APAKAH kredensial Chatera sudah tersimpan sebagai secret di server.
 * Nilai secret tidak pernah dikirim ke browser maupun disimpan di database.
 */
export const getChateraCredentialStatus = createServerFn({ method: "GET" }).handler(async () => {
  const apiKey = process.env["CHATERA_API_KEY"] ?? "";
  const webhookSecret = process.env["CHATERA_WEBHOOK_SECRET"] ?? "";
  const aiApiKey = process.env["JTG_AI_API_KEY"] ?? "";

  return {
    apiKeyConfigured: apiKey.trim().length > 0,
    webhookSecretConfigured: webhookSecret.trim().length > 0,
    aiApiKeyConfigured: aiApiKey.trim().length > 0,
  };
});
