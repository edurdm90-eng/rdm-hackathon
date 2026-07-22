import { env } from "@rdm-hack/env/web";

export const serverUrl = env.VITE_SERVER_URL.replace(/\/+$/, "");
