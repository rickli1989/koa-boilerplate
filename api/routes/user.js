"use strict";
import * as admin from "firebase-admin";
import { DB } from "+config";
import fetch from "node-fetch";

export default (router) => {
	router.get("/user", async (ctx) => {
		const snapShot = await admin
			.firestore()
			.collection(DB.COLLECTION_USERS)
			.doc(ctx.user.uid)
			.get();

		ctx.body = snapShot.data();
	});

	router.post("/user", async (ctx) => {
		const response = await fetch(
			`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.GOOGLE_AUTH_API_KEY}`,
			{
				method: "post",
				body: JSON.stringify(ctx.request.body.loginCredentials),
				headers: { "Content-Type": "application/json" },
			}
		);
		const data = await response.json();

		const decodedIdToken = await admin.auth().verifyIdToken(data.idToken);
		const user = decodedIdToken;

		let res = null;
		const snapShot = await admin
			.firestore()
			.collection(DB.COLLECTION_USERS)
			.doc(user.uid)
			.get();

		if (!!ctx.request.body.igCredentials.IG_DEMO === false) {
			if (snapShot.exists) {
				res = await admin
					.firestore()
					.collection(DB.COLLECTION_USERS)
					.doc(user.uid)
					.update({ prod: ctx.request.body.igCredentials });
			} else {
				res = await admin
					.firestore()
					.collection(DB.COLLECTION_USERS)
					.doc(user.uid)
					.set({ prod: ctx.request.body.igCredentials });
			}
		} else {
			if (snapShot.exists) {
				res = await admin
					.firestore()
					.collection(DB.COLLECTION_USERS)
					.doc(user.uid)
					.update({ demo: ctx.request.body.igCredentials });
			} else {
				res = await admin
					.firestore()
					.collection(DB.COLLECTION_USERS)
					.doc(user.uid)
					.set({ demo: ctx.request.body.igCredentials });
			}
		}
		ctx.body = res;
	});
};
