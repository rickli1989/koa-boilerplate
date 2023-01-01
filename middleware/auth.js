const admin = require("firebase-admin");
const R = require("ramda");
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
			const idToken = ctx.request.headers.authorization.split("Bearer ")[1];
			try {
				const decodedIdToken = await admin.auth().verifyIdToken(idToken);
				// const uid = decodedIdToken.uid;
				ctx.user = decodedIdToken;
				if (
					!ctx.request.url.startsWith("/api/auth/login")
					//  &&
					// !ctx.request.url.startsWith("/api/user")
				) {
					const decodedIGToken = jwt.verify(
						ctx.request.headers["x-ig-token"],
						process.env.JWT_SECRET
					);
					ctx.tokens = JSON.parse(decodedIGToken.token);
				}
				await next();
			} catch (e) {
				throw e;
			}
		}
	};
};
