import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/auto-close-conversations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Hanya penjadwal internal (pg_cron) yang boleh memanggil endpoint ini.
        const expected = process.env["AUTO_CLOSE_CRON_TOKEN"];
        const token = /^Bearer ([^\s,]+)$/.exec(
          request.headers.get("authorization") ?? "",
        )?.[1];
        if (!expected || !token || token !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { closeIdleConversations } = await import("@/lib/auto-close.server");
        try {
          const result = await closeIdleConversations();
          return new Response(JSON.stringify(result), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("Auto-close gagal", err);
          return new Response(JSON.stringify({ error: "Auto-close failed" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
