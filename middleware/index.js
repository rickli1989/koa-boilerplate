"use strict";

import compose from "koa-compose";
import convert from "koa-convert";
import logger from "koa-logger";
import helmet from "koa-helmet";
import cors from "kcors";
import bodyParser from "koa-bodyparser";
import ping from "koa-ping";
import compress from "koa-compress";
import token from "./token";
import auth from "./auth";
import responseTime from "./responseTime";
import { timeout } from "koa-timeout-middleware";

export default function middleware() {
  return compose([
    compress(),
    logger(),
    helmet(), // reset HTTP headers (e.g. remove x-powered-by)
    bodyParser(),
    timeout(60000, { status: 499 }),
    convert(ping()),
    convert(responseTime()),
    convert(cors()),
    convert(token()),
    auth(),
  ]);
}
