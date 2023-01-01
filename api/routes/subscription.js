"use strict";
import stream from "../../lib/stream";

export default (router) => {
	router.get("/subscription", async (ctx) => {
		const data = await stream.getInstance(ctx.tokens).getSubscriptions();
		ctx.body = data;
	});

	router.post("/subscription", async (ctx) => {
		const subscription = await stream
			.getInstance(ctx.tokens)
			.createSubsription(ctx.request.body.epic);
		ctx.body = subscription;
	});

	router.del("/subscription", async (ctx) => {
		const data = await stream
			.getInstance(ctx.tokens)
			.deleteSubscription(ctx.request.body.epic);
		ctx.body = data;
	});
};
