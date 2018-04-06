class BufferZone {
	constructor(limit, total, cacheTimes) {
		this.init(limit, total, cacheTimes);
	}

	init(limit, total, cacheTimes) {
		this.start = 0;
		this.end = this.limit = limit;
		this.total = +total;
		this.cacheTimes = cacheTimes || 3;
		this.domain = [this.start, this.end];
	}

	setLimit(limit) {
		if (+limit > 0) {
			this.init(limit, this.total);
		}
	}

	setTotal(total) {
		if (+total >= 0) {
			this.total = total;
		}
	}

	isAmong(value) {
		return this.start <= value && value <= this.end;
	}

	shouldLoad(dir, vernier) {
		if (dir === 0) return false;

		var start = this.start;
		var end = this.end;
		var cacheTimes = this.cacheTimes;

		// scroll up
		if (dir < 0 && start === 0) return false;
		if (dir < 0 && vernier < start + this.limit) {
			if (this.isAmong(vernier)) {
				end = start - 1;
				start = Math.max(0, end - this.limit);
			} else if (vernier === 0) {
				end = Math.min(this.total, vernier + cacheTimes * this.limit);
				start = 0;
			} else {
				end = vernier + this.limit;
				start = Math.max(0, vernier - (cacheTimes - 1) * this.limit);
			}

			this.domain = [start, end];
			this.start = start;
			this.end = Math.min(start + cacheTimes * this.limit, this.end);
			return true;
		}

		// scroll down
		if (dir > 0 && end === this.total) return false;
		if (dir > 0 && vernier > end - this.limit) {
			// 游标在现有范围内
			if (this.isAmong(vernier)) {
				start = end + 1;
				end = Math.min(this.total, start + this.limit);
			}
			// 游标到达结尾
			else if (vernier === this.total) {
				end = this.total;
				start = Math.max(0, vernier - cacheTimes * this.limit);
			}
			// 不在现有范围又未到结尾处
			else {
				end = Math.min(this.total, vernier + (cacheTimes - 1) * this.limit);
				start = Math.max(0, end - cacheTimes * this.limit);
			}

			this.domain = [start, end];
			this.end = end;
			this.start = Math.max(this.start, end - cacheTimes * this.limit);
			return true;
		}

		return false;
	}

}

module.exports = BufferZone;