function swap(arr, s1, s2) {
	var temp = arr[s1];
	arr[s1] = arr[s2];
	arr[s2] = temp;
}

function randomValue(arr) {
	var r = Math.floor(Math.random() * arr.length);
	// swap(arr, 0, r);
	return [arr[r], arr.filter((d, i) => i !== r)];
}

function filterLAndR(arr, select, compareFn) {
	var leftArr = [];
	var rightArr = [];

	for (var i = 0, len = arr.length; i < len; i++) {
		let temp = arr[i];
		let compared = compareFn(select, temp);
		if (compared > 0) rightArr.push(temp);
		else if (compared < 0) leftArr.push(temp);
		else Math.random() > 0.5 ? rightArr.push(temp) : leftArr.push(temp);
	}

	return [leftArr, rightArr];
}

function findIndex(arr, index, compareFn) {
	if (arr.length <= 1 || index === 0) return arr[0];
	var [select, sec_arr] = randomValue(arr);
	var [leftArr, rightArr] = filterLAndR(sec_arr, select, compareFn);
	var n = rightArr.length;

	if (n === index - 1) return select;
	if (n >= index) return findIndex(rightArr, index, compareFn);
	else return findIndex(leftArr, index - n - 1, compareFn);
}

module.exports = findIndex;