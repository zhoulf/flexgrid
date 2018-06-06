(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.sz || (g.sz = {})).grid = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var EventEmitter = require('../util/EventEmitter');
var $ = require('../util/shim').$;

var defineDell = function(colM) {
	let cell = $('<li/>')
		.addClass('c-grid-cell')
		.addClass('c-align-' + colM.align)
		.addClass(() => colM.hidden ? 'c-column-hide' : '')
		.addClass(() => colM.locked ? 'c-column-locked' : '')
		.attr('tabindex', -1)
		.data('dataIndex', colM.dataIndex)
		.width(colM.width);

	return cell;
};

var createCell = function($row, colsModel) {
	var size = colsModel.size();
	var children = new Map();

	colsModel.each(colM => {
		let cell = defineDell(colM);

		$row.append(cell);
		children.set(colM, cell);
	});

	return children;
};

class RowNode extends EventEmitter {
	constructor(colsModel, context) {
		super();
		this.$vm = context;
		this.colsModel = colsModel;
		this.$node = $('<ul/>').addClass('c-grid-row');

		this.children = createCell(this.$node, colsModel);
		this._bindEvent(colsModel);
	}

	_bindEvent(colsModel) {
		this.colsModel.on('column-add', colM => {
			let cell = defineDell(colM);

			this.$node.append(cell);
			this.children.set(colM, cell);
		});

		this.colsModel.on('column-moved', (colM, index) => {
			let cell = this.children.get(colM);
			cell.after(this.$node.find('li.c-grid-cell').eq(index));
		});

		colsModel.each(colM => {
			colM.on('column-resized', width => {
				// console.log(width);
				this.children.get(colM).outerWidth(width);
			});

			colM.on('column-hidden', isHidden => {
				let colEle = this.children.get(colM);
				if (isHidden) {
					colEle.addClass('c-column-hide');
				} else {
					colEle.removeClass('c-column-hide');
				}
			});

			colM.on('column-locked', isLocked => {
				let colEle = this.children.get(colM);

				if (isLocked) {
					colEle.addClass('c-column-locked');
				} else {
					colEle.removeClass('c-column-locked');
				}
			});

			colM.on('destory', () => {
				let colEle = this.children.get(colM);
				this.children.delete(colM);			
				colEle.remove();
			});
		});
	}

	setData(row, offsetTop) {
		// 这里如果用AOP方式实现更好TODO
		this.$vm.fire('row-update-before', this, row);

		var content;
		var cells = this.children;

		this.colsModel.each(colM => {

			content = colM.renderer(row.data[colM.dataIndex]);
			// TODO addClass(()=> row.cell[colM.dataIndex].selected)
			cells.get(colM).html(content);

		});

		this.$node.css('top', offsetTop).attr('rid', row.rid);

		return this.$node;
	}
}

class BufferNode extends EventEmitter {
	constructor(limit, colsModel, total, cacheTimes) {
		super();
		this.init(limit, colsModel, total, cacheTimes);
	}

	init(limit, colsModel, total, cacheTimes) {
		this.limit = limit;
		this.total = total;
		this.cacheTimes = cacheTimes || 3;
		this.nodeList = [];
		this.colsModel = colsModel;

		// 这里暂为Selection实现，应该用AOP维护 TODO
		// this.on('row-update-before', (rowNode, row) => this.fire('row-update', rowNode, row));
	}

	getNodeList() {
		return this.nodeList;
	}

	setLimit(limit) {
		if (+limit > 0) {
			this.init(limit, this.colsModel, this.total, this.cacheTimes);
			this.fire('buffer-initial');
		}
	}

	setTotal(total) {
		if (+total >= 0) {
			this.total = total;
		}
	}

	isEnough() {
		return this.nodeList.length >= Math.min(this.total, this.cacheTimes * this.limit);
	}

	get(dir, domain) {
		if (this.isEnough()) {
			return this._getNodes(dir, domain);
		}

		return this._addNodes(dir, domain);
	}

	_getNodes(dir, [start, end]) {
		var selected;

		if (dir > 0) {
			selected = this.nodeList.slice(0, end - start + 1);
			this.nodeList = this.nodeList.slice(end - start + 1).concat(selected);
		} else {
			selected = this.nodeList.slice(start - end - 1);
			this.nodeList = selected.concat(this.nodeList.slice(0, start - end - 1));
		}

		return selected || [];
	}

	_addNodes(dir, [start, end]) {
		var nodes = [];

		for (var i = start; i <= end; i++) {
			nodes.push(new RowNode(this.colsModel, this));
		}

		this.nodeList = dir > 0 ? this.nodeList.concat(nodes) : nodes.concat(this.nodeList);

		return nodes;
	}
}

