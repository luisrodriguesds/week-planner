import path from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../dist/client");

export async function registerStatic(app: FastifyInstance): Promise<void> {
  await app.register(fastifyStatic, {
    root: clientRoot,
    prefix: "/",
  });

  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({ error: "not_found", message: "Route not found" });
    }
    return reply.sendFile("index.html");
  });
}
