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