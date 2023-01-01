class SMS {
	constructor(sms, systemUtil, logger) {
		this.sms = sms;
		this.systemUtil = systemUtil;
		this.logger = logger;
	}

	send(msgBody) {
		try {
      const from = this.systemUtil.getConfig("notify.sms.from");
      const to = this.systemUtil.getConfig("notify.sms.to");
			console.log("SENDING MESSAGE > ........");
			for (let phone of to) {
				this.sms.messages
					.create({
						body: msgBody,
						from: from,
						to: phone,
					})
					.then((message) => console.log(message.sid))
					.catch((e) => console.error(e));
			}
		} catch (e) {
			console.error(e);
		}
	}
}

module.exports = SMS;
