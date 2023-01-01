export default () => {
	return function* token(next) {
		try {
			yield next;
		} catch (e) {
			this.status = e.status || e.output?.statusCode || 500;
			this.body = {
				errorMsg: e.message || e.body,
			};
			this.app.emit("error", e);
		}
	};
};
