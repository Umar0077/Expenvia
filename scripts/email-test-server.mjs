import "dotenv/config";
import { spawn } from "node:child_process";
const url=process.env.DEMO_DATABASE_URL;
if(!url || !/demo/.test(new URL(url).pathname)) throw new Error("Demo database required");
const child=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","3002"],{stdio:"inherit",env:{...process.env,DATABASE_URL:url,APP_PUBLIC_URL:"http://localhost:3002",EMAIL_PROVIDER:"development",NEXT_DIST_DIR:".next-email-e2e"}});
child.on("exit",code=>process.exit(code??0));
