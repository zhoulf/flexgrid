var createData = function createData(total) {
	var mapYYBMC = ['中信证券南京营业部', '海通证券北京营业部', '东莞证券长安营业部', '国信证券广州营业部', '平安证券深圳营业部', '华厦证券上海营业部'];
	var mapYYBDQ = ['广州', '东莞', '深圳', '苏州', '云南', '大理', '哈尔浜', '大连', '长安', '张家口', '杭州'];
	var mapGDMC = ['张三', '李四', '王五', '赵六'];
	var plusMinus = [1, -1];
	var result = [];
	var i = 0;

	while (i < total) {
		result.push({
			"MRYC": i++,
			"CGYC": 0,
			"JMMZ": +Math.random().toFixed(3),
			"XGBG": 0,
			"YYBMC": mapYYBMC[Math.floor(Math.random()*6)],
			"YYBDQ": mapYYBDQ[Math.floor(Math.random()*8)],
			"GDDM": '004150'+Math.ceil(Math.random()*1000),
			"GDMC": mapGDMC[Math.floor(Math.random()*4)],
			"DYGLD": "1",
			"CJGS": Math.ceil(Math.random()*1000000),
			"QJMRSL": Math.ceil(Math.random()*1000000),
			"MRJJ": +(Math.random()*20000).toFixed(2),
			"MCJJ": +(Math.random()*100).toFixed(2),
			"MCGS": Math.ceil(Math.random() * 3000),
			"MCJE": +(Math.random()*100000).toFixed(3),
			"JMMGS": +(Math.random()*100000000).toFixed(3),
			"JMMJE": Math.ceil(Math.random()*200000),
			"CJBL": +Math.random().toFixed(2)
		});
	}
	return result;
}

