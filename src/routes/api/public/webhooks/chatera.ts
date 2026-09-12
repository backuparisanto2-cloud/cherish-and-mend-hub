import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/chatera")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleChateraWebhook } = await import("@/lib/chatera-webhook.server");
        return handleChateraWebhook(request);
      },
    },
  },
});
