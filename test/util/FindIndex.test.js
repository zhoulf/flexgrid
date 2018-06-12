const FindIndex = require('../../src/util/FindIndex');
const {createData} = require('../mockData');
const _ = require('lodash');
const assert = require('assert');


describe('FindIndex', function() {
	let dc;

	before(() => {});

	beforeEach(() => {

	});

	after(() => {});
	afterEach(() => {});

	it('find maxVal', function() {
		let data = createData(2000);
		let maxVal = _.maxBy(data, 'CJGS');

		let targetMax = FindIndex(data, 1,  (b, a) => { return a.CJGS - b.CJGS });

		assert.strictEqual(maxVal.CJGS, targetMax.CJGS);
	});

	it('find minVal', function() {
		let data = createData(2000);
		let minVal = _.minBy(data, 'CJGS');

		let targetMin = FindIndex(data, 1,  (a, b) => { return a.CJGS - b.CJGS });

		assert.strictEqual(minVal.CJGS, targetMin.CJGS);
	});

	it('find index', function() {
		let data2 = [1,2,3,4,5,6,7,8,9,10];
		let cloneData2 = _.clone(data2);

		let target2 = FindIndex(data2, 6, (a, b) => a - b);

		assert.equal(data2[5], target2);
	});

});




