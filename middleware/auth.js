import jwt from "jsonwebtoken";

export default () => {
  return async function authenticate(ctx, next) {
    if (
      ctx.request.url.startsWith("/api/health/ping") ||
      ctx.request.url.startsWith("/api/auth/login") ||
      (ctx.request.url.startsWith("/api/user") && ctx.request.method === "POST")
    ) {
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
        if (!ctx.request.url.startsWith("/api/auth/login")) {
          const decodedIGToken = jwt.verify(bearToken, process.env.JWT_SECRET);
        }
        await next();
      } catch (e) {
        throw e;
      }
    }
  };
};
