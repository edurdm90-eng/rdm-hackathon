import { protectedProcedure, publicProcedure, router } from "../index";
import { hackRoomRouter } from "./hack-room";

export const appRouter = router({
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
