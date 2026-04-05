//#region src/globals.ts
var Gettext = imports.gettext;
var { GLib: GLib$6 } = imports.gi;
var Main = imports.ui.main;
var { St } = imports.gi;
var metadata = {
	uuid: "",
	name: "",
	description: "",
	path: "",
	force_loaded: false
};
function _(text) {
	return Gettext.dgettext(metadata.uuid, text);
}
var translated_applet_name = "";
function initialize_globals(applet_metadata) {
	Object.assign(metadata, applet_metadata);
	const translations_dir_path = GLib$6.get_home_dir() + "/.local/share/locale";
	Gettext.bindtextdomain(metadata.uuid, translations_dir_path);
	translated_applet_name = _(metadata.name);
}
var icon_size = 24;
var warning_icon = new St.Icon({
	icon_name: "dialog-warning",
	icon_type: St.IconType.SYMBOLIC,
	icon_size
});
var error_icon = new St.Icon({
	icon_name: "dialog-error",
	icon_type: St.IconType.SYMBOLIC,
	icon_size
});
var logger = {
	info(msg) {
		global.log(translated_applet_name + `${_(":")} ` + msg);
		Main.notify(translated_applet_name, msg);
	},
	warn(msg) {
		global.logWarning(translated_applet_name + `${_(":")} ` + msg);
		Main.warningNotify(translated_applet_name, msg, warning_icon);
	},
	error(msg) {
		global.logError(translated_applet_name + `${_(":")} ` + msg);
		Main.criticalNotify(translated_applet_name, msg, error_icon);
	}
};
//#endregion
//#region node_modules/.pnpm/mobx@6.15.0/node_modules/mobx/dist/mobx.esm.js
function die(error) {
	for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) args[_key - 1] = arguments[_key];
	throw new Error(typeof error === "number" ? "[MobX] minified error nr: " + error + (args.length ? " " + args.map(String).join(",") : "") + ". Find the full error at: https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/errors.ts" : "[MobX] " + error);
}
var mockGlobal = {};
function getGlobal() {
	if (typeof globalThis !== "undefined") return globalThis;
	if (typeof window !== "undefined") return window;
	if (typeof global !== "undefined") return global;
	if (typeof self !== "undefined") return self;
	return mockGlobal;
}
var assign = Object.assign;
var getDescriptor = Object.getOwnPropertyDescriptor;
var defineProperty = Object.defineProperty;
var objectPrototype = Object.prototype;
var EMPTY_ARRAY = [];
Object.freeze(EMPTY_ARRAY);
var EMPTY_OBJECT = {};
Object.freeze(EMPTY_OBJECT);
var hasProxy = typeof Proxy !== "undefined";
var plainObjectString = /* @__PURE__ */ Object.toString();
function assertProxies() {
	if (!hasProxy) die("Proxy not available");
}
/**
* Makes sure that the provided function is invoked at most once.
*/
function once(func) {
	var invoked = false;
	return function() {
		if (invoked) return;
		invoked = true;
		return func.apply(this, arguments);
	};
}
var noop = function noop() {};
function isFunction(fn) {
	return typeof fn === "function";
}
function isStringish(value) {
	switch (typeof value) {
		case "string":
		case "symbol":
		case "number": return true;
	}
	return false;
}
function isObject(value) {
	return value !== null && typeof value === "object";
}
function isPlainObject(value) {
	if (!isObject(value)) return false;
	var proto = Object.getPrototypeOf(value);
	if (proto == null) return true;
	var protoConstructor = Object.hasOwnProperty.call(proto, "constructor") && proto.constructor;
	return typeof protoConstructor === "function" && protoConstructor.toString() === plainObjectString;
}
function isGenerator(obj) {
	var constructor = obj == null ? void 0 : obj.constructor;
	if (!constructor) return false;
	if ("GeneratorFunction" === constructor.name || "GeneratorFunction" === constructor.displayName) return true;
	return false;
}
function addHiddenProp(object, propName, value) {
	defineProperty(object, propName, {
		enumerable: false,
		writable: true,
		configurable: true,
		value
	});
}
function addHiddenFinalProp(object, propName, value) {
	defineProperty(object, propName, {
		enumerable: false,
		writable: false,
		configurable: true,
		value
	});
}
function createInstanceofPredicate(name, theClass) {
	var propName = "isMobX" + name;
	theClass.prototype[propName] = true;
	return function(x) {
		return isObject(x) && x[propName] === true;
	};
}
/**
* Yields true for both native and observable Map, even across different windows.
*/
function isES6Map(thing) {
	return thing != null && Object.prototype.toString.call(thing) === "[object Map]";
}
/**
* Makes sure a Map is an instance of non-inherited native or observable Map.
*/
function isPlainES6Map(thing) {
	return Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf(thing))) === null;
}
/**
* Yields true for both native and observable Set, even across different windows.
*/
function isES6Set(thing) {
	return thing != null && Object.prototype.toString.call(thing) === "[object Set]";
}
var hasGetOwnPropertySymbols = typeof Object.getOwnPropertySymbols !== "undefined";
/**
* Returns the following: own enumerable keys and symbols.
*/
function getPlainObjectKeys(object) {
	var keys = Object.keys(object);
	if (!hasGetOwnPropertySymbols) return keys;
	var symbols = Object.getOwnPropertySymbols(object);
	if (!symbols.length) return keys;
	return [].concat(keys, symbols.filter(function(s) {
		return objectPrototype.propertyIsEnumerable.call(object, s);
	}));
}
var ownKeys = typeof Reflect !== "undefined" && Reflect.ownKeys ? Reflect.ownKeys : hasGetOwnPropertySymbols ? function(obj) {
	return Object.getOwnPropertyNames(obj).concat(Object.getOwnPropertySymbols(obj));
} : Object.getOwnPropertyNames;
function toPrimitive(value) {
	return value === null ? null : typeof value === "object" ? "" + value : value;
}
function hasProp(target, prop) {
	return objectPrototype.hasOwnProperty.call(target, prop);
}
var getOwnPropertyDescriptors = Object.getOwnPropertyDescriptors || function getOwnPropertyDescriptors(target) {
	var res = {};
	ownKeys(target).forEach(function(key) {
		res[key] = getDescriptor(target, key);
	});
	return res;
};
function getFlag(flags, mask) {
	return !!(flags & mask);
}
function setFlag(flags, mask, newValue) {
	if (newValue) flags |= mask;
	else flags &= ~mask;
	return flags;
}
function _arrayLikeToArray(r, a) {
	(null == a || a > r.length) && (a = r.length);
	for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
	return n;
}
function _defineProperties(e, r) {
	for (var t = 0; t < r.length; t++) {
		var o = r[t];
		o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o);
	}
}
function _createClass(e, r, t) {
	return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e;
}
function _createForOfIteratorHelperLoose(r, e) {
	var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
	if (t) return (t = t.call(r)).next.bind(t);
	if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) {
		t && (r = t);
		var o = 0;
		return function() {
			return o >= r.length ? { done: !0 } : {
				done: !1,
				value: r[o++]
			};
		};
	}
	throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _extends() {
	return _extends = Object.assign ? Object.assign.bind() : function(n) {
		for (var e = 1; e < arguments.length; e++) {
			var t = arguments[e];
			for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
		}
		return n;
	}, _extends.apply(null, arguments);
}
function _inheritsLoose(t, o) {
	t.prototype = Object.create(o.prototype), t.prototype.constructor = t, _setPrototypeOf(t, o);
}
function _setPrototypeOf(t, e) {
	return _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(t, e) {
		return t.__proto__ = e, t;
	}, _setPrototypeOf(t, e);
}
function _toPrimitive(t, r) {
	if ("object" != typeof t || !t) return t;
	var e = t[Symbol.toPrimitive];
	if (void 0 !== e) {
		var i = e.call(t, r || "default");
		if ("object" != typeof i) return i;
		throw new TypeError("@@toPrimitive must return a primitive value.");
	}
	return ("string" === r ? String : Number)(t);
}
function _toPropertyKey(t) {
	var i = _toPrimitive(t, "string");
	return "symbol" == typeof i ? i : i + "";
}
function _unsupportedIterableToArray(r, a) {
	if (r) {
		if ("string" == typeof r) return _arrayLikeToArray(r, a);
		var t = {}.toString.call(r).slice(8, -1);
		return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
	}
}
var storedAnnotationsSymbol = /* @__PURE__ */ Symbol("mobx-stored-annotations");
/**
* Creates a function that acts as
* - decorator
* - annotation object
*/
function createDecoratorAnnotation(annotation) {
	function decorator(target, property) {
		if (is20223Decorator(property)) return annotation.decorate_20223_(target, property);
		else storeAnnotation(target, property, annotation);
	}
	return Object.assign(decorator, annotation);
}
/**
* Stores annotation to prototype,
* so it can be inspected later by `makeObservable` called from constructor
*/
function storeAnnotation(prototype, key, annotation) {
	if (!hasProp(prototype, storedAnnotationsSymbol)) addHiddenProp(prototype, storedAnnotationsSymbol, _extends({}, prototype[storedAnnotationsSymbol]));
	assertNotDecorated(prototype, annotation, key);
	if (!isOverride(annotation)) prototype[storedAnnotationsSymbol][key] = annotation;
}
function assertNotDecorated(prototype, annotation, key) {}
function is20223Decorator(context) {
	return typeof context == "object" && typeof context["kind"] == "string";
}
var $mobx = /* @__PURE__ */ Symbol("mobx administration");
var Atom = /* @__PURE__ */ function() {
	/**
	* Create a new atom. For debugging purposes it is recommended to give it a name.
	* The onBecomeObserved and onBecomeUnobserved callbacks can be used for resource management.
	*/
	function Atom(name_) {
		if (name_ === void 0) name_ = "Atom";
		this.name_ = void 0;
		this.flags_ = 0;
		this.observers_ = /* @__PURE__ */ new Set();
		this.lastAccessedBy_ = 0;
		this.lowestObserverState_ = IDerivationState_.NOT_TRACKING_;
		this.onBOL = void 0;
		this.onBUOL = void 0;
		this.name_ = name_;
	}
	var _proto = Atom.prototype;
	_proto.onBO = function onBO() {
		if (this.onBOL) this.onBOL.forEach(function(listener) {
			return listener();
		});
	};
	_proto.onBUO = function onBUO() {
		if (this.onBUOL) this.onBUOL.forEach(function(listener) {
			return listener();
		});
	};
	_proto.reportObserved = function reportObserved$1() {
		return reportObserved(this);
	};
	_proto.reportChanged = function reportChanged() {
		startBatch();
		propagateChanged(this);
		endBatch();
	};
	_proto.toString = function toString() {
		return this.name_;
	};
	return _createClass(Atom, [
		{
			key: "isBeingObserved",
			get: function get() {
				return getFlag(this.flags_, Atom.isBeingObservedMask_);
			},
			set: function set(newValue) {
				this.flags_ = setFlag(this.flags_, Atom.isBeingObservedMask_, newValue);
			}
		},
		{
			key: "isPendingUnobservation",
			get: function get() {
				return getFlag(this.flags_, Atom.isPendingUnobservationMask_);
			},
			set: function set(newValue) {
				this.flags_ = setFlag(this.flags_, Atom.isPendingUnobservationMask_, newValue);
			}
		},
		{
			key: "diffValue",
			get: function get() {
				return getFlag(this.flags_, Atom.diffValueMask_) ? 1 : 0;
			},
			set: function set(newValue) {
				this.flags_ = setFlag(this.flags_, Atom.diffValueMask_, newValue === 1 ? true : false);
			}
		}
	]);
}();
Atom.isBeingObservedMask_ = 1;
Atom.isPendingUnobservationMask_ = 2;
Atom.diffValueMask_ = 4;
var isAtom = /* @__PURE__ */ createInstanceofPredicate("Atom", Atom);
function createAtom(name, onBecomeObservedHandler, onBecomeUnobservedHandler) {
	if (onBecomeObservedHandler === void 0) onBecomeObservedHandler = noop;
	if (onBecomeUnobservedHandler === void 0) onBecomeUnobservedHandler = noop;
	var atom = new Atom(name);
	if (onBecomeObservedHandler !== noop) onBecomeObserved(atom, onBecomeObservedHandler);
	if (onBecomeUnobservedHandler !== noop) onBecomeUnobserved(atom, onBecomeUnobservedHandler);
	return atom;
}
function identityComparer(a, b) {
	return a === b;
}
function structuralComparer(a, b) {
	return deepEqual(a, b);
}
function shallowComparer(a, b) {
	return deepEqual(a, b, 1);
}
function defaultComparer(a, b) {
	if (Object.is) return Object.is(a, b);
	return a === b ? a !== 0 || 1 / a === 1 / b : a !== a && b !== b;
}
var comparer = {
	identity: identityComparer,
	structural: structuralComparer,
	"default": defaultComparer,
	shallow: shallowComparer
};
function deepEnhancer(v, _, name) {
	if (isObservable(v)) return v;
	if (Array.isArray(v)) return observable.array(v, { name });
	if (isPlainObject(v)) return observable.object(v, void 0, { name });
	if (isES6Map(v)) return observable.map(v, { name });
	if (isES6Set(v)) return observable.set(v, { name });
	if (typeof v === "function" && !isAction(v) && !isFlow(v)) if (isGenerator(v)) return flow(v);
	else return autoAction(name, v);
	return v;
}
function shallowEnhancer(v, _, name) {
	if (v === void 0 || v === null) return v;
	if (isObservableObject(v) || isObservableArray(v) || isObservableMap(v) || isObservableSet(v)) return v;
	if (Array.isArray(v)) return observable.array(v, {
		name,
		deep: false
	});
	if (isPlainObject(v)) return observable.object(v, void 0, {
		name,
		deep: false
	});
	if (isES6Map(v)) return observable.map(v, {
		name,
		deep: false
	});
	if (isES6Set(v)) return observable.set(v, {
		name,
		deep: false
	});
}
function referenceEnhancer(newValue) {
	return newValue;
}
function refStructEnhancer(v, oldValue) {
	if (deepEqual(v, oldValue)) return oldValue;
	return v;
}
var OVERRIDE = "override";
function isOverride(annotation) {
	return annotation.annotationType_ === OVERRIDE;
}
function createActionAnnotation(name, options) {
	return {
		annotationType_: name,
		options_: options,
		make_: make_$1,
		extend_: extend_$1,
		decorate_20223_: decorate_20223_$1
	};
}
function make_$1(adm, key, descriptor, source) {
	var _this$options_;
	if ((_this$options_ = this.options_) != null && _this$options_.bound) return this.extend_(adm, key, descriptor, false) === null ? 0 : 1;
	if (source === adm.target_) return this.extend_(adm, key, descriptor, false) === null ? 0 : 2;
	if (isAction(descriptor.value)) return 1;
	defineProperty(source, key, createActionDescriptor(adm, this, key, descriptor, false));
	return 2;
}
function extend_$1(adm, key, descriptor, proxyTrap) {
	var actionDescriptor = createActionDescriptor(adm, this, key, descriptor);
	return adm.defineProperty_(key, actionDescriptor, proxyTrap);
}
function decorate_20223_$1(mthd, context) {
	var kind = context.kind, name = context.name, addInitializer = context.addInitializer;
	var ann = this;
	var _createAction = function _createAction(m) {
		var _ann$options_$name, _ann$options_, _ann$options_$autoAct, _ann$options_2;
		return createAction((_ann$options_$name = (_ann$options_ = ann.options_) == null ? void 0 : _ann$options_.name) != null ? _ann$options_$name : name.toString(), m, (_ann$options_$autoAct = (_ann$options_2 = ann.options_) == null ? void 0 : _ann$options_2.autoAction) != null ? _ann$options_$autoAct : false);
	};
	if (kind == "field") return function(initMthd) {
		var _ann$options_3;
		var mthd = initMthd;
		if (!isAction(mthd)) mthd = _createAction(mthd);
		if ((_ann$options_3 = ann.options_) != null && _ann$options_3.bound) {
			mthd = mthd.bind(this);
			mthd.isMobxAction = true;
		}
		return mthd;
	};
	if (kind == "method") {
		var _this$options_2;
		if (!isAction(mthd)) mthd = _createAction(mthd);
		if ((_this$options_2 = this.options_) != null && _this$options_2.bound) addInitializer(function() {
			var self = this;
			var bound = self[name].bind(self);
			bound.isMobxAction = true;
			self[name] = bound;
		});
		return mthd;
	}
	die("Cannot apply '" + ann.annotationType_ + "' to '" + String(name) + "' (kind: " + kind + "):" + ("\n'" + ann.annotationType_ + "' can only be used on properties with a function value."));
}
function assertActionDescriptor(adm, _ref, key, _ref2) {
	_ref.annotationType_;
	_ref2.value;
}
function createActionDescriptor(adm, annotation, key, descriptor, safeDescriptors) {
	var _annotation$options_, _annotation$options_$, _annotation$options_2, _annotation$options_$2, _annotation$options_3, _annotation$options_4, _adm$proxy_2;
	if (safeDescriptors === void 0) safeDescriptors = globalState.safeDescriptors;
	assertActionDescriptor(adm, annotation, key, descriptor);
	var value = descriptor.value;
	if ((_annotation$options_ = annotation.options_) != null && _annotation$options_.bound) {
		var _adm$proxy_;
		value = value.bind((_adm$proxy_ = adm.proxy_) != null ? _adm$proxy_ : adm.target_);
	}
	return {
		value: createAction((_annotation$options_$ = (_annotation$options_2 = annotation.options_) == null ? void 0 : _annotation$options_2.name) != null ? _annotation$options_$ : key.toString(), value, (_annotation$options_$2 = (_annotation$options_3 = annotation.options_) == null ? void 0 : _annotation$options_3.autoAction) != null ? _annotation$options_$2 : false, (_annotation$options_4 = annotation.options_) != null && _annotation$options_4.bound ? (_adm$proxy_2 = adm.proxy_) != null ? _adm$proxy_2 : adm.target_ : void 0),
		configurable: safeDescriptors ? adm.isPlainObject_ : true,
		enumerable: false,
		writable: safeDescriptors ? false : true
	};
}
function createFlowAnnotation(name, options) {
	return {
		annotationType_: name,
		options_: options,
		make_: make_$2,
		extend_: extend_$2,
		decorate_20223_: decorate_20223_$2
	};
}
function make_$2(adm, key, descriptor, source) {
	var _this$options_;
	if (source === adm.target_) return this.extend_(adm, key, descriptor, false) === null ? 0 : 2;
	if ((_this$options_ = this.options_) != null && _this$options_.bound && (!hasProp(adm.target_, key) || !isFlow(adm.target_[key]))) {
		if (this.extend_(adm, key, descriptor, false) === null) return 0;
	}
	if (isFlow(descriptor.value)) return 1;
	defineProperty(source, key, createFlowDescriptor(adm, this, key, descriptor, false, false));
	return 2;
}
function extend_$2(adm, key, descriptor, proxyTrap) {
	var _this$options_2;
	var flowDescriptor = createFlowDescriptor(adm, this, key, descriptor, (_this$options_2 = this.options_) == null ? void 0 : _this$options_2.bound);
	return adm.defineProperty_(key, flowDescriptor, proxyTrap);
}
function decorate_20223_$2(mthd, context) {
	var _this$options_3;
	var name = context.name, addInitializer = context.addInitializer;
	if (!isFlow(mthd)) mthd = flow(mthd);
	if ((_this$options_3 = this.options_) != null && _this$options_3.bound) addInitializer(function() {
		var self = this;
		var bound = self[name].bind(self);
		bound.isMobXFlow = true;
		self[name] = bound;
	});
	return mthd;
}
function assertFlowDescriptor(adm, _ref, key, _ref2) {
	_ref.annotationType_;
	_ref2.value;
}
function createFlowDescriptor(adm, annotation, key, descriptor, bound, safeDescriptors) {
	if (safeDescriptors === void 0) safeDescriptors = globalState.safeDescriptors;
	assertFlowDescriptor(adm, annotation, key, descriptor);
	var value = descriptor.value;
	if (!isFlow(value)) value = flow(value);
	if (bound) {
		var _adm$proxy_;
		value = value.bind((_adm$proxy_ = adm.proxy_) != null ? _adm$proxy_ : adm.target_);
		value.isMobXFlow = true;
	}
	return {
		value,
		configurable: safeDescriptors ? adm.isPlainObject_ : true,
		enumerable: false,
		writable: safeDescriptors ? false : true
	};
}
function createComputedAnnotation(name, options) {
	return {
		annotationType_: name,
		options_: options,
		make_: make_$3,
		extend_: extend_$3,
		decorate_20223_: decorate_20223_$3
	};
}
function make_$3(adm, key, descriptor) {
	return this.extend_(adm, key, descriptor, false) === null ? 0 : 1;
}
function extend_$3(adm, key, descriptor, proxyTrap) {
	assertComputedDescriptor(adm, this, key, descriptor);
	return adm.defineComputedProperty_(key, _extends({}, this.options_, {
		get: descriptor.get,
		set: descriptor.set
	}), proxyTrap);
}
function decorate_20223_$3(get, context) {
	var ann = this;
	var key = context.name, addInitializer = context.addInitializer;
	addInitializer(function() {
		var adm = asObservableObject(this)[$mobx];
		var options = _extends({}, ann.options_, {
			get,
			context: this
		});
		options.name || (options.name = "ObservableObject." + key.toString());
		adm.values_.set(key, new ComputedValue(options));
	});
	return function() {
		return this[$mobx].getObservablePropValue_(key);
	};
}
function assertComputedDescriptor(adm, _ref, key, _ref2) {
	_ref.annotationType_;
	_ref2.get;
}
function createObservableAnnotation(name, options) {
	return {
		annotationType_: name,
		options_: options,
		make_: make_$4,
		extend_: extend_$4,
		decorate_20223_: decorate_20223_$4
	};
}
function make_$4(adm, key, descriptor) {
	return this.extend_(adm, key, descriptor, false) === null ? 0 : 1;
}
function extend_$4(adm, key, descriptor, proxyTrap) {
	var _this$options_$enhanc, _this$options_;
	assertObservableDescriptor(adm, this, key, descriptor);
	return adm.defineObservableProperty_(key, descriptor.value, (_this$options_$enhanc = (_this$options_ = this.options_) == null ? void 0 : _this$options_.enhancer) != null ? _this$options_$enhanc : deepEnhancer, proxyTrap);
}
function decorate_20223_$4(desc, context) {
	var ann = this;
	var kind = context.kind, name = context.name;
	var initializedObjects = /* @__PURE__ */ new WeakSet();
	function initializeObservable(target, value) {
		var _ann$options_$enhance, _ann$options_;
		var adm = asObservableObject(target)[$mobx];
		var observable = new ObservableValue(value, (_ann$options_$enhance = (_ann$options_ = ann.options_) == null ? void 0 : _ann$options_.enhancer) != null ? _ann$options_$enhance : deepEnhancer, "ObservableObject." + name.toString(), false);
		adm.values_.set(name, observable);
		initializedObjects.add(target);
	}
	if (kind == "accessor") return {
		get: function get() {
			if (!initializedObjects.has(this)) initializeObservable(this, desc.get.call(this));
			return this[$mobx].getObservablePropValue_(name);
		},
		set: function set(value) {
			if (!initializedObjects.has(this)) initializeObservable(this, value);
			return this[$mobx].setObservablePropValue_(name, value);
		},
		init: function init(value) {
			if (!initializedObjects.has(this)) initializeObservable(this, value);
			return value;
		}
	};
}
function assertObservableDescriptor(adm, _ref, key, descriptor) {
	_ref.annotationType_;
}
var AUTO = "true";
var autoAnnotation = /* @__PURE__ */ createAutoAnnotation();
function createAutoAnnotation(options) {
	return {
		annotationType_: AUTO,
		options_: options,
		make_: make_$5,
		extend_: extend_$5,
		decorate_20223_: decorate_20223_$5
	};
}
function make_$5(adm, key, descriptor, source) {
	var _this$options_3, _this$options_4;
	if (descriptor.get) return computed.make_(adm, key, descriptor, source);
	if (descriptor.set) {
		var set = isAction(descriptor.set) ? descriptor.set : createAction(key.toString(), descriptor.set);
		if (source === adm.target_) return adm.defineProperty_(key, {
			configurable: globalState.safeDescriptors ? adm.isPlainObject_ : true,
			set
		}) === null ? 0 : 2;
		defineProperty(source, key, {
			configurable: true,
			set
		});
		return 2;
	}
	if (source !== adm.target_ && typeof descriptor.value === "function") {
		var _this$options_2;
		if (isGenerator(descriptor.value)) {
			var _this$options_;
			return ((_this$options_ = this.options_) != null && _this$options_.autoBind ? flow.bound : flow).make_(adm, key, descriptor, source);
		}
		return ((_this$options_2 = this.options_) != null && _this$options_2.autoBind ? autoAction.bound : autoAction).make_(adm, key, descriptor, source);
	}
	var observableAnnotation = ((_this$options_3 = this.options_) == null ? void 0 : _this$options_3.deep) === false ? observable.ref : observable;
	if (typeof descriptor.value === "function" && (_this$options_4 = this.options_) != null && _this$options_4.autoBind) {
		var _adm$proxy_;
		descriptor.value = descriptor.value.bind((_adm$proxy_ = adm.proxy_) != null ? _adm$proxy_ : adm.target_);
	}
	return observableAnnotation.make_(adm, key, descriptor, source);
}
function extend_$5(adm, key, descriptor, proxyTrap) {
	var _this$options_5, _this$options_6;
	if (descriptor.get) return computed.extend_(adm, key, descriptor, proxyTrap);
	if (descriptor.set) return adm.defineProperty_(key, {
		configurable: globalState.safeDescriptors ? adm.isPlainObject_ : true,
		set: createAction(key.toString(), descriptor.set)
	}, proxyTrap);
	if (typeof descriptor.value === "function" && (_this$options_5 = this.options_) != null && _this$options_5.autoBind) {
		var _adm$proxy_2;
		descriptor.value = descriptor.value.bind((_adm$proxy_2 = adm.proxy_) != null ? _adm$proxy_2 : adm.target_);
	}
	return (((_this$options_6 = this.options_) == null ? void 0 : _this$options_6.deep) === false ? observable.ref : observable).extend_(adm, key, descriptor, proxyTrap);
}
function decorate_20223_$5(desc, context) {
	die("'" + this.annotationType_ + "' cannot be used as a decorator");
}
var OBSERVABLE = "observable";
var OBSERVABLE_REF = "observable.ref";
var OBSERVABLE_SHALLOW = "observable.shallow";
var OBSERVABLE_STRUCT = "observable.struct";
var defaultCreateObservableOptions = {
	deep: true,
	name: void 0,
	defaultDecorator: void 0,
	proxy: true
};
Object.freeze(defaultCreateObservableOptions);
function asCreateObservableOptions(thing) {
	return thing || defaultCreateObservableOptions;
}
var observableAnnotation = /* @__PURE__ */ createObservableAnnotation(OBSERVABLE);
var observableRefAnnotation = /* @__PURE__ */ createObservableAnnotation(OBSERVABLE_REF, { enhancer: referenceEnhancer });
var observableShallowAnnotation = /* @__PURE__ */ createObservableAnnotation(OBSERVABLE_SHALLOW, { enhancer: shallowEnhancer });
var observableStructAnnotation = /* @__PURE__ */ createObservableAnnotation(OBSERVABLE_STRUCT, { enhancer: refStructEnhancer });
var observableDecoratorAnnotation = /* @__PURE__ */ createDecoratorAnnotation(observableAnnotation);
function getEnhancerFromOptions(options) {
	return options.deep === true ? deepEnhancer : options.deep === false ? referenceEnhancer : getEnhancerFromAnnotation(options.defaultDecorator);
}
function getAnnotationFromOptions(options) {
	var _options$defaultDecor;
	return options ? (_options$defaultDecor = options.defaultDecorator) != null ? _options$defaultDecor : createAutoAnnotation(options) : void 0;
}
function getEnhancerFromAnnotation(annotation) {
	var _annotation$options_$, _annotation$options_;
	return !annotation ? deepEnhancer : (_annotation$options_$ = (_annotation$options_ = annotation.options_) == null ? void 0 : _annotation$options_.enhancer) != null ? _annotation$options_$ : deepEnhancer;
}
/**
* Turns an object, array or function into a reactive structure.
* @param v the value which should become observable.
*/
function createObservable(v, arg2, arg3) {
	if (is20223Decorator(arg2)) return observableAnnotation.decorate_20223_(v, arg2);
	if (isStringish(arg2)) {
		storeAnnotation(v, arg2, observableAnnotation);
		return;
	}
	if (isObservable(v)) return v;
	if (isPlainObject(v)) return observable.object(v, arg2, arg3);
	if (Array.isArray(v)) return observable.array(v, arg2);
	if (isES6Map(v)) return observable.map(v, arg2);
	if (isES6Set(v)) return observable.set(v, arg2);
	if (typeof v === "object" && v !== null) return v;
	return observable.box(v, arg2);
}
assign(createObservable, observableDecoratorAnnotation);
var observable = /* @__PURE__ */ assign(createObservable, {
	box: function box(value, options) {
		var o = asCreateObservableOptions(options);
		return new ObservableValue(value, getEnhancerFromOptions(o), o.name, true, o.equals);
	},
	array: function array(initialValues, options) {
		var o = asCreateObservableOptions(options);
		return (globalState.useProxies === false || o.proxy === false ? createLegacyArray : createObservableArray)(initialValues, getEnhancerFromOptions(o), o.name);
	},
	map: function map(initialValues, options) {
		var o = asCreateObservableOptions(options);
		return new ObservableMap(initialValues, getEnhancerFromOptions(o), o.name);
	},
	set: function set(initialValues, options) {
		var o = asCreateObservableOptions(options);
		return new ObservableSet(initialValues, getEnhancerFromOptions(o), o.name);
	},
	object: function object(props, decorators, options) {
		return initObservable(function() {
			return extendObservable(globalState.useProxies === false || (options == null ? void 0 : options.proxy) === false ? asObservableObject({}, options) : asDynamicObservableObject({}, options), props, decorators);
		});
	},
	ref: /* @__PURE__ */ createDecoratorAnnotation(observableRefAnnotation),
	shallow: /* @__PURE__ */ createDecoratorAnnotation(observableShallowAnnotation),
	deep: observableDecoratorAnnotation,
	struct: /* @__PURE__ */ createDecoratorAnnotation(observableStructAnnotation)
});
var COMPUTED = "computed";
var COMPUTED_STRUCT = "computed.struct";
var computedAnnotation = /* @__PURE__ */ createComputedAnnotation(COMPUTED);
var computedStructAnnotation = /* @__PURE__ */ createComputedAnnotation(COMPUTED_STRUCT, { equals: comparer.structural });
/**
* Decorator for class properties: @computed get value() { return expr; }.
* For legacy purposes also invokable as ES5 observable created: `computed(() => expr)`;
*/
var computed = function computed(arg1, arg2) {
	if (is20223Decorator(arg2)) return computedAnnotation.decorate_20223_(arg1, arg2);
	if (isStringish(arg2)) return storeAnnotation(arg1, arg2, computedAnnotation);
	if (isPlainObject(arg1)) return createDecoratorAnnotation(createComputedAnnotation(COMPUTED, arg1));
	var opts = isPlainObject(arg2) ? arg2 : {};
	opts.get = arg1;
	opts.name || (opts.name = arg1.name || "");
	return new ComputedValue(opts);
};
Object.assign(computed, computedAnnotation);
computed.struct = /* @__PURE__ */ createDecoratorAnnotation(computedStructAnnotation);
var _getDescriptor$config, _getDescriptor;
var currentActionId = 0;
var nextActionId = 1;
var isFunctionNameConfigurable = (_getDescriptor$config = (_getDescriptor = /* @__PURE__ */ getDescriptor(function() {}, "name")) == null ? void 0 : _getDescriptor.configurable) != null ? _getDescriptor$config : false;
var tmpNameDescriptor = {
	value: "action",
	configurable: true,
	writable: false,
	enumerable: false
};
function createAction(actionName, fn, autoAction, ref) {
	if (autoAction === void 0) autoAction = false;
	function res() {
		return executeAction(actionName, autoAction, fn, ref || this, arguments);
	}
	res.isMobxAction = true;
	res.toString = function() {
		return fn.toString();
	};
	if (isFunctionNameConfigurable) {
		tmpNameDescriptor.value = actionName;
		defineProperty(res, "name", tmpNameDescriptor);
	}
	return res;
}
function executeAction(actionName, canRunAsDerivation, fn, scope, args) {
	var runInfo = _startAction(actionName, canRunAsDerivation, scope, args);
	try {
		return fn.apply(scope, args);
	} catch (err) {
		runInfo.error_ = err;
		throw err;
	} finally {
		_endAction(runInfo);
	}
}
function _startAction(actionName, canRunAsDerivation, scope, args) {
	var notifySpy_ = false;
	var startTime_ = 0;
	var prevDerivation_ = globalState.trackingDerivation;
	var runAsAction = !canRunAsDerivation || !prevDerivation_;
	startBatch();
	var prevAllowStateChanges_ = globalState.allowStateChanges;
	if (runAsAction) {
		untrackedStart();
		prevAllowStateChanges_ = allowStateChangesStart(true);
	}
	var prevAllowStateReads_ = allowStateReadsStart(true);
	var runInfo = {
		runAsAction_: runAsAction,
		prevDerivation_,
		prevAllowStateChanges_,
		prevAllowStateReads_,
		notifySpy_,
		startTime_,
		actionId_: nextActionId++,
		parentActionId_: currentActionId
	};
	currentActionId = runInfo.actionId_;
	return runInfo;
}
function _endAction(runInfo) {
	if (currentActionId !== runInfo.actionId_) die(30);
	currentActionId = runInfo.parentActionId_;
	if (runInfo.error_ !== void 0) globalState.suppressReactionErrors = true;
	allowStateChangesEnd(runInfo.prevAllowStateChanges_);
	allowStateReadsEnd(runInfo.prevAllowStateReads_);
	endBatch();
	if (runInfo.runAsAction_) untrackedEnd(runInfo.prevDerivation_);
	globalState.suppressReactionErrors = false;
}
function allowStateChanges(allowStateChanges, func) {
	var prev = allowStateChangesStart(allowStateChanges);
	try {
		return func();
	} finally {
		allowStateChangesEnd(prev);
	}
}
function allowStateChangesStart(allowStateChanges) {
	var prev = globalState.allowStateChanges;
	globalState.allowStateChanges = allowStateChanges;
	return prev;
}
function allowStateChangesEnd(prev) {
	globalState.allowStateChanges = prev;
}
var ObservableValue = /* @__PURE__ */ function(_Atom) {
	function ObservableValue(value, enhancer, name_, notifySpy, equals) {
		var _this;
		if (name_ === void 0) name_ = "ObservableValue";
		if (notifySpy === void 0) notifySpy = true;
		if (equals === void 0) equals = comparer["default"];
		_this = _Atom.call(this, name_) || this;
		_this.enhancer = void 0;
		_this.name_ = void 0;
		_this.equals = void 0;
		_this.hasUnreportedChange_ = false;
		_this.interceptors_ = void 0;
		_this.changeListeners_ = void 0;
		_this.value_ = void 0;
		_this.dehancer = void 0;
		_this.enhancer = enhancer;
		_this.name_ = name_;
		_this.equals = equals;
		_this.value_ = enhancer(value, void 0, name_);
		return _this;
	}
	_inheritsLoose(ObservableValue, _Atom);
	var _proto = ObservableValue.prototype;
	_proto.dehanceValue = function dehanceValue(value) {
		if (this.dehancer !== void 0) return this.dehancer(value);
		return value;
	};
	_proto.set = function set(newValue) {
		this.value_;
		newValue = this.prepareNewValue_(newValue);
		if (newValue !== globalState.UNCHANGED) {
			isSpyEnabled();
			this.setNewValue_(newValue);
		}
	};
	_proto.prepareNewValue_ = function prepareNewValue_(newValue) {
		checkIfStateModificationsAreAllowed(this);
		if (hasInterceptors(this)) {
			var change = interceptChange(this, {
				object: this,
				type: UPDATE,
				newValue
			});
			if (!change) return globalState.UNCHANGED;
			newValue = change.newValue;
		}
		newValue = this.enhancer(newValue, this.value_, this.name_);
		return this.equals(this.value_, newValue) ? globalState.UNCHANGED : newValue;
	};
	_proto.setNewValue_ = function setNewValue_(newValue) {
		var oldValue = this.value_;
		this.value_ = newValue;
		this.reportChanged();
		if (hasListeners(this)) notifyListeners(this, {
			type: UPDATE,
			object: this,
			newValue,
			oldValue
		});
	};
	_proto.get = function get() {
		this.reportObserved();
		return this.dehanceValue(this.value_);
	};
	_proto.intercept_ = function intercept_(handler) {
		return registerInterceptor(this, handler);
	};
	_proto.observe_ = function observe_(listener, fireImmediately) {
		if (fireImmediately) listener({
			observableKind: "value",
			debugObjectName: this.name_,
			object: this,
			type: UPDATE,
			newValue: this.value_,
			oldValue: void 0
		});
		return registerListener(this, listener);
	};
	_proto.raw = function raw() {
		return this.value_;
	};
	_proto.toJSON = function toJSON() {
		return this.get();
	};
	_proto.toString = function toString() {
		return this.name_ + "[" + this.value_ + "]";
	};
	_proto.valueOf = function valueOf() {
		return toPrimitive(this.get());
	};
	_proto[Symbol.toPrimitive] = function() {
		return this.valueOf();
	};
	return ObservableValue;
}(Atom);
/**
* A node in the state dependency root that observes other nodes, and can be observed itself.
*
* ComputedValue will remember the result of the computation for the duration of the batch, or
* while being observed.
*
* During this time it will recompute only when one of its direct dependencies changed,
* but only when it is being accessed with `ComputedValue.get()`.
*
* Implementation description:
* 1. First time it's being accessed it will compute and remember result
*    give back remembered result until 2. happens
* 2. First time any deep dependency change, propagate POSSIBLY_STALE to all observers, wait for 3.
* 3. When it's being accessed, recompute if any shallow dependency changed.
*    if result changed: propagate STALE to all observers, that were POSSIBLY_STALE from the last step.
*    go to step 2. either way
*
* If at any point it's outside batch and it isn't observed: reset everything and go to 1.
*/
var ComputedValue = /* @__PURE__ */ function() {
	/**
	* Create a new computed value based on a function expression.
	*
	* The `name` property is for debug purposes only.
	*
	* The `equals` property specifies the comparer function to use to determine if a newly produced
	* value differs from the previous value. Two comparers are provided in the library; `defaultComparer`
	* compares based on identity comparison (===), and `structuralComparer` deeply compares the structure.
	* Structural comparison can be convenient if you always produce a new aggregated object and
	* don't want to notify observers if it is structurally the same.
	* This is useful for working with vectors, mouse coordinates etc.
	*/
	function ComputedValue(options) {
		this.dependenciesState_ = IDerivationState_.NOT_TRACKING_;
		this.observing_ = [];
		this.newObserving_ = null;
		this.observers_ = /* @__PURE__ */ new Set();
		this.runId_ = 0;
		this.lastAccessedBy_ = 0;
		this.lowestObserverState_ = IDerivationState_.UP_TO_DATE_;
		this.unboundDepsCount_ = 0;
		this.value_ = new CaughtException(null);
		this.name_ = void 0;
		this.triggeredBy_ = void 0;
		this.flags_ = 0;
		this.derivation = void 0;
		this.setter_ = void 0;
		this.isTracing_ = TraceMode.NONE;
		this.scope_ = void 0;
		this.equals_ = void 0;
		this.requiresReaction_ = void 0;
		this.keepAlive_ = void 0;
		this.onBOL = void 0;
		this.onBUOL = void 0;
		if (!options.get) die(31);
		this.derivation = options.get;
		this.name_ = options.name || "ComputedValue";
		if (options.set) this.setter_ = createAction("ComputedValue-setter", options.set);
		this.equals_ = options.equals || (options.compareStructural || options.struct ? comparer.structural : comparer["default"]);
		this.scope_ = options.context;
		this.requiresReaction_ = options.requiresReaction;
		this.keepAlive_ = !!options.keepAlive;
	}
	var _proto = ComputedValue.prototype;
	_proto.onBecomeStale_ = function onBecomeStale_() {
		propagateMaybeChanged(this);
	};
	_proto.onBO = function onBO() {
		if (this.onBOL) this.onBOL.forEach(function(listener) {
			return listener();
		});
	};
	_proto.onBUO = function onBUO() {
		if (this.onBUOL) this.onBUOL.forEach(function(listener) {
			return listener();
		});
	};
	/**
	* Returns the current value of this computed value.
	* Will evaluate its computation first if needed.
	*/
	_proto.get = function get() {
		if (this.isComputing) die(32, this.name_, this.derivation);
		if (globalState.inBatch === 0 && this.observers_.size === 0 && !this.keepAlive_) {
			if (shouldCompute(this)) {
				this.warnAboutUntrackedRead_();
				startBatch();
				this.value_ = this.computeValue_(false);
				endBatch();
			}
		} else {
			reportObserved(this);
			if (shouldCompute(this)) {
				var prevTrackingContext = globalState.trackingContext;
				if (this.keepAlive_ && !prevTrackingContext) globalState.trackingContext = this;
				if (this.trackAndCompute()) propagateChangeConfirmed(this);
				globalState.trackingContext = prevTrackingContext;
			}
		}
		var result = this.value_;
		if (isCaughtException(result)) throw result.cause;
		return result;
	};
	_proto.set = function set(value) {
		if (this.setter_) {
			if (this.isRunningSetter) die(33, this.name_);
			this.isRunningSetter = true;
			try {
				this.setter_.call(this.scope_, value);
			} finally {
				this.isRunningSetter = false;
			}
		} else die(34, this.name_);
	};
	_proto.trackAndCompute = function trackAndCompute() {
		var oldValue = this.value_;
		var wasSuspended = this.dependenciesState_ === IDerivationState_.NOT_TRACKING_;
		var newValue = this.computeValue_(true);
		var changed = wasSuspended || isCaughtException(oldValue) || isCaughtException(newValue) || !this.equals_(oldValue, newValue);
		if (changed) this.value_ = newValue;
		return changed;
	};
	_proto.computeValue_ = function computeValue_(track) {
		this.isComputing = true;
		var prev = allowStateChangesStart(false);
		var res;
		if (track) res = trackDerivedFunction(this, this.derivation, this.scope_);
		else if (globalState.disableErrorBoundaries === true) res = this.derivation.call(this.scope_);
		else try {
			res = this.derivation.call(this.scope_);
		} catch (e) {
			res = new CaughtException(e);
		}
		allowStateChangesEnd(prev);
		this.isComputing = false;
		return res;
	};
	_proto.suspend_ = function suspend_() {
		if (!this.keepAlive_) {
			clearObserving(this);
			this.value_ = void 0;
		}
	};
	_proto.observe_ = function observe_(listener, fireImmediately) {
		var _this = this;
		var firstTime = true;
		var prevValue = void 0;
		return autorun(function() {
			var newValue = _this.get();
			if (!firstTime || fireImmediately) {
				var prevU = untrackedStart();
				listener({
					observableKind: "computed",
					debugObjectName: _this.name_,
					type: UPDATE,
					object: _this,
					newValue,
					oldValue: prevValue
				});
				untrackedEnd(prevU);
			}
			firstTime = false;
			prevValue = newValue;
		});
	};
	_proto.warnAboutUntrackedRead_ = function warnAboutUntrackedRead_() {};
	_proto.toString = function toString() {
		return this.name_ + "[" + this.derivation.toString() + "]";
	};
	_proto.valueOf = function valueOf() {
		return toPrimitive(this.get());
	};
	_proto[Symbol.toPrimitive] = function() {
		return this.valueOf();
	};
	return _createClass(ComputedValue, [
		{
			key: "isComputing",
			get: function get() {
				return getFlag(this.flags_, ComputedValue.isComputingMask_);
			},
			set: function set(newValue) {
				this.flags_ = setFlag(this.flags_, ComputedValue.isComputingMask_, newValue);
			}
		},
		{
			key: "isRunningSetter",
			get: function get() {
				return getFlag(this.flags_, ComputedValue.isRunningSetterMask_);
			},
			set: function set(newValue) {
				this.flags_ = setFlag(this.flags_, ComputedValue.isRunningSetterMask_, newValue);
			}
		},
		{
			key: "isBeingObserved",
			get: function get() {
				return getFlag(this.flags_, ComputedValue.isBeingObservedMask_);
			},
			set: function set(newValue) {
				this.flags_ = setFlag(this.flags_, ComputedValue.isBeingObservedMask_, newValue);
			}
		},
		{
			key: "isPendingUnobservation",
			get: function get() {
				return getFlag(this.flags_, ComputedValue.isPendingUnobservationMask_);
			},
			set: function set(newValue) {
				this.flags_ = setFlag(this.flags_, ComputedValue.isPendingUnobservationMask_, newValue);
			}
		},
		{
			key: "diffValue",
			get: function get() {
				return getFlag(this.flags_, ComputedValue.diffValueMask_) ? 1 : 0;
			},
			set: function set(newValue) {
				this.flags_ = setFlag(this.flags_, ComputedValue.diffValueMask_, newValue === 1 ? true : false);
			}
		}
	]);
}();
ComputedValue.isComputingMask_ = 1;
ComputedValue.isRunningSetterMask_ = 2;
ComputedValue.isBeingObservedMask_ = 4;
ComputedValue.isPendingUnobservationMask_ = 8;
ComputedValue.diffValueMask_ = 16;
var isComputedValue = /* @__PURE__ */ createInstanceofPredicate("ComputedValue", ComputedValue);
var IDerivationState_;
(function(IDerivationState_) {
	IDerivationState_[IDerivationState_["NOT_TRACKING_"] = -1] = "NOT_TRACKING_";
	IDerivationState_[IDerivationState_["UP_TO_DATE_"] = 0] = "UP_TO_DATE_";
	IDerivationState_[IDerivationState_["POSSIBLY_STALE_"] = 1] = "POSSIBLY_STALE_";
	IDerivationState_[IDerivationState_["STALE_"] = 2] = "STALE_";
})(IDerivationState_ || (IDerivationState_ = {}));
var TraceMode;
(function(TraceMode) {
	TraceMode[TraceMode["NONE"] = 0] = "NONE";
	TraceMode[TraceMode["LOG"] = 1] = "LOG";
	TraceMode[TraceMode["BREAK"] = 2] = "BREAK";
})(TraceMode || (TraceMode = {}));
var CaughtException = function CaughtException(cause) {
	this.cause = void 0;
	this.cause = cause;
};
function isCaughtException(e) {
	return e instanceof CaughtException;
}
/**
* Finds out whether any dependency of the derivation has actually changed.
* If dependenciesState is 1 then it will recalculate dependencies,
* if any dependency changed it will propagate it by changing dependenciesState to 2.
*
* By iterating over the dependencies in the same order that they were reported and
* stopping on the first change, all the recalculations are only called for ComputedValues
* that will be tracked by derivation. That is because we assume that if the first x
* dependencies of the derivation doesn't change then the derivation should run the same way
* up until accessing x-th dependency.
*/
function shouldCompute(derivation) {
	switch (derivation.dependenciesState_) {
		case IDerivationState_.UP_TO_DATE_: return false;
		case IDerivationState_.NOT_TRACKING_:
		case IDerivationState_.STALE_: return true;
		case IDerivationState_.POSSIBLY_STALE_:
			var prevAllowStateReads = allowStateReadsStart(true);
			var prevUntracked = untrackedStart();
			var obs = derivation.observing_, l = obs.length;
			for (var i = 0; i < l; i++) {
				var obj = obs[i];
				if (isComputedValue(obj)) {
					if (globalState.disableErrorBoundaries) obj.get();
					else try {
						obj.get();
					} catch (e) {
						untrackedEnd(prevUntracked);
						allowStateReadsEnd(prevAllowStateReads);
						return true;
					}
					if (derivation.dependenciesState_ === IDerivationState_.STALE_) {
						untrackedEnd(prevUntracked);
						allowStateReadsEnd(prevAllowStateReads);
						return true;
					}
				}
			}
			changeDependenciesStateTo0(derivation);
			untrackedEnd(prevUntracked);
			allowStateReadsEnd(prevAllowStateReads);
			return false;
	}
}
function checkIfStateModificationsAreAllowed(atom) {}
function checkIfStateReadsAreAllowed(observable) {}
/**
* Executes the provided function `f` and tracks which observables are being accessed.
* The tracking information is stored on the `derivation` object and the derivation is registered
* as observer of any of the accessed observables.
*/
function trackDerivedFunction(derivation, f, context) {
	var prevAllowStateReads = allowStateReadsStart(true);
	changeDependenciesStateTo0(derivation);
	derivation.newObserving_ = new Array(derivation.runId_ === 0 ? 100 : derivation.observing_.length);
	derivation.unboundDepsCount_ = 0;
	derivation.runId_ = ++globalState.runId;
	var prevTracking = globalState.trackingDerivation;
	globalState.trackingDerivation = derivation;
	globalState.inBatch++;
	var result;
	if (globalState.disableErrorBoundaries === true) result = f.call(context);
	else try {
		result = f.call(context);
	} catch (e) {
		result = new CaughtException(e);
	}
	globalState.inBatch--;
	globalState.trackingDerivation = prevTracking;
	bindDependencies(derivation);
	warnAboutDerivationWithoutDependencies(derivation);
	allowStateReadsEnd(prevAllowStateReads);
	return result;
}
function warnAboutDerivationWithoutDependencies(derivation) {}
/**
* diffs newObserving with observing.
* update observing to be newObserving with unique observables
* notify observers that become observed/unobserved
*/
function bindDependencies(derivation) {
	var prevObserving = derivation.observing_;
	var observing = derivation.observing_ = derivation.newObserving_;
	var lowestNewObservingDerivationState = IDerivationState_.UP_TO_DATE_;
	var i0 = 0, l = derivation.unboundDepsCount_;
	for (var i = 0; i < l; i++) {
		var dep = observing[i];
		if (dep.diffValue === 0) {
			dep.diffValue = 1;
			if (i0 !== i) observing[i0] = dep;
			i0++;
		}
		if (dep.dependenciesState_ > lowestNewObservingDerivationState) lowestNewObservingDerivationState = dep.dependenciesState_;
	}
	observing.length = i0;
	derivation.newObserving_ = null;
	l = prevObserving.length;
	while (l--) {
		var _dep = prevObserving[l];
		if (_dep.diffValue === 0) removeObserver(_dep, derivation);
		_dep.diffValue = 0;
	}
	while (i0--) {
		var _dep2 = observing[i0];
		if (_dep2.diffValue === 1) {
			_dep2.diffValue = 0;
			addObserver(_dep2, derivation);
		}
	}
	if (lowestNewObservingDerivationState !== IDerivationState_.UP_TO_DATE_) {
		derivation.dependenciesState_ = lowestNewObservingDerivationState;
		derivation.onBecomeStale_();
	}
}
function clearObserving(derivation) {
	var obs = derivation.observing_;
	derivation.observing_ = [];
	var i = obs.length;
	while (i--) removeObserver(obs[i], derivation);
	derivation.dependenciesState_ = IDerivationState_.NOT_TRACKING_;
}
function untracked(action) {
	var prev = untrackedStart();
	try {
		return action();
	} finally {
		untrackedEnd(prev);
	}
}
function untrackedStart() {
	var prev = globalState.trackingDerivation;
	globalState.trackingDerivation = null;
	return prev;
}
function untrackedEnd(prev) {
	globalState.trackingDerivation = prev;
}
function allowStateReadsStart(allowStateReads) {
	var prev = globalState.allowStateReads;
	globalState.allowStateReads = allowStateReads;
	return prev;
}
function allowStateReadsEnd(prev) {
	globalState.allowStateReads = prev;
}
/**
* needed to keep `lowestObserverState` correct. when changing from (2 or 1) to 0
*
*/
function changeDependenciesStateTo0(derivation) {
	if (derivation.dependenciesState_ === IDerivationState_.UP_TO_DATE_) return;
	derivation.dependenciesState_ = IDerivationState_.UP_TO_DATE_;
	var obs = derivation.observing_;
	var i = obs.length;
	while (i--) obs[i].lowestObserverState_ = IDerivationState_.UP_TO_DATE_;
}
var MobXGlobals = function MobXGlobals() {
	/**
	* MobXGlobals version.
	* MobX compatiblity with other versions loaded in memory as long as this version matches.
	* It indicates that the global state still stores similar information
	*
	* N.B: this version is unrelated to the package version of MobX, and is only the version of the
	* internal state storage of MobX, and can be the same across many different package versions
	*/
	this.version = 6;
	/**
	* globally unique token to signal unchanged
	*/
	this.UNCHANGED = {};
	/**
	* Currently running derivation
	*/
	this.trackingDerivation = null;
	/**
	* Currently running reaction. This determines if we currently have a reactive context.
	* (Tracking derivation is also set for temporal tracking of computed values inside actions,
	* but trackingReaction can only be set by a form of Reaction)
	*/
	this.trackingContext = null;
	/**
	* Each time a derivation is tracked, it is assigned a unique run-id
	*/
	this.runId = 0;
	/**
	* 'guid' for general purpose. Will be persisted amongst resets.
	*/
	this.mobxGuid = 0;
	/**
	* Are we in a batch block? (and how many of them)
	*/
	this.inBatch = 0;
	/**
	* Observables that don't have observers anymore, and are about to be
	* suspended, unless somebody else accesses it in the same batch
	*
	* @type {IObservable[]}
	*/
	this.pendingUnobservations = [];
	/**
	* List of scheduled, not yet executed, reactions.
	*/
	this.pendingReactions = [];
	/**
	* Are we currently processing reactions?
	*/
	this.isRunningReactions = false;
	/**
	* Is it allowed to change observables at this point?
	* In general, MobX doesn't allow that when running computations and React.render.
	* To ensure that those functions stay pure.
	*/
	this.allowStateChanges = false;
	/**
	* Is it allowed to read observables at this point?
	* Used to hold the state needed for `observableRequiresReaction`
	*/
	this.allowStateReads = true;
	/**
	* If strict mode is enabled, state changes are by default not allowed
	*/
	this.enforceActions = true;
	/**
	* Spy callbacks
	*/
	this.spyListeners = [];
	/**
	* Globally attached error handlers that react specifically to errors in reactions
	*/
	this.globalReactionErrorHandlers = [];
	/**
	* Warn if computed values are accessed outside a reactive context
	*/
	this.computedRequiresReaction = false;
	/**
	* (Experimental)
	* Warn if you try to create to derivation / reactive context without accessing any observable.
	*/
	this.reactionRequiresObservable = false;
	/**
	* (Experimental)
	* Warn if observables are accessed outside a reactive context
	*/
	this.observableRequiresReaction = false;
	this.disableErrorBoundaries = false;
	this.suppressReactionErrors = false;
	this.useProxies = true;
	this.verifyProxies = false;
	/**
	* False forces all object's descriptors to
	* writable: true
	* configurable: true
	*/
	this.safeDescriptors = true;
};
var canMergeGlobalState = true;
var isolateCalled = false;
var globalState = /* @__PURE__ */ function() {
	var global = /* @__PURE__ */ getGlobal();
	if (global.__mobxInstanceCount > 0 && !global.__mobxGlobals) canMergeGlobalState = false;
	if (global.__mobxGlobals && global.__mobxGlobals.version !== new MobXGlobals().version) canMergeGlobalState = false;
	if (!canMergeGlobalState) {
		setTimeout(function() {
			if (!isolateCalled) die(35);
		}, 1);
		return new MobXGlobals();
	} else if (global.__mobxGlobals) {
		global.__mobxInstanceCount += 1;
		if (!global.__mobxGlobals.UNCHANGED) global.__mobxGlobals.UNCHANGED = {};
		return global.__mobxGlobals;
	} else {
		global.__mobxInstanceCount = 1;
		return global.__mobxGlobals = /* @__PURE__ */ new MobXGlobals();
	}
}();
function addObserver(observable, node) {
	observable.observers_.add(node);
	if (observable.lowestObserverState_ > node.dependenciesState_) observable.lowestObserverState_ = node.dependenciesState_;
}
function removeObserver(observable, node) {
	observable.observers_["delete"](node);
	if (observable.observers_.size === 0) queueForUnobservation(observable);
}
function queueForUnobservation(observable) {
	if (observable.isPendingUnobservation === false) {
		observable.isPendingUnobservation = true;
		globalState.pendingUnobservations.push(observable);
	}
}
/**
* Batch starts a transaction, at least for purposes of memoizing ComputedValues when nothing else does.
* During a batch `onBecomeUnobserved` will be called at most once per observable.
* Avoids unnecessary recalculations.
*/
function startBatch() {
	globalState.inBatch++;
}
function endBatch() {
	if (--globalState.inBatch === 0) {
		runReactions();
		var list = globalState.pendingUnobservations;
		for (var i = 0; i < list.length; i++) {
			var observable = list[i];
			observable.isPendingUnobservation = false;
			if (observable.observers_.size === 0) {
				if (observable.isBeingObserved) {
					observable.isBeingObserved = false;
					observable.onBUO();
				}
				if (observable instanceof ComputedValue) observable.suspend_();
			}
		}
		globalState.pendingUnobservations = [];
	}
}
function reportObserved(observable) {
	checkIfStateReadsAreAllowed(observable);
	var derivation = globalState.trackingDerivation;
	if (derivation !== null) {
		/**
		* Simple optimization, give each derivation run an unique id (runId)
		* Check if last time this observable was accessed the same runId is used
		* if this is the case, the relation is already known
		*/
		if (derivation.runId_ !== observable.lastAccessedBy_) {
			observable.lastAccessedBy_ = derivation.runId_;
			derivation.newObserving_[derivation.unboundDepsCount_++] = observable;
			if (!observable.isBeingObserved && globalState.trackingContext) {
				observable.isBeingObserved = true;
				observable.onBO();
			}
		}
		return observable.isBeingObserved;
	} else if (observable.observers_.size === 0 && globalState.inBatch > 0) queueForUnobservation(observable);
	return false;
}
/**
* NOTE: current propagation mechanism will in case of self reruning autoruns behave unexpectedly
* It will propagate changes to observers from previous run
* It's hard or maybe impossible (with reasonable perf) to get it right with current approach
* Hopefully self reruning autoruns aren't a feature people should depend on
* Also most basic use cases should be ok
*/
function propagateChanged(observable) {
	if (observable.lowestObserverState_ === IDerivationState_.STALE_) return;
	observable.lowestObserverState_ = IDerivationState_.STALE_;
	observable.observers_.forEach(function(d) {
		if (d.dependenciesState_ === IDerivationState_.UP_TO_DATE_) d.onBecomeStale_();
		d.dependenciesState_ = IDerivationState_.STALE_;
	});
}
function propagateChangeConfirmed(observable) {
	if (observable.lowestObserverState_ === IDerivationState_.STALE_) return;
	observable.lowestObserverState_ = IDerivationState_.STALE_;
	observable.observers_.forEach(function(d) {
		if (d.dependenciesState_ === IDerivationState_.POSSIBLY_STALE_) d.dependenciesState_ = IDerivationState_.STALE_;
		else if (d.dependenciesState_ === IDerivationState_.UP_TO_DATE_) observable.lowestObserverState_ = IDerivationState_.UP_TO_DATE_;
	});
}
function propagateMaybeChanged(observable) {
	if (observable.lowestObserverState_ !== IDerivationState_.UP_TO_DATE_) return;
	observable.lowestObserverState_ = IDerivationState_.POSSIBLY_STALE_;
	observable.observers_.forEach(function(d) {
		if (d.dependenciesState_ === IDerivationState_.UP_TO_DATE_) {
			d.dependenciesState_ = IDerivationState_.POSSIBLY_STALE_;
			d.onBecomeStale_();
		}
	});
}
var Reaction = /* @__PURE__ */ function() {
	function Reaction(name_, onInvalidate_, errorHandler_, requiresObservable_) {
		if (name_ === void 0) name_ = "Reaction";
		this.name_ = void 0;
		this.onInvalidate_ = void 0;
		this.errorHandler_ = void 0;
		this.requiresObservable_ = void 0;
		this.observing_ = [];
		this.newObserving_ = [];
		this.dependenciesState_ = IDerivationState_.NOT_TRACKING_;
		this.runId_ = 0;
		this.unboundDepsCount_ = 0;
		this.flags_ = 0;
		this.isTracing_ = TraceMode.NONE;
		this.name_ = name_;
		this.onInvalidate_ = onInvalidate_;
		this.errorHandler_ = errorHandler_;
		this.requiresObservable_ = requiresObservable_;
	}
	var _proto = Reaction.prototype;
	_proto.onBecomeStale_ = function onBecomeStale_() {
		this.schedule_();
	};
	_proto.schedule_ = function schedule_() {
		if (!this.isScheduled) {
			this.isScheduled = true;
			globalState.pendingReactions.push(this);
			runReactions();
		}
	};
	_proto.runReaction_ = function runReaction_() {
		if (!this.isDisposed) {
			startBatch();
			this.isScheduled = false;
			var prev = globalState.trackingContext;
			globalState.trackingContext = this;
			if (shouldCompute(this)) {
				this.isTrackPending = true;
				try {
					this.onInvalidate_();
				} catch (e) {
					this.reportExceptionInDerivation_(e);
				}
			}
			globalState.trackingContext = prev;
			endBatch();
		}
	};
	_proto.track = function track(fn) {
		if (this.isDisposed) return;
		startBatch();
		isSpyEnabled();
		this.isRunning = true;
		var prevReaction = globalState.trackingContext;
		globalState.trackingContext = this;
		var result = trackDerivedFunction(this, fn, void 0);
		globalState.trackingContext = prevReaction;
		this.isRunning = false;
		this.isTrackPending = false;
		if (this.isDisposed) clearObserving(this);
		if (isCaughtException(result)) this.reportExceptionInDerivation_(result.cause);
		endBatch();
	};
	_proto.reportExceptionInDerivation_ = function reportExceptionInDerivation_(error) {
		var _this = this;
		if (this.errorHandler_) {
			this.errorHandler_(error, this);
			return;
		}
		if (globalState.disableErrorBoundaries) throw error;
		var message = "[mobx] uncaught error in '" + this + "'";
		if (!globalState.suppressReactionErrors) console.error(message, error);
		globalState.globalReactionErrorHandlers.forEach(function(f) {
			return f(error, _this);
		});
	};
	_proto.dispose = function dispose() {
		if (!this.isDisposed) {
			this.isDisposed = true;
			if (!this.isRunning) {
				startBatch();
				clearObserving(this);
				endBatch();
			}
		}
	};
	_proto.getDisposer_ = function getDisposer_(abortSignal) {
		var _this2 = this;
		var dispose = function dispose() {
			_this2.dispose();
			abortSignal == null || abortSignal.removeEventListener == null || abortSignal.removeEventListener("abort", dispose);
		};
		abortSignal == null || abortSignal.addEventListener == null || abortSignal.addEventListener("abort", dispose);
		dispose[$mobx] = this;
		if ("dispose" in Symbol && typeof Symbol.dispose === "symbol") dispose[Symbol.dispose] = dispose;
		return dispose;
	};
	_proto.toString = function toString() {
		return "Reaction[" + this.name_ + "]";
	};
	_proto.trace = function trace$1(enterBreakPoint) {
		if (enterBreakPoint === void 0) enterBreakPoint = false;
		trace(this, enterBreakPoint);
	};
	return _createClass(Reaction, [
		{
			key: "isDisposed",
			get: function get() {
				return getFlag(this.flags_, Reaction.isDisposedMask_);
			},
			set: function set(newValue) {
				this.flags_ = setFlag(this.flags_, Reaction.isDisposedMask_, newValue);
			}
		},
		{
			key: "isScheduled",
			get: function get() {
				return getFlag(this.flags_, Reaction.isScheduledMask_);
			},
			set: function set(newValue) {
				this.flags_ = setFlag(this.flags_, Reaction.isScheduledMask_, newValue);
			}
		},
		{
			key: "isTrackPending",
			get: function get() {
				return getFlag(this.flags_, Reaction.isTrackPendingMask_);
			},
			set: function set(newValue) {
				this.flags_ = setFlag(this.flags_, Reaction.isTrackPendingMask_, newValue);
			}
		},
		{
			key: "isRunning",
			get: function get() {
				return getFlag(this.flags_, Reaction.isRunningMask_);
			},
			set: function set(newValue) {
				this.flags_ = setFlag(this.flags_, Reaction.isRunningMask_, newValue);
			}
		},
		{
			key: "diffValue",
			get: function get() {
				return getFlag(this.flags_, Reaction.diffValueMask_) ? 1 : 0;
			},
			set: function set(newValue) {
				this.flags_ = setFlag(this.flags_, Reaction.diffValueMask_, newValue === 1 ? true : false);
			}
		}
	]);
}();
Reaction.isDisposedMask_ = 1;
Reaction.isScheduledMask_ = 2;
Reaction.isTrackPendingMask_ = 4;
Reaction.isRunningMask_ = 8;
Reaction.diffValueMask_ = 16;
/**
* Magic number alert!
* Defines within how many times a reaction is allowed to re-trigger itself
* until it is assumed that this is gonna be a never ending loop...
*/
var MAX_REACTION_ITERATIONS = 100;
var reactionScheduler = function reactionScheduler(f) {
	return f();
};
function runReactions() {
	if (globalState.inBatch > 0 || globalState.isRunningReactions) return;
	reactionScheduler(runReactionsHelper);
}
function runReactionsHelper() {
	globalState.isRunningReactions = true;
	var allReactions = globalState.pendingReactions;
	var iterations = 0;
	while (allReactions.length > 0) {
		if (++iterations === MAX_REACTION_ITERATIONS) {
			console.error("[mobx] cycle in reaction: " + allReactions[0]);
			allReactions.splice(0);
		}
		var remainingReactions = allReactions.splice(0);
		for (var i = 0, l = remainingReactions.length; i < l; i++) remainingReactions[i].runReaction_();
	}
	globalState.isRunningReactions = false;
}
var isReaction = /* @__PURE__ */ createInstanceofPredicate("Reaction", Reaction);
function isSpyEnabled() {
	return false;
}
function spy(listener) {
	console.warn("[mobx.spy] Is a no-op in production builds");
	return function() {};
}
var ACTION = "action";
var ACTION_BOUND = "action.bound";
var AUTOACTION = "autoAction";
var AUTOACTION_BOUND = "autoAction.bound";
var DEFAULT_ACTION_NAME = "<unnamed action>";
var actionAnnotation = /* @__PURE__ */ createActionAnnotation(ACTION);
var actionBoundAnnotation = /* @__PURE__ */ createActionAnnotation(ACTION_BOUND, { bound: true });
var autoActionAnnotation = /* @__PURE__ */ createActionAnnotation(AUTOACTION, { autoAction: true });
var autoActionBoundAnnotation = /* @__PURE__ */ createActionAnnotation(AUTOACTION_BOUND, {
	autoAction: true,
	bound: true
});
function createActionFactory(autoAction) {
	return function action(arg1, arg2) {
		if (isFunction(arg1)) return createAction(arg1.name || DEFAULT_ACTION_NAME, arg1, autoAction);
		if (isFunction(arg2)) return createAction(arg1, arg2, autoAction);
		if (is20223Decorator(arg2)) return (autoAction ? autoActionAnnotation : actionAnnotation).decorate_20223_(arg1, arg2);
		if (isStringish(arg2)) return storeAnnotation(arg1, arg2, autoAction ? autoActionAnnotation : actionAnnotation);
		if (isStringish(arg1)) return createDecoratorAnnotation(createActionAnnotation(autoAction ? AUTOACTION : ACTION, {
			name: arg1,
			autoAction
		}));
	};
}
var action = /* @__PURE__ */ createActionFactory(false);
Object.assign(action, actionAnnotation);
var autoAction = /* @__PURE__ */ createActionFactory(true);
Object.assign(autoAction, autoActionAnnotation);
action.bound = /* @__PURE__ */ createDecoratorAnnotation(actionBoundAnnotation);
autoAction.bound = /* @__PURE__ */ createDecoratorAnnotation(autoActionBoundAnnotation);
function runInAction(fn) {
	return executeAction(fn.name || DEFAULT_ACTION_NAME, false, fn, this, void 0);
}
function isAction(thing) {
	return isFunction(thing) && thing.isMobxAction === true;
}
/**
* Creates a named reactive view and keeps it alive, so that the view is always
* updated if one of the dependencies changes, even when the view is not further used by something else.
* @param view The reactive view
* @returns disposer function, which can be used to stop the view from being updated in the future.
*/
function autorun(view, opts) {
	var _opts$name, _opts, _opts2, _opts3;
	if (opts === void 0) opts = EMPTY_OBJECT;
	var name = (_opts$name = (_opts = opts) == null ? void 0 : _opts.name) != null ? _opts$name : "Autorun";
	var runSync = !opts.scheduler && !opts.delay;
	var reaction;
	if (runSync) reaction = new Reaction(name, function() {
		this.track(reactionRunner);
	}, opts.onError, opts.requiresObservable);
	else {
		var scheduler = createSchedulerFromOptions(opts);
		var isScheduled = false;
		reaction = new Reaction(name, function() {
			if (!isScheduled) {
				isScheduled = true;
				scheduler(function() {
					isScheduled = false;
					if (!reaction.isDisposed) reaction.track(reactionRunner);
				});
			}
		}, opts.onError, opts.requiresObservable);
	}
	function reactionRunner() {
		view(reaction);
	}
	if (!((_opts2 = opts) != null && (_opts2 = _opts2.signal) != null && _opts2.aborted)) reaction.schedule_();
	return reaction.getDisposer_((_opts3 = opts) == null ? void 0 : _opts3.signal);
}
var run = function run(f) {
	return f();
};
function createSchedulerFromOptions(opts) {
	return opts.scheduler ? opts.scheduler : opts.delay ? function(f) {
		return setTimeout(f, opts.delay);
	} : run;
}
function reaction(expression, effect, opts) {
	var _opts$name2, _opts4, _opts5;
	if (opts === void 0) opts = EMPTY_OBJECT;
	var name = (_opts$name2 = opts.name) != null ? _opts$name2 : "Reaction";
	var effectAction = action(name, opts.onError ? wrapErrorHandler(opts.onError, effect) : effect);
	var runSync = !opts.scheduler && !opts.delay;
	var scheduler = createSchedulerFromOptions(opts);
	var firstTime = true;
	var isScheduled = false;
	var value;
	var equals = opts.compareStructural ? comparer.structural : opts.equals || comparer["default"];
	var r = new Reaction(name, function() {
		if (firstTime || runSync) reactionRunner();
		else if (!isScheduled) {
			isScheduled = true;
			scheduler(reactionRunner);
		}
	}, opts.onError, opts.requiresObservable);
	function reactionRunner() {
		isScheduled = false;
		if (r.isDisposed) return;
		var changed = false;
		var oldValue = value;
		r.track(function() {
			var nextValue = allowStateChanges(false, function() {
				return expression(r);
			});
			changed = firstTime || !equals(value, nextValue);
			value = nextValue;
		});
		if (firstTime && opts.fireImmediately) effectAction(value, oldValue, r);
		else if (!firstTime && changed) effectAction(value, oldValue, r);
		firstTime = false;
	}
	if (!((_opts4 = opts) != null && (_opts4 = _opts4.signal) != null && _opts4.aborted)) r.schedule_();
	return r.getDisposer_((_opts5 = opts) == null ? void 0 : _opts5.signal);
}
function wrapErrorHandler(errorHandler, baseFn) {
	return function() {
		try {
			return baseFn.apply(this, arguments);
		} catch (e) {
			errorHandler.call(this, e);
		}
	};
}
var ON_BECOME_OBSERVED = "onBO";
var ON_BECOME_UNOBSERVED = "onBUO";
function onBecomeObserved(thing, arg2, arg3) {
	return interceptHook(ON_BECOME_OBSERVED, thing, arg2, arg3);
}
function onBecomeUnobserved(thing, arg2, arg3) {
	return interceptHook(ON_BECOME_UNOBSERVED, thing, arg2, arg3);
}
function interceptHook(hook, thing, arg2, arg3) {
	var atom = typeof arg3 === "function" ? getAtom(thing, arg2) : getAtom(thing);
	var cb = isFunction(arg3) ? arg3 : arg2;
	var listenersKey = hook + "L";
	if (atom[listenersKey]) atom[listenersKey].add(cb);
	else atom[listenersKey] = new Set([cb]);
	return function() {
		var hookListeners = atom[listenersKey];
		if (hookListeners) {
			hookListeners["delete"](cb);
			if (hookListeners.size === 0) delete atom[listenersKey];
		}
	};
}
function extendObservable(target, properties, annotations, options) {
	var descriptors = getOwnPropertyDescriptors(properties);
	initObservable(function() {
		var adm = asObservableObject(target, options)[$mobx];
		ownKeys(descriptors).forEach(function(key) {
			adm.extend_(key, descriptors[key], !annotations ? true : key in annotations ? annotations[key] : true);
		});
	});
	return target;
}
var generatorId = 0;
function FlowCancellationError() {
	this.message = "FLOW_CANCELLED";
}
FlowCancellationError.prototype = /* @__PURE__ */ Object.create(Error.prototype);
var flowAnnotation = /* @__PURE__ */ createFlowAnnotation("flow");
var flowBoundAnnotation = /* @__PURE__ */ createFlowAnnotation("flow.bound", { bound: true });
var flow = /* @__PURE__ */ Object.assign(function flow(arg1, arg2) {
	if (is20223Decorator(arg2)) return flowAnnotation.decorate_20223_(arg1, arg2);
	if (isStringish(arg2)) return storeAnnotation(arg1, arg2, flowAnnotation);
	var generator = arg1;
	var name = generator.name || "<unnamed flow>";
	var res = function res() {
		var ctx = this;
		var args = arguments;
		var runId = ++generatorId;
		var gen = action(name + " - runid: " + runId + " - init", generator).apply(ctx, args);
		var rejector;
		var pendingPromise = void 0;
		var promise = new Promise(function(resolve, reject) {
			var stepId = 0;
			rejector = reject;
			function onFulfilled(res) {
				pendingPromise = void 0;
				var ret;
				try {
					ret = action(name + " - runid: " + runId + " - yield " + stepId++, gen.next).call(gen, res);
				} catch (e) {
					return reject(e);
				}
				next(ret);
			}
			function onRejected(err) {
				pendingPromise = void 0;
				var ret;
				try {
					ret = action(name + " - runid: " + runId + " - yield " + stepId++, gen["throw"]).call(gen, err);
				} catch (e) {
					return reject(e);
				}
				next(ret);
			}
			function next(ret) {
				if (isFunction(ret == null ? void 0 : ret.then)) {
					ret.then(next, reject);
					return;
				}
				if (ret.done) return resolve(ret.value);
				pendingPromise = Promise.resolve(ret.value);
				return pendingPromise.then(onFulfilled, onRejected);
			}
			onFulfilled(void 0);
		});
		promise.cancel = action(name + " - runid: " + runId + " - cancel", function() {
			try {
				if (pendingPromise) cancelPromise(pendingPromise);
				var _res = gen["return"](void 0);
				var yieldedPromise = Promise.resolve(_res.value);
				yieldedPromise.then(noop, noop);
				cancelPromise(yieldedPromise);
				rejector(new FlowCancellationError());
			} catch (e) {
				rejector(e);
			}
		});
		return promise;
	};
	res.isMobXFlow = true;
	return res;
}, flowAnnotation);
flow.bound = /* @__PURE__ */ createDecoratorAnnotation(flowBoundAnnotation);
function cancelPromise(promise) {
	if (isFunction(promise.cancel)) promise.cancel();
}
function isFlow(fn) {
	return (fn == null ? void 0 : fn.isMobXFlow) === true;
}
function _isObservable(value, property) {
	if (!value) return false;
	if (property !== void 0) {
		if (isObservableObject(value)) return value[$mobx].values_.has(property);
		return false;
	}
	return isObservableObject(value) || !!value[$mobx] || isAtom(value) || isReaction(value) || isComputedValue(value);
}
function isObservable(value) {
	return _isObservable(value);
}
function trace() {}
/**
* During a transaction no views are updated until the end of the transaction.
* The transaction will be run synchronously nonetheless.
*
* @param action a function that updates some reactive state
* @returns any value that was returned by the 'action' parameter.
*/
function transaction(action, thisArg) {
	if (thisArg === void 0) thisArg = void 0;
	startBatch();
	try {
		return action.apply(thisArg);
	} finally {
		endBatch();
	}
}
function getAdm(target) {
	return target[$mobx];
}
var objectProxyTraps = {
	has: function has(target, name) {
		return getAdm(target).has_(name);
	},
	get: function get(target, name) {
		return getAdm(target).get_(name);
	},
	set: function set(target, name, value) {
		var _getAdm$set_;
		if (!isStringish(name)) return false;
		return (_getAdm$set_ = getAdm(target).set_(name, value, true)) != null ? _getAdm$set_ : true;
	},
	deleteProperty: function deleteProperty(target, name) {
		var _getAdm$delete_;
		if (!isStringish(name)) return false;
		return (_getAdm$delete_ = getAdm(target).delete_(name, true)) != null ? _getAdm$delete_ : true;
	},
	defineProperty: function defineProperty(target, name, descriptor) {
		var _getAdm$definePropert;
		return (_getAdm$definePropert = getAdm(target).defineProperty_(name, descriptor)) != null ? _getAdm$definePropert : true;
	},
	ownKeys: function ownKeys(target) {
		return getAdm(target).ownKeys_();
	},
	preventExtensions: function preventExtensions(target) {
		die(13);
	}
};
function asDynamicObservableObject(target, options) {
	var _target$$mobx, _target$$mobx$proxy_;
	assertProxies();
	target = asObservableObject(target, options);
	return (_target$$mobx$proxy_ = (_target$$mobx = target[$mobx]).proxy_) != null ? _target$$mobx$proxy_ : _target$$mobx.proxy_ = new Proxy(target, objectProxyTraps);
}
function hasInterceptors(interceptable) {
	return interceptable.interceptors_ !== void 0 && interceptable.interceptors_.length > 0;
}
function registerInterceptor(interceptable, handler) {
	var interceptors = interceptable.interceptors_ || (interceptable.interceptors_ = []);
	interceptors.push(handler);
	return once(function() {
		var idx = interceptors.indexOf(handler);
		if (idx !== -1) interceptors.splice(idx, 1);
	});
}
function interceptChange(interceptable, change) {
	var prevU = untrackedStart();
	try {
		var interceptors = [].concat(interceptable.interceptors_ || []);
		for (var i = 0, l = interceptors.length; i < l; i++) {
			change = interceptors[i](change);
			if (change && !change.type) die(14);
			if (!change) break;
		}
		return change;
	} finally {
		untrackedEnd(prevU);
	}
}
function hasListeners(listenable) {
	return listenable.changeListeners_ !== void 0 && listenable.changeListeners_.length > 0;
}
function registerListener(listenable, handler) {
	var listeners = listenable.changeListeners_ || (listenable.changeListeners_ = []);
	listeners.push(handler);
	return once(function() {
		var idx = listeners.indexOf(handler);
		if (idx !== -1) listeners.splice(idx, 1);
	});
}
function notifyListeners(listenable, change) {
	var prevU = untrackedStart();
	var listeners = listenable.changeListeners_;
	if (!listeners) return;
	listeners = listeners.slice();
	for (var i = 0, l = listeners.length; i < l; i++) listeners[i](change);
	untrackedEnd(prevU);
}
var keysSymbol = /* @__PURE__ */ Symbol("mobx-keys");
function makeAutoObservable(target, overrides, options) {
	if (isPlainObject(target)) return extendObservable(target, target, overrides, options);
	initObservable(function() {
		var adm = asObservableObject(target, options)[$mobx];
		if (!target[keysSymbol]) {
			var proto = Object.getPrototypeOf(target);
			var keys = new Set([].concat(ownKeys(target), ownKeys(proto)));
			keys["delete"]("constructor");
			keys["delete"]($mobx);
			addHiddenProp(proto, keysSymbol, keys);
		}
		target[keysSymbol].forEach(function(key) {
			return adm.make_(key, !overrides ? true : key in overrides ? overrides[key] : true);
		});
	});
	return target;
}
var SPLICE = "splice";
var UPDATE = "update";
var MAX_SPLICE_SIZE = 1e4;
var arrayTraps = {
	get: function get(target, name) {
		var adm = target[$mobx];
		if (name === $mobx) return adm;
		if (name === "length") return adm.getArrayLength_();
		if (typeof name === "string" && !isNaN(name)) return adm.get_(parseInt(name));
		if (hasProp(arrayExtensions, name)) return arrayExtensions[name];
		return target[name];
	},
	set: function set(target, name, value) {
		var adm = target[$mobx];
		if (name === "length") adm.setArrayLength_(value);
		if (typeof name === "symbol" || isNaN(name)) target[name] = value;
		else adm.set_(parseInt(name), value);
		return true;
	},
	preventExtensions: function preventExtensions() {
		die(15);
	}
};
var ObservableArrayAdministration = /* @__PURE__ */ function() {
	function ObservableArrayAdministration(name, enhancer, owned_, legacyMode_) {
		if (name === void 0) name = "ObservableArray";
		this.owned_ = void 0;
		this.legacyMode_ = void 0;
		this.atom_ = void 0;
		this.values_ = [];
		this.interceptors_ = void 0;
		this.changeListeners_ = void 0;
		this.enhancer_ = void 0;
		this.dehancer = void 0;
		this.proxy_ = void 0;
		this.lastKnownLength_ = 0;
		this.owned_ = owned_;
		this.legacyMode_ = legacyMode_;
		this.atom_ = new Atom(name);
		this.enhancer_ = function(newV, oldV) {
			return enhancer(newV, oldV, "ObservableArray[..]");
		};
	}
	var _proto = ObservableArrayAdministration.prototype;
	_proto.dehanceValue_ = function dehanceValue_(value) {
		if (this.dehancer !== void 0) return this.dehancer(value);
		return value;
	};
	_proto.dehanceValues_ = function dehanceValues_(values) {
		if (this.dehancer !== void 0 && values.length > 0) return values.map(this.dehancer);
		return values;
	};
	_proto.intercept_ = function intercept_(handler) {
		return registerInterceptor(this, handler);
	};
	_proto.observe_ = function observe_(listener, fireImmediately) {
		if (fireImmediately === void 0) fireImmediately = false;
		if (fireImmediately) listener({
			observableKind: "array",
			object: this.proxy_,
			debugObjectName: this.atom_.name_,
			type: "splice",
			index: 0,
			added: this.values_.slice(),
			addedCount: this.values_.length,
			removed: [],
			removedCount: 0
		});
		return registerListener(this, listener);
	};
	_proto.getArrayLength_ = function getArrayLength_() {
		this.atom_.reportObserved();
		return this.values_.length;
	};
	_proto.setArrayLength_ = function setArrayLength_(newLength) {
		if (typeof newLength !== "number" || isNaN(newLength) || newLength < 0) die("Out of range: " + newLength);
		var currentLength = this.values_.length;
		if (newLength === currentLength) return;
		else if (newLength > currentLength) {
			var newItems = new Array(newLength - currentLength);
			for (var i = 0; i < newLength - currentLength; i++) newItems[i] = void 0;
			this.spliceWithArray_(currentLength, 0, newItems);
		} else this.spliceWithArray_(newLength, currentLength - newLength);
	};
	_proto.updateArrayLength_ = function updateArrayLength_(oldLength, delta) {
		if (oldLength !== this.lastKnownLength_) die(16);
		this.lastKnownLength_ += delta;
		if (this.legacyMode_ && delta > 0) reserveArrayBuffer(oldLength + delta + 1);
	};
	_proto.spliceWithArray_ = function spliceWithArray_(index, deleteCount, newItems) {
		var _this = this;
		checkIfStateModificationsAreAllowed(this.atom_);
		var length = this.values_.length;
		if (index === void 0) index = 0;
		else if (index > length) index = length;
		else if (index < 0) index = Math.max(0, length + index);
		if (arguments.length === 1) deleteCount = length - index;
		else if (deleteCount === void 0 || deleteCount === null) deleteCount = 0;
		else deleteCount = Math.max(0, Math.min(deleteCount, length - index));
		if (newItems === void 0) newItems = EMPTY_ARRAY;
		if (hasInterceptors(this)) {
			var change = interceptChange(this, {
				object: this.proxy_,
				type: SPLICE,
				index,
				removedCount: deleteCount,
				added: newItems
			});
			if (!change) return EMPTY_ARRAY;
			deleteCount = change.removedCount;
			newItems = change.added;
		}
		newItems = newItems.length === 0 ? newItems : newItems.map(function(v) {
			return _this.enhancer_(v, void 0);
		});
		if (this.legacyMode_ || false) {
			var lengthDelta = newItems.length - deleteCount;
			this.updateArrayLength_(length, lengthDelta);
		}
		var res = this.spliceItemsIntoValues_(index, deleteCount, newItems);
		if (deleteCount !== 0 || newItems.length !== 0) this.notifyArraySplice_(index, newItems, res);
		return this.dehanceValues_(res);
	};
	_proto.spliceItemsIntoValues_ = function spliceItemsIntoValues_(index, deleteCount, newItems) {
		if (newItems.length < MAX_SPLICE_SIZE) {
			var _this$values_;
			return (_this$values_ = this.values_).splice.apply(_this$values_, [index, deleteCount].concat(newItems));
		} else {
			var res = this.values_.slice(index, index + deleteCount);
			var oldItems = this.values_.slice(index + deleteCount);
			this.values_.length += newItems.length - deleteCount;
			for (var i = 0; i < newItems.length; i++) this.values_[index + i] = newItems[i];
			for (var _i = 0; _i < oldItems.length; _i++) this.values_[index + newItems.length + _i] = oldItems[_i];
			return res;
		}
	};
	_proto.notifyArrayChildUpdate_ = function notifyArrayChildUpdate_(index, newValue, oldValue) {
		var notifySpy = !this.owned_ && isSpyEnabled();
		var notify = hasListeners(this);
		var change = notify || notifySpy ? {
			observableKind: "array",
			object: this.proxy_,
			type: UPDATE,
			debugObjectName: this.atom_.name_,
			index,
			newValue,
			oldValue
		} : null;
		this.atom_.reportChanged();
		if (notify) notifyListeners(this, change);
	};
	_proto.notifyArraySplice_ = function notifyArraySplice_(index, added, removed) {
		var notifySpy = !this.owned_ && isSpyEnabled();
		var notify = hasListeners(this);
		var change = notify || notifySpy ? {
			observableKind: "array",
			object: this.proxy_,
			debugObjectName: this.atom_.name_,
			type: SPLICE,
			index,
			removed,
			added,
			removedCount: removed.length,
			addedCount: added.length
		} : null;
		this.atom_.reportChanged();
		if (notify) notifyListeners(this, change);
	};
	_proto.get_ = function get_(index) {
		if (this.legacyMode_ && index >= this.values_.length) {
			console.warn("[mobx] Out of bounds read: " + index);
			return;
		}
		this.atom_.reportObserved();
		return this.dehanceValue_(this.values_[index]);
	};
	_proto.set_ = function set_(index, newValue) {
		var values = this.values_;
		if (this.legacyMode_ && index > values.length) die(17, index, values.length);
		if (index < values.length) {
			checkIfStateModificationsAreAllowed(this.atom_);
			var oldValue = values[index];
			if (hasInterceptors(this)) {
				var change = interceptChange(this, {
					type: UPDATE,
					object: this.proxy_,
					index,
					newValue
				});
				if (!change) return;
				newValue = change.newValue;
			}
			newValue = this.enhancer_(newValue, oldValue);
			if (newValue !== oldValue) {
				values[index] = newValue;
				this.notifyArrayChildUpdate_(index, newValue, oldValue);
			}
		} else {
			var newItems = new Array(index + 1 - values.length);
			for (var i = 0; i < newItems.length - 1; i++) newItems[i] = void 0;
			newItems[newItems.length - 1] = newValue;
			this.spliceWithArray_(values.length, 0, newItems);
		}
	};
	return ObservableArrayAdministration;
}();
function createObservableArray(initialValues, enhancer, name, owned) {
	if (name === void 0) name = "ObservableArray";
	if (owned === void 0) owned = false;
	assertProxies();
	return initObservable(function() {
		var adm = new ObservableArrayAdministration(name, enhancer, owned, false);
		addHiddenFinalProp(adm.values_, $mobx, adm);
		var proxy = new Proxy(adm.values_, arrayTraps);
		adm.proxy_ = proxy;
		if (initialValues && initialValues.length) adm.spliceWithArray_(0, 0, initialValues);
		return proxy;
	});
}
var arrayExtensions = {
	clear: function clear() {
		return this.splice(0);
	},
	replace: function replace(newItems) {
		var adm = this[$mobx];
		return adm.spliceWithArray_(0, adm.values_.length, newItems);
	},
	toJSON: function toJSON() {
		return this.slice();
	},
	splice: function splice(index, deleteCount) {
		for (var _len = arguments.length, newItems = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) newItems[_key - 2] = arguments[_key];
		var adm = this[$mobx];
		switch (arguments.length) {
			case 0: return [];
			case 1: return adm.spliceWithArray_(index);
			case 2: return adm.spliceWithArray_(index, deleteCount);
		}
		return adm.spliceWithArray_(index, deleteCount, newItems);
	},
	spliceWithArray: function spliceWithArray(index, deleteCount, newItems) {
		return this[$mobx].spliceWithArray_(index, deleteCount, newItems);
	},
	push: function push() {
		var adm = this[$mobx];
		for (var _len2 = arguments.length, items = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) items[_key2] = arguments[_key2];
		adm.spliceWithArray_(adm.values_.length, 0, items);
		return adm.values_.length;
	},
	pop: function pop() {
		return this.splice(Math.max(this[$mobx].values_.length - 1, 0), 1)[0];
	},
	shift: function shift() {
		return this.splice(0, 1)[0];
	},
	unshift: function unshift() {
		var adm = this[$mobx];
		for (var _len3 = arguments.length, items = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) items[_key3] = arguments[_key3];
		adm.spliceWithArray_(0, 0, items);
		return adm.values_.length;
	},
	reverse: function reverse() {
		if (globalState.trackingDerivation) die(37, "reverse");
		this.replace(this.slice().reverse());
		return this;
	},
	sort: function sort() {
		if (globalState.trackingDerivation) die(37, "sort");
		var copy = this.slice();
		copy.sort.apply(copy, arguments);
		this.replace(copy);
		return this;
	},
	remove: function remove(value) {
		var adm = this[$mobx];
		var idx = adm.dehanceValues_(adm.values_).indexOf(value);
		if (idx > -1) {
			this.splice(idx, 1);
			return true;
		}
		return false;
	}
};
/**
* Wrap function from prototype
* Without this, everything works as well, but this works
* faster as everything works on unproxied values
*/
addArrayExtension("at", simpleFunc);
addArrayExtension("concat", simpleFunc);
addArrayExtension("flat", simpleFunc);
addArrayExtension("includes", simpleFunc);
addArrayExtension("indexOf", simpleFunc);
addArrayExtension("join", simpleFunc);
addArrayExtension("lastIndexOf", simpleFunc);
addArrayExtension("slice", simpleFunc);
addArrayExtension("toString", simpleFunc);
addArrayExtension("toLocaleString", simpleFunc);
addArrayExtension("toSorted", simpleFunc);
addArrayExtension("toSpliced", simpleFunc);
addArrayExtension("with", simpleFunc);
addArrayExtension("every", mapLikeFunc);
addArrayExtension("filter", mapLikeFunc);
addArrayExtension("find", mapLikeFunc);
addArrayExtension("findIndex", mapLikeFunc);
addArrayExtension("findLast", mapLikeFunc);
addArrayExtension("findLastIndex", mapLikeFunc);
addArrayExtension("flatMap", mapLikeFunc);
addArrayExtension("forEach", mapLikeFunc);
addArrayExtension("map", mapLikeFunc);
addArrayExtension("some", mapLikeFunc);
addArrayExtension("toReversed", mapLikeFunc);
addArrayExtension("reduce", reduceLikeFunc);
addArrayExtension("reduceRight", reduceLikeFunc);
function addArrayExtension(funcName, funcFactory) {
	if (typeof Array.prototype[funcName] === "function") arrayExtensions[funcName] = funcFactory(funcName);
}
function simpleFunc(funcName) {
	return function() {
		var adm = this[$mobx];
		adm.atom_.reportObserved();
		var dehancedValues = adm.dehanceValues_(adm.values_);
		return dehancedValues[funcName].apply(dehancedValues, arguments);
	};
}
function mapLikeFunc(funcName) {
	return function(callback, thisArg) {
		var _this2 = this;
		var adm = this[$mobx];
		adm.atom_.reportObserved();
		return adm.dehanceValues_(adm.values_)[funcName](function(element, index) {
			return callback.call(thisArg, element, index, _this2);
		});
	};
}
function reduceLikeFunc(funcName) {
	return function() {
		var _this3 = this;
		var adm = this[$mobx];
		adm.atom_.reportObserved();
		var dehancedValues = adm.dehanceValues_(adm.values_);
		var callback = arguments[0];
		arguments[0] = function(accumulator, currentValue, index) {
			return callback(accumulator, currentValue, index, _this3);
		};
		return dehancedValues[funcName].apply(dehancedValues, arguments);
	};
}
var isObservableArrayAdministration = /* @__PURE__ */ createInstanceofPredicate("ObservableArrayAdministration", ObservableArrayAdministration);
function isObservableArray(thing) {
	return isObject(thing) && isObservableArrayAdministration(thing[$mobx]);
}
var ObservableMapMarker = {};
var ADD = "add";
var DELETE = "delete";
var ObservableMap = /* @__PURE__ */ function() {
	function ObservableMap(initialData, enhancer_, name_) {
		var _this = this;
		if (enhancer_ === void 0) enhancer_ = deepEnhancer;
		if (name_ === void 0) name_ = "ObservableMap";
		this.enhancer_ = void 0;
		this.name_ = void 0;
		this[$mobx] = ObservableMapMarker;
		this.data_ = void 0;
		this.hasMap_ = void 0;
		this.keysAtom_ = void 0;
		this.interceptors_ = void 0;
		this.changeListeners_ = void 0;
		this.dehancer = void 0;
		this.enhancer_ = enhancer_;
		this.name_ = name_;
		if (!isFunction(Map)) die(18);
		initObservable(function() {
			_this.keysAtom_ = createAtom("ObservableMap.keys()");
			_this.data_ = /* @__PURE__ */ new Map();
			_this.hasMap_ = /* @__PURE__ */ new Map();
			if (initialData) _this.merge(initialData);
		});
	}
	var _proto = ObservableMap.prototype;
	_proto.has_ = function has_(key) {
		return this.data_.has(key);
	};
	_proto.has = function has(key) {
		var _this2 = this;
		if (!globalState.trackingDerivation) return this.has_(key);
		var entry = this.hasMap_.get(key);
		if (!entry) {
			var newEntry = entry = new ObservableValue(this.has_(key), referenceEnhancer, "ObservableMap.key?", false);
			this.hasMap_.set(key, newEntry);
			onBecomeUnobserved(newEntry, function() {
				return _this2.hasMap_["delete"](key);
			});
		}
		return entry.get();
	};
	_proto.set = function set(key, value) {
		var hasKey = this.has_(key);
		if (hasInterceptors(this)) {
			var change = interceptChange(this, {
				type: hasKey ? UPDATE : ADD,
				object: this,
				newValue: value,
				name: key
			});
			if (!change) return this;
			value = change.newValue;
		}
		if (hasKey) this.updateValue_(key, value);
		else this.addValue_(key, value);
		return this;
	};
	_proto["delete"] = function _delete(key) {
		var _this3 = this;
		checkIfStateModificationsAreAllowed(this.keysAtom_);
		if (hasInterceptors(this)) {
			if (!interceptChange(this, {
				type: DELETE,
				object: this,
				name: key
			})) return false;
		}
		if (this.has_(key)) {
			var notifySpy = isSpyEnabled();
			var notify = hasListeners(this);
			var _change = notify || notifySpy ? {
				observableKind: "map",
				debugObjectName: this.name_,
				type: DELETE,
				object: this,
				oldValue: this.data_.get(key).value_,
				name: key
			} : null;
			transaction(function() {
				var _this3$hasMap_$get;
				_this3.keysAtom_.reportChanged();
				(_this3$hasMap_$get = _this3.hasMap_.get(key)) == null || _this3$hasMap_$get.setNewValue_(false);
				_this3.data_.get(key).setNewValue_(void 0);
				_this3.data_["delete"](key);
			});
			if (notify) notifyListeners(this, _change);
			return true;
		}
		return false;
	};
	_proto.updateValue_ = function updateValue_(key, newValue) {
		var observable = this.data_.get(key);
		newValue = observable.prepareNewValue_(newValue);
		if (newValue !== globalState.UNCHANGED) {
			var notifySpy = isSpyEnabled();
			var notify = hasListeners(this);
			var change = notify || notifySpy ? {
				observableKind: "map",
				debugObjectName: this.name_,
				type: UPDATE,
				object: this,
				oldValue: observable.value_,
				name: key,
				newValue
			} : null;
			observable.setNewValue_(newValue);
			if (notify) notifyListeners(this, change);
		}
	};
	_proto.addValue_ = function addValue_(key, newValue) {
		var _this4 = this;
		checkIfStateModificationsAreAllowed(this.keysAtom_);
		transaction(function() {
			var _this4$hasMap_$get;
			var observable = new ObservableValue(newValue, _this4.enhancer_, "ObservableMap.key", false);
			_this4.data_.set(key, observable);
			newValue = observable.value_;
			(_this4$hasMap_$get = _this4.hasMap_.get(key)) == null || _this4$hasMap_$get.setNewValue_(true);
			_this4.keysAtom_.reportChanged();
		});
		var notifySpy = isSpyEnabled();
		var notify = hasListeners(this);
		var change = notify || notifySpy ? {
			observableKind: "map",
			debugObjectName: this.name_,
			type: ADD,
			object: this,
			name: key,
			newValue
		} : null;
		if (notify) notifyListeners(this, change);
	};
	_proto.get = function get(key) {
		if (this.has(key)) return this.dehanceValue_(this.data_.get(key).get());
		return this.dehanceValue_(void 0);
	};
	_proto.dehanceValue_ = function dehanceValue_(value) {
		if (this.dehancer !== void 0) return this.dehancer(value);
		return value;
	};
	_proto.keys = function keys() {
		this.keysAtom_.reportObserved();
		return this.data_.keys();
	};
	_proto.values = function values() {
		var self = this;
		var keys = this.keys();
		return makeIterableForMap({ next: function next() {
			var _keys$next = keys.next(), done = _keys$next.done, value = _keys$next.value;
			return {
				done,
				value: done ? void 0 : self.get(value)
			};
		} });
	};
	_proto.entries = function entries() {
		var self = this;
		var keys = this.keys();
		return makeIterableForMap({ next: function next() {
			var _keys$next2 = keys.next(), done = _keys$next2.done, value = _keys$next2.value;
			return {
				done,
				value: done ? void 0 : [value, self.get(value)]
			};
		} });
	};
	_proto[Symbol.iterator] = function() {
		return this.entries();
	};
	_proto.forEach = function forEach(callback, thisArg) {
		for (var _iterator = _createForOfIteratorHelperLoose(this), _step; !(_step = _iterator()).done;) {
			var _step$value = _step.value, key = _step$value[0], value = _step$value[1];
			callback.call(thisArg, value, key, this);
		}
	};
	_proto.merge = function merge(other) {
		var _this5 = this;
		if (isObservableMap(other)) other = new Map(other);
		transaction(function() {
			if (isPlainObject(other)) getPlainObjectKeys(other).forEach(function(key) {
				return _this5.set(key, other[key]);
			});
			else if (Array.isArray(other)) other.forEach(function(_ref) {
				var key = _ref[0], value = _ref[1];
				return _this5.set(key, value);
			});
			else if (isES6Map(other)) {
				if (!isPlainES6Map(other)) die(19, other);
				other.forEach(function(value, key) {
					return _this5.set(key, value);
				});
			} else if (other !== null && other !== void 0) die(20, other);
		});
		return this;
	};
	_proto.clear = function clear() {
		var _this6 = this;
		transaction(function() {
			untracked(function() {
				for (var _iterator2 = _createForOfIteratorHelperLoose(_this6.keys()), _step2; !(_step2 = _iterator2()).done;) {
					var key = _step2.value;
					_this6["delete"](key);
				}
			});
		});
	};
	_proto.replace = function replace(values) {
		var _this7 = this;
		transaction(function() {
			var replacementMap = convertToMap(values);
			var orderedData = /* @__PURE__ */ new Map();
			var keysReportChangedCalled = false;
			for (var _iterator3 = _createForOfIteratorHelperLoose(_this7.data_.keys()), _step3; !(_step3 = _iterator3()).done;) {
				var key = _step3.value;
				if (!replacementMap.has(key)) if (_this7["delete"](key)) keysReportChangedCalled = true;
				else {
					var value = _this7.data_.get(key);
					orderedData.set(key, value);
				}
			}
			for (var _iterator4 = _createForOfIteratorHelperLoose(replacementMap.entries()), _step4; !(_step4 = _iterator4()).done;) {
				var _step4$value = _step4.value, _key = _step4$value[0], _value = _step4$value[1];
				var keyExisted = _this7.data_.has(_key);
				_this7.set(_key, _value);
				if (_this7.data_.has(_key)) {
					var _value2 = _this7.data_.get(_key);
					orderedData.set(_key, _value2);
					if (!keyExisted) keysReportChangedCalled = true;
				}
			}
			if (!keysReportChangedCalled) if (_this7.data_.size !== orderedData.size) _this7.keysAtom_.reportChanged();
			else {
				var iter1 = _this7.data_.keys();
				var iter2 = orderedData.keys();
				var next1 = iter1.next();
				var next2 = iter2.next();
				while (!next1.done) {
					if (next1.value !== next2.value) {
						_this7.keysAtom_.reportChanged();
						break;
					}
					next1 = iter1.next();
					next2 = iter2.next();
				}
			}
			_this7.data_ = orderedData;
		});
		return this;
	};
	_proto.toString = function toString() {
		return "[object ObservableMap]";
	};
	_proto.toJSON = function toJSON() {
		return Array.from(this);
	};
	/**
	* Observes this object. Triggers for the events 'add', 'update' and 'delete'.
	* See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/observe
	* for callback details
	*/
	_proto.observe_ = function observe_(listener, fireImmediately) {
		return registerListener(this, listener);
	};
	_proto.intercept_ = function intercept_(handler) {
		return registerInterceptor(this, handler);
	};
	return _createClass(ObservableMap, [{
		key: "size",
		get: function get() {
			this.keysAtom_.reportObserved();
			return this.data_.size;
		}
	}, {
		key: Symbol.toStringTag,
		get: function get() {
			return "Map";
		}
	}]);
}();
var isObservableMap = /* @__PURE__ */ createInstanceofPredicate("ObservableMap", ObservableMap);
function makeIterableForMap(iterator) {
	iterator[Symbol.toStringTag] = "MapIterator";
	return makeIterable(iterator);
}
function convertToMap(dataStructure) {
	if (isES6Map(dataStructure) || isObservableMap(dataStructure)) return dataStructure;
	else if (Array.isArray(dataStructure)) return new Map(dataStructure);
	else if (isPlainObject(dataStructure)) {
		var map = /* @__PURE__ */ new Map();
		for (var key in dataStructure) map.set(key, dataStructure[key]);
		return map;
	} else return die(21, dataStructure);
}
var ObservableSetMarker = {};
var ObservableSet = /* @__PURE__ */ function() {
	function ObservableSet(initialData, enhancer, name_) {
		var _this = this;
		if (enhancer === void 0) enhancer = deepEnhancer;
		if (name_ === void 0) name_ = "ObservableSet";
		this.name_ = void 0;
		this[$mobx] = ObservableSetMarker;
		this.data_ = /* @__PURE__ */ new Set();
		this.atom_ = void 0;
		this.changeListeners_ = void 0;
		this.interceptors_ = void 0;
		this.dehancer = void 0;
		this.enhancer_ = void 0;
		this.name_ = name_;
		if (!isFunction(Set)) die(22);
		this.enhancer_ = function(newV, oldV) {
			return enhancer(newV, oldV, name_);
		};
		initObservable(function() {
			_this.atom_ = createAtom(_this.name_);
			if (initialData) _this.replace(initialData);
		});
	}
	var _proto = ObservableSet.prototype;
	_proto.dehanceValue_ = function dehanceValue_(value) {
		if (this.dehancer !== void 0) return this.dehancer(value);
		return value;
	};
	_proto.clear = function clear() {
		var _this2 = this;
		transaction(function() {
			untracked(function() {
				for (var _iterator = _createForOfIteratorHelperLoose(_this2.data_.values()), _step; !(_step = _iterator()).done;) {
					var value = _step.value;
					_this2["delete"](value);
				}
			});
		});
	};
	_proto.forEach = function forEach(callbackFn, thisArg) {
		for (var _iterator2 = _createForOfIteratorHelperLoose(this), _step2; !(_step2 = _iterator2()).done;) {
			var value = _step2.value;
			callbackFn.call(thisArg, value, value, this);
		}
	};
	_proto.add = function add(value) {
		var _this3 = this;
		checkIfStateModificationsAreAllowed(this.atom_);
		if (hasInterceptors(this)) {
			var change = interceptChange(this, {
				type: ADD,
				object: this,
				newValue: value
			});
			if (!change) return this;
			value = change.newValue;
		}
		if (!this.has(value)) {
			transaction(function() {
				_this3.data_.add(_this3.enhancer_(value, void 0));
				_this3.atom_.reportChanged();
			});
			var notifySpy = false;
			var notify = hasListeners(this);
			var _change = notify || notifySpy ? {
				observableKind: "set",
				debugObjectName: this.name_,
				type: ADD,
				object: this,
				newValue: value
			} : null;
			if (notify) notifyListeners(this, _change);
		}
		return this;
	};
	_proto["delete"] = function _delete(value) {
		var _this4 = this;
		if (hasInterceptors(this)) {
			if (!interceptChange(this, {
				type: DELETE,
				object: this,
				oldValue: value
			})) return false;
		}
		if (this.has(value)) {
			var notifySpy = false;
			var notify = hasListeners(this);
			var _change2 = notify || notifySpy ? {
				observableKind: "set",
				debugObjectName: this.name_,
				type: DELETE,
				object: this,
				oldValue: value
			} : null;
			transaction(function() {
				_this4.atom_.reportChanged();
				_this4.data_["delete"](value);
			});
			if (notify) notifyListeners(this, _change2);
			return true;
		}
		return false;
	};
	_proto.has = function has(value) {
		this.atom_.reportObserved();
		return this.data_.has(this.dehanceValue_(value));
	};
	_proto.entries = function entries() {
		var values = this.values();
		return makeIterableForSet({ next: function next() {
			var _values$next = values.next(), value = _values$next.value, done = _values$next.done;
			return !done ? {
				value: [value, value],
				done
			} : {
				value: void 0,
				done
			};
		} });
	};
	_proto.keys = function keys() {
		return this.values();
	};
	_proto.values = function values() {
		this.atom_.reportObserved();
		var self = this;
		var values = this.data_.values();
		return makeIterableForSet({ next: function next() {
			var _values$next2 = values.next(), value = _values$next2.value, done = _values$next2.done;
			return !done ? {
				value: self.dehanceValue_(value),
				done
			} : {
				value: void 0,
				done
			};
		} });
	};
	_proto.intersection = function intersection(otherSet) {
		if (isES6Set(otherSet) && !isObservableSet(otherSet)) return otherSet.intersection(this);
		else return new Set(this).intersection(otherSet);
	};
	_proto.union = function union(otherSet) {
		if (isES6Set(otherSet) && !isObservableSet(otherSet)) return otherSet.union(this);
		else return new Set(this).union(otherSet);
	};
	_proto.difference = function difference(otherSet) {
		return new Set(this).difference(otherSet);
	};
	_proto.symmetricDifference = function symmetricDifference(otherSet) {
		if (isES6Set(otherSet) && !isObservableSet(otherSet)) return otherSet.symmetricDifference(this);
		else return new Set(this).symmetricDifference(otherSet);
	};
	_proto.isSubsetOf = function isSubsetOf(otherSet) {
		return new Set(this).isSubsetOf(otherSet);
	};
	_proto.isSupersetOf = function isSupersetOf(otherSet) {
		return new Set(this).isSupersetOf(otherSet);
	};
	_proto.isDisjointFrom = function isDisjointFrom(otherSet) {
		if (isES6Set(otherSet) && !isObservableSet(otherSet)) return otherSet.isDisjointFrom(this);
		else return new Set(this).isDisjointFrom(otherSet);
	};
	_proto.replace = function replace(other) {
		var _this5 = this;
		if (isObservableSet(other)) other = new Set(other);
		transaction(function() {
			if (Array.isArray(other)) {
				_this5.clear();
				other.forEach(function(value) {
					return _this5.add(value);
				});
			} else if (isES6Set(other)) {
				_this5.clear();
				other.forEach(function(value) {
					return _this5.add(value);
				});
			} else if (other !== null && other !== void 0) die("Cannot initialize set from " + other);
		});
		return this;
	};
	_proto.observe_ = function observe_(listener, fireImmediately) {
		return registerListener(this, listener);
	};
	_proto.intercept_ = function intercept_(handler) {
		return registerInterceptor(this, handler);
	};
	_proto.toJSON = function toJSON() {
		return Array.from(this);
	};
	_proto.toString = function toString() {
		return "[object ObservableSet]";
	};
	_proto[Symbol.iterator] = function() {
		return this.values();
	};
	return _createClass(ObservableSet, [{
		key: "size",
		get: function get() {
			this.atom_.reportObserved();
			return this.data_.size;
		}
	}, {
		key: Symbol.toStringTag,
		get: function get() {
			return "Set";
		}
	}]);
}();
var isObservableSet = /* @__PURE__ */ createInstanceofPredicate("ObservableSet", ObservableSet);
function makeIterableForSet(iterator) {
	iterator[Symbol.toStringTag] = "SetIterator";
	return makeIterable(iterator);
}
var descriptorCache = /* @__PURE__ */ Object.create(null);
var REMOVE = "remove";
var ObservableObjectAdministration = /* @__PURE__ */ function() {
	function ObservableObjectAdministration(target_, values_, name_, defaultAnnotation_) {
		if (values_ === void 0) values_ = /* @__PURE__ */ new Map();
		if (defaultAnnotation_ === void 0) defaultAnnotation_ = autoAnnotation;
		this.target_ = void 0;
		this.values_ = void 0;
		this.name_ = void 0;
		this.defaultAnnotation_ = void 0;
		this.keysAtom_ = void 0;
		this.changeListeners_ = void 0;
		this.interceptors_ = void 0;
		this.proxy_ = void 0;
		this.isPlainObject_ = void 0;
		this.appliedAnnotations_ = void 0;
		this.pendingKeys_ = void 0;
		this.target_ = target_;
		this.values_ = values_;
		this.name_ = name_;
		this.defaultAnnotation_ = defaultAnnotation_;
		this.keysAtom_ = new Atom("ObservableObject.keys");
		this.isPlainObject_ = isPlainObject(this.target_);
	}
	var _proto = ObservableObjectAdministration.prototype;
	_proto.getObservablePropValue_ = function getObservablePropValue_(key) {
		return this.values_.get(key).get();
	};
	_proto.setObservablePropValue_ = function setObservablePropValue_(key, newValue) {
		var observable = this.values_.get(key);
		if (observable instanceof ComputedValue) {
			observable.set(newValue);
			return true;
		}
		if (hasInterceptors(this)) {
			var change = interceptChange(this, {
				type: UPDATE,
				object: this.proxy_ || this.target_,
				name: key,
				newValue
			});
			if (!change) return null;
			newValue = change.newValue;
		}
		newValue = observable.prepareNewValue_(newValue);
		if (newValue !== globalState.UNCHANGED) {
			var notify = hasListeners(this);
			var _change = notify || false ? {
				type: UPDATE,
				observableKind: "object",
				debugObjectName: this.name_,
				object: this.proxy_ || this.target_,
				oldValue: observable.value_,
				name: key,
				newValue
			} : null;
			observable.setNewValue_(newValue);
			if (notify) notifyListeners(this, _change);
		}
		return true;
	};
	_proto.get_ = function get_(key) {
		if (globalState.trackingDerivation && !hasProp(this.target_, key)) this.has_(key);
		return this.target_[key];
	};
	_proto.set_ = function set_(key, value, proxyTrap) {
		if (proxyTrap === void 0) proxyTrap = false;
		if (hasProp(this.target_, key)) if (this.values_.has(key)) return this.setObservablePropValue_(key, value);
		else if (proxyTrap) return Reflect.set(this.target_, key, value);
		else {
			this.target_[key] = value;
			return true;
		}
		else return this.extend_(key, {
			value,
			enumerable: true,
			writable: true,
			configurable: true
		}, this.defaultAnnotation_, proxyTrap);
	};
	_proto.has_ = function has_(key) {
		if (!globalState.trackingDerivation) return key in this.target_;
		this.pendingKeys_ || (this.pendingKeys_ = /* @__PURE__ */ new Map());
		var entry = this.pendingKeys_.get(key);
		if (!entry) {
			entry = new ObservableValue(key in this.target_, referenceEnhancer, "ObservableObject.key?", false);
			this.pendingKeys_.set(key, entry);
		}
		return entry.get();
	};
	_proto.make_ = function make_(key, annotation) {
		if (annotation === true) annotation = this.defaultAnnotation_;
		if (annotation === false) return;
		assertAnnotable(this, annotation, key);
		if (!(key in this.target_)) {
			var _this$target_$storedA;
			if ((_this$target_$storedA = this.target_[storedAnnotationsSymbol]) != null && _this$target_$storedA[key]) return;
			else die(1, annotation.annotationType_, this.name_ + "." + key.toString());
		}
		var source = this.target_;
		while (source && source !== objectPrototype) {
			var descriptor = getDescriptor(source, key);
			if (descriptor) {
				var outcome = annotation.make_(this, key, descriptor, source);
				if (outcome === 0) return;
				if (outcome === 1) break;
			}
			source = Object.getPrototypeOf(source);
		}
		recordAnnotationApplied(this, annotation, key);
	};
	_proto.extend_ = function extend_(key, descriptor, annotation, proxyTrap) {
		if (proxyTrap === void 0) proxyTrap = false;
		if (annotation === true) annotation = this.defaultAnnotation_;
		if (annotation === false) return this.defineProperty_(key, descriptor, proxyTrap);
		assertAnnotable(this, annotation, key);
		var outcome = annotation.extend_(this, key, descriptor, proxyTrap);
		if (outcome) recordAnnotationApplied(this, annotation, key);
		return outcome;
	};
	_proto.defineProperty_ = function defineProperty_(key, descriptor, proxyTrap) {
		if (proxyTrap === void 0) proxyTrap = false;
		checkIfStateModificationsAreAllowed(this.keysAtom_);
		try {
			startBatch();
			var deleteOutcome = this.delete_(key);
			if (!deleteOutcome) return deleteOutcome;
			if (hasInterceptors(this)) {
				var change = interceptChange(this, {
					object: this.proxy_ || this.target_,
					name: key,
					type: ADD,
					newValue: descriptor.value
				});
				if (!change) return null;
				var newValue = change.newValue;
				if (descriptor.value !== newValue) descriptor = _extends({}, descriptor, { value: newValue });
			}
			if (proxyTrap) {
				if (!Reflect.defineProperty(this.target_, key, descriptor)) return false;
			} else defineProperty(this.target_, key, descriptor);
			this.notifyPropertyAddition_(key, descriptor.value);
		} finally {
			endBatch();
		}
		return true;
	};
	_proto.defineObservableProperty_ = function defineObservableProperty_(key, value, enhancer, proxyTrap) {
		if (proxyTrap === void 0) proxyTrap = false;
		checkIfStateModificationsAreAllowed(this.keysAtom_);
		try {
			startBatch();
			var deleteOutcome = this.delete_(key);
			if (!deleteOutcome) return deleteOutcome;
			if (hasInterceptors(this)) {
				var change = interceptChange(this, {
					object: this.proxy_ || this.target_,
					name: key,
					type: ADD,
					newValue: value
				});
				if (!change) return null;
				value = change.newValue;
			}
			var cachedDescriptor = getCachedObservablePropDescriptor(key);
			var descriptor = {
				configurable: globalState.safeDescriptors ? this.isPlainObject_ : true,
				enumerable: true,
				get: cachedDescriptor.get,
				set: cachedDescriptor.set
			};
			if (proxyTrap) {
				if (!Reflect.defineProperty(this.target_, key, descriptor)) return false;
			} else defineProperty(this.target_, key, descriptor);
			var observable = new ObservableValue(value, enhancer, "ObservableObject.key", false);
			this.values_.set(key, observable);
			this.notifyPropertyAddition_(key, observable.value_);
		} finally {
			endBatch();
		}
		return true;
	};
	_proto.defineComputedProperty_ = function defineComputedProperty_(key, options, proxyTrap) {
		if (proxyTrap === void 0) proxyTrap = false;
		checkIfStateModificationsAreAllowed(this.keysAtom_);
		try {
			startBatch();
			var deleteOutcome = this.delete_(key);
			if (!deleteOutcome) return deleteOutcome;
			if (hasInterceptors(this)) {
				if (!interceptChange(this, {
					object: this.proxy_ || this.target_,
					name: key,
					type: ADD,
					newValue: void 0
				})) return null;
			}
			options.name || (options.name = "ObservableObject.key");
			options.context = this.proxy_ || this.target_;
			var cachedDescriptor = getCachedObservablePropDescriptor(key);
			var descriptor = {
				configurable: globalState.safeDescriptors ? this.isPlainObject_ : true,
				enumerable: false,
				get: cachedDescriptor.get,
				set: cachedDescriptor.set
			};
			if (proxyTrap) {
				if (!Reflect.defineProperty(this.target_, key, descriptor)) return false;
			} else defineProperty(this.target_, key, descriptor);
			this.values_.set(key, new ComputedValue(options));
			this.notifyPropertyAddition_(key, void 0);
		} finally {
			endBatch();
		}
		return true;
	};
	_proto.delete_ = function delete_(key, proxyTrap) {
		if (proxyTrap === void 0) proxyTrap = false;
		checkIfStateModificationsAreAllowed(this.keysAtom_);
		if (!hasProp(this.target_, key)) return true;
		if (hasInterceptors(this)) {
			if (!interceptChange(this, {
				object: this.proxy_ || this.target_,
				name: key,
				type: REMOVE
			})) return null;
		}
		try {
			var _this$pendingKeys_;
			startBatch();
			var notify = hasListeners(this);
			var notifySpy = false;
			var observable = this.values_.get(key);
			var value = void 0;
			if (!observable && (notify || notifySpy)) {
				var _getDescriptor;
				value = (_getDescriptor = getDescriptor(this.target_, key)) == null ? void 0 : _getDescriptor.value;
			}
			if (proxyTrap) {
				if (!Reflect.deleteProperty(this.target_, key)) return false;
			} else delete this.target_[key];
			if (observable) {
				this.values_["delete"](key);
				if (observable instanceof ObservableValue) value = observable.value_;
				propagateChanged(observable);
			}
			this.keysAtom_.reportChanged();
			(_this$pendingKeys_ = this.pendingKeys_) == null || (_this$pendingKeys_ = _this$pendingKeys_.get(key)) == null || _this$pendingKeys_.set(key in this.target_);
			if (notify || notifySpy) {
				var _change2 = {
					type: REMOVE,
					observableKind: "object",
					object: this.proxy_ || this.target_,
					debugObjectName: this.name_,
					oldValue: value,
					name: key
				};
				if (notify) notifyListeners(this, _change2);
			}
		} finally {
			endBatch();
		}
		return true;
	};
	_proto.observe_ = function observe_(callback, fireImmediately) {
		return registerListener(this, callback);
	};
	_proto.intercept_ = function intercept_(handler) {
		return registerInterceptor(this, handler);
	};
	_proto.notifyPropertyAddition_ = function notifyPropertyAddition_(key, value) {
		var _this$pendingKeys_2;
		var notify = hasListeners(this);
		var notifySpy = false;
		if (notify || notifySpy) {
			var change = notify || notifySpy ? {
				type: ADD,
				observableKind: "object",
				debugObjectName: this.name_,
				object: this.proxy_ || this.target_,
				name: key,
				newValue: value
			} : null;
			if (notify) notifyListeners(this, change);
		}
		(_this$pendingKeys_2 = this.pendingKeys_) == null || (_this$pendingKeys_2 = _this$pendingKeys_2.get(key)) == null || _this$pendingKeys_2.set(true);
		this.keysAtom_.reportChanged();
	};
	_proto.ownKeys_ = function ownKeys_() {
		this.keysAtom_.reportObserved();
		return ownKeys(this.target_);
	};
	_proto.keys_ = function keys_() {
		this.keysAtom_.reportObserved();
		return Object.keys(this.target_);
	};
	return ObservableObjectAdministration;
}();
function asObservableObject(target, options) {
	var _options$name;
	if (hasProp(target, $mobx)) return target;
	var name = (_options$name = options == null ? void 0 : options.name) != null ? _options$name : "ObservableObject";
	addHiddenProp(target, $mobx, new ObservableObjectAdministration(target, /* @__PURE__ */ new Map(), String(name), getAnnotationFromOptions(options)));
	return target;
}
var isObservableObjectAdministration = /* @__PURE__ */ createInstanceofPredicate("ObservableObjectAdministration", ObservableObjectAdministration);
function getCachedObservablePropDescriptor(key) {
	return descriptorCache[key] || (descriptorCache[key] = {
		get: function get() {
			return this[$mobx].getObservablePropValue_(key);
		},
		set: function set(value) {
			return this[$mobx].setObservablePropValue_(key, value);
		}
	});
}
function isObservableObject(thing) {
	if (isObject(thing)) return isObservableObjectAdministration(thing[$mobx]);
	return false;
}
function recordAnnotationApplied(adm, annotation, key) {
	var _adm$target_$storedAn;
	(_adm$target_$storedAn = adm.target_[storedAnnotationsSymbol]) == null || delete _adm$target_$storedAn[key];
}
function assertAnnotable(adm, annotation, key) {}
var ENTRY_0 = /* @__PURE__ */ createArrayEntryDescriptor(0);
var safariPrototypeSetterInheritanceBug = /* @__PURE__ */ function() {
	var v = false;
	var p = {};
	Object.defineProperty(p, "0", { set: function set() {
		v = true;
	} });
	Object.create(p)["0"] = 1;
	return v === false;
}();
/**
* This array buffer contains two lists of properties, so that all arrays
* can recycle their property definitions, which significantly improves performance of creating
* properties on the fly.
*/
var OBSERVABLE_ARRAY_BUFFER_SIZE = 0;
var StubArray = function StubArray() {};
function inherit(ctor, proto) {
	if (Object.setPrototypeOf) Object.setPrototypeOf(ctor.prototype, proto);
	else if (ctor.prototype.__proto__ !== void 0) ctor.prototype.__proto__ = proto;
	else ctor.prototype = proto;
}
inherit(StubArray, Array.prototype);
var LegacyObservableArray = /* @__PURE__ */ function(_StubArray) {
	function LegacyObservableArray(initialValues, enhancer, name, owned) {
		var _this;
		if (name === void 0) name = "ObservableArray";
		if (owned === void 0) owned = false;
		_this = _StubArray.call(this) || this;
		initObservable(function() {
			var adm = new ObservableArrayAdministration(name, enhancer, owned, true);
			adm.proxy_ = _this;
			addHiddenFinalProp(_this, $mobx, adm);
			if (initialValues && initialValues.length) _this.spliceWithArray(0, 0, initialValues);
			if (safariPrototypeSetterInheritanceBug) Object.defineProperty(_this, "0", ENTRY_0);
		});
		return _this;
	}
	_inheritsLoose(LegacyObservableArray, _StubArray);
	var _proto = LegacyObservableArray.prototype;
	_proto.concat = function concat() {
		this[$mobx].atom_.reportObserved();
		for (var _len = arguments.length, arrays = new Array(_len), _key = 0; _key < _len; _key++) arrays[_key] = arguments[_key];
		return Array.prototype.concat.apply(this.slice(), arrays.map(function(a) {
			return isObservableArray(a) ? a.slice() : a;
		}));
	};
	_proto[Symbol.iterator] = function() {
		var self = this;
		var nextIndex = 0;
		return makeIterable({ next: function next() {
			return nextIndex < self.length ? {
				value: self[nextIndex++],
				done: false
			} : {
				done: true,
				value: void 0
			};
		} });
	};
	return _createClass(LegacyObservableArray, [{
		key: "length",
		get: function get() {
			return this[$mobx].getArrayLength_();
		},
		set: function set(newLength) {
			this[$mobx].setArrayLength_(newLength);
		}
	}, {
		key: Symbol.toStringTag,
		get: function get() {
			return "Array";
		}
	}]);
}(StubArray);
Object.entries(arrayExtensions).forEach(function(_ref) {
	var prop = _ref[0], fn = _ref[1];
	if (prop !== "concat") addHiddenProp(LegacyObservableArray.prototype, prop, fn);
});
function createArrayEntryDescriptor(index) {
	return {
		enumerable: false,
		configurable: true,
		get: function get() {
			return this[$mobx].get_(index);
		},
		set: function set(value) {
			this[$mobx].set_(index, value);
		}
	};
}
function createArrayBufferItem(index) {
	defineProperty(LegacyObservableArray.prototype, "" + index, createArrayEntryDescriptor(index));
}
function reserveArrayBuffer(max) {
	if (max > OBSERVABLE_ARRAY_BUFFER_SIZE) {
		for (var index = OBSERVABLE_ARRAY_BUFFER_SIZE; index < max + 100; index++) createArrayBufferItem(index);
		OBSERVABLE_ARRAY_BUFFER_SIZE = max;
	}
}
reserveArrayBuffer(1e3);
function createLegacyArray(initialValues, enhancer, name) {
	return new LegacyObservableArray(initialValues, enhancer, name);
}
function getAtom(thing, property) {
	if (typeof thing === "object" && thing !== null) {
		if (isObservableArray(thing)) {
			if (property !== void 0) die(23);
			return thing[$mobx].atom_;
		}
		if (isObservableSet(thing)) return thing.atom_;
		if (isObservableMap(thing)) {
			if (property === void 0) return thing.keysAtom_;
			var observable = thing.data_.get(property) || thing.hasMap_.get(property);
			if (!observable) die(25, property, getDebugName(thing));
			return observable;
		}
		if (isObservableObject(thing)) {
			if (!property) return die(26);
			var _observable = thing[$mobx].values_.get(property);
			if (!_observable) die(27, property, getDebugName(thing));
			return _observable;
		}
		if (isAtom(thing) || isComputedValue(thing) || isReaction(thing)) return thing;
	} else if (isFunction(thing)) {
		if (isReaction(thing[$mobx])) return thing[$mobx];
	}
	die(28);
}
function getAdministration(thing, property) {
	if (!thing) die(29);
	if (property !== void 0) return getAdministration(getAtom(thing, property));
	if (isAtom(thing) || isComputedValue(thing) || isReaction(thing)) return thing;
	if (isObservableMap(thing) || isObservableSet(thing)) return thing;
	if (thing[$mobx]) return thing[$mobx];
	die(24, thing);
}
function getDebugName(thing, property) {
	var named;
	if (property !== void 0) named = getAtom(thing, property);
	else if (isAction(thing)) return thing.name;
	else if (isObservableObject(thing) || isObservableMap(thing) || isObservableSet(thing)) named = getAdministration(thing);
	else named = getAtom(thing);
	return named.name_;
}
/**
* Helper function for initializing observable structures, it applies:
* 1. allowStateChanges so we don't violate enforceActions.
* 2. untracked so we don't accidentaly subscribe to anything observable accessed during init in case the observable is created inside derivation.
* 3. batch to avoid state version updates
*/
function initObservable(cb) {
	var derivation = untrackedStart();
	var allowStateChanges = allowStateChangesStart(true);
	startBatch();
	try {
		return cb();
	} finally {
		endBatch();
		allowStateChangesEnd(allowStateChanges);
		untrackedEnd(derivation);
	}
}
var toString = objectPrototype.toString;
function deepEqual(a, b, depth) {
	if (depth === void 0) depth = -1;
	return eq(a, b, depth);
}
function eq(a, b, depth, aStack, bStack) {
	if (a === b) return a !== 0 || 1 / a === 1 / b;
	if (a == null || b == null) return false;
	if (a !== a) return b !== b;
	var type = typeof a;
	if (type !== "function" && type !== "object" && typeof b != "object") return false;
	var className = toString.call(a);
	if (className !== toString.call(b)) return false;
	switch (className) {
		case "[object RegExp]":
		case "[object String]": return "" + a === "" + b;
		case "[object Number]":
			if (+a !== +a) return +b !== +b;
			return +a === 0 ? 1 / +a === 1 / b : +a === +b;
		case "[object Date]":
		case "[object Boolean]": return +a === +b;
		case "[object Symbol]": return typeof Symbol !== "undefined" && Symbol.valueOf.call(a) === Symbol.valueOf.call(b);
		case "[object Map]":
		case "[object Set]":
			if (depth >= 0) depth++;
			break;
	}
	a = unwrap(a);
	b = unwrap(b);
	var areArrays = className === "[object Array]";
	if (!areArrays) {
		if (typeof a != "object" || typeof b != "object") return false;
		var aCtor = a.constructor, bCtor = b.constructor;
		if (aCtor !== bCtor && !(isFunction(aCtor) && aCtor instanceof aCtor && isFunction(bCtor) && bCtor instanceof bCtor) && "constructor" in a && "constructor" in b) return false;
	}
	if (depth === 0) return false;
	else if (depth < 0) depth = -1;
	aStack = aStack || [];
	bStack = bStack || [];
	var length = aStack.length;
	while (length--) if (aStack[length] === a) return bStack[length] === b;
	aStack.push(a);
	bStack.push(b);
	if (areArrays) {
		length = a.length;
		if (length !== b.length) return false;
		while (length--) if (!eq(a[length], b[length], depth - 1, aStack, bStack)) return false;
	} else {
		var keys = Object.keys(a);
		var _length = keys.length;
		if (Object.keys(b).length !== _length) return false;
		for (var i = 0; i < _length; i++) {
			var key = keys[i];
			if (!(hasProp(b, key) && eq(a[key], b[key], depth - 1, aStack, bStack))) return false;
		}
	}
	aStack.pop();
	bStack.pop();
	return true;
}
function unwrap(a) {
	if (isObservableArray(a)) return a.slice();
	if (isES6Map(a) || isObservableMap(a)) return Array.from(a.entries());
	if (isES6Set(a) || isObservableSet(a)) return Array.from(a.entries());
	return a;
}
var _getGlobal$Iterator;
var maybeIteratorPrototype = ((_getGlobal$Iterator = getGlobal().Iterator) == null ? void 0 : _getGlobal$Iterator.prototype) || {};
function makeIterable(iterator) {
	iterator[Symbol.iterator] = getSelf;
	return Object.assign(Object.create(maybeIteratorPrototype), iterator);
}
function getSelf() {
	return this;
}
/**
* (c) Michel Weststrate 2015 - 2020
* MIT Licensed
*
* Welcome to the mobx sources! To get a global overview of how MobX internally works,
* this is a good place to start:
* https://medium.com/@mweststrate/becoming-fully-reactive-an-in-depth-explanation-of-mobservable-55995262a254#.xvbh6qd74
*
* Source folders:
* ===============
*
* - api/     Most of the public static methods exposed by the module can be found here.
* - core/    Implementation of the MobX algorithm; atoms, derivations, reactions, dependency trees, optimizations. Cool stuff can be found here.
* - types/   All the magic that is need to have observable objects, arrays and values is in this folder. Including the modifiers like `asFlat`.
* - utils/   Utility stuff.
*
*/
[
	"Symbol",
	"Map",
	"Set"
].forEach(function(m) {
	if (typeof getGlobal()[m] === "undefined") die("MobX requires global '" + m + "' to be available or polyfilled");
});
if (typeof __MOBX_DEVTOOLS_GLOBAL_HOOK__ === "object") __MOBX_DEVTOOLS_GLOBAL_HOOK__.injectMobx({
	spy,
	extras: { getDebugName },
	$mobx
});
//#endregion
//#region src/lib/core/Time_of_day.ts
var SECONDS_PER_DAY$1 = 1440 * 60;
/** An immutable 24-hour clock time representation. */
var Time_of_day = class Time_of_day {
	_h;
	_m;
	_s;
	constructor(hms) {
		({h: this._h, m: this._m, s: this._s} = hms);
	}
	static create_from_js_date(date) {
		return new Time_of_day({
			h: date.getHours(),
			m: date.getMinutes(),
			s: date.getSeconds()
		});
	}
	/** @param hhmm - `HH:MM` */
	static create_from_hhmm_string(hhmm) {
		const [h, m] = hhmm.split(":").map(Number);
		return new Time_of_day({
			h,
			m,
			s: 0
		});
	}
	get hour() {
		return this._h;
	}
	get minute() {
		return this._m;
	}
	get second() {
		return this._s;
	}
	get_as_hms() {
		return {
			h: this._h,
			m: this._m,
			s: this._s
		};
	}
	/** @returns `(H)H:MM:SS` */
	get_as_string_hmmss() {
		const [mm, ss] = [this._m, this._s].map((value) => String(value).padStart(2, "0"));
		return `${this._h}:${mm}:${ss}`;
	}
	/** @returns `HH:MM` */
	get_as_string_hhmm() {
		const [hh, mm] = [this._h, this._m].map((value) => String(value).padStart(2, "0"));
		return `${hh}:${mm}`;
	}
	/**
	* @param value - The offset to add.
	* @returns A new instance with the added time.
	*/
	add_minutes(value) {
		const date = new Date(0, 0, 1, this._h, this._m, this._s);
		date.setMinutes(date.getMinutes() + value);
		return Time_of_day.create_from_js_date(date);
	}
	/** Gets the delay from `this` until the next occurrence of `target`. */
	get_seconds_until_next_target(target) {
		const [target_s, this_s] = [target, this].map((time) => time._seconds_since_midnight);
		return this_s < target_s ? target_s - this_s : target_s - this_s + SECONDS_PER_DAY$1;
	}
	is_between(start, end) {
		const [this_s, start_s, end_s] = [
			this,
			start,
			end
		].map((time) => time._seconds_since_midnight);
		return start_s < end_s ? start_s <= this_s && this_s < end_s : start_s <= this_s || this_s < end_s;
	}
	get _seconds_since_midnight() {
		return this._h * 3600 + this._m * 60 + this._s;
	}
};
//#endregion
//#region src/lib/sys/gnome/system_time.js
/** @typedef {import('../../../types').Time_hms} Time_hms */
var { DateTime: DateTime$1 } = imports.gi.GLib;
/** @returns {number} seconds (s) */
function get_now_as_unix() {
	return DateTime$1.new_now_local().to_unix();
}
/** @returns {Time_of_day} */
function get_now_as_time_of_day() {
	return new Time_of_day(_datetime_to_hms(DateTime$1.new_now_local()));
}
/**
* @param {number} unix_time - seconds (s)
* @returns {Time_of_day}
*/
function new_local_time_of_day_from_unix(unix_time) {
	return new Time_of_day(_datetime_to_hms(DateTime$1.new_from_unix_local(unix_time)));
}
/**
* @param {imports.gi.GLib.DateTime} datetime
* @returns {Time_hms}
*/
function _datetime_to_hms(datetime) {
	return {
		h: datetime.get_hour(),
		m: datetime.get_minute(),
		s: datetime.get_second()
	};
}
//#endregion
//#region src/app/handlers/Appearance_handler.ts
var Appearance_handler = class {
	_time = get_now_as_time_of_day();
	update_time() {
		this._time = get_now_as_time_of_day();
	}
	twilights;
	get auto_is_dark() {
		return this._time.is_between(this.twilights.sunset, this.twilights.sunrise);
	}
	manual_is_dark;
	toggle_is_dark() {
		this.manual_is_dark = !this.manual_is_dark;
	}
	is_auto;
	toggle_is_auto() {
		this.is_auto = !this.is_auto;
	}
	get is_dark() {
		return this.is_auto ? this.auto_is_dark : this.manual_is_dark;
	}
	get is_unsynced() {
		return this.manual_is_dark !== this.auto_is_dark;
	}
	sync_is_dark() {
		this.manual_is_dark = this.auto_is_dark;
	}
	get next_twilight() {
		return this.auto_is_dark ? this.twilights.sunrise : this.twilights.sunset;
	}
	constructor(initial_controls) {
		Object.assign(this, initial_controls);
		makeAutoObservable(this);
	}
};
//#endregion
//#region src/lib/sys/cinnamon/Background_accessor.ts
var { Gio: Gio$6 } = imports.gi;
var settings$2 = {
	background: Gio$6.Settings.new("org.cinnamon.desktop.background"),
	slideshow: Gio$6.Settings.new("org.cinnamon.desktop.background.slideshow")
};
/** An accessor to the Cinnamon system background settings. */
var Background_accessor = class {
	static get is_slideshow() {
		return settings$2.slideshow.get_boolean("slideshow-enabled");
	}
	static set is_slideshow(value) {
		settings$2.slideshow.set_boolean("slideshow-enabled", value);
	}
	/** Irrelevant to get when slideshow is enabled */
	static get picture_file() {
		return settings$2.background.get_string("picture-uri");
	}
	/** /!\ To not set when slideshow is enabled */
	static set picture_file(value) {
		settings$2.background.set_string("picture-uri", value);
	}
	/** Irrelevant to get when slideshow is disabled */
	static get slideshow_folder() {
		return settings$2.slideshow.get_string("image-source");
	}
	/** /!\ To not set when slideshow is disabled */
	static set slideshow_folder(value) {
		settings$2.slideshow.set_string("image-source", value);
	}
};
//#endregion
//#region src/app/handlers/Background_handler.ts
var Background_handler = class {
	_settings;
	constructor(applet, settings) {
		this._settings = settings;
		applet.on_button_detect_background_light = () => this.detect_light_background();
		applet.on_button_detect_background_dark = () => this.detect_dark_background();
		applet.on_button_apply_background_light = () => this.apply_light_background();
		applet.on_button_apply_background_dark = () => this.apply_dark_background();
	}
	detect_light_background() {
		const is_slideshow = Background_accessor.is_slideshow;
		this._settings.light_background_is_slideshow = is_slideshow;
		if (is_slideshow) this._settings.light_background_slideshow_folder = Background_accessor.slideshow_folder.replace("directory://", "file://");
		else this._settings.light_background_file = Background_accessor.picture_file;
	}
	detect_dark_background() {
		const is_slideshow = Background_accessor.is_slideshow;
		this._settings.dark_background_is_slideshow = is_slideshow;
		if (is_slideshow) this._settings.dark_background_slideshow_folder = Background_accessor.slideshow_folder.replace("directory://", "file://");
		else this._settings.dark_background_file = Background_accessor.picture_file;
	}
	apply_light_background() {
		const is_slideshow = this._settings.light_background_is_slideshow;
		Background_accessor.is_slideshow = is_slideshow;
		if (is_slideshow) Background_accessor.slideshow_folder = decodeURIComponent(this._settings.light_background_slideshow_folder.replace("file://", "directory://"));
		else Background_accessor.picture_file = this._settings.light_background_file;
	}
	apply_dark_background() {
		const is_slideshow = this._settings.dark_background_is_slideshow;
		Background_accessor.is_slideshow = is_slideshow;
		if (is_slideshow) Background_accessor.slideshow_folder = decodeURIComponent(this._settings.dark_background_slideshow_folder.replace("file://", "directory://"));
		else Background_accessor.picture_file = this._settings.dark_background_file;
	}
};
//#endregion
//#region src/lib/sys/gnome/command_launching.js
var { Gio: Gio$5, GLib: GLib$5 } = imports.gi;
var Error_timed_out_by_sigterm = class extends Error {};
var Error_timed_out_by_sigkill = class extends Error {};
var Error_failed = class extends Error {};
var GNU_TIMEOUT_EXIT_STATUS_WHEN_SIGTERM = 124;
var GNU_TIMEOUT_EXIT_STATUS_WHEN_SIGKILL = 137;
/**
* Executes a command with a timeout and transmits any error on failure.
* @param {string} command - The shell command to execute.
* @param {number} sigterm_timeout - The delay in seconds (s) before cancelling the command with a SIGTERM. 0 means infinity/never. Defaults to 0.
* @param {number} sigkill_timeout - The delay in seconds (s) after SIGTERM before cancelling the command with a SIGKILL. 0 means infinity/never. `sigterm_timeout` at 0 disables this. Defaults to 10.
* @returns {Promise<void>} Resolves when the command has been executed or rejects if an error occurs.
* @throws {GLib.Error} - If an error occurs during communication with the subprocess running the command.
* @throws {Error_timed_out_by_sigterm} - If the command is cancelled due to a timeout by SIGTERM.
* @throws {Error_timed_out_by_sigkill} - If the command is cancelled due to a timeout by SIGKILL.
* @throws {Error_failed} - If the command fails with a non-zero exit code. The error message is the `stderr` output if any, otherwise the exit status.
*/
async function launch_command$1(command, sigterm_timeout = 0, sigkill_timeout = 10) {
	const wrapped_command = `timeout --kill-after=${sigkill_timeout}s ${sigterm_timeout}s sh -c ${GLib$5.shell_quote(command)}`;
	const [_ok, argvp] = GLib$5.shell_parse_argv(wrapped_command);
	const process = new Gio$5.Subprocess({
		argv: argvp,
		flags: Gio$5.SubprocessFlags.STDERR_PIPE
	});
	const start_time = Date.now();
	process.init(null);
	const [_stdout, stderr] = await new Promise((resolve, reject) => {
		process.communicate_utf8_async(null, null, (source, result) => {
			try {
				const [_ok, stdout, stderr] = source.communicate_utf8_finish(result);
				resolve([stdout, stderr]);
			} catch (error) {
				reject(error);
			}
		});
	});
	const elapsed_time = (Date.now() - start_time) / 1e3;
	const exit_status = process.get_exit_status();
	switch (exit_status) {
		case 0: break;
		case GNU_TIMEOUT_EXIT_STATUS_WHEN_SIGTERM: throw new Error_timed_out_by_sigterm("The command may have been timed out by SIGTERM");
		case GNU_TIMEOUT_EXIT_STATUS_WHEN_SIGKILL: throw new Error_timed_out_by_sigkill("The command was probably killed by an external SIGKILL");
		case 1: if (sigterm_timeout > 0 && elapsed_time >= sigterm_timeout + sigkill_timeout) throw new Error_timed_out_by_sigkill("The command was probably timed out by SIGKILL");
		default: throw new Error_failed(stderr ? stderr.trim() : "exit status: " + exit_status);
	}
}
//#endregion
//#region src/app/launch_command.ts
var { GLib: GLib$4 } = imports.gi;
/**
* Launches a command with a timeout and logs any error on failure.
* @param name - The name of the command to display in case of error. If empty, the command itself is used.
* @param expiry - The delay in seconds before cancelling the command with a SIGTERM, then 10 seconds later with a SIGKILL. `0` means infinity/never.
* @param command - The shell command to execute.
* @returns Resolves when the command has been executed or rejects if an error occurs.
*/
async function launch_command(name, expiry, command) {
	try {
		await launch_command$1(command, expiry);
	} catch (error) {
		const name_for_error = name !== "" ? name : command;
		let msg = `${_("Failed to run command")} '${name_for_error}'.\n`;
		if (error instanceof Error_failed) msg += `${_("Reason")}${_(":")} ${_("command error")}.\n${_("Detail")}${_(":")} ${error.message}`;
		else if (error instanceof Error_timed_out_by_sigterm) msg += `${_("Reason")}${_(":")} ${_("command timeout")}.\n${_("Detail")}${_(":")} ${error.message}`;
		else if (error instanceof Error_timed_out_by_sigkill) msg += `${_("Reason")}${_(":")} ${_("command timeout (killed)")}.\n${_("Detail")}${_(":")} ${error.message}`;
		else if (error instanceof GLib$4.Error) msg += `${_("Reason")}${_(":")} GLib error.\n${_("Detail")}${_(":")}\nDomain: ${error.domain}\nCode: ${error.code}\nMessage: ${error.message}`;
		else if (error instanceof Error) msg += `${_("Reason")}${_(":")} ${_("Other error")}\n${_("Detail")}${_(":")}\nName: ${error.name}\nMessage: ${error.message}\nStack?:\n${error?.stack}`;
		else msg += `${_("Unknown error type")}${_(":")} ${error}`;
		logger.warn(msg);
	}
}
//#endregion
//#region src/app/handlers/Commands_handler.ts
var Commands_handler = class {
	_settings;
	constructor(applet, settings) {
		this._settings = settings;
		applet.on_button_launch_commands_light = () => this.launch_light_commands();
		applet.on_button_launch_commands_dark = () => this.launch_dark_commands();
	}
	launch_dark_commands() {
		this._launch_commands(this._settings.dark_commands_list);
	}
	launch_light_commands() {
		this._launch_commands(this._settings.light_commands_list);
	}
	_launch_commands(commands_list) {
		for (const command of commands_list) {
			if (!command.active) continue;
			launch_command(command.name, command.expiry, command.command);
		}
	}
};
//#endregion
//#region src/lib/sys/gnome/Event_scheduler/Timer_absolute.js
/** @typedef {import('../../../core/Time_of_day').Time_of_day} Time_of_day */
/** A basic request-based absolute timer to be set for a next occurring time of day. */
var Timer_absolute = class {
	/** @private Unix time in seconds (s) */
	_expiration_time = 0;
	/**
	* The next time of day the timer has to expire.
	* @param {Time_of_day} value
	*/
	set expiration_time(value) {
		const due_delay = get_now_as_time_of_day().get_seconds_until_next_target(value);
		this._expiration_time = get_now_as_unix() + due_delay;
	}
	/** @returns {boolean} */
	get_if_has_expired() {
		return get_now_as_unix() > this._expiration_time;
	}
	/**
	* Ensures `get_if_has_expired` returns `true`
	* @returns {void}
	*/
	reset() {
		this._expiration_time = 0;
	}
};
//#endregion
//#region src/lib/sys/gnome/Event_scheduler/Event_scheduler.js
/** @typedef {import('../../../../types').Disposable} Disposable */
/** @typedef {import('../../../core/Time_of_day').Time_of_day} Time_of_day */
var { GLib: GLib$3 } = imports.gi;
/**
* A single-event scheduler which call a function at a specific next time of day.
*
* Under the hood it uses a monotonic timeout delay and so doesn't take into account system sleep or time changes. So to the user can check if the event should already have occurred with `get_if_should_be_expired`.
*
* When the instance is not wanted anymore, `dispose` must be called.
*
* @implements {Disposable}
*/
var Event_scheduler = class {
	/** @private @type {number | null} */
	_event_id = null;
	/** @private @readonly */
	_timer_absolute = new Timer_absolute();
	/** @returns {boolean} `true` if the scheduled event should have already occurred, `false` otherwise. If the event is not set, `false` is returned. */
	get_if_should_be_expired() {
		return this._timer_absolute.get_if_has_expired();
	}
	/**
	* Calls a function at a specific next time of day.
	*
	* Note: if the event is already scheduled, it will be replaced.
	*
	* @param {Time_of_day} time - When the event should occur.
	* @param {() => void} callback_on_event - The function to be executed when the event occurs.
	* @returns {void}
	*/
	set_the_event(time, callback_on_event) {
		this.unset_the_event();
		const due_delay = get_now_as_time_of_day().get_seconds_until_next_target(time);
		this._event_id = GLib$3.timeout_add_seconds(GLib$3.PRIORITY_DEFAULT, due_delay, () => {
			callback_on_event();
			return GLib$3.SOURCE_REMOVE;
		});
		this._timer_absolute.expiration_time = time;
	}
	/** @returns {boolean} `true` if an event is currently scheduled, `false` otherwise. */
	get is_set() {
		return this._event_id !== null;
	}
	/**
	* Note: if the event is not already scheduled, nothing is done.
	* @returns {void}
	*/
	unset_the_event() {
		if (this._event_id === null) return;
		GLib$3.source_remove(this._event_id);
		this._event_id = null;
		this._timer_absolute.reset();
	}
	dispose() {
		this.unset_the_event();
	}
};
//#endregion
//#region src/lib/sys/cinnamon/Keybinding_handler.ts
var { keybindingManager } = imports.ui.main;
/** A responsible handler to set a Cinnamon keybinding. */
var Keybinding_handler = class Keybinding_handler {
	_uuid;
	static _unicity_count = 0;
	/** @param unique_namespace - A specific enough id to avoid name collisions with any other system keybinding name, typically the application name. */
	constructor(unique_namespace) {
		this._uuid = unique_namespace + Keybinding_handler._unicity_count++;
	}
	/** The function to be called when the keybinding has been pressed */
	callback = null;
	/** @param keybinding - In the format accepted by Cinnamon (e.g. '<Super>F1'), which can be multiple ones separated with `::`. */
	set(keybinding) {
		return keybindingManager.addHotKey(this._uuid, keybinding, () => {
			this.callback?.();
		});
	}
	unset() {
		keybindingManager.removeHotKey(this._uuid);
	}
	dispose() {
		this.unset();
	}
};
//#endregion
//#region src/lib/sys/gnome/Timezone_change_listener.js
var { Gio: Gio$4 } = imports.gi;
/** @typedef {import('../../../types').Observer} Observer */
/**
* A listener for the system timezone changes.
* @implements {Observer}
*/
var Timezone_change_listener = class {
	/** @private @type {number | null} */
	_signal_id = null;
	/** The function to call when the system timezone changes.
	* @type {((new_timezone: string) => void) | null} */
	callback = null;
	enable() {
		if (this._signal_id !== null) return;
		this._signal_id = Gio$4.DBus.system.signal_subscribe("org.freedesktop.timedate1", "org.freedesktop.DBus.Properties", "PropertiesChanged", "/org/freedesktop/timedate1", null, Gio$4.DBusSignalFlags.NONE, (_1, _2, _3, _4, _5, parameters) => {
			const changed_properties = parameters.deep_unpack()[1];
			if (changed_properties["Timezone"]) {
				const new_timezone = changed_properties["Timezone"].deep_unpack();
				this.callback?.(new_timezone);
			}
		});
	}
	disable() {
		if (this._signal_id === null) return;
		Gio$4.DBus.system.signal_unsubscribe(this._signal_id);
		this._signal_id = null;
	}
	dispose() {
		this.disable();
	}
};
//#endregion
//#region src/lib/core/Timezone_location_finder/Timezone_location_finder.ts
var { Gio: Gio$3 } = imports.gi;
/** A finder of timezone's city coordinates using a local database. */
var Timezone_location_finder = class {
	_database;
	/**
	* @param path - The absolute path where the `database.json` file is located.
	* @throws {Error} - If the file cannot be loaded or JSON-parsed
	*/
	constructor(path) {
		const file_path = `${path}/database.json`;
		const [ok, file_content] = Gio$3.File.new_for_path(file_path).load_contents(null);
		if (!ok) throw new Error(`failed to load file/contents of '${file_path}'`);
		this._database = JSON.parse(new TextDecoder().decode(file_content));
	}
	/**
	* Gets the latitude and longitude of the timezone's city.
	* @param timezone - The timezone to get the coordinates from.
	* @returns The system timezone's city coordinates.
	*/
	find(timezone) {
		if (!timezone) throw new Error("timezone is required");
		if (!(timezone in this._database)) throw new Error(`unknown timezone: '${timezone}'`);
		return {
			latitude: this._database[timezone][0],
			longitude: this._database[timezone][1]
		};
	}
};
//#endregion
//#region src/app/handlers/Location_handler.ts
var { GLib: GLib$2 } = imports.gi;
var Location_handler = class {
	_timezone_change_listener = new Timezone_change_listener((new_timezone) => this._timezone = new_timezone);
	_timezone = GLib$2.TimeZone.new_local().get_identifier();
	get timezone() {
		return this._timezone;
	}
	_timezone_location_finder = new Timezone_location_finder(`${metadata.path}/Timezone_location_finder`);
	get auto_location() {
		return this._timezone_location_finder.find(this.timezone);
	}
	manual_location;
	is_location_auto;
	get location() {
		return this.is_location_auto ? this.auto_location : this.manual_location;
	}
	constructor(initial_values) {
		Object.assign(this, initial_values);
		makeAutoObservable(this, {
			_timezone_change_listener: false,
			_timezone_location_finder: false,
			manual_location: observable.deep
		});
		this._timezone_change_listener.enable();
	}
	dispose() {
		this._timezone_change_listener.dispose();
	}
};
//#endregion
//#region src/lib/core/utils.ts
/** @param duration - The duration to sleep for, in milliseconds (ms) */
async function sleep(duration) {
	return new Promise((resolve) => setTimeout(resolve, duration));
}
//#endregion
//#region src/lib/sys/cinnamon/Sleep_and_lock_handler/Screen_lock_change_listener.js
var { ScreenSaverProxy } = imports.misc.screenSaver;
/** @typedef {import('../../../../types').Observer} Observer */
/**
* An interface to read and listen to the screen locked state.
*
* @implements {Observer}
*/
var Screen_lock_change_listener = class {
	/** @private @type {number | null} */
	_signal_id = null;
	/** @private @readonly @type {imports.gi.Gio.DBusProxy} */
	_screen_saver_proxy = ScreenSaverProxy();
	/** @returns {boolean} */
	get is_locked() {
		return this._screen_saver_proxy.screenSaverActive;
	}
	/** @type {((is_locked: boolean) => void) | null} */
	callback = null;
	enable() {
		if (this._signal_id !== null) return;
		this._signal_id = this._screen_saver_proxy.connectSignal(
			"ActiveChanged",
			/**
			* @param {any} _0
			* @param {any} _1
			* @param {[boolean]} params
			*/
			(_0, _1, [screenSaverActive]) => {
				this.callback?.(screenSaverActive);
			}
		);
	}
	disable() {
		if (this._signal_id === null) return;
		this._screen_saver_proxy.disconnectSignal(this._signal_id);
		this._signal_id = null;
	}
	dispose() {
		this.disable();
	}
};
//#endregion
//#region src/lib/sys/cinnamon/Sleep_and_lock_handler/Screen_unlock_waiter.js
/** @typedef {import('../../../../types').Disposable} Disposable */
/**
* A handler to wait until the screen is unlocked.
* @implements {Disposable}
*/
var Screen_unlock_waiter = class {
	/** @private @readonly */
	_screen_lock = new Screen_lock_change_listener();
	/** @private @type {(() => void) | null} */
	_unblock_wait_if_locked = null;
	/** Waits until the screen is unlocked or returns immediately if it is already unlocked.
	* @returns {Promise<void>} */
	wait_if_locked() {
		return new Promise((resolve) => {
			if (!this._screen_lock.is_locked) {
				resolve();
				return;
			}
			this._unblock_wait_if_locked = resolve;
			this._screen_lock.callback = (is_locked) => {
				if (is_locked) return;
				this._screen_lock.disable();
				this._screen_lock.callback = null;
				this._unblock_wait_if_locked = null;
				resolve();
			};
			this._screen_lock.enable();
		});
	}
	/** Note: it doesn't do anything if not currently waiting.
	* @returns {void} */
	unblock_wait_if_locked() {
		if (!this._unblock_wait_if_locked) return;
		this._unblock_wait_if_locked();
		this._unblock_wait_if_locked = null;
	}
	dispose() {
		this.unblock_wait_if_locked();
		this._screen_lock.dispose();
	}
};
//#endregion
//#region src/lib/sys/cinnamon/Sleep_and_lock_handler/Sleep_events_listener.js
var { Gio: Gio$2 } = imports.gi;
/** @typedef {import('../../../../types').Observer} Observer */
/**
* An interface to listen to the sleep entering and waking events.
* @implements {Observer}
*/
var Sleep_events_listener = class {
	/** @private @type {number | null} */
	_signal_id = null;
	/** The function to call when the system is entering sleep or has just wake up (`is_entering_sleep` at `false`).
	* @type {((is_entering_sleep: boolean) => void) | null} */
	callback = null;
	enable() {
		if (this._signal_id !== null) return;
		this._signal_id = Gio$2.DBus.system.signal_subscribe("org.freedesktop.login1", "org.freedesktop.login1.Manager", "PrepareForSleep", "/org/freedesktop/login1", null, Gio$2.DBusSignalFlags.NONE, (_1, _2, _3, _4, _5, parameters) => {
			const is_entering_sleep = parameters.deep_unpack()[0];
			this.callback?.(is_entering_sleep);
		});
	}
	disable() {
		if (this._signal_id === null) return;
		Gio$2.DBus.system.signal_unsubscribe(this._signal_id);
		this._signal_id = null;
	}
	dispose() {
		this.disable();
	}
};
//#endregion
//#region src/lib/sys/cinnamon/Sleep_and_lock_handler/Sleep_and_lock_handler.js
/** @typedef {import('../../../../types.js').Observer} Observer */
/**
* A handler to wait until the screen is unlocked.
* @implements {Observer}
*/
var Sleep_and_lock_handler = class {
	/** @private @readonly */
	_unlock_waiter = new Screen_unlock_waiter();
	/** @private @readonly */
	_sleep_events = new Sleep_events_listener();
	/** The function to call when the system is entering sleep or has just wake up and is unlocked (`is_entering_sleep` at `false`).
	* @type {((is_entering_sleep: boolean) => void) | null} */
	callback = null;
	constructor() {
		this._sleep_events.callback = async (is_entering_sleep) => {
			if (!is_entering_sleep) await this._unlock_waiter.wait_if_locked();
			this.callback?.(is_entering_sleep);
		};
	}
	enable() {
		this._sleep_events.enable();
	}
	disable() {
		this._unlock_waiter.unblock_wait_if_locked();
		this._sleep_events.disable();
	}
	dispose() {
		this._unlock_waiter.dispose();
		this._sleep_events.dispose();
	}
};
//#endregion
//#region src/lib/sys/cinnamon/Color_scheme_handler.ts
var { Gio: Gio$1 } = imports.gi;
var settings$1 = Gio$1.Settings.new("org.x.apps.portal");
/** A listener and accessor to the Cinnamon system color scheme setting. */
var Color_scheme_handler = class Color_scheme_handler {
	/** The function to be called when the color scheme has changed */
	callback = null;
	_signal_id = null;
	enable() {
		if (this._signal_id !== null) return;
		this._signal_id = settings$1.connect("changed::color-scheme", () => {
			this.callback?.(Color_scheme_handler.value);
		});
	}
	disable() {
		if (this._signal_id === null) return;
		settings$1.disconnect(this._signal_id);
		this._signal_id = null;
	}
	dispose() {
		this.disable();
	}
	static get value() {
		return settings$1.get_string("color-scheme");
	}
	static set value(value) {
		settings$1.set_string("color-scheme", value);
	}
};
//#endregion
//#region src/lib/sys/cinnamon/Themes_accessor.ts
var { Gio } = imports.gi;
var settings = {
	desktop: Gio.Settings.new("org.cinnamon.desktop.interface"),
	cinnamon: Gio.Settings.new("org.cinnamon.theme")
};
/** An accessor to the Cinnamon system themes settings. */
var Themes_accessor = class {
	static get mouse() {
		return settings.desktop.get_string("cursor-theme");
	}
	static set mouse(value) {
		settings.desktop.set_string("cursor-theme", value);
	}
	static get apps() {
		return settings.desktop.get_string("gtk-theme");
	}
	static set apps(value) {
		settings.desktop.set_string("gtk-theme", value);
	}
	static get icons() {
		return settings.desktop.get_string("icon-theme");
	}
	static set icons(value) {
		settings.desktop.set_string("icon-theme", value);
	}
	static get desktop() {
		return settings.cinnamon.get_string("name");
	}
	static set desktop(value) {
		settings.cinnamon.set_string("name", value);
	}
};
//#endregion
//#region src/app/handlers/Themes_handler.ts
var Themes_handler = class {
	_settings;
	constructor(applet, settings) {
		this._settings = settings;
		applet.on_button_detect_themes_light = () => this.detect_light_themes();
		applet.on_button_detect_themes_dark = () => this.detect_dark_themes();
		applet.on_button_apply_themes_light = () => this.apply_light_themes();
		applet.on_button_apply_themes_dark = () => this.apply_dark_themes();
	}
	detect_light_themes() {
		this._settings.setValue("light_themes_mouse", Themes_accessor.mouse);
		this._settings.setValue("light_themes_apps", Themes_accessor.apps);
		this._settings.setValue("light_themes_icons", Themes_accessor.icons);
		this._settings.setValue("light_themes_desktop", Themes_accessor.desktop);
		this._settings.light_themes_have_been_detected = true;
	}
	detect_dark_themes() {
		this._settings.setValue("dark_themes_mouse", Themes_accessor.mouse);
		this._settings.setValue("dark_themes_apps", Themes_accessor.apps);
		this._settings.setValue("dark_themes_icons", Themes_accessor.icons);
		this._settings.setValue("dark_themes_desktop", Themes_accessor.desktop);
		this._settings.dark_themes_have_been_detected = true;
	}
	apply_light_themes() {
		Themes_accessor.mouse = this._settings.getValue("light_themes_mouse");
		Themes_accessor.apps = this._settings.getValue("light_themes_apps");
		Themes_accessor.icons = this._settings.getValue("light_themes_icons");
		Themes_accessor.desktop = this._settings.getValue("light_themes_desktop");
		Color_scheme_handler.value = "prefer-light";
	}
	apply_dark_themes() {
		Themes_accessor.mouse = this._settings.getValue("dark_themes_mouse");
		Themes_accessor.apps = this._settings.getValue("dark_themes_apps");
		Themes_accessor.icons = this._settings.getValue("dark_themes_icons");
		Themes_accessor.desktop = this._settings.getValue("dark_themes_desktop");
		Color_scheme_handler.value = "prefer-dark";
	}
};
//#endregion
//#region src/lib/core/compute_twilights/uSunCalc.ts
/**
* A minified and optimized version of the SunCalc library containing only the part needed for the `auto-dark-light` applet.
*/
var { PI, sin, cos, asin, acos, round } = Math;
var TWO_PI = 2 * PI;
var RADIANS_PER_DEGREE = PI / 180;
var SECONDS_PER_DAY = 3600 * 24;
var J0 = 9e-4;
var J1970 = 2440587.5;
var J2000 = 2451545;
/** @returns (seconds) */
function _to_unix(julian_date) {
	return (julian_date - J1970) * SECONDS_PER_DAY;
}
function _approximate_transit(Ht, lw, n) {
	return J0 + (Ht + lw) / TWO_PI + n;
}
function _solar_transit(ds, M, L) {
	return J2000 + ds + .0053 * sin(M) - .0069 * sin(2 * L);
}
var SIN_OF_EARTH_OBLIQUITY = sin(RADIANS_PER_DEGREE * 23.4397);
var EARTH_PERIHELION_PLUS_PI = RADIANS_PER_DEGREE * 102.9372 + PI;
var J1970_MINUS_J2000 = J1970 - J2000;
/**
* Calculates the sunrise and sunset times for a given date and location.
* @param unix_time - seconds (s)
* @param latitude - degrees (°)
* @param longitude - degrees (°)
* @returns Unix time, seconds (s)
*/
function compute_twilights$1(unix_time, latitude, longitude) {
	const lw = RADIANS_PER_DEGREE * -longitude;
	const phi = RADIANS_PER_DEGREE * latitude;
	const n = round(unix_time / SECONDS_PER_DAY + J1970_MINUS_J2000 - J0 - lw / TWO_PI);
	const ds = _approximate_transit(0, lw, n);
	const M = RADIANS_PER_DEGREE * (.98560028 * ds + 357.5291);
	const L = M + RADIANS_PER_DEGREE * (1.9148 * sin(M) + .02 * sin(2 * M) + 3e-4 * sin(3 * M)) + EARTH_PERIHELION_PLUS_PI;
	const dec = asin(SIN_OF_EARTH_OBLIQUITY * sin(L));
	const julian_noon = _solar_transit(ds, M, L);
	const julian_sunset = _solar_transit(_approximate_transit(acos((sin(-.833 * RADIANS_PER_DEGREE) - sin(phi) * sin(dec)) / (cos(phi) * cos(dec))), lw, n), M, L);
	return [_to_unix(2 * julian_noon - julian_sunset), _to_unix(julian_sunset)];
}
//#endregion
//#region src/lib/core/compute_twilights/compute_twilights.ts
function compute_twilights(date, location) {
	const [sunrise, sunset] = compute_twilights$1(date.to_unix(), location.latitude, location.longitude);
	return {
		sunrise: new_local_time_of_day_from_unix(sunrise),
		sunset: new_local_time_of_day_from_unix(sunset)
	};
}
//#endregion
//#region src/app/handlers/Twilights_handler.ts
var { DateTime } = imports.gi.GLib;
var Twilights_handler = class {
	_date = DateTime.new_now_local();
	update() {
		this._date = DateTime.new_now_local();
	}
	location;
	get _location_twilights() {
		return compute_twilights(this._date, this.location);
	}
	auto_sunrise_offset;
	auto_sunset_offset;
	get auto_sunrise() {
		return this._location_twilights.sunrise.add_minutes(this.auto_sunrise_offset);
	}
	get auto_sunset() {
		return this._location_twilights.sunset.add_minutes(this.auto_sunset_offset);
	}
	manual_sunrise;
	manual_sunset;
	is_sunrise_auto;
	is_sunset_auto;
	get _sunrise() {
		return this.is_sunrise_auto ? this.auto_sunrise : this.manual_sunrise;
	}
	get _sunset() {
		return this.is_sunset_auto ? this.auto_sunset : this.manual_sunset;
	}
	get twilights() {
		return {
			sunrise: this._sunrise,
			sunset: this._sunset
		};
	}
	constructor(initial_values) {
		Object.assign(this, initial_values);
		makeAutoObservable(this);
	}
};
//#endregion
//#region src/lib/sys/gnome/Wall_clock_adjustment_monitor.js
var { GLib: GLib$1 } = imports.gi;
/** @typedef {import('../../../types').Observer} Observer */
/** @implements {Observer} */
var Wall_clock_adjustment_monitor = class {
	/** In seconds (s)
	* @private */
	_monitoring_interval = 10;
	/** Check interval, in integer seconds (s) greater or equal to 1, defaults to 10
	* @returns {number} */
	get monitoring_interval() {
		return this._monitoring_interval;
	}
	set monitoring_interval(value) {
		value = Math.max(1, value);
		value = Math.round(value);
		this._monitoring_interval = value;
		if (this._timeout_id) {
			this.disable();
			this.enable();
		}
	}
	/** Function to call when the wall clock has been modified, defaults to null
	* @type {(() => void) | null} */
	callback = null;
	/** @private @type {ReturnType<typeof GLib.timeout_add_seconds> | null} */
	_timeout_id = null;
	/** In microseconds (µs)
	* @private */
	_last_wall_clock_time = Number();
	/** In microseconds (µs)
	* @private */
	_last_monotonic_time = Number();
	enable() {
		if (this._timeout_id) return;
		this._last_wall_clock_time = GLib$1.get_real_time();
		this._last_monotonic_time = GLib$1.get_monotonic_time();
		this._timeout_id = GLib$1.timeout_add_seconds(GLib$1.PRIORITY_DEFAULT, this._monitoring_interval, this._timeout_function);
	}
	/** In microseconds (µs)
	* @private */
	_time_difference_tolerance = 2e6;
	/** Maximum for time difference between wall clock and monotonic times to not trigger the callback, in seconds (s) greater or equal to 1, defaults to 2
	* @returns {number} */
	get time_difference_tolerance() {
		return this._time_difference_tolerance / 1e6;
	}
	set time_difference_tolerance(value) {
		value *= 1e6;
		value = Math.max(1, value);
		this._time_difference_tolerance = value;
	}
	/** @private @type {Parameters<typeof GLib.timeout_add_seconds>[2]} */
	_timeout_function = () => {
		const wall_clock_time = GLib$1.get_real_time(), monotonic_time = GLib$1.get_monotonic_time();
		const delta_wall_clock = wall_clock_time - this._last_wall_clock_time;
		const delta_monotonic = monotonic_time - this._last_monotonic_time;
		if (Math.abs(delta_wall_clock - delta_monotonic) > this._time_difference_tolerance) this.callback?.();
		this._last_wall_clock_time = wall_clock_time;
		this._last_monotonic_time = monotonic_time;
		return GLib$1.SOURCE_CONTINUE;
	};
	disable() {
		if (!this._timeout_id) return;
		GLib$1.source_remove(this._timeout_id);
		this._timeout_id = null;
	}
	dispose() {
		this.disable();
	}
};
//#endregion
//#region src/app/handlers/initialize_handlers.ts
var { GLib } = imports.gi;
var DURATION_TO_AWAIT_BEFORE_UPDATING_DERIVED_SETTING = 2e3;
function initialize_handlers(applet, settings) {
	const disposables = [];
	applet.on_applet_removed_from_panel = () => {
		disposables.forEach((element) => element.dispose());
		settings.finalize();
	};
	const location_handler = new Location_handler({
		manual_location: {
			latitude: settings.manual_latitude,
			longitude: settings.manual_longitude
		},
		is_location_auto: settings.is_location_auto
	});
	disposables.push(location_handler);
	settings.bind("manual_latitude", null, (value) => {
		location_handler.manual_location.latitude = value;
	});
	settings.bind("manual_longitude", null, (value) => {
		location_handler.manual_location.longitude = value;
	});
	settings.bind("is_location_auto", null, (value) => {
		location_handler.is_location_auto = value;
	});
	autorun(() => {
		settings.setValue("system_timezone", location_handler.timezone);
	});
	autorun(() => {
		settings.setValue("auto_latitude", location_handler.auto_location.latitude);
		settings.setValue("auto_longitude", location_handler.auto_location.longitude);
	});
	const twilights_handler = new Twilights_handler({
		location: location_handler.location,
		auto_sunrise_offset: settings.auto_sunrise_offset,
		auto_sunset_offset: settings.auto_sunset_offset,
		manual_sunrise: new Time_of_day(settings.manual_sunrise),
		manual_sunset: new Time_of_day(settings.manual_sunset),
		is_sunrise_auto: settings.is_sunrise_auto,
		is_sunset_auto: settings.is_sunset_auto
	});
	autorun(() => {
		twilights_handler.location = location_handler.location;
	});
	settings.bind("auto_sunrise_offset", null, (value) => {
		twilights_handler.auto_sunrise_offset = value;
	});
	settings.bind("auto_sunset_offset", null, (value) => {
		twilights_handler.auto_sunset_offset = value;
	});
	settings.bind("manual_sunrise", null, (value) => {
		twilights_handler.manual_sunrise = new Time_of_day(value);
	});
	settings.bind("manual_sunset", null, (value) => {
		twilights_handler.manual_sunset = new Time_of_day(value);
	});
	settings.bind("is_sunrise_auto", null, (value) => {
		twilights_handler.is_sunrise_auto = value;
	});
	settings.bind("is_sunset_auto", null, (value) => {
		twilights_handler.is_sunset_auto = value;
	});
	reaction(() => twilights_handler.auto_sunrise, async () => {
		await sleep(DURATION_TO_AWAIT_BEFORE_UPDATING_DERIVED_SETTING);
		settings.setValue("auto_sunrise", twilights_handler.auto_sunrise.get_as_string_hhmm());
	}, { fireImmediately: true });
	reaction(() => twilights_handler.auto_sunset, async () => {
		await sleep(DURATION_TO_AWAIT_BEFORE_UPDATING_DERIVED_SETTING);
		settings.setValue("auto_sunset", twilights_handler.auto_sunset.get_as_string_hhmm());
	}, { fireImmediately: true });
	const appearance_handler = new Appearance_handler({
		twilights: twilights_handler.twilights,
		manual_is_dark: Color_scheme_handler.value === "prefer-dark",
		is_auto: settings.is_appearance_auto
	});
	autorun(() => {
		appearance_handler.twilights = twilights_handler.twilights;
	});
	applet.on_applet_clicked = () => {
		appearance_handler.toggle_is_dark();
	};
	applet.on_applet_middle_clicked = () => {
		appearance_handler.toggle_is_auto();
	};
	settings.bind("is_appearance_dark", null, (value) => {
		appearance_handler.manual_is_dark = value;
	});
	settings.bind("is_appearance_auto", null, (value) => {
		appearance_handler.is_auto = value;
	});
	reaction(() => appearance_handler.manual_is_dark, async () => {
		await sleep(DURATION_TO_AWAIT_BEFORE_UPDATING_DERIVED_SETTING);
		settings.is_appearance_dark = appearance_handler.manual_is_dark;
	}, { fireImmediately: true });
	reaction(() => appearance_handler.is_auto, () => {
		settings.is_appearance_auto = appearance_handler.is_auto;
	});
	reaction(() => appearance_handler.is_unsynced, async () => {
		await sleep(DURATION_TO_AWAIT_BEFORE_UPDATING_DERIVED_SETTING);
		settings.setValue("is_appearance_unsynced", appearance_handler.is_unsynced);
	}, { fireImmediately: true });
	reaction(() => appearance_handler.next_twilight, async () => {
		await sleep(DURATION_TO_AWAIT_BEFORE_UPDATING_DERIVED_SETTING);
		settings.setValue("next_update", appearance_handler.next_twilight.get_as_string_hhmm());
	}, { fireImmediately: true });
	autorun(() => {
		applet.set_applet_icon_symbolic_name(appearance_handler.is_auto ? appearance_handler.is_unsynced ? "auto-inverted-symbolic" : "auto-symbolic" : appearance_handler.manual_is_dark ? "dark-symbolic" : "light-symbolic");
	});
	const keybinding = new Keybinding_handler(metadata.uuid);
	disposables.push(keybinding);
	keybinding.callback = () => {
		appearance_handler.toggle_is_dark();
	};
	keybinding.set(settings.appearance_keybinding);
	settings.bind("appearance_keybinding", null, (value) => {
		keybinding.set(value);
	});
	const themes_handler = new Themes_handler(applet, settings);
	if (Color_scheme_handler.value === "prefer-dark") {
		if (settings.dark_themes_have_been_detected) themes_handler.detect_dark_themes();
	} else if (settings.light_themes_have_been_detected) themes_handler.detect_light_themes();
	const color_scheme = makeAutoObservable({ value: Color_scheme_handler.value });
	const color_scheme_handler = new Color_scheme_handler();
	disposables.push(color_scheme_handler);
	color_scheme_handler.callback = (new_color_scheme) => {
		color_scheme.value = new_color_scheme;
	};
	let is_update_from_system = false;
	autorun(() => {
		appearance_handler.manual_is_dark = color_scheme.value === "prefer-dark";
		is_update_from_system = true;
	});
	const background_handler = new Background_handler(applet, settings);
	const commands_handler = new Commands_handler(applet, settings);
	reaction(() => appearance_handler.manual_is_dark, () => {
		if (is_update_from_system === true) {
			is_update_from_system = false;
			return;
		}
		if (appearance_handler.manual_is_dark) {
			color_scheme_handler.disable();
			themes_handler.apply_dark_themes();
			color_scheme_handler.enable();
			if (settings.enable_background) background_handler.apply_dark_background();
			if (settings.dark_commands_is_enabled) commands_handler.launch_dark_commands();
		} else {
			color_scheme_handler.disable();
			themes_handler.apply_light_themes();
			color_scheme_handler.enable();
			if (settings.enable_background) background_handler.apply_light_background();
			if (settings.light_commands_is_enabled) commands_handler.launch_light_commands();
		}
	}, { fireImmediately: true });
	autorun(() => {
		if (!appearance_handler.is_auto) return;
		appearance_handler.manual_is_dark = appearance_handler.is_dark;
	});
	const wall_clock_monitor = new Wall_clock_adjustment_monitor();
	disposables.push(wall_clock_monitor);
	wall_clock_monitor.callback = () => runInAction(() => {
		twilights_handler.update();
		appearance_handler.update_time();
		if (scheduler.is_set && scheduler.get_if_should_be_expired()) appearance_handler.sync_is_dark();
	});
	const sleep_and_lock_handler = new Sleep_and_lock_handler();
	disposables.push(sleep_and_lock_handler);
	sleep_and_lock_handler.callback = (is_sleeping) => {
		if (is_sleeping) wall_clock_monitor.disable();
		else runInAction(() => {
			twilights_handler.update();
			appearance_handler.update_time();
			if (scheduler.is_set && scheduler.get_if_should_be_expired()) appearance_handler.sync_is_dark();
			wall_clock_monitor.enable();
		});
	};
	const scheduler = new Event_scheduler();
	disposables.push(scheduler);
	const schedule_the_event = () => {
		scheduler.set_the_event(appearance_handler.next_twilight, () => {
			twilights_handler.update();
			appearance_handler.update_time();
			appearance_handler.sync_is_dark();
		});
	};
	reaction(() => appearance_handler.is_auto, () => {
		if (appearance_handler.is_auto) {
			appearance_handler.update_time();
			appearance_handler.sync_is_dark();
			schedule_the_event();
			wall_clock_monitor.enable();
			sleep_and_lock_handler.enable();
		} else {
			scheduler.unset_the_event();
			wall_clock_monitor.disable();
			sleep_and_lock_handler.disable();
		}
	});
	reaction(() => appearance_handler.next_twilight, () => {
		if (appearance_handler.is_auto) schedule_the_event();
	}, { fireImmediately: true });
	applet.set_applet_tooltip(`<b>${_("Click")}</b>${_(":")} ${_("toggle dark/light appearance")}\n<b>${_("Middle-click")}</b>${_(":")} ${_("toggle automatic switch")}`, true);
	applet.on_button_open_os_timezone_settings = () => GLib.spawn_command_line_async("cinnamon-settings calendar");
	applet.on_button_open_os_themes_settings = () => GLib.spawn_command_line_async("cinnamon-settings themes");
	applet.on_button_open_os_background_settings = () => GLib.spawn_command_line_async("cinnamon-settings background");
	color_scheme_handler.enable();
	wall_clock_monitor.enable();
	sleep_and_lock_handler.enable();
}
//#endregion
//#region src/app/initialize_applet_settings.ts
var { AppletSettings } = imports.ui.settings;
function initialize_applet_settings(uuid, instance_id) {
	const settings = new AppletSettings({}, uuid, instance_id);
	[
		"is_appearance_dark",
		"appearance_keybinding",
		"is_appearance_auto",
		"auto_sunrise_offset",
		"auto_sunset_offset",
		"manual_sunrise",
		"manual_sunset",
		"is_sunrise_auto",
		"is_sunset_auto",
		"manual_latitude",
		"manual_longitude",
		"is_location_auto",
		"enable_background",
		"light_background_is_slideshow",
		"light_background_file",
		"light_background_slideshow_folder",
		"dark_background_is_slideshow",
		"dark_background_file",
		"dark_background_slideshow_folder",
		"light_commands_is_enabled",
		"light_commands_list",
		"dark_commands_is_enabled",
		"dark_commands_list",
		"scheduler_timer_absolute_time",
		"light_themes_have_been_detected",
		"dark_themes_have_been_detected"
	].forEach((key) => settings.bindWithObject(settings, key, key));
	return settings;
}
//#endregion
//#region src/main.ts
var { IconApplet } = imports.ui.applet;
function main(metadata, orientation, panel_height, instance_id) {
	initialize_globals(metadata);
	const applet = new IconApplet(orientation, panel_height, instance_id);
	const settings = initialize_applet_settings(metadata.uuid, instance_id);
	try {
		initialize_handlers(applet, settings);
	} catch (error) {
		applet.set_applet_icon_symbolic_name("on-error-symbolic");
		if (error instanceof Error) logger.error(error.message);
		else logger.error(String(error));
		settings.finalize();
	}
	return applet;
}
//#endregion
