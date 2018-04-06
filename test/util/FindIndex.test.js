var FindIndex = require('../../src/util/FindIndex');
var {createData} = require('../../data/data');
var _ = require('lodash');

var data = createData(2000);
var maxVal = _.maxBy(data, 'CJGS');
var minVal = _.minBy(data, 'CJGS');

var targetMax = FindIndex(data, 1,  (b, a) => { return a.CJGS - b.CJGS });
var targetMin = FindIndex(data, 1,  (a, b) => { return a.CJGS - b.CJGS });

console.log(maxVal.CJGS === targetMax.CJGS);
console.log(minVal.CJGS === targetMin.CJGS);

var data2 = [1,2,3,4,5,6,7,8,9,10];
var cloneData2 = _.clone(data2);

var target2 = FindIndex(data2, 6, (a, b) => a - b);

console.log(_.isEqual(data2, cloneData2));
console.log(data2, cloneData2);

