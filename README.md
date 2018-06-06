
# FlexGrid.js

**先上个基础的预览效果图**
![alt text](https://github.com/zhoulf/flexgrid/blob/master/data/website.PNG "flexgrid")

点击 [https://zhoulf.github.io/flexgrid/](https://zhoulf.github.io/flexgrid/ "flexgrid") 访问页面

### 快速上手代码

`<script>

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
`

### API (待补充)

#### 主要属性
<table>
	<tr>
		<td>名称</td>
		<td>说明</td>
	</tr>
	<tr>
		<td>columnModel</td>
		<td>列模型对象</td>
	</tr>
	<tr>
		<td>store</td>
		<td>数据仓库</td>
	</tr>
</table>

#### 主要方法
<table>
	<tr>
		<td>名称</td>
		<td>说明</td>
	</tr>
	<tr>
		<td>render()</td>
		<td>渲染函数</td>
	</tr>
	<tr>
		<td>destory()</td>
		<td>销毁函数</td>
	</tr>
	<tr>
		<td>setWidth()</td>
		<td>设置宽度</td>
	</tr>
	<tr>
		<td>setHeight()</td>
		<td>设置高度</td>
	</tr>
	<tr>
		<td>scrollToTop()</td>
		<td>滚动到顶部</td>
	</tr>
</table>

#### 主要事件
<table>
	<tr>
		<td>名称</td>
		<td>说明</td>
	</tr>
	<tr>
		<td>...</td>
		<td>...</td>
	</tr>
</table>

### 更新(待补充)

### 参考

[强大的在线表格编辑器](http://demos.componentone.com/ASPNET/MVCExplorer/FlexGrid/Globalization?culture=zh-HK "flexgrid")