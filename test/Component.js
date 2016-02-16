'use strict';

import { async, core } from 'metal';
import { dom, features } from 'metal-dom';
import Component from '../src/Component';
import ComponentCollector from '../src/ComponentCollector';
import ComponentRegistry from '../src/ComponentRegistry';
import ComponentRenderer from '../src/ComponentRenderer';

describe('Component Tests', function() {
	afterEach(function() {
		document.body.innerHTML = '';
	});

	describe('Lifecycle', function() {
		beforeEach(function() {
			sinon.spy(Component.prototype, 'render');
			sinon.spy(Component.prototype, 'attached');
			sinon.spy(Component.prototype, 'detached');

			sinon.spy(Component.RENDERER.prototype, 'render');
			sinon.spy(Component.RENDERER.prototype, 'update');
		});

		afterEach(function() {
			Component.prototype.render.restore();
			Component.prototype.attached.restore();
			Component.prototype.detached.restore();

			Component.RENDERER.prototype.render.restore();
			Component.RENDERER.prototype.update.restore();
		});

		it('should run component render lifecycle', function() {
			var custom = new Component();
			var renderListener = sinon.stub();
			custom.on('render', renderListener);
			custom.render();

			sinon.assert.callOrder(
				Component.prototype.render,
				Component.RENDERER.prototype.render,
				renderListener,
				Component.prototype.attached
			);
			sinon.assert.callCount(Component.prototype.render, 1);
			sinon.assert.callCount(Component.RENDERER.prototype.render, 1);
			sinon.assert.callCount(renderListener, 1);
			sinon.assert.callCount(Component.prototype.attached, 1);
			sinon.assert.notCalled(Component.prototype.detached);
		});

		it('should be able to manually invoke detach/attach lifecycle', function() {
			var custom = new Component();
			custom.render();
			sinon.assert.callCount(Component.prototype.attached, 1);

			custom.detach();
			custom.detach(); // Allow multiple
			assert.strictEqual(null, document.getElementById(custom.id));
			assert.strictEqual(false, custom.inDocument);
			sinon.assert.callCount(Component.prototype.detached, 1);

			custom.attach();
			custom.attach(); // Allow multiple
			assert.notStrictEqual(null, document.getElementById(custom.id));
			assert.strictEqual(true, custom.inDocument);
			sinon.assert.callCount(Component.prototype.attached, 2);
		});

		it('should throw error when component renders and it was already rendered', function() {
			var custom = new Component();
			custom.render();
			assert.throws(function() {
				custom.render();
			}, Error);
			sinon.assert.callCount(Component.prototype.attached, 1);
		});

		it('should throw error when component decorates and it was already decorated', function() {
			var custom = new Component();
			custom.decorate();
			assert.throws(function() {
				custom.decorate();
			}, Error);
			sinon.assert.callCount(Component.prototype.attached, 1);
		});

		it('should return component instance from lifecycle methods', function() {
			var custom = new Component();

			assert.strictEqual(custom, custom.render());
			assert.strictEqual(custom, custom.detach());

			custom = new Component();
			assert.strictEqual(custom, custom.decorate());

			custom.detach();
			assert.strictEqual(custom, custom.attach());
		});

		it('should add component to ComponentCollector after it\'s created', function() {
			var custom = new Component({
				id: 'custom'
			});
			assert.strictEqual(custom, ComponentCollector.components.custom);
		});

		it('should dispose component', function() {
			var custom = new Component();
			custom.render();

			var customId = custom.id;
			assert.notStrictEqual(null, document.getElementById(customId));
			custom.dispose();
			assert.strictEqual(null, document.getElementById(customId));

			sinon.assert.callCount(Component.prototype.detached, 1);
		});
	});

	describe('Attributes', function() {
		it('should set component id attr', function() {
			var custom = new Component({
				id: 'customId'
			});
			custom.render();
			assert.strictEqual('customId', custom.id);
		});

		it('should not create default element value when default "id" is created', function() {
			var custom = new Component();
			assert.ok(custom.id);
			assert.ok(!custom.hasBeenSet('element'));
		});

		it('should set component element attr', function() {
			var element = document.createElement('div');
			element.id = 'elementId';
			document.body.appendChild(element);

			var custom = new Component({
				element: element
			});
			custom.render();
			assert.strictEqual('elementId', custom.id);
			assert.strictEqual(element, custom.element);
		});

		it('should set component element attr from selector', function() {
			var element = document.createElement('div');
			element.className = 'myClass';
			document.body.appendChild(element);

			var custom = new Component({
				element: '.myClass'
			});
			custom.render();
			assert.strictEqual(element, custom.element);
		});

		it('should set component element to default value if selector doesn\'t match any element', function() {
			var custom = new Component({
				element: '.myClass'
			});
			custom.render();
			assert.ok(custom.element);
		});

		it('should set component element id from id attr', function() {
			var element = document.createElement('div');
			element.id = 'elementId';
			document.body.appendChild(element);

			var custom = new Component({
				element: element,
				id: 'customId'
			});
			custom.render();
			assert.strictEqual('customId', element.id);
			assert.strictEqual(element, custom.element);
		});

		it('should set component elementClasses attr', function(done) {
			var custom = new Component({
				elementClasses: 'foo bar'
			});
			custom.render();

			assert.strictEqual(3, getClassNames(custom.element).length);
			assert.strictEqual('component', getClassNames(custom.element)[0]);
			assert.strictEqual('foo', getClassNames(custom.element)[1]);
			assert.strictEqual('bar', getClassNames(custom.element)[2]);

			custom.elementClasses = 'other';
			async.nextTick(function() {
				assert.strictEqual(2, getClassNames(custom.element).length);
				assert.strictEqual('component', getClassNames(custom.element)[0]);
				assert.strictEqual('other', getClassNames(custom.element)[1]);
				done();
			});
		});

		it('should add default component elementClasses from static hint', function() {
			var CustomComponent = createCustomComponentClass();
			CustomComponent.ELEMENT_CLASSES = 'overwritten1 overwritten2';

			var custom = new CustomComponent();
			custom.render();
			assert.strictEqual(3, getClassNames(custom.element).length);
			assert.strictEqual('overwritten1', getClassNames(custom.element)[0]);
			assert.strictEqual('overwritten2', getClassNames(custom.element)[1]);
			assert.strictEqual('component', getClassNames(custom.element)[2]);
		});

		it('should update element display value according to visible attr', function(done) {
			var custom = new Component().render();

			assert.ok(custom.visible);
			assert.strictEqual('', custom.element.style.display);

			custom.visible = false;
			custom.once('attrsChanged', function() {
				assert.strictEqual('none', custom.element.style.display);
				custom.visible = true;
				custom.once('attrsChanged', function() {
					assert.strictEqual('', custom.element.style.display);
					done();
				});
			});
		});

		describe('events attr', function() {
			it('should attach events to specified functions', function() {
				var listener1 = sinon.stub();
				var listener2 = sinon.stub();

				var custom = new Component({
					events: {
						event1: listener1,
						event2: listener2
					}
				});

				custom.emit('event1');
				assert.strictEqual(1, listener1.callCount);
				assert.strictEqual(0, listener2.callCount);

				custom.emit('event2');
				assert.strictEqual(1, listener1.callCount);
				assert.strictEqual(1, listener2.callCount);
			});

			it('should attach events to specified function names', function() {
				var CustomComponent = createCustomComponentClass();
				CustomComponent.prototype.listener1 = sinon.stub();

				var custom = new CustomComponent({
					events: {
						event1: 'listener1'
					}
				});

				custom.emit('event1');
				assert.strictEqual(1, custom.listener1.callCount);
			});

			it('should warn if trying to attach event to unexisting function name', function() {
				sinon.stub(console, 'error');
				new Component({
					events: {
						event1: 'listener1'
					}
				});

				assert.strictEqual(1, console.error.callCount);
				console.error.restore();
			});

			it('should attach events to specified function name on another component', function() {
				var AnotherComponent = createCustomComponentClass();
				AnotherComponent.prototype.listener1 = sinon.stub();

				var another = new AnotherComponent({
					id: 'another'
				});
				var custom = new Component({
					events: {
						event1: 'another:listener1'
					}
				});

				custom.emit('event1');
				assert.strictEqual(1, another.listener1.callCount);
			});

			it('should warn if trying to attach event to unexisting other component', function() {
				var CustomComponent = createCustomComponentClass();
				CustomComponent.prototype.listener1 = sinon.stub();

				sinon.stub(console, 'error');
				new CustomComponent({
					events: {
						event1: 'unexisting:listener1'
					}
				});

				assert.strictEqual(1, console.error.callCount);
				console.error.restore();
			});

			it('should attach delegate events with specified selector', function() {
				var CustomComponent = createCustomComponentClass('<button class="testButton"></button>');
				CustomComponent.prototype.listener1 = sinon.stub();

				var custom = new CustomComponent({
					events: {
						click: {
							fn: 'listener1',
							selector: '.testButton'
						}
					}
				}).render();

				dom.triggerEvent(custom.element, 'click');
				assert.strictEqual(0, custom.listener1.callCount);
				dom.triggerEvent(custom.element.querySelector('.testButton'), 'click');
				assert.strictEqual(1, custom.listener1.callCount);
			});

			it('should detach unused events when value of the "events" attribute is changed', function() {
				var CustomComponent = createCustomComponentClass();
				CustomComponent.prototype.listener1 = sinon.stub();
				CustomComponent.prototype.listener2 = sinon.stub();

				var custom = new CustomComponent({
					events: {
						event1: 'listener1'
					}
				});
				custom.events = {
					event2: 'listener2'
				};

				custom.emit('event1');
				assert.strictEqual(0, custom.listener1.callCount);

				custom.emit('event2');
				assert.strictEqual(1, custom.listener2.callCount);
			});
		});

		it('should fire synchronize attr synchronously on render and asynchronously when attr value change', function() {
			var CustomComponent = createCustomComponentClass();
			CustomComponent.ATTRS = {
				foo: {
					value: 0
				}
			};
			CustomComponent.prototype.syncUnkown = sinon.spy();
			CustomComponent.prototype.syncFoo = sinon.spy();

			var custom = new CustomComponent({
				foo: 10
			});
			sinon.assert.notCalled(CustomComponent.prototype.syncUnkown);
			sinon.assert.notCalled(CustomComponent.prototype.syncFoo);
			custom.render();
			sinon.assert.notCalled(CustomComponent.prototype.syncUnkown);
			sinon.assert.callCount(CustomComponent.prototype.syncFoo, 1);
			assert.strictEqual(10, CustomComponent.prototype.syncFoo.args[0][0]);

			custom.foo = 20;
			sinon.assert.callCount(CustomComponent.prototype.syncFoo, 1);
			async.nextTick(function() {
				sinon.assert.callCount(CustomComponent.prototype.syncFoo, 2);
				assert.strictEqual(20, CustomComponent.prototype.syncFoo.args[1][0]);
			});

			custom.unknown = 20;
			sinon.assert.notCalled(CustomComponent.prototype.syncUnkown);
			async.nextTick(function() {
				sinon.assert.notCalled(CustomComponent.prototype.syncUnkown);
			});
		});

		it('should fire sync methods for attrs defined by super classes as well', function() {
			var CustomComponent = createCustomComponentClass();
			CustomComponent.ATTRS = {
				foo: {
					value: 0
				}
			};

			class ChildComponent extends CustomComponent {
			}
			ChildComponent.ATTRS = {
				bar: {
					value: 1
				}
			};

			var custom = new ChildComponent();
			custom.syncFoo = sinon.spy();
			custom.syncBar = sinon.spy();
			custom.render();
			sinon.assert.callCount(custom.syncFoo, 1);
			sinon.assert.callCount(custom.syncBar, 1);
		});

		it('should emit "attrsSynced" event after attr changes update the component', function(done) {
			var CustomComponent = createCustomComponentClass();
			CustomComponent.ATTRS = {
				foo: {
					value: 0
				}
			};

			var custom = new CustomComponent().render();
			var listener = sinon.stub();
			custom.on('attrsSynced', listener);
			custom.foo = 1;
			custom.once('attrsChanged', function(data) {
				assert.strictEqual(1, listener.callCount);
				assert.strictEqual(data, listener.args[0][0]);
				done();
			});
		});

		it('should not allow defining attribute named components', function() {
			var CustomComponent = createCustomComponentClass();
			CustomComponent.ATTRS = {
				components: {}
			};

			assert.throws(function() {
				new CustomComponent();
			});
		});
	});

	describe('Render', function() {
		it('should render component on body if no parent is specified', function() {
			var CustomComponent = createCustomComponentClass();
			var custom = new CustomComponent();
			custom.render();

			assert.strictEqual(document.body, custom.element.parentNode);
		});

		it('should render component on specified default parent if no parent is specified', function() {
			var defaultParent = document.createElement('div');

			class CustomComponent extends Component {
				constructor(opt_config) {
					super(opt_config);
					this.DEFAULT_ELEMENT_PARENT = defaultParent;
				}
			}
			var custom = new CustomComponent();
			custom.render();

			assert.strictEqual(defaultParent, custom.element.parentNode);
		});

		it('should render component on requested parent', function() {
			var container = document.createElement('div');
			document.body.appendChild(container);

			var CustomComponent = createCustomComponentClass();
			var custom = new CustomComponent();
			custom.render(container);

			assert.strictEqual(container, custom.element.parentNode);
		});

		it('should render component on requested parent selector', function() {
			var container = document.createElement('div');
			container.className = 'myContainer';
			document.body.appendChild(container);

			var CustomComponent = createCustomComponentClass();
			var custom = new CustomComponent();
			custom.render('.myContainer');

			assert.strictEqual(container, custom.element.parentNode);
		});

		it('should render component on requested parent at specified position', function() {
			var container = document.createElement('div');
			var sibling1 = document.createElement('div');
			var sibling2 = document.createElement('div');
			container.appendChild(sibling1);
			container.appendChild(sibling2);
			document.body.appendChild(container);

			var CustomComponent = createCustomComponentClass();
			var custom = new CustomComponent();
			custom.render(container, sibling2);

			assert.strictEqual(container, custom.element.parentNode);
			assert.strictEqual(custom.element, sibling1.nextSibling);
			assert.strictEqual(sibling2, custom.element.nextSibling);
		});

		it('should render component according to specified sibling selector', function() {
			var container = document.createElement('div');
			var sibling1 = document.createElement('div');
			var sibling2 = document.createElement('div');
			sibling2.className = 'mySibling';
			container.appendChild(sibling1);
			container.appendChild(sibling2);
			document.body.appendChild(container);

			var CustomComponent = createCustomComponentClass();
			var custom = new CustomComponent();
			custom.render(container, '.mySibling');

			assert.strictEqual(container, custom.element.parentNode);
			assert.strictEqual(custom.element, sibling1.nextSibling);
			assert.strictEqual(sibling2, custom.element.nextSibling);
		});

		it('should emit "render" event with the decorating key set to false when render is called', function() {
			var custom = new Component();
			var listenerFn = sinon.stub();
			custom.once('render', listenerFn);

			custom.render();

			assert.strictEqual(1, listenerFn.callCount);
			assert.ok(!listenerFn.args[0][0].decorating);
		});

		it('should emit "render" event with the decorating key set to true when decorate is called', function() {
			var custom = new Component();
			var listenerFn = sinon.stub();
			custom.once('render', listenerFn);

			custom.decorate();

			assert.strictEqual(1, listenerFn.callCount);
			assert.ok(listenerFn.args[0][0].decorating);
		});
	});

	describe('Events', function() {
		it('should listen to events on the element through Component\'s "on" function', function() {
			var custom = new Component();
			custom.render();

			var element = custom.element;
			element.onclick = null;
			var listener = sinon.stub();
			custom.on('click', listener);

			dom.triggerEvent(element, 'click');
			assert.strictEqual(1, listener.callCount);

			custom.dispose();
			dom.triggerEvent(element, 'click');
			assert.strictEqual(1, listener.callCount);
		});

		it('should listen to delegate events on the element', function() {
			var CustomComponent = createCustomComponentClass('<div class="foo"></div>');
			var custom = new CustomComponent().render();

			var fooElement = custom.element.querySelector('.foo');
			var listener = sinon.stub();
			custom.delegate('click', '.foo', listener);

			dom.triggerEvent(fooElement, 'click');
			assert.strictEqual(1, listener.callCount);

			custom.dispose();
			dom.triggerEvent(fooElement, 'click');
			assert.strictEqual(1, listener.callCount);
		});

		it('should listen to custom events on the element', function() {
			var CustomComponent = createCustomComponentClass();
			var custom = new CustomComponent();
			custom.render();

			var listener = sinon.stub();
			custom.on('transitionend', listener);

			dom.triggerEvent(custom.element, features.checkAnimationEventName().transition);
			assert.strictEqual(1, listener.callCount);
		});
	});

	describe('Sub Components', function() {
		var ChildComponent;

		before(function() {
			ChildComponent = createCustomComponentClass();
			ChildComponent.ATTRS = {
				foo: {}
			};
			ComponentRegistry.register(ChildComponent, 'ChildComponent');
		});

		it('should add a new sub component', function() {
			var custom = new Component();
			custom.addSubComponent('ChildComponent', 'child', {
				foo: 'foo'
			});
			assert.strictEqual(1, Object.keys(custom.components).length);

			var sub = custom.components.child;
			assert.ok(sub instanceof ChildComponent);
			assert.strictEqual('foo', sub.foo);
		});

		it('should not create a new component when one with the given id already exists', function() {
			var child = new ChildComponent({
				id: 'child'
			});
			var custom = new Component();
			custom.addSubComponent('ChildComponent', 'child');

			assert.strictEqual(child, custom.components.child);
		});

		it('should get all sub components with ids matching a given prefix', function() {
			var custom = new Component();
			custom.addSubComponent('ChildComponent', 'child-with-prefix1');
			custom.addSubComponent('ChildComponent', 'child-without-prefix');
			custom.addSubComponent('ChildComponent', 'child-with-prefix2');
			custom.addSubComponent('ChildComponent', 'child-without-prefix2');

			var childrenWithPrefix = custom.getComponentsWithPrefix('child-with-prefix');
			assert.strictEqual(2, Object.keys(childrenWithPrefix).length);
			assert.ok(childrenWithPrefix['child-with-prefix1']);
			assert.ok(childrenWithPrefix['child-with-prefix2']);
		});

		it('should dispose sub components when parent component is disposed', function() {
			var custom = new Component();
			custom.addSubComponent('ChildComponent', 'child');

			var child = custom.components.child;
			assert.ok(!child.isDisposed());

			custom.dispose();
			assert.ok(child.isDisposed());
		});

		it('should not throw error when disposing a component with shared sub components', function() {
			class AnotherComponent extends Component {
				constructor(opt_config) {
					super(opt_config);
					this.addSubComponent('ChildComponent', 'child');
				}
			}
			ComponentRegistry.register(AnotherComponent);

			var custom = new Component();
			custom.addSubComponent('ChildComponent', 'child');
			custom.addSubComponent('AnotherComponent', 'another');

			var child = custom.components.child;
			var another = custom.components.another;
			assert.ok(!child.isDisposed());
			assert.ok(!another.isDisposed());

			custom.dispose();
			assert.ok(child.isDisposed());
			assert.ok(another.isDisposed());
		});

		it('should not throw error when disposing after subcomponents have already been disposed', function() {
			var custom = new Component();
			custom.addSubComponent('ChildComponent', 'child');

			custom.components.child.dispose();
			assert.doesNotThrow(custom.dispose.bind(custom));
		});
	});

	it('should register components', function() {
		class Foo extends Component {
		}
		class TestComponentToRegister extends Component {
		}
		var custom = new Foo();
		custom.registerMetalComponent(TestComponentToRegister);
		assert.ok(TestComponentToRegister, ComponentRegistry.getConstructor('TestComponentToRegister'));
	});

	it('should get the renderer instance', function() {
		class TestComponent extends Component {
		}
		var custom = new TestComponent();

		var renderer = custom.getRenderer();
		assert.ok(renderer instanceof ComponentRenderer);
	});

	function createCustomComponentClass(opt_rendererContentOrFn) {
		class CustomComponent extends Component {
		}
		CustomComponent.RENDERER = createCustomRenderer(opt_rendererContentOrFn);
		return CustomComponent;
	}

	function createCustomRenderer(opt_rendererContentOrFn) {
		class CustomRenderer extends ComponentRenderer {
			render() {
				if (core.isFunction(opt_rendererContentOrFn)) {
					opt_rendererContentOrFn();
				} else {
					this.component_.element.innerHTML = opt_rendererContentOrFn;
				}
			}
		}
		return CustomRenderer;
	}

	function getClassNames(element) {
		return element.className.trim().split(' ');
	}
});
