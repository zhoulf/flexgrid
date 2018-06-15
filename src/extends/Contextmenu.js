var Selection = require('./Selection');
var Menu = require('../plugin/Menu');
var $  = require('jQuery');
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