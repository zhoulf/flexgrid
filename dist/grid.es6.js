(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.sz || (g.sz = {})).grid = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (global){
var $ = (typeof window !== "undefined" ? window['jQuery'] : typeof global !== "undefined" ? global['jQuery'] : null);
var EventEmitter = require('../util/EventEmitter');

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

	setText(text) {
		if (typeof text != 'string') return;

		this.text = text;
		this.fire('column-texted', this.text, this);
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

 		// this.context.fire('column-move-to', this, +index);
 		this.context.move(this, +index);
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

		this.on('column-removed', colM => {
			this.columns = this.columns.filter(col => col.dataIndex != colM.dataIndex);
			this.colModel.delete(colM.cid);
			this.colHeaders.delete(colM.dataIndex);
		});

	}

	move(colM, toIndex) {
		let current = this.columns.indexOf(colM);

		// TODO
		// 如果移到冻结列位置，需冻结

		if (toIndex === current) return;

		if (toIndex > current) {
			// 暂时元素都是用$().after移动，所以位置toIndex + 1
			this.columns.splice(toIndex + 1, 0, this.columns[current]);
			this.columns.splice(current, 1);
		} else {
			this.columns.splice(toIndex + 1, 0, this.columns[current]);
			this.columns.splice(++current, 1);
		}

		this.fire('column-moved', colM, current, toIndex);
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

			colM.on('column-texted', text => this.colElements.get(colM).text(text));

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
					let toIndex = self.colElements.get(toColumn).index();
					let formIndex = self.colsModel.getColumn().indexOf(fromColumn);

					// console.log(toIndex, formIndex);

					fromColumn.moveTo(toIndex);
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
var JSonToCSV = require('../util/expoter/CSV');

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
			let data = context.store.slice(0, 50);
			console.log(context._selection); 

			toCSV(data, context.columnModel);
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

function toCSV(data, colModel) {
	// 测试
	JSonToCSV.setDataConver({
	  data: data.map(d => d.data),
	  fileName: 'test',
	  columns: {
	    title: colModel.getColumn().map(colM => colM.text),
	    key: colModel.getColumn().map(colM => colM.dataIndex)
	    // formatter: function(n, v) {
	    //   if(n === 'amont' && !isNaN(Number(v))) {
	    //     v = v + '';
	    //     v = v.split('.');
	    //     v[0] = v[0].replace(/(\d)(?=(?:\d{3})+$)/g, '$1,');
	    //      return v.join('.');
	    //   }
	    //   if(n === 'proportion') return v + '%';
	    // }
	  }
	});
}

module.exports = Contextmenu;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../plugin/Menu":12,"../util/expoter/CSV":17,"./Selection":10}],10:[function(require,module,exports){
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

		let columnIds = this.getLockAndVisiableColumnAsCid();
		[x0, y0, x1, y1] = orderBy(x0, y0, x1, y1, columnIds);


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
},{"./FindIndex":15,"./utils/Comparer":18}],17:[function(require,module,exports){
module.exports = {
  /*
   * obj是一个对象，其中包含有：
   * ## data 是导出的具体数据
   * ## fileName 是导出时保存的文件名称 是string格式
   * ## showLabel 表示是否显示表头 默认显示 是布尔格式
   * ## columns 是表头对象，且title和key必须一一对应，包含有
        title:[], // 表头展示的文字
        key:[], // 获取数据的Key
        formatter: function() // 自定义设置当前数据的 传入(key, value)
   */
  setDataConver: function(obj) {
    var bw = this.browser();
    if(bw['ie'] < 9) return; // IE9以下的
    var data = obj['data'],
        ShowLabel = typeof obj['showLabel'] === 'undefined' ? true : obj['showLabel'],
        fileName = (obj['fileName'] || 'UserExport') + '.csv',
        columns = obj['columns'] || {
            title: [],
            key: [],
            formatter: undefined
        };
    var ShowLabel = typeof ShowLabel === 'undefined' ? true : ShowLabel;
    var row = "", CSV = '', key;
    // 如果要现实表头文字
    if (ShowLabel) {
        // 如果有传入自定义的表头文字
        if (columns.title.length) {
            columns.title.map(function(n) {
                row += n + ',';
            });
        } else {
            // 如果没有，就直接取数据第一条的对象的属性
            for (key in data[0]) row += key + ',';
        }
        row = row.slice(0, -1); // 删除最后一个,号，即a,b, => a,b
        CSV += row + '\r\n'; // 添加换行符号
    }
    // 具体的数据处理
    data.map(function(n) {
        row = '';
        // 如果存在自定义key值
        if (columns.key.length) {
            columns.key.map(function(m) {
                row += '"' + (typeof columns.formatter === 'function' ? columns.formatter(m, n[m]) || n[m] : n[m]) + '",';
            });
        } else {
            for (key in n) {
                row += '"' + (typeof columns.formatter === 'function' ? columns.formatter(key, n[key]) || n[key] : n[key]) + '",';
            }
        }
        row.slice(0, row.length - 1); // 删除最后一个,
        CSV += row + '\r\n'; // 添加换行符号
    });
    if(!CSV) return;
    this.SaveAs(fileName, CSV);
  },
  SaveAs: function(fileName, csvData) {
    var bw = this.browser();
    if(!bw['edge'] || !bw['ie']) {
      var alink = document.createElement("a");
      alink.id = "linkDwnldLink";
      alink.href = this.getDownloadUrl(csvData);
      document.body.appendChild(alink);
      var linkDom = document.getElementById('linkDwnldLink');
      linkDom.setAttribute('download', fileName);
      linkDom.click();
      document.body.removeChild(linkDom);
    }
    else if(bw['ie'] >= 10 || bw['edge'] == 'edge') {
      var _utf = "\uFEFF";
      var _csvData = new Blob([_utf + csvData], {
          type: 'text/csv'
      });
      navigator.msSaveBlob(_csvData, fileName);
    }
    else {
      var oWin = window.top.open("about:blank", "_blank");
      oWin.document.write('sep=,\r\n' + csvData);
      oWin.document.close();
      oWin.document.execCommand('SaveAs', true, fileName);
      oWin.close();
    }
  },
  getDownloadUrl: function(csvData) {
    var _utf = "\uFEFF"; // 为了使Excel以utf-8的编码模式，同时也是解决中文乱码的问题
    if (window.Blob && window.URL && window.URL.createObjectURL) {
        var csvData = new Blob([_utf + csvData], {
            type: 'text/csv'
        });
        return URL.createObjectURL(csvData);
    }
    // return 'data:attachment/csv;charset=utf-8,' + _utf + encodeURIComponent(csvData);
  },
  browser: function() {
    var Sys = {};
    var ua = navigator.userAgent.toLowerCase();
    var s;
    (s = ua.indexOf('edge') !== - 1 ? Sys.edge = 'edge' : ua.match(/rv:([\d.]+)\) like gecko/)) ? Sys.ie = s[1]:
        (s = ua.match(/msie ([\d.]+)/)) ? Sys.ie = s[1] :
        (s = ua.match(/firefox\/([\d.]+)/)) ? Sys.firefox = s[1] :
        (s = ua.match(/chrome\/([\d.]+)/)) ? Sys.chrome = s[1] :
        (s = ua.match(/opera.([\d.]+)/)) ? Sys.opera = s[1] :
        (s = ua.match(/version\/([\d.]+).*safari/)) ? Sys.safari = s[1] : 0;
    return Sys;
  }
};
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY29yZS9CdWZmZXJOb2RlLmpzIiwic3JjL2NvcmUvQnVmZmVyWm9uZS5qcyIsInNyYy9jb3JlL0NvbE1vZGVsLmpzIiwic3JjL2NvcmUvR3JpZFN0b3JlLmpzIiwic3JjL2NvcmUvR3JpZFZpZXcuanMiLCJzcmMvY29yZS9IZWFkZXIuanMiLCJzcmMvY29yZS9Mb2NrQ29sTWFuYWdlci5qcyIsInNyYy9jb3JlL1Njcm9sbGVyLmpzIiwic3JjL2V4dGVuZHMvQ29udGV4dG1lbnUuanMiLCJzcmMvZXh0ZW5kcy9TZWxlY3Rpb24uanMiLCJzcmMvaW5kZXguanMiLCJzcmMvcGx1Z2luL01lbnUuanMiLCJzcmMvdXRpbC9ERC5qcyIsInNyYy91dGlsL0V2ZW50RW1pdHRlci5qcyIsInNyYy91dGlsL0ZpbmRJbmRleC5qcyIsInNyYy91dGlsL1V0aWxzLmpzIiwic3JjL3V0aWwvZXhwb3Rlci9DU1YuanMiLCJzcmMvdXRpbC91dGlscy9Db21wYXJlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN0TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUMxUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUMxSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3pMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQy9QQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMxR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDakpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDM0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeldBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsInZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ2pRdWVyeSddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnalF1ZXJ5J10gOiBudWxsKTtcclxudmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJy4uL3V0aWwvRXZlbnRFbWl0dGVyJyk7XHJcblxyXG52YXIgZGVmaW5lRGVsbCA9IGZ1bmN0aW9uKGNvbE0pIHtcclxuXHRsZXQgY2VsbCA9ICQoJzxsaS8+JylcclxuXHRcdC5hZGRDbGFzcygnYy1ncmlkLWNlbGwnKVxyXG5cdFx0LmFkZENsYXNzKCdjLWFsaWduLScgKyBjb2xNLmFsaWduKVxyXG5cdFx0LmFkZENsYXNzKCgpID0+IGNvbE0uaGlkZGVuID8gJ2MtY29sdW1uLWhpZGUnIDogJycpXHJcblx0XHQuYWRkQ2xhc3MoKCkgPT4gY29sTS5sb2NrZWQgPyAnYy1jb2x1bW4tbG9ja2VkJyA6ICcnKVxyXG5cdFx0LmF0dHIoJ3RhYmluZGV4JywgLTEpXHJcblx0XHQuZGF0YSh7ICdkYXRhSW5kZXgnOiBjb2xNLmRhdGFJbmRleCwgJ2NpZCc6IGNvbE0uY2lkIH0pXHJcblx0XHQud2lkdGgoY29sTS53aWR0aCk7XHJcblxyXG5cdHJldHVybiBjZWxsO1xyXG59O1xyXG5cclxudmFyIGNyZWF0ZUNlbGwgPSBmdW5jdGlvbigkcm93LCBjb2xzTW9kZWwpIHtcclxuXHR2YXIgc2l6ZSA9IGNvbHNNb2RlbC5zaXplKCk7XHJcblx0dmFyIGNoaWxkcmVuID0gbmV3IE1hcCgpO1xyXG5cclxuXHRjb2xzTW9kZWwuZWFjaChjb2xNID0+IHtcclxuXHRcdGxldCBjZWxsID0gZGVmaW5lRGVsbChjb2xNKTtcclxuXHJcblx0XHQkcm93LmFwcGVuZChjZWxsKTtcclxuXHRcdGNoaWxkcmVuLnNldChjb2xNLCBjZWxsKTtcclxuXHR9KTtcclxuXHJcblx0cmV0dXJuIGNoaWxkcmVuO1xyXG59O1xyXG5cclxuY2xhc3MgUm93Tm9kZSBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblx0Y29uc3RydWN0b3IoY29sc01vZGVsLCBjb250ZXh0KSB7XHJcblx0XHRzdXBlcigpO1xyXG5cdFx0dGhpcy4kdm0gPSBjb250ZXh0O1xyXG5cdFx0dGhpcy5jb2xzTW9kZWwgPSBjb2xzTW9kZWw7XHJcblx0XHR0aGlzLiRub2RlID0gJCgnPHVsLz4nKS5hZGRDbGFzcygnYy1ncmlkLXJvdycpO1xyXG5cclxuXHRcdHRoaXMuY2hpbGRyZW4gPSBjcmVhdGVDZWxsKHRoaXMuJG5vZGUsIGNvbHNNb2RlbCk7XHJcblx0XHR0aGlzLl9iaW5kRXZlbnQoY29sc01vZGVsKTtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoY29sc01vZGVsKSB7XHJcblx0XHR0aGlzLmNvbHNNb2RlbC5vbignY29sdW1uLWFkZCcsIGNvbE0gPT4ge1xyXG5cdFx0XHRsZXQgY2VsbCA9IGRlZmluZURlbGwoY29sTSk7XHJcblxyXG5cdFx0XHR0aGlzLiRub2RlLmFwcGVuZChjZWxsKTtcclxuXHRcdFx0dGhpcy5jaGlsZHJlbi5zZXQoY29sTSwgY2VsbCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5vbignY29sdW1uLW1vdmVkJywgKGNvbE0sIGZvcm1JbmRleCwgdG9JbmRleCkgPT4ge1xyXG5cdFx0XHRsZXQgY2VsbCA9IHRoaXMuY2hpbGRyZW4uZ2V0KGNvbE0pO1xyXG5cdFx0XHRjZWxsLmluc2VydEFmdGVyKHRoaXMuJG5vZGUuZmluZCgnbGkuYy1ncmlkLWNlbGwnKS5lcSh0b0luZGV4KSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRjb2xzTW9kZWwuZWFjaChjb2xNID0+IHtcclxuXHRcdFx0Y29sTS5vbignY29sdW1uLXJlc2l6ZWQnLCB3aWR0aCA9PiB7XHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2cod2lkdGgpO1xyXG5cdFx0XHRcdHRoaXMuY2hpbGRyZW4uZ2V0KGNvbE0pLm91dGVyV2lkdGgod2lkdGgpO1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1oaWRkZW4nLCBpc0hpZGRlbiA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY2hpbGRyZW4uZ2V0KGNvbE0pO1xyXG5cdFx0XHRcdGlmIChpc0hpZGRlbikge1xyXG5cdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKCdjLWNvbHVtbi1oaWRlJyk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcygnYy1jb2x1bW4taGlkZScpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tbG9ja2VkJywgaXNMb2NrZWQgPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNoaWxkcmVuLmdldChjb2xNKTtcclxuXHJcblx0XHRcdFx0aWYgKGlzTG9ja2VkKSB7XHJcblx0XHRcdFx0XHRjb2xFbGUuYWRkQ2xhc3MoJ2MtY29sdW1uLWxvY2tlZCcpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoJ2MtY29sdW1uLWxvY2tlZCcpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdkZXN0b3J5JywgKCkgPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNoaWxkcmVuLmdldChjb2xNKTtcclxuXHRcdFx0XHR0aGlzLmNoaWxkcmVuLmRlbGV0ZShjb2xNKTtcdFx0XHRcclxuXHRcdFx0XHRjb2xFbGUucmVtb3ZlKCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRzZXREYXRhKHJvdywgb2Zmc2V0VG9wKSB7XHJcblx0XHQvLyDov5nph4zlpoLmnpznlKhBT1DmlrnlvI/lrp7njrDmm7Tlpb1UT0RPXHJcblx0XHR0aGlzLiR2bS5maXJlKCdyb3ctdXBkYXRlLWJlZm9yZScsIHRoaXMsIHJvdyk7XHJcblxyXG5cdFx0dmFyIGNvbnRlbnQ7XHJcblx0XHR2YXIgY2VsbHMgPSB0aGlzLmNoaWxkcmVuO1xyXG5cclxuXHRcdHRoaXMuY29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblxyXG5cdFx0XHRjb250ZW50ID0gY29sTS5yZW5kZXJlcihyb3cuZGF0YVtjb2xNLmRhdGFJbmRleF0pO1xyXG5cdFx0XHQvLyBUT0RPIGFkZENsYXNzKCgpPT4gcm93LmNlbGxbY29sTS5kYXRhSW5kZXhdLnNlbGVjdGVkKVxyXG5cdFx0XHRjZWxscy5nZXQoY29sTSkuaHRtbChjb250ZW50KTtcclxuXHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLiRub2RlLmNzcygndG9wJywgb2Zmc2V0VG9wKS5hdHRyKCdyaWQnLCByb3cucmlkKTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcy4kbm9kZTtcclxuXHR9XHJcbn1cclxuXHJcbmNsYXNzIEJ1ZmZlck5vZGUgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cdGNvbnN0cnVjdG9yKGxpbWl0LCBjb2xzTW9kZWwsIHRvdGFsLCBjYWNoZVRpbWVzKSB7XHJcblx0XHRzdXBlcigpO1xyXG5cdFx0dGhpcy5pbml0KGxpbWl0LCBjb2xzTW9kZWwsIHRvdGFsLCBjYWNoZVRpbWVzKTtcclxuXHR9XHJcblxyXG5cdGluaXQobGltaXQsIGNvbHNNb2RlbCwgdG90YWwsIGNhY2hlVGltZXMpIHtcclxuXHRcdHRoaXMubGltaXQgPSBsaW1pdDtcclxuXHRcdHRoaXMudG90YWwgPSB0b3RhbDtcclxuXHRcdHRoaXMuY2FjaGVUaW1lcyA9IGNhY2hlVGltZXMgfHwgMztcclxuXHRcdHRoaXMubm9kZUxpc3QgPSBbXTtcclxuXHRcdHRoaXMuY29sc01vZGVsID0gY29sc01vZGVsO1xyXG5cclxuXHRcdC8vIOi/memHjOaaguS4ulNlbGVjdGlvbuWunueOsO+8jOW6lOivpeeUqEFPUOe7tOaKpCBUT0RPXHJcblx0XHQvLyB0aGlzLm9uKCdyb3ctdXBkYXRlLWJlZm9yZScsIChyb3dOb2RlLCByb3cpID0+IHRoaXMuZmlyZSgncm93LXVwZGF0ZScsIHJvd05vZGUsIHJvdykpO1xyXG5cdH1cclxuXHJcblx0Z2V0Tm9kZUxpc3QoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5ub2RlTGlzdDtcclxuXHR9XHJcblxyXG5cdHNldExpbWl0KGxpbWl0KSB7XHJcblx0XHRpZiAoK2xpbWl0ID4gMCkge1xyXG5cdFx0XHR0aGlzLmluaXQobGltaXQsIHRoaXMuY29sc01vZGVsLCB0aGlzLnRvdGFsLCB0aGlzLmNhY2hlVGltZXMpO1xyXG5cdFx0XHR0aGlzLmZpcmUoJ2J1ZmZlci1pbml0aWFsJyk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRzZXRUb3RhbCh0b3RhbCkge1xyXG5cdFx0aWYgKCt0b3RhbCA+PSAwKSB7XHJcblx0XHRcdHRoaXMudG90YWwgPSB0b3RhbDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlzRW5vdWdoKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMubm9kZUxpc3QubGVuZ3RoID49IE1hdGgubWluKHRoaXMudG90YWwsIHRoaXMuY2FjaGVUaW1lcyAqIHRoaXMubGltaXQpO1xyXG5cdH1cclxuXHJcblx0Z2V0KGRpciwgZG9tYWluKSB7XHJcblx0XHRpZiAodGhpcy5pc0Vub3VnaCgpKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLl9nZXROb2RlcyhkaXIsIGRvbWFpbik7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuX2FkZE5vZGVzKGRpciwgZG9tYWluKTtcclxuXHR9XHJcblxyXG5cdF9nZXROb2RlcyhkaXIsIFtzdGFydCwgZW5kXSkge1xyXG5cdFx0dmFyIHNlbGVjdGVkO1xyXG5cclxuXHRcdGlmIChkaXIgPiAwKSB7XHJcblx0XHRcdHNlbGVjdGVkID0gdGhpcy5ub2RlTGlzdC5zbGljZSgwLCBlbmQgLSBzdGFydCArIDEpO1xyXG5cdFx0XHR0aGlzLm5vZGVMaXN0ID0gdGhpcy5ub2RlTGlzdC5zbGljZShlbmQgLSBzdGFydCArIDEpLmNvbmNhdChzZWxlY3RlZCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRzZWxlY3RlZCA9IHRoaXMubm9kZUxpc3Quc2xpY2Uoc3RhcnQgLSBlbmQgLSAxKTtcclxuXHRcdFx0dGhpcy5ub2RlTGlzdCA9IHNlbGVjdGVkLmNvbmNhdCh0aGlzLm5vZGVMaXN0LnNsaWNlKDAsIHN0YXJ0IC0gZW5kIC0gMSkpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBzZWxlY3RlZCB8fCBbXTtcclxuXHR9XHJcblxyXG5cdF9hZGROb2RlcyhkaXIsIFtzdGFydCwgZW5kXSkge1xyXG5cdFx0dmFyIG5vZGVzID0gW107XHJcblxyXG5cdFx0Zm9yICh2YXIgaSA9IHN0YXJ0OyBpIDw9IGVuZDsgaSsrKSB7XHJcblx0XHRcdG5vZGVzLnB1c2gobmV3IFJvd05vZGUodGhpcy5jb2xzTW9kZWwsIHRoaXMpKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLm5vZGVMaXN0ID0gZGlyID4gMCA/IHRoaXMubm9kZUxpc3QuY29uY2F0KG5vZGVzKSA6IG5vZGVzLmNvbmNhdCh0aGlzLm5vZGVMaXN0KTtcclxuXHJcblx0XHRyZXR1cm4gbm9kZXM7XHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEJ1ZmZlck5vZGU7XHJcbiIsImNsYXNzIEJ1ZmZlclpvbmUge1xyXG5cdGNvbnN0cnVjdG9yKGxpbWl0LCB0b3RhbCwgY2FjaGVUaW1lcykge1xyXG5cdFx0dGhpcy5pbml0KGxpbWl0LCB0b3RhbCwgY2FjaGVUaW1lcyk7XHJcblx0fVxyXG5cclxuXHRpbml0KGxpbWl0LCB0b3RhbCwgY2FjaGVUaW1lcykge1xyXG5cdFx0dGhpcy5zdGFydCA9IDA7XHJcblx0XHR0aGlzLmVuZCA9IHRoaXMubGltaXQgPSBsaW1pdDtcclxuXHRcdHRoaXMudG90YWwgPSArdG90YWw7XHJcblx0XHR0aGlzLmNhY2hlVGltZXMgPSBjYWNoZVRpbWVzIHx8IDM7XHJcblx0XHR0aGlzLmRvbWFpbiA9IFt0aGlzLnN0YXJ0LCB0aGlzLmVuZF07XHJcblx0fVxyXG5cclxuXHRzZXRMaW1pdChsaW1pdCkge1xyXG5cdFx0aWYgKCtsaW1pdCA+IDApIHtcclxuXHRcdFx0dGhpcy5pbml0KGxpbWl0LCB0aGlzLnRvdGFsKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHNldFRvdGFsKHRvdGFsKSB7XHJcblx0XHRpZiAoK3RvdGFsID49IDApIHtcclxuXHRcdFx0dGhpcy50b3RhbCA9IHRvdGFsO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0aXNBbW9uZyh2YWx1ZSkge1xyXG5cdFx0cmV0dXJuIHRoaXMuc3RhcnQgPD0gdmFsdWUgJiYgdmFsdWUgPD0gdGhpcy5lbmQ7XHJcblx0fVxyXG5cclxuXHRzaG91bGRMb2FkKGRpciwgdmVybmllcikge1xyXG5cdFx0aWYgKGRpciA9PT0gMCkgcmV0dXJuIGZhbHNlO1xyXG5cclxuXHRcdHZhciBzdGFydCA9IHRoaXMuc3RhcnQ7XHJcblx0XHR2YXIgZW5kID0gdGhpcy5lbmQ7XHJcblx0XHR2YXIgY2FjaGVUaW1lcyA9IHRoaXMuY2FjaGVUaW1lcztcclxuXHJcblx0XHQvLyBzY3JvbGwgdXBcclxuXHRcdGlmIChkaXIgPCAwICYmIHN0YXJ0ID09PSAwKSByZXR1cm4gZmFsc2U7XHJcblx0XHRpZiAoZGlyIDwgMCAmJiB2ZXJuaWVyIDwgc3RhcnQgKyB0aGlzLmxpbWl0KSB7XHJcblx0XHRcdGlmICh0aGlzLmlzQW1vbmcodmVybmllcikpIHtcclxuXHRcdFx0XHRlbmQgPSBzdGFydCAtIDE7XHJcblx0XHRcdFx0c3RhcnQgPSBNYXRoLm1heCgwLCBlbmQgLSB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fSBlbHNlIGlmICh2ZXJuaWVyID09PSAwKSB7XHJcblx0XHRcdFx0ZW5kID0gTWF0aC5taW4odGhpcy50b3RhbCwgdmVybmllciArIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0XHRzdGFydCA9IDA7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0ZW5kID0gdmVybmllciArIHRoaXMubGltaXQ7XHJcblx0XHRcdFx0c3RhcnQgPSBNYXRoLm1heCgwLCB2ZXJuaWVyIC0gKGNhY2hlVGltZXMgLSAxKSAqIHRoaXMubGltaXQpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLmRvbWFpbiA9IFtzdGFydCwgZW5kXTtcclxuXHRcdFx0dGhpcy5zdGFydCA9IHN0YXJ0O1xyXG5cdFx0XHR0aGlzLmVuZCA9IE1hdGgubWluKHN0YXJ0ICsgY2FjaGVUaW1lcyAqIHRoaXMubGltaXQsIHRoaXMuZW5kKTtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gc2Nyb2xsIGRvd25cclxuXHRcdGlmIChkaXIgPiAwICYmIGVuZCA9PT0gdGhpcy50b3RhbCkgcmV0dXJuIGZhbHNlO1xyXG5cdFx0aWYgKGRpciA+IDAgJiYgdmVybmllciA+IGVuZCAtIHRoaXMubGltaXQpIHtcclxuXHRcdFx0Ly8g5ri45qCH5Zyo546w5pyJ6IyD5Zu05YaFXHJcblx0XHRcdGlmICh0aGlzLmlzQW1vbmcodmVybmllcikpIHtcclxuXHRcdFx0XHRzdGFydCA9IGVuZCArIDE7XHJcblx0XHRcdFx0ZW5kID0gTWF0aC5taW4odGhpcy50b3RhbCwgc3RhcnQgKyB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvLyDmuLjmoIfliLDovr7nu5PlsL5cclxuXHRcdFx0ZWxzZSBpZiAodmVybmllciA9PT0gdGhpcy50b3RhbCkge1xyXG5cdFx0XHRcdGVuZCA9IHRoaXMudG90YWw7XHJcblx0XHRcdFx0c3RhcnQgPSBNYXRoLm1heCgwLCB2ZXJuaWVyIC0gY2FjaGVUaW1lcyAqIHRoaXMubGltaXQpO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIOS4jeWcqOeOsOacieiMg+WbtOWPiOacquWIsOe7k+WwvuWkhFxyXG5cdFx0XHRlbHNlIHtcclxuXHRcdFx0XHRlbmQgPSBNYXRoLm1pbih0aGlzLnRvdGFsLCB2ZXJuaWVyICsgKGNhY2hlVGltZXMgLSAxKSAqIHRoaXMubGltaXQpO1xyXG5cdFx0XHRcdHN0YXJ0ID0gTWF0aC5tYXgoMCwgZW5kIC0gY2FjaGVUaW1lcyAqIHRoaXMubGltaXQpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLmRvbWFpbiA9IFtzdGFydCwgZW5kXTtcclxuXHRcdFx0dGhpcy5lbmQgPSBlbmQ7XHJcblx0XHRcdHRoaXMuc3RhcnQgPSBNYXRoLm1heCh0aGlzLnN0YXJ0LCBlbmQgLSBjYWNoZVRpbWVzICogdGhpcy5saW1pdCk7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEJ1ZmZlclpvbmU7IiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJy4uL3V0aWwvRXZlbnRFbWl0dGVyJyk7XHJcbnZhciBVdGlscyA9IHJlcXVpcmUoJy4uL3V0aWwvVXRpbHMnKTtcclxudmFyIF8gPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snXyddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnXyddIDogbnVsbCk7XHJcblxyXG52YXIgZGVmUmVuZGVyZXIgPSB2ID0+IHY7XHJcbnZhciBPUkRFUiA9IFsnQVNDJywgJ0RFU0MnXTtcclxuXHJcbmNsYXNzIENvbHVtbiBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblx0Y29uc3RydWN0b3IoY2lkLCBvcHRpb25zLCBjb250ZXh0KSB7XHJcblx0XHRzdXBlcigpO1xyXG5cclxuXHRcdG9wdGlvbnMucmVuZGVyZXIgPSBvcHRpb25zLnJlbmRlcmVyIHx8IGRlZlJlbmRlcmVyO1xyXG5cclxuXHRcdHZhciBkZWZhdWx0cyA9IHtcclxuXHRcdFx0J3RleHQnOiAnJyxcclxuXHRcdFx0J3Z0eXBlJzogJ3N0cmluZycsXHJcblx0XHRcdCdkYXRhSW5kZXgnOiAnJyxcclxuXHRcdFx0J3dpZHRoJzogNTAsXHJcblx0XHRcdCdhbGlnbic6ICdsZWZ0JyxcclxuXHJcblx0XHRcdCdyZXNpemFibGUnOiB0cnVlLFxyXG5cdFx0XHQnY2xzJzogJycsXHJcblx0XHRcdCdmaXhlZCc6IGZhbHNlLFxyXG5cdFx0XHQnZHJhZ2dhYmxlJzogZmFsc2UsXHJcblx0XHRcdCdzb3J0YWJsZSc6IHRydWUsXHJcblx0XHRcdCdoaWRkZW4nOiBmYWxzZSxcclxuXHRcdFx0J2xvY2tlZCc6IGZhbHNlLFxyXG5cdFx0XHQnbG9ja2FibGUnOiB0cnVlLFxyXG5cdFx0XHQnbWVudURpc2FibGVkJzogdHJ1ZSxcclxuXHJcblx0XHRcdC8vIHByaXZhdGVcclxuXHRcdFx0J3NvcnRTdGF0ZSc6IG51bGxcclxuXHRcdH07XHJcblxyXG5cdFx0dGhpcy5jaWQgPSBjaWQ7XHJcblx0XHR0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xyXG5cdFx0T2JqZWN0LmFzc2lnbih0aGlzLCBkZWZhdWx0cywgb3B0aW9ucyk7XHJcblx0fVxyXG5cclxuXHRzZXRUZXh0KHRleHQpIHtcclxuXHRcdGlmICh0eXBlb2YgdGV4dCAhPSAnc3RyaW5nJykgcmV0dXJuO1xyXG5cclxuXHRcdHRoaXMudGV4dCA9IHRleHQ7XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi10ZXh0ZWQnLCB0aGlzLnRleHQsIHRoaXMpO1xyXG5cdH1cclxuXHJcblx0c2V0V2lkdGgobnVtKSB7XHJcblx0XHRpZiAoIXRoaXMucmVzaXphYmxlKSByZXR1cm47XHJcblx0XHRpZiAoaXNOYU4obnVtKSkgcmV0dXJuO1xyXG5cclxuXHRcdHRoaXMud2lkdGggPSArbnVtO1xyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4tcmVzaXplZCcsIHRoaXMud2lkdGgsIHRoaXMpO1xyXG5cdH1cclxuXHJcblx0c2hvdygpIHtcclxuXHRcdHRoaXMuaGlkZGVuID0gZmFsc2U7XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1oaWRkZW4nLCB0aGlzLmhpZGRlbiwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHRoaWRlKCkge1xyXG5cdFx0dGhpcy51bkxvY2soKTtcclxuXHRcdFxyXG5cdFx0dGhpcy5oaWRkZW4gPSB0cnVlO1xyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4taGlkZGVuJywgdGhpcy5oaWRkZW4sIHRoaXMpO1xyXG5cdH1cclxuXHJcblx0dG9nZ2xlKCkge1xyXG5cdFx0aWYgKHRoaXMuaGlkZGVuKSB7XHJcblx0XHRcdHRoaXMuc2hvdygpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhpcy5oaWRlKCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRsb2NrKCkge1xyXG5cdFx0aWYgKCF0aGlzLmxvY2thYmxlKSByZXR1cm47XHJcblx0XHRpZiAodGhpcy5sb2NrZWQpIHJldHVybjtcclxuXHJcblx0XHR0aGlzLnNob3coKTtcclxuXHJcblx0XHR0aGlzLmxvY2tlZCA9IHRydWU7XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1sb2NrZWQnLCB0aGlzLmxvY2tlZCwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHR1bkxvY2soKSB7XHJcblx0XHRpZiAoIXRoaXMubG9ja2FibGUpIHJldHVybjtcclxuXHRcdGlmICghdGhpcy5sb2NrZWQpIHJldHVybjtcclxuXHJcblx0XHR0aGlzLmxvY2tlZCA9IGZhbHNlO1xyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4tbG9ja2VkJywgdGhpcy5sb2NrZWQsIHRoaXMpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogb3JkZXJbQVNDLCBERVNDLCBOT19TT1JUXVxyXG5cdCAqL1xyXG5cdHNvcnQob3JkZXIpIHtcclxuXHRcdGlmICghdGhpcy5zb3J0YWJsZSB8fCAhdGhpcy5kYXRhSW5kZXgpIHJldHVybjtcclxuXHJcblx0XHRpZiAob3JkZXIpIHtcclxuXHRcdFx0dGhpcy5zb3J0U3RhdGUgPSBPUkRFUi5pbmNsdWRlcyhvcmRlcikgPyBvcmRlciA6IG51bGw7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aGlzLnNvcnRTdGF0ZSA9IHRoaXMuc29ydFN0YXRlID09PSBPUkRFUlsxXSA/IE9SREVSWzBdIDogT1JERVJbMV07XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLXNvcnQtY2hhbmdlZCcsIHRoaXMuc29ydFN0YXRlKTtcclxuXHRcdHRoaXMuY29udGV4dC5maXJlKCdub3RpY2UtY29sTW9kZWwtc29ydC1jaGFuZ2VkJyk7XHJcbiBcdH1cclxuXHJcbiBcdG1vdmVUbyhpbmRleCkge1xyXG4gXHRcdGlmIChpc05hTigraW5kZXgpKSByZXR1cm47XHJcblxyXG4gXHRcdC8vIHRoaXMuY29udGV4dC5maXJlKCdjb2x1bW4tbW92ZS10bycsIHRoaXMsICtpbmRleCk7XHJcbiBcdFx0dGhpcy5jb250ZXh0Lm1vdmUodGhpcywgK2luZGV4KTtcclxuIFx0fVxyXG5cclxuIFx0cmVtb3ZlKCkge1xyXG4gXHRcdHRoaXMuZmlyZSgnZGVzdG9yeScpO1xyXG4gXHRcdHRoaXMuY29udGV4dC5maXJlKCdjb2x1bW4tcmVtb3ZlZCcsIHRoaXMpO1xyXG4gXHRcdHRoaXMucmVtb3ZlRXZlbnQoKTtcclxuIFx0fVxyXG59XHJcblxyXG5cclxuY2xhc3MgQ29sTW9kZWwgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cdGNvbnN0cnVjdG9yKGNvbHVtbnMpIHtcclxuXHRcdHN1cGVyKCk7XHJcblxyXG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KGNvbHVtbnMpKSB7XHJcblx0XHRcdHRocm93ICdyZXF1aXJlIHByb3BlcnR5IGNvbHVtbnMgaXMgYSBhcnJheSBvYmplY3QnO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuY29sdW1ucyA9IFtdOyAvLyBkYXRhIGJ5IGNvbHVtblxyXG5cdFx0dGhpcy5jb2xNb2RlbCA9IG5ldyBNYXAoKTsgLy8gZGF0YSBieSBjaWRcclxuXHRcdHRoaXMuY29sSGVhZGVycyA9IG5ldyBNYXAoKTsgLy8gZGF0YSBieSBkYXRhSW5kZXhcclxuXHJcblx0XHR0aGlzLl9pbml0Q29sdW1uKGNvbHVtbnMpO1xyXG5cdFx0dGhpcy5fYmluZEV2ZW50KCk7XHJcblx0fVxyXG5cclxuXHRfaW5pdENvbHVtbihjb2x1bW5zLCBjYWxsYmFjaykge1xyXG5cdFx0bGV0IHNpemUgPSB0aGlzLnNpemUoKTtcclxuXHJcblx0XHRjb2x1bW5zLmZvckVhY2goKGNvbCwgaW5kZXgpID0+IHtcclxuXHRcdFx0Ly8gY2lk6Kej5Yaz5rKh5pyJZGF0YUluZGV45YiX5oiW55u45ZCMZGF0YUluZGV45YiX55qE6Zeu6aKYXHJcblx0XHRcdGxldCBjaWQgPSBpbmRleCArIHNpemU7XHJcblx0XHRcdGxldCBjb2xNID0gbmV3IENvbHVtbihjaWQsIGNvbCwgdGhpcyk7XHJcblxyXG5cdFx0XHR0aGlzLmNvbE1vZGVsLnNldChjaWQsIGNvbE0pO1xyXG5cdFx0XHR0aGlzLmNvbHVtbnMucHVzaChjb2xNKTtcclxuXHRcdFx0dGhpcy5jb2xIZWFkZXJzLnNldChjb2wuZGF0YUluZGV4LCBjb2xNKTtcclxuXHJcblx0XHRcdGNhbGxiYWNrICYmIGNhbGxiYWNrKGNvbE0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRhZGRDb2x1bW5zKGNvbHVtbnMpIHtcclxuXHRcdGlmICghQXJyYXkuaXNBcnJheShjb2x1bW5zKSkge1xyXG5cdFx0XHRjb2x1bW5zID0gW2NvbHVtbnNdO1xyXG5cdFx0fVxyXG5cdFx0dGhpcy5faW5pdENvbHVtbihjb2x1bW5zLCBjb2xNID0+IHRoaXMuZmlyZSgnY29sdW1uLWFkZCcsIGNvbE0pKTtcclxuXHR9XHJcblxyXG5cdHJlbW92ZUNvbHVtbihkYXRhSW5kZXgpIHtcclxuXHRcdGlmICghQXJyYXkuaXNBcnJheShkYXRhSW5kZXgpKSB7XHJcblx0XHRcdGRhdGFJbmRleCA9IFtkYXRhSW5kZXhdO1xyXG5cdFx0fVxyXG5cclxuXHRcdGRhdGFJbmRleC5mb3JFYWNoKGRzID0+IHtcclxuXHRcdFx0bGV0IGNvbE0gPSB0aGlzLmdldENvbHVtbkJ5RGF0YUluZGV4KGRzKTtcclxuXHJcblx0XHRcdGlmIChjb2xNKSB7XHJcblx0XHRcdFx0Y29sTS5yZW1vdmUoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRfYmluZEV2ZW50KCkge1xyXG5cdFx0dGhpcy5vbignbm90aWNlLWNvbE1vZGVsLXNvcnQtY2hhbmdlZCcsIF8uZGVib3VuY2UoKCkgPT4ge1xyXG5cdFx0XHR0aGlzLmZpcmUoJ2NvbHVtbnMtc29ydC1jaGFuZ2VkJyk7XHJcblx0XHR9LCAyMCkpO1xyXG5cclxuXHRcdHRoaXMub24oJ2NvbHVtbi1yZW1vdmVkJywgY29sTSA9PiB7XHJcblx0XHRcdHRoaXMuY29sdW1ucyA9IHRoaXMuY29sdW1ucy5maWx0ZXIoY29sID0+IGNvbC5kYXRhSW5kZXggIT0gY29sTS5kYXRhSW5kZXgpO1xyXG5cdFx0XHR0aGlzLmNvbE1vZGVsLmRlbGV0ZShjb2xNLmNpZCk7XHJcblx0XHRcdHRoaXMuY29sSGVhZGVycy5kZWxldGUoY29sTS5kYXRhSW5kZXgpO1xyXG5cdFx0fSk7XHJcblxyXG5cdH1cclxuXHJcblx0bW92ZShjb2xNLCB0b0luZGV4KSB7XHJcblx0XHRsZXQgY3VycmVudCA9IHRoaXMuY29sdW1ucy5pbmRleE9mKGNvbE0pO1xyXG5cclxuXHRcdC8vIFRPRE9cclxuXHRcdC8vIOWmguaenOenu+WIsOWGu+e7k+WIl+S9jee9ru+8jOmcgOWGu+e7k1xyXG5cclxuXHRcdGlmICh0b0luZGV4ID09PSBjdXJyZW50KSByZXR1cm47XHJcblxyXG5cdFx0aWYgKHRvSW5kZXggPiBjdXJyZW50KSB7XHJcblx0XHRcdC8vIOaaguaXtuWFg+e0oOmDveaYr+eUqCQoKS5hZnRlcuenu+WKqO+8jOaJgOS7peS9jee9rnRvSW5kZXggKyAxXHJcblx0XHRcdHRoaXMuY29sdW1ucy5zcGxpY2UodG9JbmRleCArIDEsIDAsIHRoaXMuY29sdW1uc1tjdXJyZW50XSk7XHJcblx0XHRcdHRoaXMuY29sdW1ucy5zcGxpY2UoY3VycmVudCwgMSk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aGlzLmNvbHVtbnMuc3BsaWNlKHRvSW5kZXggKyAxLCAwLCB0aGlzLmNvbHVtbnNbY3VycmVudF0pO1xyXG5cdFx0XHR0aGlzLmNvbHVtbnMuc3BsaWNlKCsrY3VycmVudCwgMSk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4tbW92ZWQnLCBjb2xNLCBjdXJyZW50LCB0b0luZGV4KTtcclxuXHR9XHJcblxyXG5cdHNpemUoKSB7IFxyXG5cdFx0cmV0dXJuIHRoaXMuY29sTW9kZWwuc2l6ZTsgXHJcblx0fVxyXG5cclxuXHRnZXRDb2x1bW4oY29sKSB7XHJcblx0XHRpZiAodGhpcy5jb2x1bW5zLmluY2x1ZGVzKGNvbCkpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuY29sdW1ucy5maWx0ZXIoX2NvbCA9PiBfY29sID09IGNvbClbMF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuY29sdW1ucztcclxuXHR9XHJcblxyXG5cdGdldExvY2tDb2x1bW4oKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5jb2x1bW5zLmZpbHRlcihjb2xNID0+IHtcclxuXHRcdFx0cmV0dXJuIGNvbE0ubG9ja2VkID09PSB0cnVlO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRnZXRWaXNpYmxlQ29sdW1uKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuY29sdW1ucy5maWx0ZXIoY29sTSA9PiB7XHJcblx0XHRcdHJldHVybiAhY29sTS5oaWRkZW47XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGdldENvbHVtbkJ5RGF0YUluZGV4KGRhdGFJbmRleCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuY29sSGVhZGVycy5nZXQoZGF0YUluZGV4KSB8fCBudWxsO1xyXG5cdH1cclxuXHJcblx0Z2V0Q29sdW1uc0J5SWQoaWQpIHtcclxuXHRcdHJldHVybiB0aGlzLmNvbE1vZGVsLmdldChpZCkgfHwgbnVsbDtcclxuXHR9XHJcblxyXG5cdGVhY2goY2FsbGJhY2ssIGNvbnRleHQpIHtcclxuXHRcdHRoaXMuY29sdW1ucy5mb3JFYWNoKGNhbGxiYWNrLCBjb250ZXh0IHx8IHRoaXMpO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHsgXHJcblxyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDb2xNb2RlbDsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi4vdXRpbC9FdmVudEVtaXR0ZXInKTtcclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbC9VdGlscycpO1xyXG52YXIgXyA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydfJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWydfJ10gOiBudWxsKTtcclxuXHJcbmNsYXNzIFJvdyB7XHJcblx0Y29uc3RydWN0b3IocmlkLCBkYXRhKSB7XHJcblx0XHR0aGlzLnJpZCA9IHJpZDtcclxuXHRcdHRoaXMuZGF0YSA9IGRhdGE7XHJcblx0XHR0aGlzLnNlbGVjdGVkID0gZmFsc2U7XHJcblx0fVxyXG5cdHN0YXRlKCkge31cclxufVxyXG5cclxuY2xhc3MgR3JpZFN0b3JlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHJcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xyXG5cdFx0c3VwZXIoKTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbCA9IG9wdGlvbnMuY29sdW1uTW9kZWw7XHJcblxyXG5cdFx0dGhpcy5yb3dzID0gW107IC8vIGRhdGEgYnkgaW5kZXhcclxuXHRcdHRoaXMucm93TW9kZWwgPSBuZXcgTWFwKCk7IC8vIGRhdGEgYnkgaWRcclxuXHJcblxyXG5cdFx0dGhpcy5zZXREYXRhKG9wdGlvbnMuZGF0YSk7XHJcblxyXG5cdFx0dGhpcy5fc29ydFN0YXRlID0geyBrZXlzOiBbXSwgZGlyczogW10gfTtcclxuXHRcdHRoaXMuX2JpbmRFdmVudCgpO1xyXG5cdH1cclxuXHJcblx0X2JpbmRFdmVudCgpIHtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tc29ydC1jaGFuZ2VkJywgc29ydFN0YXRlID0+IHtcclxuXHRcdFx0XHRsZXQgeyBrZXlzLCBkaXJzIH0gPSB0aGlzLl9zb3J0U3RhdGU7XHJcblx0XHRcdFx0bGV0IGluZGV4ID0ga2V5cy5pbmRleE9mKGNvbE0uZGF0YUluZGV4KTtcclxuXHJcblx0XHRcdFx0Ly8g5pyq5o6S5bqPXHJcblx0XHRcdFx0aWYgKGluZGV4ID09PSAtMSAmJiAhc29ydFN0YXRlKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoaW5kZXggPT09IC0xICYmIHNvcnRTdGF0ZSkge1xyXG5cdFx0XHRcdFx0a2V5cy51bnNoaWZ0KGNvbE0uZGF0YUluZGV4KTtcclxuXHRcdFx0XHRcdGRpcnMudW5zaGlmdChzb3J0U3RhdGUudG9Mb3dlckNhc2UoKSk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyDlt7LmjpLluo8s5YWI5Yig6ZmkXHJcblx0XHRcdFx0bGV0IGtleSA9IGtleXMuc3BsaWNlKGluZGV4LCAxKVswXTtcclxuXHRcdFx0XHRsZXQgZGlyID0gZGlycy5zcGxpY2UoaW5kZXgsIDEpWzBdO1xyXG5cclxuXHRcdFx0XHRpZiAoc29ydFN0YXRlKSB7XHJcblx0XHRcdFx0XHRrZXlzLnVuc2hpZnQoa2V5KTtcclxuXHRcdFx0XHRcdGRpcnMudW5zaGlmdChzb3J0U3RhdGUudG9Mb3dlckNhc2UoKSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHQvLyDmiYDmnInliJfpg73mm7TmlrDnirbmgIHlkI5cclxuXHRcdHRoaXMuY29sc01vZGVsLm9uKCdjb2x1bW5zLXNvcnQtY2hhbmdlZCcsICgpID0+IHtcclxuXHRcdFx0bGV0IHsga2V5cywgZGlycyB9ID0gdGhpcy5fc29ydFN0YXRlO1xyXG5cdFx0XHRsZXQgaXRlcmF0ZUZuID0gcm93ID0+IHJvdy5kYXRhW2tleXNbMF1dO1xyXG5cclxuXHRcdFx0Ly8gY29uc29sZS5sb2coa2V5cywgZGlycyk7XHJcblxyXG5cdFx0XHR0aGlzLnJvd3MgPSBfLm9yZGVyQnkodGhpcy5yb3dzLCBpdGVyYXRlRm4sIGRpcnMpO1xyXG5cdFx0XHR0aGlzLnNldERhdGEoXy5tYXAodGhpcy5yb3dzLCAnZGF0YScpKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0c2xpY2Uoc3RhcnQsIGVuZCkge1xyXG5cdFx0cmV0dXJuIHRoaXMucm93cy5zbGljZShzdGFydCwgZW5kKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIOiuvue9ruaOkuW6j+eKtuaAgVxyXG5cdCAqICgrKUFTQywgLURFU0MsICFOT19TT1JUXHJcblx0ICogQHNvcnRzIHtBcnJheX0gc29ydHMgLeaOkuW6j+eKtuaAgeaVsOe7hFxyXG5cdCAqXHRzb3J0cyA9IFsnK2NvbEEnLCAnY29sQicsICctY29sQycsICchY29sRCddXHJcblx0ICogQHJldHVybnMgdGhpcztcclxuXHQgKi9cclxuXHRzZXRTb3J0U3RhdGUoc29ydHMpIHtcclxuXHRcdGlmICghQXJyYXkuaXNBcnJheShzb3J0cykpIHtcclxuXHRcdFx0c29ydHMgPSBbc29ydHNdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX3NvcnRTdGF0ZSA9IHsga2V5czogW10sIGRpcnM6IFtdIH07XHJcblxyXG5cdFx0Ly8g5Y+N6L2s5LyY5YWI57qn5pa55L6/5ZCO57ut6Kem5Y+R6aG65bqP5pe25ZCO6Kem5Y+R55qE5LyY5YWI57qn6auYXHJcblx0XHRzb3J0cy5yZXZlcnNlKCkuZWFjaChzb3J0T2JqID0+IHtcclxuXHRcdFx0bGV0IG9iaiwga2V5LCBkaXIsIGNvbDtcclxuXHJcblx0XHRcdGlmICh0eXBlb2Ygc29ydE9iaiA9PT0gJ3N0cmluZycpIHtcclxuXHRcdFx0XHRvYmogPSBzb3J0T2JqLm1hdGNoKC8oXlsrfC18IV0/KSguezAsfSkvKTtcclxuXHRcdFx0XHRkaXIgPSBvYmpbMV0gPT09ICcnID8gJ0FTQycgOiAob2JqID09PSAnLScgPyAnREVTQycgOiAnTk9fU09SVCcpO1xyXG5cdFx0XHRcdGtleSA9IG9ialsyXSA/IG9ialsyXSA6IG51bGw7XHJcblxyXG5cdFx0XHRcdGNvbCA9IHRoaXMuY29sc01vZGVsLmdldENvbHVtbkJ5RGF0YUluZGV4KGtleSk7XHJcblx0XHRcdFx0aWYgKGNvbCkge1xyXG5cdFx0XHRcdFx0Y29sLnNvcnQoZGlyKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0c2V0RGF0YShkYXRhID0gW10sIGFwcGVuZCA9IGZhbHNlKSB7XHJcblx0XHRpZiAoIWFwcGVuZCkge1xyXG5cdFx0XHR0aGlzLnJvd3MubGVuZ3RoID0gMDtcclxuXHRcdFx0dGhpcy5yb3dNb2RlbC5jbGVhcigpO1xyXG5cdFx0fVxyXG5cdFx0dmFyIGluZGV4ID0gdGhpcy5zaXplKCk7XHJcblx0XHRkYXRhLmZvckVhY2goKHJvdywgcmlkeCkgPT4ge1xyXG5cdFx0XHRsZXQgcm93TSA9IG5ldyBSb3cocmlkeCArIGluZGV4LCByb3cpO1xyXG5cdFx0XHR0aGlzLnJvd3MucHVzaChyb3dNKTtcclxuXHRcdFx0dGhpcy5yb3dNb2RlbC5zZXQocmlkeCArIGluZGV4LCByb3dNKTtcclxuXHRcdH0pO1xyXG5cdFx0dGhpcy5maXJlKCdkYXRhLWNoYW5nZWQnLCBhcHBlbmQpO1xyXG5cdH1cclxuXHJcblx0Zm9yRWFjaChjYWxsYmFjaywgY29udGV4dCkge1xyXG5cdFx0dGhpcy5yb3dzLmZvckVhY2goZnVuY3Rpb24ocm93TSwgcmlkeCkge1xyXG5cdFx0XHRjYWxsYmFjay5jYWxsKHRoaXMsIHJvd00uZGF0YSwgcmlkeCk7XHJcblx0XHR9LCBjb250ZXh0IHx8IHRoaXMpO1xyXG5cdH1cclxuXHJcblx0c2l6ZSgpIHtcclxuXHRcdHJldHVybiB0aGlzLnJvd01vZGVsLnNpemU7XHJcblx0fVxyXG5cclxuXHRzdW0oZGF0YUluZGV4KSB7XHJcblx0XHRyZXR1cm4gXy5zdW1CeSh0aGlzLnJvd3MsIHJvdyA9PiArcm93LmRhdGFbZGF0YUluZGV4XSk7XHJcblx0fVxyXG5cclxuXHRhdmcoZGF0YUluZGV4KSB7XHJcblx0XHRyZXR1cm4gXy5tZWFuQnkodGhpcy5yb3dzLCByb3cgPT4gK3Jvdy5kYXRhW2RhdGFJbmRleF0pO1xyXG5cdH1cclxuXHJcblx0bWF4KGRhdGFJbmRleCkge1xyXG5cdFx0cmV0dXJuIF8ubWF4QnkodGhpcy5yb3dzLCByb3cgPT4gK3Jvdy5kYXRhW2RhdGFJbmRleF0pO1xyXG5cdH1cclxuXHJcblx0bWluKGRhdGFJbmRleCkge1xyXG5cdFx0cmV0dXJuIF8ubWluQnkodGhpcy5yb3dzLCByb3cgPT4gK3Jvdy5kYXRhW2RhdGFJbmRleF0pO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHsgXHJcblxyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBHcmlkU3RvcmU7IiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJy4uL3V0aWwvRXZlbnRFbWl0dGVyJyk7XHJcbnZhciBDb2xNb2RlbCA9IHJlcXVpcmUoJy4vQ29sTW9kZWwnKTtcclxudmFyIEdyaWRTdG9yZSA9IHJlcXVpcmUoJy4vR3JpZFN0b3JlJyk7XHJcbnZhciBCdWZmZXJOb2RlID0gcmVxdWlyZSgnLi9CdWZmZXJOb2RlJyk7XHJcbnZhciBCdWZmZXJab25lID0gcmVxdWlyZSgnLi9CdWZmZXJab25lJyk7XHJcbnZhciBIZWFkZXIgPSByZXF1aXJlKCcuL0hlYWRlcicpO1xyXG52YXIgTG9ja0NvbE1hbmFnZXIgPSByZXF1aXJlKCcuL0xvY2tDb2xNYW5hZ2VyJyk7XHJcbnZhciBTY3JvbGxlciA9IHJlcXVpcmUoJy4vU2Nyb2xsZXInKTtcclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbC9VdGlscycpO1xyXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydqUXVlcnknXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ2pRdWVyeSddIDogbnVsbCk7XHJcblxyXG5mdW5jdGlvbiBjcmVhdGVMYXlvdXQoY29udGFpbmVyLCB3aWR0aCkge1xyXG5cdHZhciB3cmFwcGVyID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC13cmFwcGVyJykud2lkdGgod2lkdGgpO1xyXG5cdHZhciBoZWFkZXIgPSAkKCc8ZGl2Lz4nKS5hZGRDbGFzcygnYy1ncmlkLWhlYWRlcicpO1xyXG5cdHZhciBib2R5ID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC1ib2R5Jyk7XHJcblx0dmFyIHZpZXdwb3J0ID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC12aWV3cG9ydCcpLmFwcGVuZFRvKGJvZHkpO1xyXG5cdHZhciBjYW52YXMgPSAkKCc8ZGl2Lz4nKS5hZGRDbGFzcygnYy1ncmlkLWNhbnZhcycpLmFwcGVuZFRvKHZpZXdwb3J0KTtcclxuXHR3cmFwcGVyLmFwcGVuZChoZWFkZXIpLmFwcGVuZChib2R5KS5hcHBlbmRUbyhjb250YWluZXIpO1xyXG5cclxuXHRyZXR1cm4geyB3cmFwcGVyLCBoZWFkZXIsIGJvZHksIHZpZXdwb3J0LCBjYW52YXMgfTtcclxufVxyXG5mdW5jdGlvbiBjYWxjUm93SGVpZ2h0KCkge1xyXG5cdHZhciBsaSA9ICQoJzxsaSBjbGFzcz1cImMtZ3JpZC1jZWxsXCI+cGxhY2Vob2xkZXI8L2xpPicpLmFwcGVuZFRvKFwiYm9keVwiKTtcclxuXHR2YXIgcm93SGVpZ2h0ID0gbGkub3V0ZXJIZWlnaHQoKTtcclxuXHRsaS5yZW1vdmUoKTtcclxuXHJcblx0cmV0dXJuIHJvd0hlaWdodDtcclxufVxyXG5cclxuY2xhc3MgR3JpZENvbXBvbmVudCBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xyXG5cdFx0c3VwZXIoKTtcclxuXHJcblx0XHRpZiAoISQob3B0aW9ucy5kb21FbCkuc2l6ZSgpKSB7IHRocm93ICdyZXF1aXJlIGEgdmFsaWQgZG9tRWwnOyB9XHJcblxyXG5cdFx0dGhpcy5zaG91bGRBZGROb2RlcyA9IHRydWU7XHJcblx0XHR0aGlzLmhlaWdodCA9ICtvcHRpb25zLmhlaWdodCB8fCA1MDA7XHJcblx0XHR0aGlzLndpZHRoID0gb3B0aW9ucy53aWR0aDtcclxuXHJcblx0XHQvLyAkbGF5b3V0IGRvbVxyXG5cdFx0T2JqZWN0LmFzc2lnbih0aGlzLiRkb20gPSB7fSwgY3JlYXRlTGF5b3V0KCQob3B0aW9ucy5kb21FbCksIHRoaXMud2lkdGgpKTtcclxuXHJcblx0XHR0aGlzLmNvbHVtbk1vZGVsID0gbmV3IENvbE1vZGVsKG9wdGlvbnMuY29sdW1ucyk7XHJcblx0XHR0aGlzLnN0b3JlID0gbmV3IEdyaWRTdG9yZSh7IGNvbHVtbk1vZGVsOiB0aGlzLmNvbHVtbk1vZGVsLCAnZGF0YSc6IG9wdGlvbnMuZGF0YSB8fCBbXSB9KTtcclxuXHRcdHRoaXMuX2luaXQoKTtcclxuXHRcdHRoaXMuX2JpbmRFdmVudCgpO1xyXG5cdH1cclxuXHJcblx0X2luaXQoKSB7XHJcblx0XHR0aGlzLmhlYWRlciA9IG5ldyBIZWFkZXIodGhpcy4kZG9tLmhlYWRlciwgdGhpcy5jb2x1bW5Nb2RlbCk7XHJcblx0XHR2YXIgdG90YWwgPSB0aGlzLnN0b3JlLnNpemUoKTtcclxuXHRcdHZhciByb3dIZWlnaHQgPSB0aGlzLnJvd0hlaWdodCA9IGNhbGNSb3dIZWlnaHQoKTtcclxuXHRcdHZhciB2aWV3cG9ydEhlaWdodCA9IHRoaXMuaGVpZ2h0IC0gdGhpcy4kZG9tLmhlYWRlci5vdXRlckhlaWdodCgpO1xyXG5cdFx0dmFyIHNpbmdsZVBhZ2VTaXplID0gTWF0aC5taW4oTWF0aC5jZWlsKHZpZXdwb3J0SGVpZ2h0LyByb3dIZWlnaHQpIC0gMSwgdG90YWwgLSAxKTtcclxuXHJcblx0XHR0aGlzLmJ1ZmZlclpvbmUgPSBuZXcgQnVmZmVyWm9uZShzaW5nbGVQYWdlU2l6ZSwgdG90YWwpO1xyXG5cdFx0dGhpcy5idWZmZXJOb2RlID0gbmV3IEJ1ZmZlck5vZGUoc2luZ2xlUGFnZVNpemUsIHRoaXMuY29sdW1uTW9kZWwsIHRvdGFsKTtcclxuXHRcdHRoaXMuc2Nyb2xsZXIgPSBuZXcgU2Nyb2xsZXIocm93SGVpZ2h0LCB0aGlzLmJ1ZmZlclpvbmUpO1xyXG5cdFx0dGhpcy5zY3JvbGxlclxyXG5cdFx0XHQub25YKHggPT4ge1xyXG5cdFx0XHRcdHRoaXMuZmlyZSgnc2Nyb2xsTGVmdCcsIHgpO1xyXG5cdFx0XHRcdHRoaXMuJGRvbS5oZWFkZXIuc2Nyb2xsTGVmdCh4KTtcclxuXHRcdFx0fSlcclxuXHRcdFx0Lm9uWSgoZGlyLCBkb21haW4sIHN0YXJ0LCBlbmQsIGluZGV4LCB0b3RhbCkgPT4ge1xyXG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKGDmu5rliqjmlrnlkJHvvJoke2Rpcn0sIOWKoOi9veWMuumXtDogWyR7ZG9tYWlufV0sIOeOsOacieiMg+WbtO+8migke3N0YXJ0fSAtICR7ZW5kfSksIGApXHJcblx0XHRcdFx0dGhpcy5fYnVmZmVyUmVuZGVyKGRpciwgZG9tYWluKTtcclxuXHRcdFx0fSwgMjApO1xyXG5cclxuXHRcdHRoaXMuJGRvbS52aWV3cG9ydC5oZWlnaHQodmlld3BvcnRIZWlnaHQpO1xyXG5cdFx0dGhpcy4kZG9tLnZpZXdwb3J0Lm9uKCdzY3JvbGwnLCAoZXZ0KSA9PiB7XHJcblx0XHRcdHRoaXMuc2Nyb2xsZXIuZmlyZVkoZXZ0LnRhcmdldC5zY3JvbGxUb3ApO1xyXG5cdFx0XHR0aGlzLnNjcm9sbGVyLmZpcmVYKGV2dC50YXJnZXQuc2Nyb2xsTGVmdCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmxvY2tDb2xNYW5hZ2VyID0gTG9ja0NvbE1hbmFnZXIodGhpcy5jb2x1bW5Nb2RlbCwgdGhpcy5oZWFkZXIsIHRoaXMuJGRvbSwgdGhpcy5idWZmZXJOb2RlKTtcclxuXHRcdHRoaXMuX3NldENhbnZhc1dIKHRvdGFsKTtcclxuXHR9XHJcblxyXG5cdF9zZXRDYW52YXNXSCh0b3RhbCkge1xyXG5cdFx0dGhpcy4kZG9tLmNhbnZhc1xyXG5cdFx0XHQud2lkdGgodG90YWwgPyAnYXV0bycgOiB0aGlzLl91bkxvY2tWaXNpYmxlQ29sc1dpZHRoKCkpXHJcblx0XHRcdC5oZWlnaHQodGhpcy5yb3dIZWlnaHQgKiB0b3RhbCB8fCAxKTtcclxuXHR9XHJcblxyXG5cdF91bkxvY2tWaXNpYmxlQ29sc1dpZHRoKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuaGVhZGVyLmdldFZpc2libGVDb2xzV2lkdGgoKSArIHRoaXMubG9ja0NvbE1hbmFnZXIudmlzaWJsZUxvY2tDb2x1bW4uZ2V0V2lkdGgoKTtcclxuXHR9XHJcblxyXG5cdHNjcm9sbFRvVG9wKHBvc2l0aW9uKSB7XHJcblx0XHR0aGlzLiRkb20udmlld3BvcnQuc2Nyb2xsVG9wKHBvc2l0aW9uKTtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHR0aGlzLm9uKCd2aWV3cG9ydC1oZWlnaHQtY2hhbmdlZCcsIHZpZXdwb3J0SGVpZ2h0ID0+IHtcclxuXHRcdFx0dGhpcy5fdXBkYXRlQnVmZmVyKCk7XHJcblx0XHRcdHRoaXMucmVuZGVyKCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLm9uKCdzY3JvbGxMZWZ0JywgeCA9PiB7XHJcblx0XHRcdC8vIHBlcmZvcm1hbmNlIFRPRE9cclxuXHRcdFx0Ly8gbGV0IGxvY2tDb2x1bW5XaWR0aCA9IHRoaXMuaGVhZGVyLmdldFZpc2libGVMb2NrQ29sc1dpZHRoKCk7XHJcblx0XHRcdC8vIHRoaXMuJGRvbS5jYW52YXMuZmluZCgnLmMtY29sdW1uLWxvY2tlZCcpLmNzcygnbGVmdCcsIHggLSBsb2NrQ29sdW1uV2lkdGgpO1xyXG5cdFx0XHQvLyB0aGlzLiRkb20uaGVhZGVyLmZpbmQoJy5jLWNvbHVtbi1sb2NrZWQnKS5jc3MoJ2xlZnQnLCB4IC0gbG9ja0NvbHVtbldpZHRoKTtcclxuXHRcdFx0dGhpcy5sb2NrQ29sTWFuYWdlci5zZXRMb2NrQ29sdW1uWCh4KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuc3RvcmUub24oJ2RhdGEtY2hhbmdlZCcsIChhcHBlbmQpID0+IHtcclxuXHRcdFx0bGV0IHRvdGFsID0gdGhpcy5zdG9yZS5zaXplKCk7XHJcblx0XHRcdHRoaXMuX3NldENhbnZhc1dIKHRvdGFsKTtcclxuXHRcdFx0dGhpcy5idWZmZXJOb2RlLnNldFRvdGFsKHRvdGFsKTtcclxuXHRcdFx0dGhpcy5idWZmZXJab25lLnNldFRvdGFsKHRvdGFsKTtcclxuXHJcblx0XHRcdGlmICghYXBwZW5kIHx8ICh0b3RhbCAtIDEpICogdGhpcy5yb3dIZWlnaHQgPCAyKnRoaXMuJGRvbS52aWV3cG9ydC5vdXRlckhlaWdodCgpKSB7XHJcblx0XHRcdFx0dGhpcy5fdXBkYXRlQnVmZmVyKCk7XHJcblx0XHRcdFx0dGhpcy5yZW5kZXIoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblxyXG5cdH1cclxuXHJcblx0X3VwZGF0ZUJ1ZmZlcigpIHtcclxuXHRcdHZhciBsaW1pdCA9IE1hdGgubWluKFxyXG5cdFx0XHRNYXRoLmNlaWwodGhpcy4kZG9tLnZpZXdwb3J0Lm91dGVySGVpZ2h0KCkgLyB0aGlzLnJvd0hlaWdodCkgLSAxLFxyXG5cdFx0XHR0aGlzLnN0b3JlLnNpemUoKSAtIDEpO1xyXG5cclxuXHRcdHRoaXMuYnVmZmVyWm9uZS5zZXRMaW1pdChsaW1pdCk7XHJcblx0XHR0aGlzLmJ1ZmZlck5vZGUuc2V0TGltaXQobGltaXQpO1xyXG5cdFx0dGhpcy5zaG91bGRBZGROb2RlcyA9IHRydWU7XHJcblx0XHR0aGlzLnNjcm9sbFRvVG9wKDApO1xyXG5cclxuXHRcdHRoaXMuJGRvbS5jYW52YXMuZW1wdHkoKTtcclxuXHR9XHJcblxyXG5cdF9idWZmZXJSZW5kZXIoZGlyLCBbc3RhcnQsIGVuZF0pIHtcclxuXHRcdHZhciBub2RlcyA9IHRoaXMuYnVmZmVyTm9kZS5nZXQoZGlyLCBbc3RhcnQsIGVuZF0pO1xyXG5cdFx0Y29uc29sZS5sb2coJ+S4gOasoeiOt+WPluiKgueCuemVv+W6picsIG5vZGVzLmxlbmd0aCwgc3RhcnQsIGVuZCk7XHJcblxyXG5cdFx0aWYgKCF0aGlzLnNob3VsZEFkZE5vZGVzKSB7XHJcblx0XHRcdHRoaXMuc3RvcmUuc2xpY2Uoc3RhcnQsIGVuZCArIDEpLmZvckVhY2goKHJvd00sIGkpID0+IHtcclxuXHRcdFx0XHRub2Rlc1tpXS5zZXREYXRhKHJvd00sIHJvd00ucmlkICogdGhpcy5yb3dIZWlnaHQpO1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHZhciAkZG9jRnJhbWUgPSAkKCc8ZGl2Lz4nKTtcclxuXHRcdHRoaXMuc3RvcmUuc2xpY2Uoc3RhcnQsIGVuZCArIDEpLmZvckVhY2goKHJvd00sIGkpID0+IHtcclxuXHJcblx0XHRcdGxldCBub2RlID0gbm9kZXNbaV0uc2V0RGF0YShyb3dNLCByb3dNLnJpZCAqIHRoaXMucm93SGVpZ2h0KTtcclxuXHRcdFx0JGRvY0ZyYW1lLmFwcGVuZChub2RlKTtcclxuXHRcdFxyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kZG9tLmNhbnZhcy5hcHBlbmQoJGRvY0ZyYW1lLmNoaWxkcmVuKCkpO1xyXG5cdFx0dGhpcy5sb2NrQ29sTWFuYWdlci5hZGRCdWZmZXJMb2NrTm9kZShub2Rlcyk7XHJcblxyXG5cdFx0aWYgKHRoaXMuYnVmZmVyTm9kZS5pc0Vub3VnaCgpKSB7XHJcblx0XHRcdHRoaXMuc2hvdWxkQWRkTm9kZXMgPSBmYWxzZTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJlbmRlcigpIHtcclxuXHRcdHRoaXMuX2J1ZmZlclJlbmRlcigxLCB0aGlzLmJ1ZmZlclpvbmUuZG9tYWluKTtcclxuXHR9XHJcblxyXG5cdHNldFdpZHRoKG51bSkge1xyXG5cdFx0aWYgKGlzTmFOKG51bSkpIHJldHVybjtcclxuXHJcblx0XHR0aGlzLiRkb20ud3JhcHBlci53aWR0aChudW0pO1xyXG5cdH1cclxuXHJcblx0c2V0SGVpZ2h0KG51bSkge1xyXG5cdFx0aWYgKGlzTmFOKG51bSkpIHJldHVybjtcclxuXHJcblx0XHR2YXIgdmlld3BvcnRIZWlnaHQgPSBudW0gLSB0aGlzLiRkb20uaGVhZGVyLm91dGVySGVpZ2h0KCk7XHJcblx0XHR0aGlzLiRkb20udmlld3BvcnQub3V0ZXJIZWlnaHQodmlld3BvcnRIZWlnaHQpO1xyXG5cdFx0dGhpcy5maXJlKCd2aWV3cG9ydC1oZWlnaHQtY2hhbmdlZCcsIHZpZXdwb3J0SGVpZ2h0KTtcclxuXHR9XHJcblxyXG5cdGRlc3RvcnkoKSB7XHJcblx0XHR0aGlzLmNvbHVtbk1vZGVsLmRlc3RvcnkoKTtcclxuXHRcdHRoaXMuc3RvcmUuZGVzdG9yeSgpO1xyXG5cdFx0dGhpcy5oZWFkZXIuZGVzdG9yeSgpO1xyXG5cdFx0dGhpcy4kZG9tLndyYXBwZXIucmVtb3ZlKCk7XHJcblx0fVxyXG59XHJcbm1vZHVsZS5leHBvcnRzID0gR3JpZENvbXBvbmVudDsiLCJjb25zdCAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ2pRdWVyeSddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnalF1ZXJ5J10gOiBudWxsKTtcclxuY29uc3QgXyA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydfJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWydfJ10gOiBudWxsKTtcclxuY29uc3QgREQgPSByZXF1aXJlKCcuLi91dGlsL0REJyk7XHJcblxyXG5jb25zdCBTT1JUX0NMU19BU0MgPSAnYy1jb2x1bW4tYXNjJztcclxuY29uc3QgU09SVF9DTFNfREVTQyA9ICdjLWNvbHVtbi1kZXNjJztcclxuY29uc3QgTkVFRExFU1NfV0lEVEggPSAxMDAwO1xyXG5cclxudmFyIGNyZWF0ZUNvbHVtbkVsZW1lbnQgPSBmdW5jdGlvbihjb2xNKSB7XHJcblx0dmFyIGxvY2tDbGFzcyA9IGNvbE0ubG9ja2VkID8gJyBjLWNvbHVtbi1sb2NrZWQnIDogJyc7XHJcblxyXG5cdHJldHVybiAkKCc8bGkvPicpXHJcblx0XHQuYWRkQ2xhc3MoJ2MtaGVhZGVyLWNlbGwnICsgbG9ja0NsYXNzKVxyXG5cdFx0LmFkZENsYXNzKCdjLWFsaWduLScgKyBjb2xNLmFsaWduKVxyXG5cdFx0LndpZHRoKGNvbE0ud2lkdGgpXHJcblx0XHQub24oJ2NsaWNrJywgKCkgPT4geyBjb2xNLnNvcnQoKTsgfSlcclxuXHRcdC5kYXRhKCdjb2x1bW4nLCBjb2xNKVxyXG5cdFx0Lmh0bWwoY29sTS50ZXh0KTtcclxufTtcclxuXHJcblxyXG5jbGFzcyBIZWFkZXIge1xyXG5cdGNvbnN0cnVjdG9yKCRoZWFkZXIsIGNvbHNNb2RlbCkge1xyXG5cclxuXHRcdHRoaXMuX2RyYWdnaW5nID0gZmFsc2U7XHJcblx0XHR0aGlzLl9yZXNpemluZyA9IGZhbHNlO1xyXG5cclxuXHRcdHRoaXMuJGhlYWRlciA9ICRoZWFkZXI7XHJcblx0XHR0aGlzLmNvbHNNb2RlbCA9IGNvbHNNb2RlbDtcclxuXHRcdC8vIHRoaXMuc3RvcmUgPSBzdG9yZTtcclxuXHRcdHRoaXMuY29sRWxlbWVudHMgPSBuZXcgTWFwKCk7XHJcblxyXG5cdFx0dGhpcy5fY3JlYXRlQ29sdW1uRWxlbWVudHMoKTtcclxuXHRcdHRoaXMuX2JpbmRFdmVudCgpO1xyXG5cclxuXHRcdHRoaXMucmVuZGVyKCk7XHJcblx0fVxyXG5cclxuXHRfY3JlYXRlQ29sdW1uRWxlbWVudHMoKSB7XHJcblx0XHR2YXIgd2lkdGggPSBORUVETEVTU19XSURUSDtcclxuXHJcblx0XHR0aGlzLiRyb3cgPSAkKCc8dWwvPicpLmFkZENsYXNzKCdjLWhlYWRlci1yb3cnKTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRsZXQgY29sRWxlbWVudCA9IGNyZWF0ZUNvbHVtbkVsZW1lbnQoY29sTSk7XHJcblxyXG5cdFx0XHR0aGlzLmNvbEVsZW1lbnRzLnNldChjb2xNLCBjb2xFbGVtZW50KTtcclxuXHRcdFx0dGhpcy4kcm93LmFwcGVuZChjb2xFbGVtZW50KTtcclxuXHJcblx0XHRcdHdpZHRoICs9IGNvbE0ud2lkdGg7XHJcblxyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kcm93LndpZHRoKHdpZHRoKTtcclxuXHR9XHJcblxyXG5cdGdldFZpc2libGVDb2xzV2lkdGgoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy4kcm93LndpZHRoKCkgLSBORUVETEVTU19XSURUSDtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHR0aGlzLl9jb2x1bW5SZXNpemUoKTtcclxuXHRcdHRoaXMuX2NvbHVtbk1vdmUoKTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5vbignY29sdW1uLWFkZCcsIGNvbE0gPT4ge1xyXG5cdFx0XHRsZXQgY29sRWxlbWVudCA9IGNyZWF0ZUNvbHVtbkVsZW1lbnQoY29sTSk7XHJcblxyXG5cdFx0XHR0aGlzLmNvbEVsZW1lbnRzLnNldChjb2xNLCBjb2xFbGVtZW50KTtcclxuXHRcdFx0dGhpcy4kcm93LmFwcGVuZChjb2xFbGVtZW50KTtcclxuXHJcblx0XHRcdGxldCByb3dXID0gdGhpcy4kcm93LndpZHRoKCk7XHJcblx0XHRcdHRoaXMuJHJvdy53aWR0aChyb3dXICsgY29sTS53aWR0aCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5vbignY29sdW1uLW1vdmVkJywgKGNvbE0sIGZvcm1JbmRleCwgdG9JbmRleCkgPT4ge1xyXG5cdFx0XHRsZXQgY29sRWxlbWVudCA9IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cdFx0XHRjb2xFbGVtZW50Lmluc2VydEFmdGVyKHRoaXMuJHJvdy5maW5kKCdsaS5jLWhlYWRlci1jZWxsJykuZXEodG9JbmRleCkpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwuZWFjaChjb2xNID0+IHtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi10ZXh0ZWQnLCB0ZXh0ID0+IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pLnRleHQodGV4dCkpO1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLXJlc2l6ZWQnLCB3aWR0aCA9PiB0aGlzLmNvbEVsZW1lbnRzLmdldChjb2xNKS5vdXRlcldpZHRoKHdpZHRoKSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4taGlkZGVuJywgaXNIaWRkZW4gPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHRcdFx0XHRpZiAoaXNIaWRkZW4pIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcygnYy1jb2x1bW4taGlkZScpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoJ2MtY29sdW1uLWhpZGUnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWxvY2tlZCcsIGlzTG9ja2VkID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdGlmIChpc0xvY2tlZCkge1xyXG5cdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKCdjLWNvbHVtbi1sb2NrZWQnKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKCdjLWNvbHVtbi1sb2NrZWQnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLXNvcnQtY2hhbmdlZCcsIHNvcnRTdGF0ZSA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyhzb3J0U3RhdGUpO1xyXG5cdFx0XHRcdGlmIChzb3J0U3RhdGUpIHtcclxuXHRcdFx0XHRcdGlmIChzb3J0U3RhdGUgPT09ICdBU0MnKSB7XHJcblx0XHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcyhTT1JUX0NMU19BU0MpO1xyXG5cdFx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoU09SVF9DTFNfREVTQyk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRjb2xFbGUuYWRkQ2xhc3MoU09SVF9DTFNfREVTQyk7XHJcblx0XHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcyhTT1JUX0NMU19BU0MpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoU09SVF9DTFNfQVNDKS5yZW1vdmVDbGFzcyhTT1JUX0NMU19ERVNDKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignZGVzdG9yeScsICgpID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblx0XHRcdFx0dGhpcy5jb2xFbGVtZW50cy5kZWxldGUoY29sTSk7XHRcdFx0XHJcblx0XHRcdFx0Y29sRWxlLnJlbW92ZSgpO1xyXG5cclxuXHRcdFx0XHRsZXQgcm93VyA9IHRoaXMuJHJvdy53aWR0aCgpO1xyXG5cdFx0XHRcdHRoaXMuJHJvdy53aWR0aChyb3dXIC0gY29sTS53aWR0aCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRfY29sdW1uUmVzaXplKCkge1xyXG5cdFx0dGhpcy4kcm93Lm9uKCdtb3VzZW1vdmUnLCAnbGkuYy1oZWFkZXItY2VsbCcsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHR2YXIgb2Zmc2V0WCA9IGV2dC5vZmZzZXRYO1xyXG5cdFx0XHRpZiAodGhpcy5vZmZzZXRXaWR0aCAtIG9mZnNldFggPD0gNSB8fCBvZmZzZXRYIDw9IDUpIHtcclxuXHRcdFx0XHQkKHRoaXMpLmFkZENsYXNzKCdjLWNvbC1yZXNpemFibGUnKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHQkKHRoaXMpLnJlbW92ZUNsYXNzKCdjLWNvbC1yZXNpemFibGUnKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblxyXG5cdFx0bGV0IHN0YXJ0WCA9IDA7XHJcblx0XHRsZXQgc2VsZiA9IHRoaXM7XHJcblxyXG5cdFx0REQodGhpcy4kcm93LCB7XHJcblx0XHRcdCd0cmlnZ2VyJzogJ2xpLmMtaGVhZGVyLWNlbGwnLFxyXG5cdFx0XHQncmVzdHJpY3Rlcic6IGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHRcdGlmIChzZWxmLl9kcmFnZ2luZykgcmV0dXJuIGZhbHNlO1xyXG5cclxuXHRcdFx0XHRsZXQgb2Zmc2V0WCA9IGV2dC5vZmZzZXRYO1xyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGlmICh0aGlzLm9mZnNldFdpZHRoIC0gb2Zmc2V0WCA8PSA1KSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gJCh0aGlzKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKG9mZnNldFggPD0gNSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuICQodGhpcykucHJldigpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSxcclxuXHRcdFx0J29uRHJhZ1N0YXJ0JzogXy5kZWJvdW5jZShmdW5jdGlvbihvZmZzZXQsICR0YXJnZXQpIHtcclxuXHRcdFx0XHRsZXQgc2Nyb2xsTGVmdCA9IGRvY3VtZW50LmJvZHkuc2Nyb2xsTGVmdCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsTGVmdDtcclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZygkdGFyZ2V0Lm9mZnNldCgpLmxlZnQsICR0YXJnZXQudGV4dCgpKTtcclxuXHRcdFx0XHRzdGFydFggPSAkdGFyZ2V0Lm9mZnNldCgpLmxlZnQgLSBzY3JvbGxMZWZ0O1xyXG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKG9mZnNldC54LCAkdGFyZ2V0LnRleHQoKSk7XHJcblx0XHRcdFx0c2VsZi5fcmVzaXppbmcgPSB0cnVlO1xyXG5cdFx0XHRcdC8vIHN0YXJ0WCA9IG9mZnNldC54O1xyXG5cdFx0XHR9LCA4MCksXHJcblx0XHRcdCdvbkRyYWdnaW5nJzogZnVuY3Rpb24ob2Zmc2V0LCAkdGFyZ2V0KSB7XHJcblxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnb25EcmFnRW5kJzogXy5kZWJvdW5jZShmdW5jdGlvbihvZmZzZXQsICR0YXJnZXQpIHtcclxuXHRcdFx0XHRsZXQgd2lkdGggPSBvZmZzZXQueCAtIHN0YXJ0WDtcclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyhgJHskdGFyZ2V0LnRleHQoKX1cclxuXHRcdFx0XHQvLyBcdOWOn+WuveW6puS4uiR7JHRhcmdldC5kYXRhKCdjb2x1bW4nKS53aWR0aH0sXHJcblx0XHRcdFx0Ly8gXHTmlLnlj5jkuLrvvJoke3dpZHRofSwgWyR7b2Zmc2V0Lnh9IC0gJHtzdGFydFh9XWApO1xyXG5cdFx0XHRcdCR0YXJnZXQuZGF0YSgnY29sdW1uJykuc2V0V2lkdGgod2lkdGgpO1xyXG5cdFx0XHRcdHNlbGYuX3Jlc2l6aW5nID0gZmFsc2U7XHJcblx0XHRcdH0sIDgwKVxyXG5cdFx0fSk7XHJcblx0XHRcclxuXHR9XHJcblxyXG5cdF9jb2x1bW5Nb3ZlKCkge1xyXG5cdFx0bGV0IHNlbGYgPSB0aGlzO1xyXG5cdFx0bGV0IHRvQ29sdW1uID0gbnVsbDtcclxuXHRcdGxldCBmcm9tQ29sdW1uID0gbnVsbDtcclxuXHRcdGxldCAkYm9keSA9ICQoJ2JvZHknKTtcclxuXHRcdGxldCAkbW92ZVN0YXR1c1RvcCA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWNvbC1wbGFjZWhvbGRlciBjLXRvcCcpO1xyXG5cdFx0bGV0ICRtb3ZlU3RhdHVzQm90dG9tID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtY29sLXBsYWNlaG9sZGVyIGMtYm90dG9tJyk7XHJcblxyXG5cdFx0dGhpcy4kcm93XHJcblx0XHRcdC5vbignbW91c2Vkb3duJywgJ2xpLmMtaGVhZGVyLWNlbGwnLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRsZXQgb2Zmc2V0WCA9IGV2dC5vZmZzZXRYO1xyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGlmICh0aGlzLm9mZnNldFdpZHRoIC0gb2Zmc2V0WCA8PSA1IHx8IG9mZnNldFggPD0gNSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0c2VsZi5fZHJhZ2dpbmcgPSB0cnVlO1xyXG5cclxuXHRcdFx0XHRsZXQgY29sRWxlID0gJCh0aGlzKS5hZGRDbGFzcygnYy1jb2wtZHJhZ2dhYmxlJyk7XHJcblx0XHRcdFx0ZnJvbUNvbHVtbiA9ICQodGhpcykuZGF0YSgnY29sdW1uJyk7XHJcblx0XHRcdFx0JGJvZHkuYXBwZW5kKCRtb3ZlU3RhdHVzVG9wKS5hcHBlbmQoJG1vdmVTdGF0dXNCb3R0b20pO1xyXG5cclxuXHRcdFx0XHRldnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcblx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0O1xyXG5cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH0pXHJcblx0XHRcdC5vbignbW91c2VlbnRlcicsICdsaS5jLWhlYWRlci1jZWxsJywgZnVuY3Rpb24oZXZ0KSB7XHJcblx0XHRcdFx0aWYgKHNlbGYuX2RyYWdnaW5nKSB7XHJcblx0XHRcdFx0XHRsZXQgJG92ZXJDb2x1bW4gPSAkKHRoaXMpO1xyXG5cdFx0XHRcdFx0dG9Db2x1bW4gPSAkb3ZlckNvbHVtbi5kYXRhKCdjb2x1bW4nKTtcclxuXHJcblx0XHRcdFx0XHRsZXQgdG9wID0gJG92ZXJDb2x1bW4ub2Zmc2V0KCkudG9wIC0gMTI7XHJcblx0XHRcdFx0XHRsZXQgbGVmdCA9ICRvdmVyQ29sdW1uLm9mZnNldCgpLmxlZnQgKyB0b0NvbHVtbi53aWR0aCAtIDg7XHJcblx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdCRtb3ZlU3RhdHVzVG9wLmNzcyh7IHRvcDogdG9wLCBsZWZ0OiBsZWZ0IH0pLnNob3coKTtcclxuXHRcdFx0XHRcdCRtb3ZlU3RhdHVzQm90dG9tLmNzcyh7IHRvcDogdG9wICsgNDAsIGxlZnQ6IGxlZnQgfSkuc2hvdygpO1xyXG5cclxuXHRcdFx0XHRcdGV2dC5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHRcdFx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdDtcclxuXHJcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KVxyXG5cdFx0XHQub24oJ21vdXNldXAnLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRzZWxmLl9kcmFnZ2luZyA9IGZhbHNlO1xyXG5cclxuXHRcdFx0XHRpZiAodG9Db2x1bW4pIHtcclxuXHRcdFx0XHRcdGxldCB0b0luZGV4ID0gc2VsZi5jb2xFbGVtZW50cy5nZXQodG9Db2x1bW4pLmluZGV4KCk7XHJcblx0XHRcdFx0XHRsZXQgZm9ybUluZGV4ID0gc2VsZi5jb2xzTW9kZWwuZ2V0Q29sdW1uKCkuaW5kZXhPZihmcm9tQ29sdW1uKTtcclxuXHJcblx0XHRcdFx0XHQvLyBjb25zb2xlLmxvZyh0b0luZGV4LCBmb3JtSW5kZXgpO1xyXG5cclxuXHRcdFx0XHRcdGZyb21Db2x1bW4ubW92ZVRvKHRvSW5kZXgpO1xyXG5cdFx0XHRcdFx0c2VsZi5jb2xFbGVtZW50cy5nZXQoZnJvbUNvbHVtbikucmVtb3ZlQ2xhc3MoJ2MtY29sLWRyYWdnYWJsZScpO1xyXG5cclxuXHRcdFx0XHRcdCRtb3ZlU3RhdHVzVG9wLmhpZGUoKS5yZW1vdmUoKTtcclxuXHRcdFx0XHRcdCRtb3ZlU3RhdHVzQm90dG9tLmhpZGUoKS5yZW1vdmUoKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGZyb21Db2x1bW4gPSBudWxsO1xyXG5cdFx0XHRcdHRvQ29sdW1uID0gbnVsbDtcclxuXHRcdFx0fSk7XHJcblx0fVxyXG5cclxuXHRyZW5kZXIoKSB7XHJcblx0XHR0aGlzLiRoZWFkZXIuYXBwZW5kKHRoaXMuJHJvdyk7XHJcblx0fVxyXG5cclxuXHRkZXN0b3J5KCkge1xyXG5cclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gSGVhZGVyOyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbmNsYXNzIExvY2tDb2x1bW4ge1xyXG5cdGNvbnN0cnVjdG9yKCkge1xyXG5cdFx0dGhpcy5fZGF0YSA9IFtdO1xyXG5cdFx0dGhpcy5fY29sdW1uc1dpZHRoID0gMDtcclxuXHR9XHJcblxyXG5cdGFkZChjb2xNKSB7XHJcblx0XHR0aGlzLl9kYXRhLnVuc2hpZnQoY29sTSk7XHJcblx0XHR0aGlzLnJlQ2FsYygpO1xyXG5cdH1cclxuXHJcblx0cmVtb3ZlKGRlbENvbE0pIHtcclxuXHRcdHRoaXMuX2RhdGEgPSB0aGlzLl9kYXRhLmZpbHRlcihjb2xNID0+IGNvbE0gIT09IGRlbENvbE0pO1xyXG5cdFx0dGhpcy5yZUNhbGMoKTtcclxuXHR9XHJcblxyXG5cdGNsZWFyKCkge1xyXG5cdFx0dGhpcy5fZGF0YS5sZW5ndGggPSAwO1xyXG5cdFx0dGhpcy5yZUNhbGMoKTtcclxuXHR9XHJcblxyXG5cdGdldFdpZHRoKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuX2NvbHVtbnNXaWR0aDtcclxuXHR9XHJcblxyXG5cdHJlQ2FsYygpIHtcclxuXHRcdHRoaXMuX2NvbHVtbnNXaWR0aCA9IHRoaXMuX2RhdGEucmVkdWNlKCh3aWR0aCwgY29sTSkgPT4ge1xyXG5cdFx0XHR3aWR0aCAtPSBjb2xNLndpZHRoO1xyXG5cdFx0XHRjb2xNLmF3YXlGcm9tTGVmdCA9IHdpZHRoO1xyXG5cdFx0XHRyZXR1cm4gd2lkdGg7XHJcblx0XHR9LCAwKTtcclxuXHR9XHJcblxyXG5cdGVhY2goZm4pIHtcclxuXHRcdHRoaXMuX2RhdGEuZm9yRWFjaChmbik7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiDlvZPlhbbkuK3kuIDliJflj5HnlJ/lj5jljJbvvIzpgJrnn6XlhbblroPliJfnm7jlupTlj5jljJZcclxuXHQgKi9cclxuXHQgcHVibGlzaChjaGFuZ2VkQ29sTSwgc2Nyb2xsTGVmdCkge1xyXG5cdCBcdHRoaXMuX2RhdGEuZm9yRWFjaChjb2xNID0+IHtcclxuXHQgXHRcdGlmIChjb2xNICE9PSBjaGFuZ2VkQ29sTSkge1xyXG5cdCBcdFx0XHRjb2xNLmZpcmUoJ3Njcm9sbC14Jywgc2Nyb2xsTGVmdCk7XHJcblx0IFx0XHR9XHJcblx0IFx0fSk7XHJcblx0IH1cclxufVxyXG5cclxudmFyIExvY2tDb2xNYW5hZ2VyID0gZnVuY3Rpb24oY29sc01vZGVsLCBoZWFkZXIsICRkb20sIGJ1ZmZlck5vZGUpIHtcclxuXHRsZXQgdmlzaWJsZUxvY2tDb2x1bW4gPSBuZXcgTG9ja0NvbHVtbigpO1xyXG5cclxuXHRpbml0KCk7XHJcblx0aW5pdEV2ZW50KCk7XHJcblxyXG5cdGZ1bmN0aW9uIGluaXQoKSB7XHJcblx0XHRjb2xzTW9kZWxcclxuXHRcdFx0LmdldExvY2tDb2x1bW4oKVxyXG5cdFx0XHQuZmlsdGVyKGNvbE0gPT4gIWNvbE0uaGlkZGVuKVxyXG5cdFx0XHQuZm9yRWFjaChjb2xNID0+IHZpc2libGVMb2NrQ29sdW1uLmFkZChjb2xNKSk7XHJcblxyXG5cdFx0dXBkYXRlQm94U2l6ZSgpO1xyXG5cclxuXHRcdHZpc2libGVMb2NrQ29sdW1uLmVhY2goY29sTSA9PiB7XHJcblx0XHRcdGxldCBoZWFkZXJFbGVtZW50ID0gaGVhZGVyLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHRcdFx0Ly8g6K6+572u5bm26K6w5b2V5Yid5aeL55qE5bem5L6n5L2NXHJcblx0XHRcdGhlYWRlckVsZW1lbnQuY3NzKCdsZWZ0JywgY29sTS5hd2F5RnJvbUxlZnQpO1xyXG5cclxuXHRcdFx0Y29sTS5vbignc2Nyb2xsLXgnLCB4ID0+IHtcclxuXHRcdFx0XHRsZXQgbGVmdFN0eWxlID0geyAnbGVmdCc6IHggKyBjb2xNLmF3YXlGcm9tTGVmdCB9O1xyXG5cclxuXHRcdFx0XHRoZWFkZXJFbGVtZW50LmNzcyhsZWZ0U3R5bGUpO1xyXG5cdFx0XHRcdGJ1ZmZlck5vZGUuZ2V0Tm9kZUxpc3QoKS5mb3JFYWNoKG5vZGUgPT4gbm9kZS5jaGlsZHJlbi5nZXQoY29sTSkuY3NzKGxlZnRTdHlsZSkpO1x0XHRcdFx0XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpbml0RXZlbnQoKSB7XHJcblxyXG5cdFx0Y29uc3QgY29sdW1uTG9ja09yVW5Mb2NrID0gKGlzTG9ja2VkLCBjb2xNKSA9PiB7XHJcblx0XHRcdGxldCBoZWFkZXJFbGVtZW50ID0gaGVhZGVyLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHJcblx0XHRcdGlmIChpc0xvY2tlZCkge1xyXG5cdFx0XHRcdHZpc2libGVMb2NrQ29sdW1uLmFkZChjb2xNKTtcclxuXHJcblx0XHRcdFx0Y29sTS5vbignc2Nyb2xsLXgnLCB4ID0+IHtcclxuXHRcdFx0XHRcdGxldCBsZWZ0U3R5bGUgPSB7ICdsZWZ0JzogeCArIGNvbE0uYXdheUZyb21MZWZ0IH07XHJcblxyXG5cdFx0XHRcdFx0aGVhZGVyRWxlbWVudC5jc3MobGVmdFN0eWxlKTtcclxuXHRcdFx0XHRcdGJ1ZmZlck5vZGUuZ2V0Tm9kZUxpc3QoKS5mb3JFYWNoKG5vZGUgPT4gbm9kZS5jaGlsZHJlbi5nZXQoY29sTSkuY3NzKGxlZnRTdHlsZSkpO1xyXG5cdFx0XHRcdH0pO1xyXG5cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5yZW1vdmUoY29sTSk7XHJcblxyXG5cdFx0XHRcdGNvbE0ub2ZmKCdzY3JvbGwteCcpO1xyXG5cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bGV0IGN1cnJlbnRMZWZ0ID0gJGRvbS52aWV3cG9ydC5zY3JvbGxMZWZ0KCkgKyBjb2xNLmF3YXlGcm9tTGVmdDtcclxuXHJcblx0XHRcdC8vIOiuvue9ruW5tuiusOW9leWIneWni+eahOW3puS+p+S9jVxyXG5cdFx0XHRoZWFkZXJFbGVtZW50LmNzcygnbGVmdCcsIGN1cnJlbnRMZWZ0KTtcclxuXHRcdFx0YnVmZmVyTm9kZS5nZXROb2RlTGlzdCgpLmZvckVhY2gobm9kZSA9PiBub2RlLmNoaWxkcmVuLmdldChjb2xNKS5jc3MoJ2xlZnQnLCBjdXJyZW50TGVmdCkpO1xyXG5cclxuXHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4ucHVibGlzaChjb2xNLCAkZG9tLnZpZXdwb3J0LnNjcm9sbExlZnQoKSk7XHJcblx0XHRcdHVwZGF0ZUJveFNpemUoKTtcclxuXHRcdH07XHJcblxyXG5cdFx0Y29sc01vZGVsLm9uKCdjb2x1bW4tYWRkJywgY29sTSA9PiB7XHJcblx0XHRcdC8vIEJVR0ZJWCBUT0RPXHJcblxyXG5cdFx0XHQvLyAuLi5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWxvY2tlZCcsIGlzTG9ja2VkID0+IHtcclxuXHRcdFx0XHRjb2x1bW5Mb2NrT3JVbkxvY2soaXNMb2NrZWQsIGNvbE0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdGNvbHNNb2RlbC5nZXRDb2x1bW4oKS5mb3JFYWNoKGNvbE0gPT4ge1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLXJlc2l6ZWQnLCB3aWR0aCA9PiB7XHJcblxyXG5cdFx0XHRcdGlmIChjb2xNLmxvY2tlZCkge1xyXG5cdFx0XHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4ucmVDYWxjKCk7XHJcblx0XHRcdFx0XHRsZXQgaGVhZGVyRWxlbWVudCA9IGhlYWRlci5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdFx0bGV0IGN1cnJlbnRMZWZ0ID0gJGRvbS52aWV3cG9ydC5zY3JvbGxMZWZ0KCkgKyBjb2xNLmF3YXlGcm9tTGVmdDtcclxuXHJcblx0XHRcdFx0XHRoZWFkZXJFbGVtZW50LmNzcygnbGVmdCcsIGN1cnJlbnRMZWZ0KTtcclxuXHRcdFx0XHRcdGJ1ZmZlck5vZGUuZ2V0Tm9kZUxpc3QoKS5mb3JFYWNoKG5vZGUgPT4gbm9kZS5jaGlsZHJlbi5nZXQoY29sTSkuY3NzKCdsZWZ0JywgY3VycmVudExlZnQpKTtcclxuXHJcblx0XHRcdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5wdWJsaXNoKGNvbE0sICRkb20udmlld3BvcnQuc2Nyb2xsTGVmdCgpKTtcclxuXHRcdFx0XHRcdHVwZGF0ZUJveFNpemUoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFxyXG5cdFx0XHR9KTtcclxuXHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tbG9ja2VkJywgaXNMb2NrZWQgPT4ge1xyXG5cdFx0XHRcdC8vIC4uLlxyXG5cdFx0XHRcdGNvbHVtbkxvY2tPclVuTG9jayhpc0xvY2tlZCwgY29sTSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0XHRcclxuXHRcdGJ1ZmZlck5vZGUub24oJ2J1ZmZlci1pbml0aWFsJywgKCkgPT4ge1xyXG5cdFx0XHQvLyBjbGVhckJ1ZmZlckxvY2tOb2RlKCk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHVwZGF0ZUJveFNpemUoKSB7XHJcblx0XHR2YXIgdmlzaWJsZUxvY2tDb2xzV2lkdGggPSB2aXNpYmxlTG9ja0NvbHVtbi5nZXRXaWR0aCgpO1xyXG5cdFx0aGVhZGVyLiRoZWFkZXIuY3NzKCdwYWRkaW5nLWxlZnQnLCAtdmlzaWJsZUxvY2tDb2xzV2lkdGgpO1xyXG5cdFx0JGRvbS5jYW52YXMuY3NzKCdtYXJnaW4tbGVmdCcsIC12aXNpYmxlTG9ja0NvbHNXaWR0aCk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4ge1xyXG5cdFx0dmlzaWJsZUxvY2tDb2x1bW4sXHJcblx0XHRzZXRMb2NrQ29sdW1uWChzY3JvbGxMZWZ0KSB7XHJcblx0XHRcdHZpc2libGVMb2NrQ29sdW1uLmVhY2goY29sTSA9PiBjb2xNLmZpcmUoJ3Njcm9sbC14Jywgc2Nyb2xsTGVmdCkpO1xyXG5cdFx0fSxcclxuXHJcblx0XHRhZGRCdWZmZXJMb2NrTm9kZShyb3dOb2Rlcykge1xyXG5cdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRcdHJvd05vZGVzLmZvckVhY2gocm93Tm9kZXMgPT4ge1xyXG5cdFx0XHRcdFx0bGV0IGNvbEVsZSA9IGhlYWRlci5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblx0XHRcdFx0XHRsZXQgY2VsbEVsZW1lbnQgPSByb3dOb2Rlcy5jaGlsZHJlbi5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdFx0Y2VsbEVsZW1lbnQuY3NzKCdsZWZ0JywgJGRvbS52aWV3cG9ydC5zY3JvbGxMZWZ0KCkgKyBjb2xNLmF3YXlGcm9tTGVmdCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSxcclxuXHJcblx0XHRjbGVhckJ1ZmZlckxvY2tOb2RlKCkge1xyXG5cdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5jbGVhcigpO1xyXG5cdFx0fVxyXG5cclxuXHR9O1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBMb2NrQ29sTWFuYWdlcjsiLCIvLyBUT0RPXHJcbnZhciBkZWJvdW5jZSA9IGZ1bmN0aW9uKGZuLCB0aW1lKSB7XHJcblx0dmFyIHRpbWVyID0gbnVsbDtcclxuXHRyZXR1cm4gZnVuY3Rpb24oLi4uYXJncykge1xyXG5cdFx0aWYgKHRpbWVyKSBjbGVhclRpbWVvdXQodGltZXIpO1xyXG5cclxuXHRcdHRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XHJcblx0XHRcdGZuLmFwcGx5KG51bGwsIGFyZ3MpO1xyXG5cdFx0fSwgdGltZSk7XHJcblx0fVxyXG59XHJcblxyXG4vL+ino+WGs3JlcXVlc3RBbmltYXRpb25GcmFtZeWFvOWuuemXrumimFxyXG52YXIgcmFGcmFtZSA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcclxuICAgICAgICAgICAgICB3aW5kb3cud2Via2l0UmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XHJcbiAgICAgICAgICAgICAgd2luZG93Lm1velJlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxyXG4gICAgICAgICAgICAgIHdpbmRvdy5vUmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XHJcbiAgICAgICAgICAgICAgd2luZG93Lm1zUmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XHJcbiAgICAgICAgICAgICAgZnVuY3Rpb24oY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgICAgd2luZG93LnNldFRpbWVvdXQoY2FsbGJhY2ssIDEwMDAgLyA2MCk7XHJcbiAgICAgICAgICAgICAgfTtcclxuXHJcbi8v5p+v6YeM5YyW5bCB6KOFXHJcbnZhciB0aHJvdHRsZSA9IGZ1bmN0aW9uKGZuKSB7XHJcbiAgICBsZXQgaXNMb2NrZWQ7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24oLi4uYXJncykge1xyXG5cclxuICAgICAgICBpZihpc0xvY2tlZCkgcmV0dXJuIFxyXG5cclxuICAgICAgICBpc0xvY2tlZCA9IHRydWU7XHJcbiAgICAgICAgcmFGcmFtZSgoKSA9PiB7XHJcbiAgICAgICAgICAgIGlzTG9ja2VkID0gZmFsc2U7XHJcbiAgICAgICAgICAgIGZuLmFwcGx5KHRoaXMsIGFyZ3MpXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5jbGFzcyBTY3JvbGxlciB7XHJcblx0Y29uc3RydWN0b3IobGluZUhlaWdodCwgYnVmZmVyWm9uZSkge1xyXG5cclxuXHRcdHRoaXMuYnVmZmVyWm9uZSA9IGJ1ZmZlclpvbmU7XHJcblx0XHR0aGlzLnlEaXIgPSAwOyAvLyAxOuWQkeS4iu+8jDAsLTE65ZCR5LiLXHJcblx0XHR0aGlzLnlQcmVJbmRleCA9IDA7IC8vIOS4iuS4gOS4quS9jee9rlxyXG5cdFx0dGhpcy5saW5lSGVpZ2h0ID0gbGluZUhlaWdodDtcclxuXHJcblx0XHR0aGlzLnhEaXIgPSAwOyAvLyAx77ya5ZCR5bem77yMMO+8jC0x77ya5ZCR5Y+zXHJcblx0XHR0aGlzLnhQcmVJbmRleCA9IDA7IC8vIOWJjeS4gOS4quS9jee9rlxyXG5cclxuXHRcdHRoaXMuX3RyaWdnZXJYID0geCA9PiB4O1xyXG5cdFx0dGhpcy5fdHJpZ2dlclkgPSB5ID0+IHk7XHJcblxyXG5cdH1cclxuXHJcblx0b25YKGNhbGxiYWNrKSB7XHJcblx0XHR0aGlzLl90cmlnZ2VyWCA9IHggPT4ge1xyXG5cdFx0XHRpZiAoeCA9PT0gdGhpcy54UHJlSW5kZXgpIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMueERpciA9IHggLSB0aGlzLnhQcmVJbmRleDtcclxuXHRcdFx0dGhpcy54UHJlSW5kZXggPSB4O1xyXG5cclxuXHRcdFx0Y2FsbGJhY2soeCk7XHJcblx0XHR9O1xyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0b25ZKGhhbmRsZXIsIGRlbGF5KSB7XHJcblx0XHQvLyBUT0RPXHJcblx0XHQvLyB2YXIgZGVhbHlGbiA9IGRlYm91bmNlKGhhbmRsZXIsIGRlbGF5KTtcclxuXHJcblx0XHR0aGlzLl90cmlnZ2VyWSA9IGRlYm91bmNlKCh5KSA9PiB7XHJcblx0XHRcdHRoaXMueURpciA9IHkgLSB0aGlzLnlQcmVJbmRleDtcclxuXHRcdFx0dGhpcy55UHJlSW5kZXggPSB5O1xyXG5cclxuXHRcdFx0dmFyIGluZGV4ID0gfn4oeS8gdGhpcy5saW5lSGVpZ2h0KTtcclxuXHRcdFx0dmFyIHdpbGxMb2FkID0gdGhpcy5idWZmZXJab25lLnNob3VsZExvYWQodGhpcy55RGlyLCBpbmRleCk7XHJcblxyXG5cdFx0XHRpZiAod2lsbExvYWQpIHtcclxuXHRcdFx0XHQvLyBkZWFseUZuKCk7XHJcblx0XHRcdFx0aGFuZGxlcihcclxuXHRcdFx0XHRcdHRoaXMueURpciA+IDAgPyAxIDogLTEsXHJcblx0XHRcdFx0XHR0aGlzLmJ1ZmZlclpvbmUuZG9tYWluLFxyXG5cdFx0XHRcdFx0dGhpcy5idWZmZXJab25lLnN0YXJ0LFxyXG5cdFx0XHRcdFx0dGhpcy5idWZmZXJab25lLmVuZCxcclxuXHRcdFx0XHRcdGluZGV4LFxyXG5cdFx0XHRcdFx0dGhpcy5idWZmZXJab25lLnRvdGFsXHJcblx0XHRcdFx0KTtcclxuXHRcdFx0fVxyXG5cdFx0fSwgZGVsYXkpO1xyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0ZmlyZVgoeCkge1xyXG5cdFx0dGhpcy5fdHJpZ2dlclgoeCk7XHJcblx0fVxyXG5cclxuXHRmaXJlWSh5KSB7XHJcblx0XHR0aGlzLl90cmlnZ2VyWSh5KTtcclxuXHR9XHJcblxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBTY3JvbGxlcjsiLCJ2YXIgU2VsZWN0aW9uID0gcmVxdWlyZSgnLi9TZWxlY3Rpb24nKTtcclxudmFyIE1lbnUgPSByZXF1aXJlKCcuLi9wbHVnaW4vTWVudScpO1xyXG52YXIgJCAgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snalF1ZXJ5J10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWydqUXVlcnknXSA6IG51bGwpO1xyXG52YXIgSlNvblRvQ1NWID0gcmVxdWlyZSgnLi4vdXRpbC9leHBvdGVyL0NTVicpO1xyXG5cclxuY29uc3QgZGVmSGVhZGVyQ29udGV4dE1lbnUgPSBbeyBcclxuXHRcdHRleHQ6ICflhrvnu5MnLCBcclxuXHRcdGhhbmRsZXI6IGZ1bmN0aW9uKGluZm8sIGNvbnRleHQsIGV2dCkge1xyXG5cdFx0XHRpbmZvLmNvbHVtbi5sb2NrKCk7XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHR0ZXh0OiAn6Kej5Ya7JywgXHJcblx0XHRoYW5kbGVyOiBmdW5jdGlvbihpbmZvLCBjb250ZXh0LCBldnQpIHsgXHJcblx0XHRcdGluZm8uY29sdW1uLnVuTG9jaygpO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0c2VwYXJhdG9yOiB0cnVlIFxyXG5cdH0sIHsgXHJcblx0XHR0ZXh0OiAn5pi+56S6JywgXHJcblx0XHRoYW5kbGVyOiBmdW5jdGlvbihpbmZvLCBjb250ZXh0LCBldnQpIHsgXHJcblx0XHRcdGluZm8uY29sdW1uLnNob3coKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdHRleHQ6ICfpmpDol48nLCBcclxuXHRcdGhhbmRsZXI6IGZ1bmN0aW9uKGluZm8sIGNvbnRleHQsIGV2dCkgeyBcclxuXHRcdFx0aW5mby5jb2x1bW4uaGlkZSgpO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0dGV4dDogJ+WumuS9jScsIFxyXG5cdFx0ZGlzYWJsZWQ6IGZhbHNlLFxyXG5cdFx0aGFuZGxlcjogZnVuY3Rpb24oaW5mbywgY29udGV4dCwgZXZ0KSB7IFxyXG5cdFx0XHRsZXQgdmFsdWUsIGluZGV4O1xyXG5cclxuXHRcdFx0aWYgKHZhbHVlID0gcHJvbXB0KCfovpPlhaXmn6Xmib7lhoXlrrknKSkge1xyXG5cdFx0XHRcdGNvbnRleHQuc3RvcmUuZm9yRWFjaChmdW5jdGlvbihyb3csIGkpIHtcclxuXHRcdFx0XHRcdGlmIChTdHJpbmcocm93W2luZm8uZGF0YUluZGV4XSkuaW5kZXhPZih2YWx1ZSkgIT09IC0xKSB7XHJcblx0XHRcdFx0XHRcdGluZGV4ID0gaTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9KTtcclxuXHJcblx0XHRcdFx0Y29udGV4dC5zY3JvbGxUb1RvcChpbmRleCAqIDM4KTtcclxuXHRcdFx0fVxyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0dGV4dDogJ+mAieS4reaVtOWIlycsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgXHJcblx0XHRcdC8vIGFsZXJ0KHNlbGYuc3RvcmUuc2l6ZSgpKTtcclxuXHRcdFx0Y29udGV4dC5fc3RhcnQgPSBbaW5mby5jb2x1bW4uY2lkLCAwXTtcclxuXHRcdFx0Y29udGV4dC5fZW5kID0gW2luZm8uY29sdW1uLmNpZCwgY29udGV4dC5zdG9yZS5zaXplKCkgLSAxXTtcclxuXHJcblx0XHRcdGNvbnRleHQuc2VsZWN0aW9uUmFuZ2UoY29udGV4dC5fc3RhcnQsIGNvbnRleHQuX2VuZCk7XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHRjbHM6ICdudW1iZXItY29sdW1uJyxcclxuXHRcdHRleHQ6ICfnu5/orqHmgLvmlbAnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IFxyXG5cdFx0XHRhbGVydChjb250ZXh0LnN0b3JlLnNpemUoKSk7XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHRjbHM6ICdudW1iZXItY29sdW1uJyxcclxuXHRcdHRleHQ6ICfmsYLlkownLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7XHJcblx0XHRcdGFsZXJ0KGNvbnRleHQuc3RvcmUuc3VtKGluZm8uZGF0YUluZGV4KSk7XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHRjbHM6ICdudW1iZXItY29sdW1uJyxcclxuXHRcdHRleHQ6ICflubPlnYcnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7XHJcblx0XHRcdGFsZXJ0KGNvbnRleHQuc3RvcmUuYXZnKGluZm8uZGF0YUluZGV4KSk7XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHRjbHM6ICdudW1iZXItY29sdW1uJyxcclxuXHRcdHRleHQ6ICfmnIDlpKflgLwnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7XHJcblx0XHRcdHZhciByZXQgPSBjb250ZXh0LnN0b3JlLm1heChpbmZvLmRhdGFJbmRleCk7XHJcblx0XHRcdGFsZXJ0KHJldC5kYXRhW2luZm8uZGF0YUluZGV4XSk7XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHRjbHM6ICdudW1iZXItY29sdW1uJyxcclxuXHRcdHRleHQ6ICfmnIDlsI/lgLwnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7XHJcblx0XHRcdHZhciByZXQgPSBjb250ZXh0LnN0b3JlLm1pbihpbmZvLmRhdGFJbmRleCk7XHJcblx0XHRcdGFsZXJ0KHJldC5kYXRhW2luZm8uZGF0YUluZGV4XSk7XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHRjbHM6ICdudW1iZXItY29sdW1uJyxcclxuXHRcdHRleHQ6ICfmlrnlt64nLCBcclxuXHRcdGRpc2FibGVkOiB0cnVlLFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHtcclxuXHRcdFx0Ly8gYWxlcnQoY29udGV4dC5zdG9yZS5zaXplKCkpO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0Y2xzOiAnbnVtYmVyLWNvbHVtbicsXHJcblx0XHR0ZXh0OiAn5qCH5YeG5beuJywgXHJcblx0XHRkaXNhYmxlZDogdHJ1ZSxcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7XHJcblx0XHRcdC8vIGFsZXJ0KGNvbnRleHQuc3RvcmUuc2l6ZSgpKTtcclxuXHRcdH0gXHJcblx0fV07XHJcblxyXG5jb25zdCBkZWZDZWxsQ29udGV4dE1lbnUgPSBbe1xyXG5cdFx0dGV4dDogJ2xvY2sgcm93IHRvIHRvcCcsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgY29uc29sZS5sb2coY29udGV4dC5fc2VsZWN0aW9uKTsgfSBcclxuXHR9LHsgXHJcblx0XHR0ZXh0OiAnbG9jayByb3cgdG8gYm90dG9tJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBjb25zb2xlLmxvZyhjb250ZXh0Ll9zZWxlY3Rpb24pOyB9IFxyXG5cdH0seyBcclxuXHRcdHRleHQ6ICdzZWFyY2gnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IGNvbnNvbGUubG9nKGNvbnRleHQuX3NlbGVjdGlvbik7IH0gXHJcblx0fSx7IFxyXG5cdFx0dGV4dDogJ21hcmsnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IGNvbnNvbGUubG9nKGNvbnRleHQuX3NlbGVjdGlvbik7IH0gXHJcblx0fV07XHRcclxuXHJcbmNvbnN0IGRlZlNlbGVjdGlvbkNvbnRleHRNZW51ID0gW3sgXHJcblx0XHR0ZXh0OiAn5aSN5Yi2JywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBcclxuXHRcdFx0Y29uc29sZS5sb2coaW5mbywgY29udGV4dC5fc2VsZWN0aW9uKTsgXHJcblx0XHRcdGNvbnRleHQuY29weVNlbGVjdGlvbihpbmZvKTtcclxuXHRcdH0gXHJcblx0fSx7IFxyXG5cdFx0dGV4dDogJ+aJk+WNsCcsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgXHJcblx0XHRcdGNvbnNvbGUubG9nKGV2dCwgZGF0YSwgY29udGV4dCk7XHJcblx0XHRcdHdpbmRvdy5wcmludCgpO1xyXG5cdFx0fSBcclxuXHR9LHsgXHJcblx0XHR0ZXh0OiAn5a+85Ye6JywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBcclxuXHRcdFx0bGV0IGRhdGEgPSBjb250ZXh0LnN0b3JlLnNsaWNlKDAsIDUwKTtcclxuXHRcdFx0Y29uc29sZS5sb2coY29udGV4dC5fc2VsZWN0aW9uKTsgXHJcblxyXG5cdFx0XHR0b0NTVihkYXRhLCBjb250ZXh0LmNvbHVtbk1vZGVsKTtcclxuXHRcdH0gXHJcblx0fSx7IFxyXG5cdFx0dGV4dDogJ+agh+iusCcsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgY29uc29sZS5sb2coY29udGV4dC5fc2VsZWN0aW9uKTsgfSBcclxuXHR9XTtcclxuXHJcblxyXG5jbGFzcyBDb250ZXh0bWVudSBleHRlbmRzIFNlbGVjdGlvbiB7XHJcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xyXG5cdFx0c3VwZXIob3B0aW9ucyk7XHJcblxyXG5cdFx0dGhpcy5jZWxsQ3R4TWVudSA9IG9wdGlvbnMuYml6Q29udGV4dE1lbnUuY2VsbDtcclxuXHJcblx0XHR0aGlzLmhlYWRlckN0eE1lbnUgPSB7XHJcblx0XHRcdGJlZm9yZTogZnVuY3Rpb24oaW5mbywgZXZ0KSB7XHJcblx0XHRcdFx0aWYgKGluZm8uY29sdW1uLnZ0eXBlID09PSAnbnVtYmVyJykge1xyXG5cdFx0XHRcdFx0dGhpcy5nZXRDbHMoJy5udW1iZXItY29sdW1uJykuc2hvdygpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR0aGlzLmdldENscygnLm51bWJlci1jb2x1bW4nKS5oaWRlKCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHRzdXBlci5fYmluZEV2ZW50KCk7XHJcblxyXG5cdFx0bGV0IHNlbGYgPSB0aGlzO1xyXG5cclxuXHRcdHRoaXMuJGNvbnRleHRtZW51SGVhZGVyID0gbmV3IE1lbnUodGhpcy4kZG9tLndyYXBwZXIsIHsgXHJcblx0XHRcdGRhdGE6IGRlZkhlYWRlckNvbnRleHRNZW51LCBcclxuXHRcdFx0Y29udGV4dDogdGhpcyBcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuJGNvbnRleHRtZW51ID0gbmV3IE1lbnUodGhpcy4kZG9tLmJvZHksIHsgXHJcblx0XHRcdGRhdGE6IFtdLCBcclxuXHRcdFx0Y29udGV4dDogdGhpcyBcclxuXHRcdH0pO1xyXG5cdFx0XHJcblx0XHR0aGlzLiRkb20ud3JhcHBlclxyXG5cdFx0XHQub24oJ2NvbnRleHRtZW51JywgJy5jLWhlYWRlci1jZWxsJywgXHJcblx0XHRcdFx0dGhpcy5faGVhZGVyQ29udGV4dE1lbnUuYmluZCh0aGlzKVxyXG5cdFx0XHQpO1xyXG5cclxuXHRcdHRoaXMuJGRvbS5ib2R5XHJcblx0XHRcdC5vbignY29udGV4dG1lbnUnLCAnLmMtZ3JpZC1jZWxsJywgXHJcblx0XHRcdFx0dGhpcy5fY2VsbENvbnRleHRNZW51LmJpbmQodGhpcywgZGVmQ2VsbENvbnRleHRNZW51KVxyXG5cdFx0XHQpXHJcblx0XHRcdC5vbignY29udGV4dG1lbnUnLCAnLmMtY2VsbC1zZWxlY3RlZCcsIFxyXG5cdFx0XHRcdHRoaXMuX2NlbGxDb250ZXh0TWVudS5iaW5kKHRoaXMsIGRlZlNlbGVjdGlvbkNvbnRleHRNZW51KVxyXG5cdFx0XHQpO1xyXG5cdH1cclxuXHJcblx0X2hlYWRlckNvbnRleHRNZW51KGV2dCkge1xyXG5cdFx0bGV0IGNvbE0gPSAkKGV2dC50YXJnZXQpLmRhdGEoJ2NvbHVtbicpO1xyXG5cdFx0bGV0IG1lbnUgPSB0aGlzLiRjb250ZXh0bWVudUhlYWRlcjtcclxuXHJcblx0XHRsZXQgaW5mbyA9IHsgXHJcblx0XHRcdCdkYXRhSW5kZXgnOiBjb2xNLmRhdGFJbmRleCwgXHJcblx0XHRcdCdjb2x1bW4nOiBjb2xNLFxyXG5cdFx0XHQnY29udGV4dCc6IG1lbnVcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLmZpcmUoJ2hlYWRlci1jb250ZXh0bWVudScsIGluZm8sIGV2dCk7XHJcblx0XHQvLyBjb25zb2xlLmxvZyhpbmZvKTtcclxuXHJcblx0XHRpZiAodGhpcy5oZWFkZXJDdHhNZW51LmJlZm9yZS5jYWxsKG1lbnUsIGluZm8sIGV2dCkpIHtcclxuXHRcdFx0XHJcblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0bWVudS5zZXRJbmZvKGluZm8pO1xyXG5cdFx0XHRtZW51LnNob3dBdChldnQpO1xyXG5cdFx0XHJcblx0XHRcdGRvY0V2ZW50KG1lbnUpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0X2NlbGxDb250ZXh0TWVudShkZWZDdHhNZW51LCBldnQpIHtcclxuXHRcdGxldCAkY2VsbCA9ICQoZXZ0LnRhcmdldCk7XHJcblx0XHRsZXQgZGF0YUluZGV4ID0gJGNlbGwuZGF0YSgnZGF0YUluZGV4Jyk7XHJcblx0XHRsZXQgY29sdW1uSWQgPSAkY2VsbC5kYXRhKCdjaWQnKTtcclxuXHRcdGxldCByb3dudW1iZXIgPSArJGNlbGwucGFyZW50KCcuYy1ncmlkLXJvdycpLmF0dHIoJ3JpZCcpO1xyXG5cdFx0bGV0IG1lbnUgPSB0aGlzLiRjb250ZXh0bWVudTtcclxuXHJcblx0XHRsZXQgaW5mbyA9IHsgXHJcblx0XHRcdCd2YWx1ZSc6ICRjZWxsLnRleHQoKSxcclxuXHRcdFx0J2RhdGFJbmRleCc6IGRhdGFJbmRleCwgXHJcblx0XHRcdCdjb2x1bW5JZCc6IGNvbHVtbklkLFxyXG5cdFx0XHQncm93bnVtYmVyJzogcm93bnVtYmVyLFxyXG5cdFx0XHQncm93SW5kZXgnOiByb3dudW1iZXIsXHJcblx0XHRcdCdjb250ZXh0JzogbWVudVxyXG5cdFx0fTtcclxuXHJcblx0XHR0aGlzLmZpcmUoJ2NlbGwtY29udGV4dG1lbnUnLCBpbmZvLCBldnQpO1xyXG5cdFx0Ly8gY29uc29sZS5sb2coaW5mbyk7XHJcblxyXG5cdFx0aWYgKHRoaXMuY2VsbEN0eE1lbnUuYmVmb3JlLmNhbGwobWVudSwgaW5mbywgZXZ0KSkge1xyXG5cclxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHRtZW51LnNldEluZm8oaW5mbyk7XHJcblx0XHRcdG1lbnUudXBkYXRlKGRlZkN0eE1lbnUuY29uY2F0KG1lbnUuZ2V0RGF0YSgpKSk7XHJcblx0XHRcdFxyXG5cdFx0XHRtZW51LnNob3dBdChldnQpO1xyXG5cdFx0XHJcblx0XHRcdGRvY0V2ZW50KG1lbnUpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHtcclxuXHRcdHN1cGVyLmRlc3RvcnkoKTtcclxuXHJcblx0XHR0aGlzLiRjb250ZXh0bWVudUhlYWRlci5kZXN0b3J5KCk7XHJcblx0XHR0aGlzLiRjb250ZXh0bWVudS5kZXN0b3J5KCk7XHJcblx0XHR0aGlzLmNlbGxDdHhNZW51ID0gbnVsbDtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGRvY0V2ZW50KCRjb250ZXh0bWVudSkge1xyXG5cdCQoZG9jdW1lbnQpLm9uKCdtb3VzZXVwLmNvbnRleHRtZW51Jywgb25Nb3VzZURvd24uYmluZChudWxsLCAkY29udGV4dG1lbnUpKTtcclxufVxyXG5cclxuZnVuY3Rpb24gb25Nb3VzZURvd24oJGNvbnRleHRtZW51KXtcclxuICAgICRjb250ZXh0bWVudS5oaWRlKCk7XHJcbiAgICAkKGRvY3VtZW50KS5vZmYoJ21vdXNldXAuY29udGV4dG1lbnUnKTtcclxufVxyXG5cclxuZnVuY3Rpb24gdG9DU1YoZGF0YSwgY29sTW9kZWwpIHtcclxuXHQvLyDmtYvor5VcclxuXHRKU29uVG9DU1Yuc2V0RGF0YUNvbnZlcih7XHJcblx0ICBkYXRhOiBkYXRhLm1hcChkID0+IGQuZGF0YSksXHJcblx0ICBmaWxlTmFtZTogJ3Rlc3QnLFxyXG5cdCAgY29sdW1uczoge1xyXG5cdCAgICB0aXRsZTogY29sTW9kZWwuZ2V0Q29sdW1uKCkubWFwKGNvbE0gPT4gY29sTS50ZXh0KSxcclxuXHQgICAga2V5OiBjb2xNb2RlbC5nZXRDb2x1bW4oKS5tYXAoY29sTSA9PiBjb2xNLmRhdGFJbmRleClcclxuXHQgICAgLy8gZm9ybWF0dGVyOiBmdW5jdGlvbihuLCB2KSB7XHJcblx0ICAgIC8vICAgaWYobiA9PT0gJ2Ftb250JyAmJiAhaXNOYU4oTnVtYmVyKHYpKSkge1xyXG5cdCAgICAvLyAgICAgdiA9IHYgKyAnJztcclxuXHQgICAgLy8gICAgIHYgPSB2LnNwbGl0KCcuJyk7XHJcblx0ICAgIC8vICAgICB2WzBdID0gdlswXS5yZXBsYWNlKC8oXFxkKSg/PSg/OlxcZHszfSkrJCkvZywgJyQxLCcpO1xyXG5cdCAgICAvLyAgICAgIHJldHVybiB2LmpvaW4oJy4nKTtcclxuXHQgICAgLy8gICB9XHJcblx0ICAgIC8vICAgaWYobiA9PT0gJ3Byb3BvcnRpb24nKSByZXR1cm4gdiArICclJztcclxuXHQgICAgLy8gfVxyXG5cdCAgfVxyXG5cdH0pO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENvbnRleHRtZW51OyIsInZhciBHcmlkVmlldyA9IHJlcXVpcmUoJy4uL2NvcmUvR3JpZFZpZXcnKTtcclxuXHJcbmNvbnN0IENFTExfQ0xTID0gJ2xpLmMtZ3JpZC1jZWxsJztcclxuY29uc3QgQ0VMTF9TRUxFQ1RFRF9DTFMgPSAnYy1jZWxsLXNlbGVjdGVkJztcclxuY29uc3QgUk9XX0NMUyA9ICcuYy1ncmlkLXJvdyc7XHJcblxyXG5jbGFzcyBTZWxlY3Rpb24gZXh0ZW5kcyBHcmlkVmlldyB7XHJcblxyXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcclxuXHRcdHN1cGVyKG9wdGlvbnMpO1xyXG5cclxuXHRcdHRoaXMuX2RlZmF1bHRzKCk7XHJcblx0fVxyXG5cclxuXHRfZGVmYXVsdHMoKSB7XHJcblx0XHR0aGlzLl9tb3ZpbmcgPSBmYWxzZTtcclxuXHRcdHRoaXMuX3N0YXJ0ID0gbnVsbDtcclxuXHRcdHRoaXMuX2VuZCA9IG51bGw7XHJcblx0XHR0aGlzLl9sYXN0WSA9IG51bGw7XHJcblxyXG5cdFx0dGhpcy5fc2VsZWN0aW9uID0gW107XHJcblx0XHR0aGlzLl9zZWxlY3RZID0gW107XHJcblx0XHR0aGlzLl9zZWxlY3RDb2x1bW5zID0gW107XHJcblx0fVxyXG5cclxuXHRnZXRTZWxlY3Rpb24oKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fc2VsZWN0aW9uO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICog5aSN5Yi26YCJ5qGG5YaF5a65XHJcblx0ICogQHBhcmFtIHtPYmplY3R9IGluZm8gLXtjb2x1bW5JZCwgcm93SW5kZXh9XHJcblx0ICovXHJcblx0Y29weVNlbGVjdGlvbihpbmZvKSB7XHJcblx0XHRpZiAoIXRoaXMuaXNJblJhbmdlKGluZm8pKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHRsZXQgdmFsdWVzID0gdGhpcy5fY29weUNvbnRlbnQoKTtcclxuXHJcblx0XHRsZXQgdGEgPSAkKCc8dGV4dGFyZWE+JykudmFsKHZhbHVlcykuYXBwZW5kVG8odGhpcy4kZG9tLmJvZHkpLmZvY3VzKCk7XHJcblx0XHR0YS5nZXQoMCkuc2V0U2VsZWN0aW9uUmFuZ2UoMCwgdmFsdWVzLmxlbmd0aCk7XHJcblx0XHRkb2N1bWVudC5leGVjQ29tbWFuZCgnY29weScsIHRydWUpO1xyXG5cdFx0dGEucmVtb3ZlKCk7XHJcblx0fVxyXG5cclxuXHRpc0luUmFuZ2UoaW5mbykge1xyXG5cdFx0cmV0dXJuIHRoaXMuX3NlbGVjdENvbHVtbnMuaW5kZXhPZihpbmZvLmNvbHVtbklkKSAhPT0gLTFcclxuXHRcdFx0JiYgaW5mby5yb3dJbmRleCA+PSB0aGlzLl9zZWxlY3RZWzBdXHJcblx0XHRcdCYmIGluZm8ucm93SW5kZXggPD0gdGhpcy5fc2VsZWN0WVsxXVxyXG5cdH1cclxuXHJcblx0X2NvcHlDb250ZW50KCkge1xyXG5cdFx0bGV0IGNvbHMgPSB0aGlzLl9zZWxlY3RDb2x1bW5zLm1hcChjaWQgPT4ge1xyXG5cdFx0XHRsZXQgY29sID0gdGhpcy5jb2x1bW5Nb2RlbC5nZXRDb2x1bW5zQnlJZChjaWQpXHJcblxyXG5cdFx0XHRpZiAoIWNvbCkgeyB0aHJvdyBgbm90IGZpbmQgY29sdW1uSWQ6ICR7Y2lkfSBpbiBjb2x1bW5zYCB9O1xyXG5cclxuXHRcdFx0cmV0dXJuIGNvbDtcclxuXHRcdH0pO1xyXG5cclxuXHRcdGxldCB2YWx1ZXMgPSBjb2xzLm1hcChjb2wgPT4gcGlja1RleHQoY29sLnRleHQpKS5qb2luKCdcXHQnKTtcclxuXHJcblx0XHR0aGlzLl9zZWxlY3Rpb24uZm9yRWFjaChyb3cgPT4ge1xyXG5cdFx0XHR2YWx1ZXMgKz0gJ1xcclxcbic7XHJcblxyXG5cdFx0XHRyb3cuZm9yRWFjaCgodmFsdWUsIGkpID0+IHtcclxuXHRcdFx0XHR2YWx1ZXMgKz0gcGlja1RleHQoY29sc1tpXS5yZW5kZXJlcih2YWx1ZSwgeyByb3dJbmRleDogMH0sIHsgZGF0YTogcm93IH0pKSArICdcXHQnO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHJldHVybiB2YWx1ZXM7XHJcblx0fVxyXG5cdFxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHRzdXBlci5fYmluZEV2ZW50KCk7XHJcblxyXG5cdFx0bGV0IHNlbGYgPSB0aGlzO1xyXG5cclxuXHRcdHRoaXMuY29sdW1uTW9kZWwub24oJ25vdGljZS1jb2xNb2RlbC1zb3J0LWNoYW5nZWQnLCAoKSA9PiB7XHJcblx0XHRcdHRoaXMuX2RlZmF1bHRzKCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmNvbHVtbk1vZGVsLm9uKCdjb2x1bW4tbW92ZWQnLCAoKSA9PiB7XHJcblx0XHRcdHRoaXMuX2RlZmF1bHRzKCk7XHJcblx0XHRcdHRoaXMuJGRvbS5jYW52YXMuZmluZChDRUxMX0NMUykucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kZG9tLmNhbnZhc1xyXG5cdFx0XHQub24oJ21vdXNlZG93bicsIENFTExfQ0xTLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRpZiAoZXZ0LmJ1dHRvbiA9PT0gMCkge1xyXG5cdFx0XHRcdFx0c2VsZi4kZG9tLmNhbnZhcy5maW5kKENFTExfQ0xTKS5yZW1vdmVDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdFx0XHRzZWxmLl9tb3ZpbmcgPSB0cnVlO1xyXG5cdFx0XHRcdFx0bGV0ICRjZWxsID0gJCh0aGlzKS5hZGRDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdFx0XHRzZWxmLl9zdGFydCA9IHNlbGYuX2VuZCA9IFskY2VsbC5kYXRhKCdjaWQnKSwgKyRjZWxsLnBhcmVudChST1dfQ0xTKS5hdHRyKCdyaWQnKV07XHJcblx0XHRcdFx0XHQvLyBjb25zb2xlLmxvZyhzdGFydCk7XHJcblx0XHRcdFx0fSBcclxuXHRcdFx0XHRlbHNlIGlmIChldnQuYnV0dG9uID09PSAyKSB7XHJcblx0XHRcdFx0XHRcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pXHJcblx0XHRcdC5vbignbW91c2VlbnRlcicsIENFTExfQ0xTLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRpZiAoc2VsZi5fbW92aW5nKSB7XHJcblx0XHRcdFx0XHRsZXQgJGNlbGwgPSAkKHRoaXMpO1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0XHQkY2VsbC5hZGRDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdFx0XHRzZWxmLl9lbmQgPSBbJGNlbGwuZGF0YSgnY2lkJyksICskY2VsbC5wYXJlbnQoUk9XX0NMUykuYXR0cigncmlkJyldO1xyXG5cclxuXHRcdFx0XHRcdHNlbGYuc2VsZWN0aW9uUmFuZ2Uoc2VsZi5fc3RhcnQsIHNlbGYuX2VuZCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KVxyXG5cdFx0XHQub24oJ21vdXNldXAnLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRzZWxmLl9tb3ZpbmcgPSBmYWxzZTtcclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyhlbmQpO1xyXG5cdFx0XHRcdGNvbnNvbGUubG9nKHNlbGYuX3NlbGVjdGlvbik7XHJcblx0XHRcdFx0Ly8gVE9ET1xyXG5cdFx0XHRcdC8vIGNvcHkoJCgnLmNlbGwuc2VsZWN0ZWQnKSk7XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuYnVmZmVyTm9kZS5vbigncm93LXVwZGF0ZS1iZWZvcmUnLCAocm93Tm9kZSwgcm93KSA9PiB7XHJcblx0XHRcdC8vIGNvbnNvbGUubG9nKHJvd05vZGUuJG5vZGUsIHJvdy5yaWQsIHRoaXMuX3NlbGVjdFkpO1xyXG5cclxuXHRcdFx0aWYgKHRoaXMuX3NlbGVjdGlvbi5sZW5ndGggPT09IDApIHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHJcblx0XHRcdGxldCBpID0gcm93LnJpZDtcclxuXHRcdFx0bGV0IFt5MCwgeTFdID0gdGhpcy5fc2VsZWN0WTtcclxuXHRcdFx0bGV0IGNvbHMgPSB0aGlzLl9zZWxlY3RDb2x1bW5zO1xyXG5cclxuXHRcdFx0aWYgKGkgPj0geTAgJiYgaSA8IHkxICsgMSkge1xyXG5cdFx0XHRcdGNvbHMuZm9yRWFjaCgoY29sKSA9PiB7XHJcblx0XHRcdFx0XHRyb3dOb2RlLmNoaWxkcmVuLmZvckVhY2goKCRjZWxsLCBjb2xNKSA9PiB7XHJcblx0XHRcdFx0XHRcdGlmIChjb2xzLmluZGV4T2YoY29sTS5jaWQpICE9IC0xKSB7XHJcblx0XHRcdFx0XHRcdFx0JGNlbGwuYWRkQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdCRjZWxsLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0cm93Tm9kZS4kbm9kZS5maW5kKENFTExfQ0xTKS5yZW1vdmVDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdH1cclxuXHJcblx0XHR9KTtcclxuXHRcdFxyXG5cdH1cclxuXHJcblx0c2VsZWN0aW9uUmFuZ2UoW3gwLCB5MF0sIFt4MSwgeTFdKSB7XHJcblxyXG5cdFx0bGV0IHlEaXIgPSB5MSAtIHkwO1xyXG5cdFx0bGV0IGxhc3RZID0gdGhpcy5fbGFzdFk7XHJcblx0XHRcdFxyXG5cdFx0Ly8geVJhbmdlID0geyBsYXN0OiAsIG5vdzogW3kwLCB5MV0gfTtcclxuXHRcdC8vIFtsMCwgbDFdXHJcblx0XHQvLyBbeTAsIHkxXVxyXG5cdFx0Ly8gW2wwLCBsMV1cclxuXHRcdGxldCByZW1vdmVZUmFuZ2UgPSBbXTtcclxuXHRcdC8vIGRvd25cclxuXHRcdGlmICh5RGlyID49IDAgJiYgeTEgPCBsYXN0WSkge1xyXG5cdFx0XHRyZW1vdmVZUmFuZ2UgPSBbeTEsIGxhc3RZXTtcclxuXHRcdH1cclxuXHRcdC8vIHVwXHJcblx0XHRpZiAoeURpciA8PSAwICYmIHkxID4gbGFzdFkpIHtcclxuXHRcdFx0cmVtb3ZlWVJhbmdlID0gW2xhc3RZLCB5MV07XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdHRoaXMuX2xhc3RZID0geTE7XHJcblx0XHQvLyBjb25zb2xlLmxvZyh5RGlyLCByZW1vdmVZUmFuZ2UpO1xyXG5cclxuXHRcdGxldCBjb2x1bW5JZHMgPSB0aGlzLmdldExvY2tBbmRWaXNpYWJsZUNvbHVtbkFzQ2lkKCk7XHJcblx0XHRbeDAsIHkwLCB4MSwgeTFdID0gb3JkZXJCeSh4MCwgeTAsIHgxLCB5MSwgY29sdW1uSWRzKTtcclxuXHJcblxyXG5cdFx0bGV0IGNvbHMgPSB0aGlzLl9zZWxlY3RDb2x1bW5zID0gY29sdW1uSWRzLnNsaWNlKGNvbHVtbklkcy5pbmRleE9mKHgwKSwgY29sdW1uSWRzLmluZGV4T2YoeDEpKzEpO1xyXG5cdFx0Ly8gY29uc29sZS5sb2coY29scyk7XHJcblxyXG5cdFx0dGhpcy5fc2VsZWN0WSA9IFt5MCwgeTEgKyAxXTtcclxuXHRcdGxldCByb3dzID0gdGhpcy5zdG9yZS5zbGljZSh5MCwgeTEgKyAxKTtcclxuXHJcblx0XHR0aGlzLl9zZWxlY3Rpb24gPSByb3dzLm1hcChyb3cgPT4ge1xyXG5cdFx0XHRyZXR1cm4gY29scy5tYXAoY29sID0+IHtcclxuXHRcdFx0XHRyZXR1cm4gcm93LmRhdGFbdGhpcy5jb2x1bW5Nb2RlbC5nZXRDb2x1bW5zQnlJZChjb2wpLmRhdGFJbmRleF07XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5fcmVQYWludE5vZGUoeURpciwgeTAsIHkxLCByZW1vdmVZUmFuZ2UsIGNvbHMpO1xyXG5cdH1cclxuXHJcblx0X3JlUGFpbnROb2RlKHlEaXIsIHkwLCB5MSwgcmVtb3ZlWVJhbmdlLCBjb2xzKSB7XHJcblx0XHRsZXQgbm9kZUxpc3QgPSB0aGlzLmJ1ZmZlck5vZGUuZ2V0Tm9kZUxpc3QoKTtcclxuXHRcdG5vZGVMaXN0LmZvckVhY2goKHJvd05vZGUpID0+IHtcclxuXHRcdFx0bGV0ICRyb3cgPSByb3dOb2RlLiRub2RlO1xyXG5cdFx0XHRsZXQgaSAgPSArJHJvdy5hdHRyKCdyaWQnKTtcclxuXHRcdFx0XHJcblx0XHRcdGlmIChpID49IHkwICYmIGkgPCB5MSArIDEpIHtcclxuXHRcdFx0XHRjb2xzLmZvckVhY2goKGNvbCkgPT4ge1xyXG5cdFx0XHRcdFx0cm93Tm9kZS5jaGlsZHJlbi5mb3JFYWNoKCgkY2VsbCwgY29sTSkgPT4ge1xyXG5cdFx0XHRcdFx0XHRpZiAoY29scy5pbmRleE9mKGNvbE0uY2lkKSAhPSAtMSkge1xyXG5cdFx0XHRcdFx0XHRcdCRjZWxsLmFkZENsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHQkY2VsbC5yZW1vdmVDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUylcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICh5RGlyID49IDAgJiYgaSA+IHJlbW92ZVlSYW5nZVswXSAmJiBpIDw9cmVtb3ZlWVJhbmdlWzFdICkge1xyXG5cdFx0XHRcdCRyb3cuZmluZChDRUxMX0NMUykucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICh5RGlyIDw9IDAgJiYgaSA+PSByZW1vdmVZUmFuZ2VbMF0gJiYgaSA8cmVtb3ZlWVJhbmdlWzFdICkge1xyXG5cdFx0XHRcdCRyb3cuZmluZChDRUxMX0NMUykucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHQvKlxyXG5cdCAqIGxvY2sgKyB2aXNpYWJsZSA9IGNvbHVtbnNcclxuXHQgKiBAcGFyYW0ge0FycmF5fSBjb2x1bW5zIC1bZGF0YUluZGV4Li4uXVxyXG5cdCAqL1xyXG5cdGdldExvY2tBbmRWaXNpYWJsZUNvbHVtbkFzQ2lkKCkge1xyXG5cdFx0bGV0IGNvbHMgPSBbXTtcclxuXHJcblx0XHR0aGlzLmxvY2tDb2xNYW5hZ2VyXHJcblx0XHRcdC52aXNpYmxlTG9ja0NvbHVtblxyXG5cdFx0XHQuZWFjaChjb2xNID0+IGNvbHMudW5zaGlmdChjb2xNLmNpZCkpO1xyXG5cclxuXHRcdGxldCB2aXNpYWJsZUNvbHMgPSB0aGlzLmNvbHVtbk1vZGVsXHJcblx0XHRcdC5nZXRWaXNpYmxlQ29sdW1uKClcclxuXHRcdFx0Lm1hcChjb2xNID0+IGNvbE0uY2lkKVxyXG5cdFx0XHQuZmlsdGVyKGNpZCA9PiBjb2xzLmluZGV4T2YoY2lkKSA9PSAtMSk7XHJcblxyXG5cdFx0cmV0dXJuIGNvbHMuY29uY2F0KHZpc2lhYmxlQ29scyk7XHJcblx0fVxyXG5cclxuXHRkZXN0b3J5KCkge1xyXG5cdFx0c3VwZXIuZGVzdG9yeSgpO1xyXG5cclxuXHRcdHRoaXMuX2RlZmF1bHRzKCk7XHJcblx0fVxyXG5cclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIHN3YXAoYSwgYikge1xyXG5cdHJldHVybiBbYiwgYV07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9yZGVyQnkoeDAsIHkwLCB4MSwgeTEsIGNvbElkcykge1xyXG5cdGlmIChjb2xJZHMuaW5kZXhPZih4MCkgPiBjb2xJZHMuaW5kZXhPZih4MSkpIHtcclxuXHRcdFt4MCwgeDFdID0gc3dhcCh4MCwgeDEpO1xyXG5cdH1cclxuXHRpZiAoeTAgPiB5MSkge1xyXG5cdFx0W3kwLCB5MV0gPSBzd2FwKHkwLCB5MSk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gW3gwLCB5MCwgeDEsIHkxXTtcclxufVxyXG5cclxuZnVuY3Rpb24gcGlja1RleHQoZnJhZ21lbnQpIHtcclxuXHR2YXIgaHRtbFN0cmluZyA9IG5ldyBSZWdFeHAoJ1xcPC4rP1xcPicsICdnJyk7XHJcblx0aWYgKGh0bWxTdHJpbmcudGVzdChmcmFnbWVudCkpIHtcclxuXHRcdHJldHVybiBmcmFnbWVudC5yZXBsYWNlKGh0bWxTdHJpbmcsICcnKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiBmcmFnbWVudDtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBTZWxlY3Rpb247IiwiLy8gZXhwb3J0cy5HcmlkU3RvcmUgPSByZXF1aXJlKCcuL2NvcmUvR3JpZFN0b3JlJyk7XHJcbi8vIGV4cG9ydHMuR3JpZFZpZXcgPSByZXF1aXJlKCcuL2NvcmUvR3JpZFZpZXcnKTtcclxuLy8gbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2V4dGVuZHMvU2VsZWN0aW9uJyk7XHJcbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9leHRlbmRzL0NvbnRleHRtZW51Jyk7XHJcblxyXG4vLyBleHBvcnQgeyBkZWZhdWx0IH0gZm9ybSAnLi9wbHVnaW4vQ29udGV4dG1lbnUnO1xyXG4iLCJ2YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydqUXVlcnknXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ2pRdWVyeSddIDogbnVsbCk7XHJcbnZhciBVdGlscyA9IHJlcXVpcmUoJy4uL3V0aWwvVXRpbHMnKTtcclxuXHJcblxyXG5jbGFzcyBNZW51IHtcclxuXHRjb25zdHJ1Y3Rvcigkd3JhcHBlciwgeyBkYXRhLCBjb250ZXh0IH0pIHtcclxuXHRcdHRoaXMucGFyYW1zID0ge307XHJcblx0XHR0aGlzLiRtZW51ID0gJChudWxsKTtcclxuXHRcdHRoaXMuJHdyYXBwZXIgPSAkd3JhcHBlcjtcclxuXHRcdHRoaXMuX2RhdGEgPSBkYXRhIHx8IFtdO1xyXG5cdFx0dGhpcy5jb250ZXh0ID0gY29udGV4dDtcclxuXHJcblx0XHR0aGlzLnVwZGF0ZShkYXRhKTtcclxuXHR9XHJcblxyXG5cdHVwZGF0ZShkYXRhKSB7XHJcblx0XHR0aGlzLiRtZW51LnJlbW92ZSgpOyAvLyBUT0RPIOS8mOWMluWkjeeUqOiKgueCuVxyXG5cdFx0XHJcblx0XHRpZiAoQXJyYXkuaXNBcnJheShkYXRhKSAmJiBkYXRhLmxlbmd0aCA+IDApIHtcclxuXHRcdFx0dGhpcy4kbWVudSA9IGNvbXBpbGVNZW51KGRhdGEsIHRoaXMpO1xyXG5cclxuXHRcdFx0dGhpcy4kd3JhcHBlci5hcHBlbmQodGhpcy4kbWVudSk7XHJcblxyXG5cdFx0XHR0aGlzLl9kYXRhID0gZGF0YTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoaXMuX2RhdGEgPSBbXTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdG1lcmdlKGRhdGEpIHtcclxuXHRcdHRoaXMuX2RhdGEgPSB0aGlzLl9kYXRhLmZpbHRlcihpdGVtID0+IHtcclxuXHRcdFx0cmV0dXJuICFkYXRhLmluY2x1ZGVzKGl0ZW0pO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5fZGF0YSA9IGRhdGEuY29uY2F0KHRoaXMuX2RhdGEpO1xyXG5cdFx0dGhpcy51cGRhdGUodGhpcy5fZGF0YSk7XHJcblx0fVxyXG5cclxuXHRzZXRJbmZvKGluZm8pIHtcclxuXHRcdHRoaXMuJGluZm8gPSBpbmZvO1xyXG5cdH1cclxuXHJcblx0Z2V0SW5mbygpIHtcclxuXHRcdHJldHVybiB0aGlzLiRpbmZvO1xyXG5cdH1cclxuXHJcblx0Z2V0RGF0YSgpIHtcclxuXHRcdHJldHVybiB0aGlzLl9kYXRhO1xyXG5cdH1cclxuXHJcblx0Z2V0Q2xzKGNsYXNzTmFtZSkge1xyXG5cdFx0cmV0dXJuIHRoaXMuJG1lbnUuZmluZChjbGFzc05hbWUpO1xyXG5cdH1cclxuXHJcblx0c2hvd0F0KGV2dCkge1xyXG5cdFx0aWYgKCF0aGlzLl9kYXRhLmxlbmd0aCkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0bGV0IHggPSBldnQuY2xpZW50WCAtIHRoaXMuJHdyYXBwZXIub2Zmc2V0KCkubGVmdDtcclxuXHRcdGxldCB5ID0gZXZ0LmNsaWVudFkgLSB0aGlzLiR3cmFwcGVyLm9mZnNldCgpLnRvcDtcclxuXHJcblx0ICAgIHRoaXMuJG1lbnVcclxuXHQgICAgXHQuYWRkQ2xhc3MoJ3Nob3ctbWVudScpXHJcblx0ICAgIFx0LmNzcyh7ICdsZWZ0JzogeCArICdweCcsICd0b3AnOiB5ICsgJ3B4JyB9KTtcclxuXHR9XHJcblxyXG5cdGhpZGUoKSB7XHJcblx0XHR0aGlzLiRtZW51LnJlbW92ZUNsYXNzKCdzaG93LW1lbnUnKTtcclxuXHR9XHJcblxyXG5cdGdldERvbSgpIHtcclxuXHRcdHJldHVybiB0aGlzLiRtZW51O1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHtcclxuXHRcdHRoaXMuJG1lbnUuZW1wdHkoKTtcclxuXHR9XHJcblxyXG59XHJcblxyXG5cclxuY29uc3QgZW1wdHlGbiA9IChldnQpID0+IHsgXHJcblx0ZXZ0LnByZXZlbnREZWZhdWx0O1xyXG5cdHJldHVybiBmYWxzZTsgXHJcbn07XHJcblxyXG5mdW5jdGlvbiBjb252ZXJ0KGl0ZW0pIHtcclxuXHRsZXQgZGVmSXRlbSA9IHtcclxuXHRcdCdpZCc6ICdjbS1pZC0nICsgRGF0ZS5ub3coKSxcclxuXHRcdCd0ZXh0JzogJycsXHJcblx0XHQnaWNvbkNscyc6ICcnLFxyXG5cdFx0J2hpZGRlbic6IGZhbHNlLFxyXG5cdFx0J2Rpc2FibGVkJzogZmFsc2UsXHJcblx0XHQnaGFuZGxlcic6IGZ1bmN0aW9uKCkge31cclxuXHR9O1xyXG5cclxuXHRyZXR1cm4gT2JqZWN0LmFzc2lnbihkZWZJdGVtLCBpdGVtKTtcclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlSXRlbShpdGVtLCB2bSkge1xyXG5cdGxldCAkaXRlbSA9ICQoJzxsaS8+JylcclxuXHRcdFx0LmF0dHIoJ2lkJywgaXRlbS5pZClcclxuXHRcdFx0LmFkZENsYXNzKCdjLW1lbnUtaXRlbScpXHJcblx0XHRcdC5hZGRDbGFzcyhpdGVtLmRpc2FibGVkID8gJ2Rpc2FibGVkJzogJycpO1xyXG5cclxuICAgIGxldCAkYnV0dG9uID0gJCgnPGJ1dHRvbi8+JykuYWRkQ2xhc3MoJ2MtbWVudS1idG4nKVxyXG4gICAgXHRcdC5hcHBlbmQoYDxpIGNsYXNzPVwiZmEgJHtpdGVtLmljb25DbHN9XCI+PC9pPmApXHJcbiAgICBcdFx0LmFwcGVuZChgPHNwYW4gY2xhc3M9XCJjLW1lbnUtdGV4dFwiPiR7aXRlbS50ZXh0fTwvc3Bhbj5gKVxyXG4gICAgXHRcdC5vbignY2xpY2snLCAoZXZ0KSA9PiB7XHJcbiAgICBcdFx0XHRpdGVtLmhhbmRsZXIuY2FsbCh2bSwgdm0uZ2V0SW5mbygpLCB2bS5jb250ZXh0LCBldnQpO1xyXG4gICAgXHRcdH0pO1xyXG5cclxuICAgIHJldHVybiAkaXRlbS5hcHBlbmQoJGJ1dHRvbik7XHJcbn07XHJcblxyXG5mdW5jdGlvbiBjb21waWxlTWVudShtZW51cywgdm0pIHtcclxuXHRpZiAobWVudXMgJiYgbWVudXMubGVuZ3RoID09PSAwKSByZXR1cm4gJChudWxsKTtcclxuXHRcclxuXHRsZXQgJG1lbnVzID0gJCgnPG1lbnUvPicpLmFkZENsYXNzKCdjLW1lbnUnKTtcclxuXHRsZXQgJG1lbnVTZXBhcmF0b3IgPSAkKCc8bGkvPicpLmFkZENsYXNzKCdjLW1lbnUtc2VwYXJhdG9yJyk7XHJcblx0XHJcblx0bWVudXMuZm9yRWFjaChtZW51ID0+IHtcclxuXHRcdGlmIChtZW51LnNlcGFyYXRvcikge1xyXG5cdFx0XHRyZXR1cm4gJG1lbnVzLmFwcGVuZCgkbWVudVNlcGFyYXRvcik7XHJcblx0XHR9XHJcblxyXG5cdFx0bGV0ICRtZW51ID0gY3JlYXRlSXRlbShjb252ZXJ0KG1lbnUpLCB2bSk7XHJcblx0XHRsZXQgY2hpbGRyZW47XHJcblxyXG5cdFx0aWYgKG1lbnUuY2hpbGRyZW4pIHtcclxuXHRcdFx0Y2hpbGRyZW4gPSBjb21waWxlTWVudShtZW51LmNoaWxkcmVuLCB2bSk7XHJcblxyXG5cdFx0XHRpZiAoY2hpbGRyZW4pIHtcclxuXHRcdFx0XHQkbWVudS5hZGRDbGFzcygnc3VibWVudScpLmFwcGVuZChjaGlsZHJlbik7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0JG1lbnVzLmFwcGVuZCgkbWVudSk7XHJcblx0fSk7XHJcblxyXG5cdHJldHVybiAkbWVudXM7XHJcbn1cclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IE1lbnU7IiwiJ3VzZSBzdHJpY3QnO1xyXG5jb25zdCAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ2pRdWVyeSddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnalF1ZXJ5J10gOiBudWxsKTtcclxuXHJcbmNvbnN0IEZMRVhNSU5XSURUSCA9IDM1O1xyXG5cclxudmFyIGRyYWdEcm9wID0gZnVuY3Rpb24oZXZ0LCBvcHRzKSB7XHJcblx0dmFyIGRvYyA9ICQoZG9jdW1lbnQpO1xyXG5cdHZhciBzY3JvbGxMZWZ0ID0gZG9jdW1lbnQuYm9keS5zY3JvbGxMZWZ0IHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0O1xyXG5cdHZhciBzY3JvbGxUb3AgPSBkb2N1bWVudC5ib2R5LnNjcm9sbFRvcCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsVG9wO1xyXG5cdHZhciBsZWZ0T2Zmc2V0ID0gJChldnQudGFyZ2V0KS5vZmZzZXQoKS5sZWZ0IC0gc2Nyb2xsTGVmdDtcclxuXHR2YXIgaVgsIGlZLCBzdGFydFgsIGVuZFg7XHJcblx0dmFyIGRyYWdnaW5nID0gdHJ1ZTtcclxuXHJcblx0c3RhcnRYID0gaVggPSBldnQuY2xpZW50WCAtIHNjcm9sbExlZnQ7XHJcblx0aVkgPSAkKGV2dC50YXJnZXQpLm9mZnNldCgpLnRvcCAtIHNjcm9sbFRvcDtcclxuXHJcblx0b3B0cy5vbkRyYWdTdGFydCh7ICd4Jzogc3RhcnRYIH0sIG9wdHMuJGVsZW1lbnQpO1xyXG5cclxuXHRkb2Mub24oJ21vdXNlbW92ZS5kcmFnZHJvcCcsICQucHJveHkobW91c2Vtb3ZlLCB0aGlzKSk7XHJcblx0ZG9jLm9uKCdtb3VzZXVwLmRyYWdkcm9wJywgJC5wcm94eShtb3VzZXVwLCB0aGlzKSk7XHJcblx0Ly8gJChldnQudGFyZ2V0KVswXS5zZXRDYXB0dXJlICYmICQoZXZ0LnRhcmdldClbMF0uc2V0Q2FwdHVyZSgpO1xyXG5cclxuXHRmdW5jdGlvbiBtb3VzZW1vdmUoZSkge1xyXG5cdFx0aWYgKGRyYWdnaW5nKSB7XHJcblx0XHRcdGVuZFggPSBlLmNsaWVudFggLSBzY3JvbGxMZWZ0O1xyXG5cclxuXHRcdFx0Ly8gbGltaXRcclxuXHRcdFx0aWYgKGVuZFggLSBsZWZ0T2Zmc2V0IDwgRkxFWE1JTldJRFRIKSB7XHJcblx0XHRcdFx0ZW5kWCA9IGxlZnRPZmZzZXQgKyBGTEVYTUlOV0lEVEg7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdG9wdHMub25EcmFnZ2luZyggeyAneCc6IGVuZFggfSwgb3B0cy4kZWxlbWVudCk7XHJcblx0XHR9XHJcblxyXG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIG1vdXNldXAoZXZ0KSB7XHJcblx0XHR2YXIgZSA9IGV2dC50YXJnZXQ7XHJcblx0XHRkcmFnZ2luZyA9IGZhbHNlO1xyXG5cclxuXHRcdG9wdHMub25EcmFnRW5kKHsgJ3gnOiBldnQuY2xpZW50WCAtIHNjcm9sbExlZnQgfSwgb3B0cy4kZWxlbWVudCk7XHJcblxyXG5cdFx0aWYgKGUgJiYgZS5zZXRDYXB0dXJlKSB7XHJcblx0XHRcdGUucmVsZWFzZUNhcHR1cmUoKTtcclxuXHRcdH0gZWxzZSBpZiAod2luZG93LnJlbGVhc2VDYXB0dXJlKSB7XHJcblx0XHRcdHdpbmRvdy5yZWxlYXNlQ2FwdHVyZShFdmVudC5NT1VTRU1PVkUgfCBFdmVudC5NT1VTRVVQKTtcclxuXHRcdH1cclxuXHJcblx0XHRkb2Mub2ZmKCdtb3VzZW1vdmUuZHJhZ2Ryb3AnLCBtb3VzZW1vdmUpO1xyXG5cdFx0ZG9jLm9mZignbW91c2V1cC5kcmFnZHJvcCcsIG1vdXNldXApO1xyXG5cdH1cclxuXHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihkZWxlZ2F0ZSwgb3B0aW9ucykge1xyXG5cdHZhciBkZWZhdWx0cyA9IHtcclxuXHRcdHJlc3RyaWN0ZXIoZXZ0KSB7IHJldHVybiBudWxsOyB9LFxyXG5cdFx0b25EcmFnU3RhcnQob2Zmc2V0LCB0YXJnZXQpIHt9LFxyXG5cdFx0b25EcmFnZ2luZyhvZmZzZXQsIHRhcmdldCkge30sXHJcblx0XHRvbkRyYWdFbmQob2Zmc2V0LCB0YXJnZXQpIHt9XHJcblx0fTtcclxuXHJcblx0T2JqZWN0LmFzc2lnbihkZWZhdWx0cywgb3B0aW9ucyk7XHJcblxyXG5cdCQoZGVsZWdhdGUpLm9uKCdtb3VzZWRvd24nLCBvcHRpb25zLnRyaWdnZXIsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0dmFyIHJlc3RyaWN0ZXIgPSBkZWZhdWx0cy5yZXN0cmljdGVyLmNhbGwodGhpcywgZXZ0KTtcclxuXHJcblx0XHRpZiAocmVzdHJpY3Rlcikge1xyXG5cdFx0XHRkZWZhdWx0cy4kZWxlbWVudCA9IHJlc3RyaWN0ZXI7XHJcblx0XHRcdGRyYWdEcm9wLmNhbGwodGhpcywgZXZ0LCBkZWZhdWx0cyk7XHJcblx0XHR9XHJcblx0fSk7XHJcbn07IiwiLyoqXHJcbiAqIOS6i+S7tueuoeeQhlxyXG4gKiBAY2xhc3MgRXZlbnRFbWl0dGVyXHJcbiAqL1xyXG5cclxuZnVuY3Rpb24gaW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVycywgbGlzdGVuZXIpIHtcclxuXHR2YXIgaSA9IGxpc3RlbmVycy5sZW5ndGg7XHJcblx0d2hpbGUgKGktLSkge1xyXG5cdFx0aWYgKGxpc3RlbmVyc1tpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHtcclxuXHRcdFx0cmV0dXJuIGk7XHJcblx0XHR9XHJcblx0fVxyXG5cdHJldHVybiAtMTtcclxufVxyXG5cclxuZnVuY3Rpb24gaXNWYWxpZExpc3RlbmVyKGxpc3RlbmVyKSB7XHJcblx0aWYgKHR5cGVvZiBsaXN0ZW5lciA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fSBlbHNlIGlmIChsaXN0ZW5lciAmJiB0eXBlb2YgbGlzdGVuZXIgPT09ICdvYmplY3QnKSB7XHJcblx0XHRyZXR1cm4gaXNWYWxpZExpc3RlbmVyKGxpc3RlbmVyLmxpc3RlbmVyKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxufVxyXG5cclxuY2xhc3MgRXZlbnRFbWl0dGVyIHtcclxuXHJcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xyXG5cclxuXHR9XHJcblx0LyoqXHJcblx0KlxyXG5cdCpcclxuXHQqXHJcblx0KlxyXG5cdCovXHJcblx0X2dldEV2ZW50cygpIHtcclxuXHRcdHJldHVybiB0aGlzLl9ldmVudHMgfHwgKHRoaXMuX2V2ZW50cyA9IHt9KTtcclxuXHR9XHJcblx0LyoqXHJcblx0KiDpgJrov4fkuovku7blkI3ojrflj5ZsaXN0ZW5lciDmlbDnu4TmiJbliJ3lp4vljJZcclxuXHQqIOS9v+eUqOato+WImeWMuemFjeS8mui/lOWbnuS4gOS4quWvueW6lOeahOWvueixoVxyXG5cdCpcclxuXHQqIFxyXG5cdCogZ2V0TGlzdGVuZXJzXHJcblx0KiBAcGFyYW0ge1N0cmluZyB9IFJlZ0V4cH0gZXZlbnROYW1lXHJcblx0KiBAcmV0dXJuIHtGdW5jdG9uW10gfCBPYmplY3R9XHJcblx0KlxyXG5cdCovXHJcblx0Z2V0TGlzdGVuZXJzKG5hbWUpIHtcclxuXHRcdHZhciBldmVudHMgPSB0aGlzLl9nZXRFdmVudHMoKTtcclxuXHRcdHZhciByZXNwb25zZTtcclxuXHRcdHZhciBrZXk7XHJcblxyXG5cdFx0aWYgKG5hbWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcclxuXHRcdFx0cmVzcG9uc2UgPSB7fTtcclxuXHRcdFx0Zm9yIChrZXkgaW4gZXZlbnRzKSB7XHJcblx0XHRcdFx0aWYgKGV2ZW50cy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIG5hbWUudGVzdChrZXkpKSB7XHJcblx0XHRcdFx0XHRyZXNwb25zZVtrZXldID0gZXZlbnRzW2tleV07XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyZXNwb25zZSA9IGV2ZW50c1tuYW1lXSB8fCAoZXZlbnRzW25hbWVdID0gW10pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiByZXNwb25zZTtcclxuXHR9XHJcblx0LyoqXHJcblx0KiDpgJrov4fkuovku7blkI3ojrflj5ZsaXN0ZW5lciDlp4vnu4jov5Tlm57kuIDkuKrlr7nosaFcclxuXHQqXHJcblx0KiBcclxuXHQqIGdldExpc3RlbmVyc0FzT2JqZWN0XHJcblx0KiBAcGFyYW0ge1N0cmluZ3xSZWdFeHB9IGV2ZW50TmFtZVxyXG5cdCogQHJldHVybiB7T2JqZWN0fVxyXG5cdCovXHJcblx0Z2V0TGlzdGVuZXJzQXNPYmplY3QobmFtZSkge1xyXG5cdFx0dmFyIGxpc3RlbmVycyA9IHRoaXMuZ2V0TGlzdGVuZXJzKG5hbWUpO1xyXG5cdFx0dmFyIHJlc3BvbnNlO1xyXG5cclxuXHRcdGlmIChsaXN0ZW5lcnMgaW5zdGFuY2VvZiBBcnJheSkge1xyXG5cdFx0XHRyZXNwb25zZSA9IHt9O1xyXG5cdFx0XHRyZXNwb25zZVtuYW1lXSA9IGxpc3RlbmVycztcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcmVzcG9uc2UgfHwgbGlzdGVuZXJzO1xyXG5cdH1cclxuXHQvKipcclxuXHQqIOiOt+WPliBsaXN0ZW5lciDliJfooahcclxuXHQqXHJcblx0KiBmbGF0dGVuTGlzdGVuZXJzXHJcblx0KlxyXG5cdCogQHBhcmFtIHsgT2JqZWN0W119IGxpc3RlbmVyc1xyXG5cdCogQHJldHVybiB7RnVuY3Rpb25bXX1cclxuXHQqL1xyXG5cdGZsYXR0ZW5MaXN0ZW5lcnMobGlzdGVuZXJzKSB7XHJcblx0XHR2YXIgZmxhdExpc3RlbmVycyA9IFtdO1xyXG5cclxuXHRcdGZvciAodmFyIGkgPSAwLCBsID0gbGlzdGVuZXIubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcblx0XHRcdGZsYXRMaXN0ZW5lcnMucHVzaChsaXN0ZW5lcnNbaV0ubGlzdGVuZXIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmbGF0TGlzdGVuZXJzO1xyXG5cdH1cclxuXHQvKipcclxuXHQqIOS6i+S7tuazqOWGjFxyXG5cdCpcclxuXHQqXHJcblx0KiBAZXhhbXBlbFxyXG5cdCogdmFyIGVtdCA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcclxuXHQqIGVtdC5hZGRMaXN0ZW5lcignZGl2OmhvdmVyJywgZnVuY3Rpb24oKXtcclxuXHQqXHQvLyBkb1xyXG5cdCogfSk7XHJcblx0KiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lXHJcblx0KiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxyXG5cdCogQHJldHVybiB7T2JqZWN0an1cclxuXHQqXHJcblx0Ki9cclxuXHRhZGRMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lciwgZmxhZykge1xyXG5cdFx0aWYgKCFpc1ZhbGlkTGlzdGVuZXIobGlzdGVuZXIpKSB7XHJcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBsaXN0ZW5lcnMgPSB0aGlzLmdldExpc3RlbmVyc0FzT2JqZWN0KG5hbWUpO1xyXG5cdFx0dmFyIGxpc3RlbmVySXNXcmFwcGVkID0gdHlwZW9mIGxpc3RlbmVyID09PSAnb2JqZWN0JztcclxuXHRcdHZhciBrZXksIHN0YXJ0LCBhcmdzO1xyXG5cclxuXHRcdGZvciAoa2V5IGluIGxpc3RlbmVycykge1xyXG5cdFx0XHRpZiAobGlzdGVuZXJzLmhhc093blByb3BlcnR5KGtleSkgJiYgaW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVycywgbGlzdGVuZXIpID09PSAtMSkge1xyXG5cclxuXHRcdFx0XHRzdGFydCA9IGxpc3RlbmVyc1trZXldLmxlbmd0aDtcclxuXHJcblx0XHRcdFx0bGlzdGVuZXJzW2tleV0ucHVzaChsaXN0ZW5lcklzV3JhcHBlZCA/IGxpc3RlbmVyIDoge1xyXG5cdFx0XHRcdFx0bGlzdGVuZXI6IGxpc3RlbmVyLFxyXG5cdFx0XHRcdFx0b25jZTogZmFsc2VcclxuXHRcdFx0XHR9KTtcclxuXHJcblx0XHRcdFx0aWYgKGZsYWcgJiYgbGlzdGVuZXJzW2tleV0uYXJncykge1xyXG5cdFx0XHRcdFx0bGlzdGVuZXJzW2tleV0uc3RhcnQgPSBzdGFydDtcclxuXHRcdFx0XHRcdGFyZ3MgPSBsaXN0ZW5lcnNba2V5XS5hcmdzO1xyXG5cdFx0XHRcdFx0dGhpcy5lbWl0RXZlbnQobmFtZSwgYXJncyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRvbigpIHtcclxuXHRcdHJldHVybiB0aGlzLmFkZExpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cclxuXHRvbmUobmFtZSwgbGlzdGVuZXIsIGZsYWcpIHtcclxuXHRcdHJldHVybiB0aGlzLnJlbW92ZUV2ZW50KG5hbWUpLmFkZExpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiDkuovku7bms6jlhozvvIzop6blj5HlkI7oh6rliqjnp7vpmaRcclxuXHQgKlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZVxyXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyXHJcblx0ICogQHJldXRuciB7T2JqZWN0fVxyXG5cdCAqXHJcblx0ICovXHJcblx0YWRkT25jZUxpc3RlbmVyKG5hbWUsIGxpc3RlbmVyKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5hZGRMaXN0ZW5lcihuYW1lLCB7XHJcblx0XHRcdGxpc3RlbmVyOiBsaXN0ZW5lcixcclxuXHRcdFx0b25jZTogdHJ1ZVxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRvbmNlKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuYWRkT25jZUxpc3RlbmVyLmFwcGx5KHRoaXMuYXJndW1lbnRzKTtcclxuXHR9XHJcblx0LyoqXHJcblx0ICog5LqL5Lu26ZSA5q+BXHJcblx0ICpcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWVcclxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxyXG5cdCAqIEByZXR1cm4ge09iamVjdH1cclxuXHQgKlxyXG5cdCAqL1xyXG5cdHJlbW92ZUxpc3RlbmVyKG5hbWUsIGxpc3RlbmVyKSB7XHJcblx0XHR2YXIgbGlzdGVuZXJzID0gdGhpcy5nZXRMaXN0ZW5lcnNBc09iamVjdChuYW1lKTtcclxuXHRcdHZhciBpbmRleDtcclxuXHRcdHZhciBrZXk7XHJcblxyXG5cdFx0Zm9yIChrZXkgaW4gbGlzdGVuZXJzKSB7XHJcblx0XHRcdGlmIChsaXN0ZW5lcnMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xyXG5cdFx0XHRcdGluZGV4ID0gaW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVyc1trZXldLCBsaXN0ZW5lcik7XHJcblxyXG5cdFx0XHRcdGlmIChpbmRleCAhPT0gLTEpIHtcclxuXHRcdFx0XHRcdGxpc3RlbmVyc1trZXldLnNwbGljZShpbmRleCwgaSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRvZmYoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yZW1vdmVMaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHJcblx0bWFuaXB1bGF0ZUxpc3RlbmVycyhyZW1vdmUsIG5hbWUsIGxpc3RlbmVycykge1xyXG5cdFx0dmFyIHNpbmdsZSA9IHJlbW92ZSA/IHRoaXMucmVtb3ZlTGlzdGVuZXIgOiB0aGlzLmFkZExpc3RlbmVyO1xyXG5cdFx0dmFyIG11dGlwbGUgPSByZW1vdmUgPyB0aGlzLnJlbW92ZUxpc3RlbmVycyA6IHRoaXMuYWRkTGlzdGVuZXJzO1xyXG5cdFx0dmFyIGk7XHJcblx0XHR2YXIgdjtcclxuXHJcblx0XHRpZiAodHlwZW9mIG5hbWUgPT09ICdvYmplY3QnICYmICEobmFtZSBpbnN0YW5jZW9mIFJlZ0V4cCkpIHtcclxuXHRcdFx0Zm9yIChpIGluIG5hbWUpIHtcclxuXHRcdFx0XHRpZiAobmFtZS5oYXNPd25Qcm9wZXJ0eShpKSAmJiAodiA9IG5hbWVbaV0pKSB7XHJcblx0XHRcdFx0XHRpZiAodHlwZW9mIHYgPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0XHRcdFx0c2luZ2xlLmNhbGwodGhpcywgaSwgdik7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRtdXRpcGxlLmNhbGwodGhpcywgaSwgdik7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRpID0gMDtcclxuXHRcdFx0diA9IGxpc3RlbmVycy5sZW5ndGg7XHJcblx0XHRcdHdoaWxlIChpIDwgdikge1xyXG5cdFx0XHRcdHNpbmdsZS5jYWxsKHRoaXMsIG5hbWUsIGxpc3RlbmVyc1tpKytdKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0YWRkTGlzdGVuZXJzKG5hbWUsIGxpc3RlbmVycykge1xyXG5cdFx0cmV0dXJuIHRoaXMubWFuaXB1bGF0ZUxpc3RlbmVycyhmYWxzZSwgbmFtZSwgbGlzdGVuZXJzKTtcclxuXHR9XHJcblxyXG5cdHJlbW92ZUxpc3RlbmVycyhuYW1lLCBsaXN0ZW5lcnMpIHtcclxuXHRcdHJldHVybiB0aGlzLm1hbmlwdWxhdGVMaXN0ZW5lcnModHJ1ZSwgbmFtZSwgbGlzdGVuZXJzKTtcclxuXHR9XHJcblxyXG5cdHJlbW92ZUV2ZW50KG5hbWUpIHtcclxuXHRcdHZhciBldmVudHMgPSB0aGlzLl9nZXRFdmVudHMoKTtcclxuXHRcdHZhciBrZXk7XHJcblxyXG5cdFx0aWYgKHR5cGVvZiBuYW1lID09PSAnc3RyaW5nJykge1xyXG5cdFx0XHQvLyDnp7vpmaTmiYDmnInmjIflrprkuovku7blkI3nmoTmiYDmnIlsaXN0ZW5lcnNcclxuXHRcdFx0Ly8gZGVsZXRlIGV2ZW50c1tuYW1lXVxyXG5cdFx0XHRpZiAoZXZlbnRzW25hbWVdIGluc3RhbmNlb2YgQXJyYXkpIHtcclxuXHRcdFx0XHRldmVudHNbbmFtZV0ubGVuZ3RoID0gMDtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIGlmIChuYW1lIGluc3RhbmNlb2YgUmVnRXhwKSB7XHJcblx0XHRcdC8vIOato+WImeWMuemFjeeahOaJgOaciSBsaXN0ZW5lcnNcclxuXHRcdFx0Zm9yIChrZXkgaW4gZXZlbnRzKSB7XHJcblx0XHRcdFx0aWYgKGV2ZW50cy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIG5hbWUudGVzdChrZXkpKSB7XHJcblx0XHRcdFx0XHQvLyBkZWxldGUgZXZlbnRzW2tleV1cclxuXHRcdFx0XHRcdGlmIChldmVudHNba2V5XSBpbnN0YW5jZW9mIEFycmF5KSB7XHJcblx0XHRcdFx0XHRcdGV2ZW50W2tleV0ubGVuZ3RoID0gMDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdC8vIOenu+mZpOaJgOaciSBsaXN0ZW5lcnNcclxuXHRcdFx0ZGVsZXRlIHRoaXMuX2V2ZW50cztcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdHJlbW92ZUFsbExpc3RlbmVycygpIHtcclxuXHRcdHJldHVybiB0aGlzLnJlbW92ZUV2ZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cdC8qKlxyXG5cdCAqIOS6i+S7tuinpuWPkVxyXG5cdCAqXHJcblx0ICpcclxuXHQgKiBAZXhhbXBsZVxyXG5cdCAqIHZhciBlbXQgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XHJcblx0ICogc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuXHQgKiBcdGVtdC5lbWl0RXZlbnQoJ2Rpdjpob3ZlcicsIDEpO1xyXG5cdCAqIH0sIDEwMDApO1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSDkuovku7blkI3np7BcclxuXHQgKiBAcGFyYW0ge0FycmF5fSBbYXJnc10gSFRNTERvY3VtZW50LCBpdGVtRGF0YSwgLi4uXHJcblx0ICogQHJldHVybiB7T2JqZWN0fVxyXG5cdCAqXHJcblx0ICovXHJcblx0ZW1pdEV2ZW50KG5hbWUsIGFyZ3MpIHtcclxuXHRcdHZhciBsaXN0ZW5lcnNNYXAgPSB0aGlzLmdldExpc3RlbmVyc0FzT2JqZWN0KG5hbWUpO1xyXG5cdFx0dmFyIGxpc3RlbmVycztcclxuXHRcdHZhciBsaXN0ZW5lcjtcclxuXHRcdHZhciBpO1xyXG5cdFx0dmFyIGw7XHJcblx0XHR2YXIga2V5O1xyXG5cdFx0dmFyIHJlc3BvbnNlO1xyXG5cclxuXHRcdGZvciAoa2V5IGluIGxpc3RlbmVyc01hcCkge1xyXG5cdFx0XHRpZiAobGlzdGVuZXJzTWFwLmhhc093blByb3BlcnR5KGtleSkpIHtcclxuXHRcdFx0XHRsaXN0ZW5lcnMgPSBsaXN0ZW5lcnNNYXBba2V5XS5zbGljZSgwKTtcclxuXHJcblx0XHRcdFx0bGlzdGVuZXJzTWFwW2tleV0uYXJncyA9IGFyZ3M7XHJcblxyXG5cdFx0XHRcdGkgPSBsaXN0ZW5lcnNNYXBba2V5XS5zdGFydCB8fCAwO1xyXG5cdFx0XHRcdGxpc3RlbmVyc01hcFtrZXldLnN0YXJ0ID0gMDtcclxuXHJcblx0XHRcdFx0Zm9yIChsID0gbGlzdGVuZXJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG5cdFx0XHRcdFx0bGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XHJcblxyXG5cdFx0XHRcdFx0aWYgKGxpc3RlbmVyLm9uY2UgPT09IHRydWUpIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5yZW1vdmVMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lci5saXN0ZW5lcik7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0cmVzcG9uc2UgPSBsaXN0ZW5lci5saXN0ZW5lci5hcHBseSh0aGlzLCBhcmdzIHx8IFtdKTtcclxuXHJcblx0XHRcdFx0XHRpZiAocmVzcG9uc2UgPT09IHRoaXMuX2dldE9uY2VSZXR1cm5WYWx1ZSgpKSB7XHJcblx0XHRcdFx0XHRcdHRoaXMucmVtb3ZlTGlzdGVuZXIobmFtZSwgbGlzdGVuZXIubGlzdGVuZXIpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHR0cmlnZ2VyKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuZW1pdEV2ZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cclxuXHRmaXJlKG5hbWUpIHtcclxuXHRcdHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcclxuXHRcdHJldHVybiB0aGlzLmVtaXRFdmVudChuYW1lLCBhcmdzKTtcclxuXHR9XHJcblxyXG5cdF9nZXRPbmNlUmV0dXJuVmFsdWUoKSB7XHJcblx0XHRpZiAodGhpcy5oYXNPd25Qcm9wZXJ0eSgnX29uY2VSZXR1cm5WYWx1ZScpKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLl9vbmNlUmV0dXJuVmFsdWU7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdHNldE9uY2VSZXR1cm5WYWx1ZSh2YWx1ZSkge1xyXG5cdFx0dGhpcy5fb25jZVJldHVyblZhbHVlID0gdmFsdWU7XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdGRlZmluZUV2ZW50KG5hbWUpIHtcclxuXHRcdHRoaXMuZ2V0TGlzdGVuZXJzKG5hbWUpO1xyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRkZWZpbmVFdmVudHMobmFtZXMpIHtcclxuXHRcdGZvciAodmFyIGkgPSAwLCBsID0gbmFtZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcblx0XHRcdHRoaXMuZGVmaW5lRXZlbnQobmFtZVtpXSk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcclxuXHJcblxyXG4iLCJmdW5jdGlvbiBzd2FwKGFyciwgczEsIHMyKSB7XHJcblx0dmFyIHRlbXAgPSBhcnJbczFdO1xyXG5cdGFycltzMV0gPSBhcnJbczJdO1xyXG5cdGFycltzMl0gPSB0ZW1wO1xyXG59XHJcblxyXG5mdW5jdGlvbiByYW5kb21WYWx1ZShhcnIpIHtcclxuXHR2YXIgciA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGFyci5sZW5ndGgpO1xyXG5cdC8vIHN3YXAoYXJyLCAwLCByKTtcclxuXHRyZXR1cm4gW2FycltyXSwgYXJyLmZpbHRlcigoZCwgaSkgPT4gaSAhPT0gcildO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmaWx0ZXJMQW5kUihhcnIsIHNlbGVjdCwgY29tcGFyZUZuKSB7XHJcblx0dmFyIGxlZnRBcnIgPSBbXTtcclxuXHR2YXIgcmlnaHRBcnIgPSBbXTtcclxuXHJcblx0Zm9yICh2YXIgaSA9IDAsIGxlbiA9IGFyci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG5cdFx0bGV0IHRlbXAgPSBhcnJbaV07XHJcblx0XHRsZXQgY29tcGFyZWQgPSBjb21wYXJlRm4oc2VsZWN0LCB0ZW1wKTtcclxuXHRcdGlmIChjb21wYXJlZCA+IDApIHJpZ2h0QXJyLnB1c2godGVtcCk7XHJcblx0XHRlbHNlIGlmIChjb21wYXJlZCA8IDApIGxlZnRBcnIucHVzaCh0ZW1wKTtcclxuXHRcdGVsc2UgTWF0aC5yYW5kb20oKSA+IDAuNSA/IHJpZ2h0QXJyLnB1c2godGVtcCkgOiBsZWZ0QXJyLnB1c2godGVtcCk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gW2xlZnRBcnIsIHJpZ2h0QXJyXTtcclxufVxyXG5cclxuZnVuY3Rpb24gZmluZEluZGV4KGFyciwgaW5kZXgsIGNvbXBhcmVGbikge1xyXG5cdGlmIChhcnIubGVuZ3RoIDw9IDEgfHwgaW5kZXggPT09IDApIHJldHVybiBhcnJbMF07XHJcblx0dmFyIFtzZWxlY3QsIHNlY19hcnJdID0gcmFuZG9tVmFsdWUoYXJyKTtcclxuXHR2YXIgW2xlZnRBcnIsIHJpZ2h0QXJyXSA9IGZpbHRlckxBbmRSKHNlY19hcnIsIHNlbGVjdCwgY29tcGFyZUZuKTtcclxuXHR2YXIgbiA9IHJpZ2h0QXJyLmxlbmd0aDtcclxuXHJcblx0aWYgKG4gPT09IGluZGV4IC0gMSkgcmV0dXJuIHNlbGVjdDtcclxuXHRpZiAobiA+PSBpbmRleCkgcmV0dXJuIGZpbmRJbmRleChyaWdodEFyciwgaW5kZXgsIGNvbXBhcmVGbik7XHJcblx0ZWxzZSByZXR1cm4gZmluZEluZGV4KGxlZnRBcnIsIGluZGV4IC0gbiAtIDEsIGNvbXBhcmVGbik7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZmluZEluZGV4OyIsInZhciBVdGlscyA9IHt9O1xyXG5cclxudmFyIHVpZCA9IFV0aWxzLnVpZCA9ICgoKSA9PiB7XHJcblx0bGV0IHQgPSBEYXRlLm5vdygpO1xyXG5cdHJldHVybiAoKSA9PiB7XHJcblx0XHRyZXR1cm4gKHQrKykudG9TdHJpbmcoMTYpO1xyXG5cdH07XHJcbn0pKCk7XHJcblxyXG5cclxudmFyIG1lcmdlID0gVXRpbHMubWVyZ2UgPSAodGFyZ2V0LCBhZGRpdGlvbmFsLCBkZWVwKSA9PiB7XHJcblx0bGV0IGRlcHRoID0gdHlwZW9mIGRlZXAgPT0gJ3VuZGVmaW5lZCcgPyAyIDogZGVlcCwgcHJvcDtcclxuXHJcblx0Zm9yIChwcm9wIGluIGFkZGl0aW9uYWwpIHtcclxuXHRcdGlmIChhZGRpdGlvbmFsLmhhc093blByb3BlcnR5KHByb3ApKSB7XHJcblx0XHRcdGlmICh0eXBlb2YgdGFyZ2V0W3Byb3BdICE9PSAnb2JqZWN0JyB8fCAhZGVwdGgpIHtcclxuXHRcdFx0XHR0YXJnZXRbcHJvcF0gPSBhZGRpdGlvbmFsW3Byb3BdO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFV0aWxzLm1lcmdlKHRhcmdldFtwcm9wXSwgYWRkaXRpb25hbFtwcm9wXSwgZGVwdGggLSAxKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHRhcmdldDtcclxufTtcclxuXHJcbnZhciBmaW5kSW5kZXggPSBVdGlscy5maW5kSW5kZXggPSByZXF1aXJlKCcuL0ZpbmRJbmRleCcpO1xyXG52YXIgY29tcGFyZUZuID0gVXRpbHMuY29tcGFyZUZuID0gcmVxdWlyZSgnLi91dGlscy9Db21wYXJlcicpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBVdGlsczsiLCJtb2R1bGUuZXhwb3J0cyA9IHtcclxuICAvKlxyXG4gICAqIG9iauaYr+S4gOS4quWvueixoe+8jOWFtuS4reWMheWQq+acie+8mlxyXG4gICAqICMjIGRhdGEg5piv5a+85Ye655qE5YW35L2T5pWw5o2uXHJcbiAgICogIyMgZmlsZU5hbWUg5piv5a+85Ye65pe25L+d5a2Y55qE5paH5Lu25ZCN56ewIOaYr3N0cmluZ+agvOW8j1xyXG4gICAqICMjIHNob3dMYWJlbCDooajnpLrmmK/lkKbmmL7npLrooajlpLQg6buY6K6k5pi+56S6IOaYr+W4g+WwlOagvOW8j1xyXG4gICAqICMjIGNvbHVtbnMg5piv6KGo5aS05a+56LGh77yM5LiUdGl0bGXlkoxrZXnlv4XpobvkuIDkuIDlr7nlupTvvIzljIXlkKvmnIlcclxuICAgICAgICB0aXRsZTpbXSwgLy8g6KGo5aS05bGV56S655qE5paH5a2XXHJcbiAgICAgICAga2V5OltdLCAvLyDojrflj5bmlbDmja7nmoRLZXlcclxuICAgICAgICBmb3JtYXR0ZXI6IGZ1bmN0aW9uKCkgLy8g6Ieq5a6a5LmJ6K6+572u5b2T5YmN5pWw5o2u55qEIOS8oOWFpShrZXksIHZhbHVlKVxyXG4gICAqL1xyXG4gIHNldERhdGFDb252ZXI6IGZ1bmN0aW9uKG9iaikge1xyXG4gICAgdmFyIGJ3ID0gdGhpcy5icm93c2VyKCk7XHJcbiAgICBpZihid1snaWUnXSA8IDkpIHJldHVybjsgLy8gSUU55Lul5LiL55qEXHJcbiAgICB2YXIgZGF0YSA9IG9ialsnZGF0YSddLFxyXG4gICAgICAgIFNob3dMYWJlbCA9IHR5cGVvZiBvYmpbJ3Nob3dMYWJlbCddID09PSAndW5kZWZpbmVkJyA/IHRydWUgOiBvYmpbJ3Nob3dMYWJlbCddLFxyXG4gICAgICAgIGZpbGVOYW1lID0gKG9ialsnZmlsZU5hbWUnXSB8fCAnVXNlckV4cG9ydCcpICsgJy5jc3YnLFxyXG4gICAgICAgIGNvbHVtbnMgPSBvYmpbJ2NvbHVtbnMnXSB8fCB7XHJcbiAgICAgICAgICAgIHRpdGxlOiBbXSxcclxuICAgICAgICAgICAga2V5OiBbXSxcclxuICAgICAgICAgICAgZm9ybWF0dGVyOiB1bmRlZmluZWRcclxuICAgICAgICB9O1xyXG4gICAgdmFyIFNob3dMYWJlbCA9IHR5cGVvZiBTaG93TGFiZWwgPT09ICd1bmRlZmluZWQnID8gdHJ1ZSA6IFNob3dMYWJlbDtcclxuICAgIHZhciByb3cgPSBcIlwiLCBDU1YgPSAnJywga2V5O1xyXG4gICAgLy8g5aaC5p6c6KaB546w5a6e6KGo5aS05paH5a2XXHJcbiAgICBpZiAoU2hvd0xhYmVsKSB7XHJcbiAgICAgICAgLy8g5aaC5p6c5pyJ5Lyg5YWl6Ieq5a6a5LmJ55qE6KGo5aS05paH5a2XXHJcbiAgICAgICAgaWYgKGNvbHVtbnMudGl0bGUubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIGNvbHVtbnMudGl0bGUubWFwKGZ1bmN0aW9uKG4pIHtcclxuICAgICAgICAgICAgICAgIHJvdyArPSBuICsgJywnO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyDlpoLmnpzmsqHmnInvvIzlsLHnm7TmjqXlj5bmlbDmja7nrKzkuIDmnaHnmoTlr7nosaHnmoTlsZ7mgKdcclxuICAgICAgICAgICAgZm9yIChrZXkgaW4gZGF0YVswXSkgcm93ICs9IGtleSArICcsJztcclxuICAgICAgICB9XHJcbiAgICAgICAgcm93ID0gcm93LnNsaWNlKDAsIC0xKTsgLy8g5Yig6Zmk5pyA5ZCO5LiA5LiqLOWPt++8jOWNs2EsYiwgPT4gYSxiXHJcbiAgICAgICAgQ1NWICs9IHJvdyArICdcXHJcXG4nOyAvLyDmt7vliqDmjaLooYznrKblj7dcclxuICAgIH1cclxuICAgIC8vIOWFt+S9k+eahOaVsOaNruWkhOeQhlxyXG4gICAgZGF0YS5tYXAoZnVuY3Rpb24obikge1xyXG4gICAgICAgIHJvdyA9ICcnO1xyXG4gICAgICAgIC8vIOWmguaenOWtmOWcqOiHquWumuS5iWtleeWAvFxyXG4gICAgICAgIGlmIChjb2x1bW5zLmtleS5sZW5ndGgpIHtcclxuICAgICAgICAgICAgY29sdW1ucy5rZXkubWFwKGZ1bmN0aW9uKG0pIHtcclxuICAgICAgICAgICAgICAgIHJvdyArPSAnXCInICsgKHR5cGVvZiBjb2x1bW5zLmZvcm1hdHRlciA9PT0gJ2Z1bmN0aW9uJyA/IGNvbHVtbnMuZm9ybWF0dGVyKG0sIG5bbV0pIHx8IG5bbV0gOiBuW21dKSArICdcIiwnO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBmb3IgKGtleSBpbiBuKSB7XHJcbiAgICAgICAgICAgICAgICByb3cgKz0gJ1wiJyArICh0eXBlb2YgY29sdW1ucy5mb3JtYXR0ZXIgPT09ICdmdW5jdGlvbicgPyBjb2x1bW5zLmZvcm1hdHRlcihrZXksIG5ba2V5XSkgfHwgbltrZXldIDogbltrZXldKSArICdcIiwnO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJvdy5zbGljZSgwLCByb3cubGVuZ3RoIC0gMSk7IC8vIOWIoOmZpOacgOWQjuS4gOS4qixcclxuICAgICAgICBDU1YgKz0gcm93ICsgJ1xcclxcbic7IC8vIOa3u+WKoOaNouihjOespuWPt1xyXG4gICAgfSk7XHJcbiAgICBpZighQ1NWKSByZXR1cm47XHJcbiAgICB0aGlzLlNhdmVBcyhmaWxlTmFtZSwgQ1NWKTtcclxuICB9LFxyXG4gIFNhdmVBczogZnVuY3Rpb24oZmlsZU5hbWUsIGNzdkRhdGEpIHtcclxuICAgIHZhciBidyA9IHRoaXMuYnJvd3NlcigpO1xyXG4gICAgaWYoIWJ3WydlZGdlJ10gfHwgIWJ3WydpZSddKSB7XHJcbiAgICAgIHZhciBhbGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJhXCIpO1xyXG4gICAgICBhbGluay5pZCA9IFwibGlua0R3bmxkTGlua1wiO1xyXG4gICAgICBhbGluay5ocmVmID0gdGhpcy5nZXREb3dubG9hZFVybChjc3ZEYXRhKTtcclxuICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhbGluayk7XHJcbiAgICAgIHZhciBsaW5rRG9tID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xpbmtEd25sZExpbmsnKTtcclxuICAgICAgbGlua0RvbS5zZXRBdHRyaWJ1dGUoJ2Rvd25sb2FkJywgZmlsZU5hbWUpO1xyXG4gICAgICBsaW5rRG9tLmNsaWNrKCk7XHJcbiAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQobGlua0RvbSk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmKGJ3WydpZSddID49IDEwIHx8IGJ3WydlZGdlJ10gPT0gJ2VkZ2UnKSB7XHJcbiAgICAgIHZhciBfdXRmID0gXCJcXHVGRUZGXCI7XHJcbiAgICAgIHZhciBfY3N2RGF0YSA9IG5ldyBCbG9iKFtfdXRmICsgY3N2RGF0YV0sIHtcclxuICAgICAgICAgIHR5cGU6ICd0ZXh0L2NzdidcclxuICAgICAgfSk7XHJcbiAgICAgIG5hdmlnYXRvci5tc1NhdmVCbG9iKF9jc3ZEYXRhLCBmaWxlTmFtZSk7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgdmFyIG9XaW4gPSB3aW5kb3cudG9wLm9wZW4oXCJhYm91dDpibGFua1wiLCBcIl9ibGFua1wiKTtcclxuICAgICAgb1dpbi5kb2N1bWVudC53cml0ZSgnc2VwPSxcXHJcXG4nICsgY3N2RGF0YSk7XHJcbiAgICAgIG9XaW4uZG9jdW1lbnQuY2xvc2UoKTtcclxuICAgICAgb1dpbi5kb2N1bWVudC5leGVjQ29tbWFuZCgnU2F2ZUFzJywgdHJ1ZSwgZmlsZU5hbWUpO1xyXG4gICAgICBvV2luLmNsb3NlKCk7XHJcbiAgICB9XHJcbiAgfSxcclxuICBnZXREb3dubG9hZFVybDogZnVuY3Rpb24oY3N2RGF0YSkge1xyXG4gICAgdmFyIF91dGYgPSBcIlxcdUZFRkZcIjsgLy8g5Li65LqG5L2/RXhjZWzku6V1dGYtOOeahOe8lueggeaooeW8j++8jOWQjOaXtuS5n+aYr+ino+WGs+S4reaWh+S5seeggeeahOmXrumimFxyXG4gICAgaWYgKHdpbmRvdy5CbG9iICYmIHdpbmRvdy5VUkwgJiYgd2luZG93LlVSTC5jcmVhdGVPYmplY3RVUkwpIHtcclxuICAgICAgICB2YXIgY3N2RGF0YSA9IG5ldyBCbG9iKFtfdXRmICsgY3N2RGF0YV0sIHtcclxuICAgICAgICAgICAgdHlwZTogJ3RleHQvY3N2J1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiBVUkwuY3JlYXRlT2JqZWN0VVJMKGNzdkRhdGEpO1xyXG4gICAgfVxyXG4gICAgLy8gcmV0dXJuICdkYXRhOmF0dGFjaG1lbnQvY3N2O2NoYXJzZXQ9dXRmLTgsJyArIF91dGYgKyBlbmNvZGVVUklDb21wb25lbnQoY3N2RGF0YSk7XHJcbiAgfSxcclxuICBicm93c2VyOiBmdW5jdGlvbigpIHtcclxuICAgIHZhciBTeXMgPSB7fTtcclxuICAgIHZhciB1YSA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKTtcclxuICAgIHZhciBzO1xyXG4gICAgKHMgPSB1YS5pbmRleE9mKCdlZGdlJykgIT09IC0gMSA/IFN5cy5lZGdlID0gJ2VkZ2UnIDogdWEubWF0Y2goL3J2OihbXFxkLl0rKVxcKSBsaWtlIGdlY2tvLykpID8gU3lzLmllID0gc1sxXTpcclxuICAgICAgICAocyA9IHVhLm1hdGNoKC9tc2llIChbXFxkLl0rKS8pKSA/IFN5cy5pZSA9IHNbMV0gOlxyXG4gICAgICAgIChzID0gdWEubWF0Y2goL2ZpcmVmb3hcXC8oW1xcZC5dKykvKSkgPyBTeXMuZmlyZWZveCA9IHNbMV0gOlxyXG4gICAgICAgIChzID0gdWEubWF0Y2goL2Nocm9tZVxcLyhbXFxkLl0rKS8pKSA/IFN5cy5jaHJvbWUgPSBzWzFdIDpcclxuICAgICAgICAocyA9IHVhLm1hdGNoKC9vcGVyYS4oW1xcZC5dKykvKSkgPyBTeXMub3BlcmEgPSBzWzFdIDpcclxuICAgICAgICAocyA9IHVhLm1hdGNoKC92ZXJzaW9uXFwvKFtcXGQuXSspLipzYWZhcmkvKSkgPyBTeXMuc2FmYXJpID0gc1sxXSA6IDA7XHJcbiAgICByZXR1cm4gU3lzO1xyXG4gIH1cclxufTsiLCIvKipcclxuICog5Yib5bu65q+U6L6D5Ye95pWwXHJcbiAqIEBzdW1tYXJ5IOe6puadn+adoeS7tu+8jOWPqumSiOWvueWvueixoeaVsOe7hOe7k+aehOeahOaVsOaNru+8jOWmglxyXG4gKiAgICAgIFt7XCJjb2xfMVwiOiAxMCwgXCJjb2xfMlwiOiAzNSwgXCJjb2xfM1wiOiA2Nn0sIC4uLl1cclxuICpcclxuICogQGV4YW1wbGVcclxuICpcclxuICogIHZhciBzb3J0cyA9IFsnQScsJ0InLCdDJywnRCddO1xyXG4gKiAgdmFyIGRpcnMgPSBbMSwgLTEsIDEsIDFdO1xyXG4gKlxyXG4gKiAgdmFyIGRhdGEzID0gW1xyXG4gKiAgICAgIHtBOjEsQjoxLEM6NSxfaWQ6MX0sXHJcbiAqICAgICAge0E6MSxCOjMsQzo1LF9pZDoxfSxcclxuICogICAgICB7QToyLEI6NSxDOjQsX2lkOjJ9LFxyXG4gKiAgICAgIHtBOjEsQjoxLEM6OSxfaWQ6MX0sXHJcbiAqICAgICAge0E6MyxCOjMsQzozLF9pZDozfSxcclxuICogICAgICB7QToxLEI6MSxDOjMsX2lkOjF9LFxyXG4gKiAgICAgIHtBOjQsQjoyLEM6MixfaWQ6NH0sXHJcbiAqICAgICAge0E6NSxCOjQsQzoxLF9pZDo1fSxcclxuICogIF07XHJcbiAqXHJcbiAqICB2YXIgZm4gPSBjb21wYXJlRm4oc29ydHMsIGRpcnMpO1xyXG4gKiAgdmFyIHJldCA9IGRhdGEzLnNvcnQoZm4pLm1hcChkID0+IE9iamVjdC52YWx1ZXMoZCkpO1xyXG4gKiAgY29uc29sZS5kaXIocmV0KTtcclxuICpcclxuICogQHBhcmFtIHtBcnJheX0gc29ydHMgLeaOkuW6j+Wtl+auteaVsOe7hCBbJ2NvbF8xJywgJ2NvbF8yJywgJ2NvbF8zJywuLi5dXHJcbiAqIEBwYXJhbSB7QXJyYXl9IGRpcnMgLeWvueW6lOWtl+S9k+aOkuW6j+aVsOe7hOeahOWNh+mZjeW6jywx77ya5Y2H5bqPIC0x77ya6ZmN5bqPIFsxLCAtMV1cclxuICogQHJldHVybnMge0Z1bmN0aW9ufSDmr5TovoPlh73mlbBcclxuICovXHJcbmV4cG9ydHMuY29tcGFyZUZuID0gZnVuY3Rpb24gY29tcGFyZUZuKHNvcnRzLCBkaXJzKSB7XHJcbiAgICB2YXIgY29uZGl0aW9ucyA9IHNvcnRzLnJlZHVjZSgocHJlLCBuZXh0LCBpKSA9PiB7XHJcbiAgICAgICAgcHJlICA9IHByZSA/IHByZSArICcgfHwnIDogJyc7XHJcbiAgICAgICAgcmV0dXJuIGAke3ByZX0gKGEuJHtuZXh0fSAtIGIuJHtuZXh0fSkgKiAke2RpcnNbaV19YDtcclxuICAgIH0sICcnKTtcclxuXHJcbiAgICB2YXIgZnVuY3Rpb25fYm9keSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGxldCBzb3J0SW5mbyA9IHNvcnRzLmpvaW4oJywnKS5yZXBsYWNlKC8oXFx3KykvZywgJ1wiJDFcIicpO1xyXG4gICAgICAgIHJldHVybiBgdmFyIHNvcnQgPSBbJHtzb3J0SW5mb31dOyByZXR1cm4gJHtjb25kaXRpb25zfWA7XHJcbiAgICB9XHJcbiAgICAvLyBjb25zb2xlLmxvZyhmdW5jdGlvbl9ib2R5KCkpO1xyXG4gICAgXHJcbiAgICByZXR1cm4gbmV3IEZ1bmN0aW9uKCdhJywgJ2InLCBmdW5jdGlvbl9ib2R5KCkpO1xyXG59XHJcblxyXG5cclxuIl19
