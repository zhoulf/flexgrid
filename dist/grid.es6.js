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
			cell.insertAfter(this.$node.find('li.c-grid-cell').eq(index));
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

		this.on('column-move-to', (colM, index) => {
			let current = this.columns.indexOf(colM);

			if (index === current) return;

			if (index > current) {
				this.columns.splice(++index, 0, this.columns[current]);
				this.columns.splice(current, 1);
			} else {
				this.columns.splice(index, 0, this.columns[current]);
				this.columns.splice(++current, 1);
			}

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

		this.colsModel.on('column-moved', (colM, index) => {
			let colElement = this.colElements.get(colM);
			colElement.insertAfter(this.$row.find('li.c-header-cell').eq(index));
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

					console.log(index, cindex);

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
		disabled: true,
		handler: function(info, context, evt) { 
			// TODO
			context.scrollToTop(Math.random() * 30000);
		} 
	}, { 
		text: '选中整列', 
		handler(info, context, evt) { 
			// alert(self.store.size());
			context._start = [info.column.dataIndex, 0];
			context._end = [info.column.dataIndex, context.store.size() - 1];

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
			alert(context.store.size());
		} 
	}, { 
		cls: 'number-column',
		text: '最大值', 
		handler(info, context, evt) {
			alert(context.store.size());
		} 
	}, { 
		cls: 'number-column',
		text: '最小值', 
		handler(info, context, evt) {
			alert(context.store.size());
		} 
	}, { 
		cls: 'number-column',
		text: '方差', 
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
		text: '复制', 
		handler(info, context, evt) { console.log(info, context._selection); } 
	},{ 
		text: '打印', 
		handler(info, context, evt) { 
			console.log(evt, data, context);
		} 
	},{ 
		text: '导出', 
		handler(info, context, evt) { console.log(context._selection); } 
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY29yZS9CdWZmZXJOb2RlLmpzIiwic3JjL2NvcmUvQnVmZmVyWm9uZS5qcyIsInNyYy9jb3JlL0NvbE1vZGVsLmpzIiwic3JjL2NvcmUvR3JpZFN0b3JlLmpzIiwic3JjL2NvcmUvR3JpZFZpZXcuanMiLCJzcmMvY29yZS9IZWFkZXIuanMiLCJzcmMvY29yZS9Mb2NrQ29sTWFuYWdlci5qcyIsInNyYy9jb3JlL1Njcm9sbGVyLmpzIiwic3JjL2V4dGVuZHMvQ29udGV4dG1lbnUuanMiLCJzcmMvZXh0ZW5kcy9TZWxlY3Rpb24uanMiLCJzcmMvaW5kZXguanMiLCJzcmMvcGx1Z2luL01lbnUuanMiLCJzcmMvdXRpbC9ERC5qcyIsInNyYy91dGlsL0V2ZW50RW1pdHRlci5qcyIsInNyYy91dGlsL0ZpbmRJbmRleC5qcyIsInNyYy91dGlsL1V0aWxzLmpzIiwic3JjL3V0aWwvc2hpbS5qcyIsInNyYy91dGlsL3V0aWxzL0NvbXBhcmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOU9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaE9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6V0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCcuLi91dGlsL0V2ZW50RW1pdHRlcicpO1xyXG52YXIgJCA9IHJlcXVpcmUoJy4uL3V0aWwvc2hpbScpLiQ7XHJcblxyXG52YXIgZGVmaW5lRGVsbCA9IGZ1bmN0aW9uKGNvbE0pIHtcclxuXHRsZXQgY2VsbCA9ICQoJzxsaS8+JylcclxuXHRcdC5hZGRDbGFzcygnYy1ncmlkLWNlbGwnKVxyXG5cdFx0LmFkZENsYXNzKCdjLWFsaWduLScgKyBjb2xNLmFsaWduKVxyXG5cdFx0LmFkZENsYXNzKCgpID0+IGNvbE0uaGlkZGVuID8gJ2MtY29sdW1uLWhpZGUnIDogJycpXHJcblx0XHQuYWRkQ2xhc3MoKCkgPT4gY29sTS5sb2NrZWQgPyAnYy1jb2x1bW4tbG9ja2VkJyA6ICcnKVxyXG5cdFx0LmF0dHIoJ3RhYmluZGV4JywgLTEpXHJcblx0XHQuZGF0YSgnZGF0YUluZGV4JywgY29sTS5kYXRhSW5kZXgpXHJcblx0XHQud2lkdGgoY29sTS53aWR0aCk7XHJcblxyXG5cdHJldHVybiBjZWxsO1xyXG59O1xyXG5cclxudmFyIGNyZWF0ZUNlbGwgPSBmdW5jdGlvbigkcm93LCBjb2xzTW9kZWwpIHtcclxuXHR2YXIgc2l6ZSA9IGNvbHNNb2RlbC5zaXplKCk7XHJcblx0dmFyIGNoaWxkcmVuID0gbmV3IE1hcCgpO1xyXG5cclxuXHRjb2xzTW9kZWwuZWFjaChjb2xNID0+IHtcclxuXHRcdGxldCBjZWxsID0gZGVmaW5lRGVsbChjb2xNKTtcclxuXHJcblx0XHQkcm93LmFwcGVuZChjZWxsKTtcclxuXHRcdGNoaWxkcmVuLnNldChjb2xNLCBjZWxsKTtcclxuXHR9KTtcclxuXHJcblx0cmV0dXJuIGNoaWxkcmVuO1xyXG59O1xyXG5cclxuY2xhc3MgUm93Tm9kZSBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblx0Y29uc3RydWN0b3IoY29sc01vZGVsLCBjb250ZXh0KSB7XHJcblx0XHRzdXBlcigpO1xyXG5cdFx0dGhpcy4kdm0gPSBjb250ZXh0O1xyXG5cdFx0dGhpcy5jb2xzTW9kZWwgPSBjb2xzTW9kZWw7XHJcblx0XHR0aGlzLiRub2RlID0gJCgnPHVsLz4nKS5hZGRDbGFzcygnYy1ncmlkLXJvdycpO1xyXG5cclxuXHRcdHRoaXMuY2hpbGRyZW4gPSBjcmVhdGVDZWxsKHRoaXMuJG5vZGUsIGNvbHNNb2RlbCk7XHJcblx0XHR0aGlzLl9iaW5kRXZlbnQoY29sc01vZGVsKTtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoY29sc01vZGVsKSB7XHJcblx0XHR0aGlzLmNvbHNNb2RlbC5vbignY29sdW1uLWFkZCcsIGNvbE0gPT4ge1xyXG5cdFx0XHRsZXQgY2VsbCA9IGRlZmluZURlbGwoY29sTSk7XHJcblxyXG5cdFx0XHR0aGlzLiRub2RlLmFwcGVuZChjZWxsKTtcclxuXHRcdFx0dGhpcy5jaGlsZHJlbi5zZXQoY29sTSwgY2VsbCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5vbignY29sdW1uLW1vdmVkJywgKGNvbE0sIGluZGV4KSA9PiB7XHJcblx0XHRcdGxldCBjZWxsID0gdGhpcy5jaGlsZHJlbi5nZXQoY29sTSk7XHJcblx0XHRcdGNlbGwuaW5zZXJ0QWZ0ZXIodGhpcy4kbm9kZS5maW5kKCdsaS5jLWdyaWQtY2VsbCcpLmVxKGluZGV4KSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRjb2xzTW9kZWwuZWFjaChjb2xNID0+IHtcclxuXHRcdFx0Y29sTS5vbignY29sdW1uLXJlc2l6ZWQnLCB3aWR0aCA9PiB7XHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2cod2lkdGgpO1xyXG5cdFx0XHRcdHRoaXMuY2hpbGRyZW4uZ2V0KGNvbE0pLm91dGVyV2lkdGgod2lkdGgpO1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1oaWRkZW4nLCBpc0hpZGRlbiA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY2hpbGRyZW4uZ2V0KGNvbE0pO1xyXG5cdFx0XHRcdGlmIChpc0hpZGRlbikge1xyXG5cdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKCdjLWNvbHVtbi1oaWRlJyk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcygnYy1jb2x1bW4taGlkZScpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tbG9ja2VkJywgaXNMb2NrZWQgPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNoaWxkcmVuLmdldChjb2xNKTtcclxuXHJcblx0XHRcdFx0aWYgKGlzTG9ja2VkKSB7XHJcblx0XHRcdFx0XHRjb2xFbGUuYWRkQ2xhc3MoJ2MtY29sdW1uLWxvY2tlZCcpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoJ2MtY29sdW1uLWxvY2tlZCcpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdkZXN0b3J5JywgKCkgPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNoaWxkcmVuLmdldChjb2xNKTtcclxuXHRcdFx0XHR0aGlzLmNoaWxkcmVuLmRlbGV0ZShjb2xNKTtcdFx0XHRcclxuXHRcdFx0XHRjb2xFbGUucmVtb3ZlKCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRzZXREYXRhKHJvdywgb2Zmc2V0VG9wKSB7XHJcblx0XHQvLyDov5nph4zlpoLmnpznlKhBT1DmlrnlvI/lrp7njrDmm7Tlpb1UT0RPXHJcblx0XHR0aGlzLiR2bS5maXJlKCdyb3ctdXBkYXRlLWJlZm9yZScsIHRoaXMsIHJvdyk7XHJcblxyXG5cdFx0dmFyIGNvbnRlbnQ7XHJcblx0XHR2YXIgY2VsbHMgPSB0aGlzLmNoaWxkcmVuO1xyXG5cclxuXHRcdHRoaXMuY29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblxyXG5cdFx0XHRjb250ZW50ID0gY29sTS5yZW5kZXJlcihyb3cuZGF0YVtjb2xNLmRhdGFJbmRleF0pO1xyXG5cdFx0XHQvLyBUT0RPIGFkZENsYXNzKCgpPT4gcm93LmNlbGxbY29sTS5kYXRhSW5kZXhdLnNlbGVjdGVkKVxyXG5cdFx0XHRjZWxscy5nZXQoY29sTSkuaHRtbChjb250ZW50KTtcclxuXHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLiRub2RlLmNzcygndG9wJywgb2Zmc2V0VG9wKS5hdHRyKCdyaWQnLCByb3cucmlkKTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcy4kbm9kZTtcclxuXHR9XHJcbn1cclxuXHJcbmNsYXNzIEJ1ZmZlck5vZGUgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cdGNvbnN0cnVjdG9yKGxpbWl0LCBjb2xzTW9kZWwsIHRvdGFsLCBjYWNoZVRpbWVzKSB7XHJcblx0XHRzdXBlcigpO1xyXG5cdFx0dGhpcy5pbml0KGxpbWl0LCBjb2xzTW9kZWwsIHRvdGFsLCBjYWNoZVRpbWVzKTtcclxuXHR9XHJcblxyXG5cdGluaXQobGltaXQsIGNvbHNNb2RlbCwgdG90YWwsIGNhY2hlVGltZXMpIHtcclxuXHRcdHRoaXMubGltaXQgPSBsaW1pdDtcclxuXHRcdHRoaXMudG90YWwgPSB0b3RhbDtcclxuXHRcdHRoaXMuY2FjaGVUaW1lcyA9IGNhY2hlVGltZXMgfHwgMztcclxuXHRcdHRoaXMubm9kZUxpc3QgPSBbXTtcclxuXHRcdHRoaXMuY29sc01vZGVsID0gY29sc01vZGVsO1xyXG5cclxuXHRcdC8vIOi/memHjOaaguS4ulNlbGVjdGlvbuWunueOsO+8jOW6lOivpeeUqEFPUOe7tOaKpCBUT0RPXHJcblx0XHQvLyB0aGlzLm9uKCdyb3ctdXBkYXRlLWJlZm9yZScsIChyb3dOb2RlLCByb3cpID0+IHRoaXMuZmlyZSgncm93LXVwZGF0ZScsIHJvd05vZGUsIHJvdykpO1xyXG5cdH1cclxuXHJcblx0Z2V0Tm9kZUxpc3QoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5ub2RlTGlzdDtcclxuXHR9XHJcblxyXG5cdHNldExpbWl0KGxpbWl0KSB7XHJcblx0XHRpZiAoK2xpbWl0ID4gMCkge1xyXG5cdFx0XHR0aGlzLmluaXQobGltaXQsIHRoaXMuY29sc01vZGVsLCB0aGlzLnRvdGFsLCB0aGlzLmNhY2hlVGltZXMpO1xyXG5cdFx0XHR0aGlzLmZpcmUoJ2J1ZmZlci1pbml0aWFsJyk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRzZXRUb3RhbCh0b3RhbCkge1xyXG5cdFx0aWYgKCt0b3RhbCA+PSAwKSB7XHJcblx0XHRcdHRoaXMudG90YWwgPSB0b3RhbDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlzRW5vdWdoKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMubm9kZUxpc3QubGVuZ3RoID49IE1hdGgubWluKHRoaXMudG90YWwsIHRoaXMuY2FjaGVUaW1lcyAqIHRoaXMubGltaXQpO1xyXG5cdH1cclxuXHJcblx0Z2V0KGRpciwgZG9tYWluKSB7XHJcblx0XHRpZiAodGhpcy5pc0Vub3VnaCgpKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLl9nZXROb2RlcyhkaXIsIGRvbWFpbik7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuX2FkZE5vZGVzKGRpciwgZG9tYWluKTtcclxuXHR9XHJcblxyXG5cdF9nZXROb2RlcyhkaXIsIFtzdGFydCwgZW5kXSkge1xyXG5cdFx0dmFyIHNlbGVjdGVkO1xyXG5cclxuXHRcdGlmIChkaXIgPiAwKSB7XHJcblx0XHRcdHNlbGVjdGVkID0gdGhpcy5ub2RlTGlzdC5zbGljZSgwLCBlbmQgLSBzdGFydCArIDEpO1xyXG5cdFx0XHR0aGlzLm5vZGVMaXN0ID0gdGhpcy5ub2RlTGlzdC5zbGljZShlbmQgLSBzdGFydCArIDEpLmNvbmNhdChzZWxlY3RlZCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRzZWxlY3RlZCA9IHRoaXMubm9kZUxpc3Quc2xpY2Uoc3RhcnQgLSBlbmQgLSAxKTtcclxuXHRcdFx0dGhpcy5ub2RlTGlzdCA9IHNlbGVjdGVkLmNvbmNhdCh0aGlzLm5vZGVMaXN0LnNsaWNlKDAsIHN0YXJ0IC0gZW5kIC0gMSkpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBzZWxlY3RlZCB8fCBbXTtcclxuXHR9XHJcblxyXG5cdF9hZGROb2RlcyhkaXIsIFtzdGFydCwgZW5kXSkge1xyXG5cdFx0dmFyIG5vZGVzID0gW107XHJcblxyXG5cdFx0Zm9yICh2YXIgaSA9IHN0YXJ0OyBpIDw9IGVuZDsgaSsrKSB7XHJcblx0XHRcdG5vZGVzLnB1c2gobmV3IFJvd05vZGUodGhpcy5jb2xzTW9kZWwsIHRoaXMpKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLm5vZGVMaXN0ID0gZGlyID4gMCA/IHRoaXMubm9kZUxpc3QuY29uY2F0KG5vZGVzKSA6IG5vZGVzLmNvbmNhdCh0aGlzLm5vZGVMaXN0KTtcclxuXHJcblx0XHRyZXR1cm4gbm9kZXM7XHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEJ1ZmZlck5vZGU7XHJcbiIsImNsYXNzIEJ1ZmZlclpvbmUge1xyXG5cdGNvbnN0cnVjdG9yKGxpbWl0LCB0b3RhbCwgY2FjaGVUaW1lcykge1xyXG5cdFx0dGhpcy5pbml0KGxpbWl0LCB0b3RhbCwgY2FjaGVUaW1lcyk7XHJcblx0fVxyXG5cclxuXHRpbml0KGxpbWl0LCB0b3RhbCwgY2FjaGVUaW1lcykge1xyXG5cdFx0dGhpcy5zdGFydCA9IDA7XHJcblx0XHR0aGlzLmVuZCA9IHRoaXMubGltaXQgPSBsaW1pdDtcclxuXHRcdHRoaXMudG90YWwgPSArdG90YWw7XHJcblx0XHR0aGlzLmNhY2hlVGltZXMgPSBjYWNoZVRpbWVzIHx8IDM7XHJcblx0XHR0aGlzLmRvbWFpbiA9IFt0aGlzLnN0YXJ0LCB0aGlzLmVuZF07XHJcblx0fVxyXG5cclxuXHRzZXRMaW1pdChsaW1pdCkge1xyXG5cdFx0aWYgKCtsaW1pdCA+IDApIHtcclxuXHRcdFx0dGhpcy5pbml0KGxpbWl0LCB0aGlzLnRvdGFsKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHNldFRvdGFsKHRvdGFsKSB7XHJcblx0XHRpZiAoK3RvdGFsID49IDApIHtcclxuXHRcdFx0dGhpcy50b3RhbCA9IHRvdGFsO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0aXNBbW9uZyh2YWx1ZSkge1xyXG5cdFx0cmV0dXJuIHRoaXMuc3RhcnQgPD0gdmFsdWUgJiYgdmFsdWUgPD0gdGhpcy5lbmQ7XHJcblx0fVxyXG5cclxuXHRzaG91bGRMb2FkKGRpciwgdmVybmllcikge1xyXG5cdFx0aWYgKGRpciA9PT0gMCkgcmV0dXJuIGZhbHNlO1xyXG5cclxuXHRcdHZhciBzdGFydCA9IHRoaXMuc3RhcnQ7XHJcblx0XHR2YXIgZW5kID0gdGhpcy5lbmQ7XHJcblx0XHR2YXIgY2FjaGVUaW1lcyA9IHRoaXMuY2FjaGVUaW1lcztcclxuXHJcblx0XHQvLyBzY3JvbGwgdXBcclxuXHRcdGlmIChkaXIgPCAwICYmIHN0YXJ0ID09PSAwKSByZXR1cm4gZmFsc2U7XHJcblx0XHRpZiAoZGlyIDwgMCAmJiB2ZXJuaWVyIDwgc3RhcnQgKyB0aGlzLmxpbWl0KSB7XHJcblx0XHRcdGlmICh0aGlzLmlzQW1vbmcodmVybmllcikpIHtcclxuXHRcdFx0XHRlbmQgPSBzdGFydCAtIDE7XHJcblx0XHRcdFx0c3RhcnQgPSBNYXRoLm1heCgwLCBlbmQgLSB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fSBlbHNlIGlmICh2ZXJuaWVyID09PSAwKSB7XHJcblx0XHRcdFx0ZW5kID0gTWF0aC5taW4odGhpcy50b3RhbCwgdmVybmllciArIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0XHRzdGFydCA9IDA7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0ZW5kID0gdmVybmllciArIHRoaXMubGltaXQ7XHJcblx0XHRcdFx0c3RhcnQgPSBNYXRoLm1heCgwLCB2ZXJuaWVyIC0gKGNhY2hlVGltZXMgLSAxKSAqIHRoaXMubGltaXQpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLmRvbWFpbiA9IFtzdGFydCwgZW5kXTtcclxuXHRcdFx0dGhpcy5zdGFydCA9IHN0YXJ0O1xyXG5cdFx0XHR0aGlzLmVuZCA9IE1hdGgubWluKHN0YXJ0ICsgY2FjaGVUaW1lcyAqIHRoaXMubGltaXQsIHRoaXMuZW5kKTtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gc2Nyb2xsIGRvd25cclxuXHRcdGlmIChkaXIgPiAwICYmIGVuZCA9PT0gdGhpcy50b3RhbCkgcmV0dXJuIGZhbHNlO1xyXG5cdFx0aWYgKGRpciA+IDAgJiYgdmVybmllciA+IGVuZCAtIHRoaXMubGltaXQpIHtcclxuXHRcdFx0Ly8g5ri45qCH5Zyo546w5pyJ6IyD5Zu05YaFXHJcblx0XHRcdGlmICh0aGlzLmlzQW1vbmcodmVybmllcikpIHtcclxuXHRcdFx0XHRzdGFydCA9IGVuZCArIDE7XHJcblx0XHRcdFx0ZW5kID0gTWF0aC5taW4odGhpcy50b3RhbCwgc3RhcnQgKyB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvLyDmuLjmoIfliLDovr7nu5PlsL5cclxuXHRcdFx0ZWxzZSBpZiAodmVybmllciA9PT0gdGhpcy50b3RhbCkge1xyXG5cdFx0XHRcdGVuZCA9IHRoaXMudG90YWw7XHJcblx0XHRcdFx0c3RhcnQgPSBNYXRoLm1heCgwLCB2ZXJuaWVyIC0gY2FjaGVUaW1lcyAqIHRoaXMubGltaXQpO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIOS4jeWcqOeOsOacieiMg+WbtOWPiOacquWIsOe7k+WwvuWkhFxyXG5cdFx0XHRlbHNlIHtcclxuXHRcdFx0XHRlbmQgPSBNYXRoLm1pbih0aGlzLnRvdGFsLCB2ZXJuaWVyICsgKGNhY2hlVGltZXMgLSAxKSAqIHRoaXMubGltaXQpO1xyXG5cdFx0XHRcdHN0YXJ0ID0gTWF0aC5tYXgoMCwgZW5kIC0gY2FjaGVUaW1lcyAqIHRoaXMubGltaXQpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLmRvbWFpbiA9IFtzdGFydCwgZW5kXTtcclxuXHRcdFx0dGhpcy5lbmQgPSBlbmQ7XHJcblx0XHRcdHRoaXMuc3RhcnQgPSBNYXRoLm1heCh0aGlzLnN0YXJ0LCBlbmQgLSBjYWNoZVRpbWVzICogdGhpcy5saW1pdCk7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEJ1ZmZlclpvbmU7IiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJy4uL3V0aWwvRXZlbnRFbWl0dGVyJyk7XHJcbnZhciBVdGlscyA9IHJlcXVpcmUoJy4uL3V0aWwvVXRpbHMnKTtcclxudmFyIF8gPSByZXF1aXJlKCcuLi91dGlsL3NoaW0nKS5fO1xyXG5cclxudmFyIGRlZlJlbmRlcmVyID0gdiA9PiB2O1xyXG52YXIgT1JERVIgPSBbJ0FTQycsICdERVNDJ107XHJcblxyXG5jbGFzcyBDb2x1bW4gZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cdGNvbnN0cnVjdG9yKGNpZCwgb3B0aW9ucywgY29udGV4dCkge1xyXG5cdFx0c3VwZXIoKTtcclxuXHJcblx0XHRvcHRpb25zLnJlbmRlcmVyID0gb3B0aW9ucy5yZW5kZXJlciB8fCBkZWZSZW5kZXJlcjtcclxuXHJcblx0XHR2YXIgZGVmYXVsdHMgPSB7XHJcblx0XHRcdCd0ZXh0JzogJycsXHJcblx0XHRcdCd2dHlwZSc6ICdzdHJpbmcnLFxyXG5cdFx0XHQnZGF0YUluZGV4JzogJycsXHJcblx0XHRcdCd3aWR0aCc6IDUwLFxyXG5cdFx0XHQnYWxpZ24nOiAnbGVmdCcsXHJcblxyXG5cdFx0XHQncmVzaXphYmxlJzogdHJ1ZSxcclxuXHRcdFx0J2Nscyc6ICcnLFxyXG5cdFx0XHQnZml4ZWQnOiBmYWxzZSxcclxuXHRcdFx0J2RyYWdnYWJsZSc6IGZhbHNlLFxyXG5cdFx0XHQnc29ydGFibGUnOiB0cnVlLFxyXG5cdFx0XHQnaGlkZGVuJzogZmFsc2UsXHJcblx0XHRcdCdsb2NrZWQnOiBmYWxzZSxcclxuXHRcdFx0J2xvY2thYmxlJzogdHJ1ZSxcclxuXHRcdFx0J21lbnVEaXNhYmxlZCc6IHRydWUsXHJcblxyXG5cdFx0XHQvLyBwcml2YXRlXHJcblx0XHRcdCdzb3J0U3RhdGUnOiBudWxsXHJcblx0XHR9O1xyXG5cclxuXHRcdHRoaXMuY2lkID0gY2lkO1xyXG5cdFx0dGhpcy5jb250ZXh0ID0gY29udGV4dDtcclxuXHRcdE9iamVjdC5hc3NpZ24odGhpcywgZGVmYXVsdHMsIG9wdGlvbnMpO1xyXG5cdH1cclxuXHJcblx0c2V0V2lkdGgobnVtKSB7XHJcblx0XHRpZiAoIXRoaXMucmVzaXphYmxlKSByZXR1cm47XHJcblx0XHRpZiAoaXNOYU4obnVtKSkgcmV0dXJuO1xyXG5cclxuXHRcdHRoaXMud2lkdGggPSArbnVtO1xyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4tcmVzaXplZCcsIHRoaXMud2lkdGgsIHRoaXMpO1xyXG5cdH1cclxuXHJcblx0c2hvdygpIHtcclxuXHRcdHRoaXMuaGlkZGVuID0gZmFsc2U7XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1oaWRkZW4nLCB0aGlzLmhpZGRlbiwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHRoaWRlKCkge1xyXG5cdFx0dGhpcy51bkxvY2soKTtcclxuXHRcdFxyXG5cdFx0dGhpcy5oaWRkZW4gPSB0cnVlO1xyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4taGlkZGVuJywgdGhpcy5oaWRkZW4sIHRoaXMpO1xyXG5cdH1cclxuXHJcblx0dG9nZ2xlKCkge1xyXG5cdFx0aWYgKHRoaXMuaGlkZGVuKSB7XHJcblx0XHRcdHRoaXMuc2hvdygpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhpcy5oaWRlKCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRsb2NrKCkge1xyXG5cdFx0aWYgKCF0aGlzLmxvY2thYmxlKSByZXR1cm47XHJcblx0XHRpZiAodGhpcy5sb2NrZWQpIHJldHVybjtcclxuXHJcblx0XHR0aGlzLnNob3coKTtcclxuXHJcblx0XHR0aGlzLmxvY2tlZCA9IHRydWU7XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1sb2NrZWQnLCB0aGlzLmxvY2tlZCwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHR1bkxvY2soKSB7XHJcblx0XHRpZiAoIXRoaXMubG9ja2FibGUpIHJldHVybjtcclxuXHRcdGlmICghdGhpcy5sb2NrZWQpIHJldHVybjtcclxuXHJcblx0XHR0aGlzLmxvY2tlZCA9IGZhbHNlO1xyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4tbG9ja2VkJywgdGhpcy5sb2NrZWQsIHRoaXMpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogb3JkZXJbQVNDLCBERVNDLCBOT19TT1JUXVxyXG5cdCAqL1xyXG5cdHNvcnQob3JkZXIpIHtcclxuXHRcdGlmICghdGhpcy5zb3J0YWJsZSB8fCAhdGhpcy5kYXRhSW5kZXgpIHJldHVybjtcclxuXHJcblx0XHRpZiAob3JkZXIpIHtcclxuXHRcdFx0dGhpcy5zb3J0U3RhdGUgPSBPUkRFUi5pbmNsdWRlcyhvcmRlcikgPyBvcmRlciA6IG51bGw7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aGlzLnNvcnRTdGF0ZSA9IHRoaXMuc29ydFN0YXRlID09PSBPUkRFUlsxXSA/IE9SREVSWzBdIDogT1JERVJbMV07XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLXNvcnQtY2hhbmdlZCcsIHRoaXMuc29ydFN0YXRlKTtcclxuXHRcdHRoaXMuY29udGV4dC5maXJlKCdub3RpY2UtY29sTW9kZWwtc29ydC1jaGFuZ2VkJyk7XHJcbiBcdH1cclxuXHJcbiBcdG1vdmVUbyhpbmRleCkge1xyXG4gXHRcdGlmIChpc05hTigraW5kZXgpKSByZXR1cm47XHJcblxyXG4gXHRcdHRoaXMuY29udGV4dC5maXJlKCdjb2x1bW4tbW92ZS10bycsIHRoaXMsICtpbmRleCk7XHJcbiBcdH1cclxuXHJcbiBcdHJlbW92ZSgpIHtcclxuIFx0XHR0aGlzLmZpcmUoJ2Rlc3RvcnknKTtcclxuIFx0XHR0aGlzLmNvbnRleHQuZmlyZSgnY29sdW1uLXJlbW92ZWQnLCB0aGlzKTtcclxuIFx0XHR0aGlzLnJlbW92ZUV2ZW50KCk7XHJcbiBcdH1cclxufVxyXG5cclxuXHJcbmNsYXNzIENvbE1vZGVsIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHRjb25zdHJ1Y3Rvcihjb2x1bW5zKSB7XHJcblx0XHRzdXBlcigpO1xyXG5cclxuXHRcdGlmICghQXJyYXkuaXNBcnJheShjb2x1bW5zKSkge1xyXG5cdFx0XHR0aHJvdyAncmVxdWlyZSBwcm9wZXJ0eSBjb2x1bW5zIGlzIGEgYXJyYXkgb2JqZWN0JztcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLmNvbHVtbnMgPSBbXTsgLy8gZGF0YSBieSBjb2x1bW5cclxuXHRcdHRoaXMuY29sTW9kZWwgPSBuZXcgTWFwKCk7IC8vIGRhdGEgYnkgY2lkXHJcblx0XHR0aGlzLmNvbEhlYWRlcnMgPSBuZXcgTWFwKCk7IC8vIGRhdGEgYnkgZGF0YUluZGV4XHJcblxyXG5cdFx0dGhpcy5faW5pdENvbHVtbihjb2x1bW5zKTtcclxuXHRcdHRoaXMuX2JpbmRFdmVudCgpO1xyXG5cdH1cclxuXHJcblx0X2luaXRDb2x1bW4oY29sdW1ucywgY2FsbGJhY2spIHtcclxuXHRcdGxldCBzaXplID0gdGhpcy5zaXplKCk7XHJcblxyXG5cdFx0Y29sdW1ucy5mb3JFYWNoKChjb2wsIGluZGV4KSA9PiB7XHJcblx0XHRcdC8vIGNpZOino+WGs+ayoeaciWRhdGFJbmRleOWIl+aIluebuOWQjGRhdGFJbmRleOWIl+eahOmXrumimFxyXG5cdFx0XHRsZXQgY2lkID0gaW5kZXggKyBzaXplO1xyXG5cdFx0XHRsZXQgY29sTSA9IG5ldyBDb2x1bW4oY2lkLCBjb2wsIHRoaXMpO1xyXG5cclxuXHRcdFx0dGhpcy5jb2xNb2RlbC5zZXQoY2lkLCBjb2xNKTtcclxuXHRcdFx0dGhpcy5jb2x1bW5zLnB1c2goY29sTSk7XHJcblx0XHRcdHRoaXMuY29sSGVhZGVycy5zZXQoY29sLmRhdGFJbmRleCwgY29sTSk7XHJcblxyXG5cdFx0XHRjYWxsYmFjayAmJiBjYWxsYmFjayhjb2xNKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0YWRkQ29sdW1ucyhjb2x1bW5zKSB7XHJcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoY29sdW1ucykpIHtcclxuXHRcdFx0Y29sdW1ucyA9IFtjb2x1bW5zXTtcclxuXHRcdH1cclxuXHRcdHRoaXMuX2luaXRDb2x1bW4oY29sdW1ucywgY29sTSA9PiB0aGlzLmZpcmUoJ2NvbHVtbi1hZGQnLCBjb2xNKSk7XHJcblx0fVxyXG5cclxuXHRyZW1vdmVDb2x1bW4oZGF0YUluZGV4KSB7XHJcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoZGF0YUluZGV4KSkge1xyXG5cdFx0XHRkYXRhSW5kZXggPSBbZGF0YUluZGV4XTtcclxuXHRcdH1cclxuXHJcblx0XHRkYXRhSW5kZXguZm9yRWFjaChkcyA9PiB7XHJcblx0XHRcdGxldCBjb2xNID0gdGhpcy5nZXRDb2x1bW5CeURhdGFJbmRleChkcyk7XHJcblxyXG5cdFx0XHRpZiAoY29sTSkge1xyXG5cdFx0XHRcdGNvbE0ucmVtb3ZlKCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0X2JpbmRFdmVudCgpIHtcclxuXHRcdHRoaXMub24oJ25vdGljZS1jb2xNb2RlbC1zb3J0LWNoYW5nZWQnLCBfLmRlYm91bmNlKCgpID0+IHtcclxuXHRcdFx0dGhpcy5maXJlKCdjb2x1bW5zLXNvcnQtY2hhbmdlZCcpO1xyXG5cdFx0fSwgMjApKTtcclxuXHJcblx0XHR0aGlzLm9uKCdjb2x1bW4tbW92ZS10bycsIChjb2xNLCBpbmRleCkgPT4ge1xyXG5cdFx0XHRsZXQgY3VycmVudCA9IHRoaXMuY29sdW1ucy5pbmRleE9mKGNvbE0pO1xyXG5cclxuXHRcdFx0aWYgKGluZGV4ID09PSBjdXJyZW50KSByZXR1cm47XHJcblxyXG5cdFx0XHRpZiAoaW5kZXggPiBjdXJyZW50KSB7XHJcblx0XHRcdFx0dGhpcy5jb2x1bW5zLnNwbGljZSgrK2luZGV4LCAwLCB0aGlzLmNvbHVtbnNbY3VycmVudF0pO1xyXG5cdFx0XHRcdHRoaXMuY29sdW1ucy5zcGxpY2UoY3VycmVudCwgMSk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dGhpcy5jb2x1bW5zLnNwbGljZShpbmRleCwgMCwgdGhpcy5jb2x1bW5zW2N1cnJlbnRdKTtcclxuXHRcdFx0XHR0aGlzLmNvbHVtbnMuc3BsaWNlKCsrY3VycmVudCwgMSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuZmlyZSgnY29sdW1uLW1vdmVkJywgY29sTSwgaW5kZXgpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5vbignY29sdW1uLXJlbW92ZWQnLCBjb2xNID0+IHtcclxuXHRcdFx0dGhpcy5jb2x1bW5zID0gdGhpcy5jb2x1bW5zLmZpbHRlcihjb2wgPT4gY29sLmRhdGFJbmRleCAhPSBjb2xNLmRhdGFJbmRleCk7XHJcblx0XHRcdHRoaXMuY29sTW9kZWwuZGVsZXRlKGNvbE0uY2lkKTtcclxuXHRcdFx0dGhpcy5jb2xIZWFkZXJzLmRlbGV0ZShjb2xNLmRhdGFJbmRleCk7XHJcblx0XHR9KTtcclxuXHJcblx0fVxyXG5cclxuXHRzaXplKCkgeyBcclxuXHRcdHJldHVybiB0aGlzLmNvbE1vZGVsLnNpemU7IFxyXG5cdH1cclxuXHJcblx0Z2V0Q29sdW1uKGNvbCkge1xyXG5cdFx0aWYgKHRoaXMuY29sdW1ucy5pbmNsdWRlcyhjb2wpKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLmNvbHVtbnMuZmlsdGVyKF9jb2wgPT4gX2NvbCA9PSBjb2wpWzBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzLmNvbHVtbnM7XHJcblx0fVxyXG5cclxuXHRnZXRMb2NrQ29sdW1uKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuY29sdW1ucy5maWx0ZXIoY29sTSA9PiB7XHJcblx0XHRcdHJldHVybiBjb2xNLmxvY2tlZCA9PT0gdHJ1ZTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0Z2V0VmlzaWJsZUNvbHVtbigpIHtcclxuXHRcdHJldHVybiB0aGlzLmNvbHVtbnMuZmlsdGVyKGNvbE0gPT4ge1xyXG5cdFx0XHRyZXR1cm4gIWNvbE0uaGlkZGVuO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRnZXRDb2x1bW5CeURhdGFJbmRleChkYXRhSW5kZXgpIHtcclxuXHRcdHJldHVybiB0aGlzLmNvbEhlYWRlcnMuZ2V0KGRhdGFJbmRleCkgfHwgbnVsbDtcclxuXHR9XHJcblxyXG5cdGdldENvbHVtbnNCeUlkKGlkKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5jb2xNb2RlbFtpZF0gfHwgbnVsbDtcclxuXHR9XHJcblxyXG5cdGVhY2goY2FsbGJhY2ssIGNvbnRleHQpIHtcclxuXHRcdHRoaXMuY29sdW1ucy5mb3JFYWNoKGNhbGxiYWNrLCBjb250ZXh0IHx8IHRoaXMpO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHsgXHJcblxyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDb2xNb2RlbDsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi4vdXRpbC9FdmVudEVtaXR0ZXInKTtcclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbC9VdGlscycpO1xyXG52YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwvc2hpbScpLl87XHJcblxyXG5jbGFzcyBSb3cge1xyXG5cdGNvbnN0cnVjdG9yKHJpZCwgZGF0YSkge1xyXG5cdFx0dGhpcy5yaWQgPSByaWQ7XHJcblx0XHR0aGlzLmRhdGEgPSBkYXRhO1xyXG5cdFx0dGhpcy5zZWxlY3RlZCA9IGZhbHNlO1xyXG5cdH1cclxuXHRzdGF0ZSgpIHt9XHJcbn1cclxuXHJcbmNsYXNzIEdyaWRTdG9yZSBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblxyXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcclxuXHRcdHN1cGVyKCk7XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwgPSBvcHRpb25zLmNvbHVtbk1vZGVsO1xyXG5cclxuXHRcdHRoaXMucm93cyA9IFtdOyAvLyBkYXRhIGJ5IGluZGV4XHJcblx0XHR0aGlzLnJvd01vZGVsID0gbmV3IE1hcCgpOyAvLyBkYXRhIGJ5IGlkXHJcblxyXG5cclxuXHRcdHRoaXMuc2V0RGF0YShvcHRpb25zLmRhdGEpO1xyXG5cclxuXHRcdHRoaXMuX3NvcnRTdGF0ZSA9IHsga2V5czogW10sIGRpcnM6IFtdIH07XHJcblx0XHR0aGlzLl9iaW5kRXZlbnQoKTtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwuZWFjaChjb2xNID0+IHtcclxuXHRcdFx0Y29sTS5vbignY29sdW1uLXNvcnQtY2hhbmdlZCcsIHNvcnRTdGF0ZSA9PiB7XHJcblx0XHRcdFx0bGV0IHsga2V5cywgZGlycyB9ID0gdGhpcy5fc29ydFN0YXRlO1xyXG5cdFx0XHRcdGxldCBpbmRleCA9IGtleXMuaW5kZXhPZihjb2xNLmRhdGFJbmRleCk7XHJcblxyXG5cdFx0XHRcdC8vIOacquaOkuW6j1xyXG5cdFx0XHRcdGlmIChpbmRleCA9PT0gLTEgJiYgIXNvcnRTdGF0ZSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKGluZGV4ID09PSAtMSAmJiBzb3J0U3RhdGUpIHtcclxuXHRcdFx0XHRcdGtleXMudW5zaGlmdChjb2xNLmRhdGFJbmRleCk7XHJcblx0XHRcdFx0XHRkaXJzLnVuc2hpZnQoc29ydFN0YXRlLnRvTG93ZXJDYXNlKCkpO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8g5bey5o6S5bqPLOWFiOWIoOmZpFxyXG5cdFx0XHRcdGxldCBrZXkgPSBrZXlzLnNwbGljZShpbmRleCwgMSlbMF07XHJcblx0XHRcdFx0bGV0IGRpciA9IGRpcnMuc3BsaWNlKGluZGV4LCAxKVswXTtcclxuXHJcblx0XHRcdFx0aWYgKHNvcnRTdGF0ZSkge1xyXG5cdFx0XHRcdFx0a2V5cy51bnNoaWZ0KGtleSk7XHJcblx0XHRcdFx0XHRkaXJzLnVuc2hpZnQoc29ydFN0YXRlLnRvTG93ZXJDYXNlKCkpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Ly8g5omA5pyJ5YiX6YO95pu05paw54q25oCB5ZCOXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5vbignY29sdW1ucy1zb3J0LWNoYW5nZWQnLCAoKSA9PiB7XHJcblx0XHRcdGxldCB7IGtleXMsIGRpcnMgfSA9IHRoaXMuX3NvcnRTdGF0ZTtcclxuXHRcdFx0bGV0IGl0ZXJhdGVGbiA9IHJvdyA9PiByb3cuZGF0YVtrZXlzWzBdXTtcclxuXHJcblx0XHRcdC8vIGNvbnNvbGUubG9nKGtleXMsIGRpcnMpO1xyXG5cclxuXHRcdFx0dGhpcy5yb3dzID0gXy5vcmRlckJ5KHRoaXMucm93cywgaXRlcmF0ZUZuLCBkaXJzKTtcclxuXHRcdFx0dGhpcy5zZXREYXRhKF8ubWFwKHRoaXMucm93cywgJ2RhdGEnKSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdHNsaWNlKHN0YXJ0LCBlbmQpIHtcclxuXHRcdHJldHVybiB0aGlzLnJvd3Muc2xpY2Uoc3RhcnQsIGVuZCk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiDorr7nva7mjpLluo/nirbmgIFcclxuXHQgKiAoKylBU0MsIC1ERVNDLCAhTk9fU09SVFxyXG5cdCAqIEBzb3J0cyB7QXJyYXl9IHNvcnRzIC3mjpLluo/nirbmgIHmlbDnu4RcclxuXHQgKlx0c29ydHMgPSBbJytjb2xBJywgJ2NvbEInLCAnLWNvbEMnLCAnIWNvbEQnXVxyXG5cdCAqIEByZXR1cm5zIHRoaXM7XHJcblx0ICovXHJcblx0c2V0U29ydFN0YXRlKHNvcnRzKSB7XHJcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoc29ydHMpKSB7XHJcblx0XHRcdHNvcnRzID0gW3NvcnRzXTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9zb3J0U3RhdGUgPSB7IGtleXM6IFtdLCBkaXJzOiBbXSB9O1xyXG5cclxuXHRcdC8vIOWPjei9rOS8mOWFiOe6p+aWueS+v+WQjue7reinpuWPkemhuuW6j+aXtuWQjuinpuWPkeeahOS8mOWFiOe6p+mrmFxyXG5cdFx0c29ydHMucmV2ZXJzZSgpLmVhY2goc29ydE9iaiA9PiB7XHJcblx0XHRcdGxldCBvYmosIGtleSwgZGlyLCBjb2w7XHJcblxyXG5cdFx0XHRpZiAodHlwZW9mIHNvcnRPYmogPT09ICdzdHJpbmcnKSB7XHJcblx0XHRcdFx0b2JqID0gc29ydE9iai5tYXRjaCgvKF5bK3wtfCFdPykoLnswLH0pLyk7XHJcblx0XHRcdFx0ZGlyID0gb2JqWzFdID09PSAnJyA/ICdBU0MnIDogKG9iaiA9PT0gJy0nID8gJ0RFU0MnIDogJ05PX1NPUlQnKTtcclxuXHRcdFx0XHRrZXkgPSBvYmpbMl0gPyBvYmpbMl0gOiBudWxsO1xyXG5cclxuXHRcdFx0XHRjb2wgPSB0aGlzLmNvbHNNb2RlbC5nZXRDb2x1bW5CeURhdGFJbmRleChrZXkpO1xyXG5cdFx0XHRcdGlmIChjb2wpIHtcclxuXHRcdFx0XHRcdGNvbC5zb3J0KGRpcik7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdHNldERhdGEoZGF0YSA9IFtdLCBhcHBlbmQgPSBmYWxzZSkge1xyXG5cdFx0aWYgKCFhcHBlbmQpIHtcclxuXHRcdFx0dGhpcy5yb3dzLmxlbmd0aCA9IDA7XHJcblx0XHRcdHRoaXMucm93TW9kZWwuY2xlYXIoKTtcclxuXHRcdH1cclxuXHRcdHZhciBpbmRleCA9IHRoaXMuc2l6ZSgpO1xyXG5cdFx0ZGF0YS5mb3JFYWNoKChyb3csIHJpZHgpID0+IHtcclxuXHRcdFx0bGV0IHJvd00gPSBuZXcgUm93KHJpZHggKyBpbmRleCwgcm93KTtcclxuXHRcdFx0dGhpcy5yb3dzLnB1c2gocm93TSk7XHJcblx0XHRcdHRoaXMucm93TW9kZWwuc2V0KHJpZHggKyBpbmRleCwgcm93TSk7XHJcblx0XHR9KTtcclxuXHRcdHRoaXMuZmlyZSgnZGF0YS1jaGFuZ2VkJywgYXBwZW5kKTtcclxuXHR9XHJcblxyXG5cdGZvckVhY2goY2FsbGJhY2ssIGNvbnRleHQpIHtcclxuXHRcdHRoaXMucm93cy5mb3JFYWNoKGZ1bmN0aW9uKHJvd00sIHJpZHgpIHtcclxuXHRcdFx0Y2FsbGJhY2suY2FsbCh0aGlzLCByb3dNLmRhdGEsIHJpZHgpO1xyXG5cdFx0fSwgY29udGV4dCB8fCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdHNpemUoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yb3dNb2RlbC5zaXplO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHsgXHJcblxyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBHcmlkU3RvcmU7IiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJy4uL3V0aWwvRXZlbnRFbWl0dGVyJyk7XHJcbnZhciBDb2xNb2RlbCA9IHJlcXVpcmUoJy4vQ29sTW9kZWwnKTtcclxudmFyIEdyaWRTdG9yZSA9IHJlcXVpcmUoJy4vR3JpZFN0b3JlJyk7XHJcbnZhciBCdWZmZXJOb2RlID0gcmVxdWlyZSgnLi9CdWZmZXJOb2RlJyk7XHJcbnZhciBCdWZmZXJab25lID0gcmVxdWlyZSgnLi9CdWZmZXJab25lJyk7XHJcbnZhciBIZWFkZXIgPSByZXF1aXJlKCcuL0hlYWRlcicpO1xyXG52YXIgTG9ja0NvbE1hbmFnZXIgPSByZXF1aXJlKCcuL0xvY2tDb2xNYW5hZ2VyJyk7XHJcbnZhciBTY3JvbGxlciA9IHJlcXVpcmUoJy4vU2Nyb2xsZXInKTtcclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbC9VdGlscycpO1xyXG5cclxuZnVuY3Rpb24gY3JlYXRlTGF5b3V0KGNvbnRhaW5lciwgd2lkdGgpIHtcclxuXHR2YXIgd3JhcHBlciA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWdyaWQtd3JhcHBlcicpLndpZHRoKHdpZHRoKTtcclxuXHR2YXIgaGVhZGVyID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC1oZWFkZXInKTtcclxuXHR2YXIgYm9keSA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWdyaWQtYm9keScpO1xyXG5cdHZhciB2aWV3cG9ydCA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWdyaWQtdmlld3BvcnQnKS5hcHBlbmRUbyhib2R5KTtcclxuXHR2YXIgY2FudmFzID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC1jYW52YXMnKS5hcHBlbmRUbyh2aWV3cG9ydCk7XHJcblx0d3JhcHBlci5hcHBlbmQoaGVhZGVyKS5hcHBlbmQoYm9keSkuYXBwZW5kVG8oY29udGFpbmVyKTtcclxuXHJcblx0cmV0dXJuIHsgd3JhcHBlciwgaGVhZGVyLCBib2R5LCB2aWV3cG9ydCwgY2FudmFzIH07XHJcbn1cclxuZnVuY3Rpb24gY2FsY1Jvd0hlaWdodCgpIHtcclxuXHR2YXIgbGkgPSAkKCc8bGkgY2xhc3M9XCJjLWdyaWQtY2VsbFwiPnBsYWNlaG9sZGVyPC9saT4nKS5hcHBlbmRUbyhcImJvZHlcIik7XHJcblx0dmFyIHJvd0hlaWdodCA9IGxpLm91dGVySGVpZ2h0KCk7XHJcblx0bGkucmVtb3ZlKCk7XHJcblxyXG5cdHJldHVybiByb3dIZWlnaHQ7XHJcbn1cclxuXHJcbmNsYXNzIEdyaWRDb21wb25lbnQgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcclxuXHRcdHN1cGVyKCk7XHJcblxyXG5cdFx0aWYgKCEkKG9wdGlvbnMuZG9tRWwpLnNpemUoKSkgeyB0aHJvdyAncmVxdWlyZSBhIHZhbGlkIGRvbUVsJzsgfVxyXG5cclxuXHRcdHRoaXMuc2hvdWxkQWRkTm9kZXMgPSB0cnVlO1xyXG5cdFx0dGhpcy5oZWlnaHQgPSArb3B0aW9ucy5oZWlnaHQgfHwgNTAwO1xyXG5cdFx0dGhpcy53aWR0aCA9IG9wdGlvbnMud2lkdGg7XHJcblxyXG5cdFx0Ly8gJGxheW91dCBkb21cclxuXHRcdE9iamVjdC5hc3NpZ24odGhpcy4kZG9tID0ge30sIGNyZWF0ZUxheW91dCgkKG9wdGlvbnMuZG9tRWwpLCB0aGlzLndpZHRoKSk7XHJcblxyXG5cdFx0dGhpcy5jb2x1bW5Nb2RlbCA9IG5ldyBDb2xNb2RlbChvcHRpb25zLmNvbHVtbnMpO1xyXG5cdFx0dGhpcy5zdG9yZSA9IG5ldyBHcmlkU3RvcmUoeyBjb2x1bW5Nb2RlbDogdGhpcy5jb2x1bW5Nb2RlbCwgJ2RhdGEnOiBvcHRpb25zLmRhdGEgfHwgW10gfSk7XHJcblx0XHR0aGlzLl9pbml0KCk7XHJcblx0XHR0aGlzLl9iaW5kRXZlbnQoKTtcclxuXHR9XHJcblxyXG5cdF9pbml0KCkge1xyXG5cdFx0dGhpcy5oZWFkZXIgPSBuZXcgSGVhZGVyKHRoaXMuJGRvbS5oZWFkZXIsIHRoaXMuY29sdW1uTW9kZWwpO1xyXG5cdFx0dmFyIHRvdGFsID0gdGhpcy5zdG9yZS5zaXplKCk7XHJcblx0XHR2YXIgcm93SGVpZ2h0ID0gdGhpcy5yb3dIZWlnaHQgPSBjYWxjUm93SGVpZ2h0KCk7XHJcblx0XHR2YXIgdmlld3BvcnRIZWlnaHQgPSB0aGlzLmhlaWdodCAtIHRoaXMuJGRvbS5oZWFkZXIub3V0ZXJIZWlnaHQoKTtcclxuXHRcdHZhciBzaW5nbGVQYWdlU2l6ZSA9IE1hdGgubWluKE1hdGguY2VpbCh2aWV3cG9ydEhlaWdodC8gcm93SGVpZ2h0KSAtIDEsIHRvdGFsIC0gMSk7XHJcblxyXG5cdFx0dGhpcy5idWZmZXJab25lID0gbmV3IEJ1ZmZlclpvbmUoc2luZ2xlUGFnZVNpemUsIHRvdGFsKTtcclxuXHRcdHRoaXMuYnVmZmVyTm9kZSA9IG5ldyBCdWZmZXJOb2RlKHNpbmdsZVBhZ2VTaXplLCB0aGlzLmNvbHVtbk1vZGVsLCB0b3RhbCk7XHJcblx0XHR0aGlzLnNjcm9sbGVyID0gbmV3IFNjcm9sbGVyKHJvd0hlaWdodCwgdGhpcy5idWZmZXJab25lKTtcclxuXHRcdHRoaXMuc2Nyb2xsZXJcclxuXHRcdFx0Lm9uWCh4ID0+IHtcclxuXHRcdFx0XHR0aGlzLmZpcmUoJ3Njcm9sbExlZnQnLCB4KTtcclxuXHRcdFx0XHR0aGlzLiRkb20uaGVhZGVyLnNjcm9sbExlZnQoeCk7XHJcblx0XHRcdH0pXHJcblx0XHRcdC5vblkoKGRpciwgZG9tYWluLCBzdGFydCwgZW5kLCBpbmRleCwgdG90YWwpID0+IHtcclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyhg5rua5Yqo5pa55ZCR77yaJHtkaXJ9LCDliqDovb3ljLrpl7Q6IFske2RvbWFpbn1dLCDnjrDmnInojIPlm7TvvJooJHtzdGFydH0gLSAke2VuZH0pLCBgKVxyXG5cdFx0XHRcdHRoaXMuX2J1ZmZlclJlbmRlcihkaXIsIGRvbWFpbik7XHJcblx0XHRcdH0sIDIwKTtcclxuXHJcblx0XHR0aGlzLiRkb20udmlld3BvcnQuaGVpZ2h0KHZpZXdwb3J0SGVpZ2h0KTtcclxuXHRcdHRoaXMuJGRvbS52aWV3cG9ydC5vbignc2Nyb2xsJywgKGV2dCkgPT4ge1xyXG5cdFx0XHR0aGlzLnNjcm9sbGVyLmZpcmVZKGV2dC50YXJnZXQuc2Nyb2xsVG9wKTtcclxuXHRcdFx0dGhpcy5zY3JvbGxlci5maXJlWChldnQudGFyZ2V0LnNjcm9sbExlZnQpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5sb2NrQ29sTWFuYWdlciA9IExvY2tDb2xNYW5hZ2VyKHRoaXMuY29sdW1uTW9kZWwsIHRoaXMuaGVhZGVyLCB0aGlzLiRkb20sIHRoaXMuYnVmZmVyTm9kZSk7XHJcblx0XHR0aGlzLl9zZXRDYW52YXNXSCh0b3RhbCk7XHJcblx0fVxyXG5cclxuXHRfc2V0Q2FudmFzV0godG90YWwpIHtcclxuXHRcdHRoaXMuJGRvbS5jYW52YXNcclxuXHRcdFx0LndpZHRoKHRvdGFsID8gJ2F1dG8nIDogdGhpcy5fdW5Mb2NrVmlzaWJsZUNvbHNXaWR0aCgpKVxyXG5cdFx0XHQuaGVpZ2h0KHRoaXMucm93SGVpZ2h0ICogdG90YWwgfHwgMSk7XHJcblx0fVxyXG5cclxuXHRfdW5Mb2NrVmlzaWJsZUNvbHNXaWR0aCgpIHtcclxuXHRcdHJldHVybiB0aGlzLmhlYWRlci5nZXRWaXNpYmxlQ29sc1dpZHRoKCkgKyB0aGlzLmxvY2tDb2xNYW5hZ2VyLnZpc2libGVMb2NrQ29sdW1uLmdldFdpZHRoKCk7XHJcblx0fVxyXG5cclxuXHRzY3JvbGxUb1RvcChwb3NpdGlvbikge1xyXG5cdFx0dGhpcy4kZG9tLnZpZXdwb3J0LnNjcm9sbFRvcChwb3NpdGlvbik7XHJcblx0fVxyXG5cclxuXHRfYmluZEV2ZW50KCkge1xyXG5cdFx0dGhpcy5vbigndmlld3BvcnQtaGVpZ2h0LWNoYW5nZWQnLCB2aWV3cG9ydEhlaWdodCA9PiB7XHJcblx0XHRcdHRoaXMuX3VwZGF0ZUJ1ZmZlcigpO1xyXG5cdFx0XHR0aGlzLnJlbmRlcigpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5vbignc2Nyb2xsTGVmdCcsIHggPT4ge1xyXG5cdFx0XHQvLyBwZXJmb3JtYW5jZSBUT0RPXHJcblx0XHRcdC8vIGxldCBsb2NrQ29sdW1uV2lkdGggPSB0aGlzLmhlYWRlci5nZXRWaXNpYmxlTG9ja0NvbHNXaWR0aCgpO1xyXG5cdFx0XHQvLyB0aGlzLiRkb20uY2FudmFzLmZpbmQoJy5jLWNvbHVtbi1sb2NrZWQnKS5jc3MoJ2xlZnQnLCB4IC0gbG9ja0NvbHVtbldpZHRoKTtcclxuXHRcdFx0Ly8gdGhpcy4kZG9tLmhlYWRlci5maW5kKCcuYy1jb2x1bW4tbG9ja2VkJykuY3NzKCdsZWZ0JywgeCAtIGxvY2tDb2x1bW5XaWR0aCk7XHJcblx0XHRcdHRoaXMubG9ja0NvbE1hbmFnZXIuc2V0TG9ja0NvbHVtblgoeCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLnN0b3JlLm9uKCdkYXRhLWNoYW5nZWQnLCAoYXBwZW5kKSA9PiB7XHJcblx0XHRcdGxldCB0b3RhbCA9IHRoaXMuc3RvcmUuc2l6ZSgpO1xyXG5cdFx0XHR0aGlzLl9zZXRDYW52YXNXSCh0b3RhbCk7XHJcblx0XHRcdHRoaXMuYnVmZmVyTm9kZS5zZXRUb3RhbCh0b3RhbCk7XHJcblx0XHRcdHRoaXMuYnVmZmVyWm9uZS5zZXRUb3RhbCh0b3RhbCk7XHJcblxyXG5cdFx0XHRpZiAoIWFwcGVuZCB8fCAodG90YWwgLSAxKSAqIHRoaXMucm93SGVpZ2h0IDwgMip0aGlzLiRkb20udmlld3BvcnQub3V0ZXJIZWlnaHQoKSkge1xyXG5cdFx0XHRcdHRoaXMuX3VwZGF0ZUJ1ZmZlcigpO1xyXG5cdFx0XHRcdHRoaXMucmVuZGVyKCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHR9XHJcblxyXG5cdF91cGRhdGVCdWZmZXIoKSB7XHJcblx0XHR2YXIgbGltaXQgPSBNYXRoLm1pbihcclxuXHRcdFx0TWF0aC5jZWlsKHRoaXMuJGRvbS52aWV3cG9ydC5vdXRlckhlaWdodCgpIC8gdGhpcy5yb3dIZWlnaHQpIC0gMSxcclxuXHRcdFx0dGhpcy5zdG9yZS5zaXplKCkgLSAxKTtcclxuXHJcblx0XHR0aGlzLmJ1ZmZlclpvbmUuc2V0TGltaXQobGltaXQpO1xyXG5cdFx0dGhpcy5idWZmZXJOb2RlLnNldExpbWl0KGxpbWl0KTtcclxuXHRcdHRoaXMuc2hvdWxkQWRkTm9kZXMgPSB0cnVlO1xyXG5cdFx0dGhpcy5zY3JvbGxUb1RvcCgwKTtcclxuXHJcblx0XHR0aGlzLiRkb20uY2FudmFzLmVtcHR5KCk7XHJcblx0fVxyXG5cclxuXHRfYnVmZmVyUmVuZGVyKGRpciwgW3N0YXJ0LCBlbmRdKSB7XHJcblx0XHR2YXIgbm9kZXMgPSB0aGlzLmJ1ZmZlck5vZGUuZ2V0KGRpciwgW3N0YXJ0LCBlbmRdKTtcclxuXHRcdGNvbnNvbGUubG9nKCfkuIDmrKHojrflj5boioLngrnplb/luqYnLCBub2Rlcy5sZW5ndGgsIHN0YXJ0LCBlbmQpO1xyXG5cclxuXHRcdGlmICghdGhpcy5zaG91bGRBZGROb2Rlcykge1xyXG5cdFx0XHR0aGlzLnN0b3JlLnNsaWNlKHN0YXJ0LCBlbmQgKyAxKS5mb3JFYWNoKChyb3dNLCBpKSA9PiB7XHJcblx0XHRcdFx0bm9kZXNbaV0uc2V0RGF0YShyb3dNLCByb3dNLnJpZCAqIHRoaXMucm93SGVpZ2h0KTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHR2YXIgJGRvY0ZyYW1lID0gJCgnPGRpdi8+Jyk7XHJcblx0XHR0aGlzLnN0b3JlLnNsaWNlKHN0YXJ0LCBlbmQgKyAxKS5mb3JFYWNoKChyb3dNLCBpKSA9PiB7XHJcblxyXG5cdFx0XHRsZXQgbm9kZSA9IG5vZGVzW2ldLnNldERhdGEocm93TSwgcm93TS5yaWQgKiB0aGlzLnJvd0hlaWdodCk7XHJcblx0XHRcdCRkb2NGcmFtZS5hcHBlbmQobm9kZSk7XHJcblx0XHRcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuJGRvbS5jYW52YXMuYXBwZW5kKCRkb2NGcmFtZS5jaGlsZHJlbigpKTtcclxuXHRcdHRoaXMubG9ja0NvbE1hbmFnZXIuYWRkQnVmZmVyTG9ja05vZGUobm9kZXMpO1xyXG5cclxuXHRcdGlmICh0aGlzLmJ1ZmZlck5vZGUuaXNFbm91Z2goKSkge1xyXG5cdFx0XHR0aGlzLnNob3VsZEFkZE5vZGVzID0gZmFsc2U7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZW5kZXIoKSB7XHJcblx0XHR0aGlzLl9idWZmZXJSZW5kZXIoMSwgdGhpcy5idWZmZXJab25lLmRvbWFpbik7XHJcblx0fVxyXG5cclxuXHRzZXRXaWR0aChudW0pIHtcclxuXHRcdGlmIChpc05hTihudW0pKSByZXR1cm47XHJcblxyXG5cdFx0dGhpcy4kZG9tLndyYXBwZXIud2lkdGgobnVtKTtcclxuXHR9XHJcblxyXG5cdHNldEhlaWdodChudW0pIHtcclxuXHRcdGlmIChpc05hTihudW0pKSByZXR1cm47XHJcblxyXG5cdFx0dmFyIHZpZXdwb3J0SGVpZ2h0ID0gbnVtIC0gdGhpcy4kZG9tLmhlYWRlci5vdXRlckhlaWdodCgpO1xyXG5cdFx0dGhpcy4kZG9tLnZpZXdwb3J0Lm91dGVySGVpZ2h0KHZpZXdwb3J0SGVpZ2h0KTtcclxuXHRcdHRoaXMuZmlyZSgndmlld3BvcnQtaGVpZ2h0LWNoYW5nZWQnLCB2aWV3cG9ydEhlaWdodCk7XHJcblx0fVxyXG5cclxuXHRkZXN0b3J5KCkge1xyXG5cdFx0dGhpcy5jb2x1bW5Nb2RlbC5kZXN0b3J5KCk7XHJcblx0XHR0aGlzLnN0b3JlLmRlc3RvcnkoKTtcclxuXHRcdHRoaXMuaGVhZGVyLmRlc3RvcnkoKTtcclxuXHRcdHRoaXMuJGRvbS53cmFwcGVyLnJlbW92ZSgpO1xyXG5cdH1cclxufVxyXG5tb2R1bGUuZXhwb3J0cyA9IEdyaWRDb21wb25lbnQ7IiwiY29uc3QgeyAkLCBfIH0gPSByZXF1aXJlKCcuLi91dGlsL3NoaW0nKTtcclxuY29uc3QgREQgPSByZXF1aXJlKCcuLi91dGlsL0REJyk7XHJcblxyXG5jb25zdCBTT1JUX0NMU19BU0MgPSAnYy1jb2x1bW4tYXNjJztcclxuY29uc3QgU09SVF9DTFNfREVTQyA9ICdjLWNvbHVtbi1kZXNjJztcclxuY29uc3QgTkVFRExFU1NfV0lEVEggPSAxMDAwO1xyXG5cclxudmFyIGNyZWF0ZUNvbHVtbkVsZW1lbnQgPSBmdW5jdGlvbihjb2xNKSB7XHJcblx0dmFyIGxvY2tDbGFzcyA9IGNvbE0ubG9ja2VkID8gJyBjLWNvbHVtbi1sb2NrZWQnIDogJyc7XHJcblxyXG5cdHJldHVybiAkKCc8bGkvPicpXHJcblx0XHQuYWRkQ2xhc3MoJ2MtaGVhZGVyLWNlbGwnICsgbG9ja0NsYXNzKVxyXG5cdFx0LmFkZENsYXNzKCdjLWFsaWduLScgKyBjb2xNLmFsaWduKVxyXG5cdFx0LndpZHRoKGNvbE0ud2lkdGgpXHJcblx0XHQub24oJ2NsaWNrJywgKCkgPT4geyBjb2xNLnNvcnQoKTsgfSlcclxuXHRcdC5kYXRhKCdjb2x1bW4nLCBjb2xNKVxyXG5cdFx0Lmh0bWwoY29sTS50ZXh0KTtcclxufTtcclxuXHJcblxyXG5jbGFzcyBIZWFkZXIge1xyXG5cdGNvbnN0cnVjdG9yKCRoZWFkZXIsIGNvbHNNb2RlbCkge1xyXG5cclxuXHRcdHRoaXMuX2RyYWdnaW5nID0gZmFsc2U7XHJcblx0XHR0aGlzLl9yZXNpemluZyA9IGZhbHNlO1xyXG5cclxuXHRcdHRoaXMuJGhlYWRlciA9ICRoZWFkZXI7XHJcblx0XHR0aGlzLmNvbHNNb2RlbCA9IGNvbHNNb2RlbDtcclxuXHRcdC8vIHRoaXMuc3RvcmUgPSBzdG9yZTtcclxuXHRcdHRoaXMuY29sRWxlbWVudHMgPSBuZXcgTWFwKCk7XHJcblxyXG5cdFx0dGhpcy5fY3JlYXRlQ29sdW1uRWxlbWVudHMoKTtcclxuXHRcdHRoaXMuX2JpbmRFdmVudCgpO1xyXG5cclxuXHRcdHRoaXMucmVuZGVyKCk7XHJcblx0fVxyXG5cclxuXHRfY3JlYXRlQ29sdW1uRWxlbWVudHMoKSB7XHJcblx0XHR2YXIgd2lkdGggPSBORUVETEVTU19XSURUSDtcclxuXHJcblx0XHR0aGlzLiRyb3cgPSAkKCc8dWwvPicpLmFkZENsYXNzKCdjLWhlYWRlci1yb3cnKTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRsZXQgY29sRWxlbWVudCA9IGNyZWF0ZUNvbHVtbkVsZW1lbnQoY29sTSk7XHJcblxyXG5cdFx0XHR0aGlzLmNvbEVsZW1lbnRzLnNldChjb2xNLCBjb2xFbGVtZW50KTtcclxuXHRcdFx0dGhpcy4kcm93LmFwcGVuZChjb2xFbGVtZW50KTtcclxuXHJcblx0XHRcdHdpZHRoICs9IGNvbE0ud2lkdGg7XHJcblxyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kcm93LndpZHRoKHdpZHRoKTtcclxuXHR9XHJcblxyXG5cdGdldFZpc2libGVDb2xzV2lkdGgoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy4kcm93LndpZHRoKCkgLSBORUVETEVTU19XSURUSDtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHR0aGlzLl9jb2x1bW5SZXNpemUoKTtcclxuXHRcdHRoaXMuX2NvbHVtbk1vdmUoKTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5vbignY29sdW1uLWFkZCcsIGNvbE0gPT4ge1xyXG5cdFx0XHRsZXQgY29sRWxlbWVudCA9IGNyZWF0ZUNvbHVtbkVsZW1lbnQoY29sTSk7XHJcblxyXG5cdFx0XHR0aGlzLmNvbEVsZW1lbnRzLnNldChjb2xNLCBjb2xFbGVtZW50KTtcclxuXHRcdFx0dGhpcy4kcm93LmFwcGVuZChjb2xFbGVtZW50KTtcclxuXHJcblx0XHRcdGxldCByb3dXID0gdGhpcy4kcm93LndpZHRoKCk7XHJcblx0XHRcdHRoaXMuJHJvdy53aWR0aChyb3dXICsgY29sTS53aWR0aCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5vbignY29sdW1uLW1vdmVkJywgKGNvbE0sIGluZGV4KSA9PiB7XHJcblx0XHRcdGxldCBjb2xFbGVtZW50ID0gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblx0XHRcdGNvbEVsZW1lbnQuaW5zZXJ0QWZ0ZXIodGhpcy4kcm93LmZpbmQoJ2xpLmMtaGVhZGVyLWNlbGwnKS5lcShpbmRleCkpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwuZWFjaChjb2xNID0+IHtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1yZXNpemVkJywgd2lkdGggPT4gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSkub3V0ZXJXaWR0aCh3aWR0aCkpO1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWhpZGRlbicsIGlzSGlkZGVuID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblx0XHRcdFx0aWYgKGlzSGlkZGVuKSB7XHJcblx0XHRcdFx0XHRjb2xFbGUuYWRkQ2xhc3MoJ2MtY29sdW1uLWhpZGUnKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKCdjLWNvbHVtbi1oaWRlJyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1sb2NrZWQnLCBpc0xvY2tlZCA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0XHRpZiAoaXNMb2NrZWQpIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcygnYy1jb2x1bW4tbG9ja2VkJyk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcygnYy1jb2x1bW4tbG9ja2VkJyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1zb3J0LWNoYW5nZWQnLCBzb3J0U3RhdGUgPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coc29ydFN0YXRlKTtcclxuXHRcdFx0XHRpZiAoc29ydFN0YXRlKSB7XHJcblx0XHRcdFx0XHRpZiAoc29ydFN0YXRlID09PSAnQVNDJykge1xyXG5cdFx0XHRcdFx0XHRjb2xFbGUuYWRkQ2xhc3MoU09SVF9DTFNfQVNDKTtcclxuXHRcdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKFNPUlRfQ0xTX0RFU0MpO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKFNPUlRfQ0xTX0RFU0MpO1xyXG5cdFx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoU09SVF9DTFNfQVNDKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKFNPUlRfQ0xTX0FTQykucmVtb3ZlQ2xhc3MoU09SVF9DTFNfREVTQyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2Rlc3RvcnknLCAoKSA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cdFx0XHRcdHRoaXMuY29sRWxlbWVudHMuZGVsZXRlKGNvbE0pO1x0XHRcdFxyXG5cdFx0XHRcdGNvbEVsZS5yZW1vdmUoKTtcclxuXHJcblx0XHRcdFx0bGV0IHJvd1cgPSB0aGlzLiRyb3cud2lkdGgoKTtcclxuXHRcdFx0XHR0aGlzLiRyb3cud2lkdGgocm93VyAtIGNvbE0ud2lkdGgpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0X2NvbHVtblJlc2l6ZSgpIHtcclxuXHRcdHRoaXMuJHJvdy5vbignbW91c2Vtb3ZlJywgJ2xpLmMtaGVhZGVyLWNlbGwnLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0dmFyIG9mZnNldFggPSBldnQub2Zmc2V0WDtcclxuXHRcdFx0aWYgKHRoaXMub2Zmc2V0V2lkdGggLSBvZmZzZXRYIDw9IDUgfHwgb2Zmc2V0WCA8PSA1KSB7XHJcblx0XHRcdFx0JCh0aGlzKS5hZGRDbGFzcygnYy1jb2wtcmVzaXphYmxlJyk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0JCh0aGlzKS5yZW1vdmVDbGFzcygnYy1jb2wtcmVzaXphYmxlJyk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHRcdGxldCBzdGFydFggPSAwO1xyXG5cdFx0bGV0IHNlbGYgPSB0aGlzO1xyXG5cclxuXHRcdEREKHRoaXMuJHJvdywge1xyXG5cdFx0XHQndHJpZ2dlcic6ICdsaS5jLWhlYWRlci1jZWxsJyxcclxuXHRcdFx0J3Jlc3RyaWN0ZXInOiBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRpZiAoc2VsZi5fZHJhZ2dpbmcpIHJldHVybiBmYWxzZTtcclxuXHJcblx0XHRcdFx0bGV0IG9mZnNldFggPSBldnQub2Zmc2V0WDtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRpZiAodGhpcy5vZmZzZXRXaWR0aCAtIG9mZnNldFggPD0gNSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuICQodGhpcyk7XHJcblx0XHRcdFx0fSBlbHNlIGlmIChvZmZzZXRYIDw9IDUpIHtcclxuXHRcdFx0XHRcdHJldHVybiAkKHRoaXMpLnByZXYoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sXHJcblx0XHRcdCdvbkRyYWdTdGFydCc6IF8uZGVib3VuY2UoZnVuY3Rpb24ob2Zmc2V0LCAkdGFyZ2V0KSB7XHJcblx0XHRcdFx0bGV0IHNjcm9sbExlZnQgPSBkb2N1bWVudC5ib2R5LnNjcm9sbExlZnQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbExlZnQ7XHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coJHRhcmdldC5vZmZzZXQoKS5sZWZ0LCAkdGFyZ2V0LnRleHQoKSk7XHJcblx0XHRcdFx0c3RhcnRYID0gJHRhcmdldC5vZmZzZXQoKS5sZWZ0IC0gc2Nyb2xsTGVmdDtcclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyhvZmZzZXQueCwgJHRhcmdldC50ZXh0KCkpO1xyXG5cdFx0XHRcdHNlbGYuX3Jlc2l6aW5nID0gdHJ1ZTtcclxuXHRcdFx0XHQvLyBzdGFydFggPSBvZmZzZXQueDtcclxuXHRcdFx0fSwgODApLFxyXG5cdFx0XHQnb25EcmFnZ2luZyc6IGZ1bmN0aW9uKG9mZnNldCwgJHRhcmdldCkge1xyXG5cclxuXHRcdFx0fSxcclxuXHRcdFx0J29uRHJhZ0VuZCc6IF8uZGVib3VuY2UoZnVuY3Rpb24ob2Zmc2V0LCAkdGFyZ2V0KSB7XHJcblx0XHRcdFx0bGV0IHdpZHRoID0gb2Zmc2V0LnggLSBzdGFydFg7XHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coYCR7JHRhcmdldC50ZXh0KCl9XHJcblx0XHRcdFx0Ly8gXHTljp/lrr3luqbkuLokeyR0YXJnZXQuZGF0YSgnY29sdW1uJykud2lkdGh9LFxyXG5cdFx0XHRcdC8vIFx05pS55Y+Y5Li677yaJHt3aWR0aH0sIFske29mZnNldC54fSAtICR7c3RhcnRYfV1gKTtcclxuXHRcdFx0XHQkdGFyZ2V0LmRhdGEoJ2NvbHVtbicpLnNldFdpZHRoKHdpZHRoKTtcclxuXHRcdFx0XHRzZWxmLl9yZXNpemluZyA9IGZhbHNlO1xyXG5cdFx0XHR9LCA4MClcclxuXHRcdH0pO1xyXG5cdFx0XHJcblx0fVxyXG5cclxuXHRfY29sdW1uTW92ZSgpIHtcclxuXHRcdGxldCBzZWxmID0gdGhpcztcclxuXHRcdGxldCB0b0NvbHVtbiA9IG51bGw7XHJcblx0XHRsZXQgZnJvbUNvbHVtbiA9IG51bGw7XHJcblx0XHRsZXQgJGJvZHkgPSAkKCdib2R5Jyk7XHJcblx0XHRsZXQgJG1vdmVTdGF0dXNUb3AgPSAkKCc8ZGl2Lz4nKS5hZGRDbGFzcygnYy1jb2wtcGxhY2Vob2xkZXIgYy10b3AnKTtcclxuXHRcdGxldCAkbW92ZVN0YXR1c0JvdHRvbSA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWNvbC1wbGFjZWhvbGRlciBjLWJvdHRvbScpO1xyXG5cclxuXHRcdHRoaXMuJHJvd1xyXG5cdFx0XHQub24oJ21vdXNlZG93bicsICdsaS5jLWhlYWRlci1jZWxsJywgZnVuY3Rpb24oZXZ0KSB7XHJcblx0XHRcdFx0bGV0IG9mZnNldFggPSBldnQub2Zmc2V0WDtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRpZiAodGhpcy5vZmZzZXRXaWR0aCAtIG9mZnNldFggPD0gNSB8fCBvZmZzZXRYIDw9IDUpIHtcclxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHNlbGYuX2RyYWdnaW5nID0gdHJ1ZTtcclxuXHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9ICQodGhpcykuYWRkQ2xhc3MoJ2MtY29sLWRyYWdnYWJsZScpO1xyXG5cdFx0XHRcdGZyb21Db2x1bW4gPSAkKHRoaXMpLmRhdGEoJ2NvbHVtbicpO1xyXG5cdFx0XHRcdCRib2R5LmFwcGVuZCgkbW92ZVN0YXR1c1RvcCkuYXBwZW5kKCRtb3ZlU3RhdHVzQm90dG9tKTtcclxuXHJcblx0XHRcdFx0ZXZ0LnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cdFx0XHRcdGV2dC5wcmV2ZW50RGVmYXVsdDtcclxuXHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9KVxyXG5cdFx0XHQub24oJ21vdXNlZW50ZXInLCAnbGkuYy1oZWFkZXItY2VsbCcsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHRcdGlmIChzZWxmLl9kcmFnZ2luZykge1xyXG5cdFx0XHRcdFx0bGV0ICRvdmVyQ29sdW1uID0gJCh0aGlzKTtcclxuXHRcdFx0XHRcdHRvQ29sdW1uID0gJG92ZXJDb2x1bW4uZGF0YSgnY29sdW1uJyk7XHJcblx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdGxldCB0b3AgPSAkb3ZlckNvbHVtbi5vZmZzZXQoKS50b3AgLSAxMjtcclxuXHRcdFx0XHRcdGxldCBsZWZ0ID0gJG92ZXJDb2x1bW4ub2Zmc2V0KCkubGVmdCArIHRvQ29sdW1uLndpZHRoIC0gODtcclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0JG1vdmVTdGF0dXNUb3AuY3NzKHsgdG9wOiB0b3AsIGxlZnQ6IGxlZnQgfSkuc2hvdygpO1xyXG5cdFx0XHRcdFx0JG1vdmVTdGF0dXNCb3R0b20uY3NzKHsgdG9wOiB0b3AgKyA0MCwgbGVmdDogbGVmdCB9KS5zaG93KCk7XHJcblxyXG5cdFx0XHRcdFx0ZXZ0LnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cdFx0XHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0O1xyXG5cclxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pXHJcblx0XHRcdC5vbignbW91c2V1cCcsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHRcdHNlbGYuX2RyYWdnaW5nID0gZmFsc2U7XHJcblxyXG5cdFx0XHRcdGlmICh0b0NvbHVtbikge1xyXG5cdFx0XHRcdFx0bGV0IGluZGV4ID0gc2VsZi5jb2xFbGVtZW50cy5nZXQodG9Db2x1bW4pLmluZGV4KCk7XHJcblxyXG5cdFx0XHRcdFx0bGV0IGNpbmRleCA9IHNlbGYuY29sc01vZGVsLmdldENvbHVtbigpLmluZGV4T2YodG9Db2x1bW4pO1xyXG5cclxuXHRcdFx0XHRcdGNvbnNvbGUubG9nKGluZGV4LCBjaW5kZXgpO1xyXG5cclxuXHRcdFx0XHRcdGZyb21Db2x1bW4ubW92ZVRvKGluZGV4KTtcclxuXHRcdFx0XHRcdHNlbGYuY29sRWxlbWVudHMuZ2V0KGZyb21Db2x1bW4pLnJlbW92ZUNsYXNzKCdjLWNvbC1kcmFnZ2FibGUnKTtcclxuXHJcblx0XHRcdFx0XHQkbW92ZVN0YXR1c1RvcC5oaWRlKCkucmVtb3ZlKCk7XHJcblx0XHRcdFx0XHQkbW92ZVN0YXR1c0JvdHRvbS5oaWRlKCkucmVtb3ZlKCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRmcm9tQ29sdW1uID0gbnVsbDtcclxuXHRcdFx0XHR0b0NvbHVtbiA9IG51bGw7XHJcblx0XHRcdH0pO1xyXG5cdH1cclxuXHJcblx0cmVuZGVyKCkge1xyXG5cdFx0dGhpcy4kaGVhZGVyLmFwcGVuZCh0aGlzLiRyb3cpO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHtcclxuXHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEhlYWRlcjsiLCIndXNlIHN0cmljdCc7XHJcblxyXG5jbGFzcyBMb2NrQ29sdW1uIHtcclxuXHRjb25zdHJ1Y3RvcigpIHtcclxuXHRcdHRoaXMuX2RhdGEgPSBbXTtcclxuXHRcdHRoaXMuX2NvbHVtbnNXaWR0aCA9IDA7XHJcblx0fVxyXG5cclxuXHRhZGQoY29sTSkge1xyXG5cdFx0dGhpcy5fZGF0YS51bnNoaWZ0KGNvbE0pO1xyXG5cdFx0dGhpcy5yZUNhbGMoKTtcclxuXHR9XHJcblxyXG5cdHJlbW92ZShkZWxDb2xNKSB7XHJcblx0XHR0aGlzLl9kYXRhID0gdGhpcy5fZGF0YS5maWx0ZXIoY29sTSA9PiBjb2xNICE9PSBkZWxDb2xNKTtcclxuXHRcdHRoaXMucmVDYWxjKCk7XHJcblx0fVxyXG5cclxuXHRjbGVhcigpIHtcclxuXHRcdHRoaXMuX2RhdGEubGVuZ3RoID0gMDtcclxuXHRcdHRoaXMucmVDYWxjKCk7XHJcblx0fVxyXG5cclxuXHRnZXRXaWR0aCgpIHtcclxuXHRcdHJldHVybiB0aGlzLl9jb2x1bW5zV2lkdGg7XHJcblx0fVxyXG5cclxuXHRyZUNhbGMoKSB7XHJcblx0XHR0aGlzLl9jb2x1bW5zV2lkdGggPSB0aGlzLl9kYXRhLnJlZHVjZSgod2lkdGgsIGNvbE0pID0+IHtcclxuXHRcdFx0d2lkdGggLT0gY29sTS53aWR0aDtcclxuXHRcdFx0Y29sTS5hd2F5RnJvbUxlZnQgPSB3aWR0aDtcclxuXHRcdFx0cmV0dXJuIHdpZHRoO1xyXG5cdFx0fSwgMCk7XHJcblx0fVxyXG5cclxuXHRlYWNoKGZuKSB7XHJcblx0XHR0aGlzLl9kYXRhLmZvckVhY2goZm4pO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICog5b2T5YW25Lit5LiA5YiX5Y+R55Sf5Y+Y5YyW77yM6YCa55+l5YW25a6D5YiX55u45bqU5Y+Y5YyWXHJcblx0ICovXHJcblx0IHB1Ymxpc2goY2hhbmdlZENvbE0sIHNjcm9sbExlZnQpIHtcclxuXHQgXHR0aGlzLl9kYXRhLmZvckVhY2goY29sTSA9PiB7XHJcblx0IFx0XHRpZiAoY29sTSAhPT0gY2hhbmdlZENvbE0pIHtcclxuXHQgXHRcdFx0Y29sTS5maXJlKCdzY3JvbGwteCcsIHNjcm9sbExlZnQpO1xyXG5cdCBcdFx0fVxyXG5cdCBcdH0pO1xyXG5cdCB9XHJcbn1cclxuXHJcbnZhciBMb2NrQ29sTWFuYWdlciA9IGZ1bmN0aW9uKGNvbHNNb2RlbCwgaGVhZGVyLCAkZG9tLCBidWZmZXJOb2RlKSB7XHJcblx0bGV0IHZpc2libGVMb2NrQ29sdW1uID0gbmV3IExvY2tDb2x1bW4oKTtcclxuXHJcblx0aW5pdCgpO1xyXG5cdGluaXRFdmVudCgpO1xyXG5cclxuXHRmdW5jdGlvbiBpbml0KCkge1xyXG5cdFx0Y29sc01vZGVsXHJcblx0XHRcdC5nZXRMb2NrQ29sdW1uKClcclxuXHRcdFx0LmZpbHRlcihjb2xNID0+ICFjb2xNLmhpZGRlbilcclxuXHRcdFx0LmZvckVhY2goY29sTSA9PiB2aXNpYmxlTG9ja0NvbHVtbi5hZGQoY29sTSkpO1xyXG5cclxuXHRcdHVwZGF0ZUJveFNpemUoKTtcclxuXHJcblx0XHR2aXNpYmxlTG9ja0NvbHVtbi5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRsZXQgaGVhZGVyRWxlbWVudCA9IGhlYWRlci5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblx0XHRcdC8vIOiuvue9ruW5tuiusOW9leWIneWni+eahOW3puS+p+S9jVxyXG5cdFx0XHRoZWFkZXJFbGVtZW50LmNzcygnbGVmdCcsIGNvbE0uYXdheUZyb21MZWZ0KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ3Njcm9sbC14JywgeCA9PiB7XHJcblx0XHRcdFx0bGV0IGxlZnRTdHlsZSA9IHsgJ2xlZnQnOiB4ICsgY29sTS5hd2F5RnJvbUxlZnQgfTtcclxuXHJcblx0XHRcdFx0aGVhZGVyRWxlbWVudC5jc3MobGVmdFN0eWxlKTtcclxuXHRcdFx0XHRidWZmZXJOb2RlLmdldE5vZGVMaXN0KCkuZm9yRWFjaChub2RlID0+IG5vZGUuY2hpbGRyZW4uZ2V0KGNvbE0pLmNzcyhsZWZ0U3R5bGUpKTtcdFx0XHRcdFxyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaW5pdEV2ZW50KCkge1xyXG5cclxuXHRcdGNvbnN0IGNvbHVtbkxvY2tPclVuTG9jayA9IChpc0xvY2tlZCwgY29sTSkgPT4ge1xyXG5cdFx0XHRsZXQgaGVhZGVyRWxlbWVudCA9IGhlYWRlci5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRpZiAoaXNMb2NrZWQpIHtcclxuXHRcdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5hZGQoY29sTSk7XHJcblxyXG5cdFx0XHRcdGNvbE0ub24oJ3Njcm9sbC14JywgeCA9PiB7XHJcblx0XHRcdFx0XHRsZXQgbGVmdFN0eWxlID0geyAnbGVmdCc6IHggKyBjb2xNLmF3YXlGcm9tTGVmdCB9O1xyXG5cclxuXHRcdFx0XHRcdGhlYWRlckVsZW1lbnQuY3NzKGxlZnRTdHlsZSk7XHJcblx0XHRcdFx0XHRidWZmZXJOb2RlLmdldE5vZGVMaXN0KCkuZm9yRWFjaChub2RlID0+IG5vZGUuY2hpbGRyZW4uZ2V0KGNvbE0pLmNzcyhsZWZ0U3R5bGUpKTtcclxuXHRcdFx0XHR9KTtcclxuXHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4ucmVtb3ZlKGNvbE0pO1xyXG5cclxuXHRcdFx0XHRjb2xNLm9mZignc2Nyb2xsLXgnKTtcclxuXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGxldCBjdXJyZW50TGVmdCA9ICRkb20udmlld3BvcnQuc2Nyb2xsTGVmdCgpICsgY29sTS5hd2F5RnJvbUxlZnQ7XHJcblxyXG5cdFx0XHQvLyDorr7nva7lubborrDlvZXliJ3lp4vnmoTlt6bkvqfkvY1cclxuXHRcdFx0aGVhZGVyRWxlbWVudC5jc3MoJ2xlZnQnLCBjdXJyZW50TGVmdCk7XHJcblx0XHRcdGJ1ZmZlck5vZGUuZ2V0Tm9kZUxpc3QoKS5mb3JFYWNoKG5vZGUgPT4gbm9kZS5jaGlsZHJlbi5nZXQoY29sTSkuY3NzKCdsZWZ0JywgY3VycmVudExlZnQpKTtcclxuXHJcblx0XHRcdHZpc2libGVMb2NrQ29sdW1uLnB1Ymxpc2goY29sTSwgJGRvbS52aWV3cG9ydC5zY3JvbGxMZWZ0KCkpO1xyXG5cdFx0XHR1cGRhdGVCb3hTaXplKCk7XHJcblx0XHR9O1xyXG5cclxuXHRcdGNvbHNNb2RlbC5vbignY29sdW1uLWFkZCcsIGNvbE0gPT4ge1xyXG5cdFx0XHQvLyBCVUdGSVggVE9ET1xyXG5cclxuXHRcdFx0Ly8gLi4uXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1sb2NrZWQnLCBpc0xvY2tlZCA9PiB7XHJcblx0XHRcdFx0Y29sdW1uTG9ja09yVW5Mb2NrKGlzTG9ja2VkLCBjb2xNKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRjb2xzTW9kZWwuZ2V0Q29sdW1uKCkuZm9yRWFjaChjb2xNID0+IHtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1yZXNpemVkJywgd2lkdGggPT4ge1xyXG5cclxuXHRcdFx0XHRpZiAoY29sTS5sb2NrZWQpIHtcclxuXHRcdFx0XHRcdHZpc2libGVMb2NrQ29sdW1uLnJlQ2FsYygpO1xyXG5cdFx0XHRcdFx0bGV0IGhlYWRlckVsZW1lbnQgPSBoZWFkZXIuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0XHRcdGxldCBjdXJyZW50TGVmdCA9ICRkb20udmlld3BvcnQuc2Nyb2xsTGVmdCgpICsgY29sTS5hd2F5RnJvbUxlZnQ7XHJcblxyXG5cdFx0XHRcdFx0aGVhZGVyRWxlbWVudC5jc3MoJ2xlZnQnLCBjdXJyZW50TGVmdCk7XHJcblx0XHRcdFx0XHRidWZmZXJOb2RlLmdldE5vZGVMaXN0KCkuZm9yRWFjaChub2RlID0+IG5vZGUuY2hpbGRyZW4uZ2V0KGNvbE0pLmNzcygnbGVmdCcsIGN1cnJlbnRMZWZ0KSk7XHJcblxyXG5cdFx0XHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4ucHVibGlzaChjb2xNLCAkZG9tLnZpZXdwb3J0LnNjcm9sbExlZnQoKSk7XHJcblx0XHRcdFx0XHR1cGRhdGVCb3hTaXplKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcclxuXHRcdFx0fSk7XHJcblxyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWxvY2tlZCcsIGlzTG9ja2VkID0+IHtcclxuXHRcdFx0XHQvLyAuLi5cclxuXHRcdFx0XHRjb2x1bW5Mb2NrT3JVbkxvY2soaXNMb2NrZWQsIGNvbE0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdFx0XHJcblx0XHRidWZmZXJOb2RlLm9uKCdidWZmZXItaW5pdGlhbCcsICgpID0+IHtcclxuXHRcdFx0Ly8gY2xlYXJCdWZmZXJMb2NrTm9kZSgpO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB1cGRhdGVCb3hTaXplKCkge1xyXG5cdFx0dmFyIHZpc2libGVMb2NrQ29sc1dpZHRoID0gdmlzaWJsZUxvY2tDb2x1bW4uZ2V0V2lkdGgoKTtcclxuXHRcdGhlYWRlci4kaGVhZGVyLmNzcygncGFkZGluZy1sZWZ0JywgLXZpc2libGVMb2NrQ29sc1dpZHRoKTtcclxuXHRcdCRkb20uY2FudmFzLmNzcygnbWFyZ2luLWxlZnQnLCAtdmlzaWJsZUxvY2tDb2xzV2lkdGgpO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHtcclxuXHRcdHZpc2libGVMb2NrQ29sdW1uLFxyXG5cdFx0c2V0TG9ja0NvbHVtblgoc2Nyb2xsTGVmdCkge1xyXG5cdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5lYWNoKGNvbE0gPT4gY29sTS5maXJlKCdzY3JvbGwteCcsIHNjcm9sbExlZnQpKTtcclxuXHRcdH0sXHJcblxyXG5cdFx0YWRkQnVmZmVyTG9ja05vZGUocm93Tm9kZXMpIHtcclxuXHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4uZWFjaChjb2xNID0+IHtcclxuXHRcdFx0XHRyb3dOb2Rlcy5mb3JFYWNoKHJvd05vZGVzID0+IHtcclxuXHRcdFx0XHRcdGxldCBjb2xFbGUgPSBoZWFkZXIuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cdFx0XHRcdFx0bGV0IGNlbGxFbGVtZW50ID0gcm93Tm9kZXMuY2hpbGRyZW4uZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0XHRcdGNlbGxFbGVtZW50LmNzcygnbGVmdCcsICRkb20udmlld3BvcnQuc2Nyb2xsTGVmdCgpICsgY29sTS5hd2F5RnJvbUxlZnQpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0sXHJcblxyXG5cdFx0Y2xlYXJCdWZmZXJMb2NrTm9kZSgpIHtcclxuXHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4uY2xlYXIoKTtcclxuXHRcdH1cclxuXHJcblx0fTtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gTG9ja0NvbE1hbmFnZXI7IiwiLy8gVE9ET1xyXG52YXIgZGVib3VuY2UgPSBmdW5jdGlvbihmbiwgdGltZSkge1xyXG5cdHZhciB0aW1lciA9IG51bGw7XHJcblx0cmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcclxuXHRcdGlmICh0aW1lcikgY2xlYXJUaW1lb3V0KHRpbWVyKTtcclxuXHJcblx0XHR0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG5cdFx0XHRmbi5hcHBseShudWxsLCBhcmdzKTtcclxuXHRcdH0sIHRpbWUpO1xyXG5cdH1cclxufVxyXG5cclxuLy/op6PlhrNyZXF1ZXN0QW5pbWF0aW9uRnJhbWXlhbzlrrnpl67pophcclxudmFyIHJhRnJhbWUgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XHJcbiAgICAgICAgICAgICAgd2luZG93LndlYmtpdFJlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxyXG4gICAgICAgICAgICAgIHdpbmRvdy5tb3pSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcclxuICAgICAgICAgICAgICB3aW5kb3cub1JlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxyXG4gICAgICAgICAgICAgIHdpbmRvdy5tc1JlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxyXG4gICAgICAgICAgICAgIGZ1bmN0aW9uKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KGNhbGxiYWNrLCAxMDAwIC8gNjApO1xyXG4gICAgICAgICAgICAgIH07XHJcblxyXG4vL+afr+mHjOWMluWwgeijhVxyXG52YXIgdGhyb3R0bGUgPSBmdW5jdGlvbihmbikge1xyXG4gICAgbGV0IGlzTG9ja2VkO1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcclxuXHJcbiAgICAgICAgaWYoaXNMb2NrZWQpIHJldHVybiBcclxuXHJcbiAgICAgICAgaXNMb2NrZWQgPSB0cnVlO1xyXG4gICAgICAgIHJhRnJhbWUoKCkgPT4ge1xyXG4gICAgICAgICAgICBpc0xvY2tlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICBmbi5hcHBseSh0aGlzLCBhcmdzKVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59O1xyXG5cclxuY2xhc3MgU2Nyb2xsZXIge1xyXG5cdGNvbnN0cnVjdG9yKGxpbmVIZWlnaHQsIGJ1ZmZlclpvbmUpIHtcclxuXHJcblx0XHR0aGlzLmJ1ZmZlclpvbmUgPSBidWZmZXJab25lO1xyXG5cdFx0dGhpcy55RGlyID0gMDsgLy8gMTrlkJHkuIrvvIwwLC0xOuWQkeS4i1xyXG5cdFx0dGhpcy55UHJlSW5kZXggPSAwOyAvLyDkuIrkuIDkuKrkvY3nva5cclxuXHRcdHRoaXMubGluZUhlaWdodCA9IGxpbmVIZWlnaHQ7XHJcblxyXG5cdFx0dGhpcy54RGlyID0gMDsgLy8gMe+8muWQkeW3pu+8jDDvvIwtMe+8muWQkeWPs1xyXG5cdFx0dGhpcy54UHJlSW5kZXggPSAwOyAvLyDliY3kuIDkuKrkvY3nva5cclxuXHJcblx0XHR0aGlzLl90cmlnZ2VyWCA9IHggPT4geDtcclxuXHRcdHRoaXMuX3RyaWdnZXJZID0geSA9PiB5O1xyXG5cclxuXHR9XHJcblxyXG5cdG9uWChjYWxsYmFjaykge1xyXG5cdFx0dGhpcy5fdHJpZ2dlclggPSB4ID0+IHtcclxuXHRcdFx0aWYgKHggPT09IHRoaXMueFByZUluZGV4KSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLnhEaXIgPSB4IC0gdGhpcy54UHJlSW5kZXg7XHJcblx0XHRcdHRoaXMueFByZUluZGV4ID0geDtcclxuXHJcblx0XHRcdGNhbGxiYWNrKHgpO1xyXG5cdFx0fTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdG9uWShoYW5kbGVyLCBkZWxheSkge1xyXG5cdFx0Ly8gVE9ET1xyXG5cdFx0Ly8gdmFyIGRlYWx5Rm4gPSBkZWJvdW5jZShoYW5kbGVyLCBkZWxheSk7XHJcblxyXG5cdFx0dGhpcy5fdHJpZ2dlclkgPSBkZWJvdW5jZSgoeSkgPT4ge1xyXG5cdFx0XHR0aGlzLnlEaXIgPSB5IC0gdGhpcy55UHJlSW5kZXg7XHJcblx0XHRcdHRoaXMueVByZUluZGV4ID0geTtcclxuXHJcblx0XHRcdHZhciBpbmRleCA9IH5+KHkvIHRoaXMubGluZUhlaWdodCk7XHJcblx0XHRcdHZhciB3aWxsTG9hZCA9IHRoaXMuYnVmZmVyWm9uZS5zaG91bGRMb2FkKHRoaXMueURpciwgaW5kZXgpO1xyXG5cclxuXHRcdFx0aWYgKHdpbGxMb2FkKSB7XHJcblx0XHRcdFx0Ly8gZGVhbHlGbigpO1xyXG5cdFx0XHRcdGhhbmRsZXIoXHJcblx0XHRcdFx0XHR0aGlzLnlEaXIgPiAwID8gMSA6IC0xLFxyXG5cdFx0XHRcdFx0dGhpcy5idWZmZXJab25lLmRvbWFpbixcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS5zdGFydCxcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS5lbmQsXHJcblx0XHRcdFx0XHRpbmRleCxcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS50b3RhbFxyXG5cdFx0XHRcdCk7XHJcblx0XHRcdH1cclxuXHRcdH0sIGRlbGF5KTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdGZpcmVYKHgpIHtcclxuXHRcdHRoaXMuX3RyaWdnZXJYKHgpO1xyXG5cdH1cclxuXHJcblx0ZmlyZVkoeSkge1xyXG5cdFx0dGhpcy5fdHJpZ2dlclkoeSk7XHJcblx0fVxyXG5cclxuXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU2Nyb2xsZXI7IiwidmFyIFNlbGVjdGlvbiA9IHJlcXVpcmUoJy4vU2VsZWN0aW9uJyk7XHJcbnZhciBNZW51ID0gcmVxdWlyZSgnLi4vcGx1Z2luL01lbnUnKTtcclxudmFyICQgID0gcmVxdWlyZSgnLi4vdXRpbC9zaGltJykuJDtcclxuXHJcbmNvbnN0IGRlZkhlYWRlckNvbnRleHRNZW51ID0gW3sgXHJcblx0XHR0ZXh0OiAn5Ya757uTJywgXHJcblx0XHRoYW5kbGVyOiBmdW5jdGlvbihpbmZvLCBjb250ZXh0LCBldnQpIHtcclxuXHRcdFx0aW5mby5jb2x1bW4ubG9jaygpO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0dGV4dDogJ+ino+WGuycsIFxyXG5cdFx0aGFuZGxlcjogZnVuY3Rpb24oaW5mbywgY29udGV4dCwgZXZ0KSB7IFxyXG5cdFx0XHRpbmZvLmNvbHVtbi51bkxvY2soKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdHNlcGFyYXRvcjogdHJ1ZSBcclxuXHR9LCB7IFxyXG5cdFx0dGV4dDogJ+aYvuekuicsIFxyXG5cdFx0aGFuZGxlcjogZnVuY3Rpb24oaW5mbywgY29udGV4dCwgZXZ0KSB7IFxyXG5cdFx0XHRpbmZvLmNvbHVtbi5zaG93KCk7XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHR0ZXh0OiAn6ZqQ6JePJywgXHJcblx0XHRoYW5kbGVyOiBmdW5jdGlvbihpbmZvLCBjb250ZXh0LCBldnQpIHsgXHJcblx0XHRcdGluZm8uY29sdW1uLmhpZGUoKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdHRleHQ6ICflrprkvY0nLCBcclxuXHRcdGRpc2FibGVkOiB0cnVlLFxyXG5cdFx0aGFuZGxlcjogZnVuY3Rpb24oaW5mbywgY29udGV4dCwgZXZ0KSB7IFxyXG5cdFx0XHQvLyBUT0RPXHJcblx0XHRcdGNvbnRleHQuc2Nyb2xsVG9Ub3AoTWF0aC5yYW5kb20oKSAqIDMwMDAwKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdHRleHQ6ICfpgInkuK3mlbTliJcnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IFxyXG5cdFx0XHQvLyBhbGVydChzZWxmLnN0b3JlLnNpemUoKSk7XHJcblx0XHRcdGNvbnRleHQuX3N0YXJ0ID0gW2luZm8uY29sdW1uLmRhdGFJbmRleCwgMF07XHJcblx0XHRcdGNvbnRleHQuX2VuZCA9IFtpbmZvLmNvbHVtbi5kYXRhSW5kZXgsIGNvbnRleHQuc3RvcmUuc2l6ZSgpIC0gMV07XHJcblxyXG5cdFx0XHRjb250ZXh0LnNlbGVjdGlvblJhbmdlKGNvbnRleHQuX3N0YXJ0LCBjb250ZXh0Ll9lbmQpO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0Y2xzOiAnbnVtYmVyLWNvbHVtbicsXHJcblx0XHR0ZXh0OiAn57uf6K6h5oC75pWwJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBcclxuXHRcdFx0YWxlcnQoY29udGV4dC5zdG9yZS5zaXplKCkpO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0Y2xzOiAnbnVtYmVyLWNvbHVtbicsXHJcblx0XHR0ZXh0OiAn5rGC5ZKMJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkge1xyXG5cdFx0XHRhbGVydChjb250ZXh0LnN0b3JlLnNpemUoKSk7XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHRjbHM6ICdudW1iZXItY29sdW1uJyxcclxuXHRcdHRleHQ6ICfmnIDlpKflgLwnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7XHJcblx0XHRcdGFsZXJ0KGNvbnRleHQuc3RvcmUuc2l6ZSgpKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdGNsczogJ251bWJlci1jb2x1bW4nLFxyXG5cdFx0dGV4dDogJ+acgOWwj+WAvCcsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHtcclxuXHRcdFx0YWxlcnQoY29udGV4dC5zdG9yZS5zaXplKCkpO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0Y2xzOiAnbnVtYmVyLWNvbHVtbicsXHJcblx0XHR0ZXh0OiAn5pa55beuJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkge1xyXG5cdFx0XHRhbGVydChjb250ZXh0LnN0b3JlLnNpemUoKSk7XHJcblx0XHR9IFxyXG5cdH1dO1xyXG5cclxuY29uc3QgZGVmQ2VsbENvbnRleHRNZW51ID0gW3tcclxuXHRcdHRleHQ6ICdsb2NrIHJvdyB0byB0b3AnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IGNvbnNvbGUubG9nKGNvbnRleHQuX3NlbGVjdGlvbik7IH0gXHJcblx0fSx7IFxyXG5cdFx0dGV4dDogJ2xvY2sgcm93IHRvIGJvdHRvbScsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgY29uc29sZS5sb2coY29udGV4dC5fc2VsZWN0aW9uKTsgfSBcclxuXHR9LHsgXHJcblx0XHR0ZXh0OiAnc2VhcmNoJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBjb25zb2xlLmxvZyhjb250ZXh0Ll9zZWxlY3Rpb24pOyB9IFxyXG5cdH0seyBcclxuXHRcdHRleHQ6ICdtYXJrJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBjb25zb2xlLmxvZyhjb250ZXh0Ll9zZWxlY3Rpb24pOyB9IFxyXG5cdH1dO1x0XHJcblxyXG5jb25zdCBkZWZTZWxlY3Rpb25Db250ZXh0TWVudSA9IFt7IFxyXG5cdFx0dGV4dDogJ+WkjeWIticsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgY29uc29sZS5sb2coaW5mbywgY29udGV4dC5fc2VsZWN0aW9uKTsgfSBcclxuXHR9LHsgXHJcblx0XHR0ZXh0OiAn5omT5Y2wJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBcclxuXHRcdFx0Y29uc29sZS5sb2coZXZ0LCBkYXRhLCBjb250ZXh0KTtcclxuXHRcdH0gXHJcblx0fSx7IFxyXG5cdFx0dGV4dDogJ+WvvOWHuicsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgY29uc29sZS5sb2coY29udGV4dC5fc2VsZWN0aW9uKTsgfSBcclxuXHR9LHsgXHJcblx0XHR0ZXh0OiAn5qCH6K6wJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBjb25zb2xlLmxvZyhjb250ZXh0Ll9zZWxlY3Rpb24pOyB9IFxyXG5cdH1dO1xyXG5cclxuXHJcbmNsYXNzIENvbnRleHRtZW51IGV4dGVuZHMgU2VsZWN0aW9uIHtcclxuXHRjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcblx0XHRzdXBlcihvcHRpb25zKTtcclxuXHJcblx0XHR0aGlzLmNlbGxDdHhNZW51ID0gb3B0aW9ucy5iaXpDb250ZXh0TWVudS5jZWxsO1xyXG5cclxuXHRcdHRoaXMuaGVhZGVyQ3R4TWVudSA9IHtcclxuXHRcdFx0YmVmb3JlOiBmdW5jdGlvbihpbmZvLCBldnQpIHtcclxuXHRcdFx0XHRpZiAoaW5mby5jb2x1bW4udnR5cGUgPT09ICdudW1iZXInKSB7XHJcblx0XHRcdFx0XHR0aGlzLmdldENscygnLm51bWJlci1jb2x1bW4nKS5zaG93KCk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRoaXMuZ2V0Q2xzKCcubnVtYmVyLWNvbHVtbicpLmhpZGUoKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHR9XHJcblx0XHR9O1xyXG5cdH1cclxuXHJcblx0X2JpbmRFdmVudCgpIHtcclxuXHRcdHN1cGVyLl9iaW5kRXZlbnQoKTtcclxuXHJcblx0XHRsZXQgc2VsZiA9IHRoaXM7XHJcblxyXG5cdFx0dGhpcy4kY29udGV4dG1lbnVIZWFkZXIgPSBuZXcgTWVudSh0aGlzLiRkb20ud3JhcHBlciwgeyBcclxuXHRcdFx0ZGF0YTogZGVmSGVhZGVyQ29udGV4dE1lbnUsIFxyXG5cdFx0XHRjb250ZXh0OiB0aGlzIFxyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kY29udGV4dG1lbnUgPSBuZXcgTWVudSh0aGlzLiRkb20uYm9keSwgeyBcclxuXHRcdFx0ZGF0YTogW10sIFxyXG5cdFx0XHRjb250ZXh0OiB0aGlzIFxyXG5cdFx0fSk7XHJcblx0XHRcclxuXHRcdHRoaXMuJGRvbS53cmFwcGVyXHJcblx0XHRcdC5vbignY29udGV4dG1lbnUnLCAnLmMtaGVhZGVyLWNlbGwnLCBcclxuXHRcdFx0XHR0aGlzLl9oZWFkZXJDb250ZXh0TWVudS5iaW5kKHRoaXMpXHJcblx0XHRcdCk7XHJcblxyXG5cdFx0dGhpcy4kZG9tLmJvZHlcclxuXHRcdFx0Lm9uKCdjb250ZXh0bWVudScsICcuYy1ncmlkLWNlbGwnLCBcclxuXHRcdFx0XHR0aGlzLl9jZWxsQ29udGV4dE1lbnUuYmluZCh0aGlzLCBkZWZDZWxsQ29udGV4dE1lbnUpXHJcblx0XHRcdClcclxuXHRcdFx0Lm9uKCdjb250ZXh0bWVudScsICcuYy1jZWxsLXNlbGVjdGVkJywgXHJcblx0XHRcdFx0dGhpcy5fY2VsbENvbnRleHRNZW51LmJpbmQodGhpcywgZGVmU2VsZWN0aW9uQ29udGV4dE1lbnUpXHJcblx0XHRcdCk7XHJcblx0fVxyXG5cclxuXHRfaGVhZGVyQ29udGV4dE1lbnUoZXZ0KSB7XHJcblx0XHRsZXQgY29sTSA9ICQoZXZ0LnRhcmdldCkuZGF0YSgnY29sdW1uJyk7XHJcblx0XHRsZXQgbWVudSA9IHRoaXMuJGNvbnRleHRtZW51SGVhZGVyO1xyXG5cclxuXHRcdGxldCBpbmZvID0geyBcclxuXHRcdFx0J2RhdGFJbmRleCc6IGNvbE0uZGF0YUluZGV4LCBcclxuXHRcdFx0J2NvbHVtbic6IGNvbE0sXHJcblx0XHRcdCdjb250ZXh0JzogbWVudVxyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuZmlyZSgnaGVhZGVyLWNvbnRleHRtZW51JywgaW5mbywgZXZ0KTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKGluZm8pO1xyXG5cclxuXHRcdGlmICh0aGlzLmhlYWRlckN0eE1lbnUuYmVmb3JlLmNhbGwobWVudSwgaW5mbywgZXZ0KSkge1xyXG5cdFx0XHRcclxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHRtZW51LnNldEluZm8oaW5mbyk7XHJcblx0XHRcdG1lbnUuc2hvd0F0KGV2dCk7XHJcblx0XHRcclxuXHRcdFx0ZG9jRXZlbnQobWVudSk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRfY2VsbENvbnRleHRNZW51KGRlZkN0eE1lbnUsIGV2dCkge1xyXG5cdFx0bGV0ICRjZWxsID0gJChldnQudGFyZ2V0KTtcclxuXHRcdGxldCBkYXRhSW5kZXggPSAkY2VsbC5kYXRhKCdkYXRhSW5kZXgnKTtcclxuXHRcdGxldCByb3dudW1iZXIgPSArJGNlbGwucGFyZW50KCcuYy1ncmlkLXJvdycpLmF0dHIoJ3JpZCcpO1xyXG5cdFx0bGV0IG1lbnUgPSB0aGlzLiRjb250ZXh0bWVudTtcclxuXHJcblx0XHRsZXQgaW5mbyA9IHsgXHJcblx0XHRcdCd2YWx1ZSc6ICRjZWxsLnRleHQoKSxcclxuXHRcdFx0J2RhdGFJbmRleCc6IGRhdGFJbmRleCwgXHJcblx0XHRcdCdyb3dudW1iZXInOiByb3dudW1iZXIsXHJcblx0XHRcdCdjb250ZXh0JzogbWVudVxyXG5cdFx0fTtcclxuXHJcblx0XHR0aGlzLmZpcmUoJ2NlbGwtY29udGV4dG1lbnUnLCBpbmZvLCBldnQpO1xyXG5cdFx0Ly8gY29uc29sZS5sb2coaW5mbyk7XHJcblxyXG5cdFx0aWYgKHRoaXMuY2VsbEN0eE1lbnUuYmVmb3JlLmNhbGwobWVudSwgaW5mbywgZXZ0KSkge1xyXG5cclxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHRtZW51LnNldEluZm8oaW5mbyk7XHJcblx0XHRcdG1lbnUudXBkYXRlKGRlZkN0eE1lbnUuY29uY2F0KG1lbnUuZ2V0RGF0YSgpKSk7XHJcblx0XHRcdFxyXG5cdFx0XHRtZW51LnNob3dBdChldnQpO1xyXG5cdFx0XHJcblx0XHRcdGRvY0V2ZW50KG1lbnUpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHtcclxuXHRcdHN1cGVyLmRlc3RvcnkoKTtcclxuXHJcblx0XHR0aGlzLiRjb250ZXh0bWVudUhlYWRlci5kZXN0b3J5KCk7XHJcblx0XHR0aGlzLiRjb250ZXh0bWVudS5kZXN0b3J5KCk7XHJcblx0XHR0aGlzLmNlbGxDdHhNZW51ID0gbnVsbDtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGRvY0V2ZW50KCRjb250ZXh0bWVudSkge1xyXG5cdCQoZG9jdW1lbnQpLm9uKCdtb3VzZXVwLmNvbnRleHRtZW51Jywgb25Nb3VzZURvd24uYmluZChudWxsLCAkY29udGV4dG1lbnUpKTtcclxufVxyXG5cclxuZnVuY3Rpb24gb25Nb3VzZURvd24oJGNvbnRleHRtZW51KXtcclxuICAgICRjb250ZXh0bWVudS5oaWRlKCk7XHJcbiAgICAkKGRvY3VtZW50KS5vZmYoJ21vdXNldXAuY29udGV4dG1lbnUnKTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDb250ZXh0bWVudTsiLCJ2YXIgR3JpZFZpZXcgPSByZXF1aXJlKCcuLi9jb3JlL0dyaWRWaWV3Jyk7XHJcblxyXG5jb25zdCBDRUxMX0NMUyA9ICdsaS5jLWdyaWQtY2VsbCc7XHJcbmNvbnN0IENFTExfU0VMRUNURURfQ0xTID0gJ2MtY2VsbC1zZWxlY3RlZCc7XHJcbmNvbnN0IFJPV19DTFMgPSAnLmMtZ3JpZC1yb3cnO1xyXG5cclxuY2xhc3MgU2VsZWN0aW9uIGV4dGVuZHMgR3JpZFZpZXcge1xyXG5cclxuXHRjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcblx0XHRzdXBlcihvcHRpb25zKTtcclxuXHJcblx0XHR0aGlzLl9kZWZhdWx0cygpO1xyXG5cdH1cclxuXHJcblx0X2RlZmF1bHRzKCkge1xyXG5cdFx0dGhpcy5fbW92aW5nID0gZmFsc2U7XHJcblx0XHR0aGlzLl9zdGFydCA9IG51bGw7XHJcblx0XHR0aGlzLl9lbmQgPSBudWxsO1xyXG5cdFx0dGhpcy5fbGFzdFkgPSBudWxsO1xyXG5cdFx0dGhpcy5fc2VsZWN0aW9uID0gW107XHJcblx0XHR0aGlzLl9zZWxlY3RZID0gW107XHJcblx0XHR0aGlzLl9zZWxlY3REYXRhSW5kZXggPSBbXTtcclxuXHR9XHJcblx0XHJcblx0X2JpbmRFdmVudCgpIHtcclxuXHRcdHN1cGVyLl9iaW5kRXZlbnQoKTtcclxuXHJcblx0XHRsZXQgc2VsZiA9IHRoaXM7XHJcblxyXG5cdFx0dGhpcy5jb2x1bW5Nb2RlbC5vbignbm90aWNlLWNvbE1vZGVsLXNvcnQtY2hhbmdlZCcsICgpID0+IHtcclxuXHRcdFx0dGhpcy5fZGVmYXVsdHMoKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuJGRvbS5jYW52YXNcclxuXHRcdFx0Lm9uKCdtb3VzZWRvd24nLCBDRUxMX0NMUywgZnVuY3Rpb24oZXZ0KSB7XHJcblx0XHRcdFx0aWYgKGV2dC5idXR0b24gPT09IDApIHtcclxuXHRcdFx0XHRcdHNlbGYuJGRvbS5jYW52YXMuZmluZChDRUxMX0NMUykucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHRcdFx0c2VsZi5fbW92aW5nID0gdHJ1ZTtcclxuXHRcdFx0XHRcdGxldCAkY2VsbCA9ICQodGhpcykuYWRkQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHRcdFx0c2VsZi5fc3RhcnQgPSBzZWxmLl9lbmQgPSBbJGNlbGwuZGF0YSgnZGF0YUluZGV4JyksICskY2VsbC5wYXJlbnQoUk9XX0NMUykuYXR0cigncmlkJyldO1xyXG5cdFx0XHRcdFx0Ly8gY29uc29sZS5sb2coc3RhcnQpO1xyXG5cdFx0XHRcdH0gXHJcblx0XHRcdFx0ZWxzZSBpZiAoZXZ0LmJ1dHRvbiA9PT0gMikge1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KVxyXG5cdFx0XHQub24oJ21vdXNlZW50ZXInLCBDRUxMX0NMUywgZnVuY3Rpb24oZXZ0KSB7XHJcblx0XHRcdFx0aWYgKHNlbGYuX21vdmluZykge1xyXG5cdFx0XHRcdFx0bGV0ICRjZWxsID0gJCh0aGlzKTtcclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0JGNlbGwuYWRkQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHRcdFx0c2VsZi5fZW5kID0gWyRjZWxsLmRhdGEoJ2RhdGFJbmRleCcpLCArJGNlbGwucGFyZW50KFJPV19DTFMpLmF0dHIoJ3JpZCcpXTtcclxuXHJcblx0XHRcdFx0XHRzZWxmLnNlbGVjdGlvblJhbmdlKHNlbGYuX3N0YXJ0LCBzZWxmLl9lbmQpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSlcclxuXHRcdFx0Lm9uKCdtb3VzZXVwJywgZnVuY3Rpb24oZXZ0KSB7XHJcblx0XHRcdFx0c2VsZi5fbW92aW5nID0gZmFsc2U7XHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coZW5kKTtcclxuXHRcdFx0XHRjb25zb2xlLmxvZyhzZWxmLl9zZWxlY3Rpb24pO1xyXG5cdFx0XHRcdC8vIFRPRE9cclxuXHRcdFx0XHQvLyBjb3B5KCQoJy5jZWxsLnNlbGVjdGVkJykpO1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmJ1ZmZlck5vZGUub24oJ3Jvdy11cGRhdGUtYmVmb3JlJywgKHJvd05vZGUsIHJvdykgPT4ge1xyXG5cdFx0XHQvLyBjb25zb2xlLmxvZyhyb3dOb2RlLiRub2RlLCByb3cucmlkLCB0aGlzLl9zZWxlY3RZKTtcclxuXHJcblx0XHRcdGlmICh0aGlzLl9zZWxlY3Rpb24ubGVuZ3RoID09PSAwKSByZXR1cm4gZmFsc2U7XHJcblx0XHRcdFxyXG5cdFx0XHRsZXQgaSA9IHJvdy5yaWQ7XHJcblx0XHRcdGxldCBbeTAsIHkxXSA9IHRoaXMuX3NlbGVjdFk7XHJcblx0XHRcdGxldCBjb2xzID0gdGhpcy5fc2VsZWN0RGF0YUluZGV4O1xyXG5cclxuXHRcdFx0aWYgKGkgPj0geTAgJiYgaSA8IHkxICsgMSkge1xyXG5cdFx0XHRcdGNvbHMuZm9yRWFjaCgoY29sKSA9PiB7XHJcblx0XHRcdFx0XHRyb3dOb2RlLmNoaWxkcmVuLmZvckVhY2goKCRjZWxsLCBjb2xNKSA9PiB7XHJcblx0XHRcdFx0XHRcdGlmIChjb2xzLmluZGV4T2YoY29sTS5kYXRhSW5kZXgpICE9IC0xKSB7XHJcblx0XHRcdFx0XHRcdFx0JGNlbGwuYWRkQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdCRjZWxsLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKVxyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRyb3dOb2RlLiRub2RlLmZpbmQoQ0VMTF9DTFMpLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdH0pO1xyXG5cdFx0XHJcblx0fVxyXG5cclxuXHRzZWxlY3Rpb25SYW5nZShbeDAsIHkwXSwgW3gxLCB5MV0pIHtcclxuXHJcblx0XHRsZXQgeURpciA9IHkxIC0geTA7XHJcblx0XHRsZXQgbGFzdFkgPSB0aGlzLl9sYXN0WTtcclxuXHRcdFx0XHJcblx0XHQvLyB5UmFuZ2UgPSB7IGxhc3Q6ICwgbm93OiBbeTAsIHkxXSB9O1xyXG5cdFx0Ly8gW2wwLCBsMV1cclxuXHRcdC8vIFt5MCwgeTFdXHJcblx0XHQvLyBbbDAsIGwxXVxyXG5cdFx0bGV0IHJlbW92ZVlSYW5nZSA9IFtdO1xyXG5cdFx0Ly8gZG93blxyXG5cdFx0aWYgKHlEaXIgPj0gMCAmJiB5MSA8IGxhc3RZKSB7XHJcblx0XHRcdHJlbW92ZVlSYW5nZSA9IFt5MSwgbGFzdFldO1xyXG5cdFx0fVxyXG5cdFx0Ly8gdXBcclxuXHRcdGlmICh5RGlyIDw9IDAgJiYgeTEgPiBsYXN0WSkge1xyXG5cdFx0XHRyZW1vdmVZUmFuZ2UgPSBbbGFzdFksIHkxXTtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0dGhpcy5fbGFzdFkgPSB5MTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKHlEaXIsIHJlbW92ZVlSYW5nZSk7XHJcblxyXG5cdFx0bGV0IGRhdGFJbmRleCA9IHRoaXMuZ2V0TG9ja0FuZFZpc2lhYmxlQ29sdW1uQXNEYXRhSW5kZXgoKTtcclxuXHRcdFt4MCwgeTAsIHgxLCB5MV0gPSBvcmRlckJ5KHgwLCB5MCwgeDEsIHkxLCBkYXRhSW5kZXgpO1xyXG5cclxuXHJcblx0XHRsZXQgY29scyA9IHRoaXMuX3NlbGVjdERhdGFJbmRleCA9IGRhdGFJbmRleC5zbGljZShkYXRhSW5kZXguaW5kZXhPZih4MCksIGRhdGFJbmRleC5pbmRleE9mKHgxKSsxKTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKGNvbHMpO1xyXG5cclxuXHRcdHRoaXMuX3NlbGVjdFkgPSBbeTAsIHkxICsgMV07XHJcblx0XHRsZXQgcm93cyA9IHRoaXMuc3RvcmUuc2xpY2UoeTAsIHkxICsgMSk7XHJcblxyXG5cdFx0dGhpcy5fc2VsZWN0aW9uID0gcm93cy5tYXAocm93ID0+IHtcclxuXHRcdFx0cmV0dXJuIGNvbHMubWFwKGNvbCA9PiByb3cuZGF0YVtjb2xdKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuX3JlUGFpbnROb2RlKHlEaXIsIHkwLCB5MSwgcmVtb3ZlWVJhbmdlLCBjb2xzKTtcclxuXHR9XHJcblxyXG5cdF9yZVBhaW50Tm9kZSh5RGlyLCB5MCwgeTEsIHJlbW92ZVlSYW5nZSwgY29scykge1xyXG5cdFx0bGV0IG5vZGVMaXN0ID0gdGhpcy5idWZmZXJOb2RlLmdldE5vZGVMaXN0KCk7XHJcblx0XHRub2RlTGlzdC5mb3JFYWNoKChyb3dOb2RlKSA9PiB7XHJcblx0XHRcdGxldCAkcm93ID0gcm93Tm9kZS4kbm9kZTtcclxuXHRcdFx0bGV0IGkgID0gKyRyb3cuYXR0cigncmlkJyk7XHJcblx0XHRcdFxyXG5cdFx0XHRpZiAoaSA+PSB5MCAmJiBpIDwgeTEgKyAxKSB7XHJcblx0XHRcdFx0Y29scy5mb3JFYWNoKChjb2wpID0+IHtcclxuXHRcdFx0XHRcdHJvd05vZGUuY2hpbGRyZW4uZm9yRWFjaCgoJGNlbGwsIGNvbE0pID0+IHtcclxuXHRcdFx0XHRcdFx0aWYgKGNvbHMuaW5kZXhPZihjb2xNLmRhdGFJbmRleCkgIT0gLTEpIHtcclxuXHRcdFx0XHRcdFx0XHQkY2VsbC5hZGRDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0JGNlbGwucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpXHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoeURpciA+PSAwICYmIGkgPiByZW1vdmVZUmFuZ2VbMF0gJiYgaSA8PXJlbW92ZVlSYW5nZVsxXSApIHtcclxuXHRcdFx0XHQkcm93LmZpbmQoQ0VMTF9DTFMpLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoeURpciA8PSAwICYmIGkgPj0gcmVtb3ZlWVJhbmdlWzBdICYmIGkgPHJlbW92ZVlSYW5nZVsxXSApIHtcclxuXHRcdFx0XHQkcm93LmZpbmQoQ0VMTF9DTFMpLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0LypcclxuXHQgKiBsb2NrICsgdmlzaWFibGUgPSBjb2x1bW5zXHJcblx0ICogQHBhcmFtIHtBcnJheX0gY29sdW1ucyAtW2RhdGFJbmRleC4uLl1cclxuXHQgKi9cclxuXHRnZXRMb2NrQW5kVmlzaWFibGVDb2x1bW5Bc0RhdGFJbmRleCgpIHtcclxuXHRcdGxldCBjb2xzID0gW107XHJcblxyXG5cdFx0dGhpcy5sb2NrQ29sTWFuYWdlclxyXG5cdFx0XHQudmlzaWJsZUxvY2tDb2x1bW5cclxuXHRcdFx0LmVhY2goY29sTSA9PiBjb2xzLnVuc2hpZnQoY29sTS5kYXRhSW5kZXgpKTtcclxuXHJcblx0XHRsZXQgdmlzaWFibGVDb2xzID0gdGhpcy5jb2x1bW5Nb2RlbFxyXG5cdFx0XHQuZ2V0VmlzaWJsZUNvbHVtbigpXHJcblx0XHRcdC5tYXAoY29sTSA9PiBjb2xNLmRhdGFJbmRleClcclxuXHRcdFx0LmZpbHRlcihkYXRhSW5kZXggPT4gY29scy5pbmRleE9mKGRhdGFJbmRleCkgPT0gLTEpO1xyXG5cclxuXHRcdHJldHVybiBjb2xzLmNvbmNhdCh2aXNpYWJsZUNvbHMpO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHtcclxuXHRcdHN1cGVyLmRlc3RvcnkoKTtcclxuXHJcblx0XHR0aGlzLl9kZWZhdWx0cygpO1xyXG5cdH1cclxuXHJcbn1cclxuXHJcblxyXG5mdW5jdGlvbiBzd2FwKGEsIGIpIHtcclxuXHRyZXR1cm4gW2IsIGFdO1xyXG59XHJcblxyXG5mdW5jdGlvbiBvcmRlckJ5KHgwLCB5MCwgeDEsIHkxLCBkYXRhSW5kZXgpIHtcclxuXHRpZiAoZGF0YUluZGV4LmluZGV4T2YoeDApID4gZGF0YUluZGV4LmluZGV4T2YoeDEpKSB7XHJcblx0XHRbeDAsIHgxXSA9IHN3YXAoeDAsIHgxKTtcclxuXHR9XHJcblx0aWYgKHkwID4geTEpIHtcclxuXHRcdFt5MCwgeTFdID0gc3dhcCh5MCwgeTEpO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIFt4MCwgeTAsIHgxLCB5MV07XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU2VsZWN0aW9uOyIsIi8vIGV4cG9ydHMuR3JpZFN0b3JlID0gcmVxdWlyZSgnLi9jb3JlL0dyaWRTdG9yZScpO1xyXG4vLyBleHBvcnRzLkdyaWRWaWV3ID0gcmVxdWlyZSgnLi9jb3JlL0dyaWRWaWV3Jyk7XHJcbi8vIG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9leHRlbmRzL1NlbGVjdGlvbicpO1xyXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vZXh0ZW5kcy9Db250ZXh0bWVudScpO1xyXG5cclxuLy8gZXhwb3J0IHsgZGVmYXVsdCB9IGZvcm0gJy4vcGx1Z2luL0NvbnRleHRtZW51JztcclxuIiwidmFyICQgPSByZXF1aXJlKCcuLi91dGlsL3NoaW0nKS4kO1xyXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuLi91dGlsL1V0aWxzJyk7XHJcblxyXG5cclxuY2xhc3MgTWVudSB7XHJcblx0Y29uc3RydWN0b3IoJHdyYXBwZXIsIHsgZGF0YSwgY29udGV4dCB9KSB7XHJcblx0XHR0aGlzLnBhcmFtcyA9IHt9O1xyXG5cdFx0dGhpcy4kbWVudSA9ICQobnVsbCk7XHJcblx0XHR0aGlzLiR3cmFwcGVyID0gJHdyYXBwZXI7XHJcblx0XHR0aGlzLl9kYXRhID0gZGF0YSB8fCBbXTtcclxuXHRcdHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XHJcblxyXG5cdFx0dGhpcy51cGRhdGUoZGF0YSk7XHJcblx0fVxyXG5cclxuXHR1cGRhdGUoZGF0YSkge1xyXG5cdFx0dGhpcy4kbWVudS5yZW1vdmUoKTsgLy8gVE9ETyDkvJjljJblpI3nlKjoioLngrlcclxuXHRcdFxyXG5cdFx0aWYgKEFycmF5LmlzQXJyYXkoZGF0YSkgJiYgZGF0YS5sZW5ndGggPiAwKSB7XHJcblx0XHRcdHRoaXMuJG1lbnUgPSBjb21waWxlTWVudShkYXRhLCB0aGlzKTtcclxuXHJcblx0XHRcdHRoaXMuJHdyYXBwZXIuYXBwZW5kKHRoaXMuJG1lbnUpO1xyXG5cclxuXHRcdFx0dGhpcy5fZGF0YSA9IGRhdGE7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aGlzLl9kYXRhID0gW107XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRtZXJnZShkYXRhKSB7XHJcblx0XHR0aGlzLl9kYXRhID0gdGhpcy5fZGF0YS5maWx0ZXIoaXRlbSA9PiB7XHJcblx0XHRcdHJldHVybiAhZGF0YS5pbmNsdWRlcyhpdGVtKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuX2RhdGEgPSBkYXRhLmNvbmNhdCh0aGlzLl9kYXRhKTtcclxuXHRcdHRoaXMudXBkYXRlKHRoaXMuX2RhdGEpO1xyXG5cdH1cclxuXHJcblx0c2V0SW5mbyhpbmZvKSB7XHJcblx0XHR0aGlzLiRpbmZvID0gaW5mbztcclxuXHR9XHJcblxyXG5cdGdldEluZm8oKSB7XHJcblx0XHRyZXR1cm4gdGhpcy4kaW5mbztcclxuXHR9XHJcblxyXG5cdGdldERhdGEoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fZGF0YTtcclxuXHR9XHJcblxyXG5cdGdldENscyhjbGFzc05hbWUpIHtcclxuXHRcdHJldHVybiB0aGlzLiRtZW51LmZpbmQoY2xhc3NOYW1lKTtcclxuXHR9XHJcblxyXG5cdHNob3dBdChldnQpIHtcclxuXHRcdGlmICghdGhpcy5fZGF0YS5sZW5ndGgpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGxldCB4ID0gZXZ0LmNsaWVudFggLSB0aGlzLiR3cmFwcGVyLm9mZnNldCgpLmxlZnQ7XHJcblx0XHRsZXQgeSA9IGV2dC5jbGllbnRZIC0gdGhpcy4kd3JhcHBlci5vZmZzZXQoKS50b3A7XHJcblxyXG5cdCAgICB0aGlzLiRtZW51XHJcblx0ICAgIFx0LmFkZENsYXNzKCdzaG93LW1lbnUnKVxyXG5cdCAgICBcdC5jc3MoeyAnbGVmdCc6IHggKyAncHgnLCAndG9wJzogeSArICdweCcgfSk7XHJcblx0fVxyXG5cclxuXHRoaWRlKCkge1xyXG5cdFx0dGhpcy4kbWVudS5yZW1vdmVDbGFzcygnc2hvdy1tZW51Jyk7XHJcblx0fVxyXG5cclxuXHRnZXREb20oKSB7XHJcblx0XHRyZXR1cm4gdGhpcy4kbWVudTtcclxuXHR9XHJcblxyXG5cdGRlc3RvcnkoKSB7XHJcblx0XHR0aGlzLiRtZW51LmVtcHR5KCk7XHJcblx0fVxyXG5cclxufVxyXG5cclxuXHJcbmNvbnN0IGVtcHR5Rm4gPSAoZXZ0KSA9PiB7IFxyXG5cdGV2dC5wcmV2ZW50RGVmYXVsdDtcclxuXHRyZXR1cm4gZmFsc2U7IFxyXG59O1xyXG5cclxuZnVuY3Rpb24gY29udmVydChpdGVtKSB7XHJcblx0bGV0IGRlZkl0ZW0gPSB7XHJcblx0XHQnaWQnOiAnY20taWQtJyArIERhdGUubm93KCksXHJcblx0XHQndGV4dCc6ICcnLFxyXG5cdFx0J2ljb25DbHMnOiAnJyxcclxuXHRcdCdoaWRkZW4nOiBmYWxzZSxcclxuXHRcdCdkaXNhYmxlZCc6IGZhbHNlLFxyXG5cdFx0J2hhbmRsZXInOiBmdW5jdGlvbigpIHt9XHJcblx0fTtcclxuXHJcblx0cmV0dXJuIE9iamVjdC5hc3NpZ24oZGVmSXRlbSwgaXRlbSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZUl0ZW0oaXRlbSwgdm0pIHtcclxuXHRsZXQgJGl0ZW0gPSAkKCc8bGkvPicpXHJcblx0XHRcdC5hdHRyKCdpZCcsIGl0ZW0uaWQpXHJcblx0XHRcdC5hZGRDbGFzcygnYy1tZW51LWl0ZW0nKVxyXG5cdFx0XHQuYWRkQ2xhc3MoaXRlbS5kaXNhYmxlZCA/ICdkaXNhYmxlZCc6ICcnKTtcclxuXHJcbiAgICBsZXQgJGJ1dHRvbiA9ICQoJzxidXR0b24vPicpLmFkZENsYXNzKCdjLW1lbnUtYnRuJylcclxuICAgIFx0XHQuYXBwZW5kKGA8aSBjbGFzcz1cImZhICR7aXRlbS5pY29uQ2xzfVwiPjwvaT5gKVxyXG4gICAgXHRcdC5hcHBlbmQoYDxzcGFuIGNsYXNzPVwiYy1tZW51LXRleHRcIj4ke2l0ZW0udGV4dH08L3NwYW4+YClcclxuICAgIFx0XHQub24oJ2NsaWNrJywgKGV2dCkgPT4ge1xyXG4gICAgXHRcdFx0aXRlbS5oYW5kbGVyLmNhbGwodm0sIHZtLmdldEluZm8oKSwgdm0uY29udGV4dCwgZXZ0KTtcclxuICAgIFx0XHR9KTtcclxuXHJcbiAgICByZXR1cm4gJGl0ZW0uYXBwZW5kKCRidXR0b24pO1xyXG59O1xyXG5cclxuZnVuY3Rpb24gY29tcGlsZU1lbnUobWVudXMsIHZtKSB7XHJcblx0aWYgKG1lbnVzICYmIG1lbnVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuICQobnVsbCk7XHJcblx0XHJcblx0bGV0ICRtZW51cyA9ICQoJzxtZW51Lz4nKS5hZGRDbGFzcygnYy1tZW51Jyk7XHJcblx0bGV0ICRtZW51U2VwYXJhdG9yID0gJCgnPGxpLz4nKS5hZGRDbGFzcygnYy1tZW51LXNlcGFyYXRvcicpO1xyXG5cdFxyXG5cdG1lbnVzLmZvckVhY2gobWVudSA9PiB7XHJcblx0XHRpZiAobWVudS5zZXBhcmF0b3IpIHtcclxuXHRcdFx0cmV0dXJuICRtZW51cy5hcHBlbmQoJG1lbnVTZXBhcmF0b3IpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGxldCAkbWVudSA9IGNyZWF0ZUl0ZW0oY29udmVydChtZW51KSwgdm0pO1xyXG5cdFx0bGV0IGNoaWxkcmVuO1xyXG5cclxuXHRcdGlmIChtZW51LmNoaWxkcmVuKSB7XHJcblx0XHRcdGNoaWxkcmVuID0gY29tcGlsZU1lbnUobWVudS5jaGlsZHJlbiwgdm0pO1xyXG5cclxuXHRcdFx0aWYgKGNoaWxkcmVuKSB7XHJcblx0XHRcdFx0JG1lbnUuYWRkQ2xhc3MoJ3N1Ym1lbnUnKS5hcHBlbmQoY2hpbGRyZW4pO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdCRtZW51cy5hcHBlbmQoJG1lbnUpO1xyXG5cdH0pO1xyXG5cclxuXHRyZXR1cm4gJG1lbnVzO1xyXG59XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBNZW51OyIsIid1c2Ugc3RyaWN0JztcclxuY29uc3QgJCA9IHJlcXVpcmUoJy4uL3V0aWwvc2hpbScpLiQ7XHJcblxyXG5jb25zdCBGTEVYTUlOV0lEVEggPSAzNTtcclxuXHJcbnZhciBkcmFnRHJvcCA9IGZ1bmN0aW9uKGV2dCwgb3B0cykge1xyXG5cdHZhciBkb2MgPSAkKGRvY3VtZW50KTtcclxuXHR2YXIgc2Nyb2xsTGVmdCA9IGRvY3VtZW50LmJvZHkuc2Nyb2xsTGVmdCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsTGVmdDtcclxuXHR2YXIgc2Nyb2xsVG9wID0gZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcDtcclxuXHR2YXIgbGVmdE9mZnNldCA9ICQoZXZ0LnRhcmdldCkub2Zmc2V0KCkubGVmdCAtIHNjcm9sbExlZnQ7XHJcblx0dmFyIGlYLCBpWSwgc3RhcnRYLCBlbmRYO1xyXG5cdHZhciBkcmFnZ2luZyA9IHRydWU7XHJcblxyXG5cdHN0YXJ0WCA9IGlYID0gZXZ0LmNsaWVudFggLSBzY3JvbGxMZWZ0O1xyXG5cdGlZID0gJChldnQudGFyZ2V0KS5vZmZzZXQoKS50b3AgLSBzY3JvbGxUb3A7XHJcblxyXG5cdG9wdHMub25EcmFnU3RhcnQoeyAneCc6IHN0YXJ0WCB9LCBvcHRzLiRlbGVtZW50KTtcclxuXHJcblx0ZG9jLm9uKCdtb3VzZW1vdmUuZHJhZ2Ryb3AnLCAkLnByb3h5KG1vdXNlbW92ZSwgdGhpcykpO1xyXG5cdGRvYy5vbignbW91c2V1cC5kcmFnZHJvcCcsICQucHJveHkobW91c2V1cCwgdGhpcykpO1xyXG5cdC8vICQoZXZ0LnRhcmdldClbMF0uc2V0Q2FwdHVyZSAmJiAkKGV2dC50YXJnZXQpWzBdLnNldENhcHR1cmUoKTtcclxuXHJcblx0ZnVuY3Rpb24gbW91c2Vtb3ZlKGUpIHtcclxuXHRcdGlmIChkcmFnZ2luZykge1xyXG5cdFx0XHRlbmRYID0gZS5jbGllbnRYIC0gc2Nyb2xsTGVmdDtcclxuXHJcblx0XHRcdC8vIGxpbWl0XHJcblx0XHRcdGlmIChlbmRYIC0gbGVmdE9mZnNldCA8IEZMRVhNSU5XSURUSCkge1xyXG5cdFx0XHRcdGVuZFggPSBsZWZ0T2Zmc2V0ICsgRkxFWE1JTldJRFRIO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRvcHRzLm9uRHJhZ2dpbmcoIHsgJ3gnOiBlbmRYIH0sIG9wdHMuJGVsZW1lbnQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBtb3VzZXVwKGV2dCkge1xyXG5cdFx0dmFyIGUgPSBldnQudGFyZ2V0O1xyXG5cdFx0ZHJhZ2dpbmcgPSBmYWxzZTtcclxuXHJcblx0XHRvcHRzLm9uRHJhZ0VuZCh7ICd4JzogZXZ0LmNsaWVudFggLSBzY3JvbGxMZWZ0IH0sIG9wdHMuJGVsZW1lbnQpO1xyXG5cclxuXHRcdGlmIChlICYmIGUuc2V0Q2FwdHVyZSkge1xyXG5cdFx0XHRlLnJlbGVhc2VDYXB0dXJlKCk7XHJcblx0XHR9IGVsc2UgaWYgKHdpbmRvdy5yZWxlYXNlQ2FwdHVyZSkge1xyXG5cdFx0XHR3aW5kb3cucmVsZWFzZUNhcHR1cmUoRXZlbnQuTU9VU0VNT1ZFIHwgRXZlbnQuTU9VU0VVUCk7XHJcblx0XHR9XHJcblxyXG5cdFx0ZG9jLm9mZignbW91c2Vtb3ZlLmRyYWdkcm9wJywgbW91c2Vtb3ZlKTtcclxuXHRcdGRvYy5vZmYoJ21vdXNldXAuZHJhZ2Ryb3AnLCBtb3VzZXVwKTtcclxuXHR9XHJcblxyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZGVsZWdhdGUsIG9wdGlvbnMpIHtcclxuXHR2YXIgZGVmYXVsdHMgPSB7XHJcblx0XHRyZXN0cmljdGVyKGV2dCkgeyByZXR1cm4gbnVsbDsgfSxcclxuXHRcdG9uRHJhZ1N0YXJ0KG9mZnNldCwgdGFyZ2V0KSB7fSxcclxuXHRcdG9uRHJhZ2dpbmcob2Zmc2V0LCB0YXJnZXQpIHt9LFxyXG5cdFx0b25EcmFnRW5kKG9mZnNldCwgdGFyZ2V0KSB7fVxyXG5cdH07XHJcblxyXG5cdE9iamVjdC5hc3NpZ24oZGVmYXVsdHMsIG9wdGlvbnMpO1xyXG5cclxuXHQkKGRlbGVnYXRlKS5vbignbW91c2Vkb3duJywgb3B0aW9ucy50cmlnZ2VyLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdHZhciByZXN0cmljdGVyID0gZGVmYXVsdHMucmVzdHJpY3Rlci5jYWxsKHRoaXMsIGV2dCk7XHJcblxyXG5cdFx0aWYgKHJlc3RyaWN0ZXIpIHtcclxuXHRcdFx0ZGVmYXVsdHMuJGVsZW1lbnQgPSByZXN0cmljdGVyO1xyXG5cdFx0XHRkcmFnRHJvcC5jYWxsKHRoaXMsIGV2dCwgZGVmYXVsdHMpO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG59OyIsIi8qKlxyXG4gKiDkuovku7bnrqHnkIZcclxuICogQGNsYXNzIEV2ZW50RW1pdHRlclxyXG4gKi9cclxuXHJcbmZ1bmN0aW9uIGluZGV4T2ZMaXN0ZW5lcihsaXN0ZW5lcnMsIGxpc3RlbmVyKSB7XHJcblx0dmFyIGkgPSBsaXN0ZW5lcnMubGVuZ3RoO1xyXG5cdHdoaWxlIChpLS0pIHtcclxuXHRcdGlmIChsaXN0ZW5lcnNbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSB7XHJcblx0XHRcdHJldHVybiBpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRyZXR1cm4gLTE7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGlzVmFsaWRMaXN0ZW5lcihsaXN0ZW5lcikge1xyXG5cdGlmICh0eXBlb2YgbGlzdGVuZXIgPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH0gZWxzZSBpZiAobGlzdGVuZXIgJiYgdHlwZW9mIGxpc3RlbmVyID09PSAnb2JqZWN0Jykge1xyXG5cdFx0cmV0dXJuIGlzVmFsaWRMaXN0ZW5lcihsaXN0ZW5lci5saXN0ZW5lcik7XHJcblx0fSBlbHNlIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcbn1cclxuXHJcbmNsYXNzIEV2ZW50RW1pdHRlciB7XHJcblxyXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcclxuXHJcblx0fVxyXG5cdC8qKlxyXG5cdCpcclxuXHQqXHJcblx0KlxyXG5cdCpcclxuXHQqL1xyXG5cdF9nZXRFdmVudHMoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fZXZlbnRzIHx8ICh0aGlzLl9ldmVudHMgPSB7fSk7XHJcblx0fVxyXG5cdC8qKlxyXG5cdCog6YCa6L+H5LqL5Lu25ZCN6I635Y+WbGlzdGVuZXIg5pWw57uE5oiW5Yid5aeL5YyWXHJcblx0KiDkvb/nlKjmraPliJnljLnphY3kvJrov5Tlm57kuIDkuKrlr7nlupTnmoTlr7nosaFcclxuXHQqXHJcblx0KiBcclxuXHQqIGdldExpc3RlbmVyc1xyXG5cdCogQHBhcmFtIHtTdHJpbmcgfSBSZWdFeHB9IGV2ZW50TmFtZVxyXG5cdCogQHJldHVybiB7RnVuY3RvbltdIHwgT2JqZWN0fVxyXG5cdCpcclxuXHQqL1xyXG5cdGdldExpc3RlbmVycyhuYW1lKSB7XHJcblx0XHR2YXIgZXZlbnRzID0gdGhpcy5fZ2V0RXZlbnRzKCk7XHJcblx0XHR2YXIgcmVzcG9uc2U7XHJcblx0XHR2YXIga2V5O1xyXG5cclxuXHRcdGlmIChuYW1lIGluc3RhbmNlb2YgUmVnRXhwKSB7XHJcblx0XHRcdHJlc3BvbnNlID0ge307XHJcblx0XHRcdGZvciAoa2V5IGluIGV2ZW50cykge1xyXG5cdFx0XHRcdGlmIChldmVudHMuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBuYW1lLnRlc3Qoa2V5KSkge1xyXG5cdFx0XHRcdFx0cmVzcG9uc2Vba2V5XSA9IGV2ZW50c1trZXldO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cmVzcG9uc2UgPSBldmVudHNbbmFtZV0gfHwgKGV2ZW50c1tuYW1lXSA9IFtdKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcmVzcG9uc2U7XHJcblx0fVxyXG5cdC8qKlxyXG5cdCog6YCa6L+H5LqL5Lu25ZCN6I635Y+WbGlzdGVuZXIg5aeL57uI6L+U5Zue5LiA5Liq5a+56LGhXHJcblx0KlxyXG5cdCogXHJcblx0KiBnZXRMaXN0ZW5lcnNBc09iamVjdFxyXG5cdCogQHBhcmFtIHtTdHJpbmd8UmVnRXhwfSBldmVudE5hbWVcclxuXHQqIEByZXR1cm4ge09iamVjdH1cclxuXHQqL1xyXG5cdGdldExpc3RlbmVyc0FzT2JqZWN0KG5hbWUpIHtcclxuXHRcdHZhciBsaXN0ZW5lcnMgPSB0aGlzLmdldExpc3RlbmVycyhuYW1lKTtcclxuXHRcdHZhciByZXNwb25zZTtcclxuXHJcblx0XHRpZiAobGlzdGVuZXJzIGluc3RhbmNlb2YgQXJyYXkpIHtcclxuXHRcdFx0cmVzcG9uc2UgPSB7fTtcclxuXHRcdFx0cmVzcG9uc2VbbmFtZV0gPSBsaXN0ZW5lcnM7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHJlc3BvbnNlIHx8IGxpc3RlbmVycztcclxuXHR9XHJcblx0LyoqXHJcblx0KiDojrflj5YgbGlzdGVuZXIg5YiX6KGoXHJcblx0KlxyXG5cdCogZmxhdHRlbkxpc3RlbmVyc1xyXG5cdCpcclxuXHQqIEBwYXJhbSB7IE9iamVjdFtdfSBsaXN0ZW5lcnNcclxuXHQqIEByZXR1cm4ge0Z1bmN0aW9uW119XHJcblx0Ki9cclxuXHRmbGF0dGVuTGlzdGVuZXJzKGxpc3RlbmVycykge1xyXG5cdFx0dmFyIGZsYXRMaXN0ZW5lcnMgPSBbXTtcclxuXHJcblx0XHRmb3IgKHZhciBpID0gMCwgbCA9IGxpc3RlbmVyLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG5cdFx0XHRmbGF0TGlzdGVuZXJzLnB1c2gobGlzdGVuZXJzW2ldLmxpc3RlbmVyKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmxhdExpc3RlbmVycztcclxuXHR9XHJcblx0LyoqXHJcblx0KiDkuovku7bms6jlhoxcclxuXHQqXHJcblx0KlxyXG5cdCogQGV4YW1wZWxcclxuXHQqIHZhciBlbXQgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XHJcblx0KiBlbXQuYWRkTGlzdGVuZXIoJ2Rpdjpob3ZlcicsIGZ1bmN0aW9uKCl7XHJcblx0Klx0Ly8gZG9cclxuXHQqIH0pO1xyXG5cdCogQHBhcmFtIHtzdHJpbmd9IGV2ZW50TmFtZVxyXG5cdCogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXJcclxuXHQqIEByZXR1cm4ge09iamVjdGp9XHJcblx0KlxyXG5cdCovXHJcblx0YWRkTGlzdGVuZXIobmFtZSwgbGlzdGVuZXIsIGZsYWcpIHtcclxuXHRcdGlmICghaXNWYWxpZExpc3RlbmVyKGxpc3RlbmVyKSkge1xyXG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgbGlzdGVuZXJzID0gdGhpcy5nZXRMaXN0ZW5lcnNBc09iamVjdChuYW1lKTtcclxuXHRcdHZhciBsaXN0ZW5lcklzV3JhcHBlZCA9IHR5cGVvZiBsaXN0ZW5lciA9PT0gJ29iamVjdCc7XHJcblx0XHR2YXIga2V5LCBzdGFydCwgYXJncztcclxuXHJcblx0XHRmb3IgKGtleSBpbiBsaXN0ZW5lcnMpIHtcclxuXHRcdFx0aWYgKGxpc3RlbmVycy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIGluZGV4T2ZMaXN0ZW5lcihsaXN0ZW5lcnMsIGxpc3RlbmVyKSA9PT0gLTEpIHtcclxuXHJcblx0XHRcdFx0c3RhcnQgPSBsaXN0ZW5lcnNba2V5XS5sZW5ndGg7XHJcblxyXG5cdFx0XHRcdGxpc3RlbmVyc1trZXldLnB1c2gobGlzdGVuZXJJc1dyYXBwZWQgPyBsaXN0ZW5lciA6IHtcclxuXHRcdFx0XHRcdGxpc3RlbmVyOiBsaXN0ZW5lcixcclxuXHRcdFx0XHRcdG9uY2U6IGZhbHNlXHJcblx0XHRcdFx0fSk7XHJcblxyXG5cdFx0XHRcdGlmIChmbGFnICYmIGxpc3RlbmVyc1trZXldLmFyZ3MpIHtcclxuXHRcdFx0XHRcdGxpc3RlbmVyc1trZXldLnN0YXJ0ID0gc3RhcnQ7XHJcblx0XHRcdFx0XHRhcmdzID0gbGlzdGVuZXJzW2tleV0uYXJncztcclxuXHRcdFx0XHRcdHRoaXMuZW1pdEV2ZW50KG5hbWUsIGFyZ3MpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0b24oKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5hZGRMaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHJcblx0b25lKG5hbWUsIGxpc3RlbmVyLCBmbGFnKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yZW1vdmVFdmVudChuYW1lKS5hZGRMaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICog5LqL5Lu25rOo5YaM77yM6Kem5Y+R5ZCO6Ieq5Yqo56e76ZmkXHJcblx0ICpcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWVcclxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxyXG5cdCAqIEByZXV0bnIge09iamVjdH1cclxuXHQgKlxyXG5cdCAqL1xyXG5cdGFkZE9uY2VMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lcikge1xyXG5cdFx0cmV0dXJuIHRoaXMuYWRkTGlzdGVuZXIobmFtZSwge1xyXG5cdFx0XHRsaXN0ZW5lcjogbGlzdGVuZXIsXHJcblx0XHRcdG9uY2U6IHRydWVcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0b25jZSgpIHtcclxuXHRcdHJldHVybiB0aGlzLmFkZE9uY2VMaXN0ZW5lci5hcHBseSh0aGlzLmFyZ3VtZW50cyk7XHJcblx0fVxyXG5cdC8qKlxyXG5cdCAqIOS6i+S7tumUgOavgVxyXG5cdCAqXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lXHJcblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXJcclxuXHQgKiBAcmV0dXJuIHtPYmplY3R9XHJcblx0ICpcclxuXHQgKi9cclxuXHRyZW1vdmVMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lcikge1xyXG5cdFx0dmFyIGxpc3RlbmVycyA9IHRoaXMuZ2V0TGlzdGVuZXJzQXNPYmplY3QobmFtZSk7XHJcblx0XHR2YXIgaW5kZXg7XHJcblx0XHR2YXIga2V5O1xyXG5cclxuXHRcdGZvciAoa2V5IGluIGxpc3RlbmVycykge1xyXG5cdFx0XHRpZiAobGlzdGVuZXJzLmhhc093blByb3BlcnR5KGtleSkpIHtcclxuXHRcdFx0XHRpbmRleCA9IGluZGV4T2ZMaXN0ZW5lcihsaXN0ZW5lcnNba2V5XSwgbGlzdGVuZXIpO1xyXG5cclxuXHRcdFx0XHRpZiAoaW5kZXggIT09IC0xKSB7XHJcblx0XHRcdFx0XHRsaXN0ZW5lcnNba2V5XS5zcGxpY2UoaW5kZXgsIGkpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0b2ZmKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMucmVtb3ZlTGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuXHR9XHJcblxyXG5cdG1hbmlwdWxhdGVMaXN0ZW5lcnMocmVtb3ZlLCBuYW1lLCBsaXN0ZW5lcnMpIHtcclxuXHRcdHZhciBzaW5nbGUgPSByZW1vdmUgPyB0aGlzLnJlbW92ZUxpc3RlbmVyIDogdGhpcy5hZGRMaXN0ZW5lcjtcclxuXHRcdHZhciBtdXRpcGxlID0gcmVtb3ZlID8gdGhpcy5yZW1vdmVMaXN0ZW5lcnMgOiB0aGlzLmFkZExpc3RlbmVycztcclxuXHRcdHZhciBpO1xyXG5cdFx0dmFyIHY7XHJcblxyXG5cdFx0aWYgKHR5cGVvZiBuYW1lID09PSAnb2JqZWN0JyAmJiAhKG5hbWUgaW5zdGFuY2VvZiBSZWdFeHApKSB7XHJcblx0XHRcdGZvciAoaSBpbiBuYW1lKSB7XHJcblx0XHRcdFx0aWYgKG5hbWUuaGFzT3duUHJvcGVydHkoaSkgJiYgKHYgPSBuYW1lW2ldKSkge1xyXG5cdFx0XHRcdFx0aWYgKHR5cGVvZiB2ID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHRcdFx0XHRcdHNpbmdsZS5jYWxsKHRoaXMsIGksIHYpO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0bXV0aXBsZS5jYWxsKHRoaXMsIGksIHYpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0aSA9IDA7XHJcblx0XHRcdHYgPSBsaXN0ZW5lcnMubGVuZ3RoO1xyXG5cdFx0XHR3aGlsZSAoaSA8IHYpIHtcclxuXHRcdFx0XHRzaW5nbGUuY2FsbCh0aGlzLCBuYW1lLCBsaXN0ZW5lcnNbaSsrXSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdGFkZExpc3RlbmVycyhuYW1lLCBsaXN0ZW5lcnMpIHtcclxuXHRcdHJldHVybiB0aGlzLm1hbmlwdWxhdGVMaXN0ZW5lcnMoZmFsc2UsIG5hbWUsIGxpc3RlbmVycyk7XHJcblx0fVxyXG5cclxuXHRyZW1vdmVMaXN0ZW5lcnMobmFtZSwgbGlzdGVuZXJzKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5tYW5pcHVsYXRlTGlzdGVuZXJzKHRydWUsIG5hbWUsIGxpc3RlbmVycyk7XHJcblx0fVxyXG5cclxuXHRyZW1vdmVFdmVudChuYW1lKSB7XHJcblx0XHR2YXIgZXZlbnRzID0gdGhpcy5fZ2V0RXZlbnRzKCk7XHJcblx0XHR2YXIga2V5O1xyXG5cclxuXHRcdGlmICh0eXBlb2YgbmFtZSA9PT0gJ3N0cmluZycpIHtcclxuXHRcdFx0Ly8g56e76Zmk5omA5pyJ5oyH5a6a5LqL5Lu25ZCN55qE5omA5pyJbGlzdGVuZXJzXHJcblx0XHRcdC8vIGRlbGV0ZSBldmVudHNbbmFtZV1cclxuXHRcdFx0aWYgKGV2ZW50c1tuYW1lXSBpbnN0YW5jZW9mIEFycmF5KSB7XHJcblx0XHRcdFx0ZXZlbnRzW25hbWVdLmxlbmd0aCA9IDA7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSBpZiAobmFtZSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xyXG5cdFx0XHQvLyDmraPliJnljLnphY3nmoTmiYDmnIkgbGlzdGVuZXJzXHJcblx0XHRcdGZvciAoa2V5IGluIGV2ZW50cykge1xyXG5cdFx0XHRcdGlmIChldmVudHMuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBuYW1lLnRlc3Qoa2V5KSkge1xyXG5cdFx0XHRcdFx0Ly8gZGVsZXRlIGV2ZW50c1trZXldXHJcblx0XHRcdFx0XHRpZiAoZXZlbnRzW2tleV0gaW5zdGFuY2VvZiBBcnJheSkge1xyXG5cdFx0XHRcdFx0XHRldmVudFtrZXldLmxlbmd0aCA9IDA7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQvLyDnp7vpmaTmiYDmnIkgbGlzdGVuZXJzXHJcblx0XHRcdGRlbGV0ZSB0aGlzLl9ldmVudHM7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRyZW1vdmVBbGxMaXN0ZW5lcnMoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yZW1vdmVFdmVudC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHQvKipcclxuXHQgKiDkuovku7bop6blj5FcclxuXHQgKlxyXG5cdCAqXHJcblx0ICogQGV4YW1wbGVcclxuXHQgKiB2YXIgZW10ID0gbmV3IEV2ZW50RW1pdHRlcigpO1xyXG5cdCAqIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcblx0ICogXHRlbXQuZW1pdEV2ZW50KCdkaXY6aG92ZXInLCAxKTtcclxuXHQgKiB9LCAxMDAwKTtcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWUg5LqL5Lu25ZCN56ewXHJcblx0ICogQHBhcmFtIHtBcnJheX0gW2FyZ3NdIEhUTUxEb2N1bWVudCwgaXRlbURhdGEsIC4uLlxyXG5cdCAqIEByZXR1cm4ge09iamVjdH1cclxuXHQgKlxyXG5cdCAqL1xyXG5cdGVtaXRFdmVudChuYW1lLCBhcmdzKSB7XHJcblx0XHR2YXIgbGlzdGVuZXJzTWFwID0gdGhpcy5nZXRMaXN0ZW5lcnNBc09iamVjdChuYW1lKTtcclxuXHRcdHZhciBsaXN0ZW5lcnM7XHJcblx0XHR2YXIgbGlzdGVuZXI7XHJcblx0XHR2YXIgaTtcclxuXHRcdHZhciBsO1xyXG5cdFx0dmFyIGtleTtcclxuXHRcdHZhciByZXNwb25zZTtcclxuXHJcblx0XHRmb3IgKGtleSBpbiBsaXN0ZW5lcnNNYXApIHtcclxuXHRcdFx0aWYgKGxpc3RlbmVyc01hcC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XHJcblx0XHRcdFx0bGlzdGVuZXJzID0gbGlzdGVuZXJzTWFwW2tleV0uc2xpY2UoMCk7XHJcblxyXG5cdFx0XHRcdGxpc3RlbmVyc01hcFtrZXldLmFyZ3MgPSBhcmdzO1xyXG5cclxuXHRcdFx0XHRpID0gbGlzdGVuZXJzTWFwW2tleV0uc3RhcnQgfHwgMDtcclxuXHRcdFx0XHRsaXN0ZW5lcnNNYXBba2V5XS5zdGFydCA9IDA7XHJcblxyXG5cdFx0XHRcdGZvciAobCA9IGxpc3RlbmVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuXHRcdFx0XHRcdGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldO1xyXG5cclxuXHRcdFx0XHRcdGlmIChsaXN0ZW5lci5vbmNlID09PSB0cnVlKSB7XHJcblx0XHRcdFx0XHRcdHRoaXMucmVtb3ZlTGlzdGVuZXIobmFtZSwgbGlzdGVuZXIubGlzdGVuZXIpO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHJlc3BvbnNlID0gbGlzdGVuZXIubGlzdGVuZXIuYXBwbHkodGhpcywgYXJncyB8fCBbXSk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKHJlc3BvbnNlID09PSB0aGlzLl9nZXRPbmNlUmV0dXJuVmFsdWUoKSkge1xyXG5cdFx0XHRcdFx0XHR0aGlzLnJlbW92ZUxpc3RlbmVyKG5hbWUsIGxpc3RlbmVyLmxpc3RlbmVyKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0dHJpZ2dlcigpIHtcclxuXHRcdHJldHVybiB0aGlzLmVtaXRFdmVudC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHJcblx0ZmlyZShuYW1lKSB7XHJcblx0XHR2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XHJcblx0XHRyZXR1cm4gdGhpcy5lbWl0RXZlbnQobmFtZSwgYXJncyk7XHJcblx0fVxyXG5cclxuXHRfZ2V0T25jZVJldHVyblZhbHVlKCkge1xyXG5cdFx0aWYgKHRoaXMuaGFzT3duUHJvcGVydHkoJ19vbmNlUmV0dXJuVmFsdWUnKSkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5fb25jZVJldHVyblZhbHVlO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHRzZXRPbmNlUmV0dXJuVmFsdWUodmFsdWUpIHtcclxuXHRcdHRoaXMuX29uY2VSZXR1cm5WYWx1ZSA9IHZhbHVlO1xyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRkZWZpbmVFdmVudChuYW1lKSB7XHJcblx0XHR0aGlzLmdldExpc3RlbmVycyhuYW1lKTtcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0ZGVmaW5lRXZlbnRzKG5hbWVzKSB7XHJcblx0XHRmb3IgKHZhciBpID0gMCwgbCA9IG5hbWVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG5cdFx0XHR0aGlzLmRlZmluZUV2ZW50KG5hbWVbaV0pO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XHJcblxyXG5cclxuIiwiZnVuY3Rpb24gc3dhcChhcnIsIHMxLCBzMikge1xyXG5cdHZhciB0ZW1wID0gYXJyW3MxXTtcclxuXHRhcnJbczFdID0gYXJyW3MyXTtcclxuXHRhcnJbczJdID0gdGVtcDtcclxufVxyXG5cclxuZnVuY3Rpb24gcmFuZG9tVmFsdWUoYXJyKSB7XHJcblx0dmFyIHIgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBhcnIubGVuZ3RoKTtcclxuXHQvLyBzd2FwKGFyciwgMCwgcik7XHJcblx0cmV0dXJuIFthcnJbcl0sIGFyci5maWx0ZXIoKGQsIGkpID0+IGkgIT09IHIpXTtcclxufVxyXG5cclxuZnVuY3Rpb24gZmlsdGVyTEFuZFIoYXJyLCBzZWxlY3QsIGNvbXBhcmVGbikge1xyXG5cdHZhciBsZWZ0QXJyID0gW107XHJcblx0dmFyIHJpZ2h0QXJyID0gW107XHJcblxyXG5cdGZvciAodmFyIGkgPSAwLCBsZW4gPSBhcnIubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHRcdGxldCB0ZW1wID0gYXJyW2ldO1xyXG5cdFx0bGV0IGNvbXBhcmVkID0gY29tcGFyZUZuKHNlbGVjdCwgdGVtcCk7XHJcblx0XHRpZiAoY29tcGFyZWQgPiAwKSByaWdodEFyci5wdXNoKHRlbXApO1xyXG5cdFx0ZWxzZSBpZiAoY29tcGFyZWQgPCAwKSBsZWZ0QXJyLnB1c2godGVtcCk7XHJcblx0XHRlbHNlIE1hdGgucmFuZG9tKCkgPiAwLjUgPyByaWdodEFyci5wdXNoKHRlbXApIDogbGVmdEFyci5wdXNoKHRlbXApO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIFtsZWZ0QXJyLCByaWdodEFycl07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZpbmRJbmRleChhcnIsIGluZGV4LCBjb21wYXJlRm4pIHtcclxuXHRpZiAoYXJyLmxlbmd0aCA8PSAxIHx8IGluZGV4ID09PSAwKSByZXR1cm4gYXJyWzBdO1xyXG5cdHZhciBbc2VsZWN0LCBzZWNfYXJyXSA9IHJhbmRvbVZhbHVlKGFycik7XHJcblx0dmFyIFtsZWZ0QXJyLCByaWdodEFycl0gPSBmaWx0ZXJMQW5kUihzZWNfYXJyLCBzZWxlY3QsIGNvbXBhcmVGbik7XHJcblx0dmFyIG4gPSByaWdodEFyci5sZW5ndGg7XHJcblxyXG5cdGlmIChuID09PSBpbmRleCAtIDEpIHJldHVybiBzZWxlY3Q7XHJcblx0aWYgKG4gPj0gaW5kZXgpIHJldHVybiBmaW5kSW5kZXgocmlnaHRBcnIsIGluZGV4LCBjb21wYXJlRm4pO1xyXG5cdGVsc2UgcmV0dXJuIGZpbmRJbmRleChsZWZ0QXJyLCBpbmRleCAtIG4gLSAxLCBjb21wYXJlRm4pO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZpbmRJbmRleDsiLCJ2YXIgVXRpbHMgPSB7fTtcclxuXHJcbnZhciB1aWQgPSBVdGlscy51aWQgPSAoKCkgPT4ge1xyXG5cdGxldCB0ID0gRGF0ZS5ub3coKTtcclxuXHRyZXR1cm4gKCkgPT4ge1xyXG5cdFx0cmV0dXJuICh0KyspLnRvU3RyaW5nKDE2KTtcclxuXHR9O1xyXG59KSgpO1xyXG5cclxuXHJcbnZhciBtZXJnZSA9IFV0aWxzLm1lcmdlID0gKHRhcmdldCwgYWRkaXRpb25hbCwgZGVlcCkgPT4ge1xyXG5cdGxldCBkZXB0aCA9IHR5cGVvZiBkZWVwID09ICd1bmRlZmluZWQnID8gMiA6IGRlZXAsIHByb3A7XHJcblxyXG5cdGZvciAocHJvcCBpbiBhZGRpdGlvbmFsKSB7XHJcblx0XHRpZiAoYWRkaXRpb25hbC5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xyXG5cdFx0XHRpZiAodHlwZW9mIHRhcmdldFtwcm9wXSAhPT0gJ29iamVjdCcgfHwgIWRlcHRoKSB7XHJcblx0XHRcdFx0dGFyZ2V0W3Byb3BdID0gYWRkaXRpb25hbFtwcm9wXTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRVdGlscy5tZXJnZSh0YXJnZXRbcHJvcF0sIGFkZGl0aW9uYWxbcHJvcF0sIGRlcHRoIC0gMSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiB0YXJnZXQ7XHJcbn07XHJcblxyXG52YXIgZmluZEluZGV4ID0gVXRpbHMuZmluZEluZGV4ID0gcmVxdWlyZSgnLi9GaW5kSW5kZXgnKTtcclxudmFyIGNvbXBhcmVGbiA9IFV0aWxzLmNvbXBhcmVGbiA9IHJlcXVpcmUoJy4vdXRpbHMvQ29tcGFyZXInKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gVXRpbHM7IiwidmFyIGNvbnRleHQgPSB0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJyA/IHRoaXMgOiB3aW5kb3c7XHJcbmV4cG9ydHMuJCA9IGNvbnRleHQuJDtcclxuZXhwb3J0cy5fID0gY29udGV4dC5fOyIsIi8qKlxyXG4gKiDliJvlu7rmr5TovoPlh73mlbBcclxuICogQHN1bW1hcnkg57qm5p2f5p2h5Lu277yM5Y+q6ZKI5a+55a+56LGh5pWw57uE57uT5p6E55qE5pWw5o2u77yM5aaCXHJcbiAqICAgICAgW3tcImNvbF8xXCI6IDEwLCBcImNvbF8yXCI6IDM1LCBcImNvbF8zXCI6IDY2fSwgLi4uXVxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiAgdmFyIHNvcnRzID0gWydBJywnQicsJ0MnLCdEJ107XHJcbiAqICB2YXIgZGlycyA9IFsxLCAtMSwgMSwgMV07XHJcbiAqXHJcbiAqICB2YXIgZGF0YTMgPSBbXHJcbiAqICAgICAge0E6MSxCOjEsQzo1LF9pZDoxfSxcclxuICogICAgICB7QToxLEI6MyxDOjUsX2lkOjF9LFxyXG4gKiAgICAgIHtBOjIsQjo1LEM6NCxfaWQ6Mn0sXHJcbiAqICAgICAge0E6MSxCOjEsQzo5LF9pZDoxfSxcclxuICogICAgICB7QTozLEI6MyxDOjMsX2lkOjN9LFxyXG4gKiAgICAgIHtBOjEsQjoxLEM6MyxfaWQ6MX0sXHJcbiAqICAgICAge0E6NCxCOjIsQzoyLF9pZDo0fSxcclxuICogICAgICB7QTo1LEI6NCxDOjEsX2lkOjV9LFxyXG4gKiAgXTtcclxuICpcclxuICogIHZhciBmbiA9IGNvbXBhcmVGbihzb3J0cywgZGlycyk7XHJcbiAqICB2YXIgcmV0ID0gZGF0YTMuc29ydChmbikubWFwKGQgPT4gT2JqZWN0LnZhbHVlcyhkKSk7XHJcbiAqICBjb25zb2xlLmRpcihyZXQpO1xyXG4gKlxyXG4gKiBAcGFyYW0ge0FycmF5fSBzb3J0cyAt5o6S5bqP5a2X5q615pWw57uEIFsnY29sXzEnLCAnY29sXzInLCAnY29sXzMnLC4uLl1cclxuICogQHBhcmFtIHtBcnJheX0gZGlycyAt5a+55bqU5a2X5L2T5o6S5bqP5pWw57uE55qE5Y2H6ZmN5bqPLDHvvJrljYfluo8gLTHvvJrpmY3luo8gWzEsIC0xXVxyXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IOavlOi+g+WHveaVsFxyXG4gKi9cclxuZXhwb3J0cy5jb21wYXJlRm4gPSBmdW5jdGlvbiBjb21wYXJlRm4oc29ydHMsIGRpcnMpIHtcclxuICAgIHZhciBjb25kaXRpb25zID0gc29ydHMucmVkdWNlKChwcmUsIG5leHQsIGkpID0+IHtcclxuICAgICAgICBwcmUgID0gcHJlID8gcHJlICsgJyB8fCcgOiAnJztcclxuICAgICAgICByZXR1cm4gYCR7cHJlfSAoYS4ke25leHR9IC0gYi4ke25leHR9KSAqICR7ZGlyc1tpXX1gO1xyXG4gICAgfSwgJycpO1xyXG5cclxuICAgIHZhciBmdW5jdGlvbl9ib2R5ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgbGV0IHNvcnRJbmZvID0gc29ydHMuam9pbignLCcpLnJlcGxhY2UoLyhcXHcrKS9nLCAnXCIkMVwiJyk7XHJcbiAgICAgICAgcmV0dXJuIGB2YXIgc29ydCA9IFske3NvcnRJbmZvfV07IHJldHVybiAke2NvbmRpdGlvbnN9YDtcclxuICAgIH1cclxuICAgIC8vIGNvbnNvbGUubG9nKGZ1bmN0aW9uX2JvZHkoKSk7XHJcbiAgICBcclxuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oJ2EnLCAnYicsIGZ1bmN0aW9uX2JvZHkoKSk7XHJcbn1cclxuXHJcblxyXG4iXX0=
