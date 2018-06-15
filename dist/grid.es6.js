(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.sz || (g.sz = {})).grid = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (global){
var EventEmitter = require('../util/EventEmitter');
var $ = (typeof window !== "undefined" ? window['jQuery'] : typeof global !== "undefined" ? global['jQuery'] : null);

var defineDell = function(colM) {
	let cell = $('<li/>')
		.addClass('c-grid-cell')
		.addClass('c-align-' + colM.align)
		.addClass(() => colM.hidden ? 'c-column-hide' : '')
		.addClass(() => colM.locked ? 'c-column-locked' : '')
		.attr('tabindex', -1)
		.data({ 'dataIndex': colM.dataIndex, 'cid': colM.cid })
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

		this.colsModel.on('column-moved', (colM, formIndex, toIndex) => {
			let cell = this.children.get(colM);
			cell.insertAfter(this.$node.find('li.c-grid-cell').eq(toIndex));
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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../util/EventEmitter":14}],2:[function(require,module,exports){
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
(function (global){
var EventEmitter = require('../util/EventEmitter');
var Utils = require('../util/Utils');
var _ = (typeof window !== "undefined" ? window['_'] : typeof global !== "undefined" ? global['_'] : null);

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

 		this.context.fire('column-move-to', this, +index);
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

		this.on('column-move-to', (colM, toIndex) => {
			let current = this.columns.indexOf(colM);

			if (toIndex === current) return;

			if (toIndex > current) {
				this.columns.splice(toIndex + 1, 0, this.columns[current]);
				this.columns.splice(current, 1);
			} else {
				this.columns.splice(toIndex, 0, this.columns[current]);
				this.columns.splice(++current, 1);
			}

			this.fire('column-moved', colM, current, toIndex);
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
		return this.colModel.get(id) || null;
	}

	each(callback, context) {
		this.columns.forEach(callback, context || this);
	}

	destory() { 

	}
}

module.exports = ColModel;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../util/EventEmitter":14,"../util/Utils":16}],4:[function(require,module,exports){
(function (global){
var EventEmitter = require('../util/EventEmitter');
var Utils = require('../util/Utils');
var _ = (typeof window !== "undefined" ? window['_'] : typeof global !== "undefined" ? global['_'] : null);

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

	sum(dataIndex) {
		return _.sumBy(this.rows, row => +row.data[dataIndex]);
	}

	avg(dataIndex) {
		return _.meanBy(this.rows, row => +row.data[dataIndex]);
	}

	max(dataIndex) {
		return _.maxBy(this.rows, row => +row.data[dataIndex]);
	}

	min(dataIndex) {
		return _.minBy(this.rows, row => +row.data[dataIndex]);
	}

	destory() { 

	}
}

module.exports = GridStore;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../util/EventEmitter":14,"../util/Utils":16}],5:[function(require,module,exports){
(function (global){
var EventEmitter = require('../util/EventEmitter');
var ColModel = require('./ColModel');
var GridStore = require('./GridStore');
var BufferNode = require('./BufferNode');
var BufferZone = require('./BufferZone');
var Header = require('./Header');
var LockColManager = require('./LockColManager');
var Scroller = require('./Scroller');
var Utils = require('../util/Utils');
var $ = (typeof window !== "undefined" ? window['jQuery'] : typeof global !== "undefined" ? global['jQuery'] : null);

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
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../util/EventEmitter":14,"../util/Utils":16,"./BufferNode":1,"./BufferZone":2,"./ColModel":3,"./GridStore":4,"./Header":6,"./LockColManager":7,"./Scroller":8}],6:[function(require,module,exports){
(function (global){
const $ = (typeof window !== "undefined" ? window['jQuery'] : typeof global !== "undefined" ? global['jQuery'] : null);
const _ = (typeof window !== "undefined" ? window['_'] : typeof global !== "undefined" ? global['_'] : null);
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

		this._dragging = false;
		this._resizing = false;

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
		this._columnMove();

		this.colsModel.on('column-add', colM => {
			let colElement = createColumnElement(colM);

			this.colElements.set(colM, colElement);
			this.$row.append(colElement);

			let rowW = this.$row.width();
			this.$row.width(rowW + colM.width);
		});

		this.colsModel.on('column-moved', (colM, formIndex, toIndex) => {
			let colElement = this.colElements.get(colM);
			colElement.insertAfter(this.$row.find('li.c-header-cell').eq(toIndex));
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

		let startX = 0;
		let self = this;

		DD(this.$row, {
			'trigger': 'li.c-header-cell',
			'restricter': function(evt) {
				if (self._dragging) return false;

				let offsetX = evt.offsetX;
				
				if (this.offsetWidth - offsetX <= 5) {
					return $(this);
				} else if (offsetX <= 5) {
					return $(this).prev();
				}
			},
			'onDragStart': _.debounce(function(offset, $target) {
				let scrollLeft = document.body.scrollLeft || document.documentElement.scrollLeft;
				// console.log($target.offset().left, $target.text());
				startX = $target.offset().left - scrollLeft;
				// console.log(offset.x, $target.text());
				self._resizing = true;
				// startX = offset.x;
			}, 80),
			'onDragging': function(offset, $target) {

			},
			'onDragEnd': _.debounce(function(offset, $target) {
				let width = offset.x - startX;
				// console.log(`${$target.text()}
				// 	原宽度为${$target.data('column').width},
				// 	改变为：${width}, [${offset.x} - ${startX}]`);
				$target.data('column').setWidth(width);
				self._resizing = false;
			}, 80)
		});
		
	}

	_columnMove() {
		let self = this;
		let toColumn = null;
		let fromColumn = null;
		let $body = $('body');
		let $moveStatusTop = $('<div/>').addClass('c-col-placeholder c-top');
		let $moveStatusBottom = $('<div/>').addClass('c-col-placeholder c-bottom');

		this.$row
			.on('mousedown', 'li.c-header-cell', function(evt) {
				let offsetX = evt.offsetX;
				
				if (this.offsetWidth - offsetX <= 5 || offsetX <= 5) {
					return false;
				}

				self._dragging = true;

				let colEle = $(this).addClass('c-col-draggable');
				fromColumn = $(this).data('column');
				$body.append($moveStatusTop).append($moveStatusBottom);

				evt.stopPropagation();
				evt.preventDefault;

				return false;
			})
			.on('mouseenter', 'li.c-header-cell', function(evt) {
				if (self._dragging) {
					let $overColumn = $(this);
					toColumn = $overColumn.data('column');

					console.log($overColumn.index());
					
					let top = $overColumn.offset().top - 12;
					let left = $overColumn.offset().left + toColumn.width - 8;
					
					$moveStatusTop.css({ top: top, left: left }).show();
					$moveStatusBottom.css({ top: top + 40, left: left }).show();

					evt.stopPropagation();
					evt.preventDefault;

					return false;
				}
			})
			.on('mouseup', function(evt) {
				self._dragging = false;

				if (toColumn) {
					let index = self.colElements.get(toColumn).index();

					let cindex = self.colsModel.getColumn().indexOf(toColumn);

					fromColumn.moveTo(index);
					self.colElements.get(fromColumn).removeClass('c-col-draggable');

					$moveStatusTop.hide().remove();
					$moveStatusBottom.hide().remove();
				}

				fromColumn = null;
				toColumn = null;
			});
	}

	render() {
		this.$header.append(this.$row);
	}

	destory() {

	}
}

module.exports = Header;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../util/DD":13}],7:[function(require,module,exports){
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
(function (global){
var Selection = require('./Selection');
var Menu = require('../plugin/Menu');
var $  = (typeof window !== "undefined" ? window['jQuery'] : typeof global !== "undefined" ? global['jQuery'] : null);

const defHeaderContextMenu = [{ 
		text: '冻结', 
		handler: function(info, context, evt) {
			info.column.lock();
		} 
	}, { 
		text: '解冻', 
		handler: function(info, context, evt) { 
			info.column.unLock();
		} 
	}, { 
		separator: true 
	}, { 
		text: '显示', 
		handler: function(info, context, evt) { 
			info.column.show();
		} 
	}, { 
		text: '隐藏', 
		handler: function(info, context, evt) { 
			info.column.hide();
		} 
	}, { 
		text: '定位', 
		disabled: false,
		handler: function(info, context, evt) { 
			let value, index;

			if (value = prompt('输入查找内容')) {
				context.store.forEach(function(row, i) {
					if (String(row[info.dataIndex]).indexOf(value) !== -1) {
						index = i;
					}
				});

				context.scrollToTop(index * 38);
			}
		} 
	}, { 
		text: '选中整列', 
		handler(info, context, evt) { 
			// alert(self.store.size());
			context._start = [info.column.cid, 0];
			context._end = [info.column.cid, context.store.size() - 1];

			context.selectionRange(context._start, context._end);
		} 
	}, { 
		cls: 'number-column',
		text: '统计总数', 
		handler(info, context, evt) { 
			alert(context.store.size());
		} 
	}, { 
		cls: 'number-column',
		text: '求和', 
		handler(info, context, evt) {
			alert(context.store.sum(info.dataIndex));
		} 
	}, { 
		cls: 'number-column',
		text: '平均', 
		handler(info, context, evt) {
			alert(context.store.avg(info.dataIndex));
		} 
	}, { 
		cls: 'number-column',
		text: '最大值', 
		handler(info, context, evt) {
			var ret = context.store.max(info.dataIndex);
			alert(ret.data[info.dataIndex]);
		} 
	}, { 
		cls: 'number-column',
		text: '最小值', 
		handler(info, context, evt) {
			var ret = context.store.min(info.dataIndex);
			alert(ret.data[info.dataIndex]);
		} 
	}, { 
		cls: 'number-column',
		text: '方差', 
		disabled: true,
		handler(info, context, evt) {
			// alert(context.store.size());
		} 
	}, { 
		cls: 'number-column',
		text: '标准差', 
		disabled: true,
		handler(info, context, evt) {
			// alert(context.store.size());
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
		text: '复制', 
		handler(info, context, evt) { 
			console.log(info, context._selection); 
			context.copySelection(info);
		} 
	},{ 
		text: '打印', 
		handler(info, context, evt) { 
			console.log(evt, data, context);
			window.print();
		} 
	},{ 
		text: '导出', 
		handler(info, context, evt) { 
			
			console.log(context._selection); 
		} 
	},{ 
		text: '标记', 
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
		let columnId = $cell.data('cid');
		let rownumber = +$cell.parent('.c-grid-row').attr('rid');
		let menu = this.$contextmenu;

		let info = { 
			'value': $cell.text(),
			'dataIndex': dataIndex, 
			'columnId': columnId,
			'rownumber': rownumber,
			'rowIndex': rownumber,
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
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../plugin/Menu":12,"./Selection":10}],10:[function(require,module,exports){
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

		let ta = $('<textarea>').val(values).appendTo(this.$dom.body).focus();
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
},{"../core/GridView":5}],11:[function(require,module,exports){
// exports.GridStore = require('./core/GridStore');
// exports.GridView = require('./core/GridView');
// module.exports = require('./extends/Selection');
module.exports = require('./extends/Contextmenu');

// export { default } form './plugin/Contextmenu';

},{"./extends/Contextmenu":9}],12:[function(require,module,exports){
(function (global){
var $ = (typeof window !== "undefined" ? window['jQuery'] : typeof global !== "undefined" ? global['jQuery'] : null);
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
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../util/Utils":16}],13:[function(require,module,exports){
(function (global){
'use strict';
const $ = (typeof window !== "undefined" ? window['jQuery'] : typeof global !== "undefined" ? global['jQuery'] : null);

const FLEXMINWIDTH = 35;

var dragDrop = function(evt, opts) {
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
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],14:[function(require,module,exports){
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
},{"./FindIndex":15,"./utils/Comparer":17}],17:[function(require,module,exports){
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY29yZS9CdWZmZXJOb2RlLmpzIiwic3JjL2NvcmUvQnVmZmVyWm9uZS5qcyIsInNyYy9jb3JlL0NvbE1vZGVsLmpzIiwic3JjL2NvcmUvR3JpZFN0b3JlLmpzIiwic3JjL2NvcmUvR3JpZFZpZXcuanMiLCJzcmMvY29yZS9IZWFkZXIuanMiLCJzcmMvY29yZS9Mb2NrQ29sTWFuYWdlci5qcyIsInNyYy9jb3JlL1Njcm9sbGVyLmpzIiwic3JjL2V4dGVuZHMvQ29udGV4dG1lbnUuanMiLCJzcmMvZXh0ZW5kcy9TZWxlY3Rpb24uanMiLCJzcmMvaW5kZXguanMiLCJzcmMvcGx1Z2luL01lbnUuanMiLCJzcmMvdXRpbC9ERC5qcyIsInNyYy91dGlsL0V2ZW50RW1pdHRlci5qcyIsInNyYy91dGlsL0ZpbmRJbmRleC5qcyIsInNyYy91dGlsL1V0aWxzLmpzIiwic3JjL3V0aWwvdXRpbHMvQ29tcGFyZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDdExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDOU9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDMUpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN6TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDOVBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDblFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcFNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ2pKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzNFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pXQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi4vdXRpbC9FdmVudEVtaXR0ZXInKTtcclxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snalF1ZXJ5J10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWydqUXVlcnknXSA6IG51bGwpO1xyXG5cclxudmFyIGRlZmluZURlbGwgPSBmdW5jdGlvbihjb2xNKSB7XHJcblx0bGV0IGNlbGwgPSAkKCc8bGkvPicpXHJcblx0XHQuYWRkQ2xhc3MoJ2MtZ3JpZC1jZWxsJylcclxuXHRcdC5hZGRDbGFzcygnYy1hbGlnbi0nICsgY29sTS5hbGlnbilcclxuXHRcdC5hZGRDbGFzcygoKSA9PiBjb2xNLmhpZGRlbiA/ICdjLWNvbHVtbi1oaWRlJyA6ICcnKVxyXG5cdFx0LmFkZENsYXNzKCgpID0+IGNvbE0ubG9ja2VkID8gJ2MtY29sdW1uLWxvY2tlZCcgOiAnJylcclxuXHRcdC5hdHRyKCd0YWJpbmRleCcsIC0xKVxyXG5cdFx0LmRhdGEoeyAnZGF0YUluZGV4JzogY29sTS5kYXRhSW5kZXgsICdjaWQnOiBjb2xNLmNpZCB9KVxyXG5cdFx0LndpZHRoKGNvbE0ud2lkdGgpO1xyXG5cclxuXHRyZXR1cm4gY2VsbDtcclxufTtcclxuXHJcbnZhciBjcmVhdGVDZWxsID0gZnVuY3Rpb24oJHJvdywgY29sc01vZGVsKSB7XHJcblx0dmFyIHNpemUgPSBjb2xzTW9kZWwuc2l6ZSgpO1xyXG5cdHZhciBjaGlsZHJlbiA9IG5ldyBNYXAoKTtcclxuXHJcblx0Y29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblx0XHRsZXQgY2VsbCA9IGRlZmluZURlbGwoY29sTSk7XHJcblxyXG5cdFx0JHJvdy5hcHBlbmQoY2VsbCk7XHJcblx0XHRjaGlsZHJlbi5zZXQoY29sTSwgY2VsbCk7XHJcblx0fSk7XHJcblxyXG5cdHJldHVybiBjaGlsZHJlbjtcclxufTtcclxuXHJcbmNsYXNzIFJvd05vZGUgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cdGNvbnN0cnVjdG9yKGNvbHNNb2RlbCwgY29udGV4dCkge1xyXG5cdFx0c3VwZXIoKTtcclxuXHRcdHRoaXMuJHZtID0gY29udGV4dDtcclxuXHRcdHRoaXMuY29sc01vZGVsID0gY29sc01vZGVsO1xyXG5cdFx0dGhpcy4kbm9kZSA9ICQoJzx1bC8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC1yb3cnKTtcclxuXHJcblx0XHR0aGlzLmNoaWxkcmVuID0gY3JlYXRlQ2VsbCh0aGlzLiRub2RlLCBjb2xzTW9kZWwpO1xyXG5cdFx0dGhpcy5fYmluZEV2ZW50KGNvbHNNb2RlbCk7XHJcblx0fVxyXG5cclxuXHRfYmluZEV2ZW50KGNvbHNNb2RlbCkge1xyXG5cdFx0dGhpcy5jb2xzTW9kZWwub24oJ2NvbHVtbi1hZGQnLCBjb2xNID0+IHtcclxuXHRcdFx0bGV0IGNlbGwgPSBkZWZpbmVEZWxsKGNvbE0pO1xyXG5cclxuXHRcdFx0dGhpcy4kbm9kZS5hcHBlbmQoY2VsbCk7XHJcblx0XHRcdHRoaXMuY2hpbGRyZW4uc2V0KGNvbE0sIGNlbGwpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwub24oJ2NvbHVtbi1tb3ZlZCcsIChjb2xNLCBmb3JtSW5kZXgsIHRvSW5kZXgpID0+IHtcclxuXHRcdFx0bGV0IGNlbGwgPSB0aGlzLmNoaWxkcmVuLmdldChjb2xNKTtcclxuXHRcdFx0Y2VsbC5pbnNlcnRBZnRlcih0aGlzLiRub2RlLmZpbmQoJ2xpLmMtZ3JpZC1jZWxsJykuZXEodG9JbmRleCkpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Y29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1yZXNpemVkJywgd2lkdGggPT4ge1xyXG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKHdpZHRoKTtcclxuXHRcdFx0XHR0aGlzLmNoaWxkcmVuLmdldChjb2xNKS5vdXRlcldpZHRoKHdpZHRoKTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4taGlkZGVuJywgaXNIaWRkZW4gPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNoaWxkcmVuLmdldChjb2xNKTtcclxuXHRcdFx0XHRpZiAoaXNIaWRkZW4pIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcygnYy1jb2x1bW4taGlkZScpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoJ2MtY29sdW1uLWhpZGUnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWxvY2tlZCcsIGlzTG9ja2VkID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jaGlsZHJlbi5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdGlmIChpc0xvY2tlZCkge1xyXG5cdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKCdjLWNvbHVtbi1sb2NrZWQnKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKCdjLWNvbHVtbi1sb2NrZWQnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignZGVzdG9yeScsICgpID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jaGlsZHJlbi5nZXQoY29sTSk7XHJcblx0XHRcdFx0dGhpcy5jaGlsZHJlbi5kZWxldGUoY29sTSk7XHRcdFx0XHJcblx0XHRcdFx0Y29sRWxlLnJlbW92ZSgpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0c2V0RGF0YShyb3csIG9mZnNldFRvcCkge1xyXG5cdFx0Ly8g6L+Z6YeM5aaC5p6c55SoQU9Q5pa55byP5a6e546w5pu05aW9VE9ET1xyXG5cdFx0dGhpcy4kdm0uZmlyZSgncm93LXVwZGF0ZS1iZWZvcmUnLCB0aGlzLCByb3cpO1xyXG5cclxuXHRcdHZhciBjb250ZW50O1xyXG5cdFx0dmFyIGNlbGxzID0gdGhpcy5jaGlsZHJlbjtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cclxuXHRcdFx0Y29udGVudCA9IGNvbE0ucmVuZGVyZXIocm93LmRhdGFbY29sTS5kYXRhSW5kZXhdKTtcclxuXHRcdFx0Ly8gVE9ETyBhZGRDbGFzcygoKT0+IHJvdy5jZWxsW2NvbE0uZGF0YUluZGV4XS5zZWxlY3RlZClcclxuXHRcdFx0Y2VsbHMuZ2V0KGNvbE0pLmh0bWwoY29udGVudCk7XHJcblxyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kbm9kZS5jc3MoJ3RvcCcsIG9mZnNldFRvcCkuYXR0cigncmlkJywgcm93LnJpZCk7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuJG5vZGU7XHJcblx0fVxyXG59XHJcblxyXG5jbGFzcyBCdWZmZXJOb2RlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHRjb25zdHJ1Y3RvcihsaW1pdCwgY29sc01vZGVsLCB0b3RhbCwgY2FjaGVUaW1lcykge1xyXG5cdFx0c3VwZXIoKTtcclxuXHRcdHRoaXMuaW5pdChsaW1pdCwgY29sc01vZGVsLCB0b3RhbCwgY2FjaGVUaW1lcyk7XHJcblx0fVxyXG5cclxuXHRpbml0KGxpbWl0LCBjb2xzTW9kZWwsIHRvdGFsLCBjYWNoZVRpbWVzKSB7XHJcblx0XHR0aGlzLmxpbWl0ID0gbGltaXQ7XHJcblx0XHR0aGlzLnRvdGFsID0gdG90YWw7XHJcblx0XHR0aGlzLmNhY2hlVGltZXMgPSBjYWNoZVRpbWVzIHx8IDM7XHJcblx0XHR0aGlzLm5vZGVMaXN0ID0gW107XHJcblx0XHR0aGlzLmNvbHNNb2RlbCA9IGNvbHNNb2RlbDtcclxuXHJcblx0XHQvLyDov5nph4zmmoLkuLpTZWxlY3Rpb27lrp7njrDvvIzlupTor6XnlKhBT1Dnu7TmiqQgVE9ET1xyXG5cdFx0Ly8gdGhpcy5vbigncm93LXVwZGF0ZS1iZWZvcmUnLCAocm93Tm9kZSwgcm93KSA9PiB0aGlzLmZpcmUoJ3Jvdy11cGRhdGUnLCByb3dOb2RlLCByb3cpKTtcclxuXHR9XHJcblxyXG5cdGdldE5vZGVMaXN0KCkge1xyXG5cdFx0cmV0dXJuIHRoaXMubm9kZUxpc3Q7XHJcblx0fVxyXG5cclxuXHRzZXRMaW1pdChsaW1pdCkge1xyXG5cdFx0aWYgKCtsaW1pdCA+IDApIHtcclxuXHRcdFx0dGhpcy5pbml0KGxpbWl0LCB0aGlzLmNvbHNNb2RlbCwgdGhpcy50b3RhbCwgdGhpcy5jYWNoZVRpbWVzKTtcclxuXHRcdFx0dGhpcy5maXJlKCdidWZmZXItaW5pdGlhbCcpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0c2V0VG90YWwodG90YWwpIHtcclxuXHRcdGlmICgrdG90YWwgPj0gMCkge1xyXG5cdFx0XHR0aGlzLnRvdGFsID0gdG90YWw7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRpc0Vub3VnaCgpIHtcclxuXHRcdHJldHVybiB0aGlzLm5vZGVMaXN0Lmxlbmd0aCA+PSBNYXRoLm1pbih0aGlzLnRvdGFsLCB0aGlzLmNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHR9XHJcblxyXG5cdGdldChkaXIsIGRvbWFpbikge1xyXG5cdFx0aWYgKHRoaXMuaXNFbm91Z2goKSkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5fZ2V0Tm9kZXMoZGlyLCBkb21haW4pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzLl9hZGROb2RlcyhkaXIsIGRvbWFpbik7XHJcblx0fVxyXG5cclxuXHRfZ2V0Tm9kZXMoZGlyLCBbc3RhcnQsIGVuZF0pIHtcclxuXHRcdHZhciBzZWxlY3RlZDtcclxuXHJcblx0XHRpZiAoZGlyID4gMCkge1xyXG5cdFx0XHRzZWxlY3RlZCA9IHRoaXMubm9kZUxpc3Quc2xpY2UoMCwgZW5kIC0gc3RhcnQgKyAxKTtcclxuXHRcdFx0dGhpcy5ub2RlTGlzdCA9IHRoaXMubm9kZUxpc3Quc2xpY2UoZW5kIC0gc3RhcnQgKyAxKS5jb25jYXQoc2VsZWN0ZWQpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0c2VsZWN0ZWQgPSB0aGlzLm5vZGVMaXN0LnNsaWNlKHN0YXJ0IC0gZW5kIC0gMSk7XHJcblx0XHRcdHRoaXMubm9kZUxpc3QgPSBzZWxlY3RlZC5jb25jYXQodGhpcy5ub2RlTGlzdC5zbGljZSgwLCBzdGFydCAtIGVuZCAtIDEpKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gc2VsZWN0ZWQgfHwgW107XHJcblx0fVxyXG5cclxuXHRfYWRkTm9kZXMoZGlyLCBbc3RhcnQsIGVuZF0pIHtcclxuXHRcdHZhciBub2RlcyA9IFtdO1xyXG5cclxuXHRcdGZvciAodmFyIGkgPSBzdGFydDsgaSA8PSBlbmQ7IGkrKykge1xyXG5cdFx0XHRub2Rlcy5wdXNoKG5ldyBSb3dOb2RlKHRoaXMuY29sc01vZGVsLCB0aGlzKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5ub2RlTGlzdCA9IGRpciA+IDAgPyB0aGlzLm5vZGVMaXN0LmNvbmNhdChub2RlcykgOiBub2Rlcy5jb25jYXQodGhpcy5ub2RlTGlzdCk7XHJcblxyXG5cdFx0cmV0dXJuIG5vZGVzO1xyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBCdWZmZXJOb2RlO1xyXG4iLCJjbGFzcyBCdWZmZXJab25lIHtcclxuXHRjb25zdHJ1Y3RvcihsaW1pdCwgdG90YWwsIGNhY2hlVGltZXMpIHtcclxuXHRcdHRoaXMuaW5pdChsaW1pdCwgdG90YWwsIGNhY2hlVGltZXMpO1xyXG5cdH1cclxuXHJcblx0aW5pdChsaW1pdCwgdG90YWwsIGNhY2hlVGltZXMpIHtcclxuXHRcdHRoaXMuc3RhcnQgPSAwO1xyXG5cdFx0dGhpcy5lbmQgPSB0aGlzLmxpbWl0ID0gbGltaXQ7XHJcblx0XHR0aGlzLnRvdGFsID0gK3RvdGFsO1xyXG5cdFx0dGhpcy5jYWNoZVRpbWVzID0gY2FjaGVUaW1lcyB8fCAzO1xyXG5cdFx0dGhpcy5kb21haW4gPSBbdGhpcy5zdGFydCwgdGhpcy5lbmRdO1xyXG5cdH1cclxuXHJcblx0c2V0TGltaXQobGltaXQpIHtcclxuXHRcdGlmICgrbGltaXQgPiAwKSB7XHJcblx0XHRcdHRoaXMuaW5pdChsaW1pdCwgdGhpcy50b3RhbCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRzZXRUb3RhbCh0b3RhbCkge1xyXG5cdFx0aWYgKCt0b3RhbCA+PSAwKSB7XHJcblx0XHRcdHRoaXMudG90YWwgPSB0b3RhbDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlzQW1vbmcodmFsdWUpIHtcclxuXHRcdHJldHVybiB0aGlzLnN0YXJ0IDw9IHZhbHVlICYmIHZhbHVlIDw9IHRoaXMuZW5kO1xyXG5cdH1cclxuXHJcblx0c2hvdWxkTG9hZChkaXIsIHZlcm5pZXIpIHtcclxuXHRcdGlmIChkaXIgPT09IDApIHJldHVybiBmYWxzZTtcclxuXHJcblx0XHR2YXIgc3RhcnQgPSB0aGlzLnN0YXJ0O1xyXG5cdFx0dmFyIGVuZCA9IHRoaXMuZW5kO1xyXG5cdFx0dmFyIGNhY2hlVGltZXMgPSB0aGlzLmNhY2hlVGltZXM7XHJcblxyXG5cdFx0Ly8gc2Nyb2xsIHVwXHJcblx0XHRpZiAoZGlyIDwgMCAmJiBzdGFydCA9PT0gMCkgcmV0dXJuIGZhbHNlO1xyXG5cdFx0aWYgKGRpciA8IDAgJiYgdmVybmllciA8IHN0YXJ0ICsgdGhpcy5saW1pdCkge1xyXG5cdFx0XHRpZiAodGhpcy5pc0Ftb25nKHZlcm5pZXIpKSB7XHJcblx0XHRcdFx0ZW5kID0gc3RhcnQgLSAxO1xyXG5cdFx0XHRcdHN0YXJ0ID0gTWF0aC5tYXgoMCwgZW5kIC0gdGhpcy5saW1pdCk7XHJcblx0XHRcdH0gZWxzZSBpZiAodmVybmllciA9PT0gMCkge1xyXG5cdFx0XHRcdGVuZCA9IE1hdGgubWluKHRoaXMudG90YWwsIHZlcm5pZXIgKyBjYWNoZVRpbWVzICogdGhpcy5saW1pdCk7XHJcblx0XHRcdFx0c3RhcnQgPSAwO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGVuZCA9IHZlcm5pZXIgKyB0aGlzLmxpbWl0O1xyXG5cdFx0XHRcdHN0YXJ0ID0gTWF0aC5tYXgoMCwgdmVybmllciAtIChjYWNoZVRpbWVzIC0gMSkgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5kb21haW4gPSBbc3RhcnQsIGVuZF07XHJcblx0XHRcdHRoaXMuc3RhcnQgPSBzdGFydDtcclxuXHRcdFx0dGhpcy5lbmQgPSBNYXRoLm1pbihzdGFydCArIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0LCB0aGlzLmVuZCk7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIHNjcm9sbCBkb3duXHJcblx0XHRpZiAoZGlyID4gMCAmJiBlbmQgPT09IHRoaXMudG90YWwpIHJldHVybiBmYWxzZTtcclxuXHRcdGlmIChkaXIgPiAwICYmIHZlcm5pZXIgPiBlbmQgLSB0aGlzLmxpbWl0KSB7XHJcblx0XHRcdC8vIOa4uOagh+WcqOeOsOacieiMg+WbtOWGhVxyXG5cdFx0XHRpZiAodGhpcy5pc0Ftb25nKHZlcm5pZXIpKSB7XHJcblx0XHRcdFx0c3RhcnQgPSBlbmQgKyAxO1xyXG5cdFx0XHRcdGVuZCA9IE1hdGgubWluKHRoaXMudG90YWwsIHN0YXJ0ICsgdGhpcy5saW1pdCk7XHJcblx0XHRcdH1cclxuXHRcdFx0Ly8g5ri45qCH5Yiw6L6+57uT5bC+XHJcblx0XHRcdGVsc2UgaWYgKHZlcm5pZXIgPT09IHRoaXMudG90YWwpIHtcclxuXHRcdFx0XHRlbmQgPSB0aGlzLnRvdGFsO1xyXG5cdFx0XHRcdHN0YXJ0ID0gTWF0aC5tYXgoMCwgdmVybmllciAtIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvLyDkuI3lnKjnjrDmnInojIPlm7Tlj4jmnKrliLDnu5PlsL7lpIRcclxuXHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0ZW5kID0gTWF0aC5taW4odGhpcy50b3RhbCwgdmVybmllciArIChjYWNoZVRpbWVzIC0gMSkgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0XHRzdGFydCA9IE1hdGgubWF4KDAsIGVuZCAtIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5kb21haW4gPSBbc3RhcnQsIGVuZF07XHJcblx0XHRcdHRoaXMuZW5kID0gZW5kO1xyXG5cdFx0XHR0aGlzLnN0YXJ0ID0gTWF0aC5tYXgodGhpcy5zdGFydCwgZW5kIC0gY2FjaGVUaW1lcyAqIHRoaXMubGltaXQpO1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBCdWZmZXJab25lOyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCcuLi91dGlsL0V2ZW50RW1pdHRlcicpO1xyXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuLi91dGlsL1V0aWxzJyk7XHJcbnZhciBfID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ18nXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ18nXSA6IG51bGwpO1xyXG5cclxudmFyIGRlZlJlbmRlcmVyID0gdiA9PiB2O1xyXG52YXIgT1JERVIgPSBbJ0FTQycsICdERVNDJ107XHJcblxyXG5jbGFzcyBDb2x1bW4gZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cdGNvbnN0cnVjdG9yKGNpZCwgb3B0aW9ucywgY29udGV4dCkge1xyXG5cdFx0c3VwZXIoKTtcclxuXHJcblx0XHRvcHRpb25zLnJlbmRlcmVyID0gb3B0aW9ucy5yZW5kZXJlciB8fCBkZWZSZW5kZXJlcjtcclxuXHJcblx0XHR2YXIgZGVmYXVsdHMgPSB7XHJcblx0XHRcdCd0ZXh0JzogJycsXHJcblx0XHRcdCd2dHlwZSc6ICdzdHJpbmcnLFxyXG5cdFx0XHQnZGF0YUluZGV4JzogJycsXHJcblx0XHRcdCd3aWR0aCc6IDUwLFxyXG5cdFx0XHQnYWxpZ24nOiAnbGVmdCcsXHJcblxyXG5cdFx0XHQncmVzaXphYmxlJzogdHJ1ZSxcclxuXHRcdFx0J2Nscyc6ICcnLFxyXG5cdFx0XHQnZml4ZWQnOiBmYWxzZSxcclxuXHRcdFx0J2RyYWdnYWJsZSc6IGZhbHNlLFxyXG5cdFx0XHQnc29ydGFibGUnOiB0cnVlLFxyXG5cdFx0XHQnaGlkZGVuJzogZmFsc2UsXHJcblx0XHRcdCdsb2NrZWQnOiBmYWxzZSxcclxuXHRcdFx0J2xvY2thYmxlJzogdHJ1ZSxcclxuXHRcdFx0J21lbnVEaXNhYmxlZCc6IHRydWUsXHJcblxyXG5cdFx0XHQvLyBwcml2YXRlXHJcblx0XHRcdCdzb3J0U3RhdGUnOiBudWxsXHJcblx0XHR9O1xyXG5cclxuXHRcdHRoaXMuY2lkID0gY2lkO1xyXG5cdFx0dGhpcy5jb250ZXh0ID0gY29udGV4dDtcclxuXHRcdE9iamVjdC5hc3NpZ24odGhpcywgZGVmYXVsdHMsIG9wdGlvbnMpO1xyXG5cdH1cclxuXHJcblx0c2V0V2lkdGgobnVtKSB7XHJcblx0XHRpZiAoIXRoaXMucmVzaXphYmxlKSByZXR1cm47XHJcblx0XHRpZiAoaXNOYU4obnVtKSkgcmV0dXJuO1xyXG5cclxuXHRcdHRoaXMud2lkdGggPSArbnVtO1xyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4tcmVzaXplZCcsIHRoaXMud2lkdGgsIHRoaXMpO1xyXG5cdH1cclxuXHJcblx0c2hvdygpIHtcclxuXHRcdHRoaXMuaGlkZGVuID0gZmFsc2U7XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1oaWRkZW4nLCB0aGlzLmhpZGRlbiwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHRoaWRlKCkge1xyXG5cdFx0dGhpcy51bkxvY2soKTtcclxuXHRcdFxyXG5cdFx0dGhpcy5oaWRkZW4gPSB0cnVlO1xyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4taGlkZGVuJywgdGhpcy5oaWRkZW4sIHRoaXMpO1xyXG5cdH1cclxuXHJcblx0dG9nZ2xlKCkge1xyXG5cdFx0aWYgKHRoaXMuaGlkZGVuKSB7XHJcblx0XHRcdHRoaXMuc2hvdygpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhpcy5oaWRlKCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRsb2NrKCkge1xyXG5cdFx0aWYgKCF0aGlzLmxvY2thYmxlKSByZXR1cm47XHJcblx0XHRpZiAodGhpcy5sb2NrZWQpIHJldHVybjtcclxuXHJcblx0XHR0aGlzLnNob3coKTtcclxuXHJcblx0XHR0aGlzLmxvY2tlZCA9IHRydWU7XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1sb2NrZWQnLCB0aGlzLmxvY2tlZCwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHR1bkxvY2soKSB7XHJcblx0XHRpZiAoIXRoaXMubG9ja2FibGUpIHJldHVybjtcclxuXHRcdGlmICghdGhpcy5sb2NrZWQpIHJldHVybjtcclxuXHJcblx0XHR0aGlzLmxvY2tlZCA9IGZhbHNlO1xyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4tbG9ja2VkJywgdGhpcy5sb2NrZWQsIHRoaXMpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogb3JkZXJbQVNDLCBERVNDLCBOT19TT1JUXVxyXG5cdCAqL1xyXG5cdHNvcnQob3JkZXIpIHtcclxuXHRcdGlmICghdGhpcy5zb3J0YWJsZSB8fCAhdGhpcy5kYXRhSW5kZXgpIHJldHVybjtcclxuXHJcblx0XHRpZiAob3JkZXIpIHtcclxuXHRcdFx0dGhpcy5zb3J0U3RhdGUgPSBPUkRFUi5pbmNsdWRlcyhvcmRlcikgPyBvcmRlciA6IG51bGw7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aGlzLnNvcnRTdGF0ZSA9IHRoaXMuc29ydFN0YXRlID09PSBPUkRFUlsxXSA/IE9SREVSWzBdIDogT1JERVJbMV07XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLXNvcnQtY2hhbmdlZCcsIHRoaXMuc29ydFN0YXRlKTtcclxuXHRcdHRoaXMuY29udGV4dC5maXJlKCdub3RpY2UtY29sTW9kZWwtc29ydC1jaGFuZ2VkJyk7XHJcbiBcdH1cclxuXHJcbiBcdG1vdmVUbyhpbmRleCkge1xyXG4gXHRcdGlmIChpc05hTigraW5kZXgpKSByZXR1cm47XHJcblxyXG4gXHRcdHRoaXMuY29udGV4dC5maXJlKCdjb2x1bW4tbW92ZS10bycsIHRoaXMsICtpbmRleCk7XHJcbiBcdH1cclxuXHJcbiBcdHJlbW92ZSgpIHtcclxuIFx0XHR0aGlzLmZpcmUoJ2Rlc3RvcnknKTtcclxuIFx0XHR0aGlzLmNvbnRleHQuZmlyZSgnY29sdW1uLXJlbW92ZWQnLCB0aGlzKTtcclxuIFx0XHR0aGlzLnJlbW92ZUV2ZW50KCk7XHJcbiBcdH1cclxufVxyXG5cclxuXHJcbmNsYXNzIENvbE1vZGVsIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHRjb25zdHJ1Y3Rvcihjb2x1bW5zKSB7XHJcblx0XHRzdXBlcigpO1xyXG5cclxuXHRcdGlmICghQXJyYXkuaXNBcnJheShjb2x1bW5zKSkge1xyXG5cdFx0XHR0aHJvdyAncmVxdWlyZSBwcm9wZXJ0eSBjb2x1bW5zIGlzIGEgYXJyYXkgb2JqZWN0JztcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLmNvbHVtbnMgPSBbXTsgLy8gZGF0YSBieSBjb2x1bW5cclxuXHRcdHRoaXMuY29sTW9kZWwgPSBuZXcgTWFwKCk7IC8vIGRhdGEgYnkgY2lkXHJcblx0XHR0aGlzLmNvbEhlYWRlcnMgPSBuZXcgTWFwKCk7IC8vIGRhdGEgYnkgZGF0YUluZGV4XHJcblxyXG5cdFx0dGhpcy5faW5pdENvbHVtbihjb2x1bW5zKTtcclxuXHRcdHRoaXMuX2JpbmRFdmVudCgpO1xyXG5cdH1cclxuXHJcblx0X2luaXRDb2x1bW4oY29sdW1ucywgY2FsbGJhY2spIHtcclxuXHRcdGxldCBzaXplID0gdGhpcy5zaXplKCk7XHJcblxyXG5cdFx0Y29sdW1ucy5mb3JFYWNoKChjb2wsIGluZGV4KSA9PiB7XHJcblx0XHRcdC8vIGNpZOino+WGs+ayoeaciWRhdGFJbmRleOWIl+aIluebuOWQjGRhdGFJbmRleOWIl+eahOmXrumimFxyXG5cdFx0XHRsZXQgY2lkID0gaW5kZXggKyBzaXplO1xyXG5cdFx0XHRsZXQgY29sTSA9IG5ldyBDb2x1bW4oY2lkLCBjb2wsIHRoaXMpO1xyXG5cclxuXHRcdFx0dGhpcy5jb2xNb2RlbC5zZXQoY2lkLCBjb2xNKTtcclxuXHRcdFx0dGhpcy5jb2x1bW5zLnB1c2goY29sTSk7XHJcblx0XHRcdHRoaXMuY29sSGVhZGVycy5zZXQoY29sLmRhdGFJbmRleCwgY29sTSk7XHJcblxyXG5cdFx0XHRjYWxsYmFjayAmJiBjYWxsYmFjayhjb2xNKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0YWRkQ29sdW1ucyhjb2x1bW5zKSB7XHJcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoY29sdW1ucykpIHtcclxuXHRcdFx0Y29sdW1ucyA9IFtjb2x1bW5zXTtcclxuXHRcdH1cclxuXHRcdHRoaXMuX2luaXRDb2x1bW4oY29sdW1ucywgY29sTSA9PiB0aGlzLmZpcmUoJ2NvbHVtbi1hZGQnLCBjb2xNKSk7XHJcblx0fVxyXG5cclxuXHRyZW1vdmVDb2x1bW4oZGF0YUluZGV4KSB7XHJcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoZGF0YUluZGV4KSkge1xyXG5cdFx0XHRkYXRhSW5kZXggPSBbZGF0YUluZGV4XTtcclxuXHRcdH1cclxuXHJcblx0XHRkYXRhSW5kZXguZm9yRWFjaChkcyA9PiB7XHJcblx0XHRcdGxldCBjb2xNID0gdGhpcy5nZXRDb2x1bW5CeURhdGFJbmRleChkcyk7XHJcblxyXG5cdFx0XHRpZiAoY29sTSkge1xyXG5cdFx0XHRcdGNvbE0ucmVtb3ZlKCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0X2JpbmRFdmVudCgpIHtcclxuXHRcdHRoaXMub24oJ25vdGljZS1jb2xNb2RlbC1zb3J0LWNoYW5nZWQnLCBfLmRlYm91bmNlKCgpID0+IHtcclxuXHRcdFx0dGhpcy5maXJlKCdjb2x1bW5zLXNvcnQtY2hhbmdlZCcpO1xyXG5cdFx0fSwgMjApKTtcclxuXHJcblx0XHR0aGlzLm9uKCdjb2x1bW4tbW92ZS10bycsIChjb2xNLCB0b0luZGV4KSA9PiB7XHJcblx0XHRcdGxldCBjdXJyZW50ID0gdGhpcy5jb2x1bW5zLmluZGV4T2YoY29sTSk7XHJcblxyXG5cdFx0XHRpZiAodG9JbmRleCA9PT0gY3VycmVudCkgcmV0dXJuO1xyXG5cclxuXHRcdFx0aWYgKHRvSW5kZXggPiBjdXJyZW50KSB7XHJcblx0XHRcdFx0dGhpcy5jb2x1bW5zLnNwbGljZSh0b0luZGV4ICsgMSwgMCwgdGhpcy5jb2x1bW5zW2N1cnJlbnRdKTtcclxuXHRcdFx0XHR0aGlzLmNvbHVtbnMuc3BsaWNlKGN1cnJlbnQsIDEpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHRoaXMuY29sdW1ucy5zcGxpY2UodG9JbmRleCwgMCwgdGhpcy5jb2x1bW5zW2N1cnJlbnRdKTtcclxuXHRcdFx0XHR0aGlzLmNvbHVtbnMuc3BsaWNlKCsrY3VycmVudCwgMSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuZmlyZSgnY29sdW1uLW1vdmVkJywgY29sTSwgY3VycmVudCwgdG9JbmRleCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLm9uKCdjb2x1bW4tcmVtb3ZlZCcsIGNvbE0gPT4ge1xyXG5cdFx0XHR0aGlzLmNvbHVtbnMgPSB0aGlzLmNvbHVtbnMuZmlsdGVyKGNvbCA9PiBjb2wuZGF0YUluZGV4ICE9IGNvbE0uZGF0YUluZGV4KTtcclxuXHRcdFx0dGhpcy5jb2xNb2RlbC5kZWxldGUoY29sTS5jaWQpO1xyXG5cdFx0XHR0aGlzLmNvbEhlYWRlcnMuZGVsZXRlKGNvbE0uZGF0YUluZGV4KTtcclxuXHRcdH0pO1xyXG5cclxuXHR9XHJcblxyXG5cdHNpemUoKSB7IFxyXG5cdFx0cmV0dXJuIHRoaXMuY29sTW9kZWwuc2l6ZTsgXHJcblx0fVxyXG5cclxuXHRnZXRDb2x1bW4oY29sKSB7XHJcblx0XHRpZiAodGhpcy5jb2x1bW5zLmluY2x1ZGVzKGNvbCkpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuY29sdW1ucy5maWx0ZXIoX2NvbCA9PiBfY29sID09IGNvbClbMF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuY29sdW1ucztcclxuXHR9XHJcblxyXG5cdGdldExvY2tDb2x1bW4oKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5jb2x1bW5zLmZpbHRlcihjb2xNID0+IHtcclxuXHRcdFx0cmV0dXJuIGNvbE0ubG9ja2VkID09PSB0cnVlO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRnZXRWaXNpYmxlQ29sdW1uKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuY29sdW1ucy5maWx0ZXIoY29sTSA9PiB7XHJcblx0XHRcdHJldHVybiAhY29sTS5oaWRkZW47XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGdldENvbHVtbkJ5RGF0YUluZGV4KGRhdGFJbmRleCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuY29sSGVhZGVycy5nZXQoZGF0YUluZGV4KSB8fCBudWxsO1xyXG5cdH1cclxuXHJcblx0Z2V0Q29sdW1uc0J5SWQoaWQpIHtcclxuXHRcdHJldHVybiB0aGlzLmNvbE1vZGVsLmdldChpZCkgfHwgbnVsbDtcclxuXHR9XHJcblxyXG5cdGVhY2goY2FsbGJhY2ssIGNvbnRleHQpIHtcclxuXHRcdHRoaXMuY29sdW1ucy5mb3JFYWNoKGNhbGxiYWNrLCBjb250ZXh0IHx8IHRoaXMpO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHsgXHJcblxyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDb2xNb2RlbDsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi4vdXRpbC9FdmVudEVtaXR0ZXInKTtcclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbC9VdGlscycpO1xyXG52YXIgXyA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydfJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWydfJ10gOiBudWxsKTtcclxuXHJcbmNsYXNzIFJvdyB7XHJcblx0Y29uc3RydWN0b3IocmlkLCBkYXRhKSB7XHJcblx0XHR0aGlzLnJpZCA9IHJpZDtcclxuXHRcdHRoaXMuZGF0YSA9IGRhdGE7XHJcblx0XHR0aGlzLnNlbGVjdGVkID0gZmFsc2U7XHJcblx0fVxyXG5cdHN0YXRlKCkge31cclxufVxyXG5cclxuY2xhc3MgR3JpZFN0b3JlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHJcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xyXG5cdFx0c3VwZXIoKTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbCA9IG9wdGlvbnMuY29sdW1uTW9kZWw7XHJcblxyXG5cdFx0dGhpcy5yb3dzID0gW107IC8vIGRhdGEgYnkgaW5kZXhcclxuXHRcdHRoaXMucm93TW9kZWwgPSBuZXcgTWFwKCk7IC8vIGRhdGEgYnkgaWRcclxuXHJcblxyXG5cdFx0dGhpcy5zZXREYXRhKG9wdGlvbnMuZGF0YSk7XHJcblxyXG5cdFx0dGhpcy5fc29ydFN0YXRlID0geyBrZXlzOiBbXSwgZGlyczogW10gfTtcclxuXHRcdHRoaXMuX2JpbmRFdmVudCgpO1xyXG5cdH1cclxuXHJcblx0X2JpbmRFdmVudCgpIHtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tc29ydC1jaGFuZ2VkJywgc29ydFN0YXRlID0+IHtcclxuXHRcdFx0XHRsZXQgeyBrZXlzLCBkaXJzIH0gPSB0aGlzLl9zb3J0U3RhdGU7XHJcblx0XHRcdFx0bGV0IGluZGV4ID0ga2V5cy5pbmRleE9mKGNvbE0uZGF0YUluZGV4KTtcclxuXHJcblx0XHRcdFx0Ly8g5pyq5o6S5bqPXHJcblx0XHRcdFx0aWYgKGluZGV4ID09PSAtMSAmJiAhc29ydFN0YXRlKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoaW5kZXggPT09IC0xICYmIHNvcnRTdGF0ZSkge1xyXG5cdFx0XHRcdFx0a2V5cy51bnNoaWZ0KGNvbE0uZGF0YUluZGV4KTtcclxuXHRcdFx0XHRcdGRpcnMudW5zaGlmdChzb3J0U3RhdGUudG9Mb3dlckNhc2UoKSk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyDlt7LmjpLluo8s5YWI5Yig6ZmkXHJcblx0XHRcdFx0bGV0IGtleSA9IGtleXMuc3BsaWNlKGluZGV4LCAxKVswXTtcclxuXHRcdFx0XHRsZXQgZGlyID0gZGlycy5zcGxpY2UoaW5kZXgsIDEpWzBdO1xyXG5cclxuXHRcdFx0XHRpZiAoc29ydFN0YXRlKSB7XHJcblx0XHRcdFx0XHRrZXlzLnVuc2hpZnQoa2V5KTtcclxuXHRcdFx0XHRcdGRpcnMudW5zaGlmdChzb3J0U3RhdGUudG9Mb3dlckNhc2UoKSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHQvLyDmiYDmnInliJfpg73mm7TmlrDnirbmgIHlkI5cclxuXHRcdHRoaXMuY29sc01vZGVsLm9uKCdjb2x1bW5zLXNvcnQtY2hhbmdlZCcsICgpID0+IHtcclxuXHRcdFx0bGV0IHsga2V5cywgZGlycyB9ID0gdGhpcy5fc29ydFN0YXRlO1xyXG5cdFx0XHRsZXQgaXRlcmF0ZUZuID0gcm93ID0+IHJvdy5kYXRhW2tleXNbMF1dO1xyXG5cclxuXHRcdFx0Ly8gY29uc29sZS5sb2coa2V5cywgZGlycyk7XHJcblxyXG5cdFx0XHR0aGlzLnJvd3MgPSBfLm9yZGVyQnkodGhpcy5yb3dzLCBpdGVyYXRlRm4sIGRpcnMpO1xyXG5cdFx0XHR0aGlzLnNldERhdGEoXy5tYXAodGhpcy5yb3dzLCAnZGF0YScpKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0c2xpY2Uoc3RhcnQsIGVuZCkge1xyXG5cdFx0cmV0dXJuIHRoaXMucm93cy5zbGljZShzdGFydCwgZW5kKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIOiuvue9ruaOkuW6j+eKtuaAgVxyXG5cdCAqICgrKUFTQywgLURFU0MsICFOT19TT1JUXHJcblx0ICogQHNvcnRzIHtBcnJheX0gc29ydHMgLeaOkuW6j+eKtuaAgeaVsOe7hFxyXG5cdCAqXHRzb3J0cyA9IFsnK2NvbEEnLCAnY29sQicsICctY29sQycsICchY29sRCddXHJcblx0ICogQHJldHVybnMgdGhpcztcclxuXHQgKi9cclxuXHRzZXRTb3J0U3RhdGUoc29ydHMpIHtcclxuXHRcdGlmICghQXJyYXkuaXNBcnJheShzb3J0cykpIHtcclxuXHRcdFx0c29ydHMgPSBbc29ydHNdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX3NvcnRTdGF0ZSA9IHsga2V5czogW10sIGRpcnM6IFtdIH07XHJcblxyXG5cdFx0Ly8g5Y+N6L2s5LyY5YWI57qn5pa55L6/5ZCO57ut6Kem5Y+R6aG65bqP5pe25ZCO6Kem5Y+R55qE5LyY5YWI57qn6auYXHJcblx0XHRzb3J0cy5yZXZlcnNlKCkuZWFjaChzb3J0T2JqID0+IHtcclxuXHRcdFx0bGV0IG9iaiwga2V5LCBkaXIsIGNvbDtcclxuXHJcblx0XHRcdGlmICh0eXBlb2Ygc29ydE9iaiA9PT0gJ3N0cmluZycpIHtcclxuXHRcdFx0XHRvYmogPSBzb3J0T2JqLm1hdGNoKC8oXlsrfC18IV0/KSguezAsfSkvKTtcclxuXHRcdFx0XHRkaXIgPSBvYmpbMV0gPT09ICcnID8gJ0FTQycgOiAob2JqID09PSAnLScgPyAnREVTQycgOiAnTk9fU09SVCcpO1xyXG5cdFx0XHRcdGtleSA9IG9ialsyXSA/IG9ialsyXSA6IG51bGw7XHJcblxyXG5cdFx0XHRcdGNvbCA9IHRoaXMuY29sc01vZGVsLmdldENvbHVtbkJ5RGF0YUluZGV4KGtleSk7XHJcblx0XHRcdFx0aWYgKGNvbCkge1xyXG5cdFx0XHRcdFx0Y29sLnNvcnQoZGlyKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0c2V0RGF0YShkYXRhID0gW10sIGFwcGVuZCA9IGZhbHNlKSB7XHJcblx0XHRpZiAoIWFwcGVuZCkge1xyXG5cdFx0XHR0aGlzLnJvd3MubGVuZ3RoID0gMDtcclxuXHRcdFx0dGhpcy5yb3dNb2RlbC5jbGVhcigpO1xyXG5cdFx0fVxyXG5cdFx0dmFyIGluZGV4ID0gdGhpcy5zaXplKCk7XHJcblx0XHRkYXRhLmZvckVhY2goKHJvdywgcmlkeCkgPT4ge1xyXG5cdFx0XHRsZXQgcm93TSA9IG5ldyBSb3cocmlkeCArIGluZGV4LCByb3cpO1xyXG5cdFx0XHR0aGlzLnJvd3MucHVzaChyb3dNKTtcclxuXHRcdFx0dGhpcy5yb3dNb2RlbC5zZXQocmlkeCArIGluZGV4LCByb3dNKTtcclxuXHRcdH0pO1xyXG5cdFx0dGhpcy5maXJlKCdkYXRhLWNoYW5nZWQnLCBhcHBlbmQpO1xyXG5cdH1cclxuXHJcblx0Zm9yRWFjaChjYWxsYmFjaywgY29udGV4dCkge1xyXG5cdFx0dGhpcy5yb3dzLmZvckVhY2goZnVuY3Rpb24ocm93TSwgcmlkeCkge1xyXG5cdFx0XHRjYWxsYmFjay5jYWxsKHRoaXMsIHJvd00uZGF0YSwgcmlkeCk7XHJcblx0XHR9LCBjb250ZXh0IHx8IHRoaXMpO1xyXG5cdH1cclxuXHJcblx0c2l6ZSgpIHtcclxuXHRcdHJldHVybiB0aGlzLnJvd01vZGVsLnNpemU7XHJcblx0fVxyXG5cclxuXHRzdW0oZGF0YUluZGV4KSB7XHJcblx0XHRyZXR1cm4gXy5zdW1CeSh0aGlzLnJvd3MsIHJvdyA9PiArcm93LmRhdGFbZGF0YUluZGV4XSk7XHJcblx0fVxyXG5cclxuXHRhdmcoZGF0YUluZGV4KSB7XHJcblx0XHRyZXR1cm4gXy5tZWFuQnkodGhpcy5yb3dzLCByb3cgPT4gK3Jvdy5kYXRhW2RhdGFJbmRleF0pO1xyXG5cdH1cclxuXHJcblx0bWF4KGRhdGFJbmRleCkge1xyXG5cdFx0cmV0dXJuIF8ubWF4QnkodGhpcy5yb3dzLCByb3cgPT4gK3Jvdy5kYXRhW2RhdGFJbmRleF0pO1xyXG5cdH1cclxuXHJcblx0bWluKGRhdGFJbmRleCkge1xyXG5cdFx0cmV0dXJuIF8ubWluQnkodGhpcy5yb3dzLCByb3cgPT4gK3Jvdy5kYXRhW2RhdGFJbmRleF0pO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHsgXHJcblxyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBHcmlkU3RvcmU7IiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJy4uL3V0aWwvRXZlbnRFbWl0dGVyJyk7XHJcbnZhciBDb2xNb2RlbCA9IHJlcXVpcmUoJy4vQ29sTW9kZWwnKTtcclxudmFyIEdyaWRTdG9yZSA9IHJlcXVpcmUoJy4vR3JpZFN0b3JlJyk7XHJcbnZhciBCdWZmZXJOb2RlID0gcmVxdWlyZSgnLi9CdWZmZXJOb2RlJyk7XHJcbnZhciBCdWZmZXJab25lID0gcmVxdWlyZSgnLi9CdWZmZXJab25lJyk7XHJcbnZhciBIZWFkZXIgPSByZXF1aXJlKCcuL0hlYWRlcicpO1xyXG52YXIgTG9ja0NvbE1hbmFnZXIgPSByZXF1aXJlKCcuL0xvY2tDb2xNYW5hZ2VyJyk7XHJcbnZhciBTY3JvbGxlciA9IHJlcXVpcmUoJy4vU2Nyb2xsZXInKTtcclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbC9VdGlscycpO1xyXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydqUXVlcnknXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ2pRdWVyeSddIDogbnVsbCk7XHJcblxyXG5mdW5jdGlvbiBjcmVhdGVMYXlvdXQoY29udGFpbmVyLCB3aWR0aCkge1xyXG5cdHZhciB3cmFwcGVyID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC13cmFwcGVyJykud2lkdGgod2lkdGgpO1xyXG5cdHZhciBoZWFkZXIgPSAkKCc8ZGl2Lz4nKS5hZGRDbGFzcygnYy1ncmlkLWhlYWRlcicpO1xyXG5cdHZhciBib2R5ID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC1ib2R5Jyk7XHJcblx0dmFyIHZpZXdwb3J0ID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC12aWV3cG9ydCcpLmFwcGVuZFRvKGJvZHkpO1xyXG5cdHZhciBjYW52YXMgPSAkKCc8ZGl2Lz4nKS5hZGRDbGFzcygnYy1ncmlkLWNhbnZhcycpLmFwcGVuZFRvKHZpZXdwb3J0KTtcclxuXHR3cmFwcGVyLmFwcGVuZChoZWFkZXIpLmFwcGVuZChib2R5KS5hcHBlbmRUbyhjb250YWluZXIpO1xyXG5cclxuXHRyZXR1cm4geyB3cmFwcGVyLCBoZWFkZXIsIGJvZHksIHZpZXdwb3J0LCBjYW52YXMgfTtcclxufVxyXG5mdW5jdGlvbiBjYWxjUm93SGVpZ2h0KCkge1xyXG5cdHZhciBsaSA9ICQoJzxsaSBjbGFzcz1cImMtZ3JpZC1jZWxsXCI+cGxhY2Vob2xkZXI8L2xpPicpLmFwcGVuZFRvKFwiYm9keVwiKTtcclxuXHR2YXIgcm93SGVpZ2h0ID0gbGkub3V0ZXJIZWlnaHQoKTtcclxuXHRsaS5yZW1vdmUoKTtcclxuXHJcblx0cmV0dXJuIHJvd0hlaWdodDtcclxufVxyXG5cclxuY2xhc3MgR3JpZENvbXBvbmVudCBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xyXG5cdFx0c3VwZXIoKTtcclxuXHJcblx0XHRpZiAoISQob3B0aW9ucy5kb21FbCkuc2l6ZSgpKSB7IHRocm93ICdyZXF1aXJlIGEgdmFsaWQgZG9tRWwnOyB9XHJcblxyXG5cdFx0dGhpcy5zaG91bGRBZGROb2RlcyA9IHRydWU7XHJcblx0XHR0aGlzLmhlaWdodCA9ICtvcHRpb25zLmhlaWdodCB8fCA1MDA7XHJcblx0XHR0aGlzLndpZHRoID0gb3B0aW9ucy53aWR0aDtcclxuXHJcblx0XHQvLyAkbGF5b3V0IGRvbVxyXG5cdFx0T2JqZWN0LmFzc2lnbih0aGlzLiRkb20gPSB7fSwgY3JlYXRlTGF5b3V0KCQob3B0aW9ucy5kb21FbCksIHRoaXMud2lkdGgpKTtcclxuXHJcblx0XHR0aGlzLmNvbHVtbk1vZGVsID0gbmV3IENvbE1vZGVsKG9wdGlvbnMuY29sdW1ucyk7XHJcblx0XHR0aGlzLnN0b3JlID0gbmV3IEdyaWRTdG9yZSh7IGNvbHVtbk1vZGVsOiB0aGlzLmNvbHVtbk1vZGVsLCAnZGF0YSc6IG9wdGlvbnMuZGF0YSB8fCBbXSB9KTtcclxuXHRcdHRoaXMuX2luaXQoKTtcclxuXHRcdHRoaXMuX2JpbmRFdmVudCgpO1xyXG5cdH1cclxuXHJcblx0X2luaXQoKSB7XHJcblx0XHR0aGlzLmhlYWRlciA9IG5ldyBIZWFkZXIodGhpcy4kZG9tLmhlYWRlciwgdGhpcy5jb2x1bW5Nb2RlbCk7XHJcblx0XHR2YXIgdG90YWwgPSB0aGlzLnN0b3JlLnNpemUoKTtcclxuXHRcdHZhciByb3dIZWlnaHQgPSB0aGlzLnJvd0hlaWdodCA9IGNhbGNSb3dIZWlnaHQoKTtcclxuXHRcdHZhciB2aWV3cG9ydEhlaWdodCA9IHRoaXMuaGVpZ2h0IC0gdGhpcy4kZG9tLmhlYWRlci5vdXRlckhlaWdodCgpO1xyXG5cdFx0dmFyIHNpbmdsZVBhZ2VTaXplID0gTWF0aC5taW4oTWF0aC5jZWlsKHZpZXdwb3J0SGVpZ2h0LyByb3dIZWlnaHQpIC0gMSwgdG90YWwgLSAxKTtcclxuXHJcblx0XHR0aGlzLmJ1ZmZlclpvbmUgPSBuZXcgQnVmZmVyWm9uZShzaW5nbGVQYWdlU2l6ZSwgdG90YWwpO1xyXG5cdFx0dGhpcy5idWZmZXJOb2RlID0gbmV3IEJ1ZmZlck5vZGUoc2luZ2xlUGFnZVNpemUsIHRoaXMuY29sdW1uTW9kZWwsIHRvdGFsKTtcclxuXHRcdHRoaXMuc2Nyb2xsZXIgPSBuZXcgU2Nyb2xsZXIocm93SGVpZ2h0LCB0aGlzLmJ1ZmZlclpvbmUpO1xyXG5cdFx0dGhpcy5zY3JvbGxlclxyXG5cdFx0XHQub25YKHggPT4ge1xyXG5cdFx0XHRcdHRoaXMuZmlyZSgnc2Nyb2xsTGVmdCcsIHgpO1xyXG5cdFx0XHRcdHRoaXMuJGRvbS5oZWFkZXIuc2Nyb2xsTGVmdCh4KTtcclxuXHRcdFx0fSlcclxuXHRcdFx0Lm9uWSgoZGlyLCBkb21haW4sIHN0YXJ0LCBlbmQsIGluZGV4LCB0b3RhbCkgPT4ge1xyXG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKGDmu5rliqjmlrnlkJHvvJoke2Rpcn0sIOWKoOi9veWMuumXtDogWyR7ZG9tYWlufV0sIOeOsOacieiMg+WbtO+8migke3N0YXJ0fSAtICR7ZW5kfSksIGApXHJcblx0XHRcdFx0dGhpcy5fYnVmZmVyUmVuZGVyKGRpciwgZG9tYWluKTtcclxuXHRcdFx0fSwgMjApO1xyXG5cclxuXHRcdHRoaXMuJGRvbS52aWV3cG9ydC5oZWlnaHQodmlld3BvcnRIZWlnaHQpO1xyXG5cdFx0dGhpcy4kZG9tLnZpZXdwb3J0Lm9uKCdzY3JvbGwnLCAoZXZ0KSA9PiB7XHJcblx0XHRcdHRoaXMuc2Nyb2xsZXIuZmlyZVkoZXZ0LnRhcmdldC5zY3JvbGxUb3ApO1xyXG5cdFx0XHR0aGlzLnNjcm9sbGVyLmZpcmVYKGV2dC50YXJnZXQuc2Nyb2xsTGVmdCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmxvY2tDb2xNYW5hZ2VyID0gTG9ja0NvbE1hbmFnZXIodGhpcy5jb2x1bW5Nb2RlbCwgdGhpcy5oZWFkZXIsIHRoaXMuJGRvbSwgdGhpcy5idWZmZXJOb2RlKTtcclxuXHRcdHRoaXMuX3NldENhbnZhc1dIKHRvdGFsKTtcclxuXHR9XHJcblxyXG5cdF9zZXRDYW52YXNXSCh0b3RhbCkge1xyXG5cdFx0dGhpcy4kZG9tLmNhbnZhc1xyXG5cdFx0XHQud2lkdGgodG90YWwgPyAnYXV0bycgOiB0aGlzLl91bkxvY2tWaXNpYmxlQ29sc1dpZHRoKCkpXHJcblx0XHRcdC5oZWlnaHQodGhpcy5yb3dIZWlnaHQgKiB0b3RhbCB8fCAxKTtcclxuXHR9XHJcblxyXG5cdF91bkxvY2tWaXNpYmxlQ29sc1dpZHRoKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuaGVhZGVyLmdldFZpc2libGVDb2xzV2lkdGgoKSArIHRoaXMubG9ja0NvbE1hbmFnZXIudmlzaWJsZUxvY2tDb2x1bW4uZ2V0V2lkdGgoKTtcclxuXHR9XHJcblxyXG5cdHNjcm9sbFRvVG9wKHBvc2l0aW9uKSB7XHJcblx0XHR0aGlzLiRkb20udmlld3BvcnQuc2Nyb2xsVG9wKHBvc2l0aW9uKTtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHR0aGlzLm9uKCd2aWV3cG9ydC1oZWlnaHQtY2hhbmdlZCcsIHZpZXdwb3J0SGVpZ2h0ID0+IHtcclxuXHRcdFx0dGhpcy5fdXBkYXRlQnVmZmVyKCk7XHJcblx0XHRcdHRoaXMucmVuZGVyKCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLm9uKCdzY3JvbGxMZWZ0JywgeCA9PiB7XHJcblx0XHRcdC8vIHBlcmZvcm1hbmNlIFRPRE9cclxuXHRcdFx0Ly8gbGV0IGxvY2tDb2x1bW5XaWR0aCA9IHRoaXMuaGVhZGVyLmdldFZpc2libGVMb2NrQ29sc1dpZHRoKCk7XHJcblx0XHRcdC8vIHRoaXMuJGRvbS5jYW52YXMuZmluZCgnLmMtY29sdW1uLWxvY2tlZCcpLmNzcygnbGVmdCcsIHggLSBsb2NrQ29sdW1uV2lkdGgpO1xyXG5cdFx0XHQvLyB0aGlzLiRkb20uaGVhZGVyLmZpbmQoJy5jLWNvbHVtbi1sb2NrZWQnKS5jc3MoJ2xlZnQnLCB4IC0gbG9ja0NvbHVtbldpZHRoKTtcclxuXHRcdFx0dGhpcy5sb2NrQ29sTWFuYWdlci5zZXRMb2NrQ29sdW1uWCh4KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuc3RvcmUub24oJ2RhdGEtY2hhbmdlZCcsIChhcHBlbmQpID0+IHtcclxuXHRcdFx0bGV0IHRvdGFsID0gdGhpcy5zdG9yZS5zaXplKCk7XHJcblx0XHRcdHRoaXMuX3NldENhbnZhc1dIKHRvdGFsKTtcclxuXHRcdFx0dGhpcy5idWZmZXJOb2RlLnNldFRvdGFsKHRvdGFsKTtcclxuXHRcdFx0dGhpcy5idWZmZXJab25lLnNldFRvdGFsKHRvdGFsKTtcclxuXHJcblx0XHRcdGlmICghYXBwZW5kIHx8ICh0b3RhbCAtIDEpICogdGhpcy5yb3dIZWlnaHQgPCAyKnRoaXMuJGRvbS52aWV3cG9ydC5vdXRlckhlaWdodCgpKSB7XHJcblx0XHRcdFx0dGhpcy5fdXBkYXRlQnVmZmVyKCk7XHJcblx0XHRcdFx0dGhpcy5yZW5kZXIoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblxyXG5cdH1cclxuXHJcblx0X3VwZGF0ZUJ1ZmZlcigpIHtcclxuXHRcdHZhciBsaW1pdCA9IE1hdGgubWluKFxyXG5cdFx0XHRNYXRoLmNlaWwodGhpcy4kZG9tLnZpZXdwb3J0Lm91dGVySGVpZ2h0KCkgLyB0aGlzLnJvd0hlaWdodCkgLSAxLFxyXG5cdFx0XHR0aGlzLnN0b3JlLnNpemUoKSAtIDEpO1xyXG5cclxuXHRcdHRoaXMuYnVmZmVyWm9uZS5zZXRMaW1pdChsaW1pdCk7XHJcblx0XHR0aGlzLmJ1ZmZlck5vZGUuc2V0TGltaXQobGltaXQpO1xyXG5cdFx0dGhpcy5zaG91bGRBZGROb2RlcyA9IHRydWU7XHJcblx0XHR0aGlzLnNjcm9sbFRvVG9wKDApO1xyXG5cclxuXHRcdHRoaXMuJGRvbS5jYW52YXMuZW1wdHkoKTtcclxuXHR9XHJcblxyXG5cdF9idWZmZXJSZW5kZXIoZGlyLCBbc3RhcnQsIGVuZF0pIHtcclxuXHRcdHZhciBub2RlcyA9IHRoaXMuYnVmZmVyTm9kZS5nZXQoZGlyLCBbc3RhcnQsIGVuZF0pO1xyXG5cdFx0Y29uc29sZS5sb2coJ+S4gOasoeiOt+WPluiKgueCuemVv+W6picsIG5vZGVzLmxlbmd0aCwgc3RhcnQsIGVuZCk7XHJcblxyXG5cdFx0aWYgKCF0aGlzLnNob3VsZEFkZE5vZGVzKSB7XHJcblx0XHRcdHRoaXMuc3RvcmUuc2xpY2Uoc3RhcnQsIGVuZCArIDEpLmZvckVhY2goKHJvd00sIGkpID0+IHtcclxuXHRcdFx0XHRub2Rlc1tpXS5zZXREYXRhKHJvd00sIHJvd00ucmlkICogdGhpcy5yb3dIZWlnaHQpO1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHZhciAkZG9jRnJhbWUgPSAkKCc8ZGl2Lz4nKTtcclxuXHRcdHRoaXMuc3RvcmUuc2xpY2Uoc3RhcnQsIGVuZCArIDEpLmZvckVhY2goKHJvd00sIGkpID0+IHtcclxuXHJcblx0XHRcdGxldCBub2RlID0gbm9kZXNbaV0uc2V0RGF0YShyb3dNLCByb3dNLnJpZCAqIHRoaXMucm93SGVpZ2h0KTtcclxuXHRcdFx0JGRvY0ZyYW1lLmFwcGVuZChub2RlKTtcclxuXHRcdFxyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kZG9tLmNhbnZhcy5hcHBlbmQoJGRvY0ZyYW1lLmNoaWxkcmVuKCkpO1xyXG5cdFx0dGhpcy5sb2NrQ29sTWFuYWdlci5hZGRCdWZmZXJMb2NrTm9kZShub2Rlcyk7XHJcblxyXG5cdFx0aWYgKHRoaXMuYnVmZmVyTm9kZS5pc0Vub3VnaCgpKSB7XHJcblx0XHRcdHRoaXMuc2hvdWxkQWRkTm9kZXMgPSBmYWxzZTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJlbmRlcigpIHtcclxuXHRcdHRoaXMuX2J1ZmZlclJlbmRlcigxLCB0aGlzLmJ1ZmZlclpvbmUuZG9tYWluKTtcclxuXHR9XHJcblxyXG5cdHNldFdpZHRoKG51bSkge1xyXG5cdFx0aWYgKGlzTmFOKG51bSkpIHJldHVybjtcclxuXHJcblx0XHR0aGlzLiRkb20ud3JhcHBlci53aWR0aChudW0pO1xyXG5cdH1cclxuXHJcblx0c2V0SGVpZ2h0KG51bSkge1xyXG5cdFx0aWYgKGlzTmFOKG51bSkpIHJldHVybjtcclxuXHJcblx0XHR2YXIgdmlld3BvcnRIZWlnaHQgPSBudW0gLSB0aGlzLiRkb20uaGVhZGVyLm91dGVySGVpZ2h0KCk7XHJcblx0XHR0aGlzLiRkb20udmlld3BvcnQub3V0ZXJIZWlnaHQodmlld3BvcnRIZWlnaHQpO1xyXG5cdFx0dGhpcy5maXJlKCd2aWV3cG9ydC1oZWlnaHQtY2hhbmdlZCcsIHZpZXdwb3J0SGVpZ2h0KTtcclxuXHR9XHJcblxyXG5cdGRlc3RvcnkoKSB7XHJcblx0XHR0aGlzLmNvbHVtbk1vZGVsLmRlc3RvcnkoKTtcclxuXHRcdHRoaXMuc3RvcmUuZGVzdG9yeSgpO1xyXG5cdFx0dGhpcy5oZWFkZXIuZGVzdG9yeSgpO1xyXG5cdFx0dGhpcy4kZG9tLndyYXBwZXIucmVtb3ZlKCk7XHJcblx0fVxyXG59XHJcbm1vZHVsZS5leHBvcnRzID0gR3JpZENvbXBvbmVudDsiLCJjb25zdCAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ2pRdWVyeSddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnalF1ZXJ5J10gOiBudWxsKTtcclxuY29uc3QgXyA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydfJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWydfJ10gOiBudWxsKTtcclxuY29uc3QgREQgPSByZXF1aXJlKCcuLi91dGlsL0REJyk7XHJcblxyXG5jb25zdCBTT1JUX0NMU19BU0MgPSAnYy1jb2x1bW4tYXNjJztcclxuY29uc3QgU09SVF9DTFNfREVTQyA9ICdjLWNvbHVtbi1kZXNjJztcclxuY29uc3QgTkVFRExFU1NfV0lEVEggPSAxMDAwO1xyXG5cclxudmFyIGNyZWF0ZUNvbHVtbkVsZW1lbnQgPSBmdW5jdGlvbihjb2xNKSB7XHJcblx0dmFyIGxvY2tDbGFzcyA9IGNvbE0ubG9ja2VkID8gJyBjLWNvbHVtbi1sb2NrZWQnIDogJyc7XHJcblxyXG5cdHJldHVybiAkKCc8bGkvPicpXHJcblx0XHQuYWRkQ2xhc3MoJ2MtaGVhZGVyLWNlbGwnICsgbG9ja0NsYXNzKVxyXG5cdFx0LmFkZENsYXNzKCdjLWFsaWduLScgKyBjb2xNLmFsaWduKVxyXG5cdFx0LndpZHRoKGNvbE0ud2lkdGgpXHJcblx0XHQub24oJ2NsaWNrJywgKCkgPT4geyBjb2xNLnNvcnQoKTsgfSlcclxuXHRcdC5kYXRhKCdjb2x1bW4nLCBjb2xNKVxyXG5cdFx0Lmh0bWwoY29sTS50ZXh0KTtcclxufTtcclxuXHJcblxyXG5jbGFzcyBIZWFkZXIge1xyXG5cdGNvbnN0cnVjdG9yKCRoZWFkZXIsIGNvbHNNb2RlbCkge1xyXG5cclxuXHRcdHRoaXMuX2RyYWdnaW5nID0gZmFsc2U7XHJcblx0XHR0aGlzLl9yZXNpemluZyA9IGZhbHNlO1xyXG5cclxuXHRcdHRoaXMuJGhlYWRlciA9ICRoZWFkZXI7XHJcblx0XHR0aGlzLmNvbHNNb2RlbCA9IGNvbHNNb2RlbDtcclxuXHRcdC8vIHRoaXMuc3RvcmUgPSBzdG9yZTtcclxuXHRcdHRoaXMuY29sRWxlbWVudHMgPSBuZXcgTWFwKCk7XHJcblxyXG5cdFx0dGhpcy5fY3JlYXRlQ29sdW1uRWxlbWVudHMoKTtcclxuXHRcdHRoaXMuX2JpbmRFdmVudCgpO1xyXG5cclxuXHRcdHRoaXMucmVuZGVyKCk7XHJcblx0fVxyXG5cclxuXHRfY3JlYXRlQ29sdW1uRWxlbWVudHMoKSB7XHJcblx0XHR2YXIgd2lkdGggPSBORUVETEVTU19XSURUSDtcclxuXHJcblx0XHR0aGlzLiRyb3cgPSAkKCc8dWwvPicpLmFkZENsYXNzKCdjLWhlYWRlci1yb3cnKTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRsZXQgY29sRWxlbWVudCA9IGNyZWF0ZUNvbHVtbkVsZW1lbnQoY29sTSk7XHJcblxyXG5cdFx0XHR0aGlzLmNvbEVsZW1lbnRzLnNldChjb2xNLCBjb2xFbGVtZW50KTtcclxuXHRcdFx0dGhpcy4kcm93LmFwcGVuZChjb2xFbGVtZW50KTtcclxuXHJcblx0XHRcdHdpZHRoICs9IGNvbE0ud2lkdGg7XHJcblxyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kcm93LndpZHRoKHdpZHRoKTtcclxuXHR9XHJcblxyXG5cdGdldFZpc2libGVDb2xzV2lkdGgoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy4kcm93LndpZHRoKCkgLSBORUVETEVTU19XSURUSDtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHR0aGlzLl9jb2x1bW5SZXNpemUoKTtcclxuXHRcdHRoaXMuX2NvbHVtbk1vdmUoKTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5vbignY29sdW1uLWFkZCcsIGNvbE0gPT4ge1xyXG5cdFx0XHRsZXQgY29sRWxlbWVudCA9IGNyZWF0ZUNvbHVtbkVsZW1lbnQoY29sTSk7XHJcblxyXG5cdFx0XHR0aGlzLmNvbEVsZW1lbnRzLnNldChjb2xNLCBjb2xFbGVtZW50KTtcclxuXHRcdFx0dGhpcy4kcm93LmFwcGVuZChjb2xFbGVtZW50KTtcclxuXHJcblx0XHRcdGxldCByb3dXID0gdGhpcy4kcm93LndpZHRoKCk7XHJcblx0XHRcdHRoaXMuJHJvdy53aWR0aChyb3dXICsgY29sTS53aWR0aCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5vbignY29sdW1uLW1vdmVkJywgKGNvbE0sIGZvcm1JbmRleCwgdG9JbmRleCkgPT4ge1xyXG5cdFx0XHRsZXQgY29sRWxlbWVudCA9IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cdFx0XHRjb2xFbGVtZW50Lmluc2VydEFmdGVyKHRoaXMuJHJvdy5maW5kKCdsaS5jLWhlYWRlci1jZWxsJykuZXEodG9JbmRleCkpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwuZWFjaChjb2xNID0+IHtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1yZXNpemVkJywgd2lkdGggPT4gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSkub3V0ZXJXaWR0aCh3aWR0aCkpO1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWhpZGRlbicsIGlzSGlkZGVuID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblx0XHRcdFx0aWYgKGlzSGlkZGVuKSB7XHJcblx0XHRcdFx0XHRjb2xFbGUuYWRkQ2xhc3MoJ2MtY29sdW1uLWhpZGUnKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKCdjLWNvbHVtbi1oaWRlJyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1sb2NrZWQnLCBpc0xvY2tlZCA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0XHRpZiAoaXNMb2NrZWQpIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcygnYy1jb2x1bW4tbG9ja2VkJyk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcygnYy1jb2x1bW4tbG9ja2VkJyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1zb3J0LWNoYW5nZWQnLCBzb3J0U3RhdGUgPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coc29ydFN0YXRlKTtcclxuXHRcdFx0XHRpZiAoc29ydFN0YXRlKSB7XHJcblx0XHRcdFx0XHRpZiAoc29ydFN0YXRlID09PSAnQVNDJykge1xyXG5cdFx0XHRcdFx0XHRjb2xFbGUuYWRkQ2xhc3MoU09SVF9DTFNfQVNDKTtcclxuXHRcdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKFNPUlRfQ0xTX0RFU0MpO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKFNPUlRfQ0xTX0RFU0MpO1xyXG5cdFx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoU09SVF9DTFNfQVNDKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKFNPUlRfQ0xTX0FTQykucmVtb3ZlQ2xhc3MoU09SVF9DTFNfREVTQyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2Rlc3RvcnknLCAoKSA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cdFx0XHRcdHRoaXMuY29sRWxlbWVudHMuZGVsZXRlKGNvbE0pO1x0XHRcdFxyXG5cdFx0XHRcdGNvbEVsZS5yZW1vdmUoKTtcclxuXHJcblx0XHRcdFx0bGV0IHJvd1cgPSB0aGlzLiRyb3cud2lkdGgoKTtcclxuXHRcdFx0XHR0aGlzLiRyb3cud2lkdGgocm93VyAtIGNvbE0ud2lkdGgpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0X2NvbHVtblJlc2l6ZSgpIHtcclxuXHRcdHRoaXMuJHJvdy5vbignbW91c2Vtb3ZlJywgJ2xpLmMtaGVhZGVyLWNlbGwnLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0dmFyIG9mZnNldFggPSBldnQub2Zmc2V0WDtcclxuXHRcdFx0aWYgKHRoaXMub2Zmc2V0V2lkdGggLSBvZmZzZXRYIDw9IDUgfHwgb2Zmc2V0WCA8PSA1KSB7XHJcblx0XHRcdFx0JCh0aGlzKS5hZGRDbGFzcygnYy1jb2wtcmVzaXphYmxlJyk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0JCh0aGlzKS5yZW1vdmVDbGFzcygnYy1jb2wtcmVzaXphYmxlJyk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHRcdGxldCBzdGFydFggPSAwO1xyXG5cdFx0bGV0IHNlbGYgPSB0aGlzO1xyXG5cclxuXHRcdEREKHRoaXMuJHJvdywge1xyXG5cdFx0XHQndHJpZ2dlcic6ICdsaS5jLWhlYWRlci1jZWxsJyxcclxuXHRcdFx0J3Jlc3RyaWN0ZXInOiBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRpZiAoc2VsZi5fZHJhZ2dpbmcpIHJldHVybiBmYWxzZTtcclxuXHJcblx0XHRcdFx0bGV0IG9mZnNldFggPSBldnQub2Zmc2V0WDtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRpZiAodGhpcy5vZmZzZXRXaWR0aCAtIG9mZnNldFggPD0gNSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuICQodGhpcyk7XHJcblx0XHRcdFx0fSBlbHNlIGlmIChvZmZzZXRYIDw9IDUpIHtcclxuXHRcdFx0XHRcdHJldHVybiAkKHRoaXMpLnByZXYoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sXHJcblx0XHRcdCdvbkRyYWdTdGFydCc6IF8uZGVib3VuY2UoZnVuY3Rpb24ob2Zmc2V0LCAkdGFyZ2V0KSB7XHJcblx0XHRcdFx0bGV0IHNjcm9sbExlZnQgPSBkb2N1bWVudC5ib2R5LnNjcm9sbExlZnQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbExlZnQ7XHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coJHRhcmdldC5vZmZzZXQoKS5sZWZ0LCAkdGFyZ2V0LnRleHQoKSk7XHJcblx0XHRcdFx0c3RhcnRYID0gJHRhcmdldC5vZmZzZXQoKS5sZWZ0IC0gc2Nyb2xsTGVmdDtcclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyhvZmZzZXQueCwgJHRhcmdldC50ZXh0KCkpO1xyXG5cdFx0XHRcdHNlbGYuX3Jlc2l6aW5nID0gdHJ1ZTtcclxuXHRcdFx0XHQvLyBzdGFydFggPSBvZmZzZXQueDtcclxuXHRcdFx0fSwgODApLFxyXG5cdFx0XHQnb25EcmFnZ2luZyc6IGZ1bmN0aW9uKG9mZnNldCwgJHRhcmdldCkge1xyXG5cclxuXHRcdFx0fSxcclxuXHRcdFx0J29uRHJhZ0VuZCc6IF8uZGVib3VuY2UoZnVuY3Rpb24ob2Zmc2V0LCAkdGFyZ2V0KSB7XHJcblx0XHRcdFx0bGV0IHdpZHRoID0gb2Zmc2V0LnggLSBzdGFydFg7XHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coYCR7JHRhcmdldC50ZXh0KCl9XHJcblx0XHRcdFx0Ly8gXHTljp/lrr3luqbkuLokeyR0YXJnZXQuZGF0YSgnY29sdW1uJykud2lkdGh9LFxyXG5cdFx0XHRcdC8vIFx05pS55Y+Y5Li677yaJHt3aWR0aH0sIFske29mZnNldC54fSAtICR7c3RhcnRYfV1gKTtcclxuXHRcdFx0XHQkdGFyZ2V0LmRhdGEoJ2NvbHVtbicpLnNldFdpZHRoKHdpZHRoKTtcclxuXHRcdFx0XHRzZWxmLl9yZXNpemluZyA9IGZhbHNlO1xyXG5cdFx0XHR9LCA4MClcclxuXHRcdH0pO1xyXG5cdFx0XHJcblx0fVxyXG5cclxuXHRfY29sdW1uTW92ZSgpIHtcclxuXHRcdGxldCBzZWxmID0gdGhpcztcclxuXHRcdGxldCB0b0NvbHVtbiA9IG51bGw7XHJcblx0XHRsZXQgZnJvbUNvbHVtbiA9IG51bGw7XHJcblx0XHRsZXQgJGJvZHkgPSAkKCdib2R5Jyk7XHJcblx0XHRsZXQgJG1vdmVTdGF0dXNUb3AgPSAkKCc8ZGl2Lz4nKS5hZGRDbGFzcygnYy1jb2wtcGxhY2Vob2xkZXIgYy10b3AnKTtcclxuXHRcdGxldCAkbW92ZVN0YXR1c0JvdHRvbSA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWNvbC1wbGFjZWhvbGRlciBjLWJvdHRvbScpO1xyXG5cclxuXHRcdHRoaXMuJHJvd1xyXG5cdFx0XHQub24oJ21vdXNlZG93bicsICdsaS5jLWhlYWRlci1jZWxsJywgZnVuY3Rpb24oZXZ0KSB7XHJcblx0XHRcdFx0bGV0IG9mZnNldFggPSBldnQub2Zmc2V0WDtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRpZiAodGhpcy5vZmZzZXRXaWR0aCAtIG9mZnNldFggPD0gNSB8fCBvZmZzZXRYIDw9IDUpIHtcclxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHNlbGYuX2RyYWdnaW5nID0gdHJ1ZTtcclxuXHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9ICQodGhpcykuYWRkQ2xhc3MoJ2MtY29sLWRyYWdnYWJsZScpO1xyXG5cdFx0XHRcdGZyb21Db2x1bW4gPSAkKHRoaXMpLmRhdGEoJ2NvbHVtbicpO1xyXG5cdFx0XHRcdCRib2R5LmFwcGVuZCgkbW92ZVN0YXR1c1RvcCkuYXBwZW5kKCRtb3ZlU3RhdHVzQm90dG9tKTtcclxuXHJcblx0XHRcdFx0ZXZ0LnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cdFx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdDtcclxuXHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9KVxyXG5cdFx0XHQub24oJ21vdXNlZW50ZXInLCAnbGkuYy1oZWFkZXItY2VsbCcsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHRcdGlmIChzZWxmLl9kcmFnZ2luZykge1xyXG5cdFx0XHRcdFx0bGV0ICRvdmVyQ29sdW1uID0gJCh0aGlzKTtcclxuXHRcdFx0XHRcdHRvQ29sdW1uID0gJG92ZXJDb2x1bW4uZGF0YSgnY29sdW1uJyk7XHJcblxyXG5cdFx0XHRcdFx0Y29uc29sZS5sb2coJG92ZXJDb2x1bW4uaW5kZXgoKSk7XHJcblx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdGxldCB0b3AgPSAkb3ZlckNvbHVtbi5vZmZzZXQoKS50b3AgLSAxMjtcclxuXHRcdFx0XHRcdGxldCBsZWZ0ID0gJG92ZXJDb2x1bW4ub2Zmc2V0KCkubGVmdCArIHRvQ29sdW1uLndpZHRoIC0gODtcclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0JG1vdmVTdGF0dXNUb3AuY3NzKHsgdG9wOiB0b3AsIGxlZnQ6IGxlZnQgfSkuc2hvdygpO1xyXG5cdFx0XHRcdFx0JG1vdmVTdGF0dXNCb3R0b20uY3NzKHsgdG9wOiB0b3AgKyA0MCwgbGVmdDogbGVmdCB9KS5zaG93KCk7XHJcblxyXG5cdFx0XHRcdFx0ZXZ0LnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cdFx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0O1xyXG5cclxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pXHJcblx0XHRcdC5vbignbW91c2V1cCcsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHRcdHNlbGYuX2RyYWdnaW5nID0gZmFsc2U7XHJcblxyXG5cdFx0XHRcdGlmICh0b0NvbHVtbikge1xyXG5cdFx0XHRcdFx0bGV0IGluZGV4ID0gc2VsZi5jb2xFbGVtZW50cy5nZXQodG9Db2x1bW4pLmluZGV4KCk7XHJcblxyXG5cdFx0XHRcdFx0bGV0IGNpbmRleCA9IHNlbGYuY29sc01vZGVsLmdldENvbHVtbigpLmluZGV4T2YodG9Db2x1bW4pO1xyXG5cclxuXHRcdFx0XHRcdGZyb21Db2x1bW4ubW92ZVRvKGluZGV4KTtcclxuXHRcdFx0XHRcdHNlbGYuY29sRWxlbWVudHMuZ2V0KGZyb21Db2x1bW4pLnJlbW92ZUNsYXNzKCdjLWNvbC1kcmFnZ2FibGUnKTtcclxuXHJcblx0XHRcdFx0XHQkbW92ZVN0YXR1c1RvcC5oaWRlKCkucmVtb3ZlKCk7XHJcblx0XHRcdFx0XHQkbW92ZVN0YXR1c0JvdHRvbS5oaWRlKCkucmVtb3ZlKCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRmcm9tQ29sdW1uID0gbnVsbDtcclxuXHRcdFx0XHR0b0NvbHVtbiA9IG51bGw7XHJcblx0XHRcdH0pO1xyXG5cdH1cclxuXHJcblx0cmVuZGVyKCkge1xyXG5cdFx0dGhpcy4kaGVhZGVyLmFwcGVuZCh0aGlzLiRyb3cpO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHtcclxuXHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEhlYWRlcjsiLCIndXNlIHN0cmljdCc7XHJcblxyXG5jbGFzcyBMb2NrQ29sdW1uIHtcclxuXHRjb25zdHJ1Y3RvcigpIHtcclxuXHRcdHRoaXMuX2RhdGEgPSBbXTtcclxuXHRcdHRoaXMuX2NvbHVtbnNXaWR0aCA9IDA7XHJcblx0fVxyXG5cclxuXHRhZGQoY29sTSkge1xyXG5cdFx0dGhpcy5fZGF0YS51bnNoaWZ0KGNvbE0pO1xyXG5cdFx0dGhpcy5yZUNhbGMoKTtcclxuXHR9XHJcblxyXG5cdHJlbW92ZShkZWxDb2xNKSB7XHJcblx0XHR0aGlzLl9kYXRhID0gdGhpcy5fZGF0YS5maWx0ZXIoY29sTSA9PiBjb2xNICE9PSBkZWxDb2xNKTtcclxuXHRcdHRoaXMucmVDYWxjKCk7XHJcblx0fVxyXG5cclxuXHRjbGVhcigpIHtcclxuXHRcdHRoaXMuX2RhdGEubGVuZ3RoID0gMDtcclxuXHRcdHRoaXMucmVDYWxjKCk7XHJcblx0fVxyXG5cclxuXHRnZXRXaWR0aCgpIHtcclxuXHRcdHJldHVybiB0aGlzLl9jb2x1bW5zV2lkdGg7XHJcblx0fVxyXG5cclxuXHRyZUNhbGMoKSB7XHJcblx0XHR0aGlzLl9jb2x1bW5zV2lkdGggPSB0aGlzLl9kYXRhLnJlZHVjZSgod2lkdGgsIGNvbE0pID0+IHtcclxuXHRcdFx0d2lkdGggLT0gY29sTS53aWR0aDtcclxuXHRcdFx0Y29sTS5hd2F5RnJvbUxlZnQgPSB3aWR0aDtcclxuXHRcdFx0cmV0dXJuIHdpZHRoO1xyXG5cdFx0fSwgMCk7XHJcblx0fVxyXG5cclxuXHRlYWNoKGZuKSB7XHJcblx0XHR0aGlzLl9kYXRhLmZvckVhY2goZm4pO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICog5b2T5YW25Lit5LiA5YiX5Y+R55Sf5Y+Y5YyW77yM6YCa55+l5YW25a6D5YiX55u45bqU5Y+Y5YyWXHJcblx0ICovXHJcblx0IHB1Ymxpc2goY2hhbmdlZENvbE0sIHNjcm9sbExlZnQpIHtcclxuXHQgXHR0aGlzLl9kYXRhLmZvckVhY2goY29sTSA9PiB7XHJcblx0IFx0XHRpZiAoY29sTSAhPT0gY2hhbmdlZENvbE0pIHtcclxuXHQgXHRcdFx0Y29sTS5maXJlKCdzY3JvbGwteCcsIHNjcm9sbExlZnQpO1xyXG5cdCBcdFx0fVxyXG5cdCBcdH0pO1xyXG5cdCB9XHJcbn1cclxuXHJcbnZhciBMb2NrQ29sTWFuYWdlciA9IGZ1bmN0aW9uKGNvbHNNb2RlbCwgaGVhZGVyLCAkZG9tLCBidWZmZXJOb2RlKSB7XHJcblx0bGV0IHZpc2libGVMb2NrQ29sdW1uID0gbmV3IExvY2tDb2x1bW4oKTtcclxuXHJcblx0aW5pdCgpO1xyXG5cdGluaXRFdmVudCgpO1xyXG5cclxuXHRmdW5jdGlvbiBpbml0KCkge1xyXG5cdFx0Y29sc01vZGVsXHJcblx0XHRcdC5nZXRMb2NrQ29sdW1uKClcclxuXHRcdFx0LmZpbHRlcihjb2xNID0+ICFjb2xNLmhpZGRlbilcclxuXHRcdFx0LmZvckVhY2goY29sTSA9PiB2aXNpYmxlTG9ja0NvbHVtbi5hZGQoY29sTSkpO1xyXG5cclxuXHRcdHVwZGF0ZUJveFNpemUoKTtcclxuXHJcblx0XHR2aXNpYmxlTG9ja0NvbHVtbi5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRsZXQgaGVhZGVyRWxlbWVudCA9IGhlYWRlci5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblx0XHRcdC8vIOiuvue9ruW5tuiusOW9leWIneWni+eahOW3puS+p+S9jVxyXG5cdFx0XHRoZWFkZXJFbGVtZW50LmNzcygnbGVmdCcsIGNvbE0uYXdheUZyb21MZWZ0KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ3Njcm9sbC14JywgeCA9PiB7XHJcblx0XHRcdFx0bGV0IGxlZnRTdHlsZSA9IHsgJ2xlZnQnOiB4ICsgY29sTS5hd2F5RnJvbUxlZnQgfTtcclxuXHJcblx0XHRcdFx0aGVhZGVyRWxlbWVudC5jc3MobGVmdFN0eWxlKTtcclxuXHRcdFx0XHRidWZmZXJOb2RlLmdldE5vZGVMaXN0KCkuZm9yRWFjaChub2RlID0+IG5vZGUuY2hpbGRyZW4uZ2V0KGNvbE0pLmNzcyhsZWZ0U3R5bGUpKTtcdFx0XHRcdFxyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaW5pdEV2ZW50KCkge1xyXG5cclxuXHRcdGNvbnN0IGNvbHVtbkxvY2tPclVuTG9jayA9IChpc0xvY2tlZCwgY29sTSkgPT4ge1xyXG5cdFx0XHRsZXQgaGVhZGVyRWxlbWVudCA9IGhlYWRlci5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRpZiAoaXNMb2NrZWQpIHtcclxuXHRcdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5hZGQoY29sTSk7XHJcblxyXG5cdFx0XHRcdGNvbE0ub24oJ3Njcm9sbC14JywgeCA9PiB7XHJcblx0XHRcdFx0XHRsZXQgbGVmdFN0eWxlID0geyAnbGVmdCc6IHggKyBjb2xNLmF3YXlGcm9tTGVmdCB9O1xyXG5cclxuXHRcdFx0XHRcdGhlYWRlckVsZW1lbnQuY3NzKGxlZnRTdHlsZSk7XHJcblx0XHRcdFx0XHRidWZmZXJOb2RlLmdldE5vZGVMaXN0KCkuZm9yRWFjaChub2RlID0+IG5vZGUuY2hpbGRyZW4uZ2V0KGNvbE0pLmNzcyhsZWZ0U3R5bGUpKTtcclxuXHRcdFx0XHR9KTtcclxuXHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4ucmVtb3ZlKGNvbE0pO1xyXG5cclxuXHRcdFx0XHRjb2xNLm9mZignc2Nyb2xsLXgnKTtcclxuXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGxldCBjdXJyZW50TGVmdCA9ICRkb20udmlld3BvcnQuc2Nyb2xsTGVmdCgpICsgY29sTS5hd2F5RnJvbUxlZnQ7XHJcblxyXG5cdFx0XHQvLyDorr7nva7lubborrDlvZXliJ3lp4vnmoTlt6bkvqfkvY1cclxuXHRcdFx0aGVhZGVyRWxlbWVudC5jc3MoJ2xlZnQnLCBjdXJyZW50TGVmdCk7XHJcblx0XHRcdGJ1ZmZlck5vZGUuZ2V0Tm9kZUxpc3QoKS5mb3JFYWNoKG5vZGUgPT4gbm9kZS5jaGlsZHJlbi5nZXQoY29sTSkuY3NzKCdsZWZ0JywgY3VycmVudExlZnQpKTtcclxuXHJcblx0XHRcdHZpc2libGVMb2NrQ29sdW1uLnB1Ymxpc2goY29sTSwgJGRvbS52aWV3cG9ydC5zY3JvbGxMZWZ0KCkpO1xyXG5cdFx0XHR1cGRhdGVCb3hTaXplKCk7XHJcblx0XHR9O1xyXG5cclxuXHRcdGNvbHNNb2RlbC5vbignY29sdW1uLWFkZCcsIGNvbE0gPT4ge1xyXG5cdFx0XHQvLyBCVUdGSVggVE9ET1xyXG5cclxuXHRcdFx0Ly8gLi4uXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1sb2NrZWQnLCBpc0xvY2tlZCA9PiB7XHJcblx0XHRcdFx0Y29sdW1uTG9ja09yVW5Mb2NrKGlzTG9ja2VkLCBjb2xNKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRjb2xzTW9kZWwuZ2V0Q29sdW1uKCkuZm9yRWFjaChjb2xNID0+IHtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1yZXNpemVkJywgd2lkdGggPT4ge1xyXG5cclxuXHRcdFx0XHRpZiAoY29sTS5sb2NrZWQpIHtcclxuXHRcdFx0XHRcdHZpc2libGVMb2NrQ29sdW1uLnJlQ2FsYygpO1xyXG5cdFx0XHRcdFx0bGV0IGhlYWRlckVsZW1lbnQgPSBoZWFkZXIuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0XHRcdGxldCBjdXJyZW50TGVmdCA9ICRkb20udmlld3BvcnQuc2Nyb2xsTGVmdCgpICsgY29sTS5hd2F5RnJvbUxlZnQ7XHJcblxyXG5cdFx0XHRcdFx0aGVhZGVyRWxlbWVudC5jc3MoJ2xlZnQnLCBjdXJyZW50TGVmdCk7XHJcblx0XHRcdFx0XHRidWZmZXJOb2RlLmdldE5vZGVMaXN0KCkuZm9yRWFjaChub2RlID0+IG5vZGUuY2hpbGRyZW4uZ2V0KGNvbE0pLmNzcygnbGVmdCcsIGN1cnJlbnRMZWZ0KSk7XHJcblxyXG5cdFx0XHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4ucHVibGlzaChjb2xNLCAkZG9tLnZpZXdwb3J0LnNjcm9sbExlZnQoKSk7XHJcblx0XHRcdFx0XHR1cGRhdGVCb3hTaXplKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcclxuXHRcdFx0fSk7XHJcblxyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWxvY2tlZCcsIGlzTG9ja2VkID0+IHtcclxuXHRcdFx0XHQvLyAuLi5cclxuXHRcdFx0XHRjb2x1bW5Mb2NrT3JVbkxvY2soaXNMb2NrZWQsIGNvbE0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdFx0XHJcblx0XHRidWZmZXJOb2RlLm9uKCdidWZmZXItaW5pdGlhbCcsICgpID0+IHtcclxuXHRcdFx0Ly8gY2xlYXJCdWZmZXJMb2NrTm9kZSgpO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB1cGRhdGVCb3hTaXplKCkge1xyXG5cdFx0dmFyIHZpc2libGVMb2NrQ29sc1dpZHRoID0gdmlzaWJsZUxvY2tDb2x1bW4uZ2V0V2lkdGgoKTtcclxuXHRcdGhlYWRlci4kaGVhZGVyLmNzcygncGFkZGluZy1sZWZ0JywgLXZpc2libGVMb2NrQ29sc1dpZHRoKTtcclxuXHRcdCRkb20uY2FudmFzLmNzcygnbWFyZ2luLWxlZnQnLCAtdmlzaWJsZUxvY2tDb2xzV2lkdGgpO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHtcclxuXHRcdHZpc2libGVMb2NrQ29sdW1uLFxyXG5cdFx0c2V0TG9ja0NvbHVtblgoc2Nyb2xsTGVmdCkge1xyXG5cdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5lYWNoKGNvbE0gPT4gY29sTS5maXJlKCdzY3JvbGwteCcsIHNjcm9sbExlZnQpKTtcclxuXHRcdH0sXHJcblxyXG5cdFx0YWRkQnVmZmVyTG9ja05vZGUocm93Tm9kZXMpIHtcclxuXHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4uZWFjaChjb2xNID0+IHtcclxuXHRcdFx0XHRyb3dOb2Rlcy5mb3JFYWNoKHJvd05vZGVzID0+IHtcclxuXHRcdFx0XHRcdGxldCBjb2xFbGUgPSBoZWFkZXIuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cdFx0XHRcdFx0bGV0IGNlbGxFbGVtZW50ID0gcm93Tm9kZXMuY2hpbGRyZW4uZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0XHRcdGNlbGxFbGVtZW50LmNzcygnbGVmdCcsICRkb20udmlld3BvcnQuc2Nyb2xsTGVmdCgpICsgY29sTS5hd2F5RnJvbUxlZnQpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0sXHJcblxyXG5cdFx0Y2xlYXJCdWZmZXJMb2NrTm9kZSgpIHtcclxuXHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4uY2xlYXIoKTtcclxuXHRcdH1cclxuXHJcblx0fTtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gTG9ja0NvbE1hbmFnZXI7IiwiLy8gVE9ET1xyXG52YXIgZGVib3VuY2UgPSBmdW5jdGlvbihmbiwgdGltZSkge1xyXG5cdHZhciB0aW1lciA9IG51bGw7XHJcblx0cmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcclxuXHRcdGlmICh0aW1lcikgY2xlYXJUaW1lb3V0KHRpbWVyKTtcclxuXHJcblx0XHR0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG5cdFx0XHRmbi5hcHBseShudWxsLCBhcmdzKTtcclxuXHRcdH0sIHRpbWUpO1xyXG5cdH1cclxufVxyXG5cclxuLy/op6PlhrNyZXF1ZXN0QW5pbWF0aW9uRnJhbWXlhbzlrrnpl67pophcclxudmFyIHJhRnJhbWUgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XHJcbiAgICAgICAgICAgICAgd2luZG93LndlYmtpdFJlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxyXG4gICAgICAgICAgICAgIHdpbmRvdy5tb3pSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcclxuICAgICAgICAgICAgICB3aW5kb3cub1JlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxyXG4gICAgICAgICAgICAgIHdpbmRvdy5tc1JlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxyXG4gICAgICAgICAgICAgIGZ1bmN0aW9uKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KGNhbGxiYWNrLCAxMDAwIC8gNjApO1xyXG4gICAgICAgICAgICAgIH07XHJcblxyXG4vL+afr+mHjOWMluWwgeijhVxyXG52YXIgdGhyb3R0bGUgPSBmdW5jdGlvbihmbikge1xyXG4gICAgbGV0IGlzTG9ja2VkO1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcclxuXHJcbiAgICAgICAgaWYoaXNMb2NrZWQpIHJldHVybiBcclxuXHJcbiAgICAgICAgaXNMb2NrZWQgPSB0cnVlO1xyXG4gICAgICAgIHJhRnJhbWUoKCkgPT4ge1xyXG4gICAgICAgICAgICBpc0xvY2tlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICBmbi5hcHBseSh0aGlzLCBhcmdzKVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59O1xyXG5cclxuY2xhc3MgU2Nyb2xsZXIge1xyXG5cdGNvbnN0cnVjdG9yKGxpbmVIZWlnaHQsIGJ1ZmZlclpvbmUpIHtcclxuXHJcblx0XHR0aGlzLmJ1ZmZlclpvbmUgPSBidWZmZXJab25lO1xyXG5cdFx0dGhpcy55RGlyID0gMDsgLy8gMTrlkJHkuIrvvIwwLC0xOuWQkeS4i1xyXG5cdFx0dGhpcy55UHJlSW5kZXggPSAwOyAvLyDkuIrkuIDkuKrkvY3nva5cclxuXHRcdHRoaXMubGluZUhlaWdodCA9IGxpbmVIZWlnaHQ7XHJcblxyXG5cdFx0dGhpcy54RGlyID0gMDsgLy8gMe+8muWQkeW3pu+8jDDvvIwtMe+8muWQkeWPs1xyXG5cdFx0dGhpcy54UHJlSW5kZXggPSAwOyAvLyDliY3kuIDkuKrkvY3nva5cclxuXHJcblx0XHR0aGlzLl90cmlnZ2VyWCA9IHggPT4geDtcclxuXHRcdHRoaXMuX3RyaWdnZXJZID0geSA9PiB5O1xyXG5cclxuXHR9XHJcblxyXG5cdG9uWChjYWxsYmFjaykge1xyXG5cdFx0dGhpcy5fdHJpZ2dlclggPSB4ID0+IHtcclxuXHRcdFx0aWYgKHggPT09IHRoaXMueFByZUluZGV4KSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLnhEaXIgPSB4IC0gdGhpcy54UHJlSW5kZXg7XHJcblx0XHRcdHRoaXMueFByZUluZGV4ID0geDtcclxuXHJcblx0XHRcdGNhbGxiYWNrKHgpO1xyXG5cdFx0fTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdG9uWShoYW5kbGVyLCBkZWxheSkge1xyXG5cdFx0Ly8gVE9ET1xyXG5cdFx0Ly8gdmFyIGRlYWx5Rm4gPSBkZWJvdW5jZShoYW5kbGVyLCBkZWxheSk7XHJcblxyXG5cdFx0dGhpcy5fdHJpZ2dlclkgPSBkZWJvdW5jZSgoeSkgPT4ge1xyXG5cdFx0XHR0aGlzLnlEaXIgPSB5IC0gdGhpcy55UHJlSW5kZXg7XHJcblx0XHRcdHRoaXMueVByZUluZGV4ID0geTtcclxuXHJcblx0XHRcdHZhciBpbmRleCA9IH5+KHkvIHRoaXMubGluZUhlaWdodCk7XHJcblx0XHRcdHZhciB3aWxsTG9hZCA9IHRoaXMuYnVmZmVyWm9uZS5zaG91bGRMb2FkKHRoaXMueURpciwgaW5kZXgpO1xyXG5cclxuXHRcdFx0aWYgKHdpbGxMb2FkKSB7XHJcblx0XHRcdFx0Ly8gZGVhbHlGbigpO1xyXG5cdFx0XHRcdGhhbmRsZXIoXHJcblx0XHRcdFx0XHR0aGlzLnlEaXIgPiAwID8gMSA6IC0xLFxyXG5cdFx0XHRcdFx0dGhpcy5idWZmZXJab25lLmRvbWFpbixcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS5zdGFydCxcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS5lbmQsXHJcblx0XHRcdFx0XHRpbmRleCxcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS50b3RhbFxyXG5cdFx0XHRcdCk7XHJcblx0XHRcdH1cclxuXHRcdH0sIGRlbGF5KTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdGZpcmVYKHgpIHtcclxuXHRcdHRoaXMuX3RyaWdnZXJYKHgpO1xyXG5cdH1cclxuXHJcblx0ZmlyZVkoeSkge1xyXG5cdFx0dGhpcy5fdHJpZ2dlclkoeSk7XHJcblx0fVxyXG5cclxuXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU2Nyb2xsZXI7IiwidmFyIFNlbGVjdGlvbiA9IHJlcXVpcmUoJy4vU2VsZWN0aW9uJyk7XHJcbnZhciBNZW51ID0gcmVxdWlyZSgnLi4vcGx1Z2luL01lbnUnKTtcclxudmFyICQgID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ2pRdWVyeSddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnalF1ZXJ5J10gOiBudWxsKTtcclxuXHJcbmNvbnN0IGRlZkhlYWRlckNvbnRleHRNZW51ID0gW3sgXHJcblx0XHR0ZXh0OiAn5Ya757uTJywgXHJcblx0XHRoYW5kbGVyOiBmdW5jdGlvbihpbmZvLCBjb250ZXh0LCBldnQpIHtcclxuXHRcdFx0aW5mby5jb2x1bW4ubG9jaygpO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0dGV4dDogJ+ino+WGuycsIFxyXG5cdFx0aGFuZGxlcjogZnVuY3Rpb24oaW5mbywgY29udGV4dCwgZXZ0KSB7IFxyXG5cdFx0XHRpbmZvLmNvbHVtbi51bkxvY2soKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdHNlcGFyYXRvcjogdHJ1ZSBcclxuXHR9LCB7IFxyXG5cdFx0dGV4dDogJ+aYvuekuicsIFxyXG5cdFx0aGFuZGxlcjogZnVuY3Rpb24oaW5mbywgY29udGV4dCwgZXZ0KSB7IFxyXG5cdFx0XHRpbmZvLmNvbHVtbi5zaG93KCk7XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHR0ZXh0OiAn6ZqQ6JePJywgXHJcblx0XHRoYW5kbGVyOiBmdW5jdGlvbihpbmZvLCBjb250ZXh0LCBldnQpIHsgXHJcblx0XHRcdGluZm8uY29sdW1uLmhpZGUoKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdHRleHQ6ICflrprkvY0nLCBcclxuXHRcdGRpc2FibGVkOiBmYWxzZSxcclxuXHRcdGhhbmRsZXI6IGZ1bmN0aW9uKGluZm8sIGNvbnRleHQsIGV2dCkgeyBcclxuXHRcdFx0bGV0IHZhbHVlLCBpbmRleDtcclxuXHJcblx0XHRcdGlmICh2YWx1ZSA9IHByb21wdCgn6L6T5YWl5p+l5om+5YaF5a65JykpIHtcclxuXHRcdFx0XHRjb250ZXh0LnN0b3JlLmZvckVhY2goZnVuY3Rpb24ocm93LCBpKSB7XHJcblx0XHRcdFx0XHRpZiAoU3RyaW5nKHJvd1tpbmZvLmRhdGFJbmRleF0pLmluZGV4T2YodmFsdWUpICE9PSAtMSkge1xyXG5cdFx0XHRcdFx0XHRpbmRleCA9IGk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSk7XHJcblxyXG5cdFx0XHRcdGNvbnRleHQuc2Nyb2xsVG9Ub3AoaW5kZXggKiAzOCk7XHJcblx0XHRcdH1cclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdHRleHQ6ICfpgInkuK3mlbTliJcnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IFxyXG5cdFx0XHQvLyBhbGVydChzZWxmLnN0b3JlLnNpemUoKSk7XHJcblx0XHRcdGNvbnRleHQuX3N0YXJ0ID0gW2luZm8uY29sdW1uLmNpZCwgMF07XHJcblx0XHRcdGNvbnRleHQuX2VuZCA9IFtpbmZvLmNvbHVtbi5jaWQsIGNvbnRleHQuc3RvcmUuc2l6ZSgpIC0gMV07XHJcblxyXG5cdFx0XHRjb250ZXh0LnNlbGVjdGlvblJhbmdlKGNvbnRleHQuX3N0YXJ0LCBjb250ZXh0Ll9lbmQpO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0Y2xzOiAnbnVtYmVyLWNvbHVtbicsXHJcblx0XHR0ZXh0OiAn57uf6K6h5oC75pWwJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBcclxuXHRcdFx0YWxlcnQoY29udGV4dC5zdG9yZS5zaXplKCkpO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0Y2xzOiAnbnVtYmVyLWNvbHVtbicsXHJcblx0XHR0ZXh0OiAn5rGC5ZKMJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkge1xyXG5cdFx0XHRhbGVydChjb250ZXh0LnN0b3JlLnN1bShpbmZvLmRhdGFJbmRleCkpO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0Y2xzOiAnbnVtYmVyLWNvbHVtbicsXHJcblx0XHR0ZXh0OiAn5bmz5Z2HJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkge1xyXG5cdFx0XHRhbGVydChjb250ZXh0LnN0b3JlLmF2ZyhpbmZvLmRhdGFJbmRleCkpO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0Y2xzOiAnbnVtYmVyLWNvbHVtbicsXHJcblx0XHR0ZXh0OiAn5pyA5aSn5YC8JywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkge1xyXG5cdFx0XHR2YXIgcmV0ID0gY29udGV4dC5zdG9yZS5tYXgoaW5mby5kYXRhSW5kZXgpO1xyXG5cdFx0XHRhbGVydChyZXQuZGF0YVtpbmZvLmRhdGFJbmRleF0pO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0Y2xzOiAnbnVtYmVyLWNvbHVtbicsXHJcblx0XHR0ZXh0OiAn5pyA5bCP5YC8JywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkge1xyXG5cdFx0XHR2YXIgcmV0ID0gY29udGV4dC5zdG9yZS5taW4oaW5mby5kYXRhSW5kZXgpO1xyXG5cdFx0XHRhbGVydChyZXQuZGF0YVtpbmZvLmRhdGFJbmRleF0pO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0Y2xzOiAnbnVtYmVyLWNvbHVtbicsXHJcblx0XHR0ZXh0OiAn5pa55beuJywgXHJcblx0XHRkaXNhYmxlZDogdHJ1ZSxcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7XHJcblx0XHRcdC8vIGFsZXJ0KGNvbnRleHQuc3RvcmUuc2l6ZSgpKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdGNsczogJ251bWJlci1jb2x1bW4nLFxyXG5cdFx0dGV4dDogJ+agh+WHhuW3ricsIFxyXG5cdFx0ZGlzYWJsZWQ6IHRydWUsXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkge1xyXG5cdFx0XHQvLyBhbGVydChjb250ZXh0LnN0b3JlLnNpemUoKSk7XHJcblx0XHR9IFxyXG5cdH1dO1xyXG5cclxuY29uc3QgZGVmQ2VsbENvbnRleHRNZW51ID0gW3tcclxuXHRcdHRleHQ6ICdsb2NrIHJvdyB0byB0b3AnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IGNvbnNvbGUubG9nKGNvbnRleHQuX3NlbGVjdGlvbik7IH0gXHJcblx0fSx7IFxyXG5cdFx0dGV4dDogJ2xvY2sgcm93IHRvIGJvdHRvbScsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgY29uc29sZS5sb2coY29udGV4dC5fc2VsZWN0aW9uKTsgfSBcclxuXHR9LHsgXHJcblx0XHR0ZXh0OiAnc2VhcmNoJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBjb25zb2xlLmxvZyhjb250ZXh0Ll9zZWxlY3Rpb24pOyB9IFxyXG5cdH0seyBcclxuXHRcdHRleHQ6ICdtYXJrJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBjb25zb2xlLmxvZyhjb250ZXh0Ll9zZWxlY3Rpb24pOyB9IFxyXG5cdH1dO1x0XHJcblxyXG5jb25zdCBkZWZTZWxlY3Rpb25Db250ZXh0TWVudSA9IFt7IFxyXG5cdFx0dGV4dDogJ+WkjeWIticsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgXHJcblx0XHRcdGNvbnNvbGUubG9nKGluZm8sIGNvbnRleHQuX3NlbGVjdGlvbik7IFxyXG5cdFx0XHRjb250ZXh0LmNvcHlTZWxlY3Rpb24oaW5mbyk7XHJcblx0XHR9IFxyXG5cdH0seyBcclxuXHRcdHRleHQ6ICfmiZPljbAnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IFxyXG5cdFx0XHRjb25zb2xlLmxvZyhldnQsIGRhdGEsIGNvbnRleHQpO1xyXG5cdFx0XHR3aW5kb3cucHJpbnQoKTtcclxuXHRcdH0gXHJcblx0fSx7IFxyXG5cdFx0dGV4dDogJ+WvvOWHuicsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgXHJcblx0XHRcdFxyXG5cdFx0XHRjb25zb2xlLmxvZyhjb250ZXh0Ll9zZWxlY3Rpb24pOyBcclxuXHRcdH0gXHJcblx0fSx7IFxyXG5cdFx0dGV4dDogJ+agh+iusCcsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgY29uc29sZS5sb2coY29udGV4dC5fc2VsZWN0aW9uKTsgfSBcclxuXHR9XTtcclxuXHJcblxyXG5jbGFzcyBDb250ZXh0bWVudSBleHRlbmRzIFNlbGVjdGlvbiB7XHJcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xyXG5cdFx0c3VwZXIob3B0aW9ucyk7XHJcblxyXG5cdFx0dGhpcy5jZWxsQ3R4TWVudSA9IG9wdGlvbnMuYml6Q29udGV4dE1lbnUuY2VsbDtcclxuXHJcblx0XHR0aGlzLmhlYWRlckN0eE1lbnUgPSB7XHJcblx0XHRcdGJlZm9yZTogZnVuY3Rpb24oaW5mbywgZXZ0KSB7XHJcblx0XHRcdFx0aWYgKGluZm8uY29sdW1uLnZ0eXBlID09PSAnbnVtYmVyJykge1xyXG5cdFx0XHRcdFx0dGhpcy5nZXRDbHMoJy5udW1iZXItY29sdW1uJykuc2hvdygpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR0aGlzLmdldENscygnLm51bWJlci1jb2x1bW4nKS5oaWRlKCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHRzdXBlci5fYmluZEV2ZW50KCk7XHJcblxyXG5cdFx0bGV0IHNlbGYgPSB0aGlzO1xyXG5cclxuXHRcdHRoaXMuJGNvbnRleHRtZW51SGVhZGVyID0gbmV3IE1lbnUodGhpcy4kZG9tLndyYXBwZXIsIHsgXHJcblx0XHRcdGRhdGE6IGRlZkhlYWRlckNvbnRleHRNZW51LCBcclxuXHRcdFx0Y29udGV4dDogdGhpcyBcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuJGNvbnRleHRtZW51ID0gbmV3IE1lbnUodGhpcy4kZG9tLmJvZHksIHsgXHJcblx0XHRcdGRhdGE6IFtdLCBcclxuXHRcdFx0Y29udGV4dDogdGhpcyBcclxuXHRcdH0pO1xyXG5cdFx0XHJcblx0XHR0aGlzLiRkb20ud3JhcHBlclxyXG5cdFx0XHQub24oJ2NvbnRleHRtZW51JywgJy5jLWhlYWRlci1jZWxsJywgXHJcblx0XHRcdFx0dGhpcy5faGVhZGVyQ29udGV4dE1lbnUuYmluZCh0aGlzKVxyXG5cdFx0XHQpO1xyXG5cclxuXHRcdHRoaXMuJGRvbS5ib2R5XHJcblx0XHRcdC5vbignY29udGV4dG1lbnUnLCAnLmMtZ3JpZC1jZWxsJywgXHJcblx0XHRcdFx0dGhpcy5fY2VsbENvbnRleHRNZW51LmJpbmQodGhpcywgZGVmQ2VsbENvbnRleHRNZW51KVxyXG5cdFx0XHQpXHJcblx0XHRcdC5vbignY29udGV4dG1lbnUnLCAnLmMtY2VsbC1zZWxlY3RlZCcsIFxyXG5cdFx0XHRcdHRoaXMuX2NlbGxDb250ZXh0TWVudS5iaW5kKHRoaXMsIGRlZlNlbGVjdGlvbkNvbnRleHRNZW51KVxyXG5cdFx0XHQpO1xyXG5cdH1cclxuXHJcblx0X2hlYWRlckNvbnRleHRNZW51KGV2dCkge1xyXG5cdFx0bGV0IGNvbE0gPSAkKGV2dC50YXJnZXQpLmRhdGEoJ2NvbHVtbicpO1xyXG5cdFx0bGV0IG1lbnUgPSB0aGlzLiRjb250ZXh0bWVudUhlYWRlcjtcclxuXHJcblx0XHRsZXQgaW5mbyA9IHsgXHJcblx0XHRcdCdkYXRhSW5kZXgnOiBjb2xNLmRhdGFJbmRleCwgXHJcblx0XHRcdCdjb2x1bW4nOiBjb2xNLFxyXG5cdFx0XHQnY29udGV4dCc6IG1lbnVcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLmZpcmUoJ2hlYWRlci1jb250ZXh0bWVudScsIGluZm8sIGV2dCk7XHJcblx0XHQvLyBjb25zb2xlLmxvZyhpbmZvKTtcclxuXHJcblx0XHRpZiAodGhpcy5oZWFkZXJDdHhNZW51LmJlZm9yZS5jYWxsKG1lbnUsIGluZm8sIGV2dCkpIHtcclxuXHRcdFx0XHJcblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0bWVudS5zZXRJbmZvKGluZm8pO1xyXG5cdFx0XHRtZW51LnNob3dBdChldnQpO1xyXG5cdFx0XHJcblx0XHRcdGRvY0V2ZW50KG1lbnUpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0X2NlbGxDb250ZXh0TWVudShkZWZDdHhNZW51LCBldnQpIHtcclxuXHRcdGxldCAkY2VsbCA9ICQoZXZ0LnRhcmdldCk7XHJcblx0XHRsZXQgZGF0YUluZGV4ID0gJGNlbGwuZGF0YSgnZGF0YUluZGV4Jyk7XHJcblx0XHRsZXQgY29sdW1uSWQgPSAkY2VsbC5kYXRhKCdjaWQnKTtcclxuXHRcdGxldCByb3dudW1iZXIgPSArJGNlbGwucGFyZW50KCcuYy1ncmlkLXJvdycpLmF0dHIoJ3JpZCcpO1xyXG5cdFx0bGV0IG1lbnUgPSB0aGlzLiRjb250ZXh0bWVudTtcclxuXHJcblx0XHRsZXQgaW5mbyA9IHsgXHJcblx0XHRcdCd2YWx1ZSc6ICRjZWxsLnRleHQoKSxcclxuXHRcdFx0J2RhdGFJbmRleCc6IGRhdGFJbmRleCwgXHJcblx0XHRcdCdjb2x1bW5JZCc6IGNvbHVtbklkLFxyXG5cdFx0XHQncm93bnVtYmVyJzogcm93bnVtYmVyLFxyXG5cdFx0XHQncm93SW5kZXgnOiByb3dudW1iZXIsXHJcblx0XHRcdCdjb250ZXh0JzogbWVudVxyXG5cdFx0fTtcclxuXHJcblx0XHR0aGlzLmZpcmUoJ2NlbGwtY29udGV4dG1lbnUnLCBpbmZvLCBldnQpO1xyXG5cdFx0Ly8gY29uc29sZS5sb2coaW5mbyk7XHJcblxyXG5cdFx0aWYgKHRoaXMuY2VsbEN0eE1lbnUuYmVmb3JlLmNhbGwobWVudSwgaW5mbywgZXZ0KSkge1xyXG5cclxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHRtZW51LnNldEluZm8oaW5mbyk7XHJcblx0XHRcdG1lbnUudXBkYXRlKGRlZkN0eE1lbnUuY29uY2F0KG1lbnUuZ2V0RGF0YSgpKSk7XHJcblx0XHRcdFxyXG5cdFx0XHRtZW51LnNob3dBdChldnQpO1xyXG5cdFx0XHJcblx0XHRcdGRvY0V2ZW50KG1lbnUpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHtcclxuXHRcdHN1cGVyLmRlc3RvcnkoKTtcclxuXHJcblx0XHR0aGlzLiRjb250ZXh0bWVudUhlYWRlci5kZXN0b3J5KCk7XHJcblx0XHR0aGlzLiRjb250ZXh0bWVudS5kZXN0b3J5KCk7XHJcblx0XHR0aGlzLmNlbGxDdHhNZW51ID0gbnVsbDtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGRvY0V2ZW50KCRjb250ZXh0bWVudSkge1xyXG5cdCQoZG9jdW1lbnQpLm9uKCdtb3VzZXVwLmNvbnRleHRtZW51Jywgb25Nb3VzZURvd24uYmluZChudWxsLCAkY29udGV4dG1lbnUpKTtcclxufVxyXG5cclxuZnVuY3Rpb24gb25Nb3VzZURvd24oJGNvbnRleHRtZW51KXtcclxuICAgICRjb250ZXh0bWVudS5oaWRlKCk7XHJcbiAgICAkKGRvY3VtZW50KS5vZmYoJ21vdXNldXAuY29udGV4dG1lbnUnKTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDb250ZXh0bWVudTsiLCJ2YXIgR3JpZFZpZXcgPSByZXF1aXJlKCcuLi9jb3JlL0dyaWRWaWV3Jyk7XHJcblxyXG5jb25zdCBDRUxMX0NMUyA9ICdsaS5jLWdyaWQtY2VsbCc7XHJcbmNvbnN0IENFTExfU0VMRUNURURfQ0xTID0gJ2MtY2VsbC1zZWxlY3RlZCc7XHJcbmNvbnN0IFJPV19DTFMgPSAnLmMtZ3JpZC1yb3cnO1xyXG5cclxuY2xhc3MgU2VsZWN0aW9uIGV4dGVuZHMgR3JpZFZpZXcge1xyXG5cclxuXHRjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcblx0XHRzdXBlcihvcHRpb25zKTtcclxuXHJcblx0XHR0aGlzLl9kZWZhdWx0cygpO1xyXG5cdH1cclxuXHJcblx0X2RlZmF1bHRzKCkge1xyXG5cdFx0dGhpcy5fbW92aW5nID0gZmFsc2U7XHJcblx0XHR0aGlzLl9zdGFydCA9IG51bGw7XHJcblx0XHR0aGlzLl9lbmQgPSBudWxsO1xyXG5cdFx0dGhpcy5fbGFzdFkgPSBudWxsO1xyXG5cclxuXHRcdHRoaXMuX3NlbGVjdGlvbiA9IFtdO1xyXG5cdFx0dGhpcy5fc2VsZWN0WSA9IFtdO1xyXG5cdFx0Ly8gdGhpcy5fc2VsZWN0RGF0YUluZGV4ID0gW107XHJcblx0XHR0aGlzLl9zZWxlY3RDb2x1bW5zID0gW107XHJcblx0fVxyXG5cclxuXHRnZXRTZWxlY3Rpb24oKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fc2VsZWN0aW9uO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICog5aSN5Yi26YCJ5qGG5YaF5a65XHJcblx0ICogQHBhcmFtIHtPYmplY3R9IGluZm8gLXtjb2x1bW5JZCwgcm93SW5kZXh9XHJcblx0ICovXHJcblx0Y29weVNlbGVjdGlvbihpbmZvKSB7XHJcblx0XHRpZiAoIXRoaXMuaXNJblJhbmdlKGluZm8pKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHRsZXQgdmFsdWVzID0gdGhpcy5fY29weUNvbnRlbnQoKTtcclxuXHJcblx0XHRsZXQgdGEgPSAkKCc8dGV4dGFyZWE+JykudmFsKHZhbHVlcykuYXBwZW5kVG8odGhpcy4kZG9tLmJvZHkpLmZvY3VzKCk7XHJcblx0XHR0YS5nZXQoMCkuc2V0U2VsZWN0aW9uUmFuZ2UoMCwgdmFsdWVzLmxlbmd0aCk7XHJcblx0XHRkb2N1bWVudC5leGVjQ29tbWFuZCgnY29weScsIHRydWUpO1xyXG5cdFx0dGEucmVtb3ZlKCk7XHJcblx0fVxyXG5cclxuXHRpc0luUmFuZ2UoaW5mbykge1xyXG5cdFx0cmV0dXJuIHRoaXMuX3NlbGVjdENvbHVtbnMuaW5kZXhPZihpbmZvLmNvbHVtbklkKSAhPT0gLTFcclxuXHRcdFx0JiYgaW5mby5yb3dJbmRleCA+PSB0aGlzLl9zZWxlY3RZWzBdXHJcblx0XHRcdCYmIGluZm8ucm93SW5kZXggPD0gdGhpcy5fc2VsZWN0WVsxXVxyXG5cdH1cclxuXHJcblx0X2NvcHlDb250ZW50KCkge1xyXG5cdFx0bGV0IGNvbHMgPSB0aGlzLl9zZWxlY3RDb2x1bW5zLm1hcChjaWQgPT4ge1xyXG5cdFx0XHQvLyBsZXQgY29sID0gdGhpcy5jb2x1bW5Nb2RlbC5nZXRDb2x1bW5CeURhdGFJbmRleChkYXRhSW5kZXgpO1xyXG5cdFx0XHRsZXQgY29sID0gdGhpcy5jb2x1bW5Nb2RlbC5nZXRDb2x1bW5zQnlJZChjaWQpXHJcblxyXG5cdFx0XHRpZiAoIWNvbCkgeyB0aHJvdyBgbm90IGZpbmQgY29sdW1uSWQ6ICR7Y2lkfSBpbiBjb2x1bW5zYCB9O1xyXG5cclxuXHRcdFx0cmV0dXJuIGNvbDtcclxuXHRcdH0pO1xyXG5cclxuXHRcdGxldCB2YWx1ZXMgPSBjb2xzLm1hcChjb2wgPT4gcGlja1RleHQoY29sLnRleHQpKS5qb2luKCdcXHQnKTtcclxuXHJcblx0XHR0aGlzLl9zZWxlY3Rpb24uZm9yRWFjaChyb3cgPT4ge1xyXG5cdFx0XHR2YWx1ZXMgKz0gJ1xcclxcbic7XHJcblxyXG5cdFx0XHRyb3cuZm9yRWFjaCgodmFsdWUsIGkpID0+IHtcclxuXHRcdFx0XHR2YWx1ZXMgKz0gcGlja1RleHQoY29sc1tpXS5yZW5kZXJlcih2YWx1ZSwgeyByb3dJbmRleDogMH0sIHsgZGF0YTogcm93IH0pKSArICdcXHQnO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHJldHVybiB2YWx1ZXM7XHJcblx0fVxyXG5cdFxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHRzdXBlci5fYmluZEV2ZW50KCk7XHJcblxyXG5cdFx0bGV0IHNlbGYgPSB0aGlzO1xyXG5cclxuXHRcdHRoaXMuY29sdW1uTW9kZWwub24oJ25vdGljZS1jb2xNb2RlbC1zb3J0LWNoYW5nZWQnLCAoKSA9PiB7XHJcblx0XHRcdHRoaXMuX2RlZmF1bHRzKCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmNvbHVtbk1vZGVsLm9uKCdjb2x1bW4tbW92ZWQnLCAoKSA9PiB7XHJcblx0XHRcdHRoaXMuX2RlZmF1bHRzKCk7XHJcblx0XHRcdHRoaXMuJGRvbS5jYW52YXMuZmluZChDRUxMX0NMUykucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kZG9tLmNhbnZhc1xyXG5cdFx0XHQub24oJ21vdXNlZG93bicsIENFTExfQ0xTLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRpZiAoZXZ0LmJ1dHRvbiA9PT0gMCkge1xyXG5cdFx0XHRcdFx0c2VsZi4kZG9tLmNhbnZhcy5maW5kKENFTExfQ0xTKS5yZW1vdmVDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdFx0XHRzZWxmLl9tb3ZpbmcgPSB0cnVlO1xyXG5cdFx0XHRcdFx0bGV0ICRjZWxsID0gJCh0aGlzKS5hZGRDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdFx0XHRzZWxmLl9zdGFydCA9IHNlbGYuX2VuZCA9IFskY2VsbC5kYXRhKCdjaWQnKSwgKyRjZWxsLnBhcmVudChST1dfQ0xTKS5hdHRyKCdyaWQnKV07XHJcblx0XHRcdFx0XHQvLyBjb25zb2xlLmxvZyhzdGFydCk7XHJcblx0XHRcdFx0fSBcclxuXHRcdFx0XHRlbHNlIGlmIChldnQuYnV0dG9uID09PSAyKSB7XHJcblx0XHRcdFx0XHRcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pXHJcblx0XHRcdC5vbignbW91c2VlbnRlcicsIENFTExfQ0xTLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRpZiAoc2VsZi5fbW92aW5nKSB7XHJcblx0XHRcdFx0XHRsZXQgJGNlbGwgPSAkKHRoaXMpO1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0XHQkY2VsbC5hZGRDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdFx0XHRzZWxmLl9lbmQgPSBbJGNlbGwuZGF0YSgnY2lkJyksICskY2VsbC5wYXJlbnQoUk9XX0NMUykuYXR0cigncmlkJyldO1xyXG5cclxuXHRcdFx0XHRcdHNlbGYuc2VsZWN0aW9uUmFuZ2Uoc2VsZi5fc3RhcnQsIHNlbGYuX2VuZCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KVxyXG5cdFx0XHQub24oJ21vdXNldXAnLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRzZWxmLl9tb3ZpbmcgPSBmYWxzZTtcclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyhlbmQpO1xyXG5cdFx0XHRcdGNvbnNvbGUubG9nKHNlbGYuX3NlbGVjdGlvbik7XHJcblx0XHRcdFx0Ly8gVE9ET1xyXG5cdFx0XHRcdC8vIGNvcHkoJCgnLmNlbGwuc2VsZWN0ZWQnKSk7XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuYnVmZmVyTm9kZS5vbigncm93LXVwZGF0ZS1iZWZvcmUnLCAocm93Tm9kZSwgcm93KSA9PiB7XHJcblx0XHRcdC8vIGNvbnNvbGUubG9nKHJvd05vZGUuJG5vZGUsIHJvdy5yaWQsIHRoaXMuX3NlbGVjdFkpO1xyXG5cclxuXHRcdFx0aWYgKHRoaXMuX3NlbGVjdGlvbi5sZW5ndGggPT09IDApIHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHJcblx0XHRcdGxldCBpID0gcm93LnJpZDtcclxuXHRcdFx0bGV0IFt5MCwgeTFdID0gdGhpcy5fc2VsZWN0WTtcclxuXHRcdFx0Ly8gbGV0IGNvbHMgPSB0aGlzLl9zZWxlY3REYXRhSW5kZXg7XHJcblx0XHRcdGxldCBjb2xzID0gdGhpcy5fc2VsZWN0Q29sdW1ucztcclxuXHJcblx0XHRcdGlmIChpID49IHkwICYmIGkgPCB5MSArIDEpIHtcclxuXHRcdFx0XHRjb2xzLmZvckVhY2goKGNvbCkgPT4ge1xyXG5cdFx0XHRcdFx0cm93Tm9kZS5jaGlsZHJlbi5mb3JFYWNoKCgkY2VsbCwgY29sTSkgPT4ge1xyXG5cdFx0XHRcdFx0XHRpZiAoY29scy5pbmRleE9mKGNvbE0uY2lkKSAhPSAtMSkge1xyXG5cdFx0XHRcdFx0XHRcdCRjZWxsLmFkZENsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHQkY2VsbC5yZW1vdmVDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHJvd05vZGUuJG5vZGUuZmluZChDRUxMX0NMUykucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0fSk7XHJcblx0XHRcclxuXHR9XHJcblxyXG5cdHNlbGVjdGlvblJhbmdlKFt4MCwgeTBdLCBbeDEsIHkxXSkge1xyXG5cclxuXHRcdGxldCB5RGlyID0geTEgLSB5MDtcclxuXHRcdGxldCBsYXN0WSA9IHRoaXMuX2xhc3RZO1xyXG5cdFx0XHRcclxuXHRcdC8vIHlSYW5nZSA9IHsgbGFzdDogLCBub3c6IFt5MCwgeTFdIH07XHJcblx0XHQvLyBbbDAsIGwxXVxyXG5cdFx0Ly8gW3kwLCB5MV1cclxuXHRcdC8vIFtsMCwgbDFdXHJcblx0XHRsZXQgcmVtb3ZlWVJhbmdlID0gW107XHJcblx0XHQvLyBkb3duXHJcblx0XHRpZiAoeURpciA+PSAwICYmIHkxIDwgbGFzdFkpIHtcclxuXHRcdFx0cmVtb3ZlWVJhbmdlID0gW3kxLCBsYXN0WV07XHJcblx0XHR9XHJcblx0XHQvLyB1cFxyXG5cdFx0aWYgKHlEaXIgPD0gMCAmJiB5MSA+IGxhc3RZKSB7XHJcblx0XHRcdHJlbW92ZVlSYW5nZSA9IFtsYXN0WSwgeTFdO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHR0aGlzLl9sYXN0WSA9IHkxO1xyXG5cdFx0Ly8gY29uc29sZS5sb2coeURpciwgcmVtb3ZlWVJhbmdlKTtcclxuXHJcblx0XHQvLyBsZXQgZGF0YUluZGV4ID0gdGhpcy5nZXRMb2NrQW5kVmlzaWFibGVDb2x1bW5Bc0RhdGFJbmRleCgpO1xyXG5cdFx0bGV0IGNvbHVtbklkcyA9IHRoaXMuZ2V0TG9ja0FuZFZpc2lhYmxlQ29sdW1uQXNDaWQoKTtcclxuXHRcdC8vIFt4MCwgeTAsIHgxLCB5MV0gPSBvcmRlckJ5KHgwLCB5MCwgeDEsIHkxLCBkYXRhSW5kZXgpO1xyXG5cdFx0W3gwLCB5MCwgeDEsIHkxXSA9IG9yZGVyQnkoeDAsIHkwLCB4MSwgeTEsIGNvbHVtbklkcyk7XHJcblxyXG5cclxuXHRcdC8vIGxldCBjb2xzID0gdGhpcy5fc2VsZWN0RGF0YUluZGV4ID0gZGF0YUluZGV4LnNsaWNlKGRhdGFJbmRleC5pbmRleE9mKHgwKSwgZGF0YUluZGV4LmluZGV4T2YoeDEpKzEpO1xyXG5cdFx0bGV0IGNvbHMgPSB0aGlzLl9zZWxlY3RDb2x1bW5zID0gY29sdW1uSWRzLnNsaWNlKGNvbHVtbklkcy5pbmRleE9mKHgwKSwgY29sdW1uSWRzLmluZGV4T2YoeDEpKzEpO1xyXG5cdFx0Ly8gY29uc29sZS5sb2coY29scyk7XHJcblxyXG5cdFx0dGhpcy5fc2VsZWN0WSA9IFt5MCwgeTEgKyAxXTtcclxuXHRcdGxldCByb3dzID0gdGhpcy5zdG9yZS5zbGljZSh5MCwgeTEgKyAxKTtcclxuXHJcblx0XHR0aGlzLl9zZWxlY3Rpb24gPSByb3dzLm1hcChyb3cgPT4ge1xyXG5cdFx0XHRyZXR1cm4gY29scy5tYXAoY29sID0+IHtcclxuXHRcdFx0XHRyZXR1cm4gcm93LmRhdGFbdGhpcy5jb2x1bW5Nb2RlbC5nZXRDb2x1bW5zQnlJZChjb2wpLmRhdGFJbmRleF07XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5fcmVQYWludE5vZGUoeURpciwgeTAsIHkxLCByZW1vdmVZUmFuZ2UsIGNvbHMpO1xyXG5cdH1cclxuXHJcblx0X3JlUGFpbnROb2RlKHlEaXIsIHkwLCB5MSwgcmVtb3ZlWVJhbmdlLCBjb2xzKSB7XHJcblx0XHRsZXQgbm9kZUxpc3QgPSB0aGlzLmJ1ZmZlck5vZGUuZ2V0Tm9kZUxpc3QoKTtcclxuXHRcdG5vZGVMaXN0LmZvckVhY2goKHJvd05vZGUpID0+IHtcclxuXHRcdFx0bGV0ICRyb3cgPSByb3dOb2RlLiRub2RlO1xyXG5cdFx0XHRsZXQgaSAgPSArJHJvdy5hdHRyKCdyaWQnKTtcclxuXHRcdFx0XHJcblx0XHRcdGlmIChpID49IHkwICYmIGkgPCB5MSArIDEpIHtcclxuXHRcdFx0XHRjb2xzLmZvckVhY2goKGNvbCkgPT4ge1xyXG5cdFx0XHRcdFx0cm93Tm9kZS5jaGlsZHJlbi5mb3JFYWNoKCgkY2VsbCwgY29sTSkgPT4ge1xyXG5cdFx0XHRcdFx0XHRpZiAoY29scy5pbmRleE9mKGNvbE0uY2lkKSAhPSAtMSkge1xyXG5cdFx0XHRcdFx0XHRcdCRjZWxsLmFkZENsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHQkY2VsbC5yZW1vdmVDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUylcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICh5RGlyID49IDAgJiYgaSA+IHJlbW92ZVlSYW5nZVswXSAmJiBpIDw9cmVtb3ZlWVJhbmdlWzFdICkge1xyXG5cdFx0XHRcdCRyb3cuZmluZChDRUxMX0NMUykucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICh5RGlyIDw9IDAgJiYgaSA+PSByZW1vdmVZUmFuZ2VbMF0gJiYgaSA8cmVtb3ZlWVJhbmdlWzFdICkge1xyXG5cdFx0XHRcdCRyb3cuZmluZChDRUxMX0NMUykucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHQvKlxyXG5cdCAqIGxvY2sgKyB2aXNpYWJsZSA9IGNvbHVtbnNcclxuXHQgKiBAcGFyYW0ge0FycmF5fSBjb2x1bW5zIC1bZGF0YUluZGV4Li4uXVxyXG5cdCAqL1xyXG5cdC8vIGdldExvY2tBbmRWaXNpYWJsZUNvbHVtbkFzRGF0YUluZGV4KCkge1xyXG5cdC8vIFx0bGV0IGNvbHMgPSBbXTtcclxuXHJcblx0Ly8gXHR0aGlzLmxvY2tDb2xNYW5hZ2VyXHJcblx0Ly8gXHRcdC52aXNpYmxlTG9ja0NvbHVtblxyXG5cdC8vIFx0XHQuZWFjaChjb2xNID0+IGNvbHMudW5zaGlmdChjb2xNLmRhdGFJbmRleCkpO1xyXG5cclxuXHQvLyBcdGxldCB2aXNpYWJsZUNvbHMgPSB0aGlzLmNvbHVtbk1vZGVsXHJcblx0Ly8gXHRcdC5nZXRWaXNpYmxlQ29sdW1uKClcclxuXHQvLyBcdFx0Lm1hcChjb2xNID0+IGNvbE0uZGF0YUluZGV4KVxyXG5cdC8vIFx0XHQuZmlsdGVyKGRhdGFJbmRleCA9PiBjb2xzLmluZGV4T2YoZGF0YUluZGV4KSA9PSAtMSk7XHJcblxyXG5cdC8vIFx0cmV0dXJuIGNvbHMuY29uY2F0KHZpc2lhYmxlQ29scyk7XHJcblx0Ly8gfVxyXG5cclxuXHQvKlxyXG5cdCAqIGxvY2sgKyB2aXNpYWJsZSA9IGNvbHVtbnNcclxuXHQgKiBAcGFyYW0ge0FycmF5fSBjb2x1bW5zIC1bZGF0YUluZGV4Li4uXVxyXG5cdCAqL1xyXG5cdGdldExvY2tBbmRWaXNpYWJsZUNvbHVtbkFzQ2lkKCkge1xyXG5cdFx0bGV0IGNvbHMgPSBbXTtcclxuXHJcblx0XHR0aGlzLmxvY2tDb2xNYW5hZ2VyXHJcblx0XHRcdC52aXNpYmxlTG9ja0NvbHVtblxyXG5cdFx0XHQuZWFjaChjb2xNID0+IGNvbHMudW5zaGlmdChjb2xNLmNpZCkpO1xyXG5cclxuXHRcdGxldCB2aXNpYWJsZUNvbHMgPSB0aGlzLmNvbHVtbk1vZGVsXHJcblx0XHRcdC5nZXRWaXNpYmxlQ29sdW1uKClcclxuXHRcdFx0Lm1hcChjb2xNID0+IGNvbE0uY2lkKVxyXG5cdFx0XHQuZmlsdGVyKGNpZCA9PiBjb2xzLmluZGV4T2YoY2lkKSA9PSAtMSk7XHJcblxyXG5cdFx0cmV0dXJuIGNvbHMuY29uY2F0KHZpc2lhYmxlQ29scyk7XHJcblx0fVxyXG5cclxuXHRkZXN0b3J5KCkge1xyXG5cdFx0c3VwZXIuZGVzdG9yeSgpO1xyXG5cclxuXHRcdHRoaXMuX2RlZmF1bHRzKCk7XHJcblx0fVxyXG5cclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIHN3YXAoYSwgYikge1xyXG5cdHJldHVybiBbYiwgYV07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9yZGVyQnkoeDAsIHkwLCB4MSwgeTEsIGNvbElkcykge1xyXG5cdGlmIChjb2xJZHMuaW5kZXhPZih4MCkgPiBjb2xJZHMuaW5kZXhPZih4MSkpIHtcclxuXHRcdFt4MCwgeDFdID0gc3dhcCh4MCwgeDEpO1xyXG5cdH1cclxuXHRpZiAoeTAgPiB5MSkge1xyXG5cdFx0W3kwLCB5MV0gPSBzd2FwKHkwLCB5MSk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gW3gwLCB5MCwgeDEsIHkxXTtcclxufVxyXG5cclxuZnVuY3Rpb24gcGlja1RleHQoZnJhZ21lbnQpIHtcclxuXHR2YXIgaHRtbFN0cmluZyA9IG5ldyBSZWdFeHAoJ1xcPC4rP1xcPicsICdnJyk7XHJcblx0aWYgKGh0bWxTdHJpbmcudGVzdChmcmFnbWVudCkpIHtcclxuXHRcdHJldHVybiBmcmFnbWVudC5yZXBsYWNlKGh0bWxTdHJpbmcsICcnKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiBmcmFnbWVudDtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBTZWxlY3Rpb247IiwiLy8gZXhwb3J0cy5HcmlkU3RvcmUgPSByZXF1aXJlKCcuL2NvcmUvR3JpZFN0b3JlJyk7XHJcbi8vIGV4cG9ydHMuR3JpZFZpZXcgPSByZXF1aXJlKCcuL2NvcmUvR3JpZFZpZXcnKTtcclxuLy8gbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2V4dGVuZHMvU2VsZWN0aW9uJyk7XHJcbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9leHRlbmRzL0NvbnRleHRtZW51Jyk7XHJcblxyXG4vLyBleHBvcnQgeyBkZWZhdWx0IH0gZm9ybSAnLi9wbHVnaW4vQ29udGV4dG1lbnUnO1xyXG4iLCJ2YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydqUXVlcnknXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ2pRdWVyeSddIDogbnVsbCk7XHJcbnZhciBVdGlscyA9IHJlcXVpcmUoJy4uL3V0aWwvVXRpbHMnKTtcclxuXHJcblxyXG5jbGFzcyBNZW51IHtcclxuXHRjb25zdHJ1Y3Rvcigkd3JhcHBlciwgeyBkYXRhLCBjb250ZXh0IH0pIHtcclxuXHRcdHRoaXMucGFyYW1zID0ge307XHJcblx0XHR0aGlzLiRtZW51ID0gJChudWxsKTtcclxuXHRcdHRoaXMuJHdyYXBwZXIgPSAkd3JhcHBlcjtcclxuXHRcdHRoaXMuX2RhdGEgPSBkYXRhIHx8IFtdO1xyXG5cdFx0dGhpcy5jb250ZXh0ID0gY29udGV4dDtcclxuXHJcblx0XHR0aGlzLnVwZGF0ZShkYXRhKTtcclxuXHR9XHJcblxyXG5cdHVwZGF0ZShkYXRhKSB7XHJcblx0XHR0aGlzLiRtZW51LnJlbW92ZSgpOyAvLyBUT0RPIOS8mOWMluWkjeeUqOiKgueCuVxyXG5cdFx0XHJcblx0XHRpZiAoQXJyYXkuaXNBcnJheShkYXRhKSAmJiBkYXRhLmxlbmd0aCA+IDApIHtcclxuXHRcdFx0dGhpcy4kbWVudSA9IGNvbXBpbGVNZW51KGRhdGEsIHRoaXMpO1xyXG5cclxuXHRcdFx0dGhpcy4kd3JhcHBlci5hcHBlbmQodGhpcy4kbWVudSk7XHJcblxyXG5cdFx0XHR0aGlzLl9kYXRhID0gZGF0YTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoaXMuX2RhdGEgPSBbXTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdG1lcmdlKGRhdGEpIHtcclxuXHRcdHRoaXMuX2RhdGEgPSB0aGlzLl9kYXRhLmZpbHRlcihpdGVtID0+IHtcclxuXHRcdFx0cmV0dXJuICFkYXRhLmluY2x1ZGVzKGl0ZW0pO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5fZGF0YSA9IGRhdGEuY29uY2F0KHRoaXMuX2RhdGEpO1xyXG5cdFx0dGhpcy51cGRhdGUodGhpcy5fZGF0YSk7XHJcblx0fVxyXG5cclxuXHRzZXRJbmZvKGluZm8pIHtcclxuXHRcdHRoaXMuJGluZm8gPSBpbmZvO1xyXG5cdH1cclxuXHJcblx0Z2V0SW5mbygpIHtcclxuXHRcdHJldHVybiB0aGlzLiRpbmZvO1xyXG5cdH1cclxuXHJcblx0Z2V0RGF0YSgpIHtcclxuXHRcdHJldHVybiB0aGlzLl9kYXRhO1xyXG5cdH1cclxuXHJcblx0Z2V0Q2xzKGNsYXNzTmFtZSkge1xyXG5cdFx0cmV0dXJuIHRoaXMuJG1lbnUuZmluZChjbGFzc05hbWUpO1xyXG5cdH1cclxuXHJcblx0c2hvd0F0KGV2dCkge1xyXG5cdFx0aWYgKCF0aGlzLl9kYXRhLmxlbmd0aCkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0bGV0IHggPSBldnQuY2xpZW50WCAtIHRoaXMuJHdyYXBwZXIub2Zmc2V0KCkubGVmdDtcclxuXHRcdGxldCB5ID0gZXZ0LmNsaWVudFkgLSB0aGlzLiR3cmFwcGVyLm9mZnNldCgpLnRvcDtcclxuXHJcblx0ICAgIHRoaXMuJG1lbnVcclxuXHQgICAgXHQuYWRkQ2xhc3MoJ3Nob3ctbWVudScpXHJcblx0ICAgIFx0LmNzcyh7ICdsZWZ0JzogeCArICdweCcsICd0b3AnOiB5ICsgJ3B4JyB9KTtcclxuXHR9XHJcblxyXG5cdGhpZGUoKSB7XHJcblx0XHR0aGlzLiRtZW51LnJlbW92ZUNsYXNzKCdzaG93LW1lbnUnKTtcclxuXHR9XHJcblxyXG5cdGdldERvbSgpIHtcclxuXHRcdHJldHVybiB0aGlzLiRtZW51O1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHtcclxuXHRcdHRoaXMuJG1lbnUuZW1wdHkoKTtcclxuXHR9XHJcblxyXG59XHJcblxyXG5cclxuY29uc3QgZW1wdHlGbiA9IChldnQpID0+IHsgXHJcblx0ZXZ0LnByZXZlbnREZWZhdWx0O1xyXG5cdHJldHVybiBmYWxzZTsgXHJcbn07XHJcblxyXG5mdW5jdGlvbiBjb252ZXJ0KGl0ZW0pIHtcclxuXHRsZXQgZGVmSXRlbSA9IHtcclxuXHRcdCdpZCc6ICdjbS1pZC0nICsgRGF0ZS5ub3coKSxcclxuXHRcdCd0ZXh0JzogJycsXHJcblx0XHQnaWNvbkNscyc6ICcnLFxyXG5cdFx0J2hpZGRlbic6IGZhbHNlLFxyXG5cdFx0J2Rpc2FibGVkJzogZmFsc2UsXHJcblx0XHQnaGFuZGxlcic6IGZ1bmN0aW9uKCkge31cclxuXHR9O1xyXG5cclxuXHRyZXR1cm4gT2JqZWN0LmFzc2lnbihkZWZJdGVtLCBpdGVtKTtcclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlSXRlbShpdGVtLCB2bSkge1xyXG5cdGxldCAkaXRlbSA9ICQoJzxsaS8+JylcclxuXHRcdFx0LmF0dHIoJ2lkJywgaXRlbS5pZClcclxuXHRcdFx0LmFkZENsYXNzKCdjLW1lbnUtaXRlbScpXHJcblx0XHRcdC5hZGRDbGFzcyhpdGVtLmRpc2FibGVkID8gJ2Rpc2FibGVkJzogJycpO1xyXG5cclxuICAgIGxldCAkYnV0dG9uID0gJCgnPGJ1dHRvbi8+JykuYWRkQ2xhc3MoJ2MtbWVudS1idG4nKVxyXG4gICAgXHRcdC5hcHBlbmQoYDxpIGNsYXNzPVwiZmEgJHtpdGVtLmljb25DbHN9XCI+PC9pPmApXHJcbiAgICBcdFx0LmFwcGVuZChgPHNwYW4gY2xhc3M9XCJjLW1lbnUtdGV4dFwiPiR7aXRlbS50ZXh0fTwvc3Bhbj5gKVxyXG4gICAgXHRcdC5vbignY2xpY2snLCAoZXZ0KSA9PiB7XHJcbiAgICBcdFx0XHRpdGVtLmhhbmRsZXIuY2FsbCh2bSwgdm0uZ2V0SW5mbygpLCB2bS5jb250ZXh0LCBldnQpO1xyXG4gICAgXHRcdH0pO1xyXG5cclxuICAgIHJldHVybiAkaXRlbS5hcHBlbmQoJGJ1dHRvbik7XHJcbn07XHJcblxyXG5mdW5jdGlvbiBjb21waWxlTWVudShtZW51cywgdm0pIHtcclxuXHRpZiAobWVudXMgJiYgbWVudXMubGVuZ3RoID09PSAwKSByZXR1cm4gJChudWxsKTtcclxuXHRcclxuXHRsZXQgJG1lbnVzID0gJCgnPG1lbnUvPicpLmFkZENsYXNzKCdjLW1lbnUnKTtcclxuXHRsZXQgJG1lbnVTZXBhcmF0b3IgPSAkKCc8bGkvPicpLmFkZENsYXNzKCdjLW1lbnUtc2VwYXJhdG9yJyk7XHJcblx0XHJcblx0bWVudXMuZm9yRWFjaChtZW51ID0+IHtcclxuXHRcdGlmIChtZW51LnNlcGFyYXRvcikge1xyXG5cdFx0XHRyZXR1cm4gJG1lbnVzLmFwcGVuZCgkbWVudVNlcGFyYXRvcik7XHJcblx0XHR9XHJcblxyXG5cdFx0bGV0ICRtZW51ID0gY3JlYXRlSXRlbShjb252ZXJ0KG1lbnUpLCB2bSk7XHJcblx0XHRsZXQgY2hpbGRyZW47XHJcblxyXG5cdFx0aWYgKG1lbnUuY2hpbGRyZW4pIHtcclxuXHRcdFx0Y2hpbGRyZW4gPSBjb21waWxlTWVudShtZW51LmNoaWxkcmVuLCB2bSk7XHJcblxyXG5cdFx0XHRpZiAoY2hpbGRyZW4pIHtcclxuXHRcdFx0XHQkbWVudS5hZGRDbGFzcygnc3VibWVudScpLmFwcGVuZChjaGlsZHJlbik7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0JG1lbnVzLmFwcGVuZCgkbWVudSk7XHJcblx0fSk7XHJcblxyXG5cdHJldHVybiAkbWVudXM7XHJcbn1cclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IE1lbnU7IiwiJ3VzZSBzdHJpY3QnO1xyXG5jb25zdCAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ2pRdWVyeSddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnalF1ZXJ5J10gOiBudWxsKTtcclxuXHJcbmNvbnN0IEZMRVhNSU5XSURUSCA9IDM1O1xyXG5cclxudmFyIGRyYWdEcm9wID0gZnVuY3Rpb24oZXZ0LCBvcHRzKSB7XHJcblx0dmFyIGRvYyA9ICQoZG9jdW1lbnQpO1xyXG5cdHZhciBzY3JvbGxMZWZ0ID0gZG9jdW1lbnQuYm9keS5zY3JvbGxMZWZ0IHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0O1xyXG5cdHZhciBzY3JvbGxUb3AgPSBkb2N1bWVudC5ib2R5LnNjcm9sbFRvcCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsVG9wO1xyXG5cdHZhciBsZWZ0T2Zmc2V0ID0gJChldnQudGFyZ2V0KS5vZmZzZXQoKS5sZWZ0IC0gc2Nyb2xsTGVmdDtcclxuXHR2YXIgaVgsIGlZLCBzdGFydFgsIGVuZFg7XHJcblx0dmFyIGRyYWdnaW5nID0gdHJ1ZTtcclxuXHJcblx0c3RhcnRYID0gaVggPSBldnQuY2xpZW50WCAtIHNjcm9sbExlZnQ7XHJcblx0aVkgPSAkKGV2dC50YXJnZXQpLm9mZnNldCgpLnRvcCAtIHNjcm9sbFRvcDtcclxuXHJcblx0b3B0cy5vbkRyYWdTdGFydCh7ICd4Jzogc3RhcnRYIH0sIG9wdHMuJGVsZW1lbnQpO1xyXG5cclxuXHRkb2Mub24oJ21vdXNlbW92ZS5kcmFnZHJvcCcsICQucHJveHkobW91c2Vtb3ZlLCB0aGlzKSk7XHJcblx0ZG9jLm9uKCdtb3VzZXVwLmRyYWdkcm9wJywgJC5wcm94eShtb3VzZXVwLCB0aGlzKSk7XHJcblx0Ly8gJChldnQudGFyZ2V0KVswXS5zZXRDYXB0dXJlICYmICQoZXZ0LnRhcmdldClbMF0uc2V0Q2FwdHVyZSgpO1xyXG5cclxuXHRmdW5jdGlvbiBtb3VzZW1vdmUoZSkge1xyXG5cdFx0aWYgKGRyYWdnaW5nKSB7XHJcblx0XHRcdGVuZFggPSBlLmNsaWVudFggLSBzY3JvbGxMZWZ0O1xyXG5cclxuXHRcdFx0Ly8gbGltaXRcclxuXHRcdFx0aWYgKGVuZFggLSBsZWZ0T2Zmc2V0IDwgRkxFWE1JTldJRFRIKSB7XHJcblx0XHRcdFx0ZW5kWCA9IGxlZnRPZmZzZXQgKyBGTEVYTUlOV0lEVEg7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdG9wdHMub25EcmFnZ2luZyggeyAneCc6IGVuZFggfSwgb3B0cy4kZWxlbWVudCk7XHJcblx0XHR9XHJcblxyXG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIG1vdXNldXAoZXZ0KSB7XHJcblx0XHR2YXIgZSA9IGV2dC50YXJnZXQ7XHJcblx0XHRkcmFnZ2luZyA9IGZhbHNlO1xyXG5cclxuXHRcdG9wdHMub25EcmFnRW5kKHsgJ3gnOiBldnQuY2xpZW50WCAtIHNjcm9sbExlZnQgfSwgb3B0cy4kZWxlbWVudCk7XHJcblxyXG5cdFx0aWYgKGUgJiYgZS5zZXRDYXB0dXJlKSB7XHJcblx0XHRcdGUucmVsZWFzZUNhcHR1cmUoKTtcclxuXHRcdH0gZWxzZSBpZiAod2luZG93LnJlbGVhc2VDYXB0dXJlKSB7XHJcblx0XHRcdHdpbmRvdy5yZWxlYXNlQ2FwdHVyZShFdmVudC5NT1VTRU1PVkUgfCBFdmVudC5NT1VTRVVQKTtcclxuXHRcdH1cclxuXHJcblx0XHRkb2Mub2ZmKCdtb3VzZW1vdmUuZHJhZ2Ryb3AnLCBtb3VzZW1vdmUpO1xyXG5cdFx0ZG9jLm9mZignbW91c2V1cC5kcmFnZHJvcCcsIG1vdXNldXApO1xyXG5cdH1cclxuXHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihkZWxlZ2F0ZSwgb3B0aW9ucykge1xyXG5cdHZhciBkZWZhdWx0cyA9IHtcclxuXHRcdHJlc3RyaWN0ZXIoZXZ0KSB7IHJldHVybiBudWxsOyB9LFxyXG5cdFx0b25EcmFnU3RhcnQob2Zmc2V0LCB0YXJnZXQpIHt9LFxyXG5cdFx0b25EcmFnZ2luZyhvZmZzZXQsIHRhcmdldCkge30sXHJcblx0XHRvbkRyYWdFbmQob2Zmc2V0LCB0YXJnZXQpIHt9XHJcblx0fTtcclxuXHJcblx0T2JqZWN0LmFzc2lnbihkZWZhdWx0cywgb3B0aW9ucyk7XHJcblxyXG5cdCQoZGVsZWdhdGUpLm9uKCdtb3VzZWRvd24nLCBvcHRpb25zLnRyaWdnZXIsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0dmFyIHJlc3RyaWN0ZXIgPSBkZWZhdWx0cy5yZXN0cmljdGVyLmNhbGwodGhpcywgZXZ0KTtcclxuXHJcblx0XHRpZiAocmVzdHJpY3Rlcikge1xyXG5cdFx0XHRkZWZhdWx0cy4kZWxlbWVudCA9IHJlc3RyaWN0ZXI7XHJcblx0XHRcdGRyYWdEcm9wLmNhbGwodGhpcywgZXZ0LCBkZWZhdWx0cyk7XHJcblx0XHR9XHJcblx0fSk7XHJcbn07IiwiLyoqXHJcbiAqIOS6i+S7tueuoeeQhlxyXG4gKiBAY2xhc3MgRXZlbnRFbWl0dGVyXHJcbiAqL1xyXG5cclxuZnVuY3Rpb24gaW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVycywgbGlzdGVuZXIpIHtcclxuXHR2YXIgaSA9IGxpc3RlbmVycy5sZW5ndGg7XHJcblx0d2hpbGUgKGktLSkge1xyXG5cdFx0aWYgKGxpc3RlbmVyc1tpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHtcclxuXHRcdFx0cmV0dXJuIGk7XHJcblx0XHR9XHJcblx0fVxyXG5cdHJldHVybiAtMTtcclxufVxyXG5cclxuZnVuY3Rpb24gaXNWYWxpZExpc3RlbmVyKGxpc3RlbmVyKSB7XHJcblx0aWYgKHR5cGVvZiBsaXN0ZW5lciA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fSBlbHNlIGlmIChsaXN0ZW5lciAmJiB0eXBlb2YgbGlzdGVuZXIgPT09ICdvYmplY3QnKSB7XHJcblx0XHRyZXR1cm4gaXNWYWxpZExpc3RlbmVyKGxpc3RlbmVyLmxpc3RlbmVyKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxufVxyXG5cclxuY2xhc3MgRXZlbnRFbWl0dGVyIHtcclxuXHJcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xyXG5cclxuXHR9XHJcblx0LyoqXHJcblx0KlxyXG5cdCpcclxuXHQqXHJcblx0KlxyXG5cdCovXHJcblx0X2dldEV2ZW50cygpIHtcclxuXHRcdHJldHVybiB0aGlzLl9ldmVudHMgfHwgKHRoaXMuX2V2ZW50cyA9IHt9KTtcclxuXHR9XHJcblx0LyoqXHJcblx0KiDpgJrov4fkuovku7blkI3ojrflj5ZsaXN0ZW5lciDmlbDnu4TmiJbliJ3lp4vljJZcclxuXHQqIOS9v+eUqOato+WImeWMuemFjeS8mui/lOWbnuS4gOS4quWvueW6lOeahOWvueixoVxyXG5cdCpcclxuXHQqIFxyXG5cdCogZ2V0TGlzdGVuZXJzXHJcblx0KiBAcGFyYW0ge1N0cmluZyB9IFJlZ0V4cH0gZXZlbnROYW1lXHJcblx0KiBAcmV0dXJuIHtGdW5jdG9uW10gfCBPYmplY3R9XHJcblx0KlxyXG5cdCovXHJcblx0Z2V0TGlzdGVuZXJzKG5hbWUpIHtcclxuXHRcdHZhciBldmVudHMgPSB0aGlzLl9nZXRFdmVudHMoKTtcclxuXHRcdHZhciByZXNwb25zZTtcclxuXHRcdHZhciBrZXk7XHJcblxyXG5cdFx0aWYgKG5hbWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcclxuXHRcdFx0cmVzcG9uc2UgPSB7fTtcclxuXHRcdFx0Zm9yIChrZXkgaW4gZXZlbnRzKSB7XHJcblx0XHRcdFx0aWYgKGV2ZW50cy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIG5hbWUudGVzdChrZXkpKSB7XHJcblx0XHRcdFx0XHRyZXNwb25zZVtrZXldID0gZXZlbnRzW2tleV07XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyZXNwb25zZSA9IGV2ZW50c1tuYW1lXSB8fCAoZXZlbnRzW25hbWVdID0gW10pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiByZXNwb25zZTtcclxuXHR9XHJcblx0LyoqXHJcblx0KiDpgJrov4fkuovku7blkI3ojrflj5ZsaXN0ZW5lciDlp4vnu4jov5Tlm57kuIDkuKrlr7nosaFcclxuXHQqXHJcblx0KiBcclxuXHQqIGdldExpc3RlbmVyc0FzT2JqZWN0XHJcblx0KiBAcGFyYW0ge1N0cmluZ3xSZWdFeHB9IGV2ZW50TmFtZVxyXG5cdCogQHJldHVybiB7T2JqZWN0fVxyXG5cdCovXHJcblx0Z2V0TGlzdGVuZXJzQXNPYmplY3QobmFtZSkge1xyXG5cdFx0dmFyIGxpc3RlbmVycyA9IHRoaXMuZ2V0TGlzdGVuZXJzKG5hbWUpO1xyXG5cdFx0dmFyIHJlc3BvbnNlO1xyXG5cclxuXHRcdGlmIChsaXN0ZW5lcnMgaW5zdGFuY2VvZiBBcnJheSkge1xyXG5cdFx0XHRyZXNwb25zZSA9IHt9O1xyXG5cdFx0XHRyZXNwb25zZVtuYW1lXSA9IGxpc3RlbmVycztcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcmVzcG9uc2UgfHwgbGlzdGVuZXJzO1xyXG5cdH1cclxuXHQvKipcclxuXHQqIOiOt+WPliBsaXN0ZW5lciDliJfooahcclxuXHQqXHJcblx0KiBmbGF0dGVuTGlzdGVuZXJzXHJcblx0KlxyXG5cdCogQHBhcmFtIHsgT2JqZWN0W119IGxpc3RlbmVyc1xyXG5cdCogQHJldHVybiB7RnVuY3Rpb25bXX1cclxuXHQqL1xyXG5cdGZsYXR0ZW5MaXN0ZW5lcnMobGlzdGVuZXJzKSB7XHJcblx0XHR2YXIgZmxhdExpc3RlbmVycyA9IFtdO1xyXG5cclxuXHRcdGZvciAodmFyIGkgPSAwLCBsID0gbGlzdGVuZXIubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcblx0XHRcdGZsYXRMaXN0ZW5lcnMucHVzaChsaXN0ZW5lcnNbaV0ubGlzdGVuZXIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmbGF0TGlzdGVuZXJzO1xyXG5cdH1cclxuXHQvKipcclxuXHQqIOS6i+S7tuazqOWGjFxyXG5cdCpcclxuXHQqXHJcblx0KiBAZXhhbXBlbFxyXG5cdCogdmFyIGVtdCA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcclxuXHQqIGVtdC5hZGRMaXN0ZW5lcignZGl2OmhvdmVyJywgZnVuY3Rpb24oKXtcclxuXHQqXHQvLyBkb1xyXG5cdCogfSk7XHJcblx0KiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lXHJcblx0KiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxyXG5cdCogQHJldHVybiB7T2JqZWN0an1cclxuXHQqXHJcblx0Ki9cclxuXHRhZGRMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lciwgZmxhZykge1xyXG5cdFx0aWYgKCFpc1ZhbGlkTGlzdGVuZXIobGlzdGVuZXIpKSB7XHJcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBsaXN0ZW5lcnMgPSB0aGlzLmdldExpc3RlbmVyc0FzT2JqZWN0KG5hbWUpO1xyXG5cdFx0dmFyIGxpc3RlbmVySXNXcmFwcGVkID0gdHlwZW9mIGxpc3RlbmVyID09PSAnb2JqZWN0JztcclxuXHRcdHZhciBrZXksIHN0YXJ0LCBhcmdzO1xyXG5cclxuXHRcdGZvciAoa2V5IGluIGxpc3RlbmVycykge1xyXG5cdFx0XHRpZiAobGlzdGVuZXJzLmhhc093blByb3BlcnR5KGtleSkgJiYgaW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVycywgbGlzdGVuZXIpID09PSAtMSkge1xyXG5cclxuXHRcdFx0XHRzdGFydCA9IGxpc3RlbmVyc1trZXldLmxlbmd0aDtcclxuXHJcblx0XHRcdFx0bGlzdGVuZXJzW2tleV0ucHVzaChsaXN0ZW5lcklzV3JhcHBlZCA/IGxpc3RlbmVyIDoge1xyXG5cdFx0XHRcdFx0bGlzdGVuZXI6IGxpc3RlbmVyLFxyXG5cdFx0XHRcdFx0b25jZTogZmFsc2VcclxuXHRcdFx0XHR9KTtcclxuXHJcblx0XHRcdFx0aWYgKGZsYWcgJiYgbGlzdGVuZXJzW2tleV0uYXJncykge1xyXG5cdFx0XHRcdFx0bGlzdGVuZXJzW2tleV0uc3RhcnQgPSBzdGFydDtcclxuXHRcdFx0XHRcdGFyZ3MgPSBsaXN0ZW5lcnNba2V5XS5hcmdzO1xyXG5cdFx0XHRcdFx0dGhpcy5lbWl0RXZlbnQobmFtZSwgYXJncyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRvbigpIHtcclxuXHRcdHJldHVybiB0aGlzLmFkZExpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cclxuXHRvbmUobmFtZSwgbGlzdGVuZXIsIGZsYWcpIHtcclxuXHRcdHJldHVybiB0aGlzLnJlbW92ZUV2ZW50KG5hbWUpLmFkZExpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiDkuovku7bms6jlhozvvIzop6blj5HlkI7oh6rliqjnp7vpmaRcclxuXHQgKlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZVxyXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyXHJcblx0ICogQHJldXRuciB7T2JqZWN0fVxyXG5cdCAqXHJcblx0ICovXHJcblx0YWRkT25jZUxpc3RlbmVyKG5hbWUsIGxpc3RlbmVyKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5hZGRMaXN0ZW5lcihuYW1lLCB7XHJcblx0XHRcdGxpc3RlbmVyOiBsaXN0ZW5lcixcclxuXHRcdFx0b25jZTogdHJ1ZVxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRvbmNlKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuYWRkT25jZUxpc3RlbmVyLmFwcGx5KHRoaXMuYXJndW1lbnRzKTtcclxuXHR9XHJcblx0LyoqXHJcblx0ICog5LqL5Lu26ZSA5q+BXHJcblx0ICpcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWVcclxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxyXG5cdCAqIEByZXR1cm4ge09iamVjdH1cclxuXHQgKlxyXG5cdCAqL1xyXG5cdHJlbW92ZUxpc3RlbmVyKG5hbWUsIGxpc3RlbmVyKSB7XHJcblx0XHR2YXIgbGlzdGVuZXJzID0gdGhpcy5nZXRMaXN0ZW5lcnNBc09iamVjdChuYW1lKTtcclxuXHRcdHZhciBpbmRleDtcclxuXHRcdHZhciBrZXk7XHJcblxyXG5cdFx0Zm9yIChrZXkgaW4gbGlzdGVuZXJzKSB7XHJcblx0XHRcdGlmIChsaXN0ZW5lcnMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xyXG5cdFx0XHRcdGluZGV4ID0gaW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVyc1trZXldLCBsaXN0ZW5lcik7XHJcblxyXG5cdFx0XHRcdGlmIChpbmRleCAhPT0gLTEpIHtcclxuXHRcdFx0XHRcdGxpc3RlbmVyc1trZXldLnNwbGljZShpbmRleCwgaSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRvZmYoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yZW1vdmVMaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHJcblx0bWFuaXB1bGF0ZUxpc3RlbmVycyhyZW1vdmUsIG5hbWUsIGxpc3RlbmVycykge1xyXG5cdFx0dmFyIHNpbmdsZSA9IHJlbW92ZSA/IHRoaXMucmVtb3ZlTGlzdGVuZXIgOiB0aGlzLmFkZExpc3RlbmVyO1xyXG5cdFx0dmFyIG11dGlwbGUgPSByZW1vdmUgPyB0aGlzLnJlbW92ZUxpc3RlbmVycyA6IHRoaXMuYWRkTGlzdGVuZXJzO1xyXG5cdFx0dmFyIGk7XHJcblx0XHR2YXIgdjtcclxuXHJcblx0XHRpZiAodHlwZW9mIG5hbWUgPT09ICdvYmplY3QnICYmICEobmFtZSBpbnN0YW5jZW9mIFJlZ0V4cCkpIHtcclxuXHRcdFx0Zm9yIChpIGluIG5hbWUpIHtcclxuXHRcdFx0XHRpZiAobmFtZS5oYXNPd25Qcm9wZXJ0eShpKSAmJiAodiA9IG5hbWVbaV0pKSB7XHJcblx0XHRcdFx0XHRpZiAodHlwZW9mIHYgPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0XHRcdFx0c2luZ2xlLmNhbGwodGhpcywgaSwgdik7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRtdXRpcGxlLmNhbGwodGhpcywgaSwgdik7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRpID0gMDtcclxuXHRcdFx0diA9IGxpc3RlbmVycy5sZW5ndGg7XHJcblx0XHRcdHdoaWxlIChpIDwgdikge1xyXG5cdFx0XHRcdHNpbmdsZS5jYWxsKHRoaXMsIG5hbWUsIGxpc3RlbmVyc1tpKytdKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0YWRkTGlzdGVuZXJzKG5hbWUsIGxpc3RlbmVycykge1xyXG5cdFx0cmV0dXJuIHRoaXMubWFuaXB1bGF0ZUxpc3RlbmVycyhmYWxzZSwgbmFtZSwgbGlzdGVuZXJzKTtcclxuXHR9XHJcblxyXG5cdHJlbW92ZUxpc3RlbmVycyhuYW1lLCBsaXN0ZW5lcnMpIHtcclxuXHRcdHJldHVybiB0aGlzLm1hbmlwdWxhdGVMaXN0ZW5lcnModHJ1ZSwgbmFtZSwgbGlzdGVuZXJzKTtcclxuXHR9XHJcblxyXG5cdHJlbW92ZUV2ZW50KG5hbWUpIHtcclxuXHRcdHZhciBldmVudHMgPSB0aGlzLl9nZXRFdmVudHMoKTtcclxuXHRcdHZhciBrZXk7XHJcblxyXG5cdFx0aWYgKHR5cGVvZiBuYW1lID09PSAnc3RyaW5nJykge1xyXG5cdFx0XHQvLyDnp7vpmaTmiYDmnInmjIflrprkuovku7blkI3nmoTmiYDmnIlsaXN0ZW5lcnNcclxuXHRcdFx0Ly8gZGVsZXRlIGV2ZW50c1tuYW1lXVxyXG5cdFx0XHRpZiAoZXZlbnRzW25hbWVdIGluc3RhbmNlb2YgQXJyYXkpIHtcclxuXHRcdFx0XHRldmVudHNbbmFtZV0ubGVuZ3RoID0gMDtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIGlmIChuYW1lIGluc3RhbmNlb2YgUmVnRXhwKSB7XHJcblx0XHRcdC8vIOato+WImeWMuemFjeeahOaJgOaciSBsaXN0ZW5lcnNcclxuXHRcdFx0Zm9yIChrZXkgaW4gZXZlbnRzKSB7XHJcblx0XHRcdFx0aWYgKGV2ZW50cy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIG5hbWUudGVzdChrZXkpKSB7XHJcblx0XHRcdFx0XHQvLyBkZWxldGUgZXZlbnRzW2tleV1cclxuXHRcdFx0XHRcdGlmIChldmVudHNba2V5XSBpbnN0YW5jZW9mIEFycmF5KSB7XHJcblx0XHRcdFx0XHRcdGV2ZW50W2tleV0ubGVuZ3RoID0gMDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdC8vIOenu+mZpOaJgOaciSBsaXN0ZW5lcnNcclxuXHRcdFx0ZGVsZXRlIHRoaXMuX2V2ZW50cztcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdHJlbW92ZUFsbExpc3RlbmVycygpIHtcclxuXHRcdHJldHVybiB0aGlzLnJlbW92ZUV2ZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cdC8qKlxyXG5cdCAqIOS6i+S7tuinpuWPkVxyXG5cdCAqXHJcblx0ICpcclxuXHQgKiBAZXhhbXBsZVxyXG5cdCAqIHZhciBlbXQgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XHJcblx0ICogc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuXHQgKiBcdGVtdC5lbWl0RXZlbnQoJ2Rpdjpob3ZlcicsIDEpO1xyXG5cdCAqIH0sIDEwMDApO1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSDkuovku7blkI3np7BcclxuXHQgKiBAcGFyYW0ge0FycmF5fSBbYXJnc10gSFRNTERvY3VtZW50LCBpdGVtRGF0YSwgLi4uXHJcblx0ICogQHJldHVybiB7T2JqZWN0fVxyXG5cdCAqXHJcblx0ICovXHJcblx0ZW1pdEV2ZW50KG5hbWUsIGFyZ3MpIHtcclxuXHRcdHZhciBsaXN0ZW5lcnNNYXAgPSB0aGlzLmdldExpc3RlbmVyc0FzT2JqZWN0KG5hbWUpO1xyXG5cdFx0dmFyIGxpc3RlbmVycztcclxuXHRcdHZhciBsaXN0ZW5lcjtcclxuXHRcdHZhciBpO1xyXG5cdFx0dmFyIGw7XHJcblx0XHR2YXIga2V5O1xyXG5cdFx0dmFyIHJlc3BvbnNlO1xyXG5cclxuXHRcdGZvciAoa2V5IGluIGxpc3RlbmVyc01hcCkge1xyXG5cdFx0XHRpZiAobGlzdGVuZXJzTWFwLmhhc093blByb3BlcnR5KGtleSkpIHtcclxuXHRcdFx0XHRsaXN0ZW5lcnMgPSBsaXN0ZW5lcnNNYXBba2V5XS5zbGljZSgwKTtcclxuXHJcblx0XHRcdFx0bGlzdGVuZXJzTWFwW2tleV0uYXJncyA9IGFyZ3M7XHJcblxyXG5cdFx0XHRcdGkgPSBsaXN0ZW5lcnNNYXBba2V5XS5zdGFydCB8fCAwO1xyXG5cdFx0XHRcdGxpc3RlbmVyc01hcFtrZXldLnN0YXJ0ID0gMDtcclxuXHJcblx0XHRcdFx0Zm9yIChsID0gbGlzdGVuZXJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG5cdFx0XHRcdFx0bGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XHJcblxyXG5cdFx0XHRcdFx0aWYgKGxpc3RlbmVyLm9uY2UgPT09IHRydWUpIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5yZW1vdmVMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lci5saXN0ZW5lcik7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0cmVzcG9uc2UgPSBsaXN0ZW5lci5saXN0ZW5lci5hcHBseSh0aGlzLCBhcmdzIHx8IFtdKTtcclxuXHJcblx0XHRcdFx0XHRpZiAocmVzcG9uc2UgPT09IHRoaXMuX2dldE9uY2VSZXR1cm5WYWx1ZSgpKSB7XHJcblx0XHRcdFx0XHRcdHRoaXMucmVtb3ZlTGlzdGVuZXIobmFtZSwgbGlzdGVuZXIubGlzdGVuZXIpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHR0cmlnZ2VyKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuZW1pdEV2ZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cclxuXHRmaXJlKG5hbWUpIHtcclxuXHRcdHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcclxuXHRcdHJldHVybiB0aGlzLmVtaXRFdmVudChuYW1lLCBhcmdzKTtcclxuXHR9XHJcblxyXG5cdF9nZXRPbmNlUmV0dXJuVmFsdWUoKSB7XHJcblx0XHRpZiAodGhpcy5oYXNPd25Qcm9wZXJ0eSgnX29uY2VSZXR1cm5WYWx1ZScpKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLl9vbmNlUmV0dXJuVmFsdWU7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdHNldE9uY2VSZXR1cm5WYWx1ZSh2YWx1ZSkge1xyXG5cdFx0dGhpcy5fb25jZVJldHVyblZhbHVlID0gdmFsdWU7XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdGRlZmluZUV2ZW50KG5hbWUpIHtcclxuXHRcdHRoaXMuZ2V0TGlzdGVuZXJzKG5hbWUpO1xyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRkZWZpbmVFdmVudHMobmFtZXMpIHtcclxuXHRcdGZvciAodmFyIGkgPSAwLCBsID0gbmFtZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcblx0XHRcdHRoaXMuZGVmaW5lRXZlbnQobmFtZVtpXSk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcclxuXHJcblxyXG4iLCJmdW5jdGlvbiBzd2FwKGFyciwgczEsIHMyKSB7XHJcblx0dmFyIHRlbXAgPSBhcnJbczFdO1xyXG5cdGFycltzMV0gPSBhcnJbczJdO1xyXG5cdGFycltzMl0gPSB0ZW1wO1xyXG59XHJcblxyXG5mdW5jdGlvbiByYW5kb21WYWx1ZShhcnIpIHtcclxuXHR2YXIgciA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGFyci5sZW5ndGgpO1xyXG5cdC8vIHN3YXAoYXJyLCAwLCByKTtcclxuXHRyZXR1cm4gW2FycltyXSwgYXJyLmZpbHRlcigoZCwgaSkgPT4gaSAhPT0gcildO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmaWx0ZXJMQW5kUihhcnIsIHNlbGVjdCwgY29tcGFyZUZuKSB7XHJcblx0dmFyIGxlZnRBcnIgPSBbXTtcclxuXHR2YXIgcmlnaHRBcnIgPSBbXTtcclxuXHJcblx0Zm9yICh2YXIgaSA9IDAsIGxlbiA9IGFyci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG5cdFx0bGV0IHRlbXAgPSBhcnJbaV07XHJcblx0XHRsZXQgY29tcGFyZWQgPSBjb21wYXJlRm4oc2VsZWN0LCB0ZW1wKTtcclxuXHRcdGlmIChjb21wYXJlZCA+IDApIHJpZ2h0QXJyLnB1c2godGVtcCk7XHJcblx0XHRlbHNlIGlmIChjb21wYXJlZCA8IDApIGxlZnRBcnIucHVzaCh0ZW1wKTtcclxuXHRcdGVsc2UgTWF0aC5yYW5kb20oKSA+IDAuNSA/IHJpZ2h0QXJyLnB1c2godGVtcCkgOiBsZWZ0QXJyLnB1c2godGVtcCk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gW2xlZnRBcnIsIHJpZ2h0QXJyXTtcclxufVxyXG5cclxuZnVuY3Rpb24gZmluZEluZGV4KGFyciwgaW5kZXgsIGNvbXBhcmVGbikge1xyXG5cdGlmIChhcnIubGVuZ3RoIDw9IDEgfHwgaW5kZXggPT09IDApIHJldHVybiBhcnJbMF07XHJcblx0dmFyIFtzZWxlY3QsIHNlY19hcnJdID0gcmFuZG9tVmFsdWUoYXJyKTtcclxuXHR2YXIgW2xlZnRBcnIsIHJpZ2h0QXJyXSA9IGZpbHRlckxBbmRSKHNlY19hcnIsIHNlbGVjdCwgY29tcGFyZUZuKTtcclxuXHR2YXIgbiA9IHJpZ2h0QXJyLmxlbmd0aDtcclxuXHJcblx0aWYgKG4gPT09IGluZGV4IC0gMSkgcmV0dXJuIHNlbGVjdDtcclxuXHRpZiAobiA+PSBpbmRleCkgcmV0dXJuIGZpbmRJbmRleChyaWdodEFyciwgaW5kZXgsIGNvbXBhcmVGbik7XHJcblx0ZWxzZSByZXR1cm4gZmluZEluZGV4KGxlZnRBcnIsIGluZGV4IC0gbiAtIDEsIGNvbXBhcmVGbik7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZmluZEluZGV4OyIsInZhciBVdGlscyA9IHt9O1xyXG5cclxudmFyIHVpZCA9IFV0aWxzLnVpZCA9ICgoKSA9PiB7XHJcblx0bGV0IHQgPSBEYXRlLm5vdygpO1xyXG5cdHJldHVybiAoKSA9PiB7XHJcblx0XHRyZXR1cm4gKHQrKykudG9TdHJpbmcoMTYpO1xyXG5cdH07XHJcbn0pKCk7XHJcblxyXG5cclxudmFyIG1lcmdlID0gVXRpbHMubWVyZ2UgPSAodGFyZ2V0LCBhZGRpdGlvbmFsLCBkZWVwKSA9PiB7XHJcblx0bGV0IGRlcHRoID0gdHlwZW9mIGRlZXAgPT0gJ3VuZGVmaW5lZCcgPyAyIDogZGVlcCwgcHJvcDtcclxuXHJcblx0Zm9yIChwcm9wIGluIGFkZGl0aW9uYWwpIHtcclxuXHRcdGlmIChhZGRpdGlvbmFsLmhhc093blByb3BlcnR5KHByb3ApKSB7XHJcblx0XHRcdGlmICh0eXBlb2YgdGFyZ2V0W3Byb3BdICE9PSAnb2JqZWN0JyB8fCAhZGVwdGgpIHtcclxuXHRcdFx0XHR0YXJnZXRbcHJvcF0gPSBhZGRpdGlvbmFsW3Byb3BdO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFV0aWxzLm1lcmdlKHRhcmdldFtwcm9wXSwgYWRkaXRpb25hbFtwcm9wXSwgZGVwdGggLSAxKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHRhcmdldDtcclxufTtcclxuXHJcbnZhciBmaW5kSW5kZXggPSBVdGlscy5maW5kSW5kZXggPSByZXF1aXJlKCcuL0ZpbmRJbmRleCcpO1xyXG52YXIgY29tcGFyZUZuID0gVXRpbHMuY29tcGFyZUZuID0gcmVxdWlyZSgnLi91dGlscy9Db21wYXJlcicpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBVdGlsczsiLCIvKipcclxuICog5Yib5bu65q+U6L6D5Ye95pWwXHJcbiAqIEBzdW1tYXJ5IOe6puadn+adoeS7tu+8jOWPqumSiOWvueWvueixoeaVsOe7hOe7k+aehOeahOaVsOaNru+8jOWmglxyXG4gKiAgICAgIFt7XCJjb2xfMVwiOiAxMCwgXCJjb2xfMlwiOiAzNSwgXCJjb2xfM1wiOiA2Nn0sIC4uLl1cclxuICpcclxuICogQGV4YW1wbGVcclxuICpcclxuICogIHZhciBzb3J0cyA9IFsnQScsJ0InLCdDJywnRCddO1xyXG4gKiAgdmFyIGRpcnMgPSBbMSwgLTEsIDEsIDFdO1xyXG4gKlxyXG4gKiAgdmFyIGRhdGEzID0gW1xyXG4gKiAgICAgIHtBOjEsQjoxLEM6NSxfaWQ6MX0sXHJcbiAqICAgICAge0E6MSxCOjMsQzo1LF9pZDoxfSxcclxuICogICAgICB7QToyLEI6NSxDOjQsX2lkOjJ9LFxyXG4gKiAgICAgIHtBOjEsQjoxLEM6OSxfaWQ6MX0sXHJcbiAqICAgICAge0E6MyxCOjMsQzozLF9pZDozfSxcclxuICogICAgICB7QToxLEI6MSxDOjMsX2lkOjF9LFxyXG4gKiAgICAgIHtBOjQsQjoyLEM6MixfaWQ6NH0sXHJcbiAqICAgICAge0E6NSxCOjQsQzoxLF9pZDo1fSxcclxuICogIF07XHJcbiAqXHJcbiAqICB2YXIgZm4gPSBjb21wYXJlRm4oc29ydHMsIGRpcnMpO1xyXG4gKiAgdmFyIHJldCA9IGRhdGEzLnNvcnQoZm4pLm1hcChkID0+IE9iamVjdC52YWx1ZXMoZCkpO1xyXG4gKiAgY29uc29sZS5kaXIocmV0KTtcclxuICpcclxuICogQHBhcmFtIHtBcnJheX0gc29ydHMgLeaOkuW6j+Wtl+auteaVsOe7hCBbJ2NvbF8xJywgJ2NvbF8yJywgJ2NvbF8zJywuLi5dXHJcbiAqIEBwYXJhbSB7QXJyYXl9IGRpcnMgLeWvueW6lOWtl+S9k+aOkuW6j+aVsOe7hOeahOWNh+mZjeW6jywx77ya5Y2H5bqPIC0x77ya6ZmN5bqPIFsxLCAtMV1cclxuICogQHJldHVybnMge0Z1bmN0aW9ufSDmr5TovoPlh73mlbBcclxuICovXHJcbmV4cG9ydHMuY29tcGFyZUZuID0gZnVuY3Rpb24gY29tcGFyZUZuKHNvcnRzLCBkaXJzKSB7XHJcbiAgICB2YXIgY29uZGl0aW9ucyA9IHNvcnRzLnJlZHVjZSgocHJlLCBuZXh0LCBpKSA9PiB7XHJcbiAgICAgICAgcHJlICA9IHByZSA/IHByZSArICcgfHwnIDogJyc7XHJcbiAgICAgICAgcmV0dXJuIGAke3ByZX0gKGEuJHtuZXh0fSAtIGIuJHtuZXh0fSkgKiAke2RpcnNbaV19YDtcclxuICAgIH0sICcnKTtcclxuXHJcbiAgICB2YXIgZnVuY3Rpb25fYm9keSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGxldCBzb3J0SW5mbyA9IHNvcnRzLmpvaW4oJywnKS5yZXBsYWNlKC8oXFx3KykvZywgJ1wiJDFcIicpO1xyXG4gICAgICAgIHJldHVybiBgdmFyIHNvcnQgPSBbJHtzb3J0SW5mb31dOyByZXR1cm4gJHtjb25kaXRpb25zfWA7XHJcbiAgICB9XHJcbiAgICAvLyBjb25zb2xlLmxvZyhmdW5jdGlvbl9ib2R5KCkpO1xyXG4gICAgXHJcbiAgICByZXR1cm4gbmV3IEZ1bmN0aW9uKCdhJywgJ2InLCBmdW5jdGlvbl9ib2R5KCkpO1xyXG59XHJcblxyXG5cclxuIl19
