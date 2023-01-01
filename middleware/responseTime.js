export default () => {
  return function* responseTime(next) {
    var start = Date.now();
    yield next;
    var delta = Date.now() - start;
    this.set("X-Response-Time", delta + "ms");
  };
};
