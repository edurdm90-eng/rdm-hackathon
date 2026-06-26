import mongoose from "mongoose";

import { env } from "../../env/src/server.js";

await mongoose.connect(env.DATABASE_URL, {
  dbName: env.DATABASE_NAME,
} as mongoose.ConnectOptions);

const client = mongoose.connection.getClient().db(env.DATABASE_NAME);

export { client };
