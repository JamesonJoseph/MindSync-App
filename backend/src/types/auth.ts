import type { FastifyRequest } from "fastify";

export type AuthContext = {
  uid: string;
  email: string;
};

export type AuthenticatedRequest = FastifyRequest & {
  auth: AuthContext;
};
