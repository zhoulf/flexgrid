var Selection = require('./Selection');
var Menu = require('../plugin/Menu');

/**
 * 在JS的世界，没有真正的class类，只有拷贝和基于原型两种，（注：在 ES2015/ES6 中引入了class关键字，但只是语法糖，JavaScript 仍然是基于原型的）
 * 在原型链上查找属性比较耗时，对性能有副作用，这在性能要求苛刻的情况下很重要。另外，试图访问不存在的属性时会遍历整个原型链。遍历对象的属性时，原型链上的每个可枚举属性都会被枚举出来。要检查对象是否具有自己定义的属性，而不是其原型链上的某个属性，则必须使用所有对象从Object.prototype继承的 hasOwnProperty 方法
 * ref(https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Inheritance_and_the_prototype_chain)
 * 拷贝方式有基于call和apply的构造函数上下文修改、也可以直接克隆对象
 * 下面演示基于原型的继承，记住prototype是
 */

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

				if (this.data.vtype === 'number') {
					this.set('sum-id', 'hidden');
				} else {
					this.set('sum-id', 'visiable');
				}
				
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
				separator: true 
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
				disabled: true,
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
				id: 'sum-id',
				text: 'sum', 
				callback(evt) { 
					
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