"use strict";
import Services from "../../modules/services";

export default (router) => {
	router.post("/binance/orderBook", async (ctx) => {
		const symbol = ctx.request.body;
		const exchanges = await Services.getExchanges();
		const binanceExchange = exchanges.find(
			(exchange) => exchange.getName() === "binance"
		);
		ctx.body = await binanceExchange.client.book(symbol);
	});
};
