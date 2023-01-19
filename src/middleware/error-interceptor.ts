import { PrismaClientKnownRequestError } from "@prisma/client/runtime";
import { Middleware } from "koa";

export default (): Middleware => {
  return async function errorInterceptor(ctx, next) {
    try {
      await next();
    } catch (e: any) {
      if (e instanceof PrismaClientKnownRequestError) {
        //Prisma DB validation error
        ctx.status = 400;
        ctx.body = { error: e.meta, code: e.code, message: "Invalid data" };
      } else {
        //Boom error or custom error
        ctx.status = e.isBoom ? e.output.statusCode : e.status ?? 400;
        ctx.body = {
          error: e.isBoom ? e.output.payload.message : e.message,
        };
      }
      ctx.app.emit("error", e);
    }
  };
};
