(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.sz || (g.sz = {})).grid = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var EventEmitter = require('../util/EventEmitter');
var $ = require('../util/shim').$;

var createCell = function($row, colsModel) {
	var size = colsModel.size();
	var children = new Map();

	colsModel.each(colM => {

		let cell = $('<li/>')
			.addClass('c-grid-cell')
			.addClass('c-align-' + colM.align)
			.attr('tabindex', -1)
			.width(colM.width);

		if (colM.locked) {
			cell.addClass('c-column-locked');
		}

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
		});
	}

	setData(row, offsetTop) {
		var content;
		var cells = this.children;

		this.colsModel.each(colM => {

			content = colM.renderer(row.data[colM.dataIndex]);
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

},{"../util/EventEmitter":10,"../util/shim":13}],2:[function(require,module,exports){
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

		columns.forEach((col, index) => {
			let cid = index;
			let colM = new Column(cid, col, this);

			this.colModel.set(cid, colM);
			this.columns.push(colM);
			this.colHeaders.set(col.dataIndex, colM);
		});

		this._bindEvent();
	}

	_bindEvent() {
		this.on('notice-colModel-sort-changed', _.debounce(() => {
			this.fire('columns-sort-changed');
		}, 20));
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
},{"../util/EventEmitter":10,"../util/Utils":12,"../util/shim":13}],4:[function(require,module,exports){
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
},{"../util/EventEmitter":10,"../util/Utils":12,"../util/shim":13}],5:[function(require,module,exports){
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
},{"../util/EventEmitter":10,"../util/Utils":12,"./BufferNode":1,"./BufferZone":2,"./ColModel":3,"./GridStore":4,"./Header":6,"./LockColManager":7,"./Scroller":8}],6:[function(require,module,exports){
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
},{"../util/DD":9,"../util/shim":13}],7:[function(require,module,exports){
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
},{"../util/shim":13}],10:[function(require,module,exports){
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



},{}],11:[function(require,module,exports){
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
},{}],12:[function(require,module,exports){
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
},{"./FindIndex":11,"./utils/Comparer":14}],13:[function(require,module,exports){
var context = typeof window === 'undefined' ? this : window;
exports.$ = context.$;
exports._ = context._;
},{}],14:[function(require,module,exports){
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



},{}]},{},[5])(5)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY29yZS9CdWZmZXJOb2RlLmpzIiwic3JjL2NvcmUvQnVmZmVyWm9uZS5qcyIsInNyYy9jb3JlL0NvbE1vZGVsLmpzIiwic3JjL2NvcmUvR3JpZFN0b3JlLmpzIiwic3JjL2NvcmUvR3JpZFZpZXcuanMiLCJzcmMvY29yZS9IZWFkZXIuanMiLCJzcmMvY29yZS9Mb2NrQ29sTWFuYWdlci5qcyIsInNyYy9jb3JlL1Njcm9sbGVyLmpzIiwic3JjL3V0aWwvREQuanMiLCJzcmMvdXRpbC9FdmVudEVtaXR0ZXIuanMiLCJzcmMvdXRpbC9GaW5kSW5kZXguanMiLCJzcmMvdXRpbC9VdGlscy5qcyIsInNyYy91dGlsL3NoaW0uanMiLCJzcmMvdXRpbC91dGlscy9Db21wYXJlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNySkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0tBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6V0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCcuLi91dGlsL0V2ZW50RW1pdHRlcicpO1xyXG52YXIgJCA9IHJlcXVpcmUoJy4uL3V0aWwvc2hpbScpLiQ7XHJcblxyXG52YXIgY3JlYXRlQ2VsbCA9IGZ1bmN0aW9uKCRyb3csIGNvbHNNb2RlbCkge1xyXG5cdHZhciBzaXplID0gY29sc01vZGVsLnNpemUoKTtcclxuXHR2YXIgY2hpbGRyZW4gPSBuZXcgTWFwKCk7XHJcblxyXG5cdGNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cclxuXHRcdGxldCBjZWxsID0gJCgnPGxpLz4nKVxyXG5cdFx0XHQuYWRkQ2xhc3MoJ2MtZ3JpZC1jZWxsJylcclxuXHRcdFx0LmFkZENsYXNzKCdjLWFsaWduLScgKyBjb2xNLmFsaWduKVxyXG5cdFx0XHQuYXR0cigndGFiaW5kZXgnLCAtMSlcclxuXHRcdFx0LndpZHRoKGNvbE0ud2lkdGgpO1xyXG5cclxuXHRcdGlmIChjb2xNLmxvY2tlZCkge1xyXG5cdFx0XHRjZWxsLmFkZENsYXNzKCdjLWNvbHVtbi1sb2NrZWQnKTtcclxuXHRcdH1cclxuXHJcblx0XHQkcm93LmFwcGVuZChjZWxsKTtcclxuXHRcdGNoaWxkcmVuLnNldChjb2xNLCBjZWxsKTtcclxuXHR9KTtcclxuXHJcblx0cmV0dXJuIGNoaWxkcmVuO1xyXG59O1xyXG5cclxuY2xhc3MgUm93Tm9kZSB7XHJcblx0Y29uc3RydWN0b3IoY29sc01vZGVsKSB7XHJcblx0XHR0aGlzLmNvbHNNb2RlbCA9IGNvbHNNb2RlbDtcclxuXHRcdHRoaXMuJG5vZGUgPSAkKCc8dWwvPicpLmFkZENsYXNzKCdjLWdyaWQtcm93Jyk7XHJcblxyXG5cdFx0dGhpcy5jaGlsZHJlbiA9IGNyZWF0ZUNlbGwodGhpcy4kbm9kZSwgY29sc01vZGVsKTtcclxuXHRcdHRoaXMuX2JpbmRFdmVudChjb2xzTW9kZWwpO1xyXG5cdH1cclxuXHJcblx0X2JpbmRFdmVudChjb2xzTW9kZWwpIHtcclxuXHRcdGNvbHNNb2RlbC5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tcmVzaXplZCcsIHdpZHRoID0+IHtcclxuXHRcdFx0XHRjb25zb2xlLmxvZyh3aWR0aCk7XHJcblx0XHRcdFx0dGhpcy5jaGlsZHJlbi5nZXQoY29sTSkub3V0ZXJXaWR0aCh3aWR0aCk7XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLWhpZGRlbicsIGlzSGlkZGVuID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jaGlsZHJlbi5nZXQoY29sTSk7XHJcblx0XHRcdFx0aWYgKGlzSGlkZGVuKSB7XHJcblx0XHRcdFx0XHRjb2xFbGUuYWRkQ2xhc3MoJ2MtY29sdW1uLWhpZGUnKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKCdjLWNvbHVtbi1oaWRlJyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1sb2NrZWQnLCBpc0xvY2tlZCA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY2hpbGRyZW4uZ2V0KGNvbE0pO1xyXG5cclxuXHRcdFx0XHRpZiAoaXNMb2NrZWQpIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcygnYy1jb2x1bW4tbG9ja2VkJyk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcygnYy1jb2x1bW4tbG9ja2VkJyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0c2V0RGF0YShyb3csIG9mZnNldFRvcCkge1xyXG5cdFx0dmFyIGNvbnRlbnQ7XHJcblx0XHR2YXIgY2VsbHMgPSB0aGlzLmNoaWxkcmVuO1xyXG5cclxuXHRcdHRoaXMuY29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblxyXG5cdFx0XHRjb250ZW50ID0gY29sTS5yZW5kZXJlcihyb3cuZGF0YVtjb2xNLmRhdGFJbmRleF0pO1xyXG5cdFx0XHRjZWxscy5nZXQoY29sTSkuaHRtbChjb250ZW50KTtcclxuXHJcblx0XHR9KTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcy4kbm9kZS5jc3MoJ3RvcCcsIG9mZnNldFRvcCkuYXR0cigncmlkJywgcm93LnJpZCk7XHJcblx0fVxyXG59XHJcblxyXG5jbGFzcyBCdWZmZXJOb2RlIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHRjb25zdHJ1Y3RvcihsaW1pdCwgY29sc01vZGVsLCB0b3RhbCwgY2FjaGVUaW1lcykge1xyXG5cdFx0c3VwZXIoKTtcclxuXHRcdHRoaXMuaW5pdChsaW1pdCwgY29sc01vZGVsLCB0b3RhbCwgY2FjaGVUaW1lcyk7XHJcblx0fVxyXG5cclxuXHRpbml0KGxpbWl0LCBjb2xzTW9kZWwsIHRvdGFsLCBjYWNoZVRpbWVzKSB7XHJcblx0XHR0aGlzLmxpbWl0ID0gbGltaXQ7XHJcblx0XHR0aGlzLnRvdGFsID0gdG90YWw7XHJcblx0XHR0aGlzLmNhY2hlVGltZXMgPSBjYWNoZVRpbWVzIHx8IDM7XHJcblx0XHR0aGlzLm5vZGVMaXN0ID0gW107XHJcblx0XHR0aGlzLmNvbHNNb2RlbCA9IGNvbHNNb2RlbDtcclxuXHR9XHJcblxyXG5cdGdldE5vZGVMaXN0KCkge1xyXG5cdFx0cmV0dXJuIHRoaXMubm9kZUxpc3Q7XHJcblx0fVxyXG5cclxuXHRzZXRMaW1pdChsaW1pdCkge1xyXG5cdFx0aWYgKCtsaW1pdCA+IDApIHtcclxuXHRcdFx0dGhpcy5pbml0KGxpbWl0LCB0aGlzLmNvbHNNb2RlbCwgdGhpcy50b3RhbCwgdGhpcy5jYWNoZVRpbWVzKTtcclxuXHRcdFx0dGhpcy5maXJlKCdidWZmZXItaW5pdGlhbCcpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0c2V0VG90YWwodG90YWwpIHtcclxuXHRcdGlmICgrdG90YWwgPj0gMCkge1xyXG5cdFx0XHR0aGlzLnRvdGFsID0gdG90YWw7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRpc0Vub3VnaCgpIHtcclxuXHRcdHJldHVybiB0aGlzLm5vZGVMaXN0Lmxlbmd0aCA+PSBNYXRoLm1pbih0aGlzLnRvdGFsLCB0aGlzLmNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHR9XHJcblxyXG5cdGdldChkaXIsIGRvbWFpbikge1xyXG5cdFx0aWYgKHRoaXMuaXNFbm91Z2goKSkge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5fZ2V0Tm9kZXMoZGlyLCBkb21haW4pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzLl9hZGROb2RlcyhkaXIsIGRvbWFpbik7XHJcblx0fVxyXG5cclxuXHRfZ2V0Tm9kZXMoZGlyLCBbc3RhcnQsIGVuZF0pIHtcclxuXHRcdHZhciBzZWxlY3RlZDtcclxuXHJcblx0XHRpZiAoZGlyID4gMCkge1xyXG5cdFx0XHRzZWxlY3RlZCA9IHRoaXMubm9kZUxpc3Quc2xpY2UoMCwgZW5kIC0gc3RhcnQgKyAxKTtcclxuXHRcdFx0dGhpcy5ub2RlTGlzdCA9IHRoaXMubm9kZUxpc3Quc2xpY2UoZW5kIC0gc3RhcnQgKyAxKS5jb25jYXQoc2VsZWN0ZWQpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0c2VsZWN0ZWQgPSB0aGlzLm5vZGVMaXN0LnNsaWNlKHN0YXJ0IC0gZW5kIC0gMSk7XHJcblx0XHRcdHRoaXMubm9kZUxpc3QgPSBzZWxlY3RlZC5jb25jYXQodGhpcy5ub2RlTGlzdC5zbGljZSgwLCBzdGFydCAtIGVuZCAtIDEpKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gc2VsZWN0ZWQgfHwgW107XHJcblx0fVxyXG5cclxuXHRfYWRkTm9kZXMoZGlyLCBbc3RhcnQsIGVuZF0pIHtcclxuXHRcdHZhciBub2RlcyA9IFtdO1xyXG5cclxuXHRcdGZvciAodmFyIGkgPSBzdGFydDsgaSA8PSBlbmQ7IGkrKykge1xyXG5cdFx0XHRub2Rlcy5wdXNoKG5ldyBSb3dOb2RlKHRoaXMuY29sc01vZGVsKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5ub2RlTGlzdCA9IGRpciA+IDAgPyB0aGlzLm5vZGVMaXN0LmNvbmNhdChub2RlcykgOiBub2Rlcy5jb25jYXQodGhpcy5ub2RlTGlzdCk7XHJcblxyXG5cdFx0cmV0dXJuIG5vZGVzO1xyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBCdWZmZXJOb2RlO1xyXG4iLCJjbGFzcyBCdWZmZXJab25lIHtcclxuXHRjb25zdHJ1Y3RvcihsaW1pdCwgdG90YWwsIGNhY2hlVGltZXMpIHtcclxuXHRcdHRoaXMuaW5pdChsaW1pdCwgdG90YWwsIGNhY2hlVGltZXMpO1xyXG5cdH1cclxuXHJcblx0aW5pdChsaW1pdCwgdG90YWwsIGNhY2hlVGltZXMpIHtcclxuXHRcdHRoaXMuc3RhcnQgPSAwO1xyXG5cdFx0dGhpcy5lbmQgPSB0aGlzLmxpbWl0ID0gbGltaXQ7XHJcblx0XHR0aGlzLnRvdGFsID0gK3RvdGFsO1xyXG5cdFx0dGhpcy5jYWNoZVRpbWVzID0gY2FjaGVUaW1lcyB8fCAzO1xyXG5cdFx0dGhpcy5kb21haW4gPSBbdGhpcy5zdGFydCwgdGhpcy5lbmRdO1xyXG5cdH1cclxuXHJcblx0c2V0TGltaXQobGltaXQpIHtcclxuXHRcdGlmICgrbGltaXQgPiAwKSB7XHJcblx0XHRcdHRoaXMuaW5pdChsaW1pdCwgdGhpcy50b3RhbCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRzZXRUb3RhbCh0b3RhbCkge1xyXG5cdFx0aWYgKCt0b3RhbCA+PSAwKSB7XHJcblx0XHRcdHRoaXMudG90YWwgPSB0b3RhbDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlzQW1vbmcodmFsdWUpIHtcclxuXHRcdHJldHVybiB0aGlzLnN0YXJ0IDw9IHZhbHVlICYmIHZhbHVlIDw9IHRoaXMuZW5kO1xyXG5cdH1cclxuXHJcblx0c2hvdWxkTG9hZChkaXIsIHZlcm5pZXIpIHtcclxuXHRcdGlmIChkaXIgPT09IDApIHJldHVybiBmYWxzZTtcclxuXHJcblx0XHR2YXIgc3RhcnQgPSB0aGlzLnN0YXJ0O1xyXG5cdFx0dmFyIGVuZCA9IHRoaXMuZW5kO1xyXG5cdFx0dmFyIGNhY2hlVGltZXMgPSB0aGlzLmNhY2hlVGltZXM7XHJcblxyXG5cdFx0Ly8gc2Nyb2xsIHVwXHJcblx0XHRpZiAoZGlyIDwgMCAmJiBzdGFydCA9PT0gMCkgcmV0dXJuIGZhbHNlO1xyXG5cdFx0aWYgKGRpciA8IDAgJiYgdmVybmllciA8IHN0YXJ0ICsgdGhpcy5saW1pdCkge1xyXG5cdFx0XHRpZiAodGhpcy5pc0Ftb25nKHZlcm5pZXIpKSB7XHJcblx0XHRcdFx0ZW5kID0gc3RhcnQgLSAxO1xyXG5cdFx0XHRcdHN0YXJ0ID0gTWF0aC5tYXgoMCwgZW5kIC0gdGhpcy5saW1pdCk7XHJcblx0XHRcdH0gZWxzZSBpZiAodmVybmllciA9PT0gMCkge1xyXG5cdFx0XHRcdGVuZCA9IE1hdGgubWluKHRoaXMudG90YWwsIHZlcm5pZXIgKyBjYWNoZVRpbWVzICogdGhpcy5saW1pdCk7XHJcblx0XHRcdFx0c3RhcnQgPSAwO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGVuZCA9IHZlcm5pZXIgKyB0aGlzLmxpbWl0O1xyXG5cdFx0XHRcdHN0YXJ0ID0gTWF0aC5tYXgoMCwgdmVybmllciAtIChjYWNoZVRpbWVzIC0gMSkgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5kb21haW4gPSBbc3RhcnQsIGVuZF07XHJcblx0XHRcdHRoaXMuc3RhcnQgPSBzdGFydDtcclxuXHRcdFx0dGhpcy5lbmQgPSBNYXRoLm1pbihzdGFydCArIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0LCB0aGlzLmVuZCk7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIHNjcm9sbCBkb3duXHJcblx0XHRpZiAoZGlyID4gMCAmJiBlbmQgPT09IHRoaXMudG90YWwpIHJldHVybiBmYWxzZTtcclxuXHRcdGlmIChkaXIgPiAwICYmIHZlcm5pZXIgPiBlbmQgLSB0aGlzLmxpbWl0KSB7XHJcblx0XHRcdC8vIOa4uOagh+WcqOeOsOacieiMg+WbtOWGhVxyXG5cdFx0XHRpZiAodGhpcy5pc0Ftb25nKHZlcm5pZXIpKSB7XHJcblx0XHRcdFx0c3RhcnQgPSBlbmQgKyAxO1xyXG5cdFx0XHRcdGVuZCA9IE1hdGgubWluKHRoaXMudG90YWwsIHN0YXJ0ICsgdGhpcy5saW1pdCk7XHJcblx0XHRcdH1cclxuXHRcdFx0Ly8g5ri45qCH5Yiw6L6+57uT5bC+XHJcblx0XHRcdGVsc2UgaWYgKHZlcm5pZXIgPT09IHRoaXMudG90YWwpIHtcclxuXHRcdFx0XHRlbmQgPSB0aGlzLnRvdGFsO1xyXG5cdFx0XHRcdHN0YXJ0ID0gTWF0aC5tYXgoMCwgdmVybmllciAtIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvLyDkuI3lnKjnjrDmnInojIPlm7Tlj4jmnKrliLDnu5PlsL7lpIRcclxuXHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0ZW5kID0gTWF0aC5taW4odGhpcy50b3RhbCwgdmVybmllciArIChjYWNoZVRpbWVzIC0gMSkgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0XHRzdGFydCA9IE1hdGgubWF4KDAsIGVuZCAtIGNhY2hlVGltZXMgKiB0aGlzLmxpbWl0KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5kb21haW4gPSBbc3RhcnQsIGVuZF07XHJcblx0XHRcdHRoaXMuZW5kID0gZW5kO1xyXG5cdFx0XHR0aGlzLnN0YXJ0ID0gTWF0aC5tYXgodGhpcy5zdGFydCwgZW5kIC0gY2FjaGVUaW1lcyAqIHRoaXMubGltaXQpO1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBCdWZmZXJab25lOyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCcuLi91dGlsL0V2ZW50RW1pdHRlcicpO1xyXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuLi91dGlsL1V0aWxzJyk7XHJcbnZhciBfID0gcmVxdWlyZSgnLi4vdXRpbC9zaGltJykuXztcclxuXHJcbnZhciBkZWZSZW5kZXJlciA9IHYgPT4gdjtcclxudmFyIE9SREVSID0gWydBU0MnLCAnREVTQyddO1xyXG5cclxuY2xhc3MgQ29sdW1uIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHRjb25zdHJ1Y3RvcihjaWQsIG9wdGlvbnMsIGNvbnRleHQpIHtcclxuXHRcdHN1cGVyKCk7XHJcblxyXG5cdFx0b3B0aW9ucy5yZW5kZXJlciA9IG9wdGlvbnMucmVuZGVyZXIgfHwgZGVmUmVuZGVyZXI7XHJcblxyXG5cdFx0dmFyIGRlZmF1bHRzID0ge1xyXG5cdFx0XHQndGV4dCc6ICcnLFxyXG5cdFx0XHQndnR5cGUnOiAnc3RyaW5nJyxcclxuXHRcdFx0J2RhdGFJbmRleCc6ICcnLFxyXG5cdFx0XHQnd2lkdGgnOiA1MCxcclxuXHRcdFx0J2FsaWduJzogJ2xlZnQnLFxyXG5cclxuXHRcdFx0J3Jlc2l6YWJsZSc6IHRydWUsXHJcblx0XHRcdCdjbHMnOiAnJyxcclxuXHRcdFx0J2ZpeGVkJzogZmFsc2UsXHJcblx0XHRcdCdkcmFnZ2FibGUnOiBmYWxzZSxcclxuXHRcdFx0J3NvcnRhYmxlJzogdHJ1ZSxcclxuXHRcdFx0J2hpZGRlbic6IGZhbHNlLFxyXG5cdFx0XHQnbG9ja2VkJzogZmFsc2UsXHJcblx0XHRcdCdsb2NrYWJsZSc6IHRydWUsXHJcblx0XHRcdCdtZW51RGlzYWJsZWQnOiB0cnVlLFxyXG5cclxuXHRcdFx0J3NvcnRTdGF0ZSc6IG51bGxcclxuXHRcdH07XHJcblxyXG5cdFx0dGhpcy5jaWQgPSBjaWQ7XHJcblx0XHR0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xyXG5cdFx0T2JqZWN0LmFzc2lnbih0aGlzLCBkZWZhdWx0cywgb3B0aW9ucyk7XHJcblx0fVxyXG5cclxuXHRzZXRXaWR0aChudW0pIHtcclxuXHRcdGlmICghdGhpcy5yZXNpemFibGUpIHJldHVybjtcclxuXHRcdGlmIChpc05hTihudW0pKSByZXR1cm47XHJcblxyXG5cdFx0dGhpcy53aWR0aCA9ICtudW07XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1yZXNpemVkJywgdGhpcy53aWR0aCwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHRzaG93KCkge1xyXG5cdFx0dGhpcy5oaWRkZW4gPSBmYWxzZTtcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLWhpZGRlbicsIHRoaXMuaGlkZGVuLCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdGhpZGUoKSB7XHJcblx0XHR0aGlzLnVuTG9jaygpO1xyXG5cdFx0XHJcblx0XHR0aGlzLmhpZGRlbiA9IHRydWU7XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1oaWRkZW4nLCB0aGlzLmhpZGRlbiwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHR0b2dnbGUoKSB7XHJcblx0XHRpZiAodGhpcy5oaWRkZW4pIHtcclxuXHRcdFx0dGhpcy5zaG93KCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aGlzLmhpZGUoKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGxvY2soKSB7XHJcblx0XHRpZiAoIXRoaXMubG9ja2FibGUpIHJldHVybjtcclxuXHRcdGlmICh0aGlzLmxvY2tlZCkgcmV0dXJuO1xyXG5cclxuXHRcdHRoaXMuc2hvdygpO1xyXG5cclxuXHRcdHRoaXMubG9ja2VkID0gdHJ1ZTtcclxuXHRcdHRoaXMuZmlyZSgnY29sdW1uLWxvY2tlZCcsIHRoaXMubG9ja2VkLCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdHVuTG9jaygpIHtcclxuXHRcdGlmICghdGhpcy5sb2NrYWJsZSkgcmV0dXJuO1xyXG5cdFx0aWYgKCF0aGlzLmxvY2tlZCkgcmV0dXJuO1xyXG5cclxuXHRcdHRoaXMubG9ja2VkID0gZmFsc2U7XHJcblx0XHR0aGlzLmZpcmUoJ2NvbHVtbi1sb2NrZWQnLCB0aGlzLmxvY2tlZCwgdGhpcyk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBvcmRlcltBU0MsIERFU0MsIE5PX1NPUlRdXHJcblx0ICovXHJcblx0c29ydChvcmRlcikge1xyXG5cdFx0aWYgKCF0aGlzLnNvcnRhYmxlIHx8ICF0aGlzLmRhdGFJbmRleCkgcmV0dXJuO1xyXG5cclxuXHRcdGlmIChvcmRlcikge1xyXG5cdFx0XHR0aGlzLnNvcnRTdGF0ZSA9IE9SREVSLmluY2x1ZGVzKG9yZGVyKSA/IG9yZGVyIDogbnVsbDtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoaXMuc29ydFN0YXRlID0gdGhpcy5zb3J0U3RhdGUgPT09IE9SREVSWzFdID8gT1JERVJbMF0gOiBPUkRFUlsxXTtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0dGhpcy5maXJlKCdjb2x1bW4tc29ydC1jaGFuZ2VkJywgdGhpcy5zb3J0U3RhdGUpO1xyXG5cdFx0dGhpcy5jb250ZXh0LmZpcmUoJ25vdGljZS1jb2xNb2RlbC1zb3J0LWNoYW5nZWQnKTtcclxuIFx0fVxyXG59XHJcblxyXG5cclxuY2xhc3MgQ29sTW9kZWwgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cdGNvbnN0cnVjdG9yKGNvbHVtbnMpIHtcclxuXHRcdHN1cGVyKCk7XHJcblxyXG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KGNvbHVtbnMpKSB7XHJcblx0XHRcdHRocm93ICdyZXF1aXJlIHByb3BlcnR5IGNvbHVtbnMgaXMgYSBhcnJheSBvYmplY3QnO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuY29sdW1ucyA9IFtdOyAvLyBkYXRhIGJ5IGNvbHVtblxyXG5cdFx0dGhpcy5jb2xNb2RlbCA9IG5ldyBNYXAoKTsgLy8gZGF0YSBieSBjaWRcclxuXHRcdHRoaXMuY29sSGVhZGVycyA9IG5ldyBNYXAoKTsgLy8gZGF0YSBieSBkYXRhSW5kZXhcclxuXHJcblx0XHRjb2x1bW5zLmZvckVhY2goKGNvbCwgaW5kZXgpID0+IHtcclxuXHRcdFx0bGV0IGNpZCA9IGluZGV4O1xyXG5cdFx0XHRsZXQgY29sTSA9IG5ldyBDb2x1bW4oY2lkLCBjb2wsIHRoaXMpO1xyXG5cclxuXHRcdFx0dGhpcy5jb2xNb2RlbC5zZXQoY2lkLCBjb2xNKTtcclxuXHRcdFx0dGhpcy5jb2x1bW5zLnB1c2goY29sTSk7XHJcblx0XHRcdHRoaXMuY29sSGVhZGVycy5zZXQoY29sLmRhdGFJbmRleCwgY29sTSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLl9iaW5kRXZlbnQoKTtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblx0XHR0aGlzLm9uKCdub3RpY2UtY29sTW9kZWwtc29ydC1jaGFuZ2VkJywgXy5kZWJvdW5jZSgoKSA9PiB7XHJcblx0XHRcdHRoaXMuZmlyZSgnY29sdW1ucy1zb3J0LWNoYW5nZWQnKTtcclxuXHRcdH0sIDIwKSk7XHJcblx0fVxyXG5cclxuXHRzaXplKCkgeyBcclxuXHRcdHJldHVybiB0aGlzLmNvbE1vZGVsLnNpemU7IFxyXG5cdH1cclxuXHJcblx0Z2V0Q29sdW1uKGNvbCkge1xyXG5cdFx0aWYgKHRoaXMuY29sdW1ucy5pbmNsdWRlcyhjb2wpKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLmNvbHVtbnMuZmlsdGVyKF9jb2wgPT4gX2NvbCA9PSBjb2wpWzBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzLmNvbHVtbnM7XHJcblx0fVxyXG5cclxuXHRnZXRMb2NrQ29sdW1uKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuY29sdW1ucy5maWx0ZXIoY29sTSA9PiB7XHJcblx0XHRcdHJldHVybiBjb2xNLmxvY2tlZCA9PT0gdHJ1ZTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0Z2V0VmlzaWJsZUNvbHVtbigpIHtcclxuXHRcdHJldHVybiB0aGlzLmNvbHVtbnMuZmlsdGVyKGNvbE0gPT4ge1xyXG5cdFx0XHRyZXR1cm4gIWNvbE0uaGlkZGVuO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRnZXRDb2x1bW5CeURhdGFJbmRleChkYXRhSW5kZXgpIHtcclxuXHRcdHJldHVybiB0aGlzLmNvbEhlYWRlcnMuZ2V0KGRhdGFJbmRleCkgfHwgbnVsbDtcclxuXHR9XHJcblxyXG5cdGdldENvbHVtbnNCeUlkKGlkKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5jb2xNb2RlbFtpZF0gfHwgbnVsbDtcclxuXHR9XHJcblxyXG5cdGVhY2goY2FsbGJhY2ssIGNvbnRleHQpIHtcclxuXHRcdHRoaXMuY29sdW1ucy5mb3JFYWNoKGNhbGxiYWNrLCBjb250ZXh0IHx8IHRoaXMpO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHsgXHJcblxyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBDb2xNb2RlbDsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi4vdXRpbC9FdmVudEVtaXR0ZXInKTtcclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbC9VdGlscycpO1xyXG52YXIgXyA9IHJlcXVpcmUoJy4uL3V0aWwvc2hpbScpLl87XHJcblxyXG5jbGFzcyBSb3cge1xyXG5cdGNvbnN0cnVjdG9yKHJpZCwgZGF0YSkge1xyXG5cdFx0dGhpcy5yaWQgPSByaWQ7XHJcblx0XHR0aGlzLmRhdGEgPSBkYXRhO1xyXG5cdFx0dGhpcy5zZWxlY3RlZCA9IGZhbHNlO1xyXG5cdH1cclxuXHRzdGF0ZSgpIHt9XHJcbn1cclxuXHJcbmNsYXNzIEdyaWRTdG9yZSBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblxyXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcclxuXHRcdHN1cGVyKCk7XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwgPSBvcHRpb25zLmNvbHVtbk1vZGVsO1xyXG5cclxuXHRcdHRoaXMucm93cyA9IFtdOyAvLyBkYXRhIGJ5IGluZGV4XHJcblx0XHR0aGlzLnJvd01vZGVsID0gbmV3IE1hcCgpOyAvLyBkYXRhIGJ5IGlkXHJcblxyXG5cclxuXHRcdHRoaXMuc2V0RGF0YShvcHRpb25zLmRhdGEpO1xyXG5cclxuXHRcdHRoaXMuX3NvcnRTdGF0ZSA9IHsga2V5czogW10sIGRpcnM6IFtdIH07XHJcblx0XHR0aGlzLl9iaW5kRXZlbnQoKTtcclxuXHR9XHJcblxyXG5cdF9iaW5kRXZlbnQoKSB7XHJcblxyXG5cdFx0dGhpcy5jb2xzTW9kZWwuZWFjaChjb2xNID0+IHtcclxuXHRcdFx0Y29sTS5vbignY29sdW1uLXNvcnQtY2hhbmdlZCcsIHNvcnRTdGF0ZSA9PiB7XHJcblx0XHRcdFx0bGV0IHsga2V5cywgZGlycyB9ID0gdGhpcy5fc29ydFN0YXRlO1xyXG5cdFx0XHRcdGxldCBpbmRleCA9IGtleXMuaW5kZXhPZihjb2xNLmRhdGFJbmRleCk7XHJcblxyXG5cdFx0XHRcdC8vIOacquaOkuW6j1xyXG5cdFx0XHRcdGlmIChpbmRleCA9PT0gLTEgJiYgIXNvcnRTdGF0ZSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKGluZGV4ID09PSAtMSAmJiBzb3J0U3RhdGUpIHtcclxuXHRcdFx0XHRcdGtleXMudW5zaGlmdChjb2xNLmRhdGFJbmRleCk7XHJcblx0XHRcdFx0XHRkaXJzLnVuc2hpZnQoc29ydFN0YXRlLnRvTG93ZXJDYXNlKCkpO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8g5bey5o6S5bqPLOWFiOWIoOmZpFxyXG5cdFx0XHRcdGxldCBrZXkgPSBrZXlzLnNwbGljZShpbmRleCwgMSlbMF07XHJcblx0XHRcdFx0bGV0IGRpciA9IGRpcnMuc3BsaWNlKGluZGV4LCAxKVswXTtcclxuXHJcblx0XHRcdFx0aWYgKHNvcnRTdGF0ZSkge1xyXG5cdFx0XHRcdFx0a2V5cy51bnNoaWZ0KGtleSk7XHJcblx0XHRcdFx0XHRkaXJzLnVuc2hpZnQoc29ydFN0YXRlLnRvTG93ZXJDYXNlKCkpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Ly8g5omA5pyJ5YiX6YO95pu05paw54q25oCB5ZCOXHJcblx0XHR0aGlzLmNvbHNNb2RlbC5vbignY29sdW1ucy1zb3J0LWNoYW5nZWQnLCAoKSA9PiB7XHJcblx0XHRcdGxldCB7IGtleXMsIGRpcnMgfSA9IHRoaXMuX3NvcnRTdGF0ZTtcclxuXHRcdFx0bGV0IGl0ZXJhdGVGbiA9IHJvdyA9PiByb3cuZGF0YVtrZXlzWzBdXTtcclxuXHJcblx0XHRcdGNvbnNvbGUubG9nKGtleXMsIGRpcnMpO1xyXG5cclxuXHRcdFx0dGhpcy5yb3dzID0gXy5vcmRlckJ5KHRoaXMucm93cywgaXRlcmF0ZUZuLCBkaXJzKTtcclxuXHRcdFx0dGhpcy5zZXREYXRhKF8ubWFwKHRoaXMucm93cywgJ2RhdGEnKSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdHNsaWNlKHN0YXJ0LCBlbmQpIHtcclxuXHRcdHJldHVybiB0aGlzLnJvd3Muc2xpY2Uoc3RhcnQsIGVuZCk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiDorr7nva7mjpLluo/nirbmgIFcclxuXHQgKiAoKylBU0MsIC1ERVNDLCAhTk9fU09SVFxyXG5cdCAqIEBzb3J0cyB7QXJyYXl9IHNvcnRzIC3mjpLluo/nirbmgIHmlbDnu4RcclxuXHQgKlx0c29ydHMgPSBbJytjb2xBJywgJ2NvbEInLCAnLWNvbEMnLCAnIWNvbEQnXVxyXG5cdCAqIEByZXR1cm5zIHRoaXM7XHJcblx0ICovXHJcblx0c2V0U29ydFN0YXRlKHNvcnRzKSB7XHJcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoc29ydHMpKSB7XHJcblx0XHRcdHNvcnRzID0gW3NvcnRzXTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLl9zb3J0U3RhdGUgPSB7IGtleXM6IFtdLCBkaXJzOiBbXSB9O1xyXG5cclxuXHRcdC8vIOWPjei9rOS8mOWFiOe6p+aWueS+v+WQjue7reinpuWPkemhuuW6j+aXtuWQjuinpuWPkeeahOS8mOWFiOe6p+mrmFxyXG5cdFx0c29ydHMucmV2ZXJzZSgpLmVhY2goc29ydE9iaiA9PiB7XHJcblx0XHRcdGxldCBvYmosIGtleSwgZGlyLCBjb2w7XHJcblxyXG5cdFx0XHRpZiAodHlwZW9mIHNvcnRPYmogPT09ICdzdHJpbmcnKSB7XHJcblx0XHRcdFx0b2JqID0gc29ydE9iai5tYXRjaCgvKF5bK3wtfCFdPykoLnswLH0pLyk7XHJcblx0XHRcdFx0ZGlyID0gb2JqWzFdID09PSAnJyA/ICdBU0MnIDogKG9iaiA9PT0gJy0nID8gJ0RFU0MnIDogJ05PX1NPUlQnKTtcclxuXHRcdFx0XHRrZXkgPSBvYmpbMl0gPyBvYmpbMl0gOiBudWxsO1xyXG5cclxuXHRcdFx0XHRjb2wgPSB0aGlzLmNvbHNNb2RlbC5nZXRDb2x1bW5CeURhdGFJbmRleChrZXkpO1xyXG5cdFx0XHRcdGlmIChjb2wpIHtcclxuXHRcdFx0XHRcdGNvbC5zb3J0KGRpcik7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdHNldERhdGEoZGF0YSA9IFtdLCBhcHBlbmQgPSBmYWxzZSkge1xyXG5cdFx0aWYgKCFhcHBlbmQpIHtcclxuXHRcdFx0dGhpcy5yb3dzLmxlbmd0aCA9IDA7XHJcblx0XHRcdHRoaXMucm93TW9kZWwuY2xlYXIoKTtcclxuXHRcdH1cclxuXHRcdHZhciBpbmRleCA9IHRoaXMuc2l6ZSgpO1xyXG5cdFx0ZGF0YS5mb3JFYWNoKChyb3csIHJpZHgpID0+IHtcclxuXHRcdFx0bGV0IHJvd00gPSBuZXcgUm93KHJpZHggKyBpbmRleCwgcm93KTtcclxuXHRcdFx0dGhpcy5yb3dzLnB1c2gocm93TSk7XHJcblx0XHRcdHRoaXMucm93TW9kZWwuc2V0KHJpZHggKyBpbmRleCwgcm93TSk7XHJcblx0XHR9KTtcclxuXHRcdHRoaXMuZmlyZSgnZGF0YS1jaGFuZ2VkJywgYXBwZW5kKTtcclxuXHR9XHJcblxyXG5cdGZvckVhY2goY2FsbGJhY2ssIGNvbnRleHQpIHtcclxuXHRcdHRoaXMucm93cy5mb3JFYWNoKGZ1bmN0aW9uKHJvd00sIHJpZHgpIHtcclxuXHRcdFx0Y2FsbGJhY2suY2FsbCh0aGlzLCByb3dNLmRhdGEsIHJpZHgpO1xyXG5cdFx0fSwgY29udGV4dCB8fCB0aGlzKTtcclxuXHR9XHJcblxyXG5cdHNpemUoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yb3dNb2RlbC5zaXplO1xyXG5cdH1cclxuXHJcblx0ZGVzdG9yeSgpIHsgXHJcblxyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBHcmlkU3RvcmU7IiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJy4uL3V0aWwvRXZlbnRFbWl0dGVyJyk7XHJcbnZhciBDb2xNb2RlbCA9IHJlcXVpcmUoJy4vQ29sTW9kZWwnKTtcclxudmFyIEdyaWRTdG9yZSA9IHJlcXVpcmUoJy4vR3JpZFN0b3JlJyk7XHJcbnZhciBCdWZmZXJOb2RlID0gcmVxdWlyZSgnLi9CdWZmZXJOb2RlJyk7XHJcbnZhciBCdWZmZXJab25lID0gcmVxdWlyZSgnLi9CdWZmZXJab25lJyk7XHJcbnZhciBIZWFkZXIgPSByZXF1aXJlKCcuL0hlYWRlcicpO1xyXG52YXIgTG9ja0NvbE1hbmFnZXIgPSByZXF1aXJlKCcuL0xvY2tDb2xNYW5hZ2VyJyk7XHJcbnZhciBTY3JvbGxlciA9IHJlcXVpcmUoJy4vU2Nyb2xsZXInKTtcclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbC9VdGlscycpO1xyXG5cclxuZnVuY3Rpb24gY3JlYXRlTGF5b3V0KGNvbnRhaW5lciwgd2lkdGgpIHtcclxuXHR2YXIgd3JhcHBlciA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWdyaWQtd3JhcHBlcicpLndpZHRoKHdpZHRoKTtcclxuXHR2YXIgaGVhZGVyID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC1oZWFkZXInKTtcclxuXHR2YXIgYm9keSA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWdyaWQtYm9keScpO1xyXG5cdHZhciB2aWV3cG9ydCA9ICQoJzxkaXYvPicpLmFkZENsYXNzKCdjLWdyaWQtdmlld3BvcnQnKS5hcHBlbmRUbyhib2R5KTtcclxuXHR2YXIgY2FudmFzID0gJCgnPGRpdi8+JykuYWRkQ2xhc3MoJ2MtZ3JpZC1jYW52YXMnKS5hcHBlbmRUbyh2aWV3cG9ydCk7XHJcblx0d3JhcHBlci5hcHBlbmQoaGVhZGVyKS5hcHBlbmQoYm9keSkuYXBwZW5kVG8oY29udGFpbmVyKTtcclxuXHJcblx0cmV0dXJuIHsgd3JhcHBlciwgaGVhZGVyLCBib2R5LCB2aWV3cG9ydCwgY2FudmFzIH07XHJcbn1cclxuZnVuY3Rpb24gY2FsY1Jvd0hlaWdodCgpIHtcclxuXHR2YXIgbGkgPSAkKCc8bGkgY2xhc3M9XCJjLWdyaWQtY2VsbFwiPnBsYWNlaG9sZGVyPC9saT4nKS5hcHBlbmRUbyhcImJvZHlcIik7XHJcblx0dmFyIHJvd0hlaWdodCA9IGxpLm91dGVySGVpZ2h0KCk7XHJcblx0bGkucmVtb3ZlKCk7XHJcblxyXG5cdHJldHVybiByb3dIZWlnaHQ7XHJcbn1cclxuXHJcbmNsYXNzIEdyaWRDb21wb25lbnQgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcclxuXHRcdHN1cGVyKCk7XHJcblxyXG5cdFx0aWYgKCEkKG9wdGlvbnMuZG9tRWwpLnNpemUoKSkgeyB0aHJvdyAncmVxdWlyZSBhIHZhbGlkIGRvbUVsJzsgfVxyXG5cclxuXHRcdHRoaXMuc2hvdWxkQWRkTm9kZXMgPSB0cnVlO1xyXG5cdFx0dGhpcy5oZWlnaHQgPSArb3B0aW9ucy5oZWlnaHQgfHwgNTAwO1xyXG5cdFx0dGhpcy53aWR0aCA9IG9wdGlvbnMud2lkdGg7XHJcblxyXG5cdFx0Ly8gJGxheW91dCBkb21cclxuXHRcdE9iamVjdC5hc3NpZ24odGhpcy4kZG9tID0ge30sIGNyZWF0ZUxheW91dCgkKG9wdGlvbnMuZG9tRWwpLCB0aGlzLndpZHRoKSk7XHJcblxyXG5cdFx0dGhpcy5jb2x1bW5Nb2RlbCA9IG5ldyBDb2xNb2RlbChvcHRpb25zLmNvbHVtbnMpO1xyXG5cdFx0dGhpcy5zdG9yZSA9IG5ldyBHcmlkU3RvcmUoeyBjb2x1bW5Nb2RlbDogdGhpcy5jb2x1bW5Nb2RlbCwgJ2RhdGEnOiBvcHRpb25zLmRhdGEgfHwgW10gfSk7XHJcblx0XHR0aGlzLl9pbml0KCk7XHJcblx0XHR0aGlzLl9iaW5kRXZlbnQoKTtcclxuXHR9XHJcblxyXG5cdF9pbml0KCkge1xyXG5cdFx0dGhpcy5oZWFkZXIgPSBuZXcgSGVhZGVyKHRoaXMuJGRvbS5oZWFkZXIsIHRoaXMuY29sdW1uTW9kZWwsIHRoaXMuc3RvcmUpO1xyXG5cdFx0dmFyIHRvdGFsID0gdGhpcy5zdG9yZS5zaXplKCk7XHJcblx0XHR2YXIgcm93SGVpZ2h0ID0gdGhpcy5yb3dIZWlnaHQgPSBjYWxjUm93SGVpZ2h0KCk7XHJcblx0XHR2YXIgdmlld3BvcnRIZWlnaHQgPSB0aGlzLmhlaWdodCAtIHRoaXMuJGRvbS5oZWFkZXIub3V0ZXJIZWlnaHQoKTtcclxuXHRcdHZhciBzaW5nbGVQYWdlU2l6ZSA9IE1hdGgubWluKE1hdGguY2VpbCh2aWV3cG9ydEhlaWdodC8gcm93SGVpZ2h0KSAtIDEsIHRvdGFsIC0gMSk7XHJcblxyXG5cdFx0dGhpcy5idWZmZXJab25lID0gbmV3IEJ1ZmZlclpvbmUoc2luZ2xlUGFnZVNpemUsIHRvdGFsKTtcclxuXHRcdHRoaXMuYnVmZmVyTm9kZSA9IG5ldyBCdWZmZXJOb2RlKHNpbmdsZVBhZ2VTaXplLCB0aGlzLmNvbHVtbk1vZGVsLCB0b3RhbCk7XHJcblx0XHR0aGlzLnNjcm9sbGVyID0gbmV3IFNjcm9sbGVyKHJvd0hlaWdodCwgdGhpcy5idWZmZXJab25lKTtcclxuXHRcdHRoaXMuc2Nyb2xsZXJcclxuXHRcdFx0Lm9uWCh4ID0+IHtcclxuXHRcdFx0XHR0aGlzLmZpcmUoJ3Njcm9sbExlZnQnLCB4KTtcclxuXHRcdFx0XHR0aGlzLiRkb20uaGVhZGVyLnNjcm9sbExlZnQoeCk7XHJcblx0XHRcdH0pXHJcblx0XHRcdC5vblkoKGRpciwgZG9tYWluLCBzdGFydCwgZW5kLCBpbmRleCwgdG90YWwpID0+IHtcclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyhg5rua5Yqo5pa55ZCR77yaJHtkaXJ9LCDliqDovb3ljLrpl7Q6IFske2RvbWFpbn1dLCDnjrDmnInojIPlm7TvvJooJHtzdGFydH0gLSAke2VuZH0pLCBgKVxyXG5cdFx0XHRcdHRoaXMuX2J1ZmZlclJlbmRlcihkaXIsIGRvbWFpbik7XHJcblx0XHRcdH0sIDYwKTtcclxuXHJcblx0XHR0aGlzLiRkb20udmlld3BvcnQuaGVpZ2h0KHZpZXdwb3J0SGVpZ2h0KTtcclxuXHRcdHRoaXMuJGRvbS52aWV3cG9ydC5vbignc2Nyb2xsJywgKGV2dCkgPT4ge1xyXG5cdFx0XHR0aGlzLnNjcm9sbGVyLmZpcmVZKGV2dC50YXJnZXQuc2Nyb2xsVG9wKTtcclxuXHRcdFx0dGhpcy5zY3JvbGxlci5maXJlWChldnQudGFyZ2V0LnNjcm9sbExlZnQpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5sb2NrQ29sTWFuYWdlciA9IExvY2tDb2xNYW5hZ2VyKHRoaXMuY29sdW1uTW9kZWwsIHRoaXMuaGVhZGVyLCB0aGlzLiRkb20sIHRoaXMuYnVmZmVyTm9kZSk7XHJcblx0XHR0aGlzLl9zZXRDYW52YXNXSCh0b3RhbCk7XHJcblx0fVxyXG5cclxuXHRfc2V0Q2FudmFzV0godG90YWwpIHtcclxuXHRcdHRoaXMuJGRvbS5jYW52YXNcclxuXHRcdFx0LndpZHRoKHRvdGFsID8gJ2F1dG8nIDogdGhpcy5fdW5Mb2NrVmlzaWJsZUNvbHNXaWR0aCgpKVxyXG5cdFx0XHQuaGVpZ2h0KHRoaXMucm93SGVpZ2h0ICogdG90YWwgfHwgMSk7XHJcblx0fVxyXG5cclxuXHRfdW5Mb2NrVmlzaWJsZUNvbHNXaWR0aCgpIHtcclxuXHRcdHJldHVybiB0aGlzLmhlYWRlci5nZXRWaXNpYmxlQ29sc1dpZHRoKCkgKyB0aGlzLmxvY2tDb2xNYW5hZ2VyLnZpc2libGVMb2NrQ29sdW1uLmdldFdpZHRoKCk7XHJcblx0fVxyXG5cclxuXHRzY3JvbGxUb1RvcChwb3NpdGlvbikge1xyXG5cdFx0dGhpcy4kZG9tLnZpZXdwb3J0LnNjcm9sbFRvcChwb3NpdGlvbik7XHJcblx0fVxyXG5cclxuXHRfYmluZEV2ZW50KCkge1xyXG5cdFx0dGhpcy5vbigndmlld3BvcnQtaGVpZ2h0LWNoYW5nZWQnLCB2aWV3cG9ydEhlaWdodCA9PiB7XHJcblx0XHRcdHRoaXMuX3VwZGF0ZUJ1ZmZlcigpO1xyXG5cdFx0XHR0aGlzLnJlbmRlcigpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5vbignc2Nyb2xsTGVmdCcsIHggPT4ge1xyXG5cdFx0XHQvLyBwZXJmb3JtYW5jZSBUT0RPXHJcblx0XHRcdC8vIGxldCBsb2NrQ29sdW1uV2lkdGggPSB0aGlzLmhlYWRlci5nZXRWaXNpYmxlTG9ja0NvbHNXaWR0aCgpO1xyXG5cdFx0XHQvLyB0aGlzLiRkb20uY2FudmFzLmZpbmQoJy5jLWNvbHVtbi1sb2NrZWQnKS5jc3MoJ2xlZnQnLCB4IC0gbG9ja0NvbHVtbldpZHRoKTtcclxuXHRcdFx0Ly8gdGhpcy4kZG9tLmhlYWRlci5maW5kKCcuYy1jb2x1bW4tbG9ja2VkJykuY3NzKCdsZWZ0JywgeCAtIGxvY2tDb2x1bW5XaWR0aCk7XHJcblx0XHRcdHRoaXMubG9ja0NvbE1hbmFnZXIuc2V0TG9ja0NvbHVtblgoeCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLnN0b3JlLm9uKCdkYXRhLWNoYW5nZWQnLCAoYXBwZW5kKSA9PiB7XHJcblx0XHRcdGxldCB0b3RhbCA9IHRoaXMuc3RvcmUuc2l6ZSgpO1xyXG5cdFx0XHR0aGlzLl9zZXRDYW52YXNXSCh0b3RhbCk7XHJcblx0XHRcdHRoaXMuYnVmZmVyTm9kZS5zZXRUb3RhbCh0b3RhbCk7XHJcblx0XHRcdHRoaXMuYnVmZmVyWm9uZS5zZXRUb3RhbCh0b3RhbCk7XHJcblxyXG5cdFx0XHRpZiAoIWFwcGVuZCB8fCAodG90YWwgLSAxKSAqIHRoaXMucm93SGVpZ2h0IDwgMip0aGlzLiRkb20udmlld3BvcnQub3V0ZXJIZWlnaHQoKSkge1xyXG5cdFx0XHRcdHRoaXMuX3VwZGF0ZUJ1ZmZlcigpO1xyXG5cdFx0XHRcdHRoaXMucmVuZGVyKCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHR9XHJcblxyXG5cdF91cGRhdGVCdWZmZXIoKSB7XHJcblx0XHR2YXIgbGltaXQgPSBNYXRoLm1pbihcclxuXHRcdFx0TWF0aC5jZWlsKHRoaXMuJGRvbS52aWV3cG9ydC5vdXRlckhlaWdodCgpIC8gdGhpcy5yb3dIZWlnaHQpIC0gMSxcclxuXHRcdFx0dGhpcy5zdG9yZS5zaXplKCkgLSAxKTtcclxuXHJcblx0XHR0aGlzLmJ1ZmZlclpvbmUuc2V0TGltaXQobGltaXQpO1xyXG5cdFx0dGhpcy5idWZmZXJOb2RlLnNldExpbWl0KGxpbWl0KTtcclxuXHRcdHRoaXMuc2hvdWxkQWRkTm9kZXMgPSB0cnVlO1xyXG5cdFx0dGhpcy5zY3JvbGxUb1RvcCgwKTtcclxuXHJcblx0XHR0aGlzLiRkb20uY2FudmFzLmVtcHR5KCk7XHJcblx0fVxyXG5cclxuXHRfYnVmZmVyUmVuZGVyKGRpciwgW3N0YXJ0LCBlbmRdKSB7XHJcblx0XHR2YXIgbm9kZXMgPSB0aGlzLmJ1ZmZlck5vZGUuZ2V0KGRpciwgW3N0YXJ0LCBlbmRdKTtcclxuXHRcdGNvbnNvbGUubG9nKCfkuIDmrKHojrflj5boioLngrnplb/luqYnLCBub2Rlcy5sZW5ndGgsIHN0YXJ0LCBlbmQpO1xyXG5cclxuXHRcdGlmICghdGhpcy5zaG91bGRBZGROb2Rlcykge1xyXG5cdFx0XHR0aGlzLnN0b3JlLnNsaWNlKHN0YXJ0LCBlbmQgKyAxKS5mb3JFYWNoKChyb3dNLCBpKSA9PiB7XHJcblx0XHRcdFx0bm9kZXNbaV0uc2V0RGF0YShyb3dNLCByb3dNLnJpZCAqIHRoaXMucm93SGVpZ2h0KTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHR2YXIgJGRvY0ZyYW1lID0gJCgnPGRpdi8+Jyk7XHJcblx0XHR0aGlzLnN0b3JlLnNsaWNlKHN0YXJ0LCBlbmQgKyAxKS5mb3JFYWNoKChyb3dNLCBpKSA9PiB7XHJcblxyXG5cdFx0XHRsZXQgbm9kZSA9IG5vZGVzW2ldLnNldERhdGEocm93TSwgcm93TS5yaWQgKiB0aGlzLnJvd0hlaWdodCk7XHJcblx0XHRcdCRkb2NGcmFtZS5hcHBlbmQobm9kZSk7XHJcblx0XHRcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuJGRvbS5jYW52YXMuYXBwZW5kKCRkb2NGcmFtZS5jaGlsZHJlbigpKTtcclxuXHRcdHRoaXMubG9ja0NvbE1hbmFnZXIuYWRkQnVmZmVyTG9ja05vZGUobm9kZXMpO1xyXG5cclxuXHRcdGlmICh0aGlzLmJ1ZmZlck5vZGUuaXNFbm91Z2goKSkge1xyXG5cdFx0XHR0aGlzLnNob3VsZEFkZE5vZGVzID0gZmFsc2U7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZW5kZXIoKSB7XHJcblx0XHR0aGlzLl9idWZmZXJSZW5kZXIoMSwgdGhpcy5idWZmZXJab25lLmRvbWFpbik7XHJcblx0fVxyXG5cclxuXHRzZXRXaWR0aChudW0pIHtcclxuXHRcdGlmIChpc05hTihudW0pKSByZXR1cm47XHJcblxyXG5cdFx0dGhpcy4kZG9tLndyYXBwZXIud2lkdGgobnVtKTtcclxuXHR9XHJcblxyXG5cdHNldEhlaWdodChudW0pIHtcclxuXHRcdGlmIChpc05hTihudW0pKSByZXR1cm47XHJcblxyXG5cdFx0dmFyIHZpZXdwb3J0SGVpZ2h0ID0gbnVtIC0gdGhpcy4kZG9tLmhlYWRlci5vdXRlckhlaWdodCgpO1xyXG5cdFx0dGhpcy4kZG9tLnZpZXdwb3J0Lm91dGVySGVpZ2h0KHZpZXdwb3J0SGVpZ2h0KTtcclxuXHRcdHRoaXMuZmlyZSgndmlld3BvcnQtaGVpZ2h0LWNoYW5nZWQnLCB2aWV3cG9ydEhlaWdodCk7XHJcblx0fVxyXG5cclxuXHRkZXN0b3J5KCkge1xyXG5cdFx0dGhpcy5jb2x1bW5Nb2RlbC5kZXN0b3J5KCk7XHJcblx0XHR0aGlzLnN0b3JlLmRlc3RvcnkoKTtcclxuXHRcdHRoaXMuaGVhZGVyLmRlc3RvcnkoKTtcclxuXHRcdHRoaXMuJGRvbS53cmFwcGVyLnJlbW92ZSgpO1xyXG5cdH1cclxufVxyXG5tb2R1bGUuZXhwb3J0cyA9IEdyaWRDb21wb25lbnQ7IiwiY29uc3QgJCA9IHJlcXVpcmUoJy4uL3V0aWwvc2hpbScpLiQ7XHJcbmNvbnN0IEREID0gcmVxdWlyZSgnLi4vdXRpbC9ERCcpO1xyXG5cclxuY29uc3QgU09SVF9DTFNfQVNDID0gJ2MtY29sdW1uLWFzYyc7XHJcbmNvbnN0IFNPUlRfQ0xTX0RFU0MgPSAnYy1jb2x1bW4tZGVzYyc7XHJcbmNvbnN0IE5FRURMRVNTX1dJRFRIID0gMTAwMDtcclxuXHJcbnZhciBjcmVhdGVDb2x1bW5FbGVtZW50ID0gZnVuY3Rpb24oY29sTSkge1xyXG5cdHZhciBsb2NrQ2xhc3MgPSBjb2xNLmxvY2tlZCA/ICcgYy1jb2x1bW4tbG9ja2VkJyA6ICcnO1xyXG5cclxuXHRyZXR1cm4gJCgnPGxpLz4nKVxyXG5cdFx0LmFkZENsYXNzKCdjLWhlYWRlci1jZWxsJyArIGxvY2tDbGFzcylcclxuXHRcdC5hZGRDbGFzcygnYy1hbGlnbi0nICsgY29sTS5hbGlnbilcclxuXHRcdC53aWR0aChjb2xNLndpZHRoKVxyXG5cdFx0Lm9uKCdjbGljaycsICgpID0+IHsgY29sTS5zb3J0KCk7IH0pXHJcblx0XHQuZGF0YSgnY29sdW1uJywgY29sTSlcclxuXHRcdC5odG1sKGNvbE0udGV4dCk7XHJcbn07XHJcblxyXG5cclxuY2xhc3MgSGVhZGVyIHtcclxuXHRjb25zdHJ1Y3RvcigkaGVhZGVyLCBjb2xzTW9kZWwsIHN0b3JlKSB7XHJcblxyXG5cdFx0dGhpcy4kaGVhZGVyID0gJGhlYWRlcjtcclxuXHRcdHRoaXMuY29sc01vZGVsID0gY29sc01vZGVsO1xyXG5cdFx0dGhpcy5zdG9yZSA9IHN0b3JlO1xyXG5cdFx0dGhpcy5jb2xFbGVtZW50cyA9IG5ldyBNYXAoKTtcclxuXHJcblx0XHR0aGlzLl9jcmVhdGVDb2x1bW5FbGVtZW50cygpO1xyXG5cdFx0dGhpcy5fYmluZEV2ZW50KCk7XHJcblxyXG5cdFx0dGhpcy5yZW5kZXIoKTtcclxuXHR9XHJcblxyXG5cdF9jcmVhdGVDb2x1bW5FbGVtZW50cygpIHtcclxuXHRcdHZhciB3aWR0aCA9IE5FRURMRVNTX1dJRFRIO1xyXG5cclxuXHRcdHRoaXMuJHJvdyA9ICQoJzx1bC8+JykuYWRkQ2xhc3MoJ2MtaGVhZGVyLXJvdycpO1xyXG5cclxuXHRcdHRoaXMuY29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblx0XHRcdGxldCBjb2xFbGVtZW50ID0gY3JlYXRlQ29sdW1uRWxlbWVudChjb2xNKTtcclxuXHJcblx0XHRcdHRoaXMuY29sRWxlbWVudHMuc2V0KGNvbE0sIGNvbEVsZW1lbnQpO1xyXG5cdFx0XHR0aGlzLiRyb3cuYXBwZW5kKGNvbEVsZW1lbnQpO1xyXG5cclxuXHRcdFx0d2lkdGggKz0gY29sTS53aWR0aDtcclxuXHJcblx0XHR9KTtcclxuXHJcblx0XHR0aGlzLiRyb3cud2lkdGgod2lkdGgpO1xyXG5cdH1cclxuXHJcblx0Z2V0VmlzaWJsZUNvbHNXaWR0aCgpIHtcclxuXHRcdHJldHVybiB0aGlzLiRyb3cud2lkdGgoKSAtIE5FRURMRVNTX1dJRFRIO1xyXG5cdH1cclxuXHJcblx0X2JpbmRFdmVudCgpIHtcclxuXHRcdHRoaXMuX2NvbHVtblJlc2l6ZSgpO1xyXG5cclxuXHRcdHRoaXMuY29sc01vZGVsLmVhY2goY29sTSA9PiB7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tcmVzaXplZCcsIHdpZHRoID0+IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pLm91dGVyV2lkdGgod2lkdGgpKTtcclxuXHJcblx0XHRcdGNvbE0ub24oJ2NvbHVtbi1oaWRkZW4nLCBpc0hpZGRlbiA9PiB7XHJcblx0XHRcdFx0bGV0IGNvbEVsZSA9IHRoaXMuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cdFx0XHRcdGlmIChpc0hpZGRlbikge1xyXG5cdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKCdjLWNvbHVtbi1oaWRlJyk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcygnYy1jb2x1bW4taGlkZScpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tbG9ja2VkJywgaXNMb2NrZWQgPT4ge1xyXG5cdFx0XHRcdGxldCBjb2xFbGUgPSB0aGlzLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHJcblx0XHRcdFx0aWYgKGlzTG9ja2VkKSB7XHJcblx0XHRcdFx0XHRjb2xFbGUuYWRkQ2xhc3MoJ2MtY29sdW1uLWxvY2tlZCcpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb2xFbGUucmVtb3ZlQ2xhc3MoJ2MtY29sdW1uLWxvY2tlZCcpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tc29ydC1jaGFuZ2VkJywgc29ydFN0YXRlID0+IHtcclxuXHRcdFx0XHRsZXQgY29sRWxlID0gdGhpcy5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdGNvbnNvbGUubG9nKHNvcnRTdGF0ZSk7XHJcblx0XHRcdFx0aWYgKHNvcnRTdGF0ZSkge1xyXG5cdFx0XHRcdFx0aWYgKHNvcnRTdGF0ZSA9PT0gJ0FTQycpIHtcclxuXHRcdFx0XHRcdFx0Y29sRWxlLmFkZENsYXNzKFNPUlRfQ0xTX0FTQyk7XHJcblx0XHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcyhTT1JUX0NMU19ERVNDKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGNvbEVsZS5hZGRDbGFzcyhTT1JUX0NMU19ERVNDKTtcclxuXHRcdFx0XHRcdFx0Y29sRWxlLnJlbW92ZUNsYXNzKFNPUlRfQ0xTX0FTQyk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbEVsZS5yZW1vdmVDbGFzcyhTT1JUX0NMU19BU0MpLnJlbW92ZUNsYXNzKFNPUlRfQ0xTX0RFU0MpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdF9jb2x1bW5SZXNpemUoKSB7XHJcblx0XHR0aGlzLiRyb3cub24oJ21vdXNlbW92ZScsICdsaS5jLWhlYWRlci1jZWxsJywgZnVuY3Rpb24oZXZ0KSB7XHJcblx0XHRcdHZhciBvZmZzZXRYID0gZXZ0Lm9mZnNldFg7XHJcblx0XHRcdGlmICh0aGlzLm9mZnNldFdpZHRoIC0gb2Zmc2V0WCA8PSA1IHx8IG9mZnNldFggPD0gNSkge1xyXG5cdFx0XHRcdCQodGhpcykuYWRkQ2xhc3MoJ2MtY29sLXJlc2l6YWJsZScpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdCQodGhpcykucmVtb3ZlQ2xhc3MoJ2MtY29sLXJlc2l6YWJsZScpO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHJcblxyXG5cdFx0dmFyIHN0YXJ0WCA9IDA7XHJcblxyXG5cdFx0REQodGhpcy4kcm93LmZpbmQoJ2xpLmMtaGVhZGVyLWNlbGwnKSwge1xyXG5cdFx0XHQncmVzdHJpY3Rlcic6IGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0XHRcdHZhciBvZmZzZXRYID0gZXZ0Lm9mZnNldFg7XHJcblx0XHRcdFx0aWYgKGV2dC50YXJnZXQub2Zmc2VzdFdpZHRoIC0gb2Zmc2V0WCA8PSA1KSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gJChldnQudGFyZ2V0KTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKG9mZnNldFggPD0gNSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuICQoZXZ0LnRhcmdldCkucHJldigpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSxcclxuXHRcdFx0J29uRHJhZ1N0YXJ0JzogZnVuY3Rpb24ob2Zmc2V0LCAkdGFyZ2V0KSB7XHJcblx0XHRcdFx0dmFyIHNjcm9sbExlZnQgPSBkb2N1bWVudC5ib2R5LnNjcm9sbExlZnQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbExlZnQ7XHJcblx0XHRcdFx0Y29uc29sZS5sb2coJHRhcmdldC5vZmZzZXQoKS5sZWZ0LCAkdGFyZ2V0LnRleHQoKSk7XHJcblx0XHRcdFx0c3RhcnRYID0gJHRhcmdldC5vZmZzZXQoKS5sZWZ0IC0gc2Nyb2xsTGVmdDtcclxuXHRcdFx0XHQvLyBjb25zb2xlLmxvZyhvZmZzZXQueCwgJHRhcmdldC50ZXh0KCkpO1xyXG5cclxuXHRcdFx0XHQvLyBzdGFydFggPSBvZmZzZXQueDtcclxuXHRcdFx0fSxcclxuXHRcdFx0J29uRHJhZ2dpbmcnOiBmdW5jdGlvbihvZmZzZXQsICR0YXJnZXQpIHtcclxuXHJcblx0XHRcdH0sXHJcblx0XHRcdCdvbkRyYWdFbmQnOiBmdW5jdGlvbihvZmZzZXQsICR0YXJnZXQpIHtcclxuXHRcdFx0XHR2YXIgd2lkdGggPSBvZmZzZXQueCAtIHN0YXJ0WDtcclxuXHRcdFx0XHRjb25zb2xlLmxvZyhgJHskdGFyZ2V0LnRleHQoKX1cclxuXHRcdFx0XHRcdOWOn+WuveW6puS4uiR7JHRhcmdldC5kYXRhKCdjb2x1bW4nKS53aWR0aH0sXHJcblx0XHRcdFx0XHTmlLnlj5jkuLrvvJoke3dpZHRofSwgWyR7b2Zmc2V0Lnh9IC0gJHtzdGFydFh9XWApO1xyXG5cdFx0XHRcdCR0YXJnZXQuZGF0YSgnY29sdW1uJykuc2V0V2lkdGgod2lkdGgpO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdHJlbmRlcigpIHtcclxuXHRcdHRoaXMuJGhlYWRlci5hcHBlbmQodGhpcy4kcm93KTtcclxuXHR9XHJcblxyXG5cdGRlc3RvcnkoKSB7XHJcblxyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBIZWFkZXI7IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuY2xhc3MgTG9ja0NvbHVtbiB7XHJcblx0Y29uc3RydWN0b3IoKSB7XHJcblx0XHR0aGlzLl9kYXRhID0gW107XHJcblx0XHR0aGlzLl9jb2x1bW5zV2lkdGggPSAwO1xyXG5cdH1cclxuXHJcblx0YWRkKGNvbE0pIHtcclxuXHRcdHRoaXMuX2RhdGEudW5zaGlmdChjb2xNKTtcclxuXHRcdHRoaXMucmVDYWxjKCk7XHJcblx0fVxyXG5cclxuXHRyZW1vdmUoZGVsQ29sTSkge1xyXG5cdFx0dGhpcy5fZGF0YSA9IHRoaXMuX2RhdGEuZmlsdGVyKGNvbE0gPT4gY29sTSAhPT0gZGVsQ29sTSk7XHJcblx0XHR0aGlzLnJlQ2FsYygpO1xyXG5cdH1cclxuXHJcblx0Y2xlYXIoKSB7XHJcblx0XHR0aGlzLl9kYXRhLmxlbmd0aCA9IDA7XHJcblx0XHR0aGlzLnJlQ2FsYygpO1xyXG5cdH1cclxuXHJcblx0Z2V0V2lkdGgoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5fY29sdW1uc1dpZHRoO1xyXG5cdH1cclxuXHJcblx0cmVDYWxjKCkge1xyXG5cdFx0dGhpcy5fY29sdW1uc1dpZHRoID0gdGhpcy5fZGF0YS5yZWR1Y2UoKHdpZHRoLCBjb2xNKSA9PiB7XHJcblx0XHRcdHdpZHRoIC09IGNvbE0ud2lkdGg7XHJcblx0XHRcdGNvbE0uYXdheUZyb21MZWZ0ID0gd2lkdGg7XHJcblx0XHRcdHJldHVybiB3aWR0aDtcclxuXHRcdH0sIDApO1xyXG5cdH1cclxuXHJcblx0ZWFjaChmbikge1xyXG5cdFx0dGhpcy5fZGF0YS5mb3JFYWNoKGZuKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIOW9k+WFtuS4reS4gOWIl+WPkeeUn+WPmOWMlu+8jOmAmuefpeWFtuWug+WIl+ebuOW6lOWPmOWMllxyXG5cdCAqL1xyXG5cdCBwdWJsaXNoKGNoYW5nZWRDb2xNLCBzY3JvbGxMZWZ0KSB7XHJcblx0IFx0dGhpcy5fZGF0YS5mb3JFYWNoKGNvbE0gPT4ge1xyXG5cdCBcdFx0aWYgKGNvbE0gIT09IGNoYW5nZWRDb2xNKSB7XHJcblx0IFx0XHRcdGNvbE0uZmlyZSgnc2Nyb2xsLXgnLCBzY3JvbGxMZWZ0KTtcclxuXHQgXHRcdH1cclxuXHQgXHR9KTtcclxuXHQgfVxyXG59XHJcblxyXG52YXIgTG9ja0NvbE1hbmFnZXIgPSBmdW5jdGlvbihjb2xzTW9kZWwsIGhlYWRlciwgJGRvbSwgYnVmZmVyTm9kZSkge1xyXG5cdGxldCB2aXNpYmxlTG9ja0NvbHVtbiA9IG5ldyBMb2NrQ29sdW1uKCk7XHJcblxyXG5cdGluaXQoKTtcclxuXHRpbml0RXZlbnQoKTtcclxuXHJcblx0ZnVuY3Rpb24gaW5pdCgpIHtcclxuXHRcdGNvbHNNb2RlbFxyXG5cdFx0XHQuZ2V0TG9ja0NvbHVtbigpXHJcblx0XHRcdC5maWx0ZXIoY29sTSA9PiAhY29sTS5oaWRkZW4pXHJcblx0XHRcdC5mb3JFYWNoKGNvbE0gPT4gdmlzaWJsZUxvY2tDb2x1bW4uYWRkKGNvbE0pKTtcclxuXHJcblx0XHR1cGRhdGVCb3hTaXplKCk7XHJcblxyXG5cdFx0dmlzaWJsZUxvY2tDb2x1bW4uZWFjaChjb2xNID0+IHtcclxuXHRcdFx0bGV0IGhlYWRlckVsZW1lbnQgPSBoZWFkZXIuY29sRWxlbWVudHMuZ2V0KGNvbE0pO1xyXG5cdFx0XHQvLyDorr7nva7lubborrDlvZXliJ3lp4vnmoTlt6bkvqfkvY1cclxuXHRcdFx0aGVhZGVyRWxlbWVudC5jc3MoJ2xlZnQnLCBjb2xNLmF3YXlGcm9tTGVmdCk7XHJcblxyXG5cdFx0XHRjb2xNLm9uKCdzY3JvbGwteCcsIHggPT4ge1xyXG5cdFx0XHRcdGxldCBsZWZ0U3R5bGUgPSB7ICdsZWZ0JzogeCArIGNvbE0uYXdheUZyb21MZWZ0IH07XHJcblxyXG5cdFx0XHRcdGhlYWRlckVsZW1lbnQuY3NzKGxlZnRTdHlsZSk7XHJcblx0XHRcdFx0YnVmZmVyTm9kZS5nZXROb2RlTGlzdCgpLmZvckVhY2gobm9kZSA9PiBub2RlLmNoaWxkcmVuLmdldChjb2xNKS5jc3MobGVmdFN0eWxlKSk7XHRcdFx0XHRcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGluaXRFdmVudCgpIHtcclxuXHRcdGNvbHNNb2RlbC5nZXRDb2x1bW4oKS5mb3JFYWNoKGNvbE0gPT4ge1xyXG5cclxuXHRcdFx0Y29sTS5vbignY29sdW1uLXJlc2l6ZWQnLCB3aWR0aCA9PiB7XHJcblxyXG5cdFx0XHRcdGlmIChjb2xNLmxvY2tlZCkge1xyXG5cdFx0XHRcdFx0dmlzaWJsZUxvY2tDb2x1bW4ucmVDYWxjKCk7XHJcblx0XHRcdFx0XHRsZXQgaGVhZGVyRWxlbWVudCA9IGhlYWRlci5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdFx0bGV0IGN1cnJlbnRMZWZ0ID0gJGRvbS52aWV3cG9ydC5zY3JvbGxMZWZ0KCkgKyBjb2xNLmF3YXlGcm9tTGVmdDtcclxuXHJcblx0XHRcdFx0XHRoZWFkZXJFbGVtZW50LmNzcygnbGVmdCcsIGN1cnJlbnRMZWZ0KTtcclxuXHRcdFx0XHRcdGJ1ZmZlck5vZGUuZ2V0Tm9kZUxpc3QoKS5mb3JFYWNoKG5vZGUgPT4gbm9kZS5jaGlsZHJlbi5nZXQoY29sTSkuY3NzKCdsZWZ0JywgY3VycmVudExlZnQpKTtcclxuXHJcblx0XHRcdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5wdWJsaXNoKGNvbE0sICRkb20udmlld3BvcnQuc2Nyb2xsTGVmdCgpKTtcclxuXHRcdFx0XHRcdHVwZGF0ZUJveFNpemUoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFxyXG5cdFx0XHR9KTtcclxuXHJcblxyXG5cdFx0XHRjb2xNLm9uKCdjb2x1bW4tbG9ja2VkJywgaXNMb2NrZWQgPT4ge1xyXG5cdFx0XHRcdGxldCBoZWFkZXJFbGVtZW50ID0gaGVhZGVyLmNvbEVsZW1lbnRzLmdldChjb2xNKTtcclxuXHJcblx0XHRcdFx0aWYgKGlzTG9ja2VkKSB7XHJcblx0XHRcdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5hZGQoY29sTSk7XHJcblxyXG5cdFx0XHRcdFx0Y29sTS5vbignc2Nyb2xsLXgnLCB4ID0+IHtcclxuXHRcdFx0XHRcdFx0bGV0IGxlZnRTdHlsZSA9IHsgJ2xlZnQnOiB4ICsgY29sTS5hd2F5RnJvbUxlZnQgfTtcclxuXHJcblx0XHRcdFx0XHRcdGhlYWRlckVsZW1lbnQuY3NzKGxlZnRTdHlsZSk7XHJcblx0XHRcdFx0XHRcdGJ1ZmZlck5vZGUuZ2V0Tm9kZUxpc3QoKS5mb3JFYWNoKG5vZGUgPT4gbm9kZS5jaGlsZHJlbi5nZXQoY29sTSkuY3NzKGxlZnRTdHlsZSkpO1xyXG5cdFx0XHRcdFx0fSk7XHJcblxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5yZW1vdmUoY29sTSk7XHJcblxyXG5cdFx0XHRcdFx0Y29sTS5vZmYoJ3Njcm9sbC14Jyk7XHJcblxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0bGV0IGN1cnJlbnRMZWZ0ID0gJGRvbS52aWV3cG9ydC5zY3JvbGxMZWZ0KCkgKyBjb2xNLmF3YXlGcm9tTGVmdDtcclxuXHJcblx0XHRcdFx0Ly8g6K6+572u5bm26K6w5b2V5Yid5aeL55qE5bem5L6n5L2NXHJcblx0XHRcdFx0aGVhZGVyRWxlbWVudC5jc3MoJ2xlZnQnLCBjdXJyZW50TGVmdCk7XHJcblx0XHRcdFx0YnVmZmVyTm9kZS5nZXROb2RlTGlzdCgpLmZvckVhY2gobm9kZSA9PiBub2RlLmNoaWxkcmVuLmdldChjb2xNKS5jc3MoJ2xlZnQnLCBjdXJyZW50TGVmdCkpO1xyXG5cclxuXHRcdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5wdWJsaXNoKGNvbE0sICRkb20udmlld3BvcnQuc2Nyb2xsTGVmdCgpKTtcclxuXHRcdFx0XHR1cGRhdGVCb3hTaXplKCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0XHRcclxuXHRcdGJ1ZmZlck5vZGUub24oJ2J1ZmZlci1pbml0aWFsJywgKCkgPT4ge1xyXG5cdFx0XHQvLyBjbGVhckJ1ZmZlckxvY2tOb2RlKCk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHVwZGF0ZUJveFNpemUoKSB7XHJcblx0XHR2YXIgdmlzaWJsZUxvY2tDb2xzV2lkdGggPSB2aXNpYmxlTG9ja0NvbHVtbi5nZXRXaWR0aCgpO1xyXG5cdFx0aGVhZGVyLiRoZWFkZXIuY3NzKCdwYWRkaW5nLWxlZnQnLCAtdmlzaWJsZUxvY2tDb2xzV2lkdGgpO1xyXG5cdFx0JGRvbS5jYW52YXMuY3NzKCdtYXJnaW4tbGVmdCcsIC12aXNpYmxlTG9ja0NvbHNXaWR0aCk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4ge1xyXG5cdFx0dmlzaWJsZUxvY2tDb2x1bW4sXHJcblx0XHRzZXRMb2NrQ29sdW1uWChzY3JvbGxMZWZ0KSB7XHJcblx0XHRcdHZpc2libGVMb2NrQ29sdW1uLmVhY2goY29sTSA9PiBjb2xNLmZpcmUoJ3Njcm9sbC14Jywgc2Nyb2xsTGVmdCkpO1xyXG5cdFx0fSxcclxuXHJcblx0XHRhZGRCdWZmZXJMb2NrTm9kZShyb3dOb2Rlcykge1xyXG5cdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5lYWNoKGNvbE0gPT4ge1xyXG5cdFx0XHRcdHJvd05vZGVzLmZvckVhY2gocm93Tm9kZXMgPT4ge1xyXG5cdFx0XHRcdFx0bGV0IGNvbEVsZSA9IGhlYWRlci5jb2xFbGVtZW50cy5nZXQoY29sTSk7XHJcblx0XHRcdFx0XHRsZXQgY2VsbEVsZW1lbnQgPSByb3dOb2Rlcy5jaGlsZHJlbi5nZXQoY29sTSk7XHJcblxyXG5cdFx0XHRcdFx0Y2VsbEVsZW1lbnQuY3NzKCdsZWZ0JywgJGRvbS52aWV3cG9ydC5zY3JvbGxMZWZ0KCkgKyBjb2xNLmF3YXlGcm9tTGVmdCk7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSxcclxuXHJcblx0XHRjbGVhckJ1ZmZlckxvY2tOb2RlKCkge1xyXG5cdFx0XHR2aXNpYmxlTG9ja0NvbHVtbi5jbGVhcigpO1xyXG5cdFx0fVxyXG5cclxuXHR9O1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBMb2NrQ29sTWFuYWdlcjsiLCJ2YXIgdGhyb3R0bGUgPSBmdW5jdGlvbihmbiwgdGltZSkge1xyXG5cdHZhciB0aW1lciA9IG51bGw7XHJcblx0cmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpIHtcclxuXHRcdGlmICh0aW1lcikgY2xlYXJUaW1lb3V0KHRpbWVyKTtcclxuXHJcblx0XHR0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG5cdFx0XHRmbi5hcHBseShudWxsLCBhcmdzKTtcclxuXHRcdH0sIHRpbWUpO1xyXG5cdH1cclxufVxyXG5cclxuY2xhc3MgU2Nyb2xsZXIge1xyXG5cdGNvbnN0cnVjdG9yKGxpbmVIZWlnaHQsIGJ1ZmZlclpvbmUpIHtcclxuXHJcblx0XHR0aGlzLmJ1ZmZlclpvbmUgPSBidWZmZXJab25lO1xyXG5cdFx0dGhpcy55RGlyID0gMDsgLy8gMTrlkJHkuIrvvIwwLC0xOuWQkeS4i1xyXG5cdFx0dGhpcy55UHJlSW5kZXggPSAwOyAvLyDkuIrkuIDkuKrkvY3nva5cclxuXHRcdHRoaXMubGluZUhlaWdodCA9IGxpbmVIZWlnaHQ7XHJcblxyXG5cdFx0dGhpcy54RGlyID0gMDsgLy8gMe+8muWQkeW3pu+8jDDvvIwtMe+8muWQkeWPs1xyXG5cdFx0dGhpcy54UHJlSW5kZXggPSAwOyAvLyDliY3kuIDkuKrkvY3nva5cclxuXHJcblx0XHR0aGlzLl90cmlnZ2VyWCA9IHggPT4geDtcclxuXHRcdHRoaXMuX3RyaWdnZXJZID0geSA9PiB5O1xyXG5cclxuXHR9XHJcblxyXG5cdG9uWChjYWxsYmFjaykge1xyXG5cdFx0dGhpcy5fdHJpZ2dlclggPSB4ID0+IHtcclxuXHRcdFx0aWYgKHggPT09IHRoaXMueFByZUluZGV4KSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLnhEaXIgPSB4IC0gdGhpcy54UHJlSW5kZXg7XHJcblx0XHRcdHRoaXMueFByZUluZGV4ID0geDtcclxuXHJcblx0XHRcdGNhbGxiYWNrKHgpO1xyXG5cdFx0fTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdG9uWShoYW5kbGVyLCBkZWxheSkge1xyXG5cdFx0Ly8gVE9ET1xyXG5cdFx0Ly8gdmFyIGRlYWx5Rm4gPSB0aHJvdHRsZShoYW5kbGVyLCBkZWxheSk7XHJcblxyXG5cdFx0dGhpcy5fdHJpZ2dlclkgPSB0aHJvdHRsZSgoeSkgPT4ge1xyXG5cdFx0XHR0aGlzLnlEaXIgPSB5IC0gdGhpcy55UHJlSW5kZXg7XHJcblx0XHRcdHRoaXMueVByZUluZGV4ID0geTtcclxuXHJcblx0XHRcdHZhciBpbmRleCA9IH5+KHkvIHRoaXMubGluZUhlaWdodCk7XHJcblx0XHRcdHZhciB3aWxsTG9hZCA9IHRoaXMuYnVmZmVyWm9uZS5zaG91bGRMb2FkKHRoaXMueURpciwgaW5kZXgpO1xyXG5cclxuXHRcdFx0aWYgKHdpbGxMb2FkKSB7XHJcblx0XHRcdFx0Ly8gZGVhbHlGbigpO1xyXG5cdFx0XHRcdGhhbmRsZXIoXHJcblx0XHRcdFx0XHR0aGlzLnlEaXIgPiAwID8gMSA6IC0xLFxyXG5cdFx0XHRcdFx0dGhpcy5idWZmZXJab25lLmRvbWFpbixcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS5zdGFydCxcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS5lbmQsXHJcblx0XHRcdFx0XHRpbmRleCxcclxuXHRcdFx0XHRcdHRoaXMuYnVmZmVyWm9uZS50b3RhbFxyXG5cdFx0XHRcdCk7XHJcblx0XHRcdH1cclxuXHRcdH0sIGRlbGF5KTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdGZpcmVYKHgpIHtcclxuXHRcdHRoaXMuX3RyaWdnZXJYKHgpO1xyXG5cdH1cclxuXHJcblx0ZmlyZVkoeSkge1xyXG5cdFx0dGhpcy5fdHJpZ2dlclkoeSk7XHJcblx0fVxyXG5cclxuXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU2Nyb2xsZXI7IiwiJ3VzZSBzdHJpY3QnO1xyXG5jb25zdCAkID0gcmVxdWlyZSgnLi4vdXRpbC9zaGltJykuJDtcclxuXHJcbmNvbnN0IEZMRVhNSU5XSURUSCA9IDM1O1xyXG5cclxudmFyIGRyYWdEcm9wID0gZnVuY3Rpb24oZXZ0ICxvcHRzKSB7XHJcblx0dmFyIGRvYyA9ICQoZG9jdW1lbnQpO1xyXG5cdHZhciBzY3JvbGxMZWZ0ID0gZG9jdW1lbnQuYm9keS5zY3JvbGxMZWZ0IHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0O1xyXG5cdHZhciBzY3JvbGxUb3AgPSBkb2N1bWVudC5ib2R5LnNjcm9sbFRvcCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsVG9wO1xyXG5cdHZhciBsZWZ0T2Zmc2V0ID0gJChldnQudGFyZ2V0KS5vZmZzZXQoKS5sZWZ0IC0gc2Nyb2xsTGVmdDtcclxuXHR2YXIgaVgsIGlZLCBzdGFydFgsIGVuZFg7XHJcblx0dmFyIGRyYWdnaW5nID0gdHJ1ZTtcclxuXHJcblx0c3RhcnRYID0gaVggPSBldnQuY2xpZW50WCAtIHNjcm9sbExlZnQ7XHJcblx0aVkgPSAkKGV2dC50YXJnZXQpLm9mZnNldCgpLnRvcCAtIHNjcm9sbFRvcDtcclxuXHJcblx0b3B0cy5vbkRyYWdTdGFydCh7ICd4Jzogc3RhcnRYIH0sIG9wdHMuJGVsZW1lbnQpO1xyXG5cclxuXHRkb2Mub24oJ21vdXNlbW92ZS5kcmFnZHJvcCcsICQucHJveHkobW91c2Vtb3ZlLCB0aGlzKSk7XHJcblx0ZG9jLm9uKCdtb3VzZXVwLmRyYWdkcm9wJywgJC5wcm94eShtb3VzZXVwLCB0aGlzKSk7XHJcblx0Ly8gJChldnQudGFyZ2V0KVswXS5zZXRDYXB0dXJlICYmICQoZXZ0LnRhcmdldClbMF0uc2V0Q2FwdHVyZSgpO1xyXG5cclxuXHRmdW5jdGlvbiBtb3VzZW1vdmUoZSkge1xyXG5cdFx0aWYgKGRyYWdnaW5nKSB7XHJcblx0XHRcdGVuZFggPSBlLmNsaWVudFggLSBzY3JvbGxMZWZ0O1xyXG5cclxuXHRcdFx0Ly8gbGltaXRcclxuXHRcdFx0aWYgKGVuZFggLSBsZWZ0T2Zmc2V0IDwgRkxFWE1JTldJRFRIKSB7XHJcblx0XHRcdFx0ZW5kWCA9IGxlZnRPZmZzZXQgKyBGTEVYTUlOV0lEVEg7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdG9wdHMub25EcmFnZ2luZyggeyAneCc6IGVuZFggfSwgb3B0cy4kZWxlbWVudCk7XHJcblx0XHR9XHJcblxyXG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIG1vdXNldXAoZXZ0KSB7XHJcblx0XHR2YXIgZSA9IGV2dC50YXJnZXQ7XHJcblx0XHRkcmFnZ2luZyA9IGZhbHNlO1xyXG5cclxuXHRcdG9wdHMub25EcmFnRW5kKHsgJ3gnOiBldnQuY2xpZW50WCAtIHNjcm9sbExlZnQgfSwgb3B0cy4kZWxlbWVudCk7XHJcblxyXG5cdFx0aWYgKGUgJiYgZS5zZXRDYXB0dXJlKSB7XHJcblx0XHRcdGUucmVsZWFzZUNhcHR1cmUoKTtcclxuXHRcdH0gZWxzZSBpZiAod2luZG93LnJlbGVhc2VDYXB0dXJlKSB7XHJcblx0XHRcdHdpbmRvdy5yZWxlYXNlQ2FwdHVyZShFdmVudC5NT1VTRU1PVkUgfCBFdmVudC5NT1VTRVVQKTtcclxuXHRcdH1cclxuXHJcblx0XHRkb2Mub2ZmKCdtb3VzZW1vdmUuZHJhZ2Ryb3AnLCBtb3VzZW1vdmUpO1xyXG5cdFx0ZG9jLm9mZignbW91c2V1cC5kcmFnZHJvcCcsIG1vdXNldXApO1xyXG5cdH1cclxuXHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih0YXJnZXQsIG9wdGlvbnMpIHtcclxuXHR2YXIgZGVmYXVsdHMgPSB7XHJcblx0XHRyZXN0cmljdGVyKGV2dCkgeyByZXR1cm4gbnVsbDsgfSxcclxuXHRcdG9uRHJhZ1N0YXJ0KG9mZnNldCwgdGFyZ2V0KSB7fSxcclxuXHRcdG9uRHJhZ2dpbmcob2Zmc2V0LCB0YXJnZXQpIHt9LFxyXG5cdFx0b25EcmFnRW5kKG9mZnNldCwgdGFyZ2V0KSB7fVxyXG5cdH07XHJcblxyXG5cdE9iamVjdC5hc3NpZ24oZGVmYXVsdHMsIG9wdGlvbnMpO1xyXG5cclxuXHQkKHRhcmdldCkub24oJ21vdXNlZG93bicsIGZ1bmN0aW9uKGV2dCkge1xyXG5cdFx0dmFyIHJlc3RyaWN0ZXIgPSBkZWZhdWx0cy5yZXN0cmljdGVyKGV2dCk7XHJcblxyXG5cdFx0aWYgKHJlc3RyaWN0ZXIpIHtcclxuXHRcdFx0ZGVmYXVsdHMuJGVsZW1lbnQgPSBkZWZhdWx0cy5yZXN0cmljdGVyKGV2dCkgfHwgJChldnQudGFyZ2V0KTtcclxuXHRcdFx0ZHJhZ0Ryb3AoZXZ0LCBkZWZhdWx0cyk7XHJcblx0XHR9XHJcblx0fSk7XHJcbn07IiwiLyoqXHJcbiAqIOS6i+S7tueuoeeQhlxyXG4gKiBAY2xhc3MgRXZlbnRFbWl0dGVyXHJcbiAqL1xyXG5cclxuZnVuY3Rpb24gaW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVycywgbGlzdGVuZXIpIHtcclxuXHR2YXIgaSA9IGxpc3RlbmVycy5sZW5ndGg7XHJcblx0d2hpbGUgKGktLSkge1xyXG5cdFx0aWYgKGxpc3RlbmVyc1tpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHtcclxuXHRcdFx0cmV0dXJuIGk7XHJcblx0XHR9XHJcblx0fVxyXG5cdHJldHVybiAtMTtcclxufVxyXG5cclxuZnVuY3Rpb24gaXNWYWxpZExpc3RlbmVyKGxpc3RlbmVyKSB7XHJcblx0aWYgKHR5cGVvZiBsaXN0ZW5lciA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fSBlbHNlIGlmIChsaXN0ZW5lciAmJiB0eXBlb2YgbGlzdGVuZXIgPT09ICdvYmplY3QnKSB7XHJcblx0XHRyZXR1cm4gaXNWYWxpZExpc3RlbmVyKGxpc3RlbmVyLmxpc3RlbmVyKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxufVxyXG5cclxuY2xhc3MgRXZlbnRFbWl0dGVyIHtcclxuXHJcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xyXG5cclxuXHR9XHJcblx0LyoqXHJcblx0KlxyXG5cdCpcclxuXHQqXHJcblx0KlxyXG5cdCovXHJcblx0X2dldEV2ZW50cygpIHtcclxuXHRcdHJldHVybiB0aGlzLl9ldmVudHMgfHwgKHRoaXMuX2V2ZW50cyA9IHt9KTtcclxuXHR9XHJcblx0LyoqXHJcblx0KiDpgJrov4fkuovku7blkI3ojrflj5ZsaXN0ZW5lciDmlbDnu4TmiJbliJ3lp4vljJZcclxuXHQqIOS9v+eUqOato+WImeWMuemFjeS8mui/lOWbnuS4gOS4quWvueW6lOeahOWvueixoVxyXG5cdCpcclxuXHQqIFxyXG5cdCogZ2V0TGlzdGVuZXJzXHJcblx0KiBAcGFyYW0ge1N0cmluZyB9IFJlZ0V4cH0gZXZlbnROYW1lXHJcblx0KiBAcmV0dXJuIHtGdW5jdG9uW10gfCBPYmplY3R9XHJcblx0KlxyXG5cdCovXHJcblx0Z2V0TGlzdGVuZXJzKG5hbWUpIHtcclxuXHRcdHZhciBldmVudHMgPSB0aGlzLl9nZXRFdmVudHMoKTtcclxuXHRcdHZhciByZXNwb25zZTtcclxuXHRcdHZhciBrZXk7XHJcblxyXG5cdFx0aWYgKG5hbWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcclxuXHRcdFx0cmVzcG9uc2UgPSB7fTtcclxuXHRcdFx0Zm9yIChrZXkgaW4gZXZlbnRzKSB7XHJcblx0XHRcdFx0aWYgKGV2ZW50cy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIG5hbWUudGVzdChrZXkpKSB7XHJcblx0XHRcdFx0XHRyZXNwb25zZVtrZXldID0gZXZlbnRzW2tleV07XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyZXNwb25zZSA9IGV2ZW50c1tuYW1lXSB8fCAoZXZlbnRzW25hbWVdID0gW10pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiByZXNwb25zZTtcclxuXHR9XHJcblx0LyoqXHJcblx0KiDpgJrov4fkuovku7blkI3ojrflj5ZsaXN0ZW5lciDlp4vnu4jov5Tlm57kuIDkuKrlr7nosaFcclxuXHQqXHJcblx0KiBcclxuXHQqIGdldExpc3RlbmVyc0FzT2JqZWN0XHJcblx0KiBAcGFyYW0ge1N0cmluZ3xSZWdFeHB9IGV2ZW50TmFtZVxyXG5cdCogQHJldHVybiB7T2JqZWN0fVxyXG5cdCovXHJcblx0Z2V0TGlzdGVuZXJzQXNPYmplY3QobmFtZSkge1xyXG5cdFx0dmFyIGxpc3RlbmVycyA9IHRoaXMuZ2V0TGlzdGVuZXJzKG5hbWUpO1xyXG5cdFx0dmFyIHJlc3BvbnNlO1xyXG5cclxuXHRcdGlmIChsaXN0ZW5lcnMgaW5zdGFuY2VvZiBBcnJheSkge1xyXG5cdFx0XHRyZXNwb25zZSA9IHt9O1xyXG5cdFx0XHRyZXNwb25zZVtuYW1lXSA9IGxpc3RlbmVycztcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcmVzcG9uc2UgfHwgbGlzdGVuZXJzO1xyXG5cdH1cclxuXHQvKipcclxuXHQqIOiOt+WPliBsaXN0ZW5lciDliJfooahcclxuXHQqXHJcblx0KiBmbGF0dGVuTGlzdGVuZXJzXHJcblx0KlxyXG5cdCogQHBhcmFtIHsgT2JqZWN0W119IGxpc3RlbmVyc1xyXG5cdCogQHJldHVybiB7RnVuY3Rpb25bXX1cclxuXHQqL1xyXG5cdGZsYXR0ZW5MaXN0ZW5lcnMobGlzdGVuZXJzKSB7XHJcblx0XHR2YXIgZmxhdExpc3RlbmVycyA9IFtdO1xyXG5cclxuXHRcdGZvciAodmFyIGkgPSAwLCBsID0gbGlzdGVuZXIubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcblx0XHRcdGZsYXRMaXN0ZW5lcnMucHVzaChsaXN0ZW5lcnNbaV0ubGlzdGVuZXIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmbGF0TGlzdGVuZXJzO1xyXG5cdH1cclxuXHQvKipcclxuXHQqIOS6i+S7tuazqOWGjFxyXG5cdCpcclxuXHQqXHJcblx0KiBAZXhhbXBlbFxyXG5cdCogdmFyIGVtdCA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcclxuXHQqIGVtdC5hZGRMaXN0ZW5lcignZGl2OmhvdmVyJywgZnVuY3Rpb24oKXtcclxuXHQqXHQvLyBkb1xyXG5cdCogfSk7XHJcblx0KiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lXHJcblx0KiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxyXG5cdCogQHJldHVybiB7T2JqZWN0an1cclxuXHQqXHJcblx0Ki9cclxuXHRhZGRMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lciwgZmxhZykge1xyXG5cdFx0aWYgKCFpc1ZhbGlkTGlzdGVuZXIobGlzdGVuZXIpKSB7XHJcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBsaXN0ZW5lcnMgPSB0aGlzLmdldExpc3RlbmVyc0FzT2JqZWN0KG5hbWUpO1xyXG5cdFx0dmFyIGxpc3RlbmVySXNXcmFwcGVkID0gdHlwZW9mIGxpc3RlbmVyID09PSAnb2JqZWN0JztcclxuXHRcdHZhciBrZXksIHN0YXJ0LCBhcmdzO1xyXG5cclxuXHRcdGZvciAoa2V5IGluIGxpc3RlbmVycykge1xyXG5cdFx0XHRpZiAobGlzdGVuZXJzLmhhc093blByb3BlcnR5KGtleSkgJiYgaW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVycywgbGlzdGVuZXIpID09PSAtMSkge1xyXG5cclxuXHRcdFx0XHRzdGFydCA9IGxpc3RlbmVyc1trZXldLmxlbmd0aDtcclxuXHJcblx0XHRcdFx0bGlzdGVuZXJzW2tleV0ucHVzaChsaXN0ZW5lcklzV3JhcHBlZCA/IGxpc3RlbmVyIDoge1xyXG5cdFx0XHRcdFx0bGlzdGVuZXI6IGxpc3RlbmVyLFxyXG5cdFx0XHRcdFx0b25jZTogZmFsc2VcclxuXHRcdFx0XHR9KTtcclxuXHJcblx0XHRcdFx0aWYgKGZsYWcgJiYgbGlzdGVuZXJzW2tleV0uYXJncykge1xyXG5cdFx0XHRcdFx0bGlzdGVuZXJzW2tleV0uc3RhcnQgPSBzdGFydDtcclxuXHRcdFx0XHRcdGFyZ3MgPSBsaXN0ZW5lcnNba2V5XS5hcmdzO1xyXG5cdFx0XHRcdFx0dGhpcy5lbWl0RXZlbnQobmFtZSwgYXJncyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRvbigpIHtcclxuXHRcdHJldHVybiB0aGlzLmFkZExpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cclxuXHRvbmUobmFtZSwgbGlzdGVuZXIsIGZsYWcpIHtcclxuXHRcdHJldHVybiB0aGlzLnJlbW92ZUV2ZW50KG5hbWUpLmFkZExpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiDkuovku7bms6jlhozvvIzop6blj5HlkI7oh6rliqjnp7vpmaRcclxuXHQgKlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZVxyXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyXHJcblx0ICogQHJldXRuciB7T2JqZWN0fVxyXG5cdCAqXHJcblx0ICovXHJcblx0YWRkT25jZUxpc3RlbmVyKG5hbWUsIGxpc3RlbmVyKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5hZGRMaXN0ZW5lcihuYW1lLCB7XHJcblx0XHRcdGxpc3RlbmVyOiBsaXN0ZW5lcixcclxuXHRcdFx0b25jZTogdHJ1ZVxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHRvbmNlKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuYWRkT25jZUxpc3RlbmVyLmFwcGx5KHRoaXMuYXJndW1lbnRzKTtcclxuXHR9XHJcblx0LyoqXHJcblx0ICog5LqL5Lu26ZSA5q+BXHJcblx0ICpcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBldmVudE5hbWVcclxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxyXG5cdCAqIEByZXR1cm4ge09iamVjdH1cclxuXHQgKlxyXG5cdCAqL1xyXG5cdHJlbW92ZUxpc3RlbmVyKG5hbWUsIGxpc3RlbmVyKSB7XHJcblx0XHR2YXIgbGlzdGVuZXJzID0gdGhpcy5nZXRMaXN0ZW5lcnNBc09iamVjdChuYW1lKTtcclxuXHRcdHZhciBpbmRleDtcclxuXHRcdHZhciBrZXk7XHJcblxyXG5cdFx0Zm9yIChrZXkgaW4gbGlzdGVuZXJzKSB7XHJcblx0XHRcdGlmIChsaXN0ZW5lcnMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xyXG5cdFx0XHRcdGluZGV4ID0gaW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVyc1trZXldLCBsaXN0ZW5lcik7XHJcblxyXG5cdFx0XHRcdGlmIChpbmRleCAhPT0gLTEpIHtcclxuXHRcdFx0XHRcdGxpc3RlbmVyc1trZXldLnNwbGljZShpbmRleCwgaSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRvZmYoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5yZW1vdmVMaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cdH1cclxuXHJcblx0bWFuaXB1bGF0ZUxpc3RlbmVycyhyZW1vdmUsIG5hbWUsIGxpc3RlbmVycykge1xyXG5cdFx0dmFyIHNpbmdsZSA9IHJlbW92ZSA/IHRoaXMucmVtb3ZlTGlzdGVuZXIgOiB0aGlzLmFkZExpc3RlbmVyO1xyXG5cdFx0dmFyIG11dGlwbGUgPSByZW1vdmUgPyB0aGlzLnJlbW92ZUxpc3RlbmVycyA6IHRoaXMuYWRkTGlzdGVuZXJzO1xyXG5cdFx0dmFyIGk7XHJcblx0XHR2YXIgdjtcclxuXHJcblx0XHRpZiAodHlwZW9mIG5hbWUgPT09ICdvYmplY3QnICYmICEobmFtZSBpbnN0YW5jZW9mIFJlZ0V4cCkpIHtcclxuXHRcdFx0Zm9yIChpIGluIG5hbWUpIHtcclxuXHRcdFx0XHRpZiAobmFtZS5oYXNPd25Qcm9wZXJ0eShpKSAmJiAodiA9IG5hbWVbaV0pKSB7XHJcblx0XHRcdFx0XHRpZiAodHlwZW9mIHYgPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0XHRcdFx0c2luZ2xlLmNhbGwodGhpcywgaSwgdik7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRtdXRpcGxlLmNhbGwodGhpcywgaSwgdik7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRpID0gMDtcclxuXHRcdFx0diA9IGxpc3RlbmVycy5sZW5ndGg7XHJcblx0XHRcdHdoaWxlIChpIDwgdikge1xyXG5cdFx0XHRcdHNpbmdsZS5jYWxsKHRoaXMsIG5hbWUsIGxpc3RlbmVyc1tpKytdKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cdH1cclxuXHJcblx0YWRkTGlzdGVuZXJzKG5hbWUsIGxpc3RlbmVycykge1xyXG5cdFx0cmV0dXJuIHRoaXMubWFuaXB1bGF0ZUxpc3RlbmVycyhmYWxzZSwgbmFtZSwgbGlzdGVuZXJzKTtcclxuXHR9XHJcblxyXG5cdHJlbW92ZUxpc3RlbmVycyhuYW1lLCBsaXN0ZW5lcnMpIHtcclxuXHRcdHJldHVybiB0aGlzLm1hbmlwdWxhdGVMaXN0ZW5lcnModHJ1ZSwgbmFtZSwgbGlzdGVuZXJzKTtcclxuXHR9XHJcblxyXG5cdHJlbW92ZUV2ZW50KG5hbWUpIHtcclxuXHRcdHZhciBldmVudHMgPSB0aGlzLl9nZXRFdmVudHMoKTtcclxuXHRcdHZhciBrZXk7XHJcblxyXG5cdFx0aWYgKHR5cGVvZiBuYW1lID09PSAnc3RyaW5nJykge1xyXG5cdFx0XHQvLyDnp7vpmaTmiYDmnInmjIflrprkuovku7blkI3nmoTmiYDmnIlsaXN0ZW5lcnNcclxuXHRcdFx0Ly8gZGVsZXRlIGV2ZW50c1tuYW1lXVxyXG5cdFx0XHRpZiAoZXZlbnRzW25hbWVdIGluc3RhbmNlb2YgQXJyYXkpIHtcclxuXHRcdFx0XHRldmVudHNbbmFtZV0ubGVuZ3RoID0gMDtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIGlmIChuYW1lIGluc3RhbmNlb2YgUmVnRXhwKSB7XHJcblx0XHRcdC8vIOato+WImeWMuemFjeeahOaJgOaciSBsaXN0ZW5lcnNcclxuXHRcdFx0Zm9yIChrZXkgaW4gZXZlbnRzKSB7XHJcblx0XHRcdFx0aWYgKGV2ZW50cy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIG5hbWUudGVzdChrZXkpKSB7XHJcblx0XHRcdFx0XHQvLyBkZWxldGUgZXZlbnRzW2tleV1cclxuXHRcdFx0XHRcdGlmIChldmVudHNba2V5XSBpbnN0YW5jZW9mIEFycmF5KSB7XHJcblx0XHRcdFx0XHRcdGV2ZW50W2tleV0ubGVuZ3RoID0gMDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdC8vIOenu+mZpOaJgOaciSBsaXN0ZW5lcnNcclxuXHRcdFx0ZGVsZXRlIHRoaXMuX2V2ZW50cztcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdHJlbW92ZUFsbExpc3RlbmVycygpIHtcclxuXHRcdHJldHVybiB0aGlzLnJlbW92ZUV2ZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cdC8qKlxyXG5cdCAqIOS6i+S7tuinpuWPkVxyXG5cdCAqXHJcblx0ICpcclxuXHQgKiBAZXhhbXBsZVxyXG5cdCAqIHZhciBlbXQgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XHJcblx0ICogc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuXHQgKiBcdGVtdC5lbWl0RXZlbnQoJ2Rpdjpob3ZlcicsIDEpO1xyXG5cdCAqIH0sIDEwMDApO1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSDkuovku7blkI3np7BcclxuXHQgKiBAcGFyYW0ge0FycmF5fSBbYXJnc10gSFRNTERvY3VtZW50LCBpdGVtRGF0YSwgLi4uXHJcblx0ICogQHJldHVybiB7T2JqZWN0fVxyXG5cdCAqXHJcblx0ICovXHJcblx0ZW1pdEV2ZW50KG5hbWUsIGFyZ3MpIHtcclxuXHRcdHZhciBsaXN0ZW5lcnNNYXAgPSB0aGlzLmdldExpc3RlbmVyc0FzT2JqZWN0KG5hbWUpO1xyXG5cdFx0dmFyIGxpc3RlbmVycztcclxuXHRcdHZhciBsaXN0ZW5lcjtcclxuXHRcdHZhciBpO1xyXG5cdFx0dmFyIGw7XHJcblx0XHR2YXIga2V5O1xyXG5cdFx0dmFyIHJlc3BvbnNlO1xyXG5cclxuXHRcdGZvciAoa2V5IGluIGxpc3RlbmVyc01hcCkge1xyXG5cdFx0XHRpZiAobGlzdGVuZXJzTWFwLmhhc093blByb3BlcnR5KGtleSkpIHtcclxuXHRcdFx0XHRsaXN0ZW5lcnMgPSBsaXN0ZW5lcnNNYXBba2V5XS5zbGljZSgwKTtcclxuXHJcblx0XHRcdFx0bGlzdGVuZXJzTWFwW2tleV0uYXJncyA9IGFyZ3M7XHJcblxyXG5cdFx0XHRcdGkgPSBsaXN0ZW5lcnNNYXBba2V5XS5zdGFydCB8fCAwO1xyXG5cdFx0XHRcdGxpc3RlbmVyc01hcFtrZXldLnN0YXJ0ID0gMDtcclxuXHJcblx0XHRcdFx0Zm9yIChsID0gbGlzdGVuZXJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG5cdFx0XHRcdFx0bGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV07XHJcblxyXG5cdFx0XHRcdFx0aWYgKGxpc3RlbmVyLm9uY2UgPT09IHRydWUpIHtcclxuXHRcdFx0XHRcdFx0dGhpcy5yZW1vdmVMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lci5saXN0ZW5lcik7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0cmVzcG9uc2UgPSBsaXN0ZW5lci5saXN0ZW5lci5hcHBseSh0aGlzLCBhcmdzIHx8IFtdKTtcclxuXHJcblx0XHRcdFx0XHRpZiAocmVzcG9uc2UgPT09IHRoaXMuX2dldE9uY2VSZXR1cm5WYWx1ZSgpKSB7XHJcblx0XHRcdFx0XHRcdHRoaXMucmVtb3ZlTGlzdGVuZXIobmFtZSwgbGlzdGVuZXIubGlzdGVuZXIpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHR0cmlnZ2VyKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuZW1pdEV2ZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblx0fVxyXG5cclxuXHRmaXJlKG5hbWUpIHtcclxuXHRcdHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcclxuXHRcdHJldHVybiB0aGlzLmVtaXRFdmVudChuYW1lLCBhcmdzKTtcclxuXHR9XHJcblxyXG5cdF9nZXRPbmNlUmV0dXJuVmFsdWUoKSB7XHJcblx0XHRpZiAodGhpcy5oYXNPd25Qcm9wZXJ0eSgnX29uY2VSZXR1cm5WYWx1ZScpKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLl9vbmNlUmV0dXJuVmFsdWU7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdHNldE9uY2VSZXR1cm5WYWx1ZSh2YWx1ZSkge1xyXG5cdFx0dGhpcy5fb25jZVJldHVyblZhbHVlID0gdmFsdWU7XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG5cdGRlZmluZUV2ZW50KG5hbWUpIHtcclxuXHRcdHRoaXMuZ2V0TGlzdGVuZXJzKG5hbWUpO1xyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblx0fVxyXG5cclxuXHRkZWZpbmVFdmVudHMobmFtZXMpIHtcclxuXHRcdGZvciAodmFyIGkgPSAwLCBsID0gbmFtZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcblx0XHRcdHRoaXMuZGVmaW5lRXZlbnQobmFtZVtpXSk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9XHJcblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcclxuXHJcblxyXG4iLCJmdW5jdGlvbiBzd2FwKGFyciwgczEsIHMyKSB7XHJcblx0dmFyIHRlbXAgPSBhcnJbczFdO1xyXG5cdGFycltzMV0gPSBhcnJbczJdO1xyXG5cdGFycltzMl0gPSB0ZW1wO1xyXG59XHJcblxyXG5mdW5jdGlvbiByYW5kb21WYWx1ZShhcnIpIHtcclxuXHR2YXIgciA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGFyci5sZW5ndGgpO1xyXG5cdC8vIHN3YXAoYXJyLCAwLCByKTtcclxuXHRyZXR1cm4gW2FycltyXSwgYXJyLmZpbHRlcigoZCwgaSkgPT4gaSAhPT0gcildO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmaWx0ZXJMQW5kUihhcnIsIHNlbGVjdCwgY29tcGFyZUZuKSB7XHJcblx0dmFyIGxlZnRBcnIgPSBbXTtcclxuXHR2YXIgcmlnaHRBcnIgPSBbXTtcclxuXHJcblx0Zm9yICh2YXIgaSA9IDAsIGxlbiA9IGFyci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xyXG5cdFx0bGV0IHRlbXAgPSBhcnJbaV07XHJcblx0XHRsZXQgY29tcGFyZWQgPSBjb21wYXJlRm4oc2VsZWN0LCB0ZW1wKTtcclxuXHRcdGlmIChjb21wYXJlZCA+IDApIHJpZ2h0QXJyLnB1c2godGVtcCk7XHJcblx0XHRlbHNlIGlmIChjb21wYXJlZCA8IDApIGxlZnRBcnIucHVzaCh0ZW1wKTtcclxuXHRcdGVsc2UgTWF0aC5yYW5kb20oKSA+IDAuNSA/IHJpZ2h0QXJyLnB1c2godGVtcCkgOiBsZWZ0QXJyLnB1c2godGVtcCk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gW2xlZnRBcnIsIHJpZ2h0QXJyXTtcclxufVxyXG5cclxuZnVuY3Rpb24gZmluZEluZGV4KGFyciwgaW5kZXgsIGNvbXBhcmVGbikge1xyXG5cdGlmIChhcnIubGVuZ3RoIDw9IDEgfHwgaW5kZXggPT09IDApIHJldHVybiBhcnJbMF07XHJcblx0dmFyIFtzZWxlY3QsIHNlY19hcnJdID0gcmFuZG9tVmFsdWUoYXJyKTtcclxuXHR2YXIgW2xlZnRBcnIsIHJpZ2h0QXJyXSA9IGZpbHRlckxBbmRSKHNlY19hcnIsIHNlbGVjdCwgY29tcGFyZUZuKTtcclxuXHR2YXIgbiA9IHJpZ2h0QXJyLmxlbmd0aDtcclxuXHJcblx0aWYgKG4gPT09IGluZGV4IC0gMSkgcmV0dXJuIHNlbGVjdDtcclxuXHRpZiAobiA+PSBpbmRleCkgcmV0dXJuIGZpbmRJbmRleChyaWdodEFyciwgaW5kZXgsIGNvbXBhcmVGbik7XHJcblx0ZWxzZSByZXR1cm4gZmluZEluZGV4KGxlZnRBcnIsIGluZGV4IC0gbiAtIDEsIGNvbXBhcmVGbik7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZmluZEluZGV4OyIsInZhciBVdGlscyA9IHt9O1xyXG5cclxudmFyIHVpZCA9IFV0aWxzLnVpZCA9ICgoKSA9PiB7XHJcblx0bGV0IHQgPSBEYXRlLm5vdygpO1xyXG5cdHJldHVybiAoKSA9PiB7XHJcblx0XHRyZXR1cm4gKHQrKykudG9TdHJpbmcoMTYpO1xyXG5cdH07XHJcbn0pKCk7XHJcblxyXG5cclxudmFyIG1lcmdlID0gVXRpbHMubWVyZ2UgPSAodGFyZ2V0LCBhZGRpdGlvbmFsLCBkZWVwKSA9PiB7XHJcblx0bGV0IGRlcHRoID0gdHlwZW9mIGRlZXAgPT0gJ3VuZGVmaW5lZCcgPyAyIDogZGVlcCwgcHJvcDtcclxuXHJcblx0Zm9yIChwcm9wIGluIGFkZGl0aW9uYWwpIHtcclxuXHRcdGlmIChhZGRpdGlvbmFsLmhhc093blByb3BlcnR5KHByb3ApKSB7XHJcblx0XHRcdGlmICh0eXBlb2YgdGFyZ2V0W3Byb3BdICE9PSAnb2JqZWN0JyB8fCAhZGVwdGgpIHtcclxuXHRcdFx0XHR0YXJnZXRbcHJvcF0gPSBhZGRpdGlvbmFsW3Byb3BdO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFV0aWxzLm1lcmdlKHRhcmdldFtwcm9wXSwgYWRkaXRpb25hbFtwcm9wXSwgZGVwdGggLSAxKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHRhcmdldDtcclxufTtcclxuXHJcbnZhciBmaW5kSW5kZXggPSBVdGlscy5maW5kSW5kZXggPSByZXF1aXJlKCcuL0ZpbmRJbmRleCcpO1xyXG52YXIgY29tcGFyZUZuID0gVXRpbHMuY29tcGFyZUZuID0gcmVxdWlyZSgnLi91dGlscy9Db21wYXJlcicpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBVdGlsczsiLCJ2YXIgY29udGV4dCA9IHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnID8gdGhpcyA6IHdpbmRvdztcclxuZXhwb3J0cy4kID0gY29udGV4dC4kO1xyXG5leHBvcnRzLl8gPSBjb250ZXh0Ll87IiwiLyoqXHJcbiAqIOWIm+W7uuavlOi+g+WHveaVsFxyXG4gKiBAc3VtbWFyeSDnuqbmnZ/mnaHku7bvvIzlj6rpkojlr7nlr7nosaHmlbDnu4Tnu5PmnoTnmoTmlbDmja7vvIzlpoJcclxuICogICAgICBbe1wiY29sXzFcIjogMTAsIFwiY29sXzJcIjogMzUsIFwiY29sXzNcIjogNjZ9LCAuLi5dXHJcbiAqXHJcbiAqIEBleGFtcGxlXHJcbiAqXHJcbiAqICB2YXIgc29ydHMgPSBbJ0EnLCdCJywnQycsJ0QnXTtcclxuICogIHZhciBkaXJzID0gWzEsIC0xLCAxLCAxXTtcclxuICpcclxuICogIHZhciBkYXRhMyA9IFtcclxuICogICAgICB7QToxLEI6MSxDOjUsX2lkOjF9LFxyXG4gKiAgICAgIHtBOjEsQjozLEM6NSxfaWQ6MX0sXHJcbiAqICAgICAge0E6MixCOjUsQzo0LF9pZDoyfSxcclxuICogICAgICB7QToxLEI6MSxDOjksX2lkOjF9LFxyXG4gKiAgICAgIHtBOjMsQjozLEM6MyxfaWQ6M30sXHJcbiAqICAgICAge0E6MSxCOjEsQzozLF9pZDoxfSxcclxuICogICAgICB7QTo0LEI6MixDOjIsX2lkOjR9LFxyXG4gKiAgICAgIHtBOjUsQjo0LEM6MSxfaWQ6NX0sXHJcbiAqICBdO1xyXG4gKlxyXG4gKiAgdmFyIGZuID0gY29tcGFyZUZuKHNvcnRzLCBkaXJzKTtcclxuICogIHZhciByZXQgPSBkYXRhMy5zb3J0KGZuKS5tYXAoZCA9PiBPYmplY3QudmFsdWVzKGQpKTtcclxuICogIGNvbnNvbGUuZGlyKHJldCk7XHJcbiAqXHJcbiAqIEBwYXJhbSB7QXJyYXl9IHNvcnRzIC3mjpLluo/lrZfmrrXmlbDnu4QgWydjb2xfMScsICdjb2xfMicsICdjb2xfMycsLi4uXVxyXG4gKiBAcGFyYW0ge0FycmF5fSBkaXJzIC3lr7nlupTlrZfkvZPmjpLluo/mlbDnu4TnmoTljYfpmY3luo8sMe+8muWNh+W6jyAtMe+8mumZjeW6jyBbMSwgLTFdXHJcbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0g5q+U6L6D5Ye95pWwXHJcbiAqL1xyXG5leHBvcnRzLmNvbXBhcmVGbiA9IGZ1bmN0aW9uIGNvbXBhcmVGbihzb3J0cywgZGlycykge1xyXG4gICAgdmFyIGNvbmRpdGlvbnMgPSBzb3J0cy5yZWR1Y2UoKHByZSwgbmV4dCwgaSkgPT4ge1xyXG4gICAgICAgIHByZSAgPSBwcmUgPyBwcmUgKyAnIHx8JyA6ICcnO1xyXG4gICAgICAgIHJldHVybiBgJHtwcmV9IChhLiR7bmV4dH0gLSBiLiR7bmV4dH0pICogJHtkaXJzW2ldfWA7XHJcbiAgICB9LCAnJyk7XHJcblxyXG4gICAgdmFyIGZ1bmN0aW9uX2JvZHkgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICBsZXQgc29ydEluZm8gPSBzb3J0cy5qb2luKCcsJykucmVwbGFjZSgvKFxcdyspL2csICdcIiQxXCInKTtcclxuICAgICAgICByZXR1cm4gYHZhciBzb3J0ID0gWyR7c29ydEluZm99XTsgcmV0dXJuICR7Y29uZGl0aW9uc31gO1xyXG4gICAgfVxyXG4gICAgLy8gY29uc29sZS5sb2coZnVuY3Rpb25fYm9keSgpKTtcclxuICAgIFxyXG4gICAgcmV0dXJuIG5ldyBGdW5jdGlvbignYScsICdiJywgZnVuY3Rpb25fYm9keSgpKTtcclxufVxyXG5cclxuXHJcbiJdfQ==
