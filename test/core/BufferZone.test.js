const assert = require('assert');
const BufferZone = require('../../src/core/BufferZone');


describe('BufferZone', function() {
	let bz;

	before(() => {});

	beforeEach(() => {
		let limit = 10;
		let total = 100;
		let cacheTimes = 3;

		bz = new BufferZone(limit, total, cacheTimes);
	});

	after(() => {});
	afterEach(() => {});

	it('shouldLoad(dir, vernier):方向不变', function() {
		assert.strictEqual(bz.shouldLoad(0), false);
	});

	it('shouldLoad(dir, vernier):向下,当前位置5,10', function() {
		
		assert.strictEqual(bz.shouldLoad(1, 5), true);
		assert.strictEqual(bz.shouldLoad(1, 10), false);
	});

	it('shouldLoad(dir, vernier):向上,当前位置5, 10', function() {
		assert.strictEqual(bz.shouldLoad(-1, 5), false);
		assert.strictEqual(bz.shouldLoad(-1, 10), false);
	});

	it('shouldLoad(dir, vernier):快速向下,当前位置50', function() {
		assert.strictEqual(bz.shouldLoad(1, 50), true);
	});

	it('shouldLoad(dir, vernier):快速向下,当前位置100,游标到达结尾,再向上95，90', function() {
		assert.strictEqual(bz.shouldLoad(1, 100), true);

		assert.strictEqual(bz.shouldLoad(-1, 95), false);
		assert.strictEqual(bz.shouldLoad(-1, 90), false);
	});

});