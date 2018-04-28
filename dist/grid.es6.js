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
				console.log(width);
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

			console.log(keys, dirs);

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
		this.header = new Header(this.$dom.header, this.columnModel, this.store);
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
const $ = require('../util/shim').$;
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
	constructor($header, colsModel, store) {

		this.$header = $header;
		this.colsModel = colsModel;
		this.store = store;
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

				console.log(sortState);
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

		DD(this.$row.find('li.c-header-cell'), {
			'restricter': function(evt) {
				var offsetX = evt.offsetX;
				if (evt.target.offsestWidth - offsetX <= 5) {
					return $(evt.target);
				} else if (offsetX <= 5) {
					return $(evt.target).prev();
				}
			},
			'onDragStart': function(offset, $target) {
				var scrollLeft = document.body.scrollLeft || document.documentElement.scrollLeft;
				console.log($target.offset().left, $target.text());
				startX = $target.offset().left - scrollLeft;
				// console.log(offset.x, $target.text());

				// startX = offset.x;
			},
			'onDragging': function(offset, $target) {

			},
			'onDragEnd': function(offset, $target) {
				var width = offset.x - startX;
				console.log(`${$target.text()}
					原宽度为${$target.data('column').width},
					改变为：${width}, [${offset.x} - ${startX}]`);
				$target.data('column').setWidth(width);
			}
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

class Contextmenu extends Selection {
	constructor(options) {
		super(options);

		this._headerMenu = this._initHeaderMenu();
		this._cellMenu = this._initCellMenu();
		this._selectionMenu = this._initSelectionMenu();
		this._rowMenu = this._initRowMenu();
	}

	_initHeaderMenu() {
		let self = this;

		return Menu({
			container: this.$dom.wrapper, 
			targetClass: '.c-header-cell',
			trigger: function(evt) {
				// TODO
				this.data = $(evt.target).data('column');
				return true;
			}, 
			menuList: [{ 
				text: 'lock', 
				callback: function(evt) {
					console.log(this.data);
					this.data.lock();
				} 
			}, { 
				text: 'unlock', 
				callback: function(evt) { 
					this.data.unLock();
				} 
			}, { 
				text: 'show', 
				callback: function(evt) { 
					this.data.show();
				} 
			}, { 
				text: 'hide', 
				callback: function(evt) { 
					this.data.hide();
				} 
			}, { 
				text: 'locator', 
				callback: function(evt) { 
					// TODO
					self.scrollToTop(Math.random() * 30000);
				} 
			}, { 
				text: 'count', 
				callback(evt) { 
					alert(self.store.size());
				} 
			}, { 
				text: 'select column', 
				callback(evt) { 
					// alert(self.store.size());
					self._start = [this.data.dataIndex, 0];
					self._end = [this.data.dataIndex, self.store.size() - 1];

					self.selectionRange(self._start, self._end);
				} 
			}]
		});

	}

	_initCellMenu() {
		let self = this;	

		return Menu({
			container: this.$dom.body, 
			targetClass: '.c-grid-cell',
			trigger(evt) {
				// TODO
				return evt.currentTarget.className.indexOf('c-grid-cell') != -1;
			}, 
			menuList: [{ 
				text: 'lock row to top', 
				callback(evt) { console.log(self._selection); } 
			},{ 
				text: 'lock row to bottom', 
				callback(evt) { console.log(self._selection); } 
			},{ 
				text: 'search', 
				callback(evt) { console.log(self._selection); } 
			},{ 
				text: 'mark', 
				callback(evt) { console.log(self._selection); } 
			}]
		});
	}

	_initSelectionMenu() {
		let self = this;	

		return Menu({
			container: this.$dom.body, 
			targetClass: '.c-cell-selected',
			trigger(evt) {
				// TODO
				return evt.currentTarget.className.indexOf('c-cell-selected') != -1;
			}, 
			menuList: [{ 
				text: 'copy', 
				callback(evt) { console.log(self._selection); } 
			},{ 
				text: 'print', 
				callback(evt) { console.log(self._selection); } 
			},{ 
				text: 'export', 
				callback(evt) { console.log(self._selection); } 
			},{ 
				text: 'mark', 
				callback(evt) { console.log(self._selection); } 
			}]
		});
	}

	_initRowMenu() {
		// TODO
	}

	destory() {
		super.destory();

		// TODO
	}
}

module.exports = Contextmenu;
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

function createItem(item, vm) {
	let $item = $('<li class="c-menu-item"></li>');
    let $button = $('<button type="button" class="c-menu-btn"></button>')
    	.on('click', item.callback.bind(vm));

    if (item.iconCls) {
    	$button.append('<i class="fa fa-share"></i>');
    }
    
    $button.append(`<span class="c-menu-text">${item.text}</span>`);

    return $item.append($button);
};

function compileMenu(menus, vm) {
	if (menus && menus.length === 0) return null;
	
	let $menus = $('<menu class="c-menu"></menu>');
	let $menuSeparator = $('<li class="c-menu-separator"></li>');
	
	menus.forEach(menu => {
		let $menu = createItem(menu, vm);
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

/**
 * @params {Object[]} menuList -- [{text: 'menuName', callback(evt) {} }, ...] 
 */
module.exports = function({ container, targetClass, trigger, menuList }) {
	if (!Array.isArray(menuList)) {
		menuList = [menuList];
	}

	var $vm = {
		data: null
	};

	let menu = compileMenu(menuList, $vm)[0];

	$(container).append(menu).on('contextmenu', targetClass, onContextMenu);

	function showMenu(x, y){
	    menu.style.left = x + 'px';
	    menu.style.top = y + 'px';
	    menu.classList.add('show-menu');
	}
	function hideMenu(){
	    menu.classList.remove('show-menu');
	}
	function onContextMenu(e){
		console.log(e.target.className);
		if (trigger.call($vm, e)) {
		    e.preventDefault();
		    showMenu(e.clientX - 5, e.clientY - 35);
		    document.addEventListener('mouseup', onMouseDown, true);
		}
	}
	function onMouseDown(e){
	    hideMenu();
	    document.removeEventListener('mouseup', onMouseDown);
	}

	return {

	}

	// document.addEventListener('contextmenu', onContextMenu, true);
};
},{"../util/shim":17}],13:[function(require,module,exports){
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


module.exports = function(target, options) {
	var defaults = {
		restricter(evt) { return null; },
		onDragStart(offset, target) {},
		onDragging(offset, target) {},
		onDragEnd(offset, target) {}
	};

	Object.assign(defaults, options);

	$(target).on('mousedown', function(evt) {
		var restricter = defaults.restricter(evt);

		if (restricter) {
			defaults.$element = defaults.restricter(evt) || $(evt.target);
			dragDrop(evt, defaults);
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY29yZS9CdWZmZXJOb2RlLmpzIiwic3JjL2NvcmUvQnVmZmVyWm9uZS5qcyIsInNyYy9jb3JlL0NvbE1vZGVsLmpzIiwic3JjL2NvcmUvR3JpZFN0b3JlLmpzIiwic3JjL2NvcmUvR3JpZFZpZXcuanMiLCJzcmMvY29yZS9IZWFkZXIuanMiLCJzcmMvY29yZS9Mb2NrQ29sTWFuYWdlci5qcyIsInNyYy9jb3JlL1Njcm9sbGVyLmpzIiwic3JjL2V4dGVuZHMvQ29udGV4dG1lbnUuanMiLCJzcmMvZXh0ZW5kcy9TZWxlY3Rpb24uanMiLCJzcmMvaW5kZXguanMiLCJzcmMvcGx1Z2luL01lbnUuanMiLCJzcmMvdXRpbC9ERC5qcyIsInNyYy91dGlsL0V2ZW50RW1pdHRlci5qcyIsInNyYy91dGlsL0ZpbmRJbmRleC5qcyIsInNyYy91dGlsL1V0aWxzLmpzIiwic3JjL3V0aWwvc2hpbS5qcyIsInNyYy91dGlsL3V0aWxzL0NvbXBhcmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDck5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeldBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi4vdXRpbC9FdmVudEVtaXR0ZXInKTtcclxudmFyICQgPSByZXF1aXJlKCcuLi91dGlsL3NoaW0nKS4kO1xyXG5cclxudmFyIGRlZmluZURlbGwgPSBmdW5jdGlvbihjb2xNKSB7XHJcblx0bGV0IGNlbGwgPSAkKCc8bGkvPicpXHJcblx0XHQuYWRkQ2xhc3MoJ2MtZ3JpZC1jZWxsJylcclxuXHRcdC5hZGRDbGFzcygnYy1hbGlnbi0nICsgY29sTS5hbGlnbilcclxuXHRcdC5hZGRDbGFzcygoKSA9PiBjb2xNLmhpZGRlbiA/ICdjLWNvbHVtbi1oaWRlJyA6ICcnKVxyXG5cdFx0LmFkZENsYXNzKCgpID0+IGNvbE0ubG9ja2VkID8gJ2MtY29sdW1uLWxvY2tlZCcgOiAnJylcclxuXHRcdC5hdHRyKCd0YWJpbmRleCcsIC0xKVxyXG5cdFx0LmRhdGEoJ2RhdGFJbmRleCcsIGNvbE0uZGF0YUluZGV4KVxyXG5cdFx0LndpZHRoKGNvbE0ud2lkdGgpO1xyXG5cclxuXHRyZXR1cm4gY2VsbDtcclxufTtcclxuXHJcbnZhciBjcmVhdGVDZWxsID0gZnVuY3Rpb24oJHJvdywgY29sc01vZGVsKSB7XHJcblx0dmFyIHNpemUgPSBjb2xzTW9kZWwuc2l6ZSgpO1xyXG5cdHZhciBjaGlsZHJlbiA9IG5ldyBNYXAoKTtcclxuXHJcblx0Y29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblx0XHRsZXQgY2VsbCA9IGRlZmluZURlbGwoY29sTSk7XHJcblxyXG5cdFx0JHJvdy5hcHBlbmQoY2VsbCk7XHJcblx0XHRjaGlsZHJlbi5zZXQoY29sTSwgY2VsbCk7XHJcblx0fSk7XHJcblxyXG5cdHJldHVybiBjaGlsZHJlbjtcclxufTtcclxuXHJcbmNsYXNzIFJvd05vZGUgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cdGNvbnN0cnVjdG9yKGNvbHNNb2RlbCwgY29udGV4dCkge1xyXG5cdFx0c3VwZXIoKTtcclxuXHRcdHRoaXMuJHZtID0gY29udGV4dDtcclxuXHRcdHRoaXMuY29sc01vZGVsID0gY29sc01vZGVsO1xyXG5cdFx0dGhpcy4kbm9kZSA9ICQoJzx1bC8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC1yb3cnKTtcclxuXHJcblx0XHR0aGlzLmNoaWxkcmVuID0gY3JlYXRlQ2VsbCh0aGlzLiRub2RlLCBjb2xzTW9kZWwpO1xyXG5cdFx0dGhpcy5fYmluZEV2ZW50KGNvbHNNb2RlbCk7XHJcblx0fVxyXG5cclxuXHRfYmluZEV2ZW50KGNvbHNNb2RlbCkge1xyXG5cdFx0dGhpcy5jb2xzTW9kZWwub24oJ2NvbHVtbi1hZGQnLCBjb2xNID0+IHtcclxuXHRcdFx0bGV0IGNlbGwgPSBkZWZpbmVEZWxsKGNvbE0pO1xyXG5cclxuXHRcdFx0dGhpcy4kbm9kZS5hcHBlbmQoY2VsbCk7XHJcblx0XHRcdHRoaXMuY2hpbGRyZW4uc2V0KGNvbE0sIGNlbGwpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Y29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1yZXNpemVkJywgd2lkdGggPT4ge1xyXG5cdFx0XHRcdGNvbnNvbGUubG9nKHdpZHRoKTtcclxuXHRcdFx0XHR0aGlzLmNoaWxkcmVuLmdldChjb2xNKS5vdXRlcldpZHRoKHdpZHRoKTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4taGlkZGVuJywgaXNIaWRkZW4gPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNoaWxkcmVuLmdldChjb2xNKTtcclxuXHRcdFx0XHRpZiAoaXNIaWRkZW4pIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcygnYy1jb2x1bW4taGlkZScpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoJ2MtY29sdW1uLWhpZGUnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWxvY2tlZCcsIGlzTG9ja2VkID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jaGlsZHJlbi5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdGlmIChpc0xvY2tlZCkge1xyXG5cdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKCdjLWNvbHVtbi1sb2NrZWQnKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKCdjLWNvbHVtbi1sb2NrZWQnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignZGVzdG9yeScsICgpID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jaGlsZHJlbi5nZXQoY29sTSk7XHJcblx0XHRcdFx0dGhpcy5jaGlsZHJlbi5kZWxldGUoY29sTSk7XHRcdFx0XHJcblx0XHRcdFx0Y29sRWxlLnJlbW92ZSgpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0c2V0RGF0YShyb3csIG9mZnNldFRvcCkge1xyXG5cdFx0Ly8g6L+Z6YeM5aaC5p6c55SoQU9Q5pa55byP5a6e546w5pu05aW9VE9ET1xyXG5cdFx0dGhpcy4kdm0uZmlyZSgncm93LXVwZGF0ZS1iZWZvcmUnLCB0aGlzLCByb3cpO1xyXG5cclxuXHRcdHZhciBjb250ZW50O1xyXG5cdFx0dmFyIGNlbGxzID0gdGhpcy5jaGlsZHJlbjtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cclxuXHRcdFx0Y29udGVudCA9IGNvbE0ucmVuZGVyZXIocm93LmRhdGFbY29sTS5kYXRhSW5kZXhdKTtcclxuXHRcdFx0Ly8gVE9ETyBhZGRDbGFzcygoKT0+IHJvdy5jZWxsW2NvbE0uZGF0YUluZGV4XS5zZWxlY3RlZClcclxuXHRcdFx0Y2VsbHMuZ2V0KGNvbE0pLmh0bWwoY29udGVudCk7XHJcblxyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kbm9kZS5jc3MoJ3RvcCcsIG9mZnNldFRvcCkuYXR0cigncmlkJywgcm93LnJpZCk7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuJG5vZGU7XHJcblx0fVxyXG59XHJcblxyXG5jbGFzcyBCdWZmZXJOb2RlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHRjb25zdHJ1Y3RvcihsaW1pdCwgY29sc01vZGVsLCB0b3RhbCwgY2FjaGVUaW1lcykge1xyXG5cdFx0c3VwZXIoKTtcclxuXHRcdHRoaXMuaW5pdChsaW1pdCwgY29sc01vZGVsLCB0b3RhbCwgY2FjaGVUaW1lcyk7XHJcblx0fVxyXG5cclxuXHRpbml0KGxpbWl0LCBjb2xzTW9kZWwsIHRvdGFsLCBjYWNoZVRpbWVzKSB7XHJcblx0XHR0aGlzLmxpbWl0ID0gbGltaXQ7XHJcblx0XHR0aGlzLnRvdGFsID0gdG90YWw7XHJcblx0XHR0aGlzLmNhY2hlVGltZXMgPSBjYWNoZVRpbWVzIHx8IDM7XHJcblx0XHR0aGlzLm5vZGVMaXN0ID0gW107XHJcblx0XHR0aGlzLmNvbHNNb2RlbCA9IGNvbHNNb2RlbDtcclxuXHJcblx0XHQvLyDov5nph4zmmoLkuLpTZWxlY3Rpb27lrp7njrDvvIzlupTor6XnlKhBT1Dnu7TmiqQgVE9ET1xyXG5cdFx0Ly8gdGhpcy5vbigncm93LXVwZGF0ZS1iZWZvcmUnLCAocm93Tm9kZSwgcm93KSA9PiB0aGlzLmZpcmUoJ3Jvdy11cGRhdGUnLCByb3dOb2RlLCByb3cpKTtcclxuXHR9XHJcblxyXG5cdGdldE5vZGVMaXN0KCkge1xyXG5cdFx0cmV0dXJuIHRoaXMubm9kZUxpc3Q7XHJcblx0fVxyXG5cclxuXHRzZXRMaW1pdChsaW1pdCkge1xyXG5cdFx0aWYgKCtsaW1pdCA+IDApIHtcclxuXHRcdFx0dGhpcy5pbml0KGxpbWl0LCB0aGlzLmNvbHNNb2RlbCwgdGhpcy50b3RhbCwgdGhpcy5jYWNoZVRpbWVzKTtcclxuXHRcdFx0dGhpcy5maXJlKCdidWZmZXItaW5pdGlhbCcpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0c2V0VG90YWwodG90YWwpIHtcclxuXHRcdGlmICgrdG90YWwgPj0gMCkge1xyXG5cdFx0XHR0aGlzLnRvdGFsID0gdG90YWw7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRpc0Vub3VnaCgpIHtcclxuXHRcdHJldHVybiB0aGlzLm5vZGVMaXN0Lmxlbmd0aCA+PSBNYXRoLm1pbih0aGlzLnRvdGFsLCB0aGlzLmNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHR9XHJcblxyXG5cdGdldChkaXIsIGRvbWFpbikge1xyXG5cdFx0aWYgKHRoaXMuaXNFbm91Z2goKSkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5fZ2V0Tm9kZXMoZGlyLCBkb21haW4pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzLl9hZGROb2RlcyhkaXIsIGRvbWFpbik7XHJcblx0fVxyXG5cclxuXHRfZ2V0Tm9kZXMoZGlyLCBbc3RhcnQsIGVuZF0pIHtcclxuXHRcdHZhciBzZWxlY3RlZDtcclxuXHJcblx0XHRpZiAoZGlyID4gMCkge1xyXG5cdFx0XHRzZWxlY3RlZCA9IHRoaXMubm9kZUxpc3Quc2xpY2UoMCwgZW5kIC0gc3RhcnQgKyAxKTtcclxuXHRcdFx0dGhpcy5ub2RlTGlzdCA9IHRoaXMubm9kZUxpc3Quc2xpY2UoZW5kIC0gc3RhcnQgKyAxKS5jb25jYXQoc2VsZWN0ZWQpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0c2VsZWN0ZWQgPSB0aGlzLm5vZGVMaXN0LnNsaWNlKHN0YXJ0IC0gZW5kIC0gMSk7XHJcblx0XHRcdHRoaXMubm9kZUxpc3QgPSBzZWxlY3RlZC5jb25jYXQodGhpcy5ub2RlTGlzdC5zbGljZSgwLCBzdGFydCAtIGVuZCAtIDEpKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gc2VsZWN0ZWQgfHwgW107XHJcblx0fVxyXG5cclxuXHRfYWRkTm9kZXMoZGlyLCBbc3RhcnQsIGVuZF0pIHtcclxuXHRcdHZhciBub2RlcyA9IFtdO1xyXG5cclxuXHRcdGZvciAodmFyIGkgPSBzdGFydDsgaSA8PSBlbmQ7IGkrKykge1xyXG5cdFx0XHRub2Rlcy5wdXNoKG5ldyBSb3dOb2RlKHRoaXMuY29sc01vZGVsLCB0aGlzKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5ub2RlTGlzdCA9IGRpciA+IDAgPyB0aGlzLm5vZGVMaXN0LmNvbmNhdChub2RlcykgOiBub2Rlcy5jb25jYXQodGhpcy5ub2RlTGlzdCk7XHJcblxyXG5cdFx0cmV0dXJuIG5vZGVzO1xyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBCdWZmZXJOb2RlO1xyXG4iLCJjbGFzcyBCdWZmZXJab25lIHtcclxuXHRjb25zdHJ1Y3RvcihsaW1pdCwgdG90YWwsIGNhY2hlVGltZXMpIHtcclxuXHRcdHRoaXMuaW5pdChsaW1pdCwgdG90YWwsIGNhY2hlVGltZXMpO1xyXG5cdH1cclxuXHJcblx0aW5pdChsaW1pdCwgdG90YWwsIGNhY2hlVGltZXMpIHtcclxuXHRcdHRoaXMuc3RhcnQgPSAwO1xyXG5cdFx0dGhpcy5lbmQgPSB0aGlzLmxpbWl0ID0gbGltaXQ7XHJcblx0XHR0aGlzLnRvdGFsID0gK3RvdGFsO1xyXG5cdFx0dGhpcy5jYWNoZVRpbWVzID0gY2FjaGVUaW1lcyB8fCAzO1xyXG5cdFx0dGhpcy5kb21haW4gPSBbdGhpcy5zdGFydCwgdGhpcy5lbmRdO1xyXG5cdH1cclxuXHJcblx0c2V0TGltaXQobGltaXQpIHtcclxuXHRcdGlmICgrbGltaXQgPiAwKSB7XHJcblx0XHRcdHRoaXMuaW5pdChsaW1pdCwgdGhpcy50b3RhbCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRzZXRUb3RhbCh0b3RhbCkge1xyXG5cdFx0aWYgKCt0b3RhbCA+PSAwKSB7XHJcblx0XHRcdHRoaXMudG90YWwgPSB0b3RhbDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlzQW1vbmcodmFsdWUpIHtcclxuXHRcdHJldHVybiB0aGlzLnN0YXJ0IDw9IHZhbHVlICYmIHZhbHVlIDw9IHRoaXMuZW5kO1xyXG5cdH1cclxuXHJcblx0c2hvdWxkTG9hZChkaXIsIHZlcm5pZXIpIHtcclxuXHRcdGlmIChkaXIgPT09IDApIHJldHVybiBmYWxzZTtcclxuXHJcblx0XHR2YXIgc3RhcnQgPSB0aGlzLnN0YXJ0O1xyXG5cdFx0dmFyIGVuZCA9IHRoaXMuZW5kO1xyXG5cdFx0dmFyIGNhY2hlVGltZXMgPSB0aGlzLmNhY2hlVGltZXM7XHJcblxyXG5cdFx0Ly8gc2Nyb2xsIHVwXHJcblx0XHRpZiAoZGlyIDwgMCAmJiBzdGFydCA9PT0gMCkgcmV0dXJuIGZhbHNlO1xyXG5cdFx0aWYgKGRpciA8IDAgJiYgdmVybmllciA8IHN0YXJ0ICsgdGhpcy5saW1pdCkge1xyXG5cdFx0XHRpZiAodGhpcy5pc0Ftb25nKHZlcm5pZXIpKSB7XHJcblx0XHRcdFx0ZW5kID0gc3RhcnQgLSAxO1xyXG5cdFx0XHRcdHN0YXJ0ID0gTWF0aC5tYXgoMCwgZW5kIC0gdGhpcy5saW1pdCk7XHJcblx0XHRcdH0gZWxzZSBpZiAodmVybmllciA9PT0gMCkge1xyXG5cdFx0XHRcdGVuZCA9IE1hdGgubWluKHRoaXMudG90YWwsIHZlcm5pZXIgKyBjYWNoZVRpbWVzICogdGhpcy5saW1pdCk7XHJcblx0XHRcdFx0c3RhcnQgPSAwO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGVuZCA9IHZlcm5pZXIgKyB0aGlzLmxpbWl0O1xyXG5cdFx0XHRcdHN0YXJ0ID0gTWF0aC5tYXgoMCwgdmVybmllciAtIChjYWNoZVRpbWVzIC0gMSkgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5kb21haW4gPSBbc3RhcnQsIGVuZF07XHJcblx0XHRcdHRoaXMuc3RhcnQgPSBzdGFydDtcclxuXHRcdFx0dGhpcy5lbmQgPSBNYXRoLm1pbihzdGFydCArIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0LCB0aGlzLmVuZCk7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIHNjcm9sbCBkb3duXHJcblx0XHRpZiAoZGlyID4gMCAmJiBlbmQgPT09IHRoaXMudG90YWwpIHJldHVybiBmYWxzZTtcclxuXHRcdGlmIChkaXIgPiAwICYmIHZlcm5pZXIgPiBlbmQgLSB0aGlzLmxpbWl0KSB7XHJcblx0XHRcdC8vIOa4uOagh+WcqOeOsOacieiMg+WbtOWGhVxyXG5cdFx0XHRpZiAodGhpcy5pc0Ftb25nKHZlcm5pZXIpKSB7XHJcblx0XHRcdFx0c3RhcnQgPSBlbmQgKyAxO1xyXG5cdFx0XHRcdGVuZCA9IE1hdGgubWluKHRoaXMudG90YWwsIHN0YXJ0ICsgdGhpcy5saW1pdCk7XHJcblx0XHRcdH1cclxuXHRcdFx0Ly8g5ri45qCH5Yiw6L6+57uT5bC+XHJcblx0XHRcdGVsc2UgaWYgKHZlcm5pZXIgPT09IHRoaXMudG90YWwpIHtcclxuXHRcdFx0XHRlbmQgPSB0aGlzLnRvdGFsO1xyXG5cdFx0XHRcdHN0YXJ0ID0gTWF0aC5tYXgoMCwgdmVybmllciAtIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvLyDkuI3lnKjnjrDmnInojIPlm7Tlj4jmnKrliLDnu5PlsL7lpIRcclxuXHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0ZW5kID0gTWF0aC5taW4odGhpcy50b3RhbCwgdmVybmllciArIChjYWNoZVRpbWVzIC0gMSkgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0XHRzdGFydCA9IE1hdGgubWF4KDAsIGVuZCAtIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5kb21haW4gPSBbc3RhcnQsIGVuZF07XHJcblx0XHRcdHRoaXMuZW5kID0gZW5kO1xyXG5cdFx0XHR0aGlzLnN0YXJ0ID0gTWF0aC5tYXgodGhpcy5zdGFydCwgZW5kIC0gY2FjaGVUaW1lcyAqIHRoaXMubGltaXQpO1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBCdWZmZXJab25lOyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCcuLi91dGlsL0V2ZW50RW1pdHRlcicpO1xyXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuLi91dGlsL1V0aWxzJyk7XHJcbnZhciBfID0gcmVxdWlyZSgnLi4vdXRpbC9zaGltJykuXztcclxuXHJcbnZhciBkZWZSZW5kZXJlciA9IHYgPT4gdjtcclxudmFyIE9SREVSID0gWydBU0MnLCAnREVTQyddO1xyXG5cclxuY2xhc3MgQ29sdW1uIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHRjb25zdHJ1Y3RvcihjaWQsIG9wdGlvbnMsIGNvbnRleHQpIHtcclxuXHRcdHN1cGVyKCk7XHJcblxyXG5cdFx0b3B0aW9ucy5yZW5kZXJlciA9IG9wdGlvbnMucmVuZGVyZXIgfHwgZGVmUmVuZGVyZXI7XHJcblxyXG5cdFx0dmFyIGRlZmF1bHRzID0ge1xyXG5cdFx0XHQndGV4dCc6ICcnLFxyXG5cdFx0XHQndnR5cGUnOiAnc3RyaW5nJyxcclxuXHRcdFx0J2RhdGFJbmRleCc6ICcnLFxyXG5cdFx0XHQnd2lkdGgnOiA1MCxcclxuXHRcdFx0J2FsaWduJzogJ2xlZnQnLFxyXG5cclxuXHRcdFx0J3Jlc2l6YWJsZSc6IHRydWUsXHJcblx0XHRcdCdjbHMnOiAnJyxcclxuXHRcdFx0J2ZpeGVkJzogZmFsc2UsXHJcblx0XHRcdCdkcmFnZ2FibGUnOiBmYWxzZSxcclxuXHRcdFx0J3NvcnRhYmxlJzogdHJ1ZSxcclxuXHRcdFx0J2hpZGRlbic6IGZhbHNlLFxyXG5cdFx0XHQnbG9ja2VkJzogZmFsc2UsXHJcblx0XHRcdCdsb2NrYWJsZSc6IHRydWUsXHJcblx0XHRcdCdtZW51RGlzYWJsZWQnOiB0cnVlLFxyXG5cclxuXHRcdFx0J3NvcnRTdGF0ZSc6IG51bGxcclxuXHRcdH07XHJcblxyXG5cdFx0dGhpcy5jaWQgPSBjaWQ7XHJcblx0XHR0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xyXG5cdFx0T2JqZWN0LmFzc2lnbih0aGlzLCBkZWZhdWx0cywgb3B0aW9ucyk7XHJcblx0fVxyXG5cclxuXHRzZXRXaWR0aChudW0pIHtcclxuXHRcdGlmICghdGhpcy5yZXNpemFibGUpIHJldHVybjtcclxuXHRcdGlmIChpc05hTihudW0pKSByZXR1cm47XHJcblxyXG5cdFx0dGhpcy53aWR0aCA9ICtudW07XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1yZXNpemVkJywgdGhpcy53aWR0aCwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHRzaG93KCkge1xyXG5cdFx0dGhpcy5oaWRkZW4gPSBmYWxzZTtcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLWhpZGRlbicsIHRoaXMuaGlkZGVuLCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdGhpZGUoKSB7XHJcblx0XHR0aGlzLnVuTG9jaygpO1xyXG5cdFx0XHJcblx0XHR0aGlzLmhpZGRlbiA9IHRydWU7XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1oaWRkZW4nLCB0aGlzLmhpZGRlbiwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHR0b2dnbGUoKSB7XHJcblx0XHRpZiAodGhpcy5oaWRkZW4pIHtcclxuXHRcdFx0dGhpcy5zaG93KCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aGlzLmhpZGUoKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGxvY2soKSB7XHJcblx0XHRpZiAoIXRoaXMubG9ja2FibGUpIHJldHVybjtcclxuXHRcdGlmICh0aGlzLmxvY2tlZCkgcmV0dXJuO1xyXG5cclxuXHRcdHRoaXMuc2hvdygpO1xyXG5cclxuXHRcdHRoaXMubG9ja2VkID0gdHJ1ZTtcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLWxvY2tlZCcsIHRoaXMubG9ja2VkLCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdHVuTG9jaygpIHtcclxuXHRcdGlmICghdGhpcy5sb2NrYWJsZSkgcmV0dXJuO1xyXG5cdFx0aWYgKCF0aGlzLmxvY2tlZCkgcmV0dXJuO1xyXG5cclxuXHRcdHRoaXMubG9ja2VkID0gZmFsc2U7XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1sb2NrZWQnLCB0aGlzLmxvY2tlZCwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBvcmRlcltBU0MsIERFU0MsIE5PX1NPUlRdXHJcblx0ICovXHJcblx0c29ydChvcmRlcikge1xyXG5cdFx0aWYgKCF0aGlzLnNvcnRhYmxlIHx8ICF0aGlzLmRhdGFJbmRleCkgcmV0dXJuO1xyXG5cclxuXHRcdGlmIChvcmRlcikge1xyXG5cdFx0XHR0aGlzLnNvcnRTdGF0ZSA9IE9SREVSLmluY2x1ZGVzKG9yZGVyKSA/IG9yZGVyIDogbnVsbDtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoaXMuc29ydFN0YXRlID0gdGhpcy5zb3J0U3RhdGUgPT09IE9SREVSWzFdID8gT1JERVJbMF0gOiBPUkRFUlsxXTtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4tc29ydC1jaGFuZ2VkJywgdGhpcy5zb3J0U3RhdGUpO1xyXG5cdFx0dGhpcy5jb250ZXh0LmZpcmUoJ25vdGljZS1jb2xNb2RlbC1zb3J0LWNoYW5nZWQnKTtcclxuIFx0fVxyXG5cclxuIFx0cmVtb3ZlKCkge1xyXG4gXHRcdHRoaXMuZmlyZSgnZGVzdG9yeScpO1xyXG4gXHRcdHRoaXMuY29udGV4dC5maXJlKCdjb2x1bW4tcmVtb3ZlZCcsIHRoaXMpO1xyXG4gXHRcdHRoaXMucmVtb3ZlRXZlbnQoKTtcclxuIFx0fVxyXG59XHJcblxyXG5cclxuY2xhc3MgQ29sTW9kZWwgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cdGNvbnN0cnVjdG9yKGNvbHVtbnMpIHtcclxuXHRcdHN1cGVyKCk7XHJcblxyXG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KGNvbHVtbnMpKSB7XHJcblx0XHRcdHRocm93ICdyZXF1aXJlIHByb3BlcnR5IGNvbHVtbnMgaXMgYSBhcnJheSBvYmplY3QnO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuY29sdW1ucyA9IFtdOyAvLyBkYXRhIGJ5IGNvbHVtblxyXG5cdFx0dGhpcy5jb2xNb2RlbCA9IG5ldyBNYXAoKTsgLy8gZGF0YSBieSBjaWRcclxuXHRcdHRoaXMuY29sSGVhZGVycyA9IG5ldyBNYXAoKTsgLy8gZGF0YSBieSBkYXRhSW5kZXhcclxuXHJcblx0XHR0aGlzLl9pbml0Q29sdW1uKGNvbHVtbnMpO1xyXG5cdFx0dGhpcy5fYmluZEV2ZW50KCk7XHJcblx0fVxyXG5cclxuXHRfaW5pdENvbHVtbihjb2x1bW5zLCBjYWxsYmFjaykge1xyXG5cdFx0bGV0IHNpemUgPSB0aGlzLnNpemUoKTtcclxuXHJcblx0XHRjb2x1bW5zLmZvckVhY2goKGNvbCwgaW5kZXgpID0+IHtcclxuXHRcdFx0bGV0IGNpZCA9IGluZGV4ICsgc2l6ZTtcclxuXHRcdFx0bGV0IGNvbE0gPSBuZXcgQ29sdW1uKGNpZCwgY29sLCB0aGlzKTtcclxuXHJcblx0XHRcdHRoaXMuY29sTW9kZWwuc2V0KGNpZCwgY29sTSk7XHJcblx0XHRcdHRoaXMuY29sdW1ucy5wdXNoKGNvbE0pO1xyXG5cdFx0XHR0aGlzLmNvbEhlYWRlcnMuc2V0KGNvbC5kYXRhSW5kZXgsIGNvbE0pO1xyXG5cclxuXHRcdFx0Y2FsbGJhY2sgJiYgY2FsbGJhY2soY29sTSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGFkZENvbHVtbnMoY29sdW1ucykge1xyXG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KGNvbHVtbnMpKSB7XHJcblx0XHRcdGNvbHVtbnMgPSBbY29sdW1uc107XHJcblx0XHR9XHJcblx0XHR0aGlzLl9pbml0Q29sdW1uKGNvbHVtbnMsIGNvbE0gPT4gdGhpcy5maXJlKCdjb2x1bW4tYWRkJywgY29sTSkpO1xyXG5cdH1cclxuXHJcblx0cmVtb3ZlQ29sdW1uKGRhdGFJbmRleCkge1xyXG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KGRhdGFJbmRleCkpIHtcclxuXHRcdFx0ZGF0YUluZGV4ID0gW2RhdGFJbmRleF07XHJcblx0XHR9XHJcblxyXG5cdFx0ZGF0YUluZGV4LmZvckVhY2goZHMgPT4ge1xyXG5cdFx0XHRsZXQgY29sTSA9IHRoaXMuZ2V0Q29sdW1uQnlEYXRhSW5kZXgoZHMpO1xyXG5cclxuXHRcdFx0aWYgKGNvbE0pIHtcclxuXHRcdFx0XHRjb2xNLnJlbW92ZSgpO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHR0aGlzLm9uKCdub3RpY2UtY29sTW9kZWwtc29ydC1jaGFuZ2VkJywgXy5kZWJvdW5jZSgoKSA9PiB7XHJcblx0XHRcdHRoaXMuZmlyZSgnY29sdW1ucy1zb3J0LWNoYW5nZWQnKTtcclxuXHRcdH0sIDIwKSk7XHJcblxyXG5cdFx0dGhpcy5vbignY29sdW1uLXJlbW92ZWQnLCBjb2xNID0+IHtcclxuXHRcdFx0dGhpcy5jb2x1bW5zID0gdGhpcy5jb2x1bW5zLmZpbHRlcihjb2wgPT4gY29sLmRhdGFJbmRleCAhPSBjb2xNLmRhdGFJbmRleCk7XHJcblx0XHRcdHRoaXMuY29sTW9kZWwuZGVsZXRlKGNvbE0uY2lkKTtcclxuXHRcdFx0dGhpcy5jb2xIZWFkZXJzLmRlbGV0ZShjb2xNLmRhdGFJbmRleCk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdHNpemUoKSB7IFxyXG5cdFx0cmV0dXJuIHRoaXMuY29sTW9kZWwuc2l6ZTsgXHJcblx0fVxyXG5cclxuXHRnZXRDb2x1bW4oY29sKSB7XHJcblx0XHRpZiAodGhpcy5jb2x1bW5zLmluY2x1ZGVzKGNvbCkpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuY29sdW1ucy5maWx0ZXIoX2NvbCA9PiBfY29sID09IGNvbClbMF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuY29sdW1ucztcclxuXHR9XHJcblxyXG5cdGdldExvY2tDb2x1bW4oKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5jb2x1bW5zLmZpbHRlcihjb2xNID0+IHtcclxuXHRcdFx0cmV0dXJuIGNvbE0ubG9ja2VkID09PSB0cnVlO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRnZXRWaXNpYmxlQ29sdW1uKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuY29sdW1ucy5maWx0ZXIoY29sTSA9PiB7XHJcblx0XHRcdHJldHVybiAhY29sTS5oaWRkZW47XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGdldENvbHVtbkJ5RGF0YUluZGV4KGRhdGFJbmRleCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuY29sSGVhZGVycy5nZXQoZGF0YUluZGV4KSB8fCBudWxsO1xyXG5cdH1cclxuXHJcblx0Z2V0Q29sdW1uc0J5SWQoaWQpIHtcclxuXHRcdHJldHVybiB0aGlzLmNvbE1vZGVsW2lkXSB8fCBudWxsO1xyXG5cdH1cclxuXHJcblx0ZWFjaChjYWxsYmFjaywgY29udGV4dCkge1xyXG5cdFx0dGhpcy5jb2x1bW5zLmZvckVhY2goY2FsbGJhY2ssIGNvbnRleHQgfHwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHRkZXN0b3J5KCkgeyBcclxuXHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENvbE1vZGVsOyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCcuLi91dGlsL0V2ZW50RW1pdHRlcicpO1xyXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuLi91dGlsL1V0aWxzJyk7XHJcbnZhciBfID0gcmVxdWlyZSgnLi4vdXRpbC9zaGltJykuXztcclxuXHJcbmNsYXNzIFJvdyB7XHJcblx0Y29uc3RydWN0b3IocmlkLCBkYXRhKSB7XHJcblx0XHR0aGlzLnJpZCA9IHJpZDtcclxuXHRcdHRoaXMuZGF0YSA9IGRhdGE7XHJcblx0XHR0aGlzLnNlbGVjdGVkID0gZmFsc2U7XHJcblx0fVxyXG5cdHN0YXRlKCkge31cclxufVxyXG5cclxuY2xhc3MgR3JpZFN0b3JlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHJcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xyXG5cdFx0c3VwZXIoKTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbCA9IG9wdGlvbnMuY29sdW1uTW9kZWw7XHJcblxyXG5cdFx0dGhpcy5yb3dzID0gW107IC8vIGRhdGEgYnkgaW5kZXhcclxuXHRcdHRoaXMucm93TW9kZWwgPSBuZXcgTWFwKCk7IC8vIGRhdGEgYnkgaWRcclxuXHJcblxyXG5cdFx0dGhpcy5zZXREYXRhKG9wdGlvbnMuZGF0YSk7XHJcblxyXG5cdFx0dGhpcy5fc29ydFN0YXRlID0geyBrZXlzOiBbXSwgZGlyczogW10gfTtcclxuXHRcdHRoaXMuX2JpbmRFdmVudCgpO1xyXG5cdH1cclxuXHJcblx0X2JpbmRFdmVudCgpIHtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tc29ydC1jaGFuZ2VkJywgc29ydFN0YXRlID0+IHtcclxuXHRcdFx0XHRsZXQgeyBrZXlzLCBkaXJzIH0gPSB0aGlzLl9zb3J0U3RhdGU7XHJcblx0XHRcdFx0bGV0IGluZGV4ID0ga2V5cy5pbmRleE9mKGNvbE0uZGF0YUluZGV4KTtcclxuXHJcblx0XHRcdFx0Ly8g5pyq5o6S5bqPXHJcblx0XHRcdFx0aWYgKGluZGV4ID09PSAtMSAmJiAhc29ydFN0YXRlKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoaW5kZXggPT09IC0xICYmIHNvcnRTdGF0ZSkge1xyXG5cdFx0XHRcdFx0a2V5cy51bnNoaWZ0KGNvbE0uZGF0YUluZGV4KTtcclxuXHRcdFx0XHRcdGRpcnMudW5zaGlmdChzb3J0U3RhdGUudG9Mb3dlckNhc2UoKSk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyDlt7LmjpLluo8s5YWI5Yig6ZmkXHJcblx0XHRcdFx0bGV0IGtleSA9IGtleXMuc3BsaWNlKGluZGV4LCAxKVswXTtcclxuXHRcdFx0XHRsZXQgZGlyID0gZGlycy5zcGxpY2UoaW5kZXgsIDEpWzBdO1xyXG5cclxuXHRcdFx0XHRpZiAoc29ydFN0YXRlKSB7XHJcblx0XHRcdFx0XHRrZXlzLnVuc2hpZnQoa2V5KTtcclxuXHRcdFx0XHRcdGRpcnMudW5zaGlmdChzb3J0U3RhdGUudG9Mb3dlckNhc2UoKSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHQvLyDmiYDmnInliJfpg73mm7TmlrDnirbmgIHlkI5cclxuXHRcdHRoaXMuY29sc01vZGVsLm9uKCdjb2x1bW5zLXNvcnQtY2hhbmdlZCcsICgpID0+IHtcclxuXHRcdFx0bGV0IHsga2V5cywgZGlycyB9ID0gdGhpcy5fc29ydFN0YXRlO1xyXG5cdFx0XHRsZXQgaXRlcmF0ZUZuID0gcm93ID0+IHJvdy5kYXRhW2tleXNbMF1dO1xyXG5cclxuXHRcdFx0Y29uc29sZS5sb2coa2V5cywgZGlycyk7XHJcblxyXG5cdFx0XHR0aGlzLnJvd3MgPSBfLm9yZGVyQnkodGhpcy5yb3dzLCBpdGVyYXRlRm4sIGRpcnMpO1xyXG5cdFx0XHR0aGlzLnNldERhdGEoXy5tYXAodGhpcy5yb3dzLCAnZGF0YScpKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0c2xpY2Uoc3RhcnQsIGVuZCkge1xyXG5cdFx0cmV0dXJuIHRoaXMucm93cy5zbGljZShzdGFydCwgZW5kKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIOiuvue9ruaOkuW6j+eKtuaAgVxyXG5cdCAqICgrKUFTQywgLURFU0MsICFOT19TT1JUXHJcblx0ICogQHNvcnRzIHtBcnJheX0gc29ydHMgLeaOkuW6j+eKtuaAgeaVsOe7hFxyXG5cdCAqXHRzb3J0cyA9IFsnK2NvbEEnLCAnY29sQicsICctY29sQycsICchY29sRCddXHJcblx0ICogQHJldHVybnMgdGhpcztcclxuXHQgKi9cclxuXHRzZXRTb3J0U3RhdGUoc29ydHMpIHtcclxuXHRcdGlmICghQXJyYXkuaXNBcnJheShzb3J0cykpIHtcclxuXHRcdFx0c29ydHMgPSBbc29ydHNdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX3NvcnRTdGF0ZSA9IHsga2V5czogW10sIGRpcnM6IFtdIH07XHJcblxyXG5cdFx0Ly8g5Y+N6L2s5LyY5YWI57qn5pa55L6/5ZCO57ut6Kem5Y+R6aG65bqP5pe25ZCO6Kem5Y+R55qE5LyY5YWI57qn6auYXHJcblx0XHRzb3J0cy5yZXZlcnNlKCkuZWFjaChzb3J0T2JqID0+IHtcclxuXHRcdFx0bGV0IG9iaiwga2V5LCBkaXIsIGNvbDtcclxuXHJcblx0XHRcdGlmICh0eXBlb2Ygc29ydE9iaiA9PT0gJ3N0cmluZycpIHtcclxuXHRcdFx0XHRvYmogPSBzb3J0T2JqLm1hdGNoKC8oXlsrfC18IV0/KSguezAsfSkvKTtcclxuXHRcdFx0XHRkaXIgPSBvYmpbMV0gPT09ICcnID8gJ0FTQycgOiAob2JqID09PSAnLScgPyAnREVTQycgOiAnTk9fU09SVCcpO1xyXG5cdFx0XHRcdGtleSA9IG9ialsyXSA/IG9ialsyXSA6IG51bGw7XHJcblxyXG5cdFx0XHRcdGNvbCA9IHRoaXMuY29sc01vZGVsLmdldENvbHVtbkJ5RGF0YUluZGV4KGtleSk7XHJcblx0XHRcdFx0aWYgKGNvbCkge1xyXG5cdFx0XHRcdFx0Y29sLnNvcnQoZGlyKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0c2V0RGF0YShkYXRhID0gW10sIGFwcGVuZCA9IGZhbHNlKSB7XHJcblx0XHRpZiAoIWFwcGVuZCkge1xyXG5cdFx0XHR0aGlzLnJvd3MubGVuZ3RoID0gMDtcclxuXHRcdFx0dGhpcy5yb3dNb2RlbC5jbGVhcigpO1xyXG5cdFx0fVxyXG5cdFx0dmFyIGluZGV4ID0gdGhpcy5zaXplKCk7XHJcblx0XHRkYXRhLmZvckVhY2goKHJvdywgcmlkeCkgPT4ge1xyXG5cdFx0XHRsZXQgcm93TSA9IG5ldyBSb3cocmlkeCArIGluZGV4LCByb3cpO1xyXG5cdFx0XHR0aGlzLnJvd3MucHVzaChyb3dNKTtcclxuXHRcdFx0dGhpcy5yb3dNb2RlbC5zZXQocmlkeCArIGluZGV4LCByb3dNKTtcclxuXHRcdH0pO1xyXG5cdFx0dGhpcy5maXJlKCdkYXRhLWNoYW5nZWQnLCBhcHBlbmQpO1xyXG5cdH1cclxuXHJcblx0Zm9yRWFjaChjYWxsYmFjaywgY29udGV4dCkge1xyXG5cdFx0dGhpcy5yb3dzLmZvckVhY2goZnVuY3Rpb24ocm93TSwgcmlkeCkge1xyXG5cdFx0XHRjYWxsYmFjay5jYWxsKHRoaXMsIHJvd00uZGF0YSwgcmlkeCk7XHJcblx0XHR9LCBjb250ZXh0IHx8IHRoaXMpO1xyXG5cdH1cclxuXHJcblx0c2l6ZSgpIHtcclxuXHRcdHJldHVybiB0aGlzLnJvd01vZGVsLnNpemU7XHJcblx0fVxyXG5cclxuXHRkZXN0b3J5KCkgeyBcclxuXHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEdyaWRTdG9yZTsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi4vdXRpbC9FdmVudEVtaXR0ZXInKTtcclxudmFyIENvbE1vZGVsID0gcmVxdWlyZSgnLi9Db2xNb2RlbCcpO1xyXG52YXIgR3JpZFN0b3JlID0gcmVxdWlyZSgnLi9HcmlkU3RvcmUnKTtcclxudmFyIEJ1ZmZlck5vZGUgPSByZXF1aXJlKCcuL0J1ZmZlck5vZGUnKTtcclxudmFyIEJ1ZmZlclpvbmUgPSByZXF1aXJlKCcuL0J1ZmZlclpvbmUnKTtcclxudmFyIEhlYWRlciA9IHJlcXVpcmUoJy4vSGVhZGVyJyk7XHJcbnZhciBMb2NrQ29sTWFuYWdlciA9IHJlcXVpcmUoJy4vTG9ja0NvbE1hbmFnZXInKTtcclxudmFyIFNjcm9sbGVyID0gcmVxdWlyZSgnLi9TY3JvbGxlcicpO1xyXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuLi91dGlsL1V0aWxzJyk7XHJcblxyXG5mdW5jdGlvbiBjcmVhdGVMYXlvdXQoY29udGFpbmVyLCB3aWR0aCkge1xyXG5cdHZhciB3cmFwcGVyID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC13cmFwcGVyJykud2lkdGgod2lkdGgpO1xyXG5cdHZhciBoZWFkZXIgPSAkKCc8ZGl2Lz4nKS5hZGRDbGFzcygnYy1ncmlkLWhlYWRlcicpO1xyXG5cdHZhciBib2R5ID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC1ib2R5Jyk7XHJcblx0dmFyIHZpZXdwb3J0ID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC12aWV3cG9ydCcpLmFwcGVuZFRvKGJvZHkpO1xyXG5cdHZhciBjYW52YXMgPSAkKCc8ZGl2Lz4nKS5hZGRDbGFzcygnYy1ncmlkLWNhbnZhcycpLmFwcGVuZFRvKHZpZXdwb3J0KTtcclxuXHR3cmFwcGVyLmFwcGVuZChoZWFkZXIpLmFwcGVuZChib2R5KS5hcHBlbmRUbyhjb250YWluZXIpO1xyXG5cclxuXHRyZXR1cm4geyB3cmFwcGVyLCBoZWFkZXIsIGJvZHksIHZpZXdwb3J0LCBjYW52YXMgfTtcclxufVxyXG5mdW5jdGlvbiBjYWxjUm93SGVpZ2h0KCkge1xyXG5cdHZhciBsaSA9ICQoJzxsaSBjbGFzcz1cImMtZ3JpZC1jZWxsXCI+cGxhY2Vob2xkZXI8L2xpPicpLmFwcGVuZFRvKFwiYm9keVwiKTtcclxuXHR2YXIgcm93SGVpZ2h0ID0gbGkub3V0ZXJIZWlnaHQoKTtcclxuXHRsaS5yZW1vdmUoKTtcclxuXHJcblx0cmV0dXJuIHJvd0hlaWdodDtcclxufVxyXG5cclxuY2xhc3MgR3JpZENvbXBvbmVudCBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xyXG5cdFx0c3VwZXIoKTtcclxuXHJcblx0XHRpZiAoISQob3B0aW9ucy5kb21FbCkuc2l6ZSgpKSB7IHRocm93ICdyZXF1aXJlIGEgdmFsaWQgZG9tRWwnOyB9XHJcblxyXG5cdFx0dGhpcy5zaG91bGRBZGROb2RlcyA9IHRydWU7XHJcblx0XHR0aGlzLmhlaWdodCA9ICtvcHRpb25zLmhlaWdodCB8fCA1MDA7XHJcblx0XHR0aGlzLndpZHRoID0gb3B0aW9ucy53aWR0aDtcclxuXHJcblx0XHQvLyAkbGF5b3V0IGRvbVxyXG5cdFx0T2JqZWN0LmFzc2lnbih0aGlzLiRkb20gPSB7fSwgY3JlYXRlTGF5b3V0KCQob3B0aW9ucy5kb21FbCksIHRoaXMud2lkdGgpKTtcclxuXHJcblx0XHR0aGlzLmNvbHVtbk1vZGVsID0gbmV3IENvbE1vZGVsKG9wdGlvbnMuY29sdW1ucyk7XHJcblx0XHR0aGlzLnN0b3JlID0gbmV3IEdyaWRTdG9yZSh7IGNvbHVtbk1vZGVsOiB0aGlzLmNvbHVtbk1vZGVsLCAnZGF0YSc6IG9wdGlvbnMuZGF0YSB8fCBbXSB9KTtcclxuXHRcdHRoaXMuX2luaXQoKTtcclxuXHRcdHRoaXMuX2JpbmRFdmVudCgpO1xyXG5cdH1cclxuXHJcblx0X2luaXQoKSB7XHJcblx0XHR0aGlzLmhlYWRlciA9IG5ldyBIZWFkZXIodGhpcy4kZG9tLmhlYWRlciwgdGhpcy5jb2x1bW5Nb2RlbCwgdGhpcy5zdG9yZSk7XHJcblx0XHR2YXIgdG90YWwgPSB0aGlzLnN0b3JlLnNpemUoKTtcclxuXHRcdHZhciByb3dIZWlnaHQgPSB0aGlzLnJvd0hlaWdodCA9IGNhbGNSb3dIZWlnaHQoKTtcclxuXHRcdHZhciB2aWV3cG9ydEhlaWdodCA9IHRoaXMuaGVpZ2h0IC0gdGhpcy4kZG9tLmhlYWRlci5vdXRlckhlaWdodCgpO1xyXG5cdFx0dmFyIHNpbmdsZVBhZ2VTaXplID0gTWF0aC5taW4oTWF0aC5jZWlsKHZpZXdwb3J0SGVpZ2h0LyByb3dIZWlnaHQpIC0gMSwgdG90YWwgLSAxKTtcclxuXHJcblx0XHR0aGlzLmJ1ZmZlclpvbmUgPSBuZXcgQnVmZmVyWm9uZShzaW5nbGVQYWdlU2l6ZSwgdG90YWwpO1xyXG5cdFx0dGhpcy5idWZmZXJOb2RlID0gbmV3IEJ1ZmZlck5vZGUoc2luZ2xlUGFnZVNpemUsIHRoaXMuY29sdW1uTW9kZWwsIHRvdGFsKTtcclxuXHRcdHRoaXMuc2Nyb2xsZXIgPSBuZXcgU2Nyb2xsZXIocm93SGVpZ2h0LCB0aGlzLmJ1ZmZlclpvbmUpO1xyXG5cdFx0dGhpcy5zY3JvbGxlclxyXG5cdFx0XHQub25YKHggPT4ge1xyXG5cdFx0XHRcdHRoaXMuZmlyZSgnc2Nyb2xsTGVmdCcsIHgpO1xyXG5cdFx0XHRcdHRoaXMuJGRvbS5oZWFkZXIuc2Nyb2xsTGVmdCh4KTtcclxuXHRcdFx0fSlcclxuXHRcdFx0Lm9uWSgoZGlyLCBkb21haW4sIHN0YXJ0LCBlbmQsIGluZGV4LCB0b3RhbCkgPT4ge1xyXG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKGDmu5rliqjmlrnlkJHvvJoke2Rpcn0sIOWKoOi9veWMuumXtDogWyR7ZG9tYWlufV0sIOeOsOacieiMg+WbtO+8migke3N0YXJ0fSAtICR7ZW5kfSksIGApXHJcblx0XHRcdFx0dGhpcy5fYnVmZmVyUmVuZGVyKGRpciwgZG9tYWluKTtcclxuXHRcdFx0fSwgMjApO1xyXG5cclxuXHRcdHRoaXMuJGRvbS52aWV3cG9ydC5oZWlnaHQodmlld3BvcnRIZWlnaHQpO1xyXG5cdFx0dGhpcy4kZG9tLnZpZXdwb3J0Lm9uKCdzY3JvbGwnLCAoZXZ0KSA9PiB7XHJcblx0XHRcdHRoaXMuc2Nyb2xsZXIuZmlyZVkoZXZ0LnRhcmdldC5zY3JvbGxUb3ApO1xyXG5cdFx0XHR0aGlzLnNjcm9sbGVyLmZpcmVYKGV2dC50YXJnZXQuc2Nyb2xsTGVmdCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmxvY2tDb2xNYW5hZ2VyID0gTG9ja0NvbE1hbmFnZXIodGhpcy5jb2x1bW5Nb2RlbCwgdGhpcy5oZWFkZXIsIHRoaXMuJGRvbSwgdGhpcy5idWZmZXJOb2RlKTtcclxuXHRcdHRoaXMuX3NldENhbnZhc1dIKHRvdGFsKTtcclxuXHR9XHJcblxyXG5cdF9zZXRDYW52YXNXSCh0b3RhbCkge1xyXG5cdFx0dGhpcy4kZG9tLmNhbnZhc1xyXG5cdFx0XHQud2lkdGgodG90YWwgPyAnYXV0bycgOiB0aGlzLl91bkxvY2tWaXNpYmxlQ29sc1dpZHRoKCkpXHJcblx0XHRcdC5oZWlnaHQodGhpcy5yb3dIZWlnaHQgKiB0b3RhbCB8fCAxKTtcclxuXHR9XHJcblxyXG5cdF91bkxvY2tWaXNpYmxlQ29sc1dpZHRoKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuaGVhZGVyLmdldFZpc2libGVDb2xzV2lkdGgoKSArIHRoaXMubG9ja0NvbE1hbmFnZXIudmlzaWJsZUxvY2tDb2x1bW4uZ2V0V2lkdGgoKTtcclxuXHR9XHJcblxyXG5cdHNjcm9sbFRvVG9wKHBvc2l0aW9uKSB7XHJcblx0XHR0aGlzLiRkb20udmlld3BvcnQuc2Nyb2xsVG9wKHBvc2l0aW9uKTtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHR0aGlzLm9uKCd2aWV3cG9ydC1oZWlnaHQtY2hhbmdlZCcsIHZpZXdwb3J0SGVpZ2h0ID0+IHtcclxuXHRcdFx0dGhpcy5fdXBkYXRlQnVmZmVyKCk7XHJcblx0XHRcdHRoaXMucmVuZGVyKCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLm9uKCdzY3JvbGxMZWZ0JywgeCA9PiB7XHJcblx0XHRcdC8vIHBlcmZvcm1hbmNlIFRPRE9cclxuXHRcdFx0Ly8gbGV0IGxvY2tDb2x1bW5XaWR0aCA9IHRoaXMuaGVhZGVyLmdldFZpc2libGVMb2NrQ29sc1dpZHRoKCk7XHJcblx0XHRcdC8vIHRoaXMuJGRvbS5jYW52YXMuZmluZCgnLmMtY29sdW1uLWxvY2tlZCcpLmNzcygnbGVmdCcsIHggLSBsb2NrQ29sdW1uV2lkdGgpO1xyXG5cdFx0XHQvLyB0aGlzLiRkb20uaGVhZGVyLmZpbmQoJy5jLWNvbHVtbi1sb2NrZWQnKS5jc3MoJ2xlZnQnLCB4IC0gbG9ja0NvbHVtbldpZHRoKTtcclxuXHRcdFx0dGhpcy5sb2NrQ29sTWFuYWdlci5zZXRMb2NrQ29sdW1uWCh4KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuc3RvcmUub24oJ2RhdGEtY2hhbmdlZCcsIChhcHBlbmQpID0+IHtcclxuXHRcdFx0bGV0IHRvdGFsID0gdGhpcy5zdG9yZS5zaXplKCk7XHJcblx0XHRcdHRoaXMuX3NldENhbnZhc1dIKHRvdGFsKTtcclxuXHRcdFx0dGhpcy5idWZmZXJOb2RlLnNldFRvdGFsKHRvdGFsKTtcclxuXHRcdFx0dGhpcy5idWZmZXJab25lLnNldFRvdGFsKHRvdGFsKTtcclxuXHJcblx0XHRcdGlmICghYXBwZW5kIHx8ICh0b3RhbCAtIDEpICogdGhpcy5yb3dIZWlnaHQgPCAyKnRoaXMuJGRvbS52aWV3cG9ydC5vdXRlckhlaWdodCgpKSB7XHJcblx0XHRcdFx0dGhpcy5fdXBkYXRlQnVmZmVyKCk7XHJcblx0XHRcdFx0dGhpcy5yZW5kZXIoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblxyXG5cdH1cclxuXHJcblx0X3VwZGF0ZUJ1ZmZlcigpIHtcclxuXHRcdHZhciBsaW1pdCA9IE1hdGgubWluKFxyXG5cdFx0XHRNYXRoLmNlaWwodGhpcy4kZG9tLnZpZXdwb3J0Lm91dGVySGVpZ2h0KCkgLyB0aGlzLnJvd0hlaWdodCkgLSAxLFxyXG5cdFx0XHR0aGlzLnN0b3JlLnNpemUoKSAtIDEpO1xyXG5cclxuXHRcdHRoaXMuYnVmZmVyWm9uZS5zZXRMaW1pdChsaW1pdCk7XHJcblx0XHR0aGlzLmJ1ZmZlck5vZGUuc2V0TGltaXQobGltaXQpO1xyXG5cdFx0dGhpcy5zaG91bGRBZGROb2RlcyA9IHRydWU7XHJcblx0XHR0aGlzLnNjcm9sbFRvVG9wKDApO1xyXG5cclxuXHRcdHRoaXMuJGRvbS5jYW52YXMuZW1wdHkoKTtcclxuXHR9XHJcblxyXG5cdF9idWZmZXJSZW5kZXIoZGlyLCBbc3RhcnQsIGVuZF0pIHtcclxuXHRcdHZhciBub2RlcyA9IHRoaXMuYnVmZmVyTm9kZS5nZXQoZGlyLCBbc3RhcnQsIGVuZF0pO1xyXG5cdFx0Y29uc29sZS5sb2coJ+S4gOasoeiOt+WPluiKgueCuemVv+W6picsIG5vZGVzLmxlbmd0aCwgc3RhcnQsIGVuZCk7XHJcblxyXG5cdFx0aWYgKCF0aGlzLnNob3VsZEFkZE5vZGVzKSB7XHJcblx0XHRcdHRoaXMuc3RvcmUuc2xpY2Uoc3RhcnQsIGVuZCArIDEpLmZvckVhY2goKHJvd00sIGkpID0+IHtcclxuXHRcdFx0XHRub2Rlc1tpXS5zZXREYXRhKHJvd00sIHJvd00ucmlkICogdGhpcy5yb3dIZWlnaHQpO1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHZhciAkZG9jRnJhbWUgPSAkKCc8ZGl2Lz4nKTtcclxuXHRcdHRoaXMuc3RvcmUuc2xpY2Uoc3RhcnQsIGVuZCArIDEpLmZvckVhY2goKHJvd00sIGkpID0+IHtcclxuXHJcblx0XHRcdGxldCBub2RlID0gbm9kZXNbaV0uc2V0RGF0YShyb3dNLCByb3dNLnJpZCAqIHRoaXMucm93SGVpZ2h0KTtcclxuXHRcdFx0JGRvY0ZyYW1lLmFwcGVuZChub2RlKTtcclxuXHRcdFxyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kZG9tLmNhbnZhcy5hcHBlbmQoJGRvY0ZyYW1lLmNoaWxkcmVuKCkpO1xyXG5cdFx0dGhpcy5sb2NrQ29sTWFuYWdlci5hZGRCdWZmZXJMb2NrTm9kZShub2Rlcyk7XHJcblxyXG5cdFx0aWYgKHRoaXMuYnVmZmVyTm9kZS5pc0Vub3VnaCgpKSB7XHJcblx0XHRcdHRoaXMuc2hvdWxkQWRkTm9kZXMgPSBmYWxzZTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJlbmRlcigpIHtcclxuXHRcdHRoaXMuX2J1ZmZlclJlbmRlcigxLCB0aGlzLmJ1ZmZlclpvbmUuZG9tYWluKTtcclxuXHR9XHJcblxyXG5cdHNldFdpZHRoKG51bSkge1xyXG5cdFx0aWYgKGlzTmFOKG51bSkpIHJldHVybjtcclxuXHJcblx0XHR0aGlzLiRkb20ud3JhcHBlci53aWR0aChudW0pO1xyXG5cdH1cclxuXHJcblx0c2V0SGVpZ2h0KG51bSkge1xyXG5cdFx0aWYgKGlzTmFOKG51bSkpIHJldHVybjtcclxuXHJcblx0XHR2YXIgdmlld3BvcnRIZWlnaHQgPSBudW0gLSB0aGlzLiRkb20uaGVhZGVyLm91dGVySGVpZ2h0KCk7XHJcblx0XHR0aGlzLiRkb20udmlld3BvcnQub3V0ZXJIZWlnaHQodmlld3BvcnRIZWlnaHQpO1xyXG5cdFx0dGhpcy5maXJlKCd2aWV3cG9ydC1oZWlnaHQtY2hhbmdlZCcsIHZpZXdwb3J0SGVpZ2h0KTtcclxuXHR9XHJcblxyXG5cdGRlc3RvcnkoKSB7XHJcblx0XHR0aGlzLmNvbHVtbk1vZGVsLmRlc3RvcnkoKTtcclxuXHRcdHRoaXMuc3RvcmUuZGVzdG9yeSgpO1xyXG5cdFx0dGhpcy5oZWFkZXIuZGVzdG9yeSgpO1xyXG5cdFx0dGhpcy4kZG9tLndyYXBwZXIucmVtb3ZlKCk7XHJcblx0fVxyXG59XHJcbm1vZHVsZS5leHBvcnRzID0gR3JpZENvbXBvbmVudDsiLCJjb25zdCAkID0gcmVxdWlyZSgnLi4vdXRpbC9zaGltJykuJDtcclxuY29uc3QgREQgPSByZXF1aXJlKCcuLi91dGlsL0REJyk7XHJcblxyXG5jb25zdCBTT1JUX0NMU19BU0MgPSAnYy1jb2x1bW4tYXNjJztcclxuY29uc3QgU09SVF9DTFNfREVTQyA9ICdjLWNvbHVtbi1kZXNjJztcclxuY29uc3QgTkVFRExFU1NfV0lEVEggPSAxMDAwO1xyXG5cclxudmFyIGNyZWF0ZUNvbHVtbkVsZW1lbnQgPSBmdW5jdGlvbihjb2xNKSB7XHJcblx0dmFyIGxvY2tDbGFzcyA9IGNvbE0ubG9ja2VkID8gJyBjLWNvbHVtbi1sb2NrZWQnIDogJyc7XHJcblxyXG5cdHJldHVybiAkKCc8bGkvPicpXHJcblx0XHQuYWRkQ2xhc3MoJ2MtaGVhZGVyLWNlbGwnICsgbG9ja0NsYXNzKVxyXG5cdFx0LmFkZENsYXNzKCdjLWFsaWduLScgKyBjb2xNLmFsaWduKVxyXG5cdFx0LndpZHRoKGNvbE0ud2lkdGgpXHJcblx0XHQub24oJ2NsaWNrJywgKCkgPT4geyBjb2xNLnNvcnQoKTsgfSlcclxuXHRcdC5kYXRhKCdjb2x1bW4nLCBjb2xNKVxyXG5cdFx0Lmh0bWwoY29sTS50ZXh0KTtcclxufTtcclxuXHJcblxyXG5jbGFzcyBIZWFkZXIge1xyXG5cdGNvbnN0cnVjdG9yKCRoZWFkZXIsIGNvbHNNb2RlbCwgc3RvcmUpIHtcclxuXHJcblx0XHR0aGlzLiRoZWFkZXIgPSAkaGVhZGVyO1xyXG5cdFx0dGhpcy5jb2xzTW9kZWwgPSBjb2xzTW9kZWw7XHJcblx0XHR0aGlzLnN0b3JlID0gc3RvcmU7XHJcblx0XHR0aGlzLmNvbEVsZW1lbnRzID0gbmV3IE1hcCgpO1xyXG5cclxuXHRcdHRoaXMuX2NyZWF0ZUNvbHVtbkVsZW1lbnRzKCk7XHJcblx0XHR0aGlzLl9iaW5kRXZlbnQoKTtcclxuXHJcblx0XHR0aGlzLnJlbmRlcigpO1xyXG5cdH1cclxuXHJcblx0X2NyZWF0ZUNvbHVtbkVsZW1lbnRzKCkge1xyXG5cdFx0dmFyIHdpZHRoID0gTkVFRExFU1NfV0lEVEg7XHJcblxyXG5cdFx0dGhpcy4kcm93ID0gJCgnPHVsLz4nKS5hZGRDbGFzcygnYy1oZWFkZXItcm93Jyk7XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwuZWFjaChjb2xNID0+IHtcclxuXHRcdFx0bGV0IGNvbEVsZW1lbnQgPSBjcmVhdGVDb2x1bW5FbGVtZW50KGNvbE0pO1xyXG5cclxuXHRcdFx0dGhpcy5jb2xFbGVtZW50cy5zZXQoY29sTSwgY29sRWxlbWVudCk7XHJcblx0XHRcdHRoaXMuJHJvdy5hcHBlbmQoY29sRWxlbWVudCk7XHJcblxyXG5cdFx0XHR3aWR0aCArPSBjb2xNLndpZHRoO1xyXG5cclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuJHJvdy53aWR0aCh3aWR0aCk7XHJcblx0fVxyXG5cclxuXHRnZXRWaXNpYmxlQ29sc1dpZHRoKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuJHJvdy53aWR0aCgpIC0gTkVFRExFU1NfV0lEVEg7XHJcblx0fVxyXG5cclxuXHRfYmluZEV2ZW50KCkge1xyXG5cdFx0dGhpcy5fY29sdW1uUmVzaXplKCk7XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwub24oJ2NvbHVtbi1hZGQnLCBjb2xNID0+IHtcclxuXHRcdFx0bGV0IGNvbEVsZW1lbnQgPSBjcmVhdGVDb2x1bW5FbGVtZW50KGNvbE0pO1xyXG5cclxuXHRcdFx0dGhpcy5jb2xFbGVtZW50cy5zZXQoY29sTSwgY29sRWxlbWVudCk7XHJcblx0XHRcdHRoaXMuJHJvdy5hcHBlbmQoY29sRWxlbWVudCk7XHJcblxyXG5cdFx0XHRsZXQgcm93VyA9IHRoaXMuJHJvdy53aWR0aCgpO1xyXG5cdFx0XHR0aGlzLiRyb3cud2lkdGgocm93VyArIGNvbE0ud2lkdGgpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwuZWFjaChjb2xNID0+IHtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1yZXNpemVkJywgd2lkdGggPT4gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSkub3V0ZXJXaWR0aCh3aWR0aCkpO1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWhpZGRlbicsIGlzSGlkZGVuID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblx0XHRcdFx0aWYgKGlzSGlkZGVuKSB7XHJcblx0XHRcdFx0XHRjb2xFbGUuYWRkQ2xhc3MoJ2MtY29sdW1uLWhpZGUnKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKCdjLWNvbHVtbi1oaWRlJyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1sb2NrZWQnLCBpc0xvY2tlZCA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0XHRpZiAoaXNMb2NrZWQpIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcygnYy1jb2x1bW4tbG9ja2VkJyk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcygnYy1jb2x1bW4tbG9ja2VkJyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1zb3J0LWNoYW5nZWQnLCBzb3J0U3RhdGUgPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHJcblx0XHRcdFx0Y29uc29sZS5sb2coc29ydFN0YXRlKTtcclxuXHRcdFx0XHRpZiAoc29ydFN0YXRlKSB7XHJcblx0XHRcdFx0XHRpZiAoc29ydFN0YXRlID09PSAnQVNDJykge1xyXG5cdFx0XHRcdFx0XHRjb2xFbGUuYWRkQ2xhc3MoU09SVF9DTFNfQVNDKTtcclxuXHRcdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKFNPUlRfQ0xTX0RFU0MpO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKFNPUlRfQ0xTX0RFU0MpO1xyXG5cdFx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoU09SVF9DTFNfQVNDKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKFNPUlRfQ0xTX0FTQykucmVtb3ZlQ2xhc3MoU09SVF9DTFNfREVTQyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2Rlc3RvcnknLCAoKSA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cdFx0XHRcdHRoaXMuY29sRWxlbWVudHMuZGVsZXRlKGNvbE0pO1x0XHRcdFxyXG5cdFx0XHRcdGNvbEVsZS5yZW1vdmUoKTtcclxuXHJcblx0XHRcdFx0bGV0IHJvd1cgPSB0aGlzLiRyb3cud2lkdGgoKTtcclxuXHRcdFx0XHR0aGlzLiRyb3cud2lkdGgocm93VyAtIGNvbE0ud2lkdGgpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0X2NvbHVtblJlc2l6ZSgpIHtcclxuXHRcdHRoaXMuJHJvdy5vbignbW91c2Vtb3ZlJywgJ2xpLmMtaGVhZGVyLWNlbGwnLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0dmFyIG9mZnNldFggPSBldnQub2Zmc2V0WDtcclxuXHRcdFx0aWYgKHRoaXMub2Zmc2V0V2lkdGggLSBvZmZzZXRYIDw9IDUgfHwgb2Zmc2V0WCA8PSA1KSB7XHJcblx0XHRcdFx0JCh0aGlzKS5hZGRDbGFzcygnYy1jb2wtcmVzaXphYmxlJyk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0JCh0aGlzKS5yZW1vdmVDbGFzcygnYy1jb2wtcmVzaXphYmxlJyk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHJcblx0XHR2YXIgc3RhcnRYID0gMDtcclxuXHJcblx0XHRERCh0aGlzLiRyb3cuZmluZCgnbGkuYy1oZWFkZXItY2VsbCcpLCB7XHJcblx0XHRcdCdyZXN0cmljdGVyJzogZnVuY3Rpb24oZXZ0KSB7XHJcblx0XHRcdFx0dmFyIG9mZnNldFggPSBldnQub2Zmc2V0WDtcclxuXHRcdFx0XHRpZiAoZXZ0LnRhcmdldC5vZmZzZXN0V2lkdGggLSBvZmZzZXRYIDw9IDUpIHtcclxuXHRcdFx0XHRcdHJldHVybiAkKGV2dC50YXJnZXQpO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAob2Zmc2V0WCA8PSA1KSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gJChldnQudGFyZ2V0KS5wcmV2KCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnb25EcmFnU3RhcnQnOiBmdW5jdGlvbihvZmZzZXQsICR0YXJnZXQpIHtcclxuXHRcdFx0XHR2YXIgc2Nyb2xsTGVmdCA9IGRvY3VtZW50LmJvZHkuc2Nyb2xsTGVmdCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsTGVmdDtcclxuXHRcdFx0XHRjb25zb2xlLmxvZygkdGFyZ2V0Lm9mZnNldCgpLmxlZnQsICR0YXJnZXQudGV4dCgpKTtcclxuXHRcdFx0XHRzdGFydFggPSAkdGFyZ2V0Lm9mZnNldCgpLmxlZnQgLSBzY3JvbGxMZWZ0O1xyXG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKG9mZnNldC54LCAkdGFyZ2V0LnRleHQoKSk7XHJcblxyXG5cdFx0XHRcdC8vIHN0YXJ0WCA9IG9mZnNldC54O1xyXG5cdFx0XHR9LFxyXG5cdFx0XHQnb25EcmFnZ2luZyc6IGZ1bmN0aW9uKG9mZnNldCwgJHRhcmdldCkge1xyXG5cclxuXHRcdFx0fSxcclxuXHRcdFx0J29uRHJhZ0VuZCc6IGZ1bmN0aW9uKG9mZnNldCwgJHRhcmdldCkge1xyXG5cdFx0XHRcdHZhciB3aWR0aCA9IG9mZnNldC54IC0gc3RhcnRYO1xyXG5cdFx0XHRcdGNvbnNvbGUubG9nKGAkeyR0YXJnZXQudGV4dCgpfVxyXG5cdFx0XHRcdFx05Y6f5a695bqm5Li6JHskdGFyZ2V0LmRhdGEoJ2NvbHVtbicpLndpZHRofSxcclxuXHRcdFx0XHRcdOaUueWPmOS4uu+8miR7d2lkdGh9LCBbJHtvZmZzZXQueH0gLSAke3N0YXJ0WH1dYCk7XHJcblx0XHRcdFx0JHRhcmdldC5kYXRhKCdjb2x1bW4nKS5zZXRXaWR0aCh3aWR0aCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0cmVuZGVyKCkge1xyXG5cdFx0dGhpcy4kaGVhZGVyLmFwcGVuZCh0aGlzLiRyb3cpO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHtcclxuXHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEhlYWRlcjsiLCIndXNlIHN0cmljdCc7XHJcblxyXG5jbGFzcyBMb2NrQ29sdW1uIHtcclxuXHRjb25zdHJ1Y3RvcigpIHtcclxuXHRcdHRoaXMuX2RhdGEgPSBbXTtcclxuXHRcdHRoaXMuX2NvbHVtbnNXaWR0aCA9IDA7XHJcblx0fVxyXG5cclxuXHRhZGQoY29sTSkge1xyXG5cdFx0dGhpcy5fZGF0YS51bnNoaWZ0KGNvbE0pO1xyXG5cdFx0dGhpcy5yZUNhbGMoKTtcclxuXHR9XHJcblxyXG5cdHJlbW92ZShkZWxDb2xNKSB7XHJcblx0XHR0aGlzLl9kYXRhID0gdGhpcy5fZGF0YS5maWx0ZXIoY29sTSA9PiBjb2xNICE9PSBkZWxDb2xNKTtcclxuXHRcdHRoaXMucmVDYWxjKCk7XHJcblx0fVxyXG5cclxuXHRjbGVhcigpIHtcclxuXHRcdHRoaXMuX2RhdGEubGVuZ3RoID0gMDtcclxuXHRcdHRoaXMucmVDYWxjKCk7XHJcblx0fVxyXG5cclxuXHRnZXRXaWR0aCgpIHtcclxuXHRcdHJldHVybiB0aGlzLl9jb2x1bW5zV2lkdGg7XHJcblx0fVxyXG5cclxuXHRyZUNhbGMoKSB7XHJcblx0XHR0aGlzLl9jb2x1bW5zV2lkdGggPSB0aGlzLl9kYXRhLnJlZHVjZSgod2lkdGgsIGNvbE0pID0+IHtcclxuXHRcdFx0d2lkdGggLT0gY29sTS53aWR0aDtcclxuXHRcdFx0Y29sTS5hd2F5RnJvbUxlZnQgPSB3aWR0aDtcclxuXHRcdFx0cmV0dXJuIHdpZHRoO1xyXG5cdFx0fSwgMCk7XHJcblx0fVxyXG5cclxuXHRlYWNoKGZuKSB7XHJcblx0XHR0aGlzLl9kYXRhLmZvckVhY2goZm4pO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICog5b2T5YW25Lit5LiA5YiX5Y+R55Sf5Y+Y5YyW77yM6YCa55+l5YW25a6D5YiX55u45bqU5Y+Y5YyWXHJcblx0ICovXHJcblx0IHB1Ymxpc2goY2hhbmdlZENvbE0sIHNjcm9sbExlZnQpIHtcclxuXHQgXHR0aGlzLl9kYXRhLmZvckVhY2goY29sTSA9PiB7XHJcblx0IFx0XHRpZiAoY29sTSAhPT0gY2hhbmdlZENvbE0pIHtcclxuXHQgXHRcdFx0Y29sTS5maXJlKCdzY3JvbGwteCcsIHNjcm9sbExlZnQpO1xyXG5cdCBcdFx0fVxyXG5cdCBcdH0pO1xyXG5cdCB9XHJcbn1cclxuXHJcbnZhciBMb2NrQ29sTWFuYWdlciA9IGZ1bmN0aW9uKGNvbHNNb2RlbCwgaGVhZGVyLCAkZG9tLCBidWZmZXJOb2RlKSB7XHJcblx0bGV0IHZpc2libGVMb2NrQ29sdW1uID0gbmV3IExvY2tDb2x1bW4oKTtcclxuXHJcblx0aW5pdCgpO1xyXG5cdGluaXRFdmVudCgpO1xyXG5cclxuXHRmdW5jdGlvbiBpbml0KCkge1xyXG5cdFx0Y29sc01vZGVsXHJcblx0XHRcdC5nZXRMb2NrQ29sdW1uKClcclxuXHRcdFx0LmZpbHRlcihjb2xNID0+ICFjb2xNLmhpZGRlbilcclxuXHRcdFx0LmZvckVhY2goY29sTSA9PiB2aXNpYmxlTG9ja0NvbHVtbi5hZGQoY29sTSkpO1xyXG5cclxuXHRcdHVwZGF0ZUJveFNpemUoKTtcclxuXHJcblx0XHR2aXNpYmxlTG9ja0NvbHVtbi5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRsZXQgaGVhZGVyRWxlbWVudCA9IGhlYWRlci5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblx0XHRcdC8vIOiuvue9ruW5tuiusOW9leWIneWni+eahOW3puS+p+S9jVxyXG5cdFx0XHRoZWFkZXJFbGVtZW50LmNzcygnbGVmdCcsIGNvbE0uYXdheUZyb21MZWZ0KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ3Njcm9sbC14JywgeCA9PiB7XHJcblx0XHRcdFx0bGV0IGxlZnRTdHlsZSA9IHsgJ2xlZnQnOiB4ICsgY29sTS5hd2F5RnJvbUxlZnQgfTtcclxuXHJcblx0XHRcdFx0aGVhZGVyRWxlbWVudC5jc3MobGVmdFN0eWxlKTtcclxuXHRcdFx0XHRidWZmZXJOb2RlLmdldE5vZGVMaXN0KCkuZm9yRWFjaChub2RlID0+IG5vZGUuY2hpbGRyZW4uZ2V0KGNvbE0pLmNzcyhsZWZ0U3R5bGUpKTtcdFx0XHRcdFxyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaW5pdEV2ZW50KCkge1xyXG5cclxuXHRcdGNvbnN0IGNvbHVtbkxvY2tPclVuTG9jayA9IChpc0xvY2tlZCwgY29sTSkgPT4ge1xyXG5cdFx0XHRsZXQgaGVhZGVyRWxlbWVudCA9IGhlYWRlci5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRpZiAoaXNMb2NrZWQpIHtcclxuXHRcdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5hZGQoY29sTSk7XHJcblxyXG5cdFx0XHRcdGNvbE0ub24oJ3Njcm9sbC14JywgeCA9PiB7XHJcblx0XHRcdFx0XHRsZXQgbGVmdFN0eWxlID0geyAnbGVmdCc6IHggKyBjb2xNLmF3YXlGcm9tTGVmdCB9O1xyXG5cclxuXHRcdFx0XHRcdGhlYWRlckVsZW1lbnQuY3NzKGxlZnRTdHlsZSk7XHJcblx0XHRcdFx0XHRidWZmZXJOb2RlLmdldE5vZGVMaXN0KCkuZm9yRWFjaChub2RlID0+IG5vZGUuY2hpbGRyZW4uZ2V0KGNvbE0pLmNzcyhsZWZ0U3R5bGUpKTtcclxuXHRcdFx0XHR9KTtcclxuXHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4ucmVtb3ZlKGNvbE0pO1xyXG5cclxuXHRcdFx0XHRjb2xNLm9mZignc2Nyb2xsLXgnKTtcclxuXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGxldCBjdXJyZW50TGVmdCA9ICRkb20udmlld3BvcnQuc2Nyb2xsTGVmdCgpICsgY29sTS5hd2F5RnJvbUxlZnQ7XHJcblxyXG5cdFx0XHQvLyDorr7nva7lubborrDlvZXliJ3lp4vnmoTlt6bkvqfkvY1cclxuXHRcdFx0aGVhZGVyRWxlbWVudC5jc3MoJ2xlZnQnLCBjdXJyZW50TGVmdCk7XHJcblx0XHRcdGJ1ZmZlck5vZGUuZ2V0Tm9kZUxpc3QoKS5mb3JFYWNoKG5vZGUgPT4gbm9kZS5jaGlsZHJlbi5nZXQoY29sTSkuY3NzKCdsZWZ0JywgY3VycmVudExlZnQpKTtcclxuXHJcblx0XHRcdHZpc2libGVMb2NrQ29sdW1uLnB1Ymxpc2goY29sTSwgJGRvbS52aWV3cG9ydC5zY3JvbGxMZWZ0KCkpO1xyXG5cdFx0XHR1cGRhdGVCb3hTaXplKCk7XHJcblx0XHR9O1xyXG5cclxuXHRcdGNvbHNNb2RlbC5vbignY29sdW1uLWFkZCcsIGNvbE0gPT4ge1xyXG5cdFx0XHQvLyBCVUdGSVggVE9ET1xyXG5cclxuXHRcdFx0Ly8gLi4uXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1sb2NrZWQnLCBpc0xvY2tlZCA9PiB7XHJcblx0XHRcdFx0Y29sdW1uTG9ja09yVW5Mb2NrKGlzTG9ja2VkLCBjb2xNKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRjb2xzTW9kZWwuZ2V0Q29sdW1uKCkuZm9yRWFjaChjb2xNID0+IHtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1yZXNpemVkJywgd2lkdGggPT4ge1xyXG5cclxuXHRcdFx0XHRpZiAoY29sTS5sb2NrZWQpIHtcclxuXHRcdFx0XHRcdHZpc2libGVMb2NrQ29sdW1uLnJlQ2FsYygpO1xyXG5cdFx0XHRcdFx0bGV0IGhlYWRlckVsZW1lbnQgPSBoZWFkZXIuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0XHRcdGxldCBjdXJyZW50TGVmdCA9ICRkb20udmlld3BvcnQuc2Nyb2xsTGVmdCgpICsgY29sTS5hd2F5RnJvbUxlZnQ7XHJcblxyXG5cdFx0XHRcdFx0aGVhZGVyRWxlbWVudC5jc3MoJ2xlZnQnLCBjdXJyZW50TGVmdCk7XHJcblx0XHRcdFx0XHRidWZmZXJOb2RlLmdldE5vZGVMaXN0KCkuZm9yRWFjaChub2RlID0+IG5vZGUuY2hpbGRyZW4uZ2V0KGNvbE0pLmNzcygnbGVmdCcsIGN1cnJlbnRMZWZ0KSk7XHJcblxyXG5cdFx0XHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4ucHVibGlzaChjb2xNLCAkZG9tLnZpZXdwb3J0LnNjcm9sbExlZnQoKSk7XHJcblx0XHRcdFx0XHR1cGRhdGVCb3hTaXplKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcclxuXHRcdFx0fSk7XHJcblxyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWxvY2tlZCcsIGlzTG9ja2VkID0+IHtcclxuXHRcdFx0XHQvLyAuLi5cclxuXHRcdFx0XHRjb2x1bW5Mb2NrT3JVbkxvY2soaXNMb2NrZWQsIGNvbE0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdFx0XHJcblx0XHRidWZmZXJOb2RlLm9uKCdidWZmZXItaW5pdGlhbCcsICgpID0+IHtcclxuXHRcdFx0Ly8gY2xlYXJCdWZmZXJMb2NrTm9kZSgpO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB1cGRhdGVCb3hTaXplKCkge1xyXG5cdFx0dmFyIHZpc2libGVMb2NrQ29sc1dpZHRoID0gdmlzaWJsZUxvY2tDb2x1bW4uZ2V0V2lkdGgoKTtcclxuXHRcdGhlYWRlci4kaGVhZGVyLmNzcygncGFkZGluZy1sZWZ0JywgLXZpc2libGVMb2NrQ29sc1dpZHRoKTtcclxuXHRcdCRkb20uY2FudmFzLmNzcygnbWFyZ2luLWxlZnQnLCAtdmlzaWJsZUxvY2tDb2xzV2lkdGgpO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHtcclxuXHRcdHZpc2libGVMb2NrQ29sdW1uLFxyXG5cdFx0c2V0TG9ja0NvbHVtblgoc2Nyb2xsTGVmdCkge1xyXG5cdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5lYWNoKGNvbE0gPT4gY29sTS5maXJlKCdzY3JvbGwteCcsIHNjcm9sbExlZnQpKTtcclxuXHRcdH0sXHJcblxyXG5cdFx0YWRkQnVmZmVyTG9ja05vZGUocm93Tm9kZXMpIHtcclxuXHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4uZWFjaChjb2xNID0+IHtcclxuXHRcdFx0XHRyb3dOb2Rlcy5mb3JFYWNoKHJvd05vZGVzID0+IHtcclxuXHRcdFx0XHRcdGxldCBjb2xFbGUgPSBoZWFkZXIuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cdFx0XHRcdFx0bGV0IGNlbGxFbGVtZW50ID0gcm93Tm9kZXMuY2hpbGRyZW4uZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0XHRcdGNlbGxFbGVtZW50LmNzcygnbGVmdCcsICRkb20udmlld3BvcnQuc2Nyb2xsTGVmdCgpICsgY29sTS5hd2F5RnJvbUxlZnQpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0sXHJcblxyXG5cdFx0Y2xlYXJCdWZmZXJMb2NrTm9kZSgpIHtcclxuXHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4uY2xlYXIoKTtcclxuXHRcdH1cclxuXHJcblx0fTtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gTG9ja0NvbE1hbmFnZXI7IiwiLy8gVE9ET1xyXG52YXIgZGVib3VuY2UgPSBmdW5jdGlvbihmbiwgdGltZSkge1xyXG5cdHZhciB0aW1lciA9IG51bGw7XHJcblx0cmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcclxuXHRcdGlmICh0aW1lcikgY2xlYXJUaW1lb3V0KHRpbWVyKTtcclxuXHJcblx0XHR0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG5cdFx0XHRmbi5hcHBseShudWxsLCBhcmdzKTtcclxuXHRcdH0sIHRpbWUpO1xyXG5cdH1cclxufVxyXG5cclxuLy/op6PlhrNyZXF1ZXN0QW5pbWF0aW9uRnJhbWXlhbzlrrnpl67pophcclxudmFyIHJhRnJhbWUgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XHJcbiAgICAgICAgICAgICAgd2luZG93LndlYmtpdFJlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxyXG4gICAgICAgICAgICAgIHdpbmRvdy5tb3pSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcclxuICAgICAgICAgICAgICB3aW5kb3cub1JlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxyXG4gICAgICAgICAgICAgIHdpbmRvdy5tc1JlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxyXG4gICAgICAgICAgICAgIGZ1bmN0aW9uKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KGNhbGxiYWNrLCAxMDAwIC8gNjApO1xyXG4gICAgICAgICAgICAgIH07XHJcblxyXG4vL+afr+mHjOWMluWwgeijhVxyXG52YXIgdGhyb3R0bGUgPSBmdW5jdGlvbihmbikge1xyXG4gICAgbGV0IGlzTG9ja2VkO1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcclxuXHJcbiAgICAgICAgaWYoaXNMb2NrZWQpIHJldHVybiBcclxuXHJcbiAgICAgICAgaXNMb2NrZWQgPSB0cnVlO1xyXG4gICAgICAgIHJhRnJhbWUoKCkgPT4ge1xyXG4gICAgICAgICAgICBpc0xvY2tlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICBmbi5hcHBseSh0aGlzLCBhcmdzKVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59O1xyXG5cclxuY2xhc3MgU2Nyb2xsZXIge1xyXG5cdGNvbnN0cnVjdG9yKGxpbmVIZWlnaHQsIGJ1ZmZlclpvbmUpIHtcclxuXHJcblx0XHR0aGlzLmJ1ZmZlclpvbmUgPSBidWZmZXJab25lO1xyXG5cdFx0dGhpcy55RGlyID0gMDsgLy8gMTrlkJHkuIrvvIwwLC0xOuWQkeS4i1xyXG5cdFx0dGhpcy55UHJlSW5kZXggPSAwOyAvLyDkuIrkuIDkuKrkvY3nva5cclxuXHRcdHRoaXMubGluZUhlaWdodCA9IGxpbmVIZWlnaHQ7XHJcblxyXG5cdFx0dGhpcy54RGlyID0gMDsgLy8gMe+8muWQkeW3pu+8jDDvvIwtMe+8muWQkeWPs1xyXG5cdFx0dGhpcy54UHJlSW5kZXggPSAwOyAvLyDliY3kuIDkuKrkvY3nva5cclxuXHJcblx0XHR0aGlzLl90cmlnZ2VyWCA9IHggPT4geDtcclxuXHRcdHRoaXMuX3RyaWdnZXJZID0geSA9PiB5O1xyXG5cclxuXHR9XHJcblxyXG5cdG9uWChjYWxsYmFjaykge1xyXG5cdFx0dGhpcy5fdHJpZ2dlclggPSB4ID0+IHtcclxuXHRcdFx0aWYgKHggPT09IHRoaXMueFByZUluZGV4KSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLnhEaXIgPSB4IC0gdGhpcy54UHJlSW5kZXg7XHJcblx0XHRcdHRoaXMueFByZUluZGV4ID0geDtcclxuXHJcblx0XHRcdGNhbGxiYWNrKHgpO1xyXG5cdFx0fTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdG9uWShoYW5kbGVyLCBkZWxheSkge1xyXG5cdFx0Ly8gVE9ET1xyXG5cdFx0Ly8gdmFyIGRlYWx5Rm4gPSBkZWJvdW5jZShoYW5kbGVyLCBkZWxheSk7XHJcblxyXG5cdFx0dGhpcy5fdHJpZ2dlclkgPSBkZWJvdW5jZSgoeSkgPT4ge1xyXG5cdFx0XHR0aGlzLnlEaXIgPSB5IC0gdGhpcy55UHJlSW5kZXg7XHJcblx0XHRcdHRoaXMueVByZUluZGV4ID0geTtcclxuXHJcblx0XHRcdHZhciBpbmRleCA9IH5+KHkvIHRoaXMubGluZUhlaWdodCk7XHJcblx0XHRcdHZhciB3aWxsTG9hZCA9IHRoaXMuYnVmZmVyWm9uZS5zaG91bGRMb2FkKHRoaXMueURpciwgaW5kZXgpO1xyXG5cclxuXHRcdFx0aWYgKHdpbGxMb2FkKSB7XHJcblx0XHRcdFx0Ly8gZGVhbHlGbigpO1xyXG5cdFx0XHRcdGhhbmRsZXIoXHJcblx0XHRcdFx0XHR0aGlzLnlEaXIgPiAwID8gMSA6IC0xLFxyXG5cdFx0XHRcdFx0dGhpcy5idWZmZXJab25lLmRvbWFpbixcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS5zdGFydCxcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS5lbmQsXHJcblx0XHRcdFx0XHRpbmRleCxcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS50b3RhbFxyXG5cdFx0XHRcdCk7XHJcblx0XHRcdH1cclxuXHRcdH0sIGRlbGF5KTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdGZpcmVYKHgpIHtcclxuXHRcdHRoaXMuX3RyaWdnZXJYKHgpO1xyXG5cdH1cclxuXHJcblx0ZmlyZVkoeSkge1xyXG5cdFx0dGhpcy5fdHJpZ2dlclkoeSk7XHJcblx0fVxyXG5cclxuXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU2Nyb2xsZXI7IiwidmFyIFNlbGVjdGlvbiA9IHJlcXVpcmUoJy4vU2VsZWN0aW9uJyk7XHJcbnZhciBNZW51ID0gcmVxdWlyZSgnLi4vcGx1Z2luL01lbnUnKTtcclxuXHJcbmNsYXNzIENvbnRleHRtZW51IGV4dGVuZHMgU2VsZWN0aW9uIHtcclxuXHRjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcblx0XHRzdXBlcihvcHRpb25zKTtcclxuXHJcblx0XHR0aGlzLl9oZWFkZXJNZW51ID0gdGhpcy5faW5pdEhlYWRlck1lbnUoKTtcclxuXHRcdHRoaXMuX2NlbGxNZW51ID0gdGhpcy5faW5pdENlbGxNZW51KCk7XHJcblx0XHR0aGlzLl9zZWxlY3Rpb25NZW51ID0gdGhpcy5faW5pdFNlbGVjdGlvbk1lbnUoKTtcclxuXHRcdHRoaXMuX3Jvd01lbnUgPSB0aGlzLl9pbml0Um93TWVudSgpO1xyXG5cdH1cclxuXHJcblx0X2luaXRIZWFkZXJNZW51KCkge1xyXG5cdFx0bGV0IHNlbGYgPSB0aGlzO1xyXG5cclxuXHRcdHJldHVybiBNZW51KHtcclxuXHRcdFx0Y29udGFpbmVyOiB0aGlzLiRkb20ud3JhcHBlciwgXHJcblx0XHRcdHRhcmdldENsYXNzOiAnLmMtaGVhZGVyLWNlbGwnLFxyXG5cdFx0XHR0cmlnZ2VyOiBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHQvLyBUT0RPXHJcblx0XHRcdFx0dGhpcy5kYXRhID0gJChldnQudGFyZ2V0KS5kYXRhKCdjb2x1bW4nKTtcclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fSwgXHJcblx0XHRcdG1lbnVMaXN0OiBbeyBcclxuXHRcdFx0XHR0ZXh0OiAnbG9jaycsIFxyXG5cdFx0XHRcdGNhbGxiYWNrOiBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRcdGNvbnNvbGUubG9nKHRoaXMuZGF0YSk7XHJcblx0XHRcdFx0XHR0aGlzLmRhdGEubG9jaygpO1xyXG5cdFx0XHRcdH0gXHJcblx0XHRcdH0sIHsgXHJcblx0XHRcdFx0dGV4dDogJ3VubG9jaycsIFxyXG5cdFx0XHRcdGNhbGxiYWNrOiBmdW5jdGlvbihldnQpIHsgXHJcblx0XHRcdFx0XHR0aGlzLmRhdGEudW5Mb2NrKCk7XHJcblx0XHRcdFx0fSBcclxuXHRcdFx0fSwgeyBcclxuXHRcdFx0XHR0ZXh0OiAnc2hvdycsIFxyXG5cdFx0XHRcdGNhbGxiYWNrOiBmdW5jdGlvbihldnQpIHsgXHJcblx0XHRcdFx0XHR0aGlzLmRhdGEuc2hvdygpO1xyXG5cdFx0XHRcdH0gXHJcblx0XHRcdH0sIHsgXHJcblx0XHRcdFx0dGV4dDogJ2hpZGUnLCBcclxuXHRcdFx0XHRjYWxsYmFjazogZnVuY3Rpb24oZXZ0KSB7IFxyXG5cdFx0XHRcdFx0dGhpcy5kYXRhLmhpZGUoKTtcclxuXHRcdFx0XHR9IFxyXG5cdFx0XHR9LCB7IFxyXG5cdFx0XHRcdHRleHQ6ICdsb2NhdG9yJywgXHJcblx0XHRcdFx0Y2FsbGJhY2s6IGZ1bmN0aW9uKGV2dCkgeyBcclxuXHRcdFx0XHRcdC8vIFRPRE9cclxuXHRcdFx0XHRcdHNlbGYuc2Nyb2xsVG9Ub3AoTWF0aC5yYW5kb20oKSAqIDMwMDAwKTtcclxuXHRcdFx0XHR9IFxyXG5cdFx0XHR9LCB7IFxyXG5cdFx0XHRcdHRleHQ6ICdjb3VudCcsIFxyXG5cdFx0XHRcdGNhbGxiYWNrKGV2dCkgeyBcclxuXHRcdFx0XHRcdGFsZXJ0KHNlbGYuc3RvcmUuc2l6ZSgpKTtcclxuXHRcdFx0XHR9IFxyXG5cdFx0XHR9LCB7IFxyXG5cdFx0XHRcdHRleHQ6ICdzZWxlY3QgY29sdW1uJywgXHJcblx0XHRcdFx0Y2FsbGJhY2soZXZ0KSB7IFxyXG5cdFx0XHRcdFx0Ly8gYWxlcnQoc2VsZi5zdG9yZS5zaXplKCkpO1xyXG5cdFx0XHRcdFx0c2VsZi5fc3RhcnQgPSBbdGhpcy5kYXRhLmRhdGFJbmRleCwgMF07XHJcblx0XHRcdFx0XHRzZWxmLl9lbmQgPSBbdGhpcy5kYXRhLmRhdGFJbmRleCwgc2VsZi5zdG9yZS5zaXplKCkgLSAxXTtcclxuXHJcblx0XHRcdFx0XHRzZWxmLnNlbGVjdGlvblJhbmdlKHNlbGYuX3N0YXJ0LCBzZWxmLl9lbmQpO1xyXG5cdFx0XHRcdH0gXHJcblx0XHRcdH1dXHJcblx0XHR9KTtcclxuXHJcblx0fVxyXG5cclxuXHRfaW5pdENlbGxNZW51KCkge1xyXG5cdFx0bGV0IHNlbGYgPSB0aGlzO1x0XHJcblxyXG5cdFx0cmV0dXJuIE1lbnUoe1xyXG5cdFx0XHRjb250YWluZXI6IHRoaXMuJGRvbS5ib2R5LCBcclxuXHRcdFx0dGFyZ2V0Q2xhc3M6ICcuYy1ncmlkLWNlbGwnLFxyXG5cdFx0XHR0cmlnZ2VyKGV2dCkge1xyXG5cdFx0XHRcdC8vIFRPRE9cclxuXHRcdFx0XHRyZXR1cm4gZXZ0LmN1cnJlbnRUYXJnZXQuY2xhc3NOYW1lLmluZGV4T2YoJ2MtZ3JpZC1jZWxsJykgIT0gLTE7XHJcblx0XHRcdH0sIFxyXG5cdFx0XHRtZW51TGlzdDogW3sgXHJcblx0XHRcdFx0dGV4dDogJ2xvY2sgcm93IHRvIHRvcCcsIFxyXG5cdFx0XHRcdGNhbGxiYWNrKGV2dCkgeyBjb25zb2xlLmxvZyhzZWxmLl9zZWxlY3Rpb24pOyB9IFxyXG5cdFx0XHR9LHsgXHJcblx0XHRcdFx0dGV4dDogJ2xvY2sgcm93IHRvIGJvdHRvbScsIFxyXG5cdFx0XHRcdGNhbGxiYWNrKGV2dCkgeyBjb25zb2xlLmxvZyhzZWxmLl9zZWxlY3Rpb24pOyB9IFxyXG5cdFx0XHR9LHsgXHJcblx0XHRcdFx0dGV4dDogJ3NlYXJjaCcsIFxyXG5cdFx0XHRcdGNhbGxiYWNrKGV2dCkgeyBjb25zb2xlLmxvZyhzZWxmLl9zZWxlY3Rpb24pOyB9IFxyXG5cdFx0XHR9LHsgXHJcblx0XHRcdFx0dGV4dDogJ21hcmsnLCBcclxuXHRcdFx0XHRjYWxsYmFjayhldnQpIHsgY29uc29sZS5sb2coc2VsZi5fc2VsZWN0aW9uKTsgfSBcclxuXHRcdFx0fV1cclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0X2luaXRTZWxlY3Rpb25NZW51KCkge1xyXG5cdFx0bGV0IHNlbGYgPSB0aGlzO1x0XHJcblxyXG5cdFx0cmV0dXJuIE1lbnUoe1xyXG5cdFx0XHRjb250YWluZXI6IHRoaXMuJGRvbS5ib2R5LCBcclxuXHRcdFx0dGFyZ2V0Q2xhc3M6ICcuYy1jZWxsLXNlbGVjdGVkJyxcclxuXHRcdFx0dHJpZ2dlcihldnQpIHtcclxuXHRcdFx0XHQvLyBUT0RPXHJcblx0XHRcdFx0cmV0dXJuIGV2dC5jdXJyZW50VGFyZ2V0LmNsYXNzTmFtZS5pbmRleE9mKCdjLWNlbGwtc2VsZWN0ZWQnKSAhPSAtMTtcclxuXHRcdFx0fSwgXHJcblx0XHRcdG1lbnVMaXN0OiBbeyBcclxuXHRcdFx0XHR0ZXh0OiAnY29weScsIFxyXG5cdFx0XHRcdGNhbGxiYWNrKGV2dCkgeyBjb25zb2xlLmxvZyhzZWxmLl9zZWxlY3Rpb24pOyB9IFxyXG5cdFx0XHR9LHsgXHJcblx0XHRcdFx0dGV4dDogJ3ByaW50JywgXHJcblx0XHRcdFx0Y2FsbGJhY2soZXZ0KSB7IGNvbnNvbGUubG9nKHNlbGYuX3NlbGVjdGlvbik7IH0gXHJcblx0XHRcdH0seyBcclxuXHRcdFx0XHR0ZXh0OiAnZXhwb3J0JywgXHJcblx0XHRcdFx0Y2FsbGJhY2soZXZ0KSB7IGNvbnNvbGUubG9nKHNlbGYuX3NlbGVjdGlvbik7IH0gXHJcblx0XHRcdH0seyBcclxuXHRcdFx0XHR0ZXh0OiAnbWFyaycsIFxyXG5cdFx0XHRcdGNhbGxiYWNrKGV2dCkgeyBjb25zb2xlLmxvZyhzZWxmLl9zZWxlY3Rpb24pOyB9IFxyXG5cdFx0XHR9XVxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRfaW5pdFJvd01lbnUoKSB7XHJcblx0XHQvLyBUT0RPXHJcblx0fVxyXG5cclxuXHRkZXN0b3J5KCkge1xyXG5cdFx0c3VwZXIuZGVzdG9yeSgpO1xyXG5cclxuXHRcdC8vIFRPRE9cclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQ29udGV4dG1lbnU7IiwidmFyIEdyaWRWaWV3ID0gcmVxdWlyZSgnLi4vY29yZS9HcmlkVmlldycpO1xyXG5cclxuY29uc3QgQ0VMTF9DTFMgPSAnbGkuYy1ncmlkLWNlbGwnO1xyXG5jb25zdCBDRUxMX1NFTEVDVEVEX0NMUyA9ICdjLWNlbGwtc2VsZWN0ZWQnO1xyXG5jb25zdCBST1dfQ0xTID0gJy5jLWdyaWQtcm93JztcclxuXHJcbmNsYXNzIFNlbGVjdGlvbiBleHRlbmRzIEdyaWRWaWV3IHtcclxuXHJcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xyXG5cdFx0c3VwZXIob3B0aW9ucyk7XHJcblxyXG5cdFx0dGhpcy5fZGVmYXVsdHMoKTtcclxuXHR9XHJcblxyXG5cdF9kZWZhdWx0cygpIHtcclxuXHRcdHRoaXMuX21vdmluZyA9IGZhbHNlO1xyXG5cdFx0dGhpcy5fc3RhcnQgPSBudWxsO1xyXG5cdFx0dGhpcy5fZW5kID0gbnVsbDtcclxuXHRcdHRoaXMuX2xhc3RZID0gbnVsbDtcclxuXHRcdHRoaXMuX3NlbGVjdGlvbiA9IFtdO1xyXG5cdFx0dGhpcy5fc2VsZWN0WSA9IFtdO1xyXG5cdFx0dGhpcy5fc2VsZWN0RGF0YUluZGV4ID0gW107XHJcblx0fVxyXG5cdFxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHRzdXBlci5fYmluZEV2ZW50KCk7XHJcblxyXG5cdFx0bGV0IHNlbGYgPSB0aGlzO1xyXG5cclxuXHRcdHRoaXMuY29sdW1uTW9kZWwub24oJ25vdGljZS1jb2xNb2RlbC1zb3J0LWNoYW5nZWQnLCAoKSA9PiB7XHJcblx0XHRcdHRoaXMuX2RlZmF1bHRzKCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLiRkb20uY2FudmFzXHJcblx0XHRcdC5vbignbW91c2Vkb3duJywgQ0VMTF9DTFMsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHRcdGlmIChldnQuYnV0dG9uID09PSAwKSB7XHJcblx0XHRcdFx0XHRzZWxmLiRkb20uY2FudmFzLmZpbmQoQ0VMTF9DTFMpLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0XHRcdHNlbGYuX21vdmluZyA9IHRydWU7XHJcblx0XHRcdFx0XHRsZXQgJGNlbGwgPSAkKHRoaXMpLmFkZENsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0XHRcdHNlbGYuX3N0YXJ0ID0gc2VsZi5fZW5kID0gWyRjZWxsLmRhdGEoJ2RhdGFJbmRleCcpLCArJGNlbGwucGFyZW50KFJPV19DTFMpLmF0dHIoJ3JpZCcpXTtcclxuXHRcdFx0XHRcdC8vIGNvbnNvbGUubG9nKHN0YXJ0KTtcclxuXHRcdFx0XHR9IFxyXG5cdFx0XHRcdGVsc2UgaWYgKGV2dC5idXR0b24gPT09IDIpIHtcclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSlcclxuXHRcdFx0Lm9uKCdtb3VzZWVudGVyJywgQ0VMTF9DTFMsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHRcdGlmIChzZWxmLl9tb3ZpbmcpIHtcclxuXHRcdFx0XHRcdGxldCAkY2VsbCA9ICQodGhpcyk7XHJcblx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdCRjZWxsLmFkZENsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0XHRcdHNlbGYuX2VuZCA9IFskY2VsbC5kYXRhKCdkYXRhSW5kZXgnKSwgKyRjZWxsLnBhcmVudChST1dfQ0xTKS5hdHRyKCdyaWQnKV07XHJcblxyXG5cdFx0XHRcdFx0c2VsZi5zZWxlY3Rpb25SYW5nZShzZWxmLl9zdGFydCwgc2VsZi5fZW5kKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pXHJcblx0XHRcdC5vbignbW91c2V1cCcsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHRcdHNlbGYuX21vdmluZyA9IGZhbHNlO1xyXG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKGVuZCk7XHJcblx0XHRcdFx0Y29uc29sZS5sb2coc2VsZi5fc2VsZWN0aW9uKTtcclxuXHRcdFx0XHQvLyBUT0RPXHJcblx0XHRcdFx0Ly8gY29weSgkKCcuY2VsbC5zZWxlY3RlZCcpKTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5idWZmZXJOb2RlLm9uKCdyb3ctdXBkYXRlLWJlZm9yZScsIChyb3dOb2RlLCByb3cpID0+IHtcclxuXHRcdFx0Ly8gY29uc29sZS5sb2cocm93Tm9kZS4kbm9kZSwgcm93LnJpZCwgdGhpcy5fc2VsZWN0WSk7XHJcblxyXG5cdFx0XHRpZiAodGhpcy5fc2VsZWN0aW9uLmxlbmd0aCA9PT0gMCkgcmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRcclxuXHRcdFx0bGV0IGkgPSByb3cucmlkO1xyXG5cdFx0XHRsZXQgW3kwLCB5MV0gPSB0aGlzLl9zZWxlY3RZO1xyXG5cdFx0XHRsZXQgY29scyA9IHRoaXMuX3NlbGVjdERhdGFJbmRleDtcclxuXHJcblx0XHRcdGlmIChpID49IHkwICYmIGkgPCB5MSArIDEpIHtcclxuXHRcdFx0XHRjb2xzLmZvckVhY2goKGNvbCkgPT4ge1xyXG5cdFx0XHRcdFx0cm93Tm9kZS5jaGlsZHJlbi5mb3JFYWNoKCgkY2VsbCwgY29sTSkgPT4ge1xyXG5cdFx0XHRcdFx0XHRpZiAoY29scy5pbmRleE9mKGNvbE0uZGF0YUluZGV4KSAhPSAtMSkge1xyXG5cdFx0XHRcdFx0XHRcdCRjZWxsLmFkZENsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHQkY2VsbC5yZW1vdmVDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUylcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0cm93Tm9kZS4kbm9kZS5maW5kKENFTExfQ0xTKS5yZW1vdmVDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdH1cclxuXHJcblx0XHR9KTtcclxuXHRcdFxyXG5cdH1cclxuXHJcblx0c2VsZWN0aW9uUmFuZ2UoW3gwLCB5MF0sIFt4MSwgeTFdKSB7XHJcblxyXG5cdFx0bGV0IHlEaXIgPSB5MSAtIHkwO1xyXG5cdFx0bGV0IGxhc3RZID0gdGhpcy5fbGFzdFk7XHJcblx0XHRcdFxyXG5cdFx0Ly8geVJhbmdlID0geyBsYXN0OiAsIG5vdzogW3kwLCB5MV0gfTtcclxuXHRcdC8vIFtsMCwgbDFdXHJcblx0XHQvLyBbeTAsIHkxXVxyXG5cdFx0Ly8gW2wwLCBsMV1cclxuXHRcdGxldCByZW1vdmVZUmFuZ2UgPSBbXTtcclxuXHRcdC8vIGRvd25cclxuXHRcdGlmICh5RGlyID49IDAgJiYgeTEgPCBsYXN0WSkge1xyXG5cdFx0XHRyZW1vdmVZUmFuZ2UgPSBbeTEsIGxhc3RZXTtcclxuXHRcdH1cclxuXHRcdC8vIHVwXHJcblx0XHRpZiAoeURpciA8PSAwICYmIHkxID4gbGFzdFkpIHtcclxuXHRcdFx0cmVtb3ZlWVJhbmdlID0gW2xhc3RZLCB5MV07XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdHRoaXMuX2xhc3RZID0geTE7XHJcblx0XHQvLyBjb25zb2xlLmxvZyh5RGlyLCByZW1vdmVZUmFuZ2UpO1xyXG5cclxuXHRcdGxldCBkYXRhSW5kZXggPSB0aGlzLmdldExvY2tBbmRWaXNpYWJsZUNvbHVtbkFzRGF0YUluZGV4KCk7XHJcblx0XHRbeDAsIHkwLCB4MSwgeTFdID0gb3JkZXJCeSh4MCwgeTAsIHgxLCB5MSwgZGF0YUluZGV4KTtcclxuXHJcblxyXG5cdFx0bGV0IGNvbHMgPSB0aGlzLl9zZWxlY3REYXRhSW5kZXggPSBkYXRhSW5kZXguc2xpY2UoZGF0YUluZGV4LmluZGV4T2YoeDApLCBkYXRhSW5kZXguaW5kZXhPZih4MSkrMSk7XHJcblx0XHQvLyBjb25zb2xlLmxvZyhjb2xzKTtcclxuXHJcblx0XHR0aGlzLl9zZWxlY3RZID0gW3kwLCB5MSArIDFdO1xyXG5cdFx0bGV0IHJvd3MgPSB0aGlzLnN0b3JlLnNsaWNlKHkwLCB5MSArIDEpO1xyXG5cclxuXHRcdHRoaXMuX3NlbGVjdGlvbiA9IHJvd3MubWFwKHJvdyA9PiB7XHJcblx0XHRcdHJldHVybiBjb2xzLm1hcChjb2wgPT4gcm93LmRhdGFbY29sXSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLl9yZVBhaW50Tm9kZSh5RGlyLCB5MCwgeTEsIHJlbW92ZVlSYW5nZSwgY29scyk7XHJcblx0fVxyXG5cclxuXHRfcmVQYWludE5vZGUoeURpciwgeTAsIHkxLCByZW1vdmVZUmFuZ2UsIGNvbHMpIHtcclxuXHRcdGxldCBub2RlTGlzdCA9IHRoaXMuYnVmZmVyTm9kZS5nZXROb2RlTGlzdCgpO1xyXG5cdFx0bm9kZUxpc3QuZm9yRWFjaCgocm93Tm9kZSkgPT4ge1xyXG5cdFx0XHRsZXQgJHJvdyA9IHJvd05vZGUuJG5vZGU7XHJcblx0XHRcdGxldCBpICA9ICskcm93LmF0dHIoJ3JpZCcpO1xyXG5cdFx0XHRcclxuXHRcdFx0aWYgKGkgPj0geTAgJiYgaSA8IHkxICsgMSkge1xyXG5cdFx0XHRcdGNvbHMuZm9yRWFjaCgoY29sKSA9PiB7XHJcblx0XHRcdFx0XHRyb3dOb2RlLmNoaWxkcmVuLmZvckVhY2goKCRjZWxsLCBjb2xNKSA9PiB7XHJcblx0XHRcdFx0XHRcdGlmIChjb2xzLmluZGV4T2YoY29sTS5kYXRhSW5kZXgpICE9IC0xKSB7XHJcblx0XHRcdFx0XHRcdFx0JGNlbGwuYWRkQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdCRjZWxsLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKVxyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKHlEaXIgPj0gMCAmJiBpID4gcmVtb3ZlWVJhbmdlWzBdICYmIGkgPD1yZW1vdmVZUmFuZ2VbMV0gKSB7XHJcblx0XHRcdFx0JHJvdy5maW5kKENFTExfQ0xTKS5yZW1vdmVDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKHlEaXIgPD0gMCAmJiBpID49IHJlbW92ZVlSYW5nZVswXSAmJiBpIDxyZW1vdmVZUmFuZ2VbMV0gKSB7XHJcblx0XHRcdFx0JHJvdy5maW5kKENFTExfQ0xTKS5yZW1vdmVDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdH1cclxuXHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdC8qXHJcblx0ICogbG9jayArIHZpc2lhYmxlID0gY29sdW1uc1xyXG5cdCAqIEBwYXJhbSB7QXJyYXl9IGNvbHVtbnMgLVtkYXRhSW5kZXguLi5dXHJcblx0ICovXHJcblx0Z2V0TG9ja0FuZFZpc2lhYmxlQ29sdW1uQXNEYXRhSW5kZXgoKSB7XHJcblx0XHRsZXQgY29scyA9IFtdO1xyXG5cclxuXHRcdHRoaXMubG9ja0NvbE1hbmFnZXJcclxuXHRcdFx0LnZpc2libGVMb2NrQ29sdW1uXHJcblx0XHRcdC5lYWNoKGNvbE0gPT4gY29scy51bnNoaWZ0KGNvbE0uZGF0YUluZGV4KSk7XHJcblxyXG5cdFx0bGV0IHZpc2lhYmxlQ29scyA9IHRoaXMuY29sdW1uTW9kZWxcclxuXHRcdFx0LmdldFZpc2libGVDb2x1bW4oKVxyXG5cdFx0XHQubWFwKGNvbE0gPT4gY29sTS5kYXRhSW5kZXgpXHJcblx0XHRcdC5maWx0ZXIoZGF0YUluZGV4ID0+IGNvbHMuaW5kZXhPZihkYXRhSW5kZXgpID09IC0xKTtcclxuXHJcblx0XHRyZXR1cm4gY29scy5jb25jYXQodmlzaWFibGVDb2xzKTtcclxuXHR9XHJcblxyXG5cdGRlc3RvcnkoKSB7XHJcblx0XHRzdXBlci5kZXN0b3J5KCk7XHJcblxyXG5cdFx0dGhpcy5fZGVmYXVsdHMoKTtcclxuXHR9XHJcblxyXG59XHJcblxyXG5cclxuZnVuY3Rpb24gc3dhcChhLCBiKSB7XHJcblx0cmV0dXJuIFtiLCBhXTtcclxufVxyXG5cclxuZnVuY3Rpb24gb3JkZXJCeSh4MCwgeTAsIHgxLCB5MSwgZGF0YUluZGV4KSB7XHJcblx0aWYgKGRhdGFJbmRleC5pbmRleE9mKHgwKSA+IGRhdGFJbmRleC5pbmRleE9mKHgxKSkge1xyXG5cdFx0W3gwLCB4MV0gPSBzd2FwKHgwLCB4MSk7XHJcblx0fVxyXG5cdGlmICh5MCA+IHkxKSB7XHJcblx0XHRbeTAsIHkxXSA9IHN3YXAoeTAsIHkxKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiBbeDAsIHkwLCB4MSwgeTFdO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFNlbGVjdGlvbjsiLCIvLyBleHBvcnRzLkdyaWRTdG9yZSA9IHJlcXVpcmUoJy4vY29yZS9HcmlkU3RvcmUnKTtcclxuLy8gZXhwb3J0cy5HcmlkVmlldyA9IHJlcXVpcmUoJy4vY29yZS9HcmlkVmlldycpO1xyXG4vLyBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vZXh0ZW5kcy9TZWxlY3Rpb24nKTtcclxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2V4dGVuZHMvQ29udGV4dG1lbnUnKTtcclxuXHJcbi8vIGV4cG9ydCB7IGRlZmF1bHQgfSBmb3JtICcuL3BsdWdpbi9Db250ZXh0bWVudSc7XHJcbiIsInZhciAkID0gcmVxdWlyZSgnLi4vdXRpbC9zaGltJykuJDtcclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZUl0ZW0oaXRlbSwgdm0pIHtcclxuXHRsZXQgJGl0ZW0gPSAkKCc8bGkgY2xhc3M9XCJjLW1lbnUtaXRlbVwiPjwvbGk+Jyk7XHJcbiAgICBsZXQgJGJ1dHRvbiA9ICQoJzxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiYy1tZW51LWJ0blwiPjwvYnV0dG9uPicpXHJcbiAgICBcdC5vbignY2xpY2snLCBpdGVtLmNhbGxiYWNrLmJpbmQodm0pKTtcclxuXHJcbiAgICBpZiAoaXRlbS5pY29uQ2xzKSB7XHJcbiAgICBcdCRidXR0b24uYXBwZW5kKCc8aSBjbGFzcz1cImZhIGZhLXNoYXJlXCI+PC9pPicpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAkYnV0dG9uLmFwcGVuZChgPHNwYW4gY2xhc3M9XCJjLW1lbnUtdGV4dFwiPiR7aXRlbS50ZXh0fTwvc3Bhbj5gKTtcclxuXHJcbiAgICByZXR1cm4gJGl0ZW0uYXBwZW5kKCRidXR0b24pO1xyXG59O1xyXG5cclxuZnVuY3Rpb24gY29tcGlsZU1lbnUobWVudXMsIHZtKSB7XHJcblx0aWYgKG1lbnVzICYmIG1lbnVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7XHJcblx0XHJcblx0bGV0ICRtZW51cyA9ICQoJzxtZW51IGNsYXNzPVwiYy1tZW51XCI+PC9tZW51PicpO1xyXG5cdGxldCAkbWVudVNlcGFyYXRvciA9ICQoJzxsaSBjbGFzcz1cImMtbWVudS1zZXBhcmF0b3JcIj48L2xpPicpO1xyXG5cdFxyXG5cdG1lbnVzLmZvckVhY2gobWVudSA9PiB7XHJcblx0XHRsZXQgJG1lbnUgPSBjcmVhdGVJdGVtKG1lbnUsIHZtKTtcclxuXHRcdGxldCBjaGlsZHJlbjtcclxuXHJcblx0XHRpZiAobWVudS5jaGlsZHJlbikge1xyXG5cdFx0XHRjaGlsZHJlbiA9IGNvbXBpbGVNZW51KG1lbnUuY2hpbGRyZW4sIHZtKTtcclxuXHJcblx0XHRcdGlmIChjaGlsZHJlbikge1xyXG5cdFx0XHRcdCRtZW51LmFkZENsYXNzKCdzdWJtZW51JykuYXBwZW5kKGNoaWxkcmVuKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHQkbWVudXMuYXBwZW5kKCRtZW51KTtcclxuXHR9KTtcclxuXHJcblx0cmV0dXJuICRtZW51cztcclxufVxyXG5cclxuLyoqXHJcbiAqIEBwYXJhbXMge09iamVjdFtdfSBtZW51TGlzdCAtLSBbe3RleHQ6ICdtZW51TmFtZScsIGNhbGxiYWNrKGV2dCkge30gfSwgLi4uXSBcclxuICovXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oeyBjb250YWluZXIsIHRhcmdldENsYXNzLCB0cmlnZ2VyLCBtZW51TGlzdCB9KSB7XHJcblx0aWYgKCFBcnJheS5pc0FycmF5KG1lbnVMaXN0KSkge1xyXG5cdFx0bWVudUxpc3QgPSBbbWVudUxpc3RdO1xyXG5cdH1cclxuXHJcblx0dmFyICR2bSA9IHtcclxuXHRcdGRhdGE6IG51bGxcclxuXHR9O1xyXG5cclxuXHRsZXQgbWVudSA9IGNvbXBpbGVNZW51KG1lbnVMaXN0LCAkdm0pWzBdO1xyXG5cclxuXHQkKGNvbnRhaW5lcikuYXBwZW5kKG1lbnUpLm9uKCdjb250ZXh0bWVudScsIHRhcmdldENsYXNzLCBvbkNvbnRleHRNZW51KTtcclxuXHJcblx0ZnVuY3Rpb24gc2hvd01lbnUoeCwgeSl7XHJcblx0ICAgIG1lbnUuc3R5bGUubGVmdCA9IHggKyAncHgnO1xyXG5cdCAgICBtZW51LnN0eWxlLnRvcCA9IHkgKyAncHgnO1xyXG5cdCAgICBtZW51LmNsYXNzTGlzdC5hZGQoJ3Nob3ctbWVudScpO1xyXG5cdH1cclxuXHRmdW5jdGlvbiBoaWRlTWVudSgpe1xyXG5cdCAgICBtZW51LmNsYXNzTGlzdC5yZW1vdmUoJ3Nob3ctbWVudScpO1xyXG5cdH1cclxuXHRmdW5jdGlvbiBvbkNvbnRleHRNZW51KGUpe1xyXG5cdFx0Y29uc29sZS5sb2coZS50YXJnZXQuY2xhc3NOYW1lKTtcclxuXHRcdGlmICh0cmlnZ2VyLmNhbGwoJHZtLCBlKSkge1xyXG5cdFx0ICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdCAgICBzaG93TWVudShlLmNsaWVudFggLSA1LCBlLmNsaWVudFkgLSAzNSk7XHJcblx0XHQgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG9uTW91c2VEb3duLCB0cnVlKTtcclxuXHRcdH1cclxuXHR9XHJcblx0ZnVuY3Rpb24gb25Nb3VzZURvd24oZSl7XHJcblx0ICAgIGhpZGVNZW51KCk7XHJcblx0ICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBvbk1vdXNlRG93bik7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4ge1xyXG5cclxuXHR9XHJcblxyXG5cdC8vIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51Jywgb25Db250ZXh0TWVudSwgdHJ1ZSk7XHJcbn07IiwiJ3VzZSBzdHJpY3QnO1xyXG5jb25zdCAkID0gcmVxdWlyZSgnLi4vdXRpbC9zaGltJykuJDtcclxuXHJcbmNvbnN0IEZMRVhNSU5XSURUSCA9IDM1O1xyXG5cclxudmFyIGRyYWdEcm9wID0gZnVuY3Rpb24oZXZ0ICxvcHRzKSB7XHJcblx0dmFyIGRvYyA9ICQoZG9jdW1lbnQpO1xyXG5cdHZhciBzY3JvbGxMZWZ0ID0gZG9jdW1lbnQuYm9keS5zY3JvbGxMZWZ0IHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0O1xyXG5cdHZhciBzY3JvbGxUb3AgPSBkb2N1bWVudC5ib2R5LnNjcm9sbFRvcCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsVG9wO1xyXG5cdHZhciBsZWZ0T2Zmc2V0ID0gJChldnQudGFyZ2V0KS5vZmZzZXQoKS5sZWZ0IC0gc2Nyb2xsTGVmdDtcclxuXHR2YXIgaVgsIGlZLCBzdGFydFgsIGVuZFg7XHJcblx0dmFyIGRyYWdnaW5nID0gdHJ1ZTtcclxuXHJcblx0c3RhcnRYID0gaVggPSBldnQuY2xpZW50WCAtIHNjcm9sbExlZnQ7XHJcblx0aVkgPSAkKGV2dC50YXJnZXQpLm9mZnNldCgpLnRvcCAtIHNjcm9sbFRvcDtcclxuXHJcblx0b3B0cy5vbkRyYWdTdGFydCh7ICd4Jzogc3RhcnRYIH0sIG9wdHMuJGVsZW1lbnQpO1xyXG5cclxuXHRkb2Mub24oJ21vdXNlbW92ZS5kcmFnZHJvcCcsICQucHJveHkobW91c2Vtb3ZlLCB0aGlzKSk7XHJcblx0ZG9jLm9uKCdtb3VzZXVwLmRyYWdkcm9wJywgJC5wcm94eShtb3VzZXVwLCB0aGlzKSk7XHJcblx0Ly8gJChldnQudGFyZ2V0KVswXS5zZXRDYXB0dXJlICYmICQoZXZ0LnRhcmdldClbMF0uc2V0Q2FwdHVyZSgpO1xyXG5cclxuXHRmdW5jdGlvbiBtb3VzZW1vdmUoZSkge1xyXG5cdFx0aWYgKGRyYWdnaW5nKSB7XHJcblx0XHRcdGVuZFggPSBlLmNsaWVudFggLSBzY3JvbGxMZWZ0O1xyXG5cclxuXHRcdFx0Ly8gbGltaXRcclxuXHRcdFx0aWYgKGVuZFggLSBsZWZ0T2Zmc2V0IDwgRkxFWE1JTldJRFRIKSB7XHJcblx0XHRcdFx0ZW5kWCA9IGxlZnRPZmZzZXQgKyBGTEVYTUlOV0lEVEg7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdG9wdHMub25EcmFnZ2luZyggeyAneCc6IGVuZFggfSwgb3B0cy4kZWxlbWVudCk7XHJcblx0XHR9XHJcblxyXG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIG1vdXNldXAoZXZ0KSB7XHJcblx0XHR2YXIgZSA9IGV2dC50YXJnZXQ7XHJcblx0XHRkcmFnZ2luZyA9IGZhbHNlO1xyXG5cclxuXHRcdG9wdHMub25EcmFnRW5kKHsgJ3gnOiBldnQuY2xpZW50WCAtIHNjcm9sbExlZnQgfSwgb3B0cy4kZWxlbWVudCk7XHJcblxyXG5cdFx0aWYgKGUgJiYgZS5zZXRDYXB0dXJlKSB7XHJcblx0XHRcdGUucmVsZWFzZUNhcHR1cmUoKTtcclxuXHRcdH0gZWxzZSBpZiAod2luZG93LnJlbGVhc2VDYXB0dXJlKSB7XHJcblx0XHRcdHdpbmRvdy5yZWxlYXNlQ2FwdHVyZShFdmVudC5NT1VTRU1PVkUgfCBFdmVudC5NT1VTRVVQKTtcclxuXHRcdH1cclxuXHJcblx0XHRkb2Mub2ZmKCdtb3VzZW1vdmUuZHJhZ2Ryb3AnLCBtb3VzZW1vdmUpO1xyXG5cdFx0ZG9jLm9mZignbW91c2V1cC5kcmFnZHJvcCcsIG1vdXNldXApO1xyXG5cdH1cclxuXHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YXJnZXQsIG9wdGlvbnMpIHtcclxuXHR2YXIgZGVmYXVsdHMgPSB7XHJcblx0XHRyZXN0cmljdGVyKGV2dCkgeyByZXR1cm4gbnVsbDsgfSxcclxuXHRcdG9uRHJhZ1N0YXJ0KG9mZnNldCwgdGFyZ2V0KSB7fSxcclxuXHRcdG9uRHJhZ2dpbmcob2Zmc2V0LCB0YXJnZXQpIHt9LFxyXG5cdFx0b25EcmFnRW5kKG9mZnNldCwgdGFyZ2V0KSB7fVxyXG5cdH07XHJcblxyXG5cdE9iamVjdC5hc3NpZ24oZGVmYXVsdHMsIG9wdGlvbnMpO1xyXG5cclxuXHQkKHRhcmdldCkub24oJ21vdXNlZG93bicsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0dmFyIHJlc3RyaWN0ZXIgPSBkZWZhdWx0cy5yZXN0cmljdGVyKGV2dCk7XHJcblxyXG5cdFx0aWYgKHJlc3RyaWN0ZXIpIHtcclxuXHRcdFx0ZGVmYXVsdHMuJGVsZW1lbnQgPSBkZWZhdWx0cy5yZXN0cmljdGVyKGV2dCkgfHwgJChldnQudGFyZ2V0KTtcclxuXHRcdFx0ZHJhZ0Ryb3AoZXZ0LCBkZWZhdWx0cyk7XHJcblx0XHR9XHJcblx0fSk7XHJcbn07IiwiLyoqXHJcbiAqIOS6i+S7tueuoeeQhlxyXG4gKiBAY2xhc3MgRXZlbnRFbWl0dGVyXHJcbiAqL1xyXG5cclxuZnVuY3Rpb24gaW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVycywgbGlzdGVuZXIpIHtcclxuXHR2YXIgaSA9IGxpc3RlbmVycy5sZW5ndGg7XHJcblx0d2hpbGUgKGktLSkge1xyXG5cdFx0aWYgKGxpc3RlbmVyc1tpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHtcclxuXHRcdFx0cmV0dXJuIGk7XHJcblx0XHR9XHJcblx0fVxyXG5cdHJldHVybiAtMTtcclxufVxyXG5cclxuZnVuY3Rpb24gaXNWYWxpZExpc3RlbmVyKGxpc3RlbmVyKSB7XHJcblx0aWYgKHR5cGVvZiBsaXN0ZW5lciA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fSBlbHNlIGlmIChsaXN0ZW5lciAmJiB0eXBlb2YgbGlzdGVuZXIgPT09ICdvYmplY3QnKSB7XHJcblx0XHRyZXR1cm4gaXNWYWxpZExpc3RlbmVyKGxpc3RlbmVyLmxpc3RlbmVyKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxufVxyXG5cclxuY2xhc3MgRXZlbnRFbWl0dGVyIHtcclxuXHJcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xyXG5cclxuXHR9XHJcblx0LyoqXHJcblx0KlxyXG5cdCpcclxuXHQqXHJcblx0KlxyXG5cdCovXHJcblx0X2dldEV2ZW50cygpIHtcclxuXHRcdHJldHVybiB0aGlzLl9ldmVudHMgfHwgKHRoaXMuX2V2ZW50cyA9IHt9KTtcclxuXHR9XHJcblx0LyoqXHJcblx0KiDpgJrov4fkuovku7blkI3ojrflj5ZsaXN0ZW5lciDmlbDnu4TmiJbliJ3lp4vljJZcclxuXHQqIOS9v+eUqOato+WImeWMuemFjeS8mui/lOWbnuS4gOS4quWvueW6lOeahOWvueixoVxyXG5cdCpcclxuXHQqIFxyXG5cdCogZ2V0TGlzdGVuZXJzXHJcblx0KiBAcGFyYW0ge1N0cmluZyB9IFJlZ0V4cH0gZXZlbnROYW1lXHJcblx0KiBAcmV0dXJuIHtGdW5jdG9uW10gfCBPYmplY3R9XHJcblx0KlxyXG5cdCovXHJcblx0Z2V0TGlzdGVuZXJzKG5hbWUpIHtcclxuXHRcdHZhciBldmVudHMgPSB0aGlzLl9nZXRFdmVudHMoKTtcclxuXHRcdHZhciByZXNwb25zZTtcclxuXHRcdHZhciBrZXk7XHJcblxyXG5cdFx0aWYgKG5hbWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcclxuXHRcdFx0cmVzcG9uc2UgPSB7fTtcclxuXHRcdFx0Zm9yIChrZXkgaW4gZXZlbnRzKSB7XHJcblx0XHRcdFx0aWYgKGV2ZW50cy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIG5hbWUudGVzdChrZXkpKSB7XHJcblx0XHRcdFx0XHRyZXNwb25zZVtrZXldID0gZXZlbnRzW2tleV07XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyZXNwb25zZSA9IGV2ZW50c1tuYW1lXSB8fCAoZXZlbnRzW25hbWVdID0gW10pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiByZXNwb25zZTtcclxuXHR9XHJcblx0LyoqXHJcblx0KiDpgJrov4fkuovku7blkI3ojrflj5ZsaXN0ZW5lciDlp4vnu4jov5Tlm57kuIDkuKrlr7nosaFcclxuXHQqXHJcblx0KiBcclxuXHQqIGdldExpc3RlbmVyc0FzT2JqZWN0XHJcblx0KiBAcGFyYW0ge1N0cmluZ3xSZWdFeHB9IGV2ZW50TmFtZVxyXG5cdCogQHJldHVybiB7T2JqZWN0fVxyXG5cdCovXHJcblx0Z2V0TGlzdGVuZXJzQXNPYmplY3QobmFtZSkge1xyXG5cdFx0dmFyIGxpc3RlbmVycyA9IHRoaXMuZ2V0TGlzdGVuZXJzKG5hbWUpO1xyXG5cdFx0dmFyIHJlc3BvbnNlO1xyXG5cclxuXHRcdGlmIChsaXN0ZW5lcnMgaW5zdGFuY2VvZiBBcnJheSkge1xyXG5cdFx0XHRyZXNwb25zZSA9IHt9O1xyXG5cdFx0XHRyZXNwb25zZVtuYW1lXSA9IGxpc3RlbmVycztcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcmVzcG9uc2UgfHwgbGlzdGVuZXJzO1xyXG5cdH1cclxuXHQvKipcclxuXHQqIOiOt+WPliBsaXN0ZW5lciDliJfooahcclxuXHQqXHJcblx0KiBmbGF0dGVuTGlzdGVuZXJzXHJcblx0KlxyXG5cdCogQHBhcmFtIHsgT2JqZWN0W119IGxpc3RlbmVyc1xyXG5cdCogQHJldHVybiB7RnVuY3Rpb25bXX1cclxuXHQqL1xyXG5cdGZsYXR0ZW5MaXN0ZW5lcnMobGlzdGVuZXJzKSB7XHJcblx0XHR2YXIgZmxhdExpc3RlbmVycyA9IFtdO1xyXG5cclxuXHRcdGZvciAodmFyIGkgPSAwLCBsID0gbGlzdGVuZXIubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcblx0XHRcdGZsYXRMaXN0ZW5lcnMucHVzaChsaXN0ZW5lcnNbaV0ubGlzdGVuZXIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmbGF0TGlzdGVuZXJzO1xyXG5cdH1cclxuXHQvKipcclxuXHQqIOS6i+S7tuazqOWGjFxyXG5cdCpcclxuXHQqXHJcblx0KiBAZXhhbXBlbFxyXG5cdCogdmFyIGVtdCA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcclxuXHQqIGVtdC5hZGRMaXN0ZW5lcignZGl2OmhvdmVyJywgZnVuY3Rpb24oKXtcclxuXHQqXHQvLyBkb1xyXG5cdCogfSk7XHJcblx0KiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lXHJcblx0KiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxyXG5cdCogQHJldHVybiB7T2JqZWN0an1cclxuXHQqXHJcblx0Ki9cclxuXHRhZGRMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lciwgZmxhZykge1xyXG5cdFx0aWYgKCFpc1ZhbGlkTGlzdGVuZXIobGlzdGVuZXIpKSB7XHJcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBsaXN0ZW5lcnMgPSB0aGlzLmdldExpc3RlbmVyc0FzT2JqZWN0KG5hbWUpO1xyXG5cdFx0dmFyIGxpc3RlbmVySXNXcmFwcGVkID0gdHlwZW9mIGxpc3RlbmVyID09PSAnb2JqZWN0JztcclxuXHRcdHZhciBrZXksIHN0YXJ0LCBhcmdzO1xyXG5cclxuXHRcdGZvciAoa2V5IGluIGxpc3RlbmVycykge1xyXG5cdFx0XHRpZiAobGlzdGVuZXJzLmhhc093blByb3BlcnR5KGtleSkgJiYgaW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVycywgbGlzdGVuZXIpID09PSAtMSkge1xyXG5cclxuXHRcdFx0XHRzdGFydCA9IGxpc3RlbmVyc1trZXldLmxlbmd0aDtcclxuXHJcblx0XHRcdFx0bGlzdGVuZXJzW2tleV0ucHVzaChsaXN0ZW5lcklzV3JhcHBlZCA/IGxpc3RlbmVyIDoge1xyXG5cdFx0XHRcdFx0bGlzdGVuZXI6IGxpc3RlbmVyLFxyXG5cdFx0XHRcdFx0b25jZTogZmFsc2VcclxuXHRcdFx0XHR9KTtcclxuXHJcblx0XHRcdFx0aWYgKGZsYWcgJiYgbGlzdGVuZXJzW2tleV0uYXJncykge1xyXG5cdFx0XHRcdFx0bGlzdGVuZXJzW2tleV0uc3RhcnQgPSBzdGFydDtcclxuXHRcdFx0XHRcdGFyZ3MgPSBsaXN0ZW5lcnNba2V5XS5hcmdzO1xyXG5cdFx0XHRcdFx0dGhpcy5lbWl0RXZlbnQobmFtZSwgYXJncyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRvbigpIHtcclxuXHRcdHJldHVybiB0aGlzLmFkZExpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cclxuXHRvbmUobmFtZSwgbGlzdGVuZXIsIGZsYWcpIHtcclxuXHRcdHJldHVybiB0aGlzLnJlbW92ZUV2ZW50KG5hbWUpLmFkZExpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiDkuovku7bms6jlhozvvIzop6blj5HlkI7oh6rliqjnp7vpmaRcclxuXHQgKlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZVxyXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyXHJcblx0ICogQHJldXRuciB7T2JqZWN0fVxyXG5cdCAqXHJcblx0ICovXHJcblx0YWRkT25jZUxpc3RlbmVyKG5hbWUsIGxpc3RlbmVyKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5hZGRMaXN0ZW5lcihuYW1lLCB7XHJcblx0XHRcdGxpc3RlbmVyOiBsaXN0ZW5lcixcclxuXHRcdFx0b25jZTogdHJ1ZVxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRvbmNlKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuYWRkT25jZUxpc3RlbmVyLmFwcGx5KHRoaXMuYXJndW1lbnRzKTtcclxuXHR9XHJcblx0LyoqXHJcblx0ICog5LqL5Lu26ZSA5q+BXHJcblx0ICpcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWVcclxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxyXG5cdCAqIEByZXR1cm4ge09iamVjdH1cclxuXHQgKlxyXG5cdCAqL1xyXG5cdHJlbW92ZUxpc3RlbmVyKG5hbWUsIGxpc3RlbmVyKSB7XHJcblx0XHR2YXIgbGlzdGVuZXJzID0gdGhpcy5nZXRMaXN0ZW5lcnNBc09iamVjdChuYW1lKTtcclxuXHRcdHZhciBpbmRleDtcclxuXHRcdHZhciBrZXk7XHJcblxyXG5cdFx0Zm9yIChrZXkgaW4gbGlzdGVuZXJzKSB7XHJcblx0XHRcdGlmIChsaXN0ZW5lcnMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xyXG5cdFx0XHRcdGluZGV4ID0gaW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVyc1trZXldLCBsaXN0ZW5lcik7XHJcblxyXG5cdFx0XHRcdGlmIChpbmRleCAhPT0gLTEpIHtcclxuXHRcdFx0XHRcdGxpc3RlbmVyc1trZXldLnNwbGljZShpbmRleCwgaSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRvZmYoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yZW1vdmVMaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHJcblx0bWFuaXB1bGF0ZUxpc3RlbmVycyhyZW1vdmUsIG5hbWUsIGxpc3RlbmVycykge1xyXG5cdFx0dmFyIHNpbmdsZSA9IHJlbW92ZSA/IHRoaXMucmVtb3ZlTGlzdGVuZXIgOiB0aGlzLmFkZExpc3RlbmVyO1xyXG5cdFx0dmFyIG11dGlwbGUgPSByZW1vdmUgPyB0aGlzLnJlbW92ZUxpc3RlbmVycyA6IHRoaXMuYWRkTGlzdGVuZXJzO1xyXG5cdFx0dmFyIGk7XHJcblx0XHR2YXIgdjtcclxuXHJcblx0XHRpZiAodHlwZW9mIG5hbWUgPT09ICdvYmplY3QnICYmICEobmFtZSBpbnN0YW5jZW9mIFJlZ0V4cCkpIHtcclxuXHRcdFx0Zm9yIChpIGluIG5hbWUpIHtcclxuXHRcdFx0XHRpZiAobmFtZS5oYXNPd25Qcm9wZXJ0eShpKSAmJiAodiA9IG5hbWVbaV0pKSB7XHJcblx0XHRcdFx0XHRpZiAodHlwZW9mIHYgPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0XHRcdFx0c2luZ2xlLmNhbGwodGhpcywgaSwgdik7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRtdXRpcGxlLmNhbGwodGhpcywgaSwgdik7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRpID0gMDtcclxuXHRcdFx0diA9IGxpc3RlbmVycy5sZW5ndGg7XHJcblx0XHRcdHdoaWxlIChpIDwgdikge1xyXG5cdFx0XHRcdHNpbmdsZS5jYWxsKHRoaXMsIG5hbWUsIGxpc3RlbmVyc1tpKytdKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0YWRkTGlzdGVuZXJzKG5hbWUsIGxpc3RlbmVycykge1xyXG5cdFx0cmV0dXJuIHRoaXMubWFuaXB1bGF0ZUxpc3RlbmVycyhmYWxzZSwgbmFtZSwgbGlzdGVuZXJzKTtcclxuXHR9XHJcblxyXG5cdHJlbW92ZUxpc3RlbmVycyhuYW1lLCBsaXN0ZW5lcnMpIHtcclxuXHRcdHJldHVybiB0aGlzLm1hbmlwdWxhdGVMaXN0ZW5lcnModHJ1ZSwgbmFtZSwgbGlzdGVuZXJzKTtcclxuXHR9XHJcblxyXG5cdHJlbW92ZUV2ZW50KG5hbWUpIHtcclxuXHRcdHZhciBldmVudHMgPSB0aGlzLl9nZXRFdmVudHMoKTtcclxuXHRcdHZhciBrZXk7XHJcblxyXG5cdFx0aWYgKHR5cGVvZiBuYW1lID09PSAnc3RyaW5nJykge1xyXG5cdFx0XHQvLyDnp7vpmaTmiYDmnInmjIflrprkuovku7blkI3nmoTmiYDmnIlsaXN0ZW5lcnNcclxuXHRcdFx0Ly8gZGVsZXRlIGV2ZW50c1tuYW1lXVxyXG5cdFx0XHRpZiAoZXZlbnRzW25hbWVdIGluc3RhbmNlb2YgQXJyYXkpIHtcclxuXHRcdFx0XHRldmVudHNbbmFtZV0ubGVuZ3RoID0gMDtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIGlmIChuYW1lIGluc3RhbmNlb2YgUmVnRXhwKSB7XHJcblx0XHRcdC8vIOato+WImeWMuemFjeeahOaJgOaciSBsaXN0ZW5lcnNcclxuXHRcdFx0Zm9yIChrZXkgaW4gZXZlbnRzKSB7XHJcblx0XHRcdFx0aWYgKGV2ZW50cy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIG5hbWUudGVzdChrZXkpKSB7XHJcblx0XHRcdFx0XHQvLyBkZWxldGUgZXZlbnRzW2tleV1cclxuXHRcdFx0XHRcdGlmIChldmVudHNba2V5XSBpbnN0YW5jZW9mIEFycmF5KSB7XHJcblx0XHRcdFx0XHRcdGV2ZW50W2tleV0ubGVuZ3RoID0gMDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdC8vIOenu+mZpOaJgOaciSBsaXN0ZW5lcnNcclxuXHRcdFx0ZGVsZXRlIHRoaXMuX2V2ZW50cztcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdHJlbW92ZUFsbExpc3RlbmVycygpIHtcclxuXHRcdHJldHVybiB0aGlzLnJlbW92ZUV2ZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cdC8qKlxyXG5cdCAqIOS6i+S7tuinpuWPkVxyXG5cdCAqXHJcblx0ICpcclxuXHQgKiBAZXhhbXBsZVxyXG5cdCAqIHZhciBlbXQgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XHJcblx0ICogc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuXHQgKiBcdGVtdC5lbWl0RXZlbnQoJ2Rpdjpob3ZlcicsIDEpO1xyXG5cdCAqIH0sIDEwMDApO1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSDkuovku7blkI3np7BcclxuXHQgKiBAcGFyYW0ge0FycmF5fSBbYXJnc10gSFRNTERvY3VtZW50LCBpdGVtRGF0YSwgLi4uXHJcblx0ICogQHJldHVybiB7T2JqZWN0fVxyXG5cdCAqXHJcblx0ICovXHJcblx0ZW1pdEV2ZW50KG5hbWUsIGFyZ3MpIHtcclxuXHRcdHZhciBsaXN0ZW5lcnNNYXAgPSB0aGlzLmdldExpc3RlbmVyc0FzT2JqZWN0KG5hbWUpO1xyXG5cdFx0dmFyIGxpc3RlbmVycztcclxuXHRcdHZhciBsaXN0ZW5lcjtcclxuXHRcdHZhciBpO1xyXG5cdFx0dmFyIGw7XHJcblx0XHR2YXIga2V5O1xyXG5cdFx0dmFyIHJlc3BvbnNlO1xyXG5cclxuXHRcdGZvciAoa2V5IGluIGxpc3RlbmVyc01hcCkge1xyXG5cdFx0XHRpZiAobGlzdGVuZXJzTWFwLmhhc093blByb3BlcnR5KGtleSkpIHtcclxuXHRcdFx0XHRsaXN0ZW5lcnMgPSBsaXN0ZW5lcnNNYXBba2V5XS5zbGljZSgwKTtcclxuXHJcblx0XHRcdFx0bGlzdGVuZXJzTWFwW2tleV0uYXJncyA9IGFyZ3M7XHJcblxyXG5cdFx0XHRcdGkgPSBsaXN0ZW5lcnNNYXBba2V5XS5zdGFydCB8fCAwO1xyXG5cdFx0XHRcdGxpc3RlbmVyc01hcFtrZXldLnN0YXJ0ID0gMDtcclxuXHJcblx0XHRcdFx0Zm9yIChsID0gbGlzdGVuZXJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG5cdFx0XHRcdFx0bGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XHJcblxyXG5cdFx0XHRcdFx0aWYgKGxpc3RlbmVyLm9uY2UgPT09IHRydWUpIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5yZW1vdmVMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lci5saXN0ZW5lcik7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0cmVzcG9uc2UgPSBsaXN0ZW5lci5saXN0ZW5lci5hcHBseSh0aGlzLCBhcmdzIHx8IFtdKTtcclxuXHJcblx0XHRcdFx0XHRpZiAocmVzcG9uc2UgPT09IHRoaXMuX2dldE9uY2VSZXR1cm5WYWx1ZSgpKSB7XHJcblx0XHRcdFx0XHRcdHRoaXMucmVtb3ZlTGlzdGVuZXIobmFtZSwgbGlzdGVuZXIubGlzdGVuZXIpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHR0cmlnZ2VyKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuZW1pdEV2ZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cclxuXHRmaXJlKG5hbWUpIHtcclxuXHRcdHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcclxuXHRcdHJldHVybiB0aGlzLmVtaXRFdmVudChuYW1lLCBhcmdzKTtcclxuXHR9XHJcblxyXG5cdF9nZXRPbmNlUmV0dXJuVmFsdWUoKSB7XHJcblx0XHRpZiAodGhpcy5oYXNPd25Qcm9wZXJ0eSgnX29uY2VSZXR1cm5WYWx1ZScpKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLl9vbmNlUmV0dXJuVmFsdWU7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdHNldE9uY2VSZXR1cm5WYWx1ZSh2YWx1ZSkge1xyXG5cdFx0dGhpcy5fb25jZVJldHVyblZhbHVlID0gdmFsdWU7XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdGRlZmluZUV2ZW50KG5hbWUpIHtcclxuXHRcdHRoaXMuZ2V0TGlzdGVuZXJzKG5hbWUpO1xyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRkZWZpbmVFdmVudHMobmFtZXMpIHtcclxuXHRcdGZvciAodmFyIGkgPSAwLCBsID0gbmFtZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcblx0XHRcdHRoaXMuZGVmaW5lRXZlbnQobmFtZVtpXSk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcclxuXHJcblxyXG4iLCJmdW5jdGlvbiBzd2FwKGFyciwgczEsIHMyKSB7XHJcblx0dmFyIHRlbXAgPSBhcnJbczFdO1xyXG5cdGFycltzMV0gPSBhcnJbczJdO1xyXG5cdGFycltzMl0gPSB0ZW1wO1xyXG59XHJcblxyXG5mdW5jdGlvbiByYW5kb21WYWx1ZShhcnIpIHtcclxuXHR2YXIgciA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGFyci5sZW5ndGgpO1xyXG5cdC8vIHN3YXAoYXJyLCAwLCByKTtcclxuXHRyZXR1cm4gW2FycltyXSwgYXJyLmZpbHRlcigoZCwgaSkgPT4gaSAhPT0gcildO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmaWx0ZXJMQW5kUihhcnIsIHNlbGVjdCwgY29tcGFyZUZuKSB7XHJcblx0dmFyIGxlZnRBcnIgPSBbXTtcclxuXHR2YXIgcmlnaHRBcnIgPSBbXTtcclxuXHJcblx0Zm9yICh2YXIgaSA9IDAsIGxlbiA9IGFyci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG5cdFx0bGV0IHRlbXAgPSBhcnJbaV07XHJcblx0XHRsZXQgY29tcGFyZWQgPSBjb21wYXJlRm4oc2VsZWN0LCB0ZW1wKTtcclxuXHRcdGlmIChjb21wYXJlZCA+IDApIHJpZ2h0QXJyLnB1c2godGVtcCk7XHJcblx0XHRlbHNlIGlmIChjb21wYXJlZCA8IDApIGxlZnRBcnIucHVzaCh0ZW1wKTtcclxuXHRcdGVsc2UgTWF0aC5yYW5kb20oKSA+IDAuNSA/IHJpZ2h0QXJyLnB1c2godGVtcCkgOiBsZWZ0QXJyLnB1c2godGVtcCk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gW2xlZnRBcnIsIHJpZ2h0QXJyXTtcclxufVxyXG5cclxuZnVuY3Rpb24gZmluZEluZGV4KGFyciwgaW5kZXgsIGNvbXBhcmVGbikge1xyXG5cdGlmIChhcnIubGVuZ3RoIDw9IDEgfHwgaW5kZXggPT09IDApIHJldHVybiBhcnJbMF07XHJcblx0dmFyIFtzZWxlY3QsIHNlY19hcnJdID0gcmFuZG9tVmFsdWUoYXJyKTtcclxuXHR2YXIgW2xlZnRBcnIsIHJpZ2h0QXJyXSA9IGZpbHRlckxBbmRSKHNlY19hcnIsIHNlbGVjdCwgY29tcGFyZUZuKTtcclxuXHR2YXIgbiA9IHJpZ2h0QXJyLmxlbmd0aDtcclxuXHJcblx0aWYgKG4gPT09IGluZGV4IC0gMSkgcmV0dXJuIHNlbGVjdDtcclxuXHRpZiAobiA+PSBpbmRleCkgcmV0dXJuIGZpbmRJbmRleChyaWdodEFyciwgaW5kZXgsIGNvbXBhcmVGbik7XHJcblx0ZWxzZSByZXR1cm4gZmluZEluZGV4KGxlZnRBcnIsIGluZGV4IC0gbiAtIDEsIGNvbXBhcmVGbik7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZmluZEluZGV4OyIsInZhciBVdGlscyA9IHt9O1xyXG5cclxudmFyIHVpZCA9IFV0aWxzLnVpZCA9ICgoKSA9PiB7XHJcblx0bGV0IHQgPSBEYXRlLm5vdygpO1xyXG5cdHJldHVybiAoKSA9PiB7XHJcblx0XHRyZXR1cm4gKHQrKykudG9TdHJpbmcoMTYpO1xyXG5cdH07XHJcbn0pKCk7XHJcblxyXG5cclxudmFyIG1lcmdlID0gVXRpbHMubWVyZ2UgPSAodGFyZ2V0LCBhZGRpdGlvbmFsLCBkZWVwKSA9PiB7XHJcblx0bGV0IGRlcHRoID0gdHlwZW9mIGRlZXAgPT0gJ3VuZGVmaW5lZCcgPyAyIDogZGVlcCwgcHJvcDtcclxuXHJcblx0Zm9yIChwcm9wIGluIGFkZGl0aW9uYWwpIHtcclxuXHRcdGlmIChhZGRpdGlvbmFsLmhhc093blByb3BlcnR5KHByb3ApKSB7XHJcblx0XHRcdGlmICh0eXBlb2YgdGFyZ2V0W3Byb3BdICE9PSAnb2JqZWN0JyB8fCAhZGVwdGgpIHtcclxuXHRcdFx0XHR0YXJnZXRbcHJvcF0gPSBhZGRpdGlvbmFsW3Byb3BdO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFV0aWxzLm1lcmdlKHRhcmdldFtwcm9wXSwgYWRkaXRpb25hbFtwcm9wXSwgZGVwdGggLSAxKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHRhcmdldDtcclxufTtcclxuXHJcbnZhciBmaW5kSW5kZXggPSBVdGlscy5maW5kSW5kZXggPSByZXF1aXJlKCcuL0ZpbmRJbmRleCcpO1xyXG52YXIgY29tcGFyZUZuID0gVXRpbHMuY29tcGFyZUZuID0gcmVxdWlyZSgnLi91dGlscy9Db21wYXJlcicpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBVdGlsczsiLCJ2YXIgY29udGV4dCA9IHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnID8gdGhpcyA6IHdpbmRvdztcclxuZXhwb3J0cy4kID0gY29udGV4dC4kO1xyXG5leHBvcnRzLl8gPSBjb250ZXh0Ll87IiwiLyoqXHJcbiAqIOWIm+W7uuavlOi+g+WHveaVsFxyXG4gKiBAc3VtbWFyeSDnuqbmnZ/mnaHku7bvvIzlj6rpkojlr7nlr7nosaHmlbDnu4Tnu5PmnoTnmoTmlbDmja7vvIzlpoJcclxuICogICAgICBbe1wiY29sXzFcIjogMTAsIFwiY29sXzJcIjogMzUsIFwiY29sXzNcIjogNjZ9LCAuLi5dXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqICB2YXIgc29ydHMgPSBbJ0EnLCdCJywnQycsJ0QnXTtcclxuICogIHZhciBkaXJzID0gWzEsIC0xLCAxLCAxXTtcclxuICpcclxuICogIHZhciBkYXRhMyA9IFtcclxuICogICAgICB7QToxLEI6MSxDOjUsX2lkOjF9LFxyXG4gKiAgICAgIHtBOjEsQjozLEM6NSxfaWQ6MX0sXHJcbiAqICAgICAge0E6MixCOjUsQzo0LF9pZDoyfSxcclxuICogICAgICB7QToxLEI6MSxDOjksX2lkOjF9LFxyXG4gKiAgICAgIHtBOjMsQjozLEM6MyxfaWQ6M30sXHJcbiAqICAgICAge0E6MSxCOjEsQzozLF9pZDoxfSxcclxuICogICAgICB7QTo0LEI6MixDOjIsX2lkOjR9LFxyXG4gKiAgICAgIHtBOjUsQjo0LEM6MSxfaWQ6NX0sXHJcbiAqICBdO1xyXG4gKlxyXG4gKiAgdmFyIGZuID0gY29tcGFyZUZuKHNvcnRzLCBkaXJzKTtcclxuICogIHZhciByZXQgPSBkYXRhMy5zb3J0KGZuKS5tYXAoZCA9PiBPYmplY3QudmFsdWVzKGQpKTtcclxuICogIGNvbnNvbGUuZGlyKHJldCk7XHJcbiAqXHJcbiAqIEBwYXJhbSB7QXJyYXl9IHNvcnRzIC3mjpLluo/lrZfmrrXmlbDnu4QgWydjb2xfMScsICdjb2xfMicsICdjb2xfMycsLi4uXVxyXG4gKiBAcGFyYW0ge0FycmF5fSBkaXJzIC3lr7nlupTlrZfkvZPmjpLluo/mlbDnu4TnmoTljYfpmY3luo8sMe+8muWNh+W6jyAtMe+8mumZjeW6jyBbMSwgLTFdXHJcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0g5q+U6L6D5Ye95pWwXHJcbiAqL1xyXG5leHBvcnRzLmNvbXBhcmVGbiA9IGZ1bmN0aW9uIGNvbXBhcmVGbihzb3J0cywgZGlycykge1xyXG4gICAgdmFyIGNvbmRpdGlvbnMgPSBzb3J0cy5yZWR1Y2UoKHByZSwgbmV4dCwgaSkgPT4ge1xyXG4gICAgICAgIHByZSAgPSBwcmUgPyBwcmUgKyAnIHx8JyA6ICcnO1xyXG4gICAgICAgIHJldHVybiBgJHtwcmV9IChhLiR7bmV4dH0gLSBiLiR7bmV4dH0pICogJHtkaXJzW2ldfWA7XHJcbiAgICB9LCAnJyk7XHJcblxyXG4gICAgdmFyIGZ1bmN0aW9uX2JvZHkgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICBsZXQgc29ydEluZm8gPSBzb3J0cy5qb2luKCcsJykucmVwbGFjZSgvKFxcdyspL2csICdcIiQxXCInKTtcclxuICAgICAgICByZXR1cm4gYHZhciBzb3J0ID0gWyR7c29ydEluZm99XTsgcmV0dXJuICR7Y29uZGl0aW9uc31gO1xyXG4gICAgfVxyXG4gICAgLy8gY29uc29sZS5sb2coZnVuY3Rpb25fYm9keSgpKTtcclxuICAgIFxyXG4gICAgcmV0dXJuIG5ldyBGdW5jdGlvbignYScsICdiJywgZnVuY3Rpb25fYm9keSgpKTtcclxufVxyXG5cclxuXHJcbiJdfQ==
