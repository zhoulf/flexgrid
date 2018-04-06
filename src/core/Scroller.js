var throttle = function(fn, time) {
	var timer = null;
	return function(...args) {
		if (timer) clearTimeout(timer);

		timer = setTimeout(() => {
			fn.apply(null, args);
		}, time);
	}
}

class Scroller {
	constructor(lineHeight, bufferZone) {

		this.bufferZone = bufferZone;
		this.yDir = 0; // 1:向上，0,-1:向下
		this.yPreIndex = 0; // 上一个位置
		this.lineHeight = lineHeight;

		this.xDir = 0; // 1：向左，0，-1：向右
		this.xPreIndex = 0; // 前一个位置

		this._triggerX = x => x;
		this._triggerY = y => y;

	}

	onX(callback) {
		this._triggerX = x => {
			if (x === this.xPreIndex) {
				return;
			}

			this.xDir = x - this.xPreIndex;
			this.xPreIndex = x;

			callback(x);
		};

		return this;
	}

	onY(handler, delay) {
		// TODO
		// var dealyFn = throttle(handler, delay);

		this._triggerY = throttle((y) => {
			this.yDir = y - this.yPreIndex;
			this.yPreIndex = y;

			var index = ~~(y/ this.lineHeight);
			var willLoad = this.bufferZone.shouldLoad(this.yDir, index);

			if (willLoad) {
				// dealyFn();
				handler(
					this.yDir > 0 ? 1 : -1,
					this.bufferZone.domain,
					this.bufferZone.start,
					this.bufferZone.end,
					index,
					this.bufferZone.total
				);
			}
		}, delay);

		return this;
	}

	fireX(x) {
		this._triggerX(x);
	}

	fireY(y) {
		this._triggerY(y);
	}


}

module.exports = Scroller;