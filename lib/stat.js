import _ from "lodash";
import services from "../modules/services";

const StatUserList = {};

class Stat {
  static instance;
  MIN_GAP = 10;
  MIN_ARRAY_LENGTH = 10;
  MIN_TIME_SPAN = 10000; //10 seconds
  constructor(identifier) {
    this.identifier = identifier;
    this.data = {
      [this.identifier]: {},
    };
    this.lastSentTime = {
      [this.identifier]: {},
    };
  }

  static getInstance(identifier) {
    if (StatUserList[identifier]) {
      return StatUserList[identifier];
    } else {
      StatUserList[identifier] = new Stat(identifier);
      return StatUserList[identifier];
    }
  }

  record(subscription) {
    const epic = subscription[1];
    const bid = subscription[2];
    if (epic.startsWith("OP")) {
      //check only for option
      if (this.data[this.identifier][epic]) {
        this.data[this.identifier][epic].push(parseFloat(bid));
        if (this.data[this.identifier][epic].length >= this.MIN_ARRAY_LENGTH) {
          const min = Math.min.apply(null, this.data[this.identifier][epic]);
          const max = Math.max.apply(null, this.data[this.identifier][epic]);
          if (max - min >= this.MIN_GAP && min !== 0) {
            if (
              this.lastSentTime[this.identifier][epic] === null ||
              new Date().getTime() - this.lastSentTime[this.identifier][epic] >
                this.MIN_TIME_SPAN
            ) {
              this.lastSentTime[this.identifier][epic] = new Date().getTime();
              const minIndex = this.data[this.identifier][epic].findIndex(
                (d) => d === min
              );
              const maxIndex = this.data[this.identifier][epic].findIndex(
                (d) => d === max
              );
              //Send alert
              if (maxIndex > minIndex) {
                services
                  .getNotifier()
                  .send(
                    `Current ${epic} experiencing a big jump over ${this.MIN_GAP} points from Min: ${min} to Max: ${max}`
                  );
              } else {
                services
                  .getNotifier()
                  .send(
                    `Current ${epic} experiencing a big fall over ${this.MIN_GAP} points from Max: ${max} and Min: ${min}`
                  );
              }
            }
          }
          this.data[this.identifier][epic].splice(0, 1);
        }
      } else {
        this.data[this.identifier][epic] = [parseFloat(bid)];
      }
    }
  }
}

export default Stat;
