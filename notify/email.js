class Mail {
	constructor(mailer, systemUtil, logger) {
		this.mailer = mailer;
		this.systemUtil = systemUtil;
		this.logger = logger;
	}

	send(message) {
		const to = this.systemUtil.getConfig("notify.mail.to");
		if (!to) {
			this.logger.error('No mail "to" address given');

			return;
		}
    for(let email of to) {
      this.mailer.sendMail(
        {
          to: email,
          subject: `IG-Notifier`,
          text: message,
        },
        (err) => {
          if (err) {
            this.logger.error(`Mailer: ${JSON.stringify(err)}`);
          }
        }
      );
    }
	}
}

module.exports = Mail;
