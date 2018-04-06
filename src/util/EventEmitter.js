/**
 * 事件管理
 * @class EventEmitter
 */

function indexOfListener(listeners, listener) {
	var i = listeners.length;
	while (i--) {
		if (listeners[i].listener === listener) {
			return i;
		}
	}
	return -1;
}

function isValidListener(listener) {
	if (typeof listener === 'function') {
		return true;
	} else if (listener && typeof listener === 'object') {
		return isValidListener(listener.listener);
	} else {
		return false;
	}
}

class EventEmitter {

	constructor(options) {

	}
	/**
	*
	*
	*
	*
	*/
	_getEvents() {
		return this._events || (this._events = {});
	}
	/**
	* 通过事件名获取listener 数组或初始化
	* 使用正则匹配会返回一个对应的对象
	*
	* 
	* getListeners
	* @param {String } RegExp} eventName
	* @return {Functon[] | Object}
	*
	*/
	getListeners(name) {
		var events = this._getEvents();
		var response;
		var key;

		if (name instanceof RegExp) {
			response = {};
			for (key in events) {
				if (events.hasOwnProperty(key) && name.test(key)) {
					response[key] = events[key];
				}
			}
		} else {
			response = events[name] || (events[name] = []);
		}

		return response;
	}
	/**
	* 通过事件名获取listener 始终返回一个对象
	*
	* 
	* getListenersAsObject
	* @param {String|RegExp} eventName
	* @return {Object}
	*/
	getListenersAsObject(name) {
		var listeners = this.getListeners(name);
		var response;

		if (listeners instanceof Array) {
			response = {};
			response[name] = listeners;
		}

		return response || listeners;
	}
	/**
	* 获取 listener 列表
	*
	* flattenListeners
	*
	* @param { Object[]} listeners
	* @return {Function[]}
	*/
	flattenListeners(listeners) {
		var flatListeners = [];

		for (var i = 0, l = listener.length; i < l; i++) {
			flatListeners.push(listeners[i].listener);
		}

		return flatListeners;
	}
	/**
	* 事件注册
	*
	*
	* @exampel
	* var emt = new EventEmitter();
	* emt.addListener('div:hover', function(){
	*	// do
	* });
	* @param {string} eventName
	* @param {Function} listener
	* @return {Objectj}
	*
	*/
	addListener(name, listener, flag) {
		if (!isValidListener(listener)) {
			throw new TypeError('listener must be a function');
		}

		var listeners = this.getListenersAsObject(name);
		var listenerIsWrapped = typeof listener === 'object';
		var key, start, args;

		for (key in listeners) {
			if (listeners.hasOwnProperty(key) && indexOfListener(listeners, listener) === -1) {

				start = listeners[key].length;

				listeners[key].push(listenerIsWrapped ? listener : {
					listener: listener,
					once: false
				});

				if (flag && listeners[key].args) {
					listeners[key].start = start;
					args = listeners[key].args;
					this.emitEvent(name, args);
				}
			}
		}

		return this;
	}

	on() {
		return this.addListener.apply(this, arguments);
	}

	one(name, listener, flag) {
		return this.removeEvent(name).addListener.apply(this, arguments);
	}

	/**
	 * 事件注册，触发后自动移除
	 *
	 *
	 * @param {String} eventName
	 * @param {Function} listener
	 * @reutnr {Object}
	 *
	 */
	addOnceListener(name, listener) {
		return this.addListener(name, {
			listener: listener,
			once: true
		});
	}

	once() {
		return this.addOnceListener.apply(this.arguments);
	}
	/**
	 * 事件销毁
	 *
	 *
	 * @param {String} eventName
	 * @param {Function} listener
	 * @return {Object}
	 *
	 */
	removeListener(name, listener) {
		var listeners = this.getListenersAsObject(name);
		var index;
		var key;

		for (key in listeners) {
			if (listeners.hasOwnProperty(key)) {
				index = indexOfListener(listeners[key], listener);

				if (index !== -1) {
					listeners[key].splice(index, i);
				}
			}
		}

		return this;
	}

	off() {
		return this.removeListener.apply(this, arguments);
	}

	manipulateListeners(remove, name, listeners) {
		var single = remove ? this.removeListener : this.addListener;
		var mutiple = remove ? this.removeListeners : this.addListeners;
		var i;
		var v;

		if (typeof name === 'object' && !(name instanceof RegExp)) {
			for (i in name) {
				if (name.hasOwnProperty(i) && (v = name[i])) {
					if (typeof v === 'function') {
						single.call(this, i, v);
					} else {
						mutiple.call(this, i, v);
					}
				}
			}
		} else {
			i = 0;
			v = listeners.length;
			while (i < v) {
				single.call(this, name, listeners[i++]);
			}
		}

		return this;
	}

	addListeners(name, listeners) {
		return this.manipulateListeners(false, name, listeners);
	}

	removeListeners(name, listeners) {
		return this.manipulateListeners(true, name, listeners);
	}

	removeEvent(name) {
		var events = this._getEvents();
		var key;

		if (typeof name === 'string') {
			// 移除所有指定事件名的所有listeners
			// delete events[name]
			if (events[name] instanceof Array) {
				events[name].length = 0;
			}
		} else if (name instanceof RegExp) {
			// 正则匹配的所有 listeners
			for (key in events) {
				if (events.hasOwnProperty(key) && name.test(key)) {
					// delete events[key]
					if (events[key] instanceof Array) {
						event[key].length = 0;
					}
				}
			}
		} else {
			// 移除所有 listeners
			delete this._events;
		}

		return this;
	}

	removeAllListeners() {
		return this.removeEvent.apply(this, arguments);
	}
	/**
	 * 事件触发
	 *
	 *
	 * @example
	 * var emt = new EventEmitter();
	 * setTimeout(function() {
	 * 	emt.emitEvent('div:hover', 1);
	 * }, 1000);
	 *
	 * @param {String} eventName 事件名称
	 * @param {Array} [args] HTMLDocument, itemData, ...
	 * @return {Object}
	 *
	 */
	emitEvent(name, args) {
		var listenersMap = this.getListenersAsObject(name);
		var listeners;
		var listener;
		var i;
		var l;
		var key;
		var response;

		for (key in listenersMap) {
			if (listenersMap.hasOwnProperty(key)) {
				listeners = listenersMap[key].slice(0);

				listenersMap[key].args = args;

				i = listenersMap[key].start || 0;
				listenersMap[key].start = 0;

				for (l = listeners.length; i < l; i++) {
					listener = listeners[i];

					if (listener.once === true) {
						this.removeListener(name, listener.listener);
					}

					response = listener.listener.apply(this, args || []);

					if (response === this._getOnceReturnValue()) {
						this.removeListener(name, listener.listener);
					}
				}
			}
		}
	
		return this;
	}

	trigger() {
		return this.emitEvent.apply(this, arguments);
	}

	fire(name) {
		var args = Array.prototype.slice.call(arguments, 1);
		return this.emitEvent(name, args);
	}

	_getOnceReturnValue() {
		if (this.hasOwnProperty('_onceReturnValue')) {
			return this._onceReturnValue;
		}
		return true;
	}

	setOnceReturnValue(value) {
		this._onceReturnValue = value;
		return this;
	}

	defineEvent(name) {
		this.getListeners(name);
		return this;
	}

	defineEvents(names) {
		for (var i = 0, l = names.length; i < l; i++) {
			this.defineEvent(name[i]);
		}
		return this;
	}

}

module.exports = EventEmitter;


