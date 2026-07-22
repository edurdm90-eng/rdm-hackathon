import { protectedProcedure, publicProcedure, router } from "../index.js";
import { authRouter } from "./auth.js";
import { hackRoomRouter } from "./hack-room.js";

export const appRouter = router({
  auth: authRouter,
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  hackRoom: hackRoomRouter,
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
});
export type AppRouter = typeof appRouter;
