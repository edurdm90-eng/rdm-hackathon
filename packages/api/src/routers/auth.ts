import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  resolveLoginEmailAccess,
} from "../../../auth/src/login-restriction.js";
import { client } from "../../../db/src/index.js";
import { publicProcedure, router } from "../index.js";

const loginEmailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

export const authRouter = router({
  checkLoginEmail: publicProcedure
    .input(loginEmailSchema)
    .mutation(async ({ input }) => {
      const access = await resolveLoginEmailAccess(input.email, client);

      if (!access.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: access.message,
          cause: {
            code: access.code,
          },
        });
      }

      return {
        allowed: true,
      };
    }),
});
