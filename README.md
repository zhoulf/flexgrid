<script>

		var data = createData(100000);

		var g = new sz.grid({
			'domEl': document.querySelector('.container'),
			'width': '100%',
			'height': 540,
			'columns': columns,
			'data': data
		});

		g.render();

		$('#match_value').on('input', _.debounce(function(evt) {
			var value = this.value, index;
			g.store.forEach(function(row, i) {
				if (row.GDDM.indexOf(value) !== -1) {
					index = i;
				}
			});

			g.scrollToTop(index * 38);
		}, 500));

		$('#columnToggle').on('change', function(evt) {
			g.columnModel.getColumnByDataIndex(this.value).toggle();
		});

		$('#columnLock').on('change', function(evt) {
			col = g.columnModel.getColumnByDataIndex(this.value);
			col.locked ? col.unLock() : col.lock();
		});
		// setInterval(function() {
		// 	g.store.setData(createData(1), true);
		// }, 1000);
	</script>