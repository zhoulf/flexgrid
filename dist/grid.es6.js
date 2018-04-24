(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.sz || (g.sz = {})).grid = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var EventEmitter = require('../util/EventEmitter');
var $ = require('../util/shim').$;

var defineDell = function(colM) {
	let cell = $('<li/>')
		.addClass('c-grid-cell')
		.addClass('c-align-' + colM.align)
		.attr('tabindex', -1)
		.data('dataIndex', colM.dataIndex)
		.width(colM.width);

	if (colM.locked) {
		cell.addClass('c-column-locked');
	}

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
		this.removeEvent();

		this.limit = limit;
		this.total = total;
		this.cacheTimes = cacheTimes || 3;
		this.nodeList = [];
		this.colsModel = colsModel;

		// 这里暂为Selection实现，应该用AOP维护 TODO
		this.on('row-update-before', (rowNode, row) => this.fire('row-update', rowNode, row));
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

},{"../util/EventEmitter":12,"../util/shim":15}],2:[function(require,module,exports){
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
},{"../util/EventEmitter":12,"../util/Utils":14,"../util/shim":15}],4:[function(require,module,exports){
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
},{"../util/EventEmitter":12,"../util/Utils":14,"../util/shim":15}],5:[function(require,module,exports){
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
			}, 60);

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
},{"../util/EventEmitter":12,"../util/Utils":14,"./BufferNode":1,"./BufferZone":2,"./ColModel":3,"./GridStore":4,"./Header":6,"./LockColManager":7,"./Scroller":8}],6:[function(require,module,exports){
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
},{"../util/DD":11,"../util/shim":15}],7:[function(require,module,exports){
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
// exports.GridStore = require('./core/GridStore');
// exports.GridView = require('./core/GridView');
module.exports = require('./plugin/Selection');
},{"./plugin/Selection":10}],10:[function(require,module,exports){
var GridView = require('../core/GridView');

const CELL_CLS = 'li.c-grid-cell';
const CELL_SELECTED_CLS = 'c-cell-selected';
const ROW_CLS = '.c-grid-row';

class Selection extends GridView {

	constructor(options) {
		super(options);

		this._moving = false;
		this._start = null;
		this._end = null;
		this._lastY = null;
		this._selection = [];
		this._selectY = [];
		this._selectDataIndex = [];
	}

	_bindEvent($dom) {
		super._bindEvent();

		let self = this;

		this.$dom.canvas
			.on('mousedown', CELL_CLS, function(evt) {
				if (evt.button === 0) {
					self.$dom.canvas.find(CELL_CLS).removeClass(CELL_SELECTED_CLS);
					self._moving = true;
					let $cell = $(this).addClass(CELL_SELECTED_CLS);
					self._start = [$cell.data('dataIndex'), +$cell.parent(ROW_CLS).attr('rid')];
					// console.log(start);
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

		this.bufferNode.on('row-update', (rowNode, row) => {
			console.log(rowNode.$node, row.rid);
			
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
		console.log(yDir, removeYRange);

		let dataIndex = this.getLockAndVisiableColumnAsDataIndex();
		[x0, y0, x1, y1] = orderBy(x0, y0, x1, y1, dataIndex);


		let cols = this._selectDataIndex = dataIndex.slice(dataIndex.indexOf(x0), dataIndex.indexOf(x1)+1);
		console.log(cols);

		this._selectY = [y0, y1 + 1];
		let rows = this.store.slice(y0, y1 + 1);

		this._selection = rows.map(row => {
			return cols.map(col => row.data[col]);
		});

		// TODO
		// 格式化,状态写入到store
		// console.log(this._selection);

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
},{"../util/shim":15}],12:[function(require,module,exports){
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



},{}],13:[function(require,module,exports){
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
},{}],14:[function(require,module,exports){
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
},{"./FindIndex":13,"./utils/Comparer":16}],15:[function(require,module,exports){
var context = typeof window === 'undefined' ? this : window;
exports.$ = context.$;
exports._ = context._;
},{}],16:[function(require,module,exports){
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



},{}]},{},[9])(9)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY29yZS9CdWZmZXJOb2RlLmpzIiwic3JjL2NvcmUvQnVmZmVyWm9uZS5qcyIsInNyYy9jb3JlL0NvbE1vZGVsLmpzIiwic3JjL2NvcmUvR3JpZFN0b3JlLmpzIiwic3JjL2NvcmUvR3JpZFZpZXcuanMiLCJzcmMvY29yZS9IZWFkZXIuanMiLCJzcmMvY29yZS9Mb2NrQ29sTWFuYWdlci5qcyIsInNyYy9jb3JlL1Njcm9sbGVyLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL3BsdWdpbi9TZWxlY3Rpb24uanMiLCJzcmMvdXRpbC9ERC5qcyIsInNyYy91dGlsL0V2ZW50RW1pdHRlci5qcyIsInNyYy91dGlsL0ZpbmRJbmRleC5qcyIsInNyYy91dGlsL1V0aWxzLmpzIiwic3JjL3V0aWwvc2hpbS5qcyIsInNyYy91dGlsL3V0aWxzL0NvbXBhcmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUdBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6V0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCcuLi91dGlsL0V2ZW50RW1pdHRlcicpO1xyXG52YXIgJCA9IHJlcXVpcmUoJy4uL3V0aWwvc2hpbScpLiQ7XHJcblxyXG52YXIgZGVmaW5lRGVsbCA9IGZ1bmN0aW9uKGNvbE0pIHtcclxuXHRsZXQgY2VsbCA9ICQoJzxsaS8+JylcclxuXHRcdC5hZGRDbGFzcygnYy1ncmlkLWNlbGwnKVxyXG5cdFx0LmFkZENsYXNzKCdjLWFsaWduLScgKyBjb2xNLmFsaWduKVxyXG5cdFx0LmF0dHIoJ3RhYmluZGV4JywgLTEpXHJcblx0XHQuZGF0YSgnZGF0YUluZGV4JywgY29sTS5kYXRhSW5kZXgpXHJcblx0XHQud2lkdGgoY29sTS53aWR0aCk7XHJcblxyXG5cdGlmIChjb2xNLmxvY2tlZCkge1xyXG5cdFx0Y2VsbC5hZGRDbGFzcygnYy1jb2x1bW4tbG9ja2VkJyk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gY2VsbDtcclxufTtcclxuXHJcbnZhciBjcmVhdGVDZWxsID0gZnVuY3Rpb24oJHJvdywgY29sc01vZGVsKSB7XHJcblx0dmFyIHNpemUgPSBjb2xzTW9kZWwuc2l6ZSgpO1xyXG5cdHZhciBjaGlsZHJlbiA9IG5ldyBNYXAoKTtcclxuXHJcblx0Y29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblx0XHRsZXQgY2VsbCA9IGRlZmluZURlbGwoY29sTSk7XHJcblxyXG5cdFx0JHJvdy5hcHBlbmQoY2VsbCk7XHJcblx0XHRjaGlsZHJlbi5zZXQoY29sTSwgY2VsbCk7XHJcblx0fSk7XHJcblxyXG5cdHJldHVybiBjaGlsZHJlbjtcclxufTtcclxuXHJcbmNsYXNzIFJvd05vZGUgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cdGNvbnN0cnVjdG9yKGNvbHNNb2RlbCwgY29udGV4dCkge1xyXG5cdFx0c3VwZXIoKTtcclxuXHRcdHRoaXMuJHZtID0gY29udGV4dDtcclxuXHRcdHRoaXMuY29sc01vZGVsID0gY29sc01vZGVsO1xyXG5cdFx0dGhpcy4kbm9kZSA9ICQoJzx1bC8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC1yb3cnKTtcclxuXHJcblx0XHR0aGlzLmNoaWxkcmVuID0gY3JlYXRlQ2VsbCh0aGlzLiRub2RlLCBjb2xzTW9kZWwpO1xyXG5cdFx0dGhpcy5fYmluZEV2ZW50KGNvbHNNb2RlbCk7XHJcblx0fVxyXG5cclxuXHRfYmluZEV2ZW50KGNvbHNNb2RlbCkge1xyXG5cdFx0dGhpcy5jb2xzTW9kZWwub24oJ2NvbHVtbi1hZGQnLCBjb2xNID0+IHtcclxuXHRcdFx0bGV0IGNlbGwgPSBkZWZpbmVEZWxsKGNvbE0pO1xyXG5cclxuXHRcdFx0dGhpcy4kbm9kZS5hcHBlbmQoY2VsbCk7XHJcblx0XHRcdHRoaXMuY2hpbGRyZW4uc2V0KGNvbE0sIGNlbGwpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Y29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1yZXNpemVkJywgd2lkdGggPT4ge1xyXG5cdFx0XHRcdGNvbnNvbGUubG9nKHdpZHRoKTtcclxuXHRcdFx0XHR0aGlzLmNoaWxkcmVuLmdldChjb2xNKS5vdXRlcldpZHRoKHdpZHRoKTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4taGlkZGVuJywgaXNIaWRkZW4gPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNoaWxkcmVuLmdldChjb2xNKTtcclxuXHRcdFx0XHRpZiAoaXNIaWRkZW4pIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcygnYy1jb2x1bW4taGlkZScpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoJ2MtY29sdW1uLWhpZGUnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWxvY2tlZCcsIGlzTG9ja2VkID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jaGlsZHJlbi5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdGlmIChpc0xvY2tlZCkge1xyXG5cdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKCdjLWNvbHVtbi1sb2NrZWQnKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKCdjLWNvbHVtbi1sb2NrZWQnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignZGVzdG9yeScsICgpID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jaGlsZHJlbi5nZXQoY29sTSk7XHJcblx0XHRcdFx0dGhpcy5jaGlsZHJlbi5kZWxldGUoY29sTSk7XHRcdFx0XHJcblx0XHRcdFx0Y29sRWxlLnJlbW92ZSgpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0c2V0RGF0YShyb3csIG9mZnNldFRvcCkge1xyXG5cdFx0Ly8g6L+Z6YeM5aaC5p6c55SoQU9Q5pa55byP5a6e546w5pu05aW9VE9ET1xyXG5cdFx0dGhpcy4kdm0uZmlyZSgncm93LXVwZGF0ZS1iZWZvcmUnLCB0aGlzLCByb3cpO1xyXG5cclxuXHRcdHZhciBjb250ZW50O1xyXG5cdFx0dmFyIGNlbGxzID0gdGhpcy5jaGlsZHJlbjtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cclxuXHRcdFx0Y29udGVudCA9IGNvbE0ucmVuZGVyZXIocm93LmRhdGFbY29sTS5kYXRhSW5kZXhdKTtcclxuXHRcdFx0Ly8gVE9ETyBhZGRDbGFzcygoKT0+IHJvdy5jZWxsW2NvbE0uZGF0YUluZGV4XS5zZWxlY3RlZClcclxuXHRcdFx0Y2VsbHMuZ2V0KGNvbE0pLmh0bWwoY29udGVudCk7XHJcblxyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kbm9kZS5jc3MoJ3RvcCcsIG9mZnNldFRvcCkuYXR0cigncmlkJywgcm93LnJpZCk7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuJG5vZGU7XHJcblx0fVxyXG59XHJcblxyXG5jbGFzcyBCdWZmZXJOb2RlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHRjb25zdHJ1Y3RvcihsaW1pdCwgY29sc01vZGVsLCB0b3RhbCwgY2FjaGVUaW1lcykge1xyXG5cdFx0c3VwZXIoKTtcclxuXHRcdHRoaXMuaW5pdChsaW1pdCwgY29sc01vZGVsLCB0b3RhbCwgY2FjaGVUaW1lcyk7XHJcblx0fVxyXG5cclxuXHRpbml0KGxpbWl0LCBjb2xzTW9kZWwsIHRvdGFsLCBjYWNoZVRpbWVzKSB7XHJcblx0XHR0aGlzLnJlbW92ZUV2ZW50KCk7XHJcblxyXG5cdFx0dGhpcy5saW1pdCA9IGxpbWl0O1xyXG5cdFx0dGhpcy50b3RhbCA9IHRvdGFsO1xyXG5cdFx0dGhpcy5jYWNoZVRpbWVzID0gY2FjaGVUaW1lcyB8fCAzO1xyXG5cdFx0dGhpcy5ub2RlTGlzdCA9IFtdO1xyXG5cdFx0dGhpcy5jb2xzTW9kZWwgPSBjb2xzTW9kZWw7XHJcblxyXG5cdFx0Ly8g6L+Z6YeM5pqC5Li6U2VsZWN0aW9u5a6e546w77yM5bqU6K+l55SoQU9Q57u05oqkIFRPRE9cclxuXHRcdHRoaXMub24oJ3Jvdy11cGRhdGUtYmVmb3JlJywgKHJvd05vZGUsIHJvdykgPT4gdGhpcy5maXJlKCdyb3ctdXBkYXRlJywgcm93Tm9kZSwgcm93KSk7XHJcblx0fVxyXG5cclxuXHRnZXROb2RlTGlzdCgpIHtcclxuXHRcdHJldHVybiB0aGlzLm5vZGVMaXN0O1xyXG5cdH1cclxuXHJcblx0c2V0TGltaXQobGltaXQpIHtcclxuXHRcdGlmICgrbGltaXQgPiAwKSB7XHJcblx0XHRcdHRoaXMuaW5pdChsaW1pdCwgdGhpcy5jb2xzTW9kZWwsIHRoaXMudG90YWwsIHRoaXMuY2FjaGVUaW1lcyk7XHJcblx0XHRcdHRoaXMuZmlyZSgnYnVmZmVyLWluaXRpYWwnKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHNldFRvdGFsKHRvdGFsKSB7XHJcblx0XHRpZiAoK3RvdGFsID49IDApIHtcclxuXHRcdFx0dGhpcy50b3RhbCA9IHRvdGFsO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0aXNFbm91Z2goKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5ub2RlTGlzdC5sZW5ndGggPj0gTWF0aC5taW4odGhpcy50b3RhbCwgdGhpcy5jYWNoZVRpbWVzICogdGhpcy5saW1pdCk7XHJcblx0fVxyXG5cclxuXHRnZXQoZGlyLCBkb21haW4pIHtcclxuXHRcdGlmICh0aGlzLmlzRW5vdWdoKCkpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuX2dldE5vZGVzKGRpciwgZG9tYWluKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcy5fYWRkTm9kZXMoZGlyLCBkb21haW4pO1xyXG5cdH1cclxuXHJcblx0X2dldE5vZGVzKGRpciwgW3N0YXJ0LCBlbmRdKSB7XHJcblx0XHR2YXIgc2VsZWN0ZWQ7XHJcblxyXG5cdFx0aWYgKGRpciA+IDApIHtcclxuXHRcdFx0c2VsZWN0ZWQgPSB0aGlzLm5vZGVMaXN0LnNsaWNlKDAsIGVuZCAtIHN0YXJ0ICsgMSk7XHJcblx0XHRcdHRoaXMubm9kZUxpc3QgPSB0aGlzLm5vZGVMaXN0LnNsaWNlKGVuZCAtIHN0YXJ0ICsgMSkuY29uY2F0KHNlbGVjdGVkKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHNlbGVjdGVkID0gdGhpcy5ub2RlTGlzdC5zbGljZShzdGFydCAtIGVuZCAtIDEpO1xyXG5cdFx0XHR0aGlzLm5vZGVMaXN0ID0gc2VsZWN0ZWQuY29uY2F0KHRoaXMubm9kZUxpc3Quc2xpY2UoMCwgc3RhcnQgLSBlbmQgLSAxKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHNlbGVjdGVkIHx8IFtdO1xyXG5cdH1cclxuXHJcblx0X2FkZE5vZGVzKGRpciwgW3N0YXJ0LCBlbmRdKSB7XHJcblx0XHR2YXIgbm9kZXMgPSBbXTtcclxuXHJcblx0XHRmb3IgKHZhciBpID0gc3RhcnQ7IGkgPD0gZW5kOyBpKyspIHtcclxuXHRcdFx0bm9kZXMucHVzaChuZXcgUm93Tm9kZSh0aGlzLmNvbHNNb2RlbCwgdGhpcykpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMubm9kZUxpc3QgPSBkaXIgPiAwID8gdGhpcy5ub2RlTGlzdC5jb25jYXQobm9kZXMpIDogbm9kZXMuY29uY2F0KHRoaXMubm9kZUxpc3QpO1xyXG5cclxuXHRcdHJldHVybiBub2RlcztcclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQnVmZmVyTm9kZTtcclxuIiwiY2xhc3MgQnVmZmVyWm9uZSB7XHJcblx0Y29uc3RydWN0b3IobGltaXQsIHRvdGFsLCBjYWNoZVRpbWVzKSB7XHJcblx0XHR0aGlzLmluaXQobGltaXQsIHRvdGFsLCBjYWNoZVRpbWVzKTtcclxuXHR9XHJcblxyXG5cdGluaXQobGltaXQsIHRvdGFsLCBjYWNoZVRpbWVzKSB7XHJcblx0XHR0aGlzLnN0YXJ0ID0gMDtcclxuXHRcdHRoaXMuZW5kID0gdGhpcy5saW1pdCA9IGxpbWl0O1xyXG5cdFx0dGhpcy50b3RhbCA9ICt0b3RhbDtcclxuXHRcdHRoaXMuY2FjaGVUaW1lcyA9IGNhY2hlVGltZXMgfHwgMztcclxuXHRcdHRoaXMuZG9tYWluID0gW3RoaXMuc3RhcnQsIHRoaXMuZW5kXTtcclxuXHR9XHJcblxyXG5cdHNldExpbWl0KGxpbWl0KSB7XHJcblx0XHRpZiAoK2xpbWl0ID4gMCkge1xyXG5cdFx0XHR0aGlzLmluaXQobGltaXQsIHRoaXMudG90YWwpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0c2V0VG90YWwodG90YWwpIHtcclxuXHRcdGlmICgrdG90YWwgPj0gMCkge1xyXG5cdFx0XHR0aGlzLnRvdGFsID0gdG90YWw7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRpc0Ftb25nKHZhbHVlKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5zdGFydCA8PSB2YWx1ZSAmJiB2YWx1ZSA8PSB0aGlzLmVuZDtcclxuXHR9XHJcblxyXG5cdHNob3VsZExvYWQoZGlyLCB2ZXJuaWVyKSB7XHJcblx0XHRpZiAoZGlyID09PSAwKSByZXR1cm4gZmFsc2U7XHJcblxyXG5cdFx0dmFyIHN0YXJ0ID0gdGhpcy5zdGFydDtcclxuXHRcdHZhciBlbmQgPSB0aGlzLmVuZDtcclxuXHRcdHZhciBjYWNoZVRpbWVzID0gdGhpcy5jYWNoZVRpbWVzO1xyXG5cclxuXHRcdC8vIHNjcm9sbCB1cFxyXG5cdFx0aWYgKGRpciA8IDAgJiYgc3RhcnQgPT09IDApIHJldHVybiBmYWxzZTtcclxuXHRcdGlmIChkaXIgPCAwICYmIHZlcm5pZXIgPCBzdGFydCArIHRoaXMubGltaXQpIHtcclxuXHRcdFx0aWYgKHRoaXMuaXNBbW9uZyh2ZXJuaWVyKSkge1xyXG5cdFx0XHRcdGVuZCA9IHN0YXJ0IC0gMTtcclxuXHRcdFx0XHRzdGFydCA9IE1hdGgubWF4KDAsIGVuZCAtIHRoaXMubGltaXQpO1xyXG5cdFx0XHR9IGVsc2UgaWYgKHZlcm5pZXIgPT09IDApIHtcclxuXHRcdFx0XHRlbmQgPSBNYXRoLm1pbih0aGlzLnRvdGFsLCB2ZXJuaWVyICsgY2FjaGVUaW1lcyAqIHRoaXMubGltaXQpO1xyXG5cdFx0XHRcdHN0YXJ0ID0gMDtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRlbmQgPSB2ZXJuaWVyICsgdGhpcy5saW1pdDtcclxuXHRcdFx0XHRzdGFydCA9IE1hdGgubWF4KDAsIHZlcm5pZXIgLSAoY2FjaGVUaW1lcyAtIDEpICogdGhpcy5saW1pdCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuZG9tYWluID0gW3N0YXJ0LCBlbmRdO1xyXG5cdFx0XHR0aGlzLnN0YXJ0ID0gc3RhcnQ7XHJcblx0XHRcdHRoaXMuZW5kID0gTWF0aC5taW4oc3RhcnQgKyBjYWNoZVRpbWVzICogdGhpcy5saW1pdCwgdGhpcy5lbmQpO1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBzY3JvbGwgZG93blxyXG5cdFx0aWYgKGRpciA+IDAgJiYgZW5kID09PSB0aGlzLnRvdGFsKSByZXR1cm4gZmFsc2U7XHJcblx0XHRpZiAoZGlyID4gMCAmJiB2ZXJuaWVyID4gZW5kIC0gdGhpcy5saW1pdCkge1xyXG5cdFx0XHQvLyDmuLjmoIflnKjnjrDmnInojIPlm7TlhoVcclxuXHRcdFx0aWYgKHRoaXMuaXNBbW9uZyh2ZXJuaWVyKSkge1xyXG5cdFx0XHRcdHN0YXJ0ID0gZW5kICsgMTtcclxuXHRcdFx0XHRlbmQgPSBNYXRoLm1pbih0aGlzLnRvdGFsLCBzdGFydCArIHRoaXMubGltaXQpO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIOa4uOagh+WIsOi+vue7k+WwvlxyXG5cdFx0XHRlbHNlIGlmICh2ZXJuaWVyID09PSB0aGlzLnRvdGFsKSB7XHJcblx0XHRcdFx0ZW5kID0gdGhpcy50b3RhbDtcclxuXHRcdFx0XHRzdGFydCA9IE1hdGgubWF4KDAsIHZlcm5pZXIgLSBjYWNoZVRpbWVzICogdGhpcy5saW1pdCk7XHJcblx0XHRcdH1cclxuXHRcdFx0Ly8g5LiN5Zyo546w5pyJ6IyD5Zu05Y+I5pyq5Yiw57uT5bC+5aSEXHJcblx0XHRcdGVsc2Uge1xyXG5cdFx0XHRcdGVuZCA9IE1hdGgubWluKHRoaXMudG90YWwsIHZlcm5pZXIgKyAoY2FjaGVUaW1lcyAtIDEpICogdGhpcy5saW1pdCk7XHJcblx0XHRcdFx0c3RhcnQgPSBNYXRoLm1heCgwLCBlbmQgLSBjYWNoZVRpbWVzICogdGhpcy5saW1pdCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuZG9tYWluID0gW3N0YXJ0LCBlbmRdO1xyXG5cdFx0XHR0aGlzLmVuZCA9IGVuZDtcclxuXHRcdFx0dGhpcy5zdGFydCA9IE1hdGgubWF4KHRoaXMuc3RhcnQsIGVuZCAtIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQnVmZmVyWm9uZTsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi4vdXRpbC9FdmVudEVtaXR0ZXInKTtcclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbC9VdGlscycpO1xyXG52YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwvc2hpbScpLl87XHJcblxyXG52YXIgZGVmUmVuZGVyZXIgPSB2ID0+IHY7XHJcbnZhciBPUkRFUiA9IFsnQVNDJywgJ0RFU0MnXTtcclxuXHJcbmNsYXNzIENvbHVtbiBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblx0Y29uc3RydWN0b3IoY2lkLCBvcHRpb25zLCBjb250ZXh0KSB7XHJcblx0XHRzdXBlcigpO1xyXG5cclxuXHRcdG9wdGlvbnMucmVuZGVyZXIgPSBvcHRpb25zLnJlbmRlcmVyIHx8IGRlZlJlbmRlcmVyO1xyXG5cclxuXHRcdHZhciBkZWZhdWx0cyA9IHtcclxuXHRcdFx0J3RleHQnOiAnJyxcclxuXHRcdFx0J3Z0eXBlJzogJ3N0cmluZycsXHJcblx0XHRcdCdkYXRhSW5kZXgnOiAnJyxcclxuXHRcdFx0J3dpZHRoJzogNTAsXHJcblx0XHRcdCdhbGlnbic6ICdsZWZ0JyxcclxuXHJcblx0XHRcdCdyZXNpemFibGUnOiB0cnVlLFxyXG5cdFx0XHQnY2xzJzogJycsXHJcblx0XHRcdCdmaXhlZCc6IGZhbHNlLFxyXG5cdFx0XHQnZHJhZ2dhYmxlJzogZmFsc2UsXHJcblx0XHRcdCdzb3J0YWJsZSc6IHRydWUsXHJcblx0XHRcdCdoaWRkZW4nOiBmYWxzZSxcclxuXHRcdFx0J2xvY2tlZCc6IGZhbHNlLFxyXG5cdFx0XHQnbG9ja2FibGUnOiB0cnVlLFxyXG5cdFx0XHQnbWVudURpc2FibGVkJzogdHJ1ZSxcclxuXHJcblx0XHRcdCdzb3J0U3RhdGUnOiBudWxsXHJcblx0XHR9O1xyXG5cclxuXHRcdHRoaXMuY2lkID0gY2lkO1xyXG5cdFx0dGhpcy5jb250ZXh0ID0gY29udGV4dDtcclxuXHRcdE9iamVjdC5hc3NpZ24odGhpcywgZGVmYXVsdHMsIG9wdGlvbnMpO1xyXG5cdH1cclxuXHJcblx0c2V0V2lkdGgobnVtKSB7XHJcblx0XHRpZiAoIXRoaXMucmVzaXphYmxlKSByZXR1cm47XHJcblx0XHRpZiAoaXNOYU4obnVtKSkgcmV0dXJuO1xyXG5cclxuXHRcdHRoaXMud2lkdGggPSArbnVtO1xyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4tcmVzaXplZCcsIHRoaXMud2lkdGgsIHRoaXMpO1xyXG5cdH1cclxuXHJcblx0c2hvdygpIHtcclxuXHRcdHRoaXMuaGlkZGVuID0gZmFsc2U7XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1oaWRkZW4nLCB0aGlzLmhpZGRlbiwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHRoaWRlKCkge1xyXG5cdFx0dGhpcy51bkxvY2soKTtcclxuXHRcdFxyXG5cdFx0dGhpcy5oaWRkZW4gPSB0cnVlO1xyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4taGlkZGVuJywgdGhpcy5oaWRkZW4sIHRoaXMpO1xyXG5cdH1cclxuXHJcblx0dG9nZ2xlKCkge1xyXG5cdFx0aWYgKHRoaXMuaGlkZGVuKSB7XHJcblx0XHRcdHRoaXMuc2hvdygpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhpcy5oaWRlKCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRsb2NrKCkge1xyXG5cdFx0aWYgKCF0aGlzLmxvY2thYmxlKSByZXR1cm47XHJcblx0XHRpZiAodGhpcy5sb2NrZWQpIHJldHVybjtcclxuXHJcblx0XHR0aGlzLnNob3coKTtcclxuXHJcblx0XHR0aGlzLmxvY2tlZCA9IHRydWU7XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1sb2NrZWQnLCB0aGlzLmxvY2tlZCwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHR1bkxvY2soKSB7XHJcblx0XHRpZiAoIXRoaXMubG9ja2FibGUpIHJldHVybjtcclxuXHRcdGlmICghdGhpcy5sb2NrZWQpIHJldHVybjtcclxuXHJcblx0XHR0aGlzLmxvY2tlZCA9IGZhbHNlO1xyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4tbG9ja2VkJywgdGhpcy5sb2NrZWQsIHRoaXMpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogb3JkZXJbQVNDLCBERVNDLCBOT19TT1JUXVxyXG5cdCAqL1xyXG5cdHNvcnQob3JkZXIpIHtcclxuXHRcdGlmICghdGhpcy5zb3J0YWJsZSB8fCAhdGhpcy5kYXRhSW5kZXgpIHJldHVybjtcclxuXHJcblx0XHRpZiAob3JkZXIpIHtcclxuXHRcdFx0dGhpcy5zb3J0U3RhdGUgPSBPUkRFUi5pbmNsdWRlcyhvcmRlcikgPyBvcmRlciA6IG51bGw7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aGlzLnNvcnRTdGF0ZSA9IHRoaXMuc29ydFN0YXRlID09PSBPUkRFUlsxXSA/IE9SREVSWzBdIDogT1JERVJbMV07XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLXNvcnQtY2hhbmdlZCcsIHRoaXMuc29ydFN0YXRlKTtcclxuXHRcdHRoaXMuY29udGV4dC5maXJlKCdub3RpY2UtY29sTW9kZWwtc29ydC1jaGFuZ2VkJyk7XHJcbiBcdH1cclxuXHJcbiBcdHJlbW92ZSgpIHtcclxuIFx0XHR0aGlzLmZpcmUoJ2Rlc3RvcnknKTtcclxuIFx0XHR0aGlzLmNvbnRleHQuZmlyZSgnY29sdW1uLXJlbW92ZWQnLCB0aGlzKTtcclxuIFx0XHR0aGlzLnJlbW92ZUV2ZW50KCk7XHJcbiBcdH1cclxufVxyXG5cclxuXHJcbmNsYXNzIENvbE1vZGVsIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHRjb25zdHJ1Y3Rvcihjb2x1bW5zKSB7XHJcblx0XHRzdXBlcigpO1xyXG5cclxuXHRcdGlmICghQXJyYXkuaXNBcnJheShjb2x1bW5zKSkge1xyXG5cdFx0XHR0aHJvdyAncmVxdWlyZSBwcm9wZXJ0eSBjb2x1bW5zIGlzIGEgYXJyYXkgb2JqZWN0JztcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLmNvbHVtbnMgPSBbXTsgLy8gZGF0YSBieSBjb2x1bW5cclxuXHRcdHRoaXMuY29sTW9kZWwgPSBuZXcgTWFwKCk7IC8vIGRhdGEgYnkgY2lkXHJcblx0XHR0aGlzLmNvbEhlYWRlcnMgPSBuZXcgTWFwKCk7IC8vIGRhdGEgYnkgZGF0YUluZGV4XHJcblxyXG5cdFx0dGhpcy5faW5pdENvbHVtbihjb2x1bW5zKTtcclxuXHRcdHRoaXMuX2JpbmRFdmVudCgpO1xyXG5cdH1cclxuXHJcblx0X2luaXRDb2x1bW4oY29sdW1ucywgY2FsbGJhY2spIHtcclxuXHRcdGxldCBzaXplID0gdGhpcy5zaXplKCk7XHJcblxyXG5cdFx0Y29sdW1ucy5mb3JFYWNoKChjb2wsIGluZGV4KSA9PiB7XHJcblx0XHRcdGxldCBjaWQgPSBpbmRleCArIHNpemU7XHJcblx0XHRcdGxldCBjb2xNID0gbmV3IENvbHVtbihjaWQsIGNvbCwgdGhpcyk7XHJcblxyXG5cdFx0XHR0aGlzLmNvbE1vZGVsLnNldChjaWQsIGNvbE0pO1xyXG5cdFx0XHR0aGlzLmNvbHVtbnMucHVzaChjb2xNKTtcclxuXHRcdFx0dGhpcy5jb2xIZWFkZXJzLnNldChjb2wuZGF0YUluZGV4LCBjb2xNKTtcclxuXHJcblx0XHRcdGNhbGxiYWNrICYmIGNhbGxiYWNrKGNvbE0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRhZGRDb2x1bW5zKGNvbHVtbnMpIHtcclxuXHRcdGlmICghQXJyYXkuaXNBcnJheShjb2x1bW5zKSkge1xyXG5cdFx0XHRjb2x1bW5zID0gW2NvbHVtbnNdO1xyXG5cdFx0fVxyXG5cdFx0dGhpcy5faW5pdENvbHVtbihjb2x1bW5zLCBjb2xNID0+IHRoaXMuZmlyZSgnY29sdW1uLWFkZCcsIGNvbE0pKTtcclxuXHR9XHJcblxyXG5cdHJlbW92ZUNvbHVtbihkYXRhSW5kZXgpIHtcclxuXHRcdGlmICghQXJyYXkuaXNBcnJheShkYXRhSW5kZXgpKSB7XHJcblx0XHRcdGRhdGFJbmRleCA9IFtkYXRhSW5kZXhdO1xyXG5cdFx0fVxyXG5cclxuXHRcdGRhdGFJbmRleC5mb3JFYWNoKGRzID0+IHtcclxuXHRcdFx0bGV0IGNvbE0gPSB0aGlzLmdldENvbHVtbkJ5RGF0YUluZGV4KGRzKTtcclxuXHJcblx0XHRcdGlmIChjb2xNKSB7XHJcblx0XHRcdFx0Y29sTS5yZW1vdmUoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRfYmluZEV2ZW50KCkge1xyXG5cdFx0dGhpcy5vbignbm90aWNlLWNvbE1vZGVsLXNvcnQtY2hhbmdlZCcsIF8uZGVib3VuY2UoKCkgPT4ge1xyXG5cdFx0XHR0aGlzLmZpcmUoJ2NvbHVtbnMtc29ydC1jaGFuZ2VkJyk7XHJcblx0XHR9LCAyMCkpO1xyXG5cclxuXHRcdHRoaXMub24oJ2NvbHVtbi1yZW1vdmVkJywgY29sTSA9PiB7XHJcblx0XHRcdHRoaXMuY29sdW1ucyA9IHRoaXMuY29sdW1ucy5maWx0ZXIoY29sID0+IGNvbC5kYXRhSW5kZXggIT0gY29sTS5kYXRhSW5kZXgpO1xyXG5cdFx0XHR0aGlzLmNvbE1vZGVsLmRlbGV0ZShjb2xNLmNpZCk7XHJcblx0XHRcdHRoaXMuY29sSGVhZGVycy5kZWxldGUoY29sTS5kYXRhSW5kZXgpO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRzaXplKCkgeyBcclxuXHRcdHJldHVybiB0aGlzLmNvbE1vZGVsLnNpemU7IFxyXG5cdH1cclxuXHJcblx0Z2V0Q29sdW1uKGNvbCkge1xyXG5cdFx0aWYgKHRoaXMuY29sdW1ucy5pbmNsdWRlcyhjb2wpKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLmNvbHVtbnMuZmlsdGVyKF9jb2wgPT4gX2NvbCA9PSBjb2wpWzBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzLmNvbHVtbnM7XHJcblx0fVxyXG5cclxuXHRnZXRMb2NrQ29sdW1uKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuY29sdW1ucy5maWx0ZXIoY29sTSA9PiB7XHJcblx0XHRcdHJldHVybiBjb2xNLmxvY2tlZCA9PT0gdHJ1ZTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0Z2V0VmlzaWJsZUNvbHVtbigpIHtcclxuXHRcdHJldHVybiB0aGlzLmNvbHVtbnMuZmlsdGVyKGNvbE0gPT4ge1xyXG5cdFx0XHRyZXR1cm4gIWNvbE0uaGlkZGVuO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRnZXRDb2x1bW5CeURhdGFJbmRleChkYXRhSW5kZXgpIHtcclxuXHRcdHJldHVybiB0aGlzLmNvbEhlYWRlcnMuZ2V0KGRhdGFJbmRleCkgfHwgbnVsbDtcclxuXHR9XHJcblxyXG5cdGdldENvbHVtbnNCeUlkKGlkKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5jb2xNb2RlbFtpZF0gfHwgbnVsbDtcclxuXHR9XHJcblxyXG5cdGVhY2goY2FsbGJhY2ssIGNvbnRleHQpIHtcclxuXHRcdHRoaXMuY29sdW1ucy5mb3JFYWNoKGNhbGxiYWNrLCBjb250ZXh0IHx8IHRoaXMpO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHsgXHJcblxyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDb2xNb2RlbDsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi4vdXRpbC9FdmVudEVtaXR0ZXInKTtcclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbC9VdGlscycpO1xyXG52YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwvc2hpbScpLl87XHJcblxyXG5jbGFzcyBSb3cge1xyXG5cdGNvbnN0cnVjdG9yKHJpZCwgZGF0YSkge1xyXG5cdFx0dGhpcy5yaWQgPSByaWQ7XHJcblx0XHR0aGlzLmRhdGEgPSBkYXRhO1xyXG5cdFx0dGhpcy5zZWxlY3RlZCA9IGZhbHNlO1xyXG5cdH1cclxuXHRzdGF0ZSgpIHt9XHJcbn1cclxuXHJcbmNsYXNzIEdyaWRTdG9yZSBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblxyXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcclxuXHRcdHN1cGVyKCk7XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwgPSBvcHRpb25zLmNvbHVtbk1vZGVsO1xyXG5cclxuXHRcdHRoaXMucm93cyA9IFtdOyAvLyBkYXRhIGJ5IGluZGV4XHJcblx0XHR0aGlzLnJvd01vZGVsID0gbmV3IE1hcCgpOyAvLyBkYXRhIGJ5IGlkXHJcblxyXG5cclxuXHRcdHRoaXMuc2V0RGF0YShvcHRpb25zLmRhdGEpO1xyXG5cclxuXHRcdHRoaXMuX3NvcnRTdGF0ZSA9IHsga2V5czogW10sIGRpcnM6IFtdIH07XHJcblx0XHR0aGlzLl9iaW5kRXZlbnQoKTtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwuZWFjaChjb2xNID0+IHtcclxuXHRcdFx0Y29sTS5vbignY29sdW1uLXNvcnQtY2hhbmdlZCcsIHNvcnRTdGF0ZSA9PiB7XHJcblx0XHRcdFx0bGV0IHsga2V5cywgZGlycyB9ID0gdGhpcy5fc29ydFN0YXRlO1xyXG5cdFx0XHRcdGxldCBpbmRleCA9IGtleXMuaW5kZXhPZihjb2xNLmRhdGFJbmRleCk7XHJcblxyXG5cdFx0XHRcdC8vIOacquaOkuW6j1xyXG5cdFx0XHRcdGlmIChpbmRleCA9PT0gLTEgJiYgIXNvcnRTdGF0ZSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKGluZGV4ID09PSAtMSAmJiBzb3J0U3RhdGUpIHtcclxuXHRcdFx0XHRcdGtleXMudW5zaGlmdChjb2xNLmRhdGFJbmRleCk7XHJcblx0XHRcdFx0XHRkaXJzLnVuc2hpZnQoc29ydFN0YXRlLnRvTG93ZXJDYXNlKCkpO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8g5bey5o6S5bqPLOWFiOWIoOmZpFxyXG5cdFx0XHRcdGxldCBrZXkgPSBrZXlzLnNwbGljZShpbmRleCwgMSlbMF07XHJcblx0XHRcdFx0bGV0IGRpciA9IGRpcnMuc3BsaWNlKGluZGV4LCAxKVswXTtcclxuXHJcblx0XHRcdFx0aWYgKHNvcnRTdGF0ZSkge1xyXG5cdFx0XHRcdFx0a2V5cy51bnNoaWZ0KGtleSk7XHJcblx0XHRcdFx0XHRkaXJzLnVuc2hpZnQoc29ydFN0YXRlLnRvTG93ZXJDYXNlKCkpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Ly8g5omA5pyJ5YiX6YO95pu05paw54q25oCB5ZCOXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5vbignY29sdW1ucy1zb3J0LWNoYW5nZWQnLCAoKSA9PiB7XHJcblx0XHRcdGxldCB7IGtleXMsIGRpcnMgfSA9IHRoaXMuX3NvcnRTdGF0ZTtcclxuXHRcdFx0bGV0IGl0ZXJhdGVGbiA9IHJvdyA9PiByb3cuZGF0YVtrZXlzWzBdXTtcclxuXHJcblx0XHRcdGNvbnNvbGUubG9nKGtleXMsIGRpcnMpO1xyXG5cclxuXHRcdFx0dGhpcy5yb3dzID0gXy5vcmRlckJ5KHRoaXMucm93cywgaXRlcmF0ZUZuLCBkaXJzKTtcclxuXHRcdFx0dGhpcy5zZXREYXRhKF8ubWFwKHRoaXMucm93cywgJ2RhdGEnKSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdHNsaWNlKHN0YXJ0LCBlbmQpIHtcclxuXHRcdHJldHVybiB0aGlzLnJvd3Muc2xpY2Uoc3RhcnQsIGVuZCk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiDorr7nva7mjpLluo/nirbmgIFcclxuXHQgKiAoKylBU0MsIC1ERVNDLCAhTk9fU09SVFxyXG5cdCAqIEBzb3J0cyB7QXJyYXl9IHNvcnRzIC3mjpLluo/nirbmgIHmlbDnu4RcclxuXHQgKlx0c29ydHMgPSBbJytjb2xBJywgJ2NvbEInLCAnLWNvbEMnLCAnIWNvbEQnXVxyXG5cdCAqIEByZXR1cm5zIHRoaXM7XHJcblx0ICovXHJcblx0c2V0U29ydFN0YXRlKHNvcnRzKSB7XHJcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoc29ydHMpKSB7XHJcblx0XHRcdHNvcnRzID0gW3NvcnRzXTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9zb3J0U3RhdGUgPSB7IGtleXM6IFtdLCBkaXJzOiBbXSB9O1xyXG5cclxuXHRcdC8vIOWPjei9rOS8mOWFiOe6p+aWueS+v+WQjue7reinpuWPkemhuuW6j+aXtuWQjuinpuWPkeeahOS8mOWFiOe6p+mrmFxyXG5cdFx0c29ydHMucmV2ZXJzZSgpLmVhY2goc29ydE9iaiA9PiB7XHJcblx0XHRcdGxldCBvYmosIGtleSwgZGlyLCBjb2w7XHJcblxyXG5cdFx0XHRpZiAodHlwZW9mIHNvcnRPYmogPT09ICdzdHJpbmcnKSB7XHJcblx0XHRcdFx0b2JqID0gc29ydE9iai5tYXRjaCgvKF5bK3wtfCFdPykoLnswLH0pLyk7XHJcblx0XHRcdFx0ZGlyID0gb2JqWzFdID09PSAnJyA/ICdBU0MnIDogKG9iaiA9PT0gJy0nID8gJ0RFU0MnIDogJ05PX1NPUlQnKTtcclxuXHRcdFx0XHRrZXkgPSBvYmpbMl0gPyBvYmpbMl0gOiBudWxsO1xyXG5cclxuXHRcdFx0XHRjb2wgPSB0aGlzLmNvbHNNb2RlbC5nZXRDb2x1bW5CeURhdGFJbmRleChrZXkpO1xyXG5cdFx0XHRcdGlmIChjb2wpIHtcclxuXHRcdFx0XHRcdGNvbC5zb3J0KGRpcik7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdHNldERhdGEoZGF0YSA9IFtdLCBhcHBlbmQgPSBmYWxzZSkge1xyXG5cdFx0aWYgKCFhcHBlbmQpIHtcclxuXHRcdFx0dGhpcy5yb3dzLmxlbmd0aCA9IDA7XHJcblx0XHRcdHRoaXMucm93TW9kZWwuY2xlYXIoKTtcclxuXHRcdH1cclxuXHRcdHZhciBpbmRleCA9IHRoaXMuc2l6ZSgpO1xyXG5cdFx0ZGF0YS5mb3JFYWNoKChyb3csIHJpZHgpID0+IHtcclxuXHRcdFx0bGV0IHJvd00gPSBuZXcgUm93KHJpZHggKyBpbmRleCwgcm93KTtcclxuXHRcdFx0dGhpcy5yb3dzLnB1c2gocm93TSk7XHJcblx0XHRcdHRoaXMucm93TW9kZWwuc2V0KHJpZHggKyBpbmRleCwgcm93TSk7XHJcblx0XHR9KTtcclxuXHRcdHRoaXMuZmlyZSgnZGF0YS1jaGFuZ2VkJywgYXBwZW5kKTtcclxuXHR9XHJcblxyXG5cdGZvckVhY2goY2FsbGJhY2ssIGNvbnRleHQpIHtcclxuXHRcdHRoaXMucm93cy5mb3JFYWNoKGZ1bmN0aW9uKHJvd00sIHJpZHgpIHtcclxuXHRcdFx0Y2FsbGJhY2suY2FsbCh0aGlzLCByb3dNLmRhdGEsIHJpZHgpO1xyXG5cdFx0fSwgY29udGV4dCB8fCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdHNpemUoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yb3dNb2RlbC5zaXplO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHsgXHJcblxyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBHcmlkU3RvcmU7IiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJy4uL3V0aWwvRXZlbnRFbWl0dGVyJyk7XHJcbnZhciBDb2xNb2RlbCA9IHJlcXVpcmUoJy4vQ29sTW9kZWwnKTtcclxudmFyIEdyaWRTdG9yZSA9IHJlcXVpcmUoJy4vR3JpZFN0b3JlJyk7XHJcbnZhciBCdWZmZXJOb2RlID0gcmVxdWlyZSgnLi9CdWZmZXJOb2RlJyk7XHJcbnZhciBCdWZmZXJab25lID0gcmVxdWlyZSgnLi9CdWZmZXJab25lJyk7XHJcbnZhciBIZWFkZXIgPSByZXF1aXJlKCcuL0hlYWRlcicpO1xyXG52YXIgTG9ja0NvbE1hbmFnZXIgPSByZXF1aXJlKCcuL0xvY2tDb2xNYW5hZ2VyJyk7XHJcbnZhciBTY3JvbGxlciA9IHJlcXVpcmUoJy4vU2Nyb2xsZXInKTtcclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbC9VdGlscycpO1xyXG5cclxuZnVuY3Rpb24gY3JlYXRlTGF5b3V0KGNvbnRhaW5lciwgd2lkdGgpIHtcclxuXHR2YXIgd3JhcHBlciA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWdyaWQtd3JhcHBlcicpLndpZHRoKHdpZHRoKTtcclxuXHR2YXIgaGVhZGVyID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC1oZWFkZXInKTtcclxuXHR2YXIgYm9keSA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWdyaWQtYm9keScpO1xyXG5cdHZhciB2aWV3cG9ydCA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWdyaWQtdmlld3BvcnQnKS5hcHBlbmRUbyhib2R5KTtcclxuXHR2YXIgY2FudmFzID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC1jYW52YXMnKS5hcHBlbmRUbyh2aWV3cG9ydCk7XHJcblx0d3JhcHBlci5hcHBlbmQoaGVhZGVyKS5hcHBlbmQoYm9keSkuYXBwZW5kVG8oY29udGFpbmVyKTtcclxuXHJcblx0cmV0dXJuIHsgd3JhcHBlciwgaGVhZGVyLCBib2R5LCB2aWV3cG9ydCwgY2FudmFzIH07XHJcbn1cclxuZnVuY3Rpb24gY2FsY1Jvd0hlaWdodCgpIHtcclxuXHR2YXIgbGkgPSAkKCc8bGkgY2xhc3M9XCJjLWdyaWQtY2VsbFwiPnBsYWNlaG9sZGVyPC9saT4nKS5hcHBlbmRUbyhcImJvZHlcIik7XHJcblx0dmFyIHJvd0hlaWdodCA9IGxpLm91dGVySGVpZ2h0KCk7XHJcblx0bGkucmVtb3ZlKCk7XHJcblxyXG5cdHJldHVybiByb3dIZWlnaHQ7XHJcbn1cclxuXHJcbmNsYXNzIEdyaWRDb21wb25lbnQgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcclxuXHRcdHN1cGVyKCk7XHJcblxyXG5cdFx0aWYgKCEkKG9wdGlvbnMuZG9tRWwpLnNpemUoKSkgeyB0aHJvdyAncmVxdWlyZSBhIHZhbGlkIGRvbUVsJzsgfVxyXG5cclxuXHRcdHRoaXMuc2hvdWxkQWRkTm9kZXMgPSB0cnVlO1xyXG5cdFx0dGhpcy5oZWlnaHQgPSArb3B0aW9ucy5oZWlnaHQgfHwgNTAwO1xyXG5cdFx0dGhpcy53aWR0aCA9IG9wdGlvbnMud2lkdGg7XHJcblxyXG5cdFx0Ly8gJGxheW91dCBkb21cclxuXHRcdE9iamVjdC5hc3NpZ24odGhpcy4kZG9tID0ge30sIGNyZWF0ZUxheW91dCgkKG9wdGlvbnMuZG9tRWwpLCB0aGlzLndpZHRoKSk7XHJcblxyXG5cdFx0dGhpcy5jb2x1bW5Nb2RlbCA9IG5ldyBDb2xNb2RlbChvcHRpb25zLmNvbHVtbnMpO1xyXG5cdFx0dGhpcy5zdG9yZSA9IG5ldyBHcmlkU3RvcmUoeyBjb2x1bW5Nb2RlbDogdGhpcy5jb2x1bW5Nb2RlbCwgJ2RhdGEnOiBvcHRpb25zLmRhdGEgfHwgW10gfSk7XHJcblx0XHR0aGlzLl9pbml0KCk7XHJcblx0XHR0aGlzLl9iaW5kRXZlbnQoKTtcclxuXHR9XHJcblxyXG5cdF9pbml0KCkge1xyXG5cdFx0dGhpcy5oZWFkZXIgPSBuZXcgSGVhZGVyKHRoaXMuJGRvbS5oZWFkZXIsIHRoaXMuY29sdW1uTW9kZWwsIHRoaXMuc3RvcmUpO1xyXG5cdFx0dmFyIHRvdGFsID0gdGhpcy5zdG9yZS5zaXplKCk7XHJcblx0XHR2YXIgcm93SGVpZ2h0ID0gdGhpcy5yb3dIZWlnaHQgPSBjYWxjUm93SGVpZ2h0KCk7XHJcblx0XHR2YXIgdmlld3BvcnRIZWlnaHQgPSB0aGlzLmhlaWdodCAtIHRoaXMuJGRvbS5oZWFkZXIub3V0ZXJIZWlnaHQoKTtcclxuXHRcdHZhciBzaW5nbGVQYWdlU2l6ZSA9IE1hdGgubWluKE1hdGguY2VpbCh2aWV3cG9ydEhlaWdodC8gcm93SGVpZ2h0KSAtIDEsIHRvdGFsIC0gMSk7XHJcblxyXG5cdFx0dGhpcy5idWZmZXJab25lID0gbmV3IEJ1ZmZlclpvbmUoc2luZ2xlUGFnZVNpemUsIHRvdGFsKTtcclxuXHRcdHRoaXMuYnVmZmVyTm9kZSA9IG5ldyBCdWZmZXJOb2RlKHNpbmdsZVBhZ2VTaXplLCB0aGlzLmNvbHVtbk1vZGVsLCB0b3RhbCk7XHJcblx0XHR0aGlzLnNjcm9sbGVyID0gbmV3IFNjcm9sbGVyKHJvd0hlaWdodCwgdGhpcy5idWZmZXJab25lKTtcclxuXHRcdHRoaXMuc2Nyb2xsZXJcclxuXHRcdFx0Lm9uWCh4ID0+IHtcclxuXHRcdFx0XHR0aGlzLmZpcmUoJ3Njcm9sbExlZnQnLCB4KTtcclxuXHRcdFx0XHR0aGlzLiRkb20uaGVhZGVyLnNjcm9sbExlZnQoeCk7XHJcblx0XHRcdH0pXHJcblx0XHRcdC5vblkoKGRpciwgZG9tYWluLCBzdGFydCwgZW5kLCBpbmRleCwgdG90YWwpID0+IHtcclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyhg5rua5Yqo5pa55ZCR77yaJHtkaXJ9LCDliqDovb3ljLrpl7Q6IFske2RvbWFpbn1dLCDnjrDmnInojIPlm7TvvJooJHtzdGFydH0gLSAke2VuZH0pLCBgKVxyXG5cdFx0XHRcdHRoaXMuX2J1ZmZlclJlbmRlcihkaXIsIGRvbWFpbik7XHJcblx0XHRcdH0sIDYwKTtcclxuXHJcblx0XHR0aGlzLiRkb20udmlld3BvcnQuaGVpZ2h0KHZpZXdwb3J0SGVpZ2h0KTtcclxuXHRcdHRoaXMuJGRvbS52aWV3cG9ydC5vbignc2Nyb2xsJywgKGV2dCkgPT4ge1xyXG5cdFx0XHR0aGlzLnNjcm9sbGVyLmZpcmVZKGV2dC50YXJnZXQuc2Nyb2xsVG9wKTtcclxuXHRcdFx0dGhpcy5zY3JvbGxlci5maXJlWChldnQudGFyZ2V0LnNjcm9sbExlZnQpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5sb2NrQ29sTWFuYWdlciA9IExvY2tDb2xNYW5hZ2VyKHRoaXMuY29sdW1uTW9kZWwsIHRoaXMuaGVhZGVyLCB0aGlzLiRkb20sIHRoaXMuYnVmZmVyTm9kZSk7XHJcblx0XHR0aGlzLl9zZXRDYW52YXNXSCh0b3RhbCk7XHJcblx0fVxyXG5cclxuXHRfc2V0Q2FudmFzV0godG90YWwpIHtcclxuXHRcdHRoaXMuJGRvbS5jYW52YXNcclxuXHRcdFx0LndpZHRoKHRvdGFsID8gJ2F1dG8nIDogdGhpcy5fdW5Mb2NrVmlzaWJsZUNvbHNXaWR0aCgpKVxyXG5cdFx0XHQuaGVpZ2h0KHRoaXMucm93SGVpZ2h0ICogdG90YWwgfHwgMSk7XHJcblx0fVxyXG5cclxuXHRfdW5Mb2NrVmlzaWJsZUNvbHNXaWR0aCgpIHtcclxuXHRcdHJldHVybiB0aGlzLmhlYWRlci5nZXRWaXNpYmxlQ29sc1dpZHRoKCkgKyB0aGlzLmxvY2tDb2xNYW5hZ2VyLnZpc2libGVMb2NrQ29sdW1uLmdldFdpZHRoKCk7XHJcblx0fVxyXG5cclxuXHRzY3JvbGxUb1RvcChwb3NpdGlvbikge1xyXG5cdFx0dGhpcy4kZG9tLnZpZXdwb3J0LnNjcm9sbFRvcChwb3NpdGlvbik7XHJcblx0fVxyXG5cclxuXHRfYmluZEV2ZW50KCkge1xyXG5cdFx0dGhpcy5vbigndmlld3BvcnQtaGVpZ2h0LWNoYW5nZWQnLCB2aWV3cG9ydEhlaWdodCA9PiB7XHJcblx0XHRcdHRoaXMuX3VwZGF0ZUJ1ZmZlcigpO1xyXG5cdFx0XHR0aGlzLnJlbmRlcigpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5vbignc2Nyb2xsTGVmdCcsIHggPT4ge1xyXG5cdFx0XHQvLyBwZXJmb3JtYW5jZSBUT0RPXHJcblx0XHRcdC8vIGxldCBsb2NrQ29sdW1uV2lkdGggPSB0aGlzLmhlYWRlci5nZXRWaXNpYmxlTG9ja0NvbHNXaWR0aCgpO1xyXG5cdFx0XHQvLyB0aGlzLiRkb20uY2FudmFzLmZpbmQoJy5jLWNvbHVtbi1sb2NrZWQnKS5jc3MoJ2xlZnQnLCB4IC0gbG9ja0NvbHVtbldpZHRoKTtcclxuXHRcdFx0Ly8gdGhpcy4kZG9tLmhlYWRlci5maW5kKCcuYy1jb2x1bW4tbG9ja2VkJykuY3NzKCdsZWZ0JywgeCAtIGxvY2tDb2x1bW5XaWR0aCk7XHJcblx0XHRcdHRoaXMubG9ja0NvbE1hbmFnZXIuc2V0TG9ja0NvbHVtblgoeCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLnN0b3JlLm9uKCdkYXRhLWNoYW5nZWQnLCAoYXBwZW5kKSA9PiB7XHJcblx0XHRcdGxldCB0b3RhbCA9IHRoaXMuc3RvcmUuc2l6ZSgpO1xyXG5cdFx0XHR0aGlzLl9zZXRDYW52YXNXSCh0b3RhbCk7XHJcblx0XHRcdHRoaXMuYnVmZmVyTm9kZS5zZXRUb3RhbCh0b3RhbCk7XHJcblx0XHRcdHRoaXMuYnVmZmVyWm9uZS5zZXRUb3RhbCh0b3RhbCk7XHJcblxyXG5cdFx0XHRpZiAoIWFwcGVuZCB8fCAodG90YWwgLSAxKSAqIHRoaXMucm93SGVpZ2h0IDwgMip0aGlzLiRkb20udmlld3BvcnQub3V0ZXJIZWlnaHQoKSkge1xyXG5cdFx0XHRcdHRoaXMuX3VwZGF0ZUJ1ZmZlcigpO1xyXG5cdFx0XHRcdHRoaXMucmVuZGVyKCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHR9XHJcblxyXG5cdF91cGRhdGVCdWZmZXIoKSB7XHJcblx0XHR2YXIgbGltaXQgPSBNYXRoLm1pbihcclxuXHRcdFx0TWF0aC5jZWlsKHRoaXMuJGRvbS52aWV3cG9ydC5vdXRlckhlaWdodCgpIC8gdGhpcy5yb3dIZWlnaHQpIC0gMSxcclxuXHRcdFx0dGhpcy5zdG9yZS5zaXplKCkgLSAxKTtcclxuXHJcblx0XHR0aGlzLmJ1ZmZlclpvbmUuc2V0TGltaXQobGltaXQpO1xyXG5cdFx0dGhpcy5idWZmZXJOb2RlLnNldExpbWl0KGxpbWl0KTtcclxuXHRcdHRoaXMuc2hvdWxkQWRkTm9kZXMgPSB0cnVlO1xyXG5cdFx0dGhpcy5zY3JvbGxUb1RvcCgwKTtcclxuXHJcblx0XHR0aGlzLiRkb20uY2FudmFzLmVtcHR5KCk7XHJcblx0fVxyXG5cclxuXHRfYnVmZmVyUmVuZGVyKGRpciwgW3N0YXJ0LCBlbmRdKSB7XHJcblx0XHR2YXIgbm9kZXMgPSB0aGlzLmJ1ZmZlck5vZGUuZ2V0KGRpciwgW3N0YXJ0LCBlbmRdKTtcclxuXHRcdGNvbnNvbGUubG9nKCfkuIDmrKHojrflj5boioLngrnplb/luqYnLCBub2Rlcy5sZW5ndGgsIHN0YXJ0LCBlbmQpO1xyXG5cclxuXHRcdGlmICghdGhpcy5zaG91bGRBZGROb2Rlcykge1xyXG5cdFx0XHR0aGlzLnN0b3JlLnNsaWNlKHN0YXJ0LCBlbmQgKyAxKS5mb3JFYWNoKChyb3dNLCBpKSA9PiB7XHJcblx0XHRcdFx0bm9kZXNbaV0uc2V0RGF0YShyb3dNLCByb3dNLnJpZCAqIHRoaXMucm93SGVpZ2h0KTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHR2YXIgJGRvY0ZyYW1lID0gJCgnPGRpdi8+Jyk7XHJcblx0XHR0aGlzLnN0b3JlLnNsaWNlKHN0YXJ0LCBlbmQgKyAxKS5mb3JFYWNoKChyb3dNLCBpKSA9PiB7XHJcblxyXG5cdFx0XHRsZXQgbm9kZSA9IG5vZGVzW2ldLnNldERhdGEocm93TSwgcm93TS5yaWQgKiB0aGlzLnJvd0hlaWdodCk7XHJcblx0XHRcdCRkb2NGcmFtZS5hcHBlbmQobm9kZSk7XHJcblx0XHRcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuJGRvbS5jYW52YXMuYXBwZW5kKCRkb2NGcmFtZS5jaGlsZHJlbigpKTtcclxuXHRcdHRoaXMubG9ja0NvbE1hbmFnZXIuYWRkQnVmZmVyTG9ja05vZGUobm9kZXMpO1xyXG5cclxuXHRcdGlmICh0aGlzLmJ1ZmZlck5vZGUuaXNFbm91Z2goKSkge1xyXG5cdFx0XHR0aGlzLnNob3VsZEFkZE5vZGVzID0gZmFsc2U7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZW5kZXIoKSB7XHJcblx0XHR0aGlzLl9idWZmZXJSZW5kZXIoMSwgdGhpcy5idWZmZXJab25lLmRvbWFpbik7XHJcblx0fVxyXG5cclxuXHRzZXRXaWR0aChudW0pIHtcclxuXHRcdGlmIChpc05hTihudW0pKSByZXR1cm47XHJcblxyXG5cdFx0dGhpcy4kZG9tLndyYXBwZXIud2lkdGgobnVtKTtcclxuXHR9XHJcblxyXG5cdHNldEhlaWdodChudW0pIHtcclxuXHRcdGlmIChpc05hTihudW0pKSByZXR1cm47XHJcblxyXG5cdFx0dmFyIHZpZXdwb3J0SGVpZ2h0ID0gbnVtIC0gdGhpcy4kZG9tLmhlYWRlci5vdXRlckhlaWdodCgpO1xyXG5cdFx0dGhpcy4kZG9tLnZpZXdwb3J0Lm91dGVySGVpZ2h0KHZpZXdwb3J0SGVpZ2h0KTtcclxuXHRcdHRoaXMuZmlyZSgndmlld3BvcnQtaGVpZ2h0LWNoYW5nZWQnLCB2aWV3cG9ydEhlaWdodCk7XHJcblx0fVxyXG5cclxuXHRkZXN0b3J5KCkge1xyXG5cdFx0dGhpcy5jb2x1bW5Nb2RlbC5kZXN0b3J5KCk7XHJcblx0XHR0aGlzLnN0b3JlLmRlc3RvcnkoKTtcclxuXHRcdHRoaXMuaGVhZGVyLmRlc3RvcnkoKTtcclxuXHRcdHRoaXMuJGRvbS53cmFwcGVyLnJlbW92ZSgpO1xyXG5cdH1cclxufVxyXG5tb2R1bGUuZXhwb3J0cyA9IEdyaWRDb21wb25lbnQ7IiwiY29uc3QgJCA9IHJlcXVpcmUoJy4uL3V0aWwvc2hpbScpLiQ7XHJcbmNvbnN0IEREID0gcmVxdWlyZSgnLi4vdXRpbC9ERCcpO1xyXG5cclxuY29uc3QgU09SVF9DTFNfQVNDID0gJ2MtY29sdW1uLWFzYyc7XHJcbmNvbnN0IFNPUlRfQ0xTX0RFU0MgPSAnYy1jb2x1bW4tZGVzYyc7XHJcbmNvbnN0IE5FRURMRVNTX1dJRFRIID0gMTAwMDtcclxuXHJcbnZhciBjcmVhdGVDb2x1bW5FbGVtZW50ID0gZnVuY3Rpb24oY29sTSkge1xyXG5cdHZhciBsb2NrQ2xhc3MgPSBjb2xNLmxvY2tlZCA/ICcgYy1jb2x1bW4tbG9ja2VkJyA6ICcnO1xyXG5cclxuXHRyZXR1cm4gJCgnPGxpLz4nKVxyXG5cdFx0LmFkZENsYXNzKCdjLWhlYWRlci1jZWxsJyArIGxvY2tDbGFzcylcclxuXHRcdC5hZGRDbGFzcygnYy1hbGlnbi0nICsgY29sTS5hbGlnbilcclxuXHRcdC53aWR0aChjb2xNLndpZHRoKVxyXG5cdFx0Lm9uKCdjbGljaycsICgpID0+IHsgY29sTS5zb3J0KCk7IH0pXHJcblx0XHQuZGF0YSgnY29sdW1uJywgY29sTSlcclxuXHRcdC5odG1sKGNvbE0udGV4dCk7XHJcbn07XHJcblxyXG5cclxuY2xhc3MgSGVhZGVyIHtcclxuXHRjb25zdHJ1Y3RvcigkaGVhZGVyLCBjb2xzTW9kZWwsIHN0b3JlKSB7XHJcblxyXG5cdFx0dGhpcy4kaGVhZGVyID0gJGhlYWRlcjtcclxuXHRcdHRoaXMuY29sc01vZGVsID0gY29sc01vZGVsO1xyXG5cdFx0dGhpcy5zdG9yZSA9IHN0b3JlO1xyXG5cdFx0dGhpcy5jb2xFbGVtZW50cyA9IG5ldyBNYXAoKTtcclxuXHJcblx0XHR0aGlzLl9jcmVhdGVDb2x1bW5FbGVtZW50cygpO1xyXG5cdFx0dGhpcy5fYmluZEV2ZW50KCk7XHJcblxyXG5cdFx0dGhpcy5yZW5kZXIoKTtcclxuXHR9XHJcblxyXG5cdF9jcmVhdGVDb2x1bW5FbGVtZW50cygpIHtcclxuXHRcdHZhciB3aWR0aCA9IE5FRURMRVNTX1dJRFRIO1xyXG5cclxuXHRcdHRoaXMuJHJvdyA9ICQoJzx1bC8+JykuYWRkQ2xhc3MoJ2MtaGVhZGVyLXJvdycpO1xyXG5cclxuXHRcdHRoaXMuY29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblx0XHRcdGxldCBjb2xFbGVtZW50ID0gY3JlYXRlQ29sdW1uRWxlbWVudChjb2xNKTtcclxuXHJcblx0XHRcdHRoaXMuY29sRWxlbWVudHMuc2V0KGNvbE0sIGNvbEVsZW1lbnQpO1xyXG5cdFx0XHR0aGlzLiRyb3cuYXBwZW5kKGNvbEVsZW1lbnQpO1xyXG5cclxuXHRcdFx0d2lkdGggKz0gY29sTS53aWR0aDtcclxuXHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLiRyb3cud2lkdGgod2lkdGgpO1xyXG5cdH1cclxuXHJcblx0Z2V0VmlzaWJsZUNvbHNXaWR0aCgpIHtcclxuXHRcdHJldHVybiB0aGlzLiRyb3cud2lkdGgoKSAtIE5FRURMRVNTX1dJRFRIO1xyXG5cdH1cclxuXHJcblx0X2JpbmRFdmVudCgpIHtcclxuXHRcdHRoaXMuX2NvbHVtblJlc2l6ZSgpO1xyXG5cclxuXHRcdHRoaXMuY29sc01vZGVsLm9uKCdjb2x1bW4tYWRkJywgY29sTSA9PiB7XHJcblx0XHRcdGxldCBjb2xFbGVtZW50ID0gY3JlYXRlQ29sdW1uRWxlbWVudChjb2xNKTtcclxuXHJcblx0XHRcdHRoaXMuY29sRWxlbWVudHMuc2V0KGNvbE0sIGNvbEVsZW1lbnQpO1xyXG5cdFx0XHR0aGlzLiRyb3cuYXBwZW5kKGNvbEVsZW1lbnQpO1xyXG5cclxuXHRcdFx0bGV0IHJvd1cgPSB0aGlzLiRyb3cud2lkdGgoKTtcclxuXHRcdFx0dGhpcy4kcm93LndpZHRoKHJvd1cgKyBjb2xNLndpZHRoKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuY29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tcmVzaXplZCcsIHdpZHRoID0+IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pLm91dGVyV2lkdGgod2lkdGgpKTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1oaWRkZW4nLCBpc0hpZGRlbiA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cdFx0XHRcdGlmIChpc0hpZGRlbikge1xyXG5cdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKCdjLWNvbHVtbi1oaWRlJyk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcygnYy1jb2x1bW4taGlkZScpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tbG9ja2VkJywgaXNMb2NrZWQgPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHJcblx0XHRcdFx0aWYgKGlzTG9ja2VkKSB7XHJcblx0XHRcdFx0XHRjb2xFbGUuYWRkQ2xhc3MoJ2MtY29sdW1uLWxvY2tlZCcpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoJ2MtY29sdW1uLWxvY2tlZCcpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tc29ydC1jaGFuZ2VkJywgc29ydFN0YXRlID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdGNvbnNvbGUubG9nKHNvcnRTdGF0ZSk7XHJcblx0XHRcdFx0aWYgKHNvcnRTdGF0ZSkge1xyXG5cdFx0XHRcdFx0aWYgKHNvcnRTdGF0ZSA9PT0gJ0FTQycpIHtcclxuXHRcdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKFNPUlRfQ0xTX0FTQyk7XHJcblx0XHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcyhTT1JUX0NMU19ERVNDKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcyhTT1JUX0NMU19ERVNDKTtcclxuXHRcdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKFNPUlRfQ0xTX0FTQyk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcyhTT1JUX0NMU19BU0MpLnJlbW92ZUNsYXNzKFNPUlRfQ0xTX0RFU0MpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdkZXN0b3J5JywgKCkgPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHRcdFx0XHR0aGlzLmNvbEVsZW1lbnRzLmRlbGV0ZShjb2xNKTtcdFx0XHRcclxuXHRcdFx0XHRjb2xFbGUucmVtb3ZlKCk7XHJcblxyXG5cdFx0XHRcdGxldCByb3dXID0gdGhpcy4kcm93LndpZHRoKCk7XHJcblx0XHRcdFx0dGhpcy4kcm93LndpZHRoKHJvd1cgLSBjb2xNLndpZHRoKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdF9jb2x1bW5SZXNpemUoKSB7XHJcblx0XHR0aGlzLiRyb3cub24oJ21vdXNlbW92ZScsICdsaS5jLWhlYWRlci1jZWxsJywgZnVuY3Rpb24oZXZ0KSB7XHJcblx0XHRcdHZhciBvZmZzZXRYID0gZXZ0Lm9mZnNldFg7XHJcblx0XHRcdGlmICh0aGlzLm9mZnNldFdpZHRoIC0gb2Zmc2V0WCA8PSA1IHx8IG9mZnNldFggPD0gNSkge1xyXG5cdFx0XHRcdCQodGhpcykuYWRkQ2xhc3MoJ2MtY29sLXJlc2l6YWJsZScpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdCQodGhpcykucmVtb3ZlQ2xhc3MoJ2MtY29sLXJlc2l6YWJsZScpO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHJcblxyXG5cdFx0dmFyIHN0YXJ0WCA9IDA7XHJcblxyXG5cdFx0REQodGhpcy4kcm93LmZpbmQoJ2xpLmMtaGVhZGVyLWNlbGwnKSwge1xyXG5cdFx0XHQncmVzdHJpY3Rlcic6IGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHRcdHZhciBvZmZzZXRYID0gZXZ0Lm9mZnNldFg7XHJcblx0XHRcdFx0aWYgKGV2dC50YXJnZXQub2Zmc2VzdFdpZHRoIC0gb2Zmc2V0WCA8PSA1KSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gJChldnQudGFyZ2V0KTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKG9mZnNldFggPD0gNSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuICQoZXZ0LnRhcmdldCkucHJldigpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSxcclxuXHRcdFx0J29uRHJhZ1N0YXJ0JzogZnVuY3Rpb24ob2Zmc2V0LCAkdGFyZ2V0KSB7XHJcblx0XHRcdFx0dmFyIHNjcm9sbExlZnQgPSBkb2N1bWVudC5ib2R5LnNjcm9sbExlZnQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbExlZnQ7XHJcblx0XHRcdFx0Y29uc29sZS5sb2coJHRhcmdldC5vZmZzZXQoKS5sZWZ0LCAkdGFyZ2V0LnRleHQoKSk7XHJcblx0XHRcdFx0c3RhcnRYID0gJHRhcmdldC5vZmZzZXQoKS5sZWZ0IC0gc2Nyb2xsTGVmdDtcclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyhvZmZzZXQueCwgJHRhcmdldC50ZXh0KCkpO1xyXG5cclxuXHRcdFx0XHQvLyBzdGFydFggPSBvZmZzZXQueDtcclxuXHRcdFx0fSxcclxuXHRcdFx0J29uRHJhZ2dpbmcnOiBmdW5jdGlvbihvZmZzZXQsICR0YXJnZXQpIHtcclxuXHJcblx0XHRcdH0sXHJcblx0XHRcdCdvbkRyYWdFbmQnOiBmdW5jdGlvbihvZmZzZXQsICR0YXJnZXQpIHtcclxuXHRcdFx0XHR2YXIgd2lkdGggPSBvZmZzZXQueCAtIHN0YXJ0WDtcclxuXHRcdFx0XHRjb25zb2xlLmxvZyhgJHskdGFyZ2V0LnRleHQoKX1cclxuXHRcdFx0XHRcdOWOn+WuveW6puS4uiR7JHRhcmdldC5kYXRhKCdjb2x1bW4nKS53aWR0aH0sXHJcblx0XHRcdFx0XHTmlLnlj5jkuLrvvJoke3dpZHRofSwgWyR7b2Zmc2V0Lnh9IC0gJHtzdGFydFh9XWApO1xyXG5cdFx0XHRcdCR0YXJnZXQuZGF0YSgnY29sdW1uJykuc2V0V2lkdGgod2lkdGgpO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdHJlbmRlcigpIHtcclxuXHRcdHRoaXMuJGhlYWRlci5hcHBlbmQodGhpcy4kcm93KTtcclxuXHR9XHJcblxyXG5cdGRlc3RvcnkoKSB7XHJcblxyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBIZWFkZXI7IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuY2xhc3MgTG9ja0NvbHVtbiB7XHJcblx0Y29uc3RydWN0b3IoKSB7XHJcblx0XHR0aGlzLl9kYXRhID0gW107XHJcblx0XHR0aGlzLl9jb2x1bW5zV2lkdGggPSAwO1xyXG5cdH1cclxuXHJcblx0YWRkKGNvbE0pIHtcclxuXHRcdHRoaXMuX2RhdGEudW5zaGlmdChjb2xNKTtcclxuXHRcdHRoaXMucmVDYWxjKCk7XHJcblx0fVxyXG5cclxuXHRyZW1vdmUoZGVsQ29sTSkge1xyXG5cdFx0dGhpcy5fZGF0YSA9IHRoaXMuX2RhdGEuZmlsdGVyKGNvbE0gPT4gY29sTSAhPT0gZGVsQ29sTSk7XHJcblx0XHR0aGlzLnJlQ2FsYygpO1xyXG5cdH1cclxuXHJcblx0Y2xlYXIoKSB7XHJcblx0XHR0aGlzLl9kYXRhLmxlbmd0aCA9IDA7XHJcblx0XHR0aGlzLnJlQ2FsYygpO1xyXG5cdH1cclxuXHJcblx0Z2V0V2lkdGgoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fY29sdW1uc1dpZHRoO1xyXG5cdH1cclxuXHJcblx0cmVDYWxjKCkge1xyXG5cdFx0dGhpcy5fY29sdW1uc1dpZHRoID0gdGhpcy5fZGF0YS5yZWR1Y2UoKHdpZHRoLCBjb2xNKSA9PiB7XHJcblx0XHRcdHdpZHRoIC09IGNvbE0ud2lkdGg7XHJcblx0XHRcdGNvbE0uYXdheUZyb21MZWZ0ID0gd2lkdGg7XHJcblx0XHRcdHJldHVybiB3aWR0aDtcclxuXHRcdH0sIDApO1xyXG5cdH1cclxuXHJcblx0ZWFjaChmbikge1xyXG5cdFx0dGhpcy5fZGF0YS5mb3JFYWNoKGZuKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIOW9k+WFtuS4reS4gOWIl+WPkeeUn+WPmOWMlu+8jOmAmuefpeWFtuWug+WIl+ebuOW6lOWPmOWMllxyXG5cdCAqL1xyXG5cdCBwdWJsaXNoKGNoYW5nZWRDb2xNLCBzY3JvbGxMZWZ0KSB7XHJcblx0IFx0dGhpcy5fZGF0YS5mb3JFYWNoKGNvbE0gPT4ge1xyXG5cdCBcdFx0aWYgKGNvbE0gIT09IGNoYW5nZWRDb2xNKSB7XHJcblx0IFx0XHRcdGNvbE0uZmlyZSgnc2Nyb2xsLXgnLCBzY3JvbGxMZWZ0KTtcclxuXHQgXHRcdH1cclxuXHQgXHR9KTtcclxuXHQgfVxyXG59XHJcblxyXG52YXIgTG9ja0NvbE1hbmFnZXIgPSBmdW5jdGlvbihjb2xzTW9kZWwsIGhlYWRlciwgJGRvbSwgYnVmZmVyTm9kZSkge1xyXG5cdGxldCB2aXNpYmxlTG9ja0NvbHVtbiA9IG5ldyBMb2NrQ29sdW1uKCk7XHJcblxyXG5cdGluaXQoKTtcclxuXHRpbml0RXZlbnQoKTtcclxuXHJcblx0ZnVuY3Rpb24gaW5pdCgpIHtcclxuXHRcdGNvbHNNb2RlbFxyXG5cdFx0XHQuZ2V0TG9ja0NvbHVtbigpXHJcblx0XHRcdC5maWx0ZXIoY29sTSA9PiAhY29sTS5oaWRkZW4pXHJcblx0XHRcdC5mb3JFYWNoKGNvbE0gPT4gdmlzaWJsZUxvY2tDb2x1bW4uYWRkKGNvbE0pKTtcclxuXHJcblx0XHR1cGRhdGVCb3hTaXplKCk7XHJcblxyXG5cdFx0dmlzaWJsZUxvY2tDb2x1bW4uZWFjaChjb2xNID0+IHtcclxuXHRcdFx0bGV0IGhlYWRlckVsZW1lbnQgPSBoZWFkZXIuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cdFx0XHQvLyDorr7nva7lubborrDlvZXliJ3lp4vnmoTlt6bkvqfkvY1cclxuXHRcdFx0aGVhZGVyRWxlbWVudC5jc3MoJ2xlZnQnLCBjb2xNLmF3YXlGcm9tTGVmdCk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdzY3JvbGwteCcsIHggPT4ge1xyXG5cdFx0XHRcdGxldCBsZWZ0U3R5bGUgPSB7ICdsZWZ0JzogeCArIGNvbE0uYXdheUZyb21MZWZ0IH07XHJcblxyXG5cdFx0XHRcdGhlYWRlckVsZW1lbnQuY3NzKGxlZnRTdHlsZSk7XHJcblx0XHRcdFx0YnVmZmVyTm9kZS5nZXROb2RlTGlzdCgpLmZvckVhY2gobm9kZSA9PiBub2RlLmNoaWxkcmVuLmdldChjb2xNKS5jc3MobGVmdFN0eWxlKSk7XHRcdFx0XHRcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGluaXRFdmVudCgpIHtcclxuXHJcblx0XHRjb25zdCBjb2x1bW5Mb2NrT3JVbkxvY2sgPSAoaXNMb2NrZWQsIGNvbE0pID0+IHtcclxuXHRcdFx0bGV0IGhlYWRlckVsZW1lbnQgPSBoZWFkZXIuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0aWYgKGlzTG9ja2VkKSB7XHJcblx0XHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4uYWRkKGNvbE0pO1xyXG5cclxuXHRcdFx0XHRjb2xNLm9uKCdzY3JvbGwteCcsIHggPT4ge1xyXG5cdFx0XHRcdFx0bGV0IGxlZnRTdHlsZSA9IHsgJ2xlZnQnOiB4ICsgY29sTS5hd2F5RnJvbUxlZnQgfTtcclxuXHJcblx0XHRcdFx0XHRoZWFkZXJFbGVtZW50LmNzcyhsZWZ0U3R5bGUpO1xyXG5cdFx0XHRcdFx0YnVmZmVyTm9kZS5nZXROb2RlTGlzdCgpLmZvckVhY2gobm9kZSA9PiBub2RlLmNoaWxkcmVuLmdldChjb2xNKS5jc3MobGVmdFN0eWxlKSk7XHJcblx0XHRcdFx0fSk7XHJcblxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHZpc2libGVMb2NrQ29sdW1uLnJlbW92ZShjb2xNKTtcclxuXHJcblx0XHRcdFx0Y29sTS5vZmYoJ3Njcm9sbC14Jyk7XHJcblxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRsZXQgY3VycmVudExlZnQgPSAkZG9tLnZpZXdwb3J0LnNjcm9sbExlZnQoKSArIGNvbE0uYXdheUZyb21MZWZ0O1xyXG5cclxuXHRcdFx0Ly8g6K6+572u5bm26K6w5b2V5Yid5aeL55qE5bem5L6n5L2NXHJcblx0XHRcdGhlYWRlckVsZW1lbnQuY3NzKCdsZWZ0JywgY3VycmVudExlZnQpO1xyXG5cdFx0XHRidWZmZXJOb2RlLmdldE5vZGVMaXN0KCkuZm9yRWFjaChub2RlID0+IG5vZGUuY2hpbGRyZW4uZ2V0KGNvbE0pLmNzcygnbGVmdCcsIGN1cnJlbnRMZWZ0KSk7XHJcblxyXG5cdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5wdWJsaXNoKGNvbE0sICRkb20udmlld3BvcnQuc2Nyb2xsTGVmdCgpKTtcclxuXHRcdFx0dXBkYXRlQm94U2l6ZSgpO1xyXG5cdFx0fTtcclxuXHJcblx0XHRjb2xzTW9kZWwub24oJ2NvbHVtbi1hZGQnLCBjb2xNID0+IHtcclxuXHRcdFx0Ly8gQlVHRklYIFRPRE9cclxuXHJcblx0XHRcdC8vIC4uLlxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tbG9ja2VkJywgaXNMb2NrZWQgPT4ge1xyXG5cdFx0XHRcdGNvbHVtbkxvY2tPclVuTG9jayhpc0xvY2tlZCwgY29sTSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Y29sc01vZGVsLmdldENvbHVtbigpLmZvckVhY2goY29sTSA9PiB7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tcmVzaXplZCcsIHdpZHRoID0+IHtcclxuXHJcblx0XHRcdFx0aWYgKGNvbE0ubG9ja2VkKSB7XHJcblx0XHRcdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5yZUNhbGMoKTtcclxuXHRcdFx0XHRcdGxldCBoZWFkZXJFbGVtZW50ID0gaGVhZGVyLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHJcblx0XHRcdFx0XHRsZXQgY3VycmVudExlZnQgPSAkZG9tLnZpZXdwb3J0LnNjcm9sbExlZnQoKSArIGNvbE0uYXdheUZyb21MZWZ0O1xyXG5cclxuXHRcdFx0XHRcdGhlYWRlckVsZW1lbnQuY3NzKCdsZWZ0JywgY3VycmVudExlZnQpO1xyXG5cdFx0XHRcdFx0YnVmZmVyTm9kZS5nZXROb2RlTGlzdCgpLmZvckVhY2gobm9kZSA9PiBub2RlLmNoaWxkcmVuLmdldChjb2xNKS5jc3MoJ2xlZnQnLCBjdXJyZW50TGVmdCkpO1xyXG5cclxuXHRcdFx0XHRcdHZpc2libGVMb2NrQ29sdW1uLnB1Ymxpc2goY29sTSwgJGRvbS52aWV3cG9ydC5zY3JvbGxMZWZ0KCkpO1xyXG5cdFx0XHRcdFx0dXBkYXRlQm94U2l6ZSgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHJcblx0XHRcdH0pO1xyXG5cclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1sb2NrZWQnLCBpc0xvY2tlZCA9PiB7XHJcblx0XHRcdFx0Ly8gLi4uXHJcblx0XHRcdFx0Y29sdW1uTG9ja09yVW5Mb2NrKGlzTG9ja2VkLCBjb2xNKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHRcdFxyXG5cdFx0YnVmZmVyTm9kZS5vbignYnVmZmVyLWluaXRpYWwnLCAoKSA9PiB7XHJcblx0XHRcdC8vIGNsZWFyQnVmZmVyTG9ja05vZGUoKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdXBkYXRlQm94U2l6ZSgpIHtcclxuXHRcdHZhciB2aXNpYmxlTG9ja0NvbHNXaWR0aCA9IHZpc2libGVMb2NrQ29sdW1uLmdldFdpZHRoKCk7XHJcblx0XHRoZWFkZXIuJGhlYWRlci5jc3MoJ3BhZGRpbmctbGVmdCcsIC12aXNpYmxlTG9ja0NvbHNXaWR0aCk7XHJcblx0XHQkZG9tLmNhbnZhcy5jc3MoJ21hcmdpbi1sZWZ0JywgLXZpc2libGVMb2NrQ29sc1dpZHRoKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiB7XHJcblx0XHR2aXNpYmxlTG9ja0NvbHVtbixcclxuXHRcdHNldExvY2tDb2x1bW5YKHNjcm9sbExlZnQpIHtcclxuXHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4uZWFjaChjb2xNID0+IGNvbE0uZmlyZSgnc2Nyb2xsLXgnLCBzY3JvbGxMZWZ0KSk7XHJcblx0XHR9LFxyXG5cclxuXHRcdGFkZEJ1ZmZlckxvY2tOb2RlKHJvd05vZGVzKSB7XHJcblx0XHRcdHZpc2libGVMb2NrQ29sdW1uLmVhY2goY29sTSA9PiB7XHJcblx0XHRcdFx0cm93Tm9kZXMuZm9yRWFjaChyb3dOb2RlcyA9PiB7XHJcblx0XHRcdFx0XHRsZXQgY29sRWxlID0gaGVhZGVyLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHRcdFx0XHRcdGxldCBjZWxsRWxlbWVudCA9IHJvd05vZGVzLmNoaWxkcmVuLmdldChjb2xNKTtcclxuXHJcblx0XHRcdFx0XHRjZWxsRWxlbWVudC5jc3MoJ2xlZnQnLCAkZG9tLnZpZXdwb3J0LnNjcm9sbExlZnQoKSArIGNvbE0uYXdheUZyb21MZWZ0KTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSk7XHJcblx0XHR9LFxyXG5cclxuXHRcdGNsZWFyQnVmZmVyTG9ja05vZGUoKSB7XHJcblx0XHRcdHZpc2libGVMb2NrQ29sdW1uLmNsZWFyKCk7XHJcblx0XHR9XHJcblxyXG5cdH07XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IExvY2tDb2xNYW5hZ2VyOyIsIi8vIFRPRE9cclxudmFyIGRlYm91bmNlID0gZnVuY3Rpb24oZm4sIHRpbWUpIHtcclxuXHR2YXIgdGltZXIgPSBudWxsO1xyXG5cdHJldHVybiBmdW5jdGlvbiguLi5hcmdzKSB7XHJcblx0XHRpZiAodGltZXIpIGNsZWFyVGltZW91dCh0aW1lcik7XHJcblxyXG5cdFx0dGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcclxuXHRcdFx0Zm4uYXBwbHkobnVsbCwgYXJncyk7XHJcblx0XHR9LCB0aW1lKTtcclxuXHR9XHJcbn1cclxuXHJcbi8v6Kej5YazcmVxdWVzdEFuaW1hdGlvbkZyYW1l5YW85a656Zeu6aKYXHJcbnZhciByYUZyYW1lID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxyXG4gICAgICAgICAgICAgIHdpbmRvdy53ZWJraXRSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcclxuICAgICAgICAgICAgICB3aW5kb3cubW96UmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XHJcbiAgICAgICAgICAgICAgd2luZG93Lm9SZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcclxuICAgICAgICAgICAgICB3aW5kb3cubXNSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcclxuICAgICAgICAgICAgICBmdW5jdGlvbihjYWxsYmFjaykge1xyXG4gICAgICAgICAgICAgICAgICB3aW5kb3cuc2V0VGltZW91dChjYWxsYmFjaywgMTAwMCAvIDYwKTtcclxuICAgICAgICAgICAgICB9O1xyXG5cclxuLy/mn6/ph4zljJblsIHoo4VcclxudmFyIHRocm90dGxlID0gZnVuY3Rpb24oZm4pIHtcclxuICAgIGxldCBpc0xvY2tlZDtcclxuICAgIHJldHVybiBmdW5jdGlvbiguLi5hcmdzKSB7XHJcblxyXG4gICAgICAgIGlmKGlzTG9ja2VkKSByZXR1cm4gXHJcblxyXG4gICAgICAgIGlzTG9ja2VkID0gdHJ1ZTtcclxuICAgICAgICByYUZyYW1lKCgpID0+IHtcclxuICAgICAgICAgICAgaXNMb2NrZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgZm4uYXBwbHkodGhpcywgYXJncylcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufTtcclxuXHJcbmNsYXNzIFNjcm9sbGVyIHtcclxuXHRjb25zdHJ1Y3RvcihsaW5lSGVpZ2h0LCBidWZmZXJab25lKSB7XHJcblxyXG5cdFx0dGhpcy5idWZmZXJab25lID0gYnVmZmVyWm9uZTtcclxuXHRcdHRoaXMueURpciA9IDA7IC8vIDE65ZCR5LiK77yMMCwtMTrlkJHkuItcclxuXHRcdHRoaXMueVByZUluZGV4ID0gMDsgLy8g5LiK5LiA5Liq5L2N572uXHJcblx0XHR0aGlzLmxpbmVIZWlnaHQgPSBsaW5lSGVpZ2h0O1xyXG5cclxuXHRcdHRoaXMueERpciA9IDA7IC8vIDHvvJrlkJHlt6bvvIww77yMLTHvvJrlkJHlj7NcclxuXHRcdHRoaXMueFByZUluZGV4ID0gMDsgLy8g5YmN5LiA5Liq5L2N572uXHJcblxyXG5cdFx0dGhpcy5fdHJpZ2dlclggPSB4ID0+IHg7XHJcblx0XHR0aGlzLl90cmlnZ2VyWSA9IHkgPT4geTtcclxuXHJcblx0fVxyXG5cclxuXHRvblgoY2FsbGJhY2spIHtcclxuXHRcdHRoaXMuX3RyaWdnZXJYID0geCA9PiB7XHJcblx0XHRcdGlmICh4ID09PSB0aGlzLnhQcmVJbmRleCkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy54RGlyID0geCAtIHRoaXMueFByZUluZGV4O1xyXG5cdFx0XHR0aGlzLnhQcmVJbmRleCA9IHg7XHJcblxyXG5cdFx0XHRjYWxsYmFjayh4KTtcclxuXHRcdH07XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRvblkoaGFuZGxlciwgZGVsYXkpIHtcclxuXHRcdC8vIFRPRE9cclxuXHRcdC8vIHZhciBkZWFseUZuID0gZGVib3VuY2UoaGFuZGxlciwgZGVsYXkpO1xyXG5cclxuXHRcdHRoaXMuX3RyaWdnZXJZID0gZGVib3VuY2UoKHkpID0+IHtcclxuXHRcdFx0dGhpcy55RGlyID0geSAtIHRoaXMueVByZUluZGV4O1xyXG5cdFx0XHR0aGlzLnlQcmVJbmRleCA9IHk7XHJcblxyXG5cdFx0XHR2YXIgaW5kZXggPSB+fih5LyB0aGlzLmxpbmVIZWlnaHQpO1xyXG5cdFx0XHR2YXIgd2lsbExvYWQgPSB0aGlzLmJ1ZmZlclpvbmUuc2hvdWxkTG9hZCh0aGlzLnlEaXIsIGluZGV4KTtcclxuXHJcblx0XHRcdGlmICh3aWxsTG9hZCkge1xyXG5cdFx0XHRcdC8vIGRlYWx5Rm4oKTtcclxuXHRcdFx0XHRoYW5kbGVyKFxyXG5cdFx0XHRcdFx0dGhpcy55RGlyID4gMCA/IDEgOiAtMSxcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS5kb21haW4sXHJcblx0XHRcdFx0XHR0aGlzLmJ1ZmZlclpvbmUuc3RhcnQsXHJcblx0XHRcdFx0XHR0aGlzLmJ1ZmZlclpvbmUuZW5kLFxyXG5cdFx0XHRcdFx0aW5kZXgsXHJcblx0XHRcdFx0XHR0aGlzLmJ1ZmZlclpvbmUudG90YWxcclxuXHRcdFx0XHQpO1xyXG5cdFx0XHR9XHJcblx0XHR9LCBkZWxheSk7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRmaXJlWCh4KSB7XHJcblx0XHR0aGlzLl90cmlnZ2VyWCh4KTtcclxuXHR9XHJcblxyXG5cdGZpcmVZKHkpIHtcclxuXHRcdHRoaXMuX3RyaWdnZXJZKHkpO1xyXG5cdH1cclxuXHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFNjcm9sbGVyOyIsIi8vIGV4cG9ydHMuR3JpZFN0b3JlID0gcmVxdWlyZSgnLi9jb3JlL0dyaWRTdG9yZScpO1xyXG4vLyBleHBvcnRzLkdyaWRWaWV3ID0gcmVxdWlyZSgnLi9jb3JlL0dyaWRWaWV3Jyk7XHJcbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9wbHVnaW4vU2VsZWN0aW9uJyk7IiwidmFyIEdyaWRWaWV3ID0gcmVxdWlyZSgnLi4vY29yZS9HcmlkVmlldycpO1xyXG5cclxuY29uc3QgQ0VMTF9DTFMgPSAnbGkuYy1ncmlkLWNlbGwnO1xyXG5jb25zdCBDRUxMX1NFTEVDVEVEX0NMUyA9ICdjLWNlbGwtc2VsZWN0ZWQnO1xyXG5jb25zdCBST1dfQ0xTID0gJy5jLWdyaWQtcm93JztcclxuXHJcbmNsYXNzIFNlbGVjdGlvbiBleHRlbmRzIEdyaWRWaWV3IHtcclxuXHJcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xyXG5cdFx0c3VwZXIob3B0aW9ucyk7XHJcblxyXG5cdFx0dGhpcy5fbW92aW5nID0gZmFsc2U7XHJcblx0XHR0aGlzLl9zdGFydCA9IG51bGw7XHJcblx0XHR0aGlzLl9lbmQgPSBudWxsO1xyXG5cdFx0dGhpcy5fbGFzdFkgPSBudWxsO1xyXG5cdFx0dGhpcy5fc2VsZWN0aW9uID0gW107XHJcblx0XHR0aGlzLl9zZWxlY3RZID0gW107XHJcblx0XHR0aGlzLl9zZWxlY3REYXRhSW5kZXggPSBbXTtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoJGRvbSkge1xyXG5cdFx0c3VwZXIuX2JpbmRFdmVudCgpO1xyXG5cclxuXHRcdGxldCBzZWxmID0gdGhpcztcclxuXHJcblx0XHR0aGlzLiRkb20uY2FudmFzXHJcblx0XHRcdC5vbignbW91c2Vkb3duJywgQ0VMTF9DTFMsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHRcdGlmIChldnQuYnV0dG9uID09PSAwKSB7XHJcblx0XHRcdFx0XHRzZWxmLiRkb20uY2FudmFzLmZpbmQoQ0VMTF9DTFMpLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0XHRcdHNlbGYuX21vdmluZyA9IHRydWU7XHJcblx0XHRcdFx0XHRsZXQgJGNlbGwgPSAkKHRoaXMpLmFkZENsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0XHRcdHNlbGYuX3N0YXJ0ID0gWyRjZWxsLmRhdGEoJ2RhdGFJbmRleCcpLCArJGNlbGwucGFyZW50KFJPV19DTFMpLmF0dHIoJ3JpZCcpXTtcclxuXHRcdFx0XHRcdC8vIGNvbnNvbGUubG9nKHN0YXJ0KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pXHJcblx0XHRcdC5vbignbW91c2VlbnRlcicsIENFTExfQ0xTLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRpZiAoc2VsZi5fbW92aW5nKSB7XHJcblx0XHRcdFx0XHRsZXQgJGNlbGwgPSAkKHRoaXMpO1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0XHQkY2VsbC5hZGRDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdFx0XHRzZWxmLl9lbmQgPSBbJGNlbGwuZGF0YSgnZGF0YUluZGV4JyksICskY2VsbC5wYXJlbnQoUk9XX0NMUykuYXR0cigncmlkJyldO1xyXG5cclxuXHRcdFx0XHRcdHNlbGYuc2VsZWN0aW9uUmFuZ2Uoc2VsZi5fc3RhcnQsIHNlbGYuX2VuZCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KVxyXG5cdFx0XHQub24oJ21vdXNldXAnLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRzZWxmLl9tb3ZpbmcgPSBmYWxzZTtcclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyhlbmQpO1xyXG5cdFx0XHRcdGNvbnNvbGUubG9nKHNlbGYuX3NlbGVjdGlvbik7XHJcblx0XHRcdFx0Ly8gVE9ET1xyXG5cdFx0XHRcdC8vIGNvcHkoJCgnLmNlbGwuc2VsZWN0ZWQnKSk7XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuYnVmZmVyTm9kZS5vbigncm93LXVwZGF0ZScsIChyb3dOb2RlLCByb3cpID0+IHtcclxuXHRcdFx0Y29uc29sZS5sb2cocm93Tm9kZS4kbm9kZSwgcm93LnJpZCk7XHJcblx0XHRcdFxyXG5cdFx0XHRsZXQgaSA9IHJvdy5yaWQ7XHJcblx0XHRcdGxldCBbeTAsIHkxXSA9IHRoaXMuX3NlbGVjdFk7XHJcblx0XHRcdGxldCBjb2xzID0gdGhpcy5fc2VsZWN0RGF0YUluZGV4O1xyXG5cclxuXHRcdFx0aWYgKGkgPj0geTAgJiYgaSA8IHkxICsgMSkge1xyXG5cdFx0XHRcdGNvbHMuZm9yRWFjaCgoY29sKSA9PiB7XHJcblx0XHRcdFx0XHRyb3dOb2RlLmNoaWxkcmVuLmZvckVhY2goKCRjZWxsLCBjb2xNKSA9PiB7XHJcblx0XHRcdFx0XHRcdGlmIChjb2xzLmluZGV4T2YoY29sTS5kYXRhSW5kZXgpICE9IC0xKSB7XHJcblx0XHRcdFx0XHRcdFx0JGNlbGwuYWRkQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdCRjZWxsLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKVxyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRyb3dOb2RlLiRub2RlLmZpbmQoQ0VMTF9DTFMpLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0c2VsZWN0aW9uUmFuZ2UoW3gwLCB5MF0sIFt4MSwgeTFdKSB7XHJcblxyXG5cdFx0bGV0IHlEaXIgPSB5MSAtIHkwO1xyXG5cdFx0bGV0IGxhc3RZID0gdGhpcy5fbGFzdFk7XHJcblx0XHRcdFxyXG5cdFx0Ly8geVJhbmdlID0geyBsYXN0OiAsIG5vdzogW3kwLCB5MV0gfTtcclxuXHRcdC8vIFtsMCwgbDFdXHJcblx0XHQvLyBbeTAsIHkxXVxyXG5cdFx0Ly8gW2wwLCBsMV1cclxuXHRcdGxldCByZW1vdmVZUmFuZ2UgPSBbXTtcclxuXHRcdC8vIGRvd25cclxuXHRcdGlmICh5RGlyID49IDAgJiYgeTEgPCBsYXN0WSkge1xyXG5cdFx0XHRyZW1vdmVZUmFuZ2UgPSBbeTEsIGxhc3RZXTtcclxuXHRcdH1cclxuXHRcdC8vIHVwXHJcblx0XHRpZiAoeURpciA8PSAwICYmIHkxID4gbGFzdFkpIHtcclxuXHRcdFx0cmVtb3ZlWVJhbmdlID0gW2xhc3RZLCB5MV07XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdHRoaXMuX2xhc3RZID0geTE7XHJcblx0XHRjb25zb2xlLmxvZyh5RGlyLCByZW1vdmVZUmFuZ2UpO1xyXG5cclxuXHRcdGxldCBkYXRhSW5kZXggPSB0aGlzLmdldExvY2tBbmRWaXNpYWJsZUNvbHVtbkFzRGF0YUluZGV4KCk7XHJcblx0XHRbeDAsIHkwLCB4MSwgeTFdID0gb3JkZXJCeSh4MCwgeTAsIHgxLCB5MSwgZGF0YUluZGV4KTtcclxuXHJcblxyXG5cdFx0bGV0IGNvbHMgPSB0aGlzLl9zZWxlY3REYXRhSW5kZXggPSBkYXRhSW5kZXguc2xpY2UoZGF0YUluZGV4LmluZGV4T2YoeDApLCBkYXRhSW5kZXguaW5kZXhPZih4MSkrMSk7XHJcblx0XHRjb25zb2xlLmxvZyhjb2xzKTtcclxuXHJcblx0XHR0aGlzLl9zZWxlY3RZID0gW3kwLCB5MSArIDFdO1xyXG5cdFx0bGV0IHJvd3MgPSB0aGlzLnN0b3JlLnNsaWNlKHkwLCB5MSArIDEpO1xyXG5cclxuXHRcdHRoaXMuX3NlbGVjdGlvbiA9IHJvd3MubWFwKHJvdyA9PiB7XHJcblx0XHRcdHJldHVybiBjb2xzLm1hcChjb2wgPT4gcm93LmRhdGFbY29sXSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHQvLyBUT0RPXHJcblx0XHQvLyDmoLzlvI/ljJYs54q25oCB5YaZ5YWl5Yiwc3RvcmVcclxuXHRcdC8vIGNvbnNvbGUubG9nKHRoaXMuX3NlbGVjdGlvbik7XHJcblxyXG5cdFx0bGV0IG5vZGVMaXN0ID0gdGhpcy5idWZmZXJOb2RlLmdldE5vZGVMaXN0KCk7XHJcblx0XHRub2RlTGlzdC5mb3JFYWNoKChyb3dOb2RlKSA9PiB7XHJcblx0XHRcdGxldCAkcm93ID0gcm93Tm9kZS4kbm9kZTtcclxuXHRcdFx0bGV0IGkgID0gKyRyb3cuYXR0cigncmlkJyk7XHJcblx0XHRcdFxyXG5cdFx0XHRpZiAoaSA+PSB5MCAmJiBpIDwgeTEgKyAxKSB7XHJcblx0XHRcdFx0Y29scy5mb3JFYWNoKChjb2wpID0+IHtcclxuXHRcdFx0XHRcdHJvd05vZGUuY2hpbGRyZW4uZm9yRWFjaCgoJGNlbGwsIGNvbE0pID0+IHtcclxuXHRcdFx0XHRcdFx0aWYgKGNvbHMuaW5kZXhPZihjb2xNLmRhdGFJbmRleCkgIT0gLTEpIHtcclxuXHRcdFx0XHRcdFx0XHQkY2VsbC5hZGRDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0JGNlbGwucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpXHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoeURpciA+PSAwICYmIGkgPiByZW1vdmVZUmFuZ2VbMF0gJiYgaSA8PXJlbW92ZVlSYW5nZVsxXSApIHtcclxuXHRcdFx0XHQkcm93LmZpbmQoQ0VMTF9DTFMpLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoeURpciA8PSAwICYmIGkgPj0gcmVtb3ZlWVJhbmdlWzBdICYmIGkgPHJlbW92ZVlSYW5nZVsxXSApIHtcclxuXHRcdFx0XHQkcm93LmZpbmQoQ0VMTF9DTFMpLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0LypcclxuXHQgKiBsb2NrICsgdmlzaWFibGUgPSBjb2x1bW5zXHJcblx0ICogQHBhcmFtIHtBcnJheX0gY29sdW1ucyAtW2RhdGFJbmRleC4uLl1cclxuXHQgKi9cclxuXHRnZXRMb2NrQW5kVmlzaWFibGVDb2x1bW5Bc0RhdGFJbmRleCgpIHtcclxuXHRcdGxldCBjb2xzID0gW107XHJcblxyXG5cdFx0dGhpcy5sb2NrQ29sTWFuYWdlclxyXG5cdFx0XHQudmlzaWJsZUxvY2tDb2x1bW5cclxuXHRcdFx0LmVhY2goY29sTSA9PiBjb2xzLnVuc2hpZnQoY29sTS5kYXRhSW5kZXgpKTtcclxuXHJcblx0XHRsZXQgdmlzaWFibGVDb2xzID0gdGhpcy5jb2x1bW5Nb2RlbFxyXG5cdFx0XHQuZ2V0VmlzaWJsZUNvbHVtbigpXHJcblx0XHRcdC5tYXAoY29sTSA9PiBjb2xNLmRhdGFJbmRleClcclxuXHRcdFx0LmZpbHRlcihkYXRhSW5kZXggPT4gY29scy5pbmRleE9mKGRhdGFJbmRleCkgPT0gLTEpO1xyXG5cclxuXHRcdHJldHVybiBjb2xzLmNvbmNhdCh2aXNpYWJsZUNvbHMpO1xyXG5cdH1cclxuXHJcbn1cclxuXHJcblxyXG5mdW5jdGlvbiBzd2FwKGEsIGIpIHtcclxuXHRyZXR1cm4gW2IsIGFdO1xyXG59XHJcblxyXG5mdW5jdGlvbiBvcmRlckJ5KHgwLCB5MCwgeDEsIHkxLCBkYXRhSW5kZXgpIHtcclxuXHRpZiAoZGF0YUluZGV4LmluZGV4T2YoeDApID4gZGF0YUluZGV4LmluZGV4T2YoeDEpKSB7XHJcblx0XHRbeDAsIHgxXSA9IHN3YXAoeDAsIHgxKTtcclxuXHR9XHJcblx0aWYgKHkwID4geTEpIHtcclxuXHRcdFt5MCwgeTFdID0gc3dhcCh5MCwgeTEpO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIFt4MCwgeTAsIHgxLCB5MV07XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU2VsZWN0aW9uOyIsIid1c2Ugc3RyaWN0JztcclxuY29uc3QgJCA9IHJlcXVpcmUoJy4uL3V0aWwvc2hpbScpLiQ7XHJcblxyXG5jb25zdCBGTEVYTUlOV0lEVEggPSAzNTtcclxuXHJcbnZhciBkcmFnRHJvcCA9IGZ1bmN0aW9uKGV2dCAsb3B0cykge1xyXG5cdHZhciBkb2MgPSAkKGRvY3VtZW50KTtcclxuXHR2YXIgc2Nyb2xsTGVmdCA9IGRvY3VtZW50LmJvZHkuc2Nyb2xsTGVmdCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsTGVmdDtcclxuXHR2YXIgc2Nyb2xsVG9wID0gZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcDtcclxuXHR2YXIgbGVmdE9mZnNldCA9ICQoZXZ0LnRhcmdldCkub2Zmc2V0KCkubGVmdCAtIHNjcm9sbExlZnQ7XHJcblx0dmFyIGlYLCBpWSwgc3RhcnRYLCBlbmRYO1xyXG5cdHZhciBkcmFnZ2luZyA9IHRydWU7XHJcblxyXG5cdHN0YXJ0WCA9IGlYID0gZXZ0LmNsaWVudFggLSBzY3JvbGxMZWZ0O1xyXG5cdGlZID0gJChldnQudGFyZ2V0KS5vZmZzZXQoKS50b3AgLSBzY3JvbGxUb3A7XHJcblxyXG5cdG9wdHMub25EcmFnU3RhcnQoeyAneCc6IHN0YXJ0WCB9LCBvcHRzLiRlbGVtZW50KTtcclxuXHJcblx0ZG9jLm9uKCdtb3VzZW1vdmUuZHJhZ2Ryb3AnLCAkLnByb3h5KG1vdXNlbW92ZSwgdGhpcykpO1xyXG5cdGRvYy5vbignbW91c2V1cC5kcmFnZHJvcCcsICQucHJveHkobW91c2V1cCwgdGhpcykpO1xyXG5cdC8vICQoZXZ0LnRhcmdldClbMF0uc2V0Q2FwdHVyZSAmJiAkKGV2dC50YXJnZXQpWzBdLnNldENhcHR1cmUoKTtcclxuXHJcblx0ZnVuY3Rpb24gbW91c2Vtb3ZlKGUpIHtcclxuXHRcdGlmIChkcmFnZ2luZykge1xyXG5cdFx0XHRlbmRYID0gZS5jbGllbnRYIC0gc2Nyb2xsTGVmdDtcclxuXHJcblx0XHRcdC8vIGxpbWl0XHJcblx0XHRcdGlmIChlbmRYIC0gbGVmdE9mZnNldCA8IEZMRVhNSU5XSURUSCkge1xyXG5cdFx0XHRcdGVuZFggPSBsZWZ0T2Zmc2V0ICsgRkxFWE1JTldJRFRIO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRvcHRzLm9uRHJhZ2dpbmcoIHsgJ3gnOiBlbmRYIH0sIG9wdHMuJGVsZW1lbnQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBtb3VzZXVwKGV2dCkge1xyXG5cdFx0dmFyIGUgPSBldnQudGFyZ2V0O1xyXG5cdFx0ZHJhZ2dpbmcgPSBmYWxzZTtcclxuXHJcblx0XHRvcHRzLm9uRHJhZ0VuZCh7ICd4JzogZXZ0LmNsaWVudFggLSBzY3JvbGxMZWZ0IH0sIG9wdHMuJGVsZW1lbnQpO1xyXG5cclxuXHRcdGlmIChlICYmIGUuc2V0Q2FwdHVyZSkge1xyXG5cdFx0XHRlLnJlbGVhc2VDYXB0dXJlKCk7XHJcblx0XHR9IGVsc2UgaWYgKHdpbmRvdy5yZWxlYXNlQ2FwdHVyZSkge1xyXG5cdFx0XHR3aW5kb3cucmVsZWFzZUNhcHR1cmUoRXZlbnQuTU9VU0VNT1ZFIHwgRXZlbnQuTU9VU0VVUCk7XHJcblx0XHR9XHJcblxyXG5cdFx0ZG9jLm9mZignbW91c2Vtb3ZlLmRyYWdkcm9wJywgbW91c2Vtb3ZlKTtcclxuXHRcdGRvYy5vZmYoJ21vdXNldXAuZHJhZ2Ryb3AnLCBtb3VzZXVwKTtcclxuXHR9XHJcblxyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFyZ2V0LCBvcHRpb25zKSB7XHJcblx0dmFyIGRlZmF1bHRzID0ge1xyXG5cdFx0cmVzdHJpY3RlcihldnQpIHsgcmV0dXJuIG51bGw7IH0sXHJcblx0XHRvbkRyYWdTdGFydChvZmZzZXQsIHRhcmdldCkge30sXHJcblx0XHRvbkRyYWdnaW5nKG9mZnNldCwgdGFyZ2V0KSB7fSxcclxuXHRcdG9uRHJhZ0VuZChvZmZzZXQsIHRhcmdldCkge31cclxuXHR9O1xyXG5cclxuXHRPYmplY3QuYXNzaWduKGRlZmF1bHRzLCBvcHRpb25zKTtcclxuXHJcblx0JCh0YXJnZXQpLm9uKCdtb3VzZWRvd24nLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdHZhciByZXN0cmljdGVyID0gZGVmYXVsdHMucmVzdHJpY3RlcihldnQpO1xyXG5cclxuXHRcdGlmIChyZXN0cmljdGVyKSB7XHJcblx0XHRcdGRlZmF1bHRzLiRlbGVtZW50ID0gZGVmYXVsdHMucmVzdHJpY3RlcihldnQpIHx8ICQoZXZ0LnRhcmdldCk7XHJcblx0XHRcdGRyYWdEcm9wKGV2dCwgZGVmYXVsdHMpO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG59OyIsIi8qKlxyXG4gKiDkuovku7bnrqHnkIZcclxuICogQGNsYXNzIEV2ZW50RW1pdHRlclxyXG4gKi9cclxuXHJcbmZ1bmN0aW9uIGluZGV4T2ZMaXN0ZW5lcihsaXN0ZW5lcnMsIGxpc3RlbmVyKSB7XHJcblx0dmFyIGkgPSBsaXN0ZW5lcnMubGVuZ3RoO1xyXG5cdHdoaWxlIChpLS0pIHtcclxuXHRcdGlmIChsaXN0ZW5lcnNbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSB7XHJcblx0XHRcdHJldHVybiBpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRyZXR1cm4gLTE7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGlzVmFsaWRMaXN0ZW5lcihsaXN0ZW5lcikge1xyXG5cdGlmICh0eXBlb2YgbGlzdGVuZXIgPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH0gZWxzZSBpZiAobGlzdGVuZXIgJiYgdHlwZW9mIGxpc3RlbmVyID09PSAnb2JqZWN0Jykge1xyXG5cdFx0cmV0dXJuIGlzVmFsaWRMaXN0ZW5lcihsaXN0ZW5lci5saXN0ZW5lcik7XHJcblx0fSBlbHNlIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcbn1cclxuXHJcbmNsYXNzIEV2ZW50RW1pdHRlciB7XHJcblxyXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcclxuXHJcblx0fVxyXG5cdC8qKlxyXG5cdCpcclxuXHQqXHJcblx0KlxyXG5cdCpcclxuXHQqL1xyXG5cdF9nZXRFdmVudHMoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fZXZlbnRzIHx8ICh0aGlzLl9ldmVudHMgPSB7fSk7XHJcblx0fVxyXG5cdC8qKlxyXG5cdCog6YCa6L+H5LqL5Lu25ZCN6I635Y+WbGlzdGVuZXIg5pWw57uE5oiW5Yid5aeL5YyWXHJcblx0KiDkvb/nlKjmraPliJnljLnphY3kvJrov5Tlm57kuIDkuKrlr7nlupTnmoTlr7nosaFcclxuXHQqXHJcblx0KiBcclxuXHQqIGdldExpc3RlbmVyc1xyXG5cdCogQHBhcmFtIHtTdHJpbmcgfSBSZWdFeHB9IGV2ZW50TmFtZVxyXG5cdCogQHJldHVybiB7RnVuY3RvbltdIHwgT2JqZWN0fVxyXG5cdCpcclxuXHQqL1xyXG5cdGdldExpc3RlbmVycyhuYW1lKSB7XHJcblx0XHR2YXIgZXZlbnRzID0gdGhpcy5fZ2V0RXZlbnRzKCk7XHJcblx0XHR2YXIgcmVzcG9uc2U7XHJcblx0XHR2YXIga2V5O1xyXG5cclxuXHRcdGlmIChuYW1lIGluc3RhbmNlb2YgUmVnRXhwKSB7XHJcblx0XHRcdHJlc3BvbnNlID0ge307XHJcblx0XHRcdGZvciAoa2V5IGluIGV2ZW50cykge1xyXG5cdFx0XHRcdGlmIChldmVudHMuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBuYW1lLnRlc3Qoa2V5KSkge1xyXG5cdFx0XHRcdFx0cmVzcG9uc2Vba2V5XSA9IGV2ZW50c1trZXldO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cmVzcG9uc2UgPSBldmVudHNbbmFtZV0gfHwgKGV2ZW50c1tuYW1lXSA9IFtdKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcmVzcG9uc2U7XHJcblx0fVxyXG5cdC8qKlxyXG5cdCog6YCa6L+H5LqL5Lu25ZCN6I635Y+WbGlzdGVuZXIg5aeL57uI6L+U5Zue5LiA5Liq5a+56LGhXHJcblx0KlxyXG5cdCogXHJcblx0KiBnZXRMaXN0ZW5lcnNBc09iamVjdFxyXG5cdCogQHBhcmFtIHtTdHJpbmd8UmVnRXhwfSBldmVudE5hbWVcclxuXHQqIEByZXR1cm4ge09iamVjdH1cclxuXHQqL1xyXG5cdGdldExpc3RlbmVyc0FzT2JqZWN0KG5hbWUpIHtcclxuXHRcdHZhciBsaXN0ZW5lcnMgPSB0aGlzLmdldExpc3RlbmVycyhuYW1lKTtcclxuXHRcdHZhciByZXNwb25zZTtcclxuXHJcblx0XHRpZiAobGlzdGVuZXJzIGluc3RhbmNlb2YgQXJyYXkpIHtcclxuXHRcdFx0cmVzcG9uc2UgPSB7fTtcclxuXHRcdFx0cmVzcG9uc2VbbmFtZV0gPSBsaXN0ZW5lcnM7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHJlc3BvbnNlIHx8IGxpc3RlbmVycztcclxuXHR9XHJcblx0LyoqXHJcblx0KiDojrflj5YgbGlzdGVuZXIg5YiX6KGoXHJcblx0KlxyXG5cdCogZmxhdHRlbkxpc3RlbmVyc1xyXG5cdCpcclxuXHQqIEBwYXJhbSB7IE9iamVjdFtdfSBsaXN0ZW5lcnNcclxuXHQqIEByZXR1cm4ge0Z1bmN0aW9uW119XHJcblx0Ki9cclxuXHRmbGF0dGVuTGlzdGVuZXJzKGxpc3RlbmVycykge1xyXG5cdFx0dmFyIGZsYXRMaXN0ZW5lcnMgPSBbXTtcclxuXHJcblx0XHRmb3IgKHZhciBpID0gMCwgbCA9IGxpc3RlbmVyLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG5cdFx0XHRmbGF0TGlzdGVuZXJzLnB1c2gobGlzdGVuZXJzW2ldLmxpc3RlbmVyKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmxhdExpc3RlbmVycztcclxuXHR9XHJcblx0LyoqXHJcblx0KiDkuovku7bms6jlhoxcclxuXHQqXHJcblx0KlxyXG5cdCogQGV4YW1wZWxcclxuXHQqIHZhciBlbXQgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XHJcblx0KiBlbXQuYWRkTGlzdGVuZXIoJ2Rpdjpob3ZlcicsIGZ1bmN0aW9uKCl7XHJcblx0Klx0Ly8gZG9cclxuXHQqIH0pO1xyXG5cdCogQHBhcmFtIHtzdHJpbmd9IGV2ZW50TmFtZVxyXG5cdCogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXJcclxuXHQqIEByZXR1cm4ge09iamVjdGp9XHJcblx0KlxyXG5cdCovXHJcblx0YWRkTGlzdGVuZXIobmFtZSwgbGlzdGVuZXIsIGZsYWcpIHtcclxuXHRcdGlmICghaXNWYWxpZExpc3RlbmVyKGxpc3RlbmVyKSkge1xyXG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgbGlzdGVuZXJzID0gdGhpcy5nZXRMaXN0ZW5lcnNBc09iamVjdChuYW1lKTtcclxuXHRcdHZhciBsaXN0ZW5lcklzV3JhcHBlZCA9IHR5cGVvZiBsaXN0ZW5lciA9PT0gJ29iamVjdCc7XHJcblx0XHR2YXIga2V5LCBzdGFydCwgYXJncztcclxuXHJcblx0XHRmb3IgKGtleSBpbiBsaXN0ZW5lcnMpIHtcclxuXHRcdFx0aWYgKGxpc3RlbmVycy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIGluZGV4T2ZMaXN0ZW5lcihsaXN0ZW5lcnMsIGxpc3RlbmVyKSA9PT0gLTEpIHtcclxuXHJcblx0XHRcdFx0c3RhcnQgPSBsaXN0ZW5lcnNba2V5XS5sZW5ndGg7XHJcblxyXG5cdFx0XHRcdGxpc3RlbmVyc1trZXldLnB1c2gobGlzdGVuZXJJc1dyYXBwZWQgPyBsaXN0ZW5lciA6IHtcclxuXHRcdFx0XHRcdGxpc3RlbmVyOiBsaXN0ZW5lcixcclxuXHRcdFx0XHRcdG9uY2U6IGZhbHNlXHJcblx0XHRcdFx0fSk7XHJcblxyXG5cdFx0XHRcdGlmIChmbGFnICYmIGxpc3RlbmVyc1trZXldLmFyZ3MpIHtcclxuXHRcdFx0XHRcdGxpc3RlbmVyc1trZXldLnN0YXJ0ID0gc3RhcnQ7XHJcblx0XHRcdFx0XHRhcmdzID0gbGlzdGVuZXJzW2tleV0uYXJncztcclxuXHRcdFx0XHRcdHRoaXMuZW1pdEV2ZW50KG5hbWUsIGFyZ3MpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0b24oKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5hZGRMaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHJcblx0b25lKG5hbWUsIGxpc3RlbmVyLCBmbGFnKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yZW1vdmVFdmVudChuYW1lKS5hZGRMaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICog5LqL5Lu25rOo5YaM77yM6Kem5Y+R5ZCO6Ieq5Yqo56e76ZmkXHJcblx0ICpcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWVcclxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxyXG5cdCAqIEByZXV0bnIge09iamVjdH1cclxuXHQgKlxyXG5cdCAqL1xyXG5cdGFkZE9uY2VMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lcikge1xyXG5cdFx0cmV0dXJuIHRoaXMuYWRkTGlzdGVuZXIobmFtZSwge1xyXG5cdFx0XHRsaXN0ZW5lcjogbGlzdGVuZXIsXHJcblx0XHRcdG9uY2U6IHRydWVcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0b25jZSgpIHtcclxuXHRcdHJldHVybiB0aGlzLmFkZE9uY2VMaXN0ZW5lci5hcHBseSh0aGlzLmFyZ3VtZW50cyk7XHJcblx0fVxyXG5cdC8qKlxyXG5cdCAqIOS6i+S7tumUgOavgVxyXG5cdCAqXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lXHJcblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXJcclxuXHQgKiBAcmV0dXJuIHtPYmplY3R9XHJcblx0ICpcclxuXHQgKi9cclxuXHRyZW1vdmVMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lcikge1xyXG5cdFx0dmFyIGxpc3RlbmVycyA9IHRoaXMuZ2V0TGlzdGVuZXJzQXNPYmplY3QobmFtZSk7XHJcblx0XHR2YXIgaW5kZXg7XHJcblx0XHR2YXIga2V5O1xyXG5cclxuXHRcdGZvciAoa2V5IGluIGxpc3RlbmVycykge1xyXG5cdFx0XHRpZiAobGlzdGVuZXJzLmhhc093blByb3BlcnR5KGtleSkpIHtcclxuXHRcdFx0XHRpbmRleCA9IGluZGV4T2ZMaXN0ZW5lcihsaXN0ZW5lcnNba2V5XSwgbGlzdGVuZXIpO1xyXG5cclxuXHRcdFx0XHRpZiAoaW5kZXggIT09IC0xKSB7XHJcblx0XHRcdFx0XHRsaXN0ZW5lcnNba2V5XS5zcGxpY2UoaW5kZXgsIGkpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0b2ZmKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMucmVtb3ZlTGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuXHR9XHJcblxyXG5cdG1hbmlwdWxhdGVMaXN0ZW5lcnMocmVtb3ZlLCBuYW1lLCBsaXN0ZW5lcnMpIHtcclxuXHRcdHZhciBzaW5nbGUgPSByZW1vdmUgPyB0aGlzLnJlbW92ZUxpc3RlbmVyIDogdGhpcy5hZGRMaXN0ZW5lcjtcclxuXHRcdHZhciBtdXRpcGxlID0gcmVtb3ZlID8gdGhpcy5yZW1vdmVMaXN0ZW5lcnMgOiB0aGlzLmFkZExpc3RlbmVycztcclxuXHRcdHZhciBpO1xyXG5cdFx0dmFyIHY7XHJcblxyXG5cdFx0aWYgKHR5cGVvZiBuYW1lID09PSAnb2JqZWN0JyAmJiAhKG5hbWUgaW5zdGFuY2VvZiBSZWdFeHApKSB7XHJcblx0XHRcdGZvciAoaSBpbiBuYW1lKSB7XHJcblx0XHRcdFx0aWYgKG5hbWUuaGFzT3duUHJvcGVydHkoaSkgJiYgKHYgPSBuYW1lW2ldKSkge1xyXG5cdFx0XHRcdFx0aWYgKHR5cGVvZiB2ID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHRcdFx0XHRcdHNpbmdsZS5jYWxsKHRoaXMsIGksIHYpO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0bXV0aXBsZS5jYWxsKHRoaXMsIGksIHYpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0aSA9IDA7XHJcblx0XHRcdHYgPSBsaXN0ZW5lcnMubGVuZ3RoO1xyXG5cdFx0XHR3aGlsZSAoaSA8IHYpIHtcclxuXHRcdFx0XHRzaW5nbGUuY2FsbCh0aGlzLCBuYW1lLCBsaXN0ZW5lcnNbaSsrXSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdGFkZExpc3RlbmVycyhuYW1lLCBsaXN0ZW5lcnMpIHtcclxuXHRcdHJldHVybiB0aGlzLm1hbmlwdWxhdGVMaXN0ZW5lcnMoZmFsc2UsIG5hbWUsIGxpc3RlbmVycyk7XHJcblx0fVxyXG5cclxuXHRyZW1vdmVMaXN0ZW5lcnMobmFtZSwgbGlzdGVuZXJzKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5tYW5pcHVsYXRlTGlzdGVuZXJzKHRydWUsIG5hbWUsIGxpc3RlbmVycyk7XHJcblx0fVxyXG5cclxuXHRyZW1vdmVFdmVudChuYW1lKSB7XHJcblx0XHR2YXIgZXZlbnRzID0gdGhpcy5fZ2V0RXZlbnRzKCk7XHJcblx0XHR2YXIga2V5O1xyXG5cclxuXHRcdGlmICh0eXBlb2YgbmFtZSA9PT0gJ3N0cmluZycpIHtcclxuXHRcdFx0Ly8g56e76Zmk5omA5pyJ5oyH5a6a5LqL5Lu25ZCN55qE5omA5pyJbGlzdGVuZXJzXHJcblx0XHRcdC8vIGRlbGV0ZSBldmVudHNbbmFtZV1cclxuXHRcdFx0aWYgKGV2ZW50c1tuYW1lXSBpbnN0YW5jZW9mIEFycmF5KSB7XHJcblx0XHRcdFx0ZXZlbnRzW25hbWVdLmxlbmd0aCA9IDA7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSBpZiAobmFtZSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xyXG5cdFx0XHQvLyDmraPliJnljLnphY3nmoTmiYDmnIkgbGlzdGVuZXJzXHJcblx0XHRcdGZvciAoa2V5IGluIGV2ZW50cykge1xyXG5cdFx0XHRcdGlmIChldmVudHMuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBuYW1lLnRlc3Qoa2V5KSkge1xyXG5cdFx0XHRcdFx0Ly8gZGVsZXRlIGV2ZW50c1trZXldXHJcblx0XHRcdFx0XHRpZiAoZXZlbnRzW2tleV0gaW5zdGFuY2VvZiBBcnJheSkge1xyXG5cdFx0XHRcdFx0XHRldmVudFtrZXldLmxlbmd0aCA9IDA7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQvLyDnp7vpmaTmiYDmnIkgbGlzdGVuZXJzXHJcblx0XHRcdGRlbGV0ZSB0aGlzLl9ldmVudHM7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRyZW1vdmVBbGxMaXN0ZW5lcnMoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yZW1vdmVFdmVudC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHQvKipcclxuXHQgKiDkuovku7bop6blj5FcclxuXHQgKlxyXG5cdCAqXHJcblx0ICogQGV4YW1wbGVcclxuXHQgKiB2YXIgZW10ID0gbmV3IEV2ZW50RW1pdHRlcigpO1xyXG5cdCAqIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcblx0ICogXHRlbXQuZW1pdEV2ZW50KCdkaXY6aG92ZXInLCAxKTtcclxuXHQgKiB9LCAxMDAwKTtcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWUg5LqL5Lu25ZCN56ewXHJcblx0ICogQHBhcmFtIHtBcnJheX0gW2FyZ3NdIEhUTUxEb2N1bWVudCwgaXRlbURhdGEsIC4uLlxyXG5cdCAqIEByZXR1cm4ge09iamVjdH1cclxuXHQgKlxyXG5cdCAqL1xyXG5cdGVtaXRFdmVudChuYW1lLCBhcmdzKSB7XHJcblx0XHR2YXIgbGlzdGVuZXJzTWFwID0gdGhpcy5nZXRMaXN0ZW5lcnNBc09iamVjdChuYW1lKTtcclxuXHRcdHZhciBsaXN0ZW5lcnM7XHJcblx0XHR2YXIgbGlzdGVuZXI7XHJcblx0XHR2YXIgaTtcclxuXHRcdHZhciBsO1xyXG5cdFx0dmFyIGtleTtcclxuXHRcdHZhciByZXNwb25zZTtcclxuXHJcblx0XHRmb3IgKGtleSBpbiBsaXN0ZW5lcnNNYXApIHtcclxuXHRcdFx0aWYgKGxpc3RlbmVyc01hcC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XHJcblx0XHRcdFx0bGlzdGVuZXJzID0gbGlzdGVuZXJzTWFwW2tleV0uc2xpY2UoMCk7XHJcblxyXG5cdFx0XHRcdGxpc3RlbmVyc01hcFtrZXldLmFyZ3MgPSBhcmdzO1xyXG5cclxuXHRcdFx0XHRpID0gbGlzdGVuZXJzTWFwW2tleV0uc3RhcnQgfHwgMDtcclxuXHRcdFx0XHRsaXN0ZW5lcnNNYXBba2V5XS5zdGFydCA9IDA7XHJcblxyXG5cdFx0XHRcdGZvciAobCA9IGxpc3RlbmVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuXHRcdFx0XHRcdGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldO1xyXG5cclxuXHRcdFx0XHRcdGlmIChsaXN0ZW5lci5vbmNlID09PSB0cnVlKSB7XHJcblx0XHRcdFx0XHRcdHRoaXMucmVtb3ZlTGlzdGVuZXIobmFtZSwgbGlzdGVuZXIubGlzdGVuZXIpO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHJlc3BvbnNlID0gbGlzdGVuZXIubGlzdGVuZXIuYXBwbHkodGhpcywgYXJncyB8fCBbXSk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKHJlc3BvbnNlID09PSB0aGlzLl9nZXRPbmNlUmV0dXJuVmFsdWUoKSkge1xyXG5cdFx0XHRcdFx0XHR0aGlzLnJlbW92ZUxpc3RlbmVyKG5hbWUsIGxpc3RlbmVyLmxpc3RlbmVyKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0dHJpZ2dlcigpIHtcclxuXHRcdHJldHVybiB0aGlzLmVtaXRFdmVudC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHJcblx0ZmlyZShuYW1lKSB7XHJcblx0XHR2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XHJcblx0XHRyZXR1cm4gdGhpcy5lbWl0RXZlbnQobmFtZSwgYXJncyk7XHJcblx0fVxyXG5cclxuXHRfZ2V0T25jZVJldHVyblZhbHVlKCkge1xyXG5cdFx0aWYgKHRoaXMuaGFzT3duUHJvcGVydHkoJ19vbmNlUmV0dXJuVmFsdWUnKSkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5fb25jZVJldHVyblZhbHVlO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHRzZXRPbmNlUmV0dXJuVmFsdWUodmFsdWUpIHtcclxuXHRcdHRoaXMuX29uY2VSZXR1cm5WYWx1ZSA9IHZhbHVlO1xyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRkZWZpbmVFdmVudChuYW1lKSB7XHJcblx0XHR0aGlzLmdldExpc3RlbmVycyhuYW1lKTtcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0ZGVmaW5lRXZlbnRzKG5hbWVzKSB7XHJcblx0XHRmb3IgKHZhciBpID0gMCwgbCA9IG5hbWVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG5cdFx0XHR0aGlzLmRlZmluZUV2ZW50KG5hbWVbaV0pO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XHJcblxyXG5cclxuIiwiZnVuY3Rpb24gc3dhcChhcnIsIHMxLCBzMikge1xyXG5cdHZhciB0ZW1wID0gYXJyW3MxXTtcclxuXHRhcnJbczFdID0gYXJyW3MyXTtcclxuXHRhcnJbczJdID0gdGVtcDtcclxufVxyXG5cclxuZnVuY3Rpb24gcmFuZG9tVmFsdWUoYXJyKSB7XHJcblx0dmFyIHIgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBhcnIubGVuZ3RoKTtcclxuXHQvLyBzd2FwKGFyciwgMCwgcik7XHJcblx0cmV0dXJuIFthcnJbcl0sIGFyci5maWx0ZXIoKGQsIGkpID0+IGkgIT09IHIpXTtcclxufVxyXG5cclxuZnVuY3Rpb24gZmlsdGVyTEFuZFIoYXJyLCBzZWxlY3QsIGNvbXBhcmVGbikge1xyXG5cdHZhciBsZWZ0QXJyID0gW107XHJcblx0dmFyIHJpZ2h0QXJyID0gW107XHJcblxyXG5cdGZvciAodmFyIGkgPSAwLCBsZW4gPSBhcnIubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHRcdGxldCB0ZW1wID0gYXJyW2ldO1xyXG5cdFx0bGV0IGNvbXBhcmVkID0gY29tcGFyZUZuKHNlbGVjdCwgdGVtcCk7XHJcblx0XHRpZiAoY29tcGFyZWQgPiAwKSByaWdodEFyci5wdXNoKHRlbXApO1xyXG5cdFx0ZWxzZSBpZiAoY29tcGFyZWQgPCAwKSBsZWZ0QXJyLnB1c2godGVtcCk7XHJcblx0XHRlbHNlIE1hdGgucmFuZG9tKCkgPiAwLjUgPyByaWdodEFyci5wdXNoKHRlbXApIDogbGVmdEFyci5wdXNoKHRlbXApO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIFtsZWZ0QXJyLCByaWdodEFycl07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZpbmRJbmRleChhcnIsIGluZGV4LCBjb21wYXJlRm4pIHtcclxuXHRpZiAoYXJyLmxlbmd0aCA8PSAxIHx8IGluZGV4ID09PSAwKSByZXR1cm4gYXJyWzBdO1xyXG5cdHZhciBbc2VsZWN0LCBzZWNfYXJyXSA9IHJhbmRvbVZhbHVlKGFycik7XHJcblx0dmFyIFtsZWZ0QXJyLCByaWdodEFycl0gPSBmaWx0ZXJMQW5kUihzZWNfYXJyLCBzZWxlY3QsIGNvbXBhcmVGbik7XHJcblx0dmFyIG4gPSByaWdodEFyci5sZW5ndGg7XHJcblxyXG5cdGlmIChuID09PSBpbmRleCAtIDEpIHJldHVybiBzZWxlY3Q7XHJcblx0aWYgKG4gPj0gaW5kZXgpIHJldHVybiBmaW5kSW5kZXgocmlnaHRBcnIsIGluZGV4LCBjb21wYXJlRm4pO1xyXG5cdGVsc2UgcmV0dXJuIGZpbmRJbmRleChsZWZ0QXJyLCBpbmRleCAtIG4gLSAxLCBjb21wYXJlRm4pO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZpbmRJbmRleDsiLCJ2YXIgVXRpbHMgPSB7fTtcclxuXHJcbnZhciB1aWQgPSBVdGlscy51aWQgPSAoKCkgPT4ge1xyXG5cdGxldCB0ID0gRGF0ZS5ub3coKTtcclxuXHRyZXR1cm4gKCkgPT4ge1xyXG5cdFx0cmV0dXJuICh0KyspLnRvU3RyaW5nKDE2KTtcclxuXHR9O1xyXG59KSgpO1xyXG5cclxuXHJcbnZhciBtZXJnZSA9IFV0aWxzLm1lcmdlID0gKHRhcmdldCwgYWRkaXRpb25hbCwgZGVlcCkgPT4ge1xyXG5cdGxldCBkZXB0aCA9IHR5cGVvZiBkZWVwID09ICd1bmRlZmluZWQnID8gMiA6IGRlZXAsIHByb3A7XHJcblxyXG5cdGZvciAocHJvcCBpbiBhZGRpdGlvbmFsKSB7XHJcblx0XHRpZiAoYWRkaXRpb25hbC5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xyXG5cdFx0XHRpZiAodHlwZW9mIHRhcmdldFtwcm9wXSAhPT0gJ29iamVjdCcgfHwgIWRlcHRoKSB7XHJcblx0XHRcdFx0dGFyZ2V0W3Byb3BdID0gYWRkaXRpb25hbFtwcm9wXTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRVdGlscy5tZXJnZSh0YXJnZXRbcHJvcF0sIGFkZGl0aW9uYWxbcHJvcF0sIGRlcHRoIC0gMSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiB0YXJnZXQ7XHJcbn07XHJcblxyXG52YXIgZmluZEluZGV4ID0gVXRpbHMuZmluZEluZGV4ID0gcmVxdWlyZSgnLi9GaW5kSW5kZXgnKTtcclxudmFyIGNvbXBhcmVGbiA9IFV0aWxzLmNvbXBhcmVGbiA9IHJlcXVpcmUoJy4vdXRpbHMvQ29tcGFyZXInKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gVXRpbHM7IiwidmFyIGNvbnRleHQgPSB0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJyA/IHRoaXMgOiB3aW5kb3c7XHJcbmV4cG9ydHMuJCA9IGNvbnRleHQuJDtcclxuZXhwb3J0cy5fID0gY29udGV4dC5fOyIsIi8qKlxyXG4gKiDliJvlu7rmr5TovoPlh73mlbBcclxuICogQHN1bW1hcnkg57qm5p2f5p2h5Lu277yM5Y+q6ZKI5a+55a+56LGh5pWw57uE57uT5p6E55qE5pWw5o2u77yM5aaCXHJcbiAqICAgICAgW3tcImNvbF8xXCI6IDEwLCBcImNvbF8yXCI6IDM1LCBcImNvbF8zXCI6IDY2fSwgLi4uXVxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiAgdmFyIHNvcnRzID0gWydBJywnQicsJ0MnLCdEJ107XHJcbiAqICB2YXIgZGlycyA9IFsxLCAtMSwgMSwgMV07XHJcbiAqXHJcbiAqICB2YXIgZGF0YTMgPSBbXHJcbiAqICAgICAge0E6MSxCOjEsQzo1LF9pZDoxfSxcclxuICogICAgICB7QToxLEI6MyxDOjUsX2lkOjF9LFxyXG4gKiAgICAgIHtBOjIsQjo1LEM6NCxfaWQ6Mn0sXHJcbiAqICAgICAge0E6MSxCOjEsQzo5LF9pZDoxfSxcclxuICogICAgICB7QTozLEI6MyxDOjMsX2lkOjN9LFxyXG4gKiAgICAgIHtBOjEsQjoxLEM6MyxfaWQ6MX0sXHJcbiAqICAgICAge0E6NCxCOjIsQzoyLF9pZDo0fSxcclxuICogICAgICB7QTo1LEI6NCxDOjEsX2lkOjV9LFxyXG4gKiAgXTtcclxuICpcclxuICogIHZhciBmbiA9IGNvbXBhcmVGbihzb3J0cywgZGlycyk7XHJcbiAqICB2YXIgcmV0ID0gZGF0YTMuc29ydChmbikubWFwKGQgPT4gT2JqZWN0LnZhbHVlcyhkKSk7XHJcbiAqICBjb25zb2xlLmRpcihyZXQpO1xyXG4gKlxyXG4gKiBAcGFyYW0ge0FycmF5fSBzb3J0cyAt5o6S5bqP5a2X5q615pWw57uEIFsnY29sXzEnLCAnY29sXzInLCAnY29sXzMnLC4uLl1cclxuICogQHBhcmFtIHtBcnJheX0gZGlycyAt5a+55bqU5a2X5L2T5o6S5bqP5pWw57uE55qE5Y2H6ZmN5bqPLDHvvJrljYfluo8gLTHvvJrpmY3luo8gWzEsIC0xXVxyXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IOavlOi+g+WHveaVsFxyXG4gKi9cclxuZXhwb3J0cy5jb21wYXJlRm4gPSBmdW5jdGlvbiBjb21wYXJlRm4oc29ydHMsIGRpcnMpIHtcclxuICAgIHZhciBjb25kaXRpb25zID0gc29ydHMucmVkdWNlKChwcmUsIG5leHQsIGkpID0+IHtcclxuICAgICAgICBwcmUgID0gcHJlID8gcHJlICsgJyB8fCcgOiAnJztcclxuICAgICAgICByZXR1cm4gYCR7cHJlfSAoYS4ke25leHR9IC0gYi4ke25leHR9KSAqICR7ZGlyc1tpXX1gO1xyXG4gICAgfSwgJycpO1xyXG5cclxuICAgIHZhciBmdW5jdGlvbl9ib2R5ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgbGV0IHNvcnRJbmZvID0gc29ydHMuam9pbignLCcpLnJlcGxhY2UoLyhcXHcrKS9nLCAnXCIkMVwiJyk7XHJcbiAgICAgICAgcmV0dXJuIGB2YXIgc29ydCA9IFske3NvcnRJbmZvfV07IHJldHVybiAke2NvbmRpdGlvbnN9YDtcclxuICAgIH1cclxuICAgIC8vIGNvbnNvbGUubG9nKGZ1bmN0aW9uX2JvZHkoKSk7XHJcbiAgICBcclxuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oJ2EnLCAnYicsIGZ1bmN0aW9uX2JvZHkoKSk7XHJcbn1cclxuXHJcblxyXG4iXX0=
