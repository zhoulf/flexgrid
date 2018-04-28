var $ = require('../util/shim').$;

function createItem(item, vm) {
	let $item = $('<li class="c-menu-item"></li>');
    let $button = $('<button type="button" class="c-menu-btn"></button>')
    	.on('click', item.callback.bind(vm));

    if (item.iconCls) {
    	$button.append('<i class="fa fa-share"></i>');
    }
    
    $button.append(`<span class="c-menu-text">${item.text}</span>`);

    return $item.append($button);
};

function compileMenu(menus, vm) {
	if (menus && menus.length === 0) return null;
	
	let $menus = $('<menu class="c-menu"></menu>');
	let $menuSeparator = $('<li class="c-menu-separator"></li>');
	
	menus.forEach(menu => {
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

	let menu = compileMenu(menuList, $vm)[0];

	$(container).append(menu).on('contextmenu', targetClass, onContextMenu);

	function showMenu(x, y){
	    menu.style.left = x + 'px';
	    menu.style.top = y + 'px';
	    menu.classList.add('show-menu');
	}
	function hideMenu(){
	    menu.classList.remove('show-menu');
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

	return {

	}

	// document.addEventListener('contextmenu', onContextMenu, true);
};