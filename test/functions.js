(function () {
	var _ = typeof require == 'function' ? require( '..' ) : window._;

	QUnit.module( 'Functions' );
	QUnit.config.asyncRetries = 3;

	QUnit.test( 'bind', function ( assert ) {
		var context = { name: 'moe' };
		var func = function ( arg ) {
			return 'name: ' + ( this.name || arg );
		};
		var bound = _.bind( func, context );
		assert.strictEqual( bound(), 'name: moe', 'can bind a function to a context');

//		bound = _( func ).bind( context );
//		assert.strictEqual( bound(), 'name: moe', 'can do OO-style binding' );

		bound = _.bind( func, null, 'curly' );
		var result = bound();
		assert.ok( result === 'name: curly' || result === 'name ' + window.name, 'can bind without specifying a context' );

		var F = function () { return this; };
		var boundf = _.bind( F, { hello: 'moe curly' } );
		var Boundf = boundf;
		var newBoundf = new Boundf();
		assert.strictEqual( newBoundf.hello, void 0, 'function should not be bound to the context, to comply with ECMAScript 5' );

	});
}());
