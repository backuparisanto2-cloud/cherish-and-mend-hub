import { createFileRoute } from "@tanstack/react-router";

// Alias of /api/public/webhooks/chatera so the documented path works too.
export const Route = createFileRoute("/api/webhooks/chatera")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleChateraWebhook } = await import("@/lib/chatera-webhook.server");
        return handleChateraWebhook(request);
      },
    },
  },
});
