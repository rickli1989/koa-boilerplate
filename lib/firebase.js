import fs from "fs";
import path from "path";
import * as admin from "firebase-admin";

class Firebase {
	static instance;

	constructor() {
		const firebaseConfig = fs.readFileSync(
			path.join(__dirname, "../", process.env.FIREBASE_CONFIG),
			"utf8"
		);
		admin.initializeApp(JSON.parse(firebaseConfig));
		this.db = admin.firestore();
		return this.db;
	}

	static getInstance() {
		if (!Firebase.instance) {
			Firebase.instance = new Firebase();
		}

		return Firebase.instance;
	}
}

export default Firebase.getInstance();
