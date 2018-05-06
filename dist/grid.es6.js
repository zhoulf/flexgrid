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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY29yZS9CdWZmZXJOb2RlLmpzIiwic3JjL2NvcmUvQnVmZmVyWm9uZS5qcyIsInNyYy9jb3JlL0NvbE1vZGVsLmpzIiwic3JjL2NvcmUvR3JpZFN0b3JlLmpzIiwic3JjL2NvcmUvR3JpZFZpZXcuanMiLCJzcmMvY29yZS9IZWFkZXIuanMiLCJzcmMvY29yZS9Mb2NrQ29sTWFuYWdlci5qcyIsInNyYy9jb3JlL1Njcm9sbGVyLmpzIiwic3JjL2V4dGVuZHMvQ29udGV4dG1lbnUuanMiLCJzcmMvZXh0ZW5kcy9TZWxlY3Rpb24uanMiLCJzcmMvaW5kZXguanMiLCJzcmMvcGx1Z2luL01lbnUuanMiLCJzcmMvdXRpbC9ERC5qcyIsInNyYy91dGlsL0V2ZW50RW1pdHRlci5qcyIsInNyYy91dGlsL0ZpbmRJbmRleC5qcyIsInNyYy91dGlsL1V0aWxzLmpzIiwic3JjL3V0aWwvc2hpbS5qcyIsInNyYy91dGlsL3V0aWxzL0NvbXBhcmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeldBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi4vdXRpbC9FdmVudEVtaXR0ZXInKTtcclxudmFyICQgPSByZXF1aXJlKCcuLi91dGlsL3NoaW0nKS4kO1xyXG5cclxudmFyIGRlZmluZURlbGwgPSBmdW5jdGlvbihjb2xNKSB7XHJcblx0bGV0IGNlbGwgPSAkKCc8bGkvPicpXHJcblx0XHQuYWRkQ2xhc3MoJ2MtZ3JpZC1jZWxsJylcclxuXHRcdC5hZGRDbGFzcygnYy1hbGlnbi0nICsgY29sTS5hbGlnbilcclxuXHRcdC5hZGRDbGFzcygoKSA9PiBjb2xNLmhpZGRlbiA/ICdjLWNvbHVtbi1oaWRlJyA6ICcnKVxyXG5cdFx0LmFkZENsYXNzKCgpID0+IGNvbE0ubG9ja2VkID8gJ2MtY29sdW1uLWxvY2tlZCcgOiAnJylcclxuXHRcdC5hdHRyKCd0YWJpbmRleCcsIC0xKVxyXG5cdFx0LmRhdGEoJ2RhdGFJbmRleCcsIGNvbE0uZGF0YUluZGV4KVxyXG5cdFx0LndpZHRoKGNvbE0ud2lkdGgpO1xyXG5cclxuXHRyZXR1cm4gY2VsbDtcclxufTtcclxuXHJcbnZhciBjcmVhdGVDZWxsID0gZnVuY3Rpb24oJHJvdywgY29sc01vZGVsKSB7XHJcblx0dmFyIHNpemUgPSBjb2xzTW9kZWwuc2l6ZSgpO1xyXG5cdHZhciBjaGlsZHJlbiA9IG5ldyBNYXAoKTtcclxuXHJcblx0Y29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblx0XHRsZXQgY2VsbCA9IGRlZmluZURlbGwoY29sTSk7XHJcblxyXG5cdFx0JHJvdy5hcHBlbmQoY2VsbCk7XHJcblx0XHRjaGlsZHJlbi5zZXQoY29sTSwgY2VsbCk7XHJcblx0fSk7XHJcblxyXG5cdHJldHVybiBjaGlsZHJlbjtcclxufTtcclxuXHJcbmNsYXNzIFJvd05vZGUgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cdGNvbnN0cnVjdG9yKGNvbHNNb2RlbCwgY29udGV4dCkge1xyXG5cdFx0c3VwZXIoKTtcclxuXHRcdHRoaXMuJHZtID0gY29udGV4dDtcclxuXHRcdHRoaXMuY29sc01vZGVsID0gY29sc01vZGVsO1xyXG5cdFx0dGhpcy4kbm9kZSA9ICQoJzx1bC8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC1yb3cnKTtcclxuXHJcblx0XHR0aGlzLmNoaWxkcmVuID0gY3JlYXRlQ2VsbCh0aGlzLiRub2RlLCBjb2xzTW9kZWwpO1xyXG5cdFx0dGhpcy5fYmluZEV2ZW50KGNvbHNNb2RlbCk7XHJcblx0fVxyXG5cclxuXHRfYmluZEV2ZW50KGNvbHNNb2RlbCkge1xyXG5cdFx0dGhpcy5jb2xzTW9kZWwub24oJ2NvbHVtbi1hZGQnLCBjb2xNID0+IHtcclxuXHRcdFx0bGV0IGNlbGwgPSBkZWZpbmVEZWxsKGNvbE0pO1xyXG5cclxuXHRcdFx0dGhpcy4kbm9kZS5hcHBlbmQoY2VsbCk7XHJcblx0XHRcdHRoaXMuY2hpbGRyZW4uc2V0KGNvbE0sIGNlbGwpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Y29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1yZXNpemVkJywgd2lkdGggPT4ge1xyXG5cdFx0XHRcdGNvbnNvbGUubG9nKHdpZHRoKTtcclxuXHRcdFx0XHR0aGlzLmNoaWxkcmVuLmdldChjb2xNKS5vdXRlcldpZHRoKHdpZHRoKTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4taGlkZGVuJywgaXNIaWRkZW4gPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNoaWxkcmVuLmdldChjb2xNKTtcclxuXHRcdFx0XHRpZiAoaXNIaWRkZW4pIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcygnYy1jb2x1bW4taGlkZScpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoJ2MtY29sdW1uLWhpZGUnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWxvY2tlZCcsIGlzTG9ja2VkID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jaGlsZHJlbi5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdGlmIChpc0xvY2tlZCkge1xyXG5cdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKCdjLWNvbHVtbi1sb2NrZWQnKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKCdjLWNvbHVtbi1sb2NrZWQnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignZGVzdG9yeScsICgpID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jaGlsZHJlbi5nZXQoY29sTSk7XHJcblx0XHRcdFx0dGhpcy5jaGlsZHJlbi5kZWxldGUoY29sTSk7XHRcdFx0XHJcblx0XHRcdFx0Y29sRWxlLnJlbW92ZSgpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0c2V0RGF0YShyb3csIG9mZnNldFRvcCkge1xyXG5cdFx0Ly8g6L+Z6YeM5aaC5p6c55SoQU9Q5pa55byP5a6e546w5pu05aW9VE9ET1xyXG5cdFx0dGhpcy4kdm0uZmlyZSgncm93LXVwZGF0ZS1iZWZvcmUnLCB0aGlzLCByb3cpO1xyXG5cclxuXHRcdHZhciBjb250ZW50O1xyXG5cdFx0dmFyIGNlbGxzID0gdGhpcy5jaGlsZHJlbjtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cclxuXHRcdFx0Y29udGVudCA9IGNvbE0ucmVuZGVyZXIocm93LmRhdGFbY29sTS5kYXRhSW5kZXhdKTtcclxuXHRcdFx0Ly8gVE9ETyBhZGRDbGFzcygoKT0+IHJvdy5jZWxsW2NvbE0uZGF0YUluZGV4XS5zZWxlY3RlZClcclxuXHRcdFx0Y2VsbHMuZ2V0KGNvbE0pLmh0bWwoY29udGVudCk7XHJcblxyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kbm9kZS5jc3MoJ3RvcCcsIG9mZnNldFRvcCkuYXR0cigncmlkJywgcm93LnJpZCk7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuJG5vZGU7XHJcblx0fVxyXG59XHJcblxyXG5jbGFzcyBCdWZmZXJOb2RlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHRjb25zdHJ1Y3RvcihsaW1pdCwgY29sc01vZGVsLCB0b3RhbCwgY2FjaGVUaW1lcykge1xyXG5cdFx0c3VwZXIoKTtcclxuXHRcdHRoaXMuaW5pdChsaW1pdCwgY29sc01vZGVsLCB0b3RhbCwgY2FjaGVUaW1lcyk7XHJcblx0fVxyXG5cclxuXHRpbml0KGxpbWl0LCBjb2xzTW9kZWwsIHRvdGFsLCBjYWNoZVRpbWVzKSB7XHJcblx0XHR0aGlzLmxpbWl0ID0gbGltaXQ7XHJcblx0XHR0aGlzLnRvdGFsID0gdG90YWw7XHJcblx0XHR0aGlzLmNhY2hlVGltZXMgPSBjYWNoZVRpbWVzIHx8IDM7XHJcblx0XHR0aGlzLm5vZGVMaXN0ID0gW107XHJcblx0XHR0aGlzLmNvbHNNb2RlbCA9IGNvbHNNb2RlbDtcclxuXHJcblx0XHQvLyDov5nph4zmmoLkuLpTZWxlY3Rpb27lrp7njrDvvIzlupTor6XnlKhBT1Dnu7TmiqQgVE9ET1xyXG5cdFx0Ly8gdGhpcy5vbigncm93LXVwZGF0ZS1iZWZvcmUnLCAocm93Tm9kZSwgcm93KSA9PiB0aGlzLmZpcmUoJ3Jvdy11cGRhdGUnLCByb3dOb2RlLCByb3cpKTtcclxuXHR9XHJcblxyXG5cdGdldE5vZGVMaXN0KCkge1xyXG5cdFx0cmV0dXJuIHRoaXMubm9kZUxpc3Q7XHJcblx0fVxyXG5cclxuXHRzZXRMaW1pdChsaW1pdCkge1xyXG5cdFx0aWYgKCtsaW1pdCA+IDApIHtcclxuXHRcdFx0dGhpcy5pbml0KGxpbWl0LCB0aGlzLmNvbHNNb2RlbCwgdGhpcy50b3RhbCwgdGhpcy5jYWNoZVRpbWVzKTtcclxuXHRcdFx0dGhpcy5maXJlKCdidWZmZXItaW5pdGlhbCcpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0c2V0VG90YWwodG90YWwpIHtcclxuXHRcdGlmICgrdG90YWwgPj0gMCkge1xyXG5cdFx0XHR0aGlzLnRvdGFsID0gdG90YWw7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRpc0Vub3VnaCgpIHtcclxuXHRcdHJldHVybiB0aGlzLm5vZGVMaXN0Lmxlbmd0aCA+PSBNYXRoLm1pbih0aGlzLnRvdGFsLCB0aGlzLmNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHR9XHJcblxyXG5cdGdldChkaXIsIGRvbWFpbikge1xyXG5cdFx0aWYgKHRoaXMuaXNFbm91Z2goKSkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5fZ2V0Tm9kZXMoZGlyLCBkb21haW4pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzLl9hZGROb2RlcyhkaXIsIGRvbWFpbik7XHJcblx0fVxyXG5cclxuXHRfZ2V0Tm9kZXMoZGlyLCBbc3RhcnQsIGVuZF0pIHtcclxuXHRcdHZhciBzZWxlY3RlZDtcclxuXHJcblx0XHRpZiAoZGlyID4gMCkge1xyXG5cdFx0XHRzZWxlY3RlZCA9IHRoaXMubm9kZUxpc3Quc2xpY2UoMCwgZW5kIC0gc3RhcnQgKyAxKTtcclxuXHRcdFx0dGhpcy5ub2RlTGlzdCA9IHRoaXMubm9kZUxpc3Quc2xpY2UoZW5kIC0gc3RhcnQgKyAxKS5jb25jYXQoc2VsZWN0ZWQpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0c2VsZWN0ZWQgPSB0aGlzLm5vZGVMaXN0LnNsaWNlKHN0YXJ0IC0gZW5kIC0gMSk7XHJcblx0XHRcdHRoaXMubm9kZUxpc3QgPSBzZWxlY3RlZC5jb25jYXQodGhpcy5ub2RlTGlzdC5zbGljZSgwLCBzdGFydCAtIGVuZCAtIDEpKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gc2VsZWN0ZWQgfHwgW107XHJcblx0fVxyXG5cclxuXHRfYWRkTm9kZXMoZGlyLCBbc3RhcnQsIGVuZF0pIHtcclxuXHRcdHZhciBub2RlcyA9IFtdO1xyXG5cclxuXHRcdGZvciAodmFyIGkgPSBzdGFydDsgaSA8PSBlbmQ7IGkrKykge1xyXG5cdFx0XHRub2Rlcy5wdXNoKG5ldyBSb3dOb2RlKHRoaXMuY29sc01vZGVsLCB0aGlzKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5ub2RlTGlzdCA9IGRpciA+IDAgPyB0aGlzLm5vZGVMaXN0LmNvbmNhdChub2RlcykgOiBub2Rlcy5jb25jYXQodGhpcy5ub2RlTGlzdCk7XHJcblxyXG5cdFx0cmV0dXJuIG5vZGVzO1xyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBCdWZmZXJOb2RlO1xyXG4iLCJjbGFzcyBCdWZmZXJab25lIHtcclxuXHRjb25zdHJ1Y3RvcihsaW1pdCwgdG90YWwsIGNhY2hlVGltZXMpIHtcclxuXHRcdHRoaXMuaW5pdChsaW1pdCwgdG90YWwsIGNhY2hlVGltZXMpO1xyXG5cdH1cclxuXHJcblx0aW5pdChsaW1pdCwgdG90YWwsIGNhY2hlVGltZXMpIHtcclxuXHRcdHRoaXMuc3RhcnQgPSAwO1xyXG5cdFx0dGhpcy5lbmQgPSB0aGlzLmxpbWl0ID0gbGltaXQ7XHJcblx0XHR0aGlzLnRvdGFsID0gK3RvdGFsO1xyXG5cdFx0dGhpcy5jYWNoZVRpbWVzID0gY2FjaGVUaW1lcyB8fCAzO1xyXG5cdFx0dGhpcy5kb21haW4gPSBbdGhpcy5zdGFydCwgdGhpcy5lbmRdO1xyXG5cdH1cclxuXHJcblx0c2V0TGltaXQobGltaXQpIHtcclxuXHRcdGlmICgrbGltaXQgPiAwKSB7XHJcblx0XHRcdHRoaXMuaW5pdChsaW1pdCwgdGhpcy50b3RhbCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRzZXRUb3RhbCh0b3RhbCkge1xyXG5cdFx0aWYgKCt0b3RhbCA+PSAwKSB7XHJcblx0XHRcdHRoaXMudG90YWwgPSB0b3RhbDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlzQW1vbmcodmFsdWUpIHtcclxuXHRcdHJldHVybiB0aGlzLnN0YXJ0IDw9IHZhbHVlICYmIHZhbHVlIDw9IHRoaXMuZW5kO1xyXG5cdH1cclxuXHJcblx0c2hvdWxkTG9hZChkaXIsIHZlcm5pZXIpIHtcclxuXHRcdGlmIChkaXIgPT09IDApIHJldHVybiBmYWxzZTtcclxuXHJcblx0XHR2YXIgc3RhcnQgPSB0aGlzLnN0YXJ0O1xyXG5cdFx0dmFyIGVuZCA9IHRoaXMuZW5kO1xyXG5cdFx0dmFyIGNhY2hlVGltZXMgPSB0aGlzLmNhY2hlVGltZXM7XHJcblxyXG5cdFx0Ly8gc2Nyb2xsIHVwXHJcblx0XHRpZiAoZGlyIDwgMCAmJiBzdGFydCA9PT0gMCkgcmV0dXJuIGZhbHNlO1xyXG5cdFx0aWYgKGRpciA8IDAgJiYgdmVybmllciA8IHN0YXJ0ICsgdGhpcy5saW1pdCkge1xyXG5cdFx0XHRpZiAodGhpcy5pc0Ftb25nKHZlcm5pZXIpKSB7XHJcblx0XHRcdFx0ZW5kID0gc3RhcnQgLSAxO1xyXG5cdFx0XHRcdHN0YXJ0ID0gTWF0aC5tYXgoMCwgZW5kIC0gdGhpcy5saW1pdCk7XHJcblx0XHRcdH0gZWxzZSBpZiAodmVybmllciA9PT0gMCkge1xyXG5cdFx0XHRcdGVuZCA9IE1hdGgubWluKHRoaXMudG90YWwsIHZlcm5pZXIgKyBjYWNoZVRpbWVzICogdGhpcy5saW1pdCk7XHJcblx0XHRcdFx0c3RhcnQgPSAwO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGVuZCA9IHZlcm5pZXIgKyB0aGlzLmxpbWl0O1xyXG5cdFx0XHRcdHN0YXJ0ID0gTWF0aC5tYXgoMCwgdmVybmllciAtIChjYWNoZVRpbWVzIC0gMSkgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5kb21haW4gPSBbc3RhcnQsIGVuZF07XHJcblx0XHRcdHRoaXMuc3RhcnQgPSBzdGFydDtcclxuXHRcdFx0dGhpcy5lbmQgPSBNYXRoLm1pbihzdGFydCArIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0LCB0aGlzLmVuZCk7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIHNjcm9sbCBkb3duXHJcblx0XHRpZiAoZGlyID4gMCAmJiBlbmQgPT09IHRoaXMudG90YWwpIHJldHVybiBmYWxzZTtcclxuXHRcdGlmIChkaXIgPiAwICYmIHZlcm5pZXIgPiBlbmQgLSB0aGlzLmxpbWl0KSB7XHJcblx0XHRcdC8vIOa4uOagh+WcqOeOsOacieiMg+WbtOWGhVxyXG5cdFx0XHRpZiAodGhpcy5pc0Ftb25nKHZlcm5pZXIpKSB7XHJcblx0XHRcdFx0c3RhcnQgPSBlbmQgKyAxO1xyXG5cdFx0XHRcdGVuZCA9IE1hdGgubWluKHRoaXMudG90YWwsIHN0YXJ0ICsgdGhpcy5saW1pdCk7XHJcblx0XHRcdH1cclxuXHRcdFx0Ly8g5ri45qCH5Yiw6L6+57uT5bC+XHJcblx0XHRcdGVsc2UgaWYgKHZlcm5pZXIgPT09IHRoaXMudG90YWwpIHtcclxuXHRcdFx0XHRlbmQgPSB0aGlzLnRvdGFsO1xyXG5cdFx0XHRcdHN0YXJ0ID0gTWF0aC5tYXgoMCwgdmVybmllciAtIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvLyDkuI3lnKjnjrDmnInojIPlm7Tlj4jmnKrliLDnu5PlsL7lpIRcclxuXHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0ZW5kID0gTWF0aC5taW4odGhpcy50b3RhbCwgdmVybmllciArIChjYWNoZVRpbWVzIC0gMSkgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0XHRzdGFydCA9IE1hdGgubWF4KDAsIGVuZCAtIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5kb21haW4gPSBbc3RhcnQsIGVuZF07XHJcblx0XHRcdHRoaXMuZW5kID0gZW5kO1xyXG5cdFx0XHR0aGlzLnN0YXJ0ID0gTWF0aC5tYXgodGhpcy5zdGFydCwgZW5kIC0gY2FjaGVUaW1lcyAqIHRoaXMubGltaXQpO1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBCdWZmZXJab25lOyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCcuLi91dGlsL0V2ZW50RW1pdHRlcicpO1xyXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuLi91dGlsL1V0aWxzJyk7XHJcbnZhciBfID0gcmVxdWlyZSgnLi4vdXRpbC9zaGltJykuXztcclxuXHJcbnZhciBkZWZSZW5kZXJlciA9IHYgPT4gdjtcclxudmFyIE9SREVSID0gWydBU0MnLCAnREVTQyddO1xyXG5cclxuY2xhc3MgQ29sdW1uIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHRjb25zdHJ1Y3RvcihjaWQsIG9wdGlvbnMsIGNvbnRleHQpIHtcclxuXHRcdHN1cGVyKCk7XHJcblxyXG5cdFx0b3B0aW9ucy5yZW5kZXJlciA9IG9wdGlvbnMucmVuZGVyZXIgfHwgZGVmUmVuZGVyZXI7XHJcblxyXG5cdFx0dmFyIGRlZmF1bHRzID0ge1xyXG5cdFx0XHQndGV4dCc6ICcnLFxyXG5cdFx0XHQndnR5cGUnOiAnc3RyaW5nJyxcclxuXHRcdFx0J2RhdGFJbmRleCc6ICcnLFxyXG5cdFx0XHQnd2lkdGgnOiA1MCxcclxuXHRcdFx0J2FsaWduJzogJ2xlZnQnLFxyXG5cclxuXHRcdFx0J3Jlc2l6YWJsZSc6IHRydWUsXHJcblx0XHRcdCdjbHMnOiAnJyxcclxuXHRcdFx0J2ZpeGVkJzogZmFsc2UsXHJcblx0XHRcdCdkcmFnZ2FibGUnOiBmYWxzZSxcclxuXHRcdFx0J3NvcnRhYmxlJzogdHJ1ZSxcclxuXHRcdFx0J2hpZGRlbic6IGZhbHNlLFxyXG5cdFx0XHQnbG9ja2VkJzogZmFsc2UsXHJcblx0XHRcdCdsb2NrYWJsZSc6IHRydWUsXHJcblx0XHRcdCdtZW51RGlzYWJsZWQnOiB0cnVlLFxyXG5cclxuXHRcdFx0Ly8gcHJpdmF0ZVxyXG5cdFx0XHQnc29ydFN0YXRlJzogbnVsbFxyXG5cdFx0fTtcclxuXHJcblx0XHR0aGlzLmNpZCA9IGNpZDtcclxuXHRcdHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XHJcblx0XHRPYmplY3QuYXNzaWduKHRoaXMsIGRlZmF1bHRzLCBvcHRpb25zKTtcclxuXHR9XHJcblxyXG5cdHNldFdpZHRoKG51bSkge1xyXG5cdFx0aWYgKCF0aGlzLnJlc2l6YWJsZSkgcmV0dXJuO1xyXG5cdFx0aWYgKGlzTmFOKG51bSkpIHJldHVybjtcclxuXHJcblx0XHR0aGlzLndpZHRoID0gK251bTtcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLXJlc2l6ZWQnLCB0aGlzLndpZHRoLCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdHNob3coKSB7XHJcblx0XHR0aGlzLmhpZGRlbiA9IGZhbHNlO1xyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4taGlkZGVuJywgdGhpcy5oaWRkZW4sIHRoaXMpO1xyXG5cdH1cclxuXHJcblx0aGlkZSgpIHtcclxuXHRcdHRoaXMudW5Mb2NrKCk7XHJcblx0XHRcclxuXHRcdHRoaXMuaGlkZGVuID0gdHJ1ZTtcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLWhpZGRlbicsIHRoaXMuaGlkZGVuLCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdHRvZ2dsZSgpIHtcclxuXHRcdGlmICh0aGlzLmhpZGRlbikge1xyXG5cdFx0XHR0aGlzLnNob3coKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoaXMuaGlkZSgpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0bG9jaygpIHtcclxuXHRcdGlmICghdGhpcy5sb2NrYWJsZSkgcmV0dXJuO1xyXG5cdFx0aWYgKHRoaXMubG9ja2VkKSByZXR1cm47XHJcblxyXG5cdFx0dGhpcy5zaG93KCk7XHJcblxyXG5cdFx0dGhpcy5sb2NrZWQgPSB0cnVlO1xyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4tbG9ja2VkJywgdGhpcy5sb2NrZWQsIHRoaXMpO1xyXG5cdH1cclxuXHJcblx0dW5Mb2NrKCkge1xyXG5cdFx0aWYgKCF0aGlzLmxvY2thYmxlKSByZXR1cm47XHJcblx0XHRpZiAoIXRoaXMubG9ja2VkKSByZXR1cm47XHJcblxyXG5cdFx0dGhpcy5sb2NrZWQgPSBmYWxzZTtcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLWxvY2tlZCcsIHRoaXMubG9ja2VkLCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIG9yZGVyW0FTQywgREVTQywgTk9fU09SVF1cclxuXHQgKi9cclxuXHRzb3J0KG9yZGVyKSB7XHJcblx0XHRpZiAoIXRoaXMuc29ydGFibGUgfHwgIXRoaXMuZGF0YUluZGV4KSByZXR1cm47XHJcblxyXG5cdFx0aWYgKG9yZGVyKSB7XHJcblx0XHRcdHRoaXMuc29ydFN0YXRlID0gT1JERVIuaW5jbHVkZXMob3JkZXIpID8gb3JkZXIgOiBudWxsO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhpcy5zb3J0U3RhdGUgPSB0aGlzLnNvcnRTdGF0ZSA9PT0gT1JERVJbMV0gPyBPUkRFUlswXSA6IE9SREVSWzFdO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1zb3J0LWNoYW5nZWQnLCB0aGlzLnNvcnRTdGF0ZSk7XHJcblx0XHR0aGlzLmNvbnRleHQuZmlyZSgnbm90aWNlLWNvbE1vZGVsLXNvcnQtY2hhbmdlZCcpO1xyXG4gXHR9XHJcblxyXG4gXHRyZW1vdmUoKSB7XHJcbiBcdFx0dGhpcy5maXJlKCdkZXN0b3J5Jyk7XHJcbiBcdFx0dGhpcy5jb250ZXh0LmZpcmUoJ2NvbHVtbi1yZW1vdmVkJywgdGhpcyk7XHJcbiBcdFx0dGhpcy5yZW1vdmVFdmVudCgpO1xyXG4gXHR9XHJcbn1cclxuXHJcblxyXG5jbGFzcyBDb2xNb2RlbCBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblx0Y29uc3RydWN0b3IoY29sdW1ucykge1xyXG5cdFx0c3VwZXIoKTtcclxuXHJcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoY29sdW1ucykpIHtcclxuXHRcdFx0dGhyb3cgJ3JlcXVpcmUgcHJvcGVydHkgY29sdW1ucyBpcyBhIGFycmF5IG9iamVjdCc7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5jb2x1bW5zID0gW107IC8vIGRhdGEgYnkgY29sdW1uXHJcblx0XHR0aGlzLmNvbE1vZGVsID0gbmV3IE1hcCgpOyAvLyBkYXRhIGJ5IGNpZFxyXG5cdFx0dGhpcy5jb2xIZWFkZXJzID0gbmV3IE1hcCgpOyAvLyBkYXRhIGJ5IGRhdGFJbmRleFxyXG5cclxuXHRcdHRoaXMuX2luaXRDb2x1bW4oY29sdW1ucyk7XHJcblx0XHR0aGlzLl9iaW5kRXZlbnQoKTtcclxuXHR9XHJcblxyXG5cdF9pbml0Q29sdW1uKGNvbHVtbnMsIGNhbGxiYWNrKSB7XHJcblx0XHRsZXQgc2l6ZSA9IHRoaXMuc2l6ZSgpO1xyXG5cclxuXHRcdGNvbHVtbnMuZm9yRWFjaCgoY29sLCBpbmRleCkgPT4ge1xyXG5cdFx0XHQvLyBjaWTop6PlhrPmsqHmnIlkYXRhSW5kZXjliJfmiJbnm7jlkIxkYXRhSW5kZXjliJfnmoTpl67pophcclxuXHRcdFx0bGV0IGNpZCA9IGluZGV4ICsgc2l6ZTtcclxuXHRcdFx0bGV0IGNvbE0gPSBuZXcgQ29sdW1uKGNpZCwgY29sLCB0aGlzKTtcclxuXHJcblx0XHRcdHRoaXMuY29sTW9kZWwuc2V0KGNpZCwgY29sTSk7XHJcblx0XHRcdHRoaXMuY29sdW1ucy5wdXNoKGNvbE0pO1xyXG5cdFx0XHR0aGlzLmNvbEhlYWRlcnMuc2V0KGNvbC5kYXRhSW5kZXgsIGNvbE0pO1xyXG5cclxuXHRcdFx0Y2FsbGJhY2sgJiYgY2FsbGJhY2soY29sTSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGFkZENvbHVtbnMoY29sdW1ucykge1xyXG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KGNvbHVtbnMpKSB7XHJcblx0XHRcdGNvbHVtbnMgPSBbY29sdW1uc107XHJcblx0XHR9XHJcblx0XHR0aGlzLl9pbml0Q29sdW1uKGNvbHVtbnMsIGNvbE0gPT4gdGhpcy5maXJlKCdjb2x1bW4tYWRkJywgY29sTSkpO1xyXG5cdH1cclxuXHJcblx0cmVtb3ZlQ29sdW1uKGRhdGFJbmRleCkge1xyXG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KGRhdGFJbmRleCkpIHtcclxuXHRcdFx0ZGF0YUluZGV4ID0gW2RhdGFJbmRleF07XHJcblx0XHR9XHJcblxyXG5cdFx0ZGF0YUluZGV4LmZvckVhY2goZHMgPT4ge1xyXG5cdFx0XHRsZXQgY29sTSA9IHRoaXMuZ2V0Q29sdW1uQnlEYXRhSW5kZXgoZHMpO1xyXG5cclxuXHRcdFx0aWYgKGNvbE0pIHtcclxuXHRcdFx0XHRjb2xNLnJlbW92ZSgpO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHR0aGlzLm9uKCdub3RpY2UtY29sTW9kZWwtc29ydC1jaGFuZ2VkJywgXy5kZWJvdW5jZSgoKSA9PiB7XHJcblx0XHRcdHRoaXMuZmlyZSgnY29sdW1ucy1zb3J0LWNoYW5nZWQnKTtcclxuXHRcdH0sIDIwKSk7XHJcblxyXG5cdFx0dGhpcy5vbignY29sdW1uLXJlbW92ZWQnLCBjb2xNID0+IHtcclxuXHRcdFx0dGhpcy5jb2x1bW5zID0gdGhpcy5jb2x1bW5zLmZpbHRlcihjb2wgPT4gY29sLmRhdGFJbmRleCAhPSBjb2xNLmRhdGFJbmRleCk7XHJcblx0XHRcdHRoaXMuY29sTW9kZWwuZGVsZXRlKGNvbE0uY2lkKTtcclxuXHRcdFx0dGhpcy5jb2xIZWFkZXJzLmRlbGV0ZShjb2xNLmRhdGFJbmRleCk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdHNpemUoKSB7IFxyXG5cdFx0cmV0dXJuIHRoaXMuY29sTW9kZWwuc2l6ZTsgXHJcblx0fVxyXG5cclxuXHRnZXRDb2x1bW4oY29sKSB7XHJcblx0XHRpZiAodGhpcy5jb2x1bW5zLmluY2x1ZGVzKGNvbCkpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuY29sdW1ucy5maWx0ZXIoX2NvbCA9PiBfY29sID09IGNvbClbMF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuY29sdW1ucztcclxuXHR9XHJcblxyXG5cdGdldExvY2tDb2x1bW4oKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5jb2x1bW5zLmZpbHRlcihjb2xNID0+IHtcclxuXHRcdFx0cmV0dXJuIGNvbE0ubG9ja2VkID09PSB0cnVlO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRnZXRWaXNpYmxlQ29sdW1uKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuY29sdW1ucy5maWx0ZXIoY29sTSA9PiB7XHJcblx0XHRcdHJldHVybiAhY29sTS5oaWRkZW47XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGdldENvbHVtbkJ5RGF0YUluZGV4KGRhdGFJbmRleCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuY29sSGVhZGVycy5nZXQoZGF0YUluZGV4KSB8fCBudWxsO1xyXG5cdH1cclxuXHJcblx0Z2V0Q29sdW1uc0J5SWQoaWQpIHtcclxuXHRcdHJldHVybiB0aGlzLmNvbE1vZGVsW2lkXSB8fCBudWxsO1xyXG5cdH1cclxuXHJcblx0ZWFjaChjYWxsYmFjaywgY29udGV4dCkge1xyXG5cdFx0dGhpcy5jb2x1bW5zLmZvckVhY2goY2FsbGJhY2ssIGNvbnRleHQgfHwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHRkZXN0b3J5KCkgeyBcclxuXHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENvbE1vZGVsOyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCcuLi91dGlsL0V2ZW50RW1pdHRlcicpO1xyXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuLi91dGlsL1V0aWxzJyk7XHJcbnZhciBfID0gcmVxdWlyZSgnLi4vdXRpbC9zaGltJykuXztcclxuXHJcbmNsYXNzIFJvdyB7XHJcblx0Y29uc3RydWN0b3IocmlkLCBkYXRhKSB7XHJcblx0XHR0aGlzLnJpZCA9IHJpZDtcclxuXHRcdHRoaXMuZGF0YSA9IGRhdGE7XHJcblx0XHR0aGlzLnNlbGVjdGVkID0gZmFsc2U7XHJcblx0fVxyXG5cdHN0YXRlKCkge31cclxufVxyXG5cclxuY2xhc3MgR3JpZFN0b3JlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHJcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xyXG5cdFx0c3VwZXIoKTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbCA9IG9wdGlvbnMuY29sdW1uTW9kZWw7XHJcblxyXG5cdFx0dGhpcy5yb3dzID0gW107IC8vIGRhdGEgYnkgaW5kZXhcclxuXHRcdHRoaXMucm93TW9kZWwgPSBuZXcgTWFwKCk7IC8vIGRhdGEgYnkgaWRcclxuXHJcblxyXG5cdFx0dGhpcy5zZXREYXRhKG9wdGlvbnMuZGF0YSk7XHJcblxyXG5cdFx0dGhpcy5fc29ydFN0YXRlID0geyBrZXlzOiBbXSwgZGlyczogW10gfTtcclxuXHRcdHRoaXMuX2JpbmRFdmVudCgpO1xyXG5cdH1cclxuXHJcblx0X2JpbmRFdmVudCgpIHtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tc29ydC1jaGFuZ2VkJywgc29ydFN0YXRlID0+IHtcclxuXHRcdFx0XHRsZXQgeyBrZXlzLCBkaXJzIH0gPSB0aGlzLl9zb3J0U3RhdGU7XHJcblx0XHRcdFx0bGV0IGluZGV4ID0ga2V5cy5pbmRleE9mKGNvbE0uZGF0YUluZGV4KTtcclxuXHJcblx0XHRcdFx0Ly8g5pyq5o6S5bqPXHJcblx0XHRcdFx0aWYgKGluZGV4ID09PSAtMSAmJiAhc29ydFN0YXRlKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoaW5kZXggPT09IC0xICYmIHNvcnRTdGF0ZSkge1xyXG5cdFx0XHRcdFx0a2V5cy51bnNoaWZ0KGNvbE0uZGF0YUluZGV4KTtcclxuXHRcdFx0XHRcdGRpcnMudW5zaGlmdChzb3J0U3RhdGUudG9Mb3dlckNhc2UoKSk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyDlt7LmjpLluo8s5YWI5Yig6ZmkXHJcblx0XHRcdFx0bGV0IGtleSA9IGtleXMuc3BsaWNlKGluZGV4LCAxKVswXTtcclxuXHRcdFx0XHRsZXQgZGlyID0gZGlycy5zcGxpY2UoaW5kZXgsIDEpWzBdO1xyXG5cclxuXHRcdFx0XHRpZiAoc29ydFN0YXRlKSB7XHJcblx0XHRcdFx0XHRrZXlzLnVuc2hpZnQoa2V5KTtcclxuXHRcdFx0XHRcdGRpcnMudW5zaGlmdChzb3J0U3RhdGUudG9Mb3dlckNhc2UoKSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHQvLyDmiYDmnInliJfpg73mm7TmlrDnirbmgIHlkI5cclxuXHRcdHRoaXMuY29sc01vZGVsLm9uKCdjb2x1bW5zLXNvcnQtY2hhbmdlZCcsICgpID0+IHtcclxuXHRcdFx0bGV0IHsga2V5cywgZGlycyB9ID0gdGhpcy5fc29ydFN0YXRlO1xyXG5cdFx0XHRsZXQgaXRlcmF0ZUZuID0gcm93ID0+IHJvdy5kYXRhW2tleXNbMF1dO1xyXG5cclxuXHRcdFx0Y29uc29sZS5sb2coa2V5cywgZGlycyk7XHJcblxyXG5cdFx0XHR0aGlzLnJvd3MgPSBfLm9yZGVyQnkodGhpcy5yb3dzLCBpdGVyYXRlRm4sIGRpcnMpO1xyXG5cdFx0XHR0aGlzLnNldERhdGEoXy5tYXAodGhpcy5yb3dzLCAnZGF0YScpKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0c2xpY2Uoc3RhcnQsIGVuZCkge1xyXG5cdFx0cmV0dXJuIHRoaXMucm93cy5zbGljZShzdGFydCwgZW5kKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIOiuvue9ruaOkuW6j+eKtuaAgVxyXG5cdCAqICgrKUFTQywgLURFU0MsICFOT19TT1JUXHJcblx0ICogQHNvcnRzIHtBcnJheX0gc29ydHMgLeaOkuW6j+eKtuaAgeaVsOe7hFxyXG5cdCAqXHRzb3J0cyA9IFsnK2NvbEEnLCAnY29sQicsICctY29sQycsICchY29sRCddXHJcblx0ICogQHJldHVybnMgdGhpcztcclxuXHQgKi9cclxuXHRzZXRTb3J0U3RhdGUoc29ydHMpIHtcclxuXHRcdGlmICghQXJyYXkuaXNBcnJheShzb3J0cykpIHtcclxuXHRcdFx0c29ydHMgPSBbc29ydHNdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuX3NvcnRTdGF0ZSA9IHsga2V5czogW10sIGRpcnM6IFtdIH07XHJcblxyXG5cdFx0Ly8g5Y+N6L2s5LyY5YWI57qn5pa55L6/5ZCO57ut6Kem5Y+R6aG65bqP5pe25ZCO6Kem5Y+R55qE5LyY5YWI57qn6auYXHJcblx0XHRzb3J0cy5yZXZlcnNlKCkuZWFjaChzb3J0T2JqID0+IHtcclxuXHRcdFx0bGV0IG9iaiwga2V5LCBkaXIsIGNvbDtcclxuXHJcblx0XHRcdGlmICh0eXBlb2Ygc29ydE9iaiA9PT0gJ3N0cmluZycpIHtcclxuXHRcdFx0XHRvYmogPSBzb3J0T2JqLm1hdGNoKC8oXlsrfC18IV0/KSguezAsfSkvKTtcclxuXHRcdFx0XHRkaXIgPSBvYmpbMV0gPT09ICcnID8gJ0FTQycgOiAob2JqID09PSAnLScgPyAnREVTQycgOiAnTk9fU09SVCcpO1xyXG5cdFx0XHRcdGtleSA9IG9ialsyXSA/IG9ialsyXSA6IG51bGw7XHJcblxyXG5cdFx0XHRcdGNvbCA9IHRoaXMuY29sc01vZGVsLmdldENvbHVtbkJ5RGF0YUluZGV4KGtleSk7XHJcblx0XHRcdFx0aWYgKGNvbCkge1xyXG5cdFx0XHRcdFx0Y29sLnNvcnQoZGlyKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0c2V0RGF0YShkYXRhID0gW10sIGFwcGVuZCA9IGZhbHNlKSB7XHJcblx0XHRpZiAoIWFwcGVuZCkge1xyXG5cdFx0XHR0aGlzLnJvd3MubGVuZ3RoID0gMDtcclxuXHRcdFx0dGhpcy5yb3dNb2RlbC5jbGVhcigpO1xyXG5cdFx0fVxyXG5cdFx0dmFyIGluZGV4ID0gdGhpcy5zaXplKCk7XHJcblx0XHRkYXRhLmZvckVhY2goKHJvdywgcmlkeCkgPT4ge1xyXG5cdFx0XHRsZXQgcm93TSA9IG5ldyBSb3cocmlkeCArIGluZGV4LCByb3cpO1xyXG5cdFx0XHR0aGlzLnJvd3MucHVzaChyb3dNKTtcclxuXHRcdFx0dGhpcy5yb3dNb2RlbC5zZXQocmlkeCArIGluZGV4LCByb3dNKTtcclxuXHRcdH0pO1xyXG5cdFx0dGhpcy5maXJlKCdkYXRhLWNoYW5nZWQnLCBhcHBlbmQpO1xyXG5cdH1cclxuXHJcblx0Zm9yRWFjaChjYWxsYmFjaywgY29udGV4dCkge1xyXG5cdFx0dGhpcy5yb3dzLmZvckVhY2goZnVuY3Rpb24ocm93TSwgcmlkeCkge1xyXG5cdFx0XHRjYWxsYmFjay5jYWxsKHRoaXMsIHJvd00uZGF0YSwgcmlkeCk7XHJcblx0XHR9LCBjb250ZXh0IHx8IHRoaXMpO1xyXG5cdH1cclxuXHJcblx0c2l6ZSgpIHtcclxuXHRcdHJldHVybiB0aGlzLnJvd01vZGVsLnNpemU7XHJcblx0fVxyXG5cclxuXHRkZXN0b3J5KCkgeyBcclxuXHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEdyaWRTdG9yZTsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi4vdXRpbC9FdmVudEVtaXR0ZXInKTtcclxudmFyIENvbE1vZGVsID0gcmVxdWlyZSgnLi9Db2xNb2RlbCcpO1xyXG52YXIgR3JpZFN0b3JlID0gcmVxdWlyZSgnLi9HcmlkU3RvcmUnKTtcclxudmFyIEJ1ZmZlck5vZGUgPSByZXF1aXJlKCcuL0J1ZmZlck5vZGUnKTtcclxudmFyIEJ1ZmZlclpvbmUgPSByZXF1aXJlKCcuL0J1ZmZlclpvbmUnKTtcclxudmFyIEhlYWRlciA9IHJlcXVpcmUoJy4vSGVhZGVyJyk7XHJcbnZhciBMb2NrQ29sTWFuYWdlciA9IHJlcXVpcmUoJy4vTG9ja0NvbE1hbmFnZXInKTtcclxudmFyIFNjcm9sbGVyID0gcmVxdWlyZSgnLi9TY3JvbGxlcicpO1xyXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuLi91dGlsL1V0aWxzJyk7XHJcblxyXG5mdW5jdGlvbiBjcmVhdGVMYXlvdXQoY29udGFpbmVyLCB3aWR0aCkge1xyXG5cdHZhciB3cmFwcGVyID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC13cmFwcGVyJykud2lkdGgod2lkdGgpO1xyXG5cdHZhciBoZWFkZXIgPSAkKCc8ZGl2Lz4nKS5hZGRDbGFzcygnYy1ncmlkLWhlYWRlcicpO1xyXG5cdHZhciBib2R5ID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC1ib2R5Jyk7XHJcblx0dmFyIHZpZXdwb3J0ID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC12aWV3cG9ydCcpLmFwcGVuZFRvKGJvZHkpO1xyXG5cdHZhciBjYW52YXMgPSAkKCc8ZGl2Lz4nKS5hZGRDbGFzcygnYy1ncmlkLWNhbnZhcycpLmFwcGVuZFRvKHZpZXdwb3J0KTtcclxuXHR3cmFwcGVyLmFwcGVuZChoZWFkZXIpLmFwcGVuZChib2R5KS5hcHBlbmRUbyhjb250YWluZXIpO1xyXG5cclxuXHRyZXR1cm4geyB3cmFwcGVyLCBoZWFkZXIsIGJvZHksIHZpZXdwb3J0LCBjYW52YXMgfTtcclxufVxyXG5mdW5jdGlvbiBjYWxjUm93SGVpZ2h0KCkge1xyXG5cdHZhciBsaSA9ICQoJzxsaSBjbGFzcz1cImMtZ3JpZC1jZWxsXCI+cGxhY2Vob2xkZXI8L2xpPicpLmFwcGVuZFRvKFwiYm9keVwiKTtcclxuXHR2YXIgcm93SGVpZ2h0ID0gbGkub3V0ZXJIZWlnaHQoKTtcclxuXHRsaS5yZW1vdmUoKTtcclxuXHJcblx0cmV0dXJuIHJvd0hlaWdodDtcclxufVxyXG5cclxuY2xhc3MgR3JpZENvbXBvbmVudCBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xyXG5cdFx0c3VwZXIoKTtcclxuXHJcblx0XHRpZiAoISQob3B0aW9ucy5kb21FbCkuc2l6ZSgpKSB7IHRocm93ICdyZXF1aXJlIGEgdmFsaWQgZG9tRWwnOyB9XHJcblxyXG5cdFx0dGhpcy5zaG91bGRBZGROb2RlcyA9IHRydWU7XHJcblx0XHR0aGlzLmhlaWdodCA9ICtvcHRpb25zLmhlaWdodCB8fCA1MDA7XHJcblx0XHR0aGlzLndpZHRoID0gb3B0aW9ucy53aWR0aDtcclxuXHJcblx0XHQvLyAkbGF5b3V0IGRvbVxyXG5cdFx0T2JqZWN0LmFzc2lnbih0aGlzLiRkb20gPSB7fSwgY3JlYXRlTGF5b3V0KCQob3B0aW9ucy5kb21FbCksIHRoaXMud2lkdGgpKTtcclxuXHJcblx0XHR0aGlzLmNvbHVtbk1vZGVsID0gbmV3IENvbE1vZGVsKG9wdGlvbnMuY29sdW1ucyk7XHJcblx0XHR0aGlzLnN0b3JlID0gbmV3IEdyaWRTdG9yZSh7IGNvbHVtbk1vZGVsOiB0aGlzLmNvbHVtbk1vZGVsLCAnZGF0YSc6IG9wdGlvbnMuZGF0YSB8fCBbXSB9KTtcclxuXHRcdHRoaXMuX2luaXQoKTtcclxuXHRcdHRoaXMuX2JpbmRFdmVudCgpO1xyXG5cdH1cclxuXHJcblx0X2luaXQoKSB7XHJcblx0XHR0aGlzLmhlYWRlciA9IG5ldyBIZWFkZXIodGhpcy4kZG9tLmhlYWRlciwgdGhpcy5jb2x1bW5Nb2RlbCk7XHJcblx0XHR2YXIgdG90YWwgPSB0aGlzLnN0b3JlLnNpemUoKTtcclxuXHRcdHZhciByb3dIZWlnaHQgPSB0aGlzLnJvd0hlaWdodCA9IGNhbGNSb3dIZWlnaHQoKTtcclxuXHRcdHZhciB2aWV3cG9ydEhlaWdodCA9IHRoaXMuaGVpZ2h0IC0gdGhpcy4kZG9tLmhlYWRlci5vdXRlckhlaWdodCgpO1xyXG5cdFx0dmFyIHNpbmdsZVBhZ2VTaXplID0gTWF0aC5taW4oTWF0aC5jZWlsKHZpZXdwb3J0SGVpZ2h0LyByb3dIZWlnaHQpIC0gMSwgdG90YWwgLSAxKTtcclxuXHJcblx0XHR0aGlzLmJ1ZmZlclpvbmUgPSBuZXcgQnVmZmVyWm9uZShzaW5nbGVQYWdlU2l6ZSwgdG90YWwpO1xyXG5cdFx0dGhpcy5idWZmZXJOb2RlID0gbmV3IEJ1ZmZlck5vZGUoc2luZ2xlUGFnZVNpemUsIHRoaXMuY29sdW1uTW9kZWwsIHRvdGFsKTtcclxuXHRcdHRoaXMuc2Nyb2xsZXIgPSBuZXcgU2Nyb2xsZXIocm93SGVpZ2h0LCB0aGlzLmJ1ZmZlclpvbmUpO1xyXG5cdFx0dGhpcy5zY3JvbGxlclxyXG5cdFx0XHQub25YKHggPT4ge1xyXG5cdFx0XHRcdHRoaXMuZmlyZSgnc2Nyb2xsTGVmdCcsIHgpO1xyXG5cdFx0XHRcdHRoaXMuJGRvbS5oZWFkZXIuc2Nyb2xsTGVmdCh4KTtcclxuXHRcdFx0fSlcclxuXHRcdFx0Lm9uWSgoZGlyLCBkb21haW4sIHN0YXJ0LCBlbmQsIGluZGV4LCB0b3RhbCkgPT4ge1xyXG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKGDmu5rliqjmlrnlkJHvvJoke2Rpcn0sIOWKoOi9veWMuumXtDogWyR7ZG9tYWlufV0sIOeOsOacieiMg+WbtO+8migke3N0YXJ0fSAtICR7ZW5kfSksIGApXHJcblx0XHRcdFx0dGhpcy5fYnVmZmVyUmVuZGVyKGRpciwgZG9tYWluKTtcclxuXHRcdFx0fSwgMjApO1xyXG5cclxuXHRcdHRoaXMuJGRvbS52aWV3cG9ydC5oZWlnaHQodmlld3BvcnRIZWlnaHQpO1xyXG5cdFx0dGhpcy4kZG9tLnZpZXdwb3J0Lm9uKCdzY3JvbGwnLCAoZXZ0KSA9PiB7XHJcblx0XHRcdHRoaXMuc2Nyb2xsZXIuZmlyZVkoZXZ0LnRhcmdldC5zY3JvbGxUb3ApO1xyXG5cdFx0XHR0aGlzLnNjcm9sbGVyLmZpcmVYKGV2dC50YXJnZXQuc2Nyb2xsTGVmdCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmxvY2tDb2xNYW5hZ2VyID0gTG9ja0NvbE1hbmFnZXIodGhpcy5jb2x1bW5Nb2RlbCwgdGhpcy5oZWFkZXIsIHRoaXMuJGRvbSwgdGhpcy5idWZmZXJOb2RlKTtcclxuXHRcdHRoaXMuX3NldENhbnZhc1dIKHRvdGFsKTtcclxuXHR9XHJcblxyXG5cdF9zZXRDYW52YXNXSCh0b3RhbCkge1xyXG5cdFx0dGhpcy4kZG9tLmNhbnZhc1xyXG5cdFx0XHQud2lkdGgodG90YWwgPyAnYXV0bycgOiB0aGlzLl91bkxvY2tWaXNpYmxlQ29sc1dpZHRoKCkpXHJcblx0XHRcdC5oZWlnaHQodGhpcy5yb3dIZWlnaHQgKiB0b3RhbCB8fCAxKTtcclxuXHR9XHJcblxyXG5cdF91bkxvY2tWaXNpYmxlQ29sc1dpZHRoKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuaGVhZGVyLmdldFZpc2libGVDb2xzV2lkdGgoKSArIHRoaXMubG9ja0NvbE1hbmFnZXIudmlzaWJsZUxvY2tDb2x1bW4uZ2V0V2lkdGgoKTtcclxuXHR9XHJcblxyXG5cdHNjcm9sbFRvVG9wKHBvc2l0aW9uKSB7XHJcblx0XHR0aGlzLiRkb20udmlld3BvcnQuc2Nyb2xsVG9wKHBvc2l0aW9uKTtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHR0aGlzLm9uKCd2aWV3cG9ydC1oZWlnaHQtY2hhbmdlZCcsIHZpZXdwb3J0SGVpZ2h0ID0+IHtcclxuXHRcdFx0dGhpcy5fdXBkYXRlQnVmZmVyKCk7XHJcblx0XHRcdHRoaXMucmVuZGVyKCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLm9uKCdzY3JvbGxMZWZ0JywgeCA9PiB7XHJcblx0XHRcdC8vIHBlcmZvcm1hbmNlIFRPRE9cclxuXHRcdFx0Ly8gbGV0IGxvY2tDb2x1bW5XaWR0aCA9IHRoaXMuaGVhZGVyLmdldFZpc2libGVMb2NrQ29sc1dpZHRoKCk7XHJcblx0XHRcdC8vIHRoaXMuJGRvbS5jYW52YXMuZmluZCgnLmMtY29sdW1uLWxvY2tlZCcpLmNzcygnbGVmdCcsIHggLSBsb2NrQ29sdW1uV2lkdGgpO1xyXG5cdFx0XHQvLyB0aGlzLiRkb20uaGVhZGVyLmZpbmQoJy5jLWNvbHVtbi1sb2NrZWQnKS5jc3MoJ2xlZnQnLCB4IC0gbG9ja0NvbHVtbldpZHRoKTtcclxuXHRcdFx0dGhpcy5sb2NrQ29sTWFuYWdlci5zZXRMb2NrQ29sdW1uWCh4KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuc3RvcmUub24oJ2RhdGEtY2hhbmdlZCcsIChhcHBlbmQpID0+IHtcclxuXHRcdFx0bGV0IHRvdGFsID0gdGhpcy5zdG9yZS5zaXplKCk7XHJcblx0XHRcdHRoaXMuX3NldENhbnZhc1dIKHRvdGFsKTtcclxuXHRcdFx0dGhpcy5idWZmZXJOb2RlLnNldFRvdGFsKHRvdGFsKTtcclxuXHRcdFx0dGhpcy5idWZmZXJab25lLnNldFRvdGFsKHRvdGFsKTtcclxuXHJcblx0XHRcdGlmICghYXBwZW5kIHx8ICh0b3RhbCAtIDEpICogdGhpcy5yb3dIZWlnaHQgPCAyKnRoaXMuJGRvbS52aWV3cG9ydC5vdXRlckhlaWdodCgpKSB7XHJcblx0XHRcdFx0dGhpcy5fdXBkYXRlQnVmZmVyKCk7XHJcblx0XHRcdFx0dGhpcy5yZW5kZXIoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblxyXG5cdH1cclxuXHJcblx0X3VwZGF0ZUJ1ZmZlcigpIHtcclxuXHRcdHZhciBsaW1pdCA9IE1hdGgubWluKFxyXG5cdFx0XHRNYXRoLmNlaWwodGhpcy4kZG9tLnZpZXdwb3J0Lm91dGVySGVpZ2h0KCkgLyB0aGlzLnJvd0hlaWdodCkgLSAxLFxyXG5cdFx0XHR0aGlzLnN0b3JlLnNpemUoKSAtIDEpO1xyXG5cclxuXHRcdHRoaXMuYnVmZmVyWm9uZS5zZXRMaW1pdChsaW1pdCk7XHJcblx0XHR0aGlzLmJ1ZmZlck5vZGUuc2V0TGltaXQobGltaXQpO1xyXG5cdFx0dGhpcy5zaG91bGRBZGROb2RlcyA9IHRydWU7XHJcblx0XHR0aGlzLnNjcm9sbFRvVG9wKDApO1xyXG5cclxuXHRcdHRoaXMuJGRvbS5jYW52YXMuZW1wdHkoKTtcclxuXHR9XHJcblxyXG5cdF9idWZmZXJSZW5kZXIoZGlyLCBbc3RhcnQsIGVuZF0pIHtcclxuXHRcdHZhciBub2RlcyA9IHRoaXMuYnVmZmVyTm9kZS5nZXQoZGlyLCBbc3RhcnQsIGVuZF0pO1xyXG5cdFx0Y29uc29sZS5sb2coJ+S4gOasoeiOt+WPluiKgueCuemVv+W6picsIG5vZGVzLmxlbmd0aCwgc3RhcnQsIGVuZCk7XHJcblxyXG5cdFx0aWYgKCF0aGlzLnNob3VsZEFkZE5vZGVzKSB7XHJcblx0XHRcdHRoaXMuc3RvcmUuc2xpY2Uoc3RhcnQsIGVuZCArIDEpLmZvckVhY2goKHJvd00sIGkpID0+IHtcclxuXHRcdFx0XHRub2Rlc1tpXS5zZXREYXRhKHJvd00sIHJvd00ucmlkICogdGhpcy5yb3dIZWlnaHQpO1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHZhciAkZG9jRnJhbWUgPSAkKCc8ZGl2Lz4nKTtcclxuXHRcdHRoaXMuc3RvcmUuc2xpY2Uoc3RhcnQsIGVuZCArIDEpLmZvckVhY2goKHJvd00sIGkpID0+IHtcclxuXHJcblx0XHRcdGxldCBub2RlID0gbm9kZXNbaV0uc2V0RGF0YShyb3dNLCByb3dNLnJpZCAqIHRoaXMucm93SGVpZ2h0KTtcclxuXHRcdFx0JGRvY0ZyYW1lLmFwcGVuZChub2RlKTtcclxuXHRcdFxyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kZG9tLmNhbnZhcy5hcHBlbmQoJGRvY0ZyYW1lLmNoaWxkcmVuKCkpO1xyXG5cdFx0dGhpcy5sb2NrQ29sTWFuYWdlci5hZGRCdWZmZXJMb2NrTm9kZShub2Rlcyk7XHJcblxyXG5cdFx0aWYgKHRoaXMuYnVmZmVyTm9kZS5pc0Vub3VnaCgpKSB7XHJcblx0XHRcdHRoaXMuc2hvdWxkQWRkTm9kZXMgPSBmYWxzZTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJlbmRlcigpIHtcclxuXHRcdHRoaXMuX2J1ZmZlclJlbmRlcigxLCB0aGlzLmJ1ZmZlclpvbmUuZG9tYWluKTtcclxuXHR9XHJcblxyXG5cdHNldFdpZHRoKG51bSkge1xyXG5cdFx0aWYgKGlzTmFOKG51bSkpIHJldHVybjtcclxuXHJcblx0XHR0aGlzLiRkb20ud3JhcHBlci53aWR0aChudW0pO1xyXG5cdH1cclxuXHJcblx0c2V0SGVpZ2h0KG51bSkge1xyXG5cdFx0aWYgKGlzTmFOKG51bSkpIHJldHVybjtcclxuXHJcblx0XHR2YXIgdmlld3BvcnRIZWlnaHQgPSBudW0gLSB0aGlzLiRkb20uaGVhZGVyLm91dGVySGVpZ2h0KCk7XHJcblx0XHR0aGlzLiRkb20udmlld3BvcnQub3V0ZXJIZWlnaHQodmlld3BvcnRIZWlnaHQpO1xyXG5cdFx0dGhpcy5maXJlKCd2aWV3cG9ydC1oZWlnaHQtY2hhbmdlZCcsIHZpZXdwb3J0SGVpZ2h0KTtcclxuXHR9XHJcblxyXG5cdGRlc3RvcnkoKSB7XHJcblx0XHR0aGlzLmNvbHVtbk1vZGVsLmRlc3RvcnkoKTtcclxuXHRcdHRoaXMuc3RvcmUuZGVzdG9yeSgpO1xyXG5cdFx0dGhpcy5oZWFkZXIuZGVzdG9yeSgpO1xyXG5cdFx0dGhpcy4kZG9tLndyYXBwZXIucmVtb3ZlKCk7XHJcblx0fVxyXG59XHJcbm1vZHVsZS5leHBvcnRzID0gR3JpZENvbXBvbmVudDsiLCJjb25zdCAkID0gcmVxdWlyZSgnLi4vdXRpbC9zaGltJykuJDtcclxuY29uc3QgREQgPSByZXF1aXJlKCcuLi91dGlsL0REJyk7XHJcblxyXG5jb25zdCBTT1JUX0NMU19BU0MgPSAnYy1jb2x1bW4tYXNjJztcclxuY29uc3QgU09SVF9DTFNfREVTQyA9ICdjLWNvbHVtbi1kZXNjJztcclxuY29uc3QgTkVFRExFU1NfV0lEVEggPSAxMDAwO1xyXG5cclxudmFyIGNyZWF0ZUNvbHVtbkVsZW1lbnQgPSBmdW5jdGlvbihjb2xNKSB7XHJcblx0dmFyIGxvY2tDbGFzcyA9IGNvbE0ubG9ja2VkID8gJyBjLWNvbHVtbi1sb2NrZWQnIDogJyc7XHJcblxyXG5cdHJldHVybiAkKCc8bGkvPicpXHJcblx0XHQuYWRkQ2xhc3MoJ2MtaGVhZGVyLWNlbGwnICsgbG9ja0NsYXNzKVxyXG5cdFx0LmFkZENsYXNzKCdjLWFsaWduLScgKyBjb2xNLmFsaWduKVxyXG5cdFx0LndpZHRoKGNvbE0ud2lkdGgpXHJcblx0XHQub24oJ2NsaWNrJywgKCkgPT4geyBjb2xNLnNvcnQoKTsgfSlcclxuXHRcdC5kYXRhKCdjb2x1bW4nLCBjb2xNKVxyXG5cdFx0Lmh0bWwoY29sTS50ZXh0KTtcclxufTtcclxuXHJcblxyXG5jbGFzcyBIZWFkZXIge1xyXG5cdGNvbnN0cnVjdG9yKCRoZWFkZXIsIGNvbHNNb2RlbCkge1xyXG5cclxuXHRcdHRoaXMuJGhlYWRlciA9ICRoZWFkZXI7XHJcblx0XHR0aGlzLmNvbHNNb2RlbCA9IGNvbHNNb2RlbDtcclxuXHRcdC8vIHRoaXMuc3RvcmUgPSBzdG9yZTtcclxuXHRcdHRoaXMuY29sRWxlbWVudHMgPSBuZXcgTWFwKCk7XHJcblxyXG5cdFx0dGhpcy5fY3JlYXRlQ29sdW1uRWxlbWVudHMoKTtcclxuXHRcdHRoaXMuX2JpbmRFdmVudCgpO1xyXG5cclxuXHRcdHRoaXMucmVuZGVyKCk7XHJcblx0fVxyXG5cclxuXHRfY3JlYXRlQ29sdW1uRWxlbWVudHMoKSB7XHJcblx0XHR2YXIgd2lkdGggPSBORUVETEVTU19XSURUSDtcclxuXHJcblx0XHR0aGlzLiRyb3cgPSAkKCc8dWwvPicpLmFkZENsYXNzKCdjLWhlYWRlci1yb3cnKTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRsZXQgY29sRWxlbWVudCA9IGNyZWF0ZUNvbHVtbkVsZW1lbnQoY29sTSk7XHJcblxyXG5cdFx0XHR0aGlzLmNvbEVsZW1lbnRzLnNldChjb2xNLCBjb2xFbGVtZW50KTtcclxuXHRcdFx0dGhpcy4kcm93LmFwcGVuZChjb2xFbGVtZW50KTtcclxuXHJcblx0XHRcdHdpZHRoICs9IGNvbE0ud2lkdGg7XHJcblxyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kcm93LndpZHRoKHdpZHRoKTtcclxuXHR9XHJcblxyXG5cdGdldFZpc2libGVDb2xzV2lkdGgoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy4kcm93LndpZHRoKCkgLSBORUVETEVTU19XSURUSDtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHR0aGlzLl9jb2x1bW5SZXNpemUoKTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5vbignY29sdW1uLWFkZCcsIGNvbE0gPT4ge1xyXG5cdFx0XHRsZXQgY29sRWxlbWVudCA9IGNyZWF0ZUNvbHVtbkVsZW1lbnQoY29sTSk7XHJcblxyXG5cdFx0XHR0aGlzLmNvbEVsZW1lbnRzLnNldChjb2xNLCBjb2xFbGVtZW50KTtcclxuXHRcdFx0dGhpcy4kcm93LmFwcGVuZChjb2xFbGVtZW50KTtcclxuXHJcblx0XHRcdGxldCByb3dXID0gdGhpcy4kcm93LndpZHRoKCk7XHJcblx0XHRcdHRoaXMuJHJvdy53aWR0aChyb3dXICsgY29sTS53aWR0aCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLXJlc2l6ZWQnLCB3aWR0aCA9PiB0aGlzLmNvbEVsZW1lbnRzLmdldChjb2xNKS5vdXRlcldpZHRoKHdpZHRoKSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4taGlkZGVuJywgaXNIaWRkZW4gPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHRcdFx0XHRpZiAoaXNIaWRkZW4pIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcygnYy1jb2x1bW4taGlkZScpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoJ2MtY29sdW1uLWhpZGUnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWxvY2tlZCcsIGlzTG9ja2VkID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdGlmIChpc0xvY2tlZCkge1xyXG5cdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKCdjLWNvbHVtbi1sb2NrZWQnKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKCdjLWNvbHVtbi1sb2NrZWQnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLXNvcnQtY2hhbmdlZCcsIHNvcnRTdGF0ZSA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0XHRjb25zb2xlLmxvZyhzb3J0U3RhdGUpO1xyXG5cdFx0XHRcdGlmIChzb3J0U3RhdGUpIHtcclxuXHRcdFx0XHRcdGlmIChzb3J0U3RhdGUgPT09ICdBU0MnKSB7XHJcblx0XHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcyhTT1JUX0NMU19BU0MpO1xyXG5cdFx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoU09SVF9DTFNfREVTQyk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRjb2xFbGUuYWRkQ2xhc3MoU09SVF9DTFNfREVTQyk7XHJcblx0XHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcyhTT1JUX0NMU19BU0MpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoU09SVF9DTFNfQVNDKS5yZW1vdmVDbGFzcyhTT1JUX0NMU19ERVNDKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignZGVzdG9yeScsICgpID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblx0XHRcdFx0dGhpcy5jb2xFbGVtZW50cy5kZWxldGUoY29sTSk7XHRcdFx0XHJcblx0XHRcdFx0Y29sRWxlLnJlbW92ZSgpO1xyXG5cclxuXHRcdFx0XHRsZXQgcm93VyA9IHRoaXMuJHJvdy53aWR0aCgpO1xyXG5cdFx0XHRcdHRoaXMuJHJvdy53aWR0aChyb3dXIC0gY29sTS53aWR0aCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRfY29sdW1uUmVzaXplKCkge1xyXG5cdFx0dGhpcy4kcm93Lm9uKCdtb3VzZW1vdmUnLCAnbGkuYy1oZWFkZXItY2VsbCcsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHR2YXIgb2Zmc2V0WCA9IGV2dC5vZmZzZXRYO1xyXG5cdFx0XHRpZiAodGhpcy5vZmZzZXRXaWR0aCAtIG9mZnNldFggPD0gNSB8fCBvZmZzZXRYIDw9IDUpIHtcclxuXHRcdFx0XHQkKHRoaXMpLmFkZENsYXNzKCdjLWNvbC1yZXNpemFibGUnKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHQkKHRoaXMpLnJlbW92ZUNsYXNzKCdjLWNvbC1yZXNpemFibGUnKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblxyXG5cclxuXHRcdHZhciBzdGFydFggPSAwO1xyXG5cclxuXHRcdEREKHRoaXMuJHJvdy5maW5kKCdsaS5jLWhlYWRlci1jZWxsJyksIHtcclxuXHRcdFx0J3Jlc3RyaWN0ZXInOiBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHR2YXIgb2Zmc2V0WCA9IGV2dC5vZmZzZXRYO1xyXG5cdFx0XHRcdGlmIChldnQudGFyZ2V0Lm9mZnNlc3RXaWR0aCAtIG9mZnNldFggPD0gNSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuICQoZXZ0LnRhcmdldCk7XHJcblx0XHRcdFx0fSBlbHNlIGlmIChvZmZzZXRYIDw9IDUpIHtcclxuXHRcdFx0XHRcdHJldHVybiAkKGV2dC50YXJnZXQpLnByZXYoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sXHJcblx0XHRcdCdvbkRyYWdTdGFydCc6IGZ1bmN0aW9uKG9mZnNldCwgJHRhcmdldCkge1xyXG5cdFx0XHRcdHZhciBzY3JvbGxMZWZ0ID0gZG9jdW1lbnQuYm9keS5zY3JvbGxMZWZ0IHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0O1xyXG5cdFx0XHRcdGNvbnNvbGUubG9nKCR0YXJnZXQub2Zmc2V0KCkubGVmdCwgJHRhcmdldC50ZXh0KCkpO1xyXG5cdFx0XHRcdHN0YXJ0WCA9ICR0YXJnZXQub2Zmc2V0KCkubGVmdCAtIHNjcm9sbExlZnQ7XHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2cob2Zmc2V0LngsICR0YXJnZXQudGV4dCgpKTtcclxuXHJcblx0XHRcdFx0Ly8gc3RhcnRYID0gb2Zmc2V0Lng7XHJcblx0XHRcdH0sXHJcblx0XHRcdCdvbkRyYWdnaW5nJzogZnVuY3Rpb24ob2Zmc2V0LCAkdGFyZ2V0KSB7XHJcblxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnb25EcmFnRW5kJzogZnVuY3Rpb24ob2Zmc2V0LCAkdGFyZ2V0KSB7XHJcblx0XHRcdFx0dmFyIHdpZHRoID0gb2Zmc2V0LnggLSBzdGFydFg7XHJcblx0XHRcdFx0Y29uc29sZS5sb2coYCR7JHRhcmdldC50ZXh0KCl9XHJcblx0XHRcdFx0XHTljp/lrr3luqbkuLokeyR0YXJnZXQuZGF0YSgnY29sdW1uJykud2lkdGh9LFxyXG5cdFx0XHRcdFx05pS55Y+Y5Li677yaJHt3aWR0aH0sIFske29mZnNldC54fSAtICR7c3RhcnRYfV1gKTtcclxuXHRcdFx0XHQkdGFyZ2V0LmRhdGEoJ2NvbHVtbicpLnNldFdpZHRoKHdpZHRoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRyZW5kZXIoKSB7XHJcblx0XHR0aGlzLiRoZWFkZXIuYXBwZW5kKHRoaXMuJHJvdyk7XHJcblx0fVxyXG5cclxuXHRkZXN0b3J5KCkge1xyXG5cclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gSGVhZGVyOyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbmNsYXNzIExvY2tDb2x1bW4ge1xyXG5cdGNvbnN0cnVjdG9yKCkge1xyXG5cdFx0dGhpcy5fZGF0YSA9IFtdO1xyXG5cdFx0dGhpcy5fY29sdW1uc1dpZHRoID0gMDtcclxuXHR9XHJcblxyXG5cdGFkZChjb2xNKSB7XHJcblx0XHR0aGlzLl9kYXRhLnVuc2hpZnQoY29sTSk7XHJcblx0XHR0aGlzLnJlQ2FsYygpO1xyXG5cdH1cclxuXHJcblx0cmVtb3ZlKGRlbENvbE0pIHtcclxuXHRcdHRoaXMuX2RhdGEgPSB0aGlzLl9kYXRhLmZpbHRlcihjb2xNID0+IGNvbE0gIT09IGRlbENvbE0pO1xyXG5cdFx0dGhpcy5yZUNhbGMoKTtcclxuXHR9XHJcblxyXG5cdGNsZWFyKCkge1xyXG5cdFx0dGhpcy5fZGF0YS5sZW5ndGggPSAwO1xyXG5cdFx0dGhpcy5yZUNhbGMoKTtcclxuXHR9XHJcblxyXG5cdGdldFdpZHRoKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuX2NvbHVtbnNXaWR0aDtcclxuXHR9XHJcblxyXG5cdHJlQ2FsYygpIHtcclxuXHRcdHRoaXMuX2NvbHVtbnNXaWR0aCA9IHRoaXMuX2RhdGEucmVkdWNlKCh3aWR0aCwgY29sTSkgPT4ge1xyXG5cdFx0XHR3aWR0aCAtPSBjb2xNLndpZHRoO1xyXG5cdFx0XHRjb2xNLmF3YXlGcm9tTGVmdCA9IHdpZHRoO1xyXG5cdFx0XHRyZXR1cm4gd2lkdGg7XHJcblx0XHR9LCAwKTtcclxuXHR9XHJcblxyXG5cdGVhY2goZm4pIHtcclxuXHRcdHRoaXMuX2RhdGEuZm9yRWFjaChmbik7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiDlvZPlhbbkuK3kuIDliJflj5HnlJ/lj5jljJbvvIzpgJrnn6XlhbblroPliJfnm7jlupTlj5jljJZcclxuXHQgKi9cclxuXHQgcHVibGlzaChjaGFuZ2VkQ29sTSwgc2Nyb2xsTGVmdCkge1xyXG5cdCBcdHRoaXMuX2RhdGEuZm9yRWFjaChjb2xNID0+IHtcclxuXHQgXHRcdGlmIChjb2xNICE9PSBjaGFuZ2VkQ29sTSkge1xyXG5cdCBcdFx0XHRjb2xNLmZpcmUoJ3Njcm9sbC14Jywgc2Nyb2xsTGVmdCk7XHJcblx0IFx0XHR9XHJcblx0IFx0fSk7XHJcblx0IH1cclxufVxyXG5cclxudmFyIExvY2tDb2xNYW5hZ2VyID0gZnVuY3Rpb24oY29sc01vZGVsLCBoZWFkZXIsICRkb20sIGJ1ZmZlck5vZGUpIHtcclxuXHRsZXQgdmlzaWJsZUxvY2tDb2x1bW4gPSBuZXcgTG9ja0NvbHVtbigpO1xyXG5cclxuXHRpbml0KCk7XHJcblx0aW5pdEV2ZW50KCk7XHJcblxyXG5cdGZ1bmN0aW9uIGluaXQoKSB7XHJcblx0XHRjb2xzTW9kZWxcclxuXHRcdFx0LmdldExvY2tDb2x1bW4oKVxyXG5cdFx0XHQuZmlsdGVyKGNvbE0gPT4gIWNvbE0uaGlkZGVuKVxyXG5cdFx0XHQuZm9yRWFjaChjb2xNID0+IHZpc2libGVMb2NrQ29sdW1uLmFkZChjb2xNKSk7XHJcblxyXG5cdFx0dXBkYXRlQm94U2l6ZSgpO1xyXG5cclxuXHRcdHZpc2libGVMb2NrQ29sdW1uLmVhY2goY29sTSA9PiB7XHJcblx0XHRcdGxldCBoZWFkZXJFbGVtZW50ID0gaGVhZGVyLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHRcdFx0Ly8g6K6+572u5bm26K6w5b2V5Yid5aeL55qE5bem5L6n5L2NXHJcblx0XHRcdGhlYWRlckVsZW1lbnQuY3NzKCdsZWZ0JywgY29sTS5hd2F5RnJvbUxlZnQpO1xyXG5cclxuXHRcdFx0Y29sTS5vbignc2Nyb2xsLXgnLCB4ID0+IHtcclxuXHRcdFx0XHRsZXQgbGVmdFN0eWxlID0geyAnbGVmdCc6IHggKyBjb2xNLmF3YXlGcm9tTGVmdCB9O1xyXG5cclxuXHRcdFx0XHRoZWFkZXJFbGVtZW50LmNzcyhsZWZ0U3R5bGUpO1xyXG5cdFx0XHRcdGJ1ZmZlck5vZGUuZ2V0Tm9kZUxpc3QoKS5mb3JFYWNoKG5vZGUgPT4gbm9kZS5jaGlsZHJlbi5nZXQoY29sTSkuY3NzKGxlZnRTdHlsZSkpO1x0XHRcdFx0XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpbml0RXZlbnQoKSB7XHJcblxyXG5cdFx0Y29uc3QgY29sdW1uTG9ja09yVW5Mb2NrID0gKGlzTG9ja2VkLCBjb2xNKSA9PiB7XHJcblx0XHRcdGxldCBoZWFkZXJFbGVtZW50ID0gaGVhZGVyLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHJcblx0XHRcdGlmIChpc0xvY2tlZCkge1xyXG5cdFx0XHRcdHZpc2libGVMb2NrQ29sdW1uLmFkZChjb2xNKTtcclxuXHJcblx0XHRcdFx0Y29sTS5vbignc2Nyb2xsLXgnLCB4ID0+IHtcclxuXHRcdFx0XHRcdGxldCBsZWZ0U3R5bGUgPSB7ICdsZWZ0JzogeCArIGNvbE0uYXdheUZyb21MZWZ0IH07XHJcblxyXG5cdFx0XHRcdFx0aGVhZGVyRWxlbWVudC5jc3MobGVmdFN0eWxlKTtcclxuXHRcdFx0XHRcdGJ1ZmZlck5vZGUuZ2V0Tm9kZUxpc3QoKS5mb3JFYWNoKG5vZGUgPT4gbm9kZS5jaGlsZHJlbi5nZXQoY29sTSkuY3NzKGxlZnRTdHlsZSkpO1xyXG5cdFx0XHRcdH0pO1xyXG5cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5yZW1vdmUoY29sTSk7XHJcblxyXG5cdFx0XHRcdGNvbE0ub2ZmKCdzY3JvbGwteCcpO1xyXG5cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bGV0IGN1cnJlbnRMZWZ0ID0gJGRvbS52aWV3cG9ydC5zY3JvbGxMZWZ0KCkgKyBjb2xNLmF3YXlGcm9tTGVmdDtcclxuXHJcblx0XHRcdC8vIOiuvue9ruW5tuiusOW9leWIneWni+eahOW3puS+p+S9jVxyXG5cdFx0XHRoZWFkZXJFbGVtZW50LmNzcygnbGVmdCcsIGN1cnJlbnRMZWZ0KTtcclxuXHRcdFx0YnVmZmVyTm9kZS5nZXROb2RlTGlzdCgpLmZvckVhY2gobm9kZSA9PiBub2RlLmNoaWxkcmVuLmdldChjb2xNKS5jc3MoJ2xlZnQnLCBjdXJyZW50TGVmdCkpO1xyXG5cclxuXHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4ucHVibGlzaChjb2xNLCAkZG9tLnZpZXdwb3J0LnNjcm9sbExlZnQoKSk7XHJcblx0XHRcdHVwZGF0ZUJveFNpemUoKTtcclxuXHRcdH07XHJcblxyXG5cdFx0Y29sc01vZGVsLm9uKCdjb2x1bW4tYWRkJywgY29sTSA9PiB7XHJcblx0XHRcdC8vIEJVR0ZJWCBUT0RPXHJcblxyXG5cdFx0XHQvLyAuLi5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWxvY2tlZCcsIGlzTG9ja2VkID0+IHtcclxuXHRcdFx0XHRjb2x1bW5Mb2NrT3JVbkxvY2soaXNMb2NrZWQsIGNvbE0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdGNvbHNNb2RlbC5nZXRDb2x1bW4oKS5mb3JFYWNoKGNvbE0gPT4ge1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLXJlc2l6ZWQnLCB3aWR0aCA9PiB7XHJcblxyXG5cdFx0XHRcdGlmIChjb2xNLmxvY2tlZCkge1xyXG5cdFx0XHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4ucmVDYWxjKCk7XHJcblx0XHRcdFx0XHRsZXQgaGVhZGVyRWxlbWVudCA9IGhlYWRlci5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdFx0bGV0IGN1cnJlbnRMZWZ0ID0gJGRvbS52aWV3cG9ydC5zY3JvbGxMZWZ0KCkgKyBjb2xNLmF3YXlGcm9tTGVmdDtcclxuXHJcblx0XHRcdFx0XHRoZWFkZXJFbGVtZW50LmNzcygnbGVmdCcsIGN1cnJlbnRMZWZ0KTtcclxuXHRcdFx0XHRcdGJ1ZmZlck5vZGUuZ2V0Tm9kZUxpc3QoKS5mb3JFYWNoKG5vZGUgPT4gbm9kZS5jaGlsZHJlbi5nZXQoY29sTSkuY3NzKCdsZWZ0JywgY3VycmVudExlZnQpKTtcclxuXHJcblx0XHRcdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5wdWJsaXNoKGNvbE0sICRkb20udmlld3BvcnQuc2Nyb2xsTGVmdCgpKTtcclxuXHRcdFx0XHRcdHVwZGF0ZUJveFNpemUoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFxyXG5cdFx0XHR9KTtcclxuXHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tbG9ja2VkJywgaXNMb2NrZWQgPT4ge1xyXG5cdFx0XHRcdC8vIC4uLlxyXG5cdFx0XHRcdGNvbHVtbkxvY2tPclVuTG9jayhpc0xvY2tlZCwgY29sTSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0XHRcclxuXHRcdGJ1ZmZlck5vZGUub24oJ2J1ZmZlci1pbml0aWFsJywgKCkgPT4ge1xyXG5cdFx0XHQvLyBjbGVhckJ1ZmZlckxvY2tOb2RlKCk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHVwZGF0ZUJveFNpemUoKSB7XHJcblx0XHR2YXIgdmlzaWJsZUxvY2tDb2xzV2lkdGggPSB2aXNpYmxlTG9ja0NvbHVtbi5nZXRXaWR0aCgpO1xyXG5cdFx0aGVhZGVyLiRoZWFkZXIuY3NzKCdwYWRkaW5nLWxlZnQnLCAtdmlzaWJsZUxvY2tDb2xzV2lkdGgpO1xyXG5cdFx0JGRvbS5jYW52YXMuY3NzKCdtYXJnaW4tbGVmdCcsIC12aXNpYmxlTG9ja0NvbHNXaWR0aCk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4ge1xyXG5cdFx0dmlzaWJsZUxvY2tDb2x1bW4sXHJcblx0XHRzZXRMb2NrQ29sdW1uWChzY3JvbGxMZWZ0KSB7XHJcblx0XHRcdHZpc2libGVMb2NrQ29sdW1uLmVhY2goY29sTSA9PiBjb2xNLmZpcmUoJ3Njcm9sbC14Jywgc2Nyb2xsTGVmdCkpO1xyXG5cdFx0fSxcclxuXHJcblx0XHRhZGRCdWZmZXJMb2NrTm9kZShyb3dOb2Rlcykge1xyXG5cdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRcdHJvd05vZGVzLmZvckVhY2gocm93Tm9kZXMgPT4ge1xyXG5cdFx0XHRcdFx0bGV0IGNvbEVsZSA9IGhlYWRlci5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblx0XHRcdFx0XHRsZXQgY2VsbEVsZW1lbnQgPSByb3dOb2Rlcy5jaGlsZHJlbi5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdFx0Y2VsbEVsZW1lbnQuY3NzKCdsZWZ0JywgJGRvbS52aWV3cG9ydC5zY3JvbGxMZWZ0KCkgKyBjb2xNLmF3YXlGcm9tTGVmdCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSxcclxuXHJcblx0XHRjbGVhckJ1ZmZlckxvY2tOb2RlKCkge1xyXG5cdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5jbGVhcigpO1xyXG5cdFx0fVxyXG5cclxuXHR9O1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBMb2NrQ29sTWFuYWdlcjsiLCIvLyBUT0RPXHJcbnZhciBkZWJvdW5jZSA9IGZ1bmN0aW9uKGZuLCB0aW1lKSB7XHJcblx0dmFyIHRpbWVyID0gbnVsbDtcclxuXHRyZXR1cm4gZnVuY3Rpb24oLi4uYXJncykge1xyXG5cdFx0aWYgKHRpbWVyKSBjbGVhclRpbWVvdXQodGltZXIpO1xyXG5cclxuXHRcdHRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XHJcblx0XHRcdGZuLmFwcGx5KG51bGwsIGFyZ3MpO1xyXG5cdFx0fSwgdGltZSk7XHJcblx0fVxyXG59XHJcblxyXG4vL+ino+WGs3JlcXVlc3RBbmltYXRpb25GcmFtZeWFvOWuuemXrumimFxyXG52YXIgcmFGcmFtZSA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcclxuICAgICAgICAgICAgICB3aW5kb3cud2Via2l0UmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XHJcbiAgICAgICAgICAgICAgd2luZG93Lm1velJlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxyXG4gICAgICAgICAgICAgIHdpbmRvdy5vUmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XHJcbiAgICAgICAgICAgICAgd2luZG93Lm1zUmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XHJcbiAgICAgICAgICAgICAgZnVuY3Rpb24oY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgICAgd2luZG93LnNldFRpbWVvdXQoY2FsbGJhY2ssIDEwMDAgLyA2MCk7XHJcbiAgICAgICAgICAgICAgfTtcclxuXHJcbi8v5p+v6YeM5YyW5bCB6KOFXHJcbnZhciB0aHJvdHRsZSA9IGZ1bmN0aW9uKGZuKSB7XHJcbiAgICBsZXQgaXNMb2NrZWQ7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24oLi4uYXJncykge1xyXG5cclxuICAgICAgICBpZihpc0xvY2tlZCkgcmV0dXJuIFxyXG5cclxuICAgICAgICBpc0xvY2tlZCA9IHRydWU7XHJcbiAgICAgICAgcmFGcmFtZSgoKSA9PiB7XHJcbiAgICAgICAgICAgIGlzTG9ja2VkID0gZmFsc2U7XHJcbiAgICAgICAgICAgIGZuLmFwcGx5KHRoaXMsIGFyZ3MpXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5jbGFzcyBTY3JvbGxlciB7XHJcblx0Y29uc3RydWN0b3IobGluZUhlaWdodCwgYnVmZmVyWm9uZSkge1xyXG5cclxuXHRcdHRoaXMuYnVmZmVyWm9uZSA9IGJ1ZmZlclpvbmU7XHJcblx0XHR0aGlzLnlEaXIgPSAwOyAvLyAxOuWQkeS4iu+8jDAsLTE65ZCR5LiLXHJcblx0XHR0aGlzLnlQcmVJbmRleCA9IDA7IC8vIOS4iuS4gOS4quS9jee9rlxyXG5cdFx0dGhpcy5saW5lSGVpZ2h0ID0gbGluZUhlaWdodDtcclxuXHJcblx0XHR0aGlzLnhEaXIgPSAwOyAvLyAx77ya5ZCR5bem77yMMO+8jC0x77ya5ZCR5Y+zXHJcblx0XHR0aGlzLnhQcmVJbmRleCA9IDA7IC8vIOWJjeS4gOS4quS9jee9rlxyXG5cclxuXHRcdHRoaXMuX3RyaWdnZXJYID0geCA9PiB4O1xyXG5cdFx0dGhpcy5fdHJpZ2dlclkgPSB5ID0+IHk7XHJcblxyXG5cdH1cclxuXHJcblx0b25YKGNhbGxiYWNrKSB7XHJcblx0XHR0aGlzLl90cmlnZ2VyWCA9IHggPT4ge1xyXG5cdFx0XHRpZiAoeCA9PT0gdGhpcy54UHJlSW5kZXgpIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMueERpciA9IHggLSB0aGlzLnhQcmVJbmRleDtcclxuXHRcdFx0dGhpcy54UHJlSW5kZXggPSB4O1xyXG5cclxuXHRcdFx0Y2FsbGJhY2soeCk7XHJcblx0XHR9O1xyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0b25ZKGhhbmRsZXIsIGRlbGF5KSB7XHJcblx0XHQvLyBUT0RPXHJcblx0XHQvLyB2YXIgZGVhbHlGbiA9IGRlYm91bmNlKGhhbmRsZXIsIGRlbGF5KTtcclxuXHJcblx0XHR0aGlzLl90cmlnZ2VyWSA9IGRlYm91bmNlKCh5KSA9PiB7XHJcblx0XHRcdHRoaXMueURpciA9IHkgLSB0aGlzLnlQcmVJbmRleDtcclxuXHRcdFx0dGhpcy55UHJlSW5kZXggPSB5O1xyXG5cclxuXHRcdFx0dmFyIGluZGV4ID0gfn4oeS8gdGhpcy5saW5lSGVpZ2h0KTtcclxuXHRcdFx0dmFyIHdpbGxMb2FkID0gdGhpcy5idWZmZXJab25lLnNob3VsZExvYWQodGhpcy55RGlyLCBpbmRleCk7XHJcblxyXG5cdFx0XHRpZiAod2lsbExvYWQpIHtcclxuXHRcdFx0XHQvLyBkZWFseUZuKCk7XHJcblx0XHRcdFx0aGFuZGxlcihcclxuXHRcdFx0XHRcdHRoaXMueURpciA+IDAgPyAxIDogLTEsXHJcblx0XHRcdFx0XHR0aGlzLmJ1ZmZlclpvbmUuZG9tYWluLFxyXG5cdFx0XHRcdFx0dGhpcy5idWZmZXJab25lLnN0YXJ0LFxyXG5cdFx0XHRcdFx0dGhpcy5idWZmZXJab25lLmVuZCxcclxuXHRcdFx0XHRcdGluZGV4LFxyXG5cdFx0XHRcdFx0dGhpcy5idWZmZXJab25lLnRvdGFsXHJcblx0XHRcdFx0KTtcclxuXHRcdFx0fVxyXG5cdFx0fSwgZGVsYXkpO1xyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0ZmlyZVgoeCkge1xyXG5cdFx0dGhpcy5fdHJpZ2dlclgoeCk7XHJcblx0fVxyXG5cclxuXHRmaXJlWSh5KSB7XHJcblx0XHR0aGlzLl90cmlnZ2VyWSh5KTtcclxuXHR9XHJcblxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBTY3JvbGxlcjsiLCJ2YXIgU2VsZWN0aW9uID0gcmVxdWlyZSgnLi9TZWxlY3Rpb24nKTtcclxudmFyIE1lbnUgPSByZXF1aXJlKCcuLi9wbHVnaW4vTWVudScpO1xyXG52YXIgJCAgPSByZXF1aXJlKCcuLi91dGlsL3NoaW0nKS4kO1xyXG5cclxuY29uc3QgZGVmSGVhZGVyQ29udGV4dE1lbnUgPSBbeyBcclxuXHRcdHRleHQ6ICdsb2NrJywgXHJcblx0XHRoYW5kbGVyOiBmdW5jdGlvbihpbmZvLCBjb250ZXh0LCBldnQpIHtcclxuXHRcdFx0aW5mby5jb2x1bW4ubG9jaygpO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0dGV4dDogJ3VubG9jaycsIFxyXG5cdFx0aGFuZGxlcjogZnVuY3Rpb24oaW5mbywgY29udGV4dCwgZXZ0KSB7IFxyXG5cdFx0XHRpbmZvLmNvbHVtbi51bkxvY2soKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdHNlcGFyYXRvcjogdHJ1ZSBcclxuXHR9LCB7IFxyXG5cdFx0dGV4dDogJ3Nob3cnLCBcclxuXHRcdGhhbmRsZXI6IGZ1bmN0aW9uKGluZm8sIGNvbnRleHQsIGV2dCkgeyBcclxuXHRcdFx0aW5mby5jb2x1bW4uc2hvdygpO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0dGV4dDogJ2hpZGUnLCBcclxuXHRcdGhhbmRsZXI6IGZ1bmN0aW9uKGluZm8sIGNvbnRleHQsIGV2dCkgeyBcclxuXHRcdFx0aW5mby5jb2x1bW4uaGlkZSgpO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0dGV4dDogJ2xvY2F0b3InLCBcclxuXHRcdGRpc2FibGVkOiB0cnVlLFxyXG5cdFx0aGFuZGxlcjogZnVuY3Rpb24oaW5mbywgY29udGV4dCwgZXZ0KSB7IFxyXG5cdFx0XHQvLyBUT0RPXHJcblx0XHRcdGNvbnRleHQuc2Nyb2xsVG9Ub3AoTWF0aC5yYW5kb20oKSAqIDMwMDAwKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdHRleHQ6ICdzZWxlY3QgY29sdW1uJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBcclxuXHRcdFx0Ly8gYWxlcnQoc2VsZi5zdG9yZS5zaXplKCkpO1xyXG5cdFx0XHRjb250ZXh0Ll9zdGFydCA9IFtpbmZvLmNvbHVtbi5kYXRhSW5kZXgsIDBdO1xyXG5cdFx0XHRjb250ZXh0Ll9lbmQgPSBbaW5mby5jb2x1bW4uZGF0YUluZGV4LCBjb250ZXh0LnN0b3JlLnNpemUoKSAtIDFdO1xyXG5cclxuXHRcdFx0Y29udGV4dC5zZWxlY3Rpb25SYW5nZShjb250ZXh0Ll9zdGFydCwgY29udGV4dC5fZW5kKTtcclxuXHRcdH0gXHJcblx0fSwgeyBcclxuXHRcdGNsczogJ251bWJlci1jb2x1bW4nLFxyXG5cdFx0dGV4dDogJ2NvdW50JywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBcclxuXHRcdFx0YWxlcnQoY29udGV4dC5zdG9yZS5zaXplKCkpO1xyXG5cdFx0fSBcclxuXHR9LCB7IFxyXG5cdFx0Y2xzOiAnbnVtYmVyLWNvbHVtbicsXHJcblx0XHR0ZXh0OiAnY291bnQnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7XHJcblx0XHRcdGFsZXJ0KGNvbnRleHQuc3RvcmUuc2l6ZSgpKTtcclxuXHRcdH0gXHJcblx0fV07XHJcblxyXG5jb25zdCBkZWZDZWxsQ29udGV4dE1lbnUgPSBbe1xyXG5cdFx0dGV4dDogJ2xvY2sgcm93IHRvIHRvcCcsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgY29uc29sZS5sb2coY29udGV4dC5fc2VsZWN0aW9uKTsgfSBcclxuXHR9LHsgXHJcblx0XHR0ZXh0OiAnbG9jayByb3cgdG8gYm90dG9tJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBjb25zb2xlLmxvZyhjb250ZXh0Ll9zZWxlY3Rpb24pOyB9IFxyXG5cdH0seyBcclxuXHRcdHRleHQ6ICdzZWFyY2gnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IGNvbnNvbGUubG9nKGNvbnRleHQuX3NlbGVjdGlvbik7IH0gXHJcblx0fSx7IFxyXG5cdFx0dGV4dDogJ21hcmsnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IGNvbnNvbGUubG9nKGNvbnRleHQuX3NlbGVjdGlvbik7IH0gXHJcblx0fV07XHRcclxuXHJcbmNvbnN0IGRlZlNlbGVjdGlvbkNvbnRleHRNZW51ID0gW3sgXHJcblx0XHR0ZXh0OiAnY29weScsIFxyXG5cdFx0aGFuZGxlcihpbmZvLCBjb250ZXh0LCBldnQpIHsgY29uc29sZS5sb2coaW5mbywgY29udGV4dC5fc2VsZWN0aW9uKTsgfSBcclxuXHR9LHsgXHJcblx0XHR0ZXh0OiAncHJpbnQnLCBcclxuXHRcdGhhbmRsZXIoaW5mbywgY29udGV4dCwgZXZ0KSB7IFxyXG5cdFx0XHRjb25zb2xlLmxvZyhldnQsIGRhdGEsIGNvbnRleHQpO1xyXG5cdFx0fSBcclxuXHR9LHsgXHJcblx0XHR0ZXh0OiAnZXhwb3J0JywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBjb25zb2xlLmxvZyhjb250ZXh0Ll9zZWxlY3Rpb24pOyB9IFxyXG5cdH0seyBcclxuXHRcdHRleHQ6ICdtYXJrJywgXHJcblx0XHRoYW5kbGVyKGluZm8sIGNvbnRleHQsIGV2dCkgeyBjb25zb2xlLmxvZyhjb250ZXh0Ll9zZWxlY3Rpb24pOyB9IFxyXG5cdH1dO1xyXG5cclxuXHJcbmNsYXNzIENvbnRleHRtZW51IGV4dGVuZHMgU2VsZWN0aW9uIHtcclxuXHRjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcblx0XHRzdXBlcihvcHRpb25zKTtcclxuXHJcblx0XHR0aGlzLmNlbGxDdHhNZW51ID0gb3B0aW9ucy5iaXpDb250ZXh0TWVudS5jZWxsO1xyXG5cclxuXHRcdHRoaXMuaGVhZGVyQ3R4TWVudSA9IHtcclxuXHRcdFx0YmVmb3JlOiBmdW5jdGlvbihpbmZvLCBldnQpIHtcclxuXHRcdFx0XHRpZiAoaW5mby5jb2x1bW4udnR5cGUgPT09ICdudW1iZXInKSB7XHJcblx0XHRcdFx0XHR0aGlzLmdldENscygnLm51bWJlci1jb2x1bW4nKS5zaG93KCk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRoaXMuZ2V0Q2xzKCcubnVtYmVyLWNvbHVtbicpLmhpZGUoKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHR9XHJcblx0XHR9O1xyXG5cdH1cclxuXHJcblx0X2JpbmRFdmVudCgpIHtcclxuXHRcdHN1cGVyLl9iaW5kRXZlbnQoKTtcclxuXHJcblx0XHRsZXQgc2VsZiA9IHRoaXM7XHJcblxyXG5cdFx0dGhpcy4kY29udGV4dG1lbnVIZWFkZXIgPSBuZXcgTWVudSh0aGlzLiRkb20ud3JhcHBlciwgeyBcclxuXHRcdFx0ZGF0YTogZGVmSGVhZGVyQ29udGV4dE1lbnUsIFxyXG5cdFx0XHRjb250ZXh0OiB0aGlzIFxyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kY29udGV4dG1lbnUgPSBuZXcgTWVudSh0aGlzLiRkb20uYm9keSwgeyBcclxuXHRcdFx0ZGF0YTogW10sIFxyXG5cdFx0XHRjb250ZXh0OiB0aGlzIFxyXG5cdFx0fSk7XHJcblx0XHRcclxuXHRcdHRoaXMuJGRvbS53cmFwcGVyXHJcblx0XHRcdC5vbignY29udGV4dG1lbnUnLCAnLmMtaGVhZGVyLWNlbGwnLCBcclxuXHRcdFx0XHR0aGlzLl9oZWFkZXJDb250ZXh0TWVudS5iaW5kKHRoaXMpXHJcblx0XHRcdCk7XHJcblxyXG5cdFx0dGhpcy4kZG9tLmJvZHlcclxuXHRcdFx0Lm9uKCdjb250ZXh0bWVudScsICcuYy1ncmlkLWNlbGwnLCBcclxuXHRcdFx0XHR0aGlzLl9jZWxsQ29udGV4dE1lbnUuYmluZCh0aGlzLCBkZWZDZWxsQ29udGV4dE1lbnUpXHJcblx0XHRcdClcclxuXHRcdFx0Lm9uKCdjb250ZXh0bWVudScsICcuYy1jZWxsLXNlbGVjdGVkJywgXHJcblx0XHRcdFx0dGhpcy5fY2VsbENvbnRleHRNZW51LmJpbmQodGhpcywgZGVmU2VsZWN0aW9uQ29udGV4dE1lbnUpXHJcblx0XHRcdCk7XHJcblx0fVxyXG5cclxuXHRfaGVhZGVyQ29udGV4dE1lbnUoZXZ0KSB7XHJcblx0XHRsZXQgY29sTSA9ICQoZXZ0LnRhcmdldCkuZGF0YSgnY29sdW1uJyk7XHJcblx0XHRsZXQgbWVudSA9IHRoaXMuJGNvbnRleHRtZW51SGVhZGVyO1xyXG5cclxuXHRcdGxldCBpbmZvID0geyBcclxuXHRcdFx0J2RhdGFJbmRleCc6IGNvbE0uZGF0YUluZGV4LCBcclxuXHRcdFx0J2NvbHVtbic6IGNvbE0sXHJcblx0XHRcdCdjb250ZXh0JzogbWVudVxyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuZmlyZSgnaGVhZGVyLWNvbnRleHRtZW51JywgaW5mbywgZXZ0KTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKGluZm8pO1xyXG5cclxuXHRcdGlmICh0aGlzLmhlYWRlckN0eE1lbnUuYmVmb3JlLmNhbGwobWVudSwgaW5mbywgZXZ0KSkge1xyXG5cdFx0XHRcclxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHRtZW51LnNldEluZm8oaW5mbyk7XHJcblx0XHRcdG1lbnUuc2hvd0F0KGV2dCk7XHJcblx0XHRcclxuXHRcdFx0ZG9jRXZlbnQobWVudSk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRfY2VsbENvbnRleHRNZW51KGRlZkN0eE1lbnUsIGV2dCkge1xyXG5cdFx0bGV0ICRjZWxsID0gJChldnQudGFyZ2V0KTtcclxuXHRcdGxldCBkYXRhSW5kZXggPSAkY2VsbC5kYXRhKCdkYXRhSW5kZXgnKTtcclxuXHRcdGxldCByb3dudW1iZXIgPSArJGNlbGwucGFyZW50KCcuYy1ncmlkLXJvdycpLmF0dHIoJ3JpZCcpO1xyXG5cdFx0bGV0IG1lbnUgPSB0aGlzLiRjb250ZXh0bWVudTtcclxuXHJcblx0XHRsZXQgaW5mbyA9IHsgXHJcblx0XHRcdCd2YWx1ZSc6ICRjZWxsLnRleHQoKSxcclxuXHRcdFx0J2RhdGFJbmRleCc6IGRhdGFJbmRleCwgXHJcblx0XHRcdCdyb3dudW1iZXInOiByb3dudW1iZXIsXHJcblx0XHRcdCdjb250ZXh0JzogbWVudVxyXG5cdFx0fTtcclxuXHJcblx0XHR0aGlzLmZpcmUoJ2NlbGwtY29udGV4dG1lbnUnLCBpbmZvLCBldnQpO1xyXG5cdFx0Ly8gY29uc29sZS5sb2coaW5mbyk7XHJcblxyXG5cdFx0aWYgKHRoaXMuY2VsbEN0eE1lbnUuYmVmb3JlLmNhbGwobWVudSwgaW5mbywgZXZ0KSkge1xyXG5cclxuXHRcdFx0ZXZ0LnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHRtZW51LnNldEluZm8oaW5mbyk7XHJcblx0XHRcdG1lbnUudXBkYXRlKGRlZkN0eE1lbnUuY29uY2F0KG1lbnUuZ2V0RGF0YSgpKSk7XHJcblx0XHRcdFxyXG5cdFx0XHRtZW51LnNob3dBdChldnQpO1xyXG5cdFx0XHJcblx0XHRcdGRvY0V2ZW50KG1lbnUpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHtcclxuXHRcdHN1cGVyLmRlc3RvcnkoKTtcclxuXHJcblx0XHR0aGlzLiRjb250ZXh0bWVudUhlYWRlci5kZXN0b3J5KCk7XHJcblx0XHR0aGlzLiRjb250ZXh0bWVudS5kZXN0b3J5KCk7XHJcblx0XHR0aGlzLmNlbGxDdHhNZW51ID0gbnVsbDtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGRvY0V2ZW50KCRjb250ZXh0bWVudSkge1xyXG5cdCQoZG9jdW1lbnQpLm9uKCdtb3VzZXVwLmNvbnRleHRtZW51Jywgb25Nb3VzZURvd24uYmluZChudWxsLCAkY29udGV4dG1lbnUpKTtcclxufVxyXG5cclxuZnVuY3Rpb24gb25Nb3VzZURvd24oJGNvbnRleHRtZW51KXtcclxuICAgICRjb250ZXh0bWVudS5oaWRlKCk7XHJcbiAgICAkKGRvY3VtZW50KS5vZmYoJ21vdXNldXAuY29udGV4dG1lbnUnKTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDb250ZXh0bWVudTsiLCJ2YXIgR3JpZFZpZXcgPSByZXF1aXJlKCcuLi9jb3JlL0dyaWRWaWV3Jyk7XHJcblxyXG5jb25zdCBDRUxMX0NMUyA9ICdsaS5jLWdyaWQtY2VsbCc7XHJcbmNvbnN0IENFTExfU0VMRUNURURfQ0xTID0gJ2MtY2VsbC1zZWxlY3RlZCc7XHJcbmNvbnN0IFJPV19DTFMgPSAnLmMtZ3JpZC1yb3cnO1xyXG5cclxuY2xhc3MgU2VsZWN0aW9uIGV4dGVuZHMgR3JpZFZpZXcge1xyXG5cclxuXHRjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcblx0XHRzdXBlcihvcHRpb25zKTtcclxuXHJcblx0XHR0aGlzLl9kZWZhdWx0cygpO1xyXG5cdH1cclxuXHJcblx0X2RlZmF1bHRzKCkge1xyXG5cdFx0dGhpcy5fbW92aW5nID0gZmFsc2U7XHJcblx0XHR0aGlzLl9zdGFydCA9IG51bGw7XHJcblx0XHR0aGlzLl9lbmQgPSBudWxsO1xyXG5cdFx0dGhpcy5fbGFzdFkgPSBudWxsO1xyXG5cdFx0dGhpcy5fc2VsZWN0aW9uID0gW107XHJcblx0XHR0aGlzLl9zZWxlY3RZID0gW107XHJcblx0XHR0aGlzLl9zZWxlY3REYXRhSW5kZXggPSBbXTtcclxuXHR9XHJcblx0XHJcblx0X2JpbmRFdmVudCgpIHtcclxuXHRcdHN1cGVyLl9iaW5kRXZlbnQoKTtcclxuXHJcblx0XHRsZXQgc2VsZiA9IHRoaXM7XHJcblxyXG5cdFx0dGhpcy5jb2x1bW5Nb2RlbC5vbignbm90aWNlLWNvbE1vZGVsLXNvcnQtY2hhbmdlZCcsICgpID0+IHtcclxuXHRcdFx0dGhpcy5fZGVmYXVsdHMoKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuJGRvbS5jYW52YXNcclxuXHRcdFx0Lm9uKCdtb3VzZWRvd24nLCBDRUxMX0NMUywgZnVuY3Rpb24oZXZ0KSB7XHJcblx0XHRcdFx0aWYgKGV2dC5idXR0b24gPT09IDApIHtcclxuXHRcdFx0XHRcdHNlbGYuJGRvbS5jYW52YXMuZmluZChDRUxMX0NMUykucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHRcdFx0c2VsZi5fbW92aW5nID0gdHJ1ZTtcclxuXHRcdFx0XHRcdGxldCAkY2VsbCA9ICQodGhpcykuYWRkQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHRcdFx0c2VsZi5fc3RhcnQgPSBzZWxmLl9lbmQgPSBbJGNlbGwuZGF0YSgnZGF0YUluZGV4JyksICskY2VsbC5wYXJlbnQoUk9XX0NMUykuYXR0cigncmlkJyldO1xyXG5cdFx0XHRcdFx0Ly8gY29uc29sZS5sb2coc3RhcnQpO1xyXG5cdFx0XHRcdH0gXHJcblx0XHRcdFx0ZWxzZSBpZiAoZXZ0LmJ1dHRvbiA9PT0gMikge1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KVxyXG5cdFx0XHQub24oJ21vdXNlZW50ZXInLCBDRUxMX0NMUywgZnVuY3Rpb24oZXZ0KSB7XHJcblx0XHRcdFx0aWYgKHNlbGYuX21vdmluZykge1xyXG5cdFx0XHRcdFx0bGV0ICRjZWxsID0gJCh0aGlzKTtcclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0JGNlbGwuYWRkQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHRcdFx0c2VsZi5fZW5kID0gWyRjZWxsLmRhdGEoJ2RhdGFJbmRleCcpLCArJGNlbGwucGFyZW50KFJPV19DTFMpLmF0dHIoJ3JpZCcpXTtcclxuXHJcblx0XHRcdFx0XHRzZWxmLnNlbGVjdGlvblJhbmdlKHNlbGYuX3N0YXJ0LCBzZWxmLl9lbmQpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSlcclxuXHRcdFx0Lm9uKCdtb3VzZXVwJywgZnVuY3Rpb24oZXZ0KSB7XHJcblx0XHRcdFx0c2VsZi5fbW92aW5nID0gZmFsc2U7XHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coZW5kKTtcclxuXHRcdFx0XHRjb25zb2xlLmxvZyhzZWxmLl9zZWxlY3Rpb24pO1xyXG5cdFx0XHRcdC8vIFRPRE9cclxuXHRcdFx0XHQvLyBjb3B5KCQoJy5jZWxsLnNlbGVjdGVkJykpO1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmJ1ZmZlck5vZGUub24oJ3Jvdy11cGRhdGUtYmVmb3JlJywgKHJvd05vZGUsIHJvdykgPT4ge1xyXG5cdFx0XHQvLyBjb25zb2xlLmxvZyhyb3dOb2RlLiRub2RlLCByb3cucmlkLCB0aGlzLl9zZWxlY3RZKTtcclxuXHJcblx0XHRcdGlmICh0aGlzLl9zZWxlY3Rpb24ubGVuZ3RoID09PSAwKSByZXR1cm4gZmFsc2U7XHJcblx0XHRcdFxyXG5cdFx0XHRsZXQgaSA9IHJvdy5yaWQ7XHJcblx0XHRcdGxldCBbeTAsIHkxXSA9IHRoaXMuX3NlbGVjdFk7XHJcblx0XHRcdGxldCBjb2xzID0gdGhpcy5fc2VsZWN0RGF0YUluZGV4O1xyXG5cclxuXHRcdFx0aWYgKGkgPj0geTAgJiYgaSA8IHkxICsgMSkge1xyXG5cdFx0XHRcdGNvbHMuZm9yRWFjaCgoY29sKSA9PiB7XHJcblx0XHRcdFx0XHRyb3dOb2RlLmNoaWxkcmVuLmZvckVhY2goKCRjZWxsLCBjb2xNKSA9PiB7XHJcblx0XHRcdFx0XHRcdGlmIChjb2xzLmluZGV4T2YoY29sTS5kYXRhSW5kZXgpICE9IC0xKSB7XHJcblx0XHRcdFx0XHRcdFx0JGNlbGwuYWRkQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdCRjZWxsLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKVxyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRyb3dOb2RlLiRub2RlLmZpbmQoQ0VMTF9DTFMpLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdH0pO1xyXG5cdFx0XHJcblx0fVxyXG5cclxuXHRzZWxlY3Rpb25SYW5nZShbeDAsIHkwXSwgW3gxLCB5MV0pIHtcclxuXHJcblx0XHRsZXQgeURpciA9IHkxIC0geTA7XHJcblx0XHRsZXQgbGFzdFkgPSB0aGlzLl9sYXN0WTtcclxuXHRcdFx0XHJcblx0XHQvLyB5UmFuZ2UgPSB7IGxhc3Q6ICwgbm93OiBbeTAsIHkxXSB9O1xyXG5cdFx0Ly8gW2wwLCBsMV1cclxuXHRcdC8vIFt5MCwgeTFdXHJcblx0XHQvLyBbbDAsIGwxXVxyXG5cdFx0bGV0IHJlbW92ZVlSYW5nZSA9IFtdO1xyXG5cdFx0Ly8gZG93blxyXG5cdFx0aWYgKHlEaXIgPj0gMCAmJiB5MSA8IGxhc3RZKSB7XHJcblx0XHRcdHJlbW92ZVlSYW5nZSA9IFt5MSwgbGFzdFldO1xyXG5cdFx0fVxyXG5cdFx0Ly8gdXBcclxuXHRcdGlmICh5RGlyIDw9IDAgJiYgeTEgPiBsYXN0WSkge1xyXG5cdFx0XHRyZW1vdmVZUmFuZ2UgPSBbbGFzdFksIHkxXTtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0dGhpcy5fbGFzdFkgPSB5MTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKHlEaXIsIHJlbW92ZVlSYW5nZSk7XHJcblxyXG5cdFx0bGV0IGRhdGFJbmRleCA9IHRoaXMuZ2V0TG9ja0FuZFZpc2lhYmxlQ29sdW1uQXNEYXRhSW5kZXgoKTtcclxuXHRcdFt4MCwgeTAsIHgxLCB5MV0gPSBvcmRlckJ5KHgwLCB5MCwgeDEsIHkxLCBkYXRhSW5kZXgpO1xyXG5cclxuXHJcblx0XHRsZXQgY29scyA9IHRoaXMuX3NlbGVjdERhdGFJbmRleCA9IGRhdGFJbmRleC5zbGljZShkYXRhSW5kZXguaW5kZXhPZih4MCksIGRhdGFJbmRleC5pbmRleE9mKHgxKSsxKTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKGNvbHMpO1xyXG5cclxuXHRcdHRoaXMuX3NlbGVjdFkgPSBbeTAsIHkxICsgMV07XHJcblx0XHRsZXQgcm93cyA9IHRoaXMuc3RvcmUuc2xpY2UoeTAsIHkxICsgMSk7XHJcblxyXG5cdFx0dGhpcy5fc2VsZWN0aW9uID0gcm93cy5tYXAocm93ID0+IHtcclxuXHRcdFx0cmV0dXJuIGNvbHMubWFwKGNvbCA9PiByb3cuZGF0YVtjb2xdKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuX3JlUGFpbnROb2RlKHlEaXIsIHkwLCB5MSwgcmVtb3ZlWVJhbmdlLCBjb2xzKTtcclxuXHR9XHJcblxyXG5cdF9yZVBhaW50Tm9kZSh5RGlyLCB5MCwgeTEsIHJlbW92ZVlSYW5nZSwgY29scykge1xyXG5cdFx0bGV0IG5vZGVMaXN0ID0gdGhpcy5idWZmZXJOb2RlLmdldE5vZGVMaXN0KCk7XHJcblx0XHRub2RlTGlzdC5mb3JFYWNoKChyb3dOb2RlKSA9PiB7XHJcblx0XHRcdGxldCAkcm93ID0gcm93Tm9kZS4kbm9kZTtcclxuXHRcdFx0bGV0IGkgID0gKyRyb3cuYXR0cigncmlkJyk7XHJcblx0XHRcdFxyXG5cdFx0XHRpZiAoaSA+PSB5MCAmJiBpIDwgeTEgKyAxKSB7XHJcblx0XHRcdFx0Y29scy5mb3JFYWNoKChjb2wpID0+IHtcclxuXHRcdFx0XHRcdHJvd05vZGUuY2hpbGRyZW4uZm9yRWFjaCgoJGNlbGwsIGNvbE0pID0+IHtcclxuXHRcdFx0XHRcdFx0aWYgKGNvbHMuaW5kZXhPZihjb2xNLmRhdGFJbmRleCkgIT0gLTEpIHtcclxuXHRcdFx0XHRcdFx0XHQkY2VsbC5hZGRDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0JGNlbGwucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpXHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoeURpciA+PSAwICYmIGkgPiByZW1vdmVZUmFuZ2VbMF0gJiYgaSA8PXJlbW92ZVlSYW5nZVsxXSApIHtcclxuXHRcdFx0XHQkcm93LmZpbmQoQ0VMTF9DTFMpLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoeURpciA8PSAwICYmIGkgPj0gcmVtb3ZlWVJhbmdlWzBdICYmIGkgPHJlbW92ZVlSYW5nZVsxXSApIHtcclxuXHRcdFx0XHQkcm93LmZpbmQoQ0VMTF9DTFMpLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0LypcclxuXHQgKiBsb2NrICsgdmlzaWFibGUgPSBjb2x1bW5zXHJcblx0ICogQHBhcmFtIHtBcnJheX0gY29sdW1ucyAtW2RhdGFJbmRleC4uLl1cclxuXHQgKi9cclxuXHRnZXRMb2NrQW5kVmlzaWFibGVDb2x1bW5Bc0RhdGFJbmRleCgpIHtcclxuXHRcdGxldCBjb2xzID0gW107XHJcblxyXG5cdFx0dGhpcy5sb2NrQ29sTWFuYWdlclxyXG5cdFx0XHQudmlzaWJsZUxvY2tDb2x1bW5cclxuXHRcdFx0LmVhY2goY29sTSA9PiBjb2xzLnVuc2hpZnQoY29sTS5kYXRhSW5kZXgpKTtcclxuXHJcblx0XHRsZXQgdmlzaWFibGVDb2xzID0gdGhpcy5jb2x1bW5Nb2RlbFxyXG5cdFx0XHQuZ2V0VmlzaWJsZUNvbHVtbigpXHJcblx0XHRcdC5tYXAoY29sTSA9PiBjb2xNLmRhdGFJbmRleClcclxuXHRcdFx0LmZpbHRlcihkYXRhSW5kZXggPT4gY29scy5pbmRleE9mKGRhdGFJbmRleCkgPT0gLTEpO1xyXG5cclxuXHRcdHJldHVybiBjb2xzLmNvbmNhdCh2aXNpYWJsZUNvbHMpO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHtcclxuXHRcdHN1cGVyLmRlc3RvcnkoKTtcclxuXHJcblx0XHR0aGlzLl9kZWZhdWx0cygpO1xyXG5cdH1cclxuXHJcbn1cclxuXHJcblxyXG5mdW5jdGlvbiBzd2FwKGEsIGIpIHtcclxuXHRyZXR1cm4gW2IsIGFdO1xyXG59XHJcblxyXG5mdW5jdGlvbiBvcmRlckJ5KHgwLCB5MCwgeDEsIHkxLCBkYXRhSW5kZXgpIHtcclxuXHRpZiAoZGF0YUluZGV4LmluZGV4T2YoeDApID4gZGF0YUluZGV4LmluZGV4T2YoeDEpKSB7XHJcblx0XHRbeDAsIHgxXSA9IHN3YXAoeDAsIHgxKTtcclxuXHR9XHJcblx0aWYgKHkwID4geTEpIHtcclxuXHRcdFt5MCwgeTFdID0gc3dhcCh5MCwgeTEpO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIFt4MCwgeTAsIHgxLCB5MV07XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU2VsZWN0aW9uOyIsIi8vIGV4cG9ydHMuR3JpZFN0b3JlID0gcmVxdWlyZSgnLi9jb3JlL0dyaWRTdG9yZScpO1xyXG4vLyBleHBvcnRzLkdyaWRWaWV3ID0gcmVxdWlyZSgnLi9jb3JlL0dyaWRWaWV3Jyk7XHJcbi8vIG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9leHRlbmRzL1NlbGVjdGlvbicpO1xyXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vZXh0ZW5kcy9Db250ZXh0bWVudScpO1xyXG5cclxuLy8gZXhwb3J0IHsgZGVmYXVsdCB9IGZvcm0gJy4vcGx1Z2luL0NvbnRleHRtZW51JztcclxuIiwidmFyICQgPSByZXF1aXJlKCcuLi91dGlsL3NoaW0nKS4kO1xyXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuLi91dGlsL1V0aWxzJyk7XHJcblxyXG5cclxuY2xhc3MgTWVudSB7XHJcblx0Y29uc3RydWN0b3IoJHdyYXBwZXIsIHsgZGF0YSwgY29udGV4dCB9KSB7XHJcblx0XHR0aGlzLnBhcmFtcyA9IHt9O1xyXG5cdFx0dGhpcy4kbWVudSA9ICQobnVsbCk7XHJcblx0XHR0aGlzLiR3cmFwcGVyID0gJHdyYXBwZXI7XHJcblx0XHR0aGlzLl9kYXRhID0gZGF0YSB8fCBbXTtcclxuXHRcdHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XHJcblxyXG5cdFx0dGhpcy51cGRhdGUoZGF0YSk7XHJcblx0fVxyXG5cclxuXHR1cGRhdGUoZGF0YSkge1xyXG5cdFx0dGhpcy4kbWVudS5yZW1vdmUoKTsgLy8gVE9ETyDkvJjljJblpI3nlKjoioLngrlcclxuXHRcdFxyXG5cdFx0aWYgKEFycmF5LmlzQXJyYXkoZGF0YSkgJiYgZGF0YS5sZW5ndGggPiAwKSB7XHJcblx0XHRcdHRoaXMuJG1lbnUgPSBjb21waWxlTWVudShkYXRhLCB0aGlzKTtcclxuXHJcblx0XHRcdHRoaXMuJHdyYXBwZXIuYXBwZW5kKHRoaXMuJG1lbnUpO1xyXG5cclxuXHRcdFx0dGhpcy5fZGF0YSA9IGRhdGE7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aGlzLl9kYXRhID0gW107XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRzZXRJbmZvKGluZm8pIHtcclxuXHRcdHRoaXMuJGluZm8gPSBpbmZvO1xyXG5cdH1cclxuXHJcblx0Z2V0SW5mbygpIHtcclxuXHRcdHJldHVybiB0aGlzLiRpbmZvO1xyXG5cdH1cclxuXHJcblx0Z2V0RGF0YSgpIHtcclxuXHRcdHJldHVybiB0aGlzLl9kYXRhO1xyXG5cdH1cclxuXHJcblx0Z2V0Q2xzKGNsYXNzTmFtZSkge1xyXG5cdFx0cmV0dXJuIHRoaXMuJG1lbnUuZmluZChjbGFzc05hbWUpO1xyXG5cdH1cclxuXHJcblx0c2hvd0F0KGV2dCkge1xyXG5cdFx0aWYgKCF0aGlzLl9kYXRhLmxlbmd0aCkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0bGV0IHggPSBldnQuY2xpZW50WCAtIHRoaXMuJHdyYXBwZXIub2Zmc2V0KCkubGVmdDtcclxuXHRcdGxldCB5ID0gZXZ0LmNsaWVudFkgLSB0aGlzLiR3cmFwcGVyLm9mZnNldCgpLnRvcDtcclxuXHJcblx0ICAgIHRoaXMuJG1lbnVcclxuXHQgICAgXHQuYWRkQ2xhc3MoJ3Nob3ctbWVudScpXHJcblx0ICAgIFx0LmNzcyh7ICdsZWZ0JzogeCArICdweCcsICd0b3AnOiB5ICsgJ3B4JyB9KTtcclxuXHR9XHJcblxyXG5cdGhpZGUoKSB7XHJcblx0XHR0aGlzLiRtZW51LnJlbW92ZUNsYXNzKCdzaG93LW1lbnUnKTtcclxuXHR9XHJcblxyXG5cdGdldERvbSgpIHtcclxuXHRcdHJldHVybiB0aGlzLiRtZW51O1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHtcclxuXHRcdHRoaXMuJG1lbnUuZW1wdHkoKTtcclxuXHR9XHJcblxyXG59XHJcblxyXG5cclxuY29uc3QgZW1wdHlGbiA9IChldnQpID0+IHsgXHJcblx0ZXZ0LnByZXZlbnREZWZhdWx0O1xyXG5cdHJldHVybiBmYWxzZTsgXHJcbn07XHJcblxyXG5mdW5jdGlvbiBjb252ZXJ0KGl0ZW0pIHtcclxuXHRsZXQgZGVmSXRlbSA9IHtcclxuXHRcdCdpZCc6ICdjbS1pZC0nICsgRGF0ZS5ub3coKSxcclxuXHRcdCd0ZXh0JzogJycsXHJcblx0XHQnaWNvbkNscyc6ICcnLFxyXG5cdFx0J2hpZGRlbic6IGZhbHNlLFxyXG5cdFx0J2Rpc2FibGVkJzogZmFsc2UsXHJcblx0XHQnaGFuZGxlcic6IGZ1bmN0aW9uKCkge31cclxuXHR9O1xyXG5cclxuXHRyZXR1cm4gT2JqZWN0LmFzc2lnbihkZWZJdGVtLCBpdGVtKTtcclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlSXRlbShpdGVtLCB2bSkge1xyXG5cdGxldCAkaXRlbSA9ICQoJzxsaS8+JylcclxuXHRcdFx0LmF0dHIoJ2lkJywgaXRlbS5pZClcclxuXHRcdFx0LmFkZENsYXNzKCdjLW1lbnUtaXRlbScpXHJcblx0XHRcdC5hZGRDbGFzcyhpdGVtLmRpc2FibGVkID8gJ2Rpc2FibGVkJzogJycpO1xyXG5cclxuICAgIGxldCAkYnV0dG9uID0gJCgnPGJ1dHRvbi8+JykuYWRkQ2xhc3MoJ2MtbWVudS1idG4nKVxyXG4gICAgXHRcdC5hcHBlbmQoYDxpIGNsYXNzPVwiZmEgJHtpdGVtLmljb25DbHN9XCI+PC9pPmApXHJcbiAgICBcdFx0LmFwcGVuZChgPHNwYW4gY2xhc3M9XCJjLW1lbnUtdGV4dFwiPiR7aXRlbS50ZXh0fTwvc3Bhbj5gKVxyXG4gICAgXHRcdC5vbignY2xpY2snLCAoZXZ0KSA9PiB7XHJcbiAgICBcdFx0XHRpdGVtLmhhbmRsZXIuY2FsbCh2bSwgdm0uZ2V0SW5mbygpLCB2bS5jb250ZXh0LCBldnQpO1xyXG4gICAgXHRcdH0pO1xyXG5cclxuICAgIHJldHVybiAkaXRlbS5hcHBlbmQoJGJ1dHRvbik7XHJcbn07XHJcblxyXG5mdW5jdGlvbiBjb21waWxlTWVudShtZW51cywgdm0pIHtcclxuXHRpZiAobWVudXMgJiYgbWVudXMubGVuZ3RoID09PSAwKSByZXR1cm4gJChudWxsKTtcclxuXHRcclxuXHRsZXQgJG1lbnVzID0gJCgnPG1lbnUvPicpLmFkZENsYXNzKCdjLW1lbnUnKTtcclxuXHRsZXQgJG1lbnVTZXBhcmF0b3IgPSAkKCc8bGkvPicpLmFkZENsYXNzKCdjLW1lbnUtc2VwYXJhdG9yJyk7XHJcblx0XHJcblx0bWVudXMuZm9yRWFjaChtZW51ID0+IHtcclxuXHRcdGlmIChtZW51LnNlcGFyYXRvcikge1xyXG5cdFx0XHRyZXR1cm4gJG1lbnVzLmFwcGVuZCgkbWVudVNlcGFyYXRvcik7XHJcblx0XHR9XHJcblxyXG5cdFx0bGV0ICRtZW51ID0gY3JlYXRlSXRlbShjb252ZXJ0KG1lbnUpLCB2bSk7XHJcblx0XHRsZXQgY2hpbGRyZW47XHJcblxyXG5cdFx0aWYgKG1lbnUuY2hpbGRyZW4pIHtcclxuXHRcdFx0Y2hpbGRyZW4gPSBjb21waWxlTWVudShtZW51LmNoaWxkcmVuLCB2bSk7XHJcblxyXG5cdFx0XHRpZiAoY2hpbGRyZW4pIHtcclxuXHRcdFx0XHQkbWVudS5hZGRDbGFzcygnc3VibWVudScpLmFwcGVuZChjaGlsZHJlbik7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0JG1lbnVzLmFwcGVuZCgkbWVudSk7XHJcblx0fSk7XHJcblxyXG5cdHJldHVybiAkbWVudXM7XHJcbn1cclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IE1lbnU7IiwiJ3VzZSBzdHJpY3QnO1xyXG5jb25zdCAkID0gcmVxdWlyZSgnLi4vdXRpbC9zaGltJykuJDtcclxuXHJcbmNvbnN0IEZMRVhNSU5XSURUSCA9IDM1O1xyXG5cclxudmFyIGRyYWdEcm9wID0gZnVuY3Rpb24oZXZ0ICxvcHRzKSB7XHJcblx0dmFyIGRvYyA9ICQoZG9jdW1lbnQpO1xyXG5cdHZhciBzY3JvbGxMZWZ0ID0gZG9jdW1lbnQuYm9keS5zY3JvbGxMZWZ0IHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0O1xyXG5cdHZhciBzY3JvbGxUb3AgPSBkb2N1bWVudC5ib2R5LnNjcm9sbFRvcCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsVG9wO1xyXG5cdHZhciBsZWZ0T2Zmc2V0ID0gJChldnQudGFyZ2V0KS5vZmZzZXQoKS5sZWZ0IC0gc2Nyb2xsTGVmdDtcclxuXHR2YXIgaVgsIGlZLCBzdGFydFgsIGVuZFg7XHJcblx0dmFyIGRyYWdnaW5nID0gdHJ1ZTtcclxuXHJcblx0c3RhcnRYID0gaVggPSBldnQuY2xpZW50WCAtIHNjcm9sbExlZnQ7XHJcblx0aVkgPSAkKGV2dC50YXJnZXQpLm9mZnNldCgpLnRvcCAtIHNjcm9sbFRvcDtcclxuXHJcblx0b3B0cy5vbkRyYWdTdGFydCh7ICd4Jzogc3RhcnRYIH0sIG9wdHMuJGVsZW1lbnQpO1xyXG5cclxuXHRkb2Mub24oJ21vdXNlbW92ZS5kcmFnZHJvcCcsICQucHJveHkobW91c2Vtb3ZlLCB0aGlzKSk7XHJcblx0ZG9jLm9uKCdtb3VzZXVwLmRyYWdkcm9wJywgJC5wcm94eShtb3VzZXVwLCB0aGlzKSk7XHJcblx0Ly8gJChldnQudGFyZ2V0KVswXS5zZXRDYXB0dXJlICYmICQoZXZ0LnRhcmdldClbMF0uc2V0Q2FwdHVyZSgpO1xyXG5cclxuXHRmdW5jdGlvbiBtb3VzZW1vdmUoZSkge1xyXG5cdFx0aWYgKGRyYWdnaW5nKSB7XHJcblx0XHRcdGVuZFggPSBlLmNsaWVudFggLSBzY3JvbGxMZWZ0O1xyXG5cclxuXHRcdFx0Ly8gbGltaXRcclxuXHRcdFx0aWYgKGVuZFggLSBsZWZ0T2Zmc2V0IDwgRkxFWE1JTldJRFRIKSB7XHJcblx0XHRcdFx0ZW5kWCA9IGxlZnRPZmZzZXQgKyBGTEVYTUlOV0lEVEg7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdG9wdHMub25EcmFnZ2luZyggeyAneCc6IGVuZFggfSwgb3B0cy4kZWxlbWVudCk7XHJcblx0XHR9XHJcblxyXG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIG1vdXNldXAoZXZ0KSB7XHJcblx0XHR2YXIgZSA9IGV2dC50YXJnZXQ7XHJcblx0XHRkcmFnZ2luZyA9IGZhbHNlO1xyXG5cclxuXHRcdG9wdHMub25EcmFnRW5kKHsgJ3gnOiBldnQuY2xpZW50WCAtIHNjcm9sbExlZnQgfSwgb3B0cy4kZWxlbWVudCk7XHJcblxyXG5cdFx0aWYgKGUgJiYgZS5zZXRDYXB0dXJlKSB7XHJcblx0XHRcdGUucmVsZWFzZUNhcHR1cmUoKTtcclxuXHRcdH0gZWxzZSBpZiAod2luZG93LnJlbGVhc2VDYXB0dXJlKSB7XHJcblx0XHRcdHdpbmRvdy5yZWxlYXNlQ2FwdHVyZShFdmVudC5NT1VTRU1PVkUgfCBFdmVudC5NT1VTRVVQKTtcclxuXHRcdH1cclxuXHJcblx0XHRkb2Mub2ZmKCdtb3VzZW1vdmUuZHJhZ2Ryb3AnLCBtb3VzZW1vdmUpO1xyXG5cdFx0ZG9jLm9mZignbW91c2V1cC5kcmFnZHJvcCcsIG1vdXNldXApO1xyXG5cdH1cclxuXHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YXJnZXQsIG9wdGlvbnMpIHtcclxuXHR2YXIgZGVmYXVsdHMgPSB7XHJcblx0XHRyZXN0cmljdGVyKGV2dCkgeyByZXR1cm4gbnVsbDsgfSxcclxuXHRcdG9uRHJhZ1N0YXJ0KG9mZnNldCwgdGFyZ2V0KSB7fSxcclxuXHRcdG9uRHJhZ2dpbmcob2Zmc2V0LCB0YXJnZXQpIHt9LFxyXG5cdFx0b25EcmFnRW5kKG9mZnNldCwgdGFyZ2V0KSB7fVxyXG5cdH07XHJcblxyXG5cdE9iamVjdC5hc3NpZ24oZGVmYXVsdHMsIG9wdGlvbnMpO1xyXG5cclxuXHQkKHRhcmdldCkub24oJ21vdXNlZG93bicsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0dmFyIHJlc3RyaWN0ZXIgPSBkZWZhdWx0cy5yZXN0cmljdGVyKGV2dCk7XHJcblxyXG5cdFx0aWYgKHJlc3RyaWN0ZXIpIHtcclxuXHRcdFx0ZGVmYXVsdHMuJGVsZW1lbnQgPSBkZWZhdWx0cy5yZXN0cmljdGVyKGV2dCkgfHwgJChldnQudGFyZ2V0KTtcclxuXHRcdFx0ZHJhZ0Ryb3AoZXZ0LCBkZWZhdWx0cyk7XHJcblx0XHR9XHJcblx0fSk7XHJcbn07IiwiLyoqXHJcbiAqIOS6i+S7tueuoeeQhlxyXG4gKiBAY2xhc3MgRXZlbnRFbWl0dGVyXHJcbiAqL1xyXG5cclxuZnVuY3Rpb24gaW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVycywgbGlzdGVuZXIpIHtcclxuXHR2YXIgaSA9IGxpc3RlbmVycy5sZW5ndGg7XHJcblx0d2hpbGUgKGktLSkge1xyXG5cdFx0aWYgKGxpc3RlbmVyc1tpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHtcclxuXHRcdFx0cmV0dXJuIGk7XHJcblx0XHR9XHJcblx0fVxyXG5cdHJldHVybiAtMTtcclxufVxyXG5cclxuZnVuY3Rpb24gaXNWYWxpZExpc3RlbmVyKGxpc3RlbmVyKSB7XHJcblx0aWYgKHR5cGVvZiBsaXN0ZW5lciA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fSBlbHNlIGlmIChsaXN0ZW5lciAmJiB0eXBlb2YgbGlzdGVuZXIgPT09ICdvYmplY3QnKSB7XHJcblx0XHRyZXR1cm4gaXNWYWxpZExpc3RlbmVyKGxpc3RlbmVyLmxpc3RlbmVyKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxufVxyXG5cclxuY2xhc3MgRXZlbnRFbWl0dGVyIHtcclxuXHJcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xyXG5cclxuXHR9XHJcblx0LyoqXHJcblx0KlxyXG5cdCpcclxuXHQqXHJcblx0KlxyXG5cdCovXHJcblx0X2dldEV2ZW50cygpIHtcclxuXHRcdHJldHVybiB0aGlzLl9ldmVudHMgfHwgKHRoaXMuX2V2ZW50cyA9IHt9KTtcclxuXHR9XHJcblx0LyoqXHJcblx0KiDpgJrov4fkuovku7blkI3ojrflj5ZsaXN0ZW5lciDmlbDnu4TmiJbliJ3lp4vljJZcclxuXHQqIOS9v+eUqOato+WImeWMuemFjeS8mui/lOWbnuS4gOS4quWvueW6lOeahOWvueixoVxyXG5cdCpcclxuXHQqIFxyXG5cdCogZ2V0TGlzdGVuZXJzXHJcblx0KiBAcGFyYW0ge1N0cmluZyB9IFJlZ0V4cH0gZXZlbnROYW1lXHJcblx0KiBAcmV0dXJuIHtGdW5jdG9uW10gfCBPYmplY3R9XHJcblx0KlxyXG5cdCovXHJcblx0Z2V0TGlzdGVuZXJzKG5hbWUpIHtcclxuXHRcdHZhciBldmVudHMgPSB0aGlzLl9nZXRFdmVudHMoKTtcclxuXHRcdHZhciByZXNwb25zZTtcclxuXHRcdHZhciBrZXk7XHJcblxyXG5cdFx0aWYgKG5hbWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcclxuXHRcdFx0cmVzcG9uc2UgPSB7fTtcclxuXHRcdFx0Zm9yIChrZXkgaW4gZXZlbnRzKSB7XHJcblx0XHRcdFx0aWYgKGV2ZW50cy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIG5hbWUudGVzdChrZXkpKSB7XHJcblx0XHRcdFx0XHRyZXNwb25zZVtrZXldID0gZXZlbnRzW2tleV07XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyZXNwb25zZSA9IGV2ZW50c1tuYW1lXSB8fCAoZXZlbnRzW25hbWVdID0gW10pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiByZXNwb25zZTtcclxuXHR9XHJcblx0LyoqXHJcblx0KiDpgJrov4fkuovku7blkI3ojrflj5ZsaXN0ZW5lciDlp4vnu4jov5Tlm57kuIDkuKrlr7nosaFcclxuXHQqXHJcblx0KiBcclxuXHQqIGdldExpc3RlbmVyc0FzT2JqZWN0XHJcblx0KiBAcGFyYW0ge1N0cmluZ3xSZWdFeHB9IGV2ZW50TmFtZVxyXG5cdCogQHJldHVybiB7T2JqZWN0fVxyXG5cdCovXHJcblx0Z2V0TGlzdGVuZXJzQXNPYmplY3QobmFtZSkge1xyXG5cdFx0dmFyIGxpc3RlbmVycyA9IHRoaXMuZ2V0TGlzdGVuZXJzKG5hbWUpO1xyXG5cdFx0dmFyIHJlc3BvbnNlO1xyXG5cclxuXHRcdGlmIChsaXN0ZW5lcnMgaW5zdGFuY2VvZiBBcnJheSkge1xyXG5cdFx0XHRyZXNwb25zZSA9IHt9O1xyXG5cdFx0XHRyZXNwb25zZVtuYW1lXSA9IGxpc3RlbmVycztcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcmVzcG9uc2UgfHwgbGlzdGVuZXJzO1xyXG5cdH1cclxuXHQvKipcclxuXHQqIOiOt+WPliBsaXN0ZW5lciDliJfooahcclxuXHQqXHJcblx0KiBmbGF0dGVuTGlzdGVuZXJzXHJcblx0KlxyXG5cdCogQHBhcmFtIHsgT2JqZWN0W119IGxpc3RlbmVyc1xyXG5cdCogQHJldHVybiB7RnVuY3Rpb25bXX1cclxuXHQqL1xyXG5cdGZsYXR0ZW5MaXN0ZW5lcnMobGlzdGVuZXJzKSB7XHJcblx0XHR2YXIgZmxhdExpc3RlbmVycyA9IFtdO1xyXG5cclxuXHRcdGZvciAodmFyIGkgPSAwLCBsID0gbGlzdGVuZXIubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcblx0XHRcdGZsYXRMaXN0ZW5lcnMucHVzaChsaXN0ZW5lcnNbaV0ubGlzdGVuZXIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmbGF0TGlzdGVuZXJzO1xyXG5cdH1cclxuXHQvKipcclxuXHQqIOS6i+S7tuazqOWGjFxyXG5cdCpcclxuXHQqXHJcblx0KiBAZXhhbXBlbFxyXG5cdCogdmFyIGVtdCA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcclxuXHQqIGVtdC5hZGRMaXN0ZW5lcignZGl2OmhvdmVyJywgZnVuY3Rpb24oKXtcclxuXHQqXHQvLyBkb1xyXG5cdCogfSk7XHJcblx0KiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lXHJcblx0KiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxyXG5cdCogQHJldHVybiB7T2JqZWN0an1cclxuXHQqXHJcblx0Ki9cclxuXHRhZGRMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lciwgZmxhZykge1xyXG5cdFx0aWYgKCFpc1ZhbGlkTGlzdGVuZXIobGlzdGVuZXIpKSB7XHJcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBsaXN0ZW5lcnMgPSB0aGlzLmdldExpc3RlbmVyc0FzT2JqZWN0KG5hbWUpO1xyXG5cdFx0dmFyIGxpc3RlbmVySXNXcmFwcGVkID0gdHlwZW9mIGxpc3RlbmVyID09PSAnb2JqZWN0JztcclxuXHRcdHZhciBrZXksIHN0YXJ0LCBhcmdzO1xyXG5cclxuXHRcdGZvciAoa2V5IGluIGxpc3RlbmVycykge1xyXG5cdFx0XHRpZiAobGlzdGVuZXJzLmhhc093blByb3BlcnR5KGtleSkgJiYgaW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVycywgbGlzdGVuZXIpID09PSAtMSkge1xyXG5cclxuXHRcdFx0XHRzdGFydCA9IGxpc3RlbmVyc1trZXldLmxlbmd0aDtcclxuXHJcblx0XHRcdFx0bGlzdGVuZXJzW2tleV0ucHVzaChsaXN0ZW5lcklzV3JhcHBlZCA/IGxpc3RlbmVyIDoge1xyXG5cdFx0XHRcdFx0bGlzdGVuZXI6IGxpc3RlbmVyLFxyXG5cdFx0XHRcdFx0b25jZTogZmFsc2VcclxuXHRcdFx0XHR9KTtcclxuXHJcblx0XHRcdFx0aWYgKGZsYWcgJiYgbGlzdGVuZXJzW2tleV0uYXJncykge1xyXG5cdFx0XHRcdFx0bGlzdGVuZXJzW2tleV0uc3RhcnQgPSBzdGFydDtcclxuXHRcdFx0XHRcdGFyZ3MgPSBsaXN0ZW5lcnNba2V5XS5hcmdzO1xyXG5cdFx0XHRcdFx0dGhpcy5lbWl0RXZlbnQobmFtZSwgYXJncyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRvbigpIHtcclxuXHRcdHJldHVybiB0aGlzLmFkZExpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cclxuXHRvbmUobmFtZSwgbGlzdGVuZXIsIGZsYWcpIHtcclxuXHRcdHJldHVybiB0aGlzLnJlbW92ZUV2ZW50KG5hbWUpLmFkZExpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiDkuovku7bms6jlhozvvIzop6blj5HlkI7oh6rliqjnp7vpmaRcclxuXHQgKlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZVxyXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyXHJcblx0ICogQHJldXRuciB7T2JqZWN0fVxyXG5cdCAqXHJcblx0ICovXHJcblx0YWRkT25jZUxpc3RlbmVyKG5hbWUsIGxpc3RlbmVyKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5hZGRMaXN0ZW5lcihuYW1lLCB7XHJcblx0XHRcdGxpc3RlbmVyOiBsaXN0ZW5lcixcclxuXHRcdFx0b25jZTogdHJ1ZVxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRvbmNlKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuYWRkT25jZUxpc3RlbmVyLmFwcGx5KHRoaXMuYXJndW1lbnRzKTtcclxuXHR9XHJcblx0LyoqXHJcblx0ICog5LqL5Lu26ZSA5q+BXHJcblx0ICpcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWVcclxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxyXG5cdCAqIEByZXR1cm4ge09iamVjdH1cclxuXHQgKlxyXG5cdCAqL1xyXG5cdHJlbW92ZUxpc3RlbmVyKG5hbWUsIGxpc3RlbmVyKSB7XHJcblx0XHR2YXIgbGlzdGVuZXJzID0gdGhpcy5nZXRMaXN0ZW5lcnNBc09iamVjdChuYW1lKTtcclxuXHRcdHZhciBpbmRleDtcclxuXHRcdHZhciBrZXk7XHJcblxyXG5cdFx0Zm9yIChrZXkgaW4gbGlzdGVuZXJzKSB7XHJcblx0XHRcdGlmIChsaXN0ZW5lcnMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xyXG5cdFx0XHRcdGluZGV4ID0gaW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVyc1trZXldLCBsaXN0ZW5lcik7XHJcblxyXG5cdFx0XHRcdGlmIChpbmRleCAhPT0gLTEpIHtcclxuXHRcdFx0XHRcdGxpc3RlbmVyc1trZXldLnNwbGljZShpbmRleCwgaSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRvZmYoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yZW1vdmVMaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHJcblx0bWFuaXB1bGF0ZUxpc3RlbmVycyhyZW1vdmUsIG5hbWUsIGxpc3RlbmVycykge1xyXG5cdFx0dmFyIHNpbmdsZSA9IHJlbW92ZSA/IHRoaXMucmVtb3ZlTGlzdGVuZXIgOiB0aGlzLmFkZExpc3RlbmVyO1xyXG5cdFx0dmFyIG11dGlwbGUgPSByZW1vdmUgPyB0aGlzLnJlbW92ZUxpc3RlbmVycyA6IHRoaXMuYWRkTGlzdGVuZXJzO1xyXG5cdFx0dmFyIGk7XHJcblx0XHR2YXIgdjtcclxuXHJcblx0XHRpZiAodHlwZW9mIG5hbWUgPT09ICdvYmplY3QnICYmICEobmFtZSBpbnN0YW5jZW9mIFJlZ0V4cCkpIHtcclxuXHRcdFx0Zm9yIChpIGluIG5hbWUpIHtcclxuXHRcdFx0XHRpZiAobmFtZS5oYXNPd25Qcm9wZXJ0eShpKSAmJiAodiA9IG5hbWVbaV0pKSB7XHJcblx0XHRcdFx0XHRpZiAodHlwZW9mIHYgPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0XHRcdFx0c2luZ2xlLmNhbGwodGhpcywgaSwgdik7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRtdXRpcGxlLmNhbGwodGhpcywgaSwgdik7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRpID0gMDtcclxuXHRcdFx0diA9IGxpc3RlbmVycy5sZW5ndGg7XHJcblx0XHRcdHdoaWxlIChpIDwgdikge1xyXG5cdFx0XHRcdHNpbmdsZS5jYWxsKHRoaXMsIG5hbWUsIGxpc3RlbmVyc1tpKytdKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0YWRkTGlzdGVuZXJzKG5hbWUsIGxpc3RlbmVycykge1xyXG5cdFx0cmV0dXJuIHRoaXMubWFuaXB1bGF0ZUxpc3RlbmVycyhmYWxzZSwgbmFtZSwgbGlzdGVuZXJzKTtcclxuXHR9XHJcblxyXG5cdHJlbW92ZUxpc3RlbmVycyhuYW1lLCBsaXN0ZW5lcnMpIHtcclxuXHRcdHJldHVybiB0aGlzLm1hbmlwdWxhdGVMaXN0ZW5lcnModHJ1ZSwgbmFtZSwgbGlzdGVuZXJzKTtcclxuXHR9XHJcblxyXG5cdHJlbW92ZUV2ZW50KG5hbWUpIHtcclxuXHRcdHZhciBldmVudHMgPSB0aGlzLl9nZXRFdmVudHMoKTtcclxuXHRcdHZhciBrZXk7XHJcblxyXG5cdFx0aWYgKHR5cGVvZiBuYW1lID09PSAnc3RyaW5nJykge1xyXG5cdFx0XHQvLyDnp7vpmaTmiYDmnInmjIflrprkuovku7blkI3nmoTmiYDmnIlsaXN0ZW5lcnNcclxuXHRcdFx0Ly8gZGVsZXRlIGV2ZW50c1tuYW1lXVxyXG5cdFx0XHRpZiAoZXZlbnRzW25hbWVdIGluc3RhbmNlb2YgQXJyYXkpIHtcclxuXHRcdFx0XHRldmVudHNbbmFtZV0ubGVuZ3RoID0gMDtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIGlmIChuYW1lIGluc3RhbmNlb2YgUmVnRXhwKSB7XHJcblx0XHRcdC8vIOato+WImeWMuemFjeeahOaJgOaciSBsaXN0ZW5lcnNcclxuXHRcdFx0Zm9yIChrZXkgaW4gZXZlbnRzKSB7XHJcblx0XHRcdFx0aWYgKGV2ZW50cy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIG5hbWUudGVzdChrZXkpKSB7XHJcblx0XHRcdFx0XHQvLyBkZWxldGUgZXZlbnRzW2tleV1cclxuXHRcdFx0XHRcdGlmIChldmVudHNba2V5XSBpbnN0YW5jZW9mIEFycmF5KSB7XHJcblx0XHRcdFx0XHRcdGV2ZW50W2tleV0ubGVuZ3RoID0gMDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdC8vIOenu+mZpOaJgOaciSBsaXN0ZW5lcnNcclxuXHRcdFx0ZGVsZXRlIHRoaXMuX2V2ZW50cztcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdHJlbW92ZUFsbExpc3RlbmVycygpIHtcclxuXHRcdHJldHVybiB0aGlzLnJlbW92ZUV2ZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cdC8qKlxyXG5cdCAqIOS6i+S7tuinpuWPkVxyXG5cdCAqXHJcblx0ICpcclxuXHQgKiBAZXhhbXBsZVxyXG5cdCAqIHZhciBlbXQgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XHJcblx0ICogc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuXHQgKiBcdGVtdC5lbWl0RXZlbnQoJ2Rpdjpob3ZlcicsIDEpO1xyXG5cdCAqIH0sIDEwMDApO1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSDkuovku7blkI3np7BcclxuXHQgKiBAcGFyYW0ge0FycmF5fSBbYXJnc10gSFRNTERvY3VtZW50LCBpdGVtRGF0YSwgLi4uXHJcblx0ICogQHJldHVybiB7T2JqZWN0fVxyXG5cdCAqXHJcblx0ICovXHJcblx0ZW1pdEV2ZW50KG5hbWUsIGFyZ3MpIHtcclxuXHRcdHZhciBsaXN0ZW5lcnNNYXAgPSB0aGlzLmdldExpc3RlbmVyc0FzT2JqZWN0KG5hbWUpO1xyXG5cdFx0dmFyIGxpc3RlbmVycztcclxuXHRcdHZhciBsaXN0ZW5lcjtcclxuXHRcdHZhciBpO1xyXG5cdFx0dmFyIGw7XHJcblx0XHR2YXIga2V5O1xyXG5cdFx0dmFyIHJlc3BvbnNlO1xyXG5cclxuXHRcdGZvciAoa2V5IGluIGxpc3RlbmVyc01hcCkge1xyXG5cdFx0XHRpZiAobGlzdGVuZXJzTWFwLmhhc093blByb3BlcnR5KGtleSkpIHtcclxuXHRcdFx0XHRsaXN0ZW5lcnMgPSBsaXN0ZW5lcnNNYXBba2V5XS5zbGljZSgwKTtcclxuXHJcblx0XHRcdFx0bGlzdGVuZXJzTWFwW2tleV0uYXJncyA9IGFyZ3M7XHJcblxyXG5cdFx0XHRcdGkgPSBsaXN0ZW5lcnNNYXBba2V5XS5zdGFydCB8fCAwO1xyXG5cdFx0XHRcdGxpc3RlbmVyc01hcFtrZXldLnN0YXJ0ID0gMDtcclxuXHJcblx0XHRcdFx0Zm9yIChsID0gbGlzdGVuZXJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG5cdFx0XHRcdFx0bGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XHJcblxyXG5cdFx0XHRcdFx0aWYgKGxpc3RlbmVyLm9uY2UgPT09IHRydWUpIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5yZW1vdmVMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lci5saXN0ZW5lcik7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0cmVzcG9uc2UgPSBsaXN0ZW5lci5saXN0ZW5lci5hcHBseSh0aGlzLCBhcmdzIHx8IFtdKTtcclxuXHJcblx0XHRcdFx0XHRpZiAocmVzcG9uc2UgPT09IHRoaXMuX2dldE9uY2VSZXR1cm5WYWx1ZSgpKSB7XHJcblx0XHRcdFx0XHRcdHRoaXMucmVtb3ZlTGlzdGVuZXIobmFtZSwgbGlzdGVuZXIubGlzdGVuZXIpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHR0cmlnZ2VyKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuZW1pdEV2ZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cclxuXHRmaXJlKG5hbWUpIHtcclxuXHRcdHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcclxuXHRcdHJldHVybiB0aGlzLmVtaXRFdmVudChuYW1lLCBhcmdzKTtcclxuXHR9XHJcblxyXG5cdF9nZXRPbmNlUmV0dXJuVmFsdWUoKSB7XHJcblx0XHRpZiAodGhpcy5oYXNPd25Qcm9wZXJ0eSgnX29uY2VSZXR1cm5WYWx1ZScpKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLl9vbmNlUmV0dXJuVmFsdWU7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdHNldE9uY2VSZXR1cm5WYWx1ZSh2YWx1ZSkge1xyXG5cdFx0dGhpcy5fb25jZVJldHVyblZhbHVlID0gdmFsdWU7XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdGRlZmluZUV2ZW50KG5hbWUpIHtcclxuXHRcdHRoaXMuZ2V0TGlzdGVuZXJzKG5hbWUpO1xyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRkZWZpbmVFdmVudHMobmFtZXMpIHtcclxuXHRcdGZvciAodmFyIGkgPSAwLCBsID0gbmFtZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcblx0XHRcdHRoaXMuZGVmaW5lRXZlbnQobmFtZVtpXSk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcclxuXHJcblxyXG4iLCJmdW5jdGlvbiBzd2FwKGFyciwgczEsIHMyKSB7XHJcblx0dmFyIHRlbXAgPSBhcnJbczFdO1xyXG5cdGFycltzMV0gPSBhcnJbczJdO1xyXG5cdGFycltzMl0gPSB0ZW1wO1xyXG59XHJcblxyXG5mdW5jdGlvbiByYW5kb21WYWx1ZShhcnIpIHtcclxuXHR2YXIgciA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGFyci5sZW5ndGgpO1xyXG5cdC8vIHN3YXAoYXJyLCAwLCByKTtcclxuXHRyZXR1cm4gW2FycltyXSwgYXJyLmZpbHRlcigoZCwgaSkgPT4gaSAhPT0gcildO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmaWx0ZXJMQW5kUihhcnIsIHNlbGVjdCwgY29tcGFyZUZuKSB7XHJcblx0dmFyIGxlZnRBcnIgPSBbXTtcclxuXHR2YXIgcmlnaHRBcnIgPSBbXTtcclxuXHJcblx0Zm9yICh2YXIgaSA9IDAsIGxlbiA9IGFyci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG5cdFx0bGV0IHRlbXAgPSBhcnJbaV07XHJcblx0XHRsZXQgY29tcGFyZWQgPSBjb21wYXJlRm4oc2VsZWN0LCB0ZW1wKTtcclxuXHRcdGlmIChjb21wYXJlZCA+IDApIHJpZ2h0QXJyLnB1c2godGVtcCk7XHJcblx0XHRlbHNlIGlmIChjb21wYXJlZCA8IDApIGxlZnRBcnIucHVzaCh0ZW1wKTtcclxuXHRcdGVsc2UgTWF0aC5yYW5kb20oKSA+IDAuNSA/IHJpZ2h0QXJyLnB1c2godGVtcCkgOiBsZWZ0QXJyLnB1c2godGVtcCk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gW2xlZnRBcnIsIHJpZ2h0QXJyXTtcclxufVxyXG5cclxuZnVuY3Rpb24gZmluZEluZGV4KGFyciwgaW5kZXgsIGNvbXBhcmVGbikge1xyXG5cdGlmIChhcnIubGVuZ3RoIDw9IDEgfHwgaW5kZXggPT09IDApIHJldHVybiBhcnJbMF07XHJcblx0dmFyIFtzZWxlY3QsIHNlY19hcnJdID0gcmFuZG9tVmFsdWUoYXJyKTtcclxuXHR2YXIgW2xlZnRBcnIsIHJpZ2h0QXJyXSA9IGZpbHRlckxBbmRSKHNlY19hcnIsIHNlbGVjdCwgY29tcGFyZUZuKTtcclxuXHR2YXIgbiA9IHJpZ2h0QXJyLmxlbmd0aDtcclxuXHJcblx0aWYgKG4gPT09IGluZGV4IC0gMSkgcmV0dXJuIHNlbGVjdDtcclxuXHRpZiAobiA+PSBpbmRleCkgcmV0dXJuIGZpbmRJbmRleChyaWdodEFyciwgaW5kZXgsIGNvbXBhcmVGbik7XHJcblx0ZWxzZSByZXR1cm4gZmluZEluZGV4KGxlZnRBcnIsIGluZGV4IC0gbiAtIDEsIGNvbXBhcmVGbik7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZmluZEluZGV4OyIsInZhciBVdGlscyA9IHt9O1xyXG5cclxudmFyIHVpZCA9IFV0aWxzLnVpZCA9ICgoKSA9PiB7XHJcblx0bGV0IHQgPSBEYXRlLm5vdygpO1xyXG5cdHJldHVybiAoKSA9PiB7XHJcblx0XHRyZXR1cm4gKHQrKykudG9TdHJpbmcoMTYpO1xyXG5cdH07XHJcbn0pKCk7XHJcblxyXG5cclxudmFyIG1lcmdlID0gVXRpbHMubWVyZ2UgPSAodGFyZ2V0LCBhZGRpdGlvbmFsLCBkZWVwKSA9PiB7XHJcblx0bGV0IGRlcHRoID0gdHlwZW9mIGRlZXAgPT0gJ3VuZGVmaW5lZCcgPyAyIDogZGVlcCwgcHJvcDtcclxuXHJcblx0Zm9yIChwcm9wIGluIGFkZGl0aW9uYWwpIHtcclxuXHRcdGlmIChhZGRpdGlvbmFsLmhhc093blByb3BlcnR5KHByb3ApKSB7XHJcblx0XHRcdGlmICh0eXBlb2YgdGFyZ2V0W3Byb3BdICE9PSAnb2JqZWN0JyB8fCAhZGVwdGgpIHtcclxuXHRcdFx0XHR0YXJnZXRbcHJvcF0gPSBhZGRpdGlvbmFsW3Byb3BdO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFV0aWxzLm1lcmdlKHRhcmdldFtwcm9wXSwgYWRkaXRpb25hbFtwcm9wXSwgZGVwdGggLSAxKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHRhcmdldDtcclxufTtcclxuXHJcbnZhciBmaW5kSW5kZXggPSBVdGlscy5maW5kSW5kZXggPSByZXF1aXJlKCcuL0ZpbmRJbmRleCcpO1xyXG52YXIgY29tcGFyZUZuID0gVXRpbHMuY29tcGFyZUZuID0gcmVxdWlyZSgnLi91dGlscy9Db21wYXJlcicpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBVdGlsczsiLCJ2YXIgY29udGV4dCA9IHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnID8gdGhpcyA6IHdpbmRvdztcclxuZXhwb3J0cy4kID0gY29udGV4dC4kO1xyXG5leHBvcnRzLl8gPSBjb250ZXh0Ll87IiwiLyoqXHJcbiAqIOWIm+W7uuavlOi+g+WHveaVsFxyXG4gKiBAc3VtbWFyeSDnuqbmnZ/mnaHku7bvvIzlj6rpkojlr7nlr7nosaHmlbDnu4Tnu5PmnoTnmoTmlbDmja7vvIzlpoJcclxuICogICAgICBbe1wiY29sXzFcIjogMTAsIFwiY29sXzJcIjogMzUsIFwiY29sXzNcIjogNjZ9LCAuLi5dXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqICB2YXIgc29ydHMgPSBbJ0EnLCdCJywnQycsJ0QnXTtcclxuICogIHZhciBkaXJzID0gWzEsIC0xLCAxLCAxXTtcclxuICpcclxuICogIHZhciBkYXRhMyA9IFtcclxuICogICAgICB7QToxLEI6MSxDOjUsX2lkOjF9LFxyXG4gKiAgICAgIHtBOjEsQjozLEM6NSxfaWQ6MX0sXHJcbiAqICAgICAge0E6MixCOjUsQzo0LF9pZDoyfSxcclxuICogICAgICB7QToxLEI6MSxDOjksX2lkOjF9LFxyXG4gKiAgICAgIHtBOjMsQjozLEM6MyxfaWQ6M30sXHJcbiAqICAgICAge0E6MSxCOjEsQzozLF9pZDoxfSxcclxuICogICAgICB7QTo0LEI6MixDOjIsX2lkOjR9LFxyXG4gKiAgICAgIHtBOjUsQjo0LEM6MSxfaWQ6NX0sXHJcbiAqICBdO1xyXG4gKlxyXG4gKiAgdmFyIGZuID0gY29tcGFyZUZuKHNvcnRzLCBkaXJzKTtcclxuICogIHZhciByZXQgPSBkYXRhMy5zb3J0KGZuKS5tYXAoZCA9PiBPYmplY3QudmFsdWVzKGQpKTtcclxuICogIGNvbnNvbGUuZGlyKHJldCk7XHJcbiAqXHJcbiAqIEBwYXJhbSB7QXJyYXl9IHNvcnRzIC3mjpLluo/lrZfmrrXmlbDnu4QgWydjb2xfMScsICdjb2xfMicsICdjb2xfMycsLi4uXVxyXG4gKiBAcGFyYW0ge0FycmF5fSBkaXJzIC3lr7nlupTlrZfkvZPmjpLluo/mlbDnu4TnmoTljYfpmY3luo8sMe+8muWNh+W6jyAtMe+8mumZjeW6jyBbMSwgLTFdXHJcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0g5q+U6L6D5Ye95pWwXHJcbiAqL1xyXG5leHBvcnRzLmNvbXBhcmVGbiA9IGZ1bmN0aW9uIGNvbXBhcmVGbihzb3J0cywgZGlycykge1xyXG4gICAgdmFyIGNvbmRpdGlvbnMgPSBzb3J0cy5yZWR1Y2UoKHByZSwgbmV4dCwgaSkgPT4ge1xyXG4gICAgICAgIHByZSAgPSBwcmUgPyBwcmUgKyAnIHx8JyA6ICcnO1xyXG4gICAgICAgIHJldHVybiBgJHtwcmV9IChhLiR7bmV4dH0gLSBiLiR7bmV4dH0pICogJHtkaXJzW2ldfWA7XHJcbiAgICB9LCAnJyk7XHJcblxyXG4gICAgdmFyIGZ1bmN0aW9uX2JvZHkgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICBsZXQgc29ydEluZm8gPSBzb3J0cy5qb2luKCcsJykucmVwbGFjZSgvKFxcdyspL2csICdcIiQxXCInKTtcclxuICAgICAgICByZXR1cm4gYHZhciBzb3J0ID0gWyR7c29ydEluZm99XTsgcmV0dXJuICR7Y29uZGl0aW9uc31gO1xyXG4gICAgfVxyXG4gICAgLy8gY29uc29sZS5sb2coZnVuY3Rpb25fYm9keSgpKTtcclxuICAgIFxyXG4gICAgcmV0dXJuIG5ldyBGdW5jdGlvbignYScsICdiJywgZnVuY3Rpb25fYm9keSgpKTtcclxufVxyXG5cclxuXHJcbiJdfQ==
