var GridView = require('../core/GridView');

const CELL_CLS = 'li.c-grid-cell';
const CELL_SELECTED_CLS = 'c-cell-selected';
const ROW_CLS = '.c-grid-row';

class Selection extends GridView {

	constructor(options) {
		super(options);

		this._defaults();
	}

	_defaults() {
		this._moving = false;
		this._start = null;
		this._end = null;
		this._lastY = null;

		this._selection = [];
		this._selectY = [];
		// this._selectDataIndex = [];
		this._selectColumns = [];
	}

	getSelection() {
		return this._selection;
	}

	/**
	 * 复制选框内容
	 * @param {Object} info -{columnId, rowIndex}
	 */
	copySelection(info) {
		if (!this.isInRange(info)) {
			return false;
		}

		let values = this._copyContent();

		let ta = $('<textarea>').val(values).appendTo(this.$dom.header).focus();
		ta.get(0).setSelectionRange(0, values.length);
		document.execCommand('copy', true);
		ta.remove();
	}

	isInRange(info) {
		return this._selectColumns.indexOf(info.columnId) !== -1
			&& info.rowIndex >= this._selectY[0]
			&& info.rowIndex <= this._selectY[1]
	}

	_copyContent() {
		let cols = this._selectColumns.map(cid => {
			// let col = this.columnModel.getColumnByDataIndex(dataIndex);
			let col = this.columnModel.getColumnsById(cid)

			if (!col) { throw `not find columnId: ${cid} in columns` };

			return col;
		});

		let values = cols.map(col => pickText(col.text)).join('\t');

		this._selection.forEach(row => {
			values += '\r\n';

			row.forEach((value, i) => {
				values += pickText(cols[i].renderer(value, { rowIndex: 0}, { data: row })) + '\t';
			});
		});

		return values;
	}
	
	_bindEvent() {
		super._bindEvent();

		let self = this;

		this.columnModel.on('notice-colModel-sort-changed', () => {
			this._defaults();
		});

		this.columnModel.on('column-moved', () => {
			this._defaults();
			this.$dom.canvas.find(CELL_CLS).removeClass(CELL_SELECTED_CLS);
		});

		this.$dom.canvas
			.on('mousedown', CELL_CLS, function(evt) {
				if (evt.button === 0) {
					self.$dom.canvas.find(CELL_CLS).removeClass(CELL_SELECTED_CLS);
					self._moving = true;
					let $cell = $(this).addClass(CELL_SELECTED_CLS);
					self._start = self._end = [$cell.data('cid'), +$cell.parent(ROW_CLS).attr('rid')];
					// console.log(start);
				} 
				else if (evt.button === 2) {
					
				}
			})
			.on('mouseenter', CELL_CLS, function(evt) {
				if (self._moving) {
					let $cell = $(this);
					
					$cell.addClass(CELL_SELECTED_CLS);
					self._end = [$cell.data('cid'), +$cell.parent(ROW_CLS).attr('rid')];

					self.selectionRange(self._start, self._end);
				}
			})
			.on('mouseup', function(evt) {
				self._moving = false;
				// console.log(end);
				console.log(self._selection);
				// TODO
				// copy($('.cell.selected'));
			});

		this.bufferNode.on('row-update-before', (rowNode, row) => {
			// console.log(rowNode.$node, row.rid, this._selectY);

			if (this._selection.length === 0) return false;
			
			let i = row.rid;
			let [y0, y1] = this._selectY;
			// let cols = this._selectDataIndex;
			let cols = this._selectColumns;

			if (i >= y0 && i < y1 + 1) {
				cols.forEach((col) => {
					rowNode.children.forEach(($cell, colM) => {
						if (cols.indexOf(colM.cid) != -1) {
							$cell.addClass(CELL_SELECTED_CLS);
						} else {
							$cell.removeClass(CELL_SELECTED_CLS);
						}
					});
				});
			} else {
				rowNode.$node.find(CELL_CLS).removeClass(CELL_SELECTED_CLS);
			}

		});
		
	}

