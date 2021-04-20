declare namespace imports.ui.tweener {
	/**
	 * This makes @target tween according to the parameters of @tweeningParameters.
	 *
	 * @tweeningParameters contains certain tweening parameters that describe the
	 * tween, and the actual things to tween. Everything that is not a tweening
	 * parameter is processed as follows: If you have
	 * ```
	 * {
	 *     ...
	 *     x: 7
	 *     ...
	 * }
	 * ```
	 * In your parameters, then the property x of the target object will
	 * be animated to the value of 7.
	 * @param target the object to tween
	 * @param tweeningParameters parameters
	 */
	export function addTween(target: gi.St.Widget, tweeningParameters?: TweeningParameters): void;

	export interface TweeningParameters {
		/** Any of the target's properties */
		[key: string]: any;
		/** The duration of the transition in seconds */
		time?: number;
		/** The delay (in seconds) before the transition starts. The
			*    default of this parameter (when omitted) is 0. */
		delay?: number;
		/**   (int) How many updates must be skipped before an actual
		 *    update is made.  This is a powerful property that allows the developer to
		 *    enforce a different update rate for a given tweening, as if simulating a
		 *    lower frame rate. This is useful on transitions that demand a share of
		 *    the CPU that's higher than average on each new update, such as filter
		 *    tweenings. A value of 1, for example, means that the tweening engine will
		 *    do half of the updates on this transition, since it will update then skip
		 *    one update; a value of 2 means it will do one third of the normal
		 *    updates, since it will update, then skip two updates. The default value
		 *    for this parameter (when omitted) is 0, meaning no update is skipped at
		 *    all, and the active tweenings are updated on every frame render. 
		 * */
		skipUpdates?: number;
		/**
		 * The type of transition to use. Different
		*    equations can be used, producing different tweening updates based on time
		*    spent. You can specify this parameter by their internal string names
		*    (which you can find by seeing what's offered in the cinnamon-settings
		*    effects page), or use any custom function to have a customized easing
		*    (see below for examples and a more in-depth description). The default
		*    transition is "easeOutExpo".
		*    \
		*    If you want to use a custom function as the transition, the function must
		*    receive four parameters: current time on the transition, starting
		*    tweening value, change needed in that value, and total easing duration
		*    (plus an optional object, which will contain any parameter passed as the
		*    transitionParams property of new tweenings). During each tweening, the
		*    transition function will be continuously called, with the first parameter
		*    increasing until it reaches the total duration; it must return the new
		*    expected value.
		*    \
		*    An example of a custom transition is as follows:
		* ```
		* let myFunc = function(t, b, c, d) {
		*     let ts = (t/=d)*t;
		*     let tc = ts*t;
		*     return b+c*(-97.1975*tc*ts + 257.5975*ts*ts + -234.4*tc + 80*ts + -5*t);
		* };
		* Tweener.addTween(this.actor, {x: 200, time: 1, transition: myFunc});
		* ```
		 */
		transition?: string | TransitionFunction;
		/** extra parameters to pass to the custom
		 *    transition function */
		transitionParams?: any[];
		/**
		 *  A function that is called immediately before a
		*    tweening starts. It is called once regardless of the number of properties
		*    involved on the tweening. The function scope (in which the event is
		*    executed) is the target object itself, unless specified by the
		*    onStartScope parameter.
		 */
		onStart?: Function;
		/**
		 * A function that is called every time a tweening
		*    updates its properties. The function scope (in which the event is
		*    executed) is the target object itself, unless specified by the
		*    @onUpdateScope parameter.
		 */
		onUpdate?: Function;
		/** A function that is called immediately after a
		 *    tweening is completed. It is called once regardless of the number of
		 *    properties involved on the tweening. The function scope (in which the
		 *    event is executed) is the target object itself, unless specified by the
		 *    @onCompleteScope parameter. */
		onComplete?: Function;
		/**
		 * A function that is called when tweening is
		*    overwritten. It is called once regardless of the number of properties
		*    involved on the tweening. The function scope is the target object itself,
		*    unless specified by the @onOverwriteScope parameter.
		 */
		onOverwrite?: Function;
		/**
		 * A function that gets called when an error occurs
		 *    when trying to run a tweening. This is used to handle errors more
		 *    commonly thrown by other events (that is, from code not controlled by
		 *    Tweener), such as onStart, onUpdate or onComplete. The function scope (in
		 *    which the event is executed) is the target object itself, unless
		 *    specified by the @onErrorScope parameter.
		 */
		onError?: Function;
		/** Whether or not the values for this tweening must be
		 *    rounded before being applied to their respective properties. This is
		 *    useful, for example, when sliding objects that must be positioned on
		 *    round pixels, like labels that use pixel fonts; its x and y properties
		 *    need to be rounded all the time to avoid blurring the text. This option
		 *    acts on all properties for that specific tween. The default value for
		 *    this parameter (when omitted) is false. */
		rounded?: boolean
		/** (real): The minimum the values of this tweening can take. This is
		 *    useful, for example, when you animate the opacity of an object with a
		 *    bounce transition and don't want the opacity of an object to fall below
		 *    0.  Leave empty for no minimum. */
		min?: number;
		/** (real): The maximum the values of this tweening can take. This is
		 *    useful, for example, when you animate the opacity of an object with a
		 *    bounce transition and don't want the opacity of an object to go above 1.
		 *    Leave empty for no maximum.*/
		max?: number;
		/** A list of parameters (of any type) to be passed
			*    to the onStart function.  */
		onStartParams?: any[];
		/** A list of parameters (of any type) to be passed
			*    to the onUpdate function. */
		onUpdateParams?: any[];
		/** A list of parameters (of any type) to be
			*    passed to the onComplete function.  */
		onCompleteParams?: any[];
		/** A list of parameters (of any type) to be
			*    passed to the onOverwrite function.  */
		onOverwriteParams?: any[];
		/** The object in which the onStart function will
		 *    be executed. This is needed if you have some specialized code inside the
		 *    event function; in that case, references to this. inside the function
		 *    will reference to the object defined by this parameter. If omitted, the
		 *    tweened object is the scope used instead. */
		onStartScope?: any;
		/** The object in which the onUpdate function will
		 *    be executed. This is needed if you have some specialized code inside the
		 *    event function; in that case, references to this. inside the function
		 *    will reference to the object defined by this parameter. If omitted, the
		 *    tweened object is the scope used instead. */
		onUpdateScope?: any;
		/** The object in which the onComplete function
		 *    will be executed. This is needed if you have some specialized code inside
		 *    the event function; in that case, references to this. inside the function
		 *    will reference to the object defined by this parameter. If omitted, the
		 *    tweened object is the scope used instead. */
		onCompleteScope?: any;
		/** The object in which the onOverwrite function
		 *    will be executed. This is needed if you have some specialized code inside
		 *    the event function; in that case, references to this. inside the function
		 *    will reference to the object defined by this parameter. If omitted, the
		 *    tweened object is the scope used instead. */
		onOverwriteScope?: any;
		/** @onErrorScope (object): The object in which the onError function will
		 *    be executed. This is needed if you have some specialized code inside the
		 *    event function; in that case, references to this. inside the function
		 *    will reference to the object defined by this parameter. If omitted, the
		 *    tweened object is the scope used instead. */
		onErrorScope?: any;
	}

	type TransitionFunction = (curTime: number, startVal: number, changeInStartVal: number, totalDuration: number, ...params: any) => number;

	/**
	 * 
	 * @param scope the object we are interested in
	 * @returns Returns the number of tweens @scope currently has.
	 */
	export function getTweenCount(scope: any): number;

	/**
	 * 
	 * @param scope the object we are interested in
	 * @returns whether scope is animating
	 */
	export function isTweening(scope: any): boolean;

	/**
	 * emoves all tweens running on the object.
	 *
	 * FIXME: removeTweens should be much more powerful, but I have no idea how it
	 * works
	 * Removes all tweens running on the object.
	 * @param scope the object we are interested in
	 * @returns success
	 */
	export function removeTweens(scope: any): boolean;

	/**
	 * Pauses all the tweens running on the object. Can be resumed with
	 * Tweener.resumeTweens
	 *
	 * FIXME: removeTweens should be much more powerful, but I have no idea how it
	 * works
	 * @param scope the object we are interested in
	 */
	export function pauseTweens(scope: any): void;

	/**
	 * Resumes all the tweens running on the object paused by Tweener.pauseTweens
	 *
	 * FIXME: removeTweens should be much more powerful, but I have no idea how it
	 * works
	 * @param scope the object we are interested in
	 */
	export function resumeTweens(scope: any): any[];

	export function registerSpecialProperty(name: string, getFunction: Function, setFunction: Function, parameters: any, preProcessFunction: Function): void;

	export function registerSpecialPropertyModifier(name: string, modifyFunction: Function, getFunction: Function): void;

	export function registerSpecialPropertySplitter(name: string, splitFunction: Function, parameters: any): void;

	/** 
	 * @short_description Object used internally for clutter animations
	 *
	 * The 'FrameTicker' object is an object used to feed new frames to
	 * Tweener so it can update values and redraw. The default frame
	 * ticker for Tweener just uses a simple timeout at a fixed frame rate
	 * and has no idea of "catching up" by dropping frames.
	 *
	 * We substitute it with custom frame ticker here that connects
	 * Tweener to a Clutter.TimeLine. Now, Clutter.Timeline itself isn't a
	 * whole lot more sophisticated than a simple timeout at a fixed frame
	 * rate, but at least it knows how to drop frames. (See
	 * HippoAnimationManager for a more sophisticated view of continuous
	 * time updates; even better is to pay attention to the vertical
	 * vblank and sync to that when possible.)
	 */
	export class ClutterFrameTicker {
		getTime(): number;
		start(): void;
		stop(): void;
	}
}
