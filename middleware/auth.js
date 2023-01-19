import jwt from "jsonwebtoken";

export default () => {
  return async function authenticate(ctx, next) {
    if (ctx.request.url.startsWith("/api/health/ping")) {
      await next();
    } else {
      if (
        !ctx.request.headers.authorization ||
        !ctx.request.headers.authorization.startsWith("Bearer ")
      ) {
        throw Error("Unauthorized");
      }
      const bearToken = ctx.request.headers.authorization.split("Bearer ")[1];
      try {
        jwt.verify(bearToken, process.env.JWT_SECRET);
        await next();
      } catch (e) {
        throw e;
      }
    }
  };
};
