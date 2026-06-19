import { env } from "@rdm-hack/env/server";
import mongoose from "mongoose";

await mongoose.connect(env.DATABASE_URL, {
  dbName: env.DATABASE_NAME,
});

const client = mongoose.connection.getClient().db(env.DATABASE_NAME);

export { client };
