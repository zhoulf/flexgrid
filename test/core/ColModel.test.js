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

	it('move(colM, toIndex):向右移动列', function() {
		let colM = cm.getColumnByDataIndex('MRYC');
		
		colM.moveTo(1);
		assert.equal(cm.columns.indexOf(colM), 1);
		
		colM.moveTo(2);
		assert.equal(cm.columns.indexOf(colM), 2);

		colM.moveTo(5);
		assert.equal(cm.columns.indexOf(colM), 5);

		colM.moveTo(4);
		assert.equal(cm.columns.indexOf(colM), 5);

		colM.moveTo(0);
		assert.equal(cm.columns.indexOf(colM), 1);

		colM.moveTo(8);
		assert.equal(cm.columns.indexOf(colM), 8);
	});

	it('move(colM, toIndex):向左移动列', function() {
		let colM = cm.getColumnByDataIndex('MRYC');
		
		colM.moveTo(10);
		assert.equal(cm.columns.indexOf(colM), 10);
		
		colM.moveTo(2);
		assert.equal(cm.columns.indexOf(colM), 3);

		colM.moveTo(5);
		assert.equal(cm.columns.indexOf(colM), 5);

		colM.moveTo(4);
		assert.equal(cm.columns.indexOf(colM), 5);

		colM.moveTo(0);
		assert.equal(cm.columns.indexOf(colM), 1);

		colM.moveTo(8);
		assert.equal(cm.columns.indexOf(colM), 8);
	});

});