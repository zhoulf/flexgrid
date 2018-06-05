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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY29yZS9CdWZmZXJOb2RlLmpzIiwic3JjL2NvcmUvQnVmZmVyWm9uZS5qcyIsInNyYy9jb3JlL0NvbE1vZGVsLmpzIiwic3JjL2NvcmUvR3JpZFN0b3JlLmpzIiwic3JjL2NvcmUvR3JpZFZpZXcuanMiLCJzcmMvY29yZS9IZWFkZXIuanMiLCJzcmMvY29yZS9Mb2NrQ29sTWFuYWdlci5qcyIsInNyYy9jb3JlL1Njcm9sbGVyLmpzIiwic3JjL2V4dGVuZHMvQ29udGV4dG1lbnUuanMiLCJzcmMvZXh0ZW5kcy9TZWxlY3Rpb24uanMiLCJzcmMvaW5kZXguanMiLCJzcmMvcGx1Z2luL01lbnUuanMiLCJzcmMvdXRpbC9ERC5qcyIsInNyYy91dGlsL0V2ZW50RW1pdHRlci5qcyIsInNyYy91dGlsL0ZpbmRJbmRleC5qcyIsInNyYy91dGlsL1V0aWxzLmpzIiwic3JjL3V0aWwvc2hpbS5qcyIsInNyYy91dGlsL3V0aWxzL0NvbXBhcmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDek1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pXQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3QkE7QUFDQTtBQUNBOztBQ0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJy4uL3V0aWwvRXZlbnRFbWl0dGVyJyk7XHJcbnZhciAkID0gcmVxdWlyZSgnLi4vdXRpbC9zaGltJykuJDtcclxuXHJcbnZhciBkZWZpbmVEZWxsID0gZnVuY3Rpb24oY29sTSkge1xyXG5cdGxldCBjZWxsID0gJCgnPGxpLz4nKVxyXG5cdFx0LmFkZENsYXNzKCdjLWdyaWQtY2VsbCcpXHJcblx0XHQuYWRkQ2xhc3MoJ2MtYWxpZ24tJyArIGNvbE0uYWxpZ24pXHJcblx0XHQuYWRkQ2xhc3MoKCkgPT4gY29sTS5oaWRkZW4gPyAnYy1jb2x1bW4taGlkZScgOiAnJylcclxuXHRcdC5hZGRDbGFzcygoKSA9PiBjb2xNLmxvY2tlZCA/ICdjLWNvbHVtbi1sb2NrZWQnIDogJycpXHJcblx0XHQuYXR0cigndGFiaW5kZXgnLCAtMSlcclxuXHRcdC5kYXRhKCdkYXRhSW5kZXgnLCBjb2xNLmRhdGFJbmRleClcclxuXHRcdC53aWR0aChjb2xNLndpZHRoKTtcclxuXHJcblx0cmV0dXJuIGNlbGw7XHJcbn07XHJcblxyXG52YXIgY3JlYXRlQ2VsbCA9IGZ1bmN0aW9uKCRyb3csIGNvbHNNb2RlbCkge1xyXG5cdHZhciBzaXplID0gY29sc01vZGVsLnNpemUoKTtcclxuXHR2YXIgY2hpbGRyZW4gPSBuZXcgTWFwKCk7XHJcblxyXG5cdGNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0bGV0IGNlbGwgPSBkZWZpbmVEZWxsKGNvbE0pO1xyXG5cclxuXHRcdCRyb3cuYXBwZW5kKGNlbGwpO1xyXG5cdFx0Y2hpbGRyZW4uc2V0KGNvbE0sIGNlbGwpO1xyXG5cdH0pO1xyXG5cclxuXHRyZXR1cm4gY2hpbGRyZW47XHJcbn07XHJcblxyXG5jbGFzcyBSb3dOb2RlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHRjb25zdHJ1Y3Rvcihjb2xzTW9kZWwsIGNvbnRleHQpIHtcclxuXHRcdHN1cGVyKCk7XHJcblx0XHR0aGlzLiR2bSA9IGNvbnRleHQ7XHJcblx0XHR0aGlzLmNvbHNNb2RlbCA9IGNvbHNNb2RlbDtcclxuXHRcdHRoaXMuJG5vZGUgPSAkKCc8dWwvPicpLmFkZENsYXNzKCdjLWdyaWQtcm93Jyk7XHJcblxyXG5cdFx0dGhpcy5jaGlsZHJlbiA9IGNyZWF0ZUNlbGwodGhpcy4kbm9kZSwgY29sc01vZGVsKTtcclxuXHRcdHRoaXMuX2JpbmRFdmVudChjb2xzTW9kZWwpO1xyXG5cdH1cclxuXHJcblx0X2JpbmRFdmVudChjb2xzTW9kZWwpIHtcclxuXHRcdHRoaXMuY29sc01vZGVsLm9uKCdjb2x1bW4tYWRkJywgY29sTSA9PiB7XHJcblx0XHRcdGxldCBjZWxsID0gZGVmaW5lRGVsbChjb2xNKTtcclxuXHJcblx0XHRcdHRoaXMuJG5vZGUuYXBwZW5kKGNlbGwpO1xyXG5cdFx0XHR0aGlzLmNoaWxkcmVuLnNldChjb2xNLCBjZWxsKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdGNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tcmVzaXplZCcsIHdpZHRoID0+IHtcclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyh3aWR0aCk7XHJcblx0XHRcdFx0dGhpcy5jaGlsZHJlbi5nZXQoY29sTSkub3V0ZXJXaWR0aCh3aWR0aCk7XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWhpZGRlbicsIGlzSGlkZGVuID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jaGlsZHJlbi5nZXQoY29sTSk7XHJcblx0XHRcdFx0aWYgKGlzSGlkZGVuKSB7XHJcblx0XHRcdFx0XHRjb2xFbGUuYWRkQ2xhc3MoJ2MtY29sdW1uLWhpZGUnKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKCdjLWNvbHVtbi1oaWRlJyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1sb2NrZWQnLCBpc0xvY2tlZCA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY2hpbGRyZW4uZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0XHRpZiAoaXNMb2NrZWQpIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcygnYy1jb2x1bW4tbG9ja2VkJyk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcygnYy1jb2x1bW4tbG9ja2VkJyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2Rlc3RvcnknLCAoKSA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY2hpbGRyZW4uZ2V0KGNvbE0pO1xyXG5cdFx0XHRcdHRoaXMuY2hpbGRyZW4uZGVsZXRlKGNvbE0pO1x0XHRcdFxyXG5cdFx0XHRcdGNvbEVsZS5yZW1vdmUoKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdHNldERhdGEocm93LCBvZmZzZXRUb3ApIHtcclxuXHRcdC8vIOi/memHjOWmguaenOeUqEFPUOaWueW8j+WunueOsOabtOWlvVRPRE9cclxuXHRcdHRoaXMuJHZtLmZpcmUoJ3Jvdy11cGRhdGUtYmVmb3JlJywgdGhpcywgcm93KTtcclxuXHJcblx0XHR2YXIgY29udGVudDtcclxuXHRcdHZhciBjZWxscyA9IHRoaXMuY2hpbGRyZW47XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwuZWFjaChjb2xNID0+IHtcclxuXHJcblx0XHRcdGNvbnRlbnQgPSBjb2xNLnJlbmRlcmVyKHJvdy5kYXRhW2NvbE0uZGF0YUluZGV4XSk7XHJcblx0XHRcdC8vIFRPRE8gYWRkQ2xhc3MoKCk9PiByb3cuY2VsbFtjb2xNLmRhdGFJbmRleF0uc2VsZWN0ZWQpXHJcblx0XHRcdGNlbGxzLmdldChjb2xNKS5odG1sKGNvbnRlbnQpO1xyXG5cclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuJG5vZGUuY3NzKCd0b3AnLCBvZmZzZXRUb3ApLmF0dHIoJ3JpZCcsIHJvdy5yaWQpO1xyXG5cclxuXHRcdHJldHVybiB0aGlzLiRub2RlO1xyXG5cdH1cclxufVxyXG5cclxuY2xhc3MgQnVmZmVyTm9kZSBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblx0Y29uc3RydWN0b3IobGltaXQsIGNvbHNNb2RlbCwgdG90YWwsIGNhY2hlVGltZXMpIHtcclxuXHRcdHN1cGVyKCk7XHJcblx0XHR0aGlzLmluaXQobGltaXQsIGNvbHNNb2RlbCwgdG90YWwsIGNhY2hlVGltZXMpO1xyXG5cdH1cclxuXHJcblx0aW5pdChsaW1pdCwgY29sc01vZGVsLCB0b3RhbCwgY2FjaGVUaW1lcykge1xyXG5cdFx0dGhpcy5saW1pdCA9IGxpbWl0O1xyXG5cdFx0dGhpcy50b3RhbCA9IHRvdGFsO1xyXG5cdFx0dGhpcy5jYWNoZVRpbWVzID0gY2FjaGVUaW1lcyB8fCAzO1xyXG5cdFx0dGhpcy5ub2RlTGlzdCA9IFtdO1xyXG5cdFx0dGhpcy5jb2xzTW9kZWwgPSBjb2xzTW9kZWw7XHJcblxyXG5cdFx0Ly8g6L+Z6YeM5pqC5Li6U2VsZWN0aW9u5a6e546w77yM5bqU6K+l55SoQU9Q57u05oqkIFRPRE9cclxuXHRcdC8vIHRoaXMub24oJ3Jvdy11cGRhdGUtYmVmb3JlJywgKHJvd05vZGUsIHJvdykgPT4gdGhpcy5maXJlKCdyb3ctdXBkYXRlJywgcm93Tm9kZSwgcm93KSk7XHJcblx0fVxyXG5cclxuXHRnZXROb2RlTGlzdCgpIHtcclxuXHRcdHJldHVybiB0aGlzLm5vZGVMaXN0O1xyXG5cdH1cclxuXHJcblx0c2V0TGltaXQobGltaXQpIHtcclxuXHRcdGlmICgrbGltaXQgPiAwKSB7XHJcblx0XHRcdHRoaXMuaW5pdChsaW1pdCwgdGhpcy5jb2xzTW9kZWwsIHRoaXMudG90YWwsIHRoaXMuY2FjaGVUaW1lcyk7XHJcblx0XHRcdHRoaXMuZmlyZSgnYnVmZmVyLWluaXRpYWwnKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHNldFRvdGFsKHRvdGFsKSB7XHJcblx0XHRpZiAoK3RvdGFsID49IDApIHtcclxuXHRcdFx0dGhpcy50b3RhbCA9IHRvdGFsO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0aXNFbm91Z2goKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5ub2RlTGlzdC5sZW5ndGggPj0gTWF0aC5taW4odGhpcy50b3RhbCwgdGhpcy5jYWNoZVRpbWVzICogdGhpcy5saW1pdCk7XHJcblx0fVxyXG5cclxuXHRnZXQoZGlyLCBkb21haW4pIHtcclxuXHRcdGlmICh0aGlzLmlzRW5vdWdoKCkpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuX2dldE5vZGVzKGRpciwgZG9tYWluKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcy5fYWRkTm9kZXMoZGlyLCBkb21haW4pO1xyXG5cdH1cclxuXHJcblx0X2dldE5vZGVzKGRpciwgW3N0YXJ0LCBlbmRdKSB7XHJcblx0XHR2YXIgc2VsZWN0ZWQ7XHJcblxyXG5cdFx0aWYgKGRpciA+IDApIHtcclxuXHRcdFx0c2VsZWN0ZWQgPSB0aGlzLm5vZGVMaXN0LnNsaWNlKDAsIGVuZCAtIHN0YXJ0ICsgMSk7XHJcblx0XHRcdHRoaXMubm9kZUxpc3QgPSB0aGlzLm5vZGVMaXN0LnNsaWNlKGVuZCAtIHN0YXJ0ICsgMSkuY29uY2F0KHNlbGVjdGVkKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHNlbGVjdGVkID0gdGhpcy5ub2RlTGlzdC5zbGljZShzdGFydCAtIGVuZCAtIDEpO1xyXG5cdFx0XHR0aGlzLm5vZGVMaXN0ID0gc2VsZWN0ZWQuY29uY2F0KHRoaXMubm9kZUxpc3Quc2xpY2UoMCwgc3RhcnQgLSBlbmQgLSAxKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHNlbGVjdGVkIHx8IFtdO1xyXG5cdH1cclxuXHJcblx0X2FkZE5vZGVzKGRpciwgW3N0YXJ0LCBlbmRdKSB7XHJcblx0XHR2YXIgbm9kZXMgPSBbXTtcclxuXHJcblx0XHRmb3IgKHZhciBpID0gc3RhcnQ7IGkgPD0gZW5kOyBpKyspIHtcclxuXHRcdFx0bm9kZXMucHVzaChuZXcgUm93Tm9kZSh0aGlzLmNvbHNNb2RlbCwgdGhpcykpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMubm9kZUxpc3QgPSBkaXIgPiAwID8gdGhpcy5ub2RlTGlzdC5jb25jYXQobm9kZXMpIDogbm9kZXMuY29uY2F0KHRoaXMubm9kZUxpc3QpO1xyXG5cclxuXHRcdHJldHVybiBub2RlcztcclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQnVmZmVyTm9kZTtcclxuIiwiY2xhc3MgQnVmZmVyWm9uZSB7XHJcblx0Y29uc3RydWN0b3IobGltaXQsIHRvdGFsLCBjYWNoZVRpbWVzKSB7XHJcblx0XHR0aGlzLmluaXQobGltaXQsIHRvdGFsLCBjYWNoZVRpbWVzKTtcclxuXHR9XHJcblxyXG5cdGluaXQobGltaXQsIHRvdGFsLCBjYWNoZVRpbWVzKSB7XHJcblx0XHR0aGlzLnN0YXJ0ID0gMDtcclxuXHRcdHRoaXMuZW5kID0gdGhpcy5saW1pdCA9IGxpbWl0O1xyXG5cdFx0dGhpcy50b3RhbCA9ICt0b3RhbDtcclxuXHRcdHRoaXMuY2FjaGVUaW1lcyA9IGNhY2hlVGltZXMgfHwgMztcclxuXHRcdHRoaXMuZG9tYWluID0gW3RoaXMuc3RhcnQsIHRoaXMuZW5kXTtcclxuXHR9XHJcblxyXG5cdHNldExpbWl0KGxpbWl0KSB7XHJcblx0XHRpZiAoK2xpbWl0ID4gMCkge1xyXG5cdFx0XHR0aGlzLmluaXQobGltaXQsIHRoaXMudG90YWwpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0c2V0VG90YWwodG90YWwpIHtcclxuXHRcdGlmICgrdG90YWwgPj0gMCkge1xyXG5cdFx0XHR0aGlzLnRvdGFsID0gdG90YWw7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRpc0Ftb25nKHZhbHVlKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5zdGFydCA8PSB2YWx1ZSAmJiB2YWx1ZSA8PSB0aGlzLmVuZDtcclxuXHR9XHJcblxyXG5cdHNob3VsZExvYWQoZGlyLCB2ZXJuaWVyKSB7XHJcblx0XHRpZiAoZGlyID09PSAwKSByZXR1cm4gZmFsc2U7XHJcblxyXG5cdFx0dmFyIHN0YXJ0ID0gdGhpcy5zdGFydDtcclxuXHRcdHZhciBlbmQgPSB0aGlzLmVuZDtcclxuXHRcdHZhciBjYWNoZVRpbWVzID0gdGhpcy5jYWNoZVRpbWVzO1xyXG5cclxuXHRcdC8vIHNjcm9sbCB1cFxyXG5cdFx0aWYgKGRpciA8IDAgJiYgc3RhcnQgPT09IDApIHJldHVybiBmYWxzZTtcclxuXHRcdGlmIChkaXIgPCAwICYmIHZlcm5pZXIgPCBzdGFydCArIHRoaXMubGltaXQpIHtcclxuXHRcdFx0aWYgKHRoaXMuaXNBbW9uZyh2ZXJuaWVyKSkge1xyXG5cdFx0XHRcdGVuZCA9IHN0YXJ0IC0gMTtcclxuXHRcdFx0XHRzdGFydCA9IE1hdGgubWF4KDAsIGVuZCAtIHRoaXMubGltaXQpO1xyXG5cdFx0XHR9IGVsc2UgaWYgKHZlcm5pZXIgPT09IDApIHtcclxuXHRcdFx0XHRlbmQgPSBNYXRoLm1pbih0aGlzLnRvdGFsLCB2ZXJuaWVyICsgY2FjaGVUaW1lcyAqIHRoaXMubGltaXQpO1xyXG5cdFx0XHRcdHN0YXJ0ID0gMDtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRlbmQgPSB2ZXJuaWVyICsgdGhpcy5saW1pdDtcclxuXHRcdFx0XHRzdGFydCA9IE1hdGgubWF4KDAsIHZlcm5pZXIgLSAoY2FjaGVUaW1lcyAtIDEpICogdGhpcy5saW1pdCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuZG9tYWluID0gW3N0YXJ0LCBlbmRdO1xyXG5cdFx0XHR0aGlzLnN0YXJ0ID0gc3RhcnQ7XHJcblx0XHRcdHRoaXMuZW5kID0gTWF0aC5taW4oc3RhcnQgKyBjYWNoZVRpbWVzICogdGhpcy5saW1pdCwgdGhpcy5lbmQpO1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBzY3JvbGwgZG93blxyXG5cdFx0aWYgKGRpciA+IDAgJiYgZW5kID09PSB0aGlzLnRvdGFsKSByZXR1cm4gZmFsc2U7XHJcblx0XHRpZiAoZGlyID4gMCAmJiB2ZXJuaWVyID4gZW5kIC0gdGhpcy5saW1pdCkge1xyXG5cdFx0XHQvLyDmuLjmoIflnKjnjrDmnInojIPlm7TlhoVcclxuXHRcdFx0aWYgKHRoaXMuaXNBbW9uZyh2ZXJuaWVyKSkge1xyXG5cdFx0XHRcdHN0YXJ0ID0gZW5kICsgMTtcclxuXHRcdFx0XHRlbmQgPSBNYXRoLm1pbih0aGlzLnRvdGFsLCBzdGFydCArIHRoaXMubGltaXQpO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIOa4uOagh+WIsOi+vue7k+WwvlxyXG5cdFx0XHRlbHNlIGlmICh2ZXJuaWVyID09PSB0aGlzLnRvdGFsKSB7XHJcblx0XHRcdFx0ZW5kID0gdGhpcy50b3RhbDtcclxuXHRcdFx0XHRzdGFydCA9IE1hdGgubWF4KDAsIHZlcm5pZXIgLSBjYWNoZVRpbWVzICogdGhpcy5saW1pdCk7XHJcblx0XHRcdH1cclxuXHRcdFx0Ly8g5LiN5Zyo546w5pyJ6IyD5Zu05Y+I5pyq5Yiw57uT5bC+5aSEXHJcblx0XHRcdGVsc2Uge1xyXG5cdFx0XHRcdGVuZCA9IE1hdGgubWluKHRoaXMudG90YWwsIHZlcm5pZXIgKyAoY2FjaGVUaW1lcyAtIDEpICogdGhpcy5saW1pdCk7XHJcblx0XHRcdFx0c3RhcnQgPSBNYXRoLm1heCgwLCBlbmQgLSBjYWNoZVRpbWVzICogdGhpcy5saW1pdCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuZG9tYWluID0gW3N0YXJ0LCBlbmRdO1xyXG5cdFx0XHR0aGlzLmVuZCA9IGVuZDtcclxuXHRcdFx0dGhpcy5zdGFydCA9IE1hdGgubWF4KHRoaXMuc3RhcnQsIGVuZCAtIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQnVmZmVyWm9uZTsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi4vdXRpbC9FdmVudEVtaXR0ZXInKTtcclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbC9VdGlscycpO1xyXG52YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwvc2hpbScpLl87XHJcblxyXG52YXIgZGVmUmVuZGVyZXIgPSB2ID0+IHY7XHJcbnZhciBPUkRFUiA9IFsnQVNDJywgJ0RFU0MnXTtcclxuXHJcbmNsYXNzIENvbHVtbiBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblx0Y29uc3RydWN0b3IoY2lkLCBvcHRpb25zLCBjb250ZXh0KSB7XHJcblx0XHRzdXBlcigpO1xyXG5cclxuXHRcdG9wdGlvbnMucmVuZGVyZXIgPSBvcHRpb25zLnJlbmRlcmVyIHx8IGRlZlJlbmRlcmVyO1xyXG5cclxuXHRcdHZhciBkZWZhdWx0cyA9IHtcclxuXHRcdFx0J3RleHQnOiAnJyxcclxuXHRcdFx0J3Z0eXBlJzogJ3N0cmluZycsXHJcblx0XHRcdCdkYXRhSW5kZXgnOiAnJyxcclxuXHRcdFx0J3dpZHRoJzogNTAsXHJcblx0XHRcdCdhbGlnbic6ICdsZWZ0JyxcclxuXHJcblx0XHRcdCdyZXNpemFibGUnOiB0cnVlLFxyXG5cdFx0XHQnY2xzJzogJycsXHJcblx0XHRcdCdmaXhlZCc6IGZhbHNlLFxyXG5cdFx0XHQnZHJhZ2dhYmxlJzogZmFsc2UsXHJcblx0XHRcdCdzb3J0YWJsZSc6IHRydWUsXHJcblx0XHRcdCdoaWRkZW4nOiBmYWxzZSxcclxuXHRcdFx0J2xvY2tlZCc6IGZhbHNlLFxyXG5cdFx0XHQnbG9ja2FibGUnOiB0cnVlLFxyXG5cdFx0XHQnbWVudURpc2FibGVkJzogdHJ1ZSxcclxuXHJcblx0XHRcdC8vIHByaXZhdGVcclxuXHRcdFx0J3NvcnRTdGF0ZSc6IG51bGxcclxuXHRcdH07XHJcblxyXG5cdFx0dGhpcy5jaWQgPSBjaWQ7XHJcblx0XHR0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xyXG5cdFx0T2JqZWN0LmFzc2lnbih0aGlzLCBkZWZhdWx0cywgb3B0aW9ucyk7XHJcblx0fVxyXG5cclxuXHRzZXRXaWR0aChudW0pIHtcclxuXHRcdGlmICghdGhpcy5yZXNpemFibGUpIHJldHVybjtcclxuXHRcdGlmIChpc05hTihudW0pKSByZXR1cm47XHJcblxyXG5cdFx0dGhpcy53aWR0aCA9ICtudW07XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1yZXNpemVkJywgdGhpcy53aWR0aCwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHRzaG93KCkge1xyXG5cdFx0dGhpcy5oaWRkZW4gPSBmYWxzZTtcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLWhpZGRlbicsIHRoaXMuaGlkZGVuLCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdGhpZGUoKSB7XHJcblx0XHR0aGlzLnVuTG9jaygpO1xyXG5cdFx0XHJcblx0XHR0aGlzLmhpZGRlbiA9IHRydWU7XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1oaWRkZW4nLCB0aGlzLmhpZGRlbiwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHR0b2dnbGUoKSB7XHJcblx0XHRpZiAodGhpcy5oaWRkZW4pIHtcclxuXHRcdFx0dGhpcy5zaG93KCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aGlzLmhpZGUoKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGxvY2soKSB7XHJcblx0XHRpZiAoIXRoaXMubG9ja2FibGUpIHJldHVybjtcclxuXHRcdGlmICh0aGlzLmxvY2tlZCkgcmV0dXJuO1xyXG5cclxuXHRcdHRoaXMuc2hvdygpO1xyXG5cclxuXHRcdHRoaXMubG9ja2VkID0gdHJ1ZTtcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLWxvY2tlZCcsIHRoaXMubG9ja2VkLCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdHVuTG9jaygpIHtcclxuXHRcdGlmICghdGhpcy5sb2NrYWJsZSkgcmV0dXJuO1xyXG5cdFx0aWYgKCF0aGlzLmxvY2tlZCkgcmV0dXJuO1xyXG5cclxuXHRcdHRoaXMubG9ja2VkID0gZmFsc2U7XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1sb2NrZWQnLCB0aGlzLmxvY2tlZCwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBvcmRlcltBU0MsIERFU0MsIE5PX1NPUlRdXHJcblx0ICovXHJcblx0c29ydChvcmRlcikge1xyXG5cdFx0aWYgKCF0aGlzLnNvcnRhYmxlIHx8ICF0aGlzLmRhdGFJbmRleCkgcmV0dXJuO1xyXG5cclxuXHRcdGlmIChvcmRlcikge1xyXG5cdFx0XHR0aGlzLnNvcnRTdGF0ZSA9IE9SREVSLmluY2x1ZGVzKG9yZGVyKSA/IG9yZGVyIDogbnVsbDtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoaXMuc29ydFN0YXRlID0gdGhpcy5zb3J0U3RhdGUgPT09IE9SREVSWzFdID8gT1JERVJbMF0gOiBPUkRFUlsxXTtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4tc29ydC1jaGFuZ2VkJywgdGhpcy5zb3J0U3RhdGUpO1xyXG5cdFx0dGhpcy5jb250ZXh0LmZpcmUoJ25vdGljZS1jb2xNb2RlbC1zb3J0LWNoYW5nZWQnKTtcclxuIFx0fVxyXG5cclxuIFx0cmVtb3ZlKCkge1xyXG4gXHRcdHRoaXMuZmlyZSgnZGVzdG9yeScpO1xyXG4gXHRcdHRoaXMuY29udGV4dC5maXJlKCdjb2x1bW4tcmVtb3ZlZCcsIHRoaXMpO1xyXG4gXHRcdHRoaXMucmVtb3ZlRXZlbnQoKTtcclxuIFx0fVxyXG59XHJcblxyXG5cclxuY2xhc3MgQ29sTW9kZWwgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cdGNvbnN0cnVjdG9yKGNvbHVtbnMpIHtcclxuXHRcdHN1cGVyKCk7XHJcblxyXG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KGNvbHVtbnMpKSB7XHJcblx0XHRcdHRocm93ICdyZXF1aXJlIHByb3BlcnR5IGNvbHVtbnMgaXMgYSBhcnJheSBvYmplY3QnO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuY29sdW1ucyA9IFtdOyAvLyBkYXRhIGJ5IGNvbHVtblxyXG5cdFx0dGhpcy5jb2xNb2RlbCA9IG5ldyBNYXAoKTsgLy8gZGF0YSBieSBjaWRcclxuXHRcdHRoaXMuY29sSGVhZGVycyA9IG5ldyBNYXAoKTsgLy8gZGF0YSBieSBkYXRhSW5kZXhcclxuXHJcblx0XHR0aGlzLl9pbml0Q29sdW1uKGNvbHVtbnMpO1xyXG5cdFx0dGhpcy5fYmluZEV2ZW50KCk7XHJcblx0fVxyXG5cclxuXHRfaW5pdENvbHVtbihjb2x1bW5zLCBjYWxsYmFjaykge1xyXG5cdFx0bGV0IHNpemUgPSB0aGlzLnNpemUoKTtcclxuXHJcblx0XHRjb2x1bW5zLmZvckVhY2goKGNvbCwgaW5kZXgpID0+IHtcclxuXHRcdFx0Ly8gY2lk6Kej5Yaz5rKh5pyJZGF0YUluZGV45YiX5oiW55u45ZCMZGF0YUluZGV45YiX55qE6Zeu6aKYXHJcblx0XHRcdGxldCBjaWQgPSBpbmRleCArIHNpemU7XHJcblx0XHRcdGxldCBjb2xNID0gbmV3IENvbHVtbihjaWQsIGNvbCwgdGhpcyk7XHJcblxyXG5cdFx0XHR0aGlzLmNvbE1vZGVsLnNldChjaWQsIGNvbE0pO1xyXG5cdFx0XHR0aGlzLmNvbHVtbnMucHVzaChjb2xNKTtcclxuXHRcdFx0dGhpcy5jb2xIZWFkZXJzLnNldChjb2wuZGF0YUluZGV4LCBjb2xNKTtcclxuXHJcblx0XHRcdGNhbGxiYWNrICYmIGNhbGxiYWNrKGNvbE0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRhZGRDb2x1bW5zKGNvbHVtbnMpIHtcclxuXHRcdGlmICghQXJyYXkuaXNBcnJheShjb2x1bW5zKSkge1xyXG5cdFx0XHRjb2x1bW5zID0gW2NvbHVtbnNdO1xyXG5cdFx0fVxyXG5cdFx0dGhpcy5faW5pdENvbHVtbihjb2x1bW5zLCBjb2xNID0+IHRoaXMuZmlyZSgnY29sdW1uLWFkZCcsIGNvbE0pKTtcclxuXHR9XHJcblxyXG5cdHJlbW92ZUNvbHVtbihkYXRhSW5kZXgpIHtcclxuXHRcdGlmICghQXJyYXkuaXNBcnJheShkYXRhSW5kZXgpKSB7XHJcblx0XHRcdGRhdGFJbmRleCA9IFtkYXRhSW5kZXhdO1xyXG5cdFx0fVxyXG5cclxuXHRcdGRhdGFJbmRleC5mb3JFYWNoKGRzID0+IHtcclxuXHRcdFx0bGV0IGNvbE0gPSB0aGlzLmdldENvbHVtbkJ5RGF0YUluZGV4KGRzKTtcclxuXHJcblx0XHRcdGlmIChjb2xNKSB7XHJcblx0XHRcdFx0Y29sTS5yZW1vdmUoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRfYmluZEV2ZW50KCkge1xyXG5cdFx0dGhpcy5vbignbm90aWNlLWNvbE1vZGVsLXNvcnQtY2hhbmdlZCcsIF8uZGVib3VuY2UoKCkgPT4ge1xyXG5cdFx0XHR0aGlzLmZpcmUoJ2NvbHVtbnMtc29ydC1jaGFuZ2VkJyk7XHJcblx0XHR9LCAyMCkpO1xyXG5cclxuXHRcdHRoaXMub24oJ2NvbHVtbi1yZW1vdmVkJywgY29sTSA9PiB7XHJcblx0XHRcdHRoaXMuY29sdW1ucyA9IHRoaXMuY29sdW1ucy5maWx0ZXIoY29sID0+IGNvbC5kYXRhSW5kZXggIT0gY29sTS5kYXRhSW5kZXgpO1xyXG5cdFx0XHR0aGlzLmNvbE1vZGVsLmRlbGV0ZShjb2xNLmNpZCk7XHJcblx0XHRcdHRoaXMuY29sSGVhZGVycy5kZWxldGUoY29sTS5kYXRhSW5kZXgpO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRzaXplKCkgeyBcclxuXHRcdHJldHVybiB0aGlzLmNvbE1vZGVsLnNpemU7IFxyXG5cdH1cclxuXHJcblx0Z2V0Q29sdW1uKGNvbCkge1xyXG5cdFx0aWYgKHRoaXMuY29sdW1ucy5pbmNsdWRlcyhjb2wpKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLmNvbHVtbnMuZmlsdGVyKF9jb2wgPT4gX2NvbCA9PSBjb2wpWzBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzLmNvbHVtbnM7XHJcblx0fVxyXG5cclxuXHRnZXRMb2NrQ29sdW1uKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuY29sdW1ucy5maWx0ZXIoY29sTSA9PiB7XHJcblx0XHRcdHJldHVybiBjb2xNLmxvY2tlZCA9PT0gdHJ1ZTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0Z2V0VmlzaWJsZUNvbHVtbigpIHtcclxuXHRcdHJldHVybiB0aGlzLmNvbHVtbnMuZmlsdGVyKGNvbE0gPT4ge1xyXG5cdFx0XHRyZXR1cm4gIWNvbE0uaGlkZGVuO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRnZXRDb2x1bW5CeURhdGFJbmRleChkYXRhSW5kZXgpIHtcclxuXHRcdHJldHVybiB0aGlzLmNvbEhlYWRlcnMuZ2V0KGRhdGFJbmRleCkgfHwgbnVsbDtcclxuXHR9XHJcblxyXG5cdGdldENvbHVtbnNCeUlkKGlkKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5jb2xNb2RlbFtpZF0gfHwgbnVsbDtcclxuXHR9XHJcblxyXG5cdGVhY2goY2FsbGJhY2ssIGNvbnRleHQpIHtcclxuXHRcdHRoaXMuY29sdW1ucy5mb3JFYWNoKGNhbGxiYWNrLCBjb250ZXh0IHx8IHRoaXMpO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHsgXHJcblxyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDb2xNb2RlbDsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi4vdXRpbC9FdmVudEVtaXR0ZXInKTtcclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbC9VdGlscycpO1xyXG52YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwvc2hpbScpLl87XHJcblxyXG5jbGFzcyBSb3cge1xyXG5cdGNvbnN0cnVjdG9yKHJpZCwgZGF0YSkge1xyXG5cdFx0dGhpcy5yaWQgPSByaWQ7XHJcblx0XHR0aGlzLmRhdGEgPSBkYXRhO1xyXG5cdFx0dGhpcy5zZWxlY3RlZCA9IGZhbHNlO1xyXG5cdH1cclxuXHRzdGF0ZSgpIHt9XHJcbn1cclxuXHJcbmNsYXNzIEdyaWRTdG9yZSBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblxyXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcclxuXHRcdHN1cGVyKCk7XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwgPSBvcHRpb25zLmNvbHVtbk1vZGVsO1xyXG5cclxuXHRcdHRoaXMucm93cyA9IFtdOyAvLyBkYXRhIGJ5IGluZGV4XHJcblx0XHR0aGlzLnJvd01vZGVsID0gbmV3IE1hcCgpOyAvLyBkYXRhIGJ5IGlkXHJcblxyXG5cclxuXHRcdHRoaXMuc2V0RGF0YShvcHRpb25zLmRhdGEpO1xyXG5cclxuXHRcdHRoaXMuX3NvcnRTdGF0ZSA9IHsga2V5czogW10sIGRpcnM6IFtdIH07XHJcblx0XHR0aGlzLl9iaW5kRXZlbnQoKTtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwuZWFjaChjb2xNID0+IHtcclxuXHRcdFx0Y29sTS5vbignY29sdW1uLXNvcnQtY2hhbmdlZCcsIHNvcnRTdGF0ZSA9PiB7XHJcblx0XHRcdFx0bGV0IHsga2V5cywgZGlycyB9ID0gdGhpcy5fc29ydFN0YXRlO1xyXG5cdFx0XHRcdGxldCBpbmRleCA9IGtleXMuaW5kZXhPZihjb2xNLmRhdGFJbmRleCk7XHJcblxyXG5cdFx0XHRcdC8vIOacquaOkuW6j1xyXG5cdFx0XHRcdGlmIChpbmRleCA9PT0gLTEgJiYgIXNvcnRTdGF0ZSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKGluZGV4ID09PSAtMSAmJiBzb3J0U3RhdGUpIHtcclxuXHRcdFx0XHRcdGtleXMudW5zaGlmdChjb2xNLmRhdGFJbmRleCk7XHJcblx0XHRcdFx0XHRkaXJzLnVuc2hpZnQoc29ydFN0YXRlLnRvTG93ZXJDYXNlKCkpO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8g5bey5o6S5bqPLOWFiOWIoOmZpFxyXG5cdFx0XHRcdGxldCBrZXkgPSBrZXlzLnNwbGljZShpbmRleCwgMSlbMF07XHJcblx0XHRcdFx0bGV0IGRpciA9IGRpcnMuc3BsaWNlKGluZGV4LCAxKVswXTtcclxuXHJcblx0XHRcdFx0aWYgKHNvcnRTdGF0ZSkge1xyXG5cdFx0XHRcdFx0a2V5cy51bnNoaWZ0KGtleSk7XHJcblx0XHRcdFx0XHRkaXJzLnVuc2hpZnQoc29ydFN0YXRlLnRvTG93ZXJDYXNlKCkpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Ly8g5omA5pyJ5YiX6YO95pu05paw54q25oCB5ZCOXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5vbignY29sdW1ucy1zb3J0LWNoYW5nZWQnLCAoKSA9PiB7XHJcblx0XHRcdGxldCB7IGtleXMsIGRpcnMgfSA9IHRoaXMuX3NvcnRTdGF0ZTtcclxuXHRcdFx0bGV0IGl0ZXJhdGVGbiA9IHJvdyA9PiByb3cuZGF0YVtrZXlzWzBdXTtcclxuXHJcblx0XHRcdC8vIGNvbnNvbGUubG9nKGtleXMsIGRpcnMpO1xyXG5cclxuXHRcdFx0dGhpcy5yb3dzID0gXy5vcmRlckJ5KHRoaXMucm93cywgaXRlcmF0ZUZuLCBkaXJzKTtcclxuXHRcdFx0dGhpcy5zZXREYXRhKF8ubWFwKHRoaXMucm93cywgJ2RhdGEnKSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdHNsaWNlKHN0YXJ0LCBlbmQpIHtcclxuXHRcdHJldHVybiB0aGlzLnJvd3Muc2xpY2Uoc3RhcnQsIGVuZCk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiDorr7nva7mjpLluo/nirbmgIFcclxuXHQgKiAoKylBU0MsIC1ERVNDLCAhTk9fU09SVFxyXG5cdCAqIEBzb3J0cyB7QXJyYXl9IHNvcnRzIC3mjpLluo/nirbmgIHmlbDnu4RcclxuXHQgKlx0c29ydHMgPSBbJytjb2xBJywgJ2NvbEInLCAnLWNvbEMnLCAnIWNvbEQnXVxyXG5cdCAqIEByZXR1cm5zIHRoaXM7XHJcblx0ICovXHJcblx0c2V0U29ydFN0YXRlKHNvcnRzKSB7XHJcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoc29ydHMpKSB7XHJcblx0XHRcdHNvcnRzID0gW3NvcnRzXTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9zb3J0U3RhdGUgPSB7IGtleXM6IFtdLCBkaXJzOiBbXSB9O1xyXG5cclxuXHRcdC8vIOWPjei9rOS8mOWFiOe6p+aWueS+v+WQjue7reinpuWPkemhuuW6j+aXtuWQjuinpuWPkeeahOS8mOWFiOe6p+mrmFxyXG5cdFx0c29ydHMucmV2ZXJzZSgpLmVhY2goc29ydE9iaiA9PiB7XHJcblx0XHRcdGxldCBvYmosIGtleSwgZGlyLCBjb2w7XHJcblxyXG5cdFx0XHRpZiAodHlwZW9mIHNvcnRPYmogPT09ICdzdHJpbmcnKSB7XHJcblx0XHRcdFx0b2JqID0gc29ydE9iai5tYXRjaCgvKF5bK3wtfCFdPykoLnswLH0pLyk7XHJcblx0XHRcdFx0ZGlyID0gb2JqWzFdID09PSAnJyA/ICdBU0MnIDogKG9iaiA9PT0gJy0nID8gJ0RFU0MnIDogJ05PX1NPUlQnKTtcclxuXHRcdFx0XHRrZXkgPSBvYmpbMl0gPyBvYmpbMl0gOiBudWxsO1xyXG5cclxuXHRcdFx0XHRjb2wgPSB0aGlzLmNvbHNNb2RlbC5nZXRDb2x1bW5CeURhdGFJbmRleChrZXkpO1xyXG5cdFx0XHRcdGlmIChjb2wpIHtcclxuXHRcdFx0XHRcdGNvbC5zb3J0KGRpcik7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdHNldERhdGEoZGF0YSA9IFtdLCBhcHBlbmQgPSBmYWxzZSkge1xyXG5cdFx0aWYgKCFhcHBlbmQpIHtcclxuXHRcdFx0dGhpcy5yb3dzLmxlbmd0aCA9IDA7XHJcblx0XHRcdHRoaXMucm93TW9kZWwuY2xlYXIoKTtcclxuXHRcdH1cclxuXHRcdHZhciBpbmRleCA9IHRoaXMuc2l6ZSgpO1xyXG5cdFx0ZGF0YS5mb3JFYWNoKChyb3csIHJpZHgpID0+IHtcclxuXHRcdFx0bGV0IHJvd00gPSBuZXcgUm93KHJpZHggKyBpbmRleCwgcm93KTtcclxuXHRcdFx0dGhpcy5yb3dzLnB1c2gocm93TSk7XHJcblx0XHRcdHRoaXMucm93TW9kZWwuc2V0KHJpZHggKyBpbmRleCwgcm93TSk7XHJcblx0XHR9KTtcclxuXHRcdHRoaXMuZmlyZSgnZGF0YS1jaGFuZ2VkJywgYXBwZW5kKTtcclxuXHR9XHJcblxyXG5cdGZvckVhY2goY2FsbGJhY2ssIGNvbnRleHQpIHtcclxuXHRcdHRoaXMucm93cy5mb3JFYWNoKGZ1bmN0aW9uKHJvd00sIHJpZHgpIHtcclxuXHRcdFx0Y2FsbGJhY2suY2FsbCh0aGlzLCByb3dNLmRhdGEsIHJpZHgpO1xyXG5cdFx0fSwgY29udGV4dCB8fCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdHNpemUoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yb3dNb2RlbC5zaXplO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHsgXHJcblxyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBHcmlkU3RvcmU7IiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJy4uL3V0aWwvRXZlbnRFbWl0dGVyJyk7XHJcbnZhciBDb2xNb2RlbCA9IHJlcXVpcmUoJy4vQ29sTW9kZWwnKTtcclxudmFyIEdyaWRTdG9yZSA9IHJlcXVpcmUoJy4vR3JpZFN0b3JlJyk7XHJcbnZhciBCdWZmZXJOb2RlID0gcmVxdWlyZSgnLi9CdWZmZXJOb2RlJyk7XHJcbnZhciBCdWZmZXJab25lID0gcmVxdWlyZSgnLi9CdWZmZXJab25lJyk7XHJcbnZhciBIZWFkZXIgPSByZXF1aXJlKCcuL0hlYWRlcicpO1xyXG52YXIgTG9ja0NvbE1hbmFnZXIgPSByZXF1aXJlKCcuL0xvY2tDb2xNYW5hZ2VyJyk7XHJcbnZhciBTY3JvbGxlciA9IHJlcXVpcmUoJy4vU2Nyb2xsZXInKTtcclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbC9VdGlscycpO1xyXG5cclxuZnVuY3Rpb24gY3JlYXRlTGF5b3V0KGNvbnRhaW5lciwgd2lkdGgpIHtcclxuXHR2YXIgd3JhcHBlciA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWdyaWQtd3JhcHBlcicpLndpZHRoKHdpZHRoKTtcclxuXHR2YXIgaGVhZGVyID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC1oZWFkZXInKTtcclxuXHR2YXIgYm9keSA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWdyaWQtYm9keScpO1xyXG5cdHZhciB2aWV3cG9ydCA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWdyaWQtdmlld3BvcnQnKS5hcHBlbmRUbyhib2R5KTtcclxuXHR2YXIgY2FudmFzID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC1jYW52YXMnKS5hcHBlbmRUbyh2aWV3cG9ydCk7XHJcblx0d3JhcHBlci5hcHBlbmQoaGVhZGVyKS5hcHBlbmQoYm9keSkuYXBwZW5kVG8oY29udGFpbmVyKTtcclxuXHJcblx0cmV0dXJuIHsgd3JhcHBlciwgaGVhZGVyLCBib2R5LCB2aWV3cG9ydCwgY2FudmFzIH07XHJcbn1cclxuZnVuY3Rpb24gY2FsY1Jvd0hlaWdodCgpIHtcclxuXHR2YXIgbGkgPSAkKCc8bGkgY2xhc3M9XCJjLWdyaWQtY2VsbFwiPnBsYWNlaG9sZGVyPC9saT4nKS5hcHBlbmRUbyhcImJvZHlcIik7XHJcblx0dmFyIHJvd0hlaWdodCA9IGxpLm91dGVySGVpZ2h0KCk7XHJcblx0bGkucmVtb3ZlKCk7XHJcblxyXG5cdHJldHVybiByb3dIZWlnaHQ7XHJcbn1cclxuXHJcbmNsYXNzIEdyaWRDb21wb25lbnQgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcclxuXHRcdHN1cGVyKCk7XHJcblxyXG5cdFx0aWYgKCEkKG9wdGlvbnMuZG9tRWwpLnNpemUoKSkgeyB0aHJvdyAncmVxdWlyZSBhIHZhbGlkIGRvbUVsJzsgfVxyXG5cclxuXHRcdHRoaXMuc2hvdWxkQWRkTm9kZXMgPSB0cnVlO1xyXG5cdFx0dGhpcy5oZWlnaHQgPSArb3B0aW9ucy5oZWlnaHQgfHwgNTAwO1xyXG5cdFx0dGhpcy53aWR0aCA9IG9wdGlvbnMud2lkdGg7XHJcblxyXG5cdFx0Ly8gJGxheW91dCBkb21cclxuXHRcdE9iamVjdC5hc3NpZ24odGhpcy4kZG9tID0ge30sIGNyZWF0ZUxheW91dCgkKG9wdGlvbnMuZG9tRWwpLCB0aGlzLndpZHRoKSk7XHJcblxyXG5cdFx0dGhpcy5jb2x1bW5Nb2RlbCA9IG5ldyBDb2xNb2RlbChvcHRpb25zLmNvbHVtbnMpO1xyXG5cdFx0dGhpcy5zdG9yZSA9IG5ldyBHcmlkU3RvcmUoeyBjb2x1bW5Nb2RlbDogdGhpcy5jb2x1bW5Nb2RlbCwgJ2RhdGEnOiBvcHRpb25zLmRhdGEgfHwgW10gfSk7XHJcblx0XHR0aGlzLl9pbml0KCk7XHJcblx0XHR0aGlzLl9iaW5kRXZlbnQoKTtcclxuXHR9XHJcblxyXG5cdF9pbml0KCkge1xyXG5cdFx0dGhpcy5oZWFkZXIgPSBuZXcgSGVhZGVyKHRoaXMuJGRvbS5oZWFkZXIsIHRoaXMuY29sdW1uTW9kZWwpO1xyXG5cdFx0dmFyIHRvdGFsID0gdGhpcy5zdG9yZS5zaXplKCk7XHJcblx0XHR2YXIgcm93SGVpZ2h0ID0gdGhpcy5yb3dIZWlnaHQgPSBjYWxjUm93SGVpZ2h0KCk7XHJcblx0XHR2YXIgdmlld3BvcnRIZWlnaHQgPSB0aGlzLmhlaWdodCAtIHRoaXMuJGRvbS5oZWFkZXIub3V0ZXJIZWlnaHQoKTtcclxuXHRcdHZhciBzaW5nbGVQYWdlU2l6ZSA9IE1hdGgubWluKE1hdGguY2VpbCh2aWV3cG9ydEhlaWdodC8gcm93SGVpZ2h0KSAtIDEsIHRvdGFsIC0gMSk7XHJcblxyXG5cdFx0dGhpcy5idWZmZXJab25lID0gbmV3IEJ1ZmZlclpvbmUoc2luZ2xlUGFnZVNpemUsIHRvdGFsKTtcclxuXHRcdHRoaXMuYnVmZmVyTm9kZSA9IG5ldyBCdWZmZXJOb2RlKHNpbmdsZVBhZ2VTaXplLCB0aGlzLmNvbHVtbk1vZGVsLCB0b3RhbCk7XHJcblx0XHR0aGlzLnNjcm9sbGVyID0gbmV3IFNjcm9sbGVyKHJvd0hlaWdodCwgdGhpcy5idWZmZXJab25lKTtcclxuXHRcdHRoaXMuc2Nyb2xsZXJcclxuXHRcdFx0Lm9uWCh4ID0+IHtcclxuXHRcdFx0XHR0aGlzLmZpcmUoJ3Njcm9sbExlZnQnLCB4KTtcclxuXHRcdFx0XHR0aGlzLiRkb20uaGVhZGVyLnNjcm9sbExlZnQoeCk7XHJcblx0XHRcdH0pXHJcblx0XHRcdC5vblkoKGRpciwgZG9tYWluLCBzdGFydCwgZW5kLCBpbmRleCwgdG90YWwpID0+IHtcclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyhg5rua5Yqo5pa55ZCR77yaJHtkaXJ9LCDliqDovb3ljLrpl7Q6IFske2RvbWFpbn1dLCDnjrDmnInojIPlm7TvvJooJHtzdGFydH0gLSAke2VuZH0pLCBgKVxyXG5cdFx0XHRcdHRoaXMuX2J1ZmZlclJlbmRlcihkaXIsIGRvbWFpbik7XHJcblx0XHRcdH0sIDIwKTtcclxuXHJcblx0XHR0aGlzLiRkb20udmlld3BvcnQuaGVpZ2h0KHZpZXdwb3J0SGVpZ2h0KTtcclxuXHRcdHRoaXMuJGRvbS52aWV3cG9ydC5vbignc2Nyb2xsJywgKGV2dCkgPT4ge1xyXG5cdFx0XHR0aGlzLnNjcm9sbGVyLmZpcmVZKGV2dC50YXJnZXQuc2Nyb2xsVG9wKTtcclxuXHRcdFx0dGhpcy5zY3JvbGxlci5maXJlWChldnQudGFyZ2V0LnNjcm9sbExlZnQpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5sb2NrQ29sTWFuYWdlciA9IExvY2tDb2xNYW5hZ2VyKHRoaXMuY29sdW1uTW9kZWwsIHRoaXMuaGVhZGVyLCB0aGlzLiRkb20sIHRoaXMuYnVmZmVyTm9kZSk7XHJcblx0XHR0aGlzLl9zZXRDYW52YXNXSCh0b3RhbCk7XHJcblx0fVxyXG5cclxuXHRfc2V0Q2FudmFzV0godG90YWwpIHtcclxuXHRcdHRoaXMuJGRvbS5jYW52YXNcclxuXHRcdFx0LndpZHRoKHRvdGFsID8gJ2F1dG8nIDogdGhpcy5fdW5Mb2NrVmlzaWJsZUNvbHNXaWR0aCgpKVxyXG5cdFx0XHQuaGVpZ2h0KHRoaXMucm93SGVpZ2h0ICogdG90YWwgfHwgMSk7XHJcblx0fVxyXG5cclxuXHRfdW5Mb2NrVmlzaWJsZUNvbHNXaWR0aCgpIHtcclxuXHRcdHJldHVybiB0aGlzLmhlYWRlci5nZXRWaXNpYmxlQ29sc1dpZHRoKCkgKyB0aGlzLmxvY2tDb2xNYW5hZ2VyLnZpc2libGVMb2NrQ29sdW1uLmdldFdpZHRoKCk7XHJcblx0fVxyXG5cclxuXHRzY3JvbGxUb1RvcChwb3NpdGlvbikge1xyXG5cdFx0dGhpcy4kZG9tLnZpZXdwb3J0LnNjcm9sbFRvcChwb3NpdGlvbik7XHJcblx0fVxyXG5cclxuXHRfYmluZEV2ZW50KCkge1xyXG5cdFx0dGhpcy5vbigndmlld3BvcnQtaGVpZ2h0LWNoYW5nZWQnLCB2aWV3cG9ydEhlaWdodCA9PiB7XHJcblx0XHRcdHRoaXMuX3VwZGF0ZUJ1ZmZlcigpO1xyXG5cdFx0XHR0aGlzLnJlbmRlcigpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5vbignc2Nyb2xsTGVmdCcsIHggPT4ge1xyXG5cdFx0XHQvLyBwZXJmb3JtYW5jZSBUT0RPXHJcblx0XHRcdC8vIGxldCBsb2NrQ29sdW1uV2lkdGggPSB0aGlzLmhlYWRlci5nZXRWaXNpYmxlTG9ja0NvbHNXaWR0aCgpO1xyXG5cdFx0XHQvLyB0aGlzLiRkb20uY2FudmFzLmZpbmQoJy5jLWNvbHVtbi1sb2NrZWQnKS5jc3MoJ2xlZnQnLCB4IC0gbG9ja0NvbHVtbldpZHRoKTtcclxuXHRcdFx0Ly8gdGhpcy4kZG9tLmhlYWRlci5maW5kKCcuYy1jb2x1bW4tbG9ja2VkJykuY3NzKCdsZWZ0JywgeCAtIGxvY2tDb2x1bW5XaWR0aCk7XHJcblx0XHRcdHRoaXMubG9ja0NvbE1hbmFnZXIuc2V0TG9ja0NvbHVtblgoeCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLnN0b3JlLm9uKCdkYXRhLWNoYW5nZWQnLCAoYXBwZW5kKSA9PiB7XHJcblx0XHRcdGxldCB0b3RhbCA9IHRoaXMuc3RvcmUuc2l6ZSgpO1xyXG5cdFx0XHR0aGlzLl9zZXRDYW52YXNXSCh0b3RhbCk7XHJcblx0XHRcdHRoaXMuYnVmZmVyTm9kZS5zZXRUb3RhbCh0b3RhbCk7XHJcblx0XHRcdHRoaXMuYnVmZmVyWm9uZS5zZXRUb3RhbCh0b3RhbCk7XHJcblxyXG5cdFx0XHRpZiAoIWFwcGVuZCB8fCAodG90YWwgLSAxKSAqIHRoaXMucm93SGVpZ2h0IDwgMip0aGlzLiRkb20udmlld3BvcnQub3V0ZXJIZWlnaHQoKSkge1xyXG5cdFx0XHRcdHRoaXMuX3VwZGF0ZUJ1ZmZlcigpO1xyXG5cdFx0XHRcdHRoaXMucmVuZGVyKCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHR9XHJcblxyXG5cdF91cGRhdGVCdWZmZXIoKSB7XHJcblx0XHR2YXIgbGltaXQgPSBNYXRoLm1pbihcclxuXHRcdFx0TWF0aC5jZWlsKHRoaXMuJGRvbS52aWV3cG9ydC5vdXRlckhlaWdodCgpIC8gdGhpcy5yb3dIZWlnaHQpIC0gMSxcclxuXHRcdFx0dGhpcy5zdG9yZS5zaXplKCkgLSAxKTtcclxuXHJcblx0XHR0aGlzLmJ1ZmZlclpvbmUuc2V0TGltaXQobGltaXQpO1xyXG5cdFx0dGhpcy5idWZmZXJOb2RlLnNldExpbWl0KGxpbWl0KTtcclxuXHRcdHRoaXMuc2hvdWxkQWRkTm9kZXMgPSB0cnVlO1xyXG5cdFx0dGhpcy5zY3JvbGxUb1RvcCgwKTtcclxuXHJcblx0XHR0aGlzLiRkb20uY2FudmFzLmVtcHR5KCk7XHJcblx0fVxyXG5cclxuXHRfYnVmZmVyUmVuZGVyKGRpciwgW3N0YXJ0LCBlbmRdKSB7XHJcblx0XHR2YXIgbm9kZXMgPSB0aGlzLmJ1ZmZlck5vZGUuZ2V0KGRpciwgW3N0YXJ0LCBlbmRdKTtcclxuXHRcdGNvbnNvbGUubG9nKCfkuIDmrKHojrflj5boioLngrnplb/luqYnLCBub2Rlcy5sZW5ndGgsIHN0YXJ0LCBlbmQpO1xyXG5cclxuXHRcdGlmICghdGhpcy5zaG91bGRBZGROb2Rlcykge1xyXG5cdFx0XHR0aGlzLnN0b3JlLnNsaWNlKHN0YXJ0LCBlbmQgKyAxKS5mb3JFYWNoKChyb3dNLCBpKSA9PiB7XHJcblx0XHRcdFx0bm9kZXNbaV0uc2V0RGF0YShyb3dNLCByb3dNLnJpZCAqIHRoaXMucm93SGVpZ2h0KTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHR2YXIgJGRvY0ZyYW1lID0gJCgnPGRpdi8+Jyk7XHJcblx0XHR0aGlzLnN0b3JlLnNsaWNlKHN0YXJ0LCBlbmQgKyAxKS5mb3JFYWNoKChyb3dNLCBpKSA9PiB7XHJcblxyXG5cdFx0XHRsZXQgbm9kZSA9IG5vZGVzW2ldLnNldERhdGEocm93TSwgcm93TS5yaWQgKiB0aGlzLnJvd0hlaWdodCk7XHJcblx0XHRcdCRkb2NGcmFtZS5hcHBlbmQobm9kZSk7XHJcblx0XHRcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuJGRvbS5jYW52YXMuYXBwZW5kKCRkb2NGcmFtZS5jaGlsZHJlbigpKTtcclxuXHRcdHRoaXMubG9ja0NvbE1hbmFnZXIuYWRkQnVmZmVyTG9ja05vZGUobm9kZXMpO1xyXG5cclxuXHRcdGlmICh0aGlzLmJ1ZmZlck5vZGUuaXNFbm91Z2goKSkge1xyXG5cdFx0XHR0aGlzLnNob3VsZEFkZE5vZGVzID0gZmFsc2U7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZW5kZXIoKSB7XHJcblx0XHR0aGlzLl9idWZmZXJSZW5kZXIoMSwgdGhpcy5idWZmZXJab25lLmRvbWFpbik7XHJcblx0fVxyXG5cclxuXHRzZXRXaWR0aChudW0pIHtcclxuXHRcdGlmIChpc05hTihudW0pKSByZXR1cm47XHJcblxyXG5cdFx0dGhpcy4kZG9tLndyYXBwZXIud2lkdGgobnVtKTtcclxuXHR9XHJcblxyXG5cdHNldEhlaWdodChudW0pIHtcclxuXHRcdGlmIChpc05hTihudW0pKSByZXR1cm47XHJcblxyXG5cdFx0dmFyIHZpZXdwb3J0SGVpZ2h0ID0gbnVtIC0gdGhpcy4kZG9tLmhlYWRlci5vdXRlckhlaWdodCgpO1xyXG5cdFx0dGhpcy4kZG9tLnZpZXdwb3J0Lm91dGVySGVpZ2h0KHZpZXdwb3J0SGVpZ2h0KTtcclxuXHRcdHRoaXMuZmlyZSgndmlld3BvcnQtaGVpZ2h0LWNoYW5nZWQnLCB2aWV3cG9ydEhlaWdodCk7XHJcblx0fVxyXG5cclxuXHRkZXN0b3J5KCkge1xyXG5cdFx0dGhpcy5jb2x1bW5Nb2RlbC5kZXN0b3J5KCk7XHJcblx0XHR0aGlzLnN0b3JlLmRlc3RvcnkoKTtcclxuXHRcdHRoaXMuaGVhZGVyLmRlc3RvcnkoKTtcclxuXHRcdHRoaXMuJGRvbS53cmFwcGVyLnJlbW92ZSgpO1xyXG5cdH1cclxufVxyXG5tb2R1bGUuZXhwb3J0cyA9IEdyaWRDb21wb25lbnQ7IiwiY29uc3QgeyAkLCBfIH0gPSByZXF1aXJlKCcuLi91dGlsL3NoaW0nKTtcclxuY29uc3QgREQgPSByZXF1aXJlKCcuLi91dGlsL0REJyk7XHJcblxyXG5jb25zdCBTT1JUX0NMU19BU0MgPSAnYy1jb2x1bW4tYXNjJztcclxuY29uc3QgU09SVF9DTFNfREVTQyA9ICdjLWNvbHVtbi1kZXNjJztcclxuY29uc3QgTkVFRExFU1NfV0lEVEggPSAxMDAwO1xyXG5cclxudmFyIGNyZWF0ZUNvbHVtbkVsZW1lbnQgPSBmdW5jdGlvbihjb2xNKSB7XHJcblx0dmFyIGxvY2tDbGFzcyA9IGNvbE0ubG9ja2VkID8gJyBjLWNvbHVtbi1sb2NrZWQnIDogJyc7XHJcblxyXG5cdHJldHVybiAkKCc8bGkvPicpXHJcblx0XHQuYWRkQ2xhc3MoJ2MtaGVhZGVyLWNlbGwnICsgbG9ja0NsYXNzKVxyXG5cdFx0LmFkZENsYXNzKCdjLWFsaWduLScgKyBjb2xNLmFsaWduKVxyXG5cdFx0LndpZHRoKGNvbE0ud2lkdGgpXHJcblx0XHQub24oJ2NsaWNrJywgKCkgPT4geyBjb2xNLnNvcnQoKTsgfSlcclxuXHRcdC5kYXRhKCdjb2x1bW4nLCBjb2xNKVxyXG5cdFx0Lmh0bWwoY29sTS50ZXh0KTtcclxufTtcclxuXHJcblxyXG5jbGFzcyBIZWFkZXIge1xyXG5cdGNvbnN0cnVjdG9yKCRoZWFkZXIsIGNvbHNNb2RlbCkge1xyXG5cclxuXHRcdHRoaXMuJGhlYWRlciA9ICRoZWFkZXI7XHJcblx0XHR0aGlzLmNvbHNNb2RlbCA9IGNvbHNNb2RlbDtcclxuXHRcdC8vIHRoaXMuc3RvcmUgPSBzdG9yZTtcclxuXHRcdHRoaXMuY29sRWxlbWVudHMgPSBuZXcgTWFwKCk7XHJcblxyXG5cdFx0dGhpcy5fY3JlYXRlQ29sdW1uRWxlbWVudHMoKTtcclxuXHRcdHRoaXMuX2JpbmRFdmVudCgpO1xyXG5cclxuXHRcdHRoaXMucmVuZGVyKCk7XHJcblx0fVxyXG5cclxuXHRfY3JlYXRlQ29sdW1uRWxlbWVudHMoKSB7XHJcblx0XHR2YXIgd2lkdGggPSBORUVETEVTU19XSURUSDtcclxuXHJcblx0XHR0aGlzLiRyb3cgPSAkKCc8dWwvPicpLmFkZENsYXNzKCdjLWhlYWRlci1yb3cnKTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRsZXQgY29sRWxlbWVudCA9IGNyZWF0ZUNvbHVtbkVsZW1lbnQoY29sTSk7XHJcblxyXG5cdFx0XHR0aGlzLmNvbEVsZW1lbnRzLnNldChjb2xNLCBjb2xFbGVtZW50KTtcclxuXHRcdFx0dGhpcy4kcm93LmFwcGVuZChjb2xFbGVtZW50KTtcclxuXHJcblx0XHRcdHdpZHRoICs9IGNvbE0ud2lkdGg7XHJcblxyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kcm93LndpZHRoKHdpZHRoKTtcclxuXHR9XHJcblxyXG5cdGdldFZpc2libGVDb2xzV2lkdGgoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy4kcm93LndpZHRoKCkgLSBORUVETEVTU19XSURUSDtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHR0aGlzLl9jb2x1bW5SZXNpemUoKTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5vbignY29sdW1uLWFkZCcsIGNvbE0gPT4ge1xyXG5cdFx0XHRsZXQgY29sRWxlbWVudCA9IGNyZWF0ZUNvbHVtbkVsZW1lbnQoY29sTSk7XHJcblxyXG5cdFx0XHR0aGlzLmNvbEVsZW1lbnRzLnNldChjb2xNLCBjb2xFbGVtZW50KTtcclxuXHRcdFx0dGhpcy4kcm93LmFwcGVuZChjb2xFbGVtZW50KTtcclxuXHJcblx0XHRcdGxldCByb3dXID0gdGhpcy4kcm93LndpZHRoKCk7XHJcblx0XHRcdHRoaXMuJHJvdy53aWR0aChyb3dXICsgY29sTS53aWR0aCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLXJlc2l6ZWQnLCB3aWR0aCA9PiB0aGlzLmNvbEVsZW1lbnRzLmdldChjb2xNKS5vdXRlcldpZHRoKHdpZHRoKSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4taGlkZGVuJywgaXNIaWRkZW4gPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHRcdFx0XHRpZiAoaXNIaWRkZW4pIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcygnYy1jb2x1bW4taGlkZScpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoJ2MtY29sdW1uLWhpZGUnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWxvY2tlZCcsIGlzTG9ja2VkID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdGlmIChpc0xvY2tlZCkge1xyXG5cdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKCdjLWNvbHVtbi1sb2NrZWQnKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKCdjLWNvbHVtbi1sb2NrZWQnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLXNvcnQtY2hhbmdlZCcsIHNvcnRTdGF0ZSA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyhzb3J0U3RhdGUpO1xyXG5cdFx0XHRcdGlmIChzb3J0U3RhdGUpIHtcclxuXHRcdFx0XHRcdGlmIChzb3J0U3RhdGUgPT09ICdBU0MnKSB7XHJcblx0XHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcyhTT1JUX0NMU19BU0MpO1xyXG5cdFx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoU09SVF9DTFNfREVTQyk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRjb2xFbGUuYWRkQ2xhc3MoU09SVF9DTFNfREVTQyk7XHJcblx0XHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcyhTT1JUX0NMU19BU0MpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoU09SVF9DTFNfQVNDKS5yZW1vdmVDbGFzcyhTT1JUX0NMU19ERVNDKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignZGVzdG9yeScsICgpID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblx0XHRcdFx0dGhpcy5jb2xFbGVtZW50cy5kZWxldGUoY29sTSk7XHRcdFx0XHJcblx0XHRcdFx0Y29sRWxlLnJlbW92ZSgpO1xyXG5cclxuXHRcdFx0XHRsZXQgcm93VyA9IHRoaXMuJHJvdy53aWR0aCgpO1xyXG5cdFx0XHRcdHRoaXMuJHJvdy53aWR0aChyb3dXIC0gY29sTS53aWR0aCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRfY29sdW1uUmVzaXplKCkge1xyXG5cdFx0dGhpcy4kcm93Lm9uKCdtb3VzZW1vdmUnLCAnbGkuYy1oZWFkZXItY2VsbCcsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHR2YXIgb2Zmc2V0WCA9IGV2dC5vZmZzZXRYO1xyXG5cdFx0XHRpZiAodGhpcy5vZmZzZXRXaWR0aCAtIG9mZnNldFggPD0gNSB8fCBvZmZzZXRYIDw9IDUpIHtcclxuXHRcdFx0XHQkKHRoaXMpLmFkZENsYXNzKCdjLWNvbC1yZXNpemFibGUnKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHQkKHRoaXMpLnJlbW92ZUNsYXNzKCdjLWNvbC1yZXNpemFibGUnKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblxyXG5cclxuXHRcdHZhciBzdGFydFggPSAwO1xyXG5cclxuXHRcdEREKHRoaXMuJHJvdywge1xyXG5cdFx0XHQndHJpZ2dlcic6ICdsaS5jLWhlYWRlci1jZWxsJyxcclxuXHRcdFx0J3Jlc3RyaWN0ZXInOiBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHR2YXIgb2Zmc2V0WCA9IGV2dC5vZmZzZXRYO1xyXG5cdFx0XHRcdGNvbnNvbGUubG9nKHRoaXMub2Zmc2V0V2lkdGgsIG9mZnNldFgsIHRoaXMuaW5uZXJUZXh0KTtcclxuXHRcdFx0XHRpZiAodGhpcy5vZmZzZXRXaWR0aCAtIG9mZnNldFggPD0gNSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuICQodGhpcyk7XHJcblx0XHRcdFx0fSBlbHNlIGlmIChvZmZzZXRYIDw9IDUpIHtcclxuXHRcdFx0XHRcdHJldHVybiAkKHRoaXMpLnByZXYoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sXHJcblx0XHRcdCdvbkRyYWdTdGFydCc6IF8uZGVib3VuY2UoZnVuY3Rpb24ob2Zmc2V0LCAkdGFyZ2V0KSB7XHJcblx0XHRcdFx0dmFyIHNjcm9sbExlZnQgPSBkb2N1bWVudC5ib2R5LnNjcm9sbExlZnQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbExlZnQ7XHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coJHRhcmdldC5vZmZzZXQoKS5sZWZ0LCAkdGFyZ2V0LnRleHQoKSk7XHJcblx0XHRcdFx0c3RhcnRYID0gJHRhcmdldC5vZmZzZXQoKS5sZWZ0IC0gc2Nyb2xsTGVmdDtcclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyhvZmZzZXQueCwgJHRhcmdldC50ZXh0KCkpO1xyXG5cclxuXHRcdFx0XHQvLyBzdGFydFggPSBvZmZzZXQueDtcclxuXHRcdFx0fSwgODApLFxyXG5cdFx0XHQnb25EcmFnZ2luZyc6IGZ1bmN0aW9uKG9mZnNldCwgJHRhcmdldCkge1xyXG5cclxuXHRcdFx0fSxcclxuXHRcdFx0J29uRHJhZ0VuZCc6IF8uZGVib3VuY2UoZnVuY3Rpb24ob2Zmc2V0LCAkdGFyZ2V0KSB7XHJcblx0XHRcdFx0dmFyIHdpZHRoID0gb2Zmc2V0LnggLSBzdGFydFg7XHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coYCR7JHRhcmdldC50ZXh0KCl9XHJcblx0XHRcdFx0Ly8gXHTljp/lrr3luqbkuLokeyR0YXJnZXQuZGF0YSgnY29sdW1uJykud2lkdGh9LFxyXG5cdFx0XHRcdC8vIFx05pS55Y+Y5Li677yaJHt3aWR0aH0sIFske29mZnNldC54fSAtICR7c3RhcnRYfV1gKTtcclxuXHRcdFx0XHQkdGFyZ2V0LmRhdGEoJ2NvbHVtbicpLnNldFdpZHRoKHdpZHRoKTtcclxuXHRcdFx0fSwgODApXHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdHJlbmRlcigpIHtcclxuXHRcdHRoaXMuJGhlYWRlci5hcHBlbmQodGhpcy4kcm93KTtcclxuXHR9XHJcblxyXG5cdGRlc3RvcnkoKSB7XHJcblxyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBIZWFkZXI7IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuY2xhc3MgTG9ja0NvbHVtbiB7XHJcblx0Y29uc3RydWN0b3IoKSB7XHJcblx0XHR0aGlzLl9kYXRhID0gW107XHJcblx0XHR0aGlzLl9jb2x1bW5zV2lkdGggPSAwO1xyXG5cdH1cclxuXHJcblx0YWRkKGNvbE0pIHtcclxuXHRcdHRoaXMuX2RhdGEudW5zaGlmdChjb2xNKTtcclxuXHRcdHRoaXMucmVDYWxjKCk7XHJcblx0fVxyXG5cclxuXHRyZW1vdmUoZGVsQ29sTSkge1xyXG5cdFx0dGhpcy5fZGF0YSA9IHRoaXMuX2RhdGEuZmlsdGVyKGNvbE0gPT4gY29sTSAhPT0gZGVsQ29sTSk7XHJcblx0XHR0aGlzLnJlQ2FsYygpO1xyXG5cdH1cclxuXHJcblx0Y2xlYXIoKSB7XHJcblx0XHR0aGlzLl9kYXRhLmxlbmd0aCA9IDA7XHJcblx0XHR0aGlzLnJlQ2FsYygpO1xyXG5cdH1cclxuXHJcblx0Z2V0V2lkdGgoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fY29sdW1uc1dpZHRoO1xyXG5cdH1cclxuXHJcblx0cmVDYWxjKCkge1xyXG5cdFx0dGhpcy5fY29sdW1uc1dpZHRoID0gdGhpcy5fZGF0YS5yZWR1Y2UoKHdpZHRoLCBjb2xNKSA9PiB7XHJcblx0XHRcdHdpZHRoIC09IGNvbE0ud2lkdGg7XHJcblx0XHRcdGNvbE0uYXdheUZyb21MZWZ0ID0gd2lkdGg7XHJcblx0XHRcdHJldHVybiB3aWR0aDtcclxuXHRcdH0sIDApO1xyXG5cdH1cclxuXHJcblx0ZWFjaChmbikge1xyXG5cdFx0dGhpcy5fZGF0YS5mb3JFYWNoKGZuKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIOW9k+WFtuS4reS4gOWIl+WPkeeUn+WPmOWMlu+8jOmAmuefpeWFtuWug+WIl+ebuOW6lOWPmOWMllxyXG5cdCAqL1xyXG5cdCBwdWJsaXNoKGNoYW5nZWRDb2xNLCBzY3JvbGxMZWZ0KSB7XHJcblx0IFx0dGhpcy5fZGF0YS5mb3JFYWNoKGNvbE0gPT4ge1xyXG5cdCBcdFx0aWYgKGNvbE0gIT09IGNoYW5nZWRDb2xNKSB7XHJcblx0IFx0XHRcdGNvbE0uZmlyZSgnc2Nyb2xsLXgnLCBzY3JvbGxMZWZ0KTtcclxuXHQgXHRcdH1cclxuXHQgXHR9KTtcclxuXHQgfVxyXG59XHJcblxyXG52YXIgTG9ja0NvbE1hbmFnZXIgPSBmdW5jdGlvbihjb2xzTW9kZWwsIGhlYWRlciwgJGRvbSwgYnVmZmVyTm9kZSkge1xyXG5cdGxldCB2aXNpYmxlTG9ja0NvbHVtbiA9IG5ldyBMb2NrQ29sdW1uKCk7XHJcblxyXG5cdGluaXQoKTtcclxuXHRpbml0RXZlbnQoKTtcclxuXHJcblx0ZnVuY3Rpb24gaW5pdCgpIHtcclxuXHRcdGNvbHNNb2RlbFxyXG5cdFx0XHQuZ2V0TG9ja0NvbHVtbigpXHJcblx0XHRcdC5maWx0ZXIoY29sTSA9PiAhY29sTS5oaWRkZW4pXHJcblx0XHRcdC5mb3JFYWNoKGNvbE0gPT4gdmlzaWJsZUxvY2tDb2x1bW4uYWRkKGNvbE0pKTtcclxuXHJcblx0XHR1cGRhdGVCb3hTaXplKCk7XHJcblxyXG5cdFx0dmlzaWJsZUxvY2tDb2x1bW4uZWFjaChjb2xNID0+IHtcclxuXHRcdFx0bGV0IGhlYWRlckVsZW1lbnQgPSBoZWFkZXIuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cdFx0XHQvLyDorr7nva7lubborrDlvZXliJ3lp4vnmoTlt6bkvqfkvY1cclxuXHRcdFx0aGVhZGVyRWxlbWVudC5jc3MoJ2xlZnQnLCBjb2xNLmF3YXlGcm9tTGVmdCk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdzY3JvbGwteCcsIHggPT4ge1xyXG5cdFx0XHRcdGxldCBsZWZ0U3R5bGUgPSB7ICdsZWZ0JzogeCArIGNvbE0uYXdheUZyb21MZWZ0IH07XHJcblxyXG5cdFx0XHRcdGhlYWRlckVsZW1lbnQuY3NzKGxlZnRTdHlsZSk7XHJcblx0XHRcdFx0YnVmZmVyTm9kZS5nZXROb2RlTGlzdCgpLmZvckVhY2gobm9kZSA9PiBub2RlLmNoaWxkcmVuLmdldChjb2xNKS5jc3MobGVmdFN0eWxlKSk7XHRcdFx0XHRcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGluaXRFdmVudCgpIHtcclxuXHJcblx0XHRjb25zdCBjb2x1bW5Mb2NrT3JVbkxvY2sgPSAoaXNMb2NrZWQsIGNvbE0pID0+IHtcclxuXHRcdFx0bGV0IGhlYWRlckVsZW1lbnQgPSBoZWFkZXIuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0aWYgKGlzTG9ja2VkKSB7XHJcblx0XHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4uYWRkKGNvbE0pO1xyXG5cclxuXHRcdFx0XHRjb2xNLm9uKCdzY3JvbGwteCcsIHggPT4ge1xyXG5cdFx0XHRcdFx0bGV0IGxlZnRTdHlsZSA9IHsgJ2xlZnQnOiB4ICsgY29sTS5hd2F5RnJvbUxlZnQgfTtcclxuXHJcblx0XHRcdFx0XHRoZWFkZXJFbGVtZW50LmNzcyhsZWZ0U3R5bGUpO1xyXG5cdFx0XHRcdFx0YnVmZmVyTm9kZS5nZXROb2RlTGlzdCgpLmZvckVhY2gobm9kZSA9PiBub2RlLmNoaWxkcmVuLmdldChjb2xNKS5jc3MobGVmdFN0eWxlKSk7XHJcblx0XHRcdFx0fSk7XHJcblxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHZpc2libGVMb2NrQ29sdW1uLnJlbW92ZShjb2xNKTtcclxuXHJcblx0XHRcdFx0Y29sTS5vZmYoJ3Njcm9sbC14Jyk7XHJcblxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRsZXQgY3VycmVudExlZnQgPSAkZG9tLnZpZXdwb3J0LnNjcm9sbExlZnQoKSArIGNvbE0uYXdheUZyb21MZWZ0O1xyXG5cclxuXHRcdFx0Ly8g6K6+572u5bm26K6w5b2V5Yid5aeL55qE5bem5L6n5L2NXHJcblx0XHRcdGhlYWRlckVsZW1lbnQuY3NzKCdsZWZ0JywgY3VycmVudExlZnQpO1xyXG5cdFx0XHRidWZmZXJOb2RlLmdldE5vZGVMaXN0KCkuZm9yRWFjaChub2RlID0+IG5vZGUuY2hpbGRyZW4uZ2V0KGNvbE0pLmNzcygnbGVmdCcsIGN1cnJlbnRMZWZ0KSk7XHJcblxyXG5cdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5wdWJsaXNoKGNvbE0sICRkb20udmlld3BvcnQuc2Nyb2xsTGVmdCgpKTtcclxuXHRcdFx0dXBkYXRlQm94U2l6ZSgpO1xyXG5cdFx0fTtcclxuXHJcblx0XHRjb2xzTW9kZWwub24oJ2NvbHVtbi1hZGQnLCBjb2xNID0+IHtcclxuXHRcdFx0Ly8gQlVHRklYIFRPRE9cclxuXHJcblx0XHRcdC8vIC4uLlxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tbG9ja2VkJywgaXNMb2NrZWQgPT4ge1xyXG5cdFx0XHRcdGNvbHVtbkxvY2tPclVuTG9jayhpc0xvY2tlZCwgY29sTSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Y29sc01vZGVsLmdldENvbHVtbigpLmZvckVhY2goY29sTSA9PiB7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tcmVzaXplZCcsIHdpZHRoID0+IHtcclxuXHJcblx0XHRcdFx0aWYgKGNvbE0ubG9ja2VkKSB7XHJcblx0XHRcdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5yZUNhbGMoKTtcclxuXHRcdFx0XHRcdGxldCBoZWFkZXJFbGVtZW50ID0gaGVhZGVyLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHJcblx0XHRcdFx0XHRsZXQgY3VycmVudExlZnQgPSAkZG9tLnZpZXdwb3J0LnNjcm9sbExlZnQoKSArIGNvbE0uYXdheUZyb21MZWZ0O1xyXG5cclxuXHRcdFx0XHRcdGhlYWRlckVsZW1lbnQuY3NzKCdsZWZ0JywgY3VycmVudExlZnQpO1xyXG5cdFx0XHRcdFx0YnVmZmVyTm9kZS5nZXROb2RlTGlzdCgpLmZvckVhY2gobm9kZSA9PiBub2RlLmNoaWxkcmVuLmdldChjb2xNKS5jc3MoJ2xlZnQnLCBjdXJyZW50TGVmdCkpO1xyXG5cclxuXHRcdFx0XHRcdHZpc2libGVMb2NrQ29sdW1uLnB1Ymxpc2goY29sTSwgJGRvbS52aWV3cG9ydC5zY3JvbGxMZWZ0KCkpO1xyXG5cdFx0XHRcdFx0dXBkYXRlQm94U2l6ZSgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHJcblx0XHRcdH0pO1xyXG5cclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1sb2NrZWQnLCBpc0xvY2tlZCA9PiB7XHJcblx0XHRcdFx0Ly8gLi4uXHJcblx0XHRcdFx0Y29sdW1uTG9ja09yVW5Mb2NrKGlzTG9ja2VkLCBjb2xNKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHRcdFxyXG5cdFx0YnVmZmVyTm9kZS5vbignYnVmZmVyLWluaXRpYWwnLCAoKSA9PiB7XHJcblx0XHRcdC8vIGNsZWFyQnVmZmVyTG9ja05vZGUoKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdXBkYXRlQm94U2l6ZSgpIHtcclxuXHRcdHZhciB2aXNpYmxlTG9ja0NvbHNXaWR0aCA9IHZpc2libGVMb2NrQ29sdW1uLmdldFdpZHRoKCk7XHJcblx0XHRoZWFkZXIuJGhlYWRlci5jc3MoJ3BhZGRpbmctbGVmdCcsIC12aXNpYmxlTG9ja0NvbHNXaWR0aCk7XHJcblx0XHQkZG9tLmNhbnZhcy5jc3MoJ21hcmdpbi1sZWZ0JywgLXZpc2libGVMb2NrQ29sc1dpZHRoKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiB7XHJcblx0XHR2aXNpYmxlTG9ja0NvbHVtbixcclxuXHRcdHNldExvY2tDb2x1bW5YKHNjcm9sbExlZnQpIHtcclxuXHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4uZWFjaChjb2xNID0+IGNvbE0uZmlyZSgnc2Nyb2xsLXgnLCBzY3JvbGxMZWZ0KSk7XHJcblx0XHR9LFxyXG5cclxuXHRcdGFkZEJ1ZmZlckxvY2tOb2RlKHJvd05vZGVzKSB7XHJcblx0XHRcdHZpc2libGVMb2NrQ29sdW1uLmVhY2goY29sTSA9PiB7XHJcblx0XHRcdFx0cm93Tm9kZXMuZm9yRWFjaChyb3dOb2RlcyA9PiB7XHJcblx0XHRcdFx0XHRsZXQgY29sRWxlID0gaGVhZGVyLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHRcdFx0XHRcdGxldCBjZWxsRWxlbWVudCA9IHJvd05vZGVzLmNoaWxkcmVuLmdldChjb2xNKTtcclxuXHJcblx0XHRcdFx0XHRjZWxsRWxlbWVudC5jc3MoJ2xlZnQnLCAkZG9tLnZpZXdwb3J0LnNjcm9sbExlZnQoKSArIGNvbE0uYXdheUZyb21MZWZ0KTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHR9LFxyXG5cclxuXHRcdGNsZWFyQnVmZmVyTG9ja05vZGUoKSB7XHJcblx0XHRcdHZpc2libGVMb2NrQ29sdW1uLmNsZWFyKCk7XHJcblx0XHR9XHJcblxyXG5cdH07XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IExvY2tDb2xNYW5hZ2VyOyIsIi8vIFRPRE9cclxudmFyIGRlYm91bmNlID0gZnVuY3Rpb24oZm4sIHRpbWUpIHtcclxuXHR2YXIgdGltZXIgPSBudWxsO1xyXG5cdHJldHVybiBmdW5jdGlvbiguLi5hcmdzKSB7XHJcblx0XHRpZiAodGltZXIpIGNsZWFyVGltZW91dCh0aW1lcik7XHJcblxyXG5cdFx0dGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcclxuXHRcdFx0Zm4uYXBwbHkobnVsbCwgYXJncyk7XHJcblx0XHR9LCB0aW1lKTtcclxuXHR9XHJcbn1cclxuXHJcbi8v6Kej5YazcmVxdWVzdEFuaW1hdGlvbkZyYW1l5YW85a656Zeu6aKYXHJcbnZhciByYUZyYW1lID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxyXG4gICAgICAgICAgICAgIHdpbmRvdy53ZWJraXRSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcclxuICAgICAgICAgICAgICB3aW5kb3cubW96UmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XHJcbiAgICAgICAgICAgICAgd2luZG93Lm9SZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcclxuICAgICAgICAgICAgICB3aW5kb3cubXNSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcclxuICAgICAgICAgICAgICBmdW5jdGlvbihjYWxsYmFjaykge1xyXG4gICAgICAgICAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dChjYWxsYmFjaywgMTAwMCAvIDYwKTtcclxuICAgICAgICAgICAgICB9O1xyXG5cclxuLy/mn6/ph4zljJblsIHoo4VcclxudmFyIHRocm90dGxlID0gZnVuY3Rpb24oZm4pIHtcclxuICAgIGxldCBpc0xvY2tlZDtcclxuICAgIHJldHVybiBmdW5jdGlvbiguLi5hcmdzKSB7XHJcblxyXG4gICAgICAgIGlmKGlzTG9ja2VkKSByZXR1cm4gXHJcblxyXG4gICAgICAgIGlzTG9ja2VkID0gdHJ1ZTtcclxuICAgICAgICByYUZyYW1lKCgpID0+IHtcclxuICAgICAgICAgICAgaXNMb2NrZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgZm4uYXBwbHkodGhpcywgYXJncylcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufTtcclxuXHJcbmNsYXNzIFNjcm9sbGVyIHtcclxuXHRjb25zdHJ1Y3RvcihsaW5lSGVpZ2h0LCBidWZmZXJab25lKSB7XHJcblxyXG5cdFx0dGhpcy5idWZmZXJab25lID0gYnVmZmVyWm9uZTtcclxuXHRcdHRoaXMueURpciA9IDA7IC8vIDE65ZCR5LiK77yMMCwtMTrlkJHkuItcclxuXHRcdHRoaXMueVByZUluZGV4ID0gMDsgLy8g5LiK5LiA5Liq5L2N572uXHJcblx0XHR0aGlzLmxpbmVIZWlnaHQgPSBsaW5lSGVpZ2h0O1xyXG5cclxuXHRcdHRoaXMueERpciA9IDA7IC8vIDHvvJrlkJHlt6bvvIww77yMLTHvvJrlkJHlj7NcclxuXHRcdHRoaXMueFByZUluZGV4ID0gMDsgLy8g5YmN5LiA5Liq5L2N572uXHJcblxyXG5cdFx0dGhpcy5fdHJpZ2dlclggPSB4ID0+IHg7XHJcblx0XHR0aGlzLl90cmlnZ2VyWSA9IHkgPT4geTtcclxuXHJcblx0fVxyXG5cclxuXHRvblgoY2FsbGJhY2spIHtcclxuXHRcdHRoaXMuX3RyaWdnZXJYID0geCA9PiB7XHJcblx0XHRcdGlmICh4ID09PSB0aGlzLnhQcmVJbmRleCkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy54RGlyID0geCAtIHRoaXMueFByZUluZGV4O1xyXG5cdFx0XHR0aGlzLnhQcmVJbmRleCA9IHg7XHJcblxyXG5cdFx0XHRjYWxsYmFjayh4KTtcclxuXHRcdH07XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRvblkoaGFuZGxlciwgZGVsYXkpIHtcclxuXHRcdC8vIFRPRE9cclxuXHRcdC8vIHZhciBkZWFseUZuID0gZGVib3VuY2UoaGFuZGxlciwgZGVsYXkpO1xyXG5cclxuXHRcdHRoaXMuX3RyaWdnZXJZID0gZGVib3VuY2UoKHkpID0+IHtcclxuXHRcdFx0dGhpcy55RGlyID0geSAtIHRoaXMueVByZUluZGV4O1xyXG5cdFx0XHR0aGlzLnlQcmVJbmRleCA9IHk7XHJcblxyXG5cdFx0XHR2YXIgaW5kZXggPSB+fih5LyB0aGlzLmxpbmVIZWlnaHQpO1xyXG5cdFx0XHR2YXIgd2lsbExvYWQgPSB0aGlzLmJ1ZmZlclpvbmUuc2hvdWxkTG9hZCh0aGlzLnlEaXIsIGluZGV4KTtcclxuXHJcblx0XHRcdGlmICh3aWxsTG9hZCkge1xyXG5cdFx0XHRcdC8vIGRlYWx5Rm4oKTtcclxuXHRcdFx0XHRoYW5kbGVyKFxyXG5cdFx0XHRcdFx0dGhpcy55RGlyID4gMCA/IDEgOiAtMSxcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS5kb21haW4sXHJcblx0XHRcdFx0XHR0aGlzLmJ1ZmZlclpvbmUuc3RhcnQsXHJcblx0XHRcdFx0XHR0aGlzLmJ1ZmZlclpvbmUuZW5kLFxyXG5cdFx0XHRcdFx0aW5kZXgsXHJcblx0XHRcdFx0XHR0aGlzLmJ1ZmZlclpvbmUudG90YWxcclxuXHRcdFx0XHQpO1xyXG5cdFx0XHR9XHJcblx0XHR9LCBkZWxheSk7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRmaXJlWCh4KSB7XHJcblx0XHR0aGlzLl90cmlnZ2VyWCh4KTtcclxuXHR9XHJcblxyXG5cdGZpcmVZKHkpIHtcclxuXHRcdHRoaXMuX3RyaWdnZXJZKHkpO1xyXG5cdH1cclxuXHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFNjcm9sbGVyOyIsInZhciBTZWxlY3Rpb24gPSByZXF1aXJlKCcuL1NlbGVjdGlvbicpO1xyXG52YXIgTWVudSA9IHJlcXVpcmUoJy4uL3BsdWdpbi9NZW51Jyk7XHJcbnZhciAkICA9IHJlcXVpcmUoJy4uL3V0aWwvc2hpbScpLiQ7XHJcblxyXG5jb25zdCBkZWZIZWFkZXJDb250ZXh0TWVudSA9IFt7IFxyXG5cdFx0dGV4dDogJ2xvY2snLCBcclxuXHRcdGhhbmRsZXI6IGZ1bmN0aW9uKGluZm8sIGNvbnRleHQsIGV2dCkge1xyXG5cdFx0XHRpbmZvLmNvbHVtbi5sb2NrKCk7XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHR0ZXh0OiAndW5sb2NrJywgXHJcblx0XHRoYW5kbGVyOiBmdW5jdGlvbihpbmZvLCBjb250ZXh0LCBldnQpIHsgXHJcblx0XHRcdGluZm8uY29sdW1uLnVuTG9jaygpO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0c2VwYXJhdG9yOiB0cnVlIFxyXG5cdH0sIHsgXHJcblx0XHR0ZXh0OiAnc2hvdycsIFxyXG5cdFx0aGFuZGxlcjogZnVuY3Rpb24oaW5mbywgY29udGV4dCwgZXZ0KSB7IFxyXG5cdFx0XHRpbmZvLmNvbHVtbi5zaG93KCk7XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHR0ZXh0OiAnaGlkZScsIFxyXG5cdFx0aGFuZGxlcjogZnVuY3Rpb24oaW5mbywgY29udGV4dCwgZXZ0KSB7IFxyXG5cdFx0XHRpbmZvLmNvbHVtbi5oaWRlKCk7XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHR0ZXh0OiAnbG9jYXRvcicsIFxyXG5cdFx0ZGlzYWJsZWQ6IHRydWUsXHJcblx0XHRoYW5kbGVyOiBmdW5jdGlvbihpbmZvLCBjb250ZXh0LCBldnQpIHsgXHJcblx0XHRcdC8vIFRPRE9cclxuXHRcdFx0Y29udGV4dC5zY3JvbGxUb1RvcChNYXRoLnJhbmRvbSgpICogMzAwMDApO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0dGV4dDogJ3NlbGVjdCBjb2x1bW4nLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IFxyXG5cdFx0XHQvLyBhbGVydChzZWxmLnN0b3JlLnNpemUoKSk7XHJcblx0XHRcdGNvbnRleHQuX3N0YXJ0ID0gW2luZm8uY29sdW1uLmRhdGFJbmRleCwgMF07XHJcblx0XHRcdGNvbnRleHQuX2VuZCA9IFtpbmZvLmNvbHVtbi5kYXRhSW5kZXgsIGNvbnRleHQuc3RvcmUuc2l6ZSgpIC0gMV07XHJcblxyXG5cdFx0XHRjb250ZXh0LnNlbGVjdGlvblJhbmdlKGNvbnRleHQuX3N0YXJ0LCBjb250ZXh0Ll9lbmQpO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0Y2xzOiAnbnVtYmVyLWNvbHVtbicsXHJcblx0XHR0ZXh0OiAnY291bnQnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IFxyXG5cdFx0XHRhbGVydChjb250ZXh0LnN0b3JlLnNpemUoKSk7XHJcblx0XHR9IFxyXG5cdH0sIHsgXHJcblx0XHRjbHM6ICdudW1iZXItY29sdW1uJyxcclxuXHRcdHRleHQ6ICdjb3VudCcsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHtcclxuXHRcdFx0YWxlcnQoY29udGV4dC5zdG9yZS5zaXplKCkpO1xyXG5cdFx0fSBcclxuXHR9XTtcclxuXHJcbmNvbnN0IGRlZkNlbGxDb250ZXh0TWVudSA9IFt7XHJcblx0XHR0ZXh0OiAnbG9jayByb3cgdG8gdG9wJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBjb25zb2xlLmxvZyhjb250ZXh0Ll9zZWxlY3Rpb24pOyB9IFxyXG5cdH0seyBcclxuXHRcdHRleHQ6ICdsb2NrIHJvdyB0byBib3R0b20nLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IGNvbnNvbGUubG9nKGNvbnRleHQuX3NlbGVjdGlvbik7IH0gXHJcblx0fSx7IFxyXG5cdFx0dGV4dDogJ3NlYXJjaCcsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgY29uc29sZS5sb2coY29udGV4dC5fc2VsZWN0aW9uKTsgfSBcclxuXHR9LHsgXHJcblx0XHR0ZXh0OiAnbWFyaycsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgY29uc29sZS5sb2coY29udGV4dC5fc2VsZWN0aW9uKTsgfSBcclxuXHR9XTtcdFxyXG5cclxuY29uc3QgZGVmU2VsZWN0aW9uQ29udGV4dE1lbnUgPSBbeyBcclxuXHRcdHRleHQ6ICdjb3B5JywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBjb25zb2xlLmxvZyhpbmZvLCBjb250ZXh0Ll9zZWxlY3Rpb24pOyB9IFxyXG5cdH0seyBcclxuXHRcdHRleHQ6ICdwcmludCcsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgXHJcblx0XHRcdGNvbnNvbGUubG9nKGV2dCwgZGF0YSwgY29udGV4dCk7XHJcblx0XHR9IFxyXG5cdH0seyBcclxuXHRcdHRleHQ6ICdleHBvcnQnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IGNvbnNvbGUubG9nKGNvbnRleHQuX3NlbGVjdGlvbik7IH0gXHJcblx0fSx7IFxyXG5cdFx0dGV4dDogJ21hcmsnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IGNvbnNvbGUubG9nKGNvbnRleHQuX3NlbGVjdGlvbik7IH0gXHJcblx0fV07XHJcblxyXG5cclxuY2xhc3MgQ29udGV4dG1lbnUgZXh0ZW5kcyBTZWxlY3Rpb24ge1xyXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcclxuXHRcdHN1cGVyKG9wdGlvbnMpO1xyXG5cclxuXHRcdHRoaXMuY2VsbEN0eE1lbnUgPSBvcHRpb25zLmJpekNvbnRleHRNZW51LmNlbGw7XHJcblxyXG5cdFx0dGhpcy5oZWFkZXJDdHhNZW51ID0ge1xyXG5cdFx0XHRiZWZvcmU6IGZ1bmN0aW9uKGluZm8sIGV2dCkge1xyXG5cdFx0XHRcdGlmIChpbmZvLmNvbHVtbi52dHlwZSA9PT0gJ251bWJlcicpIHtcclxuXHRcdFx0XHRcdHRoaXMuZ2V0Q2xzKCcubnVtYmVyLWNvbHVtbicpLnNob3coKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dGhpcy5nZXRDbHMoJy5udW1iZXItY29sdW1uJykuaGlkZSgpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdH1cclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRfYmluZEV2ZW50KCkge1xyXG5cdFx0c3VwZXIuX2JpbmRFdmVudCgpO1xyXG5cclxuXHRcdGxldCBzZWxmID0gdGhpcztcclxuXHJcblx0XHR0aGlzLiRjb250ZXh0bWVudUhlYWRlciA9IG5ldyBNZW51KHRoaXMuJGRvbS53cmFwcGVyLCB7IFxyXG5cdFx0XHRkYXRhOiBkZWZIZWFkZXJDb250ZXh0TWVudSwgXHJcblx0XHRcdGNvbnRleHQ6IHRoaXMgXHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLiRjb250ZXh0bWVudSA9IG5ldyBNZW51KHRoaXMuJGRvbS5ib2R5LCB7IFxyXG5cdFx0XHRkYXRhOiBbXSwgXHJcblx0XHRcdGNvbnRleHQ6IHRoaXMgXHJcblx0XHR9KTtcclxuXHRcdFxyXG5cdFx0dGhpcy4kZG9tLndyYXBwZXJcclxuXHRcdFx0Lm9uKCdjb250ZXh0bWVudScsICcuYy1oZWFkZXItY2VsbCcsIFxyXG5cdFx0XHRcdHRoaXMuX2hlYWRlckNvbnRleHRNZW51LmJpbmQodGhpcylcclxuXHRcdFx0KTtcclxuXHJcblx0XHR0aGlzLiRkb20uYm9keVxyXG5cdFx0XHQub24oJ2NvbnRleHRtZW51JywgJy5jLWdyaWQtY2VsbCcsIFxyXG5cdFx0XHRcdHRoaXMuX2NlbGxDb250ZXh0TWVudS5iaW5kKHRoaXMsIGRlZkNlbGxDb250ZXh0TWVudSlcclxuXHRcdFx0KVxyXG5cdFx0XHQub24oJ2NvbnRleHRtZW51JywgJy5jLWNlbGwtc2VsZWN0ZWQnLCBcclxuXHRcdFx0XHR0aGlzLl9jZWxsQ29udGV4dE1lbnUuYmluZCh0aGlzLCBkZWZTZWxlY3Rpb25Db250ZXh0TWVudSlcclxuXHRcdFx0KTtcclxuXHR9XHJcblxyXG5cdF9oZWFkZXJDb250ZXh0TWVudShldnQpIHtcclxuXHRcdGxldCBjb2xNID0gJChldnQudGFyZ2V0KS5kYXRhKCdjb2x1bW4nKTtcclxuXHRcdGxldCBtZW51ID0gdGhpcy4kY29udGV4dG1lbnVIZWFkZXI7XHJcblxyXG5cdFx0bGV0IGluZm8gPSB7IFxyXG5cdFx0XHQnZGF0YUluZGV4JzogY29sTS5kYXRhSW5kZXgsIFxyXG5cdFx0XHQnY29sdW1uJzogY29sTSxcclxuXHRcdFx0J2NvbnRleHQnOiBtZW51XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5maXJlKCdoZWFkZXItY29udGV4dG1lbnUnLCBpbmZvLCBldnQpO1xyXG5cdFx0Ly8gY29uc29sZS5sb2coaW5mbyk7XHJcblxyXG5cdFx0aWYgKHRoaXMuaGVhZGVyQ3R4TWVudS5iZWZvcmUuY2FsbChtZW51LCBpbmZvLCBldnQpKSB7XHJcblx0XHRcdFxyXG5cdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcclxuXHJcblx0XHRcdG1lbnUuc2V0SW5mbyhpbmZvKTtcclxuXHRcdFx0bWVudS5zaG93QXQoZXZ0KTtcclxuXHRcdFxyXG5cdFx0XHRkb2NFdmVudChtZW51KTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdF9jZWxsQ29udGV4dE1lbnUoZGVmQ3R4TWVudSwgZXZ0KSB7XHJcblx0XHRsZXQgJGNlbGwgPSAkKGV2dC50YXJnZXQpO1xyXG5cdFx0bGV0IGRhdGFJbmRleCA9ICRjZWxsLmRhdGEoJ2RhdGFJbmRleCcpO1xyXG5cdFx0bGV0IHJvd251bWJlciA9ICskY2VsbC5wYXJlbnQoJy5jLWdyaWQtcm93JykuYXR0cigncmlkJyk7XHJcblx0XHRsZXQgbWVudSA9IHRoaXMuJGNvbnRleHRtZW51O1xyXG5cclxuXHRcdGxldCBpbmZvID0geyBcclxuXHRcdFx0J3ZhbHVlJzogJGNlbGwudGV4dCgpLFxyXG5cdFx0XHQnZGF0YUluZGV4JzogZGF0YUluZGV4LCBcclxuXHRcdFx0J3Jvd251bWJlcic6IHJvd251bWJlcixcclxuXHRcdFx0J2NvbnRleHQnOiBtZW51XHJcblx0XHR9O1xyXG5cclxuXHRcdHRoaXMuZmlyZSgnY2VsbC1jb250ZXh0bWVudScsIGluZm8sIGV2dCk7XHJcblx0XHQvLyBjb25zb2xlLmxvZyhpbmZvKTtcclxuXHJcblx0XHRpZiAodGhpcy5jZWxsQ3R4TWVudS5iZWZvcmUuY2FsbChtZW51LCBpbmZvLCBldnQpKSB7XHJcblxyXG5cdFx0XHRldnQucHJldmVudERlZmF1bHQoKTtcclxuXHJcblx0XHRcdG1lbnUuc2V0SW5mbyhpbmZvKTtcclxuXHRcdFx0bWVudS51cGRhdGUoZGVmQ3R4TWVudS5jb25jYXQobWVudS5nZXREYXRhKCkpKTtcclxuXHRcdFx0XHJcblx0XHRcdG1lbnUuc2hvd0F0KGV2dCk7XHJcblx0XHRcclxuXHRcdFx0ZG9jRXZlbnQobWVudSk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRkZXN0b3J5KCkge1xyXG5cdFx0c3VwZXIuZGVzdG9yeSgpO1xyXG5cclxuXHRcdHRoaXMuJGNvbnRleHRtZW51SGVhZGVyLmRlc3RvcnkoKTtcclxuXHRcdHRoaXMuJGNvbnRleHRtZW51LmRlc3RvcnkoKTtcclxuXHRcdHRoaXMuY2VsbEN0eE1lbnUgPSBudWxsO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gZG9jRXZlbnQoJGNvbnRleHRtZW51KSB7XHJcblx0JChkb2N1bWVudCkub24oJ21vdXNldXAuY29udGV4dG1lbnUnLCBvbk1vdXNlRG93bi5iaW5kKG51bGwsICRjb250ZXh0bWVudSkpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBvbk1vdXNlRG93bigkY29udGV4dG1lbnUpe1xyXG4gICAgJGNvbnRleHRtZW51LmhpZGUoKTtcclxuICAgICQoZG9jdW1lbnQpLm9mZignbW91c2V1cC5jb250ZXh0bWVudScpO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENvbnRleHRtZW51OyIsInZhciBHcmlkVmlldyA9IHJlcXVpcmUoJy4uL2NvcmUvR3JpZFZpZXcnKTtcclxuXHJcbmNvbnN0IENFTExfQ0xTID0gJ2xpLmMtZ3JpZC1jZWxsJztcclxuY29uc3QgQ0VMTF9TRUxFQ1RFRF9DTFMgPSAnYy1jZWxsLXNlbGVjdGVkJztcclxuY29uc3QgUk9XX0NMUyA9ICcuYy1ncmlkLXJvdyc7XHJcblxyXG5jbGFzcyBTZWxlY3Rpb24gZXh0ZW5kcyBHcmlkVmlldyB7XHJcblxyXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcclxuXHRcdHN1cGVyKG9wdGlvbnMpO1xyXG5cclxuXHRcdHRoaXMuX2RlZmF1bHRzKCk7XHJcblx0fVxyXG5cclxuXHRfZGVmYXVsdHMoKSB7XHJcblx0XHR0aGlzLl9tb3ZpbmcgPSBmYWxzZTtcclxuXHRcdHRoaXMuX3N0YXJ0ID0gbnVsbDtcclxuXHRcdHRoaXMuX2VuZCA9IG51bGw7XHJcblx0XHR0aGlzLl9sYXN0WSA9IG51bGw7XHJcblx0XHR0aGlzLl9zZWxlY3Rpb24gPSBbXTtcclxuXHRcdHRoaXMuX3NlbGVjdFkgPSBbXTtcclxuXHRcdHRoaXMuX3NlbGVjdERhdGFJbmRleCA9IFtdO1xyXG5cdH1cclxuXHRcclxuXHRfYmluZEV2ZW50KCkge1xyXG5cdFx0c3VwZXIuX2JpbmRFdmVudCgpO1xyXG5cclxuXHRcdGxldCBzZWxmID0gdGhpcztcclxuXHJcblx0XHR0aGlzLmNvbHVtbk1vZGVsLm9uKCdub3RpY2UtY29sTW9kZWwtc29ydC1jaGFuZ2VkJywgKCkgPT4ge1xyXG5cdFx0XHR0aGlzLl9kZWZhdWx0cygpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kZG9tLmNhbnZhc1xyXG5cdFx0XHQub24oJ21vdXNlZG93bicsIENFTExfQ0xTLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRpZiAoZXZ0LmJ1dHRvbiA9PT0gMCkge1xyXG5cdFx0XHRcdFx0c2VsZi4kZG9tLmNhbnZhcy5maW5kKENFTExfQ0xTKS5yZW1vdmVDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdFx0XHRzZWxmLl9tb3ZpbmcgPSB0cnVlO1xyXG5cdFx0XHRcdFx0bGV0ICRjZWxsID0gJCh0aGlzKS5hZGRDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdFx0XHRzZWxmLl9zdGFydCA9IHNlbGYuX2VuZCA9IFskY2VsbC5kYXRhKCdkYXRhSW5kZXgnKSwgKyRjZWxsLnBhcmVudChST1dfQ0xTKS5hdHRyKCdyaWQnKV07XHJcblx0XHRcdFx0XHQvLyBjb25zb2xlLmxvZyhzdGFydCk7XHJcblx0XHRcdFx0fSBcclxuXHRcdFx0XHRlbHNlIGlmIChldnQuYnV0dG9uID09PSAyKSB7XHJcblx0XHRcdFx0XHRcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pXHJcblx0XHRcdC5vbignbW91c2VlbnRlcicsIENFTExfQ0xTLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRpZiAoc2VsZi5fbW92aW5nKSB7XHJcblx0XHRcdFx0XHRsZXQgJGNlbGwgPSAkKHRoaXMpO1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0XHQkY2VsbC5hZGRDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdFx0XHRzZWxmLl9lbmQgPSBbJGNlbGwuZGF0YSgnZGF0YUluZGV4JyksICskY2VsbC5wYXJlbnQoUk9XX0NMUykuYXR0cigncmlkJyldO1xyXG5cclxuXHRcdFx0XHRcdHNlbGYuc2VsZWN0aW9uUmFuZ2Uoc2VsZi5fc3RhcnQsIHNlbGYuX2VuZCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KVxyXG5cdFx0XHQub24oJ21vdXNldXAnLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRzZWxmLl9tb3ZpbmcgPSBmYWxzZTtcclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyhlbmQpO1xyXG5cdFx0XHRcdGNvbnNvbGUubG9nKHNlbGYuX3NlbGVjdGlvbik7XHJcblx0XHRcdFx0Ly8gVE9ET1xyXG5cdFx0XHRcdC8vIGNvcHkoJCgnLmNlbGwuc2VsZWN0ZWQnKSk7XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuYnVmZmVyTm9kZS5vbigncm93LXVwZGF0ZS1iZWZvcmUnLCAocm93Tm9kZSwgcm93KSA9PiB7XHJcblx0XHRcdC8vIGNvbnNvbGUubG9nKHJvd05vZGUuJG5vZGUsIHJvdy5yaWQsIHRoaXMuX3NlbGVjdFkpO1xyXG5cclxuXHRcdFx0aWYgKHRoaXMuX3NlbGVjdGlvbi5sZW5ndGggPT09IDApIHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHJcblx0XHRcdGxldCBpID0gcm93LnJpZDtcclxuXHRcdFx0bGV0IFt5MCwgeTFdID0gdGhpcy5fc2VsZWN0WTtcclxuXHRcdFx0bGV0IGNvbHMgPSB0aGlzLl9zZWxlY3REYXRhSW5kZXg7XHJcblxyXG5cdFx0XHRpZiAoaSA+PSB5MCAmJiBpIDwgeTEgKyAxKSB7XHJcblx0XHRcdFx0Y29scy5mb3JFYWNoKChjb2wpID0+IHtcclxuXHRcdFx0XHRcdHJvd05vZGUuY2hpbGRyZW4uZm9yRWFjaCgoJGNlbGwsIGNvbE0pID0+IHtcclxuXHRcdFx0XHRcdFx0aWYgKGNvbHMuaW5kZXhPZihjb2xNLmRhdGFJbmRleCkgIT0gLTEpIHtcclxuXHRcdFx0XHRcdFx0XHQkY2VsbC5hZGRDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0JGNlbGwucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpXHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHJvd05vZGUuJG5vZGUuZmluZChDRUxMX0NMUykucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0fSk7XHJcblx0XHRcclxuXHR9XHJcblxyXG5cdHNlbGVjdGlvblJhbmdlKFt4MCwgeTBdLCBbeDEsIHkxXSkge1xyXG5cclxuXHRcdGxldCB5RGlyID0geTEgLSB5MDtcclxuXHRcdGxldCBsYXN0WSA9IHRoaXMuX2xhc3RZO1xyXG5cdFx0XHRcclxuXHRcdC8vIHlSYW5nZSA9IHsgbGFzdDogLCBub3c6IFt5MCwgeTFdIH07XHJcblx0XHQvLyBbbDAsIGwxXVxyXG5cdFx0Ly8gW3kwLCB5MV1cclxuXHRcdC8vIFtsMCwgbDFdXHJcblx0XHRsZXQgcmVtb3ZlWVJhbmdlID0gW107XHJcblx0XHQvLyBkb3duXHJcblx0XHRpZiAoeURpciA+PSAwICYmIHkxIDwgbGFzdFkpIHtcclxuXHRcdFx0cmVtb3ZlWVJhbmdlID0gW3kxLCBsYXN0WV07XHJcblx0XHR9XHJcblx0XHQvLyB1cFxyXG5cdFx0aWYgKHlEaXIgPD0gMCAmJiB5MSA+IGxhc3RZKSB7XHJcblx0XHRcdHJlbW92ZVlSYW5nZSA9IFtsYXN0WSwgeTFdO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHR0aGlzLl9sYXN0WSA9IHkxO1xyXG5cdFx0Ly8gY29uc29sZS5sb2coeURpciwgcmVtb3ZlWVJhbmdlKTtcclxuXHJcblx0XHRsZXQgZGF0YUluZGV4ID0gdGhpcy5nZXRMb2NrQW5kVmlzaWFibGVDb2x1bW5Bc0RhdGFJbmRleCgpO1xyXG5cdFx0W3gwLCB5MCwgeDEsIHkxXSA9IG9yZGVyQnkoeDAsIHkwLCB4MSwgeTEsIGRhdGFJbmRleCk7XHJcblxyXG5cclxuXHRcdGxldCBjb2xzID0gdGhpcy5fc2VsZWN0RGF0YUluZGV4ID0gZGF0YUluZGV4LnNsaWNlKGRhdGFJbmRleC5pbmRleE9mKHgwKSwgZGF0YUluZGV4LmluZGV4T2YoeDEpKzEpO1xyXG5cdFx0Ly8gY29uc29sZS5sb2coY29scyk7XHJcblxyXG5cdFx0dGhpcy5fc2VsZWN0WSA9IFt5MCwgeTEgKyAxXTtcclxuXHRcdGxldCByb3dzID0gdGhpcy5zdG9yZS5zbGljZSh5MCwgeTEgKyAxKTtcclxuXHJcblx0XHR0aGlzLl9zZWxlY3Rpb24gPSByb3dzLm1hcChyb3cgPT4ge1xyXG5cdFx0XHRyZXR1cm4gY29scy5tYXAoY29sID0+IHJvdy5kYXRhW2NvbF0pO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5fcmVQYWludE5vZGUoeURpciwgeTAsIHkxLCByZW1vdmVZUmFuZ2UsIGNvbHMpO1xyXG5cdH1cclxuXHJcblx0X3JlUGFpbnROb2RlKHlEaXIsIHkwLCB5MSwgcmVtb3ZlWVJhbmdlLCBjb2xzKSB7XHJcblx0XHRsZXQgbm9kZUxpc3QgPSB0aGlzLmJ1ZmZlck5vZGUuZ2V0Tm9kZUxpc3QoKTtcclxuXHRcdG5vZGVMaXN0LmZvckVhY2goKHJvd05vZGUpID0+IHtcclxuXHRcdFx0bGV0ICRyb3cgPSByb3dOb2RlLiRub2RlO1xyXG5cdFx0XHRsZXQgaSAgPSArJHJvdy5hdHRyKCdyaWQnKTtcclxuXHRcdFx0XHJcblx0XHRcdGlmIChpID49IHkwICYmIGkgPCB5MSArIDEpIHtcclxuXHRcdFx0XHRjb2xzLmZvckVhY2goKGNvbCkgPT4ge1xyXG5cdFx0XHRcdFx0cm93Tm9kZS5jaGlsZHJlbi5mb3JFYWNoKCgkY2VsbCwgY29sTSkgPT4ge1xyXG5cdFx0XHRcdFx0XHRpZiAoY29scy5pbmRleE9mKGNvbE0uZGF0YUluZGV4KSAhPSAtMSkge1xyXG5cdFx0XHRcdFx0XHRcdCRjZWxsLmFkZENsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHQkY2VsbC5yZW1vdmVDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUylcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICh5RGlyID49IDAgJiYgaSA+IHJlbW92ZVlSYW5nZVswXSAmJiBpIDw9cmVtb3ZlWVJhbmdlWzFdICkge1xyXG5cdFx0XHRcdCRyb3cuZmluZChDRUxMX0NMUykucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICh5RGlyIDw9IDAgJiYgaSA+PSByZW1vdmVZUmFuZ2VbMF0gJiYgaSA8cmVtb3ZlWVJhbmdlWzFdICkge1xyXG5cdFx0XHRcdCRyb3cuZmluZChDRUxMX0NMUykucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHQvKlxyXG5cdCAqIGxvY2sgKyB2aXNpYWJsZSA9IGNvbHVtbnNcclxuXHQgKiBAcGFyYW0ge0FycmF5fSBjb2x1bW5zIC1bZGF0YUluZGV4Li4uXVxyXG5cdCAqL1xyXG5cdGdldExvY2tBbmRWaXNpYWJsZUNvbHVtbkFzRGF0YUluZGV4KCkge1xyXG5cdFx0bGV0IGNvbHMgPSBbXTtcclxuXHJcblx0XHR0aGlzLmxvY2tDb2xNYW5hZ2VyXHJcblx0XHRcdC52aXNpYmxlTG9ja0NvbHVtblxyXG5cdFx0XHQuZWFjaChjb2xNID0+IGNvbHMudW5zaGlmdChjb2xNLmRhdGFJbmRleCkpO1xyXG5cclxuXHRcdGxldCB2aXNpYWJsZUNvbHMgPSB0aGlzLmNvbHVtbk1vZGVsXHJcblx0XHRcdC5nZXRWaXNpYmxlQ29sdW1uKClcclxuXHRcdFx0Lm1hcChjb2xNID0+IGNvbE0uZGF0YUluZGV4KVxyXG5cdFx0XHQuZmlsdGVyKGRhdGFJbmRleCA9PiBjb2xzLmluZGV4T2YoZGF0YUluZGV4KSA9PSAtMSk7XHJcblxyXG5cdFx0cmV0dXJuIGNvbHMuY29uY2F0KHZpc2lhYmxlQ29scyk7XHJcblx0fVxyXG5cclxuXHRkZXN0b3J5KCkge1xyXG5cdFx0c3VwZXIuZGVzdG9yeSgpO1xyXG5cclxuXHRcdHRoaXMuX2RlZmF1bHRzKCk7XHJcblx0fVxyXG5cclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIHN3YXAoYSwgYikge1xyXG5cdHJldHVybiBbYiwgYV07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9yZGVyQnkoeDAsIHkwLCB4MSwgeTEsIGRhdGFJbmRleCkge1xyXG5cdGlmIChkYXRhSW5kZXguaW5kZXhPZih4MCkgPiBkYXRhSW5kZXguaW5kZXhPZih4MSkpIHtcclxuXHRcdFt4MCwgeDFdID0gc3dhcCh4MCwgeDEpO1xyXG5cdH1cclxuXHRpZiAoeTAgPiB5MSkge1xyXG5cdFx0W3kwLCB5MV0gPSBzd2FwKHkwLCB5MSk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gW3gwLCB5MCwgeDEsIHkxXTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBTZWxlY3Rpb247IiwiLy8gZXhwb3J0cy5HcmlkU3RvcmUgPSByZXF1aXJlKCcuL2NvcmUvR3JpZFN0b3JlJyk7XHJcbi8vIGV4cG9ydHMuR3JpZFZpZXcgPSByZXF1aXJlKCcuL2NvcmUvR3JpZFZpZXcnKTtcclxuLy8gbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2V4dGVuZHMvU2VsZWN0aW9uJyk7XHJcbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9leHRlbmRzL0NvbnRleHRtZW51Jyk7XHJcblxyXG4vLyBleHBvcnQgeyBkZWZhdWx0IH0gZm9ybSAnLi9wbHVnaW4vQ29udGV4dG1lbnUnO1xyXG4iLCJ2YXIgJCA9IHJlcXVpcmUoJy4uL3V0aWwvc2hpbScpLiQ7XHJcbnZhciBVdGlscyA9IHJlcXVpcmUoJy4uL3V0aWwvVXRpbHMnKTtcclxuXHJcblxyXG5jbGFzcyBNZW51IHtcclxuXHRjb25zdHJ1Y3Rvcigkd3JhcHBlciwgeyBkYXRhLCBjb250ZXh0IH0pIHtcclxuXHRcdHRoaXMucGFyYW1zID0ge307XHJcblx0XHR0aGlzLiRtZW51ID0gJChudWxsKTtcclxuXHRcdHRoaXMuJHdyYXBwZXIgPSAkd3JhcHBlcjtcclxuXHRcdHRoaXMuX2RhdGEgPSBkYXRhIHx8IFtdO1xyXG5cdFx0dGhpcy5jb250ZXh0ID0gY29udGV4dDtcclxuXHJcblx0XHR0aGlzLnVwZGF0ZShkYXRhKTtcclxuXHR9XHJcblxyXG5cdHVwZGF0ZShkYXRhKSB7XHJcblx0XHR0aGlzLiRtZW51LnJlbW92ZSgpOyAvLyBUT0RPIOS8mOWMluWkjeeUqOiKgueCuVxyXG5cdFx0XHJcblx0XHRpZiAoQXJyYXkuaXNBcnJheShkYXRhKSAmJiBkYXRhLmxlbmd0aCA+IDApIHtcclxuXHRcdFx0dGhpcy4kbWVudSA9IGNvbXBpbGVNZW51KGRhdGEsIHRoaXMpO1xyXG5cclxuXHRcdFx0dGhpcy4kd3JhcHBlci5hcHBlbmQodGhpcy4kbWVudSk7XHJcblxyXG5cdFx0XHR0aGlzLl9kYXRhID0gZGF0YTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoaXMuX2RhdGEgPSBbXTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdG1lcmdlKGRhdGEpIHtcclxuXHRcdHRoaXMuX2RhdGEgPSB0aGlzLl9kYXRhLmZpbHRlcihpdGVtID0+IHtcclxuXHRcdFx0cmV0dXJuICFkYXRhLmluY2x1ZGVzKGl0ZW0pO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5fZGF0YSA9IGRhdGEuY29uY2F0KHRoaXMuX2RhdGEpO1xyXG5cdFx0dGhpcy51cGRhdGUodGhpcy5fZGF0YSk7XHJcblx0fVxyXG5cclxuXHRzZXRJbmZvKGluZm8pIHtcclxuXHRcdHRoaXMuJGluZm8gPSBpbmZvO1xyXG5cdH1cclxuXHJcblx0Z2V0SW5mbygpIHtcclxuXHRcdHJldHVybiB0aGlzLiRpbmZvO1xyXG5cdH1cclxuXHJcblx0Z2V0RGF0YSgpIHtcclxuXHRcdHJldHVybiB0aGlzLl9kYXRhO1xyXG5cdH1cclxuXHJcblx0Z2V0Q2xzKGNsYXNzTmFtZSkge1xyXG5cdFx0cmV0dXJuIHRoaXMuJG1lbnUuZmluZChjbGFzc05hbWUpO1xyXG5cdH1cclxuXHJcblx0c2hvd0F0KGV2dCkge1xyXG5cdFx0aWYgKCF0aGlzLl9kYXRhLmxlbmd0aCkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0bGV0IHggPSBldnQuY2xpZW50WCAtIHRoaXMuJHdyYXBwZXIub2Zmc2V0KCkubGVmdDtcclxuXHRcdGxldCB5ID0gZXZ0LmNsaWVudFkgLSB0aGlzLiR3cmFwcGVyLm9mZnNldCgpLnRvcDtcclxuXHJcblx0ICAgIHRoaXMuJG1lbnVcclxuXHQgICAgXHQuYWRkQ2xhc3MoJ3Nob3ctbWVudScpXHJcblx0ICAgIFx0LmNzcyh7ICdsZWZ0JzogeCArICdweCcsICd0b3AnOiB5ICsgJ3B4JyB9KTtcclxuXHR9XHJcblxyXG5cdGhpZGUoKSB7XHJcblx0XHR0aGlzLiRtZW51LnJlbW92ZUNsYXNzKCdzaG93LW1lbnUnKTtcclxuXHR9XHJcblxyXG5cdGdldERvbSgpIHtcclxuXHRcdHJldHVybiB0aGlzLiRtZW51O1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHtcclxuXHRcdHRoaXMuJG1lbnUuZW1wdHkoKTtcclxuXHR9XHJcblxyXG59XHJcblxyXG5cclxuY29uc3QgZW1wdHlGbiA9IChldnQpID0+IHsgXHJcblx0ZXZ0LnByZXZlbnREZWZhdWx0O1xyXG5cdHJldHVybiBmYWxzZTsgXHJcbn07XHJcblxyXG5mdW5jdGlvbiBjb252ZXJ0KGl0ZW0pIHtcclxuXHRsZXQgZGVmSXRlbSA9IHtcclxuXHRcdCdpZCc6ICdjbS1pZC0nICsgRGF0ZS5ub3coKSxcclxuXHRcdCd0ZXh0JzogJycsXHJcblx0XHQnaWNvbkNscyc6ICcnLFxyXG5cdFx0J2hpZGRlbic6IGZhbHNlLFxyXG5cdFx0J2Rpc2FibGVkJzogZmFsc2UsXHJcblx0XHQnaGFuZGxlcic6IGZ1bmN0aW9uKCkge31cclxuXHR9O1xyXG5cclxuXHRyZXR1cm4gT2JqZWN0LmFzc2lnbihkZWZJdGVtLCBpdGVtKTtcclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlSXRlbShpdGVtLCB2bSkge1xyXG5cdGxldCAkaXRlbSA9ICQoJzxsaS8+JylcclxuXHRcdFx0LmF0dHIoJ2lkJywgaXRlbS5pZClcclxuXHRcdFx0LmFkZENsYXNzKCdjLW1lbnUtaXRlbScpXHJcblx0XHRcdC5hZGRDbGFzcyhpdGVtLmRpc2FibGVkID8gJ2Rpc2FibGVkJzogJycpO1xyXG5cclxuICAgIGxldCAkYnV0dG9uID0gJCgnPGJ1dHRvbi8+JykuYWRkQ2xhc3MoJ2MtbWVudS1idG4nKVxyXG4gICAgXHRcdC5hcHBlbmQoYDxpIGNsYXNzPVwiZmEgJHtpdGVtLmljb25DbHN9XCI+PC9pPmApXHJcbiAgICBcdFx0LmFwcGVuZChgPHNwYW4gY2xhc3M9XCJjLW1lbnUtdGV4dFwiPiR7aXRlbS50ZXh0fTwvc3Bhbj5gKVxyXG4gICAgXHRcdC5vbignY2xpY2snLCAoZXZ0KSA9PiB7XHJcbiAgICBcdFx0XHRpdGVtLmhhbmRsZXIuY2FsbCh2bSwgdm0uZ2V0SW5mbygpLCB2bS5jb250ZXh0LCBldnQpO1xyXG4gICAgXHRcdH0pO1xyXG5cclxuICAgIHJldHVybiAkaXRlbS5hcHBlbmQoJGJ1dHRvbik7XHJcbn07XHJcblxyXG5mdW5jdGlvbiBjb21waWxlTWVudShtZW51cywgdm0pIHtcclxuXHRpZiAobWVudXMgJiYgbWVudXMubGVuZ3RoID09PSAwKSByZXR1cm4gJChudWxsKTtcclxuXHRcclxuXHRsZXQgJG1lbnVzID0gJCgnPG1lbnUvPicpLmFkZENsYXNzKCdjLW1lbnUnKTtcclxuXHRsZXQgJG1lbnVTZXBhcmF0b3IgPSAkKCc8bGkvPicpLmFkZENsYXNzKCdjLW1lbnUtc2VwYXJhdG9yJyk7XHJcblx0XHJcblx0bWVudXMuZm9yRWFjaChtZW51ID0+IHtcclxuXHRcdGlmIChtZW51LnNlcGFyYXRvcikge1xyXG5cdFx0XHRyZXR1cm4gJG1lbnVzLmFwcGVuZCgkbWVudVNlcGFyYXRvcik7XHJcblx0XHR9XHJcblxyXG5cdFx0bGV0ICRtZW51ID0gY3JlYXRlSXRlbShjb252ZXJ0KG1lbnUpLCB2bSk7XHJcblx0XHRsZXQgY2hpbGRyZW47XHJcblxyXG5cdFx0aWYgKG1lbnUuY2hpbGRyZW4pIHtcclxuXHRcdFx0Y2hpbGRyZW4gPSBjb21waWxlTWVudShtZW51LmNoaWxkcmVuLCB2bSk7XHJcblxyXG5cdFx0XHRpZiAoY2hpbGRyZW4pIHtcclxuXHRcdFx0XHQkbWVudS5hZGRDbGFzcygnc3VibWVudScpLmFwcGVuZChjaGlsZHJlbik7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0JG1lbnVzLmFwcGVuZCgkbWVudSk7XHJcblx0fSk7XHJcblxyXG5cdHJldHVybiAkbWVudXM7XHJcbn1cclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IE1lbnU7IiwiJ3VzZSBzdHJpY3QnO1xyXG5jb25zdCAkID0gcmVxdWlyZSgnLi4vdXRpbC9zaGltJykuJDtcclxuXHJcbmNvbnN0IEZMRVhNSU5XSURUSCA9IDM1O1xyXG5cclxudmFyIGRyYWdEcm9wID0gZnVuY3Rpb24oZXZ0ICxvcHRzKSB7XHJcblx0dmFyIGRvYyA9ICQoZG9jdW1lbnQpO1xyXG5cdHZhciBzY3JvbGxMZWZ0ID0gZG9jdW1lbnQuYm9keS5zY3JvbGxMZWZ0IHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0O1xyXG5cdHZhciBzY3JvbGxUb3AgPSBkb2N1bWVudC5ib2R5LnNjcm9sbFRvcCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsVG9wO1xyXG5cdHZhciBsZWZ0T2Zmc2V0ID0gJChldnQudGFyZ2V0KS5vZmZzZXQoKS5sZWZ0IC0gc2Nyb2xsTGVmdDtcclxuXHR2YXIgaVgsIGlZLCBzdGFydFgsIGVuZFg7XHJcblx0dmFyIGRyYWdnaW5nID0gdHJ1ZTtcclxuXHJcblx0c3RhcnRYID0gaVggPSBldnQuY2xpZW50WCAtIHNjcm9sbExlZnQ7XHJcblx0aVkgPSAkKGV2dC50YXJnZXQpLm9mZnNldCgpLnRvcCAtIHNjcm9sbFRvcDtcclxuXHJcblx0b3B0cy5vbkRyYWdTdGFydCh7ICd4Jzogc3RhcnRYIH0sIG9wdHMuJGVsZW1lbnQpO1xyXG5cclxuXHRkb2Mub24oJ21vdXNlbW92ZS5kcmFnZHJvcCcsICQucHJveHkobW91c2Vtb3ZlLCB0aGlzKSk7XHJcblx0ZG9jLm9uKCdtb3VzZXVwLmRyYWdkcm9wJywgJC5wcm94eShtb3VzZXVwLCB0aGlzKSk7XHJcblx0Ly8gJChldnQudGFyZ2V0KVswXS5zZXRDYXB0dXJlICYmICQoZXZ0LnRhcmdldClbMF0uc2V0Q2FwdHVyZSgpO1xyXG5cclxuXHRmdW5jdGlvbiBtb3VzZW1vdmUoZSkge1xyXG5cdFx0aWYgKGRyYWdnaW5nKSB7XHJcblx0XHRcdGVuZFggPSBlLmNsaWVudFggLSBzY3JvbGxMZWZ0O1xyXG5cclxuXHRcdFx0Ly8gbGltaXRcclxuXHRcdFx0aWYgKGVuZFggLSBsZWZ0T2Zmc2V0IDwgRkxFWE1JTldJRFRIKSB7XHJcblx0XHRcdFx0ZW5kWCA9IGxlZnRPZmZzZXQgKyBGTEVYTUlOV0lEVEg7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdG9wdHMub25EcmFnZ2luZyggeyAneCc6IGVuZFggfSwgb3B0cy4kZWxlbWVudCk7XHJcblx0XHR9XHJcblxyXG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIG1vdXNldXAoZXZ0KSB7XHJcblx0XHR2YXIgZSA9IGV2dC50YXJnZXQ7XHJcblx0XHRkcmFnZ2luZyA9IGZhbHNlO1xyXG5cclxuXHRcdG9wdHMub25EcmFnRW5kKHsgJ3gnOiBldnQuY2xpZW50WCAtIHNjcm9sbExlZnQgfSwgb3B0cy4kZWxlbWVudCk7XHJcblxyXG5cdFx0aWYgKGUgJiYgZS5zZXRDYXB0dXJlKSB7XHJcblx0XHRcdGUucmVsZWFzZUNhcHR1cmUoKTtcclxuXHRcdH0gZWxzZSBpZiAod2luZG93LnJlbGVhc2VDYXB0dXJlKSB7XHJcblx0XHRcdHdpbmRvdy5yZWxlYXNlQ2FwdHVyZShFdmVudC5NT1VTRU1PVkUgfCBFdmVudC5NT1VTRVVQKTtcclxuXHRcdH1cclxuXHJcblx0XHRkb2Mub2ZmKCdtb3VzZW1vdmUuZHJhZ2Ryb3AnLCBtb3VzZW1vdmUpO1xyXG5cdFx0ZG9jLm9mZignbW91c2V1cC5kcmFnZHJvcCcsIG1vdXNldXApO1xyXG5cdH1cclxuXHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihkZWxlZ2F0ZSwgb3B0aW9ucykge1xyXG5cdHZhciBkZWZhdWx0cyA9IHtcclxuXHRcdHJlc3RyaWN0ZXIoZXZ0KSB7IHJldHVybiBudWxsOyB9LFxyXG5cdFx0b25EcmFnU3RhcnQob2Zmc2V0LCB0YXJnZXQpIHt9LFxyXG5cdFx0b25EcmFnZ2luZyhvZmZzZXQsIHRhcmdldCkge30sXHJcblx0XHRvbkRyYWdFbmQob2Zmc2V0LCB0YXJnZXQpIHt9XHJcblx0fTtcclxuXHJcblx0T2JqZWN0LmFzc2lnbihkZWZhdWx0cywgb3B0aW9ucyk7XHJcblxyXG5cdCQoZGVsZWdhdGUpLm9uKCdtb3VzZWRvd24nLCBvcHRpb25zLnRyaWdnZXIsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0dmFyIHJlc3RyaWN0ZXIgPSBkZWZhdWx0cy5yZXN0cmljdGVyLmNhbGwodGhpcywgZXZ0KTtcclxuXHJcblx0XHRpZiAocmVzdHJpY3Rlcikge1xyXG5cdFx0XHRkZWZhdWx0cy4kZWxlbWVudCA9IHJlc3RyaWN0ZXI7XHJcblx0XHRcdGRyYWdEcm9wLmNhbGwodGhpcywgZXZ0LCBkZWZhdWx0cyk7XHJcblx0XHR9XHJcblx0fSk7XHJcbn07IiwiLyoqXHJcbiAqIOS6i+S7tueuoeeQhlxyXG4gKiBAY2xhc3MgRXZlbnRFbWl0dGVyXHJcbiAqL1xyXG5cclxuZnVuY3Rpb24gaW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVycywgbGlzdGVuZXIpIHtcclxuXHR2YXIgaSA9IGxpc3RlbmVycy5sZW5ndGg7XHJcblx0d2hpbGUgKGktLSkge1xyXG5cdFx0aWYgKGxpc3RlbmVyc1tpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHtcclxuXHRcdFx0cmV0dXJuIGk7XHJcblx0XHR9XHJcblx0fVxyXG5cdHJldHVybiAtMTtcclxufVxyXG5cclxuZnVuY3Rpb24gaXNWYWxpZExpc3RlbmVyKGxpc3RlbmVyKSB7XHJcblx0aWYgKHR5cGVvZiBsaXN0ZW5lciA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fSBlbHNlIGlmIChsaXN0ZW5lciAmJiB0eXBlb2YgbGlzdGVuZXIgPT09ICdvYmplY3QnKSB7XHJcblx0XHRyZXR1cm4gaXNWYWxpZExpc3RlbmVyKGxpc3RlbmVyLmxpc3RlbmVyKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxufVxyXG5cclxuY2xhc3MgRXZlbnRFbWl0dGVyIHtcclxuXHJcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xyXG5cclxuXHR9XHJcblx0LyoqXHJcblx0KlxyXG5cdCpcclxuXHQqXHJcblx0KlxyXG5cdCovXHJcblx0X2dldEV2ZW50cygpIHtcclxuXHRcdHJldHVybiB0aGlzLl9ldmVudHMgfHwgKHRoaXMuX2V2ZW50cyA9IHt9KTtcclxuXHR9XHJcblx0LyoqXHJcblx0KiDpgJrov4fkuovku7blkI3ojrflj5ZsaXN0ZW5lciDmlbDnu4TmiJbliJ3lp4vljJZcclxuXHQqIOS9v+eUqOato+WImeWMuemFjeS8mui/lOWbnuS4gOS4quWvueW6lOeahOWvueixoVxyXG5cdCpcclxuXHQqIFxyXG5cdCogZ2V0TGlzdGVuZXJzXHJcblx0KiBAcGFyYW0ge1N0cmluZyB9IFJlZ0V4cH0gZXZlbnROYW1lXHJcblx0KiBAcmV0dXJuIHtGdW5jdG9uW10gfCBPYmplY3R9XHJcblx0KlxyXG5cdCovXHJcblx0Z2V0TGlzdGVuZXJzKG5hbWUpIHtcclxuXHRcdHZhciBldmVudHMgPSB0aGlzLl9nZXRFdmVudHMoKTtcclxuXHRcdHZhciByZXNwb25zZTtcclxuXHRcdHZhciBrZXk7XHJcblxyXG5cdFx0aWYgKG5hbWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcclxuXHRcdFx0cmVzcG9uc2UgPSB7fTtcclxuXHRcdFx0Zm9yIChrZXkgaW4gZXZlbnRzKSB7XHJcblx0XHRcdFx0aWYgKGV2ZW50cy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIG5hbWUudGVzdChrZXkpKSB7XHJcblx0XHRcdFx0XHRyZXNwb25zZVtrZXldID0gZXZlbnRzW2tleV07XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyZXNwb25zZSA9IGV2ZW50c1tuYW1lXSB8fCAoZXZlbnRzW25hbWVdID0gW10pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiByZXNwb25zZTtcclxuXHR9XHJcblx0LyoqXHJcblx0KiDpgJrov4fkuovku7blkI3ojrflj5ZsaXN0ZW5lciDlp4vnu4jov5Tlm57kuIDkuKrlr7nosaFcclxuXHQqXHJcblx0KiBcclxuXHQqIGdldExpc3RlbmVyc0FzT2JqZWN0XHJcblx0KiBAcGFyYW0ge1N0cmluZ3xSZWdFeHB9IGV2ZW50TmFtZVxyXG5cdCogQHJldHVybiB7T2JqZWN0fVxyXG5cdCovXHJcblx0Z2V0TGlzdGVuZXJzQXNPYmplY3QobmFtZSkge1xyXG5cdFx0dmFyIGxpc3RlbmVycyA9IHRoaXMuZ2V0TGlzdGVuZXJzKG5hbWUpO1xyXG5cdFx0dmFyIHJlc3BvbnNlO1xyXG5cclxuXHRcdGlmIChsaXN0ZW5lcnMgaW5zdGFuY2VvZiBBcnJheSkge1xyXG5cdFx0XHRyZXNwb25zZSA9IHt9O1xyXG5cdFx0XHRyZXNwb25zZVtuYW1lXSA9IGxpc3RlbmVycztcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcmVzcG9uc2UgfHwgbGlzdGVuZXJzO1xyXG5cdH1cclxuXHQvKipcclxuXHQqIOiOt+WPliBsaXN0ZW5lciDliJfooahcclxuXHQqXHJcblx0KiBmbGF0dGVuTGlzdGVuZXJzXHJcblx0KlxyXG5cdCogQHBhcmFtIHsgT2JqZWN0W119IGxpc3RlbmVyc1xyXG5cdCogQHJldHVybiB7RnVuY3Rpb25bXX1cclxuXHQqL1xyXG5cdGZsYXR0ZW5MaXN0ZW5lcnMobGlzdGVuZXJzKSB7XHJcblx0XHR2YXIgZmxhdExpc3RlbmVycyA9IFtdO1xyXG5cclxuXHRcdGZvciAodmFyIGkgPSAwLCBsID0gbGlzdGVuZXIubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcblx0XHRcdGZsYXRMaXN0ZW5lcnMucHVzaChsaXN0ZW5lcnNbaV0ubGlzdGVuZXIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmbGF0TGlzdGVuZXJzO1xyXG5cdH1cclxuXHQvKipcclxuXHQqIOS6i+S7tuazqOWGjFxyXG5cdCpcclxuXHQqXHJcblx0KiBAZXhhbXBlbFxyXG5cdCogdmFyIGVtdCA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcclxuXHQqIGVtdC5hZGRMaXN0ZW5lcignZGl2OmhvdmVyJywgZnVuY3Rpb24oKXtcclxuXHQqXHQvLyBkb1xyXG5cdCogfSk7XHJcblx0KiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lXHJcblx0KiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxyXG5cdCogQHJldHVybiB7T2JqZWN0an1cclxuXHQqXHJcblx0Ki9cclxuXHRhZGRMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lciwgZmxhZykge1xyXG5cdFx0aWYgKCFpc1ZhbGlkTGlzdGVuZXIobGlzdGVuZXIpKSB7XHJcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBsaXN0ZW5lcnMgPSB0aGlzLmdldExpc3RlbmVyc0FzT2JqZWN0KG5hbWUpO1xyXG5cdFx0dmFyIGxpc3RlbmVySXNXcmFwcGVkID0gdHlwZW9mIGxpc3RlbmVyID09PSAnb2JqZWN0JztcclxuXHRcdHZhciBrZXksIHN0YXJ0LCBhcmdzO1xyXG5cclxuXHRcdGZvciAoa2V5IGluIGxpc3RlbmVycykge1xyXG5cdFx0XHRpZiAobGlzdGVuZXJzLmhhc093blByb3BlcnR5KGtleSkgJiYgaW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVycywgbGlzdGVuZXIpID09PSAtMSkge1xyXG5cclxuXHRcdFx0XHRzdGFydCA9IGxpc3RlbmVyc1trZXldLmxlbmd0aDtcclxuXHJcblx0XHRcdFx0bGlzdGVuZXJzW2tleV0ucHVzaChsaXN0ZW5lcklzV3JhcHBlZCA/IGxpc3RlbmVyIDoge1xyXG5cdFx0XHRcdFx0bGlzdGVuZXI6IGxpc3RlbmVyLFxyXG5cdFx0XHRcdFx0b25jZTogZmFsc2VcclxuXHRcdFx0XHR9KTtcclxuXHJcblx0XHRcdFx0aWYgKGZsYWcgJiYgbGlzdGVuZXJzW2tleV0uYXJncykge1xyXG5cdFx0XHRcdFx0bGlzdGVuZXJzW2tleV0uc3RhcnQgPSBzdGFydDtcclxuXHRcdFx0XHRcdGFyZ3MgPSBsaXN0ZW5lcnNba2V5XS5hcmdzO1xyXG5cdFx0XHRcdFx0dGhpcy5lbWl0RXZlbnQobmFtZSwgYXJncyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRvbigpIHtcclxuXHRcdHJldHVybiB0aGlzLmFkZExpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cclxuXHRvbmUobmFtZSwgbGlzdGVuZXIsIGZsYWcpIHtcclxuXHRcdHJldHVybiB0aGlzLnJlbW92ZUV2ZW50KG5hbWUpLmFkZExpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiDkuovku7bms6jlhozvvIzop6blj5HlkI7oh6rliqjnp7vpmaRcclxuXHQgKlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZVxyXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyXHJcblx0ICogQHJldXRuciB7T2JqZWN0fVxyXG5cdCAqXHJcblx0ICovXHJcblx0YWRkT25jZUxpc3RlbmVyKG5hbWUsIGxpc3RlbmVyKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5hZGRMaXN0ZW5lcihuYW1lLCB7XHJcblx0XHRcdGxpc3RlbmVyOiBsaXN0ZW5lcixcclxuXHRcdFx0b25jZTogdHJ1ZVxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRvbmNlKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuYWRkT25jZUxpc3RlbmVyLmFwcGx5KHRoaXMuYXJndW1lbnRzKTtcclxuXHR9XHJcblx0LyoqXHJcblx0ICog5LqL5Lu26ZSA5q+BXHJcblx0ICpcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWVcclxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxyXG5cdCAqIEByZXR1cm4ge09iamVjdH1cclxuXHQgKlxyXG5cdCAqL1xyXG5cdHJlbW92ZUxpc3RlbmVyKG5hbWUsIGxpc3RlbmVyKSB7XHJcblx0XHR2YXIgbGlzdGVuZXJzID0gdGhpcy5nZXRMaXN0ZW5lcnNBc09iamVjdChuYW1lKTtcclxuXHRcdHZhciBpbmRleDtcclxuXHRcdHZhciBrZXk7XHJcblxyXG5cdFx0Zm9yIChrZXkgaW4gbGlzdGVuZXJzKSB7XHJcblx0XHRcdGlmIChsaXN0ZW5lcnMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xyXG5cdFx0XHRcdGluZGV4ID0gaW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVyc1trZXldLCBsaXN0ZW5lcik7XHJcblxyXG5cdFx0XHRcdGlmIChpbmRleCAhPT0gLTEpIHtcclxuXHRcdFx0XHRcdGxpc3RlbmVyc1trZXldLnNwbGljZShpbmRleCwgaSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRvZmYoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yZW1vdmVMaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHJcblx0bWFuaXB1bGF0ZUxpc3RlbmVycyhyZW1vdmUsIG5hbWUsIGxpc3RlbmVycykge1xyXG5cdFx0dmFyIHNpbmdsZSA9IHJlbW92ZSA/IHRoaXMucmVtb3ZlTGlzdGVuZXIgOiB0aGlzLmFkZExpc3RlbmVyO1xyXG5cdFx0dmFyIG11dGlwbGUgPSByZW1vdmUgPyB0aGlzLnJlbW92ZUxpc3RlbmVycyA6IHRoaXMuYWRkTGlzdGVuZXJzO1xyXG5cdFx0dmFyIGk7XHJcblx0XHR2YXIgdjtcclxuXHJcblx0XHRpZiAodHlwZW9mIG5hbWUgPT09ICdvYmplY3QnICYmICEobmFtZSBpbnN0YW5jZW9mIFJlZ0V4cCkpIHtcclxuXHRcdFx0Zm9yIChpIGluIG5hbWUpIHtcclxuXHRcdFx0XHRpZiAobmFtZS5oYXNPd25Qcm9wZXJ0eShpKSAmJiAodiA9IG5hbWVbaV0pKSB7XHJcblx0XHRcdFx0XHRpZiAodHlwZW9mIHYgPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0XHRcdFx0c2luZ2xlLmNhbGwodGhpcywgaSwgdik7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRtdXRpcGxlLmNhbGwodGhpcywgaSwgdik7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRpID0gMDtcclxuXHRcdFx0diA9IGxpc3RlbmVycy5sZW5ndGg7XHJcblx0XHRcdHdoaWxlIChpIDwgdikge1xyXG5cdFx0XHRcdHNpbmdsZS5jYWxsKHRoaXMsIG5hbWUsIGxpc3RlbmVyc1tpKytdKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0YWRkTGlzdGVuZXJzKG5hbWUsIGxpc3RlbmVycykge1xyXG5cdFx0cmV0dXJuIHRoaXMubWFuaXB1bGF0ZUxpc3RlbmVycyhmYWxzZSwgbmFtZSwgbGlzdGVuZXJzKTtcclxuXHR9XHJcblxyXG5cdHJlbW92ZUxpc3RlbmVycyhuYW1lLCBsaXN0ZW5lcnMpIHtcclxuXHRcdHJldHVybiB0aGlzLm1hbmlwdWxhdGVMaXN0ZW5lcnModHJ1ZSwgbmFtZSwgbGlzdGVuZXJzKTtcclxuXHR9XHJcblxyXG5cdHJlbW92ZUV2ZW50KG5hbWUpIHtcclxuXHRcdHZhciBldmVudHMgPSB0aGlzLl9nZXRFdmVudHMoKTtcclxuXHRcdHZhciBrZXk7XHJcblxyXG5cdFx0aWYgKHR5cGVvZiBuYW1lID09PSAnc3RyaW5nJykge1xyXG5cdFx0XHQvLyDnp7vpmaTmiYDmnInmjIflrprkuovku7blkI3nmoTmiYDmnIlsaXN0ZW5lcnNcclxuXHRcdFx0Ly8gZGVsZXRlIGV2ZW50c1tuYW1lXVxyXG5cdFx0XHRpZiAoZXZlbnRzW25hbWVdIGluc3RhbmNlb2YgQXJyYXkpIHtcclxuXHRcdFx0XHRldmVudHNbbmFtZV0ubGVuZ3RoID0gMDtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIGlmIChuYW1lIGluc3RhbmNlb2YgUmVnRXhwKSB7XHJcblx0XHRcdC8vIOato+WImeWMuemFjeeahOaJgOaciSBsaXN0ZW5lcnNcclxuXHRcdFx0Zm9yIChrZXkgaW4gZXZlbnRzKSB7XHJcblx0XHRcdFx0aWYgKGV2ZW50cy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIG5hbWUudGVzdChrZXkpKSB7XHJcblx0XHRcdFx0XHQvLyBkZWxldGUgZXZlbnRzW2tleV1cclxuXHRcdFx0XHRcdGlmIChldmVudHNba2V5XSBpbnN0YW5jZW9mIEFycmF5KSB7XHJcblx0XHRcdFx0XHRcdGV2ZW50W2tleV0ubGVuZ3RoID0gMDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdC8vIOenu+mZpOaJgOaciSBsaXN0ZW5lcnNcclxuXHRcdFx0ZGVsZXRlIHRoaXMuX2V2ZW50cztcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdHJlbW92ZUFsbExpc3RlbmVycygpIHtcclxuXHRcdHJldHVybiB0aGlzLnJlbW92ZUV2ZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cdC8qKlxyXG5cdCAqIOS6i+S7tuinpuWPkVxyXG5cdCAqXHJcblx0ICpcclxuXHQgKiBAZXhhbXBsZVxyXG5cdCAqIHZhciBlbXQgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XHJcblx0ICogc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuXHQgKiBcdGVtdC5lbWl0RXZlbnQoJ2Rpdjpob3ZlcicsIDEpO1xyXG5cdCAqIH0sIDEwMDApO1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSDkuovku7blkI3np7BcclxuXHQgKiBAcGFyYW0ge0FycmF5fSBbYXJnc10gSFRNTERvY3VtZW50LCBpdGVtRGF0YSwgLi4uXHJcblx0ICogQHJldHVybiB7T2JqZWN0fVxyXG5cdCAqXHJcblx0ICovXHJcblx0ZW1pdEV2ZW50KG5hbWUsIGFyZ3MpIHtcclxuXHRcdHZhciBsaXN0ZW5lcnNNYXAgPSB0aGlzLmdldExpc3RlbmVyc0FzT2JqZWN0KG5hbWUpO1xyXG5cdFx0dmFyIGxpc3RlbmVycztcclxuXHRcdHZhciBsaXN0ZW5lcjtcclxuXHRcdHZhciBpO1xyXG5cdFx0dmFyIGw7XHJcblx0XHR2YXIga2V5O1xyXG5cdFx0dmFyIHJlc3BvbnNlO1xyXG5cclxuXHRcdGZvciAoa2V5IGluIGxpc3RlbmVyc01hcCkge1xyXG5cdFx0XHRpZiAobGlzdGVuZXJzTWFwLmhhc093blByb3BlcnR5KGtleSkpIHtcclxuXHRcdFx0XHRsaXN0ZW5lcnMgPSBsaXN0ZW5lcnNNYXBba2V5XS5zbGljZSgwKTtcclxuXHJcblx0XHRcdFx0bGlzdGVuZXJzTWFwW2tleV0uYXJncyA9IGFyZ3M7XHJcblxyXG5cdFx0XHRcdGkgPSBsaXN0ZW5lcnNNYXBba2V5XS5zdGFydCB8fCAwO1xyXG5cdFx0XHRcdGxpc3RlbmVyc01hcFtrZXldLnN0YXJ0ID0gMDtcclxuXHJcblx0XHRcdFx0Zm9yIChsID0gbGlzdGVuZXJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG5cdFx0XHRcdFx0bGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XHJcblxyXG5cdFx0XHRcdFx0aWYgKGxpc3RlbmVyLm9uY2UgPT09IHRydWUpIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5yZW1vdmVMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lci5saXN0ZW5lcik7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0cmVzcG9uc2UgPSBsaXN0ZW5lci5saXN0ZW5lci5hcHBseSh0aGlzLCBhcmdzIHx8IFtdKTtcclxuXHJcblx0XHRcdFx0XHRpZiAocmVzcG9uc2UgPT09IHRoaXMuX2dldE9uY2VSZXR1cm5WYWx1ZSgpKSB7XHJcblx0XHRcdFx0XHRcdHRoaXMucmVtb3ZlTGlzdGVuZXIobmFtZSwgbGlzdGVuZXIubGlzdGVuZXIpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHR0cmlnZ2VyKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuZW1pdEV2ZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cclxuXHRmaXJlKG5hbWUpIHtcclxuXHRcdHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcclxuXHRcdHJldHVybiB0aGlzLmVtaXRFdmVudChuYW1lLCBhcmdzKTtcclxuXHR9XHJcblxyXG5cdF9nZXRPbmNlUmV0dXJuVmFsdWUoKSB7XHJcblx0XHRpZiAodGhpcy5oYXNPd25Qcm9wZXJ0eSgnX29uY2VSZXR1cm5WYWx1ZScpKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLl9vbmNlUmV0dXJuVmFsdWU7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdHNldE9uY2VSZXR1cm5WYWx1ZSh2YWx1ZSkge1xyXG5cdFx0dGhpcy5fb25jZVJldHVyblZhbHVlID0gdmFsdWU7XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdGRlZmluZUV2ZW50KG5hbWUpIHtcclxuXHRcdHRoaXMuZ2V0TGlzdGVuZXJzKG5hbWUpO1xyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRkZWZpbmVFdmVudHMobmFtZXMpIHtcclxuXHRcdGZvciAodmFyIGkgPSAwLCBsID0gbmFtZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcblx0XHRcdHRoaXMuZGVmaW5lRXZlbnQobmFtZVtpXSk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcclxuXHJcblxyXG4iLCJmdW5jdGlvbiBzd2FwKGFyciwgczEsIHMyKSB7XHJcblx0dmFyIHRlbXAgPSBhcnJbczFdO1xyXG5cdGFycltzMV0gPSBhcnJbczJdO1xyXG5cdGFycltzMl0gPSB0ZW1wO1xyXG59XHJcblxyXG5mdW5jdGlvbiByYW5kb21WYWx1ZShhcnIpIHtcclxuXHR2YXIgciA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGFyci5sZW5ndGgpO1xyXG5cdC8vIHN3YXAoYXJyLCAwLCByKTtcclxuXHRyZXR1cm4gW2FycltyXSwgYXJyLmZpbHRlcigoZCwgaSkgPT4gaSAhPT0gcildO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmaWx0ZXJMQW5kUihhcnIsIHNlbGVjdCwgY29tcGFyZUZuKSB7XHJcblx0dmFyIGxlZnRBcnIgPSBbXTtcclxuXHR2YXIgcmlnaHRBcnIgPSBbXTtcclxuXHJcblx0Zm9yICh2YXIgaSA9IDAsIGxlbiA9IGFyci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG5cdFx0bGV0IHRlbXAgPSBhcnJbaV07XHJcblx0XHRsZXQgY29tcGFyZWQgPSBjb21wYXJlRm4oc2VsZWN0LCB0ZW1wKTtcclxuXHRcdGlmIChjb21wYXJlZCA+IDApIHJpZ2h0QXJyLnB1c2godGVtcCk7XHJcblx0XHRlbHNlIGlmIChjb21wYXJlZCA8IDApIGxlZnRBcnIucHVzaCh0ZW1wKTtcclxuXHRcdGVsc2UgTWF0aC5yYW5kb20oKSA+IDAuNSA/IHJpZ2h0QXJyLnB1c2godGVtcCkgOiBsZWZ0QXJyLnB1c2godGVtcCk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gW2xlZnRBcnIsIHJpZ2h0QXJyXTtcclxufVxyXG5cclxuZnVuY3Rpb24gZmluZEluZGV4KGFyciwgaW5kZXgsIGNvbXBhcmVGbikge1xyXG5cdGlmIChhcnIubGVuZ3RoIDw9IDEgfHwgaW5kZXggPT09IDApIHJldHVybiBhcnJbMF07XHJcblx0dmFyIFtzZWxlY3QsIHNlY19hcnJdID0gcmFuZG9tVmFsdWUoYXJyKTtcclxuXHR2YXIgW2xlZnRBcnIsIHJpZ2h0QXJyXSA9IGZpbHRlckxBbmRSKHNlY19hcnIsIHNlbGVjdCwgY29tcGFyZUZuKTtcclxuXHR2YXIgbiA9IHJpZ2h0QXJyLmxlbmd0aDtcclxuXHJcblx0aWYgKG4gPT09IGluZGV4IC0gMSkgcmV0dXJuIHNlbGVjdDtcclxuXHRpZiAobiA+PSBpbmRleCkgcmV0dXJuIGZpbmRJbmRleChyaWdodEFyciwgaW5kZXgsIGNvbXBhcmVGbik7XHJcblx0ZWxzZSByZXR1cm4gZmluZEluZGV4KGxlZnRBcnIsIGluZGV4IC0gbiAtIDEsIGNvbXBhcmVGbik7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZmluZEluZGV4OyIsInZhciBVdGlscyA9IHt9O1xyXG5cclxudmFyIHVpZCA9IFV0aWxzLnVpZCA9ICgoKSA9PiB7XHJcblx0bGV0IHQgPSBEYXRlLm5vdygpO1xyXG5cdHJldHVybiAoKSA9PiB7XHJcblx0XHRyZXR1cm4gKHQrKykudG9TdHJpbmcoMTYpO1xyXG5cdH07XHJcbn0pKCk7XHJcblxyXG5cclxudmFyIG1lcmdlID0gVXRpbHMubWVyZ2UgPSAodGFyZ2V0LCBhZGRpdGlvbmFsLCBkZWVwKSA9PiB7XHJcblx0bGV0IGRlcHRoID0gdHlwZW9mIGRlZXAgPT0gJ3VuZGVmaW5lZCcgPyAyIDogZGVlcCwgcHJvcDtcclxuXHJcblx0Zm9yIChwcm9wIGluIGFkZGl0aW9uYWwpIHtcclxuXHRcdGlmIChhZGRpdGlvbmFsLmhhc093blByb3BlcnR5KHByb3ApKSB7XHJcblx0XHRcdGlmICh0eXBlb2YgdGFyZ2V0W3Byb3BdICE9PSAnb2JqZWN0JyB8fCAhZGVwdGgpIHtcclxuXHRcdFx0XHR0YXJnZXRbcHJvcF0gPSBhZGRpdGlvbmFsW3Byb3BdO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFV0aWxzLm1lcmdlKHRhcmdldFtwcm9wXSwgYWRkaXRpb25hbFtwcm9wXSwgZGVwdGggLSAxKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHRhcmdldDtcclxufTtcclxuXHJcbnZhciBmaW5kSW5kZXggPSBVdGlscy5maW5kSW5kZXggPSByZXF1aXJlKCcuL0ZpbmRJbmRleCcpO1xyXG52YXIgY29tcGFyZUZuID0gVXRpbHMuY29tcGFyZUZuID0gcmVxdWlyZSgnLi91dGlscy9Db21wYXJlcicpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBVdGlsczsiLCJ2YXIgY29udGV4dCA9IHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnID8gdGhpcyA6IHdpbmRvdztcclxuZXhwb3J0cy4kID0gY29udGV4dC4kO1xyXG5leHBvcnRzLl8gPSBjb250ZXh0Ll87IiwiLyoqXHJcbiAqIOWIm+W7uuavlOi+g+WHveaVsFxyXG4gKiBAc3VtbWFyeSDnuqbmnZ/mnaHku7bvvIzlj6rpkojlr7nlr7nosaHmlbDnu4Tnu5PmnoTnmoTmlbDmja7vvIzlpoJcclxuICogICAgICBbe1wiY29sXzFcIjogMTAsIFwiY29sXzJcIjogMzUsIFwiY29sXzNcIjogNjZ9LCAuLi5dXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqICB2YXIgc29ydHMgPSBbJ0EnLCdCJywnQycsJ0QnXTtcclxuICogIHZhciBkaXJzID0gWzEsIC0xLCAxLCAxXTtcclxuICpcclxuICogIHZhciBkYXRhMyA9IFtcclxuICogICAgICB7QToxLEI6MSxDOjUsX2lkOjF9LFxyXG4gKiAgICAgIHtBOjEsQjozLEM6NSxfaWQ6MX0sXHJcbiAqICAgICAge0E6MixCOjUsQzo0LF9pZDoyfSxcclxuICogICAgICB7QToxLEI6MSxDOjksX2lkOjF9LFxyXG4gKiAgICAgIHtBOjMsQjozLEM6MyxfaWQ6M30sXHJcbiAqICAgICAge0E6MSxCOjEsQzozLF9pZDoxfSxcclxuICogICAgICB7QTo0LEI6MixDOjIsX2lkOjR9LFxyXG4gKiAgICAgIHtBOjUsQjo0LEM6MSxfaWQ6NX0sXHJcbiAqICBdO1xyXG4gKlxyXG4gKiAgdmFyIGZuID0gY29tcGFyZUZuKHNvcnRzLCBkaXJzKTtcclxuICogIHZhciByZXQgPSBkYXRhMy5zb3J0KGZuKS5tYXAoZCA9PiBPYmplY3QudmFsdWVzKGQpKTtcclxuICogIGNvbnNvbGUuZGlyKHJldCk7XHJcbiAqXHJcbiAqIEBwYXJhbSB7QXJyYXl9IHNvcnRzIC3mjpLluo/lrZfmrrXmlbDnu4QgWydjb2xfMScsICdjb2xfMicsICdjb2xfMycsLi4uXVxyXG4gKiBAcGFyYW0ge0FycmF5fSBkaXJzIC3lr7nlupTlrZfkvZPmjpLluo/mlbDnu4TnmoTljYfpmY3luo8sMe+8muWNh+W6jyAtMe+8mumZjeW6jyBbMSwgLTFdXHJcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0g5q+U6L6D5Ye95pWwXHJcbiAqL1xyXG5leHBvcnRzLmNvbXBhcmVGbiA9IGZ1bmN0aW9uIGNvbXBhcmVGbihzb3J0cywgZGlycykge1xyXG4gICAgdmFyIGNvbmRpdGlvbnMgPSBzb3J0cy5yZWR1Y2UoKHByZSwgbmV4dCwgaSkgPT4ge1xyXG4gICAgICAgIHByZSAgPSBwcmUgPyBwcmUgKyAnIHx8JyA6ICcnO1xyXG4gICAgICAgIHJldHVybiBgJHtwcmV9IChhLiR7bmV4dH0gLSBiLiR7bmV4dH0pICogJHtkaXJzW2ldfWA7XHJcbiAgICB9LCAnJyk7XHJcblxyXG4gICAgdmFyIGZ1bmN0aW9uX2JvZHkgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICBsZXQgc29ydEluZm8gPSBzb3J0cy5qb2luKCcsJykucmVwbGFjZSgvKFxcdyspL2csICdcIiQxXCInKTtcclxuICAgICAgICByZXR1cm4gYHZhciBzb3J0ID0gWyR7c29ydEluZm99XTsgcmV0dXJuICR7Y29uZGl0aW9uc31gO1xyXG4gICAgfVxyXG4gICAgLy8gY29uc29sZS5sb2coZnVuY3Rpb25fYm9keSgpKTtcclxuICAgIFxyXG4gICAgcmV0dXJuIG5ldyBGdW5jdGlvbignYScsICdiJywgZnVuY3Rpb25fYm9keSgpKTtcclxufVxyXG5cclxuXHJcbiJdfQ==
