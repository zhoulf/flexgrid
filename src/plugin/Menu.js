var $ = require('../util/shim').$;

const emptyFn = (evt) => { 
	evt.preventDefault;
	return false; 
};

function createItem(item, vm) {
	let disabled = item.disabled ? 'disabled': '';
	let $item = $('<li/>').addClass('c-menu-item').addClass(disabled);
    let $button = $('<button/>').addClass('c-menu-btn')
    		.on('click', disabled ? emptyFn : item.callback.bind(vm, vm.data));

    if (item.iconCls) {
    	$button.append('<i class="fa fa-share"></i>');
    }

    if (item.id) {
    	$item.attr('id', item.id);
    }
    
    $button.append(`<span class="c-menu-text">${item.text}</span>`);

    return $item.append($button);
};

function compileMenu(menus, vm) {
	if (menus && menus.length === 0) return null;
	
	let $menus = $('<menu/>').addClass('c-menu');
	let $menuSeparator = $('<li/>').addClass('c-menu-separator');
	
	menus.forEach(menu => {
		if (menu.separator) {
			return $menus.append($menuSeparator);
		}

		let $menu = createItem(menu, vm);
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

/**
 * @params {Object[]} menuList -- [{text: 'menuName', callback(evt) {} }, ...] 
 */
module.exports = function({ container, targetClass, trigger, menuList }) {
	if (!Array.isArray(menuList)) {
		menuList = [menuList];
	}

	var $vm = {
		data: null
	};

	let $menu = compileMenu(menuList, $vm);

	$(container).append($menu).on('contextmenu', targetClass, onContextMenu);

	function showMenu(x, y){
	    $menu.css({ 'left': x + 'px', 'top': y + 'px'}).addClass('show-menu');
	}

	function hideMenu(){
	    $menu.removeClass('show-menu');
	}

	function onContextMenu(e){
		console.log(e.target.className);
		if (trigger.call($vm, e)) {
		    e.preventDefault();
		    showMenu(e.clientX - 5, e.clientY - container.offset().top);
		    document.addEventListener('mouseup', onMouseDown, true);
		}
	}

	function onMouseDown(e){
	    hideMenu();
	    document.removeEventListener('mouseup', onMouseDown);
	}

	let statusManager = (status) => {
		let statusMap = {
			visiable($obj) { $obj.show(); },
			hidden($obj) { $obj.hide(); },
			disabled($obj) { $obj.addClass('disabled'); },
			abled($obj) { $obj.removeClass('disabled'); }
		};

		return statusMap[status] || emptyFn;
	};

	function setAttrs(attrs) {
		$.each(attrs, (key, value) => {
			statusManager(value)($menu.find(`#${key}`));
		});
	}

	$vm.set = function(menuId, status) {
		let attrs = {};
		if (typeof menuId === 'string') {
			attrs[menuId] = status;
		} else if ($.isPlainObject(menuId)) {
			attrs = menuId;
		} else {
			throw 'menuId is not match attrs';
		}
		
		setAttrs(attrs);

		return $vm;
	};

	return $vm;

	// document.addEventListener('contextmenu', onContextMenu, true);
};