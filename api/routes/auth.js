"use strict";
import * as admin from "firebase-admin";
import { DB } from "+config";
import jwt from "jsonwebtoken";
import stream from "../../lib/stream";
import fetch from "node-fetch";

export default (router) => {
	router.post("/auth/login", async (ctx) => {
		const response = await fetch(
			`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.GOOGLE_AUTH_API_KEY}`,
			{
				method: "post",
				body: JSON.stringify(ctx.request.body),
				headers: { "Content-Type": "application/json" },
			}
		);
		const data = await response.json();
		if (data.error) {
			throw new Error(data.error.message);
		}
		const decodedIdToken = await admin.auth().verifyIdToken(data.idToken);
		const user = decodedIdToken;
		const res = await admin
			.firestore()
			.collection(DB.COLLECTION_USERS)
			.doc(user.uid)
			.get();

		const igCredentials = res.data()[process.env.NODE_ENV];
		if (!igCredentials) {
			throw Error("Please set up IG credentials first");
		}
		await stream.getInstance(igCredentials).initToken();
		const tokensRef = await admin
			.firestore()
			.collection("tokens")
			.doc(`${igCredentials.IG_IDENTIFIER}`)
			.get();
		const jwtToken = jwt.sign(tokensRef.data(), process.env.JWT_SECRET);
		ctx.body = {
			idToken: data.idToken,
			jwtToken,
		};
	});
};