	selectionRange([x0, y0], [x1, y1]) {

		let yDir = y1 - y0;
		let lastY = this._lastY;
			
		// yRange = { last: , now: [y0, y1] };
		// [l0, l1]
		// [y0, y1]
		// [l0, l1]
		let removeYRange = [];
		// down
		if (yDir >= 0 && y1 < lastY) {
			removeYRange = [y1, lastY];
		}
		// up
		if (yDir <= 0 && y1 > lastY) {
			removeYRange = [lastY, y1];
		}
		
		this._lastY = y1;
		// console.log(yDir, removeYRange);

		// let dataIndex = this.getLockAndVisiableColumnAsDataIndex();
		let columnIds = this.getLockAndVisiableColumnAsCid();
		// [x0, y0, x1, y1] = orderBy(x0, y0, x1, y1, dataIndex);
		[x0, y0, x1, y1] = orderBy(x0, y0, x1, y1, columnIds);


		// let cols = this._selectDataIndex = dataIndex.slice(dataIndex.indexOf(x0), dataIndex.indexOf(x1)+1);
		let cols = this._selectColumns = columnIds.slice(columnIds.indexOf(x0), columnIds.indexOf(x1)+1);
		// console.log(cols);

		this._selectY = [y0, y1 + 1];
		let rows = this.store.slice(y0, y1 + 1);

		this._selection = rows.map(row => {
			return cols.map(col => {
				return row.data[this.columnModel.getColumnsById(col).dataIndex];
			});
		});

		this._rePaintNode(yDir, y0, y1, removeYRange, cols);
	}

	_rePaintNode(yDir, y0, y1, removeYRange, cols) {
		let nodeList = this.bufferNode.getNodeList();
		nodeList.forEach((rowNode) => {
			let $row = rowNode.$node;
			let i  = +$row.attr('rid');
			
			if (i >= y0 && i < y1 + 1) {
				cols.forEach((col) => {
					rowNode.children.forEach(($cell, colM) => {
						if (cols.indexOf(colM.cid) != -1) {
							$cell.addClass(CELL_SELECTED_CLS);
						} else {
							$cell.removeClass(CELL_SELECTED_CLS)
						}
					});
				});
			}

			if (yDir >= 0 && i > removeYRange[0] && i <=removeYRange[1] ) {
				$row.find(CELL_CLS).removeClass(CELL_SELECTED_CLS);
			}
			if (yDir <= 0 && i >= removeYRange[0] && i <removeYRange[1] ) {
				$row.find(CELL_CLS).removeClass(CELL_SELECTED_CLS);
			}

		});
	}

	/*
	 * lock + visiable = columns
	 * @param {Array} columns -[dataIndex...]
	 */
	// getLockAndVisiableColumnAsDataIndex() {
	// 	let cols = [];

	// 	this.lockColManager
	// 		.visibleLockColumn
	// 		.each(colM => cols.unshift(colM.dataIndex));

	// 	let visiableCols = this.columnModel
	// 		.getVisibleColumn()
	// 		.map(colM => colM.dataIndex)
	// 		.filter(dataIndex => cols.indexOf(dataIndex) == -1);

	// 	return cols.concat(visiableCols);
	// }

	/*
	 * lock + visiable = columns
	 * @param {Array} columns -[dataIndex...]
	 */
	getLockAndVisiableColumnAsCid() {
		let cols = [];

		this.lockColManager
			.visibleLockColumn
			.each(colM => cols.unshift(colM.cid));

		let visiableCols = this.columnModel
			.getVisibleColumn()
			.map(colM => colM.cid)
			.filter(cid => cols.indexOf(cid) == -1);

		return cols.concat(visiableCols);
	}

	destory() {
		super.destory();

		this._defaults();
	}

}


function swap(a, b) {
	return [b, a];
}

function orderBy(x0, y0, x1, y1, colIds) {
	if (colIds.indexOf(x0) > colIds.indexOf(x1)) {
		[x0, x1] = swap(x0, x1);
	}
	if (y0 > y1) {
		[y0, y1] = swap(y0, y1);
	}

	return [x0, y0, x1, y1];
}

function pickText(fragment) {
	var htmlString = new RegExp('\<.+?\>', 'g');
	if (htmlString.test(fragment)) {
		return fragment.replace(htmlString, '');
	}

	return fragment;
}

module.exports = Selection;