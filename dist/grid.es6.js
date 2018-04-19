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

class RowNode {
	constructor(colsModel) {
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
		var content;
		var cells = this.children;

		this.colsModel.each(colM => {

			content = colM.renderer(row.data[colM.dataIndex]);
			// TODO addClass(()=> row.cell[colM.dataIndex].selected)
			cells.get(colM).html(content);

		});

		return this.$node.css('top', offsetTop).attr('rid', row.rid);
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
			nodes.push(new RowNode(this.colsModel));
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
var throttle = function(fn, time) {
	var timer = null;
	return function(...args) {
		if (timer) clearTimeout(timer);

		timer = setTimeout(() => {
			fn.apply(null, args);
		}, time);
	}
}

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
		// var dealyFn = throttle(handler, delay);

		this._triggerY = throttle((y) => {
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
				// console.log(sec);
				// TODO
				// copy($('.cell.selected'));
			});
	}

	selectionRange([x0, y0], [x1, y1]) {

		let yDir = y1 - y0;
		let lastY = this.lastY;
			
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
		
		this.lastY = y1;
		console.log(yDir, removeYRange);

		let dataIndex = this.getLockAndVisiableColumnAsDataIndex();
		[x0, y0, x1, y1] = orderBy(x0, y0, x1, y1, dataIndex);


		let cols = dataIndex.slice(dataIndex.indexOf(x0), dataIndex.indexOf(x1)+1);
		console.log(cols);
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY29yZS9CdWZmZXJOb2RlLmpzIiwic3JjL2NvcmUvQnVmZmVyWm9uZS5qcyIsInNyYy9jb3JlL0NvbE1vZGVsLmpzIiwic3JjL2NvcmUvR3JpZFN0b3JlLmpzIiwic3JjL2NvcmUvR3JpZFZpZXcuanMiLCJzcmMvY29yZS9IZWFkZXIuanMiLCJzcmMvY29yZS9Mb2NrQ29sTWFuYWdlci5qcyIsInNyYy9jb3JlL1Njcm9sbGVyLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL3BsdWdpbi9TZWxlY3Rpb24uanMiLCJzcmMvdXRpbC9ERC5qcyIsInNyYy91dGlsL0V2ZW50RW1pdHRlci5qcyIsInNyYy91dGlsL0ZpbmRJbmRleC5qcyIsInNyYy91dGlsL1V0aWxzLmpzIiwic3JjL3V0aWwvc2hpbS5qcyIsInNyYy91dGlsL3V0aWxzL0NvbXBhcmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRkE7QUFDQTtBQUNBOztBQ0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6V0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCcuLi91dGlsL0V2ZW50RW1pdHRlcicpO1xyXG52YXIgJCA9IHJlcXVpcmUoJy4uL3V0aWwvc2hpbScpLiQ7XHJcblxyXG52YXIgZGVmaW5lRGVsbCA9IGZ1bmN0aW9uKGNvbE0pIHtcclxuXHRsZXQgY2VsbCA9ICQoJzxsaS8+JylcclxuXHRcdC5hZGRDbGFzcygnYy1ncmlkLWNlbGwnKVxyXG5cdFx0LmFkZENsYXNzKCdjLWFsaWduLScgKyBjb2xNLmFsaWduKVxyXG5cdFx0LmF0dHIoJ3RhYmluZGV4JywgLTEpXHJcblx0XHQuZGF0YSgnZGF0YUluZGV4JywgY29sTS5kYXRhSW5kZXgpXHJcblx0XHQud2lkdGgoY29sTS53aWR0aCk7XHJcblxyXG5cdGlmIChjb2xNLmxvY2tlZCkge1xyXG5cdFx0Y2VsbC5hZGRDbGFzcygnYy1jb2x1bW4tbG9ja2VkJyk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gY2VsbDtcclxufTtcclxuXHJcbnZhciBjcmVhdGVDZWxsID0gZnVuY3Rpb24oJHJvdywgY29sc01vZGVsKSB7XHJcblx0dmFyIHNpemUgPSBjb2xzTW9kZWwuc2l6ZSgpO1xyXG5cdHZhciBjaGlsZHJlbiA9IG5ldyBNYXAoKTtcclxuXHJcblx0Y29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblx0XHRsZXQgY2VsbCA9IGRlZmluZURlbGwoY29sTSk7XHJcblxyXG5cdFx0JHJvdy5hcHBlbmQoY2VsbCk7XHJcblx0XHRjaGlsZHJlbi5zZXQoY29sTSwgY2VsbCk7XHJcblx0fSk7XHJcblxyXG5cdHJldHVybiBjaGlsZHJlbjtcclxufTtcclxuXHJcbmNsYXNzIFJvd05vZGUge1xyXG5cdGNvbnN0cnVjdG9yKGNvbHNNb2RlbCkge1xyXG5cdFx0dGhpcy5jb2xzTW9kZWwgPSBjb2xzTW9kZWw7XHJcblx0XHR0aGlzLiRub2RlID0gJCgnPHVsLz4nKS5hZGRDbGFzcygnYy1ncmlkLXJvdycpO1xyXG5cclxuXHRcdHRoaXMuY2hpbGRyZW4gPSBjcmVhdGVDZWxsKHRoaXMuJG5vZGUsIGNvbHNNb2RlbCk7XHJcblx0XHR0aGlzLl9iaW5kRXZlbnQoY29sc01vZGVsKTtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoY29sc01vZGVsKSB7XHJcblx0XHR0aGlzLmNvbHNNb2RlbC5vbignY29sdW1uLWFkZCcsIGNvbE0gPT4ge1xyXG5cdFx0XHRsZXQgY2VsbCA9IGRlZmluZURlbGwoY29sTSk7XHJcblxyXG5cdFx0XHR0aGlzLiRub2RlLmFwcGVuZChjZWxsKTtcclxuXHRcdFx0dGhpcy5jaGlsZHJlbi5zZXQoY29sTSwgY2VsbCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRjb2xzTW9kZWwuZWFjaChjb2xNID0+IHtcclxuXHRcdFx0Y29sTS5vbignY29sdW1uLXJlc2l6ZWQnLCB3aWR0aCA9PiB7XHJcblx0XHRcdFx0Y29uc29sZS5sb2cod2lkdGgpO1xyXG5cdFx0XHRcdHRoaXMuY2hpbGRyZW4uZ2V0KGNvbE0pLm91dGVyV2lkdGgod2lkdGgpO1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1oaWRkZW4nLCBpc0hpZGRlbiA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY2hpbGRyZW4uZ2V0KGNvbE0pO1xyXG5cdFx0XHRcdGlmIChpc0hpZGRlbikge1xyXG5cdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKCdjLWNvbHVtbi1oaWRlJyk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcygnYy1jb2x1bW4taGlkZScpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tbG9ja2VkJywgaXNMb2NrZWQgPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNoaWxkcmVuLmdldChjb2xNKTtcclxuXHJcblx0XHRcdFx0aWYgKGlzTG9ja2VkKSB7XHJcblx0XHRcdFx0XHRjb2xFbGUuYWRkQ2xhc3MoJ2MtY29sdW1uLWxvY2tlZCcpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoJ2MtY29sdW1uLWxvY2tlZCcpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdkZXN0b3J5JywgKCkgPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNoaWxkcmVuLmdldChjb2xNKTtcclxuXHRcdFx0XHR0aGlzLmNoaWxkcmVuLmRlbGV0ZShjb2xNKTtcdFx0XHRcclxuXHRcdFx0XHRjb2xFbGUucmVtb3ZlKCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRzZXREYXRhKHJvdywgb2Zmc2V0VG9wKSB7XHJcblx0XHR2YXIgY29udGVudDtcclxuXHRcdHZhciBjZWxscyA9IHRoaXMuY2hpbGRyZW47XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwuZWFjaChjb2xNID0+IHtcclxuXHJcblx0XHRcdGNvbnRlbnQgPSBjb2xNLnJlbmRlcmVyKHJvdy5kYXRhW2NvbE0uZGF0YUluZGV4XSk7XHJcblx0XHRcdC8vIFRPRE8gYWRkQ2xhc3MoKCk9PiByb3cuY2VsbFtjb2xNLmRhdGFJbmRleF0uc2VsZWN0ZWQpXHJcblx0XHRcdGNlbGxzLmdldChjb2xNKS5odG1sKGNvbnRlbnQpO1xyXG5cclxuXHRcdH0pO1xyXG5cclxuXHRcdHJldHVybiB0aGlzLiRub2RlLmNzcygndG9wJywgb2Zmc2V0VG9wKS5hdHRyKCdyaWQnLCByb3cucmlkKTtcclxuXHR9XHJcbn1cclxuXHJcbmNsYXNzIEJ1ZmZlck5vZGUgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cdGNvbnN0cnVjdG9yKGxpbWl0LCBjb2xzTW9kZWwsIHRvdGFsLCBjYWNoZVRpbWVzKSB7XHJcblx0XHRzdXBlcigpO1xyXG5cdFx0dGhpcy5pbml0KGxpbWl0LCBjb2xzTW9kZWwsIHRvdGFsLCBjYWNoZVRpbWVzKTtcclxuXHR9XHJcblxyXG5cdGluaXQobGltaXQsIGNvbHNNb2RlbCwgdG90YWwsIGNhY2hlVGltZXMpIHtcclxuXHRcdHRoaXMubGltaXQgPSBsaW1pdDtcclxuXHRcdHRoaXMudG90YWwgPSB0b3RhbDtcclxuXHRcdHRoaXMuY2FjaGVUaW1lcyA9IGNhY2hlVGltZXMgfHwgMztcclxuXHRcdHRoaXMubm9kZUxpc3QgPSBbXTtcclxuXHRcdHRoaXMuY29sc01vZGVsID0gY29sc01vZGVsO1xyXG5cdH1cclxuXHJcblx0Z2V0Tm9kZUxpc3QoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5ub2RlTGlzdDtcclxuXHR9XHJcblxyXG5cdHNldExpbWl0KGxpbWl0KSB7XHJcblx0XHRpZiAoK2xpbWl0ID4gMCkge1xyXG5cdFx0XHR0aGlzLmluaXQobGltaXQsIHRoaXMuY29sc01vZGVsLCB0aGlzLnRvdGFsLCB0aGlzLmNhY2hlVGltZXMpO1xyXG5cdFx0XHR0aGlzLmZpcmUoJ2J1ZmZlci1pbml0aWFsJyk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRzZXRUb3RhbCh0b3RhbCkge1xyXG5cdFx0aWYgKCt0b3RhbCA+PSAwKSB7XHJcblx0XHRcdHRoaXMudG90YWwgPSB0b3RhbDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlzRW5vdWdoKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMubm9kZUxpc3QubGVuZ3RoID49IE1hdGgubWluKHRoaXMudG90YWwsIHRoaXMuY2FjaGVUaW1lcyAqIHRoaXMubGltaXQpO1xyXG5cdH1cclxuXHJcblx0Z2V0KGRpciwgZG9tYWluKSB7XHJcblx0XHRpZiAodGhpcy5pc0Vub3VnaCgpKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLl9nZXROb2RlcyhkaXIsIGRvbWFpbik7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuX2FkZE5vZGVzKGRpciwgZG9tYWluKTtcclxuXHR9XHJcblxyXG5cdF9nZXROb2RlcyhkaXIsIFtzdGFydCwgZW5kXSkge1xyXG5cdFx0dmFyIHNlbGVjdGVkO1xyXG5cclxuXHRcdGlmIChkaXIgPiAwKSB7XHJcblx0XHRcdHNlbGVjdGVkID0gdGhpcy5ub2RlTGlzdC5zbGljZSgwLCBlbmQgLSBzdGFydCArIDEpO1xyXG5cdFx0XHR0aGlzLm5vZGVMaXN0ID0gdGhpcy5ub2RlTGlzdC5zbGljZShlbmQgLSBzdGFydCArIDEpLmNvbmNhdChzZWxlY3RlZCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRzZWxlY3RlZCA9IHRoaXMubm9kZUxpc3Quc2xpY2Uoc3RhcnQgLSBlbmQgLSAxKTtcclxuXHRcdFx0dGhpcy5ub2RlTGlzdCA9IHNlbGVjdGVkLmNvbmNhdCh0aGlzLm5vZGVMaXN0LnNsaWNlKDAsIHN0YXJ0IC0gZW5kIC0gMSkpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBzZWxlY3RlZCB8fCBbXTtcclxuXHR9XHJcblxyXG5cdF9hZGROb2RlcyhkaXIsIFtzdGFydCwgZW5kXSkge1xyXG5cdFx0dmFyIG5vZGVzID0gW107XHJcblxyXG5cdFx0Zm9yICh2YXIgaSA9IHN0YXJ0OyBpIDw9IGVuZDsgaSsrKSB7XHJcblx0XHRcdG5vZGVzLnB1c2gobmV3IFJvd05vZGUodGhpcy5jb2xzTW9kZWwpKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLm5vZGVMaXN0ID0gZGlyID4gMCA/IHRoaXMubm9kZUxpc3QuY29uY2F0KG5vZGVzKSA6IG5vZGVzLmNvbmNhdCh0aGlzLm5vZGVMaXN0KTtcclxuXHJcblx0XHRyZXR1cm4gbm9kZXM7XHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEJ1ZmZlck5vZGU7XHJcbiIsImNsYXNzIEJ1ZmZlclpvbmUge1xyXG5cdGNvbnN0cnVjdG9yKGxpbWl0LCB0b3RhbCwgY2FjaGVUaW1lcykge1xyXG5cdFx0dGhpcy5pbml0KGxpbWl0LCB0b3RhbCwgY2FjaGVUaW1lcyk7XHJcblx0fVxyXG5cclxuXHRpbml0KGxpbWl0LCB0b3RhbCwgY2FjaGVUaW1lcykge1xyXG5cdFx0dGhpcy5zdGFydCA9IDA7XHJcblx0XHR0aGlzLmVuZCA9IHRoaXMubGltaXQgPSBsaW1pdDtcclxuXHRcdHRoaXMudG90YWwgPSArdG90YWw7XHJcblx0XHR0aGlzLmNhY2hlVGltZXMgPSBjYWNoZVRpbWVzIHx8IDM7XHJcblx0XHR0aGlzLmRvbWFpbiA9IFt0aGlzLnN0YXJ0LCB0aGlzLmVuZF07XHJcblx0fVxyXG5cclxuXHRzZXRMaW1pdChsaW1pdCkge1xyXG5cdFx0aWYgKCtsaW1pdCA+IDApIHtcclxuXHRcdFx0dGhpcy5pbml0KGxpbWl0LCB0aGlzLnRvdGFsKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHNldFRvdGFsKHRvdGFsKSB7XHJcblx0XHRpZiAoK3RvdGFsID49IDApIHtcclxuXHRcdFx0dGhpcy50b3RhbCA9IHRvdGFsO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0aXNBbW9uZyh2YWx1ZSkge1xyXG5cdFx0cmV0dXJuIHRoaXMuc3RhcnQgPD0gdmFsdWUgJiYgdmFsdWUgPD0gdGhpcy5lbmQ7XHJcblx0fVxyXG5cclxuXHRzaG91bGRMb2FkKGRpciwgdmVybmllcikge1xyXG5cdFx0aWYgKGRpciA9PT0gMCkgcmV0dXJuIGZhbHNlO1xyXG5cclxuXHRcdHZhciBzdGFydCA9IHRoaXMuc3RhcnQ7XHJcblx0XHR2YXIgZW5kID0gdGhpcy5lbmQ7XHJcblx0XHR2YXIgY2FjaGVUaW1lcyA9IHRoaXMuY2FjaGVUaW1lcztcclxuXHJcblx0XHQvLyBzY3JvbGwgdXBcclxuXHRcdGlmIChkaXIgPCAwICYmIHN0YXJ0ID09PSAwKSByZXR1cm4gZmFsc2U7XHJcblx0XHRpZiAoZGlyIDwgMCAmJiB2ZXJuaWVyIDwgc3RhcnQgKyB0aGlzLmxpbWl0KSB7XHJcblx0XHRcdGlmICh0aGlzLmlzQW1vbmcodmVybmllcikpIHtcclxuXHRcdFx0XHRlbmQgPSBzdGFydCAtIDE7XHJcblx0XHRcdFx0c3RhcnQgPSBNYXRoLm1heCgwLCBlbmQgLSB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fSBlbHNlIGlmICh2ZXJuaWVyID09PSAwKSB7XHJcblx0XHRcdFx0ZW5kID0gTWF0aC5taW4odGhpcy50b3RhbCwgdmVybmllciArIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0XHRzdGFydCA9IDA7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0ZW5kID0gdmVybmllciArIHRoaXMubGltaXQ7XHJcblx0XHRcdFx0c3RhcnQgPSBNYXRoLm1heCgwLCB2ZXJuaWVyIC0gKGNhY2hlVGltZXMgLSAxKSAqIHRoaXMubGltaXQpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLmRvbWFpbiA9IFtzdGFydCwgZW5kXTtcclxuXHRcdFx0dGhpcy5zdGFydCA9IHN0YXJ0O1xyXG5cdFx0XHR0aGlzLmVuZCA9IE1hdGgubWluKHN0YXJ0ICsgY2FjaGVUaW1lcyAqIHRoaXMubGltaXQsIHRoaXMuZW5kKTtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gc2Nyb2xsIGRvd25cclxuXHRcdGlmIChkaXIgPiAwICYmIGVuZCA9PT0gdGhpcy50b3RhbCkgcmV0dXJuIGZhbHNlO1xyXG5cdFx0aWYgKGRpciA+IDAgJiYgdmVybmllciA+IGVuZCAtIHRoaXMubGltaXQpIHtcclxuXHRcdFx0Ly8g5ri45qCH5Zyo546w5pyJ6IyD5Zu05YaFXHJcblx0XHRcdGlmICh0aGlzLmlzQW1vbmcodmVybmllcikpIHtcclxuXHRcdFx0XHRzdGFydCA9IGVuZCArIDE7XHJcblx0XHRcdFx0ZW5kID0gTWF0aC5taW4odGhpcy50b3RhbCwgc3RhcnQgKyB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvLyDmuLjmoIfliLDovr7nu5PlsL5cclxuXHRcdFx0ZWxzZSBpZiAodmVybmllciA9PT0gdGhpcy50b3RhbCkge1xyXG5cdFx0XHRcdGVuZCA9IHRoaXMudG90YWw7XHJcblx0XHRcdFx0c3RhcnQgPSBNYXRoLm1heCgwLCB2ZXJuaWVyIC0gY2FjaGVUaW1lcyAqIHRoaXMubGltaXQpO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIOS4jeWcqOeOsOacieiMg+WbtOWPiOacquWIsOe7k+WwvuWkhFxyXG5cdFx0XHRlbHNlIHtcclxuXHRcdFx0XHRlbmQgPSBNYXRoLm1pbih0aGlzLnRvdGFsLCB2ZXJuaWVyICsgKGNhY2hlVGltZXMgLSAxKSAqIHRoaXMubGltaXQpO1xyXG5cdFx0XHRcdHN0YXJ0ID0gTWF0aC5tYXgoMCwgZW5kIC0gY2FjaGVUaW1lcyAqIHRoaXMubGltaXQpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLmRvbWFpbiA9IFtzdGFydCwgZW5kXTtcclxuXHRcdFx0dGhpcy5lbmQgPSBlbmQ7XHJcblx0XHRcdHRoaXMuc3RhcnQgPSBNYXRoLm1heCh0aGlzLnN0YXJ0LCBlbmQgLSBjYWNoZVRpbWVzICogdGhpcy5saW1pdCk7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEJ1ZmZlclpvbmU7IiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJy4uL3V0aWwvRXZlbnRFbWl0dGVyJyk7XHJcbnZhciBVdGlscyA9IHJlcXVpcmUoJy4uL3V0aWwvVXRpbHMnKTtcclxudmFyIF8gPSByZXF1aXJlKCcuLi91dGlsL3NoaW0nKS5fO1xyXG5cclxudmFyIGRlZlJlbmRlcmVyID0gdiA9PiB2O1xyXG52YXIgT1JERVIgPSBbJ0FTQycsICdERVNDJ107XHJcblxyXG5jbGFzcyBDb2x1bW4gZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cdGNvbnN0cnVjdG9yKGNpZCwgb3B0aW9ucywgY29udGV4dCkge1xyXG5cdFx0c3VwZXIoKTtcclxuXHJcblx0XHRvcHRpb25zLnJlbmRlcmVyID0gb3B0aW9ucy5yZW5kZXJlciB8fCBkZWZSZW5kZXJlcjtcclxuXHJcblx0XHR2YXIgZGVmYXVsdHMgPSB7XHJcblx0XHRcdCd0ZXh0JzogJycsXHJcblx0XHRcdCd2dHlwZSc6ICdzdHJpbmcnLFxyXG5cdFx0XHQnZGF0YUluZGV4JzogJycsXHJcblx0XHRcdCd3aWR0aCc6IDUwLFxyXG5cdFx0XHQnYWxpZ24nOiAnbGVmdCcsXHJcblxyXG5cdFx0XHQncmVzaXphYmxlJzogdHJ1ZSxcclxuXHRcdFx0J2Nscyc6ICcnLFxyXG5cdFx0XHQnZml4ZWQnOiBmYWxzZSxcclxuXHRcdFx0J2RyYWdnYWJsZSc6IGZhbHNlLFxyXG5cdFx0XHQnc29ydGFibGUnOiB0cnVlLFxyXG5cdFx0XHQnaGlkZGVuJzogZmFsc2UsXHJcblx0XHRcdCdsb2NrZWQnOiBmYWxzZSxcclxuXHRcdFx0J2xvY2thYmxlJzogdHJ1ZSxcclxuXHRcdFx0J21lbnVEaXNhYmxlZCc6IHRydWUsXHJcblxyXG5cdFx0XHQnc29ydFN0YXRlJzogbnVsbFxyXG5cdFx0fTtcclxuXHJcblx0XHR0aGlzLmNpZCA9IGNpZDtcclxuXHRcdHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XHJcblx0XHRPYmplY3QuYXNzaWduKHRoaXMsIGRlZmF1bHRzLCBvcHRpb25zKTtcclxuXHR9XHJcblxyXG5cdHNldFdpZHRoKG51bSkge1xyXG5cdFx0aWYgKCF0aGlzLnJlc2l6YWJsZSkgcmV0dXJuO1xyXG5cdFx0aWYgKGlzTmFOKG51bSkpIHJldHVybjtcclxuXHJcblx0XHR0aGlzLndpZHRoID0gK251bTtcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLXJlc2l6ZWQnLCB0aGlzLndpZHRoLCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdHNob3coKSB7XHJcblx0XHR0aGlzLmhpZGRlbiA9IGZhbHNlO1xyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4taGlkZGVuJywgdGhpcy5oaWRkZW4sIHRoaXMpO1xyXG5cdH1cclxuXHJcblx0aGlkZSgpIHtcclxuXHRcdHRoaXMudW5Mb2NrKCk7XHJcblx0XHRcclxuXHRcdHRoaXMuaGlkZGVuID0gdHJ1ZTtcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLWhpZGRlbicsIHRoaXMuaGlkZGVuLCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdHRvZ2dsZSgpIHtcclxuXHRcdGlmICh0aGlzLmhpZGRlbikge1xyXG5cdFx0XHR0aGlzLnNob3coKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoaXMuaGlkZSgpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0bG9jaygpIHtcclxuXHRcdGlmICghdGhpcy5sb2NrYWJsZSkgcmV0dXJuO1xyXG5cdFx0aWYgKHRoaXMubG9ja2VkKSByZXR1cm47XHJcblxyXG5cdFx0dGhpcy5zaG93KCk7XHJcblxyXG5cdFx0dGhpcy5sb2NrZWQgPSB0cnVlO1xyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4tbG9ja2VkJywgdGhpcy5sb2NrZWQsIHRoaXMpO1xyXG5cdH1cclxuXHJcblx0dW5Mb2NrKCkge1xyXG5cdFx0aWYgKCF0aGlzLmxvY2thYmxlKSByZXR1cm47XHJcblx0XHRpZiAoIXRoaXMubG9ja2VkKSByZXR1cm47XHJcblxyXG5cdFx0dGhpcy5sb2NrZWQgPSBmYWxzZTtcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLWxvY2tlZCcsIHRoaXMubG9ja2VkLCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIG9yZGVyW0FTQywgREVTQywgTk9fU09SVF1cclxuXHQgKi9cclxuXHRzb3J0KG9yZGVyKSB7XHJcblx0XHRpZiAoIXRoaXMuc29ydGFibGUgfHwgIXRoaXMuZGF0YUluZGV4KSByZXR1cm47XHJcblxyXG5cdFx0aWYgKG9yZGVyKSB7XHJcblx0XHRcdHRoaXMuc29ydFN0YXRlID0gT1JERVIuaW5jbHVkZXMob3JkZXIpID8gb3JkZXIgOiBudWxsO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhpcy5zb3J0U3RhdGUgPSB0aGlzLnNvcnRTdGF0ZSA9PT0gT1JERVJbMV0gPyBPUkRFUlswXSA6IE9SREVSWzFdO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1zb3J0LWNoYW5nZWQnLCB0aGlzLnNvcnRTdGF0ZSk7XHJcblx0XHR0aGlzLmNvbnRleHQuZmlyZSgnbm90aWNlLWNvbE1vZGVsLXNvcnQtY2hhbmdlZCcpO1xyXG4gXHR9XHJcblxyXG4gXHRyZW1vdmUoKSB7XHJcbiBcdFx0dGhpcy5maXJlKCdkZXN0b3J5Jyk7XHJcbiBcdFx0dGhpcy5jb250ZXh0LmZpcmUoJ2NvbHVtbi1yZW1vdmVkJywgdGhpcyk7XHJcbiBcdFx0dGhpcy5yZW1vdmVFdmVudCgpO1xyXG4gXHR9XHJcbn1cclxuXHJcblxyXG5jbGFzcyBDb2xNb2RlbCBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblx0Y29uc3RydWN0b3IoY29sdW1ucykge1xyXG5cdFx0c3VwZXIoKTtcclxuXHJcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoY29sdW1ucykpIHtcclxuXHRcdFx0dGhyb3cgJ3JlcXVpcmUgcHJvcGVydHkgY29sdW1ucyBpcyBhIGFycmF5IG9iamVjdCc7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5jb2x1bW5zID0gW107IC8vIGRhdGEgYnkgY29sdW1uXHJcblx0XHR0aGlzLmNvbE1vZGVsID0gbmV3IE1hcCgpOyAvLyBkYXRhIGJ5IGNpZFxyXG5cdFx0dGhpcy5jb2xIZWFkZXJzID0gbmV3IE1hcCgpOyAvLyBkYXRhIGJ5IGRhdGFJbmRleFxyXG5cclxuXHRcdHRoaXMuX2luaXRDb2x1bW4oY29sdW1ucyk7XHJcblx0XHR0aGlzLl9iaW5kRXZlbnQoKTtcclxuXHR9XHJcblxyXG5cdF9pbml0Q29sdW1uKGNvbHVtbnMsIGNhbGxiYWNrKSB7XHJcblx0XHRsZXQgc2l6ZSA9IHRoaXMuc2l6ZSgpO1xyXG5cclxuXHRcdGNvbHVtbnMuZm9yRWFjaCgoY29sLCBpbmRleCkgPT4ge1xyXG5cdFx0XHRsZXQgY2lkID0gaW5kZXggKyBzaXplO1xyXG5cdFx0XHRsZXQgY29sTSA9IG5ldyBDb2x1bW4oY2lkLCBjb2wsIHRoaXMpO1xyXG5cclxuXHRcdFx0dGhpcy5jb2xNb2RlbC5zZXQoY2lkLCBjb2xNKTtcclxuXHRcdFx0dGhpcy5jb2x1bW5zLnB1c2goY29sTSk7XHJcblx0XHRcdHRoaXMuY29sSGVhZGVycy5zZXQoY29sLmRhdGFJbmRleCwgY29sTSk7XHJcblxyXG5cdFx0XHRjYWxsYmFjayAmJiBjYWxsYmFjayhjb2xNKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0YWRkQ29sdW1ucyhjb2x1bW5zKSB7XHJcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoY29sdW1ucykpIHtcclxuXHRcdFx0Y29sdW1ucyA9IFtjb2x1bW5zXTtcclxuXHRcdH1cclxuXHRcdHRoaXMuX2luaXRDb2x1bW4oY29sdW1ucywgY29sTSA9PiB0aGlzLmZpcmUoJ2NvbHVtbi1hZGQnLCBjb2xNKSk7XHJcblx0fVxyXG5cclxuXHRyZW1vdmVDb2x1bW4oZGF0YUluZGV4KSB7XHJcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoZGF0YUluZGV4KSkge1xyXG5cdFx0XHRkYXRhSW5kZXggPSBbZGF0YUluZGV4XTtcclxuXHRcdH1cclxuXHJcblx0XHRkYXRhSW5kZXguZm9yRWFjaChkcyA9PiB7XHJcblx0XHRcdGxldCBjb2xNID0gdGhpcy5nZXRDb2x1bW5CeURhdGFJbmRleChkcyk7XHJcblxyXG5cdFx0XHRpZiAoY29sTSkge1xyXG5cdFx0XHRcdGNvbE0ucmVtb3ZlKCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0X2JpbmRFdmVudCgpIHtcclxuXHRcdHRoaXMub24oJ25vdGljZS1jb2xNb2RlbC1zb3J0LWNoYW5nZWQnLCBfLmRlYm91bmNlKCgpID0+IHtcclxuXHRcdFx0dGhpcy5maXJlKCdjb2x1bW5zLXNvcnQtY2hhbmdlZCcpO1xyXG5cdFx0fSwgMjApKTtcclxuXHJcblx0XHR0aGlzLm9uKCdjb2x1bW4tcmVtb3ZlZCcsIGNvbE0gPT4ge1xyXG5cdFx0XHR0aGlzLmNvbHVtbnMgPSB0aGlzLmNvbHVtbnMuZmlsdGVyKGNvbCA9PiBjb2wuZGF0YUluZGV4ICE9IGNvbE0uZGF0YUluZGV4KTtcclxuXHRcdFx0dGhpcy5jb2xNb2RlbC5kZWxldGUoY29sTS5jaWQpO1xyXG5cdFx0XHR0aGlzLmNvbEhlYWRlcnMuZGVsZXRlKGNvbE0uZGF0YUluZGV4KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0c2l6ZSgpIHsgXHJcblx0XHRyZXR1cm4gdGhpcy5jb2xNb2RlbC5zaXplOyBcclxuXHR9XHJcblxyXG5cdGdldENvbHVtbihjb2wpIHtcclxuXHRcdGlmICh0aGlzLmNvbHVtbnMuaW5jbHVkZXMoY29sKSkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5jb2x1bW5zLmZpbHRlcihfY29sID0+IF9jb2wgPT0gY29sKVswXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcy5jb2x1bW5zO1xyXG5cdH1cclxuXHJcblx0Z2V0TG9ja0NvbHVtbigpIHtcclxuXHRcdHJldHVybiB0aGlzLmNvbHVtbnMuZmlsdGVyKGNvbE0gPT4ge1xyXG5cdFx0XHRyZXR1cm4gY29sTS5sb2NrZWQgPT09IHRydWU7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGdldFZpc2libGVDb2x1bW4oKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5jb2x1bW5zLmZpbHRlcihjb2xNID0+IHtcclxuXHRcdFx0cmV0dXJuICFjb2xNLmhpZGRlbjtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0Z2V0Q29sdW1uQnlEYXRhSW5kZXgoZGF0YUluZGV4KSB7XHJcblx0XHRyZXR1cm4gdGhpcy5jb2xIZWFkZXJzLmdldChkYXRhSW5kZXgpIHx8IG51bGw7XHJcblx0fVxyXG5cclxuXHRnZXRDb2x1bW5zQnlJZChpZCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuY29sTW9kZWxbaWRdIHx8IG51bGw7XHJcblx0fVxyXG5cclxuXHRlYWNoKGNhbGxiYWNrLCBjb250ZXh0KSB7XHJcblx0XHR0aGlzLmNvbHVtbnMuZm9yRWFjaChjYWxsYmFjaywgY29udGV4dCB8fCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdGRlc3RvcnkoKSB7IFxyXG5cclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQ29sTW9kZWw7IiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJy4uL3V0aWwvRXZlbnRFbWl0dGVyJyk7XHJcbnZhciBVdGlscyA9IHJlcXVpcmUoJy4uL3V0aWwvVXRpbHMnKTtcclxudmFyIF8gPSByZXF1aXJlKCcuLi91dGlsL3NoaW0nKS5fO1xyXG5cclxuY2xhc3MgUm93IHtcclxuXHRjb25zdHJ1Y3RvcihyaWQsIGRhdGEpIHtcclxuXHRcdHRoaXMucmlkID0gcmlkO1xyXG5cdFx0dGhpcy5kYXRhID0gZGF0YTtcclxuXHRcdHRoaXMuc2VsZWN0ZWQgPSBmYWxzZTtcclxuXHR9XHJcblx0c3RhdGUoKSB7fVxyXG59XHJcblxyXG5jbGFzcyBHcmlkU3RvcmUgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cclxuXHRjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcblx0XHRzdXBlcigpO1xyXG5cclxuXHRcdHRoaXMuY29sc01vZGVsID0gb3B0aW9ucy5jb2x1bW5Nb2RlbDtcclxuXHJcblx0XHR0aGlzLnJvd3MgPSBbXTsgLy8gZGF0YSBieSBpbmRleFxyXG5cdFx0dGhpcy5yb3dNb2RlbCA9IG5ldyBNYXAoKTsgLy8gZGF0YSBieSBpZFxyXG5cclxuXHJcblx0XHR0aGlzLnNldERhdGEob3B0aW9ucy5kYXRhKTtcclxuXHJcblx0XHR0aGlzLl9zb3J0U3RhdGUgPSB7IGtleXM6IFtdLCBkaXJzOiBbXSB9O1xyXG5cdFx0dGhpcy5fYmluZEV2ZW50KCk7XHJcblx0fVxyXG5cclxuXHRfYmluZEV2ZW50KCkge1xyXG5cclxuXHRcdHRoaXMuY29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1zb3J0LWNoYW5nZWQnLCBzb3J0U3RhdGUgPT4ge1xyXG5cdFx0XHRcdGxldCB7IGtleXMsIGRpcnMgfSA9IHRoaXMuX3NvcnRTdGF0ZTtcclxuXHRcdFx0XHRsZXQgaW5kZXggPSBrZXlzLmluZGV4T2YoY29sTS5kYXRhSW5kZXgpO1xyXG5cclxuXHRcdFx0XHQvLyDmnKrmjpLluo9cclxuXHRcdFx0XHRpZiAoaW5kZXggPT09IC0xICYmICFzb3J0U3RhdGUpIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmIChpbmRleCA9PT0gLTEgJiYgc29ydFN0YXRlKSB7XHJcblx0XHRcdFx0XHRrZXlzLnVuc2hpZnQoY29sTS5kYXRhSW5kZXgpO1xyXG5cdFx0XHRcdFx0ZGlycy51bnNoaWZ0KHNvcnRTdGF0ZS50b0xvd2VyQ2FzZSgpKTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIOW3suaOkuW6jyzlhYjliKDpmaRcclxuXHRcdFx0XHRsZXQga2V5ID0ga2V5cy5zcGxpY2UoaW5kZXgsIDEpWzBdO1xyXG5cdFx0XHRcdGxldCBkaXIgPSBkaXJzLnNwbGljZShpbmRleCwgMSlbMF07XHJcblxyXG5cdFx0XHRcdGlmIChzb3J0U3RhdGUpIHtcclxuXHRcdFx0XHRcdGtleXMudW5zaGlmdChrZXkpO1xyXG5cdFx0XHRcdFx0ZGlycy51bnNoaWZ0KHNvcnRTdGF0ZS50b0xvd2VyQ2FzZSgpKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdC8vIOaJgOacieWIl+mDveabtOaWsOeKtuaAgeWQjlxyXG5cdFx0dGhpcy5jb2xzTW9kZWwub24oJ2NvbHVtbnMtc29ydC1jaGFuZ2VkJywgKCkgPT4ge1xyXG5cdFx0XHRsZXQgeyBrZXlzLCBkaXJzIH0gPSB0aGlzLl9zb3J0U3RhdGU7XHJcblx0XHRcdGxldCBpdGVyYXRlRm4gPSByb3cgPT4gcm93LmRhdGFba2V5c1swXV07XHJcblxyXG5cdFx0XHRjb25zb2xlLmxvZyhrZXlzLCBkaXJzKTtcclxuXHJcblx0XHRcdHRoaXMucm93cyA9IF8ub3JkZXJCeSh0aGlzLnJvd3MsIGl0ZXJhdGVGbiwgZGlycyk7XHJcblx0XHRcdHRoaXMuc2V0RGF0YShfLm1hcCh0aGlzLnJvd3MsICdkYXRhJykpO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRzbGljZShzdGFydCwgZW5kKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yb3dzLnNsaWNlKHN0YXJ0LCBlbmQpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICog6K6+572u5o6S5bqP54q25oCBXHJcblx0ICogKCspQVNDLCAtREVTQywgIU5PX1NPUlRcclxuXHQgKiBAc29ydHMge0FycmF5fSBzb3J0cyAt5o6S5bqP54q25oCB5pWw57uEXHJcblx0ICpcdHNvcnRzID0gWycrY29sQScsICdjb2xCJywgJy1jb2xDJywgJyFjb2xEJ11cclxuXHQgKiBAcmV0dXJucyB0aGlzO1xyXG5cdCAqL1xyXG5cdHNldFNvcnRTdGF0ZShzb3J0cykge1xyXG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KHNvcnRzKSkge1xyXG5cdFx0XHRzb3J0cyA9IFtzb3J0c107XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5fc29ydFN0YXRlID0geyBrZXlzOiBbXSwgZGlyczogW10gfTtcclxuXHJcblx0XHQvLyDlj43ovazkvJjlhYjnuqfmlrnkvr/lkI7nu63op6blj5Hpobrluo/ml7blkI7op6blj5HnmoTkvJjlhYjnuqfpq5hcclxuXHRcdHNvcnRzLnJldmVyc2UoKS5lYWNoKHNvcnRPYmogPT4ge1xyXG5cdFx0XHRsZXQgb2JqLCBrZXksIGRpciwgY29sO1xyXG5cclxuXHRcdFx0aWYgKHR5cGVvZiBzb3J0T2JqID09PSAnc3RyaW5nJykge1xyXG5cdFx0XHRcdG9iaiA9IHNvcnRPYmoubWF0Y2goLyheWyt8LXwhXT8pKC57MCx9KS8pO1xyXG5cdFx0XHRcdGRpciA9IG9ialsxXSA9PT0gJycgPyAnQVNDJyA6IChvYmogPT09ICctJyA/ICdERVNDJyA6ICdOT19TT1JUJyk7XHJcblx0XHRcdFx0a2V5ID0gb2JqWzJdID8gb2JqWzJdIDogbnVsbDtcclxuXHJcblx0XHRcdFx0Y29sID0gdGhpcy5jb2xzTW9kZWwuZ2V0Q29sdW1uQnlEYXRhSW5kZXgoa2V5KTtcclxuXHRcdFx0XHRpZiAoY29sKSB7XHJcblx0XHRcdFx0XHRjb2wuc29ydChkaXIpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRzZXREYXRhKGRhdGEgPSBbXSwgYXBwZW5kID0gZmFsc2UpIHtcclxuXHRcdGlmICghYXBwZW5kKSB7XHJcblx0XHRcdHRoaXMucm93cy5sZW5ndGggPSAwO1xyXG5cdFx0XHR0aGlzLnJvd01vZGVsLmNsZWFyKCk7XHJcblx0XHR9XHJcblx0XHR2YXIgaW5kZXggPSB0aGlzLnNpemUoKTtcclxuXHRcdGRhdGEuZm9yRWFjaCgocm93LCByaWR4KSA9PiB7XHJcblx0XHRcdGxldCByb3dNID0gbmV3IFJvdyhyaWR4ICsgaW5kZXgsIHJvdyk7XHJcblx0XHRcdHRoaXMucm93cy5wdXNoKHJvd00pO1xyXG5cdFx0XHR0aGlzLnJvd01vZGVsLnNldChyaWR4ICsgaW5kZXgsIHJvd00pO1xyXG5cdFx0fSk7XHJcblx0XHR0aGlzLmZpcmUoJ2RhdGEtY2hhbmdlZCcsIGFwcGVuZCk7XHJcblx0fVxyXG5cclxuXHRmb3JFYWNoKGNhbGxiYWNrLCBjb250ZXh0KSB7XHJcblx0XHR0aGlzLnJvd3MuZm9yRWFjaChmdW5jdGlvbihyb3dNLCByaWR4KSB7XHJcblx0XHRcdGNhbGxiYWNrLmNhbGwodGhpcywgcm93TS5kYXRhLCByaWR4KTtcclxuXHRcdH0sIGNvbnRleHQgfHwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHRzaXplKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMucm93TW9kZWwuc2l6ZTtcclxuXHR9XHJcblxyXG5cdGRlc3RvcnkoKSB7IFxyXG5cclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gR3JpZFN0b3JlOyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCcuLi91dGlsL0V2ZW50RW1pdHRlcicpO1xyXG52YXIgQ29sTW9kZWwgPSByZXF1aXJlKCcuL0NvbE1vZGVsJyk7XHJcbnZhciBHcmlkU3RvcmUgPSByZXF1aXJlKCcuL0dyaWRTdG9yZScpO1xyXG52YXIgQnVmZmVyTm9kZSA9IHJlcXVpcmUoJy4vQnVmZmVyTm9kZScpO1xyXG52YXIgQnVmZmVyWm9uZSA9IHJlcXVpcmUoJy4vQnVmZmVyWm9uZScpO1xyXG52YXIgSGVhZGVyID0gcmVxdWlyZSgnLi9IZWFkZXInKTtcclxudmFyIExvY2tDb2xNYW5hZ2VyID0gcmVxdWlyZSgnLi9Mb2NrQ29sTWFuYWdlcicpO1xyXG52YXIgU2Nyb2xsZXIgPSByZXF1aXJlKCcuL1Njcm9sbGVyJyk7XHJcbnZhciBVdGlscyA9IHJlcXVpcmUoJy4uL3V0aWwvVXRpbHMnKTtcclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZUxheW91dChjb250YWluZXIsIHdpZHRoKSB7XHJcblx0dmFyIHdyYXBwZXIgPSAkKCc8ZGl2Lz4nKS5hZGRDbGFzcygnYy1ncmlkLXdyYXBwZXInKS53aWR0aCh3aWR0aCk7XHJcblx0dmFyIGhlYWRlciA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWdyaWQtaGVhZGVyJyk7XHJcblx0dmFyIGJvZHkgPSAkKCc8ZGl2Lz4nKS5hZGRDbGFzcygnYy1ncmlkLWJvZHknKTtcclxuXHR2YXIgdmlld3BvcnQgPSAkKCc8ZGl2Lz4nKS5hZGRDbGFzcygnYy1ncmlkLXZpZXdwb3J0JykuYXBwZW5kVG8oYm9keSk7XHJcblx0dmFyIGNhbnZhcyA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWdyaWQtY2FudmFzJykuYXBwZW5kVG8odmlld3BvcnQpO1xyXG5cdHdyYXBwZXIuYXBwZW5kKGhlYWRlcikuYXBwZW5kKGJvZHkpLmFwcGVuZFRvKGNvbnRhaW5lcik7XHJcblxyXG5cdHJldHVybiB7IHdyYXBwZXIsIGhlYWRlciwgYm9keSwgdmlld3BvcnQsIGNhbnZhcyB9O1xyXG59XHJcbmZ1bmN0aW9uIGNhbGNSb3dIZWlnaHQoKSB7XHJcblx0dmFyIGxpID0gJCgnPGxpIGNsYXNzPVwiYy1ncmlkLWNlbGxcIj5wbGFjZWhvbGRlcjwvbGk+JykuYXBwZW5kVG8oXCJib2R5XCIpO1xyXG5cdHZhciByb3dIZWlnaHQgPSBsaS5vdXRlckhlaWdodCgpO1xyXG5cdGxpLnJlbW92ZSgpO1xyXG5cclxuXHRyZXR1cm4gcm93SGVpZ2h0O1xyXG59XHJcblxyXG5jbGFzcyBHcmlkQ29tcG9uZW50IGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHRjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcblx0XHRzdXBlcigpO1xyXG5cclxuXHRcdGlmICghJChvcHRpb25zLmRvbUVsKS5zaXplKCkpIHsgdGhyb3cgJ3JlcXVpcmUgYSB2YWxpZCBkb21FbCc7IH1cclxuXHJcblx0XHR0aGlzLnNob3VsZEFkZE5vZGVzID0gdHJ1ZTtcclxuXHRcdHRoaXMuaGVpZ2h0ID0gK29wdGlvbnMuaGVpZ2h0IHx8IDUwMDtcclxuXHRcdHRoaXMud2lkdGggPSBvcHRpb25zLndpZHRoO1xyXG5cclxuXHRcdC8vICRsYXlvdXQgZG9tXHJcblx0XHRPYmplY3QuYXNzaWduKHRoaXMuJGRvbSA9IHt9LCBjcmVhdGVMYXlvdXQoJChvcHRpb25zLmRvbUVsKSwgdGhpcy53aWR0aCkpO1xyXG5cclxuXHRcdHRoaXMuY29sdW1uTW9kZWwgPSBuZXcgQ29sTW9kZWwob3B0aW9ucy5jb2x1bW5zKTtcclxuXHRcdHRoaXMuc3RvcmUgPSBuZXcgR3JpZFN0b3JlKHsgY29sdW1uTW9kZWw6IHRoaXMuY29sdW1uTW9kZWwsICdkYXRhJzogb3B0aW9ucy5kYXRhIHx8IFtdIH0pO1xyXG5cdFx0dGhpcy5faW5pdCgpO1xyXG5cdFx0dGhpcy5fYmluZEV2ZW50KCk7XHJcblx0fVxyXG5cclxuXHRfaW5pdCgpIHtcclxuXHRcdHRoaXMuaGVhZGVyID0gbmV3IEhlYWRlcih0aGlzLiRkb20uaGVhZGVyLCB0aGlzLmNvbHVtbk1vZGVsLCB0aGlzLnN0b3JlKTtcclxuXHRcdHZhciB0b3RhbCA9IHRoaXMuc3RvcmUuc2l6ZSgpO1xyXG5cdFx0dmFyIHJvd0hlaWdodCA9IHRoaXMucm93SGVpZ2h0ID0gY2FsY1Jvd0hlaWdodCgpO1xyXG5cdFx0dmFyIHZpZXdwb3J0SGVpZ2h0ID0gdGhpcy5oZWlnaHQgLSB0aGlzLiRkb20uaGVhZGVyLm91dGVySGVpZ2h0KCk7XHJcblx0XHR2YXIgc2luZ2xlUGFnZVNpemUgPSBNYXRoLm1pbihNYXRoLmNlaWwodmlld3BvcnRIZWlnaHQvIHJvd0hlaWdodCkgLSAxLCB0b3RhbCAtIDEpO1xyXG5cclxuXHRcdHRoaXMuYnVmZmVyWm9uZSA9IG5ldyBCdWZmZXJab25lKHNpbmdsZVBhZ2VTaXplLCB0b3RhbCk7XHJcblx0XHR0aGlzLmJ1ZmZlck5vZGUgPSBuZXcgQnVmZmVyTm9kZShzaW5nbGVQYWdlU2l6ZSwgdGhpcy5jb2x1bW5Nb2RlbCwgdG90YWwpO1xyXG5cdFx0dGhpcy5zY3JvbGxlciA9IG5ldyBTY3JvbGxlcihyb3dIZWlnaHQsIHRoaXMuYnVmZmVyWm9uZSk7XHJcblx0XHR0aGlzLnNjcm9sbGVyXHJcblx0XHRcdC5vblgoeCA9PiB7XHJcblx0XHRcdFx0dGhpcy5maXJlKCdzY3JvbGxMZWZ0JywgeCk7XHJcblx0XHRcdFx0dGhpcy4kZG9tLmhlYWRlci5zY3JvbGxMZWZ0KHgpO1xyXG5cdFx0XHR9KVxyXG5cdFx0XHQub25ZKChkaXIsIGRvbWFpbiwgc3RhcnQsIGVuZCwgaW5kZXgsIHRvdGFsKSA9PiB7XHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coYOa7muWKqOaWueWQke+8miR7ZGlyfSwg5Yqg6L295Yy66Ze0OiBbJHtkb21haW59XSwg546w5pyJ6IyD5Zu077yaKCR7c3RhcnR9IC0gJHtlbmR9KSwgYClcclxuXHRcdFx0XHR0aGlzLl9idWZmZXJSZW5kZXIoZGlyLCBkb21haW4pO1xyXG5cdFx0XHR9LCA2MCk7XHJcblxyXG5cdFx0dGhpcy4kZG9tLnZpZXdwb3J0LmhlaWdodCh2aWV3cG9ydEhlaWdodCk7XHJcblx0XHR0aGlzLiRkb20udmlld3BvcnQub24oJ3Njcm9sbCcsIChldnQpID0+IHtcclxuXHRcdFx0dGhpcy5zY3JvbGxlci5maXJlWShldnQudGFyZ2V0LnNjcm9sbFRvcCk7XHJcblx0XHRcdHRoaXMuc2Nyb2xsZXIuZmlyZVgoZXZ0LnRhcmdldC5zY3JvbGxMZWZ0KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMubG9ja0NvbE1hbmFnZXIgPSBMb2NrQ29sTWFuYWdlcih0aGlzLmNvbHVtbk1vZGVsLCB0aGlzLmhlYWRlciwgdGhpcy4kZG9tLCB0aGlzLmJ1ZmZlck5vZGUpO1xyXG5cdFx0dGhpcy5fc2V0Q2FudmFzV0godG90YWwpO1xyXG5cdH1cclxuXHJcblx0X3NldENhbnZhc1dIKHRvdGFsKSB7XHJcblx0XHR0aGlzLiRkb20uY2FudmFzXHJcblx0XHRcdC53aWR0aCh0b3RhbCA/ICdhdXRvJyA6IHRoaXMuX3VuTG9ja1Zpc2libGVDb2xzV2lkdGgoKSlcclxuXHRcdFx0LmhlaWdodCh0aGlzLnJvd0hlaWdodCAqIHRvdGFsIHx8IDEpO1xyXG5cdH1cclxuXHJcblx0X3VuTG9ja1Zpc2libGVDb2xzV2lkdGgoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5oZWFkZXIuZ2V0VmlzaWJsZUNvbHNXaWR0aCgpICsgdGhpcy5sb2NrQ29sTWFuYWdlci52aXNpYmxlTG9ja0NvbHVtbi5nZXRXaWR0aCgpO1xyXG5cdH1cclxuXHJcblx0c2Nyb2xsVG9Ub3AocG9zaXRpb24pIHtcclxuXHRcdHRoaXMuJGRvbS52aWV3cG9ydC5zY3JvbGxUb3AocG9zaXRpb24pO1xyXG5cdH1cclxuXHJcblx0X2JpbmRFdmVudCgpIHtcclxuXHRcdHRoaXMub24oJ3ZpZXdwb3J0LWhlaWdodC1jaGFuZ2VkJywgdmlld3BvcnRIZWlnaHQgPT4ge1xyXG5cdFx0XHR0aGlzLl91cGRhdGVCdWZmZXIoKTtcclxuXHRcdFx0dGhpcy5yZW5kZXIoKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMub24oJ3Njcm9sbExlZnQnLCB4ID0+IHtcclxuXHRcdFx0Ly8gcGVyZm9ybWFuY2UgVE9ET1xyXG5cdFx0XHQvLyBsZXQgbG9ja0NvbHVtbldpZHRoID0gdGhpcy5oZWFkZXIuZ2V0VmlzaWJsZUxvY2tDb2xzV2lkdGgoKTtcclxuXHRcdFx0Ly8gdGhpcy4kZG9tLmNhbnZhcy5maW5kKCcuYy1jb2x1bW4tbG9ja2VkJykuY3NzKCdsZWZ0JywgeCAtIGxvY2tDb2x1bW5XaWR0aCk7XHJcblx0XHRcdC8vIHRoaXMuJGRvbS5oZWFkZXIuZmluZCgnLmMtY29sdW1uLWxvY2tlZCcpLmNzcygnbGVmdCcsIHggLSBsb2NrQ29sdW1uV2lkdGgpO1xyXG5cdFx0XHR0aGlzLmxvY2tDb2xNYW5hZ2VyLnNldExvY2tDb2x1bW5YKHgpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5zdG9yZS5vbignZGF0YS1jaGFuZ2VkJywgKGFwcGVuZCkgPT4ge1xyXG5cdFx0XHRsZXQgdG90YWwgPSB0aGlzLnN0b3JlLnNpemUoKTtcclxuXHRcdFx0dGhpcy5fc2V0Q2FudmFzV0godG90YWwpO1xyXG5cdFx0XHR0aGlzLmJ1ZmZlck5vZGUuc2V0VG90YWwodG90YWwpO1xyXG5cdFx0XHR0aGlzLmJ1ZmZlclpvbmUuc2V0VG90YWwodG90YWwpO1xyXG5cclxuXHRcdFx0aWYgKCFhcHBlbmQgfHwgKHRvdGFsIC0gMSkgKiB0aGlzLnJvd0hlaWdodCA8IDIqdGhpcy4kZG9tLnZpZXdwb3J0Lm91dGVySGVpZ2h0KCkpIHtcclxuXHRcdFx0XHR0aGlzLl91cGRhdGVCdWZmZXIoKTtcclxuXHRcdFx0XHR0aGlzLnJlbmRlcigpO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHJcblx0fVxyXG5cclxuXHRfdXBkYXRlQnVmZmVyKCkge1xyXG5cdFx0dmFyIGxpbWl0ID0gTWF0aC5taW4oXHJcblx0XHRcdE1hdGguY2VpbCh0aGlzLiRkb20udmlld3BvcnQub3V0ZXJIZWlnaHQoKSAvIHRoaXMucm93SGVpZ2h0KSAtIDEsXHJcblx0XHRcdHRoaXMuc3RvcmUuc2l6ZSgpIC0gMSk7XHJcblxyXG5cdFx0dGhpcy5idWZmZXJab25lLnNldExpbWl0KGxpbWl0KTtcclxuXHRcdHRoaXMuYnVmZmVyTm9kZS5zZXRMaW1pdChsaW1pdCk7XHJcblx0XHR0aGlzLnNob3VsZEFkZE5vZGVzID0gdHJ1ZTtcclxuXHRcdHRoaXMuc2Nyb2xsVG9Ub3AoMCk7XHJcblxyXG5cdFx0dGhpcy4kZG9tLmNhbnZhcy5lbXB0eSgpO1xyXG5cdH1cclxuXHJcblx0X2J1ZmZlclJlbmRlcihkaXIsIFtzdGFydCwgZW5kXSkge1xyXG5cdFx0dmFyIG5vZGVzID0gdGhpcy5idWZmZXJOb2RlLmdldChkaXIsIFtzdGFydCwgZW5kXSk7XHJcblx0XHRjb25zb2xlLmxvZygn5LiA5qyh6I635Y+W6IqC54K56ZW/5bqmJywgbm9kZXMubGVuZ3RoLCBzdGFydCwgZW5kKTtcclxuXHJcblx0XHRpZiAoIXRoaXMuc2hvdWxkQWRkTm9kZXMpIHtcclxuXHRcdFx0dGhpcy5zdG9yZS5zbGljZShzdGFydCwgZW5kICsgMSkuZm9yRWFjaCgocm93TSwgaSkgPT4ge1xyXG5cdFx0XHRcdG5vZGVzW2ldLnNldERhdGEocm93TSwgcm93TS5yaWQgKiB0aGlzLnJvd0hlaWdodCk7XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0dmFyICRkb2NGcmFtZSA9ICQoJzxkaXYvPicpO1xyXG5cdFx0dGhpcy5zdG9yZS5zbGljZShzdGFydCwgZW5kICsgMSkuZm9yRWFjaCgocm93TSwgaSkgPT4ge1xyXG5cclxuXHRcdFx0bGV0IG5vZGUgPSBub2Rlc1tpXS5zZXREYXRhKHJvd00sIHJvd00ucmlkICogdGhpcy5yb3dIZWlnaHQpO1xyXG5cdFx0XHQkZG9jRnJhbWUuYXBwZW5kKG5vZGUpO1xyXG5cdFx0XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLiRkb20uY2FudmFzLmFwcGVuZCgkZG9jRnJhbWUuY2hpbGRyZW4oKSk7XHJcblx0XHR0aGlzLmxvY2tDb2xNYW5hZ2VyLmFkZEJ1ZmZlckxvY2tOb2RlKG5vZGVzKTtcclxuXHJcblx0XHRpZiAodGhpcy5idWZmZXJOb2RlLmlzRW5vdWdoKCkpIHtcclxuXHRcdFx0dGhpcy5zaG91bGRBZGROb2RlcyA9IGZhbHNlO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmVuZGVyKCkge1xyXG5cdFx0dGhpcy5fYnVmZmVyUmVuZGVyKDEsIHRoaXMuYnVmZmVyWm9uZS5kb21haW4pO1xyXG5cdH1cclxuXHJcblx0c2V0V2lkdGgobnVtKSB7XHJcblx0XHRpZiAoaXNOYU4obnVtKSkgcmV0dXJuO1xyXG5cclxuXHRcdHRoaXMuJGRvbS53cmFwcGVyLndpZHRoKG51bSk7XHJcblx0fVxyXG5cclxuXHRzZXRIZWlnaHQobnVtKSB7XHJcblx0XHRpZiAoaXNOYU4obnVtKSkgcmV0dXJuO1xyXG5cclxuXHRcdHZhciB2aWV3cG9ydEhlaWdodCA9IG51bSAtIHRoaXMuJGRvbS5oZWFkZXIub3V0ZXJIZWlnaHQoKTtcclxuXHRcdHRoaXMuJGRvbS52aWV3cG9ydC5vdXRlckhlaWdodCh2aWV3cG9ydEhlaWdodCk7XHJcblx0XHR0aGlzLmZpcmUoJ3ZpZXdwb3J0LWhlaWdodC1jaGFuZ2VkJywgdmlld3BvcnRIZWlnaHQpO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHtcclxuXHRcdHRoaXMuY29sdW1uTW9kZWwuZGVzdG9yeSgpO1xyXG5cdFx0dGhpcy5zdG9yZS5kZXN0b3J5KCk7XHJcblx0XHR0aGlzLmhlYWRlci5kZXN0b3J5KCk7XHJcblx0XHR0aGlzLiRkb20ud3JhcHBlci5yZW1vdmUoKTtcclxuXHR9XHJcbn1cclxubW9kdWxlLmV4cG9ydHMgPSBHcmlkQ29tcG9uZW50OyIsImNvbnN0ICQgPSByZXF1aXJlKCcuLi91dGlsL3NoaW0nKS4kO1xyXG5jb25zdCBERCA9IHJlcXVpcmUoJy4uL3V0aWwvREQnKTtcclxuXHJcbmNvbnN0IFNPUlRfQ0xTX0FTQyA9ICdjLWNvbHVtbi1hc2MnO1xyXG5jb25zdCBTT1JUX0NMU19ERVNDID0gJ2MtY29sdW1uLWRlc2MnO1xyXG5jb25zdCBORUVETEVTU19XSURUSCA9IDEwMDA7XHJcblxyXG52YXIgY3JlYXRlQ29sdW1uRWxlbWVudCA9IGZ1bmN0aW9uKGNvbE0pIHtcclxuXHR2YXIgbG9ja0NsYXNzID0gY29sTS5sb2NrZWQgPyAnIGMtY29sdW1uLWxvY2tlZCcgOiAnJztcclxuXHJcblx0cmV0dXJuICQoJzxsaS8+JylcclxuXHRcdC5hZGRDbGFzcygnYy1oZWFkZXItY2VsbCcgKyBsb2NrQ2xhc3MpXHJcblx0XHQuYWRkQ2xhc3MoJ2MtYWxpZ24tJyArIGNvbE0uYWxpZ24pXHJcblx0XHQud2lkdGgoY29sTS53aWR0aClcclxuXHRcdC5vbignY2xpY2snLCAoKSA9PiB7IGNvbE0uc29ydCgpOyB9KVxyXG5cdFx0LmRhdGEoJ2NvbHVtbicsIGNvbE0pXHJcblx0XHQuaHRtbChjb2xNLnRleHQpO1xyXG59O1xyXG5cclxuXHJcbmNsYXNzIEhlYWRlciB7XHJcblx0Y29uc3RydWN0b3IoJGhlYWRlciwgY29sc01vZGVsLCBzdG9yZSkge1xyXG5cclxuXHRcdHRoaXMuJGhlYWRlciA9ICRoZWFkZXI7XHJcblx0XHR0aGlzLmNvbHNNb2RlbCA9IGNvbHNNb2RlbDtcclxuXHRcdHRoaXMuc3RvcmUgPSBzdG9yZTtcclxuXHRcdHRoaXMuY29sRWxlbWVudHMgPSBuZXcgTWFwKCk7XHJcblxyXG5cdFx0dGhpcy5fY3JlYXRlQ29sdW1uRWxlbWVudHMoKTtcclxuXHRcdHRoaXMuX2JpbmRFdmVudCgpO1xyXG5cclxuXHRcdHRoaXMucmVuZGVyKCk7XHJcblx0fVxyXG5cclxuXHRfY3JlYXRlQ29sdW1uRWxlbWVudHMoKSB7XHJcblx0XHR2YXIgd2lkdGggPSBORUVETEVTU19XSURUSDtcclxuXHJcblx0XHR0aGlzLiRyb3cgPSAkKCc8dWwvPicpLmFkZENsYXNzKCdjLWhlYWRlci1yb3cnKTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRsZXQgY29sRWxlbWVudCA9IGNyZWF0ZUNvbHVtbkVsZW1lbnQoY29sTSk7XHJcblxyXG5cdFx0XHR0aGlzLmNvbEVsZW1lbnRzLnNldChjb2xNLCBjb2xFbGVtZW50KTtcclxuXHRcdFx0dGhpcy4kcm93LmFwcGVuZChjb2xFbGVtZW50KTtcclxuXHJcblx0XHRcdHdpZHRoICs9IGNvbE0ud2lkdGg7XHJcblxyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy4kcm93LndpZHRoKHdpZHRoKTtcclxuXHR9XHJcblxyXG5cdGdldFZpc2libGVDb2xzV2lkdGgoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy4kcm93LndpZHRoKCkgLSBORUVETEVTU19XSURUSDtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHR0aGlzLl9jb2x1bW5SZXNpemUoKTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5vbignY29sdW1uLWFkZCcsIGNvbE0gPT4ge1xyXG5cdFx0XHRsZXQgY29sRWxlbWVudCA9IGNyZWF0ZUNvbHVtbkVsZW1lbnQoY29sTSk7XHJcblxyXG5cdFx0XHR0aGlzLmNvbEVsZW1lbnRzLnNldChjb2xNLCBjb2xFbGVtZW50KTtcclxuXHRcdFx0dGhpcy4kcm93LmFwcGVuZChjb2xFbGVtZW50KTtcclxuXHJcblx0XHRcdGxldCByb3dXID0gdGhpcy4kcm93LndpZHRoKCk7XHJcblx0XHRcdHRoaXMuJHJvdy53aWR0aChyb3dXICsgY29sTS53aWR0aCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLXJlc2l6ZWQnLCB3aWR0aCA9PiB0aGlzLmNvbEVsZW1lbnRzLmdldChjb2xNKS5vdXRlcldpZHRoKHdpZHRoKSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4taGlkZGVuJywgaXNIaWRkZW4gPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHRcdFx0XHRpZiAoaXNIaWRkZW4pIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcygnYy1jb2x1bW4taGlkZScpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoJ2MtY29sdW1uLWhpZGUnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWxvY2tlZCcsIGlzTG9ja2VkID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdGlmIChpc0xvY2tlZCkge1xyXG5cdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKCdjLWNvbHVtbi1sb2NrZWQnKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKCdjLWNvbHVtbi1sb2NrZWQnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLXNvcnQtY2hhbmdlZCcsIHNvcnRTdGF0ZSA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0XHRjb25zb2xlLmxvZyhzb3J0U3RhdGUpO1xyXG5cdFx0XHRcdGlmIChzb3J0U3RhdGUpIHtcclxuXHRcdFx0XHRcdGlmIChzb3J0U3RhdGUgPT09ICdBU0MnKSB7XHJcblx0XHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcyhTT1JUX0NMU19BU0MpO1xyXG5cdFx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoU09SVF9DTFNfREVTQyk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRjb2xFbGUuYWRkQ2xhc3MoU09SVF9DTFNfREVTQyk7XHJcblx0XHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcyhTT1JUX0NMU19BU0MpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoU09SVF9DTFNfQVNDKS5yZW1vdmVDbGFzcyhTT1JUX0NMU19ERVNDKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignZGVzdG9yeScsICgpID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblx0XHRcdFx0dGhpcy5jb2xFbGVtZW50cy5kZWxldGUoY29sTSk7XHRcdFx0XHJcblx0XHRcdFx0Y29sRWxlLnJlbW92ZSgpO1xyXG5cclxuXHRcdFx0XHRsZXQgcm93VyA9IHRoaXMuJHJvdy53aWR0aCgpO1xyXG5cdFx0XHRcdHRoaXMuJHJvdy53aWR0aChyb3dXIC0gY29sTS53aWR0aCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRfY29sdW1uUmVzaXplKCkge1xyXG5cdFx0dGhpcy4kcm93Lm9uKCdtb3VzZW1vdmUnLCAnbGkuYy1oZWFkZXItY2VsbCcsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHR2YXIgb2Zmc2V0WCA9IGV2dC5vZmZzZXRYO1xyXG5cdFx0XHRpZiAodGhpcy5vZmZzZXRXaWR0aCAtIG9mZnNldFggPD0gNSB8fCBvZmZzZXRYIDw9IDUpIHtcclxuXHRcdFx0XHQkKHRoaXMpLmFkZENsYXNzKCdjLWNvbC1yZXNpemFibGUnKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHQkKHRoaXMpLnJlbW92ZUNsYXNzKCdjLWNvbC1yZXNpemFibGUnKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblxyXG5cclxuXHRcdHZhciBzdGFydFggPSAwO1xyXG5cclxuXHRcdEREKHRoaXMuJHJvdy5maW5kKCdsaS5jLWhlYWRlci1jZWxsJyksIHtcclxuXHRcdFx0J3Jlc3RyaWN0ZXInOiBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHR2YXIgb2Zmc2V0WCA9IGV2dC5vZmZzZXRYO1xyXG5cdFx0XHRcdGlmIChldnQudGFyZ2V0Lm9mZnNlc3RXaWR0aCAtIG9mZnNldFggPD0gNSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuICQoZXZ0LnRhcmdldCk7XHJcblx0XHRcdFx0fSBlbHNlIGlmIChvZmZzZXRYIDw9IDUpIHtcclxuXHRcdFx0XHRcdHJldHVybiAkKGV2dC50YXJnZXQpLnByZXYoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0sXHJcblx0XHRcdCdvbkRyYWdTdGFydCc6IGZ1bmN0aW9uKG9mZnNldCwgJHRhcmdldCkge1xyXG5cdFx0XHRcdHZhciBzY3JvbGxMZWZ0ID0gZG9jdW1lbnQuYm9keS5zY3JvbGxMZWZ0IHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0O1xyXG5cdFx0XHRcdGNvbnNvbGUubG9nKCR0YXJnZXQub2Zmc2V0KCkubGVmdCwgJHRhcmdldC50ZXh0KCkpO1xyXG5cdFx0XHRcdHN0YXJ0WCA9ICR0YXJnZXQub2Zmc2V0KCkubGVmdCAtIHNjcm9sbExlZnQ7XHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2cob2Zmc2V0LngsICR0YXJnZXQudGV4dCgpKTtcclxuXHJcblx0XHRcdFx0Ly8gc3RhcnRYID0gb2Zmc2V0Lng7XHJcblx0XHRcdH0sXHJcblx0XHRcdCdvbkRyYWdnaW5nJzogZnVuY3Rpb24ob2Zmc2V0LCAkdGFyZ2V0KSB7XHJcblxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnb25EcmFnRW5kJzogZnVuY3Rpb24ob2Zmc2V0LCAkdGFyZ2V0KSB7XHJcblx0XHRcdFx0dmFyIHdpZHRoID0gb2Zmc2V0LnggLSBzdGFydFg7XHJcblx0XHRcdFx0Y29uc29sZS5sb2coYCR7JHRhcmdldC50ZXh0KCl9XHJcblx0XHRcdFx0XHTljp/lrr3luqbkuLokeyR0YXJnZXQuZGF0YSgnY29sdW1uJykud2lkdGh9LFxyXG5cdFx0XHRcdFx05pS55Y+Y5Li677yaJHt3aWR0aH0sIFske29mZnNldC54fSAtICR7c3RhcnRYfV1gKTtcclxuXHRcdFx0XHQkdGFyZ2V0LmRhdGEoJ2NvbHVtbicpLnNldFdpZHRoKHdpZHRoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRyZW5kZXIoKSB7XHJcblx0XHR0aGlzLiRoZWFkZXIuYXBwZW5kKHRoaXMuJHJvdyk7XHJcblx0fVxyXG5cclxuXHRkZXN0b3J5KCkge1xyXG5cclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gSGVhZGVyOyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbmNsYXNzIExvY2tDb2x1bW4ge1xyXG5cdGNvbnN0cnVjdG9yKCkge1xyXG5cdFx0dGhpcy5fZGF0YSA9IFtdO1xyXG5cdFx0dGhpcy5fY29sdW1uc1dpZHRoID0gMDtcclxuXHR9XHJcblxyXG5cdGFkZChjb2xNKSB7XHJcblx0XHR0aGlzLl9kYXRhLnVuc2hpZnQoY29sTSk7XHJcblx0XHR0aGlzLnJlQ2FsYygpO1xyXG5cdH1cclxuXHJcblx0cmVtb3ZlKGRlbENvbE0pIHtcclxuXHRcdHRoaXMuX2RhdGEgPSB0aGlzLl9kYXRhLmZpbHRlcihjb2xNID0+IGNvbE0gIT09IGRlbENvbE0pO1xyXG5cdFx0dGhpcy5yZUNhbGMoKTtcclxuXHR9XHJcblxyXG5cdGNsZWFyKCkge1xyXG5cdFx0dGhpcy5fZGF0YS5sZW5ndGggPSAwO1xyXG5cdFx0dGhpcy5yZUNhbGMoKTtcclxuXHR9XHJcblxyXG5cdGdldFdpZHRoKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuX2NvbHVtbnNXaWR0aDtcclxuXHR9XHJcblxyXG5cdHJlQ2FsYygpIHtcclxuXHRcdHRoaXMuX2NvbHVtbnNXaWR0aCA9IHRoaXMuX2RhdGEucmVkdWNlKCh3aWR0aCwgY29sTSkgPT4ge1xyXG5cdFx0XHR3aWR0aCAtPSBjb2xNLndpZHRoO1xyXG5cdFx0XHRjb2xNLmF3YXlGcm9tTGVmdCA9IHdpZHRoO1xyXG5cdFx0XHRyZXR1cm4gd2lkdGg7XHJcblx0XHR9LCAwKTtcclxuXHR9XHJcblxyXG5cdGVhY2goZm4pIHtcclxuXHRcdHRoaXMuX2RhdGEuZm9yRWFjaChmbik7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiDlvZPlhbbkuK3kuIDliJflj5HnlJ/lj5jljJbvvIzpgJrnn6XlhbblroPliJfnm7jlupTlj5jljJZcclxuXHQgKi9cclxuXHQgcHVibGlzaChjaGFuZ2VkQ29sTSwgc2Nyb2xsTGVmdCkge1xyXG5cdCBcdHRoaXMuX2RhdGEuZm9yRWFjaChjb2xNID0+IHtcclxuXHQgXHRcdGlmIChjb2xNICE9PSBjaGFuZ2VkQ29sTSkge1xyXG5cdCBcdFx0XHRjb2xNLmZpcmUoJ3Njcm9sbC14Jywgc2Nyb2xsTGVmdCk7XHJcblx0IFx0XHR9XHJcblx0IFx0fSk7XHJcblx0IH1cclxufVxyXG5cclxudmFyIExvY2tDb2xNYW5hZ2VyID0gZnVuY3Rpb24oY29sc01vZGVsLCBoZWFkZXIsICRkb20sIGJ1ZmZlck5vZGUpIHtcclxuXHRsZXQgdmlzaWJsZUxvY2tDb2x1bW4gPSBuZXcgTG9ja0NvbHVtbigpO1xyXG5cclxuXHRpbml0KCk7XHJcblx0aW5pdEV2ZW50KCk7XHJcblxyXG5cdGZ1bmN0aW9uIGluaXQoKSB7XHJcblx0XHRjb2xzTW9kZWxcclxuXHRcdFx0LmdldExvY2tDb2x1bW4oKVxyXG5cdFx0XHQuZmlsdGVyKGNvbE0gPT4gIWNvbE0uaGlkZGVuKVxyXG5cdFx0XHQuZm9yRWFjaChjb2xNID0+IHZpc2libGVMb2NrQ29sdW1uLmFkZChjb2xNKSk7XHJcblxyXG5cdFx0dXBkYXRlQm94U2l6ZSgpO1xyXG5cclxuXHRcdHZpc2libGVMb2NrQ29sdW1uLmVhY2goY29sTSA9PiB7XHJcblx0XHRcdGxldCBoZWFkZXJFbGVtZW50ID0gaGVhZGVyLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHRcdFx0Ly8g6K6+572u5bm26K6w5b2V5Yid5aeL55qE5bem5L6n5L2NXHJcblx0XHRcdGhlYWRlckVsZW1lbnQuY3NzKCdsZWZ0JywgY29sTS5hd2F5RnJvbUxlZnQpO1xyXG5cclxuXHRcdFx0Y29sTS5vbignc2Nyb2xsLXgnLCB4ID0+IHtcclxuXHRcdFx0XHRsZXQgbGVmdFN0eWxlID0geyAnbGVmdCc6IHggKyBjb2xNLmF3YXlGcm9tTGVmdCB9O1xyXG5cclxuXHRcdFx0XHRoZWFkZXJFbGVtZW50LmNzcyhsZWZ0U3R5bGUpO1xyXG5cdFx0XHRcdGJ1ZmZlck5vZGUuZ2V0Tm9kZUxpc3QoKS5mb3JFYWNoKG5vZGUgPT4gbm9kZS5jaGlsZHJlbi5nZXQoY29sTSkuY3NzKGxlZnRTdHlsZSkpO1x0XHRcdFx0XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpbml0RXZlbnQoKSB7XHJcblxyXG5cdFx0Y29uc3QgY29sdW1uTG9ja09yVW5Mb2NrID0gKGlzTG9ja2VkLCBjb2xNKSA9PiB7XHJcblx0XHRcdGxldCBoZWFkZXJFbGVtZW50ID0gaGVhZGVyLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHJcblx0XHRcdGlmIChpc0xvY2tlZCkge1xyXG5cdFx0XHRcdHZpc2libGVMb2NrQ29sdW1uLmFkZChjb2xNKTtcclxuXHJcblx0XHRcdFx0Y29sTS5vbignc2Nyb2xsLXgnLCB4ID0+IHtcclxuXHRcdFx0XHRcdGxldCBsZWZ0U3R5bGUgPSB7ICdsZWZ0JzogeCArIGNvbE0uYXdheUZyb21MZWZ0IH07XHJcblxyXG5cdFx0XHRcdFx0aGVhZGVyRWxlbWVudC5jc3MobGVmdFN0eWxlKTtcclxuXHRcdFx0XHRcdGJ1ZmZlck5vZGUuZ2V0Tm9kZUxpc3QoKS5mb3JFYWNoKG5vZGUgPT4gbm9kZS5jaGlsZHJlbi5nZXQoY29sTSkuY3NzKGxlZnRTdHlsZSkpO1xyXG5cdFx0XHRcdH0pO1xyXG5cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5yZW1vdmUoY29sTSk7XHJcblxyXG5cdFx0XHRcdGNvbE0ub2ZmKCdzY3JvbGwteCcpO1xyXG5cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bGV0IGN1cnJlbnRMZWZ0ID0gJGRvbS52aWV3cG9ydC5zY3JvbGxMZWZ0KCkgKyBjb2xNLmF3YXlGcm9tTGVmdDtcclxuXHJcblx0XHRcdC8vIOiuvue9ruW5tuiusOW9leWIneWni+eahOW3puS+p+S9jVxyXG5cdFx0XHRoZWFkZXJFbGVtZW50LmNzcygnbGVmdCcsIGN1cnJlbnRMZWZ0KTtcclxuXHRcdFx0YnVmZmVyTm9kZS5nZXROb2RlTGlzdCgpLmZvckVhY2gobm9kZSA9PiBub2RlLmNoaWxkcmVuLmdldChjb2xNKS5jc3MoJ2xlZnQnLCBjdXJyZW50TGVmdCkpO1xyXG5cclxuXHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4ucHVibGlzaChjb2xNLCAkZG9tLnZpZXdwb3J0LnNjcm9sbExlZnQoKSk7XHJcblx0XHRcdHVwZGF0ZUJveFNpemUoKTtcclxuXHRcdH07XHJcblxyXG5cdFx0Y29sc01vZGVsLm9uKCdjb2x1bW4tYWRkJywgY29sTSA9PiB7XHJcblx0XHRcdC8vIEJVR0ZJWCBUT0RPXHJcblxyXG5cdFx0XHQvLyAuLi5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWxvY2tlZCcsIGlzTG9ja2VkID0+IHtcclxuXHRcdFx0XHRjb2x1bW5Mb2NrT3JVbkxvY2soaXNMb2NrZWQsIGNvbE0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdGNvbHNNb2RlbC5nZXRDb2x1bW4oKS5mb3JFYWNoKGNvbE0gPT4ge1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLXJlc2l6ZWQnLCB3aWR0aCA9PiB7XHJcblxyXG5cdFx0XHRcdGlmIChjb2xNLmxvY2tlZCkge1xyXG5cdFx0XHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4ucmVDYWxjKCk7XHJcblx0XHRcdFx0XHRsZXQgaGVhZGVyRWxlbWVudCA9IGhlYWRlci5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdFx0bGV0IGN1cnJlbnRMZWZ0ID0gJGRvbS52aWV3cG9ydC5zY3JvbGxMZWZ0KCkgKyBjb2xNLmF3YXlGcm9tTGVmdDtcclxuXHJcblx0XHRcdFx0XHRoZWFkZXJFbGVtZW50LmNzcygnbGVmdCcsIGN1cnJlbnRMZWZ0KTtcclxuXHRcdFx0XHRcdGJ1ZmZlck5vZGUuZ2V0Tm9kZUxpc3QoKS5mb3JFYWNoKG5vZGUgPT4gbm9kZS5jaGlsZHJlbi5nZXQoY29sTSkuY3NzKCdsZWZ0JywgY3VycmVudExlZnQpKTtcclxuXHJcblx0XHRcdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5wdWJsaXNoKGNvbE0sICRkb20udmlld3BvcnQuc2Nyb2xsTGVmdCgpKTtcclxuXHRcdFx0XHRcdHVwZGF0ZUJveFNpemUoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFxyXG5cdFx0XHR9KTtcclxuXHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tbG9ja2VkJywgaXNMb2NrZWQgPT4ge1xyXG5cdFx0XHRcdC8vIC4uLlxyXG5cdFx0XHRcdGNvbHVtbkxvY2tPclVuTG9jayhpc0xvY2tlZCwgY29sTSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0XHRcclxuXHRcdGJ1ZmZlck5vZGUub24oJ2J1ZmZlci1pbml0aWFsJywgKCkgPT4ge1xyXG5cdFx0XHQvLyBjbGVhckJ1ZmZlckxvY2tOb2RlKCk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHVwZGF0ZUJveFNpemUoKSB7XHJcblx0XHR2YXIgdmlzaWJsZUxvY2tDb2xzV2lkdGggPSB2aXNpYmxlTG9ja0NvbHVtbi5nZXRXaWR0aCgpO1xyXG5cdFx0aGVhZGVyLiRoZWFkZXIuY3NzKCdwYWRkaW5nLWxlZnQnLCAtdmlzaWJsZUxvY2tDb2xzV2lkdGgpO1xyXG5cdFx0JGRvbS5jYW52YXMuY3NzKCdtYXJnaW4tbGVmdCcsIC12aXNpYmxlTG9ja0NvbHNXaWR0aCk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4ge1xyXG5cdFx0dmlzaWJsZUxvY2tDb2x1bW4sXHJcblx0XHRzZXRMb2NrQ29sdW1uWChzY3JvbGxMZWZ0KSB7XHJcblx0XHRcdHZpc2libGVMb2NrQ29sdW1uLmVhY2goY29sTSA9PiBjb2xNLmZpcmUoJ3Njcm9sbC14Jywgc2Nyb2xsTGVmdCkpO1xyXG5cdFx0fSxcclxuXHJcblx0XHRhZGRCdWZmZXJMb2NrTm9kZShyb3dOb2Rlcykge1xyXG5cdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRcdHJvd05vZGVzLmZvckVhY2gocm93Tm9kZXMgPT4ge1xyXG5cdFx0XHRcdFx0bGV0IGNvbEVsZSA9IGhlYWRlci5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblx0XHRcdFx0XHRsZXQgY2VsbEVsZW1lbnQgPSByb3dOb2Rlcy5jaGlsZHJlbi5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdFx0Y2VsbEVsZW1lbnQuY3NzKCdsZWZ0JywgJGRvbS52aWV3cG9ydC5zY3JvbGxMZWZ0KCkgKyBjb2xNLmF3YXlGcm9tTGVmdCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSxcclxuXHJcblx0XHRjbGVhckJ1ZmZlckxvY2tOb2RlKCkge1xyXG5cdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5jbGVhcigpO1xyXG5cdFx0fVxyXG5cclxuXHR9O1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBMb2NrQ29sTWFuYWdlcjsiLCJ2YXIgdGhyb3R0bGUgPSBmdW5jdGlvbihmbiwgdGltZSkge1xyXG5cdHZhciB0aW1lciA9IG51bGw7XHJcblx0cmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcclxuXHRcdGlmICh0aW1lcikgY2xlYXJUaW1lb3V0KHRpbWVyKTtcclxuXHJcblx0XHR0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG5cdFx0XHRmbi5hcHBseShudWxsLCBhcmdzKTtcclxuXHRcdH0sIHRpbWUpO1xyXG5cdH1cclxufVxyXG5cclxuY2xhc3MgU2Nyb2xsZXIge1xyXG5cdGNvbnN0cnVjdG9yKGxpbmVIZWlnaHQsIGJ1ZmZlclpvbmUpIHtcclxuXHJcblx0XHR0aGlzLmJ1ZmZlclpvbmUgPSBidWZmZXJab25lO1xyXG5cdFx0dGhpcy55RGlyID0gMDsgLy8gMTrlkJHkuIrvvIwwLC0xOuWQkeS4i1xyXG5cdFx0dGhpcy55UHJlSW5kZXggPSAwOyAvLyDkuIrkuIDkuKrkvY3nva5cclxuXHRcdHRoaXMubGluZUhlaWdodCA9IGxpbmVIZWlnaHQ7XHJcblxyXG5cdFx0dGhpcy54RGlyID0gMDsgLy8gMe+8muWQkeW3pu+8jDDvvIwtMe+8muWQkeWPs1xyXG5cdFx0dGhpcy54UHJlSW5kZXggPSAwOyAvLyDliY3kuIDkuKrkvY3nva5cclxuXHJcblx0XHR0aGlzLl90cmlnZ2VyWCA9IHggPT4geDtcclxuXHRcdHRoaXMuX3RyaWdnZXJZID0geSA9PiB5O1xyXG5cclxuXHR9XHJcblxyXG5cdG9uWChjYWxsYmFjaykge1xyXG5cdFx0dGhpcy5fdHJpZ2dlclggPSB4ID0+IHtcclxuXHRcdFx0aWYgKHggPT09IHRoaXMueFByZUluZGV4KSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLnhEaXIgPSB4IC0gdGhpcy54UHJlSW5kZXg7XHJcblx0XHRcdHRoaXMueFByZUluZGV4ID0geDtcclxuXHJcblx0XHRcdGNhbGxiYWNrKHgpO1xyXG5cdFx0fTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdG9uWShoYW5kbGVyLCBkZWxheSkge1xyXG5cdFx0Ly8gVE9ET1xyXG5cdFx0Ly8gdmFyIGRlYWx5Rm4gPSB0aHJvdHRsZShoYW5kbGVyLCBkZWxheSk7XHJcblxyXG5cdFx0dGhpcy5fdHJpZ2dlclkgPSB0aHJvdHRsZSgoeSkgPT4ge1xyXG5cdFx0XHR0aGlzLnlEaXIgPSB5IC0gdGhpcy55UHJlSW5kZXg7XHJcblx0XHRcdHRoaXMueVByZUluZGV4ID0geTtcclxuXHJcblx0XHRcdHZhciBpbmRleCA9IH5+KHkvIHRoaXMubGluZUhlaWdodCk7XHJcblx0XHRcdHZhciB3aWxsTG9hZCA9IHRoaXMuYnVmZmVyWm9uZS5zaG91bGRMb2FkKHRoaXMueURpciwgaW5kZXgpO1xyXG5cclxuXHRcdFx0aWYgKHdpbGxMb2FkKSB7XHJcblx0XHRcdFx0Ly8gZGVhbHlGbigpO1xyXG5cdFx0XHRcdGhhbmRsZXIoXHJcblx0XHRcdFx0XHR0aGlzLnlEaXIgPiAwID8gMSA6IC0xLFxyXG5cdFx0XHRcdFx0dGhpcy5idWZmZXJab25lLmRvbWFpbixcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS5zdGFydCxcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS5lbmQsXHJcblx0XHRcdFx0XHRpbmRleCxcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS50b3RhbFxyXG5cdFx0XHRcdCk7XHJcblx0XHRcdH1cclxuXHRcdH0sIGRlbGF5KTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdGZpcmVYKHgpIHtcclxuXHRcdHRoaXMuX3RyaWdnZXJYKHgpO1xyXG5cdH1cclxuXHJcblx0ZmlyZVkoeSkge1xyXG5cdFx0dGhpcy5fdHJpZ2dlclkoeSk7XHJcblx0fVxyXG5cclxuXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU2Nyb2xsZXI7IiwiLy8gZXhwb3J0cy5HcmlkU3RvcmUgPSByZXF1aXJlKCcuL2NvcmUvR3JpZFN0b3JlJyk7XHJcbi8vIGV4cG9ydHMuR3JpZFZpZXcgPSByZXF1aXJlKCcuL2NvcmUvR3JpZFZpZXcnKTtcclxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3BsdWdpbi9TZWxlY3Rpb24nKTsiLCJ2YXIgR3JpZFZpZXcgPSByZXF1aXJlKCcuLi9jb3JlL0dyaWRWaWV3Jyk7XHJcblxyXG5jb25zdCBDRUxMX0NMUyA9ICdsaS5jLWdyaWQtY2VsbCc7XHJcbmNvbnN0IENFTExfU0VMRUNURURfQ0xTID0gJ2MtY2VsbC1zZWxlY3RlZCc7XHJcbmNvbnN0IFJPV19DTFMgPSAnLmMtZ3JpZC1yb3cnO1xyXG5cclxuY2xhc3MgU2VsZWN0aW9uIGV4dGVuZHMgR3JpZFZpZXcge1xyXG5cclxuXHRjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcblx0XHRzdXBlcihvcHRpb25zKTtcclxuXHJcblx0XHR0aGlzLl9tb3ZpbmcgPSBmYWxzZTtcclxuXHRcdHRoaXMuX3N0YXJ0ID0gbnVsbDtcclxuXHRcdHRoaXMuX2VuZCA9IG51bGw7XHJcblx0XHR0aGlzLl9sYXN0WSA9IG51bGw7XHJcblx0XHR0aGlzLl9zZWxlY3Rpb24gPSBbXTtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoJGRvbSkge1xyXG5cdFx0c3VwZXIuX2JpbmRFdmVudCgpO1xyXG5cclxuXHRcdGxldCBzZWxmID0gdGhpcztcclxuXHJcblx0XHR0aGlzLiRkb20uY2FudmFzXHJcblx0XHRcdC5vbignbW91c2Vkb3duJywgQ0VMTF9DTFMsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHRcdGlmIChldnQuYnV0dG9uID09PSAwKSB7XHJcblx0XHRcdFx0XHRzZWxmLiRkb20uY2FudmFzLmZpbmQoQ0VMTF9DTFMpLnJlbW92ZUNsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0XHRcdHNlbGYuX21vdmluZyA9IHRydWU7XHJcblx0XHRcdFx0XHRsZXQgJGNlbGwgPSAkKHRoaXMpLmFkZENsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0XHRcdHNlbGYuX3N0YXJ0ID0gWyRjZWxsLmRhdGEoJ2RhdGFJbmRleCcpLCArJGNlbGwucGFyZW50KFJPV19DTFMpLmF0dHIoJ3JpZCcpXTtcclxuXHRcdFx0XHRcdC8vIGNvbnNvbGUubG9nKHN0YXJ0KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pXHJcblx0XHRcdC5vbignbW91c2VlbnRlcicsIENFTExfQ0xTLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRpZiAoc2VsZi5fbW92aW5nKSB7XHJcblx0XHRcdFx0XHRsZXQgJGNlbGwgPSAkKHRoaXMpO1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0XHQkY2VsbC5hZGRDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUyk7XHJcblx0XHRcdFx0XHRzZWxmLl9lbmQgPSBbJGNlbGwuZGF0YSgnZGF0YUluZGV4JyksICskY2VsbC5wYXJlbnQoUk9XX0NMUykuYXR0cigncmlkJyldO1xyXG5cclxuXHRcdFx0XHRcdHNlbGYuc2VsZWN0aW9uUmFuZ2Uoc2VsZi5fc3RhcnQsIHNlbGYuX2VuZCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KVxyXG5cdFx0XHQub24oJ21vdXNldXAnLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdFx0XHRzZWxmLl9tb3ZpbmcgPSBmYWxzZTtcclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyhlbmQpO1xyXG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKHNlYyk7XHJcblx0XHRcdFx0Ly8gVE9ET1xyXG5cdFx0XHRcdC8vIGNvcHkoJCgnLmNlbGwuc2VsZWN0ZWQnKSk7XHJcblx0XHRcdH0pO1xyXG5cdH1cclxuXHJcblx0c2VsZWN0aW9uUmFuZ2UoW3gwLCB5MF0sIFt4MSwgeTFdKSB7XHJcblxyXG5cdFx0bGV0IHlEaXIgPSB5MSAtIHkwO1xyXG5cdFx0bGV0IGxhc3RZID0gdGhpcy5sYXN0WTtcclxuXHRcdFx0XHJcblx0XHQvLyB5UmFuZ2UgPSB7IGxhc3Q6ICwgbm93OiBbeTAsIHkxXSB9O1xyXG5cdFx0Ly8gW2wwLCBsMV1cclxuXHRcdC8vIFt5MCwgeTFdXHJcblx0XHQvLyBbbDAsIGwxXVxyXG5cdFx0bGV0IHJlbW92ZVlSYW5nZSA9IFtdO1xyXG5cdFx0Ly8gZG93blxyXG5cdFx0aWYgKHlEaXIgPj0gMCAmJiB5MSA8IGxhc3RZKSB7XHJcblx0XHRcdHJlbW92ZVlSYW5nZSA9IFt5MSwgbGFzdFldO1xyXG5cdFx0fVxyXG5cdFx0Ly8gdXBcclxuXHRcdGlmICh5RGlyIDw9IDAgJiYgeTEgPiBsYXN0WSkge1xyXG5cdFx0XHRyZW1vdmVZUmFuZ2UgPSBbbGFzdFksIHkxXTtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0dGhpcy5sYXN0WSA9IHkxO1xyXG5cdFx0Y29uc29sZS5sb2coeURpciwgcmVtb3ZlWVJhbmdlKTtcclxuXHJcblx0XHRsZXQgZGF0YUluZGV4ID0gdGhpcy5nZXRMb2NrQW5kVmlzaWFibGVDb2x1bW5Bc0RhdGFJbmRleCgpO1xyXG5cdFx0W3gwLCB5MCwgeDEsIHkxXSA9IG9yZGVyQnkoeDAsIHkwLCB4MSwgeTEsIGRhdGFJbmRleCk7XHJcblxyXG5cclxuXHRcdGxldCBjb2xzID0gZGF0YUluZGV4LnNsaWNlKGRhdGFJbmRleC5pbmRleE9mKHgwKSwgZGF0YUluZGV4LmluZGV4T2YoeDEpKzEpO1xyXG5cdFx0Y29uc29sZS5sb2coY29scyk7XHJcblx0XHRsZXQgcm93cyA9IHRoaXMuc3RvcmUuc2xpY2UoeTAsIHkxICsgMSk7XHJcblxyXG5cdFx0dGhpcy5fc2VsZWN0aW9uID0gcm93cy5tYXAocm93ID0+IHtcclxuXHRcdFx0cmV0dXJuIGNvbHMubWFwKGNvbCA9PiByb3cuZGF0YVtjb2xdKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdC8vIFRPRE9cclxuXHRcdC8vIOagvOW8j+WMliznirbmgIHlhpnlhaXliLBzdG9yZVxyXG5cdFx0Ly8gY29uc29sZS5sb2codGhpcy5fc2VsZWN0aW9uKTtcclxuXHJcblx0XHRsZXQgbm9kZUxpc3QgPSB0aGlzLmJ1ZmZlck5vZGUuZ2V0Tm9kZUxpc3QoKTtcclxuXHRcdG5vZGVMaXN0LmZvckVhY2goKHJvd05vZGUpID0+IHtcclxuXHRcdFx0bGV0ICRyb3cgPSByb3dOb2RlLiRub2RlO1xyXG5cdFx0XHRsZXQgaSAgPSArJHJvdy5hdHRyKCdyaWQnKTtcclxuXHRcdFx0XHJcblx0XHRcdGlmIChpID49IHkwICYmIGkgPCB5MSArIDEpIHtcclxuXHRcdFx0XHRjb2xzLmZvckVhY2goKGNvbCkgPT4ge1xyXG5cdFx0XHRcdFx0cm93Tm9kZS5jaGlsZHJlbi5mb3JFYWNoKCgkY2VsbCwgY29sTSkgPT4ge1xyXG5cdFx0XHRcdFx0XHRpZiAoY29scy5pbmRleE9mKGNvbE0uZGF0YUluZGV4KSAhPSAtMSkge1xyXG5cdFx0XHRcdFx0XHRcdCRjZWxsLmFkZENsYXNzKENFTExfU0VMRUNURURfQ0xTKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHQkY2VsbC5yZW1vdmVDbGFzcyhDRUxMX1NFTEVDVEVEX0NMUylcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICh5RGlyID49IDAgJiYgaSA+IHJlbW92ZVlSYW5nZVswXSAmJiBpIDw9cmVtb3ZlWVJhbmdlWzFdICkge1xyXG5cdFx0XHRcdCRyb3cuZmluZChDRUxMX0NMUykucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICh5RGlyIDw9IDAgJiYgaSA+PSByZW1vdmVZUmFuZ2VbMF0gJiYgaSA8cmVtb3ZlWVJhbmdlWzFdICkge1xyXG5cdFx0XHRcdCRyb3cuZmluZChDRUxMX0NMUykucmVtb3ZlQ2xhc3MoQ0VMTF9TRUxFQ1RFRF9DTFMpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRnZXRMb2NrQW5kVmlzaWFibGVDb2x1bW5Bc0RhdGFJbmRleCgpIHtcclxuXHRcdGxldCBjb2xzID0gW107XHJcblxyXG5cdFx0dGhpcy5sb2NrQ29sTWFuYWdlclxyXG5cdFx0XHQudmlzaWJsZUxvY2tDb2x1bW5cclxuXHRcdFx0LmVhY2goY29sTSA9PiBjb2xzLnVuc2hpZnQoY29sTS5kYXRhSW5kZXgpKTtcclxuXHJcblx0XHRsZXQgdmlzaWFibGVDb2xzID0gdGhpcy5jb2x1bW5Nb2RlbFxyXG5cdFx0XHQuZ2V0VmlzaWJsZUNvbHVtbigpXHJcblx0XHRcdC5tYXAoY29sTSA9PiBjb2xNLmRhdGFJbmRleClcclxuXHRcdFx0LmZpbHRlcihkYXRhSW5kZXggPT4gY29scy5pbmRleE9mKGRhdGFJbmRleCkgPT0gLTEpO1xyXG5cclxuXHRcdHJldHVybiBjb2xzLmNvbmNhdCh2aXNpYWJsZUNvbHMpO1xyXG5cdH1cclxuXHJcbn1cclxuXHJcblxyXG5mdW5jdGlvbiBzd2FwKGEsIGIpIHtcclxuXHRyZXR1cm4gW2IsIGFdO1xyXG59XHJcblxyXG5mdW5jdGlvbiBvcmRlckJ5KHgwLCB5MCwgeDEsIHkxLCBkYXRhSW5kZXgpIHtcclxuXHRpZiAoZGF0YUluZGV4LmluZGV4T2YoeDApID4gZGF0YUluZGV4LmluZGV4T2YoeDEpKSB7XHJcblx0XHRbeDAsIHgxXSA9IHN3YXAoeDAsIHgxKTtcclxuXHR9XHJcblx0aWYgKHkwID4geTEpIHtcclxuXHRcdFt5MCwgeTFdID0gc3dhcCh5MCwgeTEpO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIFt4MCwgeTAsIHgxLCB5MV07XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU2VsZWN0aW9uOyIsIid1c2Ugc3RyaWN0JztcclxuY29uc3QgJCA9IHJlcXVpcmUoJy4uL3V0aWwvc2hpbScpLiQ7XHJcblxyXG5jb25zdCBGTEVYTUlOV0lEVEggPSAzNTtcclxuXHJcbnZhciBkcmFnRHJvcCA9IGZ1bmN0aW9uKGV2dCAsb3B0cykge1xyXG5cdHZhciBkb2MgPSAkKGRvY3VtZW50KTtcclxuXHR2YXIgc2Nyb2xsTGVmdCA9IGRvY3VtZW50LmJvZHkuc2Nyb2xsTGVmdCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsTGVmdDtcclxuXHR2YXIgc2Nyb2xsVG9wID0gZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcDtcclxuXHR2YXIgbGVmdE9mZnNldCA9ICQoZXZ0LnRhcmdldCkub2Zmc2V0KCkubGVmdCAtIHNjcm9sbExlZnQ7XHJcblx0dmFyIGlYLCBpWSwgc3RhcnRYLCBlbmRYO1xyXG5cdHZhciBkcmFnZ2luZyA9IHRydWU7XHJcblxyXG5cdHN0YXJ0WCA9IGlYID0gZXZ0LmNsaWVudFggLSBzY3JvbGxMZWZ0O1xyXG5cdGlZID0gJChldnQudGFyZ2V0KS5vZmZzZXQoKS50b3AgLSBzY3JvbGxUb3A7XHJcblxyXG5cdG9wdHMub25EcmFnU3RhcnQoeyAneCc6IHN0YXJ0WCB9LCBvcHRzLiRlbGVtZW50KTtcclxuXHJcblx0ZG9jLm9uKCdtb3VzZW1vdmUuZHJhZ2Ryb3AnLCAkLnByb3h5KG1vdXNlbW92ZSwgdGhpcykpO1xyXG5cdGRvYy5vbignbW91c2V1cC5kcmFnZHJvcCcsICQucHJveHkobW91c2V1cCwgdGhpcykpO1xyXG5cdC8vICQoZXZ0LnRhcmdldClbMF0uc2V0Q2FwdHVyZSAmJiAkKGV2dC50YXJnZXQpWzBdLnNldENhcHR1cmUoKTtcclxuXHJcblx0ZnVuY3Rpb24gbW91c2Vtb3ZlKGUpIHtcclxuXHRcdGlmIChkcmFnZ2luZykge1xyXG5cdFx0XHRlbmRYID0gZS5jbGllbnRYIC0gc2Nyb2xsTGVmdDtcclxuXHJcblx0XHRcdC8vIGxpbWl0XHJcblx0XHRcdGlmIChlbmRYIC0gbGVmdE9mZnNldCA8IEZMRVhNSU5XSURUSCkge1xyXG5cdFx0XHRcdGVuZFggPSBsZWZ0T2Zmc2V0ICsgRkxFWE1JTldJRFRIO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRvcHRzLm9uRHJhZ2dpbmcoIHsgJ3gnOiBlbmRYIH0sIG9wdHMuJGVsZW1lbnQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBtb3VzZXVwKGV2dCkge1xyXG5cdFx0dmFyIGUgPSBldnQudGFyZ2V0O1xyXG5cdFx0ZHJhZ2dpbmcgPSBmYWxzZTtcclxuXHJcblx0XHRvcHRzLm9uRHJhZ0VuZCh7ICd4JzogZXZ0LmNsaWVudFggLSBzY3JvbGxMZWZ0IH0sIG9wdHMuJGVsZW1lbnQpO1xyXG5cclxuXHRcdGlmIChlICYmIGUuc2V0Q2FwdHVyZSkge1xyXG5cdFx0XHRlLnJlbGVhc2VDYXB0dXJlKCk7XHJcblx0XHR9IGVsc2UgaWYgKHdpbmRvdy5yZWxlYXNlQ2FwdHVyZSkge1xyXG5cdFx0XHR3aW5kb3cucmVsZWFzZUNhcHR1cmUoRXZlbnQuTU9VU0VNT1ZFIHwgRXZlbnQuTU9VU0VVUCk7XHJcblx0XHR9XHJcblxyXG5cdFx0ZG9jLm9mZignbW91c2Vtb3ZlLmRyYWdkcm9wJywgbW91c2Vtb3ZlKTtcclxuXHRcdGRvYy5vZmYoJ21vdXNldXAuZHJhZ2Ryb3AnLCBtb3VzZXVwKTtcclxuXHR9XHJcblxyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odGFyZ2V0LCBvcHRpb25zKSB7XHJcblx0dmFyIGRlZmF1bHRzID0ge1xyXG5cdFx0cmVzdHJpY3RlcihldnQpIHsgcmV0dXJuIG51bGw7IH0sXHJcblx0XHRvbkRyYWdTdGFydChvZmZzZXQsIHRhcmdldCkge30sXHJcblx0XHRvbkRyYWdnaW5nKG9mZnNldCwgdGFyZ2V0KSB7fSxcclxuXHRcdG9uRHJhZ0VuZChvZmZzZXQsIHRhcmdldCkge31cclxuXHR9O1xyXG5cclxuXHRPYmplY3QuYXNzaWduKGRlZmF1bHRzLCBvcHRpb25zKTtcclxuXHJcblx0JCh0YXJnZXQpLm9uKCdtb3VzZWRvd24nLCBmdW5jdGlvbihldnQpIHtcclxuXHRcdHZhciByZXN0cmljdGVyID0gZGVmYXVsdHMucmVzdHJpY3RlcihldnQpO1xyXG5cclxuXHRcdGlmIChyZXN0cmljdGVyKSB7XHJcblx0XHRcdGRlZmF1bHRzLiRlbGVtZW50ID0gZGVmYXVsdHMucmVzdHJpY3RlcihldnQpIHx8ICQoZXZ0LnRhcmdldCk7XHJcblx0XHRcdGRyYWdEcm9wKGV2dCwgZGVmYXVsdHMpO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG59OyIsIi8qKlxyXG4gKiDkuovku7bnrqHnkIZcclxuICogQGNsYXNzIEV2ZW50RW1pdHRlclxyXG4gKi9cclxuXHJcbmZ1bmN0aW9uIGluZGV4T2ZMaXN0ZW5lcihsaXN0ZW5lcnMsIGxpc3RlbmVyKSB7XHJcblx0dmFyIGkgPSBsaXN0ZW5lcnMubGVuZ3RoO1xyXG5cdHdoaWxlIChpLS0pIHtcclxuXHRcdGlmIChsaXN0ZW5lcnNbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSB7XHJcblx0XHRcdHJldHVybiBpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRyZXR1cm4gLTE7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGlzVmFsaWRMaXN0ZW5lcihsaXN0ZW5lcikge1xyXG5cdGlmICh0eXBlb2YgbGlzdGVuZXIgPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH0gZWxzZSBpZiAobGlzdGVuZXIgJiYgdHlwZW9mIGxpc3RlbmVyID09PSAnb2JqZWN0Jykge1xyXG5cdFx0cmV0dXJuIGlzVmFsaWRMaXN0ZW5lcihsaXN0ZW5lci5saXN0ZW5lcik7XHJcblx0fSBlbHNlIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcbn1cclxuXHJcbmNsYXNzIEV2ZW50RW1pdHRlciB7XHJcblxyXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcclxuXHJcblx0fVxyXG5cdC8qKlxyXG5cdCpcclxuXHQqXHJcblx0KlxyXG5cdCpcclxuXHQqL1xyXG5cdF9nZXRFdmVudHMoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fZXZlbnRzIHx8ICh0aGlzLl9ldmVudHMgPSB7fSk7XHJcblx0fVxyXG5cdC8qKlxyXG5cdCog6YCa6L+H5LqL5Lu25ZCN6I635Y+WbGlzdGVuZXIg5pWw57uE5oiW5Yid5aeL5YyWXHJcblx0KiDkvb/nlKjmraPliJnljLnphY3kvJrov5Tlm57kuIDkuKrlr7nlupTnmoTlr7nosaFcclxuXHQqXHJcblx0KiBcclxuXHQqIGdldExpc3RlbmVyc1xyXG5cdCogQHBhcmFtIHtTdHJpbmcgfSBSZWdFeHB9IGV2ZW50TmFtZVxyXG5cdCogQHJldHVybiB7RnVuY3RvbltdIHwgT2JqZWN0fVxyXG5cdCpcclxuXHQqL1xyXG5cdGdldExpc3RlbmVycyhuYW1lKSB7XHJcblx0XHR2YXIgZXZlbnRzID0gdGhpcy5fZ2V0RXZlbnRzKCk7XHJcblx0XHR2YXIgcmVzcG9uc2U7XHJcblx0XHR2YXIga2V5O1xyXG5cclxuXHRcdGlmIChuYW1lIGluc3RhbmNlb2YgUmVnRXhwKSB7XHJcblx0XHRcdHJlc3BvbnNlID0ge307XHJcblx0XHRcdGZvciAoa2V5IGluIGV2ZW50cykge1xyXG5cdFx0XHRcdGlmIChldmVudHMuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBuYW1lLnRlc3Qoa2V5KSkge1xyXG5cdFx0XHRcdFx0cmVzcG9uc2Vba2V5XSA9IGV2ZW50c1trZXldO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cmVzcG9uc2UgPSBldmVudHNbbmFtZV0gfHwgKGV2ZW50c1tuYW1lXSA9IFtdKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcmVzcG9uc2U7XHJcblx0fVxyXG5cdC8qKlxyXG5cdCog6YCa6L+H5LqL5Lu25ZCN6I635Y+WbGlzdGVuZXIg5aeL57uI6L+U5Zue5LiA5Liq5a+56LGhXHJcblx0KlxyXG5cdCogXHJcblx0KiBnZXRMaXN0ZW5lcnNBc09iamVjdFxyXG5cdCogQHBhcmFtIHtTdHJpbmd8UmVnRXhwfSBldmVudE5hbWVcclxuXHQqIEByZXR1cm4ge09iamVjdH1cclxuXHQqL1xyXG5cdGdldExpc3RlbmVyc0FzT2JqZWN0KG5hbWUpIHtcclxuXHRcdHZhciBsaXN0ZW5lcnMgPSB0aGlzLmdldExpc3RlbmVycyhuYW1lKTtcclxuXHRcdHZhciByZXNwb25zZTtcclxuXHJcblx0XHRpZiAobGlzdGVuZXJzIGluc3RhbmNlb2YgQXJyYXkpIHtcclxuXHRcdFx0cmVzcG9uc2UgPSB7fTtcclxuXHRcdFx0cmVzcG9uc2VbbmFtZV0gPSBsaXN0ZW5lcnM7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHJlc3BvbnNlIHx8IGxpc3RlbmVycztcclxuXHR9XHJcblx0LyoqXHJcblx0KiDojrflj5YgbGlzdGVuZXIg5YiX6KGoXHJcblx0KlxyXG5cdCogZmxhdHRlbkxpc3RlbmVyc1xyXG5cdCpcclxuXHQqIEBwYXJhbSB7IE9iamVjdFtdfSBsaXN0ZW5lcnNcclxuXHQqIEByZXR1cm4ge0Z1bmN0aW9uW119XHJcblx0Ki9cclxuXHRmbGF0dGVuTGlzdGVuZXJzKGxpc3RlbmVycykge1xyXG5cdFx0dmFyIGZsYXRMaXN0ZW5lcnMgPSBbXTtcclxuXHJcblx0XHRmb3IgKHZhciBpID0gMCwgbCA9IGxpc3RlbmVyLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG5cdFx0XHRmbGF0TGlzdGVuZXJzLnB1c2gobGlzdGVuZXJzW2ldLmxpc3RlbmVyKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmxhdExpc3RlbmVycztcclxuXHR9XHJcblx0LyoqXHJcblx0KiDkuovku7bms6jlhoxcclxuXHQqXHJcblx0KlxyXG5cdCogQGV4YW1wZWxcclxuXHQqIHZhciBlbXQgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XHJcblx0KiBlbXQuYWRkTGlzdGVuZXIoJ2Rpdjpob3ZlcicsIGZ1bmN0aW9uKCl7XHJcblx0Klx0Ly8gZG9cclxuXHQqIH0pO1xyXG5cdCogQHBhcmFtIHtzdHJpbmd9IGV2ZW50TmFtZVxyXG5cdCogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXJcclxuXHQqIEByZXR1cm4ge09iamVjdGp9XHJcblx0KlxyXG5cdCovXHJcblx0YWRkTGlzdGVuZXIobmFtZSwgbGlzdGVuZXIsIGZsYWcpIHtcclxuXHRcdGlmICghaXNWYWxpZExpc3RlbmVyKGxpc3RlbmVyKSkge1xyXG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgbGlzdGVuZXJzID0gdGhpcy5nZXRMaXN0ZW5lcnNBc09iamVjdChuYW1lKTtcclxuXHRcdHZhciBsaXN0ZW5lcklzV3JhcHBlZCA9IHR5cGVvZiBsaXN0ZW5lciA9PT0gJ29iamVjdCc7XHJcblx0XHR2YXIga2V5LCBzdGFydCwgYXJncztcclxuXHJcblx0XHRmb3IgKGtleSBpbiBsaXN0ZW5lcnMpIHtcclxuXHRcdFx0aWYgKGxpc3RlbmVycy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIGluZGV4T2ZMaXN0ZW5lcihsaXN0ZW5lcnMsIGxpc3RlbmVyKSA9PT0gLTEpIHtcclxuXHJcblx0XHRcdFx0c3RhcnQgPSBsaXN0ZW5lcnNba2V5XS5sZW5ndGg7XHJcblxyXG5cdFx0XHRcdGxpc3RlbmVyc1trZXldLnB1c2gobGlzdGVuZXJJc1dyYXBwZWQgPyBsaXN0ZW5lciA6IHtcclxuXHRcdFx0XHRcdGxpc3RlbmVyOiBsaXN0ZW5lcixcclxuXHRcdFx0XHRcdG9uY2U6IGZhbHNlXHJcblx0XHRcdFx0fSk7XHJcblxyXG5cdFx0XHRcdGlmIChmbGFnICYmIGxpc3RlbmVyc1trZXldLmFyZ3MpIHtcclxuXHRcdFx0XHRcdGxpc3RlbmVyc1trZXldLnN0YXJ0ID0gc3RhcnQ7XHJcblx0XHRcdFx0XHRhcmdzID0gbGlzdGVuZXJzW2tleV0uYXJncztcclxuXHRcdFx0XHRcdHRoaXMuZW1pdEV2ZW50KG5hbWUsIGFyZ3MpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0b24oKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5hZGRMaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHJcblx0b25lKG5hbWUsIGxpc3RlbmVyLCBmbGFnKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yZW1vdmVFdmVudChuYW1lKS5hZGRMaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICog5LqL5Lu25rOo5YaM77yM6Kem5Y+R5ZCO6Ieq5Yqo56e76ZmkXHJcblx0ICpcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWVcclxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxyXG5cdCAqIEByZXV0bnIge09iamVjdH1cclxuXHQgKlxyXG5cdCAqL1xyXG5cdGFkZE9uY2VMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lcikge1xyXG5cdFx0cmV0dXJuIHRoaXMuYWRkTGlzdGVuZXIobmFtZSwge1xyXG5cdFx0XHRsaXN0ZW5lcjogbGlzdGVuZXIsXHJcblx0XHRcdG9uY2U6IHRydWVcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0b25jZSgpIHtcclxuXHRcdHJldHVybiB0aGlzLmFkZE9uY2VMaXN0ZW5lci5hcHBseSh0aGlzLmFyZ3VtZW50cyk7XHJcblx0fVxyXG5cdC8qKlxyXG5cdCAqIOS6i+S7tumUgOavgVxyXG5cdCAqXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnROYW1lXHJcblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXJcclxuXHQgKiBAcmV0dXJuIHtPYmplY3R9XHJcblx0ICpcclxuXHQgKi9cclxuXHRyZW1vdmVMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lcikge1xyXG5cdFx0dmFyIGxpc3RlbmVycyA9IHRoaXMuZ2V0TGlzdGVuZXJzQXNPYmplY3QobmFtZSk7XHJcblx0XHR2YXIgaW5kZXg7XHJcblx0XHR2YXIga2V5O1xyXG5cclxuXHRcdGZvciAoa2V5IGluIGxpc3RlbmVycykge1xyXG5cdFx0XHRpZiAobGlzdGVuZXJzLmhhc093blByb3BlcnR5KGtleSkpIHtcclxuXHRcdFx0XHRpbmRleCA9IGluZGV4T2ZMaXN0ZW5lcihsaXN0ZW5lcnNba2V5XSwgbGlzdGVuZXIpO1xyXG5cclxuXHRcdFx0XHRpZiAoaW5kZXggIT09IC0xKSB7XHJcblx0XHRcdFx0XHRsaXN0ZW5lcnNba2V5XS5zcGxpY2UoaW5kZXgsIGkpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0b2ZmKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMucmVtb3ZlTGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuXHR9XHJcblxyXG5cdG1hbmlwdWxhdGVMaXN0ZW5lcnMocmVtb3ZlLCBuYW1lLCBsaXN0ZW5lcnMpIHtcclxuXHRcdHZhciBzaW5nbGUgPSByZW1vdmUgPyB0aGlzLnJlbW92ZUxpc3RlbmVyIDogdGhpcy5hZGRMaXN0ZW5lcjtcclxuXHRcdHZhciBtdXRpcGxlID0gcmVtb3ZlID8gdGhpcy5yZW1vdmVMaXN0ZW5lcnMgOiB0aGlzLmFkZExpc3RlbmVycztcclxuXHRcdHZhciBpO1xyXG5cdFx0dmFyIHY7XHJcblxyXG5cdFx0aWYgKHR5cGVvZiBuYW1lID09PSAnb2JqZWN0JyAmJiAhKG5hbWUgaW5zdGFuY2VvZiBSZWdFeHApKSB7XHJcblx0XHRcdGZvciAoaSBpbiBuYW1lKSB7XHJcblx0XHRcdFx0aWYgKG5hbWUuaGFzT3duUHJvcGVydHkoaSkgJiYgKHYgPSBuYW1lW2ldKSkge1xyXG5cdFx0XHRcdFx0aWYgKHR5cGVvZiB2ID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHRcdFx0XHRcdHNpbmdsZS5jYWxsKHRoaXMsIGksIHYpO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0bXV0aXBsZS5jYWxsKHRoaXMsIGksIHYpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0aSA9IDA7XHJcblx0XHRcdHYgPSBsaXN0ZW5lcnMubGVuZ3RoO1xyXG5cdFx0XHR3aGlsZSAoaSA8IHYpIHtcclxuXHRcdFx0XHRzaW5nbGUuY2FsbCh0aGlzLCBuYW1lLCBsaXN0ZW5lcnNbaSsrXSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdGFkZExpc3RlbmVycyhuYW1lLCBsaXN0ZW5lcnMpIHtcclxuXHRcdHJldHVybiB0aGlzLm1hbmlwdWxhdGVMaXN0ZW5lcnMoZmFsc2UsIG5hbWUsIGxpc3RlbmVycyk7XHJcblx0fVxyXG5cclxuXHRyZW1vdmVMaXN0ZW5lcnMobmFtZSwgbGlzdGVuZXJzKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5tYW5pcHVsYXRlTGlzdGVuZXJzKHRydWUsIG5hbWUsIGxpc3RlbmVycyk7XHJcblx0fVxyXG5cclxuXHRyZW1vdmVFdmVudChuYW1lKSB7XHJcblx0XHR2YXIgZXZlbnRzID0gdGhpcy5fZ2V0RXZlbnRzKCk7XHJcblx0XHR2YXIga2V5O1xyXG5cclxuXHRcdGlmICh0eXBlb2YgbmFtZSA9PT0gJ3N0cmluZycpIHtcclxuXHRcdFx0Ly8g56e76Zmk5omA5pyJ5oyH5a6a5LqL5Lu25ZCN55qE5omA5pyJbGlzdGVuZXJzXHJcblx0XHRcdC8vIGRlbGV0ZSBldmVudHNbbmFtZV1cclxuXHRcdFx0aWYgKGV2ZW50c1tuYW1lXSBpbnN0YW5jZW9mIEFycmF5KSB7XHJcblx0XHRcdFx0ZXZlbnRzW25hbWVdLmxlbmd0aCA9IDA7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSBpZiAobmFtZSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xyXG5cdFx0XHQvLyDmraPliJnljLnphY3nmoTmiYDmnIkgbGlzdGVuZXJzXHJcblx0XHRcdGZvciAoa2V5IGluIGV2ZW50cykge1xyXG5cdFx0XHRcdGlmIChldmVudHMuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBuYW1lLnRlc3Qoa2V5KSkge1xyXG5cdFx0XHRcdFx0Ly8gZGVsZXRlIGV2ZW50c1trZXldXHJcblx0XHRcdFx0XHRpZiAoZXZlbnRzW2tleV0gaW5zdGFuY2VvZiBBcnJheSkge1xyXG5cdFx0XHRcdFx0XHRldmVudFtrZXldLmxlbmd0aCA9IDA7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQvLyDnp7vpmaTmiYDmnIkgbGlzdGVuZXJzXHJcblx0XHRcdGRlbGV0ZSB0aGlzLl9ldmVudHM7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRyZW1vdmVBbGxMaXN0ZW5lcnMoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yZW1vdmVFdmVudC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHQvKipcclxuXHQgKiDkuovku7bop6blj5FcclxuXHQgKlxyXG5cdCAqXHJcblx0ICogQGV4YW1wbGVcclxuXHQgKiB2YXIgZW10ID0gbmV3IEV2ZW50RW1pdHRlcigpO1xyXG5cdCAqIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcblx0ICogXHRlbXQuZW1pdEV2ZW50KCdkaXY6aG92ZXInLCAxKTtcclxuXHQgKiB9LCAxMDAwKTtcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWUg5LqL5Lu25ZCN56ewXHJcblx0ICogQHBhcmFtIHtBcnJheX0gW2FyZ3NdIEhUTUxEb2N1bWVudCwgaXRlbURhdGEsIC4uLlxyXG5cdCAqIEByZXR1cm4ge09iamVjdH1cclxuXHQgKlxyXG5cdCAqL1xyXG5cdGVtaXRFdmVudChuYW1lLCBhcmdzKSB7XHJcblx0XHR2YXIgbGlzdGVuZXJzTWFwID0gdGhpcy5nZXRMaXN0ZW5lcnNBc09iamVjdChuYW1lKTtcclxuXHRcdHZhciBsaXN0ZW5lcnM7XHJcblx0XHR2YXIgbGlzdGVuZXI7XHJcblx0XHR2YXIgaTtcclxuXHRcdHZhciBsO1xyXG5cdFx0dmFyIGtleTtcclxuXHRcdHZhciByZXNwb25zZTtcclxuXHJcblx0XHRmb3IgKGtleSBpbiBsaXN0ZW5lcnNNYXApIHtcclxuXHRcdFx0aWYgKGxpc3RlbmVyc01hcC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XHJcblx0XHRcdFx0bGlzdGVuZXJzID0gbGlzdGVuZXJzTWFwW2tleV0uc2xpY2UoMCk7XHJcblxyXG5cdFx0XHRcdGxpc3RlbmVyc01hcFtrZXldLmFyZ3MgPSBhcmdzO1xyXG5cclxuXHRcdFx0XHRpID0gbGlzdGVuZXJzTWFwW2tleV0uc3RhcnQgfHwgMDtcclxuXHRcdFx0XHRsaXN0ZW5lcnNNYXBba2V5XS5zdGFydCA9IDA7XHJcblxyXG5cdFx0XHRcdGZvciAobCA9IGxpc3RlbmVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuXHRcdFx0XHRcdGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldO1xyXG5cclxuXHRcdFx0XHRcdGlmIChsaXN0ZW5lci5vbmNlID09PSB0cnVlKSB7XHJcblx0XHRcdFx0XHRcdHRoaXMucmVtb3ZlTGlzdGVuZXIobmFtZSwgbGlzdGVuZXIubGlzdGVuZXIpO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHJlc3BvbnNlID0gbGlzdGVuZXIubGlzdGVuZXIuYXBwbHkodGhpcywgYXJncyB8fCBbXSk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKHJlc3BvbnNlID09PSB0aGlzLl9nZXRPbmNlUmV0dXJuVmFsdWUoKSkge1xyXG5cdFx0XHRcdFx0XHR0aGlzLnJlbW92ZUxpc3RlbmVyKG5hbWUsIGxpc3RlbmVyLmxpc3RlbmVyKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0dHJpZ2dlcigpIHtcclxuXHRcdHJldHVybiB0aGlzLmVtaXRFdmVudC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHJcblx0ZmlyZShuYW1lKSB7XHJcblx0XHR2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XHJcblx0XHRyZXR1cm4gdGhpcy5lbWl0RXZlbnQobmFtZSwgYXJncyk7XHJcblx0fVxyXG5cclxuXHRfZ2V0T25jZVJldHVyblZhbHVlKCkge1xyXG5cdFx0aWYgKHRoaXMuaGFzT3duUHJvcGVydHkoJ19vbmNlUmV0dXJuVmFsdWUnKSkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5fb25jZVJldHVyblZhbHVlO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHRzZXRPbmNlUmV0dXJuVmFsdWUodmFsdWUpIHtcclxuXHRcdHRoaXMuX29uY2VSZXR1cm5WYWx1ZSA9IHZhbHVlO1xyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRkZWZpbmVFdmVudChuYW1lKSB7XHJcblx0XHR0aGlzLmdldExpc3RlbmVycyhuYW1lKTtcclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0ZGVmaW5lRXZlbnRzKG5hbWVzKSB7XHJcblx0XHRmb3IgKHZhciBpID0gMCwgbCA9IG5hbWVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG5cdFx0XHR0aGlzLmRlZmluZUV2ZW50KG5hbWVbaV0pO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XHJcblxyXG5cclxuIiwiZnVuY3Rpb24gc3dhcChhcnIsIHMxLCBzMikge1xyXG5cdHZhciB0ZW1wID0gYXJyW3MxXTtcclxuXHRhcnJbczFdID0gYXJyW3MyXTtcclxuXHRhcnJbczJdID0gdGVtcDtcclxufVxyXG5cclxuZnVuY3Rpb24gcmFuZG9tVmFsdWUoYXJyKSB7XHJcblx0dmFyIHIgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBhcnIubGVuZ3RoKTtcclxuXHQvLyBzd2FwKGFyciwgMCwgcik7XHJcblx0cmV0dXJuIFthcnJbcl0sIGFyci5maWx0ZXIoKGQsIGkpID0+IGkgIT09IHIpXTtcclxufVxyXG5cclxuZnVuY3Rpb24gZmlsdGVyTEFuZFIoYXJyLCBzZWxlY3QsIGNvbXBhcmVGbikge1xyXG5cdHZhciBsZWZ0QXJyID0gW107XHJcblx0dmFyIHJpZ2h0QXJyID0gW107XHJcblxyXG5cdGZvciAodmFyIGkgPSAwLCBsZW4gPSBhcnIubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcclxuXHRcdGxldCB0ZW1wID0gYXJyW2ldO1xyXG5cdFx0bGV0IGNvbXBhcmVkID0gY29tcGFyZUZuKHNlbGVjdCwgdGVtcCk7XHJcblx0XHRpZiAoY29tcGFyZWQgPiAwKSByaWdodEFyci5wdXNoKHRlbXApO1xyXG5cdFx0ZWxzZSBpZiAoY29tcGFyZWQgPCAwKSBsZWZ0QXJyLnB1c2godGVtcCk7XHJcblx0XHRlbHNlIE1hdGgucmFuZG9tKCkgPiAwLjUgPyByaWdodEFyci5wdXNoKHRlbXApIDogbGVmdEFyci5wdXNoKHRlbXApO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIFtsZWZ0QXJyLCByaWdodEFycl07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZpbmRJbmRleChhcnIsIGluZGV4LCBjb21wYXJlRm4pIHtcclxuXHRpZiAoYXJyLmxlbmd0aCA8PSAxIHx8IGluZGV4ID09PSAwKSByZXR1cm4gYXJyWzBdO1xyXG5cdHZhciBbc2VsZWN0LCBzZWNfYXJyXSA9IHJhbmRvbVZhbHVlKGFycik7XHJcblx0dmFyIFtsZWZ0QXJyLCByaWdodEFycl0gPSBmaWx0ZXJMQW5kUihzZWNfYXJyLCBzZWxlY3QsIGNvbXBhcmVGbik7XHJcblx0dmFyIG4gPSByaWdodEFyci5sZW5ndGg7XHJcblxyXG5cdGlmIChuID09PSBpbmRleCAtIDEpIHJldHVybiBzZWxlY3Q7XHJcblx0aWYgKG4gPj0gaW5kZXgpIHJldHVybiBmaW5kSW5kZXgocmlnaHRBcnIsIGluZGV4LCBjb21wYXJlRm4pO1xyXG5cdGVsc2UgcmV0dXJuIGZpbmRJbmRleChsZWZ0QXJyLCBpbmRleCAtIG4gLSAxLCBjb21wYXJlRm4pO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZpbmRJbmRleDsiLCJ2YXIgVXRpbHMgPSB7fTtcclxuXHJcbnZhciB1aWQgPSBVdGlscy51aWQgPSAoKCkgPT4ge1xyXG5cdGxldCB0ID0gRGF0ZS5ub3coKTtcclxuXHRyZXR1cm4gKCkgPT4ge1xyXG5cdFx0cmV0dXJuICh0KyspLnRvU3RyaW5nKDE2KTtcclxuXHR9O1xyXG59KSgpO1xyXG5cclxuXHJcbnZhciBtZXJnZSA9IFV0aWxzLm1lcmdlID0gKHRhcmdldCwgYWRkaXRpb25hbCwgZGVlcCkgPT4ge1xyXG5cdGxldCBkZXB0aCA9IHR5cGVvZiBkZWVwID09ICd1bmRlZmluZWQnID8gMiA6IGRlZXAsIHByb3A7XHJcblxyXG5cdGZvciAocHJvcCBpbiBhZGRpdGlvbmFsKSB7XHJcblx0XHRpZiAoYWRkaXRpb25hbC5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xyXG5cdFx0XHRpZiAodHlwZW9mIHRhcmdldFtwcm9wXSAhPT0gJ29iamVjdCcgfHwgIWRlcHRoKSB7XHJcblx0XHRcdFx0dGFyZ2V0W3Byb3BdID0gYWRkaXRpb25hbFtwcm9wXTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRVdGlscy5tZXJnZSh0YXJnZXRbcHJvcF0sIGFkZGl0aW9uYWxbcHJvcF0sIGRlcHRoIC0gMSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiB0YXJnZXQ7XHJcbn07XHJcblxyXG52YXIgZmluZEluZGV4ID0gVXRpbHMuZmluZEluZGV4ID0gcmVxdWlyZSgnLi9GaW5kSW5kZXgnKTtcclxudmFyIGNvbXBhcmVGbiA9IFV0aWxzLmNvbXBhcmVGbiA9IHJlcXVpcmUoJy4vdXRpbHMvQ29tcGFyZXInKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gVXRpbHM7IiwidmFyIGNvbnRleHQgPSB0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJyA/IHRoaXMgOiB3aW5kb3c7XHJcbmV4cG9ydHMuJCA9IGNvbnRleHQuJDtcclxuZXhwb3J0cy5fID0gY29udGV4dC5fOyIsIi8qKlxyXG4gKiDliJvlu7rmr5TovoPlh73mlbBcclxuICogQHN1bW1hcnkg57qm5p2f5p2h5Lu277yM5Y+q6ZKI5a+55a+56LGh5pWw57uE57uT5p6E55qE5pWw5o2u77yM5aaCXHJcbiAqICAgICAgW3tcImNvbF8xXCI6IDEwLCBcImNvbF8yXCI6IDM1LCBcImNvbF8zXCI6IDY2fSwgLi4uXVxyXG4gKlxyXG4gKiBAZXhhbXBsZVxyXG4gKlxyXG4gKiAgdmFyIHNvcnRzID0gWydBJywnQicsJ0MnLCdEJ107XHJcbiAqICB2YXIgZGlycyA9IFsxLCAtMSwgMSwgMV07XHJcbiAqXHJcbiAqICB2YXIgZGF0YTMgPSBbXHJcbiAqICAgICAge0E6MSxCOjEsQzo1LF9pZDoxfSxcclxuICogICAgICB7QToxLEI6MyxDOjUsX2lkOjF9LFxyXG4gKiAgICAgIHtBOjIsQjo1LEM6NCxfaWQ6Mn0sXHJcbiAqICAgICAge0E6MSxCOjEsQzo5LF9pZDoxfSxcclxuICogICAgICB7QTozLEI6MyxDOjMsX2lkOjN9LFxyXG4gKiAgICAgIHtBOjEsQjoxLEM6MyxfaWQ6MX0sXHJcbiAqICAgICAge0E6NCxCOjIsQzoyLF9pZDo0fSxcclxuICogICAgICB7QTo1LEI6NCxDOjEsX2lkOjV9LFxyXG4gKiAgXTtcclxuICpcclxuICogIHZhciBmbiA9IGNvbXBhcmVGbihzb3J0cywgZGlycyk7XHJcbiAqICB2YXIgcmV0ID0gZGF0YTMuc29ydChmbikubWFwKGQgPT4gT2JqZWN0LnZhbHVlcyhkKSk7XHJcbiAqICBjb25zb2xlLmRpcihyZXQpO1xyXG4gKlxyXG4gKiBAcGFyYW0ge0FycmF5fSBzb3J0cyAt5o6S5bqP5a2X5q615pWw57uEIFsnY29sXzEnLCAnY29sXzInLCAnY29sXzMnLC4uLl1cclxuICogQHBhcmFtIHtBcnJheX0gZGlycyAt5a+55bqU5a2X5L2T5o6S5bqP5pWw57uE55qE5Y2H6ZmN5bqPLDHvvJrljYfluo8gLTHvvJrpmY3luo8gWzEsIC0xXVxyXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IOavlOi+g+WHveaVsFxyXG4gKi9cclxuZXhwb3J0cy5jb21wYXJlRm4gPSBmdW5jdGlvbiBjb21wYXJlRm4oc29ydHMsIGRpcnMpIHtcclxuICAgIHZhciBjb25kaXRpb25zID0gc29ydHMucmVkdWNlKChwcmUsIG5leHQsIGkpID0+IHtcclxuICAgICAgICBwcmUgID0gcHJlID8gcHJlICsgJyB8fCcgOiAnJztcclxuICAgICAgICByZXR1cm4gYCR7cHJlfSAoYS4ke25leHR9IC0gYi4ke25leHR9KSAqICR7ZGlyc1tpXX1gO1xyXG4gICAgfSwgJycpO1xyXG5cclxuICAgIHZhciBmdW5jdGlvbl9ib2R5ID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgbGV0IHNvcnRJbmZvID0gc29ydHMuam9pbignLCcpLnJlcGxhY2UoLyhcXHcrKS9nLCAnXCIkMVwiJyk7XHJcbiAgICAgICAgcmV0dXJuIGB2YXIgc29ydCA9IFske3NvcnRJbmZvfV07IHJldHVybiAke2NvbmRpdGlvbnN9YDtcclxuICAgIH1cclxuICAgIC8vIGNvbnNvbGUubG9nKGZ1bmN0aW9uX2JvZHkoKSk7XHJcbiAgICBcclxuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oJ2EnLCAnYicsIGZ1bmN0aW9uX2JvZHkoKSk7XHJcbn1cclxuXHJcblxyXG4iXX0=