module.exports = BufferNode;

},{"../util/EventEmitter":14,"../util/shim":17}],2:[function(require,module,exports){
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
},{}],3:[function(require,module,exports){
var EventEmitter = require('../util/EventEmitter');
var Utils = require('../util/Utils');
var _ = require('../util/shim')._;

var defRenderer = v => v;
var ORDER = ['ASC', 'DESC'];

class Column extends EventEmitter {
	constructor(cid, options, context) {
		super();

		options.renderer = options.renderer || defRenderer;

		var defaults = {
			'text': '',
			'vtype': 'string',
			'dataIndex': '',
			'width': 50,
			'align': 'left',

			'resizable': true,
			'cls': '',
			'fixed': false,
			'draggable': false,
			'sortable': true,
			'hidden': false,
			'locked': false,
			'lockable': true,
			'menuDisabled': true,

			// private
			'sortState': null
		};

		this.cid = cid;
		this.context = context;
		Object.assign(this, defaults, options);
	}

	setWidth(num) {
		if (!this.resizable) return;
		if (isNaN(num)) return;

		this.width = +num;
		this.fire('column-resized', this.width, this);
	}

	show() {
		this.hidden = false;
		this.fire('column-hidden', this.hidden, this);
	}

	hide() {
		this.unLock();
		
		this.hidden = true;
		this.fire('column-hidden', this.hidden, this);
	}

	toggle() {
		if (this.hidden) {
			this.show();
		} else {
			this.hide();
		}
	}

	lock() {
		if (!this.lockable) return;
		if (this.locked) return;

		this.show();

		this.locked = true;
		this.fire('column-locked', this.locked, this);
	}

	unLock() {
		if (!this.lockable) return;
		if (!this.locked) return;

		this.locked = false;
		this.fire('column-locked', this.locked, this);
	}

	/**
	 * order[ASC, DESC, NO_SORT]
	 */
	sort(order) {
		if (!this.sortable || !this.dataIndex) return;

		if (order) {
			this.sortState = ORDER.includes(order) ? order : null;
		} else {
			this.sortState = this.sortState === ORDER[1] ? ORDER[0] : ORDER[1];
		}
		
		this.fire('column-sort-changed', this.sortState);
		this.context.fire('notice-colModel-sort-changed');
 	}

 	moveTo(index) {
 		if (isNaN(+index)) return;

 		this.context.fire('column-move-to', this, +index + 1);
 	}

 	remove() {
 		this.fire('destory');
 		this.context.fire('column-removed', this);
 		this.removeEvent();
 	}
}


class ColModel extends EventEmitter {
	constructor(columns) {
		super();

		if (!Array.isArray(columns)) {
			throw 'require property columns is a array object';
		}

		this.columns = []; // data by column
		this.colModel = new Map(); // data by cid
		this.colHeaders = new Map(); // data by dataIndex

		this._initColumn(columns);
		this._bindEvent();
	}

	_initColumn(columns, callback) {
		let size = this.size();

		columns.forEach((col, index) => {
			// cid解决没有dataIndex列或相同dataIndex列的问题
			let cid = index + size;
			let colM = new Column(cid, col, this);

			this.colModel.set(cid, colM);
			this.columns.push(colM);
			this.colHeaders.set(col.dataIndex, colM);

			callback && callback(colM);
		});
	}

	addColumns(columns) {
		if (!Array.isArray(columns)) {
			columns = [columns];
		}
		this._initColumn(columns, colM => this.fire('column-add', colM));
	}

	removeColumn(dataIndex) {
		if (!Array.isArray(dataIndex)) {
			dataIndex = [dataIndex];
		}

		dataIndex.forEach(ds => {
			let colM = this.getColumnByDataIndex(ds);

			if (colM) {
				colM.remove();
			}
		});
	}

	_bindEvent() {
		this.on('notice-colModel-sort-changed', _.debounce(() => {
			this.fire('columns-sort-changed');
		}, 20));

		this.on('column-move-to', (colM, index) => {
			let current = this.columns.indexOf(colM);
			this.columns.splice(index, 0, this.columns.splice(current, 1)[0]);
			// this.columns.splice(index, 0, this.columns[current]);
			// this.columns.splice(index > current ? current : current + 1, 1);

			this.columns.forEach(colM => console.log(colM.dataIndex));

			this.fire('column-moved', colM, index);
		});

		this.on('column-removed', colM => {
			this.columns = this.columns.filter(col => col.dataIndex != colM.dataIndex);
			this.colModel.delete(colM.cid);
			this.colHeaders.delete(colM.dataIndex);
		});

	}

	size() { 
		return this.colModel.size; 
	}

	getColumn(col) {
		if (this.columns.includes(col)) {
			return this.columns.filter(_col => _col == col)[0];
		}

		return this.columns;
	}

	getLockColumn() {
		return this.columns.filter(colM => {
			return colM.locked === true;
		});
	}

	getVisibleColumn() {
		return this.columns.filter(colM => {
			return !colM.hidden;
		});
	}

	getColumnByDataIndex(dataIndex) {
		return this.colHeaders.get(dataIndex) || null;
	}

	getColumnsById(id) {
		return this.colModel[id] || null;
	}

	each(callback, context) {
		this.columns.forEach(callback, context || this);
	}

	destory() { 

	}
}

module.exports = ColModel;
},{"../util/EventEmitter":14,"../util/Utils":16,"../util/shim":17}],4:[function(require,module,exports){
var EventEmitter = require('../util/EventEmitter');
var Utils = require('../util/Utils');
var _ = require('../util/shim')._;

class Row {
	constructor(rid, data) {
		this.rid = rid;
		this.data = data;
		this.selected = false;
	}
	state() {}
}

class GridStore extends EventEmitter {

	constructor(options) {
		super();

		this.colsModel = options.columnModel;

		this.rows = []; // data by index
		this.rowModel = new Map(); // data by id


		this.setData(options.data);

		this._sortState = { keys: [], dirs: [] };
		this._bindEvent();
	}

	_bindEvent() {

		this.colsModel.each(colM => {
			colM.on('column-sort-changed', sortState => {
				let { keys, dirs } = this._sortState;
				let index = keys.indexOf(colM.dataIndex);

				// 未排序
				if (index === -1 && !sortState) {
					return;
				}

				if (index === -1 && sortState) {
					keys.unshift(colM.dataIndex);
					dirs.unshift(sortState.toLowerCase());
					return;
				}

				// 已排序,先删除
				let key = keys.splice(index, 1)[0];
				let dir = dirs.splice(index, 1)[0];

				if (sortState) {
					keys.unshift(key);
					dirs.unshift(sortState.toLowerCase());
				}

			});
		});

		// 所有列都更新状态后
		this.colsModel.on('columns-sort-changed', () => {
			let { keys, dirs } = this._sortState;
			let iterateFn = row => row.data[keys[0]];

			// console.log(keys, dirs);

			this.rows = _.orderBy(this.rows, iterateFn, dirs);
			this.setData(_.map(this.rows, 'data'));
		});
	}

	slice(start, end) {
		return this.rows.slice(start, end);
	}

	/**
	 * 设置排序状态
	 * (+)ASC, -DESC, !NO_SORT
	 * @sorts {Array} sorts -排序状态数组
	 *	sorts = ['+colA', 'colB', '-colC', '!colD']
	 * @returns this;
	 */
	setSortState(sorts) {
		if (!Array.isArray(sorts)) {
			sorts = [sorts];
		}

		this._sortState = { keys: [], dirs: [] };

		// 反转优先级方便后续触发顺序时后触发的优先级高
		sorts.reverse().each(sortObj => {
			let obj, key, dir, col;

			if (typeof sortObj === 'string') {
				obj = sortObj.match(/(^[+|-|!]?)(.{0,})/);
				dir = obj[1] === '' ? 'ASC' : (obj === '-' ? 'DESC' : 'NO_SORT');
				key = obj[2] ? obj[2] : null;

				col = this.colsModel.getColumnByDataIndex(key);
				if (col) {
					col.sort(dir);
				}
			}
		});

		return this;
	}

	setData(data = [], append = false) {
		if (!append) {
			this.rows.length = 0;
			this.rowModel.clear();
		}
		var index = this.size();
		data.forEach((row, ridx) => {
			let rowM = new Row(ridx + index, row);
			this.rows.push(rowM);
			this.rowModel.set(ridx + index, rowM);
		});
		this.fire('data-changed', append);
	}

	forEach(callback, context) {
		this.rows.forEach(function(rowM, ridx) {
			callback.call(this, rowM.data, ridx);
		}, context || this);
	}

	size() {
		return this.rowModel.size;
	}

	destory() { 

	}
}

module.exports = GridStore;
},{"../util/EventEmitter":14,"../util/Utils":16,"../util/shim":17}],5:[function(require,module,exports){
var EventEmitter = require('../util/EventEmitter');
var ColModel = require('./ColModel');
var GridStore = require('./GridStore');
var BufferNode = require('./BufferNode');
var BufferZone = require('./BufferZone');
var Header = require('./Header');
var LockColManager = require('./LockColManager');
var Scroller = require('./Scroller');
var Utils = require('../util/Utils');

function createLayout(container, width) {
	var wrapper = $('<div/>').addClass('c-grid-wrapper').width(width);
	var header = $('<div/>').addClass('c-grid-header');
	var body = $('<div/>').addClass('c-grid-body');
	var viewport = $('<div/>').addClass('c-grid-viewport').appendTo(body);
	var canvas = $('<div/>').addClass('c-grid-canvas').appendTo(viewport);
	wrapper.append(header).append(body).appendTo(container);

	return { wrapper, header, body, viewport, canvas };
}
function calcRowHeight() {
	var li = $('<li class="c-grid-cell">placeholder</li>').appendTo("body");
	var rowHeight = li.outerHeight();
	li.remove();

	return rowHeight;
}

class GridComponent extends EventEmitter {
	constructor(options) {
		super();

		if (!$(options.domEl).size()) { throw 'require a valid domEl'; }

		this.shouldAddNodes = true;
		this.height = +options.height || 500;
		this.width = options.width;

		// $layout dom
		Object.assign(this.$dom = {}, createLayout($(options.domEl), this.width));

		this.columnModel = new ColModel(options.columns);
		this.store = new GridStore({ columnModel: this.columnModel, 'data': options.data || [] });
		this._init();
		this._bindEvent();
	}

	_init() {
		this.header = new Header(this.$dom.header, this.columnModel);
		var total = this.store.size();
		var rowHeight = this.rowHeight = calcRowHeight();
		var viewportHeight = this.height - this.$dom.header.outerHeight();
		var singlePageSize = Math.min(Math.ceil(viewportHeight/ rowHeight) - 1, total - 1);

		this.bufferZone = new BufferZone(singlePageSize, total);
		this.bufferNode = new BufferNode(singlePageSize, this.columnModel, total);
		this.scroller = new Scroller(rowHeight, this.bufferZone);
		this.scroller
			.onX(x => {
				this.fire('scrollLeft', x);
				this.$dom.header.scrollLeft(x);
			})
			.onY((dir, domain, start, end, index, total) => {
				// console.log(`滚动方向：${dir}, 加载区间: [${domain}], 现有范围：(${start} - ${end}), `)
				this._bufferRender(dir, domain);
			}, 20);

		this.$dom.viewport.height(viewportHeight);
		this.$dom.viewport.on('scroll', (evt) => {
			this.scroller.fireY(evt.target.scrollTop);
			this.scroller.fireX(evt.target.scrollLeft);
		});

		this.lockColManager = LockColManager(this.columnModel, this.header, this.$dom, this.bufferNode);
		this._setCanvasWH(total);
	}

	_setCanvasWH(total) {
		this.$dom.canvas
			.width(total ? 'auto' : this._unLockVisibleColsWidth())
			.height(this.rowHeight * total || 1);
	}

	_unLockVisibleColsWidth() {
		return this.header.getVisibleColsWidth() + this.lockColManager.visibleLockColumn.getWidth();
	}

	scrollToTop(position) {
		this.$dom.viewport.scrollTop(position);
	}

	_bindEvent() {
		this.on('viewport-height-changed', viewportHeight => {
			this._updateBuffer();
			this.render();
		});

		this.on('scrollLeft', x => {
			// performance TODO
			// let lockColumnWidth = this.header.getVisibleLockColsWidth();
			// this.$dom.canvas.find('.c-column-locked').css('left', x - lockColumnWidth);
			// this.$dom.header.find('.c-column-locked').css('left', x - lockColumnWidth);
			this.lockColManager.setLockColumnX(x);
		});

		this.store.on('data-changed', (append) => {
			let total = this.store.size();
			this._setCanvasWH(total);
			this.bufferNode.setTotal(total);
			this.bufferZone.setTotal(total);

			if (!append || (total - 1) * this.rowHeight < 2*this.$dom.viewport.outerHeight()) {
				this._updateBuffer();
				this.render();
			}
		});

	}

	_updateBuffer() {
		var limit = Math.min(
			Math.ceil(this.$dom.viewport.outerHeight() / this.rowHeight) - 1,
			this.store.size() - 1);

		this.bufferZone.setLimit(limit);
		this.bufferNode.setLimit(limit);
		this.shouldAddNodes = true;
		this.scrollToTop(0);

		this.$dom.canvas.empty();
	}

	_bufferRender(dir, [start, end]) {
		var nodes = this.bufferNode.get(dir, [start, end]);
		console.log('一次获取节点长度', nodes.length, start, end);

		if (!this.shouldAddNodes) {
			this.store.slice(start, end + 1).forEach((rowM, i) => {
				nodes[i].setData(rowM, rowM.rid * this.rowHeight);
			});

			return;
		}
		var $docFrame = $('<div/>');
		this.store.slice(start, end + 1).forEach((rowM, i) => {

			let node = nodes[i].setData(rowM, rowM.rid * this.rowHeight);
			$docFrame.append(node);
		
		});

		this.$dom.canvas.append($docFrame.children());
		this.lockColManager.addBufferLockNode(nodes);

		if (this.bufferNode.isEnough()) {
			this.shouldAddNodes = false;
		}
	}

	render() {
		this._bufferRender(1, this.bufferZone.domain);
	}

	setWidth(num) {
		if (isNaN(num)) return;

		this.$dom.wrapper.width(num);
	}

	setHeight(num) {
		if (isNaN(num)) return;

		var viewportHeight = num - this.$dom.header.outerHeight();
		this.$dom.viewport.outerHeight(viewportHeight);
		this.fire('viewport-height-changed', viewportHeight);
	}

	destory() {
		this.columnModel.destory();
		this.store.destory();
		this.header.destory();
		this.$dom.wrapper.remove();
	}
}
module.exports = GridComponent;
},{"../util/EventEmitter":14,"../util/Utils":16,"./BufferNode":1,"./BufferZone":2,"./ColModel":3,"./GridStore":4,"./Header":6,"./LockColManager":7,"./Scroller":8}],6:[function(require,module,exports){
const { $, _ } = require('../util/shim');
const DD = require('../util/DD');

const SORT_CLS_ASC = 'c-column-asc';
const SORT_CLS_DESC = 'c-column-desc';
const NEEDLESS_WIDTH = 1000;

var createColumnElement = function(colM) {
	var lockClass = colM.locked ? ' c-column-locked' : '';

	return $('<li/>')
		.addClass('c-header-cell' + lockClass)
		.addClass('c-align-' + colM.align)
		.width(colM.width)
		.on('click', () => { colM.sort(); })
		.data('column', colM)
		.html(colM.text);
};


class Header {
	constructor($header, colsModel) {

		this.$header = $header;
		this.colsModel = colsModel;
		// this.store = store;
		this.colElements = new Map();

		this._createColumnElements();
		this._bindEvent();

		this.render();
	}

	_createColumnElements() {
		var width = NEEDLESS_WIDTH;

		this.$row = $('<ul/>').addClass('c-header-row');

		this.colsModel.each(colM => {
			let colElement = createColumnElement(colM);

			this.colElements.set(colM, colElement);
			this.$row.append(colElement);

			width += colM.width;

		});

		this.$row.width(width);
	}

	getVisibleColsWidth() {
		return this.$row.width() - NEEDLESS_WIDTH;
	}

	_bindEvent() {
		this._columnResize();

		this.colsModel.on('column-add', colM => {
			let colElement = createColumnElement(colM);

			this.colElements.set(colM, colElement);
			this.$row.append(colElement);

			let rowW = this.$row.width();
			this.$row.width(rowW + colM.width);
		});

		this.colsModel.on('column-moved', (colM, index) => {
			let colElement = this.colElements.get(colM);
			colElement.after(this.$row.find('li.c-header-cell').eq(index));
		});

		this.colsModel.each(colM => {

			colM.on('column-resized', width => this.colElements.get(colM).outerWidth(width));

			colM.on('column-hidden', isHidden => {
				let colEle = this.colElements.get(colM);
				if (isHidden) {
					colEle.addClass('c-column-hide');
				} else {
					colEle.removeClass('c-column-hide');
				}
			});

			colM.on('column-locked', isLocked => {
				let colEle = this.colElements.get(colM);

				if (isLocked) {
					colEle.addClass('c-column-locked');
				} else {
					colEle.removeClass('c-column-locked');
				}
			});

			colM.on('column-sort-changed', sortState => {
				let colEle = this.colElements.get(colM);

				// console.log(sortState);
				if (sortState) {
					if (sortState === 'ASC') {
						colEle.addClass(SORT_CLS_ASC);
						colEle.removeClass(SORT_CLS_DESC);
					} else {
						colEle.addClass(SORT_CLS_DESC);
						colEle.removeClass(SORT_CLS_ASC);
					}
				} else {
					colEle.removeClass(SORT_CLS_ASC).removeClass(SORT_CLS_DESC);
				}
			});

			colM.on('destory', () => {
				let colEle = this.colElements.get(colM);
				this.colElements.delete(colM);			
				colEle.remove();

				let rowW = this.$row.width();
				this.$row.width(rowW - colM.width);
			});
		});
	}

	_columnResize() {
		this.$row.on('mousemove', 'li.c-header-cell', function(evt) {
			var offsetX = evt.offsetX;
			if (this.offsetWidth - offsetX <= 5 || offsetX <= 5) {
				$(this).addClass('c-col-resizable');
			} else {
				$(this).removeClass('c-col-resizable');
			}
		});


		var startX = 0;

		DD(this.$row, {
			'trigger': 'li.c-header-cell',
			'restricter': function(evt) {
				var offsetX = evt.offsetX;
				console.log(this.offsetWidth, offsetX, this.innerText);
				if (this.offsetWidth - offsetX <= 5) {
					return $(this);
				} else if (offsetX <= 5) {
					return $(this).prev();
				}
			},
			'onDragStart': _.debounce(function(offset, $target) {
				var scrollLeft = document.body.scrollLeft || document.documentElement.scrollLeft;
				// console.log($target.offset().left, $target.text());
				startX = $target.offset().left - scrollLeft;
				// console.log(offset.x, $target.text());

				// startX = offset.x;
			}, 80),
			'onDragging': function(offset, $target) {

			},
			'onDragEnd': _.debounce(function(offset, $target) {
				var width = offset.x - startX;
				// console.log(`${$target.text()}
				// 	原宽度为${$target.data('column').width},
				// 	改变为：${width}, [${offset.x} - ${startX}]`);
				$target.data('column').setWidth(width);
			}, 80)
		});
	}

	render() {
		this.$header.append(this.$row);
	}

	destory() {

	}
}

module.exports = Header;
},{"../util/DD":13,"../util/shim":17}],7:[function(require,module,exports){
'use strict';

class LockColumn {
	constructor() {
		this._data = [];
		this._columnsWidth = 0;
	}

	add(colM) {
		this._data.unshift(colM);
		this.reCalc();
	}

	remove(delColM) {
		this._data = this._data.filter(colM => colM !== delColM);
		this.reCalc();
	}

	clear() {
		this._data.length = 0;
		this.reCalc();
	}

	getWidth() {
		return this._columnsWidth;
	}

	reCalc() {
		this._columnsWidth = this._data.reduce((width, colM) => {
			width -= colM.width;
			colM.awayFromLeft = width;
			return width;
		}, 0);
	}

	each(fn) {
		this._data.forEach(fn);
	}

	/**
	 * 当其中一列发生变化，通知其它列相应变化
	 */
	 publish(changedColM, scrollLeft) {
	 	this._data.forEach(colM => {
	 		if (colM !== changedColM) {
	 			colM.fire('scroll-x', scrollLeft);
	 		}
	 	});
	 }
}

var LockColManager = function(colsModel, header, $dom, bufferNode) {
	let visibleLockColumn = new LockColumn();

	init();
	initEvent();

	function init() {
		colsModel
			.getLockColumn()
			.filter(colM => !colM.hidden)
			.forEach(colM => visibleLockColumn.add(colM));

		updateBoxSize();

		visibleLockColumn.each(colM => {
			let headerElement = header.colElements.get(colM);
			// 设置并记录初始的左侧位
			headerElement.css('left', colM.awayFromLeft);

			colM.on('scroll-x', x => {
				let leftStyle = { 'left': x + colM.awayFromLeft };

				headerElement.css(leftStyle);
				bufferNode.getNodeList().forEach(node => node.children.get(colM).css(leftStyle));				
			});
		});
	}

	function initEvent() {

		const columnLockOrUnLock = (isLocked, colM) => {
			let headerElement = header.colElements.get(colM);

			if (isLocked) {
				visibleLockColumn.add(colM);

				colM.on('scroll-x', x => {
					let leftStyle = { 'left': x + colM.awayFromLeft };

					headerElement.css(leftStyle);
					bufferNode.getNodeList().forEach(node => node.children.get(colM).css(leftStyle));
				});

			} else {
				visibleLockColumn.remove(colM);

				colM.off('scroll-x');

			}

			let currentLeft = $dom.viewport.scrollLeft() + colM.awayFromLeft;

			// 设置并记录初始的左侧位
			headerElement.css('left', currentLeft);
			bufferNode.getNodeList().forEach(node => node.children.get(colM).css('left', currentLeft));

			visibleLockColumn.publish(colM, $dom.viewport.scrollLeft());
			updateBoxSize();
		};

		colsModel.on('column-add', colM => {
			// BUGFIX TODO

			// ...
			colM.on('column-locked', isLocked => {
				columnLockOrUnLock(isLocked, colM);
			});
		});

		colsModel.getColumn().forEach(colM => {

			colM.on('column-resized', width => {

				if (colM.locked) {
					visibleLockColumn.reCalc();
					let headerElement = header.colElements.get(colM);

					let currentLeft = $dom.viewport.scrollLeft() + colM.awayFromLeft;

					headerElement.css('left', currentLeft);
					bufferNode.getNodeList().forEach(node => node.children.get(colM).css('left', currentLeft));

					visibleLockColumn.publish(colM, $dom.viewport.scrollLeft());
					updateBoxSize();
				}
			
			});


			colM.on('column-locked', isLocked => {
				// ...
				columnLockOrUnLock(isLocked, colM);
			});
		});
		
		bufferNode.on('buffer-initial', () => {
			// clearBufferLockNode();
		});
	}

	function updateBoxSize() {
		var visibleLockColsWidth = visibleLockColumn.getWidth();
		header.$header.css('padding-left', -visibleLockColsWidth);
		$dom.canvas.css('margin-left', -visibleLockColsWidth);
	}

	return {
		visibleLockColumn,
		setLockColumnX(scrollLeft) {
			visibleLockColumn.each(colM => colM.fire('scroll-x', scrollLeft));
		},

		addBufferLockNode(rowNodes) {
			visibleLockColumn.each(colM => {
				rowNodes.forEach(rowNodes => {
					let colEle = header.colElements.get(colM);
					let cellElement = rowNodes.children.get(colM);

					cellElement.css('left', $dom.viewport.scrollLeft() + colM.awayFromLeft);
				});
			});
		},

		clearBufferLockNode() {
			visibleLockColumn.clear();
		}

	};
};

module.exports = LockColManager;
},{}],8:[function(require,module,exports){
// TODO
var debounce = function(fn, time) {
	var timer = null;
	return function(...args) {
		if (timer) clearTimeout(timer);

		timer = setTimeout(() => {
			fn.apply(null, args);
		}, time);
	}
}

//解决requestAnimationFrame兼容问题
var raFrame = window.requestAnimationFrame ||
              window.webkitRequestAnimationFrame ||
              window.mozRequestAnimationFrame ||
              window.oRequestAnimationFrame ||
              window.msRequestAnimationFrame ||
              function(callback) {
                  window.setTimeout(callback, 1000 / 60);
              };

//柯里化封装
var throttle = function(fn) {
    let isLocked;
    return function(...args) {

        if(isLocked) return 

        isLocked = true;
        raFrame(() => {
            isLocked = false;
            fn.apply(this, args)
        });
    }
};

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
		// var dealyFn = debounce(handler, delay);

		this._triggerY = debounce((y) => {
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
},{}],9:[function(require,module,exports){
var Selection = require('./Selection');
var Menu = require('../plugin/Menu');
var $  = require('../util/shim').$;

const defHeaderContextMenu = [{ 
		text: 'lock', 
		handler: function(info, context, evt) {
			info.column.lock();
		} 
	}, { 
		text: 'unlock', 
		handler: function(info, context, evt) { 
			info.column.unLock();
		} 
	}, { 
		separator: true 
	}, { 
		text: 'show', 
		handler: function(info, context, evt) { 
			info.column.show();
		} 
	}, { 
		text: 'hide', 
		handler: function(info, context, evt) { 
			info.column.hide();
		} 
	}, { 
		text: 'locator', 
		disabled: true,
		handler: function(info, context, evt) { 
			// TODO
			context.scrollToTop(Math.random() * 30000);
		} 
	}, { 
		text: 'select column', 
		handler(info, context, evt) { 
			// alert(self.store.size());
			context._start = [info.column.dataIndex, 0];
			context._end = [info.column.dataIndex, context.store.size() - 1];

			context.selectionRange(context._start, context._end);
		} 
	}, { 
		cls: 'number-column',
		text: 'count', 
		handler(info, context, evt) { 
			alert(context.store.size());
		} 
	}, { 
		cls: 'number-column',
		text: 'count', 
		handler(info, context, evt) {
			alert(context.store.size());
		} 
	}];

const defCellContextMenu = [{
		text: 'lock row to top', 
		handler(info, context, evt) { console.log(context._selection); } 
	},{ 
		text: 'lock row to bottom', 
		handler(info, context, evt) { console.log(context._selection); } 
	},{ 
		text: 'search', 
		handler(info, context, evt) { console.log(context._selection); } 
	},{ 
		text: 'mark', 
		handler(info, context, evt) { console.log(context._selection); } 
	}];	

const defSelectionContextMenu = [{ 
		text: 'copy', 
		handler(info, context, evt) { console.log(info, context._selection); } 
	},{ 
		text: 'print', 
		handler(info, context, evt) { 
			console.log(evt, data, context);
		} 
	},{ 
		text: 'export', 
		handler(info, context, evt) { console.log(context._selection); } 
	},{ 
		text: 'mark', 
		handler(info, context, evt) { console.log(context._selection); } 
	}];


class Contextmenu extends Selection {
	constructor(options) {
		super(options);

		this.cellCtxMenu = options.bizContextMenu.cell;

		this.headerCtxMenu = {
			before: function(info, evt) {
				if (info.column.vtype === 'number') {
					this.getCls('.number-column').show();
				} else {
					this.getCls('.number-column').hide();
				}

				return true;
			}
		};
	}

	_bindEvent() {
		super._bindEvent();

		let self = this;

		this.$contextmenuHeader = new Menu(this.$dom.wrapper, { 
			data: defHeaderContextMenu, 
			context: this 
		});

		this.$contextmenu = new Menu(this.$dom.body, { 
			data: [], 
			context: this 
		});
		
		this.$dom.wrapper
			.on('contextmenu', '.c-header-cell', 
				this._headerContextMenu.bind(this)
			);

		this.$dom.body
			.on('contextmenu', '.c-grid-cell', 
				this._cellContextMenu.bind(this, defCellContextMenu)
			)
			.on('contextmenu', '.c-cell-selected', 
				this._cellContextMenu.bind(this, defSelectionContextMenu)
			);
	}

	_headerContextMenu(evt) {
		let colM = $(evt.target).data('column');
		let menu = this.$contextmenuHeader;

		let info = { 
			'dataIndex': colM.dataIndex, 
			'column': colM,
			'context': menu
		}

		this.fire('header-contextmenu', info, evt);
		// console.log(info);

		if (this.headerCtxMenu.before.call(menu, info, evt)) {
			
			evt.preventDefault();

			menu.setInfo(info);
			menu.showAt(evt);
		
			docEvent(menu);
		}
	}

	_cellContextMenu(defCtxMenu, evt) {
		let $cell = $(evt.target);
		let dataIndex = $cell.data('dataIndex');
		let rownumber = +$cell.parent('.c-grid-row').attr('rid');
		let menu = this.$contextmenu;

		let info = { 
			'value': $cell.text(),
			'dataIndex': dataIndex, 
			'rownumber': rownumber,
			'context': menu
		};

		this.fire('cell-contextmenu', info, evt);
		// console.log(info);

		if (this.cellCtxMenu.before.call(menu, info, evt)) {

			evt.preventDefault();

			menu.setInfo(info);
			menu.update(defCtxMenu.concat(menu.getData()));
			
			menu.showAt(evt);
		
			docEvent(menu);
		}
	}

	destory() {
		super.destory();

		this.$contextmenuHeader.destory();
		this.$contextmenu.destory();
		this.cellCtxMenu = null;
	}
}

function docEvent($contextmenu) {
	$(document).on('mouseup.contextmenu', onMouseDown.bind(null, $contextmenu));
}

function onMouseDown($contextmenu){
    $contextmenu.hide();
    $(document).off('mouseup.contextmenu');
}

module.exports = Contextmenu;
},{"../plugin/Menu":12,"../util/shim":17,"./Selection":10}],10:[function(require,module,exports){
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
		this._selectDataIndex = [];
	}
	
	_bindEvent() {
		super._bindEvent();

		let self = this;

		this.columnModel.on('notice-colModel-sort-changed', () => {
			this._defaults();
		});

		this.$dom.canvas
			.on('mousedown', CELL_CLS, function(evt) {
				if (evt.button === 0) {
					self.$dom.canvas.find(CELL_CLS).removeClass(CELL_SELECTED_CLS);
					self._moving = true;
					let $cell = $(this).addClass(CELL_SELECTED_CLS);
					self._start = self._end = [$cell.data('dataIndex'), +$cell.parent(ROW_CLS).attr('rid')];
					// console.log(start);
				} 
				else if (evt.button === 2) {
					
				}
			})
			.on('mouseenter', CELL_CLS, function(evt) {
				if (self._moving) {
					let $cell = $(this);
					
					$cell.addClass(CELL_SELECTED_CLS);
					self._end = [$cell.data('dataIndex'), +$cell.parent(ROW_CLS).attr('rid')];

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
			let cols = this._selectDataIndex;

			if (i >= y0 && i < y1 + 1) {
				cols.forEach((col) => {
					rowNode.children.forEach(($cell, colM) => {
						if (cols.indexOf(colM.dataIndex) != -1) {
							$cell.addClass(CELL_SELECTED_CLS);
						} else {
							$cell.removeClass(CELL_SELECTED_CLS)
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

		let dataIndex = this.getLockAndVisiableColumnAsDataIndex();
		[x0, y0, x1, y1] = orderBy(x0, y0, x1, y1, dataIndex);


		let cols = this._selectDataIndex = dataIndex.slice(dataIndex.indexOf(x0), dataIndex.indexOf(x1)+1);
		// console.log(cols);

		this._selectY = [y0, y1 + 1];
		let rows = this.store.slice(y0, y1 + 1);

		this._selection = rows.map(row => {
			return cols.map(col => row.data[col]);
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
						if (cols.indexOf(colM.dataIndex) != -1) {
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
	getLockAndVisiableColumnAsDataIndex() {
		let cols = [];

		this.lockColManager
			.visibleLockColumn
			.each(colM => cols.unshift(colM.dataIndex));

		let visiableCols = this.columnModel
			.getVisibleColumn()
			.map(colM => colM.dataIndex)
			.filter(dataIndex => cols.indexOf(dataIndex) == -1);

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

function orderBy(x0, y0, x1, y1, dataIndex) {
	if (dataIndex.indexOf(x0) > dataIndex.indexOf(x1)) {
		[x0, x1] = swap(x0, x1);
	}
	if (y0 > y1) {
		[y0, y1] = swap(y0, y1);
	}

	return [x0, y0, x1, y1];
}

module.exports = Selection;
},{"../core/GridView":5}],11:[function(require,module,exports){
// exports.GridStore = require('./core/GridStore');
// exports.GridView = require('./core/GridView');
// module.exports = require('./extends/Selection');
module.exports = require('./extends/Contextmenu');

// export { default } form './plugin/Contextmenu';

},{"./extends/Contextmenu":9}],12:[function(require,module,exports){
var $ = require('../util/shim').$;
var Utils = require('../util/Utils');


class Menu {
	constructor($wrapper, { data, context }) {
		this.params = {};
		this.$menu = $(null);
		this.$wrapper = $wrapper;
		this._data = data || [];
		this.context = context;

		this.update(data);
	}

	update(data) {
		this.$menu.remove(); // TODO 优化复用节点
		
		if (Array.isArray(data) && data.length > 0) {
			this.$menu = compileMenu(data, this);

			this.$wrapper.append(this.$menu);

			this._data = data;
		} else {
			this._data = [];
		}
	}

	merge(data) {
		this._data = this._data.filter(item => {
			return !data.includes(item);
		});

		this._data = data.concat(this._data);
		this.update(this._data);
	}

	setInfo(info) {
		this.$info = info;
	}

	getInfo() {
		return this.$info;
	}

	getData() {
		return this._data;
	}

	getCls(className) {
		return this.$menu.find(className);
	}

	showAt(evt) {
		if (!this._data.length) {
			return;
		}

		let x = evt.clientX - this.$wrapper.offset().left;
		let y = evt.clientY - this.$wrapper.offset().top;

	    this.$menu
	    	.addClass('show-menu')
	    	.css({ 'left': x + 'px', 'top': y + 'px' });
	}

	hide() {
		this.$menu.removeClass('show-menu');
	}

	getDom() {
		return this.$menu;
	}

	destory() {
		this.$menu.empty();
	}

}


const emptyFn = (evt) => { 
	evt.preventDefault;
	return false; 
};

function convert(item) {
	let defItem = {
		'id': 'cm-id-' + Date.now(),
		'text': '',
		'iconCls': '',
		'hidden': false,
		'disabled': false,
		'handler': function() {}
	};

	return Object.assign(defItem, item);
}

function createItem(item, vm) {
	let $item = $('<li/>')
			.attr('id', item.id)
			.addClass('c-menu-item')
			.addClass(item.disabled ? 'disabled': '');

    let $button = $('<button/>').addClass('c-menu-btn')
    		.append(`<i class="fa ${item.iconCls}"></i>`)
    		.append(`<span class="c-menu-text">${item.text}</span>`)
    		.on('click', (evt) => {
    			item.handler.call(vm, vm.getInfo(), vm.context, evt);
    		});

    return $item.append($button);
};

function compileMenu(menus, vm) {
	if (menus && menus.length === 0) return $(null);
	
	let $menus = $('<menu/>').addClass('c-menu');
	let $menuSeparator = $('<li/>').addClass('c-menu-separator');
	
	menus.forEach(menu => {
		if (menu.separator) {
			return $menus.append($menuSeparator);
		}

		let $menu = createItem(convert(menu), vm);
		let children;

		if (menu.children) {
			children = compileMenu(menu.children, vm);

			if (children) {
				$menu.addClass('submenu').append(children);
			}
		}
		
		$menus.append($menu);
	});

	return $menus;
}


module.exports = Menu;
},{"../util/Utils":16,"../util/shim":17}],13:[function(require,module,exports){
'use strict';
const $ = require('../util/shim').$;

const FLEXMINWIDTH = 35;

var dragDrop = function(evt ,opts) {
	var doc = $(document);
	var scrollLeft = document.body.scrollLeft || document.documentElement.scrollLeft;
	var scrollTop = document.body.scrollTop || document.documentElement.scrollTop;
	var leftOffset = $(evt.target).offset().left - scrollLeft;
	var iX, iY, startX, endX;
	var dragging = true;

	startX = iX = evt.clientX - scrollLeft;
	iY = $(evt.target).offset().top - scrollTop;

	opts.onDragStart({ 'x': startX }, opts.$element);

	doc.on('mousemove.dragdrop', $.proxy(mousemove, this));
	doc.on('mouseup.dragdrop', $.proxy(mouseup, this));
	// $(evt.target)[0].setCapture && $(evt.target)[0].setCapture();

	function mousemove(e) {
		if (dragging) {
			endX = e.clientX - scrollLeft;

			// limit
			if (endX - leftOffset < FLEXMINWIDTH) {
				endX = leftOffset + FLEXMINWIDTH;
			}

			opts.onDragging( { 'x': endX }, opts.$element);
		}

		e.preventDefault();
		e.stopPropagation();
	}

	function mouseup(evt) {
		var e = evt.target;
		dragging = false;

		opts.onDragEnd({ 'x': evt.clientX - scrollLeft }, opts.$element);

		if (e && e.setCapture) {
			e.releaseCapture();
		} else if (window.releaseCapture) {
			window.releaseCapture(Event.MOUSEMOVE | Event.MOUSEUP);
		}

		doc.off('mousemove.dragdrop', mousemove);
		doc.off('mouseup.dragdrop', mouseup);
	}

};


module.exports = function(delegate, options) {
	var defaults = {
		restricter(evt) { return null; },
		onDragStart(offset, target) {},
		onDragging(offset, target) {},
		onDragEnd(offset, target) {}
	};

	Object.assign(defaults, options);

	$(delegate).on('mousedown', options.trigger, function(evt) {
		var restricter = defaults.restricter.call(this, evt);

		if (restricter) {
			defaults.$element = restricter;
			dragDrop.call(this, evt, defaults);
		}
	});
};
},{"../util/shim":17}],14:[function(require,module,exports){
/**
 * 事件管理
 * @class EventEmitter
 */

function indexOfListener(listeners, listener) {
	var i = listeners.length;
	while (i--) {
		if (listeners[i].listener === listener) {
			return i;
		}
	}
	return -1;
}

function isValidListener(listener) {
	if (typeof listener === 'function') {
		return true;
	} else if (listener && typeof listener === 'object') {
		return isValidListener(listener.listener);
	} else {
		return false;
	}
}

class EventEmitter {

	constructor(options) {

	}
	/**
	*
	*
	*
	*
	*/
	_getEvents() {
		return this._events || (this._events = {});
	}
	/**
	* 通过事件名获取listener 数组或初始化
	* 使用正则匹配会返回一个对应的对象
	*
	* 
	* getListeners
	* @param {String } RegExp} eventName
	* @return {Functon[] | Object}
	*
	*/
	getListeners(name) {
		var events = this._getEvents();
		var response;
		var key;

		if (name instanceof RegExp) {
			response = {};
			for (key in events) {
				if (events.hasOwnProperty(key) && name.test(key)) {
					response[key] = events[key];
				}
			}
		} else {
			response = events[name] || (events[name] = []);
		}

		return response;
	}
	/**
	* 通过事件名获取listener 始终返回一个对象
	*
	* 
	* getListenersAsObject
	* @param {String|RegExp} eventName
	* @return {Object}
	*/
	getListenersAsObject(name) {
		var listeners = this.getListeners(name);
		var response;

		if (listeners instanceof Array) {
			response = {};
			response[name] = listeners;
		}

		return response || listeners;
	}
	/**
	* 获取 listener 列表
	*
	* flattenListeners
	*
	* @param { Object[]} listeners
	* @return {Function[]}
	*/
	flattenListeners(listeners) {
		var flatListeners = [];

		for (var i = 0, l = listener.length; i < l; i++) {
			flatListeners.push(listeners[i].listener);
		}

		return flatListeners;
	}
	/**
	* 事件注册
	*
	*
	* @exampel
	* var emt = new EventEmitter();
	* emt.addListener('div:hover', function(){
	*	// do
	* });
	* @param {string} eventName
	* @param {Function} listener
	* @return {Objectj}
	*
	*/
	addListener(name, listener, flag) {
		if (!isValidListener(listener)) {
			throw new TypeError('listener must be a function');
		}

		var listeners = this.getListenersAsObject(name);
		var listenerIsWrapped = typeof listener === 'object';
		var key, start, args;

		for (key in listeners) {
			if (listeners.hasOwnProperty(key) && indexOfListener(listeners, listener) === -1) {

				start = listeners[key].length;

				listeners[key].push(listenerIsWrapped ? listener : {
					listener: listener,
					once: false
				});

				if (flag && listeners[key].args) {
					listeners[key].start = start;
					args = listeners[key].args;
					this.emitEvent(name, args);
				}
			}
		}

		return this;
	}

	on() {
		return this.addListener.apply(this, arguments);
	}

	one(name, listener, flag) {
		return this.removeEvent(name).addListener.apply(this, arguments);
	}

	/**
	 * 事件注册，触发后自动移除
	 *
	 *
	 * @param {String} eventName
	 * @param {Function} listener
	 * @reutnr {Object}
	 *
	 */
	addOnceListener(name, listener) {
		return this.addListener(name, {
			listener: listener,
			once: true
		});
	}

	once() {
		return this.addOnceListener.apply(this.arguments);
	}
	/**
	 * 事件销毁
	 *
	 *
	 * @param {String} eventName
	 * @param {Function} listener
	 * @return {Object}
	 *
	 */
	removeListener(name, listener) {
		var listeners = this.getListenersAsObject(name);
		var index;
		var key;

		for (key in listeners) {
			if (listeners.hasOwnProperty(key)) {
				index = indexOfListener(listeners[key], listener);

				if (index !== -1) {
					listeners[key].splice(index, i);
				}
			}
		}

		return this;
	}

	off() {
		return this.removeListener.apply(this, arguments);
	}

	manipulateListeners(remove, name, listeners) {
		var single = remove ? this.removeListener : this.addListener;
		var mutiple = remove ? this.removeListeners : this.addListeners;
		var i;
		var v;

		if (typeof name === 'object' && !(name instanceof RegExp)) {
			for (i in name) {
				if (name.hasOwnProperty(i) && (v = name[i])) {
					if (typeof v === 'function') {
						single.call(this, i, v);
					} else {
						mutiple.call(this, i, v);
					}
				}
			}
		} else {
			i = 0;
			v = listeners.length;
			while (i < v) {
				single.call(this, name, listeners[i++]);
			}
		}

		return this;
	}

	addListeners(name, listeners) {
		return this.manipulateListeners(false, name, listeners);
	}

	removeListeners(name, listeners) {
		return this.manipulateListeners(true, name, listeners);
	}

	removeEvent(name) {
		var events = this._getEvents();
		var key;

		if (typeof name === 'string') {
			// 移除所有指定事件名的所有listeners
			// delete events[name]
			if (events[name] instanceof Array) {
				events[name].length = 0;
			}
		} else if (name instanceof RegExp) {
			// 正则匹配的所有 listeners
			for (key in events) {
				if (events.hasOwnProperty(key) && name.test(key)) {
					// delete events[key]
					if (events[key] instanceof Array) {
						event[key].length = 0;
					}
				}
			}
		} else {
			// 移除所有 listeners
			delete this._events;
		}

		return this;
	}

	removeAllListeners() {
		return this.removeEvent.apply(this, arguments);
	}
	/**
	 * 事件触发
	 *
	 *
	 * @example
	 * var emt = new EventEmitter();
	 * setTimeout(function() {
	 * 	emt.emitEvent('div:hover', 1);
	 * }, 1000);
	 *
	 * @param {String} eventName 事件名称
	 * @param {Array} [args] HTMLDocument, itemData, ...
	 * @return {Object}
	 *
	 */
	emitEvent(name, args) {
		var listenersMap = this.getListenersAsObject(name);
		var listeners;
		var listener;
		var i;
		var l;
		var key;
		var response;

		for (key in listenersMap) {
			if (listenersMap.hasOwnProperty(key)) {
				listeners = listenersMap[key].slice(0);

				listenersMap[key].args = args;

				i = listenersMap[key].start || 0;
				listenersMap[key].start = 0;

				for (l = listeners.length; i < l; i++) {
					listener = listeners[i];

					if (listener.once === true) {
						this.removeListener(name, listener.listener);
					}

					response = listener.listener.apply(this, args || []);

					if (response === this._getOnceReturnValue()) {
						this.removeListener(name, listener.listener);
					}
				}
			}
		}
	
		return this;
	}

	trigger() {
		return this.emitEvent.apply(this, arguments);
	}

	fire(name) {
		var args = Array.prototype.slice.call(arguments, 1);
		return this.emitEvent(name, args);
	}

	_getOnceReturnValue() {
		if (this.hasOwnProperty('_onceReturnValue')) {
			return this._onceReturnValue;
		}
		return true;
	}

	setOnceReturnValue(value) {
		this._onceReturnValue = value;
		return this;
	}

	defineEvent(name) {
		this.getListeners(name);
		return this;
	}

	defineEvents(names) {
		for (var i = 0, l = names.length; i < l; i++) {
			this.defineEvent(name[i]);
		}
		return this;
	}

}

module.exports = EventEmitter;



},{}],15:[function(require,module,exports){
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
},{}],16:[function(require,module,exports){
var Utils = {};

var uid = Utils.uid = (() => {
	let t = Date.now();
	return () => {
		return (t++).toString(16);
	};
})();


var merge = Utils.merge = (target, additional, deep) => {
	let depth = typeof deep == 'undefined' ? 2 : deep, prop;

	for (prop in additional) {
		if (additional.hasOwnProperty(prop)) {
			if (typeof target[prop] !== 'object' || !depth) {
				target[prop] = additional[prop];
			} else {
				Utils.merge(target[prop], additional[prop], depth - 1);
			}
		}
	}

	return target;
};

var findIndex = Utils.findIndex = require('./FindIndex');
var compareFn = Utils.compareFn = require('./utils/Comparer');

module.exports = Utils;
},{"./FindIndex":15,"./utils/Comparer":18}],17:[function(require,module,exports){
var context = typeof window === 'undefined' ? this : window;
exports.$ = context.$;
exports._ = context._;
},{}],18:[function(require,module,exports){
/**
 * 创建比较函数
 * @summary 约束条件，只针对对象数组结构的数据，如
 *      [{"col_1": 10, "col_2": 35, "col_3": 66}, ...]
 *
 * @example
 *
 *  var sorts = ['A','B','C','D'];
 *  var dirs = [1, -1, 1, 1];
 *
 *  var data3 = [
 *      {A:1,B:1,C:5,_id:1},
 *      {A:1,B:3,C:5,_id:1},
 *      {A:2,B:5,C:4,_id:2},
 *      {A:1,B:1,C:9,_id:1},
 *      {A:3,B:3,C:3,_id:3},
 *      {A:1,B:1,C:3,_id:1},
 *      {A:4,B:2,C:2,_id:4},
 *      {A:5,B:4,C:1,_id:5},
 *  ];
 *
 *  var fn = compareFn(sorts, dirs);
 *  var ret = data3.sort(fn).map(d => Object.values(d));
 *  console.dir(ret);
 *
 * @param {Array} sorts -排序字段数组 ['col_1', 'col_2', 'col_3',...]
 * @param {Array} dirs -对应字体排序数组的升降序,1：升序 -1：降序 [1, -1]
 * @returns {Function} 比较函数
 */
exports.compareFn = function compareFn(sorts, dirs) {
    var conditions = sorts.reduce((pre, next, i) => {
        pre  = pre ? pre + ' ||' : '';
        return `${pre} (a.${next} - b.${next}) * ${dirs[i]}`;
    }, '');

    var function_body = function() {
        let sortInfo = sorts.join(',').replace(/(\w+)/g, '"$1"');
        return `var sort = [${sortInfo}]; return ${conditions}`;
    }
    // console.log(function_body());
    
    return new Function('a', 'b', function_body());
}



},{}]},{},[11])(11)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY29yZS9CdWZmZXJOb2RlLmpzIiwic3JjL2NvcmUvQnVmZmVyWm9uZS5qcyIsInNyYy9jb3JlL0NvbE1vZGVsLmpzIiwic3JjL2NvcmUvR3JpZFN0b3JlLmpzIiwic3JjL2NvcmUvR3JpZFZpZXcuanMiLCJzcmMvY29yZS9IZWFkZXIuanMiLCJzcmMvY29yZS9Mb2NrQ29sTWFuYWdlci5qcyIsInNyYy9jb3JlL1Njcm9sbGVyLmpzIiwic3JjL2V4dGVuZHMvQ29udGV4dG1lbnUuanMiLCJzcmMvZXh0ZW5kcy9TZWxlY3Rpb24uanMiLCJzcmMvaW5kZXguanMiLCJzcmMvcGx1Z2luL01lbnUuanMiLCJzcmMvdXRpbC9ERC5qcyIsInNyYy91dGlsL0V2ZW50RW1pdHRlci5qcyIsInNyYy91dGlsL0ZpbmRJbmRleC5qcyIsInNyYy91dGlsL1V0aWxzLmpzIiwic3JjL3V0aWwvc2hpbS5qcyIsInNyYy91dGlsL3V0aWxzL0NvbXBhcmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeldBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi4vdXRpbC9FdmVudEVtaXR0ZXInKTtcclxudmFyICQgPSByZXF1aXJlKCcuLi91dGlsL3NoaW0nKS4kO1xyXG5cclxudmFyIGRlZmluZURlbGwgPSBmdW5jdGlvbihjb2xNKSB7XHJcblx0bGV0IGNlbGwgPSAkKCc8bGkvPicpXHJcblx0XHQuYWRkQ2xhc3MoJ2MtZ3JpZC1jZWxsJylcclxuXHRcdC5hZGRDbGFzcygnYy1hbGlnbi0nICsgY29sTS5hbGlnbilcclxuXHRcdC5hZGRDbGFzcygoKSA9PiBjb2xNLmhpZGRlbiA/ICdjLWNvbHVtbi1oaWRlJyA6ICcnKVxyXG5cdFx0LmFkZENsYXNzKCgpID0+IGNvbE0ubG9ja2VkID8gJ2MtY29sdW1uLWxvY2tlZCcgOiAnJylcclxuXHRcdC5hdHRyKCd0YWJpbmRleCcsIC0xKVxyXG5cdFx0LmRhdGEoJ2RhdGFJbmRleCcsIGNvbE0uZGF0YUluZGV4KVxyXG5cdFx0LndpZHRoKGNvbE0ud2lkdGgpO1xyXG5cclxuXHRyZXR1cm4gY2VsbDtcclxufTtcclxuXHJcbnZhciBjcmVhdGVDZWxsID0gZnVuY3Rpb24oJHJvdywgY29sc01vZGVsKSB7XHJcblx0dmFyIHNpemUgPSBjb2xzTW9kZWwuc2l6ZSgpO1xyXG5cdHZhciBjaGlsZHJlbiA9IG5ldyBNYXAoKTtcclxuXHJcblx0Y29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblx0XHRsZXQgY2VsbCA9IGRlZmluZURlbGwoY29sTSk7XHJcblxyXG5cdFx0JHJvdy5hcHBlbmQoY2VsbCk7XHJcblx0XHRjaGlsZHJlbi5zZXQoY29sTSwgY2VsbCk7XHJcblx0fSk7XHJcblxyXG5cdHJldHVybiBjaGlsZHJlbjtcclxufTtcclxuXHJcbmNsYXNzIFJvd05vZGUgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cdGNvbnN0cnVjdG9yKGNvbHNNb2RlbCwgY29udGV4dCkge1xyXG5cdFx0c3VwZXIoKTtcclxuXHRcdHRoaXMuJHZtID0gY29udGV4dDtcclxuXHRcdHRoaXMuY29sc01vZGVsID0gY29sc01vZGVsO1xyXG5cdFx0dGhpcy4kbm9kZSA9ICQoJzx1bC8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC1yb3cnKTtcclxuXHJcblx0XHR0aGlzLmNoaWxkcmVuID0gY3JlYXRlQ2VsbCh0aGlzLiRub2RlLCBjb2xzTW9kZWwpO1xyXG5cdFx0dGhpcy5fYmluZEV2ZW50KGNvbHNNb2RlbCk7XHJcblx0fVxyXG5cclxuXHRfYmluZEV2ZW50KGNvbHNNb2RlbCkge1xyXG5cdFx0dGhpcy5jb2xzTW9kZWwub24oJ2NvbHVtbi1hZGQnLCBjb2xNID0+IHtcclxuXHRcdFx0bGV0IGNlbGwgPSBkZWZpbmVEZWxsKGNvbE0pO1xyXG5cclxuXHRcdFx0dGhpcy4kbm9kZS5hcHBlbmQoY2VsbCk7XHJcblx0XHRcdHRoaXMuY2hpbGRyZW4uc2V0KGNvbE0sIGNlbGwpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwub24oJ2NvbHVtbi1tb3ZlZCcsIChjb2xNLCBpbmRleCkgPT4ge1xyXG5cdFx0XHRsZXQgY2VsbCA9IHRoaXMuY2hpbGRyZW4uZ2V0KGNvbE0pO1xyXG5cdFx0XHRjZWxsLmFmdGVyKHRoaXMuJG5vZGUuZmluZCgnbGkuYy1ncmlkLWNlbGwnKS5lcShpbmRleCkpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Y29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1yZXNpemVkJywgd2lkdGggPT4ge1xyXG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKHdpZHRoKTtcclxuXHRcdFx0XHR0aGlzLmNoaWxkcmVuLmdldChjb2xNKS5vdXRlcldpZHRoKHdpZHRoKTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4taGlkZGVuJywgaXNIaWRkZW4gPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNoaWxkcmVuLmdldChjb2xNKTtcclxuXHRcdFx0XHRpZiAoaXNIaWRkZW4pIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcygnYy1jb2x1bW4taGlkZScpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoJ2MtY29sdW1uLWhpZGUnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWxvY2tlZCcsIGlzTG9ja2VkID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jaGlsZHJlbi5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdGlmIChpc0xvY2tlZCkge1xyXG5cdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKCdjLWNvbHVtbi1sb2NrZWQnKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKCdjLWNvbHVtbi1sb2NrZWQnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignZGVzdG9yeScsICgpID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jaGlsZHJlbi5nZXQoY29sTSk7XHJcblx0XHRcdFx0dGhpcy5jaGlsZHJlbi5kZWxldGUoY29sTSk7XHRcdFx0XHJcblx0XHRcdFx0Y29sRWxlLnJlbW92ZSgpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0c2V0RGF0YShyb3csIG9mZnNldFRvcCkge1xyXG5cdFx0Ly8g6L+Z6YeM5aaC5p6c55SoQU9Q5pa55byP5a6e546w5pu05aW9VE9ET1xyXG5cdFx0dGhpcy4kdm0uZmlyZSgncm93LXVwZGF0ZS1iZWZvcmUnLCB0aGlzLCByb3cpO1xyXG5cclxuXHRcdHZhciBjb250ZW50O1xyXG5cdFx0dmFyIGNlbGxzID0gdGhpcy5jaGlsZHJlbjtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cclxuXHRcdFx0Y29udGVudCA9IGNvbE0ucmVuZGVyZXIocm93LmRhdGFbY29sTS5kYXRhSW5kZXhdKTtcclxuXHRcdFx0Ly8gVE9ETyBhZGRDbGFzcygoKT0+IHJvdy5jZWxsW2NvbE0uZGF0YUluZGV4XS5zZWxlY3RlZClcclxuXHRcdFx0Y2VsbHMuZ2V0KGNvbE0pLmh0bWwoY29udGVudCk7XHJcblxyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kbm9kZS5jc3MoJ3RvcCcsIG9mZnNldFRvcCkuYXR0cigncmlkJywgcm93LnJpZCk7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuJG5vZGU7XHJcblx0fVxyXG59XHJcblxyXG5jbGFzcyBCdWZmZXJOb2RlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHRjb25zdHJ1Y3RvcihsaW1pdCwgY29sc01vZGVsLCB0b3RhbCwgY2FjaGVUaW1lcykge1xyXG5cdFx0c3VwZXIoKTtcclxuXHRcdHRoaXMuaW5pdChsaW1pdCwgY29sc01vZGVsLCB0b3RhbCwgY2FjaGVUaW1lcyk7XHJcblx0fVxyXG5cclxuXHRpbml0KGxpbWl0LCBjb2xzTW9kZWwsIHRvdGFsLCBjYWNoZVRpbWVzKSB7XHJcblx0XHR0aGlzLmxpbWl0ID0gbGltaXQ7XHJcblx0XHR0aGlzLnRvdGFsID0gdG90YWw7XHJcblx0XHR0aGlzLmNhY2hlVGltZXMgPSBjYWNoZVRpbWVzIHx8IDM7XHJcblx0XHR0aGlzLm5vZGVMaXN0ID0gW107XHJcblx0XHR0aGlzLmNvbHNNb2RlbCA9IGNvbHNNb2RlbDtcclxuXHJcblx0XHQvLyDov5nph4zmmoLkuLpTZWxlY3Rpb27lrp7njrDvvIzlupTor6XnlKhBT1Dnu7TmiqQgVE9ET1xyXG5cdFx0Ly8gdGhpcy5vbigncm93LXVwZGF0ZS1iZWZvcmUnLCAocm93Tm9kZSwgcm93KSA9PiB0aGlzLmZpcmUoJ3Jvdy11cGRhdGUnLCByb3dOb2RlLCByb3cpKTtcclxuXHR9XHJcblxyXG5cdGdldE5vZGVMaXN0KCkge1xyXG5cdFx0cmV0dXJuIHRoaXMubm9kZUxpc3Q7XHJcblx0fVxyXG5cclxuXHRzZXRMaW1pdChsaW1pdCkge1xyXG5cdFx0aWYgKCtsaW1pdCA+IDApIHtcclxuXHRcdFx0dGhpcy5pbml0KGxpbWl0LCB0aGlzLmNvbHNNb2RlbCwgdGhpcy50b3RhbCwgdGhpcy5jYWNoZVRpbWVzKTtcclxuXHRcdFx0dGhpcy5maXJlKCdidWZmZXItaW5pdGlhbCcpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0c2V0VG90YWwodG90YWwpIHtcclxuXHRcdGlmICgrdG90YWwgPj0gMCkge1xyXG5cdFx0XHR0aGlzLnRvdGFsID0gdG90YWw7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRpc0Vub3VnaCgpIHtcclxuXHRcdHJldHVybiB0aGlzLm5vZGVMaXN0Lmxlbmd0aCA+PSBNYXRoLm1pbih0aGlzLnRvdGFsLCB0aGlzLmNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHR9XHJcblxyXG5cdGdldChkaXIsIGRvbWFpbikge1xyXG5cdFx0aWYgKHRoaXMuaXNFbm91Z2goKSkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5fZ2V0Tm9kZXMoZGlyLCBkb21haW4pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzLl9hZGROb2RlcyhkaXIsIGRvbWFpbik7XHJcblx0fVxyXG5cclxuXHRfZ2V0Tm9kZXMoZGlyLCBbc3RhcnQsIGVuZF0pIHtcclxuXHRcdHZhciBzZWxlY3RlZDtcclxuXHJcblx0XHRpZiAoZGlyID4gMCkge1xyXG5cdFx0XHRzZWxlY3RlZCA9IHRoaXMubm9kZUxpc3Quc2xpY2UoMCwgZW5kIC0gc3RhcnQgKyAxKTtcclxuXHRcdFx0dGhpcy5ub2RlTGlzdCA9IHRoaXMubm9kZUxpc3Quc2xpY2UoZW5kIC0gc3RhcnQgKyAxKS5jb25jYXQoc2VsZWN0ZWQpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0c2VsZWN0ZWQgPSB0aGlzLm5vZGVMaXN0LnNsaWNlKHN0YXJ0IC0gZW5kIC0gMSk7XHJcblx0XHRcdHRoaXMubm9kZUxpc3QgPSBzZWxlY3RlZC5jb25jYXQodGhpcy5ub2RlTGlzdC5zbGljZSgwLCBzdGFydCAtIGVuZCAtIDEpKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gc2VsZWN0ZWQgfHwgW107XHJcblx0fVxyXG5cclxuXHRfYWRkTm9kZXMoZGlyLCBbc3RhcnQsIGVuZF0pIHtcclxuXHRcdHZhciBub2RlcyA9IFtdO1xyXG5cclxuXHRcdGZvciAodmFyIGkgPSBzdGFydDsgaSA8PSBlbmQ7IGkrKykge1xyXG5cdFx0XHRub2Rlcy5wdXNoKG5ldyBSb3dOb2RlKHRoaXMuY29sc01vZGVsLCB0aGlzKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5ub2RlTGlzdCA9IGRpciA+IDAgPyB0aGlzLm5vZGVMaXN0LmNvbmNhdChub2RlcykgOiBub2Rlcy5jb25jYXQodGhpcy5ub2RlTGlzdCk7XHJcblxyXG5cdFx0cmV0dXJuIG5vZGVzO1xyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBCdWZmZXJOb2RlO1xyXG4iLCJjbGFzcyBCdWZmZXJab25lIHtcclxuXHRjb25zdHJ1Y3RvcihsaW1pdCwgdG90YWwsIGNhY2hlVGltZXMpIHtcclxuXHRcdHRoaXMuaW5pdChsaW1pdCwgdG90YWwsIGNhY2hlVGltZXMpO1xyXG5cdH1cclxuXHJcblx0aW5pdChsaW1pdCwgdG90YWwsIGNhY2hlVGltZXMpIHtcclxuXHRcdHRoaXMuc3RhcnQgPSAwO1xyXG5cdFx0dGhpcy5lbmQgPSB0aGlzLmxpbWl0ID0gbGltaXQ7XHJcblx0XHR0aGlzLnRvdGFsID0gK3RvdGFsO1xyXG5cdFx0dGhpcy5jYWNoZVRpbWVzID0gY2FjaGVUaW1lcyB8fCAzO1xyXG5cdFx0dGhpcy5kb21haW4gPSBbdGhpcy5zdGFydCwgdGhpcy5lbmRdO1xyXG5cdH1cclxuXHJcblx0c2V0TGltaXQobGltaXQpIHtcclxuXHRcdGlmICgrbGltaXQgPiAwKSB7XHJcblx0XHRcdHRoaXMuaW5pdChsaW1pdCwgdGhpcy50b3RhbCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRzZXRUb3RhbCh0b3RhbCkge1xyXG5cdFx0aWYgKCt0b3RhbCA+PSAwKSB7XHJcblx0XHRcdHRoaXMudG90YWwgPSB0b3RhbDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlzQW1vbmcodmFsdWUpIHtcclxuXHRcdHJldHVybiB0aGlzLnN0YXJ0IDw9IHZhbHVlICYmIHZhbHVlIDw9IHRoaXMuZW5kO1xyXG5cdH1cclxuXHJcblx0c2hvdWxkTG9hZChkaXIsIHZlcm5pZXIpIHtcclxuXHRcdGlmIChkaXIgPT09IDApIHJldHVybiBmYWxzZTtcclxuXHJcblx0XHR2YXIgc3RhcnQgPSB0aGlzLnN0YXJ0O1xyXG5cdFx0dmFyIGVuZCA9IHRoaXMuZW5kO1xyXG5cdFx0dmFyIGNhY2hlVGltZXMgPSB0aGlzLmNhY2hlVGltZXM7XHJcblxyXG5cdFx0Ly8gc2Nyb2xsIHVwXHJcblx0XHRpZiAoZGlyIDwgMCAmJiBzdGFydCA9PT0gMCkgcmV0dXJuIGZhbHNlO1xyXG5cdFx0aWYgKGRpciA8IDAgJiYgdmVybmllciA8IHN0YXJ0ICsgdGhpcy5saW1pdCkge1xyXG5cdFx0XHRpZiAodGhpcy5pc0Ftb25nKHZlcm5pZXIpKSB7XHJcblx0XHRcdFx0ZW5kID0gc3RhcnQgLSAxO1xyXG5cdFx0XHRcdHN0YXJ0ID0gTWF0aC5tYXgoMCwgZW5kIC0gdGhpcy5saW1pdCk7XHJcblx0XHRcdH0gZWxzZSBpZiAodmVybmllciA9PT0gMCkge1xyXG5cdFx0XHRcdGVuZCA9IE1hdGgubWluKHRoaXMudG90YWwsIHZlcm5pZXIgKyBjYWNoZVRpbWVzICogdGhpcy5saW1pdCk7XHJcblx0XHRcdFx0c3RhcnQgPSAwO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGVuZCA9IHZlcm5pZXIgKyB0aGlzLmxpbWl0O1xyXG5cdFx0XHRcdHN0YXJ0ID0gTWF0aC5tYXgoMCwgdmVybmllciAtIChjYWNoZVRpbWVzIC0gMSkgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5kb21haW4gPSBbc3RhcnQsIGVuZF07XHJcblx0XHRcdHRoaXMuc3RhcnQgPSBzdGFydDtcclxuXHRcdFx0dGhpcy5lbmQgPSBNYXRoLm1pbihzdGFydCArIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0LCB0aGlzLmVuZCk7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIHNjcm9sbCBkb3duXHJcblx0XHRpZiAoZGlyID4gMCAmJiBlbmQgPT09IHRoaXMudG90YWwpIHJldHVybiBmYWxzZTtcclxuXHRcdGlmIChkaXIgPiAwICYmIHZlcm5pZXIgPiBlbmQgLSB0aGlzLmxpbWl0KSB7XHJcblx0XHRcdC8vIOa4uOagh+WcqOeOsOacieiMg+WbtOWGhVxyXG5cdFx0XHRpZiAodGhpcy5pc0Ftb25nKHZlcm5pZXIpKSB7XHJcblx0XHRcdFx0c3RhcnQgPSBlbmQgKyAxO1xyXG5cdFx0XHRcdGVuZCA9IE1hdGgubWluKHRoaXMudG90YWwsIHN0YXJ0ICsgdGhpcy5saW1pdCk7XHJcblx0XHRcdH1cclxuXHRcdFx0Ly8g5ri45qCH5Yiw6L6+57uT5bC+XHJcblx0XHRcdGVsc2UgaWYgKHZlcm5pZXIgPT09IHRoaXMudG90YWwpIHtcclxuXHRcdFx0XHRlbmQgPSB0aGlzLnRvdGFsO1xyXG5cdFx0XHRcdHN0YXJ0ID0gTWF0aC5tYXgoMCwgdmVybmllciAtIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvLyDkuI3lnKjnjrDmnInojIPlm7Tlj4jmnKrliLDnu5PlsL7lpIRcclxuXHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0ZW5kID0gTWF0aC5taW4odGhpcy50b3RhbCwgdmVybmllciArIChjYWNoZVRpbWVzIC0gMSkgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0XHRzdGFydCA9IE1hdGgubWF4KDAsIGVuZCAtIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5kb21haW4gPSBbc3RhcnQsIGVuZF07XHJcblx0XHRcdHRoaXMuZW5kID0gZW5kO1xyXG5cdFx0XHR0aGlzLnN0YXJ0ID0gTWF0aC5tYXgodGhpcy5zdGFydCwgZW5kIC0gY2FjaGVUaW1lcyAqIHRoaXMubGltaXQpO1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBCdWZmZXJab25lOyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCcuLi91dGlsL0V2ZW50RW1pdHRlcicpO1xyXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuLi91dGlsL1V0aWxzJyk7XHJcbnZhciBfID0gcmVxdWlyZSgnLi4vdXRpbC9zaGltJykuXztcclxuXHJcbnZhciBkZWZSZW5kZXJlciA9IHYgPT4gdjtcclxudmFyIE9SREVSID0gWydBU0MnLCAnREVTQyddO1xyXG5cclxuY2xhc3MgQ29sdW1uIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHRjb25zdHJ1Y3RvcihjaWQsIG9wdGlvbnMsIGNvbnRleHQpIHtcclxuXHRcdHN1cGVyKCk7XHJcblxyXG5cdFx0b3B0aW9ucy5yZW5kZXJlciA9IG9wdGlvbnMucmVuZGVyZXIgfHwgZGVmUmVuZGVyZXI7XHJcblxyXG5cdFx0dmFyIGRlZmF1bHRzID0ge1xyXG5cdFx0XHQndGV4dCc6ICcnLFxyXG5cdFx0XHQndnR5cGUnOiAnc3RyaW5nJyxcclxuXHRcdFx0J2RhdGFJbmRleCc6ICcnLFxyXG5cdFx0XHQnd2lkdGgnOiA1MCxcclxuXHRcdFx0J2FsaWduJzogJ2xlZnQnLFxyXG5cclxuXHRcdFx0J3Jlc2l6YWJsZSc6IHRydWUsXHJcblx0XHRcdCdjbHMnOiAnJyxcclxuXHRcdFx0J2ZpeGVkJzogZmFsc2UsXHJcblx0XHRcdCdkcmFnZ2FibGUnOiBmYWxzZSxcclxuXHRcdFx0J3NvcnRhYmxlJzogdHJ1ZSxcclxuXHRcdFx0J2hpZGRlbic6IGZhbHNlLFxyXG5cdFx0XHQnbG9ja2VkJzogZmFsc2UsXHJcblx0XHRcdCdsb2NrYWJsZSc6IHRydWUsXHJcblx0XHRcdCdtZW51RGlzYWJsZWQnOiB0cnVlLFxyXG5cclxuXHRcdFx0Ly8gcHJpdmF0ZVxyXG5cdFx0XHQnc29ydFN0YXRlJzogbnVsbFxyXG5cdFx0fTtcclxuXHJcblx0XHR0aGlzLmNpZCA9IGNpZDtcclxuXHRcdHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XHJcblx0XHRPYmplY3QuYXNzaWduKHRoaXMsIGRlZmF1bHRzLCBvcHRpb25zKTtcclxuXHR9XHJcblxyXG5cdHNldFdpZHRoKG51bSkge1xyXG5cdFx0aWYgKCF0aGlzLnJlc2l6YWJsZSkgcmV0dXJuO1xyXG5cdFx0aWYgKGlzTmFOKG51bSkpIHJldHVybjtcclxuXHJcblx0XHR0aGlzLndpZHRoID0gK251bTtcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLXJlc2l6ZWQnLCB0aGlzLndpZHRoLCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdHNob3coKSB7XHJcblx0XHR0aGlzLmhpZGRlbiA9IGZhbHNlO1xyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4taGlkZGVuJywgdGhpcy5oaWRkZW4sIHRoaXMpO1xyXG5cdH1cclxuXHJcblx0aGlkZSgpIHtcclxuXHRcdHRoaXMudW5Mb2NrKCk7XHJcblx0XHRcclxuXHRcdHRoaXMuaGlkZGVuID0gdHJ1ZTtcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLWhpZGRlbicsIHRoaXMuaGlkZGVuLCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdHRvZ2dsZSgpIHtcclxuXHRcdGlmICh0aGlzLmhpZGRlbikge1xyXG5cdFx0XHR0aGlzLnNob3coKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoaXMuaGlkZSgpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0bG9jaygpIHtcclxuXHRcdGlmICghdGhpcy5sb2NrYWJsZSkgcmV0dXJuO1xyXG5cdFx0aWYgKHRoaXMubG9ja2VkKSByZXR1cm47XHJcblxyXG5cdFx0dGhpcy5zaG93KCk7XHJcblxyXG5cdFx0dGhpcy5sb2NrZWQgPSB0cnVlO1xyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4tbG9ja2VkJywgdGhpcy5sb2NrZWQsIHRoaXMpO1xyXG5cdH1cclxuXHJcblx0dW5Mb2NrKCkge1xyXG5cdFx0aWYgKCF0aGlzLmxvY2thYmxlKSByZXR1cm47XHJcblx0XHRpZiAoIXRoaXMubG9ja2VkKSByZXR1cm47XHJcblxyXG5cdFx0dGhpcy5sb2NrZWQgPSBmYWxzZTtcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLWxvY2tlZCcsIHRoaXMubG9ja2VkLCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIG9yZGVyW0FTQywgREVTQywgTk9fU09SVF1cclxuXHQgKi9cclxuXHRzb3J0KG9yZGVyKSB7XHJcblx0XHRpZiAoIXRoaXMuc29ydGFibGUgfHwgIXRoaXMuZGF0YUluZGV4KSByZXR1cm47XHJcblxyXG5cdFx0aWYgKG9yZGVyKSB7XHJcblx0XHRcdHRoaXMuc29ydFN0YXRlID0gT1JERVIuaW5jbHVkZXMob3JkZXIpID8gb3JkZXIgOiBudWxsO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhpcy5zb3J0U3RhdGUgPSB0aGlzLnNvcnRTdGF0ZSA9PT0gT1JERVJbMV0gPyBPUkRFUlswXSA6IE9SREVSWzFdO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1zb3J0LWNoYW5nZWQnLCB0aGlzLnNvcnRTdGF0ZSk7XHJcblx0XHR0aGlzLmNvbnRleHQuZmlyZSgnbm90aWNlLWNvbE1vZGVsLXNvcnQtY2hhbmdlZCcpO1xyXG4gXHR9XHJcblxyXG4gXHRtb3ZlVG8oaW5kZXgpIHtcclxuIFx0XHRpZiAoaXNOYU4oK2luZGV4KSkgcmV0dXJuO1xyXG5cclxuIFx0XHR0aGlzLmNvbnRleHQuZmlyZSgnY29sdW1uLW1vdmUtdG8nLCB0aGlzLCAraW5kZXggKyAxKTtcclxuIFx0fVxyXG5cclxuIFx0cmVtb3ZlKCkge1xyXG4gXHRcdHRoaXMuZmlyZSgnZGVzdG9yeScpO1xyXG4gXHRcdHRoaXMuY29udGV4dC5maXJlKCdjb2x1bW4tcmVtb3ZlZCcsIHRoaXMpO1xyXG4gXHRcdHRoaXMucmVtb3ZlRXZlbnQoKTtcclxuIFx0fVxyXG59XHJcblxyXG5cclxuY2xhc3MgQ29sTW9kZWwgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cdGNvbnN0cnVjdG9yKGNvbHVtbnMpIHtcclxuXHRcdHN1cGVyKCk7XHJcblxyXG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KGNvbHVtbnMpKSB7XHJcblx0XHRcdHRocm93ICdyZXF1aXJlIHByb3BlcnR5IGNvbHVtbnMgaXMgYSBhcnJheSBvYmplY3QnO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuY29sdW1ucyA9IFtdOyAvLyBkYXRhIGJ5IGNvbHVtblxyXG5cdFx0dGhpcy5jb2xNb2RlbCA9IG5ldyBNYXAoKTsgLy8gZGF0YSBieSBjaWRcclxuXHRcdHRoaXMuY29sSGVhZGVycyA9IG5ldyBNYXAoKTsgLy8gZGF0YSBieSBkYXRhSW5kZXhcclxuXHJcblx0XHR0aGlzLl9pbml0Q29sdW1uKGNvbHVtbnMpO1xyXG5cdFx0dGhpcy5fYmluZEV2ZW50KCk7XHJcblx0fVxyXG5cclxuXHRfaW5pdENvbHVtbihjb2x1bW5zLCBjYWxsYmFjaykge1xyXG5cdFx0bGV0IHNpemUgPSB0aGlzLnNpemUoKTtcclxuXHJcblx0XHRjb2x1bW5zLmZvckVhY2goKGNvbCwgaW5kZXgpID0+IHtcclxuXHRcdFx0Ly8gY2lk6Kej5Yaz5rKh5pyJZGF0YUluZGV45YiX5oiW55u45ZCMZGF0YUluZGV45YiX55qE6Zeu6aKYXHJcblx0XHRcdGxldCBjaWQgPSBpbmRleCArIHNpemU7XHJcblx0XHRcdGxldCBjb2xNID0gbmV3IENvbHVtbihjaWQsIGNvbCwgdGhpcyk7XHJcblxyXG5cdFx0XHR0aGlzLmNvbE1vZGVsLnNldChjaWQsIGNvbE0pO1xyXG5cdFx0XHR0aGlzLmNvbHVtbnMucHVzaChjb2xNKTtcclxuXHRcdFx0dGhpcy5jb2xIZWFkZXJzLnNldChjb2wuZGF0YUluZGV4LCBjb2xNKTtcclxuXHJcblx0XHRcdGNhbGxiYWNrICYmIGNhbGxiYWNrKGNvbE0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRhZGRDb2x1bW5zKGNvbHVtbnMpIHtcclxuXHRcdGlmICghQXJyYXkuaXNBcnJheShjb2x1bW5zKSkge1xyXG5cdFx0XHRjb2x1bW5zID0gW2NvbHVtbnNdO1xyXG5cdFx0fVxyXG5cdFx0dGhpcy5faW5pdENvbHVtbihjb2x1bW5zLCBjb2xNID0+IHRoaXMuZmlyZSgnY29sdW1uLWFkZCcsIGNvbE0pKTtcclxuXHR9XHJcblxyXG5cdHJlbW92ZUNvbHVtbihkYXRhSW5kZXgpIHtcclxuXHRcdGlmICghQXJyYXkuaXNBcnJheShkYXRhSW5kZXgpKSB7XHJcblx0XHRcdGRhdGFJbmRleCA9IFtkYXRhSW5kZXhdO1xyXG5cdFx0fVxyXG5cclxuXHRcdGRhdGFJbmRleC5mb3JFYWNoKGRzID0+IHtcclxuXHRcdFx0bGV0IGNvbE0gPSB0aGlzLmdldENvbHVtbkJ5RGF0YUluZGV4KGRzKTtcclxuXHJcblx0XHRcdGlmIChjb2xNKSB7XHJcblx0XHRcdFx0Y29sTS5yZW1vdmUoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRfYmluZEV2ZW50KCkge1xyXG5cdFx0dGhpcy5vbignbm90aWNlLWNvbE1vZGVsLXNvcnQtY2hhbmdlZCcsIF8uZGVib3VuY2UoKCkgPT4ge1xyXG5cdFx0XHR0aGlzLmZpcmUoJ2NvbHVtbnMtc29ydC1jaGFuZ2VkJyk7XHJcblx0XHR9LCAyMCkpO1xyXG5cclxuXHRcdHRoaXMub24oJ2NvbHVtbi1tb3ZlLXRvJywgKGNvbE0sIGluZGV4KSA9PiB7XHJcblx0XHRcdGxldCBjdXJyZW50ID0gdGhpcy5jb2x1bW5zLmluZGV4T2YoY29sTSk7XHJcblx0XHRcdHRoaXMuY29sdW1ucy5zcGxpY2UoaW5kZXgsIDAsIHRoaXMuY29sdW1ucy5zcGxpY2UoY3VycmVudCwgMSlbMF0pO1xyXG5cdFx0XHQvLyB0aGlzLmNvbHVtbnMuc3BsaWNlKGluZGV4LCAwLCB0aGlzLmNvbHVtbnNbY3VycmVudF0pO1xyXG5cdFx0XHQvLyB0aGlzLmNvbHVtbnMuc3BsaWNlKGluZGV4ID4gY3VycmVudCA/IGN1cnJlbnQgOiBjdXJyZW50ICsgMSwgMSk7XHJcblxyXG5cdFx0XHR0aGlzLmNvbHVtbnMuZm9yRWFjaChjb2xNID0+IGNvbnNvbGUubG9nKGNvbE0uZGF0YUluZGV4KSk7XHJcblxyXG5cdFx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1tb3ZlZCcsIGNvbE0sIGluZGV4KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMub24oJ2NvbHVtbi1yZW1vdmVkJywgY29sTSA9PiB7XHJcblx0XHRcdHRoaXMuY29sdW1ucyA9IHRoaXMuY29sdW1ucy5maWx0ZXIoY29sID0+IGNvbC5kYXRhSW5kZXggIT0gY29sTS5kYXRhSW5kZXgpO1xyXG5cdFx0XHR0aGlzLmNvbE1vZGVsLmRlbGV0ZShjb2xNLmNpZCk7XHJcblx0XHRcdHRoaXMuY29sSGVhZGVycy5kZWxldGUoY29sTS5kYXRhSW5kZXgpO1xyXG5cdFx0fSk7XHJcblxyXG5cdH1cclxuXHJcblx0c2l6ZSgpIHsgXHJcblx0XHRyZXR1cm4gdGhpcy5jb2xNb2RlbC5zaXplOyBcclxuXHR9XHJcblxyXG5cdGdldENvbHVtbihjb2wpIHtcclxuXHRcdGlmICh0aGlzLmNvbHVtbnMuaW5jbHVkZXMoY29sKSkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5jb2x1bW5zLmZpbHRlcihfY29sID0+IF9jb2wgPT0gY29sKVswXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcy5jb2x1bW5zO1xyXG5cdH1cclxuXHJcblx0Z2V0TG9ja0NvbHVtbigpIHtcclxuXHRcdHJldHVybiB0aGlzLmNvbHVtbnMuZmlsdGVyKGNvbE0gPT4ge1xyXG5cdFx0XHRyZXR1cm4gY29sTS5sb2NrZWQgPT09IHRydWU7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGdldFZpc2libGVDb2x1bW4oKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5jb2x1bW5zLmZpbHRlcihjb2xNID0+IHtcclxuXHRcdFx0cmV0dXJuICFjb2xNLmhpZGRlbjtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0Z2V0Q29sdW1uQnlEYXRhSW5kZXgoZGF0YUluZGV4KSB7XHJcblx0XHRyZXR1cm4gdGhpcy5jb2xIZWFkZXJzLmdldChkYXRhSW5kZXgpIHx8IG51bGw7XHJcblx0fVxyXG5cclxuXHRnZXRDb2x1bW5zQnlJZChpZCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuY29sTW9kZWxbaWRdIHx8IG51bGw7XHJcblx0fVxyXG5cclxuXHRlYWNoKGNhbGxiYWNrLCBjb250ZXh0KSB7XHJcblx0XHR0aGlzLmNvbHVtbnMuZm9yRWFjaChjYWxsYmFjaywgY29udGV4dCB8fCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdGRlc3RvcnkoKSB7IFxyXG5cclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQ29sTW9kZWw7IiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJy4uL3V0aWwvRXZlbnRFbWl0dGVyJyk7XHJcbnZhciBVdGlscyA9IHJlcXVpcmUoJy4uL3V0aWwvVXRpbHMnKTtcclxudmFyIF8gPSByZXF1aXJlKCcuLi91dGlsL3NoaW0nKS5fO1xyXG5cclxuY2xhc3MgUm93IHtcclxuXHRjb25zdHJ1Y3RvcihyaWQsIGRhdGEpIHtcclxuXHRcdHRoaXMucmlkID0gcmlkO1xyXG5cdFx0dGhpcy5kYXRhID0gZGF0YTtcclxuXHRcdHRoaXMuc2VsZWN0ZWQgPSBmYWxzZTtcclxuXHR9XHJcblx0c3RhdGUoKSB7fVxyXG59XHJcblxyXG5jbGFzcyBHcmlkU3RvcmUgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cclxuXHRjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcblx0XHRzdXBlcigpO1xyXG5cclxuXHRcdHRoaXMuY29sc01vZGVsID0gb3B0aW9ucy5jb2x1bW5Nb2RlbDtcclxuXHJcblx0XHR0aGlzLnJvd3MgPSBbXTsgLy8gZGF0YSBieSBpbmRleFxyXG5cdFx0dGhpcy5yb3dNb2RlbCA9IG5ldyBNYXAoKTsgLy8gZGF0YSBieSBpZFxyXG5cclxuXHJcblx0XHR0aGlzLnNldERhdGEob3B0aW9ucy5kYXRhKTtcclxuXHJcblx0XHR0aGlzLl9zb3J0U3RhdGUgPSB7IGtleXM6IFtdLCBkaXJzOiBbXSB9O1xyXG5cdFx0dGhpcy5fYmluZEV2ZW50KCk7XHJcblx0fVxyXG5cclxuXHRfYmluZEV2ZW50KCkge1xyXG5cclxuXHRcdHRoaXMuY29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1zb3J0LWNoYW5nZWQnLCBzb3J0U3RhdGUgPT4ge1xyXG5cdFx0XHRcdGxldCB7IGtleXMsIGRpcnMgfSA9IHRoaXMuX3NvcnRTdGF0ZTtcclxuXHRcdFx0XHRsZXQgaW5kZXggPSBrZXlzLmluZGV4T2YoY29sTS5kYXRhSW5kZXgpO1xyXG5cclxuXHRcdFx0XHQvLyDmnKrmjpLluo9cclxuXHRcdFx0XHRpZiAoaW5kZXggPT09IC0xICYmICFzb3J0U3RhdGUpIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmIChpbmRleCA9PT0gLTEgJiYgc29ydFN0YXRlKSB7XHJcblx0XHRcdFx0XHRrZXlzLnVuc2hpZnQoY29sTS5kYXRhSW5kZXgpO1xyXG5cdFx0XHRcdFx0ZGlycy51bnNoaWZ0KHNvcnRTdGF0ZS50b0xvd2VyQ2FzZSgpKTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIOW3suaOkuW6jyzlhYjliKDpmaRcclxuXHRcdFx0XHRsZXQga2V5ID0ga2V5cy5zcGxpY2UoaW5kZXgsIDEpWzBdO1xyXG5cdFx0XHRcdGxldCBkaXIgPSBkaXJzLnNwbGljZShpbmRleCwgMSlbMF07XHJcblxyXG5cdFx0XHRcdGlmIChzb3J0U3RhdGUpIHtcclxuXHRcdFx0XHRcdGtleXMudW5zaGlmdChrZXkpO1xyXG5cdFx0XHRcdFx0ZGlycy51bnNoaWZ0KHNvcnRTdGF0ZS50b0xvd2VyQ2FzZSgpKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdC8vIOaJgOacieWIl+mDveabtOaWsOeKtuaAgeWQjlxyXG5cdFx0dGhpcy5jb2xzTW9kZWwub24oJ2NvbHVtbnMtc29ydC1jaGFuZ2VkJywgKCkgPT4ge1xyXG5cdFx0XHRsZXQgeyBrZXlzLCBkaXJzIH0gPSB0aGlzLl9zb3J0U3RhdGU7XHJcblx0XHRcdGxldCBpdGVyYXRlRm4gPSByb3cgPT4gcm93LmRhdGFba2V5c1swXV07XHJcblxyXG5cdFx0XHQvLyBjb25zb2xlLmxvZyhrZXlzLCBkaXJzKTtcclxuXHJcblx0XHRcdHRoaXMucm93cyA9IF8ub3JkZXJCeSh0aGlzLnJvd3MsIGl0ZXJhdGVGbiwgZGlycyk7XHJcblx0XHRcdHRoaXMuc2V0RGF0YShfLm1hcCh0aGlzLnJvd3MsICdkYXRhJykpO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRzbGljZShzdGFydCwgZW5kKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yb3dzLnNsaWNlKHN0YXJ0LCBlbmQpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICog6K6+572u5o6S5bqP54q25oCBXHJcblx0ICogKCspQVNDLCAtREVTQywgIU5PX1NPUlRcclxuXHQgKiBAc29ydHMge0FycmF5fSBzb3J0cyAt5o6S5bqP54q25oCB5pWw57uEXHJcblx0ICpcdHNvcnRzID0gWycrY29sQScsICdjb2xCJywgJy1jb2xDJywgJyFjb2xEJ11cclxuXHQgKiBAcmV0dXJucyB0aGlzO1xyXG5cdCAqL1xyXG5cdHNldFNvcnRTdGF0ZShzb3J0cykge1xyXG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KHNvcnRzKSkge1xyXG5cdFx0XHRzb3J0cyA9IFtzb3J0c107XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5fc29ydFN0YXRlID0geyBrZXlzOiBbXSwgZGlyczogW10gfTtcclxuXHJcblx0XHQvLyDlj43ovazkvJjlhYjnuqfmlrnkvr/lkI7nu63op6blj5Hpobrluo/ml7blkI7op6blj5HnmoTkvJjlhYjnuqfpq5hcclxuXHRcdHNvcnRzLnJldmVyc2UoKS5lYWNoKHNvcnRPYmogPT4ge1xyXG5cdFx0XHRsZXQgb2JqLCBrZXksIGRpciwgY29sO1xyXG5cclxuXHRcdFx0aWYgKHR5cGVvZiBzb3J0T2JqID09PSAnc3RyaW5nJykge1xyXG5cdFx0XHRcdG9iaiA9IHNvcnRPYmoubWF0Y2goLyheWyt8LXwhXT8pKC57MCx9KS8pO1xyXG5cdFx0XHRcdGRpciA9IG9ialsxXSA9PT0gJycgPyAnQVNDJyA6IChvYmogPT09ICctJyA/ICdERVNDJyA6ICdOT19TT1JUJyk7XHJcblx0XHRcdFx0a2V5ID0gb2JqWzJdID8gb2JqWzJdIDogbnVsbDtcclxuXHJcblx0XHRcdFx0Y29sID0gdGhpcy5jb2xzTW9kZWwuZ2V0Q29sdW1uQnlEYXRhSW5kZXgoa2V5KTtcclxuXHRcdFx0XHRpZiAoY29sKSB7XHJcblx0XHRcdFx0XHRjb2wuc29ydChkaXIpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRzZXREYXRhKGRhdGEgPSBbXSwgYXBwZW5kID0gZmFsc2UpIHtcclxuXHRcdGlmICghYXBwZW5kKSB7XHJcblx0XHRcdHRoaXMucm93cy5sZW5ndGggPSAwO1xyXG5cdFx0XHR0aGlzLnJvd01vZGVsLmNsZWFyKCk7XHJcblx0XHR9XHJcblx0XHR2YXIgaW5kZXggPSB0aGlzLnNpemUoKTtcclxuXHRcdGRhdGEuZm9yRWFjaCgocm93LCByaWR4KSA9PiB7XHJcblx0XHRcdGxldCByb3dNID0gbmV3IFJvdyhyaWR4ICsgaW5kZXgsIHJvdyk7XHJcblx0XHRcdHRoaXMucm93cy5wdXNoKHJvd00pO1xyXG5cdFx0XHR0aGlzLnJvd01vZGVsLnNldChyaWR4ICsgaW5kZXgsIHJvd00pO1xyXG5cdFx0fSk7XHJcblx0XHR0aGlzLmZpcmUoJ2RhdGEtY2hhbmdlZCcsIGFwcGVuZCk7XHJcblx0fVxyXG5cclxuXHRmb3JFYWNoKGNhbGxiYWNrLCBjb250ZXh0KSB7XHJcblx0XHR0aGlzLnJvd3MuZm9yRWFjaChmdW5jdGlvbihyb3dNLCByaWR4KSB7XHJcblx0XHRcdGNhbGxiYWNrLmNhbGwodGhpcywgcm93TS5kYXRhLCByaWR4KTtcclxuXHRcdH0sIGNvbnRleHQgfHwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHRzaXplKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMucm93TW9kZWwuc2l6ZTtcclxuXHR9XHJcblxyXG5cdGRlc3RvcnkoKSB7IFxyXG5cclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gR3JpZFN0b3JlOyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCcuLi91dGlsL0V2ZW50RW1pdHRlcicpO1xyXG52YXIgQ29sTW9kZWwgPSByZXF1aXJlKCcuL0NvbE1vZGVsJyk7XHJcbnZhciBHcmlkU3RvcmUgPSByZXF1aXJlKCcuL0dyaWRTdG9yZScpO1xyXG52YXIgQnVmZmVyTm9kZSA9IHJlcXVpcmUoJy4vQnVmZmVyTm9kZScpO1xyXG52YXIgQnVmZmVyWm9uZSA9IHJlcXVpcmUoJy4vQnVmZmVyWm9uZScpO1xyXG52YXIgSGVhZGVyID0gcmVxdWlyZSgnLi9IZWFkZXInKTtcclxudmFyIExvY2tDb2xNYW5hZ2VyID0gcmVxdWlyZSgnLi9Mb2NrQ29sTWFuYWdlcicpO1xyXG52YXIgU2Nyb2xsZXIgPSByZXF1aXJlKCcuL1Njcm9sbGVyJyk7XHJcbnZhciBVdGlscyA9IHJlcXVpcmUoJy4uL3V0aWwvVXRpbHMnKTtcclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZUxheW91dChjb250YWluZXIsIHdpZHRoKSB7XHJcblx0dmFyIHdyYXBwZXIgPSAkKCc8ZGl2Lz4nKS5hZGRDbGFzcygnYy1ncmlkLXdyYXBwZXInKS53aWR0aCh3aWR0aCk7XHJcblx0dmFyIGhlYWRlciA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWdyaWQtaGVhZGVyJyk7XHJcblx0dmFyIGJvZHkgPSAkKCc8ZGl2Lz4nKS5hZGRDbGFzcygnYy1ncmlkLWJvZHknKTtcclxuXHR2YXIgdmlld3BvcnQgPSAkKCc8ZGl2Lz4nKS5hZGRDbGFzcygnYy1ncmlkLXZpZXdwb3J0JykuYXBwZW5kVG8oYm9keSk7XHJcblx0dmFyIGNhbnZhcyA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWdyaWQtY2FudmFzJykuYXBwZW5kVG8odmlld3BvcnQpO1xyXG5cdHdyYXBwZXIuYXBwZW5kKGhlYWRlcikuYXBwZW5kKGJvZHkpLmFwcGVuZFRvKGNvbnRhaW5lcik7XHJcblxyXG5cdHJldHVybiB7IHdyYXBwZXIsIGhlYWRlciwgYm9keSwgdmlld3BvcnQsIGNhbnZhcyB9O1xyXG59XHJcbmZ1bmN0aW9uIGNhbGNSb3dIZWlnaHQoKSB7XHJcblx0dmFyIGxpID0gJCgnPGxpIGNsYXNzPVwiYy1ncmlkLWNlbGxcIj5wbGFjZWhvbGRlcjwvbGk+JykuYXBwZW5kVG8oXCJib2R5XCIpO1xyXG5cdHZhciByb3dIZWlnaHQgPSBsaS5vdXRlckhlaWdodCgpO1xyXG5cdGxpLnJlbW92ZSgpO1xyXG5cclxuXHRyZXR1cm4gcm93SGVpZ2h0O1xyXG59XHJcblxyXG5jbGFzcyBHcmlkQ29tcG9uZW50IGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHRjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcblx0XHRzdXBlcigpO1xyXG5cclxuXHRcdGlmICghJChvcHRpb25zLmRvbUVsKS5zaXplKCkpIHsgdGhyb3cgJ3JlcXVpcmUgYSB2YWxpZCBkb21FbCc7IH1cclxuXHJcblx0XHR0aGlzLnNob3VsZEFkZE5vZGVzID0gdHJ1ZTtcclxuXHRcdHRoaXMuaGVpZ2h0ID0gK29wdGlvbnMuaGVpZ2h0IHx8IDUwMDtcclxuXHRcdHRoaXMud2lkdGggPSBvcHRpb25zLndpZHRoO1xyXG5cclxuXHRcdC8vICRsYXlvdXQgZG9tXHJcblx0XHRPYmplY3QuYXNzaWduKHRoaXMuJGRvbSA9IHt9LCBjcmVhdGVMYXlvdXQoJChvcHRpb25zLmRvbUVsKSwgdGhpcy53aWR0aCkpO1xyXG5cclxuXHRcdHRoaXMuY29sdW1uTW9kZWwgPSBuZXcgQ29sTW9kZWwob3B0aW9ucy5jb2x1bW5zKTtcclxuXHRcdHRoaXMuc3RvcmUgPSBuZXcgR3JpZFN0b3JlKHsgY29sdW1uTW9kZWw6IHRoaXMuY29sdW1uTW9kZWwsICdkYXRhJzogb3B0aW9ucy5kYXRhIHx8IFtdIH0pO1xyXG5cdFx0dGhpcy5faW5pdCgpO1xyXG5cdFx0dGhpcy5fYmluZEV2ZW50KCk7XHJcblx0fVxyXG5cclxuXHRfaW5pdCgpIHtcclxuXHRcdHRoaXMuaGVhZGVyID0gbmV3IEhlYWRlcih0aGlzLiRkb20uaGVhZGVyLCB0aGlzLmNvbHVtbk1vZGVsKTtcclxuXHRcdHZhciB0b3RhbCA9IHRoaXMuc3RvcmUuc2l6ZSgpO1xyXG5cdFx0dmFyIHJvd0hlaWdodCA9IHRoaXMucm93SGVpZ2h0ID0gY2FsY1Jvd0hlaWdodCgpO1xyXG5cdFx0dmFyIHZpZXdwb3J0SGVpZ2h0ID0gdGhpcy5oZWlnaHQgLSB0aGlzLiRkb20uaGVhZGVyLm91dGVySGVpZ2h0KCk7XHJcblx0XHR2YXIgc2luZ2xlUGFnZVNpemUgPSBNYXRoLm1pbihNYXRoLmNlaWwodmlld3BvcnRIZWlnaHQvIHJvd0hlaWdodCkgLSAxLCB0b3RhbCAtIDEpO1xyXG5cclxuXHRcdHRoaXMuYnVmZmVyWm9uZSA9IG5ldyBCdWZmZXJab25lKHNpbmdsZVBhZ2VTaXplLCB0b3RhbCk7XHJcblx0XHR0aGlzLmJ1ZmZlck5vZGUgPSBuZXcgQnVmZmVyTm9kZShzaW5nbGVQYWdlU2l6ZSwgdGhpcy5jb2x1bW5Nb2RlbCwgdG90YWwpO1xyXG5cdFx0dGhpcy5zY3JvbGxlciA9IG5ldyBTY3JvbGxlcihyb3dIZWlnaHQsIHRoaXMuYnVmZmVyWm9uZSk7XHJcblx0XHR0aGlzLnNjcm9sbGVyXHJcblx0XHRcdC5vblgoeCA9PiB7XHJcblx0XHRcdFx0dGhpcy5maXJlKCdzY3JvbGxMZWZ0JywgeCk7XHJcblx0XHRcdFx0dGhpcy4kZG9tLmhlYWRlci5zY3JvbGxMZWZ0KHgpO1xyXG5cdFx0XHR9KVxyXG5cdFx0XHQub25ZKChkaXIsIGRvbWFpbiwgc3RhcnQsIGVuZCwgaW5kZXgsIHRvdGFsKSA9PiB7XHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coYOa7muWKqOaWueWQke+8miR7ZGlyfSwg5Yqg6L295Yy66Ze0OiBbJHtkb21haW59XSwg546w5pyJ6IyD5Zu077yaKCR7c3RhcnR9IC0gJHtlbmR9KSwgYClcclxuXHRcdFx0XHR0aGlzLl9idWZmZXJSZW5kZXIoZGlyLCBkb21haW4pO1xyXG5cdFx0XHR9LCAyMCk7XHJcblxyXG5cdFx0dGhpcy4kZG9tLnZpZXdwb3J0LmhlaWdodCh2aWV3cG9ydEhlaWdodCk7XHJcblx0XHR0aGlzLiRkb20udmlld3BvcnQub24oJ3Njcm9sbCcsIChldnQpID0+IHtcclxuXHRcdFx0dGhpcy5zY3JvbGxlci5maXJlWShldnQudGFyZ2V0LnNjcm9sbFRvcCk7XHJcblx0XHRcdHRoaXMuc2Nyb2xsZXIuZmlyZVgoZXZ0LnRhcmdldC5zY3JvbGxMZWZ0KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMubG9ja0NvbE1hbmFnZXIgPSBMb2NrQ29sTWFuYWdlcih0aGlzLmNvbHVtbk1vZGVsLCB0aGlzLmhlYWRlciwgdGhpcy4kZG9tLCB0aGlzLmJ1ZmZlck5vZGUpO1xyXG5cdFx0dGhpcy5fc2V0Q2FudmFzV0godG90YWwpO1xyXG5cdH1cclxuXHJcblx0X3NldENhbnZhc1dIKHRvdGFsKSB7XHJcblx0XHR0aGlzLiRkb20uY2FudmFzXHJcblx0XHRcdC53aWR0aCh0b3RhbCA/ICdhdXRvJyA6IHRoaXMuX3VuTG9ja1Zpc2libGVDb2xzV2lkdGgoKSlcclxuXHRcdFx0LmhlaWdodCh0aGlzLnJvd0hlaWdodCAqIHRvdGFsIHx8IDEpO1xyXG5cdH1cclxuXHJcblx0X3VuTG9ja1Zpc2libGVDb2xzV2lkdGgoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5oZWFkZXIuZ2V0VmlzaWJsZUNvbHNXaWR0aCgpICsgdGhpcy5sb2NrQ29sTWFuYWdlci52aXNpYmxlTG9ja0NvbHVtbi5nZXRXaWR0aCgpO1xyXG5cdH1cclxuXHJcblx0c2Nyb2xsVG9Ub3AocG9zaXRpb24pIHtcclxuXHRcdHRoaXMuJGRvbS52aWV3cG9ydC5zY3JvbGxUb3AocG9zaXRpb24pO1xyXG5cdH1cclxuXHJcblx0X2JpbmRFdmVudCgpIHtcclxuXHRcdHRoaXMub24oJ3ZpZXdwb3J0LWhlaWdodC1jaGFuZ2VkJywgdmlld3BvcnRIZWlnaHQgPT4ge1xyXG5cdFx0XHR0aGlzLl91cGRhdGVCdWZmZXIoKTtcclxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMub24oJ3Njcm9sbExlZnQnLCB4ID0+IHtcclxuXHRcdFx0Ly8gcGVyZm9ybWFuY2UgVE9ET1xyXG5cdFx0XHQvLyBsZXQgbG9ja0NvbHVtbldpZHRoID0gdGhpcy5oZWFkZXIuZ2V0VmlzaWJsZUxvY2tDb2xzV2lkdGgoKTtcclxuXHRcdFx0Ly8gdGhpcy4kZG9tLmNhbnZhcy5maW5kKCcuYy1jb2x1bW4tbG9ja2VkJykuY3NzKCdsZWZ0JywgeCAtIGxvY2tDb2x1bW5XaWR0aCk7XHJcblx0XHRcdC8vIHRoaXMuJGRvbS5oZWFkZXIuZmluZCgnLmMtY29sdW1uLWxvY2tlZCcpLmNzcygnbGVmdCcsIHggLSBsb2NrQ29sdW1uV2lkdGgpO1xyXG5cdFx0XHR0aGlzLmxvY2tDb2xNYW5hZ2VyLnNldExvY2tDb2x1bW5YKHgpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5zdG9yZS5vbignZGF0YS1jaGFuZ2VkJywgKGFwcGVuZCkgPT4ge1xyXG5cdFx0XHRsZXQgdG90YWwgPSB0aGlzLnN0b3JlLnNpemUoKTtcclxuXHRcdFx0dGhpcy5fc2V0Q2FudmFzV0godG90YWwpO1xyXG5cdFx0XHR0aGlzLmJ1ZmZlck5vZGUuc2V0VG90YWwodG90YWwpO1xyXG5cdFx0XHR0aGlzLmJ1ZmZlclpvbmUuc2V0VG90YWwodG90YWwpO1xyXG5cclxuXHRcdFx0aWYgKCFhcHBlbmQgfHwgKHRvdGFsIC0gMSkgKiB0aGlzLnJvd0hlaWdodCA8IDIqdGhpcy4kZG9tLnZpZXdwb3J0Lm91dGVySGVpZ2h0KCkpIHtcclxuXHRcdFx0XHR0aGlzLl91cGRhdGVCdWZmZXIoKTtcclxuXHRcdFx0XHR0aGlzLnJlbmRlcigpO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHJcblx0fVxyXG5cclxuXHRfdXBkYXRlQnVmZmVyKCkge1xyXG5cdFx0dmFyIGxpbWl0ID0gTWF0aC5taW4oXHJcblx0XHRcdE1hdGguY2VpbCh0aGlzLiRkb20udmlld3BvcnQub3V0ZXJIZWlnaHQoKSAvIHRoaXMucm93SGVpZ2h0KSAtIDEsXHJcblx0XHRcdHRoaXMuc3RvcmUuc2l6ZSgpIC0gMSk7XHJcblxyXG5cdFx0dGhpcy5idWZmZXJab25lLnNldExpbWl0KGxpbWl0KTtcclxuXHRcdHRoaXMuYnVmZmVyTm9kZS5zZXRMaW1pdChsaW1pdCk7XHJcblx0XHR0aGlzLnNob3VsZEFkZE5vZGVzID0gdHJ1ZTtcclxuXHRcdHRoaXMuc2Nyb2xsVG9Ub3AoMCk7XHJcblxyXG5cdFx0dGhpcy4kZG9tLmNhbnZhcy5lbXB0eSgpO1xyXG5cdH1cclxuXHJcblx0X2J1ZmZlclJlbmRlcihkaXIsIFtzdGFydCwgZW5kXSkge1xyXG5cdFx0dmFyIG5vZGVzID0gdGhpcy5idWZmZXJOb2RlLmdldChkaXIsIFtzdGFydCwgZW5kXSk7XHJcblx0XHRjb25zb2xlLmxvZygn5LiA5qyh6I635Y+W6IqC54K56ZW/5bqmJywgbm9kZXMubGVuZ3RoLCBzdGFydCwgZW5kKTtcclxuXHJcblx0XHRpZiAoIXRoaXMuc2hvdWxkQWRkTm9kZXMpIHtcclxuXHRcdFx0dGhpcy5zdG9yZS5zbGljZShzdGFydCwgZW5kICsgMSkuZm9yRWFjaCgocm93TSwgaSkgPT4ge1xyXG5cdFx0XHRcdG5vZGVzW2ldLnNldERhdGEocm93TSwgcm93TS5yaWQgKiB0aGlzLnJvd0hlaWdodCk7XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0dmFyICRkb2NGcmFtZSA9ICQoJzxkaXYvPicpO1xyXG5cdFx0dGhpcy5zdG9yZS5zbGljZShzdGFydCwgZW5kICsgMSkuZm9yRWFjaCgocm93TSwgaSkgPT4ge1xyXG5cclxuXHRcdFx0bGV0IG5vZGUgPSBub2Rlc1tpXS5zZXREYXRhKHJvd00sIHJvd00ucmlkICogdGhpcy5yb3dIZWlnaHQpO1xyXG5cdFx0XHQkZG9jRnJhbWUuYXBwZW5kKG5vZGUpO1xyXG5cdFx0XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLiRkb20uY2FudmFzLmFwcGVuZCgkZG9jRnJhbWUuY2hpbGRyZW4oKSk7XHJcblx0XHR0aGlzLmxvY2tDb2xNYW5hZ2VyLmFkZEJ1ZmZlckxvY2tOb2RlKG5vZGVzKTtcclxuXHJcblx0XHRpZiAodGhpcy5idWZmZXJOb2RlLmlzRW5vdWdoKCkpIHtcclxuXHRcdFx0dGhpcy5zaG91bGRBZGROb2RlcyA9IGZhbHNlO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmVuZGVyKCkge1xyXG5cdFx0dGhpcy5fYnVmZmVyUmVuZGVyKDEsIHRoaXMuYnVmZmVyWm9uZS5kb21haW4pO1xyXG5cdH1cclxuXHJcblx0c2V0V2lkdGgobnVtKSB7XHJcblx0XHRpZiAoaXNOYU4obnVtKSkgcmV0dXJuO1xyXG5cclxuXHRcdHRoaXMuJGRvbS53cmFwcGVyLndpZHRoKG51bSk7XHJcblx0fVxyXG5cclxuXHRzZXRIZWlnaHQobnVtKSB7XHJcblx0XHRpZiAoaXNOYU4obnVtKSkgcmV0dXJuO1xyXG5cclxuXHRcdHZhciB2aWV3cG9ydEhlaWdodCA9IG51bSAtIHRoaXMuJGRvbS5oZWFkZXIub3V0ZXJIZWlnaHQoKTtcclxuXHRcdHRoaXMuJGRvbS52aWV3cG9ydC5vdXRlckhlaWdodCh2aWV3cG9ydEhlaWdodCk7XHJcblx0XHR0aGlzLmZpcmUoJ3ZpZXdwb3J0LWhlaWdodC1jaGFuZ2VkJywgdmlld3BvcnRIZWlnaHQpO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHtcclxuXHRcdHRoaXMuY29sdW1uTW9kZWwuZGVzdG9yeSgpO1xyXG5cdFx0dGhpcy5zdG9yZS5kZXN0b3J5KCk7XHJcblx0XHR0aGlzLmhlYWRlci5kZXN0b3J5KCk7XHJcblx0XHR0aGlzLiRkb20ud3JhcHBlci5yZW1vdmUoKTtcclxuXHR9XHJcbn1cclxubW9kdWxlLmV4cG9ydHMgPSBHcmlkQ29tcG9uZW50OyIsImNvbnN0IHsgJCwgXyB9ID0gcmVxdWlyZSgnLi4vdXRpbC9zaGltJyk7XHJcbmNvbnN0IEREID0gcmVxdWlyZSgnLi4vdXRpbC9ERCcpO1xyXG5cclxuY29uc3QgU09SVF9DTFNfQVNDID0gJ2MtY29sdW1uLWFzYyc7XHJcbmNvbnN0IFNPUlRfQ0xTX0RFU0MgPSAnYy1jb2x1bW4tZGVzYyc7XHJcbmNvbnN0IE5FRURMRVNTX1dJRFRIID0gMTAwMDtcclxuXHJcbnZhciBjcmVhdGVDb2x1bW5FbGVtZW50ID0gZnVuY3Rpb24oY29sTSkge1xyXG5cdHZhciBsb2NrQ2xhc3MgPSBjb2xNLmxvY2tlZCA/ICcgYy1jb2x1bW4tbG9ja2VkJyA6ICcnO1xyXG5cclxuXHRyZXR1cm4gJCgnPGxpLz4nKVxyXG5cdFx0LmFkZENsYXNzKCdjLWhlYWRlci1jZWxsJyArIGxvY2tDbGFzcylcclxuXHRcdC5hZGRDbGFzcygnYy1hbGlnbi0nICsgY29sTS5hbGlnbilcclxuXHRcdC53aWR0aChjb2xNLndpZHRoKVxyXG5cdFx0Lm9uKCdjbGljaycsICgpID0+IHsgY29sTS5zb3J0KCk7IH0pXHJcblx0XHQuZGF0YSgnY29sdW1uJywgY29sTSlcclxuXHRcdC5odG1sKGNvbE0udGV4dCk7XHJcbn07XHJcblxyXG5cclxuY2xhc3MgSGVhZGVyIHtcclxuXHRjb25zdHJ1Y3RvcigkaGVhZGVyLCBjb2xzTW9kZWwpIHtcclxuXHJcblx0XHR0aGlzLiRoZWFkZXIgPSAkaGVhZGVyO1xyXG5cdFx0dGhpcy5jb2xzTW9kZWwgPSBjb2xzTW9kZWw7XHJcblx0XHQvLyB0aGlzLnN0b3JlID0gc3RvcmU7XHJcblx0XHR0aGlzLmNvbEVsZW1lbnRzID0gbmV3IE1hcCgpO1xyXG5cclxuXHRcdHRoaXMuX2NyZWF0ZUNvbHVtbkVsZW1lbnRzKCk7XHJcblx0XHR0aGlzLl9iaW5kRXZlbnQoKTtcclxuXHJcblx0XHR0aGlzLnJlbmRlcigpO1xyXG5cdH1cclxuXHJcblx0X2NyZWF0ZUNvbHVtbkVsZW1lbnRzKCkge1xyXG5cdFx0dmFyIHdpZHRoID0gTkVFRExFU1NfV0lEVEg7XHJcblxyXG5cdFx0dGhpcy4kcm93ID0gJCgnPHVsLz4nKS5hZGRDbGFzcygnYy1oZWFkZXItcm93Jyk7XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwuZWFjaChjb2xNID0+IHtcclxuXHRcdFx0bGV0IGNvbEVsZW1lbnQgPSBjcmVhdGVDb2x1bW5FbGVtZW50KGNvbE0pO1xyXG5cclxuXHRcdFx0dGhpcy5jb2xFbGVtZW50cy5zZXQoY29sTSwgY29sRWxlbWVudCk7XHJcblx0XHRcdHRoaXMuJHJvdy5hcHBlbmQoY29sRWxlbWVudCk7XHJcblxyXG5cdFx0XHR3aWR0aCArPSBjb2xNLndpZHRoO1xyXG5cclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuJHJvdy53aWR0aCh3aWR0aCk7XHJcblx0fVxyXG5cclxuXHRnZXRWaXNpYmxlQ29sc1dpZHRoKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuJHJvdy53aWR0aCgpIC0gTkVFRExFU1NfV0lEVEg7XHJcblx0fVxyXG5cclxuXHRfYmluZEV2ZW50KCkge1xyXG5cdFx0dGhpcy5fY29sdW1uUmVzaXplKCk7XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwub24oJ2NvbHVtbi1hZGQnLCBjb2xNID0+IHtcclxuXHRcdFx0bGV0IGNvbEVsZW1lbnQgPSBjcmVhdGVDb2x1bW5FbGVtZW50KGNvbE0pO1xyXG5cclxuXHRcdFx0dGhpcy5jb2xFbGVtZW50cy5zZXQoY29sTSwgY29sRWxlbWVudCk7XHJcblx0XHRcdHRoaXMuJHJvdy5hcHBlbmQoY29sRWxlbWVudCk7XHJcblxyXG5cdFx0XHRsZXQgcm93VyA9IHRoaXMuJHJvdy53aWR0aCgpO1xyXG5cdFx0XHR0aGlzLiRyb3cud2lkdGgocm93VyArIGNvbE0ud2lkdGgpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwub24oJ2NvbHVtbi1tb3ZlZCcsIChjb2xNLCBpbmRleCkgPT4ge1xyXG5cdFx0XHRsZXQgY29sRWxlbWVudCA9IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cdFx0XHRjb2xFbGVtZW50LmFmdGVyKHRoaXMuJHJvdy5maW5kKCdsaS5jLWhlYWRlci1jZWxsJykuZXEoaW5kZXgpKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuY29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tcmVzaXplZCcsIHdpZHRoID0+IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pLm91dGVyV2lkdGgod2lkdGgpKTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1oaWRkZW4nLCBpc0hpZGRlbiA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cdFx0XHRcdGlmIChpc0hpZGRlbikge1xyXG5cdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKCdjLWNvbHVtbi1oaWRlJyk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcygnYy1jb2x1bW4taGlkZScpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tbG9ja2VkJywgaXNMb2NrZWQgPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHJcblx0XHRcdFx0aWYgKGlzTG9ja2VkKSB7XHJcblx0XHRcdFx0XHRjb2xFbGUuYWRkQ2xhc3MoJ2MtY29sdW1uLWxvY2tlZCcpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoJ2MtY29sdW1uLWxvY2tlZCcpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tc29ydC1jaGFuZ2VkJywgc29ydFN0YXRlID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKHNvcnRTdGF0ZSk7XHJcblx0XHRcdFx0aWYgKHNvcnRTdGF0ZSkge1xyXG5cdFx0XHRcdFx0aWYgKHNvcnRTdGF0ZSA9PT0gJ0FTQycpIHtcclxuXHRcdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKFNPUlRfQ0xTX0FTQyk7XHJcblx0XHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcyhTT1JUX0NMU19ERVNDKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcyhTT1JUX0NMU19ERVNDKTtcclxuXHRcdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKFNPUlRfQ0xTX0FTQyk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcyhTT1JUX0NMU19BU0MpLnJlbW92ZUNsYXNzKFNPUlRfQ0xTX0RFU0MpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdkZXN0b3J5JywgKCkgPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHRcdFx0XHR0aGlzLmNvbEVsZW1lbnRzLmRlbGV0ZShjb2xNKTtcdFx0XHRcclxuXHRcdFx0XHRjb2xFbGUucmVtb3ZlKCk7XHJcblxyXG5cdFx0XHRcdGxldCByb3dXID0gdGhpcy4kcm93LndpZHRoKCk7XHJcblx0XHRcdFx0dGhpcy4kcm93LndpZHRoKHJvd1cgLSBjb2xNLndpZHRoKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdF9jb2x1bW5SZXNpemUoKSB7XHJcblx0XHR0aGlzLiRyb3cub24oJ21vdXNlbW92ZScsICdsaS5jLWhlYWRlci1jZWxsJywgZnVuY3Rpb24oZXZ0KSB7XHJcblx0XHRcdHZhciBvZmZzZXRYID0gZXZ0Lm9mZnNldFg7XHJcblx0XHRcdGlmICh0aGlzLm9mZnNldFdpZHRoIC0gb2Zmc2V0WCA8PSA1IHx8IG9mZnNldFggPD0gNSkge1xyXG5cdFx0XHRcdCQodGhpcykuYWRkQ2xhc3MoJ2MtY29sLXJlc2l6YWJsZScpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdCQodGhpcykucmVtb3ZlQ2xhc3MoJ2MtY29sLXJlc2l6YWJsZScpO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHJcblxyXG5cdFx0dmFyIHN0YXJ0WCA9IDA7XHJcblxyXG5cdFx0REQodGhpcy4kcm93LCB7XHJcblx0XHRcdCd0cmlnZ2VyJzogJ2xpLmMtaGVhZGVyLWNlbGwnLFxyXG5cdFx0XHQncmVzdHJpY3Rlcic6IGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHRcdHZhciBvZmZzZXRYID0gZXZ0Lm9mZnNldFg7XHJcblx0XHRcdFx0Y29uc29sZS5sb2codGhpcy5vZmZzZXRXaWR0aCwgb2Zmc2V0WCwgdGhpcy5pbm5lclRleHQpO1xyXG5cdFx0XHRcdGlmICh0aGlzLm9mZnNldFdpZHRoIC0gb2Zmc2V0WCA8PSA1KSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gJCh0aGlzKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKG9mZnNldFggPD0gNSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuICQodGhpcykucHJldigpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSxcclxuXHRcdFx0J29uRHJhZ1N0YXJ0JzogXy5kZWJvdW5jZShmdW5jdGlvbihvZmZzZXQsICR0YXJnZXQpIHtcclxuXHRcdFx0XHR2YXIgc2Nyb2xsTGVmdCA9IGRvY3VtZW50LmJvZHkuc2Nyb2xsTGVmdCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsTGVmdDtcclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZygkdGFyZ2V0Lm9mZnNldCgpLmxlZnQsICR0YXJnZXQudGV4dCgpKTtcclxuXHRcdFx0XHRzdGFydFggPSAkdGFyZ2V0Lm9mZnNldCgpLmxlZnQgLSBzY3JvbGxMZWZ0O1xyXG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKG9mZnNldC54LCAkdGFyZ2V0LnRleHQoKSk7XHJcblxyXG5cdFx0XHRcdC8vIHN0YXJ0WCA9IG9mZnNldC54O1xyXG5cdFx0XHR9LCA4MCksXHJcblx0XHRcdCdvbkRyYWdnaW5nJzogZnVuY3Rpb24ob2Zmc2V0LCAkdGFyZ2V0KSB7XHJcblxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnb25EcmFnRW5kJzogXy5kZWJvdW5jZShmdW5jdGlvbihvZmZzZXQsICR0YXJnZXQpIHtcclxuXHRcdFx0XHR2YXIgd2lkdGggPSBvZmZzZXQueCAtIHN0YXJ0WDtcclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyhgJHskdGFyZ2V0LnRleHQoKX1cclxuXHRcdFx0XHQvLyBcdOWOn+WuveW6puS4uiR7JHRhcmdldC5kYXRhKCdjb2x1bW4nKS53aWR0aH0sXHJcblx0XHRcdFx0Ly8gXHTmlLnlj5jkuLrvvJoke3dpZHRofSwgWyR7b2Zmc2V0Lnh9IC0gJHtzdGFydFh9XWApO1xyXG5cdFx0XHRcdCR0YXJnZXQuZGF0YSgnY29sdW1uJykuc2V0V2lkdGgod2lkdGgpO1xyXG5cdFx0XHR9LCA4MClcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0cmVuZGVyKCkge1xyXG5cdFx0dGhpcy4kaGVhZGVyLmFwcGVuZCh0aGlzLiRyb3cpO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHtcclxuXHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEhlYWRlcjsiLCIndXNlIHN0cmljdCc7XHJcblxyXG5jbGFzcyBMb2NrQ29sdW1uIHtcclxuXHRjb25zdHJ1Y3RvcigpIHtcclxuXHRcdHRoaXMuX2RhdGEgPSBbXTtcclxuXHRcdHRoaXMuX2NvbHVtbnNXaWR0aCA9IDA7XHJcblx0fVxyXG5cclxuXHRhZGQoY29sTSkge1xyXG5cdFx0dGhpcy5fZGF0YS51bnNoaWZ0KGNvbE0pO1xyXG5cdFx0dGhpcy5yZUNhbGMoKTtcclxuXHR9XHJcblxyXG5cdHJlbW92ZShkZWxDb2xNKSB7XHJcblx0XHR0aGlzLl9kYXRhID0gdGhpcy5fZGF0YS5maWx0ZXIoY29sTSA9PiBjb2xNICE9PSBkZWxDb2xNKTtcclxuXHRcdHRoaXMucmVDYWxjKCk7XHJcblx0fVxyXG5cclxuXHRjbGVhcigpIHtcclxuXHRcdHRoaXMuX2RhdGEubGVuZ3RoID0gMDtcclxuXHRcdHRoaXMucmVDYWxjKCk7XHJcblx0fVxyXG5cclxuXHRnZXRXaWR0aCgpIHtcclxuXHRcdHJldHVybiB0aGlzLl9jb2x1bW5zV2lkdGg7XHJcblx0fVxyXG5cclxuXHRyZUNhbGMoKSB7XHJcblx0XHR0aGlzLl9jb2x1bW5zV2lkdGggPSB0aGlzLl9kYXRhLnJlZHVjZSgod2lkdGgsIGNvbE0pID0+IHtcclxuXHRcdFx0d2lkdGggLT0gY29sTS53aWR0aDtcclxuXHRcdFx0Y29sTS5hd2F5RnJvbUxlZnQgPSB3aWR0aDtcclxuXHRcdFx0cmV0dXJuIHdpZHRoO1xyXG5cdFx0fSwgMCk7XHJcblx0fVxyXG5cclxuXHRlYWNoKGZuKSB7XHJcblx0XHR0aGlzLl9kYXRhLmZvckVhY2goZm4pO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICog5b2T5YW25Lit5LiA5YiX5Y+R55Sf5Y+Y5YyW77yM6YCa55+l5YW25a6D5YiX55u45bqU5Y+Y5YyWXHJcblx0ICovXHJcblx0IHB1Ymxpc2goY2hhbmdlZENvbE0sIHNjcm9sbExlZnQpIHtcclxuXHQgXHR0aGlzLl9kYXRhLmZvckVhY2goY29sTSA9PiB7XHJcblx0IFx0XHRpZiAoY29sTSAhPT0gY2hhbmdlZENvbE0pIHtcclxuXHQgXHRcdFx0Y29sTS5maXJlKCdzY3JvbGwteCcsIHNjcm9sbExlZnQpO1xyXG5cdCBcdFx0fVxyXG5cdCBcdH0pO1xyXG5cdCB9XHJcbn1cclxuXHJcbnZhciBMb2NrQ29sTWFuYWdlciA9IGZ1bmN0aW9uKGNvbHNNb2RlbCwgaGVhZGVyLCAkZG9tLCBidWZmZXJOb2RlKSB7XHJcblx0bGV0IHZpc2libGVMb2NrQ29sdW1uID0gbmV3IExvY2tDb2x1bW4oKTtcclxuXHJcblx0aW5pdCgpO1xyXG5cdGluaXRFdmVudCgpO1xyXG5cclxuXHRmdW5jdGlvbiBpbml0KCkge1xyXG5cdFx0Y29sc01vZGVsXHJcblx0XHRcdC5nZXRMb2NrQ29sdW1uKClcclxuXHRcdFx0LmZpbHRlcihjb2xNID0+ICFjb2xNLmhpZGRlbilcclxuXHRcdFx0LmZvckVhY2goY29sTSA9PiB2aXNpYmxlTG9ja0NvbHVtbi5hZGQoY29sTSkpO1xyXG5cclxuXHRcdHVwZGF0ZUJveFNpemUoKTtcclxuXHJcblx0XHR2aXNpYmxlTG9ja0NvbHVtbi5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRsZXQgaGVhZGVyRWxlbWVudCA9IGhlYWRlci5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblx0XHRcdC8vIOiuvue9ruW5tuiusOW9leWIneWni+eahOW3puS+p+S9jVxyXG5cdFx0XHRoZWFkZXJFbGVtZW50LmNzcygnbGVmdCcsIGNvbE0uYXdheUZyb21MZWZ0KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ3Njcm9sbC14JywgeCA9PiB7XHJcblx0XHRcdFx0bGV0IGxlZnRTdHlsZSA9IHsgJ2xlZnQnOiB4ICsgY29sTS5hd2F5RnJvbUxlZnQgfTtcclxuXHJcblx0XHRcdFx0aGVhZGVyRWxlbWVudC5jc3MobGVmdFN0eWxlKTtcclxuXHRcdFx0XHRidWZmZXJOb2RlLmdldE5vZGVMaXN0KCkuZm9yRWFjaChub2RlID0+IG5vZGUuY2hpbGRyZW4uZ2V0KGNvbE0pLmNzcyhsZWZ0U3R5bGUpKTtcdFx0XHRcdFxyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaW5pdEV2ZW50KCkge1xyXG5cclxuXHRcdGNvbnN0IGNvbHVtbkxvY2tPclVuTG9jayA9IChpc0xvY2tlZCwgY29sTSkgPT4ge1xyXG5cdFx0XHRsZXQgaGVhZGVyRWxlbWVudCA9IGhlYWRlci5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRpZiAoaXNMb2NrZWQpIHtcclxuXHRcdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5hZGQoY29sTSk7XHJcblxyXG5cdFx0XHRcdGNvbE0ub24oJ3Njcm9sbC14JywgeCA9PiB7XHJcblx0XHRcdFx0XHRsZXQgbGVmdFN0eWxlID0geyAnbGVmdCc6IHggKyBjb2xNLmF3YXlGcm9tTGVmdCB9O1xyXG5cclxuXHRcdFx0XHRcdGhlYWRlckVsZW1lbnQuY3NzKGxlZnRTdHlsZSk7XHJcblx0XHRcdFx0XHRidWZmZXJOb2RlLmdldE5vZGVMaXN0KCkuZm9yRWFjaChub2RlID0+IG5vZGUuY2hpbGRyZW4uZ2V0KGNvbE0pLmNzcyhsZWZ0U3R5bGUpKTtcclxuXHRcdFx0XHR9KTtcclxuXHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4ucmVtb3ZlKGNvbE0pO1xyXG5cclxuXHRcdFx0XHRjb2xNLm9mZignc2Nyb2xsLXgnKTtcclxuXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGxldCBjdXJyZW50TGVmdCA9ICRkb20udmlld3BvcnQuc2Nyb2xsTGVmdCgpICsgY29sTS5hd2F5RnJvbUxlZnQ7XHJcblxyXG5cdFx0XHQvLyDorr7nva7lubborrDlvZXliJ3lp4vnmoTlt6bkvqfkvY1cclxuXHRcdFx0aGVhZGVyRWxlbWVudC5jc3MoJ2xlZnQnLCBjdXJyZW50TGVmdCk7XHJcblx0XHRcdGJ1ZmZlck5vZGUuZ2V0Tm9kZUxpc3QoKS5mb3JFYWNoKG5vZGUgPT4gbm9kZS5jaGlsZHJlbi5nZXQoY29sTSkuY3NzKCdsZWZ0JywgY3VycmVudExlZnQpKTtcclxuXHJcblx0XHRcdHZpc2libGVMb2NrQ29sdW1uLnB1Ymxpc2goY29sTSwgJGRvbS52aWV3cG9ydC5zY3JvbGxMZWZ0KCkpO1xyXG5cdFx0XHR1cGRhdGVCb3hTaXplKCk7XHJcblx0XHR9O1xyXG5cclxuXHRcdGNvbHNNb2RlbC5vbignY29sdW1uLWFkZCcsIGNvbE0gPT4ge1xyXG5cdFx0XHQvLyBCVUdGSVggVE9ET1xyXG5cclxuXHRcdFx0Ly8gLi4uXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1sb2NrZWQnLCBpc0xvY2tlZCA9PiB7XHJcblx0XHRcdFx0Y29sdW1uTG9ja09yVW5Mb2NrKGlzTG9ja2VkLCBjb2xNKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRjb2xzTW9kZWwuZ2V0Q29sdW1uKCkuZm9yRWFjaChjb2xNID0+IHtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1yZXNpemVkJywgd2lkdGggPT4ge1xyXG5cclxuXHRcdFx0XHRpZiAoY29sTS5sb2NrZWQpIHtcclxuXHRcdFx0XHRcdHZpc2libGVMb2NrQ29sdW1uLnJlQ2FsYygpO1xyXG5cdFx0XHRcdFx0bGV0IGhlYWRlckVsZW1lbnQgPSBoZWFkZXIuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0XHRcdGxldCBjdXJyZW50TGVmdCA9ICRkb20udmlld3BvcnQuc2Nyb2xsTGVmdCgpICsgY29sTS5hd2F5RnJvbUxlZnQ7XHJcblxyXG5cdFx0XHRcdFx0aGVhZGVyRWxlbWVudC5jc3MoJ2xlZnQnLCBjdXJyZW50TGVmdCk7XHJcblx0XHRcdFx0XHRidWZmZXJOb2RlLmdldE5vZGVMaXN0KCkuZm9yRWFjaChub2RlID0+IG5vZGUuY2hpbGRyZW4uZ2V0KGNvbE0pLmNzcygnbGVmdCcsIGN1cnJlbnRMZWZ0KSk7XHJcblxyXG5cdFx0XHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4ucHVibGlzaChjb2xNLCAkZG9tLnZpZXdwb3J0LnNjcm9sbExlZnQoKSk7XHJcblx0XHRcdFx0XHR1cGRhdGVCb3hTaXplKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcclxuXHRcdFx0fSk7XHJcblxyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWxvY2tlZCcsIGlzTG9ja2VkID0+IHtcclxuXHRcdFx0XHQvLyAuLi5cclxuXHRcdFx0XHRjb2x1bW5Mb2NrT3JVbkxvY2soaXNMb2NrZWQsIGNvbE0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdFx0XHJcblx0XHRidWZmZXJOb2RlLm9uKCdidWZmZXItaW5pdGlhbCcsICgpID0+IHtcclxuXHRcdFx0Ly8gY2xlYXJCdWZmZXJMb2NrTm9kZSgpO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB1cGRhdGVCb3hTaXplKCkge1xyXG5cdFx0dmFyIHZpc2libGVMb2NrQ29sc1dpZHRoID0gdmlzaWJsZUxvY2tDb2x1bW4uZ2V0V2lkdGgoKTtcclxuXHRcdGhlYWRlci4kaGVhZGVyLmNzcygncGFkZGluZy1sZWZ0JywgLXZpc2libGVMb2NrQ29sc1dpZHRoKTtcclxuXHRcdCRkb20uY2FudmFzLmNzcygnbWFyZ2luLWxlZnQnLCAtdmlzaWJsZUxvY2tDb2xzV2lkdGgpO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHtcclxuXHRcdHZpc2libGVMb2NrQ29sdW1uLFxyXG5cdFx0c2V0TG9ja0NvbHVtblgoc2Nyb2xsTGVmdCkge1xyXG5cdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5lYWNoKGNvbE0gPT4gY29sTS5maXJlKCdzY3JvbGwteCcsIHNjcm9sbExlZnQpKTtcclxuXHRcdH0sXHJcblxyXG5cdFx0YWRkQnVmZmVyTG9ja05vZGUocm93Tm9kZXMpIHtcclxuXHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4uZWFjaChjb2xNID0+IHtcclxuXHRcdFx0XHRyb3dOb2Rlcy5mb3JFYWNoKHJvd05vZGVzID0+IHtcclxuXHRcdFx0XHRcdGxldCBjb2xFbGUgPSBoZWFkZXIuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cdFx0XHRcdFx0bGV0IGNlbGxFbGVtZW50ID0gcm93Tm9kZXMuY2hpbGRyZW4uZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0XHRcdGNlbGxFbGVtZW50LmNzcygnbGVmdCcsICRkb20udmlld3BvcnQuc2Nyb2xsTGVmdCgpICsgY29sTS5hd2F5RnJvbUxlZnQpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0sXHJcblxyXG5cdFx0Y2xlYXJCdWZmZXJMb2NrTm9kZSgpIHtcclxuXHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4uY2xlYXIoKTtcclxuXHRcdH1cclxuXHJcblx0fTtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gTG9ja0NvbE1hbmFnZXI7IiwiLy8gVE9ET1xyXG52YXIgZGVib3VuY2UgPSBmdW5jdGlvbihmbiwgdGltZSkge1xyXG5cdHZhciB0aW1lciA9IG51bGw7XHJcblx0cmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcclxuXHRcdGlmICh0aW1lcikgY2xlYXJUaW1lb3V0KHRpbWVyKTtcclxuXHJcblx0XHR0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG5cdFx0XHRmbi5hcHBseShudWxsLCBhcmdzKTtcclxuXHRcdH0sIHRpbWUpO1xyXG5cdH1cclxufVxyXG5cclxuLy/op6PlhrNyZXF1ZXN0QW5pbWF0aW9uRnJhbWXlhbzlrrnpl67pophcclxudmFyIHJhRnJhbWUgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XHJcbiAgICAgICAgICAgICAgd2luZG93LndlYmtpdFJlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxyXG4gICAgICAgICAgICAgIHdpbmRvdy5tb3pSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcclxuICAgICAgICAgICAgICB3aW5kb3cub1JlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxyXG4gICAgICAgICAgICAgIHdpbmRvdy5tc1JlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxyXG4gICAgICAgICAgICAgIGZ1bmN0aW9uKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KGNhbGxiYWNrLCAxMDAwIC8gNjApO1xyXG4gICAgICAgICAgICAgIH07XHJcblxyXG4vL+afr+mHjOWMluWwgeijhVxyXG52YXIgdGhyb3R0bGUgPSBmdW5jdGlvbihmbikge1xyXG4gICAgbGV0IGlzTG9ja2VkO1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcclxuXHJcbiAgICAgICAgaWYoaXNMb2NrZWQpIHJldHVybiBcclxuXHJcbiAgICAgICAgaXNMb2NrZWQgPSB0cnVlO1xyXG4gICAgICAgIHJhRnJhbWUoKCkgPT4ge1xyXG4gICAgICAgICAgICBpc0xvY2tlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICBmbi5hcHBseSh0aGlzLCBhcmdzKVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59O1xyXG5cclxuY2xhc3MgU2Nyb2xsZXIge1xyXG5cdGNvbnN0cnVjdG9yKGxpbmVIZWlnaHQsIGJ1ZmZlclpvbmUpIHtcclxuXHJcblx0XHR0aGlzLmJ1ZmZlclpvbmUgPSBidWZmZXJab25lO1xyXG5cdFx0dGhpcy55RGlyID0gMDsgLy8gMTrlkJHkuIrvvIwwLC0xOuWQkeS4i1xyXG5cdFx0dGhpcy55UHJlSW5kZXggPSAwOyAvLyDkuIrkuIDkuKrkvY3nva5cclxuXHRcdHRoaXMubGluZUhlaWdodCA9IGxpbmVIZWlnaHQ7XHJcblxyXG5cdFx0dGhpcy54RGlyID0gMDsgLy8gMe+8muWQkeW3pu+8jDDvvIwtMe+8muWQkeWPs1xyXG5cdFx0dGhpcy54UHJlSW5kZXggPSAwOyAvLyDliY3kuIDkuKrkvY3nva5cclxuXHJcblx0XHR0aGlzLl90cmlnZ2VyWCA9IHggPT4geDtcclxuXHRcdHRoaXMuX3RyaWdnZXJZID0geSA9PiB5O1xyXG5cclxuXHR9XHJcblxyXG5cdG9uWChjYWxsYmFjaykge1xyXG5cdFx0dGhpcy5fdHJpZ2dlclggPSB4ID0+IHtcclxuXHRcdFx0aWYgKHggPT09IHRoaXMueFByZUluZGV4KSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLnhEaXIgPSB4IC0gdGhpcy54UHJlSW5kZXg7XHJcblx0XHRcdHRoaXMueFByZUluZGV4ID0geDtcclxuXHJcblx0XHRcdGNhbGxiYWNrKHgpO1xyXG5cdFx0fTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdG9uWShoYW5kbGVyLCBkZWxheSkge1xyXG5cdFx0Ly8gVE9ET1xyXG5cdFx0Ly8gdmFyIGRlYWx5Rm4gPSBkZWJvdW5jZShoYW5kbGVyLCBkZWxheSk7XHJcblxyXG5cdFx0dGhpcy5fdHJpZ2dlclkgPSBkZWJvdW5jZSgoeSkgPT4ge1xyXG5cdFx0XHR0aGlzLnlEaXIgPSB5IC0gdGhpcy55UHJlSW5kZXg7XHJcblx0XHRcdHRoaXMueVByZUluZGV4ID0geTtcclxuXHJcblx0XHRcdHZhciBpbmRleCA9IH5+KHkvIHRoaXMubGluZUhlaWdodCk7XHJcblx0XHRcdHZhciB3aWxsTG9hZCA9IHRoaXMuYnVmZmVyWm9uZS5zaG91bGRMb2FkKHRoaXMueURpciwgaW5kZXgpO1xyXG5cclxuXHRcdFx0aWYgKHdpbGxMb2FkKSB7XHJcblx0XHRcdFx0Ly8gZGVhbHlGbigpO1xyXG5cdFx0XHRcdGhhbmRsZXIoXHJcblx0XHRcdFx0XHR0aGlzLnlEaXIgPiAwID8gMSA6IC0xLFxyXG5cdFx0XHRcdFx0dGhpcy5idWZmZXJab25lLmRvbWFpbixcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS5zdGFydCxcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS5lbmQsXHJcblx0XHRcdFx0XHRpbmRleCxcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS50b3RhbFxyXG5cdFx0XHRcdCk7XHJcblx0XHRcdH1cclxuXHRcdH0sIGRlbGF5KTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdGZpcmVYKHgpIHtcclxuXHRcdHRoaXMuX3RyaWdnZXJYKHgpO1xyXG5cdH1cclxuXHJcblx0ZmlyZVkoeSkge1xyXG5cdFx0dGhpcy5fdHJpZ2dlclkoeSk7XHJcblx0fVxyXG5cclxuXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU2Nyb2xsZXI7IiwidmFyIFNlbGVjdGlvbiA9IHJlcXVpcmUoJy4vU2VsZWN0aW9uJyk7XHJcbnZhciBNZW51ID0gcmVxdWlyZSgnLi4vcGx1Z2luL01lbnUnKTtcclxudmFyICQgID0gcmVxdWlyZSgnLi4vdXRpbC9zaGltJykuJDtcclxuXHJcbmNvbnN0IGRlZkhlYWRlckNvbnRleHRNZW51ID0gW3sgXHJcblx0XHR0ZXh0OiAnbG9jaycsIFxyXG5cdFx0aGFuZGxlcjogZnVuY3Rpb24oaW5mbywgY29udGV4dCwgZXZ0KSB7XHJcblx0XHRcdGluZm8uY29sdW1uLmxvY2soKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdHRleHQ6ICd1bmxvY2snLCBcclxuXHRcdGhhbmRsZXI6IGZ1bmN0aW9uKGluZm8sIGNvbnRleHQsIGV2dCkgeyBcclxuXHRcdFx0aW5mby5jb2x1bW4udW5Mb2NrKCk7XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHRzZXBhcmF0b3I6IHRydWUgXHJcblx0fSwgeyBcclxuXHRcdHRleHQ6ICdzaG93JywgXHJcblx0XHRoYW5kbGVyOiBmdW5jdGlvbihpbmZvLCBjb250ZXh0LCBldnQpIHsgXHJcblx0XHRcdGluZm8uY29sdW1uLnNob3coKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdHRleHQ6ICdoaWRlJywgXHJcblx0XHRoYW5kbGVyOiBmdW5jdGlvbihpbmZvLCBjb250ZXh0LCBldnQpIHsgXHJcblx0XHRcdGluZm8uY29sdW1uLmhpZGUoKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdHRleHQ6ICdsb2NhdG9yJywgXHJcblx0XHRkaXNhYmxlZDogdHJ1ZSxcclxuXHRcdGhhbmRsZXI6IGZ1bmN0aW9uKGluZm8sIGNvbnRleHQsIGV2dCkgeyBcclxuXHRcdFx0Ly8gVE9ET1xyXG5cdFx0XHRjb250ZXh0LnNjcm9sbFRvVG9wKE1hdGgucmFuZG9tKCkgKiAzMDAwMCk7XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHR0ZXh0OiAnc2VsZWN0IGNvbHVtbicsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgXHJcblx0XHRcdC8vIGFsZXJ0KHNlbGYuc3RvcmUuc2l6ZSgpKTtcclxuXHRcdFx0Y29udGV4dC5fc3RhcnQgPSBbaW5mby5jb2x1bW4uZGF0YUluZGV4LCAwXTtcclxuXHRcdFx0Y29udGV4dC5fZW5kID0gW2luZm8uY29sdW1uLmRhdGFJbmRleCwgY29udGV4dC5zdG9yZS5zaXplKCkgLSAxXTtcclxuXHJcblx0XHRcdGNvbnRleHQuc2VsZWN0aW9uUmFuZ2UoY29udGV4dC5fc3RhcnQsIGNvbnRleHQuX2VuZCk7XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHRjbHM6ICdudW1iZXItY29sdW1uJyxcclxuXHRcdHRleHQ6ICdjb3VudCcsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgXHJcblx0XHRcdGFsZXJ0KGNvbnRleHQuc3RvcmUuc2l6ZSgpKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdGNsczogJ251bWJlci1jb2x1bW4nLFxyXG5cdFx0dGV4dDogJ2NvdW50JywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkge1xyXG5cdFx0XHRhbGVydChjb250ZXh0LnN0b3JlLnNpemUoKSk7XHJcblx0XHR9IFxyXG5cdH1dO1xyXG5cclxuY29uc3QgZGVmQ2VsbENvbnRleHRNZW51ID0gW3tcclxuXHRcdHRleHQ6ICdsb2NrIHJvdyB0byB0b3AnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IGNvbnNvbGUubG9nKGNvbnRleHQuX3NlbGVjdGlvbik7IH0gXHJcblx0fSx7IFxyXG5cdFx0dGV4dDogJ2xvY2sgcm93IHRvIGJvdHRvbScsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgY29uc29sZS5sb2coY29udGV4dC5fc2VsZWN0aW9uKTsgfSBcclxuXHR9LHsgXHJcblx0XHR0ZXh0OiAnc2VhcmNoJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBjb25zb2xlLmxvZyhjb250ZXh0Ll9zZWxlY3Rpb24pOyB9IFxyXG5cdH0seyBcclxuXHRcdHRleHQ6ICdtYXJrJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBjb25zb2xlLmxvZyhjb250ZXh0Ll9zZWxlY3Rpb24pOyB9IFxyXG5cdH1dO1x0XHJcblxyXG5jb25zdCBkZWZTZWxlY3Rpb25Db250ZXh0TWVudSA9IFt7IFxyXG5cdFx0dGV4dDogJ2NvcHknLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IGNvbnNvbGUubG9nKGluZm8sIGNvbnRleHQuX3NlbGVjdGlvbik7IH0gXHJcblx0fSx7IFxyXG5cdFx0dGV4dDogJ3ByaW50JywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBcclxuXHRcdFx0Y29uc29sZS5sb2coZXZ0LCBkYXRhLCBjb250ZXh0KTtcclxuXHRcdH0gXHJcblx0fSx7IFxyXG5cdFx0dGV4dDogJ2V4cG9ydCcsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgY29uc29sZS5sb2coY29udGV4dC5fc2VsZWN0aW9uKTsgfSBcclxuXHR9LHsgXHJcblx0XHR0ZXh0OiAnbWFyaycsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgY29uc29sZS5sb2coY29udGV4dC5fc2VsZWN0aW9uKTsgfSBcclxuXHR9XTtcclxuXHJcblxyXG5jbGFzcyBDb250ZXh0bWVudSBleHRlbmRzIFNlbGVjdGlvbiB7XHJcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xyXG5cdFx0c3VwZXIob3B0aW9ucyk7XHJcblxyXG5cdFx0dGhpcy5jZWxsQ3R4TWVudSA9IG9wdGlvbnMuYml6Q29udGV4dE1lbnUuY2VsbDtcclxuXHJcblx0XHR0aGlzLmhlYWRlckN0eE1lbnUgPSB7XHJcblx0XHRcdGJlZm9yZTogZnVuY3Rpb24oaW5mbywgZXZ0KSB7XHJcblx0XHRcdFx0aWYgKGluZm8uY29sdW1uLnZ0eXBlID09PSAnbnVtYmVyJykge1xyXG5cdFx0XHRcdFx0dGhpcy5nZXRDbHMoJy5udW1iZXItY29sdW1uJykuc2hvdygpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR0aGlzLmdldENscygnLm51bWJlci1jb2x1bW4nKS5oaWRlKCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHRzdXBlci5fYmluZEV2ZW50KCk7XHJcblxyXG5cdFx0bGV0IHNlbGYgPSB0aGlzO1xyXG5cclxuXHRcdHRoaXMuJGNvbnRleHRtZW51SGVhZGVyID0gbmV3IE1lbnUodGhpcy4kZG9tLndyYXBwZXIsIHsgXHJcblx0XHRcdGRhdGE6IGRlZkhlYWRlckNvbnRleHRNZW51LCBcclxuXHRcdFx0Y29udGV4dDogdGhpcyBcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuJGNvbnRleHRtZW51ID0gbmV3IE1lbnUodGhpcy4kZG9tLmJvZHksIHsgXHJcblx0XHRcdGRhdGE6IFtdLCBcclxuXHRcdFx0Y29udGV4dDogdGhpcyBcclxuXHRcdH0pO1xyXG5cdFx0XHJcblx0XHR0aGlzLiRkb20ud3JhcHBlclxyXG5cdFx0XHQub24oJ2NvbnRleHRtZW51JywgJy5jLWhlYWRlci1jZWxsJywgXHJcblx0XHRcdFx0dGhpcy5faGVhZGVyQ29udGV4dE1lbnUuYmluZCh0aGlzKVxyXG5cdFx0XHQpO1xyXG5cclxuXHRcdHRoaXMuJGRvbS5ib2R5XHJcblx0XHRcdC5vbignY29udGV4dG1lbnUnLCAnLmMtZ3JpZC1jZWxsJywgXHJcblx0XHRcdFx0dGhpcy5fY2VsbENvbnRleHRNZW51LmJpbmQodGhpcywgZGVmQ2VsbENvbnRleHRNZW51KVxyXG5cdFx0XHQpXHJcblx0XHRcdC5vbignY29udGV4dG1lbnUnLCAnLmMtY2VsbC1zZWxlY3RlZCcsIFxyXG5cdFx0XHRcdHRoaXMuX2NlbGxDb250ZXh0TWVudS5iaW5kKHRoaXMsIGRlZlNlbGVjdGlvbkNvbnRleHRNZW51KVxyXG5cdFx0XHQpO1xyXG5cdH1cclxuXHJcblx0X2hlYWRlckNvbnRleHRNZW51KGV2dCkge1xyXG5cdFx0bGV0IGNvbE0gPSAkKGV2dC50YXJnZXQpLmRhdGEoJ2NvbHVtbicpO1xyXG5cdFx0bGV0IG1lbnUgPSB0aGlzLiRjb250ZXh0bWVudUhlYWRlcjtcclxuXHJcblx0XHRsZXQgaW5mbyA9IHsgXHJcblx0XHRcdCdkYXRhSW5kZXgnOiBjb2xNLmRhdGFJbmRleCwgXHJcblx0XHRcdCdjb2x1bW4nOiBjb2xNLFxyXG5cdFx0XHQnY29udGV4dCc6IG1lbnVcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLmZpcmUoJ2hlYWRlci1jb250ZXh0bWVudScsIGluZm8sIGV2dCk7XHJcblx0XHQvLyBjb25zb2xlLmxvZyhpbmZvKTtcclxuXHJcblx0XHRpZiAodGhpcy5oZWFkZXJDdHhNZW51LmJlZm9yZS5jYWxsKG1lbnUsIGluZm8sIGV2dCkpIHtcclxuXHRcdFx0XHJcblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0bWVudS5zZXRJbmZvKGluZm8pO1xyXG5cdFx0XHRtZW51LnNob3dBdChldnQpO1xyXG5cdFx0XHJcblx0XHRcdGRvY0V2ZW50KG1lbnUpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0X2NlbGxDb250ZXh0TWVudShkZWZDdHhNZW51LCBldnQpIHtcclxuXHRcdGxldCAkY2VsbCA9ICQoZXZ0LnRhcmdldCk7XHJcblx0XHRsZXQgZGF0YUluZGV4ID0gJGNlbGwuZGF0YSgnZGF0YUluZGV4Jyk7XHJcblx0XHRsZXQgcm93bnVtYmVyID0gKyRjZWxsLnBhcmVudCgnLmMtZ3JpZC1yb3cnKS5hdHRyKCdyaWQnKTtcclxuXHRcdGxldCBtZW51ID0gdGhpcy4kY29udGV4dG1lbnU7XHJcblxyXG5cdFx0bGV0IGluZm8gPSB7IFxyXG5cdFx0XHQndmFsdWUnOiAkY2VsbC50ZXh0KCksXHJcblx0XHRcdCdkYXRhSW5kZXgnOiBkYXRhSW5kZXgsIFxyXG5cdFx0XHQncm93bnVtYmVyJzogcm93bnVtYmVyLFxyXG5cdFx0XHQnY29udGV4dCc6IG1lbnVcclxuXHRcdH07XHJcblxyXG5cdFx0dGhpcy5maXJlKCdjZWxsLWNvbnRleHRtZW51JywgaW5mbywgZXZ0KTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKGluZm8pO1xyXG5cclxuXHRcdGlmICh0aGlzLmNlbGxDdHhNZW51LmJlZm9yZS5jYWxsKG1lbnUsIGluZm8sIGV2dCkpIHtcclxuXHJcblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0bWVudS5zZXRJbmZvKGluZm8pO1xyXG5cdFx0XHRtZW51LnVwZGF0ZShkZWZDdHhNZW51LmNvbmNhdChtZW51LmdldERhdGEoKSkpO1xyXG5cdFx0XHRcclxuXHRcdFx0bWVudS5zaG93QXQoZXZ0KTtcclxuXHRcdFxyXG5cdFx0XHRkb2NFdmVudChtZW51KTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGRlc3RvcnkoKSB7XHJcblx0XHRzdXBlci5kZXN0b3J5KCk7XHJcblxyXG5cdFx0dGhpcy4kY29udGV4dG1lbnVIZWFkZXIuZGVzdG9yeSgpO1xyXG5cdFx0dGhpcy4kY29udGV4dG1lbnUuZGVzdG9yeSgpO1xyXG5cdFx0dGhpcy5jZWxsQ3R4TWVudSA9IG51bGw7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiBkb2NFdmVudCgkY29udGV4dG1lbnUpIHtcclxuXHQkKGRvY3VtZW50KS5vbignbW91c2V1cC5jb250ZXh0bWVudScsIG9uTW91c2VEb3duLmJpbmQobnVsbCwgJGNvbnRleHRtZW51KSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uTW91c2VEb3duKCRjb250ZXh0bWVudSl7XHJcbiAgICAkY29udGV4dG1lbnUuaGlkZSgpO1xyXG4gICAgJChkb2N1bWVudCkub2ZmKCdtb3VzZXVwLmNvbnRleHRtZW51Jyk7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQ29udGV4dG1lbnU7IiwidmFyIEdyaWRWaWV3ID0gcmVxdWlyZSgnLi4vY29yZS9HcmlkVmlldycpO1xyXG5cclxuY29uc3QgQ0VMTF9DTFMgPSAnbGkuYy1ncmlkLWNlbGwnO1xyXG5jb25zdCBDRUxMX1NFTEVDVEVEX0NMUyA9ICdjLWNlbGwtc2VsZWN0ZWQnO1xyXG5jb25zdCBST1dfQ0xTID0gJy5jLWdyaWQtcm93JztcclxuXHJcbmNsYXNzIFNlbGVjdGlvbiBleHRlbmRzIEdyaWRWaWV3IHtcclxuXHJcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xyXG5cdFx0c3VwZXIob3B0aW9ucyk7XHJcblxyXG5cdFx0dGhpcy5fZGVmYXVsdHMoKTtcclxuXHR9XHJcblxyXG5cdF9kZWZhdWx0cygpIHtcclxuXHRcdHRoaXMuX21vdmluZyA9IGZhbHNlO1xyXG5cdFx0dGhpcy5fc3RhcnQgPSBudWxsO1xyXG5cdFx0dGhpcy5fZW5kID0gbnVsbDtcclxuXHRcdHRoaXMuX2xhc3RZID0gbnVsbDtcclxuXHRcdHRoaXMuX3NlbGVjdGlvbiA9IFtdO1xyXG5cdFx0dGhpcy5fc2VsZWN0WSA9IFtdO1xyXG5cdFx0dGhpcy5fc2VsZWN0RGF0YUluZGV4ID0gW107XHJcblx0fVxyXG5cdFxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHRzdXBlci5fYmluZEV2ZW50KCk7XHJcblxyXG5cdFx0bGV0IHNlbGYgPSB0aGlzO1xyXG5cclxuXHRcdHRoaXMuY29sdW1uTW9kZWwub24oJ25vdGljZS1jb2xNb2RlbC1zb3J0LWNoYW5nZWQnLCAoKSA9PiB7XHJcblx0XHRcdHRoaXMuX2RlZmF1bHRzKCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLiRkb20uY2FudmFzXHJcblx0XHRcdC5vbignbW91c2Vkb3duJywgQ0VMTF9DTFMsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHRcdGlmIChldnQuYnV0dG9uID09PSAwKSB7XHJcblx0XHRcdFx0XHRzZWxmLiRkb20uY2FudmFzLmZpbmQoQ0VMTF9DTFMpLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0XHRcdHNlbGYuX21vdmluZyA9IHRydWU7XHJcblx0XHRcdFx0XHRsZXQgJGNlbGwgPSAkKHRoaXMpLmFkZENsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0XHRcdHNlbGYuX3N0YXJ0ID0gc2VsZi5fZW5kID0gWyRjZWxsLmRhdGEoJ2RhdGFJbmRleCcpLCArJGNlbGwucGFyZW50KFJPV19DTFMpLmF0dHIoJ3JpZCcpXTtcclxuXHRcdFx0XHRcdC8vIGNvbnNvbGUubG9nKHN0YXJ0KTtcclxuXHRcdFx0XHR9IFxyXG5cdFx0XHRcdGVsc2UgaWYgKGV2dC5idXR0b24gPT09IDIpIHtcclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSlcclxuXHRcdFx0Lm9uKCdtb3VzZWVudGVyJywgQ0VMTF9DTFMsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHRcdGlmIChzZWxmLl9tb3ZpbmcpIHtcclxuXHRcdFx0XHRcdGxldCAkY2VsbCA9ICQodGhpcyk7XHJcblx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdCRjZWxsLmFkZENsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0XHRcdHNlbGYuX2VuZCA9IFskY2VsbC5kYXRhKCdkYXRhSW5kZXgnKSwgKyRjZWxsLnBhcmVudChST1dfQ0xTKS5hdHRyKCdyaWQnKV07XHJcblxyXG5cdFx0XHRcdFx0c2VsZi5zZWxlY3Rpb25SYW5nZShzZWxmLl9zdGFydCwgc2VsZi5fZW5kKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pXHJcblx0XHRcdC5vbignbW91c2V1cCcsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHRcdHNlbGYuX21vdmluZyA9IGZhbHNlO1xyXG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKGVuZCk7XHJcblx0XHRcdFx0Y29uc29sZS5sb2coc2VsZi5fc2VsZWN0aW9uKTtcclxuXHRcdFx0XHQvLyBUT0RPXHJcblx0XHRcdFx0Ly8gY29weSgkKCcuY2VsbC5zZWxlY3RlZCcpKTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5idWZmZXJOb2RlLm9uKCdyb3ctdXBkYXRlLWJlZm9yZScsIChyb3dOb2RlLCByb3cpID0+IHtcclxuXHRcdFx0Ly8gY29uc29sZS5sb2cocm93Tm9kZS4kbm9kZSwgcm93LnJpZCwgdGhpcy5fc2VsZWN0WSk7XHJcblxyXG5cdFx0XHRpZiAodGhpcy5fc2VsZWN0aW9uLmxlbmd0aCA9PT0gMCkgcmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRcclxuXHRcdFx0bGV0IGkgPSByb3cucmlkO1xyXG5cdFx0XHRsZXQgW3kwLCB5MV0gPSB0aGlzLl9zZWxlY3RZO1xyXG5cdFx0XHRsZXQgY29scyA9IHRoaXMuX3NlbGVjdERhdGFJbmRleDtcclxuXHJcblx0XHRcdGlmIChpID49IHkwICYmIGkgPCB5MSArIDEpIHtcclxuXHRcdFx0XHRjb2xzLmZvckVhY2goKGNvbCkgPT4ge1xyXG5cdFx0XHRcdFx0cm93Tm9kZS5jaGlsZHJlbi5mb3JFYWNoKCgkY2VsbCwgY29sTSkgPT4ge1xyXG5cdFx0XHRcdFx0XHRpZiAoY29scy5pbmRleE9mKGNvbE0uZGF0YUluZGV4KSAhPSAtMSkge1xyXG5cdFx0XHRcdFx0XHRcdCRjZWxsLmFkZENsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHQkY2VsbC5yZW1vdmVDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUylcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0cm93Tm9kZS4kbm9kZS5maW5kKENFTExfQ0xTKS5yZW1vdmVDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdH1cclxuXHJcblx0XHR9KTtcclxuXHRcdFxyXG5cdH1cclxuXHJcblx0c2VsZWN0aW9uUmFuZ2UoW3gwLCB5MF0sIFt4MSwgeTFdKSB7XHJcblxyXG5cdFx0bGV0IHlEaXIgPSB5MSAtIHkwO1xyXG5cdFx0bGV0IGxhc3RZID0gdGhpcy5fbGFzdFk7XHJcblx0XHRcdFxyXG5cdFx0Ly8geVJhbmdlID0geyBsYXN0OiAsIG5vdzogW3kwLCB5MV0gfTtcclxuXHRcdC8vIFtsMCwgbDFdXHJcblx0XHQvLyBbeTAsIHkxXVxyXG5cdFx0Ly8gW2wwLCBsMV1cclxuXHRcdGxldCByZW1vdmVZUmFuZ2UgPSBbXTtcclxuXHRcdC8vIGRvd25cclxuXHRcdGlmICh5RGlyID49IDAgJiYgeTEgPCBsYXN0WSkge1xyXG5cdFx0XHRyZW1vdmVZUmFuZ2UgPSBbeTEsIGxhc3RZXTtcclxuXHRcdH1cclxuXHRcdC8vIHVwXHJcblx0XHRpZiAoeURpciA8PSAwICYmIHkxID4gbGFzdFkpIHtcclxuXHRcdFx0cmVtb3ZlWVJhbmdlID0gW2xhc3RZLCB5MV07XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdHRoaXMuX2xhc3RZID0geTE7XHJcblx0XHQvLyBjb25zb2xlLmxvZyh5RGlyLCByZW1vdmVZUmFuZ2UpO1xyXG5cclxuXHRcdGxldCBkYXRhSW5kZXggPSB0aGlzLmdldExvY2tBbmRWaXNpYWJsZUNvbHVtbkFzRGF0YUluZGV4KCk7XHJcblx0XHRbeDAsIHkwLCB4MSwgeTFdID0gb3JkZXJCeSh4MCwgeTAsIHgxLCB5MSwgZGF0YUluZGV4KTtcclxuXHJcblxyXG5cdFx0bGV0IGNvbHMgPSB0aGlzLl9zZWxlY3REYXRhSW5kZXggPSBkYXRhSW5kZXguc2xpY2UoZGF0YUluZGV4LmluZGV4T2YoeDApLCBkYXRhSW5kZXguaW5kZXhPZih4MSkrMSk7XHJcblx0XHQvLyBjb25zb2xlLmxvZyhjb2xzKTtcclxuXHJcblx0XHR0aGlzLl9zZWxlY3RZID0gW3kwLCB5MSArIDFdO1xyXG5cdFx0bGV0IHJvd3MgPSB0aGlzLnN0b3JlLnNsaWNlKHkwLCB5MSArIDEpO1xyXG5cclxuXHRcdHRoaXMuX3NlbGVjdGlvbiA9IHJvd3MubWFwKHJvdyA9PiB7XHJcblx0XHRcdHJldHVybiBjb2xzLm1hcChjb2wgPT4gcm93LmRhdGFbY29sXSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLl9yZVBhaW50Tm9kZSh5RGlyLCB5MCwgeTEsIHJlbW92ZVlSYW5nZSwgY29scyk7XHJcblx0fVxyXG5cclxuXHRfcmVQYWludE5vZGUoeURpciwgeTAsIHkxLCByZW1vdmVZUmFuZ2UsIGNvbHMpIHtcclxuXHRcdGxldCBub2RlTGlzdCA9IHRoaXMuYnVmZmVyTm9kZS5nZXROb2RlTGlzdCgpO1xyXG5cdFx0bm9kZUxpc3QuZm9yRWFjaCgocm93Tm9kZSkgPT4ge1xyXG5cdFx0XHRsZXQgJHJvdyA9IHJvd05vZGUuJG5vZGU7XHJcblx0XHRcdGxldCBpICA9ICskcm93LmF0dHIoJ3JpZCcpO1xyXG5cdFx0XHRcclxuXHRcdFx0aWYgKGkgPj0geTAgJiYgaSA8IHkxICsgMSkge1xyXG5cdFx0XHRcdGNvbHMuZm9yRWFjaCgoY29sKSA9PiB7XHJcblx0XHRcdFx0XHRyb3dOb2RlLmNoaWxkcmVuLmZvckVhY2goKCRjZWxsLCBjb2xNKSA9PiB7XHJcblx0XHRcdFx0XHRcdGlmIChjb2xzLmluZGV4T2YoY29sTS5kYXRhSW5kZXgpICE9IC0xKSB7XHJcblx0XHRcdFx0XHRcdFx0JGNlbGwuYWRkQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdCRjZWxsLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKVxyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKHlEaXIgPj0gMCAmJiBpID4gcmVtb3ZlWVJhbmdlWzBdICYmIGkgPD1yZW1vdmVZUmFuZ2VbMV0gKSB7XHJcblx0XHRcdFx0JHJvdy5maW5kKENFTExfQ0xTKS5yZW1vdmVDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKHlEaXIgPD0gMCAmJiBpID49IHJlbW92ZVlSYW5nZVswXSAmJiBpIDxyZW1vdmVZUmFuZ2VbMV0gKSB7XHJcblx0XHRcdFx0JHJvdy5maW5kKENFTExfQ0xTKS5yZW1vdmVDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdH1cclxuXHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdC8qXHJcblx0ICogbG9jayArIHZpc2lhYmxlID0gY29sdW1uc1xyXG5cdCAqIEBwYXJhbSB7QXJyYXl9IGNvbHVtbnMgLVtkYXRhSW5kZXguLi5dXHJcblx0ICovXHJcblx0Z2V0TG9ja0FuZFZpc2lhYmxlQ29sdW1uQXNEYXRhSW5kZXgoKSB7XHJcblx0XHRsZXQgY29scyA9IFtdO1xyXG5cclxuXHRcdHRoaXMubG9ja0NvbE1hbmFnZXJcclxuXHRcdFx0LnZpc2libGVMb2NrQ29sdW1uXHJcblx0XHRcdC5lYWNoKGNvbE0gPT4gY29scy51bnNoaWZ0KGNvbE0uZGF0YUluZGV4KSk7XHJcblxyXG5cdFx0bGV0IHZpc2lhYmxlQ29scyA9IHRoaXMuY29sdW1uTW9kZWxcclxuXHRcdFx0LmdldFZpc2libGVDb2x1bW4oKVxyXG5cdFx0XHQubWFwKGNvbE0gPT4gY29sTS5kYXRhSW5kZXgpXHJcblx0XHRcdC5maWx0ZXIoZGF0YUluZGV4ID0+IGNvbHMuaW5kZXhPZihkYXRhSW5kZXgpID09IC0xKTtcclxuXHJcblx0XHRyZXR1cm4gY29scy5jb25jYXQodmlzaWFibGVDb2xzKTtcclxuXHR9XHJcblxyXG5cdGRlc3RvcnkoKSB7XHJcblx0XHRzdXBlci5kZXN0b3J5KCk7XHJcblxyXG5cdFx0dGhpcy5fZGVmYXVsdHMoKTtcclxuXHR9XHJcblxyXG59XHJcblxyXG5cclxuZnVuY3Rpb24gc3dhcChhLCBiKSB7XHJcblx0cmV0dXJuIFtiLCBhXTtcclxufVxyXG5cclxuZnVuY3Rpb24gb3JkZXJCeSh4MCwgeTAsIHgxLCB5MSwgZGF0YUluZGV4KSB7XHJcblx0aWYgKGRhdGFJbmRleC5pbmRleE9mKHgwKSA+IGRhdGFJbmRleC5pbmRleE9mKHgxKSkge1xyXG5cdFx0W3gwLCB4MV0gPSBzd2FwKHgwLCB4MSk7XHJcblx0fVxyXG5cdGlmICh5MCA+IHkxKSB7XHJcblx0XHRbeTAsIHkxXSA9IHN3YXAoeTAsIHkxKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiBbeDAsIHkwLCB4MSwgeTFdO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFNlbGVjdGlvbjsiLCIvLyBleHBvcnRzLkdyaWRTdG9yZSA9IHJlcXVpcmUoJy4vY29yZS9HcmlkU3RvcmUnKTtcclxuLy8gZXhwb3J0cy5HcmlkVmlldyA9IHJlcXVpcmUoJy4vY29yZS9HcmlkVmlldycpO1xyXG4vLyBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vZXh0ZW5kcy9TZWxlY3Rpb24nKTtcclxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2V4dGVuZHMvQ29udGV4dG1lbnUnKTtcclxuXHJcbi8vIGV4cG9ydCB7IGRlZmF1bHQgfSBmb3JtICcuL3BsdWdpbi9Db250ZXh0bWVudSc7XHJcbiIsInZhciAkID0gcmVxdWlyZSgnLi4vdXRpbC9zaGltJykuJDtcclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbC9VdGlscycpO1xyXG5cclxuXHJcbmNsYXNzIE1lbnUge1xyXG5cdGNvbnN0cnVjdG9yKCR3cmFwcGVyLCB7IGRhdGEsIGNvbnRleHQgfSkge1xyXG5cdFx0dGhpcy5wYXJhbXMgPSB7fTtcclxuXHRcdHRoaXMuJG1lbnUgPSAkKG51bGwpO1xyXG5cdFx0dGhpcy4kd3JhcHBlciA9ICR3cmFwcGVyO1xyXG5cdFx0dGhpcy5fZGF0YSA9IGRhdGEgfHwgW107XHJcblx0XHR0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xyXG5cclxuXHRcdHRoaXMudXBkYXRlKGRhdGEpO1xyXG5cdH1cclxuXHJcblx0dXBkYXRlKGRhdGEpIHtcclxuXHRcdHRoaXMuJG1lbnUucmVtb3ZlKCk7IC8vIFRPRE8g5LyY5YyW5aSN55So6IqC54K5XHJcblx0XHRcclxuXHRcdGlmIChBcnJheS5pc0FycmF5KGRhdGEpICYmIGRhdGEubGVuZ3RoID4gMCkge1xyXG5cdFx0XHR0aGlzLiRtZW51ID0gY29tcGlsZU1lbnUoZGF0YSwgdGhpcyk7XHJcblxyXG5cdFx0XHR0aGlzLiR3cmFwcGVyLmFwcGVuZCh0aGlzLiRtZW51KTtcclxuXHJcblx0XHRcdHRoaXMuX2RhdGEgPSBkYXRhO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhpcy5fZGF0YSA9IFtdO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0bWVyZ2UoZGF0YSkge1xyXG5cdFx0dGhpcy5fZGF0YSA9IHRoaXMuX2RhdGEuZmlsdGVyKGl0ZW0gPT4ge1xyXG5cdFx0XHRyZXR1cm4gIWRhdGEuaW5jbHVkZXMoaXRlbSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLl9kYXRhID0gZGF0YS5jb25jYXQodGhpcy5fZGF0YSk7XHJcblx0XHR0aGlzLnVwZGF0ZSh0aGlzLl9kYXRhKTtcclxuXHR9XHJcblxyXG5cdHNldEluZm8oaW5mbykge1xyXG5cdFx0dGhpcy4kaW5mbyA9IGluZm87XHJcblx0fVxyXG5cclxuXHRnZXRJbmZvKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuJGluZm87XHJcblx0fVxyXG5cclxuXHRnZXREYXRhKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuX2RhdGE7XHJcblx0fVxyXG5cclxuXHRnZXRDbHMoY2xhc3NOYW1lKSB7XHJcblx0XHRyZXR1cm4gdGhpcy4kbWVudS5maW5kKGNsYXNzTmFtZSk7XHJcblx0fVxyXG5cclxuXHRzaG93QXQoZXZ0KSB7XHJcblx0XHRpZiAoIXRoaXMuX2RhdGEubGVuZ3RoKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRsZXQgeCA9IGV2dC5jbGllbnRYIC0gdGhpcy4kd3JhcHBlci5vZmZzZXQoKS5sZWZ0O1xyXG5cdFx0bGV0IHkgPSBldnQuY2xpZW50WSAtIHRoaXMuJHdyYXBwZXIub2Zmc2V0KCkudG9wO1xyXG5cclxuXHQgICAgdGhpcy4kbWVudVxyXG5cdCAgICBcdC5hZGRDbGFzcygnc2hvdy1tZW51JylcclxuXHQgICAgXHQuY3NzKHsgJ2xlZnQnOiB4ICsgJ3B4JywgJ3RvcCc6IHkgKyAncHgnIH0pO1xyXG5cdH1cclxuXHJcblx0aGlkZSgpIHtcclxuXHRcdHRoaXMuJG1lbnUucmVtb3ZlQ2xhc3MoJ3Nob3ctbWVudScpO1xyXG5cdH1cclxuXHJcblx0Z2V0RG9tKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuJG1lbnU7XHJcblx0fVxyXG5cclxuXHRkZXN0b3J5KCkge1xyXG5cdFx0dGhpcy4kbWVudS5lbXB0eSgpO1xyXG5cdH1cclxuXHJcbn1cclxuXHJcblxyXG5jb25zdCBlbXB0eUZuID0gKGV2dCkgPT4geyBcclxuXHRldnQucHJldmVudERlZmF1bHQ7XHJcblx0cmV0dXJuIGZhbHNlOyBcclxufTtcclxuXHJcbmZ1bmN0aW9uIGNvbnZlcnQoaXRlbSkge1xyXG5cdGxldCBkZWZJdGVtID0ge1xyXG5cdFx0J2lkJzogJ2NtLWlkLScgKyBEYXRlLm5vdygpLFxyXG5cdFx0J3RleHQnOiAnJyxcclxuXHRcdCdpY29uQ2xzJzogJycsXHJcblx0XHQnaGlkZGVuJzogZmFsc2UsXHJcblx0XHQnZGlzYWJsZWQnOiBmYWxzZSxcclxuXHRcdCdoYW5kbGVyJzogZnVuY3Rpb24oKSB7fVxyXG5cdH07XHJcblxyXG5cdHJldHVybiBPYmplY3QuYXNzaWduKGRlZkl0ZW0sIGl0ZW0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiBjcmVhdGVJdGVtKGl0ZW0sIHZtKSB7XHJcblx0bGV0ICRpdGVtID0gJCgnPGxpLz4nKVxyXG5cdFx0XHQuYXR0cignaWQnLCBpdGVtLmlkKVxyXG5cdFx0XHQuYWRkQ2xhc3MoJ2MtbWVudS1pdGVtJylcclxuXHRcdFx0LmFkZENsYXNzKGl0ZW0uZGlzYWJsZWQgPyAnZGlzYWJsZWQnOiAnJyk7XHJcblxyXG4gICAgbGV0ICRidXR0b24gPSAkKCc8YnV0dG9uLz4nKS5hZGRDbGFzcygnYy1tZW51LWJ0bicpXHJcbiAgICBcdFx0LmFwcGVuZChgPGkgY2xhc3M9XCJmYSAke2l0ZW0uaWNvbkNsc31cIj48L2k+YClcclxuICAgIFx0XHQuYXBwZW5kKGA8c3BhbiBjbGFzcz1cImMtbWVudS10ZXh0XCI+JHtpdGVtLnRleHR9PC9zcGFuPmApXHJcbiAgICBcdFx0Lm9uKCdjbGljaycsIChldnQpID0+IHtcclxuICAgIFx0XHRcdGl0ZW0uaGFuZGxlci5jYWxsKHZtLCB2bS5nZXRJbmZvKCksIHZtLmNvbnRleHQsIGV2dCk7XHJcbiAgICBcdFx0fSk7XHJcblxyXG4gICAgcmV0dXJuICRpdGVtLmFwcGVuZCgkYnV0dG9uKTtcclxufTtcclxuXHJcbmZ1bmN0aW9uIGNvbXBpbGVNZW51KG1lbnVzLCB2bSkge1xyXG5cdGlmIChtZW51cyAmJiBtZW51cy5sZW5ndGggPT09IDApIHJldHVybiAkKG51bGwpO1xyXG5cdFxyXG5cdGxldCAkbWVudXMgPSAkKCc8bWVudS8+JykuYWRkQ2xhc3MoJ2MtbWVudScpO1xyXG5cdGxldCAkbWVudVNlcGFyYXRvciA9ICQoJzxsaS8+JykuYWRkQ2xhc3MoJ2MtbWVudS1zZXBhcmF0b3InKTtcclxuXHRcclxuXHRtZW51cy5mb3JFYWNoKG1lbnUgPT4ge1xyXG5cdFx0aWYgKG1lbnUuc2VwYXJhdG9yKSB7XHJcblx0XHRcdHJldHVybiAkbWVudXMuYXBwZW5kKCRtZW51U2VwYXJhdG9yKTtcclxuXHRcdH1cclxuXHJcblx0XHRsZXQgJG1lbnUgPSBjcmVhdGVJdGVtKGNvbnZlcnQobWVudSksIHZtKTtcclxuXHRcdGxldCBjaGlsZHJlbjtcclxuXHJcblx0XHRpZiAobWVudS5jaGlsZHJlbikge1xyXG5cdFx0XHRjaGlsZHJlbiA9IGNvbXBpbGVNZW51KG1lbnUuY2hpbGRyZW4sIHZtKTtcclxuXHJcblx0XHRcdGlmIChjaGlsZHJlbikge1xyXG5cdFx0XHRcdCRtZW51LmFkZENsYXNzKCdzdWJtZW51JykuYXBwZW5kKGNoaWxkcmVuKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHQkbWVudXMuYXBwZW5kKCRtZW51KTtcclxuXHR9KTtcclxuXHJcblx0cmV0dXJuICRtZW51cztcclxufVxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gTWVudTsiLCIndXNlIHN0cmljdCc7XHJcbmNvbnN0ICQgPSByZXF1aXJlKCcuLi91dGlsL3NoaW0nKS4kO1xyXG5cclxuY29uc3QgRkxFWE1JTldJRFRIID0gMzU7XHJcblxyXG52YXIgZHJhZ0Ryb3AgPSBmdW5jdGlvbihldnQgLG9wdHMpIHtcclxuXHR2YXIgZG9jID0gJChkb2N1bWVudCk7XHJcblx0dmFyIHNjcm9sbExlZnQgPSBkb2N1bWVudC5ib2R5LnNjcm9sbExlZnQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbExlZnQ7XHJcblx0dmFyIHNjcm9sbFRvcCA9IGRvY3VtZW50LmJvZHkuc2Nyb2xsVG9wIHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxUb3A7XHJcblx0dmFyIGxlZnRPZmZzZXQgPSAkKGV2dC50YXJnZXQpLm9mZnNldCgpLmxlZnQgLSBzY3JvbGxMZWZ0O1xyXG5cdHZhciBpWCwgaVksIHN0YXJ0WCwgZW5kWDtcclxuXHR2YXIgZHJhZ2dpbmcgPSB0cnVlO1xyXG5cclxuXHRzdGFydFggPSBpWCA9IGV2dC5jbGllbnRYIC0gc2Nyb2xsTGVmdDtcclxuXHRpWSA9ICQoZXZ0LnRhcmdldCkub2Zmc2V0KCkudG9wIC0gc2Nyb2xsVG9wO1xyXG5cclxuXHRvcHRzLm9uRHJhZ1N0YXJ0KHsgJ3gnOiBzdGFydFggfSwgb3B0cy4kZWxlbWVudCk7XHJcblxyXG5cdGRvYy5vbignbW91c2Vtb3ZlLmRyYWdkcm9wJywgJC5wcm94eShtb3VzZW1vdmUsIHRoaXMpKTtcclxuXHRkb2Mub24oJ21vdXNldXAuZHJhZ2Ryb3AnLCAkLnByb3h5KG1vdXNldXAsIHRoaXMpKTtcclxuXHQvLyAkKGV2dC50YXJnZXQpWzBdLnNldENhcHR1cmUgJiYgJChldnQudGFyZ2V0KVswXS5zZXRDYXB0dXJlKCk7XHJcblxyXG5cdGZ1bmN0aW9uIG1vdXNlbW92ZShlKSB7XHJcblx0XHRpZiAoZHJhZ2dpbmcpIHtcclxuXHRcdFx0ZW5kWCA9IGUuY2xpZW50WCAtIHNjcm9sbExlZnQ7XHJcblxyXG5cdFx0XHQvLyBsaW1pdFxyXG5cdFx0XHRpZiAoZW5kWCAtIGxlZnRPZmZzZXQgPCBGTEVYTUlOV0lEVEgpIHtcclxuXHRcdFx0XHRlbmRYID0gbGVmdE9mZnNldCArIEZMRVhNSU5XSURUSDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0b3B0cy5vbkRyYWdnaW5nKCB7ICd4JzogZW5kWCB9LCBvcHRzLiRlbGVtZW50KTtcclxuXHRcdH1cclxuXHJcblx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbW91c2V1cChldnQpIHtcclxuXHRcdHZhciBlID0gZXZ0LnRhcmdldDtcclxuXHRcdGRyYWdnaW5nID0gZmFsc2U7XHJcblxyXG5cdFx0b3B0cy5vbkRyYWdFbmQoeyAneCc6IGV2dC5jbGllbnRYIC0gc2Nyb2xsTGVmdCB9LCBvcHRzLiRlbGVtZW50KTtcclxuXHJcblx0XHRpZiAoZSAmJiBlLnNldENhcHR1cmUpIHtcclxuXHRcdFx0ZS5yZWxlYXNlQ2FwdHVyZSgpO1xyXG5cdFx0fSBlbHNlIGlmICh3aW5kb3cucmVsZWFzZUNhcHR1cmUpIHtcclxuXHRcdFx0d2luZG93LnJlbGVhc2VDYXB0dXJlKEV2ZW50Lk1PVVNFTU9WRSB8IEV2ZW50Lk1PVVNFVVApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGRvYy5vZmYoJ21vdXNlbW92ZS5kcmFnZHJvcCcsIG1vdXNlbW92ZSk7XHJcblx0XHRkb2Mub2ZmKCdtb3VzZXVwLmRyYWdkcm9wJywgbW91c2V1cCk7XHJcblx0fVxyXG5cclxufTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGRlbGVnYXRlLCBvcHRpb25zKSB7XHJcblx0dmFyIGRlZmF1bHRzID0ge1xyXG5cdFx0cmVzdHJpY3RlcihldnQpIHsgcmV0dXJuIG51bGw7IH0sXHJcblx0XHRvbkRyYWdTdGFydChvZmZzZXQsIHRhcmdldCkge30sXHJcblx0XHRvbkRyYWdnaW5nKG9mZnNldCwgdGFyZ2V0KSB7fSxcclxuXHRcdG9uRHJhZ0VuZChvZmZzZXQsIHRhcmdldCkge31cclxuXHR9O1xyXG5cclxuXHRPYmplY3QuYXNzaWduKGRlZmF1bHRzLCBvcHRpb25zKTtcclxuXHJcblx0JChkZWxlZ2F0ZSkub24oJ21vdXNlZG93bicsIG9wdGlvbnMudHJpZ2dlciwgZnVuY3Rpb24oZXZ0KSB7XHJcblx0XHR2YXIgcmVzdHJpY3RlciA9IGRlZmF1bHRzLnJlc3RyaWN0ZXIuY2FsbCh0aGlzLCBldnQpO1xyXG5cclxuXHRcdGlmIChyZXN0cmljdGVyKSB7XHJcblx0XHRcdGRlZmF1bHRzLiRlbGVtZW50ID0gcmVzdHJpY3RlcjtcclxuXHRcdFx0ZHJhZ0Ryb3AuY2FsbCh0aGlzLCBldnQsIGRlZmF1bHRzKTtcclxuXHRcdH1cclxuXHR9KTtcclxufTsiLCIvKipcclxuICog5LqL5Lu2566h55CGXHJcbiAqIEBjbGFzcyBFdmVudEVtaXR0ZXJcclxuICovXHJcblxyXG5mdW5jdGlvbiBpbmRleE9mTGlzdGVuZXIobGlzdGVuZXJzLCBsaXN0ZW5lcikge1xyXG5cdHZhciBpID0gbGlzdGVuZXJzLmxlbmd0aDtcclxuXHR3aGlsZSAoaS0tKSB7XHJcblx0XHRpZiAobGlzdGVuZXJzW2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikge1xyXG5cdFx0XHRyZXR1cm4gaTtcclxuXHRcdH1cclxuXHR9XHJcblx0cmV0dXJuIC0xO1xyXG59XHJcblxyXG5mdW5jdGlvbiBpc1ZhbGlkTGlzdGVuZXIobGlzdGVuZXIpIHtcclxuXHRpZiAodHlwZW9mIGxpc3RlbmVyID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9IGVsc2UgaWYgKGxpc3RlbmVyICYmIHR5cGVvZiBsaXN0ZW5lciA9PT0gJ29iamVjdCcpIHtcclxuXHRcdHJldHVybiBpc1ZhbGlkTGlzdGVuZXIobGlzdGVuZXIubGlzdGVuZXIpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG59XHJcblxyXG5jbGFzcyBFdmVudEVtaXR0ZXIge1xyXG5cclxuXHRjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcblxyXG5cdH1cclxuXHQvKipcclxuXHQqXHJcblx0KlxyXG5cdCpcclxuXHQqXHJcblx0Ki9cclxuXHRfZ2V0RXZlbnRzKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuX2V2ZW50cyB8fCAodGhpcy5fZXZlbnRzID0ge30pO1xyXG5cdH1cclxuXHQvKipcclxuXHQqIOmAmui/h+S6i+S7tuWQjeiOt+WPlmxpc3RlbmVyIOaVsOe7hOaIluWIneWni+WMllxyXG5cdCog5L2/55So5q2j5YiZ5Yy56YWN5Lya6L+U5Zue5LiA5Liq5a+55bqU55qE5a+56LGhXHJcblx0KlxyXG5cdCogXHJcblx0KiBnZXRMaXN0ZW5lcnNcclxuXHQqIEBwYXJhbSB7U3RyaW5nIH0gUmVnRXhwfSBldmVudE5hbWVcclxuXHQqIEByZXR1cm4ge0Z1bmN0b25bXSB8IE9iamVjdH1cclxuXHQqXHJcblx0Ki9cclxuXHRnZXRMaXN0ZW5lcnMobmFtZSkge1xyXG5cdFx0dmFyIGV2ZW50cyA9IHRoaXMuX2dldEV2ZW50cygpO1xyXG5cdFx0dmFyIHJlc3BvbnNlO1xyXG5cdFx0dmFyIGtleTtcclxuXHJcblx0XHRpZiAobmFtZSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xyXG5cdFx0XHRyZXNwb25zZSA9IHt9O1xyXG5cdFx0XHRmb3IgKGtleSBpbiBldmVudHMpIHtcclxuXHRcdFx0XHRpZiAoZXZlbnRzLmhhc093blByb3BlcnR5KGtleSkgJiYgbmFtZS50ZXN0KGtleSkpIHtcclxuXHRcdFx0XHRcdHJlc3BvbnNlW2tleV0gPSBldmVudHNba2V5XTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHJlc3BvbnNlID0gZXZlbnRzW25hbWVdIHx8IChldmVudHNbbmFtZV0gPSBbXSk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHJlc3BvbnNlO1xyXG5cdH1cclxuXHQvKipcclxuXHQqIOmAmui/h+S6i+S7tuWQjeiOt+WPlmxpc3RlbmVyIOWni+e7iOi/lOWbnuS4gOS4quWvueixoVxyXG5cdCpcclxuXHQqIFxyXG5cdCogZ2V0TGlzdGVuZXJzQXNPYmplY3RcclxuXHQqIEBwYXJhbSB7U3RyaW5nfFJlZ0V4cH0gZXZlbnROYW1lXHJcblx0KiBAcmV0dXJuIHtPYmplY3R9XHJcblx0Ki9cclxuXHRnZXRMaXN0ZW5lcnNBc09iamVjdChuYW1lKSB7XHJcblx0XHR2YXIgbGlzdGVuZXJzID0gdGhpcy5nZXRMaXN0ZW5lcnMobmFtZSk7XHJcblx0XHR2YXIgcmVzcG9uc2U7XHJcblxyXG5cdFx0aWYgKGxpc3RlbmVycyBpbnN0YW5jZW9mIEFycmF5KSB7XHJcblx0XHRcdHJlc3BvbnNlID0ge307XHJcblx0XHRcdHJlc3BvbnNlW25hbWVdID0gbGlzdGVuZXJzO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiByZXNwb25zZSB8fCBsaXN0ZW5lcnM7XHJcblx0fVxyXG5cdC8qKlxyXG5cdCog6I635Y+WIGxpc3RlbmVyIOWIl+ihqFxyXG5cdCpcclxuXHQqIGZsYXR0ZW5MaXN0ZW5lcnNcclxuXHQqXHJcblx0KiBAcGFyYW0geyBPYmplY3RbXX0gbGlzdGVuZXJzXHJcblx0KiBAcmV0dXJuIHtGdW5jdGlvbltdfVxyXG5cdCovXHJcblx0ZmxhdHRlbkxpc3RlbmVycyhsaXN0ZW5lcnMpIHtcclxuXHRcdHZhciBmbGF0TGlzdGVuZXJzID0gW107XHJcblxyXG5cdFx0Zm9yICh2YXIgaSA9IDAsIGwgPSBsaXN0ZW5lci5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuXHRcdFx0ZmxhdExpc3RlbmVycy5wdXNoKGxpc3RlbmVyc1tpXS5saXN0ZW5lcik7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZsYXRMaXN0ZW5lcnM7XHJcblx0fVxyXG5cdC8qKlxyXG5cdCog5LqL5Lu25rOo5YaMXHJcblx0KlxyXG5cdCpcclxuXHQqIEBleGFtcGVsXHJcblx0KiB2YXIgZW10ID0gbmV3IEV2ZW50RW1pdHRlcigpO1xyXG5cdCogZW10LmFkZExpc3RlbmVyKCdkaXY6aG92ZXInLCBmdW5jdGlvbigpe1xyXG5cdCpcdC8vIGRvXHJcblx0KiB9KTtcclxuXHQqIEBwYXJhbSB7c3RyaW5nfSBldmVudE5hbWVcclxuXHQqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyXHJcblx0KiBAcmV0dXJuIHtPYmplY3RqfVxyXG5cdCpcclxuXHQqL1xyXG5cdGFkZExpc3RlbmVyKG5hbWUsIGxpc3RlbmVyLCBmbGFnKSB7XHJcblx0XHRpZiAoIWlzVmFsaWRMaXN0ZW5lcihsaXN0ZW5lcikpIHtcclxuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGxpc3RlbmVycyA9IHRoaXMuZ2V0TGlzdGVuZXJzQXNPYmplY3QobmFtZSk7XHJcblx0XHR2YXIgbGlzdGVuZXJJc1dyYXBwZWQgPSB0eXBlb2YgbGlzdGVuZXIgPT09ICdvYmplY3QnO1xyXG5cdFx0dmFyIGtleSwgc3RhcnQsIGFyZ3M7XHJcblxyXG5cdFx0Zm9yIChrZXkgaW4gbGlzdGVuZXJzKSB7XHJcblx0XHRcdGlmIChsaXN0ZW5lcnMuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBpbmRleE9mTGlzdGVuZXIobGlzdGVuZXJzLCBsaXN0ZW5lcikgPT09IC0xKSB7XHJcblxyXG5cdFx0XHRcdHN0YXJ0ID0gbGlzdGVuZXJzW2tleV0ubGVuZ3RoO1xyXG5cclxuXHRcdFx0XHRsaXN0ZW5lcnNba2V5XS5wdXNoKGxpc3RlbmVySXNXcmFwcGVkID8gbGlzdGVuZXIgOiB7XHJcblx0XHRcdFx0XHRsaXN0ZW5lcjogbGlzdGVuZXIsXHJcblx0XHRcdFx0XHRvbmNlOiBmYWxzZVxyXG5cdFx0XHRcdH0pO1xyXG5cclxuXHRcdFx0XHRpZiAoZmxhZyAmJiBsaXN0ZW5lcnNba2V5XS5hcmdzKSB7XHJcblx0XHRcdFx0XHRsaXN0ZW5lcnNba2V5XS5zdGFydCA9IHN0YXJ0O1xyXG5cdFx0XHRcdFx0YXJncyA9IGxpc3RlbmVyc1trZXldLmFyZ3M7XHJcblx0XHRcdFx0XHR0aGlzLmVtaXRFdmVudChuYW1lLCBhcmdzKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdG9uKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuYWRkTGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuXHR9XHJcblxyXG5cdG9uZShuYW1lLCBsaXN0ZW5lciwgZmxhZykge1xyXG5cdFx0cmV0dXJuIHRoaXMucmVtb3ZlRXZlbnQobmFtZSkuYWRkTGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIOS6i+S7tuazqOWGjO+8jOinpuWPkeWQjuiHquWKqOenu+mZpFxyXG5cdCAqXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lXHJcblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXJcclxuXHQgKiBAcmV1dG5yIHtPYmplY3R9XHJcblx0ICpcclxuXHQgKi9cclxuXHRhZGRPbmNlTGlzdGVuZXIobmFtZSwgbGlzdGVuZXIpIHtcclxuXHRcdHJldHVybiB0aGlzLmFkZExpc3RlbmVyKG5hbWUsIHtcclxuXHRcdFx0bGlzdGVuZXI6IGxpc3RlbmVyLFxyXG5cdFx0XHRvbmNlOiB0cnVlXHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdG9uY2UoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5hZGRPbmNlTGlzdGVuZXIuYXBwbHkodGhpcy5hcmd1bWVudHMpO1xyXG5cdH1cclxuXHQvKipcclxuXHQgKiDkuovku7bplIDmr4FcclxuXHQgKlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZVxyXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyXHJcblx0ICogQHJldHVybiB7T2JqZWN0fVxyXG5cdCAqXHJcblx0ICovXHJcblx0cmVtb3ZlTGlzdGVuZXIobmFtZSwgbGlzdGVuZXIpIHtcclxuXHRcdHZhciBsaXN0ZW5lcnMgPSB0aGlzLmdldExpc3RlbmVyc0FzT2JqZWN0KG5hbWUpO1xyXG5cdFx0dmFyIGluZGV4O1xyXG5cdFx0dmFyIGtleTtcclxuXHJcblx0XHRmb3IgKGtleSBpbiBsaXN0ZW5lcnMpIHtcclxuXHRcdFx0aWYgKGxpc3RlbmVycy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XHJcblx0XHRcdFx0aW5kZXggPSBpbmRleE9mTGlzdGVuZXIobGlzdGVuZXJzW2tleV0sIGxpc3RlbmVyKTtcclxuXHJcblx0XHRcdFx0aWYgKGluZGV4ICE9PSAtMSkge1xyXG5cdFx0XHRcdFx0bGlzdGVuZXJzW2tleV0uc3BsaWNlKGluZGV4LCBpKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdG9mZigpIHtcclxuXHRcdHJldHVybiB0aGlzLnJlbW92ZUxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cclxuXHRtYW5pcHVsYXRlTGlzdGVuZXJzKHJlbW92ZSwgbmFtZSwgbGlzdGVuZXJzKSB7XHJcblx0XHR2YXIgc2luZ2xlID0gcmVtb3ZlID8gdGhpcy5yZW1vdmVMaXN0ZW5lciA6IHRoaXMuYWRkTGlzdGVuZXI7XHJcblx0XHR2YXIgbXV0aXBsZSA9IHJlbW92ZSA/IHRoaXMucmVtb3ZlTGlzdGVuZXJzIDogdGhpcy5hZGRMaXN0ZW5lcnM7XHJcblx0XHR2YXIgaTtcclxuXHRcdHZhciB2O1xyXG5cclxuXHRcdGlmICh0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcgJiYgIShuYW1lIGluc3RhbmNlb2YgUmVnRXhwKSkge1xyXG5cdFx0XHRmb3IgKGkgaW4gbmFtZSkge1xyXG5cdFx0XHRcdGlmIChuYW1lLmhhc093blByb3BlcnR5KGkpICYmICh2ID0gbmFtZVtpXSkpIHtcclxuXHRcdFx0XHRcdGlmICh0eXBlb2YgdiA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0XHRcdFx0XHRzaW5nbGUuY2FsbCh0aGlzLCBpLCB2KTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdG11dGlwbGUuY2FsbCh0aGlzLCBpLCB2KTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGkgPSAwO1xyXG5cdFx0XHR2ID0gbGlzdGVuZXJzLmxlbmd0aDtcclxuXHRcdFx0d2hpbGUgKGkgPCB2KSB7XHJcblx0XHRcdFx0c2luZ2xlLmNhbGwodGhpcywgbmFtZSwgbGlzdGVuZXJzW2krK10pO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRhZGRMaXN0ZW5lcnMobmFtZSwgbGlzdGVuZXJzKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5tYW5pcHVsYXRlTGlzdGVuZXJzKGZhbHNlLCBuYW1lLCBsaXN0ZW5lcnMpO1xyXG5cdH1cclxuXHJcblx0cmVtb3ZlTGlzdGVuZXJzKG5hbWUsIGxpc3RlbmVycykge1xyXG5cdFx0cmV0dXJuIHRoaXMubWFuaXB1bGF0ZUxpc3RlbmVycyh0cnVlLCBuYW1lLCBsaXN0ZW5lcnMpO1xyXG5cdH1cclxuXHJcblx0cmVtb3ZlRXZlbnQobmFtZSkge1xyXG5cdFx0dmFyIGV2ZW50cyA9IHRoaXMuX2dldEV2ZW50cygpO1xyXG5cdFx0dmFyIGtleTtcclxuXHJcblx0XHRpZiAodHlwZW9mIG5hbWUgPT09ICdzdHJpbmcnKSB7XHJcblx0XHRcdC8vIOenu+mZpOaJgOacieaMh+WumuS6i+S7tuWQjeeahOaJgOaciWxpc3RlbmVyc1xyXG5cdFx0XHQvLyBkZWxldGUgZXZlbnRzW25hbWVdXHJcblx0XHRcdGlmIChldmVudHNbbmFtZV0gaW5zdGFuY2VvZiBBcnJheSkge1xyXG5cdFx0XHRcdGV2ZW50c1tuYW1lXS5sZW5ndGggPSAwO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2UgaWYgKG5hbWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcclxuXHRcdFx0Ly8g5q2j5YiZ5Yy56YWN55qE5omA5pyJIGxpc3RlbmVyc1xyXG5cdFx0XHRmb3IgKGtleSBpbiBldmVudHMpIHtcclxuXHRcdFx0XHRpZiAoZXZlbnRzLmhhc093blByb3BlcnR5KGtleSkgJiYgbmFtZS50ZXN0KGtleSkpIHtcclxuXHRcdFx0XHRcdC8vIGRlbGV0ZSBldmVudHNba2V5XVxyXG5cdFx0XHRcdFx0aWYgKGV2ZW50c1trZXldIGluc3RhbmNlb2YgQXJyYXkpIHtcclxuXHRcdFx0XHRcdFx0ZXZlbnRba2V5XS5sZW5ndGggPSAwO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0Ly8g56e76Zmk5omA5pyJIGxpc3RlbmVyc1xyXG5cdFx0XHRkZWxldGUgdGhpcy5fZXZlbnRzO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0cmVtb3ZlQWxsTGlzdGVuZXJzKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMucmVtb3ZlRXZlbnQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuXHR9XHJcblx0LyoqXHJcblx0ICog5LqL5Lu26Kem5Y+RXHJcblx0ICpcclxuXHQgKlxyXG5cdCAqIEBleGFtcGxlXHJcblx0ICogdmFyIGVtdCA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcclxuXHQgKiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG5cdCAqIFx0ZW10LmVtaXRFdmVudCgnZGl2OmhvdmVyJywgMSk7XHJcblx0ICogfSwgMTAwMCk7XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lIOS6i+S7tuWQjeensFxyXG5cdCAqIEBwYXJhbSB7QXJyYXl9IFthcmdzXSBIVE1MRG9jdW1lbnQsIGl0ZW1EYXRhLCAuLi5cclxuXHQgKiBAcmV0dXJuIHtPYmplY3R9XHJcblx0ICpcclxuXHQgKi9cclxuXHRlbWl0RXZlbnQobmFtZSwgYXJncykge1xyXG5cdFx0dmFyIGxpc3RlbmVyc01hcCA9IHRoaXMuZ2V0TGlzdGVuZXJzQXNPYmplY3QobmFtZSk7XHJcblx0XHR2YXIgbGlzdGVuZXJzO1xyXG5cdFx0dmFyIGxpc3RlbmVyO1xyXG5cdFx0dmFyIGk7XHJcblx0XHR2YXIgbDtcclxuXHRcdHZhciBrZXk7XHJcblx0XHR2YXIgcmVzcG9uc2U7XHJcblxyXG5cdFx0Zm9yIChrZXkgaW4gbGlzdGVuZXJzTWFwKSB7XHJcblx0XHRcdGlmIChsaXN0ZW5lcnNNYXAuaGFzT3duUHJvcGVydHkoa2V5KSkge1xyXG5cdFx0XHRcdGxpc3RlbmVycyA9IGxpc3RlbmVyc01hcFtrZXldLnNsaWNlKDApO1xyXG5cclxuXHRcdFx0XHRsaXN0ZW5lcnNNYXBba2V5XS5hcmdzID0gYXJncztcclxuXHJcblx0XHRcdFx0aSA9IGxpc3RlbmVyc01hcFtrZXldLnN0YXJ0IHx8IDA7XHJcblx0XHRcdFx0bGlzdGVuZXJzTWFwW2tleV0uc3RhcnQgPSAwO1xyXG5cclxuXHRcdFx0XHRmb3IgKGwgPSBsaXN0ZW5lcnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcblx0XHRcdFx0XHRsaXN0ZW5lciA9IGxpc3RlbmVyc1tpXTtcclxuXHJcblx0XHRcdFx0XHRpZiAobGlzdGVuZXIub25jZSA9PT0gdHJ1ZSkge1xyXG5cdFx0XHRcdFx0XHR0aGlzLnJlbW92ZUxpc3RlbmVyKG5hbWUsIGxpc3RlbmVyLmxpc3RlbmVyKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRyZXNwb25zZSA9IGxpc3RlbmVyLmxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3MgfHwgW10pO1xyXG5cclxuXHRcdFx0XHRcdGlmIChyZXNwb25zZSA9PT0gdGhpcy5fZ2V0T25jZVJldHVyblZhbHVlKCkpIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5yZW1vdmVMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lci5saXN0ZW5lcik7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdHRyaWdnZXIoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5lbWl0RXZlbnQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuXHR9XHJcblxyXG5cdGZpcmUobmFtZSkge1xyXG5cdFx0dmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xyXG5cdFx0cmV0dXJuIHRoaXMuZW1pdEV2ZW50KG5hbWUsIGFyZ3MpO1xyXG5cdH1cclxuXHJcblx0X2dldE9uY2VSZXR1cm5WYWx1ZSgpIHtcclxuXHRcdGlmICh0aGlzLmhhc093blByb3BlcnR5KCdfb25jZVJldHVyblZhbHVlJykpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuX29uY2VSZXR1cm5WYWx1ZTtcclxuXHRcdH1cclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH1cclxuXHJcblx0c2V0T25jZVJldHVyblZhbHVlKHZhbHVlKSB7XHJcblx0XHR0aGlzLl9vbmNlUmV0dXJuVmFsdWUgPSB2YWx1ZTtcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0ZGVmaW5lRXZlbnQobmFtZSkge1xyXG5cdFx0dGhpcy5nZXRMaXN0ZW5lcnMobmFtZSk7XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdGRlZmluZUV2ZW50cyhuYW1lcykge1xyXG5cdFx0Zm9yICh2YXIgaSA9IDAsIGwgPSBuYW1lcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuXHRcdFx0dGhpcy5kZWZpbmVFdmVudChuYW1lW2ldKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xyXG5cclxuXHJcbiIsImZ1bmN0aW9uIHN3YXAoYXJyLCBzMSwgczIpIHtcclxuXHR2YXIgdGVtcCA9IGFycltzMV07XHJcblx0YXJyW3MxXSA9IGFycltzMl07XHJcblx0YXJyW3MyXSA9IHRlbXA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJhbmRvbVZhbHVlKGFycikge1xyXG5cdHZhciByID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogYXJyLmxlbmd0aCk7XHJcblx0Ly8gc3dhcChhcnIsIDAsIHIpO1xyXG5cdHJldHVybiBbYXJyW3JdLCBhcnIuZmlsdGVyKChkLCBpKSA9PiBpICE9PSByKV07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZpbHRlckxBbmRSKGFyciwgc2VsZWN0LCBjb21wYXJlRm4pIHtcclxuXHR2YXIgbGVmdEFyciA9IFtdO1xyXG5cdHZhciByaWdodEFyciA9IFtdO1xyXG5cclxuXHRmb3IgKHZhciBpID0gMCwgbGVuID0gYXJyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcblx0XHRsZXQgdGVtcCA9IGFycltpXTtcclxuXHRcdGxldCBjb21wYXJlZCA9IGNvbXBhcmVGbihzZWxlY3QsIHRlbXApO1xyXG5cdFx0aWYgKGNvbXBhcmVkID4gMCkgcmlnaHRBcnIucHVzaCh0ZW1wKTtcclxuXHRcdGVsc2UgaWYgKGNvbXBhcmVkIDwgMCkgbGVmdEFyci5wdXNoKHRlbXApO1xyXG5cdFx0ZWxzZSBNYXRoLnJhbmRvbSgpID4gMC41ID8gcmlnaHRBcnIucHVzaCh0ZW1wKSA6IGxlZnRBcnIucHVzaCh0ZW1wKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiBbbGVmdEFyciwgcmlnaHRBcnJdO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmaW5kSW5kZXgoYXJyLCBpbmRleCwgY29tcGFyZUZuKSB7XHJcblx0aWYgKGFyci5sZW5ndGggPD0gMSB8fCBpbmRleCA9PT0gMCkgcmV0dXJuIGFyclswXTtcclxuXHR2YXIgW3NlbGVjdCwgc2VjX2Fycl0gPSByYW5kb21WYWx1ZShhcnIpO1xyXG5cdHZhciBbbGVmdEFyciwgcmlnaHRBcnJdID0gZmlsdGVyTEFuZFIoc2VjX2Fyciwgc2VsZWN0LCBjb21wYXJlRm4pO1xyXG5cdHZhciBuID0gcmlnaHRBcnIubGVuZ3RoO1xyXG5cclxuXHRpZiAobiA9PT0gaW5kZXggLSAxKSByZXR1cm4gc2VsZWN0O1xyXG5cdGlmIChuID49IGluZGV4KSByZXR1cm4gZmluZEluZGV4KHJpZ2h0QXJyLCBpbmRleCwgY29tcGFyZUZuKTtcclxuXHRlbHNlIHJldHVybiBmaW5kSW5kZXgobGVmdEFyciwgaW5kZXggLSBuIC0gMSwgY29tcGFyZUZuKTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmaW5kSW5kZXg7IiwidmFyIFV0aWxzID0ge307XHJcblxyXG52YXIgdWlkID0gVXRpbHMudWlkID0gKCgpID0+IHtcclxuXHRsZXQgdCA9IERhdGUubm93KCk7XHJcblx0cmV0dXJuICgpID0+IHtcclxuXHRcdHJldHVybiAodCsrKS50b1N0cmluZygxNik7XHJcblx0fTtcclxufSkoKTtcclxuXHJcblxyXG52YXIgbWVyZ2UgPSBVdGlscy5tZXJnZSA9ICh0YXJnZXQsIGFkZGl0aW9uYWwsIGRlZXApID0+IHtcclxuXHRsZXQgZGVwdGggPSB0eXBlb2YgZGVlcCA9PSAndW5kZWZpbmVkJyA/IDIgOiBkZWVwLCBwcm9wO1xyXG5cclxuXHRmb3IgKHByb3AgaW4gYWRkaXRpb25hbCkge1xyXG5cdFx0aWYgKGFkZGl0aW9uYWwuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcclxuXHRcdFx0aWYgKHR5cGVvZiB0YXJnZXRbcHJvcF0gIT09ICdvYmplY3QnIHx8ICFkZXB0aCkge1xyXG5cdFx0XHRcdHRhcmdldFtwcm9wXSA9IGFkZGl0aW9uYWxbcHJvcF07XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0VXRpbHMubWVyZ2UodGFyZ2V0W3Byb3BdLCBhZGRpdGlvbmFsW3Byb3BdLCBkZXB0aCAtIDEpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gdGFyZ2V0O1xyXG59O1xyXG5cclxudmFyIGZpbmRJbmRleCA9IFV0aWxzLmZpbmRJbmRleCA9IHJlcXVpcmUoJy4vRmluZEluZGV4Jyk7XHJcbnZhciBjb21wYXJlRm4gPSBVdGlscy5jb21wYXJlRm4gPSByZXF1aXJlKCcuL3V0aWxzL0NvbXBhcmVyJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFV0aWxzOyIsInZhciBjb250ZXh0ID0gdHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcgPyB0aGlzIDogd2luZG93O1xyXG5leHBvcnRzLiQgPSBjb250ZXh0LiQ7XHJcbmV4cG9ydHMuXyA9IGNvbnRleHQuXzsiLCIvKipcclxuICog5Yib5bu65q+U6L6D5Ye95pWwXHJcbiAqIEBzdW1tYXJ5IOe6puadn+adoeS7tu+8jOWPqumSiOWvueWvueixoeaVsOe7hOe7k+aehOeahOaVsOaNru+8jOWmglxyXG4gKiAgICAgIFt7XCJjb2xfMVwiOiAxMCwgXCJjb2xfMlwiOiAzNSwgXCJjb2xfM1wiOiA2Nn0sIC4uLl1cclxuICpcclxuICogQGV4YW1wbGVcclxuICpcclxuICogIHZhciBzb3J0cyA9IFsnQScsJ0InLCdDJywnRCddO1xyXG4gKiAgdmFyIGRpcnMgPSBbMSwgLTEsIDEsIDFdO1xyXG4gKlxyXG4gKiAgdmFyIGRhdGEzID0gW1xyXG4gKiAgICAgIHtBOjEsQjoxLEM6NSxfaWQ6MX0sXHJcbiAqICAgICAge0E6MSxCOjMsQzo1LF9pZDoxfSxcclxuICogICAgICB7QToyLEI6NSxDOjQsX2lkOjJ9LFxyXG4gKiAgICAgIHtBOjEsQjoxLEM6OSxfaWQ6MX0sXHJcbiAqICAgICAge0E6MyxCOjMsQzozLF9pZDozfSxcclxuICogICAgICB7QToxLEI6MSxDOjMsX2lkOjF9LFxyXG4gKiAgICAgIHtBOjQsQjoyLEM6MixfaWQ6NH0sXHJcbiAqICAgICAge0E6NSxCOjQsQzoxLF9pZDo1fSxcclxuICogIF07XHJcbiAqXHJcbiAqICB2YXIgZm4gPSBjb21wYXJlRm4oc29ydHMsIGRpcnMpO1xyXG4gKiAgdmFyIHJldCA9IGRhdGEzLnNvcnQoZm4pLm1hcChkID0+IE9iamVjdC52YWx1ZXMoZCkpO1xyXG4gKiAgY29uc29sZS5kaXIocmV0KTtcclxuICpcclxuICogQHBhcmFtIHtBcnJheX0gc29ydHMgLeaOkuW6j+Wtl+auteaVsOe7hCBbJ2NvbF8xJywgJ2NvbF8yJywgJ2NvbF8zJywuLi5dXHJcbiAqIEBwYXJhbSB7QXJyYXl9IGRpcnMgLeWvueW6lOWtl+S9k+aOkuW6j+aVsOe7hOeahOWNh+mZjeW6jywx77ya5Y2H5bqPIC0x77ya6ZmN5bqPIFsxLCAtMV1cclxuICogQHJldHVybnMge0Z1bmN0aW9ufSDmr5TovoPlh73mlbBcclxuICovXHJcbmV4cG9ydHMuY29tcGFyZUZuID0gZnVuY3Rpb24gY29tcGFyZUZuKHNvcnRzLCBkaXJzKSB7XHJcbiAgICB2YXIgY29uZGl0aW9ucyA9IHNvcnRzLnJlZHVjZSgocHJlLCBuZXh0LCBpKSA9PiB7XHJcbiAgICAgICAgcHJlICA9IHByZSA/IHByZSArICcgfHwnIDogJyc7XHJcbiAgICAgICAgcmV0dXJuIGAke3ByZX0gKGEuJHtuZXh0fSAtIGIuJHtuZXh0fSkgKiAke2RpcnNbaV19YDtcclxuICAgIH0sICcnKTtcclxuXHJcbiAgICB2YXIgZnVuY3Rpb25fYm9keSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGxldCBzb3J0SW5mbyA9IHNvcnRzLmpvaW4oJywnKS5yZXBsYWNlKC8oXFx3KykvZywgJ1wiJDFcIicpO1xyXG4gICAgICAgIHJldHVybiBgdmFyIHNvcnQgPSBbJHtzb3J0SW5mb31dOyByZXR1cm4gJHtjb25kaXRpb25zfWA7XHJcbiAgICB9XHJcbiAgICAvLyBjb25zb2xlLmxvZyhmdW5jdGlvbl9ib2R5KCkpO1xyXG4gICAgXHJcbiAgICByZXR1cm4gbmV3IEZ1bmN0aW9uKCdhJywgJ2InLCBmdW5jdGlvbl9ib2R5KCkpO1xyXG59XHJcblxyXG5cclxuIl19
