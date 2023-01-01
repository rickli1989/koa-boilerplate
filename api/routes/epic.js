import IG from "+lib/node-ig-api/index.es6";

export default (router) => {
	router.get("/epic/:epic", async (ctx) => {
		const data = await IG.getInstance(ctx.tokens).epicDetail(ctx.params.epic);
		ctx.body = data;
	});

	router.get("/epic", async (ctx) => {
		const data = await IG.getInstance(ctx.tokens).search(ctx.query.searchTerm);
		ctx.body = data;
	});
};
