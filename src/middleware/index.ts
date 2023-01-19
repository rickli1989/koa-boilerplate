import * as compose from "koa-compose";
import * as helmet from "koa-helmet";
import * as cors from "@koa/cors";
import body from "koa-body";
import interceptor from "./error-interceptor";

export default function middleware() {
  return compose([
    helmet(), // reset HTTP headers (e.g. remove x-powered-by)
    body(),
    cors(),
    interceptor(),
  ]);
}
