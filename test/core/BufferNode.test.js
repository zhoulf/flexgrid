const assert = require('assert');
const ColModel = require('../../src/core/ColModel');
const {columns} = require('../mockData');
const BufferNode = require('../../src/core/BufferNode');


describe('BufferNode', function() {
	let bn;

	before(() => {});

	beforeEach(() => {
		let limit = 10;
		let total = 100;
		let cacheTimes = 3;
		let colsModel = new ColModel(columns);

		bn = new BufferNode(limit, colsModel, total, cacheTimes);
	});

	after(() => {});
	afterEach(() => {});

	it('get(dir, domain):获取节点区间', function() {
		// let needNodes = bn.get(1, [0, 10]);
		// let actualNodes = bn.getNodeList();

		// assert.strictEqual(needNodes.length, actualNodes.length);
	});

});