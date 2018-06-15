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
		disabled: true,
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY29yZS9CdWZmZXJOb2RlLmpzIiwic3JjL2NvcmUvQnVmZmVyWm9uZS5qcyIsInNyYy9jb3JlL0NvbE1vZGVsLmpzIiwic3JjL2NvcmUvR3JpZFN0b3JlLmpzIiwic3JjL2NvcmUvR3JpZFZpZXcuanMiLCJzcmMvY29yZS9IZWFkZXIuanMiLCJzcmMvY29yZS9Mb2NrQ29sTWFuYWdlci5qcyIsInNyYy9jb3JlL1Njcm9sbGVyLmpzIiwic3JjL2V4dGVuZHMvQ29udGV4dG1lbnUuanMiLCJzcmMvZXh0ZW5kcy9TZWxlY3Rpb24uanMiLCJzcmMvaW5kZXguanMiLCJzcmMvcGx1Z2luL01lbnUuanMiLCJzcmMvdXRpbC9ERC5qcyIsInNyYy91dGlsL0V2ZW50RW1pdHRlci5qcyIsInNyYy91dGlsL0ZpbmRJbmRleC5qcyIsInNyYy91dGlsL1V0aWxzLmpzIiwic3JjL3V0aWwvZXhwb3Rlci9DU1YuanMiLCJzcmMvdXRpbC91dGlscy9Db21wYXJlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN0TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUMxUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUMxSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3pMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQy9QQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMxR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDNVJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNqSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6V0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwidmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snalF1ZXJ5J10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWydqUXVlcnknXSA6IG51bGwpO1xyXG52YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi4vdXRpbC9FdmVudEVtaXR0ZXInKTtcclxuXHJcbnZhciBkZWZpbmVEZWxsID0gZnVuY3Rpb24oY29sTSkge1xyXG5cdGxldCBjZWxsID0gJCgnPGxpLz4nKVxyXG5cdFx0LmFkZENsYXNzKCdjLWdyaWQtY2VsbCcpXHJcblx0XHQuYWRkQ2xhc3MoJ2MtYWxpZ24tJyArIGNvbE0uYWxpZ24pXHJcblx0XHQuYWRkQ2xhc3MoKCkgPT4gY29sTS5oaWRkZW4gPyAnYy1jb2x1bW4taGlkZScgOiAnJylcclxuXHRcdC5hZGRDbGFzcygoKSA9PiBjb2xNLmxvY2tlZCA/ICdjLWNvbHVtbi1sb2NrZWQnIDogJycpXHJcblx0XHQuYXR0cigndGFiaW5kZXgnLCAtMSlcclxuXHRcdC5kYXRhKHsgJ2RhdGFJbmRleCc6IGNvbE0uZGF0YUluZGV4LCAnY2lkJzogY29sTS5jaWQgfSlcclxuXHRcdC53aWR0aChjb2xNLndpZHRoKTtcclxuXHJcblx0cmV0dXJuIGNlbGw7XHJcbn07XHJcblxyXG52YXIgY3JlYXRlQ2VsbCA9IGZ1bmN0aW9uKCRyb3csIGNvbHNNb2RlbCkge1xyXG5cdHZhciBzaXplID0gY29sc01vZGVsLnNpemUoKTtcclxuXHR2YXIgY2hpbGRyZW4gPSBuZXcgTWFwKCk7XHJcblxyXG5cdGNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0bGV0IGNlbGwgPSBkZWZpbmVEZWxsKGNvbE0pO1xyXG5cclxuXHRcdCRyb3cuYXBwZW5kKGNlbGwpO1xyXG5cdFx0Y2hpbGRyZW4uc2V0KGNvbE0sIGNlbGwpO1xyXG5cdH0pO1xyXG5cclxuXHRyZXR1cm4gY2hpbGRyZW47XHJcbn07XHJcblxyXG5jbGFzcyBSb3dOb2RlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHRjb25zdHJ1Y3Rvcihjb2xzTW9kZWwsIGNvbnRleHQpIHtcclxuXHRcdHN1cGVyKCk7XHJcblx0XHR0aGlzLiR2bSA9IGNvbnRleHQ7XHJcblx0XHR0aGlzLmNvbHNNb2RlbCA9IGNvbHNNb2RlbDtcclxuXHRcdHRoaXMuJG5vZGUgPSAkKCc8dWwvPicpLmFkZENsYXNzKCdjLWdyaWQtcm93Jyk7XHJcblxyXG5cdFx0dGhpcy5jaGlsZHJlbiA9IGNyZWF0ZUNlbGwodGhpcy4kbm9kZSwgY29sc01vZGVsKTtcclxuXHRcdHRoaXMuX2JpbmRFdmVudChjb2xzTW9kZWwpO1xyXG5cdH1cclxuXHJcblx0X2JpbmRFdmVudChjb2xzTW9kZWwpIHtcclxuXHRcdHRoaXMuY29sc01vZGVsLm9uKCdjb2x1bW4tYWRkJywgY29sTSA9PiB7XHJcblx0XHRcdGxldCBjZWxsID0gZGVmaW5lRGVsbChjb2xNKTtcclxuXHJcblx0XHRcdHRoaXMuJG5vZGUuYXBwZW5kKGNlbGwpO1xyXG5cdFx0XHR0aGlzLmNoaWxkcmVuLnNldChjb2xNLCBjZWxsKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuY29sc01vZGVsLm9uKCdjb2x1bW4tbW92ZWQnLCAoY29sTSwgZm9ybUluZGV4LCB0b0luZGV4KSA9PiB7XHJcblx0XHRcdGxldCBjZWxsID0gdGhpcy5jaGlsZHJlbi5nZXQoY29sTSk7XHJcblx0XHRcdGNlbGwuaW5zZXJ0QWZ0ZXIodGhpcy4kbm9kZS5maW5kKCdsaS5jLWdyaWQtY2VsbCcpLmVxKHRvSW5kZXgpKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdGNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tcmVzaXplZCcsIHdpZHRoID0+IHtcclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyh3aWR0aCk7XHJcblx0XHRcdFx0dGhpcy5jaGlsZHJlbi5nZXQoY29sTSkub3V0ZXJXaWR0aCh3aWR0aCk7XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWhpZGRlbicsIGlzSGlkZGVuID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jaGlsZHJlbi5nZXQoY29sTSk7XHJcblx0XHRcdFx0aWYgKGlzSGlkZGVuKSB7XHJcblx0XHRcdFx0XHRjb2xFbGUuYWRkQ2xhc3MoJ2MtY29sdW1uLWhpZGUnKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKCdjLWNvbHVtbi1oaWRlJyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1sb2NrZWQnLCBpc0xvY2tlZCA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY2hpbGRyZW4uZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0XHRpZiAoaXNMb2NrZWQpIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcygnYy1jb2x1bW4tbG9ja2VkJyk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcygnYy1jb2x1bW4tbG9ja2VkJyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2Rlc3RvcnknLCAoKSA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY2hpbGRyZW4uZ2V0KGNvbE0pO1xyXG5cdFx0XHRcdHRoaXMuY2hpbGRyZW4uZGVsZXRlKGNvbE0pO1x0XHRcdFxyXG5cdFx0XHRcdGNvbEVsZS5yZW1vdmUoKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdHNldERhdGEocm93LCBvZmZzZXRUb3ApIHtcclxuXHRcdC8vIOi/memHjOWmguaenOeUqEFPUOaWueW8j+WunueOsOabtOWlvVRPRE9cclxuXHRcdHRoaXMuJHZtLmZpcmUoJ3Jvdy11cGRhdGUtYmVmb3JlJywgdGhpcywgcm93KTtcclxuXHJcblx0XHR2YXIgY29udGVudDtcclxuXHRcdHZhciBjZWxscyA9IHRoaXMuY2hpbGRyZW47XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwuZWFjaChjb2xNID0+IHtcclxuXHJcblx0XHRcdGNvbnRlbnQgPSBjb2xNLnJlbmRlcmVyKHJvdy5kYXRhW2NvbE0uZGF0YUluZGV4XSk7XHJcblx0XHRcdC8vIFRPRE8gYWRkQ2xhc3MoKCk9PiByb3cuY2VsbFtjb2xNLmRhdGFJbmRleF0uc2VsZWN0ZWQpXHJcblx0XHRcdGNlbGxzLmdldChjb2xNKS5odG1sKGNvbnRlbnQpO1xyXG5cclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuJG5vZGUuY3NzKCd0b3AnLCBvZmZzZXRUb3ApLmF0dHIoJ3JpZCcsIHJvdy5yaWQpO1xyXG5cclxuXHRcdHJldHVybiB0aGlzLiRub2RlO1xyXG5cdH1cclxufVxyXG5cclxuY2xhc3MgQnVmZmVyTm9kZSBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblx0Y29uc3RydWN0b3IobGltaXQsIGNvbHNNb2RlbCwgdG90YWwsIGNhY2hlVGltZXMpIHtcclxuXHRcdHN1cGVyKCk7XHJcblx0XHR0aGlzLmluaXQobGltaXQsIGNvbHNNb2RlbCwgdG90YWwsIGNhY2hlVGltZXMpO1xyXG5cdH1cclxuXHJcblx0aW5pdChsaW1pdCwgY29sc01vZGVsLCB0b3RhbCwgY2FjaGVUaW1lcykge1xyXG5cdFx0dGhpcy5saW1pdCA9IGxpbWl0O1xyXG5cdFx0dGhpcy50b3RhbCA9IHRvdGFsO1xyXG5cdFx0dGhpcy5jYWNoZVRpbWVzID0gY2FjaGVUaW1lcyB8fCAzO1xyXG5cdFx0dGhpcy5ub2RlTGlzdCA9IFtdO1xyXG5cdFx0dGhpcy5jb2xzTW9kZWwgPSBjb2xzTW9kZWw7XHJcblxyXG5cdFx0Ly8g6L+Z6YeM5pqC5Li6U2VsZWN0aW9u5a6e546w77yM5bqU6K+l55SoQU9Q57u05oqkIFRPRE9cclxuXHRcdC8vIHRoaXMub24oJ3Jvdy11cGRhdGUtYmVmb3JlJywgKHJvd05vZGUsIHJvdykgPT4gdGhpcy5maXJlKCdyb3ctdXBkYXRlJywgcm93Tm9kZSwgcm93KSk7XHJcblx0fVxyXG5cclxuXHRnZXROb2RlTGlzdCgpIHtcclxuXHRcdHJldHVybiB0aGlzLm5vZGVMaXN0O1xyXG5cdH1cclxuXHJcblx0c2V0TGltaXQobGltaXQpIHtcclxuXHRcdGlmICgrbGltaXQgPiAwKSB7XHJcblx0XHRcdHRoaXMuaW5pdChsaW1pdCwgdGhpcy5jb2xzTW9kZWwsIHRoaXMudG90YWwsIHRoaXMuY2FjaGVUaW1lcyk7XHJcblx0XHRcdHRoaXMuZmlyZSgnYnVmZmVyLWluaXRpYWwnKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHNldFRvdGFsKHRvdGFsKSB7XHJcblx0XHRpZiAoK3RvdGFsID49IDApIHtcclxuXHRcdFx0dGhpcy50b3RhbCA9IHRvdGFsO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0aXNFbm91Z2goKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5ub2RlTGlzdC5sZW5ndGggPj0gTWF0aC5taW4odGhpcy50b3RhbCwgdGhpcy5jYWNoZVRpbWVzICogdGhpcy5saW1pdCk7XHJcblx0fVxyXG5cclxuXHRnZXQoZGlyLCBkb21haW4pIHtcclxuXHRcdGlmICh0aGlzLmlzRW5vdWdoKCkpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuX2dldE5vZGVzKGRpciwgZG9tYWluKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcy5fYWRkTm9kZXMoZGlyLCBkb21haW4pO1xyXG5cdH1cclxuXHJcblx0X2dldE5vZGVzKGRpciwgW3N0YXJ0LCBlbmRdKSB7XHJcblx0XHR2YXIgc2VsZWN0ZWQ7XHJcblxyXG5cdFx0aWYgKGRpciA+IDApIHtcclxuXHRcdFx0c2VsZWN0ZWQgPSB0aGlzLm5vZGVMaXN0LnNsaWNlKDAsIGVuZCAtIHN0YXJ0ICsgMSk7XHJcblx0XHRcdHRoaXMubm9kZUxpc3QgPSB0aGlzLm5vZGVMaXN0LnNsaWNlKGVuZCAtIHN0YXJ0ICsgMSkuY29uY2F0KHNlbGVjdGVkKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHNlbGVjdGVkID0gdGhpcy5ub2RlTGlzdC5zbGljZShzdGFydCAtIGVuZCAtIDEpO1xyXG5cdFx0XHR0aGlzLm5vZGVMaXN0ID0gc2VsZWN0ZWQuY29uY2F0KHRoaXMubm9kZUxpc3Quc2xpY2UoMCwgc3RhcnQgLSBlbmQgLSAxKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHNlbGVjdGVkIHx8IFtdO1xyXG5cdH1cclxuXHJcblx0X2FkZE5vZGVzKGRpciwgW3N0YXJ0LCBlbmRdKSB7XHJcblx0XHR2YXIgbm9kZXMgPSBbXTtcclxuXHJcblx0XHRmb3IgKHZhciBpID0gc3RhcnQ7IGkgPD0gZW5kOyBpKyspIHtcclxuXHRcdFx0bm9kZXMucHVzaChuZXcgUm93Tm9kZSh0aGlzLmNvbHNNb2RlbCwgdGhpcykpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMubm9kZUxpc3QgPSBkaXIgPiAwID8gdGhpcy5ub2RlTGlzdC5jb25jYXQobm9kZXMpIDogbm9kZXMuY29uY2F0KHRoaXMubm9kZUxpc3QpO1xyXG5cclxuXHRcdHJldHVybiBub2RlcztcclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQnVmZmVyTm9kZTtcclxuIiwiY2xhc3MgQnVmZmVyWm9uZSB7XHJcblx0Y29uc3RydWN0b3IobGltaXQsIHRvdGFsLCBjYWNoZVRpbWVzKSB7XHJcblx0XHR0aGlzLmluaXQobGltaXQsIHRvdGFsLCBjYWNoZVRpbWVzKTtcclxuXHR9XHJcblxyXG5cdGluaXQobGltaXQsIHRvdGFsLCBjYWNoZVRpbWVzKSB7XHJcblx0XHR0aGlzLnN0YXJ0ID0gMDtcclxuXHRcdHRoaXMuZW5kID0gdGhpcy5saW1pdCA9IGxpbWl0O1xyXG5cdFx0dGhpcy50b3RhbCA9ICt0b3RhbDtcclxuXHRcdHRoaXMuY2FjaGVUaW1lcyA9IGNhY2hlVGltZXMgfHwgMztcclxuXHRcdHRoaXMuZG9tYWluID0gW3RoaXMuc3RhcnQsIHRoaXMuZW5kXTtcclxuXHR9XHJcblxyXG5cdHNldExpbWl0KGxpbWl0KSB7XHJcblx0XHRpZiAoK2xpbWl0ID4gMCkge1xyXG5cdFx0XHR0aGlzLmluaXQobGltaXQsIHRoaXMudG90YWwpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0c2V0VG90YWwodG90YWwpIHtcclxuXHRcdGlmICgrdG90YWwgPj0gMCkge1xyXG5cdFx0XHR0aGlzLnRvdGFsID0gdG90YWw7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRpc0Ftb25nKHZhbHVlKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5zdGFydCA8PSB2YWx1ZSAmJiB2YWx1ZSA8PSB0aGlzLmVuZDtcclxuXHR9XHJcblxyXG5cdHNob3VsZExvYWQoZGlyLCB2ZXJuaWVyKSB7XHJcblx0XHRpZiAoZGlyID09PSAwKSByZXR1cm4gZmFsc2U7XHJcblxyXG5cdFx0dmFyIHN0YXJ0ID0gdGhpcy5zdGFydDtcclxuXHRcdHZhciBlbmQgPSB0aGlzLmVuZDtcclxuXHRcdHZhciBjYWNoZVRpbWVzID0gdGhpcy5jYWNoZVRpbWVzO1xyXG5cclxuXHRcdC8vIHNjcm9sbCB1cFxyXG5cdFx0aWYgKGRpciA8IDAgJiYgc3RhcnQgPT09IDApIHJldHVybiBmYWxzZTtcclxuXHRcdGlmIChkaXIgPCAwICYmIHZlcm5pZXIgPCBzdGFydCArIHRoaXMubGltaXQpIHtcclxuXHRcdFx0aWYgKHRoaXMuaXNBbW9uZyh2ZXJuaWVyKSkge1xyXG5cdFx0XHRcdGVuZCA9IHN0YXJ0IC0gMTtcclxuXHRcdFx0XHRzdGFydCA9IE1hdGgubWF4KDAsIGVuZCAtIHRoaXMubGltaXQpO1xyXG5cdFx0XHR9IGVsc2UgaWYgKHZlcm5pZXIgPT09IDApIHtcclxuXHRcdFx0XHRlbmQgPSBNYXRoLm1pbih0aGlzLnRvdGFsLCB2ZXJuaWVyICsgY2FjaGVUaW1lcyAqIHRoaXMubGltaXQpO1xyXG5cdFx0XHRcdHN0YXJ0ID0gMDtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRlbmQgPSB2ZXJuaWVyICsgdGhpcy5saW1pdDtcclxuXHRcdFx0XHRzdGFydCA9IE1hdGgubWF4KDAsIHZlcm5pZXIgLSAoY2FjaGVUaW1lcyAtIDEpICogdGhpcy5saW1pdCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuZG9tYWluID0gW3N0YXJ0LCBlbmRdO1xyXG5cdFx0XHR0aGlzLnN0YXJ0ID0gc3RhcnQ7XHJcblx0XHRcdHRoaXMuZW5kID0gTWF0aC5taW4oc3RhcnQgKyBjYWNoZVRpbWVzICogdGhpcy5saW1pdCwgdGhpcy5lbmQpO1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBzY3JvbGwgZG93blxyXG5cdFx0aWYgKGRpciA+IDAgJiYgZW5kID09PSB0aGlzLnRvdGFsKSByZXR1cm4gZmFsc2U7XHJcblx0XHRpZiAoZGlyID4gMCAmJiB2ZXJuaWVyID4gZW5kIC0gdGhpcy5saW1pdCkge1xyXG5cdFx0XHQvLyDmuLjmoIflnKjnjrDmnInojIPlm7TlhoVcclxuXHRcdFx0aWYgKHRoaXMuaXNBbW9uZyh2ZXJuaWVyKSkge1xyXG5cdFx0XHRcdHN0YXJ0ID0gZW5kICsgMTtcclxuXHRcdFx0XHRlbmQgPSBNYXRoLm1pbih0aGlzLnRvdGFsLCBzdGFydCArIHRoaXMubGltaXQpO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIOa4uOagh+WIsOi+vue7k+WwvlxyXG5cdFx0XHRlbHNlIGlmICh2ZXJuaWVyID09PSB0aGlzLnRvdGFsKSB7XHJcblx0XHRcdFx0ZW5kID0gdGhpcy50b3RhbDtcclxuXHRcdFx0XHRzdGFydCA9IE1hdGgubWF4KDAsIHZlcm5pZXIgLSBjYWNoZVRpbWVzICogdGhpcy5saW1pdCk7XHJcblx0XHRcdH1cclxuXHRcdFx0Ly8g5LiN5Zyo546w5pyJ6IyD5Zu05Y+I5pyq5Yiw57uT5bC+5aSEXHJcblx0XHRcdGVsc2Uge1xyXG5cdFx0XHRcdGVuZCA9IE1hdGgubWluKHRoaXMudG90YWwsIHZlcm5pZXIgKyAoY2FjaGVUaW1lcyAtIDEpICogdGhpcy5saW1pdCk7XHJcblx0XHRcdFx0c3RhcnQgPSBNYXRoLm1heCgwLCBlbmQgLSBjYWNoZVRpbWVzICogdGhpcy5saW1pdCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuZG9tYWluID0gW3N0YXJ0LCBlbmRdO1xyXG5cdFx0XHR0aGlzLmVuZCA9IGVuZDtcclxuXHRcdFx0dGhpcy5zdGFydCA9IE1hdGgubWF4KHRoaXMuc3RhcnQsIGVuZCAtIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQnVmZmVyWm9uZTsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi4vdXRpbC9FdmVudEVtaXR0ZXInKTtcclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbC9VdGlscycpO1xyXG52YXIgXyA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydfJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWydfJ10gOiBudWxsKTtcclxuXHJcbnZhciBkZWZSZW5kZXJlciA9IHYgPT4gdjtcclxudmFyIE9SREVSID0gWydBU0MnLCAnREVTQyddO1xyXG5cclxuY2xhc3MgQ29sdW1uIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHRjb25zdHJ1Y3RvcihjaWQsIG9wdGlvbnMsIGNvbnRleHQpIHtcclxuXHRcdHN1cGVyKCk7XHJcblxyXG5cdFx0b3B0aW9ucy5yZW5kZXJlciA9IG9wdGlvbnMucmVuZGVyZXIgfHwgZGVmUmVuZGVyZXI7XHJcblxyXG5cdFx0dmFyIGRlZmF1bHRzID0ge1xyXG5cdFx0XHQndGV4dCc6ICcnLFxyXG5cdFx0XHQndnR5cGUnOiAnc3RyaW5nJyxcclxuXHRcdFx0J2RhdGFJbmRleCc6ICcnLFxyXG5cdFx0XHQnd2lkdGgnOiA1MCxcclxuXHRcdFx0J2FsaWduJzogJ2xlZnQnLFxyXG5cclxuXHRcdFx0J3Jlc2l6YWJsZSc6IHRydWUsXHJcblx0XHRcdCdjbHMnOiAnJyxcclxuXHRcdFx0J2ZpeGVkJzogZmFsc2UsXHJcblx0XHRcdCdkcmFnZ2FibGUnOiBmYWxzZSxcclxuXHRcdFx0J3NvcnRhYmxlJzogdHJ1ZSxcclxuXHRcdFx0J2hpZGRlbic6IGZhbHNlLFxyXG5cdFx0XHQnbG9ja2VkJzogZmFsc2UsXHJcblx0XHRcdCdsb2NrYWJsZSc6IHRydWUsXHJcblx0XHRcdCdtZW51RGlzYWJsZWQnOiB0cnVlLFxyXG5cclxuXHRcdFx0Ly8gcHJpdmF0ZVxyXG5cdFx0XHQnc29ydFN0YXRlJzogbnVsbFxyXG5cdFx0fTtcclxuXHJcblx0XHR0aGlzLmNpZCA9IGNpZDtcclxuXHRcdHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XHJcblx0XHRPYmplY3QuYXNzaWduKHRoaXMsIGRlZmF1bHRzLCBvcHRpb25zKTtcclxuXHR9XHJcblxyXG5cdHNldFRleHQodGV4dCkge1xyXG5cdFx0aWYgKHR5cGVvZiB0ZXh0ICE9ICdzdHJpbmcnKSByZXR1cm47XHJcblxyXG5cdFx0dGhpcy50ZXh0ID0gdGV4dDtcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLXRleHRlZCcsIHRoaXMudGV4dCwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHRzZXRXaWR0aChudW0pIHtcclxuXHRcdGlmICghdGhpcy5yZXNpemFibGUpIHJldHVybjtcclxuXHRcdGlmIChpc05hTihudW0pKSByZXR1cm47XHJcblxyXG5cdFx0dGhpcy53aWR0aCA9ICtudW07XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1yZXNpemVkJywgdGhpcy53aWR0aCwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHRzaG93KCkge1xyXG5cdFx0dGhpcy5oaWRkZW4gPSBmYWxzZTtcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLWhpZGRlbicsIHRoaXMuaGlkZGVuLCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdGhpZGUoKSB7XHJcblx0XHR0aGlzLnVuTG9jaygpO1xyXG5cdFx0XHJcblx0XHR0aGlzLmhpZGRlbiA9IHRydWU7XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1oaWRkZW4nLCB0aGlzLmhpZGRlbiwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHR0b2dnbGUoKSB7XHJcblx0XHRpZiAodGhpcy5oaWRkZW4pIHtcclxuXHRcdFx0dGhpcy5zaG93KCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aGlzLmhpZGUoKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGxvY2soKSB7XHJcblx0XHRpZiAoIXRoaXMubG9ja2FibGUpIHJldHVybjtcclxuXHRcdGlmICh0aGlzLmxvY2tlZCkgcmV0dXJuO1xyXG5cclxuXHRcdHRoaXMuc2hvdygpO1xyXG5cclxuXHRcdHRoaXMubG9ja2VkID0gdHJ1ZTtcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLWxvY2tlZCcsIHRoaXMubG9ja2VkLCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdHVuTG9jaygpIHtcclxuXHRcdGlmICghdGhpcy5sb2NrYWJsZSkgcmV0dXJuO1xyXG5cdFx0aWYgKCF0aGlzLmxvY2tlZCkgcmV0dXJuO1xyXG5cclxuXHRcdHRoaXMubG9ja2VkID0gZmFsc2U7XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1sb2NrZWQnLCB0aGlzLmxvY2tlZCwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBvcmRlcltBU0MsIERFU0MsIE5PX1NPUlRdXHJcblx0ICovXHJcblx0c29ydChvcmRlcikge1xyXG5cdFx0aWYgKCF0aGlzLnNvcnRhYmxlIHx8ICF0aGlzLmRhdGFJbmRleCkgcmV0dXJuO1xyXG5cclxuXHRcdGlmIChvcmRlcikge1xyXG5cdFx0XHR0aGlzLnNvcnRTdGF0ZSA9IE9SREVSLmluY2x1ZGVzKG9yZGVyKSA/IG9yZGVyIDogbnVsbDtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoaXMuc29ydFN0YXRlID0gdGhpcy5zb3J0U3RhdGUgPT09IE9SREVSWzFdID8gT1JERVJbMF0gOiBPUkRFUlsxXTtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4tc29ydC1jaGFuZ2VkJywgdGhpcy5zb3J0U3RhdGUpO1xyXG5cdFx0dGhpcy5jb250ZXh0LmZpcmUoJ25vdGljZS1jb2xNb2RlbC1zb3J0LWNoYW5nZWQnKTtcclxuIFx0fVxyXG5cclxuIFx0bW92ZVRvKGluZGV4KSB7XHJcbiBcdFx0aWYgKGlzTmFOKCtpbmRleCkpIHJldHVybjtcclxuXHJcbiBcdFx0Ly8gdGhpcy5jb250ZXh0LmZpcmUoJ2NvbHVtbi1tb3ZlLXRvJywgdGhpcywgK2luZGV4KTtcclxuIFx0XHR0aGlzLmNvbnRleHQubW92ZSh0aGlzLCAraW5kZXgpO1xyXG4gXHR9XHJcblxyXG4gXHRyZW1vdmUoKSB7XHJcbiBcdFx0dGhpcy5maXJlKCdkZXN0b3J5Jyk7XHJcbiBcdFx0dGhpcy5jb250ZXh0LmZpcmUoJ2NvbHVtbi1yZW1vdmVkJywgdGhpcyk7XHJcbiBcdFx0dGhpcy5yZW1vdmVFdmVudCgpO1xyXG4gXHR9XHJcbn1cclxuXHJcblxyXG5jbGFzcyBDb2xNb2RlbCBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblx0Y29uc3RydWN0b3IoY29sdW1ucykge1xyXG5cdFx0c3VwZXIoKTtcclxuXHJcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoY29sdW1ucykpIHtcclxuXHRcdFx0dGhyb3cgJ3JlcXVpcmUgcHJvcGVydHkgY29sdW1ucyBpcyBhIGFycmF5IG9iamVjdCc7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5jb2x1bW5zID0gW107IC8vIGRhdGEgYnkgY29sdW1uXHJcblx0XHR0aGlzLmNvbE1vZGVsID0gbmV3IE1hcCgpOyAvLyBkYXRhIGJ5IGNpZFxyXG5cdFx0dGhpcy5jb2xIZWFkZXJzID0gbmV3IE1hcCgpOyAvLyBkYXRhIGJ5IGRhdGFJbmRleFxyXG5cclxuXHRcdHRoaXMuX2luaXRDb2x1bW4oY29sdW1ucyk7XHJcblx0XHR0aGlzLl9iaW5kRXZlbnQoKTtcclxuXHR9XHJcblxyXG5cdF9pbml0Q29sdW1uKGNvbHVtbnMsIGNhbGxiYWNrKSB7XHJcblx0XHRsZXQgc2l6ZSA9IHRoaXMuc2l6ZSgpO1xyXG5cclxuXHRcdGNvbHVtbnMuZm9yRWFjaCgoY29sLCBpbmRleCkgPT4ge1xyXG5cdFx0XHQvLyBjaWTop6PlhrPmsqHmnIlkYXRhSW5kZXjliJfmiJbnm7jlkIxkYXRhSW5kZXjliJfnmoTpl67pophcclxuXHRcdFx0bGV0IGNpZCA9IGluZGV4ICsgc2l6ZTtcclxuXHRcdFx0bGV0IGNvbE0gPSBuZXcgQ29sdW1uKGNpZCwgY29sLCB0aGlzKTtcclxuXHJcblx0XHRcdHRoaXMuY29sTW9kZWwuc2V0KGNpZCwgY29sTSk7XHJcblx0XHRcdHRoaXMuY29sdW1ucy5wdXNoKGNvbE0pO1xyXG5cdFx0XHR0aGlzLmNvbEhlYWRlcnMuc2V0KGNvbC5kYXRhSW5kZXgsIGNvbE0pO1xyXG5cclxuXHRcdFx0Y2FsbGJhY2sgJiYgY2FsbGJhY2soY29sTSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGFkZENvbHVtbnMoY29sdW1ucykge1xyXG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KGNvbHVtbnMpKSB7XHJcblx0XHRcdGNvbHVtbnMgPSBbY29sdW1uc107XHJcblx0XHR9XHJcblx0XHR0aGlzLl9pbml0Q29sdW1uKGNvbHVtbnMsIGNvbE0gPT4gdGhpcy5maXJlKCdjb2x1bW4tYWRkJywgY29sTSkpO1xyXG5cdH1cclxuXHJcblx0cmVtb3ZlQ29sdW1uKGRhdGFJbmRleCkge1xyXG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KGRhdGFJbmRleCkpIHtcclxuXHRcdFx0ZGF0YUluZGV4ID0gW2RhdGFJbmRleF07XHJcblx0XHR9XHJcblxyXG5cdFx0ZGF0YUluZGV4LmZvckVhY2goZHMgPT4ge1xyXG5cdFx0XHRsZXQgY29sTSA9IHRoaXMuZ2V0Q29sdW1uQnlEYXRhSW5kZXgoZHMpO1xyXG5cclxuXHRcdFx0aWYgKGNvbE0pIHtcclxuXHRcdFx0XHRjb2xNLnJlbW92ZSgpO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHR0aGlzLm9uKCdub3RpY2UtY29sTW9kZWwtc29ydC1jaGFuZ2VkJywgXy5kZWJvdW5jZSgoKSA9PiB7XHJcblx0XHRcdHRoaXMuZmlyZSgnY29sdW1ucy1zb3J0LWNoYW5nZWQnKTtcclxuXHRcdH0sIDIwKSk7XHJcblxyXG5cdFx0dGhpcy5vbignY29sdW1uLXJlbW92ZWQnLCBjb2xNID0+IHtcclxuXHRcdFx0dGhpcy5jb2x1bW5zID0gdGhpcy5jb2x1bW5zLmZpbHRlcihjb2wgPT4gY29sLmRhdGFJbmRleCAhPSBjb2xNLmRhdGFJbmRleCk7XHJcblx0XHRcdHRoaXMuY29sTW9kZWwuZGVsZXRlKGNvbE0uY2lkKTtcclxuXHRcdFx0dGhpcy5jb2xIZWFkZXJzLmRlbGV0ZShjb2xNLmRhdGFJbmRleCk7XHJcblx0XHR9KTtcclxuXHJcblx0fVxyXG5cclxuXHRtb3ZlKGNvbE0sIHRvSW5kZXgpIHtcclxuXHRcdGxldCBjdXJyZW50ID0gdGhpcy5jb2x1bW5zLmluZGV4T2YoY29sTSk7XHJcblxyXG5cdFx0Ly8gVE9ET1xyXG5cdFx0Ly8g5aaC5p6c56e75Yiw5Ya757uT5YiX5L2N572u77yM6ZyA5Ya757uTXHJcblxyXG5cdFx0aWYgKHRvSW5kZXggPT09IGN1cnJlbnQpIHJldHVybjtcclxuXHJcblx0XHRpZiAodG9JbmRleCA+IGN1cnJlbnQpIHtcclxuXHRcdFx0Ly8g5pqC5pe25YWD57Sg6YO95piv55SoJCgpLmFmdGVy56e75Yqo77yM5omA5Lul5L2N572udG9JbmRleCArIDFcclxuXHRcdFx0dGhpcy5jb2x1bW5zLnNwbGljZSh0b0luZGV4ICsgMSwgMCwgdGhpcy5jb2x1bW5zW2N1cnJlbnRdKTtcclxuXHRcdFx0dGhpcy5jb2x1bW5zLnNwbGljZShjdXJyZW50LCAxKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoaXMuY29sdW1ucy5zcGxpY2UodG9JbmRleCArIDEsIDAsIHRoaXMuY29sdW1uc1tjdXJyZW50XSk7XHJcblx0XHRcdHRoaXMuY29sdW1ucy5zcGxpY2UoKytjdXJyZW50LCAxKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1tb3ZlZCcsIGNvbE0sIGN1cnJlbnQsIHRvSW5kZXgpO1xyXG5cdH1cclxuXHJcblx0c2l6ZSgpIHsgXHJcblx0XHRyZXR1cm4gdGhpcy5jb2xNb2RlbC5zaXplOyBcclxuXHR9XHJcblxyXG5cdGdldENvbHVtbihjb2wpIHtcclxuXHRcdGlmICh0aGlzLmNvbHVtbnMuaW5jbHVkZXMoY29sKSkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5jb2x1bW5zLmZpbHRlcihfY29sID0+IF9jb2wgPT0gY29sKVswXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcy5jb2x1bW5zO1xyXG5cdH1cclxuXHJcblx0Z2V0TG9ja0NvbHVtbigpIHtcclxuXHRcdHJldHVybiB0aGlzLmNvbHVtbnMuZmlsdGVyKGNvbE0gPT4ge1xyXG5cdFx0XHRyZXR1cm4gY29sTS5sb2NrZWQgPT09IHRydWU7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGdldFZpc2libGVDb2x1bW4oKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5jb2x1bW5zLmZpbHRlcihjb2xNID0+IHtcclxuXHRcdFx0cmV0dXJuICFjb2xNLmhpZGRlbjtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0Z2V0Q29sdW1uQnlEYXRhSW5kZXgoZGF0YUluZGV4KSB7XHJcblx0XHRyZXR1cm4gdGhpcy5jb2xIZWFkZXJzLmdldChkYXRhSW5kZXgpIHx8IG51bGw7XHJcblx0fVxyXG5cclxuXHRnZXRDb2x1bW5zQnlJZChpZCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuY29sTW9kZWwuZ2V0KGlkKSB8fCBudWxsO1xyXG5cdH1cclxuXHJcblx0ZWFjaChjYWxsYmFjaywgY29udGV4dCkge1xyXG5cdFx0dGhpcy5jb2x1bW5zLmZvckVhY2goY2FsbGJhY2ssIGNvbnRleHQgfHwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHRkZXN0b3J5KCkgeyBcclxuXHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENvbE1vZGVsOyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCcuLi91dGlsL0V2ZW50RW1pdHRlcicpO1xyXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuLi91dGlsL1V0aWxzJyk7XHJcbnZhciBfID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ18nXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ18nXSA6IG51bGwpO1xyXG5cclxuY2xhc3MgUm93IHtcclxuXHRjb25zdHJ1Y3RvcihyaWQsIGRhdGEpIHtcclxuXHRcdHRoaXMucmlkID0gcmlkO1xyXG5cdFx0dGhpcy5kYXRhID0gZGF0YTtcclxuXHRcdHRoaXMuc2VsZWN0ZWQgPSBmYWxzZTtcclxuXHR9XHJcblx0c3RhdGUoKSB7fVxyXG59XHJcblxyXG5jbGFzcyBHcmlkU3RvcmUgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cclxuXHRjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcblx0XHRzdXBlcigpO1xyXG5cclxuXHRcdHRoaXMuY29sc01vZGVsID0gb3B0aW9ucy5jb2x1bW5Nb2RlbDtcclxuXHJcblx0XHR0aGlzLnJvd3MgPSBbXTsgLy8gZGF0YSBieSBpbmRleFxyXG5cdFx0dGhpcy5yb3dNb2RlbCA9IG5ldyBNYXAoKTsgLy8gZGF0YSBieSBpZFxyXG5cclxuXHJcblx0XHR0aGlzLnNldERhdGEob3B0aW9ucy5kYXRhKTtcclxuXHJcblx0XHR0aGlzLl9zb3J0U3RhdGUgPSB7IGtleXM6IFtdLCBkaXJzOiBbXSB9O1xyXG5cdFx0dGhpcy5fYmluZEV2ZW50KCk7XHJcblx0fVxyXG5cclxuXHRfYmluZEV2ZW50KCkge1xyXG5cclxuXHRcdHRoaXMuY29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1zb3J0LWNoYW5nZWQnLCBzb3J0U3RhdGUgPT4ge1xyXG5cdFx0XHRcdGxldCB7IGtleXMsIGRpcnMgfSA9IHRoaXMuX3NvcnRTdGF0ZTtcclxuXHRcdFx0XHRsZXQgaW5kZXggPSBrZXlzLmluZGV4T2YoY29sTS5kYXRhSW5kZXgpO1xyXG5cclxuXHRcdFx0XHQvLyDmnKrmjpLluo9cclxuXHRcdFx0XHRpZiAoaW5kZXggPT09IC0xICYmICFzb3J0U3RhdGUpIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmIChpbmRleCA9PT0gLTEgJiYgc29ydFN0YXRlKSB7XHJcblx0XHRcdFx0XHRrZXlzLnVuc2hpZnQoY29sTS5kYXRhSW5kZXgpO1xyXG5cdFx0XHRcdFx0ZGlycy51bnNoaWZ0KHNvcnRTdGF0ZS50b0xvd2VyQ2FzZSgpKTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIOW3suaOkuW6jyzlhYjliKDpmaRcclxuXHRcdFx0XHRsZXQga2V5ID0ga2V5cy5zcGxpY2UoaW5kZXgsIDEpWzBdO1xyXG5cdFx0XHRcdGxldCBkaXIgPSBkaXJzLnNwbGljZShpbmRleCwgMSlbMF07XHJcblxyXG5cdFx0XHRcdGlmIChzb3J0U3RhdGUpIHtcclxuXHRcdFx0XHRcdGtleXMudW5zaGlmdChrZXkpO1xyXG5cdFx0XHRcdFx0ZGlycy51bnNoaWZ0KHNvcnRTdGF0ZS50b0xvd2VyQ2FzZSgpKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdC8vIOaJgOacieWIl+mDveabtOaWsOeKtuaAgeWQjlxyXG5cdFx0dGhpcy5jb2xzTW9kZWwub24oJ2NvbHVtbnMtc29ydC1jaGFuZ2VkJywgKCkgPT4ge1xyXG5cdFx0XHRsZXQgeyBrZXlzLCBkaXJzIH0gPSB0aGlzLl9zb3J0U3RhdGU7XHJcblx0XHRcdGxldCBpdGVyYXRlRm4gPSByb3cgPT4gcm93LmRhdGFba2V5c1swXV07XHJcblxyXG5cdFx0XHQvLyBjb25zb2xlLmxvZyhrZXlzLCBkaXJzKTtcclxuXHJcblx0XHRcdHRoaXMucm93cyA9IF8ub3JkZXJCeSh0aGlzLnJvd3MsIGl0ZXJhdGVGbiwgZGlycyk7XHJcblx0XHRcdHRoaXMuc2V0RGF0YShfLm1hcCh0aGlzLnJvd3MsICdkYXRhJykpO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRzbGljZShzdGFydCwgZW5kKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yb3dzLnNsaWNlKHN0YXJ0LCBlbmQpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICog6K6+572u5o6S5bqP54q25oCBXHJcblx0ICogKCspQVNDLCAtREVTQywgIU5PX1NPUlRcclxuXHQgKiBAc29ydHMge0FycmF5fSBzb3J0cyAt5o6S5bqP54q25oCB5pWw57uEXHJcblx0ICpcdHNvcnRzID0gWycrY29sQScsICdjb2xCJywgJy1jb2xDJywgJyFjb2xEJ11cclxuXHQgKiBAcmV0dXJucyB0aGlzO1xyXG5cdCAqL1xyXG5cdHNldFNvcnRTdGF0ZShzb3J0cykge1xyXG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KHNvcnRzKSkge1xyXG5cdFx0XHRzb3J0cyA9IFtzb3J0c107XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5fc29ydFN0YXRlID0geyBrZXlzOiBbXSwgZGlyczogW10gfTtcclxuXHJcblx0XHQvLyDlj43ovazkvJjlhYjnuqfmlrnkvr/lkI7nu63op6blj5Hpobrluo/ml7blkI7op6blj5HnmoTkvJjlhYjnuqfpq5hcclxuXHRcdHNvcnRzLnJldmVyc2UoKS5lYWNoKHNvcnRPYmogPT4ge1xyXG5cdFx0XHRsZXQgb2JqLCBrZXksIGRpciwgY29sO1xyXG5cclxuXHRcdFx0aWYgKHR5cGVvZiBzb3J0T2JqID09PSAnc3RyaW5nJykge1xyXG5cdFx0XHRcdG9iaiA9IHNvcnRPYmoubWF0Y2goLyheWyt8LXwhXT8pKC57MCx9KS8pO1xyXG5cdFx0XHRcdGRpciA9IG9ialsxXSA9PT0gJycgPyAnQVNDJyA6IChvYmogPT09ICctJyA/ICdERVNDJyA6ICdOT19TT1JUJyk7XHJcblx0XHRcdFx0a2V5ID0gb2JqWzJdID8gb2JqWzJdIDogbnVsbDtcclxuXHJcblx0XHRcdFx0Y29sID0gdGhpcy5jb2xzTW9kZWwuZ2V0Q29sdW1uQnlEYXRhSW5kZXgoa2V5KTtcclxuXHRcdFx0XHRpZiAoY29sKSB7XHJcblx0XHRcdFx0XHRjb2wuc29ydChkaXIpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRzZXREYXRhKGRhdGEgPSBbXSwgYXBwZW5kID0gZmFsc2UpIHtcclxuXHRcdGlmICghYXBwZW5kKSB7XHJcblx0XHRcdHRoaXMucm93cy5sZW5ndGggPSAwO1xyXG5cdFx0XHR0aGlzLnJvd01vZGVsLmNsZWFyKCk7XHJcblx0XHR9XHJcblx0XHR2YXIgaW5kZXggPSB0aGlzLnNpemUoKTtcclxuXHRcdGRhdGEuZm9yRWFjaCgocm93LCByaWR4KSA9PiB7XHJcblx0XHRcdGxldCByb3dNID0gbmV3IFJvdyhyaWR4ICsgaW5kZXgsIHJvdyk7XHJcblx0XHRcdHRoaXMucm93cy5wdXNoKHJvd00pO1xyXG5cdFx0XHR0aGlzLnJvd01vZGVsLnNldChyaWR4ICsgaW5kZXgsIHJvd00pO1xyXG5cdFx0fSk7XHJcblx0XHR0aGlzLmZpcmUoJ2RhdGEtY2hhbmdlZCcsIGFwcGVuZCk7XHJcblx0fVxyXG5cclxuXHRmb3JFYWNoKGNhbGxiYWNrLCBjb250ZXh0KSB7XHJcblx0XHR0aGlzLnJvd3MuZm9yRWFjaChmdW5jdGlvbihyb3dNLCByaWR4KSB7XHJcblx0XHRcdGNhbGxiYWNrLmNhbGwodGhpcywgcm93TS5kYXRhLCByaWR4KTtcclxuXHRcdH0sIGNvbnRleHQgfHwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHRzaXplKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMucm93TW9kZWwuc2l6ZTtcclxuXHR9XHJcblxyXG5cdHN1bShkYXRhSW5kZXgpIHtcclxuXHRcdHJldHVybiBfLnN1bUJ5KHRoaXMucm93cywgcm93ID0+ICtyb3cuZGF0YVtkYXRhSW5kZXhdKTtcclxuXHR9XHJcblxyXG5cdGF2ZyhkYXRhSW5kZXgpIHtcclxuXHRcdHJldHVybiBfLm1lYW5CeSh0aGlzLnJvd3MsIHJvdyA9PiArcm93LmRhdGFbZGF0YUluZGV4XSk7XHJcblx0fVxyXG5cclxuXHRtYXgoZGF0YUluZGV4KSB7XHJcblx0XHRyZXR1cm4gXy5tYXhCeSh0aGlzLnJvd3MsIHJvdyA9PiArcm93LmRhdGFbZGF0YUluZGV4XSk7XHJcblx0fVxyXG5cclxuXHRtaW4oZGF0YUluZGV4KSB7XHJcblx0XHRyZXR1cm4gXy5taW5CeSh0aGlzLnJvd3MsIHJvdyA9PiArcm93LmRhdGFbZGF0YUluZGV4XSk7XHJcblx0fVxyXG5cclxuXHRkZXN0b3J5KCkgeyBcclxuXHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEdyaWRTdG9yZTsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi4vdXRpbC9FdmVudEVtaXR0ZXInKTtcclxudmFyIENvbE1vZGVsID0gcmVxdWlyZSgnLi9Db2xNb2RlbCcpO1xyXG52YXIgR3JpZFN0b3JlID0gcmVxdWlyZSgnLi9HcmlkU3RvcmUnKTtcclxudmFyIEJ1ZmZlck5vZGUgPSByZXF1aXJlKCcuL0J1ZmZlck5vZGUnKTtcclxudmFyIEJ1ZmZlclpvbmUgPSByZXF1aXJlKCcuL0J1ZmZlclpvbmUnKTtcclxudmFyIEhlYWRlciA9IHJlcXVpcmUoJy4vSGVhZGVyJyk7XHJcbnZhciBMb2NrQ29sTWFuYWdlciA9IHJlcXVpcmUoJy4vTG9ja0NvbE1hbmFnZXInKTtcclxudmFyIFNjcm9sbGVyID0gcmVxdWlyZSgnLi9TY3JvbGxlcicpO1xyXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuLi91dGlsL1V0aWxzJyk7XHJcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ2pRdWVyeSddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnalF1ZXJ5J10gOiBudWxsKTtcclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZUxheW91dChjb250YWluZXIsIHdpZHRoKSB7XHJcblx0dmFyIHdyYXBwZXIgPSAkKCc8ZGl2Lz4nKS5hZGRDbGFzcygnYy1ncmlkLXdyYXBwZXInKS53aWR0aCh3aWR0aCk7XHJcblx0dmFyIGhlYWRlciA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWdyaWQtaGVhZGVyJyk7XHJcblx0dmFyIGJvZHkgPSAkKCc8ZGl2Lz4nKS5hZGRDbGFzcygnYy1ncmlkLWJvZHknKTtcclxuXHR2YXIgdmlld3BvcnQgPSAkKCc8ZGl2Lz4nKS5hZGRDbGFzcygnYy1ncmlkLXZpZXdwb3J0JykuYXBwZW5kVG8oYm9keSk7XHJcblx0dmFyIGNhbnZhcyA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWdyaWQtY2FudmFzJykuYXBwZW5kVG8odmlld3BvcnQpO1xyXG5cdHdyYXBwZXIuYXBwZW5kKGhlYWRlcikuYXBwZW5kKGJvZHkpLmFwcGVuZFRvKGNvbnRhaW5lcik7XHJcblxyXG5cdHJldHVybiB7IHdyYXBwZXIsIGhlYWRlciwgYm9keSwgdmlld3BvcnQsIGNhbnZhcyB9O1xyXG59XHJcbmZ1bmN0aW9uIGNhbGNSb3dIZWlnaHQoKSB7XHJcblx0dmFyIGxpID0gJCgnPGxpIGNsYXNzPVwiYy1ncmlkLWNlbGxcIj5wbGFjZWhvbGRlcjwvbGk+JykuYXBwZW5kVG8oXCJib2R5XCIpO1xyXG5cdHZhciByb3dIZWlnaHQgPSBsaS5vdXRlckhlaWdodCgpO1xyXG5cdGxpLnJlbW92ZSgpO1xyXG5cclxuXHRyZXR1cm4gcm93SGVpZ2h0O1xyXG59XHJcblxyXG5jbGFzcyBHcmlkQ29tcG9uZW50IGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHRjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcblx0XHRzdXBlcigpO1xyXG5cclxuXHRcdGlmICghJChvcHRpb25zLmRvbUVsKS5zaXplKCkpIHsgdGhyb3cgJ3JlcXVpcmUgYSB2YWxpZCBkb21FbCc7IH1cclxuXHJcblx0XHR0aGlzLnNob3VsZEFkZE5vZGVzID0gdHJ1ZTtcclxuXHRcdHRoaXMuaGVpZ2h0ID0gK29wdGlvbnMuaGVpZ2h0IHx8IDUwMDtcclxuXHRcdHRoaXMud2lkdGggPSBvcHRpb25zLndpZHRoO1xyXG5cclxuXHRcdC8vICRsYXlvdXQgZG9tXHJcblx0XHRPYmplY3QuYXNzaWduKHRoaXMuJGRvbSA9IHt9LCBjcmVhdGVMYXlvdXQoJChvcHRpb25zLmRvbUVsKSwgdGhpcy53aWR0aCkpO1xyXG5cclxuXHRcdHRoaXMuY29sdW1uTW9kZWwgPSBuZXcgQ29sTW9kZWwob3B0aW9ucy5jb2x1bW5zKTtcclxuXHRcdHRoaXMuc3RvcmUgPSBuZXcgR3JpZFN0b3JlKHsgY29sdW1uTW9kZWw6IHRoaXMuY29sdW1uTW9kZWwsICdkYXRhJzogb3B0aW9ucy5kYXRhIHx8IFtdIH0pO1xyXG5cdFx0dGhpcy5faW5pdCgpO1xyXG5cdFx0dGhpcy5fYmluZEV2ZW50KCk7XHJcblx0fVxyXG5cclxuXHRfaW5pdCgpIHtcclxuXHRcdHRoaXMuaGVhZGVyID0gbmV3IEhlYWRlcih0aGlzLiRkb20uaGVhZGVyLCB0aGlzLmNvbHVtbk1vZGVsKTtcclxuXHRcdHZhciB0b3RhbCA9IHRoaXMuc3RvcmUuc2l6ZSgpO1xyXG5cdFx0dmFyIHJvd0hlaWdodCA9IHRoaXMucm93SGVpZ2h0ID0gY2FsY1Jvd0hlaWdodCgpO1xyXG5cdFx0dmFyIHZpZXdwb3J0SGVpZ2h0ID0gdGhpcy5oZWlnaHQgLSB0aGlzLiRkb20uaGVhZGVyLm91dGVySGVpZ2h0KCk7XHJcblx0XHR2YXIgc2luZ2xlUGFnZVNpemUgPSBNYXRoLm1pbihNYXRoLmNlaWwodmlld3BvcnRIZWlnaHQvIHJvd0hlaWdodCkgLSAxLCB0b3RhbCAtIDEpO1xyXG5cclxuXHRcdHRoaXMuYnVmZmVyWm9uZSA9IG5ldyBCdWZmZXJab25lKHNpbmdsZVBhZ2VTaXplLCB0b3RhbCk7XHJcblx0XHR0aGlzLmJ1ZmZlck5vZGUgPSBuZXcgQnVmZmVyTm9kZShzaW5nbGVQYWdlU2l6ZSwgdGhpcy5jb2x1bW5Nb2RlbCwgdG90YWwpO1xyXG5cdFx0dGhpcy5zY3JvbGxlciA9IG5ldyBTY3JvbGxlcihyb3dIZWlnaHQsIHRoaXMuYnVmZmVyWm9uZSk7XHJcblx0XHR0aGlzLnNjcm9sbGVyXHJcblx0XHRcdC5vblgoeCA9PiB7XHJcblx0XHRcdFx0dGhpcy5maXJlKCdzY3JvbGxMZWZ0JywgeCk7XHJcblx0XHRcdFx0dGhpcy4kZG9tLmhlYWRlci5zY3JvbGxMZWZ0KHgpO1xyXG5cdFx0XHR9KVxyXG5cdFx0XHQub25ZKChkaXIsIGRvbWFpbiwgc3RhcnQsIGVuZCwgaW5kZXgsIHRvdGFsKSA9PiB7XHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coYOa7muWKqOaWueWQke+8miR7ZGlyfSwg5Yqg6L295Yy66Ze0OiBbJHtkb21haW59XSwg546w5pyJ6IyD5Zu077yaKCR7c3RhcnR9IC0gJHtlbmR9KSwgYClcclxuXHRcdFx0XHR0aGlzLl9idWZmZXJSZW5kZXIoZGlyLCBkb21haW4pO1xyXG5cdFx0XHR9LCAyMCk7XHJcblxyXG5cdFx0dGhpcy4kZG9tLnZpZXdwb3J0LmhlaWdodCh2aWV3cG9ydEhlaWdodCk7XHJcblx0XHR0aGlzLiRkb20udmlld3BvcnQub24oJ3Njcm9sbCcsIChldnQpID0+IHtcclxuXHRcdFx0dGhpcy5zY3JvbGxlci5maXJlWShldnQudGFyZ2V0LnNjcm9sbFRvcCk7XHJcblx0XHRcdHRoaXMuc2Nyb2xsZXIuZmlyZVgoZXZ0LnRhcmdldC5zY3JvbGxMZWZ0KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMubG9ja0NvbE1hbmFnZXIgPSBMb2NrQ29sTWFuYWdlcih0aGlzLmNvbHVtbk1vZGVsLCB0aGlzLmhlYWRlciwgdGhpcy4kZG9tLCB0aGlzLmJ1ZmZlck5vZGUpO1xyXG5cdFx0dGhpcy5fc2V0Q2FudmFzV0godG90YWwpO1xyXG5cdH1cclxuXHJcblx0X3NldENhbnZhc1dIKHRvdGFsKSB7XHJcblx0XHR0aGlzLiRkb20uY2FudmFzXHJcblx0XHRcdC53aWR0aCh0b3RhbCA/ICdhdXRvJyA6IHRoaXMuX3VuTG9ja1Zpc2libGVDb2xzV2lkdGgoKSlcclxuXHRcdFx0LmhlaWdodCh0aGlzLnJvd0hlaWdodCAqIHRvdGFsIHx8IDEpO1xyXG5cdH1cclxuXHJcblx0X3VuTG9ja1Zpc2libGVDb2xzV2lkdGgoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5oZWFkZXIuZ2V0VmlzaWJsZUNvbHNXaWR0aCgpICsgdGhpcy5sb2NrQ29sTWFuYWdlci52aXNpYmxlTG9ja0NvbHVtbi5nZXRXaWR0aCgpO1xyXG5cdH1cclxuXHJcblx0c2Nyb2xsVG9Ub3AocG9zaXRpb24pIHtcclxuXHRcdHRoaXMuJGRvbS52aWV3cG9ydC5zY3JvbGxUb3AocG9zaXRpb24pO1xyXG5cdH1cclxuXHJcblx0X2JpbmRFdmVudCgpIHtcclxuXHRcdHRoaXMub24oJ3ZpZXdwb3J0LWhlaWdodC1jaGFuZ2VkJywgdmlld3BvcnRIZWlnaHQgPT4ge1xyXG5cdFx0XHR0aGlzLl91cGRhdGVCdWZmZXIoKTtcclxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMub24oJ3Njcm9sbExlZnQnLCB4ID0+IHtcclxuXHRcdFx0Ly8gcGVyZm9ybWFuY2UgVE9ET1xyXG5cdFx0XHQvLyBsZXQgbG9ja0NvbHVtbldpZHRoID0gdGhpcy5oZWFkZXIuZ2V0VmlzaWJsZUxvY2tDb2xzV2lkdGgoKTtcclxuXHRcdFx0Ly8gdGhpcy4kZG9tLmNhbnZhcy5maW5kKCcuYy1jb2x1bW4tbG9ja2VkJykuY3NzKCdsZWZ0JywgeCAtIGxvY2tDb2x1bW5XaWR0aCk7XHJcblx0XHRcdC8vIHRoaXMuJGRvbS5oZWFkZXIuZmluZCgnLmMtY29sdW1uLWxvY2tlZCcpLmNzcygnbGVmdCcsIHggLSBsb2NrQ29sdW1uV2lkdGgpO1xyXG5cdFx0XHR0aGlzLmxvY2tDb2xNYW5hZ2VyLnNldExvY2tDb2x1bW5YKHgpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5zdG9yZS5vbignZGF0YS1jaGFuZ2VkJywgKGFwcGVuZCkgPT4ge1xyXG5cdFx0XHRsZXQgdG90YWwgPSB0aGlzLnN0b3JlLnNpemUoKTtcclxuXHRcdFx0dGhpcy5fc2V0Q2FudmFzV0godG90YWwpO1xyXG5cdFx0XHR0aGlzLmJ1ZmZlck5vZGUuc2V0VG90YWwodG90YWwpO1xyXG5cdFx0XHR0aGlzLmJ1ZmZlclpvbmUuc2V0VG90YWwodG90YWwpO1xyXG5cclxuXHRcdFx0aWYgKCFhcHBlbmQgfHwgKHRvdGFsIC0gMSkgKiB0aGlzLnJvd0hlaWdodCA8IDIqdGhpcy4kZG9tLnZpZXdwb3J0Lm91dGVySGVpZ2h0KCkpIHtcclxuXHRcdFx0XHR0aGlzLl91cGRhdGVCdWZmZXIoKTtcclxuXHRcdFx0XHR0aGlzLnJlbmRlcigpO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHJcblx0fVxyXG5cclxuXHRfdXBkYXRlQnVmZmVyKCkge1xyXG5cdFx0dmFyIGxpbWl0ID0gTWF0aC5taW4oXHJcblx0XHRcdE1hdGguY2VpbCh0aGlzLiRkb20udmlld3BvcnQub3V0ZXJIZWlnaHQoKSAvIHRoaXMucm93SGVpZ2h0KSAtIDEsXHJcblx0XHRcdHRoaXMuc3RvcmUuc2l6ZSgpIC0gMSk7XHJcblxyXG5cdFx0dGhpcy5idWZmZXJab25lLnNldExpbWl0KGxpbWl0KTtcclxuXHRcdHRoaXMuYnVmZmVyTm9kZS5zZXRMaW1pdChsaW1pdCk7XHJcblx0XHR0aGlzLnNob3VsZEFkZE5vZGVzID0gdHJ1ZTtcclxuXHRcdHRoaXMuc2Nyb2xsVG9Ub3AoMCk7XHJcblxyXG5cdFx0dGhpcy4kZG9tLmNhbnZhcy5lbXB0eSgpO1xyXG5cdH1cclxuXHJcblx0X2J1ZmZlclJlbmRlcihkaXIsIFtzdGFydCwgZW5kXSkge1xyXG5cdFx0dmFyIG5vZGVzID0gdGhpcy5idWZmZXJOb2RlLmdldChkaXIsIFtzdGFydCwgZW5kXSk7XHJcblx0XHRjb25zb2xlLmxvZygn5LiA5qyh6I635Y+W6IqC54K56ZW/5bqmJywgbm9kZXMubGVuZ3RoLCBzdGFydCwgZW5kKTtcclxuXHJcblx0XHRpZiAoIXRoaXMuc2hvdWxkQWRkTm9kZXMpIHtcclxuXHRcdFx0dGhpcy5zdG9yZS5zbGljZShzdGFydCwgZW5kICsgMSkuZm9yRWFjaCgocm93TSwgaSkgPT4ge1xyXG5cdFx0XHRcdG5vZGVzW2ldLnNldERhdGEocm93TSwgcm93TS5yaWQgKiB0aGlzLnJvd0hlaWdodCk7XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0dmFyICRkb2NGcmFtZSA9ICQoJzxkaXYvPicpO1xyXG5cdFx0dGhpcy5zdG9yZS5zbGljZShzdGFydCwgZW5kICsgMSkuZm9yRWFjaCgocm93TSwgaSkgPT4ge1xyXG5cclxuXHRcdFx0bGV0IG5vZGUgPSBub2Rlc1tpXS5zZXREYXRhKHJvd00sIHJvd00ucmlkICogdGhpcy5yb3dIZWlnaHQpO1xyXG5cdFx0XHQkZG9jRnJhbWUuYXBwZW5kKG5vZGUpO1xyXG5cdFx0XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLiRkb20uY2FudmFzLmFwcGVuZCgkZG9jRnJhbWUuY2hpbGRyZW4oKSk7XHJcblx0XHR0aGlzLmxvY2tDb2xNYW5hZ2VyLmFkZEJ1ZmZlckxvY2tOb2RlKG5vZGVzKTtcclxuXHJcblx0XHRpZiAodGhpcy5idWZmZXJOb2RlLmlzRW5vdWdoKCkpIHtcclxuXHRcdFx0dGhpcy5zaG91bGRBZGROb2RlcyA9IGZhbHNlO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmVuZGVyKCkge1xyXG5cdFx0dGhpcy5fYnVmZmVyUmVuZGVyKDEsIHRoaXMuYnVmZmVyWm9uZS5kb21haW4pO1xyXG5cdH1cclxuXHJcblx0c2V0V2lkdGgobnVtKSB7XHJcblx0XHRpZiAoaXNOYU4obnVtKSkgcmV0dXJuO1xyXG5cclxuXHRcdHRoaXMuJGRvbS53cmFwcGVyLndpZHRoKG51bSk7XHJcblx0fVxyXG5cclxuXHRzZXRIZWlnaHQobnVtKSB7XHJcblx0XHRpZiAoaXNOYU4obnVtKSkgcmV0dXJuO1xyXG5cclxuXHRcdHZhciB2aWV3cG9ydEhlaWdodCA9IG51bSAtIHRoaXMuJGRvbS5oZWFkZXIub3V0ZXJIZWlnaHQoKTtcclxuXHRcdHRoaXMuJGRvbS52aWV3cG9ydC5vdXRlckhlaWdodCh2aWV3cG9ydEhlaWdodCk7XHJcblx0XHR0aGlzLmZpcmUoJ3ZpZXdwb3J0LWhlaWdodC1jaGFuZ2VkJywgdmlld3BvcnRIZWlnaHQpO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHtcclxuXHRcdHRoaXMuY29sdW1uTW9kZWwuZGVzdG9yeSgpO1xyXG5cdFx0dGhpcy5zdG9yZS5kZXN0b3J5KCk7XHJcblx0XHR0aGlzLmhlYWRlci5kZXN0b3J5KCk7XHJcblx0XHR0aGlzLiRkb20ud3JhcHBlci5yZW1vdmUoKTtcclxuXHR9XHJcbn1cclxubW9kdWxlLmV4cG9ydHMgPSBHcmlkQ29tcG9uZW50OyIsImNvbnN0ICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snalF1ZXJ5J10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWydqUXVlcnknXSA6IG51bGwpO1xyXG5jb25zdCBfID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ18nXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ18nXSA6IG51bGwpO1xyXG5jb25zdCBERCA9IHJlcXVpcmUoJy4uL3V0aWwvREQnKTtcclxuXHJcbmNvbnN0IFNPUlRfQ0xTX0FTQyA9ICdjLWNvbHVtbi1hc2MnO1xyXG5jb25zdCBTT1JUX0NMU19ERVNDID0gJ2MtY29sdW1uLWRlc2MnO1xyXG5jb25zdCBORUVETEVTU19XSURUSCA9IDEwMDA7XHJcblxyXG52YXIgY3JlYXRlQ29sdW1uRWxlbWVudCA9IGZ1bmN0aW9uKGNvbE0pIHtcclxuXHR2YXIgbG9ja0NsYXNzID0gY29sTS5sb2NrZWQgPyAnIGMtY29sdW1uLWxvY2tlZCcgOiAnJztcclxuXHJcblx0cmV0dXJuICQoJzxsaS8+JylcclxuXHRcdC5hZGRDbGFzcygnYy1oZWFkZXItY2VsbCcgKyBsb2NrQ2xhc3MpXHJcblx0XHQuYWRkQ2xhc3MoJ2MtYWxpZ24tJyArIGNvbE0uYWxpZ24pXHJcblx0XHQud2lkdGgoY29sTS53aWR0aClcclxuXHRcdC5vbignY2xpY2snLCAoKSA9PiB7IGNvbE0uc29ydCgpOyB9KVxyXG5cdFx0LmRhdGEoJ2NvbHVtbicsIGNvbE0pXHJcblx0XHQuaHRtbChjb2xNLnRleHQpO1xyXG59O1xyXG5cclxuXHJcbmNsYXNzIEhlYWRlciB7XHJcblx0Y29uc3RydWN0b3IoJGhlYWRlciwgY29sc01vZGVsKSB7XHJcblxyXG5cdFx0dGhpcy5fZHJhZ2dpbmcgPSBmYWxzZTtcclxuXHRcdHRoaXMuX3Jlc2l6aW5nID0gZmFsc2U7XHJcblxyXG5cdFx0dGhpcy4kaGVhZGVyID0gJGhlYWRlcjtcclxuXHRcdHRoaXMuY29sc01vZGVsID0gY29sc01vZGVsO1xyXG5cdFx0Ly8gdGhpcy5zdG9yZSA9IHN0b3JlO1xyXG5cdFx0dGhpcy5jb2xFbGVtZW50cyA9IG5ldyBNYXAoKTtcclxuXHJcblx0XHR0aGlzLl9jcmVhdGVDb2x1bW5FbGVtZW50cygpO1xyXG5cdFx0dGhpcy5fYmluZEV2ZW50KCk7XHJcblxyXG5cdFx0dGhpcy5yZW5kZXIoKTtcclxuXHR9XHJcblxyXG5cdF9jcmVhdGVDb2x1bW5FbGVtZW50cygpIHtcclxuXHRcdHZhciB3aWR0aCA9IE5FRURMRVNTX1dJRFRIO1xyXG5cclxuXHRcdHRoaXMuJHJvdyA9ICQoJzx1bC8+JykuYWRkQ2xhc3MoJ2MtaGVhZGVyLXJvdycpO1xyXG5cclxuXHRcdHRoaXMuY29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblx0XHRcdGxldCBjb2xFbGVtZW50ID0gY3JlYXRlQ29sdW1uRWxlbWVudChjb2xNKTtcclxuXHJcblx0XHRcdHRoaXMuY29sRWxlbWVudHMuc2V0KGNvbE0sIGNvbEVsZW1lbnQpO1xyXG5cdFx0XHR0aGlzLiRyb3cuYXBwZW5kKGNvbEVsZW1lbnQpO1xyXG5cclxuXHRcdFx0d2lkdGggKz0gY29sTS53aWR0aDtcclxuXHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLiRyb3cud2lkdGgod2lkdGgpO1xyXG5cdH1cclxuXHJcblx0Z2V0VmlzaWJsZUNvbHNXaWR0aCgpIHtcclxuXHRcdHJldHVybiB0aGlzLiRyb3cud2lkdGgoKSAtIE5FRURMRVNTX1dJRFRIO1xyXG5cdH1cclxuXHJcblx0X2JpbmRFdmVudCgpIHtcclxuXHRcdHRoaXMuX2NvbHVtblJlc2l6ZSgpO1xyXG5cdFx0dGhpcy5fY29sdW1uTW92ZSgpO1xyXG5cclxuXHRcdHRoaXMuY29sc01vZGVsLm9uKCdjb2x1bW4tYWRkJywgY29sTSA9PiB7XHJcblx0XHRcdGxldCBjb2xFbGVtZW50ID0gY3JlYXRlQ29sdW1uRWxlbWVudChjb2xNKTtcclxuXHJcblx0XHRcdHRoaXMuY29sRWxlbWVudHMuc2V0KGNvbE0sIGNvbEVsZW1lbnQpO1xyXG5cdFx0XHR0aGlzLiRyb3cuYXBwZW5kKGNvbEVsZW1lbnQpO1xyXG5cclxuXHRcdFx0bGV0IHJvd1cgPSB0aGlzLiRyb3cud2lkdGgoKTtcclxuXHRcdFx0dGhpcy4kcm93LndpZHRoKHJvd1cgKyBjb2xNLndpZHRoKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuY29sc01vZGVsLm9uKCdjb2x1bW4tbW92ZWQnLCAoY29sTSwgZm9ybUluZGV4LCB0b0luZGV4KSA9PiB7XHJcblx0XHRcdGxldCBjb2xFbGVtZW50ID0gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblx0XHRcdGNvbEVsZW1lbnQuaW5zZXJ0QWZ0ZXIodGhpcy4kcm93LmZpbmQoJ2xpLmMtaGVhZGVyLWNlbGwnKS5lcSh0b0luZGV4KSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLXRleHRlZCcsIHRleHQgPT4gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSkudGV4dCh0ZXh0KSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tcmVzaXplZCcsIHdpZHRoID0+IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pLm91dGVyV2lkdGgod2lkdGgpKTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1oaWRkZW4nLCBpc0hpZGRlbiA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cdFx0XHRcdGlmIChpc0hpZGRlbikge1xyXG5cdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKCdjLWNvbHVtbi1oaWRlJyk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcygnYy1jb2x1bW4taGlkZScpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tbG9ja2VkJywgaXNMb2NrZWQgPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHJcblx0XHRcdFx0aWYgKGlzTG9ja2VkKSB7XHJcblx0XHRcdFx0XHRjb2xFbGUuYWRkQ2xhc3MoJ2MtY29sdW1uLWxvY2tlZCcpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoJ2MtY29sdW1uLWxvY2tlZCcpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tc29ydC1jaGFuZ2VkJywgc29ydFN0YXRlID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKHNvcnRTdGF0ZSk7XHJcblx0XHRcdFx0aWYgKHNvcnRTdGF0ZSkge1xyXG5cdFx0XHRcdFx0aWYgKHNvcnRTdGF0ZSA9PT0gJ0FTQycpIHtcclxuXHRcdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKFNPUlRfQ0xTX0FTQyk7XHJcblx0XHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcyhTT1JUX0NMU19ERVNDKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcyhTT1JUX0NMU19ERVNDKTtcclxuXHRcdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKFNPUlRfQ0xTX0FTQyk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcyhTT1JUX0NMU19BU0MpLnJlbW92ZUNsYXNzKFNPUlRfQ0xTX0RFU0MpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdkZXN0b3J5JywgKCkgPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHRcdFx0XHR0aGlzLmNvbEVsZW1lbnRzLmRlbGV0ZShjb2xNKTtcdFx0XHRcclxuXHRcdFx0XHRjb2xFbGUucmVtb3ZlKCk7XHJcblxyXG5cdFx0XHRcdGxldCByb3dXID0gdGhpcy4kcm93LndpZHRoKCk7XHJcblx0XHRcdFx0dGhpcy4kcm93LndpZHRoKHJvd1cgLSBjb2xNLndpZHRoKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdF9jb2x1bW5SZXNpemUoKSB7XHJcblx0XHR0aGlzLiRyb3cub24oJ21vdXNlbW92ZScsICdsaS5jLWhlYWRlci1jZWxsJywgZnVuY3Rpb24oZXZ0KSB7XHJcblx0XHRcdHZhciBvZmZzZXRYID0gZXZ0Lm9mZnNldFg7XHJcblx0XHRcdGlmICh0aGlzLm9mZnNldFdpZHRoIC0gb2Zmc2V0WCA8PSA1IHx8IG9mZnNldFggPD0gNSkge1xyXG5cdFx0XHRcdCQodGhpcykuYWRkQ2xhc3MoJ2MtY29sLXJlc2l6YWJsZScpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdCQodGhpcykucmVtb3ZlQ2xhc3MoJ2MtY29sLXJlc2l6YWJsZScpO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHJcblx0XHRsZXQgc3RhcnRYID0gMDtcclxuXHRcdGxldCBzZWxmID0gdGhpcztcclxuXHJcblx0XHRERCh0aGlzLiRyb3csIHtcclxuXHRcdFx0J3RyaWdnZXInOiAnbGkuYy1oZWFkZXItY2VsbCcsXHJcblx0XHRcdCdyZXN0cmljdGVyJzogZnVuY3Rpb24oZXZ0KSB7XHJcblx0XHRcdFx0aWYgKHNlbGYuX2RyYWdnaW5nKSByZXR1cm4gZmFsc2U7XHJcblxyXG5cdFx0XHRcdGxldCBvZmZzZXRYID0gZXZ0Lm9mZnNldFg7XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0aWYgKHRoaXMub2Zmc2V0V2lkdGggLSBvZmZzZXRYIDw9IDUpIHtcclxuXHRcdFx0XHRcdHJldHVybiAkKHRoaXMpO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAob2Zmc2V0WCA8PSA1KSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gJCh0aGlzKS5wcmV2KCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnb25EcmFnU3RhcnQnOiBfLmRlYm91bmNlKGZ1bmN0aW9uKG9mZnNldCwgJHRhcmdldCkge1xyXG5cdFx0XHRcdGxldCBzY3JvbGxMZWZ0ID0gZG9jdW1lbnQuYm9keS5zY3JvbGxMZWZ0IHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0O1xyXG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKCR0YXJnZXQub2Zmc2V0KCkubGVmdCwgJHRhcmdldC50ZXh0KCkpO1xyXG5cdFx0XHRcdHN0YXJ0WCA9ICR0YXJnZXQub2Zmc2V0KCkubGVmdCAtIHNjcm9sbExlZnQ7XHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2cob2Zmc2V0LngsICR0YXJnZXQudGV4dCgpKTtcclxuXHRcdFx0XHRzZWxmLl9yZXNpemluZyA9IHRydWU7XHJcblx0XHRcdFx0Ly8gc3RhcnRYID0gb2Zmc2V0Lng7XHJcblx0XHRcdH0sIDgwKSxcclxuXHRcdFx0J29uRHJhZ2dpbmcnOiBmdW5jdGlvbihvZmZzZXQsICR0YXJnZXQpIHtcclxuXHJcblx0XHRcdH0sXHJcblx0XHRcdCdvbkRyYWdFbmQnOiBfLmRlYm91bmNlKGZ1bmN0aW9uKG9mZnNldCwgJHRhcmdldCkge1xyXG5cdFx0XHRcdGxldCB3aWR0aCA9IG9mZnNldC54IC0gc3RhcnRYO1xyXG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKGAkeyR0YXJnZXQudGV4dCgpfVxyXG5cdFx0XHRcdC8vIFx05Y6f5a695bqm5Li6JHskdGFyZ2V0LmRhdGEoJ2NvbHVtbicpLndpZHRofSxcclxuXHRcdFx0XHQvLyBcdOaUueWPmOS4uu+8miR7d2lkdGh9LCBbJHtvZmZzZXQueH0gLSAke3N0YXJ0WH1dYCk7XHJcblx0XHRcdFx0JHRhcmdldC5kYXRhKCdjb2x1bW4nKS5zZXRXaWR0aCh3aWR0aCk7XHJcblx0XHRcdFx0c2VsZi5fcmVzaXppbmcgPSBmYWxzZTtcclxuXHRcdFx0fSwgODApXHJcblx0XHR9KTtcclxuXHRcdFxyXG5cdH1cclxuXHJcblx0X2NvbHVtbk1vdmUoKSB7XHJcblx0XHRsZXQgc2VsZiA9IHRoaXM7XHJcblx0XHRsZXQgdG9Db2x1bW4gPSBudWxsO1xyXG5cdFx0bGV0IGZyb21Db2x1bW4gPSBudWxsO1xyXG5cdFx0bGV0ICRib2R5ID0gJCgnYm9keScpO1xyXG5cdFx0bGV0ICRtb3ZlU3RhdHVzVG9wID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtY29sLXBsYWNlaG9sZGVyIGMtdG9wJyk7XHJcblx0XHRsZXQgJG1vdmVTdGF0dXNCb3R0b20gPSAkKCc8ZGl2Lz4nKS5hZGRDbGFzcygnYy1jb2wtcGxhY2Vob2xkZXIgYy1ib3R0b20nKTtcclxuXHJcblx0XHR0aGlzLiRyb3dcclxuXHRcdFx0Lm9uKCdtb3VzZWRvd24nLCAnbGkuYy1oZWFkZXItY2VsbCcsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHRcdGxldCBvZmZzZXRYID0gZXZ0Lm9mZnNldFg7XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0aWYgKHRoaXMub2Zmc2V0V2lkdGggLSBvZmZzZXRYIDw9IDUgfHwgb2Zmc2V0WCA8PSA1KSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRzZWxmLl9kcmFnZ2luZyA9IHRydWU7XHJcblxyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSAkKHRoaXMpLmFkZENsYXNzKCdjLWNvbC1kcmFnZ2FibGUnKTtcclxuXHRcdFx0XHRmcm9tQ29sdW1uID0gJCh0aGlzKS5kYXRhKCdjb2x1bW4nKTtcclxuXHRcdFx0XHQkYm9keS5hcHBlbmQoJG1vdmVTdGF0dXNUb3ApLmFwcGVuZCgkbW92ZVN0YXR1c0JvdHRvbSk7XHJcblxyXG5cdFx0XHRcdGV2dC5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHRcdFx0XHRldnQucHJldmVudERlZmF1bHQ7XHJcblxyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fSlcclxuXHRcdFx0Lm9uKCdtb3VzZWVudGVyJywgJ2xpLmMtaGVhZGVyLWNlbGwnLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRpZiAoc2VsZi5fZHJhZ2dpbmcpIHtcclxuXHRcdFx0XHRcdGxldCAkb3ZlckNvbHVtbiA9ICQodGhpcyk7XHJcblx0XHRcdFx0XHR0b0NvbHVtbiA9ICRvdmVyQ29sdW1uLmRhdGEoJ2NvbHVtbicpO1xyXG5cclxuXHRcdFx0XHRcdGxldCB0b3AgPSAkb3ZlckNvbHVtbi5vZmZzZXQoKS50b3AgLSAxMjtcclxuXHRcdFx0XHRcdGxldCBsZWZ0ID0gJG92ZXJDb2x1bW4ub2Zmc2V0KCkubGVmdCArIHRvQ29sdW1uLndpZHRoIC0gODtcclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0JG1vdmVTdGF0dXNUb3AuY3NzKHsgdG9wOiB0b3AsIGxlZnQ6IGxlZnQgfSkuc2hvdygpO1xyXG5cdFx0XHRcdFx0JG1vdmVTdGF0dXNCb3R0b20uY3NzKHsgdG9wOiB0b3AgKyA0MCwgbGVmdDogbGVmdCB9KS5zaG93KCk7XHJcblxyXG5cdFx0XHRcdFx0ZXZ0LnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cdFx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0O1xyXG5cclxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pXHJcblx0XHRcdC5vbignbW91c2V1cCcsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHRcdHNlbGYuX2RyYWdnaW5nID0gZmFsc2U7XHJcblxyXG5cdFx0XHRcdGlmICh0b0NvbHVtbikge1xyXG5cdFx0XHRcdFx0bGV0IHRvSW5kZXggPSBzZWxmLmNvbEVsZW1lbnRzLmdldCh0b0NvbHVtbikuaW5kZXgoKTtcclxuXHRcdFx0XHRcdGxldCBmb3JtSW5kZXggPSBzZWxmLmNvbHNNb2RlbC5nZXRDb2x1bW4oKS5pbmRleE9mKGZyb21Db2x1bW4pO1xyXG5cclxuXHRcdFx0XHRcdC8vIGNvbnNvbGUubG9nKHRvSW5kZXgsIGZvcm1JbmRleCk7XHJcblxyXG5cdFx0XHRcdFx0ZnJvbUNvbHVtbi5tb3ZlVG8odG9JbmRleCk7XHJcblx0XHRcdFx0XHRzZWxmLmNvbEVsZW1lbnRzLmdldChmcm9tQ29sdW1uKS5yZW1vdmVDbGFzcygnYy1jb2wtZHJhZ2dhYmxlJyk7XHJcblxyXG5cdFx0XHRcdFx0JG1vdmVTdGF0dXNUb3AuaGlkZSgpLnJlbW92ZSgpO1xyXG5cdFx0XHRcdFx0JG1vdmVTdGF0dXNCb3R0b20uaGlkZSgpLnJlbW92ZSgpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0ZnJvbUNvbHVtbiA9IG51bGw7XHJcblx0XHRcdFx0dG9Db2x1bW4gPSBudWxsO1xyXG5cdFx0XHR9KTtcclxuXHR9XHJcblxyXG5cdHJlbmRlcigpIHtcclxuXHRcdHRoaXMuJGhlYWRlci5hcHBlbmQodGhpcy4kcm93KTtcclxuXHR9XHJcblxyXG5cdGRlc3RvcnkoKSB7XHJcblxyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBIZWFkZXI7IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuY2xhc3MgTG9ja0NvbHVtbiB7XHJcblx0Y29uc3RydWN0b3IoKSB7XHJcblx0XHR0aGlzLl9kYXRhID0gW107XHJcblx0XHR0aGlzLl9jb2x1bW5zV2lkdGggPSAwO1xyXG5cdH1cclxuXHJcblx0YWRkKGNvbE0pIHtcclxuXHRcdHRoaXMuX2RhdGEudW5zaGlmdChjb2xNKTtcclxuXHRcdHRoaXMucmVDYWxjKCk7XHJcblx0fVxyXG5cclxuXHRyZW1vdmUoZGVsQ29sTSkge1xyXG5cdFx0dGhpcy5fZGF0YSA9IHRoaXMuX2RhdGEuZmlsdGVyKGNvbE0gPT4gY29sTSAhPT0gZGVsQ29sTSk7XHJcblx0XHR0aGlzLnJlQ2FsYygpO1xyXG5cdH1cclxuXHJcblx0Y2xlYXIoKSB7XHJcblx0XHR0aGlzLl9kYXRhLmxlbmd0aCA9IDA7XHJcblx0XHR0aGlzLnJlQ2FsYygpO1xyXG5cdH1cclxuXHJcblx0Z2V0V2lkdGgoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fY29sdW1uc1dpZHRoO1xyXG5cdH1cclxuXHJcblx0cmVDYWxjKCkge1xyXG5cdFx0dGhpcy5fY29sdW1uc1dpZHRoID0gdGhpcy5fZGF0YS5yZWR1Y2UoKHdpZHRoLCBjb2xNKSA9PiB7XHJcblx0XHRcdHdpZHRoIC09IGNvbE0ud2lkdGg7XHJcblx0XHRcdGNvbE0uYXdheUZyb21MZWZ0ID0gd2lkdGg7XHJcblx0XHRcdHJldHVybiB3aWR0aDtcclxuXHRcdH0sIDApO1xyXG5cdH1cclxuXHJcblx0ZWFjaChmbikge1xyXG5cdFx0dGhpcy5fZGF0YS5mb3JFYWNoKGZuKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIOW9k+WFtuS4reS4gOWIl+WPkeeUn+WPmOWMlu+8jOmAmuefpeWFtuWug+WIl+ebuOW6lOWPmOWMllxyXG5cdCAqL1xyXG5cdCBwdWJsaXNoKGNoYW5nZWRDb2xNLCBzY3JvbGxMZWZ0KSB7XHJcblx0IFx0dGhpcy5fZGF0YS5mb3JFYWNoKGNvbE0gPT4ge1xyXG5cdCBcdFx0aWYgKGNvbE0gIT09IGNoYW5nZWRDb2xNKSB7XHJcblx0IFx0XHRcdGNvbE0uZmlyZSgnc2Nyb2xsLXgnLCBzY3JvbGxMZWZ0KTtcclxuXHQgXHRcdH1cclxuXHQgXHR9KTtcclxuXHQgfVxyXG59XHJcblxyXG52YXIgTG9ja0NvbE1hbmFnZXIgPSBmdW5jdGlvbihjb2xzTW9kZWwsIGhlYWRlciwgJGRvbSwgYnVmZmVyTm9kZSkge1xyXG5cdGxldCB2aXNpYmxlTG9ja0NvbHVtbiA9IG5ldyBMb2NrQ29sdW1uKCk7XHJcblxyXG5cdGluaXQoKTtcclxuXHRpbml0RXZlbnQoKTtcclxuXHJcblx0ZnVuY3Rpb24gaW5pdCgpIHtcclxuXHRcdGNvbHNNb2RlbFxyXG5cdFx0XHQuZ2V0TG9ja0NvbHVtbigpXHJcblx0XHRcdC5maWx0ZXIoY29sTSA9PiAhY29sTS5oaWRkZW4pXHJcblx0XHRcdC5mb3JFYWNoKGNvbE0gPT4gdmlzaWJsZUxvY2tDb2x1bW4uYWRkKGNvbE0pKTtcclxuXHJcblx0XHR1cGRhdGVCb3hTaXplKCk7XHJcblxyXG5cdFx0dmlzaWJsZUxvY2tDb2x1bW4uZWFjaChjb2xNID0+IHtcclxuXHRcdFx0bGV0IGhlYWRlckVsZW1lbnQgPSBoZWFkZXIuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cdFx0XHQvLyDorr7nva7lubborrDlvZXliJ3lp4vnmoTlt6bkvqfkvY1cclxuXHRcdFx0aGVhZGVyRWxlbWVudC5jc3MoJ2xlZnQnLCBjb2xNLmF3YXlGcm9tTGVmdCk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdzY3JvbGwteCcsIHggPT4ge1xyXG5cdFx0XHRcdGxldCBsZWZ0U3R5bGUgPSB7ICdsZWZ0JzogeCArIGNvbE0uYXdheUZyb21MZWZ0IH07XHJcblxyXG5cdFx0XHRcdGhlYWRlckVsZW1lbnQuY3NzKGxlZnRTdHlsZSk7XHJcblx0XHRcdFx0YnVmZmVyTm9kZS5nZXROb2RlTGlzdCgpLmZvckVhY2gobm9kZSA9PiBub2RlLmNoaWxkcmVuLmdldChjb2xNKS5jc3MobGVmdFN0eWxlKSk7XHRcdFx0XHRcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGluaXRFdmVudCgpIHtcclxuXHJcblx0XHRjb25zdCBjb2x1bW5Mb2NrT3JVbkxvY2sgPSAoaXNMb2NrZWQsIGNvbE0pID0+IHtcclxuXHRcdFx0bGV0IGhlYWRlckVsZW1lbnQgPSBoZWFkZXIuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0aWYgKGlzTG9ja2VkKSB7XHJcblx0XHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4uYWRkKGNvbE0pO1xyXG5cclxuXHRcdFx0XHRjb2xNLm9uKCdzY3JvbGwteCcsIHggPT4ge1xyXG5cdFx0XHRcdFx0bGV0IGxlZnRTdHlsZSA9IHsgJ2xlZnQnOiB4ICsgY29sTS5hd2F5RnJvbUxlZnQgfTtcclxuXHJcblx0XHRcdFx0XHRoZWFkZXJFbGVtZW50LmNzcyhsZWZ0U3R5bGUpO1xyXG5cdFx0XHRcdFx0YnVmZmVyTm9kZS5nZXROb2RlTGlzdCgpLmZvckVhY2gobm9kZSA9PiBub2RlLmNoaWxkcmVuLmdldChjb2xNKS5jc3MobGVmdFN0eWxlKSk7XHJcblx0XHRcdFx0fSk7XHJcblxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHZpc2libGVMb2NrQ29sdW1uLnJlbW92ZShjb2xNKTtcclxuXHJcblx0XHRcdFx0Y29sTS5vZmYoJ3Njcm9sbC14Jyk7XHJcblxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRsZXQgY3VycmVudExlZnQgPSAkZG9tLnZpZXdwb3J0LnNjcm9sbExlZnQoKSArIGNvbE0uYXdheUZyb21MZWZ0O1xyXG5cclxuXHRcdFx0Ly8g6K6+572u5bm26K6w5b2V5Yid5aeL55qE5bem5L6n5L2NXHJcblx0XHRcdGhlYWRlckVsZW1lbnQuY3NzKCdsZWZ0JywgY3VycmVudExlZnQpO1xyXG5cdFx0XHRidWZmZXJOb2RlLmdldE5vZGVMaXN0KCkuZm9yRWFjaChub2RlID0+IG5vZGUuY2hpbGRyZW4uZ2V0KGNvbE0pLmNzcygnbGVmdCcsIGN1cnJlbnRMZWZ0KSk7XHJcblxyXG5cdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5wdWJsaXNoKGNvbE0sICRkb20udmlld3BvcnQuc2Nyb2xsTGVmdCgpKTtcclxuXHRcdFx0dXBkYXRlQm94U2l6ZSgpO1xyXG5cdFx0fTtcclxuXHJcblx0XHRjb2xzTW9kZWwub24oJ2NvbHVtbi1hZGQnLCBjb2xNID0+IHtcclxuXHRcdFx0Ly8gQlVHRklYIFRPRE9cclxuXHJcblx0XHRcdC8vIC4uLlxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tbG9ja2VkJywgaXNMb2NrZWQgPT4ge1xyXG5cdFx0XHRcdGNvbHVtbkxvY2tPclVuTG9jayhpc0xvY2tlZCwgY29sTSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Y29sc01vZGVsLmdldENvbHVtbigpLmZvckVhY2goY29sTSA9PiB7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tcmVzaXplZCcsIHdpZHRoID0+IHtcclxuXHJcblx0XHRcdFx0aWYgKGNvbE0ubG9ja2VkKSB7XHJcblx0XHRcdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5yZUNhbGMoKTtcclxuXHRcdFx0XHRcdGxldCBoZWFkZXJFbGVtZW50ID0gaGVhZGVyLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHJcblx0XHRcdFx0XHRsZXQgY3VycmVudExlZnQgPSAkZG9tLnZpZXdwb3J0LnNjcm9sbExlZnQoKSArIGNvbE0uYXdheUZyb21MZWZ0O1xyXG5cclxuXHRcdFx0XHRcdGhlYWRlckVsZW1lbnQuY3NzKCdsZWZ0JywgY3VycmVudExlZnQpO1xyXG5cdFx0XHRcdFx0YnVmZmVyTm9kZS5nZXROb2RlTGlzdCgpLmZvckVhY2gobm9kZSA9PiBub2RlLmNoaWxkcmVuLmdldChjb2xNKS5jc3MoJ2xlZnQnLCBjdXJyZW50TGVmdCkpO1xyXG5cclxuXHRcdFx0XHRcdHZpc2libGVMb2NrQ29sdW1uLnB1Ymxpc2goY29sTSwgJGRvbS52aWV3cG9ydC5zY3JvbGxMZWZ0KCkpO1xyXG5cdFx0XHRcdFx0dXBkYXRlQm94U2l6ZSgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHJcblx0XHRcdH0pO1xyXG5cclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1sb2NrZWQnLCBpc0xvY2tlZCA9PiB7XHJcblx0XHRcdFx0Ly8gLi4uXHJcblx0XHRcdFx0Y29sdW1uTG9ja09yVW5Mb2NrKGlzTG9ja2VkLCBjb2xNKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHRcdFxyXG5cdFx0YnVmZmVyTm9kZS5vbignYnVmZmVyLWluaXRpYWwnLCAoKSA9PiB7XHJcblx0XHRcdC8vIGNsZWFyQnVmZmVyTG9ja05vZGUoKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdXBkYXRlQm94U2l6ZSgpIHtcclxuXHRcdHZhciB2aXNpYmxlTG9ja0NvbHNXaWR0aCA9IHZpc2libGVMb2NrQ29sdW1uLmdldFdpZHRoKCk7XHJcblx0XHRoZWFkZXIuJGhlYWRlci5jc3MoJ3BhZGRpbmctbGVmdCcsIC12aXNpYmxlTG9ja0NvbHNXaWR0aCk7XHJcblx0XHQkZG9tLmNhbnZhcy5jc3MoJ21hcmdpbi1sZWZ0JywgLXZpc2libGVMb2NrQ29sc1dpZHRoKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiB7XHJcblx0XHR2aXNpYmxlTG9ja0NvbHVtbixcclxuXHRcdHNldExvY2tDb2x1bW5YKHNjcm9sbExlZnQpIHtcclxuXHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4uZWFjaChjb2xNID0+IGNvbE0uZmlyZSgnc2Nyb2xsLXgnLCBzY3JvbGxMZWZ0KSk7XHJcblx0XHR9LFxyXG5cclxuXHRcdGFkZEJ1ZmZlckxvY2tOb2RlKHJvd05vZGVzKSB7XHJcblx0XHRcdHZpc2libGVMb2NrQ29sdW1uLmVhY2goY29sTSA9PiB7XHJcblx0XHRcdFx0cm93Tm9kZXMuZm9yRWFjaChyb3dOb2RlcyA9PiB7XHJcblx0XHRcdFx0XHRsZXQgY29sRWxlID0gaGVhZGVyLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHRcdFx0XHRcdGxldCBjZWxsRWxlbWVudCA9IHJvd05vZGVzLmNoaWxkcmVuLmdldChjb2xNKTtcclxuXHJcblx0XHRcdFx0XHRjZWxsRWxlbWVudC5jc3MoJ2xlZnQnLCAkZG9tLnZpZXdwb3J0LnNjcm9sbExlZnQoKSArIGNvbE0uYXdheUZyb21MZWZ0KTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHR9LFxyXG5cclxuXHRcdGNsZWFyQnVmZmVyTG9ja05vZGUoKSB7XHJcblx0XHRcdHZpc2libGVMb2NrQ29sdW1uLmNsZWFyKCk7XHJcblx0XHR9XHJcblxyXG5cdH07XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IExvY2tDb2xNYW5hZ2VyOyIsIi8vIFRPRE9cclxudmFyIGRlYm91bmNlID0gZnVuY3Rpb24oZm4sIHRpbWUpIHtcclxuXHR2YXIgdGltZXIgPSBudWxsO1xyXG5cdHJldHVybiBmdW5jdGlvbiguLi5hcmdzKSB7XHJcblx0XHRpZiAodGltZXIpIGNsZWFyVGltZW91dCh0aW1lcik7XHJcblxyXG5cdFx0dGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcclxuXHRcdFx0Zm4uYXBwbHkobnVsbCwgYXJncyk7XHJcblx0XHR9LCB0aW1lKTtcclxuXHR9XHJcbn1cclxuXHJcbi8v6Kej5YazcmVxdWVzdEFuaW1hdGlvbkZyYW1l5YW85a656Zeu6aKYXHJcbnZhciByYUZyYW1lID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxyXG4gICAgICAgICAgICAgIHdpbmRvdy53ZWJraXRSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcclxuICAgICAgICAgICAgICB3aW5kb3cubW96UmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XHJcbiAgICAgICAgICAgICAgd2luZG93Lm9SZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcclxuICAgICAgICAgICAgICB3aW5kb3cubXNSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcclxuICAgICAgICAgICAgICBmdW5jdGlvbihjYWxsYmFjaykge1xyXG4gICAgICAgICAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dChjYWxsYmFjaywgMTAwMCAvIDYwKTtcclxuICAgICAgICAgICAgICB9O1xyXG5cclxuLy/mn6/ph4zljJblsIHoo4VcclxudmFyIHRocm90dGxlID0gZnVuY3Rpb24oZm4pIHtcclxuICAgIGxldCBpc0xvY2tlZDtcclxuICAgIHJldHVybiBmdW5jdGlvbiguLi5hcmdzKSB7XHJcblxyXG4gICAgICAgIGlmKGlzTG9ja2VkKSByZXR1cm4gXHJcblxyXG4gICAgICAgIGlzTG9ja2VkID0gdHJ1ZTtcclxuICAgICAgICByYUZyYW1lKCgpID0+IHtcclxuICAgICAgICAgICAgaXNMb2NrZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgZm4uYXBwbHkodGhpcywgYXJncylcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufTtcclxuXHJcbmNsYXNzIFNjcm9sbGVyIHtcclxuXHRjb25zdHJ1Y3RvcihsaW5lSGVpZ2h0LCBidWZmZXJab25lKSB7XHJcblxyXG5cdFx0dGhpcy5idWZmZXJab25lID0gYnVmZmVyWm9uZTtcclxuXHRcdHRoaXMueURpciA9IDA7IC8vIDE65ZCR5LiK77yMMCwtMTrlkJHkuItcclxuXHRcdHRoaXMueVByZUluZGV4ID0gMDsgLy8g5LiK5LiA5Liq5L2N572uXHJcblx0XHR0aGlzLmxpbmVIZWlnaHQgPSBsaW5lSGVpZ2h0O1xyXG5cclxuXHRcdHRoaXMueERpciA9IDA7IC8vIDHvvJrlkJHlt6bvvIww77yMLTHvvJrlkJHlj7NcclxuXHRcdHRoaXMueFByZUluZGV4ID0gMDsgLy8g5YmN5LiA5Liq5L2N572uXHJcblxyXG5cdFx0dGhpcy5fdHJpZ2dlclggPSB4ID0+IHg7XHJcblx0XHR0aGlzLl90cmlnZ2VyWSA9IHkgPT4geTtcclxuXHJcblx0fVxyXG5cclxuXHRvblgoY2FsbGJhY2spIHtcclxuXHRcdHRoaXMuX3RyaWdnZXJYID0geCA9PiB7XHJcblx0XHRcdGlmICh4ID09PSB0aGlzLnhQcmVJbmRleCkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy54RGlyID0geCAtIHRoaXMueFByZUluZGV4O1xyXG5cdFx0XHR0aGlzLnhQcmVJbmRleCA9IHg7XHJcblxyXG5cdFx0XHRjYWxsYmFjayh4KTtcclxuXHRcdH07XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRvblkoaGFuZGxlciwgZGVsYXkpIHtcclxuXHRcdC8vIFRPRE9cclxuXHRcdC8vIHZhciBkZWFseUZuID0gZGVib3VuY2UoaGFuZGxlciwgZGVsYXkpO1xyXG5cclxuXHRcdHRoaXMuX3RyaWdnZXJZID0gZGVib3VuY2UoKHkpID0+IHtcclxuXHRcdFx0dGhpcy55RGlyID0geSAtIHRoaXMueVByZUluZGV4O1xyXG5cdFx0XHR0aGlzLnlQcmVJbmRleCA9IHk7XHJcblxyXG5cdFx0XHR2YXIgaW5kZXggPSB+fih5LyB0aGlzLmxpbmVIZWlnaHQpO1xyXG5cdFx0XHR2YXIgd2lsbExvYWQgPSB0aGlzLmJ1ZmZlclpvbmUuc2hvdWxkTG9hZCh0aGlzLnlEaXIsIGluZGV4KTtcclxuXHJcblx0XHRcdGlmICh3aWxsTG9hZCkge1xyXG5cdFx0XHRcdC8vIGRlYWx5Rm4oKTtcclxuXHRcdFx0XHRoYW5kbGVyKFxyXG5cdFx0XHRcdFx0dGhpcy55RGlyID4gMCA/IDEgOiAtMSxcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS5kb21haW4sXHJcblx0XHRcdFx0XHR0aGlzLmJ1ZmZlclpvbmUuc3RhcnQsXHJcblx0XHRcdFx0XHR0aGlzLmJ1ZmZlclpvbmUuZW5kLFxyXG5cdFx0XHRcdFx0aW5kZXgsXHJcblx0XHRcdFx0XHR0aGlzLmJ1ZmZlclpvbmUudG90YWxcclxuXHRcdFx0XHQpO1xyXG5cdFx0XHR9XHJcblx0XHR9LCBkZWxheSk7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRmaXJlWCh4KSB7XHJcblx0XHR0aGlzLl90cmlnZ2VyWCh4KTtcclxuXHR9XHJcblxyXG5cdGZpcmVZKHkpIHtcclxuXHRcdHRoaXMuX3RyaWdnZXJZKHkpO1xyXG5cdH1cclxuXHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFNjcm9sbGVyOyIsInZhciBTZWxlY3Rpb24gPSByZXF1aXJlKCcuL1NlbGVjdGlvbicpO1xyXG52YXIgTWVudSA9IHJlcXVpcmUoJy4uL3BsdWdpbi9NZW51Jyk7XHJcbnZhciAkICA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydqUXVlcnknXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ2pRdWVyeSddIDogbnVsbCk7XHJcbnZhciBKU29uVG9DU1YgPSByZXF1aXJlKCcuLi91dGlsL2V4cG90ZXIvQ1NWJyk7XHJcblxyXG5jb25zdCBkZWZIZWFkZXJDb250ZXh0TWVudSA9IFt7IFxyXG5cdFx0dGV4dDogJ+WGu+e7kycsIFxyXG5cdFx0aGFuZGxlcjogZnVuY3Rpb24oaW5mbywgY29udGV4dCwgZXZ0KSB7XHJcblx0XHRcdGluZm8uY29sdW1uLmxvY2soKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdHRleHQ6ICfop6PlhrsnLCBcclxuXHRcdGhhbmRsZXI6IGZ1bmN0aW9uKGluZm8sIGNvbnRleHQsIGV2dCkgeyBcclxuXHRcdFx0aW5mby5jb2x1bW4udW5Mb2NrKCk7XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHRzZXBhcmF0b3I6IHRydWUgXHJcblx0fSwgeyBcclxuXHRcdHRleHQ6ICfmmL7npLonLCBcclxuXHRcdGhhbmRsZXI6IGZ1bmN0aW9uKGluZm8sIGNvbnRleHQsIGV2dCkgeyBcclxuXHRcdFx0aW5mby5jb2x1bW4uc2hvdygpO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0dGV4dDogJ+makOiXjycsIFxyXG5cdFx0aGFuZGxlcjogZnVuY3Rpb24oaW5mbywgY29udGV4dCwgZXZ0KSB7IFxyXG5cdFx0XHRpbmZvLmNvbHVtbi5oaWRlKCk7XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHR0ZXh0OiAn5a6a5L2NJywgXHJcblx0XHRkaXNhYmxlZDogZmFsc2UsXHJcblx0XHRoYW5kbGVyOiBmdW5jdGlvbihpbmZvLCBjb250ZXh0LCBldnQpIHsgXHJcblx0XHRcdGxldCB2YWx1ZSwgaW5kZXg7XHJcblxyXG5cdFx0XHRpZiAodmFsdWUgPSBwcm9tcHQoJ+i+k+WFpeafpeaJvuWGheWuuScpKSB7XHJcblx0XHRcdFx0Y29udGV4dC5zdG9yZS5mb3JFYWNoKGZ1bmN0aW9uKHJvdywgaSkge1xyXG5cdFx0XHRcdFx0aWYgKFN0cmluZyhyb3dbaW5mby5kYXRhSW5kZXhdKS5pbmRleE9mKHZhbHVlKSAhPT0gLTEpIHtcclxuXHRcdFx0XHRcdFx0aW5kZXggPSBpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0pO1xyXG5cclxuXHRcdFx0XHRjb250ZXh0LnNjcm9sbFRvVG9wKGluZGV4ICogMzgpO1xyXG5cdFx0XHR9XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHR0ZXh0OiAn6YCJ5Lit5pW05YiXJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBcclxuXHRcdFx0Ly8gYWxlcnQoc2VsZi5zdG9yZS5zaXplKCkpO1xyXG5cdFx0XHRjb250ZXh0Ll9zdGFydCA9IFtpbmZvLmNvbHVtbi5jaWQsIDBdO1xyXG5cdFx0XHRjb250ZXh0Ll9lbmQgPSBbaW5mby5jb2x1bW4uY2lkLCBjb250ZXh0LnN0b3JlLnNpemUoKSAtIDFdO1xyXG5cclxuXHRcdFx0Y29udGV4dC5zZWxlY3Rpb25SYW5nZShjb250ZXh0Ll9zdGFydCwgY29udGV4dC5fZW5kKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdGNsczogJ251bWJlci1jb2x1bW4nLFxyXG5cdFx0dGV4dDogJ+e7n+iuoeaAu+aVsCcsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgXHJcblx0XHRcdGFsZXJ0KGNvbnRleHQuc3RvcmUuc2l6ZSgpKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdGNsczogJ251bWJlci1jb2x1bW4nLFxyXG5cdFx0dGV4dDogJ+axguWSjCcsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHtcclxuXHRcdFx0YWxlcnQoY29udGV4dC5zdG9yZS5zdW0oaW5mby5kYXRhSW5kZXgpKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdGNsczogJ251bWJlci1jb2x1bW4nLFxyXG5cdFx0dGV4dDogJ+W5s+WdhycsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHtcclxuXHRcdFx0YWxlcnQoY29udGV4dC5zdG9yZS5hdmcoaW5mby5kYXRhSW5kZXgpKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdGNsczogJ251bWJlci1jb2x1bW4nLFxyXG5cdFx0dGV4dDogJ+acgOWkp+WAvCcsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHtcclxuXHRcdFx0dmFyIHJldCA9IGNvbnRleHQuc3RvcmUubWF4KGluZm8uZGF0YUluZGV4KTtcclxuXHRcdFx0YWxlcnQocmV0LmRhdGFbaW5mby5kYXRhSW5kZXhdKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdGNsczogJ251bWJlci1jb2x1bW4nLFxyXG5cdFx0dGV4dDogJ+acgOWwj+WAvCcsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHtcclxuXHRcdFx0dmFyIHJldCA9IGNvbnRleHQuc3RvcmUubWluKGluZm8uZGF0YUluZGV4KTtcclxuXHRcdFx0YWxlcnQocmV0LmRhdGFbaW5mby5kYXRhSW5kZXhdKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdGNsczogJ251bWJlci1jb2x1bW4nLFxyXG5cdFx0dGV4dDogJ+aWueW3ricsIFxyXG5cdFx0ZGlzYWJsZWQ6IHRydWUsXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkge1xyXG5cdFx0XHQvLyBhbGVydChjb250ZXh0LnN0b3JlLnNpemUoKSk7XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHRjbHM6ICdudW1iZXItY29sdW1uJyxcclxuXHRcdHRleHQ6ICfmoIflh4blt64nLCBcclxuXHRcdGRpc2FibGVkOiB0cnVlLFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHtcclxuXHRcdFx0Ly8gYWxlcnQoY29udGV4dC5zdG9yZS5zaXplKCkpO1xyXG5cdFx0fSBcclxuXHR9XTtcclxuXHJcbmNvbnN0IGRlZkNlbGxDb250ZXh0TWVudSA9IFt7XHJcblx0XHR0ZXh0OiAnbG9jayByb3cgdG8gdG9wJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBjb25zb2xlLmxvZyhjb250ZXh0Ll9zZWxlY3Rpb24pOyB9IFxyXG5cdH0seyBcclxuXHRcdHRleHQ6ICdsb2NrIHJvdyB0byBib3R0b20nLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IGNvbnNvbGUubG9nKGNvbnRleHQuX3NlbGVjdGlvbik7IH0gXHJcblx0fSx7IFxyXG5cdFx0dGV4dDogJ3NlYXJjaCcsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgY29uc29sZS5sb2coY29udGV4dC5fc2VsZWN0aW9uKTsgfSBcclxuXHR9LHsgXHJcblx0XHR0ZXh0OiAnbWFyaycsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgY29uc29sZS5sb2coY29udGV4dC5fc2VsZWN0aW9uKTsgfSBcclxuXHR9XTtcdFxyXG5cclxuY29uc3QgZGVmU2VsZWN0aW9uQ29udGV4dE1lbnUgPSBbeyBcclxuXHRcdHRleHQ6ICflpI3liLYnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IFxyXG5cdFx0XHRjb25zb2xlLmxvZyhpbmZvLCBjb250ZXh0Ll9zZWxlY3Rpb24pOyBcclxuXHRcdFx0Y29udGV4dC5jb3B5U2VsZWN0aW9uKGluZm8pO1xyXG5cdFx0fSBcclxuXHR9LHsgXHJcblx0XHR0ZXh0OiAn5omT5Y2wJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBcclxuXHRcdFx0Y29uc29sZS5sb2coZXZ0LCBkYXRhLCBjb250ZXh0KTtcclxuXHRcdFx0d2luZG93LnByaW50KCk7XHJcblx0XHR9IFxyXG5cdH0seyBcclxuXHRcdHRleHQ6ICflr7zlh7onLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IFxyXG5cdFx0XHRsZXQgZGF0YSA9IGNvbnRleHQuc3RvcmUuc2xpY2UoMCwgNTApO1xyXG5cdFx0XHRjb25zb2xlLmxvZyhjb250ZXh0Ll9zZWxlY3Rpb24pOyBcclxuXHJcblx0XHRcdHRvQ1NWKGRhdGEsIGNvbnRleHQuY29sdW1uTW9kZWwpO1xyXG5cdFx0fSBcclxuXHR9LHsgXHJcblx0XHR0ZXh0OiAn5qCH6K6wJywgXHJcblx0XHRkaXNhYmxlZDogdHJ1ZSxcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IGNvbnNvbGUubG9nKGNvbnRleHQuX3NlbGVjdGlvbik7IH0gXHJcblx0fV07XHJcblxyXG5cclxuY2xhc3MgQ29udGV4dG1lbnUgZXh0ZW5kcyBTZWxlY3Rpb24ge1xyXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcclxuXHRcdHN1cGVyKG9wdGlvbnMpO1xyXG5cclxuXHRcdHRoaXMuY2VsbEN0eE1lbnUgPSBvcHRpb25zLmJpekNvbnRleHRNZW51LmNlbGw7XHJcblxyXG5cdFx0dGhpcy5oZWFkZXJDdHhNZW51ID0ge1xyXG5cdFx0XHRiZWZvcmU6IGZ1bmN0aW9uKGluZm8sIGV2dCkge1xyXG5cdFx0XHRcdGlmIChpbmZvLmNvbHVtbi52dHlwZSA9PT0gJ251bWJlcicpIHtcclxuXHRcdFx0XHRcdHRoaXMuZ2V0Q2xzKCcubnVtYmVyLWNvbHVtbicpLnNob3coKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dGhpcy5nZXRDbHMoJy5udW1iZXItY29sdW1uJykuaGlkZSgpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdH1cclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRfYmluZEV2ZW50KCkge1xyXG5cdFx0c3VwZXIuX2JpbmRFdmVudCgpO1xyXG5cclxuXHRcdGxldCBzZWxmID0gdGhpcztcclxuXHJcblx0XHR0aGlzLiRjb250ZXh0bWVudUhlYWRlciA9IG5ldyBNZW51KHRoaXMuJGRvbS53cmFwcGVyLCB7IFxyXG5cdFx0XHRkYXRhOiBkZWZIZWFkZXJDb250ZXh0TWVudSwgXHJcblx0XHRcdGNvbnRleHQ6IHRoaXMgXHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLiRjb250ZXh0bWVudSA9IG5ldyBNZW51KHRoaXMuJGRvbS5ib2R5LCB7IFxyXG5cdFx0XHRkYXRhOiBbXSwgXHJcblx0XHRcdGNvbnRleHQ6IHRoaXMgXHJcblx0XHR9KTtcclxuXHRcdFxyXG5cdFx0dGhpcy4kZG9tLndyYXBwZXJcclxuXHRcdFx0Lm9uKCdjb250ZXh0bWVudScsICcuYy1oZWFkZXItY2VsbCcsIFxyXG5cdFx0XHRcdHRoaXMuX2hlYWRlckNvbnRleHRNZW51LmJpbmQodGhpcylcclxuXHRcdFx0KTtcclxuXHJcblx0XHR0aGlzLiRkb20uYm9keVxyXG5cdFx0XHQub24oJ2NvbnRleHRtZW51JywgJy5jLWdyaWQtY2VsbCcsIFxyXG5cdFx0XHRcdHRoaXMuX2NlbGxDb250ZXh0TWVudS5iaW5kKHRoaXMsIGRlZkNlbGxDb250ZXh0TWVudSlcclxuXHRcdFx0KVxyXG5cdFx0XHQub24oJ2NvbnRleHRtZW51JywgJy5jLWNlbGwtc2VsZWN0ZWQnLCBcclxuXHRcdFx0XHR0aGlzLl9jZWxsQ29udGV4dE1lbnUuYmluZCh0aGlzLCBkZWZTZWxlY3Rpb25Db250ZXh0TWVudSlcclxuXHRcdFx0KTtcclxuXHR9XHJcblxyXG5cdF9oZWFkZXJDb250ZXh0TWVudShldnQpIHtcclxuXHRcdGxldCBjb2xNID0gJChldnQudGFyZ2V0KS5kYXRhKCdjb2x1bW4nKTtcclxuXHRcdGxldCBtZW51ID0gdGhpcy4kY29udGV4dG1lbnVIZWFkZXI7XHJcblxyXG5cdFx0bGV0IGluZm8gPSB7IFxyXG5cdFx0XHQnZGF0YUluZGV4JzogY29sTS5kYXRhSW5kZXgsIFxyXG5cdFx0XHQnY29sdW1uJzogY29sTSxcclxuXHRcdFx0J2NvbnRleHQnOiBtZW51XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5maXJlKCdoZWFkZXItY29udGV4dG1lbnUnLCBpbmZvLCBldnQpO1xyXG5cdFx0Ly8gY29uc29sZS5sb2coaW5mbyk7XHJcblxyXG5cdFx0aWYgKHRoaXMuaGVhZGVyQ3R4TWVudS5iZWZvcmUuY2FsbChtZW51LCBpbmZvLCBldnQpKSB7XHJcblx0XHRcdFxyXG5cdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcclxuXHJcblx0XHRcdG1lbnUuc2V0SW5mbyhpbmZvKTtcclxuXHRcdFx0bWVudS5zaG93QXQoZXZ0KTtcclxuXHRcdFxyXG5cdFx0XHRkb2NFdmVudChtZW51KTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdF9jZWxsQ29udGV4dE1lbnUoZGVmQ3R4TWVudSwgZXZ0KSB7XHJcblx0XHRsZXQgJGNlbGwgPSAkKGV2dC50YXJnZXQpO1xyXG5cdFx0bGV0IGRhdGFJbmRleCA9ICRjZWxsLmRhdGEoJ2RhdGFJbmRleCcpO1xyXG5cdFx0bGV0IGNvbHVtbklkID0gJGNlbGwuZGF0YSgnY2lkJyk7XHJcblx0XHRsZXQgcm93bnVtYmVyID0gKyRjZWxsLnBhcmVudCgnLmMtZ3JpZC1yb3cnKS5hdHRyKCdyaWQnKTtcclxuXHRcdGxldCBtZW51ID0gdGhpcy4kY29udGV4dG1lbnU7XHJcblxyXG5cdFx0bGV0IGluZm8gPSB7IFxyXG5cdFx0XHQndmFsdWUnOiAkY2VsbC50ZXh0KCksXHJcblx0XHRcdCdkYXRhSW5kZXgnOiBkYXRhSW5kZXgsIFxyXG5cdFx0XHQnY29sdW1uSWQnOiBjb2x1bW5JZCxcclxuXHRcdFx0J3Jvd251bWJlcic6IHJvd251bWJlcixcclxuXHRcdFx0J3Jvd0luZGV4Jzogcm93bnVtYmVyLFxyXG5cdFx0XHQnY29udGV4dCc6IG1lbnVcclxuXHRcdH07XHJcblxyXG5cdFx0dGhpcy5maXJlKCdjZWxsLWNvbnRleHRtZW51JywgaW5mbywgZXZ0KTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKGluZm8pO1xyXG5cclxuXHRcdGlmICh0aGlzLmNlbGxDdHhNZW51LmJlZm9yZS5jYWxsKG1lbnUsIGluZm8sIGV2dCkpIHtcclxuXHJcblx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0bWVudS5zZXRJbmZvKGluZm8pO1xyXG5cdFx0XHRtZW51LnVwZGF0ZShkZWZDdHhNZW51LmNvbmNhdChtZW51LmdldERhdGEoKSkpO1xyXG5cdFx0XHRcclxuXHRcdFx0bWVudS5zaG93QXQoZXZ0KTtcclxuXHRcdFxyXG5cdFx0XHRkb2NFdmVudChtZW51KTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGRlc3RvcnkoKSB7XHJcblx0XHRzdXBlci5kZXN0b3J5KCk7XHJcblxyXG5cdFx0dGhpcy4kY29udGV4dG1lbnVIZWFkZXIuZGVzdG9yeSgpO1xyXG5cdFx0dGhpcy4kY29udGV4dG1lbnUuZGVzdG9yeSgpO1xyXG5cdFx0dGhpcy5jZWxsQ3R4TWVudSA9IG51bGw7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiBkb2NFdmVudCgkY29udGV4dG1lbnUpIHtcclxuXHQkKGRvY3VtZW50KS5vbignbW91c2V1cC5jb250ZXh0bWVudScsIG9uTW91c2VEb3duLmJpbmQobnVsbCwgJGNvbnRleHRtZW51KSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uTW91c2VEb3duKCRjb250ZXh0bWVudSl7XHJcbiAgICAkY29udGV4dG1lbnUuaGlkZSgpO1xyXG4gICAgJChkb2N1bWVudCkub2ZmKCdtb3VzZXVwLmNvbnRleHRtZW51Jyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHRvQ1NWKGRhdGEsIGNvbE1vZGVsKSB7XHJcblx0Ly8g5rWL6K+VXHJcblx0SlNvblRvQ1NWLnNldERhdGFDb252ZXIoe1xyXG5cdCAgZGF0YTogZGF0YS5tYXAoZCA9PiBkLmRhdGEpLFxyXG5cdCAgZmlsZU5hbWU6ICd0ZXN0JyxcclxuXHQgIGNvbHVtbnM6IHtcclxuXHQgICAgdGl0bGU6IGNvbE1vZGVsLmdldENvbHVtbigpLm1hcChjb2xNID0+IGNvbE0udGV4dCksXHJcblx0ICAgIGtleTogY29sTW9kZWwuZ2V0Q29sdW1uKCkubWFwKGNvbE0gPT4gY29sTS5kYXRhSW5kZXgpXHJcblx0ICAgIC8vIGZvcm1hdHRlcjogZnVuY3Rpb24obiwgdikge1xyXG5cdCAgICAvLyAgIGlmKG4gPT09ICdhbW9udCcgJiYgIWlzTmFOKE51bWJlcih2KSkpIHtcclxuXHQgICAgLy8gICAgIHYgPSB2ICsgJyc7XHJcblx0ICAgIC8vICAgICB2ID0gdi5zcGxpdCgnLicpO1xyXG5cdCAgICAvLyAgICAgdlswXSA9IHZbMF0ucmVwbGFjZSgvKFxcZCkoPz0oPzpcXGR7M30pKyQpL2csICckMSwnKTtcclxuXHQgICAgLy8gICAgICByZXR1cm4gdi5qb2luKCcuJyk7XHJcblx0ICAgIC8vICAgfVxyXG5cdCAgICAvLyAgIGlmKG4gPT09ICdwcm9wb3J0aW9uJykgcmV0dXJuIHYgKyAnJSc7XHJcblx0ICAgIC8vIH1cclxuXHQgIH1cclxuXHR9KTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDb250ZXh0bWVudTsiLCJ2YXIgR3JpZFZpZXcgPSByZXF1aXJlKCcuLi9jb3JlL0dyaWRWaWV3Jyk7XHJcblxyXG5jb25zdCBDRUxMX0NMUyA9ICdsaS5jLWdyaWQtY2VsbCc7XHJcbmNvbnN0IENFTExfU0VMRUNURURfQ0xTID0gJ2MtY2VsbC1zZWxlY3RlZCc7XHJcbmNvbnN0IFJPV19DTFMgPSAnLmMtZ3JpZC1yb3cnO1xyXG5cclxuY2xhc3MgU2VsZWN0aW9uIGV4dGVuZHMgR3JpZFZpZXcge1xyXG5cclxuXHRjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcblx0XHRzdXBlcihvcHRpb25zKTtcclxuXHJcblx0XHR0aGlzLl9kZWZhdWx0cygpO1xyXG5cdH1cclxuXHJcblx0X2RlZmF1bHRzKCkge1xyXG5cdFx0dGhpcy5fbW92aW5nID0gZmFsc2U7XHJcblx0XHR0aGlzLl9zdGFydCA9IG51bGw7XHJcblx0XHR0aGlzLl9lbmQgPSBudWxsO1xyXG5cdFx0dGhpcy5fbGFzdFkgPSBudWxsO1xyXG5cclxuXHRcdHRoaXMuX3NlbGVjdGlvbiA9IFtdO1xyXG5cdFx0dGhpcy5fc2VsZWN0WSA9IFtdO1xyXG5cdFx0dGhpcy5fc2VsZWN0Q29sdW1ucyA9IFtdO1xyXG5cdH1cclxuXHJcblx0Z2V0U2VsZWN0aW9uKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuX3NlbGVjdGlvbjtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIOWkjeWItumAieahhuWGheWuuVxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBpbmZvIC17Y29sdW1uSWQsIHJvd0luZGV4fVxyXG5cdCAqL1xyXG5cdGNvcHlTZWxlY3Rpb24oaW5mbykge1xyXG5cdFx0aWYgKCF0aGlzLmlzSW5SYW5nZShpbmZvKSkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0bGV0IHZhbHVlcyA9IHRoaXMuX2NvcHlDb250ZW50KCk7XHJcblxyXG5cdFx0bGV0IHRhID0gJCgnPHRleHRhcmVhPicpLnZhbCh2YWx1ZXMpLmFwcGVuZFRvKHRoaXMuJGRvbS5ib2R5KS5mb2N1cygpO1xyXG5cdFx0dGEuZ2V0KDApLnNldFNlbGVjdGlvblJhbmdlKDAsIHZhbHVlcy5sZW5ndGgpO1xyXG5cdFx0ZG9jdW1lbnQuZXhlY0NvbW1hbmQoJ2NvcHknLCB0cnVlKTtcclxuXHRcdHRhLnJlbW92ZSgpO1xyXG5cdH1cclxuXHJcblx0aXNJblJhbmdlKGluZm8pIHtcclxuXHRcdHJldHVybiB0aGlzLl9zZWxlY3RDb2x1bW5zLmluZGV4T2YoaW5mby5jb2x1bW5JZCkgIT09IC0xXHJcblx0XHRcdCYmIGluZm8ucm93SW5kZXggPj0gdGhpcy5fc2VsZWN0WVswXVxyXG5cdFx0XHQmJiBpbmZvLnJvd0luZGV4IDw9IHRoaXMuX3NlbGVjdFlbMV1cclxuXHR9XHJcblxyXG5cdF9jb3B5Q29udGVudCgpIHtcclxuXHRcdGxldCBjb2xzID0gdGhpcy5fc2VsZWN0Q29sdW1ucy5tYXAoY2lkID0+IHtcclxuXHRcdFx0bGV0IGNvbCA9IHRoaXMuY29sdW1uTW9kZWwuZ2V0Q29sdW1uc0J5SWQoY2lkKVxyXG5cclxuXHRcdFx0aWYgKCFjb2wpIHsgdGhyb3cgYG5vdCBmaW5kIGNvbHVtbklkOiAke2NpZH0gaW4gY29sdW1uc2AgfTtcclxuXHJcblx0XHRcdHJldHVybiBjb2w7XHJcblx0XHR9KTtcclxuXHJcblx0XHRsZXQgdmFsdWVzID0gY29scy5tYXAoY29sID0+IHBpY2tUZXh0KGNvbC50ZXh0KSkuam9pbignXFx0Jyk7XHJcblxyXG5cdFx0dGhpcy5fc2VsZWN0aW9uLmZvckVhY2gocm93ID0+IHtcclxuXHRcdFx0dmFsdWVzICs9ICdcXHJcXG4nO1xyXG5cclxuXHRcdFx0cm93LmZvckVhY2goKHZhbHVlLCBpKSA9PiB7XHJcblx0XHRcdFx0dmFsdWVzICs9IHBpY2tUZXh0KGNvbHNbaV0ucmVuZGVyZXIodmFsdWUsIHsgcm93SW5kZXg6IDB9LCB7IGRhdGE6IHJvdyB9KSkgKyAnXFx0JztcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRyZXR1cm4gdmFsdWVzO1xyXG5cdH1cclxuXHRcclxuXHRfYmluZEV2ZW50KCkge1xyXG5cdFx0c3VwZXIuX2JpbmRFdmVudCgpO1xyXG5cclxuXHRcdGxldCBzZWxmID0gdGhpcztcclxuXHJcblx0XHR0aGlzLmNvbHVtbk1vZGVsLm9uKCdub3RpY2UtY29sTW9kZWwtc29ydC1jaGFuZ2VkJywgKCkgPT4ge1xyXG5cdFx0XHR0aGlzLl9kZWZhdWx0cygpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5jb2x1bW5Nb2RlbC5vbignY29sdW1uLW1vdmVkJywgKCkgPT4ge1xyXG5cdFx0XHR0aGlzLl9kZWZhdWx0cygpO1xyXG5cdFx0XHR0aGlzLiRkb20uY2FudmFzLmZpbmQoQ0VMTF9DTFMpLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuJGRvbS5jYW52YXNcclxuXHRcdFx0Lm9uKCdtb3VzZWRvd24nLCBDRUxMX0NMUywgZnVuY3Rpb24oZXZ0KSB7XHJcblx0XHRcdFx0aWYgKGV2dC5idXR0b24gPT09IDApIHtcclxuXHRcdFx0XHRcdHNlbGYuJGRvbS5jYW52YXMuZmluZChDRUxMX0NMUykucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHRcdFx0c2VsZi5fbW92aW5nID0gdHJ1ZTtcclxuXHRcdFx0XHRcdGxldCAkY2VsbCA9ICQodGhpcykuYWRkQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHRcdFx0c2VsZi5fc3RhcnQgPSBzZWxmLl9lbmQgPSBbJGNlbGwuZGF0YSgnY2lkJyksICskY2VsbC5wYXJlbnQoUk9XX0NMUykuYXR0cigncmlkJyldO1xyXG5cdFx0XHRcdFx0Ly8gY29uc29sZS5sb2coc3RhcnQpO1xyXG5cdFx0XHRcdH0gXHJcblx0XHRcdFx0ZWxzZSBpZiAoZXZ0LmJ1dHRvbiA9PT0gMikge1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KVxyXG5cdFx0XHQub24oJ21vdXNlZW50ZXInLCBDRUxMX0NMUywgZnVuY3Rpb24oZXZ0KSB7XHJcblx0XHRcdFx0aWYgKHNlbGYuX21vdmluZykge1xyXG5cdFx0XHRcdFx0bGV0ICRjZWxsID0gJCh0aGlzKTtcclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0JGNlbGwuYWRkQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHRcdFx0c2VsZi5fZW5kID0gWyRjZWxsLmRhdGEoJ2NpZCcpLCArJGNlbGwucGFyZW50KFJPV19DTFMpLmF0dHIoJ3JpZCcpXTtcclxuXHJcblx0XHRcdFx0XHRzZWxmLnNlbGVjdGlvblJhbmdlKHNlbGYuX3N0YXJ0LCBzZWxmLl9lbmQpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSlcclxuXHRcdFx0Lm9uKCdtb3VzZXVwJywgZnVuY3Rpb24oZXZ0KSB7XHJcblx0XHRcdFx0c2VsZi5fbW92aW5nID0gZmFsc2U7XHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coZW5kKTtcclxuXHRcdFx0XHRjb25zb2xlLmxvZyhzZWxmLl9zZWxlY3Rpb24pO1xyXG5cdFx0XHRcdC8vIFRPRE9cclxuXHRcdFx0XHQvLyBjb3B5KCQoJy5jZWxsLnNlbGVjdGVkJykpO1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmJ1ZmZlck5vZGUub24oJ3Jvdy11cGRhdGUtYmVmb3JlJywgKHJvd05vZGUsIHJvdykgPT4ge1xyXG5cdFx0XHQvLyBjb25zb2xlLmxvZyhyb3dOb2RlLiRub2RlLCByb3cucmlkLCB0aGlzLl9zZWxlY3RZKTtcclxuXHJcblx0XHRcdGlmICh0aGlzLl9zZWxlY3Rpb24ubGVuZ3RoID09PSAwKSByZXR1cm4gZmFsc2U7XHJcblx0XHRcdFxyXG5cdFx0XHRsZXQgaSA9IHJvdy5yaWQ7XHJcblx0XHRcdGxldCBbeTAsIHkxXSA9IHRoaXMuX3NlbGVjdFk7XHJcblx0XHRcdGxldCBjb2xzID0gdGhpcy5fc2VsZWN0Q29sdW1ucztcclxuXHJcblx0XHRcdGlmIChpID49IHkwICYmIGkgPCB5MSArIDEpIHtcclxuXHRcdFx0XHRjb2xzLmZvckVhY2goKGNvbCkgPT4ge1xyXG5cdFx0XHRcdFx0cm93Tm9kZS5jaGlsZHJlbi5mb3JFYWNoKCgkY2VsbCwgY29sTSkgPT4ge1xyXG5cdFx0XHRcdFx0XHRpZiAoY29scy5pbmRleE9mKGNvbE0uY2lkKSAhPSAtMSkge1xyXG5cdFx0XHRcdFx0XHRcdCRjZWxsLmFkZENsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHQkY2VsbC5yZW1vdmVDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHJvd05vZGUuJG5vZGUuZmluZChDRUxMX0NMUykucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0fSk7XHJcblx0XHRcclxuXHR9XHJcblxyXG5cdHNlbGVjdGlvblJhbmdlKFt4MCwgeTBdLCBbeDEsIHkxXSkge1xyXG5cclxuXHRcdGxldCB5RGlyID0geTEgLSB5MDtcclxuXHRcdGxldCBsYXN0WSA9IHRoaXMuX2xhc3RZO1xyXG5cdFx0XHRcclxuXHRcdC8vIHlSYW5nZSA9IHsgbGFzdDogLCBub3c6IFt5MCwgeTFdIH07XHJcblx0XHQvLyBbbDAsIGwxXVxyXG5cdFx0Ly8gW3kwLCB5MV1cclxuXHRcdC8vIFtsMCwgbDFdXHJcblx0XHRsZXQgcmVtb3ZlWVJhbmdlID0gW107XHJcblx0XHQvLyBkb3duXHJcblx0XHRpZiAoeURpciA+PSAwICYmIHkxIDwgbGFzdFkpIHtcclxuXHRcdFx0cmVtb3ZlWVJhbmdlID0gW3kxLCBsYXN0WV07XHJcblx0XHR9XHJcblx0XHQvLyB1cFxyXG5cdFx0aWYgKHlEaXIgPD0gMCAmJiB5MSA+IGxhc3RZKSB7XHJcblx0XHRcdHJlbW92ZVlSYW5nZSA9IFtsYXN0WSwgeTFdO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHR0aGlzLl9sYXN0WSA9IHkxO1xyXG5cdFx0Ly8gY29uc29sZS5sb2coeURpciwgcmVtb3ZlWVJhbmdlKTtcclxuXHJcblx0XHRsZXQgY29sdW1uSWRzID0gdGhpcy5nZXRMb2NrQW5kVmlzaWFibGVDb2x1bW5Bc0NpZCgpO1xyXG5cdFx0W3gwLCB5MCwgeDEsIHkxXSA9IG9yZGVyQnkoeDAsIHkwLCB4MSwgeTEsIGNvbHVtbklkcyk7XHJcblxyXG5cclxuXHRcdGxldCBjb2xzID0gdGhpcy5fc2VsZWN0Q29sdW1ucyA9IGNvbHVtbklkcy5zbGljZShjb2x1bW5JZHMuaW5kZXhPZih4MCksIGNvbHVtbklkcy5pbmRleE9mKHgxKSsxKTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKGNvbHMpO1xyXG5cclxuXHRcdHRoaXMuX3NlbGVjdFkgPSBbeTAsIHkxICsgMV07XHJcblx0XHRsZXQgcm93cyA9IHRoaXMuc3RvcmUuc2xpY2UoeTAsIHkxICsgMSk7XHJcblxyXG5cdFx0dGhpcy5fc2VsZWN0aW9uID0gcm93cy5tYXAocm93ID0+IHtcclxuXHRcdFx0cmV0dXJuIGNvbHMubWFwKGNvbCA9PiB7XHJcblx0XHRcdFx0cmV0dXJuIHJvdy5kYXRhW3RoaXMuY29sdW1uTW9kZWwuZ2V0Q29sdW1uc0J5SWQoY29sKS5kYXRhSW5kZXhdO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuX3JlUGFpbnROb2RlKHlEaXIsIHkwLCB5MSwgcmVtb3ZlWVJhbmdlLCBjb2xzKTtcclxuXHR9XHJcblxyXG5cdF9yZVBhaW50Tm9kZSh5RGlyLCB5MCwgeTEsIHJlbW92ZVlSYW5nZSwgY29scykge1xyXG5cdFx0bGV0IG5vZGVMaXN0ID0gdGhpcy5idWZmZXJOb2RlLmdldE5vZGVMaXN0KCk7XHJcblx0XHRub2RlTGlzdC5mb3JFYWNoKChyb3dOb2RlKSA9PiB7XHJcblx0XHRcdGxldCAkcm93ID0gcm93Tm9kZS4kbm9kZTtcclxuXHRcdFx0bGV0IGkgID0gKyRyb3cuYXR0cigncmlkJyk7XHJcblx0XHRcdFxyXG5cdFx0XHRpZiAoaSA+PSB5MCAmJiBpIDwgeTEgKyAxKSB7XHJcblx0XHRcdFx0Y29scy5mb3JFYWNoKChjb2wpID0+IHtcclxuXHRcdFx0XHRcdHJvd05vZGUuY2hpbGRyZW4uZm9yRWFjaCgoJGNlbGwsIGNvbE0pID0+IHtcclxuXHRcdFx0XHRcdFx0aWYgKGNvbHMuaW5kZXhPZihjb2xNLmNpZCkgIT0gLTEpIHtcclxuXHRcdFx0XHRcdFx0XHQkY2VsbC5hZGRDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0JGNlbGwucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpXHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoeURpciA+PSAwICYmIGkgPiByZW1vdmVZUmFuZ2VbMF0gJiYgaSA8PXJlbW92ZVlSYW5nZVsxXSApIHtcclxuXHRcdFx0XHQkcm93LmZpbmQoQ0VMTF9DTFMpLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoeURpciA8PSAwICYmIGkgPj0gcmVtb3ZlWVJhbmdlWzBdICYmIGkgPHJlbW92ZVlSYW5nZVsxXSApIHtcclxuXHRcdFx0XHQkcm93LmZpbmQoQ0VMTF9DTFMpLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0LypcclxuXHQgKiBsb2NrICsgdmlzaWFibGUgPSBjb2x1bW5zXHJcblx0ICogQHBhcmFtIHtBcnJheX0gY29sdW1ucyAtW2RhdGFJbmRleC4uLl1cclxuXHQgKi9cclxuXHRnZXRMb2NrQW5kVmlzaWFibGVDb2x1bW5Bc0NpZCgpIHtcclxuXHRcdGxldCBjb2xzID0gW107XHJcblxyXG5cdFx0dGhpcy5sb2NrQ29sTWFuYWdlclxyXG5cdFx0XHQudmlzaWJsZUxvY2tDb2x1bW5cclxuXHRcdFx0LmVhY2goY29sTSA9PiBjb2xzLnVuc2hpZnQoY29sTS5jaWQpKTtcclxuXHJcblx0XHRsZXQgdmlzaWFibGVDb2xzID0gdGhpcy5jb2x1bW5Nb2RlbFxyXG5cdFx0XHQuZ2V0VmlzaWJsZUNvbHVtbigpXHJcblx0XHRcdC5tYXAoY29sTSA9PiBjb2xNLmNpZClcclxuXHRcdFx0LmZpbHRlcihjaWQgPT4gY29scy5pbmRleE9mKGNpZCkgPT0gLTEpO1xyXG5cclxuXHRcdHJldHVybiBjb2xzLmNvbmNhdCh2aXNpYWJsZUNvbHMpO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHtcclxuXHRcdHN1cGVyLmRlc3RvcnkoKTtcclxuXHJcblx0XHR0aGlzLl9kZWZhdWx0cygpO1xyXG5cdH1cclxuXHJcbn1cclxuXHJcblxyXG5mdW5jdGlvbiBzd2FwKGEsIGIpIHtcclxuXHRyZXR1cm4gW2IsIGFdO1xyXG59XHJcblxyXG5mdW5jdGlvbiBvcmRlckJ5KHgwLCB5MCwgeDEsIHkxLCBjb2xJZHMpIHtcclxuXHRpZiAoY29sSWRzLmluZGV4T2YoeDApID4gY29sSWRzLmluZGV4T2YoeDEpKSB7XHJcblx0XHRbeDAsIHgxXSA9IHN3YXAoeDAsIHgxKTtcclxuXHR9XHJcblx0aWYgKHkwID4geTEpIHtcclxuXHRcdFt5MCwgeTFdID0gc3dhcCh5MCwgeTEpO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIFt4MCwgeTAsIHgxLCB5MV07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBpY2tUZXh0KGZyYWdtZW50KSB7XHJcblx0dmFyIGh0bWxTdHJpbmcgPSBuZXcgUmVnRXhwKCdcXDwuKz9cXD4nLCAnZycpO1xyXG5cdGlmIChodG1sU3RyaW5nLnRlc3QoZnJhZ21lbnQpKSB7XHJcblx0XHRyZXR1cm4gZnJhZ21lbnQucmVwbGFjZShodG1sU3RyaW5nLCAnJyk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gZnJhZ21lbnQ7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU2VsZWN0aW9uOyIsIi8vIGV4cG9ydHMuR3JpZFN0b3JlID0gcmVxdWlyZSgnLi9jb3JlL0dyaWRTdG9yZScpO1xyXG4vLyBleHBvcnRzLkdyaWRWaWV3ID0gcmVxdWlyZSgnLi9jb3JlL0dyaWRWaWV3Jyk7XHJcbi8vIG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9leHRlbmRzL1NlbGVjdGlvbicpO1xyXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vZXh0ZW5kcy9Db250ZXh0bWVudScpO1xyXG5cclxuLy8gZXhwb3J0IHsgZGVmYXVsdCB9IGZvcm0gJy4vcGx1Z2luL0NvbnRleHRtZW51JztcclxuIiwidmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snalF1ZXJ5J10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWydqUXVlcnknXSA6IG51bGwpO1xyXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuLi91dGlsL1V0aWxzJyk7XHJcblxyXG5cclxuY2xhc3MgTWVudSB7XHJcblx0Y29uc3RydWN0b3IoJHdyYXBwZXIsIHsgZGF0YSwgY29udGV4dCB9KSB7XHJcblx0XHR0aGlzLnBhcmFtcyA9IHt9O1xyXG5cdFx0dGhpcy4kbWVudSA9ICQobnVsbCk7XHJcblx0XHR0aGlzLiR3cmFwcGVyID0gJHdyYXBwZXI7XHJcblx0XHR0aGlzLl9kYXRhID0gZGF0YSB8fCBbXTtcclxuXHRcdHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XHJcblxyXG5cdFx0dGhpcy51cGRhdGUoZGF0YSk7XHJcblx0fVxyXG5cclxuXHR1cGRhdGUoZGF0YSkge1xyXG5cdFx0dGhpcy4kbWVudS5yZW1vdmUoKTsgLy8gVE9ETyDkvJjljJblpI3nlKjoioLngrlcclxuXHRcdFxyXG5cdFx0aWYgKEFycmF5LmlzQXJyYXkoZGF0YSkgJiYgZGF0YS5sZW5ndGggPiAwKSB7XHJcblx0XHRcdHRoaXMuJG1lbnUgPSBjb21waWxlTWVudShkYXRhLCB0aGlzKTtcclxuXHJcblx0XHRcdHRoaXMuJHdyYXBwZXIuYXBwZW5kKHRoaXMuJG1lbnUpO1xyXG5cclxuXHRcdFx0dGhpcy5fZGF0YSA9IGRhdGE7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aGlzLl9kYXRhID0gW107XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRtZXJnZShkYXRhKSB7XHJcblx0XHR0aGlzLl9kYXRhID0gdGhpcy5fZGF0YS5maWx0ZXIoaXRlbSA9PiB7XHJcblx0XHRcdHJldHVybiAhZGF0YS5pbmNsdWRlcyhpdGVtKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuX2RhdGEgPSBkYXRhLmNvbmNhdCh0aGlzLl9kYXRhKTtcclxuXHRcdHRoaXMudXBkYXRlKHRoaXMuX2RhdGEpO1xyXG5cdH1cclxuXHJcblx0c2V0SW5mbyhpbmZvKSB7XHJcblx0XHR0aGlzLiRpbmZvID0gaW5mbztcclxuXHR9XHJcblxyXG5cdGdldEluZm8oKSB7XHJcblx0XHRyZXR1cm4gdGhpcy4kaW5mbztcclxuXHR9XHJcblxyXG5cdGdldERhdGEoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fZGF0YTtcclxuXHR9XHJcblxyXG5cdGdldENscyhjbGFzc05hbWUpIHtcclxuXHRcdHJldHVybiB0aGlzLiRtZW51LmZpbmQoY2xhc3NOYW1lKTtcclxuXHR9XHJcblxyXG5cdHNob3dBdChldnQpIHtcclxuXHRcdGlmICghdGhpcy5fZGF0YS5sZW5ndGgpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGxldCB4ID0gZXZ0LmNsaWVudFggLSB0aGlzLiR3cmFwcGVyLm9mZnNldCgpLmxlZnQ7XHJcblx0XHRsZXQgeSA9IGV2dC5jbGllbnRZIC0gdGhpcy4kd3JhcHBlci5vZmZzZXQoKS50b3A7XHJcblxyXG5cdCAgICB0aGlzLiRtZW51XHJcblx0ICAgIFx0LmFkZENsYXNzKCdzaG93LW1lbnUnKVxyXG5cdCAgICBcdC5jc3MoeyAnbGVmdCc6IHggKyAncHgnLCAndG9wJzogeSArICdweCcgfSk7XHJcblx0fVxyXG5cclxuXHRoaWRlKCkge1xyXG5cdFx0dGhpcy4kbWVudS5yZW1vdmVDbGFzcygnc2hvdy1tZW51Jyk7XHJcblx0fVxyXG5cclxuXHRnZXREb20oKSB7XHJcblx0XHRyZXR1cm4gdGhpcy4kbWVudTtcclxuXHR9XHJcblxyXG5cdGRlc3RvcnkoKSB7XHJcblx0XHR0aGlzLiRtZW51LmVtcHR5KCk7XHJcblx0fVxyXG5cclxufVxyXG5cclxuXHJcbmNvbnN0IGVtcHR5Rm4gPSAoZXZ0KSA9PiB7IFxyXG5cdGV2dC5wcmV2ZW50RGVmYXVsdDtcclxuXHRyZXR1cm4gZmFsc2U7IFxyXG59O1xyXG5cclxuZnVuY3Rpb24gY29udmVydChpdGVtKSB7XHJcblx0bGV0IGRlZkl0ZW0gPSB7XHJcblx0XHQnaWQnOiAnY20taWQtJyArIERhdGUubm93KCksXHJcblx0XHQndGV4dCc6ICcnLFxyXG5cdFx0J2ljb25DbHMnOiAnJyxcclxuXHRcdCdoaWRkZW4nOiBmYWxzZSxcclxuXHRcdCdkaXNhYmxlZCc6IGZhbHNlLFxyXG5cdFx0J2hhbmRsZXInOiBmdW5jdGlvbigpIHt9XHJcblx0fTtcclxuXHJcblx0cmV0dXJuIE9iamVjdC5hc3NpZ24oZGVmSXRlbSwgaXRlbSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZUl0ZW0oaXRlbSwgdm0pIHtcclxuXHRsZXQgJGl0ZW0gPSAkKCc8bGkvPicpXHJcblx0XHRcdC5hdHRyKCdpZCcsIGl0ZW0uaWQpXHJcblx0XHRcdC5hZGRDbGFzcygnYy1tZW51LWl0ZW0nKVxyXG5cdFx0XHQuYWRkQ2xhc3MoaXRlbS5kaXNhYmxlZCA/ICdkaXNhYmxlZCc6ICcnKTtcclxuXHJcbiAgICBsZXQgJGJ1dHRvbiA9ICQoJzxidXR0b24vPicpLmFkZENsYXNzKCdjLW1lbnUtYnRuJylcclxuICAgIFx0XHQuYXBwZW5kKGA8aSBjbGFzcz1cImZhICR7aXRlbS5pY29uQ2xzfVwiPjwvaT5gKVxyXG4gICAgXHRcdC5hcHBlbmQoYDxzcGFuIGNsYXNzPVwiYy1tZW51LXRleHRcIj4ke2l0ZW0udGV4dH08L3NwYW4+YClcclxuICAgIFx0XHQub24oJ2NsaWNrJywgKGV2dCkgPT4ge1xyXG4gICAgXHRcdFx0aXRlbS5oYW5kbGVyLmNhbGwodm0sIHZtLmdldEluZm8oKSwgdm0uY29udGV4dCwgZXZ0KTtcclxuICAgIFx0XHR9KTtcclxuXHJcbiAgICByZXR1cm4gJGl0ZW0uYXBwZW5kKCRidXR0b24pO1xyXG59O1xyXG5cclxuZnVuY3Rpb24gY29tcGlsZU1lbnUobWVudXMsIHZtKSB7XHJcblx0aWYgKG1lbnVzICYmIG1lbnVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuICQobnVsbCk7XHJcblx0XHJcblx0bGV0ICRtZW51cyA9ICQoJzxtZW51Lz4nKS5hZGRDbGFzcygnYy1tZW51Jyk7XHJcblx0bGV0ICRtZW51U2VwYXJhdG9yID0gJCgnPGxpLz4nKS5hZGRDbGFzcygnYy1tZW51LXNlcGFyYXRvcicpO1xyXG5cdFxyXG5cdG1lbnVzLmZvckVhY2gobWVudSA9PiB7XHJcblx0XHRpZiAobWVudS5zZXBhcmF0b3IpIHtcclxuXHRcdFx0cmV0dXJuICRtZW51cy5hcHBlbmQoJG1lbnVTZXBhcmF0b3IpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGxldCAkbWVudSA9IGNyZWF0ZUl0ZW0oY29udmVydChtZW51KSwgdm0pO1xyXG5cdFx0bGV0IGNoaWxkcmVuO1xyXG5cclxuXHRcdGlmIChtZW51LmNoaWxkcmVuKSB7XHJcblx0XHRcdGNoaWxkcmVuID0gY29tcGlsZU1lbnUobWVudS5jaGlsZHJlbiwgdm0pO1xyXG5cclxuXHRcdFx0aWYgKGNoaWxkcmVuKSB7XHJcblx0XHRcdFx0JG1lbnUuYWRkQ2xhc3MoJ3N1Ym1lbnUnKS5hcHBlbmQoY2hpbGRyZW4pO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdCRtZW51cy5hcHBlbmQoJG1lbnUpO1xyXG5cdH0pO1xyXG5cclxuXHRyZXR1cm4gJG1lbnVzO1xyXG59XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBNZW51OyIsIid1c2Ugc3RyaWN0JztcclxuY29uc3QgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydqUXVlcnknXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ2pRdWVyeSddIDogbnVsbCk7XHJcblxyXG5jb25zdCBGTEVYTUlOV0lEVEggPSAzNTtcclxuXHJcbnZhciBkcmFnRHJvcCA9IGZ1bmN0aW9uKGV2dCwgb3B0cykge1xyXG5cdHZhciBkb2MgPSAkKGRvY3VtZW50KTtcclxuXHR2YXIgc2Nyb2xsTGVmdCA9IGRvY3VtZW50LmJvZHkuc2Nyb2xsTGVmdCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsTGVmdDtcclxuXHR2YXIgc2Nyb2xsVG9wID0gZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcDtcclxuXHR2YXIgbGVmdE9mZnNldCA9ICQoZXZ0LnRhcmdldCkub2Zmc2V0KCkubGVmdCAtIHNjcm9sbExlZnQ7XHJcblx0dmFyIGlYLCBpWSwgc3RhcnRYLCBlbmRYO1xyXG5cdHZhciBkcmFnZ2luZyA9IHRydWU7XHJcblxyXG5cdHN0YXJ0WCA9IGlYID0gZXZ0LmNsaWVudFggLSBzY3JvbGxMZWZ0O1xyXG5cdGlZID0gJChldnQudGFyZ2V0KS5vZmZzZXQoKS50b3AgLSBzY3JvbGxUb3A7XHJcblxyXG5cdG9wdHMub25EcmFnU3RhcnQoeyAneCc6IHN0YXJ0WCB9LCBvcHRzLiRlbGVtZW50KTtcclxuXHJcblx0ZG9jLm9uKCdtb3VzZW1vdmUuZHJhZ2Ryb3AnLCAkLnByb3h5KG1vdXNlbW92ZSwgdGhpcykpO1xyXG5cdGRvYy5vbignbW91c2V1cC5kcmFnZHJvcCcsICQucHJveHkobW91c2V1cCwgdGhpcykpO1xyXG5cdC8vICQoZXZ0LnRhcmdldClbMF0uc2V0Q2FwdHVyZSAmJiAkKGV2dC50YXJnZXQpWzBdLnNldENhcHR1cmUoKTtcclxuXHJcblx0ZnVuY3Rpb24gbW91c2Vtb3ZlKGUpIHtcclxuXHRcdGlmIChkcmFnZ2luZykge1xyXG5cdFx0XHRlbmRYID0gZS5jbGllbnRYIC0gc2Nyb2xsTGVmdDtcclxuXHJcblx0XHRcdC8vIGxpbWl0XHJcblx0XHRcdGlmIChlbmRYIC0gbGVmdE9mZnNldCA8IEZMRVhNSU5XSURUSCkge1xyXG5cdFx0XHRcdGVuZFggPSBsZWZ0T2Zmc2V0ICsgRkxFWE1JTldJRFRIO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRvcHRzLm9uRHJhZ2dpbmcoIHsgJ3gnOiBlbmRYIH0sIG9wdHMuJGVsZW1lbnQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBtb3VzZXVwKGV2dCkge1xyXG5cdFx0dmFyIGUgPSBldnQudGFyZ2V0O1xyXG5cdFx0ZHJhZ2dpbmcgPSBmYWxzZTtcclxuXHJcblx0XHRvcHRzLm9uRHJhZ0VuZCh7ICd4JzogZXZ0LmNsaWVudFggLSBzY3JvbGxMZWZ0IH0sIG9wdHMuJGVsZW1lbnQpO1xyXG5cclxuXHRcdGlmIChlICYmIGUuc2V0Q2FwdHVyZSkge1xyXG5cdFx0XHRlLnJlbGVhc2VDYXB0dXJlKCk7XHJcblx0XHR9IGVsc2UgaWYgKHdpbmRvdy5yZWxlYXNlQ2FwdHVyZSkge1xyXG5cdFx0XHR3aW5kb3cucmVsZWFzZUNhcHR1cmUoRXZlbnQuTU9VU0VNT1ZFIHwgRXZlbnQuTU9VU0VVUCk7XHJcblx0XHR9XHJcblxyXG5cdFx0ZG9jLm9mZignbW91c2Vtb3ZlLmRyYWdkcm9wJywgbW91c2Vtb3ZlKTtcclxuXHRcdGRvYy5vZmYoJ21vdXNldXAuZHJhZ2Ryb3AnLCBtb3VzZXVwKTtcclxuXHR9XHJcblxyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZGVsZWdhdGUsIG9wdGlvbnMpIHtcclxuXHR2YXIgZGVmYXVsdHMgPSB7XHJcblx0XHRyZXN0cmljdGVyKGV2dCkgeyByZXR1cm4gbnVsbDsgfSxcclxuXHRcdG9uRHJhZ1N0YXJ0KG9mZnNldCwgdGFyZ2V0KSB7fSxcclxuXHRcdG9uRHJhZ2dpbmcob2Zmc2V0LCB0YXJnZXQpIHt9LFxyXG5cdFx0b25EcmFnRW5kKG9mZnNldCwgdGFyZ2V0KSB7fVxyXG5cdH07XHJcblxyXG5cdE9iamVjdC5hc3NpZ24oZGVmYXVsdHMsIG9wdGlvbnMpO1xyXG5cclxuXHQkKGRlbGVnYXRlKS5vbignbW91c2Vkb3duJywgb3B0aW9ucy50cmlnZ2VyLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdHZhciByZXN0cmljdGVyID0gZGVmYXVsdHMucmVzdHJpY3Rlci5jYWxsKHRoaXMsIGV2dCk7XHJcblxyXG5cdFx0aWYgKHJlc3RyaWN0ZXIpIHtcclxuXHRcdFx0ZGVmYXVsdHMuJGVsZW1lbnQgPSByZXN0cmljdGVyO1xyXG5cdFx0XHRkcmFnRHJvcC5jYWxsKHRoaXMsIGV2dCwgZGVmYXVsdHMpO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG59OyIsIi8qKlxyXG4gKiDkuovku7bnrqHnkIZcclxuICogQGNsYXNzIEV2ZW50RW1pdHRlclxyXG4gKi9cclxuXHJcbmZ1bmN0aW9uIGluZGV4T2ZMaXN0ZW5lcihsaXN0ZW5lcnMsIGxpc3RlbmVyKSB7XHJcblx0dmFyIGkgPSBsaXN0ZW5lcnMubGVuZ3RoO1xyXG5cdHdoaWxlIChpLS0pIHtcclxuXHRcdGlmIChsaXN0ZW5lcnNbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSB7XHJcblx0XHRcdHJldHVybiBpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRyZXR1cm4gLTE7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGlzVmFsaWRMaXN0ZW5lcihsaXN0ZW5lcikge1xyXG5cdGlmICh0eXBlb2YgbGlzdGVuZXIgPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH0gZWxzZSBpZiAobGlzdGVuZXIgJiYgdHlwZW9mIGxpc3RlbmVyID09PSAnb2JqZWN0Jykge1xyXG5cdFx0cmV0dXJuIGlzVmFsaWRMaXN0ZW5lcihsaXN0ZW5lci5saXN0ZW5lcik7XHJcblx0fSBlbHNlIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcbn1cclxuXHJcbmNsYXNzIEV2ZW50RW1pdHRlciB7XHJcblxyXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcclxuXHJcblx0fVxyXG5cdC8qKlxyXG5cdCpcclxuXHQqXHJcblx0KlxyXG5cdCpcclxuXHQqL1xyXG5cdF9nZXRFdmVudHMoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fZXZlbnRzIHx8ICh0aGlzLl9ldmVudHMgPSB7fSk7XHJcblx0fVxyXG5cdC8qKlxyXG5cdCog6YCa6L+H5LqL5Lu25ZCN6I635Y+WbGlzdGVuZXIg5pWw57uE5oiW5Yid5aeL5YyWXHJcblx0KiDkvb/nlKjmraPliJnljLnphY3kvJrov5Tlm57kuIDkuKrlr7nlupTnmoTlr7nosaFcclxuXHQqXHJcblx0KiBcclxuXHQqIGdldExpc3RlbmVyc1xyXG5cdCogQHBhcmFtIHtTdHJpbmcgfSBSZWdFeHB9IGV2ZW50TmFtZVxyXG5cdCogQHJldHVybiB7RnVuY3RvbltdIHwgT2JqZWN0fVxyXG5cdCpcclxuXHQqL1xyXG5cdGdldExpc3RlbmVycyhuYW1lKSB7XHJcblx0XHR2YXIgZXZlbnRzID0gdGhpcy5fZ2V0RXZlbnRzKCk7XHJcblx0XHR2YXIgcmVzcG9uc2U7XHJcblx0XHR2YXIga2V5O1xyXG5cclxuXHRcdGlmIChuYW1lIGluc3RhbmNlb2YgUmVnRXhwKSB7XHJcblx0XHRcdHJlc3BvbnNlID0ge307XHJcblx0XHRcdGZvciAoa2V5IGluIGV2ZW50cykge1xyXG5cdFx0XHRcdGlmIChldmVudHMuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBuYW1lLnRlc3Qoa2V5KSkge1xyXG5cdFx0XHRcdFx0cmVzcG9uc2Vba2V5XSA9IGV2ZW50c1trZXldO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cmVzcG9uc2UgPSBldmVudHNbbmFtZV0gfHwgKGV2ZW50c1tuYW1lXSA9IFtdKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcmVzcG9uc2U7XHJcblx0fVxyXG5cdC8qKlxyXG5cdCog6YCa6L+H5LqL5Lu25ZCN6I635Y+WbGlzdGVuZXIg5aeL57uI6L+U5Zue5LiA5Liq5a+56LGhXHJcblx0KlxyXG5cdCogXHJcblx0KiBnZXRMaXN0ZW5lcnNBc09iamVjdFxyXG5cdCogQHBhcmFtIHtTdHJpbmd8UmVnRXhwfSBldmVudE5hbWVcclxuXHQqIEByZXR1cm4ge09iamVjdH1cclxuXHQqL1xyXG5cdGdldExpc3RlbmVyc0FzT2JqZWN0KG5hbWUpIHtcclxuXHRcdHZhciBsaXN0ZW5lcnMgPSB0aGlzLmdldExpc3RlbmVycyhuYW1lKTtcclxuXHRcdHZhciByZXNwb25zZTtcclxuXHJcblx0XHRpZiAobGlzdGVuZXJzIGluc3RhbmNlb2YgQXJyYXkpIHtcclxuXHRcdFx0cmVzcG9uc2UgPSB7fTtcclxuXHRcdFx0cmVzcG9uc2VbbmFtZV0gPSBsaXN0ZW5lcnM7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHJlc3BvbnNlIHx8IGxpc3RlbmVycztcclxuXHR9XHJcblx0LyoqXHJcblx0KiDojrflj5YgbGlzdGVuZXIg5YiX6KGoXHJcblx0KlxyXG5cdCogZmxhdHRlbkxpc3RlbmVyc1xyXG5cdCpcclxuXHQqIEBwYXJhbSB7IE9iamVjdFtdfSBsaXN0ZW5lcnNcclxuXHQqIEByZXR1cm4ge0Z1bmN0aW9uW119XHJcblx0Ki9cclxuXHRmbGF0dGVuTGlzdGVuZXJzKGxpc3RlbmVycykge1xyXG5cdFx0dmFyIGZsYXRMaXN0ZW5lcnMgPSBbXTtcclxuXHJcblx0XHRmb3IgKHZhciBpID0gMCwgbCA9IGxpc3RlbmVyLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG5cdFx0XHRmbGF0TGlzdGVuZXJzLnB1c2gobGlzdGVuZXJzW2ldLmxpc3RlbmVyKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmxhdExpc3RlbmVycztcclxuXHR9XHJcblx0LyoqXHJcblx0KiDkuovku7bms6jlhoxcclxuXHQqXHJcblx0KlxyXG5cdCogQGV4YW1wZWxcclxuXHQqIHZhciBlbXQgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XHJcblx0KiBlbXQuYWRkTGlzdGVuZXIoJ2Rpdjpob3ZlcicsIGZ1bmN0aW9uKCl7XHJcblx0Klx0Ly8gZG9cclxuXHQqIH0pO1xyXG5cdCogQHBhcmFtIHtzdHJpbmd9IGV2ZW50TmFtZVxyXG5cdCogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXJcclxuXHQqIEByZXR1cm4ge09iamVjdGp9XHJcblx0KlxyXG5cdCovXHJcblx0YWRkTGlzdGVuZXIobmFtZSwgbGlzdGVuZXIsIGZsYWcpIHtcclxuXHRcdGlmICghaXNWYWxpZExpc3RlbmVyKGxpc3RlbmVyKSkge1xyXG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgbGlzdGVuZXJzID0gdGhpcy5nZXRMaXN0ZW5lcnNBc09iamVjdChuYW1lKTtcclxuXHRcdHZhciBsaXN0ZW5lcklzV3JhcHBlZCA9IHR5cGVvZiBsaXN0ZW5lciA9PT0gJ29iamVjdCc7XHJcblx0XHR2YXIga2V5LCBzdGFydCwgYXJncztcclxuXHJcblx0XHRmb3IgKGtleSBpbiBsaXN0ZW5lcnMpIHtcclxuXHRcdFx0aWYgKGxpc3RlbmVycy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIGluZGV4T2ZMaXN0ZW5lcihsaXN0ZW5lcnMsIGxpc3RlbmVyKSA9PT0gLTEpIHtcclxuXHJcblx0XHRcdFx0c3RhcnQgPSBsaXN0ZW5lcnNba2V5XS5sZW5ndGg7XHJcblxyXG5cdFx0XHRcdGxpc3RlbmVyc1trZXldLnB1c2gobGlzdGVuZXJJc1dyYXBwZWQgPyBsaXN0ZW5lciA6IHtcclxuXHRcdFx0XHRcdGxpc3RlbmVyOiBsaXN0ZW5lcixcclxuXHRcdFx0XHRcdG9uY2U6IGZhbHNlXHJcblx0XHRcdFx0fSk7XHJcblxyXG5cdFx0XHRcdGlmIChmbGFnICYmIGxpc3RlbmVyc1trZXldLmFyZ3MpIHtcclxuXHRcdFx0XHRcdGxpc3RlbmVyc1trZXldLnN0YXJ0ID0gc3RhcnQ7XHJcblx0XHRcdFx0XHRhcmdzID0gbGlzdGVuZXJzW2tleV0uYXJncztcclxuXHRcdFx0XHRcdHRoaXMuZW1pdEV2ZW50KG5hbWUsIGFyZ3MpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0b24oKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5hZGRMaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHJcblx0b25lKG5hbWUsIGxpc3RlbmVyLCBmbGFnKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yZW1vdmVFdmVudChuYW1lKS5hZGRMaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICog5LqL5Lu25rOo5YaM77yM6Kem5Y+R5ZCO6Ieq5Yqo56e76ZmkXHJcblx0ICpcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWVcclxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxyXG5cdCAqIEByZXV0bnIge09iamVjdH1cclxuXHQgKlxyXG5cdCAqL1xyXG5cdGFkZE9uY2VMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lcikge1xyXG5cdFx0cmV0dXJuIHRoaXMuYWRkTGlzdGVuZXIobmFtZSwge1xyXG5cdFx0XHRsaXN0ZW5lcjogbGlzdGVuZXIsXHJcblx0XHRcdG9uY2U6IHRydWVcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0b25jZSgpIHtcclxuXHRcdHJldHVybiB0aGlzLmFkZE9uY2VMaXN0ZW5lci5hcHBseSh0aGlzLmFyZ3VtZW50cyk7XHJcblx0fVxyXG5cdC8qKlxyXG5cdCAqIOS6i+S7tumUgOavgVxyXG5cdCAqXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lXHJcblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXJcclxuXHQgKiBAcmV0dXJuIHtPYmplY3R9XHJcblx0ICpcclxuXHQgKi9cclxuXHRyZW1vdmVMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lcikge1xyXG5cdFx0dmFyIGxpc3RlbmVycyA9IHRoaXMuZ2V0TGlzdGVuZXJzQXNPYmplY3QobmFtZSk7XHJcblx0XHR2YXIgaW5kZXg7XHJcblx0XHR2YXIga2V5O1xyXG5cclxuXHRcdGZvciAoa2V5IGluIGxpc3RlbmVycykge1xyXG5cdFx0XHRpZiAobGlzdGVuZXJzLmhhc093blByb3BlcnR5KGtleSkpIHtcclxuXHRcdFx0XHRpbmRleCA9IGluZGV4T2ZMaXN0ZW5lcihsaXN0ZW5lcnNba2V5XSwgbGlzdGVuZXIpO1xyXG5cclxuXHRcdFx0XHRpZiAoaW5kZXggIT09IC0xKSB7XHJcblx0XHRcdFx0XHRsaXN0ZW5lcnNba2V5XS5zcGxpY2UoaW5kZXgsIGkpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0b2ZmKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMucmVtb3ZlTGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuXHR9XHJcblxyXG5cdG1hbmlwdWxhdGVMaXN0ZW5lcnMocmVtb3ZlLCBuYW1lLCBsaXN0ZW5lcnMpIHtcclxuXHRcdHZhciBzaW5nbGUgPSByZW1vdmUgPyB0aGlzLnJlbW92ZUxpc3RlbmVyIDogdGhpcy5hZGRMaXN0ZW5lcjtcclxuXHRcdHZhciBtdXRpcGxlID0gcmVtb3ZlID8gdGhpcy5yZW1vdmVMaXN0ZW5lcnMgOiB0aGlzLmFkZExpc3RlbmVycztcclxuXHRcdHZhciBpO1xyXG5cdFx0dmFyIHY7XHJcblxyXG5cdFx0aWYgKHR5cGVvZiBuYW1lID09PSAnb2JqZWN0JyAmJiAhKG5hbWUgaW5zdGFuY2VvZiBSZWdFeHApKSB7XHJcblx0XHRcdGZvciAoaSBpbiBuYW1lKSB7XHJcblx0XHRcdFx0aWYgKG5hbWUuaGFzT3duUHJvcGVydHkoaSkgJiYgKHYgPSBuYW1lW2ldKSkge1xyXG5cdFx0XHRcdFx0aWYgKHR5cGVvZiB2ID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHRcdFx0XHRcdHNpbmdsZS5jYWxsKHRoaXMsIGksIHYpO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0bXV0aXBsZS5jYWxsKHRoaXMsIGksIHYpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0aSA9IDA7XHJcblx0XHRcdHYgPSBsaXN0ZW5lcnMubGVuZ3RoO1xyXG5cdFx0XHR3aGlsZSAoaSA8IHYpIHtcclxuXHRcdFx0XHRzaW5nbGUuY2FsbCh0aGlzLCBuYW1lLCBsaXN0ZW5lcnNbaSsrXSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdGFkZExpc3RlbmVycyhuYW1lLCBsaXN0ZW5lcnMpIHtcclxuXHRcdHJldHVybiB0aGlzLm1hbmlwdWxhdGVMaXN0ZW5lcnMoZmFsc2UsIG5hbWUsIGxpc3RlbmVycyk7XHJcblx0fVxyXG5cclxuXHRyZW1vdmVMaXN0ZW5lcnMobmFtZSwgbGlzdGVuZXJzKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5tYW5pcHVsYXRlTGlzdGVuZXJzKHRydWUsIG5hbWUsIGxpc3RlbmVycyk7XHJcblx0fVxyXG5cclxuXHRyZW1vdmVFdmVudChuYW1lKSB7XHJcblx0XHR2YXIgZXZlbnRzID0gdGhpcy5fZ2V0RXZlbnRzKCk7XHJcblx0XHR2YXIga2V5O1xyXG5cclxuXHRcdGlmICh0eXBlb2YgbmFtZSA9PT0gJ3N0cmluZycpIHtcclxuXHRcdFx0Ly8g56e76Zmk5omA5pyJ5oyH5a6a5LqL5Lu25ZCN55qE5omA5pyJbGlzdGVuZXJzXHJcblx0XHRcdC8vIGRlbGV0ZSBldmVudHNbbmFtZV1cclxuXHRcdFx0aWYgKGV2ZW50c1tuYW1lXSBpbnN0YW5jZW9mIEFycmF5KSB7XHJcblx0XHRcdFx0ZXZlbnRzW25hbWVdLmxlbmd0aCA9IDA7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSBpZiAobmFtZSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xyXG5cdFx0XHQvLyDmraPliJnljLnphY3nmoTmiYDmnIkgbGlzdGVuZXJzXHJcblx0XHRcdGZvciAoa2V5IGluIGV2ZW50cykge1xyXG5cdFx0XHRcdGlmIChldmVudHMuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBuYW1lLnRlc3Qoa2V5KSkge1xyXG5cdFx0XHRcdFx0Ly8gZGVsZXRlIGV2ZW50c1trZXldXHJcblx0XHRcdFx0XHRpZiAoZXZlbnRzW2tleV0gaW5zdGFuY2VvZiBBcnJheSkge1xyXG5cdFx0XHRcdFx0XHRldmVudFtrZXldLmxlbmd0aCA9IDA7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQvLyDnp7vpmaTmiYDmnIkgbGlzdGVuZXJzXHJcblx0XHRcdGRlbGV0ZSB0aGlzLl9ldmVudHM7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRyZW1vdmVBbGxMaXN0ZW5lcnMoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yZW1vdmVFdmVudC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHQvKipcclxuXHQgKiDkuovku7bop6blj5FcclxuXHQgKlxyXG5cdCAqXHJcblx0ICogQGV4YW1wbGVcclxuXHQgKiB2YXIgZW10ID0gbmV3IEV2ZW50RW1pdHRlcigpO1xyXG5cdCAqIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcblx0ICogXHRlbXQuZW1pdEV2ZW50KCdkaXY6aG92ZXInLCAxKTtcclxuXHQgKiB9LCAxMDAwKTtcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWUg5LqL5Lu25ZCN56ewXHJcblx0ICogQHBhcmFtIHtBcnJheX0gW2FyZ3NdIEhUTUxEb2N1bWVudCwgaXRlbURhdGEsIC4uLlxyXG5cdCAqIEByZXR1cm4ge09iamVjdH1cclxuXHQgKlxyXG5cdCAqL1xyXG5cdGVtaXRFdmVudChuYW1lLCBhcmdzKSB7XHJcblx0XHR2YXIgbGlzdGVuZXJzTWFwID0gdGhpcy5nZXRMaXN0ZW5lcnNBc09iamVjdChuYW1lKTtcclxuXHRcdHZhciBsaXN0ZW5lcnM7XHJcblx0XHR2YXIgbGlzdGVuZXI7XHJcblx0XHR2YXIgaTtcclxuXHRcdHZhciBsO1xyXG5cdFx0dmFyIGtleTtcclxuXHRcdHZhciByZXNwb25zZTtcclxuXHJcblx0XHRmb3IgKGtleSBpbiBsaXN0ZW5lcnNNYXApIHtcclxuXHRcdFx0aWYgKGxpc3RlbmVyc01hcC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XHJcblx0XHRcdFx0bGlzdGVuZXJzID0gbGlzdGVuZXJzTWFwW2tleV0uc2xpY2UoMCk7XHJcblxyXG5cdFx0XHRcdGxpc3RlbmVyc01hcFtrZXldLmFyZ3MgPSBhcmdzO1xyXG5cclxuXHRcdFx0XHRpID0gbGlzdGVuZXJzTWFwW2tleV0uc3RhcnQgfHwgMDtcclxuXHRcdFx0XHRsaXN0ZW5lcnNNYXBba2V5XS5zdGFydCA9IDA7XHJcblxyXG5cdFx0XHRcdGZvciAobCA9IGxpc3RlbmVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuXHRcdFx0XHRcdGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldO1xyXG5cclxuXHRcdFx0XHRcdGlmIChsaXN0ZW5lci5vbmNlID09PSB0cnVlKSB7XHJcblx0XHRcdFx0XHRcdHRoaXMucmVtb3ZlTGlzdGVuZXIobmFtZSwgbGlzdGVuZXIubGlzdGVuZXIpO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHJlc3BvbnNlID0gbGlzdGVuZXIubGlzdGVuZXIuYXBwbHkodGhpcywgYXJncyB8fCBbXSk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKHJlc3BvbnNlID09PSB0aGlzLl9nZXRPbmNlUmV0dXJuVmFsdWUoKSkge1xyXG5cdFx0XHRcdFx0XHR0aGlzLnJlbW92ZUxpc3RlbmVyKG5hbWUsIGxpc3RlbmVyLmxpc3RlbmVyKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0dHJpZ2dlcigpIHtcclxuXHRcdHJldHVybiB0aGlzLmVtaXRFdmVudC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHJcblx0ZmlyZShuYW1lKSB7XHJcblx0XHR2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XHJcblx0XHRyZXR1cm4gdGhpcy5lbWl0RXZlbnQobmFtZSwgYXJncyk7XHJcblx0fVxyXG5cclxuXHRfZ2V0T25jZVJldHVyblZhbHVlKCkge1xyXG5cdFx0aWYgKHRoaXMuaGFzT3duUHJvcGVydHkoJ19vbmNlUmV0dXJuVmFsdWUnKSkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5fb25jZVJldHVyblZhbHVlO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHRzZXRPbmNlUmV0dXJuVmFsdWUodmFsdWUpIHtcclxuXHRcdHRoaXMuX29uY2VSZXR1cm5WYWx1ZSA9IHZhbHVlO1xyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRkZWZpbmVFdmVudChuYW1lKSB7XHJcblx0XHR0aGlzLmdldExpc3RlbmVycyhuYW1lKTtcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0ZGVmaW5lRXZlbnRzKG5hbWVzKSB7XHJcblx0XHRmb3IgKHZhciBpID0gMCwgbCA9IG5hbWVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG5cdFx0XHR0aGlzLmRlZmluZUV2ZW50KG5hbWVbaV0pO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XHJcblxyXG5cclxuIiwiZnVuY3Rpb24gc3dhcChhcnIsIHMxLCBzMikge1xyXG5cdHZhciB0ZW1wID0gYXJyW3MxXTtcclxuXHRhcnJbczFdID0gYXJyW3MyXTtcclxuXHRhcnJbczJdID0gdGVtcDtcclxufVxyXG5cclxuZnVuY3Rpb24gcmFuZG9tVmFsdWUoYXJyKSB7XHJcblx0dmFyIHIgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBhcnIubGVuZ3RoKTtcclxuXHQvLyBzd2FwKGFyciwgMCwgcik7XHJcblx0cmV0dXJuIFthcnJbcl0sIGFyci5maWx0ZXIoKGQsIGkpID0+IGkgIT09IHIpXTtcclxufVxyXG5cclxuZnVuY3Rpb24gZmlsdGVyTEFuZFIoYXJyLCBzZWxlY3QsIGNvbXBhcmVGbikge1xyXG5cdHZhciBsZWZ0QXJyID0gW107XHJcblx0dmFyIHJpZ2h0QXJyID0gW107XHJcblxyXG5cdGZvciAodmFyIGkgPSAwLCBsZW4gPSBhcnIubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHRcdGxldCB0ZW1wID0gYXJyW2ldO1xyXG5cdFx0bGV0IGNvbXBhcmVkID0gY29tcGFyZUZuKHNlbGVjdCwgdGVtcCk7XHJcblx0XHRpZiAoY29tcGFyZWQgPiAwKSByaWdodEFyci5wdXNoKHRlbXApO1xyXG5cdFx0ZWxzZSBpZiAoY29tcGFyZWQgPCAwKSBsZWZ0QXJyLnB1c2godGVtcCk7XHJcblx0XHRlbHNlIE1hdGgucmFuZG9tKCkgPiAwLjUgPyByaWdodEFyci5wdXNoKHRlbXApIDogbGVmdEFyci5wdXNoKHRlbXApO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIFtsZWZ0QXJyLCByaWdodEFycl07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZpbmRJbmRleChhcnIsIGluZGV4LCBjb21wYXJlRm4pIHtcclxuXHRpZiAoYXJyLmxlbmd0aCA8PSAxIHx8IGluZGV4ID09PSAwKSByZXR1cm4gYXJyWzBdO1xyXG5cdHZhciBbc2VsZWN0LCBzZWNfYXJyXSA9IHJhbmRvbVZhbHVlKGFycik7XHJcblx0dmFyIFtsZWZ0QXJyLCByaWdodEFycl0gPSBmaWx0ZXJMQW5kUihzZWNfYXJyLCBzZWxlY3QsIGNvbXBhcmVGbik7XHJcblx0dmFyIG4gPSByaWdodEFyci5sZW5ndGg7XHJcblxyXG5cdGlmIChuID09PSBpbmRleCAtIDEpIHJldHVybiBzZWxlY3Q7XHJcblx0aWYgKG4gPj0gaW5kZXgpIHJldHVybiBmaW5kSW5kZXgocmlnaHRBcnIsIGluZGV4LCBjb21wYXJlRm4pO1xyXG5cdGVsc2UgcmV0dXJuIGZpbmRJbmRleChsZWZ0QXJyLCBpbmRleCAtIG4gLSAxLCBjb21wYXJlRm4pO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZpbmRJbmRleDsiLCJ2YXIgVXRpbHMgPSB7fTtcclxuXHJcbnZhciB1aWQgPSBVdGlscy51aWQgPSAoKCkgPT4ge1xyXG5cdGxldCB0ID0gRGF0ZS5ub3coKTtcclxuXHRyZXR1cm4gKCkgPT4ge1xyXG5cdFx0cmV0dXJuICh0KyspLnRvU3RyaW5nKDE2KTtcclxuXHR9O1xyXG59KSgpO1xyXG5cclxuXHJcbnZhciBtZXJnZSA9IFV0aWxzLm1lcmdlID0gKHRhcmdldCwgYWRkaXRpb25hbCwgZGVlcCkgPT4ge1xyXG5cdGxldCBkZXB0aCA9IHR5cGVvZiBkZWVwID09ICd1bmRlZmluZWQnID8gMiA6IGRlZXAsIHByb3A7XHJcblxyXG5cdGZvciAocHJvcCBpbiBhZGRpdGlvbmFsKSB7XHJcblx0XHRpZiAoYWRkaXRpb25hbC5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xyXG5cdFx0XHRpZiAodHlwZW9mIHRhcmdldFtwcm9wXSAhPT0gJ29iamVjdCcgfHwgIWRlcHRoKSB7XHJcblx0XHRcdFx0dGFyZ2V0W3Byb3BdID0gYWRkaXRpb25hbFtwcm9wXTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRVdGlscy5tZXJnZSh0YXJnZXRbcHJvcF0sIGFkZGl0aW9uYWxbcHJvcF0sIGRlcHRoIC0gMSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiB0YXJnZXQ7XHJcbn07XHJcblxyXG52YXIgZmluZEluZGV4ID0gVXRpbHMuZmluZEluZGV4ID0gcmVxdWlyZSgnLi9GaW5kSW5kZXgnKTtcclxudmFyIGNvbXBhcmVGbiA9IFV0aWxzLmNvbXBhcmVGbiA9IHJlcXVpcmUoJy4vdXRpbHMvQ29tcGFyZXInKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gVXRpbHM7IiwibW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgLypcclxuICAgKiBvYmrmmK/kuIDkuKrlr7nosaHvvIzlhbbkuK3ljIXlkKvmnInvvJpcclxuICAgKiAjIyBkYXRhIOaYr+WvvOWHuueahOWFt+S9k+aVsOaNrlxyXG4gICAqICMjIGZpbGVOYW1lIOaYr+WvvOWHuuaXtuS/neWtmOeahOaWh+S7tuWQjeensCDmmK9zdHJpbmfmoLzlvI9cclxuICAgKiAjIyBzaG93TGFiZWwg6KGo56S65piv5ZCm5pi+56S66KGo5aS0IOm7mOiupOaYvuekuiDmmK/luIPlsJTmoLzlvI9cclxuICAgKiAjIyBjb2x1bW5zIOaYr+ihqOWktOWvueixoe+8jOS4lHRpdGxl5ZKMa2V55b+F6aG75LiA5LiA5a+55bqU77yM5YyF5ZCr5pyJXHJcbiAgICAgICAgdGl0bGU6W10sIC8vIOihqOWktOWxleekuueahOaWh+Wtl1xyXG4gICAgICAgIGtleTpbXSwgLy8g6I635Y+W5pWw5o2u55qES2V5XHJcbiAgICAgICAgZm9ybWF0dGVyOiBmdW5jdGlvbigpIC8vIOiHquWumuS5ieiuvue9ruW9k+WJjeaVsOaNrueahCDkvKDlhaUoa2V5LCB2YWx1ZSlcclxuICAgKi9cclxuICBzZXREYXRhQ29udmVyOiBmdW5jdGlvbihvYmopIHtcclxuICAgIHZhciBidyA9IHRoaXMuYnJvd3NlcigpO1xyXG4gICAgaWYoYndbJ2llJ10gPCA5KSByZXR1cm47IC8vIElFOeS7peS4i+eahFxyXG4gICAgdmFyIGRhdGEgPSBvYmpbJ2RhdGEnXSxcclxuICAgICAgICBTaG93TGFiZWwgPSB0eXBlb2Ygb2JqWydzaG93TGFiZWwnXSA9PT0gJ3VuZGVmaW5lZCcgPyB0cnVlIDogb2JqWydzaG93TGFiZWwnXSxcclxuICAgICAgICBmaWxlTmFtZSA9IChvYmpbJ2ZpbGVOYW1lJ10gfHwgJ1VzZXJFeHBvcnQnKSArICcuY3N2JyxcclxuICAgICAgICBjb2x1bW5zID0gb2JqWydjb2x1bW5zJ10gfHwge1xyXG4gICAgICAgICAgICB0aXRsZTogW10sXHJcbiAgICAgICAgICAgIGtleTogW10sXHJcbiAgICAgICAgICAgIGZvcm1hdHRlcjogdW5kZWZpbmVkXHJcbiAgICAgICAgfTtcclxuICAgIHZhciBTaG93TGFiZWwgPSB0eXBlb2YgU2hvd0xhYmVsID09PSAndW5kZWZpbmVkJyA/IHRydWUgOiBTaG93TGFiZWw7XHJcbiAgICB2YXIgcm93ID0gXCJcIiwgQ1NWID0gJycsIGtleTtcclxuICAgIC8vIOWmguaenOimgeeOsOWunuihqOWktOaWh+Wtl1xyXG4gICAgaWYgKFNob3dMYWJlbCkge1xyXG4gICAgICAgIC8vIOWmguaenOacieS8oOWFpeiHquWumuS5ieeahOihqOWktOaWh+Wtl1xyXG4gICAgICAgIGlmIChjb2x1bW5zLnRpdGxlLmxlbmd0aCkge1xyXG4gICAgICAgICAgICBjb2x1bW5zLnRpdGxlLm1hcChmdW5jdGlvbihuKSB7XHJcbiAgICAgICAgICAgICAgICByb3cgKz0gbiArICcsJztcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgLy8g5aaC5p6c5rKh5pyJ77yM5bCx55u05o6l5Y+W5pWw5o2u56ys5LiA5p2h55qE5a+56LGh55qE5bGe5oCnXHJcbiAgICAgICAgICAgIGZvciAoa2V5IGluIGRhdGFbMF0pIHJvdyArPSBrZXkgKyAnLCc7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJvdyA9IHJvdy5zbGljZSgwLCAtMSk7IC8vIOWIoOmZpOacgOWQjuS4gOS4qizlj7fvvIzljbNhLGIsID0+IGEsYlxyXG4gICAgICAgIENTViArPSByb3cgKyAnXFxyXFxuJzsgLy8g5re75Yqg5o2i6KGM56ym5Y+3XHJcbiAgICB9XHJcbiAgICAvLyDlhbfkvZPnmoTmlbDmja7lpITnkIZcclxuICAgIGRhdGEubWFwKGZ1bmN0aW9uKG4pIHtcclxuICAgICAgICByb3cgPSAnJztcclxuICAgICAgICAvLyDlpoLmnpzlrZjlnKjoh6rlrprkuYlrZXnlgLxcclxuICAgICAgICBpZiAoY29sdW1ucy5rZXkubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIGNvbHVtbnMua2V5Lm1hcChmdW5jdGlvbihtKSB7XHJcbiAgICAgICAgICAgICAgICByb3cgKz0gJ1wiJyArICh0eXBlb2YgY29sdW1ucy5mb3JtYXR0ZXIgPT09ICdmdW5jdGlvbicgPyBjb2x1bW5zLmZvcm1hdHRlcihtLCBuW21dKSB8fCBuW21dIDogblttXSkgKyAnXCIsJztcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgZm9yIChrZXkgaW4gbikge1xyXG4gICAgICAgICAgICAgICAgcm93ICs9ICdcIicgKyAodHlwZW9mIGNvbHVtbnMuZm9ybWF0dGVyID09PSAnZnVuY3Rpb24nID8gY29sdW1ucy5mb3JtYXR0ZXIoa2V5LCBuW2tleV0pIHx8IG5ba2V5XSA6IG5ba2V5XSkgKyAnXCIsJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByb3cuc2xpY2UoMCwgcm93Lmxlbmd0aCAtIDEpOyAvLyDliKDpmaTmnIDlkI7kuIDkuKosXHJcbiAgICAgICAgQ1NWICs9IHJvdyArICdcXHJcXG4nOyAvLyDmt7vliqDmjaLooYznrKblj7dcclxuICAgIH0pO1xyXG4gICAgaWYoIUNTVikgcmV0dXJuO1xyXG4gICAgdGhpcy5TYXZlQXMoZmlsZU5hbWUsIENTVik7XHJcbiAgfSxcclxuICBTYXZlQXM6IGZ1bmN0aW9uKGZpbGVOYW1lLCBjc3ZEYXRhKSB7XHJcbiAgICB2YXIgYncgPSB0aGlzLmJyb3dzZXIoKTtcclxuICAgIGlmKCFid1snZWRnZSddIHx8ICFid1snaWUnXSkge1xyXG4gICAgICB2YXIgYWxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKTtcclxuICAgICAgYWxpbmsuaWQgPSBcImxpbmtEd25sZExpbmtcIjtcclxuICAgICAgYWxpbmsuaHJlZiA9IHRoaXMuZ2V0RG93bmxvYWRVcmwoY3N2RGF0YSk7XHJcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYWxpbmspO1xyXG4gICAgICB2YXIgbGlua0RvbSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsaW5rRHdubGRMaW5rJyk7XHJcbiAgICAgIGxpbmtEb20uc2V0QXR0cmlidXRlKCdkb3dubG9hZCcsIGZpbGVOYW1lKTtcclxuICAgICAgbGlua0RvbS5jbGljaygpO1xyXG4gICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGxpbmtEb20pO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZihid1snaWUnXSA+PSAxMCB8fCBid1snZWRnZSddID09ICdlZGdlJykge1xyXG4gICAgICB2YXIgX3V0ZiA9IFwiXFx1RkVGRlwiO1xyXG4gICAgICB2YXIgX2NzdkRhdGEgPSBuZXcgQmxvYihbX3V0ZiArIGNzdkRhdGFdLCB7XHJcbiAgICAgICAgICB0eXBlOiAndGV4dC9jc3YnXHJcbiAgICAgIH0pO1xyXG4gICAgICBuYXZpZ2F0b3IubXNTYXZlQmxvYihfY3N2RGF0YSwgZmlsZU5hbWUpO1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgIHZhciBvV2luID0gd2luZG93LnRvcC5vcGVuKFwiYWJvdXQ6YmxhbmtcIiwgXCJfYmxhbmtcIik7XHJcbiAgICAgIG9XaW4uZG9jdW1lbnQud3JpdGUoJ3NlcD0sXFxyXFxuJyArIGNzdkRhdGEpO1xyXG4gICAgICBvV2luLmRvY3VtZW50LmNsb3NlKCk7XHJcbiAgICAgIG9XaW4uZG9jdW1lbnQuZXhlY0NvbW1hbmQoJ1NhdmVBcycsIHRydWUsIGZpbGVOYW1lKTtcclxuICAgICAgb1dpbi5jbG9zZSgpO1xyXG4gICAgfVxyXG4gIH0sXHJcbiAgZ2V0RG93bmxvYWRVcmw6IGZ1bmN0aW9uKGNzdkRhdGEpIHtcclxuICAgIHZhciBfdXRmID0gXCJcXHVGRUZGXCI7IC8vIOS4uuS6huS9v0V4Y2Vs5LuldXRmLTjnmoTnvJbnoIHmqKHlvI/vvIzlkIzml7bkuZ/mmK/op6PlhrPkuK3mlofkubHnoIHnmoTpl67pophcclxuICAgIGlmICh3aW5kb3cuQmxvYiAmJiB3aW5kb3cuVVJMICYmIHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKSB7XHJcbiAgICAgICAgdmFyIGNzdkRhdGEgPSBuZXcgQmxvYihbX3V0ZiArIGNzdkRhdGFdLCB7XHJcbiAgICAgICAgICAgIHR5cGU6ICd0ZXh0L2NzdidcclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gVVJMLmNyZWF0ZU9iamVjdFVSTChjc3ZEYXRhKTtcclxuICAgIH1cclxuICAgIC8vIHJldHVybiAnZGF0YTphdHRhY2htZW50L2NzdjtjaGFyc2V0PXV0Zi04LCcgKyBfdXRmICsgZW5jb2RlVVJJQ29tcG9uZW50KGNzdkRhdGEpO1xyXG4gIH0sXHJcbiAgYnJvd3NlcjogZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgU3lzID0ge307XHJcbiAgICB2YXIgdWEgPSBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCk7XHJcbiAgICB2YXIgcztcclxuICAgIChzID0gdWEuaW5kZXhPZignZWRnZScpICE9PSAtIDEgPyBTeXMuZWRnZSA9ICdlZGdlJyA6IHVhLm1hdGNoKC9ydjooW1xcZC5dKylcXCkgbGlrZSBnZWNrby8pKSA/IFN5cy5pZSA9IHNbMV06XHJcbiAgICAgICAgKHMgPSB1YS5tYXRjaCgvbXNpZSAoW1xcZC5dKykvKSkgPyBTeXMuaWUgPSBzWzFdIDpcclxuICAgICAgICAocyA9IHVhLm1hdGNoKC9maXJlZm94XFwvKFtcXGQuXSspLykpID8gU3lzLmZpcmVmb3ggPSBzWzFdIDpcclxuICAgICAgICAocyA9IHVhLm1hdGNoKC9jaHJvbWVcXC8oW1xcZC5dKykvKSkgPyBTeXMuY2hyb21lID0gc1sxXSA6XHJcbiAgICAgICAgKHMgPSB1YS5tYXRjaCgvb3BlcmEuKFtcXGQuXSspLykpID8gU3lzLm9wZXJhID0gc1sxXSA6XHJcbiAgICAgICAgKHMgPSB1YS5tYXRjaCgvdmVyc2lvblxcLyhbXFxkLl0rKS4qc2FmYXJpLykpID8gU3lzLnNhZmFyaSA9IHNbMV0gOiAwO1xyXG4gICAgcmV0dXJuIFN5cztcclxuICB9XHJcbn07IiwiLyoqXHJcbiAqIOWIm+W7uuavlOi+g+WHveaVsFxyXG4gKiBAc3VtbWFyeSDnuqbmnZ/mnaHku7bvvIzlj6rpkojlr7nlr7nosaHmlbDnu4Tnu5PmnoTnmoTmlbDmja7vvIzlpoJcclxuICogICAgICBbe1wiY29sXzFcIjogMTAsIFwiY29sXzJcIjogMzUsIFwiY29sXzNcIjogNjZ9LCAuLi5dXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqICB2YXIgc29ydHMgPSBbJ0EnLCdCJywnQycsJ0QnXTtcclxuICogIHZhciBkaXJzID0gWzEsIC0xLCAxLCAxXTtcclxuICpcclxuICogIHZhciBkYXRhMyA9IFtcclxuICogICAgICB7QToxLEI6MSxDOjUsX2lkOjF9LFxyXG4gKiAgICAgIHtBOjEsQjozLEM6NSxfaWQ6MX0sXHJcbiAqICAgICAge0E6MixCOjUsQzo0LF9pZDoyfSxcclxuICogICAgICB7QToxLEI6MSxDOjksX2lkOjF9LFxyXG4gKiAgICAgIHtBOjMsQjozLEM6MyxfaWQ6M30sXHJcbiAqICAgICAge0E6MSxCOjEsQzozLF9pZDoxfSxcclxuICogICAgICB7QTo0LEI6MixDOjIsX2lkOjR9LFxyXG4gKiAgICAgIHtBOjUsQjo0LEM6MSxfaWQ6NX0sXHJcbiAqICBdO1xyXG4gKlxyXG4gKiAgdmFyIGZuID0gY29tcGFyZUZuKHNvcnRzLCBkaXJzKTtcclxuICogIHZhciByZXQgPSBkYXRhMy5zb3J0KGZuKS5tYXAoZCA9PiBPYmplY3QudmFsdWVzKGQpKTtcclxuICogIGNvbnNvbGUuZGlyKHJldCk7XHJcbiAqXHJcbiAqIEBwYXJhbSB7QXJyYXl9IHNvcnRzIC3mjpLluo/lrZfmrrXmlbDnu4QgWydjb2xfMScsICdjb2xfMicsICdjb2xfMycsLi4uXVxyXG4gKiBAcGFyYW0ge0FycmF5fSBkaXJzIC3lr7nlupTlrZfkvZPmjpLluo/mlbDnu4TnmoTljYfpmY3luo8sMe+8muWNh+W6jyAtMe+8mumZjeW6jyBbMSwgLTFdXHJcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0g5q+U6L6D5Ye95pWwXHJcbiAqL1xyXG5leHBvcnRzLmNvbXBhcmVGbiA9IGZ1bmN0aW9uIGNvbXBhcmVGbihzb3J0cywgZGlycykge1xyXG4gICAgdmFyIGNvbmRpdGlvbnMgPSBzb3J0cy5yZWR1Y2UoKHByZSwgbmV4dCwgaSkgPT4ge1xyXG4gICAgICAgIHByZSAgPSBwcmUgPyBwcmUgKyAnIHx8JyA6ICcnO1xyXG4gICAgICAgIHJldHVybiBgJHtwcmV9IChhLiR7bmV4dH0gLSBiLiR7bmV4dH0pICogJHtkaXJzW2ldfWA7XHJcbiAgICB9LCAnJyk7XHJcblxyXG4gICAgdmFyIGZ1bmN0aW9uX2JvZHkgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICBsZXQgc29ydEluZm8gPSBzb3J0cy5qb2luKCcsJykucmVwbGFjZSgvKFxcdyspL2csICdcIiQxXCInKTtcclxuICAgICAgICByZXR1cm4gYHZhciBzb3J0ID0gWyR7c29ydEluZm99XTsgcmV0dXJuICR7Y29uZGl0aW9uc31gO1xyXG4gICAgfVxyXG4gICAgLy8gY29uc29sZS5sb2coZnVuY3Rpb25fYm9keSgpKTtcclxuICAgIFxyXG4gICAgcmV0dXJuIG5ldyBGdW5jdGlvbignYScsICdiJywgZnVuY3Rpb25fYm9keSgpKTtcclxufVxyXG5cclxuXHJcbiJdfQ==