if (this.module && this.module.exports) {
	exports.createData = createData;
}
var columns = [
	{text:'买入异常', 	  dataIndex: "MRYC", width: 98, align: 'center' },
	{text:'持股异常', 	  dataIndex: "CGYC", width: 98, align: 'center' },
	// {text:'营业部名称',   dataIndex: "YYBMC", width: 98 },
	{text:'净买卖值', 	  dataIndex: "JMMZ", width: 88, align: 'right', vtype: 'number', renderer(v) { return '<a class="red">'+v+'</a>';} },
	{text:'习惯变更', 	  dataIndex: "XGBG", width: 88 },
	{text:'<a>操作</a>',   					width: 88, renderer() { return '<a href="javascript:void(0)">详情</a>'} },
	{text:'营业部名称',   dataIndex: "YYBMC", width: 120 },
	{text:'营业部地区',   dataIndex: "YYBDQ", width: 88 },
	{text:'股东代码', 	  dataIndex: "GDDM", width: 108, align: 'center'  },
	{text:'股东名称', 	  dataIndex: "GDMC", width: 88, align: 'right' },
	{text:'地域关联度',   dataIndex: "DYGLD", width: 126 },
	{text:'成交股数', 	  dataIndex: "CJGS", width: 88, vtype: 'number', align: 'right'  },
	{text:'期间买入数量', dataIndex: "QJMRSL", width: 128, align: 'right' },
	{text:'买入均价', 	  dataIndex: "MRJJ", width: 128, align: 'right' },
	{text:'卖出股数', 	  dataIndex: "MCGS", width: 118, align: 'right' },
	{text:'卖出金额', 	  dataIndex: "MCJE", width: 128, align: 'right' },
	{text:'卖出均价', 	  dataIndex: "MCJJ", width: 118, align: 'right' },
	{text:'净买卖股数',   dataIndex: "JMMGS", width: 128, align: 'right' },
	{text:'净买卖金额',   dataIndex: "JMMJE", width: 128, align: 'right' },
	{text:'股东代码', 	  dataIndex: "GDDM", width: 108, align: 'center'  },
	{text:'股东名称', 	  dataIndex: "GDMC", width: 88, align: 'right' },
	{text:'地域关联度',   dataIndex: "DYGLD", width: 126 },
	{text:'成交股数', 	  dataIndex: "CJGS", width: 88, vtype: 'number', align: 'right'  },
	{text:'期间买入数量', dataIndex: "QJMRSL", width: 128, align: 'right' },
	{text:'买入均价', 	  dataIndex: "MRJJ", width: 128, align: 'right' },
	{text:'卖出股数', 	  dataIndex: "MCGS", width: 118, align: 'right' },
	{text:'卖出金额', 	  dataIndex: "MCJE", width: 128, align: 'right' },
	{text:'卖出均价', 	  dataIndex: "MCJJ", width: 118, align: 'right' },
	{text:'净买卖股数',   dataIndex: "JMMGS", width: 128, align: 'right' },
	{text:'净买卖金额',   dataIndex: "JMMJE", width: 128, align: 'right' },
	{text:'股东代码', 	  dataIndex: "GDDM", width: 108, align: 'center'  },
	{text:'股东名称', 	  dataIndex: "GDMC", width: 88, align: 'right' },
	{text:'地域关联度',   dataIndex: "DYGLD", width: 126 },
	{text:'成交股数', 	  dataIndex: "CJGS", width: 88, vtype: 'number', align: 'right'  },
	{text:'期间买入数量', dataIndex: "QJMRSL", width: 128, align: 'right' },
	{text:'买入均价', 	  dataIndex: "MRJJ", width: 128, align: 'right' },
	{text:'卖出股数', 	  dataIndex: "MCGS", width: 118, align: 'right' },
	{text:'卖出金额', 	  dataIndex: "MCJE", width: 128, align: 'right' },
	{text:'卖出均价', 	  dataIndex: "MCJJ", width: 118, align: 'right' },
	{text:'净买卖股数',   dataIndex: "JMMGS", width: 128, align: 'right' },
	{text:'净买卖金额',   dataIndex: "JMMJE", width: 128, align: 'right' },
	{text:'股东代码', 	  dataIndex: "GDDM", width: 108, align: 'center'  },
	{text:'股东名称', 	  dataIndex: "GDMC", width: 88, align: 'right' },
	{text:'地域关联度',   dataIndex: "DYGLD", width: 126 },
	{text:'成交股数', 	  dataIndex: "CJGS", width: 88, vtype: 'number', align: 'right'  },
	{text:'期间买入数量', dataIndex: "QJMRSL", width: 128, align: 'right' },
	{text:'买入均价', 	  dataIndex: "MRJJ", width: 128, align: 'right' },
	{text:'卖出股数', 	  dataIndex: "MCGS", width: 118, align: 'right' },
	{text:'卖出金额', 	  dataIndex: "MCJE", width: 128, align: 'right' },
	{text:'卖出均价', 	  dataIndex: "MCJJ", width: 118, align: 'right' },
	{text:'净买卖股数',   dataIndex: "JMMGS", width: 128, align: 'right' },
	{text:'净买卖金额',   dataIndex: "JMMJE", width: 128, align: 'right' },
	{text:'成交笔数',   dataIndex: "CJBL", width: 88, align: 'right' }
];

var CJGS = [
	{text: 'open-link-1', handler: function() { console.log('1-3'); }}, 
	{text: 'open-link-2', handler: function() {}, disabled: true }, 
	{separator: true },
	{text: 'open-link-3', handler: function(value, colM) { } }
];
var XGBG = [
	{text: 'open-link-4', handler: function() { console.log('4-6'); } }, 
	{text: 'open-link-5', handler: function() {} }, 
	{text: 'open-link-6', handler: function(value, colM) { } }
];

var colModel = { CJGS: CJGS, XGBG: XGBG };
var bizContextMenu = {
	cell: {
    	menus: CJGS.concat(XGBG),
    	before: function(info, context, evt) { 
    		this.update(colModel[info.dataIndex]);
    		return true; 
    	}
    }
};