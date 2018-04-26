var $ = require('../util/shim').$;

function createItem(item) {
	let $item = $('<li class="menu-item"></li>');
    let $button = $('<button type="button" class="menu-btn"></button>')
    	.on('click', item.callback);

    if (item.iconCls) {
    	$button.append('<i class="fa fa-share"></i>');
    }
    
    $button.append(`<span class="menu-text">${item.text}</span>`);

    return $item.append($button);
};

function compileMenu(menus) {
	if (menus && menus.length === 0) return null;
	
	let $menus = $('<menu class="menu"></menu>');
	let $menuSeparator = $('<li class="menu-separator"></li>');
	
	menus.forEach(menu => {
		let $menu = createItem(menu);
		let children;

		if (menu.children) {
			children = compileMenu(menu.children);

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
module.exports = function(menuList) {
	if (!Array.isArray(menuList)) {
		menuList = [menuList];
	}

	let menu = compileMenu(menuList)[0];

	$(document.body).append(menu);

	function showMenu(x, y){
	    menu.style.left = x + 'px';
	    menu.style.top = y + 'px';
	    menu.classList.add('show-menu');
	}
	function hideMenu(){
	    menu.classList.remove('show-menu');
	}
	function onContextMenu(e){
	    e.preventDefault();
	    showMenu(e.pageX, e.pageY);
	    document.addEventListener('mouseup', onMouseDown, true);
	}
	function onMouseDown(e){
	    hideMenu();
	    document.removeEventListener('mousedup', onMouseDown);
	}

	document.addEventListener('contextmenu', onContextMenu, false);
};