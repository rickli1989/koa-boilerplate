import * as admin from "firebase-admin";
import { DB } from "+config";

export default (router) => {
	router.get("/warnings", async (ctx) => {
		const db = admin.firestore();
		const warningsRef = await db
			.collection(DB.COLLECTION_WARNINGS)
			.doc(ctx.tokens.IG_IDENTIFIER)
			.get();

		ctx.body = warningsRef.data();
	});

	router.post("/warnings", async (ctx) => {
		const db = admin.firestore();
		const res = await db
			.collection(DB.COLLECTION_WARNINGS)
			.doc(ctx.tokens.IG_IDENTIFIER)
			.set(
				{
					[ctx.request.body.epic]: ctx.request.body.bounds,
				},
				{ merge: true }
			);

		ctx.body = res;
	});

	router.delete("/warnings", async (ctx) => {
		const db = admin.firestore();
		const res = await db
			.collection(DB.COLLECTION_WARNINGS)
			.doc(ctx.tokens.IG_IDENTIFIER)
			.set(
				{
					[ctx.request.body.epic]: admin.firestore.FieldValue.delete(),
				},
				{ merge: true }
			);

		ctx.body = res;
	});
};
