const assert = require('assert');
const ColModel = require('../../src/core/ColModel');
const {columns} = require('../mockData');

describe('ColModel', function() {
	let cm;

	before(() => {});

	beforeEach(() => {
		let limit = 10;
		let total = 100;
		let cacheTimes = 3;

		cm = new ColModel(columns);
	});

	after(() => {});
	afterEach(() => {});

	it('addColumns(columns):添加列', function() {
		let len = columns.length;
		assert.equal(len, cm.size());

		cm.addColumns({ dataIndex: 'new_column', text: '新创建列' });
		assert.equal(len + 1, cm.size());
	});

	it('removeColumn(dataIndex):删除列', function() {
		let len = columns.length;
		assert.equal(len, cm.size());

		cm.removeColumn('MRYC');
		assert.equal(len - 1, cm.size());
	});

});