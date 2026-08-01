//#region node_modules/.pnpm/mobx@7.0.0/node_modules/mobx/dist/mobx.mjs
function die(error, ...args) {
	throw new Error(`[MobX] minified error nr: ${error}${args.length ? " " + args.map(String).join(",") : ""}. See mobx.js.org/errors`);
}
var assign = Object.assign;
var getDescriptor = Object.getOwnPropertyDescriptor;
var defineProperty = Object.defineProperty;
var objectPrototype = Object.prototype;
var EMPTY_ARRAY = [];
Object.freeze(EMPTY_ARRAY);
var EMPTY_OBJECT = {};
Object.freeze(EMPTY_OBJECT);
var plainObjectString = /*#__PURE__*/ Object.toString();
var noop = () => {};
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
	const proto = Object.getPrototypeOf(value);
	if (proto == null) return true;
	const protoConstructor = hasProp(proto, "constructor") && proto.constructor;
	return typeof protoConstructor === "function" && protoConstructor.toString() === plainObjectString;
}
function isGenerator(obj) {
	const constructor = obj == null ? void 0 : obj.constructor;
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
	const propName = "isMobX" + name;
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
	const mapProto = Object.getPrototypeOf(thing);
	const objectProto = Object.getPrototypeOf(mapProto);
	return Object.getPrototypeOf(objectProto) === null;
}
/**
* Yields true for both native and observable Set, even across different windows.
*/
function isES6Set(thing) {
	return thing != null && Object.prototype.toString.call(thing) === "[object Set]";
}
/**
* Returns the following: own enumerable keys and symbols.
*/
function getPlainObjectKeys(object) {
	const keys = Object.keys(object);
	const symbols = Object.getOwnPropertySymbols(object);
	if (!symbols.length) return keys;
	return [...keys, ...symbols.filter((s) => objectPrototype.propertyIsEnumerable.call(object, s))];
}
var ownKeys = Reflect.ownKeys;
function toPrimitive(value) {
	return value === null ? null : typeof value === "object" ? "" + value : value;
}
function hasProp(target, prop) {
	return objectPrototype.hasOwnProperty.call(target, prop);
}
var getOwnPropertyDescriptors = Object.getOwnPropertyDescriptors;
function getFlag(flags, mask) {
	return !!(flags & mask);
}
function setFlag(flags, mask, newValue) {
	if (newValue) flags |= mask;
	else flags &= ~mask;
	return flags;
}
var $mobx = /*#__PURE__*/ Symbol("mobx administration");
var Atom = class {
	/**
	* Create a new atom. For debugging purposes it is recommended to give it a name.
	* The onBecomeObserved and onBecomeUnobserved callbacks can be used for resource management.
	*/
	constructor(name_ = "Atom") {
		this.name_ = void 0;
		this.flags_ = 0;
		this.observers_ = /* @__PURE__ */ new Set();
		this.lastAccessedBy_ = 0;
		this.lowestObserverState_ = -1;
		this.onBOL = void 0;
		this.onBUOL = void 0;
		this.name_ = name_;
	}
	get isBeingObserved() {
		return getFlag(this.flags_, 1);
	}
	set isBeingObserved(newValue) {
		this.flags_ = setFlag(this.flags_, 1, newValue);
	}
	get isPendingUnobservation() {
		return getFlag(this.flags_, 2);
	}
	set isPendingUnobservation(newValue) {
		this.flags_ = setFlag(this.flags_, 2, newValue);
	}
	get diffValue() {
		return getFlag(this.flags_, 4) ? 1 : 0;
	}
	set diffValue(newValue) {
		this.flags_ = setFlag(this.flags_, 4, newValue === 1 ? true : false);
	}
	onBO() {
		if (this.onBOL) this.onBOL.forEach((listener) => listener());
	}
	onBUO() {
		if (this.onBUOL) this.onBUOL.forEach((listener) => listener());
	}
	/**
	* Invoke this method to notify mobx that your atom has been used somehow.
	* Returns true if there is currently a reactive context.
	*/
	reportObserved() {
		return reportObserved(this);
	}
	/**
	* Invoke this method _after_ this method has changed to signal mobx that all its observers should invalidate.
	*/
	reportChanged() {
		startBatch();
		propagateChanged(this);
		endBatch();
	}
	toString() {
		return this.name_;
	}
};
var isAtom = /*#__PURE__*/ createInstanceofPredicate("Atom", Atom);
function createAtom(name, onBecomeObservedHandler = noop, onBecomeUnobservedHandler = noop) {
	const atom = new Atom(name);
	if (onBecomeObservedHandler !== noop) atom.onBOL = /* @__PURE__ */ new Set([onBecomeObservedHandler]);
	if (onBecomeUnobservedHandler !== noop) atom.onBUOL = /* @__PURE__ */ new Set([onBecomeUnobservedHandler]);
	return atom;
}
var compareDefault = Object.is;
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
function referenceEnhancer(newValue) {
	return newValue;
}
function createActionAnnotation(name, options) {
	return {
		annotationType_: name,
		options_: options,
		make_: make_$5,
		extend_: extend_$4
	};
}
function make_$5(adm, key, descriptor, source) {
	var _this$options_;
	if ((_this$options_ = this.options_) != null && _this$options_.bound) return this.extend_(adm, key, descriptor, false) === null ? 0 : 1;
	if (source === adm.target_) return this.extend_(adm, key, descriptor, false) === null ? 0 : 2;
	if (isAction(descriptor.value)) return 1;
	defineProperty(source, key, createActionDescriptor(adm, this, key, descriptor, false));
	return 2;
}
function extend_$4(adm, key, descriptor, proxyTrap) {
	const actionDescriptor = createActionDescriptor(adm, this, key, descriptor);
	return adm.defineProperty_(key, actionDescriptor, proxyTrap);
}
function decorateAction20223_(annotation, mthd, context) {
	const { kind, name, addInitializer } = context;
	const ann = annotation;
	const _createAction = (m) => {
		var _ann$options_$name, _ann$options_, _ann$options_$autoAct, _ann$options_2;
		return createAction((_ann$options_$name = (_ann$options_ = ann.options_) == null ? void 0 : _ann$options_.name) != null ? _ann$options_$name : name.toString(), m, (_ann$options_$autoAct = (_ann$options_2 = ann.options_) == null ? void 0 : _ann$options_2.autoAction) != null ? _ann$options_$autoAct : false);
	};
	if (kind == "field") return function(initMthd) {
		var _ann$options_3;
		let mthd = initMthd;
		if (!isAction(mthd)) mthd = _createAction(mthd);
		if ((_ann$options_3 = ann.options_) != null && _ann$options_3.bound) {
			mthd = mthd.bind(this);
			mthd.isMobxAction = true;
		}
		return mthd;
	};
	if (kind == "method") {
		var _ann$options_4;
		if (!isAction(mthd)) mthd = _createAction(mthd);
		if ((_ann$options_4 = ann.options_) != null && _ann$options_4.bound) addInitializer(function() {
			const self = this;
			const bound = self[name].bind(self);
			bound.isMobxAction = true;
			self[name] = bound;
		});
		return mthd;
	}
	die(43, ann.annotationType_, String(name), kind);
}
function assertActionDescriptor(adm, { annotationType_ }, key, { value }) {}
function createActionDescriptor(adm, annotation, key, descriptor, safeDescriptors = globalState.safeDescriptors) {
	var _annotation$options_, _annotation$options_$, _annotation$options_2, _annotation$options_$2, _annotation$options_3, _annotation$options_4, _adm$proxy_2;
	assertActionDescriptor(adm, annotation, key, descriptor);
	let { value } = descriptor;
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
		make_: make_$4,
		extend_: extend_$3
	};
}
function make_$4(adm, key, descriptor, source) {
	var _this$options_;
	if (source === adm.target_) return this.extend_(adm, key, descriptor, false) === null ? 0 : 2;
	if ((_this$options_ = this.options_) != null && _this$options_.bound && (!hasProp(adm.target_, key) || !isFlow(adm.target_[key]))) {
		if (this.extend_(adm, key, descriptor, false) === null) return 0;
	}
	if (isFlow(descriptor.value)) return 1;
	defineProperty(source, key, createFlowDescriptor(adm, this, key, descriptor, false, false));
	return 2;
}
function extend_$3(adm, key, descriptor, proxyTrap) {
	var _this$options_2;
	const flowDescriptor = createFlowDescriptor(adm, this, key, descriptor, (_this$options_2 = this.options_) == null ? void 0 : _this$options_2.bound);
	return adm.defineProperty_(key, flowDescriptor, proxyTrap);
}
function decorateFlow20223_(annotation, mthd, context) {
	var _annotation$options_;
	const { name, addInitializer } = context;
	if (!isFlow(mthd)) mthd = flow(mthd);
	if ((_annotation$options_ = annotation.options_) != null && _annotation$options_.bound) addInitializer(function() {
		const self = this;
		const bound = self[name].bind(self);
		bound.isMobXFlow = true;
		self[name] = bound;
	});
	return mthd;
}
function assertFlowDescriptor(adm, { annotationType_ }, key, { value }) {}
function createFlowDescriptor(adm, annotation, key, descriptor, bound, safeDescriptors = globalState.safeDescriptors) {
	assertFlowDescriptor(adm, annotation, key, descriptor);
	let { value } = descriptor;
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
		extend_: extend_$2
	};
}
function make_$3(adm, key, descriptor) {
	return this.extend_(adm, key, descriptor, false) === null ? 0 : 1;
}
function extend_$2(adm, key, descriptor, proxyTrap) {
	assertComputedDescriptor(adm, this, key, descriptor);
	return adm.defineComputedProperty_(key, assign({}, this.options_, {
		get: descriptor.get,
		set: descriptor.set
	}), proxyTrap);
}
function decorateComputed20223_(annotation, get, context) {
	const ann = annotation;
	const { name: key, addInitializer } = context;
	let computedValues;
	function createComputedValue(target, adm) {
		const options = assign({}, ann.options_, {
			get,
			context: target
		});
		options.name || (options.name = `ObservableObject.${key.toString()}`);
		return new ComputedValue(options);
	}
	addInitializer(function() {
		var _adm$lazyComputedKeys;
		const adm = asObservableObject(this)[$mobx];
		const target = this;
		const observable = adm.values_.get(key);
		if (observable instanceof ComputedValue && observable.derivation !== get) adm.values_.delete(key);
		((_adm$lazyComputedKeys = adm.lazyComputedKeys_) != null ? _adm$lazyComputedKeys : adm.lazyComputedKeys_ = /* @__PURE__ */ new Map()).set(key, () => createComputedValue(target, adm));
	});
	return function() {
		const adm = this[$mobx];
		const observable = adm.values_.get(key);
		if (observable instanceof ComputedValue && observable.derivation !== get) {
			var _computedValues;
			let computed = (_computedValues = computedValues) == null ? void 0 : _computedValues.get(this);
			if (!computed) {
				var _computedValues2;
				computed = createComputedValue(this, adm);
				((_computedValues2 = computedValues) != null ? _computedValues2 : computedValues = /* @__PURE__ */ new WeakMap()).set(this, computed);
			}
			return computed.get();
		}
		return adm.getObservablePropValue_(key);
	};
}
function assertComputedDescriptor(adm, { annotationType_ }, key, { get }) {}
function createObservableAnnotation(name, options) {
	return {
		annotationType_: name,
		options_: options,
		make_: make_$2,
		extend_: extend_$1
	};
}
function make_$2(adm, key, descriptor) {
	return this.extend_(adm, key, descriptor, false) === null ? 0 : 1;
}
function extend_$1(adm, key, descriptor, proxyTrap) {
	var _this$options_$enhanc, _this$options_;
	assertObservableDescriptor(adm, this, key, descriptor);
	return adm.defineObservableProperty_(key, descriptor.value, (_this$options_$enhanc = (_this$options_ = this.options_) == null ? void 0 : _this$options_.enhancer_) != null ? _this$options_$enhanc : deepEnhancer, proxyTrap);
}
function decorateObservable20223_(annotation, desc, context) {
	const ann = annotation;
	const { kind, name } = context;
	if (kind !== "accessor") return;
	function registerLazy(target, value) {
		var _adm$lazyObservableKe;
		const adm = asObservableObject(target)[$mobx];
		((_adm$lazyObservableKe = adm.lazyObservableKeys_) != null ? _adm$lazyObservableKe : adm.lazyObservableKeys_ = /* @__PURE__ */ new Map()).set(name, () => {
			var _ann$options_$enhance, _ann$options_;
			return new ObservableValue(value, (_ann$options_$enhance = (_ann$options_ = ann.options_) == null ? void 0 : _ann$options_.enhancer_) != null ? _ann$options_$enhance : deepEnhancer, `ObservableObject.${name.toString()}`, false);
		});
		return adm;
	}
	return {
		get() {
			var _this$$mobx;
			return ((_this$$mobx = this[$mobx]) != null ? _this$$mobx : registerLazy(this, desc.get.call(this))).getObservablePropValue_(name);
		},
		set(value) {
			var _this$$mobx2;
			return ((_this$$mobx2 = this[$mobx]) != null ? _this$$mobx2 : registerLazy(this, value)).setObservablePropValue_(name, value);
		},
		init(value) {
			registerLazy(this, value);
			return value;
		}
	};
}
function assertObservableDescriptor(adm, { annotationType_ }, key, descriptor) {}
var AUTO = "true";
var autoAnnotation = /*#__PURE__*/ createAutoAnnotation();
function createAutoAnnotation(options) {
	return {
		annotationType_: AUTO,
		options_: options,
		make_: make_$1,
		extend_
	};
}
function make_$1(adm, key, descriptor, source) {
	var _this$options_3, _this$options_4;
	if (descriptor.get) return computed.make_(adm, key, descriptor, source);
	if (descriptor.set) {
		const set = isAction(descriptor.set) ? descriptor.set : createAction(key.toString(), descriptor.set);
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
			return ((_this$options_ = this.options_) != null && _this$options_.autoBind ? flowBound : flow).make_(adm, key, descriptor, source);
		}
		return ((_this$options_2 = this.options_) != null && _this$options_2.autoBind ? autoActionBound : autoAction).make_(adm, key, descriptor, source);
	}
	let observableAnnotation = ((_this$options_3 = this.options_) == null ? void 0 : _this$options_3.deep) === false ? observableRef : observable;
	if (typeof descriptor.value === "function" && (_this$options_4 = this.options_) != null && _this$options_4.autoBind) {
		var _adm$proxy_;
		descriptor.value = descriptor.value.bind((_adm$proxy_ = adm.proxy_) != null ? _adm$proxy_ : adm.target_);
	}
	return observableAnnotation.make_(adm, key, descriptor, source);
}
function extend_(adm, key, descriptor, proxyTrap) {
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
	return (((_this$options_6 = this.options_) == null ? void 0 : _this$options_6.deep) === false ? observableRef : observable).extend_(adm, key, descriptor, proxyTrap);
}
function createDecoratorAnnotation(annotation, decorate) {
	return assign(function decoratorAnnotation(value, context) {
		if (context && typeof context.kind === "string") return decorate(annotation, value, context);
	}, annotation);
}
var OBSERVABLE = "observable";
var OBSERVABLE_REF = "observable.ref";
var defaultCreateObservableOptions = {
	deep: true,
	name: void 0,
	defaultDecorator: void 0
};
Object.freeze(defaultCreateObservableOptions);
function asCreateObservableOptions(thing) {
	return thing || defaultCreateObservableOptions;
}
var observableAnnotation = /*#__PURE__*/ createObservableAnnotation(OBSERVABLE);
var observableRefAnnotation = /*#__PURE__*/ createObservableAnnotation(OBSERVABLE_REF, { enhancer_: referenceEnhancer });
function createObservableDecoratorAnnotation(annotation) {
	return createDecoratorAnnotation(annotation, decorateObservable20223_);
}
function getEnhancerFromOptions(options) {
	return options.deep === true ? deepEnhancer : options.deep === false ? referenceEnhancer : getEnhancerFromAnnotation(options.defaultDecorator);
}
function getAnnotationFromOptions(options) {
	var _options$defaultDecor;
	return options ? (_options$defaultDecor = options.defaultDecorator) != null ? _options$defaultDecor : createAutoAnnotation(options) : void 0;
}
function getEnhancerFromAnnotation(annotation) {
	var _annotation$options_$, _annotation$options_;
	return !annotation ? deepEnhancer : (_annotation$options_$ = (_annotation$options_ = annotation.options_) == null ? void 0 : _annotation$options_.enhancer_) != null ? _annotation$options_$ : deepEnhancer;
}
/**
* Turns an object, array or function into a reactive structure.
* @param v the value which should become observable.
*/
function createObservable(v, arg2, arg3) {
	if (arg2 && typeof arg2.kind === "string") return decorateObservable20223_(observableAnnotation, v, arg2);
	if (isObservable(v)) return v;
	if (isPlainObject(v)) return observable.object(v, arg2, arg3);
	if (Array.isArray(v)) return observable.array(v, arg2);
	if (isES6Map(v)) return observable.map(v, arg2);
	if (isES6Set(v)) return observable.set(v, arg2);
	if (typeof v === "object" && v !== null) return v;
	return observable.box(v, arg2);
}
var observableFactories = {
	box(value, options) {
		const o = asCreateObservableOptions(options);
		return new ObservableValue(value, getEnhancerFromOptions(o), o.name, true, o.equals);
	},
	array(initialValues, options) {
		const o = asCreateObservableOptions(options);
		return createObservableArray(initialValues, getEnhancerFromOptions(o), o.name);
	},
	map(initialValues, options) {
		const o = asCreateObservableOptions(options);
		return new ObservableMap(initialValues, getEnhancerFromOptions(o), o.name);
	},
	set(initialValues, options) {
		const o = asCreateObservableOptions(options);
		return new ObservableSet(initialValues, getEnhancerFromOptions(o), o.name);
	},
	object(props, annotations, options) {
		return initObservable(() => extendObservable(asDynamicObservableObject({}, options), props, annotations));
	}
};
var observableRef = /*#__PURE__*/ createObservableDecoratorAnnotation(observableRefAnnotation);
var observableDeep = /*#__PURE__*/ createObservableDecoratorAnnotation(observableAnnotation);
var observable = /*#__PURE__*/ assign(createObservable, observableAnnotation, observableFactories);
var COMPUTED = "computed";
function createComputedDecoratorAnnotation(annotation) {
	return createDecoratorAnnotation(annotation, decorateComputed20223_);
}
var computedAnnotation = /*#__PURE__*/ createComputedAnnotation(COMPUTED);
var computed = function computed(arg1, arg2) {
	if (arg2 && typeof arg2.kind === "string") return decorateComputed20223_(computedAnnotation, arg1, arg2);
	if (isPlainObject(arg1)) return createComputedDecoratorAnnotation(createComputedAnnotation(COMPUTED, arg1));
	const opts = isPlainObject(arg2) ? arg2 : {};
	opts.get = arg1;
	opts.name || (opts.name = arg1.name || "");
	return new ComputedValue(opts);
};
assign(computed, computedAnnotation);
var _getDescriptor$config;
var _getDescriptor;
var currentActionId = 0;
var nextActionId = 1;
var isFunctionNameConfigurable = (_getDescriptor$config = (_getDescriptor = /*#__PURE__*/ getDescriptor(() => {}, "name")) == null ? void 0 : _getDescriptor.configurable) != null ? _getDescriptor$config : false;
var tmpNameDescriptor = {
	value: "action",
	configurable: true,
	writable: false,
	enumerable: false
};
function createAction(actionName, fn, autoAction = false, ref) {
	function res() {
		return executeAction(actionName, autoAction, fn, ref || this, arguments);
	}
	res.isMobxAction = true;
	res.toString = () => fn.toString();
	if (isFunctionNameConfigurable) {
		tmpNameDescriptor.value = actionName;
		defineProperty(res, "name", tmpNameDescriptor);
	}
	return res;
}
function executeAction(actionName, canRunAsDerivation, fn, scope, args) {
	const runInfo = _startAction(actionName, canRunAsDerivation, scope, args);
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
	const notifySpy_ = false;
	let startTime_ = 0;
	const prevDerivation_ = globalState.trackingDerivation;
	const runAsAction = !canRunAsDerivation || !prevDerivation_;
	startBatch();
	let prevAllowStateChanges_ = globalState.allowStateChanges;
	if (runAsAction) untrackedStart();
	const runInfo = {
		runAsAction_: runAsAction,
		prevDerivation_,
		prevAllowStateChanges_,
		prevAllowStateReads_: globalState.allowStateReads,
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
	endBatch();
	if (runInfo.runAsAction_) untrackedEnd(runInfo.prevDerivation_);
	globalState.suppressReactionErrors = false;
}
function allowStateChanges(allowStateChanges, func) {
	const prev = allowStateChangesStart(allowStateChanges);
	try {
		return func();
	} finally {
		allowStateChangesEnd(prev);
	}
}
function allowStateChangesStart(allowStateChanges) {
	const prev = globalState.allowStateChanges;
	globalState.allowStateChanges = allowStateChanges;
	return prev;
}
function allowStateChangesEnd(prev) {
	globalState.allowStateChanges = prev;
}
var ObservableValue = class extends Atom {
	constructor(value, enhancer_, name_ = "ObservableValue", notifySpy = true, equals_ = compareDefault) {
		super(name_);
		this.enhancer_ = void 0;
		this.name_ = void 0;
		this.equals_ = void 0;
		this.hasUnreportedChange_ = false;
		this.interceptors_ = void 0;
		this.changeListeners_ = void 0;
		this.value_ = void 0;
		this.dehancer = void 0;
		this.enhancer_ = enhancer_;
		this.name_ = name_;
		this.equals_ = equals_;
		this.value_ = enhancer_(value, void 0, name_);
	}
	dehanceValue(value) {
		if (this.dehancer !== void 0) return this.dehancer(value);
		return value;
	}
	set(newValue) {
		this.value_;
		newValue = this.prepareNewValue_(newValue);
		if (newValue !== globalState.UNCHANGED) this.setNewValue_(newValue);
	}
	prepareNewValue_(newValue) {
		if (hasInterceptors(this)) {
			const change = interceptChange(this, {
				object: this,
				type: UPDATE,
				newValue
			});
			if (!change) return globalState.UNCHANGED;
			newValue = change.newValue;
		}
		newValue = this.enhancer_(newValue, this.value_, this.name_);
		return this.equals_(this.value_, newValue) ? globalState.UNCHANGED : newValue;
	}
	setNewValue_(newValue) {
		const oldValue = this.value_;
		this.value_ = newValue;
		this.reportChanged();
		if (hasListeners(this)) notifyListeners(this, {
			type: UPDATE,
			object: this,
			newValue,
			oldValue
		});
	}
	get() {
		this.reportObserved();
		return this.dehanceValue(this.value_);
	}
	raw() {
		return this.value_;
	}
	toJSON() {
		return this.get();
	}
	toString() {
		return `${this.name_}[${this.value_}]`;
	}
	valueOf() {
		return toPrimitive(this.get());
	}
	[Symbol.toPrimitive]() {
		return this.valueOf();
	}
};
var ComputedValue = class {
	/**
	* Create a new computed value based on a function expression.
	*
	* The `name` property is for debug purposes only.
	*
	* The `equals` property specifies the comparer function used to determine if a newly produced
	* value differs from the previous value. Structural comparison can be convenient if you always
	* produce a new aggregated object and don't want to notify observers if it is structurally the same.
	* This is useful for working with vectors, mouse coordinates etc.
	*/
	constructor(options) {
		this.dependenciesState_ = -1;
		this.observing_ = [];
		this.newObserving_ = null;
		this.observers_ = /* @__PURE__ */ new Set();
		this.runId_ = 0;
		this.lastAccessedBy_ = 0;
		this.lowestObserverState_ = 0;
		this.unboundDepsCount_ = 0;
		this.value_ = new CaughtException(null);
		this.name_ = void 0;
		this.triggeredBy_ = void 0;
		this.flags_ = 0;
		this.derivation = void 0;
		this.setter_ = void 0;
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
		this.equals_ = options.equals || compareDefault;
		this.scope_ = options.context;
		this.requiresReaction_ = options.requiresReaction;
		this.keepAlive_ = !!options.keepAlive;
	}
	onBecomeStale_() {
		propagateMaybeChanged(this);
	}
	onBO() {
		if (this.onBOL) this.onBOL.forEach((listener) => listener());
	}
	onBUO() {
		if (this.onBUOL) this.onBUOL.forEach((listener) => listener());
	}
	get isComputing() {
		return getFlag(this.flags_, 1);
	}
	set isComputing(newValue) {
		this.flags_ = setFlag(this.flags_, 1, newValue);
	}
	get isRunningSetter() {
		return getFlag(this.flags_, 2);
	}
	set isRunningSetter(newValue) {
		this.flags_ = setFlag(this.flags_, 2, newValue);
	}
	get isBeingObserved() {
		return getFlag(this.flags_, 4);
	}
	set isBeingObserved(newValue) {
		this.flags_ = setFlag(this.flags_, 4, newValue);
	}
	get isPendingUnobservation() {
		return getFlag(this.flags_, 8);
	}
	set isPendingUnobservation(newValue) {
		this.flags_ = setFlag(this.flags_, 8, newValue);
	}
	get diffValue() {
		return getFlag(this.flags_, 16) ? 1 : 0;
	}
	set diffValue(newValue) {
		this.flags_ = setFlag(this.flags_, 16, newValue === 1 ? true : false);
	}
	/**
	* Returns the current value of this computed value.
	* Will evaluate its computation first if needed.
	*/
	get() {
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
				let prevTrackingContext = globalState.trackingContext;
				if (this.keepAlive_ && !prevTrackingContext) globalState.trackingContext = this;
				if (this.trackAndCompute()) propagateChangeConfirmed(this);
				globalState.trackingContext = prevTrackingContext;
			}
		}
		const result = this.value_;
		if (isCaughtException(result)) throw result.cause;
		return result;
	}
	set(value) {
		if (this.setter_) {
			if (this.isRunningSetter) die(33, this.name_);
			this.isRunningSetter = true;
			try {
				this.setter_.call(this.scope_, value);
			} finally {
				this.isRunningSetter = false;
			}
		} else die(34, this.name_);
	}
	trackAndCompute() {
		const oldValue = this.value_;
		const wasSuspended = this.dependenciesState_ === -1;
		const newValue = this.computeValue_(true);
		const changed = wasSuspended || isCaughtException(oldValue) || isCaughtException(newValue) || !this.equals_(oldValue, newValue);
		if (changed) this.value_ = newValue;
		return changed;
	}
	computeValue_(track) {
		this.isComputing = true;
		let res;
		if (track) res = trackDerivedFunction(this, this.derivation, this.scope_);
		else if (globalState.disableErrorBoundaries === true) res = this.derivation.call(this.scope_);
		else try {
			res = this.derivation.call(this.scope_);
		} catch (e) {
			res = new CaughtException(e);
		}
		this.isComputing = false;
		return res;
	}
	suspend_() {
		if (!this.keepAlive_) {
			clearObserving(this);
			this.value_ = void 0;
		}
	}
	warnAboutUntrackedRead_() {}
	toString() {
		return `${this.name_}[${this.derivation.toString()}]`;
	}
	valueOf() {
		return toPrimitive(this.get());
	}
	[Symbol.toPrimitive]() {
		return this.valueOf();
	}
};
var isComputedValue = /*#__PURE__*/ createInstanceofPredicate("ComputedValue", ComputedValue);
var CaughtException = class {
	constructor(cause) {
		this.cause = void 0;
		this.cause = cause;
	}
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
		case 0: return false;
		case -1:
		case 2: return true;
		case 1: {
			const prevUntracked = untrackedStart();
			const obs = derivation.observing_, l = obs.length;
			for (let i = 0; i < l; i++) {
				const obj = obs[i];
				if (isComputedValue(obj)) {
					if (globalState.disableErrorBoundaries) obj.get();
					else try {
						obj.get();
					} catch (e) {
						untrackedEnd(prevUntracked);
						return true;
					}
					if (derivation.dependenciesState_ === 2) {
						untrackedEnd(prevUntracked);
						return true;
					}
				}
			}
			changeDependenciesStateTo0(derivation);
			untrackedEnd(prevUntracked);
			return false;
		}
	}
}
/**
* Executes the provided function `f` and tracks which observables are being accessed.
* The tracking information is stored on the `derivation` object and the derivation is registered
* as observer of any of the accessed observables.
*/
function trackDerivedFunction(derivation, f, context) {
	changeDependenciesStateTo0(derivation);
	derivation.newObserving_ = new Array(derivation.runId_ === 0 ? 100 : derivation.observing_.length);
	derivation.unboundDepsCount_ = 0;
	derivation.runId_ = ++globalState.runId;
	const prevTracking = globalState.trackingDerivation;
	globalState.trackingDerivation = derivation;
	globalState.inBatch++;
	let result;
	if (globalState.disableErrorBoundaries === true) result = f.call(context);
	else try {
		result = f.call(context);
	} catch (e) {
		result = new CaughtException(e);
	}
	globalState.inBatch--;
	globalState.trackingDerivation = prevTracking;
	bindDependencies(derivation);
	return result;
}
/**
* diffs newObserving with observing.
* update observing to be newObserving with unique observables
* notify observers that become observed/unobserved
*/
function bindDependencies(derivation) {
	const prevObserving = derivation.observing_;
	const observing = derivation.observing_ = derivation.newObserving_;
	let lowestNewObservingDerivationState = 0;
	let i0 = 0, l = derivation.unboundDepsCount_;
	for (let i = 0; i < l; i++) {
		const dep = observing[i];
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
		const dep = prevObserving[l];
		if (dep.diffValue === 0) removeObserver(dep, derivation);
		dep.diffValue = 0;
	}
	while (i0--) {
		const dep = observing[i0];
		if (dep.diffValue === 1) {
			dep.diffValue = 0;
			addObserver(dep, derivation);
		}
	}
	if (lowestNewObservingDerivationState !== 0) {
		derivation.dependenciesState_ = lowestNewObservingDerivationState;
		derivation.onBecomeStale_();
	}
}
function clearObserving(derivation) {
	const obs = derivation.observing_;
	derivation.observing_ = [];
	let i = obs.length;
	while (i--) removeObserver(obs[i], derivation);
	derivation.dependenciesState_ = -1;
}
function untracked(action) {
	const prev = untrackedStart();
	try {
		return action();
	} finally {
		untrackedEnd(prev);
	}
}
function untrackedStart() {
	const prev = globalState.trackingDerivation;
	globalState.trackingDerivation = null;
	return prev;
}
function untrackedEnd(prev) {
	globalState.trackingDerivation = prev;
}
/**
* needed to keep `lowestObserverState` correct. when changing from (2 or 1) to 0
*
*/
function changeDependenciesStateTo0(derivation) {
	if (derivation.dependenciesState_ === 0) return;
	derivation.dependenciesState_ = 0;
	const obs = derivation.observing_;
	let i = obs.length;
	while (i--) obs[i].lowestObserverState_ = 0;
}
var MOBX_GLOBALS_VERSION = 7;
var MobXGlobals = class {
	constructor() {
		/**
		* MobXGlobals version.
		* MobX compatiblity with other versions loaded in memory as long as this version matches.
		* It indicates that the global state still stores similar information
		*
		* N.B: this version is unrelated to the package version of MobX, and is only the version of the
		* internal state storage of MobX, and can be the same across many different package versions
		*/
		this.version = MOBX_GLOBALS_VERSION;
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
		/**
		* False forces all object's descriptors to
		* writable: true
		* configurable: true
		*/
		this.safeDescriptors = true;
	}
};
var canMergeGlobalState = true;
var isolateCalled = false;
var globalState = /*#__PURE__*/ function() {
	let global = globalThis;
	if (global.__mobxInstanceCount > 0 && !global.__mobxGlobals) canMergeGlobalState = false;
	if (global.__mobxGlobals && global.__mobxGlobals.version !== MOBX_GLOBALS_VERSION) canMergeGlobalState = false;
	if (!canMergeGlobalState) {
		setTimeout(() => {
			if (!isolateCalled) die(35);
		}, 1);
		return new MobXGlobals();
	} else if (global.__mobxGlobals) {
		global.__mobxInstanceCount += 1;
		if (!global.__mobxGlobals.UNCHANGED) global.__mobxGlobals.UNCHANGED = {};
		return global.__mobxGlobals;
	} else {
		global.__mobxInstanceCount = 1;
		return global.__mobxGlobals = /*#__PURE__*/ new MobXGlobals();
	}
}();
function addObserver(observable, node) {
	observable.observers_.add(node);
	if (observable.lowestObserverState_ > node.dependenciesState_) observable.lowestObserverState_ = node.dependenciesState_;
}
function removeObserver(observable, node) {
	observable.observers_.delete(node);
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
		const list = globalState.pendingUnobservations;
		for (let i = 0; i < list.length; i++) {
			const observable = list[i];
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
	const derivation = globalState.trackingDerivation;
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
	if (observable.lowestObserverState_ === 2) return;
	observable.lowestObserverState_ = 2;
	observable.observers_.forEach((d) => {
		if (d.dependenciesState_ === 0) d.onBecomeStale_();
		d.dependenciesState_ = 2;
	});
}
function propagateChangeConfirmed(observable) {
	if (observable.lowestObserverState_ === 2) return;
	observable.lowestObserverState_ = 2;
	observable.observers_.forEach((d) => {
		if (d.dependenciesState_ === 1) d.dependenciesState_ = 2;
		else if (d.dependenciesState_ === 0) observable.lowestObserverState_ = 0;
	});
}
function propagateMaybeChanged(observable) {
	if (observable.lowestObserverState_ !== 0) return;
	observable.lowestObserverState_ = 1;
	observable.observers_.forEach((d) => {
		if (d.dependenciesState_ === 0) {
			d.dependenciesState_ = 1;
			d.onBecomeStale_();
		}
	});
}
var Reaction = class {
	constructor(name_ = "Reaction", onInvalidate_, errorHandler_, requiresObservable_) {
		this.name_ = void 0;
		this.onInvalidate_ = void 0;
		this.errorHandler_ = void 0;
		this.requiresObservable_ = void 0;
		this.observing_ = [];
		this.newObserving_ = [];
		this.dependenciesState_ = -1;
		this.runId_ = 0;
		this.unboundDepsCount_ = 0;
		this.flags_ = 0;
		this.name_ = name_;
		this.onInvalidate_ = onInvalidate_;
		this.errorHandler_ = errorHandler_;
		this.requiresObservable_ = requiresObservable_;
	}
	get isDisposed() {
		return getFlag(this.flags_, 1);
	}
	set isDisposed(newValue) {
		this.flags_ = setFlag(this.flags_, 1, newValue);
	}
	get isScheduled() {
		return getFlag(this.flags_, 2);
	}
	set isScheduled(newValue) {
		this.flags_ = setFlag(this.flags_, 2, newValue);
	}
	get isTrackPending() {
		return getFlag(this.flags_, 4);
	}
	set isTrackPending(newValue) {
		this.flags_ = setFlag(this.flags_, 4, newValue);
	}
	get isRunning() {
		return getFlag(this.flags_, 8);
	}
	set isRunning(newValue) {
		this.flags_ = setFlag(this.flags_, 8, newValue);
	}
	get diffValue() {
		return getFlag(this.flags_, 16) ? 1 : 0;
	}
	set diffValue(newValue) {
		this.flags_ = setFlag(this.flags_, 16, newValue === 1 ? true : false);
	}
	onBecomeStale_() {
		this.schedule_();
	}
	schedule_() {
		if (!this.isScheduled) {
			this.isScheduled = true;
			globalState.pendingReactions.push(this);
			runReactions();
		}
	}
	/**
	* internal, use schedule() if you intend to kick off a reaction
	*/
	runReaction_() {
		if (!this.isDisposed) {
			startBatch();
			this.isScheduled = false;
			const prev = globalState.trackingContext;
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
	}
	track(fn) {
		if (this.isDisposed) return;
		startBatch();
		this.isRunning = true;
		const prevReaction = globalState.trackingContext;
		globalState.trackingContext = this;
		const result = trackDerivedFunction(this, fn, void 0);
		globalState.trackingContext = prevReaction;
		this.isRunning = false;
		this.isTrackPending = false;
		if (this.isDisposed) clearObserving(this);
		if (isCaughtException(result)) this.reportExceptionInDerivation_(result.cause);
		endBatch();
	}
	reportExceptionInDerivation_(error) {
		if (this.errorHandler_) {
			this.errorHandler_(error, this);
			return;
		}
		if (globalState.disableErrorBoundaries) throw error;
		const message = `[mobx] uncaught error in '${this}'`;
		if (!globalState.suppressReactionErrors) console.error(message, error);
		globalState.globalReactionErrorHandlers.forEach((f) => f(error, this));
	}
	dispose() {
		if (!this.isDisposed) {
			this.isDisposed = true;
			if (!this.isRunning) {
				startBatch();
				clearObserving(this);
				endBatch();
			}
		}
	}
	getDisposer_(abortSignal) {
		const dispose = () => {
			this.dispose();
			abortSignal == null || abortSignal.removeEventListener == null || abortSignal.removeEventListener("abort", dispose);
		};
		abortSignal == null || abortSignal.addEventListener == null || abortSignal.addEventListener("abort", dispose);
		dispose[$mobx] = this;
		if ("dispose" in Symbol && typeof Symbol.dispose === "symbol") dispose[Symbol.dispose] = dispose;
		return dispose;
	}
	toString() {
		return `Reaction[${this.name_}]`;
	}
};
/**
* Magic number alert!
* Defines within how many times a reaction is allowed to re-trigger itself
* until it is assumed that this is gonna be a never ending loop...
*/
var MAX_REACTION_ITERATIONS = 100;
var reactionScheduler = (f) => f();
function runReactions() {
	if (globalState.inBatch > 0 || globalState.isRunningReactions) return;
	reactionScheduler(runReactionsHelper);
}
function runReactionsHelper() {
	globalState.isRunningReactions = true;
	const allReactions = globalState.pendingReactions;
	let iterations = 0;
	while (allReactions.length > 0) {
		if (++iterations === MAX_REACTION_ITERATIONS) {
			console.error(`[mobx] cycle in reaction: ${allReactions[0]}`);
			allReactions.splice(0);
		}
		let remainingReactions = allReactions.splice(0);
		for (let i = 0, l = remainingReactions.length; i < l; i++) remainingReactions[i].runReaction_();
	}
	globalState.isRunningReactions = false;
}
var isReaction = /*#__PURE__*/ createInstanceofPredicate("Reaction", Reaction);
var ACTION = "action";
var AUTOACTION = "autoAction";
var AUTOACTION_BOUND = "autoAction.bound";
var DEFAULT_ACTION_NAME = "<unnamed action>";
var actionAnnotation = /*#__PURE__*/ createActionAnnotation(ACTION);
var autoActionAnnotation = /*#__PURE__*/ createActionAnnotation(AUTOACTION, { autoAction: true });
var autoActionBoundAnnotation = /*#__PURE__*/ createActionAnnotation(AUTOACTION_BOUND, {
	autoAction: true,
	bound: true
});
function createActionDecoratorAnnotation(annotation) {
	return createDecoratorAnnotation(annotation, decorateAction20223_);
}
function createActionFactory(autoAction) {
	return function action(arg1, arg2) {
		if (arg2 && typeof arg2.kind === "string") return decorateAction20223_(autoAction ? autoActionAnnotation : actionAnnotation, arg1, arg2);
		if (isFunction(arg1)) return createAction(arg1.name || DEFAULT_ACTION_NAME, arg1, autoAction);
		if (isFunction(arg2)) return createAction(arg1, arg2, autoAction);
		if (isStringish(arg1)) return createActionDecoratorAnnotation(createActionAnnotation(autoAction ? AUTOACTION : ACTION, {
			name: arg1,
			autoAction
		}));
	};
}
var action = /*#__PURE__*/ createActionFactory(false);
assign(action, actionAnnotation);
var autoAction = /*#__PURE__*/ createActionFactory(true);
assign(autoAction, autoActionAnnotation);
var autoActionBound = /*#__PURE__*/ createActionDecoratorAnnotation(autoActionBoundAnnotation);
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
function autorun(view, opts = EMPTY_OBJECT) {
	var _opts$name, _opts$signal;
	const name = (_opts$name = opts == null ? void 0 : opts.name) != null ? _opts$name : "Autorun";
	const runSync = !opts.scheduler && !opts.delay;
	let reaction;
	if (runSync) reaction = new Reaction(name, function() {
		this.track(reactionRunner);
	}, opts.onError, opts.requiresObservable);
	else {
		const scheduler = createSchedulerFromOptions(opts);
		let isScheduled = false;
		reaction = new Reaction(name, () => {
			if (!isScheduled) {
				isScheduled = true;
				scheduler(() => {
					isScheduled = false;
					if (!reaction.isDisposed) reaction.track(reactionRunner);
				});
			}
		}, opts.onError, opts.requiresObservable);
	}
	function reactionRunner() {
		view(reaction);
	}
	if (!(opts != null && (_opts$signal = opts.signal) != null && _opts$signal.aborted)) reaction.schedule_();
	return reaction.getDisposer_(opts == null ? void 0 : opts.signal);
}
var run = (f) => f();
function createSchedulerFromOptions(opts) {
	return opts.scheduler ? opts.scheduler : opts.delay ? (f) => setTimeout(f, opts.delay) : run;
}
function reaction(expression, effect, opts = EMPTY_OBJECT) {
	var _opts$name2, _opts$signal2;
	const name = (_opts$name2 = opts.name) != null ? _opts$name2 : "Reaction";
	const effectAction = action(name, opts.onError ? wrapErrorHandler(opts.onError, effect) : effect);
	const runSync = !opts.scheduler && !opts.delay;
	const scheduler = createSchedulerFromOptions(opts);
	let firstTime = true;
	let isScheduled = false;
	let value;
	const equals = opts.equals || compareDefault;
	const r = new Reaction(name, () => {
		if (firstTime || runSync) reactionRunner();
		else if (!isScheduled) {
			isScheduled = true;
			scheduler(reactionRunner);
		}
	}, opts.onError, opts.requiresObservable);
	function reactionRunner() {
		isScheduled = false;
		if (r.isDisposed) return;
		let changed = false;
		const oldValue = value;
		r.track(() => {
			const nextValue = allowStateChanges(false, () => expression(r));
			changed = firstTime || !equals(value, nextValue);
			value = nextValue;
		});
		if (firstTime && opts.fireImmediately) effectAction(value, oldValue, r);
		else if (!firstTime && changed) effectAction(value, oldValue, r);
		firstTime = false;
	}
	if (!(opts != null && (_opts$signal2 = opts.signal) != null && _opts$signal2.aborted)) r.schedule_();
	return r.getDisposer_(opts == null ? void 0 : opts.signal);
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
function extendObservable(target, properties, annotations, options) {
	const descriptors = getOwnPropertyDescriptors(properties);
	initObservable(() => {
		const adm = asObservableObject(target, options)[$mobx];
		ownKeys(descriptors).forEach((key) => {
			adm.extend_(key, descriptors[key], !annotations ? true : key in annotations ? annotations[key] : true);
		});
	});
	return target;
}
var FlowCancellationError = class extends Error {
	constructor() {
		super("FLOW_CANCELLED");
		Object.setPrototypeOf(this, new.target.prototype);
		this.name = "FlowCancellationError";
	}
	toString() {
		return `Error: ${this.message}`;
	}
};
function createFlowDecoratorAnnotation(annotation) {
	return createDecoratorAnnotation(annotation, decorateFlow20223_);
}
var flowAnnotation = /*#__PURE__*/ createFlowAnnotation("flow");
var flowBoundAnnotation = /*#__PURE__*/ createFlowAnnotation("flow.bound", { bound: true });
var flow = /*#__PURE__*/ assign(function flow(arg1, arg2) {
	if (arg2 && typeof arg2.kind === "string") return decorateFlow20223_(flowAnnotation, arg1, arg2);
	const generator = arg1;
	const name = generator.name || "flow";
	const res = function res() {
		const ctx = this;
		const args = arguments;
		const gen = action(name, generator).apply(ctx, args);
		let rejector;
		let pendingPromise = void 0;
		const promise = new Promise(function(resolve, reject) {
			rejector = reject;
			function onFulfilled(res) {
				pendingPromise = void 0;
				let ret;
				try {
					ret = action(name, gen.next).call(gen, res);
				} catch (e) {
					return reject(e);
				}
				next(ret);
			}
			function onRejected(err) {
				pendingPromise = void 0;
				let ret;
				try {
					ret = action(name, gen.throw).call(gen, err);
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
		promise.cancel = action(name, function() {
			try {
				if (pendingPromise) cancelPromise(pendingPromise);
				const res = gen.return(void 0);
				const yieldedPromise = Promise.resolve(res.value);
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
var flowBound = /*#__PURE__*/ createFlowDecoratorAnnotation(flowBoundAnnotation);
function cancelPromise(promise) {
	if (isFunction(promise.cancel)) promise.cancel();
}
function isFlow(fn) {
	return (fn == null ? void 0 : fn.isMobXFlow) === true;
}
function _isObservable(value, property) {
	if (!value) return false;
	if (property !== void 0) {
		if (isObservableObject(value)) {
			var _adm$lazyComputedKeys, _adm$lazyObservableKe;
			const adm = value[$mobx];
			return adm.values_.has(property) || !!((_adm$lazyComputedKeys = adm.lazyComputedKeys_) != null && _adm$lazyComputedKeys.has(property)) || !!((_adm$lazyObservableKe = adm.lazyObservableKeys_) != null && _adm$lazyObservableKe.has(property));
		}
		return false;
	}
	return isObservableObject(value) || !!value[$mobx] || isAtom(value) || isReaction(value) || isComputedValue(value);
}
function isObservable(value) {
	return _isObservable(value);
}
/**
* During a transaction no views are updated until the end of the transaction.
* The transaction will be run synchronously nonetheless.
*
* @param action a function that updates some reactive state
* @returns any value that was returned by the 'action' parameter.
*/
function transaction(action, thisArg = void 0) {
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
	has(target, name) {
		return getAdm(target).has_(name);
	},
	get(target, name) {
		return getAdm(target).get_(name);
	},
	set(target, name, value) {
		var _getAdm$set_;
		if (!isStringish(name)) return false;
		return (_getAdm$set_ = getAdm(target).set_(name, value, true)) != null ? _getAdm$set_ : true;
	},
	deleteProperty(target, name) {
		var _getAdm$delete_;
		if (!isStringish(name)) return false;
		return (_getAdm$delete_ = getAdm(target).delete_(name, true)) != null ? _getAdm$delete_ : true;
	},
	defineProperty(target, name, descriptor) {
		var _getAdm$definePropert;
		return (_getAdm$definePropert = getAdm(target).defineProperty_(name, descriptor)) != null ? _getAdm$definePropert : true;
	},
	ownKeys(target) {
		return getAdm(target).ownKeys_();
	},
	preventExtensions(target) {
		die(13);
	}
};
function asDynamicObservableObject(target, options) {
	var _target$$mobx, _target$$mobx$proxy_;
	target = asObservableObject(target, options);
	return (_target$$mobx$proxy_ = (_target$$mobx = target[$mobx]).proxy_) != null ? _target$$mobx$proxy_ : _target$$mobx.proxy_ = new Proxy(target, objectProxyTraps);
}
function hasInterceptors(interceptable) {
	return interceptable.interceptors_ !== void 0 && interceptable.interceptors_.length > 0;
}
function interceptChange(interceptable, change) {
	const prevU = untrackedStart();
	try {
		const interceptors = [...interceptable.interceptors_ || []];
		for (let i = 0, l = interceptors.length; i < l; i++) {
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
function notifyListeners(listenable, change) {
	const prevU = untrackedStart();
	let listeners = listenable.changeListeners_;
	if (!listeners) return;
	listeners = listeners.slice();
	for (let i = 0, l = listeners.length; i < l; i++) listeners[i](change);
	untrackedEnd(prevU);
}
var keysSymbol = /*#__PURE__*/ Symbol("mobx-keys");
function makeAutoObservable(target, overrides, options) {
	if (isPlainObject(target)) return extendObservable(target, target, overrides, options);
	initObservable(() => {
		const adm = asObservableObject(target, options)[$mobx];
		if (!target[keysSymbol]) {
			const proto = Object.getPrototypeOf(target);
			const keys = /* @__PURE__ */ new Set([...ownKeys(target), ...ownKeys(proto)]);
			keys.delete("constructor");
			keys.delete($mobx);
			addHiddenProp(proto, keysSymbol, keys);
		}
		target[keysSymbol].forEach((key) => make_(adm, key, !overrides ? true : key in overrides ? overrides[key] : true));
	});
	return target;
}
function make_(adm, key, annotation) {
	if (annotation === true) annotation = adm.defaultAnnotation_;
	if (annotation === false) return;
	if (!(key in adm.target_)) die(1, annotation.annotationType_, `${adm.name_}.${key.toString()}`);
	let source = adm.target_;
	while (source && source !== objectPrototype) {
		const descriptor = getDescriptor(source, key);
		if (descriptor) {
			const outcome = annotation.make_(adm, key, descriptor, source);
			if (outcome === 0) return;
			if (outcome === 1) break;
		}
		source = Object.getPrototypeOf(source);
	}
}
var SPLICE = "splice";
var UPDATE = "update";
var MAX_SPLICE_SIZE = 1e4;
var arrayTraps = {
	get(target, name) {
		const adm = target[$mobx];
		if (name === $mobx) return adm;
		if (name === "length") return adm.getArrayLength_();
		if (typeof name === "string" && !isNaN(name)) return adm.get_(parseInt(name));
		if (hasProp(arrayExtensions, name)) return arrayExtensions[name];
		return target[name];
	},
	set(target, name, value) {
		const adm = target[$mobx];
		if (name === "length") adm.setArrayLength_(value);
		if (typeof name === "symbol" || isNaN(name)) target[name] = value;
		else adm.set_(parseInt(name), value);
		return true;
	},
	preventExtensions() {
		die(15);
	}
};
var ObservableArrayAdministration = class {
	constructor(name = "ObservableArray", enhancer, owned_) {
		this.owned_ = void 0;
		this.atom_ = void 0;
		this.values_ = [];
		this.interceptors_ = void 0;
		this.changeListeners_ = void 0;
		this.enhancer_ = void 0;
		this.dehancer = void 0;
		this.proxy_ = void 0;
		this.lastKnownLength_ = 0;
		this.owned_ = owned_;
		this.atom_ = new Atom(name);
		this.enhancer_ = (newV, oldV) => enhancer(newV, oldV, "ObservableArray[..]");
	}
	dehanceValue_(value) {
		if (this.dehancer !== void 0) return this.dehancer(value);
		return value;
	}
	dehanceValues_(values) {
		if (this.dehancer !== void 0 && values.length > 0) return values.map(this.dehancer);
		return values;
	}
	getArrayLength_() {
		this.atom_.reportObserved();
		return this.values_.length;
	}
	setArrayLength_(newLength) {
		if (typeof newLength !== "number" || isNaN(newLength) || newLength < 0) die(40, newLength);
		let currentLength = this.values_.length;
		if (newLength === currentLength) return;
		else if (newLength > currentLength) {
			const newItems = Array.from({ length: newLength - currentLength });
			this.spliceWithArray_(currentLength, 0, newItems);
		} else this.spliceWithArray_(newLength, currentLength - newLength);
	}
	updateArrayLength_(oldLength, delta) {
		if (oldLength !== this.lastKnownLength_) die(16);
		this.lastKnownLength_ += delta;
	}
	spliceWithArray_(index, deleteCount, newItems) {
		this.atom_;
		const length = this.values_.length;
		if (index === void 0) index = 0;
		else if (index > length) index = length;
		else if (index < 0) index = Math.max(0, length + index);
		if (arguments.length === 1) deleteCount = length - index;
		else if (deleteCount === void 0 || deleteCount === null) deleteCount = 0;
		else deleteCount = Math.max(0, Math.min(deleteCount, length - index));
		if (newItems === void 0) newItems = EMPTY_ARRAY;
		if (hasInterceptors(this)) {
			const change = interceptChange(this, {
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
		newItems = newItems.length === 0 ? newItems : newItems.map((v) => this.enhancer_(v, void 0));
		const res = this.spliceItemsIntoValues_(index, deleteCount, newItems);
		if (deleteCount !== 0 || newItems.length !== 0) this.notifyArraySplice_(index, newItems, res);
		return this.dehanceValues_(res);
	}
	spliceItemsIntoValues_(index, deleteCount, newItems) {
		if (newItems.length < MAX_SPLICE_SIZE) return this.values_.splice(index, deleteCount, ...newItems);
		else {
			const res = this.values_.slice(index, index + deleteCount);
			let oldItems = this.values_.slice(index + deleteCount);
			this.values_.length += newItems.length - deleteCount;
			for (let i = 0; i < newItems.length; i++) this.values_[index + i] = newItems[i];
			for (let i = 0; i < oldItems.length; i++) this.values_[index + newItems.length + i] = oldItems[i];
			return res;
		}
	}
	notifyArrayChildUpdate_(index, newValue, oldValue) {
		const notifySpy = false;
		const notify = hasListeners(this);
		const change = notify || notifySpy ? {
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
	}
	notifyArraySplice_(index, added, removed) {
		const notifySpy = false;
		const notify = hasListeners(this);
		const change = notify || notifySpy ? {
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
	}
	get_(index) {
		this.atom_.reportObserved();
		return this.dehanceValue_(this.values_[index]);
	}
	set_(index, newValue) {
		const values = this.values_;
		if (index < values.length) {
			this.atom_;
			const oldValue = values[index];
			if (hasInterceptors(this)) {
				const change = interceptChange(this, {
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
			const newItems = Array.from({ length: index + 1 - values.length });
			newItems[newItems.length - 1] = newValue;
			this.spliceWithArray_(values.length, 0, newItems);
		}
	}
};
function createObservableArray(initialValues, enhancer, name = "ObservableArray", owned = false) {
	return initObservable(() => {
		const adm = new ObservableArrayAdministration(name, enhancer, owned);
		addHiddenFinalProp(adm.values_, $mobx, adm);
		const proxy = new Proxy(adm.values_, arrayTraps);
		adm.proxy_ = proxy;
		if (initialValues && initialValues.length) adm.spliceWithArray_(0, 0, initialValues);
		return proxy;
	});
}
var arrayExtensions = {
	clear() {
		return this.splice(0);
	},
	replace(newItems) {
		const adm = this[$mobx];
		return adm.spliceWithArray_(0, adm.values_.length, newItems);
	},
	toJSON() {
		return this.slice();
	},
	splice(index, deleteCount, ...newItems) {
		const adm = this[$mobx];
		switch (arguments.length) {
			case 0: return [];
			case 1: return adm.spliceWithArray_(index);
			case 2: return adm.spliceWithArray_(index, deleteCount);
		}
		return adm.spliceWithArray_(index, deleteCount, newItems);
	},
	spliceWithArray(index, deleteCount, newItems) {
		return this[$mobx].spliceWithArray_(index, deleteCount, newItems);
	},
	push(...items) {
		const adm = this[$mobx];
		adm.spliceWithArray_(adm.values_.length, 0, items);
		return adm.values_.length;
	},
	pop() {
		return this.splice(Math.max(this[$mobx].values_.length - 1, 0), 1)[0];
	},
	shift() {
		return this.splice(0, 1)[0];
	},
	unshift(...items) {
		const adm = this[$mobx];
		adm.spliceWithArray_(0, 0, items);
		return adm.values_.length;
	},
	reverse() {
		if (globalState.trackingDerivation) die(37, "reverse");
		this.replace(this.slice().reverse());
		return this;
	},
	sort() {
		if (globalState.trackingDerivation) die(37, "sort");
		const copy = this.slice();
		copy.sort.apply(copy, arguments);
		this.replace(copy);
		return this;
	},
	remove(value) {
		const adm = this[$mobx];
		const idx = adm.dehanceValues_(adm.values_).indexOf(value);
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
		const adm = this[$mobx];
		adm.atom_.reportObserved();
		const dehancedValues = adm.dehanceValues_(adm.values_);
		return dehancedValues[funcName].apply(dehancedValues, arguments);
	};
}
function mapLikeFunc(funcName) {
	return function(callback, thisArg) {
		const adm = this[$mobx];
		adm.atom_.reportObserved();
		return adm.dehanceValues_(adm.values_)[funcName]((element, index) => {
			return callback.call(thisArg, element, index, this);
		});
	};
}
function reduceLikeFunc(funcName) {
	return function() {
		const adm = this[$mobx];
		adm.atom_.reportObserved();
		const dehancedValues = adm.dehanceValues_(adm.values_);
		const callback = arguments[0];
		arguments[0] = (accumulator, currentValue, index) => {
			return callback(accumulator, currentValue, index, this);
		};
		return dehancedValues[funcName].apply(dehancedValues, arguments);
	};
}
var ObservableMapMarker = {};
var ADD = "add";
var DELETE = "delete";
var ObservableMap = class {
	constructor(initialData, enhancer_ = deepEnhancer, name_ = "ObservableMap") {
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
		initObservable(() => {
			this.keysAtom_ = createAtom("ObservableMap.keys()");
			this.data_ = /* @__PURE__ */ new Map();
			this.hasMap_ = /* @__PURE__ */ new Map();
			if (initialData) this.merge(initialData);
		});
	}
	has_(key) {
		return this.data_.has(key);
	}
	has(key) {
		if (!globalState.trackingDerivation) return this.has_(key);
		let entry = this.hasMap_.get(key);
		if (!entry) {
			const newEntry = entry = new ObservableValue(this.has_(key), referenceEnhancer, "ObservableMap.key?", false);
			this.hasMap_.set(key, newEntry);
			newEntry.onBUOL = /* @__PURE__ */ new Set([() => this.hasMap_.delete(key)]);
		}
		return entry.get();
	}
	set(key, value) {
		const hasKey = this.has_(key);
		if (hasInterceptors(this)) {
			const change = interceptChange(this, {
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
	}
	delete(key) {
		this.keysAtom_;
		if (hasInterceptors(this)) {
			if (!interceptChange(this, {
				type: DELETE,
				object: this,
				name: key
			})) return false;
		}
		if (this.has_(key)) {
			const notifySpy = false;
			const notify = hasListeners(this);
			const change = notify || notifySpy ? {
				observableKind: "map",
				debugObjectName: this.name_,
				type: DELETE,
				object: this,
				oldValue: this.data_.get(key).value_,
				name: key
			} : null;
			transaction(() => {
				var _this$hasMap_$get;
				this.keysAtom_.reportChanged();
				(_this$hasMap_$get = this.hasMap_.get(key)) == null || _this$hasMap_$get.setNewValue_(false);
				this.data_.get(key).setNewValue_(void 0);
				this.data_.delete(key);
			});
			if (notify) notifyListeners(this, change);
			return true;
		}
		return false;
	}
	updateValue_(key, newValue) {
		const observable = this.data_.get(key);
		newValue = observable.prepareNewValue_(newValue);
		if (newValue !== globalState.UNCHANGED) {
			const notifySpy = false;
			const notify = hasListeners(this);
			const change = notify || notifySpy ? {
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
	}
	addValue_(key, newValue) {
		this.keysAtom_;
		transaction(() => {
			var _this$hasMap_$get2;
			const observable = new ObservableValue(newValue, this.enhancer_, "ObservableMap.key", false);
			this.data_.set(key, observable);
			newValue = observable.value_;
			(_this$hasMap_$get2 = this.hasMap_.get(key)) == null || _this$hasMap_$get2.setNewValue_(true);
			this.keysAtom_.reportChanged();
		});
		const notifySpy = false;
		const notify = hasListeners(this);
		const change = notify || notifySpy ? {
			observableKind: "map",
			debugObjectName: this.name_,
			type: ADD,
			object: this,
			name: key,
			newValue
		} : null;
		if (notify) notifyListeners(this, change);
	}
	get(key) {
		if (this.has(key)) return this.dehanceValue_(this.data_.get(key).get());
		return this.dehanceValue_(void 0);
	}
	getOrInsert(key, value) {
		if (!this.has(key)) this.set(key, value);
		return this.get(key);
	}
	getOrInsertComputed(key, callback) {
		if (!this.has(key)) this.set(key, callback(key));
		return this.get(key);
	}
	dehanceValue_(value) {
		if (this.dehancer !== void 0) return this.dehancer(value);
		return value;
	}
	keys() {
		this.keysAtom_.reportObserved();
		return this.data_.keys();
	}
	values() {
		const self = this;
		const keys = this.keys();
		return makeIterableForMap({ next() {
			const { done, value } = keys.next();
			return {
				done,
				value: done ? void 0 : self.get(value)
			};
		} });
	}
	entries() {
		const self = this;
		const keys = this.keys();
		return makeIterableForMap({ next() {
			const { done, value } = keys.next();
			return {
				done,
				value: done ? void 0 : [value, self.get(value)]
			};
		} });
	}
	[Symbol.iterator]() {
		return this.entries();
	}
	forEach(callback, thisArg) {
		for (const [key, value] of this) callback.call(thisArg, value, key, this);
	}
	/** Merge another object into this object, returns this. */
	merge(other) {
		if (isObservableMap(other)) other = new Map(other);
		transaction(() => {
			if (isPlainObject(other)) getPlainObjectKeys(other).forEach((key) => this.set(key, other[key]));
			else if (Array.isArray(other)) other.forEach(([key, value]) => this.set(key, value));
			else if (isES6Map(other)) {
				if (!isPlainES6Map(other)) die(19, other);
				other.forEach((value, key) => this.set(key, value));
			} else if (other !== null && other !== void 0) die(20, other);
		});
		return this;
	}
	clear() {
		transaction(() => {
			untracked(() => {
				for (const key of this.keys()) this.delete(key);
			});
		});
	}
	replace(values) {
		transaction(() => {
			const replacementMap = convertToMap(values);
			const orderedData = /* @__PURE__ */ new Map();
			let keysReportChangedCalled = false;
			for (const key of this.data_.keys()) if (!replacementMap.has(key)) if (this.delete(key)) keysReportChangedCalled = true;
			else {
				const value = this.data_.get(key);
				orderedData.set(key, value);
			}
			for (const [key, value] of replacementMap.entries()) {
				const keyExisted = this.data_.has(key);
				this.set(key, value);
				if (this.data_.has(key)) {
					const _value = this.data_.get(key);
					orderedData.set(key, _value);
					if (!keyExisted) keysReportChangedCalled = true;
				}
			}
			if (!keysReportChangedCalled) if (this.data_.size !== orderedData.size) this.keysAtom_.reportChanged();
			else {
				const iter1 = this.data_.keys();
				const iter2 = orderedData.keys();
				let next1 = iter1.next();
				let next2 = iter2.next();
				while (!next1.done) {
					if (next1.value !== next2.value) {
						this.keysAtom_.reportChanged();
						break;
					}
					next1 = iter1.next();
					next2 = iter2.next();
				}
			}
			this.data_ = orderedData;
		});
		return this;
	}
	get size() {
		this.keysAtom_.reportObserved();
		return this.data_.size;
	}
	toString() {
		return "[object ObservableMap]";
	}
	toJSON() {
		return Array.from(this);
	}
	get [Symbol.toStringTag]() {
		return "Map";
	}
};
var isObservableMap = /*#__PURE__*/ createInstanceofPredicate("ObservableMap", ObservableMap);
function makeIterableForMap(iterator) {
	iterator[Symbol.toStringTag] = "MapIterator";
	return makeIterable(iterator);
}
function convertToMap(dataStructure) {
	if (isES6Map(dataStructure) || isObservableMap(dataStructure)) return dataStructure;
	else if (Array.isArray(dataStructure)) return new Map(dataStructure);
	else if (isPlainObject(dataStructure)) {
		const map = /* @__PURE__ */ new Map();
		for (const key in dataStructure) map.set(key, dataStructure[key]);
		return map;
	} else return die(21, dataStructure);
}
var ObservableSetMarker = {};
var ObservableSet = class {
	constructor(initialData, enhancer = deepEnhancer, name_ = "ObservableSet") {
		this.name_ = void 0;
		this[$mobx] = ObservableSetMarker;
		this.data_ = /* @__PURE__ */ new Set();
		this.atom_ = void 0;
		this.changeListeners_ = void 0;
		this.interceptors_ = void 0;
		this.dehancer = void 0;
		this.enhancer_ = void 0;
		this.name_ = name_;
		this.enhancer_ = (newV, oldV) => enhancer(newV, oldV, name_);
		initObservable(() => {
			this.atom_ = createAtom(this.name_);
			if (initialData) this.replace(initialData);
		});
	}
	dehanceValue_(value) {
		if (this.dehancer !== void 0) return this.dehancer(value);
		return value;
	}
	clear() {
		transaction(() => {
			untracked(() => {
				for (const value of this.data_.values()) this.delete(value);
			});
		});
	}
	forEach(callbackFn, thisArg) {
		for (const value of this) callbackFn.call(thisArg, value, value, this);
	}
	get size() {
		this.atom_.reportObserved();
		return this.data_.size;
	}
	add(value) {
		this.atom_;
		if (hasInterceptors(this)) {
			const change = interceptChange(this, {
				type: ADD,
				object: this,
				newValue: value
			});
			if (!change) return this;
			value = change.newValue;
		}
		if (!this.has(value)) {
			transaction(() => {
				this.data_.add(this.enhancer_(value, void 0));
				this.atom_.reportChanged();
			});
			const notifySpy = false;
			const notify = hasListeners(this);
			const change = notify || notifySpy ? {
				observableKind: "set",
				debugObjectName: this.name_,
				type: ADD,
				object: this,
				newValue: value
			} : null;
			if (notify) notifyListeners(this, change);
		}
		return this;
	}
	delete(value) {
		if (hasInterceptors(this)) {
			if (!interceptChange(this, {
				type: DELETE,
				object: this,
				oldValue: value
			})) return false;
		}
		if (this.has(value)) {
			const notifySpy = false;
			const notify = hasListeners(this);
			const change = notify || notifySpy ? {
				observableKind: "set",
				debugObjectName: this.name_,
				type: DELETE,
				object: this,
				oldValue: value
			} : null;
			transaction(() => {
				this.atom_.reportChanged();
				this.data_.delete(value);
			});
			if (notify) notifyListeners(this, change);
			return true;
		}
		return false;
	}
	has(value) {
		this.atom_.reportObserved();
		return this.data_.has(this.dehanceValue_(value));
	}
	entries() {
		const values = this.values();
		return makeIterableForSet({ next() {
			const { value, done } = values.next();
			return !done ? {
				value: [value, value],
				done
			} : {
				value: void 0,
				done
			};
		} });
	}
	keys() {
		return this.values();
	}
	values() {
		this.atom_.reportObserved();
		const self = this;
		const values = this.data_.values();
		return makeIterableForSet({ next() {
			const { value, done } = values.next();
			return !done ? {
				value: self.dehanceValue_(value),
				done
			} : {
				value: void 0,
				done
			};
		} });
	}
	intersection(otherSet) {
		if (isES6Set(otherSet) && !isObservableSet(otherSet)) return otherSet.intersection(this);
		else return new Set(this).intersection(otherSet);
	}
	union(otherSet) {
		if (isES6Set(otherSet) && !isObservableSet(otherSet)) return otherSet.union(this);
		else return new Set(this).union(otherSet);
	}
	difference(otherSet) {
		return new Set(this).difference(otherSet);
	}
	symmetricDifference(otherSet) {
		if (isES6Set(otherSet) && !isObservableSet(otherSet)) return otherSet.symmetricDifference(this);
		else return new Set(this).symmetricDifference(otherSet);
	}
	isSubsetOf(otherSet) {
		return new Set(this).isSubsetOf(otherSet);
	}
	isSupersetOf(otherSet) {
		return new Set(this).isSupersetOf(otherSet);
	}
	isDisjointFrom(otherSet) {
		if (isES6Set(otherSet) && !isObservableSet(otherSet)) return otherSet.isDisjointFrom(this);
		else return new Set(this).isDisjointFrom(otherSet);
	}
	replace(other) {
		if (isObservableSet(other)) other = new Set(other);
		transaction(() => {
			if (Array.isArray(other)) {
				this.clear();
				other.forEach((value) => this.add(value));
			} else if (isES6Set(other)) {
				this.clear();
				other.forEach((value) => this.add(value));
			} else if (other !== null && other !== void 0) die(41, other);
		});
		return this;
	}
	toJSON() {
		return Array.from(this);
	}
	toString() {
		return "[object ObservableSet]";
	}
	[Symbol.iterator]() {
		return this.values();
	}
	get [Symbol.toStringTag]() {
		return "Set";
	}
};
var isObservableSet = /*#__PURE__*/ createInstanceofPredicate("ObservableSet", ObservableSet);
function makeIterableForSet(iterator) {
	iterator[Symbol.toStringTag] = "SetIterator";
	return makeIterable(iterator);
}
var descriptorCache = /*#__PURE__*/ Object.create(null);
var REMOVE = "remove";
var ObservableObjectAdministration = class {
	constructor(target_, values_ = /* @__PURE__ */ new Map(), name_, defaultAnnotation_ = autoAnnotation) {
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
		this.lazyComputedKeys_ = void 0;
		this.lazyObservableKeys_ = void 0;
		this.target_ = target_;
		this.values_ = values_;
		this.name_ = name_;
		this.defaultAnnotation_ = defaultAnnotation_;
		this.keysAtom_ = new Atom("ObservableObject.keys");
		this.isPlainObject_ = isPlainObject(this.target_);
	}
	getObservablePropValue_(key) {
		var _ref, _this$values_$get;
		return ((_ref = (_this$values_$get = this.values_.get(key)) != null ? _this$values_$get : this.materializeLazyComputed_(key)) != null ? _ref : this.materializeLazyObservable_(key)).get();
	}
	materializeLazyComputed_(key) {
		var _this$lazyComputedKey;
		const factory = (_this$lazyComputedKey = this.lazyComputedKeys_) == null ? void 0 : _this$lazyComputedKey.get(key);
		if (!factory) return;
		this.lazyComputedKeys_.delete(key);
		if (this.lazyComputedKeys_.size === 0) this.lazyComputedKeys_ = void 0;
		const computed = factory();
		this.values_.set(key, computed);
		return computed;
	}
	materializeLazyObservable_(key) {
		var _this$lazyObservableK;
		const factory = (_this$lazyObservableK = this.lazyObservableKeys_) == null ? void 0 : _this$lazyObservableK.get(key);
		if (!factory) return;
		this.lazyObservableKeys_.delete(key);
		if (this.lazyObservableKeys_.size === 0) this.lazyObservableKeys_ = void 0;
		const observable = factory();
		this.values_.set(key, observable);
		return observable;
	}
	setObservablePropValue_(key, newValue) {
		var _ref2, _this$values_$get2;
		const observable = (_ref2 = (_this$values_$get2 = this.values_.get(key)) != null ? _this$values_$get2 : this.materializeLazyComputed_(key)) != null ? _ref2 : this.materializeLazyObservable_(key);
		if (observable instanceof ComputedValue) {
			observable.set(newValue);
			return true;
		}
		if (hasInterceptors(this)) {
			const change = interceptChange(this, {
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
			const notify = hasListeners(this);
			const change = notify || false ? {
				type: UPDATE,
				observableKind: "object",
				debugObjectName: this.name_,
				object: this.proxy_ || this.target_,
				oldValue: observable.value_,
				name: key,
				newValue
			} : null;
			observable.setNewValue_(newValue);
			if (notify) notifyListeners(this, change);
		}
		return true;
	}
	get_(key) {
		if (globalState.trackingDerivation && !hasProp(this.target_, key)) this.has_(key);
		return this.target_[key];
	}
	/**
	* @param {PropertyKey} key
	* @param {any} value
	* @param {Annotation|boolean} annotation true - use default annotation, false - copy as is
	* @param {boolean} proxyTrap whether it's called from proxy trap
	* @returns {boolean|null} true on success, false on failure (proxyTrap + non-configurable), null when cancelled by interceptor
	*/
	set_(key, value, proxyTrap = false) {
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
	}
	has_(key) {
		if (!globalState.trackingDerivation) return key in this.target_;
		this.pendingKeys_ || (this.pendingKeys_ = /* @__PURE__ */ new Map());
		let entry = this.pendingKeys_.get(key);
		if (!entry) {
			entry = new ObservableValue(key in this.target_, referenceEnhancer, "ObservableObject.key?", false);
			this.pendingKeys_.set(key, entry);
		}
		return entry.get();
	}
	/**
	* @param {PropertyKey} key
	* @param {PropertyDescriptor} descriptor
	* @param {Annotation|boolean} annotation true - use default annotation, false - copy as is
	* @param {boolean} proxyTrap whether it's called from proxy trap
	* @returns {boolean|null} true on success, false on failure (proxyTrap + non-configurable), null when cancelled by interceptor
	*/
	extend_(key, descriptor, annotation, proxyTrap = false) {
		if (annotation === true) annotation = this.defaultAnnotation_;
		if (annotation === false) return this.defineProperty_(key, descriptor, proxyTrap);
		const outcome = annotation.extend_(this, key, descriptor, proxyTrap);
		if (outcome);
		return outcome;
	}
	/**
	* @param {PropertyKey} key
	* @param {PropertyDescriptor} descriptor
	* @param {boolean} proxyTrap whether it's called from proxy trap
	* @returns {boolean|null} true on success, false on failure (proxyTrap + non-configurable), null when cancelled by interceptor
	*/
	defineProperty_(key, descriptor, proxyTrap = false) {
		this.keysAtom_;
		try {
			startBatch();
			const deleteOutcome = this.delete_(key);
			if (!deleteOutcome) return deleteOutcome;
			if (hasInterceptors(this)) {
				const change = interceptChange(this, {
					object: this.proxy_ || this.target_,
					name: key,
					type: ADD,
					newValue: descriptor.value
				});
				if (!change) return null;
				const { newValue } = change;
				if (descriptor.value !== newValue) descriptor = assign({}, descriptor, { value: newValue });
			}
			if (proxyTrap) {
				if (!Reflect.defineProperty(this.target_, key, descriptor)) return false;
			} else defineProperty(this.target_, key, descriptor);
			this.notifyPropertyAddition_(key, descriptor.value);
		} finally {
			endBatch();
		}
		return true;
	}
	defineObservableProperty_(key, value, enhancer, proxyTrap = false) {
		this.keysAtom_;
		try {
			startBatch();
			const deleteOutcome = this.delete_(key);
			if (!deleteOutcome) return deleteOutcome;
			if (hasInterceptors(this)) {
				const change = interceptChange(this, {
					object: this.proxy_ || this.target_,
					name: key,
					type: ADD,
					newValue: value
				});
				if (!change) return null;
				value = change.newValue;
			}
			const cachedDescriptor = getCachedObservablePropDescriptor(key);
			const descriptor = {
				configurable: globalState.safeDescriptors ? this.isPlainObject_ : true,
				enumerable: true,
				get: cachedDescriptor.get,
				set: cachedDescriptor.set
			};
			if (proxyTrap) {
				if (!Reflect.defineProperty(this.target_, key, descriptor)) return false;
			} else defineProperty(this.target_, key, descriptor);
			const observable = new ObservableValue(value, enhancer, "ObservableObject.key", false);
			this.values_.set(key, observable);
			this.notifyPropertyAddition_(key, observable.value_);
		} finally {
			endBatch();
		}
		return true;
	}
	defineComputedProperty_(key, options, proxyTrap = false) {
		this.keysAtom_;
		try {
			startBatch();
			const deleteOutcome = this.delete_(key);
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
			const cachedDescriptor = getCachedObservablePropDescriptor(key);
			const descriptor = {
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
	}
	/**
	* @param {PropertyKey} key
	* @param {PropertyDescriptor} descriptor
	* @param {boolean} proxyTrap whether it's called from proxy trap
	* @returns {boolean|null} true on success, false on failure (proxyTrap + non-configurable), null when cancelled by interceptor
	*/
	delete_(key, proxyTrap = false) {
		this.keysAtom_;
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
			const notify = hasListeners(this);
			const notifySpy = false;
			const observable = this.values_.get(key);
			let value = void 0;
			if (!observable && (notify || notifySpy)) {
				var _getDescriptor;
				value = (_getDescriptor = getDescriptor(this.target_, key)) == null ? void 0 : _getDescriptor.value;
			}
			if (proxyTrap) {
				if (!Reflect.deleteProperty(this.target_, key)) return false;
			} else delete this.target_[key];
			if (observable) {
				this.values_.delete(key);
				if (observable instanceof ObservableValue) value = observable.value_;
				propagateChanged(observable);
			}
			this.keysAtom_.reportChanged();
			(_this$pendingKeys_ = this.pendingKeys_) == null || (_this$pendingKeys_ = _this$pendingKeys_.get(key)) == null || _this$pendingKeys_.set(key in this.target_);
			if (notify || notifySpy) {
				const change = {
					type: REMOVE,
					observableKind: "object",
					object: this.proxy_ || this.target_,
					debugObjectName: this.name_,
					oldValue: value,
					name: key
				};
				if (notify) notifyListeners(this, change);
			}
		} finally {
			endBatch();
		}
		return true;
	}
	notifyPropertyAddition_(key, value) {
		var _this$pendingKeys_2;
		const notify = hasListeners(this);
		const notifySpy = false;
		if (notify || notifySpy) {
			const change = notify || notifySpy ? {
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
	}
	ownKeys_() {
		this.keysAtom_.reportObserved();
		return ownKeys(this.target_);
	}
	keys_() {
		this.keysAtom_.reportObserved();
		return Object.keys(this.target_);
	}
};
function asObservableObject(target, options) {
	var _options$name;
	if (hasProp(target, $mobx)) return target;
	const name = (_options$name = options == null ? void 0 : options.name) != null ? _options$name : "ObservableObject";
	addHiddenProp(target, $mobx, new ObservableObjectAdministration(target, /* @__PURE__ */ new Map(), String(name), getAnnotationFromOptions(options)));
	return target;
}
var isObservableObjectAdministration = /*#__PURE__*/ createInstanceofPredicate("ObservableObjectAdministration", ObservableObjectAdministration);
function getCachedObservablePropDescriptor(key) {
	return descriptorCache[key] || (descriptorCache[key] = {
		get() {
			return this[$mobx].getObservablePropValue_(key);
		},
		set(value) {
			return this[$mobx].setObservablePropValue_(key, value);
		}
	});
}
function isObservableObject(thing) {
	if (isObject(thing)) return isObservableObjectAdministration(thing[$mobx]);
	return false;
}
/**
* Helper function for initializing observable structures, it applies:
* 1. allowStateChanges so we don't violate enforceActions.
* 2. untracked so we don't accidentaly subscribe to anything observable accessed during init in case the observable is created inside derivation.
* 3. batch to avoid state version updates
*/
function initObservable(cb) {
	const derivation = untrackedStart();
	startBatch();
	try {
		return cb();
	} finally {
		endBatch();
		untrackedEnd(derivation);
	}
}
objectPrototype.toString;
var _globalThis$Iterator;
var maybeIteratorPrototype = ((_globalThis$Iterator = globalThis.Iterator) == null ? void 0 : _globalThis$Iterator.prototype) || {};
function makeIterable(iterator) {
	iterator[Symbol.iterator] = getSelf;
	return assign(Object.create(maybeIteratorPrototype), iterator);
}
function getSelf() {
	return this;
}
//#endregion
//#region src/core/Time_of_day.js
/** @typedef {import('../types.js').Time_hms} Time_hms */
var SECONDS_PER_DAY$1 = 86400;
/** An immutable 24-hour clock time representation. */
var Time_of_day = class Time_of_day {
	/** @private @readonly @type {number} */
	_h;
	/** @private @readonly @type {number} */
	_m;
	/** @private @readonly @type {number} */
	_s;
	/** @param {Time_hms} hms */
	constructor(hms) {
		({h: this._h, m: this._m, s: this._s} = hms);
	}
	/** @param {Date} date */
	static create_from_js_date(date) {
		return new Time_of_day({
			h: date.getHours(),
			m: date.getMinutes(),
			s: date.getSeconds()
		});
	}
	/** @param {string} hhmm - `HH:MM` */
	static create_from_hhmm_string(hhmm) {
		const [h, m] = hhmm.split(":").map(Number);
		return new Time_of_day({
			h,
			m,
			s: 0
		});
	}
	/** @returns {number} */
	get hour() {
		return this._h;
	}
	/** @returns {number} */
	get minute() {
		return this._m;
	}
	/** @returns {number} */
	get second() {
		return this._s;
	}
	/** @returns {Time_hms} */
	get_as_hms() {
		return {
			h: this._h,
			m: this._m,
			s: this._s
		};
	}
	/** @returns {string} `(H)H:MM:SS` */
	get_as_string_hmmss() {
		const [mm, ss] = [this._m, this._s].map((value) => String(value).padStart(2, "0"));
		return `${this._h}:${mm}:${ss}`;
	}
	/** @returns {string} `HH:MM` */
	get_as_string_hhmm() {
		const [hh, mm] = [this._h, this._m].map((value) => String(value).padStart(2, "0"));
		return `${hh}:${mm}`;
	}
	/**
	* @param {number} value - The offset to add.
	* @returns {Time_of_day} A new instance with the added time.
	*/
	add_minutes(value) {
		const date = new Date(0, 0, 1, this._h, this._m, this._s);
		date.setMinutes(date.getMinutes() + value);
		return Time_of_day.create_from_js_date(date);
	}
	/**
	* Gets the delay from `this` until the next occurrence of `target`.
	* @param {Time_of_day} target
	* @returns {number}
	*/
	get_seconds_until_next_target(target) {
		const [target_s, this_s] = [target, this].map((time) => time._seconds_since_midnight);
		return this_s < target_s ? target_s - this_s : target_s - this_s + SECONDS_PER_DAY$1;
	}
	/**
	* @param {Time_of_day} start
	* @param {Time_of_day} end
	* @returns {boolean}
	*/
	is_between(start, end) {
		const [this_s, start_s, end_s] = [
			this,
			start,
			end
		].map((time) => time._seconds_since_midnight);
		return start_s < end_s ? start_s <= this_s && this_s < end_s : start_s <= this_s || this_s < end_s;
	}
	/** @private */
	get _seconds_since_midnight() {
		return this._h * 3600 + this._m * 60 + this._s;
	}
};
//#endregion
//#region src/globals.js
var Gettext = imports.gettext;
var { GLib: GLib$6 } = imports.gi;
var Main = imports.ui.main;
var { St } = imports.gi;
/** @type {imports.ui.applet.AppletMetadata} */
var metadata = {
	uuid: "",
	name: "",
	description: "",
	path: "",
	force_loaded: false
};
/**
* @param {string} text
* @returns {string}
*/
function _(text) {
	return Gettext.dgettext(metadata.uuid, text);
}
var translated_applet_name = "";
/** @param {imports.ui.applet.AppletMetadata} applet_metadata */
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
	/** @param {string} msg */
	info(msg) {
		global.log(translated_applet_name + `${_(":")} ` + msg);
		Main.notify(translated_applet_name, msg);
	},
	/** @param {string} msg */
	warn(msg) {
		global.logWarning(translated_applet_name + `${_(":")} ` + msg);
		Main.warningNotify(translated_applet_name, msg, warning_icon);
	},
	/** @param {string} msg */
	error(msg) {
		global.logError(translated_applet_name + `${_(":")} ` + msg);
		Main.criticalNotify(translated_applet_name, msg, error_icon);
	}
};
//#endregion
//#region src/lib/cinnamon/Color_scheme_handler.js
var { Gio: Gio$6 } = imports.gi;
/** @typedef {import('../../types.js').Color_scheme} Color_scheme */
/** @typedef {import('../../types.js').Observer} Observer */
var settings$2 = Gio$6.Settings.new("org.x.apps.portal");
/**
* A listener and accessor to the Cinnamon system color scheme setting.
* @implements {Observer}
*/
var Color_scheme_handler = class Color_scheme_handler {
	/** The function to be called when the color scheme has changed
	* @type {((color_scheme: Color_scheme) => void) | null} */
	callback = null;
	/** @private @type {number | null} */
	_signal_id = null;
	enable() {
		if (this._signal_id !== null) return;
		this._signal_id = settings$2.connect("changed::color-scheme", () => {
			this.callback?.(Color_scheme_handler.value);
		});
	}
	disable() {
		if (this._signal_id === null) return;
		settings$2.disconnect(this._signal_id);
		this._signal_id = null;
	}
	dispose() {
		this.disable();
	}
	/** @returns {Color_scheme} */
	static get value() {
		return settings$2.get_string("color-scheme");
	}
	static set value(value) {
		settings$2.set_string("color-scheme", value);
	}
};
//#endregion
//#region src/lib/cinnamon/Keybinding_handler.js
var { keybindingManager } = imports.ui.main;
/** @typedef {import('../../types.js').Disposable} Disposable */
/**
* A responsible handler to set a Cinnamon keybinding.
* @implements {Disposable}
*/
var Keybinding_handler = class Keybinding_handler {
	/** @private @readonly @type {string} */
	_uuid;
	/** @private @type {number} */
	static _unicity_count = 0;
	/** @param {string} unique_namespace - A specific enough id to avoid name collisions with any other system keybinding name, typically the application name. */
	constructor(unique_namespace) {
		this._uuid = unique_namespace + Keybinding_handler._unicity_count++;
	}
	/** The function to be called when the keybinding has been pressed
	* @type {(() => void) | null} */
	callback = null;
	/**
	* @param {string} keybinding - In the format accepted by Cinnamon (e.g. '<Super>F1'), which can be multiple ones separated with `::`.
	* @returns {boolean}
	*/
	set(keybinding) {
		return keybindingManager.addHotKey(this._uuid, keybinding, () => {
			this.callback?.();
		});
	}
	/** @returns {void} */
	unset() {
		keybindingManager.removeHotKey(this._uuid);
	}
	dispose() {
		this.unset();
	}
};
//#endregion
//#region src/lib/cinnamon/Sleep_and_lock_handler/Screen_lock_change_listener.js
var { ScreenSaverProxy } = imports.misc.screenSaver;
/** @typedef {import('../../../types').Observer} Observer */
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
//#region src/lib/cinnamon/Sleep_and_lock_handler/Screen_unlock_waiter.js
/** @typedef {import('../../../types').Disposable} Disposable */
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
//#region src/lib/cinnamon/Sleep_and_lock_handler/Sleep_events_listener.js
var { Gio: Gio$5 } = imports.gi;
/** @typedef {import('../../../types').Observer} Observer */
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
		this._signal_id = Gio$5.DBus.system.signal_subscribe("org.freedesktop.login1", "org.freedesktop.login1.Manager", "PrepareForSleep", "/org/freedesktop/login1", null, Gio$5.DBusSignalFlags.NONE, (_1, _2, _3, _4, _5, parameters) => {
			const is_entering_sleep = parameters.deep_unpack()[0];
			this.callback?.(is_entering_sleep);
		});
	}
	disable() {
		if (this._signal_id === null) return;
		Gio$5.DBus.system.signal_unsubscribe(this._signal_id);
		this._signal_id = null;
	}
	dispose() {
		this.disable();
	}
};
//#endregion
//#region src/lib/cinnamon/Sleep_and_lock_handler/Sleep_and_lock_handler.js
/** @typedef {import('../../../types').Observer} Observer */
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
//#region src/lib/gnome/system_time.js
var { DateTime: DateTime$1 } = imports.gi.GLib;
/** @typedef {import('../../types').Time_hms} Time_hms */
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
//#region src/lib/gnome/Event_scheduler/Timer_absolute.js
/** @typedef {import('../../../core/Time_of_day.js').Time_of_day} Time_of_day */
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
//#region src/lib/gnome/Event_scheduler/Event_scheduler.js
var { GLib: GLib$5 } = imports.gi;
/** @typedef {import('../../../types').Disposable} Disposable */
/** @typedef {import('../../../core/Time_of_day.js').Time_of_day} Time_of_day */
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
		this._event_id = GLib$5.timeout_add_seconds(GLib$5.PRIORITY_DEFAULT, due_delay, () => {
			callback_on_event();
			return GLib$5.SOURCE_REMOVE;
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
		GLib$5.source_remove(this._event_id);
		this._event_id = null;
		this._timer_absolute.reset();
	}
	dispose() {
		this.unset_the_event();
	}
};
//#endregion
//#region src/lib/gnome/Wall_clock_adjustment_monitor.js
var { GLib: GLib$4 } = imports.gi;
/** @typedef {import('../../types').Observer} Observer */
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
		this._last_wall_clock_time = GLib$4.get_real_time();
		this._last_monotonic_time = GLib$4.get_monotonic_time();
		this._timeout_id = GLib$4.timeout_add_seconds(GLib$4.PRIORITY_DEFAULT, this._monitoring_interval, this._timeout_function);
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
		const wall_clock_time = GLib$4.get_real_time(), monotonic_time = GLib$4.get_monotonic_time();
		const delta_wall_clock = wall_clock_time - this._last_wall_clock_time;
		const delta_monotonic = monotonic_time - this._last_monotonic_time;
		if (Math.abs(delta_wall_clock - delta_monotonic) > this._time_difference_tolerance) this.callback?.();
		this._last_wall_clock_time = wall_clock_time;
		this._last_monotonic_time = monotonic_time;
		return GLib$4.SOURCE_CONTINUE;
	};
	disable() {
		if (!this._timeout_id) return;
		GLib$4.source_remove(this._timeout_id);
		this._timeout_id = null;
	}
	dispose() {
		this.disable();
	}
};
//#endregion
//#region src/lib/utils.js
/**
* @param {number} duration - In milliseconds (ms)
* @returns {Promise<void>}
*/
async function sleep(duration) {
	return new Promise((resolve) => setTimeout(resolve, duration));
}
//#endregion
//#region src/app/handlers/Appearance_handler.js
/** @typedef {import('../../types.js').Twilights} Twilights */
/** @typedef {import('../../core/Time_of_day.js').Time_of_day} Time_of_day */
var Appearance_handler = class {
	/** @private */
	_time = get_now_as_time_of_day();
	update_time() {
		this._time = get_now_as_time_of_day();
	}
	/** @type {Twilights} */
	twilights;
	/** @returns {boolean} */
	get auto_is_dark() {
		return this._time.is_between(this.twilights.sunset, this.twilights.sunrise);
	}
	/** @type {boolean} */
	manual_is_dark;
	toggle_is_dark() {
		this.manual_is_dark = !this.manual_is_dark;
	}
	/** @type {boolean} */
	is_auto;
	toggle_is_auto() {
		this.is_auto = !this.is_auto;
	}
	/** @returns {boolean} */
	get is_dark() {
		return this.is_auto ? this.auto_is_dark : this.manual_is_dark;
	}
	/** @returns {boolean} */
	get is_unsynced() {
		return this.manual_is_dark !== this.auto_is_dark;
	}
	sync_is_dark() {
		this.manual_is_dark = this.auto_is_dark;
	}
	/** @returns {Time_of_day} */
	get next_twilight() {
		return this.auto_is_dark ? this.twilights.sunrise : this.twilights.sunset;
	}
	/**
	* @param {Required<Pick<Appearance_handler,
	*     'twilights' | 'manual_is_dark' | 'is_auto'
	* >>} initial_controls
	*/
	constructor(initial_controls) {
		Object.assign(this, initial_controls);
		makeAutoObservable(this);
	}
};
//#endregion
//#region src/lib/cinnamon/Background_accessor.js
var { Gio: Gio$4 } = imports.gi;
var settings$1 = {
	background: Gio$4.Settings.new("org.cinnamon.desktop.background"),
	slideshow: Gio$4.Settings.new("org.cinnamon.desktop.background.slideshow")
};
/** An accessor to the Cinnamon system background settings. */
var Background_accessor = class {
	/** @returns {boolean} */
	static get is_slideshow() {
		return settings$1.slideshow.get_boolean("slideshow-enabled");
	}
	static set is_slideshow(value) {
		settings$1.slideshow.set_boolean("slideshow-enabled", value);
	}
	/** Irrelevant to get when slideshow is enabled
	* @returns {string} */
	static get picture_file() {
		return settings$1.background.get_string("picture-uri");
	}
	/** /!\ To not set when slideshow is enabled */
	static set picture_file(value) {
		settings$1.background.set_string("picture-uri", value);
	}
	/** Irrelevant to get when slideshow is disabled
	* @returns {string} */
	static get slideshow_folder() {
		return settings$1.slideshow.get_string("image-source");
	}
	/** /!\ To not set when slideshow is disabled */
	static set slideshow_folder(value) {
		settings$1.slideshow.set_string("image-source", value);
	}
};
//#endregion
//#region src/app/handlers/Background_handler.js
/** @typedef {import('../ui/Applet.js').Applet} Applet */
/** @typedef {import('../ui/Settings.js').Settings} Settings */
var Background_handler = class {
	/** @private @readonly @type {Settings} */
	_settings;
	/**
	* @param {Applet} applet
	* @param {Settings} settings
	*/
	constructor(applet, settings) {
		this._settings = settings;
		applet.on_button_detect_background_light = () => this.detect_light_background();
		applet.on_button_detect_background_dark = () => this.detect_dark_background();
		applet.on_button_apply_background_light = () => this.apply_light_background();
		applet.on_button_apply_background_dark = () => this.apply_dark_background();
	}
	/** @returns {void} */
	detect_light_background() {
		const is_slideshow = Background_accessor.is_slideshow;
		this._settings.light_background_is_slideshow = is_slideshow;
		if (is_slideshow) this._settings.light_background_slideshow_folder = Background_accessor.slideshow_folder.replace("directory://", "file://");
		else this._settings.light_background_file = Background_accessor.picture_file;
	}
	/** @returns {void} */
	detect_dark_background() {
		const is_slideshow = Background_accessor.is_slideshow;
		this._settings.dark_background_is_slideshow = is_slideshow;
		if (is_slideshow) this._settings.dark_background_slideshow_folder = Background_accessor.slideshow_folder.replace("directory://", "file://");
		else this._settings.dark_background_file = Background_accessor.picture_file;
	}
	/** @returns {void} */
	apply_light_background() {
		const is_slideshow = this._settings.light_background_is_slideshow;
		Background_accessor.is_slideshow = is_slideshow;
		if (is_slideshow) Background_accessor.slideshow_folder = decodeURIComponent(this._settings.light_background_slideshow_folder.replace("file://", "directory://"));
		else Background_accessor.picture_file = this._settings.light_background_file;
	}
	/** @returns {void} */
	apply_dark_background() {
		const is_slideshow = this._settings.dark_background_is_slideshow;
		Background_accessor.is_slideshow = is_slideshow;
		if (is_slideshow) Background_accessor.slideshow_folder = decodeURIComponent(this._settings.dark_background_slideshow_folder.replace("file://", "directory://"));
		else Background_accessor.picture_file = this._settings.dark_background_file;
	}
};
//#endregion
//#region src/lib/gnome/command_launching.js
var { Gio: Gio$3, GLib: GLib$3 } = imports.gi;
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
	const wrapped_command = `timeout --kill-after=${sigkill_timeout}s ${sigterm_timeout}s sh -c ${GLib$3.shell_quote(command)}`;
	const [_ok, argvp] = GLib$3.shell_parse_argv(wrapped_command);
	const process = new Gio$3.Subprocess({
		argv: argvp,
		flags: Gio$3.SubprocessFlags.STDERR_PIPE
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
//#region src/app/launch_command.js
var { GLib: GLib$2 } = imports.gi;
/**
* Launches a command with a timeout and logs any error on failure.
* @param {string} name - The name of the command to display in case of error. If empty, the command itself is used.
* @param {number} expiry - The delay in seconds before cancelling the command with a SIGTERM, then 10 seconds later with a SIGKILL. `0` means infinity/never.
* @param {string} command - The shell command to execute.
* @returns {Promise<void>} Resolves when the command has been executed or rejects if an error occurs.
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
		else if (error instanceof GLib$2.Error) msg += `${_("Reason")}${_(":")} GLib error.\n${_("Detail")}${_(":")}\nDomain: ${error.domain}\nCode: ${error.code}\nMessage: ${error.message}`;
		else if (error instanceof Error) msg += `${_("Reason")}${_(":")} ${_("Other error")}\n${_("Detail")}${_(":")}\nName: ${error.name}\nMessage: ${error.message}\nStack?:\n${error?.stack}`;
		else msg += `${_("Unknown error type")}${_(":")} ${error}`;
		logger.warn(msg);
	}
}
//#endregion
//#region src/app/handlers/Commands_handler.js
/** @typedef {import('../ui/Applet.js').Applet} Applet */
/** @typedef {import('../ui/Settings.js').Settings} Settings */
var Commands_handler = class {
	/** @private @readonly @type {Settings} */
	_settings;
	/**
	* @param {Applet} applet
	* @param {Settings} settings
	*/
	constructor(applet, settings) {
		this._settings = settings;
		applet.on_button_launch_commands_light = () => this.launch_light_commands();
		applet.on_button_launch_commands_dark = () => this.launch_dark_commands();
	}
	/** @returns {void} */
	launch_dark_commands() {
		this._launch_commands(this._settings.dark_commands_list);
	}
	/** @returns {void} */
	launch_light_commands() {
		this._launch_commands(this._settings.light_commands_list);
	}
	/**
	* @private
	* @param {Settings['light_commands_list']
	*     | Settings['dark_commands_list']} commands_list
	* @returns {void}
	*/
	_launch_commands(commands_list) {
		for (const command of commands_list) {
			if (!command.active) continue;
			launch_command(command.name, command.expiry, command.command);
		}
	}
};
//#endregion
//#region src/core/Timezone_location_finder/Timezone_location_finder.js
var { Gio: Gio$2 } = imports.gi;
/** @typedef {import('../../types.js').Location} Location */
/** A finder of timezone's city coordinates using a local database. */
var Timezone_location_finder = class {
	/** @type {Record<string, [number, number]>} */
	_database;
	/**
	* @param {string} path - The absolute path where the `database.json` file is located.
	* @throws {Error} - If the file cannot be loaded or JSON-parsed
	*/
	constructor(path) {
		const file_path = `${path}/database.json`;
		const [ok, file_content] = Gio$2.File.new_for_path(file_path).load_contents(null);
		if (!ok) throw new Error(`failed to load file/contents of '${file_path}'`);
		this._database = JSON.parse(new TextDecoder().decode(file_content));
	}
	/**
	* Gets the latitude and longitude of the timezone's city.
	* @param {string} timezone - The timezone to get the coordinates from.
	* @returns {Location} The system timezone's city coordinates.
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
//#region src/lib/gnome/Timezone_change_listener.js
var { Gio: Gio$1 } = imports.gi;
/** @typedef {import('../../types').Observer} Observer */
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
		this._signal_id = Gio$1.DBus.system.signal_subscribe("org.freedesktop.timedate1", "org.freedesktop.DBus.Properties", "PropertiesChanged", "/org/freedesktop/timedate1", null, Gio$1.DBusSignalFlags.NONE, (_1, _2, _3, _4, _5, parameters) => {
			const changed_properties = parameters.deep_unpack()[1];
			if (changed_properties["Timezone"]) {
				const new_timezone = changed_properties["Timezone"].deep_unpack();
				this.callback?.(new_timezone);
			}
		});
	}
	disable() {
		if (this._signal_id === null) return;
		Gio$1.DBus.system.signal_unsubscribe(this._signal_id);
		this._signal_id = null;
	}
	dispose() {
		this.disable();
	}
};
//#endregion
//#region src/app/handlers/Location_handler.js
var { GLib: GLib$1 } = imports.gi;
/** @typedef {import('../../types.js').Disposable} Disposable */
/** @typedef {import('../../types.js').Location} Location */
/** @implements {Disposable} */
var Location_handler = class {
	/** @private @readonly */
	_timezone_change_listener = new Timezone_change_listener((new_timezone) => this._timezone = new_timezone);
	/** @private @type {string} */
	_timezone = GLib$1.TimeZone.new_local().get_identifier();
	/** @returns {string} */
	get timezone() {
		return this._timezone;
	}
	/** @private @readonly */
	_timezone_location_finder = new Timezone_location_finder(`${metadata.path}/Timezone_location_finder`);
	/** @returns {Location} */
	get auto_location() {
		return this._timezone_location_finder.find(this.timezone);
	}
	/** @type {Location} */ manual_location;
	/** @type {boolean} */ is_location_auto;
	/** @returns {Location} */
	get location() {
		return this.is_location_auto ? this.auto_location : this.manual_location;
	}
	/**
	* @param {Required<Pick<Location_handler,
	*     'manual_location' | 'is_location_auto'
	* >>} initial_values
	*/
	constructor(initial_values) {
		Object.assign(this, initial_values);
		/**
		* @type {typeof mobx.makeAutoObservable<Location_handler,
		*     '_timezone_change_listener' | '_timezone_location_finder'
		* >}
		*/
		makeAutoObservable(this, {
			_timezone_change_listener: false,
			_timezone_location_finder: false,
			manual_location: observableDeep
		});
		this._timezone_change_listener.enable();
	}
	dispose() {
		this._timezone_change_listener.dispose();
	}
};
//#endregion
//#region src/lib/cinnamon/Themes_accessor.js
var { Gio } = imports.gi;
var settings = {
	desktop: Gio.Settings.new("org.cinnamon.desktop.interface"),
	cinnamon: Gio.Settings.new("org.cinnamon.theme")
};
/** An accessor to the Cinnamon system themes settings. */
var Themes_accessor = class {
	/** @returns {string} */
	static get mouse() {
		return settings.desktop.get_string("cursor-theme");
	}
	static set mouse(value) {
		settings.desktop.set_string("cursor-theme", value);
	}
	/** @returns {string} */
	static get apps() {
		return settings.desktop.get_string("gtk-theme");
	}
	static set apps(value) {
		settings.desktop.set_string("gtk-theme", value);
	}
	/** @returns {string} */
	static get icons() {
		return settings.desktop.get_string("icon-theme");
	}
	static set icons(value) {
		settings.desktop.set_string("icon-theme", value);
	}
	/** @returns {string} */
	static get desktop() {
		return settings.cinnamon.get_string("name");
	}
	static set desktop(value) {
		settings.cinnamon.set_string("name", value);
	}
};
//#endregion
//#region src/app/handlers/Themes_handler.js
/** @typedef {import('../ui/Applet.js').Applet} Applet */
/** @typedef {import('../ui/Settings.js').Settings} Settings */
var Themes_handler = class {
	/** @private @readonly @type {Settings} */
	_settings;
	/**
	* @param {Applet} applet
	* @param {Settings} settings
	*/
	constructor(applet, settings) {
		this._settings = settings;
		applet.on_button_detect_themes_light = () => this.detect_light_themes();
		applet.on_button_detect_themes_dark = () => this.detect_dark_themes();
		applet.on_button_apply_themes_light = () => this.apply_light_themes();
		applet.on_button_apply_themes_dark = () => this.apply_dark_themes();
	}
	/** @returns {void} */
	detect_light_themes() {
		this._settings.setValue("light_themes_mouse", Themes_accessor.mouse);
		this._settings.setValue("light_themes_apps", Themes_accessor.apps);
		this._settings.setValue("light_themes_icons", Themes_accessor.icons);
		this._settings.setValue("light_themes_desktop", Themes_accessor.desktop);
		this._settings.light_themes_have_been_detected = true;
	}
	/** @returns {void} */
	detect_dark_themes() {
		this._settings.setValue("dark_themes_mouse", Themes_accessor.mouse);
		this._settings.setValue("dark_themes_apps", Themes_accessor.apps);
		this._settings.setValue("dark_themes_icons", Themes_accessor.icons);
		this._settings.setValue("dark_themes_desktop", Themes_accessor.desktop);
		this._settings.dark_themes_have_been_detected = true;
	}
	/** @returns {void} */
	apply_light_themes() {
		Themes_accessor.mouse = this._settings.getValue("light_themes_mouse");
		Themes_accessor.apps = this._settings.getValue("light_themes_apps");
		Themes_accessor.icons = this._settings.getValue("light_themes_icons");
		Themes_accessor.desktop = this._settings.getValue("light_themes_desktop");
		Color_scheme_handler.value = "prefer-light";
	}
	/** @returns {void} */
	apply_dark_themes() {
		Themes_accessor.mouse = this._settings.getValue("dark_themes_mouse");
		Themes_accessor.apps = this._settings.getValue("dark_themes_apps");
		Themes_accessor.icons = this._settings.getValue("dark_themes_icons");
		Themes_accessor.desktop = this._settings.getValue("dark_themes_desktop");
		Color_scheme_handler.value = "prefer-dark";
	}
};
//#endregion
//#region src/core/compute_twilights/uSunCalc.js
/**
* A minified and optimized version of the SunCalc library containing only the part needed for the `auto-dark-light` applet.
*/
var { PI, sin, cos, asin, acos, round } = Math;
var TWO_PI = 2 * PI;
var RADIANS_PER_DEGREE = PI / 180;
var SECONDS_PER_DAY = 86400;
var J0 = 9e-4;
var J1970 = 2440587.5;
var J2000 = 2451545;
/**
* @param {number} julian_date
* @returns (seconds)
*/
function _to_unix(julian_date) {
	return (julian_date - J1970) * SECONDS_PER_DAY;
}
/**
* @param {number} Ht
* @param {number} lw
* @param {number} n
* @returns {number}
*/
function _approximate_transit(Ht, lw, n) {
	return J0 + (Ht + lw) / TWO_PI + n;
}
/**
* @param {number} ds
* @param {number} M
* @param {number} L
* @returns {number}
*/
function _solar_transit(ds, M, L) {
	return J2000 + ds + .0053 * sin(M) - .0069 * sin(2 * L);
}
var SIN_OF_EARTH_OBLIQUITY = sin(RADIANS_PER_DEGREE * 23.4397);
var EARTH_PERIHELION_PLUS_PI = RADIANS_PER_DEGREE * 102.9372 + PI;
var J1970_MINUS_J2000 = -10957.5;
/**
* Calculates the sunrise and sunset times for a given date and location.
* @param {number} unix_time - seconds (s)
* @param {number} latitude - degrees (°)
* @param {number} longitude - degrees (°)
* @returns {[sunrise: number, sunset: number]} Unix time, seconds (s)
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
//#region src/core/compute_twilights/compute_twilights.js
/** @typedef {import('../../types.js').Location} Location */
/** @typedef {import('../../types.js').Twilights} Twilights */
/**
* @param {imports.gi.GLib.DateTime} date
* @param {Location} location
* @returns {Twilights}
*/
function compute_twilights(date, location) {
	const [sunrise, sunset] = compute_twilights$1(date.to_unix(), location.latitude, location.longitude);
	return {
		sunrise: new_local_time_of_day_from_unix(sunrise),
		sunset: new_local_time_of_day_from_unix(sunset)
	};
}
//#endregion
//#region src/app/handlers/Twilights_handler.js
var { DateTime } = imports.gi.GLib;
/** @typedef {import('../../types.js').Location} Location */
/** @typedef {import('../../types.js').Twilights} Twilights */
var Twilights_handler = class {
	/** @private */ _date = DateTime.new_now_local();
	update() {
		this._date = DateTime.new_now_local();
	}
	/** @type {Location} */ location;
	/** @private @returns {Twilights} */
	get _location_twilights() {
		return compute_twilights(this._date, this.location);
	}
	/** @type {number} */ auto_sunrise_offset;
	/** @type {number} */ auto_sunset_offset;
	/** @returns {Time_of_day} */
	get auto_sunrise() {
		return this._location_twilights.sunrise.add_minutes(this.auto_sunrise_offset);
	}
	/** @returns {Time_of_day} */
	get auto_sunset() {
		return this._location_twilights.sunset.add_minutes(this.auto_sunset_offset);
	}
	/** @type {Time_of_day} */ manual_sunrise;
	/** @type {Time_of_day} */ manual_sunset;
	/** @type {boolean} */ is_sunrise_auto;
	/** @type {boolean} */ is_sunset_auto;
	/** @private @returns {Time_of_day} */
	get _sunrise() {
		return this.is_sunrise_auto ? this.auto_sunrise : this.manual_sunrise;
	}
	/** @private @returns {Time_of_day} */
	get _sunset() {
		return this.is_sunset_auto ? this.auto_sunset : this.manual_sunset;
	}
	/** @returns {Twilights} */
	get twilights() {
		return {
			sunrise: this._sunrise,
			sunset: this._sunset
		};
	}
	/**
	* @param {Required<Pick<Twilights_handler,
	*     'location' |
	*     'auto_sunrise_offset' | 'auto_sunset_offset' |
	*     'manual_sunrise' | 'manual_sunset' |
	*     'is_sunrise_auto' | 'is_sunset_auto'
	* >>} initial_values
	*/
	constructor(initial_values) {
		Object.assign(this, initial_values);
		makeAutoObservable(this);
	}
};
//#endregion
//#region src/app/app.js
var { GLib } = imports.gi;
var DURATION_TO_AWAIT_BEFORE_UPDATING_DERIVED_SETTING = 2e3;
/**
* @param {import('./ui/Applet.ts').Applet} applet
* @param {import('./ui/Settings.ts').Settings} settings
* @returns {void}
*/
function initialize(applet, settings) {
	/** @type {import('../types.ts').Disposable[]} */ const disposables = [];
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
//#region src/app/initialize_applet_settings.js
var { AppletSettings } = imports.ui.settings;
/** @typedef {import('./ui/Settings.js').Settings} Settings */
/**
* @param {string} uuid
* @param {number} instance_id
* @returns {Settings}
*/
function initialize_applet_settings(uuid, instance_id) {
	const settings = new AppletSettings({}, uuid, instance_id);
	/** @type {const} */ [
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
//#region src/main.js
var { IconApplet } = imports.ui.applet;
/** @typedef {import('./app/ui/Applet.js').Applet} Applet */
/**
* @param {imports.ui.applet.AppletMetadata} metadata
* @param {imports.gi.St.Side} orientation
* @param {number} panel_height
* @param {number} instance_id
* @returns {imports.ui.applet.Applet}
*/
function main(metadata, orientation, panel_height, instance_id) {
	initialize_globals(metadata);
	const applet = new IconApplet(orientation, panel_height, instance_id);
	const settings = initialize_applet_settings(metadata.uuid, instance_id);
	try {
		initialize(applet, settings);
	} catch (error) {
		applet.set_applet_icon_symbolic_name("on-error-symbolic");
		if (error instanceof Error) logger.error(error.message);
		else logger.error(String(error));
		settings.finalize();
	}
	return applet;
}
//#endregion
