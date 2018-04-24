var Selection = require('./Selection');

const CELL_CLS = 'li.c-grid-cell';
const CELL_SELECTED_CLS = 'c-cell-selected';
const ROW_CLS = '.c-grid-row';

class Contextmenu extends Selection {
	constructor(options) {
		super(options);


	}

	_bindEvent($dom) {
		super._bindEvent();

		this.$dom.canvas
			.on('mousedown', CELL_CLS, function(evt) {
				if (evt.button === 2) {
					console.log('Contextmenu');
				}
			})
	}
}

module.exports = Contextmenu;